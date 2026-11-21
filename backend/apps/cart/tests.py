import uuid
from datetime import datetime, timezone

from django.test import override_settings
from rest_framework.test import APITestCase

from config.mongodb import get_db

TEST_DB_NAME = "mithaimart_test"  # separate database, real data is never touched


@override_settings(MONGO_DB_NAME=TEST_DB_NAME)
class CartApiTests(APITestCase):
    def setUp(self):
        db = get_db()
        db.client.drop_database(TEST_DB_NAME)
        db.carts.create_index("owner_id", unique=True)
        self.guest_id = str(uuid.uuid4())

        category_id = db.categories.insert_one({"name": "Sweets", "is_active": True}).inserted_id
        self.product_id = str(
            db.products.insert_one(
                {
                    "name": "Kaju Katli",
                    "description": "x",
                    "category_id": category_id,
                    "image_url": "https://example.com/kaju.jpg",
                    "is_active": True,
                    "created_at": datetime.now(timezone.utc),
                    "variants": [
                        {"weight": "250g", "price": 250.0, "stock": 5, "is_available": True},
                        {"weight": "500g", "price": 500.0, "stock": 0, "is_available": True},
                        {"weight": "1kg", "price": 1000.0, "stock": 9, "is_available": False},
                    ],
                }
            ).inserted_id
        )

    def tearDown(self):
        get_db().client.drop_database(TEST_DB_NAME)

    # helpers -------------------------------------------------------------
    def call(self, method, url, body=None, guest_id="default"):
        headers = {}
        guest_id = self.guest_id if guest_id == "default" else guest_id
        if guest_id is not None:
            headers["HTTP_X_GUEST_ID"] = guest_id
        return getattr(self.client, method)(url, body, format="json", **headers)

    def add(self, weight="250g", quantity=1, **extra):
        body = {"product_id": self.product_id, "variant_weight": weight, "quantity": quantity, **extra}
        return self.call("post", "/api/cart/add/", body)

    # tests ---------------------------------------------------------------
    def test_empty_cart(self):
        response = self.call("get", "/api/cart/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {"items": [], "total_quantity": 0, "subtotal": 0.0})

    def test_guest_id_is_required_and_must_be_uuid(self):
        self.assertEqual(self.call("get", "/api/cart/", guest_id=None).status_code, 400)
        self.assertEqual(self.call("get", "/api/cart/", guest_id="not-a-uuid").status_code, 400)
        self.assertEqual(self.call("delete", "/api/cart/clear/", guest_id=None).status_code, 400)

    def test_add_item_saves_cart_in_mongodb(self):
        response = self.add(quantity=2)
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["total_quantity"], 2)
        self.assertEqual(data["subtotal"], 500.0)
        self.assertEqual(data["items"][0]["product_name"], "Kaju Katli")
        saved = get_db().carts.find_one({"owner_id": f"guest:{self.guest_id}"})
        self.assertEqual(len(saved["items"]), 1)
        self.assertEqual(saved["items"][0]["quantity"], 2)
        self.assertEqual(str(saved["items"][0]["product_id"]), self.product_id)
        self.assertEqual(saved["items"][0]["variant_price"], 250.0)
        self.assertIn("created_at", saved)
        self.assertIn("updated_at", saved)

    def test_price_sent_by_client_is_ignored(self):
        response = self.add(price=1, variant_price=1)
        self.assertEqual(response.json()["items"][0]["variant_price"], 250.0)
        self.assertEqual(response.json()["subtotal"], 250.0)

    def test_adding_same_variant_again_increases_quantity(self):
        self.add(quantity=1)
        response = self.add(quantity=2)
        items = response.json()["items"]
        self.assertEqual(len(items), 1)
        self.assertEqual(items[0]["quantity"], 3)
        self.assertEqual(len(get_db().carts.find_one({"owner_id": f"guest:{self.guest_id}"})["items"]), 1)

    def test_cannot_add_more_than_stock(self):
        self.assertEqual(self.add(quantity=6).status_code, 409)  # stock is 5
        self.add(quantity=4)
        response = self.add(quantity=2)  # 4 + 2 > 5
        self.assertEqual(response.status_code, 409)
        self.assertIn("4 already in your cart", response.json()["error"])
        self.assertEqual(self.call("get", "/api/cart/").json()["total_quantity"], 4)

    def test_unavailable_variants_rejected(self):
        self.assertEqual(self.add(weight="500g").status_code, 409)  # stock 0
        self.assertEqual(self.add(weight="1kg").status_code, 409)  # is_available false
        self.assertEqual(self.add(weight="2kg").status_code, 404)  # does not exist
        self.assertEqual(self.call("get", "/api/cart/").json()["items"], [])

    def test_bad_add_requests(self):
        bad_bodies = [
            {},
            {"product_id": "abc", "variant_weight": "250g"},
            {"product_id": "a" * 24, "variant_weight": "250g"},  # valid id, no such product
            {"product_id": self.product_id},
            {"product_id": self.product_id, "variant_weight": "250g", "quantity": 0},
            {"product_id": self.product_id, "variant_weight": "250g", "quantity": -1},
            {"product_id": self.product_id, "variant_weight": "250g", "quantity": 1.5},
            {"product_id": self.product_id, "variant_weight": "250g", "quantity": True},
        ]
        codes = [self.call("post", "/api/cart/add/", body).status_code for body in bad_bodies]
        self.assertEqual(codes, [400, 400, 404, 400, 400, 400, 400, 400])

    def test_inactive_product_cannot_be_added(self):
        get_db().products.update_one({}, {"$set": {"is_active": False}})
        self.assertEqual(self.add().status_code, 404)

    def test_update_quantity(self):
        self.add(quantity=1)
        body = {"product_id": self.product_id, "variant_weight": "250g", "quantity": 4}
        response = self.call("put", "/api/cart/update/", body)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["items"][0]["quantity"], 4)
        self.assertEqual(response.json()["subtotal"], 1000.0)
        # decrease again
        body["quantity"] = 2
        self.assertEqual(self.call("put", "/api/cart/update/", body).json()["total_quantity"], 2)

    def test_update_rejects_zero_too_many_and_missing_items(self):
        self.add(quantity=1)
        body = {"product_id": self.product_id, "variant_weight": "250g", "quantity": 0}
        self.assertEqual(self.call("put", "/api/cart/update/", body).status_code, 400)
        body["quantity"] = 6
        self.assertEqual(self.call("put", "/api/cart/update/", body).status_code, 409)
        body = {"product_id": self.product_id, "variant_weight": "1kg", "quantity": 1}
        self.assertEqual(self.call("put", "/api/cart/update/", body).status_code, 404)
        self.assertEqual(self.call("get", "/api/cart/").json()["items"][0]["quantity"], 1)

    def test_remove_item(self):
        self.add()
        url = f"/api/cart/remove/{self.product_id}/250g/"
        response = self.call("delete", url)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["items"], [])
        self.assertEqual(self.call("delete", url).status_code, 404)  # already removed
        self.assertEqual(self.call("delete", "/api/cart/remove/abc/250g/").status_code, 400)

    def test_bulk_cart_add_merges_repeated_items(self):
        payload = {
            "items": [{
                "product_id": self.product_id,
                "variant_weight": "250g",
                "quantity": 2,
            }]
        }
        self.assertEqual(self.call("post", "/api/bulk/cart/add/", payload).status_code, 201)
        response = self.call("post", "/api/bulk/cart/add/", payload)
        self.assertEqual(response.status_code, 201)

        db = get_db()
        saved = db.carts.find_one({"owner_id": f"guest:{self.guest_id}"})
        bulk_items = [item for item in saved["items"] if item.get("is_bulk")]
        self.assertEqual(len(bulk_items), 1)
        self.assertEqual(bulk_items[0]["quantity"], 4)

    def test_remove_item_skips_malformed_cart_rows(self):
        db = get_db()
        db.carts.insert_one({
            "owner_id": f"guest:{self.guest_id}",
            "items": [
                {"variant_weight": "250g"},
                {
                    "product_id": db.products.find_one({"name": "Kaju Katli"})["_id"],
                    "variant_weight": "250g",
                    "quantity": 1,
                    "product_name": "Kaju Katli",
                    "product_image": "https://example.com/kaju.jpg",
                    "variant_price": 250.0,
                },
            ],
        })
        response = self.call("delete", f"/api/cart/remove/{self.product_id}/250g/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["items"], [])

    def test_clear_cart(self):
        self.add()
        response = self.call("delete", "/api/cart/clear/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(self.call("get", "/api/cart/").json()["items"], [])
        self.assertEqual(self.call("delete", "/api/cart/clear/").status_code, 200)  # clearing twice is fine

    def test_carts_are_separate_per_guest(self):
        self.add()
        other = str(uuid.uuid4())
        self.assertEqual(self.call("get", "/api/cart/", guest_id=other).json()["items"], [])

    def test_cart_shows_live_price_and_flags_items_that_became_unavailable(self):
        self.add(quantity=3)
        db = get_db()
        db.products.update_one({}, {"$set": {"variants.0.price": 300.0}})
        data = self.call("get", "/api/cart/").json()
        self.assertEqual(data["items"][0]["variant_price"], 300.0)  # new price, not the old saved one
        self.assertEqual(data["subtotal"], 900.0)

        db.products.update_one({}, {"$set": {"variants.0.stock": 2}})  # fewer left than in cart
        data = self.call("get", "/api/cart/").json()
        self.assertFalse(data["items"][0]["available"])
        self.assertEqual(data["items"][0]["stock"], 2)
        self.assertEqual(data["total_quantity"], 3)  # still counted, but flagged so checkout can be blocked

        db.products.delete_many({})  # product removed from the shop
        data = self.call("get", "/api/cart/").json()
        self.assertFalse(data["items"][0]["available"])
        self.assertEqual(data["items"][0]["product_name"], "Kaju Katli")  # saved copy is used
        self.assertEqual(self.call("delete", f"/api/cart/remove/{self.product_id}/250g/").status_code, 200)
