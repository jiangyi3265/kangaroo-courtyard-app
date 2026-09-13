<template>
  <view class="k-section">
    <view class="k-section__copy">
      <text class="k-section__title">{{ title }}</text>
      <text v-if="subtitle" class="k-section__subtitle">{{ subtitle }}</text>
    </view>
    <view v-if="action" class="k-section__action" @click="$emit('action')"><text>{{ action }}</text><k-icon name="chevron-right" :size="14" color="muted" /></view>
  </view>
</template>
<script setup>
defineOptions({ options: { virtualHost: true, styleIsolation: 'apply-shared' } })
defineProps({ title: String, subtitle: String, action: String })
defineEmits(['action'])
</script>
<style scoped lang="scss">
.k-section { margin: 18px 0 10px; display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.k-section__copy { display: flex; align-items: baseline; gap: 8px; }
.k-section__title { font-family: var(--k-serif); font-size: 16px; font-weight: 700; }
.k-section__subtitle { color: var(--k-muted); font-size: 12px; }
.k-section__action { display: flex; align-items: center; gap: 1px; color: var(--k-muted); font-size: 12px; }
</style>
