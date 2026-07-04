from fastapi.testclient import TestClient

from app.main import app


def test_evaluation_dashboard_contains_three_records() -> None:
    client = TestClient(app)
    response = client.get("/api/evaluations/dashboard")

    assert response.status_code == 200
    payload = response.json()
    assert payload["summary"]["total_cases"] >= 3
    assert payload["summary"]["completed_records"] >= 3
    assert payload["summary"]["average_score"] >= 80
    assert len(payload["records"]) >= 3
    assert payload["records"][0]["citations"]
    assert payload["records"][0]["issue_notes"]


def test_admin_can_create_evaluation_case_and_record() -> None:
    client = TestClient(app)
    case_response = client.post(
        "/api/evaluations/cases",
        headers={"Authorization": "Bearer demo-token-admin_001"},
        json={
            "scenario": "竞赛准备计划",
            "input_question": "为中国大学生计算机设计大赛生成 4 周准备计划",
            "expected_focus": ["时间节点", "官方依据", "交付物"],
            "priority": "P0",
            "status": "已记录",
        },
    )
    record_response = client.post(
        "/api/evaluations/records",
        headers={"Authorization": "Bearer demo-token-admin_001"},
        json={
            "case_id": case_response.json()["item_id"],
            "scenario": "竞赛准备计划",
            "input_question": "为中国大学生计算机设计大赛生成 4 周准备计划",
            "system_output": "系统生成 4 周准备计划，包含报名节点和作品交付物。",
            "manual_score": 88,
            "issue_notes": "计划结构完整，引用依据明确。",
            "reviewer": "项目评测组",
        },
    )
    forbidden_response = client.post(
        "/api/evaluations/cases",
        headers={"Authorization": "Bearer demo-token-student_001"},
        json={"scenario": "学生尝试维护评测"},
    )
    dashboard_response = client.get("/api/evaluations/dashboard")

    assert case_response.status_code == 200
    assert record_response.status_code == 200
    assert forbidden_response.status_code == 403
    assert dashboard_response.json()["summary"]["total_cases"] >= 4
    assert dashboard_response.json()["summary"]["completed_records"] >= 4
    assert any(
        record["record_id"] == record_response.json()["item_id"]
        for record in dashboard_response.json()["records"]
    )
