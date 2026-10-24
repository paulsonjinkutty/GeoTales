from sqlalchemy.orm import Session

from app.repositories import landmark_repository


def list_landmarks(
    db: Session,
    category: str | None,
    search: str | None,
    skip: int,
    limit: int,
) -> list[dict]:
    return landmark_repository.list_landmarks(
        db=db,
        category=category,
        search=search,
        skip=skip,
        limit=limit,
    )


def get_landmark(
    db: Session,
    landmark_id: int,
) -> dict | None:
    return landmark_repository.get_landmark_by_id(
        db=db,
        landmark_id=landmark_id,
    )


def get_nearby_landmarks(
    db: Session,
    latitude: float,
    longitude: float,
    radius_m: float,
    limit: int,
) -> list[dict]:
    return landmark_repository.find_nearby_landmarks(
        db=db,
        latitude=latitude,
        longitude=longitude,
        radius_m=radius_m,
        limit=limit,
    )