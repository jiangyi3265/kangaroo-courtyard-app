<template>
  <view class="req-row" hover-class="k-press-s" @click="emit('open')">
    <view class="req-row__top"><text class="req-row__title">{{ item.title || item.typeLabel }}</text><k-chip :tone="statusTone(item.status, item.jobStatus)"><text>{{ shortStatus(item) }}</text></k-chip></view>
    <view class="req-row__foot"><text class="req-row__meta">{{ requestMeta(item) }}</text><text class="req-row__time">{{ mdhm(item.createTime) }}</text><k-icon name="chevron-right" :size="12" color="muted" /></view>
    <!-- 主人 2026-11-03：商家服务人的「线上任务管理」在卡片底下放「管理任务」「审核报名」，别的页面不传就没有 -->
    <slot />
  </view>
</template>

<script setup>
// 商家需求的一行：线上任务审核、商家服务人、城市负责人共用。放在 staff 分包里，页面显式引入，不走全局 easycom
import { statusTone, shortStatus, requestMeta } from '../request-view.js'
import { mdhm } from '@/common/ui.js'

defineOptions({ options: { virtualHost: true, styleIsolation: 'apply-shared' } })
defineProps({ item: { type: Object, required: true } })
const emit = defineEmits(['open'])
</script>

<style scoped>
/* 2026-11-17 改版「小而精」：白卡 12 圆角、不加阴影，卡片之间 8；标题 14 / 600，辅助信息 11 */
.req-row{margin-bottom:8px;padding:12px;border-radius:12px;background:var(--k-paper);display:flex;flex-direction:column;gap:8px}
.req-row__top{display:flex;align-items:flex-start;justify-content:space-between;gap:10px}
.req-row__title{min-width:0;flex:1;font-size:14px;font-weight:600;line-height:20px;color:var(--k-ink);overflow-wrap:anywhere}
.req-row__foot{display:flex;align-items:center;gap:6px;font-size:11px;line-height:16px;color:var(--k-muted)}
.req-row__meta{min-width:0;flex:1;overflow:hidden;white-space:nowrap;text-overflow:ellipsis}
.req-row__time{flex-shrink:0}
</style>
