<template>
  <view class="k-page settlement-page">
    <k-topbar title="账单与结算" back :fab="false" />
    <view class="content">
      <text class="store-name">{{ currentStaffStore?.storeName }}</text>
      <view class="tabs"><view v-for="tab in tabs" :key="tab[0]" :class="{ active: kind === tab[0] }" hover-class="k-press" @click="filter(tab[0])"><text>{{ tab[1] }}</text></view></view>
      <text v-if="error" class="error">{{ error }}</text>
      <template v-if="detail">
        <k-button type="ghost" label="返回账单列表" @click="showList" />
        <view class="section">
          <text class="title">{{ detail.title }}</text><text class="hint">{{ state(detail) }}</text>
          <template v-if="detail.kind === 'stay' && detail.orderNo">
            <view class="line"><text>订单号</text><text>{{ detail.orderNo }}</text></view>
            <view class="line"><text>入住 → 离店</text><text>{{ stayDates(detail) }}</text></view>
            <view v-if="detail.guestName" class="line"><text>客人</text><text>{{ detail.guestName }}</text></view>
          </template>
          <view class="line"><text>{{ detail.kind === 'stay' ? '商家结算价' : '工资 / 首月底薪' }}</text><text>{{ money(detail.baseFen) }}</text></view>
          <view class="line"><text>{{ detail.directFeeFree ? '平台服务费 · 自营免收' : '平台服务费 · ' + detail.rateBp / 100 + '%' }}</text><text>{{ money(detail.feeFen) }}</text></view>
          <view v-if="detail.kind !== 'stay'" class="line"><text>工作人员实得</text><text>{{ money(detail.workerNetFen) }}</text></view>
          <view v-if="detail.workDate" class="line"><text>工作日期</text><text>{{ detail.workDate }}</text></view>
          <view v-if="detail.kind === 'stay'" class="line"><text>实际收款减退款</text><text>{{ money(detail.netFen) }}</text></view>
          <view v-if="detail.targetFen != null" class="line"><text>已核对金额</text><text>{{ money(detail.targetFen) }}</text></view>
          <view class="line"><text>{{ detail.kind === 'stay' ? '已付商家净额' : '已收服务费' }}</text><text>{{ money(detail.recordedFen) }}</text></view>
          <view v-if="detail.remainingFen != null" class="line"><text>待处理金额</text><text>{{ money(detail.remainingFen) }}</text></view>
          <view v-if="detail.discountFen > 0" class="line"><text>{{ detail.discountLabel || '订单优惠' }}</text><text>{{ money(detail.discountFen) }}</text></view>
          <text v-if="detail.directFeeFree" class="hint">自营房源免平台服务费。按当前剩余实收试算：商家应收 {{ money(detail.suggestTargetFen) }}，服务费 {{ money(detail.currentServiceFeeFen) }}；退款后须平台重新核对。</text>
          <text v-else-if="detail.merchantFeePolicy" class="hint">本单沿用原规则，实收房费内扣5%服务费。按当前剩余实收试算：商家应收 {{ money(detail.suggestTargetFen) }}，服务费 {{ money(detail.currentServiceFeeFen) }}；退款后须平台重新核对。</text>
          <text v-else-if="detail.discountFen > 0" class="hint">{{ detail.discountShared ? '折扣已按比例分摊到商家结算价和平台服务费。' : '这笔优惠由平台核对后确认你的应收金额。' }}</text>
          <text v-if="detail.basis" class="hint">{{ detail.basis }}</text>
          <text class="hint">{{ detail.kind === 'stay' ? (detail.directFeeFree ? '退房完成后可提现到微信零钱。商家实得为剩余实收房费，不扣平台服务费；退款后的金额须由平台重新核对。' : detail.merchantFeePolicy ? '退房完成后可提现到微信零钱。本单按原规则扣除5%服务费；退款后的金额须由平台重新核对。' : '本单按订单生成时的结算规则。长住优惠等折扣按客人实付比例分摊；退款产生的金额差异由平台核对。') : '服务费从工资中扣除，商家代扣后交给平台。' }}</text>
        </view>
        <view v-if="detail.kind === 'stay'" class="section">
          <text class="title">微信提现</text>
          <view class="line"><text>可提现金额</text><text>{{ money(detail.withdrawableFen || 0) }}</text></view>
          <view v-if="detail.withdrawingFen > 0" class="line"><text>提现处理中</text><text>{{ money(detail.withdrawingFen) }}</text></view>
          <text v-if="!detail.withdrawEnabled" class="hint">本店微信零钱提现待开通，请联系平台完成转账配置。</text>
          <template v-else-if="detail.withdrawableFen > 0">
            <text class="hint">到账账户为当前登录商家本人的微信零钱。</text>
            <text class="field-label">提现金额（元）</text><input v-model="withdrawYuan" class="input" type="digit" placeholder="填写本次提现金额" :disabled="busy" />
            <template v-if="Number(withdrawYuan) >= 2000"><text class="field-label">收款人姓名</text><input v-model="withdrawName" class="input" maxlength="64" placeholder="与本人微信实名一致" :disabled="busy" /><text class="hint">单笔达到2000元，微信需要核验收款人姓名。</text></template>
            <view class="actions"><k-button :disabled="busy" :label="busy ? '正在处理…' : '提现到微信零钱'" @click="withdraw" /></view>
          </template>
          <view v-for="record in detail.withdrawals" :key="record.withdrawalNo" class="history">
            <view class="line"><text>{{ transferState(record.state) }}</text><text>{{ money(record.amountFen) }}</text></view>
            <text class="hint">{{ record.createTime }} · {{ record.withdrawalNo }}</text>
            <text v-if="record.wxBillNo" class="hint">微信流水 {{ record.wxBillNo }}</text>
            <text v-if="record.failReason" class="hint">{{ transferFailure(record.failReason) }}</text>
            <text v-if="record.errorCode" class="hint">{{ transferError(record.errorCode) }}</text>
            <view v-if="record.owned && !terminal(record.state)" class="actions"><k-button type="outline" :disabled="busy" :label="record.state === 'WAIT_USER_CONFIRM' ? '继续确认收款' : '刷新提现状态'" @click="refreshWithdrawal(record)" /></view>
          </view>
        </view>
        <view class="section"><text class="title">收付款及核对记录</text><view v-for="(log, index) in detail.logs" :key="index" class="history"><text>{{ log.note }}</text><text v-if="log.proof">{{ money(log.amountFen) }} · {{ log.proof }}</text><text class="hint">{{ log.createTime }}</text></view><text v-if="!detail.logs?.length" class="hint">暂无登记记录</text></view>
      </template>
      <template v-else-if="workOpen">
        <view class="section work-form">
          <text class="title">登记工资</text>
          <text class="field-label">已入职人员</text>
          <picker :range="candidateLabels" @change="chooseWorker"><view class="picker-field">{{ selectedWorker ? selectedWorker.realName + ' · ' + selectedWorker.title : '请选择工作人员' }}</view></picker>
          <template v-if="selectedWorker">
            <template v-if="selectedWorker.jobType === 'parttime'"><text class="field-label">实际工作日期</text><picker mode="date" :value="work.workDate" @change="work.workDate = $event.detail.value"><view class="picker-field">{{ work.workDate || '请选择日期' }}</view></picker></template>
            <text class="field-label">{{ selectedWorker.jobType === 'fulltime' ? '首月确认底薪（元）' : '当天确认工资（元）' }}</text>
            <input v-model="work.yuan" class="input" type="digit" placeholder="填写双方确认的金额" />
            <text v-if="preview" class="hint">服务费 {{ money(preview.fee) }}，工作人员实得 {{ money(preview.net) }}</text>
            <text v-if="selectedWorker.jobType === 'fulltime'" class="hint">首月底薪只登记一次。首月未做满的，请填写双方确认的金额，并说明计算依据。</text>
            <text class="field-label">工资确认依据</text><textarea v-model="work.basis" class="input basis" maxlength="1000" placeholder="实际工作、工资或首月底薪的确认情况" />
          </template>
          <view class="actions"><k-button type="outline" label="取消" @click="showList" /><k-button :disabled="busy || !selectedWorker" :label="busy ? '正在保存…' : '保存工资'" @click="saveWork" /></view>
        </view>
      </template>
      <template v-else>
        <text class="hint">自营房源按后台标价销售，不加价、不收平台服务费；合作、加盟、代运营房源按原规则加价5%。退房后按订单账单结算，历史订单保留原规则。兼职每日工资扣 10%，全职首月底薪扣一次 10%。</text>
        <view class="actions"><k-button type="outline" label="刷新" :disabled="loading" @click="load" /><k-button label="登记工资" @click="openWork" /></view>
        <view v-for="bill in rows" :key="bill.billId" class="bill" hover-class="k-press" @click="view(bill.billId)">
          <view class="bill-head"><text>{{ kinds[bill.kind] }}</text><text class="hint">{{ state(bill) }}</text></view>
          <text class="title">{{ bill.title }}</text>
          <text v-if="bill.kind === 'stay' && bill.orderNo" class="hint">{{ stayDates(bill) }}{{ bill.guestName ? ' · ' + bill.guestName : '' }} · 订单 {{ bill.orderNo }}</text>
          <view class="line"><text>{{ bill.kind === 'stay' ? '商家结算价' : '工资 / 底薪' }}</text><text>{{ money(bill.baseFen) }}</text></view>
          <view class="line"><text>平台服务费</text><text>{{ money(bill.feeFen) }}</text></view>
        </view>
        <text v-if="loading" class="empty">正在读取账单…</text>
        <text v-else-if="!rows.length && !error" class="empty">暂无账单，新房费订单和已登记的工资会显示在这里。</text>
        <view class="actions"><k-button v-if="page > 1" type="outline" label="上一页" @click="turn(-1)" /><k-button v-if="hasMore" type="outline" label="下一页" @click="turn(1)" /></view>
      </template>
    </view>
  </view>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { get, post } from '@/common/request.js'
