<template>
  <view v-if="visible" class="rules-mask" @touchmove.stop>
    <view class="rules-panel">
      <view class="rules-head"><text>发布须知</text><button :disabled="busy" @click="close(false)">取消</button></view>
      <view class="rules-body">
        <k-agreement-reader v-if="docs.length === keys.length && docs.length" :content-key="fullText" :text="fullText" height="42vh" @read="markRead" />
        <text v-if="busy && !docs.length">正在加载全文…</text><text v-if="error" class="rule-error">{{ error }}</text>
        <button v-if="!docs.length && error" @click="load">重新加载须知</button>
      </view>
      <view class="rules-foot">
        <checkbox-group @change="agreed = readComplete && $event.detail.value.includes('agree')"><label class="rules-agree"><checkbox value="agree" :checked="agreed" :disabled="!readComplete || busy" color="#8A5A30"/><text>我已年满18周岁，已阅读并同意以上规则</text></label></checkbox-group>
        <button class="rules-confirm" :disabled="busy || !readComplete || !agreed || docs.length !== keys.length" @click="accept">{{ busy ? '正在确认…' : '同意并发布' }}</button>
      </view>
    </view>
  </view>
</template>
<script setup>
import { ref, computed, onUnmounted } from 'vue'
import { apiCommunityRules, apiCommunityConsent } from '@/common/api.js'
import { getToken } from '@/common/request.js'
const visible=ref(false), docs=ref([]), keys=ref([]), agreed=ref(false), busy=ref(false), error=ref('')
const readComplete=ref(false), fullText=computed(()=>docs.value.map(d=>d.title+'\n'+d.content).join('\n\n'))
function markRead(value){readComplete.value=value;if(!value)agreed.value=false}
let resolveOpen=null, session='', revision=0
async function load(){
  const version=++revision;error.value='';busy.value=true;markRead(false);docs.value=[]
  try{
    const result=await Promise.all(keys.value.map(async key=>({...(await apiCommunityRules(key)).data,key})))
    if(result.some(d=>!d.content?.trim()))throw new Error('须知正文暂不可用')
    if(version===revision)docs.value=result
  }catch(e){if(version===revision)error.value=e.message||'须知加载失败，请重试'}
  finally{if(version===revision)busy.value=false}
}
function open(required){
  close(false);keys.value=[...required];docs.value=[];agreed.value=false;readComplete.value=false;session=getToken();visible.value=true
  load()
  return new Promise(resolve=>{resolveOpen=resolve})
}
function close(result){revision++;visible.value=false;const done=resolveOpen;resolveOpen=null;if(done)done(result)}
async function accept(){
  if(busy.value||!readComplete.value||!agreed.value||docs.value.length!==keys.value.length)return
  const version=revision
  busy.value=true;error.value=''
  try{
    for(const key of keys.value){
      if(!session||getToken()!==session)throw new Error('登录状态已改变，请重新发布')
      const latest=(await apiCommunityRules(key)).data
      if(version!==revision||!visible.value)return
      if(getToken()!==session)throw new Error('登录状态已改变，请重新发布')
      if(latest?.content!==docs.value.find(d=>d.key===key)?.content){await load();throw new Error('须知已更新，请重新阅读')}
      await apiCommunityConsent(key)
    }
    if(getToken()!==session)throw new Error('登录状态已改变，请重新发布')
    close(true)
  }catch(e){error.value=e.message||'确认失败，请重试'}finally{busy.value=false}
}
onUnmounted(()=>close(false))
defineExpose({open})
</script>
<style scoped>
.rules-mask{position:fixed;inset:0;z-index:240;background:#3a322b77;display:flex;align-items:center;padding:24px 16px}.rules-panel{width:100%;height:76vh;display:flex;flex-direction:column;background:#fffaf2;border-radius:20px;overflow:hidden}.rules-head{padding:16px 20px;display:flex;align-items:center;justify-content:space-between;font-size:20px;font-weight:700}.rules-head button{margin:0;padding:0 8px;background:transparent;color:#675749;font-size:14px}.rules-body{flex:1;height:0;min-height:0}.rules-intro{display:block;padding:0 20px;font-size:14px;line-height:1.7;color:#534637}.rules-summary{margin:16px 20px;padding:14px;background:#f3e6d5;border-radius:12px;display:flex;flex-direction:column;gap:10px;color:#493728;font-size:14px;line-height:1.7}.rule{margin:0 20px;border-bottom:1px solid #e4d8c9}.rule button{display:flex;align-items:center;justify-content:space-between;margin:0;padding:12px 0;background:transparent;font-size:14px;line-height:1.6;text-align:left}.rule button text{flex-shrink:0;color:#89582c;font-size:12px;margin-left:10px}.rule-content{display:block;font-size:13px;color:#493728;line-height:1.8;white-space:pre-wrap;padding-bottom:14px}.rules-foot{padding:16px 20px}.rules-agree{display:flex;gap:8px;align-items:center;font-size:13px;line-height:1.6;color:#493728}.rules-confirm{margin-top:14px;background:#8a5a30;color:white;border-radius:12px;font-size:16px}.rules-confirm[disabled]{background:#d8cfc4;color:#635a51}.rule-error{display:block;margin:12px 20px;color:#aa3430;font-size:13px}.rules-panel button::after{border:0}
</style>
<style scoped>
.rules-panel{height:auto;max-height:82vh}
.rules-body{flex:0 1 auto;max-height:calc(82vh - 220px)}
.rules-confirm{min-height:44px;line-height:44px}
</style>

<style scoped>.rules-body{padding:0 16px;box-sizing:border-box;max-height:none;height:auto;flex:1 1 auto;overflow-y:auto}.rules-panel{max-height:94vh}.rules-mask{padding:12px}.rules-foot{padding:12px 16px;flex-shrink:0}</style>
