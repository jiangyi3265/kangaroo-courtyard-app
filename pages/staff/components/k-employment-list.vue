<template>
  <view class="roster">
    <view class="roster__head">
      <text class="roster__title">在岗与离店登记</text>
      <k-button type="outline" size="sm" :label="opened ? '收起名单' : '查看名单'" :disabled="!storeId" @click="toggle" />
    </view>
    <template v-if="opened">
      <template v-if="selected">
        <view class="roster__selected"><text>{{ selected.name }} · {{ selected.jobTitle }}</text><k-button type="secondary" size="sm" label="返回名单" @click="selected = null" /></view>
        <k-employment-status :app-id="selected.appId" @changed="updateRecord" />
        <view class="roster__tools"><k-button type="outline" size="sm" label="办理／查看保险" @click="openInsurance" /></view>
      </template>
      <template v-else>
        <text v-if="loading && !rows.length" class="roster__hint">正在读取人员名单…</text>
        <text v-else-if="!rows.length && !error" class="roster__hint">本店暂无已确认入职的人员</text>
        <button v-for="person in rows" :key="person.appId" class="roster__person" @click="selected = person">
          <view class="roster__person-main"><text>{{ person.name || '工作人员' }}</text><text>{{ person.jobTitle }}</text></view>
          <text class="roster__state">{{ stateLabel(person.state) }}</text><k-icon name="chevron-right" :size="18" color="muted" />
        </button>
        <text v-if="error" class="roster__error" role="alert">{{ error }}</text>
        <view class="roster__tools">
          <k-button v-if="error" type="outline" size="sm" label="重新读取名单" :disabled="loading" @click="load(false)" />
          <k-button v-if="hasMore" type="outline" size="sm" :label="loading ? '正在加载…' : '加载更多人员'" :disabled="loading" @click="load(true)" />
        </view>
      </template>
    </template>
  </view>
</template>

<script setup>
import { ref, watch } from 'vue'
import { get } from '@/common/request.js'
import { ensureSession, staffStoreUrl } from '@/common/experience.js'
import { go } from '@/common/screen.js'
import KEmploymentStatus from './k-employment-status.vue'

const props = defineProps({ storeId: { type: [Number, String], default: null }, autoOpen: { type: Boolean, default: false } })
const opened = ref(false)
const selected = ref(null)
const rows = ref([])
const hasMore = ref(false)
const loading = ref(false)
const error = ref('')
let page = 0
let sequence = 0
const stateLabel = state => ({ active: '当前在岗', offboarded: '已离店（离岗）', completed: '已完成' }[state] || '待核对')

const load = async (append) => {
  if (loading.value || !props.storeId) return
  const request = ++sequence
  const storeId = props.storeId
  const next = append ? page + 1 : 1
  loading.value = true
  error.value = ''
  if (!append) { rows.value = []; hasMore.value = false }
  try {
    await ensureSession()
    if (request !== sequence || storeId !== props.storeId) return
    const response = await get('/app/staff/employments', { storeId, pageNum: next })
    if (request !== sequence || storeId !== props.storeId) return
    if (!Array.isArray(response.data?.rows)) throw new Error('人员名单不完整，请重试')
    rows.value = append ? [...rows.value, ...response.data.rows] : response.data.rows
    hasMore.value = response.data.hasMore === true
    page = next
  } catch (exception) {
    if (request === sequence && storeId === props.storeId) error.value = exception?.message || '人员名单读取失败'
  } finally {
    if (request === sequence) loading.value = false
  }
}

const toggle = () => {
  opened.value = !opened.value
  selected.value = null
  if (opened.value) load(false)
}

const updateRecord = record => {
  const person = rows.value.find(row => String(row.appId) === String(record.appId))
  if (person) Object.assign(person, { state: record.state, offboardTime: record.offboardTime })
}
const openInsurance = () => {
  if (!selected.value?.appId || !props.storeId) return
  go(staffStoreUrl('/pages/staff/insurance-account?applicationId=' + encodeURIComponent(selected.value.appId), props.storeId))
}

watch([() => props.storeId, () => props.autoOpen], () => {
  sequence++
  opened.value = false
  selected.value = null
  rows.value = []
  hasMore.value = false
  loading.value = false
  error.value = ''
  page = 0
  if (props.autoOpen && props.storeId) { opened.value = true; load(false) }
}, { immediate: true })
</script>

<style scoped lang="scss">
/* 2026-11-17 改版「小而精」：整块收成一张白卡（12 圆角、不描边）；人员行标题 14、岗位 12，在岗状态用小标签；按钮收成胶囊 */
.roster { padding: 12px; margin-bottom: 8px; border: 0; border-radius: 12px; background: var(--k-paper); }
.roster :deep(.k-button) { border-radius: 999px; }
.roster :deep(.employment) { padding-bottom: 4px; border-bottom: 0; }
.roster__head, .roster__selected { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.roster__title { color: var(--k-ink); font-size: 15px; font-weight: 700; }
.roster__selected { margin-top: 10px; font-size: 13px; line-height: 1.6; color: var(--k-ink2); }
.roster__selected > text { flex: 1; min-width: 0; overflow-wrap: anywhere; }
.roster__person { display: flex; align-items: center; gap: 8px; width: 100%; min-height: 56px; padding: 10px 0; margin: 0; border-radius: 0; background: transparent; text-align: left; line-height: 1.5; border-bottom: 1px solid var(--k-line); }
.roster__person::after { border: 0; }
.roster__person-main { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
.roster__person-main > text:first-child { font-size: 14px; font-weight: 600; color: var(--k-ink); }
.roster__person-main > text:last-child { font-size: 12px; color: var(--k-muted); overflow-wrap: anywhere; }
.roster__state { height: 17px; padding: 0 5px; border-radius: 4px; background: #F5F1EB; font-size: 10px; font-weight: 500; line-height: 17px; color: var(--k-ink2); flex-shrink: 0; }
.roster__hint, .roster__error { display: block; margin-top: 10px; font-size: 13px; line-height: 1.6; color: var(--k-muted); }
.roster__error { color: var(--k-alert); }
.roster__tools { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 10px; }
</style>
