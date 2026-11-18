import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from config.mongodb import get_db

db = get_db()

UPDATES = {
    "Chak-Hao Kheer": "/images/sweets/chakhao-kheer.jpg",
    "Qubani Ka Meetha": "/images/sweets/qubani-ka-meetha.jpg",
    "Panjiri": "/images/sweets/panjiri.jpg",
    "Gathiya": "/images/sweets/gathiya.jpg",
    "Mawa Kachori": "/images/sweets/mawa-kachori.jpg",
    "Alwar Kalakand": "/images/sweets/alwar-kalakand.jpg",
    "Kesar Peda (Mathura Special)": "/images/sweets/kesar-peda.jpg",
    "Kaju Katli (Royal Silver Leaf)": "/images/sweets/kaju-katli-aesthetic.jpg",
    "Motichoor Laddu (Pure Desi Ghee)": "/images/sweets/motichoor-laddu.jpg",
    "Besan Laddu (Shahi Desi Ghee)": "/images/sweets/besan-laddu.jpg",
    "Shahi Gulab Jamun": "/images/sweets/gulab-jamun-aesthetic.jpg",
    "Royal Rasmalai (Kesar Pista)": "/images/sweets/rasmalai-aesthetic.jpg",
    "Special Mysore Paak": "/images/sweets/mysore-pak.jpg",
    "Banaras Soan Papdi": "/images/sweets/soan-papdi.jpg",
    "Pista Mawa Barfi": "/images/sweets/barfi.jpg",
    "Crunchy Kesar Jalebi": "/images/sweets/jalebi.jpg",
    "Gujiya": "/images/sweets/gujiya.jpg",
}

print("Updating MongoDB product image URLs...")
for prod_name, new_url in UPDATES.items():
    res = db.products.update_many({"name": prod_name}, {"$set": {"image_url": new_url}})
    print(f"  • {prod_name}: updated {res.modified_count} product(s) -> {new_url}")

print("Update completed successfully!")
