import os, django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()
from config.mongodb import get_db

db = get_db()
prods = list(db.products.find())

# Check products that share the same image
img_to_prods = {}
for p in prods:
    img_to_prods.setdefault(p.get('image_url'), []).append(p)

for img, p_list in img_to_prods.items():
    if len(p_list) > 1:
        print(f"\nSHARED IMAGE: {img}")
        for p in p_list:
            print(f"   - {p['name']} (state: {p.get('state')})")
