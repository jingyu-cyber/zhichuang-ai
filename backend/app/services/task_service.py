from __future__ import annotations

from datetime import datetime
from hashlib import sha1

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.base import Base
from app.models.task import AgentTask, LearningTaskRecord
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


class TaskService:
    seed_tasks = [
        LearningTask(
            task_id="task_readme_tests",
            student_id="student_001",
            title="补齐 Flask 作业 README 与接口测试",
            source="作业分析报告",
            status="doing",
            priority="high",
            due_date="2026-07-07",
            evidence_required="README、3 个接口测试、运行截图",
            progress=60,
        ),
        LearningTask(
            task_id="task_rag_demo",
            student_id="student_001",
            title="完成带引用的 RAG 知识库问答原型",
            source="成长路径",
            status="todo",
            priority="high",
            due_date="2026-07-10",
            evidence_required="问答页面、引用来源、检索命中截图",
            progress=40,
        ),
        LearningTask(
            task_id="task_algorithm_review",
            student_id="student_001",
            title="完成搜索与动态规划专题复盘",
            source="竞赛推荐",
            status="todo",
            priority="medium",
            due_date="2026-07-12",
            evidence_required="题单记录、错题原因和复盘总结",
            progress=25,
        ),
        LearningTask(
            task_id="task_demo_script",
            student_id="student_001",
            title="整理公网访问环境与展示脚本",
            source="项目实践",
            status="done",
            priority="medium",
            due_date="2026-07-05",
            evidence_required="展示脚本和部署说明",
            progress=100,
        ),
    ]

    def __init__(self, db: Session | None = None) -> None:
        self.db = db
        if self.db is not None:
            Base.metadata.create_all(bind=self.db.get_bind())

    def list_tasks(self, student_id: str) -> TaskListResponse:
        tasks = self._tasks_for_student(student_id)
        completed = len([task for task in tasks if task.status == "done"])
        return TaskListResponse(
            student_id=student_id,
            total=len(tasks),
            completed=completed,
            tasks=tasks,
        )

    def save_task(self, payload: SaveTaskRequest) -> LearningTask:
        task = LearningTask(
            task_id=self._manual_task_id(payload),
            student_id=payload.student_id,
            title=payload.title,
            source=payload.source,
            status="todo",
            priority=payload.priority,
            due_date=payload.due_date,
            evidence_required=payload.evidence_required,
            progress=0,
        )
        if self.db is None:
            return task

        existing = self.db.get(LearningTaskRecord, task.task_id)
        if existing is None:
            self.db.add(self._record_from_task(task))
        else:
            existing.title = task.title
            existing.source = task.source
            existing.priority = task.priority
            existing.due_date = task.due_date
            existing.evidence_required = task.evidence_required
            existing.updated_at = datetime.utcnow()
        self.db.commit()
        return task

    def review(self, payload: ReviewRequest) -> ReviewResponse:
        completed_ids = set(payload.completed_task_ids)
        all_tasks = self._tasks_for_student(payload.student_id)
        next_tasks = [
            task
            for task in all_tasks
            if task.task_id not in completed_ids and task.status != "done"
        ]
        completed_count = len(completed_ids) + len(
            [task for task in all_tasks if task.status == "done"]
        )

        return ReviewResponse(
            review_id=f"review_{payload.student_id}_weekly",
            student_id=payload.student_id,
            period=payload.period,
            summary=(
                "本轮复盘显示工程实践任务推进较快，知识库问答和展示脚本已经形成雏形；"
                "算法训练和自动化测试仍需要固定节奏。"
            ),
            completed_count=completed_count,
            risk="如果下周仍不补测试，作业报告中的工程规范维度会继续拖累画像可信度。",
            next_tasks=next_tasks[:3],
        )

    def create_agent_task(self, payload: AgentTaskCreateRequest) -> AgentTaskStatus:
        if self.db is None:
            now = datetime.utcnow()
            return AgentTaskStatus(
                task_id=self._agent_task_id(payload),
                task_type=payload.task_type,
                status="pending",
                owner_id=payload.owner_id,
                input=payload.input,
                state={
                    "current_node": "queued",
                    "completed_nodes": [],
                    "next_action": "等待任务调度",
                },
                created_at=now.isoformat(),
                updated_at=now.isoformat(),
            )

        task_id = self._agent_task_id(payload)
        existing = self.db.get(AgentTask, task_id)
        now = datetime.utcnow()
        if existing is None:
            existing = AgentTask(
                id=task_id,
                task_type=payload.task_type,
                status="pending",
                owner_id=payload.owner_id,
                input_json=payload.input,
                state_json={
                    "current_node": "queued",
                    "completed_nodes": [],
                    "next_action": "等待任务调度",
                },
                created_at=now,
                updated_at=now,
            )
            self.db.add(existing)
        else:
            existing.task_type = payload.task_type
            existing.owner_id = payload.owner_id
            existing.input_json = payload.input
            existing.status = "pending"
            existing.state_json = {
                "current_node": "queued",
                "completed_nodes": [],
                "next_action": "等待任务调度",
            }
            existing.result_ref = None
            existing.error_message = None
            existing.updated_at = now
        self.db.commit()
        return self._agent_task_from_record(existing)

    def get_agent_task(self, task_id: str) -> AgentTaskStatus:
        record = self._agent_task_record(task_id)
        return self._agent_task_from_record(record)

    def cancel_agent_task(self, task_id: str) -> AgentTaskActionResponse:
        record = self._agent_task_record(task_id)
        if record.status in {"succeeded", "cancelled"}:
            return AgentTaskActionResponse(
                task=self._agent_task_from_record(record),
                message="任务已结束，无需重复取消。",
            )
        record.status = "cancelled"
        record.state_json = {
            **(record.state_json or {}),
            "next_action": "任务已取消",
        }
        record.updated_at = datetime.utcnow()
        self.db.commit()
        return AgentTaskActionResponse(
            task=self._agent_task_from_record(record),
            message="任务已取消。",
        )

    def resume_agent_task(self, task_id: str) -> AgentTaskActionResponse:
        record = self._agent_task_record(task_id)
        if record.status not in {"waiting_user", "failed"}:
            return AgentTaskActionResponse(
                task=self._agent_task_from_record(record),
                message="当前状态不需要恢复。",
            )
        record.status = "pending"
        record.error_message = None
        record.state_json = {
            **(record.state_json or {}),
            "next_action": "已恢复，等待任务调度",
        }
        record.updated_at = datetime.utcnow()
        self.db.commit()
        return AgentTaskActionResponse(
            task=self._agent_task_from_record(record),
            message="任务已恢复。",
        )

    def _tasks_for_student(self, student_id: str) -> list[LearningTask]:
        seed_tasks = [task for task in self.seed_tasks if task.student_id == student_id]
        if self.db is None:
            return seed_tasks

        records = self.db.scalars(
            select(LearningTaskRecord)
            .where(LearningTaskRecord.student_id == student_id)
            .order_by(LearningTaskRecord.created_at.asc(), LearningTaskRecord.id.asc())
        ).all()
        stored_tasks = [self._task_from_record(record) for record in records]
        seed_ids = {task.task_id for task in seed_tasks}
        return [*seed_tasks, *[task for task in stored_tasks if task.task_id not in seed_ids]]

    def _manual_task_id(self, payload: SaveTaskRequest) -> str:
        raw = f"{payload.student_id}:{payload.title}:{payload.due_date}".encode("utf-8")
        return f"task_manual_{sha1(raw).hexdigest()[:10]}"

    def _agent_task_id(self, payload: AgentTaskCreateRequest) -> str:
        raw = f"{payload.owner_id}:{payload.task_type}:{payload.input}".encode("utf-8")
        return f"agent_task_{sha1(raw).hexdigest()[:10]}"

    def _agent_task_record(self, task_id: str) -> AgentTask:
        if self.db is None:
            raise ValueError("Database session is required")
        record = self.db.get(AgentTask, task_id)
        if record is None:
            raise LookupError("Agent task not found")
        return record

    def _record_from_task(self, task: LearningTask) -> LearningTaskRecord:
        now = datetime.utcnow()
        return LearningTaskRecord(
            id=task.task_id,
            student_id=task.student_id,
            title=task.title,
            source=task.source,
            status=task.status,
            priority=task.priority,
            due_date=task.due_date,
            evidence_required=task.evidence_required,
            progress=task.progress,
            created_at=now,
            updated_at=now,
        )

    def _task_from_record(self, record: LearningTaskRecord) -> LearningTask:
        return LearningTask(
            task_id=record.id,
            student_id=record.student_id,
            title=record.title,
            source=record.source,
            status=record.status,
            priority=record.priority,
            due_date=record.due_date,
            evidence_required=record.evidence_required,
            progress=record.progress,
        )

    def _agent_task_from_record(self, record: AgentTask) -> AgentTaskStatus:
        return AgentTaskStatus(
            task_id=record.id,
            task_type=record.task_type,
            status=record.status,
            owner_id=record.owner_id,
            input=dict(record.input_json or {}),
            state=dict(record.state_json or {}),
            result_ref=record.result_ref,
            error_message=record.error_message,
            created_at=record.created_at.isoformat(),
            updated_at=record.updated_at.isoformat(),
        )
