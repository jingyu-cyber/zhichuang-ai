#!/usr/bin/env python3
from __future__ import annotations

import json
import os
import re
import sys
import urllib.error
import urllib.parse
import urllib.request
import uuid
import zipfile
from dataclasses import dataclass
from io import BytesIO
from pathlib import Path
from typing import Any


@dataclass
class SmokeClient:
    api_base: str
    web_base: str

    def get_json(self, path: str, headers: dict[str, str] | None = None) -> Any:
        return self.request_json("GET", path, headers=headers)

    def post_json(
        self,
        path: str,
        payload: dict[str, Any],
        headers: dict[str, str] | None = None,
    ) -> Any:
        return self.request_json("POST", path, payload=payload, headers=headers)

    def request_json(
        self,
        method: str,
        path: str,
        payload: dict[str, Any] | None = None,
        headers: dict[str, str] | None = None,
    ) -> Any:
        url = f"{self.api_base.rstrip('/')}/{path.lstrip('/')}"
        body = None if payload is None else json.dumps(payload).encode("utf-8")
        request_headers = {"Content-Type": "application/json", **(headers or {})}
        request = urllib.request.Request(url, data=body, method=method, headers=request_headers)
        try:
            with urllib.request.urlopen(request, timeout=10) as response:
                return json.loads(response.read().decode("utf-8"))
        except urllib.error.HTTPError as error:
            detail = error.read().decode("utf-8", errors="replace")
            raise AssertionError(f"{method} {path} failed with {error.code}: {detail}") from error

    def post_multipart(
        self,
        path: str,
        fields: dict[str, str],
        files: dict[str, tuple[str, bytes, str]],
        headers: dict[str, str] | None = None,
    ) -> Any:
        boundary = f"----zhichuang-smoke-{uuid.uuid4().hex}"
        body = self._multipart_body(boundary, fields, files)
        request_headers = {
            "Content-Type": f"multipart/form-data; boundary={boundary}",
            **(headers or {}),
        }
        request = urllib.request.Request(
            f"{self.api_base.rstrip('/')}/{path.lstrip('/')}",
            data=body,
            method="POST",
            headers=request_headers,
        )
        try:
            with urllib.request.urlopen(request, timeout=10) as response:
                return json.loads(response.read().decode("utf-8"))
        except urllib.error.HTTPError as error:
            detail = error.read().decode("utf-8", errors="replace")
            raise AssertionError(f"POST {path} failed with {error.code}: {detail}") from error

    def _multipart_body(
        self,
        boundary: str,
        fields: dict[str, str],
        files: dict[str, tuple[str, bytes, str]],
    ) -> bytes:
        chunks: list[bytes] = []
        for name, value in fields.items():
            chunks.extend(
                [
                    f"--{boundary}\r\n".encode("utf-8"),
                    f'Content-Disposition: form-data; name="{name}"\r\n\r\n'.encode("utf-8"),
                    value.encode("utf-8"),
                    b"\r\n",
                ]
            )
        for name, (filename, content, content_type) in files.items():
            chunks.extend(
                [
                    f"--{boundary}\r\n".encode("utf-8"),
                    (
                        f'Content-Disposition: form-data; name="{name}"; '
                        f'filename="{filename}"\r\n'
                    ).encode("utf-8"),
                    f"Content-Type: {content_type}\r\n\r\n".encode("utf-8"),
                    content,
                    b"\r\n",
                ]
            )
        chunks.append(f"--{boundary}--\r\n".encode("utf-8"))
        return b"".join(chunks)

    def expect_forbidden(
        self,
        method: str,
        path: str,
        payload: dict[str, Any] | None = None,
        headers: dict[str, str] | None = None,
    ) -> None:
        url = f"{self.api_base.rstrip('/')}/{path.lstrip('/')}"
        body = None if payload is None else json.dumps(payload).encode("utf-8")
        request_headers = {"Content-Type": "application/json", **(headers or {})}
        request = urllib.request.Request(url, data=body, method=method, headers=request_headers)
        try:
            urllib.request.urlopen(request, timeout=10)
        except urllib.error.HTTPError as error:
            if error.code == 403:
                return
            raise AssertionError(f"{method} {path} expected 403, got {error.code}") from error
        raise AssertionError(f"{method} {path} expected 403, got success")

    def get_text(self, url: str) -> str:
        with urllib.request.urlopen(url, timeout=10) as response:
            return response.read().decode("utf-8", errors="replace")


