import uuid
from datetime import datetime, timezone

from django.contrib.auth.models import User
from django.core.cache import cache
from django.test import override_settings
from rest_framework.test import APITestCase
from rest_framework_simplejwt.tokens import AccessToken

from apps.accounts.tests import VALID_ADDRESS, make_customer_token
from config.mongodb import get_db

TEST_DB_NAME = "mithaimart_test"  # separate database, real data is never touched
PASSWORD = "Str0ng-pass!"


# The fast hasher only speeds up the tests. Real passwords still use Django's strong default.
@override_settings(
    MONGO_DB_NAME=TEST_DB_NAME,
    PASSWORD_HASHERS=["django.contrib.auth.hashers.MD5PasswordHasher"],
    LOW_STOCK_THRESHOLD=5,
)
class AdminApiTests(APITestCase):
    def setUp(self):
        cache.clear()  # the login rate limit uses the cache
        db = get_db()
        db.client.drop_database(TEST_DB_NAME)
        db.orders.create_index("order_number", unique=True)
        self.admin_user = User.objects.create_user("shopadmin", password=PASSWORD, is_staff=True)
        self.customer = User.objects.create_user("customer", password=PASSWORD)
        self.admin_headers = {"HTTP_AUTHORIZATION": f"Bearer {AccessToken.for_user(self.admin_user)}"}

        self.category_id = db.categories.insert_one(
            {"name": "Sweets", "description": "", "image_url": "", "is_active": True, "created_at": datetime.now(timezone.utc)}
        ).inserted_id
        self.kaju_id = str(self.make_product("Kaju Katli", [("250g", 250.0, 20), ("500g", 500.0, 3)]))
        self.jamun_id = str(self.make_product("Gulab Jamun", [("500g", 220.0, 10)], is_active=False))

    def make_product(self, name, variants, is_active=True):
        return get_db().products.insert_one(
            {
                "name": name,
                "description": "x",
                "category_id": self.category_id,
                "image_url": "",
                "is_active": is_active,
                "created_at": datetime.now(timezone.utc),
                "variants": [
                    {"weight": w, "price": p, "stock": s, "is_available": True} for w, p, s in variants
                ],
            }
        ).inserted_id

    def tearDown(self):
        get_db().client.drop_database(TEST_DB_NAME)

    # helpers -------------------------------------------------------------
    def admin(self, method, url, body=None):
        return getattr(self.client, method)(url, body, format="json", **self.admin_headers)

    def make_order(self, guest_id=None):
        """Place a real order through the customer APIs."""
        # ordering needs a logged-in customer, so make one (guest_id is only kept so old calls still work)
        _owner_id, token = make_customer_token(f"{uuid.uuid4().hex}@example.com")
        header = {"HTTP_AUTHORIZATION": f"Bearer {token}"}
        self.client.post(
            "/api/cart/add/",
            {"product_id": self.kaju_id, "variant_weight": "250g", "quantity": 2},
            format="json",
            **header,
        )
        address = self.client.post("/api/addresses/", VALID_ADDRESS, format="json", **header).json()
        response = self.client.post("/api/orders/create/", {"address_id": address["id"]}, format="json", **header)
        self.assertEqual(response.status_code, 201, response.content)
        return response.json()

    ADMIN_URLS = [
        ("get", "/api/admin/me/"),
        ("get", "/api/admin/stats/"),
        ("get", "/api/admin/products/"),
        ("get", "/api/admin/categories/"),
        ("get", "/api/admin/orders/"),
        ("patch", "/api/admin/products/" + "a" * 24 + "/stock/"),
        ("patch", "/api/admin/orders/" + "a" * 24 + "/status/"),
    ]

    # login ---------------------------------------------------------------
    def test_admin_login_returns_working_token(self):
        response = self.client.post("/api/admin/login/", {"username": "shopadmin", "password": PASSWORD}, format="json")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["username"], "shopadmin")
        self.assertNotIn("password", str(data).lower().replace("passwordhasher", ""))
        me = self.client.get("/api/admin/me/", HTTP_AUTHORIZATION=f"Bearer {data['access']}")
        self.assertEqual(me.status_code, 200)

    def test_login_failures(self):
        post = lambda body: self.client.post("/api/admin/login/", body, format="json")  # noqa: E731
        self.assertEqual(post({"username": "shopadmin", "password": "wrong"}).status_code, 401)
        self.assertEqual(post({"username": "nobody", "password": PASSWORD}).status_code, 401)
        self.assertEqual(post({"username": "shopadmin"}).status_code, 400)
        self.assertEqual(post({}).status_code, 400)
        # a normal (non-staff) account with the right password gets no admin token
        response = post({"username": "customer", "password": PASSWORD})
        self.assertEqual(response.status_code, 403)
        self.assertNotIn("access", response.json())
        # a disabled admin cannot log in
        User.objects.filter(pk=self.admin_user.pk).update(is_active=False)
        self.assertEqual(post({"username": "shopadmin", "password": PASSWORD}).status_code, 401)

    def test_login_is_rate_limited(self):
        codes = [
            self.client.post("/api/admin/login/", {"username": "shopadmin", "password": "bad"}, format="json").status_code
            for _ in range(12)
        ]
        self.assertEqual(codes[:10], [401] * 10)
        self.assertEqual(codes[10:], [429, 429])

    # access control -------------------------------------------------------
    def test_admin_apis_reject_requests_without_token(self):
        for method, url in self.ADMIN_URLS:
            response = getattr(self.client, method)(url, {}, format="json")
            self.assertEqual(response.status_code, 401, (method, url))

    def test_admin_apis_reject_garbage_and_guest_headers(self):
        for headers in ({"HTTP_AUTHORIZATION": "Bearer not-a-real-token"}, {"HTTP_X_GUEST_ID": str(uuid.uuid4())}):
            response = self.client.get("/api/admin/stats/", **headers)
            self.assertEqual(response.status_code, 401, headers)

    def test_non_admin_user_cannot_use_admin_apis_even_with_a_valid_token(self):
        headers = {"HTTP_AUTHORIZATION": f"Bearer {AccessToken.for_user(self.customer)}"}
        for method, url in self.ADMIN_URLS:
            response = getattr(self.client, method)(url, {}, format="json", **headers)
            self.assertEqual(response.status_code, 403, (method, url))

    def test_demoted_admin_loses_access_immediately(self):
        self.assertEqual(self.admin("get", "/api/admin/stats/").status_code, 200)
        User.objects.filter(pk=self.admin_user.pk).update(is_staff=False)  # token is still valid, role is not
        self.assertEqual(self.admin("get", "/api/admin/stats/").status_code, 403)

    def test_normal_users_cannot_change_products_categories_or_orders(self):
        headers = {"HTTP_AUTHORIZATION": f"Bearer {AccessToken.for_user(self.customer)}"}
        body = {"name": "X"}
        self.assertEqual(self.client.post("/api/products/", body, format="json", **headers).status_code, 403)
        self.assertEqual(self.client.post("/api/categories/", body, format="json").status_code, 401)
        self.assertEqual(self.client.delete(f"/api/products/{self.kaju_id}/", **headers).status_code, 403)
        self.assertEqual(get_db().products.count_documents({}), 2)

    # dashboard -------------------------------------------------------------
    def test_stats_come_from_the_database(self):
        order = self.make_order()
        self.assertEqual(order["order_status"], "Pending")
        data = self.admin("get", "/api/admin/stats/").json()
        self.assertEqual(data["total_products"], 2)
        self.assertEqual(data["total_categories"], 1)
        self.assertEqual(data["total_orders"], 1)
        self.assertEqual(data["pending_orders"], 1)
        self.assertEqual(data["low_stock_threshold"], 5)
        self.assertEqual(data["low_stock_products"], 1)  # Kaju 500g has stock 3. Inactive Jamun is not counted

        self.admin("patch", f"/api/admin/orders/{order['id']}/status/", {"order_status": "Confirmed"})
        self.assertEqual(self.admin("get", "/api/admin/stats/").json()["pending_orders"], 0)

    def test_low_stock_threshold_is_configurable(self):
        with override_settings(LOW_STOCK_THRESHOLD=25):
            data = self.admin("get", "/api/admin/stats/").json()
            self.assertEqual(data["low_stock_products"], 1)  # Kaju has weights with 20 and 3
            products = self.admin("get", "/api/admin/products/").json()
            kaju = next(p for p in products["products"] if p["name"] == "Kaju Katli")
            self.assertEqual([v["low_stock"] for v in kaju["variants"]], [True, True])
        with override_settings(LOW_STOCK_THRESHOLD=2):
            self.assertEqual(self.admin("get", "/api/admin/stats/").json()["low_stock_products"], 0)

    # products and categories lists ---------------------------------------
    def test_admin_product_list_includes_inactive_and_low_stock_flags(self):
        data = self.admin("get", "/api/admin/products/").json()
        self.assertEqual(data["low_stock_threshold"], 5)
        names = {p["name"]: p for p in data["products"]}
        self.assertEqual(set(names), {"Kaju Katli", "Gulab Jamun"})  # public list shows only active
        self.assertEqual(names["Kaju Katli"]["category_name"], "Sweets")
        self.assertEqual([v["low_stock"] for v in names["Kaju Katli"]["variants"]], [False, True])
        public = [p["name"] for p in self.client.get("/api/products/").json()]
        self.assertEqual(public, ["Kaju Katli"])

    def test_admin_category_list_shows_product_counts_and_inactive(self):
        empty_id = get_db().categories.insert_one(
            {"name": "Empty", "description": "", "image_url": "", "is_active": False, "created_at": datetime.now(timezone.utc)}
        ).inserted_id
        data = {c["name"]: c for c in self.admin("get", "/api/admin/categories/").json()}
        self.assertEqual(data["Sweets"]["product_count"], 2)
        self.assertEqual(data["Empty"]["product_count"], 0)
        self.assertFalse(data["Empty"]["is_active"])
        self.assertTrue(empty_id)

    # product management (existing APIs, used by the admin pages) ----------
    def test_admin_can_create_edit_deactivate_and_delete_a_product(self):
        body = {
            "name": "Soan Papdi",
            "description": "Flaky sweet",
            "category_id": str(self.category_id),
            "image_url": "https://example.com/soan.jpg",
            "variants": [{"weight": "500g", "price": 180, "stock": 12, "is_available": True}],
        }
        created = self.admin("post", "/api/products/", body)
        self.assertEqual(created.status_code, 201, created.content)
        product_id = created.json()["id"]
        self.assertIn("Soan Papdi", [p["name"] for p in self.client.get("/api/products/").json()])

        body["name"] = "Soan Papdi Special"
        body["variants"] = [{"weight": "500g", "price": 190, "is_available": True}]  # no stock sent
        edited = self.admin("put", f"/api/products/{product_id}/", body)
        self.assertEqual(edited.status_code, 200, edited.content)
        self.assertEqual(edited.json()["variants"][0]["price"], 190.0)
        self.assertEqual(edited.json()["variants"][0]["stock"], 12)  # stock was kept

        body["is_active"] = False
        self.admin("put", f"/api/products/{product_id}/", body)
        self.assertNotIn("Soan Papdi Special", [p["name"] for p in self.client.get("/api/products/").json()])
        self.assertEqual(self.client.get(f"/api/products/{product_id}/").status_code, 404)

        self.assertEqual(self.admin("delete", f"/api/products/{product_id}/").status_code, 204)
        self.assertEqual(get_db().products.count_documents({"name": "Soan Papdi Special"}), 0)

    def test_editing_a_product_does_not_overwrite_stock_changed_by_an_order(self):
        """Admin opens the edit form (stock 20), a customer orders 2, admin saves: stock must stay 18."""
        body = {
            "name": "Kaju Katli",
            "description": "x",
            "category_id": str(self.category_id),
            "variants": [{"weight": "250g", "price": 260, "is_available": True}, {"weight": "500g", "price": 500, "is_available": True}],
        }
        self.make_order()  # stock 20 -> 18
        self.admin("put", f"/api/products/{self.kaju_id}/", body)
        saved = get_db().products.find_one({"name": "Kaju Katli"})
        self.assertEqual([v["stock"] for v in saved["variants"]], [18, 3])
        self.assertEqual(saved["variants"][0]["price"], 260.0)

    def test_new_variant_without_stock_starts_at_zero_and_bad_data_is_rejected(self):
        body = {
            "name": "Kaju Katli",
            "description": "x",
            "category_id": str(self.category_id),
            "variants": [{"weight": "250g", "price": 250}, {"weight": "1kg", "price": 1000}],
        }
        response = self.admin("put", f"/api/products/{self.kaju_id}/", body)
        self.assertEqual([v["stock"] for v in response.json()["variants"]], [20, 0])
        for bad in (
            {**body, "category_id": "abc"},
            {**body, "category_id": "a" * 24},
            {**body, "variants": [{"weight": "250g", "price": -1}]},
            {**body, "variants": [{"weight": "250g", "price": 5, "stock": -3}]},
            {**body, "name": ""},
        ):
            self.assertEqual(self.admin("put", f"/api/products/{self.kaju_id}/", bad).status_code, 400, bad)

    def test_image_url_validation(self):
        base = {
            "name": "Img",
            "description": "x",
            "category_id": str(self.category_id),
            "variants": [{"weight": "1kg", "price": 100, "stock": 1}],
        }
        for good in ("", "https://example.com/a.jpg", "http://example.com/a.PNG", "https://cdn.example.com/photo/123?w=400", "https://example.com/a.webp"):
            self.assertEqual(self.admin("post", "/api/products/", {**base, "image_url": good}).status_code, 201, good)
        for bad in (
            "ftp://example.com/a.jpg",
            "javascript:alert(1)",
            "example.com/a.jpg",
            "https://",
            "https://example.com/page.html",
            "https://example.com/file.pdf",
            "https://exa mple.com/a.jpg",
            "https://example.com/" + "a" * 500 + ".jpg",
            123,
        ):
            response = self.admin("post", "/api/products/", {**base, "image_url": bad})
            self.assertEqual(response.status_code, 400, bad)
            self.assertIn("image_url", response.json()["details"])

    def test_project_photo_paths_are_allowed_but_nothing_that_could_escape_the_images_folder(self):
        base = {
            "name": "Img",
            "description": "x",
            "category_id": str(self.category_id),
            "variants": [{"weight": "1kg", "price": 100, "stock": 1}],
        }
        for good in (
            "/images/sweets/kaju-katli.jpg",
            "/images/hero/mithai-box.jpg",
            "/images/sweets/gift_box.PNG",
            "/images/a.webp",
            "/images/deep/er/folder/photo-1.jpeg",
        ):
            response = self.admin("post", "/api/products/", {**base, "image_url": good})
            self.assertEqual(response.status_code, 201, good)
            self.assertEqual(response.json()["image_url"], good)
        for bad in (
            "/images/../secret.jpg",
            "/images/sweets/../../secret.jpg",
            "/images/sweets/..%2f..%2fsecret.jpg",
            "//evil.example.com/a.jpg",
            "/images//evil.example.com/a.jpg",
            "/other/a.jpg",
            "/images/",
            "/images/sweets/",
            "/images/sweets/photo",
            "/images/sweets/page.html",
            "/images/sweets/photo.jpg?x=1",
            "/images/sweets/photo.jpg#frag",
            "/images/sweets/my photo.jpg",
            "/images/sweets/photo.svg",
            "/images/sweets\\photo.jpg",
            "/images/" + "a" * 500 + ".jpg",
            "/",
        ):
            response = self.admin("post", "/api/products/", {**base, "image_url": bad})
            self.assertEqual(response.status_code, 400, bad)
            self.assertIn("image_url", response.json()["details"])
        # the same rule applies to categories
        self.assertEqual(self.admin("post", "/api/categories/", {"name": "A", "image_url": "/images/sweets/barfi.jpg"}).status_code, 201)
        self.assertEqual(self.admin("post", "/api/categories/", {"name": "B", "image_url": "/images/../x.jpg"}).status_code, 400)

    def test_category_create_edit_deactivate(self):
        created = self.admin("post", "/api/categories/", {"name": "Namkeen", "description": "Snacks"})
        self.assertEqual(created.status_code, 201)
        category_id = created.json()["id"]
        edited = self.admin("put", f"/api/categories/{category_id}/", {"name": "Savoury", "description": "x", "is_active": False})
        self.assertEqual(edited.json()["name"], "Savoury")
        self.assertFalse(edited.json()["is_active"])
        self.assertNotIn("Savoury", [c["name"] for c in self.client.get("/api/categories/").json()])
        bad_image = self.admin("post", "/api/categories/", {"name": "Bad", "image_url": "file:///etc/passwd"})
        self.assertEqual(bad_image.status_code, 400)

    def test_category_in_use_cannot_be_deleted(self):
        response = self.admin("delete", f"/api/categories/{self.category_id}/")
        self.assertEqual(response.status_code, 409)
        self.assertIn("still has products", response.json()["error"])
        self.assertEqual(get_db().categories.count_documents({}), 1)
        # after the products are gone it can be deleted
        get_db().products.delete_many({})
        self.assertEqual(self.admin("delete", f"/api/categories/{self.category_id}/").status_code, 204)

    # stock ---------------------------------------------------------------
    def test_admin_can_update_stock_and_customers_see_it(self):
        response = self.admin("patch", f"/api/admin/products/{self.kaju_id}/stock/", {"variant_weight": "500g", "stock": 40})
        self.assertEqual(response.status_code, 200)
        variants = {v["weight"]: v for v in response.json()["variants"]}
        self.assertEqual(variants["500g"]["stock"], 40)
        self.assertFalse(variants["500g"]["low_stock"])
        self.assertEqual(variants["250g"]["stock"], 20)  # other weights untouched
        public = self.client.get(f"/api/products/{self.kaju_id}/").json()
        self.assertEqual({v["weight"]: v["stock"] for v in public["variants"]}, {"250g": 20, "500g": 40})
        self.assertEqual(get_db().products.find_one({"name": "Kaju Katli"})["variants"][1]["stock"], 40)

    def test_stock_update_validation(self):
        url = f"/api/admin/products/{self.kaju_id}/stock/"
        for body in (
            {"variant_weight": "500g", "stock": -1},
            {"variant_weight": "500g", "stock": 2.5},
            {"variant_weight": "500g", "stock": True},
            {"variant_weight": "500g", "stock": "10"},
            {"variant_weight": "500g", "stock": 10**9},
            {"variant_weight": "500g"},
            {"stock": 5},
            {"variant_weight": "", "stock": 5},
        ):
            self.assertEqual(self.admin("patch", url, body).status_code, 400, body)
        self.assertEqual(self.admin("patch", url, {"variant_weight": "9kg", "stock": 5}).status_code, 404)
        self.assertEqual(self.admin("patch", "/api/admin/products/abc/stock/", {"variant_weight": "500g", "stock": 5}).status_code, 400)
        missing = "/api/admin/products/" + "a" * 24 + "/stock/"
        self.assertEqual(self.admin("patch", missing, {"variant_weight": "500g", "stock": 5}).status_code, 404)
        self.assertEqual(self.admin("patch", url, {"variant_weight": "500g", "stock": 0}).status_code, 200)  # zero is allowed
        self.assertEqual(get_db().products.find_one({"name": "Kaju Katli"})["variants"][1]["stock"], 0)

    # orders ----------------------------------------------------------------
    def test_admin_can_view_orders_without_sensitive_details(self):
        order = self.make_order()
        orders = self.admin("get", "/api/admin/orders/").json()
        self.assertEqual(len(orders), 1)
        row = orders[0]
        self.assertEqual(row["order_number"], order["order_number"])
        self.assertEqual(row["customer_name"], "Asha Verma")
        self.assertEqual(row["total_amount"], 500.0)
        self.assertEqual(row["payment_method"], "To be confirmed")
        self.assertEqual(row["payment_status"], "Pending")
        self.assertEqual(row["order_status"], "Pending")
        self.assertEqual(row["allowed_next_statuses"], ["Confirmed", "Cancelled"])
        text = str(row)
        for secret in ("9876543210", "MG Road", "560038", "owner_id"):
            self.assertNotIn(secret, text)

    def test_order_status_follows_allowed_steps(self):
        order_id = self.make_order()["id"]
        url = f"/api/admin/orders/{order_id}/status/"
        for next_status in ("Confirmed", "Processing", "Shipped", "Delivered"):
            response = self.admin("patch", url, {"order_status": next_status})
            self.assertEqual(response.status_code, 200, (next_status, response.content))
            self.assertEqual(response.json()["order_status"], next_status)
        self.assertEqual(response.json()["allowed_next_statuses"], [])
        self.assertEqual(self.admin("patch", url, {"order_status": "Pending"}).status_code, 409)
        self.assertEqual(self.admin("patch", url, {"order_status": "Cancelled"}).status_code, 409)

    def test_invalid_status_changes_are_rejected(self):
        order_id = self.make_order()["id"]
        url = f"/api/admin/orders/{order_id}/status/"
        self.assertEqual(self.admin("patch", url, {"order_status": "Delivered"}).status_code, 409)  # skips steps
        self.assertEqual(self.admin("patch", url, {"order_status": "Pending"}).status_code, 409)  # same status
        for bad in ({"order_status": "Teleported"}, {"order_status": None}, {}, {"order_status": "confirmed"}):
            self.assertEqual(self.admin("patch", url, bad).status_code, 400, bad)
        self.assertEqual(self.admin("patch", "/api/admin/orders/abc/status/", {"order_status": "Confirmed"}).status_code, 400)
        missing = "/api/admin/orders/" + "a" * 24 + "/status/"
        self.assertEqual(self.admin("patch", missing, {"order_status": "Confirmed"}).status_code, 404)
        self.assertEqual(get_db().orders.find_one({})["order_status"], "Pending")

    def test_status_update_never_changes_payment(self):
        order_id = self.make_order()["id"]
        url = f"/api/admin/orders/{order_id}/status/"
        response = self.admin("patch", url, {"order_status": "Confirmed", "payment_status": "Paid", "total_amount": 1})
        self.assertEqual(response.status_code, 200)
        saved = get_db().orders.find_one({})
        self.assertEqual(saved["payment_status"], "Pending")
        self.assertEqual(saved["total_amount"], 500.0)

    def test_cancelling_an_order_returns_stock_once(self):
        order_id = self.make_order()["id"]
        stock = lambda: get_db().products.find_one({"name": "Kaju Katli"})["variants"][0]["stock"]  # noqa: E731
        self.assertEqual(stock(), 18)
        url = f"/api/admin/orders/{order_id}/status/"
        self.assertEqual(self.admin("patch", url, {"order_status": "Cancelled"}).status_code, 200)
        self.assertEqual(stock(), 20)
        self.assertEqual(self.admin("patch", url, {"order_status": "Cancelled"}).status_code, 409)
        self.assertEqual(stock(), 20)  # not given back twice

    def test_customers_cannot_change_order_status_through_any_api(self):
        order = self.make_order()
        url = f"/api/admin/orders/{order['id']}/status/"
        self.assertEqual(self.client.patch(url, {"order_status": "Delivered"}, format="json").status_code, 401)
        headers = {"HTTP_AUTHORIZATION": f"Bearer {AccessToken.for_user(self.customer)}"}
        self.assertEqual(self.client.patch(url, {"order_status": "Delivered"}, format="json", **headers).status_code, 403)
        self.assertEqual(get_db().orders.find_one({})["order_status"], "Pending")
