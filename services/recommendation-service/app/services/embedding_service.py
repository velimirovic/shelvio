from openai import AsyncOpenAI
from app.core.config import settings

_client = AsyncOpenAI(api_key=settings.openai_api_key)


def build_embedding_text(title: str, genres: list[str], overview: str) -> str:
    """Pravi jedan tekstualni string koji ce se embedovati.
    Format: 'Title | Genre1, Genre2 | Overview...' (overview skracen na 400 znakova).
    Zarezi i | su delimiteri koje embedding model hvata kao granice semantickih celina.
    """
    parts = [title]
    if genres:
        parts.append(", ".join(genres))
    if overview:
        parts.append(overview[:400])
    return " | ".join(parts)


async def get_embedding(text: str) -> list[float]:
    text = text.replace("\n", " ").strip()
    response = await _client.embeddings.create(
        input=text,
        model=settings.embedding_model,
    )
    return response.data[0].embedding
