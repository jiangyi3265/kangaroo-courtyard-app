<template>
  <view class="wf" :class="{ 'wf-free': free }">
    <view class="wf-head"><text>{{ free ? '让善意，去更远的地方' : '每一笔费用，都清清楚楚' }}</text><k-icon :name="free ? 'heart' : 'receipt-text'" :size="16" color="red" /></view>
    <template v-if="!free">
      <view class="wf-line"><text>成本价</text><text>¥{{ money(value.costFen) }}</text></view>
      <view class="wf-line"><text>发布加价 1%</text><text>+ ¥{{ money(value.markupFen) }}</text></view>
      <view class="wf-total"><text>展示价 / 发布者支付</text><text>¥{{ money(value.amountFen) }}</text></view>
      <view class="wf-line"><text>完成后手续费 5%</text><text>− ¥{{ money(value.feeFen) }}</text></view>
      <view class="wf-line wf-net"><text>{{ settled ? '服务者结算金额' : '服务者预计结算' }}</text><text>¥{{ money(value.netFen) }}</text></view>
      <text class="wf-foot">手续费按展示价计算，金额四舍五入到分。</text>
    </template>
    <template v-else><view class="wf-total"><text>免费互助</text><text>¥0.00</text></view><text class="wf-foot">不加价 · 不收手续费 · 不产生支付订单</text></template>
  </view>
</template>
<script setup>
import { money } from '../wish.js'
defineProps({ value: { type: Object, default: () => ({}) }, free: Boolean, settled: Boolean })
</script>
<style scoped>
/* 2026-11-17 改版「小而精」：费用明细块换成暖色浅底、12 圆角，字收小一档；每一行费用和金额原样保留。 */
.wf{border-radius:12px;background:#F8F0E4;padding:12px;color:var(--k-ink)}.wf-head{display:flex;justify-content:space-between;align-items:center;font-size:13px;font-weight:600;margin-bottom:8px}.wf-line{display:flex;justify-content:space-between;gap:12px;font-size:12px;margin:8px 0;color:var(--k-ink2);font-variant-numeric:tabular-nums}.wf-total{display:flex;justify-content:space-between;align-items:center;gap:8px;font-size:13px;font-weight:600;padding:9px 0;border-top:1px solid rgba(154,107,63,.16);border-bottom:1px solid rgba(154,107,63,.16)}.wf-total text:last-child{font-size:18px;color:var(--k-red);font-weight:700;font-variant-numeric:tabular-nums}.wf-net{font-weight:600;color:var(--k-ink)}.wf-foot{font-size:11px;color:var(--k-muted);display:block;margin-top:8px}.wf-free{background:#EEF3E7}.wf-free .wf-total{border-color:rgba(74,110,58,.16)}.wf-free .wf-total text:last-child{color:var(--k-green)}
</style>
