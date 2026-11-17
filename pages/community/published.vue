<template>
  <k-community-gate>
  <view class="k-page done-page">
    <k-topbar title="发布结果" back />
    <view class="done-body">
      <view v-if="ready" class="done-card">
        <view class="done-badge"><k-icon :name="status === 'online' || status === 'pending' ? 'check' : 'info'" :size="32" color="green" :stroke="1.8" /></view>
        <text class="done-title">{{ text.title }}</text>
        <view v-if="status === 'online' || status === 'pending'" class="done-status" :class="{ 'done-status--wait': !online }"><k-icon :name="online ? 'globe' : 'clock'" :size="13" :color="online ? 'green' : 'red'" :stroke="1.7" /><text>{{ online ? '已公开' : '等待审核' }}</text></view>
        <text class="done-sub">{{ text.sub }}</text>
        <!-- 关联了 小院 / 门店、岗位 或 活动：写明「已关联到：XXX」，点了直接打开；没关联就不显示 -->
        <view v-if="link" class="done-link" hover-class="k-press-s" @click="openLink">
          <image v-if="link.cover" class="done-link__img" :src="absUrl(link.cover)" mode="aspectFill" />
          <view v-else class="done-link__img done-link__img--empty"><k-icon name="link" :size="18" color="red" :stroke="1.9" /></view>
          <view class="done-link__copy"><text class="done-link__label">已关联到</text><text class="done-link__title">{{ displayWording(link.title) }}</text><text class="done-link__meta">{{ [link.label, link.city].filter(Boolean).join(' · ') }}</text></view>
          <k-icon name="chevron-right" :size="16" color="muted" />
        </view>
        <!-- 找搭子同时发起了活动：给个入口（活动也要审核，通过后开始报名） -->
        <view v-if="activityId" class="done-act" hover-class="k-press" @click="openActivity"><k-icon name="calendar-days" :size="16" color="green" :stroke="1.8" /><text class="done-act__text">同时发起了活动，查看详情</text><k-icon name="chevron-right" :size="14" color="muted" /></view>
      </view>
      <view v-else class="done-state"><k-icon :name="loadFailed ? 'refresh-cw' : 'file-check'" :size="32" color="muted" /><text class="done-state__title">{{ !postId ? '请从发布页面进入' : loadFailed ? '发布结果暂时没加载出来' : '正在确认发布结果…' }}</text><text v-if="loadFailed" class="done-state__sub">可重新加载，或到「我的发布」查看</text><view v-if="loadFailed" class="done-btn" hover-class="k-press" @click="loadResult"><text>重新加载</text></view><view v-if="loadFailed || !postId" class="done-state__link" hover-class="k-press" @click="go(R.myPosts)"><text>我的发布</text><k-icon name="chevron-right" :size="14" color="red" /></view></view>
      <view v-if="ready" class="done-actions">
        <view class="done-btn done-btn--main" hover-class="k-press-s" @click="viewPost"><text>查看帖子</text></view>
        <view class="done-btn" hover-class="k-press" @click="again"><text>继续发布</text></view>
        <view class="done-return" hover-class="k-press" @click="toCommunity"><text>回社区</text><k-icon name="chevron-right" :size="14" color="muted" /></view>
      </view>
    </view>
  </view>

  </k-community-gate>
</template>

<script setup>
import { displayWording } from '@/common/display-wording.js'
// ---------------------------------------------------------------------------
// 发布成功页（2026-10-17 发布页改版，对照主人样稿 图 3）：发布页发出去以后换成这一页（redirectTo，返回回到进发布页之前的页面）。
//   已上线：「发布成功」；先审后发：「发布成功，等待审核」（10-19 复查，之前是「已提交，审核通过后展示」）；关联了对象：「已关联到：XXX」（点了打开）；
//   按钮：查看帖子（审核中的自己也看得到）/ 继续发布（再开一张空白发布页）/ 回社区。
//   之前发完直接换成「我的发布」顶上一条「内容已提交」，看不出发出去了没有、关联上没有。
// 结果先由发布页记在 post-link.js（不把标题塞进地址栏）；页面被重建取不到时按 postId 再查一次帖子。新页面放在 community 分包里。
// ---------------------------------------------------------------------------
import { ref, computed } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { apiPost } from '@/common/api.js'
import { go, replace, relaunch } from '@/common/screen.js'
import { absUrl } from '@/common/upload.js'
import R from '@/common/routes.js'
import { publishedOf, publishedText, linkView } from './post-link.js'

