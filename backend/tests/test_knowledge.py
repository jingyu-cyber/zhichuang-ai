from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.main import app
from app.schemas.knowledge import KnowledgeDocumentCreate
from app.services.knowledge_service import KnowledgeService


def test_knowledge_documents_and_search() -> None:
    client = TestClient(app)
    documents_response = client.get("/api/knowledge/documents")
    search_response = client.get("/api/knowledge/search", params={"q": "作业 Rubric"})

    assert documents_response.status_code == 200
    assert search_response.status_code == 200
    documents = documents_response.json()["documents"]
    assert documents_response.json()["total"] >= 25
    assert len([item for item in documents if item["source_type"] == "course_material"]) >= 5
    assert len([item for item in documents if item["source_type"] == "competition_material"]) >= 10
    assert len([item for item in documents if item["source_type"] == "project_case"]) >= 10
    assert search_response.json()["total"] >= 1
    assert search_response.json()["results"][0]["title"]


def test_knowledge_search_returns_empty_when_no_chunk_matches() -> None:
    client = TestClient(app)
    response = client.get("/api/knowledge/search", params={"q": "火星农业灌溉系统"})

    assert response.status_code == 200
    payload = response.json()
    assert payload["total"] == 0
    assert payload["results"] == []


def test_create_knowledge_document_is_listed_and_searchable() -> None:
    client = TestClient(app)
    create_response = client.post(
        "/api/knowledge/documents",
        headers={"Authorization": "Bearer demo-token-admin_001"},
        json={
            "title": "课程项目复盘模板",
            "source_type": "project_case",
            "path": "软件项目实践",
            "tags": ["复盘", "项目文档"],
            "content": "课程项目复盘需要记录目标、完成情况、阻塞问题、下周任务和证据链接。",
            "source_url": "https://example.edu/templates/review",
        },
    )
    documents_response = client.get("/api/knowledge/documents")
    search_response = client.get("/api/knowledge/search", params={"q": "课程项目复盘"})

    assert create_response.status_code == 200
    assert create_response.json()["searchable"] is True
    assert create_response.json()["document"]["document_id"].startswith("custom_doc_")
    assert create_response.json()["document"]["maintainer"] == "平台管理员"
    assert create_response.json()["document"]["version"] == 1
    assert create_response.json()["document"]["source_url"]
    assert any(
        item["title"] == "课程项目复盘模板"
        for item in documents_response.json()["documents"]
    )
    assert any(
        item["title"] == "课程项目复盘模板"
        for item in search_response.json()["results"]
    )


def test_knowledge_document_update_status_and_versions() -> None:
    client = TestClient(app)
    create_response = client.post(
        "/api/knowledge/documents",
        headers={"Authorization": "Bearer demo-token-admin_001"},
        json={
            "title": "软件项目实践资料",
            "source_type": "course_material",
            "path": "软件项目实践",
            "tags": ["项目", "实践"],
            "content": "软件项目实践资料包含需求、设计、测试和部署。",
            "maintainer": "平台管理员",
        },
    )
    document_id = create_response.json()["document"]["document_id"]

    update_response = client.put(
        f"/api/knowledge/documents/{document_id}",
        headers={"Authorization": "Bearer demo-token-admin_001"},
        json={
            "title": "软件项目实践资料 v2",
            "tags": ["项目", "实践", "版本"],
            "content": "软件项目实践资料 v2 增加版本记录、维护人和最近更新时间。",
            "maintainer": "平台管理员",
        },
    )
    search_response = client.get("/api/knowledge/search", params={"q": "版本记录"})
    versions_response = client.get(f"/api/knowledge/documents/{document_id}/versions")
    status_response = client.patch(
        f"/api/knowledge/documents/{document_id}/status",
        headers={"Authorization": "Bearer demo-token-admin_001"},
        json={"status": "已下线", "maintainer": "平台管理员"},
    )
    offline_search_response = client.get("/api/knowledge/search", params={"q": "版本记录"})

    assert update_response.status_code == 200
    assert update_response.json()["document"]["version"] == 2
    assert update_response.json()["document"]["updated_at"]
    assert any(
        item["title"] == "软件项目实践资料 v2"
        for item in search_response.json()["results"]
    )
    assert versions_response.status_code == 200
    assert [item["action"] for item in versions_response.json()["versions"]] == [
        "create",
        "update",
    ]
    assert status_response.status_code == 200
    assert status_response.json()["document"]["status"] == "已下线"
    assert status_response.json()["document"]["version"] == 3
    assert not any(
        item["title"] == "软件项目实践资料 v2"
        for item in offline_search_response.json()["results"]
    )


def test_knowledge_search_prioritizes_exact_custom_document() -> None:
    client = TestClient(app)
    admin_header = {"Authorization": "Bearer demo-token-admin_001"}
    for index in range(6):
        client.post(
            "/api/knowledge/documents",
            headers=admin_header,
            json={
                "title": f"Smoke 课程项目复盘模板历史资料 {index}",
                "source_type": "project_case",
                "path": "软件项目实践",
                "tags": ["复盘", "项目文档"],
                "content": "Smoke 课程项目复盘模板历史资料用于验证搜索候选很多时不应截断精确结果。",
            },
        )
    target_response = client.post(
        "/api/knowledge/documents",
        headers=admin_header,
        json={
            "title": "Smoke 课程项目复盘模板",
            "source_type": "project_case",
            "path": "软件项目实践",
            "tags": ["复盘", "项目文档"],
            "content": "Smoke 课程项目复盘模板需要记录目标、完成情况、阻塞问题和下周任务。",
        },
    )
    search_response = client.get(
        "/api/knowledge/search",
        params={"q": "Smoke 课程项目复盘模板"},
    )

    assert target_response.status_code == 200
    assert any(
        item["title"] == "Smoke 课程项目复盘模板"
        for item in search_response.json()["results"]
    )


def test_only_admin_can_maintain_knowledge_documents() -> None:
    client = TestClient(app)
    student_response = client.post(
        "/api/knowledge/documents",
        headers={"Authorization": "Bearer demo-token-student_001"},
        json={
            "title": "学生尝试维护资料",
            "content": "学生账号不能维护知识库资料。",
        },
    )

    assert student_response.status_code == 403


def test_knowledge_document_persists_in_sqlite_session(tmp_path) -> None:
    engine = create_engine(
        f"sqlite:///{tmp_path / 'knowledge.db'}",
        connect_args={"check_same_thread": False},
    )
    SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)

    with SessionLocal() as first_session:
        created = KnowledgeService(first_session).create_document(
            KnowledgeDocumentCreate(
                title="SQLite 持久化知识库资料",
                source_type="project_case",
                path="软件项目实践",
                tags=["SQLite", "持久化"],
                content="SQLite 持久化知识库资料用于验证管理员维护资料可以跨服务实例读取。",
                maintainer="平台管理员",
            )
        )

    with SessionLocal() as second_session:
        service = KnowledgeService(second_session)
        documents = service.list_documents()
        search = service.search("SQLite 持久化")
        versions = service.list_versions(created.document.document_id)

    assert any(
        item.document_id == created.document.document_id
        for item in documents.documents
    )
    assert any(item.title == "SQLite 持久化知识库资料" for item in search.results)
    assert [item.action for item in versions.versions] == ["create"]
