# -*- coding: utf-8 -*-
"""两张截图的像素差异统计，用于确认接线改动没有引起非预期的视觉变化。

用法: python .qa/diff.py 基线.png 现状.png [输出差异图.png]
输出: 尺寸、不同像素数、占比、最大通道差、差异区域包围盒
"""
import sys
from PIL import Image, ImageChops

a_path, b_path = sys.argv[1], sys.argv[2]
out = sys.argv[3] if len(sys.argv) > 3 else None

a = Image.open(a_path).convert('RGB')
b = Image.open(b_path).convert('RGB')

if a.size != b.size:
    print('SIZE-DIFF %s vs %s' % (a.size, b.size))
    sys.exit(2)

diff = ImageChops.difference(a, b)
bbox = diff.getbbox()
total = a.size[0] * a.size[1]

# 容忍 <=2 的通道差（抗锯齿/图片解码的微小抖动）
gray = diff.convert('L')
changed = sum(1 for p in gray.getdata() if p > 2)
maxdiff = max(gray.getdata())

print('size       : %dx%d' % a.size)
print('changed px : %d / %d (%.4f%%)' % (changed, total, changed * 100.0 / total))
print('max channel: %d' % maxdiff)
print('bbox       : %s' % (bbox,))

if out:
    diff.save(out)
    print('diff image : %s' % out)

sys.exit(0 if changed == 0 else 1)
