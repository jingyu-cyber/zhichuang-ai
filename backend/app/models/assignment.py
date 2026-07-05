from __future__ import annotations

from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, JSON, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class Assignment(Base):
    __tablename__ = "assignments"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    course_id: Mapped[str] = mapped_column(ForeignKey("courses.id"), index=True)
    class_id: Mapped[str | None] = mapped_column(ForeignKey("classes.id"), index=True)
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    rubric_id: Mapped[str | None] = mapped_column(String(64), index=True)
    due_at: Mapped[datetime | None] = mapped_column(DateTime)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class Submission(Base):
    __tablename__ = "submissions"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    assignment_id: Mapped[str] = mapped_column(ForeignKey("assignments.id"), index=True)
    student_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    repository_url: Mapped[str | None] = mapped_column(String(500))
    storage_path: Mapped[str | None] = mapped_column(String(500))
    status: Mapped[str] = mapped_column(String(32), default="pending", index=True)
    submitted_at: Mapped[datetime | None] = mapped_column(DateTime)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class AssignmentReport(Base):
    __tablename__ = "assignment_reports"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    assignment_id: Mapped[str] = mapped_column(ForeignKey("assignments.id"), index=True)
    submission_id: Mapped[str] = mapped_column(ForeignKey("submissions.id"), index=True)
    student_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    summary: Mapped[str] = mapped_column(Text, nullable=False)
    scores_json: Mapped[dict] = mapped_column(JSON, default=dict)
    evidence_json: Mapped[dict] = mapped_column(JSON, default=dict)
    findings_json: Mapped[dict] = mapped_column(JSON, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class Rubric(Base):
    __tablename__ = "rubrics"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    course_id: Mapped[str | None] = mapped_column(ForeignKey("courses.id"), index=True)
    dimensions_json: Mapped[list] = mapped_column(JSON, default=list)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
