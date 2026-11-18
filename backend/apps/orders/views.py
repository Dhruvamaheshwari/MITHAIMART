"""Checkout validation, order placement and order history.

Orders belong to an owner: a logged-in customer (Bearer token) or a guest browser (X-Guest-ID header).

About safety: this MongoDB is a standalone server, so multi-document transactions are NOT
available. Instead the order is placed in careful steps (see order_create). That is safer than
doing nothing, but it is not a full database transaction.
"""

import logging
import secrets
import uuid
from datetime import timedelta

from pymongo.errors import DuplicateKeyError, PyMongoError
from rest_framework import status
from rest_framework.decorators import api_view, authentication_classes
from rest_framework.response import Response

from apps.accounts.views import address_to_json
from apps.accounts.customer_auth import get_owner, require_login
from apps.cart.views import cart_to_json
from apps.products.views import current_time, error_response, to_object_id
from config.mongodb import get_db

logger = logging.getLogger(__name__)

ORDER_STATUSES = ["Pending", "Confirmed", "Processing", "Shipped", "Delivered", "Cancelled"]
NEW_ORDER_STATUS = ORDER_STATUSES[0]  # every new order starts as Pending

# Which status an admin may move an order to. An order moves forward one step at a time and can be
# cancelled until it is shipped. Delivered and Cancelled orders are final.
ALLOWED_STATUS_CHANGES = {
    "Pending": ["Confirmed", "Cancelled"],
    "Confirmed": ["Processing", "Cancelled"],
    "Processing": ["Shipped", "Cancelled"],
    "Shipped": ["Delivered"],
    "Delivered": [],
    "Cancelled": [],
}

# No payment method has been defined by the business and there is no payment gateway,
# so we do not pretend. Nothing is marked as paid.
# (Change these two lines when Cash on Delivery or online payment is decided.)
PAYMENT_METHOD = "To be confirmed"
PAYMENT_STATUS = "Pending"

CHECKOUT_LOCK_SECONDS = 60  # a stuck checkout lock is ignored after this time

# There is no delivery rule configured yet, so the delivery charge is unknown.
# Do not invent one here. When a real rule exists, calculate it on the backend.
DELIVERY_CHARGE_NOTE = "To be confirmed"


