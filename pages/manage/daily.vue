<template>
  <view class="k-page daily">
    <k-topbar :title="titles[s - 1]" back custom-back @back="onBack" />

    <view v-if="s === 1" class="k-body k-pad-tab day-page">
      <view class="date-line"><view class="date-box" @click="pickDate"><text>{{ d.dateText }}</text><k-icon name="calendar-days" :size="20" color="ink" /></view><view class="synced"><k-icon name="circle-check" :size="16" color="green" /><text>{{ d.synced || '同步中…' }}</text></view></view>
      <view class="section-head"><text>{{ d.sectionTitle || '系统数据（自动同步）' }}</text><k-icon name="circle-help" :size="16" color="muted" @click="explainSystem" /></view>
      <view class="metric-list">
        <view v-for="item in dailyItems" :key="item.name" class="metric" @click="onMetric(item)">
          <view class="metric__icon" :class="'metric__icon--' + item.tone"><k-icon :name="item.icon" :size="18" color="ink2" /></view>
          <view class="metric__main"><view class="metric__name"><text>{{ item.name }}</text><text class="metric__source">（{{ item.source }}）</text></view><text class="metric__detail">{{ item.detail }}</text></view>
          <view class="metric__right"><text class="metric__amount">{{ item.amount }}</text><text class="metric__delta">较昨日 <text :class="item.trend.cls">{{ item.trend.text }}</text></text></view>
        </view>
      </view>
      <view class="profit"><text class="profit__label">今日收支结余</text><view class="k-between"><text class="profit__amount">{{ d.profit }}</text><text class="profit__delta">较昨日 <text :class="profitTrend.cls">{{ profitTrend.text }}</text></text></view></view>
      <view class="data-note"><k-icon name="info" :size="15" color="muted" /><text>{{ d.dataNote || '数据说明：系统数据自动同步，手动数据需人工录入' }}</text></view>
    </view>

    <view v-else-if="s === 2" class="k-body k-pad-tab add-page">
      <view class="type-tabs"><view class="type-tabs__item active" :style="form.direction === 'income' ? '' : neutralTab" @click="setDirection('income')"><text>收入</text></view><view class="type-tabs__item" :class="{ active: form.direction === 'expense' }" @click="setDirection('expense')"><text>支出</text></view></view>
      <view class="field-group"><view class="field-label"><text>分类</text><text class="required">*</text></view><view class="field" @click="pickCategory"><text class="placeholder" :style="form.category ? 'color: var(--k-ink)' : ''">{{ form.category || '请选择分类' }}</text><k-icon name="chevron-right" :size="18" color="ink" /></view></view>
      <view class="field-group"><view class="field-label"><text>金额（元）</text><text class="required">*</text></view><view class="field" @click="inputAmount"><text class="placeholder">{{ form.amountFen ? '点击修改金额' : '请输入金额' }}</text><text class="field__suffix" :style="form.amountFen ? 'color: var(--k-ink)' : ''">{{ amountText }}</text></view></view>
      <view class="field-group"><view class="field-label"><text>支付方式</text><text class="required">*</text></view><view class="pay-types"><view v-for="pay in pays" :key="pay" class="pay" :class="{ active: pay === form.pay }" @click="form.pay = pay"><text>{{ pay }}</text></view></view></view>
      <view class="field-group"><view class="field-label"><text>说明</text></view><view class="field" @click="inputRemark"><text class="placeholder" :style="form.remark ? 'color: var(--k-ink)' : ''">{{ form.remark || '请输入说明（选填）' }}</text><text class="field__counter">{{ form.remark.length }}/120</text></view></view>
      <view class="field-group"><view class="field-label"><text>凭证上传</text><text class="k-meta">（选填）</text></view><view class="upload" @click="addProofs"><k-icon name="plus" :size="28" color="ink" /><text>{{ proofs.length ? '已选 ' + proofs.length + ' 张' : '上传凭证' }}</text><text>最多5张</text></view></view>
      <!-- 明细记到正在查看的那一天：从消息打开昨天的报表再录入，之前页面上看不出会记到昨天 -->
      <text class="add-where">记入：{{ d.storeName || '当前门店' }} · {{ d.dateText }}</text>
      <view class="add-actions"><k-button size="md" class="k-flex1" @click="save(false)" label="保存" /><k-button size="md" type="secondary" class="k-flex1" @click="save(true)" label="保存并继续" /></view>
    </view>

    <view v-else-if="s === 3" class="k-body k-pad-tab summary-page">
      <view class="date-box summary-date" @click="pickDate"><text>{{ d.dateText }}</text><k-icon name="calendar-days" :size="20" color="ink" /></view>
      <view class="source-legend"><text>数据来源：</text><template v-if="!isRecruit"><view class="legend-dot legend-dot--green" /><text>系统自动</text></template><view class="legend-dot legend-dot--ochre" /><text>手动录入</text></view>
      <view class="summary-cards"><view v-for="card in summaries" :key="card.label" class="summary-card"><text>{{ card.label }}</text><text class="summary-card__amount" :class="card.green ? 'k-green' : 'k-red'">{{ card.amount }}</text><text class="summary-card__delta">较昨日 <text :class="card.trend.cls">{{ card.trend.text }}</text></text></view></view>
      <view v-if="d.warning" class="warning" @click="openTrend"><k-icon name="triangle-alert" :size="19" color="ochre" /><text>异常提示：{{ d.warning }}</text><k-icon name="chevron-right" :size="12" color="muted" /></view>
      <text class="table-title">明细列表</text>
      <view class="filter-tabs"><view class="filter-tabs__item active" :style="filter === 'all' ? '' : neutralFilter" @click="filter = 'all'"><text>全部</text></view><view class="filter-tabs__item" :class="{ active: filter === 'income' }" @click="filter = 'income'"><text>收入</text></view><view class="filter-tabs__item" :class="{ active: filter === 'expense' }" @click="filter = 'expense'"><text>支出</text></view></view>
      <view class="details-table"><view class="details-row details-row--head"><text>项目 / 分类</text><text>金额（元）</text><text>来源</text><text>操作</text></view><view v-for="(row, ri) in detailRows" :key="row.name + ri" class="details-row" @click="onRow(row)"><text>{{ row.name }}</text><text>{{ row.amount }}</text><view class="source-cell"><view class="legend-dot" :class="row.system ? 'legend-dot--green' : 'legend-dot--ochre'" /><text>{{ row.system ? '系统' : '手动' }}</text></view><k-icon name="eye" :size="18" color="ink" /></view></view>
      <view class="summary-actions"><k-button size="md" type="secondary" class="k-flex1" icon="plus" @click="addEntry" label="新增明细" /><k-button size="md" class="summary-actions__pdf" icon="file-down" @click="s = 4" label="导出报表" /></view>
    </view>

    <view v-else class="k-body k-pad-tab export-page">
      <view class="paper">
        <view class="paper__brand"><view><text class="paper__title">{{ d.title || '每日经营报表' }}</text><text class="paper__meta">门店名称：{{ d.storeName }}</text><text class="paper__meta">报表日期：{{ d.dateText }}</text><text class="paper__meta">数据来源：{{ d.sourceText || '系统自动 + 手动录入' }}</text></view><view class="paper__logo"><text>袋鼠全球青年</text><text>好工作 · 好生活</text><image src="/static/media/tasks-success-kangaroo.jpg" mode="aspectFit" /></view></view>
        <text class="paper__section">一、收入明细</text><view class="paper-table"><view class="paper-row paper-row--head"><text>项目</text><text>金额（元）</text><text>来源</text><text>备注</text></view><view v-for="(r, ri) in incomeRows" :key="ri" class="paper-row"><text v-for="(c, ci) in r" :key="ci">{{ c }}</text></view></view>
        <text class="paper__section">二、支出明细</text><view class="paper-table"><view class="paper-row paper-row--head"><text>项目</text><text>金额（元）</text><text>来源</text><text>操作</text></view><view v-for="(r, ri) in expenseRows" :key="ri" class="paper-row"><text v-for="(c, ci) in r" :key="ci">{{ c }}</text></view></view>
        <text class="paper__section">{{ isRecruit ? '三、收支汇总' : '三、经营汇总' }}</text><view class="paper-table paper-table--totals"><view class="paper-row paper-row--head"><text>{{ isRecruit ? '总收入' : '总营收' }}</text><text>总支出</text><text>收支结余</text></view><view class="paper-row"><text>{{ totals[0] }}</text><text>{{ totals[1] }}</text><text class="k-green">{{ totals[2] }}</text></view></view>
        <view class="signature"><text>主理人签名：</text><view class="signature__line" /><text>日期：</text><view class="signature__line signature__line--date" /></view><text class="paper__note">备注：本报表由袋鼠全球青年系统生成，仅供内部经营参考。</text>
      </view>
      <text class="recipient-title">{{ d.recipientTitle || '发送给换工主理人' }}</text>
      <view class="recipient"><image :src="managerAvatar" mode="aspectFill" /><view class="k-flex1"><text class="recipient__name">{{ managerName }}</text><text class="recipient__wechat">{{ managerNote }}</text></view><k-button v-if="manager" size="sm" type="green" icon="message-circle" @click="sendReport" label="发送" /></view>
      <k-button block size="md" class="download" @click="download" label="下载 Excel" />
    </view>

    <k-tabbar mode="staff" active="business" />
    <!-- 报表日期：之前是 90 天的分页菜单（每页 5 天），改成日历 -->
    <k-date-picker v-if="calendarOpen" title="报表日期" :value="date || todayCn()" :min-date="shiftDate(todayCn(), -89)" :max-date="todayCn()" @cancel="calendarOpen = false" @confirm="confirmDate" />
  </view>
