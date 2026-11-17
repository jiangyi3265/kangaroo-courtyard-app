<template>
  <view class="k-page orders">
    <k-topbar :title="titles[s - 1]" back custom-back @back="onBack">
      <!-- 10-18「我的行程」：上面一排分类（旅居订单 / 参与活动 / 兼职 / 全职 / 换宿旅行，有线上任务时多一个），横向可滑 -->
      <scroll-view v-if="s === 1" scroll-x class="cats" :show-scrollbar="false" :scroll-into-view="'cat-' + cat" scroll-with-animation>
        <view class="cats__row" :class="{ 'cats__row--6': cats.length > 5 }">
          <view v-for="catItem in cats" :id="'cat-' + catItem.key" :key="catItem.key" class="cats__item" :class="{ active: cat === catItem.key }" hover-class="k-press" @click="pickCat(catItem.key)">
            <text>{{ catItem.label }}</text><text v-if="catItem.count" class="cats__n">{{ catItem.count }}</text>
          </view>
        </view>
      </scroll-view>
      <view v-else-if="s === 2" class="k-tabs">
        <view v-for="t in reviewTabs" :key="t" class="k-tabs__item" :class="{ active: reviewTab === t }" @click="reviewTab = t"><text>{{ t }}</text></view>
      </view>
    </k-topbar>

    <!-- 1 我的行程（2026-10-18 主人：「我的订单」「我的行程」「我的活动」合成一个入口）：
         旅居订单下面再分 进行中 / 已完成 / 退款；参与活动、兼职 / 全职 / 换宿旅行各一类，按时间排。数据还是 /app/orders 那一份汇总 -->
    <view v-if="s === 1" class="list k-pad-tab">
      <view v-if="cat === 'stay'" class="subs">
        <view v-for="subItem in STAY_SUBS" :key="subItem" class="subs__item" :class="{ on: staySub === subItem }" hover-class="k-press" @click="staySub = subItem"><text>{{ subItem }}</text></view>
      </view>
      <!-- 原来的「我的行程」时间线、「我的活动」（发起的 / 收藏的活动）从这里进 -->
      <view v-if="catLink" class="jump" hover-class="k-press" @click="go(catLink.url)">
        <k-icon :name="catLink.icon" :size="16" color="red" :stroke="1.8" /><text class="jump__text">{{ catLink.text }}</text><k-icon name="chevron-right" :size="14" color="muted" />
      </view>
      <view v-for="o in filteredOrders" :key="o.key" class="oc">
        <view class="oc__head">
          <view class="oc__ic" :style="{ borderColor: o.iconHex }"><k-icon :name="o.icon" :size="18" :color="o.iconHex" :stroke="1.8" /></view>
          <text class="oc__type">{{ o.typeLabel }}</text>
          <text class="oc__dot">·</text>
          <text class="oc__status" :class="'is-' + o.tone">{{ o.status }}</text>
        </view>
        <view class="oc__body">
          <view class="oc__left">
            <!-- 10-19 复查：没有封面的行程（增值服务、部分活动）不再放「暂无图片」占位图，换成浅杏底 + 这一类的图标 -->
            <image v-if="o.image" class="oc__img" :src="o.img" mode="aspectFill" />
            <view v-else class="oc__img oc__img--empty"><k-icon :name="o.icon || 'calendar-days'" :size="26" color="#B08A62" :stroke="1.6" /></view>
            <text v-if="o.deposit" class="oc__deposit">{{ o.deposit }}</text>
          </view>
          <view class="oc__right">
            <text class="oc__title">{{ displayWording(o.title, [o.storeName]) }}</text>
            <view v-if="o.loc" class="oc__meta"><k-icon name="map-pin" :size="12" color="light" :stroke="1.7" /><text class="oc__loc">{{ o.loc }}</text></view>
            <view class="oc__meta oc__meta--row">
              <view class="k-row k-gap4"><k-icon name="calendar-days" :size="12" color="light" :stroke="1.7" /><text>{{ o.date }}</text></view>
              <text v-if="o.signed" class="oc__signed">{{ o.signed }}</text>
              <text v-else class="oc__price">{{ o.price }}<text v-if="o.unit" class="oc__unit">{{ o.unit }}</text></text>
            </view>
          </view>
        </view>
        <view class="oc__btns">
          <view v-for="b in o.btns.filter(b => stayBookingEnabled || !b.url?.startsWith('/pages/stays/pay'))" :key="b.label" class="oc__btn" :class="'is-' + b.type" hover-class="k-press" @click="onOrderBtn(b.label, o)"><text>{{ b.label }}</text></view>
        </view>
      </view>
      <view v-if="!filteredOrders.length" class="empty" @click="retryOrders">
        <view class="empty__ring"><k-icon :name="catIcon" :size="30" color="muted" :stroke="1.5" /></view>
        <text class="k-meta">{{ ordersState === 'loading' ? '正在加载…' : ordersState === 'error' ? '加载失败，点此重试' : emptyText }}</text>
      </view>
    </view>

    <!-- 2 评价管理 -->
    <view v-else-if="s === 2" class="k-pad-tab">
      <view class="tip"><text>{{ reviewTip }}</text></view>
      <view class="k-body">
        <view v-for="r in reviewList" :key="r.key" class="rc">
          <image class="rc__img" :src="r.img" mode="aspectFill" />
          <view class="k-flex1">
            <view class="k-row k-gap4">
              <text class="rc__name" :class="{ 'rc__name--lg': !r.sub }">{{ r.name }}</text>
              <text v-if="r.sub" class="rc__sub">· {{ r.sub }}</text>
            </view>
            <text class="rc__title">{{ displayWording(r.title, [r.storeName]) }}</text>
            <text class="rc__time">{{ r.time }}</text>
            <text class="rc__deadline" :class="{ 'rc__deadline--green': reviewTab !== '待评价' }">{{ r.deadline }}</text>
          </view>
          <view v-if="reviewTab === '待评价'" class="rc__btn" @click="writeReview(r)"><text>去评价</text></view>
          <k-chip v-else :tone="reviewTab === '已精选' ? 'ochre' : 'green'">{{ reviewTab }}</k-chip>
        </view>
        <view class="k-divider k-mt8" />
        <text class="sec-title">评价权益</text>
        <view class="rights">
          <view class="rights__row rights__row--line">
            <view class="k-circle k-circle--soft-ochre rights__ic"><k-icon name="medal" :size="22" color="ochre" :stroke="1.6" /></view>
            <view class="k-flex1">
              <text class="rights__title">精选奖励</text>
              <text class="rights__desc">优质评价由平台精选\n<text class="k-red k-bold">优先展示</text> 在门店页</text>
            </view>
          </view>
          <view class="rights__row">
            <view class="k-circle k-circle--soft-green rights__ic"><k-icon name="heart" :size="22" color="green" :stroke="1.6" fill /></view>
            <view class="k-flex1">
              <text class="rights__title">帮助他人</text>
              <text class="rights__desc">真实评价帮助更多小伙伴\n发现好工作好体验</text>
            </view>
          </view>
        </view>
        <text class="foot-note">评价提交后直接展示；含联系方式等内容会先隐藏，平台复核后展示</text>
      </view>
    </view>

    <!-- 3 我的提醒 -->
    <view v-else-if="s === 3" class="k-body k-pad-tab">
      <view class="k-between rem-head">
        <text class="k-small k-muted">开启提醒，不错过心仪机会</text>
        <text class="k-small" @click="editPrefs">编辑</text>
      </view>
      <view class="rem-card">
        <view v-for="(r, i) in reminders" :key="r.title" class="rem" :class="{ 'rem--line': i < reminders.length - 1 }">
          <view class="rem__ic"><k-icon :name="r.icon" :size="26" :color="r.color" :stroke="1.5" /></view>
          <view class="k-flex1"><text class="rem__title">{{ displayWording(r.title, [r.storeName]) }}</text><text class="rem__desc">{{ r.desc }}</text></view>
          <text class="rem__freq">{{ r.freq }}</text>
          <view class="k-switch" :class="{ on: r.on }" @click="togglePref(r)" />
        </view>
      </view>
      <text class="rem-label">已暂停的提醒</text>
      <view class="rem-card">
        <view v-for="(r, i) in paused" :key="r.title" class="rem" :class="{ 'rem--line': i < paused.length - 1 }">
          <view class="rem__ic"><k-icon :name="r.icon" :size="26" color="ink" :stroke="1.5" /></view>
          <view class="k-flex1"><text class="rem__title">{{ displayWording(r.title, [r.storeName]) }}</text><text class="rem__desc">{{ r.desc }}</text></view>
          <text class="rem__freq">已暂停</text>
          <view class="rem__open" @click="enablePref(r)"><text>开启</text></view>
        </view>
      </view>
      <text class="foot-note">{{ prefNote }}</text>
    </view>

    <!-- 4 旅行体验官攻略申请 -->
    <view v-else class="k-pad-tab">
      <image class="hero" src="/pages/profile/static/orders-hero.jpg" mode="widthFix" />
      <view class="k-body">
        <view class="perks">
          <view v-for="(p, i) in perks" :key="p.title" class="perk" :class="{ 'perk--line': i < perks.length - 1 }">
            <view class="k-circle k-circle--soft-green perk__ic"><k-icon :name="p.icon" :size="16" :color="p.color" :stroke="1.6" /></view>
            <view class="k-col"><text class="perk__title">{{ p.title }}</text><text class="perk__desc">{{ p.desc }}</text></view>
          </view>
        </view>
        <view class="k-between k-mt16">
          <text class="sec-title sec-title--flat">可创作的城市</text>
          <view class="k-row k-gap2" @click="allCities"><text class="k-small k-muted">{{ cityCount }}</text><k-icon name="chevron-right" :size="14" color="muted" /></view>
        </view>
        <view class="cities">
          <view v-for="c in cities" :key="c" class="city" @click="openCity(c)"><text>{{ c }}</text></view>
          <text class="k-small city__all" @click="allCities">查看全部</text>
        </view>
        <view class="k-divider k-mt12" />
        <text class="sec-title">申请条件</text>
        <view class="k-col k-gap10 k-mt4">
          <view v-for="c in conditions" :key="c" class="k-row k-gap8"><k-icon name="circle-check" :size="18" color="green" :stroke="1.6" /><text class="k-small">{{ c }}</text></view>
        </view>
        <view class="k-divider k-mt16" />
        <text class="sec-title">申请信息</text>
        <view class="form">
          <text class="form__label">选择城市（可多选）</text>
          <view class="k-row k-gap8 k-mt8">
            <view class="k-input k-flex1 k-between" @click="pickCities"><text class="k-placeholder" :style="pickedStyle">{{ pickedText }}</text><k-icon name="chevron-down" :size="16" color="muted" /></view>
            <k-button type="secondary" size="md" @click="locateCity">开启</k-button>
          </view>
        </view>
        <view class="k-mt12">
          <text class="form__label">创作计划</text>
          <view class="k-input plan k-mt8">
            <!-- 微信里 textarea 是原生层、浮在页面最上面：滚到底部导航栏下面时，点导航会点进输入框；只在编辑时放真的 textarea，平时用长得一样的 view 占位 -->
            <textarea v-if="editingPlan" v-model="plan" placeholder="请选择计划内容类型与更新频率" placeholder-class="k-placeholder" :maxlength="200" :focus="true" auto-focus @blur="plan = $event.detail.value; editingPlan = false" />
            <view v-else class="orders-area-idle" @click="editingPlan = true"><text :class="{ 'k-placeholder': !plan }">{{ plan || '请选择计划内容类型与更新频率' }}</text></view>
            <text class="plan__counter">{{ plan.length }}/200</text>
          </view>
        </view>
        <view class="k-mt12">
          <text class="form__label">代表作品（选填）</text>
          <view class="k-row k-gap8 k-mt8">
            <view class="k-input k-flex1"><input v-model="work" maxlength="300" :placeholder="workHint" placeholder-class="k-placeholder" /></view>
            <view class="k-input add" @click="addWork"><k-icon name="plus" :size="18" color="ink" :stroke="1.8" /></view>
          </view>
        </view>
        <k-button block class="k-mt20" :disabled="submitting" :label="submitting ? '提交中…' : '提交申请'" @click="submit" />
        <text class="foot-note foot-note--tight">{{ guideNote }}</text>
      </view>
    </view>

    <k-tabbar :active="s === 1 ? 'profile' : ''" />
  </view>
