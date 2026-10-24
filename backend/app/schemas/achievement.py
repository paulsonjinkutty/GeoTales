from datetime import datetime

from pydantic import BaseModel, ConfigDict


class AchievementResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    description: str | None = None
    points: int


class EarnedAchievementResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    earned_at: datetime
    achievement: AchievementResponse