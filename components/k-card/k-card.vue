<template>
  <view class="k-card" :class="[`is-${tone}`, { 'is-flat': flat }]" :style="{ padding: padding, borderRadius: radius + 'px' }" @click="$emit('click')"><slot /></view>
</template>

<script setup>
import { computed } from 'vue'
defineOptions({ options: { virtualHost: true, styleIsolation: 'apply-shared' } })
const props = defineProps({
  tone: { type: String, default: 'paper' },   // paper | flax | green | ochre | blue | red
  flat: { type: Boolean, default: false },    // 无描边
  pad: { type: [Number, String], default: 14 },
  radius: { type: [Number, String], default: 14 }
})
defineEmits(['click'])
const padding = computed(() => typeof props.pad === 'number' || /^\d+$/.test(String(props.pad)) ? `${props.pad}px` : props.pad)
</script>

<style scoped lang="scss">
.k-card { display: block; width: 100%; min-width: 0; border: 1px solid var(--k-line); background: var(--k-paper); box-sizing: border-box; }
.is-flat { border-color: transparent; }
.is-flax { background: var(--k-paper2); border-color: var(--k-line); }
.is-green { background: var(--k-green-soft); border-color: #C9DACC; }
.is-ochre { background: var(--k-ochre-soft); border-color: #E3CFA6; }
.is-blue { background: var(--k-indigo-soft); border-color: #C4D0D8; }
.is-red { background: var(--k-red-soft); border-color: #E3BFB5; }
</style>
