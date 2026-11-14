import uuid
from datetime import datetime, timezone

from django.test import override_settings
from rest_framework.test import APITestCase

from apps.accounts.tests import VALID_ADDRESS
from config.mongodb import get_db

TEST_DB_NAME = "mithaimart_test"


@override_settings(MONGO_DB_NAME=TEST_DB_NAME)
class CheckoutValidationTests(APITestCase):
    def setUp(self):
        db = get_db()
        db.client.drop_database(TEST_DB_NAME)
        self.guest_id = str(uuid.uuid4())
        category_id = db.categories.insert_one({"name": "Sweets", "is_active": True}).inserted_id
        self.product_id = str(
            db.products.insert_one(
                {
                    "name": "Kaju Katli",
                    "description": "x",
                    "category_id": category_id,
                    "image_url": "",
                    "is_active": True,
                    "created_at": datetime.now(timezone.utc),
                    "variants": [{"weight": "250g", "price": 250.0, "stock": 5, "is_available": True}],
                }
            ).inserted_id
        )

    def tearDown(self):
        get_db().client.drop_database(TEST_DB_NAME)

    # helpers -------------------------------------------------------------
    def call(self, method, url, body=None, guest_id="default"):
        guest_id = self.guest_id if guest_id == "default" else guest_id
        headers = {"HTTP_X_GUEST_ID": guest_id} if guest_id else {}
        return getattr(self.client, method)(url, body, format="json", **headers)

    def add_to_cart(self, quantity=2):
        body = {"product_id": self.product_id, "variant_weight": "250g", "quantity": quantity}
        self.assertEqual(self.call("post", "/api/cart/add/", body).status_code, 200)

    def make_address(self, guest_id="default"):
        return self.call("post", "/api/addresses/", VALID_ADDRESS, guest_id=guest_id).json()["id"]

    def validate(self, body, guest_id="default"):
        return self.call("post", "/api/checkout/validate/", body, guest_id=guest_id)

    # tests ---------------------------------------------------------------
    def test_guest_id_required(self):
        self.assertEqual(self.validate({}, guest_id=None).status_code, 400)

    def test_empty_cart_is_rejected(self):
        address_id = self.make_address()
        response = self.validate({"address_id": address_id})
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json()["error"], "Your cart is empty.")

    def test_address_must_be_selected(self):
        self.add_to_cart()
        for body in ({}, {"address_id": ""}, {"address_id": None}):
            response = self.validate(body)
            self.assertEqual(response.status_code, 400, body)
            self.assertEqual(response.json()["error"], "Please select a delivery address.")
        self.assertEqual(self.validate({"address_id": "abc"}).status_code, 400)
        self.assertEqual(self.validate({"address_id": "a" * 24}).status_code, 404)

    def test_other_guests_address_cannot_be_used(self):
        self.add_to_cart()
        other_guest = str(uuid.uuid4())
        others_address = self.make_address(guest_id=other_guest)
        response = self.validate({"address_id": others_address})
        self.assertEqual(response.status_code, 404)

    def test_valid_checkout_uses_backend_prices_and_ignores_client_totals(self):
        self.add_to_cart(quantity=2)
        address_id = self.make_address()
        response = self.validate({"address_id": address_id, "total": 1, "subtotal": 1, "price": 1})
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["status"], "ready")
        self.assertEqual(data["subtotal"], 500.0)  # 2 x 250 from the database
        self.assertEqual(data["total"], 500.0)
        self.assertEqual(data["total_quantity"], 2)
        self.assertIsNone(data["delivery_charge"])  # no delivery rule exists, so nothing is invented
        self.assertEqual(data["delivery_charge_note"], "To be confirmed")
        self.assertEqual(data["address"]["id"], address_id)

    def test_total_follows_current_database_price(self):
        self.add_to_cart(quantity=2)
        address_id = self.make_address()
        get_db().products.update_one({}, {"$set": {"variants.0.price": 300.0}})
        self.assertEqual(self.validate({"address_id": address_id}).json()["subtotal"], 600.0)

    def test_unavailable_items_are_reported(self):
        self.add_to_cart(quantity=4)
        address_id = self.make_address()
        get_db().products.update_one({}, {"$set": {"variants.0.stock": 2}})
        response = self.validate({"address_id": address_id})
        self.assertEqual(response.status_code, 409)
        problem = response.json()["problems"][0]
        self.assertEqual(problem["product_name"], "Kaju Katli")
        self.assertIn("Only 2 left", problem["message"])

        get_db().products.update_one({}, {"$set": {"variants.0.is_available": False}})
        self.assertEqual(self.validate({"address_id": address_id}).status_code, 409)

    def test_validation_does_not_create_order_or_clear_cart(self):
        self.add_to_cart(quantity=2)
        address_id = self.make_address()
        self.assertEqual(self.validate({"address_id": address_id}).status_code, 200)
        self.assertEqual(get_db().orders.count_documents({}), 0)
        cart = self.call("get", "/api/cart/").json()
        self.assertEqual(cart["total_quantity"], 2)
