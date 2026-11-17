<template>
  <k-community-gate>
  <view class="k-page user-page">
    <k-topbar title="个人主页" back dark bg="#3e5149" :fab="false" />
    <view class="profile-hero">
      <view v-if="loading && !u.userId" class="profile-skeleton" aria-label="正在加载主页"><view class="skeleton-avatar" /><view class="skeleton-line" /><view class="skeleton-line skeleton-line--short" /></view>
      <view v-else-if="error" class="profile-error"><k-icon name="user-round-x" :size="36" color="white" /><text>{{ error }}</text><button class="profile-secondary" @click="load(true)">重新加载</button></view>
      <view v-else-if="u.userId" class="profile-info">
        <view class="profile-head">
          <image class="avatar" :class="{'member-frame':u.member?.frame}" :src="avatar" mode="aspectFill" @click="previewAvatar" @error="failedImages.avatar = true" />
          <view class="profile-heading"><text class="profile-name">{{ u.name }}</text><button class="profile-number" @click="copyNumber"><text>袋鼠号：{{ u.userId }}</text><k-icon name="copy" :size="13" color="white" /></button><member-mark :member="u.member" /></view>
          <button v-if="!u.isMe" class="profile-more" aria-label="更多操作" @click="moreActions"><k-icon name="ellipsis" :size="24" color="white" /></button>
        </view>
        <view class="profile-stats">
          <view v-if="privateChatEnabled" class="profile-stat"><text class="stat-number">{{ countText(u.followingCount) }}</text><text class="stat-label">关注</text></view>
          <view v-if="privateChatEnabled" class="profile-stat"><text class="stat-number">{{ countText(u.followerCount) }}</text><text class="stat-label">粉丝</text></view>
          <view class="profile-stat"><text class="stat-number">{{ countText(u.appreciationCount) }}</text><text class="stat-label">获赞与收藏</text></view>
        </view>
        <text class="profile-intro" :class="{'profile-intro--empty': !u.intro}">{{ u.intro || (u.isMe ? '写一段简介，让同行的人更了解你。' : 'TA 还没有填写简介') }}</text>
        <view v-if="u.city || u.phoneVerified" class="profile-tags"><text v-if="u.city" class="profile-tag">常驻 · {{ u.city }}</text><text v-if="u.phoneVerified" class="profile-tag">手机已验证</text></view>
        <text v-if="privateChatEnabled && relation" class="profile-relation">{{ relation }}</text>
        <view v-if="u.isMe" class="profile-actions"><button class="profile-primary" @click="go(R.profile + '?s=2')">编辑资料</button><button class="profile-secondary" @click="go(R.myPosts)">我的发布</button></view>
        <view v-else-if="u.blocked" class="profile-actions"><button class="profile-secondary" :disabled="busy" @click="toggleBlock">取消屏蔽</button></view>
        <view v-else-if="privateChatEnabled" class="profile-actions"><button class="profile-primary" :class="{'is-followed': u.followed}" :disabled="busy" @click="toggleFollow">{{ busy ? '请稍候…' : u.followed ? (u.mutual ? '互相关注' : '已关注') : '关注' }}</button><button class="profile-secondary" @click="message"><k-icon name="message-circle" :size="18" color="white" /><text>发私信</text></button></view>
        <text v-if="privateChatEnabled && !u.isMe && !u.blocked && u.dmReason" class="profile-dm-note">{{ u.dmReason }}</text>
      </view>
    </view>
    <view v-if="u.userId && !error" class="profile-content">
      <view class="profile-tabs"><button :class="{'is-active': activeTab === 'posts'}" @click="activeTab = 'posts'">动态</button><button :class="{'is-active': activeTab === 'activities'}" @click="activeTab = 'activities'">发起活动<text v-if="u.activityCount" class="tab-count">{{ countText(u.activityCount) }}</text></button></view>
      <view v-if="u.blocked" class="profile-empty"><k-icon name="eye-off" :size="32" color="muted" /><text>你已屏蔽对方</text><text class="empty-note">取消屏蔽后可查看动态和活动</text></view>
      <template v-else-if="activeTab === 'posts'">
        <view v-if="!posts.length" class="profile-empty"><k-icon name="image" :size="32" color="muted" /><text>还没有公开动态</text><text class="empty-note">{{ u.isMe ? '把旅途里的故事分享在这里' : '下次再来看看 TA 的旅途故事' }}</text><button v-if="u.isMe" class="empty-action" @click="go(R.publish)">发布第一条动态</button></view>
        <view v-else class="note-grid">
          <view v-for="(column, ci) in columns" :key="ci" class="note-column">
            <view v-for="p in column" :key="p.postId" class="note" hover-class="k-press-s" @click="openPost(p)">
              <view class="note-cover" :class="'note-cover--' + kindOf(p).key">
                <image v-if="postCover(p)" class="note-image" :src="postCover(p)" mode="widthFix" @error="failedImages['p' + p.postId] = true" />
                <view v-else class="note-words"><text class="note-kind">{{ kindOf(p).label }}</text><text class="note-quote">“</text><text class="note-cover-title">{{ postTitle(p) }}</text><text v-if="p.content" class="note-excerpt">{{ displayWording(p.content, [u.name]) }}</text></view>
                <view v-if="p.images && p.images.length > 1 && postCover(p)" class="note-multi"><k-icon name="layers" :size="15" color="white" /><text>{{ p.images.length }}</text></view>
              </view>
              <view class="note-body"><view v-if="p.chips.length" class="note-tags"><k-chip v-for="t in p.chips" :key="t.key" :tone="t.tone">{{ t.text }}</k-chip></view><text class="note-title">{{ postTitle(p) }}</text><view class="note-meta"><text>{{ p.city || kindOf(p).label }}<text v-if="p.dateText"> · {{ p.dateText }}</text></text></view><view class="note-footer"><text class="note-author">{{ u.name }}</text><view class="note-likes"><k-icon name="heart" :size="15" :color="p.liked ? 'red' : 'muted'" /><text>{{ countText(p.likes) }}</text></view></view></view>
            </view>
          </view>
        </view>
      </template>
      <template v-else>
        <view v-if="!activities.length" class="profile-empty"><k-icon name="calendar-days" :size="32" color="muted" /><text>还没有公开的活动</text><text class="empty-note">{{ u.isMe ? '发起一次活动，认识同频的伙伴' : 'TA 发起的公开活动会展示在这里' }}</text></view>
        <view v-for="a in activities" :key="a.activityId" class="profile-activity" hover-class="k-press-s" @click="openActivity(a)"><image v-if="a.img && !failedImages['a'+a.activityId]" class="activity-cover" :src="absUrl(a.img)" mode="aspectFill" @error="failedImages['a'+a.activityId] = true" /><view v-else class="activity-cover activity-cover--empty"><k-icon name="calendar-days" :size="28" color="red" /></view><view class="activity-copy"><text class="activity-phase">{{ a.phaseLabel }}</text><text class="activity-title">{{ a.title }}</text><text class="activity-meta">{{ a.dateText }} {{ a.time }}</text><text class="activity-meta">{{ a.city }} · {{ a.place }}</text><text class="activity-price">{{ a.priceText }}</text></view><k-icon name="chevron-right" :size="17" color="muted" /></view>
      </template>
      <view v-if="!u.blocked && moreError" class="profile-load-more"><text>{{ moreError }}</text><button @click="load(false)">重试加载</button></view>
      <view v-else-if="!u.blocked && moreAvailable" class="profile-load-more"><button :disabled="loading" @click="load(false)">{{ loading ? '正在加载…' : '加载更多' }}</button></view>
      <text v-else-if="!u.blocked && (activeTab === 'posts' ? posts.length : activities.length)" class="profile-end">已经到底了</text>
    </view>
  </view>

  </k-community-gate>
