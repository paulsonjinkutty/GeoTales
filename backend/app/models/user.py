from sqlalchemy import String
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base

# "User" is a SQLAlchemy model that represents a user in the database. It inherits from the Base class, which is a declarative base for SQLAlchemy models. The User class defines the structure of the "users" table in the database, including columns for id, name, and email. The id column is an integer primary key, while the name and email columns are strings with specified lengths. The email column is also unique and indexed for efficient querying.
class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(100))
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)