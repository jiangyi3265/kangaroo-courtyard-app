<template>
  <view class="k-page shop-page">
    <k-topbar :title="titles[s - 1]" back custom-back @back="onBack" />
    <view v-if="s === 1" class="service-page k-pad-tab"><view class="stay-strip"><image :src="absUrl(stayStrip.cover) || '/static/media/cover-empty.png'" mode="aspectFill" /><view><text>{{ stayStrip.title }}</text><text>{{ stayStrip.sub }}</text></view></view><view class="service-main"><view class="categories"><text v-for="(item,i) in categories" :key="item" :class="{ active: i === catIdx }" @click="pickCat(i)">{{ item }}</text></view><view class="service-list"><text v-if="servicesLoaded && !services.length" class="list-empty">该类暂无可预订的服务</text><view v-for="item in services" :key="item.serviceId" class="service-card" @click="openService(item)"><image :src="absUrl(item.image) || '/static/media/cover-empty.png'" mode="aspectFill" /><view><text>{{ item.name }}</text><view><text>¥{{ item.price }}</text><text>{{ item.unit }}</text></view><text>可用：{{ item.available }}</text><view><text>{{ item.stockText }}</text><k-chip v-if="item.refundable" tone="green"><text>可退</text></k-chip></view></view><view class="add" @click.stop="addToCart(item)"><k-icon name="plus" :size="23" color="red" /></view></view></view></view><view class="cart-bar"><view class="cart-icon"><k-icon name="shopping-cart" :size="30" color="ink" /><text>{{ cart ? cart.qty : 0 }}</text></view><text>购物车</text><text>¥{{ cartTotal }}</text><view @click="showCart"><text>明细</text><k-icon name="chevron-up" :size="17" color="muted" /></view><k-button @click="checkout">去结算</k-button></view><k-tabbar active="home" /></view>

    <view v-else-if="s === 2" class="detail-page k-pad-bottom"><image class="shop-hero" :src="absUrl(svc.cover) || '/static/media/cover-empty.png'" mode="aspectFill" /><view class="detail-main"><view class="product-head"><view><text>{{ svc.serviceName || '' }}</text><view><text>¥{{ yuan(svc.priceFen || 0) }}</text><text>/{{ svc.unitLabel || '人' }}</text><k-chip v-if="svc.refundable" tone="green"><text>可退</text></k-chip></view></view><text>已售 {{ svc.soldTotal || 0 }} 份</text></view><view class="product-badges"><view v-for="item in badges" :key="item.label"><k-icon :name="item.icon" :size="25" color="ink" /><text>{{ item.label }}</text></view></view><view class="service-content"><text>服务内容</text><text>{{ svc.content || '' }}</text></view><view class="detail-rows"><view><text>服务地点</text><text>{{ svc.location || '' }}</text></view><view><text>可用日期</text><text>{{ availableText }}</text></view><view><text>预约规则</text><text>{{ ruleText }}</text></view><view class="merchant" @click="openMerchant"><text>商家信息</text><image :src="absUrl(merchant.cover) || '/static/media/cover-empty.png'" mode="aspectFill" /><view><text>{{ merchant.storeName || '' }}</text><text>评分 {{ merchant.rating || '暂无足够评价' }}　　服务 {{ merchant.servedCount || 0 }}</text></view><k-icon name="chevron-right" :size="20" color="ink" /></view></view><view class="product-review"><view><text>用户评价（{{ svc.reviewCount || 0 }}）</text></view><view v-if="svcReview"><image src="/static/media/shop-reviewer.jpg" mode="aspectFill" /><view><text>小满同学</text><text>★★★★★ 5.0</text></view><text>08-24</text></view><text>{{ svcReview ? svcReview.content : '暂无用户评价' }}</text></view></view><k-bottom><view class="mini-action" @click="toggleFavorite"><k-icon name="heart" :size="29" :color="svc.favorite ? 'red' : 'ink'" :fill="!!svc.favorite" /><text>{{ svc.favorite ? '已收藏' : '收藏' }}</text></view><view class="mini-action" @click="shareTip"><k-icon name="share-2" :size="28" color="ink" /><text>分享</text></view><view class="buy"><k-button block label="立即购买" @click="buyNow" /></view></k-bottom></view>

    <view v-else-if="s === 3" class="pay-page"><view class="pay-countdown"><text>{{ order ? '订单已提交，请在 15 分钟内完成支付' : '请确认订单信息' }}</text><text>{{ clock }}</text></view><view class="pay-content"><text class="section-title">商品信息</text><view class="pay-product"><image :src="absUrl(svc.cover) || '/static/media/cover-empty.png'" mode="aspectFill" /><view><text>{{ svc.serviceName || '' }}</text><view><text>¥{{ yuan(svc.priceFen || 0) }}</text><text>/{{ svc.unitLabel || '人' }}</text><k-chip v-if="svc.refundable" tone="green"><text>可退</text></k-chip></view></view></view><view class="pay-row"><text>规格</text><text>{{ svc.specLabel || '' }}</text></view><view class="pay-row"><text>数量</text><view class="stepper"><text class="stepper__btn" @click="stepQty(-1)">-</text><text>{{ qty }}</text><text class="stepper__btn" @click="stepQty(1)">+</text></view></view><view class="divider" /><text class="section-title">使用信息</text><view class="pay-row" @click="editUser"><text>使用人</text><text>{{ userText }}　›</text></view><view class="pay-row" @click="pickSlot"><text>预约时段</text><view><text>{{ slotText || '请选择' }}　›</text><text>{{ ruleText }}</text></view></view><view class="pay-row" @click="editRemark"><text>备注</text><text class="pay-note">{{ remark || '选填：输入备注信息（如过敏、口味等）' }}</text></view><view class="divider" /><text class="section-title">费用明细</text><view class="money"><view><text>商品金额</text><text>¥{{ yuan(svc.priceFen || 0) }} × {{ qty }}</text><text>¥{{ yuan(amountFen) }}</text></view><view><text>平台服务费</text><text></text><text>¥0</text></view><view><text>优惠券</text><text>暂无可用优惠</text><text>—</text></view><view><text>实付款</text><text></text><text>¥{{ yuan(order ? order.payFen : amountFen) }}</text></view></view><view class="divider" /><text class="section-title">退款规则</text><view class="refund-line"><k-chip v-if="svc.refundable" tone="green"><k-icon name="shield-check" :size="14" color="green" /><text>可退</text></k-chip><text>{{ refundRule }}</text></view></view><view class="pay-bottom"><view><k-icon name="message-circle" :size="32" color="green" :fill="true" /><text>{{ channelLabel }}</text></view><k-button :disabled="paying" :label="paying ? '支付处理中…' : '立即支付 ¥' + yuan(order ? order.payFen : amountFen)" @click="payNow" /></view></view>

    <view v-else class="codes-page"><view class="code-tabs"><text class="active" :style="tabStyle('unused', true)" @click="setTab('unused')">待使用</text><text :style="tabStyle('used', false)" @click="setTab('used')">已核销</text><text :style="tabStyle('refunded', false)" @click="setTab('refunded')">已退款</text></view><view v-for="c in rowsOf('unused')" :key="c.orderNo" class="code-card card"><view class="order-no"><text>订单号　{{ c.orderNo }}</text><text @click="copyNo(c.orderNo)">复制</text></view><view class="unused"><view><image :src="absUrl(c.cover) || '/static/media/cover-empty.png'" mode="aspectFill" /><view><text>{{ c.serviceName }}</text><text>¥{{ yuan(c.unitFen) }}/{{ (c.service || {}).unitLabel || '人' }} × {{ c.qty }}</text></view></view><view class="use-info"><text>预约时段</text><text>{{ c.useDate }} {{ c.timeSlot }}</text><text>使用人</text><text>{{ c.userName || '—' }}{{ c.maskedPhone ? '（' + c.maskedPhone + '）' : '' }}</text></view><view class="qr-side"><image v-if="c.qrDataUri" :src="c.qrDataUri" mode="aspectFit" /><text>核销码　{{ fmtCode(c.code) }}</text><text>请向商家出示二维码或条码</text></view></view><view class="code-actions"><k-button size="md" type="outline" icon="phone" @click="callStore(c)">联系商家</k-button><k-button size="md" type="outline" @click="changeOrRefund(c)">改期 / 退款</k-button></view></view><view v-for="c in rowsOf('used')" :key="c.orderNo" class="history-card card"><view class="order-no"><text class="green">已核销　</text><text>{{ c.orderNo }}</text><text @click="copyNo(c.orderNo)">复制</text></view><view class="history-body"><image :src="absUrl(c.cover) || '/static/media/cover-empty.png'" mode="aspectFill" /><view><text>{{ c.serviceName }}</text><text>¥{{ yuan(c.unitFen) }}/{{ (c.service || {}).unitLabel || '人' }} × {{ c.qty }}</text><text>核销时间　　{{ String(c.verifyTime || '').slice(0, 16) }}</text><text>核销门店　　{{ c.storeName || '' }}</text></view><image src="/static/media/shop-stamp-verified.jpg" mode="aspectFit" /></view></view><view v-for="c in rowsOf('refunded')" :key="c.orderNo" class="history-card card"><view class="order-no"><text>{{ c.statusLabel }}　{{ c.orderNo }}</text><text @click="copyNo(c.orderNo)">复制</text></view><view class="history-body"><image :src="absUrl(c.cover) || '/static/media/cover-empty.png'" mode="aspectFill" /><view><text>{{ c.serviceName }}</text><text>¥{{ yuan(c.unitFen) }}/{{ (c.service || {}).unitLabel || '人' }} × {{ c.qty }}</text><text>退款时间　　{{ c.refundTime ? String(c.refundTime).slice(0, 16) : (c.status === 'refunding' ? '退款处理中' : (c.refundReviewer === '平台' ? '平台' : '') + '审核中') }}</text><text>退款金额　　¥{{ yuan(c.refundFen || c.payFen) }}</text></view><image v-if="c.status === 'refunded'" src="/static/media/shop-stamp-refund.jpg" mode="aspectFit" /></view></view><text v-if="mineLoaded && !(mine.rows || []).length" class="list-empty">{{ tab === 'unused' ? '暂无待使用的服务' : tab === 'used' ? '暂无已核销的服务' : '暂无退款记录' }}</text><view class="code-note"><k-icon name="shield-check" :size="19" color="green" /><text>核销后将计入商家经营报表，用于服务统计与结算。</text></view><k-button block type="outline" @click="callStore()">联系商家</k-button></view>
    <!-- 预约 / 改期的日期之前是分页菜单（下一页…），长住时要翻好几页；超过 6 天改成日历点选 -->
    <k-date-picker v-if="dayCal" title="选择预约日期" :value="dayCal.value" :min-date="dayCal.min" :max-date="dayCal.max" @cancel="closeDayCal('')" @confirm="closeDayCal" />
  </view>
