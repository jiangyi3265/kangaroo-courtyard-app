<template>
  <view class="k-page notice-page" :class="$userSurface">
    <template v-if="s === 1">
      <k-topbar title="公告" back />
      <view class="notice-body k-pad-safe">
        <text v-if="loading" class="notice-state">正在加载公告…</text>
        <view v-else-if="loadError" class="notice-state"><text>{{ loadError }}</text><k-button type="secondary" size="sm" label="重新加载" @click="loadList" /></view>
        <view v-else-if="!list.length" class="notice-empty">
          <view class="notice-empty__ico"><k-icon name="bell" :size="32" color="red" /></view>
          <text class="notice-empty__title">暂时没有公告</text>
          <text class="notice-empty__copy">平台有新的通知、须知会发在这里。</text>
        </view>
        <view v-if="list.length" class="notice-list"><view v-for="item in list" :key="item.noticeId" class="notice-row" hover-class="k-press" @click="openItem(item)">
          <view class="notice-row__main">
            <view class="notice-row__head"><text class="notice-row__title">{{ item.title }}</text><text v-if="!isRead(item)" class="notice-row__badge">1</text></view>
            <text class="notice-row__summary">{{ item.summary }}</text><text class="notice-row__date">{{ item.date }}</text>
          </view>
          <k-icon name="chevron-right" :size="12" color="muted" />
        </view></view>
      </view>
    </template>

    <template v-else>
      <k-topbar title="公告详情" back custom-back @back="backFromDetail" />
      <view class="notice-body k-pad-safe">
        <text v-if="detailLoading" class="notice-state">正在加载…</text>
        <view v-else-if="detailError" class="notice-empty">
          <view class="notice-empty__ico"><k-icon name="info" :size="28" color="red" /></view>
          <text class="notice-empty__title">{{ detailError }}</text>
          <k-button v-if="!detailUnavailable" type="secondary" size="sm" label="重新加载" @click="reloadCurrent" />
          <k-button type="secondary" size="sm" label="返回" @click="backFromDetail" />
        </view>
        <view v-else-if="detail" class="notice-detail">
          <text class="notice-detail__title">{{ detail.title }}</text>
          <text class="notice-detail__date">{{ detail.date ? '更新于 ' + detail.date : '' }}</text>
          <view class="notice-detail__line" />
          <text class="notice-detail__content">{{ detail.content }}</text>
        </view>
        <notice-replies v-if="replyNoticeId" :key="replyNoticeId" :notice-id="replyNoticeId" :active="pageActive && s === 2" :notice-available="!detailUnavailable" />
      </view>
    </template>
  </view>
</template>

<script setup>
// ---------------------------------------------------------------------------
// 小程序公告（运营在后台「用户服务 → 小程序公告」编辑）：
//   s=1 全部公告：消息页「公告」卡片点「全部」进来；没看过当前版本的标小红点
//   s=2 公告详情：?id=编号 或 ?key=固定标识（任务页的「线上兼职须知」用 key=online-guide）；
//       打开就算看过（本机记一笔，登录的人同时上报），之后进小程序不会再弹这一版
// 公告是公开内容，游客也能看。
// ---------------------------------------------------------------------------
import { ref, watch } from 'vue'
import { onPullDownRefresh, onShow, onHide, onUnload } from '@dcloudio/uni-app'
import NoticeReplies from './components/notice-replies.vue'
import { useScreen, back } from '@/common/screen.js'
import { apiNotices, apiNoticeDetail } from '@/common/api.js'
import { experience, ensureSession } from '@/common/experience.js'
import { readSeenNotices, markNoticeSeen } from '@/common/notice.js'
import { errText } from '@/common/ui.js'

let landing = 1
const pageActive = ref(true)
const replyNoticeId = ref(null)
let detailTarget = '', detailRequest = 0, listRequest = 0
const s = useScreen(2, {
  onLoad: (q) => {
    const target = String(q.id || q.key || '').trim()
    if (target) {
      s.value = 2
      landing = 2
      loadDetail(target)
    } else {
      s.value = 1
      landing = 1
      loadList()
    }
  }
})

// ---------------- s=1 列表 ----------------
const list = ref([])
const loading = ref(false)
const loadError = ref('')
const localSeen = ref({})
async function loadList() {
  const request = ++listRequest
  const current = () => request === listRequest && pageActive.value && s.value === 1
  loading.value = true
  loadError.value = ''
  try {
    await ensureSession()
    if (!current()) return
    const result = await apiNotices()
    if (!current()) return
    localSeen.value = readSeenNotices()
    list.value = result.data || []
  } catch (e) {
    if (!current()) return
    list.value = []
    loadError.value = errText(e, '公告加载失败，请重试')
  } finally {
    if (current()) loading.value = false
  }
}
// 服务器记的已读（登录的人）或本机记的已读（游客）任一份覆盖当前版本就算看过
const isRead = (item) => item.read || (Number(localSeen.value[String(item.noticeId)]) || 0) >= (Number(item.version) || 1)
const reloadCurrent = () => s.value === 1 ? loadList() : loadDetail(detailTarget)
onPullDownRefresh(() => reloadCurrent().finally(() => uni.stopPullDownRefresh()))
const openItem = (item) => {
  listRequest++
  s.value = 2
  loadDetail(String(item.noticeId))
}