@api_view(["POST"])
@authentication_classes([])
def checkout_validate(request):
    owner_id, error = get_owner(request)
    if error:
        return error
    # Only a logged-in customer may order. This is checked here, on the server, so it cannot be skipped.
    login_error = require_login(owner_id)
    if login_error:
        return login_error
    if not isinstance(request.data, dict):
        return error_response("Send a JSON object.", status.HTTP_400_BAD_REQUEST)

    db = get_db()

    # 1. The cart must have products (read from MongoDB, not from the request)
    cart = db.carts.find_one({"owner_id": owner_id})
    if not cart or not cart["items"]:
        return error_response("Your cart is empty.", status.HTTP_400_BAD_REQUEST)

    # 2. A delivery address must be selected, and it must belong to this guest
    address_id = request.data.get("address_id")
    if not address_id:
        return error_response("Please select a delivery address.", status.HTTP_400_BAD_REQUEST)
    address_object_id = to_object_id(address_id)
    if address_object_id is None:
        return error_response("Invalid address id.", status.HTTP_400_BAD_REQUEST)
    address = db.addresses.find_one({"_id": address_object_id, "owner_id": owner_id})
    if address is None:
        return error_response("Address not found.", status.HTTP_404_NOT_FOUND)

    # 3. Every product and weight must still be available in the requested quantity.
    #    cart_to_json re-reads the CURRENT price and stock from the products collection.
    cart_data = cart_to_json(db, cart)
    problems = []
    for item in cart_data["items"]:
        if not item["available"]:
            if item.get("is_hamper"):
                for pr in item.get("problem_reasons", []):
                    problems.append(
                        {"product_name": item["product_name"], "variant_weight": item.get("box_size", "Hamper"), "message": pr}
                    )
            else:
                if item["stock"] > 0:
                    reason = f"Only {item['stock']} left. Please lower the quantity."
                else:
                    reason = "No longer available. Please remove it from your cart."
                problems.append(
                    {"product_name": item["product_name"], "variant_weight": item["variant_weight"], "message": reason}
                )
    if problems:
        return Response(
            {"error": "Some items in your cart are not available.", "problems": problems},
            status=status.HTTP_409_CONFLICT,
        )

    # Optional Coupon Validation
    coupon_code = request.data.get("coupon_code")
    coupon_discount = 0.0
    applied_coupon = None
    if coupon_code:
        code_str = str(coupon_code).strip().upper()
        cp = db.coupons.find_one({"code": code_str})
        now = current_time()
        if cp and not cp.get("is_used") and (not cp.get("expires_at") or cp["expires_at"] > now):
            owner_matches = not cp.get("owner_id") or cp.get("owner_id") == owner_id
            min_spend = float(cp.get("minimum_order_amount", 0.0))
            if owner_matches and cart_data["subtotal"] >= min_spend:
                disc_val = float(cp.get("discount_value", 10.0))
                if cp.get("discount_type") == "percentage":
                    coupon_discount = round(min(cart_data["subtotal"] * (disc_val / 100.0), float(cp.get("maximum_discount", 999999.0))), 2)
                else:
                    coupon_discount = round(min(disc_val, cart_data["subtotal"]), 2)
                applied_coupon = {
                    "code": code_str,
                    "discount_amount": coupon_discount,
                    "discount_value": disc_val,
                    "discount_type": cp.get("discount_type", "percentage"),
                }

    final_total = round(max(0.0, cart_data["subtotal"] - coupon_discount), 2)

    # All good. The totals below are calculated here, from current database prices.
    # Nothing the frontend sends (prices, totals) is used.
    return Response(
        {
            "status": "ready",
            "message": "Checkout details are valid and ready for order placement.",
            "address": address_to_json(address),
            "items": cart_data["items"],
            "total_quantity": cart_data["total_quantity"],
            "subtotal": cart_data["subtotal"],
            "coupon_discount": coupon_discount,
            "coupon": applied_coupon,
            "delivery_charge": None,
            "delivery_charge_note": DELIVERY_CHARGE_NOTE,
            "total": final_total,
        }
    )


# ---------------------------------------------------------------------------
# Place order
# ---------------------------------------------------------------------------

ADDRESS_FIELDS = ["full_name", "phone_number", "house_number", "street", "area", "city", "state", "pincode", "landmark"]