</template>

<script setup>
// ---------------------------------------------------------------------------
// 增值服务接入情况（挂在本人进行中的入住单上：?stayOrderNo=，不传时自动取进行中的那一张）：
//   s=1 列表：apiShopServices；类目按平台白名单开放（出行 / 餐饮 / 设备用品需资质，默认"暂未开放"）；一次结算一项服务
//   s=2 详情：已售份数是真实累计；商家"服务"数 = 本门店累计核销；评价不足时不显示评价
//   s=3 下单支付：数量、使用人、预约时段（入住期内、满足提前小时数、按时段名额）、备注；进本屏时订单还没创建，
//       所以顶部只写"请确认订单信息"，下单后才有 15 分钟倒计时；支付走共享 pay-flow
//   s=4 我的服务订单：待使用（核销码 + 二维码）、已核销、已退款；改期 / 退款在同一个按钮里选
// ---------------------------------------------------------------------------
import { absUrl } from '@/common/upload.js'
import { ref, computed, watch, onUnmounted } from 'vue'
import { onShareAppMessage } from '@dcloudio/uni-app'
import { useScreen, back, go, toast } from '@/common/screen.js'
import R from '@/common/routes.js'
import {
  apiShopServices, apiShopService, apiShopSlots, apiShopQuote, apiShopCreateOrder, apiShopMyOrders, apiShopRefund, apiFavoriteService, apiShopCancelOrder,
  apiShopReschedule, apiStayOrder, apiPayConfig, apiShopOrder
} from '@/common/api.js'
import { errText, alert, confirm, modal, prompt, sheet, copy, yuan, serverTs, pad2 } from '@/common/ui.js'
import { payFlow, channelLabel as labelOf } from '@/common/pay-flow.js'
import { dayText } from './stays-state.js'

