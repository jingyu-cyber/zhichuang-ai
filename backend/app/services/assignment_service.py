from __future__ import annotations

import re

from app.schemas.assignments import (
    AssignmentDashboardMetric,
    AssignmentDashboardResponse,
    AssignmentAnalysisRequest,
    AssignmentAnalysisResponse,
    AssignmentFinding,
    AssignmentReportSummary,
    AssignmentScore,
    CapabilityEvidence,
    Citation,
    CodeFile,
    CodeStructureSummary,
)


class AssignmentService:
    generated_at = "2026-07-04T21:00:00+08:00"

    course = {
        "id": "course_web_2026",
        "name": "Web 应用开发",
    }
    class_group = {
        "id": "class_cs_2024_01",
        "name": "2024 级计算机科学与技术 1 班",
    }
    assignment = {
        "id": "assignment_flask_mvp",
        "title": "Flask Web 项目实践",
    }
    students = {
        "student_001": "林一舟",
        "student_002": "陈星然",
        "student_003": "周明远",
        "student_004": "沈知夏",
        "student_005": "许嘉木",
    }

    def analyze(self, payload: AssignmentAnalysisRequest) -> AssignmentAnalysisResponse:
        student_id = payload.student_id or "student_001"
        return self._build_report(
            student_id=student_id,
            assignment_title=payload.assignment_title,
            course_id=payload.course_id or self.course["id"],
            class_id=payload.class_id or self.class_group["id"],
            repository_url=payload.repository_url,
            description=payload.description,
            files=payload.files,
        )

    def get_report(self, assignment_id: str, student_id: str) -> AssignmentAnalysisResponse:
        title = self.assignment["title"] if assignment_id == self.assignment["id"] else assignment_id
        return self._build_report(
            student_id=student_id,
            assignment_title=title,
            course_id=self.course["id"],
            class_id=self.class_group["id"],
            repository_url="https://example.edu/demo/flask-project",
            description="示例作业包含 Flask 路由、SQLite 数据访问、README 和基础测试。",
            files=self._demo_files(),
        )

    def get_dashboard(self, assignment_id: str) -> AssignmentDashboardResponse:
        reports = [self.get_report(assignment_id, student_id) for student_id in self.students]
        dimension_names = [score.dimension for score in reports[0].scores]
        dimension_averages = []
        for dimension in dimension_names:
            dimension_scores = [
                score.score
                for report in reports
                for score in report.scores
                if score.dimension == dimension
            ]
            avg = round(sum(dimension_scores) / len(dimension_scores))
            dimension_averages.append(
                AssignmentScore(
                    dimension=dimension,
                    score=avg,
                    summary=self._dimension_summary(dimension, avg),
                    evidence=[f"{len(dimension_scores)} 份提交的同维度证据汇总"],
                )
            )

        average_score = round(sum(self._overall_score(report) for report in reports) / len(reports))
        return AssignmentDashboardResponse(
            assignment_id=assignment_id,
            assignment_title=self.assignment["title"],
            course_id=self.course["id"],
            course_name=self.course["name"],
            class_id=self.class_group["id"],
            class_name=self.class_group["name"],
            generated_at=self.generated_at,
            submitted_count=len(reports),
            total_students=32,
            average_score=average_score,
            metrics=[
                AssignmentDashboardMetric(label="已提交", value="5 / 32", trend="演示样例"),
                AssignmentDashboardMetric(label="平均分", value=str(average_score), trend="+6 较上次项目"),
                AssignmentDashboardMetric(label="共性问题", value="3", trend="集中在测试和异常处理"),
                AssignmentDashboardMetric(label="讲评重点", value="2", trend="分层设计、测试覆盖"),
            ],
            dimension_averages=dimension_averages,
            common_findings=[
                AssignmentFinding(
                    severity="medium",
                    title="异常路径处理不足",
                    detail="多数提交覆盖了主流程，但对表单为空、数据库写入失败等情况缺少处理。",
                    suggestion="讲评时可以集中演示请求校验、异常捕获和错误提示的标准写法。",
                ),
                AssignmentFinding(
                    severity="medium",
                    title="测试覆盖偏弱",
                    detail="示例提交中只有少量同学提供接口测试或 service 层单元测试。",
                    suggestion="下一次作业要求提交至少 3 个 API 测试和 2 个业务逻辑测试。",
                ),
                AssignmentFinding(
                    severity="low",
                    title="README 运行说明不完整",
                    detail="部分项目缺少环境变量、初始化数据库和启动命令说明。",
                    suggestion="提供课程统一 README 模板，作为工程规范评分依据。",
                ),
            ],
            reports=[
                AssignmentReportSummary(
                    report_id=report.report_id,
                    student_id=report.student_id,
                    student_name=report.student_name,
                    overall_score=self._overall_score(report),
                    status="已分析",
                    summary=report.summary,
                )
                for report in reports
            ],
        )

    def _build_report(
        self,
        student_id: str,
        assignment_title: str,
        course_id: str,
        class_id: str,
        repository_url: str | None,
        description: str | None,
        files: list[CodeFile],
    ) -> AssignmentAnalysisResponse:
        student_name = self.students.get(student_id, "演示学生")
        structure = self._analyze_files(files)
        repository_signal = bool(repository_url)
        description_signal = bool(description and len(description) >= 20)
        file_signal = min(structure.file_count, 20)
        has_main_flow = self._has_any(
            structure.detected_capabilities,
            ["路由入口", "数据访问", "页面模板", "接口定义"],
        )
        has_tests = bool(structure.test_files)
        has_docs = bool(structure.documentation_files) or description_signal
        has_config = bool(structure.config_files)
        risk_penalty = min(len(structure.risk_signals) * 3, 9)

        base = 66 + (4 if repository_signal else 0) + (3 if description_signal else 0)
        completion_score = min(92, base + file_signal // 2 + (8 if has_main_flow else 0))
        structure_score = min(92, base + file_signal // 3 + (8 if has_config else 0))
        quality_score = max(58, min(88, base + (6 if has_config else 0) - risk_penalty))
        test_score = max(52, min(84, base - 10 + min(len(structure.test_files) * 8, 18)))
        document_score = max(56, min(90, base + (10 if has_docs else 0)))

        scores = [
            AssignmentScore(
                dimension="功能完成度",
                score=completion_score,
                summary=self._score_summary(
                    has_main_flow,
                    "核心路由、接口或数据访问证据较清晰，主流程具备闭环基础。",
                    "提交物中主流程证据不足，需要补充入口文件、接口实现或页面交互。",
                ),
                evidence=[
                    *self._capability_evidence_lines(structure, ["路由入口", "数据访问", "接口定义"]),
                    f"提交文件数 {structure.file_count}，可用于判断功能覆盖面。",
                ],
            ),
            AssignmentScore(
                dimension="代码结构",
                score=structure_score,
                summary=self._score_summary(
                    bool(structure.entry_files and structure.detected_frameworks),
                    "项目入口和技术框架可识别，具备基本分层分析基础。",
                    "项目入口或框架信号不充分，教师需要结合提交物进一步确认结构。",
                ),
                evidence=[
                    self._format_paths("入口文件", structure.entry_files),
                    self._format_items("识别框架", structure.detected_frameworks),
                ],
            ),
            AssignmentScore(
                dimension="工程规范",
                score=quality_score,
                summary=self._score_summary(
                    has_config and not structure.risk_signals,
                    "配置、依赖或环境文件较完整，暂未发现明显工程风险信号。",
                    "依赖配置、异常处理或工程边界仍需加强。",
                ),
                evidence=[
                    self._format_paths("配置文件", structure.config_files),
                    self._format_items("风险信号", structure.risk_signals),
                ],
            ),
            AssignmentScore(
                dimension="测试意识",
                score=test_score,
                summary=self._score_summary(
                    has_tests,
                    "提交物包含自动化测试文件，可作为质量意识证据。",
                    "未识别到自动化测试文件，建议补充接口和业务逻辑测试。",
                ),
                evidence=[
                    self._format_paths("测试文件", structure.test_files),
                    "测试评分基于测试文件数量和覆盖信号生成。",
                ],
            ),
            AssignmentScore(
                dimension="文档表达",
                score=document_score,
                summary=self._score_summary(
                    has_docs,
                    "说明文档或作业描述能支撑教师快速理解项目。",
                    "文档证据不足，建议补充运行步骤、接口说明和已知限制。",
                ),
                evidence=[
                    self._format_paths("文档文件", structure.documentation_files),
                    "作业描述达到有效长度" if description_signal else "作业描述信息偏少",
                ],
            ),
        ]
        findings = self._build_findings(structure)
        improvement_tasks = self._build_improvement_tasks(structure)

        return AssignmentAnalysisResponse(
            report_id=f"report_{self.assignment['id']}_{student_id}",
            assignment_id=self.assignment["id"],
            assignment_title=assignment_title,
            course_id=course_id,
            course_name=self.course["name"],
            class_id=class_id,
            class_name=self.class_group["name"],
            student_id=student_id,
            student_name=student_name,
            generated_at=self.generated_at,
            summary=(
                f"{student_name} 的提交已经完成多维度分析。系统识别到"
                f" {structure.file_count} 个文件、{len(structure.detected_capabilities)} 类能力信号，"
                "评分是基于提交物证据的相对画像。"
            ),
            code_structure=structure,
            scores=[
                *scores,
            ],
            findings=findings,
            capability_evidence=[
                CapabilityEvidence(
                    dimension="工程实践",
                    evidence=self._format_items(
                        "识别到的实现能力",
                        structure.detected_capabilities,
                    ),
                    source="代码文件路径与内容扫描",
                ),
                CapabilityEvidence(
                    dimension="问题拆解",
                    evidence=self._format_paths("入口和模块文件", structure.entry_files),
                    source="项目结构分析",
                ),
                CapabilityEvidence(
                    dimension="质量意识",
                    evidence=self._format_paths("自动化测试文件", structure.test_files),
                    source="测试文件与代码路径分析",
                ),
            ],
            improvement_tasks=improvement_tasks,
            citations=[
                Citation(
                    title="Web 应用开发课程作业 Rubric",
                    source_type="rubric",
                    snippet="评分参考功能完成度、代码结构、工程规范、测试意识和文档表达。",
                ),
                Citation(
                    title="软件项目实践知识库",
                    source_type="knowledge_base",
                    snippet="项目报告应包含需求背景、架构设计、接口设计、测试和可扩展方向。",
                ),
            ],
        )

    def _overall_score(self, report: AssignmentAnalysisResponse) -> int:
        return round(sum(score.score for score in report.scores) / len(report.scores))

    def _dimension_summary(self, dimension: str, score: int) -> str:
        if score >= 85:
            return f"{dimension}整体表现较好，可作为讲评中的正向样例。"
        if score >= 75:
            return f"{dimension}达到课程阶段要求，但仍有集中改进空间。"
        return f"{dimension}低于预期，需要在下一次作业中重点跟进。"

    def _analyze_files(self, files: list[CodeFile]) -> CodeStructureSummary:
        entry_files: list[str] = []
        test_files: list[str] = []
        documentation_files: list[str] = []
        config_files: list[str] = []
        frameworks: set[str] = set()
        capabilities: set[str] = set()
        risk_signals: set[str] = set()

        for file in files:
            path = file.path.strip()
            lowered_path = path.lower()
            content = file.content.lower()
            if not path:
                continue

            if lowered_path.endswith((".py", ".ts", ".tsx", ".js", ".jsx")) and (
                lowered_path in {"app.py", "main.py", "manage.py"}
                or lowered_path.endswith(("/app.py", "/main.py", "/index.tsx", "/main.tsx"))
            ):
                entry_files.append(path)
            if "test" in lowered_path or lowered_path.endswith((".spec.ts", ".spec.tsx")):
                test_files.append(path)
            if lowered_path.endswith(("readme.md", ".md", ".rst")):
                documentation_files.append(path)
            if lowered_path.endswith(
                ("requirements.txt", "pyproject.toml", "package.json", ".env.example", "dockerfile")
            ):
                config_files.append(path)

            if "from flask" in content or "flask(" in content:
                frameworks.add("Flask")
                capabilities.add("路由入口")
            if "fastapi" in content:
                frameworks.add("FastAPI")
                capabilities.add("接口定义")
            if "react" in content or "jsx" in lowered_path or "tsx" in lowered_path:
                frameworks.add("React")
                capabilities.add("页面交互")
            if "sqlite" in content or "sqlalchemy" in content or "select " in content:
                capabilities.add("数据访问")
            if "@app.route" in content or "apirouter" in content or "route(" in content:
                capabilities.add("路由入口")
            if "render_template" in content or lowered_path.startswith("templates/"):
                capabilities.add("页面模板")
            if "pytest" in content or "testclient" in content or "describe(" in content:
                capabilities.add("自动化测试")
            if "try:" in content and "except" in content:
                capabilities.add("异常处理")
            if "password" in content and ("hardcode" in content or "123456" in content):
                risk_signals.add("疑似硬编码敏感配置")
            if "except:" in content:
                risk_signals.add("存在过宽异常捕获")
            if re.search(r"(^|\s|#|//)(todo|fixme)(\b|:)", content):
                risk_signals.add("存在未完成标记")

        if not files:
            risk_signals.add("未上传代码文件")

        return CodeStructureSummary(
            file_count=len([file for file in files if file.path.strip()]),
            entry_files=entry_files[:8],
            test_files=test_files[:8],
            documentation_files=documentation_files[:8],
            config_files=config_files[:8],
            detected_frameworks=sorted(frameworks),
            detected_capabilities=sorted(capabilities),
            risk_signals=sorted(risk_signals),
        )

    def _build_findings(self, structure: CodeStructureSummary) -> list[AssignmentFinding]:
        findings: list[AssignmentFinding] = []
        if not structure.test_files:
            findings.append(
                AssignmentFinding(
                    severity="high",
                    title="测试覆盖不足",
                    detail="当前提交未识别到自动化测试文件，缺少对主流程和异常路径的可复现验证。",
                    suggestion="补充 pytest、TestClient 或前端请求层测试，覆盖成功、失败和空输入路径。",
                )
            )
        if not structure.config_files:
            findings.append(
                AssignmentFinding(
                    severity="medium",
                    title="依赖和配置说明不足",
                    detail="提交物中未识别到 requirements、pyproject、package 或环境示例文件。",
                    suggestion="补齐依赖清单、环境变量示例和启动配置，降低教师复现实验成本。",
                )
            )
        if not structure.documentation_files:
            findings.append(
                AssignmentFinding(
                    severity="medium",
                    title="项目说明缺失",
                    detail="提交物中未识别到 README 或说明文档，影响教师快速理解项目目标和运行方式。",
                    suggestion="按课程模板补齐环境准备、启动命令、接口列表、数据表和已知问题。",
                )
            )
        for signal in structure.risk_signals:
            findings.append(
                AssignmentFinding(
                    severity="medium",
                    title=signal,
                    detail=f"代码扫描发现“{signal}”，需要结合具体文件进一步确认影响范围。",
                    suggestion="在下一轮提交中移除风险写法，并在报告中说明修正依据。",
                )
            )
        if not findings:
            findings.append(
                AssignmentFinding(
                    severity="low",
                    title="继续提升边界场景说明",
                    detail="当前提交具备较完整的结构证据，后续仍建议补充接口边界和失败路径说明。",
                    suggestion="在 README 中加入接口表、错误处理策略和测试覆盖范围。",
                )
            )
        return findings[:5]

    def _build_improvement_tasks(self, structure: CodeStructureSummary) -> list[str]:
        tasks: list[str] = []
        if not structure.test_files:
            tasks.append("补充至少 3 个自动化测试，覆盖成功、失败和空输入路径。")
        if not structure.config_files:
            tasks.append("补齐依赖清单、环境变量示例和本地启动配置。")
        if not structure.documentation_files:
            tasks.append("按课程模板补齐 README 中的启动步骤、接口说明和数据表说明。")
        if structure.risk_signals:
            tasks.append("逐项修正代码扫描发现的风险信号，并在提交说明中记录修改依据。")
        tasks.append("将本次报告中的能力证据同步到个人画像，用于后续路径和竞赛推荐。")
        return tasks[:5]

    def _capability_evidence_lines(
        self,
        structure: CodeStructureSummary,
        names: list[str],
    ) -> list[str]:
        matched = [name for name in names if name in structure.detected_capabilities]
        if not matched:
            return ["未识别到明确的主流程能力信号"]
        return [f"识别到{name}能力信号" for name in matched]

    def _format_paths(self, label: str, paths: list[str]) -> str:
        if not paths:
            return f"{label}：未识别"
        return f"{label}：" + "、".join(paths[:4])

    def _format_items(self, label: str, items: list[str]) -> str:
        if not items:
            return f"{label}：未识别"
        return f"{label}：" + "、".join(items[:5])

    def _score_summary(self, condition: bool, positive: str, negative: str) -> str:
        return positive if condition else negative

    def _has_any(self, items: list[str], targets: list[str]) -> bool:
        return any(target in items for target in targets)

    def _demo_files(self) -> list[CodeFile]:
        return [
            CodeFile(
                path="app.py",
                content=(
                    "from flask import Flask, request, render_template\n"
                    "app = Flask(__name__)\n"
                    "@app.route('/todos', methods=['GET', 'POST'])\n"
                    "def todos():\n"
                    "    try:\n"
                    "        return render_template('todos.html')\n"
                    "    except Exception:\n"
                    "        return 'error', 500\n"
                ),
            ),
            CodeFile(
                path="services/todo_service.py",
                content="import sqlite3\n\ndef create_todo(title):\n    return sqlite3.connect('demo.db')",
            ),
            CodeFile(
                path="tests/test_app.py",
                content="from app import app\n\ndef test_todos_page():\n    client = app.test_client()\n    assert client.get('/todos').status_code == 200",
            ),
            CodeFile(path="requirements.txt", content="flask\npytest\n"),
            CodeFile(path="README.md", content="Flask Web 项目实践\n\n启动、接口和数据库说明。"),
        ]
