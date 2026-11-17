<template>
  <view class="after-refund">
    <view class="ar-card">
      <text class="ar-title">{{ info.awaitingCheckout ? "申请提前退房" : "退房后申请退款" }}</text>
      <text class="ar-copy">填写申请金额和原因，由平台审核。审核通过后原路退款，实际到账以支付渠道为准。</text>
      <text v-if="info.awaitingCheckout" class="ar-copy">提交后请联系门店办理实际退房，平台核实后审核退款。</text><text class="ar-number">订单号 {{ orderNo }}</text>
      <k-button size="sm" type="outline" :disabled="loading || submitting" label="刷新进度" @click="load" />
    </view>
    <view v-if="loading" class="ar-card ar-copy">正在加载退款信息…</view>
    <view v-else-if="error" class="ar-card"><text class="ar-error">{{ error }}</text><k-button type="outline" label="重新加载" @click="load" /></view>
    <template v-else>
      <view class="ar-card">
        <view class="ar-row"><text>订单实付</text><text>¥{{ yuan(info.paidFen) }}</text></view>
        <view class="ar-row"><text>已退款</text><text>¥{{ yuan(info.refundedFen) }}</text></view>
        <template v-if="info.allowed">
          <view class="ar-row"><text>本次最多可申请</text><text class="ar-money">¥{{ yuan(info.maxRefundFen) }}</text></view>
          <text class="ar-copy">截至 {{ info.checkoutDate }}，未住 {{ info.unusedNights }} 晚。{{ info.estimateAvailable ? "已按订单逐晚价格分摊实付款并扣除已退款预填金额，可修改后提交审核。" : "该历史订单缺少完整逐晚价格，请填写金额供平台核实。" }}</text><text class="ar-label">申请金额（元）</text>
          <input v-model="money" type="digit" maxlength="12" placeholder="请输入申请金额" class="ar-input" :disabled="submitting" />
          <text class="ar-label">退款原因</text>
          <textarea v-model="reason" maxlength="100" placeholder="请说明提前退房或其他退款原因（最多100字）" class="ar-textarea" :disabled="submitting" />
          <k-button block :disabled="submitting" :label="submitting ? '正在提交…' : '提交退款申请'" @click="submit" />
        </template>
        <text v-else class="ar-copy">{{ info.reason }}</text>
      </view>
      <view v-for="item in info.records || []" :key="item.requestId" class="ar-card">
        <view class="ar-row"><text class="ar-title">¥{{ yuan(item.amountFen) }}</text><text>{{ item.statusLabel }}</text></view>
        <text class="ar-copy">申请原因：{{ item.reason }}</text>
        <text v-if="item.reviewNote" class="ar-copy">平台说明：{{ item.reviewNote }}</text>
        <text v-if="item.state === 'closed'" class="ar-error">本次退款未完成，资金未退回。可联系平台或重新申请。</text>
        <text class="ar-number">{{ time(item.createTime) }}</text>
      </view>
    </template>
  </view>
</template>
<script setup>
import { ref, watch } from 'vue'
import { get, post } from '@/common/request.js'
import { confirm, yuan } from '@/common/ui.js'
import { toast } from '@/common/screen.js'
import { parseRefundAmount } from '../stay-after-refund.js'
const props=defineProps({orderNo:{type:String,required:true},staff:{type:Boolean,default:false}})
const emit=defineEmits(['changed'])
const info=ref({}),loading=ref(true),error=ref(''),submitting=ref(false),money=ref(''),reason=ref('')
let sequence=0,key='',fingerprint=''
const endpoint=()=> (props.staff ? '/app/staff/stay/pms/orders/' : '/app/stay/orders/')+encodeURIComponent(props.orderNo)+'/after-refund'
const time=value=>String(value||'').replace('T',' ').slice(0,16)
async function load(){
  const run=++sequence;loading.value=true;error.value=''
  try {const r=await get(endpoint());if(run===sequence){info.value=r.data||{};if(!money.value && info.value.allowed && info.value.suggestedFen>0)money.value=yuan(info.value.suggestedFen)}}
  catch(e){if(run===sequence)error.value=e.message||'退款信息加载失败，请重试'}
  finally{if(run===sequence)loading.value=false}
}
watch(()=>props.orderNo,()=>{money.value='';reason.value='';key='';fingerprint='';load()},{immediate:true})
async function submit(){
  if(submitting.value||!info.value.allowed)return
  const amount=parseRefundAmount(money.value,info.value.maxRefundFen)
  if(amount.error)return toast(amount.error)
  const why=reason.value.trim();if(!why)return toast('请填写退款原因')
  submitting.value=true
  try{
    if(!await confirm('提交退款申请',`申请退款 ¥${yuan(amount.fen)}，由平台审核，审核通过后原路退回。确认提交？`))return
    const next=JSON.stringify([props.orderNo,amount.fen,why])
    if(next!==fingerprint){fingerprint=next;key='after_'+Date.now()+'_'+Math.random().toString(36).slice(2,12)}
    await post(endpoint(),{amountFen:amount.fen,reason:why,requestKey:key})
    toast('申请已提交，等待平台审核');money.value='';reason.value='';key='';fingerprint=''
    await load();emit('changed')
  }catch(e){toast(e.message||'提交失败，请重试');await load()}
  finally{submitting.value=false}
}
</script>
<style scoped>
.after-refund{padding:10px 14px calc(96px + var(--k-safe-bottom))}.ar-card{padding:18px;margin-bottom:12px;border:1px solid var(--k-line);border-radius:14px;background:rgba(253,251,247,.95)}.ar-title{font-size:17px;font-weight:700}.ar-copy,.ar-number,.ar-error{display:block;margin-top:10px;line-height:1.8;font-size:13px;color:var(--k-muted)}.ar-number{font-size:11px}.ar-error{color:var(--k-red)}.ar-row{display:flex;justify-content:space-between;gap:12px;margin-bottom:12px;font-size:14px}.ar-money{color:var(--k-red);font-weight:700}.ar-label{display:block;margin:18px 0 10px;font-weight:600}.ar-input,.ar-textarea{box-sizing:border-box;width:100%;padding:12px;border:1px solid var(--k-line2);border-radius:10px;background:white;font-size:14px}.ar-input{height:48px}.ar-textarea{height:110px;margin-bottom:18px}
</style>
