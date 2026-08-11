from datetime import datetime
from sqlalchemy import String, DateTime
from sqlalchemy.orm import Mapped, mapped_column
from pgvector.sqlalchemy import Vector
from app.db.session import Base


class UserProfileVector(Base):
    __tablename__ = "user_profile_vectors"

    # userId je string UUID - preuzet iz JWT sub claim-a.
    user_id: Mapped[str] = mapped_column(String, primary_key=True)

    # Agregirani "ukus" korisnika: tezinska sredina embedding vektora pracenih naslova
    # (ocena kao tezina). Reracunava se na zahtev ako je stariji od cache TTL-a.
    embedding: Mapped[list[float]] = mapped_column(Vector(1536), nullable=False)

    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow
    )
