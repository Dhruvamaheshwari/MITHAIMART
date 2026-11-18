from django.core.management.base import BaseCommand
from pymongo.errors import OperationFailure

from config.mongodb import COLLECTIONS, get_db

# Older versions saved the owner of carts, addresses and orders in a "guest_id" field. It is now
# "owner_id" ("guest:<uuid>" for a guest browser, "user:<id>" for a logged-in customer).
# The old guest_id indexes must go: the old unique one would block carts of logged-in customers.
OLD_INDEXES = [
    ("carts", "guest_id_1"),
    ("addresses", "guest_id_1"),
    ("addresses", "one_default_per_guest"),
    ("orders", "guest_id_1"),
]


class Command(BaseCommand):
    help = "Create MithaiMart MongoDB collections and indexes (safe to run many times)."

    def handle(self, *args, **options):
        db = get_db()
        existing = db.list_collection_names()
        for name in COLLECTIONS:
            if name not in existing:
                db.create_collection(name)

        for collection_name, index_name in OLD_INDEXES:
            try:
                db[collection_name].drop_index(index_name)
            except OperationFailure:
                pass  # the old index does not exist, nothing to remove

        # Unique indexes stop duplicate data (for example two accounts with the same email)
        db.users.create_index("email", unique=True)
        db.categories.create_index("name", unique=True)
        db.coupons.create_index("code", unique=True)
        # One variant per weight for each product
        db.product_variants.create_index([("product_id", 1), ("weight", 1)], unique=True)
        # Fast lookups
        db.products.create_index("category_id")
        db.orders.create_index("owner_id")
        # Every order number is unique, so two orders can never share a number
        db.orders.create_index("order_number", unique=True)
        # One cart per owner
        db.carts.create_index("owner_id", unique=True)
        # Addresses: quick lookup per owner, and at most ONE default address per owner
        db.addresses.create_index("owner_id")
        db.addresses.create_index(
            "owner_id", unique=True, partialFilterExpression={"is_default": True}, name="one_default_per_owner"
        )

        self.stdout.write(self.style.SUCCESS("MongoDB collections and indexes are ready."))
