<template>
  <view class="k-page pms">
    <k-topbar :title="titles[s - 1]" back custom-back @back="onBack" />
    <k-subscribe scenes="order" label="订阅旅居订单提醒" />
      <k-order-mediation merchant v-if="s===2" order-type="stay" :order-id="d.orderId" />

    <!-- 1 订单台 -->
    <view v-if="s === 1" class="pms-body k-pad-tab">
      <view class="desk-head">
        <view class="stay-pick" @click="pickStay"><k-icon name="house" :size="16" color="ink" /><text class="stay-pick__name">{{ stayName }}</text><k-icon v-if="stays.length > 1" name="chevron-down" :size="14" color="ink" /></view>
        <text class="desk-date">今天 {{ todayText }}</text>
      </view>
      <view class="tools">
        <view class="tool" @click="openBoard"><k-icon name="calendar-days" :size="22" color="red" :stroke="1.7" /><text>房态图</text></view>
        <view v-if="canEdit" class="tool" @click="autoAssign"><k-icon name="wand-sparkles" :size="22" color="red" :stroke="1.7" /><text>一键排房</text></view>
        <view v-if="canSetup" class="tool" @click="openUnits"><k-icon name="bed-double" :size="22" color="red" :stroke="1.7" /><text>房间床位</text></view>
      </view>
      <scroll-view scroll-x class="tabs" :show-scrollbar="false">
        <view class="tabs__row">
          <view v-for="t in tabs" :key="t.key" class="tab" :class="{ on: tab === t.key && !keyword, warn: t.key === 'unassigned' && t.count > 0 }" @click="setTab(t.key)"><text>{{ t.label }}</text><text class="tab__n">{{ t.count }}</text></view>
        </view>
      </scroll-view>
      <view class="search" @click="askKeyword"><k-icon name="search" :size="16" color="muted" /><text class="search__text">{{ keyword || '搜索客人姓名 / 手机号 / 订单号' }}</text><text v-if="keyword" class="search__clear" @click.stop="clearKeyword">清除</text></view>
      <text v-if="keyword" class="search-tip">在本店全部房源、全部状态的订单里搜（含已离店、未到店）；点上面的分组回到分组查看</text>
      <view v-if="loading && !orders.length" class="state"><text>正在加载…</text></view>
      <view v-else-if="error" class="state"><text>{{ error }}</text><k-button size="sm" type="outline" label="重新加载" @click="loadDesk" /></view>
      <view v-else-if="!orders.length" class="state"><k-icon name="clipboard-check" :size="36" color="muted" /><text>{{ emptyText }}</text></view>
      <view v-for="o in orders" :key="o.orderNo" class="order" @click="openOrder(o.orderNo)">
        <view class="order__top"><text class="order__guest">{{ o.guestName }}</text><text class="order__status" :class="'is-' + o.status">{{ o.statusLabel }}</text></view>
        <text class="order__line">{{ o.typeName }} · {{ o.unitsText }}</text>
        <text class="order__line">{{ o.dateText }}<text v-if="o.arriveTime">　预计 {{ o.arriveTime }} 到店</text></text>
        <view class="order__room" :class="{ miss: o.missing > 0 }"><k-icon name="bed-double" :size="14" :color="o.missing > 0 ? 'alert' : 'green'" /><text>{{ roomText(o) }}</text></view>
        <text v-if="o.remark" class="order__note">客人备注：{{ o.remark }}</text>
        <text v-if="o.staffNote" class="order__note">内部备注：{{ o.staffNote }}</text>
        <text v-if="o.checkInHint" class="order__hint">{{ o.checkInHint }}</text>
        <view v-if="o.canAssign || o.canCheckIn || o.canCheckOut" class="order__acts" @click.stop>
          <k-button v-if="o.canAssign" size="sm" :type="o.missing > 0 ? 'primary' : 'outline'" :label="o.missing > 0 ? '排房' : '换房'" @click="startAssign(o.orderNo)" />
          <k-button v-if="o.canCheckIn" size="sm" type="green" label="办理入住" @click="doCheckIn(o)" />
          <k-button v-if="o.canCheckOut" size="sm" type="outline" :label="o.early ? '提前退房' : '办理退房'" @click="doCheckOut(o)" />
        </view>
      </view>
    </view>

    <!-- 2 订单详情 -->
    <view v-else-if="s === 2" class="pms-body k-pad-tab" :class="{ 'has-bar': d.canCheckIn || d.canCheckOut }">
      <view v-if="!d.orderNo" class="state"><text>{{ detailError || '正在加载…' }}</text></view>
      <template v-else>
        <view class="card">
          <view class="order__top"><text class="order__guest">{{ d.guestName }}</text><text class="order__status" :class="'is-' + d.status">{{ d.statusLabel }}</text></view>
          <view class="kv"><text>订单号</text><text @click="copyNo">{{ d.orderNo }}　复制</text></view>
          <view class="kv"><text>房源 / 房型</text><text>{{ d.stayName }} · {{ d.typeName }}</text></view>
          <view class="kv"><text>入住</text><text>{{ d.checkIn }} → {{ d.checkOut }}{{ nightsText(d) }}</text></view>
          <view class="kv"><text>人数</text><text>{{ d.unitsText }}</text></view>
          <view class="kv"><text>手机</text><text :class="{ link: d.phoneVisible }" @click="callGuest">{{ d.guestPhone }}{{ d.phoneVisible ? '　拨打' : '' }}</text></view>
          <view v-if="d.arriveTime" class="kv"><text>预计到店</text><text>{{ d.arriveTime }}</text></view>
          <view v-if="d.remark" class="kv"><text>客人备注</text><text>{{ d.remark }}</text></view>
          <view class="kv"><text>实付</text><text>¥{{ yuan(d.payFen) }}<text v-if="d.refundedFen" class="refunded">（已退 ¥{{ yuan(d.refundedFen) }}）</text><text v-if="d.refundPendingFen" class="refunded">（退款处理中 ¥{{ yuan(d.refundPendingFen) }}）</text></text></view>
        </view>
        <view class="card">
          <view class="card__head"><text class="card__title">排房</text><text v-if="d.missing > 0" class="warn-text">还差 {{ d.missing }} 个{{ unitWord(d) }}</text></view>
          <text v-if="!d.assignments.length" class="muted-line">还没有排房</text>
          <view v-for="a in d.assignments" :key="a.unitId + a.from" class="assign"><k-icon name="bed-double" :size="16" color="green" /><text>{{ a.text }}</text></view>
          <view v-if="d.canAssign" class="card__acts">
            <k-button size="sm" :type="d.missing > 0 ? 'primary' : 'outline'" :label="d.assignments.length ? '换房' : '排房'" @click="startAssign(d.orderNo)" />
            <k-button v-if="d.assignments.length" size="sm" type="ghost" label="取消排房" @click="doUnassign" />
          </view>
        </view>
        <stay-after-refund v-if="canEdit && ['checked_in','completed'].includes(d.status)" :order-no="d.orderNo" staff />
        <view class="card" @click="editNote">
          <view class="card__head"><text class="card__title">内部备注</text><text v-if="d.canNote" class="link">编辑</text></view>
          <text class="muted-line">{{ d.staffNote || '只有本店员工能看到，例如：要下铺、晚到、已收押金' }}</text>
        </view>
        <view v-if="d.canRefund || d.refundHint" class="card">
          <view class="card__head"><text class="card__title">给客人退款</text><text v-if="d.canRefund" class="muted-line">最多 ¥{{ yuan(d.refundMaxFen) }}</text></view>
          <text v-if="d.refundHint" class="muted-line">{{ d.refundHint }}</text>
          <template v-if="d.canRefund && !['checked_in','completed'].includes(d.status)">
            <view class="rf-row"><text class="rf-row__label">金额</text><view class="rf-input"><text>¥</text><input v-model="rf.amount" type="digit" maxlength="11" placeholder="0.01 起，可不按取消政策" placeholder-class="k-placeholder" /></view><text class="link rf-all" @click="fillAll">全额</text></view>
            <view class="rf-row"><text class="rf-row__label">原因</text><view class="rf-input"><input v-model="rf.reason" maxlength="100" placeholder="必填，客人能看到，如：空调故障补偿" placeholder-class="k-placeholder" /></view></view>
            <text class="rf-count">{{ rf.reason.length }}/100</text>
            <k-button block size="md" type="secondary" :disabled="rf.saving" :label="rf.saving ? '正在提交…' : '退款给客人'" @click="doRefund" />
          </template>
        </view>
        <view class="card">
          <text class="card__title">记录</text>
          <view v-for="t in d.timeline" :key="t.time + t.label" class="step"><text class="step__time">{{ t.time }}</text><text>{{ t.label }}</text></view>
        </view>
        <text v-if="d.checkInHint" class="order__hint center">{{ d.checkInHint }}</text>
        <view v-if="d.canCheckIn || d.canCheckOut" class="bottom-acts">
          <k-button v-if="d.canCheckIn" block type="green" label="办理入住" @click="doCheckIn(d)" />
          <k-button v-if="d.canCheckOut" block type="outline" :label="d.early ? '提前退房' : '办理退房'" @click="doCheckOut(d)" />
        </view>
      </template>
    </view>

    <!-- 3 选择房间 / 床位 -->
    <view v-else-if="s === 3" class="pms-body k-pad-tab has-bar">
      <view v-if="!pick.need" class="state"><text>请先在订单台选一张订单，再给它排房</text><k-button size="sm" type="outline" label="去订单台" @click="s = 1" /></view>
      <view v-else class="pick-head"><text class="card__title">{{ pick.typeName }}</text><text>{{ pick.from ? md(pick.from) + ' → ' + md(pick.to) + '，' : '' }}需要 {{ pick.need }} 个{{ pick.unitLabel === '床位' ? '床位' : '房间' }}</text></view>
      <view v-if="pick.hint" class="state"><text>{{ pick.hint }}</text><k-button v-if="canSetup" size="sm" type="outline" label="去设置房间床位" @click="openUnits" /></view>
      <view class="units-grid">
        <view v-for="u in pick.units" :key="u.unitId" class="unit" :class="{ on: chosen.includes(u.unitId), busy: !u.free, off: u.disabled }" @click="toggleUnit(u)">
          <text class="unit__name">{{ u.unitName }}</text>
          <text class="unit__sub">{{ u.disabled ? '已停用' : (u.free ? (u.mine ? '当前排的' : '空') : u.busyText) }}</text>
        </view>
      </view>
      <view v-if="pick.need" class="pick-bar"><k-button block :disabled="!chosen.length || saving" :label="'确认排房（已选 ' + chosen.length + ' / ' + pick.need + '）'" @click="confirmAssign" /></view>
    </view>

    <!-- 4 房态图 -->
    <view v-else-if="s === 4" class="pms-body k-pad-tab">
      <view class="span-switch"><text v-for="o in SPANS" :key="o.days" class="span-switch__item" :class="{ on: boardDays === o.days }" @click="setSpan(o.days)">{{ o.label }}</text></view>
      <view class="week-nav"><view class="week-nav__btn" hover-class="k-press" @click="shiftWeek(-1)"><k-icon name="chevron-left" :size="12" color="#8A5E36" /><text>{{ spanNav[0] }}</text></view><text class="week-nav__mid" @click="shiftWeek(0)">{{ boardRange }}</text><view class="week-nav__btn" hover-class="k-press" @click="shiftWeek(1)"><text>{{ spanNav[1] }}</text><k-icon name="chevron-right" :size="12" color="#8A5E36" /></view></view>
      <text v-if="boardDays > 7" class="scroll-tip">日期多，左右滑动看后面的日子；房间名固定在左边</text>
      <view class="legend"><view><text class="dot is-booked" />待入住</view><view><text class="dot is-in" />在住</view><view><text class="dot is-done" />已离店</view><view><text class="dot is-closed" />关房 / 停用</view></view>
      <view v-if="board.waiting" class="waiting-bar" @click="backToUnassigned"><k-icon name="circle-alert" :size="15" color="alert" /><text>今天起还有 {{ board.waiting }} 个房间 / 床位没排，去排房</text><k-icon name="chevron-right" :size="12" color="alert" /></view>
      <view v-if="boardError" class="state"><text>{{ boardError }}</text><k-button size="sm" type="outline" label="重新加载" @click="loadBoard" /></view>
      <view v-else-if="!(board.types || []).length" class="state"><text>{{ boardLoading ? '正在加载房态…' : '这个房源还没有房型，请先在「房源管理」里添加' }}</text></view>
      <view v-for="t in board.types" :key="t.roomTypeId" class="board-type">
        <view class="board-type__head"><text class="card__title">{{ t.typeName }}</text><text v-if="t.offline" class="muted-line">已下架</text></view>
        <!-- 房间名一列固定在左边，日期格子在右边单独左右滑动（两周 / 一个月时一格固定宽度，手机上也看得清） -->
        <view class="grid">
          <view class="grid__body">
            <view class="grid__names">
              <view class="row row--head"><view class="cell cell--label" /></view>
              <view class="row row--stat"><view class="cell cell--label"><text>剩余</text></view></view>
              <view v-for="u in t.units" :key="u.unitId" class="row"><view class="cell cell--label" :class="{ off: u.disabled }"><text>{{ u.unitName }}</text></view></view>
            </view>
            <scroll-view scroll-x class="grid__scroll" :show-scrollbar="false">
              <view class="grid__days" :class="{ wide: boardDays > 7 }" :style="boardDays > 7 ? 'width:' + (board.dates.length * 44) + 'px' : ''">
                <view class="row row--head"><view v-for="dt in board.dates" :key="dt.date" class="cell cell--date" :class="{ today: dt.today }"><text>{{ dt.label }}</text><text>{{ dt.week }}</text></view></view>
                <view class="row row--stat"><view v-for="p in t.perDate" :key="p.date" class="cell cell--stat" :class="{ closed: p.closed }"><text>{{ p.closed ? '关' : p.left }}</text><text v-if="p.waiting" class="waiting">待排{{ p.waiting }}</text></view></view>
                <view v-for="u in t.units" :key="u.unitId" class="row">
                  <view v-for="c in u.cells" :key="c.date" class="cell" :class="'is-' + c.state" @click="tapCell(c, u)"><text v-if="c.head" class="cell__guest">{{ c.guest }}</text></view>
                </view>
              </view>
            </scroll-view>
          </view>
          <text v-if="t.unitHint" class="row-hint">{{ t.unitHint }}</text>
        </view>
      </view>
    </view>

    <!-- 5 房间 / 床位设置 -->
    <view v-else class="pms-body k-pad-tab">
      <text class="tip">在每个房型下设置具体的房间号（多人间按床位设置），排房时从这里选。每晚能卖多少仍按房型库存，在「房源管理 → 房态」里改。</text>
      <view v-for="t in unitTypes" :key="t.roomTypeId" class="card">
        <view class="card__head"><text class="card__title">{{ t.typeName }}</text><text class="muted-line">每晚可卖 {{ t.stock }} 个{{ t.unitLabel }}</text></view>
        <text v-if="t.hint" class="warn-text block">{{ t.hint }}</text>
        <view class="uchips"><view v-for="u in t.units" :key="u.unitId" class="uchip" :class="{ off: u.status === '1' }" @click="unitMenu(u)"><text>{{ u.unitName }}</text><text v-if="u.status === '1'" class="uchip__off">停用</text></view></view>
        <k-button size="sm" type="outline" :label="'＋ 批量添加' + t.unitLabel" @click="addUnits(t)" />
      </view>
      <view v-if="!unitTypes.length" class="state"><text>这个房源还没有房型，请先在「房源管理」里添加房型</text></view>
    </view>
    <k-tabbar mode="staff" active="business" />
  </view>
