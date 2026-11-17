<template>
  <view class="wf" :class="{ 'wf-free': free }">
    <view class="wf-head"><text>{{ free ? '让善意，去更远的地方' : '每一笔费用，都清清楚楚' }}</text><k-icon :name="free ? 'heart' : 'receipt-text'" :size="19" color="#3166f5" /></view>
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
.wf{border-radius:18px;background:#eaf0ff;padding:18px;color:#102c46}.wf-head{display:flex;justify-content:space-between;align-items:center;font-size:13px;font-weight:700;margin-bottom:16px}.wf-line{display:flex;justify-content:space-between;gap:12px;font-size:12px;margin:11px 0;color:#55667b}.wf-total{display:flex;justify-content:space-between;align-items:center;gap:8px;font-size:13px;font-weight:700;padding:12px 0;border-top:1px solid #d4def2;border-bottom:1px solid #d4def2}.wf-total text:last-child{font-size:22px;color:#3166f5;font-weight:800}.wf-net{font-weight:750;color:#102c46}.wf-foot{font-size:10px;color:#6f8096;display:block;margin-top:10px}.wf-free{background:#f0f5da}.wf-free .wf-total text:last-child{color:#405721}
</style>