</template>
<script setup>
import { privateChatEnabled } from '@/common/features.js'
import { publicShare, shareWithCover, timelineShare, showPublicShareMenu } from '@/common/public-share.js'
import MemberMark from './components/member-mark.vue'
import { displayWording } from '@/common/display-wording.js'
// ---------------------------------------------------------------------------
// 用户个人主页（2026-10-11 内测建议）：之前点帖子作者的头像、名字没有反应，看不到 TA 发过什么，也没法私信。
// 现在从信息流 / 帖子详情 / 评论 / 私信页点头像进来（?uid=）：
//   资料（头像、昵称、手机已验证、动态 / 关注 / 粉丝数、和我的关系）、「关注」「私信」两个按钮、TA 最近的公开动态（上滑加载更多）；
//   右上角「···」里是举报和屏蔽。TA 设置了「谁可以私信我」而我不满足时，私信按钮点了说明原因、不进会话。
// ---------------------------------------------------------------------------
import { ref, computed, watch } from 'vue'
import { onLoad, onShow, onReachBottom, onUnload, onShareAppMessage, onShareTimeline } from '@dcloudio/uni-app'
import { go, back, toast } from '@/common/screen.js'
import { apiUserProfile, apiFollow, apiBlock, apiReport } from '@/common/api.js'
import { ensureSession, experience, getSessionRevision } from '@/common/experience.js'
import { sheet, confirm, alert, copy, errText } from '@/common/ui.js'
import { gated, fail } from '@/common/community.js'
import { absUrl } from '@/common/upload.js'
import R from '@/common/routes.js'
import { postTags, kindOf } from './community-feed.js'