def order_to_json(order):
    formatted_items = []
    for item in order.get("items", []):
        if item.get("is_hamper"):
            formatted_items.append({
                "is_hamper": True,
                "hamper_id": item.get("hamper_id"),
                "product_name": item.get("product_name", f"Custom Mithai Hamper ({item.get('box_size', 'Gift Box')})"),
                "box_name": item.get("box_name"),
                "box_size": item.get("box_size"),
                "box_image": item.get("box_image"),
                "packaging_price": item.get("packaging_price", 0.0),
                "gift_wrap_price": item.get("gift_wrap_price", 0.0),
                "customization": item.get("customization", {}),
                "items": [
                    {
                        "product_id": str(s["product_id"]),
                        "product_name": s["product_name"],
                        "product_image": s.get("product_image", ""),
                        "variant_weight": s["variant_weight"],
                        "unit_price": s["unit_price"],
                        "quantity": s["quantity"],
                        "item_total": s["item_total"],
                    }
                    for s in item.get("items", [])
                ],
                "quantity": 1,
                "item_total": item["item_total"],
            })
        elif item.get("is_bulk"):
            formatted_items.append({
                "is_bulk": True,
                "is_hamper": False,
                "product_id": str(item["product_id"]),
                "product_name": item["product_name"],
                "product_image": item.get("product_image", ""),
                "variant_weight": item["variant_weight"],
                "unit_price": item["unit_price"],
                "quantity": item["quantity"],
                "normal_total": item.get("normal_total", item["item_total"]),
                "discount_percentage": item.get("discount_percentage", 0.0),
                "discount_amount": item.get("discount_amount", 0.0),
                "item_total": item["item_total"],
                "total_weight_kg": item.get("total_weight_kg", 0.0),
            })
        else:
            formatted_items.append({
                "is_hamper": False,
                "product_id": str(item["product_id"]),
                "product_name": item["product_name"],
                "product_image": item["product_image"],
                "variant_weight": item["variant_weight"],
                "unit_price": item["unit_price"],
                "quantity": item["quantity"],
                "item_total": item["item_total"],
            })

    return {
        "id": str(order["_id"]),
        "order_number": order["order_number"],
        "items": formatted_items,
        "delivery_address": order["delivery_address"],
        "subtotal": order["subtotal"],
        "coupon_code": order.get("coupon_code"),
        "coupon_discount": order.get("coupon_discount", 0.0),
        "coupon_generated": order.get("coupon_generated"),
        "is_wholesale_order": bool(order.get("is_wholesale_order", False)),
        "wholesale_request_code": order.get("wholesale_request_code"),
        "delivery_charge": order["delivery_charge"],
        "delivery_charge_note": DELIVERY_CHARGE_NOTE if order["delivery_charge"] is None else "",
        "total_amount": order["total_amount"],
        "payment_method": order["payment_method"],
        "payment_status": order["payment_status"],
        "order_status": order["order_status"],
        "created_at": order["created_at"].isoformat(),
        "updated_at": order["updated_at"].isoformat(),
    }


def make_order_number():
    """Example: MM-20261114-7K3QXA. A unique index on order_number guarantees there are no duplicates."""
    letters = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"  # no 0/O or 1/I, they look alike
    random_part = "".join(secrets.choice(letters) for _ in range(6))
    return f"MM-{current_time().strftime('%Y%m%d')}-{random_part}"


