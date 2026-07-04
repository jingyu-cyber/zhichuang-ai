from __future__ import annotations

from datetime import datetime

from sqlalchemy import DateTime, Float, ForeignKey, Integer, JSON, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class StudentProfileRecord(Base):
    __tablename__ = "student_profiles"

    student_id: Mapped[str] = mapped_column(String(64), primary_key=True)
    student_name: Mapped[str] = mapped_column(String(100), nullable=False)
    grade: Mapped[str] = mapped_column(String(32), nullable=False)
    major: Mapped[str] = mapped_column(String(100), nullable=False)
    course_foundation_json: Mapped[list[str]] = mapped_column(JSON, default=list)
    skill_tags_json: Mapped[list[str]] = mapped_column(JSON, default=list)
    project_experiences_json: Mapped[list[str]] = mapped_column(JSON, default=list)
    competition_experiences_json: Mapped[list[str]] = mapped_column(JSON, default=list)
    target_direction: Mapped[str] = mapped_column(String(200), nullable=False)
    weekly_hours: Mapped[int] = mapped_column(Integer, nullable=False)
    github_url: Mapped[str | None] = mapped_column(String(500))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class CapabilityProfile(Base):
    __tablename__ = "capability_profiles"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    student_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    dimension: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    score: Mapped[int] = mapped_column(Integer, nullable=False)
    confidence: Mapped[float] = mapped_column(Float, default=0)
    summary: Mapped[str | None] = mapped_column(Text)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class CapabilityEvidence(Base):
    __tablename__ = "capability_evidence"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    student_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    dimension: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    source_type: Mapped[str] = mapped_column(String(64), nullable=False)
    source_id: Mapped[str] = mapped_column(String(128), nullable=False, index=True)
    source_title: Mapped[str | None] = mapped_column(String(200))
    evidence_text: Mapped[str] = mapped_column(Text, nullable=False)
    confidence: Mapped[float | None] = mapped_column(Float)
    weight: Mapped[float] = mapped_column(Float, default=1)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
