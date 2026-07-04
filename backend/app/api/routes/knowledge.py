from fastapi import APIRouter, Header, HTTPException, Query, status

from app.schemas.knowledge import (
    KnowledgeDocumentCreate,
    KnowledgeDocumentStatusUpdate,
    KnowledgeDocumentUpdate,
    KnowledgeDocumentUpsertResponse,
    KnowledgeDocumentVersionsResponse,
    KnowledgeDocumentsResponse,
    KnowledgeSearchResponse,
)
from app.services.auth_service import AuthService
from app.services.knowledge_service import KnowledgeService

router = APIRouter()


@router.get("/documents", response_model=KnowledgeDocumentsResponse)
def list_documents() -> KnowledgeDocumentsResponse:
    return KnowledgeService().list_documents()


@router.post("/documents", response_model=KnowledgeDocumentUpsertResponse)
def create_document(
    payload: KnowledgeDocumentCreate,
    authorization: str | None = Header(default=None),
) -> KnowledgeDocumentUpsertResponse:
    _ensure_admin(authorization)
    return KnowledgeService().create_document(payload)


@router.put("/documents/{document_id}", response_model=KnowledgeDocumentUpsertResponse)
def update_document(
    document_id: str,
    payload: KnowledgeDocumentUpdate,
    authorization: str | None = Header(default=None),
) -> KnowledgeDocumentUpsertResponse:
    _ensure_admin(authorization)
    try:
        return KnowledgeService().update_document(document_id, payload)
    except ValueError as error:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(error)) from error


@router.patch("/documents/{document_id}/status", response_model=KnowledgeDocumentUpsertResponse)
def update_document_status(
    document_id: str,
    payload: KnowledgeDocumentStatusUpdate,
    authorization: str | None = Header(default=None),
) -> KnowledgeDocumentUpsertResponse:
    _ensure_admin(authorization)
    try:
        return KnowledgeService().update_document_status(document_id, payload)
    except ValueError as error:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(error)) from error


@router.get("/documents/{document_id}/versions", response_model=KnowledgeDocumentVersionsResponse)
def list_document_versions(document_id: str) -> KnowledgeDocumentVersionsResponse:
    try:
        return KnowledgeService().list_versions(document_id)
    except ValueError as error:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(error)) from error


@router.get("/search", response_model=KnowledgeSearchResponse)
def search_knowledge(
    q: str = Query(min_length=1),
    limit: int = Query(default=5, ge=1, le=20),
) -> KnowledgeSearchResponse:
    return KnowledgeService().search(q, limit)


def _ensure_admin(authorization: str | None) -> None:
    account = AuthService().current_account(authorization)
    if account.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admins can maintain knowledge documents",
        )
