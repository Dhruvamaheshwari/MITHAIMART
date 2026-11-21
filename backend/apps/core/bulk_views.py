"""Bulk Orders & Wholesale Pricing calculation, catalog and cart APIs."""

import uuid
from bson import ObjectId
from rest_framework import status
from rest_framework.decorators import api_view, authentication_classes, permission_classes
from rest_framework.permissions import IsAdminUser
from rest_framework.response import Response

from apps.accounts.customer_auth import get_owner
from apps.cart.views import cart_to_json, save_items
from apps.core.hamper_views import parse_weight_to_grams
from apps.products.views import current_time, error_response, to_object_id
from config.mongodb import get_db


DEFAULT_BULK_RULES = {
    "key": "global_bulk_rules",
    "is_active": True,
    "min_bulk_kg": 5.0,
    "instant_order_max_kg": 50.0,
    "quotation_threshold_kg": 50.0,
    "slabs": [
        {"min_kg": 5.0, "max_kg": 9.99, "discount_percentage": 5.0, "label": "5 – 9 kg"},
        {"min_kg": 10.0, "max_kg": 24.99, "discount_percentage": 8.0, "label": "10 – 24 kg"},
        {"min_kg": 25.0, "max_kg": 49.99, "discount_percentage": 12.0, "label": "25 – 49 kg"},
        {"min_kg": 50.0, "max_kg": None, "discount_percentage": 15.0, "label": "50+ kg"},
    ],
}


def get_bulk_rules(db):
    rules = db.bulk_pricing_rules.find_one({"key": "global_bulk_rules"})
    if not rules:
        return DEFAULT_BULK_RULES
    return rules


def calculate_item_bulk_discount(grams_per_unit, quantity, unit_price, rules):
    """Calculate product-wise quantity slab discount.
    Each product gets a discount based on its own eligible weight in kg.
    """
    total_weight_kg = round((grams_per_unit * quantity) / 1000.0, 3)
    normal_total = round(float(unit_price) * quantity, 2)
    discount_percentage = 0.0

    if rules.get("is_active", True):
        slabs = rules.get("slabs", [])
        for slab in slabs:
            min_k = float(slab["min_kg"])
            max_k = float(slab["max_kg"]) if slab.get("max_kg") is not None else None
            if total_weight_kg >= min_k:
                if max_k is None or total_weight_kg <= max_k:
                    discount_percentage = float(slab["discount_percentage"])
                    break

    discount_amount = round(normal_total * (discount_percentage / 100.0), 2)
    discounted_total = round(normal_total - discount_amount, 2)

    return {
        "total_weight_kg": total_weight_kg,
        "normal_total": normal_total,
        "discount_percentage": discount_percentage,
        "discount_amount": discount_amount,
        "discounted_total": discounted_total,
    }


# ---------------------------------------------------------------------------
# Public Bulk APIs
# ---------------------------------------------------------------------------

@api_view(["GET"])
@authentication_classes([])
def bulk_rules_view(request):
    """Return the active bulk discount rules and slabs for the frontend to display."""
    db = get_db()
    rules = get_bulk_rules(db)
    return Response({
        "is_active": rules.get("is_active", True),
        "min_bulk_kg": float(rules.get("min_bulk_kg", 5.0)),
        "instant_order_max_kg": float(rules.get("instant_order_max_kg", 50.0)),
        "quotation_threshold_kg": float(rules.get("quotation_threshold_kg", 50.0)),
        "slabs": rules.get("slabs", []),
    })


