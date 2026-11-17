<template>
  <view class="k-page picker-page">
    <k-topbar :title="o.title || '请选择'" back custom-back @back="close(o.cancelValue)" />

    <!-- 长名单：一屏列出，多了可搜索；点一行即选中返回 -->
    <template v-if="o.mode === 'list'">
      <view v-if="(o.items || []).length > 10" class="picker-tools">
        <view class="picker-search">
          <k-icon name="search" :size="20" color="muted" />
          <input v-model="keyword" placeholder="搜索" placeholder-class="k-placeholder" confirm-type="search" @confirm="hideKeyboard" />
          <view v-if="keyword" class="picker-clear" @click="keyword = ''"><k-icon name="x" :size="18" color="muted" /></view>
        </view>
      </view>
      <scroll-view scroll-y class="picker-results">
        <view v-for="row in rows" :key="row.i" class="picker-row" :class="{ chosen: row.i === o.value }" @click="close(row.i)">
          <text class="picker-row__text">{{ row.label }}</text>
          <k-icon v-if="row.i === o.value" name="check" :size="20" color="red" />
          <k-icon v-else name="chevron-right" :size="18" color="light" />
        </view>
        <view v-if="!rows.length" class="picker-state"><text>{{ keyword ? '没有找到匹配的选项' : '暂无可选项' }}</text></view>
        <view class="picker-gap" />
      </scroll-view>
    </template>

    <!-- 时刻 / 日期 / 月日：滚轮，年份可以一下子滚过好多年 -->
    <template v-else-if="o.mode">
      <view class="wheel-head"><text class="wheel-head__value">{{ preview }}</text><text v-if="hint" class="wheel-head__hint">{{ hint }}</text></view>
      <picker-view class="wheel" :value="idx" indicator-class="wheel__indicator" mask-class="wheel__mask" @change="onWheel">
        <picker-view-column v-for="(col, ci) in cols" :key="ci">
          <view v-for="t in col" :key="t" class="wheel__item"><text>{{ t }}</text></view>
        </picker-view-column>
      </picker-view>
      <view class="picker-gap" />
    </template>

    <view v-else class="picker-state"><text>请返回原页面重新打开</text></view>

    <view class="picker-footer">
      <template v-if="o.mode && o.mode !== 'list'">
        <view v-if="o.emptyText" class="picker-footer__item"><k-button block type="outline" :label="o.emptyText" @click="close('')" /></view>
        <view class="picker-footer__item picker-footer__item--main"><k-button block label="确定" @click="confirmWheel" /></view>
      </template>
      <view v-else class="picker-footer__item"><k-button block type="outline" label="取消" @click="close(o.cancelValue)" /></view>
    </view>
  </view>
</template>

<script setup>
// 通用选择页：见 common/picker.js。结果在 navigateBack 成功后交回（和城市选择页同一套），返回 / 取消交回各模式的「取消值」
import { ref, computed } from 'vue'
import { onLoad, onUnload } from '@dcloudio/uni-app'
import { pickerRequest, finishPicker, daysIn, range, ymd, clampYmd, snapTime } from '@/common/picker.js'
import { todayCn } from '@/common/ui.js'

const o = ref({})
const keyword = ref('')
const idx = ref([0, 0, 0])
let requestId = ''
let result
let closing = false
const hideKeyboard = () => uni.hideKeyboard()
const p2 = (n) => (n < 10 ? '0' + n : '' + n)

onLoad((q) => {
  requestId = (q && q.request) || ''
  const req = pickerRequest(requestId)
  if (!req) return
  o.value = req
  result = req.cancelValue
  initWheel()
})
// 用户直接用系统返回离开（没走 close）时也要把结果交回去，否则原页面一直等着
onUnload(() => finishPicker(requestId, result))

// ---- 列表 ----
const rows = computed(() => {
  const k = keyword.value.trim()
  return (o.value.items || []).map((label, i) => ({ label, i })).filter((r) => !k || r.label.includes(k))
})

