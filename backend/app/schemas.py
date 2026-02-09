from pydantic import BaseModel, Field
from datetime import datetime
from uuid import UUID
from enum import Enum as PyEnum


class SeverityEnum(str, PyEnum):
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    DANGEROUS = "DANGEROUS"


class StatusEnum(str, PyEnum):
    OPEN = "OPEN"
    FIXED = "FIXED"


class ParkingSeverityEnum(str, PyEnum):
    LOW = "LOW"
    MODERATE = "MODERATE"
    SEVERE = "SEVERE"


class ParkingStatusEnum(str, PyEnum):
    ACTIVE = "ACTIVE"
    RESOLVED = "RESOLVED"


# --- Pothole Schemas ---

class PotholeCreate(BaseModel):
    lat: float = Field(..., ge=-90, le=90)
    lon: float = Field(..., ge=-180, le=180)
    severity: SeverityEnum
    description: str | None = Field(None, max_length=500)


class PotholeResponse(BaseModel):
    id: UUID
    lat: float
    lon: float
    severity: SeverityEnum
    status: StatusEnum
    description: str | None
    created_at: datetime

    model_config = {"from_attributes": True}


# --- Parking Zone Schemas ---

class ParkingZoneCreate(BaseModel):
    lat: float = Field(..., ge=-90, le=90)
    lon: float = Field(..., ge=-180, le=180)
    severity: ParkingSeverityEnum
    description: str = Field(..., min_length=5, max_length=500)


class ParkingZoneResponse(BaseModel):
    id: UUID
    lat: float
    lon: float
    severity: ParkingSeverityEnum
    status: ParkingStatusEnum
    description: str
    created_at: datetime

    model_config = {"from_attributes": True}


# --- Shared ---

class NearbyCheckResponse(BaseModel):
    nearby_count: int
