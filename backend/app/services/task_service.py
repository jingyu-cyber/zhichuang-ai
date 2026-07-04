from __future__ import annotations

from app.schemas.tasks import (
    LearningTask,
    ReviewRequest,
    ReviewResponse,
    SaveTaskRequest,
    TaskListResponse,
)


class TaskService:
    base_tasks = [
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
            title="完成带引用的 RAG 知识库问答 Demo",
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
            title="整理公网 Demo 演示脚本",
            source="项目实践",
            status="done",
            priority="medium",
            due_date="2026-07-05",
            evidence_required="演示脚本和部署说明",
            progress=100,
        ),
    ]

    def list_tasks(self, student_id: str) -> TaskListResponse:
        tasks = [task for task in self.base_tasks if task.student_id == student_id]
        completed = len([task for task in tasks if task.status == "done"])
        return TaskListResponse(
            student_id=student_id,
            total=len(tasks),
            completed=completed,
            tasks=tasks,
        )

    def save_task(self, payload: SaveTaskRequest) -> LearningTask:
        return LearningTask(
            task_id=f"task_manual_{abs(hash(payload.title)) % 10000}",
            student_id=payload.student_id,
            title=payload.title,
            source=payload.source,
            status="todo",
            priority=payload.priority,
            due_date=payload.due_date,
            evidence_required=payload.evidence_required,
            progress=0,
        )

    def review(self, payload: ReviewRequest) -> ReviewResponse:
        completed_ids = set(payload.completed_task_ids)
        next_tasks = []
        for task in self.base_tasks:
            if task.student_id != payload.student_id:
                continue
            if task.task_id in completed_ids or task.status == "done":
                continue
            next_tasks.append(task)

        completed_count = len(completed_ids) + len(
            [
                task
                for task in self.base_tasks
                if task.student_id == payload.student_id and task.status == "done"
            ]
        )

        return ReviewResponse(
            review_id=f"review_{payload.student_id}_weekly",
            student_id=payload.student_id,
            period=payload.period,
            summary=(
                "本轮复盘显示工程实践任务推进较快，知识库问答和演示脚本已经形成雏形；"
                "算法训练和自动化测试仍需要固定节奏。"
            ),
            completed_count=completed_count,
            risk="如果下周仍不补测试，作业报告中的工程规范维度会继续拖累画像可信度。",
            next_tasks=next_tasks[:3],
        )
