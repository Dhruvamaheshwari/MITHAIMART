"""Category and Product APIs. Data lives in MongoDB (no Django models used)."""

import re
from datetime import datetime, timezone

from bson import ObjectId
from bson.errors import InvalidId
from pymongo.errors import DuplicateKeyError
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import SAFE_METHODS, BasePermission
from rest_framework.response import Response

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
        "variants": product["variants"],
        "created_at": product["created_at"].isoformat(),
    }


def is_number(value):
    # bool is a subclass of int in Python, so True/False must be rejected separately
    return isinstance(value, (int, float)) and not isinstance(value, bool)


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
    if not isinstance(image_url, str) or (image_url and not image_url.startswith(("http://", "https://"))):
        errors["image_url"] = "Image URL must start with http:// or https://."
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

    category_object_id = to_object_id(data.get("category_id"))
    if category_object_id is None:
        errors["category_id"] = "A valid category_id is required."
    elif db.categories.find_one({"_id": category_object_id}) is None:
        errors["category_id"] = "This category does not exist."
    else:
        product["category_id"] = category_object_id

    return product, errors


def lowest_price(product):
    """Starting price of a product (its cheapest variant). Used for price sorting."""
    prices = [variant["price"] for variant in product["variants"]]
    return min(prices) if prices else float("inf")


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
        product["created_at"] = current_time()
        product["_id"] = db.products.insert_one(product).inserted_id
        return Response(product_to_json(product), status=status.HTTP_201_CREATED)

    # GET: list active products with optional search, filters and sorting
    params = request.query_params
    query = {"is_active": True}

    # ?search=kaju  -> name contains "kaju" (not case sensitive)
    search_text = params.get("search", "").strip()
    if search_text:
        query["name"] = {"$regex": re.escape(search_text), "$options": "i"}

    # ?category_id=<id>
    category_text = params.get("category_id")
    if category_text:
        category_object_id = to_object_id(category_text)
        if category_object_id is None:
            return error_response("Invalid category_id.", status.HTTP_400_BAD_REQUEST)
        query["category_id"] = category_object_id

    # ?min_price=200&max_price=600 -> at least one variant must fall inside the price range
    price_range = {}
    for param_name, mongo_operator in (("min_price", "$gte"), ("max_price", "$lte")):
        if params.get(param_name):
            try:
                price_range[mongo_operator] = float(params[param_name])
            except ValueError:
                return error_response(f"{param_name} must be a number.", status.HTTP_400_BAD_REQUEST)
    if price_range:
        query["variants"] = {"$elemMatch": {"price": price_range}}

    # ?sort=price_asc or ?sort=price_desc
    sort_option = params.get("sort", "")
    if sort_option not in ("", "price_asc", "price_desc"):
        return error_response("sort must be price_asc or price_desc.", status.HTTP_400_BAD_REQUEST)

    products = list(db.products.find(query).sort("created_at", -1))  # newest first by default
    if sort_option:
        products.sort(key=lowest_price, reverse=(sort_option == "price_desc"))

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
        changes, errors = read_product_data(request.data, db)
        if errors:
            return validation_error(errors)
        db.products.update_one({"_id": object_id}, {"$set": changes})
        return Response(product_to_json(db.products.find_one({"_id": object_id})))

    # DELETE
    db.products.delete_one({"_id": object_id})
    return Response(status=status.HTTP_204_NO_CONTENT)
