from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.schemas.user import  UserResponse
from app.services.user_service import (
    
    get_all_users,
    get_user,
)

from app.api.dependencies import get_current_user
from app.models.user import User

router = APIRouter(
    prefix="/users",
    tags=["Users"],
)


@router.get("", response_model=list[UserResponse])
def read_users(
    db: Session = Depends(get_db),
):
    return get_all_users(db)


@router.get("/{user_id}", response_model=UserResponse)
def read_user(
    user_id: int,
    db: Session = Depends(get_db),
):
    user = get_user(db, user_id)

    if user is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )

    return user


@router.get("/me",response_model=UserResponse,)
def read_my_profile(
    current_user: User = Depends(get_current_user),
):
    return current_user