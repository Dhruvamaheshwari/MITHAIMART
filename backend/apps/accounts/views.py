"""Address APIs (guest addresses).

There is no customer login yet, so addresses belong to the guest id sent in the
X-Guest-ID header (same idea as the cart). Every database query includes the guest id,
so one guest can never read or change another guest's addresses.
"""

import re

from rest_framework import status
from rest_framework.decorators import api_view, authentication_classes
from rest_framework.response import Response

from apps.cart.views import missing_guest_id, read_guest_id
from apps.products.views import current_time, error_response, to_object_id, validation_error
from config.mongodb import get_db

MAX_ADDRESSES = 10
PHONE_PATTERN = re.compile(r"^[6-9]\d{9}$")  # Indian mobile number: 10 digits, starts with 6-9
PINCODE_PATTERN = re.compile(r"^[1-9]\d{5}$")  # Indian pincode: 6 digits, does not start with 0

# field name -> label used in error messages
REQUIRED_TEXT_FIELDS = {
    "full_name": "Full name",
    "house_number": "House number",
    "street": "Street",
    "area": "Area",
    "city": "City",
    "state": "State",
}


def address_to_json(address):
    return {
        "id": str(address["_id"]),
        "full_name": address["full_name"],
        "phone_number": address["phone_number"],
        "house_number": address["house_number"],
        "street": address["street"],
        "area": address["area"],
        "city": address["city"],
        "state": address["state"],
        "pincode": address["pincode"],
        "landmark": address["landmark"],
        "is_default": address["is_default"],
        "created_at": address["created_at"].isoformat(),
        "updated_at": address["updated_at"].isoformat(),
    }


def validate_address(data):
    """Check the request body. Returns (cleaned_values, errors). errors maps field -> message."""
    errors = {}
    cleaned = {}

    for field, label in REQUIRED_TEXT_FIELDS.items():
        value = data.get(field)
        if not isinstance(value, str) or not value.strip():
            errors[field] = f"{label} is required."
        elif len(value.strip()) > 100:
            errors[field] = f"{label} must be 100 characters or less."
        else:
            cleaned[field] = value.strip()

    phone = data.get("phone_number")
    if not isinstance(phone, str) or not phone.strip():
        errors["phone_number"] = "Phone number is required."
    elif not PHONE_PATTERN.match(phone.strip()):
        errors["phone_number"] = "Enter a valid 10-digit Indian mobile number (starting with 6, 7, 8 or 9)."
    else:
        cleaned["phone_number"] = phone.strip()

    pincode = data.get("pincode")
    if not isinstance(pincode, str) or not pincode.strip():
        errors["pincode"] = "Pincode is required."
    elif not PINCODE_PATTERN.match(pincode.strip()):
        errors["pincode"] = "Enter a valid 6-digit pincode."
    else:
        cleaned["pincode"] = pincode.strip()

    landmark = data.get("landmark", "")  # optional
    if landmark is None:
        landmark = ""
    if not isinstance(landmark, str) or len(landmark.strip()) > 100:
        errors["landmark"] = "Landmark must be text of 100 characters or less."
    else:
        cleaned["landmark"] = landmark.strip()

    is_default = data.get("is_default", False)
    if not isinstance(is_default, bool):
        errors["is_default"] = "is_default must be true or false."
    else:
        cleaned["is_default"] = is_default

    return cleaned, errors


# ---------------------------------------------------------------------------
# Address APIs
# ---------------------------------------------------------------------------

@api_view(["GET", "POST"])
@authentication_classes([])
def address_list(request):
    guest_id = read_guest_id(request)
    if guest_id is None:
        return missing_guest_id()
    db = get_db()

    if request.method == "GET":
        # Only this guest's addresses. Default address first, then newest.
        addresses = db.addresses.find({"guest_id": guest_id}).sort([("is_default", -1), ("created_at", -1)])
        return Response([address_to_json(address) for address in addresses])

    # POST: add a new address
    if not isinstance(request.data, dict):
        return error_response("Send a JSON object.", status.HTTP_400_BAD_REQUEST)
    cleaned, errors = validate_address(request.data)
    if errors:
        return validation_error(errors)

    saved_count = db.addresses.count_documents({"guest_id": guest_id})
    if saved_count >= MAX_ADDRESSES:
        return error_response(f"You can save up to {MAX_ADDRESSES} addresses.", status.HTTP_409_CONFLICT)

    # The very first address is always the default one
    if saved_count == 0:
        cleaned["is_default"] = True
    # Only one default per guest: remove the old default before saving the new one
    if cleaned["is_default"]:
        db.addresses.update_many({"guest_id": guest_id}, {"$set": {"is_default": False}})

    now = current_time()
    cleaned.update({"guest_id": guest_id, "created_at": now, "updated_at": now})
    cleaned["_id"] = db.addresses.insert_one(cleaned).inserted_id
    return Response(address_to_json(cleaned), status=status.HTTP_201_CREATED)


@api_view(["GET", "PUT", "DELETE"])
@authentication_classes([])
def address_detail(request, address_id):
    guest_id = read_guest_id(request)
    if guest_id is None:
        return missing_guest_id()
    object_id = to_object_id(address_id)
    if object_id is None:
        return error_response("Invalid address id.", status.HTTP_400_BAD_REQUEST)

    db = get_db()
    # Ownership check: the guest id is part of the query. Another guest's address is simply
    # "not found" (404), so we do not even reveal that it exists.
    address = db.addresses.find_one({"_id": object_id, "guest_id": guest_id})
    if address is None:
        return error_response("Address not found.", status.HTTP_404_NOT_FOUND)

    if request.method == "GET":
        return Response(address_to_json(address))

    if request.method == "PUT":
        if not isinstance(request.data, dict):
            return error_response("Send a JSON object.", status.HTTP_400_BAD_REQUEST)
        cleaned, errors = validate_address(request.data)
        if errors:
            return validation_error(errors)

        # The current default stays default. To change it, set a different address as default.
        if address["is_default"]:
            cleaned["is_default"] = True
        elif cleaned["is_default"]:
            db.addresses.update_many(
                {"guest_id": guest_id, "_id": {"$ne": object_id}}, {"$set": {"is_default": False}}
            )

        cleaned["updated_at"] = current_time()
        db.addresses.update_one({"_id": object_id, "guest_id": guest_id}, {"$set": cleaned})
        return Response(address_to_json(db.addresses.find_one({"_id": object_id})))

    # DELETE
    db.addresses.delete_one({"_id": object_id, "guest_id": guest_id})
    if address["is_default"]:
        # Make the newest remaining address the new default
        newest = db.addresses.find_one({"guest_id": guest_id}, sort=[("created_at", -1)])
        if newest:
            db.addresses.update_one({"_id": newest["_id"]}, {"$set": {"is_default": True}})
    return Response(status=status.HTTP_204_NO_CONTENT)