</template>

<script setup>
import StayAfterRefund from '../stays/components/stay-after-refund.vue'
// ---------------------------------------------------------------------------
// 旅居订单台（员工端，类似民宿 PMS）：
//   s=1 订单台：待排房 / 今日到店 / 在住 / 今日离店 / 近期订单 / 已结束（近 60 天已离店、未到店，主理人还能退款）；
//       卡片上直接排房、办理入住、办理退房；搜索不分组、不分房源，按本店全部订单搜
//   s=2 订单详情：客人与订单信息、排房、内部备注（客人看不到）、给客人退款（只有主理人，金额自己填）、记录
//   s=3 选择房间 / 床位：只列这张订单房型下的房间床位，标出这几晚是否空着；多人间订几个床位就选几个
//   s=4 房态图：一屏一周 / 两周 / 一个月（记在本机），房间 / 床位 × 日期，点有人的格子看订单
//   s=5 房间床位设置（小院主理人 / 城市负责人 / 本店合作商家，入口按接口的 canSetup）：批量添加、改名、停用、删除
// 库存（能卖多少）仍按房型的间数 / 床位数，排房只决定谁住哪一间；新订单消息带 ?orderNo= 直接打开这一单
// ---------------------------------------------------------------------------
import { ref, computed, watch } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { useScreen, back, toast } from '@/common/screen.js'
import {
  apiPmsOverview, apiPmsOrders, apiPmsOrder, apiPmsUnitOptions, apiPmsAssign, apiPmsUnassign, apiPmsCheckIn, apiPmsCheckOut,
  apiPmsNote, apiPmsAutoAssign, apiPmsBoard, apiPmsUnits, apiPmsAddUnits, apiPmsUpdateUnit, apiPmsRemoveUnit, apiPmsRefund
} from '@/common/api.js'
import { ensureSession, hasStaffAccess, currentStaffStoreId, getSessionRevision } from '@/common/experience.js'
import { sheet, prompt, confirm, alert, copy, errText, yuan, todayCn, shiftDate } from '@/common/ui.js'

