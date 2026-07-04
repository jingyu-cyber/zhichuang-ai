from __future__ import annotations

from dataclasses import dataclass, field
from re import findall


@dataclass
class RetrievedChunk:
    title: str
    source_type: str
    content: str
    score: float
    path: str
    tags: list[str] = field(default_factory=list)


COURSE_CHUNKS = [
    RetrievedChunk(
        title="程序设计基础课程大纲",
        source_type="course_material",
        path="算法竞赛",
        tags=["程序设计基础", "Python", "C"],
        content="课程覆盖变量、控制结构、函数、数组、调试和代码风格，是算法训练的基础入口。",
        score=0,
    ),
    RetrievedChunk(
        title="数据结构课程知识点",
        source_type="course_material",
        path="算法竞赛",
        tags=["数据结构", "栈", "队列", "树", "图"],
        content="数据结构重点包含线性表、栈、队列、哈希表、树、图和复杂度分析。",
        score=0,
    ),
    RetrievedChunk(
        title="算法设计与分析课程说明",
        source_type="course_material",
        path="算法竞赛",
        tags=["算法设计", "动态规划", "图论"],
        content="课程重点训练分治、贪心、搜索、动态规划、图算法和复杂度证明。",
        score=0,
    ),
    RetrievedChunk(
        title="软件工程课程实践要求",
        source_type="course_material",
        path="软件项目实践",
        tags=["软件工程", "需求分析", "测试"],
        content="软件工程课程要求完成需求、设计、实现、测试、部署和迭代复盘。",
        score=0,
    ),
    RetrievedChunk(
        title="数据库系统课程作业说明",
        source_type="course_material",
        path="软件项目实践",
        tags=["数据库", "SQL", "数据模型"],
        content="数据库系统关注 ER 模型、关系设计、SQL 查询、事务、索引和数据一致性。",
        score=0,
    ),
]


COMPETITION_CHUNKS = [
    RetrievedChunk(
        title="蓝桥杯备赛资料",
        source_type="competition_material",
        path="算法竞赛",
        tags=["蓝桥杯", "算法", "真题"],
        content="蓝桥杯训练建议围绕基础语法、枚举、搜索、动态规划和真题复盘推进。",
        score=0,
    ),
    RetrievedChunk(
        title="ICPC 训练资料",
        source_type="competition_material",
        path="算法竞赛",
        tags=["ICPC", "团队赛", "算法"],
        content="ICPC 训练重视三人协作、题目分工、调试节奏、数据结构和图论专题。",
        score=0,
    ),
    RetrievedChunk(
        title="中国大学生计算机设计大赛资料",
        source_type="competition_material",
        path="软件项目实践",
        tags=["计算机设计大赛", "软件应用", "AI 应用"],
        content="计算机设计大赛适合软件应用、AI 应用和数字媒体类作品，需要可运行 Demo。",
        score=0,
    ),
    RetrievedChunk(
        title="中国国际大学生创新大赛资料",
        source_type="competition_material",
        path="AI 应用开发",
        tags=["创新创业", "路演", "商业计划"],
        content="创新大赛需要清晰用户场景、项目价值、推广路径、团队分工和路演材料。",
        score=0,
    ),
    RetrievedChunk(
        title="挑战杯竞赛资料",
        source_type="competition_material",
        path="软件项目实践",
        tags=["挑战杯", "科技作品", "研究报告"],
        content="挑战杯侧重学术科技作品、研究过程、创新点、证明材料和答辩表达。",
        score=0,
    ),
    RetrievedChunk(
        title="服务外包创新创业大赛资料",
        source_type="competition_material",
        path="软件项目实践",
        tags=["服务外包", "企业命题", "工程实践"],
        content="服务外包大赛强调企业命题理解、解决方案、系统原型、文档和演示视频。",
        score=0,
    ),
    RetrievedChunk(
        title="软件杯资料",
        source_type="competition_material",
        path="软件项目实践",
        tags=["软件杯", "项目开发", "工程能力"],
        content="软件杯适合展示软件需求分析、系统设计、核心功能实现和工程质量。",
        score=0,
    ),
    RetrievedChunk(
        title="华为 ICT 大赛资料",
        source_type="competition_material",
        path="AI 应用开发",
        tags=["ICT", "云计算", "AI"],
        content="华为 ICT 大赛关注云、网络、计算、AI 等方向的知识体系和实践能力。",
        score=0,
    ),
    RetrievedChunk(
        title="全国大学生信息安全竞赛资料",
        source_type="competition_material",
        path="软件项目实践",
        tags=["信息安全", "攻防", "安全开发"],
        content="信息安全竞赛关注安全基础、漏洞分析、攻防实践和安全工程能力。",
        score=0,
    ),
    RetrievedChunk(
        title="数据挖掘挑战赛资料",
        source_type="competition_material",
        path="AI 应用开发",
        tags=["数据挖掘", "机器学习", "建模"],
        content="数据挖掘比赛需要数据理解、特征工程、模型训练、评测指标和实验记录。",
        score=0,
    ),
]


