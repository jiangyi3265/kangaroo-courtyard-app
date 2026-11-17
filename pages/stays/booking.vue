<template>
  <k-feature-gate feature="stay-booking">
  <view class="k-page booking-page">
    <k-topbar :title="titles[s - 1]" back custom-back @back="onBack" />
    <k-subscribe scenes="order" label="订阅预订后续提醒" />

    <view v-if="entryLoading || entryError" class="booking-state booking-state--initial">
      <k-icon :name="entryLoading ? 'clock' : 'info'" :size="28" color="muted" />
      <text>{{ entryLoading ? (directCalendar ? '正在加载所选房型…' : '正在加载房源信息…') : entryError }}</text>
      <view v-if="entryError && stayId && !missingEntryRoom" class="booking-retry" role="button" @click="init">重新加载</view>
      <view v-else-if="entryError" class="booking-retry" role="button" @click="back">{{ missingEntryRoom ? '返回重选房型' : '返回选择房源' }}</view>
    </view>
    <view v-else-if="s === 1" class="type-body">
      <!-- 2026-11-03 主人：简化 —— 房型不超过 5 个时不出筛选条（几张卡一眼就看完了，筛选只会多一步） -->
      <view v-if="allRoomTypes.length > 5" class="filters"><view v-for="(item, i) in roomFilterLabels" :key="i" @click="filterRooms(i)"><text>{{ item }}</text><k-icon name="chevron-down" :size="16" color="ink" /></view></view>
      <view v-if="roomsLoading" class="rooms-empty">正在加载房型价格与余量…</view><view v-else-if="roomsError" class="rooms-empty"><text>{{ roomsError }}</text><view class="booking-retry" role="button" @click="loadRooms">重新加载</view></view>
      <view v-if="roomsLoaded && !roomTypes.length" class="rooms-empty"><text>{{ allRoomTypes.length ? '没有符合筛选条件的房型，请调整筛选' : '该房源暂未上架可订房型' }}</text></view><view class="type-list"><view v-for="room in roomTypes" :key="room.roomTypeId" class="type-card" :style="selRoomId === room.roomTypeId ? 'border-color: var(--k-red)' : ''" @click="selectRoom(room)"><view class="type-media"><image :src="absUrl(room.image) || '/static/media/cover-empty.png'" mode="aspectFill" /><view v-if="room.features.length" class="type-features"><view v-for="item in room.features" :key="item"><k-icon :name="iconOf(item)" :size="15" color="muted" /><text>{{ item }}</text></view></view></view><view class="type-main"><view class="type-title"><text>{{ room.name }}</text><k-chip v-if="room.promo" tone="ochre"><text>早鸟价</text></k-chip><k-chip v-if="stay.safeCert" tone="green"><text>安心住</text></k-chip></view><text class="type-desc">{{ room.desc }}</text><text>床型： {{ room.bed }}</text><text>面积： {{ room.area }}</text><text>入住： {{ room.people }}</text><view class="type-pricing">
          <view class="type-period-price">
            <text class="type-price-label">7天总价（7晚）</text>
            <view class="type-price" :class="{ 'is-long': room.price.length > 5 }"><text>{{ room.price === '--' ? '待查询' : '¥' + room.price }}</text></view>
            <text v-if="room.weekUnavailable" class="type-price-note">7天暂无空房</text>
            <text class="stay-period-options">{{ room.periodText }}</text>
          </view>
          <view class="type-selected-price">
            <text class="type-price-label">所选{{ nightCount }}晚总价</text>
            <text class="type-selected-amount">{{ room.selectedPrice === '--' ? '待查询' : '¥' + room.selectedPrice }}</text>
            <text class="type-price-dates">{{ state.checkIn.slice(5).replace('-', '/') }}—{{ state.checkOut.slice(5).replace('-', '/') }}</text>
            <text v-if="!room.bookable" class="type-price-note">所选日期不可订</text>
          </view>
        </view><view class="type-foot"><text v-if="room.remainText" class="remain">{{ room.remainText }}</text><view class="type-select" :class="{ selected: selRoomId === room.roomTypeId, unavailable: !room.bookable }"><text>{{ selRoomId === room.roomTypeId ? '已选' : (room.bookable ? '选择' : '换个日期') }}</text></view></view></view></view></view>
      <view class="selected" @click="next1"><k-icon name="calendar-check" :size="20" color="ink" /><text class="selected__text">已选 {{ inText }} — {{ outText }} · {{ nightCount }}晚 · {{ state.guests }}人</text><text class="selected__edit">改日期</text><k-icon name="chevron-right" :size="14" color="red" /></view><!-- 每一步的「下一步」固定在屏幕底部：房型、日历一长，按钮就落到屏幕外，用户以为没有下一步 -->
      <k-bottom><view class="cta__btn"><k-button block :disabled="roomsLoading || !roomsLoaded" label="下一步：查看房态日历" @click="next1" /></view></k-bottom>
    </view>

    <view v-else-if="s === 2" class="calendar-body">
      <view class="booking-rule"><k-icon name="calendar-check" :size="18" color="red" /><text>一周起订，至少 {{ MIN_NIGHTS }} 晚</text></view>
      <view class="duration-options" aria-label="选择入住时长">
        <button v-for="item in durations" :key="item.nights" class="duration-option" :class="{ 'is-active': nightCount === item.nights }" :aria-pressed="nightCount === item.nights" hover-class="duration-pressed" @click="selectDuration(item.nights)"><text>{{ item.label }}</text><text>{{ item.nights }}晚</text></button>
      </view>
      <text class="duration-hint">按入住日期逐晚计算房费；半月为15晚，一个月为30晚，也可在日历自选离店日。</text>
      <view v-if="calendarLoading" class="booking-state">正在加载房态日历…</view><view v-else-if="calendarError" class="booking-state"><text>{{ calendarError }}</text><view class="booking-retry" role="button" @click="loadCalendar(calendarMonth)">重新加载日历</view></view>
      <view class="selected-room"><text>{{ selRoom.name || '' }}　　{{ inText }}　—　{{ outText }}　　{{ nightCount }}晚　｜　{{ state.guests }}人</text></view>
      <!-- 2026-11-03 主人：简化 —— 换月只用「‹ 月 ›」左右箭头，月份文字不再弹选择菜单 -->
      <view class="month-head"><view class="month-arrow" @click="shiftMonth(-1)"><k-icon name="chevron-left" :size="25" color="ink" /></view><text>{{ cal.month || '' }}</text><view class="month-arrow" @click="shiftMonth(1)"><k-icon name="chevron-right" :size="25" color="ink" /></view></view><view class="week"><text v-for="d in weeks" :key="d">{{ d }}</text></view><view class="calendar-grid"><view v-for="(day,i) in calendar" :key="i" :class="{ selected: day.selected, outside: day.outside }" @click="tapDay(day)"><text>{{ day.date }}</text><text v-if="day.price">¥{{ day.price }}</text><text v-if="day.note">{{ day.note }}</text></view></view><view class="legend"><view><text class="green-box" /> <text>可订</text></view><view><text class="gray-box" /> <text>已满</text></view></view><view class="calendar-total card"><text>已选： {{ inText }}　—　{{ outText }}　（{{ nightCount }}晚）</text><view><text>连住{{ nightCount }}晚 总价</text><view><text>¥{{ q ? yuan(q.payFen) : '--' }}</text><text>均价　¥{{ avgText }} / 晚</text></view></view></view>
      <view v-if="quoteError" class="booking-state"><text>{{ quoteError }}</text><view class="booking-retry" role="button" @click="requote">重新查询报价</view></view>
      <k-bottom><view class="cta__sum"><text class="cta__price">¥{{ q ? yuan(q.payFen) : '--' }}</text><text class="cta__meta">{{ nightCount }}晚 · {{ state.guests }}人</text></view><view class="cta__btn"><k-button block :disabled="quoteLoading || calendarLoading || !!calendarError" :label="quoteLoading ? '正在查询报价' : '下一步：确认订单'" @click="next2" /></view></k-bottom>
    </view>

  </view>
