<template>
  <k-community-gate>
  <view class="k-page my-posts-page" :class="$userSurface">
    <post-editor v-if="editingId" :post-id="editingId" @close="editingId = 0" @saved="finishEdit" />
    <k-topbar v-if="!editingId" title="我的发布" back />
    <view v-if="!editingId" class="my-posts-body" @touchstart="startSwipe" @touchend="endSwipe" @touchcancel="startPoint = null">
      <view v-if="submittedId" class="publish-receipt"><k-icon name="check-circle-2" :size="22" color="green" /><view><text class="receipt-title">内容已提交</text><text class="receipt-copy">下次可从「我的 → 我的发布」查看。</text></view></view>
      <view class="my-posts-heading">
        <view class="post-tabs">
          <button v-for="tab in postTabs" :key="tab.key" :class="{ selected: activeKind === tab.key }" @click="switchKind(tab.key)">{{ tab.label }}</button>
        </view>
        <button @click="go(activeKind ? R.publish + '?kind=' + activeKind : R.publish)"><k-icon name="plus" :size="14" color="red" />发一条</button>
      </view>
      <text class="my-posts-hint">待审核的内容仅自己可见，通过后会展示在社区。</text>
      <view v-for="post in posts" :key="post.postId" class="my-post-card" :class="{ newest: post.postId === submittedId }">
        <view class="my-post-meta"><text>{{ kindOf(post).label }} · {{ post.city }}{{ post.toneLabel ? ' · 伙伴说：' + post.toneLabel : '' }}</text><text class="post-status" :class="'status-' + post.status">{{ statusLabel(post.status) }}</text></view>
        <!-- 11-18 返修：审核说明挪到状态标签下面，一行 12 号灰字（不再是灰底块） -->
        <view v-if="post.status !== 'online'" class="my-post-notice"><k-icon name="info" :size="12" color="muted" /><text>{{ statusNotice(post) }}</text></view>
        <!-- 标题和社区卡片同一个规则（titleOf）：话题是「其他」时不加「其他｜」前缀，只显示标题 -->
        <text class="my-post-title">{{ displayWording(titleOf(post), [post.author?.name]) }}</text>
        <text class="my-post-content">{{ displayWording(post.content, [post.author?.name]) }}</text>
        <!-- 2026-10-17 关联了 小院 / 门店、岗位 或 活动：多一行「关联：XXX」，点了打开 -->
        <view v-if="linkOf(post)" class="my-post-link" hover-class="k-press" @click="go(linkOf(post).to)"><k-icon name="link" :size="12" color="red" /><text class="my-post-link__tag">{{ linkOf(post).label }}</text><text class="my-post-link__title">关联：{{ displayWording(linkOf(post).title) }}</text><k-icon name="chevron-right" :size="14" color="muted" /></view>
        <view v-if="post.images && post.images.length" class="my-post-images"><image v-for="(src, i) in post.images" :key="i" :src="absUrl(src)" mode="aspectFill" @click="preview(post, i)" /></view>
        <view v-if="post.activity" class="my-post-activity"><text>关联活动 · {{ post.activity.label }}</text><button v-if="post.activity.isMine" @click="go(R.activityMine + '?id=' + post.activity.activityId)">管理活动<k-icon name="chevron-right" :size="12" color="red" /></button></view>
        <view class="my-post-footer"><text>{{ post.dateText }}</text><view class="my-post-actions"><button v-if="post.status !== 'hidden'" class="my-post-edit" :disabled="busy" @click="editingId = post.postId">编辑动态</button><button class="my-post-remove" :disabled="busy" @click="removePost(post)">删除动态</button><button v-if="post.activity?.canCancel" :disabled="busy" @click="cancelActivity(post)">取消活动</button><button v-if="post.status === 'online'" @click="go(R.community + '?postId=' + post.postId + '&from=mine')">查看详情</button></view></view>
      </view>
      <view v-if="error" class="my-posts-state my-posts-state--card"><view class="empty-ico empty-ico--alert"><k-icon name="alert-circle" :size="32" color="alert" /></view><text>{{ error }}</text><k-button type="outline" @click="loadPosts(!posts.length)">重新加载</k-button></view>
      <view v-else-if="loading" class="my-posts-state"><text>正在加载…</text></view>
      <view v-else-if="!posts.length" class="my-posts-state my-posts-state--card"><view class="empty-ico"><k-icon name="file-text" :size="32" color="red" /></view><text class="empty-title">{{ activeKind ? '还没有发布' + kindOf({ kind: activeKind }).label : '还没有发布内容' }}</text><text>发布的内容会在这里保留，方便随时查看。</text><k-button type="secondary" size="sm" @click="go(activeKind ? R.publish + '?kind=' + activeKind : R.publish)">去发布</k-button></view>
      <view v-else-if="hasMore" class="my-posts-state"><button @click="loadPosts(false)">加载更多</button></view>
      <text v-else class="my-posts-end">已显示全部发布内容</text>
    </view>
  </view>

  </k-community-gate>
