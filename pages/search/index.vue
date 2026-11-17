<template>
  <view class="k-page search-page">
    <template v-if="recruitmentEnabled || stayBookingEnabled">
    <k-topbar title="搜索" back :fab="false">
      <view class="search-head">
        <view class="search-field">
          <k-icon name="search" :size="20" color="red" />
          <input v-model="keyword" :focus="focusInput" maxlength="80" :placeholder="tab === 'jobs' ? '搜索岗位、城市、技能' : '搜索小院、商圈、配套设施'" placeholder-class="k-placeholder" confirm-type="search" aria-label="搜索关键词" @confirm="search" @focus="focusInput = true" @blur="focusInput = false" />
          <button v-if="keyword" class="clear" aria-label="清空搜索" @click="clear"><k-icon name="x" :size="17" color="muted" /></button>
          <button class="search-submit" hover-class="k-press-s" @click="search">搜索</button>
        </view>
        <view class="search-tabs">
          <button v-if="recruitmentEnabled" :class="{ active: tab === 'jobs' }" @click="switchTab('jobs')">岗位</button>
          <button v-if="stayBookingEnabled" :class="{ active: tab === 'stays' }" @click="switchTab('stays')">旅居</button>
        </view>
        <scroll-view v-if="tab === 'jobs'" class="type-scroll" scroll-x>
          <view class="types"><button v-for="item in types" :key="item.value" :class="{ selected: type === item.value }" @click="switchType(item.value)">{{ item.label }}</button></view>
        </scroll-view>
      </view>
    </k-topbar>
    <view class="search-body">
      <view v-if="!submitted" class="search-state"><k-icon name="search" :size="36" color="ochre" /><text class="state-title">想找什么？搜一下</text><text>{{ recruitmentEnabled ? (stayBookingEnabled ? '输入关键词，查找全国岗位与旅居' : '输入关键词，查找全国岗位') : '输入关键词，查找旅居' }}</text></view>
      <template v-else>
        <text v-if="!loading || rows.length" class="result-count">“{{ submitted }}” · {{ total }} 个{{ tab === 'jobs' ? '岗位' : '旅居' }}</text>
        <view v-if="loading && !rows.length" class="search-state"><text>正在搜索…</text></view>
        <view v-for="item in rows" :key="item.jobId || item.stayId" class="search-result" hover-class="k-press" aria-role="button" :aria-label="'查看' + titleOf(item)" @click="openResult(item)">
          <image class="result-cover" :src="coverOf(item)" mode="aspectFill" @error="failedImages[item.jobId || item.stayId] = true" />
          <view class="result-copy">
            <k-job-urgency v-if="tab === 'jobs'" :job="item" />
            <text class="result-title k-clamp2">{{ titleOf(item) }}</text>
            <text class="result-meta k-ellipsis">{{ tab === 'jobs' ? [typeName(item.jobType), item.city, item.storeName].filter(Boolean).join(' · ') : (item.sub || [item.district, item.areaDesc].filter(Boolean).join(' · ')) }}</text>
            <text v-if="tab === 'jobs' && item.salaryText" class="result-price">{{ item.salaryText }}</text>
            <text v-else-if="tab === 'stays' && Number(item.priceFromFen) > 0" class="result-price">¥{{ (Number(item.priceFromFen) / 100).toFixed(2).replace(/\.00$/, '') }}<text class="price-unit"> / 晚起</text></text>
          </view>
          <k-icon name="chevron-right" :size="16" color="muted" />
        </view>
        <view v-if="error" class="search-state"><text>{{ error }}</text><k-button size="md" type="secondary" label="重新加载" @click="load(retryAppend)" /></view>
        <view v-else-if="!loading && !rows.length" class="search-state"><text class="state-title">没有找到相关{{ tab === 'jobs' ? '岗位' : '旅居' }}</text><text>试试更简短的关键词，或切换分类</text></view>
        <view v-else-if="rows.length" class="search-more"><k-button v-if="hasMore" type="outline" size="md" :disabled="loading" :label="loading ? '正在加载…' : '加载更多'" @click="load(true)" /><text v-else>已显示全部结果</text></view>
      </template>
    </view>
    </template>
    <view v-else><k-topbar title="搜索" back :fab="false"/><view class="search-state">搜索服务暂未开放</view></view>
  </view>
