from uuid import uuid4

from fastapi.testclient import TestClient

from app.main import app
from app.services import ai_service


client = TestClient(app)


def register_and_login() -> tuple[int, str]:
    email = f"ai-{uuid4().hex}@example.com"
    password = "TestPassword123!"

    register_response = client.post(
        "/api/v1/auth/register",
        json={
            "name": "AI Test User",
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

    return (
        user_id,
        login_response.json()["access_token"],
    )


def auth_headers(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def test_ai_ask_requires_authentication():
    response = client.post(
        "/api/v1/ai/ask",
        json={"question": "Tell me about this place."},
    )

    assert response.status_code == 401


def test_ai_ask_returns_mocked_answer(monkeypatch):
    _, token = register_and_login()

    monkeypatch.setattr(
        ai_service,
        "generate_ai_text",
        lambda **kwargs: "This is a mocked GeoTales answer.",
    )

    response = client.post(
        "/api/v1/ai/ask",
        headers=auth_headers(token),
        json={
            "question": "Explain the landmark.",
        },
    )

    assert response.status_code == 200
    assert response.json()["answer"] == (
        "This is a mocked GeoTales answer."
    )


def test_ai_narration_requires_context():
    _, token = register_and_login()

    response = client.post(
        "/api/v1/ai/narrate",
        headers=auth_headers(token),
        json={},
    )

    assert response.status_code == 422


def test_ai_recommendation_returns_empty_when_no_landmarks():
    _, token = register_and_login()

    response = client.post(
        "/api/v1/ai/recommend",
        headers=auth_headers(token),
        json={"limit": 5},
    )

    assert response.status_code == 200

    data = response.json()

    assert data["recommendations"] == []
    assert data["model"] == "not-called"


def test_ai_ask_handles_missing_provider_key(monkeypatch):
    from app.services.ai_provider import (
        AIProviderNotConfiguredError,
    )

    _, token = register_and_login()

    def missing_key(**kwargs):
        raise AIProviderNotConfiguredError(
            "AI provider is not configured."
        )

    monkeypatch.setattr(
        ai_service,
        "generate_ai_text",
        missing_key,
    )

    response = client.post(
        "/api/v1/ai/ask",
        headers=auth_headers(token),
        json={"question": "What can I visit?"},
    )

    assert response.status_code == 503