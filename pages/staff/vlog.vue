<template>
  <view class="k-page vlog-page">
    <k-topbar :title="titles[s - 1]" back custom-back @back="onTopBack" />
    <view v-if="s === 1" class="k-body k-pad-vlog library-page">
      <view class="filter-row"><view v-for="(item, fi) in filterLabels" :key="fi" @click="pickFilter(fi)"><text>{{ item }}</text><k-icon name="chevron-down" :size="12" color="muted" /></view></view>
      <view class="k-between count-row"><text>共 {{ lib.total || 0 }} 条视频</text><view class="k-row k-gap4" @click="pickSort"><text>{{ sortLabel }}</text><k-icon name="chevron-down" :size="12" color="muted" /></view></view>
      <view class="notice"><view class="notice-icon"><k-icon name="bell" :size="18" color="ochre" /></view><view class="k-flex1"><text>每家房源每周至少 2 条</text><text>{{ lagText }}</text></view><text class="k-ochre" @click="showAdvice">去查看建议</text></view>
      <view class="video-list"><view v-for="(item,index) in videos" :key="item.vlogId" class="video-row" @click="openDetail(item)"><view class="video-cover"><image :src="thumb(item, index)" mode="aspectFill" /><text>{{ item.duration }}</text></view><view class="video-main"><view class="k-between"><text class="video-title">{{ item.title }}</text><view class="video-chip"><k-chip :tone="item.tone"><text>{{ item.status }}</text></k-chip></view></view><text class="video-source">{{ item.source }}</text><view class="video-meta"><k-icon name="clock-3" :size="14" color="muted" /><text>{{ item.time }}</text><k-icon name="heart" :size="14" color="muted" /><text>{{ item.likes }}</text><view class="k-flex1" /><k-icon name="ellipsis" :size="16" color="muted" /></view></view></view></view>
      <text class="no-more">{{ videos.length ? '没有更多了' : '暂无视频' }}</text>
    </view>
    <view v-else-if="s === 2" class="k-body k-pad-bottom review-page">
      <view class="review-card"><view class="review-source"><text>来源</text><text>{{ cur.source }}</text><view class="k-flex1" /><text class="k-indigo" @click="openOriginal">查看原视频</text><k-icon name="chevron-right" :size="12" color="muted" /></view><view class="review-video"><image :src="cur.cover ? absUrl(cur.cover) : '/static/media/cover-empty.png'" mode="aspectFill" /></view><text class="review-title">{{ cur.title }}</text><view class="review-info"><text>发布时间</text><text>{{ fmt(cur.publishedTime || cur.createTime) }}</text><text>房源</text><text>{{ cur.stayName }}（房源ID：{{ cur.stayId }}）</text></view></view>
      <view class="detail-card auth-card"><text class="detail-title">授权声明</text><text class="detail-copy">我已获得视频中出镜住客的授权，同意将该视频用于袋鼠全球青年官方推广（包含但不限于抖音、小红书、视频号等平台）。</text><text class="detail-copy">授权人：{{ cur.authorizer || '未填写' }}</text><text class="detail-copy">授权时间：{{ cur.authorizedDate || '—' }}</text><view v-if="cur.authorized" class="auth-stamp"><k-icon name="badge-check" :size="32" color="green" /><text>已授权</text></view></view>
      <view class="detail-card"><text class="detail-title">内容预览 <text class="muted-small">{{ aiNote }}</text></text><view class="ai-row"><text>场景</text><text>{{ cur.scenes || '—' }}</text></view><view class="ai-row"><text>亮点</text><text>{{ cur.highlights || '—' }}</text></view><view class="ai-row"><text>时长</text><text>{{ cur.duration || '—' }}</text><text>画质</text><text>{{ cur.quality || '—' }}</text><text>{{ cur.orientation || '—' }}</text></view></view>
      <view class="detail-card order-card"><text class="detail-title">关联订单 <text class="muted-small">（住客投稿必填）</text></text><text class="detail-copy">{{ orderText }}</text></view>
      <k-bottom><view class="review-actions"><k-button type="outline" size="md" :disabled="!reviewed && !canAudit" @click="btnLeft" :label="reviewed ? '查看原视频' : '驳回'" /><k-button type="outline" size="md" :disabled="!canAudit && !closed" @click="btnMid" :label="midLabel" /><k-button size="md" :disabled="!reviewed && !canAudit" @click="btnRight" :label="reviewed ? '返回列表' : '通过'" /></view></k-bottom>
    </view>
    <view v-else-if="s === 3" class="k-body k-pad-vlog data-page">
      <view class="period-row"><view class="period active" :style="days === 30 ? offStyle : ''" @click="setDays(7)"><k-icon name="calendar-days" :size="17" color="ink" /><text>近7天</text></view><view class="period" :class="{ active: days === 30 }" @click="setDays(30)"><text>近30天</text></view><view class="compare" @click="pickCompare"><text>对比　前{{ days }}天</text><k-icon name="chevron-down" :size="12" color="muted" /></view></view>
      <view class="metrics-card"><text class="block-title">核心数据 <text class="muted-small">（{{ stats.range }}）</text></text><view class="metrics-grid"><view v-for="item in metrics" :key="item.label" class="metric"><view class="metric-label"><k-icon :name="item.icon" :size="16" color="muted" /><text>{{ item.label }}</text></view><text class="metric-value">{{ item.value }}</text><text class="metric-rise" :style="riseStyle(item.rise)">{{ item.rise }}</text></view></view></view>
      <view class="chart-card"><view class="chart-head"><text class="block-title">趋势分析</text><view class="legend blue"><view /><text>站内打开</text></view><view class="legend green"><view /><text>预订转化</text></view></view><view class="chart"><view v-for="y in CHART_GRID" :key="y" class="grid-line" :style="{top:y+'px'}" /><text class="axis axis-top">{{ axisTop }}</text><text class="axis axis-mid">{{ axisMid }}</text><text class="axis axis-bottom">0</text><view v-for="(point,index) in bluePoints" :key="'b'+index" class="point blue-point" :style="{left:point[0]+'px',top:point[1]+'px'}" /><view v-for="(line,index) in blueLines" :key="'bl'+index" class="chart-line blue-line" :style="line" /><view v-for="(point,index) in greenPoints" :key="'g'+index" class="point green-point" :style="{left:point[0]+'px',top:point[1]+'px'}" /><view v-for="(line,index) in greenLines" :key="'gl'+index" class="chart-line green-line" :style="line" /><view class="dates"><text v-for="(d, di) in dates" :key="di">{{ d }}</text></view></view></view>
      <view class="source-card"><text class="block-title">来源对比 <text class="muted-small">（站内打开）</text></text><view class="source-content"><view class="donut" :style="{ background: donutBg }"><view><text>{{ fmtNum(stats.totalOpens) }}</text><text>站内打开</text></view></view><view class="sources"><view v-for="source in sources" :key="source.label"><view :style="{background:source.color}" /><text>{{ source.label }}</text><text>{{ source.value }}</text></view></view></view></view>
    </view>
    <view v-else class="k-body k-pad-vlog comments-page">
      <view class="comment-tabs"><view :class="{ active: cTab === 'all' }" @click="setCTab('all')"><text>全部</text></view><view class="active" :style="cTab === 'pending' ? '' : offStyle" @click="setCTab('pending')"><text>待回复</text><text v-if="counts.pending" class="tab-badge">{{ counts.pending }}</text></view><view :class="{ active: cTab === 'reported' }" @click="setCTab('reported')"><text>举报</text><text v-if="counts.reported" class="tab-badge">{{ counts.reported }}</text></view><view :class="{ active: cTab === 'hidden' }" @click="setCTab('hidden')"><text>已隐藏</text></view></view>
      <view class="k-between comment-summary"><text>{{ commentSummary }}</text><view class="k-row k-gap4" @click="toggleCSort"><text>{{ cSortLabel }}</text><k-icon name="chevron-down" :size="12" color="muted" /></view><view class="k-row k-gap4" @click="pickCVideo"><text>{{ cVideo ? '已筛选' : '筛选' }}</text><k-icon name="chevron-down" :size="12" color="muted" /></view></view>
      <view class="comment-list"><view v-for="(item,index) in comments" :key="item.commentId" class="comment-card"><view class="comment-person"><image :src="avatar(item, index)" mode="aspectFill" /><text class="comment-name">{{ item.name }}</text><k-chip :tone="item.tone"><text>{{ item.status }}</text></k-chip><view class="k-flex1" /><text class="comment-time">{{ item.time }}</text></view><text class="comment-copy">{{ item.copy }}</text><text class="comment-video">视频：{{ item.video }}{{ item.reply ? '　已回复：' + item.reply : '' }}</text><view v-if="item.rawStatus !== 'hidden'" class="comment-actions"><k-button type="outline" size="sm" :label="item.reportedFlag ? '查看举报' : (item.reply ? '改回复' : '回复')" @click="btnA(item)" /><view class="k-flex1" /><k-button type="outline" size="sm" :disabled="item.reportedFlag && !canAudit" :label="item.reportedFlag ? '处理' : '回复草稿'" @click="btnB(item)" /><view class="comment-more" @click="moreC(item)"><k-icon name="ellipsis" :size="20" color="ink" /></view></view><view v-else class="handle-record" @click="moreC(item)"><text>处理记录：{{ fmt(item.handledTime) }}　{{ item.handleNote || '—' }}　隐藏</text><text>处理人：{{ item.handledBy || '—' }}</text></view></view></view>
      <view class="log-row" @click="showLogs"><k-icon name="shield-check" :size="18" color="ink2" /><text>违规处理日志</text><k-icon name="chevron-right" :size="12" color="muted" /></view>
    </view>
    <view v-if="s !== 2" class="vlog-tabs"><view v-for="item in navItems" :key="item.state" :class="{active:s===item.state}" @click="s=item.state"><k-icon :name="item.icon" :size="23" :color="s===item.state?'red':'ink'" /><text>{{ item.label }}</text></view><view class="k-home-indicator" /></view>
  </view>
