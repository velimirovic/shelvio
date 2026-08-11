import asyncio
import json
import logging
import random

import httpx
import redis.asyncio as aioredis
from openai import AsyncOpenAI

from app.core.config import settings
from app.services.profile_service import get_tracking_entries, MIN_DONE_ENTRIES

logger = logging.getLogger(__name__)

_openai = AsyncOpenAI(api_key=settings.openai_api_key)
_redis = aioredis.from_url(settings.redis_url, decode_responses=True)

# TODO: dodati dnevni refresh limit (Redis counter + TTL do ponoci) pre
# finalizacije projekta - npr. 3 refresh-a dnevno po korisniku da se kontrolisu
# troskovi OpenAI poziva u produkciji.

FINAL_PICKS = 5
RECENT_HISTORY_GENERATIONS = 5  # koliko generisanja unazad se iskljucuje
DAILY_LIMIT = 3


def _cache_key(user_id: str, content_type: str) -> str:
    return f"rec:{user_id}:{content_type}"


def _history_key(user_id: str) -> str:
    return f"rec_shown:{user_id}"


def _refs_key(user_id: str) -> str:
    return f"rec_refs:{user_id}"


def _daily_key(user_id: str) -> str:
    from datetime import datetime, timezone
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    return f"rec_daily:{user_id}:{today}"


async def _get_daily_used(user_id: str) -> int:
    val = await _redis.get(_daily_key(user_id))
    return int(val) if val else 0


async def _increment_daily(user_id: str) -> int:
    from datetime import datetime, timezone, timedelta
    key = _daily_key(user_id)
    count = await _redis.incr(key)
    # TTL do ponoci UTC + 60s buffer
    now = datetime.now(timezone.utc)
    midnight = (now + timedelta(days=1)).replace(hour=0, minute=0, second=0, microsecond=0)
    await _redis.expire(key, int((midnight - now).total_seconds()) + 60)
    return count


# Max refs po generisanju × broj generisanja u historiji
_MAX_REFS = FINAL_PICKS * 2 * RECENT_HISTORY_GENERATIONS


async def _get_recent_shown(user_id: str) -> list[str]:
    """Vraca naslove preporucene u zadnjih RECENT_HISTORY_GENERATIONS generisanja."""
    raw = await _redis.lrange(_history_key(user_id), 0, FINAL_PICKS * RECENT_HISTORY_GENERATIONS - 1)
    return raw


async def _get_recent_refs(user_id: str) -> list[str]:
    """Vraca naslove koriscene kao reference u opisima poslednjih RECENT_HISTORY_GENERATIONS generisanja."""
    return await _redis.lrange(_refs_key(user_id), 0, _MAX_REFS - 1)


async def _save_shown_and_refs(user_id: str, shown: list[str], refs: list[str]) -> None:
    """Cuva preporucene naslove i naslove iz opisa u Redis (FIFO, 60-day TTL)."""
    ttl = 60 * 60 * 24 * 60
    pipe = _redis.pipeline()

    shown_key = _history_key(user_id)
    for title in reversed(shown):
        pipe.lpush(shown_key, title)
    pipe.ltrim(shown_key, 0, FINAL_PICKS * RECENT_HISTORY_GENERATIONS - 1)
    pipe.expire(shown_key, ttl)

    if refs:
        refs_key = _refs_key(user_id)
        for title in reversed(refs):
            pipe.lpush(refs_key, title)
        pipe.ltrim(refs_key, 0, _MAX_REFS - 1)
        pipe.expire(refs_key, ttl)

    await pipe.execute()


async def _search_content(client: httpx.AsyncClient, title: str, content_type: str) -> dict | None:
    type_path = {"movie": "movies", "series": "series", "book": "books"}.get(content_type)
    if not type_path:
        return None
    try:
        r = await client.get(
            f"{settings.content_service_url}/api/content/search/{type_path}",
            params={"query": title},
        )
        r.raise_for_status()
        data = r.json()
        items = data.get("results", []) if isinstance(data, dict) else data
        if items:
            logger.info(f"Search hit: '{title}' → {items[0].get('title')}")
            return items[0]
        logger.warning(f"Search empty: '{title}' ({content_type})")
    except Exception as e:
        logger.warning(f"Search failed: '{title}' ({content_type}) — {e}")
    return None


def _format_entry(e: dict) -> str:
    line = f"- {e['title']} ({e['contentType']}"
    if e.get("year"):
        line += f", {e['year']}"
    if e.get("genres"):
        line += f", genres: {', '.join(e['genres'][:3])}"
    if e.get("rating"):
        line += f", rated {e['rating']}/10"
    elif e.get("status") == "in_progress":
        line += ", currently watching/reading"
    return line + ")"


