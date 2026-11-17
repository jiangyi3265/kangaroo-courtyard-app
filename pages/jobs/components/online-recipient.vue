<template>
  <k-card :pad="16" class="k-mt12">
    <text class="section-title">我的收款信息</text>
    <text class="recipient-note">验收通过后，提交真实姓名和收款二维码或支付宝账号，供本任务付款方核对。</text>
    <template v-if="value.canEdit">
      <text class="recipient-label">收款人真实姓名</text>
      <input class="recipient-input" v-model="name" :disabled="saving" maxlength="50" placeholder="与收款账号一致的真实姓名" aria-label="收款人真实姓名"/>
      <view class="recipient-methods"><button :class="{active:method==='qr'}" :disabled="saving" @click="method='qr'">收款二维码</button><button :class="{active:method==='alipay'}" :disabled="saving" @click="method='alipay'">支付宝账号</button></view>
      <template v-if="method==='qr'"><image v-if="qr" :src="qr" class="recipient-qr" mode="aspectFit" @click="preview"/><button class="recipient-pick" :disabled="saving" @click="pick">{{qr?'更换收款二维码':'选择收款二维码'}}</button></template>
      <input v-else class="recipient-input" v-model="account" :disabled="saving" maxlength="128" placeholder="支付宝绑定的手机号或邮箱" aria-label="支付宝账号"/>
      <k-button block :disabled="saving" @click="save">{{saving?'正在保存…':value.submitted?'保存收款信息':'提交收款信息'}}</k-button>
      <text v-if="value.submitted" class="recipient-note">已提交。登记付款前可以修改。</text>
    </template>
    <template v-else><text class="recipient-note">{{value.realName}} · {{value.method==='alipay'?'支付宝':'收款二维码'}}</text><text v-if="value.account">{{value.account}}</text><image v-if="value.qrUrl" :src="absUrl(value.qrUrl)" class="recipient-qr" mode="aspectFit" @click="preview"/><text class="recipient-note">已登记付款，收款信息不可修改；未到账可在结算单发起申诉。</text></template>
  </k-card>
</template>
<script setup>
import {ref,computed,watch} from 'vue'
import {post} from '@/common/request.js'
import {chooseImage,uploadTo,absUrl} from '@/common/upload.js'
import {toast} from '@/common/screen.js'
const props=defineProps({appId:Number,value:{type:Object,required:true}}),emit=defineEmits(['saved'])
const name=ref(''),method=ref('qr'),account=ref(''),localQr=ref(''),saving=ref(false)
// Returning from the photo picker refreshes the page; an unchanged saved record must not erase this draft.
watch(()=>JSON.stringify([props.value.realName,props.value.method,props.value.account,props.value.submitted]),()=>{const value=props.value;name.value=value.realName||'';method.value=value.method||'qr';account.value=value.account||'';localQr.value=''}, {immediate:true})
const qr=computed(()=>localQr.value||absUrl(props.value.qrUrl||''))
async function pick(){if(saving.value)return;const file=await chooseImage();if(file)localQr.value=file}
function preview(){if(qr.value)uni.previewImage({urls:[qr.value]})}
async function save(){
  if(saving.value)return
  if(name.value.trim().length<2)return toast('请填写收款人真实姓名')
  if(method.value==='qr'&&!qr.value)return toast('请选择收款二维码')
  if(method.value==='alipay'&&!account.value.trim())return toast('请填写支付宝账号')
  saving.value=true
  try{
    const base='/app/online/assignments/'+props.appId
    const result=method.value==='qr'&&localQr.value?await uploadTo(base+'/recipient-qr',localQr.value,{realName:name.value.trim()}):await post(base+'/recipient',{realName:name.value.trim(),method:method.value,account:account.value.trim()})
    localQr.value='';emit('saved',result.data);toast('收款信息已提交')
  }catch(error){toast(error.message||'保存失败，请重试')}finally{saving.value=false}
}
</script>
<style scoped>
.recipient-note{display:block;font-size:13px;line-height:1.7;color:var(--k-muted);margin:8px 0 12px}.recipient-label{display:block;font-size:14px;margin-top:12px}.recipient-input{box-sizing:border-box;border:1px solid var(--k-line);border-radius:8px;height:46px;padding:0 12px;font-size:15px;margin:8px 0 14px}.recipient-methods{display:flex;gap:8px;margin:12px 0}.recipient-methods button,.recipient-pick{font-size:14px;min-height:44px;line-height:44px;padding:0 12px;margin:0;background:var(--k-bg);color:var(--k-ink)}.recipient-methods .active{color:var(--k-red);box-shadow:inset 0 0 0 1px var(--k-red)}.recipient-qr{display:block;width:180px;height:180px;margin:12px 0}.recipient-pick{margin-bottom:14px}button::after{border:0}
</style>
