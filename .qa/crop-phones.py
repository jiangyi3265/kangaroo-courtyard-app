from PIL import Image
import numpy as np, glob, os, re, json, sys
root='袋鼠小院-手作人文完整版全量UI-53张/袋鼠小院-手作人文完整版全量UI'
out=sys.argv[1]
os.makedirs(out,exist_ok=True)
files=sorted(glob.glob(root+'/*/*.png'))
meta={}
for f in files:
    num=re.match(r'(\d+)-',os.path.basename(f)).group(1)
    im=Image.open(f).convert('RGB'); a=np.array(im).astype(int)
    lum=a.sum(axis=2)//3
    H,W=lum.shape
    band=(lum[80:260]<45)
    cols=band.sum(axis=0)
    runs=[];x=0
    while x<W:
        if cols[x]>=10:
            s=x
            while x<W and cols[x]>=10: x+=1
            if 60<=x-s<=170:
                sub=band[:,s:x]
                ys=np.where(sub.sum(axis=1)>(x-s)*0.5)[0]
                if len(ys) and 14<=ys.max()-ys.min()<=48 and sub[ys.min():ys.max()+1].mean()>0.6:
                    runs.append((s,x,ys.min()+80,ys.max()+80))
        else: x+=1
    # keep 4 with best spacing: if more than 4, drop those whose center is nearest another
    runs.sort()
    while len(runs)>4:
        cs=[(r[0]+r[1])//2 for r in runs]
        d=[min(abs(cs[i]-cs[j]) for j in range(len(cs)) if j!=i) for i in range(len(cs))]
        runs.pop(int(np.argmin(d)))
    boxes=[]
    for s,e,ny,ny2 in runs:
        cx=(s+e)//2; half=205
        top=max(0,ny-45); bottom=min(H-1,top+int(half*2*1.97))
        boxes.append((max(0,cx-half),top,min(W-1,cx+half),bottom))
    meta[num]={'file':f,'boxes':[list(map(int,b)) for b in boxes]}
    for i,(l,t,r,b) in enumerate(boxes):
        crop=im.crop((l,t,r+1,b+1))
        crop=crop.resize((crop.width*2,crop.height*2),Image.LANCZOS)
        crop.save(f'{out}/{num}-{i+1}.png')
    print(num,len(boxes),boxes)
json.dump(meta,open(f'{out}/meta.json','w'),ensure_ascii=False,indent=1)
