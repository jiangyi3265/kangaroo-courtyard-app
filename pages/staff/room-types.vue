<template>
  <!-- #ifdef MP-WEIXIN -->
  <page-meta :page-style="datePick || dayEdit ? 'overflow: hidden' : ''" />
  <!-- page-meta 必须是页面第一个节点。2026-11-03 复查：房态屏的页内日历、点一天的底部面板开着时锁住页面滚动（和 rooms.vue 同一个做法；
       原来房态在 rooms.vue 里有这条，挪到这一页后漏了）。只在小程序里加：H5 的 page-meta 关弹窗时清不掉这条样式 -->
  <!-- #endif -->
  <view class="k-page rt-page">
    <k-topbar :title="s === 3 ? '房态（价格 / 库存 / 关房）' : (s === 1 ? '房型和价格' : (editor && editor.roomTypeId ? '修改房型' : '新增房型'))" back custom-back :fab="false" @back="onBack" />

    <view v-if="merchantStaff && s !== 3" class="fc-form">
      <merchant-agreement ref="stayAgreement" :store-id="currentStaffStoreId()" type="stay" />
    </view>

    <!-- 1 这个房源的全部房型：每个房型一张卡，名字、人数间数、7 天价格一眼看全；修改、停用就在卡上 -->
    <view v-if="s === 1" class="fc-form">
      <view v-if="listingFlow" class="fc-steps"><text class="fc-steps__t">2 / 3 · 房型与价格</text><text>保存房型后继续上传资质</text></view>
      <view class="rt-head">
        <text class="rt-head__name">{{ stay.stayName || '房源' }}</text>
        <text v-if="stay.statusLabel" class="rt-head__state">{{ stay.statusLabel }}</text>
      </view>
      <text v-if="loadError" class="fc-notice fc-notice--alert">{{ loadError }}</text>
      <text v-else-if="lockTip" class="fc-notice">{{ lockTip }}</text>
      <view v-for="room in rooms" :key="room.roomTypeId" class="rt-card" :class="{ 'rt-card--off': room.status === '1' }">
        <view class="rt-card__top">
          <text class="rt-card__name">{{ room.typeName }}</text>
          <text class="rt-card__state" :class="{ 'rt-card__state--off': room.status === '1' }">{{ room.status === '1' ? '已停用' : '可预订' }}</text>
        </view>
        <text class="rt-card__line">{{ kindLabel(room.roomKind) }} · 可住 {{ room.capacity }} 人 · 每晚 {{ room.stock }} {{ room.unitLabel || '间' }}</text>
        <text class="rt-card__price">门店定价 · {{ weekPriceText(room) }}</text>
        <text v-for="period in ROOM_PERIOD_PRICES" :key="period.key" class="rt-card__line">{{ period.label }}：{{ room[period.key] == null ? '按逐晚计算' : '¥' + periodTotalOf(room[period.key]) }}</text>
        <view v-if="editable" class="rt-card__acts">
          <view class="rt-btn" hover-class="k-press-s" @click="openEditor(room)"><k-icon name="pencil" :size="18" color="white" :stroke="2" /><text>修改房型和价格</text></view>
          <view class="rt-btn rt-btn--ghost" hover-class="k-press-s" @click="toggleStatus(room)"><text>{{ room.status === '1' ? '重新启用' : '停用' }}</text></view>
        </view>
      </view>
      <view v-if="!listingFlow" class="rt-btn rt-btn--ghost" hover-class="k-press" @click="go('/pages/staff/rooms?stayId='+stayId)"><text>房源上架 / 下架与审核管理 ›</text></view>
      <text v-if="loaded && !rooms.length && !loadError" class="rt-empty">还没有房型。点下面「新增房型」，填好名称、可住人数、间数和 7 天的价格就行。</text>
      <text v-if="editable && rooms.length" class="fc-footnote">房型已保存。继续补齐资质后统一提交审核。</text>
      <view v-if="editable || stay.status === 'online'" class="fc-bar">
        <view class="fc-bar__btns">
          <view v-if="editable" class="fc-btn" hover-class="k-press-s" @click="openEditor()"><k-icon name="plus" :size="20" color="white" :stroke="2.2" /><text class="rt-btn__t">新增房型</text></view>
          <view v-if="listingFlow && editable" class="fc-btn" hover-class="k-press-s" @click="finishListingRooms"><text>下一步：资质</text></view>
          <view v-else-if="!editable" class="fc-btn" hover-class="k-press-s" @click="offlineToEdit"><text>先下架，再修改房型</text></view>
        </view>
      </view>
    </view>

    <!-- 2 新增 / 修改一个房型：直接填写七晚合计金额 -->
    <view v-else-if="editor" class="fc-form">
      <view class="fc-block">
        <view class="fc-field">
          <view class="fc-label"><text class="fc-label__t">房型名称</text><text class="fc-req">必填</text><text class="fc-count">{{ editor.typeName.length }}/64</text></view>
          <input v-model="editor.typeName" class="fc-input" :class="{ 'fc-input--err': err.typeName }" maxlength="64" placeholder="例如：庭院大床房" placeholder-class="fc-ph" />
          <text v-if="err.typeName" class="fc-err">{{ err.typeName }}</text>
        </view>
        <view class="fc-field">
          <view class="fc-label"><text class="fc-label__t">房型类别</text></view>
          <view class="fc-seg fc-seg--3"><view v-for="k in KINDS" :key="k[0]" class="fc-seg__item" :class="{ on: editor.roomKind === k[0] }" hover-class="k-press" @click="editor.roomKind = k[0]"><text>{{ k[1] }}</text></view></view>
        </view>
        <view class="fc-row">
          <text class="fc-row__k">可住人数</text>
          <view class="fc-stepper"><view class="fc-stepper__btn" hover-class="k-press" @click="step('capacity', -1, 1, 20)"><k-icon name="minus" :size="20" :color="editor.capacity <= 1 ? 'light' : 'ink'" /></view><text class="fc-stepper__num">{{ editor.capacity }} 人</text><view class="fc-stepper__btn" hover-class="k-press" @click="step('capacity', 1, 1, 20)"><k-icon name="plus" :size="20" :color="editor.capacity >= 20 ? 'light' : 'ink'" /></view></view>
        </view>
        <view class="fc-row">
          <text class="fc-row__k">每晚能卖几{{ unit }}</text>
          <view class="fc-stepper"><view class="fc-stepper__btn" hover-class="k-press" @click="step('stock', -1, 1, 999)"><k-icon name="minus" :size="20" :color="editor.stock <= 1 ? 'light' : 'ink'" /></view><text class="fc-stepper__num">{{ editor.stock }} {{ unit }}</text><view class="fc-stepper__btn" hover-class="k-press" @click="step('stock', 1, 1, 999)"><k-icon name="plus" :size="20" :color="editor.stock >= 999 ? 'light' : 'ink'" /></view></view>
        </view>
      </view>
      <view class="fc-block">
        <view class="fc-field">
          <view class="fc-label"><text class="fc-label__t">7天总价（元）</text><text class="fc-req">必填</text></view>
          <text class="rt-hint">填写1{{ unit }}住7晚的合计房费，例如每晚17元，七天填写119元。</text>
          <view class="fc-money rt-total-money" :class="{ 'fc-money--err': err.price }"><text class="fc-money__sign">¥</text><input v-model="editor.weekTotal" class="fc-money__input" type="digit" maxlength="9" placeholder="七晚合计多少元" placeholder-class="fc-ph" /><text class="fc-money__unit">元/7晚</text></view>
          <text class="rt-hint">{{ weekTotalPricePreview(editor.weekTotal, stay.opType, originalRoom) }}</text>
          <text class="rt-hint">自营免平台服务费；合作、加盟、代运营沿用逐晚加价5%。修改总价后均分到7晚，七晚合计不变；不改总价会保留原周末差价。房态单日价格、促销和长住优惠按预订日期计算。</text>
          <text v-if="err.price" class="fc-err">{{ err.price }}</text>
        </view>
        <view v-for="period in ROOM_PERIOD_PRICES" :key="period.key" class="fc-field" :data-period-price="period.key">
          <view class="fc-label"><text class="fc-label__t">{{ period.label }}</text></view>
          <text class="rt-hint">填写1{{ unit }}住{{ period.nights }}晚的合计房费，仅用于预订{{ period.nights }}晚。不填或清空则按逐晚计算，房态单日改价优先。已设总价不再叠加连住折扣。</text>
          <view class="fc-money" :class="{ 'fc-money--err': err[period.input] }"><text class="fc-money__sign">¥</text><input v-model="editor[period.input]" class="fc-money__input" type="digit" maxlength="10" placeholder="不设置请留空" placeholder-class="fc-ph" /><text class="fc-money__unit">元/{{ period.nights }}晚</text></view>
          <text v-if="err[period.input]" class="fc-err">{{ err[period.input] }}</text>
        </view>
      </view>
      <text v-if="err.save" class="fc-notice fc-notice--alert">{{ err.save }}</text>
      <view class="fc-bar">
        <view class="fc-bar__btns">
          <view class="fc-btn fc-btn--ghost" hover-class="k-press-s" @click="onBack"><text>取消</text></view>
          <view class="fc-btn" :class="{ 'fc-btn--off': saving }" hover-class="k-press-s" @click="save"><text>{{ saving ? '保存中…' : '保存' }}</text></view>
        </view>
      </view>
    </view>

    <!-- 3 房态（2026-11-03 主人：简化房态改价）：原来房源卡片的「房态」要连着弹 5 个系统框（选房型 → 选操作 → 开始日 → 结束日 → 填数），
         「查看本月房态」还是一段纯文字弹窗。现在：选房型 → 14 天一格的小表（日期、价格、剩余、开 / 关），点一天出底部面板改价 / 改库存 / 关房 / 开房；
         整段改价是「从 … 到 …」两行 + 一个数字框 + 「应用」。房源卡片的「房态」直接跳到这一屏（?s=3） -->
    <view v-else-if="s === 3" class="fc-form cal-form">
      <view v-if="listingFlow" class="fc-steps"><text class="fc-steps__t">2 / 3 · 房型与价格</text><text>保存房型后继续上传资质</text></view>
      <view class="rt-head">
        <text class="rt-head__name">{{ stay.stayName || '房源' }}</text>
        <text v-if="stay.statusLabel" class="rt-head__state">{{ stay.statusLabel }}</text>
      </view>
      <text v-if="loadError" class="fc-notice fc-notice--alert">{{ loadError }}</text>
      <text v-else-if="loaded && !rooms.length" class="rt-empty">还没有房型。先回到房源管理，点卡片上的「房型管理」新增房型，再来改房态。</text>
      <template v-else-if="rooms.length">
        <view class="fc-block">
          <text class="fc-group__title">先选房型</text>
          <view class="cal-types">
            <view v-for="room in rooms" :key="room.roomTypeId" class="cal-type" :class="{ on: calRoom && calRoom.roomTypeId === room.roomTypeId }" hover-class="k-press" @click="pickCalRoom(room)"><text>{{ room.typeName }}</text></view>
          </view>
        </view>
        <view class="fc-block">
          <text class="fc-group__title">未来 14 天</text>
          <text class="rt-hint cal-hint">自营房源不加价、免平台服务费；合作、加盟、代运营房源按原规则加价5%，长住优惠按订单明细展示。点哪一天就改哪一天的价格、库存，或者关房 / 开房。剩余 = 还能卖的间数 / 每晚总间数。</text>
          <text v-if="calError" class="fc-notice fc-notice--alert">{{ calError }}</text>
          <view class="cal-table">
            <view class="cal-tr cal-tr--head"><text class="cal-td cal-td--date">日期</text><text class="cal-td">价格</text><text class="cal-td">剩余</text><text class="cal-td cal-td--state">状态</text></view>
            <view v-for="dayRow in calDays" :key="dayRow.date" class="cal-tr" :class="{ 'cal-tr--closed': dayRow.closed, 'cal-tr--on': dayEdit && dayEdit.date === dayRow.date }" hover-class="k-press" @click="openDay(dayRow)">
              <text class="cal-td cal-td--date" :class="{ 'cal-td--weekend': dayRow.weekend }">{{ dayRow.label }}</text>
              <text class="cal-td cal-td--price">¥{{ dayRow.price }}</text>
              <text class="cal-td">{{ dayRow.left }} / {{ dayRow.stock }}</text>
              <text class="cal-td cal-td--state" :class="{ 'cal-td--off': dayRow.closed }">{{ dayRow.closed ? '已关房' : '可订' }}</text>
            </view>
            <text v-if="calLoading" class="cal-loading">正在加载房态…</text>
            <text v-else-if="calRoom && !calDays.length && !calError" class="cal-loading">这个房型还没有房态数据</text>
          </view>
        </view>
        <view class="fc-block">
          <text class="fc-group__title">整段改价</text>
          <text class="rt-hint cal-hint">比如国庆那几天统一涨价：选好「从」「到」两个日期，填一个价，点「应用」就都改了。</text>
          <view class="fc-row" hover-class="k-press" @click="pickRangeDate('from')"><text class="fc-row__k">从</text><text class="fc-row__v">{{ range.from || '请选择' }}</text><k-icon name="chevron-right" :size="18" color="muted" /></view>
          <view class="fc-row" hover-class="k-press" @click="pickRangeDate('to')"><text class="fc-row__k">到</text><text class="fc-row__v">{{ range.to || '请选择' }}</text><k-icon name="chevron-right" :size="18" color="muted" /></view>
          <view class="fc-field">
            <view class="fc-label"><text class="fc-label__t">这段每晚售价</text><text class="fc-count">共 {{ rangeNights }} 晚</text></view>
            <view class="fc-money" :class="{ 'fc-money--err': rangeErr }"><text class="fc-money__sign">¥</text><input v-model="range.price" class="fc-money__input" type="digit" maxlength="9" placeholder="每晚多少元" placeholder-class="fc-ph" /><text class="fc-money__unit">元/晚</text></view>
            <text class="rt-hint">{{ settlementPricePreview(range.price, stay.opType) }}</text>
            <text v-if="rangeErr" class="fc-err">{{ rangeErr }}</text>
            <view class="rt-btn cal-apply" :class="{ 'rt-btn--off': calSaving }" hover-class="k-press-s" @click="applyRangePrice"><text>{{ calSaving ? '正在保存…' : '应用到这 ' + rangeNights + ' 晚' }}</text></view>
            <view class="cal-apply-row">
              <view class="rt-btn rt-btn--ghost cal-ghost" hover-class="k-press-s" @click="applyRangeClosed(true)"><text>这段关房</text></view>
              <view class="rt-btn rt-btn--ghost cal-ghost" hover-class="k-press-s" @click="applyRangeClosed(false)"><text>这段开房</text></view>
            </view>
          </view>
        </view>
      </template>
      <!-- 点一天出的底部面板：改价、改库存就地填，关房 / 开房一个钮；不是系统弹窗 -->
      <view v-if="dayEdit" class="cal-sheet">
        <view class="cal-sheet__mask" hover-class="none" @click="closeDay" @touchmove.stop.prevent />
        <view class="cal-sheet__panel">
          <view class="cal-sheet__head">
            <view class="cal-sheet__copy"><text class="cal-sheet__title">{{ dayEdit.label }}</text><text class="cal-sheet__sub">{{ calRoom ? calRoom.typeName : '' }} · 已订 {{ dayEdit.occupied }} {{ unitOf(calRoom) }}</text></view>
            <view class="cal-sheet__x" hover-class="k-press" @click="closeDay"><k-icon name="x" :size="22" color="ink" :stroke="2" /></view>
          </view>
          <view class="fc-field">
            <view class="fc-label"><text class="fc-label__t">当晚定价</text></view>
            <view class="fc-money" :class="{ 'fc-money--err': dayErr }"><text class="fc-money__sign">¥</text><input v-model="dayEdit.price" class="fc-money__input" type="digit" maxlength="9" placeholder="每晚多少元" placeholder-class="fc-ph" /><text class="fc-money__unit">元/晚</text></view>
            <text class="rt-hint">{{ settlementPricePreview(dayEdit.price, stay.opType) }}</text>
            <text v-if="dayErr" class="fc-err">{{ dayErr }}</text>
          </view>
          <view class="fc-row">
            <text class="fc-row__k">当晚能卖几{{ unitOf(calRoom) }}</text>
            <view class="fc-stepper"><view class="fc-stepper__btn" hover-class="k-press" @click="stepDayStock(-1)"><k-icon name="minus" :size="20" :color="dayEdit.stock <= dayEdit.occupied ? 'light' : 'ink'" /></view><text class="fc-stepper__num">{{ dayEdit.stock }} {{ unitOf(calRoom) }}</text><view class="fc-stepper__btn" hover-class="k-press" @click="stepDayStock(1)"><k-icon name="plus" :size="20" :color="dayEdit.stock >= 999 ? 'light' : 'ink'" /></view></view>
          </view>
          <view class="cal-sheet__btns">
            <view class="rt-btn rt-btn--ghost cal-ghost" :class="{ 'cal-ghost--open': dayEdit.closed }" hover-class="k-press-s" @click="toggleDayClosed"><text>{{ dayEdit.closed ? '开房（恢复可订）' : '关房（这晚不可订）' }}</text></view>
            <view class="rt-btn" :class="{ 'rt-btn--off': calSaving }" hover-class="k-press-s" @click="saveDay"><text>{{ calSaving ? '正在保存…' : '保存价格和库存' }}</text></view>
          </view>
        </view>
      </view>
      <k-date-picker v-if="datePick" :title="datePick.title" :value="datePick.value || ''" :min-date="datePick.min || ''" :max-date="datePick.max || ''" @cancel="closeDatePick(null)" @confirm="closeDatePick" />
    </view>
  </view>
