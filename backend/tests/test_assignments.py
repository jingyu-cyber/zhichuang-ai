from fastapi.testclient import TestClient

from app.main import app


def test_assignment_analysis_returns_report() -> None:
    client = TestClient(app)
    response = client.post(
        "/api/assignments/analyze",
        json={
            "assignment_title": "Flask Web 项目实践",
            "student_id": "student_001",
            "repository_url": "https://example.edu/demo/flask-project",
            "description": "示例作业包含 Flask 路由、SQLite 数据访问、README 和基础测试。",
            "files": [
                {
                    "path": "app.py",
                    "content": "from flask import Flask\napp = Flask(__name__)\n@app.route('/todos')\ndef todos(): return 'ok'",
                },
                {"path": "services/todo_service.py", "content": "import sqlite3"},
                {"path": "tests/test_app.py", "content": "def test_todos_page(): assert True"},
                {"path": "requirements.txt", "content": "flask\npytest"},
                {"path": "README.md", "content": "Flask Web 项目实践"},
            ],
        },
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["student_name"] == "林一舟"
    assert len(payload["scores"]) == 5
    assert payload["code_structure"]["file_count"] == 5
    assert "Flask" in payload["code_structure"]["detected_frameworks"]
    assert payload["code_structure"]["test_files"] == ["tests/test_app.py"]
    assert payload["code_structure"]["documentation_files"] == ["README.md"]
    assert payload["code_structure"]["risk_signals"] == []


def test_assignment_dashboard_returns_teacher_view() -> None:
    client = TestClient(app)
    response = client.get("/api/assignments/assignment_flask_mvp/dashboard")

    assert response.status_code == 200
    payload = response.json()
    assert payload["submitted_count"] == 5
    assert payload["total_students"] == 32
    assert len(payload["reports"]) == 5


def test_assignment_analysis_flags_missing_tests_from_uploaded_files() -> None:
    client = TestClient(app)
    response = client.post(
        "/api/assignments/analyze",
        json={
            "assignment_title": "Flask Web 项目实践",
            "student_id": "student_002",
            "files": [
                {
                    "path": "app.py",
                    "content": "from flask import Flask\napp = Flask(__name__)\n@app.route('/')\ndef index(): return 'ok'",
                },
                {"path": "README.md", "content": "启动方式：flask run"},
            ],
        },
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["code_structure"]["test_files"] == []
    assert payload["findings"][0]["severity"] == "high"
    assert payload["findings"][0]["title"] == "测试覆盖不足"
    assert "自动化测试" in payload["improvement_tasks"][0]
