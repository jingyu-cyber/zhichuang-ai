from fastapi import APIRouter, Query

from app.schemas.knowledge import (
    KnowledgeDocumentCreate,
    KnowledgeDocumentUpsertResponse,
    KnowledgeDocumentsResponse,
    KnowledgeSearchResponse,
)
from app.services.knowledge_service import KnowledgeService

router = APIRouter()


@router.get("/documents", response_model=KnowledgeDocumentsResponse)
def list_documents() -> KnowledgeDocumentsResponse:
    return KnowledgeService().list_documents()


@router.post("/documents", response_model=KnowledgeDocumentUpsertResponse)
def create_document(payload: KnowledgeDocumentCreate) -> KnowledgeDocumentUpsertResponse:
    return KnowledgeService().create_document(payload)


@router.get("/search", response_model=KnowledgeSearchResponse)
def search_knowledge(
    q: str = Query(min_length=1),
    limit: int = Query(default=5, ge=1, le=20),
) -> KnowledgeSearchResponse:
    return KnowledgeService().search(q, limit)
