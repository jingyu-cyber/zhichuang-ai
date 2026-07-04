import type { ChatMessage, ChatResponse } from "../types/agent";

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000/api";

export async function askAgent(
  message: string,
  scenario = "knowledge",
  history: ChatMessage[] = [],
  sessionId = "demo_knowledge_session",
): Promise<ChatResponse> {
  const response = await fetch(`${apiBaseUrl}/agent/chat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ message, scenario, history, session_id: sessionId }),
  });

  if (!response.ok) {
    throw new Error(`Request failed: ${response.status}`);
  }

  return response.json() as Promise<ChatResponse>;
}
