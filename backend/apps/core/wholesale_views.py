"""Wholesale quotation request management, admin review, and customer acceptance into orders."""

import secrets
from datetime import datetime, timedelta, timezone
from bson import ObjectId
from rest_framework import status
from rest_framework.decorators import api_view, authentication_classes, permission_classes
from rest_framework.permissions import IsAdminUser
from rest_framework.response import Response

from apps.accounts.customer_auth import get_owner, require_login
from apps.accounts.views import address_to_json
from apps.core.hamper_views import parse_weight_to_grams
from apps.orders.views import ADDRESS_FIELDS, make_order_number, reserve_stock, restore_stock
from apps.products.views import current_time, error_response, to_object_id
from config.mongodb import get_db

WHOLESALE_STATUSES = [
    "Pending",
    "Under Review",
    "Quotation Sent",
    "Accepted",
    "Rejected",
    "Expired",
    "Converted to Order",
]


def make_wholesale_request_id():
    """Example: WR-20261118-7K3Q. Guarantees clean customer-facing reference codes."""
    letters = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
    random_part = "".join(secrets.choice(letters) for _ in range(4))
    return f"WR-{current_time().strftime('%Y%m%d')}-{random_part}"


def wholesale_to_json(req, is_admin=False):
    now = current_time()
    expires_at = req.get("quotation_expires_at")
    req_status = req.get("status", "Pending")

    # If quotation expired and not yet accepted, label as Expired dynamically
    if req_status == "Quotation Sent" and expires_at and expires_at < now:
        req_status = "Expired"

    estimated_normal = float(req.get("estimated_normal_total", 0.0))
    quoted_price = float(req["quoted_price"]) if req.get("quoted_price") is not None else None
    estimated_total = quoted_price if quoted_price is not None else estimated_normal
    estimated_discount = max(0.0, round(estimated_normal - estimated_total, 2)) if quoted_price is not None else 0.0

    data = {
        "id": str(req["_id"]),
        "request_id": req.get("request_id", ""),
        "customer_name": req.get("customer_name", ""),
        "phone": req.get("phone", ""),
        "email": req.get("email", ""),
        "business_name": req.get("business_name", ""),
        "selected_items": req.get("selected_items", []),
        "items": req.get("selected_items", []),
        "total_weight_kg": float(req.get("total_weight_kg", 0.0)),
        "total_kg": float(req.get("total_weight_kg", 0.0)),
        "estimated_normal_total": estimated_normal,
        "estimated_original": estimated_normal,
        "estimated_discount": estimated_discount,
        "estimated_total": estimated_total,
        "preferred_delivery_date": req.get("preferred_delivery_date", ""),
        "delivery_city": req.get("delivery_city", ""),
        "delivery_pincode": req.get("delivery_pincode", ""),
        "delivery_state": req.get("delivery_state", ""),
        "additional_notes": req.get("additional_notes", ""),
        "status": req_status,
        "quoted_price": quoted_price,
        "quoted_total_price": quoted_price,
        "quotation_notes": req.get("quotation_notes", ""),
        "quotation_expires_at": expires_at.isoformat() if expires_at else None,
        "order_id": str(req["order_id"]) if req.get("order_id") else None,
        "order_number": req.get("order_number"),
        "is_converted_to_order": req.get("status") == "Converted to Order",
        "converted_order_number": req.get("order_number"),
        "created_at": req["created_at"].isoformat() if req.get("created_at") else None,
        "updated_at": req["updated_at"].isoformat() if req.get("updated_at") else None,
    }

    if is_admin:
        data["admin_notes"] = req.get("admin_notes", "")
        data["owner_id"] = req.get("owner_id", "")

    return data


# ---------------------------------------------------------------------------
# Customer Wholesale APIs
# ---------------------------------------------------------------------------

