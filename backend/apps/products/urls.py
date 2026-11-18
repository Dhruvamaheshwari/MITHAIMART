from django.urls import path

from . import views

urlpatterns = [
    path("categories/", views.category_list, name="category-list"),
    path("categories/<str:category_id>/", views.category_detail, name="category-detail"),
    path("images/<str:image_id>/", views.image_file, name="image-file"),
    path("states/", views.state_list, name="state-list"),
    path("products/", views.product_list, name="product-list"),
    path("products/<str:product_id>/", views.product_detail, name="product-detail"),
]
