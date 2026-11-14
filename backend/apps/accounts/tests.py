import uuid

from django.test import override_settings
from rest_framework.test import APITestCase

from config.mongodb import get_db

TEST_DB_NAME = "mithaimart_test"  # separate database, real data is never touched

VALID_ADDRESS = {
    "full_name": "Asha Verma",
    "phone_number": "9876543210",
    "house_number": "12B",
    "street": "MG Road",
    "area": "Indiranagar",
    "city": "Bengaluru",
    "state": "Karnataka",
    "pincode": "560038",
    "landmark": "Near the park",
}


@override_settings(MONGO_DB_NAME=TEST_DB_NAME)
class AddressApiTests(APITestCase):
    def setUp(self):
        db = get_db()
        db.client.drop_database(TEST_DB_NAME)
        db.addresses.create_index(
            "guest_id", unique=True, partialFilterExpression={"is_default": True}, name="one_default_per_guest"
        )
        self.guest_id = str(uuid.uuid4())
        self.other_guest_id = str(uuid.uuid4())

    def tearDown(self):
        get_db().client.drop_database(TEST_DB_NAME)

    # helpers -------------------------------------------------------------
    def call(self, method, url, body=None, guest_id="default"):
        guest_id = self.guest_id if guest_id == "default" else guest_id
        headers = {"HTTP_X_GUEST_ID": guest_id} if guest_id else {}
        return getattr(self.client, method)(url, body, format="json", **headers)

    def create(self, guest_id="default", **changes):
        return self.call("post", "/api/addresses/", {**VALID_ADDRESS, **changes}, guest_id=guest_id)

    def listing(self, guest_id="default"):
        return self.call("get", "/api/addresses/", guest_id=guest_id).json()

    # tests ---------------------------------------------------------------
    def test_guest_id_required(self):
        self.assertEqual(self.call("get", "/api/addresses/", guest_id=None).status_code, 400)
        self.assertEqual(self.call("post", "/api/addresses/", VALID_ADDRESS, guest_id="bad").status_code, 400)

    def test_create_and_get_address(self):
        response = self.create()
        self.assertEqual(response.status_code, 201)
        address = response.json()
        self.assertEqual(address["full_name"], "Asha Verma")
        self.assertEqual(address["landmark"], "Near the park")
        self.assertNotIn("guest_id", address)  # internal field is not exposed
        detail = self.call("get", f"/api/addresses/{address['id']}/")
        self.assertEqual(detail.status_code, 200)
        saved = get_db().addresses.find_one({})
        self.assertEqual(saved["guest_id"], self.guest_id)
        self.assertIn("created_at", saved)
        self.assertIn("updated_at", saved)

    def test_landmark_is_optional(self):
        body = {key: value for key, value in VALID_ADDRESS.items() if key != "landmark"}
        response = self.call("post", "/api/addresses/", body)
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.json()["landmark"], "")

    def test_required_fields_cannot_be_empty(self):
        for field in ("full_name", "phone_number", "house_number", "street", "area", "city", "state", "pincode"):
            for bad_value in ("", "   ", None):
                response = self.create(**{field: bad_value})
                self.assertEqual(response.status_code, 400, (field, bad_value))
                self.assertIn(field, response.json()["details"])
        self.assertEqual(self.listing(), [])

    def test_invalid_phone_numbers(self):
        for phone in ("12345", "98765432101", "5876543210", "98765abcde", "+919876543210", 9876543210):
            response = self.create(phone_number=phone)
            self.assertEqual(response.status_code, 400, phone)
            self.assertIn("phone_number", response.json()["details"])
        self.assertEqual(self.create(phone_number="6000000000").status_code, 201)

    def test_invalid_pincodes(self):
        for pincode in ("12345", "1234567", "56003a", "060001", 560038):
            response = self.create(pincode=pincode)
            self.assertEqual(response.status_code, 400, pincode)
            self.assertIn("pincode", response.json()["details"])

    def test_first_address_is_default_and_only_one_default(self):
        first = self.create().json()
        second = self.create(street="Second Street").json()
        self.assertTrue(first["is_default"])
        self.assertFalse(second["is_default"])

        # make the second one default
        response = self.call("put", f"/api/addresses/{second['id']}/", {**VALID_ADDRESS, "is_default": True})
        self.assertEqual(response.status_code, 200)
        defaults = [a["id"] for a in self.listing() if a["is_default"]]
        self.assertEqual(defaults, [second["id"]])

        # creating a new default address replaces the old default
        third = self.create(street="Third", is_default=True).json()
        defaults = [a["id"] for a in self.listing() if a["is_default"]]
        self.assertEqual(defaults, [third["id"]])
        self.assertEqual(self.listing()[0]["id"], third["id"])  # default is listed first

    def test_default_address_cannot_be_unset_directly(self):
        first = self.create().json()
        response = self.call("put", f"/api/addresses/{first['id']}/", {**VALID_ADDRESS, "is_default": False})
        self.assertTrue(response.json()["is_default"])

    def test_update_address(self):
        address = self.create().json()
        response = self.call("put", f"/api/addresses/{address['id']}/", {**VALID_ADDRESS, "city": "Mysuru"})
        self.assertEqual(response.json()["city"], "Mysuru")
        bad = self.call("put", f"/api/addresses/{address['id']}/", {**VALID_ADDRESS, "pincode": "12"})
        self.assertEqual(bad.status_code, 400)
        self.assertEqual(self.listing()[0]["city"], "Mysuru")

    def test_delete_address_and_default_moves(self):
        first = self.create().json()
        second = self.create(street="Second").json()
        response = self.call("delete", f"/api/addresses/{first['id']}/")  # first is the default one
        self.assertEqual(response.status_code, 204)
        remaining = self.listing()
        self.assertEqual([a["id"] for a in remaining], [second["id"]])
        self.assertTrue(remaining[0]["is_default"])  # default moved to the remaining address

    def test_invalid_and_unknown_address_id(self):
        self.assertEqual(self.call("get", "/api/addresses/abc/").status_code, 400)
        self.assertEqual(self.call("get", "/api/addresses/" + "a" * 24 + "/").status_code, 404)

    def test_address_limit(self):
        for number in range(10):
            self.assertEqual(self.create(street=f"Street {number}").status_code, 201)
        self.assertEqual(self.create(street="One too many").status_code, 409)

    def test_other_guest_cannot_see_or_change_my_addresses(self):
        mine = self.create().json()
        self.create(guest_id=self.other_guest_id, street="Other Street")
        url = f"/api/addresses/{mine['id']}/"

        # the list only contains the guest's own addresses
        self.assertEqual([a["street"] for a in self.listing(self.other_guest_id)], ["Other Street"])
        # read, update and delete of someone else's address all fail with 404
        self.assertEqual(self.call("get", url, guest_id=self.other_guest_id).status_code, 404)
        self.assertEqual(
            self.call("put", url, {**VALID_ADDRESS, "city": "Hacked"}, guest_id=self.other_guest_id).status_code, 404
        )
        self.assertEqual(self.call("delete", url, guest_id=self.other_guest_id).status_code, 404)
        # my address is untouched
        unchanged = self.call("get", url).json()
        self.assertEqual(unchanged["city"], "Bengaluru")
        self.assertEqual(get_db().addresses.count_documents({}), 2)
