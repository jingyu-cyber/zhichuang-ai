from fastapi.testclient import TestClient
from sqlalchemy import create_engine, select
from sqlalchemy.orm import sessionmaker

from app.main import app
from app.models.course import CourseMembership, StudentAcademicProfile
from app.services.academic_service import AcademicService


def test_academic_base_data() -> None:
    client = TestClient(app)
    courses_response = client.get("/api/courses")
    classes_response = client.get("/api/courses/course_web_2026/classes")
    students_response = client.get("/api/classes/class_cs_2024_01/students")

    assert courses_response.status_code == 200
    assert classes_response.status_code == 200
    assert students_response.status_code == 200
    assert len(courses_response.json()["courses"]) >= 2
    assert classes_response.json()["classes"][0]["class_id"] == "class_cs_2024_01"
    assert len(students_response.json()["students"]) >= 5


def test_academic_base_data_persists_in_sqlite_session(tmp_path) -> None:
    engine = create_engine(
        f"sqlite:///{tmp_path / 'academic.db'}",
        connect_args={"check_same_thread": False},
    )
    SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)

    with SessionLocal() as first_session:
        service = AcademicService(first_session)
        courses = service.list_courses()
        classes = service.list_classes("course_web_2026")
        students = service.list_students("class_cs_2024_01")

    with SessionLocal() as second_session:
        service = AcademicService(second_session)
        persisted_courses = service.list_courses()
        persisted_classes = service.list_classes("course_web_2026")
        persisted_students = service.list_students("class_cs_2024_01")
        memberships = second_session.scalars(select(CourseMembership)).all()

    assert [course.course_id for course in courses.courses] == [
        course.course_id for course in persisted_courses.courses
    ]
    assert classes.classes[0].class_id == persisted_classes.classes[0].class_id
    assert len(students.students) == len(persisted_students.students)
    assert any(membership.role_in_course == "student" for membership in memberships)
    assert any(membership.role_in_course == "class" for membership in memberships)


def test_admin_can_import_academic_data_and_students_cannot() -> None:
    client = TestClient(app)
    payload = {
        "courses": [
            {
                "course_id": "course_ai_2026",
                "name": "AI 应用开发",
                "term": "2025-2026 春季学期",
                "teacher_id": "teacher_002",
                "teacher_name": "王老师",
                "teacher_no": "T2026002",
                "description": "面向通用大模型应用、RAG 和智能体协作完成课程项目。",
            }
        ],
        "classes": [
            {
                "class_id": "class_ai_2024_02",
                "course_id": "course_ai_2026",
                "name": "2024 级人工智能 2 班",
                "grade": "2024",
                "major": "人工智能",
            }
        ],
        "students": [
            {
                "student_id": "student_101",
                "name": "赵清河",
                "student_no": "2024010201",
                "class_id": "class_ai_2024_02",
                "target_path": "AI 应用开发",
                "tags": ["RAG", "智能体", "项目实践"],
            }
        ],
    }

    forbidden_response = client.post(
        "/api/academic/import",
        json=payload,
        headers={"Authorization": "Bearer demo-token-student_001"},
    )
    response = client.post(
        "/api/academic/import",
        json=payload,
        headers={"Authorization": "Bearer demo-token-admin_001"},
    )
    courses_response = client.get("/api/courses")
    classes_response = client.get("/api/courses/course_ai_2026/classes")
    students_response = client.get("/api/classes/class_ai_2024_02/students")

    assert forbidden_response.status_code == 403
    assert response.status_code == 200
    assert response.json()["imported_students"] == 1
    assert any(
        course["course_id"] == "course_ai_2026" and course["teacher_name"] == "王老师"
        for course in courses_response.json()["courses"]
    )
    assert classes_response.json()["classes"][0]["class_id"] == "class_ai_2024_02"
    assert students_response.json()["students"][0]["student_id"] == "student_101"
    assert students_response.json()["students"][0]["target_path"] == "AI 应用开发"