def build_order_lines(db, cart_items):
    """Read the CURRENT product data from MongoDB for every cart item.
    Returns (lines, problems). Prices come from the database, never from the request."""
    lines = []
    problems = []
    for item in cart_items:
        if item.get("is_hamper"):
            hamper_sweets = []
            hamper_sweets_total = 0.0
            for sweet in item.get("items", []):
                p = db.products.find_one({"_id": sweet["product_id"]})
                v = None
                if p:
                    v = next((v for v in p.get("variants", []) if v["weight"] == sweet["variant_weight"]), None)

                name = p["name"] if p else sweet.get("product_name", "Sweet")
                reason = None
                if p is None or not p.get("is_active", True) or v is None or not v.get("is_available", True):
                    reason = f"{name} ({sweet.get('variant_weight')}) in hamper is no longer available."
                elif v.get("stock", 0) < 1:
                    reason = f"{name} ({sweet.get('variant_weight')}) in hamper is out of stock."
                elif sweet["quantity"] > v.get("stock", 0):
                    reason = f"Only {v['stock']} left for {name} ({sweet.get('variant_weight')}) in hamper."

                if reason:
                    problems.append({"product_name": name, "variant_weight": sweet["variant_weight"], "message": reason})
                    continue

                item_total = round(v["price"] * sweet["quantity"], 2)
                hamper_sweets_total += item_total
                hamper_sweets.append({
                    "product_id": sweet["product_id"],
                    "product_name": p["name"],
                    "product_image": p.get("image_url", ""),
                    "variant_weight": sweet["variant_weight"],
                    "unit_price": v["price"],
                    "quantity": sweet["quantity"],
                    "item_total": item_total,
                })

            packaging_price = float(item.get("packaging_price", 0.0))
            gift_wrap_price = float(item.get("gift_wrap_price", 0.0))
            hamper_total = round(hamper_sweets_total + packaging_price + gift_wrap_price, 2)

            lines.append({
                "is_hamper": True,
                "hamper_id": item.get("hamper_id"),
                "product_name": f"Custom Mithai Hamper ({item.get('box_size', 'Gift Box')})",
                "box_id": item.get("box_id"),
                "box_name": item.get("box_name"),
                "box_size": item.get("box_size"),
                "box_image": item.get("box_image"),
                "packaging_price": packaging_price,
                "gift_wrap_price": gift_wrap_price,
                "customization": item.get("customization", {}),
                "items": hamper_sweets,
                "quantity": 1,
                "item_total": hamper_total,
            })
        elif item.get("is_bulk"):
            product = db.products.find_one({"_id": item["product_id"]})
            variant = None
            if product is not None:
                variant = next((v for v in product.get("variants", []) if v["weight"] == item["variant_weight"]), None)

            name = product["name"] if product else item.get("product_name", "Sweet")
            reason = None
            if product is None or not product.get("is_active", True) or variant is None or not variant.get("is_available", True):
                reason = "No longer available. Please remove it from your cart."
            elif variant.get("stock", 0) < 1:
                reason = "Out of stock. Please remove it from your cart."
            elif item["quantity"] > variant.get("stock", 0):
                reason = f"Only {variant['stock']} left. Please lower the quantity."

            if reason:
                problems.append({"product_name": name, "variant_weight": item["variant_weight"], "message": reason})
                continue

            from apps.core.bulk_views import calculate_item_bulk_discount, get_bulk_rules
            from apps.core.hamper_views import parse_weight_to_grams
            rules = get_bulk_rules(db)
            grams = parse_weight_to_grams(item["variant_weight"])
            calc = calculate_item_bulk_discount(grams, item["quantity"], variant["price"], rules)

            lines.append({
                "is_bulk": True,
                "is_hamper": False,
                "product_id": item["product_id"],
                "product_name": product["name"],
                "product_image": product.get("image_url", ""),
                "variant_weight": item["variant_weight"],
                "unit_price": variant["price"],
                "quantity": item["quantity"],
                "normal_total": calc["normal_total"],
                "discount_percentage": calc["discount_percentage"],
                "discount_amount": calc["discount_amount"],
                "item_total": calc["discounted_total"],
                "total_weight_kg": calc["total_weight_kg"],
            })
        else:
            product = db.products.find_one({"_id": item["product_id"]})
            variant = None
            if product is not None:
                variant = next((v for v in product["variants"] if v["weight"] == item["variant_weight"]), None)

            name = product["name"] if product else item["product_name"]
            reason = None
            if product is None or not product["is_active"] or variant is None or not variant["is_available"]:
                reason = "No longer available. Please remove it from your cart."
            elif variant["stock"] < 1:
                reason = "Out of stock. Please remove it from your cart."
            elif item["quantity"] > variant["stock"]:
                reason = f"Only {variant['stock']} left. Please lower the quantity."

            if reason:
                problems.append({"product_name": name, "variant_weight": item["variant_weight"], "message": reason})
                continue

            lines.append(
                {
                    "is_hamper": False,
                    "product_id": item["product_id"],
                    "product_name": product["name"],
                    "product_image": product["image_url"],
                    "variant_weight": item["variant_weight"],
                    "unit_price": variant["price"],
                    "quantity": item["quantity"],
                    "item_total": round(variant["price"] * item["quantity"], 2),
                }
            )
    return lines, problems


