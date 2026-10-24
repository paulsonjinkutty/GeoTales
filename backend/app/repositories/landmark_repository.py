from geoalchemy2 import Geography
from sqlalchemy import cast, func, or_
from sqlalchemy.orm import Session

from app.models.landmark import Landmark


def _landmark_columns():
    return [
        Landmark.id.label("id"),
        Landmark.name.label("name"),
        Landmark.description.label("description"),
        Landmark.category.label("category"),
        func.ST_Y(Landmark.location).label("latitude"),
        func.ST_X(Landmark.location).label("longitude"),
    ]


def list_landmarks(
    db: Session,
    category: str | None,
    search: str | None,
    skip: int,
    limit: int,
) -> list[dict]:
    query = db.query(*_landmark_columns())

    if category:
        query = query.filter(
            Landmark.category.ilike(category.strip())
        )

    if search:
        term = f"%{search.strip()}%"
        query = query.filter(
            or_(
                Landmark.name.ilike(term),
                Landmark.description.ilike(term),
            )
        )

    rows = (
        query
        .order_by(Landmark.name.asc(), Landmark.id.asc())
        .offset(skip)
        .limit(limit)
        .all()
    )

    return [dict(row._mapping) for row in rows]


def get_landmark_by_id(
    db: Session,
    landmark_id: int,
) -> dict | None:
    row = (
        db.query(*_landmark_columns())
        .filter(Landmark.id == landmark_id)
        .first()
    )

    return dict(row._mapping) if row else None


def find_nearby_landmarks(
    db: Session,
    latitude: float,
    longitude: float,
    radius_m: float,
    limit: int,
) -> list[dict]:
    # PostGIS points use X=longitude, Y=latitude.
    point = func.ST_SetSRID(
        func.ST_MakePoint(longitude, latitude),
        4326,
    )

    # Geography distance operations return distances in metres.
    landmark_geography = cast(
        Landmark.location,
        Geography(srid=4326),
    )
    search_geography = cast(
        point,
        Geography(srid=4326),
    )

    distance = func.ST_Distance(
        landmark_geography,
        search_geography,
    )

    rows = (
        db.query(
            *_landmark_columns(),
            distance.label("distance_m"),
        )
        .filter(
            func.ST_DWithin(
                landmark_geography,
                search_geography,
                radius_m,
            )
        )
        .order_by(distance.asc(), Landmark.id.asc())
        .limit(limit)
        .all()
    )

    return [dict(row._mapping) for row in rows]