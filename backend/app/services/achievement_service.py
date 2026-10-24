from sqlalchemy import func
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.orm import Session, joinedload

from app.models.achievements import Achievement
from app.models.journey import Journey
from app.models.journey_point import JourneyPoint
from app.models.user_achievement import UserAchievement


ACHIEVEMENT_RULES = {
    "First Journey": {
        "description": "Complete your first journey.",
        "points": 10,
        "condition": "completed_journeys",
        "threshold": 1,
    },
    "Trailblazer": {
        "description": "Complete five journeys.",
        "points": 30,
        "condition": "completed_journeys",
        "threshold": 5,
    },
    "Route Collector": {
        "description": "Record ten GPS points across your journeys.",
        "points": 20,
        "condition": "gps_points",
        "threshold": 10,
    },
    "Cartographer": {
        "description": "Record one hundred GPS points across your journeys.",
        "points": 50,
        "condition": "gps_points",
        "threshold": 100,
    },
}


def list_achievements(db: Session) -> list[Achievement]:
    return (
        db.query(Achievement)
        .order_by(Achievement.points.asc(), Achievement.id.asc())
        .all()
    )


def list_user_achievements(
    db: Session,
    user_id: int,
) -> list[UserAchievement]:
    return (
        db.query(UserAchievement)
        .options(joinedload(UserAchievement.achievement))
        .filter(UserAchievement.user_id == user_id)
        .order_by(UserAchievement.earned_at.desc())
        .all()
    )


def award_eligible_achievements(
    db: Session,
    user_id: int,
) -> None:
    """Award eligible achievements without committing the caller's transaction."""

    completed_journeys = (
        db.query(func.count(Journey.id))
        .filter(
            Journey.user_id == user_id,
            Journey.ended_at.is_not(None),
        )
        .scalar()
        or 0
    )

    gps_points = (
        db.query(func.count(JourneyPoint.id))
        .join(Journey, Journey.id == JourneyPoint.journey_id)
        .filter(Journey.user_id == user_id)
        .scalar()
        or 0
    )

    eligible_counts = {
        "completed_journeys": completed_journeys,
        "gps_points": gps_points,
    }

    catalogue = (
        db.query(Achievement)
        .filter(Achievement.name.in_(list(ACHIEVEMENT_RULES)))
        .all()
    )

    for achievement in catalogue:
        rule = ACHIEVEMENT_RULES[achievement.name]
        actual = eligible_counts[rule["condition"]]

        if actual < rule["threshold"]:
            continue

        statement = (
            pg_insert(UserAchievement)
            .values(
                user_id=user_id,
                achievement_id=achievement.id,
            )
            .on_conflict_do_nothing(
                constraint="uq_user_achievement",
            )
        )

        db.execute(statement)