PROJECT_CASE_CHUNKS = [
    RetrievedChunk(
        title="课程作业管理系统案例",
        source_type="project_case",
        path="软件项目实践",
        tags=["作业管理", "教师看板", "权限"],
        content="案例包含作业发布、提交记录、评分 Rubric、教师看板和学生反馈。",
        score=0,
    ),
    RetrievedChunk(
        title="校园二手交易平台案例",
        source_type="project_case",
        path="软件项目实践",
        tags=["交易平台", "数据库", "Web"],
        content="案例包含商品发布、搜索、收藏、订单、消息通知和基础风控。",
        score=0,
    ),
    RetrievedChunk(
        title="智能问答知识库案例",
        source_type="project_case",
        path="AI 应用开发",
        tags=["知识库", "问答", "引用"],
        content="案例包含文档入库、检索、引用展示、回答生成和反馈记录。",
        score=0,
    ),
    RetrievedChunk(
        title="RAG 文档问答系统案例",
        source_type="project_case",
        path="AI 应用开发",
        tags=["RAG", "向量检索", "评测"],
        content="案例包含解析、切片、向量检索、重排序、引用校验和评测样例。",
        score=0,
    ),
    RetrievedChunk(
        title="代码评测与报告系统案例",
        source_type="project_case",
        path="软件项目实践",
        tags=["代码分析", "测试", "报告"],
        content="案例包含代码上传、静态检查、测试结果、多维评分和改进建议。",
        score=0,
    ),
    RetrievedChunk(
        title="简历分析助手案例",
        source_type="project_case",
        path="AI 应用开发",
        tags=["简历分析", "能力画像", "建议"],
        content="案例包含简历解析、技能标签、岗位匹配、证据说明和修改建议。",
        score=0,
    ),
    RetrievedChunk(
        title="数据可视化看板案例",
        source_type="project_case",
        path="软件项目实践",
        tags=["可视化", "仪表盘", "ECharts"],
        content="案例包含指标体系、图表设计、筛选交互、权限和导出能力。",
        score=0,
    ),
    RetrievedChunk(
        title="小程序预约系统案例",
        source_type="project_case",
        path="软件项目实践",
        tags=["预约系统", "移动端", "后端接口"],
        content="案例包含预约资源、时段冲突、用户通知、管理员配置和统计报表。",
        score=0,
    ),
    RetrievedChunk(
        title="AI 学习助手案例",
        source_type="project_case",
        path="AI 应用开发",
        tags=["学习助手", "路径规划", "Agent"],
        content="案例包含画像采集、学习路径、任务生成、知识库问答和阶段复盘。",
        score=0,
    ),
    RetrievedChunk(
        title="项目协作管理工具案例",
        source_type="project_case",
        path="软件项目实践",
        tags=["协作管理", "任务", "复盘"],
        content="案例包含任务拆解、成员分工、进度追踪、风险记录和周复盘。",
        score=0,
    ),
]


