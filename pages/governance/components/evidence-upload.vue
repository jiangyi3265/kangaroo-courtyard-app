<template>
  <view class="evidence-box">
    <view v-for="(file,i) in modelValue" :key="file.fileId" class="file-row"><text>{{ file.name }}</text><button :disabled="busy" @click="remove(i)">移除</button></view>
    <view class="file-actions"><button :disabled="busy||modelValue.length>=9" @click="chooseMedia">{{ busy ? '正在上传…' : '图片 / 视频' }}</button><button :disabled="busy||modelValue.length>=9" @click="chooseFile">录音 / 文件</button></view>
    <text class="hint">最多9项，每项不超过20MB。{{ redacted ? '请上传已遮盖姓名、电话、店名等身份信息的副本。' : '原始证据仅供你与有权限的处理人员查看。' }}</text>
    <text v-if="error" class="error">{{ error }}</text>
  </view>
</template>
<script setup>
import { ref, onBeforeUnmount } from 'vue'
import { uploadEvidence } from '@/common/governance.js'
const props=defineProps({modelValue:{type:Array,default:()=>[]},redacted:Boolean})
const emit=defineEmits(['update:modelValue','busy'])
const busy=ref(false),error=ref('')
let active=true
onBeforeUnmount(()=>{active=false})
function remove(i){emit('update:modelValue',props.modelValue.filter((_,n)=>n!==i))}
async function save(files){if(!active||busy.value)return;busy.value=true;emit('busy',true);error.value='';const uploaded=[...props.modelValue];try{for(const f of files.slice(0,9-uploaded.length)){if(f.size>20*1024*1024)throw new Error('单个文件不能超过20MB');const result=await uploadEvidence(f.tempFilePath||f.path,props.redacted);if(!active)return;uploaded.push(result);emit('update:modelValue',[...uploaded])}}catch(e){if(active)error.value=e.message||'上传失败，请重试'}finally{if(active){busy.value=false;emit('busy',false)}}}
function chooseMedia(){
  // #ifdef MP-WEIXIN
  uni.chooseMedia({count:9-props.modelValue.length,mediaType:['image','video'],success:r=>save(r.tempFiles),fail:e=>{if(!String(e.errMsg).includes('cancel'))error.value='无法选择图片，请检查授权'}})
  // #endif
  // #ifdef H5
  uni.chooseFile({count:9-props.modelValue.length,type:'all',extension:['.jpg','.jpeg','.png','.webp','.mp4','.mov'],success:r=>save(r.tempFiles)})
  // #endif
}
function chooseFile(){
  // #ifdef MP-WEIXIN
  uni.chooseMessageFile({count:9-props.modelValue.length,type:'file',extension:['mp3','m4a','wav','pdf','docx','txt'],success:r=>save(r.tempFiles)})
  // #endif
  // #ifdef H5
  uni.chooseFile({count:9-props.modelValue.length,type:'all',extension:['.mp3','.m4a','.wav','.pdf','.docx','.txt'],success:r=>save(r.tempFiles)})
  // #endif
}
</script>
<style scoped>.file-row{display:flex;align-items:center;gap:12px;padding:10px 0;border-bottom:1px solid #e8e1d6;font-size:13px}.file-row text{flex:1;word-break:break-all}.file-actions{display:flex;gap:10px;margin:12px 0}button{font-size:13px;line-height:1.4;padding:10px 14px;margin:0;color:#89613c;background:#f2e7d7;border-radius:10px}button::after{border:0}.hint,.error{display:block;font-size:12px;line-height:1.7;color:#8c8277}.error{color:#ae4939}</style>
