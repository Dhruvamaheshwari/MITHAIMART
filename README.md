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

## Product and category APIs

Base URL `http://localhost:8000/api`. Anyone can read (GET). Create/update/delete need a Django staff user (HTTP Basic auth); create one with `python manage.py createsuperuser`.

| Method | URL | Notes |
|---|---|---|
| GET, POST | `/categories/` | GET lists active categories |
| GET, PUT, DELETE | `/categories/<id>/` | DELETE is blocked while the category has products |
| GET, POST | `/products/` | GET supports `search`, `category_id`, `min_price`, `max_price`, `sort=price_asc\|price_desc` |
| GET, PUT, DELETE | `/products/<id>/` | |

Product body: `name`, `description`, `category_id`, `image_url`, `is_active`, `variants` (list of `weight`, `price`, `stock`, `is_available`).

In Postman use the **Authorization** tab, type **Basic Auth**, for admin requests.

## Cart APIs (guest cart)

There is no customer login yet, so each browser creates a random guest id and sends it in the `X-Guest-ID` header. The cart is saved in the MongoDB `carts` collection under that id. Prices are always read from the product in MongoDB, never from the request.

| Method | URL | Body |
|---|---|---|
| GET | `/cart/` | - |
| POST | `/cart/add/` | `product_id`, `variant_weight`, `quantity` (default 1) |
| PUT | `/cart/update/` | `product_id`, `variant_weight`, `quantity` (1 or more) |
| DELETE | `/cart/remove/<product_id>/<variant_weight>/` | - |
| DELETE | `/cart/clear/` | - |

## Address and checkout APIs (guest)

Same guest mechanism as the cart (`X-Guest-ID` header). Every address query includes the guest id, so one guest can never read or change another guest's addresses (they get 404).

| Method | URL | Notes |
|---|---|---|
| GET, POST | `/addresses/` | POST needs `full_name`, `phone_number` (Indian 10-digit), `house_number`, `street`, `area`, `city`, `state`, `pincode` (6-digit); `landmark` optional |
| GET, PUT, DELETE | `/addresses/<id>/` | only one default address per guest; the first address is default automatically |
| POST | `/checkout/validate/` | body `{"address_id": "..."}`. Checks cart, address and stock, and returns totals calculated from database prices. Creates no order and does not clear the cart |

Delivery charge is "To be confirmed": no delivery rule exists yet.

## Health check

`GET /api/health/` returns `{"message": "MithaiMart API is working", "status": "success"}`.

## Tests

```bash
cd backend
python manage.py test
```

## Planned modules (not implemented)

Customers, products, categories, variants and pricing, cart, wishlist, addresses, coupons, checkout, payments (Razorpay), orders, inventory, admin dashboard, reviews, notifications. Product images via Cloudinary.
