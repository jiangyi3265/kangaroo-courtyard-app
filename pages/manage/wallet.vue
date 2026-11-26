<template>
  <view class="k-page wallet">
    <k-topbar :title="titles[s - 1]" back custom-back @back="onBack" />
    <k-subscribe scenes="finance" label="订阅结算与提现提醒" />

    <view v-if="s === 1" class="k-body k-pad-tab wallet-page">
      <view class="owner-card" @click="openHonor"><image :src="avatar" mode="aspectFill" /><view><view class="owner-line"><text class="owner-name">{{ w.nickname || '我' }}</text><k-chip v-if="ownerRole" tone="ochre" icon="star"><text>{{ ownerRole }}</text></k-chip></view><text class="owner-days">{{ daysText }}</text></view></view>
      <view class="balance-card"><text class="card-label">可结算余额（元）</text><view class="k-between"><text class="balance">{{ availText }}</text><k-button size="sm" @click="toWithdraw" label="结算" /></view><text v-if="balanceNote" class="account">{{ balanceNote }}</text><text class="account">{{ payeeText }}</text></view>
      <view class="income-grid"><view class="income-card"><text class="card-label">本月收益（{{ w.monthRange }}）</text><text class="income-card__num">{{ monthText }}</text><text class="income-card__meta">较上月 <text class="k-green" :style="w.monthUp ? '' : 'color: var(--k-alert)'">{{ w.monthDelta }}</text></text></view><view class="income-card"><text class="card-label">待结算收益</text><text class="income-card__num">{{ pendingText }}</text><text class="income-card__meta">结算日 {{ w.nextSettle }}</text></view></view>
      <text class="section-title">收益来源占比 <text class="k-meta">（本月）</text></text>
      <view class="source-grid"><view v-for="item in sources" :key="item.label" class="source-card" @click="openEntries(item)"><k-icon :name="item.icon" :size="35" :color="item.color" /><text class="source-card__label">{{ item.label }}</text><text class="source-card__amount" :style="{color:item.hex}">{{ item.amount }}</text><text>{{ item.pct }}</text></view></view>
      <!-- 之前分佣规则屏没有任何入口（只认 ?view=rules，没人带），结算记录藏在明细的类型下拉里，审核结果消息落到本屏后找不到 -->
      <view class="links"><view class="links__item" @click="openEntries({})"><text>收益明细</text><k-icon name="chevron-right" :size="12" color="muted" /></view><view class="links__item" @click="showWithdraws"><text>结算记录</text><k-icon name="chevron-right" :size="12" color="muted" /></view><view class="links__item" @click="s = 4"><text>分佣规则</text><k-icon name="chevron-right" :size="12" color="muted" /></view></view>
      <text v-if="recent" class="section-title recent-title">最近一笔收益</text>
      <view v-if="recent" class="recent"><view class="recent__icon"><k-icon :name="recentIcon" :size="18" color="green" /></view><view class="k-flex1"><text class="recent__name">{{ recent.name }}</text><text class="recent__place">{{ recent.place }}</text></view><view class="recent__right"><text>{{ recent.amount }}</text><text>{{ recent.status }}</text></view></view>
    </view>

    <view v-else-if="s === 2" class="k-pad-tab detail-page">
      <view class="detail-filter"><view class="filter-box" @click="pickType"><text>{{ typeLabel }}</text><k-icon name="chevron-down" :size="15" color="ink" /></view><view class="filter-box filter-box--date" @click="pickRange"><text>{{ rangeText }}</text><k-icon name="calendar-days" :size="17" color="ink" /></view><view class="square" @click="searchNo"><k-icon name="search" :size="20" color="ink" /></view><view class="square square--text" @click="exportEntries"><text>导出</text></view></view>
      <view class="earn-table"><view class="earn-head"><text>订单信息</text><text>收入类型</text><text>订单金额</text><text>分佣率</text><text>到账金额 / 状态</text></view>
        <view v-if="entriesLoading" class="earn-empty"><text>正在加载收益明细…</text></view>
        <view v-else-if="entriesError" class="earn-empty" @click="loadEntries"><text>{{ entriesError }} · 点此重试</text></view>
        <view v-else-if="!rows.length" class="earn-empty"><text>{{ keyword ? '没有找到这个单号' : '这段时间没有收益明细' }}</text></view>
        <view v-for="(row, ri) in rows" :key="row.id + '-' + ri" class="earn-row"><view><text>{{ row.prefix }} {{ row.id }}</text><text>{{ row.time }}</text><text>{{ row.place }}</text></view><text :class="row.tone">{{ row.type }}</text><text>{{ row.order }}</text><text>{{ row.rate }}</text><view class="earn-row__received"><text>{{ row.received }}</text><text>{{ row.status }}</text></view></view></view>
    </view>

    <view v-else-if="s === 3" class="k-body k-pad-tab withdraw-page">
      <view class="withdraw-balance"><view><text>可结算余额</text><text class="withdraw-balance__num">{{ availText }}</text></view><text class="k-red" @click="setAll">全部结算</text></view>
      <view class="withdraw-amount"><view class="k-between"><text>结算金额</text><text @click="setAll">全部结算</text></view><text class="withdraw-amount__num" @click="inputAmount">{{ amountFen ? amountText : '点击输入金额' }}</text><text class="k-meta">可结算余额 {{ availText }}{{ balanceNote ? '（' + balanceNote + '）' : '' }}</text></view>
      <view class="plain-row" @click="payeeInfo"><text>收款账户</text><view class="k-row k-gap8"><k-icon name="landmark" :size="23" color="green" /><text>{{ w.payee || '未登记' }}</text><k-icon name="chevron-right" :size="18" color="muted" /></view></view>
      <view class="fee-card"><view class="k-between"><text>手续费</text><text>¥ 0.00</text></view><view class="fee-card__line" /><text class="k-meta">平台不收取手续费</text></view>
      <view class="plain-row"><text>预计打款时间</text><view class="k-row k-gap6"><text>审核通过后 3 个工作日内线下打款</text><k-icon name="info" :size="15" color="muted" /></view></view>
      <view v-if="smsEnabled" class="code-card"><text class="code-card__title">短信验证码</text><view class="code-line"><view class="code-input" @click="inputCode"><text>{{ smsCode || '请输入短信验证码' }}</text></view><k-button size="md" type="secondary" @click="sendCode" :label="codeCountdown > 0 ? codeCountdown + 's' : '获取验证码'" /></view><text class="k-meta">{{ smsTip }}</text></view>
      <view class="safe"><k-icon name="shield-check" :size="17" color="green" /><text>结算申请由平台审核后线下打款，审核结果与打款凭证可在钱包首页「结算记录」里查看</text></view>
      <k-button block size="md" class="confirm" @click="submitWithdraw" label="提交结算申请" />
    </view>

    <view v-else class="k-body k-pad-tab rules-page">
      <text class="section-title">分佣规则总览</text>
      <view class="rule-list"><view v-for="rule in rules" :key="rule.title" class="rule"><view class="rule__icon"><k-icon :name="rule.icon" :size="31" :color="rule.color" /></view><view class="k-flex1"><text class="rule__title">{{ rule.title }}</text><text class="rule__desc">{{ rule.desc }}</text></view><view class="rule__rate"><text>提成</text><text>{{ rule.rate }}</text></view></view></view>
      <text class="section-title rule-section">营业额提成阶梯规则</text>
      <view class="tier-table"><view class="tier-row tier-row--head"><text>月度营业额（元）</text><text>提成比例</text></view><view v-for="tier in tiers" :key="tier[0]" class="tier-row"><text>{{ tier[0] }}</text><text>{{ tier[1] }}</text></view></view>
      <text v-if="rulesReal" class="section-title rule-section">案例计算</text>
      <view v-if="rulesReal" class="case"><text>{{ rr.exampleIntro }}</text><text v-if="ex[0]">{{ ex[0] }}</text><text v-if="ex[1]">{{ ex[1] }}</text><text v-if="ex[2]">{{ ex[2] }}</text><text class="case__total">{{ rr.exampleTotal }}</text></view>
      <view class="tips"><view v-for="tip in tips" :key="tip.title" class="tip"><k-icon :name="tip.icon" :size="25" color="ink" /><text class="tip__title">{{ tip.title }}</text><view class="tip__line" /><text class="tip__desc">{{ tip.desc }}</text></view></view>
    </view>

    <k-tabbar mode="staff" active="business" />
    <!-- 收益明细自定义区间：先选开始日，再选结束日（之前要手敲 yyyy-MM-dd） -->
    <k-date-picker v-if="rangePick" :title="rangePick === 'from' ? '开始日期' : '结束日期'" :value="rangePick === 'from' ? (from || todayCn()) : (to && to >= rangeFrom ? to : todayCn())" :min-date="rangePick === 'to' ? rangeFrom : ''" :max-date="todayCn()" @cancel="rangePick = ''" @confirm="confirmRange" />
  </view>
