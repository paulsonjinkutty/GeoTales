from datetime import datetime

from geoalchemy2.elements import WKTElement
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.journey import Journey
from app.models.journey_point import JourneyPoint


def create_journey(
    db: Session,
    user_id: int,
    title: str,
    started_at: datetime,
) -> Journey:
    journey = Journey(
        user_id=user_id,
        title=title,
        started_at=started_at,
        ended_at=None,
    )

    db.add(journey)
    db.flush()

    return journey


def get_journey_by_id(
    db: Session,
    journey_id: int,
) -> Journey | None:
    statement = select(Journey).where(
        Journey.id == journey_id
    )

    return db.scalar(statement)


def get_journeys_by_user(
    db: Session,
    user_id: int,
) -> list[Journey]:
    statement = (
        select(Journey)
        .where(Journey.user_id == user_id)
        .order_by(Journey.started_at.desc())
    )

    return list(db.scalars(statement).all())


def get_next_sequence_number(
    db: Session,
    journey_id: int,
) -> int:
    statement = select(
        func.coalesce(
            func.max(JourneyPoint.sequence_number),
            0,
        )
    ).where(
        JourneyPoint.journey_id == journey_id
    )

    last_sequence = db.scalar(statement)

    return last_sequence + 1


def create_journey_point(
    db: Session,
    journey_id: int,
    latitude: float,
    longitude: float,
    recorded_at: datetime,
    sequence_number: int,
) -> JourneyPoint:
    location = WKTElement(
        f"POINT({longitude} {latitude})",
        srid=4326,
    )

    point = JourneyPoint(
        journey_id=journey_id,
        location=location,
        recorded_at=recorded_at,
        sequence_number=sequence_number,
    )

    db.add(point)
    db.flush()

    return point


def get_journey_point_coordinates(
    db: Session,
    point_id: int,
) -> tuple[float, float]:
    statement = select(
        func.ST_Y(JourneyPoint.location),
        func.ST_X(JourneyPoint.location),
    ).where(
        JourneyPoint.id == point_id
    )

    latitude, longitude = db.execute(statement).one()

    return float(latitude), float(longitude)


def get_journey_points(
    db: Session,
    journey_id: int,
) -> list[dict]:
    statement = (
        select(
            JourneyPoint,
            func.ST_Y(
                JourneyPoint.location
            ).label("latitude"),
            func.ST_X(
                JourneyPoint.location
            ).label("longitude"),
        )
        .where(JourneyPoint.journey_id == journey_id)
        .order_by(
            JourneyPoint.sequence_number.asc(),
            JourneyPoint.id.asc(),
        )
    )

    rows = db.execute(statement).all()

    return [
        {
            "id": point.id,
            "journey_id": point.journey_id,
            "latitude": float(latitude),
            "longitude": float(longitude),
            "recorded_at": point.recorded_at,
            "sequence_number": point.sequence_number,
        }
        for point, latitude, longitude in rows
    ]