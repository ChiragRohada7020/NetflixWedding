# Wedflix (React + Flask)

Wedflix is now split into:
- `frontend/` React (Vite)
- `app/` Flask backend API + admin

## Local Run

### Backend (Flask)
1. Create `.env` from `.env.example`
2. Install deps:
   - `pip install -r requirements.txt`
3. Run backend:
   - `python run.py`

Backend default URL: `http://127.0.0.1:5000`

### Frontend (React)
1. Go to frontend:
   - `cd frontend`
2. Create `.env` from `.env.example`
3. Install deps:
   - `npm install`
4. Run:
   - `npm run dev`

Frontend default URL: `http://127.0.0.1:5173`

## API Endpoints (for React)
- `GET /api/health`
- `GET /api/weddings`
- `GET /api/weddings/<wedding_id>`
- `GET /api/weddings/<wedding_id>/programs`
- `GET /api/programs/<program_id>/episodes`

## Demo Accounts
- Admin: `admin@weddingflix.com` / `admin123`
- Guest: `guest@weddingflix.com` / `guest123`

If users are missing in MongoDB, backend auto-creates default admin/guest at startup.

## Deployment
- Flask backend on Render:
  - Start command: `gunicorn run:app`
- React frontend on Vercel/Netlify/Render Static.
