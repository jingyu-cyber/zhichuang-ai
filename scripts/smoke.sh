#!/usr/bin/env bash
set -euo pipefail

API_BASE="${1:-http://localhost:8000/api}"
WEB_BASE="${2:-http://localhost:5173}"

echo "Smoke check API: ${API_BASE}"
curl -fsS "${API_BASE}/health" >/dev/null
curl -fsS "${API_BASE}/auth/demo-accounts" >/dev/null
curl -fsS "${API_BASE}/students/student_001/profile" >/dev/null
curl -fsS -X POST "${API_BASE}/agent/chat" \
  -H "Content-Type: application/json" \
  -d '{"message":"如何准备算法竞赛？","scenario":"student","session_id":"smoke_session"}' \
  >/dev/null
curl -fsS "${API_BASE}/assignments/assignment_flask_mvp/dashboard" >/dev/null
curl -fsS "${API_BASE}/evaluations/dashboard" >/dev/null
curl -fsS "${API_BASE}/competitions" >/dev/null
curl -fsS "${API_BASE}/students/student_001/team-status" >/dev/null
curl -fsS "${API_BASE}/knowledge/documents" >/dev/null
curl -fsS "${API_BASE}/knowledge/search?q=%E4%BD%9C%E4%B8%9A%20Rubric" >/dev/null

echo "Smoke check Web: ${WEB_BASE}"
curl -fsS "${WEB_BASE}" >/dev/null

echo "Smoke check passed."
