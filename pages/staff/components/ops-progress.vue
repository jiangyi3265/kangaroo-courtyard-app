<template>
  <view class="ops-progress">
    <view class="heading"><text>本月任务</text><text class="hint">按授权范围统计</text></view>
    <view v-if="!items.length" class="no-target">本月还没有设置任务，请联系平台管理员。</view>
    <view v-for="p in items" :key="p.targetId" class="task" :class="p.status">
      <view class="line"><text class="title">{{ p.label }}</text><text class="badge">{{ p.statusLabel }}</text></view>
      <text class="hint">{{ p.scopeLabel }}</text>
      <view class="numbers"><text class="done">{{ p.completed == null ? '—' : p.completed }}</text><text> / {{ p.target }} {{ p.unit }}</text><text class="percent">{{ p.completionRate == null ? '暂无数据' : p.completionRate + '%' }}</text></view>
      <view class="track"><view :style="{width: Math.min(100, Math.max(0, Number(p.completionRate) || 0)) + '%'}" /></view>
      <text class="hint">{{ p.missing == null ? '当前没有可计算数据' : Number(p.missing) < 0 ? '超额完成 ' + Math.abs(p.missing) + p.unit : '还差 ' + p.missing + p.unit }} · 剩余 {{ p.remainingDays }} 天</text>
      <text v-if="p.dailyRequired != null" class="hint">{{ p.unit === '%' ? '平均每天需提升' : '平均每天需完成' }} {{ p.dailyRequired }} {{ p.unit === '%' ? '个百分点' : p.unit }}</text>
      <text v-if="p.source" class="source">{{ p.source }}</text>
    </view>
  </view>
</template>
<script setup>
defineProps({ items: { type: Array, default: () => [] } })
</script>
<style scoped>
.heading,.line,.numbers{display:flex;align-items:center;justify-content:space-between;gap:10px}.heading{font-size:19px;font-weight:700;margin:24px 0 12px}.hint{display:block;font-size:12px;line-height:1.7;color:var(--k-muted,#77736b)}.heading .hint{font-weight:400}.task{border:1px solid var(--k-line2,#e6dfd1);border-radius:16px;padding:16px;margin-bottom:10px;background:var(--k-paper,#fff)}.title{font-size:16px;font-weight:650;flex:1}.badge{font-size:12px;padding:4px 9px;border-radius:20px;background:#edf4e9;color:#436538;flex-shrink:0}.slow .badge{background:#fff1d8;color:#805118}.severe .badge{background:#fcece6;color:#983d28}.unavailable .badge,.not_applicable .badge{background:#f0eeea;color:#6d6860}.numbers{justify-content:flex-start;margin:10px 0;font-size:13px;color:var(--k-muted)}.done{font-size:29px;font-weight:700;color:var(--k-ink,#302d25);font-variant-numeric:tabular-nums}.percent{margin-left:auto}.track{height:6px;border-radius:4px;background:#efede6;margin-bottom:10px;overflow:hidden}.track>view{height:100%;background:#628252}.slow .track>view{background:#bf9146}.severe .track>view{background:#b66b4f}.source{display:block;margin-top:8px;font-size:11px;line-height:1.6;color:var(--k-muted)}.no-target{padding:18px;border:1px dashed #d5ccbd;border-radius:12px;color:var(--k-muted);font-size:13px}
</style>
