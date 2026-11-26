<template>
  <view class="handbook-hero">
    <swiper class="handbook-carousel" :current="current" :duration="motionLimited ? 0 : 430"
      @change="changed" @touchstart="touching = true" @touchend="touching = false" @touchcancel="touching = false">
      <swiper-item v-for="(slide, index) in slides" :key="slide.chapter">
        <button class="handbook-slide" hover-class="none" :aria-hidden="index !== current" :tabindex="index === current ? 0 : -1"
          :aria-label="'打开袋鼠使用手册，' + slide.title" @click="emit('open', slide.chapter)">
          <image class="handbook-photo" :src="slide.image" mode="aspectFill" aria-hidden="true" />
          <view class="handbook-light" aria-hidden="true" />
          <view class="handbook-copy">
            <text class="handbook-name">袋鼠使用手册</text>
            <text class="handbook-title">{{ slide.title }}</text>
            <view class="handbook-action"><text>{{ slide.action }}</text><view class="handbook-arrow" /></view>
          </view>
        </button>
      </swiper-item>
    </swiper>
    <view class="handbook-indicators" aria-hidden="true"><view v-for="(slide, index) in slides" :key="slide.chapter" class="handbook-dot" :class="{ 'is-active': index === current }" /></view>
  </view>
</template>

<script setup>
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'

const props = defineProps({ active: Boolean, reduceMotion: Boolean })
const emit = defineEmits(['open', 'ready'])
const slides = [
  { chapter: 'apply', title: '第一次报名', action: '看报名步骤', image: '/pages/camp/static/handbook-covers/seaside-friends.jpg' },
  { chapter: 'stay', title: '住进小院', action: '看订房指南', image: '/pages/camp/static/handbook-covers/guesthouse-arrival.jpg' },
  { chapter: 'groups', title: '结伴出发', action: '去找同行伙伴', image: '/pages/camp/static/handbook-covers/mountain-companions.jpg' }
]
const current = ref(0)
const touching = ref(false)
const background = ref(false)
const systemReduceMotion = ref(false)
const motionLimited = computed(() => props.reduceMotion || systemReduceMotion.value)
let direction = 1
let timer

function schedule() {
  clearTimeout(timer)
  if (!props.active || motionLimited.value || touching.value || background.value) return
  timer = setTimeout(() => {
    if (current.value === 0) direction = 1
    if (current.value === slides.length - 1) direction = -1
    current.value += direction
  }, 4500)
}
function changed(event) {
  const next = Number(event.detail.current)
  if (next !== current.value) {
    direction = next > current.value ? 1 : -1
    current.value = next
  }
  schedule()
}
watch([() => props.active, motionLimited, touching, background, current], schedule)
// #ifdef H5
let media
const syncPreferences = () => {
  background.value = document.hidden
  systemReduceMotion.value = !!media?.matches
}
// #endif
onMounted(() => {
  emit('ready')
  // #ifdef H5
  media = window.matchMedia?.('(prefers-reduced-motion: reduce)')
  syncPreferences()
  media?.addEventListener?.('change', syncPreferences)
  document.addEventListener('visibilitychange', syncPreferences)
  // #endif
  schedule()
})
onUnmounted(() => {
  clearTimeout(timer)
  // #ifdef H5
  media?.removeEventListener?.('change', syncPreferences)
  document.removeEventListener('visibilitychange', syncPreferences)
  // #endif
})
</script>

<style scoped>
.handbook-hero, .handbook-photo, .handbook-light, .handbook-carousel { position: absolute; inset: 0; width: 100%; height: 100%; }
.handbook-hero { overflow: hidden; background: #e9d8bd; }
.handbook-light { pointer-events: none; background: radial-gradient(ellipse at top right, rgba(255,244,219,.65) 0%, rgba(255,243,216,.42) 23%, transparent 54%); }
.handbook-slide { display: block; position: relative; width: 100%; height: 100%; margin: 0; padding: 0; border: 0; border-radius: 0; text-align: left; line-height: 1.2; color: #392b20; background: transparent; }
.handbook-slide::after { border: 0; }
.handbook-copy { position: absolute; top: 6%; right: 4.5%; width: 39%; text-align: right; }
.handbook-name { display: flex; align-items: center; justify-content: flex-end; color: #584127; font-size: 12px; font-weight: 600; letter-spacing: 1px; }
.handbook-name::before { content: ''; width: 16px; height: 1px; margin-right: 7px; background: #855e38; }
.handbook-title { display: block; margin: 4px 0 5px; font-family: var(--k-serif); font-size: clamp(24px, 7vw, 34px); font-weight: 700; line-height: 1.18; letter-spacing: .02em; }
.handbook-action { display: flex; align-items: center; justify-content: flex-end; gap: 5px; color: #483729; font-size: 12px; font-weight: 500; }
.handbook-arrow { width: 5px; height: 5px; border-top: 1px solid currentColor; border-right: 1px solid currentColor; transform: rotate(45deg); }
.handbook-indicators { position: absolute; right: 5%; bottom: 12px; display: flex; gap: 4px; pointer-events: none; }
.handbook-dot { width: 5px; height: 3px; border-radius: 3px; background: rgba(255,255,255,.55); }
.handbook-dot.is-active { width: 17px; background: #fff8eb; }
</style>
