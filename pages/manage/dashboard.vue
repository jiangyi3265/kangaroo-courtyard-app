<template>
  <view class="k-page dash">
    <k-topbar :title="titles[s - 1]" back custom-back @back="onBack">
      <view v-if="s === 1" class="ptabs">
        <view v-for="t in periods" :key="t" class="ptabs__item" :class="{ active: period === t }" @click="period = t"><text>{{ t }}</text></view>
      </view>
    </k-topbar>

    <!-- 1 核心指标 -->
    <view v-if="s === 1" class="k-body k-pad-tab">
      <view class="k-between">
        <view class="k-row k-gap6" @click="explainMetrics"><text class="k-title">核心指标</text><k-icon name="info" :size="14" color="muted" :stroke="1.5" /></view>
        <text class="k-meta">与上周期对比</text>
      </view>
      <view class="k-between k-mt4">
        <text class="k-meta">{{ ov.range }}</text>
        <text class="k-tiny">{{ ov.compare }}</text>
      </view>
      <view class="k-grid-2 k-mt14">
        <view v-for="m in metrics" :key="m.label" class="metric">
          <text class="k-small k-muted">{{ m.label }}</text>
          <text class="metric__value num" :style="{ color: m.color }">{{ m.value }}</text>
          <view class="k-row k-gap2 metric__delta"><k-icon v-if="m.dir" :name="m.dir > 0 ? 'arrow-up' : 'arrow-down'" :color="m.dir > 0 ? 'green' : 'alert'" :size="15" :stroke="2" /><text :class="{ 'k-alert': m.dir < 0, 'k-muted': !m.dir }">{{ m.delta }}</text></view>
          <view class="spark" :style="{ width: sparkW + 'px', height: '36px' }">
            <view v-for="(p, i) in m.chart.pts" :key="'a' + i" class="spark__area" :style="{ left: p[0] + 'px', top: p[1] + 'px', width: m.chart.step + 'px', height: (36 - p[1]) + 'px', background: m.soft }" />
            <view v-for="(g, i) in m.chart.segs" :key="'s' + i" class="spark__seg" :style="{ left: g.x + 'px', top: g.y + 'px', width: g.len + 'px', transform: 'rotate(' + g.ang + 'deg)', background: m.line }" />
          </view>
        </view>
      </view>
      <view class="metric metric--wide k-mt10">
        <view class="k-col">
          <text class="k-small k-muted">好评率</text>
          <text class="metric__value num">{{ good.value }}</text>
          <view class="k-row k-gap2 metric__delta"><k-icon v-if="good.dir" :name="good.dir > 0 ? 'arrow-up' : 'arrow-down'" :color="good.dir > 0 ? 'green' : 'alert'" :size="15" :stroke="2" /><text :class="{ 'k-alert': good.dir < 0, 'k-muted': !good.dir }">{{ good.delta }}</text></view>
        </view>
        <view class="spark" :style="{ width: '190px', height: '48px' }">
          <view v-for="(p, i) in wide.pts" :key="'a' + i" class="spark__area" :style="{ left: p[0] + 'px', top: p[1] + 'px', width: wide.step + 'px', height: (48 - p[1]) + 'px', background: '#E4EDDA' }" />
          <view v-for="(g, i) in wide.segs" :key="'s' + i" class="spark__seg" :style="{ left: g.x + 'px', top: g.y + 'px', width: g.len + 'px', transform: 'rotate(' + g.ang + 'deg)', background: '#4A6E3A' }" />
        </view>
      </view>
      <!-- 之前第 1 屏没有任何去往业务趋势 / 门店排名 / 评价统计的入口：从业务中心、工作台进来只能看核心指标，门店排名谁都打不开 -->
      <view class="links k-mt10"><view v-for="l in links" :key="l.s" class="links__item" @click="s = l.s"><text>{{ l.label }}</text><k-icon name="chevron-right" :size="12" color="muted" :stroke="1.7" /></view></view>
      <text class="k-tiny k-mt14 note">{{ ov.note || '指标说明：* 以上数据为你有权限的门店汇总' }}</text>
    </view>

    <!-- 2 业务趋势 -->
    <view v-else-if="s === 2" class="k-body k-pad-tab">
      <view class="k-row k-gap10">
        <view class="select k-flex1" @click="pickTrendStore"><text>{{ tr.storeName || '全部门店' }}</text><k-icon name="chevron-down" :size="16" color="ink" :stroke="1.7" /></view>
        <view class="select k-flex1" @click="pickTrendCity"><text>{{ tr.city || '全部城市' }}</text><k-icon name="chevron-down" :size="16" color="ink" :stroke="1.7" /></view>
        <view class="select select--icon" @click="pickTrendEnd"><k-icon name="calendar" :size="20" color="ink" :stroke="1.6" /></view>
      </view>
      <view class="k-between k-mt10">
        <text class="k-small k-muted">{{ tr.compare }}</text>
        <view class="select select--sm" @click="pickTrendPeriod"><text>{{ tr.periodText || '近30天' }}</text><k-icon name="chevron-down" :size="14" color="ink" :stroke="1.7" /></view>
      </view>
      <k-card class="k-mt10" :pad="14">
        <view class="k-row k-gap4"><text class="k-subtitle">业务趋势</text><text class="k-meta">（{{ tr.periodText || '近30天' }}）</text></view>
        <view class="legend k-mt8">
          <view class="legend__item"><view class="legend__bar" /><text>订单数（单）</text></view>
          <view class="legend__item"><view class="legend__line" style="background:#D9902E" /><text>入住数（间夜）</text></view>
        </view>
        <view class="legend k-mt6">
          <view class="legend__item"><view class="legend__line" style="background:var(--k-green)" /><text>报名数（人）</text></view>
          <view class="legend__item"><view class="legend__dash" /><text>活动参与（人次）</text></view>
        </view>
        <view class="chart k-mt12">
          <view class="chart__axis chart__axis--l"><text v-for="v in leftAxis" :key="v">{{ v }}</text></view>
          <view class="chart__plot">
            <view v-for="n in 6" :key="n" class="chart__grid" :style="{ top: ((n - 1) * 30) + 'px' }" />
            <view v-for="(b, i) in bars" :key="'b' + i" class="chart__bar" :style="{ left: (i * barStep + 1) + 'px', height: (b / 1000 * 150) + 'px' }" />
            <view v-for="(g, i) in orangeLine.segs" :key="'o' + i" class="chart__seg" :style="{ left: g.x + 'px', top: g.y + 'px', width: g.len + 'px', transform: 'rotate(' + g.ang + 'deg)', background: '#E39A2E', height: '2.5px' }" />
            <view v-for="(g, i) in greenLine.segs" :key="'g' + i" class="chart__seg" :style="{ left: g.x + 'px', top: g.y + 'px', width: g.len + 'px', transform: 'rotate(' + g.ang + 'deg)', background: '#4A6E3A', height: '2px' }" />
            <view v-for="(g, i) in dashLine.segs" :key="'d' + i" class="chart__dash" :style="{ left: g.x + 'px', top: g.y + 'px', width: g.len + 'px', transform: 'rotate(' + g.ang + 'deg)' }" />
            <view class="chart__flat" />
          </view>
          <view class="chart__axis chart__axis--r"><text v-for="v in rightAxis" :key="v">{{ v }}</text></view>
        </view>
        <view class="chart__x"><text v-for="d in xLabels" :key="d">{{ d }}</text></view>
      </k-card>
      <text class="k-small k-muted k-mt16 block">{{ tr.periodText || '近30天' }}合计</text>
      <view class="totals k-mt8">
        <view v-for="(t, i) in totals" :key="t.label" class="totals__cell" :class="{ line: i < totals.length - 1 }">
          <text class="k-tiny">{{ t.label }}</text>
          <text class="totals__value num">{{ t.value }}</text>
          <view class="k-row k-gap2 totals__delta"><k-icon v-if="t.dir" :name="t.dir > 0 ? 'arrow-up' : 'arrow-down'" :color="t.dir > 0 ? 'green' : 'alert'" :size="13" :stroke="2" /><text :class="{ 'k-alert': t.dir < 0, 'k-muted': !t.dir }">{{ t.delta }}</text></view>
        </view>
      </view>
      <k-card class="k-mt14" :pad="14">
        <text class="k-subtitle">趋势洞察</text>
        <view class="k-col k-gap6 k-mt8">
          <text v-for="t in insights" :key="t" class="k-small bullet">• {{ t }}</text>
        </view>
      </k-card>
    </view>

    <!-- 3 门店排名 -->
    <view v-else-if="s === 3" class="k-body k-pad-tab">
      <view class="rtabs">
        <view v-for="t in rankTabs" :key="t" class="rtabs__item" :class="{ active: rankTab === t }" @click="rankTab = t"><text>{{ t }}</text></view>
      </view>
      <view class="k-between k-mt12">
        <text class="k-small k-muted">{{ rk.range }}</text>
        <view class="k-row k-gap6" @click="pickRankPeriod"><text class="k-small">筛选</text><k-icon name="filter" :size="14" color="muted" :stroke="1.6" /></view>
      </view>
      <k-card class="k-mt10" :pad="0">
        <view v-for="(r, i) in ranks" :key="r.storeId" class="rank" :class="{ line: i < ranks.length - 1 }" @click="openDaily(r)">
          <view class="rank__no">
            <image v-if="i < 3" class="rank__crown" :src="'/static/media/dash-crown-' + (i + 1) + '.jpg'" mode="aspectFit" />
            <text v-else class="rank__num num">{{ i + 1 }}</text>
          </view>
          <image class="rank__thumb" :src="r.thumb" mode="aspectFill" />
          <view class="k-flex1 k-col">
            <text class="k-subtitle">{{ r.name }}</text>
            <text class="k-meta k-mt2">{{ r.area }}</text>
          </view>
          <view class="k-col rank__right">
            <text class="rank__amount">{{ r.display }}</text>
            <view class="k-row k-gap2 k-mt2"><k-icon v-if="r.dir" :name="r.dir < 0 ? 'arrow-down' : 'arrow-up'" :size="13" :color="r.dir < 0 ? 'alert' : 'green'" :stroke="2" /><text class="rank__chg" :class="r.dir < 0 ? 'k-alert' : (r.dir > 0 ? 'k-green' : 'k-muted')">{{ r.changeText }}</text></view>
          </view>
          <k-icon name="chevron-right" :size="16" color="muted" :stroke="1.6" />
        </view>
      </k-card>
      <text class="k-tiny k-mt16 note">{{ rk.note }}</text>
    </view>

    <!-- 4 评价统计 -->
    <view v-else class="k-body k-pad-tab review-body">
      <view class="k-row k-gap10">
        <view class="select k-flex1" @click="pickRvPeriod"><text>{{ rv.range || '近30天' }}</text><k-icon name="chevron-down" :size="16" color="ink" :stroke="1.7" /></view>
        <view class="select k-flex1" @click="pickRvStore"><text>{{ rv.storeName || '全部门店' }}</text><k-icon name="chevron-down" :size="16" color="ink" :stroke="1.7" /></view>
      </view>
      <k-card class="k-mt12" :pad="10">
        <view class="k-row-start k-gap12">
          <view class="score">
            <text class="k-subtitle">评分分布</text>
            <text class="score__big num">{{ rv.avg || '—' }}</text>
            <view class="k-row k-gap2 k-mt2">
              <k-icon v-for="n in fullStars" :key="n" name="star" :size="16" color="#D9A441" :stroke="1" fill />
              <k-icon v-if="halfStar" name="star-half" :size="16" color="#D9A441" :stroke="1" fill />
            </view>
            <text class="k-meta k-mt8">{{ rv.count || '共 0 条评价' }}</text>
          </view>
          <view class="k-flex1 k-col k-gap10 dist">
            <view v-for="d in dist" :key="d.star" class="k-row k-gap8">
              <text class="k-small dist__label">{{ d.star }}星</text>
              <view class="k-bar k-flex1 dist__bar"><view class="k-bar__fill" :style="{ width: d.pct + '%', background: d.color }" /></view>
              <text class="k-meta dist__num">{{ d.num }}</text>
            </view>
          </view>
        </view>
      </k-card>
      <view class="k-grid-2 k-mt10">
        <k-card :pad="10">
          <text class="k-subtitle">得分较高的分项</text>
          <view class="k-col k-gap8 k-mt10 word-list">
            <view v-for="k in goodWords" :key="k[0]" class="k-between"><text class="k-small">{{ k[0] }}</text><text class="k-small">{{ k[1] }}</text></view>
          </view>
        </k-card>
        <k-card :pad="10">
          <text class="k-subtitle">得分偏低的分项</text>
          <view class="k-col k-gap8 k-mt10 word-list">
            <view v-for="k in badWords" :key="k[0]" class="k-between"><text class="k-small">{{ k[0] }}</text><text class="k-small">{{ k[1] }}</text></view>
          </view>
        </k-card>
      </view>
      <view class="k-grid-3 k-mt10">
        <view v-for="t in kpis" :key="t.label" class="kpi">
          <text class="k-small k-muted">{{ t.label }}</text>
          <text class="kpi__value num">{{ t.value }}</text>
          <view class="k-row k-gap2 kpi__delta"><k-icon v-if="t.dir" :name="t.dir > 0 ? 'arrow-up' : 'arrow-down'" :color="t.dir > 0 ? 'green' : 'alert'" :size="13" :stroke="2" /><text :class="{ 'k-alert': t.dir < 0, 'k-muted': !t.dir }">{{ t.delta }}</text></view>
        </view>
      </view>
      <view class="k-grid-2 k-mt10">
        <k-card :pad="10">
          <text class="k-subtitle">评价概况</text>
          <text class="k-meta k-mt6 block">{{ rv.summary || '加载中…' }}</text>
          <view class="obtn k-mt10" @click="openReviews"><text>{{ reviewLinkText }}</text></view>
        </k-card>
        <k-card :pad="10">
          <text class="k-subtitle">改进建议</text>
          <view class="k-col k-gap4 k-mt6">
            <text v-for="t in advice" :key="t" class="k-meta">• {{ t }}</text>
          </view>
          <view class="obtn k-mt10" @click="makePlan"><text>生成改进计划</text></view>
        </k-card>
      </view>
    </view>

    <k-tabbar mode="staff" active="business" />
    <!-- 统计截止日期：之前要手敲 yyyy-MM-dd，改成日历 -->
    <k-date-picker v-if="endCalendar" title="统计截止日期" :value="trEnd || todayCn()" :max-date="todayCn()" @cancel="endCalendar = false" @confirm="confirmTrendEnd" />
  </view>