SUPPORTING_CHUNKS = [
    RetrievedChunk(
        title="Web 应用开发课程作业 Rubric",
        source_type="rubric",
        path="软件项目实践",
        tags=["作业分析", "Rubric", "Web"],
        content=(
            "课程作业评分参考功能完成度、代码结构、工程规范、测试意识和文档表达。"
            "报告需要给出证据，不把分数表达为绝对能力判断。"
        ),
        score=0,
    ),
    RetrievedChunk(
        title="软件项目实践案例模板",
        source_type="project_case",
        path="软件项目实践",
        tags=["项目案例", "README", "接口设计"],
        content=(
            "项目案例建议包含需求背景、功能清单、技术栈、数据模型、接口设计、"
            "测试记录、评价 Rubric 和可扩展方向。"
        ),
        score=0,
    ),
    RetrievedChunk(
        title="AI 应用开发学习路径",
        source_type="course_material",
        path="AI 应用开发",
        tags=["RAG", "Agent", "大模型应用"],
        content=(
            "AI 应用开发首批路径包括 Prompt 基础、RAG 文档问答、Agent 工作流、"
            "评测记录和应用部署。建议先完成一个带引用的课程知识库问答 Demo。"
        ),
        score=0,
    ),
    RetrievedChunk(
        title="算法竞赛训练路径",
        source_type="competition_material",
        path="算法竞赛",
        tags=["蓝桥杯", "算法", "训练计划"],
        content=(
            "算法竞赛准备建议按基础语法、常用数据结构、搜索、动态规划、图论和真题复盘推进。"
            "训练计划应结合可用时间和已有题量。"
        ),
        score=0,
    ),
    RetrievedChunk(
        title="组队推荐能力互补规则",
        source_type="project_rule",
        path="软件项目实践",
        tags=["组队推荐", "能力画像", "双创"],
        content=(
            "组队推荐需要说明能力互补关系，例如算法、后端、前端、产品表达和项目管理。"
            "推荐理由应基于证据，不直接给出未经解释的名单。"
        ),
        score=0,
    ),
    RetrievedChunk(
        title="教师学情诊断看板说明",
        source_type="teacher_dashboard",
        path="软件项目实践",
        tags=["教师看板", "作业分析", "学情诊断"],
        content=(
            "教师端直接查看班级提交情况、维度分布、共性问题和学生个人作业报告。"
            "教师端不是审核流程，而是学情分析结果消费端。"
        ),
        score=0,
    ),
]


DEMO_CHUNKS = COURSE_CHUNKS + COMPETITION_CHUNKS + PROJECT_CASE_CHUNKS + SUPPORTING_CHUNKS


class RagPipeline:
    def retrieve(self, query: str, limit: int = 3) -> list[RetrievedChunk]:
        tokens = self._tokenize(query)
        scored = []
        for chunk in DEMO_CHUNKS:
            haystack = " ".join([chunk.title, chunk.content, chunk.path, " ".join(chunk.tags)])
            score = self._score(tokens, haystack)
            if score > 0:
                scored.append(
                    RetrievedChunk(
                        title=chunk.title,
                        source_type=chunk.source_type,
                        content=chunk.content,
                        path=chunk.path,
                        tags=chunk.tags,
                        score=score,
                    )
                )

        if not scored:
            scored = [
                RetrievedChunk(
                    title=chunk.title,
                    source_type=chunk.source_type,
                    content=chunk.content,
                    path=chunk.path,
                    tags=chunk.tags,
                    score=0.1,
                )
                for chunk in DEMO_CHUNKS[:limit]
            ]

        return sorted(scored, key=lambda item: item.score, reverse=True)[:limit]

    def answer(self, query: str) -> tuple[str, list[RetrievedChunk]]:
        chunks = self.retrieve(query)
        answer = self._compose_answer(query, chunks)
        return answer, chunks

    def _compose_answer(self, query: str, chunks: list[RetrievedChunk]) -> str:
        lead = "基于当前首批知识库资料，可以这样处理："
        if "竞赛" in query or "蓝桥" in query or "算法" in query:
            lead = "如果目标是算法竞赛准备，建议按训练路径拆成阶段任务："
        elif "作业" in query or "代码" in query or "教师" in query:
            lead = "如果目标是课程作业分析和教师学情诊断，建议围绕证据生成报告："
        elif "组队" in query:
            lead = "如果目标是组队推荐，建议先明确项目目标和能力互补关系："
        elif "RAG" in query or "知识库" in query or "Agent" in query:
            lead = "如果目标是 AI 应用开发，可以先完成带引用的知识库问答闭环："

        bullets = [f"{index}. {chunk.content}" for index, chunk in enumerate(chunks, start=1)]
        return "\n".join([lead, *bullets])

    def _tokenize(self, query: str) -> set[str]:
        normalized = query.lower()
        words = set(findall(r"[a-zA-Z0-9_]+", normalized))
        keywords = {
            "作业",
            "代码",
            "教师",
            "看板",
            "学情",
            "竞赛",
            "算法",
            "蓝桥",
            "组队",
            "项目",
            "案例",
            "知识库",
            "大模型",
            "RAG",
            "Agent",
            "测试",
            "Rubric",
        }
        return words | {keyword for keyword in keywords if keyword.lower() in normalized}

    def _score(self, tokens: set[str], haystack: str) -> float:
        normalized = haystack.lower()
        matched = sum(1 for token in tokens if token.lower() in normalized)
        return matched / max(len(tokens), 1)
