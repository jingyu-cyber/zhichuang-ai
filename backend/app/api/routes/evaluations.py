from fastapi import APIRouter, Depends, Header, HTTPException, status
from sqlalchemy.orm import Session

from app.db.session import get_db
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
def get_evaluation_dashboard(
    db: Session = Depends(get_db),
) -> EvaluationDashboardResponse:
    return EvaluationService(db).dashboard()


@router.get("/cases", response_model=list[EvaluationCase])
def list_evaluation_cases(
    db: Session = Depends(get_db),
) -> list[EvaluationCase]:
    return EvaluationService(db).list_cases()


@router.post("/cases", response_model=EvaluationUpsertResponse)
def create_evaluation_case(
    payload: EvaluationCaseCreate,
    authorization: str | None = Header(default=None),
    db: Session = Depends(get_db),
) -> EvaluationUpsertResponse:
    _ensure_admin(authorization, db)
    return EvaluationService(db).create_case(payload)


@router.get("/records", response_model=list[EvaluationRecord])
def list_evaluation_records(
    db: Session = Depends(get_db),
) -> list[EvaluationRecord]:
    return EvaluationService(db).list_records()


@router.post("/records", response_model=EvaluationUpsertResponse)
def create_evaluation_record(
    payload: EvaluationRecordCreate,
    authorization: str | None = Header(default=None),
    db: Session = Depends(get_db),
) -> EvaluationUpsertResponse:
    _ensure_admin(authorization, db)
    return EvaluationService(db).create_record(payload)


def _ensure_admin(authorization: str | None, db: Session) -> None:
    account = AuthService(db).current_account(authorization)
    if account.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admins can maintain evaluation cases and records",
        )
