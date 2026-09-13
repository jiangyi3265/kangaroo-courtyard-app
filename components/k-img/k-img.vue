<template>
  <view class="k-img" :style="boxStyle" @click="$emit('click')">
    <image v-if="src" class="k-img__inner" :src="src" :mode="mode" />
    <view v-if="$slots.default" class="k-img__overlay" :class="{ 'is-shade': shade }"><slot /></view>
  </view>
</template>

<script setup>
import { computed } from 'vue'
defineOptions({ options: { virtualHost: true, styleIsolation: 'apply-shared' } })
const props = defineProps({
  src: { type: String, default: '' },
  w: { type: [Number, String], default: '100%' },   // 数字=px，字符串原样
  h: { type: [Number, String], default: 120 },
  radius: { type: [Number, String], default: 10 },
  mode: { type: String, default: 'aspectFill' },
  bg: { type: String, default: '#E9E1D4' },
  shade: { type: Boolean, default: false }           // 底部渐变遮罩（图上文字）
})
defineEmits(['click'])
const u = (v) => typeof v === 'number' || /^\d+(\.\d+)?$/.test(String(v)) ? `${v}px` : String(v)
const boxStyle = computed(() => ({ width: u(props.w), height: u(props.h), borderRadius: u(props.radius), background: props.bg }))
</script>

<style scoped lang="scss">
.k-img { position: relative; overflow: hidden; flex: 0 0 auto; }
.k-img__inner { width: 100%; height: 100%; display: block; }
.k-img__overlay { position: absolute; inset: 0; display: flex; flex-direction: column; justify-content: flex-end; padding: 10px; color: #fff; }
.k-img__overlay.is-shade { background: linear-gradient(180deg, rgba(0,0,0,0) 45%, rgba(20,14,10,.62) 100%); }
</style>
