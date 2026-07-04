from fastapi import APIRouter

from app.schemas.growth import (
    BasicProfileUpsert,
    CompetitionCatalogResponse,
    CompetitionRecommendRequest,
    CompetitionRecommendResponse,
    GrowthProfileResponse,
    LearningPlanRequest,
    LearningPlanResponse,
    LearningPlanRevisionRequest,
    ProfileEvidence,
    ProfileEvidenceCreate,
    TeamPoolStatus,
    TeamPoolStatusUpdate,
    TeamRecommendRequest,
    TeamRecommendResponse,
    TeamRequestCard,
    TeamRequestCreate,
)
from app.services.growth_service import GrowthService

router = APIRouter()


@router.get("/students/{student_id}/profile", response_model=GrowthProfileResponse)
def get_student_profile(student_id: str) -> GrowthProfileResponse:
    return GrowthService().get_profile(student_id)


@router.put("/students/{student_id}/profile", response_model=GrowthProfileResponse)
def upsert_student_profile(
    student_id: str,
    payload: BasicProfileUpsert,
) -> GrowthProfileResponse:
    return GrowthService().upsert_basic_profile(student_id, payload)


@router.post("/students/{student_id}/profile/evidence", response_model=ProfileEvidence)
def add_profile_evidence(student_id: str, payload: ProfileEvidenceCreate) -> ProfileEvidence:
    return GrowthService().add_profile_evidence(student_id, payload)


@router.post("/plans/generate", response_model=LearningPlanResponse)
def generate_plan(payload: LearningPlanRequest) -> LearningPlanResponse:
    return GrowthService().generate_plan(payload)


@router.post("/plans/{plan_id}/revise", response_model=LearningPlanResponse)
def revise_plan(plan_id: str, payload: LearningPlanRevisionRequest) -> LearningPlanResponse:
    return GrowthService().revise_plan(plan_id, payload)


@router.post("/competitions/recommend", response_model=CompetitionRecommendResponse)
def recommend_competitions(
    payload: CompetitionRecommendRequest,
) -> CompetitionRecommendResponse:
    return GrowthService().recommend_competitions(payload)


@router.get("/competitions", response_model=CompetitionCatalogResponse)
def list_competitions() -> CompetitionCatalogResponse:
    return GrowthService().list_competitions()


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
