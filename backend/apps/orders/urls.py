from django.urls import path

from . import views

urlpatterns = [
    path("checkout/validate/", views.checkout_validate, name="checkout-validate"),
    path("orders/create/", views.order_create, name="order-create"),
    path("orders/", views.order_list, name="order-list"),
    path("orders/<str:order_id>/", views.order_detail, name="order-detail"),
]
