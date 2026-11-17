<template>
<k-feature-gate feature="wish"><view class="wish-page"><k-topbar :title="step===1?'发布心愿':'确认发布'" back :custom-back="step===2" :fab="false" @back="step=1"/>
  <view class="w-body" v-if="step===1"><view class="w-between"><text class="w-eyebrow">LET YOUR WISH TRAVEL</text><button class="w-link" @click="saveDraft">保存草稿</button></view><text class="w-title">把期待，寄给远方。</text><view class="w-tabs w-section"><view class="w-tabs__item" :class="{on:form.mode==='paid'}" @click="changeMode('paid')">有偿互助</view><view class="w-tabs__item" :class="{on:form.mode==='free'}" @click="changeMode('free')">免费互助</view></view>
    <view v-if="form.mode==='free'" class="wp-free"><k-icon name="heart-handshake" :size="28" color="#40572d"/><view><text>小小善意，也能跨越山海</text><text>免费发布，完成后也不收任何费用。</text></view></view>
    <view class="w-card"><input v-model="form.title" class="w-input wp-title" placeholder="说说你的小心愿" maxlength="80"/><textarea v-model="form.description" class="w-input w-area wp-description" placeholder="希望对方帮你做什么？写清规格、数量和交付要求。请勿填写手机号或详细住址。" maxlength="2000"/><view class="wp-counter">{{form.description.length}} / 2000</view><w-photos v-model="form.images" @busy="uploading=$event"/><text class="w-caption">照片选填，第一张为封面，最多6张，单张不超过20MB。运费等支出请提前写清并计入成本。</text></view>
    <view class="w-card"><picker :range="categories" range-key="label" :value="categoryIndex" @change="form.category=categories[$event.detail.value].key"><view class="w-field"><k-icon name="grid-2x2" :size="18" color="#102c46"/><text class="w-grow">心愿分类</text><text>{{categoryText(form.category)}}</text><k-icon name="chevron-right" :size="17" color="#8b9bb0"/></view></picker><view class="w-field"><k-icon name="map-pin" :size="18" color="#102c46"/><text class="w-field__label">我在</text><input v-model="form.originCity" placeholder="如辽宁大连" maxlength="80"/></view><view class="w-field"><k-icon name="navigation" :size="18" color="#102c46"/><text class="w-field__label">帮忙地</text><input v-model="form.targetCity" placeholder="如广西阳朔" maxlength="80"/></view><view @click="openCalendar"><view class="w-field"><k-icon name="calendar-days" :size="18" color="#102c46"/><text class="w-grow">期望完成日期</text><text :class="{'w-muted':!form.deadline}">{{form.deadline||'请选择'}}</text><k-icon name="chevron-right" :size="17" color="#8b9bb0"/></view></view><text class="w-caption">可选今天至未来90天内的日期，灰色日期不可选。</text><picker :range="deliveries" range-key="label" @change="form.delivery=deliveries[$event.detail.value].key"><view class="w-field"><k-icon name="package" :size="18" color="#102c46"/><text class="w-grow">交付方式</text><text>{{deliveryText(form.delivery)}}</text><k-icon name="chevron-right" :size="17" color="#8b9bb0"/></view></picker></view>
    <view v-if="form.mode==='paid'" class="wp-cost"><view class="w-between"><text class="w-heading">成本价</text><view class="wp-cost__input"><text>¥</text><input v-model="form.cost" type="digit" placeholder="0.00" maxlength="9" @blur="refreshQuote"/></view></view><text class="w-caption">公开展示价 = 成本价 + 1%，下单后金额不可修改。</text></view><w-fees v-if="quote||form.mode==='free'" :value="quote||{}" :free="form.mode==='free'"/>
    <view class="w-check"><view class="w-check__box" :class="{on:form.agreed}" @click="toggleRules"><k-icon v-if="form.agreed" name="check" :size="15" color="white"/></view><text @click="toggleRules">我已阅读并同意</text><text class="w-blue" @click="openRules">《心愿互助与品类规则》</text></view><text class="w-caption">发布内容经审核后展示。有偿心愿先支付，审核未通过原路退回全部金额。</text>
  </view>
  <view v-else class="w-body"><view class="wp-confirm-head"><view class="wp-confirm-icon"><k-icon name="send" :size="33" color="#102c46"/></view><text class="w-title">再确认一下<br/>你的远方心愿</text><text class="w-caption">每一个清楚的约定，都是互助的好开始。</text></view><view class="w-card"><text class="w-tag" :class="{'w-tag--lime':form.mode==='free'}">{{form.mode==='free'?'免费互助':'有偿互助'}}</text><text class="w-heading w-section">{{form.title}}</text><text class="w-caption">{{categoryText(form.category)}} · {{deliveryText(form.delivery)}}</text><view class="w-route w-section"><text>{{form.targetCity}}</text><k-icon name="arrow-right" :size="20" color="#7287a1"/><text>{{form.originCity}}</text></view><text class="w-caption">期望完成：{{form.deadline}}</text><text class="w-copy wp-confirm-copy">{{form.description}}</text></view><w-fees :value="quote||{}" :free="form.mode==='free'"/><view class="w-tip w-section"><k-icon name="info" :size="18" color="#3166f5"/><text>{{form.mode==='free'?'发布与完成均不产生费用。请与服务者保持沟通，珍惜每一份善意。':'完成后从展示价扣除 5% 手续费。服务者结算需经平台核实收款资料并打款，可在订单内跟踪。'}}</text></view><button class="w-link w-section" @click="step=1">返回修改内容</button></view>
  <view class="w-bottom"><button v-if="step===1" class="w-secondary" :disabled="busy||uploading" @click="saveDraft">保存草稿</button><view v-if="step===2" class="wp-total"><text>{{form.mode==='free'?'免费发布':'应付合计'}}</text><text>¥{{money(quote?.amountFen)}}</text></view><button class="w-primary" :disabled="busy||uploading" @click="step===1?next():submit()">{{busy?'处理中…':step===1?'下一步':form.mode==='free'?'确认发布':'支付并发布'}}<k-icon name="arrow-right" :size="22" color="#e7f58a"/></button></view>
