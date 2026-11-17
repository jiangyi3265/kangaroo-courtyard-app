<template>
  <view class="ad-card">
    <view class="ad-head"><view class="ad-heading"><k-icon name="calendar-check" :size="20" color="red" /><text>确认时间</text></view><text v-if="data" class="ad-status" :class="{ 'ad-status--done': data.state === 'confirmed' }">{{ stateLabel }}</text></view>
    <view v-if="error" class="ad-empty"><text>{{ error }}</text><k-button type="outline" size="sm" :disabled="loading" @click="load">重新加载</k-button></view>
    <text v-else-if="!data" class="ad-note">正在读取时间安排…</text>
    <template v-else>
      <template v-if="editing">
        <text class="ad-note">设置到岗／入住的起止日期，提交后由报名人核对确认。</text>
        <view class="ad-dates ad-dates--edit">
          <button class="ad-date" :disabled="saving" @click="calendar = 'start'"><text class="ad-label">到岗／入住日期</text><text class="ad-date-value">{{ start || '选择日期' }}</text><k-icon name="calendar-days" :size="18" color="red" /></button>
          <text class="ad-separator">至</text>
          <button class="ad-date" :disabled="saving" @click="calendar = 'end'"><text class="ad-label">结束日期</text><text class="ad-date-value">{{ end || '选择日期' }}</text><k-icon name="calendar-days" :size="18" color="red" /></button>
        </view>
        <text class="ad-duration">{{ draftDays ? '共 ' + draftDays + ' 天，含起止当天' : '请选择完整时间段' }} · 最短 {{ data.minDays || 1 }} 天</text>
        <text v-if="formError" class="ad-form-error">{{ formError }}</text>
        <view class="ad-actions"><view class="ad-action"><k-button block type="outline" :disabled="saving" @click="cancelEdit">取消</k-button></view><view class="ad-action ad-action--main"><k-button block :disabled="saving" @click="submit">{{ saving ? '提交中…' : '发送给报名人确认' }}</k-button></view></view>
      </template>
      <template v-else>
        <text class="ad-note">{{ data.state === 'not_set' ? '商家尚未设置确认时间' : data.state === 'pending' ? (merchant ? '已发送时间段，等待报名人确认' : '商家已设置以下时间，请核对后确认') : '双方已确认以下时间' }}</text>
        <view v-if="data.state !== 'not_set'" class="ad-dates"><view class="ad-date"><text class="ad-label">到岗／入住日期</text><text class="ad-date-value">{{ data.startDate }}</text></view><text class="ad-separator">至</text><view class="ad-date"><text class="ad-label">结束日期</text><text class="ad-date-value">{{ data.endDate }}</text></view></view>
        <text v-if="data.state !== 'not_set'" class="ad-duration">共 {{ dateDays(data.startDate, data.endDate) }} 天，含起止当天</text>
        <text v-if="data.state !== 'confirmed' && data.applicationStart && data.applicationEnd" class="ad-original">当前报名日期：{{ data.applicationStart }} 至 {{ data.applicationEnd }}</text>
        <text v-if="data.confirmedTime" class="ad-confirmed"><k-icon name="circle-check" :size="14" color="green" /> {{ data.confirmedTime }} 已确认</text>
        <text v-if="data.closed && data.state === 'pending'" class="ad-note">当前报名阶段已不能确认，请联系商家沟通。</text>
        <template v-if="merchant && data.canEdit"><text class="ad-note">调整时间后需由报名人重新确认。</text><k-button class="ad-button" block type="outline" :disabled="loading || saving" @click="edit">{{ data.state === 'not_set' ? '设置时间段' : '调整时间段' }}</k-button></template>
        <template v-else-if="!merchant && data.canConfirm"><text class="ad-note">确认后更新报名与行程日期。已订车票和到店交通信息，请按新日期核对。</text><k-button class="ad-button" block :disabled="loading || saving" @click="accept">{{ saving ? '确认中…' : '确认此时间' }}</k-button><button class="ad-contact" :disabled="saving" @click="contact">时间不合适，联系商家调整<k-icon name="chevron-right" :size="14" color="red" /></button></template>
        <button v-else-if="!merchant && !data.closed" class="ad-contact" @click="contact">联系商家确认安排<k-icon name="chevron-right" :size="14" color="red" /></button>
      </template>
    </template>
    <k-date-picker v-if="calendar && data" :title="calendar === 'start' ? '选择到岗／入住日期' : '选择结束日期'" :value="calendar === 'start' ? start : end" :min-date="calendar === 'start' ? data.minDate : endMin" :max-date="calendar === 'end' && start ? shiftDate(start, 364) : ''" @cancel="calendar = ''" @confirm="pickDate" />
  </view>
