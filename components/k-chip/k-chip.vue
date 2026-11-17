<template>
  <view class="k-chip" :class="[`is-${tone}`, { 'is-pill': pill, 'is-selected': selected, 'is-outline': outline }]" :hover-class="pill ? 'k-press' : 'none'" @click="$emit('click')">
    <k-icon v-if="icon" :name="icon" :size="pill ? 13 : 11" :color="iconColor" :stroke="2" :fill="iconFill" />
    <slot />
  </view>
</template>

<script setup>
import { computed } from 'vue'
defineOptions({ options: { virtualHost: true, styleIsolation: 'apply-shared' } })
const props = defineProps({
  tone: { type: String, default: 'neutral' },  // neutral | green | blue | ochre | red(提醒红：加急/避雷/退回) | ink
  icon: { type: String, default: '' },          // 前置小图标，如 shield-check
  iconFill: { type: Boolean, default: false },
  pill: { type: Boolean, default: false },      // 筛选胶囊（全圆角、更大）
  outline: { type: Boolean, default: false },   // 描边样式
  selected: { type: Boolean, default: false }   // 选中：浅棕底 + 棕字 + 棕框
})
defineEmits(['click'])
const iconColor = computed(() => props.selected ? 'red' : ({ green: 'green', blue: 'indigo', ochre: 'ochre', red: 'alert', ink: 'ink' }[props.tone] || 'ink2'))
</script>

<style scoped lang="scss">
.k-chip { display: inline-flex; align-items: center; gap: 3px; height: 20px; padding: 0 6px; border-radius: 6px; border: 1px solid transparent; font-size: 11px; line-height: 1; white-space: nowrap; color: var(--k-ink2); background: var(--k-paper2); flex: 0 0 auto; }
.is-green { color: var(--k-green); background: var(--k-green-soft); }
.is-blue { color: var(--k-indigo); background: var(--k-indigo-soft); }
.is-ochre { color: var(--k-ochre-deep); background: var(--k-ochre-soft); }
.is-red { color: var(--k-alert); background: var(--k-alert-soft); }
.is-ink { color: var(--k-ink); background: var(--k-paper2); }
.is-outline { background: transparent; border-color: currentColor; }
/* 筛选胶囊：奶油底不描边；选中时底色、文字、边框一起变（棕字用深一档的 --k-red-deep，浅底上才够清楚） */
.is-pill { height: 32px; padding: 0 14px; border-radius: 999px; font-size: 13px; color: var(--k-ink2); background: var(--k-paper2); border-color: transparent; }
.is-pill.is-green { color: var(--k-green); background: var(--k-green-soft); }
.is-selected { color: var(--k-red-deep); background: var(--k-red-soft); border-color: var(--k-red-line); font-weight: 600; }
</style>
