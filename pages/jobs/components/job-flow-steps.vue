<template>
  <!-- 报名 7 步进度（2026-10-18 主人：报名页、进度页同一套，见 ../apply-flow.js）：
       已完成的暖棕实心带对勾，当前这一步深棕、外面一圈浅晕，没到的白底细框；每步名字分两行写（一行挤不下 7 个「约定视频时间」）。
       current：1 起；8 = 全部完成；0 = 已结束（整条不亮） -->
  <view class="jfs">
    <view v-for="(lines, i) in stepLines" :key="i" class="jfs__item" :class="[stateOf(i + 1), { 'jfs__item--link': arrivalEnabled && i === 6 }]" @click="selectStep(i + 1)">
      <view class="jfs__track">
        <view v-if="i > 0" class="jfs__line jfs__line--l" />
        <view v-if="i < stepLines.length - 1" class="jfs__line jfs__line--r" />
        <view class="jfs__dot">
          <k-icon v-if="stateOf(i + 1) === 'done'" name="check" :size="10" color="white" :stroke="3.2" />
          <text v-else class="jfs__num">{{ i + 1 }}</text>
        </view>
      </view>
      <text class="jfs__label">{{ lines[0] }}</text>
      <text class="jfs__label">{{ lines[1] }}</text>
    </view>
  </view>
</template>

<script setup>
import { computed } from 'vue'
import { FLOW_LINES } from '../apply-flow.js'

defineOptions({ options: { virtualHost: true, styleIsolation: 'apply-shared' } })
const props = defineProps({
  current: { type: Number, default: 1 },
  compact: { type: Boolean, default: false },
  arrivalEnabled: { type: Boolean, default: false }
})
const emit = defineEmits(['arrival'])
const selectStep = n => { if (n === 7 && props.arrivalEnabled) emit('arrival') }
// 候场页使用短名称，七步在小屏仍完整横排；其他报名页面沿用原名称。
const stepLines = computed(() => props.compact ? FLOW_LINES.map((lines, i) => i === 2 ? ['视频', '面试'] : i === 3 ? ['签署', '协议'] : lines) : FLOW_LINES)
const stateOf = (n) => (props.current <= 0 ? 'todo' : n < props.current ? 'done' : n === props.current ? 'current' : 'todo')
</script>

<style scoped lang="scss">
.jfs { display: flex; width: 100%; }
.jfs__item { flex: 1; min-width: 0; display: flex; flex-direction: column; align-items: center; }
.jfs__track { position: relative; width: 100%; height: 24px; display: flex; align-items: center; justify-content: center; margin-bottom: 6px; }
.jfs__line { position: absolute; top: 50%; height: 2px; margin-top: -1px; border-radius: 1px; background: #E8DFD3; }
.jfs__line--l { left: 0; right: 50%; margin-right: 9px; }
.jfs__line--r { left: 50%; right: 0; margin-left: 9px; }
.jfs__dot { position: relative; z-index: 1; width: 18px; height: 18px; border-radius: 50%; box-sizing: border-box; border: 1.5px solid #DDD3C6; background: var(--k-paper); display: flex; align-items: center; justify-content: center; }
.jfs__num { font-size: 10px; font-weight: 600; line-height: 1; color: var(--k-light); }
.jfs__label { max-width: 100%; font-size: 11px; line-height: 14px; color: #8A7A69; white-space: nowrap; text-align: center; }
.jfs__item--link .jfs__label { color:var(--k-red-deep); text-decoration:underline; text-underline-offset:3px; }
/* 已完成：主色实心 + 白对勾，连线也染成主色 */
.done .jfs__dot { border-color: var(--k-red); background: var(--k-red); }
.done .jfs__line, .current .jfs__line--l { background: linear-gradient(90deg, #C9A57E, var(--k-red)); }
.done .jfs__label { color: var(--k-ink2); }
/* 当前：深棕实心 + 外圈浅晕，名字加粗 */
.current .jfs__dot { width: 22px; height: 22px; border: 0; background: linear-gradient(135deg, #B9824E 0%, var(--k-red-deep) 100%); box-shadow: 0 0 0 4px rgba(154, 107, 63, .16); }
.current .jfs__num { color: #fff; font-size: 11px; }
.current .jfs__label { color: var(--k-red-deep); font-weight: 700; }
@media (max-width: 359px) { .jfs__label { font-size: 10px; line-height: 14px; } }
</style>
