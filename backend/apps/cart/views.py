"""Shopping cart APIs.

A cart belongs to an owner: a logged-in customer (Bearer token) or a guest browser (X-Guest-ID header).
See apps/accounts/customer_auth.py. Guests are NOT logged-in users: the guest id only identifies a cart.

The price is NEVER taken from the request. It is always read from the product in MongoDB.
"""

from rest_framework import status
from rest_framework.decorators import api_view, authentication_classes
from rest_framework.response import Response

from apps.accounts.customer_auth import get_owner
from apps.products.views import current_time, error_response, to_object_id
from config.mongodb import get_db


# ---------------------------------------------------------------------------
# Helper functions
# ---------------------------------------------------------------------------

def merge_cart_into(db, from_owner_id, to_owner_id):
    """Move the items of one cart into another one. Used when a guest logs in, so the items the guest
    collected are not lost. Quantities are added together but never above the stock, and items that
    can no longer be bought are skipped. Afterwards the guest cart is emptied."""
    from_cart = db.carts.find_one({"owner_id": from_owner_id})
    if not from_cart or not from_cart["items"]:
        return
    to_cart = db.carts.find_one({"owner_id": to_owner_id})
    items = to_cart["items"] if to_cart else []

    for guest_item in from_cart["items"]:
        if guest_item.get("is_hamper") or guest_item.get("is_bulk"):
            items.append(guest_item)
            continue
        product = db.products.find_one({"_id": guest_item["product_id"]})
        if product is None or not product["is_active"]:
            continue
        variant = next((v for v in product["variants"] if v["weight"] == guest_item["variant_weight"]), None)
        if variant is None or not variant["is_available"] or variant["stock"] < 1:
            continue

        existing = find_item(items, guest_item["product_id"], guest_item["variant_weight"])
        wanted = guest_item["quantity"] + (existing["quantity"] if existing else 0)
        quantity = min(wanted, variant["stock"])
        if existing is None:
            existing = {"product_id": guest_item["product_id"], "variant_weight": guest_item["variant_weight"]}
            items.append(existing)
        existing["quantity"] = quantity
        refresh_snapshot(existing, product, variant)

    save_items(db, to_owner_id, items)
    save_items(db, from_owner_id, [])


def read_item_request(data, quantity_required):
    """Validate the body of add/update requests. Returns (product_object_id, weight, quantity, error)."""
    if not isinstance(data, dict):
        return None, None, None, error_response("Send a JSON object.", status.HTTP_400_BAD_REQUEST)

    product_object_id = to_object_id(data.get("product_id"))
    if product_object_id is None:
        return None, None, None, error_response("A valid product_id is required.", status.HTTP_400_BAD_REQUEST)

    weight = data.get("variant_weight")
    if not isinstance(weight, str) or not weight.strip():
        return None, None, None, error_response("variant_weight is required.", status.HTTP_400_BAD_REQUEST)

    quantity = data.get("quantity", None if quantity_required else 1)
    # bool is a subclass of int in Python, so True/False must be rejected separately
    if not isinstance(quantity, int) or isinstance(quantity, bool) or quantity < 1:
        return None, None, None, error_response(
            "quantity must be a whole number greater than zero.", status.HTTP_400_BAD_REQUEST
        )
    return product_object_id, weight.strip(), quantity, None


def load_variant(db, product_object_id, weight):
    """Find the real product and variant in MongoDB. Returns (product, variant, error)."""
    product = db.products.find_one({"_id": product_object_id})
    if product is None or not product["is_active"]:
        return None, None, error_response("Product not found.", status.HTTP_404_NOT_FOUND)

    variant = next((v for v in product["variants"] if v["weight"] == weight), None)
    if variant is None:
        return None, None, error_response("This weight does not exist for the product.", status.HTTP_404_NOT_FOUND)

    if not variant["is_available"] or variant["stock"] < 1:
        return None, None, error_response("This weight is currently out of stock.", status.HTTP_409_CONFLICT)
    return product, variant, None


def find_item(items, product_object_id, weight):
    for item in items:
        if item["product_id"] == product_object_id and item["variant_weight"] == weight:
            return item
    return None


def save_items(db, owner_id, items):
    """Save the cart. upsert=True creates the cart document the first time."""
    now = current_time()
    db.carts.update_one(
        {"owner_id": owner_id},
        {"$set": {"items": items, "updated_at": now}, "$setOnInsert": {"created_at": now}},
        upsert=True,
    )


def refresh_snapshot(item, product, variant):
    """Store the current name, image and price (from MongoDB) inside the cart item."""
    item["product_name"] = product["name"]
    item["product_image"] = product["image_url"]
    item["variant_price"] = variant["price"]