</template>

<script setup>
// ---------------------------------------------------------------------------
// 房源 Vlog（员工端）接入情况：
//   s=1 内容库：apiStaffVlogs（房源 / 来源 / 状态筛选、排序、本周不足 2 条的房源提醒）
//   s=2 审核详情：通过 / 驳回（预设原因或自填）/ 上线中的可下架；住客投稿须有授权和关联订单（后端校验）
//   s=3 数据：只统计小程序内的打开、点赞、评论、进房源详情、下单（kg_stay_vlog_event）；
//       完播率、平均时长属于抖音 / 小红书 / 视频号平台数据，未接平台开放接口前显示"—"
//   s=4 评论：回复、回复草稿（按模板生成，不是 AI）、隐藏 / 取消隐藏、驳回举报、违规处理日志
// ---------------------------------------------------------------------------
import { ref, computed, watch, nextTick, getCurrentInstance } from 'vue'
import { useScreen, back, toast } from '@/common/screen.js'
import {
  apiStaffVlogs, apiStaffVlog, apiStaffVlogApprove, apiStaffVlogReject, apiStaffVlogOffline, apiStaffVlogData,
  apiStaffVlogComments, apiStaffVlogHandleLogs, apiStaffVlogReply, apiStaffVlogDraft, apiStaffVlogHide, apiStaffVlogDismiss
} from '@/common/api.js'
import { ensureSession, hasStaffAccess, currentStaffStoreId } from '@/common/experience.js'
import { errText, confirm, prompt, sheet, pickPaged, copy, alert, fmtNum } from '@/common/ui.js'
import { absUrl } from '@/common/upload.js'
import { staffCan } from '@/common/staff-perms.js'

