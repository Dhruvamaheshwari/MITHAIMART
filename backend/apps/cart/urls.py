from django.urls import path

from . import views

urlpatterns = [
    path("cart/", views.cart_detail, name="cart-detail"),
    path("cart/add/", views.cart_add, name="cart-add"),
    path("cart/update/", views.cart_update, name="cart-update"),
    path("cart/remove/<str:product_id>/<str:variant_weight>/", views.cart_remove, name="cart-remove"),
    path("cart/clear/", views.cart_clear, name="cart-clear"),
]
