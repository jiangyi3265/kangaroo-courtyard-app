<template>
  <view class="k-page dispatch-page">
    <template v-if="s===1">
      <k-topbar title="需求看板" back custom-back @back="backScreen" />
      <view class="board-tabs"><text :class="{active:dim==='city'}" @click="setDim('city')">按城市</text><text :class="{active:dim==='store'}" @click="setDim('store')">按门店</text></view>
      <view class="board-filters"><button @click="pickCity"><k-icon name="map-pin" :size="18" color="muted" /><text>{{ board.city || '城市' }}</text><k-icon name="chevron-down" :size="16" color="ink" /></button><button @click="pickDate"><text>{{ board.date || '日期' }}</text><k-icon name="calendar-days" :size="18" color="ink" /></button><button class="filter" @click="pickType"><text>{{ typeLabel }}</text><k-icon name="list-filter" :size="20" color="ink" /></button></view>
      <view class="board k-pad-tab"><text class="board-title">需求总览</text><view class="legend"><view class="legend-item"><view class="swatch green" /><text>换工</text></view><view class="legend-item"><view class="swatch amber" /><text>兼职</text></view><view class="legend-item"><view class="swatch blue" /><text>全职</text></view></view>
        <view class="board-grid"><view class="city-column"><view v-for="c in cities" :key="c.name" class="city-card" @click="cardActions(c)"><view class="city-head"><text>{{c.name}}</text><text>急缺 {{c.urgent}}</text></view><view class="city-labels"><text></text><text>换工</text><text>兼职</text><text>全职</text></view><view><text>总需求</text><text>{{c.need[0]}}</text><text>{{c.need[1]}}</text><text>{{c.need[2]}}</text></view><view><text>已安排</text><text>{{c.arranged[0]}}</text><text>{{c.arranged[1]}}</text><text>{{c.arranged[2]}}</text></view><view class="gap-row"><text>缺口</text><text>{{c.gap[0]}}</text><text>{{c.gap[1]}}</text><text>{{c.gap[2]}}</text></view></view></view>
          <view class="heat-column"><view class="heat-card"><text>{{ heat.title || '需求热力日历' }}</text><view class="month"><text @click="shiftMonth(-1)">〈　{{ heat.month || '' }}</text><text @click="shiftMonth(1)">〉</text></view><view class="week"><text v-for="w in weeks" :key="w">{{w}}</text></view><view class="days"><text v-for="(d,i) in heatCells" :key="i" :class="d.c">{{ d.d || '' }}</text></view><view class="heat-legend"><view class="heat-legend-item"><view class="swatch low" /><text>低（0-5）</text></view><view class="heat-legend-item"><view class="swatch mid" /><text>中（6-15）</text></view><view class="heat-legend-item"><view class="swatch high" /><text>高（16-30）</text></view><view class="heat-legend-item"><view class="swatch urgent" /><text>紧急（30+）</text></view></view></view><text class="top-title">今日急缺门店 TOP5</text><view class="top-list"><view v-for="(t,i) in topStores" :key="t.name" @click="cardActions(t)"><text>{{i+1}}　{{t.name}}</text><text>缺口 <text>{{t.gap}}</text></text></view></view></view>
        </view>
      </view><k-tabbar mode="staff" active="work" />
    </template>
    <template v-else-if="s===2">
      <k-topbar title="调整数目" back custom-back @back="backScreen" />
      <view class="adjust k-pad-tab"><text class="section-title">门店与岗位</text><view class="store-card"><view @click="pickStore"><image :src="absUrl(adj.store.cover) || '/static/media/cover-empty.png'" mode="aspectFill" /><view><text>{{ adj.store.storeName || '' }}</text><text>{{ adj.store.sub || '' }}</text></view><k-icon name="chevron-right" :size="23" color="ink" /></view><view @click="pickJob"><text>岗位</text><text>{{ jobLabel }}</text><k-icon name="chevron-right" :size="23" color="ink" /></view></view>
        <text class="section-title">人员需求调整</text><view class="demand-table"><view class="demand-head"><text></text><text>当前需求</text><text>建议人数</text><text>调整</text></view><view v-for="r in demands" :key="r.name"><text>{{r.name}}</text><text>{{r.current}}</text><text>{{r.suggest}}</text><view class="mini-counter"><text @click="stepDelta(r, -1)">−</text><text>{{r.add}}</text><text @click="stepDelta(r, 1)">＋</text></view></view></view>
        <text class="section-title">有效日期</text><view class="date-range"><text @click="askFrom">{{ validFrom }}</text><text>→</text><text @click="askTo">{{ validTo }}</text><k-icon name="calendar-days" :size="20" color="ink" /></view>
        <text class="section-title">调整原因 <text>（必填）</text></text><view class="reason" @click="askReason"><text>{{ reason || '点击填写调整原因' }}</text><text>{{ reason.length }}/100</text></view><button class="save" @click="saveAdjust"><text>保存调整</text></button>
      </view><k-tabbar mode="staff" active="work" />
    </template>
    <template v-else-if="s===3">
      <k-topbar title="紧急标记" back custom-back @back="backScreen" />
      <view class="urgent-page k-pad-tab"><text class="section-title">选择紧急等级</text><view class="urgent-levels"><view v-for="(u,i) in urgencies" :key="u.name" :class="{selected:i===level-1}" @click="level=i+1"><k-icon name="flag" :size="32" :color="u.color" fill="currentColor" /><text :style="{color:u.color}">{{u.name}}</text><text>{{u.desc}}</text><view v-if="i===level-1" class="level-check"><k-icon name="check" :size="12" color="white" /></view></view></view>
        <text class="urgent-order-help">标记后，招募列表和岗位详情会显示醒目标记；有效期内按紧急等级优先展示，同等级按后台展示顺序排列。截止或暂停后取消紧急优先。</text>
        <view v-if="pushResult" class="urgent-result" aria-live="polite"><text class="urgent-result__title">{{ pushResult.title }}</text><text>{{ pushResult.summary }}</text><text v-for="reason in pushResult.reasons" :key="reason" class="urgent-result__reason">{{ reason }}</text><button @click="go('/pages/jobs/detail?jobId=' + adjJobId)">查看招募页 <k-icon name="chevron-right" :size="15" color="red" /></button></view>
        <text class="section-title">缺口情况</text><view class="gap-cards"><view><text>当前缺口</text><text>{{ urg.gap || 0 }} <text class="unit">人</text></text></view><view><text>预计影响场次</text><text>{{ sessions }} <text class="unit">场</text></text></view></view>
        <text class="section-title">截止时间</text><view class="deadline"><view @click="askDeadlineDate"><text>{{ dlDate }}</text><k-icon name="calendar-days" :size="20" color="ink" /></view><view @click="pickDeadlineTime"><text>{{ dlTime }}</text><k-icon name="clock-3" :size="20" color="muted" /></view></view>
        <view class="targets-title"><text class="section-title">触达对象</text><text>已选 {{ selTargets.length }} 项</text></view><view class="targets"><view v-for="(t,i) in targets" :key="t.key" @click="toggleTarget(t.key)"><view class="checkbox" :class="{checked:selTargets.includes(t.key)}"><k-icon v-if="selTargets.includes(t.key)" name="check" :size="13" color="white" /></view><text>{{t.label}}</text></view></view>
        <view class="push-row" role="switch" :aria-checked="push" @click="push=!push"><view><text>通知关注与收藏用户</text><text>{{ pushHint }}</text></view><view class="switch" :style="push ? '' : 'background:#D9D3C7'"><view :style="push ? '' : 'margin-left:0'" /></view></view>
        <text class="urgent-order-help">通知按用户的提醒设置发送，每个岗位24小时内最多通知用户一次。微信提醒还需用户授权，站内发送人数不代表微信已送达。关闭通知不影响公开招募标记。</text>
        <view class="preview"><text>预览提示</text><text>{{ previewText }}</text></view><button class="save" @click="saveUrgent"><text>确认标记并推送</text></button>
      </view><k-tabbar mode="staff" active="work" />
    </template>
    <template v-else>
      <k-topbar title="调度日志" back custom-back @back="backScreen" />
      <view class="logs-page k-pad-tab"><view class="log-filters"><button @click="pickLogStore"><text>{{ logStoreLabel }}⌄</text></button><button @click="pickLogRange"><text>{{ logQuery.from }}　→　{{ logQuery.to }}⌄</text></button><button @click="pickLogType"><text>{{ logTypeLabel }}</text><k-icon name="list-filter" :size="18" color="ink" /></button></view>
        <view v-for="(l,i) in logRows" :key="l.logId" class="log-card" @click="logAction(l)"><view class="log-head"><image :src="absUrl(l.avatar) || logAvatar(l)" mode="aspectFill" /><view><text>{{l.user}}</text><text>{{l.time}}</text></view><text :class="l.tone">{{l.type}}</text></view><text class="log-job">{{l.job}}</text><view class="log-change"><text>{{l.change}}</text><text>{{l.source}}{{ l.canUndo ? ' · 点卡片可撤销' : '' }}</text></view></view>
        <view class="log-note"><view><text>撤销条件说明</text><text>仅支持撤销本人在 1 小时内的调整操作；\n超过时间请联系上级主管处理。</text></view><button @click="exportLogs"><text>导出日志</text></button></view>
      </view><k-tabbar mode="staff" active="work" />
    </template>
    <k-date-picker v-if="boardCalendarOpen" title="看板日期" :value="calendarDate" @cancel="boardCalendarOpen = false" @confirm="confirmBoardDate" />
    <!-- 有效期 / 截止日期 / 日志自定义区间：之前要手敲 yyyy-MM-dd，格式错了只弹提示；统一换成日历 -->
    <k-date-picker v-if="datePick" :title="datePick.title" :value="datePick.value" :min-date="datePick.min || ''" :max-date="datePick.max || ''" @cancel="datePick = null" @confirm="confirmDatePick" />
  </view>
