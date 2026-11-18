"""Admin APIs.

How admin access is protected:
1. The admin logs in with a Django staff account and gets a short-lived token (JWT).
2. Every admin API below uses @admin_view, which (a) checks the token's signature and expiry,
   (b) loads the user from the database and (c) requires is_active AND is_staff.
   So the role is checked on the backend for EVERY request. If an admin is demoted or disabled,
   the old token stops working immediately. Nothing the browser sends can grant admin rights.
3. Admin actions that already exist (create/edit/delete product and category) are in
   apps/products/views.py and are protected by the same staff check.
"""

import logging

from django.conf import settings
from django.contrib.auth import authenticate
from rest_framework import status
from rest_framework.decorators import (
    api_view,
    authentication_classes,
    parser_classes,
    permission_classes,
    throttle_classes,
)
from rest_framework.parsers import MultiPartParser
from rest_framework.permissions import BasePermission
from rest_framework.response import Response
from rest_framework.throttling import AnonRateThrottle
from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework_simplejwt.tokens import AccessToken

from apps.orders.views import ALLOWED_STATUS_CHANGES, ORDER_STATUSES, restore_stock
from apps.products.image_upload import MAX_IMAGE_BYTES, ImageUploadError, upload_product_image
from apps.products.views import category_to_json, current_time, error_response, is_number, product_to_json, to_object_id
from config.mongodb import get_db

logger = logging.getLogger(__name__)

MAX_STOCK = 1_000_000


class IsAdmin(BasePermission):
    """Only active staff users. No token -> 401, logged in but not staff -> 403."""

    message = "Admin access is required."

    def has_permission(self, request, view):
        user = request.user
        return bool(user and user.is_authenticated and user.is_active and user.is_staff)


def admin_view(methods, parsers=None):
    """Use above an admin API function: JSON API + token login + admin role check.
    Pass parsers=[MultiPartParser] for an API that receives a file."""

    def decorator(view):
        if parsers:
            view = parser_classes(parsers)(view)
        view = permission_classes([IsAdmin])(view)
        view = authentication_classes([JWTAuthentication])(view)
        return api_view(methods)(view)

    return decorator


# ---------------------------------------------------------------------------
# Login
# ---------------------------------------------------------------------------

class AdminLoginThrottle(AnonRateThrottle):
    scope = "admin_login"  # rate is set in settings (10 attempts per minute)


@api_view(["POST"])
@authentication_classes([])
@permission_classes([])
@throttle_classes([AdminLoginThrottle])
def admin_login(request):
    data = request.data if isinstance(request.data, dict) else {}
    username = data.get("username")
    password = data.get("password")
    if not isinstance(username, str) or not isinstance(password, str) or not username or not password:
        return error_response("Username and password are required.", status.HTTP_400_BAD_REQUEST)

    # authenticate() checks the password hash (it also rejects disabled users)
    user = authenticate(request, username=username, password=password)
    if user is None:
        return error_response("Invalid username or password.", status.HTTP_401_UNAUTHORIZED)
    if not user.is_staff:
        return error_response("This account does not have admin access.", status.HTTP_403_FORBIDDEN)

    token = AccessToken.for_user(user)
    return Response(
        {"access": str(token), "username": user.username, "expires_in_minutes": settings.ADMIN_TOKEN_MINUTES}
    )


@admin_view(["GET"])
def admin_me(request):
    """Lets the website ask: 'is my token still valid and am I still an admin?'"""
    return Response({"username": request.user.username})


# ---------------------------------------------------------------------------
# Dashboard numbers
# ---------------------------------------------------------------------------

@admin_view(["GET"])
def admin_stats(request):
    db = get_db()
    threshold = settings.LOW_STOCK_THRESHOLD
    return Response(
        {
            "total_products": db.products.count_documents({}),
            "total_categories": db.categories.count_documents({}),
            "total_orders": db.orders.count_documents({}),
            "pending_orders": db.orders.count_documents({"order_status": "Pending"}),
            # active products that have at least one weight with stock at or below the threshold
            "low_stock_products": db.products.count_documents(
                {"is_active": True, "variants": {"$elemMatch": {"stock": {"$lte": threshold}}}}
            ),
            "low_stock_threshold": threshold,
        }
    )


# ---------------------------------------------------------------------------
# Products and categories (lists that include inactive items, and stock updates)
# ---------------------------------------------------------------------------

def admin_product_to_json(product, category_names):
    data = product_to_json(product)
    data["category_name"] = category_names.get(product["category_id"], "Unknown category")
    threshold = settings.LOW_STOCK_THRESHOLD
    data["variants"] = [dict(variant, low_stock=variant["stock"] <= threshold) for variant in product["variants"]]
    return data


def category_name_map(db):
    return {category["_id"]: category["name"] for category in db.categories.find({}, {"name": 1})}


@admin_view(["GET"])
def admin_product_list(request):
    """All products, also the inactive ones (the public list only shows active products)."""
    db = get_db()
    names = category_name_map(db)
    products = db.products.find({}).sort("created_at", -1)
    return Response(
        {
            "low_stock_threshold": settings.LOW_STOCK_THRESHOLD,
            "products": [admin_product_to_json(product, names) for product in products],
        }
    )


@admin_view(["GET"])
def admin_category_list(request):
    """All categories, also the inactive ones, with the number of products that use each."""
    db = get_db()
    counts = {row["_id"]: row["count"] for row in db.products.aggregate([{"$group": {"_id": "$category_id", "count": {"$sum": 1}}}])}
    categories = db.categories.find({}).sort("name", 1)
    return Response([dict(category_to_json(c), product_count=counts.get(c["_id"], 0)) for c in categories])


