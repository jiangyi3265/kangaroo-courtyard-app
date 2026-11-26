<template>
  <!-- #ifdef MP-WEIXIN -->
  <page-meta :page-style="aiOpen ? 'overflow: hidden' : ''" />
  <!-- page-meta 必须是页面第一个节点：AI袋鼠弹层开着时锁住页面滚动（网页版由弹层自己锁 body） -->
  <!-- #endif -->
  <view class="k-page stay-order" :class="$userSurface">
    <k-topbar :title="s === 3 && ['checked_in','completed'].includes(od.status) ? '退款申请' : titles[s - 1]" back custom-back @back="onBack" />
    <view v-if="orderLoadError || !od.status" class="preview-state card">
      <text>{{ orderLoadError || '正在读取订单…' }}</text>
      <k-button v-if="orderLoadError && orderNo" size="sm" type="outline" @click="load">重新读取订单</k-button>
    </view>
    <template v-else>
    <k-subscribe scenes="order" label="订阅订单与退款提醒" />
    <k-order-mediation order-type="stay" :order-id="od.orderId" />
    <view v-if="(od.selectedActivities || []).length && s === 2" class="selected-activities card">
      <text class="section-title">附选活动</text>
      <view v-for="a in od.selectedActivities" :key="a.activityId" class="selected-activities__row">
        <view @click="go(`${R.activity}?id=${a.activityId}`)"><text>{{ a.title }}</text><text>{{ selectionLabel(a) }}</text></view>
        <k-button v-if="a.status === 'pending' && ['confirmed', 'checked_in'].includes(od.status)" size="sm" type="outline" :disabled="enrolling" @click="enroll(a)">继续报名</k-button>
      </view>
      <text class="selected-activities__note">活动名额以报名结果为准；未完成的选择会保留，可稍后继续。</text>
    </view>
    <view v-if="s === 1" class="group-body k-pad-tab">
      <view class="paid" :class="{ 'paid--chip': !group.name }"><k-icon name="circle-check" :size="28" color="green" /><view><text :class="{ 'sk-bar': !headTitle }">{{ headTitle }}</text><text :class="{ 'sk-bar sk-bar--sub': !headSub }">{{ headSub }}</text></view></view>
      <view class="group-card card" :class="{ 'group-card--noname': !group.name }"><view class="group-title"><text>{{ group.name || '' }}</text><k-chip tone="green"><text>{{ group.open ? '已开通' : '未开通' }}</text></k-chip></view><view v-if="groupMemberCount != null" class="members"><image src="/static/media/order-members.jpg" mode="aspectFit" /><text>群成员　18人</text></view><text class="group-copy">群内提供：入住指引、服务通知、周边推荐、活动通知{{ '\n' }}请文明交流、遵守群规，共同营造舒适的居住环境。</text><view class="divider" /><template v-if="group.qrUrl"><text class="qr-title">群二维码 <text>{{ qrNote }}</text></text><image class="group-qr" :src="absUrl(group.qrUrl)" mode="aspectFit" show-menu-by-longpress /><text class="expire">{{ expireText }}</text><view class="scan-help"><view><text>无法识别二维码？</text><text>长按保存二维码后，在微信中选择{{ '\n' }}“扫一扫”相册识别</text></view><k-button size="md" type="outline" @click="callStore">联系门店</k-button></view></template><!-- 10-16：门店没传群码（或已过期）时只说一句话 + 大一点的「联系门店」，不再显示「门店未设有效期」和「长按保存」（没有码可存，看着像出错了） --><view v-else class="no-qr"><text class="no-qr__text">门店暂未提供住客群，可点「联系门店」</text><k-button size="lg" block icon="phone" @click="callStore">联系门店</k-button></view></view>
      <view class="privacy card"><view><k-icon name="circle-alert" :size="16" color="muted" /><text>隐私提示</text></view><text>因保护住客隐私，群内仅展示昵称，订单信息不公开。{{ '\n' }}请勿泄露他人隐私信息，文明交流。</text></view>
    </view>

    <view v-else-if="s === 2" class="trip-body k-pad-tab"><view class="trip-head card"><image :src="absUrl(stay.cover) || '/static/media/cover-empty.png'" mode="aspectFill" /><view><view><text>{{ stay.stayName || '' }}</text><view class="trip-chip" :class="{ 'is-empty': !od.statusLabel }"><k-chip tone="green"><text>{{ od.statusLabel || '' }}</text></k-chip></view></view><text>订单号　{{ od.orderNo || '' }}</text></view></view><view v-if="orderLinks.length" class="order-links card"><view v-for="l in orderLinks" :key="l.label" class="order-link" :class="{ primary: l.primary }" @click="openLink(l)"><view class="order-link__ic"><k-icon :name="l.icon" :size="22" color="red" /></view><text>{{ l.label }}</text></view></view><view v-if="storeRefunds.length" class="store-refund card"><view class="store-refund__head"><text>{{ storeRefundHead }}</text><text>{{ storeRefundSub }}</text></view><view v-for="(r, i) in storeRefunds" :key="i" class="store-refund__row"><text>{{ r.timeText }}</text><text>¥{{ yuan(r.amountFen) }}　{{ r.reason }}{{ r.processing ? '（退款处理中）' : (r.closed ? '（退款未成功）' : '') }}</text></view></view><view class="timeline card" :class="{ 'timeline--joined': (od.guests || 1) > 1 && !od.checkedOutTime }"><text class="day">{{ od.checkInText || '' }}</text><view class="event"><view class="line red" /><text class="time">{{ od.checkinTime || '' }}</text><view class="event-main"><text>入住</text><view><view class="event-icon"><k-icon name="house" :size="18" color="red" /></view><view><text>{{ stay.typeName || '' }}</text><text>{{ od.nights || 0 }}晚　｜　{{ od.guests || 1 }}人入住</text></view></view></view></view><view v-for="a in firstDayAddons" :key="a.activityId" class="event"><view class="line green" /><text class="time">{{ a.time }}</text><view class="event-main"><text>{{ a.name }}（加购）</text><view><view class="event-icon"><k-icon name="coffee" :size="18" color="red" /></view><view><text>{{ a.title }}</text><text>{{ a.qty }}人参加</text></view></view></view></view><text v-if="otherAddons.length" class="day">入住期间</text><view v-for="a in otherAddons" :key="a.activityId" class="event"><view class="line green" /><text class="time">{{ a.time }}</text><view class="event-main"><text>{{ a.name }}（加购）</text><view><view class="event-icon"><k-icon name="music" :size="18" color="red" /></view><view><text>{{ a.title }}</text><text>{{ a.qty }}人参加</text></view></view></view></view><text class="day">{{ od.checkOutText || '' }}</text><view class="checkout" :class="{ 'checkout--notime': !od.checkoutTime }"><k-icon name="log-out" :size="16" color="muted" /><text>{{ od.checkoutTime || '' }}　{{ od.checkedOutTime ? '原计划退房' : '退房' }}</text></view></view><view v-if="od.checkedOutTime" class="card actual-checkout"><text>实际退房</text><text>{{ String(od.checkedOutTime).replace('T', ' ').slice(0,16) }}</text></view><view v-if="(od.guests || 1) > 1" class="travelers card" :class="{ 'travelers--bare': !companions.length }"><view><k-icon name="users" :size="16" color="muted" /><text>同行者（{{ (od.guests || 1) - 1 }}位）</text></view><view><view v-if="companions.length"><image src="/static/media/order-avatar-1.jpg" mode="aspectFill" /><text>小满同学</text></view><view v-if="companions.length"><image src="/static/media/order-avatar-2.jpg" mode="aspectFill" /><text>阿布在大理</text></view></view></view><view v-if="communityEnabled" class="community card"><view><text>想认识更多同频伙伴？</text><text>发布到社区找搭子，一起体验在地生活</text></view><k-button size="md" type="outline" @click="go(R.publish)">发布到社区</k-button></view></view>

    <stay-after-refund v-else-if="s === 3 && ['checked_in','completed'].includes(od.status)" :order-no="od.orderNo || orderNo" @changed="load" />
    <view v-else-if="s === 3" class="refund-body k-pad-tab"><view class="order-head card"><image :src="absUrl(stay.cover) || '/static/media/cover-empty.png'" mode="aspectFill" /><view><text>{{ stay.stayName || '' }}</text><text>入住：{{ od.checkInText || '' }} {{ od.checkinTime || '' }}（{{ od.nights || 0 }}晚）</text><text>订单号　{{ od.orderNo || '' }}</text></view></view><text class="section-title">取消政策</text><text class="policy-tip">以入住时间为准，订单一经确认即视为同意以下规则</text><view class="policy-table card"><view v-for="row in refundRules" :key="row.label"><text>{{ row.label }}</text><text>{{ row.value }}</text></view></view><view v-if="pv.hoursLeftText" class="remaining"><text>当前距离入住还有 <text>{{ pv.hoursLeftText || '—' }}</text></text><text>适用规则：{{ pv.ruleLabel || '—' }}</text></view><text v-if="od.status === 'confirmed' && od.refundNote" class="reject-note">上次退款申请未通过：{{ od.refundNote }}</text>
      <view v-if="previewError" class="preview-state card"><text>{{ previewError }}</text><k-button size="sm" type="outline" @click="loadPreview">重新试算</k-button></view>
      <view v-else-if="!applied && pv.allowed == null" class="preview-state card"><text>正在试算退款金额…</text></view>
      <view v-if="applied || pv.allowed != null" class="refund-money card"><text class="section-title">退款金额明细</text><view><text>订单实付</text><text>¥{{ yuan(rm.paidFen || 0) }}</text></view><view><text>需扣除（{{ rm.ratePct || 0 }}%）</text><text>- ¥{{ yuan(rm.deductFen || 0) }}</text></view><view v-if="rm.storeFen"><text>{{ storeRefundPending ? '门店退款（含处理中）' : '已退款' }}</text><text>- ¥{{ yuan(rm.storeFen) }}</text></view><view><text>{{ applied ? '退款金额' : '预计退款金额' }}</text><text>¥{{ yuan(rm.refundFen || 0) }}</text></view></view><view v-if="canRefund" class="reason card"><text class="section-title">退款原因 <text>（必选）</text></text><view><view v-for="item in ['行程变动','身体原因','突发事项']" :key="item" @click="reason = item"><k-icon name="circle" :art="reason === item ? 'radio-on' : 'circle'" :size="18" /><text>{{ item }}</text></view></view></view><view class="ask-link" @click="askAssistant"><text>退款规则有疑问？问问AI袋鼠</text><k-icon name="chevron-right" :size="16" color="muted" /></view><k-button v-if="applied || pv.allowed != null" block :disabled="!canRefund || refundSubmitting" :label="refundSubmitting ? '提交中…' : refundBtnText" @click="applyRefund" /><text v-if="canRefund" class="refund-note">提交后由{{ reviewer }}审核，通过后原路退回，到账时间以支付渠道为准</text></view>

    <view v-else class="verify-body k-pad-tab"><view class="verified"><view><k-icon name="circle-check" :size="28" color="green" /><view><text>{{ verified ? '已核销入住成功' : '待到店核销' }}</text><text>{{ verified ? '祝您入住愉快，享受美好时光！' : '请到店向前台出示核销码' }}</text></view></view><image v-if="verified" src="/static/media/order-stamp.jpg" mode="aspectFit" /><text>{{ usedText }}</text></view><view class="verify-card card"><view class="verify-room"><image :src="absUrl(stay.cover) || '/static/media/cover-empty.png'" mode="aspectFill" /><view><text>{{ stay.stayName || '' }}</text><text>{{ od.nights || 0 }}晚　｜　{{ od.guests || 1 }}位入住</text></view></view><text class="section-title">入住人</text><view class="people"><view><image src="/static/media/profile-avatar.jpg" mode="aspectFill" /><text>{{ od.guestName || '' }}　（入住人）</text></view><view v-if="companions.length"><image src="/static/media/order-avatar-2.jpg" mode="aspectFill" /><text>阿布在大理</text></view></view><view v-if="showCode" class="divider" /><text v-if="showCode" class="section-title">核销码 <text>（向前台出示）</text></text><view v-if="showCode" class="barcode" :style="barStyle" /><text v-if="showCode" class="code-num">{{ codeText }}</text><image v-if="showCode && verify.qrDataUri" class="verify-qr" :src="verify.qrDataUri" mode="aspectFit" /><view v-if="showCode" class="refresh" @click="refreshCode"><k-icon name="refresh-cw" :size="16" color="muted" /><text>刷新</text></view><view v-if="showCode" class="valid"><text>有效时间　　{{ verify.validFrom }} - {{ verify.validTo }}</text><text>请在有效时间内到店办理入住</text></view></view><k-button block type="outline" icon="phone" @click="callStore">联系前台</k-button></view>
    </template>
    <k-tabbar active="profile" />
    <!-- 「退款规则有疑问？问问AI袋鼠」：在本页底部弹出，带上这张订单（问「取消要扣多少？」照常出退款试算） -->
    <k-ai-sheet :show="aiOpen" ctx="order" :order-no="aiOrderNo" @close="aiOpen = false" />
  </view>