const DEFAULT_AVATAR = '/static/media/profile-avatar.jpg'
const uid = ref(0)
const u = ref({})
const posts = ref([])
const activities = ref([])
const activeTab = ref('posts')
const activitiesHasMore = ref(false)
const moreError = ref('')
const failedImages = ref({})
let activityPage = 1
const moreAvailable = computed(() => activeTab.value === 'posts' ? hasMore.value : activitiesHasMore.value)
const columns = computed(() => [posts.value.filter((_,i) => i % 2 === 0), posts.value.filter((_,i) => i % 2 === 1)])
const hasMore = ref(false)
const loading = ref(false)
const error = ref('')
const busy = ref(false)
let page = 1
let seq = 0
let ready = false

onLoad(async (q) => {
  uid.value = Number(q && q.uid) || 0
  await ensureSession()
  await load(true)
  ready = true
})
// 从帖子详情 / 私信回来时重读一遍：关注、屏蔽状态以服务端为准
onShow(() => { if (ready) load(true) })
onReachBottom(() => { if (moreAvailable.value && !loading.value) load(false) })

onUnload(() => { seq++; ready = false })
watch(() => experience.account?.id, () => { if (ready) { u.value = {}; posts.value = []; activities.value = []; load(true) } })

async function load(reset) {
  if (!uid.value) { error.value = '没有找到这个用户'; return }
  const token = ++seq
  const revision = getSessionRevision()
  const tab = activeTab.value
  const next = reset ? 1 : (tab === 'posts' ? page : activityPage) + 1
  moreError.value = ''
  loading.value = true
  if (reset) error.value = ''
  try {
    const d = (await apiUserProfile(uid.value, next)).data || {}
    if (token !== seq || revision !== getSessionRevision()) return
    const { posts: list = [], activities: organized = [], ...profile } = d
    // 动态上的小标签和信息流卡片用同一份（postTags）：审核中 / 找搭子的仅限女生、仅限男生 / 伙伴说 · 推荐、避雷。
    // 之前这里只写了审核中和伙伴说，同一条找搭子在信息流里有「仅限女生」，到个人主页就没了
    const rows = list.map(x => ({ ...x, chips: postTags(x) }))
    u.value = profile
    if (reset) {
      posts.value = rows; activities.value = organized
      hasMore.value = !!d.hasMore; activitiesHasMore.value = !!d.activitiesHasMore
      page = 1; activityPage = 1; failedImages.value = {}
    } else if (tab === 'posts') {
      const seen = new Set(posts.value.map(x => x.postId))
      posts.value = [...posts.value, ...rows.filter(x => !seen.has(x.postId))]
      hasMore.value = !!d.hasMore; page = next
    } else {
      const seen = new Set(activities.value.map(x => x.activityId))
      activities.value = [...activities.value, ...organized.filter(x => !seen.has(x.activityId))]
      activitiesHasMore.value = !!d.activitiesHasMore; activityPage = next
    }
  } catch (e) {
    if (token === seq && reset) error.value = errText(e, '主页读取失败，请稍后再试')
    else if (token === seq) moreError.value = errText(e, '加载失败，请重试')
  } finally {
    if (token === seq) loading.value = false
  }
}