</template>

<script setup>
import { selectCity } from '@/common/city-picker.js'
// ---------------------------------------------------------------------------
// 调度（员工端）接入情况：
//   s=1 需求看板：apiDispatchBoard，只统计当前账号有授权的门店；总需求 = 招聘名额，已安排 = 已录用，缺口 = 两者之差；
//       热力日历按"到岗日期起 30 天招募窗口"累计缺口，分档与图例一致
//   s=2 调整数目：改的是所选岗位的招聘名额（有效期结束后自动恢复），必须填原因，记调度日志
//   s=3 紧急标记：等级 + 截止时间写到岗位上；触达对象是真实的门店员工 / 收藏过岗位的用户，走站内消息
//   s=4 调度日志：本人 1 小时内的调整可撤销；导出为 CSV（H5 直接下载，小程序复制到剪贴板）
//   入口：看板上点城市 / 门店卡片或「今日急缺门店」→ 调整名额 / 紧急标记（名额不变也能标）/ 调度日志
// ---------------------------------------------------------------------------
import { absUrl } from '@/common/upload.js'
import { ref, computed, watch, nextTick } from 'vue'
import { useScreen, toast, back, go } from '@/common/screen.js'
import { urgentResult } from './urgent-result.js'
import {
  apiDispatchBoard, apiDispatchAdjustInfo, apiDispatchAdjust, apiDispatchUrgentInfo, apiDispatchUrgent,
  apiDispatchLogs, apiDispatchUndo, apiDispatchExport
} from '@/common/api.js'
import { ensureSession, hasStaffAccess, currentStaffStoreId } from '@/common/experience.js'
import { errText, confirm, alert, prompt, sheet, pickPaged, copy, isYmd, shiftDate, todayCn, serverTs, askTime } from '@/common/ui.js'

