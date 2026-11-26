<template>
  <view class="k-page insurance-account">
    <k-topbar :title="refundQueue ? '保险退费' : '保险缴费与退费'" back :fab="false" />
    <k-subscribe scenes="insurance,finance" label="订阅保险与账户提醒" />
    <view class="body">
      <view class="heading"><text>{{ refundQueue ? '退费跟进' : (state.context.storeName || currentStaffStore?.storeName || '保险办理') }}</text><button :disabled="state.loading || state.busy" hover-class="k-press" @click="reload">刷新状态</button></view>
      <text v-if="!authorized" class="hint">请登录后查看本人保险账户，切换合作商家身份可办理新的投保缴费。</text>
      <text v-if="state.loading" class="hint">正在核对投保、付款及余额记录…</text>
      <view v-if="state.error" class="feedback error"><text>{{ state.error }}</text><button :disabled="state.busy" @click="reload">重新读取</button></view>
      <button v-if="alternativeGrant" class="secondary" :disabled="state.busy || state.loading" @click="switchApplicationGrant">用{{ {manager:'换工主理人',city_lead:'城市负责人',merchant:'合作商家'}[alternativeGrant.roleCode] }}身份查看这条报名</button>
      <text v-if="state.notice" class="feedback" role="status">{{ state.notice }}</text>
      <template v-if="authorized && !state.loading">
        <view v-if="!refundQueue && visibleTabs.length > 1" class="tabs"><button v-for="tab in visibleTabs" :key="tab.key" :class="{on:section===tab.key}" :disabled="state.busy" hover-class="k-press" @click="openTab(tab.key)">{{ tab.label }}</button></view>
        <template v-if="section==='create'">
          <view v-if="!state.context.canApply" class="hint">由合作店家提交申请并缴费。换工主理人可在投保记录中登记真实保单。</view>
          <view v-else class="form">
            <text class="hint">缴费后由换工主理人登记保单。</text>
            <view class="field"><text>投保人员</text><text v-if="applicationId">{{ candidateLabels[candidateIndex] }}</text><picker v-else :disabled="state.busy" :range="candidateLabels" :value="candidateIndex" @change="pickCandidate"><view class="pick">{{ candidateLabels[candidateIndex] || '选择人员' }}<k-icon name="chevron-down" :size="18" color="muted" /></view></picker></view>
            <text v-if="!state.context.candidates?.length" class="hint">当前没有可投保人员。已有申请请在「投保记录」中继续办理；未录用人员需先完成面试和录用确认。</text>
            <view class="field"><text>保险方案</text><picker :disabled="state.busy" :range="planLabels" :value="planIndex" @change="pickPlan"><view class="pick">{{ planLabels[planIndex] || '选择方案' }}<k-icon name="chevron-down" :size="18" color="muted" /></view></picker></view>
            <text v-if="selectedPlan?.desc" class="hint">{{ selectedPlan.desc }}</text>
            <view class="field"><text>拟起保日期</text><button class="pick" :disabled="state.busy" @click="calendar='start'">{{ state.form.startDate || '选择日期' }}<k-icon name="calendar-days" :size="18" color="muted" /></button></view>
            <text v-if="selectedPlan" class="hint">方案 {{ selectedPlan.days }} 天，实际保障起止日期以保险公司出具的保单为准。</text>
            <view class="field"><text>付款方式</text><view class="choices"><button :class="{on:state.form.method==='wechat'}" :disabled="state.busy" @click="state.form.method='wechat'">微信支付</button><button :class="{on:state.form.method==='balance'}" :disabled="state.busy || !balanceEnough" @click="state.form.method='balance'">保险余额</button></view><text class="hint">本人保险余额 ¥{{ money(state.account.balanceFen) }}{{ balanceEnough ? '' : '，不足时请使用微信全额支付' }}</text></view>
            <view class="total"><text>本次保费</text><text class="price">¥{{ selectedPlan ? money(selectedPlan.price) : '—' }}</text></view>
            <button class="primary" :disabled="state.busy || !selectedPlan || candidateIndex<0" @click="submitCreate">{{ state.busy ? '正在处理…' : '确认方案并缴费' }}</button>
          </view>
        </template>
        <template v-else-if="section==='records'">
          <view v-if="selected" class="detail">
            <button v-if="!applicationId || state.rows.length > 1" class="text-button" :disabled="state.busy" @click="controller.choose('')">{{ refundQueue ? '‹ 返回退费列表' : '‹ 返回投保记录' }}</button>
            <view class="record-title"><text>{{ selected.insuredName || '投保人员' }}</text><text class="state">{{ selected.statusLabel || '状态待核实' }}</text></view>
            <text class="hint">{{ selected.planName }} · {{ selected.storeName }}</text>
            <view class="info"><text>付款状态</text><text>{{ paymentLabel(selected) }}</text></view>
            <view class="info"><text>{{ selected.paymentStatus==='legacy' ? '参考保费' : '保费' }}</text><text>¥{{ money(selected.paymentStatus==='legacy' ? selected.referencePriceFen : selected.amountFen) }}</text></view>
            <view v-if="selected.paymentStatus!=='legacy'" class="info"><text>累计已退</text><text>¥{{ money(selected.refundedFen) }}</text></view>
            <view v-if="selected.payNo" class="info"><text>支付单号</text><text selectable>{{ selected.payNo }}</text></view>
            <text v-if="selected.paymentStatus==='legacy'" class="hint">此记录为历史人工办理，没有小程序实付凭证，不能在此缴费或申请退款。</text>
            <text v-else-if="!selected.isPayer" class="hint">退费由付款人申请，款项退回付款人选择的渠道。</text>
            <text v-if="selected.refundRequired" class="feedback">当前投保需要退费处理，请实际付款人选择退款去向并提交申请。</text>
            <view v-if="selected.canPay" class="action"><button class="primary" :disabled="state.busy" @click="controller.pay">{{ state.busy ? '正在处理…' : '继续缴费' }}</button></view>
            <button v-if="selected.canCancel" class="secondary" :disabled="state.busy" @click="controller.cancel">取消未付款申请</button>
            <view v-if="selected.policyNo" class="policy"><text class="title">已登记保单</text><text selectable>{{ selected.policyNo }}</text><text>保障日期：{{ date(selected.startDate) }} 至 {{ date(selected.endDate) }}</text><text class="hint">保障状态以实际保单、有效日期和退保处理结果为准。</text></view>
            <view v-if="selected.refund" class="refund-status">
              <text class="title">退费进度</text>
              <text>{{ selected.policyNo && selected.refund.status==='pending' && !selected.refund.departureDate ? '待店家补充离店日期' : refundLabel(selected.refund) }}</text>
              <text v-if="selected.refund.departureDate">店家填报：{{ selected.refund.departureDate }}</text>
              <text v-if="selected.refund.verifiedDepartureDate">核实离店日期：{{ selected.refund.verifiedDepartureDate }}</text>
              <text>去向：{{ selected.refund.destination==='balance' ? '付款人保险余额' : '原支付渠道' }}</text>
              <text>{{ selected.refund.verifiedDepartureDate && selected.refund.approvedFen == null ? '核定可退' : '申请金额' }} ¥{{ money(selected.refund.amountFen) }}</text>
              <text v-if="selected.refund.approvedFen!=null">核准金额 ¥{{ money(selected.refund.approvedFen) }}</text>
              <text v-if="selected.refund.handleNote">处理说明：{{ selected.refund.handleNote }}</text><text class="hint">{{ selected.refund.reason }}</text>
              <text v-if="['failed','abnormal'].includes(selected.refund.status)" class="hint">请联系平台核对退款渠道状态，不要重复提交。</text>
            </view>
            <view v-if="selected.canRefund && selected.isPayer" class="form subsection">
              <text class="title">申请退费</text><text class="hint">{{ selected.policyNo ? '离店当天算已使用，按剩余保障天数退费，不收手续费。' : '最多可申请 ¥' + money(selected.refundableFen) }}</text>
              <view class="field"><text>退款去向</text><view class="choices"><button :class="{on:state.refundForm.destination==='original'}" :disabled="state.busy || selected.paymentMethod==='balance'" @click="state.refundForm.destination='original'">原路退回</button><button :class="{on:state.refundForm.destination==='balance'}" :disabled="state.busy" @click="state.refundForm.destination='balance'">预存保险余额</button></view><text class="hint">{{ state.refundForm.destination==='balance' ? '到账后保存在本人账号，可抵扣以后整笔保费。' : '经审核通过后，退回此次付款使用的渠道。' }}</text><text v-if="selected.paymentMethod==='balance'" class="hint">余额缴费的费用退回本人保险余额。</text></view>
              <template v-if="selected.policyNo"><view class="field"><text>义工实际离店日期</text><button class="pick" :disabled="state.busy" @click="calendar='departure'">{{ state.refundForm.departureDate || '选择日期' }}</button></view><text class="hint">预计可退 {{ quoteText }}</text></template>
              <view v-else class="field"><text>申请金额（元）</text><input v-model="state.refundForm.amount" :disabled="state.busy" type="digit" maxlength="11" placeholder="填写实际申请金额" /></view>
              <view class="field"><text>退费原因</text><textarea v-model="state.refundForm.reason" :disabled="state.busy" maxlength="500" :placeholder="selected.policyNo ? '其他说明（选填）' : '说明退费原因，供平台核实'" /></view>
              <button class="primary" :disabled="state.busy" @click="controller.refund">{{ state.busy ? '正在提交…' : selected.policyNo ? '提交离店退费申请' : '提交平台审核' }}</button>
            </view>
            <view v-if="selected.canAddDeparture || selected.canVerifyDeparture" class="form subsection">
              <text class="title">{{ selected.canAddDeparture ? '补充离店日期' : '核实义工离店日期' }}</text>
              <button class="pick" :disabled="state.busy" @click="calendar='departure'">{{ state.refundForm.departureDate || '选择实际离店日期' }}</button>
              <text class="hint">按此日期可退 {{ quoteText }}</text>
              <button class="primary" :disabled="state.busy" @click="controller.departure(selected.canAddDeparture ? 'add' : 'verify')">{{ selected.canAddDeparture ? '提交离店日期' : selected.canVerifyAndPayDeparture ? '保存核实结果' : '确认核实结果' }}</button>
            </view>
            <button v-if="selected.canVerifyAndPayDeparture && !payingSaved" class="primary" :disabled="state.busy" @click="controller.departure('verifyPay')">{{ quoteFen === 0 ? '确认零元结案' : '核实并退款 ' + quoteText }}</button>
            <button v-else-if="canSwitchToVerify" class="primary" :disabled="state.busy" @click="openRefundRow(selected, 'manager')">切换到本店换工主理人核实</button>
            <button v-if="selected.canPayDeparture && (!selected.canVerifyAndPayDeparture || payingSaved)" class="primary" :disabled="state.busy" @click="controller.departure('pay')">{{ Number(selected.refund.amountFen) === 0 ? '确认零元结案' : '按已核实日期退款' }} ¥{{ money(selected.refund.amountFen) }}</button>
            <view v-if="selected.canRegister" class="form subsection">
              <text class="title">登记真实保单</text><text class="hint">请按保险公司出具的保单填写，申请日期不能代替实际生效日期。</text>
              <view class="field"><text>保单号</text><input v-model="state.policyForm.policyNo" :disabled="state.busy" maxlength="64" placeholder="填写保险公司出具的真实保单号" /></view>
              <view class="field"><text>保障开始日期</text><button class="pick" :disabled="state.busy" @click="calendar='policyStart'">{{ state.policyForm.startDate || '选择日期' }}<k-icon name="calendar-days" :size="18" color="muted" /></button></view>
              <view class="field"><text>保障结束日期</text><button class="pick" :disabled="state.busy" @click="calendar='policyEnd'">{{ state.policyForm.endDate || '选择日期' }}<k-icon name="calendar-days" :size="18" color="muted" /></button></view>
              <button class="primary" :disabled="state.busy" @click="controller.register">{{ state.busy ? '正在保存…' : '核对并保存保单' }}</button>
            </view>
          </view>
          <template v-else>
            <text v-if="!state.error && !state.rows.length" class="hint">{{ refundQueue ? '当前授权范围暂无待跟进的保险退费。' : applicationId ? '这条报名暂无投保记录。' : '当前授权范围暂无投保记录。店家可从「投保缴费」选择人员办理。' }}</text>
            <button v-for="r in state.rows" :key="r.applyId" class="record" hover-class="k-press" @click="refundQueue ? openRefundRow(r) : controller.choose(r.applyId)">
              <view><text class="title">{{ r.insuredName || '投保人员' }}</text><text class="state">{{ r.statusLabel || '状态待核实' }}</text></view>
              <text>{{ r.planName || '保险方案' }} · {{ refundQueue ? r.storeName : paymentLabel(r) }}</text>
              <text>{{ r.paymentStatus==='legacy' ? '参考保费' : '保费' }} ¥{{ money(r.paymentStatus==='legacy' ? r.referencePriceFen : r.amountFen) }}<text class="next" v-if="refundQueue && r.canVerifyDeparture">核实离店日期 ›</text><text class="next" v-else>{{ refundQueue && !r.canPayDeparture && currentStaffStore?.roleCode==='city_lead' ? '查看进度 ›' : '查看办理 ›' }}</text></text>
              <text v-if="r.refund">{{ r.policyNo && r.refund.status==='pending' && !r.refund.departureDate ? '待店家补充离店日期' : refundLabel(r.refund) }}</text>
            </button>
          </template>
        </template>
        <template v-else>
          <view class="account-summary"><text class="title">本人保险余额</text><text class="amount">¥{{ money(state.account.balanceFen) }}</text><text class="hint">由退费预存形成，可用于以后缴纳保险。该余额独立记录，不计入分佣收益。</text></view>
          <text class="title">余额明细</text><text v-if="!state.account.entries?.length" class="hint">暂无保险余额收支记录。</text>
          <view v-for="entry in state.account.entries" :key="entry.entryId" class="entry"><view><text>{{ entryLabel(entry.type) }}</text><text>{{ Number(entry.amountFen)>0 ? '+' : '' }}{{ money(entry.amountFen) }}</text></view><text class="hint">{{ entry.createdAt || entry.createTime }} · 余额 ¥{{ money(entry.balanceAfterFen) }}</text><button v-if="entry.applyId" class="text-button" @click="openEntry(entry.applyId)">查看关联投保记录 ›</button></view>
        </template>
      </template>
    </view>
    <k-date-picker v-if="calendar" :title="calendar==='departure' ? '选择义工实际离店日期' : calendar==='start' ? '选择拟起保日期' : '选择保单保障日期'" :value="calendarValue" :min-date="calendarMin()" :max-date="calendarMax()" @cancel="calendar=''" @confirm="setDate" />
  </view>