</template>

<script setup>
// ---------------------------------------------------------------------------
// 房型和价格（员工端，2026-11-03 新增的二级页）。主人原话：
//   「新增在一个页，现在操作太繁琐了很多都是老人…这种设计不友好，增加个单独的二级页操作方便简单一些」
//   「布局，必须7天，填写7天的价格页面优化一下不要弹窗」
// 原来在房源管理「更多 → 房型管理」里，一个房型要连着弹 5 个系统框（名称 / 类别 / 人数 / 库存 / 价格），改价格还要再弹；
// 现在从房源卡片的「房型管理」直接进这一页：s=1 这个房源的全部房型，s=2 新增 / 修改一个房型（一页填完，7 天价格一天一格）。
// 保存后回到 s=1 用接口返回的最新数据刷新；返回房源管理时那一页 onShow 会重新拉列表，不用退出去再进来。
// 接口：GET /app/staff/stay/stays/{id}、POST /stays/{id}/room-types、PUT /room-types/{id}（weekPriceFen = 周一到周日 7 个，分；V70）。
// 房源上线中 / 审核中服务端不让改房型（改价格要重新审核）：上线中给一个「先下架，再修改房型」，审核中只看。
// ?stayId= 必填。只在员工分包里，不往主包加东西。
// 2026-11-03 主人：简化房态改价。第三屏 s=3「房态」（房源卡片的「房态」按 ?s=3 直接进来）：选房型 → 14 天小表 → 点一天出底部面板，
// 整段改价「从 … 到 …」+ 一个数字框 + 「应用」。接口照旧：GET /room-types/{id}/calendar?month=、PUT /room-types/{id}/calendar {from, to, priceFen | stock | closed}。
// 原来：5 个系统框连着弹（选房型 / 选操作 / 开始日 / 结束日 / 填数），看房态还是一段纯文字弹窗 → 现在：进来直接看表，点一天改、或者两行日期 + 一个框。
// ---------------------------------------------------------------------------
import { ref, reactive, computed } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { useScreen, back, toast, go } from '@/common/screen.js'
import { apiStaffStay, apiStaffCreateRoomType, apiStaffEditRoomType, apiStaffOfflineStay, apiStaffRoomCalendar, apiStaffSetRoomCalendar } from '@/common/api.js'
import { ensureSession, hasStaffAccess, currentStaffStoreId, merchantStaff } from '@/common/experience.js'
import { errText, confirm, prompt, todayCn, shiftDate } from '@/common/ui.js'
import { ROOM_PERIOD_PRICES, periodTotalOf, roomWeekTotalFen, weekTotalOf, roomTypeTotalPayload, weekTotalPricePreview, weekPriceText, nightPriceFen, calendarRows, nextMonth, nightsBetween, settlementPricePreview } from './stay-submission.js'
import MerchantAgreement from './components/merchant-agreement.vue'
const stayAgreement = ref(null)

