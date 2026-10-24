from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.api.dependencies import get_current_user
from app.db.session import get_db
from app.models.user import User
from app.schemas.landmark import LandmarkResponse
from app.services import landmark_service


router = APIRouter(
    prefix="/landmarks",
    tags=["Landmarks"],
)


@router.get(
    "/nearby",
    response_model=list[LandmarkResponse],
)
def get_nearby_landmarks(
    latitude: float = Query(ge=-90, le=90),
    longitude: float = Query(ge=-180, le=180),
    radius_m: float = Query(default=5000, gt=0, le=100000),
    limit: int = Query(default=20, ge=1, le=100),
    db: Session = Depends(get_db),
    _current_user: User = Depends(get_current_user),
):
    return landmark_service.get_nearby_landmarks(
        db=db,
        latitude=latitude,
        longitude=longitude,
        radius_m=radius_m,
        limit=limit,
    )


@router.get(
    "",
    response_model=list[LandmarkResponse],
)
def get_landmarks(
    category: str | None = Query(default=None, max_length=100),
    search: str | None = Query(default=None, min_length=1, max_length=100),
    skip: int = Query(default=0, ge=0, le=100000),
    limit: int = Query(default=20, ge=1, le=100),
    db: Session = Depends(get_db),
    _current_user: User = Depends(get_current_user),
):
    return landmark_service.list_landmarks(
        db=db,
        category=category,
        search=search,
        skip=skip,
        limit=limit,
    )


@router.get(
    "/{landmark_id}",
    response_model=LandmarkResponse,
)
def get_landmark_by_id(
    landmark_id: int,
    db: Session = Depends(get_db),
    _current_user: User = Depends(get_current_user),
):
    landmark = landmark_service.get_landmark(
        db=db,
        landmark_id=landmark_id,
    )

    if landmark is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Landmark not found.",
        )

    return landmark