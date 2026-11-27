import { asset } from './catalog.js'
import { absUrl } from '@/common/upload.js'

function canvasOf(width,height) {
  let canvas
  // #ifdef MP-WEIXIN
  canvas=wx.createOffscreenCanvas({type:'2d',width,height})
  // #endif
  // #ifdef H5
  canvas=document.createElement('canvas')
  // #endif
  canvas.width=width;canvas.height=height
  return canvas
}
function loadImage(canvas,src) {
  return new Promise((resolve,reject)=>{
    let img
    // #ifdef H5
    img=new Image();img.crossOrigin='anonymous'
    // #endif
    // #ifdef MP-WEIXIN
    img=canvas.createImage()
    // #endif
    img.onload=()=>resolve(img);img.onerror=()=>reject(new Error('照片读取失败，请换一张试试'))
    img.src=src
  })
}
// Remove the connected studio backdrop from the perimeter. Transparent PNG portraits retain their original edges.
function cutPortrait(image) {
  const w=320,h=Math.max(1,Math.min(540,Math.round(w*image.height/image.width)))
  const layer=canvasOf(w,h),ctx=layer.getContext('2d')
  ctx.drawImage(image,0,0,w,h)
  const pixels=ctx.getImageData(0,0,w,h),d=pixels.data
  const visited=new Uint8Array(w*h),queue=new Int32Array(w*h)
  const seeds=[0,w-1,(h-1)*w,w*h-1].map(i=>Array.from(d.slice(i*4,i*4+4)))
  if(seeds.some(s=>s[3]<10))return layer
  let head=0,tail=0
  function offer(i){
    if(visited[i])return
    visited[i]=1
    const k=i*4
    if(!seeds.some(s=>Math.max(Math.abs(d[k]-s[0]),Math.abs(d[k+1]-s[1]),Math.abs(d[k+2]-s[2]))<46))return
    queue[tail++]=i;d[k+3]=0
  }
  for(let x=0;x<w;x++){offer(x);offer((h-1)*w+x)}
  for(let y=0;y<h;y++){offer(y*w);offer(y*w+w-1)}
  while(head<tail){
    const i=queue[head++]
    if(i%w)offer(i-1)
    if(i%w<w-1)offer(i+1)
    if(i>=w)offer(i-w)
    if(i<(h-1)*w)offer(i+w)
  }
  ctx.putImageData(pixels,0,0);return layer
}
function cover(ctx,img,w,h) {
  const scale=Math.max(w/img.width,h/img.height)
  const sw=w/scale,sh=h/scale
  ctx.drawImage(img,(img.width-sw)/2,(img.height-sh)/2,sw,sh,0,0,w,h)
}
export async function makePoster(find,portrait,cut,name) {
  const canvas=canvasOf(600,840),ctx=canvas.getContext('2d')
  const bg=await loadImage(canvas,find.photo?absUrl(find.photo):asset(find.kind==='photo'?'visit':'postcard'))
  cover(ctx,bg,600,654)
  const person=await loadImage(canvas,portrait)
  const surface=cut?cutPortrait(person):person
  const scale=Math.min(300/surface.width,400/surface.height)
  ctx.drawImage(surface,95,650-surface.height*scale,surface.width*scale,surface.height*scale)
  const pet=await loadImage(canvas,asset('idle'))
  ctx.drawImage(pet,353,492,pet.width/pet.height*158,158)
  ctx.fillStyle='#fff8ea';ctx.fillRect(0,654,600,186)
  ctx.fillStyle='#55422d';ctx.font='bold 35px sans-serif';ctx.fillText(find.city+' · 我也去了',30,715,545)
  ctx.font='22px sans-serif';ctx.fillText('我的袋鼠'+name+'替我探了路，下一站，我亲自来！',30,775,540)
  // #ifdef H5
  return canvas.toDataURL('image/png')
  // #endif
  // #ifdef MP-WEIXIN
  return new Promise((resolve,reject)=>wx.canvasToTempFilePath({canvas,fileType:'png',success:r=>resolve(r.tempFilePath),fail:()=>reject(new Error('生成海报失败，请重试'))}))
  // #endif
}
export async function savePoster(path) {
  // #ifdef H5
  const link=document.createElement('a');link.download='我也去了.png';link.href=path;link.click()
  // #endif
  // #ifdef MP-WEIXIN
  await new Promise((resolve,reject)=>uni.saveImageToPhotosAlbum({filePath:path,success:resolve,fail:()=>reject(new Error('请允许保存到相册后重试'))}))
  // #endif
}
