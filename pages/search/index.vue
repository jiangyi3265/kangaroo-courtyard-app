<template>
  <view class="k-page search-page" :class="$userSurface">
    <template v-if="recruitmentEnabled || stayBookingEnabled">
    <k-topbar title="搜索" back :fab="false">
      <view class="search-head">
        <view class="search-field">
          <k-icon name="search" :size="16" color="muted" />
          <input v-model="keyword" :focus="focusInput" maxlength="80" :placeholder="tab === 'jobs' ? '搜索岗位、城市、技能' : '搜索小院、商圈、配套设施'" placeholder-class="k-placeholder" confirm-type="search" aria-label="搜索关键词" @confirm="search" @focus="focusInput = true" @blur="focusInput = false" />
          <button v-if="keyword" class="clear" aria-label="清空搜索" @click="clear"><k-icon name="x" :size="16" color="muted" /></button>
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
      <view v-if="!submitted" class="search-state search-state--idle"><view class="state-icon"><k-icon name="search" :size="32" color="red" /></view><text class="state-title">想找什么？搜一下</text><text>{{ recruitmentEnabled ? (stayBookingEnabled ? '输入关键词，查找全国岗位与旅居' : '输入关键词，查找全国岗位') : '输入关键词，查找旅居' }}</text></view>
      <template v-else>
        <text v-if="pageNum > 0" class="result-count">“{{ submitted }}” · {{ total }} 个{{ tab === 'jobs' ? '岗位' : '旅居' }}</text>
        <view v-if="loading && !rows.length" class="search-state search-state--loading"><text>正在搜索…</text></view>
        <view v-for="item in rows" :key="item.jobId || item.stayId" class="search-result" hover-class="k-press" aria-role="button" :aria-label="'查看' + titleOf(item)" @click="openResult(item)">
          <image v-if="coverOf(item) !== EMPTY_COVER" class="result-cover" :src="coverOf(item)" mode="aspectFill" @error="failedImages[item.jobId || item.stayId] = true" />
          <view v-else class="result-cover result-cover--blank"><k-icon :name="tab === 'jobs' ? 'briefcase-business' : 'house'" :size="24" color="red" /></view>
          <view class="result-copy">
            <k-job-urgency v-if="tab === 'jobs'" :job="item" />
            <text class="result-title k-clamp2">{{ titleOf(item) }}</text>
            <text class="result-meta k-clamp2">{{ tab === 'jobs' ? [typeName(item.jobType), item.city, item.storeName].filter(Boolean).join(' · ') : (item.sub || [item.district, item.areaDesc].filter(Boolean).join(' · ')) }}</text>
            <text v-if="tab === 'jobs' && item.salaryText" class="result-price">{{ salaryParts(item.salaryText)[0] }}<text class="price-unit">{{ salaryParts(item.salaryText)[1] }}</text></text>
            <text v-else-if="tab === 'stays' && Number(item.priceFromFen) > 0" class="result-price"><text class="price-yen">¥</text>{{ (Number(item.priceFromFen) / 100).toFixed(2).replace(/\.00$/, '') }}<text class="price-unit"> / 晚起</text></text>
          </view>
          <k-icon name="chevron-right" :size="12" color="muted" />
        </view>
        <view v-if="error" class="search-state"><view class="state-icon"><k-icon name="wifi-off" :size="32" color="red" /></view><text class="state-title">{{ error }}</text><k-button size="md" type="secondary" label="重新加载" @click="load(retryAppend)" /></view>
        <view v-else-if="!loading && !rows.length" class="search-state"><view class="state-icon"><k-icon name="search" :size="32" color="red" /></view><text class="state-title">没有找到相关{{ tab === 'jobs' ? '岗位' : '旅居' }}</text><text>试试更简短的关键词，或切换分类</text></view>
        <view v-else-if="rows.length" class="search-more"><k-button v-if="hasMore" type="outline" size="md" :disabled="loading" :label="loading ? '正在加载…' : '加载更多'" @click="load(true)" /><text v-else>已显示全部结果</text></view>
      </template>
    </view>
    </template>
    <view v-else><k-topbar title="搜索" back :fab="false"/><view class="search-body"><view class="search-state"><view class="state-icon"><k-icon name="search" :size="32" color="red" /></view><text class="state-title">搜索服务暂未开放</text></view></view></view>
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
const types = [{ value: '', label: '全部岗位' }, { value: 'volunteer', label: '换工' }, { value: 'parttime', label: '兼职' }, { value: 'fulltime', label: '全职' }, { value: 'online', label: '线上任务' }]
let generation = 0
// 纯展示：「120 元/天」拆成数字 + 单位两档字号（字不变）
const salaryParts = t => { const m = /^(\D*[\d.,]+[KkWw千万]?(?:\s*[-~–]\s*[\d.,]+[KkWw千万]?)?)(.*)$/.exec(t || ''); return m ? [m[1], m[2]] : [t || '', ''] }
const typeName = value => types.find(item => item.value === value)?.label || '岗位'
const titleOf = item => tab.value === 'jobs' ? (item.title ? displayWording(item.title, [item.storeName]) : item.storeName || '岗位详情') : (item.stayName || '旅居详情')
// 没封面 / 加载失败时显示浅暖方块 + 线性图标（不再是那张深绿粗线的兜底图）
const EMPTY_COVER = '/static/media/cover-empty.png'
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
watch([recruitmentEnabled, stayBookingEnabled], ([jobs, stays], [hadJobs, hadStays]) => {
  if (tab.value === 'jobs' ? jobs && hadJobs : stays && hadStays) return
  reset()
  if (!jobs && !stays) return
  if (tab.value === 'jobs' ? !jobs : !stays) tab.value = jobs ? 'jobs' : 'stays'
  if (submitted.value) load()
})
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
onLoad(query => {
  keyword.value = String(decodeQuery(query).keyword || '').slice(0, 80)
  tab.value = recruitmentEnabled.value || !stayBookingEnabled.value ? 'jobs' : 'stays'
  search()
  refreshFeatures()
})
onReachBottom(() => { if (hasMore.value && !error.value) load(true) })
onUnload(() => { generation++ })
</script>