const DEFAULT_AVATAR = '/static/media/profile-avatar.jpg'
let deepJobId = 0
const s = useScreen(4, { onLoad: (q) => { deepJobId = Number(q?.jobId) || 0; loadScreen(s.value) } })
watch(s, (v) => loadScreen(v))
// 页内各屏的来路：返回按来路一层层退，退到直接打开的那一屏就回来源页
// （之前看板没有返回键；从岗位页「调整名额」直接进第 2 屏，返回会落到没有返回键的看板上）
const trail = []
const goScreen = (n) => { if (n !== s.value) { trail.push(s.value); s.value = n } }
const backScreen = () => { if (trail.length) s.value = trail.pop(); else back() }

async function loadScreen(v) {
  await ensureSession()
  if (!hasStaffAccess.value) return
  if (v === 1) return loadBoard()
  if (v === 2) return loadAdjust(adjJobId.value || deepJobId || null)
  if (v === 3) {
    // 「紧急招募」消息带 ?s=3&jobId= 直接打开这个岗位：紧急标记接口按岗位找门店，不用先按当前门店读调整页
    // （员工有多家门店授权、当前门店又不是岗位所在门店时，调整页会落到当前门店的第一个岗位）
    if (!adjJobId.value && deepJobId) adjJobId.value = deepJobId
    if (!adjJobId.value) await loadAdjust(null)
    return loadUrgent()
  }
  return loadLogs()
}

// ---------------- s=1 需求看板 ----------------
const weeks = ['一', '二', '三', '四', '五', '六', '日']
const dim = ref('city')
const board = ref({})
const boardQuery = ref({ city: '', date: '', type: '' })
const TYPE_OPTS = [{ v: '', l: '全部类型' }, { v: 'volunteer', l: '换工' }, { v: 'parttime', l: '兼职' }, { v: 'fulltime', l: '全职' }]
const cities = computed(() => board.value.cards || [])
const heat = computed(() => board.value.heat || {})
const heatCells = computed(() => heat.value.cells || [])
const topStores = computed(() => board.value.topStores || [])
const typeLabel = computed(() => (boardQuery.value.type ? TYPE_OPTS.find(o => o.v === boardQuery.value.type).l : '筛选'))

let boardRequest = 0
async function loadBoard() {
  const request = ++boardRequest
  try {
    const q = boardQuery.value
    const res = await apiDispatchBoard({ dim: dim.value, city: q.city || undefined, date: q.date || undefined, type: q.type || undefined })
    if (request === boardRequest) board.value = res.data || {}
  } catch (e) {
    if (request === boardRequest) toast(errText(e, '看板加载失败'))
  }
}
const setDim = (v) => { dim.value = v; loadBoard() }
const pickCity = async () => {
  const list = board.value.cities || []
  const value = await selectCity({ value: boardQuery.value.city, items: list, hint: '选择已有门店授权的城市', emptyText: '暂无已授权城市' })
  if (value === null) return
  boardQuery.value.city = value
  loadBoard()
}
const boardCalendarOpen = ref(false)
const calendarDate = ref(todayCn())
const pickDate = () => {
  calendarDate.value = board.value.date || boardQuery.value.date || todayCn()
  boardCalendarOpen.value = true
}
const confirmBoardDate = (date) => {
  boardCalendarOpen.value = false
  boardQuery.value.date = date
  loadBoard()
}
const pickType = async () => {
  const i = await sheet(TYPE_OPTS.map(o => o.l))
  if (i < 0) return
  boardQuery.value.type = TYPE_OPTS[i].v
  loadBoard()
}
// 热力日历翻月：之前点月份文字其实就是"上个月"，但只画了右边的〉，看不出能往前翻；现在月份前补上〈
const shiftMonth = (n) => {
  const t = n < 0 ? heat.value.prev : heat.value.next
  if (!t) return
  boardQuery.value.date = t
  loadBoard()
}
// 点看板上的城市 / 门店卡片或急缺门店：对这里的缺口做调整、标紧急，或看调度日志。
// 门店卡片带 storeId（服务端按门店汇总时给出），城市卡片按当前门店处理、日志看全部门店
async function cardActions(card) {
  const storeId = card.storeId || null
  const opts = ['调整名额', '紧急标记（名额不变）', '调度日志']
  const i = await sheet(opts)
  if (i < 0) return
  if (i === 2) {
    logQuery.value.storeId = storeId
    return goScreen(4)
  }
  adjStoreId.value = storeId || currentStaffStoreId()
  adjJobId.value = null
  if (i === 0) return goScreen(2)
  await loadAdjust(null)
  pickUrgentJob()
}
// 紧急标记不必先改名额：选一个招聘中的岗位直接去标记（服务端只允许给招聘中的岗位标紧急）
async function pickUrgentJob() {
  const list = (adj.value.jobs || []).filter(j => j.status === 'published')
  if (!list.length) return toast('这家门店没有招聘中的岗位，无法标记紧急')
  const i = list.length === 1 ? 0 : await pickPaged(list.map(j => `${j.title}（${j.typeLabel}）`), '选择岗位')
  if (i < 0) return
  adj.value = { ...adj.value, job: list[i] }
  adjJobId.value = list[i].jobId
  goScreen(3)
}