const KINDS = [['whole', '整院'], ['private', '独立房间'], ['shared', '多人间']]
const kindLabel = (k) => ({ whole: '整院', private: '独立房间', shared: '多人间（按床位卖）' })[k] || '房间'

let stayId = 0
const stay = ref({})
const loaded = ref(false)
const loadError = ref('')
const rooms = computed(() => stay.value.roomTypes || [])
// 草稿、驳回、已下架的房源能改房型（和服务端 saveRoomType 同一条规则）
const editable = computed(() => ['draft', 'rejected', 'offline'].includes(stay.value.status))
const lockTip = computed(() => {
  if (stay.value.status === 'online') return '房源已上线：房型和 7 天价格要先下架才能改，改完重新提交审核。只想临时调几天的价、关房，用房源卡片上的「房态」，不用下架。'
  if (stay.value.status === 'pending') return '房源审核中，这期间不能改房型。审核结果会发消息通知你。'
  return ''
})

// 房源卡片的「房态」按 ?s=3 直接进第三屏；没带或不是 3 的都从房型列表开始
let wantRoomTypeId = 0
const listingFlow = ref(false)
function finishListingRooms() {
  if (!rooms.value.some(r => String(r.status) === '0')) return toast('请先保存至少一个可用房型')
  back()
}
const s = useScreen(3, {
  onLoad: (q) => {
    stayId = Number(q?.stayId) || 0
    listingFlow.value = q?.flow === 'listing'
    wantRoomTypeId = Number(q?.roomTypeId) || 0
    s.value = Number(q?.s) === 3 ? 3 : 1
    if (s.value === 3) resetRange()
    load()
  }
})
// 从别的页回来（比如去房源管理下架了）也拿最新的；正在填的那一屏不动，免得冲掉没保存的内容
let booted = false
onShow(() => { if (booted && (s.value === 1 || s.value === 3)) load() })