</k-feature-gate>
</template>

<script setup>
import { isAssistedStay } from './booking-channel.js'
import { bookingPriceDisplay } from './period-price.js'
import { stayBookingEnabled, refreshFeatures } from '@/common/features.js'
import { watch as watchStayGate } from 'vue'
// ---------------------------------------------------------------------------
// 房型与房态日历（业务键 stayId，可带 roomTypeId / promoId / vlogId）：
//   早鸟（promoId）只对它自己的那个房型有效：房型列表标出「早鸟价」并默认选中；选别的房型按日常价报价、下单，不带 promoId
//   只有匹配早鸟活动的房型才带 promoId。
//   s=1 房型：apiStayRoomTypes（所选日期逐晚余量的最小值、可住人数），点卡片选中
//   s=2 房态日历：apiStayCalendar（每晚价格与状态），第一次点选入住、第二次点选离店；总价由 apiStayQuote 服务端算
//   2026-10-18 主人：下单后不要再出现「活动加购」这一步 —— 房态日历之后直接进确认订单（pay.vue），
//   原来第 4 屏「活动套餐加购」整屏去掉；pay.vue 仍认老链接里的 acts 参数（没有就是不加购）
//   2026-11-03 主人：简化 —— 房型 ≤5 个不出筛选条；换月只用左右箭头，不再弹月份菜单
// ---------------------------------------------------------------------------
import { absUrl } from '@/common/upload.js'
import { ref, computed } from 'vue'
import { useScreen, back, go, toast } from '@/common/screen.js'
import { apiStayDetail, apiStayRoomTypes, apiStayCalendar, apiStayQuote } from '@/common/api.js'
import { errText, sheet, yuan, shiftDate } from '@/common/ui.js'
import { stayState, normalizeDates, saveStayState, nightsBetween, dayText, weekText } from './stays-state.js'
import { MIN_NIGHTS } from './stays-range.js'
import R from '@/common/routes.js'

