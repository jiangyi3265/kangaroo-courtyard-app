<template>
  <view class="k-card" :class="[`is-${tone}`, { 'is-flat': flat }]" :style="{ padding: padding, borderRadius: radius + 'px' }" @click="$emit('click')"><slot /></view>
</template>

<script setup>
import { computed } from 'vue'
defineOptions({ options: { virtualHost: true, styleIsolation: 'apply-shared' } })
const props = defineProps({
  tone: { type: String, default: 'paper' },   // paper | flax | green | ochre | blue | red
  flat: { type: Boolean, default: false },    // 无阴影（平铺）
  pad: { type: [Number, String], default: 14 },
  radius: { type: [Number, String], default: 16 } // 10-16 改版统一 16px（--k-radius）
})
defineEmits(['click'])
const padding = computed(() => typeof props.pad === 'number' || /^\d+$/.test(String(props.pad)) ? `${props.pad}px` : props.pad)
</script>

<style scoped lang="scss">
/* 卡片不画框：纯白卡片 + 柔和阴影浮在奶白底色上；浅色底的卡片靠底色区分，不加阴影 */
.k-card { display: block; width: 100%; min-width: 0; border: 0; background: var(--k-paper); box-shadow: var(--k-sh1); box-sizing: border-box; }
.is-flat, .is-flax, .is-green, .is-ochre, .is-blue, .is-red { box-shadow: none; }
.is-flax { background: var(--k-paper2); }
.is-green { background: var(--k-green-soft); }
.is-ochre { background: var(--k-ochre-soft); }
.is-blue { background: var(--k-indigo-soft); }
.is-red { background: var(--k-red-soft); }
</style>
