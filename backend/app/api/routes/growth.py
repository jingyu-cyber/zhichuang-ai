from fastapi import APIRouter, Depends, Header, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.course import CourseMembership
from app.schemas.auth import DemoAccount
from app.schemas.growth import (
    BasicProfileUpsert,
    CompetitionCatalogResponse,
    CompetitionPreparationPlan,
    CompetitionPreparationRequest,
    CompetitionRecommendRequest,
    CompetitionRecommendResponse,
    GrowthProfileResponse,
    LearningPlanListResponse,
    LearningPlanRequest,
    LearningPlanResponse,
    LearningPlanRevisionRequest,
    ProfileEvidence,
    ProfileEvidenceCreate,
    TeacherCandidateScreenRequest,
    TeacherCandidateScreenResponse,
    TeamPoolStatus,
    TeamPoolStatusUpdate,
    TeamRecommendRequest,
    TeamRecommendResponse,
    TeamRequestCard,
    TeamRequestCreate,
)
from app.services.auth_service import AuthService
from app.services.growth_service import GrowthService

router = APIRouter()
DEMO_CLASS_NAMES = {"class_cs_2024_01": "2024 级计算机科学与技术 1 班"}
DEMO_STUDENT_CLASS_IDS = {
    "student_001": "class_cs_2024_01",
    "student_002": "class_cs_2024_01",
    "student_003": "class_cs_2024_01",
    "student_004": "class_cs_2024_01",
    "student_005": "class_cs_2024_01",
}


def ensure_student_access(
    student_id: str,
    authorization: str | None,
    db: Session,
) -> None:
    account = AuthService(db).current_account(authorization)
    if account.role == "admin":
        return
    if account.role == "student" and account.user_id == student_id:
        return
    if account.role == "teacher" and _teacher_can_access_student(account, student_id, db):
        return
    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="No access to this student growth data",
    )


def _teacher_can_access_student(account: DemoAccount, student_id: str, db: Session) -> bool:
    demo_class_id = DEMO_STUDENT_CLASS_IDS.get(student_id)
    if demo_class_id and _class_in_account_scope(account, demo_class_id):
        return True
    memberships = db.scalars(
        select(CourseMembership).where(CourseMembership.user_id == student_id)
    ).all()
    for membership in memberships:
        if membership.role_in_course != "student" or membership.class_id is None:
            continue
        if _class_in_account_scope(account, membership.class_id):
            return True
    return False


def _class_in_account_scope(account: DemoAccount, class_id: str) -> bool:
    class_name = DEMO_CLASS_NAMES.get(class_id, class_id)
    return class_id in account.authorized_classes or class_name in account.authorized_classes


@router.get("/students/{student_id}/profile", response_model=GrowthProfileResponse)
def get_student_profile(
    student_id: str,
    authorization: str | None = Header(default=None),
    db: Session = Depends(get_db),
) -> GrowthProfileResponse:
    ensure_student_access(student_id, authorization, db)
    return GrowthService(db).get_profile(student_id)


@router.put("/students/{student_id}/profile", response_model=GrowthProfileResponse)
def upsert_student_profile(
    student_id: str,
    payload: BasicProfileUpsert,
    authorization: str | None = Header(default=None),
    db: Session = Depends(get_db),
) -> GrowthProfileResponse:
    ensure_student_access(student_id, authorization, db)
    return GrowthService(db).upsert_basic_profile(student_id, payload)


@router.post("/students/{student_id}/profile/evidence", response_model=ProfileEvidence)
def add_profile_evidence(
    student_id: str,
    payload: ProfileEvidenceCreate,
    authorization: str | None = Header(default=None),
    db: Session = Depends(get_db),
) -> ProfileEvidence:
    ensure_student_access(student_id, authorization, db)
    return GrowthService(db).add_profile_evidence(student_id, payload)


@router.post("/plans/generate", response_model=LearningPlanResponse)
def generate_plan(
    payload: LearningPlanRequest,
    authorization: str | None = Header(default=None),
    db: Session = Depends(get_db),
) -> LearningPlanResponse:
    ensure_student_access(payload.student_id, authorization, db)
    return GrowthService(db).generate_plan(payload)


