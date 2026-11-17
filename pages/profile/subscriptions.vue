<template>
  <view class="k-page subscriptions">
    <k-topbar title="微信订阅提醒" back />
    <view class="k-body">
      <text class="intro">选择你需要的提醒，允许后可在微信收到后续进展。</text>
      <text class="hint">一次允许对应一条提醒，次数用完可回来补充授权。同一模板下列出的业务共用授权次数；未授权时仍可在小程序消息中心查看。</text>
      <view v-if="!account" class="empty"><text>登录后设置自己的提醒</text><k-button @click="goLogin">去登录</k-button></view>
      <view v-else-if="state.loading && !state.groups.length" class="empty">正在读取订阅设置…</view>
      <view v-else-if="!state.enabled || !state.groups.length" class="empty">微信提醒暂未开放，站内消息照常接收。</view>
      <text v-if="state.error" class="error">{{state.error}}</text><text v-if="state.notice" class="notice">{{state.notice}}</text>
      <k-button v-if="state.retry" :disabled="state.busy" @click="controller.retrySave">重试保存授权</k-button>
      <k-button v-else-if="state.error" :disabled="state.loading || state.busy" type="secondary" @click="controller.refresh">重新读取</k-button>
      <view v-for="group in shown" :key="group.templateId" class="subscription-card">
        <text class="card-title">{{group.labels.join('、')}}</text>
        <text class="hint">{{group.quota>0?'本地记录可发 '+group.quota+' 条，以微信实际授权为准':'暂无可用授权，允许后接收一条提醒'}}</text>
        <view class="actions"><k-button size="sm" :disabled="state.busy || state.loading || state.retry" @click="controller.ask([group.templateId])">{{group.quota>0?'再订阅一次':'订阅提醒'}}</k-button><k-button v-if="group.quota>0" size="sm" type="ghost" :disabled="state.busy || state.loading || state.retry" @click="stop(group)">关闭此模板提醒</k-button></view>
      </view>
      <k-button v-if="filter.length" type="secondary" block @click="filter=[]">查看全部提醒</k-button>
      <text class="hint tail">员工提醒只发送给业务已指定的人员。打开消息后仍会核对身份、门店和城市权限。</text>
    </view>
  </view>
</template>
<script setup>
import {ref,computed,onUnmounted} from 'vue'
import {onLoad,onShow} from '@dcloudio/uni-app'
import {apiSubscribePrepare,apiSubscribeAccept,apiSubscribeRevoke} from '@/common/api.js'
import {experience,ensureSession,getSessionRevision} from '@/common/experience.js'
import {createSubscriptionController} from '@/common/subscription-core.js'
const state=ref({loading:false,busy:false,enabled:false,groups:[],error:'',notice:'',retry:false}),filter=ref([])
const account=computed(()=>experience.account)
const shown=computed(()=>filter.value.length?state.value.groups.filter(g=>g.keys.some(k=>filter.value.includes(k))):state.value.groups)
const controller=createSubscriptionController({
 prepare:async()=> (await apiSubscribePrepare()).data||{},accept:async body=>(await apiSubscribeAccept(body)).data||{},
 identity:()=>String(experience.account?.id||'')+':'+getSessionRevision(),changed:s=>{state.value=s},
 request:options=>{
  // #ifdef MP-WEIXIN
  uni.requestSubscribeMessage(options)
  // #endif
  // #ifndef MP-WEIXIN
  options.fail({message:'请在微信小程序内订阅消息'})
  // #endif
 }
})
onLoad(q=>{filter.value=String(q?.scenes||'').split(',').filter(Boolean)})
onShow(async()=>{await ensureSession();if(experience.account&&!state.value.busy&&!state.value.retry)controller.refresh()})
onUnmounted(()=>controller.dispose())
const goLogin=()=>uni.navigateTo({url:'/pages/auth/login'})
const stop=group=>uni.showModal({title:'关闭此模板提醒',content:'将清空「'+group.labels.join('、')+'」共用的微信授权次数。站内消息不受影响。',success:async r=>{if(!r.confirm)return;try{await apiSubscribeRevoke(group.keys[0]);await controller.refresh()}catch(e){uni.showToast({title:e?.message||'关闭失败',icon:'none'})}}})
</script>
<style scoped>
.k-body{padding:20px 16px 40px}.intro,.hint,.card-title,.error,.notice{display:block}.intro{font-size:18px;font-weight:600;line-height:1.6}.hint{font-size:12px;line-height:1.7;color:var(--k-muted);margin-top:8px}.subscription-card{padding:18px;margin-top:16px;background:var(--k-surface);border:1px solid var(--k-line2);border-radius:18px}.card-title{font-size:15px;font-weight:600;line-height:1.6}.actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:14px}.error{color:var(--k-alert);margin:12px 0}.notice{color:var(--k-green);margin:12px 0;line-height:1.7}.empty{padding:32px 0;display:flex;flex-direction:column;gap:20px}.tail{margin-top:22px}
</style>
