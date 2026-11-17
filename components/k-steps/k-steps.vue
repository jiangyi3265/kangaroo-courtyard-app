<template>
  <view class="k-steps" :class="{ 'is-compact': compact }">
    <view v-for="(step, i) in steps" :key="i" class="k-steps__item" :class="stateOf(i + 1)">
      <view class="k-steps__track">
        <view v-if="i > 0" class="k-steps__line k-steps__line--l" />
        <view v-if="i < steps.length - 1" class="k-steps__line k-steps__line--r" />
        <view class="k-steps__dot">
          <k-icon v-if="stateOf(i + 1) === 'done'" name="check" :size="compact ? 10 : 12" color="white" :stroke="3" />
          <text v-else>{{ i + 1 }}</text>
        </view>
      </view>
      <text class="k-steps__label">{{ step }}</text>
    </view>
  </view>
</template>

<script setup>
defineOptions({ options: { virtualHost: true, styleIsolation: 'apply-shared' } })
const props = defineProps({
  steps: { type: Array, default: () => [] },
  current: { type: Number, default: 1 },      // 1 起，当前步（暖棕）
  doneStyle: { type: String, default: 'green' }, // 已完成节点颜色 green | red
  compact: { type: Boolean, default: false }
})
const stateOf = (n) => n < props.current ? 'done' : n === props.current ? 'current' : 'todo'
</script>

<style scoped lang="scss">
.k-steps { display: flex; width: 100%; }
.k-steps__item { flex: 1; min-width: 0; display: flex; flex-direction: column; align-items: center; gap: 5px; font-size: 11px; color: var(--k-muted); text-align: center; }
.k-steps__track { position: relative; width: 100%; height: 22px; display: flex; align-items: center; justify-content: center; }
.k-steps__line { position: absolute; top: 50%; height: 1px; background: var(--k-line2); }
.k-steps__line--l { left: 0; right: 50%; margin-right: 11px; }
.k-steps__line--r { left: 50%; right: 0; margin-left: 11px; }
.k-steps__dot { position: relative; z-index: 1; width: 22px; height: 22px; border-radius: 50%; border: 1.5px solid var(--k-line2); background: var(--k-paper); display: flex; align-items: center; justify-content: center; font-size: 11px; font-weight: 600; color: var(--k-muted); }
.k-steps__label { white-space: nowrap; }
.done .k-steps__dot { border-color: var(--k-green); background: var(--k-green); color: #fff; }
.done .k-steps__line--l, .done .k-steps__line--r, .current .k-steps__line--l { background: var(--k-green); }
.done .k-steps__label { color: var(--k-muted); }
.current .k-steps__dot { border-color: var(--k-red); background: var(--k-red); color: #fff; }
.current .k-steps__label { color: var(--k-red-deep); font-weight: 600; }
.is-compact .k-steps__track { height: 18px; }
.is-compact .k-steps__dot { width: 18px; height: 18px; font-size: 10px; }
.is-compact .k-steps__line--l { margin-right: 9px; }
.is-compact .k-steps__line--r { margin-left: 9px; }
.is-compact .k-steps__item { font-size: 10px; }
</style>