// ---------------- s=2 调整数目 ----------------
const adj = ref({ store: {}, stores: [], jobs: [], job: null, demands: [], canEdit: false })
const adjStoreId = ref(null)
const adjJobId = ref(null)
const delta = ref(0)
const validFrom = ref('')
const validTo = ref('')
const reason = ref('')
const jobLabel = computed(() => (adj.value.job ? `${adj.value.job.title}（${adj.value.job.typeLabel}）` : '暂无可调整的岗位'))
const demands = computed(() => (adj.value.demands || []).map((d) => {
  const mine = !!adj.value.job && adj.value.job.jobType === d.type
  const add = mine ? delta.value : 0
  return { ...d, mine, add: (add > 0 ? '+' : '') + add, suggest: d.current + add }
}))

async function loadAdjust(jobId) {
  try {
    const res = await apiDispatchAdjustInfo({ storeId: adjStoreId.value || currentStaffStoreId(), jobId: jobId || undefined })
    const data = res.data || {}
    adj.value = {
      store: data.store || {}, stores: data.stores || [], jobs: data.jobs || [], job: data.job || null,
      demands: data.demands || [], canEdit: !!data.canEdit
    }
    adjStoreId.value = (data.store || {}).storeId || null
    adjJobId.value = data.job ? data.job.jobId : null
    delta.value = 0
    if (!validFrom.value) {
      validFrom.value = data.validFrom || ''
      validTo.value = data.validTo || ''
    }
  } catch (e) {
    toast(errText(e, '加载失败'))
  }
}
const pickStore = async () => {
  const list = adj.value.stores || []
  if (list.length <= 1) return toast('你只有这一家门店的授权')
  const i = await pickPaged(list.map(x => x.storeName), '选择门店')
  if (i < 0) return
  adjStoreId.value = list[i].storeId
  adjJobId.value = null
  loadAdjust(null)
}
const pickJob = async () => {
  const list = adj.value.jobs || []
  if (!list.length) return toast('这家门店没有招聘中或暂停中的岗位')
  const i = await pickPaged(list.map(j => `${j.title}（${j.typeLabel}）`), '选择岗位')
  if (i < 0) return
  adj.value = { ...adj.value, job: list[i] }
  adjJobId.value = list[i].jobId
  delta.value = 0
}
const stepDelta = (r, n) => {
  if (!r.mine) return toast(adj.value.job ? `所选岗位是${adj.value.job.typeLabel}，请先在上方换成${r.name}岗位` : '请先在上方选择岗位')
  const job = adj.value.job
  const next = delta.value + n
  const after = job.headcount + next
  if (after < Math.max(1, job.hiredCount || 0)) return toast(`名额不能少于已录用的 ${Math.max(1, job.hiredCount || 0)} 人`)
  if (after > 999) return toast('名额最多 999 人')
  delta.value = next
}
// 日历弹层：datePick = { title, value, min, max, apply(date) }
const datePick = ref(null)
const confirmDatePick = (date) => {
  const p = datePick.value
  datePick.value = null
  if (p && date) p.apply(date)
}
const askFrom = () => {
  datePick.value = { title: '有效期开始', value: validFrom.value || todayCn(), apply: (d) => {
    validFrom.value = d
    if (validTo.value && validTo.value < d) validTo.value = d
  } }
}
const askTo = () => {
  datePick.value = { title: '有效期结束', value: validTo.value || validFrom.value || todayCn(), min: validFrom.value, apply: (d) => { validTo.value = d } }
}
const askReason = async () => {
  const v = await prompt('调整原因（必填）', { value: reason.value, placeholder: '例如：节假日客流增长，周末场次增加' })
  if (v === null) return
  reason.value = v.slice(0, 100)
}
// 保存 / 标记 / 撤销都是写请求，网络慢时连点会重复提交（名额被加两次、通知发两遍）
let saving = false
async function saveAdjust() {
  if (!adj.value.job) return toast('请先选择岗位')
  if (!adj.value.canEdit) return toast('当前角色没有调度编辑权限')
  if (!delta.value) {
    // 名额不变也可以只做紧急标记（之前必须先改人数、保存后才进得了紧急标记）
    if (adj.value.job.status !== 'published') return toast('请先用 + / − 调整人数（已暂停的岗位不能标记紧急）')
    if (await confirm('名额不变', `没有调整人数。要直接给「${adj.value.job.title}」做紧急标记吗？`)) goScreen(3)
    return
  }
  if (reason.value.length < 2) return toast('请填写调整原因')
  if (saving) return
  saving = true
  try {
    const res = await apiDispatchAdjust({ jobId: adjJobId.value, delta: delta.value, validFrom: validFrom.value, validTo: validTo.value, reason: reason.value })
    toast(res.msg || '已保存')
    reason.value = ''
    await loadAdjust(adjJobId.value)
    goScreen(3)
  } catch (e) {
    toast(errText(e, '保存失败'))
  } finally {
    saving = false
  }
}

