<template>
  <k-community-gate>
  <view class="k-page my-posts-page">
    <post-editor v-if="editingId" :post-id="editingId" @close="editingId = 0" @saved="finishEdit" />
    <k-topbar v-if="!editingId" title="我的发布" back />
    <view v-if="!editingId" class="my-posts-body">
      <view v-if="submittedId" class="publish-receipt"><k-icon name="check-circle-2" :size="22" color="green" /><view><text class="receipt-title">内容已提交</text><text class="receipt-copy">下次可从「我的 → 我的发布」查看。</text></view></view>
      <!-- 类型标题与社区页一致，保留已有帖子。 -->
      <view class="my-posts-heading"><text>找搭子 · 旅居日常 · 经验分享</text><button @click="go(R.publish)">发一条<k-icon name="plus" :size="16" color="red" /></button></view>
      <text class="my-posts-hint">待审核的内容仅自己可见，通过后会展示在社区。</text>
      <view v-for="post in posts" :key="post.postId" class="my-post-card" :class="{ newest: post.postId === submittedId }">
        <view class="my-post-meta"><text>{{ kindOf(post).label }} · {{ post.city }}{{ post.toneLabel ? ' · 伙伴说：' + post.toneLabel : '' }}</text><text class="post-status" :class="'status-' + post.status">{{ statusLabel(post.status) }}</text></view>
        <!-- 标题和社区卡片同一个规则（titleOf）：话题是「其他」时不加「其他｜」前缀，只显示标题 -->
        <text class="my-post-title">{{ displayWording(titleOf(post), [post.author?.name]) }}</text>
        <text class="my-post-content">{{ displayWording(post.content, [post.author?.name]) }}</text>
        <!-- 2026-10-17 关联了 小院 / 门店、岗位 或 活动：多一行「关联：XXX」，点了打开 -->
        <view v-if="linkOf(post)" class="my-post-link" hover-class="k-press" @click="go(linkOf(post).to)"><k-icon name="link" :size="14" color="red" :stroke="2" /><text class="my-post-link__tag">{{ linkOf(post).label }}</text><text class="my-post-link__title">关联：{{ displayWording(linkOf(post).title) }}</text><k-icon name="chevron-right" :size="14" color="muted" /></view>
        <view v-if="post.images && post.images.length" class="my-post-images"><image v-for="(src, i) in post.images" :key="i" :src="absUrl(src)" mode="aspectFill" @click="preview(post, i)" /></view>
        <view v-if="post.status !== 'online'" class="my-post-notice"><k-icon name="info" :size="16" color="muted" /><text>{{ statusNotice(post) }}</text></view>
        <view v-if="post.activity" class="my-post-activity"><text>关联活动 · {{ post.activity.label }}</text><button v-if="post.activity.isMine" @click="go(R.activityMine + '?id=' + post.activity.activityId)">管理活动<k-icon name="chevron-right" :size="14" color="red" /></button></view>
        <view class="my-post-footer"><text>{{ post.dateText }}</text><view class="my-post-actions"><button v-if="post.status !== 'hidden'" class="my-post-edit" :disabled="busy" @click="editingId = post.postId">编辑动态</button><button class="my-post-remove" :disabled="busy" @click="removePost(post)">删除动态</button><button v-if="post.activity?.canCancel" :disabled="busy" @click="cancelActivity(post)">取消活动</button><button v-if="post.status === 'online'" @click="go(R.community + '?postId=' + post.postId + '&from=mine')">查看详情</button></view></view>
      </view>
      <view v-if="error" class="my-posts-state"><text>{{ error }}</text><k-button type="outline" @click="loadPosts(!posts.length)">重新加载</k-button></view>
      <view v-else-if="loading" class="my-posts-state"><text>正在加载…</text></view>
      <view v-else-if="!posts.length" class="my-posts-state"><k-icon name="file-text" :size="36" color="muted" /><text class="empty-title">还没有发布内容</text><text>发布的内容会在这里保留，方便随时查看。</text><k-button @click="go(R.publish)">去发布</k-button></view>
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
import { titleOf, kindOf } from './community-feed.js'
import { displayWording } from '@/common/display-wording.js'
import { linkView } from './post-link.js'

const posts = ref([]), loading = ref(false), error = ref(''), hasMore = ref(true), submittedId = ref(0)
const editingId = ref(0)
function finishEdit() { editingId.value = 0; loadPosts(true) }
let nextPage = 1
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
  if (loading.value || (!reset && !hasMore.value)) return
  loading.value = true
  error.value = ''
  if (reset) { posts.value = []; hasMore.value = true }
  try {
    await ensureSession()
    if (!experience.account) { posts.value = []; throw new Error('请先登录，再查看自己的发布内容') }
    const owner = experience.account.id
    const page = reset ? 1 : nextPage
    const rows = (await apiMyPosts(page)).data || []
    if (experience.account?.id !== owner) { posts.value = []; return }
    if (reset) posts.value = rows
    else {
      const seen = new Set(posts.value.map(x => x.postId))
      posts.value.push(...rows.filter(x => !seen.has(x.postId)))
    }
    nextPage = page + 1
    hasMore.value = rows.length === 20
  } catch (e) { error.value = errText(e, '发布记录加载失败，请重试') }
  finally { loading.value = false; uni.stopPullDownRefresh() }
}
// 之前服务端有删除接口（只认本人），页面上却没有任何删除入口，发错的内容删不掉
const busy = ref(false)
async function removePost(post){if(busy.value)return;busy.value=true;try{if(await removeCommunityPost(post))posts.value=posts.value.filter(x=>x.postId!==post.postId)}finally{busy.value=false}}
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
</style>
