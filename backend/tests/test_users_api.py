from fastapi.testclient import TestClient

from app.main import app


client = TestClient(app)


def test_get_nonexistent_user():
    response = client.get(
        "/api/v1/users/999999999",
    )

    assert response.status_code == 404
    assert response.json()["detail"] == "User not found"