def cart_to_json(db, cart):
    """Build the response. Price and stock are re-read from the products collection,
    so the cart always shows the real current price and stock for normal items and hamper sweets."""
    items = cart["items"] if cart else []
    all_product_ids = []
    for item in items:
        if item.get("is_hamper"):
            for sweet in item.get("items", []):
                all_product_ids.append(sweet["product_id"])
        else:
            all_product_ids.append(item["product_id"])

    products = {p["_id"]: p for p in db.products.find({"_id": {"$in": all_product_ids}})}

    result_items = []
    total_quantity = 0
    subtotal = 0.0

    for item in items:
        if item.get("is_hamper"):
            hamper_sweets = []
            hamper_sweets_total = 0.0
            hamper_available = True
            problem_reasons = []

            for sweet in item.get("items", []):
                p = products.get(sweet["product_id"])
                v = None
                if p:
                    v = next((v for v in p.get("variants", []) if v["weight"] == sweet["variant_weight"]), None)

                price = v["price"] if v else sweet.get("unit_price", 0.0)
                stock = v["stock"] if v else 0
                qty = sweet.get("quantity", 1)

                sweet_avail = bool(p and p["is_active"] and v and v["is_available"] and qty <= stock)
                if not sweet_avail:
                    hamper_available = False
                    problem_reasons.append(f"{sweet.get('product_name', 'Item')} ({sweet.get('variant_weight')}) unavailable or out of stock")

                sweet_total = round(price * qty, 2)
                hamper_sweets_total += sweet_total

                hamper_sweets.append({
                    "product_id": str(sweet["product_id"]),
                    "product_name": p["name"] if p else sweet["product_name"],
                    "product_image": p["image_url"] if p else sweet.get("product_image", ""),
                    "variant_weight": sweet["variant_weight"],
                    "unit_price": price,
                    "quantity": qty,
                    "item_total": sweet_total,
                    "stock": stock,
                    "available": sweet_avail,
                })

            packaging_price = float(item.get("packaging_price", 0.0))
            gift_wrap_price = float(item.get("gift_wrap_price", 0.0))
            hamper_final_total = round(hamper_sweets_total + packaging_price + gift_wrap_price, 2)

            subtotal += hamper_final_total
            total_quantity += 1

            result_items.append({
                "is_hamper": True,
                "hamper_id": item.get("hamper_id"),
                "product_id": f"hamper-{item.get('hamper_id')}",
                "product_name": f"Custom Mithai Hamper ({item.get('box_size', 'Gift Box')})",
                "product_image": item.get("box_image", "/images/sweets/assorted-sweets-box-2.jpg"),
                "box_id": str(item.get("box_id")),
                "box_name": item.get("box_name"),
                "box_size": item.get("box_size"),
                "box_image": item.get("box_image"),
                "packaging_price": packaging_price,
                "gift_wrap_price": gift_wrap_price,
                "customization": item.get("customization", {}),
                "items": hamper_sweets,
                "sweets_count": sum(s["quantity"] for s in hamper_sweets),
                "sweets_subtotal": round(hamper_sweets_total, 2),
                "quantity": 1,
                "item_total": hamper_final_total,
                "available": hamper_available,
                "problem_reasons": problem_reasons,
            })
        elif item.get("is_bulk"):
            product = products.get(item["product_id"])
            variant = None
            if product is not None:
                variant = next((v for v in product["variants"] if v["weight"] == item["variant_weight"]), None)

            price = variant["price"] if variant else item.get("unit_price", 0.0)
            stock = variant["stock"] if variant else 0
            available = bool(
                product and product["is_active"] and variant and variant["is_available"] and item["quantity"] <= stock
            )
            from apps.core.bulk_views import calculate_item_bulk_discount, get_bulk_rules
            from apps.core.hamper_views import parse_weight_to_grams
            rules = get_bulk_rules(db)
            grams = parse_weight_to_grams(item["variant_weight"])
            calc = calculate_item_bulk_discount(grams, item["quantity"], price, rules)

            total_quantity += item["quantity"]
            subtotal += calc["discounted_total"]

            result_items.append({
                "is_bulk": True,
                "is_hamper": False,
                "bulk_id": item.get("bulk_id"),
                "product_id": str(item["product_id"]),
                "product_name": product["name"] if product else item.get("product_name", "Sweet"),
                "product_image": product["image_url"] if product else item.get("product_image", ""),
                "variant_weight": item["variant_weight"],
                "variant_price": price,
                "quantity": item["quantity"],
                "normal_total": calc["normal_total"],
                "discount_percentage": calc["discount_percentage"],
                "discount_amount": calc["discount_amount"],
                "item_total": calc["discounted_total"],
                "total_weight_kg": calc["total_weight_kg"],
                "stock": stock,
                "available": available,
            })
        else:
            product = products.get(item["product_id"])
            variant = None
            if product is not None:
                variant = next((v for v in product["variants"] if v["weight"] == item["variant_weight"]), None)

            # Use live values when the product still exists, else the saved copy
            price = variant["price"] if variant else item["variant_price"]
            stock = variant["stock"] if variant else 0
            # Can this item be ordered exactly as it is in the cart?
            available = bool(
                product and product["is_active"] and variant and variant["is_available"] and item["quantity"] <= stock
            )
            item_total = round(price * item["quantity"], 2)
            # Every item is counted. Items that cannot be ordered are marked "available": false
            # so the page can warn the customer (checkout stays blocked until they are fixed).
            total_quantity += item["quantity"]
            subtotal += item_total

            result_items.append(
                {
                    "is_hamper": False,
                    "product_id": str(item["product_id"]),
                    "product_name": product["name"] if product else item["product_name"],
                    "product_image": product["image_url"] if product else item["product_image"],
                    "variant_weight": item["variant_weight"],
                    "variant_price": price,
                    "quantity": item["quantity"],
                    "item_total": item_total,
                    "stock": stock,
                    "available": available,
                }
            )
    return {"items": result_items, "total_quantity": total_quantity, "subtotal": round(subtotal, 2)}


