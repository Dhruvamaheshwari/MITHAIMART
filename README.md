# MithaiMart

MithaiMart is a full-stack Indian sweets, snacks, gifting, and wholesale ordering
platform. It combines a Django backend with a React/Vite storefront and a
separate staff administration area.

The application supports guest shopping and customer accounts, product
catalogue management, cart and checkout flows, order tracking, custom hampers,
bulk ordering, wholesale quotations, product image uploads, and downloadable
catalogues.

## Stack

- Backend: Python 3.12+, Django 6.1, Django REST Framework, PyMongo, SimpleJWT, Cloudinary, django-cors-headers
- Frontend: React 19, Vite 8, React Router, Tailwind CSS 3, Axios, Lucide React, QRCode
- Database: MongoDB for application data and SQLite for Django's local admin/session tables
- Development services: Docker Compose

## Structure

```
MithaiMart/
  backend/
    config/            Django project (settings, urls, wsgi/asgi)
    apps/              accounts, cart, core, orders and products
    manage.py
    requirements.txt
    .env.example
  frontend/
    src/               React pages, components, context and API services
    public/
    package.json
    .env.example
```

## Features

- Browse products by category, state, search term, price range, and availability.
- Product variants with independent weights, prices, stock, and availability.
- Guest carts and customer accounts with account-linked carts, addresses, and orders.
- Checkout with address management, stock validation, order creation, and order history.
- Custom gift hamper builder with box selection and product estimates.
- Bulk ordering with quantity rules, estimates, and cart support.
- Wholesale request and quotation workflow for customers and staff.
- Staff dashboard for products, categories, stock, orders, hampers, and wholesale requests.
- Cloudinary image uploads with a local MongoDB fallback for development.
- Downloadable PDF catalogue and QR code, contact form, coupon validation, and image credits.

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

App: http://localhost:5173

Build and lint the frontend before deployment:

```bash
npm run lint
npm run build
```

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

## Order APIs (guest)

Same guest mechanism (`X-Guest-ID` header). The backend takes the cart, prices and stock from MongoDB. It never uses a price or total sent by the browser.

| Method | URL | Notes |
|---|---|---|
| POST | `/orders/create/` | body `{"address_id": "..."}`. Saves the order, reduces stock, then clears the cart |
| GET | `/orders/` | this guest's orders, newest first |
| GET | `/orders/<id>/` | one order; another guest's order returns 404 |

Order status starts as `Pending` (Pending, Confirmed, Processing, Shipped, Delivered, Cancelled). Customers cannot change it. Payment method and delivery charge are "To be confirmed", and nothing is marked as paid.

MongoDB here is a standalone server, so transactions are not used. Stock is reduced with an atomic "only if enough stock" update per item, given back if anything fails, and the cart is locked while an order is placed so a double click cannot create two orders. This is careful but it is not a full transaction. Run `python manage.py setup_mongo` once to create the unique `order_number` index.

## Admin area

Open `http://localhost:5173/admin/login`. Only staff accounts can sign in. Create one with `python manage.py createsuperuser` (a staff account is any Django user with `is_staff`).

- Login: `POST /api/admin/login/` returns a short-lived token (60 minutes). The website keeps only the token, in `sessionStorage`, never the password. Login is limited to 10 attempts per minute.
- Every admin API checks the token **and** loads the user to confirm `is_active` and `is_staff` on every request, so removing someone's staff status takes effect immediately.
- Pages: `/admin` (dashboard), `/admin/products`, `/admin/categories`, `/admin/orders`.

| Method | URL | Notes |
|---|---|---|
| GET | `/admin/me/`, `/admin/stats/` | check login, dashboard numbers |
| GET | `/admin/products/`, `/admin/categories/` | include inactive items (categories include `product_count`) |
| PATCH | `/admin/products/<id>/stock/` | `{"variant_weight": "250g", "stock": 20}`. Changes only that number |
| GET | `/admin/orders/` | all orders (no phone or address) |
| PATCH | `/admin/orders/<id>/status/` | `{"order_status": "Confirmed"}`. Only allowed steps; cancelling returns stock |

Adding, editing and deleting products and categories uses the existing `/products/` and `/categories/` APIs (admin only). Editing a product without sending a variant's `stock` keeps its current stock, so an edit can never overwrite stock changed by a new order.

Low stock: a weight is "low" when its stock is `LOW_STOCK_THRESHOLD` (in `backend/.env`, default 5) or less.

Allowed order status steps: Pending to Confirmed or Cancelled; Confirmed to Processing or Cancelled; Processing to Shipped or Cancelled; Shipped to Delivered. Delivered and Cancelled are final. Payment status is never changed by the admin pages.

## Product image upload (Cloudinary)

Images are stored in Cloudinary. MongoDB only keeps the image link (`image_url`), never the file.

