<template>
  <k-community-gate>
  <view class="k-page done-page" :class="$userSurface">
    <k-topbar title="发布结果" back />
    <view class="done-body">
      <view v-if="ready" class="done-card">
        <view class="done-badge"><k-icon :name="status === 'online' || status === 'pending' ? 'check' : 'info'" :size="32" color="green" /></view>
        <text class="done-title">{{ text.title }}</text>
        <view v-if="status === 'online' || status === 'pending'" class="done-status" :class="{ 'done-status--wait': !online }"><k-icon :name="online ? 'globe' : 'clock'" :size="14" :color="online ? 'green' : 'red'" /><text>{{ online ? '已公开' : '等待审核' }}</text></view>
        <text class="done-sub">{{ text.sub }}</text>
        <!-- 关联了 小院 / 门店、岗位 或 活动：写明「已关联到：XXX」，点了直接打开；没关联就不显示 -->
        <view v-if="link" class="done-link" hover-class="k-press-s" @click="openLink">
          <image v-if="link.cover" class="done-link__img" :src="absUrl(link.cover)" mode="aspectFill" />
          <view v-else class="done-link__img done-link__img--empty"><k-icon name="link" :size="18" color="red" /></view>
          <view class="done-link__copy"><text class="done-link__label">已关联到</text><text class="done-link__title">{{ displayWording(link.title) }}</text><text class="done-link__meta">{{ [link.label, link.city].filter(Boolean).join(' · ') }}</text></view>
          <k-icon name="chevron-right" :size="16" color="muted" />
        </view>
        <!-- 找搭子同时发起了活动：给个入口（活动也要审核，通过后开始报名） -->
        <view v-if="activityId" class="done-act" hover-class="k-press" @click="openActivity"><k-icon name="calendar-days" :size="16" color="green" /><text class="done-act__text">同时发起了活动，查看详情</text><k-icon name="chevron-right" :size="14" color="muted" /></view>
      </view>
      <view v-else class="done-state"><view class="empty-ico"><k-icon :name="loadFailed ? 'refresh-cw' : 'file-check'" :size="32" color="red" /></view><text class="done-state__title">{{ !postId ? '请从发布页面进入' : loadFailed ? '发布结果暂时没加载出来' : '正在确认发布结果…' }}</text><text v-if="loadFailed" class="done-state__sub">可重新加载，或到「我的发布」查看</text><view v-if="loadFailed" class="done-btn" hover-class="k-press" @click="loadResult"><text>重新加载</text></view><view v-if="loadFailed || !postId" class="done-state__link" hover-class="k-press" @click="go(R.myPosts)"><text>我的发布</text><k-icon name="chevron-right" :size="14" color="muted" /></view></view>
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

/* 2026-11-17 改版「小而精」（主人按样张第三版拍板）：浅灰底、白卡圆角 12、按钮是 42 高的胶囊（主按钮暖棕渐变）。
   功能和文字不变：审核状态、已关联到、同时发起的活动、查看帖子 / 继续发布 / 回社区、重新加载、我的发布都在。 */
.k-page.done-page {
  --k-bg: var(--k-page); --k-paper2: var(--k-fill); /* 本组暖米填充，只在根上定义一次 */
  background: var(--k-page);
  :deep(.k-topbar) { background: var(--k-page); }
  :deep(.k-navbar__title) { font-family: var(--k-sans); font-size: 16px; font-weight: 600; }
  .done-body { padding: 28px 16px calc(32px + var(--k-safe-bottom)); }
  .done-badge { width: 60px; height: 60px; }
  .done-title { margin-top: 14px; font-size: 19px; font-weight: 700; }
  .done-status { margin-top: 6px; font-size: 12px; }
  .done-sub { margin-top: 10px; font-size: 13px; line-height: 1.7; }
  .done-link { margin-top: 20px; padding: 10px; gap: 10px; border-radius: 12px; }
  .done-link__img { width: 52px; height: 52px; border-radius: 8px; }
  .done-link__copy { gap: 2px; }
  .done-link__label { font-size: 11px; }
  .done-link__title { font-size: 14px; line-height: 20px; }
  .done-link__meta { font-size: 11px; }
  .done-act { min-height: 44px; margin-top: 8px; padding: 0 12px; border-radius: 12px; background: var(--k-paper); font-size: 13px; }
  .done-actions { gap: 10px; margin-top: 24px; }
  /* 主按钮 / 次按钮：44 高、圆角 22 */
  .done-btn { min-height: 44px; border-color: var(--k-red-line); border-radius: 22px; background: var(--k-paper); font-size: 15px; }
  .done-btn--main { border-color: transparent; background: linear-gradient(135deg, #B5814D, #8E5E33); color: #fff; font-size: 15px; }
  .done-return, .done-state__link { min-height: 44px; font-size: 12px; }
  /* 没加载出来 / 正在确认：白卡内居中，图标 36 浅灰、标题 14 / 500 二级墨、说明 12 浅灰，上下留白 28；
     「重新加载」是次按钮小胶囊：看上去 32 高，外面 2 的透明边把可点高度留在 36 */
  .done-state { gap: 6px; padding: 28px 16px; border-radius: 12px; background: var(--k-paper); }
  .done-state__title { font-size: 14px; font-weight: 500; color: var(--k-ink2); }
  .done-state__sub { font-size: 12px; line-height: 1.6; }
  .done-state .done-btn { min-height: 36px; margin-top: 6px; padding: 0 16px; border: 2px solid transparent; border-radius: 18px; background: #fff padding-box; box-shadow: inset 0 0 0 1px var(--k-red-line); font-size: 12px; font-weight: 500; }
  .done-state .done-state__link { min-height: 36px; }
}
</style>

<style scoped lang="scss">
/* 11-18 第三轮精修：页边距统一 12；没内容时的图标放进 56 的浅棕方块 */
.k-page.done-page {
  .done-body { padding-left: 12px; padding-right: 12px; }
  .empty-ico { width: 56px; height: 56px; margin-bottom: 4px; display: flex; align-items: center; justify-content: center; border-radius: 16px; background: var(--k-red-soft); }
  .done-state { padding: 32px 16px; }
}
</style>

<style scoped lang="scss">
/* 11-18 返修第 5 轮：兜底卡离顶栏 12（页面上边距 28 是给成功画面用的） */
.k-page.done-page {
  .done-state { margin-top: -16px; }
}
</style>
<style scoped lang="scss">
/* 11-18 夜 第四轮精修：整页只剩一个提示时不套白卡，下移到约屏高 1/4；「我的发布」做成 12/500 暖棕文字钮 */
.k-page.done-page {
  .done-state { margin-top: 84px; padding: 0 16px; border-radius: 0; background: transparent; }
  .done-state .empty-ico { margin-bottom: 6px; }
  .done-state__title { color: var(--k-ink); }
  .done-state .done-state__link { min-height: 32px; margin-top: 10px; color: var(--k-red); font-size: 12px; font-weight: 500; }
}
</style>
<style scoped lang="scss">
/* 11-19 第四轮返修：和须知、签到码、个人主页出错块同一高度（本页上边距多 16，这里减掉） */
.k-page.done-page { .done-state { margin-top: 68px; } }
</style>
