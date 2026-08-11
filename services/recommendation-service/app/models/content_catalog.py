from datetime import datetime
from sqlalchemy import String, DateTime, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import ARRAY
from sqlalchemy.orm import Mapped, mapped_column
from pgvector.sqlalchemy import Vector
from app.db.session import Base


class ContentCatalog(Base):
    __tablename__ = "content_catalog"

    # contentId je spoljni kljuc (TMDB ID za movie/series, Hardcover ID za book) -
    # isti identifikator koji koriste Content i Tracking servis.
    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    content_id: Mapped[str] = mapped_column(String, nullable=False)
    content_type: Mapped[str] = mapped_column(String(20), nullable=False)
    title: Mapped[str] = mapped_column(String, nullable=False)
    genres: Mapped[list[str]] = mapped_column(ARRAY(String), nullable=False, default=list)
    overview: Mapped[str] = mapped_column(Text, nullable=False, default="")

    # 1536-dim vektor (text-embedding-3-small default) - null dok embedding nije generisan.
    embedding: Mapped[list[float] | None] = mapped_column(Vector(1536), nullable=True)

    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow
    )

    __table_args__ = (
        UniqueConstraint("content_id", "content_type", name="uq_content_catalog_id_type"),
    )
