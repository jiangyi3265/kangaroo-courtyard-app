<template>
  <k-feature-gate feature="recruitment">
<k-feature-gate feature="private-chat">
  <view class="cp-page" :class="$userSurface">
    <k-topbar title="同行伙伴" back />
    <view class="cp-main">
      <view v-if="loadError" class="cp-state">
        <view class="cp-state__icon"><k-icon name="cloud-off" :size="28" color="red" /></view>
        <text class="cp-state__title">暂时看不到同行伙伴</text><text class="cp-state__copy">{{ loadError }}</text>
        <k-button v-if="jobId" block :disabled="loading" @click="load">重新加载</k-button>
        <k-button block type="outline" @click="go(R.jobsList)">查看其他岗位</k-button>
      </view>
      <view v-else-if="!team" class="cp-state"><text class="cp-state__copy">正在寻找一起出发的伙伴…</text></view>
      <template v-else>
        <view class="cp-intro">
          <view class="cp-eyebrow"><k-icon name="users" :size="14" color="red" /><text>同一份期待，一起出发</text></view>
          <text class="cp-title">先认识，再同行</text>
          <text class="cp-intro__copy">看看谁也报名了这个岗位，提前聊聊出发计划。</text>
        </view>
        <view class="cp-job" role="button" aria-label="查看关联岗位详情" hover-class="k-press" @click="openJob">
          <image v-if="job.cover" class="cp-job__cover" :src="absUrl(job.cover)" mode="aspectFill" />
          <view v-else class="cp-job__cover cp-job__empty"><k-icon name="house" :size="28" color="red" /></view>
          <view class="cp-job__body">
            <text class="cp-job__label">这次一起去</text><text class="cp-job__title">{{ displayWording(job.title, [job.storeName]) }}</text>
            <view class="cp-job__meta"><k-icon name="map-pin" :size="12" color="red" /><text>{{ job.city || '地点待补充' }}</text><text v-if="jobType">· {{ jobType }}</text></view>
            <view class="cp-job__more"><text class="cp-job__link">查看岗位</text><k-icon name="chevron-right" :size="12" color="red" /></view>
          </view>
        </view>

        <view class="cp-section-head"><view class="cp-section-title"><text>一起去的伙伴</text><text class="cp-count">{{ members.length }} 位</text></view><button class="cp-refresh" :disabled="loading || saving" @click="load"><k-icon name="refresh-cw" :size="14" color="muted" /><text>{{ loading ? '刷新中' : '刷新' }}</text></button></view>
        <text class="cp-section-note">仅展示主动加入同行的伙伴</text>
        <view v-if="members.length" class="cp-members">
          <view v-for="mate in members" :key="mate.userId" class="cp-member" :class="{ 'cp-member--me': mate.isMe }">
            <view class="cp-member__profile" role="button" :aria-label="'查看' + mate.name + '的主页'" @click="openProfile(mate)">
              <image v-if="mate.avatar && !brokenAvatars[mate.userId]" class="cp-avatar" :src="absUrl(mate.avatar)" mode="aspectFill" @error="brokenAvatars[mate.userId] = true" />
              <view v-else class="cp-avatar cp-avatar--empty"><k-icon name="user-round" :size="20" color="red" /></view>
              <view class="cp-member__body"><view class="cp-member__heading"><text class="cp-member__name">{{ mate.name }}</text><text v-if="mate.isMe" class="cp-me">我</text></view><text class="cp-member__meta">{{ mate.meta }}</text></view>
            </view>
            <text v-if="mate.isMe" class="cp-own-state">已加入</text>
            <button v-else class="cp-greet" :disabled="!!chatting || saving || loading" :aria-label="'和' + mate.name + '打个招呼'" hover-class="k-press" @click="greet(mate)">{{ chatting === mate.userId ? '连接中' : '打个招呼' }}</button>
          </view>
        </view>
        <view v-else class="cp-empty">
          <view class="cp-empty__icon"><k-icon name="users" :size="32" color="red" /></view>
          <text class="cp-empty__title">第一位同行伙伴，等你加入</text>
          <text class="cp-empty__copy">还没有伙伴主动加入同行。报名后加入，让准备出发的人认识你。</text>
        </view>
        <view class="cp-privacy"><k-icon name="shield-check" :size="14" color="green" /><text>主动加入后展示昵称、头像、所在城市与停留天数。手机号、微信号不会展示，可随时退出同行。</text></view>
        <view v-if="team.joined" class="cp-membership"><view><text class="cp-membership__title">你已加入这次同行</text><text class="cp-membership__copy">退出同行不会取消岗位报名</text></view><button class="cp-leave" :disabled="saving || loading" @click="setJoined(false)">退出同行</button></view>
      </template>
    </view>
    <view v-if="team && !loadError" class="cp-footer">
      <text class="cp-footer__hint">{{ actionHint }}</text>
      <k-button block :disabled="saving || loading || (!team.myAppId && !!blockedReason)" :label="saving ? '正在更新…' : actionLabel" @click="primaryAction" />
    </view>
  </view>
