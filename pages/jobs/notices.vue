<template>
  <view class="an-page">
    <k-topbar title="本次报名通知" back />
    <view class="an-main">
      <view class="an-heading"><view class="an-heading-icon"><k-icon name="bell" :size="25" color="red" /></view><view class="an-heading-copy"><text class="an-title">每一步进展，都在这里</text><text class="an-subtitle">{{ unread ? unread + ' 条未读 · 点击通知查看完整内容' : '仅展示这次报名的通知' }}</text></view></view>
      <view v-if="error" class="an-state"><text>{{ error }}</text><k-button v-if="appId" block type="outline" :disabled="loading" @click="load()">重新加载</k-button></view>
      <view v-else-if="loading && !rows.length" class="an-state"><text>正在读取报名通知…</text></view>
      <view v-else-if="!rows.length" class="an-state"><k-icon name="inbox" :size="38" color="muted" /><text class="an-state-title">暂时没有报名通知</text><text>面试安排、录用确认等新进展会在这里提醒。</text></view>
      <template v-else>
        <view v-for="item in rows" :key="item.id" class="an-card" :class="{ 'an-card--unread': !item.read }">
          <view class="an-toggle" role="button" :aria-label="'查看通知：' + item.title" :aria-expanded="expanded === item.id" @click="openRow(item)">
            <view class="an-card-top"><k-display-text class="an-card-title" :value="item.title || '报名进展通知'" :preserve="[item.peerName, item.actorName]" :preserve-quotes="false" /><text v-if="!item.read" class="an-badge">未读</text></view>
            <k-display-text class="an-content" :class="{ 'an-content--preview': expanded !== item.id }" :value="item.content || '暂无补充内容，请查看报名进度。'" :preserve="[item.peerName, item.actorName]" :preserve-quotes="false" />
            <view class="an-card-bottom"><text>{{ messageTime(item.createTime) }}</text><view class="an-expand"><text>{{ expanded === item.id ? '收起' : '查看全文' }}</text><k-icon :name="expanded === item.id ? 'chevron-up' : 'chevron-down'" :size="14" color="muted" /></view></view>
          </view>
          <button v-if="readErrors[item.id] && expanded === item.id" class="an-read-error" :disabled="reading[item.id]" @click="readRow(item)">已读状态未能同步，点击重试</button>
        </view>
        <button v-if="hasMore" class="an-more" :disabled="loading" @click="load(true)">{{ loading ? '正在加载…' : moreError ? '加载失败，点击重试' : '查看更早通知' }}</button>
        <text v-else class="an-end">已展示本次报名的全部通知</text>
      </template>
      <button v-if="appId" class="an-progress" @click="go(R.jobProgress + '?appId=' + appId)">查看报名进度<k-icon name="chevron-right" :size="16" color="red" /></button>
    </view>
  </view>
</template>

<script setup>
import { ref, watch } from 'vue'
import { onShow, onHide, onUnload, onPullDownRefresh, onReachBottom } from '@dcloudio/uni-app'
import { useScreen, go } from '@/common/screen.js'
import { apiApplicationMessages, apiMarkRead } from '@/common/api.js'
import { ensureSession, experience, refreshUnread, getSessionRevision } from '@/common/experience.js'
import { getToken } from '@/common/request.js'
import { errText } from '@/common/ui.js'
import R from '@/common/routes.js'
import { applicationMessages, messageTime, validId } from './application-messages.js'

