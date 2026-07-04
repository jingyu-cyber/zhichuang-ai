from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.schemas.academic import ClassListResponse, CourseListResponse, StudentListResponse
from app.services.academic_service import AcademicService

router = APIRouter()


@router.get("/courses", response_model=CourseListResponse)
def list_courses(db: Session = Depends(get_db)) -> CourseListResponse:
    return AcademicService(db).list_courses()


@router.get("/courses/{course_id}/classes", response_model=ClassListResponse)
def list_classes(
    course_id: str,
    db: Session = Depends(get_db),
) -> ClassListResponse:
    return AcademicService(db).list_classes(course_id)


@router.get("/classes/{class_id}/students", response_model=StudentListResponse)
def list_students(
    class_id: str,
    db: Session = Depends(get_db),
) -> StudentListResponse:
    return AcademicService(db).list_students(class_id)
