from fastapi import APIRouter

from app.api.v1.users import router as users_router
from app.api.v1.auth import router as auth_router
from app.api.v1.journeys import router as journeys_router
from app.api.v1.ai import router as ai_router
from app.api.v1.landmarks import router as landmarks_router
from app.api.v1.achievements import router as achievements_router


api_router = APIRouter()

api_router.include_router(users_router)
api_router.include_router(auth_router)
api_router.include_router(journeys_router)
api_router.include_router(ai_router)
api_router.include_router(landmarks_router)
api_router.include_router(achievements_router)