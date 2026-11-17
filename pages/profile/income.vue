<template>
  <view class="k-page income">
    <k-topbar title="我的收入" back />
    <view class="k-body k-pad-safe">
      <view class="summary">
        <text class="summary__label">已确认到账合计</text>
        <text class="summary__total">{{ totals.confirmed || '¥0' }}</text>
        <text class="k-tiny">共 {{ totals.confirmedCount || 0 }} 笔 · 以你在任务里点了「确认收款」为准</text>
        <view class="summary__row">
          <view class="summary__cell" @click="pick('pending')"><text class="k-meta">待到账</text><text class="summary__num">{{ totals.pending || '¥0' }}</text><text class="k-tiny">{{ totals.pendingCount || 0 }} 笔 · 含门店已登记打款</text></view>
          <view class="summary__cell" @click="pick('disputed')"><text class="k-meta">申诉中</text><text class="summary__num" :class="{ 'summary__num--red': hasDispute }">{{ totals.disputed || '¥0' }}</text><text class="k-tiny">{{ totals.disputedCount || 0 }} 笔</text></view>
        </view>
      </view>
      <view class="note"><k-icon name="info" :size="15" color="ochre" /><text>{{ note }}</text></view>

      <view class="chips">
        <k-chip v-for="chipItem in CHIPS" :key="chipItem.value" pill :selected="status === chipItem.value" @click="pick(chipItem.value)"><text>{{ chipItem.label }}</text></k-chip>
      </view>

      <view v-if="loading && !rows.length" class="state"><text class="k-meta">正在读取收入记录…</text></view>
      <view v-else-if="error" class="state"><text>{{ error }}</text><k-button type="ghost" size="sm" label="重新加载" @click="load(false)" /></view>
      <view v-else-if="!rows.length" class="state">
        <k-icon name="wallet-cards" :size="32" color="muted" />
        <text class="k-meta">{{ emptyText }}</text>
        <k-button v-if="status === 'all'" type="secondary" size="sm" label="看看线上任务" @click="go(R.jobsList + '?type=online')" />
      </view>
      <view v-for="incomeRow in rows" :key="incomeRow.settleNo || incomeRow.appId" class="income-row" @click="openTask(incomeRow)">
        <view class="income-row__head">
          <text class="income-row__title">{{ incomeRow.title }}</text>
          <text class="income-row__amount" :class="'is-' + incomeRow.tone">{{ incomeRow.amount }}</text>
        </view>
        <view class="income-row__meta">
          <text class="k-meta income-row__store">{{ [incomeRow.storeName, incomeRow.method].filter(Boolean).join(' · ') }}</text>
          <k-chip :tone="incomeRow.tone"><text>{{ incomeRow.statusLabel }}</text></k-chip>
        </view>
        <text v-if="incomeRow.dates" class="k-tiny">{{ incomeRow.dates }}</text>
        <view v-if="incomeRow.status !== 'confirmed' && incomeRow.hint" class="income-row__hint"><text>{{ incomeRow.hint }}</text><k-icon name="chevron-right" :size="14" color="muted" /></view>
      </view>
      <k-button v-if="hasMore && !error" class="more" type="ghost" block :disabled="loading" :label="loading ? '加载中…' : '加载更多'" @click="load(true)" />
    </view>
  </view>
</template>

<script setup>
// ---------------------------------------------------------------------------
// 我的收入（线上任务的到账记录）。只读：报酬由门店按约定方式线下支付，平台不经手资金、不做转账。
// 顶部三项合计：已确认到账 / 待到账（待门店打款 + 门店已登记打款待你确认）/ 申诉中；
// 下面按状态筛选的明细，点一条进那单任务的交付页 —— 确认收款、申诉都在那里做。
// ---------------------------------------------------------------------------
import { ref, computed } from 'vue'
import { onLoad, onShow, onReachBottom, onPullDownRefresh } from '@dcloudio/uni-app'
import { go, toast } from '@/common/screen.js'
import { apiMyIncome } from '@/common/api.js'
import { ensureSession } from '@/common/experience.js'
import { errText } from '@/common/ui.js'
import R from '@/common/routes.js'

const CHIPS = [
  { value: 'all', label: '全部' },
  { value: 'pending', label: '待到账' },
  { value: 'confirmed', label: '已到账' },
  { value: 'disputed', label: '申诉中' }
]
const status = ref('all')
const totals = ref({})
const note = ref('报酬由门店按约定方式线下支付，平台不经手资金；收到后请在任务里点「确认收款」')
const rows = ref([])
const page = ref(1)
const hasMore = ref(false)
const loading = ref(false)
const error = ref('')
let ready = false
let seq = 0

// 「申诉中」只在真有申诉（笔数或金额大于 0）时用提醒红；0 笔 ¥0 时和「待到账」一样用墨色
const hasDispute = computed(() => Number(totals.value.disputedCount) > 0 || Number(String(totals.value.disputed || '').replace(/[^\d.]/g, '')) > 0)
const emptyText = computed(() => ({
  all: '还没有收入记录。线上任务验收通过后，结算单会出现在这里。',
  pending: '没有待到账的报酬。',
  confirmed: '还没有已确认到账的报酬。',
  disputed: '没有申诉中的结算单。'
})[status.value])

