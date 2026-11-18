"""Customer accounts: sign up, log in, and 'who am I?'.

Accounts are saved in the MongoDB "users" collection. The password is NEVER saved as text:
only a salted hash (Django's make_password, PBKDF2) is stored, and logging in compares hashes.
After sign up or login the website receives a token and sends it with later requests
(Authorization: Bearer <token>). See customer_auth.py.
"""

import logging
import re

from django.conf import settings
from django.contrib.auth.hashers import check_password, make_password
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError
from pymongo.errors import DuplicateKeyError, PyMongoError
from rest_framework import status
from rest_framework.decorators import api_view, authentication_classes, permission_classes, throttle_classes
from rest_framework.response import Response
from rest_framework.throttling import AnonRateThrottle

from apps.accounts.customer_auth import create_customer_token, read_bearer_token, read_guest_id, user_from_token
from apps.cart.views import merge_cart_into
from apps.products.views import current_time, error_response, validation_error
from config.mongodb import get_db

logger = logging.getLogger(__name__)

EMAIL_PATTERN = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
MAX_PASSWORD_LENGTH = 128  # stops someone sending a huge password to keep the server busy hashing it

_dummy_hash = None


def user_to_json(user):
    """Only what the website needs. Never the password hash."""
    return {"id": str(user["_id"]), "name": user["name"], "email": user["email"]}


def clean_email(value):
    return value.strip().lower() if isinstance(value, str) else ""


def merge_guest_cart_after_login(db, user_id, request):
    """If this browser had a guest cart, move its items into the customer's cart.
    A problem here must never break the login itself."""
    guest_id = read_guest_id(request)
    if guest_id is None:
        return
    try:
        merge_cart_into(db, f"guest:{guest_id}", f"user:{user_id}")
    except PyMongoError:
        logger.error("Could not merge the guest cart into the cart of user %s", user_id)


class RegisterThrottle(AnonRateThrottle):
    scope = "customer_register"  # rate is set in settings


class LoginThrottle(AnonRateThrottle):
    scope = "customer_login"  # rate is set in settings


@api_view(["POST"])
@authentication_classes([])
@permission_classes([])
@throttle_classes([RegisterThrottle])
def register(request):
    data = request.data if isinstance(request.data, dict) else {}
    errors = {}

    name = data.get("name")
    if not isinstance(name, str) or not name.strip():
        errors["name"] = "Name is required."
    elif len(name.strip()) > 100:
        errors["name"] = "Name must be 100 characters or less."

    email = clean_email(data.get("email"))
    if not email:
        errors["email"] = "Email is required."
    elif len(email) > 254 or not EMAIL_PATTERN.match(email):
        errors["email"] = "Enter a valid email address."

    password = data.get("password")
    if not isinstance(password, str) or not password:
        errors["password"] = "Password is required."
    elif len(password) > MAX_PASSWORD_LENGTH:
        errors["password"] = f"Password must be {MAX_PASSWORD_LENGTH} characters or less."
    else:
        try:
            validate_password(password)  # Django's rules: at least 8 characters, not too common, not only digits
        except ValidationError as problem:
            errors["password"] = " ".join(problem.messages)
    if errors:
        return validation_error(errors)

    db = get_db()
    now = current_time()
    user = {
        "name": name.strip(),
        "email": email,
        "password_hash": make_password(password),
        "is_active": True,
        "created_at": now,
        "updated_at": now,
    }
    exists_message = "An account with this email already exists. Try logging in."
    if db.users.find_one({"email": email}):
        return error_response(exists_message, status.HTTP_409_CONFLICT)
    try:
        user["_id"] = db.users.insert_one(user).inserted_id
    except DuplicateKeyError:  # two sign-ups with the same email at the same moment
        return error_response(exists_message, status.HTTP_409_CONFLICT)

    merge_guest_cart_after_login(db, user["_id"], request)
    return Response(
        {"token": create_customer_token(user["_id"]), "user": user_to_json(user)}, status=status.HTTP_201_CREATED
    )


@api_view(["POST"])
@authentication_classes([])
@permission_classes([])
@throttle_classes([LoginThrottle])
def login(request):
    global _dummy_hash
    data = request.data if isinstance(request.data, dict) else {}
    email = clean_email(data.get("email"))
    password = data.get("password")
    if not email or not isinstance(password, str) or not password or len(password) > MAX_PASSWORD_LENGTH:
        return error_response("Email and password are required.", status.HTTP_400_BAD_REQUEST)

    db = get_db()
    user = db.users.find_one({"email": email})
    if user is None:
        # Do the same slow hash check, so the answer time does not reveal whether the email exists
        if _dummy_hash is None:
            _dummy_hash = make_password("not-a-real-password")
        check_password(password, _dummy_hash)
        valid = False
    else:
        valid = user.get("is_active", True) and check_password(password, user["password_hash"])

    if not valid:
        # Same message for "no such email" and "wrong password"
        return error_response("Invalid email or password.", status.HTTP_401_UNAUTHORIZED)

    merge_guest_cart_after_login(db, user["_id"], request)
    return Response({"token": create_customer_token(user["_id"]), "user": user_to_json(user)})


@api_view(["GET"])
@authentication_classes([])
@permission_classes([])
def me(request):
    """Used by the website to find out who is logged in (and whether its token is still valid)."""
    token = read_bearer_token(request)
    user = user_from_token(token) if token else None
    if user is None:
        return error_response("Please log in.", status.HTTP_401_UNAUTHORIZED)
    return Response(user_to_json(user))
