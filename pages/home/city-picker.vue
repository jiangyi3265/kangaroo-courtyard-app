<template>
  <view class="k-page picker-page" :class="[$userSurface, { 'is-lost': error.includes('原页面') }]">
    <k-topbar :title="options.title || '选择城市'" back custom-back @back="close(null)" />
    <view class="picker-tools">
      <view class="picker-search" :class="{ 'is-off': error.includes('原页面') }">
        <k-icon name="search" :size="16" :color="error.includes('原页面') ? 'light' : 'muted'" />
        <input v-model="keyword" placeholder="搜索城市、区县 / 拼音或首字母" placeholder-class="k-placeholder" confirm-type="search" @confirm="hideKeyboard" />
        <button v-if="keyword" class="picker-clear" aria-label="清空搜索" @click="keyword = ''"><k-icon name="x" :size="14" color="muted" /></button>
      </view>
      <text v-if="locationError" class="picker-hint">{{ locationError }}</text>
      <text v-if="options.hint" class="picker-hint">{{ options.hint }}</text>
      <template v-if="options.multiple">
        <view class="picker-summary"><text>已选 {{ selected.length }}{{ options.max ? ' / ' + options.max : '' }} 个</text><button v-if="selected.length" @click="selected = []">清空已选</button></view>
        <scroll-view v-if="selected.length" scroll-x class="picker-selected">
          <button v-for="name in selected" :key="name" class="picker-tag" :aria-label="'移除' + name" @click="toggle(name)"><text>{{ name }}</text><k-icon name="x" :size="12" color="red" /></button>
        </scroll-view>
      </template>
    </view>
    <scroll-view scroll-y enhanced :show-scrollbar="false" class="picker-results" :scroll-top="scrollTop" :lower-threshold="180" @scrolltolower="limit += 60">
      <button v-if="options.allowLocation !== false && !scoped && requestId" class="picker-location" :disabled="locating" @click="locate"><k-icon name="locate-fixed" :size="18" color="red"/><text>{{ locating ? '正在定位…' : '使用当前位置' }}</text></button>
      <view v-if="loading" class="picker-state picker-state--loading"><text>正在加载城市…</text></view>
      <view v-else-if="error" class="picker-state"><view class="picker-state__icon"><k-icon name="map-pin" :size="32" color="red" /></view><text class="picker-state__title">{{ error }}</text><text class="picker-hint">{{ error.includes('原页面') ? '入口已失效，回上一页再点一次即可' : '检查网络后再试一次' }}</text><button class="picker-retry" @click="load">重新加载</button></view>
      <template v-else>
        <view v-if="options.allowAll && !keyword.trim()" class="picker-card picker-card--all"><button class="picker-row picker-row--all" @click="close([''])"><k-icon name="globe" :size="18" color="ink2" /><text class="k-flex1">全部城市</text><k-icon v-if="!options.value" name="check" :size="18" color="red" /></button></view>
        <template v-if="!keyword.trim() && hot.length">
          <text class="picker-label">热门城市</text>
          <view class="picker-hot"><button v-for="name in hot" :key="name" :class="{ chosen: selected.includes(name) }" @click="toggle(name)">{{ name }}</button></view>
        </template>
        <text class="picker-label">{{ keyword.trim() ? '搜索结果 · ' + matches.length : scoped ? '可选城市' : '城市列表' }}<text v-if="!keyword.trim() && !scoped" class="picker-sub"> · 可搜索全国区县</text></text>
        <view class="picker-card">
        <button v-for="item in visible" :key="item.name" class="picker-row" :class="{ chosen: selected.includes(item.name) }" @click="toggle(item.name)">
          <view class="picker-city"><text>{{ item.name }}</text><text v-if="item.province || item.note" class="picker-region">{{ region(item) }}</text></view>
          <k-icon v-if="selected.includes(item.name)" name="check" :size="18" color="red" />
          <k-icon v-else-if="!options.multiple" name="chevron-right" :size="12" color="muted" />
          <k-icon v-else name="square" :size="18" color="light" />
        </button>
        </view>
        <view v-if="!matches.length" class="picker-state"><view class="picker-state__icon"><k-icon name="map-pin-x" :size="32" color="red" /></view><text class="picker-state__title">{{ keyword.trim() ? '没有找到匹配的城市' : options.emptyText || '暂无可选城市' }}</text><text class="picker-hint">{{ keyword.trim() ? (scoped ? '试试其他名称；这里只显示当前业务可用的城市' : '试试城市全称、区县名称或拼音') : '' }}</text></view>
        <text v-if="visible.length < matches.length" class="picker-end">向上滑动查看更多，也可直接搜索</text>
      </template>
    </scroll-view>
    <view class="picker-footer"><button v-if="options.multiple" class="picker-confirm" :disabled="closing" @click="close([...selected])">确定{{ selected.length ? '（' + selected.length + '）' : '' }}</button><button v-else class="picker-cancel" @click="close(null)">取消</button></view>
  </view>
</template>