// 首次进入由 onLoad 统一加载；s 在 onLoad 里被 ?s= 改写时触发的 watch 跳过，避免深链到详情时又被"找第一条待审核"抢走
let booting = true
// 房源管理「下一步」进审核详情（?s=2&vlogId=）、房源卡片「数据」进数据屏（?s=3）：直接打开的那一屏，返回回到房源管理
let landing = 1
const s = useScreen(4, {
  onLoad: async (q) => {
    await ensureSession()
    booting = false
    if (!hasStaffAccess.value) return
    const id = Number(q?.vlogId) || 0
    if (id) {
      await openDetail({ vlogId: id })
      if (cur.value.vlogId) { landing = 2; return }
      // 之前视频打不开时停在一张空白审核详情上；现在回到内容库
      if (s.value === 2) { s.value = 1; return }
    }
    landing = s.value
    loadFor(s.value)
  }
})
watch(s, (v) => { if (v === 1) landing = 1; if (!booting) loadFor(v) })
function loadFor(v) {
  if (v === 1) loadLibrary()
  if (v === 2 && !cur.value.vlogId) openFirstPending()
  if (v === 3) loadData()
  if (v === 4) loadComments()
}
const titles = ['房源Vlog内容库', '同步与审核详情', '播放数据', '评论管理']
const navItems = [{ state: 1, label: '内容库', icon: 'notebook' }, { state: 3, label: '数据', icon: 'chart-no-axes-column-increasing' }, { state: 4, label: '评论', icon: 'message-circle' }, { state: 2, label: '我的', icon: 'user-round' }]
const storeId = () => currentStaffStoreId()
// 视频通过 / 驳回 / 下架、评论隐藏 / 取消隐藏 / 驳回举报，服务端都要「房源管理·审核」权限（主理人、管家）；
// 普通员工只能回复评论。没权限的按钮置灰，不再点了才被拒
const canAudit = computed(() => staffCan('rooms', 'audit'))
const NO_AUDIT = '审核、下架和隐藏评论需要小院主理人操作'

// ---------------- s=1 内容库 ----------------
const lib = ref({ rows: [], total: 0, lagging: [], stays: [] })
const PLATFORMS = [['', '全部来源'], ['douyin', '抖音'], ['xhs', '小红书'], ['channels', '视频号'], ['guest', '住客投稿']]
const STATUSES = [['', '全部状态'], ['pending', '待审核'], ['online', '已通过'], ['rejected', '已驳回'], ['offline', '已下架']]
const SORTS = [['new', '按发布时间 · 新到旧'], ['old', '按发布时间 · 旧到新'], ['likes', '按点赞 · 多到少']]
const filter = ref({ stayId: null, stayName: '全部房源', platform: 0, status: 0, sort: 0 })
const filterLabels = computed(() => [filter.value.stayName, PLATFORMS[filter.value.platform][1], STATUSES[filter.value.status][1]])
const sortLabel = computed(() => SORTS[filter.value.sort][1])
async function loadLibrary() {
  try {
    lib.value = (await apiStaffVlogs({
      storeId: storeId(), stayId: filter.value.stayId || undefined, platform: PLATFORMS[filter.value.platform][0] || undefined,
      status: STATUSES[filter.value.status][0] || undefined, sort: SORTS[filter.value.sort][0]
    })).data || lib.value
  } catch (e) {
    toast(errText(e, '内容库加载失败'))
  }
}
async function pickFilter(fi) {
  if (fi === 0) {
    const stays = lib.value.stays || []
    const i = await pickPaged(['全部房源', ...stays.map(x => x.stayName)], '选择房源')
    if (i < 0) return
    filter.value.stayId = i === 0 ? null : stays[i - 1].stayId
    filter.value.stayName = i === 0 ? '全部房源' : stays[i - 1].stayName
  } else {
    const list = fi === 1 ? PLATFORMS : STATUSES
    const i = await pickPaged(list.map(x => x[1]), '筛选')
    if (i < 0) return
    filter.value[fi === 1 ? 'platform' : 'status'] = i
  }
  loadLibrary()
}
async function pickSort() {
  const i = await sheet(SORTS.map(x => x[1]))
  if (i < 0) return
  filter.value.sort = i
  loadLibrary()
}
const lagText = computed(() => {
  const n = (lib.value.lagging || []).length
  return n ? `本周还有 ${n} 家房源不足 2 条，建议尽快补充` : '建议保持稳定更新，提升曝光与转化'
})
function showAdvice() {
  const lag = lib.value.lagging || []
  alert('周更建议', lag.length
    ? lag.map(x => `${x.stayName}：本周 ${x.cnt} 条`).join('\n') + '\n\n在「房源管理 → 更多 → 上传 Vlog」提交视频链接。'
    : '本周每家上线房源都已达到 2 条，继续保持。')
}
const videos = computed(() => (lib.value.rows || []).map(v => ({
  vlogId: v.vlogId, title: v.title, source: v.source, time: v.timeText, likes: String(v.likes || 0),
  duration: v.duration || '--:--', status: v.statusLabel, tone: v.tone, cover: v.cover
})))
const thumb = (item, index) => (item.cover ? absUrl(item.cover) : '/static/media/cover-empty.png')

// ---------------- s=2 审核详情 ----------------
const cur = ref({})
async function openDetail(item) {
  try {
    cur.value = (await apiStaffVlog(item.vlogId)).data || {}
    s.value = 2
  } catch (e) {
    toast(errText(e, '视频加载失败'))
  }
}
async function openFirstPending() {
  try {
    const rows = ((await apiStaffVlogs({ storeId: storeId(), status: 'pending' })).data || {}).rows || []
    if (rows.length) return openDetail(rows[0])
    toast('暂无待审核的视频')
  } catch (e) {
    toast(errText(e, '加载失败'))
  }
  s.value = 1
}
const fmt = (v) => (v ? String(v).replace('T', ' ').slice(0, 16) : '—')
const isGuest = computed(() => cur.value.authorRole === 'guest')
const aiNote = computed(() => (cur.value.scenes || cur.value.highlights ? '（提交时填写）' : '（未填写）'))
const orderText = computed(() => (isGuest.value
  ? (cur.value.orderNo ? `关联订单：${cur.value.orderNo}` : '住客投稿未关联订单，不能通过审核')
  : `当前为${cur.value.platformLabel || ''}来源，无需关联订单`))
