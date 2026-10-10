from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.dependencies import get_current_user
from app.core.authorization import ensure_owner
from app.db.session import get_db
from app.models.user import User
from app.schemas.journey import (
    JourneyCreate,
    JourneyPointCreate,
    JourneyPointResponse,
    JourneyResponse,
)
from app.services import journey_service
from app.services.journey_service import JourneyStateError


router = APIRouter(
    prefix="/journeys",
    tags=["Journeys"],
)


def get_owned_journey_or_404(
    db: Session,
    journey_id: int,
    current_user: User,
):
    journey = journey_service.get_journey(
        db=db,
        journey_id=journey_id,
    )

    if journey is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Journey not found.",
        )

    ensure_owner(
        current_user_id=current_user.id,
        resource_user_id=journey.user_id,
    )

    return journey


@router.post(
    "",
    response_model=JourneyResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_journey(
    journey_data: JourneyCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return journey_service.start_journey(
        db=db,
        user_id=current_user.id,
        title=journey_data.title,
    )


@router.get(
    "",
    response_model=list[JourneyResponse],
)
def get_my_journeys(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return journey_service.list_user_journeys(
        db=db,
        user_id=current_user.id,
    )


@router.get(
    "/{journey_id}",
    response_model=JourneyResponse,
)
def get_journey_by_id(
    journey_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return get_owned_journey_or_404(
        db=db,
        journey_id=journey_id,
        current_user=current_user,
    )


@router.post(
    "/{journey_id}/points",
    response_model=JourneyPointResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_journey_point(
    journey_id: int,
    point_data: JourneyPointCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    journey = get_owned_journey_or_404(
        db=db,
        journey_id=journey_id,
        current_user=current_user,
    )

    try:
        return journey_service.record_journey_point(
            db=db,
            journey=journey,
            latitude=point_data.latitude,
            longitude=point_data.longitude,
        )

    except JourneyStateError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=str(exc),
        ) from exc


@router.get(
    "/{journey_id}/points",
    response_model=list[JourneyPointResponse],
)
def get_journey_points(
    journey_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    journey = get_owned_journey_or_404(
        db=db,
        journey_id=journey_id,
        current_user=current_user,
    )

    return journey_service.list_journey_points(
        db=db,
        journey_id=journey.id,
    )


@router.post(
    "/{journey_id}/finish",
    response_model=JourneyResponse,
)
def finish_journey(
    journey_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    journey = get_owned_journey_or_404(
        db=db,
        journey_id=journey_id,
        current_user=current_user,
    )

    try:
        return journey_service.finish_journey(
            db=db,
            journey=journey,
        )

    except JourneyStateError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=str(exc),
        ) from exc