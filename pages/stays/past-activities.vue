<template>
  <k-feature-gate feature="stay-booking">
  <view class="k-page past-activities" :class="$userSurface">
    <k-topbar title="往期活动" back />
    <view class="past-body">
      <view v-if="stayName" class="past-context"><k-icon name="house" :size="14" color="muted" /><text>{{ stayName }}</text></view>
      <view v-if="loading" class="past-state" role="status"><text>正在加载往期活动…</text></view>
      <view v-else-if="loadError" class="past-state" role="status">
        <view class="past-state__ic"><k-icon name="circle-alert" :size="28" color="red" /></view>
        <text class="past-state__title">{{ loadError }}</text>
        <k-button v-if="storeId" type="secondary" size="sm" label="重新加载" @click="load" />
      </view>
      <view v-else-if="!rows.length" class="past-state">
        <view class="past-state__ic"><k-icon name="calendar" :size="28" color="red" /></view>
        <text class="past-state__title">暂无往期活动</text>
        <text>活动结束后，可在这里回顾</text>
      </view>
      <template v-else>
        <text class="past-note">{{ rows.length >= 20 ? '最近 20 场已结束的活动' : '已结束的活动' }}，点击查看详情</text>
        <view class="past-list">
          <view v-for="a in rows" :key="a.activityId" class="past-item" role="button" :aria-label="'查看往期活动：' + a.title" hover-class="k-press-s" @click="openActivity(a)">
            <image v-if="a.cover" class="past-item__cover" :src="absUrl(a.cover)" mode="aspectFill" lazy-load />
            <view v-else class="past-item__cover past-item__cover--empty"><k-icon name="calendar" :size="22" color="muted" /></view>
            <view class="past-item__body">
              <text class="past-item__title">{{ a.title }}</text>
              <text v-if="a.when" class="past-item__when">{{ a.when }}</text>
              <view class="past-item__foot"><text class="past-item__price" :class="{ 'past-item__price--free': a.free }">{{ a.price }}</text><text class="past-item__status">已结束</text></view>
            </view>
            <k-icon name="chevron-right" :size="12" color="muted" />
          </view>
        </view>
      </template>
    </view>
  </view>
</k-feature-gate>
</template>

<script setup>
import { stayBookingEnabled, refreshFeatures } from '@/common/features.js'
import { watch as watchStayGate } from 'vue'
import { ref } from 'vue'
import { onShow, onUnload, onPullDownRefresh } from '@dcloudio/uni-app'
import { useScreen, go } from '@/common/screen.js'
import { apiStoreActivities } from '@/common/api.js'
import { absUrl } from '@/common/upload.js'
import { errText } from '@/common/ui.js'
import R from '@/common/routes.js'
import { storeActivities } from './stays-activities.js'

const storeId = ref(0)
const stayName = ref('')
const rows = ref([])
const loading = ref(false)
const loadError = ref('')
let sequence = 0
useScreen(1, { onLoad: q => {
  const id = Number(q.storeId)
  storeId.value = Number.isSafeInteger(id) && id > 0 ? id : 0
  stayName.value = typeof q.stayName === 'string' ? q.stayName : ''
} })
async function load() {
  if(!(await refreshFeatures()).stayBookingEnabled) return
  if (loading.value) return
  if (!storeId.value) {
    loadError.value = '没有找到这家小院'
    return
  }
  const request = ++sequence
  loading.value = true
  loadError.value = ''
  try {
    const res = await apiStoreActivities(storeId.value)
    if (request !== sequence) return
    rows.value = storeActivities(res.data, Date.now()).past
  } catch (e) {
    if (request === sequence) loadError.value = errText(e, '往期活动加载失败，请重试')
  } finally {
    if (request === sequence) loading.value = false
  }
}
const openActivity = a => go(R.activity + '?id=' + a.activityId + '&channel=home')
onShow(load)
onPullDownRefresh(async () => {
  try { await load() } finally { uni.stopPullDownRefresh() }
})
onUnload(() => { sequence++ })
watchStayGate(stayBookingEnabled, enabled => { if(enabled) load() })
</script>

