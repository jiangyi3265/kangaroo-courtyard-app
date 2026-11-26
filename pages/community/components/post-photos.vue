<template>
  <view class="photos">
    <swiper v-if="photos.length > 1" class="photos__slides" :circular="true" @change="active = $event.detail.current">
      <swiper-item v-for="(src, index) in photos" :key="index">
        <image class="photos__image" :src="src" :mode="mode" @click="$emit('photo', index)" />
      </swiper-item>
    </swiper>
    <image v-else class="photos__image" :src="photos[0]" :mode="mode" @click="$emit('photo', 0)" />
    <text v-if="photos.length > 1" class="photos__count">{{ active + 1 }}/{{ photos.length }}</text>
  </view>
</template>

<script setup>
import { ref } from 'vue'
defineProps({
  photos: { type: Array, required: true },
  mode: { type: String, default: 'aspectFill' }
})
defineEmits(['photo'])
const active = ref(0)
</script>

<style scoped>
.photos { position: absolute; inset: 0; overflow: hidden; border-radius: inherit; }
.photos__slides, .photos__image { display: block; width: 100%; height: 100%; }
.photos__count { position: absolute; right: 7px; bottom: 7px; padding: 2px 7px; border-radius: 12px; color: #fff; background: rgba(45, 35, 27, .66); font-size: 11px; line-height: 16px; pointer-events: none; }
</style>
