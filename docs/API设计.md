# API 设计草案

接口前缀：`/api`

## 1. 健康检查

### `GET /health`

返回服务状态。

```json
{
  "status": "ok"
}
```

## 2. 账号与智能体

### 2.1 演示账号

#### `GET /auth/demo-accounts`

公网 Demo 获取学生、教师、管理员三个演示账号。

#### `POST /auth/demo-session`

请求：

```json
{
  "user_id": "teacher_001"
}
```

响应包含演示 token、账号角色、授权课程、授权班级和可访问模块。

### 2.2 智能体对话

#### `POST /agent/chat`

用于学生或教师发起自然语言任务。

请求：

```json
{
  "message": "帮我制定蓝桥杯算法训练计划",
  "context": {
    "role": "student",
    "course_id": "course_001"
  }
}
```

响应：

```json
{
  "answer": "如果目标是算法竞赛准备，建议按训练路径拆成阶段任务...",
  "citations": [
    {
      "title": "算法竞赛训练路径",
      "source_type": "competition_material",
      "snippet": "算法竞赛准备建议按基础语法、常用数据结构、搜索、动态规划、图论和真题复盘推进。"
    }
  ],
  "ai_generated": true
}
```

## 3. 作业代码分析

### `POST /assignments/analyze`

创建一次课程作业分析任务。当前骨架返回占位报告，正式实现后应返回任务 ID 和报告 ID。

请求：

```json
{
  "assignment_title": "Flask Web 项目实践",
  "course_id": "course_web_001",
  "student_id": "student_001",
  "repository_url": "https://example.com/repo.git",
  "rubric_id": "rubric_web_001"
}
```

响应：

```json
{
  "report_id": "report_001",
  "summary": "本次作业完成了基础路由和数据库模块...",
  "scores": [
    {
      "dimension": "功能完成度",
      "score": 82,
      "summary": "核心功能基本完成，异常路径覆盖不足。"
    }
  ],
  "findings": [
    "数据库连接配置写在业务模块中，建议迁移到配置层。"
  ]
}
```

### `GET /assignments/{assignment_id}/reports/{student_id}`

查看某个学生的作业分析报告。

### `GET /assignments/{assignment_id}/dashboard`

教师查看某次作业的班级分析看板。

响应包含：

- 提交统计。
- 维度分布。
- 共性问题。
- 学生报告列表。
- 讲评建议。

当前演示接口返回字段：

```json
{
  "assignment_id": "assignment_flask_mvp",
  "assignment_title": "Flask Web 项目实践",
  "submitted_count": 5,
  "total_students": 32,
  "average_score": 80,
  "metrics": [],
  "dimension_averages": [],
  "common_findings": [],
  "reports": []
}
```

## 4. 课程与班级

### `GET /courses`

查询当前用户可访问课程。

响应：

```json
{
  "courses": [
    {
      "course_id": "course_web_2026",
      "name": "Web 应用开发",
      "term": "2025-2026 春季学期",
      "teacher_name": "周老师"
    }
  ]
}
```

### `GET /courses/{course_id}/classes`

查询课程下班级。

响应：

```json
{
  "course_id": "course_web_2026",
  "classes": [
    {
      "class_id": "class_cs_2024_01",
      "name": "2024 级计算机科学与技术 1 班",
      "student_count": 32
    }
  ]
}
```

### `GET /classes/{class_id}/students`

查询班级学生列表。

响应：

```json
{
  "class_id": "class_cs_2024_01",
  "students": [
    {
      "student_id": "student_001",
      "name": "林一舟",
      "target_path": "AI 应用开发 / 软件项目实践",
      "tags": ["工程实践", "RAG", "后端接口"]
    }
  ]
}
```

## 5. 学生画像

### `GET /students/me/profile`

学生查看个人能力画像。

### `GET /students/{student_id}/profile`

教师在授权课程或班级范围内查看学生画像摘要。

画像返回：

- 维度分数。
- 证据列表。
- 最近作业表现。
- 推荐提升方向。

演示接口返回字段：

```json
{
  "student_id": "student_001",
  "student_name": "林一舟",
  "target_path": "AI 应用开发 / 软件项目实践",
  "dimensions": [],
  "strengths": [],
  "risks": [],
  "next_actions": []
}
```

## 6. 学习路径

### `POST /plans/generate`

生成学习计划。

请求：

```json
{
  "student_id": "student_001",
  "goal": "三个月内完成 AI 应用开发 Demo 并准备校级双创项目",
  "weeks": 8
}
```

响应包含阶段任务、资源和检查点。

### `POST /plans/{plan_id}/revise`

用户确认后修改学习计划。

### `POST /plans/{plan_id}/tasks`

保存计划中的任务。

当前演示版本提供任务中心接口：

### `GET /students/{student_id}/tasks`

查询学生任务列表，包含来源、状态、优先级、截止日期、证据要求和进度。

### `POST /tasks`

保存用户确认后的推荐任务。

