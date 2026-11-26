<template>
<k-feature-gate feature="wish"><view class="wish-page wp-page" :class="$userSurface"><k-topbar :title="step===1?'发布心愿':'确认发布'" back :custom-back="step===2" :fab="false" @back="step=1"/>
  <view class="w-body" v-if="step===1"><view class="w-between"><text class="w-eyebrow">LET YOUR WISH TRAVEL</text><button class="w-link" @click="go('/pages/profile/drafts')">草稿箱</button></view><text class="w-title">把期待，寄给远方。</text><view class="w-tabs w-section"><view class="w-tabs__item" :class="{on:form.mode==='paid'}" @click="changeMode('paid')">有偿互助</view><view class="w-tabs__item" :class="{on:form.mode==='free'}" @click="changeMode('free')">免费互助</view></view>
    <view v-if="form.mode==='free'" class="wp-free"><k-icon name="heart-handshake" :size="22" color="green"/><view><text>小小善意，也能跨越山海</text><text>免费发布，完成后也不收任何费用。</text></view></view>
    <view class="w-card"><input v-model="form.title" class="w-input wp-title" placeholder="说说你的小心愿" placeholder-class="wp-ph" maxlength="80"/><textarea v-model="form.description" class="w-input w-area wp-description" placeholder="希望对方帮你做什么？写清规格、数量和交付要求。请勿填写手机号或详细住址。" placeholder-class="wp-ph" maxlength="2000"/><view class="wp-counter">{{form.description.length}} / 2000</view><w-photos v-model="form.images" @busy="uploading=$event"/><text class="w-caption wp-photo-cap">照片选填，第一张为封面，最多6张，单张不超过20MB。运费等支出请提前写清并计入成本。</text></view>
    <view class="w-card"><picker :range="categories" range-key="label" :value="categoryIndex" @change="form.category=categories[$event.detail.value].key"><view class="w-field"><k-icon name="grid-2x2" :size="16" color="ink2"/><text class="w-grow">心愿分类</text><text>{{categoryText(form.category)}}</text><k-icon name="chevron-right" :size="12" color="muted"/></view></picker><view class="w-field"><k-icon name="map-pin" :size="16" color="ink2"/><text class="w-field__label">我在</text><input v-model="form.originCity" placeholder="如辽宁大连" maxlength="80"/></view><view class="w-field"><k-icon name="navigation" :size="16" color="ink2"/><text class="w-field__label">帮忙地</text><input v-model="form.targetCity" placeholder="如广西阳朔" maxlength="80"/></view><view @click="openCalendar"><view class="w-field"><k-icon name="calendar-days" :size="16" color="ink2"/><text class="w-grow">期望完成日期</text><text :class="{'w-muted':!form.deadline}">{{form.deadline||'请选择'}}</text><k-icon name="chevron-right" :size="12" color="muted"/></view></view><text class="w-caption wp-date-cap">可选今天至未来90天内的日期，灰色日期不可选。</text><picker :range="deliveries" range-key="label" @change="form.delivery=deliveries[$event.detail.value].key"><view class="w-field"><k-icon name="package" :size="16" color="ink2"/><text class="w-grow">交付方式</text><text>{{deliveryText(form.delivery)}}</text><k-icon name="chevron-right" :size="12" color="muted"/></view></picker></view>
    <view v-if="form.mode==='paid'" class="wp-cost"><view class="w-between"><text class="w-heading">成本价</text><view class="wp-cost__input"><text>¥</text><input v-model="form.cost" type="digit" placeholder="0.00" placeholder-class="wp-ph" maxlength="9" :style="{width:(String(form.cost||'0.00').length*10.6-(String(form.cost||'0.00').split('.').length-1)*5.6)+'px'}" @blur="refreshQuote"/></view></view><text class="w-caption">公开展示价 = 成本价 + 1%，下单后金额不可修改。</text></view><w-fees v-if="quote||form.mode==='free'" :value="quote||{}" :free="form.mode==='free'"/>
    <view class="w-check"><view class="w-check__box" :class="{on:form.agreed}" @click="toggleRules"><k-icon v-if="form.agreed" name="check" :size="14" color="white"/></view><text @click="toggleRules">我已阅读并同意</text><text class="w-blue" @click="openRules">《心愿互助与品类规则》</text></view><view class="w-caption wp-foot-cap"><text>发布内容经审核后展示。</text><text>有偿心愿先支付，审核未通过原路退回全部金额。</text></view>
  </view>
  <view v-else class="w-body"><view class="wp-confirm-head"><view class="wp-confirm-icon"><k-icon name="send" :size="22" color="red"/></view><text class="w-title">{{ '再确认一下\n你的远方心愿' }}</text><text class="w-caption">每一个清楚的约定，都是互助的好开始。</text></view><view class="w-card"><text class="w-tag" :class="{'w-tag--lime':form.mode==='free'}">{{form.mode==='free'?'免费互助':'有偿互助'}}</text><text class="w-heading w-section">{{form.title}}</text><text class="w-caption">{{categoryText(form.category)}} · {{deliveryText(form.delivery)}}</text><view class="w-route w-section"><text>{{form.targetCity}}</text><k-icon name="arrow-right" :size="16" color="light"/><text>{{form.originCity}}</text></view><text class="w-caption">期望完成：{{form.deadline}}</text><text class="w-copy wp-confirm-copy">{{form.description}}</text></view><w-fees :value="quote||{}" :free="form.mode==='free'"/><view class="w-tip w-section"><k-icon name="info" :size="16" color="red"/><text>{{form.mode==='free'?'发布与完成均不产生费用。请与服务者保持沟通，珍惜每一份善意。':'完成后从展示价扣除 5% 手续费。服务者结算需经平台核实收款资料并打款，可在订单内跟踪。'}}</text></view><button class="w-link w-section" :disabled="busy" @click="step=1">返回修改内容</button></view>
  <view class="w-bottom"><button v-if="step===1" class="w-secondary" :disabled="busy||uploading" @click="saveDraft">保存草稿</button><view v-if="step===2" class="wp-total"><text>{{form.mode==='free'?'免费发布':'应付合计'}}</text><text>¥{{money(quote?.amountFen)}}</text></view><button class="w-primary" :disabled="busy||uploading" @click="step===1?next():submit()">{{busy?'处理中…':step===1?'下一步':form.mode==='free'?'确认发布':'支付并发布'}}</button></view>