<k-date-picker v-if="calendarOpen" title="期望完成日期" :value="form.deadline" :min-date="dateMin" :max-date="dateMax" @cancel="calendarOpen=false" @confirm="form.deadline=$event;calendarOpen=false"/></view></k-feature-gate>
</template>
<script setup>
import { computed,reactive,ref,watch } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { wishQuote,wishPublish } from '@/common/wish-api.js'
import { payFlow } from '@/common/pay-flow.js'
import { ensureSession,experience } from '@/common/experience.js'
import { go,replace,toast } from '@/common/screen.js'
import { todayCn,shiftDate,confirm } from '@/common/ui.js'
import { categories,deliveries,categoryText,deliveryText,requestKey,route,money } from './wish.js'
import { listDrafts, saveLocalDraft, removeLocalDraft, migrateLocalDrafts } from '@/common/local-drafts.js'
import WFees from './components/w-fees.vue'
import WPhotos from './components/w-photos.vue'
const calendarOpen=ref(false),dateMin=ref(todayCn()),dateMax=ref(shiftDate(todayCn(),90))
function openCalendar(){dateMin.value=todayCn();dateMax.value=shiftDate(dateMin.value,90);calendarOpen.value=true}
const rulesRead=ref(false)
function openRules(){uni.navigateTo({url:route('rules'),events:{read:done=>{rulesRead.value=done===true}}})}
function toggleRules(){if(!rulesRead.value){openRules();return}form.agreed=!form.agreed}
const form=reactive({title:'',description:'',mode:'paid',category:'craft',originCity:'',targetCity:'',delivery:'express',deadline:'',cost:'',images:[],agreed:false,requestKey:requestKey()})
const step=ref(1),quote=ref(null),busy=ref(false),uploading=ref(false),categoryIndex=computed(()=>categories.findIndex(x=>x.key===form.category))
let activeDraftId='',quoteVersion=0
onLoad(async q=>{
  await ensureSession()
  if(experience.account?.id){
    migrateLocalDrafts(experience.account.id)
    const row=listDrafts(experience.account.id,'wish').find(x=>x.id===String(q?.draftId||''))
    if(row){activeDraftId=row.id;Object.assign(form,row.data);form.agreed=false}
  }
  if(q.mode==='free')form.mode='free'
  if(form.cost||form.mode==='free')refreshQuote()
})
watch(()=>form.cost,()=>{quoteVersion++;quote.value=null})
function changeMode(mode){form.mode=mode;quote.value=null;quoteVersion++;if(mode==='free'||form.cost)refreshQuote()}
async function refreshQuote(){const version=++quoteVersion;if(form.mode==='paid'&&!/^\d+(\.\d{1,2})?$/.test(form.cost)){quote.value=null;return}try{const r=await wishQuote({mode:form.mode,cost:form.cost});if(version===quoteVersion)quote.value=r.data}catch(e){if(version===quoteVersion)toast(e.message||'金额计算失败')}}
function saveDraft() {
  if (!form.title.trim() && !form.description.trim() && !form.images.length) return toast('先写下心愿或添加图片吧')
  try {
    const row=saveLocalDraft(experience.account?.id,{id:activeDraftId,kind:'wish',label:'心愿互助',data:{...form,agreed:false}})
    activeDraftId=row.id
    toast('已保存，可在我的草稿箱继续编辑')
  }catch(e){toast(e.message||'草稿保存失败，请重试')}
}
async function next() {
  if (busy.value) return
  const checks = [
    [form.title.trim().length >= 3, '请填写至少3个字的心愿标题'],
    [form.description.trim().length >= 10, '请填写至少10个字的心愿描述'],
    [form.originCity.trim().length >= 2 && form.targetCity.trim().length >= 2, '请填写出发城市和帮忙地'],
    [!!form.deadline && form.deadline >= todayCn() && form.deadline <= shiftDate(todayCn(),90), '请选择今天至未来90天内的完成日期'],
    [rulesRead.value && form.agreed, '请先阅读并同意心愿规则']
  ]
  for (const [ok, message] of checks) {
    if (!ok) { toast(message); return }
  }
  const requested = { mode: form.mode, cost: form.cost }
  busy.value = true
  try {
    const result = (await wishQuote(requested)).data
    if (requested.mode !== form.mode || requested.cost !== form.cost) {
      toast('金额或互助方式已修改，请重新确认')
      return
    }
    quote.value = result
    step.value = 2
    uni.pageScrollTo({ scrollTop: 0, duration: 200 })
  } catch (error) {
    toast(error.message || '费用计算失败')
  } finally {
    busy.value = false
  }
}
async function submit(){if(busy.value)return;if(!rulesRead.value||!form.agreed){toast('请先阅读并同意心愿规则');return;}busy.value=true;let created;try{created=(await wishPublish({...form})).data;if(activeDraftId)removeLocalDraft(experience.account.id,activeDraftId);if(created.payNo&&created.status==='pending_payment'){const r=await payFlow(created.payNo);if(r.status==='unknown')toast('支付结果确认中，请在订单内刷新')}replace(route('order',created.wishId))}catch(e){toast(e.message||'发布失败，请重试');if(created)replace(route('order',created.wishId))}finally{busy.value=false}}
</script>
<style lang="scss">@import './wish.scss';.wp-title{font-size:18px;font-weight:750}.wp-description{margin-top:12px;background:white;min-height:110px}.wp-counter{text-align:right;font-size:10px;color:#97a5b6;margin-top:7px}.wp-cost{background:#eaf0ff;border-radius:18px;padding:18px;margin-bottom:12px}.wp-cost__input{display:flex;gap:7px;align-items:center;background:white;border:1px solid #d5deee;border-radius:10px;padding:7px 12px;width:140px;font-size:20px;font-weight:800}.wp-cost__input input{width:100%;font-size:23px;font-weight:750;height:35px}.wp-free{display:flex;gap:13px;align-items:center;background:#eef4d1;border-radius:18px;padding:18px;margin-bottom:20px}.wp-free text{display:block;font-size:14px;font-weight:700;color:#344b2b}.wp-free text+text{font-weight:400;font-size:11px;margin-top:5px;color:#758362}.wp-confirm-head{text-align:center;padding:8px 0 28px}.wp-confirm-icon{width:67px;height:67px;border-radius:22px;background:#e7f58a;transform:rotate(-8deg);display:flex;align-items:center;justify-content:center;margin:0 auto 20px}.wp-confirm-copy{display:block;margin-top:20px;color:#64758b;font-size:12px}.wp-total{display:flex;flex-direction:column;font-size:10px;color:#718095;min-width:97px}.wp-total text+text{font-size:24px;font-weight:800;color:#102c46}
</style>
