# MithaiMart

Premium Indian sweets and snacks e-commerce platform. Separate Django REST backend and React (Vite) frontend.

This repository currently contains **Phase 1: project foundation only** (no auth, products, cart, checkout or admin dashboard yet).

## Stack

- Backend: Python 3.12, Django, Django REST Framework, SimpleJWT (installed, not yet used), django-cors-headers, MongoDB (PyMongo, runs in Docker)
- Frontend: React + Vite (JavaScript), Tailwind CSS 3, React Router DOM, Axios, Lucide React

## Structure

```
MithaiMart/
  backend/
    config/            Django project (settings, urls, wsgi/asgi)
    apps/core/         Health-check API
    manage.py
    requirements.txt
    .env.example
  frontend/
    src/{assets,components,pages,layouts,services,context,hooks,utils,routes,styles}
    public/
    package.json
    .env.example
```

## Prerequisites

- Python 3.12+, Node.js 20+, Docker

## Backend setup

```bash
cd backend
python -m venv venv
venv\Scripts\activate            # Windows  (macOS/Linux: source venv/bin/activate)
pip install -r requirements.txt
```

Start MongoDB (from the project root, in Docker):

```bash
docker compose up -d
```

MongoDB is published on host port **27018** (container port 27017), with a named volume `mongo_data` so data survives restarts.

Configure environment:

```bash
copy .env.example .env           # macOS/Linux: cp .env.example .env
```

Edit `backend/.env`: set `DJANGO_SECRET_KEY` and check `MONGO_URI` / `MONGO_DB_NAME`. Generate a secret key with:

```bash
python -c "from django.core.management.utils import get_random_secret_key as g; print(g())"
```

Run:

```bash
python manage.py migrate          # Django's own admin/session tables (local SQLite file)
python manage.py setup_mongo      # creates MongoDB collections and indexes
python manage.py runserver
```

API: http://localhost:8000/api/health/

## Frontend setup

```bash
cd frontend
npm install
copy .env.example .env           # macOS/Linux: cp .env.example .env
npm run dev
```

App: http://localhost:5173 (shows the API status from the health endpoint).

## Environment variables

Backend (`backend/.env`): `DJANGO_SECRET_KEY`, `DJANGO_DEBUG`, `DJANGO_ALLOWED_HOSTS`, `MONGO_URI`, `MONGO_DB_NAME`, `CORS_ALLOWED_ORIGINS`.

Frontend (`frontend/.env`): `VITE_API_BASE_URL` (default `http://localhost:8000/api`).

`.env` files are git-ignored; only `.env.example` files are committed.

## Health check

`GET /api/health/` returns `{"message": "MithaiMart API is working", "status": "success"}`.

## Tests

```bash
cd backend
python manage.py test
```

## Planned modules (not implemented)

Customers, products, categories, variants and pricing, cart, wishlist, addresses, coupons, checkout, payments (Razorpay), orders, inventory, admin dashboard, reviews, notifications. Product images via Cloudinary.
