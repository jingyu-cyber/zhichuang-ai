from fastapi import APIRouter, Depends, Header, HTTPException, status
from sqlalchemy.orm import Session

from app.db.session import get_db
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


@router.get("/students/{student_id}/profile", response_model=GrowthProfileResponse)
def get_student_profile(
    student_id: str,
    db: Session = Depends(get_db),
) -> GrowthProfileResponse:
    return GrowthService(db).get_profile(student_id)


@router.put("/students/{student_id}/profile", response_model=GrowthProfileResponse)
def upsert_student_profile(
    student_id: str,
    payload: BasicProfileUpsert,
    db: Session = Depends(get_db),
) -> GrowthProfileResponse:
    return GrowthService(db).upsert_basic_profile(student_id, payload)


@router.post("/students/{student_id}/profile/evidence", response_model=ProfileEvidence)
def add_profile_evidence(
    student_id: str,
    payload: ProfileEvidenceCreate,
    db: Session = Depends(get_db),
) -> ProfileEvidence:
    return GrowthService(db).add_profile_evidence(student_id, payload)


@router.post("/plans/generate", response_model=LearningPlanResponse)
def generate_plan(
    payload: LearningPlanRequest,
    db: Session = Depends(get_db),
) -> LearningPlanResponse:
    return GrowthService(db).generate_plan(payload)


@router.get("/students/{student_id}/plans", response_model=LearningPlanListResponse)
def list_learning_plans(
    student_id: str,
    db: Session = Depends(get_db),
) -> LearningPlanListResponse:
    return GrowthService(db).list_learning_plans(student_id)


@router.post("/plans/{plan_id}/revise", response_model=LearningPlanResponse)
def revise_plan(
    plan_id: str,
    payload: LearningPlanRevisionRequest,
    db: Session = Depends(get_db),
) -> LearningPlanResponse:
    return GrowthService(db).revise_plan(plan_id, payload)


@router.post("/competitions/recommend", response_model=CompetitionRecommendResponse)
def recommend_competitions(
    payload: CompetitionRecommendRequest,
) -> CompetitionRecommendResponse:
    return GrowthService().recommend_competitions(payload)


@router.get("/competitions", response_model=CompetitionCatalogResponse)
def list_competitions() -> CompetitionCatalogResponse:
    return GrowthService().list_competitions()


@router.post("/competitions/preparation-plan", response_model=CompetitionPreparationPlan)
def generate_competition_preparation_plan(
    payload: CompetitionPreparationRequest,
) -> CompetitionPreparationPlan:
    return GrowthService().generate_competition_preparation_plan(payload)


@router.post("/teacher/candidate-screening", response_model=TeacherCandidateScreenResponse)
def screen_teacher_candidates(
    payload: TeacherCandidateScreenRequest,
    authorization: str | None = Header(default=None),
) -> TeacherCandidateScreenResponse:
    account = AuthService().current_account(authorization)
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
def recommend_team(payload: TeamRecommendRequest) -> TeamRecommendResponse:
    return GrowthService().recommend_team(payload)


@router.post("/teams/requests", response_model=TeamRequestCard)
def create_team_request(payload: TeamRequestCreate) -> TeamRequestCard:
    return GrowthService().create_team_request(payload)


@router.get("/students/{student_id}/team-status", response_model=TeamPoolStatus)
def get_team_pool_status(student_id: str) -> TeamPoolStatus:
    return GrowthService().get_team_pool_status(student_id)


@router.patch("/students/{student_id}/team-status", response_model=TeamPoolStatus)
def update_team_pool_status(
    student_id: str,
    payload: TeamPoolStatusUpdate,
) -> TeamPoolStatus:
    return GrowthService().update_team_pool_status(student_id, payload)
