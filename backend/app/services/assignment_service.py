from __future__ import annotations

import re
from datetime import datetime
from hashlib import sha1

from fastapi import HTTPException, status
from sqlalchemy import inspect, select, text
from sqlalchemy.orm import Session

from app.db.base import Base
from app.models.assignment import Assignment as AssignmentRecord
from app.models.assignment import AssignmentReport as AssignmentReportRecord
from app.models.assignment import Submission as SubmissionRecord
from app.models.course import ClassGroup, Course
from app.models.profile import CapabilityEvidence as CapabilityEvidenceRecord
from app.models.task import AgentTask
from app.schemas.auth import DemoAccount
from app.schemas.assignments import (
    AbilityHeatmapCell,
    AssignmentAnomaly,
    AssignmentCreateRequest,
    AssignmentDashboardMetric,
    AssignmentDashboardResponse,
    AssignmentAnalysisRequest,
    AssignmentAnalysisResponse,
    AssignmentExportResponse,
    AssignmentFinding,
    AssignmentItem,
    AssignmentListResponse,
    AssignmentReportSummary,
    AssignmentScore,
    AnalysisTraceStep,
    CapabilityEvidence,
    Citation,
    ClassAbilityProfile,
    CodeEvidenceSnippet,
    CodeFile,
    CodeStructureSummary,
    DataCoverageMetric,
    DirectionDistributionItem,
    TeachingSuggestion,
)
from app.services.repository_fetch_service import RepositoryFetchService


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
    student_directions = {
        "student_001": "AI 应用开发",
        "student_002": "前端交互",
        "student_003": "算法竞赛",
        "student_004": "产品与答辩",
        "student_005": "数据与后端",
    }

    def __init__(self, db: Session | None = None) -> None:
        self.db = db
        if self.db is not None:
            Base.metadata.create_all(bind=self.db.get_bind())
            self._ensure_assignment_schema()
            self._ensure_profile_evidence_schema()

    def list_assignments(self, account: DemoAccount | None = None) -> AssignmentListResponse:
        account = account or self._demo_teacher_account()
        items = (
            [self._demo_assignment_item(account)]
            if account.role == "student"
            or self._can_view_assignment(account, self.course["id"], self.class_group["id"])
            else []
        )
        if self.db is not None:
            records = self.db.scalars(
                select(AssignmentRecord).order_by(
                    AssignmentRecord.created_at.desc(),
                    AssignmentRecord.id.asc(),
                )
            ).all()
            for record in records:
                if record.id == self.assignment["id"]:
                    continue
                if account.role == "student":
                    if not self._has_student_report(record.id, account.user_id):
                        continue
                    class_id = record.class_id or self._class_id_for_assignment(record.id)
                    items.append(self._assignment_item_from_record(record, class_id, account))
                    continue
                class_id = record.class_id or self._class_id_for_assignment(record.id)
                if not self._can_view_assignment(account, record.course_id, class_id):
                    continue
                items.append(self._assignment_item_from_record(record, class_id, account))
        return AssignmentListResponse(assignments=items)

    def create_assignment(
        self,
        payload: AssignmentCreateRequest,
        account: DemoAccount | None = None,
    ) -> AssignmentItem:
        account = account or self._demo_teacher_account()
        self._ensure_dashboard_access(account, payload.course_id, payload.class_id)
        if self.db is None:
            return AssignmentItem(
                assignment_id=payload.assignment_id or self._assignment_id_from_title(payload.title),
                title=payload.title,
                course_id=payload.course_id,
                course_name=self._course_name(payload.course_id),
                class_id=payload.class_id,
                class_name=self._class_name(payload.class_id),
                description=payload.description or "",
                rubric_id=payload.rubric_id,
                created_at=datetime.utcnow().isoformat(),
                submitted_count=0,
                access_scope=self._access_scope(account),
            )
        now = datetime.utcnow()
        assignment_id = payload.assignment_id or self._assignment_id_from_title(payload.title)
        record = self.db.get(AssignmentRecord, assignment_id)
        if record is None:
            record = AssignmentRecord(
                id=assignment_id,
                course_id=payload.course_id,
                class_id=payload.class_id,
                title=payload.title,
                description=payload.description,
                rubric_id=payload.rubric_id,
                created_at=now,
            )
            self.db.add(record)
        else:
            record.course_id = payload.course_id
            record.class_id = payload.class_id
            record.title = payload.title
            record.description = payload.description
            record.rubric_id = payload.rubric_id
        self.db.commit()
        return self._assignment_item_from_record(record, payload.class_id, account)

    def analyze(
        self,
        payload: AssignmentAnalysisRequest,
        account: DemoAccount | None = None,
    ) -> AssignmentAnalysisResponse:
        account = account or self._demo_teacher_account()
        student_id = payload.student_id or "student_001"
        assignment_id = payload.assignment_id or self.assignment["id"]
        course_id = payload.course_id or self.course["id"]
        class_id = payload.class_id or self.class_group["id"]
        self._ensure_report_access(account, course_id, class_id, student_id)
        files = self._analysis_files(payload)
        report = self._build_report(
            assignment_id=assignment_id,
            student_id=student_id,
            assignment_title=payload.assignment_title,
            course_id=course_id,
            class_id=class_id,
            repository_url=payload.repository_url,
            description=payload.description,
            files=files,
            access_scope=self._access_scope(account),
        )
        report.agent_task_id = self._agent_task_id(report)
        self._save_report(report, payload, files)
        return report

    def get_report(
        self,
        assignment_id: str,
        student_id: str,
        account: DemoAccount | None = None,
    ) -> AssignmentAnalysisResponse:
        account = account or self._demo_teacher_account()
        assignment_meta = self._assignment_meta(assignment_id)
        self._ensure_report_access(
            account,
            assignment_meta["course_id"],
            assignment_meta["class_id"],
            student_id,
        )
        stored_report = self._stored_report(assignment_id, student_id)
        if stored_report is not None:
            stored_report.access_scope = self._access_scope(account)
            return stored_report
        return self._build_report(
            assignment_id=assignment_id,
            student_id=student_id,
            assignment_title=assignment_meta["title"],
            course_id=assignment_meta["course_id"],
            class_id=assignment_meta["class_id"],
            repository_url="https://example.edu/demo/flask-project",
            description="示例作业包含 Flask 路由、SQLite 数据访问、README 和基础测试。",
            files=self._demo_files(),
            access_scope=self._access_scope(account),
        )

    def get_dashboard(
        self,
        assignment_id: str,
        account: DemoAccount | None = None,
    ) -> AssignmentDashboardResponse:
        account = account or self._demo_teacher_account()
        assignment_meta = self._assignment_meta(assignment_id)
        self._ensure_dashboard_access(
            account,
            assignment_meta["course_id"],
            assignment_meta["class_id"],
        )
        reports = (
            [
                self.get_report(assignment_id, student_id, account=account)
                for student_id in self.students
            ]
            if assignment_id == self.assignment["id"]
            else []
        )
        reports.extend(self._stored_reports_for_dashboard(assignment_id, account))
        if not reports:
            return self._empty_dashboard_response(assignment_id, assignment_meta, account)
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

        common_findings = [
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
        ]
        anomalies = self._build_anomalies(reports)
        average_score = round(sum(self._overall_score(report) for report in reports) / len(reports))
        return AssignmentDashboardResponse(
            assignment_id=assignment_id,
            assignment_title=assignment_meta["title"],
            course_id=assignment_meta["course_id"],
            course_name=assignment_meta["course_name"],
            class_id=assignment_meta["class_id"],
            class_name=assignment_meta["class_name"],
            generated_at=self.generated_at,
            submitted_count=len(reports),
            total_students=max(32, len(reports)),
            average_score=average_score,
            metrics=[
                AssignmentDashboardMetric(
                    label="已提交",
                    value=f"{len(reports)} / {max(32, len(reports))}",
                    trend="系统已分析",
                ),
                AssignmentDashboardMetric(label="平均分", value=str(average_score), trend="+6 较上次项目"),
                AssignmentDashboardMetric(label="共性问题", value="3", trend="集中在测试和异常处理"),
                AssignmentDashboardMetric(label="讲评重点", value="2", trend="分层设计、测试覆盖"),
            ],
            dimension_averages=dimension_averages,
            common_findings=common_findings,
            anomalies=anomalies,
            teaching_suggestions=self._build_teaching_suggestions(
                common_findings,
                dimension_averages,
                submitted_count=len(reports),
            ),
            class_profile=self._build_class_profile(reports, dimension_averages),
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
            access_scope=self._access_scope(account),
        )

    def export_dashboard(
        self,
        assignment_id: str,
        account: DemoAccount | None = None,
    ) -> AssignmentExportResponse:
        dashboard = self.get_dashboard(assignment_id, account=account)
        markdown = self._dashboard_markdown(dashboard)
        return AssignmentExportResponse(
            assignment_id=dashboard.assignment_id,
            filename=f"{dashboard.assignment_id}_learning_report.md",
            markdown=markdown,
            generated_at=dashboard.generated_at,
            access_scope=dashboard.access_scope,
        )

    def _dashboard_markdown(self, dashboard: AssignmentDashboardResponse) -> str:
        lines = [
            f"# {dashboard.assignment_title} 学情诊断报告",
            "",
            f"- 课程：{dashboard.course_name}",
            f"- 班级：{dashboard.class_name}",
            f"- 生成时间：{dashboard.generated_at}",
            f"- 已分析提交：{dashboard.submitted_count}/{dashboard.total_students}",
            f"- 班级平均分：{dashboard.average_score}",
            "",
            "> 本报告由系统基于作业提交物、代码结构证据和课程 Rubric 自动生成，仅供教学诊断和学习改进参考。",
            "",
            "## 核心指标",
            "",
            "| 指标 | 数值 | 趋势/说明 |",
            "| --- | --- | --- |",
        ]
        lines.extend(
            f"| {metric.label} | {metric.value} | {metric.trend or '-'} |"
            for metric in dashboard.metrics
        )
        lines.extend(["", "## 能力维度均分", "", "| 维度 | 均分 | 证据摘要 |", "| --- | --- | --- |"])
        lines.extend(
            f"| {score.dimension} | {score.score} | {'；'.join(score.evidence) or score.summary} |"
            for score in dashboard.dimension_averages
        )
        lines.extend(["", "## 共性问题", ""])
        lines.extend(
            f"- **{finding.title}**：{finding.detail} 建议：{finding.suggestion}"
            for finding in dashboard.common_findings
        )
        lines.extend(["", "## 异常作业提示", ""])
        lines.extend(
            (
                f"- **{anomaly.title}（{anomaly.severity}）**：{anomaly.evidence} "
                f"涉及：{', '.join(anomaly.affected_students) if anomaly.affected_students else '无'}。"
                f"建议：{anomaly.suggested_action}"
            )
            for anomaly in dashboard.anomalies
        )
        lines.extend(["", "## 教学改进建议", ""])
        lines.extend(
            (
                f"- **{suggestion.knowledge_point}**：{suggestion.class_evidence} "
                f"课堂活动：{suggestion.suggested_activity} "
                f"课后任务：{suggestion.practice_task} "
                f"预期改进：{suggestion.expected_improvement}"
            )
            for suggestion in dashboard.teaching_suggestions
        )
        lines.extend(["", "## 学生报告摘要", "", "| 学生 | 综合分 | 状态 | 摘要 |", "| --- | --- | --- | --- |"])
        lines.extend(
            (
                f"| {report.student_name}（{report.student_id}） | "
                f"{report.overall_score} | {report.status} | {report.summary} |"
            )
            for report in dashboard.reports
        )
        lines.extend(["", "## 班级画像摘要", "", dashboard.class_profile.summary, ""])
        if dashboard.class_profile.common_weaknesses:
            lines.append("### 共性短板")
            lines.extend(f"- {weakness}" for weakness in dashboard.class_profile.common_weaknesses)
            lines.append("")
        lines.extend(
            [
                "### 数据覆盖",
                "",
                "| 项目 | 覆盖 | 比例 |",
                "| --- | --- | --- |",
            ]
        )
        lines.extend(
            f"| {metric.label} | {metric.covered}/{metric.total} | {round(metric.ratio * 100)}% |"
            for metric in dashboard.class_profile.data_coverage
        )
        lines.append("")
        return "\n".join(lines)

    def _build_anomalies(
        self,
        reports: list[AssignmentAnalysisResponse],
    ) -> list[AssignmentAnomaly]:
        missing_tests = [
            report.student_name for report in reports if not report.code_structure.test_files
        ]
        missing_docs = [
            report.student_name
            for report in reports
            if not report.code_structure.documentation_files
        ]
        risky_reports = [
            report.student_name for report in reports if report.code_structure.risk_signals
        ]

        anomalies: list[AssignmentAnomaly] = []
        if missing_tests:
            anomalies.append(
                AssignmentAnomaly(
                    severity="high",
                    title="缺少自动化测试证据",
                    affected_students=missing_tests,
                    evidence=f"{len(missing_tests)} 份提交未识别到测试文件。",
                    suggested_action="课堂讲评后要求补交接口测试或 service 层单元测试记录。",
                )
            )
        if missing_docs:
            anomalies.append(
                AssignmentAnomaly(
                    severity="medium",
                    title="缺少复现说明",
                    affected_students=missing_docs,
                    evidence=f"{len(missing_docs)} 份提交未识别到 README 或说明文档。",
                    suggested_action="提供统一 README 模板，要求补充启动步骤、接口列表和数据初始化说明。",
                )
            )
        if risky_reports:
            anomalies.append(
                AssignmentAnomaly(
                    severity="medium",
                    title="存在代码风险信号",
                    affected_students=risky_reports,
                    evidence=f"{len(risky_reports)} 份提交包含硬编码、过宽异常捕获或未完成标记。",
                    suggested_action="要求学生在下一轮提交中说明风险信号修正依据。",
                )
            )
        if not anomalies:
            anomalies.append(
                AssignmentAnomaly(
                    severity="low",
                    title="暂无高风险异常作业",
                    affected_students=[],
                    evidence="当前演示提交均具备入口、测试或文档等基础证据。",
                    suggested_action="继续按班级维度跟踪测试覆盖、文档复现和风险信号变化。",
                )
            )
        return anomalies[:3]

    def _build_class_profile(
        self,
        reports: list[AssignmentAnalysisResponse],
        dimension_averages: list[AssignmentScore],
    ) -> ClassAbilityProfile:
        heatmap = [
            AbilityHeatmapCell(
                student_id=report.student_id,
                student_name=report.student_name,
                dimension=score.dimension,
                score=score.score,
                level=self._score_level(score.score),
            )
            for report in reports
            for score in report.scores
        ]
        direction_counts: dict[str, int] = {}
        for report in reports:
            direction = self.student_directions.get(report.student_id, "软件项目实践")
            direction_counts[direction] = direction_counts.get(direction, 0) + 1
        submitted_count = len(reports)
        test_covered = len([report for report in reports if report.code_structure.test_files])
        doc_covered = len([report for report in reports if report.code_structure.documentation_files])
        common_weaknesses = [
            f"{score.dimension}均分 {score.score}，需要重点跟进"
            for score in dimension_averages
            if score.score < 78
        ]
        return ClassAbilityProfile(
            heatmap=heatmap,
            direction_distribution=[
                DirectionDistributionItem(
                    direction=direction,
                    count=count,
                    ratio=round(count / submitted_count, 2),
                )
                for direction, count in direction_counts.items()
            ],
            data_coverage=[
                DataCoverageMetric(
                    label="作业提交覆盖",
                    covered=submitted_count,
                    total=32,
                    ratio=round(submitted_count / 32, 2),
                ),
                DataCoverageMetric(
                    label="代码结构证据",
                    covered=len([report for report in reports if report.code_structure.file_count > 0]),
                    total=submitted_count,
                    ratio=1.0,
                ),
                DataCoverageMetric(
                    label="测试证据",
                    covered=test_covered,
                    total=submitted_count,
                    ratio=round(test_covered / submitted_count, 2),
                ),
                DataCoverageMetric(
                    label="文档证据",
                    covered=doc_covered,
                    total=submitted_count,
                    ratio=round(doc_covered / submitted_count, 2),
                ),
            ],
            common_weaknesses=common_weaknesses or ["当前维度均分稳定，建议继续补充可验证过程证据。"],
            summary=(
                f"已基于 {submitted_count} 份作业报告生成班级能力分布，"
                "覆盖作业提交、代码结构、测试和文档证据。"
            ),
        )

    def _build_report(
        self,
        assignment_id: str,
        student_id: str,
        assignment_title: str,
        course_id: str,
        class_id: str,
        repository_url: str | None,
        description: str | None,
        files: list[CodeFile],
        access_scope: str,
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
        evidence_snippets = self._build_evidence_snippets(files)
        improvement_tasks = self._build_improvement_tasks(structure)
        capability_evidence = [
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
        ]

        return AssignmentAnalysisResponse(
            report_id=f"report_{assignment_id}_{student_id}",
            assignment_id=assignment_id,
            assignment_title=assignment_title,
            course_id=course_id,
            course_name=self._course_name(course_id),
            class_id=class_id,
            class_name=self._class_name(class_id),
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
            evidence_snippets=evidence_snippets,
            capability_evidence=capability_evidence,
            analysis_trace=self._build_analysis_trace(
                structure=structure,
                scores=scores,
                findings=findings,
                capability_evidence=capability_evidence,
            ),
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
            access_scope=access_scope,
        )

    def _empty_dashboard_response(
        self,
        assignment_id: str,
        assignment_meta: dict[str, str],
        account: DemoAccount,
    ) -> AssignmentDashboardResponse:
        dimensions = ["功能完成度", "代码结构", "工程规范", "测试意识", "文档表达"]
        dimension_averages = [
            AssignmentScore(
                dimension=dimension,
                score=0,
                summary="当前作业尚无已分析提交。",
                evidence=["等待学生提交后生成维度证据。"],
            )
            for dimension in dimensions
        ]
        common_findings = [
            AssignmentFinding(
                severity="low",
                title="等待学生提交",
                detail="当前作业还没有可分析的提交物。",
                suggestion="发布作业后提醒学生提交 zip 包或仓库链接，系统会自动生成报告。",
            )
        ]
        return AssignmentDashboardResponse(
            assignment_id=assignment_id,
            assignment_title=assignment_meta["title"],
            course_id=assignment_meta["course_id"],
            course_name=assignment_meta["course_name"],
            class_id=assignment_meta["class_id"],
            class_name=assignment_meta["class_name"],
            generated_at=self.generated_at,
            submitted_count=0,
            total_students=32,
            average_score=0,
            metrics=[
                AssignmentDashboardMetric(label="已提交", value="0 / 32", trend="等待提交"),
                AssignmentDashboardMetric(label="平均分", value="0", trend="暂无评分"),
                AssignmentDashboardMetric(label="共性问题", value="0", trend="暂无提交"),
                AssignmentDashboardMetric(label="讲评重点", value="0", trend="暂无证据"),
            ],
            dimension_averages=dimension_averages,
            common_findings=common_findings,
            anomalies=[
                AssignmentAnomaly(
                    severity="low",
                    title="暂无作业提交",
                    affected_students=[],
                    evidence="当前作业尚无已分析提交。",
                    suggested_action="等待学生提交后再查看异常作业和讲评建议。",
                )
            ],
            teaching_suggestions=[
                TeachingSuggestion(
                    knowledge_point="提交规范说明",
                    class_evidence="当前作业尚无已分析提交。",
                    suggested_activity="课前明确 zip 包结构、README、测试文件和运行说明要求。",
                    practice_task="要求学生提交代码、测试、README 和必要配置文件。",
                    expected_improvement="提高后续作业分析的数据覆盖率和报告可解释性。",
                )
            ],
            class_profile=ClassAbilityProfile(
                heatmap=[],
                direction_distribution=[],
                data_coverage=[
                    DataCoverageMetric(label="作业提交覆盖", covered=0, total=32, ratio=0),
                    DataCoverageMetric(label="代码结构证据", covered=0, total=0, ratio=0),
                    DataCoverageMetric(label="测试证据", covered=0, total=0, ratio=0),
                    DataCoverageMetric(label="文档证据", covered=0, total=0, ratio=0),
                ],
                common_weaknesses=["当前作业尚无提交，暂不能形成班级共性短板。"],
                summary="当前作业尚无已分析提交。",
            ),
            reports=[],
            access_scope=self._access_scope(account),
        )

    def _save_report(
        self,
        report: AssignmentAnalysisResponse,
        payload: AssignmentAnalysisRequest,
        files: list[CodeFile] | None = None,
    ) -> None:
        if self.db is None:
            return
        now = datetime.utcnow()
        assignment = self.db.get(AssignmentRecord, report.assignment_id)
        if assignment is None:
            assignment = AssignmentRecord(
                id=report.assignment_id,
                course_id=report.course_id,
                class_id=report.class_id,
                title=report.assignment_title,
                description=payload.description,
                rubric_id=payload.rubric_id,
                created_at=now,
            )
            self.db.add(assignment)
        else:
            assignment.course_id = report.course_id
            assignment.class_id = report.class_id
            assignment.title = report.assignment_title
            assignment.description = payload.description
            assignment.rubric_id = payload.rubric_id

        submission_id = self._submission_id(report.assignment_id, report.student_id, payload, files)
        submission = self.db.get(SubmissionRecord, submission_id)
        if submission is None:
            submission = SubmissionRecord(
                id=submission_id,
                assignment_id=report.assignment_id,
                student_id=report.student_id,
                repository_url=payload.repository_url,
                storage_path=None,
                status="analyzed",
                submitted_at=now,
                created_at=now,
            )
            self.db.add(submission)
        else:
            submission.repository_url = payload.repository_url
            submission.status = "analyzed"
            submission.submitted_at = now

        report_record = self.db.get(AssignmentReportRecord, report.report_id)
        if report_record is None:
            report_record = AssignmentReportRecord(
                id=report.report_id,
                assignment_id=report.assignment_id,
                submission_id=submission_id,
                student_id=report.student_id,
                summary=report.summary,
                created_at=now,
            )
            self.db.add(report_record)
        report_record.submission_id = submission_id
        report_record.summary = report.summary
        report_record.scores_json = self._assignment_scores_json(report)
        report_record.evidence_json = self._assignment_evidence_json(report)
        report_record.findings_json = self._assignment_findings_json(report)
        self._save_agent_task(report, payload, files, now)
        self._sync_profile_evidence(report, now)
        self.db.commit()

    def _stored_report(
        self,
        assignment_id: str,
        student_id: str,
    ) -> AssignmentAnalysisResponse | None:
        if self.db is None:
            return None
        record = self.db.scalars(
            select(AssignmentReportRecord)
            .where(AssignmentReportRecord.assignment_id == assignment_id)
            .where(AssignmentReportRecord.student_id == student_id)
            .order_by(AssignmentReportRecord.created_at.desc())
        ).first()
        if record is None:
            return None
        payload = dict(record.evidence_json or {})
        if not payload:
            return None
        payload["access_scope"] = "demo"
        return AssignmentAnalysisResponse(**payload)

    def _stored_reports_for_dashboard(
        self,
        assignment_id: str,
        account: DemoAccount,
    ) -> list[AssignmentAnalysisResponse]:
        if self.db is None:
            return []
        records = self.db.scalars(
            select(AssignmentReportRecord)
            .where(AssignmentReportRecord.assignment_id == assignment_id)
            .order_by(AssignmentReportRecord.created_at.asc(), AssignmentReportRecord.id.asc())
        ).all()
        reports: list[AssignmentAnalysisResponse] = []
        seeded_student_ids = set(self.students)
        for record in records:
            if record.student_id in seeded_student_ids:
                continue
            payload = dict(record.evidence_json or {})
            if not payload:
                continue
            payload["access_scope"] = self._access_scope(account)
            reports.append(AssignmentAnalysisResponse(**payload))
        return reports

    def _submission_id(
        self,
        assignment_id: str,
        student_id: str,
        payload: AssignmentAnalysisRequest,
        files: list[CodeFile] | None = None,
    ) -> str:
        analysis_files = files if files is not None else payload.files
        file_basis = "|".join(f"{file.path}:{len(file.content)}" for file in analysis_files)
        raw = (
            f"{assignment_id}:{student_id}:{payload.repository_url or ''}:"
            f"{payload.description or ''}:{file_basis}"
        ).encode("utf-8")
        return f"submission_{sha1(raw).hexdigest()[:12]}"

    def _agent_task_id(self, report: AssignmentAnalysisResponse) -> str:
        raw = f"{report.assignment_id}:{report.student_id}:{report.report_id}".encode("utf-8")
        return f"agent_task_assignment_{sha1(raw).hexdigest()[:10]}"

    def _save_agent_task(
        self,
        report: AssignmentAnalysisResponse,
        payload: AssignmentAnalysisRequest,
        files: list[CodeFile] | None,
        now: datetime,
    ) -> None:
        if self.db is None or report.agent_task_id is None:
            return
        record = self.db.get(AgentTask, report.agent_task_id)
        if record is None:
            record = AgentTask(
                id=report.agent_task_id,
                task_type="assignment_analysis",
                owner_id=report.student_id,
                created_at=now,
            )
            self.db.add(record)
        record.status = "succeeded"
        record.input_json = {
            "assignment_id": report.assignment_id,
            "assignment_title": report.assignment_title,
            "course_id": report.course_id,
            "class_id": report.class_id,
            "student_id": report.student_id,
            "repository_url": payload.repository_url,
            "file_count": len(files or []),
        }
        record.state_json = {
            "current_node": "generate_report",
            "completed_nodes": [step.node for step in report.analysis_trace],
            "next_action": "报告已生成，可查看学生报告和班级看板",
            "scores": {score.dimension: score.score for score in report.scores},
        }
        record.result_ref = report.report_id
        record.error_message = None
        record.updated_at = now

    def _analysis_files(self, payload: AssignmentAnalysisRequest) -> list[CodeFile]:
        if payload.files or not payload.repository_url:
            return payload.files
        return RepositoryFetchService().fetch_repository_files(payload.repository_url)

    def _assignment_scores_json(self, report: AssignmentAnalysisResponse) -> dict:
        return {
            "scores": [score.model_dump(mode="json") for score in report.scores],
            "overall_score": self._overall_score(report),
        }

    def _assignment_evidence_json(self, report: AssignmentAnalysisResponse) -> dict:
        return report.model_dump(mode="json")

    def _assignment_findings_json(self, report: AssignmentAnalysisResponse) -> dict:
        return {
            "findings": [finding.model_dump(mode="json") for finding in report.findings],
            "improvement_tasks": report.improvement_tasks,
        }

    def _sync_profile_evidence(
        self,
        report: AssignmentAnalysisResponse,
        now: datetime,
    ) -> None:
        if self.db is None:
            return
        for item in report.capability_evidence:
            evidence_id = self._profile_evidence_id(report, item.dimension)
            record = self.db.get(CapabilityEvidenceRecord, evidence_id)
            if record is None:
                record = CapabilityEvidenceRecord(
                    id=evidence_id,
                    student_id=report.student_id,
                    dimension=item.dimension,
                    source_type="assignment_report",
                    source_id=report.report_id,
                    source_title=report.assignment_title,
                    evidence_text=item.evidence,
                    confidence=0.82,
                    weight=0.82,
                    created_at=now,
                )
                self.db.add(record)
            else:
                record.dimension = item.dimension
                record.source_type = "assignment_report"
                record.source_id = report.report_id
                record.source_title = report.assignment_title
                record.evidence_text = item.evidence
                record.confidence = 0.82
                record.weight = 0.82

    def _profile_evidence_id(
        self,
        report: AssignmentAnalysisResponse,
        dimension: str,
    ) -> str:
        raw = f"{report.report_id}:{report.student_id}:{dimension}".encode("utf-8")
        return f"evidence_{report.student_id}_assignment_{sha1(raw).hexdigest()[:10]}"

    def _demo_assignment_item(self, account: DemoAccount) -> AssignmentItem:
        return AssignmentItem(
            assignment_id=self.assignment["id"],
            title=self.assignment["title"],
            course_id=self.course["id"],
            course_name=self.course["name"],
            class_id=self.class_group["id"],
            class_name=self.class_group["name"],
            description="围绕 Flask 路由、页面、SQLite 数据访问和测试完成 Web 项目实践。",
            rubric_id=None,
            created_at=self.generated_at,
            submitted_count=(
                len(self.students)
                + len(self._stored_reports_for_dashboard(self.assignment["id"], account))
            ),
            access_scope=self._access_scope(account),
        )

    def _assignment_item_from_record(
        self,
        record: AssignmentRecord,
        class_id: str,
        account: DemoAccount,
    ) -> AssignmentItem:
        return AssignmentItem(
            assignment_id=record.id,
            title=record.title,
            course_id=record.course_id,
            course_name=self._course_name(record.course_id),
            class_id=class_id,
            class_name=self._class_name(class_id),
            description=record.description or "",
            rubric_id=record.rubric_id,
            created_at=record.created_at.isoformat(),
            submitted_count=self._submitted_count(record.id),
            access_scope=self._access_scope(account),
        )

    def _assignment_meta(self, assignment_id: str) -> dict[str, str]:
        if assignment_id == self.assignment["id"] or self.db is None:
            return {
                "title": self.assignment["title"],
                "course_id": self.course["id"],
                "course_name": self.course["name"],
                "class_id": self.class_group["id"],
                "class_name": self.class_group["name"],
            }
        record = self.db.get(AssignmentRecord, assignment_id)
        if record is None:
            return {
                "title": assignment_id,
                "course_id": self.course["id"],
                "course_name": self.course["name"],
                "class_id": self.class_group["id"],
                "class_name": self.class_group["name"],
            }
        class_id = record.class_id or self._class_id_for_assignment(record.id)
        return {
            "title": record.title,
            "course_id": record.course_id,
            "course_name": self._course_name(record.course_id),
            "class_id": class_id,
            "class_name": self._class_name(class_id),
        }

    def _class_id_for_assignment(self, assignment_id: str) -> str:
        if self.db is None:
            return self.class_group["id"]
        report = self.db.scalars(
            select(AssignmentReportRecord)
            .where(AssignmentReportRecord.assignment_id == assignment_id)
            .order_by(AssignmentReportRecord.created_at.desc())
        ).first()
        if report is None:
            return self.class_group["id"]
        payload = dict(report.evidence_json or {})
        return str(payload.get("class_id") or self.class_group["id"])

    def _course_name(self, course_id: str) -> str:
        if self.db is not None:
            record = self.db.get(Course, course_id)
            if record is not None:
                return record.name
        if course_id == self.course["id"]:
            return self.course["name"]
        return course_id

    def _class_name(self, class_id: str) -> str:
        if self.db is not None:
            record = self.db.get(ClassGroup, class_id)
            if record is not None:
                return record.name
        if class_id == self.class_group["id"]:
            return self.class_group["name"]
        return class_id

    def _submitted_count(self, assignment_id: str) -> int:
        if self.db is None:
            return 0
        records = self.db.scalars(
            select(AssignmentReportRecord).where(AssignmentReportRecord.assignment_id == assignment_id)
        ).all()
        return len({record.student_id for record in records})

    def _ensure_assignment_schema(self) -> None:
        if self.db is None:
            return
        bind = self.db.get_bind()
        inspector = inspect(bind)
        if not inspector.has_table("assignments"):
            return
        columns = {column["name"] for column in inspector.get_columns("assignments")}
        if "class_id" not in columns:
            self.db.execute(text("ALTER TABLE assignments ADD COLUMN class_id VARCHAR(64)"))
            self.db.commit()

    def _ensure_profile_evidence_schema(self) -> None:
        if self.db is None:
            return
        bind = self.db.get_bind()
        inspector = inspect(bind)
        if not inspector.has_table("capability_evidence"):
            return
        columns = {column["name"] for column in inspector.get_columns("capability_evidence")}
        statements = []
        if "source_title" not in columns:
            statements.append("ALTER TABLE capability_evidence ADD COLUMN source_title VARCHAR(200)")
        if "confidence" not in columns:
            statements.append("ALTER TABLE capability_evidence ADD COLUMN confidence FLOAT")
        for statement in statements:
            self.db.execute(text(statement))
        if statements:
            self.db.commit()

    def _assignment_id_from_title(self, title: str) -> str:
        digest = sha1(title.encode("utf-8")).hexdigest()[:10]
        return f"assignment_{digest}"

    def _overall_score(self, report: AssignmentAnalysisResponse) -> int:
        return round(sum(score.score for score in report.scores) / len(report.scores))

    def _dimension_summary(self, dimension: str, score: int) -> str:
        if score >= 85:
            return f"{dimension}整体表现较好，可作为讲评中的正向样例。"
        if score >= 75:
            return f"{dimension}达到课程阶段要求，但仍有集中改进空间。"
        return f"{dimension}低于预期，需要在下一次作业中重点跟进。"

    def _score_level(self, score: int) -> str:
        if score >= 85:
            return "strong"
        if score >= 75:
            return "stable"
        return "weak"

    def _build_teaching_suggestions(
        self,
        common_findings: list[AssignmentFinding],
        dimension_averages: list[AssignmentScore],
        submitted_count: int,
    ) -> list[TeachingSuggestion]:
        score_by_dimension = {score.dimension: score.score for score in dimension_averages}
        evidence_prefix = f"{submitted_count} 份已分析提交"
        suggestions: list[TeachingSuggestion] = []

        for finding in common_findings:
            if "异常" in finding.title:
                suggestions.append(
                    TeachingSuggestion(
                        knowledge_point="请求校验与异常处理",
                        class_evidence=(
                            f"{evidence_prefix}中出现“{finding.title}”；"
                            f"功能完成度均分 {score_by_dimension.get('功能完成度', 0)}。"
                        ),
                        suggested_activity="选取一个表单为空和一次数据库写入失败案例，现场改写为可复现的错误处理流程。",
                        practice_task="补充 2 个失败路径处理，并在 README 中说明错误提示策略。",
                        expected_improvement="降低主流程可用但边界场景失效的问题，提高功能完成度和工程规范稳定性。",
                    )
                )
            if "测试" in finding.title:
                suggestions.append(
                    TeachingSuggestion(
                        knowledge_point="接口测试与业务逻辑测试",
                        class_evidence=(
                            f"{evidence_prefix}中出现“{finding.title}”；"
                            f"测试意识均分 {score_by_dimension.get('测试意识', 0)}。"
                        ),
                        suggested_activity="用一份学生提交演示 pytest/TestClient 的成功、失败、空输入三类测试写法。",
                        practice_task="下一次提交至少包含 3 个 API 测试和 2 个 service 层单元测试。",
                        expected_improvement="让学生把功能完成从人工试运行推进到可复现验证，提升测试意识维度。",
                    )
                )
            if "README" in finding.title or "说明" in finding.title:
                suggestions.append(
                    TeachingSuggestion(
                        knowledge_point="项目文档与复现说明",
                        class_evidence=(
                            f"{evidence_prefix}中出现“{finding.title}”；"
                            f"文档表达均分 {score_by_dimension.get('文档表达', 0)}。"
                        ),
                        suggested_activity="课堂发放统一 README 模板，要求学生补齐启动命令、接口列表和数据库初始化步骤。",
                        practice_task="按模板重写 README，并将运行截图或测试命令输出放入报告。",
                        expected_improvement="减少教师复现实验成本，提升项目表达和工程交付完整度。",
                    )
                )

        if len(suggestions) < 2:
            weakest = min(dimension_averages, key=lambda score: score.score)
            suggestions.append(
                TeachingSuggestion(
                    knowledge_point=f"{weakest.dimension}巩固",
                    class_evidence=f"{evidence_prefix}中{weakest.dimension}均分 {weakest.score}，是当前最低维度。",
                    suggested_activity=f"围绕{weakest.dimension}选取一份高分样例和一份待改进样例进行对比讲评。",
                    practice_task=f"要求学生提交一项针对{weakest.dimension}的修订记录。",
                    expected_improvement="把班级均分短板转化为下一次作业的明确改进动作。",
                )
            )

        return suggestions[:3]

    def _build_evidence_snippets(self, files: list[CodeFile]) -> list[CodeEvidenceSnippet]:
        snippets: list[CodeEvidenceSnippet] = []
        for file in files:
            path = file.path.strip()
            if not path or not file.content:
                continue
            lowered_path = path.lower()
            lines = file.content.splitlines()
            for index, line in enumerate(lines, start=1):
                capability = self._line_capability(line, lowered_path)
                if not capability:
                    continue
                snippets.append(
                    CodeEvidenceSnippet(
                        path=path,
                        module=self._module_name(path),
                        capability=capability,
                        line_start=index,
                        line_end=index,
                        snippet=line.strip()[:180],
                    )
                )
                break
            if len(snippets) >= 5:
                break

        if snippets:
            return snippets
        return [
            CodeEvidenceSnippet(
                path="未识别",
                module="未识别",
                capability="待补充代码证据",
                line_start=0,
                line_end=0,
                snippet="当前提交未提供可抽取的关键代码片段。",
            )
        ]

    def _line_capability(self, line: str, lowered_path: str) -> str | None:
        lowered_line = line.lower()
        if "@app.route" in lowered_line or "apirouter" in lowered_line or "route(" in lowered_line:
            return "路由入口"
        if "sqlite" in lowered_line or "sqlalchemy" in lowered_line or "select " in lowered_line:
            return "数据访问"
        if "pytest" in lowered_line or lowered_path.startswith("tests/") or "test_" in lowered_path:
            return "自动化测试"
        if "try:" in lowered_line or "except" in lowered_line:
            return "异常处理"
        if "react" in lowered_line or "tsx" in lowered_path or "jsx" in lowered_path:
            return "页面交互"
        if lowered_path.endswith(("readme.md", ".md", ".rst")):
            return "文档表达"
        return None

    def _module_name(self, path: str) -> str:
        if "/" not in path:
            return path.rsplit(".", 1)[0]
        return path.rsplit("/", 1)[0]

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

    def _build_analysis_trace(
        self,
        structure: CodeStructureSummary,
        scores: list[AssignmentScore],
        findings: list[AssignmentFinding],
        capability_evidence: list[CapabilityEvidence],
    ) -> list[AnalysisTraceStep]:
        score_map = {score.dimension: score for score in scores}
        return [
            AnalysisTraceStep(
                node="parse_files",
                title="文件解析",
                status="completed",
                summary=f"识别 {structure.file_count} 个可分析文本文件。",
                evidence=[
                    self._format_paths("入口文件", structure.entry_files),
                    self._format_paths("配置文件", structure.config_files),
                ],
            ),
            AnalysisTraceStep(
                node="summarize_structure",
                title="结构识别",
                status="completed",
                summary=score_map["代码结构"].summary,
                evidence=[
                    self._format_items("识别框架", structure.detected_frameworks),
                    self._format_items("能力信号", structure.detected_capabilities),
                ],
            ),
            AnalysisTraceStep(
                node="review_quality",
                title="质量与风险检查",
                status="completed",
                summary=score_map["工程规范"].summary,
                evidence=[
                    self._format_items("风险信号", structure.risk_signals),
                    self._format_paths("测试文件", structure.test_files),
                ],
            ),
            AnalysisTraceStep(
                node="extract_capability_evidence",
                title="能力证据提取",
                status="completed",
                summary=f"生成 {len(capability_evidence)} 类能力证据，作为画像更新依据。",
                evidence=[item.evidence for item in capability_evidence],
            ),
            AnalysisTraceStep(
                node="generate_report",
                title="报告生成",
                status="completed",
                summary=f"汇总 {len(scores)} 个评分维度和 {len(findings)} 条问题建议。",
                evidence=[finding.title for finding in findings[:3]],
            ),
        ]

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

    def _ensure_report_access(
        self,
        account: DemoAccount,
        course_id: str,
        class_id: str,
        student_id: str,
    ) -> None:
        if account.role == "admin":
            return
        if account.role == "student" and account.user_id == student_id:
            return
        if account.role == "teacher" and self._has_course_class_access(account, course_id, class_id):
            return
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No access to this assignment report",
        )

    def _ensure_dashboard_access(
        self,
        account: DemoAccount,
        course_id: str,
        class_id: str,
    ) -> None:
        if account.role == "admin":
            return
        if account.role == "teacher" and self._has_course_class_access(account, course_id, class_id):
            return
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No access to this assignment dashboard",
        )

    def _has_course_class_access(
        self,
        account: DemoAccount,
        course_id: str,
        class_id: str,
    ) -> bool:
        course_allowed = (
            self.course["name"] in account.authorized_courses
            or course_id in account.authorized_courses
        )
        class_allowed = (
            self.class_group["name"] in account.authorized_classes
            or class_id in account.authorized_classes
        )
        return course_allowed and class_allowed

    def _can_view_assignment(
        self,
        account: DemoAccount,
        course_id: str,
        class_id: str,
    ) -> bool:
        return account.role == "admin" or (
            account.role == "teacher" and self._has_course_class_access(account, course_id, class_id)
        )

    def _has_student_report(self, assignment_id: str, student_id: str) -> bool:
        if self.db is None:
            return False
        report = self.db.scalars(
            select(AssignmentReportRecord)
            .where(AssignmentReportRecord.assignment_id == assignment_id)
            .where(AssignmentReportRecord.student_id == student_id)
        ).first()
        return report is not None

    def _access_scope(self, account: DemoAccount) -> str:
        if account.role == "admin":
            return "admin:all_demo_courses"
        if account.role == "teacher":
            return "teacher:authorized_course_class"
        return "student:self"

    def _demo_teacher_account(self) -> DemoAccount:
        return DemoAccount(
            user_id="teacher_001",
            name="周老师",
            role="teacher",
            title="教师演示账号",
            default_view="teacher",
            authorized_courses=[self.course["name"]],
            authorized_classes=[self.class_group["name"]],
            modules=["教师看板", "学生报告", "知识库问答"],
        )

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