</template>

<script setup>
import { ref, computed, watch, onUnmounted } from 'vue'
import { onShow, onHide } from '@dcloudio/uni-app'
import { apiApplicationDates, apiProposeApplicationDates, apiConfirmApplicationDates } from '@/common/api.js'
import { experience, getSessionRevision } from '@/common/experience.js'
import { getToken } from '@/common/request.js'
import { errText, shiftDate } from '@/common/ui.js'
import { go, toast } from '@/common/screen.js'
import R from '@/common/routes.js'
import { datePlan, dateDays, dateError } from './dates.js'
const props = defineProps({ appId: { type: [Number, String], required: true }, merchant: Boolean })
const emit = defineEmits(['updated', 'navigate'])
const data = ref(null), loading = ref(false), saving = ref(false), error = ref(''), formError = ref('')
const editing = ref(false), start = ref(''), end = ref(''), calendar = ref('')
const draftDays = computed(() => dateDays(start.value, end.value))
const endMin = computed(() => start.value ? shiftDate(start.value, Number(data.value?.minDays || 1) - 1) : data.value?.minDate)
const stateLabel = computed(() => ({ not_set: '待商家设置', pending: '待确认', confirmed: '已确认' })[data.value?.state] || '')
let version = 0, visible = true, timer = null
function scope() {
  const ticket = ++version, id = props.appId, merchant = props.merchant, account = experience.account?.id, session = getSessionRevision(), token = getToken()
  return () => ticket === version && visible && id === props.appId && merchant === props.merchant && account === experience.account?.id && session === getSessionRevision() && token === getToken()
}
function poll() { clearInterval(timer); if (visible) timer = setInterval(() => { if (!editing.value && !saving.value) load() }, 20000) }
async function load() {
  if (!Number(props.appId) || loading.value || saving.value || !visible) return
  const current = scope(); loading.value = true
  try { const res = await apiApplicationDates(props.appId, props.merchant); if (current()) { data.value = datePlan(res.data, props.appId); error.value = '' } }
  catch (e) { if (current()) { data.value = null; error.value = errText(e, '时间信息暂时加载失败') } }
  finally { if (current()) loading.value = false }
}
watch(() => [props.appId, props.merchant, experience.account?.id], () => { version++; data.value = null; loading.value = false; saving.value = false; editing.value = false; calendar.value = ''; error.value = ''; load(); poll() }, { immediate: true, flush: 'sync' })
onShow(() => { visible = true; load(); poll() })
onHide(() => { visible = false; version++; loading.value = false; saving.value = false; editing.value = false; calendar.value = ''; clearInterval(timer) })
onUnmounted(() => { visible = false; version++; clearInterval(timer) })
function edit() {
  if (!data.value?.canEdit || loading.value || saving.value) return
  start.value = data.value.startDate || data.value.applicationStart || data.value.minDate
  if (start.value < data.value.minDate) start.value = data.value.minDate
  end.value = data.value.endDate || data.value.applicationEnd || shiftDate(start.value, Number(data.value.minDays || 1) - 1)
  if (end.value < endMin.value) end.value = endMin.value
  formError.value = ''; editing.value = true
}
function cancelEdit() { editing.value = false; calendar.value = ''; load() }
function pickDate(value) {
  if (calendar.value === 'start') { start.value = value; if (!end.value || end.value < endMin.value) end.value = endMin.value }
  else end.value = value
  calendar.value = ''; formError.value = ''
}
async function save(action) {
  if (saving.value || loading.value || !data.value) return
  const current = scope(); saving.value = true
  let reload = false
  try {
    const response = await action()
    if (!current()) return
    data.value = datePlan(response.data, props.appId); editing.value = false; formError.value = ''
    emit('updated', data.value); toast(props.merchant ? (data.value.state === 'confirmed' ? '此时间已确认' : '已发送，等待报名人确认') : '时间已确认')
  } catch (e) {
    if (current()) {
      formError.value = errText(e, '操作未完成，请重试'); toast(formError.value)
      reload = e?.code === 409 || e?.code === 403 || e?.code === 422
      if (reload) editing.value = false
    }
  } finally { if (current()) { saving.value = false; if (reload) load() } }
}
function submit() {
  if (!data.value?.canEdit) return
  formError.value = dateError(start.value, end.value, data.value)
  if (formError.value) return
  const body = { revision: data.value.revision, startDate: start.value, endDate: end.value }
  return save(() => apiProposeApplicationDates(props.appId, body))
}
function accept() {
  if (!data.value?.canConfirm) return
  const revision = data.value.revision
  return save(() => apiConfirmApplicationDates(props.appId, revision))
}
function contact() { const url = R.chat + '?appId=' + Number(props.appId); if (props.merchant) go(url); else emit('navigate', url) }
</script>

