# This file will act as a acentral model registry
from app.models.journey import Journey
from app.models.landmark import Landmark
from app.models.user import User
from app.models.journey_point import JourneyPoint
from app.models.achievements import Achievement

__all__ = ["User",
           "Landmark",
           "Journey",
           "JourneyPoint",
           "Achievement",
        ]