@api_view(["POST"])
@authentication_classes([])
def wholesale_request_create(request):
    """Customer submits a large wholesale quotation enquiry."""
    owner_id, error = get_owner(request)
    if error:
        return error

    data = request.data or {}
    customer_name = str(data.get("customer_name", "")).strip()
    phone = str(data.get("phone", "")).strip()
    email = str(data.get("email", "")).strip()
    business_name = str(data.get("business_name", "")).strip()
    preferred_date = str(data.get("preferred_delivery_date", "")).strip()
    delivery_city = str(data.get("delivery_city", "")).strip()
    delivery_pincode = str(data.get("delivery_pincode", "")).strip()
    delivery_state = str(data.get("delivery_state", "")).strip()
    additional_notes = str(data.get("additional_notes", "")).strip()
    raw_items = data.get("items", [])

    if not customer_name:
        return error_response("Customer name is required.", status.HTTP_400_BAD_REQUEST)
    if not phone or len(phone) < 10:
        return error_response("A valid 10-digit contact phone number is required.", status.HTTP_400_BAD_REQUEST)
    if not isinstance(raw_items, list) or len(raw_items) == 0:
        return error_response("Please select at least one sweet for quotation.", status.HTTP_400_BAD_REQUEST)

    db = get_db()
    selected_items = []
    total_weight_kg = 0.0
    estimated_normal_total = 0.0

    for item in raw_items:
        p_id = to_object_id(item.get("product_id"))
        weight = str(item.get("variant_weight", "")).strip()
        quantity = item.get("quantity", 1)

        if not p_id or not weight or not isinstance(quantity, int) or quantity < 1:
            return error_response("Invalid item selection or quantity.", status.HTTP_400_BAD_REQUEST)

        product = db.products.find_one({"_id": p_id, "is_active": True})
        if not product:
            return error_response("One of the selected products is no longer active.", status.HTTP_404_NOT_FOUND)

        variant = next((v for v in product.get("variants", []) if v["weight"] == weight), None)
        if not variant or not variant.get("is_available", True):
            return error_response(f"{product['name']} ({weight}) is unavailable.", status.HTTP_409_CONFLICT)

        unit_price = float(variant["price"])
        grams = parse_weight_to_grams(weight)
        item_kg = round((grams * quantity) / 1000.0, 3)
        item_total = round(unit_price * quantity, 2)

        total_weight_kg += item_kg
        estimated_normal_total += item_total

        selected_items.append({
            "product_id": str(product["_id"]),
            "product_name": product["name"],
            "product_image": product.get("image_url", ""),
            "variant_weight": weight,
            "quantity": quantity,
            "unit_price": unit_price,
            "weight_kg": item_kg,
            "item_total": item_total,
        })

    now = current_time()
    req_doc = {
        "request_id": make_wholesale_request_id(),
        "owner_id": owner_id,
        "customer_name": customer_name,
        "phone": phone,
        "email": email,
        "business_name": business_name,
        "selected_items": selected_items,
        "total_weight_kg": round(total_weight_kg, 2),
        "estimated_normal_total": round(estimated_normal_total, 2),
        "preferred_delivery_date": preferred_date,
        "delivery_city": delivery_city,
        "delivery_pincode": delivery_pincode,
        "delivery_state": delivery_state,
        "additional_notes": additional_notes,
        "status": "Pending",
        "quoted_price": None,
        "quotation_notes": "",
        "quotation_expires_at": None,
        "admin_notes": "",
        "order_id": None,
        "order_number": None,
        "created_at": now,
        "updated_at": now,
    }

    db.wholesale_requests.insert_one(req_doc)
    return Response(wholesale_to_json(req_doc), status=status.HTTP_201_CREATED)


@api_view(["GET"])
@authentication_classes([])
def wholesale_my_requests(request):
    """List all wholesale enquiries submitted by the current user/guest."""
    owner_id, error = get_owner(request)
    if error:
        return error

    db = get_db()
    requests = list(db.wholesale_requests.find({"owner_id": owner_id}).sort("created_at", -1))
    return Response({"requests": [wholesale_to_json(r) for r in requests]})