</k-feature-gate>
  </k-feature-gate>
</template>

<script setup>
import { displayWording } from '@/common/display-wording.js'
import { ref, computed } from 'vue'
import { onShow, onUnload, onPullDownRefresh } from '@dcloudio/uni-app'
import { useScreen, go, back, toast } from '@/common/screen.js'
import { apiJobTeam, apiJoinTeam, apiJobDetail, apiChatOpen } from '@/common/api.js'
import { ensureSession, experience } from '@/common/experience.js'
import { confirm, errText } from '@/common/ui.js'
import { gated, fail } from '@/common/community.js'
import { absUrl } from '@/common/upload.js'
import R from '@/common/routes.js'
import { positiveId, companionMembers, applicationBlockReason } from './companions-page.js'

const jobId = ref(0), team = ref(null), detail = ref(null), detailError = ref(false)
const loading = ref(false), saving = ref(false), chatting = ref(0), loadError = ref(''), brokenAvatars = ref({})
let sequence = 0, firstShow = true, disposed = false
useScreen(1, { onLoad(q) { jobId.value = positiveId(q.jobId); load() } })
onShow(() => { if (firstShow) { firstShow = false; return } load() })
onUnload(() => { disposed = true; sequence++ })
onPullDownRefresh(async () => { try { await load() } finally { uni.stopPullDownRefresh() } })
function acceptTeam(value) {
  if (!value?.job || positiveId(value.job.jobId) !== jobId.value) throw new Error('岗位不存在或已下架')
  return value
}
async function load() {
  if (saving.value || disposed) return
  const ticket = ++sequence
  if (!jobId.value) { loadError.value = '缺少岗位信息，请从岗位的寻伴同行入口进入'; return }
  loading.value = true
  try {
    await ensureSession()
    if (ticket !== sequence || disposed) return
    const results = await Promise.allSettled([apiJobTeam(jobId.value), apiJobDetail(jobId.value)])
    if (ticket !== sequence || disposed) return
    if (results[0].status === 'rejected') throw results[0].reason
    team.value = acceptTeam(results[0].value.data)
    const jobDetail = results[1].status === 'fulfilled' ? results[1].value.data : null
    detail.value = jobDetail && positiveId(jobDetail.jobId) === jobId.value ? jobDetail : null
    detailError.value = !detail.value
    loadError.value = ''
  } catch (e) {
    if (ticket === sequence && !disposed) { team.value = null; detail.value = null; loadError.value = errText(e, '伙伴列表加载失败，请重试') }
  } finally { if (ticket === sequence && !disposed) loading.value = false }
}
const job = computed(() => team.value?.job || {})
const jobType = computed(() => ({ volunteer: '换工旅行', parttime: '兼职旅行', fulltime: '全职旅行', online: '线上任务' })[job.value.jobType] || '')
const members = computed(() => companionMembers(team.value, experience.account?.id))
const blockedReason = computed(() => applicationBlockReason(team.value || {}, detail.value || {}))
const actionLabel = computed(() => {
  if (team.value?.joined) return '邀请朋友一起去'
  if (team.value?.myAppId) return '加入同行'
  if (blockedReason.value) return '暂不能报名'
  if (!experience.account) return '登录后加入同行'
  return detailError.value ? '重新加载报名信息' : '先报名，再加入同行'
})
const actionHint = computed(() => {
  if (team.value?.joined) return '出发时间和安排，记得与伙伴再确认'
  if (team.value?.myAppId) return '已报名，加入同行后伙伴们就能看到你'
  return blockedReason.value || (detailError.value ? '报名信息暂未加载，可重试' : '先完成岗位报名，再自愿加入同行')
})
function openJob() { if (team.value && !loading.value) go(R.jobDetail + '?jobId=' + jobId.value) }
function openProfile(mate) { if (positiveId(mate.userId)) go(R.userProfile + '?uid=' + mate.userId) }
async function requireLogin() {
  await ensureSession()
  if (disposed) return false
  if (experience.account) return true
  go(R.login)
  return false
}
function invite() {
  const pages = getCurrentPages(), previous = pages[pages.length - 2]
  const previousId = previous?.options?.jobId || previous?.$page?.options?.jobId
  if (previous?.route === 'pages/jobs/team' && positiveId(previousId) === jobId.value) return back()
  go(R.jobTeam + '?jobId=' + jobId.value)
}
async function primaryAction() {
  if (!team.value || loading.value || saving.value) return
  if (team.value.joined) return invite()
  if (team.value.myAppId) return setJoined(true)
  if (blockedReason.value) return toast(blockedReason.value)
  if (!(await requireLogin())) return
  if (detailError.value) return load()
  go(R.jobApply + '?jobId=' + jobId.value + '&title=' + encodeURIComponent(job.value.title || ''))
}
async function setJoined(visible) {
  if (!team.value || saving.value || loading.value) return
  saving.value = true
  let reload = false
  try {
    if (!(await requireLogin())) return
    if (visible && !team.value.myAppId) { toast('请先完成岗位报名'); return }
    const accepted = await confirm(visible ? '加入同行' : '退出同行', visible
      ? '加入后，其他用户可在同行伙伴页看到你的昵称、头像、所在城市和停留天数，不展示手机号、微信号。你可以随时退出。'
      : '退出后不再展示在同行伙伴列表中，岗位报名保持不变。确认退出？')
    if (!accepted || disposed) return
    ++sequence
    const result = (await apiJoinTeam(jobId.value, visible)).data
    if (disposed) return
    if (!visible && result?.joined === false && !result.job) {
      team.value = null
      detail.value = null
      loadError.value = '这个岗位的同行名单暂不可查看'
      toast('已退出同行，岗位报名不变')
      return
    }
    team.value = acceptTeam(result)
    toast(team.value.joined ? '已加入同行' : '已退出同行，岗位报名不变')
  } catch (e) {
    if (!disposed) { fail(e, '操作未完成，请重试'); reload = e?.code === 403 || e?.code === 404 }
  } finally { saving.value = false; if (reload && !disposed) load() }
}
async function greet(mate) {
  if (chatting.value || saving.value || loading.value || mate.isMe || !positiveId(mate.userId)) return
  chatting.value = mate.userId
  try {
    if (!(await requireLogin())) return
    const result = (await gated(() => apiChatOpen({ type: 'private', userId: mate.userId, source: 'profile' }))).data
    if (disposed) return
    const id = positiveId(result?.convId)
    if (!id) throw new Error('会话未能打开，请重试')
    go(R.chat + '?convId=' + id)
  } catch (e) { if (!disposed) fail(e, '暂时无法联系这位伙伴') }
  finally { chatting.value = 0 }
}
</script>

