import type { LearningTask, ReviewResponse, TaskListResponse } from "../types/tasks";

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

function authHeaders(token?: string): HeadersInit {
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export function fetchStudentTasks(
  studentId = "student_001",
  token?: string,
): Promise<TaskListResponse> {
  return requestJson<TaskListResponse>(`/students/${studentId}/tasks`, {
    headers: authHeaders(token),
  });
}

export function saveTask(
  title: string,
  studentId = "student_001",
  token?: string,
): Promise<LearningTask> {
  return requestJson<LearningTask>("/tasks", {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify({
      student_id: studentId,
      title,
      source: "manual",
      priority: "medium",
      due_date: "2026-07-12",
      evidence_required: "提交学习记录或项目产物",
    }),
  });
}

export function generateReview(
  studentId = "student_001",
  token?: string,
): Promise<ReviewResponse> {
  return requestJson<ReviewResponse>("/reviews/generate", {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify({
      student_id: studentId,
      period: "本周",
      completed_task_ids: ["task_demo_script"],
      notes: "已完成部署说明和演示脚本，继续补测试和算法复盘。",
    }),
  });
}
