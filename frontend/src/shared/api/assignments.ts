import type {
  AssignmentDashboard,
  AssignmentExportResponse,
  AssignmentItem,
  AssignmentListResponse,
  AssignmentReport,
  AssignmentUploadArchivePayload,
  RepositoryAnalysisPayload,
} from "../types/assignments";

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

export function analyzeDemoAssignment(token?: string): Promise<AssignmentReport> {
  return requestJson<AssignmentReport>("/assignments/analyze", {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify({
      assignment_title: "Flask Web 项目实践",
      course_id: "course_web_2026",
      class_id: "class_cs_2024_01",
      student_id: "student_001",
      repository_url: "https://example.edu/demo/flask-project",
      description: "示例作业包含 Flask 路由、SQLite 数据访问、README 和基础测试。",
      files: [
        {
          path: "app.py",
          content:
            "from flask import Flask, render_template\napp = Flask(__name__)\n@app.route('/todos')\ndef todos(): return render_template('todos.html')",
        },
        {
          path: "services/todo_service.py",
          content: "import sqlite3\ndef create_todo(title): return sqlite3.connect('demo.db')",
        },
        { path: "tests/test_app.py", content: "def test_todos_page(): assert True" },
        { path: "requirements.txt", content: "flask\npytest" },
        { path: "README.md", content: "Flask Web 项目实践" },
      ],
    }),
  });
}

export function fetchAssignmentDashboard(token?: string): Promise<AssignmentDashboard> {
  return requestJson<AssignmentDashboard>("/assignments/assignment_flask_mvp/dashboard", {
    headers: authHeaders(token),
  });
}

export function fetchAssignments(token?: string): Promise<AssignmentListResponse> {
  return requestJson<AssignmentListResponse>("/assignments", {
    headers: authHeaders(token),
  });
}

export function fetchAssignmentDashboardById(
  assignmentId: string,
  token?: string,
): Promise<AssignmentDashboard> {
  return requestJson<AssignmentDashboard>(`/assignments/${assignmentId}/dashboard`, {
    headers: authHeaders(token),
  });
}

export function fetchAssignmentReport(
  assignmentId: string,
  studentId: string,
  token?: string,
): Promise<AssignmentReport> {
  return requestJson<AssignmentReport>(`/assignments/${assignmentId}/reports/${studentId}`, {
    headers: authHeaders(token),
  });
}

export function exportAssignmentDashboard(
  assignmentId: string,
  token?: string,
): Promise<AssignmentExportResponse> {
  return requestJson<AssignmentExportResponse>(`/assignments/${assignmentId}/export`, {
    headers: authHeaders(token),
  });
}

export function createAssignment(token?: string): Promise<AssignmentItem> {
  return requestJson<AssignmentItem>("/assignments", {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify({
      assignment_id: "assignment_agent_rag_2026",
      title: "智能体 RAG 应用实践",
      course_id: "course_web_2026",
      class_id: "class_cs_2024_01",
      description: "围绕 RAG 检索、引用展示、对话上下文和工程测试完成一次综合实践。",
      rubric_id: "rubric_agent_rag",
    }),
  });
}

export function analyzeRepositoryAssignment(
  payload: RepositoryAnalysisPayload,
  token?: string,
): Promise<AssignmentReport> {
  return requestJson<AssignmentReport>("/assignments/analyze", {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify({
      assignment_id: payload.assignmentId,
      assignment_title: payload.assignmentTitle,
      course_id: payload.courseId,
      class_id: payload.classId,
      student_id: payload.studentId,
      repository_url: payload.repositoryUrl,
      description: payload.description,
    }),
  });
}

export async function uploadAssignmentArchive(
  payload: AssignmentUploadArchivePayload,
  token?: string,
): Promise<AssignmentReport> {
  const form = new FormData();
  if (payload.assignmentId) form.append("assignment_id", payload.assignmentId);
  form.append("assignment_title", payload.assignmentTitle);
  form.append("archive", payload.archive);
  if (payload.courseId) form.append("course_id", payload.courseId);
  if (payload.classId) form.append("class_id", payload.classId);
  if (payload.studentId) form.append("student_id", payload.studentId);
  if (payload.rubricId) form.append("rubric_id", payload.rubricId);
  if (payload.repositoryUrl) form.append("repository_url", payload.repositoryUrl);
  if (payload.description) form.append("description", payload.description);

  const response = await fetch(`${apiBaseUrl}/assignments/upload-archive`, {
    method: "POST",
    headers: authHeaders(token),
    body: form,
  });

  if (!response.ok) {
    throw new Error(`Request failed: ${response.status}`);
  }

  return response.json() as Promise<AssignmentReport>;
}
