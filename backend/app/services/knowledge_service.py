from __future__ import annotations

from app.rag.pipeline import DEMO_CHUNKS, RagPipeline
from app.schemas.knowledge import (
    KnowledgeDocument,
    KnowledgeDocumentCreate,
    KnowledgeDocumentStatusUpdate,
    KnowledgeDocumentUpdate,
    KnowledgeDocumentUpsertResponse,
    KnowledgeDocumentVersion,
    KnowledgeDocumentVersionsResponse,
    KnowledgeDocumentsResponse,
    KnowledgeSearchResponse,
    KnowledgeSearchResult,
)


class ManagedKnowledgeDocument:
    def __init__(
        self,
        document_id: str,
        payload: KnowledgeDocumentCreate,
        created_at: str,
    ) -> None:
        self.document_id = document_id
        self.title = payload.title
        self.source_type = payload.source_type
        self.path = payload.path
        self.tags = payload.tags
        self.content = payload.content
        self.source_url = payload.source_url
        self.maintainer = payload.maintainer
        self.status = "已入库"
        self.version = 1
        self.updated_at = created_at
        self.versions = [
            KnowledgeDocumentVersion(
                version=1,
                action="create",
                maintainer=payload.maintainer,
                updated_at=created_at,
                summary="新增知识库资料并加入检索。",
            )
        ]


class KnowledgeService:
    updated_at = "2026-07-05T09:30:00+08:00"
    custom_documents: list[ManagedKnowledgeDocument] = []

    def list_documents(self) -> KnowledgeDocumentsResponse:
        documents = [
            KnowledgeDocument(
                document_id=f"doc_{index:03d}",
                title=chunk.title,
                source_type=chunk.source_type,
                path=chunk.path,
                tags=chunk.tags,
                chunk_count=1,
                status="已入库",
                source_url=None,
                maintainer="平台管理员",
                version=1,
                updated_at=self.updated_at,
            )
            for index, chunk in enumerate(DEMO_CHUNKS, start=1)
        ]
        documents.extend(self._custom_document_cards())
        return KnowledgeDocumentsResponse(total=len(documents), documents=documents)

    def create_document(
        self,
        payload: KnowledgeDocumentCreate,
    ) -> KnowledgeDocumentUpsertResponse:
        document_id = f"custom_doc_{len(self.custom_documents) + 1:03d}"
        managed_document = ManagedKnowledgeDocument(document_id, payload, self.updated_at)
        self.custom_documents.append(managed_document)
        document = self._custom_document_card(managed_document)
        return KnowledgeDocumentUpsertResponse(
            document=document,
            searchable=True,
            message="资料已加入演示知识库，可在本次会话中检索。",
        )

    def update_document(
        self,
        document_id: str,
        payload: KnowledgeDocumentUpdate,
    ) -> KnowledgeDocumentUpsertResponse:
        managed_document = self._find_custom_document(document_id)
        if payload.title is not None:
            managed_document.title = payload.title
        if payload.source_type is not None:
            managed_document.source_type = payload.source_type
        if payload.path is not None:
            managed_document.path = payload.path
        if payload.tags is not None:
            managed_document.tags = payload.tags
        if payload.content is not None:
            managed_document.content = payload.content
        if payload.source_url is not None:
            managed_document.source_url = payload.source_url
        managed_document.maintainer = payload.maintainer
        managed_document.status = "已入库"
        self._append_version(
            managed_document,
            action="update",
            maintainer=payload.maintainer,
            summary="编辑知识库资料内容或元数据。",
        )
        return KnowledgeDocumentUpsertResponse(
            document=self._custom_document_card(managed_document),
            searchable=True,
            message="资料已更新并重新加入检索。",
        )

    def update_document_status(
        self,
        document_id: str,
        payload: KnowledgeDocumentStatusUpdate,
    ) -> KnowledgeDocumentUpsertResponse:
        managed_document = self._find_custom_document(document_id)
        managed_document.status = payload.status
        managed_document.maintainer = payload.maintainer
        self._append_version(
            managed_document,
            action="status",
            maintainer=payload.maintainer,
            summary=f"状态更新为{payload.status}。",
        )
        return KnowledgeDocumentUpsertResponse(
            document=self._custom_document_card(managed_document),
            searchable=managed_document.status == "已入库",
            message="资料状态已更新。",
        )

    def list_versions(self, document_id: str) -> KnowledgeDocumentVersionsResponse:
        managed_document = self._find_custom_document(document_id)
        return KnowledgeDocumentVersionsResponse(
            document_id=document_id,
            versions=managed_document.versions,
        )

    def search(self, query: str, limit: int = 5) -> KnowledgeSearchResponse:
        chunks = RagPipeline().retrieve(query, limit=limit)
        results = [
            KnowledgeSearchResult(
                title=chunk.title,
                source_type=chunk.source_type,
                path=chunk.path,
                snippet=chunk.content,
                score=round(chunk.score, 3),
                tags=chunk.tags,
            )
            for chunk in chunks
        ]
        custom_results = self._search_custom_documents(query, limit=limit)
        results = sorted(
            [*results, *custom_results],
            key=lambda result: result.score,
            reverse=True,
        )[:limit]
        return KnowledgeSearchResponse(query=query, total=len(results), results=results)

    def _custom_document_cards(self) -> list[KnowledgeDocument]:
        return [
            self._custom_document_card(managed_document)
            for managed_document in self.custom_documents
        ]

    def _custom_document_card(
        self,
        document: ManagedKnowledgeDocument,
    ) -> KnowledgeDocument:
        return KnowledgeDocument(
            document_id=document.document_id,
            title=document.title,
            source_type=document.source_type,
            path=document.path,
            tags=document.tags,
            chunk_count=max(1, len(document.content) // 500 + 1),
            status=document.status,
            source_url=document.source_url,
            maintainer=document.maintainer,
            version=document.version,
            updated_at=document.updated_at,
        )

    def _search_custom_documents(
        self,
        query: str,
        limit: int,
    ) -> list[KnowledgeSearchResult]:
        if limit <= 0:
            return []
        query_terms = [term for term in query.lower().split() if term]
        results: list[KnowledgeSearchResult] = []
        for payload in self.custom_documents:
            if payload.status != "已入库":
                continue
            haystack = " ".join(
                [payload.title, payload.source_type, payload.path, *payload.tags, payload.content]
            ).lower()
            normalized_query = query.lower()
            exact_match = normalized_query in haystack
            term_match = any(term in haystack for term in query_terms)
            if not exact_match and not term_match:
                continue
            results.append(
                KnowledgeSearchResult(
                    title=payload.title,
                    source_type=payload.source_type,
                    path=payload.path,
                    snippet=payload.content[:180],
                    score=1.2 if exact_match else 0.9,
                    tags=payload.tags,
                )
            )
            if len(results) >= limit:
                break
        return results

    def _find_custom_document(self, document_id: str) -> ManagedKnowledgeDocument:
        for document in self.custom_documents:
            if document.document_id == document_id:
                return document
        raise ValueError(f"Knowledge document {document_id} not found or cannot be edited")

    def _append_version(
        self,
        document: ManagedKnowledgeDocument,
        action: str,
        maintainer: str,
        summary: str,
    ) -> None:
        document.version += 1
        document.updated_at = self.updated_at
        document.versions.append(
            KnowledgeDocumentVersion(
                version=document.version,
                action=action,
                maintainer=maintainer,
                updated_at=document.updated_at,
                summary=summary,
            )
        )