const titles = ['旅居订单', '订单详情', '选择房间 / 床位', '房态图', '房间床位设置']
// 进页那一屏返回离开本页；页内点进去的屏返回上一屏（详情回到它的来源：订单台或房态图）
let landing = 1
let booted = false
// 业务页带 ?storeId= 进来时按那家门店看（保持字符串，不转 Number）；没带就用员工端当前门店
let viewStoreId = null
const storeParam = () => viewStoreId || currentStaffStoreId() || undefined
let detailFrom = 1
const s = useScreen(5, {
  onLoad: async (q) => {
    await ensureSession()
    if (!hasStaffAccess.value) return toast('当前账号没有员工授权')
    const no = String(q?.orderNo || '').trim()
    if (q?.storeId) viewStoreId = q.storeId
    // 从「每日概况」点小院进来（2026-10-17）：?stayId= 直接看那家小院；?tab= 停在对应分组（今日到店 / 今日离店 / 在住）；
    // ?start= 配合 s=4 房态图从那天开始看（订单台的分组都按今天算，看别的日子用房态图）
    if (Number(q?.stayId) > 0) stayId.value = Number(q.stayId)
    // 工作台今日概览点进来（?allStays=1）：那三个数是全店合计，这里也先看全部房源，数字才对得上
    else if (q?.allStays) allStaysLink = true
    if (['unassigned', 'arrivals', 'inhouse', 'departures', 'upcoming', 'done'].includes(q?.tab)) tab.value = q.tab
    if (/^\d{4}-\d{2}-\d{2}$/.test(q?.start || '')) boardStart.value = q.start
    await loadOverview()
    if (no) { landing = 2; detailFrom = 1; await openOrder(no) }
    else {
      landing = s.value
      if (s.value === 4) loadBoard()
      else if (s.value === 5) loadUnits()
      else loadDesk()
    }
    booted = true
  }
})
const onBack = () => {
  if (s.value === landing) return back()
  if (s.value === 3) { s.value = 2; return }
  if (s.value === 2) { s.value = detailFrom; return }
  s.value = 1
}
watch(s, (v) => { if (booted && v === 1) loadDesk() })
onShow(() => { if (booted && s.value === 1) loadDesk(true) })

