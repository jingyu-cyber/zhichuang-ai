from __future__ import annotations

from datetime import datetime
from hashlib import sha1

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.base import Base
from app.models.knowledge import KnowledgeDocument as KnowledgeDocumentRecord
from app.models.knowledge import KnowledgeDocumentVersionRecord
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


class KnowledgeService:
    updated_at = "2026-07-05T09:30:00+08:00"

    def __init__(self, db: Session | None = None) -> None:
        self.db = db
        if self.db is not None:
            Base.metadata.create_all(bind=self.db.get_bind())

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
        if self.db is None:
            record = self._record_from_payload(self._document_id(payload), payload)
            return KnowledgeDocumentUpsertResponse(
                document=self._custom_document_card(record),
                searchable=True,
                message="资料已加入演示知识库，可在本次会话中检索。",
            )

        record = self._record_from_payload(self._document_id(payload), payload)
        suffix = 1
        base_id = record.id
        while self.db.get(KnowledgeDocumentRecord, record.id) is not None:
            suffix += 1
            record.id = f"{base_id}_{suffix}"
        self.db.add(record)
        self.db.add(
            self._version_record(
                document_id=record.id,
                version=1,
                action="create",
                maintainer=payload.maintainer,
                summary="新增知识库资料并加入检索。",
            )
        )
        self.db.commit()
        self.db.refresh(record)
        return KnowledgeDocumentUpsertResponse(
            document=self._custom_document_card(record),
            searchable=True,
            message="资料已加入演示知识库，可在本次会话中检索。",
        )

    def update_document(
        self,
        document_id: str,
        payload: KnowledgeDocumentUpdate,
    ) -> KnowledgeDocumentUpsertResponse:
        record = self._find_custom_document(document_id)
        if payload.title is not None:
            record.title = payload.title
        if payload.source_type is not None:
            record.source_type = payload.source_type
        if payload.path is not None:
            record.path = payload.path
        if payload.tags is not None:
            record.tags_json = payload.tags
        if payload.content is not None:
            record.content = payload.content
        if payload.source_url is not None:
            record.source_url = payload.source_url
        record.maintainer = payload.maintainer
        record.status = "已入库"
        self._append_version(
            record,
            action="update",
            maintainer=payload.maintainer,
            summary="编辑知识库资料内容或元数据。",
        )
        return KnowledgeDocumentUpsertResponse(
            document=self._custom_document_card(record),
            searchable=True,
            message="资料已更新并重新加入检索。",
        )

    def update_document_status(
        self,
        document_id: str,
        payload: KnowledgeDocumentStatusUpdate,
    ) -> KnowledgeDocumentUpsertResponse:
        record = self._find_custom_document(document_id)
        record.status = payload.status
        record.maintainer = payload.maintainer
        self._append_version(
            record,
            action="status",
            maintainer=payload.maintainer,
            summary=f"状态更新为{payload.status}。",
        )
        return KnowledgeDocumentUpsertResponse(
            document=self._custom_document_card(record),
            searchable=record.status == "已入库",
            message="资料状态已更新。",
        )

    def list_versions(self, document_id: str) -> KnowledgeDocumentVersionsResponse:
        record = self._find_custom_document(document_id)
        versions = self._version_records(record.id)
        return KnowledgeDocumentVersionsResponse(
            document_id=document_id,
            versions=[
                KnowledgeDocumentVersion(
                    version=item.version,
                    action=item.action,
                    maintainer=item.maintainer,
                    updated_at=item.updated_at.isoformat(),
                    summary=item.summary,
                )
                for item in versions
            ],
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
            self._custom_document_card(record)
            for record in self._custom_records(include_offline=True)
        ]

    def _custom_document_card(
        self,
        record: KnowledgeDocumentRecord,
    ) -> KnowledgeDocument:
        return KnowledgeDocument(
            document_id=record.id,
            title=record.title,
            source_type=record.source_type,
            path=record.path or "软件项目实践",
            tags=list(record.tags_json or []),
            chunk_count=max(1, len(record.content or "") // 500 + 1),
            status=record.status,
            source_url=record.source_url,
            maintainer=record.maintainer,
            version=record.version,
            updated_at=record.updated_at.isoformat(),
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
        for record in self._custom_records(include_offline=False):
            haystack = " ".join(
                [
                    record.title,
                    record.source_type,
                    record.path or "",
                    *list(record.tags_json or []),
                    record.content or "",
                ]
            ).lower()
            normalized_query = query.lower()
            exact_match = normalized_query in haystack
            term_match = any(term in haystack for term in query_terms)
            if not exact_match and not term_match:
                continue
            title_match = normalized_query in record.title.lower()
            results.append(
                KnowledgeSearchResult(
                    title=record.title,
                    source_type=record.source_type,
                    path=record.path or "软件项目实践",
                    snippet=(record.content or "")[:180],
                    score=1.4 if title_match else 1.2 if exact_match else 0.9,
                    tags=list(record.tags_json or []),
                )
            )
        return sorted(results, key=lambda result: result.score, reverse=True)[:limit]

    def _custom_records(self, include_offline: bool) -> list[KnowledgeDocumentRecord]:
        if self.db is None:
            return []
        statement = select(KnowledgeDocumentRecord).order_by(
            KnowledgeDocumentRecord.created_at.asc(),
            KnowledgeDocumentRecord.id.asc(),
        )
        if not include_offline:
            statement = statement.where(KnowledgeDocumentRecord.status == "已入库")
        return list(self.db.scalars(statement).all())

    def _find_custom_document(self, document_id: str) -> KnowledgeDocumentRecord:
        if self.db is None:
            raise ValueError(f"Knowledge document {document_id} not found or cannot be edited")
        record = self.db.get(KnowledgeDocumentRecord, document_id)
        if record is None:
            raise ValueError(f"Knowledge document {document_id} not found or cannot be edited")
        return record

    def _append_version(
        self,
        record: KnowledgeDocumentRecord,
        action: str,
        maintainer: str,
        summary: str,
    ) -> None:
        record.version += 1
        record.updated_at = datetime.utcnow()
        if self.db is not None:
            self.db.add(
                self._version_record(
                    document_id=record.id,
                    version=record.version,
                    action=action,
                    maintainer=maintainer,
                    summary=summary,
                )
            )
            self.db.commit()
            self.db.refresh(record)

    def _version_records(
        self,
        document_id: str,
    ) -> list[KnowledgeDocumentVersionRecord]:
        if self.db is None:
            return []
        statement = (
            select(KnowledgeDocumentVersionRecord)
            .where(KnowledgeDocumentVersionRecord.document_id == document_id)
            .order_by(KnowledgeDocumentVersionRecord.version.asc())
        )
        return list(self.db.scalars(statement).all())

    def _record_from_payload(
        self,
        document_id: str,
        payload: KnowledgeDocumentCreate,
    ) -> KnowledgeDocumentRecord:
        now = datetime.utcnow()
        return KnowledgeDocumentRecord(
            id=document_id,
            title=payload.title,
            source_type=payload.source_type,
            path=payload.path,
            tags_json=payload.tags,
            content=payload.content,
            source_url=payload.source_url,
            status="已入库",
            maintainer=payload.maintainer,
            version=1,
            created_at=now,
            updated_at=now,
        )

    def _version_record(
        self,
        document_id: str,
        version: int,
        action: str,
        maintainer: str,
        summary: str,
    ) -> KnowledgeDocumentVersionRecord:
        now = datetime.utcnow()
        return KnowledgeDocumentVersionRecord(
            id=f"{document_id}_v{version}",
            document_id=document_id,
            version=version,
            action=action,
            maintainer=maintainer,
            summary=summary,
            updated_at=now,
        )

    def _document_id(self, payload: KnowledgeDocumentCreate) -> str:
        raw = f"{payload.title}:{payload.source_type}:{payload.path}".encode("utf-8")
        return f"custom_doc_{sha1(raw).hexdigest()[:10]}"