let stayId = 0
let promoId = 0
let vlogId = 0
const entryRoomId = ref(0)
const directCalendar = computed(() => entryRoomId.value > 0)
const s = useScreen(2, {
  onLoad: (q) => {
    stayId = Number(q?.stayId) || 0
    promoId = Number(q?.promoId) || 0
    vlogId = Number(q?.vlogId) || 0
    const roomId = Number(q?.roomTypeId)
    entryRoomId.value = Number.isSafeInteger(roomId) && roomId > 0 ? roomId : 0
    selRoomId.value = entryRoomId.value || null
    s.value = directCalendar.value ? 2 : 1
    init()
  }
})
const titles = ['房型选择', '房态日历']
const state = stayState
const nightCount = computed(() => nightsBetween(state.checkIn, state.checkOut))
const inText = computed(() => `${dayText(state.checkIn)} ${weekText(state.checkIn)}`)
const outText = computed(() => `${dayText(state.checkOut)} ${weekText(state.checkOut)}`)
const stay = ref({})
const stayLoading = ref(true)
const stayError = ref('')
const entryLoading = computed(() => stayLoading.value || (directCalendar.value && roomsLoading.value))
const missingEntryRoom = computed(() => directCalendar.value && roomsLoaded.value && !selRoomId.value)
const entryError = computed(() => stayError.value || (directCalendar.value
  ? roomsError.value || (missingEntryRoom.value ? '所选房型已下架或不存在，请返回重新选择' : '') : ''))

async function init() {
  if(!(await refreshFeatures()).stayBookingEnabled) return
  normalizeDates()
  // 重试仍查询用户最初选中的房型，不因失败改成其他房型。
  if (directCalendar.value) selRoomId.value = entryRoomId.value
  stayError.value = ''
  if (!stayId) { stayLoading.value = false; stayError.value = '没有找到要预订的房源，请返回重新选择'; return }
  stayLoading.value = true
  try {
    const detail = (await apiStayDetail(stayId)).data
    if (!detail?.stayName) throw new Error('房源不存在或已下架')
    if (isAssistedStay(detail)) {
      stayError.value = '自营房源请联系订房助手'
      uni.redirectTo({ url: R.stayDetail + '?stayId=' + stayId, fail: () => toast('请返回房源详情联系订房助手') })
      return
    }
    stay.value = detail
  } catch (e) {
    stayError.value = errText(e, '房源信息加载失败，请重试')
    return
  } finally { stayLoading.value = false }
  await loadRooms()
  if (!roomsLoaded.value || missingEntryRoom.value) return
  if (promoId && roomsLoaded.value) {
    const promoRoom = roomRows.value.find(r => r.promo)
    if (!promoRoom) toast('早鸟特价已售罄或已结束，可按日常价预订')
    else if (!selRoomId.value) selRoomId.value = promoRoom.roomTypeId
    // 详情页点的是别的房型卡片：和在这里改选一样，说明按日常价
    else if (selRoom.value.roomTypeId && !selRoom.value.promo) toast('这个房型不参加早鸟特价，按日常价预订')
  }
  if (selRoomId.value) {
    requote()
    if (directCalendar.value) next1()
  }
}