async function load() {
  await ensureSession()
  if (!hasStaffAccess.value) { loadError.value = '当前账号没有员工授权'; return }
  if (!stayId) { loadError.value = '没有指定房源，请从房源管理进来'; return }
  try {
    stay.value = (await apiStaffStay(stayId)).data || {}
    loadError.value = ''
    if (s.value === 3) ensureCalRoom()
  } catch (e) {
    loadError.value = errText(e, '房型加载失败，请下拉或返回后重试')
  } finally {
    loaded.value = true
    booted = true
  }
}

// ---------------- 新增 / 修改 ----------------
const editor = ref(null)
const originalRoom = ref({})
const err = ref({})
const saving = ref(false)
let snapshot = ''
const unit = computed(() => editor.value?.roomKind === 'shared' ? '床位' : (editor.value?.unitLabel || '间'))
function openEditor(room) {
  if (!editable.value) return
  originalRoom.value = room ? { ...room } : {}
  editor.value = room ? {
    roomTypeId: room.roomTypeId, typeName: room.typeName || '', roomKind: room.roomKind || 'private',
    capacity: Number(room.capacity) || 2, stock: Number(room.stock) || 1, status: String(room.status ?? '0'), unitLabel: room.unitLabel || '',
    weekTotal: weekTotalOf(room), originalWeekTotalFen: roomWeekTotalFen(room)
  } : { roomTypeId: 0, typeName: '', roomKind: 'private', capacity: 2, stock: 1, status: '0', unitLabel: '', weekTotal: '', originalWeekTotalFen: null }
  editor.value.originalPeriodPrices = {}
  for (const period of ROOM_PERIOD_PRICES) {
    editor.value[period.input] = periodTotalOf(room?.[period.key])
    editor.value.originalPeriodPrices[period.key] = room?.[period.key] ?? null
  }
  snapshot = JSON.stringify(editor.value)
  err.value = {}
  s.value = 2
}
function step(key, d, min, max) {
  editor.value[key] = Math.min(max, Math.max(min, Number(editor.value[key]) + d))
}
async function save() {
  if (saving.value || !editor.value) return
  const name = String(editor.value.typeName || '').trim()
  err.value = {}
  if (!name) { err.value = { typeName: '请填写房型名称' }; return toast('请填写房型名称') }
  let payload
  try {
    payload = roomTypeTotalPayload({ ...editor.value, capacity: String(editor.value.capacity), stock: String(editor.value.stock) })
  } catch (e) {
    err.value = { [e.field || 'price']: e.message }
    return toast(e.message)
  }
  saving.value = true
  try {
    if (merchantStaff.value && !await stayAgreement.value?.confirm()) return
    const res = editor.value.roomTypeId ? await apiStaffEditRoomType(editor.value.roomTypeId, payload) : await apiStaffCreateRoomType(stayId, payload)
    if (res && res.data) stay.value = res.data
    toast(editor.value.roomTypeId ? '房型已保存' : '房型已新增')
    editor.value = null
    s.value = 1
  } catch (e) {
    err.value = { save: errText(e, '保存失败，请重试') }
    toast(err.value.save)
  } finally {
    saving.value = false
  }
}