</template>

<script setup>
import { selectCity } from '@/common/city-picker.js'
// ---------------------------------------------------------------------------
// 数据看板接入情况（主理人 / 管家，只统计本人有授权的门店）：
//   s=1 核心指标：营业额、入住率、报名转化率、二消收入、好评率（与上一等长周期对比），迷你图为按日序列
//   s=2 业务趋势：订单 / 入住间夜 / 报名 / 活动参与按日序列与合计，趋势洞察是规则文案（不是 AI）
//   s=3 门店排名：只在你有权限的门店之间排，名次变化对比上一周期
//   s=4 评价统计：评分分布、按评价分项的得分高低（不做关键词 NLP）、好评率 / 回复率 / 精选数、规则建议 → 一键生成任务草稿
// ---------------------------------------------------------------------------
import { ref, computed, watch } from 'vue'
import { useScreen, go, back, toast } from '@/common/screen.js'
import { apiDashOverview, apiDashTrend, apiDashRank, apiDashReviews, apiDashPlan } from '@/common/api.js'
import { ensureSession, staffStoreUrl } from '@/common/experience.js'
import { sheet, prompt, alert, pickPaged, confirm, todayCn, isYmd, errText, fmtNum } from '@/common/ui.js'
import { absUrl } from '@/common/upload.js'
import R from '@/common/routes.js'