async function load(append) {
  if (append && (loading.value || !hasMore.value)) return
  const token = ++seq
  const next = append ? page.value + 1 : 1
  loading.value = true
  error.value = ''
  try {
    const d = (await apiMyIncome({ status: status.value, pageNum: next, pageSize: 20 })).data || {}
    if (token !== seq) return
    totals.value = d.totals || {}
    if (d.note) note.value = d.note
    rows.value = append ? rows.value.concat(d.rows || []) : (d.rows || [])
    hasMore.value = !!d.hasMore
    page.value = next
  } catch (e) {
    if (token !== seq) return
    error.value = errText(e, '收入记录读取失败，请重试')
    if (!append) rows.value = []
  } finally {
    if (token === seq) loading.value = false
  }
}

function pick(v) {
  if (status.value === v) return
  status.value = v
  load(false)
}

const openTask = (row) => {
  if (!row.appId) return toast('这单任务已不存在')
  go(R.jobDeliver + '?appId=' + row.appId)
}

onLoad(async (q) => {
  if (q && CHIPS.some(c => c.value === q.status)) status.value = q.status
  await ensureSession()
  await load(false)
  ready = true
})
// 在交付页确认收款 / 申诉后回来，合计和状态要跟着变
onShow(() => { if (ready) load(false) })
onReachBottom(() => load(true))
onPullDownRefresh(() => Promise.resolve(load(false)).finally(() => uni.stopPullDownRefresh()))
</script>

<style scoped lang="scss">
.income { font-size: 14px; line-height: 1.6; }
.summary { display: flex; flex-direction: column; gap: 4px; padding: 16px; border: 1px solid var(--k-line); border-radius: 14px; background: var(--k-paper); }
.summary__label { font-size: 13px; color: var(--k-muted); }
.summary__total { font-family: var(--k-sans); font-size: 32px; font-weight: 700; line-height: 1.2; color: var(--k-green); }
.summary__row { display: flex; gap: 10px; margin-top: 10px; }
.summary__cell { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; padding: 10px; border-radius: 10px; background: var(--k-paper2); }
.summary__num { font-family: var(--k-sans); font-size: 20px; font-weight: 700; color: var(--k-ink); }
.summary__num--red { color: var(--k-alert); }
.note { display: flex; align-items: flex-start; gap: 6px; margin-top: 10px; padding: 10px 12px; border-radius: 10px; background: #FBF4E8; font-size: 12px; line-height: 1.6; color: var(--k-ink); }
.chips { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 14px; }
.state { display: flex; flex-direction: column; align-items: center; gap: 10px; padding: 36px 16px; text-align: center; }
.income-row { display: flex; flex-direction: column; gap: 4px; margin-top: 10px; padding: 12px; border: 1px solid var(--k-line); border-radius: 12px; background: var(--k-paper); }
.income-row__head { display: flex; align-items: flex-start; justify-content: space-between; gap: 10px; }
.income-row__title { flex: 1; min-width: 0; font-size: 15px; font-weight: 700; color: var(--k-ink); overflow-wrap: anywhere; }
.income-row__amount { flex: 0 0 auto; font-family: var(--k-sans); font-size: 18px; font-weight: 700; color: #9A6A22; }
.income-row__amount.is-green { color: var(--k-green); }
.income-row__amount.is-blue { color: var(--k-indigo); }
.income-row__amount.is-red { color: var(--k-alert); }
.income-row__meta { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
.income-row__store { flex: 1; min-width: 0; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
.income-row__hint { display: flex; align-items: center; justify-content: space-between; gap: 6px; margin-top: 4px; padding-top: 8px; border-top: 1px dashed var(--k-line); font-size: 12px; color: var(--k-ink); }
.more { margin-top: 12px; }

.income { --k-bg:#FCF9F5; background:linear-gradient(180deg,#FCF9F5,#F8F7F4); }
.summary { border:1px solid rgba(160,120,80,.08); border-radius:20px; padding:22px 18px 16px; box-shadow:0 5px 18px rgba(120,84,48,.04); }
.summary__label { font-size:14px; }.summary__total { color:var(--k-red-deep); font-size:38px; margin:3px 0 7px; font-weight:600; }
.summary__row { margin-top:18px; border-top:1px solid var(--k-line); gap:0; padding-top:15px; }.summary__cell { background:transparent; padding:0 12px; border-radius:0; }.summary__cell + .summary__cell { border-left:1px solid var(--k-line); }.summary__cell:first-child { padding-left:0; }.summary__num { font-size:23px; font-weight:600; }
.note { font-size:12px; background:#F3EDE2; padding:12px; }.chips { margin:21px 0 13px; }
.income-row { border:1px solid rgba(160,120,80,.07); padding:17px 14px; border-radius:17px; gap:8px; box-shadow:0 4px 16px rgba(120,84,48,.035); }.income-row__title { font-size:16px; }.income-row__amount { font-size:21px; }.income-row__hint { border-top-style:solid; font-size:13px; padding-top:11px; }.state { padding:50px 20px; }

</style>