const todayText = computed(() => md(todayCn()))
const md = (ymd) => { const m = /^\d{4}-(\d{2})-(\d{2})/.exec(String(ymd || '')); return m ? `${+m[1]}月${+m[2]}日` : '' }
const unitWord = (o) => (o.unitLabel === '床位' ? '床位' : '房间')
// 「（3 晚）」：dateText 形如「10月12日 - 10月15日 · 3 晚」，取不到就不显示括号
const nightsText = (o) => {
  const n = String(o.dateText || '').split(' · ')[1]
  return n ? '（' + n + '）' : ''
}
// 入住 / 退房 / 排房 / 备注 / 房间设置都是写请求：确认框弹出前连点两下会办理两次
let acting = false
const once = async (fn) => {
  if (acting) return
  acting = true
  try { return await fn() } finally { acting = false }
}
const roomText = (o) => {
  const has = (o.assigned || []).join('、')
  if (o.missing > 0) return has ? `已排 ${has}，还差 ${o.missing} 个${unitWord(o)}` : `还没排房（需要 ${o.units} 个${unitWord(o)}）`
  return has ? `已排 ${has}` : '未排房'
}

// ---------------- 门店 / 房源 / 分组 ----------------
const stays = ref([])
const stayId = ref(null)
let allStaysLink = false
const tabs = ref([])
const canEdit = ref(false)
const canSetup = ref(false)
const stayName = computed(() => (stays.value.find(x => String(x.stayId) === String(stayId.value)) || {}).stayName || (stays.value.length ? '全部房源' : '本店还没有房源'))
let overviewSeq = 0
async function loadOverview() {
  const seq = ++overviewSeq, rev = getSessionRevision()
  try {
    const data = (await apiPmsOverview({ storeId: storeParam(), stayId: stayId.value || undefined })).data || {}
    if (seq !== overviewSeq || rev !== getSessionRevision()) return
    stays.value = data.stays || []
    if (!stayId.value && stays.value.length && !(allStaysLink && stays.value.length > 1)) stayId.value = stays.value[0].stayId
    tabs.value = data.tabs || []
    canEdit.value = !!data.canEdit
    canSetup.value = !!data.canSetup
  } catch (e) {
    if (seq === overviewSeq) toast(errText(e, '订单台加载失败'))
  }
}
// 默认看服务端排在第一的房源（有进行中订单的、已上线的在前）；没上线的在选择菜单里标出来
const STAY_OFF = { draft: '草稿', pending: '审核中', rejected: '未通过', offline: '已下架' }
async function pickStay() {
  if (stays.value.length < 2) return
  // 「全部房源」只在订单台第一屏、从工作台概览进来时有：房态图、房间设置都得选定一处
  const withAll = allStaysLink && s.value === 1
  const i = await sheet((withAll ? ['全部房源'] : []).concat(stays.value.map(x => x.stayName + (STAY_OFF[x.status] ? `（${STAY_OFF[x.status]}）` : ''))))
  if (i < 0) return
  stayId.value = withAll && i === 0 ? null : stays.value[withAll ? i - 1 : i].stayId
  if (s.value === 4) loadBoard()
  else { await loadOverview(); loadDesk() }
}

// ---------------- s=1 订单台 ----------------
const tab = ref('unassigned')
const keyword = ref('')
const orders = ref([])
const loading = ref(false)
const error = ref('')
const EMPTY = { unassigned: '订单都排好房了', arrivals: '今天没有到店的客人', inhouse: '现在没有在住的客人', departures: '今天没有要退房的客人', upcoming: '近期没有订单', done: '近 60 天没有已离店或未到店的订单' }
const emptyText = computed(() => (keyword.value ? '没有找到相关订单' : EMPTY[tab.value]))
let deskSeq = 0
async function loadDesk(quiet) {
  const seq = ++deskSeq, rev = getSessionRevision()
  if (!quiet) loading.value = true
  error.value = ''
  try {
    const [rows] = await Promise.all([
      apiPmsOrders({ storeId: storeParam(), stayId: stayId.value || undefined, tab: tab.value, keyword: keyword.value || undefined }),
      loadOverview()
    ])
    if (seq !== deskSeq || rev !== getSessionRevision()) return
    orders.value = rows.data || []
  } catch (e) {
    if (seq !== deskSeq) return
    orders.value = []
    error.value = errText(e, '订单加载失败')
  } finally {
    if (seq === deskSeq) loading.value = false
  }
}
// 搜索时不分组：点分组＝退出搜索、看这个分组
const setTab = (t) => { tab.value = t; keyword.value = ''; orders.value = []; loadDesk() }
async function askKeyword() {
  const v = await prompt('搜索订单', { value: keyword.value, placeholder: '客人姓名 / 手机号 / 订单号' })
  if (v === null) return
  keyword.value = v
  loadDesk()
}
const clearKeyword = () => { keyword.value = ''; loadDesk() }
async function autoAssign() {
  if (!stayId.value) return toast('请先选择房源')
  if (acting) return
  if (!(await confirm('一键排房', '把今天起 30 天内还没排房的订单，按入住先后排到空着的房间 / 床位上（同一张订单尽量排在相邻的床位）。已排好的订单不变，确认？'))) return
  await once(async () => {
    try {
      const res = await apiPmsAutoAssign(stayId.value, 30)
      const r = res.data || {}
      if ((r.failed || []).length) await alert('一键排房', (res.msg || '') + '\n\n没排上的：\n' + r.failed.join('\n'))
      else toast(res.msg || '已排好')
      loadDesk()
    } catch (e) { toast(errText(e, '排房失败')) }
  })
}

