from app.schemas.agent import ChatRequest, ChatResponse, Citation
from app.rag.pipeline import RagPipeline


class AgentService:
    def chat(self, payload: ChatRequest) -> ChatResponse:
        context_query = self._build_context_query(payload)
        answer, chunks = RagPipeline().answer(context_query)
        role_hint = "教师视角" if payload.scenario == "teacher" else "学生视角"
        context_summary = self._summarize_context(payload)

        return ChatResponse(
            session_id=payload.session_id,
            answer=answer,
            citations=[
                Citation(
                    title=chunk.title,
                    source_type=chunk.source_type,
                    snippet=chunk.content,
                )
                for chunk in chunks
            ],
            context_summary=f"{role_hint} · {context_summary}",
            suggested_next_questions=self._suggest_next_questions(payload.scenario),
        )

    def _build_context_query(self, payload: ChatRequest) -> str:
        recent_turns = " ".join(message.content for message in payload.history[-4:])
        return " ".join(part for part in [recent_turns, payload.message] if part).strip()

    def _summarize_context(self, payload: ChatRequest) -> str:
        if not payload.history:
            return "当前为首轮问题。"
        user_turns = len([message for message in payload.history if message.role == "user"])
        return f"已结合前 {user_turns} 轮用户追问。"

    def _suggest_next_questions(self, scenario: str) -> list[str]:
        if scenario == "teacher":
            return [
                "哪些学生需要重点讲评？",
                "这次作业共性问题对应哪些知识点？",
                "下次课可以安排什么练习？",
            ]

        return [
            "下一周我应该先补哪项能力？",
            "这个目标适合参加哪些竞赛？",
            "我应该找什么类型的队友？",
        ]