// ---------------- s=3 紧急标记 ----------------
const urgencies = [{ name: '一般', desc: '轻微缺口', color: '#4D8B69' }, { name: '较急', desc: '中等缺口', color: '#C7893F' }, { name: '紧急', desc: '严重缺口', color: '#B44734' }, { name: '特急', desc: '极度紧缺', color: '#A82F23' }]
const urg = ref({})
const pushResult = ref(null)
watch(adjJobId, () => { pushResult.value = null })
const level = ref(3)
const dlDate = ref('')
const dlTime = ref('18:00')
const selTargets = ref(['manager', 'staff'])
const push = ref(true)
const targets = computed(() => urg.value.targets || [])
// 预计影响场次：截止前按天排班，每天算一场
const sessions = computed(() => {
  const end = serverTs(dlDate.value + ' ' + dlTime.value + ':00')
  if (!end) return 0
  return Math.max(1, Math.ceil((end - Date.now()) / 86400000))
})
const pushHint = computed(() => `本店关注或收藏用户共 ${urg.value.subscribers || 0} 人（已去重），实际发送以结果为准`)
const previewText = computed(() => {
  const j = urg.value.job
  if (!j) return ''
  const md = dlDate.value ? dlDate.value.slice(5).replace('-', '/') : ''
  return `【紧急招募】${j.storeName}-${j.title}（${j.typeLabel}）缺口 ${urg.value.gap || 0} 人。\n截止 ${md} ${dlTime.value}，立即报名！`
})
async function loadUrgent() {
  if (!adjJobId.value) return
  try {
    const res = await apiDispatchUrgentInfo(adjJobId.value)
    urg.value = res.data || {}
    dlDate.value = urg.value.deadlineDate || ''
    dlTime.value = urg.value.deadlineTime || '18:00'
    const lv = (urg.value.job || {}).urgentLevel
    level.value = lv > 0 ? lv : 3
  } catch (e) {
    toast(errText(e, '加载失败'))
  }
}
const toggleTarget = (k) => {
  const i = selTargets.value.indexOf(k)
  if (i >= 0) selTargets.value.splice(i, 1)
  else selTargets.value.push(k)
}
const askDeadlineDate = () => {
  datePick.value = { title: '截止日期', value: dlDate.value || todayCn(), min: todayCn(), apply: (d) => { dlDate.value = d } }
}
const TIMES = ['12:00', '18:00', '20:00', '22:00', '自定义…']
const pickDeadlineTime = async () => {
  const i = await sheet(TIMES)
  if (i < 0) return
  if (i < TIMES.length - 1) {
    dlTime.value = TIMES[i]
    return
  }
  const v = await askTime('截止时刻', dlTime.value)
  if (v) dlTime.value = v
}
async function saveUrgent() {
  if (!adjJobId.value) return toast('请先在"调整数目"里选择岗位')
  if (!urg.value.canEdit) return toast('当前角色没有调度编辑权限')
  if (!isYmd(dlDate.value)) return toast('请填写截止日期')
  if (saving) return
  if (!(await confirm('确认标记', `标记为「${urgencies[level.value - 1].name}」并通知所选对象？`))) return
  if (saving) return
  saving = true
  pushResult.value = null
  try {
    const res = await apiDispatchUrgent({
      jobId: adjJobId.value, level: level.value, deadline: dlDate.value + ' ' + dlTime.value,
      targets: selTargets.value, push: push.value
    })
    pushResult.value = urgentResult(res.data || {})
    toast('紧急标记已更新，可查看通知结果')
    await nextTick()
    uni.pageScrollTo({ scrollTop: 0, duration: 200, fail: () => {} })
    loadUrgent()
  } catch (e) {
    toast(errText(e, '标记失败'))
  } finally {
    saving = false
  }
}

