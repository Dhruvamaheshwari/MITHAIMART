import os
from PIL import Image

sweets_dir = r"C:\Users\HP\Desktop\Django project\MithaiMart\frontend\public\images\sweets"

report = []
for fname in sorted(os.listdir(sweets_dir)):
    fpath = os.path.join(sweets_dir, fname)
    if not os.path.isfile(fpath):
        continue
    try:
        with Image.open(fpath) as img:
            w, h = img.size
            size_kb = os.path.getsize(fpath) / 1024
            ratio = round(w / h, 2)
            report.append((fname, w, h, ratio, round(size_kb, 1), img.format))
    except Exception as e:
        report.append((fname, 0, 0, 0, 0, f"ERROR: {e}"))

print(f"Total image files in {sweets_dir}: {len(report)}")

# Print low resolution (< 400px width or height)
low_res = [r for r in report if r[1] < 400 or r[2] < 400]
print(f"\nLow resolution images (<400px): {len(low_res)}")
for r in low_res:
    print(f"  {r[0]}: {r[1]}x{r[2]} ({r[3]}), {r[4]} KB")

# Print excessively huge files (> 2 MB)
huge_files = [r for r in report if r[4] > 2000]
print(f"\nExcessively large files (>2MB): {len(huge_files)}")
for r in huge_files:
    print(f"  {r[0]}: {r[1]}x{r[2]}, {r[4]} KB")
