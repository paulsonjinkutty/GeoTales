from uuid import uuid4

from fastapi.testclient import TestClient

from app.main import app


client = TestClient(app)


def unique_email() -> str:
    return f"user-{uuid4().hex}@example.com"


def register_and_login(
    name: str = "Security Test User",
) -> tuple[int, str, str]:
    email = unique_email()
    password = "TestPassword123!"

    register_response = client.post(
        "/api/v1/auth/register",
        json={
            "name": name,
            "email": email,
            "password": password,
        },
    )

    assert register_response.status_code == 201

    user_id = register_response.json()["id"]

    login_response = client.post(
        "/api/v1/auth/login",
        data={
            "username": email,
            "password": password,
        },
    )

    assert login_response.status_code == 200

    token = login_response.json()["access_token"]

    return user_id, email, token


def auth_headers(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def test_user_profile_requires_authentication():
    response = client.get("/api/v1/users/1")

    assert response.status_code == 401


def test_user_profile_rejects_invalid_token():
    response = client.get(
        "/api/v1/users/1",
        headers=auth_headers("invalid-token"),
    )

    assert response.status_code == 401


def test_user_can_access_own_profile():
    user_id, email, token = register_and_login()

    response = client.get(
        f"/api/v1/users/{user_id}",
        headers=auth_headers(token),
    )

    assert response.status_code == 200

    data = response.json()

    assert data["id"] == user_id
    assert data["email"] == email
    assert "password" not in data
    assert "password_hash" not in data


def test_user_cannot_access_another_users_profile():
    first_user_id, _, first_token = register_and_login(
        "First Security User",
    )

    second_user_id, _, _ = register_and_login(
        "Second Security User",
    )

    response = client.get(
        f"/api/v1/users/{second_user_id}",
        headers=auth_headers(first_token),
    )

    assert first_user_id != second_user_id
    assert response.status_code == 403


def test_authenticated_request_for_nonexistent_user_returns_404():
    _, _, token = register_and_login()

    response = client.get(
        "/api/v1/users/999999999",
        headers=auth_headers(token),
    )

    assert response.status_code == 404
    assert response.json()["detail"] == "User not found"


def test_users_me_requires_authentication():
    response = client.get("/api/v1/users/me")

    assert response.status_code == 401


def test_users_me_returns_authenticated_profile():
    user_id, email, token = register_and_login(
        "Current Profile User",
    )

    response = client.get(
        "/api/v1/users/me",
        headers=auth_headers(token),
    )

    assert response.status_code == 200

    data = response.json()

    assert data["id"] == user_id
    assert data["email"] == email


def test_public_user_list_endpoint_is_removed():
    response = client.get("/api/v1/users")

    assert response.status_code == 404