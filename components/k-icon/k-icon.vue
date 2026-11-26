<template>
  <image class="k-icon" :src="src" :style="{ width: px, height: px, opacity }" mode="aspectFit" @click="emit('click', $event)" />
</template>

<script setup>
import { computed } from 'vue'
import icons from '@/common/icons.js'
import { userIconPicture, userIconSvg } from '@/common/user-icons/art.js'
import { useUserIcons } from '@/common/user-icons/scope.js'

defineOptions({ options: { virtualHost: true, styleIsolation: 'apply-shared' } })

const TONES = {
  // 和 styles/theme.scss 的 --k-* 保持一致（图标画在 SVG 里，读不到 CSS 变量）；red 是暖棕主色，alert 是提醒红
  ink: '#3A322B', ink2: '#5A5149', muted: '#6F6A65', light: '#A39A92', line: '#DDD5C9',
  red: '#9A6B3F', alert: '#C04437', green: '#4A6E3A', ochre: '#C99043', indigo: '#40576B',
  paper: '#FFFFFF', white: '#FFFFFF'
}

// 小程序里 virtualHost 组件接不到父级写在组件上的原生 @click，这里显式转发一次
const emit = defineEmits(['click'])

const props = defineProps({
  name: { type: String, default: 'circle' },       // lucide 图标名，见 common/icons.js
  art: { type: String, default: '' },               // 这个入口在用户端确认稿中的专用图形
  legacy: Boolean,                                 // 用户页面上的狼人杀入口沿用游戏图标
  size: { type: [Number, String], default: 20 },   // px
  color: { type: String, default: 'ink' },         // 语义色名或 #hex
  // 线条粗细（24 格画布里的单位）。不传就按图标大小自动配（11-18 第三轮：全站图标统一粗细）：
  // 原来一律 1.6，12 号小图标实际只有 0.8px 细得发虚、40 号大图标又显得笨；现在小图标加粗、大图标收细，看上去都是约 1.1–1.6px 的同一种线
  stroke: { type: [Number, String], default: '' },
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
const userTheme = useUserIcons()
const illustrated = computed(() => userTheme.value && !props.legacy)
const opacity = computed(() => illustrated.value ? ({ muted: .88, light: .65, line: .5 }[props.color]) : undefined)
const autoStroke = (n) => (n <= 13 ? 2.2 : n <= 16 ? 2 : n <= 20 ? 1.8 : n <= 24 ? 1.7 : n <= 32 ? 1.5 : 1.3)
const src = computed(() => {
  const color = TONES[props.color] || props.color
  if (illustrated.value) {
    const name = props.art || props.name
    const picture = userIconPicture(name)
    if (picture) return picture
    const style = { fill: props.fill, tone: props.color, color, stroke: props.stroke, size: Number(props.size) }
    const artwork = userIconSvg(name, style) || (props.art && userIconSvg(props.name, style))
    if (artwork) return `data:image/svg+xml;base64,${b64(artwork)}`
  }
  const body = icons[props.name] || icons.circle
  const stroke = props.stroke === '' || props.stroke == null ? autoStroke(Number(props.size) || 20) : props.stroke
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="${props.fill ? color : 'none'}" stroke="${color}" stroke-width="${stroke}" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`
  return `data:image/svg+xml;base64,${b64(svg)}`
})
</script>

<style scoped lang="scss">
.k-icon { display: inline-block; flex: 0 0 auto; vertical-align: middle; }
</style>
