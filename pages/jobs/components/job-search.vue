<template>
  <view class="job-search" :class="{ 'job-search--travel': theme === 'travel' }">
    <view class="js-box" :class="{ 'js-box--focus': focused }">
      <k-icon name="search" :size="16" color="muted" :stroke="1.8" />
      <input class="js-input" :value="modelValue" maxlength="30" confirm-type="search" :placeholder="placeholder" placeholder-class="js-placeholder" @input="input" @focus="focus" @blur="blur" @confirm="search" />
      <view v-if="modelValue" class="js-clear" aria-role="button" aria-label="清空搜索" hover-class="k-press" @click="clear"><k-icon name="x" :size="15" color="muted" /></view>
      <view class="js-go" aria-role="button" aria-label="搜索岗位" hover-class="k-press-s" @click="search"><k-icon name="search" :size="17" color="white" /></view>
    </view>
    <view v-if="showSuggestions" class="js-suggest">
      <view class="js-suggest__head"><text>选择城市</text><text class="js-suggest__hint">可多选 · 最多 {{ max }} 个</text></view>
      <scroll-view scroll-y class="js-suggest__list">
        <view v-for="cityItem in suggestions" :key="cityItem.name" class="js-city" hover-class="k-press" @click="choose(cityItem)">
          <k-icon name="map-pin" :size="17" :color="cities.includes(cityItem.city) ? accent : 'muted'" />
          <view class="js-city__copy"><text class="js-city__name">{{ cityItem.label }}</text><text v-if="cityItem.region" class="js-city__region">{{ cityItem.region }}</text></view>
          <text v-if="cities.includes(cityItem.city)" class="js-city__selected">已选</text><text v-else-if="cityItem.count" class="js-city__count">{{ cityItem.count }} 个岗位</text>
          <k-icon :name="cities.includes(cityItem.city) ? 'circle-check' : 'plus'" :size="17" :color="accent" />
        </view>
        <text v-if="!suggestions.length" class="js-state">{{ loading ? '正在查找城市…' : failed ? '城市联想暂不可用，可重试或直接搜索岗位' : '没有匹配城市，可按当前文字搜索岗位' }}</text>
        <view v-if="failed" class="js-retry" hover-class="k-press" @click="loadCities"><text>重新加载城市</text></view>
      </scroll-view>
      <view class="js-keyword" hover-class="k-press" @click="search"><k-icon name="search" :size="15" :color="accent" /><text>搜索“{{ modelValue }}”相关岗位</text><k-icon name="chevron-right" :size="14" color="muted" /></view>
    </view>
  </view>
</template>

<script setup>
import { ref, computed, watch, onBeforeUnmount } from 'vue'
import { citySuggestions } from '../job-city-search.js'
import { loadJobCityDirectory, loadJobCities } from '../job-city-source.js'
const props = defineProps({ modelValue: { type: String, default: '' }, type: { type: String, default: 'volunteer' }, cities: { type: Array, default: () => [] }, max: { type: Number, default: 5 }, placeholder: { type: String, default: '搜索城市、岗位或旅行偏好' }, theme: { type: String, default: '' } })
const emit = defineEmits(['update:modelValue', 'search', 'city', 'clear'])
const accent = 'red'
const focused = ref(false), loading = ref(false), failed = ref(false), directory = ref([]), jobCities = ref([])
const showSuggestions = computed(() => focused.value && props.type !== 'online' && !!props.modelValue.trim())
const suggestions = computed(() => citySuggestions(directory.value, jobCities.value, props.modelValue, 8))
let blurTimer, request = 0, loadedType = ''
async function loadCities() {
  const type = props.type
  if (type === 'online' || loadedType === type && !failed.value) return
  const seq = ++request
  loading.value = true; failed.value = false
  const result = await Promise.allSettled([loadJobCityDirectory(), loadJobCities(type)])
  if (seq !== request) return
  if (result[0].status === 'fulfilled') directory.value = result[0].value.all || []
  if (result[1].status === 'fulfilled') jobCities.value = result[1].value
  failed.value = result[0].status === 'rejected'
  loading.value = false; loadedType = type
}
const focus = () => { clearTimeout(blurTimer); focused.value = true; loadCities() }
const blur = () => { blurTimer = setTimeout(() => { focused.value = false }, 200) }
const input = event => { emit('update:modelValue', event.detail.value); focused.value = true }
const close = () => { clearTimeout(blurTimer); focused.value = false; uni.hideKeyboard() }
const search = () => { close(); emit('search') }
const clear = () => { close(); emit('update:modelValue', ''); emit('clear') }
const choose = city => { close(); emit('city', city.city) }
watch(() => props.type, () => { close(); request++; loading.value = false; jobCities.value = []; loadedType = '' })
onBeforeUnmount(() => { clearTimeout(blurTimer); request++ })
</script>

