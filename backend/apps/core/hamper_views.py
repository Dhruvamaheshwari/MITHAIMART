"""Hamper management APIs for 'Build Your Own Mithai Hamper'."""

import re
import uuid
from datetime import datetime, timezone
from bson import ObjectId
from rest_framework import status
from rest_framework.decorators import api_view, authentication_classes, permission_classes
from rest_framework.permissions import AllowAny, IsAdminUser
from rest_framework.response import Response

from apps.accounts.customer_auth import get_owner
from apps.cart.views import cart_to_json, save_items
from apps.products.views import current_time, error_response, to_object_id
from config.mongodb import get_db


def parse_weight_to_grams(weight_str):
    """Convert weight string like '250g', '500 gms', '1kg' into integer grams."""
    if not weight_str:
        return 250
    w = str(weight_str).lower().strip()
    match_kg = re.search(r"([\d.]+)\s*(?:kg|kilo)", w)
    if match_kg:
        try:
            return int(float(match_kg.group(1)) * 1000)
        except ValueError:
            pass
    match_g = re.search(r"(\d+)\s*(?:g|gm|gms|gram|grams)", w)
    if match_g:
        try:
            return int(match_g.group(1))
        except ValueError:
            pass
    digits = re.search(r"(\d+)", w)
    if digits:
        val = int(digits.group(1))
        return val if val >= 50 else val * 100
    return 250


def box_to_json(box):
    return {
        "id": str(box["_id"]),
        "code": box.get("code", ""),
        "name": box.get("name", ""),
        "size_label": box.get("size_label", ""),
        "description": box.get("description", ""),
        "max_capacity_grams": int(box.get("max_capacity_grams", 1000)),
        "packaging_price": float(box.get("packaging_price", 0.0)),
        "image_url": box.get("image_url", ""),
        "is_active": box.get("is_active", True),
        "sort_order": box.get("sort_order", 0),
    }


def get_hamper_settings(db):
    settings = db.hamper_settings.find_one({"key": "global_settings"})
    if not settings:
        return {
            "min_order_amount_for_coupon": 1000.0,
            "coupon_discount_type": "percentage",
            "coupon_discount_value": 10.0,
            "coupon_min_order_amount": 500.0,
            "coupon_max_discount": 500.0,
            "coupon_validity_days": 30,
            "gift_wrap_price": 50.0,
        }
    return settings


# ---------------------------------------------------------------------------
# Public Hamper APIs
# ---------------------------------------------------------------------------

@api_view(["GET"])
@authentication_classes([])
def hamper_boxes_list(request):
    """Return all active gift boxes sorted by sort_order."""
    db = get_db()
    boxes = list(db.gift_boxes.find({"is_active": True}).sort("sort_order", 1))
    settings = get_hamper_settings(db)
    return Response({
        "boxes": [box_to_json(b) for b in boxes],
        "gift_wrap_price": float(settings.get("gift_wrap_price", 50.0)),
        "min_order_amount_for_coupon": float(settings.get("min_order_amount_for_coupon", 1000.0)),
        "coupon_discount_value": float(settings.get("coupon_discount_value", 10.0)),
    })


@api_view(["GET"])
@authentication_classes([])
def hamper_products_list(request):
    """Return products available for hamper building (active products with active variants and stock)."""
    db = get_db()
    # Find category IDs that represent Sweets or Chocolates or Snacks
    categories = list(db.categories.find({"is_active": True}))
    category_map = {c["_id"]: c["name"] for c in categories}

    products = list(db.products.find({"is_active": True}))
    available_products = []

    for p in products:
        active_variants = [
            v for v in p.get("variants", [])
            if v.get("is_available", True) and v.get("stock", 0) > 0
        ]
        if not active_variants:
            continue

        cat_name = category_map.get(p.get("category_id"), "")
        available_products.append({
            "id": str(p["_id"]),
            "name": p.get("name", ""),
            "description": p.get("description", ""),
            "category_name": cat_name,
            "image_url": p.get("image_url", ""),
            "state": p.get("state", ""),
            "variants": [
                {
                    "weight": v["weight"],
                    "price": float(v["price"]),
                    "stock": int(v["stock"]),
                    "grams": parse_weight_to_grams(v["weight"]),
                }
                for v in active_variants
            ],
        })

    return Response({"products": available_products})


