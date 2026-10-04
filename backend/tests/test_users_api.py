from uuid import uuid4

from fastapi.testclient import TestClient

from app.main import app


client = TestClient(app)


def unique_email() -> str:
    return f"test-{uuid4().hex}@example.com"


def test_create_user():
    response = client.post(
        "/api/v1/users",
        json={
            "name": "Pytest User",
            "email": unique_email(),
        },
    )

    assert response.status_code == 201

    data = response.json()

    assert data["id"] is not None
    assert data["name"] == "Pytest User"
    assert "@" in data["email"]


def test_get_nonexistent_user():
    response = client.get("/api/v1/users/999999999")

    assert response.status_code == 404
    assert response.json()["detail"] == "User not found"


def test_invalid_user_payload():
    response = client.post(
        "/api/v1/users",
        json={
            "name": "",
            "email": "not-an-email",
        },
    )

    assert response.status_code == 422