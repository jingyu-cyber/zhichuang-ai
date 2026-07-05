from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.main import app
from app.services.task_service import TaskService
from app.schemas.tasks import SaveTaskRequest


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


def test_student_tasks_are_scoped_to_self() -> None:
    client = TestClient(app)
    student_header = {"Authorization": "Bearer demo-token-student_001"}

    own_response = client.get("/api/students/student_001/tasks", headers=student_header)
    other_tasks_response = client.get("/api/students/student_002/tasks", headers=student_header)
    other_save_response = client.post(
        "/api/tasks",
        json={
            "student_id": "student_002",
            "title": "越权保存任务",
            "source": "test",
        },
        headers=student_header,
    )
    other_review_response = client.post(
        "/api/reviews/generate",
        json={"student_id": "student_002", "period": "本周"},
        headers=student_header,
    )

    assert own_response.status_code == 200
    assert other_tasks_response.status_code == 403
    assert other_save_response.status_code == 403
    assert other_review_response.status_code == 403


def test_saved_task_persists_in_sqlite_session(tmp_path) -> None:
    engine = create_engine(
        f"sqlite:///{tmp_path / 'tasks.db'}",
        connect_args={"check_same_thread": False},
    )
    SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)

    with SessionLocal() as first_session:
        created = TaskService(first_session).save_task(
            SaveTaskRequest(
                student_id="student_001",
                title="补充一次持久化任务记录",
                source="验收测试",
                priority="high",
                due_date="2026-07-13",
                evidence_required="SQLite 任务记录",
            )
        )

    with SessionLocal() as second_session:
        tasks = TaskService(second_session).list_tasks("student_001").tasks

    assert any(task.task_id == created.task_id for task in tasks)
    assert any(task.title == "补充一次持久化任务记录" for task in tasks)
