# 智创Agent·计算机学科垂类大模型与双创能力赋能平台：项目架构设计与技术选型

## 一、文档说明

本文档面向“智创Agent·计算机学科垂类大模型与双创能力赋能平台”的工程实现，承接需求分析文档，重点回答以下问题：

1. 系统整体架构如何拆分。
2. 前端、后端、数据、RAG、大模型调用分别选什么技术。
3. 学生项目管理、知识库、竞赛推荐、组队推荐如何落到模块和数据表。
4. 如何保证可追溯、可复现、可部署、可扩展。
5. 哪些能力进入 MVP，哪些能力作为 P1/P2 扩展。

本项目不以从零训练基础模型为目标，而是基于通用大模型、计算机学科知识库、RAG 检索增强和场景化工作流，构建一个可运行、可验证、可追溯的学科垂类智能体应用。

---

## 二、架构目标与约束

### 2.1 架构目标

| 目标 | 说明 |
|---|---|
| 主线清晰 | 以学生端项目管理闭环和教师端项目学情诊断闭环为主线 |
| 可信可追溯 | 事实性回答必须有知识库来源、引用片段和更新时间 |
| 快速可部署 | 采用成熟 Web 技术栈和轻量部署方式，保证短周期内形成可访问版本 |
| 数据可控 | 系统面向学校真实使用，支持课程、项目、学生提交等真实数据按权限访问 |
| 模型可替换 | 大模型通过 Provider Adapter 接入，可选择通用大模型、开源大模型、OpenAI-compatible 服务或本地模型 |
| 推荐可解释 | 推荐结果必须展示评分依据、证据来源、短板和风险提醒 |
| 交付可复现 | 代码、样例数据、部署说明、测试用例和学校账号入口可一起交付 |

### 2.2 工程约束

| 约束 | 设计响应 |
|---|---|
| 团队开发周期有限 | 优先单体后端 + 模块化目录，不做微服务拆分 |
| 数据规模首版较小 | 开发期用 SQLite + 本地向量库快速迭代，部署期再切换 PostgreSQL + pgvector |
| 需要展示 RAG 能力 | 知识库文档、切片、向量、引用记录独立建模 |
| 需要兼容比赛平台 | 模型调用层抽象 Provider，避免绑定单一厂商 |
| 个人数据需要边界控制 | RBAC 权限控制、组队主动开启、教师按课程和班级范围查看 |
| 教师学情诊断是核心教学场景 | 项目分析和教师看板进入 MVP，竞赛候选筛选等能力后续扩展 |

---

## 三、总体架构

### 3.1 分层架构

```text
┌──────────────────────────────────────────────────────────────┐
│                         用户访问层                            │
│  学生端 Web       教师端 Web       管理端 Web       鸿蒙端（P1） │
└──────────────────────────────┬───────────────────────────────┘
                               │ HTTPS / REST / SSE
┌──────────────────────────────▼───────────────────────────────┐
│                         前端应用层                            │
│  Web：React + TypeScript + Vite + Ant Design + ECharts         │
│  鸿蒙：ArkTS + ArkUI                                           │
│  页面路由 / 状态管理 / API 请求 / 流式回答展示 / 图表可视化        │
└──────────────────────────────┬───────────────────────────────┘
                               │
┌──────────────────────────────▼───────────────────────────────┐
│                         后端 API 层                           │
│  FastAPI + Pydantic + SQLAlchemy                              │
│  鉴权 / RBAC / 业务 API / 文件上传 / SSE 流式输出 / 审计日志       │
└──────────────────────────────┬───────────────────────────────┘
                               │
┌──────────────────────────────▼───────────────────────────────┐
│                         业务服务层                            │
│  用户与权限    学生画像    学习路径    竞赛推荐    组队推荐        │
│  教师诊断      知识库管理  测试评测    通知提醒    报告导出        │
└──────────────────────────────┬───────────────────────────────┘
                               │
┌──────────────────────────────▼───────────────────────────────┐
│                         AI 能力层                             │
│  LangGraph Orchestrator     Model Provider Adapter            │
│  Agent Router               Prompt Template                    │
│  RAG Pipeline               Citation Checker  Safety Guard    │
│  Recommendation Explainer   Evaluation Runner                 │
└──────────────────────────────┬───────────────────────────────┘
                               │
┌──────────────────────────────▼───────────────────────────────┐
│                         数据支撑层                            │
│  开发期：SQLite + ChromaDB（FAISS 备选）                         │
│  部署期：PostgreSQL + pgvector    Redis    MinIO / 本地对象存储   │
│  业务数据 / 向量索引 / 会话记录 / 任务缓存 / 上传文档 / 评测记录    │
└──────────────────────────────┬───────────────────────────────┘
                               │
┌──────────────────────────────▼───────────────────────────────┐
│                         部署部署维护层                            │
│  Docker Compose + Nginx + 环境变量配置 + 日志与备份脚本           │
└──────────────────────────────────────────────────────────────┘
```

### 3.2 逻辑模块

| 模块 | 子模块 | MVP 优先级 | 说明 |
|---|---|---|---|
| 用户与权限 | 登录、角色、RBAC、学校账号入口 | P0 | 支持学生、教师、管理员 |
| 学生画像 | 基础信息、能力标签、证据材料、授权状态 | P0 | 学生端主线起点 |
| 知识库 | 文档上传、解析、切片、向量化、引用元数据 | P0 | RAG 和可追溯的核心 |
| 对话与 Agent | 意图识别、任务路由、流式回答、引用展示 | P0 | 统一承载问答和规划 |
| 学习路径 | 目标选择、路径生成、任务检查点、反馈调整 | P0 | 学生成长闭环核心 |
| 竞赛推荐 | 竞赛库、匹配评分、准备清单、推荐解释 | P0 | 连接知识库和画像 |
| 组队推荐 | 组队需求、推荐池、匹配排序、隐私授权 | P0 | 形成应用差异化亮点 |
| 项目管理与分析 | 项目档案、代码上传、仓库解析、能力证据提取、报告生成 | P0 | 支撑项目管理、画像证据和项目能力判断 |
| 测试评测 | 测试案例、输出记录、人工评分、效果报告 | P0 | 服务技术验证和演示复现 |
| 教师看板 | 项目分析看板、学生报告、班级能力分布、导出 | P0 | 教师直接查看系统分析结果 |
| 通知提醒 | 竞赛倒计时、组队申请、路径任务提醒 | P2 | 后续增强 |

