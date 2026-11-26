<template>
  <view class="k-page online-daily">
    <k-topbar title="线上任务概况" back />
    <view class="k-body k-pad-tab od-body">
      <view class="od-heading"><view><text class="od-city">{{ data.city || '当地' }} · 线上任务招募</text><text class="od-meta">{{ data.date || '' }} · 本城市合作门店</text></view><view class="od-refresh" hover-class="k-press" @click="load">{{ loading ? '更新中…' : '刷新' }}</view></view>
      <view v-if="error" class="od-empty"><text>{{ error }}</text><k-button label="重新加载" size="md" type="outline" @click="load" /></view>
      <template v-else-if="loaded">
        <view class="od-stats">
          <view v-for="t in STATS" :key="t.key" class="od-stat" :class="{ warn: t.warn && data[t.key] > 0 }"><text>{{ t.label }}</text><text class="od-number">{{ data[t.key] || 0 }}<text class="od-unit">{{ t.unit }}</text></text></view>
        </view>
        <view class="od-section"><text>按任务查看</text><text class="od-meta">{{ tasks.length }} 个任务</text></view>
        <view v-for="task in tasks" :key="task.jobId" class="od-task">
          <view class="od-task__head"><text class="od-task__title">{{ task.title }}</text><k-chip :tone="onlineTaskTone(task)"><text>{{ task.statusLabel }}</text></k-chip></view>
          <text class="od-meta">{{ task.storeName }}</text>
          <view class="od-task__stats"><view v-for="c in onlineTaskStats(task)" :key="c.label" class="od-cell"><text class="od-cell__num" :class="{ warn: c.warn }">{{ c.value }}</text><text class="od-cell__label">{{ c.label }}</text></view></view>
        </view>
        <view v-if="!tasks.length" class="od-empty"><k-icon name="laptop" :size="36" color="muted" /><text>本城市现在没有招募中的线上任务</text></view>
        <view v-if="data.note" class="od-note"><text>统计说明</text><text>{{ data.note }}</text></view>
      </template>
      <view v-else class="od-empty"><text>正在读取线上任务情况…</text></view>
    </view>
    <k-tabbar mode="staff" active="business" />
  </view>
</template>

<script setup>
// 线上任务招募概况（10-30 店员 Luna 的备忘录），只读：本城招募中的任务和缺口，不含任何报名人的信息。
// 只给 merchant_service 和兼任的小院主理人（服务端 serviceCtx 把关），别的角色 403，页面显示那句话。
// 地址带 ?storeId= 就按它取，不切当前门店：兼任的人看完回工作台还是自己的小院。
import { ref, computed, watch } from 'vue'
import { onLoad, onShow, onUnload, onPullDownRefresh } from '@dcloudio/uni-app'
import { get } from '@/common/request.js'
import { ensureSession, hasStaffAccess, currentStaffStoreId, getSessionRevision } from '@/common/experience.js'
import { errText } from '@/common/ui.js'
import { ONLINE_DAILY_API, onlineTaskStats, onlineTaskTone } from './request-view.js'

const STATS = [
  { key: 'recruiting', label: '招募中', unit: '个' },
  { key: 'shortfall', label: '招募缺口', unit: '人', warn: true },
  { key: 'toReview', label: '待审核报名', unit: '份', warn: true },
  { key: 'toAccept', label: '待验收成果', unit: '份', warn: true }
]
const data = ref({}), loaded = ref(false), loading = ref(false), error = ref('')
const tasks = computed(() => data.value.tasks || [])
let seq = 0, booted = false, shown = false, scopeStore = null
async function load() {
  if (!booted) return
  const request = ++seq, store = scopeStore || currentStaffStoreId(), session = getSessionRevision()
  loading.value = true; error.value = ''
  try {
    if (!hasStaffAccess.value || !store) throw new Error('当前账号没有有效员工授权')
    const result = (await get(ONLINE_DAILY_API, { storeId: store })).data || {}
    if (request !== seq || session !== getSessionRevision()) return
    data.value = result; loaded.value = true
  } catch (e) { if (request === seq) error.value = errText(e, '线上任务概况加载失败') }
  finally { if (request === seq) loading.value = false }
}
onLoad(async q => {
  try {
    await ensureSession()
    scopeStore = q?.storeId || null
    booted = true; load()
  } catch (e) { error.value = errText(e, '身份校验失败') }
})
// 没带门店时跟着当前门店走（带了门店就只看那一家所在的城市）
watch(() => currentStaffStoreId(), () => { if (booted && !scopeStore) load() })
onShow(() => { if (shown && booted) load(); shown = true })
onUnload(() => { seq++; booted = false })
onPullDownRefresh(() => load().finally(() => uni.stopPullDownRefresh()))
</script>

