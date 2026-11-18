"""
Django settings for the MithaiMart backend.

All secrets and environment-specific values come from environment variables
(loaded from backend/.env in development). See .env.example.
"""

import os
from datetime import timedelta
from pathlib import Path

from corsheaders.defaults import default_headers

from django.core.exceptions import ImproperlyConfigured
from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent

load_dotenv(BASE_DIR / ".env")


def get_env(name, default=None, required=False):
    value = os.environ.get(name, default)
    if required and value in (None, ""):
        raise ImproperlyConfigured(
            f"Missing required environment variable: {name}. "
            "Copy .env.example to .env and fill it in."
        )
    return value


def get_list(name, default=""):
    return [item.strip() for item in os.environ.get(name, default).split(",") if item.strip()]


SECRET_KEY = get_env("DJANGO_SECRET_KEY", required=True)
DEBUG = get_env("DJANGO_DEBUG", "False").lower() in ("1", "true", "yes")
ALLOWED_HOSTS = get_list("DJANGO_ALLOWED_HOSTS", "localhost,127.0.0.1")

INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    # Third party
    "rest_framework",
    "corsheaders",
    # Local apps
    "apps.core",
    "apps.accounts",
    "apps.products",
    "apps.orders",
    "apps.cart",
]

MIDDLEWARE = [
    "corsheaders.middleware.CorsMiddleware",  # must be placed before CommonMiddleware
    "django.middleware.security.SecurityMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "config.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

WSGI_APPLICATION = "config.wsgi.application"
ASGI_APPLICATION = "config.asgi.application"

# MongoDB holds all MithaiMart data (see config/mongodb.py).
MONGO_URI = get_env("MONGO_URI", required=True)
MONGO_DB_NAME = get_env("MONGO_DB_NAME", "mithaimart")

# Django's own built-in features (admin login, sessions, staff accounts) need an
# SQL database. A small local SQLite file is used for those only.
# No MithaiMart business data is stored here.
DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.sqlite3",
        "NAME": BASE_DIR / "django_internal.sqlite3",
    }
}

AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator"},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

LANGUAGE_CODE = "en-us"
TIME_ZONE = "Asia/Kolkata"
USE_I18N = True
USE_TZ = True

STATIC_URL = "static/"
STATIC_ROOT = BASE_DIR / "staticfiles"

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

# Django REST Framework
REST_FRAMEWORK = {
    "DEFAULT_RENDERER_CLASSES": ["rest_framework.renderers.JSONRenderer"],
    "DEFAULT_PARSER_CLASSES": ["rest_framework.parsers.JSONParser"],
    "DEFAULT_PERMISSION_CLASSES": ["rest_framework.permissions.AllowAny"],
    # Admins log in with a Django staff account. The website uses a short-lived token (JWT).
    # Basic auth (username + password on every request) is kept only for API tools like Postman.
    "DEFAULT_AUTHENTICATION_CLASSES": [
        "apps.core.authentication.TolerantJWTAuthentication",
        "rest_framework.authentication.BasicAuthentication",
    ],
    # Limits password guessing on the admin login
    "DEFAULT_THROTTLE_RATES": {
        "admin_login": "10/min",
        "customer_login": "10/min",
        "customer_register": "10/hour",
    },
    # Turns MongoDB errors into a safe 503 response
    "EXCEPTION_HANDLER": "apps.core.exceptions.api_exception_handler",
}

# CORS: only the configured frontend origins may call the API.
CORS_ALLOWED_ORIGINS = get_list("CORS_ALLOWED_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173")
# The cart sends its guest id in this extra header, so the browser must be allowed to send it.
CORS_ALLOW_HEADERS = list(default_headers) + ["x-guest-id"]

# Admin login token: the website keeps it only until the browser tab is closed.
ADMIN_TOKEN_MINUTES = 60
SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(minutes=ADMIN_TOKEN_MINUTES),
    "AUTH_HEADER_TYPES": ("Bearer",),
}

# Customer login token lifetime. The website keeps the token (never the password) in the browser.
CUSTOMER_TOKEN_DAYS = 7

# A variant with this much stock or less is shown as "low stock" in the admin pages.
# Change it in .env (LOW_STOCK_THRESHOLD) instead of editing code.
LOW_STOCK_THRESHOLD = int(get_env("LOW_STOCK_THRESHOLD", "5"))

# Cloudinary stores the product images (the image files are NOT stored in MongoDB).
# The secret stays on the server. It is never sent to the website. Fill these in backend/.env.
CLOUDINARY_CLOUD_NAME = get_env("CLOUDINARY_CLOUD_NAME", "")
CLOUDINARY_API_KEY = get_env("CLOUDINARY_API_KEY", "")
CLOUDINARY_API_SECRET = get_env("CLOUDINARY_API_SECRET", "")

# Email / SMTP Configuration
EMAIL_BACKEND = get_env("EMAIL_BACKEND", "django.core.mail.backends.smtp.EmailBackend")
EMAIL_HOST = get_env("EMAIL_HOST", "smtp.gmail.com")
EMAIL_PORT = int(get_env("EMAIL_PORT", "587"))
EMAIL_USE_TLS = get_env("EMAIL_USE_TLS", "True").lower() in ("1", "true", "yes")
EMAIL_HOST_USER = get_env("EMAIL_HOST_USER", "")
EMAIL_HOST_PASSWORD = get_env("EMAIL_HOST_PASSWORD", "")
DEFAULT_FROM_EMAIL = get_env("DEFAULT_FROM_EMAIL", "MithaiMart <noreply@mithaimart.com>")
CONTACT_RECIPIENT_EMAIL = get_env("CONTACT_RECIPIENT_EMAIL", get_env("EMAIL_HOST_USER", "contact@mithaimart.com"))
