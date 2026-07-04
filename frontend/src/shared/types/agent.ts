export type AgentCitation = {
  title: string;
  source_type: string;
  snippet: string;
};

export type ChatMessage = {
  role: "user" | "assistant" | string;
  content: string;
};

export type ChatResponse = {
  session_id: string;
  answer: string;
  citations: AgentCitation[];
  context_summary: string;
  suggested_next_questions: string[];
  ai_generated: boolean;
};