const online = computed(() => cur.value.status === 'online')
// 已驳回 / 已下架的视频之前仍显示「驳回 / 驳回并说明 / 通过」，点了只换来「只有待审核的视频可以…」，
// 驳回 / 下架原因（auditReason）页面上也看不到。现在这两种状态只能看原视频、看原因、返回列表
const closed = computed(() => cur.value.status === 'rejected' || cur.value.status === 'offline')
const reviewed = computed(() => online.value || closed.value)
const midLabel = computed(() => (closed.value ? (cur.value.status === 'rejected' ? '查看驳回原因' : '查看下架原因')
  : (!canAudit.value ? '无审核权限' : (online.value ? '下架并说明' : '驳回并说明'))))
const showAuditReason = () => alert(cur.value.status === 'rejected' ? '驳回原因' : '下架原因', cur.value.auditReason || '未填写原因')
function openOriginal() {
  const v = cur.value
  // #ifdef MP-WEIXIN
  if (v.platform === 'channels' && v.feedId && v.finderUserName && wx.openChannelsActivity) {
    wx.openChannelsActivity({ finderUserName: v.finderUserName, feedId: v.feedId, fail: () => copy(v.link || v.feedId, '已复制视频号链接') })
    return
  }
  // #endif
  if (!v.link) return toast('这条视频没有外链')
  copy(v.link, `已复制原视频链接，可在${v.platformLabel || '对应平台'}打开`)
}
// 通过 / 驳回 / 下架 / 回复 / 隐藏都是写请求：网络慢时连点会重复提交
let busy = false
const once = async (fn) => {
  if (busy) return
  busy = true
  try { return await fn() } finally { busy = false }
}
const REASONS = ['画面与房源实际不符', '含联系方式、二维码或站外引流', '画质过低或内容不完整', '未获得出镜住客授权', '住客投稿未关联真实订单']
async function doReject(custom) {
  let reason = ''
  if (custom) {
    reason = await prompt('驳回说明', { placeholder: '写清楚需要怎么改，提交人会收到消息' })
    if (!reason) return
  } else {
    const i = await sheet(REASONS)
    if (i < 0) return
    reason = REASONS[i]
  }
  await once(async () => {
    try {
      const res = await apiStaffVlogReject(cur.value.vlogId, reason)
      toast(res.msg || '已驳回')
      s.value = 1
    } catch (e) {
      toast(errText(e, '驳回失败'))
    }
  })
}
async function btnLeft() {
  if (reviewed.value) return openOriginal()
  if (!canAudit.value) return toast(NO_AUDIT)
  doReject(false)
}
async function btnMid() {
  if (closed.value) return showAuditReason()
  if (!canAudit.value) return toast(NO_AUDIT)
  if (!online.value) return doReject(true)
  const reason = await prompt('下架说明', { placeholder: '例如：房源已停业 / 内容过时' })
  if (!reason) return
  await once(async () => {
    try {
      const res = await apiStaffVlogOffline(cur.value.vlogId, reason)
      toast(res.msg || '已下架')
      s.value = 1
    } catch (e) {
      toast(errText(e, '下架失败'))
    }
  })
}
async function btnRight() {
  if (reviewed.value) { s.value = 1; return }
  if (!canAudit.value) return toast(NO_AUDIT)
  if (!(await confirm('通过审核', '通过后这条视频会展示在房源详情页，确认？'))) return
  await once(async () => {
    try {
      const res = await apiStaffVlogApprove(cur.value.vlogId)
      toast(res.msg || '已通过')
      s.value = 1
    } catch (e) {
      toast(errText(e, '操作失败'))
    }
  })
}

// ---------------- s=3 数据 ----------------
const days = ref(7)
const stats = ref({ metrics: [], dates: [], opens: [], orders: [], sources: [], totalOpens: 0, range: '' })
async function loadData() {
  try {
    stats.value = (await apiStaffVlogData(storeId(), days.value)).data || stats.value
  } catch (e) {
    toast(errText(e, '数据加载失败'))
  }
  measureChart()
}
const setDays = (d) => { days.value = d; loadData() }
async function pickCompare() {
  const i = await sheet(['近7天（对比前7天）', '近30天（对比前30天）'])
  if (i >= 0) setDays(i === 0 ? 7 : 30)
}
const offStyle = { color: 'var(--k-ink)', fontWeight: 400 }
const metrics = computed(() => stats.value.metrics || [])
const riseStyle = (r) => (String(r).startsWith('↓') ? { color: 'var(--k-alert)' } : (String(r).startsWith('↑') ? '' : { color: 'var(--k-muted)' }))
const niceMax = (arr) => {
  const m = Math.max(0, ...arr.map(Number))
  if (m <= 4) return 4
  const p = Math.pow(10, Math.floor(Math.log10(m)))
  return Math.ceil(m / p) * p
}
// 趋势图（11-18 第三轮修真毛病）：原来点的横坐标按写死的 328px 宽排，和下面按实际宽度均分的日期对不上，最后一个点还冲出图表被裁掉；
// 第 4 条网格线又正好从日期字中间穿过。现在：左边 30 放刻度数字、右边留 6，每天占一格、点画在格子正中（和下面的日期一一对齐）；
// 横向只画 3 条线（最大值 / 一半 / 0），日期放在 0 线下面。宽度按量出来的图表宽度算，量到之前按 375 宽手机估。
const CHART_AXIS = 30, CHART_RIGHT = 6, CHART_TOP = 14, CHART_ZERO = 126
const CHART_GRID = [CHART_TOP, (CHART_TOP + CHART_ZERO) / 2, CHART_ZERO]
const chartW = ref(0)
const inst = getCurrentInstance()
function measureChart() {
  nextTick(() => {
    try { uni.createSelectorQuery().in(inst && inst.proxy).select('.data-page .chart').boundingClientRect(r => { if (r && r.width) chartW.value = r.width }).exec() } catch (e) {}
  })
}
const series = (arr, max) => {
  const n = arr.length
  const w = Math.max(0, (chartW.value || 327) - CHART_AXIS - CHART_RIGHT)
  return arr.map((v, i) => [CHART_AXIS + (i + 0.5) * w / Math.max(n, 1), CHART_ZERO - (Number(v) / max) * (CHART_ZERO - CHART_TOP)])
}
// 圆点是 7×7 的小圈：样式里的 left / top 是左上角，所以从中心往回退 3.5
const dot = (centers) => centers.map(([x, y]) => [Math.round((x - 3.5) * 10) / 10, Math.round((y - 3.5) * 10) / 10])
const blueMax = computed(() => niceMax(stats.value.opens || []))
const blueCenters = computed(() => series(stats.value.opens || [], blueMax.value))
const greenCenters = computed(() => series(stats.value.orders || [], niceMax(stats.value.orders || [])))
const bluePoints = computed(() => dot(blueCenters.value))
const greenPoints = computed(() => dot(greenCenters.value))
// 线段从一个点的中心连到下一个点的中心（线高 2，所以往上退 1，绕左端中点旋转）
const makeLines = (points) => points.slice(0, -1).map((p, i) => { const n = points[i + 1], dx = n[0] - p[0], dy = n[1] - p[1]; return { left: `${p[0]}px`, top: `${p[1] - 1}px`, width: `${Math.sqrt(dx * dx + dy * dy)}px`, transform: `rotate(${Math.atan2(dy, dx) * 180 / Math.PI}deg)` } })
const blueLines = computed(() => makeLines(blueCenters.value))
const greenLines = computed(() => makeLines(greenCenters.value))
// 不用 toLocaleString：安卓微信的 JS 引擎可能没带完整 ICU，千分位会丢（见 common/ui.js fmtNum）
const axisTop = computed(() => fmtNum(blueMax.value))
const axisMid = computed(() => { const v = blueMax.value / 2; return fmtNum(v, v % 1 ? 1 : 0) })
const dates = computed(() => {
  const d = stats.value.dates || []
  return d.length > 8 ? d.map((x, i) => (i % 5 === 0 || i === d.length - 1 ? x : '')) : d
})
const sources = computed(() => stats.value.sources || [])
const donutBg = computed(() => {
  const total = sources.value.reduce((a, x) => a + Number(x.opens || 0), 0)
  if (!total) return 'var(--k-paper2)'
  let acc = 0
  const segs = sources.value.map(x => {
    const a = acc
    acc += Number(x.opens || 0) * 100 / total
    return `${x.color} ${a.toFixed(1)}% ${acc.toFixed(1)}%`
  })
  return `conic-gradient(${segs.join(',')})`
})