---

## 四、技术选型总览

### 4.1 推荐技术栈

| 层级 | 推荐选型 | 选择理由 |
|---|---|---|
| 前端策略 | Web 首版：React + TypeScript + Vite；鸿蒙端：ArkTS + ArkUI | Web 端适合快速形成可访问版本，鸿蒙端适合后续移动端拓展，二者复用同一套后端 API |
| UI 组件 | Web 端使用 Ant Design；鸿蒙端使用 ArkUI 原生组件 | Web 端效率高，鸿蒙端需要原生体验，React UI 不能直接迁移为鸿蒙原生界面 |
| 图表可视化 | Web 端使用 ECharts；鸿蒙端按比赛需要使用原生图表、自绘或轻量图表方案 | Web 看板实现成本低，鸿蒙端优先保证核心流程和原生交互 |
| 状态与请求 | TanStack Query + Zustand | API 缓存、异步状态、轻量全局状态清晰 |
| 后端框架 | FastAPI | Python 生态适合 AI/RAG，接口文档自动生成，开发效率高 |
| ORM 与迁移 | SQLAlchemy + Alembic | 同一套模型可支持开发期 SQLite 和部署期 PostgreSQL |
| 开发期数据库 | SQLite | 本地开发简单，不依赖数据库服务，适合前期快速迭代 |
| 部署期数据库 | PostgreSQL | 多人协作、演示部署和后续扩展更稳 |
| 向量检索 | 开发期 ChromaDB 优先，FAISS 备选；部署期 pgvector | SQLite 不适合作为主向量库，向量索引独立出来更稳 |
| 缓存/任务状态 | Redis | 会话缓存、异步任务进度、限流和短期缓存 |
| 对象存储 | MinIO 或本地文件存储 | 存储上传资料、证书、截图、评测附件 |
| 文档解析 | pypdf、python-docx、openpyxl、Markdown parser | 覆盖 PDF、Word、Excel、Markdown 等常见知识资料 |
| 大模型接入 | Provider Adapter + 多模型兼容 | 架构避免绑定单一模型，便于按效果、成本和部署条件切换模型服务 |
| RAG 组件 | 轻量自研 Pipeline + 可替换组件 | 文档解析、切片、Embedding、向量检索、重排序、引用校验分层实现 |
| Agent 编排 | LangGraph + Pydantic State Schema | 支持长任务、多 Agent 拆分、用户交互节点、状态持久化和中断恢复 |
| 部署 | Docker Compose + Nginx | 一键部署，适合公网访问、学校环境部署和代码复现 |
| 测试 | pytest + Playwright | 后端单元测试和核心页面端到端测试 |

### 4.2 不优先选择的方案

| 方案 | 暂不优先的原因 |
|---|---|
| 微服务架构 | 首版团队规模和业务规模不需要，会增加部署和调试成本 |
| Elasticsearch / OpenSearch | 检索能力强，但首版部署维护较重；可作为后续规模化升级 |
| 从零微调模型 | 数据、算力、评测成本高；首版优先 RAG 和工作流闭环 |
| 完整教务系统对接 | 权限和数据接入周期不可控；首版支持手动导入课程、作业和学生提交数据 |
| 把所有业务逻辑塞进 Agent 框架 | 推荐评分、权限、引用校验等确定性逻辑应保留在业务 Service 中，由 LangGraph 编排调用 |

### 4.3 鸿蒙迁移策略

当前 Web 前端使用 React + Vite，适合快速完成浏览器可访问版本、后台管理和教师看板，但它不等于鸿蒙原生应用，不能直接迁移成 ArkTS/ArkUI 页面。

推荐采用“双前端、同后端”的策略：

| 层级 | Web 首版 | 鸿蒙端 |
|---|---|---|
| UI | React + Ant Design | ArkTS + ArkUI |
| 状态管理 | TanStack Query + Zustand | ArkTS 状态管理能力 |
| 图表 | ECharts | 原生图表、自绘或轻量图表方案 |
| API | REST/SSE | 复用同一套 REST/SSE 或改为移动端友好的接口 |
| 可复用部分 | 业务流程、接口协议、字段定义、权限逻辑 | 复用后端、数据模型、RAG、推荐算法和 OpenAPI 文档 |
| 需要重写部分 | 页面组件、路由、样式、交互细节 | 使用鸿蒙原生组件重写 |

迁移判断：

1. 如果只是参加 Web 或通用 AI 应用比赛，React 首版效率最高。
2. 如果后续参加鸿蒙比赛，建议新建鸿蒙原生客户端，复用后端 API 和业务流程，不建议只用 WebView 包一层。
3. 前期设计 API 时保持移动端友好，避免把业务逻辑写死在 Web 前端。
4. 知识库、RAG、推荐算法、画像评分都放在后端，确保鸿蒙端只是新的客户端，不需要重做智能能力。

---

## 五、前端架构设计

### 5.1 前端页面结构

```text
/login                         学校账号登录
/student/projects              项目中心
/student/profile               个人中心与画像编辑
/student/agent                 智能问答与学习规划
/student/learning-path         学习路径详情
/student/competitions          竞赛列表与推荐
/student/team                  组队需求与队友推荐
/teacher/dashboard             教师看板
/teacher/projects              项目学情看板
/teacher/reports               学生项目分析报告
/admin/knowledge               知识库管理
/admin/competitions            竞赛信息维护
/admin/evaluation              测试案例与输出记录
```

### 5.2 前端模块划分