</template>
<script setup>
import { reactive, ref, computed, watch } from 'vue'
import { onLoad, onShow, onHide, onUnload } from '@dcloudio/uni-app'
import { experience, ensureSession, currentStaffStore, getMessageScopeKey, getSessionRevision, setStaffStore, switchMode } from '@/common/experience.js'
import { getToken } from '@/common/request.js'
import { confirm, todayCn, shiftDate } from '@/common/ui.js'
import { payFlow } from '@/common/pay-flow.js'
import { insuranceApi } from './insurance-api.js'
import { initialFinanceState, createInsuranceFinance, departureQuote, money, paymentLabel, refundLabel } from './insurance-finance.js'
const state = reactive(initialFinanceState()), section = ref('records'), calendar = ref(''), requestedStore = ref('')
const refundQueue = ref(false)
const applicationId = ref('')
const authorized = computed(() => !!getToken() && !!experience.account)
const scope = () => JSON.stringify([getMessageScopeKey(), getSessionRevision(), requestedStore.value])
const api = { ...insuranceApi, context: () => insuranceApi.context(requestedStore.value || undefined), rows: () => insuranceApi.rows(requestedStore.value || undefined) }
const controller = createInsuranceFinance({ state, api, scope, allowed: () => authorized.value, confirm, payFlow, refundTasksOnly: () => refundQueue.value, applicationId: () => applicationId.value })
const tabs = [{ key:'create',label:'投保缴费' },{ key:'records',label:'投保记录' },{ key:'account',label:'本人余额' }]
const visibleTabs = computed(() => applicationId.value ? tabs.filter(t => t.key==='records' || (t.key==='create' && state.context.canApply)) : tabs)
const selected = computed(() => controller.row())
function taskGrant(storeId, role) {
  if (!storeId || !['manager','city_lead'].includes(role)) return null
  return experience.account?.staffGrants?.find(g => g.active === true && !g.sharedRecruitment
    && String(g.storeId) === String(storeId) && g.roleCode === role)
}
const canSwitchToVerify = computed(() => {
  const r = selected.value
  // 被保险人、付款人本人回避：换哪个岗位都不能办，不提示切换
  return !applicationId.value && !refundQueue.value && !r?.selfRecused && !r?.canVerifyDeparture && r?.refund?.status === 'pending'
    && !!r.refund.departureDate && !r.refund.verifiedDepartureDate && !!taskGrant(r.storeId, 'manager')
    && (experience.mode !== 'staff' || currentStaffStore.value?.roleCode !== 'manager' || String(currentStaffStore.value?.storeId) !== String(r.storeId))
})
const alternativeGrant = computed(() => {
  if (!applicationId.value || state.loading) return null
  const r = selected.value, pending = r?.refund?.status === 'pending' && r.refund.departureDate
  if (!state.readForbidden && (!pending || r.selfRecused || r.canVerifyDeparture || r.canPayDeparture)) return null
  const store = String(r?.storeId || state.context.storeId || requestedStore.value)
  const roles = r?.refund?.verifiedDepartureDate ? ['city_lead'] : ['manager','city_lead']
  if (state.readForbidden) roles.push('merchant')
  const current = currentStaffStore.value
  const grants = (experience.account?.staffGrants || []).filter(g => g.active === true)
  const matches = g => !g.sharedRecruitment && !isSelectedGrant(g)
  for (const role of roles) {
    const direct = grants.find(g => String(g.storeId) === store && g.roleCode === role && matches(g))
    if (direct) return direct
  }
  // 同城授权可能挂在另一家门店；只提供身份切换，实际是否可办理仍由接口逐次核验。
  const target = grants.find(g => String(g.storeId) === store)
  const sameCity = g => g && target && ((g.cityId != null && target.cityId != null && String(g.cityId) === String(target.cityId)) || (g.city && g.city === target.city))
  if (roles.includes('city_lead') && !(experience.mode === 'staff' && current?.roleCode === 'city_lead' && sameCity(current))) {
    return grants.find(g => g.roleCode === 'city_lead' && (g.storeId != null || g.cityId != null) && sameCity(g) && matches(g))
  }
  return null
})
const quoteFen = computed(() => selected.value ? departureQuote(selected.value, state.refundForm.departureDate) : null)
const quoteText = computed(() => quoteFen.value == null ? '—' : '¥' + money(quoteFen.value))
// 城市负责人选的日期和已核实日期相同：只留「按已核实日期退款」，不再同时出现效果一样的「核实并退款」
const payingSaved = computed(() => !!selected.value?.canPayDeparture && !!selected.value?.refund?.verifiedDepartureDate
  && state.refundForm.departureDate === selected.value.refund.verifiedDepartureDate)