// ---------------- s=4 评论 ----------------
const cm = ref({ rows: [], counts: {} })
const cLoaded = ref(false)
const cTab = ref('pending')
const cSortOld = ref(false)
const cVideo = ref('')
async function loadComments() {
  try {
    cm.value = (await apiStaffVlogComments(storeId(), cTab.value === 'all' ? undefined : cTab.value)).data || cm.value
    cLoaded.value = true
  } catch (e) {
    toast(errText(e, '评论加载失败'))
  }
}
const setCTab = (t) => { cTab.value = t; loadComments() }
const counts = computed(() => cm.value.counts || {})
const comments = computed(() => {
  let rows = (cm.value.rows || []).filter(r => !cVideo.value || r.video === cVideo.value)
  if (cSortOld.value) rows = [...rows].reverse()
  return rows.map(r => ({ ...r, status: r.statusLabel, rawStatus: r.status, video: r.video || '已删除的视频' }))
})
// 当前页签 / 视频筛选下没有评论时，在「共 N 条评论」后面说明，而不是留一块空白
const C_TAB_NAME = { all: '', pending: '待回复的', reported: '被举报的', hidden: '已隐藏的' }
const commentSummary = computed(() => {
  const total = `共 ${counts.value.all || 0} 条评论`
  if (!cLoaded.value || comments.value.length) return total
  return `${total} · ${cVideo.value ? '该视频' : ''}暂无${C_TAB_NAME[cTab.value] || ''}评论`
})
const cSortLabel = computed(() => (cSortOld.value ? '按最新 · 旧到新' : '按最新 · 新到旧'))
const toggleCSort = () => { cSortOld.value = !cSortOld.value }
async function pickCVideo() {
  const vids = [...new Set((cm.value.rows || []).map(r => r.video).filter(Boolean))]
  const i = await pickPaged(['全部视频', ...vids], '选择视频')
  if (i >= 0) cVideo.value = i === 0 ? '' : vids[i - 1]
}
// 没有头像的评论人之前轮流显示设计稿里的几张真人照片（vlog-avatar-N），等于给真实用户安了别人的脸；改用品牌默认头像
const avatar = (item) => (item.avatar ? absUrl(item.avatar) : '/static/media/profile-avatar.jpg')
async function sendReply(item, preset = '') {
  const v = await prompt(item.reply ? '修改回复' : '回复 ' + item.name, { value: preset || item.reply || '', placeholder: '回复会公开展示在评论下' })
  if (!v) return
  await once(async () => {
    try {
      const res = await apiStaffVlogReply(item.commentId, v)
      toast(res.msg || '已回复')
      loadComments()
    } catch (e) {
      toast(errText(e, '回复失败'))
    }
  })
}
async function btnA(item) {
  if (!item.reportedFlag) return sendReply(item)
  await alert('举报详情', `被举报 ${item.reported} 次\n评论内容：${item.copy}\n\n` + (canAudit.value
    ? '判定违规请「处理 → 隐藏评论」；不违规可驳回举报。' : '处理举报（隐藏评论 / 驳回举报）需要小院主理人操作。'))
}
async function btnB(item) {
  if (item.reportedFlag) {
    if (!canAudit.value) return toast(NO_AUDIT)
    const i = await sheet(['隐藏评论（违规）', '驳回举报（不违规）'])
    if (i === 0) return hide(item, true)
    if (i === 1) {
      await once(async () => {
        try {
          const res = await apiStaffVlogDismiss(item.commentId)
          toast(res.msg || '已驳回举报')
          loadComments()
        } catch (e) {
          toast(errText(e, '操作失败'))
        }
      })
    }
    return
  }
  try {
    const d = (await apiStaffVlogDraft(item.commentId)).data || ''
    sendReply(item, d)
  } catch (e) {
    toast(errText(e, '草稿生成失败'))
  }
}
async function hide(item, hidden) {
  if (!canAudit.value) return toast(NO_AUDIT)
  let note = ''
  if (hidden) {
    const kinds = ['违规信息（联系方式 / 引流）', '辱骂或人身攻击', '广告', '其他']
    const i = await sheet(kinds)
    if (i < 0) return
    note = kinds[i]
  }
  await once(async () => {
    try {
      const res = await apiStaffVlogHide(item.commentId, hidden, note)
      toast(res.msg || (hidden ? '已隐藏' : '已恢复'))
      loadComments()
    } catch (e) {
      toast(errText(e, '操作失败'))
    }
  })
}
async function moreC(item) {
  // 没有审核权限的角色菜单里只留「复制评论内容」
  const acts = [...(canAudit.value ? [item.rawStatus === 'hidden' ? '取消隐藏' : '隐藏评论'] : []), '复制评论内容']
  const i = await sheet(acts)
  if (i < 0) return
  if (acts[i] === '复制评论内容') return copy(item.copy || '', '已复制')
  hide(item, item.rawStatus !== 'hidden')
}
async function showLogs() {
  try {
    const rows = (await apiStaffVlogHandleLogs(storeId())).data || []
    alert('违规处理日志', rows.length
      ? rows.slice(0, 12).map(r => `${fmt(r.handledTime)} ${r.handleNote || ''}（${r.handledBy || '—'}）：${String(r.content || '').slice(0, 20)}`).join('\n')
      : '暂无处理记录')
  } catch (e) {
    toast(errText(e, '日志加载失败'))
  }
}
const onTopBack = () => { if (s.value === 1 || s.value === landing) back(); else s.value = 1 }
</script>

