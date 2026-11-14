"""Checkout validation, order placement and order history.

Orders belong to the guest id sent in the X-Guest-ID header (there is no customer login yet).

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
from apps.cart.views import cart_to_json, missing_guest_id, read_guest_id
from apps.products.views import current_time, error_response, to_object_id
from config.mongodb import get_db

logger = logging.getLogger(__name__)

ORDER_STATUSES = ["Pending", "Confirmed", "Processing", "Shipped", "Delivered", "Cancelled"]
NEW_ORDER_STATUS = ORDER_STATUSES[0]  # every new order starts as Pending

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
    guest_id = read_guest_id(request)
    if guest_id is None:
        return missing_guest_id()
    if not isinstance(request.data, dict):
        return error_response("Send a JSON object.", status.HTTP_400_BAD_REQUEST)

    db = get_db()

    # 1. The cart must have products (read from MongoDB, not from the request)
    cart = db.carts.find_one({"guest_id": guest_id})
    if not cart or not cart["items"]:
        return error_response("Your cart is empty.", status.HTTP_400_BAD_REQUEST)

    # 2. A delivery address must be selected, and it must belong to this guest
    address_id = request.data.get("address_id")
    if not address_id:
        return error_response("Please select a delivery address.", status.HTTP_400_BAD_REQUEST)
    address_object_id = to_object_id(address_id)
    if address_object_id is None:
        return error_response("Invalid address id.", status.HTTP_400_BAD_REQUEST)
    address = db.addresses.find_one({"_id": address_object_id, "guest_id": guest_id})
    if address is None:
        return error_response("Address not found.", status.HTTP_404_NOT_FOUND)

    # 3. Every product and weight must still be available in the requested quantity.
    #    cart_to_json re-reads the CURRENT price and stock from the products collection.
    cart_data = cart_to_json(db, cart)
    problems = []
    for item in cart_data["items"]:
        if not item["available"]:
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
            "delivery_charge": None,
            "delivery_charge_note": DELIVERY_CHARGE_NOTE,
            "total": cart_data["subtotal"],  # delivery is not included because it is not decided yet
        }
    )


# ---------------------------------------------------------------------------
# Place order
# ---------------------------------------------------------------------------

ADDRESS_FIELDS = ["full_name", "phone_number", "house_number", "street", "area", "city", "state", "pincode", "landmark"]


def order_to_json(order):
    return {
        "id": str(order["_id"]),
        "order_number": order["order_number"],
        "items": [
            {
                "product_id": str(item["product_id"]),
                "product_name": item["product_name"],
                "product_image": item["product_image"],
                "variant_weight": item["variant_weight"],
                "unit_price": item["unit_price"],
                "quantity": item["quantity"],
                "item_total": item["item_total"],
            }
            for item in order["items"]
        ],
        "delivery_address": order["delivery_address"],
        "subtotal": order["subtotal"],
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
    """Reduce stock for every line. Each reduction is ONE atomic MongoDB update that only
    succeeds if enough stock is still there, so stock can never go below zero.
    Returns (reserved_lines, problem). If a line fails, the caller must give back reserved_lines."""
    reserved = []
    for line in lines:
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
        reserved.append(line)
    return reserved, None


def restore_stock(db, lines):
    """Give the stock back (used when an order could not be completed)."""
    for line in lines:
        try:
            db.products.update_one(
                {"_id": line["product_id"], "variants.weight": line["variant_weight"]},
                {"$inc": {"variants.$.stock": line["quantity"]}},
            )
        except PyMongoError:
            logger.error("Could not restore stock for %s %s", line["product_id"], line["variant_weight"])


@api_view(["POST"])
@authentication_classes([])
def order_create(request):
    guest_id = read_guest_id(request)
    if guest_id is None:
        return missing_guest_id()
    if not isinstance(request.data, dict):
        return error_response("Send a JSON object.", status.HTTP_400_BAD_REQUEST)
    db = get_db()

    # 1. Cart: read from MongoDB. It must not be empty.
    cart = db.carts.find_one({"guest_id": guest_id})
    if not cart or not cart["items"]:
        return error_response("Your cart is empty.", status.HTTP_400_BAD_REQUEST)

    # 2. Address: must be selected and must belong to this guest
    address_id = request.data.get("address_id")
    if not address_id:
        return error_response("Please select a delivery address.", status.HTTP_400_BAD_REQUEST)
    address_object_id = to_object_id(address_id)
    if address_object_id is None:
        return error_response("Invalid address id.", status.HTTP_400_BAD_REQUEST)
    address = db.addresses.find_one({"_id": address_object_id, "guest_id": guest_id})
    if address is None:
        return error_response("Address not found.", status.HTTP_404_NOT_FOUND)

    # 3. Lock the cart so a double click (two requests at the same moment) cannot create two orders.
    #    update_one is atomic: only ONE request can set the lock.
    now = current_time()
    lock_token = uuid.uuid4().hex
    lock_result = db.carts.update_one(
        {
            "guest_id": guest_id,
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
        cart = db.carts.find_one({"guest_id": guest_id, "checkout_lock": lock_token})
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
        now = current_time()
        order = {
            "guest_id": guest_id,
            "items": lines,
            # A COPY of the address, so later address edits never change this order
            "delivery_address": {field: address[field] for field in ADDRESS_FIELDS},
            "subtotal": subtotal,
            "delivery_charge": None,  # no delivery rule exists yet
            "total_amount": subtotal,
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

        # 8. Only now, after the order is saved, empty the cart (and drop the lock)
        try:
            db.carts.update_one(
                {"guest_id": guest_id, "checkout_lock": lock_token},
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
                {"guest_id": guest_id, "checkout_lock": lock_token},
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
    guest_id = read_guest_id(request)
    if guest_id is None:
        return missing_guest_id()
    # Only this guest's orders (the guest id is part of the query), newest first
    orders = get_db().orders.find({"guest_id": guest_id}).sort("created_at", -1)
    return Response([order_to_json(order) for order in orders])


@api_view(["GET"])
@authentication_classes([])
def order_detail(request, order_id):
    guest_id = read_guest_id(request)
    if guest_id is None:
        return missing_guest_id()
    object_id = to_object_id(order_id)
    if object_id is None:
        return error_response("Invalid order id.", status.HTTP_400_BAD_REQUEST)
    # Ownership check: another guest's order is simply "not found"
    order = get_db().orders.find_one({"_id": object_id, "guest_id": guest_id})
    if order is None:
        return error_response("Order not found.", status.HTTP_404_NOT_FOUND)
    return Response(order_to_json(order))
