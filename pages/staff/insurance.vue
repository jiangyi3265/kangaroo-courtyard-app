<template>
  <view class="k-page insurance-orders">
    <template v-if="s===1">
      <k-topbar title="待申请保险" back />
    <k-subscribe scenes="insurance" label="订阅保险办理提醒" />
      <view class="pending-page k-pad-tab"><button class="finance-entry" hover-class="k-press" @click="openInsuranceFinance()"><text>投保缴费、退费与本人保险余额</text><k-icon name="chevron-right" :size="12" color="muted" /></button><view class="deadline-tip" @click="openDeadlineTip"><k-icon name="circle-alert" :size="16" color="ochre" /><text>投保办理：选择人员 → 店家缴费 → 登记保单</text><k-icon name="chevron-right" :size="12" color="muted" /></view><view class="pending-tabs"><text :class="{active:tab==='all'}" @click="tab='all'">全部 {{ tb.counts.all }}</text><text :class="{active:tab==='within7'}" @click="tab='within7'">7日内到店 {{ tb.counts.within7 }}</text><text :class="{active:tab==='overdue'}" @click="tab='overdue'">超时 {{ tb.counts.overdue }}</text></view><view class="selected-row"><text>已选择 {{ selected.length }} 项</text><text @click="onSelectedAction">{{ selected.length ? '清空' : '投保记录 〉' }}</text></view><view v-if="!pending.length" class="list-empty">{{ tbLoading ? '正在读取待申请名单…' : (tab === 'all' ? '暂无待申请保险的人员' : '这一栏暂无人员') }}</view><view v-for="(p,i) in pending" :key="p.appId" class="pending-card" @click="toggle(p.appId)"><view class="select-box" :class="{checked:selected.includes(p.appId)}"><k-icon v-if="selected.includes(p.appId)" name="check" :size="13" color="white" :stroke="2.6" /></view><image :src="absUrl(p.avatar)" mode="aspectFill" /><view class="pending-name"><text>{{p.name}}</text><text>{{p.job}}</text></view><view class="pending-meta"><text>{{p.store}}</text><text>{{p.date}}</text><text :class="{late:p.late}">{{p.left}}</text></view></view><view v-if="!canBuy && !tbLoading" class="insurance-readonly">由合作店家提交申请并缴费，换工主理人登记真实保单。</view><view class="buy-row"><view class="select-box" :class="{checked:allSelected}" @click="toggleAll" /><text @click="toggleAll">全选</text><button :disabled="!canBuy || batchSubmitting" :style="canBuy ? '' : 'opacity:.5'" @click="openInsuranceFinance()"><text>选择人员并缴费</text></button></view></view><k-tabbar mode="staff" active="work" />
    </template>
    <template v-else-if="s===2">
      <k-topbar title="投保记录" back custom-back @back="backFrom(2)" />
      <view class="policies k-pad-tab"><button class="finance-entry" hover-class="k-press" @click="openInsuranceFinance()"><text>缴费、退费、余额与保单登记</text><k-icon name="chevron-right" :size="12" color="muted" /></button><view class="policy-search" @click="askPolicyKeyword"><k-icon name="search" :size="16" color="muted" /><text>{{ pq.keyword || '搜索保单号 / 人员 / 门店' }}</text></view><view class="policy-filters"><view class="pf-dd" hover-class="k-press" @click="pickPolicyStatus"><text>{{ policyStatusLabel }}</text><k-icon name="chevron-down" :size="12" color="muted" /></view><view class="pf-dd pf-dd--store" hover-class="k-press" @click="pickPolicyStore"><text>{{ policyStoreLabel }}</text><k-icon name="chevron-down" :size="12" color="muted" /></view><view class="pf-dd" hover-class="k-press" @click="pickPolicyDays"><text>{{ policyDaysLabel }}</text><k-icon name="chevron-down" :size="12" color="muted" /></view><view class="pf-sort" @click="pickPolicySort"><text>{{ policySortLabel }}</text><k-icon name="list-filter" :size="14" color="ink2" /></view></view><text class="policy-count">共 {{ policies.length }} 条投保记录</text><view v-for="p in policies" :key="p.applyId" class="policy-card"><view class="policy-head"><text>保单号：{{ p.no || '待保险公司出具' }}</text><button class="policy-status" :class="p.tone" @click="openInsuranceFinance(p)"><text>{{p.status}}</text><k-icon name="chevron-right" :size="10" color="muted" /></button></view><view class="policy-user"><image :src="absUrl(p.avatar)" mode="aspectFill" /><view><text>{{p.name}}</text><text>{{p.job}}</text></view></view><text>保障期限　　{{p.period}}</text><text>{{p.timeLabel}}　　{{p.time}}</text><view class="policy-actions"><button @click="showVoucher(p)"><k-icon name="receipt" :size="15" color="ink2" /><text>查看凭证</text></button><button @click="showNotices(p)"><k-icon name="file-text" :size="15" color="ink2" /><text>通知记录</text></button><button class="pa-reg" @click="openInsuranceFinance(p)"><k-icon name="file-pen" :size="15" color="red" /><text>缴费 / 退费 / 保单</text></button></view></view></view><k-tabbar mode="staff" active="work" />
    </template>
    <template v-else-if="s===3">
      <k-topbar title="二消订单" back custom-back @back="backFrom(3)" />
      <view class="resale k-pad-tab"><view class="policy-search" @click="askResaleKeyword"><k-icon name="search" :size="16" color="muted" /><text>{{ rq.keyword || '搜索商品 / 用户 / 订单号 / 门店' }}</text></view><view class="policy-filters"><view class="pf-dd" hover-class="k-press" @click="pickRsStatus"><text>{{ rsStatusLabel.replace('⌄', '') }}</text><k-icon name="chevron-down" :size="12" color="muted" /></view><view class="pf-dd pf-dd--store" hover-class="k-press" @click="pickRsStore"><text>{{ rsStoreLabel.replace('⌄', '') }}</text><k-icon name="chevron-down" :size="12" color="muted" /></view><view class="pf-dd" hover-class="k-press" @click="pickRsDays"><text>{{ rsDaysLabel.replace('⌄', '') }}</text><k-icon name="chevron-down" :size="12" color="muted" /></view><view class="pf-sort" @click="pickRsBiz"><text>{{ rq.biz ? (rq.biz === 'stay' ? '住宿' : '服务') : '筛选' }}</text><k-icon name="list-filter" :size="14" color="ink2" /></view></view><view class="resale-tabs"><text class="active" :style="rq.tab === 'unused' ? '' : rsOff" @click="setRsTab('unused')">{{ rsTabText(0) }}</text><text :class="{ active: rq.tab === 'used' }" @click="setRsTab('used')">{{ rsTabText(1) }}</text><text :class="{ active: rq.tab === 'refunded' }" @click="setRsTab('refunded')">{{ rsTabText(2) }}</text></view><view v-if="rsLoaded && !orders.length" class="list-empty">暂无{{ rsStatusLabel.replace('⌄', '') }}的订单</view><view v-for="o in orders" :key="o.no" class="order-card"><view class="order-head"><text>订单号：{{o.no}}</text><text :class="o.tone">{{o.status}}</text></view><view class="order-main"><image :src="o.img" mode="aspectFill" /><view><text>{{o.title}}</text><text>用户：{{o.user}}</text><text>{{o.date}}</text><text>门店：{{o.store}}</text><text v-if="o.staff">核销员：{{o.staff}}</text></view></view><view class="order-bottom"><text>¥{{o.price}}</text><button :class="{disabled:o.disabled}" @click="onOrderBtn(o)"><text>{{o.button}}</text></button></view></view></view><k-tabbar mode="staff" active="work" />
    </template>
    <template v-else>
      <k-topbar title="扫码核销与退款" back custom-back @back="backFrom(4)" />
      <view class="verify k-pad-tab"><view class="verify-tabs"><text class="active" :style="vTab === 'verify' ? '' : vOff" @click="openVerifyTab">核销</text><text :class="{ active: vTab === 'refund' }" @click="openRefundTab">{{ refundTabText }}</text></view><view v-if="vTab === 'verify'" class="scanner" @click="scan"><view class="scan-frame"><view class="corner tl" /><view class="corner tr" /><view class="corner bl" /><view class="corner br" /></view><text>请将二维码 / 条形码置于框内</text><view class="lamp"><k-icon name="lightbulb" :size="22" color="white" /></view></view><text v-if="vTab === 'verify'" class="or">或　手动输入核销码</text><view v-if="vTab === 'verify'" class="code-row"><text :style="code ? { color: 'var(--k-ink)' } : ''" @click="inputCode">{{ code || '请输入 10 位核销码' }}</text><button @click="resolveCode"><text>核销</text></button></view><text class="verify-title">{{ vTab === 'verify' ? '订单核对' : (platformReview ? '退款申请（平台审核中，门店无需处理）' : '待审批退款') }}</text><view v-for="c in cards" :key="c.key" class="verify-order" @click="tapCard(c)"><image :src="c.img" mode="aspectFill" /><view><text>{{ c.title }}</text><text>订单号：{{ c.no }}</text><text>用户：{{ c.user }}</text><text>{{ c.line }}</text><text>{{ c.amountLabel }} <text>{{ c.amount }}</text></text></view><text>{{ c.state }}</text></view><text v-if="vTab === 'verify'" class="verify-title">核销员</text><view v-if="vTab === 'verify'" class="staff-card"><image :src="absUrl(me.avatar)" mode="aspectFill" /><view><text>{{ me.name }}</text><text>门店　{{ me.store }}</text></view></view><button v-if="vTab === 'verify'" class="confirm" @click="confirmVerify"><text>{{ verifiedDone ? '扫下一单' : '确认核销' }}</text></button></view><k-tabbar mode="staff" active="work" />
    </template>
  </view>