const candidates = computed(() => state.context.candidates || []), plans = computed(() => state.context.plans || [])
const candidateLabels = computed(() => candidates.value.map(r => `${r.name || r.insuredName || '待核实'} · ${r.jobTitle || r.title || ''}`))
const planLabels = computed(() => plans.value.map(r => `${r.name || r.planName} · ¥${money(r.price)} / ${r.days}天`))
const candidateIndex = computed(() => candidates.value.findIndex(r => String(r.appId)===String(state.form.appId)))
const planIndex = computed(() => plans.value.findIndex(r => String(r.planId)===String(state.form.planId)))
const selectedPlan = computed(() => plans.value[planIndex.value])
const balanceEnough = computed(() => selectedPlan.value && Number(state.account.balanceFen)>=Number(selectedPlan.value.price))
const date = v => String(v || '待核实').slice(0,10)
function earliestStart() {
  const today=todayCn()
  const afterPrevious=shiftDate(String(candidates.value[candidateIndex.value]?.lastEnd || '').slice(0,10),1)
  return afterPrevious > today ? afterPrevious : today
}
function defaultStart() {
  const earliest=earliestStart(), arrival=String(candidates.value[candidateIndex.value]?.arrivalDate || '').slice(0,10)
  const suggested=arrival > earliest ? arrival : earliest
  return suggested <= shiftDate(todayCn(),90) ? suggested : ''
}
function calendarMin() {
  if(calendar.value==='start') return earliestStart()
  if(calendar.value==='policyEnd' && state.policyForm.startDate) return state.policyForm.startDate
  return '2000-01-01'
}
function calendarMax() {
  if(calendar.value==='start') return shiftDate(todayCn(),90)
  if(calendar.value==='departure') return todayCn()
  return '2099-12-31'
}
const calendarValue = computed(() => {
  if(calendar.value==='departure') return state.refundForm.departureDate || todayCn()
  if(calendar.value==='start') return state.form.startDate || defaultStart()
  if(calendar.value==='policyStart') return state.policyForm.startDate || todayCn()
  return state.policyForm.endDate || state.policyForm.startDate || todayCn()
})
function setDate(v) { if (calendar.value==='departure') state.refundForm.departureDate=v; else if (calendar.value==='start') state.form.startDate=v; else if(calendar.value==='policyStart') state.policyForm.startDate=v; else state.policyForm.endDate=v; calendar.value='' }
function pickCandidate(e) {
  const id=candidates.value[Number(e.detail.value)]?.appId || ''
  if(String(id)===String(state.form.appId)) return
  state.form.appId=id
  state.form.startDate=defaultStart()
}
function pickPlan(e) { state.form.planId=plans.value[Number(e.detail.value)]?.planId || ''; if(!balanceEnough.value) state.form.method='wechat' }
function openTab(v) {
  if (state.busy) return
  section.value=v; controller.choose('')
  if (applicationId.value && v==='create') prepareApplicationForm()
}
function prepareApplicationForm() {
  state.form.appId=applicationId.value
  state.form.planId=String(plans.value[0]?.planId || '')
  state.form.startDate=defaultStart()
}
async function openEntry(id) { section.value='records'; await controller.openRecord(id) }
const entryLabel = type => ({ insurance_refund:'退费预存',refund:'退费预存',refund_credit:'退费预存',payment:'缴纳保费',payment_debit:'缴纳保费',cancel:'撤销返还',refund_balance:'退费预存',insurance_payment:'缴纳保费' }[type] || '保险余额变动')
let initialQuery = {}, entered = false, visible = false, scopeReady = false
let resumeRecordId = ''
let selectingTaskGrant = false
function isSelectedGrant(grant) {
  const current = currentStaffStore.value
  if (!current || experience.mode !== 'staff' || current.roleCode !== grant.roleCode) return false
  if (grant.storeId != null) return String(current.storeId) === String(grant.storeId)
  return current.storeId == null && String(current.cityId) === String(grant.cityId)
}
function selectTaskGrant(storeId, role) {
  return useInsuranceGrant(taskGrant(storeId, role))
}
function useInsuranceGrant(grant) {
  if (!grant || isSelectedGrant(grant)) return false
  selectingTaskGrant = true
  try {
    setStaffStore(grant)
    if (experience.mode !== 'staff') switchMode('staff')
    return true
  } finally { selectingTaskGrant = false }
}
async function openRefundRow(r, role = currentStaffStore.value?.roleCode) {
  if (!r || state.busy || state.loading) return
  const id = r.applyId
  // 城市负责人从本城队列查看多家门店，保留当前城市范围。换工主理人的核实权限按具体门店核对。
  const switched = role === 'manager' && selectTaskGrant(r.storeId, role)
  if (switched || !refundQueue.value) {
    applicationId.value = ''
    refundQueue.value = true
    section.value = 'records'
    if (!(await controller.show())) return
  }
  await controller.openRecord(id)
}
async function switchApplicationGrant() {
  const grant = alternativeGrant.value
  const policyId = state.selectedId
  if (!grant || state.busy || state.loading || !useInsuranceGrant(grant)) return
  entered=false; resumeRecordId=policyId; section.value='records'
  await reload()
}
async function enter() {
  visible=true; await ensureSession(); if(!visible) return
  if (!entered && initialQuery.applyId && requestedStore.value) {
    const role = initialQuery.registrationRole || initialQuery.refundRole || (experience.mode === 'staff' && currentStaffStore.value?.roleCode === 'manager' ? 'manager' : '')
    selectTaskGrant(requestedStore.value, role)
  }
  if (refundQueue.value && experience.mode === 'staff' && currentStaffStore.value?.roleCode === 'manager' && currentStaffStore.value.sharedRecruitment) {
    const managed = experience.account?.staffGrants?.find(g => g.active === true && g.roleCode === 'manager' && g.storeId && !g.sharedRecruitment)
    if (managed) selectTaskGrant(managed.storeId, 'manager')
  }
  scopeReady=true
  await reload()
}
async function reload() {
  if(!visible || !scopeReady) return
  const ok=await controller.show(); if(!ok) return
  if (applicationId.value && section.value==='create') {
    if (!state.context.canApply) section.value='records'
    else if (!state.form.appId) prepareApplicationForm()
  }
  if(!state.form.startDate && !state.form.appId) state.form.startDate=todayCn()
  if(resumeRecordId) {
    const id=resumeRecordId
    resumeRecordId=''
    entered=true
    section.value='records'
    await controller.openRecord(id)
    if (applicationId.value && !state.selectedId) state.notice='当前身份下已找不到刚才查看的保单，请重新选择。'
  } else if(!entered) {
    entered=true
    if(applicationId.value) {
      if (state.rows.length) { section.value='records'; controller.choose(state.rows[0].applyId) }
      else if (state.context.canApply) openTab('create')
      else section.value='records'
    } else if(initialQuery.applyId) { section.value='records'; await controller.openRecord(initialQuery.applyId) }
    else if(initialQuery.appId) {
      state.form.appId=String(initialQuery.appId); state.form.planId=String(initialQuery.planId || plans.value[0]?.planId || '')
      state.form.startDate=/^\d{4}-\d{2}-\d{2}$/.test(initialQuery.startDate || '') ? initialQuery.startDate : defaultStart(); section.value='create'
    }
  }
}
async function submitCreate() {
  const start=state.form.startDate, min=earliestStart(), max=shiftDate(todayCn(),90)
  if(!start || start < min || start > max || shiftDate(start,0)!==start) {
    state.error='起保日期可选 '+min+' 至 '+max
    return
  }
  await controller.create()
  if(state.selectedId) section.value='records'
}
onLoad(q => { initialQuery=q || {}; requestedStore.value=String(q?.storeId || ''); applicationId.value=String(q?.applicationId || ''); refundQueue.value=!applicationId.value && q?.tab==='refunds'; if(!applicationId.value && q?.tab==='account') section.value='account' })
onShow(enter)
onHide(() => { visible=false; if(state.selectedId) resumeRecordId=state.selectedId; calendar.value=''; controller.hide() })
onUnload(() => { visible=false; controller.hide() })
watch(() => JSON.stringify([getMessageScopeKey(), getSessionRevision()]), () => {
  if (!scopeReady) return
  controller.invalidate()
  calendar.value=''; resumeRecordId=''
  if (selectingTaskGrant) return
  if (!applicationId.value) requestedStore.value=''
  entered=false; initialQuery={}
  refundQueue.value=refundQueue.value && experience.mode==='staff' && ['manager','city_lead'].includes(currentStaffStore.value?.roleCode)
  if (visible) enter()
}, { flush:'sync' })
</script>
<style scoped>
/* 2026-11-17 改版「小而精」：浅灰底 + 白卡（12 圆角、不描边、不加阴影），页边距 12、卡片之间 8。
   三个页签是 40 高的白色胶囊；投保记录、余额明细一条一张白卡，状态是一枚小标签；余额是一张很浅的暖色卡。
   填写的地方（投保缴费、申请退费、登记保单）还是大字：字段名和输入 16、输入框和主按钮 48 高、选项是平的奶油色方块。文字、金额、政策说明一个字没动 */