</template>

<script setup>
import { stayBookingEnabled } from '@/common/features.js'
import { displayWording } from '@/common/display-wording.js'
import { selectCities } from '@/common/city-picker.js'
// ---------------------------------------------------------------------------
// 订单 / 评价 / 提醒 / 体验官接入情况：
//   s=1 全部订单：报名、住宿、二消、活动四类汇总（apiMyOrders），按钮直接跳到对应的真实页面；报名本身不产生应付金额
//   s=2 评价管理：待评价（完成 30 天内）/ 已发布 / 已精选（后台精选），去评价 → 引导式评价页
//   s=3 我的提醒：暂停后这类消息不再写入消息中心；频率只对「新机会提醒」生效（= 岗位订阅的推送频率）
//   s=4 旅行体验官：选城市 + 创作计划 + 作品，提交后台审核，结果发到消息中心
// ---------------------------------------------------------------------------
import { ref, computed, watch } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { useScreen, go, back, toast } from '@/common/screen.js'
import { apiMyOrders, apiReviewsTodo, apiReviewsMine, apiNotifyPrefs, apiSetNotifyPref, apiGuideApply, apiGuideStatus, apiLocateCity, apiSignupHide } from '@/common/api.js'
import { ensureSession, experience } from '@/common/experience.js'
import { sheet, prompt, errText, pickPaged, confirm } from '@/common/ui.js'
import { absUrl, uploadTo, chooseImage } from '@/common/upload.js'
import R from '@/common/routes.js'

