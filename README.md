# MapMyPothole

A citizen-driven, public map for reporting potholes in Nagpur. This MVP allows users to report pothole locations with severity levels, and aggregates the data for analysis by civic authorities.

## Features

- 📍 Interactive map centered on Nagpur
- Click/tap to report a pothole at any location
- Select severity: Low / Medium / Dangerous
- Add optional description
- View all reported potholes with clustering
- Duplicate detection (warns if similar reports exist nearby)
- Basic statistics dashboard
- Mobile-friendly interface
- Public read-only data access

## Tech Stack

- **Frontend**: Leaflet.js, vanilla JavaScript, HTML/CSS
- **Backend**: FastAPI (Python)
- **Database**: PostgreSQL + PostGIS
- **Deployment**: (Render/Railway for backend, Netlify/FastAPI for frontend)

## Local Development Setup

### Prerequisites

1. **PostgreSQL with PostGIS** installed and running
   - [Windows Installation Guide](https://www.postgresql.org/download/windows/)
   - PostGIS extension: https://postgis.net/

2. **Python 3.9+**
   - Download from https://www.python.org/

### Step 1: Database Setup

1. Create a PostgreSQL database:
```bash
createdb mapmypothole
```

2. Connect to the database and enable PostGIS:
```bash
psql mapmypothole
```

In the psql terminal:
```sql
CREATE EXTENSION postgis;
\q
```

### Step 2: Backend Setup

1. Navigate to the backend directory:
```bash
cd backend
```

2. Create a Python virtual environment:
```bash
python -m venv venv
```

3. Activate the virtual environment:
   - **Windows**: `venv\Scripts\activate`
   - **macOS/Linux**: `source venv/bin/activate`

4. Copy `.env.example` to `.env` and update with your database credentials:
```bash
cp .env.example .env
```

Edit `.env`:
```
DATABASE_URL=postgresql://postgres:your_password@localhost:5432/mapmypothole
CORS_ORIGINS=*
```

5. Install dependencies:
```bash
pip install -r requirements.txt
```

6. The database tables will be created automatically when you start the app.

### Step 3: Run the Application

1. Start the FastAPI backend:
```bash
cd backend
uvicorn app.main:app --reload
```

The API will be available at `http://localhost:8000`

2. Open the frontend in your browser:
```
http://localhost:8000
```

3. **API Documentation**: http://localhost:8000/docs

## Usage

### For Citizens

1. **View the Map**: The map loads centered on Nagpur with all reported potholes
2. **Report a Pothole**:
   - Click on the map location where you see a pothole
   - Select severity (Low/Medium/Dangerous)
   - Add optional description
   - Submit
3. **Check Nearby**: The app warns if there are similar reports nearby
4. **Use Geolocation**: Click the "Use My Location" button to center on your location
5. **View Stats**: Check the statistics panel for total reports by severity

### For Authorities/Analysts

Access aggregated data via the `/api/potholes/stats` endpoint to get:
- Total pothole count
- Breakdown by severity
- Breakdown by status (Open/Fixed)

## API Endpoints

### Create a Pothole Report
```
POST /api/potholes
Content-Type: application/json

{
  "lat": 21.1458,
  "lon": 79.0882,
  "severity": "MEDIUM",
  "description": "Large crater, water pooling"
}

Response:
{
  "id": "uuid",
  "lat": 21.1458,
  "lon": 79.0882,
  "severity": "MEDIUM",
  "status": "OPEN",
  "description": "Large crater, water pooling",
  "created_at": "2025-01-26T10:30:00"
}
```

### Get Potholes in Bounding Box
```
GET /api/potholes?min_lat=21.0&max_lat=21.3&min_lon=78.9&max_lon=79.2

Response: List of potholes (max 500) within the bounds
```

### Check for Nearby Reports
```
GET /api/potholes/nearby-check?lat=21.1458&lon=79.0882

Response:
{
  "nearby_count": 2
}
```

### Get Statistics
```
GET /api/potholes/stats

Response:
{
  "total_count": 45,
  "by_severity": {
    "LOW": 20,
    "MEDIUM": 18,
    "DANGEROUS": 7
  },
  "by_status": {
    "OPEN": 42,
    "FIXED": 3
  }
}
```

## Project Structure

```
MapMyPothole/
├── backend/
│   ├── app/
│   │   ├── __init__.py
│   │   ├── main.py           # FastAPI app entry
│   │   ├── models.py         # SQLAlchemy models
│   │   ├── schemas.py        # Pydantic schemas
│   │   ├── database.py       # DB connection
│   │   └── api/
│   │       └── potholes.py   # Pothole endpoints
│   ├── requirements.txt
│   └── .env.example
├── frontend/
│   ├── index.html            # Single-page app
│   ├── style.css             # Styling
│   └── app.js                # Leaflet + logic
└── README.md
```

## Key Technical Details

### Geospatial Queries
- **Duplicate Detection**: ST_DWithin within 50 meters
- **Bounding Box**: ST_MakeEnvelope for viewport queries
- **Coordinate System**: WGS84 (SRID 4326)

### Performance
- Queries limited to 500 potholes per request
- Marker clustering for large datasets
- GIST index on location column

### Mobile Considerations
- HTML5 Geolocation API integration
- Touch-friendly UI (44x44px minimum tap targets)
- Responsive design for all screen sizes

## Out of Scope (MVP)

- Photo uploads
- User authentication
- Authority status updates
- Advanced analytics dashboard
- CSV export
- Email notifications

These can be added in future iterations.

## Troubleshooting

### "Connection refused" error
- Ensure PostgreSQL is running: `sudo service postgresql status`
- Verify DATABASE_URL in `.env` matches your setup

### "CREATE EXTENSION postgis" fails
- PostGIS extension not installed
- Windows: Install from https://postgis.net/windows/
- Linux: `sudo apt-get install postgresql-postgis`

### Map won't load
- Check browser console for errors (F12)
- Verify backend is running (`http://localhost:8000/health`)
- Clear browser cache

### "nearby_count" always returns 0
- Ensure PostGIS ST_DWithin is working correctly
- Check that location geometry is stored properly

## Future Enhancements

1. **Photo Uploads**: S3/cloud storage for evidence
2. **Authority Portal**: Dashboard for NMC officials to update status
3. **Advanced Analytics**: Ward-wise heatmaps, time-to-fix metrics
4. **Gamification**: Badges for active reporters
5. **API Rate Limiting**: Prevent spam
6. **User Accounts**: Optional for tracking contributions
7. **CSV Export**: For civic officials and media

## License

MIT License - Feel free to use, modify, and distribute.

## Contact & Support

For questions or issues, create an issue on the GitHub repository.

---

**Happy Pothole Hunting! 🚗**