let stayOrderNo = ''
let storeId = 0
let landing = 1
const s = useScreen(4, {
  onLoad: (q) => {
    stayOrderNo = q?.stayOrderNo || ''
    storeId = Number(q?.storeId) || 0
    landing = q?.orderNo ? 'order' : (q?.serviceId ? 2 : s.value)
    if (q?.serviceId) openService({ serviceId: Number(q.serviceId) })
    if (q?.orderNo) openOrder(String(q.orderNo))
    init()
  }
})
watch(s, (v) => { if (v === 4) loadMine() })
const titles = ['增值服务', '商品详情', '订单支付', '核销码']
const payMode = ref('mock')
async function init() {
  try { payMode.value = ((await apiPayConfig()).data || {}).mode || 'mock' } catch (e) { /* 只影响通道名显示 */ }
  loadServices()
  if (s.value === 4) loadMine()
}

// ---------------- s=1 列表 ----------------
const categories = ['推荐', '出行服务', '生活服务', '体验课程', '餐饮服务', '设备用品']
const CAT_CODE = ['recommend', 'transport', 'life', 'course', 'food', 'goods']
const catIdx = ref(0)
const listData = ref({ categories: [], rows: [], stay: null })
const stayStrip = computed(() => {
  const st = listData.value.stay
  if (!st) return { cover: '', title: storeId ? '门店增值服务' : '暂无进行中的入住', sub: '可先浏览，入住期间可预订本店服务' }
  return { cover: st.cover, title: st.stayName, sub: `入住：${dayText(st.checkIn)} - ${dayText(st.checkOut)}　 共${st.nights}晚` }
})
const services = computed(() => (listData.value.rows || []).map(r => ({
  serviceId: r.serviceId, name: r.serviceName, price: yuan(r.priceFen), priceFen: r.priceFen, unit: '/' + r.unitLabel, unitLabel: r.unitLabel,
  available: r.availableDesc, stockText: `已售 ${r.soldTotal || 0} 份`, image: r.cover, refundable: r.refundable
})))
const servicesLoaded = ref(false)
async function loadServices() {
  try {
    listData.value = (await apiShopServices({ stayOrderNo: stayOrderNo || undefined, storeId: storeId || undefined, category: CAT_CODE[catIdx.value] })).data || listData.value
    servicesLoaded.value = true
    if (!stayOrderNo && listData.value.stay) stayOrderNo = listData.value.stay.orderNo
  } catch (e) {
    toast(errText(e, '服务加载失败'))
  }
}
function pickCat(i) {
  catIdx.value = i
  const code = CAT_CODE[i]
  const c = (listData.value.categories || []).find(x => x.code === code)
  if (c && !c.open) toast('该类服务暂未开放')
  loadServices()
}
const cart = ref(null)
const cartTotal = computed(() => (cart.value ? yuan(cart.value.priceFen * cart.value.qty) : '0'))
function addToCart(item) {
  if (!listData.value.stay) return toast('增值服务需在入住期间预订')
  if (cart.value && cart.value.serviceId !== item.serviceId) toast(`一次结算一项服务，已切换为「${item.name}」`)
  cart.value = { serviceId: item.serviceId, name: item.name, priceFen: item.priceFen, qty: cart.value && cart.value.serviceId === item.serviceId ? cart.value.qty + 1 : 1 }
}
const showCart = () => {
  if (!cart.value) return toast('还没有选择服务')
  alert('已选服务', `${cart.value.name} × ${cart.value.qty}，合计 ¥${cartTotal.value}`)
}
async function checkout() {
  if (!cart.value) return toast('请先选择服务')
  await openService({ serviceId: cart.value.serviceId }, false)
  qty.value = cart.value.qty
  toPayScreen()
}