</template>

<script setup>
import { ref, watch } from 'vue'
import { stayBookingEnabled, recruitmentEnabled, refreshFeatures } from '@/common/features.js'
import { onLoad, onReachBottom, onUnload } from '@dcloudio/uni-app'
import { apiJobList, apiStayList } from '@/common/api.js'
import { absUrl } from '@/common/upload.js'
import { displayWording } from '@/common/display-wording.js'
import { decodeQuery, go } from '@/common/screen.js'
import R from '@/common/routes.js'

const keyword = ref(''), submitted = ref(''), tab = ref('jobs'), type = ref(''), focusInput = ref(false)
const rows = ref([]), total = ref(0), pageNum = ref(0), hasMore = ref(false), loading = ref(false), error = ref(''), retryAppend = ref(false)
const failedImages = ref({})
const types = [{ value: '', label: '全部岗位' }, { value: 'volunteer', label: '换宿' }, { value: 'parttime', label: '兼职' }, { value: 'fulltime', label: '全职' }, { value: 'online', label: '线上任务' }]
let generation = 0
const typeName = value => types.find(item => item.value === value)?.label || '岗位'
const titleOf = item => tab.value === 'jobs' ? (item.title ? displayWording(item.title, [item.storeName]) : item.storeName || '岗位详情') : (item.stayName || '旅居详情')
const coverOf = item => failedImages.value[item.jobId || item.stayId] ? '/static/media/cover-empty.png' : absUrl((Array.isArray(item.images) && item.images[0]) || item.cover) || '/static/media/cover-empty.png'
const openResult = item => go(tab.value === 'jobs' ? R.jobDetail + '?jobId=' + item.jobId : R.stayDetail + '?stayId=' + item.stayId)
function reset() {
  generation++
  rows.value = []; total.value = 0; pageNum.value = 0; hasMore.value = false; error.value = ''; loading.value = false; failedImages.value = {}
}
function clear() {
  keyword.value = ''; submitted.value = ''; reset(); focusInput.value = true
}
function search() {
  submitted.value = keyword.value.trim()
  keyword.value = submitted.value
  reset()
  if (!submitted.value) { focusInput.value = true; return }
  focusInput.value = false
  uni.hideKeyboard()
  uni.pageScrollTo({ scrollTop: 0, duration: 0 })
  load()
}
watch([recruitmentEnabled, stayBookingEnabled], () => { reset(); tab.value = recruitmentEnabled.value ? 'jobs' : 'stays'; if (recruitmentEnabled.value || stayBookingEnabled.value) search() })
function switchTab(value) { if (tab.value !== value) { tab.value = value; search() } }
function switchType(value) { if (type.value !== value) { type.value = value; search() } }
async function load(append = false) {
  if ((tab.value === 'jobs' ? !recruitmentEnabled.value : !stayBookingEnabled.value) || !submitted.value || (append && (loading.value || !hasMore.value))) return
  const current = ++generation, next = append ? pageNum.value + 1 : 1
  loading.value = true; error.value = ''; retryAppend.value = append
  try {
    const params = { keyword: submitted.value, pageNum: next, pageSize: 10 }
    const data = tab.value === 'jobs' ? await apiJobList({ ...params, type: type.value || undefined }) : (await apiStayList(params)).data
    if (current !== generation) return
    const incoming = data?.rows || []
    rows.value = append ? rows.value.concat(incoming) : incoming
    total.value = Number(data?.total) || 0
    hasMore.value = typeof data?.hasMore === 'boolean' ? data.hasMore : rows.value.length < total.value
    pageNum.value = next
  } catch (failure) {
    if (current === generation) error.value = failure.message || '搜索失败，请重试'
  } finally {
    if (current === generation) loading.value = false
  }
}
onLoad(async query => { keyword.value = String(decodeQuery(query).keyword || '').slice(0, 80); await refreshFeatures(); tab.value = recruitmentEnabled.value ? 'jobs' : 'stays'; search() })
onReachBottom(() => { if (hasMore.value && !error.value) load(true) })
onUnload(() => { generation++ })
</script>

