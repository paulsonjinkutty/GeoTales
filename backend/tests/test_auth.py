from uuid import uuid4
from fastapi.testclient import TestClient
from app.main import app


client = TestClient(app)

def test_login_with_invalid_credentials():
    response = client.post(
        "/api/v1/auth/login",
        data={
            "username": "doesnotexist@example.com",
            "password": "WrongPassword123!",
        },
    )

    assert response.status_code == 401

def test_current_user_requires_authentication():
    response = client.get(
        "/api/v1/auth/me",
    )

    assert response.status_code == 401


def unique_email() -> str:
    return f"auth-{uuid4().hex}@example.com"


def test_register_user():
    response = client.post(
        "/api/v1/auth/register",
        json={
            "name": "Pytest Auth User",
            "email": unique_email(),
            "password": "TestPassword123!",
        },
    )

    assert response.status_code == 201

    data = response.json()

    assert data["id"] is not None
    assert data["name"] == "Pytest Auth User"
    assert "@" in data["email"]

    assert "password" not in data
    assert "password_hash" not in data


def test_duplicate_registration():
    email = unique_email()

    first_response = client.post(
        "/api/v1/auth/register",
        json={
            "name": "First User",
            "email": email,
            "password": "TestPassword123!",
        },
    )

    assert first_response.status_code == 201

    second_response = client.post(
        "/api/v1/auth/register",
        json={
            "name": "Second User",
            "email": email,
            "password": "AnotherPassword123!",
        },
    )

    assert second_response.status_code == 409


def test_invalid_registration_payload():
    response = client.post(
        "/api/v1/auth/register",
        json={
            "name": "",
            "email": "not-an-email",
            "password": "short",
        },
    )

    assert response.status_code == 422


def test_login_and_get_current_user():
    email = unique_email()
    password = "TestPassword123!"

    register_response = client.post(
        "/api/v1/auth/register",
        json={
            "name": "JWT Integration User",
            "email": email,
            "password": password,
        },
    )

    assert register_response.status_code == 201

    login_response = client.post(
        "/api/v1/auth/login",
        data={
            "username": email,
            "password": password,
        },
    )

    assert login_response.status_code == 200

    token_data = login_response.json()

    assert token_data["token_type"] == "bearer"
    assert token_data["access_token"]

    access_token = token_data["access_token"]

    me_response = client.get(
        "/api/v1/auth/me",
        headers={
            "Authorization": f"Bearer {access_token}",
        },
    )

    assert me_response.status_code == 200

    user_data = me_response.json()

    assert user_data["email"] == email
    assert user_data["name"] == "JWT Integration User"


def test_current_user_rejects_invalid_token():
    response = client.get(
        "/api/v1/auth/me",
        headers={
            "Authorization": "Bearer invalid-token",
        },
    )

    assert response.status_code == 401