import { currentStaffStore, ensureSession } from '@/common/experience.js'
import { requireMerchantTransfer, confirmMerchantTransfer } from '@/common/merchant-transfer.js'

const kinds = { stay: '房费分账', parttime: '兼职服务费', fulltime: '全职服务费' }
const tabs = [['', '全部'], ['stay', '房费'], ['parttime', '兼职'], ['fulltime', '全职']]
const rows = ref([]), kind = ref(''), page = ref(1), hasMore = ref(false), detail = ref(null)
const error = ref(''), loading = ref(false), busy = ref(false), workOpen = ref(false), candidates = ref([])
const work = ref({ appId: null, workDate: '', yuan: '', basis: '' })
const withdrawYuan = ref(''), withdrawName = ref('')
let withdrawalAttempt = null
const selectedWorker = computed(() => candidates.value.find(person => person.appId === work.value.appId))
const candidateLabels = computed(() => candidates.value.map(person => person.realName + ' · ' + kinds[person.jobType] + ' · ' + person.title))
const money = value => value == null ? '待核对' : '¥' + (Number(value) / 100).toFixed(2)
// 房费账单是哪张单：入住 → 离店日期（接口带 checkIn / checkOut / 打码的客人称呼 / 订单号）
const stayDates = bill => [bill.checkIn, bill.checkOut].filter(Boolean).join(' → ')
const path = suffix => '/app/staff/business-bills' + suffix
function fen(value, max = 10000000) {
  if (!/^\d+(\.\d{1,2})?$/.test(String(value))) throw Error('金额最多保留两位小数')
  const [whole, decimal = ''] = String(value).split('.')
  const amount = Number(whole) * 100 + Number(decimal.padEnd(2, '0'))
  if (!Number.isSafeInteger(amount) || amount <= 0 || amount > max) throw Error('金额须大于0且不超过可用上限')
  return amount
}
const preview = computed(() => {
  try { const base = fen(work.value.yuan); const fee = Math.floor((base + 5) / 10); return { fee, net: base - fee } } catch { return null }
})
function state(bill) {
  if (bill.withdrawingFen > 0) return '微信提现处理中'
  if (bill.withdrawableFen > 0) return '可提现'
  if (bill.kind === 'stay' && bill.sourceStatus === 'closed') return '订单已关闭'
  if (bill.kind === 'stay' && bill.sourceStatus === 'pending_payment') return '待客人付款' 
  if (bill.needsReview) return '退款变化 · 待核对'
  if (bill.kind === 'stay' && bill.sourceStatus === 'no_show' && bill.eligible && bill.status === 'draft') return '客人未到店 · 待平台核对'
  if (bill.kind === 'stay' && !bill.eligible) return '待退房或退款处理'
  return { draft: '待核对', approved: '待收付款', settled: '已结清' }[bill.status] || bill.status
}
let sequence = 0
let navigationRequest = 0
async function load() {
  const current = ++sequence
  error.value = ''
  loading.value = true
  try {
    await ensureSession()
    const storeId = currentStaffStore.value?.storeId
    if (!storeId) throw Error('请先选择合作门店')
    const result = (await get(path(''), { storeId, kind: kind.value, pageNum: page.value })).data
    if (current !== sequence) return
    rows.value = result.rows
    hasMore.value = result.hasMore
  } catch (e) { if (current === sequence) error.value = e.message || '账单读取失败，请重试' }
  finally { if (current === sequence) loading.value = false }
}
function showList() {
  navigationRequest++
  detail.value = null
  workOpen.value = false
  error.value = ''
}
function filter(value) { kind.value = value; page.value = 1; showList(); load() }
function turn(delta) { page.value += delta; load() }
async function view(id) {
  const current = ++navigationRequest
  error.value = ''
  const storeId = currentStaffStore.value?.storeId
  try {
    const bill = (await get(path('/' + id), { storeId })).data
    if (current === navigationRequest && storeId === currentStaffStore.value?.storeId) {
      workOpen.value = false
      detail.value = bill
      withdrawYuan.value = bill.withdrawableFen > 0 ? (bill.withdrawableFen / 100).toFixed(2) : ''
      withdrawName.value = ''
      withdrawalAttempt = null
    }
  } catch (e) { if (current === navigationRequest && storeId === currentStaffStore.value?.storeId) error.value = e.message }
}
async function openWork() {
  const current = ++navigationRequest
  error.value = ''
  const storeId = currentStaffStore.value?.storeId
  try {
    const people = (await get(path('/candidates'), { storeId })).data
    if (current !== navigationRequest || storeId !== currentStaffStore.value?.storeId) return
    candidates.value = people
    if (!people.length) throw Error('本店暂无已确认入职的兼职或全职人员')
    work.value = { appId: null, workDate: '', yuan: '', basis: '' }
    detail.value = null
    workOpen.value = true
  } catch (e) { if (current === navigationRequest && storeId === currentStaffStore.value?.storeId) error.value = e.message }
}
function chooseWorker(event) {
  const person = candidates.value[Number(event.detail.value)]
  work.value = { appId: person.appId, workDate: '', yuan: ['daily', 'monthly'].includes(person.salaryType) ? String(person.salaryMin || '') : '', basis: '' }
}
async function saveWork() {
  if (busy.value) return
  const current = navigationRequest
  busy.value = true
  error.value = ''
  const storeId = currentStaffStore.value?.storeId
  try {
    const result = await post(path('/work') + '?storeId=' + encodeURIComponent(storeId), { appId: work.value.appId, workDate: work.value.workDate, baseFen: fen(work.value.yuan), basis: work.value.basis })
    if (current !== navigationRequest || storeId !== currentStaffStore.value?.storeId) return
    workOpen.value = false
    await load()
    if (current !== navigationRequest || storeId !== currentStaffStore.value?.storeId) return
    await view(result.data)
  } catch (e) { if (current === navigationRequest && storeId === currentStaffStore.value?.storeId) error.value = e.message }
  finally { busy.value = false }
}
const terminal = state => ['SUCCESS', 'FAIL', 'CANCELLED'].includes(state)
const transferState = state => ({ QUEUED: '等待微信处理', ACCEPTED: '微信已受理', PROCESSING: '微信处理中', WAIT_USER_CONFIRM: '待本人确认收款', TRANSFERING: '转账中', SUCCESS: '已到账', FAIL: '提现失败，金额已释放', CANCELING: '撤销处理中', CANCELLED: '已撤销，金额已释放' }[state] || '正在核实提现结果')
const transferFailure = code => ({ NAME_NOT_CORRECT: '收款人姓名与微信实名不一致', PAYEE_ACCOUNT_ABNORMAL: '收款微信账户异常', OVERDUE_CLOSE: '收款确认已超时，请重新申请提现' }[code] || '微信返回失败原因 ' + code)
const transferError = code => ['NO_AUTH', 'SIGN_ERROR', 'PARAM_ERROR', 'INVALID_REQUEST'].includes(code) ? '请联系平台核对微信转账配置（' + code + '）' : '系统正在核实本次转账，请稍后刷新（' + code + '）'
async function updateDetail(id, storeId) {
  const bill = (await get(path('/' + id), { storeId })).data
  if (detail.value?.billId === id && currentStaffStore.value?.storeId === storeId) detail.value = bill
}
async function withdraw() {
  if (busy.value || !detail.value) return
  error.value = ''
  const id = detail.value.billId, storeId = currentStaffStore.value?.storeId
  try {
    requireMerchantTransfer()
    const amountFen = fen(withdrawYuan.value, Math.min(detail.value.withdrawableFen, 2147483647))
    if (amountFen >= 200000 && !withdrawName.value.trim()) throw Error('请填写与微信实名一致的收款人姓名')
    if (withdrawalAttempt && (withdrawalAttempt.amountFen !== amountFen || withdrawalAttempt.realName !== withdrawName.value.trim())) throw Error('上一笔申请结果待核实，请先返回列表刷新账单')
    busy.value = true
    if (!withdrawalAttempt) withdrawalAttempt = { requestKey: 'wd' + Date.now().toString(36) + Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2), amountFen, version: detail.value.version, realName: withdrawName.value.trim() }
    const result = (await post(path('/' + id + '/withdraw') + '?storeId=' + storeId, withdrawalAttempt)).data
    withdrawalAttempt = null
    if (storeId !== currentStaffStore.value?.storeId) return
    await updateDetail(id, storeId)
    if (result.params) await confirmMerchantTransfer(result.params)
    await post(path('/withdrawals/' + result.withdrawalNo + '/refresh') + '?storeId=' + storeId, {})
  } catch (e) { if (storeId === currentStaffStore.value?.storeId) error.value = e.message || '提现结果待核实，请刷新账单' }
  finally {
    busy.value = false
    try { await updateDetail(id, storeId) } catch { /* The stored request key allows an uncertain request to be retried safely. */ }
  }
}
async function refreshWithdrawal(record) {
  if (busy.value) return
  busy.value = true
  error.value = ''
  const id = detail.value.billId, storeId = currentStaffStore.value?.storeId
  try {
    const result = (await post(path('/withdrawals/' + record.withdrawalNo + '/refresh') + '?storeId=' + storeId, {})).data
    if (storeId !== currentStaffStore.value?.storeId) return
    if (result.params) {
      await confirmMerchantTransfer(result.params)
      await post(path('/withdrawals/' + record.withdrawalNo + '/refresh') + '?storeId=' + storeId, {})
    }
  } catch (e) { if (storeId === currentStaffStore.value?.storeId) error.value = e.message }
  finally { busy.value = false; try { await updateDetail(id, storeId) } catch {} }
}
watch(() => currentStaffStore.value?.storeId, () => { showList(); withdrawalAttempt = null; rows.value = []; page.value = 1; load() })
onShow(() => { load(); if (detail.value) updateDetail(detail.value.billId, currentStaffStore.value?.storeId).catch(e => { error.value = e.message }) })
</script>

