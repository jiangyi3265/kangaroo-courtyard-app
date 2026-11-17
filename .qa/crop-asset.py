"""从设计总览图裁切照片/插画素材到 static/media。
用法: python .qa/crop-asset.py <图号NN> <屏号1-4> <x0> <y0> <x1> <y1> <文件名(不含扩展名)> [--png] [--scale 1.5]
坐标为 crops/NN-k.png（2 倍放大屏截图）上的像素坐标。输出 static/media/<文件名>.jpg（或 .png）。
"""
import sys, json, os
from PIL import Image

CROPS = os.path.join(os.path.dirname(os.path.abspath(__file__)), "design-crops")
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
args = [a for a in sys.argv[1:] if not a.startswith('--')]
flags = sys.argv[1:]
num, k, x0, y0, x1, y1, name = args[0], int(args[1]), *map(float, args[2:6]), args[6]
png = '--png' in flags
scale = float(flags[flags.index('--scale') + 1]) if '--scale' in flags else 1.0
meta = json.load(open(os.path.join(CROPS, 'meta.json'), encoding='utf-8'))
entry = meta[num]
box = entry['boxes'][k - 1]
im = Image.open(os.path.join(ROOT, '..', entry['file'])).convert('RGB')
L, T = box[0], box[1]
region = (int(L + x0 / 2), int(T + y0 / 2), int(L + x1 / 2), int(T + y1 / 2))
crop = im.crop(region)
if scale != 1.0:
    crop = crop.resize((int(crop.width * scale), int(crop.height * scale)), Image.LANCZOS)
out_dir = os.path.join(ROOT, 'static', 'media')
os.makedirs(out_dir, exist_ok=True)
out = os.path.join(out_dir, f'{name}.{"png" if png else "jpg"}')
if png:
    crop.save(out, optimize=True)
else:
    crop.save(out, quality=86, optimize=True)
print(out, crop.size, os.path.getsize(out))
