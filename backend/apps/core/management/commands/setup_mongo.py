from django.core.management.base import BaseCommand

from config.mongodb import COLLECTIONS, get_db


class Command(BaseCommand):
    help = "Create MithaiMart MongoDB collections and indexes (safe to run many times)."

    def handle(self, *args, **options):
        db = get_db()
        existing = db.list_collection_names()
        for name in COLLECTIONS:
            if name not in existing:
                db.create_collection(name)

        # Unique indexes stop duplicate data
        db.users.create_index("email", unique=True)
        db.categories.create_index("name", unique=True)
        db.coupons.create_index("code", unique=True)
        # One variant per weight for each product
        db.product_variants.create_index([("product_id", 1), ("weight", 1)], unique=True)
        # Fast lookups
        db.products.create_index("category_id")
        db.orders.create_index("user_id")
        db.carts.create_index("user_id")
        # One cart per guest
        db.carts.create_index("guest_id", unique=True)
        # Addresses: quick lookup per guest, and at most ONE default address per guest
        db.addresses.create_index("guest_id")
        db.addresses.create_index(
            "guest_id", unique=True, partialFilterExpression={"is_default": True}, name="one_default_per_guest"
        )

        self.stdout.write(self.style.SUCCESS("MongoDB collections and indexes are ready."))