// 停用 / 启用：可以随时改回来，不弹确认；停用的房型住客订不到，提交审核时至少要有一个可预订的
async function toggleStatus(room) {
  if (saving.value) return
  saving.value = true
  const off = room.status !== '1'
  try {
    if (merchantStaff.value && !await stayAgreement.value?.confirm()) return
    const res = await apiStaffEditRoomType(room.roomTypeId, { status: off ? '1' : '0' })
    if (res && res.data) stay.value = res.data
    toast(off ? '已停用，住客订不到这个房型了' : '已重新启用')
  } catch (e) {
    toast(errText(e, '操作失败，请重试'))
  } finally {
    saving.value = false
  }
}

// 上线中的房源：下架后才能改房型。下架要写原因（服务端必填），已有订单照常履约
async function offlineToEdit() {
  const why = await prompt('先下架才能改房型', { placeholder: '写一句下架原因，例如：调整房型和价格' })
  if (!why) return
  try {
    const res = await apiStaffOfflineStay(stayId, why)
    toast(res.msg || '已下架')
    await load()
  } catch (e) {
    toast(errText(e, '下架失败，请重试'))
  }
}

// ---------------- s=3 房态（2026-11-03 主人：简化房态改价） ----------------
// 页内日历：await pickDate({ title, value, min, max }) → 'yyyy-MM-dd'；取消得 null（和 rooms.vue 同一个做法）
const datePick = ref(null)
const pickDate = (opts) => new Promise((resolve) => {
  if (datePick.value) datePick.value.resolve(null)
  datePick.value = { ...opts, resolve }
})
const closeDatePick = (v) => {
  const p = datePick.value
  datePick.value = null
  if (p) p.resolve(v == null ? null : v)
}
const unitOf = (room) => (room && room.roomKind === 'shared' ? '床位' : (room && room.unitLabel) || '间')
const calRoom = ref(null)      // 当前选中的房型
const calRaw = ref([])         // 接口给的这个月 + 下个月的 days
const calLoading = ref(false)
const calError = ref('')
const calSaving = ref(false)
const calDays = computed(() => calendarRows(calRaw.value, 14))
// 进第三屏时：带了 roomTypeId 就选它，没带就选第一个可用的；房型变了（比如被停用）重新对一遍
function ensureCalRoom() {
  const list = rooms.value
  if (!list.length) { calRoom.value = null; calRaw.value = []; return }
  const cur = calRoom.value && list.find(r => r.roomTypeId === calRoom.value.roomTypeId)
  const want = !cur && wantRoomTypeId && list.find(r => r.roomTypeId === wantRoomTypeId)
  pickCalRoom(cur || want || list.find(r => String(r.status) === '0') || list[0])
}
function pickCalRoom(room) {
  if (!room) return
  calRoom.value = room
  dayEdit.value = null
  loadCalendar()
}
// 这个月 + 下个月一起拉（14 天可能跨月），再去掉已过去的只留 14 天
async function loadCalendar() {
  const room = calRoom.value
  if (!room) return
  calLoading.value = true
  calError.value = ''
  try {
    const ym = todayCn().slice(0, 7)
    const [a, b] = await Promise.all([apiStaffRoomCalendar(room.roomTypeId, ym), apiStaffRoomCalendar(room.roomTypeId, nextMonth(ym))])
    if (calRoom.value !== room) return
    calRaw.value = [...(((a && a.data) || {}).days || []), ...(((b && b.data) || {}).days || [])]
  } catch (e) {
    if (calRoom.value === room) calError.value = errText(e, '房态加载失败，请重试')
  } finally {
    if (calRoom.value === room) calLoading.value = false
  }
}
// 统一发 PUT：成功提示接口的「已更新 N 晚」，再把表刷新
async function setCalendar(body, okText) {
  if (calSaving.value || !calRoom.value) return false
  calSaving.value = true
  try {
    const res = await apiStaffSetRoomCalendar(calRoom.value.roomTypeId, body)
    toast((res && res.msg) || okText || '已更新')
    await loadCalendar()
    return true
  } catch (e) {
    toast(errText(e, '房态设置失败'))
    return false
  } finally {
    calSaving.value = false
  }
}

