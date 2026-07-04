from __future__ import annotations

from pydantic import BaseModel, Field


class EvaluationCitation(BaseModel):
    title: str
    source_type: str
    path: str
    snippet: str


class EvaluationCase(BaseModel):
    case_id: str
    scenario: str
    input_question: str
    expected_focus: list[str] = Field(default_factory=list)
    priority: str
    status: str


class EvaluationCaseCreate(BaseModel):
    scenario: str = "竞赛准备计划"
    input_question: str = "为中国大学生计算机设计大赛生成 4 周准备计划"
    expected_focus: list[str] = Field(default_factory=lambda: ["时间节点", "官方依据", "交付物"])
    priority: str = "P0"
    status: str = "已记录"


class EvaluationRecord(BaseModel):
    record_id: str
    case_id: str
    scenario: str
    input_question: str
    system_output: str
    citations: list[EvaluationCitation] = Field(default_factory=list)
    manual_score: int
    issue_notes: str
    reviewer: str
    evaluated_at: str
    ai_generated: bool = True


class EvaluationRecordCreate(BaseModel):
    case_id: str = "eval_competition_preparation"
    scenario: str = "竞赛准备计划"
    input_question: str = "为中国大学生计算机设计大赛生成 4 周准备计划"
    system_output: str = "系统生成包含规则确认、原型完善、材料准备和报名检查的 4 周计划。"
    citations: list[EvaluationCitation] = Field(default_factory=list)
    manual_score: int = 88
    issue_notes: str = "计划包含时间节点和官方依据，后续可继续补充学校内部报名流程。"
    reviewer: str = "项目评测组"


class EvaluationUpsertResponse(BaseModel):
    item_id: str
    message: str


class EvaluationSummary(BaseModel):
    total_cases: int
    completed_records: int
    average_score: int
    pass_rate: int


class EvaluationDashboardResponse(BaseModel):
    summary: EvaluationSummary
    cases: list[EvaluationCase]
    records: list[EvaluationRecord]
