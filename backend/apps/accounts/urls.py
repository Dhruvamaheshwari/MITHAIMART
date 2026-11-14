from django.urls import path

from . import views

urlpatterns = [
    path("addresses/", views.address_list, name="address-list"),
    path("addresses/<str:address_id>/", views.address_detail, name="address-detail"),
]