<style scoped lang="scss">
.job-search { position: relative; margin: 10px 0 14px; }
.js-box { display: flex; align-items: center; gap: 8px; min-height: 54px; padding: 4px 5px 4px 14px; box-sizing: border-box; border: 1px solid #E9E1D7; border-radius: 16px; background: #FFFDFA; box-shadow: 0 4px 16px rgba(94,65,36,.06); }
.js-box--focus { border-color: #B98A56; }
.js-input { flex: 1; min-width: 0; height: 44px; font-size: 14px; color: var(--k-ink); }
.js-placeholder { font-size: 13px; color: var(--k-muted); }
.js-clear { flex: 0 0 30px; height: 44px; display: flex; align-items: center; justify-content: center; }
.js-go { flex: 0 0 44px; height: 44px; border-radius: 13px; display: flex; align-items: center; justify-content: center; background: #A57242; }
.js-suggest { position: absolute; left: 0; right: 0; top: calc(100% + 6px); z-index: 40; border: 1px solid #E9E1D7; border-radius: 16px; background: #FFFDFA; box-shadow: 0 12px 28px rgba(69,47,28,.16); overflow: hidden; }
.js-suggest__head { display: flex; align-items: center; justify-content: space-between; padding: 13px 14px 7px; font-size: 14px; font-weight: 700; color: var(--k-ink); }
.js-suggest__hint { font-size: 11px; font-weight: 400; color: var(--k-muted); }
.js-suggest__list { max-height: 240px; }
.js-city { display: flex; align-items: center; gap: 8px; min-height: 54px; margin: 0 14px; border-bottom: 1px solid var(--k-line); }
.js-city__copy { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 3px; padding: 8px 0; }
.js-city__name { color: var(--k-ink); font-size: 14px; }
.js-city__region { color: var(--k-muted); font-size: 11px; }
.js-city__selected, .js-city__count { flex: 0 0 auto; font-size: 11px; color: var(--k-red-deep); }
.js-state { display: block; padding: 14px; font-size: 13px; color: var(--k-muted); line-height: 1.6; }
.js-retry { padding: 0 14px 12px; font-size: 13px; color: var(--k-red-deep); }
.js-keyword { display: flex; align-items: center; gap: 7px; padding: 12px 14px; min-height: 44px; box-sizing: border-box; color: var(--k-red-deep); font-size: 13px; }
.js-keyword text { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.js-box { border-radius: 27px; border-color: #CEB89D; box-shadow: 0 3px 10px rgba(94,65,36,.04); }
.js-go { border-radius: 22px; }
/* 2026-11-03 主人：换宿列表整体收小一档，搜索框从 52px 压到 44px */
.job-search--travel { margin: 6px 0 4px; }
.job-search--travel .js-box { min-height: 44px; padding: 3px 3px 3px 12px; border-color: var(--k-line2); background: var(--k-paper); box-shadow: none; }
.job-search--travel .js-box--focus { border-color: var(--k-red); }
.job-search--travel .js-input { height: 38px; font-size: 13px; color: var(--k-ink); }
.job-search--travel .js-placeholder { font-size: 12px; }
.job-search--travel .js-clear { height: 38px; }
.job-search--travel .js-go { flex-basis: 42px; height: 36px; border-radius: 18px; background: var(--k-red); }
.job-search--travel .js-city__selected, .job-search--travel .js-city__count, .job-search--travel .js-keyword, .job-search--travel .js-retry { color: var(--k-red-deep); }
.job-search--travel .js-suggest { border-color: var(--k-line2); box-shadow: 0 10px 28px rgba(94,65,36,.12); }
</style>
