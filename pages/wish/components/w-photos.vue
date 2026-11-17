<template><view class="wp"><view v-for="(src,i) in modelValue" :key="src" class="wp-cell"><image :src="absUrl(src)" mode="aspectFill" @click="preview(i)"/><button class="wp-remove" aria-label="删除照片" @click="remove(i)">×</button></view><button v-if="modelValue.length < 6" class="wp-add" :disabled="busy" @click="add"><k-icon name="plus" :size="25" color="#102c46"/><text>{{ busy ? '上传中…' : '添加照片' }}</text></button></view></template>
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
.wp{display:flex;gap:10px;flex-wrap:wrap;margin:18px 0}.wp-cell,.wp-add{width:calc((100% - 20px)/3);height:96px;position:relative;border-radius:13px;overflow:hidden}.wp-cell image{width:100%;height:100%}.wp-remove{position:absolute;right:4px;top:4px;background:#102c46cc;color:white;font-size:20px;line-height:22px;width:23px;height:23px;padding:0;border-radius:50%;margin:0}.wp-add{margin:0;background:#eef2f8;color:#64758b;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;font-size:11px;padding:0;border:1px dashed #cbd7e8}.wp-add:after,.wp-remove:after{border:0}
</style>
