<template>
  <!-- 岗位采访默认在原卡片内播放，用户可通过原生控件自行进入全屏。 -->
  <view v-if="src" class="svp" :class="{ 'svp--inline': inline }">
    <view v-if="!inline" class="svp__bar" :style="'padding-top: ' + top + 'px'">
      <view class="svp__close" hover-class="k-press-s" @click="close"><k-icon name="x" :size="18" color="white" :stroke="2.2" /><text class="svp__close-text">关闭</text></view>
      <text v-if="title" class="svp__title">{{ title }}</text>
    </view>
    <video :id="vid" class="svp__video" :src="fullSrc" :poster="fullPoster" autoplay controls playsinline webkit-playsinline show-fullscreen-btn show-center-play-btn enable-progress-gesture object-fit="contain"
      @fullscreenchange="onFull" @error="onError"><cover-view class="svp__rate" @click.stop="changeRate">{{rate}}× 倍速</cover-view></video>
  </view>
</template>

<script setup>
import { ref, computed, watch, nextTick, getCurrentInstance } from 'vue'
import { absUrl } from '@/common/upload.js'

const props = defineProps({
  src: { type: String, default: '' },      // 平台视频路径（/profile/upload/videos/…）；空 = 不显示
  poster: { type: String, default: '' },   // 封面（可以没有，没有就是黑底）
  title: { type: String, default: '' },
  inline: { type: Boolean, default: false }
})
defineOptions({ options: { virtualHost: true } })
const emit = defineEmits(['close'])
const inst = getCurrentInstance()
// 一个页面里只会同时放一段视频，id 写死就行；带上组件编号，免得以后一页放两个播放层撞 id
const vid = 'job-video-' + (inst ? inst.uid : 0)
const fullSrc = computed(() => absUrl(props.src))
const fullPoster = computed(() => (props.poster ? absUrl(props.poster) : ''))

const rate=ref(1)
function changeRate(){const options=[0.5,0.8,1,1.25,1.5];const next=options[(options.indexOf(rate.value)+1)%options.length];try{ctx=uni.createVideoContext(vid,inst&&inst.proxy);ctx.playbackRate(next);rate.value=next}catch(e){uni.showToast({title:'当前设备暂不支持倍速',icon:'none'})}}
let top = 20
// #ifndef H5
try { top = (uni.getSystemInfoSync().statusBarHeight || 20) + 4 } catch (e) { top = 24 }
// #endif

let wentFull = false
let ctx = null
watch(() => props.src, (v) => {
  wentFull = false
  if (!v || props.inline) return
  // #ifdef MP-WEIXIN
  nextTick(() => setTimeout(() => {
    try {
      ctx = uni.createVideoContext(vid, inst && inst.proxy)
      ctx.requestFullScreen({})
    } catch (e) { /* 进不了系统全屏也没关系：黑底层本身就占满屏幕 */ }
  }, 350))
  // #endif
}, { immediate: true })

function onFull(e) {
  const full = !!(e && e.detail && e.detail.fullScreen)
  if (full) { wentFull = true; return }
  // #ifdef MP-WEIXIN
  // 从系统全屏退出（点了返回 / 收起）就是看完了：关掉播放层，回到原来的页面
  if (wentFull && !props.inline) close()
  // #endif
}

function onError() {
  uni.showToast({ title: '视频暂时播放不了，请稍后再试', icon: 'none' })
}

function close() {
  try { if (ctx) ctx.stop() } catch (e) { /* 已经停了 */ }
  ctx = null
  wentFull = false
  emit('close')
}
</script>

<style scoped lang="scss">
.svp__rate{position:absolute;right:12px;top:12px;z-index:3;background:rgba(0,0,0,.65);color:white;font-size:13px;line-height:32px;padding:0 10px;border-radius:16px}
.svp { position: fixed; left: 0; right: 0; top: 0; bottom: 0; z-index: 900; background: #000; display: flex; flex-direction: column; }
.svp__bar { flex: 0 0 auto; padding-left: 12px; padding-right: 12px; padding-bottom: 8px; display: flex; align-items: center; gap: 10px; }
.svp__close { height: 32px; padding: 0 12px; border-radius: 999px; background: rgba(255, 255, 255, .16); display: flex; align-items: center; gap: 4px; }
.svp__close-text { color: #fff; font-size: 14px; }
.svp__title { flex: 1; min-width: 0; color: rgba(255, 255, 255, .86); font-size: 14px; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
.svp__video { flex: 1; width: 100%; height: 0; min-height: 0; background: #000; }
.svp--inline { position: relative; width: 100%; height: 100%; z-index: auto; display: block; }
.svp--inline .svp__video { display: block; width: 100%; height: 100%; }
</style>
