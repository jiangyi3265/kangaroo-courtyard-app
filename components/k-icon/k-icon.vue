<template>
  <image class="k-icon" :src="src" :style="{ width: px, height: px }" mode="aspectFit" />
</template>

<script setup>
import { computed } from 'vue'
import icons from '@/common/icons.js'

defineOptions({ options: { virtualHost: true, styleIsolation: 'apply-shared' } })

const TONES = {
  ink: '#241B17', muted: '#6B635C', light: '#9A8E84', line: '#D9D3C7',
  red: '#A94734', green: '#4F7A66', ochre: '#C99043', indigo: '#40576B',
  paper: '#FBF7F0', white: '#FFFFFF'
}

const props = defineProps({
  name: { type: String, default: 'circle' },       // lucide 图标名，见 common/icons.js
  size: { type: [Number, String], default: 20 },   // px
  color: { type: String, default: 'ink' },         // 语义色名或 #hex
  stroke: { type: [Number, String], default: 1.6 },
  fill: { type: Boolean, default: false }          // 实心（描边色填充）
})

const CH = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
const b64 = (s) => {
  let out = ''
  for (let i = 0; i < s.length; i += 3) {
    const a = s.charCodeAt(i), b = s.charCodeAt(i + 1), c = s.charCodeAt(i + 2)
    const n = (a << 16) | ((b || 0) << 8) | (c || 0)
    out += CH[(n >> 18) & 63] + CH[(n >> 12) & 63] + (isNaN(b) ? '=' : CH[(n >> 6) & 63]) + (isNaN(c) ? '=' : CH[n & 63])
  }
  return out
}

const px = computed(() => `${Number(props.size)}px`)
const src = computed(() => {
  const body = icons[props.name] || icons.circle
  const color = TONES[props.color] || props.color
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="${props.fill ? color : 'none'}" stroke="${color}" stroke-width="${props.stroke}" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`
  return `data:image/svg+xml;base64,${b64(svg)}`
})
</script>

<style scoped lang="scss">
.k-icon { display: inline-block; flex: 0 0 auto; vertical-align: middle; }
</style>