// ---------------- s=2 详情 ----------------
const svc = ref({})
const BADGE_ICONS = ['calendar-days', 'clock-3', 'award', 'trophy']
const badges = computed(() => (svc.value.badges || []).slice(0, 4).map((label, i) => ({ icon: BADGE_ICONS[i] || 'check', label })))
const merchant = computed(() => svc.value.merchant || {})
const svcReview = computed(() => null)

// 收藏服务：个人书签，不占名额也不通知门店；在「我的 · 收藏」里能找回
const toggleFavorite = async () => {
  if (!svc.value.serviceId) return
  try {
    const res = await apiFavoriteService(svc.value.serviceId, !svc.value.favorite)
    svc.value = { ...svc.value, favorite: !!(res.data && res.data.favorite) }
    toast((res.data && res.data.message) || '已更新')
  } catch (e) {
    toast((e && e.message) || '请先登录')
  }
}
async function openService(item, show = true) {
  try {
    svc.value = (await apiShopService(item.serviceId)).data || {}
    if (show) s.value = 2
  } catch (e) {
    toast(errText(e, '服务不存在或暂未开放'))
  }
}
// 通知里的「查看订单」深链 /pages/stays/shop?orderNo=…：待付款的回到支付屏继续付 / 取消，其余进「我的服务订单」对应页签。
// 早先这个参数被忽略，待付款的服务单从通知点进来只能看到服务列表，无法继续支付也无法取消
async function openOrder(orderNo) {
  try {
    const o = (await apiShopOrder(orderNo)).data || {}
    if (o.status === 'pending_payment') {
      await openService({ serviceId: o.serviceId }, false)
      qty.value = o.qty || 1
      useDate.value = o.useDate || ''
      timeSlot.value = o.timeSlot || ''
      userName.value = o.userName || ''
      remark.value = o.remark || ''
      stayOrderNo = o.stayOrderNo || stayOrderNo
      order.value = o
      skew = serverTs(o.serverTime) ? serverTs(o.serverTime) - Date.now() : 0
      if (!timer) timer = setInterval(() => { now.value = Date.now() }, 1000)
      s.value = 3
      return
    }
    if (o.status === 'closed' || o.status === 'cancelled') return toast('这张订单已关闭（超时未支付或已取消）')
    tab.value = o.status === 'used' ? 'used' : (o.status === 'refunded' || o.status === 'refund_pending' || o.status === 'refunding' ? 'refunded' : 'unused')
    s.value = 4
  } catch (e) {
    toast(errText(e, '订单打开失败'))
  }
}
const availableText = computed(() => {
  const st = listData.value.stay
  return st ? `入住期间可选（${dayText(st.checkIn)}–${dayText(st.checkOut)}）` : '入住期间可选'
})
const ruleText = computed(() => `需提前 ${svc.value.advanceHours || 0} 小时预约，可免费改期 ${svc.value.rescheduleLimit || 0} 次`)
const shareTip = () => toast('点右上角「···」转发给朋友')
// 「商家信息 ›」之前点了没反应：打开这家门店的商家评价
const openMerchant = () => { if (svc.value.storeId) go(R.jobTeam + '?s=4&storeId=' + svc.value.storeId) }
// 之前左上角返回在任何一屏都直接离开本页：列表点进详情、去结算后返回，回不到列表 / 详情；付完款在核销码屏返回也直接离开。
// 现在：详情、核销码、已下单的结算屏回列表，未下单的结算屏回详情；直接打开的那一屏（收藏 / 分享 / 通知 / 订单深链）回来源页
const onBack = () => {
  if (s.value === 1 || s.value === landing || (landing === 'order' && s.value !== 2)) return back()
  s.value = s.value === 3 && !order.value ? 2 : 1
}
const buyNow = () => {
  if (!listData.value.stay) return toast('增值服务需在入住期间预订')
  qty.value = 1
  toPayScreen()
}

