from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.schemas.auth import DemoAccountsResponse, DemoSessionRequest, DemoSessionResponse
from app.schemas.auth import LocalSessionRequest
from app.services.auth_service import AuthService

router = APIRouter()


@router.get("/demo-accounts", response_model=DemoAccountsResponse)
def list_demo_accounts() -> DemoAccountsResponse:
    return AuthService().list_demo_accounts()


@router.post("/demo-session", response_model=DemoSessionResponse)
def create_demo_session(payload: DemoSessionRequest) -> DemoSessionResponse:
    return AuthService().create_demo_session(payload.user_id)


@router.post("/local-session", response_model=DemoSessionResponse)
def create_local_session(
    payload: LocalSessionRequest,
    db: Session = Depends(get_db),
) -> DemoSessionResponse:
    return AuthService(db).create_local_session(payload.user_id)
