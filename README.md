# 智创Agent

作品名称：**智创Agent·计算机学科垂类大模型与双创能力赋能平台**

本仓库用于沉淀项目立项、需求分析、架构设计、HTML 立项 PPT，以及系统实现代码。

## 当前内容

- `立项/需求分析文档_智创Agent.md`：项目需求分析文档
- `立项/项目架构设计与技术选型_智创Agent.md`：架构设计与技术选型文档
- `立项/智创Agent_立项PPT/index.html`：HTML 形式立项 PPT
- `立项/XH-202620_面向一流学科建设的学科垂类大模型与创新应用开发.pdf`：赛题原始材料
- `docs/开发SOP.md`：开发流程、协作规范、验收标准
- `docs/架构约定.md`：系统架构、模块边界、技术选型约定
- `docs/API设计.md`：首版 API 草案
- `docs/数据模型.md`：首版数据模型草案
- `docs/知识库资料清单.md`：首批知识库资料需求
- `docs/公网Demo部署.md`：公网 Demo 部署说明
- `docs/演示脚本.md`：比赛和学校试用演示脚本
- `docs/交付验收报告.md`：当前版本交付结论、需求证据和复验步骤
- `backend/`：FastAPI 后端骨架
- `frontend/`：React + Vite 前端骨架
- `harmony/`：鸿蒙端 P1 客户端规划
- `evals/`：RAG、Prompt、Agent 工作流评测资产
- `infra/`：部署和运维资产

## 项目定位

面向学校真实教学场景，主要服务计算机类学生的能力成长、项目管理与分析、竞赛准备和双创项目实践，同时为教师提供课程项目学情诊断与班级观察视图，构建基于通用大模型、RAG 知识库和 LangGraph 多 Agent 工作流的学科垂类智能体应用。

## 查看 HTML PPT

直接用浏览器打开：

```bash
open 立项/智创Agent_立项PPT/index.html
```

快捷键：

- `←` / `→`：翻页
- `F`：全屏
- `T`：切换主题
- `O`：总览

## 快速开始

```bash
make init
cd backend
python3.11 -m venv .venv
.venv/bin/python -m pip install -e ".[dev]"
cd ..
make dev-backend
```

另开一个终端启动前端：

```bash
make dev-frontend
```

也可以一键启动本地前后端：

```bash
make dev
```

默认地址：

- 前端：`http://localhost:5173`
- 后端 API：`http://localhost:8000/api`

如需改端口：

```bash
BACKEND_PORT=8010 FRONTEND_PORT=5174 make dev
```

检查：

```bash
make test
make check
```

`make test` 和 `make check` 会优先使用 `backend/.venv`。如果本机暂时无法安装
`ruff`，`make check` 会继续执行后端测试和前端构建，并明确提示跳过后端 lint。

清理本地运行数据中的测试残留：

```bash
make reset-local-data
```

Docker Demo：

```bash
docker compose up --build
make smoke
```

`make smoke` 会对公网或本地 Demo 做内容断言：演示账号、学校账号会话、学生成长规划、项目管理与分析、竞赛推荐、组队、计划执行与阶段反馈、知识库入库与检索、Agent 引用、教师看板、教师梯队筛选和前端入口。

RAG 或 LangGraph 开发需要进入 `backend/` 安装额外依赖：

```bash
python3.11 -m pip install -e ".[ai,rag,dev]"
```

## 仓库结构

```text
.
├── backend/        # FastAPI、RAG、LangGraph、多 Agent 工作流
├── frontend/       # React + TypeScript + Vite Web 前端
├── harmony/        # ArkTS + ArkUI 鸿蒙端规划
├── docs/           # 开发 SOP、API、数据模型、路线图
├── evals/          # RAG、Prompt、Graph 评测样例
├── infra/          # 部署和运维配置
├── data/           # 本地开发和 Demo 运行数据
├── scripts/        # 开发脚本
└── 立项/           # 需求、架构、立项 PPT 和赛题资料
```

## 核心约定

- 文档优先放在 `立项/`
- 开发规范、API 草案、数据模型放在 `docs/`
- 代码目录按前端、后端、鸿蒙端拆分
- 公网 Demo 使用演示账号和示例课程数据
- 真实学校使用场景通过角色、课程、班级权限控制数据访问范围
- 学校统一身份系统通过受信任网关调用 `POST /auth/school-session`，再复用同一套权限边界
- 学生端是默认主入口，围绕画像、项目管理、学习路径、竞赛推荐、组队和计划执行形成成长闭环
- 教师端是 P0 教学支撑场景，直接展示项目分析报告和班级学情看板
- 长任务和多 Agent 编排使用 LangGraph，确定性业务逻辑放在 service 层