// ---------------- s=3 下单支付 ----------------
const qty = ref(1)
const userName = ref('')
const useDate = ref('')
const timeSlot = ref('')
const remark = ref('')
const order = ref(null)
const now = ref(Date.now())
let skew = 0
let timer = null
onUnmounted(() => { if (timer) clearInterval(timer) })
const amountFen = computed(() => (svc.value.priceFen || 0) * qty.value)
const maskedPhone = computed(() => {
  const p = (listData.value.stay || {}).guestPhone || ''
  return p.length === 11 ? p.slice(0, 3) + '****' + p.slice(7) : p
})
const slotText = computed(() => (useDate.value ? `${useDate.value} ${timeSlot.value}` : ''))
// 没有手机号时不留空括号「请填写（）」
const userText = computed(() => (userName.value || '请填写') + (maskedPhone.value ? `（${maskedPhone.value}）` : ''))
// 退款由谁审：服务端按角色阶段给 refundReviewer（新阶段「平台」），老接口没这个字段时按「门店」
const refundRule = computed(() => (svc.value.refundable ? `未核销可申请退款，${svc.value.refundReviewer || '门店'}审核通过后原路退回，到账时间以支付渠道为准` : '该服务不支持退款'))
const channelLabel = computed(() => labelOf(payMode.value))
const orderLeft = computed(() => {
  if (!order.value) return 0
  const end = serverTs(order.value.expireTime)
  return end ? Math.max(0, Math.floor((end - now.value - skew) / 1000)) : 0
})
const clock = computed(() => (order.value ? `${pad2(Math.floor(orderLeft.value / 60))}:${pad2(orderLeft.value % 60)}` : ''))
// 订单生成后数量 / 时段 / 使用人都已写进订单：之前还能改，页面金额变了实际支付的仍是原订单金额
const lockedByOrder = () => {
  if (!order.value) return false
  toast('订单生成后不能修改，可取消后重新下单')
  return true
}
function toPayScreen() {
  order.value = null
  userName.value = userName.value || (listData.value.stay || {}).guestName || ''
  s.value = 3
}
const stepQty = (n) => { if (!lockedByOrder()) qty.value = Math.min(10, Math.max(1, qty.value + n)) }
async function editUser() {
  if (lockedByOrder()) return
  const v = await prompt('使用人', { value: userName.value, placeholder: '到店使用服务的人' })
  if (v) userName.value = v.slice(0, 20)
}
// 选预约日期：6 天以内用操作菜单，更多时用日历（只能点到入住期内的日子）；返回 days 的下标，取消返回 -1
const dayCal = ref(null)
let dayResolve = null
function pickDay(days, value) {
  if (days.length <= 6) return sheet(days.map(x => x.label))
  const dates = days.map(x => x.date).sort()
  return new Promise((resolve) => {
    dayResolve = resolve
    dayCal.value = { days, min: dates[0], max: dates[dates.length - 1], value: dates.includes(value) ? value : dates[0] }
  })
}
function closeDayCal(date) {
  const c = dayCal.value
  if (date && c) {
    const i = c.days.findIndex(x => x.date === date)
    // 入住期内但这天没开放预约：日历不关，换一天就行
    if (i < 0) return toast('这一天没有可约时段，请换一天')
    dayCal.value = null
    if (dayResolve) dayResolve(i)
  } else {
    dayCal.value = null
    if (dayResolve) dayResolve(-1)
  }
  dayResolve = null
}
async function pickSlot() {
  if (!svc.value.serviceId || lockedByOrder()) return
  try {
    const d = (await apiShopSlots(svc.value.serviceId, stayOrderNo || undefined)).data || {}
    const days = d.days || []
    if (!days.length) return toast('入住期内暂无可约时段')
    const i = await pickDay(days, useDate.value)
    if (i < 0) return
    const slots = days[i].slots || []
    const j = await sheet(slots.map(x => `${x.slot}（剩 ${x.left}）`))
    if (j < 0) return
    if (!slots[j].left) return toast('该时段已约满')
    useDate.value = days[i].date
    timeSlot.value = slots[j].slot
  } catch (e) {
    toast(errText(e, '时段加载失败'))
  }
}
async function editRemark() {
  if (lockedByOrder()) return
  const v = await prompt('备注', { value: remark.value, placeholder: '如过敏、口味等（100 字以内）' })
  if (v !== null) remark.value = v.slice(0, 100)
}
// 下单 + 拉起支付要等返回：连点会建两张订单（每次点击的 idemKey 都不同，服务端去不了重），处理中先锁住按钮
const paying = ref(false)
async function payNow() {
  if (paying.value) return
  // 15 分钟没付，服务端已关单：清掉旧单，再点一次按当前选择重新下单
  if (order.value && order.value.expireTime && orderLeft.value === 0) {
    order.value = null
    return toast('订单已超时关闭，请重新下单')
  }
  paying.value = true
  try {
    if (!order.value) {
      if (!useDate.value) return toast('请选择预约时段')
      await apiShopQuote({ serviceId: svc.value.serviceId, qty: qty.value, stayOrderNo, useDate: useDate.value, timeSlot: timeSlot.value })
      const res = await apiShopCreateOrder({
        serviceId: svc.value.serviceId, qty: qty.value, stayOrderNo, useDate: useDate.value, timeSlot: timeSlot.value,
        userName: userName.value, remark: remark.value, expectedPayFen: amountFen.value, idemKey: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
      })
      order.value = res.data
      skew = serverTs(order.value.serverTime) ? serverTs(order.value.serverTime) - Date.now() : 0
      if (!timer) timer = setInterval(() => { now.value = Date.now() }, 1000)
    }
    const r = await payFlow(order.value.payNo)
    if (r.status === 'cancel') {
      // 关掉支付弹窗后让用户选：保留订单稍后付，或现在就取消（释放名额）。用系统弹窗，不改页面结构
      const keep = await modal('暂未支付', '订单为你保留 15 分钟，超时自动取消。', { confirmText: '继续保留', cancelText: '取消订单' })
      if (keep.confirm || keep.cancel !== true) return toast('订单保留 15 分钟，可稍后继续支付')
      await apiShopCancelOrder(order.value.orderNo)
      order.value = null
      return toast('订单已取消')
    }
    cart.value = null
    tab.value = 'unused'
    s.value = 4
    // 微信回调可能晚到：服务端还没确认时订单不在「待使用」里，之前直接跳过去看到的是空列表
    if (r.status === 'unknown') toast('支付结果确认中，稍后点「待使用」刷新查看')
  } catch (e) {
    toast(errText(e, '支付未完成'))
  } finally {
    paying.value = false
  }
}

