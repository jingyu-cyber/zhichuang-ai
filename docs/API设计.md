# API 设计草案

接口前缀：`/api`

鉴权约定：公网 Demo 使用 `POST /auth/demo-session` 返回的演示 token。需要角色或授权范围控制的接口通过 `Authorization: Bearer <token>` 传入账号身份；未传 token 时，作业分析相关接口默认使用教师演示账号，便于本地快速演示。越权访问返回 `403`。

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
示例 token 格式为 `demo-token-teacher_001`，仅用于 Demo 和本地开发。

### 2.2 智能体对话

#### `POST /agent/chat`

用于学生或教师发起自然语言任务。

请求：

```json
{
  "message": "帮我制定蓝桥杯算法训练计划",
  "scenario": "student",
  "session_id": "session_student_001",
  "history": [
    {"role": "user", "content": "我想参加算法竞赛"},
    {"role": "assistant", "content": "可以先按基础语法、数据结构和搜索专题推进。"}
  ]
}
```

响应：

```json
{
  "session_id": "session_student_001",
  "answer": "如果目标是算法竞赛准备，建议按训练路径拆成阶段任务...",
  "context_summary": "学生视角 · 已结合前 1 轮用户追问。",
  "suggested_next_questions": ["下一周我应该先补哪项能力？"],
  "citations": [
    {
      "title": "算法竞赛训练路径",
      "source_type": "competition_material",
      "path": "算法竞赛",
      "updated_at": "2026-07-05T09:30:00+08:00",
      "snippet": "算法竞赛准备建议按基础语法、常用数据结构、搜索、动态规划、图论和真题复盘推进。"
    }
  ],
  "is_uncertain": false,
  "retrieval_status": "matched",
  "ai_generated": true
}
```

连续追问时前端会携带同一 `session_id` 和最近上下文，后端基于角色场景生成回答，避免教师诊断问题被误判为学生个人规划问题。
当知识库没有找到足够依据时，`is_uncertain` 为 `true`、`retrieval_status` 为 `no_match`，回答会明确提示“不确定”，且 `citations` 返回空数组。

## 3. 作业代码分析

### `POST /assignments/analyze`

提交课程作业代码文件、仓库链接或说明，系统生成一份基于提交物证据的作业分析报告。首版支持直接传入文件路径和文本内容，后续可接入压缩包解析或仓库拉取。

请求：

```json
{
  "assignment_title": "Flask Web 项目实践",
  "course_id": "course_web_001",
  "student_id": "student_001",
  "repository_url": "https://example.com/repo.git",
  "rubric_id": "rubric_web_001",
  "files": [
    {
      "path": "app.py",
      "content": "from flask import Flask\napp = Flask(__name__)"
    },
    {
      "path": "tests/test_app.py",
      "content": "def test_home(): assert True"
    },
    {
      "path": "README.md",
      "content": "Flask Web 项目实践"
    }
  ]
}
```

响应：

```json
{
  "report_id": "report_assignment_flask_mvp_student_001",
  "summary": "林一舟 的提交已经完成多维度分析。系统识别到 5 个文件、4 类能力信号，评分是基于提交物证据的相对画像。",
  "code_structure": {
    "file_count": 5,
    "entry_files": ["app.py"],
    "test_files": ["tests/test_app.py"],
    "documentation_files": ["README.md"],
    "config_files": ["requirements.txt"],
    "detected_frameworks": ["Flask"],
    "detected_capabilities": ["路由入口", "数据访问", "自动化测试"],
    "risk_signals": []
  },
  "scores": [
    {
      "dimension": "功能完成度",
      "score": 82,
      "summary": "核心路由、接口或数据访问证据较清晰，主流程具备闭环基础。",
      "evidence": ["识别到路由入口能力信号", "提交文件数 5，可用于判断功能覆盖面。"]
    }
  ],
  "findings": [
    {
      "severity": "low",
      "title": "继续提升边界场景说明",
      "detail": "当前提交具备较完整的结构证据，后续仍建议补充接口边界和失败路径说明。",
      "suggestion": "在 README 中加入接口表、错误处理策略和测试覆盖范围。"
    }
  ],
  "improvement_tasks": ["将本次报告中的能力证据同步到个人画像，用于后续路径和竞赛推荐。"],
  "access_scope": "teacher:authorized_course_class",
  "ai_generated": true
}
```

### `GET /assignments/{assignment_id}/reports/{student_id}`

查看某个学生的作业分析报告。
学生只能查看自己的报告；教师只能查看授权课程和班级下的学生报告；管理员可查看演示范围内报告。