// ---------------- s=4 调度日志 ----------------
const logs = ref({})
const logRows = computed(() => logs.value.rows || [])
const logQuery = ref({ storeId: null, from: '', to: '', type: '' })
const LOG_TYPES = [{ v: '', l: '全部类型' }, { v: 'adjust', l: '数值调整' }, { v: 'urgent', l: '紧急标记' }, { v: 'sync', l: '系统同步' }, { v: 'undo', l: '撤销调整' }]
const logStoreLabel = computed(() => {
  const hit = (logs.value.stores || []).find(x => x.storeId === logQuery.value.storeId)
  return hit ? hit.storeName : '全部门店'
})
const logTypeLabel = computed(() => (logQuery.value.type ? LOG_TYPES.find(o => o.v === logQuery.value.type).l : '筛选'))
const logAvatar = () => DEFAULT_AVATAR
const logParams = () => {
  const q = logQuery.value
  return { storeId: q.storeId || undefined, from: q.from || undefined, to: q.to || undefined, type: q.type || undefined }
}
async function loadLogs() {
  try {
    const res = await apiDispatchLogs(logParams())
    logs.value = res.data || {}
    logQuery.value.from = logs.value.from || ''
    logQuery.value.to = logs.value.to || ''
  } catch (e) {
    toast(errText(e, '日志加载失败'))
  }
}
const pickLogStore = async () => {
  const list = logs.value.stores || []
  const i = await pickPaged(['全部门店'].concat(list.map(x => x.storeName)), '选择门店')
  if (i < 0) return
  logQuery.value.storeId = i === 0 ? null : list[i - 1].storeId
  loadLogs()
}
const pickLogRange = async () => {
  const opts = ['近 7 天', '近 30 天', '近 90 天', '自定义…']
  const i = await sheet(opts)
  if (i < 0) return
  const today = todayCn()
  if (i < 3) {
    logQuery.value.from = shiftDate(today, -[6, 29, 89][i])
    logQuery.value.to = today
  } else {
    // 先选开始日，确定后接着选结束日（不早于开始日、不晚于今天）
    datePick.value = { title: '开始日期', value: logQuery.value.from || today, max: today, apply: (f) => {
      datePick.value = { title: '结束日期', value: logQuery.value.to && logQuery.value.to >= f ? logQuery.value.to : today, min: f, max: today, apply: (t) => {
        logQuery.value.from = f
        logQuery.value.to = t
        loadLogs()
      } }
    } }
    return
  }
  loadLogs()
}
const pickLogType = async () => {
  const i = await sheet(LOG_TYPES.map(o => o.l))
  if (i < 0) return
  logQuery.value.type = LOG_TYPES[i].v
  loadLogs()
}
// 撤销入口是点日志卡片：之前卡片上没有任何提示，下方说明也只写了条件，用户不知道去哪撤销；现在可撤销的那几条在来源后注明
async function logAction(l) {
  if (!l.canUndo || saving) return
  if (!(await confirm('撤销调整', `撤销这次调整？\n${l.change}`))) return
  if (saving) return
  saving = true
  try {
    const res = await apiDispatchUndo(l.logId)
    toast(res.msg || '已撤销')
    loadLogs()
  } catch (e) {
    toast(errText(e, '撤销失败'))
  } finally {
    saving = false
  }
}
async function exportLogs() {
  // canExport 由服务端按所选门店算：选了某家看那家的角色；「全部门店」= 至少一家有导出权
  if (!logs.value.canExport) return toast(logQuery.value.storeId ? '你在这家门店没有调度日志导出权限' : '你在已授权的门店里都没有调度日志导出权限')
  try {
    const res = await apiDispatchExport(logParams())
    const data = res.data || {}
    // 「全部门店」只导出有导出权的门店，没权限的门店如实说明没包含
    const skipped = data.skippedStores || []
    const tellSkipped = () => skipped.length && alert('部分门店未导出', `已导出 ${data.count || 0} 条。${skipped.join('、')}：你在这些门店没有调度日志导出权限，结果里不含它们的日志。`)
    if (!data.count) {
      if (skipped.length) return tellSkipped()
      return toast('没有可导出的日志')
    }
    // #ifdef H5
    const blob = new Blob(['﻿' + data.csv], { type: 'text/csv;charset=utf-8' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `调度日志-${logQuery.value.from}-${logQuery.value.to}.csv`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    toast(`已导出 ${data.count} 条`)
    // #endif
    // #ifndef H5
    await copy(data.csv, `已复制 ${data.count} 条日志（CSV），可粘贴到表格`)
    // #endif
    tellSkipped()
  } catch (e) {
    toast(errText(e, '导出失败'))
  }
}
</script>

<style scoped lang="scss">
.urgent-result{display:flex;flex-direction:column;gap:7px;margin:12px 0;padding:13px;background:#F0F4EB;border:1px solid #CFDAC2;border-radius:10px;font-size:13px;line-height:1.6}
.urgent-result__title{font-size:15px;font-weight:700;color:#47633D}.urgent-result__reason{color:var(--k-muted);font-size:12px}.urgent-result button{display:flex;align-items:center;gap:4px;align-self:flex-start;min-height:40px;color:var(--k-red);font-size:14px}
.dispatch-page{background:var(--k-bg)}button{margin:0;padding:0;border:0;background:transparent}.board-tabs{height:41px;padding:0 52px;border-bottom:1px solid var(--k-line);display:flex;gap:48px;font-family:var(--k-serif);font-size:15px;font-weight:700}.board-tabs text{display:flex;align-items:center}.board-tabs .active{border-bottom:2px solid var(--k-red);color:var(--k-red)}.board-filters{height:57px;padding:0 14px;display:flex;align-items:center;gap:8px}.board-filters button{height:34px;padding:0 10px;border:1px solid var(--k-line2);border-radius:8px;background:var(--k-paper);display:flex;align-items:center;gap:7px;font-size:12px}.board-filters button:first-child{width:112px}.board-filters button:nth-child(2){width:124px}.board-filters .filter{margin-left:auto;border:0;background:transparent}.board-filters button>text{min-width:0;overflow:hidden;white-space:nowrap;text-overflow:ellipsis}.board{padding:0 14px calc(88px + var(--k-safe-bottom))}.board-title{font-family:var(--k-serif);font-size:15px;font-weight:700}.legend{height:34px;display:flex;align-items:center;gap:18px;font-size:11px}.legend text{display:flex;align-items:center;gap:5px}.legend i,.heat-legend i{width:9px;height:9px;border-radius:2px;background:var(--k-green)}.legend i.amber{background:#B9782B}.legend i.blue{background:var(--k-indigo)}.board-grid{display:flex;gap:9px}.city-column{width:52%}.city-card{margin-bottom:7px;padding:9px;border:1px solid var(--k-line2);border-radius:8px;background:var(--k-paper)}.city-card>view{height:24px;display:grid;grid-template-columns:1.3fr repeat(3,1fr);align-items:center;text-align:center;font-size:11px}.city-head{display:flex!important;justify-content:space-between;font-family:var(--k-serif);font-size:14px!important;font-weight:700}.city-head text:first-child{min-width:0;flex:1;overflow:hidden;white-space:nowrap;text-overflow:ellipsis}.city-head text:last-child{flex-shrink:0;padding:3px 7px;border-radius:10px;background:var(--k-red-soft);color:var(--k-red-deep);font-size:10px}.city-labels{font-family:var(--k-serif);font-weight:700}.city-labels text:nth-child(2),.city-card>view:not(.city-head) text:nth-child(2){color:var(--k-green)}.city-labels text:nth-child(3),.city-card>view:not(.city-head) text:nth-child(3){color:#B9782B}.city-labels text:nth-child(4),.city-card>view:not(.city-head) text:nth-child(4){color:var(--k-indigo)}.gap-row text{color:var(--k-red)!important;font-weight:700}.heat-column{min-width:0;flex:1}.heat-card{padding:9px;border:1px solid var(--k-line2);border-radius:8px;background:var(--k-paper)}.heat-card>text:first-child{font-family:var(--k-serif);font-size:13px;font-weight:700}.month{height:31px;display:flex;align-items:center;justify-content:center;gap:36px;font-size:12px}.week,.days{display:grid;grid-template-columns:repeat(7,1fr);gap:3px}.week text{height:16px;text-align:center;font-size:9px}.days text{height:25px;border-radius:4px;display:flex;align-items:center;justify-content:center;background:#F6F1E9;font-size:9px}.days text.low{background:#F8E9DE}.days text.mid{background:#F5CDB7}.days text.high{background:#ED9975}.days text.urgent{background:#B92E1F;color:#fff}.heat-legend{margin-top:9px;display:grid;grid-template-columns:1fr 1fr;gap:7px;font-size:8px}.heat-legend text{display:flex;align-items:center;gap:4px}.heat-legend i.low{background:#F8E9DE}.heat-legend i.mid{background:#F5CDB7}.heat-legend i.high{background:#ED9975}.heat-legend i.urgent{background:#B92E1F}.top-title{display:block;margin:14px 0 7px;font-family:var(--k-serif);font-size:13px;font-weight:700}.top-list>view{height:28px;display:flex;align-items:center;justify-content:space-between;gap:6px;font-size:10px}.top-list>view>text:first-child{min-width:0;flex:1;overflow:hidden;white-space:nowrap;text-overflow:ellipsis}.top-list>view>text:last-child{flex-shrink:0}.top-list>view>text:last-child text{color:var(--k-red-deep);font-size:13px}
.adjust,.urgent-page,.logs-page{padding:0 14px calc(88px + var(--k-safe-bottom))}.section-title{display:block;margin:13px 0 8px;font-family:var(--k-serif);font-size:16px;font-weight:700}.section-title>text{color:var(--k-red-deep);font-size:13px}.store-card,.demand-table,.date-range,.reason{border:1px solid var(--k-line2);border-radius:9px;background:var(--k-paper)}.store-card>view{height:74px;padding:0 11px;border-bottom:1px solid var(--k-line);display:flex;align-items:center;gap:10px}.store-card>view:last-child{height:43px;border-bottom:0}.store-card image{width:53px;height:53px;border-radius:7px}.store-card>view>view{min-width:0;flex:1;display:flex;flex-direction:column;gap:7px}.store-card>view>view text:first-child{font-family:var(--k-serif);font-size:16px;font-weight:700}.store-card>view>view text:last-child{color:var(--k-muted);font-size:12px}.store-card>view:last-child>text:nth-child(2){margin-left:auto;font-weight:700}.demand-table>view{height:48px;padding:0 11px;border-bottom:1px solid var(--k-line);display:grid;grid-template-columns:1fr .8fr .8fr 1.1fr;align-items:center;text-align:center}.demand-table>view:last-child{border-bottom:0}.demand-head{height:34px!important;color:var(--k-muted);font-size:11px}.mini-counter{height:31px;border:1px solid var(--k-line2);border-radius:7px;display:flex}.mini-counter text{flex:1;display:flex;align-items:center;justify-content:center}.date-range{height:45px;padding:0 11px;display:flex;align-items:center;justify-content:space-between}.reason{position:relative;min-height:75px;padding:11px 11px 24px}.reason>text:last-child{position:absolute;right:10px;bottom:8px;color:var(--k-muted);font-size:11px}.save{width:100%;height:47px;display:flex;align-items:center;justify-content:center;margin-top:19px;border-radius:8px;background:var(--k-red);color:#fff;font-family:var(--k-serif);font-size:17px;font-weight:700}
.urgent-order-help{display:block;margin:10px 0;color:var(--k-muted);font-size:12px;line-height:1.6}.urgent-levels{display:flex;gap:8px}.urgent-levels>view{position:relative;height:82px;flex:1;border:1px solid var(--k-line2);border-radius:8px;background:var(--k-paper);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:5px}.urgent-levels>view.selected{border:1.5px solid var(--k-red)}.urgent-levels>view text:nth-child(2){font-family:var(--k-serif);font-size:14px;font-weight:700}.urgent-levels>view text:nth-child(3){color:var(--k-muted);font-size:10px}.level-check{position:absolute;right:2px;bottom:2px;width:17px;height:17px;border-radius:50%;background:var(--k-red);display:flex;align-items:center;justify-content:center}.gap-cards,.deadline{display:flex;gap:9px}.gap-cards>view,.deadline>view{height:39px;flex:1;padding:0 11px;border:1px solid var(--k-line2);border-radius:8px;background:var(--k-paper);display:flex;align-items:center;justify-content:space-between}.gap-cards>view text:last-child{color:var(--k-red);font-size:18px;font-weight:700}.gap-cards small{font-size:11px;color:var(--k-ink);font-weight:400}.deadline>view:first-child{flex:1.6}.targets-title{display:flex;align-items:center;justify-content:space-between}.targets-title .section-title{margin-bottom:5px}.targets-title>text:last-child{color:var(--k-muted);font-size:12px}.targets>view{height:31px;display:flex;align-items:center;gap:8px;font-size:12px}.checkbox{width:18px;height:18px;border:1px solid var(--k-line2);border-radius:4px;display:flex;align-items:center;justify-content:center}.checkbox.checked{background:var(--k-red);border-color:var(--k-red)}.push-row{margin-top:9px;padding:11px 0;border-top:1px solid var(--k-line);display:flex;align-items:center}.push-row>view:first-child{min-width:0;flex:1;display:flex;flex-direction:column;gap:7px}.push-row>view:first-child text:first-child{font-family:var(--k-serif);font-size:15px;font-weight:700}.push-row>view:first-child text:last-child{color:var(--k-muted);font-size:11px}.switch{width:45px;height:26px;padding:2px;border-radius:15px;background:var(--k-green)}.switch>view{width:22px;height:22px;margin-left:19px;border-radius:50%;background:#fff}.preview{padding:10px;border:1px solid var(--k-line2);border-radius:8px;background:var(--k-paper);display:flex;flex-direction:column;gap:8px}.preview text:first-child{font-family:var(--k-serif);font-size:14px;font-weight:700}.preview text:last-child{white-space:pre-line;font-size:11px;line-height:1.5}
.log-filters{height:48px;display:flex;gap:7px;align-items:center}.log-filters button{min-width:0;height:34px;display:flex;align-items:center;justify-content:center;padding:0 10px;border:1px solid var(--k-line2);border-radius:8px;background:var(--k-paper);font-size:11px}.log-filters button:first-child{max-width:30%}.log-filters button:first-child text{overflow:hidden;white-space:nowrap;text-overflow:ellipsis}.log-filters button:nth-child(2){flex:1}.log-filters button:last-child{display:flex;align-items:center;gap:4px}.log-card{margin-bottom:8px;padding:10px;border:1px solid var(--k-line2);border-radius:9px;background:var(--k-paper)}.log-head{display:flex;align-items:center;gap:9px}.log-head image{width:38px;height:38px;border-radius:50%}.log-head>view{min-width:0;flex:1;display:flex;flex-direction:column;gap:5px}.log-head>view text:first-child{font-family:var(--k-serif);font-size:14px;font-weight:700}.log-head>view text:last-child{font-size:11px;color:var(--k-muted)}.log-head>text{padding:4px 8px;border-radius:10px;font-size:10px}.log-head>text.green{background:var(--k-green-soft);color:var(--k-green)}.log-head>text.red{background:var(--k-alert-soft);color:var(--k-alert)}.log-head>text.blue{background:#E9F1F6;color:var(--k-indigo)}.log-job{display:block;margin:10px 0 8px;font-family:var(--k-serif);font-size:14px;font-weight:700}.log-change{display:flex;justify-content:space-between;align-items:flex-end;font-size:11px;color:var(--k-muted)}.log-change>text:first-child{white-space:pre-line;color:var(--k-ink);font-size:12px}.log-note{margin-top:15px;padding:11px;border:1px solid var(--k-line2);border-radius:9px;background:var(--k-paper);display:flex;align-items:center}.log-note>view{min-width:0;flex:1;display:flex;flex-direction:column;gap:7px}.log-note>view text:first-child{font-family:var(--k-serif);font-size:14px;font-weight:700}.log-note>view text:last-child{white-space:pre-line;color:var(--k-muted);font-size:10px}.log-note button{width:99px;height:42px;display:flex;align-items:center;justify-content:center;border:1px solid var(--k-red-line);border-radius:8px;color:var(--k-red);font-family:var(--k-serif);font-size:14px;font-weight:700}
.legend-item,.heat-legend-item{display:flex;align-items:center;gap:5px}.swatch{width:9px;height:9px;border-radius:2px;background:var(--k-green)}.swatch.amber{background:#B9782B}.swatch.blue{background:var(--k-indigo)}.swatch.low{background:#F8E9DE}.swatch.mid{background:#F5CDB7}.swatch.high{background:#ED9975}.swatch.urgent{background:#B92E1F}.gap-cards .unit{font-size:11px;color:var(--k-ink);font-weight:400}.urgent-page .section-title{margin:9px 0 6px}.urgent-page .urgent-levels>view{height:76px}.urgent-page .targets>view{height:27px}.urgent-page .push-row{margin-top:6px;padding:8px 0}.urgent-page .preview{padding:8px;gap:5px}.urgent-page .preview text:last-child{line-height:1.3}.urgent-page{padding-bottom:calc(140px + var(--k-safe-bottom))}.urgent-page>.save{position:fixed;left:14px;right:14px;bottom:calc(76px + var(--k-safe-bottom));z-index:43;width:auto;margin:0;display:flex;align-items:center;justify-content:center}
/* 窄屏：热力日历的「〈　2026年10月」在 360/375 宽时「月」掉到第二行（两个箭头之间隔了 36px），改小间距并且不换行；
   筛选栏两个按钮写死 112 + 124 宽，320 宽时日期被挤成「2026-09-…」、「筛选」成了「筛…」：城市按钮可以缩，日期和筛选按内容宽 */
.month{gap:10px}.month>text{white-space:nowrap}
.board-filters button:first-child{width:auto;flex:0 1 112px;min-width:0}.board-filters button:nth-child(2){width:auto;flex:0 0 auto;min-width:112px}.board-filters .filter{flex:0 0 auto;padding:0 4px}
</style>
