from sqlalchemy.orm import Session

from app.repositories.user_repository import (
    create_user,
    get_user_by_email,
    get_user_by_id,
    get_users,
)


def get_user(db: Session, user_id: int):
    return get_user_by_id(db, user_id)


def get_all_users(db: Session):
    return get_users(db)


def create_new_user(
    db: Session,
    name: str,
    email: str,
):
    existing_user = get_user_by_email(db, email)

    if existing_user is not None:
        raise ValueError("A user with this email already exists.")

    user = create_user(
        db=db,
        name=name,
        email=email,
    )

    db.commit()
    db.refresh(user)

    return user
