<template>
  <view class="k-status">
    <image v-if="image" class="k-status__img" :src="image" mode="aspectFit" :style="{ width: imageSize + 'px', height: imageSize + 'px' }" />
    <view v-else-if="icon" class="k-status__icon" :class="`is-${tone}`"><k-icon :name="icon" :size="34" :color="tone === 'neutral' ? 'muted' : tone" :stroke="1.5" /></view>
    <text class="k-status__title">{{ title }}</text>
    <text v-if="desc" class="k-status__desc">{{ desc }}</text>
    <view class="k-status__actions"><slot /></view>
  </view>
</template>

<script setup>
defineOptions({ options: { virtualHost: true, styleIsolation: 'apply-shared' } })
defineProps({
  title: { type: String, default: '' },
  desc: { type: String, default: '' },
  image: { type: String, default: '' },       // 插画路径（/static/media/xxx.jpg）
  imageSize: { type: Number, default: 120 },
  icon: { type: String, default: '' },        // 无插画时使用线性图标
  tone: { type: String, default: 'neutral' }  // neutral | red | green | ochre | indigo
})
</script>

<style scoped lang="scss">
.k-status { padding: 40px 24px 32px; display: flex; flex-direction: column; align-items: center; text-align: center; }
.k-status__img { margin-bottom: 8px; }
.k-status__icon { width: 72px; height: 72px; border-radius: 50%; display: flex; align-items: center; justify-content: center; background: var(--k-paper2); margin-bottom: 8px; }
.k-status__icon.is-red { background: var(--k-red-soft); }
.k-status__icon.is-green { background: var(--k-green-soft); }
.k-status__icon.is-ochre { background: var(--k-ochre-soft); }
.k-status__icon.is-indigo { background: var(--k-indigo-soft); }
.k-status__title { margin-top: 8px; font-family: var(--k-serif); font-weight: 700; font-size: 16px; }
.k-status__desc { max-width: 280px; margin-top: 6px; color: var(--k-muted); font-size: 13px; line-height: 1.6; white-space: pre-line; }
.k-status__actions { margin-top: 16px; display: flex; gap: 10px; }
</style>