</template>

<script setup>
import { removeCommunityPost } from './remove-post.js'
import PostEditor from './components/post-editor.vue'
import { ref } from 'vue'
import { onLoad, onShow, onHide, onReachBottom, onPullDownRefresh } from '@dcloudio/uni-app'
import { apiMyPosts, apiPostDelete, apiManageAction } from '@/common/api.js'
import { ensureSession, experience } from '@/common/experience.js'
import { go, toast } from '@/common/screen.js'
import { absUrl } from '@/common/upload.js'
import { errText, confirm, prompt, sheet } from '@/common/ui.js'
import R from '@/common/routes.js'
import { titleOf, kindOf, PUBLISH_KIND, PUBLISH_TYPES } from './community-feed.js'
import { displayWording } from '@/common/display-wording.js'
import { linkView } from './post-link.js'

const posts = ref([]), loading = ref(false), error = ref(''), hasMore = ref(true), submittedId = ref(0)
const editingId = ref(0)
function finishEdit() { editingId.value = 0; loadPosts(true) }
let nextPage = 1
let beforePostId = null
let listOwner = null
let requestNumber = 0
const postTabs = [{ key: '', label: '全部' }, ...PUBLISH_TYPES.map(({ name }) => ({ key: PUBLISH_KIND[name], label: name }))]
const activeKind = ref('')
const startPoint = ref(null)
function switchKind(kind) {
  if (kind === activeKind.value) return
  activeKind.value = kind
  return loadPosts(true)
}
function startSwipe(event) {
  const touch = event.touches?.length === 1 && event.touches[0]
  startPoint.value = touch ? { x: touch.clientX, y: touch.clientY } : null
}
function endSwipe(event) {
  const start = startPoint.value, end = event.changedTouches?.[0]
  startPoint.value = null
  if (!start || !end) return
  const dx = end.clientX - start.x, dy = end.clientY - start.y
  if (Math.abs(dx) < 50 || Math.abs(dx) < Math.abs(dy) * 1.5) return
  const next = postTabs[postTabs.findIndex(tab => tab.key === activeKind.value) + (dx < 0 ? 1 : -1)]
  if (next) return switchKind(next.key)
}
// 关联的对象（服务端 link → 页面用的样子，带跳转地址）；没关联、或对象下线了是 null
const linkOf = (post) => linkView(post && post.link)
const statusLabel = s => ({ pending: '动态待审核', online: '动态已发布', rejected: '动态未通过', hidden: '动态已隐藏' }[s] || '动态未公开')
function statusNotice(post) {
  if (post.status === 'pending') return '社区动态待审核，仅自己可见。' + (post.activity ? '活动的报名状态见下方，两个状态分别显示。' : '通过后其他人可在社区看到。')
  if (post.status === 'rejected') return post.auditReason ? '未通过原因：' + post.auditReason : '内容未通过审核，暂未在社区展示。'
  return post.auditReason ? '隐藏原因：' + post.auditReason : '这条内容目前未在社区展示。'
}
// 之前看大图（微信原生预览会触发本页 onHide / onShow）回来，onShow 把列表重置成第一页、滚动位置也丢了；现在预览回来不重载
// （只认紧跟在打开预览之后的那次隐藏；H5 预览不隐藏页面，之后正常离开再回来仍会刷新）
let previewAt = 0, hiddenByPreview = false
function preview(post, index) { previewAt = Date.now(); uni.previewImage({ current: index, urls: post.images.map(absUrl) }) }
async function loadPosts(reset = false) {
  if (listOwner !== experience.account?.id) reset = true
  if (!reset && (loading.value || !hasMore.value)) return
  const current = ++requestNumber, kind = activeKind.value
  loading.value = true
  error.value = ''
  if (reset) { posts.value = []; nextPage = 1; beforePostId = null; hasMore.value = true }
  try {
    await ensureSession()
    if (current !== requestNumber) return
    if (!experience.account) { posts.value = []; throw new Error('请先登录，再查看自己的发布内容') }
    const owner = experience.account.id
    listOwner = owner
    const page = reset ? 1 : nextPage
    const rows = (await apiMyPosts(page, kind, beforePostId)).data || []
    if (current !== requestNumber) return
    if (experience.account?.id !== owner) { posts.value = []; return }
    if (reset) posts.value = rows
    else {
      const seen = new Set(posts.value.map(x => x.postId))
      posts.value.push(...rows.filter(x => !seen.has(x.postId)))
    }
    nextPage = page + 1
    if (rows.length) beforePostId = rows[rows.length - 1].postId
    hasMore.value = rows.length === 20
  } catch (e) { if (current === requestNumber) error.value = errText(e, '发布记录加载失败，请重试') }
  finally { if (current === requestNumber) { loading.value = false; uni.stopPullDownRefresh() } }
}
// 之前服务端有删除接口（只认本人），页面上却没有任何删除入口，发错的内容删不掉
const busy = ref(false)
async function removePost(post) {
  if (busy.value) return
  busy.value = true
  try {
    if (await removeCommunityPost(post)) {
      posts.value = posts.value.filter(row => row.postId !== post.postId)
      if (!posts.value.length && hasMore.value) await loadPosts(true)
    }
  } finally { busy.value = false }
}
async function cancelActivity(post) {
  const owner = experience.account?.id
  if (busy.value || !owner || !post.activity?.canCancel) return
  busy.value = true
  try {
    if (!(await confirm('取消活动', '取消后不再接受报名，会通知所有报名者。社区动态保留并显示活动已取消。确认继续？'))) return
    const reason = await prompt('取消原因', { placeholder: '原因会发给报名者', maxlength: 200 })
    if (!reason?.trim() || experience.account?.id !== owner) return
    const res = await apiManageAction(post.activity.activityId, 'cancel', { reason: reason.trim() })
    if (experience.account?.id !== owner) return
    toast(res.msg || '活动已取消，已通知报名者')
    await loadPosts(true)
  } catch (e) { toast(errText(e, '取消失败，请重试')) }
  finally { busy.value = false }
}
onLoad(q => { submittedId.value = Number(q?.submitted) || 0 })
onHide(() => { hiddenByPreview = Date.now() - previewAt < 2000 })
onShow(() => { if (editingId.value) return; if (hiddenByPreview) { hiddenByPreview = false; return } loadPosts(true) })
onReachBottom(() => loadPosts(false))
onPullDownRefresh(() => loadPosts(true))
</script>

