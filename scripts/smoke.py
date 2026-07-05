#!/usr/bin/env python3
from __future__ import annotations

import json
import sys
import urllib.error
import urllib.parse
import urllib.request
import uuid
import zipfile
from dataclasses import dataclass
from io import BytesIO
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


def main() -> int:
    api_base = sys.argv[1] if len(sys.argv) > 1 else "http://localhost:8000/api"
    web_base = sys.argv[2] if len(sys.argv) > 2 else "http://localhost:5173"
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

    created_assignment = client.post_json(
        "/assignments",
        {
            "assignment_id": "assignment_smoke_agent_rag",
            "title": "Smoke 智能体 RAG 应用实践",
            "course_id": "course_web_2026",
            "class_id": "class_cs_2024_01",
            "description": "Smoke 发布课程作业，用于验证教师端作业列表与看板切换。",
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
    assert_true(report["student_id"] == "student_001", "student report access failed")
    assert_true(report["code_structure"]["file_count"] >= 1, "code structure summary missing")
    assert_true(report["evidence_snippets"], "code evidence snippets missing")

    uploaded_report = client.post_multipart(
        "/assignments/upload-archive",
        {
            "assignment_id": "assignment_smoke_agent_rag",
            "assignment_title": "Smoke Zip 作业",
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
                        "README.md": "Smoke zip 作业说明\n",
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
    created_dashboard = client.get_json(
        "/assignments/assignment_smoke_agent_rag/dashboard",
        headers=teacher_header,
    )
    assert_true(
        any(report["student_id"] == "student_smoke_zip_001" for report in created_dashboard["reports"]),
        "created assignment dashboard missing uploaded report",
    )

    profile = client.get_json("/students/student_001/profile")
    assert_true(len(profile["dimensions"]) >= 4, "growth profile dimensions missing")

    plan = client.post_json("/plans/generate", {"student_id": "student_001", "weeks": 4})
    assert_true(len(plan["tasks"]) == 4, "learning plan did not honor weeks")

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
    assert_true(team_status["contact_visible"] is False, "team contact visibility should be hidden")
    team = client.post_json(
        "/teams/recommend",
        {"student_id": "student_001", "project_goal": "作业代码分析 Demo"},
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
    review = client.post_json(
        "/reviews/generate",
        {"student_id": "student_001", "period": "本周", "completed_task_ids": [task["task_id"]]},
    )
    assert_true(review["next_tasks"], "task review next actions missing")

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
    client.expect_forbidden(
        "POST",
        "/evaluations/cases",
        {"scenario": "学生尝试维护评测"},
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

    web = client.get_text(web_base)
    assert_true("<html" in web.lower() or "root" in web.lower(), "web entry did not return HTML")

    print("Smoke check passed.")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except AssertionError as error:
        print(f"Smoke check failed: {error}", file=sys.stderr)
        raise SystemExit(1)
