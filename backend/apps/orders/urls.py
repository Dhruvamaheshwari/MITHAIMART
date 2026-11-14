from django.urls import path

from . import views

urlpatterns = [
    path("checkout/validate/", views.checkout_validate, name="checkout-validate"),
]