<style scoped lang="scss">
.past-activities { font-family: var(--k-sans); }
.past-body { padding: 8px 16px calc(24px + env(safe-area-inset-bottom)); }
.past-context { display: flex; align-items: center; gap: 8px; margin-bottom: 20px; padding: 12px 14px; border-radius: 12px; background: var(--k-paper2); color: var(--k-ink2); font-size: 14px; line-height: 1.5; }
.past-context > text { flex: 1; min-width: 0; overflow-wrap: anywhere; }
.past-note { display: block; margin-bottom: 6px; color: var(--k-muted); font-size: 14px; line-height: 1.6; }
.past-list { display: flex; flex-direction: column; }
.past-item { display: flex; align-items: center; gap: 12px; padding: 18px 0; border-bottom: 1px solid var(--k-line2); }
.past-item__cover { display: block; flex: 0 0 88px; width: 88px; height: 96px; border-radius: 10px; background: var(--k-paper2); }
.past-item__cover--empty { display: flex; align-items: center; justify-content: center; }
.past-item__body { flex: 1; min-width: 0; }
.past-item__title { display: block; font-size: 17px; font-weight: 700; line-height: 1.45; color: var(--k-ink); overflow-wrap: anywhere; }
.past-item__when { display: block; margin-top: 6px; font-size: 14px; color: var(--k-muted); line-height: 1.5; }
.past-item__foot { display: flex; flex-wrap: wrap; align-items: center; gap: 6px 12px; margin-top: 8px; font-size: 14px; line-height: 1.5; }
.past-item__price { color: var(--k-red-deep); font-weight: 700; }
.past-item__price--free { color: var(--k-green); }
.past-item__status { color: var(--k-muted); }
.past-state { min-height: 220px; display: flex; flex-direction: column; justify-content: center; align-items: center; gap: 16px; text-align: center; font-size: 14px; color: var(--k-muted); line-height: 1.6; }
.past-state__title { font-size: 18px; font-weight: 700; color: var(--k-ink); }
@media (max-width: 359px) {
  .past-body { padding-left: 12px; padding-right: 12px; }
  .past-item { gap: 10px; }
  .past-item__cover { flex-basis: 72px; width: 72px; height: 88px; }
}

/* 2026-11-17 改版「小而精」（主人按样张第三版拍板）：浅灰底，每场活动一张纯白小卡（不描边、不加阴影、不画分隔线），封面 72 的方图，字收小一档。
   功能和文字一样不少；上面的规则保留不动，这里统一用 .past-activities 开头的规则盖过去。 */
.past-activities { --k-bg: var(--k-page); --k-paper2: var(--k-fill); background: var(--k-page); }
.past-activities .past-body { padding: 8px 12px calc(24px + env(safe-area-inset-bottom)); }
.past-activities .past-context { gap: 6px; margin-bottom: 8px; padding: 10px 12px; border-radius: 12px; background: var(--k-paper); font-size: 13px; line-height: 19px; }

.past-activities .past-note { margin: 4px 0 8px; font-size: 11px; line-height: 16px; }
.past-activities .past-list { gap: 8px; }
.past-activities .past-item { gap: 10px; padding: 10px; border-bottom: 0; border-radius: 12px; background: var(--k-paper); }
.past-activities .past-item__cover { flex: 0 0 72px; width: 72px; height: 72px; border-radius: 8px; }