// 点一天：底部面板，价格、库存就地填，关房 / 开房一个钮
const dayEdit = ref(null)
const dayErr = ref('')
// 打开面板时的原值：保存只发这次真改了的。之前固定价格、库存一起发，只改库存那天的价格也被「钉死」，之后改 7 天价这天不跟着变
let dayOrig = null
function openDay(row) {
  dayErr.value = ''
  dayOrig = { price: String(row.price ?? '').trim(), priceFen: Number(row.priceFen) || 0, stock: Number(row.stock) }
  dayEdit.value = { date: row.date, label: row.label, price: row.price, stock: row.stock, occupied: row.occupied, closed: row.closed }
}
const closeDay = () => { dayEdit.value = null; dayErr.value = '' }
// 库存不能低于当晚已订的（服务端也拦），上限 999
function stepDayStock(d) {
  const e = dayEdit.value
  if (!e) return
  e.stock = Math.min(999, Math.max(e.occupied, Number(e.stock) + d))
}
async function saveDay() {
  const e = dayEdit.value
  if (!e) return
  const body = { from: e.date, to: e.date }
  // 价格框没动就不发价格；动了才校验（填成同一个数也不发）
  if (!dayOrig || String(e.price ?? '').trim() !== dayOrig.price) {
    let priceFen
    try { priceFen = nightPriceFen(e.price) } catch (x) { dayErr.value = x.message; return toast(x.message) }
    if (!dayOrig || priceFen !== dayOrig.priceFen) body.priceFen = priceFen
  }
  if (!dayOrig || Number(e.stock) !== dayOrig.stock) body.stock = Number(e.stock)
  dayErr.value = ''
  if (body.priceFen == null && body.stock == null) { closeDay(); return toast('没有改动') }
  if (await setCalendar(body, e.label + ' 已更新')) closeDay()
}
async function toggleDayClosed() {
  const e = dayEdit.value
  if (!e) return
  const closed = !e.closed
  if (await setCalendar({ from: e.date, to: e.date, closed }, closed ? e.label + ' 已关房' : e.label + ' 已开房')) e.closed = closed
}