<style scoped lang="scss">
.search-head { padding: 8px 16px 0; }
.search-field { display: flex; align-items: center; gap: 8px; padding: 4px 4px 4px 14px; background: var(--k-paper); border: 1px solid #b69772; border-radius: 999px; }
.search-field input { flex: 1; min-width: 0; height: 40px; font-size: 14px; }
.search-field button, .search-tabs button, .types button { margin: 0; border: 0; }
.search-field button::after, .search-tabs button::after, .types button::after { border: 0; }
.clear { display: flex; align-items: center; justify-content: center; width: 28px; height: 40px; padding: 0; background: transparent; flex-shrink: 0; }
.search-submit { flex-shrink: 0; height: 40px; padding: 0 18px; border-radius: 999px; line-height: 40px; font-size: 14px; color: var(--k-paper); background: var(--k-grad-brown); }
.search-tabs { display: flex; gap: 30px; padding: 8px 4px 0; }
.search-tabs button { position: relative; padding: 10px 4px 14px; background: transparent; color: var(--k-muted); line-height: 24px; font-size: 18px; font-weight: 600; border-radius: 0; }
.search-tabs .active { color: var(--k-red-deep); }
.search-tabs .active::before { content: ''; position: absolute; bottom: 4px; left: 50%; width: 22px; height: 3px; transform: translateX(-50%); border-radius: 3px; background: var(--k-red); }
.type-scroll { white-space: nowrap; }
.types { display: flex; gap: 8px; padding: 10px 0 12px; }
.types button { flex-shrink: 0; padding: 0 13px; min-height: 36px; line-height: 36px; font-size: 13px; color: var(--k-ink2); border-radius: 999px; background: var(--k-paper2); }
.types .selected { color: var(--k-red-deep); background: #f0e3d3; font-weight: 600; }
.search-body { padding: 16px 16px calc(28px + var(--k-safe-bottom)); }
.result-count { display: block; margin: 0 2px 14px; color: var(--k-muted); font-size: 12px; overflow-wrap: anywhere; }
.search-result { display: flex; align-items: center; gap: 12px; margin-bottom: 12px; padding: 12px; background: var(--k-paper); border: 1px solid var(--k-line); border-radius: 16px; }
.result-cover { flex-shrink: 0; width: 78px; height: 86px; border-radius: 10px; background: var(--k-paper2); }
.result-copy { flex: 1; min-width: 0; }
.result-title { color: var(--k-ink); font-weight: 600; font-size: 15px; line-height: 1.5; }
.result-meta { display: block; margin-top: 6px; font-size: 12px; color: var(--k-muted); }
.result-price { display: block; margin-top: 9px; color: var(--k-red-deep); font-size: 15px; font-weight: 600; }
.price-unit { font-size: 11px; font-weight: 400; color: var(--k-muted); }
.search-state { display: flex; align-items: center; flex-direction: column; gap: 16px; padding: 60px 12px; text-align: center; color: var(--k-muted); font-size: 13px; line-height: 1.7; }
.state-title { color: var(--k-ink); font-size: 18px; font-weight: 600; }
.search-more { padding: 16px 0; text-align: center; color: var(--k-muted); font-size: 12px; }
@media (max-width: 359px) { .search-head, .search-body { padding-left: 12px; padding-right: 12px; } .types { gap: 6px; } .types button { padding: 0 10px; font-size: 12px; } .search-result { gap: 9px; padding: 10px; } .result-cover { width: 66px; height: 78px; } .search-submit { padding: 0 14px; } }
</style>
