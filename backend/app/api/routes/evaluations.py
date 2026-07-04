from fastapi import APIRouter, Header, HTTPException, status

from app.schemas.evaluations import (
    EvaluationCase,
    EvaluationCaseCreate,
    EvaluationDashboardResponse,
    EvaluationRecord,
    EvaluationRecordCreate,
    EvaluationUpsertResponse,
)
from app.services.auth_service import AuthService
from app.services.evaluation_service import EvaluationService

router = APIRouter()


@router.get("/dashboard", response_model=EvaluationDashboardResponse)
def get_evaluation_dashboard() -> EvaluationDashboardResponse:
    return EvaluationService().dashboard()


@router.get("/cases", response_model=list[EvaluationCase])
def list_evaluation_cases() -> list[EvaluationCase]:
    return EvaluationService().list_cases()


@router.post("/cases", response_model=EvaluationUpsertResponse)
def create_evaluation_case(
    payload: EvaluationCaseCreate,
    authorization: str | None = Header(default=None),
) -> EvaluationUpsertResponse:
    _ensure_admin(authorization)
    return EvaluationService().create_case(payload)


@router.get("/records", response_model=list[EvaluationRecord])
def list_evaluation_records() -> list[EvaluationRecord]:
    return EvaluationService().list_records()


@router.post("/records", response_model=EvaluationUpsertResponse)
def create_evaluation_record(
    payload: EvaluationRecordCreate,
    authorization: str | None = Header(default=None),
) -> EvaluationUpsertResponse:
    _ensure_admin(authorization)
    return EvaluationService().create_record(payload)


def _ensure_admin(authorization: str | None) -> None:
    account = AuthService().current_account(authorization)
    if account.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admins can maintain evaluation cases and records",
        )
