import os, django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()
from config.mongodb import get_db

db = get_db()
p = db.products.find_one()
print("Product keys:", list(p.keys()))
print("Sample product:", p)