```text
src/
  app/                          应用入口、路由、全局 Provider
  pages/                        页面级组件
  components/                   通用 UI 组件
  features/
    auth/                       登录、角色、权限
    profile/                    学生画像
    agent/                      对话、流式输出、引用展示
    knowledge/                  知识库管理
    competition/                竞赛推荐
    team/                       组队推荐
    teacher/                    教师看板
    evaluation/                 测试与反馈
  api/                          API client
  stores/                       Zustand 全局状态
  types/                        TypeScript 类型
  utils/                        工具函数
```

### 5.3 前端关键设计

| 能力 | 设计 |
|---|---|
| 流式回答 | 使用 SSE 接收后端流式 token，逐步展示生成内容 |
| 引用展示 | 回答正文下方固定展示来源卡片：标题、类型、更新时间、片段 |
| AI 标识 | 所有 Agent 输出组件统一带“AI 生成，仅供参考”提示 |
| 画像录入 | 多步骤表单，5 分钟内完成基础画像 |
| 推荐解释 | 推荐卡片固定包含“适合原因、待补短板、证据来源、风险提醒” |
| 教师看板 | 使用 ECharts 展示能力雷达图、热力图、方向分布 |
| 学校账号入口 | 支持学生、教师、管理员角色进入对应工作区，并可加载示例数据完成首版体验 |

### 5.4 鸿蒙端适配设计

鸿蒙端建议作为 P1 客户端单独建设，不从 React 页面直接迁移。迁移时复用的是后端能力和接口协议，而不是 Web UI 代码。

| 内容 | 是否可复用 | 说明 |
|---|---|---|
| 后端 API | 可复用 | 登录、画像、知识库、竞赛推荐、组队推荐接口保持一致 |
| 数据模型 | 可复用 | 使用 OpenAPI 和 TypeScript/Pydantic Schema 约束字段 |
| RAG 与推荐算法 | 可复用 | 全部放在后端，鸿蒙端只负责展示和交互 |
| 页面流程 | 可复用 | 画像创建、学习路径、竞赛推荐、组队推荐流程不变 |
| React 组件 | 不可直接复用 | 鸿蒙原生应用应使用 ArkTS + ArkUI 重写界面 |
| Ant Design 样式 | 不可直接复用 | 需要转为鸿蒙原生组件、布局和交互模式 |

鸿蒙端首版建议优先做学生端核心链路，教师端仍以 Web 为主：

1. 学校账号登录。
2. 学生画像查看与编辑。
3. 智能问答与引用展示。
4. 学习路径生成。
5. 竞赛推荐与组队推荐。

教师看板和管理端仍保留在 Web 端，保证项目分析和班级报告的展示效率。

---

## 六、后端架构设计

### 6.1 后端模块结构

```text
backend/
  app/
    main.py
    core/                       配置、日志、安全、异常处理
    api/                        REST API 路由
    models/                     SQLAlchemy 数据模型
    schemas/                    Pydantic 请求/响应模型
    services/
      auth_service.py
      profile_service.py
      knowledge_service.py
      rag_service.py
      agent_service.py
      learning_path_service.py
      competition_service.py
      team_match_service.py
      teacher_service.py
      evaluation_service.py
    ai/
      providers/                通用大模型、OpenAI-compatible、开源模型、本地模型适配
      prompts/                  模型提示模板
      graphs/                   LangGraph 图定义
      nodes/                    Graph 节点：检索、规划、评估、用户交互、保存
      workflows/                业务工作流封装
      retrievers/               检索与重排序
      guards/                   安全与引用校验
    tasks/                      异步任务：文档解析、向量化、报告生成
    repositories/               数据访问层
    tests/
  alembic/                      数据库迁移
  pyproject.toml
```

### 6.2 API 设计概览

| 领域 | API 示例 | 说明 |
|---|---|---|
| 鉴权 | `POST /api/auth/login` | 登录并返回访问令牌 |
| 当前用户 | `GET /api/me` | 获取角色、权限、基础信息 |
| 学生画像 | `POST /api/profiles/me` | 创建或更新本人画像 |
| 学生画像 | `GET /api/profiles/me` | 获取本人画像和证据 |
| 对话 Agent | `POST /api/agent/chat` | 普通非流式对话 |
| 对话 Agent | `GET /api/agent/chat/stream` | SSE 流式对话 |
| 知识库 | `POST /api/knowledge/documents` | 上传知识文档 |
| 知识库 | `POST /api/knowledge/documents/{id}/index` | 触发解析和向量化 |
| 竞赛 | `GET /api/competitions` | 获取竞赛列表 |
| 竞赛推荐 | `POST /api/competitions/recommend` | 根据画像推荐竞赛 |
| 学习路径 | `POST /api/learning-paths/generate` | 生成个性化学习路径 |
| 组队 | `POST /api/team/posts` | 发布组队需求 |
| 队友推荐 | `POST /api/team/recommend` | 推荐队友 |
| 代码分析 | `POST /api/projects/upload` | 上传项目代码或仓库压缩包 |
| 代码分析 | `POST /api/projects/{id}/analyze` | 启动代码与项目分析图工作流 |
| 长任务 | `GET /api/tasks/{id}` | 查询 LangGraph 长任务状态、当前节点和结果 |
| 长任务 | `POST /api/tasks/{id}/actions` | 用户保存、修改、继续或取消当前长任务 |
| 教师看板 | `GET /api/teacher/classes/{id}/dashboard` | 班级能力分布 |
| 项目看板 | `GET /api/teacher/projects/{id}/dashboard` | 查看授权课程或班级内项目提交情况、分数分布和常见问题 |
| 项目报告 | `GET /api/teacher/projects/{project_id}/reports/{student_id}` | 查看单个学生项目分析报告 |
| 评测 | `POST /api/evaluations/cases/run` | 运行测试案例 |
| 评测记录 | `POST /api/evaluations/records` | 保存测试案例输出、引用来源和人工评分 |

### 6.3 后端设计原则

