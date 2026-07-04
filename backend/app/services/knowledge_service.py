from __future__ import annotations

from app.rag.pipeline import DEMO_CHUNKS, RagPipeline
from app.schemas.knowledge import (
    KnowledgeDocument,
    KnowledgeDocumentCreate,
    KnowledgeDocumentUpsertResponse,
    KnowledgeDocumentsResponse,
    KnowledgeSearchResponse,
    KnowledgeSearchResult,
)


class KnowledgeService:
    updated_at = "2026-07-05T09:30:00+08:00"
    custom_documents: list[KnowledgeDocumentCreate] = []

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
        self.custom_documents.append(payload)
        document = self._custom_document_card(len(self.custom_documents), payload)
        return KnowledgeDocumentUpsertResponse(
            document=document,
            searchable=True,
            message="资料已加入演示知识库，可在本次会话中检索。",
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
            self._custom_document_card(index, payload)
            for index, payload in enumerate(self.custom_documents, start=1)
        ]

    def _custom_document_card(
        self,
        index: int,
        payload: KnowledgeDocumentCreate,
    ) -> KnowledgeDocument:
        return KnowledgeDocument(
            document_id=f"custom_doc_{index:03d}",
            title=payload.title,
            source_type=payload.source_type,
            path=payload.path,
            tags=payload.tags,
            chunk_count=max(1, len(payload.content) // 500 + 1),
            status="已入库",
            updated_at=self.updated_at,
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