</template>

<script setup>
import { groupChatEnabled, stayBookingEnabled, refreshFeatures } from '@/common/features.js'
import { communityEnabled } from "@/common/features.js"
// ---------------------------------------------------------------------------
// 旅居订单接入情况（业务键 orderNo，view=group|trip|refund|verify 选屏；按订单状态校验能进哪一屏）：
//   s=1 住客群：门店上传的真实群码（长按识别）；拿不到微信群人数，所以不显示"群成员 N 人"
//   s=2 行程：入住 / 加购 / 退房全部来自订单；不采集同行人身份，同行人头像不显示
//   s=3 取消退款：退款预览按订单下单时快照的取消政策由服务端算；提交后由谁审核看服务端给的 refundReviewer（新角色阶段「平台」，旧阶段「门店」），通过后原路退回
//   s=4 核销码：服务端生成的 10 位码 + 条形码 + 二维码（原型那条 CSS 假条码扫不出任何东西）；可刷新（旧码作废）
// ---------------------------------------------------------------------------
import { absUrl } from '@/common/upload.js'
import StayAfterRefund from './components/stay-after-refund.vue'
import { ref, computed, watch } from 'vue'
import { useScreen, back, go, replace, toast } from '@/common/screen.js'
import { apiStayOrder, apiStayCancelOrder, apiStayRefundPreview, apiStayRefund, apiStayRefreshCode, apiStayEnrollActivity, apiPayStatus } from '@/common/api.js'
import { gated } from '@/common/community.js'
import { errText, confirm, yuan } from '@/common/ui.js'
import R from '@/common/routes.js'

let orderNo = ''
let view = ''
let askedScreen = 0
const s = useScreen(4, { onLoad: (q) => { orderNo = q?.orderNo || ''; view = q?.view || ''; askedScreen = Number(q?.s) || 0; load() } })
watch(s, (v) => { if (v === 3) loadPreview(); else clearPreview() })
watch(groupChatEnabled, enabled => { if(!enabled && s.value===1) s.value=2 })
const titles = ['门店群聊', '我的行程', '取消与退款', '到店扫码核销']
const od = ref({})
const orderLoadError = ref('')
let orderSequence = 0
const enrolling = ref(false)
const selectionLabel = (a) => a.status === 'pending' ? '尚未完成报名' : ({ confirmed: '已报名', waitlist: '候补中', cancelled: '报名已取消', refunded: '已退款' }[a.signupStatus] || '已处理，请查看活动详情')
async function enroll(a) {
  if (enrolling.value) return
  enrolling.value = true
  try {
    const r = await gated(() => apiStayEnrollActivity(orderNo, a.activityId))
    toast(r.data.message || '已处理')
    await load()
  } catch (e) { if (!e?.silent) toast(errText(e, '报名未完成，选择已保留')) }
  finally { enrolling.value = false }
}
const pv = ref({})
const previewError = ref('')
let previewSequence = 0
function clearPreview() {
  previewSequence++
  pv.value = {}
  previewError.value = ''
}
const stay = computed(() => od.value.stay || {})
const group = computed(() => od.value.group || {})
const verify = computed(() => od.value.verify || {})
const verified = computed(() => ['checked_in', 'completed'].includes(od.value.status))
const VIEW_SCREEN = { group: 1, trip: 2, refund: 3, verify: 4 }
const ALLOWED = { confirmed: [1, 2, 3, 4], checked_in: [1, 2, 3, 4], refund_pending: [2, 3], refunding: [2, 3], cancelled: [2, 3], completed: [2, 3], no_show: [2, 3], closed: [2, 3] }
const DEFAULT = { confirmed: 2, checked_in: 4, refund_pending: 3, refunding: 3, cancelled: 3, completed: 2, no_show: 2, closed: 2 }