</template>

<script setup>
// ---------------------------------------------------------------------------
// 保险与二消订单（员工端）接入情况：
//   s=1 待申请保险：本店已确认录用、还没投保的人，以及保单 7 天内到期 / 已到期待续保的在岗人员（apiStaffInsuranceToBuy），按到店 / 到期日期排；
//       勾选后选择方案并逐条提交投保申请；此操作不付款，真实保单号由平台后台或本店换工主理人登记
//   s=2 投保记录：投保申请列表（状态 / 门店 / 时间 / 排序、搜索），凭证与通知记录都来自真实数据；
//       待处理的申请，该门店换工主理人可以直接登记保单号（之前只能平台在后台登记），其他角色只能看
//   s=3 二消订单：住宿订单 + 加购服务订单合并（apiStaffResaleOrders），按待使用 / 已核销 / 已退款分组
//   s=4 核销：扫码（小程序）或手动输入核销码 → 核对 → 确认；退款申请：逐条同意 / 拒绝（同意后原路退回，走支付服务）
//       新角色阶段旅居 / 服务退款由平台在后台审核：服务端给 platformReview=true，这里只显示「平台审核中」，不给同意 / 拒绝
//   二消订单 / 核销 / 退款的门店筛选只在本页生效，不改员工端的"当前门店"；消息深链带 orderNo 时直接筛出 / 置顶那一单
// ---------------------------------------------------------------------------
import { ref, computed, watch } from 'vue'
import { onShow, onHide, onUnload } from '@dcloudio/uni-app'
import { getToken } from '@/common/request.js'
import { useScreen, toast, back, go } from '@/common/screen.js'
import {
  apiStaffInsuranceToBuy, apiStaffInsurancePlans, apiStaffInsuranceApplyBatch, apiStaffPolicies, apiStaffPolicyNotices, apiStaffRegisterPolicy,
  apiStaffResaleOrders, apiStaffRefunds, apiStaffRefundApprove, apiStaffRefundReject, apiStaffVerifyResolve, apiStaffVerifyConfirm
} from '@/common/api.js'
import { experience, getSessionRevision, ensureSession, hasStaffAccess, currentStaffStoreId, staffStores, currentStaffStore } from '@/common/experience.js'
import { errText, confirm, alert, prompt, sheet, pickPaged, serverTs, yuan } from '@/common/ui.js'
import { absUrl } from '@/common/upload.js'
import { staffCan, loadStaffPerms } from '@/common/staff-perms.js'

function openInsuranceFinance(row) {
  if (!currentInsuranceScope(insuranceScope())) return
  if (s.value === 1 && wrongMerchantEntry()) return toast('该门店暂无员工授权，请从本店工作台进入')
  const store = row?.storeId || insuranceScopeId()
  go('/pages/staff/insurance-account?storeId=' + encodeURIComponent(store || '') + (row?.applyId ? '&applyId=' + encodeURIComponent(row.applyId) : '') + (row?.registrationViaFinance && currentStaffStore.value?.roleCode === 'city_lead' ? '&registrationRole=city_lead' : ''))
}
const DEFAULT_AVATAR = '/static/media/profile-avatar.jpg'
// 面试页"保险办理"里的三个页签会带 ?tab= 过来
const TAB_ENTRY = { toBuy: [1, ''], pending: [2, 'pending'], effective: [2, 'effective'], all: [2, ''] }
// 打开本页时落在哪一屏，以及消息深链里带的订单号（新订单 ?s=3&orderNo=、退款申请 ?s=4&tab=refund&orderNo=）
let entryScreen = 1
let deepOrderNo = ''
// 业务中心「扫一扫」扫到顾客的 10 位核销码会带 ?s=4&code= 过来：进页后直接核对这张码
let deepVerifyCode = ''
const insuranceStoreId = ref(null)
const wrongMerchantEntry = () => currentStaffStore.value?.roleCode === 'merchant' && insuranceStoreId.value != null
  && String(insuranceStoreId.value) !== String(currentStaffStoreId())
const insuranceScopeId = () => currentStaffStore.value?.roleCode === 'merchant'
  ? currentStaffStoreId() : insuranceStoreId.value || currentStaffStoreId()
const s = useScreen(4, {
  onLoad: (q) => {
    const before = s.value
    deepOrderNo = String(q?.orderNo || '').trim()
    const entry = TAB_ENTRY[q?.tab]
    if (entry) {
      pq.value.status = entry[1]
      s.value = entry[0]
    }
    if (s.value <= 2) {
      insuranceStoreId.value = q?.storeId != null && /^[1-9]\d*$/.test(String(q.storeId)) ? q.storeId : null
      if (insuranceStoreId.value != null) pq.value.storeId = insuranceStoreId.value
    }
    // 退款申请通知 / 待办的深链 ?tab=refund：直接落在「退款申请」页签（之前停在默认的「核销」页签上）
    if (q?.tab === 'refund') {
      vTab.value = 'refund'
      s.value = 4
    }
    const vc = String(q?.code || '').replace(/\s/g, '')
    if (/^\d{10}$/.test(vc) && q?.tab !== 'refund') {
      deepVerifyCode = vc
      vTab.value = 'verify'
      s.value = 4
    }
    entryScreen = s.value
    if (s.value === before) loadScreen(s.value)
  }
})
watch(s, (v) => loadScreen(v))
async function loadScreen(v) {
  await ensureSession()
  if (!insurancePageActive || s.value !== v || !hasStaffAccess.value) return
  if (v >= 3 && !['keeper','merchant','city_lead'].includes(currentStaffStore.value?.roleCode)) {
    toast('当前角色没有二消与排房管理权限'); s.value = 1; return
  }
  // 深链订单号只用一次：之后在页内来回切屏按正常列表加载
  const no = deepOrderNo
  if (v === 3 || v === 4) deepOrderNo = ''
  if (v === 1) loadToBuy()
  if (v === 2) loadPolicies()
  if (v === 3) no ? focusResaleOrder(no) : loadResale()
  if (v === 4) no ? focusRefund(no) : loadRefunds()
  if (v === 4 && deepVerifyCode) {
    code.value = deepVerifyCode
    deepVerifyCode = ''
    resolveCode()
  }
}
// 返回按来路：直接打开的那一屏（工作台「订单管理」/ 业务中心「二消管理」进二消订单、消息深链进核销退款、
// 面试页进投保记录）回来源页；页内跳过来的回上一屏。之前二消订单的返回固定落到「投保记录」。
// 二消订单在页内没有上一屏（待购 / 投保记录都没有通往它的入口），所以总是回来源页
const backFrom = (n) => {
  if (n === entryScreen || n === 3) return back()
  s.value = n === 4 ? 3 : 1
}

// ---------------- s=1 待申请保险 ----------------
const tb = ref({ counts: { all: 0, within7: 0, overdue: 0 }, rows: [] })
const tab = ref('all')
const selected = ref([])
const leftText = (r) => {
  const ts = serverTs(r.arrivalDate + ' 00:00:00')
  if (!ts) return ''
  const diff = ts - Date.now()
  const h = Math.abs(diff) / 3600000
  const t = h < 1 ? '不到 1 小时' : (h < 24 ? Math.floor(h) + ' 小时' : Math.floor(h / 24) + ' 天')
  return diff < 0 ? '超时 ' + t : '还剩 ' + t
}
// 在岗人员的保单 7 天内到期或已到期（服务端 renew=true，daysLeft 按止保日期算）：之前到期后这个人就从名单里消失、没法续保；
// 现在列回来，按到期日说明，已过期的算「超时」。「7日内到店」只放新录用的
const renewText = (r) => {
  const n = Number(r.daysLeft) || 0
  return n > 0 ? n + ' 天后到期·待续保' : (n === 0 ? '今天到期·待续保' : '已过期 ' + (-n) + ' 天·待续保')
}
const pending = computed(() => (tb.value.rows || [])
  .filter(r => tab.value === 'all' || (tab.value === 'within7' ? !r.renew && r.daysLeft >= 0 && r.daysLeft <= 7 : r.daysLeft < 0))
  .map(r => ({
    appId: r.appId, avatar: r.avatar || DEFAULT_AVATAR, name: r.name, job: r.jobTitle || '', store: r.storeName || '',
    date: r.renew ? '保单到期　' + (r.lastEnd || '') : '到店日期　' + (r.arrivalDate || ''),
    left: r.renew ? renewText(r) : leftText(r), late: r.daysLeft < 0
  })))
