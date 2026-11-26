<template>
  <view class="evidence-box">
    <view v-for="(file,i) in modelValue" :key="file.fileId" class="file-row"><text>{{ file.name }}</text><button :disabled="busy" @click="remove(i)">移除</button></view>
    <view class="file-actions"><button :disabled="busy||modelValue.length>=9" @click="chooseMedia"><k-icon name="image" :size="16" color="red"/><text>{{ busy ? '正在上传…' : '图片 / 视频' }}</text></button><button :disabled="busy||modelValue.length>=9" @click="chooseFile"><k-icon name="paperclip" :size="16" color="red"/><text>录音 / 文件</text></button></view>
    <text class="hint">最多9项，每项不超过20MB。{{ redacted ? '请上传已遮盖姓名、电话、店名等身份信息' : '原始证据仅供你与有权限的处理' }}<text class="hint-nw">{{ redacted ? '的副本。' : '人员查看。' }}</text></text>
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
<style scoped>/* 2026-11-17 改版「小而精」：上传 / 移除按钮是白底细棕边的小胶囊，文件行用细线分开，说明 11 号字 */
.file-row{position:relative;display:flex;align-items:center;gap:10px;padding:8px 0;font-size:13px}.file-row::after{content:'';position:absolute;left:0;right:0;bottom:0;height:1px;background:var(--k-line);transform:scaleY(.5)}.file-row text{flex:1;word-break:break-all}.file-actions{display:flex;gap:8px;margin:8px 0}button{font-size:13px;line-height:20px;padding:8px 14px;margin:0;color:var(--k-red-deep);background:var(--k-paper);border-radius:18px;box-shadow:inset 0 0 0 1px var(--k-red-line)}button::after{border:0}.file-row button{margin:-4px;padding:4px 12px;border:4px solid transparent;border-radius:18px;background-clip:padding-box;font-size:13px;font-weight:500}.hint,.error{display:block;font-size:11px;line-height:1.65;color:var(--k-muted)}.error{color:var(--k-alert)}/* 11-18 第三轮返修（评审第 3 轮）：上传按钮带图标 —— 36 高浅棕实底、不描边，16 号图片 / 回形针图标 + 13/500 深棕字，间距 6；和表单里的选项胶囊（浅灰 / 浅棕描边）分开 */
.file-actions button{display:flex;align-items:center;gap:6px;height:36px;padding:0 14px;border-radius:18px;background:var(--k-red-soft);box-shadow:none;font-size:13px;font-weight:500;line-height:36px}
.file-actions button[disabled]{opacity:.5}
/* 2026-11-19 第四轮返修：说明最后几个字不断行（字不变），不再剩「查看。」两字一行 */
.hint-nw { white-space: nowrap; }
</style>
