from fastapi.testclient import TestClient

from app.main import app


def test_demo_accounts_and_session() -> None:
    client = TestClient(app)
    accounts_response = client.get("/api/auth/demo-accounts")
    session_response = client.post("/api/auth/demo-session", json={"user_id": "teacher_001"})

    assert accounts_response.status_code == 200
    assert session_response.status_code == 200
    assert len(accounts_response.json()["accounts"]) == 3
    assert session_response.json()["account"]["role"] == "teacher"
