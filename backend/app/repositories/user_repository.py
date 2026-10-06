from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.user import User


def get_user_by_id(db: Session, user_id: int) -> User | None:
    return db.get(User, user_id)


def get_user_by_email(db: Session, email: str) -> User | None:
    statement = select(User).where(User.email == email)

    return db.scalar(statement)


def get_users(db: Session) -> list[User]:
    statement = select(User).order_by(User.id)

    return list(db.scalars(statement).all())


def create_user(
    db: Session,
    name: str,
    email: str,
    password_hash: str,
) -> User:
    user = User(
        name=name,
        email=email,
        password_hash=password_hash,
    )

    db.add(user)
    db.flush()
    db.refresh(user)

    return user