@api_view(["POST"])
@authentication_classes([])
def wholesale_accept_quotation(request, request_id):
    """Customer accepts an admin quotation.
    Validates stock, creates an order in orders collection, and reserves stock atomically.
    """
    owner_id, error = get_owner(request)
    if error:
        return error
    login_error = require_login(owner_id)
    if login_error:
        return login_error

    address_id = request.data.get("address_id")
    if not address_id:
        return error_response("Please select a delivery address.", status.HTTP_400_BAD_REQUEST)
    address_object_id = to_object_id(address_id)
    if address_object_id is None:
        return error_response("Invalid address id.", status.HTTP_400_BAD_REQUEST)

    db = get_db()
    address = db.addresses.find_one({"_id": address_object_id, "owner_id": owner_id})
    if address is None:
        return error_response("Address not found.", status.HTTP_404_NOT_FOUND)

    req = db.wholesale_requests.find_one({"request_id": request_id, "owner_id": owner_id})
    if not req:
        # Also try by _id if needed
        req_obj_id = to_object_id(request_id)
        if req_obj_id:
            req = db.wholesale_requests.find_one({"_id": req_obj_id, "owner_id": owner_id})

    if not req:
        return error_response("Wholesale quotation not found.", status.HTTP_404_NOT_FOUND)

    if req.get("status") != "Quotation Sent":
        return error_response(
            f"This request is currently '{req.get('status')}'. Only 'Quotation Sent' requests can be accepted.",
            status.HTTP_400_BAD_REQUEST
        )

    now = current_time()
    expires_at = req.get("quotation_expires_at")
    if expires_at and expires_at < now:
        db.wholesale_requests.update_one({"_id": req["_id"]}, {"$set": {"status": "Expired"}})
        return error_response("This quotation has expired. Please contact us for an updated quote.", status.HTTP_400_BAD_REQUEST)

    quoted_price = float(req.get("quoted_price", 0.0))
    if quoted_price <= 0:
        return error_response("Quotation price has not been set.", status.HTTP_400_BAD_REQUEST)

    # Re-verify stock for every sweet in selected_items
    lines = []
    problems = []
    for item in req.get("selected_items", []):
        p_id = to_object_id(item["product_id"])
        weight = item["variant_weight"]
        qty = item["quantity"]

        product = db.products.find_one({"_id": p_id})
        variant = None
        if product:
            variant = next((v for v in product.get("variants", []) if v["weight"] == weight), None)

        if not product or not product.get("is_active", True) or not variant or not variant.get("is_available", True):
            problems.append(f"{item.get('product_name')} ({weight}) is no longer available.")
        elif variant.get("stock", 0) < qty:
            problems.append(
                f"Only {variant.get('stock')} in stock for {product['name']} ({weight}). Requested {qty}."
            )

        if not problems:
            lines.append({
                "is_bulk": True,
                "is_wholesale": True,
                "product_id": p_id,
                "product_name": product["name"],
                "product_image": product.get("image_url", ""),
                "variant_weight": weight,
                "unit_price": variant["price"],
                "quantity": qty,
                "item_total": round(variant["price"] * qty, 2),
                "weight_kg": item.get("weight_kg", 0.0),
            })

    if problems:
        return Response(
            {"error": "Some sweets in this quotation are currently out of stock.", "problems": problems},
            status=status.HTTP_409_CONFLICT
        )

    # Atomically reserve stock
    reserved, problem = reserve_stock(db, lines)
    if problem:
        restore_stock(db, reserved)
        return Response(
            {"error": "Stock changed before order placement.", "problems": [problem]},
            status=status.HTTP_409_CONFLICT
        )

    # Create Order
    order_number = make_order_number()
    order_doc = {
        "owner_id": owner_id,
        "order_number": order_number,
        "is_wholesale_order": True,
        "wholesale_request_id": req["_id"],
        "wholesale_request_code": req["request_id"],
        "items": lines,
        "delivery_address": {field: address[field] for field in ADDRESS_FIELDS},
        "subtotal": req.get("estimated_normal_total", quoted_price),
        "discount_amount": max(0.0, round(float(req.get("estimated_normal_total", 0.0)) - quoted_price, 2)),
        "delivery_charge": None,
        "total_amount": quoted_price,
        "payment_method": "Wholesale Commercial Invoice",
        "payment_status": "Pending",
        "order_status": "Confirmed",
        "created_at": now,
        "updated_at": now,
    }

    inserted_order_id = db.orders.insert_one(order_doc).inserted_id

    # Update wholesale request status to Converted to Order
    db.wholesale_requests.update_one(
        {"_id": req["_id"]},
        {
            "$set": {
                "status": "Converted to Order",
                "order_id": inserted_order_id,
                "order_number": order_number,
                "accepted_at": now,
                "updated_at": now,
            }
        }
    )

    return Response({
        "message": "Quotation accepted! Bulk order placed successfully.",
        "order_id": str(inserted_order_id),
        "order_number": order_number,
    }, status=status.HTTP_201_CREATED)


@api_view(["POST"])
@authentication_classes([])
def wholesale_reject_quotation(request, request_id):
    """Customer declines quotation."""
    owner_id, error = get_owner(request)
    if error:
        return error

    db = get_db()
    req = db.wholesale_requests.find_one({"request_id": request_id, "owner_id": owner_id})
    if not req:
        req_obj_id = to_object_id(request_id)
        if req_obj_id:
            req = db.wholesale_requests.find_one({"_id": req_obj_id, "owner_id": owner_id})

    if not req:
        return error_response("Wholesale request not found.", status.HTTP_404_NOT_FOUND)

    db.wholesale_requests.update_one(
        {"_id": req["_id"]},
        {"$set": {"status": "Rejected", "updated_at": current_time()}}
    )
    return Response({"message": "Quotation rejected."})


# ---------------------------------------------------------------------------
# Admin Wholesale Management APIs
# ---------------------------------------------------------------------------

