from django.db import models


class Category(models.Model):
    """A group of products, e.g. Fresh Sweets or Namkeen."""

    name = models.CharField(max_length=100, unique=True)
    description = models.TextField(blank=True)
    image_url = models.URLField(blank=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name_plural = "categories"

    def __str__(self):
        return self.name


class Product(models.Model):
    """A sweet or snack, e.g. Kaju Katli. Belongs to one category."""

    # PROTECT: a category cannot be deleted while it still has products
    category = models.ForeignKey(Category, on_delete=models.PROTECT, related_name="products")
    name = models.CharField(max_length=150)
    description = models.TextField()
    image_url = models.URLField(blank=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.name


class ProductVariant(models.Model):
    """A purchasable weight of a product, with its own price and stock."""

    # CASCADE: deleting a product also deletes its variants
    product = models.ForeignKey(Product, on_delete=models.CASCADE, related_name="variants")
    weight = models.CharField(max_length=20, help_text="For example: 250g, 500g, 1kg")
    price = models.DecimalField(max_digits=8, decimal_places=2)  # price in rupees
    stock = models.PositiveIntegerField(default=0)
    is_available = models.BooleanField(default=True)

    class Meta:
        # The same weight cannot be added twice for one product
        unique_together = ("product", "weight")

    def __str__(self):
        return f"{self.product.name} - {self.weight}"