// ---------------- s=1 房型 ----------------
const roomRows = ref([])
const selRoomId = ref(null)
const FEATURE_ICONS = { 公共卫浴: 'bath', 独立卫浴: 'bath', 可做饭: 'cooking-pot', 'Wi-Fi': 'wifi', 观景阳台: 'landmark', 露台: 'landmark', 小厨房: 'cooking-pot', 厨房: 'cooking-pot', 客厅: 'bed-double', 院景: 'trees', 山景: 'mountain', 海景: 'waves' }
const iconOf = (name) => FEATURE_ICONS[name] || 'check'
const allRoomTypes = computed(() => roomRows.value.map(r => ({
  roomTypeId: r.roomTypeId, name: r.typeName, desc: r.summary, bed: r.bedDesc || '—', area: r.areaSqm ? r.areaSqm + '㎡' : '—',
  people: r.capacity + (r.unitLabel === '床位' ? '人/床位' : '人'), ...bookingPriceDisplay(r), remainText: r.remainText, image: r.cover,
  features: (r.features || []).slice(0, 4), bookable: r.bookable, reason: r.reason, promo: !!r.promo
})))
const roomName = ref('全部房型')
const bedName = ref('全部床型')
const availableOnly = ref(false)
const priceSort = ref('默认排序')
const roomFilterLabels = computed(() => [roomName.value, bedName.value === '全部床型' ? '床型' : bedName.value, availableOnly.value ? '仅可订' : '筛选', priceSort.value === '默认排序' ? '排序' : priceSort.value])
const roomTypes = computed(() => {
  const rows = allRoomTypes.value.filter(r => (roomName.value === '全部房型' || r.name === roomName.value) && (bedName.value === '全部床型' || r.bed === bedName.value) && (!availableOnly.value || r.bookable))
  if (priceSort.value !== '默认排序') rows.sort((a, b) => (Number(a.price) - Number(b.price)) * (priceSort.value === '价格从低到高' ? 1 : -1))
  return rows
})
// 没填床型的房型卡片上显示「—」，床型筛选只列真正填了的床型（之前把「—」也当成一种床型列出来，选了顶栏只剩一道横线）
const bedOptions = computed(() => [...new Set(allRoomTypes.value.map(r => r.bed).filter(b => b && b !== '—'))])
async function filterRooms(kind) {
  const choices = kind === 0 ? ['全部房型', ...new Set(allRoomTypes.value.map(r => r.name).filter(Boolean))]
    : kind === 1 ? ['全部床型', ...bedOptions.value]
      : kind === 2 ? ['全部房态', '仅显示可订房型'] : ['默认排序', '价格从低到高', '价格从高到低']
  const i = await sheet(choices)
  if (i < 0) return
  if (kind === 0) roomName.value = choices[i]
  else if (kind === 1) bedName.value = choices[i]
  else if (kind === 2) availableOnly.value = i === 1
  else priceSort.value = choices[i]
  if (!roomTypes.value.some(r => r.roomTypeId === selRoomId.value)) selRoomId.value = null
  if (!roomTypes.value.length) toast('没有符合条件的房型，请调整筛选')
}
const selRoom = computed(() => allRoomTypes.value.find(r => r.roomTypeId === selRoomId.value) || {})
// 只有选中早鸟对应的房型时才按早鸟价（日历、报价、下单都带 promoId）
const promoFor = computed(() => (promoId && selRoom.value.promo ? promoId : 0))
const roomsLoaded = ref(false)
const roomsLoading = ref(false)
const roomsError = ref('')
let roomsSequence = 0
async function loadRooms() {
  const sequence = ++roomsSequence
  const params = { checkIn: state.checkIn, checkOut: state.checkOut, guests: state.guests, promoId: promoId || undefined }
  const current = () => sequence === roomsSequence && params.checkIn === state.checkIn && params.checkOut === state.checkOut && params.guests === state.guests
  roomsLoading.value = true; roomsLoaded.value = false; roomsError.value = ''; roomRows.value = []
  try {
    const rows = (await apiStayRoomTypes(stayId, params)).data || []
    if (!current()) return
    roomRows.value = rows
    if (!rows.some(r => r.roomTypeId === selRoomId.value)) selRoomId.value = null
    roomsLoaded.value = true
  } catch (e) {
    if (!current()) return
    roomsError.value = '房型价格与余量加载失败，请重试'
  } finally {
    if (sequence === roomsSequence) roomsLoading.value = false
  }
}
function selectRoom(room) {
  if (roomsLoading.value || !roomsLoaded.value) return
  selRoomId.value = room.roomTypeId
  if (!room.bookable) toast(room.reason ? room.reason + '，可在下一步换日期' : '所选日期不可订，可在下一步换日期')
  else if (promoId && !room.promo && roomRows.value.some(r => r.promo)) toast('这个房型不参加早鸟特价，按日常价预订')
  requote()
  next1()
}
function next1() {
  if (roomsLoading.value || !roomsLoaded.value) return toast('请先加载房型价格与余量')
  if (!selRoomId.value) return toast('请先选择房型')
  s.value = 2
  loadCalendar(state.checkIn.slice(0, 7))
}

