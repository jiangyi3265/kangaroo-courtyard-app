<template>
  <view class="k-chip" :class="[`is-${tone}`, { 'is-pill': pill, 'is-selected': selected, 'is-outline': outline }]" @click="$emit('click')">
    <k-icon v-if="icon" :name="icon" :size="pill ? 13 : 11" :color="iconColor" :stroke="2" :fill="iconFill" />
    <slot />
  </view>
</template>

<script setup>
import { computed } from 'vue'
defineOptions({ options: { virtualHost: true, styleIsolation: 'apply-shared' } })
const props = defineProps({
  tone: { type: String, default: 'neutral' },  // neutral | green | blue | ochre | red | ink
  icon: { type: String, default: '' },          // 前置小图标，如 shield-check
  iconFill: { type: Boolean, default: false },
  pill: { type: Boolean, default: false },      // 筛选胶囊（全圆角、更大）
  outline: { type: Boolean, default: false },   // 描边样式
  selected: { type: Boolean, default: false }   // 选中：漆红实心
})
defineEmits(['click'])
const iconColor = computed(() => props.selected ? 'white' : ({ green: 'green', blue: 'indigo', ochre: 'ochre', red: 'red', ink: 'ink' }[props.tone] || 'muted'))
</script>

<style scoped lang="scss">
.k-chip { display: inline-flex; align-items: center; gap: 3px; height: 20px; padding: 0 7px; border-radius: 5px; border: 1px solid transparent; font-size: 11px; line-height: 1; white-space: nowrap; color: var(--k-muted); background: var(--k-paper2); flex: 0 0 auto; }
.is-green { color: var(--k-green); background: var(--k-green-soft); }
.is-blue { color: var(--k-indigo); background: var(--k-indigo-soft); }
.is-ochre { color: #9A6A22; background: var(--k-ochre-soft); }
.is-red { color: var(--k-red); background: var(--k-red-soft); }
.is-ink { color: var(--k-ink); background: var(--k-paper2); }
.is-outline { background: transparent; border-color: currentColor; }
.is-pill { height: 30px; padding: 0 13px; border-radius: 999px; font-size: 13px; color: var(--k-ink); background: var(--k-paper); border-color: var(--k-line2); }
.is-pill.is-green { color: var(--k-green); background: var(--k-green-soft); border-color: transparent; }
.is-selected { color: #fff; background: var(--k-red); border-color: var(--k-red); }
</style>
