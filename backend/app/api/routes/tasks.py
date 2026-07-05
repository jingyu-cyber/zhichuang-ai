from fastapi import APIRouter, Depends, Header, HTTPException, status
from sqlalchemy.orm import Session

from app.api.routes.growth import ensure_student_access
from app.db.session import get_db
from app.models.user import User
from app.schemas.auth import DemoAccount
from app.schemas.tasks import (
    AgentTaskActionResponse,
    AgentTaskCreateRequest,
    AgentTaskStatus,
    LearningTask,
    ReviewRequest,
    ReviewResponse,
    SaveTaskRequest,
    TaskListResponse,
)
from app.services.auth_service import AuthService
from app.services.task_service import TaskService

router = APIRouter()
DEMO_CLASS_NAMES = {"class_cs_2024_01": "2024 级计算机科学与技术 1 班"}
DEMO_COURSE_NAMES = {"course_web_2026": "Web 应用开发"}


@router.get("/students/{student_id}/tasks", response_model=TaskListResponse)
def list_student_tasks(
    student_id: str,
    authorization: str | None = Header(default=None),
    db: Session = Depends(get_db),
) -> TaskListResponse:
    ensure_student_access(student_id, authorization, db)
    return TaskService(db).list_tasks(student_id)


@router.post("/tasks", response_model=LearningTask)
def save_task(
    payload: SaveTaskRequest,
    authorization: str | None = Header(default=None),
    db: Session = Depends(get_db),
) -> LearningTask:
    ensure_student_access(payload.student_id, authorization, db)
    return TaskService(db).save_task(payload)


@router.post("/reviews/generate", response_model=ReviewResponse)
def generate_review(
    payload: ReviewRequest,
    authorization: str | None = Header(default=None),
    db: Session = Depends(get_db),
) -> ReviewResponse:
    ensure_student_access(payload.student_id, authorization, db)
    return TaskService(db).review(payload)


@router.post("/agent-tasks", response_model=AgentTaskStatus)
def create_agent_task(
    payload: AgentTaskCreateRequest,
    authorization: str | None = Header(default=None),
    db: Session = Depends(get_db),
) -> AgentTaskStatus:
    _ensure_agent_task_owner_access(payload.owner_id, authorization, db)
    return TaskService(db).create_agent_task(payload)


@router.get("/tasks/{task_id}", response_model=AgentTaskStatus)
def get_agent_task(
    task_id: str,
    authorization: str | None = Header(default=None),
    db: Session = Depends(get_db),
) -> AgentTaskStatus:
    task = _get_agent_task_or_404(task_id, db)
    _ensure_agent_task_access(task, authorization, db)
    return task


@router.post("/tasks/{task_id}/cancel", response_model=AgentTaskActionResponse)
def cancel_agent_task(
    task_id: str,
    authorization: str | None = Header(default=None),
    db: Session = Depends(get_db),
) -> AgentTaskActionResponse:
    task = _get_agent_task_or_404(task_id, db)
    _ensure_agent_task_access(task, authorization, db)
    return TaskService(db).cancel_agent_task(task_id)


@router.post("/tasks/{task_id}/resume", response_model=AgentTaskActionResponse)
def resume_agent_task(
    task_id: str,
    authorization: str | None = Header(default=None),
    db: Session = Depends(get_db),
) -> AgentTaskActionResponse:
    task = _get_agent_task_or_404(task_id, db)
    _ensure_agent_task_access(task, authorization, db)
    return TaskService(db).resume_agent_task(task_id)


def _get_agent_task_or_404(task_id: str, db: Session) -> AgentTaskStatus:
    try:
        return TaskService(db).get_agent_task(task_id)
    except LookupError as error:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Agent task not found",
        ) from error


def _ensure_agent_task_owner_access(
    owner_id: str,
    authorization: str | None,
    db: Session,
) -> None:
    account = AuthService(db).current_account(authorization)
    if account.role == "admin":
        return
    if account.user_id == owner_id:
        return
    owner = db.get(User, owner_id)
    if owner is not None and owner.role == "student":
        ensure_student_access(owner_id, authorization, db)
        return
    if owner_id.startswith("student_"):
        ensure_student_access(owner_id, authorization, db)
        return
    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="No access to this agent task",
    )


def _ensure_agent_task_access(
    task: AgentTaskStatus,
    authorization: str | None,
    db: Session,
) -> None:
    account = AuthService(db).current_account(authorization)
    if account.role == "admin":
        return
    if account.user_id == task.owner_id:
        return
    if account.role == "teacher" and _teacher_task_in_scope(account, task):
        return
    _ensure_agent_task_owner_access(task.owner_id or "", authorization, db)


def _teacher_task_in_scope(account: DemoAccount, task: AgentTaskStatus) -> bool:
    course_id = str(task.input.get("course_id") or "")
    class_id = str(task.input.get("class_id") or "")
    course_name = DEMO_COURSE_NAMES.get(course_id, course_id)
    class_name = DEMO_CLASS_NAMES.get(class_id, class_id)
    return (
        bool(course_id or class_id)
        and (course_id in account.authorized_courses or course_name in account.authorized_courses)
        and (class_id in account.authorized_classes or class_name in account.authorized_classes)
    )
