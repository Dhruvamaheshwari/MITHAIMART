import uuid
from datetime import datetime, timedelta, timezone
from unittest import mock

import jwt
from django.contrib.auth.models import User
from django.core.cache import cache
from django.test import override_settings
from pymongo.errors import PyMongoError
from rest_framework.test import APITestCase
from rest_framework_simplejwt.tokens import AccessToken

from apps.accounts.customer_auth import create_customer_token
from apps.accounts.tests import VALID_ADDRESS
from config.mongodb import get_db

TEST_DB_NAME = "mithaimart_test"  # separate database, real data is never touched
PASSWORD = "Sweet-Mithai-2026"


# The fast hasher only speeds up the tests. One test below checks the real default hasher.
@override_settings(
    MONGO_DB_NAME=TEST_DB_NAME,
    PASSWORD_HASHERS=["django.contrib.auth.hashers.MD5PasswordHasher"],
)
class CustomerAuthTests(APITestCase):
    def setUp(self):
        cache.clear()  # the login and sign up rate limits use the cache
        db = get_db()
        db.client.drop_database(TEST_DB_NAME)
        db.users.create_index("email", unique=True)
        db.carts.create_index("owner_id", unique=True)
        db.addresses.create_index(
            "owner_id", unique=True, partialFilterExpression={"is_default": True}, name="one_default_per_owner"
        )
        db.orders.create_index("order_number", unique=True)
        self.guest_id = str(uuid.uuid4())
        category_id = db.categories.insert_one(
            {"name": "Sweets", "description": "", "image_url": "", "is_active": True, "created_at": datetime.now(timezone.utc)}
        ).inserted_id
        self.kaju_id = str(self.make_product(category_id, "Kaju Katli", "250g", 250.0, 5))
        self.jamun_id = str(self.make_product(category_id, "Gulab Jamun", "500g", 220.0, 8))

    def make_product(self, category_id, name, weight, price, stock):
        return get_db().products.insert_one(
            {
                "name": name,
                "description": "x",
                "category_id": category_id,
                "image_url": "",
                "is_active": True,
                "created_at": datetime.now(timezone.utc),
                "variants": [{"weight": weight, "price": price, "stock": stock, "is_available": True}],
            }
        ).inserted_id

    def tearDown(self):
        get_db().client.drop_database(TEST_DB_NAME)

    # helpers -------------------------------------------------------------
    def register(self, name="Asha Verma", email="asha@example.com", password=PASSWORD, guest_id=None, **extra):
        headers = {"HTTP_X_GUEST_ID": guest_id} if guest_id else {}
        body = {"name": name, "email": email, "password": password, **extra}
        return self.client.post("/api/auth/register/", body, format="json", **headers)

    def login(self, email="asha@example.com", password=PASSWORD, guest_id=None):
        headers = {"HTTP_X_GUEST_ID": guest_id} if guest_id else {}
        return self.client.post("/api/auth/login/", {"email": email, "password": password}, format="json", **headers)

    def as_user(self, token, guest_id=None):
        headers = {"HTTP_AUTHORIZATION": f"Bearer {token}"}
        if guest_id:
            headers["HTTP_X_GUEST_ID"] = guest_id
        return headers

    def as_guest(self, guest_id=None):
        return {"HTTP_X_GUEST_ID": guest_id or self.guest_id}

    def add_to_cart(self, headers, product_id, weight, quantity):
        body = {"product_id": product_id, "variant_weight": weight, "quantity": quantity}
        response = self.client.post("/api/cart/add/", body, format="json", **headers)
        self.assertEqual(response.status_code, 200, response.content)

    def cart(self, headers):
        return self.client.get("/api/cart/", **headers).json()

    def place_order(self, headers):
        address = self.client.post("/api/addresses/", VALID_ADDRESS, format="json", **headers).json()
        response = self.client.post("/api/orders/create/", {"address_id": address["id"]}, format="json", **headers)
        self.assertEqual(response.status_code, 201, response.content)
        return response.json()

    # sign up ---------------------------------------------------------------
    def test_sign_up_creates_an_account_and_logs_in(self):
        response = self.register(email="  Asha@Example.COM ")
        self.assertEqual(response.status_code, 201, response.content)
        data = response.json()
        self.assertEqual(data["user"]["name"], "Asha Verma")
        self.assertEqual(data["user"]["email"], "asha@example.com")  # saved in lower case
        self.assertTrue(data["token"])
        text = str(data)
        self.assertNotIn(PASSWORD, text)
        self.assertNotIn("password", text.lower())
        me = self.client.get("/api/auth/me/", **self.as_user(data["token"]))
        self.assertEqual(me.status_code, 200)
        self.assertEqual(me.json()["email"], "asha@example.com")

    def test_password_is_saved_only_as_a_hash(self):
        self.register()
        saved = get_db().users.find_one({"email": "asha@example.com"})
        self.assertNotEqual(saved["password_hash"], PASSWORD)
        self.assertNotIn(PASSWORD, str(saved))
        self.assertIn("$", saved["password_hash"])  # format: algorithm$salt$hash
        self.assertNotIn("password", saved)  # there is no plain password field
        self.assertIn("created_at", saved)

    @override_settings(PASSWORD_HASHERS=["django.contrib.auth.hashers.PBKDF2PasswordHasher"])
    def test_real_default_hasher_is_pbkdf2(self):
        self.register()
        saved = get_db().users.find_one({"email": "asha@example.com"})
        self.assertTrue(saved["password_hash"].startswith("pbkdf2_sha256$"))
        self.assertEqual(self.login().status_code, 200)

    def test_sign_up_validation(self):
        bad_bodies = [
            {"email": "asha@example.com", "password": PASSWORD},  # no name
            {"name": "   ", "email": "asha@example.com", "password": PASSWORD},
            {"name": "A" * 101, "email": "asha@example.com", "password": PASSWORD},
            {"name": "Asha", "password": PASSWORD},  # no email
            {"name": "Asha", "email": "not-an-email", "password": PASSWORD},
            {"name": "Asha", "email": "a@b", "password": PASSWORD},
            {"name": "Asha", "email": "a b@example.com", "password": PASSWORD},
            {"name": "Asha", "email": "asha@example.com"},  # no password
            {"name": "Asha", "email": "asha@example.com", "password": "short"},
            {"name": "Asha", "email": "asha@example.com", "password": "12345678"},  # only digits
            {"name": "Asha", "email": "asha@example.com", "password": "password"},  # too common
            {"name": "Asha", "email": "asha@example.com", "password": "x" * 129},
            {"name": "Asha", "email": "asha@example.com", "password": 12345678},
            {"name": ["Asha"], "email": "asha@example.com", "password": PASSWORD},
        ]
        for body in bad_bodies:
            cache.clear()  # these many attempts would hit the sign up rate limit, which has its own test
            response = self.client.post("/api/auth/register/", body, format="json")
            self.assertEqual(response.status_code, 400, body)
            self.assertIn("details", response.json())
        cache.clear()
        self.assertEqual(self.client.post("/api/auth/register/", [], format="json").status_code, 400)
        self.assertEqual(get_db().users.count_documents({}), 0)

    def test_same_email_cannot_sign_up_twice(self):
        self.assertEqual(self.register().status_code, 201)
        for email in ("asha@example.com", "ASHA@example.com", " asha@example.com "):
            response = self.register(name="Someone Else", email=email)
            self.assertEqual(response.status_code, 409, email)
        self.assertEqual(get_db().users.count_documents({}), 1)

    # login -----------------------------------------------------------------
    def test_login_works_and_email_is_not_case_sensitive(self):
        self.register()
        response = self.login(email="ASHA@Example.com")
        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.json()["token"])
        self.assertEqual(response.json()["user"]["name"], "Asha Verma")

    def test_wrong_password_and_unknown_email_give_the_same_answer(self):
        self.register()
        wrong_password = self.login(password="Wrong-password-1")
        unknown_email = self.login(email="nobody@example.com")
        self.assertEqual(wrong_password.status_code, 401)
        self.assertEqual(unknown_email.status_code, 401)
        self.assertEqual(wrong_password.json(), unknown_email.json())
        self.assertEqual(wrong_password.json()["error"], "Invalid email or password.")
        self.assertNotIn("token", wrong_password.json())

    def test_login_with_missing_fields(self):
        for body in ({}, {"email": "asha@example.com"}, {"password": PASSWORD}, {"email": "", "password": ""}):
            self.assertEqual(self.client.post("/api/auth/login/", body, format="json").status_code, 400, body)
        self.assertEqual(self.client.post("/api/auth/login/", [], format="json").status_code, 400)

    def test_disabled_account_cannot_log_in_and_its_token_stops_working(self):
        token = self.register().json()["token"]
        get_db().users.update_one({"email": "asha@example.com"}, {"$set": {"is_active": False}})
        self.assertEqual(self.login().status_code, 401)
        self.assertEqual(self.client.get("/api/auth/me/", **self.as_user(token)).status_code, 401)

    def test_login_and_sign_up_are_rate_limited(self):
        self.register()
        codes = [self.login(password="Wrong-password-1").status_code for _ in range(12)]
        self.assertEqual(codes[:10], [401] * 10)
        self.assertEqual(codes[10:], [429, 429])
        cache.clear()
        codes = [self.register(email=f"user{n}@example.com").status_code for n in range(12)]
        self.assertEqual(codes.count(201), 10)
        self.assertEqual(codes[10:], [429, 429])

    # tokens ----------------------------------------------------------------
    def test_me_needs_a_valid_customer_token(self):
        token = self.register().json()["token"]
        self.assertEqual(self.client.get("/api/auth/me/").status_code, 401)
        self.assertEqual(self.client.get("/api/auth/me/", **self.as_user("garbage")).status_code, 401)
        self.assertEqual(self.client.get("/api/auth/me/", **self.as_user(token + "x")).status_code, 401)
        self.assertEqual(self.client.get("/api/auth/me/", **self.as_user(token)).status_code, 200)

    def test_expired_forged_and_wrong_kind_of_tokens_are_refused(self):
        self.register()
        user = get_db().users.find_one({"email": "asha@example.com"})
        from django.conf import settings

        key = settings.SECRET_KEY + ":customer-token"
        past = datetime.now(timezone.utc) - timedelta(days=1)
        expired = jwt.encode({"sub": str(user["_id"]), "typ": "customer", "exp": past}, key, algorithm="HS256")
        wrong_key = jwt.encode(
            {"sub": str(user["_id"]), "typ": "customer", "exp": datetime.now(timezone.utc) + timedelta(days=1)},
            "some-other-key-that-is-long-enough-for-hs256",
            algorithm="HS256",
        )
        wrong_type = jwt.encode(
            {"sub": str(user["_id"]), "typ": "admin", "exp": datetime.now(timezone.utc) + timedelta(days=1)},
            key,
            algorithm="HS256",
        )
        no_algorithm = jwt.encode({"sub": str(user["_id"]), "typ": "customer"}, key, algorithm="HS256")
        for bad in (expired, wrong_key, wrong_type, no_algorithm):
            self.assertEqual(self.client.get("/api/auth/me/", **self.as_user(bad)).status_code, 401)
            # a bad token is an error. It is never silently treated as a guest
            self.assertEqual(self.client.get("/api/cart/", **self.as_user(bad, self.guest_id)).status_code, 401)

    def test_a_deleted_account_token_stops_working(self):
        token = self.register().json()["token"]
        get_db().users.delete_many({})
        self.assertEqual(self.client.get("/api/auth/me/", **self.as_user(token)).status_code, 401)
        self.assertEqual(self.client.get("/api/cart/", **self.as_user(token)).status_code, 401)

    def test_customer_and_admin_tokens_cannot_be_swapped(self):
        customer_token = self.register().json()["token"]
        admin = User.objects.create_user("shopadmin", password="Str0ng-pass!", is_staff=True)
        admin_token = str(AccessToken.for_user(admin))
        # a customer token on admin APIs
        for url in ("/api/admin/stats/", "/api/admin/orders/"):
            self.assertEqual(self.client.get(url, **self.as_user(customer_token)).status_code, 401, url)
        self.assertEqual(
            self.client.post("/api/products/", {"name": "x"}, format="json", **self.as_user(customer_token)).status_code,
            401,
        )
        # an admin token on customer APIs
        self.assertEqual(self.client.get("/api/auth/me/", **self.as_user(admin_token)).status_code, 401)
        self.assertEqual(self.client.get("/api/cart/", **self.as_user(admin_token, self.guest_id)).status_code, 401)

    # ownership ---------------------------------------------------------------
    def test_a_logged_in_customer_owns_their_data_and_guests_cannot_see_it(self):
        token = self.register().json()["token"]
        user_headers = self.as_user(token, self.guest_id)  # same browser, so the guest id is sent too
        self.add_to_cart(user_headers, self.kaju_id, "250g", 2)
        order = self.place_order(user_headers)
        self.assertEqual(order["total_amount"], 500.0)

        # saved under the account, not under the guest id
        user = get_db().users.find_one({"email": "asha@example.com"})
        self.assertEqual(get_db().orders.find_one({})["owner_id"], f"user:{user['_id']}")
        self.assertEqual(get_db().addresses.find_one({})["owner_id"], f"user:{user['_id']}")

        # the guest of that same browser sees nothing of it
        guest = self.as_guest()
        self.assertEqual(self.client.get("/api/orders/", **guest).json(), [])
        self.assertEqual(self.client.get("/api/addresses/", **guest).json(), [])
        self.assertEqual(self.client.get(f"/api/orders/{order['id']}/", **guest).status_code, 404)

        # the customer sees it from another device, because it belongs to the account
        other_device = self.as_user(token, str(uuid.uuid4()))
        self.assertEqual([o["id"] for o in self.client.get("/api/orders/", **other_device).json()], [order["id"]])
        self.assertEqual(len(self.client.get("/api/addresses/", **other_device).json()), 1)

    def test_one_customer_cannot_see_another_customers_data(self):
        first = self.register(email="first@example.com").json()["token"]
        second = self.register(email="second@example.com").json()["token"]
        headers = self.as_user(first)
        self.add_to_cart(headers, self.kaju_id, "250g", 1)
        order = self.place_order(headers)
        address_id = self.client.get("/api/addresses/", **headers).json()[0]["id"]

        other = self.as_user(second)
        self.assertEqual(self.client.get("/api/orders/", **other).json(), [])
        self.assertEqual(self.client.get(f"/api/orders/{order['id']}/", **other).status_code, 404)
        self.assertEqual(self.client.get(f"/api/addresses/{address_id}/", **other).status_code, 404)
        self.assertEqual(self.client.delete(f"/api/addresses/{address_id}/", **other).status_code, 404)
        self.assertEqual(self.client.get(f"/api/orders/{order['id']}/", **headers).status_code, 200)

    def test_guest_can_fill_a_cart_but_cannot_place_an_order(self):
        guest = self.as_guest()
        self.add_to_cart(guest, self.kaju_id, "250g", 1)
        self.assertEqual(self.cart(guest)["total_quantity"], 1)
        address = self.client.post("/api/addresses/", VALID_ADDRESS, format="json", **guest).json()
        response = self.client.post("/api/orders/create/", {"address_id": address["id"]}, format="json", **guest)
        self.assertEqual(response.status_code, 401)
        self.assertEqual(response.json()["error"], "Please log in to place an order.")
        self.assertEqual(get_db().orders.count_documents({}), 0)
        self.assertEqual(self.cart(guest)["total_quantity"], 1)  # the cart is untouched
        self.assertEqual(self.client.get("/api/cart/").status_code, 400)  # neither token nor guest id

    # cart merge --------------------------------------------------------------
    def test_guest_cart_moves_into_the_account_cart_at_sign_up(self):
        guest = self.as_guest()
        self.add_to_cart(guest, self.kaju_id, "250g", 2)
        self.add_to_cart(guest, self.jamun_id, "500g", 1)
        token = self.register(guest_id=self.guest_id).json()["token"]
        user_cart = self.cart(self.as_user(token))
        self.assertEqual(user_cart["total_quantity"], 3)
        self.assertEqual(sorted(item["product_name"] for item in user_cart["items"]), ["Gulab Jamun", "Kaju Katli"])
        self.assertEqual(self.cart(guest)["items"], [])  # the guest cart was emptied

    def test_login_adds_the_guest_cart_to_the_existing_account_cart_up_to_stock(self):
        token = self.register().json()["token"]
        self.add_to_cart(self.as_user(token), self.kaju_id, "250g", 3)  # account already has 3 (stock is 5)
        guest = self.as_guest()
        self.add_to_cart(guest, self.kaju_id, "250g", 4)
        self.add_to_cart(guest, self.jamun_id, "500g", 2)
        self.assertEqual(self.login(guest_id=self.guest_id).status_code, 200)
        items = {item["product_name"]: item["quantity"] for item in self.cart(self.as_user(token))["items"]}
        self.assertEqual(items, {"Kaju Katli": 5, "Gulab Jamun": 2})  # 3 + 4 is capped at the stock of 5
        self.assertEqual(self.cart(guest)["items"], [])

    def test_merge_skips_items_that_can_no_longer_be_bought(self):
        guest = self.as_guest()
        self.add_to_cart(guest, self.kaju_id, "250g", 2)
        self.add_to_cart(guest, self.jamun_id, "500g", 1)
        get_db().products.update_one({"name": "Kaju Katli"}, {"$set": {"is_active": False}})
        get_db().products.update_one({"name": "Gulab Jamun"}, {"$set": {"variants.0.stock": 0}})
        token = self.register(guest_id=self.guest_id).json()["token"]
        self.assertEqual(self.cart(self.as_user(token))["items"], [])

    def test_sign_up_and_login_work_without_a_guest_id_or_cart(self):
        self.assertEqual(self.register().status_code, 201)
        self.assertEqual(self.login().status_code, 200)
        self.assertEqual(self.login(guest_id=str(uuid.uuid4())).status_code, 200)  # a guest id with no cart
        self.assertEqual(self.login(guest_id="not-a-uuid").status_code, 200)  # a bad guest id is ignored

    def test_a_problem_while_merging_never_breaks_the_login(self):
        self.register()
        self.add_to_cart(self.as_guest(), self.kaju_id, "250g", 1)
        with mock.patch("apps.accounts.auth_views.merge_cart_into", side_effect=PyMongoError("boom")):
            response = self.login(guest_id=self.guest_id)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(self.cart(self.as_guest())["total_quantity"], 1)  # the guest cart is still there

    def test_public_pages_work_for_a_logged_in_customer(self):
        """Regression: a customer token used to make /api/products/ answer 401, which logged the customer out."""
        token = self.register().json()["token"]
        headers = self.as_user(token)
        for url in ("/api/products/", "/api/categories/", "/api/health/", f"/api/products/{self.kaju_id}/"):
            self.assertEqual(self.client.get(url, **headers).status_code, 200, url)
        # filters work too
        self.assertEqual(len(self.client.get("/api/products/?search=kaju", **headers).json()), 1)
        # a token that means nothing is just an ordinary visitor on public pages
        garbage = {"HTTP_AUTHORIZATION": "Bearer not.a.real.token"}
        self.assertEqual(self.client.get("/api/products/", **garbage).status_code, 200)

    def test_admin_rules_still_hold_on_pages_that_are_public(self):
        customer = self.as_user(self.register().json()["token"])
        admin = User.objects.create_user("shopadmin", password="Str0ng-pass!", is_staff=True)
        admin_headers = {"HTTP_AUTHORIZATION": f"Bearer {AccessToken.for_user(admin)}"}
        get_db().products.update_one({"name": "Kaju Katli"}, {"$set": {"is_active": False}})
        url = f"/api/products/{self.kaju_id}/"
        # an inactive product is hidden from visitors and customers, but an admin token still sees it
        self.assertEqual(self.client.get(url, **customer).status_code, 404)
        self.assertEqual(self.client.get(url).status_code, 404)
        self.assertEqual(self.client.get(url, **admin_headers).status_code, 200)
        # writing still needs a real admin: customer and garbage tokens get 401, never 2xx
        body = {"name": "x"}
        for headers in (customer, {"HTTP_AUTHORIZATION": "Bearer garbage"}, {}):
            self.assertEqual(self.client.post("/api/categories/", body, format="json", **headers).status_code, 401)
            self.assertEqual(self.client.delete(url, **headers).status_code, 401)
        # and the admin APIs stay strict: a bad token is an error, not "an ordinary visitor"
        self.assertEqual(self.client.get("/api/admin/stats/", HTTP_AUTHORIZATION="Bearer garbage").status_code, 401)

    def test_logging_out_gives_back_the_guest_view(self):
        token = self.register().json()["token"]
        self.add_to_cart(self.as_user(token), self.kaju_id, "250g", 1)
        # "logging out" = the browser stops sending the token, so only the guest id is used
        self.assertEqual(self.cart(self.as_guest())["items"], [])
        self.assertEqual(self.cart(self.as_user(token))["total_quantity"], 1)  # the account cart is kept
