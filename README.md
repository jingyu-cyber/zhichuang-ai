# 智创Agent · 计算机学科垂类大模型与双创能力赋能平台

> **GitLink × CCF 开源创新大赛 参赛作品**  
> 🏆 面向一流学科建设的学科垂类大模型与创新应用开发  
> 🌐 在线演示：http://70.39.193.15:5173

## 📋 作品概述

**智创Agent** 是一个面向计算机学科学生的 AI 驱动成长与双创能力平台。系统基于 **通用大模型 + RAG 知识库 + LangGraph 多 Agent 工作流** 架构，构建学科垂类智能体，集成了项目管理与智能分析、能力画像与成长规划、知识库问答、竞赛推荐与组队协作、交互式开源课堂等核心功能。

系统以"**学生项目成长闭环**"为主线：代码提交 → 自动多维分析 → 能力画像 → 成长规划 → 竞赛准备 → 组队协作，形成完整的双创能力培养链路。同时为教师提供班级学情诊断与数据驱动的教学决策支持。

## 🎬 功能演示

### 🧑‍🎓 学生端 — 成长规划与能力画像
![学生成长规划](docs/screenshots/screenshot-student.png)

学生通过项目提交触发智能分析，系统自动提取能力证据、生成多维评分报告、构建个人能力画像，并据此推荐学习路径、竞赛方向和组队匹配。

### 👨‍🏫 教师端 — 项目分析与班级诊断
![教师看板](docs/screenshots/screenshot-teacher.png)

教师可查看全班学生的项目分析报告、能力分布热力图、学情诊断和梯队筛选结果，实现数据驱动的精准教学决策。

### 🛠️ 管理端 — 知识库问答
![知识库问答](docs/screenshots/screenshot-admin.png)

基于 RAG 检索增强生成技术，支持课程文档上传、语义搜索、引用追踪和版本维护，构建可积累、可追溯的学科知识库。

### 📊 项目管理 — 智能代码分析
![项目管理](docs/screenshots/screenshot-projects.png)

代码提交后自动触发五维度分析（功能完成度/代码结构/工程规范/测试意识/文档表达），生成评分报告、定位问题、追踪证据片段、输出改进任务。

## 📚 开源课堂 — 8门交互式课件

系统内置 **8 门计算机核心课程** 共 **96 节交互式课件**，每节课为独立 HTML 文件，支持键盘导航（←→）、自动播放、SVG 可视化，零网络依赖，可直接课堂投屏使用或作为学生自主预习材料。

| 课程名称 | 章节数 | 课节数 | 核心技术领域 |
|---------|:--:|:--:|------------|
| 深度学习框架与编程 | 4 | 12 | 张量→计算图→自动求导→训练工程→实验报告 |
| AI 基础设施 | 4 | 12 | GPU算子→内存访问→并行模型→AI编译器→分布式通信 |
| 编译原理 | 4 | 12 | 词法分析→语法分析→语义分析→中间代码→优化→AST |
| 计算机系统导论 | 4 | 12 | 机器级表示→汇编→缓冲区溢出→调用约定→异常处理 |
| 数据库系统概论 | 4 | 12 | ER建模→SQL优化→索引→事务隔离→API设计→备份恢复 |
| 操作系统内核构建 | 4 | 12 | 系统调用→进程调度→内存管理→页表→文件系统→I/O |
| 计算思维 | 4 | 12 | 问题分解→抽象建模→状态机→递归→剪枝→调试追踪 |
| 软件工程 | 4 | 12 | 需求分析→模块设计→测试矩阵→部署→项目管理→代码审查 |

## 🏗️ 技术架构