async def get_recommendations(
    user_id: str,
    user_token: str,
    content_type: str,
    force_refresh: bool = False,
) -> dict:
    """
    GPT-based recommendation pipeline:
      1. Provjeri Redis kes (osim kad force_refresh=True).
      2. Dohvati SVE korisnikove naslove — done + in_progress, sa svim podacima.
      3. GPT-4o mini generise FINAL_PICKS preporuka koristeci puni profil korisnika.
      4. Paralelno pretrazujemo Content Service za poster/contentId.
      5. Sacuvaj u Redis (12h TTL) i vrati.
    """
    cache_key = _cache_key(user_id, content_type)

    if not force_refresh:
        cached = await _redis.get(cache_key)
        if cached:
            logger.info(f"Cache hit for user={user_id} type={content_type}")
            payload = json.loads(cached)
            daily_used = await _get_daily_used(user_id)
            payload["generationsRemaining"] = max(0, DAILY_LIMIT - daily_used)
            payload["dailyLimit"] = DAILY_LIMIT
            return payload

    # Provjeri dnevni limit prije GPT poziva.
    daily_used = await _get_daily_used(user_id)
    if daily_used >= DAILY_LIMIT:
        return {
            "error": "daily_limit_reached",
            "message": f"You've used all {DAILY_LIMIT} generations for today. Resets at midnight UTC.",
            "generationsRemaining": 0,
            "dailyLimit": DAILY_LIMIT,
        }

    entries = await get_tracking_entries(user_token)

    # Koristimo done + in_progress — "plan" naslovi ne govore nista o ukusu.
    relevant = [e for e in entries if e.get("status") in ("done", "in_progress")]
    done = [e for e in relevant if e.get("status") == "done"]

    if len(done) < MIN_DONE_ENTRIES:
        return {
            "recommendations": [],
            "error": "not_enough_data",
            "message": (
                f"Add at least {MIN_DONE_ENTRIES} finished titles to your library "
                "so we can get a read on your taste."
            ),
        }

    # Razdvajamo biblioteku u nivoe ukusa — negativni signali su jednako vazni.
    loved     = [e for e in relevant if (e.get("rating") or 0) >= 8]
    enjoyed   = [e for e in relevant if 5 <= (e.get("rating") or 0) <= 7]
    disliked  = [e for e in relevant if (e.get("rating") or 0) > 0 and (e.get("rating") or 0) <= 4]
    in_prog   = [e for e in relevant if e.get("status") == "in_progress" and not e.get("rating")]

    def _tier_block(label: str, items: list) -> str:
        if not items:
            return ""
        lines = "\n".join(_format_entry(e) for e in items)
        return f"{label}:\n{lines}"

    history_block = "\n\n".join(filter(None, [
        _tier_block("LOVED (8–10/10) — core taste, strong positive signal", loved),
        _tier_block("ENJOYED (5–7/10) — liked but not defining", enjoyed),
        _tier_block("DISLIKED (1–4/10) — avoid similar patterns, styles, or genres", disliked),
        _tier_block("CURRENTLY WATCHING/READING — active interest", in_prog),
    ]))

    recently_shown, recently_used_refs = await asyncio.gather(
        _get_recent_shown(user_id),
        _get_recent_refs(user_id),
    )

    tracked_titles = ", ".join(f'"{e["title"]}"' for e in entries)
    recently_shown_str = (
        ", ".join(f'"{t}"' for t in recently_shown)
        if recently_shown else "none"
    )

    # Dodeljujemo reference za opise direktno iz Pythona — GPT ne bira, samo koristi.
    all_positive = loved + enjoyed + in_prog
    recently_used_ref_set = set(recently_used_refs)
    fresh_refs = [e for e in all_positive if e["title"] not in recently_used_ref_set]

    # Fallback: ako nema dovoljno svezih referenci, koristi ceo pozitivni skup.
    ref_pool = fresh_refs if len(fresh_refs) >= FINAL_PICKS * 2 else all_positive

    shuffled = list(ref_pool)
    random.shuffle(shuffled)

    # Prosirujem ciklicno ako je biblioteka jako mala, ali svaki par mora biti razlicit.
    while len(shuffled) < FINAL_PICKS * 2:
        extra = list(ref_pool)
        random.shuffle(extra)
        shuffled.extend(extra)

    # Svaki pick dobija tacno 2 razlicite reference (ne ponavljaju se unutar iste generacije).
    pick_refs: list[tuple[dict, dict]] = [
        (shuffled[i * 2], shuffled[i * 2 + 1]) for i in range(FINAL_PICKS)
    ]

    ref_assignments = "\n".join(
        f"- Pick {i + 1}: you MUST reference \"{a['title']}\" and \"{b['title']}\""
        for i, (a, b) in enumerate(pick_refs)
    )

    type_instruction = (
        f"Recommend only {content_type}s."
        if content_type != "all"
        else "Recommend a balanced mix — at least one movie, one series, and one book if possible."
    )

    prompt = f"""You are a personalised recommendation engine for a media tracking app (movies, series, books).

## User's taste profile

{history_block}

Do NOT recommend any of these (already tracked by the user): {tracked_titles}

Do NOT recommend any of these either (already recommended in recent sessions — the user has seen these suggestions): {recently_shown_str}

## Your task

Step 1 — Infer taste: Silently identify 2–3 recurring qualities in the LOVED tier (e.g. psychological complexity, slow-burn pacing, morally ambiguous characters, world-building depth). Then identify 1–2 patterns in the DISLIKED tier to actively avoid (tone, demographic, pacing style, genre conventions).

Step 2 — Recommend exactly {FINAL_PICKS} titles the user has NOT seen or read.
{type_instruction}

CRITICAL — only recommend content from these categories:
- Feature films with a theatrical or streaming release (findable on TMDB)
- Television/streaming series with a proper broadcast run (findable on TMDB)
- Published novels or non-fiction books (findable in major book databases)
NEVER recommend: video games, game adaptations of media (e.g. Telltale Games series), podcasts, stage productions, YouTube series, short films, web series under 10 episodes, DLC, or any interactive/game media. A title like "X: A Telltale Series" is a video game — do not recommend it.

Additional selection rules:
- Do NOT recommend sequels, prequels, spin-offs, reboots, or companion content of titles the user has already tracked. If they have "The Expanse" series, skip "The Expanse: A Telltale Series". If they have "Breaking Bad", skip "Better Call Saul".
- Spread picks across different release decades — no more than 2 picks from the same decade. If the user's LOVED tier spans multiple eras, honour that range.
- Spread across different genres — no two picks from the exact same genre.
- Avoid recommending anything with a style, tone, or target demographic similar to DISLIKED titles.
- A 9/10 or 10/10 is a far stronger signal than a 6/10 — weight proportionally.
- If 2 or more titles in the LOVED tier share the same director or author, you may include one additional title by that creator as one of your picks.

Step 3 — Write explanations. Each pick has exactly two pre-assigned library titles it MUST reference — no substitutions, no additions, no other library titles:
{ref_assignments}

For each pick (in the same order as your JSON array):
- Write exactly 2 sentences.
- Sentence 1: reference the FIRST assigned title; describe a SPECIFIC quality of the recommendation (narrative structure, atmosphere, pacing, thematic depth, visual style, author's voice) and how it connects.
- Sentence 2: reference the SECOND assigned title; highlight a DIFFERENT dimension (tone, character writing, world-building, genre nuance, emotional register).
- Do NOT name any other library title outside the two assigned ones.
- Only draw comparisons where tone, demographic, and complexity are genuinely compatible. No adult content vs children's media. No prestige drama vs slapstick.
- When explaining a movie or series, the assigned references should be from movies/series. When explaining a book, from books. If an assigned reference is cross-media, find a dimension that genuinely transfers (theme, emotional register, structural approach).
- Never open with "As a fan of", "If you liked", or any template phrase.

Respond ONLY with a valid JSON array. No markdown, no extra text.
Schema: [{{"title": "...", "contentType": "movie|series|book", "year": "YYYY", "genres": ["Genre1", "Genre2"], "explanation": "..."}}]"""

    logger.info(f"Calling GPT: user={user_id}, type={content_type}, loved={len(loved)}, enjoyed={len(enjoyed)}, disliked={len(disliked)}")

    gpt_resp = await _openai.chat.completions.create(
        model="gpt-4o-mini",
        messages=[{"role": "user", "content": prompt}],
        temperature=0.9,
        max_tokens=800,
    )

    raw = gpt_resp.choices[0].message.content.strip()
    try:
        picks = json.loads(raw)
    except json.JSONDecodeError:
        start, end = raw.find("["), raw.rfind("]") + 1
        picks = json.loads(raw[start:end]) if start != -1 else []

    async with httpx.AsyncClient(timeout=10.0) as client:
        search_results = await asyncio.gather(
            *[_search_content(client, p["title"], p["contentType"]) for p in picks]
        )

    enriched = []
    for pick, found in zip(picks, search_results):
        if not found:
            logger.warning(f"Dropping GPT pick '{pick['title']}' — not found in Content Service (likely a video game or hallucinated title)")
            continue
        gpt_genres = pick.get("genres") or []
        enriched.append({
            "contentId": found["contentId"],
            "contentType": pick["contentType"],
            "title": found["title"],
            "year": found.get("year") or pick.get("year"),
            "posterUrl": found.get("posterUrl"),
            "genres": gpt_genres,
            "explanation": pick.get("explanation", ""),
        })

    # Inkrementiraj dnevni brojac tek kad smo sigurni da je generisanje uspjelo.
    new_daily_used = await _increment_daily(user_id)
    generations_remaining = max(0, DAILY_LIMIT - new_daily_used)

    payload = {
        "recommendations": enriched,
        "generatedAt": _now_iso(),
        "generationsRemaining": generations_remaining,
        "dailyLimit": DAILY_LIMIT,
    }
    await _redis.set(cache_key, json.dumps(payload), ex=settings.recommendation_cache_ttl)

    # Reference su poznate iz Pythona — ne oslanjamo se na GPT da ih prijavi.
    used_refs = [title for a, b in pick_refs for title in (a["title"], b["title"])]
    shown_titles = [r["title"] for r in enriched]
    await _save_shown_and_refs(user_id, shown_titles, used_refs)

    return payload


def _now_iso() -> str:
    from datetime import datetime, timezone
    return datetime.now(timezone.utc).isoformat()
