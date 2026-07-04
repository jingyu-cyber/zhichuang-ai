from __future__ import annotations

from datetime import datetime

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.base import Base
from app.models.course import ClassGroup, Course, CourseMembership
from app.models.user import User
from app.schemas.academic import (
    ClassListResponse,
    ClassSummary,
    CourseListResponse,
    CourseSummary,
    StudentListResponse,
    StudentSummary,
)


class AcademicService:
    courses = [
        CourseSummary(
            course_id="course_web_2026",
            name="Web 应用开发",
            term="2025-2026 春季学期",
            teacher_name="周老师",
            description="围绕 Flask、前端页面、数据库访问和项目文档完成 Web 项目实践。",
        ),
        CourseSummary(
            course_id="course_algo_2026",
            name="算法设计与分析",
            term="2025-2026 春季学期",
            teacher_name="李老师",
            description="围绕数据结构、搜索、动态规划和图论训练算法竞赛基础能力。",
        ),
    ]
    classes = [
        ClassSummary(
            class_id="class_cs_2024_01",
            course_id="course_web_2026",
            name="2024 级计算机科学与技术 1 班",
            grade="2024",
            major="计算机科学与技术",
            student_count=32,
        ),
        ClassSummary(
            class_id="class_cs_2024_01",
            course_id="course_algo_2026",
            name="2024 级计算机科学与技术 1 班",
            grade="2024",
            major="计算机科学与技术",
            student_count=32,
        ),
    ]
    students = [
        StudentSummary(
            student_id="student_001",
            name="林一舟",
            student_no="2024010101",
            class_id="class_cs_2024_01",
            target_path="AI 应用开发 / 软件项目实践",
            tags=["工程实践", "RAG", "后端接口"],
        ),
        StudentSummary(
            student_id="student_002",
            name="陈星然",
            student_no="2024010102",
            class_id="class_cs_2024_01",
            target_path="前端交互 / 项目展示",
            tags=["React", "交互设计", "答辩材料"],
        ),
        StudentSummary(
            student_id="student_003",
            name="周明远",
            student_no="2024010103",
            class_id="class_cs_2024_01",
            target_path="算法竞赛 / 评测",
            tags=["算法", "测试用例", "评测"],
        ),
        StudentSummary(
            student_id="student_004",
            name="沈知夏",
            student_no="2024010104",
            class_id="class_cs_2024_01",
            target_path="产品表达 / 双创材料",
            tags=["需求分析", "项目报告", "路演"],
        ),
        StudentSummary(
            student_id="student_005",
            name="许嘉木",
            student_no="2024010105",
            class_id="class_cs_2024_01",
            target_path="数据库 / 部署",
            tags=["SQL", "Docker", "运维"],
        ),
    ]

    def __init__(self, db: Session | None = None) -> None:
        self.db = db
        if self.db is not None:
            Base.metadata.create_all(bind=self.db.get_bind())
            self._ensure_seed_data()

    def list_courses(self) -> CourseListResponse:
        if self.db is None:
            return CourseListResponse(courses=self.courses)
        records = self.db.scalars(
            select(Course).order_by(Course.created_at.asc(), Course.id.asc())
        ).all()
        return CourseListResponse(
            courses=[
                CourseSummary(
                    course_id=record.id,
                    name=record.name,
                    term=record.term or "",
                    teacher_name=self._teacher_name_for_course(record.id),
                    description=record.description or "",
                )
                for record in records
            ]
        )

    def list_classes(self, course_id: str) -> ClassListResponse:
        if self.db is None:
            classes = [class_item for class_item in self.classes if class_item.course_id == course_id]
            return ClassListResponse(course_id=course_id, classes=classes)
        memberships = self.db.scalars(
            select(CourseMembership)
            .where(CourseMembership.course_id == course_id)
            .where(CourseMembership.role_in_course == "class")
            .order_by(CourseMembership.id.asc())
        ).all()
        classes = []
        for membership in memberships:
            if not membership.class_id:
                continue
            class_record = self.db.get(ClassGroup, membership.class_id)
            if class_record is None:
                continue
            classes.append(
                ClassSummary(
                    class_id=class_record.id,
                    course_id=course_id,
                    name=class_record.name,
                    grade=class_record.grade or "",
                    major=class_record.major or "",
                    student_count=self._student_count(class_record.id),
                )
            )
        return ClassListResponse(course_id=course_id, classes=classes)

    def list_students(self, class_id: str) -> StudentListResponse:
        if self.db is None:
            students = [student for student in self.students if student.class_id == class_id]
            return StudentListResponse(class_id=class_id, students=students)
        memberships = self.db.scalars(
            select(CourseMembership)
            .where(CourseMembership.class_id == class_id)
            .where(CourseMembership.role_in_course == "student")
            .order_by(CourseMembership.id.asc())
        ).all()
        students = []
        seen_user_ids: set[str] = set()
        for membership in memberships:
            if membership.user_id in seen_user_ids:
                continue
            seen_user_ids.add(membership.user_id)
            user = self.db.get(User, membership.user_id)
            if user is None:
                continue
            students.append(
                StudentSummary(
                    student_id=user.id,
                    name=user.name,
                    student_no=user.student_no or "",
                    class_id=class_id,
                    target_path=self._student_target_path(user.id),
                    tags=self._student_tags(user.id),
                )
            )
        return StudentListResponse(class_id=class_id, students=students)

    def _ensure_seed_data(self) -> None:
        if self.db is None:
            return
        now = datetime.utcnow()
        self._ensure_teacher(now)
        for course in self.courses:
            if self.db.get(Course, course.course_id) is None:
                self.db.add(
                    Course(
                        id=course.course_id,
                        name=course.name,
                        term=course.term,
                        description=course.description,
                        created_at=now,
                    )
                )
        seeded_class_ids: set[str] = set()
        for class_item in self.classes:
            should_create_class = (
                class_item.class_id not in seeded_class_ids
                and self.db.get(ClassGroup, class_item.class_id) is None
            )
            seeded_class_ids.add(class_item.class_id)
            if should_create_class:
                self.db.add(
                    ClassGroup(
                        id=class_item.class_id,
                        name=class_item.name,
                        grade=class_item.grade,
                        major=class_item.major,
                        created_at=now,
                    )
                )
            membership_id = f"membership_{class_item.course_id}_{class_item.class_id}_class"
            if self.db.get(CourseMembership, membership_id) is None:
                self.db.add(
                    CourseMembership(
                        id=membership_id,
                        course_id=class_item.course_id,
                        class_id=class_item.class_id,
                        user_id="teacher_001",
                        role_in_course="class",
                    )
                )
        for student in self.students:
            if self.db.get(User, student.student_id) is None:
                self.db.add(
                    User(
                        id=student.student_id,
                        name=student.name,
                        role="student",
                        email=f"{student.student_no}@example.edu",
                        student_no=student.student_no,
                        teacher_no=None,
                        created_at=now,
                    )
                )
            for course in self.courses:
                membership_id = f"membership_{course.course_id}_{student.class_id}_{student.student_id}"
                if self.db.get(CourseMembership, membership_id) is None:
                    self.db.add(
                        CourseMembership(
                            id=membership_id,
                            course_id=course.course_id,
                            class_id=student.class_id,
                            user_id=student.student_id,
                            role_in_course="student",
                        )
                    )
        self.db.commit()

    def _ensure_teacher(self, now: datetime) -> None:
        if self.db is None:
            return
        if self.db.get(User, "teacher_001") is None:
            self.db.add(
                User(
                    id="teacher_001",
                    name="周老师",
                    role="teacher",
                    email="teacher_001@example.edu",
                    student_no=None,
                    teacher_no="T2026001",
                    created_at=now,
                )
            )

    def _teacher_name_for_course(self, course_id: str) -> str:
        if self.db is None:
            return "周老师"
        membership = self.db.scalars(
            select(CourseMembership)
            .where(CourseMembership.course_id == course_id)
            .where(CourseMembership.role_in_course == "class")
            .order_by(CourseMembership.id.asc())
        ).first()
        if membership is None:
            return "未指定"
        teacher = self.db.get(User, membership.user_id)
        return teacher.name if teacher is not None else "未指定"

    def _student_count(self, class_id: str) -> int:
        if self.db is None:
            return len([student for student in self.students if student.class_id == class_id])
        memberships = self.db.scalars(
            select(CourseMembership)
            .where(CourseMembership.class_id == class_id)
            .where(CourseMembership.role_in_course == "student")
        ).all()
        return len({membership.user_id for membership in memberships})

    def _student_target_path(self, student_id: str) -> str:
        for student in self.students:
            if student.student_id == student_id:
                return student.target_path
        return "软件项目实践"

    def _student_tags(self, student_id: str) -> list[str]:
        for student in self.students:
            if student.student_id == student_id:
                return student.tags
        return []