1. API 层只做参数校验和权限判断，业务逻辑进入 Service。
2. AI 相关逻辑统一放在 `ai/` 目录，不散落在业务 Service 中。
3. 所有大模型输出尽量使用 Pydantic Schema 约束结构，减少自由文本失控。
4. 推荐排序先由规则和数据完成，大模型只负责解释和表达优化。
5. 所有 Agent 调用记录 prompt、模型、输入摘要、引用来源和评测记录，便于复现。

---

## 七、AI 与 RAG 架构设计

### 7.0 RAG 组件选型

RAG 不建议一开始绑定重型 Agent 框架。首版采用轻量自研 Pipeline，把各个组件拆开，便于替换、调试和答辩展示。

| 环节 | 推荐选型 | 说明 |
|---|---|---|
| 文档解析 | pypdf、python-docx、openpyxl、Markdown parser | 覆盖课程资料、竞赛通知、项目案例等常见格式 |
| 文档清洗 | 自研规则清洗 | 去页眉页脚、空行、重复标题、无意义字符 |
| 文档切片 | 自研语义切片 + 固定窗口兜底 | 优先按标题、章节、知识点切分，再按 token 长度兜底 |
| Embedding | Embedding Provider Adapter | 可接云端 embedding、开源 embedding 或本地 embedding |
| 开发期向量库 | ChromaDB 优先，FAISS 备选 | 不依赖 PostgreSQL，适合本地快速开发 |
| 部署期向量库 | pgvector | 与 PostgreSQL 合并部署，便于权限、引用和业务数据关联 |
| 关键词检索 | SQLite/PostgreSQL 全文检索或轻量 BM25 | 补足纯向量检索对专有名词、竞赛名称的不足 |
| 重排序 | Rerank Provider Adapter，可选 | 首版可先用向量分数 + 来源权重，效果不足时再加 rerank |
| 引用校验 | 自研 Citation Checker | 确保事实性回答能追溯到 chunk |
| 评测 | 自定义评测脚本 | 统计引用覆盖率、人工评分、错误案例 |

推荐路线：

1. 开发期：SQLite 存业务数据，ChromaDB 优先存向量索引，FAISS 作为更轻量的备选。
2. 演示部署期：PostgreSQL 存业务数据，pgvector 存向量索引。
3. Embedding 和大模型都通过 Provider Adapter 接入，不写死具体服务。
4. 不把 LangChain、LlamaIndex 等框架作为核心依赖；如开发时间紧，可局部借用其文档加载或切片能力，但业务流程、引用校验和推荐逻辑保持自有封装。

### 7.1 Model Provider Adapter

大模型调用层采用适配器模式：

```text
LLMClient
  ├── GenericLLMProvider         通用大模型服务适配
  ├── OpenAICompatibleProvider   兼容 OpenAI API 格式的模型服务
  ├── OpenSourceModelProvider    开源大模型服务，可选适配
  ├── LocalModelProvider         本地或校园服务器模型，可选
  └── MockProvider               测试和离线演示兜底
```

统一接口：

| 方法 | 说明 |
|---|---|
| `chat(messages, options)` | 普通对话 |
| `stream_chat(messages, options)` | 流式对话 |
| `embed(texts, options)` | 文本向量化 |
| `rerank(query, documents)` | 可选重排序 |

适配器层只处理模型差异，业务层不直接依赖具体厂商 SDK。

### 7.2 LangGraph 编排层

本项目将 LangGraph 作为 Agent 编排层，用于承载长任务、多 Agent 拆分、用户交互节点、中断恢复和状态持久化。LangGraph 不替代业务 Service，而是把 RAG、画像评分、竞赛匹配、代码分析、保存任务等能力编排成可追踪的图工作流。

适合进入 LangGraph 的任务：

| 任务 | 使用 LangGraph 的原因 |
|---|---|
| 学习路径规划 | 需要目标澄清、资料检索、计划生成、计划评估、用户保存或调整、阶段反馈 |
| 竞赛推荐 | 需要读取画像、检索竞赛规则、匹配评分、生成解释、评估风险、收藏或反馈 |
| 组队推荐 | 需要候选筛选、隐私授权、推荐解释、邀请发送、接受或拒绝状态流转 |
| 代码与项目分析 | 需要解析文件、理解项目结构、分 Agent 分析代码质量/技术栈/能力证据、生成报告 |
| 阶段反馈 | 需要读取历史任务、识别延期、重新规划、生成提醒和下一步动作 |
| 项目报告生成 | 需要对课程作业、竞赛作品、个人作品或双创项目执行多 Agent 分析，并沉淀可供教师查看的报告 |

不适合直接塞进 LangGraph 的内容：

1. 权限判断和 RBAC。
2. 学生画像基础评分公式。
3. 竞赛匹配和队友匹配的确定性排序。
4. Citation Checker 的引用校验规则。
5. 数据库 Repository 和文件存储逻辑。

这些内容保持为普通 Service 或 Tool，由 LangGraph 节点调用。

### 7.3 Agent Router 与图工作流

用户输入先进入 Agent Router，根据意图进入不同图工作流：

| 意图 | LangGraph 工作流 | 关键节点 | 输出 |
|---|---|---|---|
| 学科问答 | `KnowledgeQAGraph` | 意图识别、RAG 检索、回答生成、引用校验 | 带引用的解释 |
| 学习路径 | `LearningPlanGraph` | 画像读取、目标澄清、资料检索、规划、评估、用户保存或调整、任务保存 | 阶段化路径和任务 |
| 竞赛推荐 | `CompetitionRecommendGraph` | 画像读取、竞赛过滤、RAG 规则检索、匹配评分、解释生成、风险评估 | 推荐列表、理由、短板 |
| 组队推荐 | `TeamMatchGraph` | 需求解析、授权检查、候选筛选、匹配评分、解释生成、邀请状态流转 | 候选队友和匹配解释 |
| 代码分析 | `CodeAnalysisGraph` | 文件解析、结构摘要、代码质量分析、技术栈识别、能力证据提取、报告生成 | 项目分析报告 |
| 教师看板 | `TeacherDashboardGraph` | 权限检查、项目报告聚合、班级分布、共性问题摘要 | 班级项目分析看板 |
| 知识库维护 | `KnowledgeAdminGraph` | 文档解析、标签建议、切片预览、发布入库 | 文档摘要、标签建议 |

