<template>
  <view class="k-card" :class="[`is-${tone}`, { 'is-flat': flat }]" :style="{ padding: padding, borderRadius: radius + 'px' }" @click="$emit('click')"><slot /></view>
</template>

<script setup>
import { computed } from 'vue'
defineOptions({ options: { virtualHost: true, styleIsolation: 'apply-shared' } })
const props = defineProps({
  tone: { type: String, default: 'paper' },   // paper | flax | green | ochre | blue | red
  flat: { type: Boolean, default: false },    // 无阴影（11-18 起卡片默认就不带阴影，留着兼容老写法）
  pad: { type: [Number, String], default: 14 },
  radius: { type: [Number, String], default: 12 } // 11-18 精修词典：白卡 12（各页早已盖成 12）
})
defineEmits(['click'])
const padding = computed(() => typeof props.pad === 'number' || /^\d+$/.test(String(props.pad)) ? `${props.pad}px` : props.pad)
</script>

<style scoped lang="scss">
/* 11-18 精修词典：白卡不画框、不加阴影，靠浅灰页面底色和留白分开；浅色底的卡片靠底色区分 */
.k-card { display: block; width: 100%; min-width: 0; border: 0; background: var(--k-paper); box-sizing: border-box; }
.is-flax { background: var(--k-paper2); }
.is-green { background: var(--k-green-soft); }
.is-ochre { background: var(--k-ochre-soft); }
.is-blue { background: var(--k-indigo-soft); }
.is-red { background: var(--k-red-soft); }
</style>
