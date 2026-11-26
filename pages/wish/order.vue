<template><view class="wish-page wo-page" :class="$userSurface"><k-topbar :title="wish?.status==='completed'?'心愿已完成':'心愿订单'" back :fab="false"/>
    <k-subscribe scenes="wish" label="订阅心愿进展提醒" />
  <view v-if="wish" class="w-body" :class="{'wo-with-draft':tab==='chat'&&chatImages.length}"><view class="wo-status" :class="{'wo-status--done':wish.status==='completed'}"><view class="w-between"><view><text class="wo-status__label">{{statusText(wish.status)}}</text><text class="wo-status__copy">{{statusCopy}}</text></view><view class="wo-status__icon"><k-icon :name="wish.status==='completed'?'check':'heart-handshake'" :size="22" :color="wish.status==='completed'?'green':'red'"/></view></view><text class="wo-number">心愿编号 #{{wish.wishId}} · {{wish.isOwner?'我发布的':'我帮助的'}}</text></view>
    <view class="w-card wo-summary"><view class="wo-find"><text>一对一互助 · 双方都可查看此订单</text><button class="w-link w-arrow" @click="go(route('mine')+'?role='+(wish.isOwner?'publisher':'helper'))">{{wish.isOwner?'我发布的':'我帮助的'}}<k-icon name="chevron-right" :size="12" color="muted"/></button></view><view class="wo-summary__main"><image v-if="wish.images.length" :src="absUrl(wish.images[0])" mode="aspectFill"/><view class="w-grow"><text class="wo-summary__title">{{wish.title}}</text><view class="wo-route"><text>{{wish.targetCity}}</text><k-icon name="arrow-right" :size="12" color="muted"/><text>{{wish.originCity}}</text></view><view class="w-between"><text class="w-muted">{{wish.mode==='free'?'免费互助':'展示价'}}</text><text class="wo-summary__price">¥{{money(wish.amountFen)}}</text></view></view></view>
    <button v-if="['accepted','submitted','disputed'].includes(wish.status)" class="wo-mediation" :disabled="busy" @click="wish.status==='disputed' ? tab='progress' : openSheet('dispute')"><k-icon name="scale" :size="14" color="muted"/><text>{{wish.status==='disputed'?'查看调解进度':'纠纷调解'}}</text></button></view>
    <view class="wo-tabs"><view :class="{on:tab==='progress'}" @click="tab='progress'">订单进度</view><view v-if="wish.helperId" :class="{on:tab==='chat'}" @click="tab='chat';loadMessages()">订单沟通</view><view :class="{on:tab==='fees'}" @click="tab='fees'">{{wish.status==='completed'?'完成结算':'费用明细'}}</view></view>
    <template v-if="tab==='progress'">
      <view class="w-card"><text class="w-heading">这次的约定</text><text class="w-copy wo-description">{{wish.description}}</text><view class="w-field"><k-icon name="calendar-days" :size="16" color="muted"/><text class="w-grow">期望完成</text><text>{{String(wish.deadline).slice(0,10)}}</text></view><view class="w-field"><k-icon name="package" :size="16" color="muted"/><text class="w-grow">交付方式</text><text>{{deliveryText(wish.delivery)}}</text></view><view class="w-field"><k-icon name="user" :size="16" color="muted"/><text class="w-grow">{{wish.isOwner?'帮忙的朋友':'心愿发布者'}}</text><text>{{wish.isOwner?(wish.helperName||'等待接单'):wish.publisherName}}</text></view></view>
      <view v-if="wish.delivery==='express'&&wish.helperId" class="w-card wo-shipping">
        <view class="w-between"><text class="w-heading">快递信息</text><button v-if="canEditTracking" class="w-link" @click="openTracking">{{wish.trackingNo?'修改物流':'填写快递单号'}}</button></view>
        <template v-if="wish.trackingNo"><text class="wo-courier">{{wish.courier}}</text><view class="w-between"><text class="wo-tracking">{{wish.trackingNo}}</text><button class="w-link" @click="copyTracking">复制单号</button></view></template>
        <text v-else class="w-caption">{{wish.isHelper?'寄出后填写快递公司和单号，发布者即可查看。':'等待接单者填写快递公司和单号。'}}</text>
      </view>
      <view v-if="wish.proof?.length" class="w-card"><view class="w-between"><text class="w-heading">交付凭证</text><text class="w-tag">等待被看见的心意</text></view><view class="wo-proofs"><image v-for="src in wish.proof" :key="src" :src="absUrl(src)" mode="aspectFill" @click="preview(src)"/></view><text class="w-copy">{{wish.deliveryNote}}</text></view>
      <view v-if="wish.auditNote" class="w-tip"><k-icon name="info" :size="16" color="red"/><text>平台说明：{{wish.auditNote}}</text></view><view v-if="wish.dispute" class="w-tip w-section"><text>争议说明：{{wish.dispute}}</text></view>
      <view v-if="wish.status==='completed'" class="w-card"><view class="w-row wo-echo-head"><k-icon name="heart" :size="16" color="red"/><text class="w-heading">为这份善意，留个回响</text></view><template v-if="wish.rating"><view class="wo-stars"><k-icon v-for="n in 5" :key="n" name="star" :size="18" :color="n<=wish.rating?'ochre':'line'" :fill="n<=wish.rating"/></view><text class="w-copy">{{wish.review||'感谢这次的帮忙。'}}</text></template><template v-else-if="wish.isOwner"><view class="wo-star-picker"><view v-for="n in 5" :key="n" class="wo-star" :class="{on:n<=rating}" hover-class="k-press" @click="rating=n"><k-icon name="star" :size="28" :color="n<=rating?'ochre':'light'" :fill="n<=rating"/></view></view><textarea v-model="review" class="w-input w-area" maxlength="500" placeholder="分享这次互助体验（选填）"/><button class="w-secondary w-section wo-review-submit" :disabled="busy||!rating" @click="act('review',{rating,note:review})">提交评价</button></template><text v-else class="w-caption">等待发布者留下评价。</text></view>
      <button v-if="wish.isOwner&&['pending_payment','reviewing','open','refund_failed'].includes(wish.status)" class="w-link" :disabled="busy" @click="cancel">{{wish.status==='refund_failed'?'重新申请退款':'取消心愿'}}</button>
    </template>
    <template v-if="tab==='chat'"><view class="w-tip"><k-icon name="shield-check" :size="16" color="red"/><text>沟通规格、运费和寄送信息。涉及新增食品、烟酒或内容与原约定不符，请申请平台介入重新核实。平台不会索取支付密码。</text></view><button v-if="hasOlder" class="w-link wo-older" @click="loadMessages(true)">加载更早的消息</button><text v-if="chatError" class="w-caption">{{chatError}}</text><view class="wo-chat"><view v-for="m in messages" :key="m.messageId" class="wo-message" :class="{mine:!!m.mine}"><text class="wo-message__meta">{{m.mine?'我':m.nickname}} · {{String(m.createTime).slice(5,16)}}</text><text v-if="m.content" class="wo-message__bubble">{{m.content}}</text><view v-if="m.images?.length" class="wo-message__images"><image v-for="(src,i) in m.images" :key="i" :src="absUrl(src)" mode="aspectFill" @click="previewMessage(m,i)"/></view></view><view v-if="!messages.length&&!chatError" class="w-state"><k-icon name="message-circle" :size="40" color="muted"/><text class="w-muted">打个招呼，确认这次心愿的细节吧。</text></view></view></template>
    <template v-if="tab==='fees'"><view v-if="wish.status==='completed'" class="wo-settled"><view class="wo-settled__icon"><k-icon name="check" :size="24" color="green"/></view><text class="w-heading">心愿完成，善意抵达</text><text class="w-caption">{{wish.mode==='free'?'这份帮助无价，平台不收取任何费用。':'本次费用已核算，结算进度如下。'}}</text><text class="wo-settled__amount">¥{{money(wish.netFen)}}</text><text class="w-muted">{{wish.mode==='free'?'免费互助':'服务者净结算金额'}}</text></view><w-fees :value="wish" :free="wish.mode==='free'" :settled="wish.status==='completed'"/><view v-if="wish.status==='completed'&&wish.mode==='paid'" class="w-card w-section"><view class="w-between"><text class="w-heading">打款进度</text><text class="w-tag">{{wish.payoutStatus==='paid'?'平台已登记打款':'待平台打款'}}</text></view><text class="w-caption">{{wish.payoutStatus==='paid'?'打款凭证号：'+wish.payoutReceipt:'平台核实服务者的收款资料后打款。费用核算完成不代表款项已到账。'}}</text><button v-if="wish.isHelper&&wish.payoutStatus!=='paid'" class="w-link w-arrow" @click="go(route('credential')+'?type=payout')">提交 / 查看收款资料<k-icon name="chevron-right" :size="12" color="muted"/></button></view><button class="w-link w-section" @click="go(route('rules'))">查看费用与品类规则</button></template>
    <view v-if="tab==='chat'" class="w-bottom wo-compose">
      <template v-if="canChat"><view v-if="chatImages.length" class="wo-drafts"><view v-for="(pic,i) in chatImages" :key="pic.imageId" class="wo-draft"><image :src="pic.local" mode="aspectFill" @click="previewDraft(i)"/><button :disabled="sending||chatUploading" @click="chatImages.splice(i,1)">移除</button></view></view>
      <text v-if="chatUploading" class="w-caption">图片上传中，请稍候…</text>
      <view class="wo-compose__row"><button class="wo-add" :disabled="sending||chatUploading||chatImages.length>=3" @click="addChatImages"><k-icon name="image" :size="20" color="red"/><text>图片</text></button><input v-model="message" :disabled="sending" :adjust-position="true" :cursor-spacing="28" placeholder="聊聊心愿的细节…" maxlength="1000" confirm-type="send" @confirm="send"/><button class="w-primary" :disabled="sending||chatUploading||(!message.trim()&&!chatImages.length)" @click="send">{{sending?'发送中':'发送'}}</button></view></template><text v-else class="w-caption">当前订单已关闭，可查看历史沟通。</text>
    </view>
    <view v-else class="w-bottom"><button v-if="wish.isOwner&&wish.status==='pending_payment'" class="w-primary" :disabled="busy" @click="pay">继续支付 ¥{{money(wish.amountFen)}}</button><button v-else-if="wish.isHelper&&wish.status==='accepted'" class="w-primary w-primary--lime" :disabled="busy" @click="openSheet('deliver')">提交完成凭证</button><button v-else-if="wish.isOwner&&wish.status==='submitted'" class="w-primary w-primary--lime" :disabled="busy" @click="complete">确认完成</button><button v-else-if="wish.status==='completed'&&tab!=='fees'" class="w-primary" @click="tab='fees'">查看完成结算</button><button v-else class="w-secondary wo-refresh" :disabled="busy" @click="load"><k-icon name="refresh-cw" :size="16" color="red"/>刷新进度</button></view>
    <view v-if="trackingOpen" class="w-mask" @click="!busy&&(trackingOpen=false)"><view class="w-sheet" @click.stop><view class="w-between"><text class="w-heading">填写快递信息</text><button class="w-link" :disabled="busy" @click="trackingOpen=false">关闭</button></view><text class="w-caption">保存后双方可查看；完成约定后仍需提交交付凭证。</text><text class="wo-input-label">快递公司</text><input v-model="courier" class="w-input" placeholder="例如：顺丰速运" maxlength="60" :adjust-position="true" :cursor-spacing="28"/><text class="wo-input-label">快递单号</text><input v-model="trackingNo" class="w-input" placeholder="输入或粘贴快递单号" maxlength="80" :adjust-position="true" :cursor-spacing="28"/><button class="w-primary w-section" :disabled="busy||!courier.trim()||!trackingNo.trim()" @click="saveTracking">{{busy?'保存中…':'保存物流信息'}}</button></view></view>
    <view v-if="sheet" class="w-mask" @click="sheet='' "><view class="w-sheet" @click.stop><view class="w-between"><text class="w-heading">{{sheet==='deliver'?'提交完成凭证':'申请平台介入'}}</text><button class="w-link" @click="sheet=''">关闭</button></view><text class="w-caption">{{sheet==='deliver'?'请上传1–6张真实交付照片（必填，单张不超过20MB），并填写5–500字完成说明。发布者确认后才会结算。':'说明问题和希望的处理方式。平台处理期间暂停完成结算。'}}</text><w-photos v-if="sheet==='deliver'" v-model="proof" @busy="uploading=$event"/><textarea v-model="note" :fixed="true" :adjust-position="true" :cursor-spacing="24" class="w-input w-area w-section" maxlength="500" placeholder="请填写至少5个字的说明"/><button class="w-primary w-section" :disabled="busy||uploading||note.trim().length<5||(sheet==='deliver'&&!proof.length)" @click="act(sheet,{note,images:proof})">{{busy?'提交中…':'确认提交'}}</button></view></view>
  </view><view v-else class="w-state" :class="{'w-state--loading':!error}"><view v-if="!error" class="w-skel wo-skel"><view class="wo-skel__status"><view class="w-skel__bar wo-skel__label"/><view class="w-skel__bar w-skel__bar--mid"/></view><view class="wo-skel__goods"><view class="wo-skel__thumb"/><view class="wo-skel__lines"><view class="w-skel__bar"/><view class="w-skel__bar w-skel__bar--short"/></view></view><view class="wo-skel__tabs"><view class="w-skel__bar"/><view class="w-skel__bar"/><view class="w-skel__bar"/></view></view><text>{{error||'正在加载订单…'}}</text><button v-if="error && !id" class="w-secondary" @click="go(route('mine'))">查看我的心愿</button><button v-else-if="error" class="w-secondary" @click="load">重新加载</button></view>
