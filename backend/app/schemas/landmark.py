from pydantic import BaseModel, ConfigDict


class LandmarkResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    description: str | None = None
    category: str
    latitude: float
    longitude: float
    distance_m: float | None = None