### 7.4 RAG Pipeline

```text
用户问题
  -> 权限与角色识别
  -> 意图识别
  -> 查询改写
  -> 向量检索
  -> 关键词召回
  -> 来源可信度过滤
  -> 重排序
  -> 上下文压缩
  -> 生成回答
  -> 引用校验
  -> AI 标识与不确定性提示
  -> 记录评测日志
```

### 7.5 知识库切片策略

| 文档类型 | 切片策略 | 元数据 |
|---|---|---|
| 课程大纲 | 按章节、知识点切分 | 课程、章节、适用年级、维护教师 |
| 竞赛通知 | 按报名、赛道、规则、作品要求切分 | 竞赛、主办方、年份、官方链接 |
| 项目案例 | 按背景、技术栈、实现步骤、成果切分 | 方向、难度、技能标签 |
| 学习资源 | 按主题和阶段切分 | 路径、知识点、资源类型 |
| 教师资料 | 按文档结构切分 | 来源、维护人、更新时间 |

### 7.6 引用与可追溯设计

每次 RAG 回答必须返回：

| 字段 | 说明 |
|---|---|
| `source_id` | 知识条目 ID |
| `chunk_id` | 文档切片 ID |
| `title` | 来源标题 |
| `source_type` | 课程大纲、竞赛通知、项目案例等 |
| `updated_at` | 来源更新时间 |
| `snippet` | 支撑回答的片段 |
| `confidence` | 检索相关度或可信度 |

生成后执行 Citation Checker：

1. 检查回答中的事实性句子是否能关联到检索片段。
2. 对无法确认的信息增加“不确定”或“需以官方通知为准”提示。
3. 禁止生成不存在的竞赛时间、报名链接、证书信息和教师评价。

### 7.7 模型提示模板管理

模型提示模板按场景模板化：

```text
prompts/
  system_base.md
  knowledge_qa.md
  learning_path.md
  competition_recommend.md
  team_match_explanation.md
  teacher_insight.md
  safety_refusal.md
```

模型提示模板基本约束：

1. 不编造来源。
2. 不把画像分数描述为绝对能力判断。
3. 不输出虚假竞赛经历、证书、论文或项目成果。
4. 对不确定信息明确提示需要核验。
5. 面向学生给出可执行建议，面向教师给出统计性和指导性建议。

---

## 八、数据架构设计

### 8.0 数据库阶段策略

前期开发建议先用 SQLite，降低本地环境成本；但需要从一开始通过 SQLAlchemy + Alembic 管理模型和迁移，避免后期切换 PostgreSQL 时重写数据层。

| 阶段 | 业务数据库 | 向量库 | 适用场景 |
|---|---|---|---|
| 本地开发 | SQLite | ChromaDB 优先，FAISS 备选 | 单人开发、快速调接口、跑样例数据 |
| 团队联调 | PostgreSQL | pgvector 或 ChromaDB | 多人共用数据、接口联调、演示环境 |
| 比赛部署 | PostgreSQL | pgvector | 可复现部署、权限控制、数据备份 |
| 鸿蒙端本地缓存 | 鸿蒙本地关系型存储 | 不在端侧做主 RAG | 缓存登录态、最近会话、轻量配置 |

设计原则：

1. 业务表结构尽量使用 SQLite 和 PostgreSQL 都支持的数据类型。
2. JSON 字段可以用于学习路径、推荐理由等结构化结果，但核心查询字段要独立成列。
3. 向量检索不要强行塞进 SQLite 主业务库；开发期用 ChromaDB 优先、FAISS 备选，部署期再切 pgvector。
4. Repository 层屏蔽数据库差异，业务 Service 不直接写 SQL。

### 8.1 核心数据表

| 表名 | 说明 | 关键字段 |
|---|---|---|
| `users` | 用户基础信息 | id、role、name、major、grade、class_id |
| `roles` | 角色 | student、teacher、admin |
| `student_profiles` | 学生画像 | user_id、goals、skills、availability、team_opt_in |
| `profile_dimensions` | 能力维度评分 | profile_id、dimension、score、confidence、summary |
| `profile_evidences` | 画像证据 | profile_id、type、title、url、verified_level |
| `knowledge_documents` | 知识文档 | title、source_type、owner_id、status、updated_at |
| `knowledge_chunks` | 知识切片 | document_id、content、metadata、embedding |
| `competitions` | 竞赛信息 | name、type、organizer、deadline、official_url |
| `competition_tracks` | 竞赛赛道 | competition_id、name、requirements、deliverables |
| `learning_paths` | 学习路径 | user_id、goal、plan_json、status |
| `learning_tasks` | 路径任务 | path_id、title、due_date、status |
| `graph_runs` | LangGraph 执行记录 | graph_name、user_id、status、current_node、checkpoint_id |
| `graph_events` | 图执行事件 | run_id、node_name、event_type、payload、created_at |
| `workflow_actions` | 用户交互动作 | run_id、user_id、action_type、payload、created_at |
| `assignments` | 项目任务 | teacher_id、course_id、title、deadline、rubric_json |
| `assignment_submissions` | 项目提交 | assignment_id、student_id、project_id、submitted_at、status |
| `team_posts` | 组队需求 | owner_id、competition_id、roles_needed、status |
| `team_matches` | 队友推荐记录 | post_id、candidate_id、score、reason_json |
| `project_uploads` | 项目或代码上传 | user_id、file_path、repo_url、status、language_summary |
| `code_analysis_reports` | 代码分析报告 | project_id、run_id、assignment_id、summary、scores_json、findings_json、evidence_json |
| `conversations` | 会话 | user_id、agent_type、title |
| `messages` | 消息 | conversation_id、role、content、model_name |
| `rag_citations` | 引用记录 | message_id、chunk_id、score、snippet |
| `evaluation_records` | 评测记录 | case_id、input、output、citations、score、notes |
| `evaluation_cases` | 测试案例 | title、input、expected_points |
| `evaluation_runs` | 测试运行 | case_id、output、score、reviewer |
| `audit_logs` | 审计日志 | user_id、action、resource_type、resource_id |