</template>

<script setup>
// ---------------------------------------------------------------------------
// 钱包接入情况（只能看本人）：
//   s=1 首页：可结算余额 / 本月收益 / 待结算 / 来源占比 / 最近一笔，全部来自分佣流水（后台配置分佣规则后自动入账）
//   s=2 收益明细：按类型 / 日期 / 单号筛选；「导出」把当前明细复制成表格文本
//   s=3 申请结算：平台不做自动转账、不收手续费；提交后后台审核，财务线下打款并登记凭证
//   s=4 分佣规则：你当前生效的规则与阶梯；没有规则就如实显示「尚未配置」
// ---------------------------------------------------------------------------
import { ref, computed, watch } from 'vue'
import { useScreen, go, back, toast } from '@/common/screen.js'
import { apiWallet, apiWalletEntries, apiWalletRules, apiWalletWithdraw, apiWalletWithdraws, apiMeSmsSend } from '@/common/api.js'
import { ensureSession, experience } from '@/common/experience.js'
import { sheet, prompt, alert, confirm, copy, errText, pickPaged, shiftDate, todayCn, isYmd, yuan, fmtNum } from '@/common/ui.js'
import { absUrl } from '@/common/upload.js'
import R from '@/common/routes.js'

let ready = false
const s = useScreen(4, {
  onLoad: async (q) => {
    if (q?.view === 'entries') s.value = 2
    if (q?.view === 'rules') s.value = 4
    await ensureSession()
    ready = true
    load()
    loadScreen(s.value)
  }
})
const titles = ['我的钱包', '收益明细', '申请结算', '分佣规则']
// 小标签写这个账号实际的角色名（服务端给的）；切换前 isManager 只算换工主理人，切换后也算城市负责人
const ownerRole = computed(() => { if (!w.value.isManager) return ''; const list = (experience.account?.staffGrants || []).filter(g => g.active); return (list.find(g => g.roleCode === 'city_lead') || list.find(g => g.roleCode === 'manager') || {}).roleName || '' })
const onBack = () => { if (s.value > 1) s.value = 1; else back() }
watch(s, (v) => { if (ready) loadScreen(v) })
function loadScreen(v) {
  if (v === 2) loadEntries()
  if (v === 3) load()
  if (v === 4) loadRules()
}
// 千分位走 fmtNum（安卓微信可能缺 ICU，系统本地化格式会显示成 '¥ 1234.5'）；先取整分再除 100，两位小数不会舍错
const fen = (v) => '¥ ' + fmtNum(Math.round(Number(v || 0)) / 100, 2)