// ---------------- s=2 房态日历 ----------------
const durations = [{ label: '一周', nights: 7 }, { label: '半月', nights: 15 }, { label: '一个月', nights: 30 }]
const weeks = ['日', '一', '二', '三', '四', '五', '六']
const cal = ref({ days: [] })
const picking = ref('in')
const calendarLoading = ref(false)
const calendarError = ref('')
const calendarMonth = ref('')
let calendarSequence = 0
async function loadCalendar(ym) {
  if (!selRoomId.value) return
  const sequence = ++calendarSequence, roomId = selRoomId.value, promo = promoFor.value
  calendarMonth.value = ym; calendarLoading.value = true; calendarError.value = ''; cal.value = { days: [] }
  try {
    const data = (await apiStayCalendar(roomId, ym, promo || undefined)).data || { days: [] }
    if (sequence !== calendarSequence || roomId !== selRoomId.value || promo !== promoFor.value) return
    cal.value = data
  } catch (e) {
    if (sequence === calendarSequence) calendarError.value = '房态日历加载失败，请重试'
  } finally {
    if (sequence === calendarSequence) calendarLoading.value = false
  }
}
const calendar = computed(() => {
  const days = cal.value.days || []
  if (!days.length) return []
  const first = days[0].date
  const p = first.split('-').map(Number)
  const lead = new Date(Date.UTC(p[0], p[1] - 1, p[2])).getUTCDay()
  const cells = []
  for (let i = 0; i < lead; i++) cells.push({ date: '', outside: true })
  for (const d of days) {
    const inRange = d.date >= state.checkIn && d.date < state.checkOut
    const note = d.date === state.checkIn ? '入住' : d.date === state.checkOut ? '离店'
      : d.status === 'full' ? '满房' : d.status === 'closed' ? '不可订' : d.promo ? '早鸟' : ''
    cells.push({
      date: d.day, ymd: d.date, status: d.status, price: d.status === 'past' || d.status === 'beyond' ? '' : yuan(d.priceFen),
      note, selected: inRange || d.date === state.checkOut, outside: d.status === 'past' || d.status === 'beyond'
    })
  }
  return cells
})
const shiftMonth = (n) => {
  const ym = calendarMonth.value
  if (!ym) return
  const [y, m] = ym.split('-').map(Number)
  const t = new Date(Date.UTC(y, m - 1 + n, 1))
  loadCalendar(`${t.getUTCFullYear()}-${String(t.getUTCMonth() + 1).padStart(2, '0')}`)
}
function selectDuration(nights) {
  if (!durations.some(item => item.nights === nights) || !state.checkIn) return
  state.checkOut = shiftDate(state.checkIn, nights)
  picking.value = 'in'
  saveStayState()
  requote()
}
function tapDay(day) {
  if (calendarLoading.value || calendarError.value) return
  if (!day.ymd || day.outside) return
  if (picking.value === 'in' || day.ymd <= state.checkIn) {
    if (day.status !== 'available') return toast(day.note || '该日不可入住')
    const duration = durations.some(item => item.nights === nightCount.value) ? nightCount.value : MIN_NIGHTS
    state.checkIn = day.ymd
    state.checkOut = shiftDate(day.ymd, duration)
    picking.value = 'out'
    toast('请再点选离店日期')
  } else {
    const n = nightsBetween(state.checkIn, day.ymd)
    if (n < MIN_NIGHTS) return toast('一周起订，请至少选择 7 晚')
    if (n > 30) return toast('最多连住 30 晚')
    const blocked = (cal.value.days || []).find(d => d.date >= state.checkIn && d.date < day.ymd && d.status !== 'available')
    if (blocked) return toast(`${dayText(blocked.date)} ${blocked.status === 'full' ? '已满房' : '不可订'}，不能跨过`)
    state.checkOut = day.ymd
    picking.value = 'in'
  }
  saveStayState()
  requote()
}
const q = ref(null)
const quoteLoading = ref(false)
const quoteError = ref('')
let quoteSequence = 0, quotedKey = ''
const quoteParams = () => ({ roomTypeId: selRoomId.value, checkIn: state.checkIn, checkOut: state.checkOut, guests: state.guests, promoId: promoFor.value || undefined })
async function requote() {
  const sequence = ++quoteSequence, params = quoteParams(), key = JSON.stringify(params)
  const current = () => sequence === quoteSequence && key === JSON.stringify(quoteParams())
  q.value = null; quotedKey = ''; quoteError.value = ''
  quoteLoading.value = !!params.roomTypeId
  if (!params.roomTypeId) return false
  if (nightsBetween(params.checkIn, params.checkOut) < MIN_NIGHTS) {
    quoteLoading.value = false
    quoteError.value = '一周起订，请至少选择 7 晚'
    return false
  }
  try {
    const data = (await apiStayQuote(params)).data || null
    if (!current()) return false
    q.value = data; quotedKey = key
    return current() && !!q.value
  } catch (e) {
    if (!current()) return false
    quoteError.value = errText(e, '报价加载失败，请重试')
    return false
  } finally {
    if (sequence === quoteSequence) quoteLoading.value = false
  }
}
const avgText = computed(() => (q.value && nightCount.value ? yuan(Math.round(q.value.payFen / nightCount.value)) : '--'))
async function next2() {
  if (picking.value === 'out') return toast('请先点选离店日期')
  if (nightCount.value < MIN_NIGHTS) return toast('一周起订，请至少选择 7 晚')
  if (quoteLoading.value || calendarLoading.value) return toast('正在查询所选日期，请稍候')
  if (calendarError.value) return toast('请先重新加载房态日历')
  const key = JSON.stringify(quoteParams())
  if (!q.value || quotedKey !== key) await requote()
  if (picking.value === 'out' || quoteLoading.value || key !== JSON.stringify(quoteParams()) || quotedKey !== key) return
  if (!q.value) return
  if (!q.value.bookable) return toast(q.value.reason || '所选日期不可订')
  toPay()
}

// 从房源详情选好房型后直达日历，返回直接回房源详情，不再经过重复房型列表。
const onBack = () => {
  if (directCalendar.value) back()
  else if (s.value > 1) { s.value -= 1; loadRooms() }
  else back()
}

// ---------------- 进确认订单（2026-10-18 去掉了活动加购这一步） ----------------
function toPay() {
  if (nightCount.value < MIN_NIGHTS) return toast('一周起订，请至少选择 7 晚')
  if (quoteLoading.value || quotedKey !== JSON.stringify(quoteParams())) return toast('请等待所选日期的最新报价')
  if (!q.value || !q.value.bookable) return toast((q.value && q.value.reason) || '请先选择可订的日期')
  const qs = [`stayId=${stayId}`, `roomTypeId=${selRoomId.value}`, `checkIn=${state.checkIn}`, `checkOut=${state.checkOut}`, `guests=${state.guests}`]
  if (promoFor.value) qs.push('promoId=' + promoFor.value)
  if (vlogId) qs.push('vlogId=' + vlogId)
  go(R.stayPay + '?' + qs.join('&'))
}
watchStayGate(stayBookingEnabled, enabled => { if(enabled) init() })
</script>