### 8.2 画像评分数据结构

能力画像采用“分数 + 证据 + 置信度”的结构，不做绝对能力判断。

```json
{
  "dimension": "algorithm",
  "score": 72,
  "confidence": 0.68,
  "summary": "具备基础数据结构能力，有蓝桥杯训练经历，但图算法证据不足。",
  "evidences": [
    {
      "type": "self_assessment",
      "title": "学生自评：完成过基础算法训练",
      "verified_level": "low"
    },
    {
      "type": "project",
      "title": "GitHub 项目：题解仓库",
      "verified_level": "medium"
    }
  ]
}
```

### 8.3 知识条目元数据

```json
{
  "title": "蓝桥杯软件赛报名与比赛说明",
  "source_type": "competition_notice",
  "path": "algorithm_competition",
  "course": "算法设计与分析",
  "tags": ["蓝桥杯", "算法竞赛", "C++", "Python"],
  "authority_level": "official",
  "official_url": "https://example.com",
  "maintainer": "admin",
  "updated_at": "2026-07-04"
}
```

### 8.4 权限模型

| 角色 | 可访问数据 |
|---|---|
| 学生 | 本人画像、本人会话、公开竞赛信息、公开知识库、已授权组队信息 |
| 教师 | 授权班级统计信息、项目分析看板、学生项目分析报告、公开知识库 |
| 管理员 | 知识库、竞赛库、测试案例、课程数据、系统配置 |

权限规则：

1. 学生画像默认仅本人可见。
2. 学生开启组队状态后，才进入队友推荐池。
3. 教师端优先展示课程和班级范围内的数据，查看单个学生信息需符合角色权限。
4. 所有敏感操作写入审计日志。

---

## 九、核心业务流程设计

### 9.1 知识库入库流程

```text
管理员上传文档
  -> 文档格式校验
  -> 文本解析
  -> 元数据填写或自动建议
  -> 文档切片
  -> 向量化
  -> 写入 knowledge_documents / knowledge_chunks
  -> 管理员预览检索效果
  -> 发布到可用知识库
```

关键要求：

1. 未发布文档不参与学生端检索。
2. 每个文档必须填写来源类型和更新时间。
3. 官方来源、教师维护资料优先级高于学生整理资料。

### 9.2 学习路径生成流程

```text
学生选择目标方向
  -> 读取学生画像
  -> 检索路径相关知识库
  -> 识别能力短板
  -> 生成阶段目标
  -> 生成每阶段任务
  -> 引用课程/资源/竞赛来源
  -> 学生保存、修改或反馈
  -> 保存 learning_paths / learning_tasks
```

输出结构：

| 字段 | 说明 |
|---|---|
| 当前基础判断 | 基于画像证据的相对判断 |
| 阶段目标 | 例如 0-1 个月、1-3 个月、3-6 个月 |
| 学习任务 | 推荐课程、知识点、练习、项目 |
| 检查点 | 可验证成果，例如完成项目、题单、作品原型 |
| 风险提醒 | 时间不足、基础薄弱、证据不足等 |
| 引用来源 | 课程大纲、竞赛要求、项目案例 |

### 9.3 竞赛推荐流程

```text
学生发起竞赛推荐
  -> 读取画像和目标方向
  -> 过滤可报名或可准备竞赛
  -> 计算规则匹配分
  -> 检索竞赛规则和赛道要求
  -> 大模型生成推荐解释
  -> Citation Checker 校验事实
  -> 返回推荐列表和准备清单
```

推荐结果必须包含：

1. 为什么适合。
2. 哪些能力还需要补。
3. 建议准备什么材料或项目。
4. 哪些信息来自官方或教师维护资料。
5. 哪些判断只是系统建议，需要用户自行核验。

### 9.4 组队推荐流程

```text
学生发布组队需求
  -> 校验是否公开进入推荐池
  -> 读取候选学生授权状态
  -> 计算技能互补度、目标一致性、时间匹配度
  -> 生成候选列表
  -> 大模型生成沟通建议
  -> 隐藏默认联系方式
  -> 双方接受邀请后开放进一步沟通
```

组队推荐不使用性格、社交兼容性等缺少可靠证据的指标。

### 9.5 项目分析流程（P0）

```text
学生提交课程作业、竞赛作品、个人作品或双创项目
  -> 文件安全检查与格式解析
  -> 识别项目结构、语言、依赖和入口文件
  -> 代码结构 Agent 分析模块划分和工程组织
  -> 功能完成度 Agent 对照项目说明和绑定场景检查实现情况
  -> 代码质量 Agent 分析可读性、复杂度、异常处理、重复代码
  -> 工程规范 Agent 检查 README、依赖管理、运行方式、测试情况
  -> 能力证据 Agent 提取可支撑画像的技能证据
  -> 报告生成 Agent 汇总多维度评分、问题、亮点和改进建议
  -> 写入 project_analysis_reports
  -> 教师端看板和学生端报告同步可见
```

项目分析报告是系统对提交物的结构化分析结果。教师进入项目学情看板后，直接查看班级整体情况和单个学生报告。

多维度评分建议：

| 维度 | 说明 |
|---|---|
| 功能完成度 | 是否覆盖项目目标、核心功能是否可运行 |
| 代码结构 | 模块划分、目录组织、入口文件、依赖关系 |
| 工程规范 | README、依赖文件、运行说明、测试或样例 |
| 代码质量 | 命名、重复、复杂度、异常处理、可维护性 |
| 学科能力证据 | 能体现哪些课程知识点、工程能力或算法能力 |
| 改进建议 | 下一步应补充的功能、文档、测试或代码质量问题 |

### 9.6 教师项目学情看板流程（P0）

```text
教师选择课程、班级或项目
  -> 权限校验
  -> 聚合项目提交记录
  -> 读取项目分析报告
  -> 生成班级分数分布、共性问题和能力短板
  -> 查看单个学生项目报告
  -> 导出班级项目分析结果
```

