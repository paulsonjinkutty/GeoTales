from datetime import datetime

from geoalchemy2 import Geometry
from sqlalchemy import DateTime, ForeignKey, Integer
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class JourneyPoint(Base):
    __tablename__ = "journey_points"

    id: Mapped[int] = mapped_column(primary_key=True)

    journey_id: Mapped[int] = mapped_column(
        ForeignKey("journeys.id"),
        nullable=False,
        index=True,
    )

    location: Mapped[object] = mapped_column(
        Geometry(
            geometry_type="POINT",
            srid=4326,
        ),
        nullable=False,
    )

    recorded_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
    )

    sequence_number: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
    )

    journey = relationship("Journey")