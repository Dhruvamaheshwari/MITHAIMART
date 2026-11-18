import base64

from django.contrib.auth.models import User
from django.test import override_settings
from rest_framework.test import APITestCase

from config.mongodb import get_db

TEST_DB_NAME = "mithaimart_test"  # separate MongoDB database so real data is never touched


def basic_auth_header(username, password):
    token = base64.b64encode(f"{username}:{password}".encode()).decode()
    return f"Basic {token}"


# The fast hasher only speeds up the tests. Real passwords still use Django's strong default.
@override_settings(
    MONGO_DB_NAME=TEST_DB_NAME,
    PASSWORD_HASHERS=["django.contrib.auth.hashers.MD5PasswordHasher"],
)
class ProductApiTests(APITestCase):
    def setUp(self):
        get_db().client.drop_database(TEST_DB_NAME)
        User.objects.create_user("shopadmin", password="Str0ng-pass!", is_staff=True)
        User.objects.create_user("customer", password="Str0ng-pass!")
        self.admin_auth = basic_auth_header("shopadmin", "Str0ng-pass!")
        self.customer_auth = basic_auth_header("customer", "Str0ng-pass!")

    def tearDown(self):
        get_db().client.drop_database(TEST_DB_NAME)

    # helpers -------------------------------------------------------------
    def make_category(self, name="Fresh Sweets"):
        response = self.client.post(
            "/api/categories/", {"name": name}, format="json", HTTP_AUTHORIZATION=self.admin_auth
        )
        self.assertEqual(response.status_code, 201)
        return response.json()

    def make_product(self, category_id, name="Kaju Katli", prices=(250, 500, 1000)):
        variants = [
            {"weight": f"{index}", "price": price, "stock": 10} for index, price in enumerate(prices, start=1)
        ]
        response = self.client.post(
            "/api/products/",
            {"name": name, "description": "Tasty", "category_id": category_id, "variants": variants},
            format="json",
            HTTP_AUTHORIZATION=self.admin_auth,
        )
        self.assertEqual(response.status_code, 201, response.content)
        return response.json()

    # categories ----------------------------------------------------------
    def test_admin_can_create_and_list_category(self):
        category = self.make_category()
        self.assertEqual(len(category["id"]), 24)  # ObjectId as a string
        listing = self.client.get("/api/categories/").json()
        self.assertEqual([item["name"] for item in listing], ["Fresh Sweets"])

    def test_inactive_category_not_listed(self):
        category = self.make_category()
        self.client.put(
            f"/api/categories/{category['id']}/",
            {"name": "Fresh Sweets", "is_active": False},
            format="json",
            HTTP_AUTHORIZATION=self.admin_auth,
        )
        self.assertEqual(self.client.get("/api/categories/").json(), [])
        self.assertEqual(self.client.get(f"/api/categories/{category['id']}/").status_code, 404)

    def test_duplicate_category_name_rejected(self):
        self.make_category()
        response = self.client.post(
            "/api/categories/", {"name": "Fresh Sweets"}, format="json", HTTP_AUTHORIZATION=self.admin_auth
        )
        self.assertEqual(response.status_code, 409)

    def test_category_requires_name(self):
        response = self.client.post("/api/categories/", {}, format="json", HTTP_AUTHORIZATION=self.admin_auth)
        self.assertEqual(response.status_code, 400)

    def test_cannot_delete_category_with_products(self):
        category = self.make_category()
        self.make_product(category["id"])
        response = self.client.delete(f"/api/categories/{category['id']}/", HTTP_AUTHORIZATION=self.admin_auth)
        self.assertEqual(response.status_code, 409)

    # admin only ----------------------------------------------------------
    def test_write_requires_admin(self):
        body = {"name": "Namkeen"}
        anonymous = self.client.post("/api/categories/", body, format="json")
        customer = self.client.post(
            "/api/categories/", body, format="json", HTTP_AUTHORIZATION=self.customer_auth
        )
        wrong_password = self.client.post(
            "/api/categories/",
            body,
            format="json",
            HTTP_AUTHORIZATION=basic_auth_header("shopadmin", "wrong"),
        )
        self.assertEqual(anonymous.status_code, 401)
        self.assertEqual(customer.status_code, 403)
        self.assertEqual(wrong_password.status_code, 401)
        self.assertEqual(get_db().categories.count_documents({}), 0)

    def test_product_write_requires_admin(self):
        category = self.make_category()
        product = self.make_product(category["id"])
        for method in (self.client.put, self.client.delete):
            response = method(f"/api/products/{product['id']}/", HTTP_AUTHORIZATION=self.customer_auth)
            self.assertEqual(response.status_code, 403)
        self.assertEqual(get_db().products.count_documents({}), 1)

    # products ------------------------------------------------------------
    def test_create_and_get_product_with_variants(self):
        category = self.make_category()
        product = self.make_product(category["id"])
        detail = self.client.get(f"/api/products/{product['id']}/").json()
        self.assertEqual(detail["category_id"], category["id"])
        self.assertEqual([variant["price"] for variant in detail["variants"]], [250, 500, 1000])
        self.assertTrue(detail["variants"][0]["is_available"])
        # Saved in MongoDB with a real ObjectId reference
        saved = get_db().products.find_one({"name": "Kaju Katli"})
        self.assertEqual(str(saved["category_id"]), category["id"])

    def test_product_validation(self):
        category = self.make_category()
        bad_bodies = [
            {"description": "x", "category_id": category["id"], "variants": [{"weight": "1kg", "price": 1}]},
            {"name": "A", "description": "x", "category_id": "not-an-id", "variants": [{"weight": "1kg", "price": 1}]},
            {"name": "A", "description": "x", "category_id": "a" * 24, "variants": [{"weight": "1kg", "price": 1}]},
            {"name": "A", "description": "x", "category_id": category["id"], "variants": []},
            {"name": "A", "description": "x", "category_id": category["id"], "variants": [{"weight": "1kg", "price": -5}]},
            {"name": "A", "description": "x", "category_id": category["id"], "variants": [{"weight": "1kg", "price": True}]},
            {"name": "A", "description": "x", "category_id": category["id"], "variants": [{"weight": "1kg", "price": 5, "stock": -1}]},
            {"name": "A", "description": "x", "category_id": category["id"], "variants": [{"weight": "1kg", "price": 5}, {"weight": "1KG", "price": 6}]},
        ]
        for body in bad_bodies:
            response = self.client.post("/api/products/", body, format="json", HTTP_AUTHORIZATION=self.admin_auth)
            self.assertEqual(response.status_code, 400, body)
        self.assertEqual(get_db().products.count_documents({}), 0)

    def test_invalid_and_unknown_product_id(self):
        self.assertEqual(self.client.get("/api/products/abc/").status_code, 400)
        self.assertEqual(self.client.get("/api/products/" + "a" * 24 + "/").status_code, 404)
        self.assertEqual(
            self.client.delete("/api/products/abc/", HTTP_AUTHORIZATION=self.admin_auth).status_code, 400
        )

    def test_update_and_delete_product(self):
        category = self.make_category()
        product = self.make_product(category["id"])
        body = {
            "name": "Kaju Katli Premium",
            "description": "Updated",
            "category_id": category["id"],
            "variants": [{"weight": "500g", "price": 600, "stock": 3}],
        }
        updated = self.client.put(
            f"/api/products/{product['id']}/", body, format="json", HTTP_AUTHORIZATION=self.admin_auth
        ).json()
        self.assertEqual(updated["name"], "Kaju Katli Premium")
        self.assertEqual(updated["created_at"], product["created_at"])  # unchanged
        response = self.client.delete(f"/api/products/{product['id']}/", HTTP_AUTHORIZATION=self.admin_auth)
        self.assertEqual(response.status_code, 204)
        self.assertEqual(get_db().products.count_documents({}), 0)

    def test_inactive_product_hidden_from_customers(self):
        category = self.make_category()
        product = self.make_product(category["id"])
        self.client.put(
            f"/api/products/{product['id']}/",
            {
                "name": "Kaju Katli",
                "description": "x",
                "category_id": category["id"],
                "is_active": False,
                "variants": [{"weight": "1kg", "price": 1000, "stock": 1}],
            },
            format="json",
            HTTP_AUTHORIZATION=self.admin_auth,
        )
        self.assertEqual(self.client.get("/api/products/").json(), [])
        self.assertEqual(self.client.get(f"/api/products/{product['id']}/").status_code, 404)
        self.assertEqual(
            self.client.get(f"/api/products/{product['id']}/", HTTP_AUTHORIZATION=self.admin_auth).status_code, 200
        )

    # search, filter, sort -----------------------------------------------
    def test_search_filter_and_sort(self):
        sweets = self.make_category("Fresh Sweets")
        snacks = self.make_category("Namkeen")
        self.make_product(sweets["id"], "Kaju Katli", prices=(250, 1000))
        self.make_product(sweets["id"], "Gulab Jamun", prices=(120, 400))
        self.make_product(snacks["id"], "Aloo Bhujia", prices=(80, 300))

        def names(query):
            response = self.client.get("/api/products/" + query)
            self.assertEqual(response.status_code, 200, response.content)
            return [item["name"] for item in response.json()]

        self.assertEqual(sorted(names("?search=kaju")), ["Kaju Katli"])
        self.assertEqual(sorted(names("?search=KAJU")), ["Kaju Katli"])
        self.assertEqual(names("?search=.*"), [])  # regex characters are treated as plain text
        self.assertEqual(sorted(names(f"?category_id={snacks['id']}")), ["Aloo Bhujia"])
        self.assertEqual(sorted(names("?min_price=500")), ["Kaju Katli"])  # only Kaju has a variant >= 500
        self.assertEqual(sorted(names("?max_price=100")), ["Aloo Bhujia"])
        self.assertEqual(sorted(names("?min_price=100&max_price=300")), ["Aloo Bhujia", "Gulab Jamun", "Kaju Katli"])
        self.assertEqual(names("?sort=price_asc"), ["Aloo Bhujia", "Gulab Jamun", "Kaju Katli"])
        self.assertEqual(names("?sort=price_desc"), ["Kaju Katli", "Gulab Jamun", "Aloo Bhujia"])

    def test_bad_query_values(self):
        for query in (
            "?min_price=abc",
            "?category_id=xyz",
            "?sort=cheap",
            "?min_price=-5",
            "?max_price=-1",
            "?min_price=nan",
            "?max_price=inf",
            "?min_price=500&max_price=100",
            "?search=" + "a" * 101,
        ):
            self.assertEqual(self.client.get("/api/products/" + query).status_code, 400, query)

    def test_price_filter_and_sort_use_only_weights_that_can_be_bought(self):
        """A sold-out cheap weight must not make a product match a cheap price filter or sort first."""
        sweets = self.make_category("Fresh Sweets")
        db = get_db()
        # Cheap weight (100) is sold out. The weight that can be bought costs 600.
        self.make_product(sweets["id"], "Sold Out Cheap", prices=(100, 600))
        db.products.update_one({"name": "Sold Out Cheap"}, {"$set": {"variants.0.stock": 0}})
        # The cheap weight (150) is hidden by the shop. The weight that can be bought costs 700.
        self.make_product(sweets["id"], "Hidden Cheap", prices=(150, 700))
        db.products.update_one({"name": "Hidden Cheap"}, {"$set": {"variants.0.is_available": False}})
        self.make_product(sweets["id"], "Normal", prices=(300,))
        # nothing at all can be bought
        self.make_product(sweets["id"], "Nothing Left", prices=(50,))
        db.products.update_one({"name": "Nothing Left"}, {"$set": {"variants.0.stock": 0}})

        def names(query):
            response = self.client.get("/api/products/" + query)
            self.assertEqual(response.status_code, 200, response.content)
            return [item["name"] for item in response.json()]

        self.assertEqual(names("?max_price=200"), [])  # the only cheap weights cannot be bought
        self.assertEqual(sorted(names("?max_price=350")), ["Normal"])
        self.assertEqual(sorted(names("?min_price=500")), ["Hidden Cheap", "Sold Out Cheap"])
        # sorted by the cheapest weight that CAN be bought, and unbuyable products always last
        self.assertEqual(names("?sort=price_asc"), ["Normal", "Sold Out Cheap", "Hidden Cheap", "Nothing Left"])
        self.assertEqual(names("?sort=price_desc"), ["Hidden Cheap", "Sold Out Cheap", "Normal", "Nothing Left"])

    def test_search_category_price_and_sort_work_together(self):
        sweets = self.make_category("Fresh Sweets")
        snacks = self.make_category("Namkeen")
        self.make_product(sweets["id"], "Kaju Katli", prices=(250, 1000))
        self.make_product(sweets["id"], "Kaju Roll", prices=(400,))
        self.make_product(sweets["id"], "Gulab Jamun", prices=(120,))
        self.make_product(snacks["id"], "Kaju Mixture", prices=(90,))

        def names(query):
            response = self.client.get("/api/products/" + query)
            self.assertEqual(response.status_code, 200, response.content)
            return [item["name"] for item in response.json()]

        # "kaju" + sweets + price 200 to 500 + cheapest first
        query = f"?search=kaju&category_id={sweets['id']}&min_price=200&max_price=500&sort=price_asc"
        self.assertEqual(names(query), ["Kaju Katli", "Kaju Roll"])
        # same filters but most expensive first
        self.assertEqual(names(query.replace("price_asc", "price_desc")), ["Kaju Roll", "Kaju Katli"])
        # a combination with no match gives an empty list, not an error
        self.assertEqual(names(f"?search=kaju&category_id={snacks['id']}&min_price=200"), [])
        self.assertEqual(names("?search=rasgulla"), [])

    # origin state ------------------------------------------------------------
    def state_body(self, category_id, name="Ghevar", **extra):
        return {
            "name": name,
            "description": "x",
            "category_id": category_id,
            "variants": [{"weight": "500g", "price": 450, "stock": 5}],
            **extra,
        }

    def test_state_list_is_public_and_complete(self):
        response = self.client.get("/api/states/")
        self.assertEqual(response.status_code, 200)
        states = response.json()
        self.assertEqual(len(states), 36)  # 28 states and 8 union territories
        for name in ("Rajasthan", "West Bengal", "Tamil Nadu", "Delhi", "Ladakh"):
            self.assertIn(name, states)
        self.assertEqual(len(states), len(set(states)))

    def test_product_can_have_a_valid_state_and_defaults_to_empty(self):
        category = self.make_category()
        with_state = self.client.post(
            "/api/products/", self.state_body(category["id"], state="Rajasthan"), format="json", HTTP_AUTHORIZATION=self.admin_auth
        )
        self.assertEqual(with_state.status_code, 201, with_state.content)
        self.assertEqual(with_state.json()["state"], "Rajasthan")
        without = self.client.post(
            "/api/products/", self.state_body(category["id"], name="No State"), format="json", HTTP_AUTHORIZATION=self.admin_auth
        )
        self.assertEqual(without.json()["state"], "")
        self.assertEqual(get_db().products.find_one({"name": "No State"})["state"], "")

    def test_invalid_states_are_rejected(self):
        category = self.make_category()
        for bad in ("Atlantis", "rajasthan", "Rajasthan ; drop", 5, ["Goa"], {"x": 1}, True):
            response = self.client.post(
                "/api/products/", self.state_body(category["id"], state=bad), format="json", HTTP_AUTHORIZATION=self.admin_auth
            )
            self.assertEqual(response.status_code, 400, bad)
            self.assertIn("state", response.json()["details"])
        self.assertEqual(get_db().products.count_documents({}), 0)

    def test_editing_without_a_state_keeps_the_saved_state(self):
        category = self.make_category()
        created = self.client.post(
            "/api/products/", self.state_body(category["id"], state="Gujarat"), format="json", HTTP_AUTHORIZATION=self.admin_auth
        ).json()
        # an edit that does not mention the state (like the old admin toggle) must not erase it
        edited = self.client.put(
            f"/api/products/{created['id']}/",
            self.state_body(category["id"], name="Ghevar Special"),
            format="json",
            HTTP_AUTHORIZATION=self.admin_auth,
        )
        self.assertEqual(edited.json()["state"], "Gujarat")
        # an edit that sends a new state changes it, and an empty one clears it
        changed = self.client.put(
            f"/api/products/{created['id']}/",
            self.state_body(category["id"], state="Goa"),
            format="json",
            HTTP_AUTHORIZATION=self.admin_auth,
        )
        self.assertEqual(changed.json()["state"], "Goa")
        cleared = self.client.put(
            f"/api/products/{created['id']}/",
            self.state_body(category["id"], state=""),
            format="json",
            HTTP_AUTHORIZATION=self.admin_auth,
        )
        self.assertEqual(cleared.json()["state"], "")

    def test_products_saved_before_the_state_field_existed_still_work(self):
        category = self.make_category()
        product = self.make_product(category["id"], "Old Product")
        get_db().products.update_one({"name": "Old Product"}, {"$unset": {"state": ""}})
        self.assertEqual(self.client.get(f"/api/products/{product['id']}/").json()["state"], "")
        self.assertEqual(len(self.client.get("/api/products/").json()), 1)

    def test_state_filter_works_with_the_other_filters(self):
        category = self.make_category()
        for name, state in (("Ghevar", "Rajasthan"), ("Mawa Kachori", "Rajasthan"), ("Mysore Pak", "Karnataka"), ("Plain", "")):
            self.client.post(
                "/api/products/", self.state_body(category["id"], name=name, state=state), format="json", HTTP_AUTHORIZATION=self.admin_auth
            )

        def names(query):
            response = self.client.get("/api/products/" + query)
            self.assertEqual(response.status_code, 200, response.content)
            return sorted(item["name"] for item in response.json())

        self.assertEqual(names("?state=Rajasthan"), ["Ghevar", "Mawa Kachori"])
        self.assertEqual(names("?state=Karnataka"), ["Mysore Pak"])
        self.assertEqual(names("?state=Goa"), [])
        self.assertEqual(names("?state=Rajasthan&search=kachori"), ["Mawa Kachori"])
        self.assertEqual(names(f"?state=Rajasthan&category_id={category['id']}&max_price=500"), ["Ghevar", "Mawa Kachori"])
        for bad in ("Atlantis", "rajasthan", "Rajasthan%27"):
            self.assertEqual(self.client.get("/api/products/?state=" + bad).status_code, 400, bad)
