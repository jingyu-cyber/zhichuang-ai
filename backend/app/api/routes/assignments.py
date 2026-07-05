from fastapi import APIRouter, Depends, File, Form, Header, HTTPException, UploadFile, status
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.schemas.assignments import (
    AssignmentCreateRequest,
    AssignmentDashboardResponse,
    AssignmentAnalysisRequest,
    AssignmentAnalysisResponse,
    AssignmentItem,
    AssignmentListResponse,
)
from app.services.assignment_service import AssignmentService
from app.services.auth_service import AuthService
from app.services.submission_archive_service import SubmissionArchiveService

router = APIRouter()


@router.get("", response_model=AssignmentListResponse)
def list_assignments(
    authorization: str | None = Header(default=None),
    db: Session = Depends(get_db),
) -> AssignmentListResponse:
    account = AuthService(db).current_account(authorization)
    return AssignmentService(db).list_assignments(account=account)


@router.post("", response_model=AssignmentItem)
def create_assignment(
    payload: AssignmentCreateRequest,
    authorization: str | None = Header(default=None),
    db: Session = Depends(get_db),
) -> AssignmentItem:
    account = AuthService(db).current_account(authorization)
    return AssignmentService(db).create_assignment(payload, account=account)


@router.post("/analyze", response_model=AssignmentAnalysisResponse)
def analyze_assignment(
    payload: AssignmentAnalysisRequest,
    authorization: str | None = Header(default=None),
    db: Session = Depends(get_db),
) -> AssignmentAnalysisResponse:
    account = AuthService(db).current_account(authorization)
    return AssignmentService(db).analyze(payload, account=account)


@router.post("/upload-archive", response_model=AssignmentAnalysisResponse)
async def upload_assignment_archive(
    assignment_id: str | None = Form(default=None),
    assignment_title: str = Form(...),
    course_id: str | None = Form(default=None),
    class_id: str | None = Form(default=None),
    student_id: str | None = Form(default=None),
    rubric_id: str | None = Form(default=None),
    repository_url: str | None = Form(default=None),
    description: str | None = Form(default=None),
    archive: UploadFile = File(...),
    authorization: str | None = Header(default=None),
    db: Session = Depends(get_db),
) -> AssignmentAnalysisResponse:
    if archive.content_type not in {
        "application/zip",
        "application/x-zip-compressed",
        "multipart/x-zip",
        "application/octet-stream",
    }:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="请上传 zip 格式的作业压缩包。",
        )
    archive_bytes = await archive.read()
    try:
        files = SubmissionArchiveService().parse_zip(archive_bytes)
    except ValueError as error:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(error)) from error

    account = AuthService(db).current_account(authorization)
    payload = AssignmentAnalysisRequest(
        assignment_id=assignment_id,
        assignment_title=assignment_title,
        course_id=course_id,
        class_id=class_id,
        student_id=student_id,
        rubric_id=rubric_id,
        repository_url=repository_url,
        description=description,
        files=files,
    )
    return AssignmentService(db).analyze(payload, account=account)


@router.get("/{assignment_id}/reports/{student_id}", response_model=AssignmentAnalysisResponse)
def get_assignment_report(
    assignment_id: str,
    student_id: str,
    authorization: str | None = Header(default=None),
    db: Session = Depends(get_db),
) -> AssignmentAnalysisResponse:
    account = AuthService(db).current_account(authorization)
    return AssignmentService(db).get_report(assignment_id, student_id, account=account)


@router.get("/{assignment_id}/dashboard", response_model=AssignmentDashboardResponse)
def get_assignment_dashboard(
    assignment_id: str,
    authorization: str | None = Header(default=None),
    db: Session = Depends(get_db),
) -> AssignmentDashboardResponse:
    account = AuthService(db).current_account(authorization)
    return AssignmentService(db).get_dashboard(assignment_id, account=account)
