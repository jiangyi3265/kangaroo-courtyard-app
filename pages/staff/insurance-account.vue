<template>
  <view class="k-page insurance-account">
    <k-topbar title="保险缴费与退费" back :fab="false" />
    <k-subscribe scenes="insurance,finance" label="订阅保险与账户提醒" />
    <view class="body">
      <view class="heading"><text>{{ state.context.storeName || currentStaffStore?.storeName || '保险办理' }}</text><button :disabled="state.loading || state.busy" hover-class="k-press" @click="reload">刷新状态</button></view>
      <text v-if="!authorized" class="hint">请登录后查看本人保险账户，切换合作商家身份可办理新的投保缴费。</text>
      <text v-if="state.loading" class="hint">正在核对投保、付款及余额记录…</text>
      <view v-if="state.error" class="feedback error"><text>{{ state.error }}</text><button :disabled="state.busy" @click="reload">重新读取</button></view>
      <text v-if="state.notice" class="feedback" role="status">{{ state.notice }}</text>
      <template v-if="authorized && !state.loading">
        <view class="tabs"><button v-for="tab in tabs" :key="tab.key" :class="{on:section===tab.key}" :disabled="state.busy" hover-class="k-press" @click="openTab(tab.key)">{{ tab.label }}</button></view>
        <template v-if="section==='create'">
          <view v-if="!state.context.canApply" class="hint">由合作店家提交申请并缴费。换工主理人可在投保记录中登记真实保单。</view>
          <view v-else class="form">
            <text class="hint">请选择已通过面试和录用确认的人员，缴费后由换工主理人登记保单。</text>
            <view class="field"><text>投保人员</text><picker :disabled="state.busy" :range="candidateLabels" :value="candidateIndex" @change="pickCandidate"><view class="pick">{{ candidateLabels[candidateIndex] || '选择人员' }}<text>⌄</text></view></picker></view>
            <text v-if="!state.context.candidates?.length" class="hint">当前没有可投保人员。已有申请请在「投保记录」中继续办理；未录用人员需先完成面试和录用确认。</text>
            <view class="field"><text>保险方案</text><picker :disabled="state.busy" :range="planLabels" :value="planIndex" @change="pickPlan"><view class="pick">{{ planLabels[planIndex] || '选择方案' }}<text>⌄</text></view></picker></view>
            <text v-if="selectedPlan?.desc" class="hint">{{ selectedPlan.desc }}</text>
            <view class="field"><text>拟起保日期</text><button class="pick" :disabled="state.busy" @click="calendar='start'">{{ state.form.startDate || '选择日期' }}<k-icon name="calendar-days" :size="20" /></button></view>
            <text v-if="selectedPlan" class="hint">方案 {{ selectedPlan.days }} 天，实际保障起止日期以保险公司出具的保单为准。</text>
            <view class="field"><text>付款方式</text><view class="choices"><button :class="{on:state.form.method==='wechat'}" :disabled="state.busy" @click="state.form.method='wechat'">微信支付</button><button :class="{on:state.form.method==='balance'}" :disabled="state.busy || !balanceEnough" @click="state.form.method='balance'">保险余额</button></view><text class="hint">本人保险余额 ¥{{ money(state.account.balanceFen) }}{{ balanceEnough ? '' : '，不足时请使用微信全额支付' }}</text></view>
            <view class="total"><text>本次保费</text><text class="price">¥{{ selectedPlan ? money(selectedPlan.price) : '—' }}</text></view>
            <button class="primary" :disabled="state.busy || !selectedPlan || candidateIndex<0" @click="submitCreate">{{ state.busy ? '正在处理…' : '确认方案并缴费' }}</button>
          </view>
        </template>
        <template v-else-if="section==='records'">
          <view v-if="selected" class="detail">
            <button class="text-button" :disabled="state.busy" @click="controller.choose('')">‹ 返回投保记录</button>
            <view class="record-title"><text>{{ selected.insuredName || '投保人员' }}</text><text class="state">{{ selected.statusLabel || '状态待核实' }}</text></view>
            <text class="hint">{{ selected.planName }} · {{ selected.storeName }}</text>
            <view class="info"><text>付款状态</text><text>{{ paymentLabel(selected) }}</text></view>
            <view class="info"><text>{{ selected.paymentStatus==='legacy' ? '参考保费' : '保费' }}</text><text>¥{{ money(selected.paymentStatus==='legacy' ? selected.referencePriceFen : selected.amountFen) }}</text></view>
            <view v-if="selected.paymentStatus!=='legacy'" class="info"><text>累计已退</text><text>¥{{ money(selected.refundedFen) }}</text></view>
            <view v-if="selected.payNo" class="info"><text>支付单号</text><text selectable>{{ selected.payNo }}</text></view>
            <text v-if="selected.paymentStatus==='legacy'" class="hint">此记录为历史人工办理，没有小程序实付凭证，不能在此缴费或申请退款。</text>
            <text v-else-if="!selected.isPayer" class="hint">缴费和退费由实际付款账号办理，资金不会退到被保险人或其他工作人员账号。</text>
            <text v-if="selected.refundRequired" class="feedback">当前投保需要退费处理，请实际付款人选择退款去向并提交申请。</text>
            <view v-if="selected.canPay" class="action"><button class="primary" :disabled="state.busy" @click="controller.pay">{{ state.busy ? '正在处理…' : '继续缴费' }}</button></view>
            <button v-if="selected.canCancel" class="secondary" :disabled="state.busy" @click="controller.cancel">取消未付款申请</button>
            <view v-if="selected.policyNo" class="policy"><text class="title">已登记保单</text><text selectable>{{ selected.policyNo }}</text><text>保障日期：{{ date(selected.startDate) }} 至 {{ date(selected.endDate) }}</text><text class="hint">保障状态以实际保单、有效日期和退保处理结果为准。</text></view>
            <view v-if="selected.refund" class="refund-status"><text class="title">退费进度</text><text>{{ refundLabel(selected.refund) }}</text><text>去向：{{ selected.refund.destination==='balance' ? '本人保险余额' : '原支付渠道' }}</text><text>申请金额 ¥{{ money(selected.refund.amountFen) }}</text><text v-if="selected.refund.approvedFen!=null">核准金额 ¥{{ money(selected.refund.approvedFen) }}</text><text v-if="selected.refund.handleNote">处理说明：{{ selected.refund.handleNote }}</text><text class="hint">{{ selected.refund.reason }}</text><text v-if="['failed','abnormal'].includes(selected.refund.status)" class="hint">请联系平台核对退款渠道状态，不要重复提交。</text></view>
            <view v-if="selected.canRefund && selected.isPayer" class="form subsection">
              <text class="title">申请退费</text><text class="hint">未住满一个月不代表保费自动按天退还。平台核实实际可退金额后处理，最多可申请 ¥{{ money(selected.refundableFen) }}。</text>
              <view class="field"><text>退款去向</text><view class="choices"><button :class="{on:state.refundForm.destination==='original'}" :disabled="state.busy || selected.paymentMethod==='balance'" @click="state.refundForm.destination='original'">原路退回</button><button :class="{on:state.refundForm.destination==='balance'}" :disabled="state.busy" @click="state.refundForm.destination='balance'">预存保险余额</button></view><text class="hint">{{ state.refundForm.destination==='balance' ? '到账后保存在本人账号，可抵扣以后整笔保费。' : '经审核通过后，退回此次付款使用的渠道。' }}</text><text v-if="selected.paymentMethod==='balance'" class="hint">余额缴费的费用退回本人保险余额。</text></view>
              <view class="field"><text>申请金额（元）</text><input v-model="state.refundForm.amount" :disabled="state.busy" type="digit" maxlength="11" placeholder="填写实际申请金额" /></view>
              <view class="field"><text>退费原因</text><textarea v-model="state.refundForm.reason" :disabled="state.busy" maxlength="500" placeholder="说明退费原因，供平台核实" /></view>
              <button class="primary" :disabled="state.busy" @click="controller.refund">{{ state.busy ? '正在提交…' : '提交平台审核' }}</button>
            </view>
            <view v-if="selected.canRegister" class="form subsection">
              <text class="title">登记真实保单</text><text class="hint">请按保险公司出具的保单填写，申请日期不能代替实际生效日期。</text>
              <view class="field"><text>保单号</text><input v-model="state.policyForm.policyNo" :disabled="state.busy" maxlength="64" placeholder="填写保险公司出具的真实保单号" /></view>
              <view class="field"><text>保障开始日期</text><button class="pick" :disabled="state.busy" @click="calendar='policyStart'">{{ state.policyForm.startDate || '选择日期' }}<k-icon name="calendar-days" :size="20" /></button></view>
              <view class="field"><text>保障结束日期</text><button class="pick" :disabled="state.busy" @click="calendar='policyEnd'">{{ state.policyForm.endDate || '选择日期' }}<k-icon name="calendar-days" :size="20" /></button></view>
              <button class="primary" :disabled="state.busy" @click="controller.register">{{ state.busy ? '正在保存…' : '核对并保存保单' }}</button>
            </view>
          </view>
          <template v-else><text v-if="!state.rows.length" class="hint">当前授权范围暂无投保记录。店家可从「投保缴费」选择人员办理。</text><button v-for="r in state.rows" :key="r.applyId" class="record" hover-class="k-press" @click="controller.choose(r.applyId)"><view><text class="title">{{ r.insuredName || '投保人员' }}</text><text class="state">{{ r.statusLabel || '状态待核实' }}</text></view><text>{{ r.planName || '保险方案' }} · {{ paymentLabel(r) }}</text><text>{{ r.paymentStatus==='legacy' ? '参考保费' : '保费' }} ¥{{ money(r.paymentStatus==='legacy' ? r.referencePriceFen : r.amountFen) }}<text class="next">查看办理 ›</text></text><text v-if="r.refund">{{ refundLabel(r.refund) }}</text></button></template>
        </template>
        <template v-else>
          <view class="account-summary"><text class="title">本人保险余额</text><text class="amount">¥{{ money(state.account.balanceFen) }}</text><text class="hint">由退费预存形成，可用于以后缴纳保险。该余额独立记录，不计入分佣收益。</text></view>
          <text class="title">余额明细</text><text v-if="!state.account.entries?.length" class="hint">暂无保险余额收支记录。</text>
          <view v-for="entry in state.account.entries" :key="entry.entryId" class="entry"><view><text>{{ entryLabel(entry.type) }}</text><text>{{ Number(entry.amountFen)>0 ? '+' : '' }}{{ money(entry.amountFen) }}</text></view><text class="hint">{{ entry.createdAt || entry.createTime }} · 余额 ¥{{ money(entry.balanceAfterFen) }}</text><button v-if="entry.applyId" class="text-button" @click="openEntry(entry.applyId)">查看关联投保记录 ›</button></view>
        </template>
      </template>
    </view>
    <k-date-picker v-if="calendar" :title="calendar==='start' ? '选择拟起保日期' : '选择保单保障日期'" :value="calendarValue" :min-date="calendar==='start' ? todayCn() : '2000-01-01'" max-date="2099-12-31" @cancel="calendar=''" @confirm="setDate" />
  </view>