// 整段改价：从 … 到 … + 一个价格框 + 应用；也能整段关房 / 开房
const range = reactive({ from: '', to: '', price: '' })
const rangeErr = ref('')
const rangeNights = computed(() => nightsBetween(range.from, range.to))
function resetRange() {
  range.from = todayCn()
  range.to = shiftDate(range.from, 6)
  range.price = ''
  rangeErr.value = ''
}
async function pickRangeDate(which) {
  const today = todayCn()
  const v = which === 'from'
    ? await pickDate({ title: '从哪天开始', value: range.from || today, min: today })
    : await pickDate({ title: '到哪天为止', value: range.to || range.from || today, min: range.from || today })
  if (!v) return
  range[which] = v
  if (which === 'from' && range.to && range.to < v) range.to = v
  rangeErr.value = ''
}
function rangeProblem() {
  if (!range.from || !range.to) return '请先选好「从」「到」两个日期'
  if (!rangeNights.value) return '「到」不能早于「从」'
  if (rangeNights.value > 180) return '一次最多设置 180 晚'
  return ''
}
async function applyRangePrice() {
  const bad = rangeProblem()
  if (bad) { rangeErr.value = bad; return toast(bad) }
  let priceFen
  try { priceFen = nightPriceFen(range.price) } catch (x) { rangeErr.value = x.message; return toast(x.message) }
  rangeErr.value = ''
  await setCalendar({ from: range.from, to: range.to, priceFen }, '已更新 ' + rangeNights.value + ' 晚的价格')
}
async function applyRangeClosed(closed) {
  const bad = rangeProblem()
  if (bad) { rangeErr.value = bad; return toast(bad) }
  if (closed && !(await confirm('这 ' + rangeNights.value + ' 晚都关房？', range.from + ' 到 ' + range.to + ' 住客就订不到「' + (calRoom.value ? calRoom.value.typeName : '') + '」了，已有订单照常。'))) return
  rangeErr.value = ''
  await setCalendar({ from: range.from, to: range.to, closed }, closed ? '已关房 ' + rangeNights.value + ' 晚' : '已开房 ' + rangeNights.value + ' 晚')
}

async function onBack() {
  if (s.value === 2) {
    if (saving.value) return toast('正在保存，请稍候')
    if (editor.value && JSON.stringify(editor.value) !== snapshot && !(await confirm('放弃这次填写？', '刚才填的还没保存，返回后就没了。'))) return
    editor.value = null
    err.value = {}
    s.value = 1
    return
  }
  if (s.value === 3) {
    if (calSaving.value) return toast('正在保存，请稍候')
    if (dayEdit.value) return closeDay()
  }
  back()
}
</script>