const appId = ref(0), rows = ref([]), unread = ref(0), hasMore = ref(false), before = ref(0)
const loading = ref(false), error = ref(''), moreError = ref(false), expanded = ref(0), reading = ref({}), readErrors = ref({})
let version = 0, targetId = 0, firstShow = true, visible = true, disposed = false
useScreen(1, { onLoad(q) { appId.value = validId(q.appId); targetId = validId(q.messageId); load() } })
onShow(() => { visible = true; if (firstShow) { firstShow = false; return } load() })
onHide(() => { visible = false; version++; loading.value = false })
onUnload(() => { disposed = true; version++ })
onPullDownRefresh(async () => { try { await load() } finally { uni.stopPullDownRefresh() } })
onReachBottom(() => { if (hasMore.value) load(true) })
watch(() => experience.account?.id, () => {
  version++; loading.value = false; rows.value = []; unread.value = 0; expanded.value = 0; hasMore.value = false
  reading.value = {}; readErrors.value = {}; error.value = ''
  if (appId.value && visible && !disposed) load()
}, { flush: 'sync' })
async function load(more = false) {
  if (loading.value || disposed || !visible) return
  if (!appId.value) { error.value = '缺少报名信息，请从双向确认进度页进入'; return }
  if (more && (!hasMore.value || !before.value)) return
  const ticket = ++version
  loading.value = true
  try {
    await ensureSession()
    if (ticket !== version || disposed || !visible) return
    const account = experience.account?.id, session = getSessionRevision(), token = getToken()
    if (!account) throw new Error('请登录后查看这次报名的通知')
    const response = await apiApplicationMessages(appId.value, { size: 20, ...(more ? { before: before.value } : {}) })
    if (ticket !== version || disposed || !visible || account !== experience.account?.id || session !== getSessionRevision() || token !== getToken()) return
    const data = applicationMessages(response.data, appId.value)
    const known = new Set(more ? rows.value.map(row => row.id) : [])
    rows.value = [...(more ? rows.value : []), ...data.rows.filter(row => !known.has(row.id))]
    unread.value = data.unread; hasMore.value = data.hasMore && !!data.nextBefore; before.value = data.nextBefore
    error.value = ''; moreError.value = false
    const target = rows.value.find(row => row.id === targetId)
    if (target) { targetId = 0; expanded.value = target.id; readRow(target) }
  } catch (e) {
    if (ticket === version && !disposed && visible) {
      if (more) moreError.value = true
      else { rows.value = []; unread.value = 0; error.value = errText(e, '报名通知加载失败，请重试') }
    }
  } finally { if (ticket === version) loading.value = false }
}
function openRow(item) {
  expanded.value = expanded.value === item.id ? 0 : item.id
  if (expanded.value) readRow(item)
}
async function readRow(item) {
  if (item.read || reading.value[item.id] || !visible || disposed) return
  const account = experience.account?.id, session = getSessionRevision(), token = getToken()
  const sameAccount = () => !disposed && account === experience.account?.id && session === getSessionRevision() && token === getToken()
  reading.value[item.id] = true
  try {
    const response = await apiMarkRead(item.id)
    if (!sameAccount()) return
    let confirmedUnread = null
    if (!(response.data?.updated > 0)) {
      // 可能已在消息中心或另一台设备读过。回查该条，不能将零更新误判为已读。
      const check = await apiApplicationMessages(appId.value, { before: item.id + 1, size: 1 })
      if (!sameAccount()) return
      const latest = applicationMessages(check.data, appId.value)
      if (!latest.rows.some(row => row.id === item.id && row.read)) throw new Error('已读状态未能同步')
      confirmedUnread = latest.unread
    }
    const current = rows.value.find(row => row.id === item.id)
    if (current && !current.read) { current.read = true; unread.value = Math.max(0, unread.value - 1) }
    if (confirmedUnread !== null) unread.value = confirmedUnread
    delete readErrors.value[item.id]
    refreshUnread().catch(() => {})
  } catch (e) { if (sameAccount()) readErrors.value[item.id] = true }
  finally { if (account === experience.account?.id) delete reading.value[item.id] }
}
</script>

<style scoped>
.an-page { min-height: 100vh; background: var(--k-bg); color: var(--k-ink); }
.an-main { padding: 22px 20px calc(36px + var(--k-safe-bottom)); }
.an-heading { display: flex; align-items: center; gap: 12px; margin-bottom: 24px; }
.an-heading-icon { flex: 0 0 48px; height: 48px; border-radius: 16px; background: var(--k-paper2); display: flex; align-items: center; justify-content: center; }
.an-heading-copy { min-width: 0; }.an-title { display: block; font-size: 18px; font-weight: 700; line-height: 1.5; }.an-subtitle { display: block; margin-top: 5px; font-size: 12px; color: var(--k-muted); line-height: 1.6; }
.an-card { margin-bottom: 14px; border: 1px solid var(--k-line); border-radius: 16px; background: var(--k-paper); overflow: hidden; }.an-card--unread { border-color: var(--k-red); }
.an-toggle { padding: 18px 16px; }.an-card-top { display: flex; align-items: flex-start; gap: 8px; }.an-card-title { flex: 1; min-width: 0; overflow-wrap: anywhere; font-size: 16px; font-weight: 650; line-height: 1.5; }.an-badge { flex-shrink: 0; background: var(--k-paper2); color: var(--k-red-deep); border-radius: 5px; padding: 3px 6px; font-size: 11px; }
.an-content { display: block; margin-top: 12px; color: var(--k-ink2); font-size: 14px; line-height: 1.85; white-space: pre-wrap; overflow-wrap: anywhere; }.an-content--preview { display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
.an-card-bottom { display: flex; justify-content: space-between; align-items: center; gap: 8px; margin-top: 16px; font-size: 11px; color: var(--k-muted); }.an-expand { display: flex; align-items: center; gap: 4px; }
.an-state { display: flex; flex-direction: column; align-items: center; gap: 18px; padding: 40px 18px; border-radius: 16px; background: var(--k-paper); font-size: 14px; line-height: 1.8; text-align: center; color: var(--k-muted); }.an-state-title { font-size: 18px; font-weight: 650; color: var(--k-ink); }
.an-more, .an-progress, .an-read-error { display: flex; align-items: center; justify-content: center; gap: 6px; margin: 12px 0 0; padding: 12px; background: transparent; color: var(--k-red-deep); font-size: 13px; line-height: 1.6; min-height: 44px; }.an-more::after, .an-progress::after, .an-read-error::after { border: 0; }.an-read-error { margin: 0; border-top: 1px solid var(--k-line); font-size: 12px; }.an-end { display: block; padding: 14px 0; font-size: 12px; color: var(--k-muted); text-align: center; }
</style>
