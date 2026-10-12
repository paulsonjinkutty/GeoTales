from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.dependencies import get_current_user
from app.core.config import settings
from app.db.session import get_db
from app.models.user import User
from app.schemas.ai import (
    AIAskRequest,
    AINarrationRequest,
    AIRecommendRequest,
    AIRecommendResponse,
    AIResponse,
)
from app.services.ai_context_service import (
    AIContextForbiddenError,
    AIContextNotFoundError,
)
from app.services.ai_provider import (
    AIProviderError,
    AIProviderNotConfiguredError,
    AIProviderTimeoutError,
)
from app.services.ai_service import (
    answer_tourism_question,
    narrate_landmark_or_journey,
    recommend_landmarks,
)


router = APIRouter(
    prefix="/ai",
    tags=["AI Tourism Assistant"],
)


def _raise_ai_error(exc: Exception) -> None:
    if isinstance(exc, AIContextNotFoundError):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(exc),
        ) from exc

    if isinstance(exc, AIContextForbiddenError):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=str(exc),
        ) from exc

    if isinstance(exc, AIProviderNotConfiguredError):
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="AI service is not configured.",
        ) from exc

    if isinstance(exc, AIProviderTimeoutError):
        raise HTTPException(
            status_code=status.HTTP_504_GATEWAY_TIMEOUT,
            detail="AI service timed out. Please retry.",
        ) from exc

    if isinstance(exc, AIProviderError):
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="AI service could not complete the request.",
        ) from exc

    raise exc


@router.post(
    "/narrate",
    response_model=AIResponse,
)
def narrate(
    request: AINarrationRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        return narrate_landmark_or_journey(
            db,
            current_user,
            request,
        )
    except (
        AIContextNotFoundError,
        AIContextForbiddenError,
        AIProviderError,
    ) as exc:
        _raise_ai_error(exc)


@router.post(
    "/ask",
    response_model=AIResponse,
)
def ask(
    request: AIAskRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        return answer_tourism_question(
            db,
            current_user,
            request,
        )
    except (
        AIContextNotFoundError,
        AIContextForbiddenError,
        AIProviderError,
    ) as exc:
        _raise_ai_error(exc)


@router.post(
    "/recommend",
    response_model=AIRecommendResponse,
)
def recommend(
    request: AIRecommendRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        return recommend_landmarks(
            db,
            current_user,
            request,
        )
    except (
        AIContextNotFoundError,
        AIContextForbiddenError,
        AIProviderError,
    ) as exc:
        _raise_ai_error(exc)