1. Create a free Cloudinary account and copy the cloud name, API key and API secret from its dashboard.
2. Put them in `backend/.env` (never commit that file, and never put the secret in the frontend):
   `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`
3. Restart the backend. In `/admin/products` choose an image, check the preview and press **Upload image**, then save the product.

`POST /api/admin/upload-image/` (admin token only, multipart form field `image`) accepts JPEG, PNG or WebP up to 5 MB. The type is checked from the file contents, not the file name. It returns `{"url": "https://res.cloudinary.com/..."}`. Without the three Cloudinary settings the image file is stored in MongoDB (collection `images`) and the returned link looks like `http://host/api/images/<id>/` (public `GET /api/images/<id>/`). This is fine for local development; use Cloudinary for a real shop. The "paste an image link" field still works as a fallback.

## Photos that ship with the website

`frontend/public/images/` holds 126 sweets, snacks, bakery, chocolate, and
gifting photos from Wikimedia Commons, used under free Creative Commons or
public-domain licences. The home page banner is in `hero/`; catalogue photos
are in `sweets/`.

- Every photo is credited (author, licence, source link) on the **/credits** page, linked from the footer. The licences require this. The list lives in `frontend/src/data/photoCredits.js`: if you add or remove a photo, update it.
- In the admin product and category forms, choose **"Or use a photo from the project"**, or type the path yourself, for example `/images/sweets/kaju-katli.jpg`. The backend accepts only `/images/...` paths made of letters, digits, `-` and `_` ending in .jpg, .jpeg, .png, .webp, .gif or .avif (no `..` and no other website).
- Photos shown for a category or product are whatever the admin sets as its image. Nothing is attached automatically.
- Photos under CC BY-SA must be shared under the same licence if you edit and republish them. Check the licence on /credits before using a photo outside this site.

## Origin state

Each product can have an optional **origin state** (the state the sweet or snack is best known from). `GET /api/states/` returns the allowed names (28 states and 8 union territories). Admins pick it in the product form. The Products page has a State filter, cards and product pages show the state, and the home page has "Shop by State" links for the states that have items. An edit that does not send a state keeps the saved one.

## Product search and filters

`GET /api/products/` accepts these together: `search` (name contains, up to 100 characters), `category_id`, `state` (for example `Rajasthan`), `min_price`, `max_price`, `sort=price_asc|price_desc`. Prices are checked against the weights saved in MongoDB, and only weights that are available and in stock count. A product matches if any such weight is in range; sorting uses its cheapest weight that can be bought, and products with nothing to buy come last. The Products page keeps the filters in the URL and waits half a second after typing before asking the backend.

## Customer accounts (login and sign up)

Pages: `/login` and `/register`. Customers can still shop as guests; logging in keeps the cart, addresses and orders with the account.

| Method | URL | Notes |
|---|---|---|
| POST | `/auth/register/` | `{name, email, password}` returns `{token, user}`. Password: 8 to 128 characters, not too common, not only digits. Limited to 10 sign-ups per hour per IP |
| POST | `/auth/login/` | `{email, password}` returns `{token, user}`. Same answer for a wrong password and an unknown email. Limited to 10 attempts per minute per IP |
| GET | `/auth/me/` | who the token belongs to |

- Accounts are saved in the MongoDB `users` collection. The password is stored only as a salted PBKDF2 hash (never as text). Emails are unique and not case sensitive.
- The website keeps only the token in `localStorage` (valid for `CUSTOMER_TOKEN_DAYS`, 7 by default), never the password. Log out removes it. A token is a bearer credential: anything that can run script on the page could read it, so never render untrusted HTML.
- Customer tokens are separate from admin tokens and are not accepted by admin APIs (and the other way round).
- Carts, addresses and orders are saved with an `owner_id`: `user:<id>` for a logged-in customer, `guest:<uuid>` for a guest browser. Every query filters by it, so nobody can see another owner's data.
- When a guest logs in or signs up, the items in the guest cart are merged into the account cart (never above stock). Orders and addresses created as a guest stay with that browser.
- Existing databases: run `python manage.py setup_mongo` once. It replaces the old `guest_id` indexes with `owner_id` ones. (Data saved by older versions under `guest_id` is not carried over automatically.)

## Health check

`GET /api/health/` returns `{"message": "MithaiMart API is working", "status": "success"}`.

## Tests

```bash
cd backend
python manage.py test
```

## Current limitations

- Payment processing is not integrated; orders are not marked as paid.
- Delivery charges are not calculated yet and remain "To be confirmed".
- MongoDB is run as a standalone local service, so order creation uses
  application-level stock protection rather than database transactions.
- Cloudinary is recommended for production image storage. The MongoDB image
  fallback is intended for local development.