.insurance-account{--k-bg:#F7F5F2;--k-sh1:none;background:#F7F5F2}
.insurance-account :deep(.k-navbar__title){font-family:var(--k-sans);font-size:16px;font-weight:600}
.body{max-width:720px;margin:0 auto;padding:8px 12px calc(32px + env(safe-area-inset-bottom));font-size:14px;line-height:1.65;color:var(--k-ink)}
button{margin:0;box-sizing:border-box;font:inherit;min-height:48px;line-height:1.5;border-radius:12px;background:var(--k-paper2);color:var(--k-ink);padding:12px 14px}
button::after{border:0}
button[disabled]{opacity:.45}
input,textarea{box-sizing:border-box;width:100%;border:1px solid var(--k-line2);border-radius:12px;padding:12px;font-size:16px;background:var(--k-paper);color:var(--k-ink)}
input{height:48px}
textarea{height:112px}
.heading,.info,.total,.entry>view,.record>view{display:flex;gap:14px;justify-content:space-between;align-items:center}
.heading{margin-bottom:2px}
.heading>text{min-width:0;font-size:17px;font-weight:700;line-height:24px}
.heading>button{min-height:44px;padding:10px 0 10px 12px;background:transparent;color:var(--k-red-deep);font-size:13px;flex-shrink:0}
.hint{display:block;color:var(--k-muted);margin:8px 2px;font-size:13px;line-height:1.7}
.feedback{display:block;padding:12px;margin:8px 0;background:var(--k-paper2);border-radius:12px;font-size:13px;white-space:pre-wrap;overflow-wrap:anywhere}
.error{color:var(--k-alert);background:var(--k-alert-soft)}
.error button{margin-top:10px;background:var(--k-paper)}
.tabs{display:flex;gap:6px;margin:6px 0 10px}
.tabs>button{flex:1;min-height:40px;padding:8px 4px;border-radius:999px;background:var(--k-paper);font-size:13px;color:var(--k-ink2)}
.on{background:var(--k-red-deep)!important;color:var(--k-paper)!important}
.tabs>.on{background:linear-gradient(135deg,#B5814D,#8E5E33)!important;font-weight:600}
/* 填写区：一张白卡，里面的字号、控件高度按填写页的规定 */
.form{padding:2px 12px 14px;border-radius:12px;background:var(--k-paper)}
.form .hint{margin:10px 0;font-size:14px}
.field{margin:16px 0}
.field>text:first-child{display:block;font-size:16px;font-weight:600;margin-bottom:8px}
.pick{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:12px;border:1px solid var(--k-line2);border-radius:12px;background:var(--k-paper);min-height:48px;box-sizing:border-box;width:100%;font-size:16px}
.choices{display:flex;gap:8px}
.choices>button{flex:1}
.total{padding:14px 0 4px;font-size:16px}
.total .price{font-size:22px;font-weight:700;color:var(--k-red-deep)}
.primary{width:100%;background:var(--k-red-deep);color:var(--k-paper);font-size:17px;font-weight:600;margin-top:12px}
.secondary{width:100%;margin-top:12px}
.title{font-size:16px;font-weight:700;line-height:24px;display:block}
.text-button{min-height:44px;padding:10px 0;color:var(--k-red-deep);background:transparent;text-align:left;font-size:14px}
/* 一条投保记录的办理页：一张白卡，里面一行一项 */
.detail{padding:2px 12px 14px;border-radius:12px;background:var(--k-paper)}
.detail .hint{margin-left:0;margin-right:0}
.subsection{padding:18px 0 0;border-top:1px solid var(--k-line);border-radius:0;margin-top:18px}
.info{padding:10px 0;border-bottom:1px solid var(--k-line);align-items:flex-start}
.info>text:first-child{flex-shrink:0;color:var(--k-muted)}
.info>text:last-child{text-align:right;overflow-wrap:anywhere}
.record-title{display:flex;flex-wrap:wrap;gap:8px;align-items:center;font-size:17px;font-weight:700;line-height:24px;margin:4px 0}
.state{flex-shrink:0;height:17px;padding:0 5px;border-radius:4px;background:var(--k-red-soft);font-size:10px;font-weight:500;line-height:17px;color:var(--k-red-deep)}
.record{width:100%;min-height:0;display:flex;flex-direction:column;gap:4px;text-align:left;margin-bottom:8px;padding:12px;background:var(--k-paper);border-radius:12px}
.record>view{width:100%;align-items:center}
.record .title{min-width:0;font-size:15px;font-weight:600;line-height:22px}
.record>text{width:100%;font-size:12px;line-height:18px;color:var(--k-muted)}
.next{float:right;color:var(--k-red-deep);margin-left:8px}
.policy,.refund-status{padding:14px 0 0;display:flex;flex-direction:column;gap:6px;overflow-wrap:anywhere}
.refund-status{border-top:1px solid var(--k-line);margin-top:14px}
.policy .hint,.refund-status .hint{margin:0}
.account-summary{padding:14px 12px;margin-bottom:6px;border-radius:12px;background:linear-gradient(180deg,#FFF8EE,var(--k-paper))}
.account-summary .title{font-size:13px;font-weight:500;line-height:18px;color:var(--k-ink2)}
.account-summary .hint{margin:0;font-size:12px}
.amount{display:block;font-size:26px;line-height:34px;color:var(--k-red-deep);font-weight:700;margin:2px 0 4px}
.body>.title{margin:14px 2px 8px;font-size:15px;line-height:22px}
.entry{margin-bottom:8px;padding:12px;border-radius:12px;background:var(--k-paper)}
.entry>view>text:last-child{font-weight:600}
.entry .hint{margin:2px 0 0;font-size:12px}
.entry .text-button{display:block;min-height:36px;margin:4px 0 -8px;padding:6px 0;font-size:13px}
/* 2026-11-18 评审修正：三个页签从三枚分开的大胶囊（选中是整块棕色渐变，像三个按钮）改成和别的页面一样的分段条 —— 灰米色轨道 + 白色选中块 + 棕色粗字，每格 36 高；字号 13 不变。
   页签下面的说明文字左边和标题「保险办理」对齐到 12（之前多缩进 2） */
/* 11-18 精修词典「分段控件」：#F0EBE4 轨道 32 高、圆角 16、内边距 2；选中是白块 13 / 600 / 墨色，未选 13 / 400 / 深灰。付款方式那组选项（全局 .on 实心棕）不动 */
.tabs{box-sizing:border-box;height:32px;align-items:center;gap:0;padding:2px;border-radius:16px;background:#F0EBE4}
.tabs>button{min-height:28px;height:28px;padding:0 4px;line-height:28px;border-radius:14px;background:transparent;font-size:13px;color:var(--k-ink2)}
.tabs>.on{background:var(--k-paper)!important;color:var(--k-ink)!important;font-weight:600}
.hint{margin-left:0;margin-right:0}
</style>
