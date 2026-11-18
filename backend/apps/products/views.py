"""Category and Product APIs. Data lives in MongoDB (no Django models used)."""

import math
import os
import re
from datetime import datetime, timezone
from urllib.parse import urlparse

from bson import ObjectId
from bson.errors import InvalidId
from pymongo.errors import DuplicateKeyError
from rest_framework import status
from django.http import HttpResponse
from rest_framework.decorators import api_view, authentication_classes, permission_classes
from rest_framework.permissions import SAFE_METHODS, AllowAny, BasePermission
from rest_framework.response import Response

from apps.products.image_upload import read_image_from_db
from config.mongodb import get_db


class IsAdminOrReadOnly(BasePermission):
    """Anyone can read (GET). Only logged-in staff/admin users can create, update or delete."""

    def has_permission(self, request, view):
        if request.method in SAFE_METHODS:
            return True
        return bool(request.user and request.user.is_authenticated and request.user.is_staff)


# ---------------------------------------------------------------------------
# Small helper functions
# ---------------------------------------------------------------------------

def to_object_id(value):
    """Turn a string into a MongoDB ObjectId. Returns None if the string is not a valid id."""
    if not isinstance(value, str):
        return None
    try:
        return ObjectId(value)
    except InvalidId:
        return None


def current_time():
    """Now in UTC. MongoDB keeps only milliseconds, so trim to match what will be read back."""
    now = datetime.now(timezone.utc)
    return now.replace(microsecond=now.microsecond // 1000 * 1000)


def error_response(message, http_status):
    return Response({"error": message}, status=http_status)


def category_to_json(category):
    """ObjectId and datetime are not JSON friendly, so convert them to strings."""
    return {
        "id": str(category["_id"]),
        "name": category["name"],
        "description": category["description"],
        "image_url": category["image_url"],
        "is_active": category["is_active"],
        "created_at": category["created_at"].isoformat(),
    }


def product_to_json(product):
    return {
        "id": str(product["_id"]),
        "name": product["name"],
        "description": product["description"],
        "category_id": str(product["category_id"]),
        "image_url": product["image_url"],
        "is_active": product["is_active"],
        "state": product.get("state", ""),
        "variants": product["variants"],
        "created_at": product["created_at"].isoformat(),
    }


def is_number(value):
    # bool is a subclass of int in Python, so True/False must be rejected separately
    return isinstance(value, (int, float)) and not isinstance(value, bool)


# Where a sweet or snack comes from. Optional on a product. Only these names are accepted.
INDIAN_STATES = [
    "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chhattisgarh", "Goa", "Gujarat", "Haryana",
    "Himachal Pradesh", "Jharkhand", "Karnataka", "Kerala", "Madhya Pradesh", "Maharashtra", "Manipur",
    "Meghalaya", "Mizoram", "Nagaland", "Odisha", "Punjab", "Rajasthan", "Sikkim", "Tamil Nadu", "Telangana",
    "Tripura", "Uttar Pradesh", "Uttarakhand", "West Bengal",
    # union territories
    "Andaman and Nicobar Islands", "Chandigarh", "Dadra and Nagar Haveli and Daman and Diu", "Delhi",
    "Jammu and Kashmir", "Ladakh", "Lakshadweep", "Puducherry",
]

IMAGE_EXTENSIONS = (".jpg", ".jpeg", ".png", ".webp", ".gif", ".avif")

# A photo that ships with the website itself, for example /images/sweets/kaju-katli.jpg.
# Only letters, digits, "-" and "_" are allowed in the folder and file names, so a path can never
# climb out of the images folder (no "..") or point to another website ("//").
PROJECT_IMAGE_PATH = re.compile(r"^/images/[A-Za-z0-9_-]+(/[A-Za-z0-9_-]+)*\.(jpg|jpeg|png|webp|gif|avif)$", re.IGNORECASE)


def is_valid_image_url(value):
    """An empty value is fine (image is optional). Otherwise it must be either
    - a path to a photo of the website itself (/images/...), or
    - an http(s) link with a host. If the link ends with a file type it must be an image type.
      Links without a file type (many image services use them) are allowed."""
    if not isinstance(value, str):
        return False
    value = value.strip()
    if value == "":
        return True
    if len(value) > 500 or any(character.isspace() for character in value):
        return False
    if value.startswith("/"):
        return bool(PROJECT_IMAGE_PATH.match(value))
    parts = urlparse(value)
    if parts.scheme not in ("http", "https") or not parts.netloc:
        return False
    extension = os.path.splitext(parts.path)[1].lower()
    return extension == "" or extension in IMAGE_EXTENSIONS


def read_text_fields(data, errors, required_name=True, required_description=False):
    """Validate the fields shared by categories and products. Returns the cleaned values."""
    cleaned = {}

    name = data.get("name")
    if not isinstance(name, str) or not name.strip():
        if required_name:
            errors["name"] = "Name is required."
    elif len(name.strip()) > 150:
        errors["name"] = "Name must be 150 characters or less."
    else:
        cleaned["name"] = name.strip()

    description = data.get("description", "")
    if not isinstance(description, str):
        errors["description"] = "Description must be text."
    elif required_description and not description.strip():
        errors["description"] = "Description is required."
    else:
        cleaned["description"] = description.strip()

    image_url = data.get("image_url", "")
    if not is_valid_image_url(image_url):
        errors["image_url"] = (
            "Enter a valid http:// or https:// image link, or a project photo path like /images/sweets/barfi.jpg. "
            "If it ends with a file type, use .jpg, .jpeg, .png, .webp, .gif or .avif."
        )
    else:
        cleaned["image_url"] = image_url.strip()

    is_active = data.get("is_active", True)
    if not isinstance(is_active, bool):
        errors["is_active"] = "is_active must be true or false."
    else:
        cleaned["is_active"] = is_active

    return cleaned


def read_variants(variants, errors):
    """Validate the list of weight options, e.g. [{"weight": "250g", "price": 250, "stock": 10}]."""
    if not isinstance(variants, list) or len(variants) == 0:
        errors["variants"] = "Add at least one variant (weight, price, stock)."
        return []

    cleaned_variants = []
    seen_weights = set()
    for position, variant in enumerate(variants, start=1):
        label = f"variant {position}"
        if not isinstance(variant, dict):
            errors["variants"] = f"{label} must be an object."
            return []

        weight = variant.get("weight")
        price = variant.get("price")
        stock = variant.get("stock", 0)
        is_available = variant.get("is_available", True)

        if not isinstance(weight, str) or not weight.strip() or len(weight.strip()) > 20:
            errors["variants"] = f"{label}: weight is required (for example 250g)."
        elif weight.strip().lower() in seen_weights:
            errors["variants"] = f"{label}: weight '{weight}' is repeated."
        elif not is_number(price) or price < 0:
            errors["variants"] = f"{label}: price must be a number, 0 or more."
        elif not isinstance(stock, int) or isinstance(stock, bool) or stock < 0:
            errors["variants"] = f"{label}: stock must be a whole number, 0 or more."
        elif not isinstance(is_available, bool):
            errors["variants"] = f"{label}: is_available must be true or false."
        else:
            seen_weights.add(weight.strip().lower())
            cleaned_variants.append(
                {
                    "weight": weight.strip(),
                    "price": round(float(price), 2),
                    "stock": stock,
                    "is_available": is_available,
                }
            )
            continue
        return []  # a variant had an error, stop checking

    return cleaned_variants


def validation_error(errors):
    return Response({"error": "Invalid data.", "details": errors}, status=status.HTTP_400_BAD_REQUEST)


# ---------------------------------------------------------------------------
# Category APIs
# ---------------------------------------------------------------------------

@api_view(["GET", "POST"])
@permission_classes([IsAdminOrReadOnly])
def category_list(request):
    db = get_db()

    if request.method == "GET":
        # Only active categories are shown to customers
        categories = db.categories.find({"is_active": True}).sort("name", 1)
        return Response([category_to_json(category) for category in categories])

    # POST: create a category (admin only, checked by IsAdminOrReadOnly)
    if not isinstance(request.data, dict):
        return error_response("Send a JSON object.", status.HTTP_400_BAD_REQUEST)
    errors = {}
    category = read_text_fields(request.data, errors)
    if errors:
        return validation_error(errors)

    category["created_at"] = current_time()
    if db.categories.find_one({"name": category["name"]}):
        return error_response("A category with this name already exists.", status.HTTP_409_CONFLICT)
    try:
        category["_id"] = db.categories.insert_one(category).inserted_id
    except DuplicateKeyError:  # two requests at the same moment
        return error_response("A category with this name already exists.", status.HTTP_409_CONFLICT)
    return Response(category_to_json(category), status=status.HTTP_201_CREATED)


@api_view(["GET", "PUT", "DELETE"])
@permission_classes([IsAdminOrReadOnly])
def category_detail(request, category_id):
    db = get_db()

    object_id = to_object_id(category_id)
    if object_id is None:
        return error_response("Invalid category id.", status.HTTP_400_BAD_REQUEST)
    category = db.categories.find_one({"_id": object_id})
    if category is None:
        return error_response("Category not found.", status.HTTP_404_NOT_FOUND)

    if request.method == "GET":
        # Hide inactive categories from non-admin users
        if not category["is_active"] and not (request.user.is_authenticated and request.user.is_staff):
            return error_response("Category not found.", status.HTTP_404_NOT_FOUND)
        return Response(category_to_json(category))

    if request.method == "PUT":
        if not isinstance(request.data, dict):
            return error_response("Send a JSON object.", status.HTTP_400_BAD_REQUEST)
        errors = {}
        changes = read_text_fields(request.data, errors)
        if errors:
            return validation_error(errors)
        # The new name must not belong to a different category
        if db.categories.find_one({"name": changes["name"], "_id": {"$ne": object_id}}):
            return error_response("A category with this name already exists.", status.HTTP_409_CONFLICT)
        db.categories.update_one({"_id": object_id}, {"$set": changes})
        return Response(category_to_json(db.categories.find_one({"_id": object_id})))

    # DELETE: do not delete a category that still has products
    if db.products.count_documents({"category_id": object_id}) > 0:
        return error_response(
            "This category still has products. Move or delete them first.", status.HTTP_409_CONFLICT
        )
    db.categories.delete_one({"_id": object_id})
    return Response(status=status.HTTP_204_NO_CONTENT)


# ---------------------------------------------------------------------------
# Product APIs
# ---------------------------------------------------------------------------

def read_product_data(data, db):
    """Validate a product request body. Returns (cleaned_product, errors)."""
    errors = {}
    product = read_text_fields(data, errors, required_description=True)
    product["variants"] = read_variants(data.get("variants"), errors)

    if "state" in data:
        state = data["state"]
        if state is None:
            state = ""
        if not isinstance(state, str) or (state.strip() and state.strip() not in INDIAN_STATES):
            errors["state"] = "Choose a state from the list (or leave it empty)."
        else:
            product["state"] = state.strip()

    category_object_id = to_object_id(data.get("category_id"))
    if category_object_id is None:
        errors["category_id"] = "A valid category_id is required."
    elif db.categories.find_one({"_id": category_object_id}) is None:
        errors["category_id"] = "This category does not exist."
    else:
        product["category_id"] = category_object_id

    return product, errors


def can_buy(variant):
    """Same rule as the customer pages: the weight is available and still in stock."""
    return variant["is_available"] and variant["stock"] > 0


def lowest_price(product):
    """Starting price = the cheapest weight a customer can actually buy. None if nothing can be bought."""
    prices = [variant["price"] for variant in product["variants"] if can_buy(variant)]
    return min(prices) if prices else None


@api_view(["GET"])
def state_list(request):
    """The names the website can use in the state drop-downs."""
    return Response(INDIAN_STATES)


@api_view(["GET", "POST"])
@permission_classes([IsAdminOrReadOnly])
def product_list(request):
    db = get_db()

    if request.method == "POST":
        if not isinstance(request.data, dict):
            return error_response("Send a JSON object.", status.HTTP_400_BAD_REQUEST)
        product, errors = read_product_data(request.data, db)
        if errors:
            return validation_error(errors)
        product.setdefault("state", "")
        product["created_at"] = current_time()
        product["_id"] = db.products.insert_one(product).inserted_id
        return Response(product_to_json(product), status=status.HTTP_201_CREATED)

    # GET: list active products with optional search, filters and sorting
    params = request.query_params
    query = {"is_active": True}

    # ?search=kaju  -> name contains "kaju" (or category matches search)
    search_text = params.get("search", "").strip()
    if len(search_text) > 100:
        return error_response("search must be 100 characters or less.", status.HTTP_400_BAD_REQUEST)
    if search_text:
        matching_cats = [c["_id"] for c in db.categories.find({"name": {"$regex": re.escape(search_text), "$options": "i"}})]
        if matching_cats:
            query["$or"] = [
                {"name": {"$regex": re.escape(search_text), "$options": "i"}},
                {"category_id": {"$in": matching_cats}},
            ]
        else:
            query["name"] = {"$regex": re.escape(search_text), "$options": "i"}

    # ?category_id=<id> (single id or comma-separated ids)
    category_text = params.get("category_id")
    if category_text:
        parts = [p.strip() for p in category_text.split(",") if p.strip()]
        object_ids = [to_object_id(p) for p in parts]
        if not object_ids or any(oid is None for oid in object_ids):
            return error_response("Invalid category_id.", status.HTTP_400_BAD_REQUEST)
        if len(object_ids) == 1:
            query["category_id"] = object_ids[0]
        else:
            query["category_id"] = {"$in": object_ids}

    # ?state=Rajasthan -> only sweets from that state
    state_text = params.get("state", "").strip()
    if state_text:
        if state_text not in INDIAN_STATES:
            return error_response("Unknown state.", status.HTTP_400_BAD_REQUEST)
        query["state"] = state_text

    # ?min_price=200&max_price=600 -> at least one weight that can be bought must be inside the range.
    # The prices come from the variants saved in MongoDB, nothing from the browser is trusted as product data.
    price_range = {}
    for param_name, mongo_operator in (("min_price", "$gte"), ("max_price", "$lte")):
        if params.get(param_name):
            try:
                price = float(params[param_name])
            except ValueError:
                return error_response(f"{param_name} must be a number.", status.HTTP_400_BAD_REQUEST)
            if not math.isfinite(price) or price < 0:
                return error_response(f"{param_name} must be a number, 0 or more.", status.HTTP_400_BAD_REQUEST)
            price_range[mongo_operator] = price
    if "$gte" in price_range and "$lte" in price_range and price_range["$gte"] > price_range["$lte"]:
        return error_response("min_price cannot be more than max_price.", status.HTTP_400_BAD_REQUEST)
    if price_range:
        query["variants"] = {
            "$elemMatch": {"price": price_range, "is_available": True, "stock": {"$gt": 0}}
        }

    # ?sort=price_asc or ?sort=price_desc
    sort_option = params.get("sort", "")
    if sort_option not in ("", "price_asc", "price_desc"):
        return error_response("sort must be price_asc or price_desc.", status.HTTP_400_BAD_REQUEST)

    products = list(db.products.find(query).sort("created_at", -1))  # newest first by default
    if sort_option:
        # Sort by starting price. Products that cannot be bought right now always go to the end.
        direction = 1 if sort_option == "price_asc" else -1
        products.sort(key=lambda product: (lowest_price(product) is None, direction * (lowest_price(product) or 0)))

    return Response([product_to_json(product) for product in products])


@api_view(["GET", "PUT", "DELETE"])
@permission_classes([IsAdminOrReadOnly])
def product_detail(request, product_id):
    db = get_db()

    object_id = to_object_id(product_id)
    if object_id is None:
        return error_response("Invalid product id.", status.HTTP_400_BAD_REQUEST)
    product = db.products.find_one({"_id": object_id})
    if product is None:
        return error_response("Product not found.", status.HTTP_404_NOT_FOUND)

    if request.method == "GET":
        # Hide inactive products from non-admin users
        if not product["is_active"] and not (request.user.is_authenticated and request.user.is_staff):
            return error_response("Product not found.", status.HTTP_404_NOT_FOUND)
        return Response(product_to_json(product))

    if request.method == "PUT":
        if not isinstance(request.data, dict):
            return error_response("Send a JSON object.", status.HTTP_400_BAD_REQUEST)
        # A variant sent WITHOUT "stock" keeps its current stock (matched by weight). This way editing
        # a product's price or name can never overwrite stock that changed because of a new order.
        # Stock is changed on purpose through the admin stock API.
        current_stock = {variant["weight"]: variant["stock"] for variant in product["variants"]}
        if isinstance(request.data.get("variants"), list):
            for variant in request.data["variants"]:
                if isinstance(variant, dict) and "stock" not in variant and isinstance(variant.get("weight"), str):
                    if variant["weight"].strip() in current_stock:
                        variant["stock"] = current_stock[variant["weight"].strip()]

        changes, errors = read_product_data(request.data, db)
        if errors:
            return validation_error(errors)
        db.products.update_one({"_id": object_id}, {"$set": changes})
        return Response(product_to_json(db.products.find_one({"_id": object_id})))

    # DELETE
    db.products.delete_one({"_id": object_id})
    return Response(status=status.HTTP_204_NO_CONTENT)


@api_view(["GET"])
@authentication_classes([])
@permission_classes([AllowAny])
def image_file(request, image_id):
    """Public: show an image that an admin uploaded into the database."""
    found = read_image_from_db(image_id)
    if found is None:
        return error_response("Image not found.", status.HTTP_404_NOT_FOUND)
    content_type, data = found
    response = HttpResponse(data, content_type=content_type)
    response["Cache-Control"] = "public, max-age=86400"
    response["X-Content-Type-Options"] = "nosniff"
    return response
