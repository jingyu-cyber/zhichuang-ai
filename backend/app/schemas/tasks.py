from __future__ import annotations

from pydantic import BaseModel, Field


class LearningTask(BaseModel):
    task_id: str
    student_id: str
    title: str
    source: str
    status: str
    priority: str
    due_date: str
    evidence_required: str
    progress: int


class TaskListResponse(BaseModel):
    student_id: str
    total: int
    completed: int
    tasks: list[LearningTask]


class SaveTaskRequest(BaseModel):
    student_id: str = "student_001"
    title: str
    source: str = "manual"
    priority: str = "medium"
    due_date: str = "2026-07-12"
    evidence_required: str = "提交学习记录或项目产物"


class ReviewRequest(BaseModel):
    student_id: str = "student_001"
    period: str = "本周"
    completed_task_ids: list[str] = Field(default_factory=list)
    notes: str | None = None


class ReviewResponse(BaseModel):
    review_id: str
    student_id: str
    period: str
    summary: str
    completed_count: int
    risk: str
    next_tasks: list[LearningTask]
    ai_generated: bool = True


class AgentTaskCreateRequest(BaseModel):
    task_type: str = "assignment_analysis"
    owner_id: str = "student_001"
    input: dict = Field(default_factory=dict)


class AgentTaskStatus(BaseModel):
    task_id: str
    task_type: str
    status: str
    owner_id: str | None = None
    input: dict = Field(default_factory=dict)
    state: dict = Field(default_factory=dict)
    result_ref: str | None = None
    error_message: str | None = None
    created_at: str
    updated_at: str


class AgentTaskActionResponse(BaseModel):
    task: AgentTaskStatus
    message: str
