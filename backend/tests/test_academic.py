from fastapi.testclient import TestClient
from sqlalchemy import create_engine, select
from sqlalchemy.orm import sessionmaker

from app.main import app
from app.models.course import CourseMembership
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
