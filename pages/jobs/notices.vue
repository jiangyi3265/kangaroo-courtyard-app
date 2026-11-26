<template>
  <view class="an-page" :class="$userSurface">
    <k-topbar title="本次报名通知" back />
    <view class="an-main">
      <view class="an-heading"><view class="an-heading-icon"><k-icon name="bell" :size="20" color="red" /></view><view class="an-heading-copy"><text class="an-title">每一步进展，都在这里</text><text class="an-subtitle">{{ unread ? unread + ' 条未读 · 点击通知查看完整内容' : '仅展示这次报名的通知' }}</text></view></view>
      <view v-if="error" class="an-state an-state--error"><view class="an-state-icon"><k-icon name="circle-alert" :size="32" color="muted" /></view><text>{{ error }}</text><k-button v-if="appId" block type="outline" :disabled="loading" @click="load()">重新加载</k-button></view>
      <view v-else-if="loading && !rows.length" class="an-state"><text>正在读取报名通知…</text></view>
      <view v-else-if="!rows.length" class="an-state" :class="{ 'an-state--with-link': appId }"><view class="an-state-icon"><k-icon name="inbox" :size="32" color="muted" /></view><text class="an-state-title">暂时没有报名通知</text><text>面试安排、录用确认等新进展会在这里提醒。</text></view>
      <template v-else>
        <view v-for="item in rows" :key="item.id" class="an-card" :class="{ 'an-card--unread': !item.read }">
          <view class="an-toggle" role="button" :aria-label="'查看通知：' + item.title" :aria-expanded="expanded === item.id" @click="openRow(item)">
            <view class="an-card-top"><k-display-text class="an-card-title" :value="item.title || '报名进展通知'" :preserve="[item.peerName, item.actorName]" :preserve-quotes="false" /><text v-if="!item.read" class="an-badge">未读</text></view>
            <k-display-text class="an-content" :class="{ 'an-content--preview': expanded !== item.id }" :value="item.content || '暂无补充内容，请查看报名进度。'" :preserve="[item.peerName, item.actorName]" :preserve-quotes="false" />
            <view class="an-card-bottom"><text>{{ messageTime(item.createTime) }}</text><view class="an-expand"><text>{{ expanded === item.id ? '收起' : '查看全文' }}</text><k-icon :name="expanded === item.id ? 'chevron-up' : 'chevron-down'" :size="12" color="muted" /></view></view>
          </view>
          <button v-if="readErrors[item.id] && expanded === item.id" class="an-read-error" :disabled="reading[item.id]" @click="readRow(item)">已读状态未能同步，点击重试</button>
        </view>
        <button v-if="hasMore" class="an-more" :disabled="loading" @click="load(true)">{{ loading ? '正在加载…' : moreError ? '加载失败，点击重试' : '查看更早通知' }}</button>
        <text v-else class="an-end">已展示本次报名的全部通知</text>
      </template>
      <button v-if="appId" class="an-progress" @click="go(R.jobProgress + '?appId=' + appId)">查看报名进度<k-icon name="chevron-right" :size="12" color="red" /></button>
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
/* 2026-11-17 改版「小而精」：浅灰底 + 白卡（12 圆角、不描边）；未读的通知整张浅杏色并保留「未读」小标签（和消息页一样）；
   查看全文 / 收起、重试、查看更早通知、查看报名进度都照旧。 */
