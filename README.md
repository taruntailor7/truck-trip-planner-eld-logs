# Trip Planner + ELD Log Generator

A full-stack application for truck drivers to plan trips and generate HOS-compliant ELD (Electronic Logging Device) daily logs.

## Features

- **Route Planning** – Enter current location, pickup, and dropoff to generate an optimized driving route via Mapbox
- **HOS Compliance** – Automatic scheduling of mandatory breaks, rest periods, and fuel stops following FMCSA rules
- **ELD Log Generation** – Multi-day 24-hour grid logs with four statuses: Off Duty, Sleeper Berth, Driving, On Duty
- **Interactive Map** – Full route visualization with color-coded stop markers
- **Trip Summary** – Timeline view of all driving segments, stops, and rest periods

## Tech Stack

| Layer    | Technology                          |
|----------|-------------------------------------|
| Backend  | Django 6 + Django REST Framework    |
| Frontend | React 19 (Vite) + Tailwind CSS 4   |
| Database | SQLite (dev) / PostgreSQL (prod)    |
| Maps     | Mapbox Directions + GL JS           |
| Hosting  | Render (backend) + Vercel (frontend)|

## Quick Start

### Prerequisites

- Python 3.12+
- Node.js 22+
- Mapbox access token ([get one free](https://account.mapbox.com/access-tokens/))

### Backend

```bash
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# Configure environment
cp .env.example .env
# Edit .env and add your MAPBOX_ACCESS_TOKEN

python manage.py migrate
python manage.py runserver
```

### Frontend

```bash
cd frontend
npm install

# Configure environment
cp .env.example .env
# Edit .env and add your VITE_MAPBOX_TOKEN

npm run dev
```

Open http://localhost:5173 – the Vite dev server proxies `/api` requests to Django on port 8000.

## API Endpoints

| Method | Endpoint              | Description                     |
|--------|-----------------------|---------------------------------|
| POST   | `/api/trips/`         | Create a new trip               |
| GET    | `/api/trips/{id}/`    | Get trip details with stops     |
| GET    | `/api/trips/{id}/logs/` | Get ELD daily logs for a trip |

## HOS Rules Implemented

- Max 11 hours driving per shift
- 14-hour on-duty window
- 30-minute break after 8 hours driving
- 70 hours / 8-day rolling cycle limit
- 10-hour off-duty (sleeper berth) reset
- 1-hour pickup/dropoff on-duty time
- Fuel stops every ~1,000 miles

## Deployment

**Backend (Render):** Use the included `render.yaml` blueprint or deploy manually with the `Procfile`.

**Frontend (Vercel):** Import the `frontend/` directory. Update the API rewrite URL in `vercel.json` to point to your Render backend.