// ---------------- s=2 订单详情 ----------------
const d = ref({ assignments: [], timeline: [] })
const detailError = ref('')
let detailSeq = 0
async function openOrder(orderNo, from) {
  const seq = ++detailSeq, rev = getSessionRevision()
  if (from) detailFrom = from
  else if (s.value === 1 || s.value === 4) detailFrom = s.value
  d.value = { assignments: [], timeline: [] }
  detailError.value = ''
  resetRefund()
  s.value = 2
  try {
    const data = (await apiPmsOrder(orderNo)).data
    if (seq !== detailSeq || rev !== getSessionRevision()) return
    d.value = data || { assignments: [], timeline: [] }
  } catch (e) {
    if (seq === detailSeq) detailError.value = errText(e, '订单打开失败')
  }
}
const copyNo = () => copy(d.value.orderNo, '已复制订单号')
function callGuest() {
  if (!d.value.phoneVisible) return toast('当前角色只能看到脱敏手机号')
  uni.makePhoneCall({ phoneNumber: String(d.value.guestPhone), fail: () => {} })
}
async function editNote() {
  if (!d.value.canNote) return
  const no = d.value.orderNo
  const v = await prompt('内部备注', { value: d.value.staffNote || '', placeholder: '只有本店员工能看到（最多 255 字）' })
  if (v === null || d.value.orderNo !== no) return
  if (v.length > 255) return toast('备注最多 255 字')
  await once(async () => {
    try { d.value = (await apiPmsNote(no, v)).data || d.value; toast('备注已保存') } catch (e) { toast(errText(e, '保存失败')) }
  })
}
async function doUnassign() {
  const no = d.value.orderNo
  if (acting) return
  if (!(await confirm('取消排房', '撤掉这张订单的排房（已经住过的晚上保留记录），确认？')) || d.value.orderNo !== no) return
  await once(async () => {
    try { d.value = (await apiPmsUnassign(no)).data || d.value; toast('已取消排房') } catch (e) { toast(errText(e, '操作失败')) }
  })
}
async function doCheckIn(o) {
  const tip = o.missing > 0 ? `\n这张订单还差 ${o.missing} 个${unitWord(o)}没排，建议先排房。` : ''
  if (acting) return
  if (!(await confirm('办理入住', `${o.guestName} · ${o.typeName}\n${o.dateText}\n请先核对客人身份证件。${tip}`))) return
  await once(async () => {
    try {
      const res = await apiPmsCheckIn(o.orderNo)
      toast(res.msg || '已办理入住')
      if (s.value === 2 && d.value.orderNo === o.orderNo) d.value = res.data || d.value
      else loadDesk()
    } catch (e) { toast(errText(e, '办理失败')) }
  })
}
async function doCheckOut(o) {
  const content = o.early ? `${o.guestName} 原定 ${o.checkOut} 离店，现在提前退房。\n没住的晚上会还回房态，可以重新预订；客人还没用的增值服务会转退款审核；房费需要退钱请走退款流程。` : `${o.guestName} · ${o.typeName}\n确认已查房、钥匙已归还？`
  if (acting) return
  if (!(await confirm(o.early ? '提前退房' : '办理退房', content))) return
  await once(async () => {
    try {
      const res = await apiPmsCheckOut(o.orderNo)
      toast(res.msg || '已办理退房')
      if (s.value === 2 && d.value.orderNo === o.orderNo) d.value = res.data || d.value
      else loadDesk()
    } catch (e) { toast(errText(e, '办理失败')) }
  })
}

// ---------------- s=2 给客人退款（门店主动退款） ----------------
// 之前门店只能审核客人按取消政策提交的退款；现在主理人可以在订单详情里直接退，金额自己填（0.01 元到还没退的余额）、
// 原因必填（客人能看到）。待入住的单全额退会取消订单、空出房间；部分退或入住后退订单状态不变。
// 每次确认生成一个提交编号：网络超时再点一次，服务端认出是同一次，只退一次；被拒（金额 / 状态不对）后再提交换新编号
const rf = ref({ amount: '', reason: '', saving: false, idem: '' })
const resetRefund = () => { rf.value = { amount: '', reason: '', saving: false, idem: '' } }
/** '12.5' → 1250 分；最多两位小数，填错返回 0 */
function toFen(text) {
  const v = String(text || '').trim()
  if (!/^\d{1,8}(\.\d{1,2})?$/.test(v)) return 0
  const [a, b = ''] = v.split('.')
  return Number(a) * 100 + Number((b + '00').slice(0, 2))
}
const fillAll = () => { rf.value.amount = yuan(d.value.refundMaxFen) }
async function doRefund() {
  if (rf.value.saving) return
  const no = d.value.orderNo
  const fen = toFen(rf.value.amount)
  const max = Number(d.value.refundMaxFen || 0)
  if (!fen) return toast('请填写退款金额（元，最多两位小数）')
  if (fen > max) return toast(`最多还能退 ¥${yuan(max)}`)
  const why = rf.value.reason.trim()
  if (!why) return toast('请填写退款原因，客人会看到')
  const effect = d.value.status === 'refund_pending' ? '客人已申请退款，这样等于按这个金额同意，订单会取消。'
    : (d.value.status === 'confirmed' && fen === max ? '全额退款后订单取消，房间空出来可以重新预订。' : '订单状态不变，不影响入住。')
  if (!(await confirm('确认退款', `退给 ${d.value.guestName} ¥${yuan(fen)}\n钱会原路退回客人的微信支付，退出去不能撤回。\n${effect}\n原因：${why}`)) || d.value.orderNo !== no) return
  if (!rf.value.idem) rf.value.idem = 'r' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
  rf.value.saving = true
  try {
    const res = await apiPmsRefund(no, { amountFen: fen, reason: why, idemKey: rf.value.idem })
    if (d.value.orderNo !== no) return
    d.value = res.data || d.value
    resetRefund()
    await alert('退款已提交', res.msg || '已退款')
  } catch (e) {
    if (d.value.orderNo !== no) return
    // 服务端明确拒绝（金额、状态、权限）：改完再提交算新的一次；网络失败保留编号，再点一次不会重复退
    if (e && [403, 404, 409, 422].includes(e.code)) rf.value.idem = ''
    toast(errText(e, '退款失败'))
    if (e && e.code === 409) apiPmsOrder(no).then(r => { if (d.value.orderNo === no && r.data) d.value = r.data }).catch(() => {})
  } finally { rf.value.saving = false }
}

// ---------------- s=3 选择房间 / 床位 ----------------
const pick = ref({ units: [] })
const chosen = ref([])
const saving = ref(false)
let pickOrderNo = ''
async function startAssign(orderNo) {
  if (s.value === 1) detailFrom = 1
  try {
    const data = (await apiPmsUnitOptions(orderNo)).data || { units: [] }
    pickOrderNo = orderNo
    pick.value = data
    chosen.value = (data.units || []).filter(u => u.mine).map(u => u.unitId).slice(0, data.need)
    if (s.value === 1) { d.value = { orderNo, assignments: [], timeline: [] }; apiPmsOrder(orderNo).then(r => { if (d.value.orderNo === orderNo) d.value = r.data || d.value }).catch(() => {}) }
    s.value = 3
  } catch (e) { toast(errText(e, '加载房间床位失败')) }
}
function toggleUnit(u) {
  if (u.disabled) return toast('这个' + (pick.value.unitLabel === '床位' ? '床位' : '房间') + '已停用')
  if (!u.free) return toast('这几晚有人住：' + u.busyText)
  const i = chosen.value.indexOf(u.unitId)
  if (i >= 0) { chosen.value.splice(i, 1); return }
  if (chosen.value.length >= Number(pick.value.need || 1)) {
    if (Number(pick.value.need) === 1) { chosen.value = [u.unitId]; return }
    return toast('这张订单只需要 ' + pick.value.need + ' 个，先取消一个再选')
  }
  chosen.value.push(u.unitId)
}
async function confirmAssign() {
  if (saving.value || !chosen.value.length) return
  saving.value = true
  try {
    const res = await apiPmsAssign(pickOrderNo, chosen.value)
    toast(res.msg || '排房成功')
    d.value = res.data || d.value
    s.value = 2
  } catch (e) {
    toast(errText(e, '排房失败'))
    try { const data = (await apiPmsUnitOptions(pickOrderNo)).data; if (data) pick.value = data } catch (err) { /* 保留原列表 */ }
  } finally { saving.value = false }
}