<script setup>
import { ref, computed, watch, nextTick } from 'vue'
import { onLoad, onUnload } from '@dcloudio/uni-app'
import { apiCities } from '@/common/api.js'
import { cityPickerRequest, finishCityPicker } from '@/common/city-picker.js'
import { pickerEntries, searchPickerEntries, toggleCitySelection } from '@/common/city-picker-model.js'
import { locateCity } from '@/common/locate.js'
import { businessCityName } from '@/common/city-directory.js'

const options = ref({}), directory = ref({ all: [], hot: [] }), selected = ref([])
const keyword = ref(''), loading = ref(true), error = ref(''), limit = ref(60), scrollTop = ref(0), closing = ref(false)
let requestId = '', result = null, disposed = false
const locating=ref(false), locationError=ref('')
async function locate() {
  if (locating.value) return
  locating.value=true; locationError.value=''
  const location=await locateCity({onFailure: message => {locationError.value=message}})
  locating.value=false
  if (!disposed && !closing.value && location) toggle(location.name, { addOnly: true })
}
const scoped = computed(() => Array.isArray(options.value.items))
const rows = computed(() => pickerEntries(directory.value, options.value.items))
const matches = computed(() => searchPickerEntries(rows.value, keyword.value, scoped.value))
const visible = computed(() => matches.value.slice(0, limit.value))
const hot = computed(() => scoped.value ? [] : (directory.value.hot || []).filter(name => rows.value.some(row => row.name === name)).slice(0, 12))
const region = item => [item.province, item.parentName !== item.province ? item.parentName : '', item.note].filter(Boolean).join(' · ')
const hideKeyboard = () => uni.hideKeyboard()
watch(keyword, async () => { limit.value = 60; scrollTop.value = 1; await nextTick(); scrollTop.value = 0 })
onLoad(query => {
  requestId = query?.request || ''
  const request = cityPickerRequest(requestId)
  if (!request) { loading.value = false; error.value = '请返回原页面，重新打开城市选择'; return }
  options.value = request
  selected.value = [...new Set(request.selected || [])]
  load()
})
onUnload(() => { disposed=true; finishCityPicker(requestId, result) })
async function load() {
  if (!cityPickerRequest(requestId)) return
  loading.value = true; error.value = ''
  try {
    directory.value = (await apiCities()).data || { all: [] }
  } catch (e) {
    // A dictionary outage must not hide the cities already returned by the business API.
    if (!scoped.value) error.value = '城市加载失败，请重试'
  } finally { loading.value = false }
}
function toggle(name, { addOnly = false } = {}) {
  // 选中区县时按所属城市保存（思明区 → 厦门），业务数据按城市名匹配
  const city = businessCityName(rows.value, name)
  if (city !== name) { uni.showToast({ title: `已按所属城市「${city}」选择`, icon: 'none' }); name = city }
  if (!options.value.multiple) return close([name])
  if (addOnly && selected.value.includes(name)) return
  const next = toggleCitySelection(selected.value, name, options.value.max)
  if (next.limited) return uni.showToast({ title: `最多选择 ${options.value.max} 个城市`, icon: 'none' })
  selected.value = next.selected
}
function close(value) {
  if (closing.value) return
  closing.value = true; result = value
  hideKeyboard()
  uni.navigateBack({
    success: () => finishCityPicker(requestId, result),
    fail: () => { result = null; closing.value = false; uni.showToast({ title: '请返回原页面重试', icon: 'none' }) }
  })
}
</script>

