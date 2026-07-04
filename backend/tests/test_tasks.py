from fastapi.testclient import TestClient

from app.main import app


def test_tasks_and_review() -> None:
    client = TestClient(app)
    tasks_response = client.get("/api/students/student_001/tasks")
    review_response = client.post(
        "/api/reviews/generate",
        json={
            "student_id": "student_001",
            "period": "本周",
            "completed_task_ids": ["task_demo_script"],
        },
    )

    assert tasks_response.status_code == 200
    assert review_response.status_code == 200
    assert tasks_response.json()["total"] >= 3
    assert review_response.json()["completed_count"] >= 1