let booting = true
const s = useScreen(4, {
  onLoad: async (q) => {
    if (q?.view === 'trend') s.value = 2
    if (q?.view === 'rank') s.value = 3
    if (q?.view === 'reviews') s.value = 4
    // 从工作台 / 业务中心 / 日报进来会带上当前门店：趋势与评价默认看这家（门店选择框显示店名），
    // 「生成改进计划」也落到这家；核心指标与门店排名本来就是跨门店口径，不受影响。
    if (q?.storeId) { trStore.value = q.storeId; rvStore.value = q.storeId }
    landing = s.value
    await ensureSession()
    loadScreen(s.value)
    booting = false
  }
})
const titles = ['数据看板', '业务趋势', '门店排名', '评价统计']
// 进页时落在哪一屏（日报「异常提示」、荣誉页「查看趋势 / 全部建议」直接打开趋势或评价统计）：
// 之前返回一律先回核心指标，要再按一次才回到来的页面；现在从第 1 屏点进去的屏返回第 1 屏，直接打开的屏返回上一页
let landing = 1
const onBack = () => { if (s.value !== landing) s.value = landing; else back() }
const links = [{ s: 2, label: '业务趋势' }, { s: 3, label: '门店排名' }, { s: 4, label: '评价统计' }]
watch(s, (v) => { if (!booting) loadScreen(v) })
function loadScreen(v) {
  if (v === 1) loadOverview()
  if (v === 2) loadTrend()
  if (v === 3) loadRank()
  if (v === 4) loadReviews()
}

/** 折线：把数值转成可用 view 绘制的线段 */
function line(vals, w, h, min, max, pad = 2) {
  const arr = vals && vals.length > 1 ? vals : [0, 0]
  const lo = min ?? Math.min(...arr), hi = max ?? Math.max(...arr)
  const step = w / (arr.length - 1)
  const pts = arr.map((v, i) => [+(i * step).toFixed(2), +(pad + (h - pad * 2) * (1 - (v - lo) / (hi - lo || 1))).toFixed(2)])
  const segs = []
  for (let i = 0; i < pts.length - 1; i++) {
    const [x1, y1] = pts[i], [x2, y2] = pts[i + 1]
    segs.push({ x: x1, y: y1, len: +(Math.hypot(x2 - x1, y2 - y1) + 1).toFixed(2), ang: +(Math.atan2(y2 - y1, x2 - x1) * 180 / Math.PI).toFixed(2) })
  }
  return { pts, segs, step: +(step + 0.5).toFixed(2) }
}

