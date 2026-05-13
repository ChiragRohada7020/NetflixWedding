# WeddingFlix

WeddingFlix is a Netflix-style wedding memories platform built with Flask, MongoDB, Tailwind CSS, and JavaScript.

## Run locally

1. Create virtual environment and install dependencies.
2. Copy `.env.example` to `.env` and set MongoDB Atlas URI.
3. Seed sample data:
   - `python scripts/seed_demo.py`
4. Start app:
   - `python run.py`

## Demo Accounts

- Admin: `admin@weddingflix.com` / `admin123`
- Guest: `guest@weddingflix.com` / `guest123`

## Architecture

- Flask Blueprints: public, auth, dashboard, api, admin
- Collections: users, weddings, programs, episodes, photos, comments, guest_wishes
- Reusable templates + modular routes/models
- Deployment-ready environment variables for Atlas
