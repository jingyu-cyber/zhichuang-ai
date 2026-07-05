from __future__ import annotations

from secrets import compare_digest

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.db.base import Base
from app.models.course import ClassGroup, Course, CourseMembership
from app.models.user import User
from app.schemas.auth import (
    DemoAccount,
    DemoAccountsResponse,
    DemoSessionResponse,
    LocalAccountsResponse,
    SchoolIdentitySessionRequest,
)


class AuthService:
    accounts = [
        DemoAccount(
            user_id="student_001",
            name="林一舟",
            role="student",
            title="学生账号",
            default_view="growth",
            authorized_courses=["Web 应用开发", "算法设计与分析"],
            authorized_classes=["2024 级计算机科学与技术 1 班"],
            modules=["成长路径", "作业报告", "任务复盘", "知识库问答"],
        ),
        DemoAccount(
            user_id="teacher_001",
            name="周老师",
            role="teacher",
            title="教师账号",
            default_view="teacher",
            authorized_courses=["Web 应用开发"],
            authorized_classes=["2024 级计算机科学与技术 1 班"],
            modules=["教师看板", "作业报告", "知识库问答"],
        ),
        DemoAccount(
            user_id="admin_001",
            name="平台管理员",
            role="admin",
            title="管理员账号",
            default_view="kb",
            authorized_courses=["全部课程"],
            authorized_classes=["全部班级"],
            modules=["知识库管理", "教师看板", "成长路径", "知识库问答"],
        ),
    ]

    def __init__(self, db: Session | None = None) -> None:
        self.db = db
        if self.db is not None:
            Base.metadata.create_all(bind=self.db.get_bind())

    def list_demo_accounts(self) -> DemoAccountsResponse:
        return DemoAccountsResponse(accounts=self.accounts)

    def list_local_accounts(self) -> LocalAccountsResponse:
        if self.db is None:
            return LocalAccountsResponse(accounts=[])
        users = self.db.scalars(
            select(User).order_by(User.role.asc(), User.name.asc(), User.id.asc())
        ).all()
        return LocalAccountsResponse(accounts=[self._local_account(user.id) for user in users])

    def create_demo_session(self, user_id: str) -> DemoSessionResponse:
        account = self._find_account(user_id)
        return DemoSessionResponse(
            token=f"demo-token-{account.user_id}",
            account=account,
            expires_in=60 * 60 * 8,
        )

    def create_local_session(self, user_id: str) -> DemoSessionResponse:
        account = self._local_account(user_id)
        return DemoSessionResponse(
            token=f"local-token-{account.user_id}",
            account=account,
            expires_in=60 * 60 * 8,
        )

    def create_school_identity_session(
        self,
        payload: SchoolIdentitySessionRequest,
        shared_secret: str | None,
    ) -> DemoSessionResponse:
        self._verify_school_identity_secret(shared_secret)
        user = self._find_local_identity(payload)
        account = self._local_account(user.id)
        return DemoSessionResponse(
            token=f"school-token-{account.user_id}",
            account=account,
            expires_in=60 * 60 * 8,
        )

    def current_account(self, authorization: str | None) -> DemoAccount:
        if not authorization:
            return self._find_account("teacher_001")

        scheme, _, token = authorization.partition(" ")
        if scheme.lower() != "bearer":
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid auth token",
            )

        if token.startswith("demo-token-"):
            user_id = token.removeprefix("demo-token-")
            return self._find_account(user_id)
        if token.startswith("local-token-"):
            user_id = token.removeprefix("local-token-")
            return self._local_account(user_id)
        if token.startswith("school-token-"):
            user_id = token.removeprefix("school-token-")
            return self._local_account(user_id)

        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid auth token",
        )

    def _find_account(self, user_id: str) -> DemoAccount:
        for account in self.accounts:
            if account.user_id == user_id:
                return account
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Account not found",
        )

    def _local_account(self, user_id: str) -> DemoAccount:
        if self.db is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Local account not found",
            )
        user = self.db.get(User, user_id)
        if user is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Local account not found",
            )

        authorized_courses = self._authorized_courses(user)
        authorized_classes = self._authorized_classes(user)
        return DemoAccount(
            user_id=user.id,
            name=user.name,
            role=user.role,
            title=self._local_title(user),
            default_view=self._default_view(user.role),
            authorized_courses=authorized_courses,
            authorized_classes=authorized_classes,
            modules=self._modules_for_role(user.role),
        )

    def _verify_school_identity_secret(self, shared_secret: str | None) -> None:
        expected = settings.school_identity_shared_secret
        if not shared_secret or not compare_digest(shared_secret, expected):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid school identity secret",
            )

    def _find_local_identity(self, payload: SchoolIdentitySessionRequest) -> User:
        if self.db is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="School identity account not found",
            )
        lookups = [
            ("id", payload.user_id),
            ("student_no", payload.student_no),
            ("teacher_no", payload.teacher_no),
            ("email", payload.email),
        ]
        for field_name, value in lookups:
            if not value:
                continue
            user = self.db.scalars(select(User).where(getattr(User, field_name) == value)).first()
            if user is not None:
                return user
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="School identity account not found",
        )

    def _authorized_courses(self, user: User) -> list[str]:
        if self.db is None:
            return []
        if user.role == "admin":
            return ["全部课程"]
        memberships = self.db.scalars(
            select(CourseMembership)
            .where(CourseMembership.user_id == user.id)
            .order_by(CourseMembership.course_id.asc())
        ).all()
        values: list[str] = []
        for membership in memberships:
            course = self.db.get(Course, membership.course_id)
            if course is None:
                continue
            values.extend([course.id, course.name])
        return self._dedupe(values)

    def _authorized_classes(self, user: User) -> list[str]:
        if self.db is None:
            return []
        if user.role == "admin":
            return ["全部班级"]
        course_ids = [
            membership.course_id
            for membership in self.db.scalars(
                select(CourseMembership)
                .where(CourseMembership.user_id == user.id)
                .where(CourseMembership.role_in_course == "teacher")
            ).all()
        ]
        memberships = self.db.scalars(
            select(CourseMembership)
            .where(CourseMembership.user_id == user.id)
            .where(CourseMembership.class_id.is_not(None))
            .order_by(CourseMembership.class_id.asc())
        ).all()
        if user.role == "teacher" and course_ids:
            memberships.extend(
                self.db.scalars(
                    select(CourseMembership)
                    .where(CourseMembership.course_id.in_(course_ids))
                    .where(CourseMembership.role_in_course == "class")
                    .where(CourseMembership.class_id.is_not(None))
                    .order_by(CourseMembership.class_id.asc())
                ).all()
            )
        values: list[str] = []
        for membership in memberships:
            if membership.class_id is None:
                continue
            class_record = self.db.get(ClassGroup, membership.class_id)
            if class_record is None:
                continue
            values.extend([class_record.id, class_record.name])
        return self._dedupe(values)

    def _local_title(self, user: User) -> str:
        if user.role == "admin":
            return "学校管理员账号"
        if user.role == "teacher":
            return f"教师账号{f' · {user.teacher_no}' if user.teacher_no else ''}"
        return f"学生账号{f' · {user.student_no}' if user.student_no else ''}"

    def _default_view(self, role: str) -> str:
        if role == "admin":
            return "academic"
        if role == "teacher":
            return "teacher"
        return "growth"

    def _modules_for_role(self, role: str) -> list[str]:
        if role == "admin":
            return ["课程班级", "知识库管理", "教师看板", "成长路径", "任务复盘", "知识库问答", "测试评测"]
        if role == "teacher":
            return ["教师看板", "作业报告", "课程班级", "知识库问答"]
        return ["成长路径", "作业报告", "任务复盘", "知识库问答"]

    def _dedupe(self, values: list[str]) -> list[str]:
        seen: set[str] = set()
        result: list[str] = []
        for value in values:
            if value in seen:
                continue
            seen.add(value)
            result.append(value)
        return result