async function load() {
  const sequence = ++orderSequence
  if (!orderNo) { orderLoadError.value = '订单不存在'; return }
  try {
    const { data } = await apiStayOrder(orderNo)
    if (sequence !== orderSequence) return
    if (!data?.status) throw new Error('未能读取订单详情')
    await refreshFeatures()
    if (sequence !== orderSequence) return
    od.value = data
    orderLoadError.value = ''
  } catch (e) {
    if (sequence === orderSequence) {
      orderLoadError.value = errText(e, '订单加载失败')
      clearPreview()
    }
    return
  }
  const st = od.value.status
  if (st === 'pending_payment' && stayBookingEnabled.value) return replace(R.stayPay + '?orderNo=' + orderNo)
  // 首次进页：view / ?s= 指定的屏，否则按订单状态的默认屏。之前这里先取 s.value，而 useScreen 没带 ?s= 时也是 1，
  // 默认屏从没生效：「我的订单 · 订单详情」一律停在门店群聊。之后重新加载（退款、报名后）留在当前屏
  let want = landing ? s.value : (VIEW_SCREEN[view] || askedScreen || DEFAULT[st] || 2)
  if (!(ALLOWED[st] || [2]).includes(want)) {
    if (view) toast(`订单${od.value.statusLabel}，已为你打开可查看的页面`)
    want = DEFAULT[st] || 2
  }
  if (od.value.memberMode==='nights' && Number(od.value.payFen)===0 && want===3) want=2
  if (want === 1 && !groupChatEnabled.value) want=2
  const refreshPreview = want === 3 && s.value === want
  s.value = want
  if (!landing) landing = want
  if (refreshPreview) await loadPreview()
}
// 订单页四屏之间之前没有互相跳转的入口：进了哪一屏就只能看哪一屏，
// 核销码、取消退款从订单里都点不到（核销码屏只在已入住后才作为默认屏出现）。
// 行程页顶部按订单状态放能去的屏；从这里点进去的屏，左上角返回回到行程页
let landing = 0
const REFUND_SEEN = ['refund_pending', 'refunding', 'cancelled']
const orderLinks = computed(() => {
  const st = od.value.status, allowed = ALLOWED[st] || []
  return [
    od.value.status === 'pending_payment' && { cancelPending:true, icon:'calendar', label:'取消未付款订单' },
    od.value.canCancelFree && { cancelFree:true, icon:'calendar', label:'取消预订，退回间夜' },
    allowed.includes(4) && { s: 4, icon: 'qr-code', label: verified.value ? '核销记录' : '到店核销码', primary: !verified.value },
    groupChatEnabled.value && allowed.includes(1) && { s: 1, icon: 'wechat', label: '门店群' },
    !(od.value.memberMode==='nights' && Number(od.value.payFen)===0) && (['confirmed', 'checked_in', 'completed'].includes(st) || REFUND_SEEN.includes(st)) && { s: 3, icon: 'receipt-text', label: st === 'checked_in' ? '申请提前退房 / 退款' : st === 'completed' ? '申请退款 / 查看进度' : (REFUND_SEEN.includes(st) ? '退款进度' : '取消 / 退款') },
    ['confirmed', 'checked_in'].includes(st) && { icon: 'shopping-bag', label: '增值服务', to: R.stayShop + '?stayOrderNo=' + encodeURIComponent(od.value.orderNo || orderNo) }
  ].filter(Boolean)
})
const openScreen = (n) => { if ((ALLOWED[od.value.status] || []).includes(n)) s.value = n }
// 增值服务（二消）列表页之前在整个小程序里没有入口（只能从收藏 / 订单 / 通知打开某一单），入住期间买不到服务。
// 待入住 / 已入住的单在行程页加「增值服务」，带上这张入住单，服务列表按这家门店展示
let cancelling = false
const openLink = async (link) => {
  if (!link.cancelPending && !link.cancelFree) return link.to ? go(link.to) : openScreen(link.s)
  if (cancelling) return
  cancelling = true
  const isFree = !!link.cancelFree
  const allowed = () => isFree ? od.value.canCancelFree : od.value.status === 'pending_payment'
  try {
    if (!allowed()) return
    const agreed = isFree
      ? await confirm('取消免费间夜预订', '取消后释放房量，未使用间夜退回会员权益。')
      : await confirm('取消订单', '此订单尚未付款，确认取消？')
    if (!agreed || !allowed()) return
    await apiStayCancelOrder(orderNo)
    await load()
  } catch (e) {
    toast(errText(e, '取消失败，请重试'))
  } finally {
    cancelling = false
  }
}
// AI袋鼠的「订单情境」：10-16 起在本页底部弹出（k-ai-sheet），不再跳到客服页；带上订单号，退款试算按这张订单的退订政策算
const aiOpen = ref(false)
const aiOrderNo = ref('')
const askAssistant = () => { aiOrderNo.value = od.value.orderNo || orderNo; aiOpen.value = true }
const onBack = () => { if (landing && s.value !== landing) s.value = landing; else back() }
let paySynced = false
async function loadPreview() {
  clearPreview()
  const sequence = previewSequence
  if (!orderNo || !od.value.status || s.value !== 3 || ['checked_in', 'completed'].includes(od.value.status)) return
  try {
    const { data } = await apiStayRefundPreview(orderNo)
    if (sequence !== previewSequence || s.value !== 3) return
    if (typeof data?.allowed !== 'boolean') throw new Error('未能读取退款试算')
    pv.value = data
  } catch (e) {
    if (sequence === previewSequence && s.value === 3) previewError.value = errText(e, '退款金额未能读取，请重试')
    return
  }
  // 刚付完款就点退款时，微信的支付结果可能还没回到服务器，订单仍是「待支付」，按钮显示不能退款；
  // 之前只能退出重进，现在先主动向微信查一次支付结果，查到已付就自动刷新成可退款
  if (!pv.value.allowed && od.value.status === 'pending_payment' && od.value.payNo && !paySynced) {
    paySynced = true
    try { await apiPayStatus(od.value.payNo) } catch (e) { return }
    if (sequence === previewSequence && s.value === 3) await load()
  }
}

// ---------------- s=1 住客群 ----------------
const HEAD = {
  confirmed: ['订单已支付', '感谢您的预订，请查看行程中的入住指引'], checked_in: ['已入住', '祝您入住愉快'],
  completed: ['订单已完成', '欢迎再来小院'], refund_pending: ['退款审核中', '审核通过后原路退回'],
  refunding: ['退款处理中', '到账时间以支付渠道为准'], cancelled: ['订单已取消', '退款已原路退回'], no_show: ['未到店', '订单已按规则结束'], closed: ['订单已关闭', '超时未支付或已取消']
}
const headTitle = computed(() => (HEAD[od.value.status] || ['', ''])[0])
// 退款由谁审：服务端按角色阶段给（新阶段「平台」），老接口没这个字段时按「门店」
const reviewer = computed(() => od.value.refundReviewer || '门店')
const headSub = computed(() => od.value.status==='cancelled'&&od.value.memberMode==='nights'?'免费间夜已按规则退回会员权益':(od.value.status==='refund_pending'?reviewer.value:'')+(HEAD[od.value.status] || ['', ''])[1])
const groupMemberCount = null // 拿不到微信群人数，不显示
const qrNote = computed(() => (group.value.expire ? `（有效期至 ${group.value.expire}）` : '（门店未设有效期）'))
// 只在有群码时显示（没有群码时整块换成一句提示 + 联系门店）
const expireText = computed(() => (group.value.expire ? '邀请有效期至：' + group.value.expire : '以门店更新为准'))
const callStore = () => {
  const phone = od.value.storePhone
  if (!phone) return toast('门店暂未提供电话')
  uni.makePhoneCall({ phoneNumber: String(phone), fail: () => toast('无法拨号，请手动拨打 ' + phone) })
}

// ---------------- s=2 行程 ----------------
const firstDayAddons = computed(() => [])
const otherAddons = computed(() => [])
const companions = computed(() => [])

