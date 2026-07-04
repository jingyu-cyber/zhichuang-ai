from pydantic import BaseModel, Field


class ChatMessage(BaseModel):
    role: str
    content: str


class ChatRequest(BaseModel):
    message: str = Field(min_length=1)
    scenario: str = "general"
    session_id: str = "demo_session"
    history: list[ChatMessage] = Field(default_factory=list)


class Citation(BaseModel):
    title: str
    source_type: str
    snippet: str


class ChatResponse(BaseModel):
    session_id: str
    answer: str
    citations: list[Citation] = Field(default_factory=list)
    context_summary: str
    suggested_next_questions: list[str] = Field(default_factory=list)
    ai_generated: bool = True
