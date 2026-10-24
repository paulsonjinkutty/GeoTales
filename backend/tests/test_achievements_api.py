from uuid import uuid4

from fastapi.testclient import TestClient

from app.main import app


client = TestClient(app)


def create_user_and_headers() -> dict[str, str]:
    email = f"achievement-{uuid4().hex}@example.com"
    password = "AchievementTestPassword123!"

    register = client.post(
        "/api/v1/auth/register",
        json={
            "name": "Achievement Test User",
            "email": email,
            "password": password,
        },
    )
    assert register.status_code == 201, register.text

    login = client.post(
        "/api/v1/auth/login",
        data={"username": email, "password": password},
    )
    assert login.status_code == 200, login.text

    return {
        "Authorization": f"Bearer {login.json()['access_token']}"
    }


def complete_journey(
    headers: dict[str, str],
    title: str = "Test journey",
) -> dict:
    response = client.post(
        "/api/v1/journeys",
        headers=headers,
        json={"title": title},
    )
    assert response.status_code == 201, response.text

    journey = response.json()

    response = client.post(
        f"/api/v1/journeys/{journey['id']}/finish",
        headers=headers,
    )
    assert response.status_code == 200, response.text

    return journey


def get_earned_names(headers: dict[str, str]) -> list[str]:
    response = client.get(
        "/api/v1/achievements/me",
        headers=headers,
    )
    assert response.status_code == 200, response.text

    return [
        item["achievement"]["name"]
        for item in response.json()
    ]


def test_achievement_endpoints_require_authentication():
    assert client.get("/api/v1/achievements").status_code == 401
    assert client.get("/api/v1/achievements/me").status_code == 401


def test_catalogue_returns_default_achievements():
    headers = create_user_and_headers()

    response = client.get(
        "/api/v1/achievements",
        headers=headers,
    )

    assert response.status_code == 200, response.text

    names = {item["name"] for item in response.json()}

    assert names == {
        "First Journey",
        "Trailblazer",
        "Route Collector",
        "Cartographer",
    }


def test_first_completed_journey_awards_first_journey():
    headers = create_user_and_headers()

    complete_journey(headers)

    assert get_earned_names(headers) == ["First Journey"]


def test_award_is_not_duplicated_for_the_same_user():
    headers = create_user_and_headers()

    complete_journey(headers, "Journey one")
    complete_journey(headers, "Journey two")

    names = get_earned_names(headers)

    assert names.count("First Journey") == 1
    assert "Trailblazer" not in names


def test_trailblazer_is_awarded_after_five_completed_journeys():
    headers = create_user_and_headers()

    for number in range(5):
        complete_journey(headers, f"Journey {number + 1}")

    names = get_earned_names(headers)

    assert "First Journey" in names
    assert "Trailblazer" in names


def test_route_collector_is_awarded_after_ten_gps_points():
    headers = create_user_and_headers()

    journey_response = client.post(
        "/api/v1/journeys",
        headers=headers,
        json={"title": "GPS collection"},
    )
    assert journey_response.status_code == 201, journey_response.text

    journey_id = journey_response.json()["id"]

    for number in range(10):
        point_response = client.post(
            f"/api/v1/journeys/{journey_id}/points",
            headers=headers,
            json={
                "latitude": 17.3616 + number * 0.0001,
                "longitude": 78.4747 + number * 0.0001,
            },
        )
        assert point_response.status_code == 201, point_response.text

    finish_response = client.post(
        f"/api/v1/journeys/{journey_id}/finish",
        headers=headers,
    )
    assert finish_response.status_code == 200, finish_response.text

    assert "Route Collector" in get_earned_names(headers)


def test_users_can_only_see_their_own_achievements():
    first_user = create_user_and_headers()
    second_user = create_user_and_headers()

    complete_journey(first_user)

    assert get_earned_names(first_user) == ["First Journey"]
    assert get_earned_names(second_user) == []