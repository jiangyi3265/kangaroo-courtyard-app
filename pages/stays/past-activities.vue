<template>
  <k-feature-gate feature="stay-booking">
  <view class="k-page past-activities">
    <k-topbar title="往期活动" back />
    <view class="past-body">
      <view v-if="stayName" class="past-context"><k-icon name="home" :size="17" color="red" /><text>{{ stayName }}</text></view>
      <view v-if="loading" class="past-state" role="status"><text>正在加载往期活动…</text></view>
      <view v-else-if="loadError" class="past-state" role="status">
        <text>{{ loadError }}</text>
        <k-button v-if="storeId" type="secondary" size="sm" label="重新加载" @click="load" />
      </view>
      <view v-else-if="!rows.length" class="past-state">
        <k-icon name="calendar" :size="34" color="muted" />
        <text class="past-state__title">暂无往期活动</text>
        <text>活动结束后，可在这里回顾</text>
      </view>
      <template v-else>
        <text class="past-note">{{ rows.length >= 20 ? '最近 20 场已结束的活动' : '已结束的活动' }}，点击查看详情</text>
        <view class="past-list">
          <view v-for="a in rows" :key="a.activityId" class="past-item" role="button" :aria-label="'查看往期活动：' + a.title" hover-class="k-press-s" @click="openActivity(a)">
            <image v-if="a.cover" class="past-item__cover" :src="absUrl(a.cover)" mode="aspectFill" lazy-load />
            <view v-else class="past-item__cover past-item__cover--empty"><k-icon name="calendar" :size="28" color="muted" /></view>
            <view class="past-item__body">
              <text class="past-item__title">{{ a.title }}</text>
              <text v-if="a.when" class="past-item__when">{{ a.when }}</text>
              <view class="past-item__foot"><text class="past-item__price" :class="{ 'past-item__price--free': a.free }">{{ a.price }}</text><text class="past-item__status">已结束</text></view>
            </view>
            <k-icon name="chevron-right" :size="16" color="muted" />
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
</style>
