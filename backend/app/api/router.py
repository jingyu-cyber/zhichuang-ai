from fastapi import APIRouter

from app.api.routes import agent, assignments, auth, growth, health, knowledge, tasks

api_router = APIRouter()
api_router.include_router(health.router, tags=["health"])
api_router.include_router(auth.router, prefix="/auth", tags=["auth"])
api_router.include_router(agent.router, prefix="/agent", tags=["agent"])
api_router.include_router(assignments.router, prefix="/assignments", tags=["assignments"])
api_router.include_router(growth.router, tags=["growth"])
api_router.include_router(knowledge.router, prefix="/knowledge", tags=["knowledge"])
api_router.include_router(tasks.router, tags=["tasks"])