// ---------------- s=1 ----------------
const w = ref({ sources: [] })
async function load() {
  try {
    w.value = (await apiWallet()).data || w.value
  } catch (e) {
    toast(errText(e, '钱包加载失败'))
  }
}
// 没有头像时用全站默认头像（袋鼠），之前用的是设计稿里一位员工的照片，看起来像本人
const avatar = computed(() => (w.value.avatar ? absUrl(w.value.avatar) : '/static/media/profile-avatar.jpg'))
const daysText = computed(() => (w.value.days ? `加入袋鼠全球青年第 ${w.value.days} 天` : ''))
// 余额为负（结算后订单退款冲回）：如实显示负数和服务端给的说明，不再只显示 ¥ 0.00
const negative = computed(() => Number(w.value.realAvailableFen) < 0)
const availText = computed(() => fen(negative.value ? w.value.realAvailableFen : w.value.availableFen))
const balanceNote = computed(() => (negative.value ? w.value.balanceNote || '有订单退款冲回，暂不可结算' : ''))
const monthText = computed(() => fen(w.value.monthFen))
const pendingText = computed(() => fen(w.value.pendingFen))
const payeeText = computed(() => (w.value.payee ? '收款账户：' + w.value.payee : '收款账户：未登记（由平台财务按结算协议登记）'))
const SRC_STYLE = { stay: { icon: 'house', color: 'indigo', hex: '#3F5F82' }, shop: { icon: 'coffee', color: 'green', hex: '#4F856C' }, activity: { icon: 'users-round', color: 'ochre', hex: '#A46A1E' }, adjust: { icon: 'wallet-cards', color: 'ink', hex: '#3A322B' } }
const sources = computed(() => {
  const list = (w.value.sources || []).map(x => ({ ...x, ...(SRC_STYLE[x.type] || SRC_STYLE.adjust) }))
  return list.length ? list : [{ type: '', label: '本月暂无收益', amount: '¥ 0.00', pct: '—', ...SRC_STYLE.adjust }]
})
const recent = computed(() => w.value.recent || null)
const recentIcon = computed(() => (recent.value ? (SRC_STYLE[recent.value.type] || SRC_STYLE.adjust).icon : 'coffee'))
const openHonor = () => { if (w.value.isManager) go(R.honor) }
async function toWithdraw() {
  if (!w.value.payee) return alert('收款账户未登记', '结算打款到平台财务登记的收款账户。请先与平台签署结算协议并登记收款账户，登记后即可申请结算。')
  s.value = 3
}
const openEntries = (item) => { type.value = item.type || ''; s.value = 2 }

// ---------------- s=2 ----------------
const TYPES = [['', '全部类型'], ['stay', '营业收入'], ['shop', '二消收入'], ['activity', '活动收入'], ['adjust', '人工调整']]
const type = ref('')
const from = ref('')
const to = ref('')
const keyword = ref('')
const rows = ref([])
const entriesLoading = ref(false)
const entriesError = ref('')
let entriesGeneration = 0
async function loadEntries() {
  const generation = ++entriesGeneration
  entriesLoading.value = true
  entriesError.value = ''
  rows.value = []
  try {
    const d = (await apiWalletEntries({ type: type.value || undefined, from: from.value || undefined, to: to.value || undefined, keyword: keyword.value || undefined })).data
    if (generation !== entriesGeneration) return
    rows.value = d.rows || []
    from.value = d.from
    to.value = d.to
  } catch (e) {
    if (generation === entriesGeneration) entriesError.value = errText(e, '明细加载失败')
  } finally {
    if (generation === entriesGeneration) entriesLoading.value = false
  }
}
const typeLabel = computed(() => (TYPES.find(t => t[0] === type.value) || TYPES[0])[1])
const rangeText = computed(() => (from.value ? `${from.value} ～ ${to.value}` : '本月'))
// 没有明细时整行显示一句提示（见模板 earn-empty），不再塞进「订单信息」那一窄列里折成两行
async function pickType() {
  // 最后一项「结算记录」不是流水类型，而是历次结算申请（待审核 / 待打款 / 已打款 / 已驳回）：用列表 + 详情弹窗展示，不改本页结构
  const i = await sheet([...TYPES.map(t => t[1]), '结算记录'])
  if (i < 0) return
  if (i === TYPES.length) return showWithdraws()
  type.value = TYPES[i][0]
  loadEntries()
}
async function showWithdraws() {
  try {
    const list = (await apiWalletWithdraws()).data || []
    if (!list.length) return alert('结算记录', '还没有提交过结算申请')
    const k = await pickPaged(list.map(w => `${w.time}  ${w.amount}  ${w.statusText}`), '结算记录')
    if (k < 0) return
    const w = list[k]
    alert('结算申请 ' + (w.withdrawNo || ''), [`金额：${w.amount}`, `状态：${w.statusText}`, `申请时间：${w.time}`,
      w.note ? `审核说明：${w.note}` : '', w.voucher ? `打款凭证：${w.voucher}` : ''].filter(Boolean).join('\n'))
  } catch (e) {
    toast(errText(e, '结算记录加载失败'))
  }
}
async function pickRange() {
  const opts = ['本月', '上月', '近 90 天', '自定义…']
  const i = await sheet(opts)
  if (i < 0) return
  const today = todayCn()
  if (i === 0) { from.value = today.slice(0, 8) + '01'; to.value = today }
  if (i === 1) {
    const d = new Date(today.slice(0, 8) + '01T00:00:00')
    d.setDate(0)
    const y = d.getFullYear(), m = String(d.getMonth() + 1).padStart(2, '0')
    from.value = `${y}-${m}-01`
    to.value = `${y}-${m}-${String(d.getDate()).padStart(2, '0')}`
  }
  if (i === 2) { from.value = shiftDate(today, -89); to.value = today }
  if (i === 3) { rangePick.value = 'from'; return }
  loadEntries()
}
const rangePick = ref('')
const rangeFrom = ref('')
function confirmRange(v) {
  if (!v) { rangePick.value = ''; return }
  if (rangePick.value === 'from') { rangeFrom.value = v; rangePick.value = 'to'; return }
  rangePick.value = ''
  from.value = rangeFrom.value
  to.value = v
  loadEntries()
}
async function searchNo() {
  const v = await prompt('按单号查找', { value: keyword.value, placeholder: '订单号 / 报名号（可只输一部分）' })
  if (v === null) return
  keyword.value = v.trim()
  loadEntries()
}
function exportEntries() {
  if (entriesLoading.value) return toast('明细正在加载')
  if (entriesError.value) return toast('请重新加载明细后再导出')
  if (!rows.value.length) return toast('没有可导出的明细')
  const head = '单号\t时间\t门店/摘要\t类型\t计佣基数\t费率\t金额\t状态'
  const body = rows.value.map(r => [r.id, r.time, r.place, r.type, r.order, r.rate, r.received, r.status].join('\t')).join('\n')
  copy(head + '\n' + body, `已复制 ${rows.value.length} 条明细，可粘贴到表格`)
}

