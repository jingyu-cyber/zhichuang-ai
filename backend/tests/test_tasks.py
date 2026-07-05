from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.main import app
from app.models.task import AgentTask
from app.schemas.tasks import AgentTaskCreateRequest, SaveTaskRequest
from app.services.task_service import TaskService


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


def test_agent_task_status_cancel_and_access_scope() -> None:
    client = TestClient(app)
    student_header = {"Authorization": "Bearer demo-token-student_001"}
    teacher_header = {"Authorization": "Bearer demo-token-teacher_001"}

    create_response = client.post(
        "/api/agent-tasks",
        json={
            "task_type": "assignment_analysis",
            "owner_id": "student_001",
            "input": {"assignment_id": "assignment_flask_mvp"},
        },
        headers=student_header,
    )
    task_id = create_response.json()["task_id"]
    teacher_task_response = client.post(
        "/api/agent-tasks",
        json={
            "task_type": "teacher_dashboard",
            "owner_id": "teacher_001",
            "input": {"assignment_id": "assignment_flask_mvp"},
        },
        headers=teacher_header,
    )
    get_response = client.get(f"/api/tasks/{task_id}", headers=student_header)
    forbidden_response = client.get(
        f"/api/tasks/{teacher_task_response.json()['task_id']}",
        headers=student_header,
    )
    cancel_response = client.post(f"/api/tasks/{task_id}/cancel", headers=student_header)
    missing_response = client.get("/api/tasks/missing_agent_task", headers=student_header)

    assert create_response.status_code == 200
    assert teacher_task_response.status_code == 200
    assert create_response.json()["status"] == "pending"
    assert create_response.json()["state"]["current_node"] == "queued"
    assert get_response.status_code == 200
    assert get_response.json()["task_id"] == task_id
    assert forbidden_response.status_code == 403
    assert cancel_response.status_code == 200
    assert cancel_response.json()["task"]["status"] == "cancelled"
    assert cancel_response.json()["message"] == "任务已取消。"
    assert missing_response.status_code == 404


def test_agent_task_resume_persists_state(tmp_path) -> None:
    engine = create_engine(
        f"sqlite:///{tmp_path / 'agent_tasks.db'}",
        connect_args={"check_same_thread": False},
    )
    SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)

    with SessionLocal() as first_session:
        service = TaskService(first_session)
        created = service.create_agent_task(
            AgentTaskCreateRequest(
                task_type="plan_generation",
                owner_id="student_001",
                input={"goal": "AI 应用开发"},
            )
        )
        record = first_session.get(AgentTask, created.task_id)
        assert record is not None
        record.status = "waiting_user"
        record.state_json = {
            "current_node": "confirm_plan",
            "completed_nodes": ["profile_eval", "resource_match"],
            "next_action": "等待学生确认计划",
        }
        first_session.commit()

    with SessionLocal() as second_session:
        resumed = TaskService(second_session).resume_agent_task(created.task_id)

    assert resumed.task.task_id == created.task_id
    assert resumed.task.status == "pending"
    assert resumed.task.state["current_node"] == "confirm_plan"
    assert resumed.task.state["next_action"] == "已恢复，等待任务调度"