<style scoped lang="scss">
.picker-page { --k-bg: var(--k-page); height: 100vh; height: 100dvh; min-height: 0; display: flex; flex-direction: column; overflow: hidden; background: var(--k-bg); --pg: 16px; }
.picker-page > .k-topbar { flex-shrink: 0; }
.picker-tools { padding: 4px var(--pg) 8px; flex-shrink: 0; }
.picker-search { min-height: 40px; padding: 0 4px 0 14px; display: flex; align-items: center; gap: 8px; border-radius: 20px; background: var(--k-paper); }
.picker-search.is-off { pointer-events: none; opacity: .4; }
.picker-search input { flex: 1; min-width: 0; height: 40px; font-size: 14px; }
button { margin: 0; border-radius: 0; background: transparent; color: var(--k-ink); font-size: 15px; line-height: 1.45; }
button::after { border: 0; }
.picker-clear { padding: 0; width: 36px; height: 40px; display: flex; align-items: center; justify-content: center; }
.picker-hint { display: block; color: var(--k-muted); font-size: 12px; line-height: 1.6; margin-top: 8px; }
.picker-summary { display: flex; justify-content: space-between; align-items: center; margin-top: 4px; font-size: 13px; color: var(--k-muted); }
.picker-summary button { font-size: 13px; color: var(--k-red-deep); padding: 10px 0 10px 16px; }
.picker-selected { width: 100%; white-space: nowrap; }
.picker-tag { display: inline-flex; align-items: center; gap: 4px; min-height: 28px; margin: 0 8px 4px 0; padding: 0 10px 0 12px; border-radius: 14px; font-size: 14px; color: var(--k-red-deep); background: var(--k-red-soft); }
.picker-results { flex: 1; min-height: 0; height: 0; width: 100%; }
.picker-results::-webkit-scrollbar { display: none; width: 0; height: 0; color: transparent; }
.picker-label { display: block; padding: 24px var(--pg) 12px; color: var(--k-ink); font-size: 16px; font-weight: 600; line-height: 22px; }
.picker-sub { color: var(--k-muted); font-size: 12px; font-weight: 400; }
.picker-hot { display: grid; grid-template-columns: repeat(5,minmax(0,1fr)); gap: 8px; padding: 0 var(--pg); }
.picker-hot button { min-width: 0; height: 36px; padding: 0 4px; white-space: nowrap; font-size: 13px; border: 1px solid var(--k-paper); border-radius: 18px; background: var(--k-paper); color: var(--k-ink2); display: flex; align-items: center; justify-content: center; }
.picker-hot .chosen { border-color: var(--k-red-soft); color: var(--k-red-deep); background: var(--k-red-soft); font-weight: 500; }
.picker-card { margin: 0 var(--pg); padding: 0 12px; border-radius: 12px; background: var(--k-paper); overflow: hidden; }
.picker-card--all { margin-top: 4px; }
.picker-location + .picker-card--all { position: relative; margin-top: -12px; padding-top: 12px; border-radius: 0 0 12px 12px; }
.picker-location + .picker-card--all::before { content: ''; position: absolute; left: 38px; right: 12px; top: 12px; height: 1px; background: var(--k-line); transform: scaleY(.5); }
.picker-card + .picker-state { margin-top: 0; }
.picker-row { position: relative; display: flex; width: 100%; padding: 10px 0; min-height: 52px; align-items: center; justify-content: space-between; gap: 12px; text-align: left; }
.picker-row + .picker-row::before { content: ''; position: absolute; left: 0; right: 0; top: 0; height: 1px; background: var(--k-line); transform: scaleY(.5); }
.picker-city { flex: 1; min-width: 0; display: flex; align-items: baseline; justify-content: space-between; gap: 12px; font-size: 15px; }
.picker-city > text:first-child { flex: 0 0 auto; }
.picker-region { min-width: 0; font-size: 12px; line-height: 1.5; color: var(--k-muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.picker-row--all { justify-content: flex-start; gap: 8px; }
.picker-location :deep(.k-icon) { flex: 0 0 auto; }
.picker-row.chosen .picker-city > text:first-child { color: var(--k-red-deep); font-weight: 600; }
.picker-checkbox { width: 18px; height: 18px; border: 1px solid var(--k-line2); border-radius: 4px; flex-shrink: 0; }
.picker-state { margin: 12px var(--pg) 0; padding: 32px 24px; display: flex; flex-direction: column; align-items: center; gap: 12px; border-radius: 12px; background: var(--k-paper); text-align: center; color: var(--k-muted); font-size: 15px; }
.picker-state--loading { background: transparent; }
.is-lost .picker-state { margin-top: 68px; background: none; }
.is-lost .picker-state__title { font-size: 15px; font-weight: 600; }
.picker-state__icon { width: 56px; height: 56px; display: flex; align-items: center; justify-content: center; border-radius: 16px; background: var(--k-red-soft); }
.picker-state__title { color: var(--k-ink); font-size: 14px; font-weight: 500; line-height: 1.6; }
.picker-state .picker-hint { margin-top: -4px; }
.picker-retry { height: 32px; margin-top: 4px; padding: 0 12px; border: 1px solid var(--k-red-line); border-radius: 16px; background: var(--k-paper); color: var(--k-red); font-size: 13px; font-weight: 500; display: flex; align-items: center; justify-content: center; }
.picker-end { display: block; padding: 16px; text-align: center; font-size: 12px; color: var(--k-muted); }
.picker-footer { flex-shrink: 0; padding: 8px var(--pg) calc(8px + var(--k-safe-bottom)); box-shadow: 0 -.5px 0 var(--k-line2); background: var(--k-paper); }
.picker-confirm, .picker-cancel { width: 100%; height: 44px; border-radius: 22px; padding: 0; display: flex; align-items: center; justify-content: center; font-size: 15px; font-weight: 600; }
.picker-confirm { background: var(--k-grad-brown); color: var(--k-paper); }
.picker-confirm[disabled] { opacity: .55; }
.picker-cancel { border: 1px solid var(--k-red-line); background: var(--k-paper); color: var(--k-red-deep); }
.picker-location { position: relative; z-index: 1; display: flex; align-items: center; gap: 8px; min-height: 52px; margin: 4px var(--pg) 0; padding: 0 12px; border-radius: 12px; background: var(--k-paper); color: var(--k-red-deep); font-size: 15px; font-weight: 500; }
@media (max-width: 359px) { .picker-page { --pg: 12px; } }
@media (max-width: 340px) { .picker-hot { grid-template-columns: repeat(4,minmax(0,1fr)); } }
</style>