@api_view(["POST"])
@authentication_classes([])
def hamper_estimate(request):
    """Calculate live price and box capacity validation on the backend.
    Never trust prices or totals from the client.
    """
    data = request.data or {}
    box_id = data.get("box_id")
    raw_items = data.get("items", [])
    gift_wrap = bool(data.get("gift_wrap", False))

    db = get_db()
    box_obj_id = to_object_id(box_id)
    if not box_obj_id:
        return error_response("Please select a valid gift box.", status.HTTP_400_BAD_REQUEST)

    box = db.gift_boxes.find_one({"_id": box_obj_id, "is_active": True})
    if not box:
        return error_response("Selected gift box is not available.", status.HTTP_404_NOT_FOUND)

    packaging_price = float(box.get("packaging_price", 0.0))
    max_capacity_grams = int(box.get("max_capacity_grams", 1000))
    settings = get_hamper_settings(db)
    gift_wrap_price = float(settings.get("gift_wrap_price", 50.0)) if gift_wrap else 0.0

    if not isinstance(raw_items, list):
        return error_response("Items must be a list.", status.HTTP_400_BAD_REQUEST)

    sweets_breakdown = []
    total_sweets_price = 0.0
    total_grams = 0
    warnings = []

    for item in raw_items:
        p_id = to_object_id(item.get("product_id"))
        weight = str(item.get("variant_weight", "")).strip()
        quantity = item.get("quantity", 1)

        if not p_id or not weight or not isinstance(quantity, int) or quantity < 1:
            continue

        product = db.products.find_one({"_id": p_id, "is_active": True})
        if not product:
            warnings.append(f"A selected sweet is no longer available.")
            continue

        variant = next((v for v in product.get("variants", []) if v["weight"] == weight), None)
        if not variant or not variant.get("is_available", True):
            warnings.append(f"{product['name']} ({weight}) is unavailable.")
            continue

        available_stock = int(variant.get("stock", 0))
        if quantity > available_stock:
            warnings.append(f"{product['name']} ({weight}) only has {available_stock} in stock.")

        unit_price = float(variant["price"])
        item_total = round(unit_price * quantity, 2)
        total_sweets_price += item_total

        grams_per_unit = parse_weight_to_grams(weight)
        item_grams = grams_per_unit * quantity
        total_grams += item_grams

        sweets_breakdown.append({
            "product_id": str(product["_id"]),
            "product_name": product["name"],
            "product_image": product.get("image_url", ""),
            "variant_weight": weight,
            "quantity": quantity,
            "unit_price": unit_price,
            "item_total": item_total,
            "grams_per_unit": grams_per_unit,
            "total_grams": item_grams,
            "stock": available_stock,
            "is_stock_sufficient": quantity <= available_stock,
        })

    is_capacity_exceeded = total_grams > max_capacity_grams
    capacity_percentage = min(100.0, round((total_grams / max_capacity_grams) * 100, 1)) if max_capacity_grams else 0.0
    total_hamper_price = round(total_sweets_price + packaging_price + gift_wrap_price, 2)

    qualifies_for_coupon = total_hamper_price >= float(settings.get("min_order_amount_for_coupon", 1000.0))

    return Response({
        "box": box_to_json(box),
        "sweets": sweets_breakdown,
        "sweets_count": sum(item["quantity"] for item in sweets_breakdown),
        "sweets_subtotal": round(total_sweets_price, 2),
        "packaging_price": packaging_price,
        "gift_wrap": gift_wrap,
        "gift_wrap_price": gift_wrap_price,
        "total_estimated_price": total_hamper_price,
        "capacity": {
            "used_grams": total_grams,
            "max_grams": max_capacity_grams,
            "remaining_grams": max(0, max_capacity_grams - total_grams),
            "percentage": capacity_percentage,
            "is_valid": total_grams <= max_capacity_grams and len(sweets_breakdown) > 0,
            "is_exceeded": is_capacity_exceeded,
        },
        "qualifies_for_coupon": qualifies_for_coupon,
        "coupon_threshold": float(settings.get("min_order_amount_for_coupon", 1000.0)),
        "warnings": warnings,
    })


