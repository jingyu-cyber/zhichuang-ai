from io import BytesIO
from uuid import uuid4
from zipfile import ZipFile

from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.main import app
from app.schemas.assignments import AssignmentAnalysisRequest, CodeFile
from app.services.assignment_service import AssignmentService
from app.services.submission_archive_service import SubmissionArchiveService


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
    assert payload["evidence_snippets"]
    assert payload["evidence_snippets"][0]["path"] == "app.py"
    assert payload["evidence_snippets"][0]["line_start"] >= 1
    assert payload["evidence_snippets"][0]["snippet"]


def test_assignment_dashboard_returns_teacher_view() -> None:
    client = TestClient(app)
    response = client.get(
        "/api/assignments/assignment_flask_mvp/dashboard",
        headers={"Authorization": "Bearer demo-token-teacher_001"},
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["submitted_count"] >= 5
    assert payload["total_students"] == 32
    assert len(payload["reports"]) == payload["submitted_count"]
    assert payload["access_scope"] == "teacher:authorized_course_class"
    assert payload["class_profile"]["heatmap"]
    assert len(payload["class_profile"]["heatmap"]) == payload["submitted_count"] * 5
    assert payload["class_profile"]["direction_distribution"]
    assert payload["class_profile"]["data_coverage"]
    assert any(
        metric["label"] == "测试证据"
        for metric in payload["class_profile"]["data_coverage"]
    )
    assert payload["class_profile"]["common_weaknesses"]
    assert payload["anomalies"]
    assert payload["anomalies"][0]["title"]
    assert payload["anomalies"][0]["suggested_action"]
    assert len(payload["teaching_suggestions"]) >= 2
    for suggestion in payload["teaching_suggestions"]:
        assert suggestion["knowledge_point"]
        assert "份已分析提交" in suggestion["class_evidence"]
        assert "均分" in suggestion["class_evidence"]
        assert suggestion["suggested_activity"]
        assert suggestion["practice_task"]
        assert suggestion["expected_improvement"]


def test_teacher_can_create_assignment_and_upload_report_to_it() -> None:
    client = TestClient(app)
    teacher_header = {"Authorization": "Bearer demo-token-teacher_001"}
    assignment_id = f"assignment_test_agent_rag_{uuid4().hex[:8]}"

    create_response = client.post(
        "/api/assignments",
        json={
            "assignment_id": assignment_id,
            "title": "智能体 RAG 应用实践测试",
            "course_id": "course_web_2026",
            "class_id": "class_cs_2024_01",
            "description": "围绕 RAG 检索、引用展示、对话上下文和测试完成课程项目。",
            "rubric_id": "rubric_agent_rag",
        },
        headers=teacher_header,
    )
    upload_response = client.post(
        "/api/assignments/analyze",
        json={
            "assignment_id": assignment_id,
            "assignment_title": "智能体 RAG 应用实践测试",
            "course_id": "course_web_2026",
            "class_id": "class_cs_2024_01",
            "student_id": "student_agent_rag_001",
            "description": "学生提交了 FastAPI 接口、RAG 检索逻辑、测试和 README。",
            "files": [
                {
                    "path": "main.py",
                    "content": "from fastapi import FastAPI\napp = FastAPI()\n",
                },
                {"path": "rag.py", "content": "def retrieve(query): return []\n"},
                {"path": "tests/test_rag.py", "content": "def test_retrieve(): assert True\n"},
                {"path": "README.md", "content": "智能体 RAG 应用实践说明\n"},
            ],
        },
        headers=teacher_header,
    )
    list_response = client.get("/api/assignments", headers=teacher_header)
    dashboard_response = client.get(
        f"/api/assignments/{assignment_id}/dashboard",
        headers=teacher_header,
    )

    assert create_response.status_code == 200
    assert create_response.json()["assignment_id"] == assignment_id
    assert create_response.json()["submitted_count"] == 0
    assert upload_response.status_code == 200
    assert upload_response.json()["assignment_id"] == assignment_id
    assert any(
        item["assignment_id"] == assignment_id and item["submitted_count"] == 1
        for item in list_response.json()["assignments"]
    )
    assert dashboard_response.status_code == 200
    assert dashboard_response.json()["assignment_id"] == assignment_id
    assert dashboard_response.json()["assignment_title"] == "智能体 RAG 应用实践测试"
    assert any(
        report["student_id"] == "student_agent_rag_001"
        for report in dashboard_response.json()["reports"]
    )


def test_student_cannot_create_assignment() -> None:
    client = TestClient(app)
    response = client.post(
        "/api/assignments",
        json={
            "title": "学生尝试发布作业",
            "course_id": "course_web_2026",
            "class_id": "class_cs_2024_01",
        },
        headers={"Authorization": "Bearer demo-token-student_001"},
    )

    assert response.status_code == 403


def test_local_teacher_assignment_list_respects_course_scope() -> None:
    client = TestClient(app)
    admin_header = {"Authorization": "Bearer demo-token-admin_001"}
    client.post(
        "/api/academic/import",
        json={
            "courses": [
                {
                    "course_id": "course_scope_only_2026",
                    "name": "权限范围课程",
                    "teacher_id": "teacher_scope_only",
                    "teacher_name": "权限教师",
                }
            ],
            "classes": [
                {
                    "class_id": "class_scope_only_2024_01",
                    "course_id": "course_scope_only_2026",
                    "name": "2024 级权限范围 1 班",
                }
            ],
        },
        headers=admin_header,
    )
    teacher_session = client.post(
        "/api/auth/local-session",
        json={"user_id": "teacher_scope_only"},
    )
    teacher_header = {"Authorization": f"Bearer {teacher_session.json()['token']}"}
    create_response = client.post(
        "/api/assignments",
        json={
            "assignment_id": f"assignment_scope_only_{uuid4().hex[:8]}",
            "title": "权限范围内作业",
            "course_id": "course_scope_only_2026",
            "class_id": "class_scope_only_2024_01",
        },
        headers=teacher_header,
    )
    response = client.get("/api/assignments", headers=teacher_header)
    assignment_ids = {item["assignment_id"] for item in response.json()["assignments"]}

    assert create_response.status_code == 200
    assert create_response.json()["course_name"] == "权限范围课程"
    assert create_response.json()["class_name"] == "2024 级权限范围 1 班"
    assert create_response.json()["assignment_id"] in assignment_ids
    assert "assignment_flask_mvp" not in assignment_ids


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


def test_assignment_archive_upload_returns_report() -> None:
    client = TestClient(app)
    archive = _zip_bytes(
        {
            "src/main.py": (
                "from fastapi import FastAPI\n"
                "app = FastAPI()\n"
                "@app.get('/items')\n"
                "def items(): return []\n"
            ),
            "tests/test_main.py": "def test_items(): assert True\n",
            "README.md": "课程项目运行说明\n",
            "requirements.txt": "fastapi\npytest\n",
        }
    )

    response = client.post(
        "/api/assignments/upload-archive",
        data={
            "assignment_title": "FastAPI Zip 作业",
            "course_id": "course_web_2026",
            "class_id": "class_cs_2024_01",
            "student_id": "student_zip_001",
            "description": "学生上传 zip 压缩包，包含 FastAPI 接口、测试和 README。",
        },
        files={"archive": ("homework.zip", archive, "application/zip")},
        headers={"Authorization": "Bearer demo-token-teacher_001"},
    )
    report_response = client.get(
        "/api/assignments/assignment_flask_mvp/reports/student_zip_001",
        headers={"Authorization": "Bearer demo-token-teacher_001"},
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["assignment_title"] == "FastAPI Zip 作业"
    assert payload["student_id"] == "student_zip_001"
    assert payload["code_structure"]["file_count"] == 4
    assert "FastAPI" in payload["code_structure"]["detected_frameworks"]
    assert payload["code_structure"]["test_files"] == ["tests/test_main.py"]
    assert report_response.status_code == 200
    assert report_response.json()["report_id"] == payload["report_id"]


def test_assignment_archive_upload_rejects_invalid_zip() -> None:
    client = TestClient(app)
    response = client.post(
        "/api/assignments/upload-archive",
        data={
            "assignment_title": "无效压缩包",
            "student_id": "student_001",
        },
        files={"archive": ("homework.zip", b"not a zip", "application/zip")},
        headers={"Authorization": "Bearer demo-token-teacher_001"},
    )

    assert response.status_code == 400
    assert "有效的 zip" in response.json()["detail"]


def test_student_cannot_upload_archive_for_other_student() -> None:
    client = TestClient(app)
    response = client.post(
        "/api/assignments/upload-archive",
        data={
            "assignment_title": "越权上传",
            "student_id": "student_002",
        },
        files={
            "archive": (
                "homework.zip",
                _zip_bytes({"app.py": "from flask import Flask\napp = Flask(__name__)\n"}),
                "application/zip",
            )
        },
        headers={"Authorization": "Bearer demo-token-student_001"},
    )

    assert response.status_code == 403


def test_submission_archive_parser_skips_unsafe_paths() -> None:
    files = SubmissionArchiveService().parse_zip(
        _zip_bytes(
            {
                "../secret.py": "print('skip')",
                "/absolute.py": "print('skip')",
                "node_modules/pkg/index.js": "console.log('skip')",
                "src/app.py": "from flask import Flask\napp = Flask(__name__)\n",
            }
        )
    )

    assert [file.path for file in files] == ["src/app.py"]


def test_student_can_only_access_own_assignment_report() -> None:
    client = TestClient(app)
    own_response = client.get(
        "/api/assignments/assignment_flask_mvp/reports/student_001",
        headers={"Authorization": "Bearer demo-token-student_001"},
    )
    other_response = client.get(
        "/api/assignments/assignment_flask_mvp/reports/student_002",
        headers={"Authorization": "Bearer demo-token-student_001"},
    )

    assert own_response.status_code == 200
    assert own_response.json()["access_scope"] == "student:self"
    assert other_response.status_code == 403


def test_student_cannot_access_assignment_dashboard() -> None:
    client = TestClient(app)
    response = client.get(
        "/api/assignments/assignment_flask_mvp/dashboard",
        headers={"Authorization": "Bearer demo-token-student_001"},
    )

    assert response.status_code == 403


def test_assignment_report_persists_in_sqlite_session(tmp_path) -> None:
    engine = create_engine(
        f"sqlite:///{tmp_path / 'assignments.db'}",
        connect_args={"check_same_thread": False},
    )
    SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)

    with SessionLocal() as first_session:
        created = AssignmentService(first_session).analyze(
            AssignmentAnalysisRequest(
                assignment_title="FastAPI 课程项目分析",
                course_id="course_web_2026",
                class_id="class_cs_2024_01",
                student_id="student_009",
                repository_url="https://example.edu/demo/fastapi-project",
                description="学生提交了 FastAPI 接口、SQLAlchemy 数据访问、测试和 README。",
                files=[
                    CodeFile(
                        path="main.py",
                        content=(
                            "from fastapi import FastAPI\n"
                            "from sqlalchemy import select\n"
                            "app = FastAPI()\n"
                            "@app.get('/tasks')\n"
                            "def tasks(): return []\n"
                        ),
                    ),
                    CodeFile(path="tests/test_main.py", content="def test_tasks(): assert True"),
                    CodeFile(path="README.md", content="FastAPI 课程项目运行说明"),
                ],
            )
        )

    with SessionLocal() as second_session:
        service = AssignmentService(second_session)
        persisted = service.get_report(
            "assignment_flask_mvp",
            "student_009",
        )
        dashboard = service.get_dashboard("assignment_flask_mvp")

    assert persisted.report_id == created.report_id
    assert persisted.assignment_title == "FastAPI 课程项目分析"
    assert persisted.student_id == "student_009"
    assert persisted.code_structure.test_files == ["tests/test_main.py"]
    assert "FastAPI" in persisted.code_structure.detected_frameworks
    assert persisted.evidence_snippets[0].path == "main.py"
    assert any(report.student_id == "student_009" for report in dashboard.reports)
    assert dashboard.submitted_count == 6


def _zip_bytes(files: dict[str, str]) -> bytes:
    buffer = BytesIO()
    with ZipFile(buffer, "w") as archive:
        for path, content in files.items():
            archive.writestr(path, content)
    return buffer.getvalue()