### `GET /assignments/{assignment_id}/dashboard`

教师查看某次作业的班级分析看板。
学生账号访问班级看板会返回 `403`。

响应包含：

- 提交统计。
- 维度分布。
- 共性问题。
- 班级能力画像：能力热力图、方向分布、数据覆盖率、共性短板。
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
  "class_profile": {
    "heatmap": [
      {
        "student_id": "student_001",
        "student_name": "林一舟",
        "dimension": "测试意识",
        "score": 71,
        "level": "weak"
      }
    ],
    "direction_distribution": [{"direction": "AI 应用开发", "count": 1, "ratio": 0.2}],
    "data_coverage": [{"label": "测试证据", "covered": 5, "total": 5, "ratio": 1.0}],
    "common_weaknesses": ["测试意识均分 71，需要重点跟进"],
    "summary": "已基于 5 份作业报告生成班级能力分布。"
  },
  "teaching_suggestions": [
    {
      "knowledge_point": "接口测试与业务逻辑测试",
      "class_evidence": "5 份已分析提交中出现“测试覆盖偏弱”；测试意识均分 71。",
      "suggested_activity": "用一份学生提交演示 pytest/TestClient 的成功、失败、空输入三类测试写法。",
      "practice_task": "下一次提交至少包含 3 个 API 测试和 2 个 service 层单元测试。",
      "expected_improvement": "让学生把功能完成从人工试运行推进到可复现验证，提升测试意识维度。"
    }
  ],
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

每个能力维度包含结构化 `evidence_items`，记录来源类型、来源标题、证据摘要和置信度。

### `PUT /students/{student_id}/profile`

学生提交或更新基础画像。首版字段覆盖年级、专业、课程基础、技能标签、项目经历、竞赛经历、目标方向、每周投入时间和 GitHub 链接，适合 5 分钟内完成冷启动。

请求：

```json
{
  "student_name": "林一舟",
  "grade": "大二",
  "major": "计算机科学与技术",
  "course_foundation": ["程序设计基础", "数据结构", "数据库系统"],
  "skill_tags": ["Flask", "RAG", "GitHub"],
  "project_experiences": ["Flask Web 作业项目"],
  "competition_experiences": ["蓝桥杯校内训练"],
  "target_direction": "AI 应用开发 / 软件项目实践",
  "weekly_hours": 8,
  "github_url": "https://github.com/demo/zhichuang-agent"
}
```

响应返回更新后的画像，并在 `profile_summary` 中展示填写摘要和 `completion_minutes_estimate`。

### `POST /students/{student_id}/profile/evidence`

学生补充自评或证据材料，用于后续画像更新。

请求：

```json
{
  "dimension": "工程实践",
  "source_type": "student_self_report",
  "source_title": "学生补充自评",
  "evidence_text": "补充了 Flask 作业测试截图和 README 运行说明。",
  "confidence": 0.42
}
```

