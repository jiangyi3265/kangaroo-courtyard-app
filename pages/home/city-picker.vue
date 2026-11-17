<template>
  <view class="k-page picker-page">
    <k-topbar :title="options.title || '选择城市'" back custom-back @back="close(null)" />
    <view class="picker-tools">
      <view class="picker-search">
        <k-icon name="search" :size="20" color="muted" />
        <input v-model="keyword" placeholder="搜索城市、区县 / 拼音或首字母" placeholder-class="k-placeholder" confirm-type="search" @confirm="hideKeyboard" />
        <button v-if="keyword" class="picker-clear" aria-label="清空搜索" @click="keyword = ''"><k-icon name="x" :size="18" color="muted" /></button>
      </view>
      <button v-if="options.allowLocation !== false && !scoped && requestId" class="picker-location" :disabled="locating" @click="locate"><k-icon name="locate-fixed" :size="20" color="red"/><text>{{ locating ? '正在定位…' : '使用当前位置' }}</text></button>
      <text v-if="locationError" class="picker-hint">{{ locationError }}</text>
      <text v-if="options.hint" class="picker-hint">{{ options.hint }}</text>
      <template v-if="options.multiple">
        <view class="picker-summary"><text>已选 {{ selected.length }}{{ options.max ? ' / ' + options.max : '' }} 个</text><button v-if="selected.length" @click="selected = []">清空已选</button></view>
        <scroll-view v-if="selected.length" scroll-x class="picker-selected">
          <button v-for="name in selected" :key="name" class="picker-tag" :aria-label="'移除' + name" @click="toggle(name)"><text>{{ name }}</text><k-icon name="x" :size="14" color="red" /></button>
        </scroll-view>
      </template>
    </view>
    <scroll-view scroll-y class="picker-results" :scroll-top="scrollTop" :lower-threshold="180" @scrolltolower="limit += 60">
      <view v-if="loading" class="picker-state"><text>正在加载城市…</text></view>
      <view v-else-if="error" class="picker-state"><text>{{ error }}</text><button class="picker-retry" @click="load">重新加载</button></view>
      <template v-else>
        <button v-if="options.allowAll && !keyword.trim()" class="picker-row" @click="close([''])"><text>全部城市</text><k-icon v-if="!options.value" name="check" :size="20" color="red" /></button>
        <template v-if="!keyword.trim() && hot.length">
          <text class="picker-label">热门城市</text>
          <view class="picker-hot"><button v-for="name in hot" :key="name" :class="{ chosen: selected.includes(name) }" @click="toggle(name)">{{ name }}</button></view>
        </template>
        <text class="picker-label">{{ keyword.trim() ? '搜索结果 · ' + matches.length : scoped ? '可选城市' : '城市列表 · 可搜索全国区县' }}</text>
        <button v-for="item in visible" :key="item.name" class="picker-row" :class="{ chosen: selected.includes(item.name) }" @click="toggle(item.name)">
          <view class="picker-city"><text>{{ item.name }}</text><text v-if="item.province || item.note" class="picker-region">{{ region(item) }}</text></view>
          <k-icon v-if="selected.includes(item.name)" name="check" :size="20" color="red" />
          <k-icon v-else-if="!options.multiple" name="chevron-right" :size="18" color="light" />
          <view v-else class="picker-checkbox" />
        </button>
        <view v-if="!matches.length" class="picker-state"><text>{{ keyword.trim() ? '没有找到匹配的城市' : options.emptyText || '暂无可选城市' }}</text><text class="picker-hint">{{ keyword.trim() ? (scoped ? '试试其他名称；这里只显示当前业务可用的城市' : '试试城市全称、区县名称或拼音') : '' }}</text></view>
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
  if (!disposed && !closing.value && location) toggle(location.name)
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
function toggle(name) {
  // 选中区县时按所属城市保存（思明区 → 厦门），业务数据按城市名匹配
  const city = businessCityName(rows.value, name)
  if (city !== name) { uni.showToast({ title: `已按所属城市「${city}」选择`, icon: 'none' }); name = city }
  if (!options.value.multiple) return close([name])
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
.picker-page { height: 100vh; height: 100dvh; min-height: 0; display: flex; flex-direction: column; overflow: hidden; }
.picker-page > .k-topbar { flex-shrink: 0; }
.picker-tools { padding: 14px 18px 12px; flex-shrink: 0; }
.picker-search { min-height: 46px; padding: 0 12px; display: flex; align-items: center; gap: 9px; border: 1px solid var(--k-line); border-radius: 24px; background: var(--k-paper); }
.picker-search input { flex: 1; min-width: 0; height: 44px; font-size: 14px; }
button { margin: 0; border-radius: 0; background: transparent; color: var(--k-ink); font-size: 15px; line-height: 1.45; }
button::after { border: 0; }
.picker-clear { padding: 0; width: 32px; height: 44px; display: flex; align-items: center; justify-content: center; }
.picker-hint { display: block; color: var(--k-muted); font-size: 12px; line-height: 1.6; margin-top: 9px; }
.picker-summary { display: flex; justify-content: space-between; align-items: center; margin-top: 8px; font-size: 13px; color: var(--k-muted); }
.picker-summary button { font-size: 13px; color: var(--k-red); padding: 10px 0 10px 16px; }
.picker-selected { width: 100%; white-space: nowrap; }
.picker-tag { display: inline-flex; align-items: center; gap: 8px; min-height: 38px; margin: 0 8px 4px 0; padding: 6px 12px; border: 1px solid var(--k-line); border-radius: 19px; font-size: 14px; color: var(--k-red); background: var(--k-paper); }
.picker-results { flex: 1; min-height: 0; height: 0; width: 100%; }
.picker-label { display: block; padding: 15px 18px 10px; color: var(--k-muted); font-size: 13px; }
.picker-hot { display: flex; flex-wrap: wrap; gap: 8px; padding: 0 18px 10px; }
.picker-hot button { min-width: 70px; min-height: 42px; padding: 9px 16px; border: 1px solid var(--k-line); border-radius: 8px; background: var(--k-paper); display: flex; align-items: center; justify-content: center; }
.picker-hot .chosen { border-color: var(--k-red); color: var(--k-red); }
.picker-row { display: flex; width: calc(100% - 36px); margin: 0 18px; padding: 13px 2px; min-height: 58px; align-items: center; justify-content: space-between; gap: 16px; text-align: left; border-bottom: 1px solid var(--k-line); }
.picker-city { min-width: 0; display: flex; flex-direction: column; font-size: 16px; }
.picker-region { display: block; margin-top: 4px; font-size: 12px; line-height: 1.5; color: var(--k-muted); }
.picker-row.chosen .picker-city > text:first-child { color: var(--k-red); font-weight: 600; }
.picker-checkbox { width: 18px; height: 18px; border: 1px solid var(--k-line2); border-radius: 4px; flex-shrink: 0; }
.picker-state { padding: 38px 24px; text-align: center; color: var(--k-muted); font-size: 15px; }
/* 全局 button 的 line-height: inherit + 这里没有内边距：「重新加载」字贴在 44px 按钮顶上，改为居中 */
.picker-retry { color: var(--k-red); margin: 18px auto 0; min-height: 44px; padding: 0 24px; display: flex; align-items: center; justify-content: center; }
.picker-end { display: block; padding: 20px; text-align: center; font-size: 12px; color: var(--k-muted); }
.picker-footer { flex-shrink: 0; padding: 10px 18px calc(10px + var(--k-safe-bottom)); border-top: 1px solid var(--k-line); background: var(--k-bg); }
.picker-confirm, .picker-cancel { width: 100%; min-height: 46px; border-radius: 9px; padding: 12px; }
.picker-confirm { background: var(--k-red); color: var(--k-paper); }
.picker-confirm[disabled] { opacity: .55; }
.picker-cancel { color: var(--k-muted); }
.picker-location { display:flex; align-items:center; gap:8px; min-height:44px; margin-top:8px; padding:8px 0; color:var(--k-red); }
</style>
