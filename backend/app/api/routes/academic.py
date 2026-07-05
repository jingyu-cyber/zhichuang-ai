from fastapi import APIRouter, Depends, Header, HTTPException, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.schemas.academic import (
    AcademicImportRequest,
    AcademicImportResponse,
    ClassListResponse,
    CourseListResponse,
    StudentListResponse,
)
from app.services.academic_service import AcademicService
from app.services.auth_service import AuthService

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


@router.post("/academic/import", response_model=AcademicImportResponse)
def import_academic_data(
    payload: AcademicImportRequest,
    authorization: str | None = Header(default=None),
    db: Session = Depends(get_db),
) -> AcademicImportResponse:
    _ensure_admin(authorization, db)
    try:
        return AcademicService(db).import_academic_data(payload)
    except ValueError as error:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(error)) from error
    except IntegrityError as error:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Academic import conflicts with existing unique records",
        ) from error


def _ensure_admin(authorization: str | None, db: Session) -> None:
    account = AuthService(db).current_account(authorization)
    if account.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admins can import academic data",
        )