<style scoped lang="scss">
/* 输入框、分段、步进器、底部操作条用填写页共用的 form-clean.scss；这里只有房型卡和 7 天价格那几行 */
@import './form-clean.scss';
.rt-head { display: flex; align-items: center; gap: 10px; padding: 16px 16px 4px; }
.rt-head__name { flex: 1; min-width: 0; font-family: var(--k-serif); font-size: 20px; font-weight: 700; color: var(--k-ink); overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
.rt-head__state { flex-shrink: 0; padding: 4px 10px; border-radius: 8px; background: var(--k-paper2); font-size: 14px; color: var(--k-ink2); }
.rt-card { margin: 12px 16px 0; padding: 16px; border: 1px solid var(--k-line); border-radius: 12px; background: var(--k-paper); }
.rt-card--off { background: var(--k-paper2); }
.rt-card__top { display: flex; align-items: center; gap: 10px; }
.rt-card__name { flex: 1; min-width: 0; font-size: 18px; font-weight: 700; line-height: 26px; color: var(--k-ink); }
.rt-card__state { flex-shrink: 0; font-size: 14px; font-weight: 600; color: var(--k-green); }
.rt-card__state--off { color: var(--k-muted); }
.rt-card__line { display: block; margin-top: 6px; font-size: 15px; line-height: 22px; color: var(--k-ink2); }
.rt-card__price { display: block; margin-top: 6px; font-size: 16px; font-weight: 600; line-height: 24px; color: var(--k-red-deep); }
.rt-card__acts { display: flex; gap: 10px; margin-top: 14px; }
.rt-btn { flex: 1; min-width: 0; height: 48px; border-radius: 12px; background: var(--k-red-deep); color: var(--k-paper); display: flex; align-items: center; justify-content: center; gap: 6px; font-size: 16px; font-weight: 600; }
.rt-btn--ghost { flex: 0 0 34%; background: var(--k-paper2); color: var(--k-ink); }
.rt-btn__t { margin-left: 6px; }
.rt-empty { display: block; margin: 24px 16px 0; padding: 20px 16px; border: 1px dashed var(--k-line2); border-radius: 12px; font-size: 16px; line-height: 26px; color: var(--k-ink2); text-align: center; }
.rt-hint { display: block; margin-bottom: 12px; font-size: 14px; line-height: 22px; color: var(--k-muted); }
.rt-fill { display: flex; align-items: center; justify-content: center; gap: 6px; min-height: 48px; margin-bottom: 12px; border: 1px solid var(--k-red-line); border-radius: 12px; background: var(--k-red-soft); font-size: 16px; font-weight: 600; color: var(--k-red-deep); }
.rt-day { display: flex; align-items: center; gap: 12px; margin-top: 10px; }
.rt-day__k { flex: 0 0 44px; font-size: 17px; font-weight: 600; color: var(--k-ink); }
.rt-day__k--weekend { color: var(--k-red-deep); }
.rt-day__money { flex: 1; min-width: 0; }
.rt-btn--off { opacity: .6; }
/* 2026-11-03 房态（s=3）：房型是一排大格子（44px 高）；14 天小表每行 48px、字 15；周末日期棕色、关房那行灰底；
   底部面板和 fc-sheet 一样 998 层、只有它有阴影，里面是普通的输入框和步进器 */
.cal-types { display: flex; flex-wrap: wrap; gap: 8px; padding: 0 16px 16px; }
.cal-type { min-height: 44px; padding: 0 16px; border: 1px solid var(--k-line2); border-radius: 12px; background: var(--k-paper2); display: flex; align-items: center; font-size: 15px; color: var(--k-ink2); box-sizing: border-box; }
.cal-type.on { border-color: var(--k-red-deep); background: var(--k-red-deep); color: var(--k-paper); font-weight: 600; }
.cal-hint { padding: 0 16px; margin-bottom: 8px; }
.cal-table { margin: 0 16px 16px; border: 1px solid var(--k-line); border-radius: 12px; background: var(--k-paper); overflow: hidden; }
.cal-tr { display: flex; align-items: center; min-height: 48px; padding: 0 12px; border-top: 1px solid var(--k-line); font-size: 15px; color: var(--k-ink); }
.cal-tr--head { min-height: 40px; border-top: 0; background: var(--k-paper2); font-size: 13px; color: var(--k-muted); }
.cal-tr--closed { background: var(--k-paper2); color: var(--k-muted); }
.cal-tr--on { background: var(--k-red-soft); }
.cal-td { flex: 1; min-width: 0; text-align: center; }
.cal-td--date { flex: 0 0 96px; text-align: left; font-weight: 600; }
.cal-td--weekend { color: var(--k-red-deep); }
.cal-td--price { font-weight: 600; }
.cal-td--state { flex: 0 0 64px; text-align: right; color: var(--k-green); }
.cal-td--off { color: var(--k-alert); }
.cal-loading { display: block; padding: 14px 12px; font-size: 14px; color: var(--k-muted); text-align: center; }
.cal-apply { margin-top: 12px; }
.cal-apply-row { display: flex; gap: 10px; margin-top: 10px; }
.cal-ghost { flex: 1; }
.cal-ghost--open { background: var(--k-green); color: var(--k-paper); }
.cal-sheet { position: fixed; left: 0; top: 0; right: 0; bottom: 0; z-index: 998; }
.cal-sheet__mask { position: absolute; left: 0; top: 0; right: 0; bottom: 0; background: rgba(58, 50, 43, .45); }
.cal-sheet__panel { position: absolute; left: 0; right: 0; bottom: 0; padding-bottom: calc(12px + var(--k-safe-bottom)); border-radius: 16px 16px 0 0; background: var(--k-paper); box-shadow: var(--k-sh3); }
.cal-sheet__head { display: flex; align-items: center; gap: 8px; min-height: 60px; padding: 8px 8px 0 16px; }
.cal-sheet__copy { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
.cal-sheet__title { font-size: 18px; font-weight: 700; color: var(--k-ink); }
.cal-sheet__sub { font-size: 14px; color: var(--k-muted); overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
.cal-sheet__x { flex-shrink: 0; width: 44px; height: 44px; display: flex; align-items: center; justify-content: center; }
.cal-sheet__btns { display: flex; gap: 10px; padding: 8px 16px 0; }
.cal-sheet__btns .rt-btn--ghost { flex: 1; }
</style>
