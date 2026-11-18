"""Customer login: tokens, and 'who owns this cart / address / order?'.

A request belongs to either
  - a logged-in customer: it carries  Authorization: Bearer <token>   -> owner id  "user:<id>"
  - a guest browser: it carries       X-Guest-ID: <random uuid>       -> owner id  "guest:<uuid>"
Carts, addresses and orders are saved with this owner_id and every query filters by it,
so nobody can read or change another owner's data.

Customer tokens are separate from admin tokens: they are signed with a different key and carry
typ="customer", so a customer token never works on an admin API (and the other way round).
"""

import uuid
from datetime import datetime, timedelta, timezone

import jwt
from django.conf import settings
from rest_framework import status

from apps.products.views import error_response, to_object_id
from config.mongodb import get_db


def _signing_key():
    return settings.SECRET_KEY + ":customer-token"


def create_customer_token(user_id):
    now = datetime.now(timezone.utc)
    payload = {
        "sub": str(user_id),
        "typ": "customer",
        "iat": now,
        "exp": now + timedelta(days=settings.CUSTOMER_TOKEN_DAYS),
    }
    return jwt.encode(payload, _signing_key(), algorithm="HS256")


def user_from_token(token):
    """Return the user document for a valid customer token, otherwise None.
    The user is loaded from MongoDB every time, so a deleted or disabled account stops working at once."""
    try:
        payload = jwt.decode(token, _signing_key(), algorithms=["HS256"], options={"require": ["exp", "sub"]})
    except jwt.PyJWTError:  # bad signature, expired, malformed...
        return None
    if payload.get("typ") != "customer":
        return None
    user_object_id = to_object_id(payload["sub"])
    if user_object_id is None:
        return None
    user = get_db().users.find_one({"_id": user_object_id})
    if user is None or not user.get("is_active", True):
        return None
    return user


def read_bearer_token(request):
    """The token from 'Authorization: Bearer <token>', or None if the request has no Bearer header."""
    header = request.headers.get("Authorization", "")
    if header[:7].lower() == "bearer ":
        return header[7:].strip()
    return None


def read_guest_id(request):
    """The guest id from the X-Guest-ID header, or None if it is missing or not a UUID."""
    try:
        return str(uuid.UUID(request.headers.get("X-Guest-ID", "")))
    except ValueError:
        return None


def require_login(owner_id):
    """Placing an order needs an account. Call this right after get_owner():

        login_error = require_login(owner_id)
        if login_error:
            return login_error

    A guest browser (owner id "guest:...") gets a 401 and must log in first. A logged-in customer gets None."""
    if owner_id.startswith("user:"):
        return None
    return error_response("Please log in to place an order.", status.HTTP_401_UNAUTHORIZED)


def get_owner(request):
    """Use at the start of a cart / address / order view:

        owner_id, error = get_owner(request)
        if error:
            return error

    A Bearer token means a logged-in customer. A bad or expired token is an error (401),
    we never silently treat it as a guest. Without a token the guest id is used."""
    token = read_bearer_token(request)
    if token is not None:
        user = user_from_token(token)
        if user is None:
            return None, error_response("Your login has expired. Please log in again.", status.HTTP_401_UNAUTHORIZED)
        return f"user:{user['_id']}", None

    guest_id = read_guest_id(request)
    if guest_id is None:
        return None, error_response("A valid X-Guest-ID header is required.", status.HTTP_400_BAD_REQUEST)
    return f"guest:{guest_id}", None
