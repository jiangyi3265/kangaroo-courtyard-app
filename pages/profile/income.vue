<template>
  <view class="k-page income" :class="$userSurface">
    <k-topbar title="我的收入" back />
    <view class="k-body k-pad-safe">
      <view class="summary">
        <text class="summary__label">已确认到账合计</text>
        <text class="summary__total"><text v-if="String(totals.confirmed || '¥0').startsWith('¥')" class="summary__yen">¥</text>{{ String(totals.confirmed || '¥0').replace(/^¥/, '') }}</text>
        <text class="k-tiny">共 {{ totals.confirmedCount || 0 }} 笔 · 以你在任务里点了「确认收款」为准</text>
        <view class="summary__row">
          <view class="summary__cell" hover-class="k-press" @click="pick('pending')"><text class="k-meta">待到账</text><text class="summary__num"><text v-if="String(totals.pending || '¥0').startsWith('¥')" class="summary__yen">¥</text>{{ String(totals.pending || '¥0').replace(/^¥/, '') }}</text><text class="k-tiny">{{ totals.pendingCount || 0 }} 笔 · 含门店已登记打款</text></view>
          <view class="summary__cell" hover-class="k-press" @click="pick('disputed')"><text class="k-meta">申诉中</text><text class="summary__num" :class="{ 'summary__num--red': hasDispute }"><text v-if="String(totals.disputed || '¥0').startsWith('¥')" class="summary__yen">¥</text>{{ String(totals.disputed || '¥0').replace(/^¥/, '') }}</text><text class="k-tiny">{{ totals.disputedCount || 0 }} 笔</text></view>
        </view>
      </view>
      <view class="note"><k-icon name="info" :size="14" color="red" /><text>{{ note }}</text></view>

      <view class="chips">
        <k-chip v-for="chipItem in CHIPS" :key="chipItem.value" pill :selected="status === chipItem.value" @click="pick(chipItem.value)"><text>{{ chipItem.label }}</text></k-chip>
      </view>

      <view v-if="loading && !rows.length" class="state"><text class="k-meta">正在读取收入记录…</text></view>
      <view v-else-if="error" class="state"><text>{{ error }}</text><k-button type="ghost" size="sm" label="重新加载" @click="load(false)" /></view>
      <view v-else-if="!rows.length" class="state">
        <view class="state__ico"><k-icon name="wallet-cards" :size="32" color="red" /></view>
        <text class="state__title">{{ emptyParts[0] }}</text><text class="k-meta state__desc">{{ emptyParts[1] }}</text>
        <k-button v-if="status === 'all'" type="secondary" size="sm" label="看看线上任务" @click="go(R.jobsList + '?type=online')" />
      </view>
      <view v-for="incomeRow in rows" :key="incomeRow.settleNo || incomeRow.appId" class="income-row" hover-class="k-press-s" @click="openTask(incomeRow)">
        <view class="income-row__head">
          <text class="income-row__title">{{ incomeRow.title }}</text>
          <text class="income-row__amount" :class="'is-' + incomeRow.tone"><text v-if="String(incomeRow.amount || '').startsWith('¥')" class="income-row__yen">¥</text>{{ String(incomeRow.amount || '').replace(/^¥/, '') }}</text>
        </view>
        <view class="income-row__meta">
          <text class="k-meta income-row__store">{{ [incomeRow.storeName, incomeRow.method].filter(Boolean).join(' · ') }}</text>
          <k-chip :tone="incomeRow.tone"><text>{{ incomeRow.statusLabel }}</text></k-chip>
        </view>
        <text v-if="incomeRow.dates" class="k-tiny">{{ incomeRow.dates }}</text>
        <view v-if="incomeRow.status !== 'confirmed' && incomeRow.hint" class="income-row__hint"><text>{{ incomeRow.hint }}</text><k-icon name="chevron-right" :size="12" color="muted" /></view>
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
// 11-18 第四轮（纯展示）：空状态按第一个「。」拆成标题 + 说明两层，字和标点不变；只有一句时说明为空（样式里空元素不占位）
const emptyParts = computed(() => {
  const text = emptyText.value || ''
  const cut = text.indexOf('。') + 1
  return cut > 0 && cut < text.length ? [text.slice(0, cut), text.slice(cut)] : [text, '']
})

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

