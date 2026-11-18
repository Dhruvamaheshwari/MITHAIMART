from django.urls import path

from . import admin_views, auth_views, views

urlpatterns = [
    # Customer accounts
    path("auth/register/", auth_views.register, name="customer-register"),
    path("auth/login/", auth_views.login, name="customer-login"),
    path("auth/me/", auth_views.me, name="customer-me"),
    path("addresses/", views.address_list, name="address-list"),
    path("addresses/<str:address_id>/", views.address_detail, name="address-detail"),
    # Admin APIs (token login + admin role check on every request)
    path("admin/login/", admin_views.admin_login, name="admin-login"),
    path("admin/me/", admin_views.admin_me, name="admin-me"),
    path("admin/stats/", admin_views.admin_stats, name="admin-stats"),
    path("admin/products/", admin_views.admin_product_list, name="admin-product-list"),
    path("admin/products/<str:product_id>/stock/", admin_views.admin_product_stock, name="admin-product-stock"),
    path("admin/categories/", admin_views.admin_category_list, name="admin-category-list"),
    path("admin/upload-image/", admin_views.admin_upload_image, name="admin-upload-image"),
    path("admin/orders/", admin_views.admin_order_list, name="admin-order-list"),
    path("admin/orders/<str:order_id>/status/", admin_views.admin_order_status, name="admin-order-status"),
]
