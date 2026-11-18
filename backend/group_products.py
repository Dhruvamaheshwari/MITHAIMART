import os
import django
from PIL import Image

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from config.mongodb import get_db

db = get_db()
frontend_dir = r"C:\Users\HP\Desktop\Django project\MithaiMart\frontend\public"

products = list(db.products.find())
categories = {str(c['_id']): c.get('name') for c in db.categories.find()}

by_cat = {}
for p in products:
    cat = categories.get(str(p.get('category_id')), 'Uncategorized')
    by_cat.setdefault(cat, []).append(p)

for cat, prods in sorted(by_cat.items()):
    print(f"\n==========================================")
    print(f"CATEGORY: {cat} ({len(prods)} products)")
    print(f"==========================================")
    for p in prods:
        url = p.get('image_url')
        info = "UNKNOWN"
        if url and url.startswith('/'):
            fpath = os.path.join(frontend_dir, url.lstrip('/').replace('/', os.sep))
            if os.path.exists(fpath):
                sz_kb = round(os.path.getsize(fpath) / 1024, 1)
                try:
                    with Image.open(fpath) as im:
                        w, h = im.size
                        info = f"{w}x{h}, {sz_kb}KB"
                except Exception as e:
                    info = f"ERROR: {e}"
            else:
                info = "MISSING_FILE"
        elif url:
            info = "REMOTE_URL"
        print(f"  • {p['name']} ({p.get('state', 'India')}) -> {url} [{info}]")
