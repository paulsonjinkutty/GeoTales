from sqlalchemy.orm import Session

from app.models.journey import Journey
from app.models.landmark import Landmark


class AIContextNotFoundError(Exception):
    pass


class AIContextForbiddenError(Exception):
    pass


def get_landmark_context(
    db: Session,
    landmark_id: int,
) -> dict:
    landmark = (
        db.query(Landmark)
        .filter(Landmark.id == landmark_id)
        .first()
    )

    if landmark is None:
        raise AIContextNotFoundError(
            "Landmark not found."
        )

    return {
        "id": landmark.id,
        "name": landmark.name,
        "category": landmark.category,
        "description": landmark.description,
    }


def get_owned_journey_context(
    db: Session,
    journey_id: int,
    current_user_id: int,
) -> dict:
    journey = (
        db.query(Journey)
        .filter(Journey.id == journey_id)
        .first()
    )

    if journey is None:
        raise AIContextNotFoundError(
            "Journey not found."
        )

    if journey.user_id != current_user_id:
        raise AIContextForbiddenError(
            "You do not have access to this journey."
        )

    return {
        "id": journey.id,
        "title": journey.title,
        "started_at": (
            journey.started_at.isoformat()
            if journey.started_at
            else None
        ),
        "ended_at": (
            journey.ended_at.isoformat()
            if journey.ended_at
            else None
        ),
    }


def get_landmark_candidates(
    db: Session,
    category: str | None,
    limit: int,
) -> list[dict]:
    query = db.query(Landmark)

    if category:
        query = query.filter(
            Landmark.category.ilike(category.strip())
        )

    landmarks = (
        query
        .order_by(Landmark.id.asc())
        .limit(limit)
        .all()
    )

    return [
        {
            "id": item.id,
            "name": item.name,
            "category": item.category,
            "description": item.description,
        }
        for item in landmarks
    ]