const avatar = computed(() => (u.value.avatar && !failedImages.value.avatar ? absUrl(u.value.avatar) : DEFAULT_AVATAR))
const countText = value => Number(value) >= 10000 ? (Number(value) / 10000).toFixed(1).replace(/\.0$/, '') + '万' : String(Math.max(0, Number(value) || 0))
const copyNumber = () => copy(String(u.value.userId), '袋鼠号已复制')
const postTitle = p => displayWording((p.topicLabel ? p.topicLabel + '｜' : '') + p.title, [u.value.name])
const postCover = p => Array.isArray(p.images) && p.images[0] && !failedImages.value['p' + p.postId] ? absUrl(p.images[0]) : ''
const openActivity = a => go(R.activity + '?id=' + a.activityId + '&channel=community')
const previewAvatar = () => { if (u.value.avatar) uni.previewImage({ urls: [avatar.value] }) }
const relation = computed(() => {
  if (u.value.isMe) return '你正在查看自己的主页'
  if (u.value.blocked) return '你已屏蔽对方'
  if (u.value.mutual) return '你们互相关注'
  if (u.value.followsMe) return 'TA 关注了你'
  return ''
})

async function toggleFollow() {
  if (busy.value) return
  busy.value = true
  try {
    const res = await gated(() => apiFollow(uid.value))
    toast(res.data.followed ? '已关注' : '已取消关注')
    await load(true)
  } catch (e) {
    fail(e, '操作失败')
  } finally {
    busy.value = false
  }
}

async function message() {
  if (u.value.dmReason) return alert('暂时不能私信', u.value.dmReason)
  go(R.chat + '?userId=' + uid.value + '&source=profile')
}

const REASONS = ['骚扰 / 辱骂', '诈骗 / 索要钱财', '冒充他人', '色情低俗', '广告引流', '其他']
async function moreActions() {
  const i = await sheet(['举报该用户', u.value.blocked ? '取消屏蔽' : '屏蔽该用户'])
  if (i === 0) report()
  if (i === 1) toggleBlock()
}
async function report() {
  const i = await sheet(REASONS)
  if (i < 0) return
  try {
    toast((await gated(() => apiReport('user', uid.value, REASONS[i]))).msg || '举报已提交')
  } catch (e) {
    fail(e, '举报失败')
  }
}
async function toggleBlock() {
  if (busy.value) return
  const blocking = !u.value.blocked
  if (blocking && !(await confirm('屏蔽该用户', `屏蔽后你们互相看不到对方的动态与评论，也不能私信，关注关系会一并取消。确认屏蔽「${u.value.name}」？`))) return
  busy.value = true
  try {
    const res = await gated(() => apiBlock(uid.value))
    toast(res.data.blocked ? '已屏蔽' : '已取消屏蔽')
    await load(true)
  } catch (e) {
    fail(e, '操作失败')
  } finally {
    busy.value = false
  }
}

const openPost = (p) => go(R.community + '?postId=' + p.postId + '&from=user')

const pageShareMessage = () => publicShare('/pages/community/user', {uid:uid.value}, (u.value.name || '旅途伙伴') + '的主页 · 袋鼠全球青年')