@api_view(["GET"])
@authentication_classes([])
def bulk_products_list(request):
    """Return all active sweets with available variants suitable for bulk orders."""
    db = get_db()
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

        available_products.append({
            "id": str(p["_id"]),
            "name": p.get("name", ""),
            "description": p.get("description", ""),
            "category_name": category_map.get(p.get("category_id"), ""),
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

    rules = get_bulk_rules(db)
    return Response({
        "products": available_products,
        "rules": {
            "min_bulk_kg": float(rules.get("min_bulk_kg", 5.0)),
            "instant_order_max_kg": float(rules.get("instant_order_max_kg", 50.0)),
            "quotation_threshold_kg": float(rules.get("quotation_threshold_kg", 50.0)),
            "slabs": rules.get("slabs", []),
        },
    })


@api_view(["POST"])
@authentication_classes([])
def bulk_estimate(request):
    """Calculate live bulk pricing breakdown on the backend.
    Never trust prices or discounts sent by the frontend.
    """
    data = request.data or {}
    raw_items = data.get("items", [])

    if not isinstance(raw_items, list):
        return error_response("Items must be a list.", status.HTTP_400_BAD_REQUEST)

    db = get_db()
    rules = get_bulk_rules(db)

    breakdown = []
    total_original_price = 0.0
    total_discount_amount = 0.0
    total_final_price = 0.0
    total_order_kg = 0.0
    warnings = []

    for item in raw_items:
        p_id = to_object_id(item.get("product_id"))
        weight = str(item.get("variant_weight", "")).strip()
        quantity = item.get("quantity", 1)

        if not p_id or not weight or not isinstance(quantity, int) or quantity < 1:
            continue

        product = db.products.find_one({"_id": p_id, "is_active": True})
        if not product:
            warnings.append("A selected product is no longer available.")
            continue

        variant = next((v for v in product.get("variants", []) if v["weight"] == weight), None)
        if not variant or not variant.get("is_available", True):
            warnings.append(f"{product['name']} ({weight}) is currently unavailable.")
            continue

        unit_price = float(variant["price"])
        stock = int(variant.get("stock", 0))
        grams = parse_weight_to_grams(weight)

        calc = calculate_item_bulk_discount(grams, quantity, unit_price, rules)

        if quantity > stock:
            warnings.append(
                f"{product['name']} ({weight}) requested {quantity}, but only {stock} available in kitchen stock."
            )

        total_original_price += calc["normal_total"]
        total_discount_amount += calc["discount_amount"]
        total_final_price += calc["discounted_total"]
        total_order_kg += calc["total_weight_kg"]

        breakdown.append({
            "product_id": str(product["_id"]),
            "product_name": product["name"],
            "product_image": product.get("image_url", ""),
            "variant_weight": weight,
            "quantity": quantity,
            "unit_price": unit_price,
            "total_weight_kg": calc["total_weight_kg"],
            "normal_total": calc["normal_total"],
            "discount_percentage": calc["discount_percentage"],
            "discount_amount": calc["discount_amount"],
            "discounted_total": calc["discounted_total"],
            "stock": stock,
            "is_stock_sufficient": quantity <= stock,
        })

    instant_max = float(rules.get("instant_order_max_kg", 50.0))
    quote_thresh = float(rules.get("quotation_threshold_kg", 50.0))
    is_eligible_for_instant = total_order_kg <= instant_max and len(breakdown) > 0
    requires_quotation = total_order_kg > quote_thresh

    return Response({
        "items": breakdown,
        "items_count": len(breakdown),
        "total_units": sum(i["quantity"] for i in breakdown),
        "total_weight_kg": round(total_order_kg, 2),
        "original_total": round(total_original_price, 2),
        "total_bulk_discount": round(total_discount_amount, 2),
        "final_estimated_total": round(total_final_price, 2),
        "instant_order_max_kg": instant_max,
        "is_eligible_for_instant_order": is_eligible_for_instant,
        "requires_quotation": requires_quotation,
        "warnings": warnings,
    })


@api_view(["POST"])
@authentication_classes([])
def bulk_cart_add(request):
    """Add validated bulk order items to customer's cart.
    If total order weight exceeds instant order limit, reject with instructions to request a quotation.
    """
    owner_id, error = get_owner(request)
    if error:
        return error

    data = request.data or {}
    raw_items = data.get("items", [])

    if not isinstance(raw_items, list) or len(raw_items) == 0:
        return error_response("Please select at least one sweet for your bulk order.", status.HTTP_400_BAD_REQUEST)

    db = get_db()
    rules = get_bulk_rules(db)
    instant_max = float(rules.get("instant_order_max_kg", 50.0))

    bulk_items_to_add = []
    total_order_kg = 0.0

    cart = db.carts.find_one({"owner_id": owner_id})
    items = cart["items"] if cart else []

    existing_bulk_weight = 0.0
    for existing in items:
        if not isinstance(existing, dict) or not existing.get("is_bulk"):
            continue
        existing_weight = parse_weight_to_grams(str(existing.get("variant_weight", "")))
        existing_quantity = existing.get("quantity", 0)
        if isinstance(existing_quantity, int) and existing_quantity > 0:
            existing_bulk_weight += (existing_weight * existing_quantity) / 1000.0

    for item in raw_items:
        p_id = to_object_id(item.get("product_id"))
        weight = str(item.get("variant_weight", "")).strip()
        quantity = item.get("quantity", 1)

        if not p_id or not weight or not isinstance(quantity, int) or quantity < 1:
            return error_response("Invalid sweet or quantity selection.", status.HTTP_400_BAD_REQUEST)

        product = db.products.find_one({"_id": p_id, "is_active": True})
        if not product:
            return error_response("A selected sweet is no longer active.", status.HTTP_404_NOT_FOUND)

        variant = next((v for v in product.get("variants", []) if v["weight"] == weight), None)
        if not variant or not variant.get("is_available", True):
            return error_response(f"{product['name']} ({weight}) is unavailable.", status.HTTP_409_CONFLICT)

        if quantity > int(variant.get("stock", 0)):
            return error_response(
                f"Only {variant.get('stock')} available for {product['name']} ({weight}).",
                status.HTTP_409_CONFLICT
            )

        unit_price = float(variant["price"])
        grams = parse_weight_to_grams(weight)
        calc = calculate_item_bulk_discount(grams, quantity, unit_price, rules)
        total_order_kg += calc["total_weight_kg"]

        pending_bulk = next((
            pending for pending in bulk_items_to_add
            if str(pending.get("product_id")) == str(product["_id"])
            and pending.get("variant_weight") == weight
        ), None)
        existing_bulk = next((
            existing for existing in items
            if isinstance(existing, dict)
            and existing.get("is_bulk")
            and str(existing.get("product_id")) == str(product["_id"])
            and existing.get("variant_weight") == weight
        ), None)
        combined_quantity = (
            quantity
            + (pending_bulk.get("quantity", 0) if pending_bulk else 0)
            + (existing_bulk.get("quantity", 0) if existing_bulk else 0)
        )
        if combined_quantity > int(variant.get("stock", 0)):
            return error_response(
                f"Only {variant.get('stock')} available for {product['name']} ({weight}).",
                status.HTTP_409_CONFLICT
            )

        bulk_items_to_add.append({
            "is_bulk": True,
            "bulk_id": str(uuid.uuid4()),
            "product_id": product["_id"],
            "product_name": product["name"],
            "product_image": product.get("image_url", ""),
            "variant_weight": weight,
            "quantity": quantity,
            "unit_price": unit_price,
            "normal_total": calc["normal_total"],
            "discount_percentage": calc["discount_percentage"],
            "discount_amount": calc["discount_amount"],
            "item_total": calc["discounted_total"],
            "total_weight_kg": calc["total_weight_kg"],
            "created_at": current_time(),
        })

    combined_bulk_weight = existing_bulk_weight + total_order_kg
    if combined_bulk_weight > instant_max:
        return error_response(
            f"Bulk order total weight is {round(combined_bulk_weight, 1)} kg, which exceeds the instant online limit of {instant_max} kg. Please use 'Request Wholesale Quotation' to get a customized commercial quote.",
            status.HTTP_400_BAD_REQUEST
        )

    for bulk_item in bulk_items_to_add:
        existing_bulk = next((
            existing for existing in items
            if isinstance(existing, dict)
            and existing.get("is_bulk")
            and str(existing.get("product_id")) == str(bulk_item["product_id"])
            and existing.get("variant_weight") == bulk_item["variant_weight"]
        ), None)
        if existing_bulk:
            existing_bulk["quantity"] = existing_bulk.get("quantity", 0) + bulk_item["quantity"]
            existing_bulk["unit_price"] = bulk_item["unit_price"]
            existing_bulk["normal_total"] = round(
                bulk_item["unit_price"] * existing_bulk["quantity"], 2
            )
            rules_calc = calculate_item_bulk_discount(
                parse_weight_to_grams(bulk_item["variant_weight"]),
                existing_bulk["quantity"],
                bulk_item["unit_price"],
                rules,
            )
            existing_bulk.update({
                "normal_total": rules_calc["normal_total"],
                "discount_percentage": rules_calc["discount_percentage"],
                "discount_amount": rules_calc["discount_amount"],
                "item_total": rules_calc["discounted_total"],
                "total_weight_kg": rules_calc["total_weight_kg"],
            })
        else:
            items.append(bulk_item)
    save_items(db, owner_id, items)

    return Response(cart_to_json(db, {"items": items}), status=status.HTTP_201_CREATED)


# ---------------------------------------------------------------------------
# Admin Bulk Pricing Settings API
# ---------------------------------------------------------------------------

@api_view(["GET", "POST"])
@permission_classes([IsAdminUser])
def admin_bulk_settings(request):
    """View and update bulk pricing rules, quantity slabs, and quotation thresholds."""
    db = get_db()
    if request.method == "GET":
        rules = get_bulk_rules(db)
        return Response({
            "is_active": rules.get("is_active", True),
            "min_bulk_kg": float(rules.get("min_bulk_kg", 5.0)),
            "instant_order_max_kg": float(rules.get("instant_order_max_kg", 50.0)),
            "quotation_threshold_kg": float(rules.get("quotation_threshold_kg", 50.0)),
            "slabs": rules.get("slabs", []),
        })

    data = request.data or {}
    slabs = data.get("slabs")
    if not isinstance(slabs, list) or len(slabs) == 0:
        return error_response("At least one bulk discount slab is required.", status.HTTP_400_BAD_REQUEST)

    cleaned_slabs = []
    for s in slabs:
        try:
            min_k = float(s["min_kg"])
            max_k = float(s["max_kg"]) if s.get("max_kg") is not None and s.get("max_kg") != "" else None
            disc = float(s["discount_percentage"])
            if min_k < 0 or (max_k is not None and max_k < min_k) or disc < 0 or disc > 100:
                return error_response("Invalid slab values. Discount must be 0-100% and weights non-negative.", status.HTTP_400_BAD_REQUEST)
            cleaned_slabs.append({
                "min_kg": min_k,
                "max_kg": max_k,
                "discount_percentage": disc,
                "label": s.get("label", f"{min_k}kg+ ({disc}%)"),
            })
        except (ValueError, KeyError, TypeError):
            return error_response("Invalid slab structure.", status.HTTP_400_BAD_REQUEST)

    update_doc = {
        "is_active": bool(data.get("is_active", True)),
        "min_bulk_kg": float(data.get("min_bulk_kg", 5.0)),
        "instant_order_max_kg": float(data.get("instant_order_max_kg", 50.0)),
        "quotation_threshold_kg": float(data.get("quotation_threshold_kg", 50.0)),
        "slabs": cleaned_slabs,
        "updated_at": current_time(),
    }

    db.bulk_pricing_rules.update_one(
        {"key": "global_bulk_rules"},
        {"$set": update_doc},
        upsert=True
    )
    return Response({"message": "Bulk pricing rules updated successfully.", "rules": update_doc})