<style scoped lang="scss">
@use '../../styles/user-search' as user-search;
/* 2026-11-18 第三轮精修：顶部一块（搜索框 40 高白胶囊、岗位 / 旅居下划线页签、类型胶囊）放在暖色渐变的吸顶栏里，底边一条发丝线和下面的浅灰底分开；
   页边 16（320 宽 12）；结果是白卡（76 方图 + 标题 / 类型城市门店 / 价格 + 小箭头）；空、出错、没结果都是 56 浅暖方块 + 线性图标的空状态卡 */
.search-page { --k-bg: var(--k-page); min-height: 100vh; background: var(--k-bg); }
.search-page :deep(.k-topbar) { background: var(--k-paper); }
.search-head { position: relative; padding: 4px 16px 0; }
.search-head::after { content: ''; position: absolute; left: 0; right: 0; bottom: 0; height: 1px; background: var(--k-line); transform: scaleY(.5); }
.search-field { display: flex; align-items: center; gap: 8px; height: 40px; padding: 0 0 0 14px; border-radius: 20px; background: var(--k-fill); }
.search-field input { flex: 1; min-width: 0; height: 40px; font-size: 14px; }
.search-field button, .search-tabs button, .types button { margin: 0; border: 0; }
.search-field button::after, .search-tabs button::after, .types button::after { border: 0; }
.clear { display: flex; align-items: center; justify-content: center; width: 32px; height: 40px; padding: 0; background: transparent; flex-shrink: 0; }
/* 「搜索」钮：看上去 32 高，外面一圈透明边把可点范围撑到 40 */
.search-field .search-submit { position: relative; flex-shrink: 0; height: 40px; padding: 0 16px; border-radius: 0 20px 20px 0; background: none; color: var(--k-red-deep); font-size: 14px; font-weight: 600; line-height: 40px; }
.search-field .search-submit::before { content: ''; position: absolute; left: 0; top: 12px; width: 1px; height: 16px; background: var(--k-line2); transform: scaleX(.5); }
.search-tabs { display: flex; gap: 24px; }
.search-tabs button { position: relative; padding: 8px 0 10px; background: transparent; color: var(--k-muted); font-size: 14px; font-weight: 400; line-height: 22px; border-radius: 0; }
.search-tabs .active { color: var(--k-ink); font-weight: 600; }
.search-tabs .active::before { content: ''; position: absolute; bottom: 4px; left: 50%; width: 16px; height: 3px; transform: translateX(-50%); border-radius: 2px; background: var(--k-red); }
.type-scroll { white-space: nowrap; }
/* 类型胶囊看上去 28 高，外面一圈透明边把可点范围留在 36（原来就是 36，不能缩） */
.types { display: flex; gap: 0; margin: 0 -4px; padding: 4px 0 8px; }
.types button { flex-shrink: 0; padding: 0 12px; min-height: 36px; line-height: 28px; font-size: 12px; color: var(--k-ink2); border: 4px solid transparent; border-radius: 18px; background: var(--k-fill) padding-box; }
/* 选中：浅棕底、深棕字、一圈细棕线（全端筛选胶囊同一种选中样子，不再实心棕块） */
.types .selected { color: var(--k-red-deep); background: var(--k-red-soft) padding-box; box-shadow: inset 0 0 0 1px var(--k-red); font-weight: 600; }
.search-body { padding: 12px 16px calc(28px + var(--k-safe-bottom)); }
.result-count { display: block; margin: 0 0 10px; color: var(--k-muted); font-size: 12px; overflow-wrap: anywhere; font-feature-settings: "halt"; }
.search-result { display: flex; align-items: center; gap: 12px; min-height: 96px; box-sizing: border-box; margin-bottom: 8px; padding: 12px; background: var(--k-paper); border-radius: 12px; }
.result-cover { flex-shrink: 0; width: 72px; height: 72px; border-radius: 8px; background: var(--k-red-soft); }
.result-cover--blank { display: flex; align-items: center; justify-content: center; }
/* 文字列和封面一样高、竖直居中：没价格的卡不再「上挤下空」 */
.result-copy { flex: 1; min-width: 0; min-height: 72px; display: flex; flex-direction: column; justify-content: center; }
.result-title { color: var(--k-ink); font-weight: 600; font-size: 15px; line-height: 21px; }
.result-meta { margin-top: 4px; font-size: 12px; line-height: 17px; color: var(--k-muted); }
.result-price { display: block; margin-top: 6px; color: var(--k-red); font-size: 18px; font-weight: 700; line-height: 22px; font-variant-numeric: tabular-nums; }
.price-yen { font-size: 12px; }
.price-unit { font-size: 11px; font-weight: 400; color: var(--k-muted); }
.result-copy :deep(.job-urgency) { display: flex; width: fit-content; margin-bottom: 4px; padding: 0 6px; border-radius: 4px; font-size: 11px; font-weight: 500; line-height: 18px; }
.result-copy :deep(.job-urgency__label) { gap: 3px; }
.search-state { box-sizing: border-box; display: flex; align-items: center; flex-direction: column; gap: 8px; padding: 72px 16px 32px; text-align: center; color: var(--k-muted); font-size: 12px; line-height: 1.6; }
.search-state--loading { padding: 48px 16px; background: transparent; }
.search-state--idle { padding-top: 136px; }
.result-count + .search-state { padding-top: 56px; }
.search-result ~ .search-state { padding-top: 32px; }
.state-icon { width: 56px; height: 56px; margin-bottom: 4px; display: flex; align-items: center; justify-content: center; border-radius: 16px; background: var(--k-red-soft); }
.state-title { color: var(--k-ink); font-size: 14px; font-weight: 500; }
.search-state :deep(.k-button) { margin-top: 8px; height: 32px; padding: 0 12px; border-radius: 16px; font-size: 13px; font-weight: 500; }
.search-more { padding: 16px 0; text-align: center; color: var(--k-muted); font-size: 12px; }
.search-more :deep(.k-button) { height: 36px; border-radius: 18px; font-size: 13px; }
.search-more :deep(.k-button.is-outline) { border-color: var(--k-red-line) !important; color: var(--k-red-deep) !important; }
@media (max-width: 359px) { .search-head, .search-body { padding-left: 12px; padding-right: 12px; } .types button { padding: 0 9px; } .search-result { gap: 10px; padding: 10px; } .result-cover { width: 64px; height: 64px; } .result-copy { min-height: 64px; } .search-field .search-submit { padding: 0 12px; } }

.search-page.user-surface {
  .search-field { @include user-search.field; }
  .search-field input { @include user-search.input; }
  .search-field .search-submit { @include user-search.submit; }
  .result-cover { border-radius: 9px; }
  .result-title { line-height: 1.45; }
  .result-price { font-variant-numeric: tabular-nums; }
  .state-icon { background-color: var(--user-icon-field); }
}
</style>