const allSelected = computed(() => pending.value.length > 0 && pending.value.every(p => selected.value.includes(p.appId)))
const toggle = (id) => {
  const i = selected.value.indexOf(id)
  if (i >= 0) selected.value.splice(i, 1)
  else selected.value.push(id)
}
const toggleAll = () => { selected.value = allSelected.value ? [] : pending.value.map(p => p.appId) }
// 顶部提示条（右侧有箭头，之前点了没反应）：说明投保时效，并把已超时未投保的人筛出来
async function openDeadlineTip() {
  await alert('保险怎么办理', '由本店有权限的员工或换工主理人办理投保。\n1. 人员经本店确认录用后，会出现在待申请名单；姓名等信息沿用报名资料。\n2. 勾选人员，点击提交投保申请，再选择平台上架的保险方案。起保日默认取到店日与今天较晚的一天，续保接在上一张保单后。\n3. 提交后可在投保记录查看进度。平台或本店有保险审核权限的人员拿到保险公司出具的保单后登记保单号。\n提交申请不等于保障生效，保障时间以真实保单为准。')
}
// 「已选择」行右侧：有勾选时是「清空」，没勾选时是去「投保记录」（待购页之前没有任何去投保记录的入口）
const onSelectedAction = () => {
  if (selected.value.length) selected.value = []
  else { pq.value.storeId = insuranceScopeId(); s.value = 2 }
}
// 提交投保申请服务端要「保险管理·编辑」（apply-batch 逐条按报名所在门店再判一次），没有权限的按钮置灰并说明
const canBuy = ref(false)
const batchSubmitting = ref(false)
// 名单为空时区分「正在读取」和「确实没有人」
const tbLoading = ref(false)
let insurancePageActive = true
let insuranceEpoch = 0
let toBuyRequest = 0
let policiesRequest = 0
let policyNoticeRequest = 0
const emptyToBuy = () => ({ counts: { all: 0, within7: 0, overdue: 0 }, rows: [] })
const insuranceIdentityKey = () => JSON.stringify([
  getSessionRevision(), String(experience.account?.id || ''), getToken(), experience.mode,
  currentStaffStore.value?.storeId, currentStaffStore.value?.cityId, currentStaffStore.value?.roleCode,
  staffStores.value.map(g => [String(g.storeId), g.roleCode || '', g.active]).sort((a,b) => a[0].localeCompare(b[0]))
])
// 不含「核销 / 退款申请」页签：之前切一下页签就把已扫出的订单、核销码和退款数一起清掉，切回来得重扫。
// 两个页签各自的操作在提交前都会再核对当前页签（resolveCode / confirmVerify / tapCard）
const insuranceContextKey = () => JSON.stringify([insuranceIdentityKey(), s.value, String(insuranceScopeId() || ''), String(rsStoreId() || '')])
const insuranceScope = () => ({ epoch: insuranceEpoch, key: insuranceContextKey() })
const currentInsuranceScope = scope => insurancePageActive && !!getToken() && !!experience.account && experience.mode === 'staff'
  && hasStaffAccess.value && scope.epoch === insuranceEpoch && scope.key === insuranceContextKey()
function clearInsuranceState() {
  insuranceEpoch++; toBuyRequest++; policiesRequest++; policyNoticeRequest++
  tb.value = emptyToBuy(); selected.value = []; canBuy.value = false; batchSubmitting.value = false; tbLoading.value = false
  pol.value = { rows: [] }
  rsRequest++; rfRequest++; verifyRequest++; focusRequest++
  rs.value = { rows: [], counts: {}, storeName: '' }; refunds.value = []; platformReview.value = false
  picked.value = null; resolved.value = null; code.value = ''; focusNo.value = ''; verifiedDone.value = false
  financialSubmitting.value = false; policySubmitting.value = false
}
async function loadToBuy() {
  const scope = insuranceScope(), request = ++toBuyRequest
  const current = () => currentInsuranceScope(scope) && s.value === 1 && request === toBuyRequest
  canBuy.value = false; tb.value = emptyToBuy(); selected.value = []
  if (!current()) return
  tbLoading.value = true
  try {
    if (wrongMerchantEntry()) throw new Error('该门店暂无员工授权，请从本店工作台进入')
    const storeId = insuranceScopeId()
    const grant = staffStores.value.find(g => String(g.storeId) === String(storeId))
    if (!grant) throw new Error('该门店暂无员工授权')
    const [data, permissions] = await Promise.all([apiStaffInsuranceToBuy(storeId), loadStaffPerms(grant)])
    if (!current()) return
    if (!permissions) throw new Error('投保权限读取失败，请重新进入')
    tb.value = data.data || emptyToBuy()
    canBuy.value = ['yes', 'part'].includes((permissions.insurance || [])[1])
    tbLoading.value = false
  } catch (e) {
    if (!current()) return
    tb.value = emptyToBuy(); selected.value = []; canBuy.value = false; tbLoading.value = false
    toast(errText(e, '待购名单加载失败'))
  }
}
async function buySelected() {
  if (batchSubmitting.value) return
  if (!canBuy.value) return toast('当前角色没有投保权限')
  if (!selected.value.length) return toast('请先勾选要投保的人员')
  const scope = insuranceScope(), storeId = insuranceScopeId(), appIds = [...selected.value]
  const selection = JSON.stringify(appIds)
  const current = () => currentInsuranceScope(scope) && s.value === 1 && canBuy.value
    && selection === JSON.stringify(selected.value)
    && appIds.every(id => (tb.value.rows || []).some(r => String(r.appId) === String(id)))
  if (!current()) return
  batchSubmitting.value = true
  try {
    const plans = (await apiStaffInsurancePlans()).data || []
    if (!current()) return
    if (!plans.length) return toast('平台暂未上架保险方案')
    const i = await pickPaged(plans.map(p => `${p.name} 参考保费 ¥${p.priceYuan}/${p.days}天`), '选择保险方案')
    if (!current() || i < 0 || !plans[i]) return
    const p = plans[i]
    if (!(await confirm('提交投保申请', `为已选的 ${appIds.length} 人提交「${p.name}」投保申请（每人参考保费 ¥${p.priceYuan}）？此操作不付款。提交申请不代表已有保障；出单后以保单起止日期为准。`))) return
    if (!current()) return
    const res = await apiStaffInsuranceApplyBatch(storeId, appIds, p.planId)
    if (!current()) return
    const r = res.data || {}
    if (r.failed && r.failed.length) alert('部分未提交', r.failed.map(f => `报名 ${f.appId}：${f.reason}`).join('\n'))
    else toast(res.msg || '已提交')
    selected.value = []
    await loadToBuy()
    if (!currentInsuranceScope(scope)) return
    pq.value.storeId = storeId
    s.value = 2
  } catch (e) {
    if (currentInsuranceScope(scope)) toast(errText(e, '提交失败'))
  } finally { if (currentInsuranceScope(scope)) batchSubmitting.value = false }
}
// ---------------- s=2 投保记录 ----------------
const pq = ref({ status: '', keyword: '', days: 0, sort: '', storeId: null })
const pol = ref({ rows: [] })
const POLICY_STATUS = [{ v: '', l: '全部状态' }, { v: 'pending', l: '待登记保单' }, { v: 'upcoming', l: '待生效' }, { v: 'active', l: '生效中' }, { v: 'expired', l: '已失效' }, { v: 'rejected', l: '已驳回' }]
const DAYS_OPTS = [{ v: 0, l: '全部日期' }, { v: 7, l: '近 7 天' }, { v: 30, l: '近 30 天' }, { v: 90, l: '近 90 天' }, { v: 365, l: '近一年' }]
const SORT_OPTS = [{ v: '', l: '按申请时间' }, { v: 'start', l: '按起保日期' }]
const policyStatusLabel = computed(() => (pq.value.status === 'effective' ? '已出单' : (POLICY_STATUS.find(o => o.v === pq.value.status) || POLICY_STATUS[0]).l))
const policyStores = computed(() => {
  const selected = currentStaffStore.value
  if (!selected) return []
  return staffStores.value.filter(g => {
    if (!g.storeId || g.sharedRecruitment || g.roleCode !== selected.roleCode) return false
    if (String(g.storeId) === String(selected.storeId)) return true
    if (selected.roleCode === 'city_lead' && selected.city && selected.city === g.city) return true
    return selected.roleCode !== 'merchant' && !selected.storeId && selected.cityId && String(selected.cityId) === String(g.cityId)
  })
})
const policyStoreFilter = computed(() => policyStores.value.find(g => String(g.storeId) === String(pq.value.storeId)) ||
  (policyStores.value.length === 1 ? policyStores.value[0] : null))
