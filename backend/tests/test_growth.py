from fastapi.testclient import TestClient

from app.main import app


def test_student_profile_returns_capability_dimensions() -> None:
    client = TestClient(app)
    response = client.get("/api/students/student_001/profile")
    upsert_response = client.put(
        "/api/students/student_001/profile",
        json={
            "student_name": "林一舟",
            "grade": "大二",
            "major": "计算机科学与技术",
            "course_foundation": ["程序设计基础", "数据结构", "数据库系统"],
            "skill_tags": ["Flask", "RAG", "GitHub", "README"],
            "project_experiences": ["Flask Web 作业项目", "RAG 文档问答 Demo"],
            "competition_experiences": ["蓝桥杯校内训练"],
            "target_direction": "AI 应用开发 / 软件项目实践",
            "weekly_hours": 8,
            "github_url": "https://github.com/demo/zhichuang-agent",
        },
    )
    evidence_response = client.post(
        "/api/students/student_001/profile/evidence",
        json={
            "dimension": "工程实践",
            "source_type": "student_self_report",
            "source_title": "学生补充自评",
            "evidence_text": "补充了 Flask 作业测试截图和 README 运行说明。",
            "confidence": 0.42,
        },
    )

    assert response.status_code == 200
    assert upsert_response.status_code == 200
    assert evidence_response.status_code == 200
    payload = response.json()
    upsert_payload = upsert_response.json()
    assert payload["student_name"] == "林一舟"
    assert len(payload["dimensions"]) == 4
    assert all(dimension["evidence_items"] for dimension in payload["dimensions"])
    assert upsert_payload["profile_summary"]["completion_minutes_estimate"] == 5
    assert upsert_payload["target_path"] == "AI 应用开发 / 软件项目实践"
    assert "RAG" in upsert_payload["profile_summary"]["skill_tags"]
    assert any(
        item["source_type"] == "student_basic_profile"
        for dimension in upsert_payload["dimensions"]
        for item in dimension["evidence_items"]
    )
    assert evidence_response.json()["dimension"] == "工程实践"
    assert evidence_response.json()["source_type"] == "student_self_report"


def test_learning_plan_and_recommendations() -> None:
    client = TestClient(app)
    plan_response = client.post("/api/plans/generate", json={"student_id": "student_001", "weeks": 4})
    lean_plan_response = client.post(
        "/api/plans/generate",
        json={
            "student_id": "student_002",
            "goal": "三个月内完成 AI 应用开发 Demo 并准备校级双创项目",
            "weeks": 4,
            "weekly_hours": 3,
            "foundation": "基础薄弱，时间不足",
        },
    )
    revision_response = client.post(
        "/api/plans/plan_student_001_ai_app/revise",
        json={
            "student_id": "student_001",
            "feedback": "时间不足，需要压缩每周任务",
            "weeks": 4,
            "weekly_hours": 3,
        },
    )
    catalog_response = client.get("/api/competitions")
    competition_response = client.post(
        "/api/competitions/recommend",
        json={"student_id": "student_001", "target": "AI 应用开发"},
    )
    team_response = client.post(
        "/api/teams/recommend",
        json={"student_id": "student_001", "project_goal": "作业代码分析 Demo"},
    )

    assert plan_response.status_code == 200
    assert lean_plan_response.status_code == 200
    assert revision_response.status_code == 200
    assert catalog_response.status_code == 200
    assert competition_response.status_code == 200
    assert team_response.status_code == 200
    assert len(plan_response.json()["tasks"]) == 4
    assert len(lean_plan_response.json()["tasks"]) == 4
    assert plan_response.json()["tasks"][0]["title"] != lean_plan_response.json()["tasks"][0]["title"]
    assert "每周可投入" in lean_plan_response.json()["basis"][1]
    assert revision_response.json()["weeks"] == 4
    assert revision_response.json()["revision_note"]
    assert "时间不足" in revision_response.json()["revision_note"]
    assert catalog_response.json()["total"] >= 8
    assert catalog_response.json()["competitions"][0]["official_url"]
    assert len(competition_response.json()["recommendations"]) >= 2
    assert len(team_response.json()["candidates"]) >= 2
    assert "student_004" not in [
        candidate["student_id"] for candidate in team_response.json()["candidates"]
    ]


def test_team_request_and_pool_status() -> None:
    client = TestClient(app)
    request_response = client.post(
        "/api/teams/requests",
        json={
            "student_id": "student_001",
            "competition_name": "中国大学生计算机设计大赛",
            "project_direction": "AI 应用开发与教学智能体",
            "missing_roles": ["前端与交互", "算法与评测"],
            "expected_skills": ["React", "RAG"],
            "weekly_hours": 8,
            "communication": "每周一次线上同步",
            "team_status_enabled": True,
        },
    )
    status_response = client.get("/api/students/student_001/team-status")
    disabled_status_response = client.get("/api/students/student_004/team-status")
    revoke_response = client.patch(
        "/api/students/student_002/team-status",
        json={"team_status_enabled": False, "contact_visible": True},
    )
    team_response_after_revoke = client.post(
        "/api/teams/recommend",
        json={"student_id": "student_001", "project_goal": "作业代码分析 Demo"},
    )
    restore_response = client.patch(
        "/api/students/student_002/team-status",
        json={"team_status_enabled": True, "contact_visible": False},
    )

    assert request_response.status_code == 200
    assert status_response.status_code == 200
    assert disabled_status_response.status_code == 200
    assert revoke_response.status_code == 200
    assert team_response_after_revoke.status_code == 200
    assert restore_response.status_code == 200
    assert request_response.json()["team_status_enabled"] is True
    assert request_response.json()["contact_visible"] is False
    assert status_response.json()["contact_visible"] is False
    assert disabled_status_response.json()["team_status_enabled"] is False
    assert "不会出现在队友推荐结果中" in disabled_status_response.json()["visibility_note"]
    assert revoke_response.json()["team_status_enabled"] is False
    assert revoke_response.json()["contact_visible"] is False
    assert "student_002" not in [
        candidate["student_id"]
        for candidate in team_response_after_revoke.json()["candidates"]
    ]
