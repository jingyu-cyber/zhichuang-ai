from fastapi.testclient import TestClient

from app.main import app


def test_agent_chat_returns_rag_answer_with_citations() -> None:
    client = TestClient(app)
    response = client.post(
        "/api/agent/chat",
        json={
            "message": "如何准备算法竞赛？",
            "scenario": "student",
            "session_id": "session_student_001",
        },
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["session_id"] == "session_student_001"
    assert "算法竞赛" in payload["answer"]
    assert len(payload["citations"]) >= 1
    assert payload["citations"][0]["title"]


def test_agent_chat_keeps_context_for_three_turns() -> None:
    client = TestClient(app)
    history = []
    questions = [
        "教师怎么看本次代码作业共性问题？",
        "哪些问题适合课堂讲评？",
        "下一次课应该安排什么练习？",
    ]

    response_payload = None
    for question in questions:
        response = client.post(
            "/api/agent/chat",
            json={
                "message": question,
                "scenario": "teacher",
                "session_id": "session_teacher_001",
                "history": history,
            },
        )
        assert response.status_code == 200
        response_payload = response.json()
        history.append({"role": "user", "content": question})
        history.append({"role": "assistant", "content": response_payload["answer"]})

    assert response_payload is not None
    assert response_payload["session_id"] == "session_teacher_001"
    assert "教师视角" in response_payload["context_summary"]
    assert response_payload["suggested_next_questions"]
