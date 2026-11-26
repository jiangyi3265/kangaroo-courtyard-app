<template>
  <view class="ar">
    <text class="ar-tip" aria-live="polite">{{ complete ? '已读完，可以确认' : remaining > 0 ? '请阅读至少 ' + AGREEMENT_READ_SECONDS + ' 秒，还剩 ' + remaining + ' 秒' : '阅读时间已到，请下滑读至末尾' }}</text>
    <scroll-view :key="generation" :data-version="generation" scroll-y :show-scrollbar="false" :lower-threshold="2" class="ar-scroll" :style="{ height }" @scroll="scroll" @scrolltolower="nativeBottom" @touchstart="measure" @touchend="schedule" @click="schedule">
      <view class="ar-body"><rich-text v-if="html" :nodes="html" /><text v-else-if="text" class="ar-text" selectable>{{ text }}</text><slot v-else /></view>
    </scroll-view>
    <button v-if="unmeasured" class="ar-retry" @click="schedule">重新检查阅读进度</button>
  </view>
</template>
<script setup>
import { ref, watch, nextTick, getCurrentInstance, onMounted, onBeforeUnmount } from 'vue'
import { onHide, onShow } from '@dcloudio/uni-app'
import { advanceRead, readingClock, AGREEMENT_READ_SECONDS } from '@/common/agreement-progress.js'
const props = defineProps({ contentKey: [String, Number], html: String, text: String, height: { type: String, default: '48vh' } })
const emit = defineEmits(['read', 'remaining'])
const instance = getCurrentInstance(), complete = ref(false), unmeasured = ref(false), generation = ref(0)
let state = { started: false }, scrollTop = 0, timer = null, alive = true, observer = null
const remaining = ref(AGREEMENT_READ_SECONDS)
watch(remaining, seconds => emit('remaining', seconds), { immediate: true, flush: 'sync' })
let reachedEnd = false, pageVisible = true
function checkComplete() {
  if (reachedEnd && !remaining.value && !complete.value) { complete.value = true; emit('read', true) }
}
const clock = readingClock(seconds => { remaining.value = seconds; checkComplete() })
onHide(() => { pageVisible = false; clock.pause() })
onShow(() => { pageVisible = true; schedule() })
function reset() {
  reachedEnd = false
  clock.reset()
  ++generation.value
  state = { started: false }; scrollTop = 0; complete.value = false; emit('read', false)
  observer?.disconnect()
  observe()
}
function observe() {
  const version = generation.value
  nextTick(() => {
    if (!alive || version !== generation.value) return
    measure()
    schedule()
    try {
      observer = uni.createIntersectionObserver(instance.proxy, { thresholds: [0, 1] }).relativeToViewport()
      observer.observe('.ar-scroll', schedule)
    } catch { /* 点击或滑动正文后重测 */ }
  })
}
function scroll(e) {
  if (Number(e.currentTarget?.dataset?.version) !== generation.value) return
  scrollTop = Math.max(0, Number(e.detail.scrollTop) || 0); schedule()
}
function nativeBottom(e) {
  if (!pageVisible || Number(e.currentTarget?.dataset?.version) !== generation.value) return
  measure(true)
}
function schedule() { if (timer || !alive) return; timer = setTimeout(() => { timer = null; measure() }, 80) }
function measure(nativeEnd = false) {
  const version = generation.value, position = scrollTop
  try {
    const query = uni.createSelectorQuery().in(instance.proxy)
    query.select('.ar-scroll').boundingClientRect()
    query.select('.ar-body').boundingClientRect()
    // 单行预订须知可能只溢出正文下方的留白；阅读终点取文字自身的底边。
    if (props.text && !props.html) query.select('.ar-text').boundingClientRect()
    query.exec(rows => {
      if (!alive || version !== generation.value) return
      const [box, body] = rows || [], vh = (uni.getWindowInfo ? uni.getWindowInfo() : uni.getSystemInfoSync()).windowHeight
      if (!box?.height || !body?.height || !vh) { clock.pause(); unmeasured.value = true; return }
      unmeasured.value = false
      // 不把尚在屏幕外、或正文上方被遮住的区域算成已阅读。
      const hidden = Math.max(0, -box.top), visible = Math.min(box.bottom, vh) - Math.max(box.top, 0)
      if (visible <= 0 || !pageVisible) { clock.pause(); return }
      state = advanceRead(state, position + hidden, Math.min(box.height, visible), body.height)
      // 内层已滚到底而外层页面又滚动时，不一定会有第二次 scrolltolower。
      const text = rows[2]
      const end = text?.height > 0 ? text.bottom : body.bottom
      const lastLineVisible = end > Math.max(box.top, 0) && end <= Math.min(box.bottom, vh) + 2
      // 原生滚动容器的到底事件与 rich-text 的高度测量可能来自不同布局帧。
      // 容器底边确实可见时，用同一版本的原生到底回执补足最后一次 scroll 事件。
      reachedEnd ||= Boolean(state.done || (state.started && (lastLineVisible || (nativeEnd === true && box.bottom <= vh + 2))))
      if (state.started) clock.start()
      checkComplete()
    })
  } catch { clock.pause(); unmeasured.value = true }
}
watch(() => [props.contentKey, props.html, props.text], reset, { flush: 'sync' })
onMounted(observe)
onBeforeUnmount(() => { alive = false; clock.pause(); clearTimeout(timer); observer?.disconnect() })
</script>
<style scoped>
.ar{min-width:0;color:var(--k-ink2);font-size:14px;line-height:1.85}.ar-tip{display:inline-block;margin:2px 0 10px;padding:5px 12px;border-radius:16px;background:var(--k-red-soft);color:var(--k-red-deep);font-size:14px;font-weight:500;line-height:1.5}.ar-scroll{width:100%;border:1px solid var(--k-line2);border-radius:12px;box-sizing:border-box;background:var(--k-bg)}.ar-body{padding:16px;overflow-wrap:anywhere;box-sizing:border-box}.ar-text{display:block;white-space:pre-wrap}.ar-retry{font-size:14px;background:var(--k-paper2);color:var(--k-red-deep);margin-top:8px}
/* 11-18 微信核对：show-scrollbar 在微信里要开 enhanced 才生效，这里直接把滚动条藏掉（网页版本来就不显示） */
.ar-scroll ::-webkit-scrollbar{display:none;width:0;height:0;color:transparent}
</style>
