from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, field_validator


class JourneyCreate(BaseModel):
    title: str = Field(min_length=1, max_length=150)

    @field_validator("title")
    @classmethod
    def title_must_not_be_blank(cls, value: str) -> str:
        value = value.strip()

        if not value:
            raise ValueError("Journey title cannot be blank.")

        return value


class JourneyResponse(BaseModel):
    id: int
    user_id: int
    title: str
    started_at: datetime
    ended_at: datetime | None

    model_config = ConfigDict(from_attributes=True)


class JourneyPointCreate(BaseModel):
    latitude: float = Field(
        ge=-90,
        le=90,
        allow_inf_nan=False,
    )
    longitude: float = Field(
        ge=-180,
        le=180,
        allow_inf_nan=False,
    )


class JourneyPointResponse(BaseModel):
    id: int
    journey_id: int
    latitude: float
    longitude: float
    recorded_at: datetime
    sequence_number: int