// ---------------- s=4 我的服务订单 ----------------
const tab = ref('unused')
const mine = ref({ rows: [] })
const mineLoaded = ref(false)
const rowsOf = (t) => (tab.value === t ? (mine.value.rows || []) : [])
async function loadMine() {
  try {
    mine.value = (await apiShopMyOrders({ tab: tab.value })).data || { rows: [] }
    mineLoaded.value = true
  } catch (e) { toast(errText(e, '订单加载失败')) }
}
const setTab = (t) => { tab.value = t; loadMine() }
const tabStyle = (t, first) => (tab.value === t ? (first ? '' : 'color: var(--k-red)') : (first ? 'color: var(--k-ink)' : ''))
const fmtCode = (c) => String(c || '').replace(/(\d{4})(?=\d)/g, '$1 ')
const copyNo = (no) => copy(no, '已复制订单号')
async function callStore(c) {
  const no = (c && c.stayOrderNo) || stayOrderNo
  if (!no) return toast('门店暂未提供电话')
  try {
    const phone = ((await apiStayOrder(no)).data || {}).storePhone
    if (!phone) return toast('门店暂未提供电话')
    uni.makePhoneCall({ phoneNumber: String(phone) })
  } catch (e) {
    toast(errText(e, '门店暂未提供电话'))
  }
}
let changing = false
async function changeOrRefund(c) {
  if (changing) return
  const i = await sheet(['改期', '申请退款'])
  if (i < 0) return
  changing = true
  try {
    if (i === 0) {
      const d = (await apiShopSlots(c.serviceId, c.stayOrderNo)).data || {}
      const days = d.days || []
      if (!days.length) return toast('入住期内暂无可改的时段')
      const a = await pickDay(days, c.useDate)
      if (a < 0) return
      const slots = days[a].slots || []
      const b = await sheet(slots.map(x => `${x.slot}（剩 ${x.left}）`))
      if (b < 0) return
      await apiShopReschedule(c.orderNo, days[a].date, slots[b].slot)
      toast('已改期')
    } else {
      if (!(await confirm('申请退款', `未核销的服务可全额退款，提交后由${c.refundReviewer || '门店'}审核。确认申请？`))) return
      const res = await apiShopRefund(c.orderNo, '用户申请退款')
      toast(res.msg || '已提交')
    }
    loadMine()
  } catch (e) {
    toast(errText(e, '操作失败'))
  } finally {
    changing = false
  }
}
onShareAppMessage(() => (s.value === 2 && svc.value.serviceId
  ? { title: svc.value.serviceName, path: '/pages/stays/shop?s=2&serviceId=' + svc.value.serviceId }
  : { title: '袋鼠全球青年', path: '/pages/home/index' }))
</script>