// ---------------- s=3 结算 ----------------
const amountFen = ref(0)
const amountText = computed(() => fen(amountFen.value))
// 结算要不要短信验证码由服务端说了算：通道开着（kangaroo.sms.mode != none）
// 且本人绑过手机号才需要，否则这张卡片不显示，流程和以前一样。
const smsEnabled = computed(() => !!w.value.smsEnabled)
const smsCode = ref('')
const codeCountdown = ref(0)
const smsTip = computed(() => (w.value.smsPhone ? '验证码将发送至 ' + w.value.smsPhone : '验证码将发送至你绑定的手机号'))
let codeTimer = null
async function sendCode() {
  if (codeCountdown.value > 0) return
  try {
    // 不传号码：服务端直接发到账号上绑定的手机号，页面从头到尾拿不到完整号码
    const res = await apiMeSmsSend(null, 'withdraw')
    toast((res.data && res.data.message) || '验证码已发送')
    codeCountdown.value = 60
    if (codeTimer) clearInterval(codeTimer)
    codeTimer = setInterval(() => {
      codeCountdown.value -= 1
      if (codeCountdown.value <= 0) clearInterval(codeTimer)
    }, 1000)
  } catch (e) {
    toast(errText(e, '发送失败'))
  }
}
async function inputCode() {
  const v = await prompt('短信验证码', { value: smsCode.value, placeholder: '6 位数字' })
  if (v === null) return
  smsCode.value = v.trim().slice(0, 6)
}
// 单笔结算上下限以服务端为准（KgWalletService.WITHDRAW_MIN_FEN / MAX_FEN，随首页接口下发）；
// 旧版服务端没下发时用同样的 ¥10–¥50,000，提示和校验不再写死一个与后端对不上的 ¥1
const minFen = computed(() => Number(w.value.withdrawMinFen) || 1000)
const maxFen = computed(() => Number(w.value.withdrawMaxFen) || 5000000)
const limitText = computed(() => `¥${yuan(minFen.value)}–¥${yuan(maxFen.value)}`)
const setAll = () => {
  const avail = Number(w.value.availableFen || 0)
  amountFen.value = Math.min(avail, maxFen.value)
  if (avail > maxFen.value) toast(`单次最多结算 ¥${yuan(maxFen.value)}，金额按上限填写`)
}
async function inputAmount() {
  const v = await prompt('结算金额（元）', { value: amountFen.value ? String(amountFen.value / 100) : '', placeholder: `单次 ${limitText.value}，最多两位小数` })
  if (v === null) return
  if (!/^\d+(\.\d{1,2})?$/.test(v.trim())) return toast('请输入正确的金额')
  amountFen.value = Math.round(Number(v.trim()) * 100)
}
const payeeInfo = () => alert('收款账户', (w.value.payee || '未登记') + '\n收款账户由平台财务按结算协议维护，如需变更请在「荣誉与关怀 › 申报」提交。')
let idemKey = ''
// 连点「提交结算申请」会弹两次确认、发两次请求
let submitting = false
async function submitWithdraw() {
  if (!w.value.payee) return toWithdraw()
  if (amountFen.value < minFen.value || amountFen.value > maxFen.value) return toast(`单次结算金额需在 ${limitText.value} 之间`)
  if (amountFen.value > Number(w.value.availableFen || 0)) return toast('超过可结算余额')
  // 之前先弹「确认提交」，点了确认才说缺验证码，白确认一次；现在先查验证码再确认
  if (smsEnabled.value && !/^\d{6}$/.test(smsCode.value)) return toast('请先获取并填写 6 位短信验证码')
  if (submitting) return
  submitting = true
  try {
    if (!(await confirm('提交结算申请', `结算 ${amountText.value} 到 ${w.value.payee}，平台审核通过后 3 个工作日内线下打款。确认提交？`))) return
    if (!idemKey) idemKey = `w-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    const res = await apiWalletWithdraw({ amountFen: amountFen.value, idemKey, code: smsCode.value })
    idemKey = ''
    amountFen.value = 0
    smsCode.value = ''
    toast((res.data && res.data.message) || '结算申请已提交')
    await load()
    s.value = 1
  } catch (e) {
    toast(errText(e, '提交失败'))
  } finally {
    submitting = false
  }
}

// ---------------- s=4 规则 ----------------
const rr = ref({ rules: [], tiers: [], example: [], tips: [] })
async function loadRules() {
  try {
    rr.value = (await apiWalletRules()).data || rr.value
  } catch (e) {
    toast(errText(e, '规则加载失败'))
  }
}
const rulesReal = computed(() => (rr.value.rules || []).length > 0)
const rules = computed(() => (rulesReal.value ? rr.value.rules : [{ title: '尚未配置分佣规则', desc: '以你与平台签署的结算协议为准，规则登记后会显示在这里', rate: '—', icon: 'info', color: 'ink' }]))
const tiers = computed(() => ((rr.value.tiers || []).length ? rr.value.tiers : [['没有阶梯', rulesReal.value ? '按固定费率' : '—']]))
const ex = computed(() => rr.value.example || [])
const tips = computed(() => rr.value.tips || [])
</script>

<style scoped lang="scss">
.section-title { display:block; font-family:var(--k-serif); font-size:17px; font-weight:700; }
.owner-card { height:77px; padding:0 12px; border:1px solid var(--k-line); border-radius:11px; background:var(--k-paper); display:flex; align-items:center; gap:13px; }.owner-card image { width:58px;height:58px;border-radius:50%; }.owner-line { display:flex;align-items:center;gap:10px; }.owner-name { font-family:var(--k-serif);font-size:18px;font-weight:700; }.owner-days { display:block;margin-top:8px;color:var(--k-muted);font-size:13px; }
.balance-card { margin-top:11px;padding:14px 15px;border:1px solid var(--k-line);border-radius:11px;background:var(--k-paper); }.card-label { display:block;font-family:var(--k-serif);font-size:15px;font-weight:700; }.balance { margin-top:10px;color:var(--k-red);font-family:var(--k-sans);font-size:32px; }.account { display:block;margin-top:10px;color:var(--k-muted);font-size:13px; }
.income-grid { display:grid;grid-template-columns:1fr 1fr;gap:9px;margin-top:9px; }.income-card { min-height:82px;min-width:0;padding:12px;border:1px solid var(--k-line);border-radius:10px;background:var(--k-paper); }.income-card__num { display:block;margin-top:13px;color:var(--k-red);font-family:var(--k-sans);font-size:22px; }.income-card__meta { display:block;margin-top:8px;color:var(--k-muted);font-size:12px; }
.income-card .card-label { display:block; font-size:12px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.wallet-page .section-title { margin-top:16px; }.source-grid { display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-top:8px; }.source-card { height:131px;border:1px solid var(--k-line);border-radius:10px;background:var(--k-paper);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:7px;font-size:13px; }.source-card__label { font-family:var(--k-serif);font-size:15px;font-weight:700; }.source-card__amount { max-width:100%;padding:0 4px;font-family:var(--k-sans);font-size:18px;text-align:center;overflow-wrap:anywhere; }.recent-title { margin-top:14px!important; }.recent { height:61px;margin-top:7px;padding:0 12px;border:1px solid var(--k-line);border-radius:10px;background:var(--k-paper);display:flex;align-items:center;gap:12px; }.recent__right { flex-shrink:0; }.recent__name { display:block;font-family:var(--k-serif);font-size:14px;font-weight:700; }.recent__place { display:block;margin-top:5px;color:var(--k-muted);font-size:11px; }.recent__right { text-align:right;color:var(--k-green); }.recent__right text { display:block;font-size:12px; }.recent__right text:first-child { font-family:var(--k-sans);font-size:18px; }

.detail-filter { height:74px;padding:0 12px;display:flex;align-items:center;gap:8px;border-bottom:1px solid var(--k-line); }.filter-box { height:34px;padding:0 10px;border:1px solid var(--k-line);border-radius:7px;display:flex;align-items:center;gap:6px;font-size:12px; }.filter-box--date { flex:1;justify-content:space-between; }.square { width:38px;height:34px;border:1px solid var(--k-line);border-radius:7px;display:flex;align-items:center;justify-content:center; }.square--text { font-size:12px; }.earn-table { border-top:1px solid var(--k-line); }.earn-head,.earn-row { display:grid;grid-template-columns:1.45fr .78fr .82fr .58fr 1.08fr; }.earn-head { height:40px;align-items:center;background:var(--k-paper2);font-size:11px;font-weight:700;text-align:center; }.earn-row { min-height:66px;border-top:1px solid var(--k-line);font-size:11px;align-items:center;text-align:center; }.earn-row > view:first-child { padding-left:11px;text-align:left; }.earn-row > view:first-child text { display:block;margin-top:4px; }.earn-row__received { color:var(--k-green); }.earn-empty { padding:28px 16px;border-top:1px solid var(--k-line);text-align:center;color:var(--k-muted);font-size:13px; }.earn-row__received text { display:block;margin-top:4px;font-weight:700; }

.withdraw-balance,.withdraw-amount,.plain-row,.fee-card,.code-card { border:1px solid var(--k-line);border-radius:10px;background:var(--k-paper); }.withdraw-balance { height:78px;padding:0 14px;display:flex;align-items:center;justify-content:space-between;font-size:14px; }.withdraw-balance__num { display:block;margin-top:8px;color:var(--k-red);font-family:var(--k-sans);font-size:30px; }.withdraw-amount { margin-top:11px;padding:13px 14px;font-size:14px; }.withdraw-amount__num { display:block;margin:13px 0 8px;color:var(--k-red);font-family:var(--k-sans);font-size:30px; }.plain-row { height:48px;margin-top:11px;padding:0 14px;display:flex;align-items:center;justify-content:space-between;font-size:13px; }.fee-card { margin-top:11px;padding:14px;font-size:14px; }.fee-card__line { margin:10px 0;border-top:1px solid var(--k-line); }.code-card { margin-top:11px;padding:13px; }.code-card__title { display:block;font-family:var(--k-serif);font-size:15px;font-weight:700; }.code-line { display:flex;gap:10px;margin:11px 0 8px; }.code-input { flex:1;height:40px;padding:0 11px;border:1px solid var(--k-line);border-radius:7px;display:flex;align-items:center;color:var(--k-muted);font-size:12px; }.safe { display:flex;align-items:center;gap:7px;margin:12px 7px;color:var(--k-muted);font-size:11px; }/* 之前 translateY(-18px) 只挪画面不让位，把上面两行说明压住小半截（按下时 :active 的 scale 还会顶掉它，按钮跳 18px）；改回正常排版间距 */.confirm { margin-top:16px; }

.rule-list { display:flex;flex-direction:column;gap:9px;margin-top:8px; }.rule { height:62px;padding:0 12px;border:1px solid var(--k-line);border-radius:10px;background:var(--k-paper);display:flex;align-items:center;gap:12px; }.rule__icon { width:42px;height:42px;border:1px solid var(--k-line);border-radius:50%;display:flex;align-items:center;justify-content:center; }.rule__title { display:block;font-family:var(--k-serif);font-size:15px;font-weight:700; }.rule__desc { display:block;margin-top:5px;color:var(--k-muted);font-size:10px; }.rule__rate { text-align:right; }.rule__rate text { display:block;color:var(--k-muted);font-size:11px; }.rule__rate text:last-child { margin-top:5px;color:var(--k-red);font-family:var(--k-sans);font-size:22px; }.rule-section { margin-top:15px; }.tier-table { margin-top:7px;border:1px solid var(--k-line);border-radius:9px;overflow:hidden; }.tier-row { height:29px;display:grid;grid-template-columns:1fr 1fr;border-top:1px solid var(--k-line);text-align:center;align-items:center;font-size:13px; }.tier-row:first-child { border-top:0; }.tier-row text+text { border-left:1px solid var(--k-line); }.tier-row--head { background:var(--k-paper2);font-weight:700; }.tier-row:not(.tier-row--head) text:last-child { color:var(--k-red);font-family:var(--k-sans);font-size:16px;font-weight:700; }.case { margin-top:7px;padding:8px 10px;border:1px solid var(--k-line);border-radius:9px;background:var(--k-paper);display:flex;flex-direction:column;gap:5px;font-size:9px; }.case__total { color:var(--k-red);font-size:13px;font-weight:700; }.tips { display:grid;grid-template-columns:repeat(3,1fr);gap:7px;margin-top:9px; }.tip { min-height:86px;padding:8px 9px;border:1px solid var(--k-line);border-radius:9px;background:var(--k-paper); }.tip__title { margin-left:7px;font-family:var(--k-serif);font-size:14px;font-weight:700; }.tip__line { margin:6px 0;border-top:1px solid var(--k-line); }.tip__desc { color:var(--k-muted);font-size:10px;line-height:1.45; }
.links { display:flex;gap:8px;margin-top:10px; }.links__item { flex:1;height:34px;border:1px solid var(--k-line);border-radius:8px;background:var(--k-paper);display:flex;align-items:center;justify-content:center;gap:2px;font-size:13px; }

/* 2026-11-17 改版「小而精」（主人按样张第三版拍板）：浅灰底 + 白卡 12 圆角、不描边不加阴影；余额 26 / 700 只它用主色，其余金额 16–20 / 700 深色字，标签 11–12 灰字。
   只改样子：头像卡、结算按钮、本月 / 待结算、来源占比、三个入口、最近一笔、明细筛选和导出、申请结算各项、分佣规则都在；较上月的颜色判断没动。
   下面每条都带 .wallet，盖住上面的旧值。 */
@import './manage-refine.scss';
.wallet .section-title { font-family: var(--k-sans); font-size: 15px; font-weight: 700; line-height: 22px; }
.wallet .section-title .k-meta { font-weight: 400; }
.wallet .owner-card { gap: 12px; height: auto; padding: 12px; border: 0; border-radius: 12px; }
.wallet .owner-card image { width: 48px; height: 48px; }
.wallet .owner-line { gap: 8px; }
.wallet .owner-name { font-family: var(--k-sans); font-size: 16px; font-weight: 700; }
.wallet .owner-days { margin-top: 4px; font-size: 12px; }
.wallet .balance-card { margin-top: 8px; padding: 14px 12px 12px; border: 0; border-radius: 12px; background: linear-gradient(180deg, #FFF8EE, var(--k-paper) 70%); }
.wallet .card-label { font-family: var(--k-sans); font-size: 12px; font-weight: 400; color: var(--k-muted); }
.wallet .balance { margin-top: 4px; font-size: 26px; font-weight: 700; line-height: 34px; }
.wallet .account { margin-top: 6px; font-size: 11px; line-height: 16px; }
.wallet .income-grid { gap: 8px; margin-top: 8px; }
.wallet .income-card { min-height: 0; border: 0; border-radius: 12px; }
.wallet .income-card__num { margin-top: 4px; color: var(--k-ink); font-size: 20px; font-weight: 700; line-height: 26px; }
.wallet .income-card__meta { margin-top: 2px; font-size: 11px; }
.wallet .source-card { gap: 3px; height: auto; padding: 14px 4px 12px; border: 0; border-radius: 12px; font-size: 11px; color: var(--k-muted); }
.wallet .source-card :deep(.k-icon) { width: 24px !important; height: 24px !important; margin-bottom: 3px; }
.wallet .source-card__label { font-family: var(--k-sans); font-size: 12px; font-weight: 400; color: var(--k-ink2); }
.wallet .source-card__amount { font-size: 16px; font-weight: 700; line-height: 22px; }
.wallet .recent { gap: 10px; height: auto; min-height: 60px; margin-top: 8px; padding: 10px 12px; border: 0; border-radius: 12px; }
.wallet .recent :deep(.k-icon) { width: 24px !important; height: 24px !important; }
.wallet .recent__name { font-family: var(--k-sans); font-size: 14px; font-weight: 600; }
.wallet .recent__place { margin-top: 2px; }
.wallet .recent__right text { font-size: 11px; }
.wallet .recent__right text:first-child { font-size: 16px; font-weight: 700; }
/* 收益明细：筛选是白色小框，表格整块白底、表头浅灰 */
.wallet .detail-filter { align-items: stretch; gap: 6px; height: auto; padding: 10px 12px; border-bottom: 0; }
.wallet .filter-box, .wallet .square { height: auto; min-height: 34px; padding: 0 8px; border: 0; border-radius: 10px; background: var(--k-paper); }
/* 日期区间一长（2026-11-01 ～ 2026-11-18）一行放不下：字小一号，窄屏折成两行时框跟着长高，不再挤出框 */
.wallet .filter-box--date { min-width: 0; font-size: 11px; line-height: 15px; }
.wallet .filter-box :deep(.k-icon) { width: 13px !important; height: 13px !important; }
.wallet .square { width: 34px; padding: 0; }
.wallet .square :deep(.k-icon) { width: 16px !important; height: 16px !important; }
.wallet .square--text { width: auto; padding: 0 8px; color: var(--k-red-deep); }
.wallet .earn-table { border-top: 0; background: var(--k-paper); }
.wallet .earn-head { height: 34px; background: var(--k-bg); color: var(--k-muted); font-weight: 400; }
.wallet .earn-row { min-height: 64px; padding: 6px 0; }
.wallet .earn-row text { overflow-wrap: anywhere; }
.wallet .earn-row > view:first-child { padding-left: 12px; }
.wallet .earn-empty { border-top: 0; font-size: 12px; }
/* 申请结算 */
.wallet .withdraw-balance, .wallet .withdraw-amount, .wallet .plain-row, .wallet .fee-card, .wallet .code-card { border: 0; border-radius: 12px; }
.wallet .withdraw-balance { height: auto; padding: 12px; font-size: 12px; color: var(--k-muted); }
.wallet .withdraw-balance .k-red { font-size: 13px; color: var(--k-red-deep); }
.wallet .withdraw-balance__num { margin-top: 2px; font-size: 26px; font-weight: 700; line-height: 34px; }
.wallet .withdraw-amount { margin-top: 8px; padding: 12px; font-size: 13px; }
.wallet .withdraw-amount__num { margin: 8px 0 6px; font-size: 26px; font-weight: 700; line-height: 34px; }
.wallet .plain-row { gap: 10px; height: auto; min-height: 48px; margin-top: 8px; padding: 8px 12px; }
.wallet .plain-row > text { flex-shrink: 0; }
.wallet .plain-row :deep(.k-icon) { width: 16px !important; height: 16px !important; }
.wallet .fee-card { margin-top: 8px; padding: 12px; font-size: 13px; }
.wallet .code-card { margin-top: 8px; padding: 12px; }
.wallet .code-card__title { font-family: var(--k-sans); font-size: 14px; font-weight: 600; }
.wallet .code-input { border-color: var(--k-line2); border-radius: 10px; font-size: 13px; }
.wallet .safe { align-items: flex-start; margin: 12px 4px; line-height: 16px; }
.wallet .safe :deep(.k-icon) { width: 13px !important; height: 13px !important; margin-top: 1px; }
.wallet .confirm { margin-top: 12px; }
/* 分佣规则 */
.wallet .rule-list { gap: 8px; }
.wallet .rule { gap: 10px; height: auto; min-height: 60px; padding: 10px 12px; border: 0; border-radius: 12px; }
.wallet .rule__icon { flex: 0 0 auto; width: 38px; height: 38px; border: 0; border-radius: 11px; background: linear-gradient(145deg, #FCF4E8, #F4E4CC); }
.wallet .rule__icon :deep(.k-icon) { width: 20px !important; height: 20px !important; }
.wallet .rule__title { font-family: var(--k-sans); font-size: 14px; font-weight: 600; }
.wallet .rule__desc { margin-top: 2px; font-size: 11px; line-height: 16px; }
.wallet .rule__rate { flex: 0 0 auto; }
.wallet .rule__rate text:last-child { margin-top: 0; font-size: 18px; font-weight: 700; line-height: 24px; }
.wallet .rule-section { margin-top: 16px; }
.wallet .tier-table { margin-top: 8px; border: 0; border-radius: 12px; background: var(--k-paper); }
.wallet .tier-row { height: 36px; font-size: 12px; }
.wallet .tier-row text + text { border-left: 0; }
.wallet .tier-row--head { background: transparent; color: var(--k-muted); font-size: 11px; font-weight: 400; }
.wallet .tier-row:not(.tier-row--head) text:last-child { font-size: 14px; }
.wallet .case { gap: 4px; margin-top: 8px; padding: 12px; border: 0; border-radius: 12px; color: var(--k-ink2); font-size: 11px; line-height: 16px; }
.wallet .case__total { font-size: 13px; }
.wallet .tips { gap: 8px; margin-top: 12px; }
.wallet .tip { padding: 10px; border: 0; border-radius: 12px; }
.wallet .tip :deep(.k-icon) { width: 18px !important; height: 18px !important; }
.wallet .tip__title { margin-left: 5px; font-family: var(--k-sans); font-size: 13px; font-weight: 600; }
.wallet .tip__desc { font-size: 11px; line-height: 16px; }
/* 2026-11-18 复查 */
/* 1) 「本月收益（11.01–11.18）」屏幕一窄就被截成「11.01–1…」：字收到 11；再窄（320）折成两行，两张卡的标题留一样高，下面的金额仍然对齐 */
.wallet .income-card .card-label { font-size: 11px; line-height: 16px; }
@media (max-width: 340px) { .wallet .income-card .card-label { min-height: 32px; white-space: normal; } .wallet .income-card__num { font-size: 18px; } }
/* 金额上了万、屏幕又窄时，「¥」和数字被拆成两行：窄屏金额收小一号，保持一行 */
@media (max-width: 374px) { .wallet .source-card__amount { font-size: 15px; } }
@media (max-width: 340px) { .wallet .source-card__amount { padding: 0 2px; font-size: 13px; } }
/* 分佣规则底部三张小卡：窄屏标题被挤成「结算周 / 期」。标题不许折行，窄屏把图标和字收小一号 */
.wallet .tip__title { white-space: nowrap; }
@media (max-width: 340px) { .wallet .tip { padding: 10px 8px; } .wallet .tip :deep(.k-icon) { width: 15px !important; height: 15px !important; } .wallet .tip__title { margin-left: 4px; font-size: 12px; } }
/* 2) 申请结算是填写页，字不改小：还原回原来的字号（白卡、圆角、底色照新样子）。「点击输入金额」和填好的金额是同一行字，用中等粗细，提示语不至于太抢眼 */
.wallet .withdraw-balance { color: var(--k-ink2); font-size: 14px; }
.wallet .withdraw-balance .k-red { font-size: 14px; }
.wallet .withdraw-balance__num, .wallet .withdraw-amount__num { font-size: 30px; font-weight: 600; line-height: 38px; }
.wallet .withdraw-amount__num { font-weight: 500; }
.wallet .withdraw-amount, .wallet .fee-card { font-size: 14px; }
.wallet .code-card__title { font-size: 15px; }
/* 3) 两处「全部结算」是文字自己在接点击，只有一行字那么高：用透明内边距把能点的范围撑到 36 以上（负外边距抵掉，位置不变）；明细页的筛选框上下各补 2 */
.wallet .withdraw-balance > .k-red, .wallet .withdraw-amount > .k-between > text:last-child { padding: 9px 0 9px 14px; margin: -9px 0 -9px -14px; }
.wallet .filter-box, .wallet .square { position: relative; }
.wallet .filter-box::after, .wallet .square::after { content: ""; position: absolute; left: 0; right: 0; top: -2px; bottom: -2px; }
.wallet .square::after { left: -2px; right: -2px; }
/* 4) 明细页的日期区间：屏宽 360 左右时一行差一点放不下，从第二个日期中间断开（「2026-11- / 18」）。
   屏不够宽时几个筛选框挨紧一点；再窄（375 以下）就固定在「～」后面换行，两个日期各占一行 */
@media (max-width: 389px) { .wallet .detail-filter { gap: 4px; } .wallet .filter-box { padding: 0 6px; } }
@media (max-width: 374px) { .wallet .filter-box--date > text { max-width: 90px; } }
/* 2026-11-18 第二轮精修（精修词典：同一种东西全站一个样子；只改样子，头像卡、结算、来源、三个入口、明细、申请结算、分佣规则都在） */
/* 1) 区块标题统一 16 / 700 */
.wallet .section-title { font-size: 16px; line-height: 22px; color: var(--k-ink); }
/* 2) 来源三格的金额统一墨色（颜色是脚本写在行内的，只能 !important 盖），只让上面的图标保留颜色来区分 */
.wallet .source-card__amount { color: var(--k-ink) !important; }
/* 3) 最近一笔：图标放进 36 的浅绿圆角方块（模板只加了一层包裹，图标 18） */
.wallet .recent__icon { flex: 0 0 auto; width: 36px; height: 36px; border-radius: 10px; background: var(--k-green-soft); display: flex; align-items: center; justify-content: center; }
.wallet .recent .recent__icon :deep(.k-icon) { width: 18px !important; height: 18px !important; }
/* 4) 320 宽「本月收益（2026年11月）」折两行时不再被截成省略号 */
@media (max-width: 340px) { .wallet .income-card .card-label { overflow: visible; text-overflow: clip; } }
/* 5) 收益明细：表头白底（和表格一体，不再像飘在灰底上），行线改发丝线；到账金额绿色等宽，下面的「已入账 / 待结算」退成灰色说明字 */
.wallet .earn-head { background: var(--k-paper); }
.wallet .earn-row { position: relative; border-top: 0; }
.wallet .earn-row::before { content: ""; position: absolute; left: 12px; right: 0; top: 0; height: 1px; background: var(--k-line); transform: scaleY(.5); }
.wallet .earn-row__received text:first-child { font-variant-numeric: tabular-nums; }
.wallet .earn-row__received text:last-child { font-size: 11px; font-weight: 400; color: var(--k-muted); }
/* 6) 申请结算（填写页，字号不动）：第二个「全部结算」和上面那个一样是深棕文字链；可结算余额改墨色，暖棕只留给要填的金额，一屏一个重点 */
.wallet .withdraw-amount > .k-between > text:last-child { color: var(--k-red-deep); }
.wallet .withdraw-balance__num { color: var(--k-ink); }
/* 7) 分佣规则：三行合成一张白卡，行间发丝线（从标题左边缘画起：12 + 图标 38 + 间距 10）；阶梯表行线改发丝线；案例正文 12 号 */
.wallet .rule-list { gap: 0; border-radius: 12px; background: var(--k-paper); overflow: hidden; }
.wallet .rule { position: relative; border-radius: 0; background: transparent; }
.wallet .rule + .rule::before { content: ""; position: absolute; left: 60px; right: 0; top: 0; height: 1px; background: var(--k-line); transform: scaleY(.5); }
.wallet .tier-row { position: relative; border-top: 0; }
.wallet .tier-row + .tier-row::before { content: ""; position: absolute; left: 12px; right: 12px; top: 0; height: 1px; background: var(--k-line); transform: scaleY(.5); }
.wallet .case { font-size: 12px; line-height: 18px; }
/* 8) 剩下几条 1px 通栏分隔线（手续费卡、底部三张小卡）也改成发丝线 */
.wallet .fee-card__line, .wallet .tip__line { height: 1px; border-top: 0; background: var(--k-line); transform: scaleY(.5); }
/* 9) 明细没有数据时按词典的空状态：标题 14 / 500 / ink2，上下留白 28 */
.wallet .earn-empty { padding: 28px 12px; font-size: 14px; font-weight: 500; color: var(--k-ink2); }
</style>
