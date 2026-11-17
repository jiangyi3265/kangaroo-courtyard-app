<template>
  <!-- 评价指定横屏；其他入口按视频比例。画面占满播放区域，关闭栏悬浮，不挤占视频高度。 -->
  <view v-if="src" class="svp" :class="{ 'svp--land': rotate }" :style="rotateStyle" @touchmove.stop.prevent="noop">
    <view class="svp__bar" :style="'padding-top: ' + barTop + 'px'">
      <view class="svp__close" hover-class="k-press-s" @click="close"><k-icon name="x" :size="18" color="white" :stroke="2.2" /><text class="svp__close-text">关闭</text></view>
      <text v-if="title" class="svp__title">{{ title }}</text>
    </view>
    <video :id="vid" class="svp__video" :src="fullSrc" :poster="fullPoster" autoplay controls show-fullscreen-btn show-center-play-btn :enable-progress-gesture="!rotate" object-fit="contain" :direction="fullDir"
      @loadedmetadata="onMeta" @fullscreenchange="onFull" @error="onError" />
  </view>
</template>

<script setup>
import { ref, computed, watch, nextTick, onBeforeUnmount, getCurrentInstance } from 'vue'
import { absUrl } from '@/common/upload.js'
import { fullDirection, landscapeTurn } from './stays-media.js'

const props = defineProps({
  src: { type: String, default: '' },      // 平台视频路径（/profile/upload/videos/…）；空 = 不显示
  poster: { type: String, default: '' },   // 封面（可以没有，没有就是黑底）
  title: { type: String, default: '' },
  landscape: { type: Boolean, default: false }
})
const emit = defineEmits(['close'])
const noop = () => {}
const inst = getCurrentInstance()
// 一个页面里只会同时放一段视频，id 写死就行；带上组件编号，免得以后一页放两个播放层撞 id
const vid = 'stay-video-' + (inst ? inst.uid : 0)
const fullSrc = computed(() => absUrl(props.src))
const fullPoster = computed(() => (props.poster ? absUrl(props.poster) : ''))

let top = 20
// #ifndef H5
try { top = (uni.getSystemInfoSync().statusBarHeight || 20) + 4 } catch (e) { top = 24 }
// #endif

// 视频自己的宽高（loadedmetadata 给的），0 = 还不知道
const size = ref({ w: 0, h: 0 })
// 网页版：可视区宽高，转不转、转了多大都按它算（小程序里一直是 0，不转）
const viewport = ref({ w: 0, h: 0 })
const turn = computed(() => landscapeTurn(props.landscape ? { w: 2, h: 1 } : size.value, viewport.value))
const rotate = computed(() => !!turn.value)
// 转 90° 以后：层的宽 = 屏幕高、高 = 屏幕宽，先转再往右挪一个屏幕宽，正好盖满（顶栏在横过来以后的上边）
const rotateStyle = computed(() => (turn.value ? `width: ${turn.value.width}px; height: ${turn.value.height}px; transform: ${turn.value.transform};` : ''))
// 2026-11-03 主人：「播放直接大屏播放的时候直接横屏」—— 点播放器自带的全屏钮也按视频方向进全屏（小程序 video 的 direction）：
// 横拍的、还不知道宽高的 → 90 横屏；竖拍的 → 0 竖着放（竖视频硬转成横屏，人是躺着的）。评价视频（landscape）一律横屏
const fullDir = computed(() => {
  if (props.landscape) return 90
  const d = fullDirection(size.value)
  return d == null ? 90 : d
})
// 转过来以后顶栏贴着横屏的上边，不用再让状态栏
const barTop = computed(() => (rotate.value ? 10 : top))

let wentFull = false
let requested = false
let requestedDirection = null
let playbackToken = 0
let closed = false
let ctx = null
let fallback = null
const clearFallback = () => { if (fallback) { clearTimeout(fallback); fallback = null } }