def assert_true(condition: bool, message: str) -> None:
    if not condition:
        raise AssertionError(message)


def zip_bytes(files: dict[str, str]) -> bytes:
    buffer = BytesIO()
    with zipfile.ZipFile(buffer, "w") as archive:
        for path, content in files.items():
            archive.writestr(path, content)
    return buffer.getvalue()


def load_school_identity_secret() -> str:
    env_secret = os.environ.get("SCHOOL_IDENTITY_SHARED_SECRET")
    if env_secret:
        return env_secret

    env_path = Path(__file__).resolve().parents[1] / ".env"
    if env_path.exists():
        for line in env_path.read_text(encoding="utf-8").splitlines():
            stripped = line.strip()
            if not stripped or stripped.startswith("#") or "=" not in stripped:
                continue
            key, value = stripped.split("=", 1)
            if key.strip() == "SCHOOL_IDENTITY_SHARED_SECRET":
                return value.strip().strip('"').strip("'")

    return "dev-school-identity-secret"


def collect_frontend_text(client: SmokeClient, web: str) -> str:
    assets = [web]
    for match in re.findall(r'''(?:src|href)=["']([^"']+)["']''', web):
        if not (match.endswith(".js") or match.endswith(".css") or match.startswith("/src/")):
            continue
        asset_url = urllib.parse.urljoin(client.web_base.rstrip("/") + "/", match)
        try:
            assets.append(client.get_text(asset_url))
        except Exception:
            continue

    frontend_source = Path(__file__).resolve().parents[1] / "frontend" / "src" / "pages" / "Dashboard.tsx"
    if frontend_source.exists():
        assets.append(frontend_source.read_text(encoding="utf-8"))

    return "\n".join(assets)