<k-date-picker v-if="calendarOpen" title="期望完成日期" :value="form.deadline" :min-date="dateMin" :max-date="dateMax" @cancel="calendarOpen=false" @confirm="form.deadline=$event;calendarOpen=false"/></view></k-feature-gate>
</template>
<script setup>
import { computed,reactive,ref,watch } from 'vue'
import { onLoad, onUnload } from '@dcloudio/uni-app'
import { wishQuote,wishPublish } from '@/common/wish-api.js'
import { payFlow } from '@/common/pay-flow.js'
import { ensureSession,experience } from '@/common/experience.js'
import { go,replace,toast } from '@/common/screen.js'
import { todayCn,shiftDate,modal } from '@/common/ui.js'
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
    toast('已保存，可在发布页的草稿箱继续编辑')
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
let pageOpen = true
onUnload(() => { pageOpen = false })

function sameWish(order, submitted, quotedTotal) {
  const fields = ['title', 'description', 'category', 'mode', 'delivery', 'originCity', 'targetCity']
  return fields.every(key => order[key] === submitted[key].trim())
    && String(order.deadline).slice(0, 10) === submitted.deadline
    && JSON.stringify(order.images) === JSON.stringify(submitted.images)
    && Number(order.amountFen) === quotedTotal
}

async function submit() {
  if (busy.value) return
  if (!rulesRead.value || !form.agreed) return toast('请先阅读并同意心愿规则')
  const user = experience.account?.id
  if (!user) return toast('请先登录后发布心愿')
  const isCurrent = () => pageOpen && experience.account?.id === user
  const submitted = { ...form, images: [...form.images] }
  const quotedTotal = Number(quote.value?.amountFen)
  busy.value = true
  let order
  try {
    order = (await wishPublish(submitted)).data
    if (!isCurrent()) return
    if (!order?.wishId) throw new Error('没有收到订单编号，请到我的心愿核对')
    if (!sameWish(order, submitted, quotedTotal)) {
      const choice = await modal('已找到上次提交的心愿',
        '原订单的内容或金额与本次填写不同。可以查看原单，或保留当前内容另发一份。',
        { confirmText: '查看原单', cancelText: '另发心愿' })
      if (!isCurrent()) return
      if (choice.confirm) go(route('order', order.wishId))
      if (choice.cancel) {
        form.requestKey = requestKey()
        step.value = 1
      }
      return
    }
    if (activeDraftId) {
      try { removeLocalDraft(user, activeDraftId) }
      catch { toast('心愿已提交，本机草稿未能清理') }
    }
    if (order.payNo && order.status === 'pending_payment') {
      const result = await payFlow(order.payNo, { isCurrent })
      if (!isCurrent()) return
      if (result.status === 'unknown') toast('支付结果确认中，请在订单内刷新')
    }
    replace(route('order', order.wishId))
  } catch (error) {
    if (!isCurrent()) return
    toast(error.message || '提交未完成，请到我的心愿核对')
    if (order?.wishId) replace(route('order', order.wishId))
  } finally {
    busy.value = false
  }
}
</script>
<style lang="scss">@import './wish.scss';
/* 2026-11-17 改版「小而精」：发布页 —— 白卡 12 圆角，输入框 44 高、字 14；成本价、免费提示、确认页图标都换成暖色，字收小一档。金额计算和各项填写原样保留。 */
.wp-title{font-size:15px;font-weight:600}.wp-description{margin-top:8px;background:var(--k-paper);min-height:110px}.wp-counter{text-align:right;font-size:10px;color:var(--k-light);margin-top:4px}.wp-cost{background:var(--k-paper);border-radius:12px;padding:12px;margin-bottom:8px}.wp-cost__input{display:flex;gap:6px;align-items:center;background:var(--k-paper);border:1px solid var(--k-line2);border-radius:10px;padding:0 12px;width:140px;height:44px;box-sizing:border-box;font-size:16px;font-weight:700;color:var(--k-red)}.wp-cost__input input{width:100%;font-size:18px;font-weight:700;height:42px;color:var(--k-ink)}.wp-free{display:flex;gap:10px;align-items:center;background:var(--k-green-soft);border-radius:12px;padding:12px;margin-bottom:8px}.wp-free text{display:block;font-size:14px;font-weight:600;color:var(--k-green)}.wp-free text+text{font-weight:400;font-size:11px;margin-top:2px;color:var(--k-ink2)}.wp-confirm-head{text-align:center;padding:8px 0 16px}.wp-confirm-icon{width:52px;height:52px;border-radius:16px;background:linear-gradient(145deg,#FCF4E8,#F4E4CC);display:flex;align-items:center;justify-content:center;margin:0 auto 12px}.wp-confirm-copy{display:block;margin-top:12px;color:var(--k-ink2);font-size:12px}.wp-total{display:flex;flex-direction:column;font-size:11px;color:var(--k-muted);min-width:90px}.wp-total text+text{font-size:20px;font-weight:700;line-height:1.3;color:var(--k-red);font-variant-numeric:tabular-nums}
/* 11-18 第二轮精修（只动样子；这是填写页，字号一律不缩）：
   1) 选择行右边的箭头统一 12 号灰色（之前 14 号浅灰几乎看不见）
   2) 确认页顶上的图标块和全站入口图标一样：44、圆角 12，图标 22
   3) 公共样式把页签收到 14、卡里小标题收到 14；这一页是填写页，页签和「成本价」、确认卡标题保持 15，只跟着统一字重和短条 */
.wp-confirm-icon{width:44px;height:44px;border-radius:12px}
.w-title+.w-tabs .w-tabs__item{font-size:15px}
.wp-cost .w-heading,.wp-confirm-head+.w-card .w-heading{font-size:15px;font-weight:600;line-height:22px}
/* 11-18 第三轮逐页精修：标题框的提示字不再跟着输入内容加粗（提示字 15/400 浅灰，输入后正文仍是 600）；
   信息列表右边一列统一 14 号：已填深墨、没填浅灰；能点开选择的行带 12 号小箭头，直接输入的行右边让出同样的 22，让一列字的右边缘对齐。 */
.wp-ph{font-weight:400;color:var(--k-light)}
.w-card>picker .w-field>text:not(.w-grow),.w-card>view>.w-field>text:not(.w-grow){font-size:14px;color:var(--k-ink)}
.w-card>view>.w-field>text.w-muted{color:var(--k-light)}
.w-card>.w-field>input{margin-right:22px;font-size:14px}
/* 11-18 第三轮返修（评审第 1 轮）：
   1) 成本价和上面的信息列表同一套写法：左边标签、右边 18/700 的数字输入，不加框，「¥」用灰色前缀；
   2) 卡与卡之间 12。 */
.wp-page .w-card,.wp-page .wp-cost{margin-bottom:12px}
.wp-page .wp-cost{padding:16px}
.wp-page .wp-cost__input{width:auto;flex:0 0 auto;justify-content:flex-end;gap:4px;height:44px;padding:0;border:0;border-radius:0;background:transparent;color:var(--k-muted);font-size:18px;font-weight:700}
.wp-page .wp-cost__input input{flex:0 0 96px;width:96px;min-width:0;height:44px;text-align:left;font-size:18px;font-weight:700;color:var(--k-red);font-variant-numeric:tabular-nums}
/* 11-18 第三轮返修（评审第 2 轮）：
   1) 标题框、说明框和筛选页 / 资质页同一套：浅灰底、不描边、圆角 8；两个框的提示字都是 400 浅灰（说明框 14 号）；
   2) 「成本价」金额右对齐，右边和上面信息列表的数值列对齐（卡片内边距线往里 22）；
   3) 信息列表左边一列统一 14/400 深墨；字数统计 11 号；
   4) 说明文字换行尽量不剩单个字（text-wrap:pretty）。 */
.wp-page .wp-title,.wp-page .wp-description{border:0;border-radius:8px;background:var(--k-page)}
.wp-page .wp-cost .w-between{gap:12px}
.wp-page .wp-cost__input{flex:1;min-width:0;justify-content:flex-end;margin-right:22px}
.wp-page .wp-cost__input input{flex:0 0 72px;width:72px;text-align:right}
.wp-page .w-card .w-field>.w-field__label,.wp-page .w-card .w-field>.w-grow{font-size:14px;font-weight:400;color:var(--k-ink)}
.wp-page .wp-counter{font-size:11px}
.wp-page .w-caption{text-wrap:balance}
/* 11-18 第三轮返修（评审第 3 轮）：成本价「¥」紧贴数字（原来右对齐的输入框让两者之间空出约 37px）—— ¥ 18/700 二级墨，输入框 88 宽、文字左对齐，间距 4 */
.wp-page .wp-cost__input{gap:4px;color:var(--k-ink2)}
.wp-page .wp-cost__input input{flex:0 0 88px;width:88px;text-align:left}
/* 2026-11-18 第三轮返修（评审第 4 轮）：成本价金额右对齐到卡片右内边距线（输入框宽度按字数算，「¥」跟着数字走）；「期望完成日期」下的说明行算这一行的一部分，发丝线挪到说明下面（日期行和说明之间不再画线），说明和上面的字段名对齐。 */
.wp-page .wp-cost__input{margin-right:0}
.wp-page .wp-cost__input input{flex:0 0 auto;text-align:right}
.wp-page .w-card>view>.w-field::after{display:none}
.wp-page .w-card>.wp-date-cap{position:relative;display:block;margin:0;padding:4px 0 12px 26px}
.wp-page .w-card>.wp-date-cap::after{content:"";position:absolute;left:0;right:0;bottom:0;height:1px;background:var(--k-line);transform:scaleY(.5);transform-origin:0 100%}
/* 2026-11-18 第三轮返修（评审第 5 轮）：
   1) 上一条「日期说明」的缩进和发丝线只挂在日期说明自己的类名上（网页版里照片组件的根节点也是 view，被误套成内缩 26、底下多一条线）；
   2) 照片说明和卡里其他内容同一条左线，上距 8，不画线，正常折行；
   3) 底部说明按句号分成两行（字和标点不变），不再把「支付」拆到两行。 */
.wp-page .w-card>.wp-photo-cap{display:block;margin:8px 0 0;padding:0;text-wrap:wrap}
.wp-page .wp-foot-cap>text{display:block;text-wrap:wrap}
/* 2026-11-18 第四轮精修（按微信实拍评审）
   1) 成本价卡上下内边距都是 16：金额这一行 24 高（不再被 44 高的输入框撑出上面一截空）；「成本价」15/600；¥ 和数字紧贴（间距 2），金额深墨等宽，占位「0.00」400 浅灰；说明用发丝线隔开；
   2) 同意行：勾选框后留 8，「我已阅读并同意」和书名号紧挨，不再空一大截；
   3) 右上「保存草稿」和左边英文小标题同一行居中对齐（链接自带的上下 10 点按区用负外边距抵掉）。 */
.wp-page .wp-cost .w-between{min-height:24px}
.wp-page .wp-cost .w-heading{font-size:15px;font-weight:600;line-height:24px}
.wp-page .wp-cost__input{height:24px;gap:2px;color:var(--k-ink);font-size:18px;line-height:24px}
.wp-page .wp-cost__input input{height:24px;min-height:24px;line-height:24px;color:var(--k-ink)}
.wp-page .wp-cost>.w-caption{position:relative;margin-top:12px;padding-top:12px}
.wp-page .wp-cost>.w-caption::before{content:"";position:absolute;left:0;right:0;top:0;height:1px;background:var(--k-line);transform:scaleY(.5);transform-origin:0 0}
.wp-page .w-check{gap:0}
.wp-page .w-check>.w-check__box{margin-right:8px}
.wp-page .w-body>.w-between:first-child{align-items:center;margin-bottom:6px}
.wp-page .w-body>.w-between:first-child>.w-eyebrow{margin-bottom:0;line-height:16px}
.wp-page .w-body>.w-between:first-child>.w-link{margin:-10px 0;line-height:16px}
/* 2026-11-19 第四轮返修（按复评）：成本价输入框宽度按数字实际宽度估（不再多留 2 + 估宽余量），金额右对齐、¥ 紧贴（间距 2）；
   右上「保存草稿」退成 12 号灰字，底部「保存草稿」是主入口（两个入口都在，点按不变）。 */
.wp-page .wp-cost__input input{padding:0;font-variant-numeric:tabular-nums}
.wp-page .w-body>.w-between:first-child>.w-link{font-size:12px;color:var(--k-muted)}
/* 2026-11-19 第五轮（按微信实拍复核）：
   1) 第一张卡不再框套框：标题输入改白底 + 一条发丝下划线（48 高、16/600），描述框去掉浅底、像正文一样直接写，行高 22，卡里只剩虚线照片格一块底色（和筛选页下划线输入同一做法）；
   2) 描述框占位文字行高 22，和输入后的正文一样，不再挤成两行。 */
.wp-page .w-card>.wp-title{height:48px;min-height:48px;padding:0;border-radius:0;background:transparent;box-shadow:inset 0 -1px 0 var(--k-line);font-size:16px;font-weight:600;line-height:48px}
.wp-page .w-card>.wp-description{min-height:120px;margin-top:4px;padding:12px 0 0;border-radius:0;background:transparent;line-height:22px}
.wp-page .wp-description .wp-ph,.wp-page .wp-ph{line-height:22px}
/* 2026-11-19 第五轮补（按微信实拍复核）：成本价「¥」退成 14/600 前缀、紧贴金额（间距 2），金额 18/700 深墨等宽，主次分明。 */
.wp-page .wp-cost__input>text{font-size:14px;font-weight:600;line-height:24px}
</style>
