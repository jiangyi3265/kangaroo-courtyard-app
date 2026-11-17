<template>
  <view class="ar">
    <text class="ar-tip" aria-live="polite">{{ complete ? '已阅读至末尾，请确认后再继续' : '请从顶部向下阅读完整内容，读到末尾后才能继续' }}</text>
    <scroll-view :key="generation" scroll-y class="ar-scroll" :style="{ height }" @scroll="scroll" @touchstart="measure" @touchend="schedule" @click="schedule">
      <view class="ar-body"><rich-text v-if="html" :nodes="html" /><text v-else-if="text" class="ar-text" selectable>{{ text }}</text><slot v-else /></view>
    </scroll-view>
    <button v-if="unmeasured" class="ar-retry" @click="schedule">重新检查阅读进度</button>
  </view>
</template>
<script setup>
import { ref, watch, nextTick, getCurrentInstance, onMounted, onBeforeUnmount } from 'vue'
import { advanceRead } from '@/common/agreement-progress.js'
const props = defineProps({ contentKey: [String, Number], html: String, text: String, height: { type: String, default: '48vh' } })
const emit = defineEmits(['read'])
const instance = getCurrentInstance(), complete = ref(false), unmeasured = ref(false), generation = ref(0)
let state = { started: false }, scrollTop = 0, timer = null, alive = true, observer = null
function reset() {
  ++generation.value
  state = { started: false }; scrollTop = 0; complete.value = false; emit('read', false)
  observer?.disconnect()
  observe()
}
function observe() {
  const version = generation.value
  nextTick(() => {
    if (!alive || version !== generation.value) return
    schedule()
    try {
      observer = uni.createIntersectionObserver(instance.proxy, { thresholds: [0, 1] }).relativeToViewport()
      observer.observe('.ar-scroll', schedule)
    } catch { /* 点击或滑动正文后重测 */ }
  })
}
function scroll(e) { scrollTop = Math.max(0, Number(e.detail.scrollTop) || 0); schedule() }
function schedule() { if (timer || !alive) return; timer = setTimeout(() => { timer = null; measure() }, 80) }
function measure() {
  const version = generation.value
  try {
    uni.createSelectorQuery().in(instance.proxy).select('.ar-scroll').boundingClientRect().select('.ar-body').boundingClientRect().exec(rows => {
      if (!alive || version !== generation.value) return
      const [box, body] = rows || [], vh = (uni.getWindowInfo ? uni.getWindowInfo() : uni.getSystemInfoSync()).windowHeight
      if (!box?.height || !body?.height || !vh) { unmeasured.value = true; return }
      unmeasured.value = false
      // 不把尚在屏幕外、或正文上方被遮住的区域算成已阅读。
      const hidden = Math.max(0, -box.top), visible = Math.min(box.bottom, vh) - Math.max(box.top, 0)
      if (visible <= 0) return
      state = advanceRead(state, scrollTop + hidden, Math.min(box.height, visible), body.height)
      if (state.done && !complete.value) { complete.value = true; emit('read', true) }
    })
  } catch { unmeasured.value = true }
}
watch(() => [props.contentKey, props.html, props.text], reset, { flush: 'sync' })
onMounted(observe)
onBeforeUnmount(() => { alive = false; clearTimeout(timer); observer?.disconnect() })
</script>
<style scoped>
.ar{min-width:0;color:var(--k-ink2);font-size:14px;line-height:1.85}.ar-tip{display:block;padding:10px 0;color:var(--k-red-deep);font-size:14px;line-height:1.6}.ar-scroll{width:100%;border:1px solid var(--k-line2);border-radius:12px;box-sizing:border-box;background:var(--k-bg)}.ar-body{padding:16px;overflow-wrap:anywhere;box-sizing:border-box}.ar-text{display:block;white-space:pre-wrap}.ar-retry{font-size:14px;background:var(--k-paper2);color:var(--k-red-deep);margin-top:8px}
</style>