<style scoped>
.ad-card { margin-top: 18px; padding: 16px; border: 1px solid var(--k-line); border-radius: 16px; background: var(--k-paper); }
.ad-head { padding-right: 8px; }
.ad-head { display: flex; justify-content: space-between; align-items: center; gap: 8px; }.ad-heading { display: flex; align-items: center; gap: 7px; font-size: 17px; font-weight: 700; }.ad-status { flex-shrink: 0; padding: 4px 8px; border-radius: 6px; font-size: 11px; color: var(--k-red-deep); background: var(--k-paper2); }.ad-status--done { background: var(--k-green-soft); color: var(--k-green); }
.ad-note { display: block; margin-top: 12px; font-size: 12px; line-height: 1.7; color: var(--k-muted); }.ad-dates { display: flex; align-items: center; gap: 10px; margin-top: 16px; padding: 14px 10px; background: var(--k-paper2); border-radius: 12px; }.ad-date { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 8px; margin: 0; padding: 0; text-align: left; background: transparent; }.ad-date::after { border: 0; }.ad-label { font-size: 11px; line-height: 1.5; color: var(--k-muted); }.ad-date-value { font-size: 16px; line-height: 1.5; font-weight: 650; color: var(--k-red-deep); white-space: nowrap; font-variant-numeric: tabular-nums; }.ad-separator { font-size: 12px; color: var(--k-muted); }
.ad-duration { display: block; margin-top: 9px; color: var(--k-ink2); font-size: 12px; line-height: 1.6; }.ad-original { display: block; margin-top: 12px; color: var(--k-muted); font-size: 11px; line-height: 1.7; overflow-wrap: anywhere; }.ad-confirmed { display: block; margin-top: 12px; color: var(--k-green); font-size: 11px; line-height: 1.7; }.ad-button { margin-top: 14px; }.ad-actions { display: flex; gap: 8px; margin-top: 16px; }.ad-action { flex: 1; min-width: 0; }.ad-action--main { flex: 2; }.ad-contact { display: flex; align-items: center; justify-content: center; gap: 3px; min-height: 44px; margin: 6px 0 0; padding: 8px 0; color: var(--k-red-deep); background: transparent; font-size: 12px; line-height: 1.6; }.ad-contact::after { border: 0; }.ad-form-error { display: block; margin-top: 10px; font-size: 12px; line-height: 1.6; color: var(--k-red-deep); }.ad-empty { display: flex; align-items: center; gap: 12px; justify-content: space-between; margin-top: 14px; font-size: 12px; color: var(--k-muted); }
@media (max-width: 350px) { .ad-card { padding: 14px 12px; }.ad-dates { gap: 7px; padding: 12px 8px; }.ad-date-value { font-size: 14px; } }
</style>
