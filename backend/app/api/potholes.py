from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import func, and_
from geoalchemy2 import Geometry
from geoalchemy2.functions import ST_MakePoint, ST_DWithin, ST_MakeEnvelope
import uuid

from ..database import get_db
from ..models import Pothole, SeverityEnum, StatusEnum
from ..schemas import PotholeCreate, PotholeResponse, NearbyCheckResponse

router = APIRouter(prefix="/api/potholes", tags=["potholes"])

# Nagpur bounds (approximate)
NAGPUR_MIN_LAT = 20.9
NAGPUR_MAX_LAT = 21.3
NAGPUR_MIN_LON = 78.8
NAGPUR_MAX_LON = 79.2

NEARBY_RADIUS_METERS = 50
MAX_POTHOLES_PER_REQUEST = 500


@router.post("", response_model=PotholeResponse)
def create_pothole(
    pothole_data: PotholeCreate,
    db: Session = Depends(get_db)
):
    """
    Create a new pothole report.
    Validates coordinates are within Nagpur bounds.
    """
    # Validate coordinates are within Nagpur
    if not (NAGPUR_MIN_LAT <= pothole_data.lat <= NAGPUR_MAX_LAT and
            NAGPUR_MIN_LON <= pothole_data.lon <= NAGPUR_MAX_LON):
        raise HTTPException(
            status_code=400,
            detail="Coordinates must be within Nagpur city bounds"
        )

    # Create geometry point
    location = ST_MakePoint(pothole_data.lon, pothole_data.lat)

    # Create pothole record
    new_pothole = Pothole(
        id=uuid.uuid4(),
        location=location,
        severity=pothole_data.severity,
        status=StatusEnum.OPEN,
        description=pothole_data.description
    )

    db.add(new_pothole)
    db.commit()
    db.refresh(new_pothole)

    return format_pothole_response(new_pothole, db)


@router.get("", response_model=list[PotholeResponse])
def get_potholes(
    min_lat: float = Query(...),
    max_lat: float = Query(...),
    min_lon: float = Query(...),
    max_lon: float = Query(...),
    db: Session = Depends(get_db)
):
    """
    Fetch potholes within a bounding box (map viewport).
    Returns max 500 potholes to prevent overload.
    """
    # Create bounding box envelope
    bbox = ST_MakeEnvelope(min_lon, min_lat, max_lon, max_lat, 4326)

    # Query potholes within bbox
    potholes = db.query(Pothole).filter(
        func.ST_Intersects(Pothole.location, bbox)
    ).limit(MAX_POTHOLES_PER_REQUEST).all()

    return [format_pothole_response(p, db) for p in potholes]


@router.get("/nearby-check", response_model=NearbyCheckResponse)
def check_nearby(
    lat: float = Query(...),
    lon: float = Query(...),
    db: Session = Depends(get_db)
):
    """
    Check for nearby pothole reports within the radius.
    Used to warn users before submission.
    """
    user_point = ST_MakePoint(lon, lat)

    nearby_count = db.query(func.count(Pothole.id)).filter(
        ST_DWithin(Pothole.location, user_point, NEARBY_RADIUS_METERS)
    ).scalar()

    return NearbyCheckResponse(nearby_count=nearby_count or 0)


@router.get("/stats")
def get_stats(db: Session = Depends(get_db)):
    """
    Get basic statistics about pothole reports.
    """
    total_count = db.query(func.count(Pothole.id)).scalar() or 0

    severity_counts = db.query(
        Pothole.severity,
        func.count(Pothole.id)
    ).group_by(Pothole.severity).all()

    status_counts = db.query(
        Pothole.status,
        func.count(Pothole.id)
    ).group_by(Pothole.status).all()

    return {
        "total_count": total_count,
        "by_severity": {s.value: count for s, count in severity_counts},
        "by_status": {st.value: count for st, count in status_counts}
    }


def format_pothole_response(pothole: Pothole, db: Session) -> PotholeResponse:
    """
    Format Pothole model to response schema with coordinates extracted.
    """
    # Extract coordinates from geometry
    result = db.query(func.ST_X(pothole.location), func.ST_Y(pothole.location)).first()
    if result:
        lon, lat = result
    else:
        lon, lat = None, None

    return PotholeResponse(
        id=pothole.id,
        lat=lat,
        lon=lon,
        severity=pothole.severity,
        status=pothole.status,
        description=pothole.description,
        created_at=pothole.created_at
    )
