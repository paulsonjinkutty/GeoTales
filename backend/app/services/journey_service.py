from datetime import datetime, timezone

from sqlalchemy.orm import Session

from app.models.journey import Journey
from app.repositories import journey_repository
from app.services.achievement_service import award_eligible_achievements


class JourneyStateError(Exception):
    """Raised when an operation conflicts with a journey's state."""


def start_journey(
    db: Session,
    user_id: int,
    title: str,
) -> Journey:
    try:
        journey = journey_repository.create_journey(
            db=db,
            user_id=user_id,
            title=title,
            started_at=datetime.now(timezone.utc),
        )

        db.commit()
        db.refresh(journey)

        return journey

    except Exception:
        db.rollback()
        raise


def list_user_journeys(
    db: Session,
    user_id: int,
) -> list[Journey]:
    return journey_repository.get_journeys_by_user(
        db=db,
        user_id=user_id,
    )


def get_journey(
    db: Session,
    journey_id: int,
) -> Journey | None:
    return journey_repository.get_journey_by_id(
        db=db,
        journey_id=journey_id,
    )


def record_journey_point(
    db: Session,
    journey: Journey,
    latitude: float,
    longitude: float,
) -> dict:
    if journey.ended_at is not None:
        raise JourneyStateError(
            "Cannot record GPS points for a finished journey."
        )

    try:
        sequence_number = (
            journey_repository.get_next_sequence_number(
                db=db,
                journey_id=journey.id,
            )
        )

        recorded_at = datetime.now(timezone.utc)

        point = journey_repository.create_journey_point(
            db=db,
            journey_id=journey.id,
            latitude=latitude,
            longitude=longitude,
            recorded_at=recorded_at,
            sequence_number=sequence_number,
        )

        db.flush()

        stored_latitude, stored_longitude = (
            journey_repository.get_journey_point_coordinates(
                db=db,
                point_id=point.id,
            )
        )

        response = {
            "id": point.id,
            "journey_id": point.journey_id,
            "latitude": stored_latitude,
            "longitude": stored_longitude,
            "recorded_at": point.recorded_at,
            "sequence_number": point.sequence_number,
        }

        db.commit()

        return response

    except Exception:
        db.rollback()
        raise


def list_journey_points(
    db: Session,
    journey_id: int,
) -> list[dict]:
    return journey_repository.get_journey_points(
        db=db,
        journey_id=journey_id,
    )


def finish_journey(
    db: Session,
    journey: Journey,
) -> Journey:
    if journey.ended_at is not None:
        raise JourneyStateError(
            "This journey has already been finished."
        )

    try:
        journey.ended_at = datetime.now(timezone.utc)

        # Make the completed journey visible to the eligibility queries.
        db.flush()

        # Awards join the same transaction as journey completion.
        award_eligible_achievements(
            db=db,
            user_id=journey.user_id,
        )

        db.commit()
        db.refresh(journey)

        return journey

    except Exception:
        db.rollback()
        raise