// ---------------- s=1 ----------------
const periods = ['7天', '30天', '季度']
const period = ref('7天')
watch(period, () => loadOverview())
const ov = ref({ metrics: [], good: { series: [] } })
async function loadOverview() {
  try {
    ov.value = (await apiDashOverview(period.value)).data || ov.value
  } catch (e) {
    toast(errText(e, '看板加载失败'))
  }
}
const STYLE = [
  { color: '#9A6B3F', line: '#9A6B3F', soft: '#F6EDE2' }, // 和 theme.scss 的 --k-red / --k-ink / --k-green 一致
  { color: '#3A322B', line: '#D9A441', soft: '#F4E8D2' },
  { color: '#3A322B', line: '#4A6E3A', soft: '#E4EDDA' },
  { color: '#40576B', line: '#40576B', soft: '#E7EDF1' }
]
// 箭头方向按变化值定：+12.5% → 绿色 ↑，-3% → 提醒红 ↓；「—」（没有对比数据）、「持平」、0 不画箭头、用灰色。
// 服务端在没有对比值或持平时也给 up=true（KgManageService：up = x==null||prev==null||x>=prev），之前「— 」旁边也画绿色 ↑
const trendDir = (v, up) => {
  const t = String(v == null ? '' : v).trim()
  if (!t || t === '—' || t === '持平' || /^[+-]?0+(\.0+)?%?$/.test(t)) return 0
  if (t.startsWith('-')) return -1
  if (t.startsWith('+')) return 1
  return up === false ? -1 : 1
}
const withDir = (x) => ({ ...x, dir: trendDir(x.delta, x.up) })
const metrics = computed(() => (ov.value.metrics || []).map((m, i) => ({ ...withDir(m), ...STYLE[i], chart: line(m.series || [], sparkW, 36) })))
const wide = computed(() => line((ov.value.good || {}).series || [], 190, 48))
const good = computed(() => withDir(ov.value.good || { value: '—', delta: '—', up: true }))
// 「核心指标」旁的 i 图标之前点了没反应；口径与 KgManageService.overview / KgStats 一致
const explainMetrics = () => alert('指标说明', [
  `统计范围：${ov.value.range || '所选周期'}，你有权限的全部门店合计；箭头是与上一等长周期相比。`,
  '营业额：住宿、服务订单与付费活动报名，按支付成功日计入、退款日扣减。',
  '入住率：占用间夜 ÷（上架房型库存 × 天数）；没有上架房型时显示「—」。',
  '报名转化率：报名中已到商家确认录用及之后的占比。',
  '二消收入：服务订单 + 付费活动报名。好评率：4 星及以上评价占比。'
].join('\n'))

// ---------------- s=2 ----------------
const tr = ref({ orders: [], nights: [], apps: [], people: [], totals: [], insights: [], xLabels: [], stores: [], cities: [] })
const trStore = ref(null)
const trCity = ref('')
const trPeriod = ref('30')
const trEnd = ref('')
async function loadTrend() {
  try {
    tr.value = (await apiDashTrend({ storeId: trStore.value || undefined, city: trCity.value || undefined, period: trPeriod.value, end: trEnd.value || undefined })).data || tr.value
  } catch (e) {
    toast(errText(e, '趋势加载失败'))
  }
}
const nice = (m) => {
  if (m <= 0) return 5
  const step = Math.pow(10, Math.floor(Math.log10(m)))
  return Math.ceil(m / step) * step
}
const leftMax = computed(() => nice(Math.max(0, ...(tr.value.orders || []))))
const rightMax = computed(() => nice(Math.max(0, ...(tr.value.nights || []), ...(tr.value.apps || []), ...(tr.value.people || []))))
// 千分位走 fmtNum（见 common/ui.js：安卓微信可能缺 ICU，系统本地化格式会丢逗号）
const axis = (max) => [1, 0.8, 0.6, 0.4, 0.2, 0].map(r => fmtNum(Math.round(max * r)))
const leftAxis = computed(() => axis(leftMax.value))
const rightAxis = computed(() => axis(rightMax.value))
const xLabels = computed(() => tr.value.xLabels || [])
// 图表区宽度按屏宽算（设计稿 390 宽时为 262）：之前写死 262，375 / 360 宽的手机上最右边几根柱子压到右侧刻度上
let winW = 390
try { winW = uni.getSystemInfoSync().windowWidth || 390 } catch (e) { winW = 390 }
const plotW = Math.max(180, Math.min(262, winW - 132))
// 指标小卡里的折线也按屏宽算（设计稿 390 宽时为 144 = 半栏 174 - 卡片内边距和边框 30）：之前写死 144，375 / 320 宽时伸出卡片
const sparkW = Math.max(96, Math.min(144, Math.floor((winW - 42) / 2 - 30)))
const bars = computed(() => (tr.value.orders || []).map(v => (v / leftMax.value) * 1000))
const barStep = computed(() => plotW / Math.max(1, (tr.value.orders || []).length))
const orangeLine = computed(() => line(tr.value.nights || [], plotW - 4, 150, 0, rightMax.value, 1))
const greenLine = computed(() => line(tr.value.apps || [], plotW - 4, 150, 0, rightMax.value, 1))
const dashLine = computed(() => line(tr.value.people || [], plotW - 4, 150, 0, rightMax.value, 1))
const totals = computed(() => (tr.value.totals || []).map(withDir))
const insights = computed(() => tr.value.insights || [])
async function pickTrendStore() {
  const list = tr.value.stores || []
  const i = await pickPaged(['全部门店', ...list.map(x => x.storeName)], '选择门店')
  if (i < 0) return
  trStore.value = i === 0 ? null : list[i - 1].storeId
  loadTrend()
}
async function pickTrendCity() {
  const list = tr.value.cities || []
  const value = await selectCity({ value: trCity.value, items: list, allowAll: true, hint: '选择可查看经营数据的城市' })
  if (value === null) return
  trCity.value = value
  loadTrend()
}
const endCalendar = ref(false)
const pickTrendEnd = () => { endCalendar.value = true }
const confirmTrendEnd = (v) => {
  endCalendar.value = false
  if (!v || v === trEnd.value) return
  trEnd.value = v
  loadTrend()
}
async function pickTrendPeriod() {
  const i = await sheet(['近7天', '近30天', '近90天'])
  if (i < 0) return
  trPeriod.value = ['7', '30', '90'][i]
  loadTrend()
}

