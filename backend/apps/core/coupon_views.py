"""Coupon validation, listing and redemption APIs for MithaiMart."""

from datetime import datetime, timezone
from rest_framework import status
from rest_framework.decorators import api_view, authentication_classes
from rest_framework.response import Response

from apps.accounts.customer_auth import get_owner
from apps.cart.views import cart_to_json
from apps.products.views import current_time, error_response
from config.mongodb import get_db


def coupon_to_json(coupon):
    return {
        "id": str(coupon["_id"]),
        "code": coupon["code"],
        "discount_type": coupon.get("discount_type", "percentage"),
        "discount_value": float(coupon.get("discount_value", 10.0)),
        "minimum_order_amount": float(coupon.get("minimum_order_amount", 500.0)),
        "maximum_discount": float(coupon.get("maximum_discount", 500.0)),
        "is_used": bool(coupon.get("is_used", False)),
        "expires_at": coupon["expires_at"].isoformat() if coupon.get("expires_at") else None,
        "created_at": coupon["created_at"].isoformat() if coupon.get("created_at") else None,
    }


@api_view(["POST"])
@authentication_classes([])
def validate_coupon(request):
    """Validate a coupon code against current cart subtotal.
    All calculations are done securely on the backend.
    """
    owner_id, error = get_owner(request)
    if error:
        return error

    code = str(request.data.get("code", "")).strip().upper()
    if not code:
        return error_response("Please enter a coupon code.", status.HTTP_400_BAD_REQUEST)

    db = get_db()
    cart = db.carts.find_one({"owner_id": owner_id})
    cart_data = cart_to_json(db, cart)
    subtotal = float(cart_data.get("subtotal", 0.0))

    if subtotal <= 0:
        return error_response("Your cart is empty.", status.HTTP_400_BAD_REQUEST)

    coupon = db.coupons.find_one({"code": code})
    if not coupon:
        return error_response("Invalid coupon code.", status.HTTP_404_NOT_FOUND)

    # 1. Check if used
    if coupon.get("is_used"):
        return error_response("This coupon has already been redeemed.", status.HTTP_400_BAD_REQUEST)

    # 2. Check expiration
    now = current_time()
    expires_at = coupon.get("expires_at")
    if expires_at and expires_at < now:
        return error_response("This coupon has expired.", status.HTTP_400_BAD_REQUEST)

    # 3. Check ownership (if coupon was awarded to a specific owner)
    coupon_owner = coupon.get("owner_id")
    if coupon_owner and coupon_owner != owner_id:
        return error_response("This coupon belongs to another account.", status.HTTP_403_FORBIDDEN)

    # 4. Check minimum spend
    min_spend = float(coupon.get("minimum_order_amount", 0.0))
    if subtotal < min_spend:
        return error_response(
            f"This coupon requires a minimum cart total of ₹{int(min_spend)}. Add ₹{int(min_spend - subtotal)} more to apply.",
            status.HTTP_400_BAD_REQUEST
        )

    # 5. Calculate discount
    discount_type = coupon.get("discount_type", "percentage")
    discount_value = float(coupon.get("discount_value", 10.0))
    max_discount = float(coupon.get("maximum_discount", 999999.0))

    if discount_type == "percentage":
        raw_discount = subtotal * (discount_value / 100.0)
        discount_amount = min(raw_discount, max_discount)
    else:
        discount_amount = min(discount_value, subtotal)

    discount_amount = round(discount_amount, 2)
    final_total = round(max(0.0, subtotal - discount_amount), 2)

    return Response({
        "valid": True,
        "code": coupon["code"],
        "discount_type": discount_type,
        "discount_value": discount_value,
        "discount_amount": discount_amount,
        "subtotal": subtotal,
        "final_total": final_total,
        "message": f"Coupon applied! You saved ₹{discount_amount}.",
    })


@api_view(["GET"])
@authentication_classes([])
def my_coupons_list(request):
    """Return all active and past coupons for the current user/guest."""
    owner_id, error = get_owner(request)
    if error:
        return error

    db = get_db()
    coupons = list(db.coupons.find({"owner_id": owner_id}).sort("created_at", -1))
    return Response({"coupons": [coupon_to_json(c) for c in coupons]})
