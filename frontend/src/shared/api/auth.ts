import type { DemoAccountsResponse, DemoSessionResponse } from "../types/auth";

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000/api";

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...init?.headers,
    },
    ...init,
  });

  if (!response.ok) {
    throw new Error(`Request failed: ${response.status}`);
  }

  return response.json() as Promise<T>;
}

export function fetchDemoAccounts(): Promise<DemoAccountsResponse> {
  return requestJson<DemoAccountsResponse>("/auth/demo-accounts");
}

export function createDemoSession(userId: string): Promise<DemoSessionResponse> {
  return requestJson<DemoSessionResponse>("/auth/demo-session", {
    method: "POST",
    body: JSON.stringify({ user_id: userId }),
  });
}