def reserve_stock(db, lines):
    """Reduce stock atomically for every item (normal items & hamper sweets).
    Returns (reserved, problem). If a line fails, caller restores stock."""
    reserved = []
    for line in lines:
        if line.get("is_hamper"):
            for sweet in line.get("items", []):
                result = db.products.update_one(
                    {
                        "_id": sweet["product_id"],
                        "is_active": True,
                        "variants": {
                            "$elemMatch": {
                                "weight": sweet["variant_weight"],
                                "is_available": True,
                                "stock": {"$gte": sweet["quantity"]},
                            }
                        },
                    },
                    {"$inc": {"variants.$.stock": -sweet["quantity"]}},
                )
                if result.modified_count != 1:
                    problem = {
                        "product_name": sweet["product_name"],
                        "variant_weight": sweet["variant_weight"],
                        "message": "Just sold out or not enough stock left. Please check your hamper.",
                    }
                    return reserved, problem
                reserved.append({
                    "product_id": sweet["product_id"],
                    "variant_weight": sweet["variant_weight"],
                    "quantity": sweet["quantity"],
                })
        else:
            result = db.products.update_one(
                {
                    "_id": line["product_id"],
                    "is_active": True,
                    "variants": {
                        "$elemMatch": {
                            "weight": line["variant_weight"],
                            "is_available": True,
                            "stock": {"$gte": line["quantity"]},
                        }
                    },
                },
                {"$inc": {"variants.$.stock": -line["quantity"]}},
            )
            if result.modified_count != 1:
                problem = {
                    "product_name": line["product_name"],
                    "variant_weight": line["variant_weight"],
                    "message": "Just sold out or not enough stock left. Please check your cart.",
                }
                return reserved, problem
            reserved.append({
                "product_id": line["product_id"],
                "variant_weight": line["variant_weight"],
                "quantity": line["quantity"],
            })
    return reserved, None


def restore_stock(db, reserved):
    """Give the stock back (used when an order could not be completed)."""
    for item in reserved:
        try:
            db.products.update_one(
                {"_id": item["product_id"], "variants.weight": item["variant_weight"]},
                {"$inc": {"variants.$.stock": item["quantity"]}},
            )
        except PyMongoError:
            logger.error("Could not restore stock for %s %s", item["product_id"], item["variant_weight"])


