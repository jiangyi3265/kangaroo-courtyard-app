<template>
  <view class="k-page notice-page">
    <template v-if="s === 1">
      <k-topbar title="公告" back />
      <view class="notice-body k-pad-safe">
        <text v-if="loading" class="notice-state">正在加载公告…</text>
        <view v-else-if="loadError" class="notice-state"><text>{{ loadError }}</text><k-button type="outline" size="sm" label="重新加载" @click="loadList" /></view>
        <view v-else-if="!list.length" class="notice-empty">
          <k-icon name="bell" :size="40" color="muted" />
          <text class="notice-empty__title">暂时没有公告</text>
          <text class="notice-empty__copy">平台有新的通知、须知会发在这里。</text>
        </view>
        <view v-for="item in list" :key="item.noticeId" class="notice-row" hover-class="k-press" @click="openItem(item)">
          <view class="notice-row__main">
            <view class="notice-row__head"><text class="notice-row__title">{{ item.title }}</text><text v-if="!isRead(item)" class="notice-row__dot" /></view>
            <text class="notice-row__summary">{{ item.summary }}</text>
            <text class="notice-row__date">{{ item.date }}</text>
          </view>
          <k-icon name="chevron-right" :size="18" color="muted" />
        </view>
      </view>
    </template>

    <template v-else>
      <k-topbar title="公告详情" back custom-back @back="backFromDetail" />
      <view class="notice-body k-pad-safe">
        <text v-if="detailLoading" class="notice-state">正在加载…</text>
        <view v-else-if="detailError" class="notice-empty">
          <k-icon name="info" :size="40" color="muted" />
          <text class="notice-empty__title">{{ detailError }}</text>
          <k-button type="outline" size="sm" label="返回" @click="backFromDetail" />
        </view>
        <view v-else-if="detail" class="notice-detail">
          <text class="notice-detail__title">{{ detail.title }}</text>
          <text class="notice-detail__date">{{ detail.date ? '更新于 ' + detail.date : '' }}</text>
          <view class="notice-detail__line" />
          <text class="notice-detail__content">{{ detail.content }}</text>
        </view>
        <notice-replies v-if="replyNoticeId" :key="replyNoticeId" :notice-id="replyNoticeId" :active="pageActive && s === 2" :notice-available="!!detail" />
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
import { ref } from 'vue'
import { onPullDownRefresh, onShow, onHide } from '@dcloudio/uni-app'
import NoticeReplies from './components/notice-replies.vue'
import { useScreen, back } from '@/common/screen.js'
import { apiNotices, apiNoticeDetail } from '@/common/api.js'
import { ensureSession } from '@/common/experience.js'
import { readSeenNotices, markNoticeSeen } from '@/common/notice.js'
import { errText } from '@/common/ui.js'

let landing = 1
const pageActive = ref(true)
const replyNoticeId = ref(null)
onShow(() => { pageActive.value = true })
onHide(() => { pageActive.value = false })
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
  loading.value = true
  loadError.value = ''
  try {
    await ensureSession()
    localSeen.value = readSeenNotices()
    list.value = (await apiNotices()).data || []
  } catch (e) {
    list.value = []
    loadError.value = errText(e, '公告加载失败，请重试')
  } finally {
    loading.value = false
  }
}
// 服务器记的已读（登录的人）或本机记的已读（游客）任一份覆盖当前版本就算看过
const isRead = (item) => item.read || (Number(localSeen.value[String(item.noticeId)]) || 0) >= (Number(item.version) || 1)
onPullDownRefresh(() => {
  const job = s.value === 1 ? loadList() : (detail.value ? loadDetail(String(detail.value.noticeId)) : Promise.resolve())
  job.finally(() => uni.stopPullDownRefresh())
})
const openItem = (item) => {
  s.value = 2
  loadDetail(String(item.noticeId))
}

// ---------------- s=2 详情 ----------------
const detail = ref(null)
const detailLoading = ref(false)
const detailError = ref('')
let detailRequest = 0
async function loadDetail(target) {
  const request = ++detailRequest
  detailLoading.value = true
  detailError.value = ''
  detail.value = null
  replyNoticeId.value = null
  try {
    await ensureSession()
    if (request !== detailRequest) return
    if (/^[0-9]+$/.test(target)) replyNoticeId.value = target
    const d = (await apiNoticeDetail(target)).data
    if (request !== detailRequest) return
    detail.value = d || null
    if (d) replyNoticeId.value = d.noticeId
    if (!d) {
      detailError.value = '这条公告已下线或不存在'
      return
    }
    // 打开详情就算看过这一版：本机记下，登录的人同时上报（失败不影响阅读）
    markNoticeSeen(d)
  } catch (e) {
    if (request !== detailRequest) return
    detailError.value = e && e.code === 404 ? '这条公告已下线或不存在' : errText(e, '公告加载失败，请稍后再试')
  } finally {
    if (request === detailRequest) detailLoading.value = false
  }
}
// 直接打开某一条（任务页的须知、消息页的公告）返回原页面；从列表点进来的回到列表并刷新已读小红点
const backFromDetail = () => {
  if (landing === 2) return back()
  s.value = 1
  loadList()
}
</script>

<style scoped lang="scss">
.notice-page { background: var(--k-bg); }
.notice-body { padding: 10px 16px 32px; }
.notice-state { display: flex; flex-direction: column; align-items: center; gap: 12px; padding: 48px 0; color: var(--k-muted); font-size: 14px; text-align: center; }
.notice-empty { display: flex; flex-direction: column; align-items: center; gap: 12px; padding: 64px 16px; text-align: center; }
.notice-empty__title { font-family: var(--k-serif); font-size: 17px; font-weight: 700; color: var(--k-ink); }
.notice-empty__copy { color: var(--k-muted); font-size: 14px; line-height: 1.7; }
.notice-row { margin-bottom: 9px; padding: 13px 12px; border: 1px solid var(--k-line2); border-radius: 10px; background: var(--k-paper); display: flex; align-items: center; gap: 10px; }
.notice-row__main { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 6px; }
.notice-row__head { display: flex; align-items: center; gap: 6px; }
.notice-row__title { min-width: 0; font-family: var(--k-serif); font-size: 16px; font-weight: 700; color: var(--k-ink); }
.notice-row__dot { width: 7px; height: 7px; border-radius: 50%; background: var(--k-alert); flex: 0 0 auto; }
.notice-row__summary { font-size: 13px; line-height: 1.6; color: var(--k-muted); }
.notice-row__date { font-size: 11px; color: var(--k-light); }
.notice-detail { padding: 16px 14px 20px; border: 1px solid var(--k-line2); border-radius: 12px; background: var(--k-paper); }
.notice-detail__title { display: block; font-family: var(--k-serif); font-size: 20px; font-weight: 700; line-height: 1.45; color: var(--k-ink); }
.notice-detail__date { display: block; margin-top: 6px; font-size: 12px; color: var(--k-muted); }
.notice-detail__line { height: 1px; margin: 14px 0; background: var(--k-line); }
.notice-detail__content { display: block; font-size: 15px; line-height: 1.85; color: var(--k-ink); white-space: pre-wrap; word-break: break-all; }
</style>