@api_view(["POST"])
@authentication_classes([])
def hamper_cart_add(request):
    """Add a validated custom hamper to the customer's cart."""
    owner_id, error = get_owner(request)
    if error:
        return error

    data = request.data or {}
    box_id = data.get("box_id")
    raw_items = data.get("items", [])
    customization = data.get("customization", {})
    gift_wrap = bool(customization.get("gift_wrap", False))

    if not isinstance(raw_items, list) or len(raw_items) == 0:
        return error_response("Please select at least one sweet for your hamper.", status.HTTP_400_BAD_REQUEST)

    db = get_db()
    box_obj_id = to_object_id(box_id)
    if not box_obj_id:
        return error_response("Please select a valid gift box.", status.HTTP_400_BAD_REQUEST)

    box = db.gift_boxes.find_one({"_id": box_obj_id, "is_active": True})
    if not box:
        return error_response("Selected gift box is not available.", status.HTTP_404_NOT_FOUND)

    max_capacity_grams = int(box.get("max_capacity_grams", 1000))
    packaging_price = float(box.get("packaging_price", 0.0))
    settings = get_hamper_settings(db)
    gift_wrap_price = float(settings.get("gift_wrap_price", 50.0)) if gift_wrap else 0.0

    sweets_list = []
    total_sweets_price = 0.0
    total_grams = 0

    for item in raw_items:
        p_id = to_object_id(item.get("product_id"))
        weight = str(item.get("variant_weight", "")).strip()
        quantity = item.get("quantity", 1)

        if not p_id or not weight or not isinstance(quantity, int) or quantity < 1:
            return error_response("Invalid sweet selection or quantity.", status.HTTP_400_BAD_REQUEST)

        product = db.products.find_one({"_id": p_id, "is_active": True})
        if not product:
            return error_response("One of the selected sweets is no longer active.", status.HTTP_404_NOT_FOUND)

        variant = next((v for v in product.get("variants", []) if v["weight"] == weight), None)
        if not variant or not variant.get("is_available", True):
            return error_response(f"{product['name']} ({weight}) is unavailable.", status.HTTP_409_CONFLICT)

        if quantity > int(variant.get("stock", 0)):
            return error_response(
                f"Only {variant.get('stock')} available for {product['name']} ({weight}).",
                status.HTTP_409_CONFLICT
            )

        unit_price = float(variant["price"])
        item_total = round(unit_price * quantity, 2)
        total_sweets_price += item_total

        grams = parse_weight_to_grams(weight) * quantity
        total_grams += grams

        sweets_list.append({
            "product_id": product["_id"],
            "product_name": product["name"],
            "product_image": product.get("image_url", ""),
            "variant_weight": weight,
            "quantity": quantity,
            "unit_price": unit_price,
            "item_total": item_total,
            "grams": grams,
        })

    # Capacity validation
    if total_grams > max_capacity_grams:
        return error_response(
            f"Box capacity exceeded! Selected sweets weigh {total_grams}g, but the box maximum is {max_capacity_grams}g. Please remove items or choose a larger box.",
            status.HTTP_400_BAD_REQUEST
        )

    greeting_msg = str(customization.get("greeting_message", "")).strip()[:250]
    recipient_name = str(customization.get("recipient_name", "")).strip()[:100]
    sender_name = str(customization.get("sender_name", "")).strip()[:100]

    hamper_total = round(total_sweets_price + packaging_price + gift_wrap_price, 2)

    hamper_item = {
        "is_hamper": True,
        "hamper_id": str(uuid.uuid4()),
        "box_id": box["_id"],
        "box_name": box["name"],
        "box_size": box.get("size_label", box["name"]),
        "box_image": box.get("image_url", ""),
        "packaging_price": packaging_price,
        "items": sweets_list,
        "customization": {
            "recipient_name": recipient_name,
            "sender_name": sender_name,
            "greeting_message": greeting_msg,
            "gift_wrap": gift_wrap,
        },
        "gift_wrap_price": gift_wrap_price,
        "total_grams": total_grams,
        "quantity": 1,
        "item_total": hamper_total,
        "created_at": current_time(),
    }

    cart = db.carts.find_one({"owner_id": owner_id})
    items = cart["items"] if cart else []
    items.append(hamper_item)

    save_items(db, owner_id, items)
    return Response(cart_to_json(db, {"items": items}), status=status.HTTP_201_CREATED)


