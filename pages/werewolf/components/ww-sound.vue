<template>
  <view class="ww-sound" :class="{ 'ww-sound--dark': dark }">
    <button class="ww-sound__button" @click="toggle">
      <k-icon :name="enabled && !error ? 'volume-2' : 'volume-x'" :size="14" :color="dark ? 'white' : 'green'" />
      <text>{{ error ? '播放背景音乐' : enabled ? '背景音乐 · 开' : '背景音乐 · 关' }}</text>
    </button>
    <text v-if="enabled && voiceBusy" class="ww-sound__hint">语音时暂停音乐</text>
  </view>
</template>
<script setup>
import { ref, watch, onBeforeUnmount } from 'vue'

import { createVoicePlayer } from '../voice.js'
import { voiceBusy } from '../audio-focus.js'
import music from '../static/moon-courtyard.mp3'
const props = defineProps({ dark: Boolean, active: Boolean, track: { type: String, default: '' }, preferenceKey: { type: String, default: 'kangaroo:werewolf:music' } })
const enabled = ref(uni.getStorageSync(props.preferenceKey) !== false)
const error = ref(false)
let player, running = false
function stop() { const old = player; player = null; running = false; old?.stop(); old?.destroy() }
function sync() {
  if (!enabled.value || !props.active) { stop(); return }
  if (voiceBusy.value) { player?.pause(); running = false; return }
  if (running) return
  if (player) { running = true; player.play(); return }
  const current = createVoicePlayer(); player = current; running = true
  current.src = props.track || music; current.loop = true; current.volume = 0.12
  current.onPlay(() => { if (player === current) error.value = false })
  current.onError(() => { if (player === current) { stop(); error.value = true } })
  current.play()
}
function toggle() {
  if (error.value) { error.value = false; enabled.value = true; sync(); return }
  enabled.value = !enabled.value; uni.setStorageSync(props.preferenceKey, enabled.value)
}
watch([enabled, voiceBusy, () => props.active], sync, { flush: 'sync' })
onBeforeUnmount(stop)
// A component mounted by an asynchronous room response also starts its own player.
sync()
</script>
<style scoped>
/* 11-18 第三轮：28 高小胶囊（和「提示音」开关成对）；外边距交给页面 */
.ww-sound{display:flex;align-items:center;justify-content:flex-end;gap:8px;margin:0;color:inherit;flex-wrap:wrap}
.ww-sound__button{display:flex;align-items:center;gap:4px;height:28px;box-sizing:border-box;background:var(--k-paper);color:var(--k-ink2);border:0;border-radius:14px;font-size:12px;line-height:28px;padding:0 10px;margin:0}
.ww-sound--dark .ww-sound__button{background:rgba(224,231,219,.12);color:var(--ww-cream)}
.ww-sound__button::after{border:0}.ww-sound__hint{font-size:11px;opacity:.7}
</style>
