# 个性化学习资源生成案例包

本案例包服务智创Agent 的个性化学习方向，面向“基于大模型的个性化资源生成与学习多智能体系统开发”赛题，提供画像维度、多 Agent 工作流、资源生成样例和学习效果评估模板。

## 案例包定位

以计算机课程项目实践为场景，系统根据学生画像、学习目标、项目经历和知识短板，生成个性化学习资源和阶段学习路径。

## 文件结构

```text
personalized-learning-resource-generation/
  README.md
  learner-profile.md
  multi-agent-workflow.md
  resource-types.md
  learning-effect-evaluation.md
  knowledge-base/
    rag-project-learning.md
  generated-samples/
    explanation-doc.md
    mind-map.md
    exercises.md
    extended-reading.md
    code-practice.md
    project-task.md
```

## 首版资源类型

| 类型 | 是否进入首版 |
|---|---|
| 讲解文档 | 是 |
| 知识点思维导图 | 是 |
| 练习题 | 是 |
| 拓展阅读 | 是 |
| 代码实操案例 | 是 |
| 项目实践材料 | 是 |

## 与智创Agent的关系

- 画像来自个人中心、对话、项目报告和任务反馈。
- 资源生成依赖计算机课程知识库和 RAG。
- 多 Agent 编排使用 LangGraph 设计口径。
- 学习效果通过项目分析、练习反馈和计划执行记录持续更新。
