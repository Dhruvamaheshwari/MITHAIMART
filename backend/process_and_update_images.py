import os
import shutil
from PIL import Image, ImageOps

# Source directory for generated images
BRAIN_DIR = r"C:\Users\HP\.gemini\antigravity\brain\e2139985-da05-425b-bc5b-cbd6b71e25a9"
DEST_DIR = r"C:\Users\HP\Desktop\Django project\MithaiMart\frontend\public\images\sweets"

GENERATED_MAP = {
    "kaju_katli_luxury_1795030770674.jpg": ["kaju-katli-aesthetic.jpg", "kaju-katli.jpg"],
    "luxury_motichoor_ladoo_1795030819509.jpg": ["motichoor-laddu.jpg"],
    "besan_ladoo_luxury_1795030822071.jpg": ["besan-laddu.jpg"],
    "shahi_gulab_jamun_1795030828293.jpg": ["gulab-jamun-aesthetic.jpg", "gulab-jamun.jpg"],
    "premium_bengali_rasgulla_1795030839954.jpg": ["rasgulla.jpg"],
    "royal_rasmalai_luxury_1795030855694.jpg": ["rasmalai-aesthetic.jpg", "rasmalai.jpg"],
    "soan_papdi_luxury_sweet_1795030858825.jpg": ["soan-papdi.jpg"],
    "authentic_kesar_milk_peda_1795030864781.jpg": ["kesar-peda.jpg"],
    "royal_mysore_pak_1795030872702.jpg": ["mysore-pak.jpg"],
    "kesar_jalebi_luxury_1795030918738.jpg": ["jalebi.jpg"],
    "alwar_kalakand_luxury_1795030923768.jpg": ["kalakand.jpg", "alwar-kalakand.jpg"],
    "pista_mawa_barfi_luxury_1795030934713.jpg": ["barfi.jpg"],
    "festive_shahi_gujiya_1795030940050.jpg": ["gujiya.jpg"],
}

print("=== 1. INSTALLING & OPTIMIZING GENERATED LUXURY IMAGES ===")
for gen_file, target_files in GENERATED_MAP.items():
    src_path = os.path.join(BRAIN_DIR, gen_file)
    if not os.path.exists(src_path):
        print(f"WARNING: Source {src_path} not found!")
        continue
    
    with Image.open(src_path) as img:
        img = img.convert("RGB")
        # Resize to 1000x1000 with high-quality Lanczos filter
        resized = img.resize((1000, 1000), Image.Resampling.LANCZOS)
        
        for tgt in target_files:
            out_path = os.path.join(DEST_DIR, tgt)
            resized.save(out_path, "JPEG", quality=88, optimize=True, progressive=True)
            new_sz = os.path.getsize(out_path) / 1024
            print(f"✓ Saved {tgt}: 1000x1000, {round(new_sz, 1)} KB (from {gen_file})")

print("\n=== 2. OPTIMIZING EXISTING OVERSIZED IMAGES (> 1.5MB) ===")
for fname in os.listdir(DEST_DIR):
    fpath = os.path.join(DEST_DIR, fname)
    if not os.path.isfile(fpath):
        continue
    sz_kb = os.path.getsize(fpath) / 1024
    if sz_kb > 1500:
        try:
            with Image.open(fpath) as img:
                w, h = img.size
                img = img.convert("RGB")
                max_dim = 1200
                if w > max_dim or h > max_dim:
                    scale = min(max_dim / w, max_dim / h)
                    nw, nh = int(w * scale), int(h * scale)
                    img = img.resize((nw, nh), Image.Resampling.LANCZOS)
                
                # If PNG extension, save as PNG optimized or convert
                if fname.lower().endswith(".png"):
                    img.save(fpath, "PNG", optimize=True)
                else:
                    img.save(fpath, "JPEG", quality=85, optimize=True, progressive=True)
                
                new_sz_kb = os.path.getsize(fpath) / 1024
                print(f"✓ Optimized {fname}: was {round(sz_kb, 1)} KB -> now {round(new_sz_kb, 1)} KB ({img.size[0]}x{img.size[1]})")
        except Exception as e:
            print(f"Error optimizing {fname}: {e}")

print("\nImage processing complete!")
