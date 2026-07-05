from fastapi import APIRouter, Depends, Header
from sqlalchemy.orm import Session

from app.api.routes.growth import ensure_student_access
from app.db.session import get_db
from app.schemas.tasks import (
    LearningTask,
    ReviewRequest,
    ReviewResponse,
    SaveTaskRequest,
    TaskListResponse,
)
from app.services.task_service import TaskService

router = APIRouter()


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