let ready = false
const s = useScreen(4, {
  onLoad: async (q) => {
    if (q?.cat && CATS.some(c => c.key === q.cat)) { cat.value = q.cat; catPicked = true }
    if (q?.tab) {
      let t = q.tab
      try { t = decodeURIComponent(q.tab) } catch (e) { /* 已解码 */ }
      // 老链接 ?tab=全部 / 待付款 / 进行中 / 已完成 / 退款（评价页「去支付」、通知）：落到旅居订单对应的小页签；「全部」按有单的第一类
      if (OLD_TABS[t]) { cat.value = 'stay'; staySub.value = OLD_TABS[t]; catPicked = true }
      else if (t === '全部') catPicked = false
      // 评价管理屏（?s=2）也认 tab：评价提交后、「门店回复了你的评价」通知可以直接落到「已发布」
      else if (reviewTabs.includes(t)) reviewTab.value = t
    }
    await ensureSession()
    ready = true
    loadScreen(s.value)
  }
})
const titles = ['我的行程', '评价管理', '我的提醒', '旅行体验官攻略申请']
const onBack = () => back()
function loadScreen(v) {
  if (v === 1) loadOrders()
  if (v === 2) loadReviews()
  if (v === 3) loadPrefs()
  if (v === 4) loadGuide()
}
watch(s, (v) => { if (ready) loadScreen(v) })
// 之前：只在进页时拉一次。去支付、去评价、看完订单回来，列表还是旧状态（付过的仍显示「去支付」、评过的仍显示「去评价」）。
// 现在：从别的页面回到本页时重新拉当前屏（体验官申请屏只刷新审核状态，不动正在填的表单）
let shown = false
onShow(() => { if (shown && ready) loadScreen(s.value); shown = true })

