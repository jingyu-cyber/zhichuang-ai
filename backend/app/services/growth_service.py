from __future__ import annotations

from datetime import datetime
from hashlib import sha1
from typing import TypedDict

from sqlalchemy import inspect, select, text
from sqlalchemy.orm import Session

from app.db.base import Base
from app.models.profile import CapabilityEvidence as CapabilityEvidenceRecord
from app.models.profile import StudentProfileRecord
from app.schemas.growth import (
    BasicProfileSummary,
    BasicProfileUpsert,
    CapabilityDimension,
    CompetitionCatalogResponse,
    CompetitionInfo,
    CompetitionPreparationMilestone,
    CompetitionPreparationPlan,
    CompetitionPreparationRequest,
    CompetitionRecommendation,
    CompetitionRecommendRequest,
    CompetitionRecommendResponse,
    GrowthProfileResponse,
    LearningPlanRequest,
    LearningPlanResponse,
    LearningPlanRevisionRequest,
    PlanTask,
    ProfileEvidence,
    ProfileEvidenceCreate,
    TeamCandidate,
    TeacherCandidate,
    TeacherCandidateScreenRequest,
    TeacherCandidateScreenResponse,
    TeamPoolStatus,
    TeamPoolStatusUpdate,
    TeamRecommendRequest,
    TeamRecommendResponse,
    TeamRequestCard,
    TeamRequestCreate,
)


class _ScreeningProfile(TypedDict):
    student_id: str
    student_name: str
    abilities: dict[str, int]
    evidence: list[str]
    strength: str


