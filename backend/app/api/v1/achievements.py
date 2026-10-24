from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.dependencies import get_current_user
from app.db.session import get_db
from app.models.user import User
from app.schemas.achievement import (
    AchievementResponse,
    EarnedAchievementResponse,
)
from app.services import achievement_service


router = APIRouter(
    prefix="/achievements",
    tags=["Achievements"],
)


@router.get(
    "",
    response_model=list[AchievementResponse],
)
def get_achievements(
    db: Session = Depends(get_db),
    _current_user: User = Depends(get_current_user),
):
    return achievement_service.list_achievements(db)


@router.get(
    "/me",
    response_model=list[EarnedAchievementResponse],
)
def get_my_achievements(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return achievement_service.list_user_achievements(
        db=db,
        user_id=current_user.id,
    )