<style scoped>
.content { padding: 20px 16px calc(32px + env(safe-area-inset-bottom)); }
.store-name { display: block; font-size: 20px; font-weight: 600; margin-bottom: 20px; }
.tabs { display: flex; gap: 8px; margin-bottom: 20px; }
.tabs > view { flex: 1; text-align: center; padding: 14px 0; border-radius: 8px; background: var(--k-paper2); font-size: 15px; }
.tabs .active { background: var(--k-red-deep); color: var(--k-paper); }
.title { display: block; font-size: 16px; font-weight: 600; line-height: 1.6; overflow-wrap: anywhere; }
.hint { display: block; font-size: 14px; line-height: 1.6; color: var(--k-muted); }
.line, .bill-head { display: flex; justify-content: space-between; gap: 14px; padding: 10px 0; font-size: 14px; }
.line > text:last-child { flex-shrink: 0; }
.bill-head { color: var(--k-red-deep); align-items: center; }
.bill, .section { padding: 18px 0; border-bottom: 1px solid var(--k-line); }
.actions { display: flex; gap: 12px; margin: 20px 0; flex-wrap: wrap; }
.field-label { display: block; font-size: 16px; margin: 20px 0 10px; }
.input, .picker-field { box-sizing: border-box; width: 100%; min-height: 48px; padding: 12px; border: 1px solid var(--k-line2); border-radius: 12px; background: var(--k-paper); font-size: 16px; }
.basis { height: 112px; }
.work-form .hint { margin-top: 10px; }
.error { display: block; color: var(--k-alert); font-size: 14px; padding: 12px 0; }
.empty { display: block; padding: 32px 0; color: var(--k-muted); font-size: 15px; line-height: 1.7; }
.history { padding: 14px 0; display: flex; flex-direction: column; gap: 8px; font-size: 14px; overflow-wrap: anywhere; }
</style>