教师端定位为分析结果消费端，服务课程讲评、项目指导和学情掌握。

---

## 十、推荐与评分设计

### 10.1 学生画像评分

画像评分由证据驱动：

```text
维度分数 = Σ(证据得分 * 证据权重 * 可信度) / Σ(证据权重 * 可信度)
```

证据可信度建议：

| 证据类型 | 可信度 |
|---|---|
| 官方竞赛获奖或参赛记录 | 高 |
| 教师评价或课程项目评分 | 高 |
| GitHub 项目和可运行作品原型 | 中高 |
| 项目说明文档 | 中 |
| 学生自评 | 低 |

展示原则：

1. 分数只用于推荐排序和解释。
2. 页面优先展示标签、证据、短板和建议。
3. 分数不足以证明真实能力，只表示当前系统可见证据下的相对画像。

### 10.2 竞赛推荐评分

```text
竞赛匹配度 =
  目标方向匹配 * 0.30
  + 技能要求匹配 * 0.30
  + 年级与时间匹配 * 0.15
  + 项目经历相关性 * 0.15
  + 竞赛经验相关性 * 0.10
```

输出中同时展示：

1. 匹配项。
2. 不匹配项。
3. 准备建议。
4. 引用来源。

### 10.3 队友推荐评分

```text
队友匹配度 =
  技能互补度 * 0.35
  + 目标一致性 * 0.25
  + 时间可用性 * 0.20
  + 项目经历相关性 * 0.15
  + 竞赛经历相关性 * 0.05
```

推荐解释固定结构：

| 区域 | 内容 |
|---|---|
| 互补点 | 候选人能补足哪些角色或技能 |
| 共同点 | 目标、方向、竞赛意向是否一致 |
| 风险点 | 时间不足、证据不足、目标不完全一致 |
| 沟通建议 | 初次沟通应该确认的问题 |

---

## 十一、安全、合规与内容治理

### 11.1 数据安全

1. 密码使用安全哈希存储。
2. 登录采用短期访问令牌和可选刷新令牌。
3. 上传文件限制类型和大小。
4. 公网环境使用学校账号入口和示例课程数据。
5. 敏感操作写入审计日志。

### 11.2 隐私保护

1. 学生画像默认仅本人可见。
2. 进入组队推荐池需要主动授权。
3. 教师端默认展示聚合统计，不默认暴露完整个人画像。
4. 对外提交材料遵循系统权限控制和学校数据使用要求。

### 11.3 AI 内容治理

| 风险 | 控制方式 |
|---|---|
| 模型幻觉 | RAG 引用、Citation Checker、不确定提示 |
| 虚假经历 | 禁止生成竞赛证书、项目经历、获奖记录等伪造内容 |
| 学术不端 | 不替学生完成违规作业、论文、申报材料 |
| 隐私泄露 | 模型提示模板 中不注入无关个人敏感信息 |
| 提示注入 | 对上传知识库和用户输入做指令隔离，模型只将知识片段作为资料而非系统指令 |

---

## 十二、部署架构

### 12.1 本地开发方案

```text
本地开发
  ├── frontend          React + Vite dev server
  ├── backend           FastAPI + Uvicorn
  ├── sqlite            本地业务数据库文件
  ├── chroma/faiss      本地向量索引
  └── local-storage     上传资料与样例附件
```

本地开发优先保证启动简单：

1. 不强制安装 PostgreSQL。
2. 不强制启动 Redis 和 MinIO。
3. 使用 `.env.dev` 指向 SQLite 和本地向量索引目录。
4. 通过初始化脚本写入学校账号、样例画像、样例竞赛和样例知识库。

### 12.2 MVP 部署方案

```text
Nginx
  ├── /                 Frontend 静态资源
  └── /api              FastAPI Backend

Docker Compose
  ├── frontend          React build + Nginx
  ├── backend           FastAPI + Uvicorn
  ├── postgres          PostgreSQL + pgvector
  ├── redis             缓存和任务状态
  └── minio             对象存储，可选
```

### 12.3 环境变量

| 环境变量 | 说明 |
|---|---|
| `DATABASE_URL` | SQLite 或 PostgreSQL 连接 |
| `VECTOR_STORE` | chroma、faiss 或 pgvector |
| `VECTOR_STORE_PATH` | 本地向量索引目录，开发期使用 |
| `REDIS_URL` | Redis 连接 |
| `STORAGE_ENDPOINT` | MinIO 或文件存储配置 |
| `LLM_PROVIDER` | 当前使用的大模型 Provider |
| `LLM_API_KEY` | 大模型 API Key |
| `EMBEDDING_PROVIDER` | Embedding Provider |
| `JWT_SECRET` | 登录令牌密钥 |
| `APP_ENV` | dev、demo、prod |

### 12.4 复现要求

提交材料中应包含：

1. `docker-compose.yml`
2. `.env.example`
3. 数据库迁移脚本
4. 样例知识库数据
5. 学校账号初始化脚本
6. 典型测试案例脚本
7. README 部署说明

---

## 十三、测试与评测设计

### 13.1 测试类型

| 类型 | 工具 | 覆盖内容 |
|---|---|---|
| 单元测试 | pytest | 推荐评分、画像评分、权限判断、数据解析 |
| API 测试 | pytest + httpx | 核心接口请求和异常处理 |
| 前端 E2E | Playwright | 登录、画像创建、路径生成、竞赛推荐 |
| RAG 评测 | 自定义评测脚本 | 引用覆盖率、事实正确性、拒答质量 |

### 13.2 典型评测集

