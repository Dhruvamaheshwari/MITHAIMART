import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from config.mongodb import get_db

db = get_db()
frontend_dir = r"C:\Users\HP\Desktop\Django project\MithaiMart\frontend\public"

products = list(db.products.find())
categories = {str(c['_id']): c.get('name') for c in db.categories.find()}

print(f"Total products in DB: {len(products)}")

missing_files = []
existing_files = []
external_urls = []
duplicate_map = {}

for p in products:
    img = p.get('image_url')
    name = p.get('name')
    cat_id = str(p.get('category_id'))
    cat_name = categories.get(cat_id, 'Unknown')
    
    if not img:
        missing_files.append((p['_id'], name, 'NONE'))
        continue
        
    if img.startswith('http'):
        external_urls.append((p['_id'], name, img))
    elif img.startswith('/'):
        # local file path
        rel_path = img.lstrip('/')
        full_path = os.path.join(frontend_dir, rel_path.replace('/', os.sep))
        if os.path.exists(full_path):
            size = os.path.getsize(full_path)
            existing_files.append((p['_id'], name, img, size, cat_name))
            duplicate_map.setdefault(img, []).append(name)
        else:
            missing_files.append((p['_id'], name, img))

print(f"Existing local images: {len(existing_files)}")
print(f"Missing local images: {len(missing_files)}")
print(f"External URLs: {len(external_urls)}")

print("\n--- DUPLICATE IMAGES (Same image assigned to multiple different products) ---")
for img, prods in duplicate_map.items():
    if len(prods) > 1:
        print(f"Image {img} used by {len(prods)} products: {', '.join(prods)}")

if missing_files:
    print("\n--- MISSING IMAGES ---")
    for item in missing_files:
        print(item)
