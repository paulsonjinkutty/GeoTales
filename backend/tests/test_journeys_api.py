from uuid import uuid4
import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


def create_user_and_headers(
    name: str = "Journey Test User",
) -> tuple[int, dict[str, str]]:
    """Register a test user, log in, and return their ID and JWT headers."""

    email = f"journey-{uuid4().hex}@example.com"
    password = "JourneyTestPassword123!"

    register_response = client.post(
        "/api/v1/auth/register",
        json={
            "name": name,
            "email": email,
            "password": password,
        },
    )

    assert register_response.status_code == 201, register_response.text

    user_data = register_response.json()

    login_response = client.post(
        "/api/v1/auth/login",
        data={
            "username": email,
            "password": password,
        },
    )

    assert login_response.status_code == 200, login_response.text

    token_data = login_response.json()
    access_token = token_data["access_token"]

    headers = {
        "Authorization": f"Bearer {access_token}",
    }

    return user_data["id"], headers


def start_journey(
    headers: dict[str, str],
    title: str = "Test journey",
) -> dict:
    """Start a journey and return its response data."""

    response = client.post(
        "/api/v1/journeys",
        headers=headers,
        json={"title": title},
    )

    assert response.status_code == 201, response.text

    return response.json()


def add_gps_point(
    journey_id: int,
    headers: dict[str, str],
    latitude: float,
    longitude: float,
):
    """Record one GPS point for a journey."""

    return client.post(
        f"/api/v1/journeys/{journey_id}/points",
        headers=headers,
        json={
            "latitude": latitude,
            "longitude": longitude,
        },
    )


def test_create_journey():
    user_id, headers = create_user_and_headers()

    response = client.post(
        "/api/v1/journeys",
        headers=headers,
        json={"title": "Home to office"},
    )

    assert response.status_code == 201

    data = response.json()

    assert data["id"] is not None
    assert data["user_id"] == user_id
    assert data["title"] == "Home to office"
    assert data["started_at"] is not None
    assert data["ended_at"] is None


def test_journey_endpoints_require_authentication():
    response = client.get("/api/v1/journeys")

    assert response.status_code == 401


def test_list_journeys_only_returns_current_users_journeys():
    _, first_user_headers = create_user_and_headers("First User")
    _, second_user_headers = create_user_and_headers("Second User")

    first_journey = start_journey(
        first_user_headers,
        "First user's journey",
    )
    start_journey(
        second_user_headers,
        "Second user's private journey",
    )

    response = client.get(
        "/api/v1/journeys",
        headers=first_user_headers,
    )

    assert response.status_code == 200

    journeys = response.json()
    journey_ids = [journey["id"] for journey in journeys]

    assert first_journey["id"] in journey_ids
    assert len(journeys) == 1
    assert journeys[0]["title"] == "First user's journey"


def test_user_cannot_read_another_users_journey():
    _, owner_headers = create_user_and_headers("Journey Owner")
    _, other_user_headers = create_user_and_headers("Different User")

    journey = start_journey(
        owner_headers,
        "Private journey",
    )

    response = client.get(
        f"/api/v1/journeys/{journey['id']}",
        headers=other_user_headers,
    )

    assert response.status_code == 403


def test_get_nonexistent_journey_returns_404():
    _, headers = create_user_and_headers()

    response = client.get(
        "/api/v1/journeys/999999999",
        headers=headers,
    )

    assert response.status_code == 404


def test_record_gps_point_returns_correct_coordinates():
    _, headers = create_user_and_headers()
    journey = start_journey(headers, "GPS coordinate test")

    latitude = 17.3616
    longitude = 78.4747

    response = add_gps_point(
        journey["id"],
        headers,
        latitude,
        longitude,
    )

    assert response.status_code == 201, response.text

    point = response.json()

    assert point["journey_id"] == journey["id"]
    assert point["latitude"] == pytest.approx(latitude)
    assert point["longitude"] == pytest.approx(longitude)
    assert point["sequence_number"] == 1
    assert point["recorded_at"] is not None


def test_gps_points_are_returned_in_sequence_order():
    _, headers = create_user_and_headers()
    journey = start_journey(headers, "GPS ordering test")

    first = add_gps_point(
        journey["id"],
        headers,
        17.3616,
        78.4747,
    )
    second = add_gps_point(
        journey["id"],
        headers,
        17.3620,
        78.4752,
    )

    assert first.status_code == 201, first.text
    assert second.status_code == 201, second.text

    response = client.get(
        f"/api/v1/journeys/{journey['id']}/points",
        headers=headers,
    )

    assert response.status_code == 200

    points = response.json()

    assert len(points) == 2
    assert [point["sequence_number"] for point in points] == [1, 2]

    assert points[0]["latitude"] == pytest.approx(17.3616)
    assert points[0]["longitude"] == pytest.approx(78.4747)

    assert points[1]["latitude"] == pytest.approx(17.3620)
    assert points[1]["longitude"] == pytest.approx(78.4752)


@pytest.mark.parametrize(
    ("latitude", "longitude"),
    [
        (91.0, 78.0),
        (-91.0, 78.0),
        (17.0, 181.0),
        (17.0, -181.0),
    ],
)
def test_invalid_gps_coordinates_are_rejected(
    latitude: float,
    longitude: float,
):
    _, headers = create_user_and_headers()
    journey = start_journey(headers, "Invalid coordinate test")

    response = add_gps_point(
        journey["id"],
        headers,
        latitude,
        longitude,
    )

    assert response.status_code == 422


def test_finished_journey_cannot_receive_more_points_or_finish_again():
    _, headers = create_user_and_headers()
    journey = start_journey(headers, "Journey completion test")

    finish_response = client.post(
        f"/api/v1/journeys/{journey['id']}/finish",
        headers=headers,
    )

    assert finish_response.status_code == 200, finish_response.text
    assert finish_response.json()["ended_at"] is not None

    late_point_response = add_gps_point(
        journey["id"],
        headers,
        17.3620,
        78.4752,
    )

    assert late_point_response.status_code == 409

    second_finish_response = client.post(
        f"/api/v1/journeys/{journey['id']}/finish",
        headers=headers,
    )

    assert second_finish_response.status_code == 409


def test_user_cannot_read_another_users_gps_points():
    _, owner_headers = create_user_and_headers("Point Owner")
    _, other_user_headers = create_user_and_headers("Different Point User")

    journey = start_journey(owner_headers, "Private GPS trail")

    response = client.get(
        f"/api/v1/journeys/{journey['id']}/points",
        headers=other_user_headers,
    )

    assert response.status_code == 403