</template>

<script setup>
// ---------------------------------------------------------------------------
// 每日经营报表接入情况（主理人 / 管家）：
//   s=1 当日数据：订房 / 二消（服务 + 活动）按支付成功日计入、按退款日扣减，系统自动算；其他收入与支出是手工明细
//   s=2 新增明细：分类 / 金额 / 收付方式（只是记账字段，不发生任何支付）/ 说明 / 凭证，带幂等键防重复提交
//   s=3 经营汇总：总营收、总支出、收支结余（不是会计净利润），明细可查看凭证或作废
//   s=4 导出：下载 Excel、站内消息发出去（收件人和文字听服务端：切换前是本店换工主理人，切换后是本城城市负责人）
// 换工主理人（当前门店角色 manager）看到的是另一本招募账，服务端 ledger=recruit，瓦片、科目、标题、收件人都跟着服务端走：
//   没有订房、二消；科目两步选（其他收入 / 其他支出 下面还有一层，存的是「其他收入/兼职」这样的串）；全部手工录入；发给本城城市负责人
// ---------------------------------------------------------------------------
import { ref, computed, watch } from 'vue'
import { useScreen, go, back, toast } from '@/common/screen.js'
import { apiDaily, apiDailyAdd, apiDailyVoid, apiDailySend } from '@/common/api.js'
import { ensureSession, currentStaffStoreId, staffStoreUrl } from '@/common/experience.js'
import { sheet, prompt, alert, confirm, pickPaged, shiftDate, todayCn, errText } from '@/common/ui.js'
import { absUrl, uploadTo, chooseImages, downloadDoc } from '@/common/upload.js'
import R from '@/common/routes.js'
import { setReportAs } from '@/common/request.js'
import { onShow as onPageShow, onUnload as onPageUnload } from '@dcloudio/uni-app'
// 城市负责人的招募日报、招募周报（?as=recruit）：这一页的请求都带上，离开时清掉
let reportAs = ''
onPageShow(() => setReportAs(reportAs))
onPageUnload(() => setReportAs(''))

let ready = false
const storeId = ref(null)
const date = ref('')
const s = useScreen(4, {
  onLoad: async (q) => {
    reportAs = q?.as === 'recruit' ? 'recruit' : ''
    setReportAs(reportAs)
    date.value = q?.date || ''
    await ensureSession()
    // 链接指定的门店优先（看板排名、消息里的报表链接）；没指定就用员工端当前门店，
    // 不能留空让服务端默认第一家主理门店，否则切换门店后明细会记到别的门店上。
    // 编号不做 Number 转换，避免大编号丢精度。
    storeId.value = q?.storeId || currentStaffStoreId()
    ready = true
    load()
  }
})
const isRecruit = computed(() => d.value.ledger === 'recruit')
const titles = computed(() => [d.value.title || '每日经营报表', '新增明细', isRecruit.value ? '收支汇总' : '经营汇总', '导出报表'])
// 之前返回一律「当前屏 - 1」：从经营汇总（3）返回会落到新增明细表单（2），从汇总点「新增明细」再返回却跳回第 1 屏。
// 现在：新增明细返回打开它的那一屏，汇总返回当日数据，导出返回汇总
let formFrom = 1
const PARENT = { 3: 1, 4: 3 }
const onBack = () => { if (s.value === 2) s.value = formFrom; else if (PARENT[s.value]) s.value = PARENT[s.value]; else back() }
watch(s, (v) => { if (ready && v !== 2) load() })