// ---------------- s=1 我的行程 ----------------
// 分类按服务端汇总里的 type 分：住宿 / 二消（住店时加购的服务）= 旅居订单，活动 = 参与活动，换工 = 换宿旅行，兼职 / 全职 = 兼职 / 全职旅行；
// 线上任务（在线）只在有单时多出一个分类，免得接过线上任务的人找不到进度。
// 顺序照主人原话（10-18）：旅居订单、参与活动、兼职旅行、全职旅行、换宿旅行
const CATS = [
  { key: 'stay', label: '旅居订单', types: ['住宿', '二消'], icon: 'bed' },
  { key: 'activity', label: '参与活动', types: ['活动'], icon: 'ticket' },
  { key: 'parttime', label: '兼职旅行', types: ['兼职'], icon: 'briefcase' },
  { key: 'fulltime', label: '全职旅行', types: ['全职'], icon: 'briefcase-business' },
  { key: 'volunteer', label: '换宿旅行', types: ['换工'], icon: 'heart-handshake' },
  { key: 'online', label: '线上任务', types: ['在线'], icon: 'laptop', optional: true }
]
// 旅居订单的小页签：待付款的单放在「进行中」里（还要去付款），已结束 / 未到店算「已完成」，已取消算「退款」
const STAY_SUBS = ['进行中', '已完成', '退款']
const SUB_STATUS = { 进行中: ['待付款', '进行中'], 已完成: ['已完成', '已结束', '未到店'], 退款: ['退款', '已取消'] }
const OLD_TABS = { 待付款: '进行中', 进行中: '进行中', 已完成: '已完成', 退款: '退款' }
const cat = ref('stay')
const staySub = ref('进行中')
// 没有指定分类时，第一次读到数据后停在第一个有内容的分类（一个旅居订单都没有的人，进来不是一片空白）
let catPicked = false
const pickCat = (key) => { cat.value = key; catPicked = true }
const raw = ref([])
// 之前：加载中、加载失败都显示「暂无全部订单」，像是真的没有订单；现在分别如实显示，失败可点重试
const ordersState = ref('loading')
async function loadOrders() {
  if (!raw.value.length) ordersState.value = 'loading'
  try {
    raw.value = (await apiMyOrders()).data || []
    ordersState.value = 'ok'
    if (!catPicked) {
      const first = CATS.find(c => raw.value.some(o => c.types.includes(o.type)))
      if (first) cat.value = first.key
      catPicked = true
    }
  } catch (e) {
    if (!raw.value.length) ordersState.value = 'error'
    toast(errText(e, '订单加载失败'))
  }
}
const retryOrders = () => { if (ordersState.value === 'error') loadOrders() }
const FALLBACK = { 换工: 'orders-cafe', 兼职: 'orders-pottery', 全职: 'orders-room-cd', 在线: 'orders-pottery', 住宿: 'orders-room-hz', 活动: 'orders-market', 二消: 'orders-coffee' }
const isZero = (v) => v !== null && v !== undefined && String(v).trim() !== '' && Number(v) === 0
// 10-19 复查：卡片左上的类型用用户看得懂的名字（服务端 type 是内部叫法：换工 / 兼职 / 全职 / 在线 / 二消，分类还按它分）——
// 和上面分类、找机会四个页签同名；「二消」是店里的增值服务（stays/shop 页就叫「增值服务」）
const TYPE_LABEL = { 换工: '换宿旅行', 兼职: '兼职旅行', 全职: '全职旅行', 在线: '线上任务', 二消: '增值服务' }
const unitText = (u) => (!u || u === '元' ? '' : '/' + u.replace(/^元\//, ''))
const orders = computed(() => raw.value.map((o, i) => ({
  ...o,
  key: `${o.type}-${o.sortKey}-${i}`,
  typeLabel: TYPE_LABEL[o.type] || o.type,
  img: o.image ? absUrl(o.image) : '/static/media/cover-empty.png',
  // 10-19 复查：换工这类没有薪资的行程，服务端给的是 0 —— 不再显示「¥0/天」，这一格留空
  price: isZero(o.price) ? '' : /^\d/.test(o.price || '') ? '¥' + o.price : o.price,
  unit: !isZero(o.price) && /^\d/.test(o.price || '') ? unitText(o.unit) : ''
})))
const catOf = (key) => CATS.find(c => c.key === key) || CATS[0]
const inCat = (o, key) => catOf(key).types.includes(o.type)
const cats = computed(() => CATS.filter(c => !c.optional || raw.value.some(o => c.types.includes(o.type)) || cat.value === c.key)
  .map(c => ({ key: c.key, label: c.label, count: raw.value.filter(o => c.types.includes(o.type)).length })))
const filteredOrders = computed(() => orders.value.filter(o => inCat(o, cat.value) && (cat.value !== 'stay' || (SUB_STATUS[staySub.value] || []).includes(o.status))))
const catIcon = computed(() => catOf(cat.value).icon)
const EMPTY_TEXT = { activity: '还没有报名过活动，去社区「活动」看看', volunteer: '还没有换宿旅行，报名换工岗位后会出现在这里',
  parttime: '还没有兼职旅行', fulltime: '还没有全职旅行', online: '还没有线上任务' }
const emptyText = computed(() => (cat.value === 'stay' ? '没有' + staySub.value + '的旅居订单' : EMPTY_TEXT[cat.value]))
// 分类下面的一行入口：原「我的行程」时间线（按城市和日期排的行程、找搭子），原「我的活动」（我发起的、收藏的活动）
const catLink = computed(() => (cat.value === 'activity' ? { icon: 'flag', text: '我发起的活动、收藏的活动', url: R.activityMine + '?tab=mine' }
  : ['volunteer', 'parttime', 'fulltime', 'stay'].includes(cat.value) ? { icon: 'route', text: '按日期看行程时间线、找同行搭子', url: R.trip } : null))
let hidingRecord = false
const onOrderBtn = async (label, o) => {
  const b = (o.btns || []).find(x => x.label === label)
  if (b?.action === 'hideActivitySignup') {
    const owner = experience.account?.id
    if (hidingRecord || !owner || !o.signupId) return
    hidingRecord = true
    try {
      if (!(await confirm('移除这条记录', '从个人列表移除已取消或已退款的报名，后台记录仍会保留。确认移除？')) || experience.account?.id !== owner) return
      const res = await apiSignupHide(o.signupId)
      if (experience.account?.id !== owner) return
      raw.value = raw.value.filter(x => x.signupId !== o.signupId)
      toast(res.msg || '已移除记录')
    } catch (e) { toast(errText(e, '移除失败，请重试')) }
    finally { hidingRecord = false }
    return
  }
  if (b && b.url) go(b.url)
}

// ---------------- s=2 评价 ----------------
const reviewTabs = ['待评价', '已发布', '已精选']
const reviewTab = ref('待评价')
const rv = ref({ 待评价: [], 已发布: [], 已精选: [] })
async function loadReviews() {
  try {
    const [a, b, c] = await Promise.all([apiReviewsTodo(), apiReviewsMine(false), apiReviewsMine(true)])
    rv.value = { 待评价: a.data || [], 已发布: b.data || [], 已精选: c.data || [] }
  } catch (e) {
    toast(errText(e, '评价加载失败'))
  }
}
const REVIEW_IMG = { 岗位: 'orders-cafe', 换工: 'orders-cafe', 住宿: 'orders-room-thumb', 活动: 'orders-market' }
const reviewList = computed(() => (rv.value[reviewTab.value] || []).map((r, i) => ({
  ...r,
  key: `${r.bizType || 'mine'}-${r.bizId || r.reviewId}-${i}`,
  img: r.image ? absUrl(r.image) : '/static/media/cover-empty.png'
})))
const reviewTip = computed(() => {
  const n = (rv.value[reviewTab.value] || []).length
  if (reviewTab.value === '待评价') return n ? `有 ${n} 笔可以评价，完成后 30 天内有效` : '暂时没有待评价的订单'
  if (reviewTab.value === '已发布') return n ? '含联系方式等内容的评价会先隐藏，平台复核后展示' : '你还没有发布过评价'
  return n ? '被平台精选的评价会优先展示在门店页' : '还没有被精选的评价'
})
const writeReview = (r) => go(`${R.review}?bizType=${r.bizType}&bizId=${r.bizId}`)

// ---------------- s=3 提醒 ----------------
const pf = ref({ active: [], paused: [], note: '' })
async function loadPrefs() {
  try {
    pf.value = (await apiNotifyPrefs()).data || pf.value
  } catch (e) {
    toast(errText(e, '提醒设置加载失败'))
  }
}
const reminders = computed(() => pf.value.active || [])
const paused = computed(() => pf.value.paused || [])
const prefNote = computed(() => pf.value.note || '你可以根据需要调整提醒频率或暂停接收')
async function savePref(payload, tip) {
  try {
    pf.value = (await apiSetNotifyPref(payload)).data || pf.value
    if (tip) toast(tip)
  } catch (e) {
    toast(errText(e, '保存失败'))
  }
}
const togglePref = (r) => savePref({ key: r.key, enabled: !r.on }, r.on ? `已暂停「${r.title}」` : `已开启「${r.title}」`)
const enablePref = (r) => savePref({ key: r.key, enabled: true }, `已开启「${r.title}」`)
async function editPrefs() {
  const r = reminders.value.find(x => x.freqEditable)
  if (!r) return toast('新机会提醒已暂停，开启后可调整频率')
  const i = await sheet(['有新机会时即时提醒', '每天 9:00 汇总一次'])
  if (i < 0) return
  savePref({ key: r.key, freq: i === 0 ? 'instant' : 'daily' }, '已保存，所有岗位订阅都按这个频率提醒')
}

// ---------------- s=4 旅行体验官 ----------------
const perks = [
  { icon: 'map', color: 'green', title: '城市攻略', desc: '为你熟悉的城市写真实攻略' },
  { icon: 'bed', color: 'green', title: '合作体验', desc: '住宿等合作由运营单独沟通' },
  { icon: 'award', color: 'ochre', title: '审核通知', desc: '结果发到消息中心' }
]
const guide = ref({ latest: null, cities: [] })
async function loadGuide() {
  try {
    guide.value = (await apiGuideStatus()).data || guide.value
  } catch (e) {
    toast(errText(e, '加载失败'))
  }
}
const cities = computed(() => (guide.value.cities || []).slice(0, 5))
const cityCount = computed(() => `${(guide.value.cities || []).length} 个城市`)
const openCity = (c) => go(R.city + '?city=' + encodeURIComponent(c))
// 之前「N 个城市 >」「查看全部」打开的是城市页的全国切换城市屏，看不到这 N 个可创作城市；现在列出全部可创作城市，选一个进城市页
async function allCities() {
  const list = guide.value.cities || []
  if (!list.length) return toast('暂时没有可创作的城市')
  const i = await pickPaged(list, '可创作的城市')
  if (i >= 0) openCity(list[i])
}
const conditions = ['热爱旅行与生活，乐于分享真实体验', '内容原创，图文/视频均可，风格真实友好', '遵守平台规则，持续产出优质攻略', '近 30 天无违规记录']
const picked = ref([])
const pickedText = computed(() => (picked.value.length ? picked.value.join('、') : '请选择城市'))
const pickedStyle = computed(() => (picked.value.length ? 'color: var(--k-ink)' : ''))
async function pickCities() {
  const result = await selectCities({ selected: picked.value, max: 5, title: '创作城市' })
  if (result !== null) picked.value = result
}
async function locateCity() {
  let loc
  let coordinateType = 'wgs84'
  // #ifdef MP-WEIXIN
  coordinateType = 'gcj02'
  // #endif
  try {
    loc = await new Promise((resolve, reject) => uni.getLocation({ type: coordinateType, success: resolve, fail: reject }))
  } catch (e) {
    return toast('没有拿到定位，请手动选择城市')
  }
  try {
    const c = (await apiLocateCity(loc.latitude, loc.longitude, loc.accuracy, coordinateType)).data
    if (!c?.found || c.source !== 'administrative_boundary') return toast('暂时无法确认所在城市，请手动选择')
    if (picked.value.includes(c.name)) return toast(`已包含${c.name}`)
    if (picked.value.length >= 5) return toast('最多选 5 个城市')
    picked.value = [...picked.value, c.name]
    toast(`已加入${c.name}`)
  } catch (e) {
    toast(errText(e, '定位城市失败'))
  }
}
const plan = ref('')
// 只有正在输入时才渲染真的 textarea（见模板注释）
const editingPlan = ref(false)
const work = ref('')
const works = ref([])
const workHint = computed(() => (works.value.length ? `已添加 ${works.value.length} 个，可继续添加` : '添加作品链接或截图'))
async function addWork() {
  if (works.value.length >= 5) return toast('最多添加 5 个作品')
  const v = work.value.trim()
  if (v) {
    if (!/^https?:\/\//.test(v)) return toast('链接需以 http(s):// 开头')
    works.value.push(v)
    work.value = ''
    return toast(`已添加 ${works.value.length} 个作品`)
  }
  const i = await sheet(['填写作品链接', '上传作品截图'])
  if (i === 0) {
    const link = await prompt('作品链接', { placeholder: 'https://…' })
    if (!link) return
    if (!/^https?:\/\//.test(link)) return toast('链接需以 http(s):// 开头')
    works.value.push(link)
    toast(`已添加 ${works.value.length} 个作品`)
  }
  if (i === 1) {
    const path = await chooseImage()
    if (!path) return
    try {
      works.value.push((await uploadTo('/app/upload/image', path)).data.url)
      toast(`已添加 ${works.value.length} 个作品`)
    } catch (e) {
      toast(errText(e, '上传失败'))
    }
  }
}
const guideNote = computed(() => {
  const l = guide.value.latest
  if (!l) return '提交后 3 个工作日内审核，结果将通过消息通知'
  if (l.status === 'pending') return '你的申请正在审核中，结果会发到消息中心'
  if (l.status === 'approved') return '你的申请已通过；如需补充城市可再次提交'
  return `上次申请未通过：${l.auditNote || '—'}，修改后可重新提交`
})
// 提交要等服务端返回：连点会提交两份申请
const submitting = ref(false)
async function submit() {
  if (!picked.value.length) return toast('请选择城市')
  if (plan.value.trim().length < 10) return toast('创作计划至少写 10 个字')
  if (submitting.value) return
  const all = [...works.value]
  if (work.value.trim()) all.push(work.value.trim())
  submitting.value = true
  try {
    const res = await apiGuideApply({ cities: picked.value, plan: plan.value.trim(), works: all.join('\n') })
    toast((res.data && res.data.message) || '已提交')
    picked.value = []
    plan.value = ''
    work.value = ''
    works.value = []
    loadGuide()
  } catch (e) {
    toast(errText(e, '提交失败'))
  } finally {
    submitting.value = false
  }
}
</script>

<style scoped lang="scss">
@import '../../styles/look.scss';
.sec-title { display: block; font-family: var(--k-display-font); font-weight: 700; font-size: 15px; margin: 14px 0 10px; }
.sec-title--flat { margin: 0; }
.foot-note { display: block; text-align: center; font-size: 12px; color: var(--k-muted); margin-top: 20px; }
.foot-note--tight { margin-top: 12px; }

/* s1 我的行程（10-18）：顶栏下一排分类，选中暖棕粗字 + 下划线，右上角小数字；旅居订单下面一排等宽小胶囊 */
.cats { width: 100%; white-space: nowrap; border-bottom: 1px solid var(--k-line); background: var(--k-bg); }
.cats__row { display: inline-flex; align-items: center; padding: 0 6px; }
.cats__item { position: relative; flex: 0 0 auto; display: inline-flex; align-items: baseline; gap: 2px; height: 44px; line-height: 44px; padding: 0 12px; font-size: 15px; color: var(--k-ink2); white-space: nowrap; }
/* H5 的 text 默认 pre-line，外层 nowrap 管不到它：分类名自己也不折行 */
.cats__item text { white-space: nowrap; }
.cats__item.active { color: var(--k-red); font-weight: 700; }
.cats__item.active::after { content: ""; position: absolute; left: 50%; bottom: 0; width: 22px; height: 3px; margin-left: -11px; border-radius: 2px; background: var(--k-red); }
.cats__n { font-size: 11px; font-weight: 600; color: var(--k-light); }
.cats__item.active .cats__n { color: var(--k-red); }
.subs { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; }
.subs__item { height: 34px; border-radius: 17px; background: var(--k-paper); box-shadow: inset 0 0 0 1px var(--k-line); display: flex; align-items: center; justify-content: center; font-size: 14px; color: var(--k-ink2); }
.subs__item.on { background: var(--k-red-soft, #F5EBDD); box-shadow: inset 0 0 0 1px var(--k-red); color: var(--k-red-deep, #8A5E36); font-weight: 600; }
.jump { display: flex; align-items: center; gap: 6px; min-height: 44px; padding: 0 12px; border-radius: 12px; background: var(--k-paper); box-shadow: var(--k-sh1); }
.jump__text { flex: 1; min-width: 0; font-size: 13px; color: var(--k-ink2); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.empty { display: flex; flex-direction: column; align-items: center; gap: 10px; margin-top: 12px; padding: 32px 20px; border-radius: 16px; background: var(--k-paper); box-shadow: var(--k-sh1); text-align: center; }
.empty__ring { width: 64px; height: 64px; border-radius: 50%; background: var(--k-paper2); display: flex; align-items: center; justify-content: center; }
.list { padding: 10px 12px calc(96px + var(--k-safe-bottom)); display: flex; flex-direction: column; gap: 10px; }
/* 行程卡：白卡圆角 16、柔和阴影（不再用描边） */
.oc { background: var(--k-paper); border-radius: 16px; padding: 10px 12px 12px; box-shadow: var(--k-sh1); }
.oc__head { display: flex; align-items: center; gap: 6px; height: 22px; }
.oc__ic { width: 20px; height: 20px; border-radius: 50%; border: 1.3px solid; display: flex; align-items: center; justify-content: center; }
.oc__type { font-family: var(--k-display-font); font-weight: 700; font-size: 15px; }
.oc__dot { color: var(--k-light); font-size: 12px; }
.oc__status { font-size: 12px; font-weight: 500; }
.oc__status.is-green { color: var(--k-green); }
.oc__status.is-indigo { color: var(--k-indigo); }
.oc__status.is-ochre { color: #B07A2A; }
.oc__status.is-gray { color: var(--k-muted); }
.oc__body { display: flex; gap: 10px; margin-top: 6px; }
.oc__left { width: 108px; flex: 0 0 auto; display: flex; flex-direction: column; align-items: center; }
.oc__img { width: 108px; height: 72px; border-radius: 10px; }
.oc__deposit { margin-top: 6px; font-size: 13px; font-weight: 700; color: var(--k-red); white-space: nowrap; }
.oc__right { flex: 1; min-width: 0; display: flex; flex-direction: column; }
.oc__title { font-family: var(--k-display-font); font-weight: 700; font-size: 15px; line-height: 20px; }
.oc__meta { display: flex; align-items: center; gap: 4px; font-size: 11.5px; color: var(--k-muted); line-height: 16px; margin-top: 2px; white-space: nowrap; }
.oc__meta--row { justify-content: space-between; }
.oc__price { font-family: var(--k-sans); font-weight: 700; font-size: 15px; color: var(--k-ink); }
.oc__unit { font-family: var(--k-sans); font-weight: 400; font-size: 11px; color: var(--k-muted); }
.oc__signed { font-size: 12px; font-weight: 500; color: var(--k-green); }
/* 按钮多（如 去支付 / 查看进度 / 评价）时换行，不挤出卡片右边 */
.oc__btns { display: flex; flex-wrap: wrap; justify-content: flex-end; gap: 8px; margin-top: 6px; }
/* 地址一行放不下时省略：这一行不许换行，之前长地址直接撑出卡片 */
.oc__loc { min-width: 0; overflow: hidden; text-overflow: ellipsis; }
.oc__btn { min-width: 72px; height: 26px; padding: 0 10px; border-radius: 6px; display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: 500; }
.oc__btn.is-outline { background: var(--k-paper); border: 1px solid var(--k-line2); color: var(--k-ink); }
.oc__btn.is-primary { background: var(--k-red); color: #fff; }

/* s2 */
.tip { padding: 8px 16px; background: var(--k-paper2); font-size: 12px; color: var(--k-ink2); }
.rc { display: flex; align-items: center; gap: 12px; padding: 12px 10px 12px 10px; background: var(--k-paper); border: 1px solid var(--k-line); border-radius: 12px; margin-bottom: 10px; }
.rc__img { width: 44px; height: 44px; border-radius: 8px; flex: 0 0 auto; align-self: flex-start; }
.rc__name { font-family: var(--k-display-font); font-weight: 700; font-size: 15px; }
.rc__name--lg { font-size: 17px; }
.rc__sub { font-size: 12px; color: var(--k-muted); }
.rc__title { display: block; font-size: 13px; margin-top: 3px; }
.rc__time { display: block; font-size: 12px; color: var(--k-muted); margin-top: 3px; }
.rc__deadline { display: block; font-size: 13px; font-weight: 600; color: var(--k-red); margin-top: 3px; }
.rc__deadline--green { color: var(--k-green); }
.rc__btn { width: 78px; height: 34px; border-radius: 999px; border: 1.2px solid var(--k-red); color: var(--k-red); display: flex; align-items: center; justify-content: center; font-size: 14px; font-weight: 600; flex: 0 0 auto; }
.rights { background: var(--k-paper); border: 1px solid var(--k-line); border-radius: 12px; }
.rights__row { display: flex; align-items: center; gap: 14px; padding: 14px 14px; }
.rights__row--line { border-bottom: 1px solid var(--k-line); }
.rights__ic { width: 40px; height: 40px; }
.rights__title { display: block; font-family: var(--k-display-font); font-weight: 700; font-size: 15px; }
.rights__desc { display: block; font-size: 12px; color: var(--k-muted); line-height: 1.6; margin-top: 3px; white-space: pre-line; }

/* s3 */
.rem-head { padding: 10px 0 12px; }
.rem-card { background: var(--k-paper); border: 1px solid var(--k-line); border-radius: 12px; }
.rem { display: flex; align-items: center; gap: 12px; padding: 12px 12px; }
.rem--line { border-bottom: 1px solid var(--k-line); }
.rem__ic { width: 36px; height: 36px; display: flex; align-items: center; justify-content: center; flex: 0 0 auto; }
.rem__title { display: block; font-family: var(--k-display-font); font-weight: 700; font-size: 15px; }
.rem__desc { display: block; font-size: 12px; color: var(--k-muted); margin-top: 2px; }
.rem__freq { font-size: 12px; color: var(--k-muted); margin-right: 4px; white-space: nowrap; }
.rem__open { width: 44px; height: 26px; border-radius: 6px; border: 1px solid var(--k-red); color: var(--k-red); display: flex; align-items: center; justify-content: center; font-size: 12px; }
.rem-label { display: block; font-size: 13px; color: var(--k-muted); margin: 16px 0 8px; }

/* s4 */
.hero { width: 100%; display: block; }
.perks { display: flex; background: var(--k-paper); border: 1px solid var(--k-line); border-radius: 12px; padding: 10px 6px; }
.perk { flex: 1; min-width: 0; display: flex; flex-direction: column; align-items: center; gap: 5px; padding: 2px 6px; text-align: center; }
.perk .k-col { width: 100%; min-width: 0; align-items: center; }
.perk--line { border-right: 1px solid var(--k-line); }
.perk__ic { width: 28px; height: 28px; }
.perk__title { font-family: var(--k-display-font); font-weight: 700; font-size: 13px; white-space: nowrap; }
.perk__desc { margin-top: 2px; font-size: 11px; line-height: 1.45; color: var(--k-muted); white-space: normal; word-break: break-all; display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 2; overflow: hidden; }
/* 5 个城市 + 「查看全部」在 360–390px 宽一行放不下（之前挤出屏幕）；放不下就换行，城市名长的格子跟着变宽 */
.cities { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; margin-top: 10px; }
.city { min-width: 54px; padding: 0 8px; height: 34px; border-radius: 8px; background: var(--k-paper2); border: 1px solid var(--k-line); display: flex; align-items: center; justify-content: center; font-size: 14px; }
.city__all { margin-left: auto; }
.form { margin-top: 2px; }
.form__label { display: block; font-size: 13px; font-weight: 600; }
.plan { position: relative; align-items: flex-start; min-height: 74px; padding: 10px 12px 20px; }
.plan textarea { width: 100%; height: 40px; font-size: 14px; }
/* 不在输入时的占位 view：和上面的 textarea 一样大，长文字只预览两行 */
.plan .orders-area-idle { width: 100%; height: 40px; font-size: 14px; line-height: 20px; white-space: pre-wrap; word-break: break-all; overflow: hidden; }
.plan__counter { position: absolute; right: 12px; bottom: 6px; font-size: 11px; color: var(--k-light); }
.add { width: 46px; justify-content: center; padding: 0; flex: 0 0 auto; }
/* ---------------------------------------------------------------------------------------------------------------
   2026-10-19 一比一还原（全局视觉语言）：暖米渐变页面底、白卡圆角 20 + 柔阴影 + 细边、标题用标题字体（700 / 900）、主按钮暖棕渐变。只改样式
   --------------------------------------------------------------------------------------------------------------- */
.orders { --k-bg: #{$look-bg-top}; background: $look-bg; }
.cats__item { font-size: 15px; }
.cats__item.active { color: $look-chip-on-ink; font-family: var(--k-display-font); font-weight: 700; font-size: 16px; }
.cats__item.active::after { width: 20px; height: 4px; margin-left: -10px; border-radius: 2px; background: $look-grad-brown; }
/* 10-19 复查：五个（有线上任务时六个）分类在一屏里放下，不再横向滚动把「旅居订单」挤出屏幕：等分宽度、14px 字，数量做成右上角小角标不占宽度 */
.cats__row { display: flex; width: 100%; padding: 0 6px; box-sizing: border-box; gap: 6px; }
.cats__item { flex: 1 1 0; min-width: 0; justify-content: center; padding: 0; font-size: 13px; }
.cats__item.active { font-size: 14px; }
.cats__n { position: absolute; top: 4px; right: 0; line-height: 1; font-size: 10px; }
/* 有线上任务时六个分类：320 宽每格只有约 46px，13px 的「线上任务」放不下会压到旁边；去掉间距、字小 1px（320 宽每格 52px，刚好放下） */
.cats__row--6 { gap: 0; padding: 0 4px; }
.cats__row--6 .cats__item { font-size: 12px; }
.cats__row--6 .cats__item.active { font-size: 13px; }
.subs__item { border-radius: 999px; background: $look-chip-bg; box-shadow: none; }
.subs__item.on { background: $look-chip-on-bg; box-shadow: inset 0 0 0 1px $look-chip-on-line; color: $look-chip-on-ink; font-weight: 700; }
.jump, .empty { border-radius: 20px; border: $look-hairline; box-shadow: $look-shadow; }
.oc { border-radius: 20px; padding: 12px 14px 14px; border: $look-hairline; box-shadow: $look-shadow; }
.oc__type { font-size: 16px; }
.oc__img { border-radius: 12px; }
.oc__img--empty { display: flex; align-items: center; justify-content: center; background: linear-gradient(145deg, #FBF1E4 0%, #F3E1C8 100%); }
/* 320 宽：左图收到 92px；日期不在字中间折行（H5 的 text 默认 pre-line，要单独 nowrap），日期和价格一行放不下时价格整个换到下一行靠右，
   不再出现「10.18—10.19（1 / 晚）」 */
@media (max-width: 359px) { .oc__left, .oc__img { width: 92px; } .oc__img { height: 64px; } .oc__meta--row { flex-wrap: wrap; } .oc__meta--row text { white-space: nowrap; } .oc__price, .oc__signed { margin-left: auto; } }
.oc__title { font-size: 16px; line-height: 22px; }
.oc__price { font-family: var(--k-display-font); font-weight: 900; font-size: 17px; color: $look-brown; }
.oc__btn { height: 30px; padding: 0 14px; border-radius: 999px; font-weight: 600; }
.oc__btn.is-outline { border-color: rgba(201, 147, 95, .7); color: $look-chip-on-ink; }
.oc__btn.is-primary { background: $look-grad-brown; box-shadow: 0 4px 10px rgba(138, 90, 48, .22); }
.rc { border: $look-hairline; border-radius: 18px; background: #fff; box-shadow: $look-shadow-sm; }
.rc__btn { border-color: $look-chip-on-line; color: $look-chip-on-ink; }
@import './orders-premium.scss';
</style>