/* 2026-11-17 改版「小而精」（主人按样张第三版拍板）：浅灰底、白卡 12 圆角、不描边不加阴影，数字和字收小一档。功能和文字不变：合计、待到账 / 申诉中、筛选、每笔记录、加载更多都在；金额和状态文案不动 */
.income { --k-bg:var(--k-page); --k-radius:12px; background:var(--k-page); font-size:13px; }
.income :deep(.k-navbar__title) { font-family:var(--k-sans); font-size:16px; font-weight:600; }
.income .k-body { padding-top:8px; padding-left:12px; padding-right:12px; }
.income :deep(.k-button) { border-radius:999px; }
/* 不能点的按钮（加载中）：11-18 第二轮起交给公共组件 —— 原配色整体 .45，不再盖成冷灰块 */
.summary { gap:2px; padding:14px 12px 12px; border:0; border-radius:12px; box-shadow:none; }
.summary__label { font-size:12px; }
.summary__total { margin:2px 0 4px; font-size:28px; font-weight:700; }
.summary__row { margin-top:12px; padding-top:12px; }
.summary__num { font-size:17px; font-weight:700; }
.note { margin-top:8px; padding:8px 12px; border-radius:8px; background:#FFF8EE; color:var(--k-ink2); }
.chips { margin:12px 0 4px; }
.state { padding:44px 20px; }
.income-row { gap:4px; margin-top:8px; padding:12px; border:0; border-radius:12px; box-shadow:none; }
.income-row__title { font-size:14px; font-weight:600; }
.income-row__amount { font-size:16px; }
.income-row__hint { padding-top:8px; font-size:12px; color:var(--k-ink2); }
.more { margin-top:8px; }
/* 2026-11-18 评审修正：「全部 / 待到账 / 已到账 / 申诉中」筛选胶囊和心愿、会员权益页一个样子 —— 白底、28 高、12 字，选中是浅棕底 + 深棕字、不描边（之前米色底、32 高、选中带一圈描边）；
   上下各用 4 的透明区把点按范围撑回 36 */
.chips :deep(.k-chip.is-pill) { position:relative; height:28px; padding:0 12px; background:var(--k-paper); font-size:12px; }
.chips :deep(.k-chip.is-pill)::after { content:""; position:absolute; left:0; right:0; top:-4px; bottom:-4px; }
.chips :deep(.k-chip.is-pill.is-selected) { border-color:transparent; background:var(--k-red-soft); color:var(--k-red-deep); }
/* 11-18 第二轮精修（只动样子） */
/* 1) 数字等宽：合计、两格和每笔金额；两格数字 18 / 700 墨色，说明收成 11 灰 */
.summary__total, .summary__num, .income-row__amount { font-variant-numeric:tabular-nums; }
.summary__num { font-size:18px; font-weight:700; color:var(--k-ink); }
.summary__cell .k-meta { font-size:11px; }
/* 2) 每笔记录底下的提示行：上边线改成发丝线 */
.income-row__hint { position:relative; border-top:0; }
.income-row__hint::before { content:""; position:absolute; left:0; right:0; top:0; height:1px; background:var(--k-line); transform:scaleY(.5); transform-origin:0 0; }
/* 3) 读取中 / 出错 / 没有记录：放进白卡里居中（图标 36 灰、出错原因 14 / 500 二级墨、说明 12 灰行高 1.6），按钮是 32 高的次按钮小胶囊 */
.state { gap:8px; margin-top:8px; padding:28px 12px; border-radius:12px; background:var(--k-paper); }
.state > text:not(.k-meta) { font-size:14px; font-weight:500; color:var(--k-ink2); }
.state .k-meta { font-size:12px; line-height:1.6; }
.state :deep(.k-button) { height:32px; padding:0 16px; border-radius:16px; border-color:var(--k-red-line); background:var(--k-paper); color:var(--k-red-deep); font-size:13px; font-weight:500; }

/* 11-18 第三轮：页边距 16；汇总卡里「¥」小一号：总额 ¥ 14 / 600 + 数字 28 / 700，下面两格 ¥ 12 + 数字 18 / 700，都用等宽数字；
   空状态图标放进 56 浅棕方块（32 号暖棕线性图标） */
.income .k-body { padding-left: 16px; padding-right: 16px; }
.summary__total { font-size: 28px; font-weight: 700; line-height: 36px; font-variant-numeric: tabular-nums; }
.summary__total .summary__yen { margin-right: 2px; font-size: 14px; font-weight: 600; }
.summary__num { font-size: 18px; font-weight: 700; line-height: 25px; font-variant-numeric: tabular-nums; }
.summary__num .summary__yen { margin-right: 1px; font-size: 12px; font-weight: 600; }
.income-row__amount { font-variant-numeric: tabular-nums; }
.state__ico { display: flex; align-items: center; justify-content: center; width: 56px; height: 56px; margin-bottom: 4px; border-radius: 16px; background: var(--k-red-soft); }
.state .k-meta { max-width: 264px; text-align: center; }
/* 11-18 第三轮返修：
   · 区块节奏统一：合计卡 → 提示条 12、提示条 → 筛选 16、筛选 → 列表 12；
   · 合计副行一行放不下就省略号，提示条按整句均衡断行、最宽 260，不留孤字；
   · 列表金额统一墨色 700，到没到账只靠右边的状态胶囊表示（颜色不再用两遍）；
   · 320 宽：行内提示 12 号、门店名一行省略 */
.summary > .k-tiny { display: block; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
.note { margin-top: 12px; }
.note > text { max-width: 260px; text-wrap: balance; word-break: keep-all; }
.summary__cell .k-tiny { display: block; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
.chips { margin: 16px 0 0; }
.chips + .state, .chips ~ .income-row:first-of-type { margin-top: 12px; }
.income-row__amount, .income-row__amount[class*="is-"] { font-weight: 700; color: var(--k-ink); }
.income-row__store { flex: 1; min-width: 0; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
.income-row__hint > text { text-wrap: balance; word-break: keep-all; }
@media (max-width: 359px) {
  .income-row__hint { font-size: 12px; }
}
/* 11-18 返修（第 2 轮）：列表金额和汇总卡一个写法 ——「¥」12 / 600，数字 16 / 700、等宽数字 */
.income-row__yen { margin-right: 1px; font-size: 12px; font-weight: 600; }
/* 11-18 第三轮返修（第 3 轮）：顶部说明条不再限宽强制折行（之前第一个逗号后就换行、右边空着四成），13 号字一行放得下就一行；320 宽放不下时只在标点处折行（「线下」这类词不拆开），整句太长才在字中间断 */
.note { align-items: center; }
.note > text { flex: 1; min-width: 0; max-width: none; text-wrap: wrap; word-break: normal; font-size: 13px; line-height: 1.6; }
@media (max-width: 359px) { .note > text { word-break: keep-all; overflow-wrap: anywhere; } }
/* 11-18 第三轮返修（第 4 轮）：320 宽「待到账 / 申诉中」下面那行小字放不下时折成两行（最多两行），不再截成省略号；
   只在空格处折（keep-all），「含门店已登记打款」整句落在第二行，不会只剩一个「款」字 */
@media (max-width: 359px) {
  .summary__cell .k-tiny { display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 2; white-space: normal; word-break: keep-all; }
}
/* 合计卡离顶栏 12（和本组其它页一样） */
.k-body.k-pad-safe { padding-top: 12px; }
/* 11-18 第三轮返修（第 5 轮）：320 宽汇总两格按 3 : 2 分，「1 笔 · 含门店已登记打款」一行放得下，不再吊着一个「·」 */
@media (max-width: 359px) {
  .summary__cell:first-child { flex: 3 1 0; }
  .summary__cell + .summary__cell { flex: 2 1 0; }
}
/* 11-18 第四轮（高级感）：
   · 提示条不再是浅杏色块：做成合计卡下面的一行 12 号灰字脚注（14 号 info 图标），只在标点处折行，「收到」不再被拆开；
   · 空状态两层：标题 14 / 500 墨色 + 说明 12 灰（最宽 260），和本组其它空状态一个写法。 */
.note { margin-top: 8px; padding: 0 4px; border-radius: 0; background: transparent; }
.note > text { font-size: 12px; line-height: 1.6; color: var(--k-muted); word-break: keep-all; overflow-wrap: anywhere; }
.chips { margin-top: 20px; }
.state .state__title { max-width: 264px; font-size: 14px; font-weight: 500; line-height: 1.6; color: var(--k-ink); text-align: center; }
.state .state__desc { margin-top: -4px; }
.state .state__desc:empty { display: none; }
/* 11-18 第四轮返修：空状态说明到「看看线上任务」16（flex 间距 8 + 按钮上 8）；记录行「门店 · 支付方式」放不下就折成两行（最多两行），支付方式不再被省略号吃掉 */
.state :deep(.k-button) { margin-top: 8px; }
.income-row__meta { align-items: flex-start; }
.income-row__meta .income-row__store { display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 2; white-space: normal; overflow: hidden; text-overflow: clip; overflow-wrap: anywhere; }
/* 11-19 微信实拍返修：
   · 脚注 info 图标对齐第一行字（不再对着两行中间），左线回到页边 16，和合计卡、筛选胶囊同一条线；
   · 筛选下面的空状态白卡和本组整页状态同一套尺寸：上下内边距 32，图标块 56，图标块到标题 16，按钮上 16。 */
.note { align-items: flex-start; padding: 0; }
.note > :deep(.k-icon) { flex: 0 0 auto; margin-top: 3px; }
.chips + .state { padding-top: 32px; padding-bottom: 32px; }
.chips + .state .state__ico { width: 56px; height: 56px; margin-bottom: 16px; }
</style>
