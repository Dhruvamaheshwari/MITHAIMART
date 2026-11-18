"""Tests for the admin image upload API. Cloudinary itself is replaced by a fake (mock), so no
real image is uploaded and no internet or credentials are needed. The mock checks that our
code sends the right things to Cloudinary and handles its answers and failures correctly."""

from datetime import datetime, timezone
from unittest import mock

from django.contrib.auth.models import User
from django.core.files.uploadedfile import SimpleUploadedFile
from django.core.cache import cache
from django.test import override_settings
from rest_framework.test import APITestCase
from rest_framework_simplejwt.tokens import AccessToken

from apps.products.image_upload import MAX_IMAGE_BYTES
from config.mongodb import get_db

TEST_DB_NAME = "mithaimart_test"
FAKE_URL = "https://res.cloudinary.com/demo/image/upload/v1700000000/mithaimart/products/sample.jpg"
UPLOAD_PATH = "apps.products.image_upload.cloudinary.uploader.upload"

JPEG_BYTES = b"\xff\xd8\xff\xe0" + b"\x00" * 100
PNG_BYTES = b"\x89PNG\r\n\x1a\n" + b"\x00" * 100
WEBP_BYTES = b"RIFF" + b"\x24\x00\x00\x00" + b"WEBP" + b"VP8 " + b"\x00" * 100


