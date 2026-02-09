from sqlalchemy import Column, Integer, String, DateTime, Enum, Index
from sqlalchemy.dialects.postgresql import UUID
from geoalchemy2 import Geometry
import uuid
from datetime import datetime
from enum import Enum as PyEnum

from .database import Base


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


class Pothole(Base):
    __tablename__ = "potholes"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    location = Column(Geometry("POINT", srid=4326), nullable=False)
    severity = Column(Enum(SeverityEnum), nullable=False)
    status = Column(Enum(StatusEnum), default=StatusEnum.OPEN, nullable=False)
    description = Column(String(500), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    __table_args__ = (
        Index("idx_location", location, postgresql_using="gist"),
    )


class ParkingZone(Base):
    __tablename__ = "parking_zones"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    location = Column(Geometry("POINT", srid=4326), nullable=False)
    severity = Column(Enum(ParkingSeverityEnum), nullable=False)
    status = Column(Enum(ParkingStatusEnum), default=ParkingStatusEnum.ACTIVE, nullable=False)
    description = Column(String(500), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    __table_args__ = (
        Index("idx_parking_location", location, postgresql_using="gist"),
    )