const policyStoreLabel = computed(() => policyStoreFilter.value?.storeName || '当前身份的门店')
const policyDaysLabel = computed(() => (DAYS_OPTS.find(o => o.v === pq.value.days) || DAYS_OPTS[0]).l)
const policySortLabel = computed(() => (pq.value.sort ? SORT_OPTS.find(o => o.v === pq.value.sort).l : '筛选'))
// 登记保单号的入口：只给待处理的申请、且本人是那家门店的换工主理人或（角色切换前的）员工（服务端同样只认这些角色，这里只是不让别的角色看到按钮）
const isManagerOf = (storeId) => staffStores.value.some(g => String(g.storeId) === String(storeId) && ['manager', 'staff', 'city_lead'].includes(g.roleCode))
const policies = computed(() => (pol.value.rows || []).map(r => ({
  ...r, rawStatus: r.status, status: r.statusLabel, avatar: r.avatar || DEFAULT_AVATAR, canRegister: !r.registrationViaFinance && r.status === 'pending' && isManagerOf(r.storeId)
})))
// 状态也是操作入口：换工主理人登记真实保单，其他员工可以查看待办说明。
function openPolicyStatus(p) {
  if (!currentInsuranceScope(insuranceScope()) || s.value !== 2) return
  const row = (pol.value.rows || []).find(r => String(r.applyId) === String(p.applyId))
  if (!row) return
  if (row.status !== 'pending') return showVoucher(p)
  if (row.registrationViaFinance) return openInsuranceFinance(p)
  if (isManagerOf(row.storeId)) return registerPolicy({ ...p, storeId: row.storeId, canRegister: true })
  return alert('待登记保单', '投保申请已提交，尚未登记保险公司出具的保单号。请联系本店有保险审核权限的人员或平台管理员核对并登记真实保单。\n登记后刷新本页即可查看，是否生效以实际保单和保障起止日期为准。')
}
async function loadPolicies() {
  const scope = insuranceScope(), request = ++policiesRequest
  const q = { ...pq.value }, filter = JSON.stringify(q)
  const current = () => currentInsuranceScope(scope) && s.value === 2 && request === policiesRequest && filter === JSON.stringify(pq.value)
  policyNoticeRequest++; pol.value = { rows: [] }
  if (!current()) return
  if (!policyStores.value.length) return
  try {
    const res = await apiStaffPolicies({
      storeId: policyStoreFilter.value?.storeId, status: q.status || undefined, keyword: q.keyword || undefined,
      days: q.days || undefined, sort: q.sort || undefined
    })
    if (current()) {
      const data = res.data || { rows: [] }
      // 老接口的「全部门店」曾返回账号的全部身份，升级期间也按选中的范围展示。
      const allowed = new Set(policyStores.value.map(g => String(g.storeId)))
      pol.value = policyStoreFilter.value ? data : { rows: (data.rows || []).filter(row => allowed.has(String(row.storeId))) }
    }
  } catch (e) {
    if (!current()) return
    pol.value = { rows: [] }
    toast(errText(e, '保单加载失败'))
  }
}
const askPolicyKeyword = async () => {
  const scope = insuranceScope(), filter = JSON.stringify(pq.value)
  const current = () => currentInsuranceScope(scope) && s.value === 2 && filter === JSON.stringify(pq.value)
  if (!current()) return
  const v = await prompt('搜索保单', { value: pq.value.keyword, placeholder: '保单号 / 人员 / 岗位' })
  if (!current()) return
  if (v === null) return
  pq.value.keyword = v
  loadPolicies()
}
const pickFrom = async (opts, key) => {
  const scope = insuranceScope(), filter = JSON.stringify(pq.value)
  const current = () => currentInsuranceScope(scope) && s.value === 2 && filter === JSON.stringify(pq.value)
  if (!current()) return
  const i = await sheet(opts.map(o => o.l))
  if (!current()) return
  if (i < 0) return
  pq.value[key] = opts[i].v
  loadPolicies()
}
const pickPolicyStatus = () => pickFrom(POLICY_STATUS, 'status')
const pickPolicyDays = () => pickFrom(DAYS_OPTS, 'days')
const pickPolicySort = () => pickFrom(SORT_OPTS, 'sort')
const pickPolicyStore = async () => {
  const scope = insuranceScope(), filter = JSON.stringify(pq.value)
  const current = () => currentInsuranceScope(scope) && s.value === 2 && filter === JSON.stringify(pq.value)
  if (!current()) return
  const list = policyStores.value
  if (!list.length) return
  const options = list.map(g => g.storeName)
  if (list.length > 1) options.unshift('当前身份的全部门店')
  const i = await pickPaged(options, '选择门店')
  if (!current()) return
  if (i < 0) return
  pq.value.storeId = list.length === 1 ? list[0].storeId : i === 0 ? null : list[i - 1].storeId
  loadPolicies()
}
const showVoucher = (p) => {
  if (!currentInsuranceScope(insuranceScope()) || s.value !== 2 || !(pol.value.rows || []).some(row => String(row.applyId) === String(p.applyId))) return
  return alert('投保凭证', [
  `保单号：${p.no || '待保险公司出具'}`, `方案：${p.planName || '—'}`, `承保公司：${p.insurer || '待平台登记'}`, `被保险人：${p.name || '—'}`,
  `保障期限：${p.period || '待核实'}`, p.priceYuan != null ? `参考保费：¥${p.priceYuan}` : '', p.handleNote ? `处理说明：${p.handleNote}` : ''
].filter(Boolean).join('\n'))
}
const policySubmitting = ref(false)
async function registerPolicy(p) {
  if (policySubmitting.value || !p.canRegister) return
  const scope = insuranceScope(), filter = JSON.stringify(pq.value)
  // 弹窗期间换了账号 / 门店授权 / 筛选，或这条已不在列表里、不再是待处理，就不再提交
  const current = () => currentInsuranceScope(scope) && s.value === 2 && filter === JSON.stringify(pq.value) && isManagerOf(p.storeId)
    && (pol.value.rows || []).some(row => String(row.applyId) === String(p.applyId) && row.status === 'pending')
  if (!current()) return
  policySubmitting.value = true
  try {
    if (!(await confirm('登记保单号', `${p.name || '被保险人'} · ${p.planName || '用工保险'}\n保障期限：${p.period || '—'}\n`
      + '登记前请核对保险公司出具的真实保单；登记出单不等于保障已生效，保障按保单起止日期；登记后会通知被保险人与门店。')) || !current()) return
    const v = await prompt('填写保单号', { placeholder: '保险公司出具的保单号' })
    if (v === null || !current()) return
    // 与服务端同一口径：去掉首尾空白后必填、最多 64 个字
    const no = String(v).trim()
    if (!no) return toast('请填写保单号')
    if (no.length > 64) return toast('保单号最多 64 个字')
    const res = await apiStaffRegisterPolicy(p.applyId, p.storeId, no)
    if (!current()) return
    toast(res.msg || '已登记保单号')
    loadPolicies()
  } catch (e) {
    // 被别人抢先登记 / 驳回（409）时刷新一下，列表上的状态才对得上
    if (current()) { toast(errText(e, '登记失败')); loadPolicies() }
  } finally { if (currentInsuranceScope(scope)) policySubmitting.value = false }
}
async function showNotices(p) {
  const scope = insuranceScope(), request = ++policyNoticeRequest
  const current = () => currentInsuranceScope(scope) && s.value === 2 && request === policyNoticeRequest
    && (pol.value.rows || []).some(row => String(row.applyId) === String(p.applyId))
  if (!current()) return
  try {
    const rows = (await apiStaffPolicyNotices(p.applyId)).data || []
    if (!current()) return
    alert('通知记录', rows.length ? rows.map(r => `${r.time} 通知${r.to}：${r.title}（${r.read ? '已读' : '未读'}）`).join('\n') : '暂无通知记录')
  } catch (e) {
    if (current()) toast(errText(e, '加载失败'))
  }
}

// ---------------- s=3 二消订单（住宿订单 + 加购服务订单） ----------------
const RS_TABS = [['unused', '待使用'], ['used', '已核销'], ['refunded', '已退款']]
const RS_DAYS = [[0, '全部时间'], [1, '今天'], [7, '近7天'], [30, '近30天']]
const RS_BIZ = [['', '全部类型'], ['stay', '住宿订单'], ['shop', '服务订单']]
const rs = ref({ rows: [], counts: {}, storeName: '' })
const rsLoaded = ref(false)
const rq = ref({ tab: 'unused', days: 0, biz: '', keyword: '', storeId: null })
// 二消订单、核销、退款看哪家门店：只是本页的筛选（storeId 为空 = 当前门店）。之前选门店会调 setStaffStore，
// 悄悄把整个员工端的当前门店切走；服务端这几个接口按传入的 storeId 校验授权，并不要求是当前门店
const rsStoreId = () => rq.value.storeId || currentStaffStoreId()
const grantAt = (storeId) => staffStores.value.find(g => String(g.storeId) === String(storeId)) || null
// 设计稿第一个页签写死了 active：选中别的页签时用内联样式把它还原成普通态
const rsOff = { background: 'var(--k-paper)', color: 'var(--k-ink)', borderColor: 'var(--k-line2)' }
const vOff = { color: 'var(--k-ink)', borderBottom: '0' }
let rsRequest = 0
let verifyRequest = 0
let focusRequest = 0
const financialSubmitting = ref(false)
const financialScope = () => ({ ...insuranceScope(), storeId: rsStoreId() })
const currentFinancialScope = scope => currentInsuranceScope(scope) && (s.value === 3 || s.value === 4)
  && String(scope.storeId) === String(rsStoreId()) && !!grantAt(scope.storeId)
