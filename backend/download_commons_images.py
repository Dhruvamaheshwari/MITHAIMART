import os
import urllib.request
from PIL import Image

DEST_DIR = r"C:\Users\HP\Desktop\Django project\MithaiMart\frontend\public\images\sweets"

IMAGES_TO_FETCH = {
    "chakhao-kheer.jpg": "https://upload.wikimedia.org/wikipedia/commons/c/c6/Chahao_kheer.jpg",
    "qubani-ka-meetha.jpg": "https://upload.wikimedia.org/wikipedia/commons/3/3c/Khobani_Ka_Meetha.JPG",
    "panjiri.jpg": "https://upload.wikimedia.org/wikipedia/commons/e/e5/Panjeeri..JPG",
    "gathiya.jpg": "https://upload.wikimedia.org/wikipedia/commons/b/b5/Gathiya.jpg",
    "mawa-kachori.jpg": "https://upload.wikimedia.org/wikipedia/commons/1/19/Khasta_kachori.jpg",
}

for fname, url in IMAGES_TO_FETCH.items():
    dest_path = os.path.join(DEST_DIR, fname)
    tmp_path = dest_path + ".tmp"
    try:
        print(f"Downloading {fname} from {url}...")
        req = urllib.request.Request(url, headers={'User-Agent': 'MithaiMart/1.0 (info@mithaimart.com)'})
        with urllib.request.urlopen(req, timeout=20) as resp, open(tmp_path, 'wb') as f:
            f.write(resp.read())
        
        with Image.open(tmp_path) as im:
            im = im.convert("RGB")
            w, h = im.size
            # center crop to 1:1 if needed
            min_dim = min(w, h)
            left = (w - min_dim) // 2
            top = (h - min_dim) // 2
            im_cropped = im.crop((left, top, left + min_dim, top + min_dim))
            im_resized = im_cropped.resize((1000, 1000), Image.Resampling.LANCZOS)
            im_resized.save(dest_path, "JPEG", quality=88, optimize=True)
        
        if os.path.exists(tmp_path):
            os.remove(tmp_path)
            
        print(f"✓ Saved {fname}: 1000x1000 ({round(os.path.getsize(dest_path)/1024, 1)} KB)")
    except Exception as e:
        print(f"Error for {fname}: {e}")
        if os.path.exists(tmp_path):
            os.remove(tmp_path)