// ---------------- s=3 取消退款 ----------------
const refundRules = computed(() => ((od.value.policy || {}).rows || []))
const reason = ref('')
const canRefund = computed(() => !orderLoadError.value && s.value === 3 && od.value.status === 'confirmed' && !!pv.value.allowed)
// 已申请 / 已退款的单按申请时锁定的退款额（od.refundFen）显示。之前一律按"现在"重新试算：审核期间离入住越来越近，
// 页面上的扣款比例和退款金额会和实际申请的对不上
const applied = computed(() => REFUND_SEEN.includes(od.value.status))
// 门店主动退过的钱（旅居订单台，主理人发起）：之前客人页看不到，只会收到一条「退款已原路退回」，
// 订单页金额对不上。现在行程页列出每一笔（金额 + 门店写的原因），退款明细里单列「已退款」：
//   实付 − 需扣除 − 已退款 = 退款金额（服务端预览已按这个口径算）
const storeRefunds = computed(() => (od.value.storeRefunds || []).filter(r => r.kind === 'partial').map(r => ({ ...r, timeText: String(r.time || '').slice(5, 16) })))
const storeRefundTotal = computed(() => Number(od.value.storeRefundFen || 0))
// 门店退款还在处理（微信支付先登记、再由系统提交微信）时不能说「已退」：之前写「已退款 ¥4 原路退回你的微信支付（到账中）」，
// 10-13 微信那边没退出去，客人却以为钱在路上。现在已退成的和处理中的分开写；微信关闭、没退成的不算进金额
const storeRefundPending = computed(() => Number(od.value.storeRefundPendingFen || 0))
const storeRefundHead = computed(() => {
  const pending = storeRefundPending.value, done = storeRefundTotal.value - pending
  if (pending) return done > 0 ? `已退款 ¥${yuan(done)}，另有 ¥${yuan(pending)} 退款处理中` : `退款 ¥${yuan(pending)} 处理中`
  return done > 0 ? `已退款 ¥${yuan(done)}` : '退款未成功'
})
const storeRefundSub = computed(() => (storeRefundPending.value ? '退款成功后原路退回你的微信支付' : (storeRefundTotal.value > 0 ? '原路退回你的微信支付' : '钱没有退出，有疑问请联系门店')))
const rm = computed(() => {
  if (!applied.value) return { ...pv.value, storeFen: Number(pv.value.refundedFen || 0) }
  const paid = Number(od.value.payFen || 0), refund = Number(od.value.refundFen || 0), store = storeRefundTotal.value
  const deduct = Math.max(0, paid - store - refund)
  return { paidFen: paid, refundFen: refund, storeFen: store, deductFen: deduct, ratePct: paid ? Math.round(deduct * 100 / paid) : 0 }
})
const refundBtnText = computed(() => {
  const st = od.value.status
  if (st === 'refund_pending') return '退款审核中'
  if (st === 'refunding') return '退款处理中'
  if (st === 'cancelled') return `已退款 ¥${yuan(od.value.refundFen || 0)}`
  if (pv.value.allowed) return `确认退款　¥${yuan(pv.value.refundFen || 0)}`
  // 按钮置灰后点不动，之前只写"当前不支持退款"，看不到原因（服务端在 reason 里给了：订单状态 / 时段）
  return pv.value.reason || '当前不支持退款'
})
// 提交退款要等服务端返回：连点会弹两次确认、发两次申请，处理中先锁住按钮
const refundSubmitting = ref(false)
async function applyRefund() {
  if (refundSubmitting.value) return
  if (!canRefund.value) return toast(pv.value.reason || '当前不支持退款')
  if (!reason.value) return toast('请选择退款原因')
  refundSubmitting.value = true
  const refundFen = pv.value.refundFen
  const refundReason = reason.value
  try {
    if (!(await confirm('申请退款', `按取消政策预计退款 ¥${yuan(refundFen)}，提交后由${reviewer.value}审核。确认申请？`))) return
    if (!canRefund.value || pv.value.refundFen !== refundFen) return toast('退款试算已变化，请核对后重新确认')
    const res = await apiStayRefund(orderNo, refundReason, refundFen)
    toast(res.msg || '退款申请已提交')
    await load()
  } catch (e) {
    if (e && e.code === 409) loadPreview()
    toast(errText(e, '提交失败'))
  } finally {
    refundSubmitting.value = false
  }
}

// ---------------- s=4 核销码 ----------------
const codeText = computed(() => String(verify.value.code || '').replace(/(\d{4})(?=\d)/g, '$1 '))
const showCode = computed(() => !verified.value && !!verify.value.code)
const barStyle = computed(() => (verify.value.barDataUri ? { background: `url(${verify.value.barDataUri}) center/contain no-repeat #fff` } : {}))
const usedText = computed(() => (verified.value ? '核销时间：' + String(verify.value.usedTime || od.value.verifyTime || '').slice(0, 16) : '尚未核销'))
let refreshing = false
async function refreshCode() {
  if (refreshing) return
  refreshing = true
  try {
    if (!(await confirm('刷新核销码', '刷新后旧码立即作废，确认刷新？'))) return
    od.value = (await apiStayRefreshCode(orderNo)).data || od.value
    toast('核销码已刷新')
  } catch (e) {
    toast(errText(e, '刷新失败'))
  } finally {
    refreshing = false
  }
}
</script>