@admin_view(["PATCH"])
def admin_product_stock(request, product_id):
    """Set the stock of ONE weight. Only that number is changed, nothing else in the product."""
    object_id = to_object_id(product_id)
    if object_id is None:
        return error_response("Invalid product id.", status.HTTP_400_BAD_REQUEST)
    if not isinstance(request.data, dict):
        return error_response("Send a JSON object.", status.HTTP_400_BAD_REQUEST)

    weight = request.data.get("variant_weight")
    stock = request.data.get("stock")
    if not isinstance(weight, str) or not weight.strip():
        return error_response("variant_weight is required.", status.HTTP_400_BAD_REQUEST)
    if not is_number(stock) or int(stock) != stock or stock < 0 or stock > MAX_STOCK:
        return error_response(
            f"stock must be a whole number from 0 to {MAX_STOCK}.", status.HTTP_400_BAD_REQUEST
        )

    db = get_db()
    # One atomic MongoDB update that changes only this weight's stock
    result = db.products.update_one(
        {"_id": object_id, "variants.weight": weight.strip()}, {"$set": {"variants.$.stock": int(stock)}}
    )
    if result.matched_count == 0:
        if db.products.find_one({"_id": object_id}, {"_id": 1}) is None:
            return error_response("Product not found.", status.HTTP_404_NOT_FOUND)
        return error_response("This weight does not exist for the product.", status.HTTP_404_NOT_FOUND)

    product = db.products.find_one({"_id": object_id})
    return Response(admin_product_to_json(product, category_name_map(db)))


# ---------------------------------------------------------------------------
# Orders
# ---------------------------------------------------------------------------

def admin_order_to_json(order):
    """Only what the admin needs. No phone number or full address is returned here."""
    current = order["order_status"]
    return {
        "id": str(order["_id"]),
        "order_number": order["order_number"],
        "customer_name": order["delivery_address"].get("full_name", ""),  # name on the delivery address
        "created_at": order["created_at"].isoformat(),
        "total_amount": order["total_amount"],
        "payment_method": order["payment_method"],
        "payment_status": order["payment_status"],
        "order_status": current,
        "allowed_next_statuses": ALLOWED_STATUS_CHANGES.get(current, []),
        "items": [
            {"product_name": i["product_name"], "variant_weight": i["variant_weight"], "quantity": i["quantity"]}
            for i in order["items"]
        ],
    }


@admin_view(["GET"])
def admin_order_list(request):
    orders = get_db().orders.find({}).sort("created_at", -1)
    return Response([admin_order_to_json(order) for order in orders])


@admin_view(["PATCH"])
def admin_order_status(request, order_id):
    """Change the status of an order. Only the status is changed. Payment status is never changed here:
    an online payment may only be marked paid by a real payment provider (none exists yet)."""
    object_id = to_object_id(order_id)
    if object_id is None:
        return error_response("Invalid order id.", status.HTTP_400_BAD_REQUEST)
    if not isinstance(request.data, dict):
        return error_response("Send a JSON object.", status.HTTP_400_BAD_REQUEST)

    new_status = request.data.get("order_status")
    if new_status not in ORDER_STATUSES:
        return error_response(f"order_status must be one of: {', '.join(ORDER_STATUSES)}.", status.HTTP_400_BAD_REQUEST)

    db = get_db()
    order = db.orders.find_one({"_id": object_id})
    if order is None:
        return error_response("Order not found.", status.HTTP_404_NOT_FOUND)

    current = order["order_status"]
    if new_status not in ALLOWED_STATUS_CHANGES.get(current, []):
        return error_response(f"An order that is {current} cannot be changed to {new_status}.", status.HTTP_409_CONFLICT)

    # Change the status only if it is still the one we just read (so two admins cannot clash)
    result = db.orders.update_one(
        {"_id": object_id, "order_status": current},
        {"$set": {"order_status": new_status, "updated_at": current_time()}},
    )
    if result.modified_count != 1:
        return error_response("This order was just changed by someone else. Please reload.", status.HTTP_409_CONFLICT)

    # A cancelled order gives its stock back (the order reduced stock when it was placed)
    if new_status == "Cancelled":
        restore_stock(db, order["items"])

    return Response(admin_order_to_json(db.orders.find_one({"_id": object_id})))


# ---------------------------------------------------------------------------
# Image upload (Cloudinary, or MongoDB when Cloudinary is not set up)
# ---------------------------------------------------------------------------

@admin_view(["POST"], parsers=[MultiPartParser])
def admin_upload_image(request):
    """Receive an image file from the admin, check it, send it to Cloudinary and return its link.
    The admin pages then save that link inside the product. Only admins can call this."""
    # Refuse a huge request before reading it (a little extra room is allowed for the form headers)
    declared_size = request.META.get("CONTENT_LENGTH", "")
    if declared_size.isdigit() and int(declared_size) > MAX_IMAGE_BYTES + 1024 * 1024:
        return error_response("The image is too large. The maximum size is 5 MB.", status.HTTP_413_REQUEST_ENTITY_TOO_LARGE)

    uploaded_file = request.FILES.get("image")
    if uploaded_file is None:
        return error_response("Choose an image file to upload (form field name: image).", status.HTTP_400_BAD_REQUEST)

    try:
        url = upload_product_image(uploaded_file)
    except ImageUploadError as error:
        return error_response(error.message, error.http_status)
    if url.startswith("/"):  # saved in our own database: make a full link the website can open
        url = request.build_absolute_uri(url)
    return Response({"url": url}, status=status.HTTP_201_CREATED)
