from collections.abc import Generator

import pytest
from sqlalchemy import create_engine, text
from sqlalchemy.engine import make_url
from sqlalchemy.orm import Session, sessionmaker

from app.core.config import settings
from app.db.base import Base
from app.db.session import get_db
from app.main import app as fastapi_app
from app.models.achievements import Achievement

# Importing the models registers their tables with Base.metadata.
# This allows SQLAlchemy to create all GeoTales tables for testing.
import app.models  # noqa: F401


# Reuse the configured database connection details, but change the
# database name so automated tests cannot write to the development DB.
source_url = make_url(settings.DATABASE_URL)

if source_url.database == "geotales_test":
    raise RuntimeError(
        "DATABASE_URL already points to geotales_test. "
        "Point it to your normal GeoTales database so this fixture "
        "can derive a separate test database URL."
    )

TEST_DATABASE_URL = source_url.set(database="geotales_test")

test_engine = create_engine(
    TEST_DATABASE_URL,
    pool_pre_ping=True,
)

TestingSessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=test_engine,
)


def override_get_db() -> Generator[Session, None, None]:
    """Provide a database session connected only to geotales_test."""
    db = TestingSessionLocal()

    try:
        yield db
    finally:
        db.close()


@pytest.fixture(autouse=True)
def isolate_test_database() -> Generator[None, None, None]:
    """
    Give every test a clean database schema.

    The schema reset applies only to geotales_test, never to the
    regular GeoTales development database.
    """

    with test_engine.begin() as connection:
        connection.execute(
            text("CREATE EXTENSION IF NOT EXISTS postgis")
        )

    Base.metadata.drop_all(bind=test_engine)
    Base.metadata.create_all(bind=test_engine)
    with TestingSessionLocal() as seed_db:
            seed_db.add_all(
                [
                    Achievement(
                        name="First Journey",
                        description="Complete your first journey.",
                        points=10,
                    ),
                    Achievement(
                        name="Trailblazer",
                        description="Complete five journeys.",
                        points=30,
                    ),
                    Achievement(
                        name="Route Collector",
                        description="Record ten GPS points across your journeys.",
                        points=20,
                    ),
                    Achievement(
                        name="Cartographer",
                        description="Record one hundred GPS points across your journeys.",
                        points=50,
                    ),
                ]
        )
            seed_db.commit()


    fastapi_app.dependency_overrides[get_db] = override_get_db

    try:
        yield
    finally:
        fastapi_app.dependency_overrides.pop(get_db, None)
        Base.metadata.drop_all(bind=test_engine)

@pytest.fixture
def db_session() -> Generator[Session, None, None]:
    """Provide a session connected to the isolated test database."""
    db = TestingSessionLocal()

    try:
        yield db
    finally:
        db.close()