// ---- 滚轮 ----
const thisYear = Number(todayCn().slice(0, 4))
const yearSpan = computed(() => {
  const lo = o.value.min ? Number(o.value.min.slice(0, 4)) : thisYear - 70
  const hi = o.value.max ? Number(o.value.max.slice(0, 4)) : thisYear + 5
  return range(lo, Math.max(lo, hi))
})
const minutes = computed(() => range(0, 59, o.value.step || 5))
const cols = computed(() => {
  const mode = o.value.mode
  if (mode === 'time') return [range(0, 23).map(p2), minutes.value.map(p2)]
  if (mode === 'monthday') return [range(1, 12).map((m) => m + '月'), range(1, daysIn(2000, idx.value[0] + 1)).map((d) => d + '日')]
  if (mode === 'date') {
    const y = yearSpan.value[idx.value[0]] || thisYear
    return [yearSpan.value.map((v) => v + '年'), range(1, 12).map((m) => m + '月'), range(1, daysIn(y, idx.value[1] + 1)).map((d) => d + '日')]
  }
  return []
})
function initWheel() {
  const v = o.value.value || ''
  if (o.value.mode === 'time') {
    const [h, mi] = snapTime(v, o.value.step || 5)
    idx.value = [h, Math.max(0, minutes.value.indexOf(mi))]
  } else if (o.value.mode === 'monthday') {
    const m = /^(\d{2})-(\d{2})$/.exec(v)
    idx.value = m ? [+m[1] - 1, +m[2] - 1] : [0, 0]
  } else if (o.value.mode === 'date') {
    const fallback = clampYmd(todayCn(), o.value.min, o.value.max)
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v) || /^(\d{4})-(\d{2})-(\d{2})$/.exec(fallback)
    const yi = Math.max(0, yearSpan.value.indexOf(+m[1]))
    idx.value = [yi, +m[2] - 1, +m[3] - 1]
  }
}
function onWheel(e) {
  const next = [...((e && e.detail && e.detail.value) || idx.value)]
  // 换了月份 / 年份后天数可能变少（31 日 → 2 月）：日不能越界
  if (o.value.mode === 'date') {
    const y = yearSpan.value[next[0]] || thisYear
    next[2] = Math.min(next[2], daysIn(y, next[1] + 1) - 1)
  } else if (o.value.mode === 'monthday') {
    next[1] = Math.min(next[1], daysIn(2000, next[0] + 1) - 1)
  }
  idx.value = next
}
const picked = computed(() => {
  const [a, b, c] = idx.value
  if (o.value.mode === 'time') return `${p2(a)}:${p2(minutes.value[b] || 0)}`
  if (o.value.mode === 'monthday') return `${p2(a + 1)}-${p2(b + 1)}`
  if (o.value.mode === 'date') return ymd(yearSpan.value[a] || thisYear, b + 1, c + 1)
  return ''
})
const preview = computed(() => {
  const v = picked.value
  if (o.value.mode === 'date') return `${+v.slice(0, 4)}年${+v.slice(5, 7)}月${+v.slice(8, 10)}日`
  if (o.value.mode === 'monthday') return `${+v.slice(0, 2)}月${+v.slice(3, 5)}日`
  return v
})
const hint = computed(() => {
  if (o.value.mode !== 'date') return ''
  const { min, max } = o.value
  if (min && max) return `可选 ${min} 至 ${max}`
  if (min) return `最早 ${min}`
  if (max) return `最晚 ${max}`
  return ''
})
function confirmWheel() {
  let v = picked.value
  if (o.value.mode === 'date') {
    const c = clampYmd(v, o.value.min, o.value.max)
    if (c !== v) { uni.showToast({ title: hint.value || '这个日期不能选', icon: 'none' }); return }
  }
  close(v)
}

function close(value) {
  if (closing) return
  closing = true
  result = value
  hideKeyboard()
  uni.navigateBack({
    success: () => finishPicker(requestId, result),
    fail: () => { closing = false; uni.showToast({ title: '请返回原页面重试', icon: 'none' }) }
  })
}
</script>

<style scoped lang="scss">
.picker-page { height: 100vh; height: 100dvh; min-height: 0; display: flex; flex-direction: column; overflow: hidden; }
.picker-tools { padding: 12px 16px 8px; flex-shrink: 0; }
.picker-search { min-height: 44px; padding: 0 12px; display: flex; align-items: center; gap: 9px; border: 1px solid var(--k-line); border-radius: 22px; background: var(--k-paper); }
.picker-search input { flex: 1; min-width: 0; height: 42px; font-size: 14px; }
.picker-clear { width: 32px; height: 42px; display: flex; align-items: center; justify-content: center; }
.picker-results { flex: 1; min-height: 0; height: 0; width: 100%; }
.picker-row { display: flex; align-items: center; justify-content: space-between; gap: 12px; min-height: 54px; margin: 0 16px; padding: 12px 2px; border-bottom: 1px solid var(--k-line); }
.picker-row__text { flex: 1; min-width: 0; font-size: 15px; line-height: 1.5; color: var(--k-ink); word-break: break-all; }
.picker-row.chosen .picker-row__text { color: var(--k-red); font-weight: 600; }
.picker-state { padding: 38px 24px; text-align: center; color: var(--k-muted); font-size: 15px; }
.picker-gap { flex: 1; min-height: 12px; }
.wheel-head { flex-shrink: 0; padding: 28px 16px 8px; text-align: center; }
.wheel-head__value { display: block; font-family: var(--k-serif); font-size: 26px; font-weight: 700; color: var(--k-ink); }
.wheel-head__hint { display: block; margin-top: 6px; font-size: 12px; color: var(--k-muted); }
.wheel { flex-shrink: 0; width: 100%; height: 264px; margin-top: 12px; }
.wheel__item { height: 44px; line-height: 44px; text-align: center; font-size: 18px; color: var(--k-ink); }
.picker-footer { flex-shrink: 0; display: flex; gap: 12px; padding: 10px 16px calc(10px + var(--k-safe-bottom)); border-top: 1px solid var(--k-line); background: var(--k-bg); }
.picker-footer__item { flex: 1; min-width: 0; }
.picker-footer__item--main { flex: 2; }
</style>
<style lang="scss">
/* picker-view 的选中框类名作用在内置组件里，scoped 样式够不到 */
.wheel__indicator { height: 44px; }
/* 滚轮上下的渐隐层默认是白色，和亚麻纸底色（--k-bg）对不上，看着像一块白板 */
.wheel__mask { background-image: linear-gradient(180deg, rgba(250, 247, 241, .96), rgba(250, 247, 241, .5)), linear-gradient(0deg, rgba(250, 247, 241, .96), rgba(250, 247, 241, .5)); background-position: top, bottom; background-size: 100% 110px; background-repeat: no-repeat; }
</style>
