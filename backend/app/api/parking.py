from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import func
from geoalchemy2.functions import ST_MakePoint, ST_DWithin, ST_MakeEnvelope
import uuid

from ..database import get_db
from ..models import ParkingZone, ParkingSeverityEnum, ParkingStatusEnum
from ..schemas import ParkingZoneCreate, ParkingZoneResponse, NearbyCheckResponse

router = APIRouter(prefix="/api/parking", tags=["parking"])

NAGPUR_MIN_LAT = 20.9
NAGPUR_MAX_LAT = 21.3
NAGPUR_MIN_LON = 78.8
NAGPUR_MAX_LON = 79.2

NEARBY_RADIUS_METERS = 50
MAX_PER_REQUEST = 500


@router.post("", response_model=ParkingZoneResponse)
def create_parking_zone(data: ParkingZoneCreate, db: Session = Depends(get_db)):
    if not (NAGPUR_MIN_LAT <= data.lat <= NAGPUR_MAX_LAT and
            NAGPUR_MIN_LON <= data.lon <= NAGPUR_MAX_LON):
        raise HTTPException(status_code=400, detail="Coordinates must be within Nagpur city bounds")

    zone = ParkingZone(
        id=uuid.uuid4(),
        location=ST_MakePoint(data.lon, data.lat),
        severity=data.severity,
        status=ParkingStatusEnum.ACTIVE,
        description=data.description
    )
    db.add(zone)
    db.commit()
    db.refresh(zone)
    return format_response(zone, db)


@router.get("", response_model=list[ParkingZoneResponse])
def get_parking_zones(
    min_lat: float = Query(...), max_lat: float = Query(...),
    min_lon: float = Query(...), max_lon: float = Query(...),
    db: Session = Depends(get_db)
):
    bbox = ST_MakeEnvelope(min_lon, min_lat, max_lon, max_lat, 4326)
    zones = db.query(ParkingZone).filter(
        func.ST_Intersects(ParkingZone.location, bbox)
    ).limit(MAX_PER_REQUEST).all()
    return [format_response(z, db) for z in zones]


@router.get("/nearby-check", response_model=NearbyCheckResponse)
def check_nearby(lat: float = Query(...), lon: float = Query(...), db: Session = Depends(get_db)):
    point = ST_MakePoint(lon, lat)
    count = db.query(func.count(ParkingZone.id)).filter(
        ST_DWithin(ParkingZone.location, point, NEARBY_RADIUS_METERS)
    ).scalar()
    return NearbyCheckResponse(nearby_count=count or 0)


@router.get("/stats")
def get_stats(db: Session = Depends(get_db)):
    total = db.query(func.count(ParkingZone.id)).scalar() or 0
    by_severity = db.query(ParkingZone.severity, func.count(ParkingZone.id)).group_by(ParkingZone.severity).all()
    by_status = db.query(ParkingZone.status, func.count(ParkingZone.id)).group_by(ParkingZone.status).all()
    return {
        "total_count": total,
        "by_severity": {s.value: c for s, c in by_severity},
        "by_status": {s.value: c for s, c in by_status}
    }


def format_response(zone: ParkingZone, db: Session) -> ParkingZoneResponse:
    result = db.query(func.ST_X(zone.location), func.ST_Y(zone.location)).first()
    lon, lat = result if result else (None, None)
    return ParkingZoneResponse(
        id=zone.id, lat=lat, lon=lon,
        severity=zone.severity, status=zone.status,
        description=zone.description, created_at=zone.created_at
    )