// ---------------- s=4 房态图 ----------------
const board = ref({ dates: [], types: [], waiting: 0 })
const boardStart = ref(todayCn())
const boardError = ref('')
const boardLoading = ref(false)
// 之前一屏固定 7 天；现在可选一周 / 两周 / 一个月，翻页按选中的天数翻，选择记在本机（换手机或清缓存回到一周）
const SPANS = [{ days: 7, label: '一周', nav: ['上一周', '下一周'] }, { days: 14, label: '两周', nav: ['前两周', '后两周'] }, { days: 30, label: '一个月', nav: ['前30天', '后30天'] }]
const SPAN_KEY = 'kangaroo:pms-board-days'
const readSpan = () => { try { const v = Number(uni.getStorageSync(SPAN_KEY)); return SPANS.some(o => o.days === v) ? v : 7 } catch (e) { return 7 } }
const boardDays = ref(readSpan())
const spanNav = computed(() => (SPANS.find(o => o.days === boardDays.value) || SPANS[0]).nav)
function setSpan(n) {
  if (boardDays.value === n) return
  boardDays.value = n
  try { uni.setStorageSync(SPAN_KEY, n) } catch (e) { /* 存不下只影响下次打开时的默认天数 */ }
  loadBoard()
}
const boardRange = computed(() => (board.value.dates.length ? board.value.dates[0].label + ' - ' + board.value.dates[board.value.dates.length - 1].label : '本周'))
let boardSeq = 0
async function loadBoard() {
  if (!stayId.value && stays.value.length) stayId.value = stays.value[0].stayId
  if (!stayId.value) { boardError.value = '本店还没有房源'; return }
  const seq = ++boardSeq, rev = getSessionRevision()
  boardError.value = ''
  boardLoading.value = true
  try {
    const data = (await apiPmsBoard({ stayId: stayId.value, start: boardStart.value, days: boardDays.value })).data
    if (seq !== boardSeq || rev !== getSessionRevision()) return
    board.value = data || { dates: [], types: [], waiting: 0 }
  } catch (e) {
    if (seq === boardSeq) boardError.value = errText(e, '房态加载失败')
  } finally {
    if (seq === boardSeq) boardLoading.value = false
  }
}
const openBoard = () => { s.value = 4; loadBoard() }
const shiftWeek = (n) => { boardStart.value = n === 0 ? todayCn() : shiftDate(boardStart.value, n * boardDays.value); loadBoard() }
const backToUnassigned = () => { tab.value = 'unassigned'; s.value = 1 }
function tapCell(c, u) {
  if (c.orderNo) return openOrder(c.orderNo, 4)
  if (c.state === 'disabled') return toast(u.unitName + ' 已停用')
  if (c.state === 'closed') return toast(md(c.date) + ' 关房')
  toast(u.unitName + ' ' + md(c.date) + ' 空着')
}

// ---------------- s=5 房间床位设置 ----------------
const unitTypes = ref([])
async function loadUnits() {
  if (!stayId.value && stays.value.length) stayId.value = stays.value[0].stayId
  if (!stayId.value) return
  try { unitTypes.value = (await apiPmsUnits(stayId.value)).data || [] } catch (e) { toast(errText(e, '加载失败')) }
}
const openUnits = () => { s.value = 5; loadUnits() }
/** 「201-1号床, 201-2号床」逗号 / 空格 / 换行分隔；或「A 1-8」「201-1号床 到 201-6号床」这种首尾带数字的范围自动展开 */
function parseNames(text) {
  const out = []
  for (const part of String(text || '').split(/[,，、;；\n]+/)) {
    const v = part.trim()
    if (!v) continue
    const m = /^(.*?)(\d+)\s*(?:-|~|～|到|至)\s*(\d+)(.*)$/.exec(v)
    if (m && Number(m[3]) >= Number(m[2]) && Number(m[3]) - Number(m[2]) < 200 && !/\d$/.test(m[1])) {
      for (let i = Number(m[2]); i <= Number(m[3]); i++) out.push((m[1] + i + m[4]).trim())
    } else out.push(...v.split(/\s+/).filter(Boolean))
  }
  return out
}
async function addUnits(t) {
  const example = t.unitLabel === '床位' ? '例：201-1号床,201-2号床 或 201-床位 1-6' : '例：201,202,203 或 房间 1-8'
  const v = await prompt('批量添加' + t.unitLabel, { placeholder: example })
  if (!v) return
  const names = parseNames(v)
  if (!names.length) return toast('没有识别到名称')
  if (!(await confirm('批量添加' + t.unitLabel, `将在「${t.typeName}」添加 ${names.length} 个：\n${names.slice(0, 12).join('、')}${names.length > 12 ? ' …' : ''}`))) return
  await once(async () => {
    try { unitTypes.value = (await apiPmsAddUnits(t.roomTypeId, names)).data || unitTypes.value; toast('已添加') } catch (e) { toast(errText(e, '添加失败')) }
  })
}
async function unitMenu(u) {
  const off = u.status === '1'
  const i = await sheet(['改名', off ? '启用' : '停用（维修 / 不排房）', '删除'])
  if (i < 0) return
  try {
    if (i === 0) {
      const v = await prompt('改名', { value: u.unitName, placeholder: '房间号 / 床位号' })
      if (!v) return
      unitTypes.value = (await apiPmsUpdateUnit(u.unitId, { name: v })).data || unitTypes.value
    } else if (i === 1) {
      unitTypes.value = (await apiPmsUpdateUnit(u.unitId, { status: off ? '0' : '1' })).data || unitTypes.value
    } else {
      if (!(await confirm('删除', `删除「${u.unitName}」？今天以后还排着客人的不能删除。`))) return
      unitTypes.value = (await apiPmsRemoveUnit(u.unitId)).data || unitTypes.value
    }
    toast('已保存')
  } catch (e) { toast(errText(e, '操作失败')) }
}
</script>

<style scoped lang="scss">
/* 2026-11-17 改版「小而精」：浅灰底 + 白卡（12 圆角、不描边、不加阴影），页边距 12、卡片之间 8。
   订单卡：客人名 15 / 600，状态是一枚小标签；分组页签、搜索框收成白色胶囊（28 / 36 高），选中是暖棕；
   房态图的色块换成主题里的琥珀 / 豆绿浅底；底部办理入住 / 退房的操作条是白底加一条细线。金额、状态、提示文字都没动 */