@router.get("/students/{student_id}/plans", response_model=LearningPlanListResponse)
def list_learning_plans(
    student_id: str,
    authorization: str | None = Header(default=None),
    db: Session = Depends(get_db),
) -> LearningPlanListResponse:
    ensure_student_access(student_id, authorization, db)
    return GrowthService(db).list_learning_plans(student_id)


@router.post("/plans/{plan_id}/revise", response_model=LearningPlanResponse)
def revise_plan(
    plan_id: str,
    payload: LearningPlanRevisionRequest,
    authorization: str | None = Header(default=None),
    db: Session = Depends(get_db),
) -> LearningPlanResponse:
    ensure_student_access(payload.student_id, authorization, db)
    return GrowthService(db).revise_plan(plan_id, payload)


@router.post("/competitions/recommend", response_model=CompetitionRecommendResponse)
def recommend_competitions(
    payload: CompetitionRecommendRequest,
    authorization: str | None = Header(default=None),
    db: Session = Depends(get_db),
) -> CompetitionRecommendResponse:
    ensure_student_access(payload.student_id, authorization, db)
    return GrowthService().recommend_competitions(payload)


@router.get("/competitions", response_model=CompetitionCatalogResponse)
def list_competitions() -> CompetitionCatalogResponse:
    return GrowthService().list_competitions()


@router.post("/competitions/preparation-plan", response_model=CompetitionPreparationPlan)
def generate_competition_preparation_plan(
    payload: CompetitionPreparationRequest,
    authorization: str | None = Header(default=None),
    db: Session = Depends(get_db),
) -> CompetitionPreparationPlan:
    ensure_student_access(payload.student_id, authorization, db)
    return GrowthService().generate_competition_preparation_plan(payload)


@router.post("/teacher/candidate-screening", response_model=TeacherCandidateScreenResponse)
def screen_teacher_candidates(
    payload: TeacherCandidateScreenRequest,
    authorization: str | None = Header(default=None),
    db: Session = Depends(get_db),
) -> TeacherCandidateScreenResponse:
    account = AuthService(db).current_account(authorization)
    if account.role not in {"teacher", "admin"}:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only teachers or admins can screen candidate cohorts",
        )
    class_name = DEMO_CLASS_NAMES.get(payload.class_id, payload.class_id)
    if account.role == "teacher" and not (
        payload.class_id in account.authorized_classes
        or class_name in account.authorized_classes
    ):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No access to this class candidate cohort",
        )
    return GrowthService().screen_teacher_candidates(payload)


@router.post("/teams/recommend", response_model=TeamRecommendResponse)
def recommend_team(
    payload: TeamRecommendRequest,
    authorization: str | None = Header(default=None),
    db: Session = Depends(get_db),
) -> TeamRecommendResponse:
    ensure_student_access(payload.student_id, authorization, db)
    return GrowthService(db).recommend_team(payload)


@router.post("/teams/requests", response_model=TeamRequestCard)
def create_team_request(
    payload: TeamRequestCreate,
    authorization: str | None = Header(default=None),
    db: Session = Depends(get_db),
) -> TeamRequestCard:
    ensure_student_access(payload.student_id, authorization, db)
    return GrowthService(db).create_team_request(payload)


@router.get("/students/{student_id}/team-status", response_model=TeamPoolStatus)
def get_team_pool_status(
    student_id: str,
    authorization: str | None = Header(default=None),
    db: Session = Depends(get_db),
) -> TeamPoolStatus:
    ensure_student_access(student_id, authorization, db)
    return GrowthService(db).get_team_pool_status(student_id)


@router.patch("/students/{student_id}/team-status", response_model=TeamPoolStatus)
def update_team_pool_status(
    student_id: str,
    payload: TeamPoolStatusUpdate,
    authorization: str | None = Header(default=None),
    db: Session = Depends(get_db),
) -> TeamPoolStatus:
    ensure_student_access(student_id, authorization, db)
    return GrowthService(db).update_team_pool_status(student_id, payload)
