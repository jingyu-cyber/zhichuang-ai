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
