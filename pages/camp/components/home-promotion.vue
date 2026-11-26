<template>
  <view v-if="stay" class="destination-cover">
    <view class="destination-cover__picture" aria-role="button" :aria-label="'全屏查看' + stay.stayName + '的照片'" @click="emit('preview', stay)">
      <image :key="stay.image" class="destination-cover__image" :src="stay.image" :data-stay-id="stay.stayId" :data-cover="stay.image" mode="aspectFill" @error="imageFailed" />
    </view>
    <view class="destination-cover__copy">
      <view class="destination-cover__source"><text>{{ source }}</text><text v-if="stay.safe" class="destination-cover__safe">安心商家</text></view>
      <text class="destination-cover__city">{{ stay.city || stay.stayName }}</text>
      <text v-if="stay.intro" class="destination-cover__intro k-clamp2">{{ stay.intro }}</text>
    </view>
    <view class="destination-cover__link" aria-role="button" :aria-label="'查看' + stay.stayName + '详情'" hover-class="k-press-s" @click="emit('open', stay)">
      <view class="destination-cover__link-label"><text>{{ stay.city ? stay.stayName : '查看小院' }}</text><k-icon name="chevron-right" :size="14" color="red" /></view>
    </view>
  </view>
  <view v-else class="handbook-banner" :class="$userSurface" aria-role="button" aria-label="打开袋鼠使用手册" hover-class="k-press-s" @click="emit('open')">
    <view class="act-icon"><k-icon name="book-open" :size="22" color="red" /></view>
    <view class="k-flex1">
      <text v-if="!$userSurface" class="handbook-banner__eyebrow">出发前，先认识袋鼠</text>
      <text class="handbook-banner__title">袋鼠使用手册</text>
      <text class="handbook-banner__copy">报名 · 订房 · 安心出行</text>
    </view>
    <view class="handbook-banner__action"><text>翻开看看</text><k-icon name="chevron-right" :size="12" color="red" /></view>
  </view>
</template>

<script setup>
defineProps({ stay: Object, source: String })
const emit = defineEmits(['preview', 'open', 'failed'])
function imageFailed(event) {
  emit('failed', event.currentTarget.dataset)
}
</script>

<style scoped lang="scss">
.destination-cover { position: relative; display: flex; align-items: flex-end; justify-content: space-between; gap: 12px; min-height: 178px; min-height: clamp(160px, 48vw, 225px); margin: 12px -16px 0; padding: 46px 16px 12px; box-sizing: border-box; overflow: hidden; background: #796d60; }
.destination-cover__picture, .destination-cover__image, .destination-cover__picture::after { position: absolute; inset: 0; width: 100%; height: 100%; }
.destination-cover__image { display: block; }
.destination-cover__picture::after { content: ''; pointer-events: none; background: linear-gradient(0deg, rgba(27,24,20,.82), rgba(27,24,20,.57) 24%, rgba(27,24,20,0) 62%); }
.destination-cover__copy { position: relative; flex: 1; min-width: 0; pointer-events: none; color: #fff; }
.destination-cover__source { display: flex; align-items: center; flex-wrap: wrap; gap: 6px; font-size: 12px; line-height: 18px; }
.destination-cover__safe { border-left: 1px solid rgba(255,255,255,.65); padding-left: 6px; line-height: 13px; }
.destination-cover__city { display: block; margin-top: 2px; font-size: 27px; font-weight: 600; line-height: 1.24; overflow-wrap: anywhere; }
.destination-cover__intro { margin-top: 3px; font-size: 12px; line-height: 17px; }
.destination-cover__link { display: flex; align-items: center; justify-content: flex-end; position: relative; flex: 0 1 auto; max-width: 50%; min-width: 0; min-height: 44px; }
.destination-cover__link-label { display: flex; align-items: center; gap: 4px; padding: 5px 8px 5px 11px; border-radius: 5px; background: #fffdf9; color: var(--k-ink); font-size: 13px; line-height: 20px; }
.destination-cover__link-label text { min-width: 0; overflow-wrap: anywhere; }
.handbook-banner { position: relative; display: flex; align-items: center; gap: 12px; margin-top: 12px; padding: 12px 16px 12px 12px; border-radius: 12px; background: var(--k-paper); }
.act-icon { width: 40px; height: 40px; flex-shrink: 0; display: flex; align-items: center; justify-content: center; border-radius: 12px; background: var(--k-red-soft); }
.handbook-banner__eyebrow, .handbook-banner__title, .handbook-banner__copy { display: block; }
.handbook-banner__eyebrow { color: var(--k-red-deep); font-size: 11px; line-height: 16px; font-weight: 500; }
.handbook-banner__title { font-size: 15px; line-height: 24px; font-weight: 600; }
.handbook-banner__copy { font-size: 12px; line-height: 16px; color: var(--k-muted); }
.handbook-banner__action { display: flex; align-items: center; gap: 2px; flex-shrink: 0; height: 28px; color: var(--k-red-deep); font-size: 12px; font-weight: 500; }
.handbook-banner.user-surface { gap: 9px; margin-top: 0; padding: 5px 10px; border-radius: 6px;
  .act-icon { width: 28px; height: 34px; background: transparent; border-radius: 0; }
  .handbook-banner__title { font-size: 14px; line-height: 19px; }
  .handbook-banner__copy { font-size: 11px; }
  .handbook-banner__action { min-height: 44px; }
}
@media (max-width: 359px) {
  .destination-cover { margin-left: -12px; margin-right: -12px; padding-left: 12px; padding-right: 12px; }
  .destination-cover__city { font-size: 24px; }
  .handbook-banner__copy { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
}
</style>
