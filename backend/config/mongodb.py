"""Simple MongoDB connection used by the whole project.

Usage anywhere in the backend:

    from config.mongodb import get_db
    db = get_db()
    db.categories.insert_one({"name": "Fresh Sweets"})
"""

from django.conf import settings
from pymongo import MongoClient

# Collections used by MithaiMart. MongoDB creates them automatically on first insert.
COLLECTIONS = [
    "users",
    "categories",
    "products",
    "product_variants",
    "carts",
    "orders",
    "addresses",
    "coupons",
    "reviews",
]

_client = None


def get_db():
    """Return the MithaiMart database. One MongoClient is reused (it manages its own connection pool)."""
    global _client
    if _client is None:
        _client = MongoClient(settings.MONGO_URI, serverSelectionTimeoutMS=3000, tz_aware=True)  # tz_aware: dates come back as UTC
    return _client[settings.MONGO_DB_NAME]


def ping():
    """Raise an error if MongoDB cannot be reached."""
    get_db().client.admin.command("ping")
    return True