</template>
<script setup>
import { reactive, ref, computed, watch } from 'vue'
import { onLoad, onShow, onHide, onUnload } from '@dcloudio/uni-app'
import { experience, ensureSession, currentStaffStore, getMessageScopeKey, getSessionRevision } from '@/common/experience.js'
import { getToken } from '@/common/request.js'
import { confirm, todayCn } from '@/common/ui.js'
import { payFlow } from '@/common/pay-flow.js'
import { insuranceApi } from './insurance-api.js'
import { initialFinanceState, createInsuranceFinance, money, paymentLabel, refundLabel } from './insurance-finance.js'
const state = reactive(initialFinanceState()), section = ref('records'), calendar = ref(''), requestedStore = ref('')
const authorized = computed(() => !!getToken() && !!experience.account)
const scope = () => JSON.stringify([getMessageScopeKey(), getSessionRevision(), requestedStore.value])
const api = { ...insuranceApi, context: () => insuranceApi.context(requestedStore.value || undefined), rows: () => insuranceApi.rows(requestedStore.value || undefined) }
const controller = createInsuranceFinance({ state, api, scope, allowed: () => authorized.value, confirm, payFlow })
const tabs = [{ key:'create',label:'投保缴费' },{ key:'records',label:'投保记录' },{ key:'account',label:'本人余额' }]
const selected = computed(() => controller.row())
const candidates = computed(() => state.context.candidates || []), plans = computed(() => state.context.plans || [])
const candidateLabels = computed(() => candidates.value.map(r => `${r.name || r.insuredName || '待核实'} · ${r.jobTitle || r.title || ''}`))
const planLabels = computed(() => plans.value.map(r => `${r.name || r.planName} · ¥${money(r.price)} / ${r.days}天`))
const candidateIndex = computed(() => candidates.value.findIndex(r => String(r.appId)===String(state.form.appId)))
const planIndex = computed(() => plans.value.findIndex(r => String(r.planId)===String(state.form.planId)))
const selectedPlan = computed(() => plans.value[planIndex.value])
const balanceEnough = computed(() => selectedPlan.value && Number(state.account.balanceFen)>=Number(selectedPlan.value.price))
const date = v => String(v || '待核实').slice(0,10)
const calendarValue = computed(() => calendar.value==='start' ? state.form.startDate : calendar.value==='policyStart' ? state.policyForm.startDate : state.policyForm.endDate)
function setDate(v) { if (calendar.value==='start') state.form.startDate=v; else if(calendar.value==='policyStart') state.policyForm.startDate=v; else state.policyForm.endDate=v; calendar.value='' }
function pickCandidate(e) { state.form.appId=candidates.value[Number(e.detail.value)]?.appId || '' }
function pickPlan(e) { state.form.planId=plans.value[Number(e.detail.value)]?.planId || ''; if(!balanceEnough.value) state.form.method='wechat' }
function openTab(v) { if(state.busy) return; section.value=v; state.error=''; state.notice=''; controller.choose('') }
async function openEntry(id) { section.value='records'; await controller.openRecord(id) }
const entryLabel = type => ({ insurance_refund:'退费预存',refund:'退费预存',refund_credit:'退费预存',payment:'缴纳保费',payment_debit:'缴纳保费',cancel:'撤销返还',refund_balance:'退费预存',insurance_payment:'缴纳保费' }[type] || '保险余额变动')
let initialQuery = {}, entered = false, visible = false, scopeReady = false
async function reload() { await controller.load() }
async function enter() {
  visible=true; await ensureSession(); if(!visible) return
  scopeReady=true
  const ok=await controller.show(); if(!ok) return
  if(!entered) {
    entered=true
    if(initialQuery.applyId) { section.value='records'; await controller.openRecord(initialQuery.applyId) }
    else if(initialQuery.appId) {
      state.form.appId=String(initialQuery.appId); state.form.planId=String(initialQuery.planId || plans.value[0]?.planId || '')
      state.form.startDate=/^\d{4}-\d{2}-\d{2}$/.test(initialQuery.startDate || '') ? initialQuery.startDate : todayCn(); section.value='create'
    }
  }
  if(!state.form.startDate) state.form.startDate=todayCn()
}
async function submitCreate() { await controller.create(); if(state.selectedId) section.value='records' }
onLoad(q => { initialQuery=q || {}; requestedStore.value=String(q?.storeId || ''); if(q?.tab==='account') section.value='account' })
onShow(enter)
onHide(() => { visible=false; calendar.value=''; controller.hide() })
onUnload(() => { visible=false; controller.hide() })
watch(() => JSON.stringify([getMessageScopeKey(), getSessionRevision()]), () => { if(!scopeReady) return; controller.invalidate(); requestedStore.value=''; calendar.value=''; entered=false; initialQuery={}; if(visible) enter() }, { flush:'sync' })
</script>
<style scoped>
.body{max-width:720px;margin:0 auto;padding:16px 16px calc(32px + env(safe-area-inset-bottom));font-size:14px;line-height:1.65;color:var(--k-ink)}button{margin:0;box-sizing:border-box;font:inherit;min-height:48px;line-height:1.5;border-radius:12px;background:var(--k-paper2);color:var(--k-ink);padding:12px 14px}button::after{border:0}button[disabled]{opacity:.45}input,textarea{box-sizing:border-box;width:100%;border:1px solid var(--k-line2);border-radius:12px;padding:12px;font-size:16px;background:var(--k-paper);color:var(--k-ink)}input{height:48px}textarea{height:112px}.heading,.info,.total,.entry>view,.record>view{display:flex;gap:14px;justify-content:space-between;align-items:center}.heading{margin-bottom:10px}.heading>text{font-size:16px;font-weight:600}.heading>button{background:transparent;color:var(--k-red-deep);flex-shrink:0}.hint{display:block;color:var(--k-muted);margin:10px 0;font-size:14px;line-height:1.7}.feedback{display:block;padding:14px;margin:12px 0;background:var(--k-paper2);border-radius:12px;white-space:pre-wrap;overflow-wrap:anywhere}.error{color:var(--k-alert);background:var(--k-alert-soft)}.error button{margin-top:10px;background:var(--k-paper)}.tabs{display:flex;gap:6px;margin-bottom:20px}.tabs>button{flex:1;padding:12px 4px}.on{background:var(--k-red-deep)!important;color:var(--k-paper)!important}.field{margin:20px 0}.field>text:first-child{display:block;font-size:16px;font-weight:600;margin-bottom:8px}.pick{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:12px;border:1px solid var(--k-line2);border-radius:12px;background:var(--k-paper);min-height:48px;box-sizing:border-box;width:100%;font-size:15px}.choices{display:flex;gap:8px}.choices>button{flex:1}.total{padding:18px 0;font-size:16px}.total .price{font-size:22px;color:var(--k-red-deep)}.primary{width:100%;background:var(--k-red-deep);color:var(--k-paper);font-weight:600;margin-top:12px}.secondary{width:100%;margin-top:12px}.subsection{padding-top:20px;border-top:1px solid var(--k-line);margin-top:22px}.title{font-size:18px;font-weight:600;display:block}.text-button{padding:10px 0;color:var(--k-red-deep);background:transparent;text-align:left}.info{padding:12px 0;border-bottom:1px solid var(--k-line);align-items:flex-start}.info>text:first-child{flex-shrink:0;color:var(--k-muted)}.info>text:last-child{text-align:right;overflow-wrap:anywhere}.record-title{display:flex;flex-wrap:wrap;gap:10px;align-items:center;font-size:20px;font-weight:600;margin:16px 0}.state{font-size:14px;font-weight:400;color:var(--k-red-deep)}.record{width:100%;display:flex;flex-direction:column;gap:8px;text-align:left;padding:18px 0;background:transparent;border-bottom:1px solid var(--k-line);border-radius:0}.record>view{width:100%;align-items:flex-start}.record>text{width:100%;font-size:14px;color:var(--k-muted)}.next{float:right;color:var(--k-red-deep);margin-left:8px}.policy,.refund-status{padding:18px 0;display:flex;flex-direction:column;gap:8px;overflow-wrap:anywhere}.refund-status{border-top:1px solid var(--k-line);margin-top:12px}.account-summary{padding:10px 0 22px;margin-bottom:20px;border-bottom:1px solid var(--k-line)}.amount{display:block;font-size:28px;color:var(--k-red-deep);font-weight:600;margin:8px 0}.entry{padding:16px 0;border-bottom:1px solid var(--k-line)}
</style>