const d = ref({ items: [], summaries: [], rows: [], managers: [], incomeCats: [], expenseCats: [], payMethods: [] })
async function load() {
  try {
    d.value = (await apiDaily({ storeId: storeId.value || undefined, date: date.value || undefined })).data || d.value
    storeId.value = d.value.storeId
    date.value = d.value.date
  } catch (e) {
    toast(errText(e, '报表加载失败'))
  }
}
const calendarOpen = ref(false)
const pickDate = () => { calendarOpen.value = true }
const confirmDate = (v) => {
  calendarOpen.value = false
  if (!v || v === date.value) return
  date.value = v
  load()
}

// ---------------- s=1 ----------------
// 「较昨日」按变化值定方向（和数据看板、工作台、活动数据一致）：涨 → 绿色 ↑，跌 → 提醒红 ↓，持平 / — / 0 → 灰色、不画箭头。
// 之前涨用主色（现在是暖棕）、跌用绿色，正好反了。服务端的 up 是 cur >= prev（持平也算涨），只在「新增」这种没有正负号的值上参考它
const trendText = (v) => String(v == null ? '' : v).replace(/^较(昨日|上周)\s*/, '').replace(/\s*[↑↓]$/, '').trim()
const trendDir = (v, up) => {
  const t = trendText(v)
  if (!t || t === '—' || t === '持平' || /^[+-]?0+(\.0+)?%?$/.test(t)) return 0
  if (t.startsWith('-')) return -1
  if (t.startsWith('+')) return 1
  return up === false ? -1 : 1
}
// 支出类（采购支出 / 其他支出 / 总支出）反过来：花得多是坏消息 → 涨用提醒红，少了用绿色；箭头方向照旧
const costly = (x) => /支出/.test([x && x.key, x && x.name, x && x.label].map(v => String(v || '')).join(' '))
const trend = (v, up, cost) => {
  const dir = trendDir(v, up)
  const good = cost ? dir < 0 : dir > 0
  return { dir, text: (trendText(v) || '—') + (dir > 0 ? ' ↑' : dir < 0 ? ' ↓' : ''), cls: dir === 0 ? 'k-muted' : good ? 'k-green' : 'k-alert' }
}
const dailyItems = computed(() => (d.value.items || []).map(x => ({ ...x, trend: trend(x.delta, x.up, costly(x)) })))
const profitTrend = computed(() => trend(d.value.profitDelta, d.value.profitUp))
// 「系统数据（自动同步）」旁的问号：口径与 KgStats.REVENUE_UNION 一致，说清哪些是系统算的、哪些要手工录
const explainSystem = () => isRecruit.value ? alert('这本账怎么记', [
  '保险收入、保险支出、其他收入、其他支出都要在「新增明细」里手工录入，系统不会自动同步。',
  '这本账只有本店的换工主理人能看到，和小院主理人的每日经营报表互不相通，订房、二消也不算进来。',
  `只统计「${d.value.storeName || '当前门店'}」。`
].join('\n')) : alert('系统数据怎么来的', [
  '订房收入：本店住宿订单，按支付成功的日期计入当天；发生退款时在退款当天扣减。',
  '二消收入：本店服务订单 + 付费活动报名，计入和扣减方式同上。',
  '其他收入、采购支出、其他支出不会自动同步，需要在「新增明细」里手工录入。',
  `系统数据在打开页面时实时计算${d.value.synced ? '（' + d.value.synced + '）' : ''}，只统计「${d.value.storeName || '当前门店'}」。`
].join('\n'))
function onMetric(item) {
  // 招募账的瓦片带 direction（点了直接记这一项）：保险收入 / 保险支出预选好科目，其他收入 / 其他支出再选一层
  if (item.direction) {
    form.value.direction = item.direction
    form.value.category = item.category || ''
    formFrom = 1
    s.value = 2
    return
  }
  if (item.manual) {
    form.value.direction = item.key === 'income' ? 'income' : 'expense'
    form.value.category = item.key === '采购支出' ? '采购支出' : (item.key === 'income' ? '其他收入' : '')
    formFrom = 1
    s.value = 2
    return
  }
  filter.value = 'income'
  s.value = 3
}