<style scoped lang="scss">
.k-pad-vlog{padding-bottom:92px}.filter-row{display:grid;grid-template-columns:repeat(3,1fr);gap:11px}.filter-row>view{height:38px;border:1px solid var(--k-line);border-radius:9px;background:var(--k-paper);display:flex;align-items:center;justify-content:center;gap:8px;font-family:var(--k-sans);font-size:14px}.count-row{height:48px;font-family:var(--k-sans);font-size:13px}.notice{height:52px;padding:0 12px;border:1px solid var(--k-line);border-radius:9px;background:#FAF4EA;display:flex;align-items:center;gap:10px}.notice-icon{width:30px;height:30px;display:flex;align-items:center;justify-content:center}.notice view>text{display:block}.notice view>text:first-child{font-family:var(--k-serif);font-size:14px;font-weight:700}.notice view>text:last-child{margin-top:5px;color:var(--k-muted);font-size:10px}.notice>text{font-size:12px;font-weight:700}.video-row{height:84px;border-bottom:1px solid var(--k-line);display:flex;align-items:center;gap:11px}.video-cover{position:relative;width:105px;height:67px;flex:0 0 auto;border-radius:7px;overflow:hidden}.video-cover image{width:105px;height:67px}.video-cover text{position:absolute;right:4px;bottom:4px;padding:1px 4px;border-radius:3px;background:rgba(20,16,14,.82);color:white;font-size:10px}.video-main{min-width:0;flex:1}.video-title{min-width:0;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;font-family:var(--k-serif);font-size:14px;font-weight:700}.video-chip{flex-shrink:0;margin-left:8px}.video-source{display:block;margin-top:8px;color:var(--k-muted);font-size:11px}.video-meta{display:flex;align-items:center;gap:4px;margin-top:9px;color:var(--k-muted);font-size:11px}.video-meta>text:nth-of-type(1){margin-right:10px}.no-more{display:block;margin-top:12px;text-align:center;color:var(--k-light);font-size:11px}
.review-page{padding-left:14px;padding-right:14px}.review-card,.detail-card{border:1px solid var(--k-line);border-radius:9px;background:var(--k-paper);padding:11px;margin-bottom:9px}.review-source{height:25px;display:flex;align-items:center;gap:9px;color:var(--k-muted);font-size:11px}.review-source>text:nth-child(2){color:var(--k-ink);font-weight:700}.review-video{height:141px;border-radius:7px;overflow:hidden}.review-video image{width:100%;height:141px}.review-title,.detail-title{display:block;margin-top:10px;font-family:var(--k-serif);font-size:15px;font-weight:700}.review-info{display:grid;grid-template-columns:56px 1fr;gap:9px 8px;margin-top:12px;color:var(--k-muted);font-size:11px}.review-info text:nth-child(even){color:var(--k-ink)}.detail-card{position:relative}.detail-title{margin-top:0}.detail-copy{display:block;margin-top:8px;color:var(--k-muted);font-size:11px;line-height:1.65}.auth-stamp{position:absolute;right:18px;bottom:6px;width:68px;height:55px;border:2px solid rgba(79,122,102,.6);border-radius:50%;transform:rotate(-12deg);display:flex;flex-direction:column;align-items:center;justify-content:center;color:var(--k-green);font-family:var(--k-serif);font-size:12px;font-weight:700}.muted-small{color:var(--k-muted);font-size:11px;font-weight:400}.ai-row{display:flex;align-items:center;gap:10px;margin-top:8px;font-size:11px}.ai-row text:nth-child(odd){padding:3px 6px;border-radius:4px;background:var(--k-paper2);color:var(--k-ink2)}.ai-row text:nth-child(even){font-weight:600}.order-card{margin-bottom:4px}.review-actions{display:grid;grid-template-columns:.9fr 1.15fr 1.05fr;gap:8px;width:100%}
.period-row{display:flex;align-items:center;height:45px}.period{height:32px;min-width:82px;border:1px solid var(--k-line);display:flex;align-items:center;justify-content:center;gap:8px;font-size:12px}.period:first-child{border-radius:8px 0 0 8px}.period:nth-child(2){border-left:0;border-radius:0 8px 8px 0}.period.active{color:var(--k-red-deep);font-weight:700}.compare{height:32px;margin-left:auto;padding:0 10px;border:1px solid var(--k-line);border-radius:8px;display:flex;align-items:center;gap:8px;font-size:11px}.metrics-card,.chart-card,.source-card{border:1px solid var(--k-line);border-radius:9px;background:var(--k-paper);margin-bottom:9px}.block-title{display:block;font-family:var(--k-serif);font-size:14px;font-weight:700}.metrics-card>.block-title{height:36px;padding:10px;border-bottom:1px solid var(--k-line)}.metrics-grid{display:grid;grid-template-columns:repeat(3,1fr)}.metric{height:67px;padding:8px 10px;border-right:1px solid var(--k-line);border-bottom:1px solid var(--k-line)}.metric:nth-child(3n){border-right:0}.metric:nth-last-child(-n+2){border-bottom:0}.metric-label{display:flex;align-items:center;gap:5px;color:var(--k-muted);font-size:10px}.metric-value{display:block;margin-top:5px;font-family:var(--k-sans);font-size:18px}.metric-rise{display:block;color:var(--k-green);font-size:10px;margin-top:3px}.chart-card{padding:10px}.chart-head{display:flex;align-items:center;gap:18px}.chart-head>.block-title{margin-right:auto}.legend{display:flex;align-items:center;gap:4px;color:var(--k-muted);font-size:10px}.legend view{width:16px;height:2px}.legend.blue view{background:#35639A}.legend.green view{background:var(--k-green)}.chart{position:relative;height:147px;margin-top:7px;padding-left:30px;overflow:hidden}.grid-line{position:absolute;left:30px;right:0;height:1px;background:var(--k-line)}.axis{position:absolute;left:0;color:var(--k-light);font-size:9px}.axis-top{top:31px}.axis-mid{top:69px}.axis-bottom{bottom:22px}.point{position:absolute;width:7px;height:7px;border:2px solid;border-radius:50%;z-index:3;background:var(--k-paper)}.blue-point{border-color:#35639A}.green-point{border-color:var(--k-green)}.chart-line{position:absolute;height:2px;transform-origin:left center;z-index:2}.blue-line{background:#35639A}.green-line{background:var(--k-green)}.dates{position:absolute;left:31px;right:0;bottom:0;display:flex;justify-content:space-between;color:var(--k-muted);font-size:8px}.source-card{padding:10px}.source-content{display:flex;align-items:center;margin-top:8px}.donut{width:112px;height:112px;border-radius:50%;background:conic-gradient(#35639A 0 54.3%,#BC4226 54.3% 78.1%,#548267 78.1% 92.7%,#C6963B 92.7%);display:flex;align-items:center;justify-content:center}.donut>view{width:62px;height:62px;border-radius:50%;background:var(--k-paper);display:flex;flex-direction:column;align-items:center;justify-content:center}.donut text{font-size:9px;color:var(--k-muted)}.donut text:first-child{font-family:var(--k-sans);font-size:16px;color:var(--k-ink)}.sources{flex:1;margin-left:18px}.sources>view{height:24px;display:grid;grid-template-columns:9px 52px 1fr;align-items:center;font-size:10px}.sources>view>view{width:8px;height:8px;border-radius:50%}.sources>view text:last-child{color:var(--k-muted)}
.comment-tabs{height:36px;border:1px solid var(--k-line);border-radius:8px;display:grid;grid-template-columns:repeat(4,1fr)}.comment-tabs>view{position:relative;display:flex;align-items:center;justify-content:center;font-family:var(--k-sans);font-size:13px}.comment-tabs>view.active{color:var(--k-red);font-weight:700}.tab-badge{position:absolute;top:-9px;right:11px;width:18px;height:18px;border-radius:50%;background:var(--k-alert);color:white;font-size:9px;line-height:18px;text-align:center}.comment-summary{height:46px;font-size:11px}.comment-summary>text{font-family:var(--k-sans);font-size:13px}.comment-card{padding:8px 9px;border:1px solid var(--k-line);border-radius:9px;background:var(--k-paper);margin-bottom:6px}.comment-person{display:flex;align-items:center;gap:8px}.comment-person image{width:30px;height:30px;border-radius:50%}.comment-person>text{font-family:var(--k-serif);font-size:13px;font-weight:700}.comment-name{min-width:0;overflow:hidden;white-space:nowrap;text-overflow:ellipsis}.comment-time{flex-shrink:0;color:var(--k-muted);font-size:10px!important;font-weight:400!important}.comment-copy,.comment-video{display:block;margin-left:38px;margin-top:3px;font-size:11px}.comment-video{color:var(--k-muted)}.comment-actions{display:flex;align-items:center;gap:9px;margin:5px 0 0 38px}.comment-more{width:32px;height:32px;display:flex;align-items:center;justify-content:center}.handle-record{margin:5px 0 0 38px;padding:6px;border-radius:6px;background:#FAF4EA}.handle-record text{display:block;color:var(--k-muted);font-size:10px;margin-top:2px}.log-row{height:43px;padding:0 12px;border:1px solid var(--k-line);border-radius:9px;display:flex;align-items:center;gap:12px;font-family:var(--k-sans);font-size:14px}.log-row text{flex:1}
.vlog-tabs{position:fixed;left:0;right:0;bottom:0;z-index:50;height:90px;padding:4px 16px 34px;border-top:1px solid var(--k-line);background:var(--k-paper);display:grid;grid-template-columns:repeat(4,1fr)}.vlog-tabs>view:not(.k-home-indicator){display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;font-size:10px}.vlog-tabs>view.active{color:var(--k-red)}.vlog-tabs .k-home-indicator{position:absolute}.k-ochre{color:var(--k-ochre-deep)}.k-indigo{color:var(--k-indigo)}
/* 2026-11-17 改版「小而精」：浅灰底 + 白卡（12 圆角、不描边），标题用系统黑体；筛选收成胶囊，视频列表收进一张白卡，8–9px 的小字提到 10–12px。
   页签的选中态仍只靠字色和粗细表达（脚本里有一格是用内联样式盖出「没选中」的）。按钮、文字一个不少。共用写法在 ./work-lite.scss。 */
@import './work-lite.scss';
.vlog-page{@include lite-page}
.filter-row{gap:8px}.filter-row>view{height:36px;border:0;border-radius:999px;font-size:13px;gap:4px}
.count-row{height:44px;font-size:12px;color:var(--k-ink2)}
.notice{height:auto;min-height:52px;padding:8px 12px;border:0;border-radius:12px;background:var(--k-ochre-soft)}.notice view>text:first-child{font-family:var(--k-sans);font-weight:600}.notice view>text:last-child{margin-top:2px;font-size:11px}.notice>text{font-weight:600}
.video-list{margin-top:8px;padding:0 12px;border-radius:12px;background:var(--k-paper)}.video-row:last-child{border-bottom:0}
.video-cover{border-radius:8px}.video-title{font-family:var(--k-sans);font-weight:600}
/* 窄屏（320 宽）：封面收小一点，标题多露几个字 */
@media (max-width:359px){.video-row{gap:8px}.video-cover,.video-cover image{width:90px;height:58px}}.video-source{margin-top:6px}.video-meta{margin-top:6px}
.review-page{padding-left:12px;padding-right:12px}
.review-card,.detail-card{border:0;border-radius:12px;padding:12px;margin-bottom:8px}.review-source{font-size:12px}.review-source>text:nth-child(2){font-weight:600}.review-video{border-radius:8px}
.review-title,.detail-title{font-family:var(--k-sans)}.review-info{font-size:12px}.detail-copy{font-size:12px}.auth-stamp{font-family:var(--k-sans)}
.ai-row{font-size:12px}.ai-row text:nth-child(odd){background:#F5F1EB}
.period{border:0;background:var(--k-paper)}.period:first-child{border-radius:999px 0 0 999px}.period:nth-child(2){border-left:1px solid var(--k-line);border-radius:0 999px 999px 0}
.compare{border:0;border-radius:999px;background:var(--k-paper);font-size:12px}
.metrics-card,.chart-card,.source-card{border:0;border-radius:12px;margin-bottom:8px}.block-title{font-family:var(--k-sans)}.metrics-card>.block-title{padding:10px 12px}
.metric{height:auto;min-height:67px;padding:8px 12px}.metric-label{font-size:11px}.metric-value{font-weight:700;line-height:1.25}.metric-rise{font-size:11px}
.chart-card,.source-card{padding:12px}.legend{font-size:11px}.axis{font-size:10px}.dates{font-size:9px}
.donut text{font-size:10px}.donut text:first-child{font-weight:700}.sources>view{font-size:11px}
.comment-tabs{border:0;border-radius:12px;background:var(--k-paper)}
.tab-badge{top:-6px;right:8px;width:auto;min-width:16px;height:16px;padding:0 4px;box-sizing:border-box;border-radius:8px;font-size:10px;line-height:16px}
.comment-summary{height:44px;font-size:12px}
.comment-card{padding:10px 12px;border:0;border-radius:12px;margin-bottom:8px}.comment-person>text{font-family:var(--k-sans);font-weight:600}.comment-time{font-size:11px!important}
.comment-copy,.comment-video{font-size:12px}.handle-record{border-radius:8px;background:#F7F5F2}.handle-record text{font-size:11px}
.log-row{height:48px;border:0;border-radius:12px;background:var(--k-paper)}
/* 11-18 精修：筛选胶囊 28 高 / 12 号；这一页的小箭头都是 12 号灰 */
.filter-row>view{height:28px;font-size:12px;color:var(--k-ink2)}
/* 「每周至少 2 条」提示条不再是整条赭黄色块：白卡 + 32 的浅赭黄小方块里一只 18 号铃铛 */
.notice{background:var(--k-paper)}.notice-icon{width:32px;height:32px;border-radius:10px;background:var(--k-ochre-soft);flex-shrink:0}
/* 视频行之间是发丝线 */
.video-row{position:relative;border-bottom:0}.video-row::after{content:'';position:absolute;left:0;right:0;bottom:0;height:1px;background:var(--k-line);transform:scaleY(.5)}.video-row:last-child::after{display:none}
/* 「查看原视频」是灰色文字链，不再是靛蓝 */
.review-source .k-indigo{color:var(--k-muted)}
/* 核心数据：靠留白分开，不再像表格那样每格画框；数字等宽 */
.metrics-card>.block-title{border-bottom:0}.metric{border-right:0;border-bottom:0}.metric-value{font-variant-numeric:tabular-nums}
/* 来源对比图例：标签列能放下「房源详情页」五个字，圆点和字之间留 8，数值右对齐 */
.sources{margin-left:16px;min-width:0}.sources>view{height:28px;grid-template-columns:8px minmax(0,1fr) auto;column-gap:8px}.sources>view text:last-child{text-align:right;font-variant-numeric:tabular-nums}
/* 页签上的数字角标跟在字后面，不再半截伸出白卡 */
.tab-badge{position:static;margin-left:4px}
/* 评论正文比下面的「视频：…」大一档、深一档 */
.comment-copy{font-size:13px;line-height:1.6;color:var(--k-ink)}
.comment-actions :deep(.k-button.is-sm){height:28px;padding:0 12px;font-size:12px}
/* 2026-11-18 第三轮修真毛病 —— 趋势图（坐标和脚本里的 CHART_* 对应）：3 条横线在 14 / 70 / 126，刻度数字右对齐、竖直居中压在线上；
   日期放在 0 线下面（134 起），左右边界和点一样（左 30、右 6），每天一格居中，和点一一对齐，不再被网格线穿过 */
.chart{height:152px}.grid-line{left:30px;right:6px}
.axis{width:24px;text-align:right;line-height:14px}.axis-top{top:7px}.axis-mid{top:63px}.axis-bottom{top:119px;bottom:auto}
.dates{left:30px;right:6px;top:134px;bottom:auto;height:14px;justify-content:flex-start;font-size:10px}.dates>text{flex:1;min-width:0;text-align:center;line-height:14px;white-space:nowrap}
/* 核心数据：一行两项（真数据是 8 项，正好 4 行；原来一行三项，最后一行总空着格子） */
.metrics-grid{grid-template-columns:repeat(2,1fr)}
</style>
