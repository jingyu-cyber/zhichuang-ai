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

## 2. 智能体对话

## 2.1 演示账号

### `GET /auth/demo-accounts`

公网 Demo 获取学生、教师、管理员三个演示账号。

### `POST /auth/demo-session`

请求：

```json
{
  "user_id": "teacher_001"
}
```

响应包含演示 token、账号角色、授权课程、授权班级和可访问模块。

## 2.2 智能体对话

### `POST /agent/chat`

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

### `GET /courses/{course_id}/classes`

查询课程下班级。

### `GET /classes/{class_id}/students`

查询班级学生列表。

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

## 7. 竞赛推荐

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
  "total": 6,
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

## 10. 任务状态

### `GET /tasks/{task_id}`

查询长任务状态。

### `POST /tasks/{task_id}/cancel`

取消任务。

### `POST /tasks/{task_id}/resume`

恢复等待用户输入或失败后可重试的任务。