.pms { --k-bg: #F7F5F2; --k-sh1: none; background: var(--k-bg); }
.pms :deep(.k-navbar__title) { font-family: var(--k-sans); font-size: 16px; font-weight: 600; }
.pms :deep(.k-button) { border-radius: 999px; }
.pms-body { padding: 8px 12px 96px; }
.pms-body.has-bar { padding-bottom: calc(150px + var(--k-safe-bottom)); }
.desk-head { display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 4px 2px 10px; }
.stay-pick { min-width: 0; min-height: 28px; display: flex; align-items: center; gap: 6px; font-family: var(--k-sans); font-size: 17px; font-weight: 700; }
.stay-pick__name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.desk-date { flex-shrink: 0; color: var(--k-muted); font-size: 12px; }
.tools { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; }
.tool { height: 64px; border-radius: 12px; background: var(--k-paper); display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 5px; font-size: 12px; font-weight: 500; color: var(--k-ink2); }
.tabs { margin-top: 10px; white-space: nowrap; }
.tabs__row { display: inline-flex; flex-wrap: nowrap; gap: 6px; padding-right: 12px; }
.tab { flex-shrink: 0; white-space: nowrap; height: 28px; padding: 0 12px; border-radius: 999px; background: var(--k-paper); display: inline-flex; align-items: center; gap: 4px; font-size: 12px; color: var(--k-ink2); }
.tab__n { min-width: 14px; text-align: center; color: var(--k-muted); font-size: 11px; }
/* 11-18 精修词典「筛选胶囊」：选中是浅棕底 + 深棕字，不再是整块实心渐变（实心只留给页面主按钮） */
.tab.on { background: var(--k-red-soft); color: var(--k-red-deep); font-weight: 500; }
.tab.on .tab__n { color: var(--k-red-deep); }
.tab.warn:not(.on) .tab__n { color: var(--k-alert); font-weight: 700; }
.search { margin: 8px 0; height: 36px; padding: 0 12px; border-radius: 18px; background: var(--k-paper); display: flex; align-items: center; gap: 8px; color: var(--k-muted); font-size: 13px; }
.search__text { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.search__clear { color: var(--k-red-deep); font-size: 12px; }
.search-tip { display: block; margin: -2px 4px 8px; color: var(--k-muted); font-size: 11px; line-height: 1.6; }
/* 空 / 加载 / 出错：放进白卡（词典「空状态」），上下留白 28 */
.state { margin-bottom: 8px; display: flex; flex-direction: column; align-items: center; gap: 8px; padding: 28px 12px; border-radius: 12px; background: var(--k-paper); color: var(--k-ink2); font-size: 14px; text-align: center; line-height: 1.6; }
.order, .card { margin-bottom: 8px; padding: 12px; border-radius: 12px; background: var(--k-paper); display: flex; flex-direction: column; gap: 5px; }
.order__top, .card__head { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
.order__guest { min-width: 0; overflow-wrap: anywhere; font-family: var(--k-sans); font-size: 15px; font-weight: 600; line-height: 22px; }
.order__status { flex-shrink: 0; height: 17px; padding: 0 5px; border-radius: 4px; background: var(--k-ochre-soft); color: var(--k-ochre-deep); font-size: 10px; font-weight: 500; line-height: 17px; }
.order__status.is-checked_in { background: var(--k-green-soft); color: var(--k-green); }
.order__status.is-completed, .order__status.is-no_show, .order__status.is-cancelled, .order__status.is-closed { background: #F5F1EB; color: var(--k-muted); }
.order__status.is-refund_pending, .order__status.is-refunding { background: var(--k-alert-soft); color: var(--k-alert); }
.order__line { color: var(--k-ink2); font-size: 13px; line-height: 19px; }
.order__room { display: flex; align-items: center; gap: 5px; color: var(--k-green); font-size: 12px; font-weight: 500; }
.order__room.miss { color: var(--k-alert); }
.order__note { color: var(--k-muted); font-size: 12px; overflow-wrap: anywhere; }
.order__hint { color: var(--k-muted); font-size: 11px; }
.order__hint.center { display: block; text-align: center; margin: 6px 0; }
.order__acts, .card__acts { display: flex; justify-content: flex-end; flex-wrap: wrap; gap: 8px; margin-top: 5px; }
/* 列表里每张卡都有的操作改成「小按钮」浅色胶囊（28 高、12 / 500）：排房棕浅底、办理入住绿浅底、换房 / 退房白底棕细边；
   一屏不再一排实心块。详情页 .card__acts 和底部 .bottom-acts 的实心按钮不动 */
.order__acts :deep(.k-button.is-sm) { height: 28px; padding: 0 12px; font-size: 12px; font-weight: 500; box-shadow: none; }
.order__acts :deep(.k-button.is-primary) { background: var(--k-red-soft); color: var(--k-red-deep); }
.order__acts :deep(.k-button.is-green) { background: var(--k-green-soft); color: var(--k-green); }
.order__acts :deep(.k-button.is-outline) { border-color: var(--k-red-line); color: var(--k-red-deep); }
.card__title { font-family: var(--k-sans); font-size: 15px; font-weight: 700; line-height: 22px; }
/* 信息行之间用发丝线（1px 再压成一半），最后一行不画 */
.kv { position: relative; display: flex; justify-content: space-between; gap: 14px; padding: 7px 0; font-size: 13px; }
.kv::after { content: ''; position: absolute; left: 0; right: 0; bottom: 0; height: 1px; background: var(--k-line); transform: scaleY(.5); }
.kv > text:first-child { flex-shrink: 0; color: var(--k-muted); }
.kv > text:last-child { text-align: right; overflow-wrap: anywhere; }
.card .kv:last-child { padding-bottom: 2px; }
.card .kv:last-child::after { display: none; }
.link { color: var(--k-red-deep); }
.muted-line { color: var(--k-muted); font-size: 12px; line-height: 1.6; }
.warn-text { color: var(--k-alert); font-size: 12px; font-weight: 600; }
.warn-text.block { display: block; line-height: 1.6; }
.assign { display: flex; align-items: center; gap: 8px; font-size: 13px; }
.step { display: flex; gap: 12px; font-size: 12px; padding: 4px 0; }
.step__time { flex-shrink: 0; color: var(--k-muted); width: 112px; }
/* 底栏 2026-11-17 起是 50 高：操作条贴着它，中间不留缝；下边多留 10，让开底栏中间凸起来的「发布」圆钮（凸出 16） */
.bottom-acts { position: fixed; left: 0; right: 0; bottom: calc(50px + var(--k-safe-bottom)); z-index: 30; padding: 8px 12px 18px; background: var(--k-paper); display: flex; gap: 10px; }
/* 两个底部操作条顶上是一条发丝线 */
.bottom-acts::before, .pick-bar::before { content: ''; position: absolute; left: 0; right: 0; top: 0; height: 1px; background: var(--k-line); transform: scaleY(.5); }
.pick-head { display: flex; flex-direction: column; gap: 2px; padding: 4px 2px 10px; font-size: 12px; color: var(--k-muted); }
.pick-head .card__title { color: var(--k-ink); }
.units-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; }
.unit { min-height: 60px; padding: 8px; border: 1px solid transparent; border-radius: 10px; background: var(--k-paper); display: flex; flex-direction: column; justify-content: center; gap: 3px; }
.unit__name { font-size: 14px; font-weight: 600; overflow-wrap: anywhere; }
.unit__sub { color: var(--k-green); font-size: 11px; }
.unit.on { border-color: var(--k-red); background: var(--k-red-soft); }
.unit.on .unit__sub { color: var(--k-red-deep); }
.unit.busy { background: #EEEBE6; }
.unit.busy .unit__sub, .unit.off .unit__sub { color: var(--k-muted); }
.unit.off { opacity: .55; }
.pick-bar { position: fixed; left: 0; right: 0; bottom: calc(50px + var(--k-safe-bottom)); z-index: 30; padding: 8px 12px 18px; background: var(--k-paper); }
.week-nav { display: flex; align-items: center; justify-content: space-between; height: 40px; font-size: 13px; color: var(--k-red-deep); }
/* 翻页：文字 + 12 号小箭头（不再用 ‹ › 字符），点按范围撑满 40 高 */
.week-nav__btn { display: flex; align-items: center; gap: 2px; min-height: 40px; }
.week-nav__mid { color: var(--k-ink); font-weight: 600; }
.legend { display: flex; flex-wrap: wrap; gap: 12px; padding-bottom: 8px; color: var(--k-muted); font-size: 11px; }
.legend > view { display: flex; align-items: center; gap: 4px; }
.dot { width: 12px; height: 12px; border-radius: 3px; border: 1px solid var(--k-line2); }
.dot.is-booked { border-color: #E2C692; }
.dot.is-in { border-color: #B5CBA4; }
.dot.is-done { border-color: #D9D3CB; }
.waiting-bar { min-height: 36px; margin-bottom: 8px; padding: 8px 12px; border-radius: 12px; background: var(--k-alert-soft); color: var(--k-alert); display: flex; align-items: center; gap: 6px; font-size: 12px; }
.waiting-bar > text { flex: 1; min-width: 0; }
.board-type { margin-bottom: 12px; }
.board-type__head { display: flex; align-items: center; justify-content: space-between; padding: 4px 2px 6px; }
.grid { border-radius: 12px; overflow: hidden; background: var(--k-paper); }
.row { display: flex; border-top: 1px solid var(--k-line); }
.row:first-child { border-top: 0; }
.cell { flex: 1; min-width: 0; height: 40px; border-left: 1px solid var(--k-line); display: flex; flex-direction: column; align-items: center; justify-content: center; font-size: 11px; overflow: hidden; }
.cell--label { flex: 0 0 72px; border-left: 0; padding: 0 6px 0 8px; align-items: flex-start; font-size: 12px; font-weight: 500; overflow-wrap: anywhere; }
.cell--label.off { color: var(--k-light); text-decoration: line-through; }
.cell--date { height: 44px; color: var(--k-muted); }
.cell--date.today { color: var(--k-red-deep); font-weight: 700; }
.cell--stat { height: 38px; color: var(--k-ink); }
.cell--stat.closed { color: var(--k-light); }
.waiting { color: var(--k-alert); font-weight: 700; }
.cell__guest { padding: 0 2px; white-space: nowrap; font-size: 11px; font-weight: 600; }
.is-free { background: var(--k-paper); }
.is-booked { background: var(--k-ochre-soft); color: var(--k-ochre-deep); }
.is-in { background: var(--k-green-soft); color: var(--k-green); }
.is-done { background: #F0EDE8; color: var(--k-muted); }
.is-refund { background: var(--k-alert-soft); color: var(--k-alert); }
.is-closed, .is-disabled { background: repeating-linear-gradient(135deg, #ECE9E4 0 4px, #F7F5F2 4px 8px); }
.row-hint { display: block; padding: 10px 12px; color: var(--k-muted); font-size: 12px; border-top: 1px solid var(--k-line); }
/* 房态图：左边房间名一列固定，右边日期格子单独左右滑；两周 / 一个月时每格固定 44px，不再挤成一条线 */
.grid__body { display: flex; }
.grid__names { flex: 0 0 72px; width: 72px; border-right: 1px solid var(--k-line); }
.grid__scroll { flex: 1; width: 0; min-width: 0; }
.grid__days { width: 100%; }
.grid__days .row > .cell:first-child { border-left: 0; }
.grid__days.wide .cell { flex: 0 0 44px; width: 44px; }
.row--head .cell { height: 44px; }
.row--stat .cell { height: 38px; }
/* 一周 / 两周 / 一个月：词典「分段控件」——#F0EBE4 轨道 32 高，选中是白块 13 / 600 / 墨色 */
.span-switch { display: inline-flex; align-items: center; height: 32px; margin: 2px 0 4px; padding: 2px; border-radius: 16px; background: #F0EBE4; box-sizing: border-box; }
.span-switch__item { height: 28px; line-height: 28px; padding: 0 14px; border-radius: 14px; font-size: 13px; color: var(--k-ink2); }
.span-switch__item.on { background: var(--k-paper); color: var(--k-ink); font-weight: 600; }
.scroll-tip { display: block; margin-bottom: 6px; color: var(--k-muted); font-size: 11px; }
/* 给客人退款 */
.refunded { color: var(--k-alert); }
.rf-row { display: flex; align-items: center; gap: 10px; margin-top: 4px; }
.rf-row__label { flex-shrink: 0; width: 32px; color: var(--k-muted); font-size: 13px; }
.rf-input { flex: 1; min-width: 0; height: 40px; padding: 0 10px; border: 1px solid var(--k-line2); border-radius: 10px; background: var(--k-paper); display: flex; align-items: center; gap: 4px; font-size: 14px; }
.rf-input > input { flex: 1; min-width: 0; height: 38px; font-size: 14px; }
.rf-all { flex-shrink: 0; font-size: 13px; }
.rf-count { align-self: flex-end; color: var(--k-light); font-size: 11px; }
.tip { display: block; margin: 0 2px 10px; color: var(--k-muted); font-size: 12px; line-height: 1.7; }
.uchips { display: flex; flex-wrap: wrap; gap: 8px; margin: 4px 0 6px; }
.uchip { padding: 6px 10px; border-radius: 8px; background: #F5F1EB; display: flex; align-items: center; gap: 4px; font-size: 13px; }
.uchip.off { color: var(--k-light); }
.uchip__off { font-size: 11px; color: var(--k-red-deep); }
</style>
