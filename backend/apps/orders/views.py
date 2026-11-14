"""Checkout validation. This phase only CHECKS the checkout. It does not create an order,
does not take payment and does not touch the cart."""

from rest_framework import status
from rest_framework.decorators import api_view, authentication_classes
from rest_framework.response import Response

from apps.accounts.views import address_to_json
from apps.cart.views import cart_to_json, missing_guest_id, read_guest_id
from apps.products.views import error_response, to_object_id
from config.mongodb import get_db

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
