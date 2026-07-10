<div align="center">

# 智创Agent

**计算机学科垂类大模型与双创能力赋能平台**

以工程的方式沉淀学生成长 —— RAG 知识库 · LangGraph 多 Agent · 项目成长闭环

[![在线演示](https://img.shields.io/badge/在线演示-zcai.selab.top-2383E2?style=flat-square&logo=cloudflare&logoColor=white)](https://zcai.selab.top)
[![GitLink](https://img.shields.io/badge/GitLink-开源创新大赛-37352F?style=flat-square&logo=git&logoColor=white)](https://www.gitlink.org.cn)
[![XjuSelab](https://img.shields.io/badge/XjuSelab-新疆大学软件开发实验室-0F7B6C?style=flat-square&logo=github&logoColor=white)](https://github.com/XjuSelab)

![Python](https://img.shields.io/badge/Python-3.11-3776AB?style=flat-square&logo=python&logoColor=white)
![FastAPI](https://img.shields.io/badge/FastAPI-009688?style=flat-square&logo=fastapi&logoColor=white)
![LangGraph](https://img.shields.io/badge/LangGraph-1C3C3C?style=flat-square&logo=langchain&logoColor=white)
![React](https://img.shields.io/badge/React-18-20232A?style=flat-square&logo=react&logoColor=61DAFB)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?style=flat-square&logo=typescript&logoColor=white)
![Docker](https://img.shields.io/badge/Docker-2496ED?style=flat-square&logo=docker&logoColor=white)

</div>

---

## 作品简介

基于 **通用大模型 + RAG 知识库 + LangGraph 多 Agent 工作流** 的计算机学科垂类智能体平台。以学生项目成长闭环为主线，集成项目管理与智能分析、能力画像与成长规划、知识库问答、竞赛推荐与组队协作、交互式开源课堂。

## 文档导航

| 文档 | 说明 |
|------|------|
| [技术文档](docs/技术文档.md) | 系统架构、技术栈、部署方案、API设计、数据模型 |
| [功能演示](docs/功能演示.md) | 三角色演示截图、开源课堂展示、核心功能说明 |

## 演示账号

在线演示：**<https://zcai.selab.top>**

| 账号 | 角色 | 核心模块 |
|------|:--:|------|
| 林一舟 | 学生 | 项目管理·成长规划·知识库问答·开源课堂 |
| 周老师 | 教师 | 教师看板·班级诊断·竞赛梯队筛选 |
| 平台管理员 | 管理员 | 知识库管理·资料入库·全模块访问 |

## 快速开始

```bash
make dev                           # 本地开发
docker compose up --build -d       # Docker 部署
```

- 前端：http://localhost:5173
- API：http://localhost:8000/api

## 项目结构

```
├── backend/    FastAPI + LangGraph + RAG
├── frontend/   React + Vite + 8门课程104个HTML课件
├── course-cases/  3套教学案例包
├── docs/      架构·API·SOP·部署·验收
├── 立项/      需求·架构·PPT
└── infra/     Docker Compose
```

## 贡献者

[@Lss-lmj](https://github.com/Lss-lmj) · [@jingyu-cyber](https://github.com/jingyu-cyber) · [@wangyu111-22](https://github.com/wangyu111-22)

---

<div align="center"><sub>XjuSelab · Built for CS Education · GitLink 开源创新大赛</sub></div>