@api_view(["GET"])
@permission_classes([IsAdminUser])
def admin_wholesale_list(request):
    """Admin views all wholesale enquiries, with optional status filter."""
    db = get_db()
    query = {}
    status_filter = request.query_params.get("status")
    if status_filter and status_filter in WHOLESALE_STATUSES:
        query["status"] = status_filter

    requests = list(db.wholesale_requests.find(query).sort("created_at", -1))
    return Response({"requests": [wholesale_to_json(r, is_admin=True) for r in requests]})


@api_view(["GET"])
@permission_classes([IsAdminUser])
def admin_wholesale_detail(request, request_id):
    """Admin views detailed enquiry with live kitchen stock verification for each item."""
    db = get_db()
    req = db.wholesale_requests.find_one({"request_id": request_id})
    if not req:
        req_obj_id = to_object_id(request_id)
        if req_obj_id:
            req = db.wholesale_requests.find_one({"_id": req_obj_id})

    if not req:
        return error_response("Wholesale enquiry not found.", status.HTTP_404_NOT_FOUND)

    # Check live stock for every sweet
    enriched_items = []
    for item in req.get("selected_items", []):
        p_id = to_object_id(item.get("product_id"))
        weight = item.get("variant_weight")
        qty = item.get("quantity", 1)

        product = db.products.find_one({"_id": p_id}) if p_id else None
        current_stock = 0
        if product:
            variant = next((v for v in product.get("variants", []) if v["weight"] == weight), None)
            if variant:
                current_stock = int(variant.get("stock", 0))

        item_copy = dict(item)
        item_copy["current_stock"] = current_stock
        item_copy["is_stock_sufficient"] = current_stock >= qty
        enriched_items.append(item_copy)

    data = wholesale_to_json(req, is_admin=True)
    data["selected_items"] = enriched_items
    return Response(data)


@api_view(["PUT"])
@permission_classes([IsAdminUser])
def admin_wholesale_send_quotation(request, request_id):
    """Admin inputs quoted price, quotation notes, validity period, and sends to customer."""
    data = request.data or {}
    quoted_price = data.get("quoted_price", data.get("quoted_total_price"))
    quotation_notes = str(data.get("quotation_notes", data.get("customer_notes", ""))).strip()
    admin_notes = str(data.get("admin_notes", "")).strip()
    validity_days = int(data.get("validity_days", data.get("valid_days", 7)))

    if quoted_price is None or not isinstance(quoted_price, (int, float)) or quoted_price <= 0:
        return error_response("A valid positive quoted price is required.", status.HTTP_400_BAD_REQUEST)

    db = get_db()
    req = db.wholesale_requests.find_one({"request_id": request_id})
    if not req:
        req_obj_id = to_object_id(request_id)
        if req_obj_id:
            req = db.wholesale_requests.find_one({"_id": req_obj_id})

    if not req:
        return error_response("Wholesale enquiry not found.", status.HTTP_404_NOT_FOUND)

    now = current_time()
    expires_at = now + timedelta(days=validity_days)

    db.wholesale_requests.update_one(
        {"_id": req["_id"]},
        {
            "$set": {
                "quoted_price": round(float(quoted_price), 2),
                "quotation_notes": quotation_notes,
                "quotation_expires_at": expires_at,
                "admin_notes": admin_notes,
                "status": "Quotation Sent",
                "updated_at": now,
            }
        }
    )

    updated_req = db.wholesale_requests.find_one({"_id": req["_id"]})
    return Response(wholesale_to_json(updated_req, is_admin=True))


@api_view(["PUT"])
@permission_classes([IsAdminUser])
def admin_wholesale_update_status(request, request_id):
    """Admin updates status (e.g. 'Under Review', 'Rejected')."""
    new_status = request.data.get("status")
    admin_notes = request.data.get("admin_notes")

    if new_status not in WHOLESALE_STATUSES:
        return error_response("Invalid status value.", status.HTTP_400_BAD_REQUEST)

    db = get_db()
    req = db.wholesale_requests.find_one({"request_id": request_id})
    if not req:
        req_obj_id = to_object_id(request_id)
        if req_obj_id:
            req = db.wholesale_requests.find_one({"_id": req_obj_id})

    if not req:
        return error_response("Wholesale enquiry not found.", status.HTTP_404_NOT_FOUND)

    update_fields = {"status": new_status, "updated_at": current_time()}
    if admin_notes is not None:
        update_fields["admin_notes"] = str(admin_notes).strip()

    db.wholesale_requests.update_one({"_id": req["_id"]}, {"$set": update_fields})
    updated_req = db.wholesale_requests.find_one({"_id": req["_id"]})
    return Response(wholesale_to_json(updated_req, is_admin=True))
