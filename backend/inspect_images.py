import os, django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()
from config.mongodb import get_db

db = get_db()
products = list(db.products.find())
print(f"TOTAL_PRODUCTS: {len(products)}")

url_types = {}
for p in products:
    url = p.get('image_url')
    if not url:
        kind = "EMPTY_OR_NONE"
    elif url.startswith("http"):
        if "cloudinary" in url:
            kind = "CLOUDINARY_HTTP"
        else:
            kind = "OTHER_HTTP"
    elif url.startswith("/api/images/"):
        kind = "API_IMAGES_MONGO"
    elif url.startswith("/images/"):
        kind = "LOCAL_FRONTEND_IMAGES"
    else:
        kind = "OTHER"
    url_types[kind] = url_types.get(kind, 0) + 1

print("\n--- URL TYPES DISTRIBUTION ---")
for k, v in url_types.items():
    print(f"  {k}: {v}")

print("\n--- DETAILS FOR ALL PRODUCTS ---")
for p in products:
    print(f"ID: {p['_id']} | NAME: {p.get('name')} | URL: {p.get('image_url')}")