const postId = ref(0)
const status = ref('pending')
const link = ref(null)
const activityId = ref(0)
const ready = ref(false)
const loadFailed = ref(false)
let loading = false
const online = computed(() => status.value === 'online')
const text = computed(() => publishedText(status.value))
onLoad(async (q) => {
  const id = Number(q && q.postId)
  postId.value = Number.isSafeInteger(id) && id > 0 ? id : 0
  const mem = publishedOf(postId.value)
  if (mem) {
    status.value = mem.status
    link.value = mem.link
    activityId.value = Number(mem.activityId) || 0
    ready.value = true
    return
  }
  await loadResult()
})
async function loadResult() {
  if (!postId.value || loading) return
  loading = true
  loadFailed.value = false
  try {
    const d = (await apiPost(postId.value)).data || {}
    if (!d.status || Number(d.postId) !== postId.value) throw new Error('Invalid publish result')
    status.value = d.status
    link.value = linkView(d.link)
    activityId.value = Number(d.activityId) || 0
    ready.value = true
  } catch (e) { loadFailed.value = true }
  finally { loading = false }
}
// 查看帖子：进社区的帖子详情，返回回到这一页（from=mine）
const viewPost = () => (postId.value ? go(R.community + '?postId=' + postId.value + '&from=mine') : go(R.myPosts))
const again = () => replace(R.publish + '?fresh=1')
const toCommunity = () => relaunch(R.community)
const openLink = () => { if (link.value && link.value.to) go(link.value.to) }
const openActivity = () => go(R.activity + '?id=' + activityId.value + '&channel=community')
</script>

<style scoped lang="scss">
.done-page { background: var(--k-bg); }
.done-body { padding: 32px 24px calc(32px + var(--k-safe-bottom)); }
.done-card { display: flex; flex-direction: column; align-items: center; text-align: center; }
.done-badge { width: 72px; height: 72px; border-radius: 50%; background: var(--k-green-soft); display: flex; align-items: center; justify-content: center; }
.done-title { margin-top: 20px; font-size: 26px; font-weight: 600; line-height: 1.4; color: var(--k-ink); }
.done-status { display: flex; align-items: center; gap: 5px; margin-top: 10px; font-size: 13px; color: var(--k-green); }
.done-status--wait { color: var(--k-red-deep); }
.done-sub { max-width: 280px; margin-top: 14px; font-size: 14px; line-height: 1.8; color: var(--k-muted); }
.done-link { align-self: stretch; margin-top: 32px; padding: 16px; border-radius: 16px; background: var(--k-paper); display: flex; align-items: center; gap: 12px; text-align: left; }
.done-link__img { flex: 0 0 auto; width: 58px; height: 68px; border-radius: 10px; background: var(--k-paper2); }
.done-link__img--empty { display: flex; align-items: center; justify-content: center; }
.done-link__copy { min-width: 0; flex: 1; display: flex; flex-direction: column; gap: 4px; }
.done-link__label { font-size: 12px; color: var(--k-muted); }
.done-link__title { font-size: 16px; font-weight: 600; line-height: 1.5; color: var(--k-ink); display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 3; overflow: hidden; word-break: break-all; }
.done-link__meta { font-size: 12px; color: var(--k-muted); line-height: 1.5; }
.done-act { align-self: stretch; margin-top: 12px; min-height: 48px; display: flex; align-items: center; gap: 8px; font-size: 14px; color: var(--k-ink2); text-align: left; }
.done-act__text { min-width: 0; flex: 1; }
.done-actions { margin-top: 32px; display: flex; flex-direction: column; gap: 12px; }
.done-btn { min-height: 48px; padding: 0 20px; border: 1px solid var(--k-line2); border-radius: 14px; background: transparent; color: var(--k-red-deep); font-size: 15px; font-weight: 500; display: flex; align-items: center; justify-content: center; }
.done-btn--main { border-color: var(--k-red); background: var(--k-red); color: var(--k-paper); font-weight: 600; }
.done-return, .done-state__link { min-height: 48px; display: flex; align-items: center; justify-content: center; gap: 4px; color: var(--k-muted); font-size: 14px; }
.done-state { padding-top: 48px; display: flex; flex-direction: column; align-items: center; gap: 16px; text-align: center; }
.done-state__title { font-size: 18px; line-height: 1.6; font-weight: 600; color: var(--k-ink); }
.done-state__sub { font-size: 14px; color: var(--k-muted); }
</style>