onShareAppMessage((event) => shareWithCover(pageShareMessage(event)))
onShareTimeline(() => timelineShare(pageShareMessage()))
onShow(showPublicShareMenu)
</script>
<style scoped lang="scss">
.user-page{background:#f9f7f2;font-family:var(--k-sans);font-size:14px;min-height:100vh}
.profile-hero{background:#3e5149;color:#fcf8ef;padding-bottom:36px}
.profile-info{padding:12px 20px 0}
.profile-head{display:flex;align-items:center;gap:16px}
.avatar{width:88px;height:88px;border-radius:50%;flex-shrink:0;background:#68796e;border:2px solid #ffffff66;box-sizing:border-box}
.member-frame{outline:2px solid #c69a60;outline-offset:3px}
.profile-heading{flex:1;min-width:0;display:flex;flex-direction:column;align-items:flex-start;gap:4px}
.profile-name{font-size:26px;line-height:1.3;font-weight:700;overflow-wrap:anywhere}
.profile-number{display:flex;gap:5px;align-items:center;background:transparent;color:#dce4dc;padding:0;margin:0;min-height:32px;font-size:12px;line-height:1.5;text-align:left;white-space:normal}
.profile-more{flex:0 0 36px;width:36px;height:44px;display:flex;align-items:center;justify-content:center;padding:0;margin:0 -6px 0 0;background:transparent;align-self:flex-start}
.profile-number::after,.profile-more::after,.profile-primary::after,.profile-secondary::after,.profile-tabs button::after,.profile-load-more button::after,.empty-action::after{border:0}
.profile-stats{display:flex;gap:32px;margin:23px 0 19px}
.profile-stat{display:flex;flex-direction:column;gap:3px}
.stat-number{font-size:24px;line-height:1.25;font-weight:700;font-variant-numeric:tabular-nums}
.stat-label{font-size:13px;color:#e1e7df}
.profile-intro{display:block;white-space:pre-wrap;overflow-wrap:anywhere;font-size:14px;line-height:1.7}
.profile-intro--empty{color:#cad5ca}
.profile-tags{display:flex;flex-wrap:wrap;gap:7px;margin-top:13px}
.profile-tag{background:#52655a;border-radius:999px;padding:5px 10px;font-size:11px;color:#f3f4e9}
.profile-relation{display:block;margin-top:12px;font-size:12px;line-height:1.6;color:#d4dfd0}
.profile-actions{display:flex;gap:10px;margin-top:20px}
.profile-primary,.profile-secondary{display:flex;align-items:center;justify-content:center;gap:7px;flex:1;min-width:0;height:44px;border-radius:10px;margin:0;padding:0 10px;font-size:15px;line-height:1.3;font-weight:600;box-sizing:border-box}
.profile-primary{background:#ad743d;color:#fff9ef}
.profile-primary.is-followed{background:#52655a;color:#f0f1e6}
.profile-secondary{background:#ffffff10;color:#fcf8ef;border:1px solid #a9b8aa70}
.profile-primary[disabled],.profile-secondary[disabled]{opacity:.6;color:#f2f1e7}
.profile-dm-note{display:block;margin-top:10px;font-size:12px;line-height:1.6;color:#dce4d9}
.profile-content{position:relative;margin-top:-20px;background:#f9f7f2;border-radius:22px 22px 0 0;min-height:360px;padding:0 12px calc(28px + env(safe-area-inset-bottom))}
.profile-tabs{display:flex;align-items:center;gap:24px;min-height:62px;padding:0 8px;border-bottom:1px solid #e7e6dd;margin-bottom:12px}
.profile-tabs button{position:relative;background:transparent;margin:0;padding:0 3px;min-height:54px;display:flex;align-items:center;gap:5px;color:#777b70;font-size:16px;line-height:1.4;border-radius:0}
.profile-tabs button.is-active{color:#273e33;font-weight:700}
.profile-tabs button.is-active::before{content:'';position:absolute;bottom:1px;left:calc(50% - 10px);height:3px;width:20px;border-radius:2px;background:#a46c39}
.tab-count{font-size:12px;font-weight:400;color:#8e9588}
.note-grid{display:flex;align-items:flex-start;gap:10px}
.note-column{flex:1;min-width:0;display:flex;flex-direction:column;gap:12px}
.note{border-radius:10px;overflow:hidden;background:#fffdf8}
.note-cover{position:relative;background:#e2e9dc;overflow:hidden}
.note-cover--daily{background:#ece3d2}.note-cover--diary{background:#eadbd2}
.note-image{display:block;width:100%;height:auto;min-height:80px}
.note-words{padding:14px 14px 18px;min-height:174px;box-sizing:border-box;color:#395743;display:flex;flex-direction:column}
.note-cover--daily .note-words{color:#7f602e}.note-cover--diary .note-words{color:#7d503e}
.note-kind{font-size:10px;line-height:1.5;letter-spacing:1px}
.note-quote{font-family:Georgia,serif;font-size:48px;line-height:1;height:35px;opacity:.28;margin-top:8px}
.note-cover-title{font-size:19px;font-weight:700;line-height:1.45;overflow-wrap:anywhere;display:-webkit-box;-webkit-line-clamp:4;-webkit-box-orient:vertical;overflow:hidden}
.note-excerpt{font-size:12px;line-height:1.6;margin-top:9px;opacity:.8;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden}
.note-multi{position:absolute;top:8px;right:8px;display:flex;align-items:center;gap:3px;background:#263a3380;color:#faf7ed;border-radius:12px;padding:4px 7px;font-size:10px}
.note-body{padding:10px 9px 11px}
.note-tags{display:flex;flex-wrap:wrap;gap:4px;margin-bottom:6px}
.note-title{font-size:14px;line-height:1.5;color:#2c342d;font-weight:600;overflow-wrap:anywhere;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.note-meta{font-size:10px;line-height:1.5;color:#7b8276;margin-top:5px;overflow-wrap:anywhere}
.note-footer{display:flex;align-items:center;justify-content:space-between;gap:6px;margin-top:9px;font-size:11px;color:#778070}
.note-author{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.note-likes{flex-shrink:0;display:flex;align-items:center;gap:4px}
.profile-activity{display:flex;gap:12px;align-items:center;padding:16px 0;border-bottom:1px solid #e8e8de}
.activity-cover{width:92px;height:112px;flex:0 0 92px;border-radius:10px;background:#ece4d6}
.activity-cover--empty{display:flex;align-items:center;justify-content:center}
.activity-copy{flex:1;min-width:0;display:flex;flex-direction:column;gap:4px}
.activity-phase{font-size:11px;color:#537343}
.activity-title{font-size:15px;font-weight:600;line-height:1.5;overflow-wrap:anywhere}
.activity-meta{font-size:11px;line-height:1.5;color:#7e8476;overflow-wrap:anywhere}
.activity-price{font-size:14px;font-weight:600;color:#976332}
.profile-empty{display:flex;flex-direction:column;align-items:center;gap:12px;padding:60px 12px;text-align:center;color:#586450}
.empty-note{font-size:12px;line-height:1.6;color:#7c8674}
.empty-action{background:#e8dfcf;color:#895b30;border-radius:22px;padding:0 20px;min-height:44px;font-size:13px;line-height:44px;margin-top:4px}
.profile-load-more{text-align:center;padding:18px 0;font-size:12px;color:#7b8276}
.profile-load-more button{font-size:13px;min-height:44px;background:transparent;color:#8a5e36}
.profile-end{display:block;padding-top:28px;text-align:center;font-size:11px;color:#92988b}
.profile-error{padding:32px 20px;display:flex;flex-direction:column;align-items:center;gap:16px;line-height:1.6;text-align:center}
.profile-error button{flex:initial;padding:0 24px}
.profile-skeleton{padding:20px;min-height:250px}
.skeleton-avatar{width:88px;height:88px;border-radius:50%;background:#63756a}
.skeleton-line{height:16px;border-radius:6px;background:#63756a;width:70%;margin-top:24px}
.skeleton-line--short{width:40%;margin-top:14px}
@media(max-width:350px){.profile-info{padding:10px 16px 0}.avatar{width:76px;height:76px}.profile-head{gap:12px}.profile-name{font-size:23px}.profile-stats{gap:27px}.note-words{padding:12px;min-height:160px}.note-cover-title{font-size:17px}.activity-cover{width:76px;flex-basis:76px}}
</style>