class GrowthService:
    generated_at = "2026-07-05T09:00:00+08:00"
    team_created_at = "2026-07-05T11:20:00+08:00"
    competition_updated_at = "2026-07-05T11:40:00+08:00"
    competition_source_note = "系统内置首批竞赛清单，管理员可根据官方通知维护更新。"
    evidence_created_at = "2026-07-05T11:55:00+08:00"
    team_pool_enabled = {
        "student_001": True,
        "student_002": True,
        "student_003": True,
        "student_004": False,
        "student_005": False,
    }

    def __init__(self, db: Session | None = None) -> None:
        self.db = db
        if self.db is not None:
            Base.metadata.create_all(bind=self.db.get_bind())
            self._ensure_profile_schema()

    def get_profile(
        self,
        student_id: str,
        profile_input: BasicProfileUpsert | None = None,
    ) -> GrowthProfileResponse:
        if profile_input is None:
            profile_input = self._stored_profile_input(student_id)
        evidence_items = self._profile_evidence(student_id, profile_input)
        profile_summary = self._basic_profile_summary(profile_input)
        student_name = profile_input.student_name if profile_input else "林一舟"
        target_path = profile_input.target_direction if profile_input else "AI 应用开发 / 软件项目实践"
        return GrowthProfileResponse(
            student_id=student_id,
            student_name=student_name,
            target_path=target_path,
            generated_at=self.generated_at,
            profile_summary=profile_summary,
            dimensions=[
                CapabilityDimension(
                    dimension="算法基础",
                    score=self._dimension_score("算法基础", 76, profile_input),
                    confidence=0.72,
                    summary="能完成基础题和常见数据结构应用，动态规划和图论需要继续训练。",
                    evidence=["课程作业中能拆解主流程", "算法竞赛训练记录显示基础专题完成度较高"],
                    evidence_items=[
                        item for item in evidence_items if item.dimension == "算法基础"
                    ],
                ),
                CapabilityDimension(
                    dimension="工程实践",
                    score=self._dimension_score("工程实践", 84, profile_input),
                    confidence=0.81,
                    summary="具备 Web 项目搭建和接口联调能力，工程边界意识正在形成。",
                    evidence=["Flask 作业完成了页面、接口和数据流闭环", "README 有基本运行说明"],
                    evidence_items=[
                        item for item in evidence_items if item.dimension == "工程实践"
                    ],
                ),
                CapabilityDimension(
                    dimension="AI 应用开发",
                    score=self._dimension_score("AI 应用开发", 79, profile_input),
                    confidence=0.68,
                    summary="理解 RAG 和 Agent 应用形态，仍需补评测和部署经验。",
                    evidence=["能描述知识库问答流程", "项目计划包含 RAG、引用和评测任务"],
                    evidence_items=[
                        item for item in evidence_items if item.dimension == "AI 应用开发"
                    ],
                ),
                CapabilityDimension(
                    dimension="表达与协作",
                    score=self._dimension_score("表达与协作", 73, profile_input),
                    confidence=0.64,
                    summary="能说明项目目标，但对接口、分工和复盘记录表达还不稳定。",
                    evidence=["项目说明有目标和运行步骤", "缺少稳定的周复盘记录"],
                    evidence_items=[
                        item for item in evidence_items if item.dimension == "表达与协作"
                    ],
                ),
            ],
            strengths=["工程实践推进快", "适合承担后端接口和 Demo 集成", "能把作业产出转成项目案例"],
            risks=["自动化测试证据不足", "竞赛训练节奏容易被项目开发挤压", "项目表达材料需要模板约束"],
            next_actions=[
                "本周补齐 Flask 作业测试和 README 模板。",
                "两周内完成一个带引用的 RAG 问答 Demo。",
                "每周至少保留 3 次算法专题训练记录。",
            ],
        )

    def upsert_basic_profile(
        self,
        student_id: str,
        payload: BasicProfileUpsert,
    ) -> GrowthProfileResponse:
        if self.db is not None:
            record = self.db.get(StudentProfileRecord, student_id)
            if record is None:
                record = StudentProfileRecord(
                    student_id=student_id,
                    student_name=payload.student_name,
                    grade=payload.grade,
                    major=payload.major,
                    target_direction=payload.target_direction,
                    weekly_hours=payload.weekly_hours,
                    created_at=datetime.utcnow(),
                )
                self.db.add(record)
            self._apply_profile_payload(record, payload)
            self.db.commit()
        return self.get_profile(student_id, profile_input=payload)

    def _profile_evidence(
        self,
        student_id: str,
        profile_input: BasicProfileUpsert | None = None,
    ) -> list[ProfileEvidence]:
        evidence = [
            ProfileEvidence(
                evidence_id=f"evidence_{student_id}_algorithm_001",
                dimension="算法基础",
                source_type="training_record",
                source_title="算法竞赛训练记录",
                evidence_text="完成基础语法、数组和搜索专题训练，动态规划仍需补题。",
                confidence=0.72,
                created_at=self.generated_at,
            ),
            ProfileEvidence(
                evidence_id=f"evidence_{student_id}_engineering_001",
                dimension="工程实践",
                source_type="assignment_report",
                source_title="Flask Web 作业分析报告",
                evidence_text="提交物包含页面、接口和数据流闭环，测试覆盖仍需补齐。",
                confidence=0.81,
                created_at=self.generated_at,
            ),
            ProfileEvidence(
                evidence_id=f"evidence_{student_id}_ai_001",
                dimension="AI 应用开发",
                source_type="project_plan",
                source_title="RAG 知识库问答 Demo 计划",
                evidence_text="计划包含文档入库、检索、引用展示和评测记录。",
                confidence=0.68,
                created_at=self.generated_at,
            ),
            ProfileEvidence(
                evidence_id=f"evidence_{student_id}_collab_001",
                dimension="表达与协作",
                source_type="project_document",
                source_title="项目说明与复盘记录",
                evidence_text="已有目标和运行步骤说明，但缺少稳定周复盘记录。",
                confidence=0.64,
                created_at=self.generated_at,
            ),
        ]
        if profile_input:
            evidence.extend(
                [
                    ProfileEvidence(
                        evidence_id=f"evidence_{student_id}_basic_profile_skills",
                        dimension="工程实践",
                        source_type="student_basic_profile",
                        source_title="基础画像技能标签",
                        evidence_text="学生填写技能标签：" + "、".join(profile_input.skill_tags),
                        confidence=0.48,
                        created_at=self.evidence_created_at,
                    ),
                    ProfileEvidence(
                        evidence_id=f"evidence_{student_id}_basic_profile_target",
                        dimension="AI 应用开发",
                        source_type="student_basic_profile",
                        source_title="目标方向与时间投入",
                        evidence_text=(
                            f"目标方向：{profile_input.target_direction}；"
                            f"每周投入 {profile_input.weekly_hours} 小时。"
                        ),
                        confidence=0.46,
                        created_at=self.evidence_created_at,
                    ),
                    ProfileEvidence(
                        evidence_id=f"evidence_{student_id}_basic_profile_competition",
                        dimension="算法基础",
                        source_type="student_basic_profile",
                        source_title="竞赛经历填写",
                        evidence_text="竞赛经历：" + "、".join(profile_input.competition_experiences),
                        confidence=0.44,
                        created_at=self.evidence_created_at,
                    ),
                ]
            )
        evidence.extend(self._stored_profile_evidence(student_id))
        return evidence

    def _basic_profile_summary(
        self,
        profile_input: BasicProfileUpsert | None,
    ) -> BasicProfileSummary | None:
        if not profile_input:
            return None
        return BasicProfileSummary(
            grade=profile_input.grade,
            major=profile_input.major,
            course_foundation=profile_input.course_foundation,
            target_direction=profile_input.target_direction,
            weekly_hours=profile_input.weekly_hours,
            skill_tags=profile_input.skill_tags,
            project_experiences=profile_input.project_experiences,
            competition_experiences=profile_input.competition_experiences,
            github_url=profile_input.github_url,
        )

    def _dimension_score(
        self,
        dimension: str,
        base_score: int,
        profile_input: BasicProfileUpsert | None,
    ) -> int:
        if not profile_input:
            return base_score
        text = " ".join(
            [
                *profile_input.course_foundation,
                *profile_input.skill_tags,
                *profile_input.project_experiences,
                *profile_input.competition_experiences,
                profile_input.target_direction,
                profile_input.github_url or "",
            ]
        )
        boosts = {
            "算法基础": ["数据结构", "算法", "蓝桥", "ICPC"],
            "工程实践": ["Flask", "React", "Docker", "GitHub", "项目", "后端"],
            "AI 应用开发": ["AI", "RAG", "机器学习", "大模型", "数据"],
            "表达与协作": ["文档", "路演", "团队", "协作", "README"],
        }
        matched = sum(1 for keyword in boosts[dimension] if keyword.lower() in text.lower())
        return min(92, base_score + matched * 2)

    def add_profile_evidence(
        self, student_id: str, payload: ProfileEvidenceCreate
    ) -> ProfileEvidence:
        evidence = ProfileEvidence(
            evidence_id=self._manual_evidence_id(student_id, payload),
            dimension=payload.dimension,
            source_type=payload.source_type,
            source_title=payload.source_title,
            evidence_text=payload.evidence_text,
            confidence=payload.confidence,
            created_at=datetime.utcnow().isoformat(),
        )
        if self.db is None:
            return evidence

        existing = self.db.get(CapabilityEvidenceRecord, evidence.evidence_id)
        if existing is None:
            record = self._evidence_record_from_schema(student_id, evidence)
            self.db.add(record)
        else:
            record = existing
            existing.dimension = evidence.dimension
            existing.source_type = evidence.source_type
            existing.source_id = evidence.source_title
            existing.source_title = evidence.source_title
            existing.evidence_text = evidence.evidence_text
            existing.confidence = evidence.confidence
            existing.weight = evidence.confidence
        self.db.commit()
        self.db.refresh(record)
        return self._evidence_schema_from_record(record)

    def _stored_profile_input(self, student_id: str) -> BasicProfileUpsert | None:
        if self.db is None:
            return None
        record = self.db.get(StudentProfileRecord, student_id)
        if record is None:
            return None
        return BasicProfileUpsert(
            student_name=record.student_name,
            grade=record.grade,
            major=record.major,
            course_foundation=list(record.course_foundation_json or []),
            skill_tags=list(record.skill_tags_json or []),
            project_experiences=list(record.project_experiences_json or []),
            competition_experiences=list(record.competition_experiences_json or []),
            target_direction=record.target_direction,
            weekly_hours=record.weekly_hours,
            github_url=record.github_url,
        )

    def _apply_profile_payload(
        self,
        record: StudentProfileRecord,
        payload: BasicProfileUpsert,
    ) -> None:
        record.student_name = payload.student_name
        record.grade = payload.grade
        record.major = payload.major
        record.course_foundation_json = payload.course_foundation
        record.skill_tags_json = payload.skill_tags
        record.project_experiences_json = payload.project_experiences
        record.competition_experiences_json = payload.competition_experiences
        record.target_direction = payload.target_direction
        record.weekly_hours = payload.weekly_hours
        record.github_url = payload.github_url
        record.updated_at = datetime.utcnow()

    def _stored_profile_evidence(self, student_id: str) -> list[ProfileEvidence]:
        if self.db is None:
            return []
        records = self.db.scalars(
            select(CapabilityEvidenceRecord)
            .where(CapabilityEvidenceRecord.student_id == student_id)
            .order_by(
                CapabilityEvidenceRecord.created_at.asc(),
                CapabilityEvidenceRecord.id.asc(),
            )
        ).all()
        return [self._evidence_schema_from_record(record) for record in records]

    def _manual_evidence_id(
        self,
        student_id: str,
        payload: ProfileEvidenceCreate,
    ) -> str:
        raw = (
            f"{student_id}:{payload.dimension}:{payload.source_type}:"
            f"{payload.source_title}:{payload.evidence_text}"
        ).encode("utf-8")
        return f"evidence_{student_id}_manual_{sha1(raw).hexdigest()[:10]}"

    def _evidence_record_from_schema(
        self,
        student_id: str,
        evidence: ProfileEvidence,
    ) -> CapabilityEvidenceRecord:
        return CapabilityEvidenceRecord(
            id=evidence.evidence_id,
            student_id=student_id,
            dimension=evidence.dimension,
            source_type=evidence.source_type,
            source_id=evidence.source_title,
            source_title=evidence.source_title,
            evidence_text=evidence.evidence_text,
            confidence=evidence.confidence,
            weight=evidence.confidence,
            created_at=self._parse_datetime(evidence.created_at),
        )

    def _evidence_schema_from_record(
        self,
        record: CapabilityEvidenceRecord,
    ) -> ProfileEvidence:
        return ProfileEvidence(
            evidence_id=record.id,
            dimension=record.dimension,
            source_type=record.source_type,
            source_title=record.source_title or record.source_id,
            evidence_text=record.evidence_text,
            confidence=record.confidence if record.confidence is not None else record.weight,
            created_at=record.created_at.isoformat(),
        )

    def _parse_datetime(self, value: str) -> datetime:
        try:
            return datetime.fromisoformat(value)
        except ValueError:
            return datetime.utcnow()

    def _ensure_profile_schema(self) -> None:
        if self.db is None:
            return
        bind = self.db.get_bind()
        inspector = inspect(bind)
        if "capability_evidence" not in set(inspector.get_table_names()):
            return
        existing_columns = {
            column["name"] for column in inspector.get_columns("capability_evidence")
        }
        statements = []
        if "source_title" not in existing_columns:
            statements.append(
                "ALTER TABLE capability_evidence ADD COLUMN source_title VARCHAR(200)"
            )
        if "confidence" not in existing_columns:
            statements.append("ALTER TABLE capability_evidence ADD COLUMN confidence FLOAT")
        for statement in statements:
            self.db.execute(text(statement))
        if statements:
            self.db.commit()

    def generate_plan(self, payload: LearningPlanRequest) -> LearningPlanResponse:
        tasks, basis, checkpoints = self._build_plan(
            student_id=payload.student_id,
            goal=payload.goal,
            weeks=payload.weeks,
            weekly_hours=payload.weekly_hours,
            foundation=payload.foundation,
        )

        return LearningPlanResponse(
            plan_id=f"plan_{payload.student_id}_ai_app",
            student_id=payload.student_id,
            goal=payload.goal,
            weeks=payload.weeks,
            overview=self._plan_overview(payload.goal, payload.weekly_hours),
            basis=basis,
            tasks=tasks,
            checkpoints=checkpoints,
        )

    def revise_plan(
        self,
        plan_id: str,
        payload: LearningPlanRevisionRequest,
    ) -> LearningPlanResponse:
        weeks = payload.weeks or (4 if "时间不足" in payload.feedback else 8)
        weekly_hours = payload.weekly_hours or (4 if "时间不足" in payload.feedback else 8)
        goal = self._goal_from_feedback(payload.feedback)
        foundation = "基础薄弱" if "基础薄弱" in payload.feedback else "已生成计划的阶段反馈"
        tasks, basis, checkpoints = self._build_plan(
            student_id=payload.student_id,
            goal=goal,
            weeks=weeks,
            weekly_hours=weekly_hours,
            foundation=foundation,
            feedback=payload.feedback,
        )

        return LearningPlanResponse(
            plan_id=plan_id,
            student_id=payload.student_id,
            goal=goal,
            weeks=weeks,
            overview=self._plan_overview(goal, weekly_hours),
            basis=basis,
            revision_note=f"已根据反馈“{payload.feedback}”调整任务顺序、周数和投入强度。",
            tasks=tasks,
            checkpoints=checkpoints,
        )

    def _build_plan(
        self,
        student_id: str,
        goal: str,
        weeks: int,
        weekly_hours: int,
        foundation: str,
        feedback: str | None = None,
    ) -> tuple[list[PlanTask], list[str], list[str]]:
        profile = self.get_profile(student_id)
        weak_dimensions = sorted(profile.dimensions, key=lambda item: item.score)[:2]
        basis = [
            f"目标方向：{goal}",
            f"每周可投入：{weekly_hours} 小时",
            "短板维度：" + "、".join(item.dimension for item in weak_dimensions),
            f"基础描述：{foundation}",
        ]
        if feedback:
            basis.append(f"用户反馈：{feedback}")

        tasks = self._task_pool(goal)
        if "算法" in goal or "竞赛" in goal:
            tasks = self._prioritize(tasks, ["算法", "复盘", "竞赛"])
        if "AI" in goal or "RAG" in goal or "大模型" in goal:
            tasks = self._prioritize(tasks, ["RAG", "评测", "Demo"])
        if "软件" in goal or "项目" in goal or "工程" in goal:
            tasks = self._prioritize(tasks, ["工程", "测试", "文档"])
        if weekly_hours <= 4 or (feedback and "时间不足" in feedback):
            tasks = self._prioritize(tasks, ["最小", "测试", "复盘"])
        if "基础薄弱" in foundation or (feedback and "基础薄弱" in feedback):
            tasks = self._prioritize(tasks, ["基础", "训练", "补齐"])
        if feedback and "转方向" in feedback:
            tasks = self._prioritize(tasks, ["方向", "Demo", "案例"])

        capped_weeks = max(1, min(weeks, 8))
        selected = [
            PlanTask(
                week=index,
                title=task.title,
                outcome=task.outcome,
                resources=task.resources,
            )
            for index, task in enumerate(tasks[:capped_weeks], start=1)
        ]
        checkpoints = self._checkpoints(selected, goal)
        return selected, basis, checkpoints

    def _task_pool(self, goal: str) -> list[PlanTask]:
        return [
            PlanTask(
                week=0,
                title="补齐基础训练",
                outcome="完成目标方向相关的基础概念、术语和最小练习记录。",
                resources=["程序设计基础课程大纲", "数据结构课程知识点"],
            ),
            PlanTask(
                week=0,
                title="补齐工程基线",
                outcome="作业项目具备 README、接口列表、测试入口和演示数据。",
                resources=["Web 应用开发课程 Rubric", "软件项目实践案例模板"],
            ),
            PlanTask(
                week=0,
                title="完成 RAG 问答 Demo",
                outcome="知识库问答能返回答案、引用来源和推荐路径。",
                resources=["AI 应用开发学习路径", "RAG 知识库建设 SOP"],
            ),
            PlanTask(
                week=0,
                title="建立算法训练节奏",
                outcome="完成基础语法、数据结构和搜索专题复盘。",
                resources=["算法竞赛训练路径", "蓝桥杯训练资料"],
            ),
            PlanTask(
                week=0,
                title="接入作业分析报告",
                outcome="系统能生成学生报告和教师班级看板。",
                resources=["课程作业代码分析 SOP", "教师学情诊断看板说明"],
            ),
            PlanTask(
                week=0,
                title="补齐自动化测试",
                outcome="为核心接口和异常路径补充可复现测试记录。",
                resources=["Web 应用开发课程作业 Rubric", "评测样例清单"],
            ),
            PlanTask(
                week=0,
                title="完成最小可展示版本",
                outcome="保留一条学生端和一条教师端演示主线，压缩非关键功能。",
                resources=["开发 SOP", "公网 Demo 部署说明"],
            ),
            PlanTask(
                week=0,
                title="整理项目案例材料",
                outcome="输出需求、架构、接口、数据模型和测试记录。",
                resources=["软件项目实践案例模板"],
            ),
            PlanTask(
                week=0,
                title="组队协作与分工",
                outcome="确定后端、前端、算法、表达四类角色和协作节奏。",
                resources=["组队推荐能力互补规则"],
            ),
            PlanTask(
                week=0,
                title="方向切换验证",
                outcome=f"围绕“{goal}”完成一次目标拆解和可行性确认。",
                resources=["能力画像评分口径", "AI 应用开发学习路径"],
            ),
            PlanTask(
                week=0,
                title="演示与评测",
                outcome="准备固定演示账号、示例作业、知识库问答和教师看板脚本。",
                resources=["开发 SOP", "评测样例清单"],
            ),
            PlanTask(
                week=0,
                title="周复盘与路径更新",
                outcome="根据任务完成情况更新画像、任务和项目路线。",
                resources=["定期复盘流程", "能力画像评分口径"],
            ),
        ]

    def _prioritize(self, tasks: list[PlanTask], keywords: list[str]) -> list[PlanTask]:
        return sorted(
            tasks,
            key=lambda task: (
                not any(keyword in task.title or keyword in task.outcome for keyword in keywords),
                task.title,
            ),
        )

    def _checkpoints(self, tasks: list[PlanTask], goal: str) -> list[str]:
        if not tasks:
            return []
        middle = tasks[min(len(tasks) - 1, max(0, len(tasks) // 2))]
        final = tasks[-1]
        return [
            f"第 1 周完成：{tasks[0].title}",
            f"中期检查：{middle.outcome}",
            f"结束检查：{final.outcome}",
            f"目标核验：{goal}",
        ]

    def _plan_overview(self, goal: str, weekly_hours: int) -> str:
        intensity = "轻量节奏" if weekly_hours <= 4 else "标准节奏"
        return f"计划按{intensity}推进，围绕“{goal}”安排基础补齐、项目实践、评测复盘和展示材料。"

    def _goal_from_feedback(self, feedback: str) -> str:
        if "转方向" in feedback:
            return "转向 AI 应用开发并保留软件项目实践基础"
        if "基础薄弱" in feedback:
            return "补齐计算机基础并完成一个可运行项目 Demo"
        if "时间不足" in feedback:
            return "用更少时间完成 AI 应用开发最小可展示版本"
        return "根据阶段反馈更新 AI 应用开发学习计划"

    def recommend_competitions(
        self, payload: CompetitionRecommendRequest
    ) -> CompetitionRecommendResponse:
        return CompetitionRecommendResponse(
            student_id=payload.student_id,
            target=payload.target,
            recommendations=[
                CompetitionRecommendation(
                    name="中国大学生计算机设计大赛",
                    category="软件应用 / AI 应用",
                    match_score=88,
                    reason="当前项目具备教学场景、AI 应用、知识库问答和可展示 Demo，适合软件应用类作品。",
                    fit_reasons=[
                        "已有课程作业分析、教师看板和知识库问答闭环，符合软件应用作品展示要求。",
                        "学生画像显示工程实践和 AI 应用开发能力较匹配。",
                    ],
                    gap_abilities=[
                        "需要补足自动化测试证据和评测记录。",
                        "需要整理作品说明书、演示视频和可复现部署材料。",
                    ],
                    preparation=["补齐作品说明书", "准备公网 Demo", "整理教师看板和学生报告演示脚本"],
                    risk="需要尽快补充真实课程样例和稳定演示流程。",
                ),
                CompetitionRecommendation(
                    name="中国国际大学生创新大赛",
                    category="双创项目",
                    match_score=82,
                    reason="平台面向学校真实使用，有教学应用和双创能力赋能叙事。",
                    fit_reasons=[
                        "项目服务学校教学场景，具备学生成长和教师诊断两条价值主线。",
                        "已有竞赛推荐、组队推荐和任务复盘，能支撑双创能力培养叙事。",
                    ],
                    gap_abilities=[
                        "需要补足推广路径、用户场景证明和学校试用说明。",
                        "需要把项目价值从技术 Demo 转成可落地服务表达。",
                    ],
                    preparation=["梳理用户场景", "准备商业/推广路径", "补充学校部署方案"],
                    risk="需要把产品价值讲清楚，避免只像技术 Demo。",
                ),
                CompetitionRecommendation(
                    name="蓝桥杯",
                    category="算法竞赛",
                    match_score=74,
                    reason="适合作为个人算法能力提升路径，反哺平台的竞赛推荐和训练计划能力。",
                    fit_reasons=[
                        "画像中已有算法训练记录，可作为算法方向冷启动依据。",
                        "固定竞赛训练能补强平台推荐解释中的算法能力证据。",
                    ],
                    gap_abilities=[
                        "动态规划和图论专题仍需持续训练。",
                        "需要固定刷题复盘节奏，避免被项目开发挤占。",
                    ],
                    preparation=["数据结构专题", "搜索专题", "动态规划专题", "真题复盘"],
                    risk="与项目开发争抢时间，需要固定训练节奏。",
                ),
            ],
        )

    def generate_competition_preparation_plan(
        self,
        payload: CompetitionPreparationRequest,
    ) -> CompetitionPreparationPlan:
        competition = self._find_competition(payload.competition_name)
        weeks = max(1, min(payload.weeks, 12))
        task_sets = self._competition_task_sets(competition)
        milestones = []
        for week in range(1, weeks + 1):
            template = task_sets[min(week - 1, len(task_sets) - 1)]
            milestones.append(
                CompetitionPreparationMilestone(
                    week=week,
                    focus=template["focus"],
                    tasks=template["tasks"],
                    deliverable=template["deliverable"],
                    official_basis=template["official_basis"],
                )
            )
        return CompetitionPreparationPlan(
            plan_id=f"competition_plan_{payload.student_id}_{competition.competition_id}",
            student_id=payload.student_id,
            competition_name=competition.name,
            weeks=weeks,
            registration_time=competition.registration_time,
            official_url=competition.official_url,
            overview=(
                f"围绕{competition.name}安排 {weeks} 周准备，"
                f"每周约 {payload.weekly_hours} 小时，任务覆盖知识补齐、项目实践、材料准备和报名节点。"
            ),
            milestones=milestones,
            citations=[
                f"{competition.name}参赛要求：{competition.participant_requirements}",
                f"{competition.name}作品要求：{competition.work_requirements}",
                f"报名时间口径：{competition.registration_time}",
                f"官方链接：{competition.official_url}",
            ],
            risk="报名时间、组别和材料格式以官方通知为准；计划仅用于准备节奏安排。",
        )

    def list_competitions(self) -> CompetitionCatalogResponse:
        competitions = [
            CompetitionInfo(
                competition_id="competition_c4",
                name="中国大学生计算机设计大赛",
                organizer="中国大学生计算机设计大赛组织委员会",
                category="工程开发类",
                tracks=["软件应用", "AI 应用", "数字媒体"],
                registration_time="以当年官方通知为准",
                participant_requirements=(
                    "普通高校在校学生组队参赛，具体组别以官方通知为准。"
                ),
                work_requirements="提交可运行作品、说明材料、演示视频和证明材料。",
                official_url="https://jsjds.blcu.edu.cn/",
                updated_at=self.competition_updated_at,
                source_note=self.competition_source_note,
            ),
            CompetitionInfo(
                competition_id="competition_cy",
                name="中国国际大学生创新大赛",
                organizer="教育部等单位",
                category="创新创业类",
                tracks=["高教主赛道", "青年红色筑梦之旅", "产业命题"],
                registration_time="以当年官方通知为准",
                participant_requirements=(
                    "高校学生团队参赛，负责人和成员要求以官方通知为准。"
                ),
                work_requirements="提交项目计划书、路演材料、佐证材料和展示 Demo。",
                official_url="https://cy.ncss.cn/",
                updated_at=self.competition_updated_at,
                source_note=self.competition_source_note,
            ),
            CompetitionInfo(
                competition_id="competition_lanqiao",
                name="蓝桥杯全国软件和信息技术专业人才大赛",
                organizer="工业和信息化部人才交流中心等单位",
                category="算法类",
                tracks=["软件类", "电子类", "视觉艺术类"],
                registration_time="以当年官方通知为准",
                participant_requirements=(
                    "在校学生可按组别报名，具体科目和资格以官方通知为准。"
                ),
                work_requirements="按赛项完成在线编程、算法题或相关作品提交。",
                official_url="https://dasai.lanqiao.cn/",
                updated_at=self.competition_updated_at,
                source_note=self.competition_source_note,
            ),
            CompetitionInfo(
                competition_id="competition_icpc",
                name="ICPC 国际大学生程序设计竞赛",
                organizer="ICPC Foundation 及区域赛承办单位",
                category="算法类",
                tracks=["区域赛", "邀请赛", "校内选拔"],
                registration_time="以各赛站官方通知为准",
                participant_requirements="通常为高校学生三人组队参赛，资格以赛站规则为准。",
                work_requirements="在限定时间内完成算法编程题目。",
                official_url="https://icpc.global/",
                updated_at=self.competition_updated_at,
                source_note=self.competition_source_note,
            ),
            CompetitionInfo(
                competition_id="competition_challenge_cup",
                name="挑战杯大学生课外学术科技作品竞赛",
                organizer="共青团中央、中国科协、教育部等单位",
                category="创新创业类",
                tracks=["自然科学类", "科技发明制作", "哲学社会科学类"],
                registration_time="以当届官方通知为准",
                participant_requirements=(
                    "高校学生团队或个人参赛，具体要求以官方通知为准。"
                ),
                work_requirements="提交学术科技作品、研究报告、证明材料和答辩材料。",
                official_url="https://www.tiaozhanbei.net/",
                updated_at=self.competition_updated_at,
                source_note=self.competition_source_note,
            ),
            CompetitionInfo(
                competition_id="competition_service_outsourcing",
                name="中国大学生服务外包创新创业大赛",
                organizer="教育部、商务部等相关单位指导",
                category="工程开发类",
                tracks=["企业命题", "创业实践", "软件服务"],
                registration_time="以当年官方通知为准",
                participant_requirements="高校学生组队参赛，命题和资格以官方通知为准。",
                work_requirements="围绕命题提交解决方案、系统原型、演示视频和文档。",
                official_url="https://www.fwwb.org.cn/",
                updated_at=self.competition_updated_at,
                source_note=self.competition_source_note,
            ),
            CompetitionInfo(
                competition_id="competition_ai_challenge",
                name="人工智能创新挑战赛",
                organizer="赛事主办单位或产业平台",
                category="AI 类",
                tracks=["机器学习", "智能应用", "行业算法"],
                registration_time="以对应赛事官方通知为准",
                participant_requirements=(
                    "学生或团队按赛题要求报名，数据使用规则以官方说明为准。"
                ),
                work_requirements="提交模型方案、实验结果、代码说明和应用展示。",
                official_url="https://www.datafountain.cn/",
                updated_at=self.competition_updated_at,
                source_note=self.competition_source_note,
            ),
            CompetitionInfo(
                competition_id="competition_data_mining",
                name="数据挖掘与大数据挑战赛",
                organizer="高校、学会或产业数据竞赛平台",
                category="AI 类",
                tracks=["数据分析", "预测建模", "大数据应用"],
                registration_time="以具体赛题官方通知为准",
                participant_requirements=(
                    "按赛题平台注册参赛，团队人数和数据规则以官方说明为准。"
                ),
                work_requirements="提交预测结果、方法报告、代码说明和复现实验记录。",
                official_url="https://www.datafountain.cn/",
                updated_at=self.competition_updated_at,
                source_note=self.competition_source_note,
            ),
        ]

        return CompetitionCatalogResponse(
            total=len(competitions),
            updated_at=self.competition_updated_at,
            competitions=competitions,
        )

    def _find_competition(self, competition_name: str) -> CompetitionInfo:
        catalog = self.list_competitions()
        for competition in catalog.competitions:
            if competition_name in competition.name or competition.name in competition_name:
                return competition
        return catalog.competitions[0]

    def _competition_task_sets(self, competition: CompetitionInfo) -> list[dict[str, object]]:
        if "算法" in competition.category or "蓝桥杯" in competition.name or "ICPC" in competition.name:
            return [
                {
                    "focus": "规则确认与题型诊断",
                    "tasks": ["阅读官方报名与赛项说明", "完成一次基础语法和数据结构自测", "建立错题复盘表"],
                    "deliverable": "报名规则摘要、基础能力诊断和训练题单。",
                    "official_basis": competition.participant_requirements,
                },
                {
                    "focus": "核心算法专题",
                    "tasks": ["完成搜索和动态规划专题训练", "记录每题复杂度与错误原因", "整理 5 道代表题讲解"],
                    "deliverable": "专题训练记录和错题原因清单。",
                    "official_basis": competition.work_requirements,
                },
                {
                    "focus": "真题与限时模拟",
                    "tasks": ["完成至少 2 套真题或模拟题", "复盘超时、WA 和边界条件问题", "固定比赛环境和代码模板"],
                    "deliverable": "模拟成绩表、问题复盘和代码模板。",
                    "official_basis": competition.work_requirements,
                },
                {
                    "focus": "报名材料与赛前检查",
                    "tasks": ["核对报名时间和资格要求", "确认账号、证件和赛项信息", "完成赛前检查清单"],
                    "deliverable": "报名节点清单和赛前检查表。",
                    "official_basis": competition.registration_time,
                },
            ]
        return [
            {
                "focus": "赛道规则与作品定位",
                "tasks": ["阅读官方参赛要求", "确定作品赛道和目标用户", "整理竞品和应用场景"],
                "deliverable": "赛道规则摘要、作品定位和用户场景说明。",
                "official_basis": competition.participant_requirements,
            },
            {
                "focus": "最小可展示原型",
                "tasks": ["确定核心功能闭环", "完成可运行 Demo 主线", "补齐 README 和部署说明"],
                "deliverable": "可运行 Demo、接口说明和部署步骤。",
                "official_basis": competition.work_requirements,
            },
            {
                "focus": "证明材料与评测记录",
                "tasks": ["整理测试用例和输出记录", "补充教师看板和学生报告截图", "形成项目价值说明"],
                "deliverable": "测试记录、效果截图和作品说明书初稿。",
                "official_basis": competition.work_requirements,
            },
            {
                "focus": "报名节点与展示材料",
                "tasks": ["核对报名时间和组别要求", "整理演示视频脚本", "完成答辩提纲和风险说明"],
                "deliverable": "报名检查表、演示视频脚本和答辩提纲。",
                "official_basis": competition.registration_time,
            },
        ]

    def recommend_team(self, payload: TeamRecommendRequest) -> TeamRecommendResponse:
        candidates = [
            candidate
            for candidate in self._team_candidates()
            if candidate.student_id != payload.student_id
            and self._is_team_pool_enabled(candidate.student_id)
        ]
        return TeamRecommendResponse(
            requester_id=payload.student_id,
            project_goal=payload.project_goal,
            candidates=candidates,
            collaboration_tips=[
                "先固定一条演示主线：学生提交作业 -> 系统分析 -> 教师看板 -> 学生成长建议。",
                "每周保留一次项目复盘，记录完成内容、阻塞和下周任务。",
                "推荐池只包含主动开启组队状态的同学，联系方式默认不公开。",
                "接口、页面和演示数据同时推进，避免答辩前只剩单点功能。",
            ],
        )

    def screen_teacher_candidates(
        self,
        payload: TeacherCandidateScreenRequest,
    ) -> TeacherCandidateScreenResponse:
        candidates = [
            candidate
            for candidate in self._screening_candidates(payload)
            if candidate.match_score >= payload.min_score
        ]
        candidates.sort(key=lambda candidate: candidate.match_score, reverse=True)
        return TeacherCandidateScreenResponse(
            target_name=payload.target_name,
            target_type=payload.target_type,
            class_id=payload.class_id,
            generated_at=self.generated_at,
            source_note="结果基于授权班级内学生画像、作业证据和竞赛经历生成，仅作为教学和竞赛指导参考。",
            candidates=candidates,
        )

    def create_team_request(self, payload: TeamRequestCreate) -> TeamRequestCard:
        return TeamRequestCard(
            team_request_id=f"team_req_{payload.student_id}_ai_app",
            student_id=payload.student_id,
            competition_name=payload.competition_name,
            project_direction=payload.project_direction,
            missing_roles=payload.missing_roles,
            expected_skills=payload.expected_skills,
            weekly_hours=payload.weekly_hours,
            communication=payload.communication,
            team_status_enabled=payload.team_status_enabled,
            contact_visible=False,
            status="已发布" if payload.team_status_enabled else "仅保存草稿",
            created_at=self.team_created_at,
        )

    def get_team_pool_status(self, student_id: str) -> TeamPoolStatus:
        enabled = self._is_team_pool_enabled(student_id)
        return TeamPoolStatus(
            student_id=student_id,
            team_status_enabled=enabled,
            contact_visible=False,
            visibility_note=(
                "已进入推荐池；联系方式默认不公开，需学生主动提供。"
                if enabled
                else "未进入推荐池；不会出现在队友推荐结果中。"
            ),
        )

    def update_team_pool_status(
        self,
        student_id: str,
        payload: TeamPoolStatusUpdate,
    ) -> TeamPoolStatus:
        self.team_pool_enabled[student_id] = payload.team_status_enabled
        return TeamPoolStatus(
            student_id=student_id,
            team_status_enabled=payload.team_status_enabled,
            contact_visible=False,
            visibility_note=(
                "已进入推荐池；联系方式默认不公开，需学生主动提供。"
                if payload.team_status_enabled
                else "已撤回组队授权；不会出现在队友推荐结果中。"
            ),
        )

    def _team_candidates(self) -> list[TeamCandidate]:
        return [
            TeamCandidate(
                student_id="student_002",
                name="陈星然",
                role="前端与交互",
                match_score=86,
                complement="补足工作台界面、演示流程和移动端适配。",
                evidence=["课程项目中负责过 React 页面", "表达材料完成度高"],
                skill_complement_graph=[
                    "林一舟: 后端接口/RAG 集成",
                    "陈星然: React 页面/交互流程",
                    "共同缺口: 移动端适配与演示脚本联调",
                ],
                suggested_questions=[
                    "你能每周投入几小时完成前端页面和演示联调？",
                    "你希望用 Web 优先，还是同步考虑鸿蒙端页面结构？",
                    "哪些页面需要先做成比赛可演示闭环？",
                ],
            ),
            TeamCandidate(
                student_id="student_003",
                name="周明远",
                role="算法与评测",
                match_score=81,
                complement="补足代码分析规则、评测样例和算法竞赛路径。",
                evidence=["算法专题训练稳定", "能整理测试用例"],
                skill_complement_graph=[
                    "林一舟: 应用集成/教师看板",
                    "周明远: 评测样例/算法训练路径",
                    "共同缺口: 代码分析规则与测试记录沉淀",
                ],
                suggested_questions=[
                    "你能先维护哪些代码分析规则和评测用例？",
                    "算法竞赛路径里哪些资料最适合做首批知识库？",
                    "每周复盘时如何记录测试失败和修正依据？",
                ],
            ),
            TeamCandidate(
                student_id="student_004",
                name="沈知夏",
                role="产品与答辩",
                match_score=79,
                complement="补足需求表达、场景材料和比赛答辩结构。",
                evidence=["项目报告结构清晰", "擅长用户场景梳理"],
                skill_complement_graph=[
                    "林一舟: 技术原型/系统实现",
                    "沈知夏: 需求表达/答辩材料",
                    "共同缺口: 学校使用场景和演示叙事打磨",
                ],
                suggested_questions=[
                    "你能负责哪几页作品方案和演示脚本？",
                    "教师端学情诊断应该优先讲哪些真实教学价值？",
                    "答辩中如何解释分数是基于证据的相对画像？",
                ],
            ),
        ]

    def _screening_candidates(
        self,
        payload: TeacherCandidateScreenRequest,
    ) -> list[TeacherCandidate]:
        student_profiles: list[_ScreeningProfile] = [
            {
                "student_id": "student_001",
                "student_name": "林一舟",
                "abilities": {
                    "算法基础": 76,
                    "工程实践": 84,
                    "AI 与数据能力": 79,
                    "协作表达": 73,
                },
                "evidence": ["Flask Web 作业报告", "RAG 文档问答 Demo", "蓝桥杯校内训练"],
                "strength": "适合承担后端接口、RAG 集成和演示主线搭建。",
            },
            {
                "student_id": "student_002",
                "student_name": "陈星然",
                "abilities": {
                    "算法基础": 68,
                    "工程实践": 80,
                    "AI 与数据能力": 72,
                    "协作表达": 86,
                },
                "evidence": ["React 课程项目", "项目路演材料", "用户场景说明"],
                "strength": "适合承担前端交互、演示材料和用户流程表达。",
            },
            {
                "student_id": "student_003",
                "student_name": "周明远",
                "abilities": {
                    "算法基础": 88,
                    "工程实践": 74,
                    "AI 与数据能力": 70,
                    "协作表达": 69,
                },
                "evidence": ["算法专题训练记录", "测试用例整理", "数据结构课程作业"],
                "strength": "适合承担算法训练、评测样例和复杂度分析。",
            },
            {
                "student_id": "student_004",
                "student_name": "沈知夏",
                "abilities": {
                    "算法基础": 62,
                    "工程实践": 70,
                    "AI 与数据能力": 68,
                    "协作表达": 82,
                },
                "evidence": ["项目报告结构清晰", "竞赛选题调研", "课堂汇报记录"],
                "strength": "适合承担需求表达、调研材料和答辩结构。",
            },
            {
                "student_id": "student_005",
                "student_name": "许嘉木",
                "abilities": {
                    "算法基础": 70,
                    "工程实践": 77,
                    "AI 与数据能力": 83,
                    "协作表达": 71,
                },
                "evidence": ["机器学习课程实验", "数据处理 Notebook", "FastAPI 小项目"],
                "strength": "适合承担数据处理、模型调用和接口原型。",
            },
        ]
        target_abilities = payload.target_abilities or ["工程实践", "AI 与数据能力", "协作表达"]
        candidates: list[TeacherCandidate] = []

        for profile in student_profiles:
            abilities = profile["abilities"]
            selected_scores = [
                abilities.get(ability, self._fallback_ability_score(ability, abilities))
                for ability in target_abilities
            ]
            match_score = round(sum(selected_scores) / len(selected_scores))
            matched_abilities = [
                ability
                for ability in target_abilities
                if abilities.get(ability, self._fallback_ability_score(ability, abilities)) >= 75
            ]
            gaps = [
                f"{ability}需要补强"
                for ability in target_abilities
                if abilities.get(ability, self._fallback_ability_score(ability, abilities)) < 75
            ]
            candidates.append(
                TeacherCandidate(
                    student_id=str(profile["student_id"]),
                    student_name=str(profile["student_name"]),
                    tier=self._candidate_tier(match_score),
                    match_score=match_score,
                    matched_abilities=matched_abilities,
                    match_reason=(
                        f"{profile['strength']} 与“{payload.target_name}”的"
                        f"{'、'.join(target_abilities[:3])}要求匹配。"
                    ),
                    gap_reminders=gaps[:3] or ["当前目标能力暂无明显短板，建议继续补充过程证据。"],
                    evidence=profile["evidence"],
                )
            )

        return candidates

    def _fallback_ability_score(self, ability: str, abilities: dict[str, int]) -> int:
        if ability == "AI 应用开发":
            return abilities.get("AI 与数据能力", 0)
        if ability == "表达与协作":
            return abilities.get("协作表达", 0)
        return abilities.get(ability, 0)

    def _candidate_tier(self, match_score: int) -> str:
        if match_score >= 82:
            return "重点推荐"
        if match_score >= 74:
            return "可培养"
        return "储备观察"

    def _is_team_pool_enabled(self, student_id: str) -> bool:
        return self.team_pool_enabled.get(student_id, False)
