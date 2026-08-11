"""
Testovi za recommendation_service.py.

Pokriva: ciste pomocne funkcije (bez mocka), generisanje Redis kljuceva,
tiering logike, daily limit enforcement i filtriranje nepronađenih pickova.
"""

import json
from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

# conftest.py je vec postavio env varijable — sada mozemo importovati
import app.services.recommendation_service as svc


# ── Ciste pomocne funkcije ────────────────────────────────────────────────────

class TestFormatEntry:
    def test_basic(self):
        entry = {"title": "Dune", "contentType": "movie", "rating": 8.5}
        result = svc._format_entry(entry)
        assert "Dune" in result
        assert "movie" in result
        assert "8.5" in result

    def test_with_year_and_genres(self):
        entry = {
            "title": "The Expanse",
            "contentType": "series",
            "year": "2015",
            "genres": ["Sci-Fi", "Drama", "Action"],
            "rating": 9,
        }
        result = svc._format_entry(entry)
        assert "2015" in result
        assert "Sci-Fi" in result
        assert "Drama" in result
        # Samo 3 zanra max
        assert "Action" in result

    def test_in_progress_no_rating(self):
        entry = {"title": "Silo", "contentType": "series", "status": "in_progress"}
        result = svc._format_entry(entry)
        assert "currently watching/reading" in result
        assert "Silo" in result

    def test_no_optional_fields(self):
        entry = {"title": "Bare Minimum", "contentType": "book"}
        result = svc._format_entry(entry)
        assert result.startswith("- Bare Minimum")


class TestRedisKeys:
    def test_cache_key_format(self):
        assert svc._cache_key("user-1", "movie") == "rec:user-1:movie"
        assert svc._cache_key("abc", "all") == "rec:abc:all"

    def test_history_key_format(self):
        assert svc._history_key("user-1") == "rec_shown:user-1"

    def test_refs_key_format(self):
        assert svc._refs_key("user-1") == "rec_refs:user-1"

    def test_daily_key_contains_today(self):
        today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
        key = svc._daily_key("user-1")
        assert key == f"rec_daily:user-1:{today}"

    def test_daily_key_changes_per_user(self):
        assert svc._daily_key("user-1") != svc._daily_key("user-2")


# ── Tiering logika ────────────────────────────────────────────────────────────

class TestTiering:
    def _build_entries(self):
        return [
            {"title": "Dune",          "rating": 10, "status": "done",        "contentType": "movie"},
            {"title": "The Expanse",   "rating": 9,  "status": "done",        "contentType": "series"},
            {"title": "Interstellar",  "rating": 7,  "status": "done",        "contentType": "movie"},
            {"title": "Avatar",        "rating": 5,  "status": "done",        "contentType": "movie"},
            {"title": "Twilight",      "rating": 2,  "status": "done",        "contentType": "movie"},
            {"title": "Silo",          "rating": None, "status": "in_progress", "contentType": "series"},
        ]

    def test_loved_tier(self):
        entries = self._build_entries()
        loved = [e for e in entries if (e.get("rating") or 0) >= 8]
        titles = [e["title"] for e in loved]
        assert "Dune" in titles
        assert "The Expanse" in titles
        assert "Interstellar" not in titles

    def test_enjoyed_tier(self):
        entries = self._build_entries()
        enjoyed = [e for e in entries if 5 <= (e.get("rating") or 0) <= 7]
        titles = [e["title"] for e in enjoyed]
        assert "Interstellar" in titles
        assert "Avatar" in titles
        assert "Dune" not in titles

    def test_disliked_tier(self):
        entries = self._build_entries()
        disliked = [e for e in entries if (e.get("rating") or 0) > 0 and (e.get("rating") or 0) <= 4]
        titles = [e["title"] for e in disliked]
        assert "Twilight" in titles
        assert len(disliked) == 1

    def test_in_progress_tier(self):
        entries = self._build_entries()
        in_prog = [e for e in entries if e.get("status") == "in_progress" and not e.get("rating")]
        assert len(in_prog) == 1
        assert in_prog[0]["title"] == "Silo"

    def test_tiers_are_mutually_exclusive(self):
        entries = self._build_entries()
        loved    = [e for e in entries if (e.get("rating") or 0) >= 8]
        enjoyed  = [e for e in entries if 5 <= (e.get("rating") or 0) <= 7]
        disliked = [e for e in entries if (e.get("rating") or 0) > 0 and (e.get("rating") or 0) <= 4]
        in_prog  = [e for e in entries if e.get("status") == "in_progress" and not e.get("rating")]
        all_tiered = loved + enjoyed + disliked + in_prog
        # Ni jedan naslov ne smije biti u dva tiera
        assert len(all_tiered) == len(set(e["title"] for e in all_tiered))


# ── Daily limit ───────────────────────────────────────────────────────────────