// ---------------- s=2 详情 ----------------
const detail = ref(null)
const detailLoading = ref(false)
const detailError = ref('')
const detailUnavailable = ref(false)
async function loadDetail(target) {
  if (!target) return
  if (target !== detailTarget) {
    detailTarget = target
    detail.value = null
    replyNoticeId.value = null
    detailUnavailable.value = false
  }
  const request = ++detailRequest
  const current = () => request === detailRequest && pageActive.value && s.value === 2
  detailLoading.value = true
  detailError.value = ''
  try {
    await ensureSession()
    if (!current()) return
    const d = (await apiNoticeDetail(target)).data
    if (!current()) return
    detail.value = d || null
    detailUnavailable.value = !d
    if (!d) {
      if (/^[0-9]+$/.test(target)) replyNoticeId.value = target
      detailError.value = '这条公告已下线或不存在'
      return
    }
    replyNoticeId.value = String(d.noticeId)
    // 打开详情就算看过这一版：本机记下，登录的人同时上报（失败不影响阅读）
    markNoticeSeen(d)
  } catch (e) {
    if (!current()) return
    detailUnavailable.value = e?.code === 404
    if (detailUnavailable.value) {
      detail.value = null
      if (/^[0-9]+$/.test(target)) replyNoticeId.value = target
    }
    detailError.value = detailUnavailable.value ? '这条公告已下线或不存在' : errText(e, '公告加载失败，请稍后再试')
  } finally {
    if (current()) detailLoading.value = false
  }
}
// 直接打开某一条（任务页的须知、消息页的公告）返回原页面；从列表点进来的回到列表并刷新已读小红点
const backFromDetail = () => {
  detailRequest++
  if (landing === 2) return back()
  s.value = 1
  loadList()
}
const leavePage = () => {
  pageActive.value = false
  listRequest++
  detailRequest++
}
onHide(leavePage)
onUnload(leavePage)
onShow(() => {
  if (pageActive.value) return
  pageActive.value = true
  reloadCurrent()
})
watch(() => experience.account?.id, () => {
  listRequest++
  detailRequest++
  list.value = []
  localSeen.value = {}
  if (pageActive.value) reloadCurrent()
})
</script>

<style scoped lang="scss">
/* 2026-11-17 改版「小而精」：浅灰底 + 白卡（12 圆角、不描边不加阴影）。公告、未读红点、联系管理员都在。
   11-18 第三轮：页边距 16、卡内 14；公告行标题 15 / 600、摘要两行收尾、日期等宽；空状态是 56 浅棕圆角方块 + 32 线性图标；详情标题 20 / 700、正文 15 / 1.75。 */
.notice-page { --k-bg: var(--k-page); background: var(--k-page); }
.notice-page :deep(.k-navbar__title) { font-family: var(--k-sans); font-size: 17px; font-weight: 600; }
.notice-body { padding: 12px 16px 32px; }
.notice-state { display: flex; flex-direction: column; align-items: center; gap: 12px; padding: 64px 0; color: var(--k-muted); font-size: 13px; text-align: center; }
/* 11-18 第四轮：整页只剩空 / 错状态时不套卡，落在屏高约 1/4 处 */
.notice-empty { display: flex; flex-direction: column; align-items: center; gap: 4px; padding: 112px 16px 0; text-align: center; }
.notice-empty__ico { width: 64px; height: 64px; margin-bottom: 8px; border-radius: 18px; background: var(--k-red-soft); display: flex; align-items: center; justify-content: center; }
.notice-empty__title { font-family: var(--k-sans); font-size: 15px; font-weight: 600; color: var(--k-ink); }
.notice-empty__copy { max-width: 260px; color: var(--k-muted); font-size: 13px; line-height: 1.6; }
.notice-empty :deep(.k-button) { margin-top: 12px; }
.notice-list { border-radius: 12px; background: var(--k-paper); overflow: hidden; }
.notice-row { position: relative; padding: 16px 8px 16px 16px; display: flex; align-items: center; gap: 8px; }
.notice-row + .notice-row::before { content: ''; position: absolute; left: 16px; right: 16px; top: 0; height: 1px; background: var(--k-line); transform: scaleY(.5); }
.notice-row__main { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 4px; }
.notice-row__head { display: flex; align-items: flex-start; gap: 6px; }
.notice-row__title { min-width: 0; font-family: var(--k-sans); font-size: 15px; font-weight: 600; line-height: 22px; color: var(--k-ink); word-break: break-all; }
.notice-row__dot { width: 6px; height: 6px; margin-top: 8px; border-radius: 50%; background: var(--k-alert); flex: 0 0 auto; }
.notice-row__summary { font-size: 13px; line-height: 1.6; color: var(--k-muted); word-break: break-all; }
.notice-row__date { font-size: 11px; line-height: 16px; color: var(--k-muted); font-variant-numeric: tabular-nums; }
.notice-detail { padding: 20px 16px; border: 0; border-radius: 12px; background: var(--k-paper); }
.notice-detail__title { display: block; font-family: var(--k-sans); font-size: 20px; font-weight: 700; line-height: 1.4; color: var(--k-ink); }
.notice-detail__date { display: block; margin-top: 6px; font-size: 12px; color: var(--k-muted); font-variant-numeric: tabular-nums; }
.notice-detail__line { height: 1px; margin: 16px 0; background: var(--k-line); transform: scaleY(.5); }
.notice-detail__content { display: block; font-size: 15px; line-height: 1.75; color: var(--k-ink2); white-space: pre-wrap; word-break: break-all; }
.notice-row__badge{min-width:16px;padding:0 4px;box-sizing:border-box;border-radius:12px;background:var(--k-alert);color:white;text-align:center;font:600 11px/16px var(--k-sans)}
</style>
