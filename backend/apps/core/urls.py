from django.urls import path
from . import views, hamper_views, coupon_views, bulk_views, wholesale_views

urlpatterns = [
    path("health/", views.health_check, name="health-check"),
    path("contact/", views.contact_us, name="contact-us"),
    path("catalog/pdf/", views.download_catalog_pdf_view, name="catalog-pdf"),
    path("catalog/qr/", views.download_catalog_qr_view, name="catalog-qr"),

    # Hamper APIs
    path("hamper/boxes/", hamper_views.hamper_boxes_list, name="hamper-boxes"),
    path("hamper/products/", hamper_views.hamper_products_list, name="hamper-products"),
    path("hamper/estimate/", hamper_views.hamper_estimate, name="hamper-estimate"),
    path("hamper/cart/add/", hamper_views.hamper_cart_add, name="hamper-cart-add"),
    path("cart/hamper/remove/<str:hamper_id>/", hamper_views.hamper_cart_remove, name="hamper-cart-remove"),
    path("admin/hamper/settings/", hamper_views.admin_hamper_settings, name="admin-hamper-settings"),

    # Coupon APIs
    path("coupons/validate/", coupon_views.validate_coupon, name="coupon-validate"),
    path("coupons/my/", coupon_views.my_coupons_list, name="coupon-my"),

    # Bulk Orders & Wholesale Pricing APIs
    path("bulk/rules/", bulk_views.bulk_rules_view, name="bulk-rules"),
    path("bulk/products/", bulk_views.bulk_products_list, name="bulk-products"),
    path("bulk/estimate/", bulk_views.bulk_estimate, name="bulk-estimate"),
    path("bulk/cart/add/", bulk_views.bulk_cart_add, name="bulk-cart-add"),
    path("admin/bulk/settings/", bulk_views.admin_bulk_settings, name="admin-bulk-settings"),

    # Wholesale Request & Quotation APIs
    path("wholesale/request/", wholesale_views.wholesale_request_create, name="wholesale-request"),
    path("wholesale/my-requests/", wholesale_views.wholesale_my_requests, name="wholesale-my-requests"),
    path("wholesale/<str:request_id>/accept/", wholesale_views.wholesale_accept_quotation, name="wholesale-accept"),
    path("wholesale/<str:request_id>/reject/", wholesale_views.wholesale_reject_quotation, name="wholesale-reject"),
    path("admin/wholesale/", wholesale_views.admin_wholesale_list, name="admin-wholesale-list"),
    path("admin/wholesale/<str:request_id>/", wholesale_views.admin_wholesale_detail, name="admin-wholesale-detail"),
    path("admin/wholesale/<str:request_id>/quotation/", wholesale_views.admin_wholesale_send_quotation, name="admin-wholesale-quotation"),
    path("admin/wholesale/<str:request_id>/status/", wholesale_views.admin_wholesale_update_status, name="admin-wholesale-status"),
]
