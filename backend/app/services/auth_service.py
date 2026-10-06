from sqlalchemy.orm import Session

from app.core.security import (
    create_access_token,
    hash_password,
    verify_password
)
from app.repositories.user_repository import (
    create_user,
    get_user_by_email,
)


def register_user(
    db: Session,
    name: str,
    email: str,
    password: str,
):
    existing_user = get_user_by_email(
        db,
        email,
    )

    if existing_user is not None:
        raise ValueError(
            "A user with this email already exists."
        )

    password_hash = hash_password(password)

    user = create_user(
        db=db,
        name=name,
        email=email,
        password_hash=password_hash,
    )

    db.commit()
    db.refresh(user)

    return user

def authenticate_user(
    db: Session,
    email: str,
    password: str,
):
    user = get_user_by_email(
        db,
        email,
    )

    if user is None:
        return None

    if not verify_password(
        password,
        user.password_hash,
    ):
        return None

    return user

def login_user(
    db: Session,
    email: str,
    password: str,
):
    user = authenticate_user(
        db,
        email,
        password,
    )

    if user is None:
        return None

    access_token = create_access_token(
        {
            "sub": str(user.id),
        }
    )

    return access_token