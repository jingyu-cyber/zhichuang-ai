from __future__ import annotations

from app.schemas.evaluations import (
    EvaluationCase,
    EvaluationCaseCreate,
    EvaluationCitation,
    EvaluationDashboardResponse,
    EvaluationRecord,
    EvaluationRecordCreate,
    EvaluationSummary,
    EvaluationUpsertResponse,
)


class EvaluationService:
    evaluated_at = "2026-07-05T10:30:00+08:00"

    cases = [
        EvaluationCase(
            case_id="eval_rag_algorithm_path",
            scenario="知识库问答",
            input_question="如何准备算法竞赛？",
            expected_focus=[
                "引用课程与竞赛资料",
                "给出阶段任务",
                "提示不确定信息需核验",
            ],
            priority="P0",
            status="已记录",
        ),
        EvaluationCase(
            case_id="eval_assignment_report",
            scenario="课程作业分析",
            input_question="分析 Flask Web 作业的工程质量和改进建议",
            expected_focus=["展示多维度评分", "关联代码证据", "给出下一步任务"],
            priority="P0",
            status="已记录",
        ),
        EvaluationCase(
            case_id="eval_growth_recommendation",
            scenario="成长与双创推荐",
            input_question="为 AI 应用开发方向学生推荐竞赛和队友",
            expected_focus=["说明适合原因", "说明需补足能力", "展示推荐证据"],
            priority="P0",
            status="已记录",
        ),
    ]

    records = [
        EvaluationRecord(
            record_id="record_001",
            case_id="eval_rag_algorithm_path",
            scenario="知识库问答",
            input_question="如何准备算法竞赛？",
            system_output=(
                "建议先按搜索、动态规划、图论和数学基础建立题单；"
                "每周保留固定复盘，比赛时间和规则以官方通知为准。"
            ),
            citations=[
                EvaluationCitation(
                    title="算法竞赛训练路径",
                    source_type="learning_path",
                    path="算法竞赛",
                    snippet=(
                        "算法竞赛首批路径包含搜索、动态规划、图论"
                        "和数学基础。"
                    ),
                ),
                EvaluationCitation(
                    title="蓝桥杯备赛说明",
                    source_type="competition",
                    path="算法竞赛",
                    snippet="竞赛安排、组别和报名节点应以官方通知为准。",
                ),
            ],
            manual_score=86,
            issue_notes=(
                "路径拆解清晰；后续需要补更多官方赛事链接和年份信息。"
            ),
            reviewer="项目评测组",
            evaluated_at=evaluated_at,
        ),
        EvaluationRecord(
            record_id="record_002",
            case_id="eval_assignment_report",
            scenario="课程作业分析",
            input_question="分析 Flask Web 作业的工程质量和改进建议",
            system_output=(
                "报告识别出路由、数据库模块和 README 基础完整，"
                "但测试覆盖、异常处理和输入校验不足；"
                "建议补充接口测试和错误提示样例。"
            ),
            citations=[
                EvaluationCitation(
                    title="Web 应用开发课程作业 Rubric",
                    source_type="rubric",
                    path="软件项目实践",
                    snippet=(
                        "课程作业评分参考功能完成度、代码结构、工程规范、"
                        "测试意识和文档表达。"
                    ),
                ),
            ],
            manual_score=90,
            issue_notes=(
                "能关联 Rubric 和作业证据；可继续补充具体文件级定位。"
            ),
            reviewer="项目评测组",
            evaluated_at=evaluated_at,
        ),
        EvaluationRecord(
            record_id="record_003",
            case_id="eval_growth_recommendation",
            scenario="成长与双创推荐",
            input_question="为 AI 应用开发方向学生推荐竞赛和队友",
            system_output=(
                "推荐中国大学生计算机设计大赛和中国国际大学生创新大赛"
                "作为主路径；"
                "队友侧优先匹配前端交互、算法评测和产品答辩能力互补者。"
            ),
            citations=[
                EvaluationCitation(
                    title="AI 应用开发项目案例",
                    source_type="project_case",
                    path="AI 应用开发",
                    snippet=(
                        "首个 Demo 应聚焦可演示、可复现、"
                        "可解释的真实学习或教学场景。"
                    ),
                ),
                EvaluationCitation(
                    title="组队推荐证据规则",
                    source_type="policy",
                    path="软件项目实践",
                    snippet=(
                        "推荐结果需要展示能力依据、来源证据、"
                        "短板和下一步行动。"
                    ),
                ),
            ],
            manual_score=84,
            issue_notes="推荐理由完整；后续要把竞赛资料库扩展到更多赛道。",
            reviewer="项目评测组",
            evaluated_at=evaluated_at,
        ),
    ]

    def dashboard(self) -> EvaluationDashboardResponse:
        average_score = round(
            sum(record.manual_score for record in self.records) / len(self.records)
        )
        passed = len([record for record in self.records if record.manual_score >= 80])

        return EvaluationDashboardResponse(
            summary=EvaluationSummary(
                total_cases=len(self.cases),
                completed_records=len(self.records),
                average_score=average_score,
                pass_rate=round(passed / len(self.records) * 100),
            ),
            cases=self.cases,
            records=self.records,
        )

    def list_cases(self) -> list[EvaluationCase]:
        return self.cases

    def list_records(self) -> list[EvaluationRecord]:
        return self.records

    def create_case(self, payload: EvaluationCaseCreate) -> EvaluationUpsertResponse:
        case_id = f"eval_custom_{len(self.cases) + 1:03d}"
        self.cases.append(
            EvaluationCase(
                case_id=case_id,
                scenario=payload.scenario,
                input_question=payload.input_question,
                expected_focus=payload.expected_focus,
                priority=payload.priority,
                status=payload.status,
            )
        )
        return EvaluationUpsertResponse(item_id=case_id, message="测试案例已记录。")

    def create_record(self, payload: EvaluationRecordCreate) -> EvaluationUpsertResponse:
        record_id = f"record_custom_{len(self.records) + 1:03d}"
        self.records.append(
            EvaluationRecord(
                record_id=record_id,
                case_id=payload.case_id,
                scenario=payload.scenario,
                input_question=payload.input_question,
                system_output=payload.system_output,
                citations=payload.citations or self._default_citations(payload.scenario),
                manual_score=payload.manual_score,
                issue_notes=payload.issue_notes,
                reviewer=payload.reviewer,
                evaluated_at=self.evaluated_at,
            )
        )
        return EvaluationUpsertResponse(item_id=record_id, message="测试输出记录已保存。")

    def _default_citations(self, scenario: str) -> list[EvaluationCitation]:
        return [
            EvaluationCitation(
                title=f"{scenario}测试依据",
                source_type="evaluation_case",
                path="测试评测",
                snippet="评测记录需要保存输入、输出、引用来源、评分和问题记录。",
            )
        ]
