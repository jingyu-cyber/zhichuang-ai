from fastapi import APIRouter

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
def list_student_tasks(student_id: str) -> TaskListResponse:
    return TaskService().list_tasks(student_id)


@router.post("/tasks", response_model=LearningTask)
def save_task(payload: SaveTaskRequest) -> LearningTask:
    return TaskService().save_task(payload)


@router.post("/reviews/generate", response_model=ReviewResponse)
def generate_review(payload: ReviewRequest) -> ReviewResponse:
    return TaskService().review(payload)