class TestDailyLimit:
    @pytest.mark.asyncio
    async def test_get_daily_used_returns_zero_when_no_key(self):
        mock_redis = AsyncMock()
        mock_redis.get = AsyncMock(return_value=None)
        with patch.object(svc, "_redis", mock_redis):
            result = await svc._get_daily_used("user-1")
        assert result == 0

    @pytest.mark.asyncio
    async def test_get_daily_used_parses_stored_value(self):
        mock_redis = AsyncMock()
        mock_redis.get = AsyncMock(return_value="2")
        with patch.object(svc, "_redis", mock_redis):
            result = await svc._get_daily_used("user-1")
        assert result == 2

    @pytest.mark.asyncio
    async def test_increment_daily_sets_ttl(self):
        mock_redis = AsyncMock()
        mock_redis.incr = AsyncMock(return_value=1)
        mock_redis.expire = AsyncMock()
        with patch.object(svc, "_redis", mock_redis):
            result = await svc._increment_daily("user-1")
        assert result == 1
        mock_redis.expire.assert_called_once()
        # TTL mora biti pozitivan broj sekundi do ponoci
        ttl_arg = mock_redis.expire.call_args[0][1]
        assert 0 < ttl_arg <= 86460  # max 24h + 60s buffer

    @pytest.mark.asyncio
    async def test_daily_limit_blocks_generation(self):
        """Kad je dnevni limit iscrpljen, get_recommendations vraca grešku bez GPT poziva."""
        mock_redis = AsyncMock()
        # Cache miss, dnevni counter = 3 (limit)
        mock_redis.get = AsyncMock(return_value="3")
        with patch.object(svc, "_redis", mock_redis):
            result = await svc.get_recommendations(
                user_id="user-1",
                user_token="Bearer fake",
                content_type="all",
                force_refresh=True,
            )
        assert result["error"] == "daily_limit_reached"
        assert result["generationsRemaining"] == 0


# ── Filtriranje pickova koji nisu pronadjeni ──────────────────────────────────

class TestPickFiltering:
    @pytest.mark.asyncio
    async def test_unfound_picks_are_dropped(self):
        """
        Pickovi za koje Content Service ne vrati rezultat (video igre, halucinacije)
        moraju biti filtrirani iz finalnog odgovora.
        """
        fake_picks = [
            {"title": "Dune", "contentType": "movie", "year": "2021",
             "genres": ["Sci-Fi"], "explanation": "Great film."},
            {"title": "Some Telltale Game", "contentType": "movie", "year": "2020",
             "genres": ["Action"], "explanation": "Whoops."},
        ]
        found_results = [
            {"contentId": "movie-438631", "title": "Dune", "year": "2021", "posterUrl": "/dune.jpg"},
            None,  # Telltale nije pronadjen
        ]

        mock_redis = AsyncMock()
        mock_redis.get = AsyncMock(return_value=None)   # cache miss
        mock_redis.lrange = AsyncMock(return_value=[])  # prazna historija
        mock_redis.set = AsyncMock()
        mock_redis.pipeline = MagicMock(return_value=AsyncMock(
            **{"__aenter__": AsyncMock(return_value=AsyncMock(
                lpush=AsyncMock(), ltrim=AsyncMock(), expire=AsyncMock(),
                execute=AsyncMock(return_value=[])
            )), "__aexit__": AsyncMock(return_value=False)}
        ))

        mock_pipeline = AsyncMock()
        mock_pipeline.lpush = AsyncMock()
        mock_pipeline.ltrim = AsyncMock()
        mock_pipeline.expire = AsyncMock()
        mock_pipeline.execute = AsyncMock(return_value=[])
        mock_redis.pipeline = MagicMock(return_value=mock_pipeline)

        with (
            patch.object(svc, "_redis", mock_redis),
            patch.object(svc, "_get_daily_used", AsyncMock(return_value=0)),
            patch.object(svc, "_increment_daily", AsyncMock(return_value=1)),
            patch.object(svc, "_get_recent_shown", AsyncMock(return_value=[])),
            patch.object(svc, "_get_recent_refs", AsyncMock(return_value=[])),
            patch.object(svc, "_save_shown_and_refs", AsyncMock()),
            patch("app.services.recommendation_service.get_tracking_entries",
                  AsyncMock(return_value=[
                      {"title": "Stand by Me", "contentType": "movie",
                       "rating": 9, "status": "done", "year": "1986"}
                  ] * 5)),
            patch.object(svc._openai.chat.completions, "create",
                         AsyncMock(return_value=MagicMock(
                             choices=[MagicMock(message=MagicMock(
                                 content=json.dumps(fake_picks)
                             ))]
                         ))),
            patch("app.services.recommendation_service._search_content",
                  AsyncMock(side_effect=found_results)),
        ):
            result = await svc.get_recommendations(
                user_id="user-1",
                user_token="Bearer fake",
                content_type="all",
                force_refresh=True,
            )

        recs = result["recommendations"]
        assert len(recs) == 1
        assert recs[0]["title"] == "Dune"
        assert all(r["contentId"] is not None for r in recs)
