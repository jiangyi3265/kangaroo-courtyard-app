<template>
 <view class="k-page"><k-topbar title="消息提醒" back/><view class="k-body landing">
  <text v-if="loading">正在核对消息权限…</text>
  <view v-else-if="message"><text class="title">{{message.title}}</text><text class="body">{{message.content}}</text><k-button v-if="message.route" block @click="open">查看并处理</k-button></view>
  <view v-else><text class="body">{{error||'请登录后查看收到的提醒'}}</text><k-button v-if="!experience.account" @click="login">去登录</k-button><template v-else-if="mode==='staff'"><text class="body">可选择你已有的工作身份重新核对：</text><k-button v-for="grant in staffIdentities" :key="staffGrantKey(grant)" type="secondary" block @click="choose(grant)">{{staffIdentityLabel(grant)}}</k-button></template></view>
  <k-subscribe label="订阅后续微信提醒"/>
 </view></view>
</template>
<script setup>
import {ref,onUnmounted} from 'vue'
import {onLoad,onShow} from '@dcloudio/uni-app'
import {apiSubscriptionMessage,apiMarkRead} from '@/common/api.js'
import {experience,ensureSession,refreshAccount,switchMode,setStaffStore,staffStores,staffIdentities,staffIdentityLabel,staffGrantKey,getSessionRevision} from '@/common/experience.js'
import {staffIdentityForMessageScope} from '@/common/staff-identities.js'
import {go} from '@/common/screen.js'
const loading=ref(false),message=ref(null),error=ref(''),mode=ref('user');let id='',sequence=0,initialScope=''
onLoad(q=>{id=String(q?.id||'');mode.value=q?.mode==='staff'?'staff':'user';initialScope=String(q?.scope||'')})
const load=async()=>{
 const n=++sequence;loading.value=true;message.value=null
 try{
  await ensureSession();const session=getSessionRevision()
  if(!experience.account||n!==sequence)return
  if(!/^\d+$/.test(id))throw new Error('消息链接不完整')
  if(initialScope&&mode.value==='staff'){
   // 通知可能来自刚交接的城市，先获取最新授权，避免旧快照把有效身份误判为失效。
   await refreshAccount()
   if(n!==sequence||session!==getSessionRevision())return
   const grant=staffIdentityForMessageScope(staffStores.value,initialScope);initialScope=''
   if(!grant)throw new Error('该提醒对应的工作身份已失效，请重新选择')
   setStaffStore(grant)
  }
  switchMode(mode.value)
  const r=await apiSubscriptionMessage(id,mode.value)
  if(n===sequence&&session===getSessionRevision())message.value=r.data
 }catch(e){if(n===sequence)error.value=e?.message||'当前身份无法查看这条消息'}
 finally{if(n===sequence)loading.value=false}
}
onUnmounted(()=>{sequence++})
onShow(load)
const choose=grant=>{setStaffStore(grant);load()}
const login=()=>uni.navigateTo({url:'/pages/auth/login'})
const open=async()=>{if(!message.value?.route)return;try{await apiMarkRead(id);go(message.value.route)}catch(e){uni.showToast({title:e?.message||'暂时无法打开',icon:'none'})}}
</script>
<style scoped>.landing{padding:22px 18px}.title{display:block;font-size:22px;font-weight:600}.body{display:block;white-space:pre-wrap;line-height:1.8;margin:20px 0}.landing :deep(.k-button){margin:10px 0}</style>
