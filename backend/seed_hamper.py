"""Seed gift boxes and hamper settings into MongoDB."""

import os
import sys
from datetime import datetime, timezone

# Add backend directory to sys.path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import django
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
django.setup()

from config.mongodb import get_db

def seed():
    db = get_db()
    now = datetime.now(timezone.utc)

    # 1. Gift boxes
    boxes = [
        {
            "code": "small",
            "name": "Classic Heritage Gift Box",
            "size_label": "Small Box (500g)",
            "description": "Compact premium handcrafted box, perfect for intimate gifting and heartfelt gestures.",
            "max_capacity_grams": 500,
            "packaging_price": 80.0,
            "image_url": "/images/sweets/assorted-sweets-box-1.jpg",
            "is_active": True,
            "sort_order": 1,
            "created_at": now,
            "updated_at": now,
        },
        {
            "code": "medium",
            "name": "Royal Festive Gift Box",
            "size_label": "Medium Box (1000g)",
            "description": "Our most popular signature box with gold foiled accents and partitioned slots for assorted delights.",
            "max_capacity_grams": 1000,
            "packaging_price": 140.0,
            "image_url": "/images/sweets/assorted-sweets-box-2.jpg",
            "is_active": True,
            "sort_order": 2,
            "created_at": now,
            "updated_at": now,
        },
        {
            "code": "large",
            "name": "Imperial Grand Platter Box",
            "size_label": "Large Box (2000g)",
            "description": "A lavish festive hamper chest crafted with rich gold borders, designed for grand family feasts & luxury gifting.",
            "max_capacity_grams": 2000,
            "packaging_price": 220.0,
            "image_url": "/images/sweets/royal-mithai-box.jpg",
            "is_active": True,
            "sort_order": 3,
            "created_at": now,
            "updated_at": now,
        },
    ]

    for box in boxes:
        db.gift_boxes.update_one(
            {"code": box["code"]},
            {"$set": box},
            upsert=True
        )
    print(f"Seeded {len(boxes)} gift boxes.")

    # 2. Hamper settings
    settings_doc = {
        "key": "global_settings",
        "min_order_amount_for_coupon": 1000.0,
        "coupon_discount_type": "percentage",
        "coupon_discount_value": 10.0,
        "coupon_min_order_amount": 500.0,
        "coupon_max_discount": 500.0,
        "coupon_validity_days": 30,
        "gift_wrap_price": 50.0,
        "updated_at": now,
    }

    db.hamper_settings.update_one(
        {"key": "global_settings"},
        {"$set": settings_doc},
        upsert=True
    )
    print("Seeded hamper settings.")

if __name__ == "__main__":
    seed()