<style scoped lang="scss">
.preview-state{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:16px;color:var(--k-ink2)}
.actual-checkout{display:flex;justify-content:space-between;gap:12px;padding:18px;margin-top:12px;font-size:14px;color:var(--k-ink)}
.selected-activities { margin: 10px 14px 0; padding: 0 12px 12px; }
.selected-activities__row { display: flex; align-items: center; justify-content: space-between; padding: 9px 0; gap: 12px; }
.selected-activities__row>view { display: flex; flex-direction: column; gap: 4px; }
.selected-activities__row>view>text:last-child,.selected-activities__note { font-size: 12px; color: var(--k-muted); }
/* 10-19 字体复查：--k-serif 现在是只有粗体的标题字体，整页挂着正文也变粗 —— 整页用系统黑体，标题单独用标题字体 */.stay-order { font-family: var(--k-sans); }.paid>view text:first-child,.group-title>text,.qr-title,.trip-head>view>view>text,.day,.event-main>text,.order-head>view text:first-child,.section-title,.verified>view>view text:first-child,.verify-room>view text:first-child,.store-refund__head>text:first-child { font-family: var(--k-display-font); }.group-body,.trip-body,.refund-body,.verify-body { padding: 10px 14px calc(92px + var(--k-safe-bottom)); }.card,.paid,.verified { border: 1px solid var(--k-line); border-radius: 12px; background: rgba(253,251,247,.8); }.paid { height: 70px; display: flex; align-items: center; justify-content: center; gap: 13px; }.paid>view { display: flex; flex-direction: column; }.paid>view text:first-child { font-size: 20px; font-weight: 700; }.paid>view text:last-child { color: var(--k-muted); font-size: 12px; }.group-card { margin-top: 10px; padding: 15px; }.group-title { display: flex; justify-content: space-between; align-items: center; }.group-title>text { font-size: 19px; font-weight: 700; }.members { margin-top: 11px; display: flex; align-items: center; gap: 12px; }.members image { width: 120px; height: 26px; }.members text { font-weight: 700; }.group-copy { display: block; margin-top: 10px; color: var(--k-muted); font-size: 12px; line-height: 1.8; }.divider { height: 1px; margin: 9px 0; background: var(--k-line); }.qr-title { display: block; font-size: 16px; font-weight: 700; }.qr-title>text { color: var(--k-muted); font-size: 12px; font-weight: 400; }.group-qr { width: 145px; height: 145px; margin: 7px auto; }.expire { display: block; text-align: center; color: var(--k-muted); font-size: 11px; }.scan-help { margin-top: 10px; padding: 10px; border: 1px solid var(--k-line); border-radius: 9px; display: flex; align-items: center; }.scan-help>view { flex: 1; display: flex; flex-direction: column; }.scan-help>view text:first-child { font-weight: 700; }.scan-help>view text:last-child { color: var(--k-muted); font-size: 11px; }.privacy { margin-top: 10px; padding: 12px; }.privacy>view { display: flex; align-items: center; gap: 7px; font-weight: 700; }.privacy>text { display: block; margin-top: 7px; color: var(--k-muted); font-size: 11px; line-height: 1.7; }
.trip-head { min-height: 79px; padding: 8px; display: flex; }.trip-head>image { width: 76px; height: 61px; border-radius: 8px; }.trip-head>view { flex: 1; padding: 4px 0 0 13px; }.trip-head>view>view { display: flex; justify-content: space-between; align-items: center; }.trip-head>view>view>text { font-size: 17px; font-weight: 700; }.trip-head>view>text { display: block; margin-top: 8px; color: var(--k-muted); font-size: 12px; }.order-links { margin-top: 10px; padding: 10px 4px; display: flex; }.order-link { flex: 1; min-width: 0; display: flex; flex-direction: column; align-items: center; gap: 6px; font-size: 13px; font-weight: 700; }.order-link + .order-link { border-left: 1px solid var(--k-line); }.order-link.primary { color: var(--k-red); }.timeline { margin-top: 10px; padding: 12px 16px; }.day { display: block; margin: 3px 0 7px; font-size: 17px; font-weight: 700; }.event { position: relative; min-height: 104px; display: grid; grid-template-columns: 28px 50px 1fr; }.line { position: relative; width: 2px; height: 100%; margin-left: 7px; background: var(--k-line2); }.line::before { content:''; position: absolute; left: -5px; top: 9px; width: 10px; height: 10px; border-radius: 50%; background: var(--k-green); border: 2px solid var(--k-paper); }.line.red::before { background: var(--k-red); }.time { padding-top: 6px; font-size: 14px; }.event-main>text { display: block; padding-top: 5px; font-size: 15px; font-weight: 700; }.event-main>view { display: flex; align-items: center; margin-top: 9px; }.event-icon { width: 42px; height: 42px; margin-right: 12px; border: 1px solid var(--k-line); border-radius: 50%; display: flex; align-items: center; justify-content: center; }.event-main>view>view:last-child { display: flex; flex-direction: column; }.event-main>view>view:last-child text:first-child { font-weight: 700; }.event-main>view>view:last-child text:last-child { color: var(--k-muted); font-size: 11px; }.checkout { height: 38px; display: flex; align-items: center; gap: 14px; font-size: 15px; }.travelers { margin-top: 10px; padding: 10px 12px; }.travelers>view:first-child { display: flex; justify-content: space-between; font-weight: 700; }.travelers>view:last-child { margin-top: 9px; display: flex; gap: 38px; }.travelers>view:last-child>view { display: flex; align-items: center; gap: 8px; }.travelers image { width: 36px; height: 36px; border-radius: 50%; }.community { margin-top: 10px; padding: 10px 12px; display: flex; align-items: center; }.community>view { flex: 1; display: flex; flex-direction: column; }.community>view text:first-child { font-weight: 700; }.community>view text:last-child { color: var(--k-muted); font-size: 11px; }
.order-head { height: 89px; padding: 9px; display: flex; }.order-head image { width: 91px; height: 69px; border-radius: 8px; }.order-head>view { padding: 5px 0 0 13px; display: flex; flex-direction: column; gap: 5px; }.order-head>view text:first-child { font-size: 16px; font-weight: 700; }.order-head>view text:not(:first-child) { color: var(--k-muted); font-size: 11px; }.section-title { display: block; margin: 12px 4px 5px; font-size: 17px; font-weight: 700; }.policy-tip { display: block; margin: 0 4px 7px; color: var(--k-muted); font-size: 11px; }.policy-table { padding: 0 12px; }.policy-table>view { height: 35px; border-bottom: 1px solid var(--k-line); display: flex; align-items: center; justify-content: space-between; font-size: 13px; }.policy-table>view:last-child { border-bottom: 0; }.remaining { height: 38px; margin-top: 8px; padding: 0 12px; border: 1px solid var(--k-line); border-radius: 9px; display: flex; align-items: center; justify-content: space-between; font-size: 11px; }.remaining>text:first-child>text { color: var(--k-red); font-weight: 700; }.refund-money { margin-top: 10px; padding: 7px 12px; }.refund-money>.section-title { margin: 0 0 5px; }.refund-money>view { height: 28px; display: flex; justify-content: space-between; }.refund-money>view:last-child { height: 42px; align-items: center; border-top: 1px solid var(--k-line); font-size: 16px; }.refund-money>view:last-child text:last-child { color: var(--k-red); font: 700 27px var(--k-sans); }.reason { margin: 10px 0 14px; padding: 8px 12px; }.reason>.section-title { margin: 0; }.reason>.section-title>text { color: var(--k-muted); font-size: 11px; }.reason>view { display: grid; grid-template-columns: 1fr 1fr; gap: 9px; margin-top: 10px; }.reason>view>view { display: flex; align-items: center; gap: 8px; }.radio { width: 18px; height: 18px; border: 1px solid var(--k-line2); border-radius: 50%; }.refund-note { display: block; margin-top: 8px; text-align: center; color: var(--k-muted); font-size: 11px; }
.verified { position: relative; height: 94px; padding: 12px 14px; background: var(--k-green-soft); }.verified>view { display: flex; align-items: center; gap: 10px; }.verified>view>view { display: flex; flex-direction: column; }.verified>view>view text:first-child { color: var(--k-green); font-size: 19px; font-weight: 700; }.verified>view>view text:last-child { color: var(--k-ink2); font-size: 11px; }.verified>image { position: absolute; right: 13px; top: 4px; width: 86px; height: 72px; mix-blend-mode: darken; } /* 印章图的底色就是 --k-green-soft：darken 逐通道取较深的颜色，底色叠底色不变（multiply 会叠深成一块方框），压到字时字照样看得见 */.verified>text { position: absolute; right: 14px; bottom: 8px; color: var(--k-green); font-size: 10px; }.verify-card { margin-top: 10px; padding: 10px 12px; }.verify-room { display: flex; align-items: center; }.verify-room>image { width: 98px; height: 69px; border-radius: 8px; }.verify-room>view { margin-left: 14px; display: flex; flex-direction: column; }.verify-room>view text:first-child { font-size: 17px; font-weight: 700; }.verify-room>view text:last-child { margin-top: 8px; color: var(--k-muted); }.verify-card>.section-title { margin: 11px 0 6px; }.verify-card>.section-title>text { color: var(--k-muted); font-size: 11px; }.people { display: flex; gap: 23px; }.people>view { display: flex; align-items: center; gap: 7px; font-size: 12px; }.people image { width: 36px; height: 36px; border-radius: 50%; }.barcode { width: 250px; height: 55px; margin: 5px auto 0; background: repeating-linear-gradient(90deg,#111 0 3px,var(--k-paper) 3px 6px,#111 6px 8px,var(--k-paper) 8px 11px); }.code-num { display: block; text-align: center; font: 17px var(--k-sans); letter-spacing: 4px; }.verify-qr { width: 132px; height: 132px; margin: 6px auto 0; }.refresh { width: 53px; margin: -26px 40px 4px auto; display: flex; align-items: center; gap: 4px; color: var(--k-muted); font-size: 11px; }.valid { display: flex; flex-direction: column; align-items: center; color: var(--k-muted); font-size: 11px; }.verify-body>.k-button { margin-top: 12px; }
.group-copy,.scan-help>view text:last-child,.privacy>text { white-space: pre-line; }
.no-qr { padding: 6px 0 2px; display: flex; flex-direction: column; gap: 12px; }.no-qr__text { text-align: center; color: var(--k-ink2); font-size: 14px; line-height: 1.6; }
.trip-body .event { min-height: 82px; }
.refund-body>.k-button { position: fixed; left: 14px; right: 14px; bottom: calc(100px + var(--k-safe-bottom)); z-index: 45; }
/* 退款按钮和说明是 fixed 的，垫在一条白色底部操作条里（距底 50–152px，见下面 .refund-body::after）；内容底部留 164px，滚到底时「退款原因」整张卡露在操作条上面 */
.refund-body { padding-bottom: calc(164px + var(--k-safe-bottom)); }
/* 已核销横幅：屏宽 ≤340 时副标题「…享受美好时光！」伸到印章下面（印章左边是 屏宽−114），印章缩小、往右靠，给文字让出位置 */
@media (max-width: 350px) { .verified>image { right: 8px; width: 64px; height: 54px; } }
.ask-link { display: flex; align-items: center; justify-content: center; gap: 2px; min-height: 40px; color: var(--k-muted); font-size: 13px; }
.store-refund { margin-top: 10px; padding: 10px 12px; }.store-refund__head { display: flex; align-items: baseline; justify-content: space-between; gap: 10px; }.store-refund__head>text:first-child { color: var(--k-red); font-size: 16px; font-weight: 700; }.store-refund__head>text:last-child { color: var(--k-muted); font-size: 11px; }.store-refund__row { display: flex; gap: 10px; margin-top: 6px; font-size: 12px; line-height: 1.6; }.store-refund__row>text:first-child { flex-shrink: 0; color: var(--k-muted); }.store-refund__row>text:last-child { overflow-wrap: anywhere; }
.reject-note { display: block; margin: 8px 4px 0; color: var(--k-alert); font-size: 12px; line-height: 1.6; }
/* 房源名太长时一行省略：这几张卡片是固定高度，换行会把订单号挤出卡片 */
.trip-head>view, .order-head>view, .verify-room>view { flex: 1; min-width: 0; }
.trip-head>view>view>text, .order-head>view text:first-child, .verify-room>view text:first-child { min-width: 0; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
.reason>view>view { min-height: 36px; }
.refund-body>.refund-note { position: fixed; left: 12px; right: 12px; bottom: calc(80px + var(--k-safe-bottom)); z-index: 45; margin-top: 0; line-height: 16px; } /* 底栏「发布」圆钮（连阴影）凸到距底约 72px，说明文字从 80px 起，不被圆钮顶到 */
/* 订单四种状态统一为同一套旅居信息卡；状态、核销和退款函数不变。 */
@import './stays-premium.scss';
.stay-order { @include stays-surface; background: linear-gradient(150deg,#F7EEE3,#FDFAF5 450px); }
.card,.paid,.verified { background: white; border: 1px solid rgba(182,150,116,.14); border-radius: 14px; box-shadow: 0 3px 8px rgba(86,56,31,.06); }
.paid { height: auto; min-height: 84px; padding: 14px; justify-content: flex-start; background: #F1F7ED; }
.paid>view { min-width: 0; gap: 5px; }
.paid>view text:first-child { color: #3C6544; }
.paid>view text:last-child { font-size: 12px; line-height: 1.6; }
.group-copy { font-size: 12px; line-height: 1.8; }
.group-title { gap: 9px; }
.group-title>text { min-width: 0; font-size: 18px; }
.no-qr { padding-top: 12px; }
.privacy { background: #F8F3EB; box-shadow: none; }
.trip-head { padding: 12px; gap: 12px; align-items: center; }
.trip-head>image { width: 84px; height: 84px; border-radius: 10px; }
.trip-head>view { padding: 0; }
.trip-head>view>view { flex-wrap: wrap; justify-content: flex-start; gap: 6px; }
.trip-head>view>view>text { font-size: 18px; white-space: normal; }
.trip-head>view>text { font-size: 10px; overflow-wrap: anywhere; }
.order-links { margin-top: 12px; padding: 14px 4px; }
.order-link { font-size: 11px; font-weight: 500; gap: 8px; }
.order-link.primary { color: #87542F; }
.timeline { margin-top: 12px; padding: 16px; }
.day { font-size: 19px; color: #654329; }
.event { margin-top: 8px; grid-template-columns: 22px 48px minmax(0,1fr); }
.event-icon { background: #FBF3E8; border-color: #F0E2D0; border-radius: 10px; }
.event-main>view>view:last-child { min-width: 0; }
.event-main>view>view:last-child text:first-child { font-size: 14px; }
.checkout { border-top: 1px solid #EEE5DA; margin-top: 8px; padding-top: 10px; }
.community { gap: 10px; background: #FCF4E7; }
.community>view { gap: 5px; min-width: 0; }
.community>view text:first-child { font-size: 14px; }
.community>view text:last-child { line-height: 1.6; }
.order-head { height: auto; min-height: 92px; padding: 12px; align-items: center; }
.order-head>view { min-width: 0; gap: 5px; padding-top: 0; }
.order-head>view text:first-child { white-space: normal; }
.order-head>view text:not(:first-child) { font-size: 10px; overflow-wrap: anywhere; }
.remaining { height: auto; min-height: 44px; padding: 8px 12px; flex-wrap: wrap; gap: 5px; background: #FBF1E2; border-color: #EED9BD; }
.policy-table>view { min-height: 40px; height: auto; padding: 6px 0; gap: 10px; font-size: 12px; }
.refund-money { padding: 12px; }
.refund-money>view { align-items: center; min-height: 32px; font-size: 13px; }
.refund-money>view:last-child { min-height: 44px; }
.reason { padding: 12px; }
.reason>view>view { font-size: 13px; min-height: 40px; }
.verified { height: auto; min-height: 96px; padding: 16px 14px; background: #F1F7ED; }
.verify-card { padding: 14px; }
.verify-room>image { width: 87px; height: 75px; }
.verify-room>view text:first-child { white-space: normal; font-size: 17px; }
.verify-room>view text:last-child { font-size: 12px; }
.barcode { max-width: 100%; }
.code-num { margin-top: 7px; font-size: 20px; letter-spacing: 3px; }
.stay-order :deep(.k-button) { border-radius: 999px; }
@media(max-width:359px) { .trip-head>image { width: 72px; height: 72px; } .trip-head>view>view>text { font-size: 16px; } .order-link { font-size: 10px; } .community { align-items: flex-start; flex-wrap: wrap; } }

/* 2026-11-17 改版「小而精」（主人按样张第三版拍板）：浅灰底 + 纯白卡（12 圆角），卡片不加阴影、不描边；标题换回系统黑体、收小一档，主按钮是 44 高的暖棕胶囊。
   只改样子：订单状态、金额、取消政策、退款明细、核销码这些文字和所有操作都没动。上面几轮的规则保留不动，这里统一用 .stay-order 开头的规则盖过去。 */
.stay-order { @include stays-fine; }
.stay-order .paid>view text:first-child, .stay-order .group-title>text, .stay-order .qr-title, .stay-order .trip-head>view>view>text, .stay-order .day, .stay-order .event-main>text, .stay-order .order-head>view text:first-child, .stay-order .section-title, .stay-order .verified>view>view text:first-child, .stay-order .verify-room>view text:first-child, .stay-order .store-refund__head>text:first-child { font-family: var(--k-sans); }
.stay-order .group-body, .stay-order .trip-body, .stay-order .refund-body, .stay-order .verify-body { padding-top: 8px; padding-left: 12px; padding-right: 12px; }
.stay-order .card, .stay-order .paid, .stay-order .verified { border: 0; border-radius: 12px; background: var(--k-paper); box-shadow: none; }
.stay-order .paid, .stay-order .verified { background: var(--k-green-soft); }
.stay-order :deep(.k-button.is-lg) { height: 44px; font-size: 15px; }
.stay-order :deep(.k-button.is-primary) { background: linear-gradient(135deg,#B5814D,#8E5E33); box-shadow: none; }
.stay-order .selected-activities { margin: 8px 12px 0; }
.stay-order .section-title { color: var(--k-ink); font-size: 15px; font-weight: 700; line-height: 21px; }
/* 住客群 */
.stay-order .paid { min-height: 68px; padding: 12px; gap: 10px; }

.stay-order .paid>view text:first-child { color: var(--k-green); font-size: 16px; font-weight: 700; line-height: 22px; }
.stay-order .paid>view text:last-child { color: var(--k-ink2); font-size: 11px; line-height: 16px; }
.stay-order .group-card { margin-top: 8px; padding: 12px; }
.stay-order .group-title>text { font-size: 15px; font-weight: 700; }
.stay-order .group-copy { font-size: 12px; line-height: 19px; }
.stay-order .qr-title { font-size: 14px; font-weight: 600; }
.stay-order .scan-help { border: 0; border-radius: 8px; background: var(--k-page); }
.stay-order .privacy { margin-top: 8px; background: var(--k-paper); }
.stay-order .privacy>view { font-size: 13px; font-weight: 600; }

/* 我的行程 */
.stay-order .trip-head { padding: 10px; gap: 10px; }
.stay-order .trip-head>image { width: 72px; height: 72px; border-radius: 8px; }
.stay-order .trip-head>view>view>text { font-size: 15px; font-weight: 600; line-height: 21px; }
.stay-order .trip-head>view>text { margin-top: 4px; font-size: 11px; }
.stay-order .order-links { margin-top: 8px; padding: 12px 4px; }
.stay-order .order-link { gap: 6px; color: var(--k-ink2); font-size: 12px; }
.stay-order .order-link + .order-link { border-left-color: var(--k-line); }
.stay-order .order-link.primary { color: var(--k-red-deep); font-weight: 600; }

.stay-order .store-refund { margin-top: 8px; padding: 12px; }
.stay-order .store-refund__head>text:first-child { color: var(--k-red-deep); font-size: 14px; font-weight: 600; }
.stay-order .timeline { margin-top: 8px; padding: 12px; }
.stay-order .day { color: var(--k-ink); font-size: 15px; font-weight: 700; line-height: 21px; }
.stay-order .time { font-size: 13px; }
.stay-order .event-main>text { font-size: 14px; font-weight: 600; }
.stay-order .event-icon { width: 36px; height: 36px; margin-right: 10px; border: 0; border-radius: 12px; background: linear-gradient(145deg,#FCF4E8,#F4E4CC); }

.stay-order .event-main>view>view:last-child text:first-child { font-size: 13px; font-weight: 600; }
/* 复查：分隔线原来画在「离店日期」和「退房」之间，看着像日期属于上面那一段 —— 改成画在每个日期标题的上面（第一个除外），一段一段分开 */
.stay-order .timeline .day ~ .day { margin-top: 12px; padding-top: 12px; border-top: 1px solid var(--k-line); }
.stay-order .checkout { margin-top: 0; padding-top: 0; border-top: 0; font-size: 14px; }

.stay-order .actual-checkout { margin-top: 8px; padding: 12px; font-size: 13px; }
.stay-order .travelers { margin-top: 8px; padding: 12px; }
.stay-order .community { margin-top: 8px; padding: 12px; background: #FFF8EE; }
.stay-order .community>view text:first-child { font-size: 14px; font-weight: 600; }
/* 取消与退款 */
.stay-order .order-head { padding: 10px; }
.stay-order .order-head image { width: 72px; height: 72px; border-radius: 8px; }
.stay-order .order-head>view { padding-left: 10px; gap: 3px; }
.stay-order .order-head>view text:first-child { font-size: 15px; font-weight: 600; line-height: 21px; }
.stay-order .order-head>view text:not(:first-child) { font-size: 11px; }
.stay-order .policy-table>view { border-bottom-color: var(--k-line); }
.stay-order .remaining { border: 0; border-radius: 8px; background: #FFF8EE; }
.stay-order .remaining>text:first-child>text { color: var(--k-red-deep); }
.stay-order .refund-money { margin-top: 8px; }
.stay-order .refund-money>view:last-child { border-top-color: var(--k-line); font-size: 14px; }
.stay-order .refund-money>view:last-child text:last-child { color: var(--k-red-deep); font: 700 20px var(--k-sans); }
.stay-order .reason { margin: 8px 0 12px; }
.stay-order .radio { width: 16px; height: 16px; }
.stay-order .ask-link { font-size: 12px; }
.stay-order .refund-body>.k-button { left: 12px; right: 12px; width: auto; } /* 复查：按钮自带「宽 100%」，又从左边 12px 起，右头一直伸到屏幕外面被切掉；改成两边各留 12px */
/* 复查：退款按钮和它下面那句说明是浮在页面上的，往上滑时「退款原因」的字会从按钮后面透出来、和说明叠在一起 —— 在它们后面垫一层底。
   2026-11-18 第三轮修真毛病：原来垫的是一层渐变遮罩，第一屏「退款原因」卡的下半截被雾掉，看着像页面被截断 ——
   改成全站统一的底部操作条：白底 + 顶上一道发丝线、不加阴影，从底栏上沿（50px）一直到按钮上方 8px；点在条上的空白处不会点到被盖住的内容。 */
.stay-order .refund-body::after { content: ''; position: fixed; left: 0; right: 0; bottom: calc(50px + var(--k-safe-bottom)); z-index: 44; height: 102px; background: var(--k-paper); box-shadow: 0 -.5px 0 rgba(58,50,43,.12); }
/* 入住核销 */
.stay-order .verified { min-height: 84px; padding: 12px; }

.stay-order .verified>view>view text:first-child { color: var(--k-green); font-size: 16px; font-weight: 700; line-height: 22px; }
.stay-order .verify-card { margin-top: 8px; padding: 12px; }
.stay-order .verify-room>image { width: 72px; height: 72px; border-radius: 8px; }
.stay-order .verify-room>view { margin-left: 10px; }
.stay-order .verify-room>view text:first-child { font-size: 15px; font-weight: 600; line-height: 21px; }
.stay-order .verify-room>view text:last-child { margin-top: 4px; font-size: 12px; }
.stay-order .divider { background: var(--k-line); }
/* 复查：核销码是给前台看的，保持原来的 20 号字（不收小），「刷新」也才能和数字对齐；有效时间和数字之间留一点空 */
/* 「刷新」原来用负的外边距硬挪到数字右边，窄屏上压住数字最后两位（有二维码时还会压到二维码）—— 改成单独一行居中，可点范围也大一点 */
.stay-order .refresh { width: 96px; min-height: 32px; margin: 2px auto 0; justify-content: center; font-size: 12px; }
.stay-order .valid { margin-top: 2px; }
/* 2026-11-18 看图复查：屏幕右边贴着「客服」小钮（宽 28），这一页内容短、滑不开 —— 退款明细三行金额整体往左收 20，「预计退款金额」不再被压住；
   行程页的「发布到社区」改成和别处一样的 28 高小号次按钮（白底细棕边、棕字、常规字重），右边也让开小钮。 */
/* 2026-11-18 第三轮：原来只把三行金额往左收 20，上面那道分隔线却拉满整宽，金额和线对不齐 —— 改成整张卡右边多留 20（标题、金额、分隔线一起收），右边缘齐了，照样让开「客服」小钮 */
.stay-order .refund-money { padding-right: 32px; }
.stay-order .community :deep(.k-button) { height: 28px; margin-right: 8px; padding: 0 12px; border-color: var(--k-red-line); color: var(--k-red-deep); font-size: 12px; font-weight: 400; }
/* 2026-11-18 第二轮精修：「取消政策」这类卡外的区块标题 16 / 700、上 16 下 8，和下面白卡的左边缘对齐（原来缩进 4px）；卡里的「附选活动」也贴齐卡内边距；
   「联系前台 / 联系门店」等描边钮用暖棕细边 + 深棕字（和全站次按钮一致）。 */
.stay-order .refund-body>.section-title { margin: 16px 0 8px; font-size: 16px; line-height: 22px; }
.stay-order .policy-tip { margin: 0 0 8px; }
.stay-order .selected-activities>.section-title { margin: 12px 0 4px; }
.stay-order :deep(.k-button.is-outline) { border-color: var(--k-red-line); color: var(--k-red-deep); }
@media (max-width: 359px) {
  .stay-order .trip-head>view>view>text { font-size: 14px; }
  .stay-order .order-link { font-size: 11px; }
}
/* 2026-11-18 第三轮逐页精修：
   · 门店群聊：顶上「订单已支付」从整块浅绿底改成白卡 + 绿色对勾（大面积色块只留给照片和主按钮）；卡里「联系门店」收成 40 高、14 / 600，说明 13；
   · 我的行程：四个入口统一成 40 浅棕方块 + 22 号暖棕线稿；时间轴时间列 48→40，图标方块 36 + 18 号暖棕线稿；
   · 取消与退款：「取消政策」标题、说明、规则表、距离入住还有几小时合成一张白卡（之前标题在卡外、表在卡里）；白色底部操作条保留；
   · 入住核销：「尚未核销」做成标题右上的绿色小标签。区块之间统一 12。 */
.stay-order .paid { min-height: 0; padding: 14px 12px; gap: 12px; background: var(--k-paper); }

.stay-order .paid>view text:first-child { color: var(--k-ink); }
.stay-order .paid>view text:last-child { margin-top: 2px; color: var(--k-muted); font-size: 12px; line-height: 17px; }
.stay-order .group-card, .stay-order .privacy { margin-top: 12px; padding: 14px 12px; }
.stay-order .group-title>text { font-size: 16px; line-height: 22px; }
.stay-order .group-copy { margin-top: 8px; color: var(--k-ink2); font-size: 13px; line-height: 20px; }
.stay-order .no-qr { padding-top: 12px; gap: 12px; }
.stay-order .no-qr__text { color: var(--k-ink2); font-size: 13px; line-height: 20px; }
.stay-order .no-qr :deep(.k-button) { height: 40px; min-height: 40px; border-radius: 20px; font-size: 14px; font-weight: 600; box-shadow: none; }
.stay-order .trip-head, .stay-order .order-head { padding: 12px; gap: 12px; }
.stay-order .order-links { margin-top: 12px; padding: 14px 4px 12px; }
.stay-order .order-link { gap: 8px; font-size: 12px; font-weight: 400; }
.stay-order .order-link + .order-link { border-left-color: transparent; }
.stay-order .order-link.primary { font-weight: 500; }
.stay-order .order-link__ic { width: 40px; height: 40px; border-radius: 12px; background: var(--k-red-soft); display: flex; align-items: center; justify-content: center; }

.stay-order .timeline, .stay-order .travelers, .stay-order .community, .stay-order .store-refund, .stay-order .actual-checkout { margin-top: 12px; padding: 14px 12px; }
.stay-order .event { grid-template-columns: 16px 40px minmax(0,1fr); }
.stay-order .event-icon { background: var(--k-red-soft); }
.stay-order .timeline .day ~ .day { border-top: 0; background: linear-gradient(var(--k-line), var(--k-line)) top / 100% 1px no-repeat; }
/* 取消政策合成一张白卡 */
.stay-order .refund-body>.section-title { margin: 12px 0 0; padding: 14px 12px 0; border-radius: 12px 12px 0 0; background: var(--k-paper); }
.stay-order .policy-tip { margin: 0; padding: 4px 12px 8px; background: var(--k-paper); color: var(--k-muted); font-size: 12px; line-height: 17px; }
.stay-order .policy-table { margin: 0; padding: 0 12px; border-radius: 0; }
.stay-order .policy-table>view { min-height: 40px; font-size: 13px; }
.stay-order .policy-table>view text:first-child { color: var(--k-ink2); }
.stay-order .policy-table>view text:last-child { color: var(--k-ink); font-weight: 500; }
.stay-order .remaining { margin: 0; padding: 4px 12px 14px; border-radius: 0 0 12px 12px; background: var(--k-paper); color: var(--k-muted); font-size: 12px; }
.stay-order .refund-money, .stay-order .reason { margin-top: 12px; }
.stay-order .refund-money>view text:last-child { font-variant-numeric: tabular-nums; }
/* 入住核销 */
.stay-order .verified>view>view text:first-child { color: var(--k-ink); }
.stay-order .verified>view>view text:last-child { margin-top: 2px; color: var(--k-muted); font-size: 12px; }
.stay-order .verified>text { top: 14px; right: 12px; bottom: auto; height: 17px; padding: 0 5px; border-radius: 4px; background: var(--k-paper); color: var(--k-green); font-size: 10px; font-weight: 500; line-height: 17px; }
.stay-order .verified>text:empty { display: none; }
.stay-order .verify-card { margin-top: 12px; padding: 14px 12px; }
/* 2026-11-18 第三轮返修（独立评审第 1 轮）：
   · 门店没传群码时「已开通」标签用灰色（文字和显示条件不动），不再和「门店暂未提供住客群」打架；
   · 我的行程：入住 / 加购 / 退房同一套列 —— 16 图标或圆点、间隔 8、时间 40 列 13 / 500 等宽、事件 14 / 600；日期 15 / 600；
   · 「7晚 ｜ 2人入住」整行暖灰，竖线不再是暖棕；
   · 同行者只有一行时并到行程卡底部，作为卡里最后一行（发丝线隔开），不再单独一张只有标题的白卡。 */
.stay-order .day { font-weight: 600; }
.stay-order .event { grid-template-columns: 16px 40px minmax(0, 1fr); column-gap: 8px; }
.stay-order .time { font-size: 13px; font-weight: 500; font-variant-numeric: tabular-nums; }
.stay-order .event-main>view>view:last-child text:last-child { color: var(--k-muted); }
.stay-order .checkout { display: flex; align-items: center; gap: 8px; font-size: 13px; font-weight: 500; font-variant-numeric: tabular-nums; }
.stay-order .timeline + .travelers { position: relative; margin-top: 0; padding: 12px; border-radius: 0 0 12px 12px; }
.stay-order .timeline.timeline--joined { border-radius: 12px 12px 0 0; }
.stay-order .timeline + .travelers::before { content: ''; position: absolute; left: 12px; right: 12px; top: 0; height: 1px; background: var(--k-line); transform: scaleY(.5); }
.stay-order .travelers>view:first-child text { color: var(--k-ink2); font-size: 14px; font-weight: 500; }
/* 11-18 第三轮返修（独立评审第 2 轮）：320 宽时退款说明会折成两行、往上长到按钮底边 —— 小屏把按钮抬到距底 120、白色操作条加高到 122，
   说明两行（80–112）和按钮之间留 8；说明左右各收 36，两行长度差不多，不剩「为准」两个字单独一行 */
@media (max-width: 359px) {
  .stay-order .refund-body { padding-bottom: calc(184px + var(--k-safe-bottom)); }
  .stay-order .refund-body>.k-button { bottom: calc(120px + var(--k-safe-bottom)); }
  .stay-order .refund-body::after { height: 122px; }
  .stay-order .refund-body>.refund-note { padding: 0 36px; }
}
/* 11-18 第四轮返修：退款金额明细卡右内边距和取消政策卡统一 12（右边线对齐）；没有群码时的「联系门店」整宽按钮 44 高，和本组别的主按钮一致；320 宽底部说明 11 号、两行等长。 */
.stay-order .refund-money { padding-right: 12px; }
.stay-order .no-qr :deep(.k-button) { height: 44px; min-height: 44px; border-radius: 22px; }
@media (max-width: 340px) { .stay-order .refund-body>.refund-note { padding: 0 24px; font-size: 11px; } }
/* 11-18 第五轮返修（功能补回 + 评审第 5 轮）：
   · 群状态标签恢复原来的绿色；无群码提示左对齐 12 灰，和上面正文同一条线；
   · 行程时间线：退房那一行和入住节点同一套栅格（图标落在圆点那一列），同行者行加人形图标、行高 44；
   · 已核销印章缩小、变淡，不抢状态文字。 */
.stay-order .no-qr__text { display: block; text-align: left; color: var(--k-muted); font-size: 12px; line-height: 18px; }
.stay-order .checkout { display: grid; grid-template-columns: 16px minmax(0, 1fr); column-gap: 8px; align-items: center; min-height: 24px; }
.stay-order .travelers>view:first-child { display: flex; align-items: center; gap: 8px; min-height: 20px; }
.stay-order .timeline + .travelers { min-height: 44px; box-sizing: border-box; display: flex; flex-direction: column; justify-content: center; }
.stay-order .verified>image { width: 56px; height: 47px; top: 50%; margin-top: -24px; opacity: .6; }
/* <<R6-BEGIN>> */
/* 11-18 第四轮（按微信实拍评审）：
   · 「订阅订单与退款提醒」不再是整宽白卡：左对齐入口行（铃铛 + 字 + 箭头），直接放在页面底上；
   · 门店群聊：状态行和群信息合成一张卡（上下发丝线隔开），标题为空时显示两条骨架；「未开通」标签挪到群名左边；隐私提示降成卡下小字；
   · 我的行程：状态标签没有字时整颗收起（里面本来就是空的）；
   · 取消与退款：「（必选）」12 灰；合计上方分隔线统一灰色发丝线；不可点的主按钮保持渐变、整体变淡。 */
.stay-order :deep(.subscribe-entry) { margin: 4px 12px 0; padding: 0; background: transparent; }
.stay-order :deep(.subscribe-entry button) { display: flex; align-items: center; justify-content: flex-start; gap: 6px; height: 36px; margin: 0; padding: 0 4px; border: 0; border-radius: 0; background: transparent; color: var(--k-red-deep); font-size: 13px; font-weight: 500; line-height: 36px; }
.stay-order :deep(.subscribe-entry button::after) { border: 0; }
.stay-order .group-body .paid { margin-top: 8px; border-radius: 12px 12px 0 0; }
.stay-order .group-body .group-card { position: relative; margin-top: 0; border-radius: 0 0 12px 12px; }
.stay-order .group-body .group-card::before { content: ''; position: absolute; left: 12px; right: 12px; top: 0; height: 1px; background: var(--k-line); transform: scaleY(.5); }
.stay-order .group-title { flex-direction: row-reverse; justify-content: flex-end; align-items: center; gap: 8px; }
.stay-order .group-body .privacy { margin-top: 12px; padding: 0 4px; border-radius: 0; background: transparent; box-shadow: none; }
.stay-order .group-body .privacy>view text { color: var(--k-ink2); font-size: 13px; font-weight: 500; }
.stay-order .group-body .privacy>text { color: var(--k-muted); font-size: 12px; line-height: 18px; }
.stay-order .trip-chip { display: flex; flex: 0 0 auto; }
.stay-order .trip-chip.is-empty { display: none; }
.stay-order .reason .section-title text { color: var(--k-muted); font-size: 12px; font-weight: 400; }
.stay-order .refund-money>view:last-child { border-top-color: var(--k-line); }
.stay-order .refund-body :deep(.k-button.is-disabled) { opacity: .6; background: var(--k-grad-brown) !important; color: var(--k-paper) !important; box-shadow: none; }
.stay-order .travelers>view:first-child { justify-content: flex-start; gap: 6px; }

/* 11-19 独立复评返修：
   · 左边一条线：订阅入口行、隐私提示的文字和卡内文字对齐到 24（卡边 12 + 内边距 12）；隐私正文限宽 24.5em，在「。」后折行；
   · 「（必选）」「（向前台出示）」用后代选择器降成 12 灰 400（网页版和微信都能选中）；「7晚 ｜ 2位入住」的竖线统一灰色发丝色；
   · 我的行程：退房前加一颗和入住同色的空心圆点（同一条竖列），退房图标挪到文字后面；同行者没有名单时这一行降成 12 灰；
   · 已核销：印章往下挪 12，不再被「核销时间」标签压住。 */
.stay-order :deep(.subscribe-entry button) { padding: 0 12px; }
.stay-order .group-body .privacy { padding: 0 12px; }
.stay-order .group-body .privacy>text { max-width: 24.5em; }
.stay-order .verify-card .section-title text { color: var(--k-muted); font-size: 12px; font-weight: 400; }
.stay-order .checkout { display: flex; align-items: center; gap: 8px; }
.stay-order .checkout::before { content: ''; order: -2; flex: 0 0 10px; width: 10px; height: 10px; margin: 0 3px; border-radius: 5px; box-sizing: border-box; box-shadow: inset 0 0 0 2px var(--k-red); }
.stay-order .checkout > text { order: -1; }
.stay-order .travelers--bare>view:first-child text { color: var(--k-muted); font-size: 12px; font-weight: 400; }
.stay-order .verified>image { margin-top: -12px; }
@media (max-width: 359px) {
  .stay-order .group-body .privacy>text { font-size: 11px; line-height: 17px; }
}
/* 11-19 微信实拍返修：
   · 群介绍 / 扫码说明 / 隐私提示里的换行改成 {{ '
' }}（模板里直接回车，微信编译时会被压成空格），字一个没改；
   · 标题为空时的两条骨架改用 class（微信 text 里有内部节点，:empty 匹配不上）；没有群名时「未开通」挪到状态行右侧，去掉中间那条线；
   · 行程：退房行的字和「入住」对齐（时间为空时留出 40 列）；空心圈 8、1.5 边；去掉两天之间的发丝线；「想认识更多同频伙伴？」改白卡；
   · 退款：不可点的按钮不透明（浅灰底 + 灰字）；退款原因一行三列；核销：状态卡内容上下居中，房间信息和缩略图顶边对齐。 */
.stay-order .group-body .paid .sk-bar { display: block; width: 120px; height: 14px; margin: 4px 0; border-radius: 6px; background: var(--k-fill); }
.stay-order .group-body .paid .sk-bar.sk-bar--sub { width: 180px; height: 12px; margin-top: 2px; }
.stay-order .group-body .paid.paid--chip { padding-right: 72px; }
.stay-order .group-body .group-card.group-card--noname { padding-top: 0; }
.stay-order .group-body .group-card.group-card--noname::before { display: none; }
.stay-order .group-body .group-card--noname .group-title { position: absolute; right: 12px; top: -36px; gap: 0; transform: translateY(-50%); }
.stay-order .group-body .group-card--noname .group-copy { margin-top: 0; }
.stay-order .checkout::before { flex: 0 0 8px; width: 8px; height: 8px; margin: 0 4px; border-radius: 4px; box-shadow: inset 0 0 0 1.5px var(--k-red); }
.stay-order .checkout.checkout--notime > text { padding-left: calc(48px - 1em); }
.stay-order .timeline .day ~ .day { background: none; }
.stay-order .community { background: var(--k-paper); }
.stay-order .refund-body :deep(.k-button.is-disabled) { opacity: 1; background: var(--k-fill) !important; color: var(--k-muted) !important; }
.stay-order .reason>view { grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; }
.stay-order .reason>view>view { min-height: 36px; }
.stay-order .verified { display: flex; flex-direction: column; justify-content: center; }
.stay-order .verify-room { align-items: flex-start; }
.stay-order .verify-room>view { padding-top: 4px; }
/* <<R6-END>> */
</style>