@api_view(["POST"])
@authentication_classes([])
def order_create(request):
    owner_id, error = get_owner(request)
    if error:
        return error
    # Only a logged-in customer may order. This is checked here, on the server, so it cannot be skipped.
    login_error = require_login(owner_id)
    if login_error:
        return login_error
    if not isinstance(request.data, dict):
        return error_response("Send a JSON object.", status.HTTP_400_BAD_REQUEST)
    db = get_db()

    # 1. Cart: read from MongoDB. It must not be empty.
    cart = db.carts.find_one({"owner_id": owner_id})
    if not cart or not cart["items"]:
        return error_response("Your cart is empty.", status.HTTP_400_BAD_REQUEST)

    # 2. Address: must be selected and must belong to this guest
    address_id = request.data.get("address_id")
    if not address_id:
        return error_response("Please select a delivery address.", status.HTTP_400_BAD_REQUEST)
    address_object_id = to_object_id(address_id)
    if address_object_id is None:
        return error_response("Invalid address id.", status.HTTP_400_BAD_REQUEST)
    address = db.addresses.find_one({"_id": address_object_id, "owner_id": owner_id})
    if address is None:
        return error_response("Address not found.", status.HTTP_404_NOT_FOUND)

    # 3. Lock the cart so a double click (two requests at the same moment) cannot create two orders.
    #    update_one is atomic: only ONE request can set the lock.
    now = current_time()
    lock_token = uuid.uuid4().hex
    lock_result = db.carts.update_one(
        {
            "owner_id": owner_id,
            "items.0": {"$exists": True},
            "$or": [
                {"checkout_lock_at": {"$exists": False}},
                {"checkout_lock_at": {"$lt": now - timedelta(seconds=CHECKOUT_LOCK_SECONDS)}},  # old, stuck lock
            ],
        },
        {"$set": {"checkout_lock": lock_token, "checkout_lock_at": now}},
    )
    if lock_result.modified_count != 1:
        return error_response(
            "Your order is already being placed. Please wait a moment.", status.HTTP_409_CONFLICT
        )

    reserved = []  # lines whose stock we have already reduced
    order_saved = False
    try:
        # Read the cart again now that we own the lock
        cart = db.carts.find_one({"owner_id": owner_id, "checkout_lock": lock_token})
        if not cart or not cart["items"]:
            return error_response("Your cart is empty.", status.HTTP_400_BAD_REQUEST)

        # 4. Check availability and stock, and take the real prices from MongoDB
        lines, problems = build_order_lines(db, cart["items"])
        if problems:
            return Response(
                {"error": "Some items in your cart are not available.", "problems": problems},
                status=status.HTTP_409_CONFLICT,
            )

        # 5. Reduce stock (atomic per item). If one item fails, give back what we took.
        reserved, problem = reserve_stock(db, lines)
        if problem:
            restore_stock(db, reserved)
            reserved = []
            return Response(
                {"error": "Some items in your cart are not available.", "problems": [problem]},
                status=status.HTTP_409_CONFLICT,
            )

        # 6. Totals are calculated here from database prices. Nothing from the request is used.
        subtotal = round(sum(line["item_total"] for line in lines), 2)
        coupon_discount = 0.0
        applied_coupon_id = None
        coupon_code = request.data.get("coupon_code")
        now = current_time()

        if coupon_code:
            code_str = str(coupon_code).strip().upper()
            cp = db.coupons.find_one({"code": code_str})
            if cp and not cp.get("is_used") and (not cp.get("expires_at") or cp["expires_at"] > now):
                owner_matches = not cp.get("owner_id") or cp.get("owner_id") == owner_id
                min_spend = float(cp.get("minimum_order_amount", 0.0))
                if owner_matches and subtotal >= min_spend:
                    disc_val = float(cp.get("discount_value", 10.0))
                    if cp.get("discount_type") == "percentage":
                        coupon_discount = round(min(subtotal * (disc_val / 100.0), float(cp.get("maximum_discount", 999999.0))), 2)
                    else:
                        coupon_discount = round(min(disc_val, subtotal), 2)
                    applied_coupon_id = cp["_id"]

        total_amount = round(max(0.0, subtotal - coupon_discount), 2)

        order = {
            "owner_id": owner_id,
            "items": lines,
            # A COPY of the address, so later address edits never change this order
            "delivery_address": {field: address[field] for field in ADDRESS_FIELDS},
            "subtotal": subtotal,
            "coupon_code": str(coupon_code).strip().upper() if applied_coupon_id else None,
            "coupon_discount": coupon_discount,
            "delivery_charge": None,  # no delivery rule exists yet
            "total_amount": total_amount,
            "payment_method": PAYMENT_METHOD,
            "payment_status": PAYMENT_STATUS,
            "order_status": NEW_ORDER_STATUS,
            "created_at": now,
            "updated_at": now,
        }

        # 7. Save the order. The unique index on order_number rejects duplicates, so we try a new number.
        for _ in range(5):
            order["order_number"] = make_order_number()
            try:
                order["_id"] = db.orders.insert_one(order).inserted_id
                order_saved = True
                break
            except DuplicateKeyError:
                continue
        if not order_saved:
            restore_stock(db, reserved)
            reserved = []
            return error_response("Could not create the order. Please try again.", status.HTTP_503_SERVICE_UNAVAILABLE)

        # Mark used coupon
        if applied_coupon_id:
            try:
                db.coupons.update_one(
                    {"_id": applied_coupon_id},
                    {"$set": {"is_used": True, "used_at": now, "used_in_order_id": order["_id"]}}
                )
            except Exception as e:
                logger.error("Could not mark coupon %s as used: %s", applied_coupon_id, e)

        # Automatic Next-Purchase Coupon for qualifying hamper orders
        has_hamper = any(l.get("is_hamper") for l in lines)
        hamper_total = sum(l["item_total"] for l in lines if l.get("is_hamper"))
        settings = db.hamper_settings.find_one({"key": "global_settings"}) or {}
        min_qualifying = float(settings.get("min_order_amount_for_coupon", 1000.0))

        if has_hamper and hamper_total >= min_qualifying:
            random_suffix = "".join(secrets.choice("ABCDEFGHJKLMNPQRSTUVWXYZ23456789") for _ in range(4))
            new_code = f"HAMPER10-{random_suffix}"
            validity_days = int(settings.get("coupon_validity_days", 30))
            coupon_doc = {
                "code": new_code,
                "owner_id": owner_id,
                "source_order_id": order["_id"],
                "discount_type": settings.get("coupon_discount_type", "percentage"),
                "discount_value": float(settings.get("coupon_discount_value", 10.0)),
                "minimum_order_amount": float(settings.get("coupon_min_order_amount", 500.0)),
                "maximum_discount": float(settings.get("coupon_max_discount", 500.0)),
                "expires_at": now + timedelta(days=validity_days),
                "is_used": False,
                "used_at": None,
                "created_at": now,
            }
            db.coupons.insert_one(coupon_doc)
            coupon_summary = {
                "code": new_code,
                "discount_value": coupon_doc["discount_value"],
                "discount_type": coupon_doc["discount_type"],
                "expires_at": coupon_doc["expires_at"].isoformat(),
                "minimum_order_amount": coupon_doc["minimum_order_amount"],
            }
            db.orders.update_one({"_id": order["_id"]}, {"$set": {"coupon_generated": coupon_summary}})
            order["coupon_generated"] = coupon_summary

        # 8. Only now, after the order is saved, empty the cart (and drop the lock)
        try:
            db.carts.update_one(
                {"owner_id": owner_id, "checkout_lock": lock_token},
                {
                    "$set": {"items": [], "updated_at": current_time()},
                    "$unset": {"checkout_lock": "", "checkout_lock_at": ""},
                },
            )
        except PyMongoError:
            # The order IS saved, so we still report success. The cart can be cleared by hand.
            logger.error("Order %s saved but the cart could not be cleared", order["order_number"])

        return Response(order_to_json(order), status=status.HTTP_201_CREATED)
    except PyMongoError:
        # Unexpected database problem: if no order was saved, give the stock back.
        if not order_saved:
            restore_stock(db, reserved)
        raise  # the global handler turns this into a safe 503 message
    finally:
        # Remove our lock if it is still there (the success path already removed it).
        try:
            db.carts.update_one(
                {"owner_id": owner_id, "checkout_lock": lock_token},
                {"$unset": {"checkout_lock": "", "checkout_lock_at": ""}},
            )
        except PyMongoError:
            logger.error("Could not release the checkout lock for a cart")


# ---------------------------------------------------------------------------
# Order history
# ---------------------------------------------------------------------------

@api_view(["GET"])
@authentication_classes([])
def order_list(request):
    owner_id, error = get_owner(request)
    if error:
        return error
    # Only this guest's orders (the guest id is part of the query), newest first
    orders = get_db().orders.find({"owner_id": owner_id}).sort("created_at", -1)
    return Response([order_to_json(order) for order in orders])


@api_view(["GET"])
@authentication_classes([])
def order_detail(request, order_id):
    owner_id, error = get_owner(request)
    if error:
        return error
    object_id = to_object_id(order_id)
    if object_id is None:
        return error_response("Invalid order id.", status.HTTP_400_BAD_REQUEST)
    # Ownership check: another guest's order is simply "not found"
    order = get_db().orders.find_one({"_id": object_id, "owner_id": owner_id})
    if order is None:
        return error_response("Order not found.", status.HTTP_404_NOT_FOUND)
    return Response(order_to_json(order))
