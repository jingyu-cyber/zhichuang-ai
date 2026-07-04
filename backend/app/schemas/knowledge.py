from __future__ import annotations

from pydantic import BaseModel, Field


class KnowledgeDocument(BaseModel):
    document_id: str
    title: str
    source_type: str
    path: str
    tags: list[str] = Field(default_factory=list)
    chunk_count: int
    status: str
    source_url: str | None = None
    maintainer: str = "平台管理员"
    version: int = 1
    updated_at: str


class KnowledgeDocumentCreate(BaseModel):
    title: str
    source_type: str = "course_material"
    path: str = "软件项目实践"
    tags: list[str] = Field(default_factory=list)
    content: str
    source_url: str | None = None
    maintainer: str = "平台管理员"


class KnowledgeDocumentUpdate(BaseModel):
    title: str | None = None
    source_type: str | None = None
    path: str | None = None
    tags: list[str] | None = None
    content: str | None = None
    source_url: str | None = None
    maintainer: str = "平台管理员"


class KnowledgeDocumentStatusUpdate(BaseModel):
    status: str = "已下线"
    maintainer: str = "平台管理员"


class KnowledgeDocumentUpsertResponse(BaseModel):
    document: KnowledgeDocument
    searchable: bool
    message: str


class KnowledgeDocumentVersion(BaseModel):
    version: int
    action: str
    maintainer: str
    updated_at: str
    summary: str


class KnowledgeDocumentVersionsResponse(BaseModel):
    document_id: str
    versions: list[KnowledgeDocumentVersion]


class KnowledgeSearchResult(BaseModel):
    title: str
    source_type: str
    path: str
    snippet: str
    score: float
    tags: list[str] = Field(default_factory=list)


class KnowledgeSearchResponse(BaseModel):
    query: str
    total: int
    results: list[KnowledgeSearchResult]


class KnowledgeDocumentsResponse(BaseModel):
    total: int
    documents: list[KnowledgeDocument]
