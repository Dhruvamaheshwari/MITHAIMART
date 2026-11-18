"""Saves product images uploaded by the admin. Used only by the admin upload API.

Two places are possible:
- Cloudinary, when the CLOUDINARY_* settings are filled in (.env). The secret stays on the server.
- MongoDB (collection "images"), when Cloudinary is not set up. The file itself is stored in the
  database and shown through /api/images/<id>/. Fine for now; Cloudinary is better for a real shop.
In both cases the product only keeps a LINK to the image.
"""

import logging

from bson import Binary
from bson.objectid import ObjectId
from django.utils import timezone

import cloudinary
import cloudinary.uploader
from django.conf import settings

from config.mongodb import get_db

logger = logging.getLogger(__name__)

MAX_IMAGE_BYTES = 5 * 1024 * 1024  # 5 MB
CLOUDINARY_FOLDER = "mithaimart/products"


class ImageUploadError(Exception):
    """Raised with a message that is safe to show to the admin."""

    def __init__(self, message, http_status):
        super().__init__(message)
        self.message = message
        self.http_status = http_status


def detect_image_type(first_bytes):
    """Look at the first bytes of the file to find out what it REALLY is.
    (The file name and the browser's content-type can be faked, the first bytes cannot.)
    Returns 'jpeg', 'png', 'webp' or None."""
    if first_bytes.startswith(b"\xff\xd8\xff"):
        return "jpeg"
    if first_bytes.startswith(b"\x89PNG\r\n\x1a\n"):
        return "png"
    if first_bytes[:4] == b"RIFF" and first_bytes[8:12] == b"WEBP":
        return "webp"
    return None


def is_cloudinary_configured():
    return bool(settings.CLOUDINARY_CLOUD_NAME and settings.CLOUDINARY_API_KEY and settings.CLOUDINARY_API_SECRET)


CONTENT_TYPES = {"jpeg": "image/jpeg", "png": "image/png", "webp": "image/webp"}


def store_image_in_db(uploaded_file):
    """Save the (already checked) file in MongoDB and return its link PATH, like /api/images/<id>/."""
    data = uploaded_file.read()
    result = get_db().images.insert_one({
        "content_type": CONTENT_TYPES[detect_image_type(data[:12])],
        "data": Binary(data),
        "size": len(data),
        "created_at": timezone.now(),
    })
    return f"/api/images/{result.inserted_id}/"


def read_image_from_db(image_id):
    """Return (content_type, bytes) or None when the id is wrong or the image does not exist."""
    if not ObjectId.is_valid(image_id):
        return None
    doc = get_db().images.find_one({"_id": ObjectId(image_id)})
    if doc is None:
        return None
    return doc["content_type"], bytes(doc["data"])


def upload_product_image(uploaded_file):
    """Check the file, save it (Cloudinary, or MongoDB when Cloudinary is not set up) and return its link.
    Raises ImageUploadError with a clear message when something is wrong."""
    if uploaded_file.size == 0:
        raise ImageUploadError("The file is empty.", 400)
    if uploaded_file.size > MAX_IMAGE_BYTES:
        raise ImageUploadError(f"The image is too large. The maximum size is {MAX_IMAGE_BYTES // (1024 * 1024)} MB.", 413)

    first_bytes = uploaded_file.read(12)
    uploaded_file.seek(0)
    if detect_image_type(first_bytes) is None:
        raise ImageUploadError("Only JPEG, PNG or WebP images are allowed.", 400)

    if not is_cloudinary_configured():
        return store_image_in_db(uploaded_file)

    cloudinary.config(
        cloud_name=settings.CLOUDINARY_CLOUD_NAME,
        api_key=settings.CLOUDINARY_API_KEY,
        api_secret=settings.CLOUDINARY_API_SECRET,
        secure=True,
    )
    try:
        result = cloudinary.uploader.upload(
            uploaded_file,
            folder=CLOUDINARY_FOLDER,
            resource_type="image",
            allowed_formats=["jpg", "png", "webp"],  # Cloudinary checks the type again
            timeout=30,
        )
        return result["secure_url"]
    except Exception as error:
        # The real reason goes to the server log only (never to the admin), with the secret hidden.
        reason = str(error).replace(settings.CLOUDINARY_API_SECRET, "***")
        logger.error("Cloudinary upload failed (%s): %s", type(error).__name__, reason)
        raise ImageUploadError("Could not upload the image. Please try again.", 502) from error