<style scoped lang="scss">
/* 2026-11-17 改版「小而精」：浅灰底 + 白卡（12 圆角、不描边），数字加粗做大小对比；内容不变。共用写法在 ./work-lite.scss */
@import './work-lite.scss';
.online-daily { @include lite-page; }
.od-body { padding-top: 10px; }
.od-heading,.od-section,.od-task__head { display:flex; align-items:center; justify-content:space-between; gap:12px; }
.od-city { display:block; font-family:var(--k-sans); font-size:17px; font-weight:700; line-height:24px; margin-bottom:2px; }
.od-meta { display:block; color:var(--k-muted); font-size:12px; font-weight:400; line-height:1.6; }
.od-refresh { flex-shrink:0; padding:12px 0 12px 12px; font-size:12px; color:var(--k-red-deep); }
.od-stats { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:8px; margin-top:10px; }
/* 数据格（11-18）：数字在上 18 / 700 等宽，说明 11 / muted 在下，间距 2（用 order 调顺序，模板不动） */
.od-stat { min-width:0; padding:12px 6px 10px; border:0; border-radius:12px; background:var(--k-paper); display:flex; flex-direction:column; align-items:center; gap:2px; text-align:center; font-size:11px; color:var(--k-muted); }
/* 有待办的格子不再整块染色，只把数字换成暖棕 */
.od-number { order:-1; display:block; margin-top:0; font-size:18px; font-weight:700; line-height:1.25; color:var(--k-ink); font-variant-numeric:tabular-nums; }
.od-stat.warn .od-number { color:var(--k-red-deep); }
.od-unit { font-size:11px; font-weight:400; margin-left:3px; }
.od-section { margin:16px 0 8px; font-family:var(--k-sans); font-size:16px; font-weight:700; line-height:22px; color:var(--k-ink); }
.od-task { border:0; border-radius:12px; background:var(--k-paper); margin-bottom:8px; padding:12px; }
.od-task__head { align-items:flex-start; margin-bottom:2px; }
.od-task__title { flex:1; min-width:0; font-size:14px; font-weight:600; line-height:20px; overflow-wrap:anywhere; }
.od-task__stats { position:relative; display:grid; grid-template-columns:repeat(5,minmax(0,1fr)); margin-top:10px; padding-top:10px; }
.od-task__stats::before { content:""; position:absolute; left:0; right:0; top:0; height:1px; background:var(--k-line); transform:scaleY(.5); transform-origin:0 0; }
.od-cell { min-width:0; display:flex; flex-direction:column; align-items:center; gap:2px; }
.od-cell__num { font-size:18px; font-weight:700; line-height:1.25; color:var(--k-ink); font-variant-numeric:tabular-nums; }
.od-cell__num.warn { color:var(--k-alert); }
.od-cell__label { font-size:11px; color:var(--k-muted); white-space:nowrap; }
.od-note { margin-top:16px; font-size:11px; color:var(--k-muted); line-height:1.8; }
.od-note>text { display:block; margin-bottom:4px; }
.od-note>text:first-child { font-weight:600; color:var(--k-ink2); }
/* 空状态 / 读取中（11-18）：白卡里居中，14 / 500 二级墨，上下留白 28；「重新加载」是 32 高的次按钮小胶囊 */
.od-empty { margin-top:10px; padding:28px 16px; border-radius:12px; background:var(--k-paper); display:flex; flex-direction:column; align-items:center; justify-content:center; gap:12px; font-size:14px; font-weight:500; line-height:1.6; color:var(--k-ink2); text-align:center; }
.od-section + .od-empty { margin-top:0; }
.od-empty :deep(.k-button.is-md) { height:32px; padding:0 14px; font-size:13px; border-color:var(--k-red-line); color:var(--k-red-deep); }
</style>
