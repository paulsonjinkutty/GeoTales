from typing import Literal

from pydantic import BaseModel, Field, model_validator


NarrationStyle = Literal[
    "concise",
    "storytelling",
    "educational",
]


class AINarrationRequest(BaseModel):
    landmark_id: int | None = Field(default=None, gt=0)
    journey_id: int | None = Field(default=None, gt=0)
    style: NarrationStyle = "educational"

    @model_validator(mode="after")
    def require_context(self):
        if self.landmark_id is None and self.journey_id is None:
            raise ValueError(
                "Provide a landmark_id or journey_id."
            )
        return self


class AIAskRequest(BaseModel):
    question: str = Field(
        ...,
        min_length=1,
        max_length=1000,
    )
    landmark_id: int | None = Field(default=None, gt=0)
    journey_id: int | None = Field(default=None, gt=0)


class AIRecommendRequest(BaseModel):
    category: str | None = Field(
        default=None,
        min_length=1,
        max_length=100,
    )
    journey_id: int | None = Field(default=None, gt=0)
    interests: list[str] = Field(
        default_factory=list,
        max_length=10,
    )
    limit: int = Field(default=5, ge=1, le=10)


class AIResponse(BaseModel):
    answer: str
    model: str
    context_items: int = 0


class AIRecommendationItem(BaseModel):
    landmark_id: int
    name: str
    category: str
    description: str | None = None


class AIRecommendResponse(BaseModel):
    explanation: str
    recommendations: list[AIRecommendationItem]
    model: str