.past-activities .past-item__title { font-size: 14px; font-weight: 600; line-height: 20px; }
.past-activities .past-item__when { margin-top: 2px; font-size: 11px; line-height: 16px; }
.past-activities .past-item__foot { gap: 4px 8px; margin-top: 6px; font-size: 12px; line-height: 17px; }
.past-activities .past-item__price { font-size: 13px; }
.past-activities .past-item__status { height: 17px; padding: 0 5px; border-radius: 4px; background: var(--k-fill); color: var(--k-ink2); font-size: 10px; font-weight: 500; line-height: 17px; }
.past-activities .past-state { min-height: 200px; gap: 10px; font-size: 12px; }
.past-activities .past-state__title { font-size: 15px; font-weight: 600; }
/* 2026-11-18 第二轮精修：加载中 / 出错 / 暂无往期活动放进白卡（上下 28），标题 14 / 500 / 二级墨、说明 12 / 暖灰；行尾箭头 12 */
.past-activities .past-state { min-height: 0; margin-top: 8px; padding: 28px 12px; gap: 8px; border-radius: 12px; background: var(--k-paper); }
.past-activities .past-state__title { color: var(--k-ink2); font-size: 14px; font-weight: 500; }
/* 2026-11-18 第三轮：出错和「暂无往期活动」同一个空状态（56 浅棕方块 + 32 号图标 + 14 / 500 标题 + 12 说明 + 32 高小胶囊）；活动卡封面 80 方图、卡内 12 */
.past-activities .past-state { gap: 4px; padding: 32px 16px; }
.past-activities .past-state__ic { width: 56px; height: 56px; margin-bottom: 6px; border-radius: 16px; background: var(--k-red-soft); display: flex; align-items: center; justify-content: center; }
.past-activities .past-state :deep(.k-button) { height: 32px; margin-top: 10px; padding: 0 14px; border-radius: 16px; font-size: 12px; }
.past-activities .past-context { gap: 8px; padding: 12px; }
.past-activities .past-item { gap: 12px; padding: 12px; }
.past-activities .past-item__cover { flex-basis: 80px; width: 80px; height: 80px; }
.past-activities .past-item__title { font-size: 15px; line-height: 21px; }
.past-activities .past-item__when { margin-top: 4px; font-size: 12px; line-height: 17px; }
.past-activities .past-item__foot { margin-top: 8px; }
.past-activities .past-item__price { font-size: 14px; font-variant-numeric: tabular-nums; }
/* 2026-11-18 第三轮返修：顶部小院名不再单独垫白卡，改成页面底上的一行 13 号暖灰 + 14 号图标，和列表隔 12 */
.past-activities .past-context { gap: 4px; margin-bottom: 12px; padding: 0 4px; border-radius: 0; background: transparent; color: var(--k-muted); font-size: 13px; line-height: 19px; }
/* 11-18 第三轮返修（独立评审第 2 轮）：空状态和订房列表同一个做法 —— 不垫白卡，放在页面上三分之一处；出错时有一行 12 号说明和 32 高小胶囊 */
.past-activities .past-state { margin-top: 12vh; padding: 0 16px; background: transparent; }

/* 11-18 第五轮返修：出错 / 空状态放回白卡（和本组其他空状态一致）；小院名 14/500 墨灰，与列表间 12。 */
.past-activities .past-state { margin-top: 12px; padding: 32px 16px; border-radius: 12px; background: var(--k-paper); }
.past-activities .past-context { margin-bottom: 12px; color: var(--k-ink2); font-size: 14px; font-weight: 500; line-height: 20px; }
/* <<R6-BEGIN>> */
/* 11-18 第四轮：整页只剩出错 / 空状态时不套白卡，直接放在页面底上、往下挪到约四分之一屏处（56 方块 + 14/500 标题 + 12 说明 + 32 高次按钮）。 */
.past-activities .past-state { margin: 84px 0 0; padding: 0 16px; border-radius: 0; background: transparent; box-shadow: none; }
.past-activities .past-state__ic { width: 56px; height: 56px; margin: 0 0 12px; border-radius: 16px; background: var(--k-red-soft); }
.past-activities .past-state__title { color: var(--k-ink); font-size: 14px; font-weight: 500; line-height: 20px; }
/* 11-19 微信实拍返修：出错 / 空状态整块下移到约屏高 38%，图标方块 64、标题 15/600 墨色，不再偏上偏轻。 */
.past-activities .past-state { margin-top: 30vh; }
.past-activities .past-state__ic { width: 64px; height: 64px; border-radius: 18px; }
.past-activities .past-state__title { font-size: 15px; font-weight: 600; line-height: 21px; }
/* <<R6-END>> */
</style>