async function loadResale(quiet) {
  const scope = financialScope(), request = ++rsRequest, query = { ...rq.value }
  focusRequest++
  const current = () => currentFinancialScope(scope) && s.value === 3 && request === rsRequest && JSON.stringify(query) === JSON.stringify(rq.value)
  rs.value = { rows: [], counts: {}, storeName: '' }
  rsLoaded.value = false
  if (!current()) return false
  try {
    const data = (await apiStaffResaleOrders({ storeId: scope.storeId, tab: query.tab, biz: query.biz || undefined,
      days: query.days || undefined, keyword: query.keyword || undefined })).data
    if (!current()) return false
    rs.value = data || { rows: [], counts: {}, storeName: '' }
    rsLoaded.value = true
    return true
  } catch (e) {
    if (current()) rsLoaded.value = true
    if (current() && !quiet) toast(errText(e, '订单加载失败'))
    return false
  }
}
// 消息深链里的订单（新订单通知）：按订单号筛出这一单，依次在待使用 / 已核销 / 已退款里找；
// 当前门店没有就到其他已授权门店找（只改本页的筛选门店）。都找不到就回到正常列表并如实说明
async function focusResaleOrder(no) {
  rq.value.keyword = no
  const scope = financialScope(), request = ++focusRequest, query = JSON.stringify(rq.value)
  const current = () => currentFinancialScope(scope) && s.value === 3 && request === focusRequest && query === JSON.stringify(rq.value)
  const first = scope.storeId
  const stores = [first].concat(staffStores.value.map(g => g.storeId).filter(id => String(id) !== String(first)))
  for (const sid of stores) for (const [tab] of RS_TABS) {
    if (!current()) return
    try {
      const data = (await apiStaffResaleOrders({ storeId: sid, tab, biz: rq.value.biz || undefined,
        days: rq.value.days || undefined, keyword: no })).data
      if (!current()) return
      if ((data?.rows || []).some(o => o.orderNo === no)) {
        rq.value = { ...rq.value, storeId: sid, tab }; rs.value = data; rsLoaded.value = true
        return
      }
    } catch (e) { if (!current()) return }
  }
  if (!current()) return
  rq.value = { ...rq.value, tab: 'unused', keyword: '', storeId: null }
  const fallback = financialScope()
  await loadResale()
  if (currentFinancialScope(fallback)) toast('没有找到消息里的这笔订单')
}
const rsTabText = (i) => `${RS_TABS[i][1]} ${(rs.value.counts || {})[RS_TABS[i][0]] || 0}`
const setRsTab = (t) => { rq.value.tab = t; loadResale() }
// 之前停在「待使用」时这里写「全部状态」，看着像没筛选，实际只列了待使用的订单
const rsStatusLabel = computed(() => RS_TABS.find(t => t[0] === rq.value.tab)[1] + '⌄')
const rsStoreLabel = computed(() => (rs.value.storeName || (grantAt(rsStoreId()) || {}).storeName || '本店') + '⌄')
const rsDaysLabel = computed(() => RS_DAYS.find(d => d[0] === rq.value.days)[1] + '⌄')
async function askResaleKeyword() {
  const scope = financialScope(), filter = JSON.stringify(rq.value)
  const current = () => currentFinancialScope(scope) && s.value === 3 && filter === JSON.stringify(rq.value)
  if (!current()) return
  const v = await prompt('搜索订单', { value: rq.value.keyword, placeholder: '商品 / 用户 / 订单号' })
  if (!current()) return
  if (v === null) return
  rq.value.keyword = v
  loadResale()
}
async function pickRsStatus() {
  const scope = financialScope(), filter = JSON.stringify(rq.value)
  const current = () => currentFinancialScope(scope) && s.value === 3 && filter === JSON.stringify(rq.value)
  if (!current()) return
  const i = await sheet(RS_TABS.map(t => t[1]))
  if (!current()) return
  if (i >= 0) setRsTab(RS_TABS[i][0])
}
async function pickRsStore() {
  const scope = financialScope(), filter = JSON.stringify(rq.value)
  const current = () => currentFinancialScope(scope) && s.value === 3 && filter === JSON.stringify(rq.value)
  if (!current()) return
  const list = staffStores.value
  if (list.length < 2) return toast('你只在「' + (rs.value.storeName || '本店') + '」有权限')
  const i = await pickPaged(list.map(g => g.storeName), '选择门店')
  if (!current()) return
  if (i < 0) return
  // 只换本页看的门店，不动员工端的当前门店
  rq.value.storeId = list[i].storeId
  picked.value = null
  resolved.value = null
  loadResale()
}
async function pickRsDays() {
  const scope = financialScope(), filter = JSON.stringify(rq.value)
  const current = () => currentFinancialScope(scope) && s.value === 3 && filter === JSON.stringify(rq.value)
  if (!current()) return
  const i = await sheet(RS_DAYS.map(d => d[1]))
  if (!current()) return
  if (i < 0) return
  rq.value.days = RS_DAYS[i][0]
  loadResale()
}
async function pickRsBiz() {
  const scope = financialScope(), filter = JSON.stringify(rq.value)
  const current = () => currentFinancialScope(scope) && s.value === 3 && filter === JSON.stringify(rq.value)
  if (!current()) return
  const i = await sheet(RS_BIZ.map(b => b[1]))
  if (!current()) return
  if (i < 0) return
  rq.value.biz = RS_BIZ[i][0]
  loadResale()
}
const RS_TONE = { unused: 'amber', confirmed: 'amber', used: 'green', checked_in: 'green', completed: 'green' }
const orders = computed(() => (rs.value.rows || []).map((o, i) => ({
  ...o, no: o.orderNo, status: o.statusLabel, rawStatus: o.status, tone: RS_TONE[o.status] || 'gray',
  img: o.cover ? absUrl(o.cover) : '/static/media/cover-empty.png', date: o.dateText, store: o.storeName || '—',
  staff: rq.value.tab === 'used' ? (o.verifiedBy || '—') : '', price: yuan(o.payFen),
  button: rq.value.tab === 'unused' ? '去核销' : (o.status === 'refund_pending' && !rs.value.platformReview ? '去审批' : '查看详情'),
  disabled: false
})))
async function onOrderBtn(o) {
  const scope = financialScope()
  if (!currentFinancialScope(scope) || s.value !== 3
    || !(rs.value.rows || []).some(row => row.orderNo === o.no && row.bizType === o.bizType)) return
  if (rq.value.tab === 'unused') {
    s.value = 4
    picked.value = o
    resolved.value = null
    code.value = ''
    vTab.value = 'verify'
    picked.value = o
    return
  }
  // 新角色阶段退款由平台审：不跳审批页，往下走看详情
  if (o.rawStatus === 'refund_pending' && !rs.value.platformReview) {
    s.value = 4
    vTab.value = 'refund'
    focusNo.value = o.no
    return
  }
  // 住宿单「查看详情」打开订单台的这一单：之前只弹一段文字，已完成、未到店的单要给客人退款时还得自己去订单台翻。
  // 订单台要「房源·查看」权限（服务端按订单所属门店校验）；明确没有这项权限的员工仍看下面的文字详情，不把人带去一个没权限的页面。
  // 路径就是 routes.js 的 staffStayOrders；这里直接写路径，因为本页的脚本测试（scripts/insurance-scope-base.mjs）只认已建模的导入
  if (o.bizType === 'stay') {
    const perms = await loadStaffPerms(grantAt(scope.storeId))
    if (!currentFinancialScope(scope) || s.value !== 3) return
    if (!perms || ['yes', 'part'].includes((perms.rooms || [])[0])) {
      return go('/pages/staff/stay-orders?orderNo=' + encodeURIComponent(o.no) + (rq.value.storeId ? '&storeId=' + rq.value.storeId : ''))
    }
  }
  alert('订单详情', [
    `订单号：${o.no}`, `${o.bizType === 'stay' ? '住宿' : '服务'}：${o.title}`, `用户：${o.user}`, o.date,
    `实付：¥${o.price}`, o.refundFen ? `已退：¥${yuan(o.refundFen)}` : '', o.verifiedBy ? `核销员：${o.verifiedBy}` : '',
    o.refundReason ? `退款原因：${o.refundReason}` : '',
    o.rawStatus === 'refund_pending' && rs.value.platformReview ? '退款进度：平台审核中，门店无需处理' : ''
  ].filter(Boolean).join('\n'))
}