def test_academic_import_persists_in_sqlite_session(tmp_path) -> None:
    engine = create_engine(
        f"sqlite:///{tmp_path / 'academic_import.db'}",
        connect_args={"check_same_thread": False},
    )
    SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)

    with SessionLocal() as first_session:
        service = AcademicService(first_session)
        response = service.import_academic_data(
            payload=AcademicServiceImportFixture.payload()
        )

    with SessionLocal() as second_session:
        service = AcademicService(second_session)
        courses = service.list_courses()
        classes = service.list_classes("course_security_2026")
        students = service.list_students("class_security_2024_01")
        memberships = second_session.scalars(select(CourseMembership)).all()
        profile = second_session.get(StudentAcademicProfile, "student_201")

    assert response.imported_courses == 1
    assert any(course.course_id == "course_security_2026" for course in courses.courses)
    assert classes.classes[0].class_id == "class_security_2024_01"
    assert students.students[0].student_id == "student_201"
    assert students.students[0].tags == ["安全测试", "代码审计"]
    assert profile is not None
    assert profile.target_path == "软件项目实践"
    assert any(
        membership.course_id == "course_security_2026"
        and membership.user_id == "student_201"
        and membership.role_in_course == "student"
        for membership in memberships
    )


def test_academic_import_reuses_teacher_across_courses(tmp_path) -> None:
    engine = create_engine(
        f"sqlite:///{tmp_path / 'academic_multi_course.db'}",
        connect_args={"check_same_thread": False},
    )
    SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)

    with SessionLocal() as session:
        service = AcademicService(session)
        response = service.import_academic_data(
            payload=AcademicServiceImportFixture.multi_course_teacher_payload()
        )
        repeated = service.import_academic_data(
            payload=AcademicServiceImportFixture.multi_course_teacher_payload()
        )
        teacher_memberships = session.scalars(
            select(CourseMembership)
            .where(CourseMembership.user_id == "teacher_multi_course")
            .where(CourseMembership.role_in_course == "teacher")
        ).all()

    assert response.imported_courses == 2
    assert response.imported_students == 1
    assert repeated.imported_courses == 0
    assert len(teacher_memberships) == 2


def test_academic_import_rejects_unknown_course() -> None:
    client = TestClient(app)
    response = client.post(
        "/api/academic/import",
        json={
            "classes": [
                {
                    "class_id": "class_unknown_course_01",
                    "course_id": "course_missing_2026",
                    "name": "缺失课程班级",
                }
            ]
        },
        headers={"Authorization": "Bearer demo-token-admin_001"},
    )

    assert response.status_code == 409
    assert "Course course_missing_2026 does not exist" in response.json()["detail"]


class AcademicServiceImportFixture:
    @staticmethod
    def payload():
        from app.schemas.academic import (
            AcademicImportClass,
            AcademicImportCourse,
            AcademicImportRequest,
            AcademicImportStudent,
        )

        return AcademicImportRequest(
            courses=[
                AcademicImportCourse(
                    course_id="course_security_2026",
                    name="软件安全实践",
                    term="2025-2026 春季学期",
                    teacher_id="teacher_003",
                    teacher_name="刘老师",
                    teacher_no="T2026003",
                    description="围绕安全测试、代码审计和修复报告完成实践。",
                )
            ],
            classes=[
                AcademicImportClass(
                    class_id="class_security_2024_01",
                    course_id="course_security_2026",
                    name="2024 级软件工程 1 班",
                    grade="2024",
                    major="软件工程",
                )
            ],
            students=[
                AcademicImportStudent(
                    student_id="student_201",
                    name="钱亦辰",
                    student_no="2024010301",
                    class_id="class_security_2024_01",
                    target_path="软件项目实践",
                    tags=["安全测试", "代码审计"],
                )
            ],
        )

    @staticmethod
    def multi_course_teacher_payload():
        from app.schemas.academic import (
            AcademicImportClass,
            AcademicImportCourse,
            AcademicImportRequest,
            AcademicImportStudent,
        )

        return AcademicImportRequest(
            courses=[
                AcademicImportCourse(
                    course_id="course_multi_ai_2026",
                    name="多课程 AI 应用开发",
                    teacher_id="teacher_multi_course",
                    teacher_name="多课程教师",
                    teacher_no="TMULTI001",
                ),
                AcademicImportCourse(
                    course_id="course_multi_web_2026",
                    name="多课程 Web 实践",
                    teacher_id="teacher_multi_course",
                    teacher_name="多课程教师",
                    teacher_no="TMULTI001",
                ),
            ],
            classes=[
                AcademicImportClass(
                    class_id="class_multi_ai_2024_01",
                    course_id="course_multi_ai_2026",
                    name="多课程 1 班",
                )
            ],
            students=[
                AcademicImportStudent(
                    student_id="student_multi_course",
                    name="多课程学生",
                    student_no="MULTI2026001",
                    class_id="class_multi_ai_2024_01",
                )
            ],
        )
