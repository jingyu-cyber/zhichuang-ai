# 智创Agent · 计算机学科垂类大模型与双创能力赋能平台

> **AI-Powered Student Growth & Innovation Platform**  
> 在线演示：http://70.39.193.15:5173

## 项目简介

智创Agent是一个面向计算机学科学生的**成长与双创能力平台**，集成了**AI驱动的项目管理**、**能力画像分析**、**知识库问答**、**竞赛推荐**、**组队协作**和**交互式开源课堂**等核心功能。

系统基于通用大模型+RAG知识库+LangGraph多Agent工作流架构，构建学科垂类智能体，服务真实教学场景。

## 核心功能

| 模块 | 功能 |
|------|------|
| 🏗️ **项目管理** | 代码提交→自动多维分析→评分报告→改进任务闭环 |
| 📊 **成长规划** | 能力画像+学习计划+竞赛准备+组队协作+执行追踪 |
| 🤖 **知识库问答** | RAG检索增强生成，支持文档上传、语义搜索、引用追踪 |
| 📚 **开源课堂** | 8门计算机课程96节交互式课件，支持课堂投屏+自主预习 |
| 👤 **个人中心** | 基础画像维护+学习目标+技能标签+项目经历管理 |
| 🎓 **教师看板** | 班级学情诊断+项目分析报告+梯队筛选+教学建议 |

## 开源课堂·8门交互式课件

| 课程 | 章节 | 课节 | 状态 |
|------|:--:|:--:|:--:|
| 深度学习框架与编程 | 4章 | 12节 | ✅ 全部完善 |
| AI基础设施 | 4章 | 12节 | 🔄 4节完善 |
| 编译原理 | 4章 | 12节 | ✅ |
| 计算机系统导论 | 4章 | 12节 | ✅ |
| 数据库系统概论 | 4章 | 12节 | ✅ |
| 操作系统内核构建 | 4章 | 12节 | ⚡ |
| 计算思维 | 4章 | 12节 | ⚡ |
| 软件工程 | 4章 | 12节 | ⚡ |

每节课件为独立HTML文件，支持**键盘导航(←→)**、**自动播放**、**SVG交互可视化**，零网络依赖，可直接投屏。

## 技术栈

```
前端：React 18 + TypeScript + Vite + Ant Design + ECharts + Zustand
后端：FastAPI + SQLAlchemy + LangGraph + ChromaDB + PostgreSQL
部署：Docker Compose + Nginx + Redis
AI：  DeepSeek API + 通义千问 ASR + OpenAI-compatible provider
```

## 快速开始

### 环境要求
- Python 3.11+
- Node.js 20+
- Docker & Docker Compose（生产部署）

### 本地开发
```bash
# 一键启动前后端
make dev

# 或分别启动
make dev-backend  # http://localhost:8000
make dev-frontend # http://localhost:5173

# 运行测试
make test && make check
```

### Docker部署
```bash
# 构建并启动
docker compose up --build -d

# 检查服务健康
make smoke
```

### 环境变量
复制 `.env.example` 为 `.env` 并配置：
```bash
# LLM配置
LLM_MODEL=deepseek-chat
LLM_API_KEY=your_api_key
LLM_BASE_URL=https://api.deepseek.com/v1

# 数据库
DATABASE_URL=sqlite+aiosqlite:///./data/bilimind.db

# 向量数据库
CHROMA_PERSIST_DIRECTORY=./data/chroma_db
```

### 测试账号
在线演示环境预置学校账号，通过 `/api/auth/demo-accounts` 获取可用账号列表。

## 项目结构

```
├── backend/          # FastAPI后端
│   ├── app/
│   │   ├── api/      # API路由 (auth/projects/evaluations/growth等)
│   │   ├── ai/       # LangGraph多Agent工作流
│   │   ├── rag/      # RAG检索增强生成
│   │   ├── models/   # SQLAlchemy数据模型
│   │   └── services/ # 业务逻辑层
│   └── tests/
├── frontend/         # React + Vite前端
│   ├── src/
│   │   ├── pages/    # Dashboard + OpenCourseStudio
│   │   ├── app/      # App入口 + ThemeContext
│   │   └── shared/   # API客户端 + 类型定义
│   └── public/       # 开源课堂课件(104个HTML文件)
├── course-cases/     # 教学案例包
├── docs/             # 架构文档 + API + SOP
├── evals/            # RAG/Agent评测资产
├── infra/            # 部署配置
└── 立项/             # 需求文档 + 立项PPT
```

## 部署优化 (v2.1)

- ✅ Nginx Gzip压缩 (HTML/CSS/JS >60%体积缩减)
- ✅ 静态资源1年缓存 + ETag + immutable
- ✅ 安全响应头 (XSS/Frame/Content-Type)
- ✅ Docker容器健康检查 (自动恢复)
- ✅ 侧边栏亮/暗双主题
- ✅ 旧部署清理 (8容器→4容器)

## 贡献者

| 贡献者 | GitHub |
|--------|--------|
| Lss-lmj | [@Lss-lmj](https://github.com/Lss-lmj) |
| jingyu-cyber | [@jingyu-cyber](https://github.com/jingyu-cyber) |

## 许可证

本项目用于学术竞赛与教学展示。详见各子目录的LICENSE文件。

---

<div align="center">
  <sub>Built with ❤️ for CS Education</sub>
</div>