// ---------------- s=4 扫码核销与退款审批 ----------------
const vTab = ref('verify')
// 刚核销成功：底部按钮变成「扫下一单」
const verifiedDone = ref(false)
const code = ref('')
const picked = ref(null)
const resolved = ref(null)
const refunds = ref([])
// 新角色阶段：旅居 / 服务退款由平台审核，门店只看进度（服务端 /app/staff/stay/refunds 给 platformReview）
const platformReview = ref(false)
// 置顶显示的那笔退款（消息深链的 orderNo，或从二消订单「去审批」点进来的那单）
const focusNo = ref('')
let rfRequest = 0
async function loadRefunds(storeId = rsStoreId(), quiet) {
  const scope = financialScope(), request = ++rfRequest
  focusRequest++
  const current = () => currentFinancialScope(scope) && s.value === 4 && request === rfRequest && String(storeId) === String(scope.storeId)
  refunds.value = []
  if (!current()) return null
  try {
    const data = (await apiStaffRefunds(storeId)).data || {}
    const rows = data.rows || []
    if (!current()) return null
    refunds.value = rows
    platformReview.value = !!data.platformReview
    return rows
  } catch (e) {
    if (current() && !quiet) toast(errText(e, '退款申请加载失败'))
    return null
  }
}
// 消息深链里的退款单：当前门店的待审批里没有，就到其他已授权门店找，找到了把本页门店筛选换成那家
async function focusRefund(no) {
  focusNo.value = no
  const scope = financialScope(), request = ++focusRequest
  const current = () => currentFinancialScope(scope) && s.value === 4 && request === focusRequest && focusNo.value === no
  const first = scope.storeId
  const stores = [first].concat(staffStores.value.map(g => g.storeId).filter(id => String(id) !== String(first)))
  for (const sid of stores) {
    if (!current()) return
    try {
      const data = (await apiStaffRefunds(sid)).data || {}
      const rows = data.rows || []
      if (!current()) return
      if (rows.some(r => r.orderNo === no)) {
        rq.value.storeId = sid; refunds.value = rows; focusNo.value = no; platformReview.value = !!data.platformReview
        return
      }
    } catch (e) { if (!current()) return }
  }
  if (!current()) return
  const fallback = financialScope()
  await loadRefunds()
  if (currentFinancialScope(fallback)) toast('这笔退款已处理或不在待审批里')
}
// 退款同意 / 拒绝服务端走 needManager：切换前只有那家门店的换工主理人（权限表里只有他有 财务·支付），切换后一律走平台。读那家门店角色的权限表，不写死角色
// 切换后城市负责人的权限表里 财务·支付 也是「能」，但服务端 needManager 只认切换前的换工主理人（manager），他点了必 403：这里同时要求是 manager
const canApprove = computed(() => { const g = grantAt(rsStoreId()); return !!g && g.roleCode === 'manager' && staffCan('finance', 'pay', g) })
const openVerifyTab = () => { vTab.value = 'verify' }
const openRefundTab = () => { vTab.value = 'refund'; loadRefunds() }
const refundTabText = computed(() => '退款申请' + (refunds.value.length ? ' ' + refunds.value.length : ''))
// 微信打开扫码界面时本页会先 onHide、扫完再 onShow。之前 onHide 一律清空并作废进行中的操作，
// 扫完回来结果被当成过期丢掉：扫码后订单核对一直停在「等待扫码」。扫码期间的这次隐藏不清空；
// 账号 / 令牌 / 门店授权 / 本页门店变了照样由 insuranceContextKey 作废
let scanTicket = 0
let scanning = 0
function scan() {
  const scope = financialScope()
  if (!currentFinancialScope(scope) || s.value !== 4 || vTab.value !== 'verify') return
  // #ifdef H5
  toast('H5 不支持调起摄像头，请手动输入核销码')
  return
  // #endif
  // #ifndef H5
  if (scanning) return
  const ticket = scanning = ++scanTicket
  uni.scanCode({
    scanType: ['qrCode', 'barCode'],
    success: (r) => {
      if (scanning !== ticket || !currentFinancialScope(scope) || s.value !== 4 || vTab.value !== 'verify') return
      code.value = String(r.result || '').replace(/\s/g, '')
      resolveCode()
    },
    complete: () => { if (scanning === ticket) scanning = 0 }
  })
  // #endif
}
// 核销码是服务端生成的 10 位数字（StayCodes.verifyCode，resolve 只认 \d{10}），提示与校验和它一致
async function inputCode() {
  const scope = financialScope(), previous = code.value
  if (!currentFinancialScope(scope) || s.value !== 4) return
  const v = await prompt('手动输入核销码', { value: code.value, placeholder: '10 位数字' })
  if (v === null || !currentFinancialScope(scope) || s.value !== 4 || previous !== code.value) return
  code.value = v.replace(/\s/g, '')
  if (code.value) resolveCode()
}
async function resolveCode() {
  const scope = financialScope(), request = ++verifyRequest, value = code.value
  const current = () => currentFinancialScope(scope) && s.value === 4 && vTab.value === 'verify'
    && request === verifyRequest && value === code.value
  resolved.value = null; verifiedDone.value = false
  if (!current()) return
  if (!value) return inputCode()
  if (!/^\d{10}$/.test(value)) return toast('核销码为 10 位数字')
  try {
    const res = await apiStaffVerifyResolve(scope.storeId, value)
    if (!current()) return
    resolved.value = res.data || null
    if (resolved.value && !resolved.value.canVerify) toast(cannotVerifyText(resolved.value))
  } catch (e) {
    if (!current()) return
    resolved.value = null; toast(errText(e, '核销码无效'))
  }
}
// 刚核销完的订单服务端不带 reason，之前再点「确认核销」只提示「当前不可核销」，看不出是已经核销过了
const cannotVerifyText = (o) => o.reason || (o.statusLabel ? `订单${o.statusLabel}，不能再核销` : '当前不可核销')
async function confirmVerify() {
  if (financialSubmitting.value) return
  if (verifiedDone.value) { verifiedDone.value = false; resolved.value = null; return scan() }
  if (!resolved.value) return toast(picked.value ? '请扫描用户出示的核销码' : '请先扫码或输入核销码')
  if (!resolved.value.canVerify) return toast(cannotVerifyText(resolved.value))
  const scope = financialScope(), value = code.value, order = JSON.stringify(resolved.value)
  const current = () => currentFinancialScope(scope) && s.value === 4 && vTab.value === 'verify'
    && value === code.value && order === JSON.stringify(resolved.value) && resolved.value?.canVerify === true
  if (!current()) return
  financialSubmitting.value = true
  try {
    if (!(await confirm('确认核销', `${resolved.value.title}\n用户：${resolved.value.userMasked}\n核销后不可撤销。`)) || !current()) return
    const res = await apiStaffVerifyConfirm(scope.storeId, value)
    if (!current()) return
    resolved.value = res.data || resolved.value
    picked.value = null; code.value = ''; verifiedDone.value = true
    // 之前核销成功只闪一下提示、卡片右上角小字从「待入住」变「已入住」，员工以为没反应；现在弹窗写明结果
    const o = resolved.value || {}
    alert('核销成功', [o.title, o.userMasked ? '用户：' + o.userMasked : '', '状态：' + (o.statusLabel || '已核销')].filter(Boolean).join('\n'))
  } catch (e) { if (current()) toast(errText(e, '核销失败')) }
  finally { if (currentFinancialScope(scope)) financialSubmitting.value = false }
}

const me = computed(() => {
  // 核销员信息按本页筛选的门店显示（核销记在那家门店上）
  const g = grantAt(rsStoreId()) || currentStaffStore.value || {}
  return {
    avatar: experience.account?.avatar ? absUrl(experience.account.avatar) : '/static/media/profile-avatar.jpg',
    name: `${experience.account?.nickname || '我'}（${g.roleName || '员工'}）`,
    store: g.storeName || '—'
  }
})
// 订单核对卡：核销页显示扫出来的订单（或列表里点的那单作参照），退款页逐条列待审批退款
const cards = computed(() => {
  if (vTab.value === 'refund') {
    if (!refunds.value.length) return [{ key: 'none', img: '/static/media/cover-empty.png', title: platformReview.value ? '暂无退款申请' : '暂无待审批的退款', no: '—', user: '—', line: platformReview.value ? '用户申请退款后会出现在这里，由平台审核' : '用户申请退款后会出现在这里', amountLabel: '申请金额：', amount: '—', state: '' }]
    // 消息里点进来的那单排在最前面并标出来
    const list = focusNo.value ? refunds.value.filter(r => r.orderNo === focusNo.value).concat(refunds.value.filter(r => r.orderNo !== focusNo.value)) : refunds.value
    return list.map((r, i) => ({
      key: r.bizType + r.orderNo, raw: r, img: '/static/media/cover-empty.png', title: r.title, no: r.orderNo, user: r.user,
      line: `原因：${r.reason || '未填写'}（${String(r.applyTime || '').replace('T', ' ').slice(5, 16)}）`,
      amountLabel: '申请退款：', amount: '¥' + yuan(r.refundFen),
      state: r.orderNo === focusNo.value ? '消息所指' : (platformReview.value ? '平台审核中' : '待审批')
    }))
  }
  const o = resolved.value
  if (o) return [{ key: 'r', img: o.cover ? absUrl(o.cover) : '/static/media/cover-empty.png', title: o.title, no: o.orderNo, user: o.userMasked, line: (o.bizType === 'stay' ? '入住时段：' : '预约时段：') + o.period, amountLabel: '订单金额：', amount: '¥' + yuan(o.amountFen), state: o.statusLabel }]
  const p = picked.value
  if (p) return [{ key: 'p', img: p.img, title: p.title, no: p.no, user: p.user, line: p.date + '（请扫描用户出示的核销码）', amountLabel: '订单金额：', amount: '¥' + p.price, state: p.status }]
  return [{ key: 'none', img: '/static/media/cover-empty.png', title: '等待扫码', no: '—', user: '—', line: '扫码或手动输入核销码后显示订单', amountLabel: '订单金额：', amount: '—', state: '' }]
})
async function tapCard(c) {
  if (vTab.value !== 'refund' || !c.raw || financialSubmitting.value) return
  if (platformReview.value) return toast('旅居和服务订单的退款由平台审核，门店无需处理')
  if (!canApprove.value) return toast('当前角色不能审批退款，请联系平台处理')
  const scope = financialScope(), r = { ...c.raw }, order = JSON.stringify(c.raw)
  const current = () => currentFinancialScope(scope) && s.value === 4 && vTab.value === 'refund' && canApprove.value
    && (refunds.value || []).some(row => row.bizType === r.bizType && row.orderNo === r.orderNo && JSON.stringify(row) === order)
  if (!current()) return
  financialSubmitting.value = true
  try {
    const i = await sheet(['同意退款 ¥' + yuan(r.refundFen), '拒绝退款'])
    if (i < 0 || !current()) return
    if (i === 0) {
      if (!(await confirm('同意退款', `${r.title}\n退款 ¥${yuan(r.refundFen)} 将原路退回给用户，确认？`)) || !current()) return
      const res = await apiStaffRefundApprove(r.bizType, r.orderNo)
      if (!current()) return
      toast(res.msg || '已同意')
    } else {
      const why = await prompt('拒绝原因', { placeholder: '会通知给用户' })
      if (why === '') toast('请填写拒绝原因')
      if (!why || !current()) return
      const res = await apiStaffRefundReject(r.bizType, r.orderNo, why)
      if (!current()) return
      toast(res.msg || '已拒绝')
    }
    await loadRefunds()
  } catch (e) { if (current()) toast(errText(e, '操作失败')) }
  finally { if (currentFinancialScope(scope)) financialSubmitting.value = false }
}

