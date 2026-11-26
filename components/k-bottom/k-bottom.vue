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
/* 11-19 第四轮：精修词典「底部操作条白底」，各页原来都在自己盖成白色；组件默认就是白底（上边线照旧，页面自己去掉的不受影响） */
.k-bottom { position: fixed; left: 0; right: 0; bottom: 0; z-index: 50; background: var(--k-paper); border-top: 1px solid var(--k-line); }
.k-bottom.is-flat { border-top-color: transparent; }
.k-bottom.is-dark { background: #1C1917; border-top-color: #2A2624; }
.k-bottom__inner { display: flex; align-items: center; gap: 10px; }
.k-bottom__safe { height: var(--k-safe-bottom); }
</style>
