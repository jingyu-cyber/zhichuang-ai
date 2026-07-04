from __future__ import annotations

from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, JSON, String
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class LearningPlan(Base):
    __tablename__ = "learning_plans"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    student_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    goal: Mapped[str] = mapped_column(String(300), nullable=False)
    status: Mapped[str] = mapped_column(String(32), default="draft", index=True)
    plan_json: Mapped[dict] = mapped_column(JSON, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class Competition(Base):
    __tablename__ = "competitions"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    category: Mapped[str | None] = mapped_column(String(100), index=True)
    level: Mapped[str | None] = mapped_column(String(100), index=True)
    official_url: Mapped[str | None] = mapped_column(String(500))
    description: Mapped[str | None] = mapped_column(String(1000))


class TeamRecommendation(Base):
    __tablename__ = "team_recommendations"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    requester_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    target: Mapped[str] = mapped_column(String(300), nullable=False)
    recommendations_json: Mapped[dict] = mapped_column(JSON, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class TeamRequestRecord(Base):
    __tablename__ = "team_requests"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    student_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    competition_name: Mapped[str] = mapped_column(String(200), nullable=False)
    project_direction: Mapped[str] = mapped_column(String(300), nullable=False)
    request_json: Mapped[dict] = mapped_column(JSON, default=dict)
    status: Mapped[str] = mapped_column(String(32), default="已发布", index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class TeamPoolStatusRecord(Base):
    __tablename__ = "team_pool_statuses"

    student_id: Mapped[str] = mapped_column(String(64), primary_key=True)
    team_status_enabled: Mapped[bool] = mapped_column(Boolean, default=False)
    contact_visible: Mapped[bool] = mapped_column(Boolean, default=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