// ---------------- s=2 新增明细 ----------------
const pays = computed(() => ((d.value.payMethods || []).length ? d.value.payMethods : ['现金', '微信', '支付宝', '银行卡', '其他']))
const blank = () => ({ direction: 'income', category: '', amountFen: 0, pay: '微信', remark: '' })
const form = ref(blank())
const proofs = ref([])
const neutralTab = 'color: var(--k-ink); border-color: transparent; font-weight: 400'
const amountText = computed(() => (form.value.amountFen ? (form.value.amountFen / 100).toFixed(2) : '0.00'))
const setDirection = (v) => { if (form.value.direction !== v) { form.value.direction = v; form.value.category = '' } }
// 科目两步选：带 / 的串按第一段分组。旅居账的科目都没有 /，和原来一样只选一次
async function pickCategory() {
  const cats = (form.value.direction === 'income' ? d.value.incomeCats : d.value.expenseCats) || []
  const tops = [...new Set(cats.map(c => c.split('/')[0]))]
  if (!tops.length) return
  const i = await sheet(tops)
  if (i < 0) return
  const subs = cats.filter(c => c.startsWith(tops[i] + '/'))
  if (!subs.length) { form.value.category = tops[i]; return }
  const j = await sheet(subs.map(c => c.slice(tops[i].length + 1)))
  if (j >= 0) form.value.category = subs[j]
}
async function inputAmount() {
  const v = await prompt('金额（元）', { value: form.value.amountFen ? String(form.value.amountFen / 100) : '', placeholder: '0.01–1000000，最多两位小数' })
  if (v === null) return
  if (!/^\d+(\.\d{1,2})?$/.test(v.trim()) || Number(v) <= 0 || Number(v) > 1000000) return toast('请输入 0.01–1000000 之间的金额')
  form.value.amountFen = Math.round(Number(v.trim()) * 100)
}
async function inputRemark() {
  const v = await prompt('说明（选填，120 字以内）', { value: form.value.remark })
  if (v !== null) form.value.remark = v.trim().slice(0, 120)
}
async function addProofs() {
  if (proofs.value.length >= 5) return toast('最多 5 张')
  const paths = await chooseImages(5 - proofs.value.length)
  for (const p of paths) {
    try {
      proofs.value.push((await uploadTo('/app/upload/image', p)).data.url)
    } catch (e) {
      toast(errText(e, '上传失败'))
    }
  }
}
let idemKey = ''
// 保存 / 发送：连点时只提交一次（幂等键防的是重复入账，这里防的是重复提示和跳屏）
let saving = false
async function save(keepGoing) {
  const f = form.value
  if (!f.category) return toast('请选择分类')
  if (!f.amountFen) return toast('请输入金额')
  if (saving) return
  if (!idemKey) idemKey = `d-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  saving = true
  try {
    await apiDailyAdd({ storeId: storeId.value, date: date.value, direction: f.direction, category: f.category, amountFen: f.amountFen, payMethod: f.pay,
      remark: f.remark, proofs: proofs.value, idemKey })
    idemKey = ''
    // 明细记在哪家门店要说清楚：这一页没有门店栏，提示里带上服务端返回的门店名
    const where = d.value.storeName ? '到「' + d.value.storeName + '」' : ''
    toast(keepGoing ? `已保存${where}，请继续录入` : `已保存${where}`)
    form.value = { ...blank(), direction: f.direction }
    proofs.value = []
    if (!keepGoing) s.value = 3
  } catch (e) {
    toast(errText(e, '保存失败'))
  } finally {
    saving = false
  }
}

// ---------------- s=3 汇总 ----------------
// 汇总卡的 delta 是整句「较昨日 +12.5% ↑」：去掉前缀和服务端的箭头，方向按上面的规则判断（「新增 ↓」= 结余由 0 变负）
const summaries = computed(() => (d.value.summaries || []).map(x => ({ ...x, trend: trend(x.delta, !/↓\s*$/.test(String(x.delta || '')), costly(x)) })))
const filter = ref('all')
const neutralFilter = 'color: var(--k-ink); border-color: var(--k-line)'
const detailRows = computed(() => (d.value.rows || []).filter(r => filter.value === 'all' || r.direction === filter.value))
async function onRow(r) {
  if (r.system) return alert(r.name, `${r.note}\n系统按订单支付成功时间自动统计，退款在退款当日扣减。`)
  const opts = ['查看凭证', '作废这条明细']
  const i = await sheet(opts)
  if (i === 0) {
    if (!r.proofs || !r.proofs.length) return alert(r.name, `${r.note || ''}\n录入人：${r.creator || '—'}\n没有上传凭证`)
    uni.previewImage({ urls: r.proofs.map(absUrl) })
  }
  if (i === 1 && (await confirm('作废明细', `作废「${r.name} ${r.amount}」？作废后不计入报表，记录仍保留。`))) {
    try {
      await apiDailyVoid(r.entryId)
      toast('已作废')
      load()
    } catch (e) {
      toast(errText(e, '作废失败'))
    }
  }
}
async function addEntry() {
  const i = await sheet(['新增收入', '新增支出'])
  if (i < 0) return
  form.value = { ...blank(), direction: i === 0 ? 'income' : 'expense' }
  formFrom = 3
  s.value = 2
}
const openTrend = () => go(staffStoreUrl(R.dashboard + '?view=trend', storeId.value))

// ---------------- s=4 导出 ----------------
const cell = (r) => [r.name, String(r.amount).replace(/^-?¥/, ''), r.system ? '系统' : '手动', r.note || '']
const incomeRows = computed(() => {
  const rows = (d.value.rows || []).filter(r => r.direction === 'income').map(cell)
  return [...rows, ['收入合计', (d.value.summaries[0] || {}).amount ? d.value.summaries[0].amount.replace('¥', '') : '0', '', '']]
})
const expenseRows = computed(() => {
  const rows = (d.value.rows || []).filter(r => r.direction === 'expense').map(cell)
  return [...(rows.length ? rows : [['暂无支出', '0', '', '']]), ['支出合计', (d.value.summaries[1] || {}).amount ? d.value.summaries[1].amount.replace('¥', '') : '0', '', '']]
})
const totals = computed(() => (d.value.summaries || []).map(x => String(x.amount || '').replace('¥', '')))
const manager = computed(() => (d.value.managers || [])[0] || null)
// 没有头像时用全站默认头像（袋鼠），之前用的是设计稿里一位员工的照片，看起来像真人
const managerAvatar = computed(() => (manager.value && manager.value.avatar ? absUrl(manager.value.avatar) : '/static/media/profile-avatar.jpg'))
const managerName = computed(() => (manager.value ? manager.value.nickname || '收件人' : (isRecruit.value || d.value.recipientKind === 'none' ? '暂时没有收件人' : '本店还没有换工主理人账号')))
const managerNote = computed(() => d.value.recipientNote || `站内消息 · 本店换工主理人 ${(d.value.managers || []).length} 人`)
async function sendReport() {
  // 切换后的旅居账没有收件人时不拦：recipientKind 是 none、也没有 recipientEmpty，服务端回 sent:0 和说明
  if (!(d.value.managers || []).length && (d.value.recipientEmpty || d.value.recipientKind !== 'none')) return toast(d.value.recipientEmpty || '本店还没有换工主理人账号')
  if (saving) return
  saving = true
  try {
    const res = await apiDailySend({ storeId: storeId.value, date: date.value })
    toast((res.data && res.data.message) || '已发送')
  } catch (e) {
    toast(errText(e, '发送失败'))
  } finally {
    saving = false
  }
}
async function download() {
  // 报表还没加载出来时门店 / 日期是空的，拼成 storeId=null 只会换来一句看不懂的参数错误
  if (!storeId.value || !date.value) return toast('报表还没加载出来，请稍后再试')
  try {
    await downloadDoc(`/app/manage/daily/report.xlsx?storeId=${encodeURIComponent(storeId.value)}&date=${encodeURIComponent(date.value)}`, 'xlsx', `${d.value.title || '每日经营报表'}-${date.value}.xlsx`)
  } catch (e) {
    // downloadDoc 已经把服务端的原因（没有权限、登录失效、日期不对等）放进了错误消息里
    toast(errText(e, '下载失败'))
  }
}
</script>

<style scoped lang="scss">
/* 10-16 跟进：日期框原来写死 222px 宽，「2026年10月17日（周六）」放不下会折行、撑出框；现在按字数自动变宽、不折行。
   日期框和「系统已同步」一行放不下时（375 及更窄），「系统已同步」换到下一行 */
.date-line { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 6px 10px; }
.date-box { display: inline-flex; flex: 0 0 auto; box-sizing: border-box; min-width: 200px; max-width: 100%; height: 38px; padding: 0 12px; border: 1px solid var(--k-line2); border-radius: 8px; background: var(--k-paper); align-items: center; justify-content: space-between; gap: 8px; white-space: nowrap; font-family: var(--k-serif); font-size: 16px; font-weight: 700; }
.synced { display: flex; align-items: center; gap: 5px; color: var(--k-muted); font-size: 12px; }
.section-head { display: flex; align-items: center; gap: 5px; margin: 13px 0 8px; font-family: var(--k-serif); font-size: 16px; font-weight: 700; }
.metric-list { display: flex; flex-direction: column; gap: 8px; }
.metric { min-height: 69px; padding: 9px 11px; border: 1px solid var(--k-line); border-radius: 11px; background: var(--k-paper); display: flex; align-items: center; gap: 13px; }
.metric__icon { width: 47px; height: 47px; border-radius: 50%; display: flex; align-items: center; justify-content: center; flex: 0 0 auto; box-shadow: inset 0 0 0 1px rgba(255,255,255,.45); }
.metric__icon--green { background: #78A486; }.metric__icon--ochre { background: #CA8732; }.metric__icon--green-dark { background: var(--k-green); }.metric__icon--blue { background: var(--k-indigo); }
.metric__main { flex: 1; min-width: 0; }
.metric__right { flex-shrink: 0; }
/* 名称和「（系统）/（手动）」分成两段：窄屏放不下时整段「（系统）」换到下一行，不会从中间断开 */
.metric__name { display: flex; flex-wrap: wrap; align-items: baseline; font-family: var(--k-serif); font-size: 16px; font-weight: 700; }.metric__source { font-size: 12px; white-space: nowrap; }
@media (max-width: 340px) { .metric { gap: 10px; } .metric__name { font-size: 15px; } .metric__source { font-size: 11px; } }
.metric__detail { display: block; margin-top: 8px; color: var(--k-muted); font-size: 12px; }
.metric__right { text-align: right; }.metric__amount { display: block; color: var(--k-red); font-family: var(--k-sans); font-size: 24px; line-height: 1.1; }.metric__delta { display: block; margin-top: 8px; color: var(--k-muted); font-size: 12px; }
.profit { margin-top: 11px; padding: 11px 16px; border: 1px solid var(--k-red-line); border-radius: 10px; background: var(--k-paper); }.profit__label { display: block; font-family: var(--k-sans); font-size: 15px; }.profit__amount { margin-top: 6px; color: var(--k-red); font-family: var(--k-sans); font-size: 27px; }.profit__delta { color: var(--k-muted); font-size: 12px; }.profit__delta text { font-weight: 700; }
.data-note { display: flex; align-items: center; gap: 5px; margin-top: 9px; color: var(--k-muted); font-size: 11px; }

.type-tabs { display: flex; height: 38px; border: 1px solid var(--k-line); border-radius: 9px; overflow: hidden; }.type-tabs__item { flex: 1; display: flex; align-items: center; justify-content: center; font-family: var(--k-sans); font-size: 16px; }.type-tabs__item.active { color: var(--k-red); border: 1px solid var(--k-red); border-radius: 9px; font-weight: 700; }
.field-group { margin-top: 20px; }.field-label { display: flex; align-items: center; margin-bottom: 8px; font-family: var(--k-serif); font-size: 16px; font-weight: 700; }.required { margin-left: 4px; color: var(--k-red); }.field { height: 40px; padding: 0 12px; border: 1px solid var(--k-line); border-radius: 8px; background: var(--k-paper); display: flex; align-items: center; }.placeholder { color: var(--k-muted); font-size: 13px; }.field__suffix,.field__counter { margin-left: auto; color: var(--k-muted); font-size: 16px; }.field__counter { font-size: 13px; }
.pay-types { display: grid; grid-template-columns: repeat(5,1fr); gap: 8px; }.pay { height: 34px; border: 1px solid var(--k-line); border-radius: 7px; background: var(--k-paper); display: flex; align-items: center; justify-content: center; font-size: 13px; }.pay.active { color: var(--k-red); border-color: var(--k-red); }
.upload { width: 68px; height: 76px; border: 1px dashed var(--k-line2); border-radius: 8px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 4px; color: var(--k-muted); font-size: 11px; }.add-actions { display: flex; gap: 14px; margin-top: 14px; }.add-where { display: block; margin-top: 26px; color: var(--k-muted); font-size: 12px; }

.summary-date { vertical-align: top; }.source-legend { display: flex; align-items: center; gap: 7px; margin: 13px 0 10px; color: var(--k-muted); font-size: 12px; }.legend-dot { width: 9px; height: 9px; border-radius: 50%; flex: 0 0 auto; }.legend-dot--green { background: var(--k-green); }.legend-dot--ochre { background: #D8871D; }
.summary-cards { display: grid; grid-template-columns: repeat(3,1fr); gap: 12px; }.summary-card { min-height: 96px; padding: 13px 6px; border: 1px solid var(--k-line); border-radius: 10px; background: var(--k-paper); text-align: center; font-family: var(--k-sans); font-size: 15px; }.summary-card__amount { display: block; margin-top: 10px; font-family: var(--k-sans); font-size: 19px; overflow-wrap: anywhere; }.summary-card__delta { display: block; margin-top: 10px; color: var(--k-muted); font-family: var(--k-sans); font-size: 11px; }.summary-card__delta text { font-weight: 700; }
.warning { height: 38px; margin-top: 16px; padding: 0 11px; border: 1px solid rgba(197,132,41,.5); border-radius: 8px; background: var(--k-ochre-soft); display: flex; align-items: center; gap: 8px; color: #8D6226; font-size: 13px; }.warning text { flex: 1; }.table-title { display: block; margin-top: 16px; font-family: var(--k-serif); font-size: 17px; font-weight: 700; }
.filter-tabs { display: flex; gap: 8px; margin: 8px 0 10px; }.filter-tabs__item { width: 70px; height: 30px; border: 1px solid var(--k-line); border-radius: 8px; display: flex; align-items: center; justify-content: center; font-size: 13px; }.filter-tabs__item.active { color: var(--k-red); border-color: var(--k-red); }
.details-table { border: 1px solid var(--k-line); border-radius: 8px; overflow: hidden; }.details-row { height: 35px; display: grid; grid-template-columns: 1.35fr 1fr .95fr .55fr; align-items: center; border-top: 1px solid var(--k-line); font-size: 12px; }.details-row:first-child { border-top: 0; }.details-row > text { min-width: 0; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }.details-row--head { background: var(--k-paper2); color: var(--k-muted); font-weight: 600; }.details-row > text,.details-row > view,.details-row > uni-view { padding-left: 10px; }.source-cell { display: flex; align-items: center; gap: 6px; }.summary-actions { display: flex; gap: 14px; margin-top: 16px; }.summary-actions__pdf { flex: 1.4; }

.paper { padding: 12px 18px 8px; border: 1px solid var(--k-line2); background: #fff; box-shadow: 0 2px 9px rgba(61,45,31,.08); }.paper__brand { display: flex; justify-content: space-between; }.paper__title { display: block; margin: 2px 0 7px; font-family: var(--k-serif); font-size: 23px; font-weight: 700; }.paper__meta { display: block; margin-top: 3px; font-size: 10px; }.paper__logo { position: relative; width: 100px; text-align: center; }.paper__logo text { display: block; font-family: var(--k-brand); font-weight: 700; font-size: 13px; }.paper__logo text:nth-child(2) { margin-top: 2px; font-family: var(--k-sans); font-weight: 400; font-size: 8px; }.paper__logo image { width: 66px; height: 36px; mix-blend-mode: multiply; }.paper__section { display: block; margin: 6px 0 3px; font-family: var(--k-serif); font-size: 12px; font-weight: 700; }
.paper-table { border: 1px solid #BFB8AD; }.paper-row { min-height: 19px; display: grid; grid-template-columns: 1.15fr 1.25fr .8fr 1.2fr; border-top: 1px solid #CBC4B9; font-size: 9px; }.paper-row:first-child { border-top: 0; }.paper-row text { display: flex; align-items: center; justify-content: center; border-left: 1px solid #CBC4B9; }.paper-row text:first-child { border-left: 0; }.paper-row--head { background: #F2EEE6; font-weight: 700; }.paper-table--totals .paper-row { grid-template-columns: repeat(3,1fr); }.paper-table--totals .paper-row:last-child { font-family: var(--k-sans); font-size: 12px; font-weight: 700; }
.signature { display: flex; align-items: flex-end; gap: 7px; margin-top: 9px; font-size: 9px; }.signature__line { width: 98px; border-bottom: 1px solid #777; }.signature__line--date { width: 70px; }.paper__note { display: block; margin-top: 6px; color: var(--k-muted); font-size: 8px; }
.recipient-title { display: block; margin-top: 9px; font-family: var(--k-serif); font-size: 17px; font-weight: 700; }.recipient { height: 50px; margin-top: 5px; padding: 0 10px; border: 1px solid var(--k-line); border-radius: 9px; background: var(--k-paper); display: flex; align-items: center; gap: 9px; }.recipient__name, .recipient__wechat { overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }.recipient image { width: 34px; height: 34px; border-radius: 50%; }.recipient__name { display: block; font-family: var(--k-serif); font-size: 15px; font-weight: 700; }.recipient__wechat { display: block; margin-top: 3px; color: var(--k-muted); font-size: 11px; }.download { margin-top: 6px; }

/* 2026-11-17 改版「小而精」（主人按样张第三版拍板）：浅灰底 + 白卡 12 圆角、不描边不加阴影；金额 18–24 / 700，标签和说明 11–12 灰字。
   只改样子：日期、问号说明、各项指标、新增明细表单、汇总、明细表、导出 / 发送 / 下载都在；「较昨日」的颜色和箭头仍由脚本里的 trend() 定，这里只管字号。
   新增明细是填写页，字不改小，只统一底色和圆角。下面每条都带 .daily，盖住上面的旧值（上面的旧规则有检查脚本盯着，原样留着）。 */
@import './manage-refine.scss';
.daily .date-box { height: 36px; padding: 0 10px 0 12px; border: 0; border-radius: 10px; font-family: var(--k-sans); font-size: 15px; font-weight: 600; }
.daily .date-box :deep(.k-icon) { width: 16px !important; height: 16px !important; }
.daily .synced { gap: 4px; font-size: 11px; }
.daily .synced :deep(.k-icon) { width: 13px !important; height: 13px !important; }
.daily .section-head { margin: 14px 0 8px; font-family: var(--k-sans); font-size: 15px; font-weight: 700; line-height: 22px; }
.daily .section-head :deep(.k-icon) { width: 14px !important; height: 14px !important; }
/* 指标行：图标是 40 的渐变圆（和消息页入口一个做法），名称 14 / 600，金额 20 / 700 */
.daily .metric { min-height: 64px; padding: 12px; border: 0; border-radius: 12px; gap: 10px; }
.daily .metric__icon { width: 40px; height: 40px; box-shadow: inset 0 1px 0 rgba(255,255,255,.35); }
.daily .metric__icon :deep(.k-icon) { width: 20px !important; height: 20px !important; }
.daily .metric__icon--green { background: linear-gradient(145deg, #9CC4A6, #5F8F6F); }
.daily .metric__icon--ochre { background: linear-gradient(145deg, #F3C76C, #D0902A); }
.daily .metric__icon--green-dark { background: linear-gradient(145deg, #8FBA78, #527D42); }
.daily .metric__icon--blue { background: linear-gradient(145deg, #8DB4D6, #4F7EA8); }
.daily .metric__name { font-family: var(--k-sans); font-size: 14px; font-weight: 600; line-height: 20px; }
.daily .metric__source { font-size: 11px; font-weight: 400; color: var(--k-muted); }
.daily .metric__detail { margin-top: 2px; font-size: 11px; line-height: 16px; }
.daily .metric__amount { color: var(--k-ink); font-size: 20px; font-weight: 700; line-height: 24px; }
.daily .metric__delta { margin-top: 2px; font-size: 11px; line-height: 16px; }
.daily .profit { margin-top: 8px; padding: 12px; border: 0; border-radius: 12px; background: linear-gradient(180deg, #FFF8EE, var(--k-paper) 72%); }
.daily .profit__label { font-size: 12px; color: var(--k-muted); }
.daily .profit__amount { margin-top: 2px; font-size: 24px; font-weight: 700; line-height: 30px; }
.daily .profit__delta { font-size: 11px; }
.daily .data-note { align-items: flex-start; margin-top: 10px; line-height: 16px; }
.daily .data-note :deep(.k-icon) { width: 12px !important; height: 12px !important; margin-top: 2px; }
/* 新增明细（填写页）：字号不动，输入框白底、10 圆角、高 44 */
.daily .type-tabs { height: 44px; padding: 3px; border: 0; border-radius: 12px; background: var(--k-paper); }
.daily .type-tabs__item { border: 1px solid transparent; border-radius: 9px; }
.daily .type-tabs__item.active { color: var(--k-red-deep); border-color: var(--k-red-line); font-weight: 600; }
.daily .field-group { margin-top: 16px; }
.daily .field-label { font-family: var(--k-sans); font-size: 16px; font-weight: 600; }
.daily .field-label .k-meta { font-weight: 400; }
.daily .field { height: 44px; border: 0; border-radius: 10px; }
.daily .field :deep(.k-icon) { margin-left: auto; }
.daily .placeholder { font-size: 14px; }
.daily .pay { height: 40px; border-color: transparent; border-radius: 10px; font-size: 14px; }
.daily .pay.active { color: var(--k-red-deep); border-color: var(--k-red-line); background: var(--k-red-soft); font-weight: 600; }
.daily .upload { width: 76px; border-radius: 10px; background: var(--k-paper); }
.daily .add-where { margin-top: 20px; }
.daily .add-actions { gap: 10px; margin-top: 12px; }
/* 汇总 */
.daily .source-legend { gap: 6px; margin: 10px 0 8px; font-size: 11px; }
.daily .legend-dot { width: 6px; height: 6px; }
.daily .legend-dot--ochre { background: var(--k-ochre); }
.daily .summary-cards { gap: 8px; }
.daily .summary-card { min-height: 0; padding: 12px 4px; border: 0; border-radius: 12px; font-size: 12px; color: var(--k-muted); }
.daily .summary-card__amount { margin-top: 4px; font-size: 18px; font-weight: 700; line-height: 24px; }
.daily .summary-card__delta { margin-top: 2px; line-height: 16px; }
.daily .warning { height: auto; min-height: 36px; margin-top: 8px; padding: 8px 10px; border: 0; border-radius: 10px; color: var(--k-ochre-deep); font-size: 12px; line-height: 18px; }
.daily .warning :deep(.k-icon) { width: 14px !important; height: 14px !important; }
.daily .table-title { margin-top: 16px; font-family: var(--k-sans); font-size: 15px; font-weight: 700; line-height: 22px; }
.daily .filter-tabs { gap: 6px; margin: 8px 0; }
.daily .filter-tabs__item { width: auto; min-width: 56px; height: 28px; padding: 0 12px; border-radius: 14px; background: var(--k-paper); font-size: 12px; }
.daily .filter-tabs__item.active { color: var(--k-red-deep); border-color: var(--k-red-line); }
.daily .details-table { border: 0; border-radius: 12px; background: var(--k-paper); }
.daily .details-row { height: 40px; }
.daily .details-row--head { height: 34px; background: transparent; font-size: 11px; font-weight: 400; }
.daily .details-row :deep(.k-icon) { width: 15px !important; height: 15px !important; opacity: .65; }
.daily .summary-actions { gap: 10px; margin-top: 12px; }
/* 导出：报表预览是一张白纸，去掉阴影和灰褐色表格线，小字放大到看得清 */
.daily .paper { padding: 14px 14px 10px; border: 0; border-radius: 12px; box-shadow: none; }
.daily .paper__title { margin: 0 0 6px; font-family: var(--k-sans); font-size: 18px; font-weight: 700; line-height: 26px; }
.daily .paper__meta { margin-top: 2px; font-size: 11px; line-height: 16px; color: var(--k-ink2); }
/* 袋鼠小图自带一层米灰底，摆在白纸上是一块灰框：提亮一点，底色就并进白纸了 */
.daily .paper__logo image { filter: brightness(1.05); }
.daily .paper__section { margin: 10px 0 4px; font-family: var(--k-sans); font-size: 13px; font-weight: 700; }
.daily .paper-table { border-color: var(--k-line2); border-radius: 6px; overflow: hidden; }
.daily .paper-row { min-height: 24px; border-top-color: var(--k-line); font-size: 11px; }
.daily .paper-row text { border-left-color: var(--k-line); padding: 2px; text-align: center; }
.daily .paper-row--head { background: var(--k-bg); font-weight: 600; }
.daily .signature { margin-top: 12px; font-size: 11px; }
.daily .signature__line { border-bottom-color: var(--k-light); }
.daily .paper__note { margin-top: 8px; font-size: 10px; }
.daily .recipient-title { margin-top: 16px; font-family: var(--k-sans); font-size: 15px; font-weight: 700; line-height: 22px; }
.daily .recipient { height: 56px; margin-top: 8px; padding: 0 12px; border: 0; border-radius: 12px; gap: 10px; }
.daily .recipient image { width: 36px; height: 36px; }
.daily .recipient__name { font-family: var(--k-sans); font-size: 14px; font-weight: 600; }
.daily .recipient__wechat { margin-top: 2px; }
.daily .download { margin-top: 12px; }
/* 2026-11-18 复查 */
/* 1) 问号和明细筛选胶囊看着小，手指能点的范围补到 36：问号是图标自己在接点击，用透明内边距撑大（负外边距抵掉，位置和大小都不变）；胶囊上下各补一截透明的可点区 */
.daily .section-head :deep(.k-icon) { box-sizing: content-box; padding: 11px; margin: -11px; }
.daily .filter-tabs__item { position: relative; }
.daily .filter-tabs__item::after { content: ""; position: absolute; left: 0; right: 0; top: -5px; bottom: -5px; }
/* 2) 汇总三张卡：窄屏（320）金额从数字中间断成两行、箭头单独掉到下一行。屏越窄金额越收小一号（390 以下 16、340 以下 14）；「+10.2% ↑」整段不拆 */
.daily .summary-card { min-width: 0; }
.daily .summary-card__delta text { white-space: nowrap; }
@media (max-width: 389px) { .daily .summary-card__amount { font-size: 16px; } }
@media (max-width: 340px) { .daily .summary-card { padding-left: 2px; padding-right: 2px; } .daily .summary-card__amount { font-size: 14px; line-height: 22px; } .daily .summary-card__delta { font-size: 10px; } }
/* 3) 导出预览的签名行：字放大后窄屏「主理人签名：」「日期：」被挤成两行。字不折，让两条横线去缩 */
.daily .signature text { flex-shrink: 0; white-space: nowrap; }
.daily .signature__line { min-width: 24px; }
/* 4) 收件人下面那行说明（站内消息 · 本店换工主理人 1 人）窄屏被截成省略号：放不下就折到第二行，卡片跟着长高 */
.daily .recipient { height: auto; min-height: 56px; padding-top: 8px; padding-bottom: 8px; }
.daily .recipient__wechat { white-space: normal; line-height: 16px; }
/* 2026-11-18 第二轮精修（精修词典：同一种东西全站一个样子；只改样子，日期、问号、各项指标、录入、汇总、明细、导出 / 发送 / 下载都在） */
/* 1) 区块标题统一 16 / 700 */
.daily .section-head, .daily .table-title, .daily .recipient-title { font-size: 16px; font-weight: 700; line-height: 22px; color: var(--k-ink); }
/* 2) 当日数据四行合成一张白卡，行与行之间用发丝线（从名称的左边缘画起：12 + 图标 36 + 间距 10） */
.daily .metric-list { gap: 0; border-radius: 12px; background: var(--k-paper); overflow: hidden; }
.daily .metric { position: relative; border-radius: 0; background: transparent; }
.daily .metric + .metric::before { content: ""; position: absolute; left: 58px; right: 0; top: 0; height: 1px; background: var(--k-line); transform: scaleY(.5); }
/* 3) 指标图标：彩色实心圆换成浅色圆角方块 + 18 号线条图标（图标颜色在模板里从白改成 ink2），数字成为这一行的重点 */
.daily .metric__icon { width: 36px; height: 36px; border-radius: 10px; background: #F5F1EB; box-shadow: none; }
.daily .metric__icon :deep(.k-icon) { width: 18px !important; height: 18px !important; }
.daily .metric__icon--green { background: var(--k-green-soft); }
.daily .metric__icon--ochre { background: var(--k-ochre-soft); }
.daily .metric__icon--green-dark { background: #E4EDDA; }
.daily .metric__icon--blue { background: var(--k-indigo-soft); }
/* 4) 汇总三格合成一张白卡 + 发丝竖线（同看板的合计卡） */
.daily .summary-cards { gap: 0; border-radius: 12px; background: var(--k-paper); }
.daily .summary-card { position: relative; border-radius: 0; background: transparent; }
.daily .summary-card + .summary-card::before { content: ""; position: absolute; left: 0; top: 12px; bottom: 12px; width: 1px; background: var(--k-line); transform: scaleX(.5); }
/* 5) 异常提示右边的箭头 12 号灰色（模板里从 ink 19 改成 muted 12） */
.daily .warning :deep(.k-icon:last-child) { width: 12px !important; height: 12px !important; }
/* 6) 明细筛选胶囊按词典：不描边，选中浅棕底 + 深棕字。
      「全部」那颗一直带着 active，没选中时靠脚本里的行内样式只重设字色和边框色（border-color: var(--k-line)）盖回去，
      所以这里不能给 .active 加底色：(a) 在这一组里把 --k-line 换成白色，行内那句边框色就看不见了；(b) 用 14px 粗边框画出胶囊的底色，
      没选中 = 白边（白底），选中 = 浅棕边（浅棕底），行内样式会把没选中的「全部」重设回白边。字重不动，免得漏到「全部」上。
      内容区只剩中间一条线，透明可点区跟着往外扩到整颗胶囊、上下凑够 36 */
.daily .filter-tabs { --k-line: var(--k-paper); }
.daily .filter-tabs__item { box-sizing: border-box; height: 28px; min-width: 56px; padding: 0; border: 14px solid var(--k-paper); border-radius: 14px; }
.daily .filter-tabs__item.active { border-color: var(--k-red-soft); color: var(--k-red-deep); }
.daily .filter-tabs__item::after { left: -14px; right: -14px; top: -18px; bottom: -18px; }
/* 7) 明细表：行线改发丝线（左右各缩 12），第一列和卡片内边距 12 对齐，金额等宽 */
.daily .details-row { position: relative; border-top: 0; }
.daily .details-row + .details-row::before { content: ""; position: absolute; left: 12px; right: 12px; top: 0; height: 1px; background: var(--k-line); transform: scaleY(.5); }
.daily .details-row > text:first-child { padding-left: 12px; }
.daily .details-row > text:nth-child(2) { font-variant-numeric: tabular-nums; }
/* 8) 新增明细（填写页，字号 16 和高度 44 都不动）：收入 / 支出改成分段控件的样子——灰米色轨道 + 白色选中块。
      「收入」也一直带着 active，没选中时行内样式把边框色设成透明、字重设回 400；所以选中块用 19px 粗边框画（选中 = 白边），不会漏到「收入」上 */
.daily .type-tabs { padding: 3px; border-radius: 22px; background: #F0EBE4; }
.daily .type-tabs__item { box-sizing: border-box; height: 38px; border: 19px solid transparent; border-radius: 19px; }
.daily .type-tabs__item.active { border-color: var(--k-paper); color: var(--k-ink); }
/* 支付方式选中不描边（浅棕底 + 深棕字照旧；字号 14、高 40 不动） */
.daily .pay.active { border-color: transparent; }
/* 9) 导出页「发送」收小一档（28 高的小胶囊），让下面的「下载 Excel」做一屏的主按钮 */
.daily .recipient :deep(.k-button) { height: 28px; padding: 0 12px; border-radius: 14px; font-size: 12px; }
</style>
