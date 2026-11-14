import uuid
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta, timezone

from django.test import override_settings
from rest_framework.test import APIClient, APITestCase

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


# ---------------------------------------------------------------------------
# Order placement and order history
# ---------------------------------------------------------------------------

@override_settings(MONGO_DB_NAME=TEST_DB_NAME)
class OrderApiTests(APITestCase):
    def setUp(self):
        db = get_db()
        db.client.drop_database(TEST_DB_NAME)
        db.orders.create_index("order_number", unique=True)
        db.carts.create_index("guest_id", unique=True)
        self.guest_id = str(uuid.uuid4())
        self.other_guest_id = str(uuid.uuid4())
        category_id = db.categories.insert_one({"name": "Sweets", "is_active": True}).inserted_id
        self.kaju_id = str(self.make_product(category_id, "Kaju Katli", "250g", 250.0, 5, "https://example.com/k.jpg"))
        self.jamun_id = str(self.make_product(category_id, "Gulab Jamun", "500g", 220.0, 8, ""))

    def make_product(self, category_id, name, weight, price, stock, image):
        return get_db().products.insert_one(
            {
                "name": name,
                "description": "x",
                "category_id": category_id,
                "image_url": image,
                "is_active": True,
                "created_at": datetime.now(timezone.utc),
                "variants": [{"weight": weight, "price": price, "stock": stock, "is_available": True}],
            }
        ).inserted_id

    def tearDown(self):
        get_db().client.drop_database(TEST_DB_NAME)

    # helpers -------------------------------------------------------------
    def call(self, method, url, body=None, guest_id="default", client=None):
        guest_id = self.guest_id if guest_id == "default" else guest_id
        headers = {"HTTP_X_GUEST_ID": guest_id} if guest_id else {}
        return getattr(client or self.client, method)(url, body, format="json", **headers)

    def add_to_cart(self, product_id, weight, quantity, guest_id="default"):
        body = {"product_id": product_id, "variant_weight": weight, "quantity": quantity}
        self.assertEqual(self.call("post", "/api/cart/add/", body, guest_id=guest_id).status_code, 200)

    def make_address(self, guest_id="default", **changes):
        body = {**VALID_ADDRESS, **changes}
        return self.call("post", "/api/addresses/", body, guest_id=guest_id).json()["id"]

    def place(self, address_id, guest_id="default", **extra):
        return self.call("post", "/api/orders/create/", {"address_id": address_id, **extra}, guest_id=guest_id)

    def stock(self, name):
        return get_db().products.find_one({"name": name})["variants"][0]["stock"]

    def cart_quantity(self):
        return self.call("get", "/api/cart/").json()["total_quantity"]

    # tests ---------------------------------------------------------------
    def test_valid_order_is_saved_with_backend_totals(self):
        self.add_to_cart(self.kaju_id, "250g", 2)
        self.add_to_cart(self.jamun_id, "500g", 1)
        address_id = self.make_address()
        # the browser sends fake prices and totals: they must all be ignored
        response = self.place(address_id, total_amount=1, subtotal=1, unit_price=1, items=[{"unit_price": 1}])
        self.assertEqual(response.status_code, 201, response.content)
        order = response.json()
        self.assertEqual(order["subtotal"], 720.0)  # 2 x 250 + 220, from the database
        self.assertEqual(order["total_amount"], 720.0)
        self.assertIsNone(order["delivery_charge"])
        self.assertEqual(order["order_status"], "Pending")
        self.assertEqual(order["payment_status"], "Pending")
        self.assertEqual(order["payment_method"], "To be confirmed")
        self.assertRegex(order["order_number"], r"^MM-\d{8}-[A-Z0-9]{6}$")
        self.assertEqual([i["item_total"] for i in order["items"]], [500.0, 220.0])
        self.assertEqual(order["items"][0]["product_name"], "Kaju Katli")
        self.assertEqual(order["items"][0]["product_image"], "https://example.com/k.jpg")
        self.assertNotIn("guest_id", order)

        saved = get_db().orders.find_one({})
        self.assertEqual(saved["guest_id"], self.guest_id)
        self.assertEqual(str(saved["items"][0]["product_id"]), self.kaju_id)  # real ObjectId reference
        self.assertEqual(saved["delivery_address"]["city"], "Bengaluru")

    def test_stock_decreases_and_cart_is_cleared_after_success(self):
        self.add_to_cart(self.kaju_id, "250g", 2)
        address_id = self.make_address()
        self.assertEqual(self.place(address_id).status_code, 201)
        self.assertEqual(self.stock("Kaju Katli"), 3)  # 5 - 2
        self.assertEqual(self.cart_quantity(), 0)
        self.assertEqual(self.call("get", "/api/cart/").json()["items"], [])

    def test_empty_cart_creates_no_order(self):
        address_id = self.make_address()
        response = self.place(address_id)
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json()["error"], "Your cart is empty.")
        self.assertEqual(get_db().orders.count_documents({}), 0)

    def test_second_request_after_success_cannot_create_duplicate(self):
        self.add_to_cart(self.kaju_id, "250g", 1)
        address_id = self.make_address()
        self.assertEqual(self.place(address_id).status_code, 201)
        self.assertEqual(self.place(address_id).status_code, 400)  # the cart is empty now
        self.assertEqual(get_db().orders.count_documents({}), 1)
        self.assertEqual(self.stock("Kaju Katli"), 4)

    def test_bad_address_ids_keep_cart_and_stock(self):
        self.add_to_cart(self.kaju_id, "250g", 2)
        other_address = self.make_address(guest_id=self.other_guest_id)
        for body_id, expected in (("", 400), (None, 400), ("abc", 400), ("a" * 24, 404), (other_address, 404)):
            self.assertEqual(self.place(body_id).status_code, expected, body_id)
        self.assertEqual(get_db().orders.count_documents({}), 0)
        self.assertEqual(self.stock("Kaju Katli"), 5)
        self.assertEqual(self.cart_quantity(), 2)

    def test_insufficient_stock_fails_and_changes_nothing(self):
        self.add_to_cart(self.kaju_id, "250g", 4)
        self.add_to_cart(self.jamun_id, "500g", 1)
        address_id = self.make_address()
        get_db().products.update_one({"name": "Kaju Katli"}, {"$set": {"variants.0.stock": 2}})
        response = self.place(address_id)
        self.assertEqual(response.status_code, 409)
        self.assertIn("Only 2 left", response.json()["problems"][0]["message"])
        self.assertEqual(get_db().orders.count_documents({}), 0)
        self.assertEqual(self.stock("Kaju Katli"), 2)
        self.assertEqual(self.stock("Gulab Jamun"), 8)  # the OK item was not reduced either
        self.assertEqual(self.cart_quantity(), 5)  # cart is NOT cleared

    def test_unavailable_variant_fails(self):
        self.add_to_cart(self.kaju_id, "250g", 1)
        address_id = self.make_address()
        get_db().products.update_one({"name": "Kaju Katli"}, {"$set": {"variants.0.is_available": False}})
        self.assertEqual(self.place(address_id).status_code, 409)
        self.assertEqual(get_db().orders.count_documents({}), 0)
        self.assertEqual(self.cart_quantity(), 1)

    def test_stock_taken_by_someone_else_midway_is_rolled_back(self):
        """Stock runs out between our check and our stock reduction for the second item."""
        from unittest import mock

        from apps.orders import views as order_views

        self.add_to_cart(self.kaju_id, "250g", 2)
        self.add_to_cart(self.jamun_id, "500g", 3)
        address_id = self.make_address()
        real_build = order_views.build_order_lines

        def build_then_steal_stock(db, cart_items):
            lines, problems = real_build(db, cart_items)
            # another customer buys the last Gulab Jamun right after our check
            db.products.update_one({"name": "Gulab Jamun"}, {"$set": {"variants.0.stock": 0}})
            return lines, problems

        with mock.patch.object(order_views, "build_order_lines", build_then_steal_stock):
            response = self.place(address_id)
        self.assertEqual(response.status_code, 409)
        self.assertEqual(self.stock("Kaju Katli"), 5)  # reduced first, then given back
        self.assertEqual(self.stock("Gulab Jamun"), 0)  # untouched by us
        self.assertEqual(get_db().orders.count_documents({}), 0)
        self.assertEqual(self.cart_quantity(), 5)
        self.assertNotIn("checkout_lock", get_db().carts.find_one({"guest_id": self.guest_id}))

    def test_database_error_while_saving_order_restores_stock(self):
        from unittest import mock

        from pymongo.errors import PyMongoError

        from apps.orders import views as order_views

        self.add_to_cart(self.kaju_id, "250g", 2)
        address_id = self.make_address()
        with mock.patch.object(order_views, "make_order_number", side_effect=PyMongoError("boom")):
            response = self.place(address_id)
        self.assertEqual(response.status_code, 503)
        self.assertNotIn("boom", response.content.decode())  # internal error text is not shown
        self.assertEqual(self.stock("Kaju Katli"), 5)
        self.assertEqual(self.cart_quantity(), 2)
        self.assertEqual(get_db().orders.count_documents({}), 0)

    def test_busy_cart_lock_blocks_second_order_but_old_lock_is_ignored(self):
        self.add_to_cart(self.kaju_id, "250g", 1)
        address_id = self.make_address()
        now = datetime.now(timezone.utc)
        get_db().carts.update_one({}, {"$set": {"checkout_lock": "someone", "checkout_lock_at": now}})
        self.assertEqual(self.place(address_id).status_code, 409)
        self.assertEqual(get_db().orders.count_documents({}), 0)
        # a lock older than a minute is treated as stuck and ignored
        get_db().carts.update_one({}, {"$set": {"checkout_lock_at": now - timedelta(minutes=5)}})
        self.assertEqual(self.place(address_id).status_code, 201)

    def test_parallel_double_click_creates_only_one_order(self):
        self.add_to_cart(self.kaju_id, "250g", 2)
        address_id = self.make_address()

        def send_request(_):
            return self.call("post", "/api/orders/create/", {"address_id": address_id}, client=APIClient()).status_code

        with ThreadPoolExecutor(max_workers=6) as pool:
            codes = list(pool.map(send_request, range(6)))
        self.assertEqual(codes.count(201), 1, codes)
        self.assertTrue(all(code in (201, 400, 409) for code in codes), codes)
        self.assertEqual(get_db().orders.count_documents({}), 1)
        self.assertEqual(self.stock("Kaju Katli"), 3)  # reduced only once

    def test_order_keeps_a_copy_of_the_address(self):
        self.add_to_cart(self.kaju_id, "250g", 1)
        address_id = self.make_address()
        order = self.place(address_id).json()
        self.call("put", f"/api/addresses/{address_id}/", {**VALID_ADDRESS, "city": "Mysuru", "street": "New Street"})
        self.call("delete", f"/api/addresses/{address_id}/")
        saved = self.call("get", f"/api/orders/{order['id']}/").json()
        self.assertEqual(saved["delivery_address"]["city"], "Bengaluru")
        self.assertEqual(saved["delivery_address"]["street"], "MG Road")

    def test_order_keeps_a_copy_of_product_details_and_price(self):
        self.add_to_cart(self.kaju_id, "250g", 1)
        address_id = self.make_address()
        order = self.place(address_id).json()
        get_db().products.update_one({"name": "Kaju Katli"}, {"$set": {"variants.0.price": 999.0, "name": "Renamed"}})
        saved = self.call("get", f"/api/orders/{order['id']}/").json()
        self.assertEqual(saved["items"][0]["unit_price"], 250.0)
        self.assertEqual(saved["items"][0]["product_name"], "Kaju Katli")
        self.assertEqual(saved["total_amount"], 250.0)

    def test_order_numbers_are_unique(self):
        address_id = self.make_address()
        numbers = set()
        for _ in range(3):
            self.add_to_cart(self.kaju_id, "250g", 1)
            numbers.add(self.place(address_id).json()["order_number"])
        self.assertEqual(len(numbers), 3)

    def test_order_history_lists_only_my_orders_newest_first(self):
        address_id = self.make_address()
        my_numbers = []
        for _ in range(2):
            self.add_to_cart(self.kaju_id, "250g", 1)
            my_numbers.append(self.place(address_id).json()["order_number"])
        # another guest also orders
        self.add_to_cart(self.jamun_id, "500g", 1, guest_id=self.other_guest_id)
        other_address = self.make_address(guest_id=self.other_guest_id)
        self.assertEqual(self.place(other_address, guest_id=self.other_guest_id).status_code, 201)

        mine = self.call("get", "/api/orders/").json()
        self.assertEqual([order["order_number"] for order in mine], my_numbers[::-1])
        self.assertEqual(len(self.call("get", "/api/orders/", guest_id=self.other_guest_id).json()), 1)
        self.assertEqual(self.call("get", "/api/orders/", guest_id=str(uuid.uuid4())).json(), [])

    def test_cannot_view_another_guests_order(self):
        self.add_to_cart(self.kaju_id, "250g", 1)
        order_id = self.place(self.make_address()).json()["id"]
        url = f"/api/orders/{order_id}/"
        self.assertEqual(self.call("get", url).status_code, 200)
        self.assertEqual(self.call("get", url, guest_id=self.other_guest_id).status_code, 404)
        self.assertEqual(self.call("get", url, guest_id=None).status_code, 400)
        self.assertEqual(self.call("get", "/api/orders/abc/").status_code, 400)
        self.assertEqual(self.call("get", "/api/orders/" + "a" * 24 + "/").status_code, 404)

    def test_customers_cannot_change_order_status(self):
        self.add_to_cart(self.kaju_id, "250g", 1)
        order = self.place(self.make_address()).json()
        url = f"/api/orders/{order['id']}/"
        for method in ("put", "patch", "delete"):
            response = self.call(method, url, {"order_status": "Delivered"})
            self.assertEqual(response.status_code, 405, method)
        self.assertEqual(get_db().orders.find_one({})["order_status"], "Pending")
        # a status inside the order creation request is ignored too
        self.add_to_cart(self.kaju_id, "250g", 1)
        second = self.place(self.make_address(), order_status="Delivered", payment_status="Paid").json()
        self.assertEqual(second["order_status"], "Pending")
        self.assertEqual(second["payment_status"], "Pending")

    def test_guest_id_required(self):
        self.assertEqual(self.call("post", "/api/orders/create/", {}, guest_id=None).status_code, 400)
        self.assertEqual(self.call("get", "/api/orders/", guest_id=None).status_code, 400)
