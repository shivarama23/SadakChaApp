from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
import os
from pathlib import Path

from .database import engine, Base
from .api import potholes, parking

Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="MapMyNagpur API",
    description="Citizen-driven civic reporting for Nagpur",
    version="0.2.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=os.getenv("CORS_ORIGINS", "*").split(","),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(potholes.router)
app.include_router(parking.router)

frontend_path = Path(__file__).parent.parent.parent / "frontend"


@app.get("/health")
def health_check():
    return {"status": "ok"}


# Page routes - serve HTML files for specific paths
@app.get("/potholes")
def potholes_page():
    return FileResponse(frontend_path / "potholes.html")


@app.get("/parking")
def parking_page():
    return FileResponse(frontend_path / "parking.html")


# Static files (CSS, JS, images) and index.html for root
if frontend_path.exists():
    app.mount("/", StaticFiles(directory=str(frontend_path), html=True), name="frontend")
