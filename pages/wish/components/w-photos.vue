<template><view class="wp"><view v-for="(src,i) in modelValue" :key="src" class="wp-cell"><image :src="absUrl(src)" mode="aspectFill" @click="preview(i)"/><button class="wp-remove" aria-label="删除照片" @click="remove(i)"><k-icon name="x" :size="12" color="white"/></button></view><button v-if="modelValue.length < 6" class="wp-add" :disabled="busy" @click="add"><k-icon name="plus" :size="20" color="muted"/><text>{{ busy ? '上传中…' : '添加照片' }}</text></button></view></template>
<script setup>
import { ref } from 'vue'
import { absUrl, uploadTo } from '@/common/upload.js'
import { chooseWishPhotos, uploadedPhoto, PHOTO_MAX_BYTES } from '../photo-upload.js'
import { toast } from '@/common/screen.js'
const props=defineProps({ modelValue:{type:Array,default:()=>[]} }),emit=defineEmits(['update:modelValue','busy'])
const busy=ref(false)
function remove(i){if(!busy.value)emit('update:modelValue',props.modelValue.filter((_,n)=>n!==i))}
function preview(i){uni.previewImage({urls:props.modelValue.map(absUrl),current:i})}
async function add(){
  if(busy.value)return
  busy.value=true;emit('busy',true)
  try{
    const files=await chooseWishPhotos(6-props.modelValue.length)
    let next=[...props.modelValue]
    for(const file of files){
      if(file.size>PHOTO_MAX_BYTES)throw new Error('单张照片不能超过20MB，请压缩后重试；已上传的照片会保留')
      const r=await uploadTo('/app/upload/image',file.path)
      next.push(uploadedPhoto(r));emit('update:modelValue',[...next])
    }
  }catch(e){uni.showModal({title:'照片未上传',content:e.message||'上传失败，请重试',showCancel:false})}
  finally{busy.value=false;emit('busy',false)}
}
</script>
<style scoped>
/* 2026-11-17 改版「小而精」：照片格 8 圆角，「添加照片」是浅灰底虚线框，删除钮是半透明黑的小圆。 */
.wp{display:flex;gap:8px;flex-wrap:wrap;margin:10px 0}.wp-cell,.wp-add{width:calc((100% - 16px)/3);height:92px;position:relative;border-radius:8px;overflow:hidden}.wp-cell image{width:100%;height:100%}.wp-remove{position:absolute;right:0;top:0;display:flex;align-items:center;justify-content:center;background:rgba(20,14,10,.55);background-clip:padding-box;width:30px;height:30px;box-sizing:border-box;padding:0;border:4px solid transparent;border-radius:50%;margin:0}.wp-add{margin:0;background:var(--k-page);color:var(--k-muted);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;font-size:11px;padding:0;border:1px dashed var(--k-line2)}.wp-add:after,.wp-remove:after{border:0}
/* 11-18 第三轮返修（评审第 2 轮）：照片格和「添加照片」改成 96×96 正方形（原来 106×92）；320 宽 80×80，一行仍放三格 */
.wp-cell,.wp-add{width:96px;height:96px}
@media(max-width:359px){.wp-cell,.wp-add{width:80px;height:80px}}
</style>
