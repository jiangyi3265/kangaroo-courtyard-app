<template>
  <view class="req-detail">
    <view class="req-card">
      <view class="req-card__chips"><k-chip tone="ink"><text>{{ detail.typeLabel }}</text></k-chip><k-chip :tone="statusTone(detail.status, detail.jobStatus)"><text>{{ detail.statusLabel }}</text></k-chip></view>
      <text class="req-card__title">{{ detail.title }}</text>
      <text class="req-card__meta">{{ [detail.storeName, detail.city].filter(Boolean).join(' · ') }}</text>
      <text class="req-card__meta">{{ sourceText(detail) }}{{ detail.createTime ? ' · ' + mdhm(detail.createTime) : '' }}</text>
    </view>
    <view v-if="detail.returnReason" class="req-card req-card--alert"><text class="req-card__label">退回 / 不通过原因</text><text class="req-card__body">{{ detail.returnReason }}</text></view>
    <view v-if="detail.content" class="req-card"><text class="req-card__label">需求说明</text><text class="req-card__body">{{ detail.content }}</text></view>
    <view v-if="facts.length" class="req-card"><text class="req-card__label">{{ detail.requestType === 'online_task' ? '任务详情' : '岗位详情' }}</text><view v-for="row in facts" :key="row.label" class="req-fact"><text class="req-fact__label">{{ row.label }}</text><text class="req-fact__value">{{ row.value }}</text></view></view>
    <view v-if="images.length" class="req-card"><text class="req-card__label">商家附图</text><view class="req-images"><image v-for="(url, i) in images" :key="url" class="req-images__item" :src="url" mode="aspectFill" @click="preview(i)" /></view></view>
    <view v-if="detail.contactName || detail.contactPhone" class="req-card">
      <text class="req-card__label">商家联系方式</text>
      <view class="req-contact"><view class="req-contact__copy"><text class="req-contact__name">{{ detail.contactName || '联系人' }}</text><text class="req-contact__phone">{{ detail.contactPhone }}</text></view><template v-if="callable && detail.contactPhone"><view class="req-contact__btn" hover-class="k-press-s" @click="copy(detail.contactPhone, '手机号已复制')"><text>复制</text></view><view class="req-contact__btn req-contact__btn--main" hover-class="k-press-s" @click="call"><k-icon name="phone" :size="14" color="#8A5E36" /><text>打电话</text></view></template></view>
    </view>
    <view v-if="showNote && detail.verifyNote" class="req-card"><text class="req-card__label">换工主理人核实备注</text><text class="req-card__body">{{ detail.verifyNote }}</text></view>
  </view>
</template>

<script setup>
// 商家需求详情（线上任务审核、商家服务人、城市负责人共用；城市负责人拿到的手机号是脱敏的，不给拨打）。staff 分包内组件，页面显式引入
import { computed } from 'vue'
import { statusTone, sourceText, jobFacts } from '../request-view.js'
import { mdhm, copy } from '@/common/ui.js'
import { absUrl } from '@/common/upload.js'

defineOptions({ options: { virtualHost: true, styleIsolation: 'apply-shared' } })
const props = defineProps({
  detail: { type: Object, required: true },
  callable: { type: Boolean, default: false },
  showNote: { type: Boolean, default: true }
})
const facts = computed(() => jobFacts(props.detail.job, props.detail.content))
const images = computed(() => (props.detail.images || []).map(u => absUrl(u)))
const preview = (i) => uni.previewImage({ urls: images.value, current: images.value[i] })
const call = () => uni.makePhoneCall({ phoneNumber: String(props.detail.contactPhone), fail: () => {} })
</script>

<style scoped>
/* 2026-11-17 改版「小而精」：白卡 12 圆角、不加阴影，卡片之间 8；标题 16 / 700，小节名 14 / 600，正文 13；电话按钮收成 28 高的胶囊 */
.req-card{margin-bottom:8px;padding:12px;border-radius:12px;background:var(--k-paper);display:flex;flex-direction:column;gap:8px}
.req-card--alert{background:var(--k-alert-soft)}
.req-card__chips{display:flex;flex-wrap:wrap;gap:6px}
.req-card__title{font-size:16px;font-weight:700;line-height:1.4;color:var(--k-ink);overflow-wrap:anywhere}
.req-card__meta{font-size:12px;line-height:1.5;color:var(--k-muted)}
.req-card__label{font-size:14px;font-weight:600;color:var(--k-ink)}
.req-card__body{font-size:13px;line-height:1.7;color:var(--k-ink2);white-space:pre-wrap;overflow-wrap:anywhere}
.req-fact{position:relative;display:flex;gap:12px;padding:8px 0;font-size:13px;line-height:1.6}
/* 11-18 第二轮精修：分隔换成发丝线 */
.req-fact::before{content:"";position:absolute;left:0;right:0;top:0;height:1px;background:var(--k-line);transform:scaleY(.5);transform-origin:0 0}
.req-fact__label{flex-shrink:0;width:64px;color:var(--k-muted)}
.req-fact__value{min-width:0;flex:1;color:var(--k-ink);white-space:pre-wrap;overflow-wrap:anywhere}
.req-images{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}
/* 三列附图接近 4:3（390 宽约 108×81） */
.req-images__item{width:100%;height:81px;border-radius:8px;background:var(--k-paper2)}
.req-contact{display:flex;align-items:center;gap:8px}
.req-contact__copy{min-width:0;flex:1;display:flex;flex-direction:column;gap:3px}
.req-contact__name{font-size:14px;font-weight:600;color:var(--k-ink);overflow:hidden;white-space:nowrap;text-overflow:ellipsis}
.req-contact__phone{font-size:12px;color:var(--k-muted)}
.req-contact__btn{flex-shrink:0;height:28px;padding:0 12px;border:1px solid var(--k-red-line);border-radius:999px;background:var(--k-paper);display:flex;align-items:center;gap:4px;font-size:12px;font-weight:500;color:var(--k-red-deep)}
/* 「打电话」和底部操作条的主按钮同屏：不用实心渐变，浅底暖棕字（图标颜色在模板里一起换成暖棕） */
.req-contact__btn--main{border-color:transparent;background:var(--k-red-soft);color:var(--k-red-deep)}
</style>