.an-page { --k-bg: #F7F5F2; background: #F7F5F2; }
.an-main { padding: 12px 12px calc(28px + var(--k-safe-bottom)); }
.an-heading { gap: 10px; margin-bottom: 12px; padding: 0 2px; }
.an-heading-icon { flex-basis: 40px; height: 40px; border-radius: 12px; background: linear-gradient(160deg, #FFF6EA, #FFE7CC); }

.an-title { font-size: 15px; line-height: 21px; }
.an-subtitle { margin-top: 2px; font-size: 11px; line-height: 16px; }
.an-card { margin-bottom: 8px; border: 0; border-radius: 12px; }
.an-card--unread { background: #FBF0DE; }
.an-toggle { padding: 12px; }
.an-card-title { font-size: 14px; font-weight: 600; line-height: 20px; }
.an-badge { padding: 0 5px; border-radius: 4px; background: var(--k-alert-soft); color: var(--k-alert); font-size: 10px; font-weight: 500; line-height: 17px; }
.an-content { margin-top: 6px; font-size: 13px; line-height: 1.7; }
.an-card-bottom { margin-top: 8px; }
.an-expand { gap: 2px; }
.an-state { gap: 12px; padding: 36px 16px; border-radius: 12px; font-size: 13px; line-height: 1.7; }
.an-state-title { font-size: 15px; font-weight: 600; }
.an-state :deep(.k-button.is-lg) { height: 44px; border-radius: 22px; font-size: 15px; }
.an-more, .an-progress, .an-read-error { margin-top: 4px; padding: 8px 12px; }
.an-read-error { margin-top: 0; }
/* —— 第二轮精修（11-18）：空状态按全站一个样子；「重新加载」是随字宽的小胶囊；分隔用发丝线 —— */
.an-state { gap: 8px; padding: 28px 16px; font-size: 12px; line-height: 1.6; }
.an-state-title { font-size: 14px; font-weight: 500; color: var(--k-ink2); }
.an-state :deep(.k-button.is-lg) { width: auto; align-self: center; height: 36px; padding: 0 16px; border-radius: 18px; font-size: 13px; }
.an-read-error { border-top: 0; background-image: linear-gradient(to bottom, var(--k-line) 50%, transparent 50%); background-size: 100% 1px; background-repeat: no-repeat; background-position: left top; }
/* ==== r3jobsb 第三轮 start ==== */
/* 第三轮（11-18）：出错和空状态同一个样子——56 的浅棕圆角方块里放 32 号线性图标，标题 14/500，说明 12；
   页边距 16，通知卡 16 内边距、卡间 8。 */
.an-main { padding: 12px 16px calc(28px + var(--k-safe-bottom)); }
.an-heading { margin-bottom: 16px; padding: 0 4px; }
.an-state { gap: 0; padding: 32px 24px; }
.an-state-icon { width: 56px; height: 56px; border-radius: 16px; background: var(--k-red-soft); display: flex; align-items: center; justify-content: center; }
.an-state-icon + text { margin-top: 12px; }
.an-state-title { font-size: 14px; font-weight: 500; line-height: 20px; color: var(--k-ink2); }
.an-state-title + text { margin-top: 4px; }
.an-state--error > text { font-size: 14px; font-weight: 500; line-height: 20px; color: var(--k-ink2); }
.an-state :deep(.k-button) { margin-top: 16px; border-color: var(--k-red-line); color: var(--k-red-deep); }
.an-toggle { padding: 14px 16px; }
.an-card-top { align-items: center; }
.an-card-bottom { margin-top: 10px; font-variant-numeric: tabular-nums; }
.an-progress { margin-top: 8px; gap: 4px; }

/* —— 返修 1 —— */
/* 头部铃铛方块和下面卡片左边对齐 16 */
.an-heading { padding: 0; }
/* 未读卡不再整张染米色：白底 + 右上「未读」标签就够；已读的标题降到 500 */
.an-card--unread { background: var(--k-paper); }
.an-card:not(.an-card--unread) .an-card-title { font-weight: 500; }
/* 底部两个入口同一套 13/500 深棕：「查看更早通知」是 36 高的次按钮小胶囊，「查看报名进度」是文字 + 12 号箭头，上下隔 16 */
.an-more { width: max-content; height: 36px; min-height: 36px; margin: 12px auto 0; padding: 0 16px; box-sizing: border-box; border: 1px solid var(--k-red-line); border-radius: 18px; background: var(--k-paper); font-size: 13px; font-weight: 500; line-height: 1; }
.an-progress { margin-top: 16px; font-size: 13px; font-weight: 500; }
.an-heading-icon { background: var(--k-red-soft); }
/* —— 返修 2 start —— */
/* 「未读」标签 11 号；已读的标题 500 + 次一档墨色，未读 600 墨色，一眼分得出 */
.an-badge { font-size: 11px; line-height: 18px; }
.an-card--unread .an-card-title { font-weight: 600; color: var(--k-ink); }
.an-card:not(.an-card--unread) .an-card-title { font-weight: 500; color: var(--k-ink2); }
/* 出错卡：字限宽 240、两行均分，不会只剩一个字掉到第二行 */
.an-state--error > text { max-width: 240px; text-align: center; text-wrap: balance; }
/* —— 返修 2 end —— */
/* —— 返修 4 start（11-18 夜）—— */
/* 已读通知：标题 500 次墨色、正文灰，和未读卡拉开 */
.an-card:not(.an-card--unread) .an-content, .an-card:not(.an-card--unread) :deep(.an-content) { color: var(--k-muted); }
.an-card:not(.an-card--unread) :deep(.an-card-title) { font-weight: 500; color: var(--k-ink2); }
/* 出错卡：一句话一行写下（320 宽卡内左右收到 16） */
.an-state--error > text { max-width: none; }
@media (max-width: 359px) { .an-state { padding-left: 16px; padding-right: 16px; } }
/* —— 返修 4 end —— */
/* —— 返修 5 start（11-18 深夜）—— */
/* 出错卡：字 14/500，左右 24，字两边留够空 */
.an-state--error { padding-left: 24px; padding-right: 24px; }
.an-state--error > text { max-width: 240px; font-size: 14px; font-weight: 500; text-wrap: balance; }
/* 未读：标题前一个 6px 暖棕小圆点 */
.an-card--unread .an-card-top::before { content: ''; flex: 0 0 auto; width: 6px; height: 6px; border-radius: 50%; background: var(--k-red); }
/* 没有通知：「查看报名进度」收进空卡里，说明下面 12，做成 36 高的描边小按钮 */
.an-state--with-link { padding-bottom: 76px; }
.an-state--with-link + .an-progress { position: relative; width: fit-content; height: 36px; min-height: 36px; margin: -64px auto 28px; padding: 0 16px; box-sizing: border-box; border: 1px solid var(--k-red-line); border-radius: 18px; line-height: 34px; }
.an-state--with-link + .an-progress::after { border: 0; }
@media (max-width: 359px) { .an-state--error { padding-left: 24px; padding-right: 24px; } }
/* —— 返修 5 end —— */
/* ==== r3jobsb 第四轮 start（11-18 夜，以微信实拍为准）==== */
/* 整页出错（缺少报名信息）：不套白卡，直接放在页面上、往下移 96；标题在逗号后折行 */
.an-page .an-state--error { margin-top: 96px; padding: 0 24px; border-radius: 0; background: transparent; box-shadow: none; }
.an-page .an-state--error > text { font-size: 15px; font-weight: 500; line-height: 22px; color: var(--k-ink); word-break: keep-all; overflow-wrap: anywhere; text-wrap: balance; }
.an-page .an-state-icon { width: 56px; height: 56px; border-radius: 16px; background: var(--k-red-soft); }
/* ==== r3jobsb 第四轮 end ==== */
/* ==== r3jobsb 第四轮返修 start（11-19，复评遗留）==== */
/* 出错：方块用中性浅底；折行不用微信不认的 text-wrap，靠 keep-all + 最大宽 240 让断点落在逗号后 */
.an-page .an-state--error .an-state-icon { background: var(--k-fill); }
.an-page .an-state--error > text { max-width: 240px; margin-left: auto; margin-right: auto; text-wrap: wrap; word-break: keep-all; overflow-wrap: anywhere; }
/* ==== r3jobsb 第四轮返修 end ==== */
/* ==== r3jobsb 第五轮 start（11-19，按微信实拍复评）==== */
/* 页首：铃铛不再垫浅棕方块，20 号暖棕线性图标贴着标题（间距 8，和标题那一行上下居中） */
.an-page .an-heading { align-items: flex-start; gap: 8px; }
.an-page .an-heading-icon { flex: 0 0 20px; width: 20px; height: 21px; border-radius: 0; background: none; }
/* 出错 / 没有通知：本组统一的空状态方块——56、圆角 16、中性浅底、32 号灰色线性图标 */
.an-page .an-state-icon { background: var(--k-fill); }
/* ==== r3jobsb 第五轮 end ==== */
/* ==== r3jobsb 第三轮 end ==== */
</style>
