<template>
  <view class="k-bottom" :class="{ 'is-flat': flat, 'is-dark': dark }">
    <view class="k-bottom__inner" :style="{ padding: pad }"><slot /></view>
    <view class="k-bottom__safe" />
    <view class="k-home-indicator" />
  </view>
</template>

<script setup>
defineOptions({ options: { virtualHost: true, styleIsolation: 'apply-shared' } })
defineProps({
  flat: { type: Boolean, default: false },   // 无上边线
  dark: { type: Boolean, default: false },
  pad: { type: String, default: '12px 16px' }
})
</script>

<style scoped lang="scss">
.k-bottom { position: fixed; left: 0; right: 0; bottom: 0; z-index: 50; background: var(--k-bg); border-top: 1px solid var(--k-line); }
.k-bottom.is-flat { border-top-color: transparent; }
.k-bottom.is-dark { background: #1C1917; border-top-color: #2A2624; }
.k-bottom__inner { display: flex; align-items: center; gap: 10px; }
.k-bottom__safe { height: var(--k-safe-bottom); }
</style>
