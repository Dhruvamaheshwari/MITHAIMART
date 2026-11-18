"""Seed bulk pricing rules and slabs into MongoDB."""

import os
import sys
from datetime import datetime, timezone

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")

import django
django.setup()

from config.mongodb import get_db

def seed():
    db = get_db()
    now = datetime.now(timezone.utc)

    rules_doc = {
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
        "created_at": now,
        "updated_at": now,
    }

    db.bulk_pricing_rules.update_one(
        {"key": "global_bulk_rules"},
        {"$set": rules_doc},
        upsert=True
    )
    print("Successfully seeded bulk_pricing_rules collection.")

if __name__ == "__main__":
    seed()
