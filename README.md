# 智创Agent · 计算机学科垂类大模型与双创能力赋能平台

> **GitLink 开源创新大赛 参赛作品**  
> 🌐 在线演示：http://70.39.193.15:5173

## 作品简介

智创Agent 面向计算机学科学生，基于 **通用大模型 + RAG 知识库 + LangGraph 多 Agent 工作流** 构建学科垂类智能体。系统以学生项目成长闭环为主线：代码提交 → 自动多维分析 → 能力画像 → 成长规划 → 竞赛准备 → 组队协作，同时为教师提供班级学情诊断。

## 功能演示

| 学生端 · 项目管理 | 教师端 · 学情诊断 | 管理端 · 知识库管理 |
|:---:|:---:|:---:|
| ![](docs/screenshots/screenshot-student-v2.png) | ![](docs/screenshots/screenshot-teacher-full.png) | ![](docs/screenshots/screenshot-admin-full.png) |
| 五维分析·证据追踪·改进任务闭环 | 班级分布·能力热力图·梯队筛选 | 知识库治理·检索入库·路径分类 |

### 学科知识库问答

![](docs/screenshots/screenshot-knowledge.png)

基于RAG检索增强生成，支持文档上传、语义搜索、引用追踪，知识库可持续积累。

## 开源课堂 · 交互式课件

8门课程96节独立HTML课件，支持键盘导航(←→)、自动播放、SVG可视化，零网络依赖，可直接投屏。

| 编译原理 · 词法分析NFA→DFA | 深度学习 · 训练循环架构 |
|:---:|:---:|
| ![](docs/screenshots/screenshot-compiler.png) | ![](docs/screenshots/screenshot-lesson.png) |
| 17步交互 · Thompson构造 · 子集构造 | 14步交互 · 5步流水线 · AMP · 生产模板 |

### 课程列表

| 课程 | 章×节 | 核心内容 |
|------|:--:|------|
| 深度学习框架与编程 | 4×3 | 张量→计算图→自动求导→训练工程 |
| AI基础设施 | 4×3 | GPU算子→内存访问→编译器→分布式 |
| 编译原理 | 4×3 | 词法→语法→语义→IR→优化 |
| 计算机系统导论 | 4×3 | 机器表示→汇编→调用约定→异常 |
| 数据库系统概论 | 4×3 | ER建模→SQL→索引→事务 |
| 操作系统内核 | 4×3 | 系统调用→进程→内存→文件 |
| 计算思维 | 4×3 | 分解→抽象→状态机→递归→剪枝 |
| 软件工程 | 4×3 | 需求→设计→测试→部署→项目管理 |

## 演示账号

| 账号 | 角色 | 核心模块 |
|------|:--:|------|
| 林一舟 | 学生 | 项目管理·成长规划·知识库问答·开源课堂 |
| 周老师 | 教师 | 教师看板·班级诊断·竞赛梯队筛选 |
| 平台管理员 | 管理员 | 知识库管理·资料入库·全模块访问 |

## 技术架构

```
React 18 + TS + Vite → Nginx(Gzip+缓存) → FastAPI → LangGraph Agent
    Ant Design + ECharts + Zustand          SQLAlchemy + ChromaDB + Redis
                                                   DeepSeek LLM + RAG
```

## 快速开始

```bash
make dev          # 本地开发
docker compose up --build -d  # Docker部署
make smoke        # 健康检查
```

- 前端：http://localhost:5173
- API：http://localhost:8000/api
- 在线：http://70.39.193.15:5173

## 部署优化

Nginx Gzip压缩 · 静态资源1年缓存+ETag · 安全响应头 · Docker健康检查 · 双Worker · 亮/暗双主题

## 项目结构

```
├── backend/    FastAPI + LangGraph + RAG + 12 API模块
├── frontend/   React+Vite + 8门课程104个HTML课件
├── course-cases/  3套教学案例包
├── docs/      架构·API·SOP·部署·验收
├── 立项/      需求·架构·PPT
└── infra/     Docker Compose部署
```

## 贡献者

[@Lss-lmj](https://github.com/Lss-lmj) · [@jingyu-cyber](https://github.com/jingyu-cyber) · [@wangyu111-22](https://github.com/wangyu111-22)

---

<div align="center"><sub>Built for CS Education · GitLink 开源创新大赛</sub></div>