# ---------------------------------------------------------------------------
# Cart APIs  (authentication_classes([]) = no login needed, guest id only)
# ---------------------------------------------------------------------------

@api_view(["GET"])
@authentication_classes([])
def cart_detail(request):
    owner_id, error = get_owner(request)
    if error:
        return error
    db = get_db()
    return Response(cart_to_json(db, db.carts.find_one({"owner_id": owner_id})))


@api_view(["POST"])
@authentication_classes([])
def cart_add(request):
    owner_id, error = get_owner(request)
    if error:
        return error
    product_object_id, weight, quantity, error = read_item_request(request.data, quantity_required=False)
    if error:
        return error

    db = get_db()
    product, variant, error = load_variant(db, product_object_id, weight)
    if error:
        return error

    cart = db.carts.find_one({"owner_id": owner_id})
    items = cart["items"] if cart else []
    item = find_item(items, product_object_id, weight)

    # Same product + weight added again: increase the quantity, do not make a second row
    already_in_cart = item["quantity"] if item else 0
    new_quantity = already_in_cart + quantity
    if new_quantity > variant["stock"]:
        message = f"Only {variant['stock']} available"
        if already_in_cart:
            message += f" ({already_in_cart} already in your cart)"
        return error_response(message + ".", status.HTTP_409_CONFLICT)

    if item is None:
        item = {"product_id": product_object_id, "variant_weight": weight, "quantity": new_quantity}
        items.append(item)
    item["quantity"] = new_quantity
    refresh_snapshot(item, product, variant)

    save_items(db, owner_id, items)
    return Response(cart_to_json(db, {"items": items}))


@api_view(["PUT"])
@authentication_classes([])
def cart_update(request):
    owner_id, error = get_owner(request)
    if error:
        return error
    product_object_id, weight, quantity, error = read_item_request(request.data, quantity_required=True)
    if error:
        return error

    db = get_db()
    cart = db.carts.find_one({"owner_id": owner_id})
    items = cart["items"] if cart else []
    item = find_item(items, product_object_id, weight)
    if item is None:
        return error_response("This item is not in your cart.", status.HTTP_404_NOT_FOUND)

    product, variant, error = load_variant(db, product_object_id, weight)
    if error:
        return error
    if quantity > variant["stock"]:
        return error_response(f"Only {variant['stock']} available.", status.HTTP_409_CONFLICT)

    item["quantity"] = quantity
    refresh_snapshot(item, product, variant)
    save_items(db, owner_id, items)
    return Response(cart_to_json(db, {"items": items}))


@api_view(["DELETE"])
@authentication_classes([])
def cart_remove(request, product_id, variant_weight):
    owner_id, error = get_owner(request)
    if error:
        return error

    db = get_db()
    cart = db.carts.find_one({"owner_id": owner_id})
    items = cart["items"] if cart else []

    # Handle removing a hamper item
    if str(product_id).startswith("hamper-") or variant_weight == "hamper":
        target_id = str(product_id).replace("hamper-", "")
        updated_items = [
            it for it in items
            if not (it.get("is_hamper") and (str(it.get("hamper_id")) == target_id or str(it.get("box_id")) == target_id))
        ]
        if len(updated_items) == len(items):
            return error_response("This hamper is not in your cart.", status.HTTP_404_NOT_FOUND)
        save_items(db, owner_id, updated_items)
        return Response(cart_to_json(db, {"items": updated_items}))

    # Handle removing a bulk item
    if str(product_id).startswith("bulk-") or variant_weight == "bulk":
        target_id = str(product_id).replace("bulk-", "")
        updated_items = [
            it for it in items
            if not (it.get("is_bulk") and (str(it.get("bulk_id")) == target_id or str(it.get("product_id")) == target_id))
        ]
        if len(updated_items) == len(items):
            return error_response("This bulk item is not in your cart.", status.HTTP_404_NOT_FOUND)
        save_items(db, owner_id, updated_items)
        return Response(cart_to_json(db, {"items": updated_items}))

    product_object_id = to_object_id(product_id)
    if product_object_id is None:
        return error_response("Invalid product id.", status.HTTP_400_BAD_REQUEST)

    item = find_item(items, product_object_id, variant_weight)
    if item is None:
        return error_response("This item is not in your cart.", status.HTTP_404_NOT_FOUND)

    items.remove(item)
    save_items(db, owner_id, items)
    return Response(cart_to_json(db, {"items": items}))


@api_view(["DELETE"])
@authentication_classes([])
def cart_clear(request):
    owner_id, error = get_owner(request)
    if error:
        return error
    db = get_db()
    save_items(db, owner_id, [])
    return Response(cart_to_json(db, {"items": []}))
