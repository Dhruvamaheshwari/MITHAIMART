from django.urls import path
from . import views

urlpatterns = [
    path("health/", views.health_check, name="health-check"),
    path("contact/", views.contact_us, name="contact-us"),
    path("catalog/pdf/", views.download_catalog_pdf_view, name="catalog-pdf"),
]