<style scoped lang="scss">
/* 10-19 字体复查：--k-serif 现在是只有粗体的标题字体，整页挂着正文也变粗 —— 整页用系统黑体，标题单独用标题字体 */.shop-page { font-family: var(--k-sans); }.product-head>view>text,.section-title,.pay-product>view>text,.code-tabs { font-family: var(--k-display-font); }.service-page { padding-bottom: calc(156px + var(--k-safe-bottom)); }.stay-strip { height: 53px; margin: 0 14px 8px; padding: 7px 10px; border: 1px solid var(--k-line); border-radius: 10px; display: flex; align-items: center; }.stay-strip>image { width: 34px; height: 34px; border-radius: 50%; }.stay-strip>view { margin-left: 9px; display: flex; flex-direction: column; }.stay-strip>view text:first-child { font-weight: 700; }.stay-strip>view text:last-child { color: var(--k-muted); font-size: 11px; }.service-main { display: flex; }.categories { width: 113px; flex: 0 0 auto; display: flex; flex-direction: column; border-right: 1px solid var(--k-line); }.categories text { position: relative; height: 56px; padding-left: 14px; display: flex; align-items: center; font-size: 14px; }.categories text.active { color: var(--k-red); background: var(--k-paper2); font-weight: 700; }.categories text.active::before { content:''; position:absolute; left:0; width:3px; height:34px; background:var(--k-red); }.service-list { flex: 1; min-width: 0; padding: 0 8px; display: grid; gap: 6px; }.service-card { position: relative; height: 82px; padding: 5px; border: 1px solid var(--k-line); border-radius: 9px; display: flex; }.service-card>image { width: 78px; height: 70px; border-radius: 7px; }.service-card>view:nth-child(2) { padding-left: 9px; }.service-card>view:nth-child(2)>text:first-child { display: block; width: 154px; font-size: 14px; font-weight: 700; }.service-card>view:nth-child(2)>view:nth-child(2) text:first-child { color: var(--k-red); font: 700 17px var(--k-sans); }.service-card>view:nth-child(2)>view:nth-child(2) text:last-child,.service-card>view:nth-child(2)>text:nth-child(3) { color: var(--k-muted); font-size: 10px; }.service-card>view:nth-child(2)>view:nth-child(4) { display: flex; align-items: center; gap: 7px; color: var(--k-muted); font-size: 10px; }.add { position: absolute; right: 8px; top: 30px; width: 27px; height: 27px; border: 1.5px solid var(--k-red); border-radius: 50%; display: flex; align-items: center; justify-content: center; }.cart-bar { position: fixed; left: 0; right: 0; bottom: calc(90px + var(--k-safe-bottom)); z-index: 45; height: 57px; padding: 5px 12px; background: var(--k-paper); border-top: 1px solid var(--k-line); display: flex; align-items: center; gap: 8px; }.cart-icon { position: relative; }.cart-icon>text { position: absolute; right: -4px; top: -9px; width: 16px; height: 16px; border-radius: 50%; background: var(--k-red); color:white; display:flex;align-items:center;justify-content:center;font-size:10px; }.cart-bar>text:nth-child(2) { font-size: 11px; }.cart-bar>text:nth-child(3) { margin-left: auto; color: var(--k-red); font: 700 22px var(--k-sans); }.cart-bar>view:nth-child(4) { display: flex; align-items: center; color: var(--k-muted); font-size: 11px; }
.shop-hero { width: 100%; height: 148px; }.detail-main { padding: 0 14px; }.product-head { display: flex; align-items: center; justify-content: space-between; padding: 9px 0; }.product-head>view>text { display: block; font-size: 19px; font-weight: 700; }.product-head>view>view { display: flex; align-items: center; gap: 7px; }.product-head>view>view text:first-child { color: var(--k-red); font: 700 24px var(--k-sans); }.product-head>view>view text:nth-child(2),.product-head>text { color: var(--k-muted); font-size: 11px; }.product-badges { height: 48px; border: 1px solid var(--k-line); border-radius: 8px; display: flex; align-items: center; justify-content: space-around; }.product-badges>view { display: flex; flex-direction: column; align-items: center; font-size: 10px; }.service-content { padding: 10px 0; }.service-content text:first-child { display: block; font-weight: 700; }.service-content text:last-child { display: block; margin-top: 5px; color: var(--k-muted); font-size: 11px; line-height: 1.6; }.detail-rows { border-top: 1px solid var(--k-line); }.detail-rows>view { min-height: 41px; display: grid; grid-template-columns: 88px 1fr 20px; align-items: center; border-bottom: 1px solid var(--k-line); font-size: 11px; }.detail-rows>view>text:first-child { font-weight: 700; }.detail-rows>view>text:nth-child(2) { color: var(--k-muted); }.detail-rows>.merchant { grid-template-columns: 88px 37px 1fr 20px; }.merchant>image { width: 34px; height: 34px; border-radius: 50%; }.merchant>view { display: flex; flex-direction: column; }.merchant>view text:first-child { font-weight: 700; }.merchant>view text:last-child { color: var(--k-muted); font-size: 10px; }.product-review { padding-top: 8px; }.product-review>view:first-child { display: flex; justify-content: space-between; font-weight: 700; }.product-review>view:nth-child(2) { margin-top: 6px; display: flex; align-items: center; }.product-review image { width: 34px; height: 34px; border-radius: 50%; }.product-review>view:nth-child(2)>view { margin-left: 8px; display: flex; flex-direction: column; }.product-review>view:nth-child(2)>view text:last-child { color: var(--k-red); }.product-review>view:nth-child(2)>text { margin-left: auto; color: var(--k-muted); font-size: 10px; }.product-review>text { display: block; margin-top: 5px; font-size: 11px; }.mini-action { width: 45px; display: flex; flex-direction: column; align-items: center; font-size: 10px; }.buy { flex: 1; min-width: 0; }
.pay-countdown { height: 62px; display: flex; flex-direction: column; align-items: center; justify-content: center; border-bottom: 1px solid var(--k-line); }.pay-countdown text:first-child { color: var(--k-muted); font-size: 12px; }.pay-countdown text:last-child { color: var(--k-alert); font: 26px var(--k-sans); }.pay-content { padding: 8px 14px calc(86px + var(--k-safe-bottom)); }.section-title { display: block; margin: 7px 0; font-size: 15px; font-weight: 700; }.pay-product { display: flex; }.pay-product>image { width: 65px; height: 50px; border-radius: 7px; }.pay-product>view { margin-left: 10px; }.pay-product>view>text { font-size: 16px; font-weight: 700; }.pay-product>view>view { display: flex; align-items: center; gap: 6px; }.pay-product>view>view text:first-child { color: var(--k-red); font: 19px var(--k-sans); }.pay-row { min-height: 40px; display: grid; grid-template-columns: 100px 1fr; align-items: center; }.pay-row>text:first-child { font-weight: 700; }.pay-row>view:not(.stepper) { display: flex; flex-direction: column; }.pay-row>view:not(.stepper) text:last-child { color: var(--k-muted); font-size: 10px; }.stepper { width: 83px; margin-left: auto; height: 29px; border: 1px solid var(--k-line); border-radius: 7px; display: flex; justify-content: space-around; align-items: center; }.pay-note { padding: 7px; color: var(--k-light); background: var(--k-paper2); border-radius: 7px; }.divider { height: 1px; margin: 6px 0; background: var(--k-line); }.money>view { height: 27px; display: grid; grid-template-columns: 110px 1fr 60px; }.money>view text:last-child { text-align: right; }.money>view:nth-child(3) text:last-child { color: var(--k-red); }.money>view:last-child { height: 38px; align-items: center; border-top: 1px solid var(--k-line); font-weight: 700; }.money>view:last-child text:last-child { color: var(--k-red); font: 700 23px var(--k-sans); }.refund-line { display: flex; align-items: center; gap: 8px; color: var(--k-muted); font-size: 10px; }.pay-bottom { position: fixed; left: 0; right: 0; bottom: 0; padding: 10px 14px calc(10px + var(--k-safe-bottom)); background: var(--k-paper); border-top: 1px solid var(--k-line); display: flex; align-items: center; }.pay-bottom>view { display: flex; align-items: center; gap: 8px; font-size: 16px; }.pay-bottom>.k-button { margin-left: auto; }
.codes-page { padding: 0 14px calc(18px + var(--k-safe-bottom)); }.code-tabs { height: 43px; display: flex; justify-content: space-around; align-items: center; font-size: 16px; font-weight: 700; }.code-tabs text.active { color: var(--k-red); }.card { border: 1px solid var(--k-line); border-radius: 11px; background: rgba(253,251,247,.8); }.code-card { padding: 0 10px 9px; }.order-no { height: 34px; border-bottom: 1px solid var(--k-line); display: flex; align-items: center; font-size: 12px; }.order-no text:last-child { margin-left: auto; }.unused { position: relative; min-height: 142px; }.unused>view:first-child { padding-top: 7px; display: flex; }.unused>view:first-child>image { width: 57px; height: 50px; border-radius: 7px; }.unused>view:first-child>view { margin-left: 8px; display: flex; flex-direction: column; }.unused>view:first-child>view text:first-child { font-weight: 700; }.use-info { margin-top: 10px; display: grid; grid-template-columns: 65px 1fr; font-size: 11px; }.qr-side { position: absolute; right: 0; top: 5px; width: 120px; display: flex; flex-direction: column; align-items: center; font-size: 10px; }.qr-side image { width: 95px; height: 95px; }.code-actions { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }.history-card { margin-top: 10px; padding: 0 10px 9px; }.history-body { padding-top: 8px; display: flex; align-items: center; }.history-body>image:first-child { width: 58px; height: 50px; border-radius: 7px; }.history-body>view { flex: 1; margin-left: 8px; display: flex; flex-direction: column; font-size: 11px; }.history-body>view text:first-child { font-weight: 700; }.history-body>view text:nth-child(n+3) { margin-top: 4px; color: var(--k-muted); }.history-body>image:last-child { width: 84px; height: 70px; }.green { color: var(--k-green); font-weight: 700; }.code-note { height: 51px; display: flex; align-items: center; gap: 8px; color: var(--k-muted); font-size: 11px; }
/* 服务名太长：卡片固定 82px 高，名称一行省略并给右侧「+」按钮让位，不再压到按钮上 */
.service-card>view:nth-child(2) { flex: 1; min-width: 0; padding-right: 30px; }
.service-card>view:nth-child(2)>text:first-child { width: auto; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
/* 核销码固定在卡片右侧（120px），左边的服务名、预约信息给它让位，不叠在二维码上 */
.unused>view:first-child, .use-info { padding-right: 124px; }
.unused>view:first-child>view { min-width: 0; }
.pay-bottom>view:first-child { flex: 1; min-width: 0; }
.stepper__btn { min-width: 28px; height: 29px; line-height: 29px; text-align: center; }
.list-empty { display: block; padding: 32px 0; text-align: center; color: var(--k-muted); font-size: 13px; }
</style>