| 编号 | 场景 | 问题 |
|---|---|---|
| E1 | 学习路径 | 我是大一学生，会一点 Python，想一年后参加蓝桥杯，应该怎么准备？ |
| E2 | 竞赛推荐 | 我做过 Flask 项目，算法一般，想参加创新创业类比赛，有什么建议？ |
| E3 | 组队推荐 | 我想参加计算机设计大赛，缺前端和汇报同学，怎么找队友？ |
| E4 | 知识问答 | 数据结构里的图搜索和动态规划有什么学习顺序建议？ |
| E5 | 教师看板 | 请分析 2024 级程序设计课程本次 Flask 作业提交情况。 |
| E6 | 代码分析 | 我上传一个 Flask 项目，请分析它能证明哪些工程能力，还缺哪些证据。 |
| E7 | 长任务恢复 | 学习路径生成到用户保存节点前中断，再恢复并保存任务。 |

### 13.3 质量指标

| 指标 | 目标 |
|---|---|
| 事实性回答引用覆盖率 | 不低于 80% |
| 推荐解释完整率 | 100% 包含理由、短板、风险 |
| 学生画像创建时间 | 5 分钟内 |
| 常规问答首轮响应 | 10 秒内 |
| 长任务状态可追踪 | 能查看当前节点、执行状态和用户交互点 |
| 演示链路 | 3 分钟内完整展示主线闭环 |

---

## 十四、开发里程碑

### M1：工程骨架与数据模型

| 任务 | 交付 |
|---|---|
| 搭建前后端项目 | React Web + FastAPI 基础工程 |
| 建立数据库模型 | SQLAlchemy + Alembic，开发期 SQLite 可运行 |
| 建立 LangGraph 基础运行器 | graph_runs、graph_events、workflow_actions、状态查询 API |
| 实现登录与角色 | 学生、教师、管理员学校账号 |
| 初始化样例数据 | 学生画像、竞赛、知识文档样例 |

### M2：知识库与 RAG

| 任务 | 交付 |
|---|---|
| 文档上传与解析 | PDF/Markdown/Word 入库 |
| 文档切片与向量化 | 开发期 ChromaDB 写入，FAISS 备选；部署期 pgvector 写入 |
| RAG 问答 | 带引用回答 |
| Citation Checker | 无来源信息提示不确定 |

### M3：学生端主线闭环

| 任务 | 交付 |
|---|---|
| 学生画像 | 表单、标签、证据、置信度 |
| 学习路径 | LangGraph 目标澄清、规划、评估、用户保存或调整、任务保存 |
| 竞赛推荐 | LangGraph 编排画像读取、RAG 检索、匹配评分、推荐解释 |
| 组队推荐 | LangGraph 编排需求解析、候选筛选、匹配解释、邀请状态流转 |
| 代码分析 | 项目上传、结构分析、能力证据提取、分析报告 |

### M4：评测与教师端

| 任务 | 交付 |
|---|---|
| 评测用例 | 典型问题和人工评分 |
| 评测记录 | 测试案例输出记录和报告导出 |
| 教师看板 | 项目分析看板、学生报告、班级能力分布 |
| 展示视频准备 | 3 分钟主线展示脚本 |

### M5：比赛提交整理

| 任务 | 交付 |
|---|---|
| 技术报告 | 架构、技术路线、创新点 |
| 作品方案 PPT | 功能、效果、评测、迭代计划 |
| 代码归档 | 可复现代码和部署说明 |
| 效果验证报告 | 测试案例、系统输出记录、截图 |

---

## 十五、风险与应对

| 风险 | 表现 | 应对 |
|---|---|---|
| 模型接口不稳定 | 答辩时模型服务不可用 | Provider Adapter + MockProvider + 缓存演示样例 |
| 图工作流过度复杂 | 任务节点太多导致调试困难 | 只把长任务和多 Agent 流程放入 LangGraph，确定性算法保留在 Service |
| 知识库内容不足 | RAG 回答泛化、不够垂类 | 聚焦三条路径，优先补官方竞赛和课程资料 |
| 画像评分被质疑 | 评委追问分数依据 | 展示证据、置信度和“相对画像”口径 |
| 推荐像黑箱 | 用户不知道为何推荐 | 固定输出理由、短板、风险、来源 |
| 教师端范围膨胀 | 教师端从项目学情扩散到复杂管理系统 | MVP 只做项目分析看板和学生报告，竞赛筛选等后续扩展 |
| 部署复杂 | 现场复现困难 | Docker Compose 一键部署，准备公网环境可用的示例课程数据 |
| 权限配置错误 | 学生、教师、管理员看到超出授权范围的数据 | RBAC、课程班级授权、操作审计和账号隔离 |

---

## 十六、最终推荐方案

### 16.1 MVP 技术栈

| 领域 | 选择 |
|---|---|
| 前端 | Web 首版：React + TypeScript + Vite + Ant Design + ECharts；鸿蒙端 P1：ArkTS + ArkUI |
| 后端 | Python + FastAPI + Pydantic + SQLAlchemy |
| 数据库 | 开发期 SQLite；部署期 PostgreSQL |
| 向量库 | 开发期 ChromaDB 优先，FAISS 备选；部署期 pgvector |
| 缓存 | Redis |
| 文件存储 | MinIO 或本地文件存储 |
| 大模型 | 通过 Provider Adapter 接入，可选择通用大模型、开源大模型、OpenAI-compatible 服务或本地模型 |
| RAG | 轻量自研 Pipeline：文档解析、切片、Embedding Adapter、向量检索、可选重排序、引用校验 |
| Agent 编排 | LangGraph + Pydantic State Schema，承载长任务、多 Agent、用户交互节点和中断恢复 |
| 部署 | Docker Compose + Nginx |
| 测试 | pytest + Playwright + 自定义 RAG 评测脚本 |

### 16.2 架构取舍结论

本项目首版不追求复杂平台化，也不追求从零研发模型，而是优先把“计算机学科知识库 + 学生画像 + RAG 可追溯问答 + 学习路径 + 竞赛推荐 + 组队推荐”做成一个稳定闭环。  

这样的架构能同时满足三个目标：

1. 对赛题负责：体现学科垂类、可信知识库、自然语言交互和真实场景应用。
2. 对开发负责：技术栈成熟、部署简单、模块边界清晰。
3. 对答辩负责：主线可验证、结果可解释、材料可复现。
