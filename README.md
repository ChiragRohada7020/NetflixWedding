# Wedflix (React + Flask)

Wedflix is now split into:
- `frontend/` React (Vite)
- `app/` Flask backend API + admin
- `face_service/` optional separate face-vector worker/API

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
  - Set `FLASK_ENV=production`.
  - Recommended on Render free services: use Resend API email because Render blocks outbound SMTP ports on free web services.
    - `RESEND_API_KEY=<your Resend API key>`
    - `RESEND_FROM_EMAIL=<verified sender email>`
    - `RESEND_FROM_NAME=Wedflix`
  - SMTP is still supported for local development or paid hosts where SMTP is allowed. For Gmail, use an app password, not your normal account password:
    - `SMTP_HOST=smtp.gmail.com`
    - `SMTP_PORT=587`
    - `SMTP_USER=<your gmail address>`
    - `SMTP_PASSWORD=<your 16-character app password>`
    - `SMTP_FROM_EMAIL=<your gmail address>`
    - `SMTP_FROM_NAME=Wedflix`
    - `SMTP_USE_SSL=0`
- React frontend on Vercel/Netlify/Render Static.

## Optional Face Vector Service
The main backend can queue face-indexing jobs without running any AI model. Set `FACE_INDEX_ENABLED=1` in the backend, then run `face_service/worker.py` on a separate server. See `face_service/README.md`.