// ---------------- s=3 ----------------
const rankTabs = ['营业额榜', '入住率榜', '好评榜', '岗位履约榜']
const METRIC = { 营业额榜: 'revenue', 入住率榜: 'occupancy', 好评榜: 'good', 岗位履约榜: 'fulfill' }
const rankTab = ref('营业额榜')
const rankPeriod = ref('30')
watch(rankTab, () => loadRank())
const rk = ref({ rows: [] })
async function loadRank() {
  try {
    rk.value = (await apiDashRank({ metric: METRIC[rankTab.value], period: rankPeriod.value })).data || rk.value
  } catch (e) {
    toast(errText(e, '排名加载失败'))
  }
}
// 名次变化：change 是名次差的绝对值、down 是名次下降；名次没变（0）写「持平」、灰色不画箭头（之前是绿色「↑ 0」）
const ranks = computed(() => (rk.value.rows || []).map((r, i) => {
  const dir = !r.change || String(r.change) === '0' ? 0 : (r.down ? -1 : 1)
  return { ...r, dir, changeText: dir ? r.change : '持平', thumb: r.cover ? absUrl(r.cover) : '/static/media/cover-empty.png' }
}))
async function pickRankPeriod() {
  const i = await sheet(['近7天', '近30天', '近90天'])
  if (i < 0) return
  rankPeriod.value = ['7', '30', '90'][i]
  loadRank()
}
const openDaily = (r) => go(R.daily + '?storeId=' + r.storeId)

// ---------------- s=4 ----------------
const rv = ref({ dist: [], high: [], low: [], kpis: [], advice: [], stores: [] })
const rvStore = ref(null)
const rvPeriod = ref('30')
async function loadReviews() {
  try {
    rv.value = (await apiDashReviews({ storeId: rvStore.value || undefined, period: rvPeriod.value })).data || rv.value
  } catch (e) {
    toast(errText(e, '评价统计加载失败'))
  }
}
const fullStars = computed(() => Math.floor(Number(rv.value.avgValue || 0)))
const halfStar = computed(() => Number(rv.value.avgValue || 0) - fullStars.value >= 0.5)
const dist = computed(() => rv.value.dist || [])
const goodWords = computed(() => ((rv.value.high || []).length ? rv.value.high : [['暂无分项评分', '—']]))
const badWords = computed(() => ((rv.value.low || []).length ? rv.value.low : [['没有明显偏低的分项', '—']]))
const kpis = computed(() => (rv.value.kpis || []).map(withDir))
const advice = computed(() => rv.value.advice || [])
async function pickRvPeriod() {
  const i = await sheet(['近7天', '近30天', '近90天'])
  if (i < 0) return
  rvPeriod.value = ['7', '30', '90'][i]
  loadReviews()
}
async function pickRvStore() {
  const list = rv.value.stores || []
  const i = await pickPaged(['全部门店', ...list.map(x => x.storeName)], '选择门店')
  if (i < 0) return
  rvStore.value = i === 0 ? null : list[i - 1].storeId
  loadReviews()
}
// 「查看详情」打开员工端评价管理，带上这里选中的门店（staffStoreUrl 加 ?storeId=），不再固定看员工端当前门店。
// 评价管理没有"全部门店"模式：这里选的是全部门店时先让人挑一家（只有一家就直接用），按钮文案也照实写。
const reviewLinkText = computed(() => (rvStore.value || (rv.value.stores || []).length === 1 ? '查看详情' : '选择门店查看详情'))
async function openReviews() {
  const list = rv.value.stores || []
  let storeId = rvStore.value
  if (!storeId) {
    if (!list.length) return toast('没有可查看评价的门店')
    if (list.length === 1) storeId = list[0].storeId
    else {
      const i = await pickPaged(list.map(x => x.storeName), '选择门店')
      if (i < 0) return
      storeId = list[i].storeId
    }
  }
  go(staffStoreUrl(R.staffReviews, storeId))
}
let planning = false
async function makePlan() {
  if (!rv.value.adviceReal) return toast('暂时没有需要改进的分项')
  const list = rv.value.stores || []
  let storeId = rvStore.value
  if (!storeId) {
    if (list.length === 1) storeId = list[0].storeId
    else {
      const i = await pickPaged(list.map(x => x.storeName), '选择门店')
      if (i < 0) return
      storeId = list[i].storeId
    }
  }
  if (!(await confirm('生成改进计划', `把 ${advice.value.length} 条建议生成为下周一的任务草稿？草稿需要补充时间和接单人后再发布。`)) || planning) return
  // 连点会生成两份一样的任务草稿
  planning = true
  try {
    const res = await apiDashPlan({ storeId, advice: advice.value })
    toast((res.data && res.data.message) || '已生成')
    // 任务草稿生成在哪家门店，就打开哪家门店的任务列表
    setTimeout(() => go(staffStoreUrl(R.tasks + '?weekStart=' + ((res.data && res.data.weekStart) || ''), storeId)), 600)
  } catch (e) {
    toast(errText(e, '生成失败'))
  } finally {
    planning = false
  }
}
</script>

<style scoped lang="scss">
.num { font-family: var(--k-sans); font-weight: 700; }
.block { display: block; }
.note { display: block; }
.k-mt2 { margin-top: 2px; }
.k-mt6 { margin-top: 6px; }
.k-mt10 { margin-top: 10px; }
.k-mt14 { margin-top: 14px; }
.k-gap2 { gap: 2px; }