@override_settings(
    MONGO_DB_NAME=TEST_DB_NAME,
    PASSWORD_HASHERS=["django.contrib.auth.hashers.MD5PasswordHasher"],
    CLOUDINARY_CLOUD_NAME="test-cloud",
    CLOUDINARY_API_KEY="test-key",
    CLOUDINARY_API_SECRET="super-secret-value",
)
class UploadImageApiTests(APITestCase):
    def setUp(self):
        cache.clear()
        get_db().client.drop_database(TEST_DB_NAME)
        self.admin_user = User.objects.create_user("shopadmin", password="Str0ng-pass!", is_staff=True)
        self.customer = User.objects.create_user("customer", password="Str0ng-pass!")
        self.admin_headers = {"HTTP_AUTHORIZATION": f"Bearer {AccessToken.for_user(self.admin_user)}"}

    def tearDown(self):
        get_db().client.drop_database(TEST_DB_NAME)

    def upload(self, content, name="photo.jpg", content_type="image/jpeg", headers="admin"):
        headers = self.admin_headers if headers == "admin" else headers
        file = SimpleUploadedFile(name, content, content_type=content_type)
        return self.client.post("/api/admin/upload-image/", {"image": file}, format="multipart", **headers)

    # valid uploads -------------------------------------------------------
    def test_valid_jpeg_png_and_webp_are_uploaded_and_the_secure_url_is_returned(self):
        for content, name, content_type in (
            (JPEG_BYTES, "a.jpg", "image/jpeg"),
            (PNG_BYTES, "b.png", "image/png"),
            (WEBP_BYTES, "c.webp", "image/webp"),
        ):
            with mock.patch(UPLOAD_PATH, return_value={"secure_url": FAKE_URL}) as fake_upload:
                response = self.upload(content, name, content_type)
            self.assertEqual(response.status_code, 201, (name, response.content))
            self.assertEqual(response.json(), {"url": FAKE_URL})
            self.assertTrue(response.json()["url"].startswith("https://"))
            fake_upload.assert_called_once()
            options = fake_upload.call_args.kwargs
            self.assertEqual(options["folder"], "mithaimart/products")
            self.assertEqual(options["resource_type"], "image")
            self.assertEqual(options["allowed_formats"], ["jpg", "png", "webp"])
            self.assertNotIn("super-secret-value", response.content.decode())

    def test_file_type_is_checked_by_content_not_by_name_or_header(self):
        """A text file renamed to .jpg with an image content-type header must still be refused."""
        bad_files = [
            (b"just some text pretending to be a picture", "photo.jpg", "image/jpeg"),
            (b"GIF89a" + b"\x00" * 50, "anim.gif", "image/gif"),
            (b"%PDF-1.4 fake pdf", "doc.pdf", "application/pdf"),
            (b"<svg xmlns='http://www.w3.org/2000/svg'></svg>", "logo.svg", "image/svg+xml"),
            (b"<?php echo 1; ?>", "shell.php", "image/png"),
            (b"MZ\x90\x00" + b"\x00" * 50, "program.exe", "image/jpeg"),
        ]
        for content, name, content_type in bad_files:
            with mock.patch(UPLOAD_PATH) as fake_upload:
                response = self.upload(content, name, content_type)
            self.assertEqual(response.status_code, 400, name)
            self.assertEqual(response.json()["error"], "Only JPEG, PNG or WebP images are allowed.")
            fake_upload.assert_not_called()

    def test_real_jpeg_with_the_wrong_name_is_accepted(self):
        with mock.patch(UPLOAD_PATH, return_value={"secure_url": FAKE_URL}):
            response = self.upload(JPEG_BYTES, "photo.txt", "text/plain")
        self.assertEqual(response.status_code, 201)

    def test_file_larger_than_5mb_is_refused(self):
        too_big = JPEG_BYTES + b"\x00" * (MAX_IMAGE_BYTES - len(JPEG_BYTES) + 1)
        self.assertEqual(len(too_big), MAX_IMAGE_BYTES + 1)
        with mock.patch(UPLOAD_PATH) as fake_upload:
            response = self.upload(too_big)
        self.assertEqual(response.status_code, 413)
        self.assertIn("5 MB", response.json()["error"])
        fake_upload.assert_not_called()

    def test_file_of_exactly_5mb_is_accepted(self):
        just_fits = JPEG_BYTES + b"\x00" * (MAX_IMAGE_BYTES - len(JPEG_BYTES))
        with mock.patch(UPLOAD_PATH, return_value={"secure_url": FAKE_URL}):
            self.assertEqual(self.upload(just_fits).status_code, 201)

    def test_huge_request_is_refused_before_it_is_read(self):
        with mock.patch(UPLOAD_PATH) as fake_upload:
            response = self.client.post(
                "/api/admin/upload-image/",
                {"image": SimpleUploadedFile("a.jpg", JPEG_BYTES)},
                format="multipart",
                CONTENT_LENGTH=str(50 * 1024 * 1024),  # the browser says it is sending 50 MB
                **self.admin_headers,
            )
        self.assertEqual(response.status_code, 413)
        fake_upload.assert_not_called()

    def test_missing_or_empty_file(self):
        with mock.patch(UPLOAD_PATH) as fake_upload:
            no_file = self.client.post("/api/admin/upload-image/", {}, format="multipart", **self.admin_headers)
            text_field = self.client.post(
                "/api/admin/upload-image/", {"image": "not a file"}, format="multipart", **self.admin_headers
            )
            empty = self.upload(b"")
            wrong_field = self.client.post(
                "/api/admin/upload-image/",
                {"photo": SimpleUploadedFile("a.jpg", JPEG_BYTES)},
                format="multipart",
                **self.admin_headers,
            )
            json_body = self.client.post("/api/admin/upload-image/", {"image": "x"}, format="json", **self.admin_headers)
        self.assertEqual(no_file.status_code, 400)
        self.assertEqual(text_field.status_code, 400)
        self.assertEqual(empty.status_code, 400)
        self.assertEqual(wrong_field.status_code, 400)
        self.assertEqual(json_body.status_code, 415)  # only multipart file uploads are accepted
        fake_upload.assert_not_called()

    # who may upload ------------------------------------------------------
    def test_only_admins_can_upload(self):
        customer_headers = {"HTTP_AUTHORIZATION": f"Bearer {AccessToken.for_user(self.customer)}"}
        with mock.patch(UPLOAD_PATH) as fake_upload:
            no_token = self.upload(JPEG_BYTES, headers={})
            guest = self.upload(JPEG_BYTES, headers={"HTTP_X_GUEST_ID": "11111111-2222-4333-8444-555555555555"})
            forged = self.upload(JPEG_BYTES, headers={"HTTP_AUTHORIZATION": "Bearer forged.token.value"})
            normal_user = self.upload(JPEG_BYTES, headers=customer_headers)
        self.assertEqual(no_token.status_code, 401)
        self.assertEqual(guest.status_code, 401)
        self.assertEqual(forged.status_code, 401)
        self.assertEqual(normal_user.status_code, 403)
        fake_upload.assert_not_called()

    def test_demoted_admin_cannot_upload(self):
        User.objects.filter(pk=self.admin_user.pk).update(is_staff=False)
        with mock.patch(UPLOAD_PATH) as fake_upload:
            self.assertEqual(self.upload(JPEG_BYTES).status_code, 403)
        fake_upload.assert_not_called()

    # Cloudinary problems --------------------------------------------------
    @override_settings(CLOUDINARY_CLOUD_NAME="", CLOUDINARY_API_KEY="", CLOUDINARY_API_SECRET="")
    def test_without_cloudinary_the_image_is_stored_in_mongodb_and_can_be_viewed_publicly(self):
        with mock.patch(UPLOAD_PATH) as fake_upload:
            response = self.upload(PNG_BYTES, "b.png", "image/png")
        fake_upload.assert_not_called()
        self.assertEqual(response.status_code, 201)
        url = response.json()["url"]
        self.assertTrue(url.startswith("http://testserver/api/images/"), url)
        self.assertEqual(get_db().images.count_documents({}), 1)
        # anyone (no login) can open the link
        shown = self.client.get(url.replace("http://testserver", ""))
        self.assertEqual(shown.status_code, 200)
        self.assertEqual(shown["Content-Type"], "image/png")
        self.assertEqual(shown["X-Content-Type-Options"], "nosniff")
        self.assertEqual(shown.content, PNG_BYTES)
        # and the product form accepts that link
        from apps.products.views import is_valid_image_url
        self.assertTrue(is_valid_image_url(url))

    @override_settings(CLOUDINARY_CLOUD_NAME="", CLOUDINARY_API_KEY="", CLOUDINARY_API_SECRET="")
    def test_fake_image_is_still_refused_when_storing_in_mongodb(self):
        response = self.upload(b"<html>not an image</html>", "x.jpg", "image/jpeg")
        self.assertEqual(response.status_code, 400)
        self.assertEqual(get_db().images.count_documents({}), 0)

    def test_unknown_or_bad_image_id_gives_404(self):
        self.assertEqual(self.client.get("/api/images/64b64b64b64b64b64b64b64b/").status_code, 404)
        self.assertEqual(self.client.get("/api/images/not-an-id/").status_code, 404)

    def test_cloudinary_failure_returns_a_clear_error_without_leaking_details(self):
        failure = Exception("Invalid api_secret super-secret-value for cloud test-cloud")
        with mock.patch(UPLOAD_PATH, side_effect=failure):
            response = self.upload(JPEG_BYTES)
        self.assertEqual(response.status_code, 502)
        self.assertEqual(response.json()["error"], "Could not upload the image. Please try again.")
        body = response.content.decode()
        self.assertNotIn("super-secret-value", body)
        self.assertNotIn("test-cloud", body)

    def test_cloudinary_answer_without_a_url_is_treated_as_failure(self):
        with mock.patch(UPLOAD_PATH, return_value={"public_id": "x"}):  # no secure_url in the answer
            response = self.upload(JPEG_BYTES)
        self.assertEqual(response.status_code, 502)

    # saving the link ------------------------------------------------------
    def test_product_can_be_saved_with_the_returned_url_and_stores_only_the_link(self):
        with mock.patch(UPLOAD_PATH, return_value={"secure_url": FAKE_URL}):
            url = self.upload(JPEG_BYTES).json()["url"]
        category_id = get_db().categories.insert_one(
            {"name": "Sweets", "description": "", "image_url": "", "is_active": True, "created_at": datetime.now(timezone.utc)}
        ).inserted_id
        body = {
            "name": "Kaju Katli",
            "description": "x",
            "category_id": str(category_id),
            "image_url": url,
            "variants": [{"weight": "250g", "price": 250, "stock": 5}],
        }
        created = self.client.post("/api/products/", body, format="json", **self.admin_headers)
        self.assertEqual(created.status_code, 201, created.content)
        saved = get_db().products.find_one({"name": "Kaju Katli"})
        self.assertEqual(saved["image_url"], FAKE_URL)
        self.assertNotIn(JPEG_BYTES, [value for value in saved.values() if isinstance(value, bytes)])  # no file data
        public = self.client.get(f"/api/products/{created.json()['id']}/").json()
        self.assertEqual(public["image_url"], FAKE_URL)
