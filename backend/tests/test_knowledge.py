from fastapi.testclient import TestClient

from app.main import app


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
    assert any(
        item["title"] == "课程项目复盘模板"
        for item in documents_response.json()["documents"]
    )
    assert any(
        item["title"] == "课程项目复盘模板"
        for item in search_response.json()["results"]
    )
