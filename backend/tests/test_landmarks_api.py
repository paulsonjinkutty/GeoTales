from uuid import uuid4

import pytest
from fastapi.testclient import TestClient
from geoalchemy2.elements import WKTElement
from sqlalchemy.orm import Session

from app.main import app
from app.models.landmark import Landmark


client = TestClient(app)


def create_user_and_headers() -> dict[str, str]:
    email = f"landmark-{uuid4().hex}@example.com"
    password = "LandmarkTestPassword123!"

    registration = client.post(
        "/api/v1/auth/register",
        json={
            "name": "Landmark Test User",
            "email": email,
            "password": password,
        },
    )
    assert registration.status_code == 201, registration.text

    login = client.post(
        "/api/v1/auth/login",
        data={"username": email, "password": password},
    )
    assert login.status_code == 200, login.text

    return {
        "Authorization": f"Bearer {login.json()['access_token']}"
    }


def create_landmark(
    db: Session,
    name: str,
    category: str,
    latitude: float,
    longitude: float,
) -> Landmark:
    landmark = Landmark(
        name=name,
        category=category,
        description=f"About {name}",
        location=WKTElement(
            f"POINT({longitude} {latitude})",
            srid=4326,
        ),
    )

    db.add(landmark)
    db.commit()
    db.refresh(landmark)

    return landmark


def test_landmark_endpoints_require_authentication():
    responses = [
        client.get("/api/v1/landmarks"),
        client.get("/api/v1/landmarks/nearby"),
        client.get("/api/v1/landmarks/1"),
    ]

    assert all(response.status_code == 401 for response in responses)


def test_list_landmarks_and_filter_by_category(
    db_session: Session,
):
    headers = create_user_and_headers()

    create_landmark(
        db_session, "Golconda Fort", "History", 17.3833, 78.4011
    )
    create_landmark(
        db_session, "City Museum", "Museum", 17.3700, 78.4800
    )

    response = client.get(
        "/api/v1/landmarks",
        headers=headers,
        params={"category": "history"},
    )

    assert response.status_code == 200, response.text
    results = response.json()

    assert len(results) == 1
    assert results[0]["name"] == "Golconda Fort"
    assert results[0]["latitude"] == pytest.approx(17.3833)
    assert results[0]["longitude"] == pytest.approx(78.4011)


def test_search_landmarks_by_name(
    db_session: Session,
):
    headers = create_user_and_headers()

    create_landmark(
        db_session, "Charminar", "Heritage", 17.3616, 78.4747
    )
    create_landmark(
        db_session, "Golconda Fort", "History", 17.3833, 78.4011
    )

    response = client.get(
        "/api/v1/landmarks",
        headers=headers,
        params={"search": "char"},
    )

    assert response.status_code == 200, response.text
    assert [item["name"] for item in response.json()] == ["Charminar"]


def test_get_landmark_by_id(
    db_session: Session,
):
    headers = create_user_and_headers()

    landmark = create_landmark(
        db_session, "Charminar", "Heritage", 17.3616, 78.4747
    )

    response = client.get(
        f"/api/v1/landmarks/{landmark.id}",
        headers=headers,
    )

    assert response.status_code == 200, response.text
    assert response.json()["name"] == "Charminar"


def test_nonexistent_landmark_returns_404():
    headers = create_user_and_headers()

    response = client.get(
        "/api/v1/landmarks/999999999",
        headers=headers,
    )

    assert response.status_code == 404


def test_nearby_search_returns_near_landmarks_in_distance_order(
    db_session: Session,
):
    headers = create_user_and_headers()

    create_landmark(
        db_session, "Nearby Landmark", "Heritage", 17.3617, 78.4748
    )
    create_landmark(
        db_session, "Distant Landmark", "History", 17.5000, 78.5000
    )

    response = client.get(
        "/api/v1/landmarks/nearby",
        headers=headers,
        params={
            "latitude": 17.3616,
            "longitude": 78.4747,
            "radius_m": 1000,
        },
    )

    assert response.status_code == 200, response.text
    results = response.json()

    assert len(results) == 1
    assert results[0]["name"] == "Nearby Landmark"
    assert 0 < results[0]["distance_m"] < 1000


@pytest.mark.parametrize(
    ("latitude", "longitude"),
    [
        (91, 78),
        (-91, 78),
        (17, 181),
        (17, -181),
    ],
)
def test_nearby_search_rejects_invalid_coordinates(
    latitude: float,
    longitude: float,
):
    headers = create_user_and_headers()

    response = client.get(
        "/api/v1/landmarks/nearby",
        headers=headers,
        params={
            "latitude": latitude,
            "longitude": longitude,
        },
    )

    assert response.status_code == 422