</view></template>
<script setup>
import { computed,ref } from 'vue'
import { onLoad,onShow,onHide,onUnload } from '@dcloudio/uni-app'
import { wishDetail,wishAction,wishMessages,wishSend } from '@/common/wish-api.js'
import { payFlow } from '@/common/pay-flow.js'
import { absUrl,uploadTo } from '@/common/upload.js'
import { getToken } from '@/common/request.js'
import { chooseWishPhotos,PHOTO_MAX_BYTES } from './photo-upload.js'
import { go,toast } from '@/common/screen.js'
import { confirm } from '@/common/ui.js'
import { money,route,statusText,deliveryText,requestKey } from './wish.js'
import WFees from './components/w-fees.vue'
import WPhotos from './components/w-photos.vue'
const id=ref(0),wish=ref(null),error=ref(''),busy=ref(false),tab=ref('progress'),sheet=ref(''),note=ref(''),proof=ref([]),uploading=ref(false),rating=ref(0),review=ref(''),messages=ref([]),message=ref(''),sending=ref(false),chatError=ref(''),hasOlder=ref(false)
const chatImages=ref([]),chatUploading=ref(false),trackingOpen=ref(false),courier=ref(''),trackingNo=ref('')
const canEditTracking=computed(()=>wish.value?.isHelper&&['accepted','submitted'].includes(wish.value?.status))
const canChat=computed(()=>!!wish.value?.helperId&&['accepted','submitted','disputed','completed'].includes(wish.value?.status))
let timer=null, chatBusy=false, sendAttempt=null, loadVersion=0, showVersion=0, disposed=false
let session = {token: getToken()}
function currentSession(requestSession) {
  return !disposed && requestSession === session && session.token === getToken()
}
function openTracking(){courier.value=wish.value.courier||'';trackingNo.value=wish.value.trackingNo||'';trackingOpen.value=true}
async function saveTracking(){const number=trackingNo.value.replace(/\s+/g,'');if(!/^[A-Za-z0-9-]{6,80}$/.test(number)){toast('请填写6至80位快递单号');return}await act('tracking',{courier:courier.value.trim(),trackingNo:number})}
function copyTracking(){uni.setClipboardData({data:wish.value.trackingNo})}
function previewDraft(index){uni.previewImage({current:chatImages.value[index].local,urls:chatImages.value.map(p=>p.local)})}
async function previewMessage(m,index){
  const token=session
  try{const rows=(await wishMessages(id.value,Number(m.messageId)+1)).data;if(!currentSession(token))return;const fresh=rows.find(x=>x.messageId===m.messageId);if(!fresh?.images?.length)throw new Error('图片暂不可用，请刷新消息');m.images=fresh.images;uni.previewImage({current:absUrl(fresh.images[index]||fresh.images[0]),urls:fresh.images.map(absUrl)})}catch(e){if(currentSession(token))toast(e.message||'图片加载失败')}
}
async function addChatImages(){
  if(chatUploading.value||sending.value||!canChat.value||chatImages.value.length>=3)return
  const token=session;chatUploading.value=true
  try{const picked=await chooseWishPhotos(3-chatImages.value.length);for(const file of picked.slice(0,3-chatImages.value.length)){if(!currentSession(token))return;if(file.size>PHOTO_MAX_BYTES)throw new Error('单张图片不能超过20MB');const data=(await uploadTo(`/app/wishes/${id.value}/message-images`,file.path)).data;if(!currentSession(token))return;if(!data?.imageId||!data?.url)throw new Error('图片上传失败，请重试');chatImages.value.push({imageId:data.imageId,local:file.path})}}catch(e){if(currentSession(token))toast(e.message||'图片上传失败')}finally{if(currentSession(token))chatUploading.value=false}
}
const statusCopy=computed(()=>({pending_payment:'支付后进入内容审核，30分钟内可支付。',reviewing:'正在审核心愿内容，通过后在广场展示。',open:'心愿已出发，等一位远方的朋友回应。',accepted:wish.value?.isHelper?'你已接下这份心愿，请完成约定后提交凭证。':'你的心愿已被接单，可与帮忙的朋友沟通。',submitted:'服务者已提交凭证，请发布者核实后确认。',completed:'谢谢你，让城市之间多了一点温暖。',disputed:'平台正在核实情况，结算已暂停。',refunding:'已申请原路退款，以支付渠道处理结果为准。',refund_failed:'退款未完成，可重试或联系平台处理。',cancelled:'心愿已取消，有偿订单以支付渠道退款记录为准。'}[wish.value?.status]||''))
async function load() {
  if (!id.value) {
    error.value = '心愿订单链接缺少有效编号，请从我的心愿打开'
    return
  }
  const requestSession = session
  const version = ++loadVersion
  try {
    error.value = ''
    const data = (await wishDetail(id.value)).data
    if (version !== loadVersion || !currentSession(requestSession)) return
    if (!data.isOwner && !data.isHelper) throw new Error('仅订单双方可查看此订单')
    wish.value = data
  } catch (failure) {
    if (version !== loadVersion || !currentSession(requestSession)) return
    wish.value = null
    error.value = failure.message || '加载失败'
  }
}
async function act(action, body = {}) {
  const requestSession = session
  if (!wish.value || busy.value || !currentSession(requestSession)) return
  busy.value = true
  loadVersion++
  try {
    const data = (await wishAction(id.value, action, body)).data
    if (!currentSession(requestSession)) return
    loadVersion++
    wish.value = data
    error.value = ''
    sheet.value = ''
    if (action === 'tracking') trackingOpen.value = false
    if (action === 'complete') tab.value = 'fees'
    toast(action === 'review' ? '评价已提交' : action === 'tracking' ? '物流信息已保存' : '进度已更新')
  } catch (failure) {
    if (currentSession(requestSession)) toast(failure.message || '操作失败，请重试')
  } finally {
    if (currentSession(requestSession)) busy.value = false
  }
}
function openSheet(kind){sheet.value=kind;note.value='';proof.value=[]}
async function cancel(){const requester=session;if(await confirm('取消这份心愿？',wish.value.mode==='free'?'取消后将不再展示。':'尚未接单的心愿可取消，已支付金额全额原路退回。') && currentSession(requester))await act('cancel')}
async function complete(){const requester=session;if(await confirm('确认已经收到约定的交付？',wish.value.mode==='free'?'确认后心愿完成，平台不收取费用。':`确认后将扣除 ¥${money(wish.value.feeFen)} 手续费，服务者结算 ¥${money(wish.value.netFen)}。`) && currentSession(requester))await act('complete')}
async function pay() {
  const requestSession = session
  if (!wish.value || busy.value || !currentSession(requestSession)) return
  busy.value = true
  try {
    const result = await payFlow(wish.value.payNo)
    if (!currentSession(requestSession)) return
    if (result.status === 'unknown') toast('支付结果确认中，请稍后刷新')
    await load()
  } catch (failure) {
    if (currentSession(requestSession)) toast(failure.message || '支付失败')
  } finally {
    if (currentSession(requestSession)) busy.value = false
  }
}
function preview(src){uni.previewImage({current:absUrl(src),urls:wish.value.proof.map(absUrl)})}
async function loadMessages(older = false) {
  const requestSession = session
  if (chatBusy || !wish.value?.helperId || !currentSession(requestSession)) return
  chatBusy = true
  try {
    const before = older ? messages.value[0]?.messageId || 0 : 0
    const page = (await wishMessages(id.value, before)).data
    if (!currentSession(requestSession)) return
    const byId = new Map(messages.value.map(row => [row.messageId, row]))
    const fullPage = page.length === 50
    // When the last read is outside this window, page back from the new window.
    if (!older && fullPage && !page.some(row => byId.has(row.messageId))) byId.clear()
    if (older || !byId.size) hasOlder.value = fullPage
    for (const row of page) byId.set(row.messageId, row)
    messages.value = [...byId.values()].sort((a, b) => a.messageId - b.messageId)
    chatError.value = ''
  } catch (failure) {
    if (currentSession(requestSession)) chatError.value = failure.message || '消息加载失败'
  } finally {
    if (currentSession(requestSession)) chatBusy = false
  }
}
async function send(){
  const content=message.value.trim(),imageIds=chatImages.value.map(p=>p.imageId),token=session
  if(sending.value||chatUploading.value||!canChat.value||(!content&&!imageIds.length))return
  sending.value=true
  if(!sendAttempt||sendAttempt.content!==content||JSON.stringify(sendAttempt.imageIds)!==JSON.stringify(imageIds))sendAttempt={requestKey:requestKey(),content,imageIds}
  try{await wishSend(id.value,sendAttempt);if(!currentSession(token))return;message.value='';chatImages.value=[];sendAttempt=null;await loadMessages();if(currentSession(token))uni.pageScrollTo({scrollTop:100000,duration:200})}catch(e){if(currentSession(token))toast(e.message||'发送失败，请重试')}finally{if(currentSession(token))sending.value=false}
}
function stop() {
  showVersion++
  if (timer) clearInterval(timer)
  timer = null
}
function resetAccount(token) {
  session = {token}
  wish.value = null
  tab.value = 'progress'
  messages.value = []
  chatImages.value = []
  proof.value = []
  message.value = note.value = review.value = chatError.value = ''
  courier.value = trackingNo.value = sheet.value = ''
  trackingOpen.value = hasOlder.value = busy.value = false
  uploading.value = chatUploading.value = sending.value = chatBusy = false
  rating.value = 0
  sendAttempt = null
}
onLoad(query => {
  const raw = String(query?.id ?? '')
  const value = Number(raw)
  id.value = /^\d+$/.test(raw) && Number.isSafeInteger(value) && value > 0 ? value : 0
})
onShow(async () => {
  stop()
  const version = showVersion
  const token = getToken()
  if (session.token !== token) resetAccount(token)
  await load()
  if (version !== showVersion || !id.value) return
  if (tab.value === 'chat') loadMessages()
  timer = setInterval(() => { if (tab.value === 'chat') loadMessages() }, 6000)
})
onHide(stop)
onUnload(() => { disposed = true; stop() })
</script>
<style lang="scss">@import './wish.scss';
/* 2026-11-17 改版「小而精」：状态卡换成白底加一层很浅的暖色（完成后是浅绿），图标放进 40 的圆角方块；订单摘要、页签、约定、快递、凭证、沟通、结算都收小一档。金额、状态说明、按钮原样保留。 */
.wo-status{background:linear-gradient(180deg,#FFF8EE,var(--k-paper) 72%);color:var(--k-ink);border-radius:12px;padding:12px;margin-bottom:8px}.wo-status--done{background:linear-gradient(180deg,#EDF3E6,var(--k-paper) 72%)}.wo-status__label{display:block;font-size:18px;font-weight:700;line-height:1.4}.wo-status__copy{display:block;font-size:12px;line-height:1.6;margin-top:2px;color:var(--k-muted)}.wo-status__icon{flex-shrink:0;width:40px;height:40px;display:flex;align-items:center;justify-content:center;border-radius:12px;background:linear-gradient(145deg,#FCF4E8,#F4E4CC)}.wo-status--done .wo-status__icon{background:var(--k-green-soft)}.wo-number{display:block;font-size:11px;color:var(--k-muted);margin-top:10px;padding-top:8px;border-top:1px solid var(--k-line)}.wo-summary{display:flex;gap:10px;padding:10px;align-items:center}.wo-summary>image{width:64px;height:64px;border-radius:8px;flex-shrink:0}.wo-summary__title{display:block;font-size:14px;font-weight:600;line-height:20px}.wo-summary__price{color:var(--k-red);font-size:15px;font-weight:700;font-variant-numeric:tabular-nums}.wo-summary .w-caption{margin:2px 0 4px;font-size:11px}.wo-tabs{display:flex;gap:20px;margin:6px 0 10px;font-size:14px;font-weight:500;color:var(--k-muted)}.wo-tabs>view{position:relative;height:40px;line-height:40px}.wo-tabs .on{color:var(--k-ink);font-weight:700}.wo-tabs .on:after{content:"";position:absolute;left:50%;bottom:4px;width:18px;height:3px;margin-left:-9px;border-radius:2px;background:var(--k-red)}.wo-description{display:block;font-size:13px;color:var(--k-ink2);margin:8px 0 4px}.wo-proofs{display:flex;gap:6px;flex-wrap:wrap;margin:10px 0}.wo-proofs image{width:calc((100% - 12px)/3);height:90px;border-radius:8px}.wo-support{margin:12px 0}.wo-chat{padding:14px 0}.wo-message{display:flex;flex-direction:column;align-items:flex-start;margin-bottom:14px}.wo-message.mine{align-items:flex-end}.wo-message__meta{font-size:10px;color:var(--k-muted);margin-bottom:4px}.wo-message__bubble{display:block;max-width:80%;padding:9px 12px;background:var(--k-paper);border-radius:4px 12px 12px 12px;white-space:pre-wrap;word-break:break-word;font-size:14px;line-height:1.6}.wo-message.mine .wo-message__bubble{background:linear-gradient(135deg,#B5814D,#8E5E33);color:var(--k-paper);border-radius:12px 4px 12px 12px}.wo-compose input{background:var(--k-fill);padding:0 14px;border-radius:20px;flex:1;min-width:0;height:40px;font-size:14px}.wo-compose .w-primary{flex:0 0 auto;min-height:36px;padding:0 16px;border-radius:18px;font-size:13px!important}.wo-settled{text-align:center;padding:10px 0 16px}.wo-settled__icon{width:48px;height:48px;border-radius:50%;background:var(--k-green-soft);display:flex;align-items:center;justify-content:center;margin:0 auto 10px}.wo-settled__amount{font-size:28px;font-weight:700;display:block;margin:12px 0 2px;color:var(--k-red);font-variant-numeric:tabular-nums}.wo-stars{font-size:18px;letter-spacing:3px;color:var(--k-ochre);display:block;margin:10px 0}.wo-star-picker{display:flex;justify-content:space-between;font-size:30px;line-height:44px;color:#E6E0D8;margin:6px 0 8px;padding:0 12px}.wo-star-picker .on{color:var(--k-ochre)}.wo-older{margin:auto!important}
.wo-mediation{display:flex;align-items:center;justify-content:center;gap:6px;width:100%}
.wo-find{display:flex;align-items:center;justify-content:space-between;gap:8px;margin:0 2px 8px;font-size:11px;color:var(--k-muted)}.wo-find .w-link{flex-shrink:0}.wo-courier{display:block;margin:8px 0 2px;font-size:12px;color:var(--k-muted)}.wo-tracking{font-size:14px;word-break:break-all;flex:1;min-width:0;font-variant-numeric:tabular-nums}.wo-shipping .w-caption{display:block;margin-top:8px}.wo-input-label{display:block;margin:12px 0 6px;font-size:13px;color:var(--k-ink2)}.wo-compose{flex-direction:column;align-items:stretch}.wo-compose__row{display:flex;align-items:center;gap:8px}.wo-compose .wo-add{margin:0;padding:0 4px;background:transparent;display:flex;align-items:center;justify-content:center;flex-direction:column;font-size:10px;line-height:1.5;min-width:38px;min-height:44px;color:var(--k-red-deep)}.wo-add:after{border:0}.wo-message__images{display:flex;gap:6px;flex-wrap:wrap;max-width:90%;margin-top:6px}.wo-message__images image{width:82px;height:92px;border-radius:8px}.wo-drafts{display:flex;gap:10px;padding:0 0 10px}.wo-draft{display:flex;flex-direction:column;width:62px}.wo-draft image{width:62px;height:62px;border-radius:8px}.wo-draft button{margin:4px 0 0;padding:0;line-height:24px;font-size:11px;color:var(--k-muted);background:transparent}.wo-draft button:after{border:0}.wo-with-draft{padding-bottom:210px!important}
/* 11-18 第二轮精修（只动样子）：
   1) 页签和全站下划线页签一样：未选 400 灰、选中 600 深色，短条 16×3
   2) 心愿编号上面的线改发丝线
   3) 「我发布的 / 我帮助的」「提交 / 查看收款资料」的文字箭头换成 12 号灰色图标
   4) 不能点时（发送中、上传中）「图片」「移除」保持原来的颜色整体变淡，不被微信自带的灰底灰字盖掉 */
.wo-tabs{font-weight:400}
.wo-tabs .on{font-weight:600}
.wo-tabs .on:after{width:16px;margin-left:-8px}
.wo-number{position:relative;border-top:0}
.wo-number::before{content:"";position:absolute;left:0;right:0;top:0;height:1px;background:var(--k-line);transform:scaleY(.5);transform-origin:0 0}
.wo-compose .wo-add[disabled]{background:transparent;color:var(--k-red-deep)}
.wo-drafts .wo-draft button[disabled]{background:transparent;color:var(--k-muted)}
/* 11-18 第三轮逐页精修：评分的「★☆」字符换成 18 号星形图标（点亮的赭黄实心、没点亮的浅线），间距 4 */
.wo-stars{display:flex!important;gap:4px;letter-spacing:0}
/* 11-18 第三轮返修（评审第 1 轮）：
   1) 打分的 5 颗星换成 28 号星形图标（选中赭黄实心、没选浅灰线框），间距 12、整组居中，每颗可点 44×44；
   2) 「纠纷调解」从首屏的通栏描边大按钮降成摘要卡底部右侧的文字链（14 号天平 + 12 号灰字），显示条件和点了去哪都不变；
   3) 摘要卡内边距 16、缩略图 64；路线用 12 号向右箭头图标，和详情页一致；
   4) 评价输入框和沟通区一样：浅灰底、不描边、圆角 8；「刷新进度」的图标放到字前面。 */
.wo-page .wo-summary{display:block;padding:16px}
.wo-summary__main{display:flex;align-items:center;gap:12px}
.wo-summary__main>image{width:64px;height:64px;flex-shrink:0;border-radius:8px}
.wo-route{display:flex;align-items:center;gap:4px;margin:2px 0 4px;font-size:12px;line-height:18px;color:var(--k-muted)}
.wo-page .wo-mediation{display:flex;align-items:center;justify-content:flex-end;gap:4px;width:100%;height:auto;margin:12px 0 -4px;padding:10px 0 0;border-radius:0;background:transparent;box-shadow:none;color:var(--k-muted);font-size:12px;line-height:18px;position:relative}
.wo-page .wo-mediation::after{content:"";position:absolute;left:0;right:0;top:0;height:1px;border:0;border-radius:0;background:var(--k-line);transform:scaleY(.5);transform-origin:0 0}
.wo-page .wo-star-picker{display:flex;justify-content:center;gap:12px;margin:12px 0 8px;padding:0;line-height:1}
.wo-star{display:flex;align-items:center;justify-content:center;width:28px;height:44px;position:relative}
.wo-star::after{content:"";position:absolute;left:-6px;right:-6px;top:0;bottom:0}
.wo-page .w-card textarea.w-input{border:0;border-radius:8px;background:var(--k-bg)}
/* 11-18 第三轮返修（评审第 2 轮）：
   1) 底部只有「刷新进度」时是白底细棕线的次按钮（工具操作不再是整页最重的东西）；
   2) 状态卡内边距 16，和下面的卡同一条卡内对齐线；「一对一互助」说明行贴页面边距；
   3) 订单进度里卡与卡、提示之间统一 12；「这次的约定」正文 14/1.6；
   4) 评价卡里的「提交评价」是 40 高次按钮，不能点时暖灰底 + 浅灰字（不和底栏的主按钮抢）；
   5) 交付凭证一行三张正方形。 */
.wo-page .wo-status{padding:16px;margin-bottom:12px}
.wo-page .wo-find{margin:0 0 8px}
.wo-page .w-body>.w-card{margin-bottom:12px}
.wo-page .w-body>.w-tip{margin:0 0 12px}
.wo-page .wo-description{font-size:14px;line-height:1.6}
.wo-page .w-bottom .wo-refresh{flex:1;display:flex;align-items:center;justify-content:center;gap:6px}
.wo-page .wo-review-submit{display:flex;align-items:center;justify-content:center;width:100%;height:40px;line-height:40px!important}
.wo-page .wo-review-submit[disabled]{opacity:.6}
.wo-page .wo-proofs{gap:8px}
.wo-page .wo-proofs image{width:calc((100vw - 72px)/3);height:calc((100vw - 72px)/3)}
/* 2026-11-18 第三轮返修（评审第 4 轮）：「留个回响」的心形是装饰，挪到标题左边（间距 6），不再像右侧的收藏按钮；状态卡说明两行等长，320 宽不再剩一两个字。 */
.wo-echo-head{gap:6px}
.wo-status__copy{text-wrap:balance}
/* 2026-11-18 第三轮返修（评审第 5 轮）：「一对一互助 · 双方都可查看此订单 / 我发布的」原来悬在两张卡之间，不属于任何一块 —— 收进商品卡做卡头：
   11 号灰字一行，下面一条发丝线，再接商品信息；右边的「我发布的 / 我帮助的」对齐卡片右内边距。文字、点了去哪都不变。 */
.wo-page .wo-summary>.wo-find{position:relative;margin:-6px 0 12px;padding-bottom:10px}
.wo-page .wo-summary>.wo-find::after{content:"";position:absolute;left:0;right:0;bottom:0;height:1px;background:var(--k-line);transform:scaleY(.5);transform-origin:0 100%}
.wo-page .wo-summary>.wo-find .w-link{margin:0;padding:0;height:24px;line-height:24px}
/* 2026-11-18 第四轮精修（按微信实拍评审）
   1) 加载骨架照着真实版式画三块：状态卡（96 高、暖色渐变，标题条 30% 宽）、商品细行（左 64 方块 + 右两条线）、页签条（三段），块间 12；「正在加载订单…」12 号灰字；
   2) 顶部「订阅心愿进展提醒」改成轻量文字链：不要白底，12 号暖棕字靠右放在页面最上面，第一眼落到状态卡。 */
.wo-page>.w-state--loading{margin:8px 12px 0;padding:0;background:transparent}
.wo-skel{gap:12px}
.wo-skel .w-skel__bar{background:var(--k-fill)}
.wo-skel__status{display:flex;flex-direction:column;justify-content:center;gap:10px;height:96px;box-sizing:border-box;padding:0 16px;border-radius:12px;background:linear-gradient(180deg,var(--k-red-soft),var(--k-paper) 72%)}
.wo-skel__status>.wo-skel__label{width:30%;height:22px}
.wo-skel__status>.w-skel__bar{background:var(--k-paper2)}
.wo-skel__goods{display:flex;align-items:center;gap:12px;padding:16px;border-radius:12px;background:var(--k-paper)}
.wo-skel__thumb{flex:0 0 64px;height:64px;border-radius:8px;background:var(--k-fill)}
.wo-skel__lines{flex:1;display:flex;flex-direction:column;gap:12px}
.wo-skel__tabs{display:flex;gap:24px;padding:14px 0;border-radius:0;background:transparent}
.wo-skel__tabs>.w-skel__bar{width:48px;height:16px}
.wo-page>.w-state--loading>text{margin-top:12px;font-size:12px}
.wish-page.wo-page :deep(.subscribe-entry){padding:4px 12px 0}
.wish-page.wo-page :deep(.subscribe-entry button){justify-content:flex-end;min-height:32px;padding:0;background:transparent;border-radius:0}
</style>
