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
        for query in ("?min_price=abc", "?category_id=xyz", "?sort=cheap"):
            self.assertEqual(self.client.get("/api/products/" + query).status_code, 400, query)
