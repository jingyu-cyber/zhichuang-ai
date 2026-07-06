#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
DB_PATH="${ROOT_DIR}/data/local/app.db"

if [ ! -f "$DB_PATH" ]; then
  echo "No local database found at data/local/app.db"
  exit 0
fi

STAMP="$(date +%Y%m%d%H%M%S)"
BACKUP_PATH="${ROOT_DIR}/data/local/app.${STAMP}.bak.db"
cp "$DB_PATH" "$BACKUP_PATH"

sqlite3 "$DB_PATH" <<'SQL'
PRAGMA foreign_keys = OFF;

CREATE TEMP TABLE test_assignments AS
SELECT id FROM assignments
WHERE title IN (
  '学生可见项目',
  '其他学生项目',
  '仓库链接项目',
  '智能体 RAG 应用实践测试',
  'Smoke Zip 项目',
  'Smoke 仓库链接项目',
  'FastAPI Zip 项目',
  '权限范围内项目'
)
OR id LIKE 'assignment_student_visible_%'
OR id LIKE 'assignment_student_hidden_%'
OR id LIKE 'assignment_repo_fetch_%'
OR id LIKE 'assignment_test_agent_rag%'
OR id LIKE 'assignment_smoke_agent_rag%'
OR id LIKE 'assignment_scope_only_%'
OR id LIKE 'assignment_%zip%';

DELETE FROM agent_tasks
WHERE result_ref IN (SELECT id FROM assignment_reports WHERE assignment_id IN (SELECT id FROM test_assignments))
   OR result_ref IN (SELECT id FROM test_assignments);

DELETE FROM capability_evidence
WHERE source_title IN (
  '学生可见项目',
  '其他学生项目',
  '仓库链接项目',
  '智能体 RAG 应用实践测试',
  'Smoke Zip 项目',
  'Smoke 仓库链接项目',
  'FastAPI Zip 项目',
  '权限范围内项目'
)
OR source_id IN (
  '学生可见项目',
  '其他学生项目',
  '仓库链接项目',
  '智能体 RAG 应用实践测试',
  'Smoke Zip 项目',
  'Smoke 仓库链接项目',
  'FastAPI Zip 项目',
  '权限范围内项目'
);

DELETE FROM assignment_reports WHERE assignment_id IN (SELECT id FROM test_assignments);
DELETE FROM submissions WHERE assignment_id IN (SELECT id FROM test_assignments);
DELETE FROM assignments WHERE id IN (SELECT id FROM test_assignments);

DROP TABLE test_assignments;

PRAGMA foreign_keys = ON;
VACUUM;
SQL

echo "Local database cleaned."
echo "Backup: ${BACKUP_PATH}"