/* 页签 */
.ptabs { display: flex; border-bottom: 1px solid var(--k-line); }
.ptabs__item { flex: 1; text-align: center; padding: 10px 0 12px; font-size: 15px; color: var(--k-ink); position: relative; }
.ptabs__item.active { color: var(--k-red); }
.ptabs__item.active::after { content: ""; position: absolute; left: 0; right: 0; bottom: -1px; height: 2px; background: var(--k-red); }
.rtabs { display: flex; border: 1px solid var(--k-line); border-radius: 8px; background: var(--k-paper); }
.rtabs__item { flex: 1; text-align: center; padding: 11px 0 12px; font-size: 15px; color: var(--k-ink); position: relative; }
.rtabs__item.active { color: var(--k-red); }
.rtabs__item.active::after { content: ""; position: absolute; left: 12px; right: 12px; bottom: 0; height: 2px; background: var(--k-red); }

/* 指标卡 */
.metric { padding: 14px; border: 1px solid var(--k-line); border-radius: 12px; background: var(--k-paper); display: flex; flex-direction: column; }
.metric--wide { flex-direction: row; align-items: flex-end; justify-content: space-between; }
.metric__value { font-size: 28px; line-height: 1.1; margin-top: 6px; color: var(--k-ink); overflow-wrap: anywhere; }
.metric__delta { margin-top: 6px; font-size: 14px; color: var(--k-green); }
.spark { position: relative; overflow: hidden; margin-top: 8px; }
.links { display: flex; gap: 8px; }
.links__item { flex: 1; height: 36px; border: 1px solid var(--k-line); border-radius: 8px; background: var(--k-paper); display: flex; align-items: center; justify-content: center; gap: 2px; font-size: 14px; }
.spark__area { position: absolute; }
.spark__seg { position: absolute; height: 2px; border-radius: 1px; transform-origin: 0 50%; }