```
┌──────────────────────────────────────────────────┐
│           前端 React 18 + TypeScript + Vite        │
│        Ant Design + ECharts + Zustand 状态管理     │
├──────────────────────────────────────────────────┤
│         Nginx 反向代理 (Gzip + 缓存 + 安全头)       │
├──────────────────────────────────────────────────┤
│     FastAPI 后端 + LangGraph 多 Agent 工作流       │
│  SQLAlchemy ORM + ChromaDB 向量库 + Redis 缓存     │
│              PostgreSQL / SQLite 数据库             │
├──────────────────────────────────────────────────┤
│   DeepSeek LLM + 通义千问 ASR + OpenAI-compatible  │
└──────────────────────────────────────────────────┘
```

## 🚀 快速开始

### 环境要求
| 组件 | 版本要求 |
|------|---------|
| Python | 3.11+ |
| Node.js | 20+ |
| Docker | 最新稳定版 |

### 本地开发
```bash
# 一键启动
make dev

# 运行测试
make test && make check

# 清理本地数据
make reset-local-data
```

### Docker 部署
```bash
# 构建并启动全部服务
docker compose up --build -d

# 检查服务健康状态
make smoke
```

### 访问地址
- 前端：http://localhost:5173
- API：http://localhost:8000/api
- API 文档：http://localhost:8000/docs

## 📁 项目结构

```
zhichuang-ai/
├── backend/                    # FastAPI 后端
│   ├── app/api/routes/         # 12 个 API 路由模块
│   ├── app/ai/agents/          # LangGraph 多 Agent 工作流
│   ├── app/rag/                # RAG 检索增强生成管线
│   ├── app/models/             # SQLAlchemy 数据模型 (8张表)
│   └── app/services/           # 业务逻辑服务层
├── frontend/                   # React + Vite 前端
│   ├── src/pages/              # Dashboard + OpenCourseStudio
│   ├── src/shared/api/         # API 客户端 (9个模块)
│   └── public/open-course-lessons/  # 8门课程104个交互式课件
├── course-cases/               # 开源教学案例包 (3个教学套件)
├── docs/                       # 架构文档 + SOP + API设计 + 部署说明
├── evals/                      # RAG / Agent 评测资产
├── infra/                      # Docker Compose + 部署配置
├── scripts/                    # 开发辅助脚本
└── 立项/                       # 需求文档 + 架构设计 + 立项PPT + 赛题资料
```

## 🔧 部署优化清单

| 优化项 | 说明 | 效果 |
|-------|------|------|
| Nginx Gzip | 文本资源压缩 | HTML/CSS/JS >60% 体积缩减 |
| 静态缓存 | `immutable` + 1年过期 | 二次访问零网络请求 |
| 安全响应头 | XSS/Frame/Content-Type | OWASP 安全基线 |
| Docker 健康检查 | `HEALTHCHECK` 指令 | 容器异常自动重启 |
| 多 Worker | uvicorn `--workers 2` | 多核 CPU 利用 |
| 双主题 | 亮色/暗色 CSS 变量 | 全天候使用体验 |
| 旧部署清理 | 移除冗余容器 | 释放 ~30MB RAM |

## 👥 演示账号

| 账号名 | 角色 | 可访问模块 |
|-------|:--:|----------|
| 林一舟 | 学生 | 成长规划 · 项目管理 · 知识库问答 · 开源课堂 · 个人中心 |
| 周老师 | 教师 | 教师看板 · 项目管理 · 知识库问答 · 班级学情诊断 |
| 平台管理员 | 管理员 | 知识库管理 · 教师看板 · 成长规划 · 全模块访问 |

## 📄 许可证

本项目为 **GitLink × CCF 开源创新大赛** 参赛作品，用于学术竞赛与教学展示。

## 👨‍💻 贡献者

| 贡献者 | GitHub |
|--------|--------|
| Lss-lmj | [@Lss-lmj](https://github.com/Lss-lmj) |
| jingyu-cyber | [@jingyu-cyber](https://github.com/jingyu-cyber) |

---

<div align="center">
  <sub>Built with ❤️ for Computer Science Education</sub><br>
  <sub>GitLink × CCF 开源创新大赛 · 2026</sub>
</div>