<style scoped>
.cp-page { min-height: 100vh; background: var(--k-bg); color: var(--k-ink); }
.cp-main { padding: 12px 20px calc(160px + var(--k-safe-bottom)); }
.cp-intro { padding: 8px 2px 24px; }
.cp-eyebrow { display: flex; align-items: center; gap: 7px; color: var(--k-red-deep); font-size: 13px; letter-spacing: 1px; }
.cp-title { display: block; margin-top: 12px; font-size: 28px; line-height: 1.35; font-weight: 750; letter-spacing: 1px; }
.cp-intro__copy { display: block; margin-top: 9px; max-width: 27em; font-size: 14px; color: var(--k-muted); line-height: 1.7; }
.cp-job { display: flex; gap: 14px; padding: 14px; background: var(--k-paper2); border-radius: 18px; }
.cp-job__cover { flex: 0 0 84px; width: 84px; height: 110px; border-radius: 12px; background: var(--k-line); }
.cp-job__empty { display: flex; align-items: center; justify-content: center; }
.cp-job__body { flex: 1; min-width: 0; }
.cp-job__label { display: block; font-size: 12px; color: var(--k-red-deep); }
.cp-job__title { display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; overflow-wrap: anywhere; margin-top: 4px; font-size: 16px; line-height: 1.45; font-weight: 650; }
.cp-job__meta { display: flex; flex-wrap: wrap; align-items: center; gap: 4px; margin-top: 7px; font-size: 12px; color: var(--k-muted); overflow-wrap: anywhere; }
.cp-job__link { display: block; color: var(--k-red-deep); margin-top: 8px; font-size: 12px; }
.cp-section-head { display: flex; justify-content: space-between; align-items: center; gap: 8px; margin-top: 26px; }
.cp-section-title { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; min-width: 0; font-size: 19px; font-weight: 700; }
.cp-count { padding: 3px 8px; border-radius: 8px; background: var(--k-paper2); color: var(--k-red-deep); font-size: 12px; font-weight: 500; }
.cp-refresh { flex-shrink: 0; display: flex; align-items: center; justify-content: center; gap: 5px; min-height: 48px; margin: 0 12px 0 0; padding: 0 4px; background: transparent; color: var(--k-muted); font-size: 12px; line-height: 1.4; }
.cp-refresh::after, .cp-greet::after, .cp-leave::after { border: 0; }
.cp-section-note { display: block; margin: 0 0 14px; font-size: 12px; color: var(--k-muted); }
.cp-members { overflow: hidden; border: 1px solid var(--k-line); border-radius: 18px; background: var(--k-paper); }
.cp-member { display: flex; align-items: center; gap: 10px; padding: 18px 14px; }
.cp-member + .cp-member { border-top: 1px solid var(--k-line); }
.cp-member--me { background: var(--k-paper2); }
.cp-member__profile { display: flex; align-items: center; gap: 11px; flex: 1; min-width: 0; min-height: 52px; }
.cp-avatar { flex: 0 0 48px; width: 48px; height: 48px; border-radius: 16px; background: var(--k-paper2); }
.cp-avatar--empty { display: flex; align-items: center; justify-content: center; }
.cp-member__body { flex: 1; min-width: 0; }
.cp-member__heading { display: flex; align-items: center; gap: 6px; }
.cp-member__name { min-width: 0; font-size: 16px; font-weight: 650; line-height: 1.45; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
.cp-me { flex-shrink: 0; padding: 1px 5px; border-radius: 4px; background: var(--k-paper); font-size: 11px; color: var(--k-red-deep); }
.cp-member__meta { display: block; margin-top: 5px; font-size: 12px; line-height: 1.5; color: var(--k-muted); overflow-wrap: anywhere; }
.cp-greet { flex: 0 0 78px; margin: 0; min-height: 48px; display: flex; align-items: center; justify-content: center; padding: 0 8px; border: 1px solid var(--k-line2); border-radius: 24px; background: var(--k-paper); color: var(--k-red-deep); font-size: 13px; font-weight: 600; line-height: 1.4; }
.cp-own-state { flex-shrink: 0; padding: 0 9px; font-size: 13px; color: var(--k-red-deep); }
.cp-empty { padding: 32px 20px; text-align: center; background: var(--k-paper); border: 1px solid var(--k-line); border-radius: 18px; }
.cp-empty__icon { width: 76px; height: 76px; display: flex; align-items: center; justify-content: center; border-radius: 50%; margin: 0 auto 18px; background: var(--k-paper2); }
.cp-empty__title { display: block; font-size: 17px; line-height: 1.5; font-weight: 650; }
.cp-empty__copy { display: block; margin-top: 8px; font-size: 14px; line-height: 1.8; color: var(--k-muted); }
.cp-privacy { display: flex; align-items: flex-start; gap: 8px; margin: 18px 2px 0; font-size: 12px; line-height: 1.8; color: var(--k-muted); }
.cp-privacy > text { flex: 1; min-width: 0; }
.cp-membership { display: flex; justify-content: space-between; align-items: center; gap: 8px; margin-top: 24px; padding-top: 16px; border-top: 1px solid var(--k-line); }
.cp-membership > view { min-width: 0; flex: 1; }
.cp-membership__title { display: block; font-size: 14px; font-weight: 600; }
.cp-membership__copy { display: block; margin-top: 5px; font-size: 12px; color: var(--k-muted); line-height: 1.5; }
.cp-leave { flex-shrink: 0; min-height: 48px; padding: 0 5px; margin: 0; background: transparent; color: var(--k-muted); font-size: 13px; display: flex; align-items: center; }
.cp-footer { position: fixed; z-index: 20; left: 0; right: 0; bottom: 0; padding: 12px 20px calc(16px + var(--k-safe-bottom)); background: var(--k-bg); border-top: 1px solid var(--k-line); }
.cp-footer__hint { display: block; margin-bottom: 10px; text-align: center; color: var(--k-muted); font-size: 12px; line-height: 1.6; overflow-wrap: anywhere; }
.cp-state { padding: 60px 16px; display: flex; flex-direction: column; align-items: center; gap: 16px; text-align: center; }
.cp-state__title { font-size: 20px; font-weight: 650; }
.cp-state__copy { font-size: 14px; line-height: 1.7; color: var(--k-muted); }
.cp-state :deep(.k-button) { width: 100%; }
@media (max-width: 359px) {
  .cp-main { padding-left: 14px; padding-right: 14px; }
  .cp-title { font-size: 26px; }
  .cp-job { padding: 12px; gap: 11px; }
  .cp-job__cover { flex-basis: 72px; width: 72px; }
  .cp-member { padding: 15px 10px; gap: 7px; }
  .cp-member__profile { gap: 8px; }
  .cp-avatar { flex-basis: 40px; width: 40px; height: 44px; border-radius: 14px; }
  .cp-greet { flex-basis: 72px; padding-left: 6px; padding-right: 6px; }
}
/* 2026-11-17 改版「小而精」：浅灰底 + 白卡（12 圆角、不描边）；大标题收到 20，岗位卡、伙伴行、空状态都收小一档；
   「打个招呼」看上去是 28 高的小胶囊，透明边把可点范围留在 44；刷新、退出同行、查看岗位、底部按钮都照旧。 */
.cp-page { --k-bg: #F7F5F2; background: #F7F5F2; }
.cp-main { padding: 8px 12px calc(150px + var(--k-safe-bottom)); }
.cp-intro { padding: 8px 2px 14px; }
.cp-eyebrow { gap: 5px; font-size: 12px; letter-spacing: 0; }

.cp-title { margin-top: 6px; font-size: 20px; line-height: 28px; font-weight: 700; letter-spacing: 0; }
.cp-intro__copy { margin-top: 4px; font-size: 13px; line-height: 1.6; }
.cp-job { gap: 10px; padding: 10px; border-radius: 12px; background: var(--k-paper); }
.cp-job__cover { flex-basis: 72px; width: 72px; height: 72px; border-radius: 8px; background: #F5F1EB; }
.cp-job__label { font-size: 11px; }
.cp-job__title { margin-top: 2px; font-size: 14px; line-height: 20px; font-weight: 600; }
.cp-job__meta { margin-top: 4px; gap: 3px; font-size: 11px; }

.cp-job__link { margin-top: 4px; font-size: 11px; }
.cp-section-head { margin-top: 16px; }
.cp-section-title { gap: 6px; font-size: 15px; }
.cp-count { padding: 0 5px; border-radius: 4px; background: var(--k-red-soft); font-size: 11px; line-height: 17px; }
/* 「刷新」贴到右边，和上下白卡的右边缘对齐（原来往里缩了十几像素） */
.cp-refresh { min-height: 44px; gap: 3px; margin-right: 0; padding-right: 0; }
.cp-section-note { margin: -6px 0 8px; font-size: 11px; }
.cp-members { border: 0; border-radius: 12px; }
.cp-member { padding: 8px 4px 8px 12px; }
.cp-member--me { background: #FFFBF6; }
.cp-member__profile { gap: 10px; min-height: 44px; }
.cp-avatar { flex-basis: 40px; width: 40px; height: 40px; border-radius: 50%; background: #F5F1EB; }

.cp-member__name { font-size: 14px; font-weight: 600; }
.cp-me { padding: 0 5px; background: var(--k-red-soft); font-size: 11px; line-height: 17px; }
.cp-member__meta { margin-top: 2px; font-size: 11px; }
.cp-greet { flex-basis: 88px; min-height: 44px; padding: 0 4px; border: 8px solid transparent; border-radius: 22px; background: var(--k-paper) padding-box; box-shadow: inset 0 0 0 1px var(--k-red-line); font-size: 12px; font-weight: 500; line-height: 28px; }
.cp-own-state { padding: 0 8px 0 9px; font-size: 12px; }
.cp-empty { padding: 28px 20px; border: 0; border-radius: 12px; }
.cp-empty__icon { width: 56px; height: 56px; margin-bottom: 12px; background: linear-gradient(160deg, #FFF6EA, #FFE7CC); }

.cp-empty__title { font-size: 15px; font-weight: 600; }
.cp-empty__copy { margin-top: 4px; font-size: 13px; line-height: 1.7; }
.cp-privacy { gap: 6px; margin: 12px 2px 0; font-size: 11px; line-height: 1.7; }
.cp-privacy :deep(.k-icon) { margin-top: 2px; }
.cp-membership { margin-top: 12px; padding: 4px 4px 4px 12px; border-top: 0; border-radius: 12px; background: var(--k-paper); }
.cp-membership__copy { margin-top: 2px; font-size: 11px; }
.cp-leave { min-height: 44px; padding: 0 8px; font-size: 12px; }
.cp-footer { padding: 8px 12px calc(10px + var(--k-safe-bottom)); border-top: 0; background: #FFFFFF; }
.cp-footer__hint { margin-bottom: 6px; font-size: 11px; }
.cp-footer :deep(.k-button.is-lg), .cp-state :deep(.k-button.is-lg) { height: 44px; border-radius: 22px; font-size: 15px; }
.cp-footer :deep(.k-button.is-primary:not(.is-disabled)), .cp-state :deep(.k-button.is-primary:not(.is-disabled)) { background: linear-gradient(135deg, #B5814D, #8E5E33); box-shadow: none; }
.cp-state { gap: 12px; padding: 48px 16px; }

.cp-state__title { font-size: 16px; font-weight: 600; }
.cp-state__copy { font-size: 13px; }
@media (max-width: 359px) {
  .cp-main { padding-left: 10px; padding-right: 10px; }
  .cp-member { padding-left: 10px; gap: 6px; }
  .cp-greet { flex-basis: 84px; }
}
/* —— 第二轮精修（11-18）—— */
.cp-job__more { margin-top: 4px; display: flex; align-items: center; gap: 2px; }
.cp-job__more .cp-job__link { margin-top: 0; }
.cp-section-title { font-size: 16px; line-height: 22px; }
/* 空状态：按全站空状态（图标 36 灰、标题 14 / 500、说明 12），不再用渐变圆底 */
.cp-empty { padding: 28px 16px; }
.cp-empty__icon { width: 40px; height: 40px; margin-bottom: 8px; background: transparent; }

.cp-empty__title { font-size: 14px; font-weight: 500; color: var(--k-ink2); }
.cp-empty__copy { margin-top: 4px; font-size: 12px; line-height: 1.6; }
/* 底部操作条：白底 + 顶上一条发丝线 */
.cp-footer::before { content: ''; position: absolute; left: 0; right: 0; top: 0; height: 1px; background: var(--k-line); transform: scaleY(.5); pointer-events: none; }
/* —— 第三轮逐页精修（11-18，r3jobsa）：空状态图标改成 56 的浅棕圆角方块；说明限宽，折行后不再只剩「你。」一个字；岗位卡浅底不描边 —— */
.cp-empty { padding: 32px 24px; border: 0; border-radius: 12px; }
.cp-empty__icon { width: 56px; height: 56px; margin-bottom: 12px; border-radius: 16px; background: var(--k-red-soft); }
.cp-empty__title { font-size: 15px; font-weight: 600; }
.cp-empty__copy { max-width: 236px; margin: 6px auto 0; font-size: 13px; line-height: 1.7; }
.cp-state__icon { width: 56px; height: 56px; border-radius: 16px; background: var(--k-red-soft); display: flex; align-items: center; justify-content: center; }
/* 第三轮返修第 4 轮：页头说明到岗位卡 16、岗位卡到「一起去的伙伴」24；空状态标题 15 / 600（和本组其它空状态一样） */
.cp-intro { padding-bottom: 16px; }
.cp-job + .cp-section-head, .cp-section-head { margin-top: 24px; }
.cp-empty .cp-empty__title { font-size: 15px; font-weight: 600; line-height: 22px; }
/* 2026-11-18 第三轮返修第 5 轮：眉标、大标题、说明、隐私说明的左右内边距归零，和岗位卡、区块标题同一条 12 的左线 */
.cp-intro { padding-left: 0; padding-right: 0; }
.cp-privacy { margin-left: 0; margin-right: 0; }
/* 2026-11-18 第四轮：「0 位」退成 13 号灰字紧跟标题；岗位卡到「一起去的伙伴」24；隐私说明贴近空状态卡（12） */
.cp-count { padding: 0; border-radius: 0; background: transparent; color: var(--k-muted); font-size: 13px; font-weight: 400; line-height: 22px; }
.cp-section-title { gap: 6px; }
.cp-job { margin-bottom: 0; }
.cp-privacy { margin-top: 12px; }
.cp-section-head { margin-top: 24px; } /* 11-19 返修：岗位卡到「一起去的伙伴」和别的区块一样 24 */
</style>