/* 下拉 */
.select { height: 40px; padding: 0 12px; border: 1px solid var(--k-line2); border-radius: 8px; background: var(--k-paper); display: flex; align-items: center; justify-content: space-between; font-size: 15px; gap: 6px; }
.select > text { min-width: 0; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
.select--icon { width: 48px; flex: 0 0 auto; justify-content: center; }
.select--sm { height: 32px; font-size: 14px; padding: 0 10px; }

/* 趋势图 */
.legend { display: flex; gap: 16px; font-size: 13px; color: var(--k-ink); }
.legend__item { display: flex; align-items: center; gap: 6px; }
.legend__bar { width: 18px; height: 5px; border-radius: 3px; background: #3E5F86; }
.legend__line { width: 18px; height: 3px; border-radius: 2px; }
.legend__dash { width: 18px; height: 0; border-top: 2px dashed #3E5F86; }
.chart { display: flex; align-items: flex-start; height: 150px; }
.chart__axis { width: 34px; height: 150px; display: flex; flex-direction: column; justify-content: space-between; font-size: 12px; color: var(--k-muted); flex: 0 0 auto; }
.chart__axis--l { align-items: flex-end; padding-right: 6px; }
.chart__axis--l text, .chart__axis--r text { line-height: 1; margin-top: -6px; }
.chart__axis--l text:first-child, .chart__axis--r text:first-child { margin-top: -6px; }
.chart__axis--r { width: 30px; align-items: flex-start; padding-left: 6px; }
.chart__plot { position: relative; flex: 1; min-width: 0; height: 150px; border-left: 1px solid var(--k-line2); border-right: 1px solid var(--k-line2); }
.chart__grid { position: absolute; left: 0; right: 0; height: 1px; background: var(--k-line); }
.chart__bar { position: absolute; bottom: 0; width: 4.5px; background: #3E5F86; border-radius: 2px 2px 0 0; }
.chart__seg { position: absolute; transform-origin: 0 50%; border-radius: 2px; }
.chart__dash { position: absolute; height: 0; border-top: 1.5px dashed #3E5F86; transform-origin: 0 50%; }
.chart__flat { position: absolute; left: 0; right: 0; bottom: 9px; height: 0; border-top: 1.5px dashed #9FBFC2; }
.chart__x { display: flex; justify-content: space-between; padding: 8px 20px 0 34px; font-size: 13px; color: var(--k-muted); }
.totals { display: flex; border: 1px solid var(--k-line); border-radius: 12px; background: var(--k-paper); }
.totals__cell { flex: 1; min-width: 0; padding: 12px 4px; display: flex; flex-direction: column; align-items: center; }
.totals__cell.line { border-right: 1px solid var(--k-line); }
.totals__value { font-size: 22px; line-height: 1.2; margin-top: 6px; }
.totals__delta { margin-top: 6px; font-size: 13px; color: var(--k-green); }
.bullet { display: block; }

/* 排名 */
.rank { display: flex; align-items: center; gap: 10px; padding: 12px 14px 12px 8px; }
.rank.line { border-bottom: 1px solid var(--k-line); }
.rank__no { width: 30px; display: flex; justify-content: center; flex: 0 0 auto; }
.rank__crown { width: 30px; height: 32px; }
.rank__num { font-size: 22px; }
.rank__thumb { width: 38px; height: 38px; border-radius: 6px; flex: 0 0 auto; }
.rank__right { align-items: flex-end; flex: 0 0 auto; }
.rank__amount { font-size: 15px; font-weight: 600; }
.rank__chg { font-size: 14px; }

/* 评价统计 */
.score { width: 98px; display: flex; flex-direction: column; flex: 0 0 auto; }
.score__big { font-size: 44px; line-height: 1; margin-top: 10px; }
.dist { padding-top: 2px; }
.dist__label { width: 24px; flex: 0 0 auto; }
.dist__bar { height: 12px; border-radius: 6px; background: #EFEAE1; }
.dist__bar .k-bar__fill { border-radius: 6px; }
.dist__num { width: 68px; text-align: right; flex: 0 0 auto; }
.kpi { padding: 14px 8px; border: 1px solid var(--k-line); border-radius: 12px; background: var(--k-paper); display: flex; flex-direction: column; align-items: center; }
.kpi__value { font-size: 28px; line-height: 1.2; margin-top: 4px; }
.kpi__delta { margin-top: 4px; font-size: 14px; color: var(--k-green); }
.obtn { height: 36px; border: 1px solid var(--k-red); border-radius: 6px; display: flex; align-items: center; justify-content: center; color: var(--k-red); font-family: var(--k-serif); font-weight: 700; font-size: 15px; }
.review-body .dist { gap: 7px; }
.review-body .word-list { gap: 4px; margin-top: 7px; }
.review-body .kpi { padding-top: 8px; padding-bottom: 8px; }
.review-body .k-grid-2,
.review-body .k-grid-3 { margin-top: 8px; }
.review-body .obtn { height: 31px; margin-top: 6px; }

/* 2026-11-17 改版「小而精」（主人按样张第三版拍板）：浅灰底 + 白卡 12 圆角、不描边不加阴影；大数字 20–22 / 700，标签 11–12 灰字；
   页签、下拉、入口都收小一档。只改样子：四屏的入口、筛选、图表、按钮、文字都在，涨跌箭头和颜色的判断没动。
   下面每条都带 .dash，盖住上面的旧值；图表颜色用 --k-* 语义色。 */
@import './manage-refine.scss';
.dash .k-title { font-family: var(--k-sans); font-size: 16px; font-weight: 700; }
.dash .k-subtitle { font-family: var(--k-sans); font-size: 14px; font-weight: 600; }
.dash .k-mt10 { margin-top: 8px; }
.dash .k-mt14 { margin-top: 10px; }
.dash .k-grid-2, .dash .k-grid-3 { gap: 8px; }
/* 页签：字 14，选中是深棕字 + 一小段圆头下划线 */
.dash .ptabs { border-bottom: 0; }
.dash .ptabs__item { padding: 9px 0 11px; font-size: 14px; color: var(--k-ink2); }
.dash .ptabs__item.active { color: var(--k-red-deep); font-weight: 600; }
.dash .ptabs__item.active::after { left: 50%; right: auto; bottom: 3px; width: 20px; height: 3px; margin-left: -10px; border-radius: 2px; }
.dash .rtabs { padding: 3px; border: 0; border-radius: 12px; }
.dash .rtabs__item { height: 36px; padding: 0; border-radius: 9px; font-size: 13px; line-height: 36px; color: var(--k-ink2); white-space: nowrap; }
.dash .rtabs__item.active { color: var(--k-red-deep); background: var(--k-red-soft); font-weight: 600; }
.dash .rtabs__item.active::after { content: none; }
@media (max-width: 340px) { .dash .rtabs__item { font-size: 12px; } }
/* 指标卡 */
/* 左右留 16：小折线的宽度是脚本按屏宽算的（半栏减 51），这样正好铺到卡片右边 */
.dash .metric { padding: 12px 16px; border: 0; border-radius: 12px; }
.dash .metric .k-small, .dash .kpi .k-small { font-size: 12px; line-height: 18px; }
.dash .metric__value { margin-top: 2px; font-size: 22px; line-height: 28px; }
.dash .metric__delta { margin-top: 0; font-size: 12px; line-height: 18px; }
.dash .metric__delta :deep(.k-icon), .dash .totals__delta :deep(.k-icon), .dash .kpi__delta :deep(.k-icon) { width: 12px !important; height: 12px !important; }
.dash .note { line-height: 16px; }
/* 下拉 */
.dash .select { height: 36px; padding: 0 10px 0 12px; border: 0; border-radius: 10px; font-size: 13px; }
.dash .select :deep(.k-icon) { width: 14px !important; height: 14px !important; }
.dash .select--icon { width: 40px; padding: 0; }
.dash .select--icon :deep(.k-icon) { width: 18px !important; height: 18px !important; }
.dash .select--sm { height: 28px; padding: 0 8px 0 10px; border-radius: 14px; font-size: 12px; }
/* 趋势图 */
.dash .legend { gap: 14px; font-size: 11px; color: var(--k-muted); }
.dash .legend__item { gap: 5px; }
.dash .legend__bar { width: 14px; height: 4px; border-radius: 2px; background: var(--k-indigo); }
.dash .legend__line { width: 14px; }
.dash .legend__dash { width: 14px; border-top-color: var(--k-indigo); }
.dash .chart__axis { font-size: 10px; }
.dash .chart__axis--l text, .dash .chart__axis--r text { margin-top: -5px; }
.dash .chart__plot { border-left-color: var(--k-line); border-right-color: var(--k-line); }
.dash .chart__bar { background: var(--k-indigo); }
.dash .chart__dash { border-top-color: var(--k-indigo); }
.dash .chart__flat { border-top-color: var(--k-line2); }
/* 卡片比原来宽了 8：图两边各让 4，柱子仍然铺到右边刻度前 */
.dash .chart { padding: 0 4px; }
.dash .chart__x { padding-left: 38px; padding-right: 24px; font-size: 11px; }
.dash .totals { border: 0; border-radius: 12px; }
.dash .totals__cell { position: relative; padding: 12px 4px 10px; }
.dash .totals__cell.line { border-right: 0; }
.dash .totals__cell.line::after { content: ""; position: absolute; right: 0; top: 14px; bottom: 14px; width: 1px; background: var(--k-line); }
.dash .totals__value { margin-top: 2px; font-size: 20px; line-height: 26px; }
.dash .totals__delta { margin-top: 0; font-size: 11px; line-height: 16px; }
.dash .bullet { line-height: 20px; color: var(--k-ink2); }
/* 排名 */
.dash .rank { position: relative; padding: 12px 12px 12px 6px; }
.dash .rank.line { border-bottom: 0; }
.dash .rank.line::after { content: ""; position: absolute; left: 46px; right: 0; bottom: 0; height: 1px; background: var(--k-line); transform: scaleY(.5); }
.dash .rank__crown { width: 24px; height: 26px; border-radius: 6px; }
.dash .rank__num { font-size: 15px; color: var(--k-muted); }
.dash .rank__thumb { width: 40px; height: 40px; border-radius: 8px; }
.dash .rank .k-meta { font-size: 11px; }
.dash .rank__amount { font-size: 14px; }
.dash .rank__chg { font-size: 11px; }
.dash .rank :deep(.k-icon) { width: 12px !important; height: 12px !important; }
/* 评价统计 */
.dash .score { width: 92px; }
.dash .score__big { margin-top: 6px; font-size: 32px; line-height: 38px; }
.dash .score :deep(.k-icon) { width: 13px !important; height: 13px !important; }
.dash .score .k-meta { font-size: 11px; }
.dash .dist__label { width: 26px; font-size: 12px; color: var(--k-ink2); }
.dash .dist__bar { height: 6px; border-radius: 3px; background: var(--k-line); }
.dash .dist__bar .k-bar__fill { border-radius: 3px; }
.dash .dist__num { width: 64px; font-size: 11px; }
.dash .word-list .k-small { font-size: 12px; color: var(--k-ink2); }
.dash .kpi { padding: 10px 6px; border: 0; border-radius: 12px; }
.dash .kpi__value { margin-top: 2px; font-size: 20px; line-height: 26px; }
.dash .kpi__delta { margin-top: 0; font-size: 11px; line-height: 16px; }
.dash .review-body .obtn { height: 32px; margin-top: 8px; border-color: var(--k-red-line); border-radius: 16px; background: var(--k-paper); color: var(--k-red-deep); font-family: var(--k-sans); font-size: 13px; font-weight: 500; }
/* 2026-11-18 复查：小下拉、小按钮、「筛选」和标题旁的问号看着小，手指能点的范围不能跟着小——上下各补一截透明的可点区，凑够 36 高（样子不变） */
.dash .select--sm, .dash .review-body .obtn, .dash .k-between > .k-row.k-gap6 { position: relative; }
.dash .select--sm::after { content: ""; position: absolute; left: 0; right: 0; top: -4px; bottom: -4px; }
.dash .review-body .obtn::after { content: ""; position: absolute; left: 0; right: 0; top: -3px; bottom: -3px; }
.dash .k-between > .k-row.k-gap6::after { content: ""; position: absolute; left: -8px; right: -8px; top: -9px; bottom: -8px; }
/* 窄屏（320）营业额上了百万时，大数字从中间断成两行：窄屏收小一号 */
@media (max-width: 340px) { .dash .metric__value { font-size: 20px; line-height: 26px; } }
/* 2026-11-18 第二轮精修（精修词典：同一种东西全站一个样子；只改样子，四屏的入口、筛选、图表、按钮、文字都在，涨跌判断没动） */
/* 1) 区块标题 16 / 700（「核心指标」本来就是，补齐行高和颜色）；「近 30 天合计」夹在两张白卡中间，按区块标题画，不再像一行说明 */
.dash .k-title { line-height: 22px; color: var(--k-ink); }
.dash .k-mt16.block { margin-top: 16px; font-size: 16px; font-weight: 700; line-height: 22px; color: var(--k-ink); }
/* 2) 顶栏下的页签按词典：没选中 400 灰字，选中 600 墨色 + 16×3 的暖棕短条 */
.dash .ptabs__item { color: var(--k-muted); }
.dash .ptabs__item.active { color: var(--k-ink); }
.dash .ptabs__item.active::after { width: 16px; margin-left: -8px; background: var(--k-red); }
/* 3) 门店排名的四个榜单按分段控件：灰米色轨道 32 高、白色选中块、选中字用墨色（和任务页的状态页签一个样子）；
      视觉 28 高，上下各补 4 的透明可点区，点击高度仍有 36（340 以下 12 号字照旧） */
.dash .rtabs { height: 32px; padding: 2px; border-radius: 16px; background: #F0EBE4; }
.dash .rtabs__item { height: 28px; line-height: 28px; border-radius: 14px; }
.dash .rtabs__item.active { color: var(--k-ink); background: var(--k-paper); }
.dash .rtabs__item::after, .dash .rtabs__item.active::after { content: ""; position: absolute; left: 0; right: 0; top: -4px; bottom: -4px; height: auto; background: transparent; }
/* 4) 指标卡数字只留营业额用暖棕，其余统一墨色（小折线的颜色不动，仍能分出是哪一项）；小折线下的面积淡一点，减弱台阶感 */
.dash .k-grid-2 > .metric:not(:first-child) .metric__value { color: var(--k-ink) !important; }
.dash .spark__area { opacity: .6; }
/* 5) 合计卡的竖线改发丝线 */
.dash .totals__cell.line::after { transform: scaleX(.5); }
/* 6) 评分分布：五根条统一成星星的赭黄（颜色是脚本写在行内的，只能用 !important 盖），数字等宽、列宽收窄一点让条子变长
      （服务端给的是「20 (72%)」这种写法，最长「1,234 (62%)」约 60 宽，所以留 56、不折行，多出的几 px 落在卡片内边距里） */
.dash .dist__bar .k-bar__fill { background: var(--k-ochre) !important; }
.dash .dist__num { width: 56px; white-space: nowrap; font-variant-numeric: tabular-nums; }
/* 7) 评价统计的卡片内边距统一 12（模板传的是 10，行内样式只能 !important 盖；业务趋势那屏的图表卡不动，图宽是按卡宽算的） */
.dash .review-body :deep(.k-card) { padding: 12px !important; }
/* 8) 「评价概况」「改进建议」两张卡一样高，按钮却一高一低：卡片改成竖排，按钮贴卡底对齐，上面的文字和按钮之间至少留 8 */
.dash .review-body .k-grid-2 :deep(.k-card) { display: flex; flex-direction: column; }
.dash .review-body .obtn { margin-top: auto; }
.dash .review-body .block, .dash .review-body .k-col.k-gap4 { margin-bottom: 8px; }
/* 9) 好评率 / 回复率 / 差评数三格：和上一屏的合计卡一样，合成一张白卡 + 发丝竖线 */
.dash .review-body .k-grid-3 { gap: 0; border-radius: 12px; background: var(--k-paper); }
.dash .kpi { position: relative; border-radius: 0; background: transparent; }
.dash .kpi + .kpi::before { content: ""; position: absolute; left: 0; top: 12px; bottom: 12px; width: 1px; background: var(--k-line); transform: scaleX(.5); }
</style>