响应返回已记录的证据项。学生自评证据可用于冷启动或补充说明，置信度低于作业报告、竞赛证书、教师评价等可验证证据。

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
  "weeks": 8,
  "weekly_hours": 8,
  "foundation": "工程实践较好，算法和测试需要补强"
}
```

响应包含阶段任务、资源、检查点和生成依据。`basis` 会说明目标方向、每周可投入时间、短板维度和基础描述，用于证明计划不是固定模板。

### `POST /plans/{plan_id}/revise`

用户确认后修改学习计划。

请求：

```json
{
  "student_id": "student_001",
  "feedback": "时间不足，需要压缩每周任务",
  "weeks": 4,
  "weekly_hours": 3
}
```

响应仍为学习计划结构，并返回 `revision_note` 说明根据反馈调整了任务顺序、周数和投入强度。

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
- 匹配度。
- `fit_reasons`：适合原因。
- `gap_abilities`：需要补足的能力。
- 准备路径。
- 风险提示。
- 引用来源。

演示接口返回中国大学生计算机设计大赛、中国国际大学生创新大赛、蓝桥杯等推荐项。每个推荐项必须同时包含“适合原因”和“需要补足的能力”，避免只给出无法解释的匹配分。

### `POST /competitions/preparation-plan`

对目标竞赛生成准备计划，覆盖知识补齐、项目实践、材料准备和报名节点。

请求：

```json
{
  "student_id": "student_001",
  "competition_name": "中国大学生计算机设计大赛",
  "weeks": 4,
  "weekly_hours": 8
}
```

响应包含：

- 竞赛名称。
- 报名时间口径。
- 官方链接。
- 周计划里程碑。
- 每周任务和交付物。
- 来自参赛要求、作品要求和报名时间的引用依据。
- 风险提示。

计划中的报名时间、组别和材料格式均以官方通知为准。

## 8. 教师竞赛梯队筛选

### `POST /teacher/candidate-screening`

教师在授权班级范围内选择竞赛或项目要求，系统返回候选学生梯队。学生账号访问返回 `403`。

请求：

```json
{
  "target_name": "中国大学生计算机设计大赛",
  "target_type": "competition",
  "target_abilities": ["工程实践", "AI 与数据能力", "协作表达"],
  "class_id": "class_cs_2024_01",
  "min_score": 60
}
```

响应包含：

- 候选学生。
- 梯队标签。
- 能力匹配说明。
- 推荐理由。
- 缺口提醒。
- 画像和作业证据。

结果仅作为教学和竞赛指导参考，不作为审核结论。

## 9. 组队推荐

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

### `PATCH /students/{student_id}/team-status`

学生开启或撤回进入组队推荐池的授权。联系方式默认不公开，即使请求传入 `contact_visible: true`，首版仍返回 `false`。

请求：

```json
{
  "team_status_enabled": false,
  "contact_visible": false
}
```

### `POST /teams/recommend`

根据项目或竞赛目标推荐组队候选。

响应包含：

- 候选人列表。
- 能力互补说明。
- 合作建议。
- 推荐证据。

推荐候选只包含主动开启组队状态的学生；未授权学生不会出现在结果中。演示接口返回前端交互、算法评测等互补角色。

## 10. 知识库

### `POST /knowledge/documents`

上传知识库资料。

请求：

```json
{
  "title": "课程项目复盘模板",
  "source_type": "project_case",
  "path": "软件项目实践",
  "tags": ["复盘", "项目文档"],
  "content": "课程项目复盘需要记录目标、完成情况、阻塞问题、下周任务和证据链接。",
  "source_url": "https://example.edu/templates/review",
  "maintainer": "平台管理员"
}
```

响应返回入库后的资料卡片、是否可检索和处理结果。演示版本会将新增资料加入当前服务会话中的知识库，随后可通过资料清单和检索接口验证。
知识库维护接口需要管理员演示 token；学生或教师账号访问返回 `403`。

### `PUT /knowledge/documents/{document_id}`

编辑知识库资料标题、类型、路径、标签、正文、来源链接和维护人。响应返回最新资料卡片，`version` 自动递增并记录一次 `update` 版本。

### `PATCH /knowledge/documents/{document_id}/status`

更新资料状态。首版用于下线资料：

```json
{
  "status": "已下线",
  "maintainer": "平台管理员"
}
```

下线资料仍出现在资料清单和版本记录中，但不再进入检索结果。

### `GET /knowledge/documents/{document_id}/versions`

查看知识库资料版本变化，返回版本号、动作、维护人、更新时间和变更摘要。

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
      "status": "已入库",
      "source_url": null,
      "maintainer": "平台管理员",
      "version": 1,
      "updated_at": "2026-07-05T09:30:00+08:00"
    }
  ]
}
```

当前演示版本覆盖至少 5 门核心课程、10 条竞赛资料、10 个项目案例或学习资源，并额外包含 Rubric、组队规则和教师看板说明等支撑资料。

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

### `POST /evaluations/cases`

管理员新增典型测试案例。学生或教师账号访问返回 `403`。

请求：

```json
{
  "scenario": "竞赛准备计划",
  "input_question": "为中国大学生计算机设计大赛生成 4 周准备计划",
  "expected_focus": ["时间节点", "官方依据", "交付物"],
  "priority": "P0",
  "status": "已记录"
}
```

### `GET /evaluations/records`

查询测试输出记录清单。

### `POST /evaluations/records`

管理员新增测试输出记录，保存输入、系统输出、引用来源、人工评分和问题记录。

请求：

```json
{
  "case_id": "eval_custom_004",
  "scenario": "竞赛准备计划",
  "input_question": "为中国大学生计算机设计大赛生成 4 周准备计划",
  "system_output": "系统生成 4 周准备计划，包含报名节点和作品交付物。",
  "manual_score": 88,
  "issue_notes": "计划结构完整，引用依据明确。",
  "reviewer": "项目评测组"
}
```

当前演示版本至少提供 3 个典型测试案例和 3 条完整输出记录。

## 11. 任务状态

### `GET /tasks/{task_id}`

查询长任务状态。

### `POST /tasks/{task_id}/cancel`

取消任务。

### `POST /tasks/{task_id}/resume`

恢复等待用户输入或失败后可重试的任务。
