from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.main import app
from app.schemas.growth import (
    BasicProfileUpsert,
    LearningPlanRequest,
    LearningPlanRevisionRequest,
    ProfileEvidenceCreate,
)
from app.services.growth_service import GrowthService


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
    plans_response = client.get("/api/students/student_001/plans")
    catalog_response = client.get("/api/competitions")
    competition_response = client.post(
        "/api/competitions/recommend",
        json={"student_id": "student_001", "target": "AI 应用开发"},
    )
    preparation_response = client.post(
        "/api/competitions/preparation-plan",
        json={
            "student_id": "student_001",
            "competition_name": "中国大学生计算机设计大赛",
            "weeks": 4,
            "weekly_hours": 8,
        },
    )
    team_response = client.post(
        "/api/teams/recommend",
        json={"student_id": "student_001", "project_goal": "作业代码分析 Demo"},
    )

    assert plan_response.status_code == 200
    assert lean_plan_response.status_code == 200
    assert revision_response.status_code == 200
    assert plans_response.status_code == 200
    assert catalog_response.status_code == 200
    assert competition_response.status_code == 200
    assert preparation_response.status_code == 200
    assert team_response.status_code == 200
    assert len(plan_response.json()["tasks"]) == 4
    assert len(lean_plan_response.json()["tasks"]) == 4
    assert plan_response.json()["tasks"][0]["title"] != lean_plan_response.json()["tasks"][0]["title"]
    assert "每周可投入" in lean_plan_response.json()["basis"][1]
    assert revision_response.json()["weeks"] == 4
    assert revision_response.json()["revision_note"]
    assert "时间不足" in revision_response.json()["revision_note"]
    assert plans_response.json()["total"] >= 1
    assert plans_response.json()["plans"][0]["student_id"] == "student_001"
    assert catalog_response.json()["total"] >= 8
    assert catalog_response.json()["competitions"][0]["official_url"]
    assert len(competition_response.json()["recommendations"]) >= 2
    assert all(
        recommendation["fit_reasons"] and recommendation["gap_abilities"]
        for recommendation in competition_response.json()["recommendations"]
    )
    preparation_payload = preparation_response.json()
    assert preparation_payload["competition_name"] == "中国大学生计算机设计大赛"
    assert preparation_payload["official_url"]
    assert "以当年官方通知为准" in preparation_payload["registration_time"]
    assert len(preparation_payload["milestones"]) == 4
    assert all(milestone["official_basis"] for milestone in preparation_payload["milestones"])
    assert any("报名" in citation for citation in preparation_payload["citations"])
    assert len(team_response.json()["candidates"]) >= 2
    assert team_response.json()["candidates"][0]["skill_complement_graph"]
    assert team_response.json()["candidates"][0]["suggested_questions"]
    assert "student_004" not in [
        candidate["student_id"] for candidate in team_response.json()["candidates"]
    ]


def test_teacher_candidate_screening_returns_cohort_tiers() -> None:
    client = TestClient(app)
    response = client.post(
        "/api/teacher/candidate-screening",
        headers={"Authorization": "Bearer demo-token-teacher_001"},
        json={
            "target_name": "中国大学生计算机设计大赛",
            "target_type": "competition",
            "target_abilities": ["工程实践", "AI 与数据能力", "协作表达"],
            "class_id": "class_cs_2024_01",
            "min_score": 60,
        },
    )
    forbidden_response = client.post(
        "/api/teacher/candidate-screening",
        headers={"Authorization": "Bearer demo-token-student_001"},
        json={"target_name": "中国大学生计算机设计大赛"},
    )
    class_forbidden_response = client.post(
        "/api/teacher/candidate-screening",
        headers={"Authorization": "Bearer demo-token-teacher_001"},
        json={
            "target_name": "中国大学生计算机设计大赛",
            "class_id": "class_not_authorized",
        },
    )

    assert response.status_code == 200
    assert forbidden_response.status_code == 403
    assert class_forbidden_response.status_code == 403
    payload = response.json()
    assert payload["target_name"] == "中国大学生计算机设计大赛"
    assert "教学和竞赛指导参考" in payload["source_note"]
    assert len(payload["candidates"]) >= 3
    assert payload["candidates"][0]["tier"] in ["重点推荐", "可培养"]
    assert all(candidate["match_reason"] for candidate in payload["candidates"])
    assert all(candidate["gap_reminders"] for candidate in payload["candidates"])
    assert all(candidate["evidence"] for candidate in payload["candidates"])


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


def test_student_profile_and_evidence_persist_in_sqlite_session(tmp_path) -> None:
    engine = create_engine(
        f"sqlite:///{tmp_path / 'growth.db'}",
        connect_args={"check_same_thread": False},
    )
    SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)

    with SessionLocal() as first_session:
        service = GrowthService(first_session)
        profile = service.upsert_basic_profile(
            "student_009",
            BasicProfileUpsert(
                student_name="赵知行",
                grade="大三",
                major="软件工程",
                course_foundation=["数据结构", "软件工程"],
                skill_tags=["React", "FastAPI", "RAG"],
                project_experiences=["课程作业分析平台"],
                competition_experiences=["中国大学生计算机设计大赛校赛"],
                target_direction="AI 应用开发 / 软件项目实践",
                weekly_hours=10,
                github_url="https://github.com/demo/student-009",
            ),
        )
        evidence = service.add_profile_evidence(
            "student_009",
            ProfileEvidenceCreate(
                dimension="工程实践",
                source_type="assignment_report",
                source_title="课程作业代码分析报告",
                evidence_text="上传了作业代码，系统识别到接口、测试和 README 证据。",
                confidence=0.77,
            ),
        )

    with SessionLocal() as second_session:
        persisted = GrowthService(second_session).get_profile("student_009")

    assert profile.profile_summary is not None
    assert profile.profile_summary.course_foundation == ["数据结构", "软件工程"]
    assert persisted.student_name == "赵知行"
    assert persisted.profile_summary is not None
    assert persisted.profile_summary.skill_tags == ["React", "FastAPI", "RAG"]
    assert persisted.profile_summary.course_foundation == ["数据结构", "软件工程"]
    assert any(
        item.evidence_id == evidence.evidence_id
        for dimension in persisted.dimensions
        for item in dimension.evidence_items
    )
    assert any(
        item.source_title == "课程作业代码分析报告"
        for dimension in persisted.dimensions
        for item in dimension.evidence_items
    )


def test_learning_plan_generation_and_revision_persist_in_sqlite_session(tmp_path) -> None:
    engine = create_engine(
        f"sqlite:///{tmp_path / 'plans.db'}",
        connect_args={"check_same_thread": False},
    )
    SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)

    with SessionLocal() as first_session:
        service = GrowthService(first_session)
        generated = service.generate_plan(
            LearningPlanRequest(
                student_id="student_010",
                goal="四周内完成课程作业分析 Demo",
                weeks=4,
                weekly_hours=6,
                foundation="工程基础较好，需要补测试和展示材料",
            )
        )
        revised = service.revise_plan(
            generated.plan_id,
            LearningPlanRevisionRequest(
                student_id="student_010",
                feedback="时间不足，需要压缩每周任务",
                weeks=3,
                weekly_hours=3,
            ),
        )

    with SessionLocal() as second_session:
        plans = GrowthService(second_session).list_learning_plans("student_010")

    assert generated.plan_id == revised.plan_id
    assert plans.total == 1
    assert plans.plans[0].plan_id == generated.plan_id
    assert plans.plans[0].weeks == 3
    assert plans.plans[0].revision_note is not None
    assert "时间不足" in plans.plans[0].revision_note