// Synchronous invalidation also catches A→B→A authorization changes in one tick.
watch(insuranceContextKey, clearInsuranceState, { flush: 'sync' })
onHide(() => { if (scanning) return; insurancePageActive = false; clearInsuranceState() })
onUnload(() => { insurancePageActive = false; clearInsuranceState() })
onShow(() => { insurancePageActive = true; loadScreen(s.value) })
</script>

<style scoped lang="scss">
/* 2026-11-17 改版「小而精」：浅灰底 + 白卡（12 圆角、不描边、不加阴影），页边距 12、卡片之间 8；正文 12–13、辅助 11、小标签 10–11（原来整页是 10–11 的小字加描边框）。
   页签是 28 高的白色胶囊，选中是暖棕；搜索框 36 高；保单 / 订单状态是浅底小标签；主按钮（选择人员并缴费、去核销、确认核销）是暖棕胶囊。
   金额、状态、保单号、办理说明一个字没动，缴费 / 退费 / 核销 / 退款的按钮都在 */
.insurance-orders{--k-bg:#F7F5F2;--k-sh1:none;background:var(--k-bg)}
.insurance-orders :deep(.k-navbar__title){font-family:var(--k-sans);font-size:16px;font-weight:600}
button{margin:0;padding:0;border:0;background:transparent}
.finance-entry{display:flex;align-items:center;justify-content:space-between;gap:8px;width:100%;min-height:44px;margin:8px 0;padding:11px 12px;font-size:13px;line-height:22px;color:var(--k-red-deep);background:var(--k-paper);border-radius:12px;text-align:left}
.finance-entry::after{border:0}
.pending-page,.policies,.resale,.verify{padding:0 12px calc(88px + var(--k-safe-bottom))}
.resale,.verify{padding-top:8px}
/* 空状态放进白卡（词典「空状态」） */
.list-empty{margin-bottom:8px;padding:28px 12px;border-radius:12px;background:var(--k-paper);text-align:center;color:var(--k-ink2);font-size:14px;font-weight:500}
/* 1 待申请保险 */
.deadline-tip{position:relative;min-height:44px;padding:0 12px;border-radius:0 0 12px 12px;background:var(--k-paper);display:flex;align-items:center;gap:8px;color:var(--k-ink2);font-size:12px}
/* 11-18：「投保缴费…」和「投保办理…」两条拼成一张卡（词典「列表行」），中间一条左缩进 12 的发丝线；投保记录页那条单独的入口不变 */
.pending-page .finance-entry{margin:8px 0 0;min-height:48px;border-radius:12px 12px 0 0;font-size:14px;color:var(--k-ink)}
.deadline-tip::before{content:'';position:absolute;left:12px;right:0;top:0;height:1px;background:var(--k-line);transform:scaleY(.5)}
.deadline-tip>text{min-width:0;flex:1}
.pending-tabs{height:44px;display:flex;gap:6px;align-items:center}
/* 二消订单的第一个页签一直带 active，没选中时由脚本里的行内样式（rsOff：白底、深色字）盖回去，所以选中态只动底色和字色 */
.pending-tabs text,.resale-tabs text{height:28px;flex:1;border-radius:999px;background:var(--k-paper);display:flex;align-items:center;justify-content:center;font-size:12px;color:var(--k-ink)}
/* 11-18 词典「筛选胶囊」：选中是浅棕底 + 深棕字，不再是整块实心渐变（实心只留给「选择人员并缴费」这类主按钮）；不加字重（rsOff 不重置字重） */
.pending-tabs .active,.resale-tabs .active{background:var(--k-red-soft);color:var(--k-red-deep)}
.pending-tabs text{color:var(--k-ink2)}.pending-tabs .active{color:var(--k-red-deep)}
.selected-row{height:34px;padding:0 2px;display:flex;align-items:center;justify-content:space-between;font-family:var(--k-sans);font-size:14px;font-weight:600}
.selected-row text:last-child{color:var(--k-red-deep);font-size:12px;font-weight:400}
.pending-card{min-height:68px;margin-bottom:8px;padding:10px 12px;border-radius:12px;background:var(--k-paper);display:flex;align-items:center;gap:10px}
.select-box{width:20px;height:20px;flex:0 0 auto;border:1px solid var(--k-line2);border-radius:4px;background:var(--k-paper);display:flex;align-items:center;justify-content:center}
.select-box.checked{background:var(--k-red);border-color:var(--k-red)}
.pending-card image{flex-shrink:0;width:44px;height:44px;border-radius:50%;background:var(--k-paper2)}
.pending-name{min-width:0;flex:1;display:flex;flex-direction:column;gap:4px}
.pending-name text:first-child{font-family:var(--k-sans);font-size:14px;font-weight:600}
.pending-name text:last-child{color:var(--k-muted);font-size:11px}
.pending-name text,.pending-meta text{overflow:hidden;white-space:nowrap;text-overflow:ellipsis}
.pending-meta{min-width:0;max-width:46%;display:flex;flex-direction:column;gap:3px;color:var(--k-muted);font-size:11px;text-align:right}
.pending-meta text:last-child{color:var(--k-green);font-size:12px;font-weight:500}
.pending-meta text.late{color:var(--k-alert)}
.buy-row{height:52px;display:flex;align-items:center;gap:10px;font-size:13px}
.buy-row>button{height:44px;margin-left:auto;width:218px;border-radius:22px;background:linear-gradient(135deg,#B5814D,#8E5E33);color:#fff;font-family:var(--k-sans);font-size:15px;font-weight:600}
/* 2 投保记录 */
.policy-search{height:36px;padding:0 12px;border-radius:18px;background:var(--k-paper);display:flex;align-items:center;gap:8px;color:var(--k-muted);font-size:13px}
/* 筛选：和评价管理、房源管理同一种白色小胶囊（28 高），右边的小箭头是图标，不再用「⌄」这个字（有的手机显示成方块）。按字数分宽度，门店名长也尽量显示全 */
.policy-filters{height:44px;display:flex;align-items:center;gap:6px}
.policy-filters>.pf-dd{flex:1 0 auto;min-width:0;height:28px;padding:0 8px;box-sizing:border-box;border-radius:999px;background:var(--k-paper);display:flex;align-items:center;justify-content:center;gap:3px;font-size:12px;color:var(--k-ink2)}
/* 只有门店名那一格会被挤短（别的三格字少、固定按字宽）；多出来的地方四格平分 */
.policy-filters>.pf-dd--store{flex:1 1 auto}
.pf-dd>text{min-width:0;overflow:hidden;white-space:nowrap;text-overflow:ellipsis}
.policy-count{display:block;margin:0 2px 8px;font-family:var(--k-sans);font-size:14px;font-weight:600}
.policy-card{margin-bottom:8px;padding:12px 12px 0;border-radius:12px;background:var(--k-paper);display:flex;flex-direction:column;gap:7px;font-size:12px;color:var(--k-ink2)}
.policy-head{display:flex;justify-content:space-between;gap:8px;font-family:var(--k-sans);font-size:13px;font-weight:600;color:var(--k-ink)}
.policy-head>text:first-child{min-width:0;word-break:break-all}
.policy-head .policy-status{margin:0;display:flex;align-items:center;gap:2px;line-height:17px;flex-shrink:0;align-self:flex-start;padding:2px 6px;border-radius:4px;font-family:var(--k-sans);font-size:11px;font-weight:500}
.green{background:var(--k-green-soft);color:var(--k-green)}
.amber{background:var(--k-ochre-soft);color:var(--k-ochre-deep)}
.gray{background:#F5F1EB;color:var(--k-muted)}
.policy-user{display:flex;align-items:center;gap:10px}
.policy-user image{flex-shrink:0;width:36px;height:36px;border-radius:50%;background:var(--k-paper2)}
.policy-user>view{min-width:0;display:flex;flex-direction:column;gap:3px}
.policy-user>view text:first-child{font-family:var(--k-sans);font-size:14px;font-weight:600;color:var(--k-ink)}
.policy-user>view text:last-child{color:var(--k-muted);font-size:11px}
.policy-actions{position:relative;height:39px;margin:3px -12px 0;display:flex}
.policy-actions::before{content:'';position:absolute;left:12px;right:12px;top:0;height:1px;background:var(--k-line);transform:scaleY(.5)}
.policy-actions button{flex:1;display:flex;align-items:center;justify-content:center;gap:7px;color:var(--k-ink2)}
/* 「缴费 / 退费 / 保单」字多：按自己的字宽占位，另外两个平分剩下的，窄屏（320）也不折行、不挤出卡片 */
.policy-actions .pa-reg{flex:0 0 auto;padding-left:10px;padding-right:12px;color:var(--k-red-deep);font-weight:600}
.policy-actions button text{white-space:nowrap}
/* 3 二消订单 */
.resale-tabs{height:44px;display:flex;align-items:center;gap:6px}
.order-card{margin-bottom:8px;padding:12px;border-radius:12px;background:var(--k-paper)}
.order-head{display:flex;justify-content:space-between;gap:8px;font-family:var(--k-sans);font-size:12px;color:var(--k-muted)}
.order-head>text:first-child{min-width:0;word-break:break-all}
.order-head>text:last-child{flex-shrink:0;font-family:var(--k-sans);font-size:12px;font-weight:600}
.order-head .amber{background:none}
.order-head .green{background:none}
.order-head .gray{background:none}
.order-main{display:flex;gap:10px;margin-top:8px}
.order-main image{flex-shrink:0;width:72px;height:72px;border-radius:8px;background:var(--k-paper2)}
.order-main>view{min-width:0;flex:1;display:flex;flex-direction:column;gap:3px;color:var(--k-muted);font-size:11px}
.order-main>view text:first-child{font-family:var(--k-sans);font-size:14px;font-weight:600;line-height:20px;color:var(--k-ink)}
.order-bottom{margin-top:8px;display:flex;align-items:center;justify-content:space-between}
.order-bottom>text{font-size:18px;font-weight:700;color:var(--k-red);font-variant-numeric:tabular-nums}
/* 每张订单都有的「去核销」是词典「小按钮」浅色胶囊（28 高、12 / 500）；不可点是原配色整体变淡 */
.order-bottom button{min-width:72px;height:28px;padding:0 12px;border-radius:999px;background:var(--k-red-soft);color:var(--k-red-deep);font-family:var(--k-sans);font-size:12px;font-weight:500}
.order-bottom button.disabled{background:var(--k-red-soft);color:var(--k-red-deep);opacity:.45}
/* 4 扫码核销与退款：第一个页签一直带 active，没选中时由行内样式（vOff：深色字、去掉下划线）盖回去，所以选中态只动字色和下划线。
   下划线仍是 border-bottom（vOff 才盖得掉），用 border-image 只画中间 18 宽的一小段，和别的页签一样是一道短线；不认 border-image 的环境退回整条下划线 */
.verify-tabs{height:40px;padding-bottom:4px;box-sizing:border-box;border-radius:12px;background:var(--k-paper);display:flex;overflow:hidden}
.verify-tabs text{flex:1;padding-top:4px;display:flex;align-items:center;justify-content:center;font-family:var(--k-sans);font-size:14px;font-weight:600}
.verify-tabs .active{color:var(--k-red-deep);border-bottom:2px solid var(--k-red);border-image:linear-gradient(90deg,transparent calc(50% - 9px),var(--k-red) calc(50% - 9px),var(--k-red) calc(50% + 9px),transparent calc(50% + 9px)) 1}
.scanner{height:200px;margin-top:8px;border-radius:12px;background:linear-gradient(135deg,#262827,#101212);display:flex;flex-direction:column;align-items:center;justify-content:center;color:#fff}
.scan-frame{position:relative;width:170px;height:105px;background:rgba(255,255,255,.06);border-bottom:2px solid rgba(218,192,147,.35)}
.corner{position:absolute;width:15px;height:15px;border-color:#fff}
.corner.tl{left:-2px;top:-2px;border-left:2px solid;border-top:2px solid}
.corner.tr{right:-2px;top:-2px;border-right:2px solid;border-top:2px solid}
.corner.bl{left:-2px;bottom:-2px;border-left:2px solid;border-bottom:2px solid}
.corner.br{right:-2px;bottom:-2px;border-right:2px solid;border-bottom:2px solid}
.scanner>text{margin-top:15px;font-size:12px}
.lamp{width:34px;height:34px;margin-top:10px;border-radius:50%;background:#191B1B;display:flex;align-items:center;justify-content:center}
.or{display:block;margin:12px 2px 6px;font-family:var(--k-sans);font-size:14px;font-weight:600}
.code-row{display:flex;gap:8px}
.code-row>text{height:40px;min-width:0;flex:1;padding:0 12px;border:1px solid var(--k-line2);border-radius:12px;background:var(--k-paper);color:var(--k-light);display:flex;align-items:center;font-size:14px}
.code-row button{width:72px;border:1px solid var(--k-red-line);border-radius:999px;background:var(--k-paper);color:var(--k-red-deep);font-family:var(--k-sans);font-size:14px;font-weight:600}
.verify-title{display:block;margin:14px 2px 8px;font-family:var(--k-sans);font-size:15px;font-weight:700}
.verify-order,.staff-card{position:relative;padding:12px;border-radius:12px;background:var(--k-paper);display:flex;gap:10px}
.verify-order{margin-bottom:8px}
.verify-order image{flex-shrink:0;width:72px;height:72px;border-radius:8px;background:var(--k-paper2)}
.verify-order>view{min-width:0;flex:1;display:flex;flex-direction:column;gap:3px;color:var(--k-muted);font-size:11px}
.verify-order>view text:first-child{padding-right:72px;font-family:var(--k-sans);font-size:14px;font-weight:600;line-height:20px;color:var(--k-ink)}
.verify-order>view text:last-child text{color:var(--k-red-deep);font-size:14px;font-weight:700}
.verify-order>text{position:absolute;right:12px;top:12px;font-size:12px;font-weight:600;color:var(--k-ochre-deep)}
.staff-card{align-items:center}
.staff-card image{flex-shrink:0;width:40px;height:40px;border-radius:50%;background:var(--k-paper2)}
.staff-card>view{display:flex;flex-direction:column;gap:3px}
.staff-card>view text:first-child{font-family:var(--k-sans);font-size:14px;font-weight:600}
.staff-card>view text:last-child{color:var(--k-muted);font-size:11px}
.confirm{width:100%;height:44px;margin-top:12px;border-radius:22px;background:linear-gradient(135deg,#B5814D,#8E5E33);color:#fff;font-family:var(--k-sans);font-size:16px;font-weight:600}
/* 全局 button 的 line-height 是 inherit，不居中的话「核销」「确认核销」「去核销」「提交投保申请」的字贴在按钮顶上 */
.buy-row>button,.order-bottom button,.code-row button,.confirm{display:flex;align-items:center;justify-content:center}
/* 小程序的 text 里只能放文字，漏斗图标塞在里面真机不显示；筛选格改成 view 包「文字 + 图标」，文字过长时省略 */
.policy-filters>.pf-sort{flex:1 0 auto;min-width:0;height:28px;padding:0 8px;box-sizing:border-box;border-radius:999px;background:var(--k-paper);display:flex;align-items:center;justify-content:center;gap:4px;font-size:12px;color:var(--k-ink2)}
.pf-sort>text{min-width:0;overflow:hidden;white-space:nowrap;text-overflow:ellipsis}
/* 窄屏（≤360）：胶囊的内边距和间隔收一点，四格都放得下 */
@media (max-width:360px){.policy-filters{gap:4px}.policy-filters>.pf-dd,.policy-filters>.pf-sort{padding:0 5px;gap:2px}}
.insurance-readonly{padding:12px 2px;color:var(--k-muted);font-size:12px;line-height:1.6}
</style>

<style scoped>
.policy-status::after,.policy-actions button::after{border:0;pointer-events:none}
.policy-status__arrow{font-size:14px;line-height:1}
.policy-actions{height:auto;min-height:44px}
.policy-actions button{min-width:0;margin:0;padding:10px 4px;gap:4px;font-size:12px;line-height:1.4;white-space:nowrap}
.insurance-readonly{padding:12px 0;color:var(--k-muted);font-size:12px;line-height:1.6}
</style>