def main() -> int:
    api_base = sys.argv[1] if len(sys.argv) > 1 else "http://localhost:8000/api"
    web_base = sys.argv[2] if len(sys.argv) > 2 else "http://localhost:5173"
    school_identity_secret = load_school_identity_secret()
    client = SmokeClient(api_base=api_base, web_base=web_base)

    health = client.get_json("/health")
    assert_true(health["status"] == "ok", "health check did not return ok")

    accounts = client.get_json("/auth/demo-accounts")["accounts"]
    roles = {account["role"] for account in accounts}
    assert_true({"student", "teacher", "admin"}.issubset(roles), "demo accounts missing roles")

    teacher_session = client.post_json("/auth/demo-session", {"user_id": "teacher_001"})
    teacher_token = teacher_session["token"]
    teacher_header = {"Authorization": f"Bearer {teacher_token}"}

    student_session = client.post_json("/auth/demo-session", {"user_id": "student_001"})
    student_header = {"Authorization": f"Bearer {student_session['token']}"}

    admin_session = client.post_json("/auth/demo-session", {"user_id": "admin_001"})
    admin_header = {"Authorization": f"Bearer {admin_session['token']}"}

    dashboard = client.get_json(
        "/assignments/assignment_flask_mvp/dashboard",
        headers=teacher_header,
    )
    assert_true(dashboard["submitted_count"] >= 1, "assignment dashboard has no submissions")
    assert_true(dashboard["teaching_suggestions"], "teaching suggestions missing")
    assert_true(dashboard["class_profile"]["heatmap"], "class ability heatmap missing")
    assert_true(dashboard["class_profile"]["data_coverage"], "class data coverage missing")
    assert_true(dashboard["anomalies"], "assignment anomalies missing")
    exported_dashboard = client.get_json(
        "/assignments/assignment_flask_mvp/export",
        headers=teacher_header,
    )
    assert_true(
        exported_dashboard["filename"].endswith(".md"),
        "assignment dashboard export filename invalid",
    )
    assert_true(
        "教学改进建议" in exported_dashboard["markdown"],
        "assignment dashboard export missing teaching suggestions",
    )
    client.expect_forbidden(
        "GET",
        "/assignments/assignment_flask_mvp/export",
        headers=student_header,
    )

    created_assignment = client.post_json(
        "/assignments",
        {
            "assignment_id": "assignment_smoke_agent_rag",
            "title": "Smoke 智能体 RAG 应用实践",
            "course_id": "course_web_2026",
            "class_id": "class_cs_2024_01",
            "description": "Smoke 发布课程项目，用于验证教师端项目列表与看板切换。",
            "rubric_id": "rubric_smoke_agent_rag",
        },
        headers=teacher_header,
    )
    assignment_list = client.get_json("/assignments", headers=teacher_header)["assignments"]
    assert_true(
        created_assignment["assignment_id"] == "assignment_smoke_agent_rag",
        "assignment create failed",
    )
    assert_true(
        any(item["assignment_id"] == "assignment_smoke_agent_rag" for item in assignment_list),
        "created assignment not listed",
    )

    client.expect_forbidden(
        "GET",
        "/assignments/assignment_flask_mvp/dashboard",
        headers=student_header,
    )

    report = client.get_json(
        "/assignments/assignment_flask_mvp/reports/student_001",
        headers=student_header,
    )
    student_assignments = client.get_json("/assignments", headers=student_header)["assignments"]
    assert_true(report["student_id"] == "student_001", "student report access failed")
    assert_true(
        any(item["assignment_id"] == "assignment_flask_mvp" for item in student_assignments),
        "student assignment list missing own report",
    )
    assert_true(report["code_structure"]["file_count"] >= 1, "code structure summary missing")
    assert_true(report["evidence_snippets"], "code evidence snippets missing")
    assert_true(
        [step["node"] for step in report["analysis_trace"]]
        == [
            "parse_files",
            "summarize_structure",
            "review_quality",
            "extract_capability_evidence",
            "generate_report",
        ],
        "analysis trace missing graph nodes",
    )

    uploaded_report = client.post_multipart(
        "/assignments/upload-archive",
        {
            "assignment_id": "assignment_smoke_agent_rag",
            "assignment_title": "Smoke Zip 项目",
            "course_id": "course_web_2026",
            "class_id": "class_cs_2024_01",
            "student_id": "student_smoke_zip_001",
            "description": "Smoke zip 上传包含 FastAPI 接口、测试和 README。",
        },
        {
            "archive": (
                "homework.zip",
                zip_bytes(
                    {
                        "main.py": "from fastapi import FastAPI\napp = FastAPI()\n",
                        "tests/test_main.py": "def test_home(): assert True\n",
                        "README.md": "Smoke zip 项目说明\n",
                    }
                ),
                "application/zip",
            )
        },
        headers=teacher_header,
    )
    assert_true(uploaded_report["student_id"] == "student_smoke_zip_001", "zip upload failed")
    assert_true(
        uploaded_report["assignment_id"] == "assignment_smoke_agent_rag",
        "zip upload did not attach to assignment",
    )
    assert_true(
        "FastAPI" in uploaded_report["code_structure"]["detected_frameworks"],
        "zip upload did not analyze code files",
    )
    uploaded_agent_task = client.get_json(
        f"/tasks/{uploaded_report['agent_task_id']}",
        headers=teacher_header,
    )
    assert_true(
        uploaded_agent_task["status"] == "succeeded",
        "uploaded assignment agent task did not finish",
    )
    assert_true(
        uploaded_agent_task["result_ref"] == uploaded_report["report_id"],
        "uploaded assignment agent task missing report ref",
    )
    repository_style_report = client.post_json(
        "/assignments/analyze",
        {
            "assignment_id": "assignment_smoke_agent_rag",
            "assignment_title": "Smoke 仓库链接项目",
            "course_id": "course_web_2026",
            "class_id": "class_cs_2024_01",
            "student_id": "student_smoke_repo_001",
            "repository_url": "https://github.com/example/course-homework.git",
            "description": "Smoke 使用仓库链接字段提交，同时传入文件列表以避免冒烟测试依赖外部网络。",
            "files": [
                {
                    "path": "src/main.py",
                    "content": "from fastapi import FastAPI\napp = FastAPI()\n@app.get('/items')\ndef items(): return []\n",
                },
                {"path": "tests/test_main.py", "content": "def test_items(): assert True\n"},
                {"path": "README.md", "content": "Smoke 仓库链接项目说明\n"},
            ],
        },
        headers=teacher_header,
    )
    assert_true(
        repository_style_report["student_id"] == "student_smoke_repo_001",
        "repository-style assignment analysis failed",
    )
    assert_true(
        "FastAPI" in repository_style_report["code_structure"]["detected_frameworks"],
        "repository-style assignment did not analyze code files",
    )
    created_dashboard = client.get_json(
        "/assignments/assignment_smoke_agent_rag/dashboard",
        headers=teacher_header,
    )
    assert_true(
        any(report["student_id"] == "student_smoke_zip_001" for report in created_dashboard["reports"]),
        "created assignment dashboard missing uploaded report",
    )
    assert_true(
        any(
            report["student_id"] == "student_smoke_repo_001"
            for report in created_dashboard["reports"]
        ),
        "created assignment dashboard missing repository-style report",
    )

    profile = client.get_json("/students/student_001/profile")
    own_profile = client.get_json("/students/student_001/profile", headers=student_header)
    assert_true(len(profile["dimensions"]) >= 4, "growth profile dimensions missing")
    assert_true(own_profile["student_id"] == "student_001", "student token profile access failed")
    client.expect_forbidden("GET", "/students/student_002/profile", headers=student_header)
    assert_true(
        any(
            item["source_type"] == "assignment_report"
            for dimension in profile["dimensions"]
            for item in dimension["evidence_items"]
        ),
        "assignment report evidence not synced to profile",
    )

    plan = client.post_json("/plans/generate", {"student_id": "student_001", "weeks": 4})
    assert_true(len(plan["tasks"]) == 4, "learning plan did not honor weeks")
    client.expect_forbidden(
        "POST",
        "/plans/generate",
        {"student_id": "student_002", "weeks": 4},
        headers=student_header,
    )

    competitions = client.post_json(
        "/competitions/recommend",
        {"student_id": "student_001", "target": "AI 应用开发"},
    )
    assert_true(competitions["recommendations"], "competition recommendations missing")
    assert_true(
        all(item["fit_reasons"] and item["gap_abilities"] for item in competitions["recommendations"]),
        "competition recommendation explanations missing",
    )
    preparation = client.post_json(
        "/competitions/preparation-plan",
        {
            "student_id": "student_001",
            "competition_name": "中国大学生计算机设计大赛",
            "weeks": 4,
            "weekly_hours": 8,
        },
    )
    assert_true(len(preparation["milestones"]) == 4, "competition preparation milestones missing")
    assert_true(preparation["official_url"], "competition preparation official url missing")
    assert_true(preparation["citations"], "competition preparation citations missing")

    candidate_screen = client.post_json(
        "/teacher/candidate-screening",
        {"target_name": "中国大学生计算机设计大赛"},
        headers=teacher_header,
    )
    assert_true(candidate_screen["candidates"], "teacher candidate screening missing candidates")
    client.expect_forbidden(
        "POST",
        "/teacher/candidate-screening",
        {"target_name": "中国大学生计算机设计大赛"},
        headers=student_header,
    )

    team_status = client.get_json("/students/student_001/team-status")
    own_team_status = client.get_json("/students/student_001/team-status", headers=student_header)
    assert_true(team_status["contact_visible"] is False, "team contact visibility should be hidden")
    assert_true(own_team_status["student_id"] == "student_001", "student token team status failed")
    client.expect_forbidden(
        "PATCH",
        "/students/student_002/team-status",
        {"team_status_enabled": False},
        headers=student_header,
    )
    team = client.post_json(
        "/teams/recommend",
        {"student_id": "student_001", "project_goal": "项目代码分析 Demo"},
    )
    assert_true(team["candidates"], "team recommendations missing")
    assert_true(
        team["candidates"][0]["skill_complement_graph"],
        "team skill complement graph missing",
    )
    assert_true(
        team["candidates"][0]["suggested_questions"],
        "team suggested questions missing",
    )

    task = client.post_json("/tasks", {"title": "Smoke 测试任务"})
    assert_true(task["title"] == "Smoke 测试任务", "task save failed")
    own_tasks = client.get_json("/students/student_001/tasks", headers=student_header)
    assert_true(own_tasks["student_id"] == "student_001", "student token tasks access failed")
    client.expect_forbidden("GET", "/students/student_002/tasks", headers=student_header)
    review = client.post_json(
        "/reviews/generate",
        {"student_id": "student_001", "period": "本周", "completed_task_ids": [task["task_id"]]},
    )
    assert_true(review["next_tasks"], "task review next actions missing")
    agent_task = client.post_json(
        "/agent-tasks",
        {
            "task_type": "assignment_analysis",
            "owner_id": "student_001",
            "input": {"assignment_id": "assignment_flask_mvp"},
        },
        headers=student_header,
    )
    agent_task_status = client.get_json(f"/tasks/{agent_task['task_id']}", headers=student_header)
    cancelled_agent_task = client.post_json(
        f"/tasks/{agent_task['task_id']}/cancel",
        {},
        headers=student_header,
    )
    assert_true(agent_task_status["status"] == "pending", "agent task status missing")
    assert_true(
        cancelled_agent_task["task"]["status"] == "cancelled",
        "agent task cancel failed",
    )

    documents = client.get_json("/knowledge/documents")
    assert_true(documents["total"] >= 25, "knowledge documents below seed expectation")
    created_doc = client.post_json(
        "/knowledge/documents",
        {
            "title": "Smoke 课程项目复盘模板",
            "source_type": "project_case",
            "path": "软件项目实践",
            "tags": ["复盘", "项目文档"],
            "content": "Smoke 课程项目复盘需要记录目标、完成情况、阻塞问题和下周任务。",
        },
        headers=admin_header,
    )
    assert_true(created_doc["searchable"] is True, "created knowledge document is not searchable")
    document_id = created_doc["document"]["document_id"]
    search_query = urllib.parse.quote("Smoke 课程项目复盘模板")
    search = client.get_json(f"/knowledge/search?q={search_query}")
    assert_true(
        any(item["title"] == "Smoke 课程项目复盘模板" for item in search["results"]),
        "created knowledge document not found by search",
    )
    updated_doc = client.request_json(
        "PUT",
        f"/knowledge/documents/{document_id}",
        {
            "title": "Smoke 课程项目复盘模板 v2",
            "content": "Smoke 课程项目复盘模板 v2 增加维护人、版本和下线记录。",
            "tags": ["复盘", "项目文档", "版本"],
            "maintainer": "平台管理员",
        },
        headers=admin_header,
    )
    assert_true(updated_doc["document"]["version"] == 2, "knowledge document version not updated")
    versions = client.get_json(f"/knowledge/documents/{document_id}/versions")
    assert_true(len(versions["versions"]) >= 2, "knowledge document versions missing")
    offline_doc = client.request_json(
        "PATCH",
        f"/knowledge/documents/{document_id}/status",
        {"status": "已下线", "maintainer": "平台管理员"},
        headers=admin_header,
    )
    assert_true(offline_doc["document"]["status"] == "已下线", "knowledge document offline failed")
    client.expect_forbidden(
        "POST",
        "/knowledge/documents",
        {"title": "学生维护资料", "content": "学生不能维护资料。"},
        headers=student_header,
    )

    agent = client.post_json(
        "/agent/chat",
        {"message": "如何准备算法竞赛？", "scenario": "student", "session_id": "smoke_session"},
    )
    assert_true(agent["citations"], "agent answer missing citations")
    assert_true(agent["retrieval_status"] == "matched", "agent retrieval did not match")

    evaluations = client.get_json("/evaluations/dashboard")
    assert_true(evaluations["cases"], "evaluation cases missing")
    assert_true(evaluations["records"], "evaluation records missing")
    eval_case = client.post_json(
        "/evaluations/cases",
        {
            "scenario": "竞赛准备计划",
            "input_question": "为中国大学生计算机设计大赛生成 4 周准备计划",
            "expected_focus": ["时间节点", "官方依据", "交付物"],
            "priority": "P0",
            "status": "已记录",
        },
        headers=admin_header,
    )
    eval_record = client.post_json(
        "/evaluations/records",
        {
            "case_id": eval_case["item_id"],
            "scenario": "竞赛准备计划",
            "input_question": "为中国大学生计算机设计大赛生成 4 周准备计划",
            "system_output": "系统生成 4 周准备计划，包含报名节点和作品交付物。",
            "manual_score": 88,
            "issue_notes": "计划结构完整，引用依据明确。",
            "reviewer": "项目评测组",
        },
        headers=admin_header,
    )
    assert_true(eval_case["item_id"], "evaluation case create failed")
    assert_true(eval_record["item_id"], "evaluation record create failed")
    evaluation_export = client.get_json("/evaluations/export", headers=admin_header)
    assert_true(
        evaluation_export["filename"].endswith(".md"),
        "evaluation export filename invalid",
    )
    assert_true(
        "## 测试案例" in evaluation_export["markdown"],
        "evaluation export missing cases",
    )
    assert_true(
        "## 输出记录" in evaluation_export["markdown"],
        "evaluation export missing records",
    )
    client.expect_forbidden(
        "POST",
        "/evaluations/cases",
        {"scenario": "学生尝试维护评测"},
        headers=student_header,
    )
    client.expect_forbidden(
        "GET",
        "/evaluations/export",
        headers=student_header,
    )

    courses = client.get_json("/courses")
    assert_true(courses["courses"], "courses missing")
    import_payload = {
        "courses": [
            {
                "course_id": "course_smoke_ai_2026",
                "name": "Smoke AI 应用开发",
                "term": "2025-2026 春季学期",
                "teacher_id": "teacher_smoke_001",
                "teacher_name": "Smoke 教师",
                "teacher_no": "TSMOKE001",
                "description": "Smoke 导入课程，用于验证教务基础数据写入。",
            },
            {
                "course_id": "course_web_2026",
                "name": "Web 应用开发",
                "term": "2025-2026 春季学期",
                "teacher_id": "teacher_smoke_001",
                "teacher_name": "Smoke 教师",
                "teacher_no": "TSMOKE001",
                "description": "围绕 Flask、前端页面、数据库访问和项目文档完成 Web 项目实践。",
            }
        ],
        "classes": [
            {
                "class_id": "class_smoke_ai_2024_01",
                "course_id": "course_smoke_ai_2026",
                "name": "Smoke AI 1 班",
                "grade": "2024",
                "major": "人工智能",
            }
        ],
        "students": [
            {
                "student_id": "student_smoke_001",
                "name": "Smoke 学生",
                "student_no": "SMOKE2026001",
                "class_id": "class_smoke_ai_2024_01",
                "target_path": "AI 应用开发",
                "tags": ["RAG", "项目实践"],
            }
        ],
    }
    client.expect_forbidden(
        "POST",
        "/academic/import",
        import_payload,
        headers=student_header,
    )
    imported_academic = client.post_json(
        "/academic/import",
        import_payload,
        headers=admin_header,
    )
    assert_true(imported_academic["imported_students"] == 1, "academic import failed")
    imported_students = client.get_json("/classes/class_smoke_ai_2024_01/students")
    assert_true(
        any(student["student_id"] == "student_smoke_001" for student in imported_students["students"]),
        "imported student not found",
    )
    local_accounts = client.get_json("/auth/local-accounts", headers=admin_header)["accounts"]
    assert_true(
        any(account["user_id"] == "teacher_smoke_001" for account in local_accounts),
        "local teacher account not listed",
    )
    assert_true(
        any(account["user_id"] == "student_smoke_001" for account in local_accounts),
        "local student account not listed",
    )
    client.expect_forbidden("GET", "/auth/local-accounts", headers=student_header)
    local_teacher_session = client.post_json(
        "/auth/local-session",
        {"user_id": "teacher_smoke_001"},
    )
    local_teacher_header = {"Authorization": f"Bearer {local_teacher_session['token']}"}
    local_teacher_dashboard = client.get_json(
        "/assignments/assignment_flask_mvp/dashboard",
        headers=local_teacher_header,
    )
    assert_true(
        local_teacher_session["token"] == "local-token-teacher_smoke_001",
        "local teacher session token missing",
    )
    assert_true(
        local_teacher_dashboard["access_scope"] == "teacher:authorized_course_class",
        "local teacher cannot access dashboard",
    )
    school_teacher_session = client.post_json(
        "/auth/school-session",
        {"teacher_no": "TSMOKE001"},
        headers={"X-School-Identity-Secret": school_identity_secret},
    )
    school_student_session = client.post_json(
        "/auth/school-session",
        {"student_no": "SMOKE2026001"},
        headers={"X-School-Identity-Secret": school_identity_secret},
    )
    school_teacher_header = {"Authorization": f"Bearer {school_teacher_session['token']}"}
    school_teacher_dashboard = client.get_json(
        "/assignments/assignment_flask_mvp/dashboard",
        headers=school_teacher_header,
    )
    assert_true(
        school_teacher_session["token"] == "school-token-teacher_smoke_001",
        "school identity teacher session token missing",
    )
    assert_true(
        school_student_session["token"] == "school-token-student_smoke_001",
        "school identity student session token missing",
    )
    assert_true(
        school_teacher_dashboard["access_scope"] == "teacher:authorized_course_class",
        "school identity teacher cannot access dashboard",
    )

    web = client.get_text(web_base)
    assert_true("<html" in web.lower() or "root" in web.lower(), "web entry did not return HTML")
    frontend_text = collect_frontend_text(client, web)
    for marker in [
        "项目库",
        "搜索项目",
        "新建项目",
        "提交材料",
        "查看报告",
        "处理高优先级问题",
        "绑定场景",
        "项目中心",
        "项目入库",
        "项目入库草稿",
        "课程作业",
        "个人作品",
        "生成分析报告",
        "清空草稿",
        "文件需重新选择",
        "项目提交准备",
        "单个文本文件不超过 200KB",
        "文本总量不超过 1MB",
        "发展工作台",
        "当前模块",
        "系统通知",
        "操作确认",
        "当前账号",
        "会话有效期",
        "会话已恢复",
        "正在恢复上次登录状态",
        "学校入口",
        "统一身份入口",
        "学校账号进入",
        "已接入学校账号",
        "权限边界",
        "账号角色筛选",
        "当前会话",
        "引用状态",
        "检索范围",
        "回答依据检查",
        "资料命中",
        "引用数量",
        "回答状态",
        "常用检索场景",
        "清空对话",
        "自定义调整意见",
        "提交调整",
        "教师诊断总览",
        "风险学生",
        "提交率",
        "目录数据总览",
        "授权边界",
        "方向覆盖",
        "标签覆盖",
        "导入字段预检",
        "数据接入步骤",
        "填写基础数据",
        "提交数据接入",
        "核对授权范围",
        "正在分析项目资产",
        "项目名称",
        "课程 ID",
        "班级 ID",
        "Rubric ID",
        "标记完成",
        "恢复执行",
        "完成进度",
        "上一页",
        "下一页",
        "每页",
        "目录检索",
        "全部课程",
        "全部班级",
        "全部方向",
        "全部路径",
        "全部来源",
        "知识库资料分页",
        "资料治理总览",
        "资料入库工作流",
        "新建资料",
        "资料入库表单",
        "维护人",
        "当前资料",
        "评测记录工作台",
        "保存案例与记录",
        "人工评分",
        "资料检查",
        "资料用途",
        "待完善",
        "全部场景",
        "全部优先级",
        "全部分数",
    ]:
        assert_true(marker in frontend_text, f"frontend missing project workspace marker: {marker}")
    for forbidden_marker in [
        "当前演示账号",
        "提示词",
        "成长路径",
        "任务复盘",
        "作业报告",
        "课程作业分析",
        "导入当前配置",
        "授权访问",
        "授权账号",
        "运维验收",
        "校内试运行",
    ]:
        assert_true(
            forbidden_marker not in frontend_text,
            f"frontend contains demo or outdated wording: {forbidden_marker}",
        )

    print("Smoke check passed.")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except AssertionError as error:
        print(f"Smoke check failed: {error}", file=sys.stderr)
        raise SystemExit(1)
