from fastapi.testclient import TestClient

from app.main import app


def test_demo_accounts_and_session() -> None:
    client = TestClient(app)
    accounts_response = client.get("/api/auth/demo-accounts")
    session_response = client.post("/api/auth/demo-session", json={"user_id": "teacher_001"})

    assert accounts_response.status_code == 200
    assert session_response.status_code == 200
    assert len(accounts_response.json()["accounts"]) == 3
    assert session_response.json()["account"]["role"] == "teacher"


def test_unknown_demo_session_returns_not_found() -> None:
    client = TestClient(app)
    response = client.post("/api/auth/demo-session", json={"user_id": "unknown_user"})

    assert response.status_code == 404


def test_local_session_uses_imported_academic_users() -> None:
    client = TestClient(app)
    admin_header = {"Authorization": "Bearer demo-token-admin_001"}
    import_response = client.post(
        "/api/academic/import",
        json={
            "courses": [
                {
                    "course_id": "course_local_auth_2026",
                    "name": "本地账号课程",
                    "term": "2025-2026 春季学期",
                    "teacher_id": "teacher_local_001",
                    "teacher_name": "本地教师",
                    "teacher_no": "TLOCAL001",
                }
            ],
            "classes": [
                {
                    "class_id": "class_local_auth_2024_01",
                    "course_id": "course_local_auth_2026",
                    "name": "2024 级本地账号 1 班",
                    "grade": "2024",
                    "major": "计算机科学与技术",
                }
            ],
            "students": [
                {
                    "student_id": "student_local_001",
                    "name": "本地学生",
                    "student_no": "LOCAL2024001",
                    "class_id": "class_local_auth_2024_01",
                    "target_path": "软件项目实践",
                    "tags": ["课程项目"],
                }
            ],
        },
        headers=admin_header,
    )
    teacher_session = client.post(
        "/api/auth/local-session",
        json={"user_id": "teacher_local_001"},
    )
    student_session = client.post(
        "/api/auth/local-session",
        json={"user_id": "student_local_001"},
    )

    assert import_response.status_code == 200
    assert teacher_session.status_code == 200
    assert teacher_session.json()["token"] == "local-token-teacher_local_001"
    assert teacher_session.json()["account"]["role"] == "teacher"
    assert "course_local_auth_2026" in teacher_session.json()["account"]["authorized_courses"]
    assert "2024 级本地账号 1 班" in teacher_session.json()["account"]["authorized_classes"]
    assert student_session.status_code == 200
    assert student_session.json()["account"]["default_view"] == "growth"
    assert "class_local_auth_2024_01" in student_session.json()["account"]["authorized_classes"]


def test_admin_can_list_imported_local_accounts_and_students_cannot() -> None:
    client = TestClient(app)
    admin_header = {"Authorization": "Bearer demo-token-admin_001"}
    student_header = {"Authorization": "Bearer demo-token-student_001"}
    import_response = client.post(
        "/api/academic/import",
        json={
            "courses": [
                {
                    "course_id": "course_local_directory_2026",
                    "name": "本地账号目录课程",
                    "teacher_id": "teacher_local_directory_001",
                    "teacher_name": "目录教师",
                    "teacher_no": "TDIRECTORY001",
                }
            ],
            "classes": [
                {
                    "class_id": "class_local_directory_2024_01",
                    "course_id": "course_local_directory_2026",
                    "name": "2024 级本地账号目录 1 班",
                }
            ],
            "students": [
                {
                    "student_id": "student_local_directory_001",
                    "name": "目录学生",
                    "student_no": "DIRECTORY2024001",
                    "class_id": "class_local_directory_2024_01",
                }
            ],
        },
        headers=admin_header,
    )

    forbidden_response = client.get("/api/auth/local-accounts", headers=student_header)
    response = client.get("/api/auth/local-accounts", headers=admin_header)
    accounts = response.json()["accounts"]

    assert import_response.status_code == 200
    assert forbidden_response.status_code == 403
    assert response.status_code == 200
    assert any(account["user_id"] == "teacher_local_directory_001" for account in accounts)
    assert any(account["user_id"] == "student_local_directory_001" for account in accounts)
    teacher_account = next(
        account for account in accounts if account["user_id"] == "teacher_local_directory_001"
    )
    assert teacher_account["role"] == "teacher"
    assert "course_local_directory_2026" in teacher_account["authorized_courses"]
    assert "class_local_directory_2024_01" in teacher_account["authorized_classes"]


def test_local_token_can_authorize_assignment_access() -> None:
    client = TestClient(app)
    admin_header = {"Authorization": "Bearer demo-token-admin_001"}
    client.post(
        "/api/academic/import",
        json={
            "courses": [
                {
                    "course_id": "course_web_2026",
                    "name": "Web 应用开发",
                    "teacher_id": "teacher_web_local",
                    "teacher_name": "Web 本地教师",
                    "teacher_no": "TWEBLOCAL",
                }
            ],
            "classes": [
                {
                    "class_id": "class_cs_2024_01",
                    "course_id": "course_web_2026",
                    "name": "2024 级计算机科学与技术 1 班",
                    "grade": "2024",
                    "major": "计算机科学与技术",
                }
            ],
            "students": [
                {
                    "student_id": "student_web_local",
                    "name": "Web 本地学生",
                    "student_no": "WEBLOCAL001",
                    "class_id": "class_cs_2024_01",
                    "course_ids": ["course_web_2026"],
                }
            ],
        },
        headers=admin_header,
    )
    teacher_session = client.post(
        "/api/auth/local-session",
        json={"user_id": "teacher_web_local"},
    )
    student_session = client.post(
        "/api/auth/local-session",
        json={"user_id": "student_web_local"},
    )
    teacher_header = {"Authorization": f"Bearer {teacher_session.json()['token']}"}
    student_header = {"Authorization": f"Bearer {student_session.json()['token']}"}

    dashboard_response = client.get(
        "/api/assignments/assignment_flask_mvp/dashboard",
        headers=teacher_header,
    )
    own_report_response = client.get(
        "/api/assignments/assignment_flask_mvp/reports/student_web_local",
        headers=student_header,
    )
    other_report_response = client.get(
        "/api/assignments/assignment_flask_mvp/reports/student_001",
        headers=student_header,
    )

    assert dashboard_response.status_code == 200
    assert dashboard_response.json()["access_scope"] == "teacher:authorized_course_class"
    assert own_report_response.status_code == 200
    assert own_report_response.json()["access_scope"] == "student:self"
    assert other_report_response.status_code == 403


def test_unknown_local_session_returns_not_found() -> None:
    client = TestClient(app)
    response = client.post("/api/auth/local-session", json={"user_id": "missing_local"})

    assert response.status_code == 404
