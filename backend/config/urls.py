from django.contrib import admin
from django.urls import include, path

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/", include("apps.core.urls")),
    path("api/", include("apps.products.urls")),
    path("api/", include("apps.cart.urls")),
    path("api/", include("apps.accounts.urls")),
    path("api/", include("apps.orders.urls")),
]
