"""把设计屏截图与实现截图并排拼在一起便于比对。
用法: python .qa/pair.py <NN> <k> <实现截图.png> <输出.png>
左：设计（缩放到高 844），右：实现。
"""
import sys, os
from PIL import Image
CROPS = os.path.join(os.path.dirname(os.path.abspath(__file__)), "design-crops")
num, k, shot, out = sys.argv[1], sys.argv[2], sys.argv[3], sys.argv[4]
d = Image.open(os.path.join(CROPS, f'{num}-{k}.png')).convert('RGB')
d = d.resize((int(d.width * 844 / d.height), 844), Image.LANCZOS)
s = Image.open(shot).convert('RGB')
if s.height != 844:
    s = s.resize((int(s.width * 844 / s.height), 844), Image.LANCZOS)
canvas = Image.new('RGB', (d.width + s.width + 12, 844), (120, 120, 120))
canvas.paste(d, (0, 0)); canvas.paste(s, (d.width + 12, 0))
canvas.save(out)
print(out, canvas.size)
