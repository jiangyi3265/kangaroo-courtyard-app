<template>
  <view class="employment">
    <view class="employment__head">
      <text class="employment__title">在岗与离店登记</text>
      <k-button type="outline" size="sm" label="刷新记录" :disabled="loading || saving" @click="load" />
    </view>
    <text v-if="loading" class="employment__muted">正在读取在岗记录…</text>
    <template v-else-if="record">
      <text class="employment__state">{{ stateLabel }}</text>
      <text v-if="record.onboardTime" class="employment__line">确认入职 {{ record.onboardTime }}</text>
      <text v-if="record.offboardTime" class="employment__line">实际离店（离岗） {{ record.offboardTime }}</text>
      <text v-if="record.offboardNote" class="employment__line">{{ record.offboardNote }}</text>
      <view v-if="record.canManage && !editing" class="employment__actions">
        <k-button type="outline" :label="record.offboardTime ? '更正离店（离岗）时间' : '登记离店（离岗）'" @click="edit(false)" />
        <k-button v-if="record.offboardTime" type="secondary" label="纠正为仍在岗" @click="edit(true)" />
      </view>
      <view v-if="editing" class="employment__form">
        <template v-if="!restoring">
          <text class="employment__label">实际离店（离岗）时间</text>
          <view class="employment__date">
            <picker mode="date" :value="date" :start="record.onboardTime?.slice(0, 10)" :end="todayCn()" :disabled="saving" @change="date = $event.detail.value">
              <view class="employment__picker">{{ date }} <k-icon name="chevron-down" :size="16" color="muted" /></view>
            </picker>
            <picker mode="time" :value="time" :disabled="saving" @change="time = $event.detail.value">
              <view class="employment__picker">{{ time }} <k-icon name="chevron-down" :size="16" color="muted" /></view>
            </picker>
          </view>
        </template>
        <text class="employment__label">{{ restoring ? '仍在岗的核验依据' : '离店（离岗）或更正依据' }}</text>
        <textarea v-model="note" class="employment__note" :disabled="saving" :maxlength="180" placeholder="填写已核实的情况，5至180字" auto-height />
        <view class="employment__actions">
          <k-button type="secondary" label="取消" :disabled="saving" @click="editing = false" />
          <k-button :label="saving ? '正在保存…' : restoring ? '确认仍在岗' : '保存离店（离岗）记录'" :disabled="saving" @click="save" />
        </view>
      </view>
    </template>
    <text v-if="error" class="employment__error" role="alert">{{ error }}</text>
  </view>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { get, post } from '@/common/request.js'
import { todayCn } from '@/common/ui.js'

const props = defineProps({ appId: { type: [Number, String], required: true } })
const emit = defineEmits(['changed'])
const record = ref(null)
const loading = ref(false)
const saving = ref(false)
const error = ref('')
const editing = ref(false)
const restoring = ref(false)
const date = ref('')
const time = ref('')
const note = ref('')
const stateLabel = computed(() => ({ active: '当前在岗', offboarded: '已登记离店（离岗）', completed: '这段经历已完成', unconfirmed: '尚未确认实际入职' }[record.value?.state] || '在岗状态待核对'))
let sequence = 0
let attempt = null

const load = async () => {
  const request = ++sequence
  const appId = props.appId
  loading.value = true
  record.value = null
  error.value = ''
  editing.value = false
  saving.value = false
  attempt = null
  try {
    const response = await get(`/app/staff/applications/${appId}/employment`)
    if (request !== sequence || appId !== props.appId) return
    if (String(response.data?.appId) !== String(appId)) throw new Error('在岗记录不完整，请刷新后重试')
    record.value = response.data
  } catch (exception) {
    if (request === sequence && appId === props.appId) error.value = exception?.message || '在岗记录读取失败，请刷新重试'
  } finally {
    if (request === sequence) loading.value = false
  }
}

const edit = (restore) => {
  if (!record.value?.canManage || saving.value) return
  restoring.value = restore
  const chinaTime = new Date(Date.now() + 8 * 60 * 60 * 1000)
  date.value = record.value.offboardTime?.slice(0, 10) || todayCn()
  time.value = record.value.offboardTime?.slice(11, 16) || `${String(chinaTime.getUTCHours()).padStart(2, '0')}:${String(chinaTime.getUTCMinutes()).padStart(2, '0')}`
  note.value = ''
  error.value = ''
  editing.value = true
  attempt = null
}

const save = async () => {
  if (saving.value || !record.value?.canManage) return
  if (note.value.trim().length < 5) { error.value = '请填写至少5字的核验依据'; return }
  const appId = props.appId
  const request = sequence
  const payload = {
    offboardTime: restoring.value ? null : `${date.value} ${time.value}:00`,
    expectedOffboardTime: record.value.offboardTime || null,
    note: note.value.trim()
  }
  const fingerprint = JSON.stringify(payload)
  if (!attempt || attempt.fingerprint !== fingerprint) {
    attempt = { fingerprint, requestKey: `employment-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}` }
  }
  saving.value = true
  error.value = ''
  try {
    const response = await post(`/app/staff/applications/${appId}/employment`, { ...payload, requestKey: attempt.requestKey })
    if (request !== sequence || appId !== props.appId) return
    if (String(response.data?.appId) !== String(appId)) throw new Error('保存结果待确认，请刷新在岗记录')
    record.value = response.data
    editing.value = false
    attempt = null
    emit('changed', response.data)
  } catch (exception) {
    if (request === sequence && appId === props.appId) error.value = exception?.message || '保存失败，可重试或刷新记录核对'
  } finally {
    if (request === sequence && appId === props.appId) saving.value = false
  }
}

watch(() => props.appId, load, { immediate: true })
</script>

<style scoped lang="scss">
/* 2026-11-17 改版「小而精」：标题 15、状态 14、说明 13，按钮收成胶囊；填写的地方（日期、核验依据）字号不动，只把圆角收到 10 */
.employment { padding: 12px 0; border-bottom: 1px solid var(--k-line); }
.employment :deep(.k-button) { border-radius: 999px; }
.employment__head { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 10px; }
.employment__title { font-size: 15px; font-weight: 700; color: var(--k-ink); }
.employment__state { display: block; font-size: 14px; font-weight: 600; color: var(--k-ink); }
.employment__line, .employment__muted { display: block; margin-top: 6px; font-size: 13px; line-height: 1.6; color: var(--k-muted); overflow-wrap: anywhere; }
.employment__actions { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 12px; }
.employment__form { margin-top: 16px; }
.employment__label { display: block; margin: 12px 0 8px; font-size: 15px; color: var(--k-ink2); }
.employment__date { display: flex; flex-wrap: wrap; gap: 10px; }
.employment__date picker { flex: 1; min-width: 120px; }
.employment__picker { display: flex; justify-content: space-between; align-items: center; gap: 12px; min-height: 44px; padding: 0 12px; border: 1px solid var(--k-line2); border-radius: 10px; background: var(--k-paper); font-size: 15px; }
.employment__note { box-sizing: border-box; width: 100%; min-height: 88px; padding: 12px; border: 1px solid var(--k-line2); border-radius: 10px; background: var(--k-paper); font-size: 15px; line-height: 1.6; }
.employment__error { display: block; margin-top: 10px; font-size: 13px; line-height: 1.6; color: var(--k-alert); }
</style>