<style scoped lang="scss">
.duration-options { display: flex; gap: 8px; margin: 2px 0 10px; }
.duration-option { flex: 1; min-width: 0; min-height: 64px; margin: 0; padding: 9px 4px; border: 1px solid #E2D5C4; border-radius: 12px; background: #fffdf9; color: #775439; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 3px; line-height: 1.4; font-size: 15px; }
.duration-option::after { border: 0; }
.duration-option text:last-child { font-size: 12px; font-weight: 400; }
.duration-option.is-active { background: #8D5D32; border-color: #8D5D32; color: white; font-weight: 700; }
.duration-pressed { opacity: .75; }
.duration-hint { display: block; margin-bottom: 12px; color: var(--k-muted); font-size: 12px; line-height: 1.65; }
.type-foot .type-price { white-space: normal; display: flex; flex-wrap: wrap; align-items: baseline; gap: 4px; }

.booking-rule { display: flex; align-items: center; gap: 8px; padding: 2px 2px 12px; color: var(--k-red-deep); font-size: 14px; font-weight: 600; }
/* 10-19 字体复查：--k-serif 现在是只有粗体的标题字体，整页挂着正文也变粗 —— 整页用系统黑体，标题单独用标题字体 */.booking-page { padding-bottom: calc(18px + var(--k-safe-bottom)); font-family: var(--k-sans); }.type-title>text,.month-head text { font-family: var(--k-display-font); }.type-body,.calendar-body { padding: 8px 14px 18px; }.type-body,.calendar-body { padding-bottom: calc(96px + var(--k-safe-bottom)); }.cta__sum { flex: 0 0 auto; display: flex; flex-direction: column; justify-content: center; min-width: 0; }.cta__price { color: var(--k-red); font: 700 20px var(--k-sans); line-height: 1.1; }.cta__meta { color: var(--k-muted); font-size: 11px; }.cta__btn { flex: 1; min-width: 0; }.selected,.selected-room,.card { border: 1px solid var(--k-line); border-radius: 11px; background: rgba(253,251,247,.8); }.filters { height: 48px; display: flex; align-items: center; justify-content: space-between; }.filters>view { display: flex; align-items: center; gap: 5px; font-size: 14px; }.type-list { display: grid; gap: 10px; }.type-card { position: relative; height: 145px; padding: 8px; border: 1px solid var(--k-line); border-radius: 11px; background: var(--k-paper); display: flex; }.type-media { flex: 0 0 145px; width: 145px; }.type-media>image { display: block; width: 145px; height: 113px; border-radius: 8px; }.type-main { flex: 1; padding-left: 13px; font-size: 12px; }.type-main>text { display: block; color: var(--k-muted); margin-top: 3px; }.type-title { display: flex; align-items: center; gap: 7px; }.type-title>text { font-size: 17px; font-weight: 700; }.type-desc { margin: 4px 0 !important; font-size: 13px; }.type-price { position: absolute; right: 10px; bottom: 32px; }.type-price text:first-child { color: var(--k-red); font: 700 22px var(--k-sans); }.type-price text:last-child { color: var(--k-muted); font-size: 10px; }.remain { position: absolute; right: 10px; bottom: 12px; }.type-features { margin-top: 4px; display: flex; flex-wrap: wrap; justify-content: space-around; gap: 2px 4px; }.type-features>view { display: flex; align-items: center; gap: 3px; color: var(--k-muted); font-size: 9px; }.selected { height: 42px; margin: 10px 0; padding: 0 10px; display: flex; align-items: center; gap: 7px; font-size: 11px; }.selected__text { flex: 1; min-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }.selected__edit { flex-shrink: 0; color: var(--k-red); font-weight: 700; }
.selected-room { height: 43px; padding: 0 12px; display: flex; align-items: center; font-size: 12px; font-weight: 700; }.month-head { height: 59px; display: flex; align-items: center; justify-content: space-between; padding: 0 5px; }.month-head text { font-size: 22px; font-weight: 700; }.week { height: 33px; display: grid; grid-template-columns: repeat(7,1fr); align-items: center; text-align: center; font-weight: 700; }.calendar-grid { display: grid; grid-template-columns: repeat(7,1fr); border-left: 1px solid var(--k-line); border-top: 1px solid var(--k-line); }.calendar-grid>view { height: 69px; border-right: 1px solid var(--k-line); border-bottom: 1px solid var(--k-line); display: flex; flex-direction: column; align-items: center; justify-content: center; }.calendar-grid>view text:first-child { font-size: 16px; font-weight: 700; }.calendar-grid>view text:nth-child(2) { color: var(--k-muted); font-size: 11px; }.calendar-grid>view text:nth-child(3) { font-size: 10px; color: var(--k-ochre); }.calendar-grid>view.selected { height: 69px; margin: 0; padding: 0; background: var(--k-green-soft); border-radius: 8px; color: var(--k-green); }.calendar-grid>view.selected text:nth-child(2),.calendar-grid>view.selected text:last-child { color: var(--k-green); }.calendar-grid>view.outside { color: var(--k-light); }.legend { height: 54px; display: flex; align-items: center; justify-content: space-around; }.legend>view { display: flex; align-items: center; gap: 7px; }.legend>view>text:first-child { width: 22px; height: 10px; border-radius: 3px; }.green-box { background: var(--k-green); }.gray-box { background: var(--k-line2); }.calendar-total { padding: 11px 13px; margin-bottom: 10px; }.calendar-total>text { font-size: 13px; font-weight: 700; }.calendar-total>view { margin-top: 10px; display: flex; align-items: center; justify-content: space-between; }.calendar-total>view>view { display: flex; flex-direction: column; align-items: flex-end; }.calendar-total>view>view text:first-child { color: var(--k-red); font: 700 25px var(--k-sans); }.calendar-total>view>view text:last-child { color: var(--k-muted); font-size: 11px; }
/* 房型名、房源名太长时一行省略：卡片 / 顶条都是固定高度，换行会压到价格和下一行 */
.type-main { min-width: 0; }
/* 房型名一长（单行省略），grid 的自动列会被撑宽，整排卡片超出屏幕、价格被切掉还能左右滑；列宽锁成屏宽，卡片允许收窄 */
.type-list { grid-template-columns: minmax(0, 1fr); }
.type-card { min-width: 0; }
.type-title>text, .type-desc { min-width: 0; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
.selected-room>text { flex: 1; min-width: 0; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
.month-arrow { width: 44px; height: 44px; display: flex; align-items: center; justify-content: center; }
.rooms-empty { padding: 36px 0; text-align: center; color: var(--k-muted); font-size: 13px; }
.booking-state { display: flex; flex-direction: column; align-items: center; gap: 10px; padding: 16px 10px; color: var(--k-muted); font-size: 13px; line-height: 1.5; text-align: center; }
.booking-state--initial { min-height: 240px; padding: 32px 20px; justify-content: center; overflow-wrap: anywhere; }
.booking-retry { display: inline-flex; align-items: center; justify-content: center; padding: 7px 14px; min-height: 32px; margin-top: 10px; border: 1px solid var(--k-red-line); border-radius: 18px; color: var(--k-red-deep); }
/* 10-19 复查：房态日历里过去的日子只有一个日期数字（没有价格、没有备注），之前「最后一个、又不是第二个」的规则把它也画成了 10px 橙字，
   看着像图例里的「低价日」；现在备注样式只给第三行（:nth-child(3)，有备注的日子都有价格），过去的日子照常是灰色的大号数字；
   选中那几天的「入住 / 离店」照旧是绿字（下面 .selected 的规则更具体） */
/* 价格和剩余数量原来钉在卡片右下角，压住了「入住：6人/床位」（10-15 主人截图）；现在放在信息下面单独一行，窄屏自动折行，卡片高度跟着内容走 */
.type-card { height: auto; min-height: 145px; }
.type-foot { display: flex; flex-wrap: wrap; align-items: baseline; justify-content: space-between; gap: 2px 8px; margin-top: 6px; }
.type-foot .type-price, .type-foot .remain { position: static; }
.type-foot .remain { margin-left: 0; color: var(--k-muted); font-size: 12px; }
/* 10-15 窄屏（320/360）复查：「早鸟价」「安心住」标签不收缩，房型名被挤得一个字都不剩 —— 标题行允许折行，放不下时标签掉到下一行，房型名只在自己都超过一行时才省略 */
.type-title { flex-wrap: wrap; gap: 4px 7px; }
.type-title>text { flex: 0 1 auto; max-width: 100%; }
/* 五位数房价在 320 屏会从「/晚起」中间断开：价格整块不折行，放不下时整块和「剩余」各占一行；
   320 屏信息栏只有约 116px，¥12888.5/晚起 这类六位以上的价格字号调小才放得下（360 及以上不用缩） */
.type-price { white-space: nowrap; }
@media (max-width: 340px) { .type-price.is-long text:first-child { font-size: 16px; } }
/* 设施小图标原来钉在卡片底部，卡片随内容变高后离图片越来越远；现在和图片放在同一列，紧贴图片下面，放不下自动折成两行 */
.type-features>view>text { white-space: nowrap; }
/* 与详情页采用同一张纵向房型卡，照片与选中态优先，价格不压住规格。 */
.type-list { gap: 12px; }
.type-card { display: block; padding: 0; border-radius: 12px; border-color: #B6916C; overflow: hidden; }
.type-media { width: 100%; }
.type-media>image { width: 100%; height: 160px; border-radius: 0; }
.type-features { justify-content: flex-start; gap: 8px; margin: 0; padding: 9px 12px 0; }
.type-features>view { font-size: 12px; color: var(--k-ink2); }
.type-main { padding: 10px 12px 12px; }
.type-title { margin-bottom: 6px; }
.type-title>text { font-size: 19px; white-space: normal; }
.type-main>text { display: inline-block; margin-right: 12px; font-size: 13px; }
.type-main>.type-desc { display: block; font-size: 14px; white-space: normal; }
.type-desc:empty { display: none; }
.type-foot { align-items: center; margin-top: 10px; }
.type-price text:first-child { font-size: 28px; }
.type-price text:last-child { font-size: 12px; }
.type-select { min-width: 60px; height: 36px; padding: 0 12px; margin-left: auto; border-radius: 999px; background: var(--k-green); color: var(--k-paper); display: flex; align-items: center; justify-content: center; font-size: 14px; font-weight: 600; }
.type-select.selected { background: var(--k-green-soft); color: var(--k-green); border: 1px solid var(--k-green); }
.type-select.unavailable { background: var(--k-paper2); color: var(--k-muted); }
.selected-room { height: auto; min-height: 44px; padding: 10px 12px; }
.selected-room>text { white-space: normal; line-height: 1.6; }
@media (max-width:359px) { .type-media>image { height: 130px; } .type-title>text { font-size: 18px; } }
/* 与参考稿纵向房型卡和确认页统一。 */
@import './stays-premium.scss';
.booking-page { @include stays-surface; }
.type-body { padding-top: 0; }
.filters { gap: 8px; margin-bottom: 6px; }
.filters>view { flex: 1; min-width: 0; justify-content: center; height: 32px; padding: 0 5px; border-radius: 999px; background: #F2E7D9; gap: 2px; font-size: 12px; }
.filters>view>text { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.type-card { border-color: #B58C64; border-radius: 11px; box-shadow: 0 2px 6px rgba(80,53,31,.09); }
.type-media>image { height: 160px; }
.type-features { padding-top: 8px; gap: 4px 9px; }
.type-features>view { font-size: 11px; }
.type-main { padding-top: 8px; }
.type-title>text { font-size: 19px; color: #4D3020; }
.type-desc { line-height: 1.6; }
.type-main>text { font-size: 12px; line-height: 1.6; margin-right: 8px; }
.type-price text:first-child { color: #8E552A; }
.type-select { height: 32px; min-width: 60px; background: #1C8553; box-shadow: none; }
.booking-page :deep(.k-bottom) { background: rgba(255,252,247,.98); }
.booking-page :deep(.k-bottom .k-button) { border-radius: 999px; background: linear-gradient(105deg,#B7844F,#87512E); }
.selected,.selected-room,.calendar-total { background: white; border-color: #E9DECF; border-radius: 12px; }
.calendar-body { padding: 8px 14px calc(100px + var(--k-safe-bottom)); }
.month-head { height: 56px; }
.month-head text { color: #633E24; font-size: 21px; }
.week { color: #8D725A; font-size: 13px; }
.calendar-grid { border: 0; gap: 4px 1px; background: white; padding: 7px 2px; border-radius: 13px; }
.calendar-grid>view,.calendar-grid>view.selected { height: 57px; border: 0; border-radius: 8px; }
.calendar-grid>view.selected { background: #F2DFC5; color: #845329; }
.calendar-grid>view.selected text:nth-child(2),.calendar-grid>view.selected text:last-child { color: #845329; }
.calendar-total { padding: 12px; }
.calendar-total>view>view text:first-child { color: #8E552A; }
.selected-room>text { font-size: 12px; }
@media(max-width:359px) { .type-media>image { height: 134px; } .filters { gap: 5px; } .filters>view { font-size: 10px; } .calendar-grid>view,.calendar-grid>view.selected { height: 53px; } }

.stay-period-options, .type-main > .stay-period-options { display: block; margin: 7px 0 0; color: var(--k-muted); font-size: 12px; line-height: 1.55; white-space: pre-line; text-align: left; overflow-wrap: anywhere; }
/* 标准时长报价与所选日期报价分列，避免把7晚价误当成本次订单总价。 */
.type-pricing { display: grid; grid-template-columns: minmax(0, 1.2fr) minmax(0, 1fr); gap: 12px; margin-top: 14px; align-items: start; }
.type-period-price,.type-selected-price { min-width: 0; }
.type-price-label { display: block; color: var(--k-muted); font-size: 12px; line-height: 1.6; }
.type-pricing .type-price { position: static; display: block; margin: 2px 0 0; white-space: normal; overflow-wrap: anywhere; }
.type-pricing .type-price>text { color: var(--k-red); font-family: var(--k-sans); font-size: 28px; line-height: 1.2; font-weight: 700; }
.type-selected-price { text-align: right; padding-right: 16px; box-sizing: border-box; }
.type-selected-amount { display: block; margin-top: 4px; color: var(--k-ink); font-family: var(--k-sans); font-size: 20px; line-height: 1.3; font-weight: 600; overflow-wrap: anywhere; }
.type-price-dates,.type-price-note { display: block; margin-top: 4px; color: var(--k-muted); font-size: 11px; line-height: 1.6; }
.type-foot { margin-top: 12px; padding-top: 10px; border-top: 1px solid var(--k-line); }
@media(max-width:359px) { .type-pricing { gap: 8px; } .type-pricing .type-price.is-long>text { font-size: 22px; } .type-selected-amount { font-size: 18px; } }
</style>