// 小程序：请求系统全屏。拿到宽高时按横竖指定方向；没拿到（网太慢）不指定，交给微信自己按宽高比判断
function goFull(direction) {
  if (closed || !props.src) return
  // 慢网络先以自动方向进全屏，元数据到达后仍可修正为明确的横/竖屏。
  if (requested && (direction == null || requestedDirection != null)) return
  requested = true
  requestedDirection = direction
  const token = playbackToken
  clearFallback()
  nextTick(() => {
    if (closed || !props.src || token !== playbackToken) return
    try {
      ctx = uni.createVideoContext(vid, inst && inst.proxy)
      ctx.requestFullScreen(direction == null ? {} : { direction })
    } catch (e) { requested = false /* 保留全屏播放层，元数据到达时可重试 */ }
  })
}

watch(() => props.src, (v) => {
  wentFull = false
  requested = false
  requestedDirection = null
  playbackToken++
  closed = !v
  ctx = null
  size.value = { w: 0, h: 0 }
  clearFallback()
  if (!v) return
  // #ifdef MP-WEIXIN
  // 等 loadedmetadata 拿到宽高再进全屏；2.5 秒还没拿到就先进（不指定方向）
  fallback = setTimeout(() => goFull(props.landscape ? 90 : null), 2500)
  // #endif
  // #ifdef H5
  measure()
  // #endif
}, { immediate: true })

function onMeta(e) {
  const d = (e && e.detail) || {}
  size.value = { w: Number(d.width) || 0, h: Number(d.height) || 0 }
  // #ifdef MP-WEIXIN
  goFull(props.landscape ? 90 : fullDirection(size.value))
  // #endif
}

// #ifdef H5
function measure() {
  try { viewport.value = { w: window.innerWidth, h: window.innerHeight } } catch (e) { /* 拿不到就按竖屏、不转 */ }
}
try { window.addEventListener('resize', measure) } catch (e) { /* 没有 window 的环境不用管 */ }
onBeforeUnmount(() => { try { window.removeEventListener('resize', measure) } catch (e) { /* ignore */ } })
// #endif
onBeforeUnmount(() => { closed = true; playbackToken++; clearFallback() })

function onFull(e) {
  const full = !!(e && e.detail && e.detail.fullScreen)
  if (full) { wentFull = true; return }
  // #ifdef MP-WEIXIN
  // 从系统全屏退出（点了返回 / 收起）就是看完了：关掉播放层，回到原来的页面
  if (wentFull) close()
  // #endif
}

function onError() {
  uni.showToast({ title: '视频暂时播放不了，请稍后再试', icon: 'none' })
}

function close() {
  closed = true
  playbackToken++
  try { if (ctx) ctx.stop() } catch (e) { /* 已经停了 */ }
  ctx = null
  wentFull = false
  clearFallback()
  emit('close')
}
</script>

<style scoped lang="scss">
.svp { position: fixed; left: 0; right: 0; top: 0; bottom: 0; z-index: 900; background: #000; display: flex; flex-direction: column; }
/* 网页版横屏：宽高和位移由 rotateStyle 按屏幕算好，这里只放开右 / 下边、定转轴 */
.svp--land { right: auto; bottom: auto; transform-origin: 0 0; }
.svp__bar { position: absolute; z-index: 2; top: 0; left: 0; right: 0; padding-left: 12px; padding-right: 12px; padding-bottom: 12px; display: flex; align-items: center; gap: 10px; background: linear-gradient(rgba(0, 0, 0, .55), transparent); pointer-events: none; }
.svp__close { min-height: 44px; padding: 0 12px; border-radius: 999px; background: rgba(0, 0, 0, .45); display: flex; align-items: center; gap: 4px; pointer-events: auto; }
.svp__close-text { color: #fff; font-size: 14px; }
.svp__title { flex: 1; min-width: 0; color: rgba(255, 255, 255, .86); font-size: 14px; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
.svp__video { position: absolute; left: 0; top: 0; width: 100%; height: 100%; background: #000; }
</style>