@api_view(["DELETE"])
@authentication_classes([])
def hamper_cart_remove(request, hamper_id):
    """Remove a custom hamper item from the customer's cart."""
    owner_id, error = get_owner(request)
    if error:
        return error

    db = get_db()
    cart = db.carts.find_one({"owner_id": owner_id})
    items = cart["items"] if cart else []

    updated_items = [
        item for item in items
        if not (item.get("is_hamper") and str(item.get("hamper_id")) == str(hamper_id))
    ]

    if len(updated_items) == len(items):
        return error_response("Hamper not found in cart.", status.HTTP_404_NOT_FOUND)

    save_items(db, owner_id, updated_items)
    return Response(cart_to_json(db, {"items": updated_items}))


# ---------------------------------------------------------------------------
# Admin Hamper Settings API
# ---------------------------------------------------------------------------

@api_view(["GET", "POST"])
@permission_classes([IsAdminUser])
def admin_hamper_settings(request):
    """View and update hamper box configurations and coupon threshold settings."""
    db = get_db()
    if request.method == "GET":
        boxes = list(db.gift_boxes.find().sort("sort_order", 1))
        settings = get_hamper_settings(db)
        return Response({
            "boxes": [box_to_json(b) for b in boxes],
            "settings": {
                "min_order_amount_for_coupon": float(settings.get("min_order_amount_for_coupon", 1000.0)),
                "coupon_discount_type": settings.get("coupon_discount_type", "percentage"),
                "coupon_discount_value": float(settings.get("coupon_discount_value", 10.0)),
                "coupon_min_order_amount": float(settings.get("coupon_min_order_amount", 500.0)),
                "coupon_max_discount": float(settings.get("coupon_max_discount", 500.0)),
                "coupon_validity_days": int(settings.get("coupon_validity_days", 30)),
                "gift_wrap_price": float(settings.get("gift_wrap_price", 50.0)),
            }
        })

    data = request.data or {}
    settings_update = {}
    for key in [
        "min_order_amount_for_coupon", "coupon_discount_type",
        "coupon_discount_value", "coupon_min_order_amount",
        "coupon_max_discount", "coupon_validity_days", "gift_wrap_price"
    ]:
        if key in data:
            settings_update[key] = data[key]

    if settings_update:
        settings_update["updated_at"] = current_time()
        db.hamper_settings.update_one(
            {"key": "global_settings"},
            {"$set": settings_update},
            upsert=True
        )

    # If boxes update sent
    boxes_data = data.get("boxes")
    if isinstance(boxes_data, list):
        for b in boxes_data:
            box_id = to_object_id(b.get("id"))
            if box_id:
                db.gift_boxes.update_one(
                    {"_id": box_id},
                    {"$set": {
                        "name": b.get("name"),
                        "size_label": b.get("size_label"),
                        "description": b.get("description"),
                        "max_capacity_grams": int(b.get("max_capacity_grams", 1000)),
                        "packaging_price": float(b.get("packaging_price", 0.0)),
                        "is_active": bool(b.get("is_active", True)),
                        "updated_at": current_time(),
                    }}
                )

    return Response({"message": "Hamper settings updated successfully."})
