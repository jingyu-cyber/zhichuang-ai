import type { AssignmentDashboard, AssignmentReport } from "../types/assignments";

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

export function analyzeDemoAssignment(): Promise<AssignmentReport> {
  return requestJson<AssignmentReport>("/assignments/analyze", {
    method: "POST",
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
        { path: "services/todo_service.py", content: "import sqlite3\ndef create_todo(title): return sqlite3.connect('demo.db')" },
        { path: "tests/test_app.py", content: "def test_todos_page(): assert True" },
        { path: "requirements.txt", content: "flask\npytest" },
        { path: "README.md", content: "Flask Web 项目实践" },
      ],
    }),
  });
}

export function fetchAssignmentDashboard(): Promise<AssignmentDashboard> {
  return requestJson<AssignmentDashboard>("/assignments/assignment_flask_mvp/dashboard");
}