<style scoped lang="scss">
.my-posts-body { padding: 12px 16px calc(24px + env(safe-area-inset-bottom)); }
.my-posts-page .my-posts-body { min-height: 75vh; }
.k-page.my-posts-page .my-posts-heading .post-tabs { display: flex; flex: 1; flex-wrap: wrap; column-gap: 12px; min-width: 0; }
.k-page.my-posts-page .my-posts-heading .post-tabs button { position: relative; margin: 0; padding: 0; line-height: 36px; min-height: 36px; height: auto; border: 0; background: transparent; color: var(--k-muted); font-size: 13px; }
.k-page.my-posts-page .my-posts-heading .post-tabs button.selected { color: var(--k-red-deep); font-weight: 600; }
.k-page.my-posts-page .my-posts-heading .post-tabs button.selected::before { content: ''; position: absolute; bottom: 1px; left: 25%; width: 50%; height: 2px; border-radius: 2px; background: var(--k-red); }
.publish-receipt { display: flex; align-items: flex-start; gap: 10px; padding: 16px; border-radius: 10px; background: var(--k-green-soft); }
.receipt-title, .receipt-copy { display: block; }
.receipt-title { font-size: 16px; font-family: var(--k-display-font); font-weight: 700; color: var(--k-green); }
.receipt-copy { margin-top: 6px; font-size: 14px; line-height: 1.6; }
.my-posts-heading { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin: 8px 0 0; color: var(--k-muted); font-size: 12px; }
.my-posts-heading button, .my-post-footer button, .my-posts-state button { background: transparent; color: var(--k-red); font-size: 14px; line-height: 48px; padding: 0; margin: 0; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
button::after { border: 0; }
.my-posts-hint { display: block; color: var(--k-muted); font-size: 14px; line-height: 1.6; margin-bottom: 16px; }
.my-post-card { background: var(--k-paper); border: 1px solid var(--k-line); border-radius: 12px; padding: 16px; margin-bottom: 16px; }
.my-post-card.newest { border-color: var(--k-green); }
.my-post-meta { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 8px; font-size: 12px; color: var(--k-muted); }
.post-status { padding: 4px 8px; border-radius: 4px; background: var(--k-bg); }
.status-pending { color: #805725; background: var(--k-ochre-soft); }
.status-online { color: var(--k-green); background: var(--k-green-soft); }
.status-rejected { color: var(--k-alert); } /* 未通过审核是提醒，用提醒红（10-16 起 --k-red 是暖棕主色） */
.my-post-title { display: block; font-family: var(--k-display-font); font-size: 18px; font-weight: 700; margin: 12px 0 8px; line-height: 1.5; overflow-wrap: anywhere; }
.my-post-link { margin-top: 10px; height: 34px; padding: 0 10px; border-radius: 10px; background: #FBF4EA; display: flex; align-items: center; gap: 6px; }
.my-post-link__tag { flex: 0 0 auto; height: 18px; padding: 0 6px; border-radius: 5px; background: var(--k-paper); color: var(--k-red-deep); font-size: 11px; font-weight: 600; line-height: 18px; }
.my-post-link__title { min-width: 0; flex: 1; font-size: 13px; color: var(--k-ink); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.my-post-content { display: block; font-size: 15px; white-space: pre-wrap; overflow-wrap: anywhere; line-height: 1.7; }
.my-post-images { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 12px; }
.my-post-images image { width: calc((100% - 12px) / 3); height: 90px; border-radius: 6px; }
.my-post-notice { margin-top: 14px; padding: 10px; display: flex; align-items: flex-start; gap: 6px; background: var(--k-bg); border-radius: 6px; font-size: 14px; line-height: 1.6; color: var(--k-muted); }
.my-post-notice text { flex: 1; min-width: 0; overflow-wrap: anywhere; }
.my-post-footer { display:flex; flex-direction:column; align-items:stretch; gap:10px; margin-top:16px; color:var(--k-muted); font-size:12px; }
.my-post-footer > text { white-space:nowrap; }
.my-post-actions { min-width:0; display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:10px; }
.my-post-actions button { width:100%; min-width:0; min-height:44px; line-height:1.4; box-sizing:border-box; }
.my-post-activity { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 4px; margin-top: 12px; padding: 8px 10px; background: var(--k-green-soft); border-radius: 6px; color: var(--k-green); font-size: 13px; }
.my-post-activity button { display: flex; align-items: center; background: transparent; color: var(--k-red); padding: 0; margin: 0; font-size: 13px; line-height: 40px; }
.my-post-footer .my-post-edit { background:var(--k-red-soft); border:1px solid var(--k-line2); border-radius:16px; padding:6px 10px; }
.my-post-footer .my-post-remove { color:var(--k-alert);background:var(--k-alert-soft);border:1px solid var(--k-line);border-radius:16px;padding:6px 10px; }.my-post-actions button:active{opacity:.7}
.my-posts-state { display: flex; flex-direction: column; align-items: center; gap: 16px; padding: 32px 12px; font-size: 14px; color: var(--k-muted); text-align: center; line-height: 1.7; }
.empty-title { color: var(--k-ink); font-family: var(--k-display-font); font-size: 18px; font-weight: 700; }
.my-posts-end { display: block; padding: 8px; text-align: center; color: var(--k-muted); font-size: 12px; }

/* 2026-11-17 改版「小而精」（主人按样张第三版拍板）：浅灰底上一条动态一张白卡（圆角 12、不描边），标题 15、正文 13、状态是小标签；
   操作按钮收成 36 高的胶囊。功能和文字不变：发一条、编辑 / 删除动态、取消活动、查看详情、管理活动、关联、看大图、加载更多都在。 */
.k-page.my-posts-page {
  --k-bg: var(--k-page); --k-paper2: var(--k-fill); /* 本组暖米填充，只在根上定义一次 */
  background: var(--k-page);
  :deep(.k-topbar) { background: var(--k-page); }
  :deep(.k-navbar__title) { font-family: var(--k-sans); font-size: 16px; font-weight: 600; }
  .my-posts-body { padding: 8px 12px calc(24px + env(safe-area-inset-bottom)); }
  .publish-receipt { padding: 12px; gap: 8px; border-radius: 12px; }
  .receipt-title { font-family: var(--k-sans); font-size: 14px; font-weight: 600; }
  .receipt-copy { margin-top: 2px; font-size: 12px; }
  .my-posts-heading { margin: 0 2px; }
  .my-posts-heading button { color: var(--k-red-deep); font-size: 13px; line-height: 44px; }
  .my-posts-hint { margin: 0 2px 8px; font-size: 11px; }
  .my-post-card { margin-bottom: 8px; padding: 12px; border: 0; border-radius: 12px; }
  .my-post-card.newest { box-shadow: inset 0 0 0 1px var(--k-green); }
  .my-post-meta { gap: 6px; font-size: 11px; }
  .post-status { padding: 0 5px; border-radius: 4px; background: var(--k-paper2); color: var(--k-ink2); font-size: 11px; font-weight: 500; line-height: 17px; }
  .post-status.status-pending { background: var(--k-ochre-soft); color: var(--k-ochre-deep); }
  .post-status.status-online { background: var(--k-green-soft); color: var(--k-green); }
  .post-status.status-rejected { background: var(--k-alert-soft); color: var(--k-alert); }
  .my-post-title { margin: 8px 0 4px; font-family: var(--k-sans); font-size: 15px; line-height: 21px; font-weight: 600; }
  .my-post-content { color: var(--k-ink2); font-size: 13px; line-height: 1.7; }
  .my-post-link { height: 30px; margin-top: 8px; padding: 0 8px; gap: 5px; border-radius: 8px; background: var(--k-page); }
  .my-post-link__tag { height: 17px; padding: 0 5px; border-radius: 4px; background: var(--k-red-soft); font-size: 11px; font-weight: 500; line-height: 17px; }
  .my-post-link__title { color: var(--k-ink2); font-size: 12px; }
  .my-post-images { gap: 4px; margin-top: 8px; }
  .my-post-images image { width: calc((100% - 8px) / 3); border-radius: 8px; }
  .my-post-notice { margin-top: 10px; padding: 8px 10px; border-radius: 8px; background: var(--k-page); font-size: 12px; line-height: 18px; }
  .my-post-notice :deep(.k-icon) { margin-top: 2px; }
  .my-post-activity { margin-top: 8px; padding: 0 10px; border-radius: 8px; font-size: 12px; }
  .my-post-activity button { color: var(--k-red-deep); font-size: 12px; }
  .my-post-footer { gap: 8px; margin-top: 10px; font-size: 11px; }
  .my-post-actions { gap: 8px; }
  .my-post-actions button { min-height: 36px; padding: 0 10px; border: 1px solid var(--k-red-line); border-radius: 18px; color: var(--k-red-deep); font-size: 13px; }
  .my-post-footer .my-post-edit { border: 0; background: var(--k-red-soft); }
  .my-post-footer .my-post-remove { border: 0; background: var(--k-alert-soft); color: var(--k-alert); }
  .my-posts-state { gap: 10px; font-size: 12px; }
  .my-posts-state button { color: var(--k-red-deep); font-size: 12px; }
  .my-posts-state :deep(.k-button) { height: 36px; padding: 0 18px; border-radius: 18px; box-shadow: none; font-size: 13px; }
  /* 空状态 / 没加载出来：白卡内居中，标题 14 / 500 二级墨、说明 12 浅灰，上下留白 28；
     「去发布 / 重新加载」是次按钮小胶囊：看上去 32 高（白底 + 棕色细边 + 深棕字），外面 2 的透明边把可点高度留在 36 */
  .my-posts-state--card { gap: 6px; margin-bottom: 8px; padding: 28px 16px; border-radius: 12px; background: var(--k-paper); line-height: 1.6; }
  .my-posts-state--card :deep(.k-button) { height: 36px; margin-top: 6px; padding: 0 16px; border: 2px solid transparent; border-radius: 18px; background: #fff padding-box; box-shadow: inset 0 0 0 1px var(--k-red-line); color: var(--k-red-deep); font-size: 12px; font-weight: 500; }
  .empty-title { font-family: var(--k-sans); font-size: 14px; font-weight: 500; color: var(--k-ink2); }
  .my-posts-end { font-size: 11px; }
}
</style>

<style scoped lang="scss">
/* 11-18 第三轮精修：「发一条」改成加号在前的 28 高浅棕小胶囊（和「我的活动 → 创办活动」同一个样子）；空状态 / 出错补 56 方块图标；卡片之间 8、按钮一行两颗 */
.k-page.my-posts-page {
  .my-posts-heading { min-height: 36px; margin: 4px 2px 4px; }
  .my-posts-heading button { position: relative; height: 28px; padding: 0 12px; gap: 4px; border-radius: 14px; background: var(--k-red-soft); color: var(--k-red-deep); font-size: 12px; font-weight: 500; line-height: 28px; }
  .my-posts-heading button::after { content: ''; position: absolute; left: 0; right: 0; top: -4px; bottom: -4px; border: 0; transform: none; width: auto; height: auto; }
  .my-posts-hint { margin: 0 2px 12px; }
  .empty-ico { width: 56px; height: 56px; margin-bottom: 4px; display: flex; align-items: center; justify-content: center; border-radius: 16px; background: var(--k-red-soft); }
  .empty-ico--alert { background: var(--k-alert-soft); }
  .my-posts-state--card { padding: 32px 16px; }
  .my-post-footer > text { font-variant-numeric: tabular-nums; }
}
</style>
<style scoped lang="scss">
/* 11-18 返修第 1 轮：每条动态底部的操作不再是 2–3 个半行大按钮，改成右对齐的一行 28 高文字按钮（13 号，中间发丝竖线）；
   删除用提醒红字、不加底色；日期留在左边 11 号浅灰 */
.k-page.my-posts-page {
  .my-post-footer { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-top: 12px; }
  .my-post-footer > text { flex: 0 0 auto; color: var(--k-muted); font-size: 11px; }
  .my-post-actions { display: flex; flex-wrap: wrap; justify-content: flex-end; align-items: center; gap: 0; min-width: 0; }
  .my-post-actions button, .my-post-footer .my-post-edit, .my-post-footer .my-post-remove { position: relative; width: auto; min-width: 0; height: 28px; min-height: 28px; margin: 0; padding: 0 10px; border: 0; border-radius: 0; background: transparent; color: var(--k-ink2); font-size: 13px; line-height: 28px; }
  .my-post-actions button::after { border: 0; }
  .my-post-actions button + button::before { content: ''; position: absolute; left: 0; top: 8px; bottom: 8px; width: 1px; background: var(--k-line2); transform: scaleX(.5); }
  .my-post-actions button:last-child { padding-right: 0; }
  .my-post-footer .my-post-remove { color: var(--k-alert); background: transparent; }
  .my-post-actions button[disabled] { opacity: .45; }
}
</style>
<style scoped lang="scss">
/* 11-18 返修第 2 轮：卡片底部真正排成一行（日期在左、操作靠右）——早先的 flex-direction: column 一直没被覆盖；
   审核说明在状态标签下面一行灰字；关联活动条白底发丝框；页头说明和卡片外沿对齐 */
.k-page.my-posts-page {
  .my-posts-heading { margin-left: 0; margin-right: 0; }
  .my-posts-hint { margin-left: 0; margin-right: 0; }
  .my-post-footer { flex-direction: row; align-items: center; justify-content: space-between; min-height: 28px; }
  .my-post-footer > text { align-self: center; }
  .my-post-actions { flex: 1 1 auto; }
  .my-post-notice { margin-top: 4px; padding: 0; gap: 4px; border-radius: 0; background: transparent; color: var(--k-muted); font-size: 12px; line-height: 18px; }
  .my-post-notice :deep(.k-icon) { margin-top: 3px; }
  .my-post-activity { min-height: 36px; margin-top: 8px; padding: 0 10px; border-radius: 8px; background: transparent; box-shadow: inset 0 0 0 1px var(--k-line); color: var(--k-ink2); }
}
</style>
<style scoped lang="scss">
/* 11-18 第四轮：关联帖子行和关联活动行同一套（浅灰实底、不描边、圆角 8、32 高）；320 宽底部操作单独一行不折；空状态不套白卡 */
.k-page.my-posts-page {
  .my-post-link, .my-post-activity { min-height: 32px; height: auto; margin-top: 8px; padding: 0 8px; border: 0; border-radius: 8px; background: var(--k-page); box-shadow: none; }
  .my-post-activity { flex-wrap: nowrap; color: var(--k-ink2); font-size: 12px; }
  .my-post-activity > text { min-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .my-post-activity button { flex: 0 0 auto; gap: 2px; line-height: 32px; }
  .my-posts-state.my-posts-state--card { margin-top: 80px; padding: 0 16px; border-radius: 0; background: transparent; box-shadow: none; }
  @media (max-width: 359px) {
    .my-post-footer { flex-wrap: wrap; row-gap: 2px; }
    .my-post-footer > text { flex: 0 0 100%; }
    .my-post-actions { justify-content: flex-start; }
    .my-post-actions button, .my-post-footer .my-post-edit, .my-post-footer .my-post-remove { padding: 0 8px; font-size: 12px; }
    .my-post-actions button:first-child { padding-left: 0; }
  }
}
</style>
<style scoped lang="scss">
/* 11-18 返修第 5 轮：待审核提示在逗号处换行，不把「两个状态」拆开 */
.k-page.my-posts-page {
  .my-post-notice text { word-break: keep-all; }
}
</style>
<style scoped lang="scss">
/* 11-18 夜 第四轮精修：页首三类说明退成 12 号灰字、和下一行说明合成一个两行说明块；「发一条」改成暖棕文字钮（无底），只让空状态里的「去发布」做次按钮；
   列表为空时空状态放进白卡 */
.k-page.my-posts-page {
  .my-posts-heading { align-items: center; min-height: 28px; margin-bottom: 0; }
  .my-posts-heading > text { font-size: 12px; line-height: 18px; color: var(--k-muted); }
  .my-posts-heading > button { height: 28px; min-height: 28px; margin: 0; padding: 0 0 0 8px; border: 0; border-radius: 0; background: transparent; color: var(--k-red); font-size: 13px; font-weight: 500; line-height: 28px; display: flex; align-items: center; gap: 4px; }
  .my-posts-heading > button::after { border: 0; }
  .my-posts-hint { margin-top: 2px; font-size: 12px; line-height: 18px; }
  .my-posts-state.my-posts-state--card { margin-top: 12px; padding: 32px 16px; border-radius: 12px; background: var(--k-paper); }
  .my-posts-state--card .empty-title { font-size: 14px; font-weight: 500; color: var(--k-ink); }
}
</style>
<style scoped lang="scss">
/* 11-19 微信实拍返修：页首两行分层（三类 14/500 ink2，说明 12 灰），到下面内容 16；空状态不套白卡（全组统一） */
.k-page.my-posts-page {
  .my-posts-heading > text { font-size: 14px; font-weight: 500; line-height: 20px; color: var(--k-ink2); }
  .my-posts-hint { margin: 4px 0 16px; font-size: 12px; line-height: 18px; color: var(--k-muted); }
  .my-posts-state.my-posts-state--card { margin-top: 24px; padding: 24px 16px; border-radius: 0; background: transparent; }
}
</style>
