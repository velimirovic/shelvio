from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert as pg_insert

from app.models.content_catalog import ContentCatalog
from app.services.embedding_service import build_embedding_text, get_embedding


async def upsert_content(
    db: AsyncSession,
    content_id: str,
    content_type: str,
    title: str,
    genres: list[str],
    overview: str,
) -> ContentCatalog:
    """Upisuje ili osvezava stavku u ContentCatalog i generise njen embedding vektor.
    Idempotentan - bezbedan za pozivanje vise puta sa istim content_id/type parom.
    """
    embedding_text = build_embedding_text(title, genres, overview)
    embedding = await get_embedding(embedding_text)

    result = await db.execute(
        select(ContentCatalog).where(
            ContentCatalog.content_id == content_id,
            ContentCatalog.content_type == content_type,
        )
    )
    item = result.scalar_one_or_none()

    if item is None:
        item = ContentCatalog(
            content_id=content_id,
            content_type=content_type,
            title=title,
            genres=genres,
            overview=overview,
            embedding=embedding,
        )
        db.add(item)
    else:
        item.title = title
        item.genres = genres
        item.overview = overview
        item.embedding = embedding

    await db.commit()
    await db.refresh(item)
    return item


async def get_by_content_id(
    db: AsyncSession, content_id: str, content_type: str
) -> ContentCatalog | None:
    result = await db.execute(
        select(ContentCatalog).where(
            ContentCatalog.content_id == content_id,
            ContentCatalog.content_type == content_type,
        )
    )
    return result.scalar_one_or_none()