### `POST /reviews/generate`

生成阶段复盘。

请求：

```json
{
  "student_id": "student_001",
  "period": "本周",
  "completed_task_ids": ["task_demo_script"],
  "notes": "已完成部署说明和演示脚本。"
}
```

响应包含复盘摘要、风险提示和下一步任务。

## 7. 竞赛推荐

### `GET /competitions`

查询首批计算机相关竞赛信息库。

响应包含：

- 竞赛名称。
- 主办方。
- 赛道。
- 报名时间口径。
- 参赛要求。
- 作品要求。
- 官方链接。
- 更新时间。

当前演示版本内置至少 8 个竞赛或赛道。具体报名时间、组别和规则以官方通知为准，管理员可维护更新。

### `POST /competitions/recommend`

根据学生画像、目标方向和时间约束推荐竞赛。

响应包含：

- 推荐竞赛。
- 匹配理由。
- 准备路径。
- 风险提示。
- 引用来源。

演示接口返回中国大学生计算机设计大赛、中国国际大学生创新大赛、蓝桥杯等推荐项。

## 8. 组队推荐

### `POST /teams/requests`

发布结构化组队需求。

请求：

```json
{
  "student_id": "student_001",
  "competition_name": "中国大学生计算机设计大赛",
  "project_direction": "AI 应用开发与教学智能体",
  "missing_roles": ["前端与交互", "算法与评测"],
  "expected_skills": ["React", "RAG", "测试评测"],
  "weekly_hours": 8,
  "communication": "每周一次线上同步",
  "team_status_enabled": true
}
```

响应包含组队需求卡片、发布状态、进入推荐池状态和联系方式可见性。联系方式默认不公开。

### `GET /students/{student_id}/team-status`

查询学生是否主动开启组队状态，以及联系方式是否公开。

### `POST /teams/recommend`

根据项目或竞赛目标推荐组队候选。

响应包含：

- 候选人列表。
- 能力互补说明。
- 合作建议。
- 推荐证据。

演示接口返回前端交互、算法评测、产品答辩等互补角色。

## 9. 知识库

### `POST /knowledge/documents`

上传知识库资料。

当前演示版本提供资料清单查询：

### `GET /knowledge/documents`

响应：

```json
{
  "total": 31,
  "documents": [
    {
      "document_id": "doc_001",
      "title": "Web 应用开发课程作业 Rubric",
      "source_type": "rubric",
      "path": "软件项目实践",
      "tags": ["作业分析", "Rubric", "Web"],
      "chunk_count": 1,
      "status": "已入库"
    }
  ]
}
```

当前演示版本覆盖至少 5 门核心课程、10 条竞赛资料、10 个项目案例或学习资源，并额外包含 Rubric、组队规则和教师看板说明等支撑资料。

### `POST /knowledge/documents/{document_id}/ingest`

解析、切分并入向量库。

### `GET /knowledge/search`

检索知识库。

查询参数：

- `q`
- `course_id`
- `path`
- `limit`

响应包含命中文本、来源、引用元数据。

当前演示接口返回字段：

```json
{
  "query": "作业 Rubric",
  "total": 1,
  "results": [
    {
      "title": "Web 应用开发课程作业 Rubric",
      "source_type": "rubric",
      "path": "软件项目实践",
      "snippet": "课程作业评分参考功能完成度、代码结构、工程规范、测试意识和文档表达。",
      "score": 0.5
    }
  ]
}
```

## 10. 测试评测

### `GET /evaluations/dashboard`

查询评测看板，包含典型测试案例、系统输出记录、引用来源、人工评价和问题记录。

响应：

```json
{
  "summary": {
    "total_cases": 3,
    "completed_records": 3,
    "average_score": 87,
    "pass_rate": 100
  },
  "cases": [
    {
      "case_id": "eval_rag_algorithm_path",
      "scenario": "知识库问答",
      "input_question": "如何准备算法竞赛？",
      "expected_focus": ["引用课程与竞赛资料", "给出阶段任务"],
      "priority": "P0",
      "status": "已记录"
    }
  ],
  "records": [
    {
      "record_id": "record_001",
      "case_id": "eval_rag_algorithm_path",
      "scenario": "知识库问答",
      "system_output": "建议先按搜索、动态规划、图论和数学基础建立题单...",
      "manual_score": 86,
      "issue_notes": "路径拆解清晰；后续需要补更多官方赛事链接和年份信息。",
      "ai_generated": true
    }
  ]
}
```

### `GET /evaluations/cases`

查询典型测试案例清单。

### `GET /evaluations/records`

查询测试输出记录清单。

当前演示版本至少提供 3 个典型测试案例和 3 条完整输出记录。

## 11. 任务状态

### `GET /tasks/{task_id}`

查询长任务状态。

### `POST /tasks/{task_id}/cancel`

取消任务。

### `POST /tasks/{task_id}/resume`

恢复等待用户输入或失败后可重试的任务。
