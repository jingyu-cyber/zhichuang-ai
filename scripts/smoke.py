#!/usr/bin/env python3
from __future__ import annotations

import json
import sys
import urllib.error
import urllib.parse
import urllib.request
from dataclasses import dataclass
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

    courses = client.get_json("/courses")
    assert_true(courses["courses"], "courses missing")

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
