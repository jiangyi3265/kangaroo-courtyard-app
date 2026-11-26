<template>
  <!-- #ifdef MP-WEIXIN -->
  <page-meta :page-style="aiOpen ? 'overflow: hidden' : ''" />
  <!-- page-meta 必须是页面第一个节点：AI袋鼠弹层开着时锁住页面滚动（网页版由弹层自己锁 body） -->
  <!-- #endif -->
  <view class="k-page msg-page" :class="[$userSurface, { 'msg-page--user': !staff }]">
    <k-topbar title="消息">
      <template #left><view v-if="unreadCount" class="read-all" role="button" aria-label="将当前身份消息全部标为已读" hover-class="k-press" @click="readAll">全部已读</view></template>
    </k-topbar>
    <view class="k-pad-tab">
      <view class="entries">
        <view v-for="e in entries" :key="e.type" class="entry" hover-class="k-press-s" @click="openEntry(e)">
          <view class="tile" :class="'t-' + e.tone"><k-icon :name="e.icon" :size="22" color="red" /><text v-if="e.badge" class="badge">{{ e.badge > 99 ? '99+' : e.badge }}</text></view>
          <text>{{ e.label }}</text>
        </view>
        <view class="entries__sub"><k-subscribe scenes="" label="微信订阅提醒" /></view>
      </view>
      <view v-if="!guest" class="categories" role="tablist" aria-label="消息分类">
        <button v-for="item in categories" :key="item.key" class="category" :class="{ 'category--active': activeCategory === item.key }" :data-category="item.key" role="tab" :aria-selected="activeCategory === item.key" hover-class="k-press" @click="selectCategory(item.key)">
          <k-icon :name="item.icon" :size="16" :color="activeCategory === item.key ? 'red' : 'muted'" />
          <text>{{ item.label }}</text><text v-if="item.unread" class="category-count">{{ item.unread > 99 ? '99+' : item.unread }}</text>
        </button>
      </view>
      <view v-if="!guest" class="sec"><text>{{ activeLabel }}消息</text><text v-if="recentUnread" class="sec__count">{{ recentUnread }}</text><button class="manage-messages" @click="managing = !managing">{{ managing ? '完成' : '管理' }}</button></view>
      <text v-if="!guest" class="retention-tip">历史消息保留 · 长按可删除</text>
      <view v-if="ready && categoryRows.length && (activeCategory !== 'group' || groupChatEnabled)" class="list">
        <view v-for="m in categoryRows" :key="m.id" class="row" :class="{ 'row--unread': !m.read }" hover-class="k-press" @click="openMessage(m)" @longpress.stop="removeMessage(m)">
          <view class="ava" :class="m.ini ? 'ava--ini' : 't-' + m.k[1]" :style="{ background: m.color }"><text v-if="m.ini">{{ m.ini }}</text><k-icon v-else :name="m.k[0]" :size="20" color="red" /><view v-if="m.avatar" class="ava__img" :style="m.avatar" /></view>
          <view class="row__main">
            <view class="row__head"><text v-if="m.k[2]" class="tag" :class="'g-' + m.k[1]">{{ m.k[2] }}</text><text class="row__title k-ellipsis">{{ m.name || m.title }}</text></view>
            <text v-if="m.source" class="row__source k-ellipsis">{{ m.source }}</text>
            <text class="row__desc k-ellipsis">{{ m.desc }}</text>
            <text v-if="m.wordingUpdated" class="wording-original" @click.stop="alert('消息原文', m.originalText)">称呼已更新 · 查看原文</text>
          </view>
          <view class="row__side"><text>{{ m.time }}</text><text v-if="!m.read" class="count-pill">{{ m.unread > 99 ? '99+' : m.unread }}</text></view>
          <button v-if="managing" class="message-delete" :disabled="deleting" aria-label="删除消息" @click.stop="removeMessage(m)"><k-icon name="trash-2" :size="18" color="alert" /></button>
        </view>
      </view>
      <view v-else-if="ready && !failed" class="empty">
        <view class="empty__ring"><k-icon name="message-circle" :size="32" color="red" /></view>
        <text class="empty__title">{{ empty[0] }}</text>
        <text v-if="empty[1]" class="empty__copy">{{ empty[1] }}</text>
        <k-button type="secondary" size="sm" :label="empty[2]" @click="emptyAction" />
      </view>
      <view v-else-if="!ready && !failed" class="list-loading"><view /><view /><text>正在加载{{ activeLabel }}消息…</text></view>
      <text v-if="failed && !paging" class="more" @click="load(failed === 2)">加载失败，点这里重试</text>
      <text v-else-if="paging || (categoryRows.length >= PAGE && experience.messagesMore === false)" class="more">{{ paging ? '加载中…' : '没有更多了' }}</text>
      <view class="help" hover-class="k-press" @click="aiOpen = true"><k-icon name="headset" :size="16" color="muted" /><text>联系袋鼠全球青年客服</text><k-icon name="chevron-right" :size="12" color="muted" /></view>
    </view>
    <k-tabbar active="messages" :mode="experience.mode" />
    <!-- 「联系袋鼠小院客服」：AI袋鼠在本页底部弹出，不跳页 -->
    <k-ai-sheet :show="aiOpen" ctx="profile" @close="aiOpen = false" />
  </view>
</template>

<script setup>
import { groupChatEnabled, privateChatEnabled } from '@/common/features.js'
// ---------------------------------------------------------------------------
// 消息（主包，10-15 重写）：
//   顶部三个入口 → 分包子页 pages/notice/inbox?type=…：用户身份「系统通知 / 评论 / 赞」，员工身份「系统通知 / 报名 / 订单」；
//     角标取 /summary 的 buckets，「系统通知」再加上没看过的公告条数。
//   下面一个按时间排的列表（服务端 bucket=main）：用户身份是订单、报名 / 面试 / 签约进度、活动通知、私信、群聊；
//     员工身份只有和报名人、顾客的私信与群聊。每页 20 条，滑到底再取下一页。
//   会话行（10-31 主人：要表明消息来源）：头像、对方名字、名字下面一个来源小标签、最后一条消息。名字和来源是服务端给的 peerName / sourceLabel，
//     不从 title 按分隔符拆（岗位名里也可能带「 · 」，title 还截过 64 字）；老接口不给这几个字段时退回 title，也不出标签。
//   客服中心、公告卡片搬去了 pages/notice 分包，主包只留入口。
// ---------------------------------------------------------------------------
import { ref, computed, watch } from 'vue'
import { onLoad, onShow, onHide, onReachBottom } from '@dcloudio/uni-app'
import { toast, go, relaunch } from '@/common/screen.js'
import { apiMessageSummary, apiNotices } from '@/common/api.js'
import { experience, visibleMessages, unreadCount, markMessageRead, markAllMessagesRead, loadMessages, ensureSession, session, getMessageScopeKey } from '@/common/experience.js'
import { readSeenNotices, readNoticeBadgeCleared, clearNoticeBadge, noticeBadged } from '@/common/notice.js'
import { absUrl } from '@/common/upload.js'
import R from '@/common/routes.js'
import { removeInboxMessage } from '@/common/message-actions.js'
import { messageWording } from '@/common/display-wording.js'
import { alert } from '@/common/ui.js'
import { showMessagePreview } from '@/common/message-preview.js'

// 老链接：?s=4 客服中心搬进了分包客服页（评价页「联系客服」还在用），?s=2「系统」页签换成了「系统通知」子页。
// 用 redirectTo 换掉本页，客服页返回时回到原来那一页
const legacyUrl = (q) => /^\d+$/.test(q.subscriptionId || '')
  ? '/pages/profile/subscription-message?id=' + q.subscriptionId + '&mode=' + (q.mode === 'staff' ? 'staff' : 'user') + '&scope=' + (/^(?:store|city|service-city)%3A[\w%.~-]*$/i.test(q.scope || '') ? q.scope : encodeURIComponent(q.scope || ''))
  : q.s === '4' ? R.support : q.s === '2' ? R.inbox + '?type=system' : ''
let leaving = ''
const aiOpen = ref(false)
const managing = ref(false)
const deleting = ref(false)
let suppressOpenUntil = 0
onLoad((q) => { leaving = legacyUrl(q || {}); if (leaving) uni.redirectTo({ url: leaving, fail: () => { leaving = ''; refreshInbox() } }) })

// 每条消息归哪一组，和服务端 KgMessageMapper.xml 的 bucketOf 同一口径。
// 只在服务端还没分组（老接口，列表没回 hasMore）时用来在本地挑出下面列表该放的行
const bucketOf = (m, staff) => {
  const c = m.category, act = c === 'system' && /^activity/.test(m.bizType || '')
  return c === 'comment' || c === 'like' ? c
    : staff && (act || /^(apply|interview|contract|staff)$/.test(c)) ? 'apply'
      : staff && c === 'order' ? 'order'
        : c === 'system' && !act ? 'system' : 'main'
}
// 列表行的样子：[图标, 色调, 小标签]。私信、群聊不带标签；不认识的分类按系统通知画
const KIND = {
  chat: ['message-circle', 'indigo'], group: ['users', 'green'], staff: ['briefcase-business', 'green'],
  order: ['receipt-text', 'ochre', '订单'], activity: ['ticket', 'ochre', '活动'],
  apply: ['clipboard-check', 'red', '报名'], interview: ['calendar-clock', 'red', '面试'], contract: ['file-signature', 'red', '签约'],
  system: ['bell', 'indigo']
}
const kindOf = (m) => KIND[m.category === 'system' && /^activity/.test(m.bizType || '') ? 'activity' : m.category] || KIND.system
// 顶部入口：[子页 type（也是 buckets 的键）, 名字, 图标, 色调]
const ENTRIES = {
  user: [['system', '平台通知', 'bell', 'indigo'], ['comment', '评论', 'message-square-text', 'green'], ['like', '赞', 'heart', 'red']],
  staff: [['system', '平台通知', 'bell', 'indigo'], ['apply', '报名', 'clipboard-check', 'green'], ['order', '订单', 'receipt-text', 'ochre']]
}

// 列表右侧的时间只有 createTime 一个真实来源：今天显示时分，昨天显示「昨天」，更早显示月日。
const parseTime = (value) => {
  if (!value) return null
  const raw = String(value)
  // 服务端两种格式都可能出现：ISO 串（2026-09-12T14:16:35.000-08:00）直接交给 Date，
  // 'yyyy-MM-dd HH:mm:ss' 则要先把横杠换成斜杠，否则 iOS 与小程序解析不了
  const d = new Date(raw.indexOf('T') > 0 ? raw : raw.replace(/-/g, '/'))
  return isNaN(d.getTime()) ? null : d
}
const formatTime = (value) => {
  const d = parseTime(value)
  // 解析不出来就留空，宁可少一行时间，也不要把原始时间串堆到列表上撑坏排版
  if (!d) return ''
  const pad = (n) => (n < 10 ? '0' + n : '' + n)
  const now = new Date()
  const sameDay = (a, b) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
  if (sameDay(d, now)) return pad(d.getHours()) + ':' + pad(d.getMinutes())
  if (sameDay(d, new Date(now.getTime() - 86400000))) return '昨天'
  return pad(d.getMonth() + 1) + '-' + pad(d.getDate())
}

const staff = computed(() => experience.mode === 'staff')
const guest = computed(() => session.restored && !experience.account)

// category + bucket=main 由服务端先筛选再分页。system 在 main 下只有活动通知，不能只筛当前已加载的一页。
const TOPICS = [
  ['interview', '面试', 'calendar-clock', '#456D98'], ['contract', '签约', 'file-signature', '#947043'],
  ['apply', '报名', 'clipboard-check', '#547B60'], ['order', '订单', 'receipt-text', '#B36745'],
  ['system', '活动', 'ticket', '#9B5F79'], ['chat', '私信', 'message-circle', '#477C86'],
  ['group', '群聊', 'users', '#6973A0'], ['staff', '工作', 'briefcase-business', '#70794B']
]
const categoryCounts = ref([])
const activeCategory = ref('interview')
watch(groupChatEnabled, enabled => { if (!enabled && activeCategory.value === 'group') selectCategory('chat') })
const categories = computed(() => {
  const base = staff.value ? TOPICS.filter(t => ['chat', 'group'].includes(t[0])) : TOPICS
  const known = new Set([...TOPICS.map(t => t[0]), 'comment', 'like'])
  const other = categoryCounts.value.filter(c => c.category && c.category !== 'system' && !known.has(c.category))
    .map((c, i, all) => [c.category, all.length > 1 ? '其他' + (i + 1) : '其他', 'bell', '#69727B'])
  return [...base, ...other].filter(t => t[0] !== 'group' || groupChatEnabled.value).map(([key, label, icon, color]) => {
    const count = categoryCounts.value.find(c => c.category === key) || {}
    // 系统分类中扣掉顶部系统通知入口，余下才是活动；不把公告/审核等算成活动未读。
    const excluded = key === 'system' ? buckets.value?.system : null
    const total = key === 'system' && !excluded ? 0 : Math.max(0, Number(count.total || 0) - Number(excluded?.total || 0))
    const unread = key === 'system' && !excluded ? 0 : Math.max(0, Number(count.unread || 0) - Number(excluded?.unread || 0))
    return { key, label: key === 'chat' && !privateChatEnabled.value ? '业务沟通' : label, icon, color, total, unread }
  })
})
const activeLabel = computed(() => categories.value.find(c => c.key === activeCategory.value)?.label || '业务沟通')
const messageScope = getMessageScopeKey
let categoryScope = ''

// 角标：buckets 是服务端按组数的 {total, unread}；公告是否看过记在本机（common/notice.js），没看过的算进「系统通知」。
// 列表每行只显示一行：换行、连续空白并成一个空格（小程序 <text> 会把换行真的显示出来，撑高整行压到上下两条；10-16 主人截图）
const oneLine = (v) => String(v || '').replace(/[\s\u3000]+/g, ' ').trim()
// 对方头像用背景图（不用 <image>）：盖在首字头像上面，没头像、图裂了都还看得到底下的字。网址里的引号、括号、空白会弄坏 url()，去掉
const avatarStyle = (v) => { const u = absUrl(v); return u ? 'background-image:url("' + String(u).replace(/["\\\s()]/g, '') + '")' : '' }
// 服务端还没分组（老接口：/summary 没有 buckets，列表一次回全部）时，拿手上的全量列表按 bucketOf 在本地数
const buckets = ref(null)
const notices = ref([])
const noticeSeen = ref({})
const badgeCleared = ref({})
const unseenNotices = computed(() => notices.value.filter(n => noticeBadged(n, noticeSeen.value, badgeCleared.value)).length)
const unreadOf = (type) => buckets.value ? (buckets.value[type] || {}).unread || 0
  : experience.messagesMore === null ? visibleMessages.value.filter(m => !m.read && bucketOf(m, staff.value) === type).length : 0
const entries = computed(() => ENTRIES[staff.value ? 'staff' : 'user'].map(([type, label, icon, tone]) => ({
  type, label, icon, tone, badge: unreadOf(type) + (type === 'system' ? unseenNotices.value : 0)
})))
// 游客也能看公告，所以「系统通知」照常打开（子页里只有公告和登录提示）；评论、赞要先登录
const openEntry = (e) => go(experience.account || e.type === 'system' ? R.inbox + '?type=' + e.type : R.login)

const PAGE = 20
const rows = computed(() => visibleMessages.value
  .filter(m => privateChatEnabled.value || (m.conversationType !== 'private' && (m.category !== 'chat' || m.conversationType === 'store')))
  .filter(m => experience.messagesMore !== null || bucketOf(m, staff.value) === 'main')
  .map(m => {
    const shown = messageWording(m)
    return { id: m.id, title: oneLine(shown.title), desc: oneLine(shown.content), time: formatTime(m.createTime), read: !!m.read, unread: Number(m.unreadCount || 1), route: m.route || '', k: kindOf(m), ini: m.category === 'chat' ? oneLine(m.title).slice(0, 1) : '', name: oneLine(m.peerName), source: oneLine(shown.sourceLabel), avatar: avatarStyle(m.peerAvatar), category: m.category, bizType: m.bizType, color: TOPICS.find(t => t[0] === m.category)?.[3] || '#69727B', wordingUpdated: shown.title !== (m.title || '') || shown.content !== (m.content || '') || shown.sourceLabel !== (m.sourceLabel || ''), originalText: [m.title, m.sourceLabel, m.content].filter(Boolean).join('\n\n') }
  }))
const categoryRows = computed(() => rows.value.filter(m => m.category === activeCategory.value && bucketOf(m, staff.value) === 'main'))
const recentUnread = computed(() => categories.value.find(c => c.key === activeCategory.value)?.unread || 0)
const empty = computed(() => guest.value ? ['登录后查看消息', '登录后可查看报名、面试、订单等通知', '去登录']
  : ['暂无' + activeLabel.value + '消息', '这类消息会单独显示在这里，可切换上方分类查看其他消息', staff.value ? '返回工作台' : '去首页看看'])
const emptyAction = () => (guest.value ? go(R.login) : relaunch(staff.value ? R.staff : R.home))

// route 由服务端随消息下发（如 /pages/jobs/progress?appId=12），为空说明这条消息没有落地页；
// 落地页是消息页本身的只标已读（带 ?s=4 的在本页弹出 AI袋鼠），不再压一层一模一样的消息页
const openMessage = (m) => {
  if (managing.value || deleting.value || Date.now() < suppressOpenUntil) return
  if (!m.read) {
    const count = categoryCounts.value.find(c => c.category === m.category)
    if (count) count.unread = Math.max(0, Number(count.unread || 0) - m.unread)
  }
  const scope = messageScope()
  Promise.resolve(markMessageRead(m.id)).then(() => { if (scope === messageScope()) scheduleExpiry() })
  scheduleExpiry()
  if (!m.route) return
  if (!/^\/?pages\/messages\/index/.test(m.route)) { if(m.category==='chat'||m.category==='group')go(m.route);else showMessagePreview({title:m.title,content:m.originalText,route:m.route}) }
  else if (/[?&]s=4(&|$)/.test(m.route)) aiOpen.value = true
}
const removeMessage = async (m) => {
  if (deleting.value) return
  const scope = messageScope()
  deleting.value = true
  suppressOpenUntil = Date.now() + 1000
  try {
    if (!await removeInboxMessage(m.id) || scope !== messageScope()) return
    cursor = 0
    await load()
    const r = await apiMessageSummary(experience.mode)
    if (scope === messageScope()) {
      buckets.value = r.buckets || null
      categoryCounts.value = Array.isArray(r.categories) ? r.categories : []
    }
  } catch (_) { /* 删除已成功，统计下一次进入时重新获取 */ }
  finally { deleting.value = false; suppressOpenUntil = Date.now() + 500 }
}
// 左上角「全部已读」清掉当前身份所有分组的未读，公告的角标也一起清（2026-10-17；公告要弹的照样在首页弹一次）
const readAll = async () => {
  const scope = messageScope()
  try {
    await markAllMessagesRead()
    if (scope !== messageScope()) return
    badgeCleared.value = clearNoticeBadge(notices.value)
    buckets.value = null
    categoryCounts.value = categoryCounts.value.map(c => ({ ...c, unread: 0 }))
    // 回读服务端首次已读时间，覆盖设备时钟或其他设备已读造成的本地估计差异。
    if (pageVisible) await load()
    if (pageVisible && scope === messageScope()) toast('已全部标为已读')
  } catch (e) {
    if (pageVisible && scope === messageScope()) toast(e?.message || '操作失败，请稍后再试')
  }
}

// 第一页回来之前不显示空状态，免得闪一下「还没有消息」；取失败时也不说「还没有消息」，给一行重试
const ready = ref(false)
const paging = ref(false)
// 取失败：1 第一页、2 下一页（重试时接着取同一种）
const failed = ref(0)
// 服务端已经翻过的条数。下一页的页码按它算，不按去重后的本地条数算：新消息把旧行往下挤时，下一页开头会和已有的行重复，
// 去重后本地条数变少，按本地条数算会一直重取同一页、再也翻不下去
let cursor = 0
let busy = false
let seq = 0
let expiryTimer = null
let pageVisible = true
const clearExpiry = () => { if (expiryTimer) clearTimeout(expiryTimer); expiryTimer = null }
const scheduleExpiry = () => {
  clearExpiry()
  if (!pageVisible) return
  const deadlines = visibleMessages.value.filter(m => m.read && Number(m.expiresAt) > 0).map(m => Number(m.expiresAt))
  if (deadlines.length) expiryTimer = setTimeout(() => load(), Math.min(2147483647, Math.max(60000, Math.min(...deadlines) - Date.now() + 500)))
}
// more=false：从第一页重取（每次进来都取：消息会在报名、聊天等别的页面里产生、被读掉），已经往下翻过的按翻过的条数一次取回（最多 50）；
// more=true：接着取下一页，按 id 去重。重取会顶掉还在路上的下一页；重取没回来之前不翻页
const load = async (more) => {
  if (more && (busy || experience.messagesMore !== true)) return
  const my = ++seq
  const scope = messageScope()
  const page = more ? Math.floor(cursor / PAGE) + 1 : 1
  const size = more ? PAGE : Math.min(50, Math.max(PAGE, Math.ceil(cursor / PAGE) * PAGE))
  busy = true
  paging.value = !!more
  try {
    const got = await loadMessages(activeCategory.value, { bucket: 'main', page, size }, more)
    if (my !== seq || scope !== messageScope()) return
    // 这一页被「全部已读」等更新的写入顶掉时没有落到列表上，翻页位置不动
    if (got === experience.messages) cursor = page * size
    failed.value = 0
    ready.value = true
    scheduleExpiry()
  } catch (e) {
    if (my !== seq || scope !== messageScope()) return
    failed.value = more ? 2 : 1
    toast(e?.message || '消息加载失败')
    scheduleExpiry()
  } finally {
    if (my === seq) busy = paging.value = false
  }
}
const selectCategory = (key) => {
  if (key === activeCategory.value || !categories.value.some(c => c.key === key)) return
  activeCategory.value = key
  cursor = 0
  ready.value = false
  failed.value = 0
  load()
}
onReachBottom(() => load(true))
// 冷启动时登录态还在恢复，先 await ensureSession，否则会把已登录用户误判成游客而不发请求
let showRequest = 0
onHide(() => { pageVisible = false; showRequest++; seq++; busy = paging.value = false; clearExpiry() })
watch(privateChatEnabled, () => { if (experience.account) load() })
const refreshInbox = async () => {
  pageVisible = true
  if (leaving) return
  const show = ++showRequest
  await ensureSession()
  if (show !== showRequest) return
  const scope = messageScope()
  const newScope = categoryScope !== scope
  if (newScope) {
    categoryScope = scope
    categoryCounts.value = []
    buckets.value = null
    activeCategory.value = staff.value ? 'chat' : 'interview'
    cursor = 0
    ready.value = false
  }
  noticeSeen.value = readSeenNotices()
  badgeCleared.value = readNoticeBadgeCleared()
  // 公告取不到时只是「系统通知」少算几个角标，不影响消息
  apiNotices().then(r => {
    if (show === showRequest && scope === messageScope()) notices.value = r.data || []
  }, () => {})
  if (!experience.account) {
    ready.value = true
    return
  }
  const selectedBeforeSummary = activeCategory.value
  try {
    const r = await apiMessageSummary(experience.mode)
    if (show !== showRequest || scope !== messageScope()) return
    buckets.value = r.buckets || null
    categoryCounts.value = Array.isArray(r.categories) ? r.categories : []
    if (newScope && activeCategory.value === selectedBeforeSummary) {
      activeCategory.value = (categories.value.find(c => c.unread) || categories.value.find(c => c.total) || categories.value[0]).key
    }
  } catch (_) { /* 统计失败仍能按分类查询消息 */ }
  if (show !== showRequest || scope !== messageScope()) return
  load()
}
watch(messageScope, () => {
  showRequest++
  seq++
  categoryScope = ''
  notices.value = []
  categoryCounts.value = []
  buckets.value = null
  ready.value = false
  failed.value = 0
  busy = paging.value = false
  clearExpiry()
  if (pageVisible) refreshInbox()
})
onShow(refreshInbox)
</script>

<style scoped lang="scss">
.wording-original { display: block; font-size: 11px; line-height: 16px; color: var(--k-muted); margin-top: 4px; }
.read-all{line-height:20px;white-space:nowrap}.read-all:active{opacity:.7}
.entries{display:grid;grid-template-columns:repeat(3,1fr)}
.entry{display:flex;flex-direction:column;align-items:center}
.tile{position:relative;display:flex;align-items:center;justify-content:center}
.badge{position:absolute;padding:0 4px;border:2px solid var(--k-paper);border-radius:9px;background:var(--k-alert);color:#fff;text-align:center}
.tile,.ava{background:var(--k-red-soft)!important}
.row{position:relative;display:flex;align-items:center}
.row+.row::before{content:'';position:absolute;top:0;height:1px;background:var(--k-line)}
.ava{flex:none;display:flex;align-items:center;justify-content:center}
.ava--ini{background:var(--k-red-soft)!important;color:var(--k-red-deep)}
.row__main{flex:1;min-width:0;overflow:hidden}
.row__head{display:flex;align-items:center}
.tag{flex:none;padding:0 5px;border-radius:4px;font-size:11px;line-height:17px;font-weight:500}
.g-ochre{background:var(--k-ochre-soft);color:var(--k-ochre-deep)}.g-red{background:var(--k-red-soft);color:var(--k-red-deep)}
.row__title{flex:1;min-width:0}
.row__desc{display:block;color:var(--k-muted)}
.row__side{align-self:stretch;display:flex;flex-direction:column;align-items:flex-end;justify-content:center;color:var(--k-muted)}
.dot{width:8px;height:8px;border-radius:50%;background:var(--k-alert)}
.empty{display:flex;flex-direction:column;align-items:center;gap:8px;padding:28px 16px;text-align:center}
.empty__ring{width:56px;height:56px;margin-bottom:4px;border-radius:16px;background:var(--k-red-soft);display:flex;align-items:center;justify-content:center}
.empty__title{font-size:14px;font-weight:500;color:var(--k-ink2)}
.empty__copy{margin-bottom:8px;color:var(--k-muted)}
.more{display:block;padding:14px 0 0;text-align:center;font-size:12px;color:var(--k-muted)}
.help{text-align:center;color:var(--k-muted)}
@import './messages-home.scss';

.msg-page.user-surface {
  background: var(--k-page);
  .entries { margin-top: 10px; box-shadow: var(--k-sh1); }
  .tile { width: 41px; height: 41px; border-radius: 11px; }
  .categories { margin: 10px 16px 0; padding: 4px; gap: 1px 2px; border-radius: 12px; background: var(--k-paper); }
  .category { height: 44px; border-radius: 9px; line-height: 18px; }
  .category--active { color: var(--k-red-deep); background: var(--k-red-soft); }
  .category--active::before { display: none; }
  .row--unread { background: #FFF9F0; }
  .row__source { background: var(--k-red-soft); color: var(--k-red-deep); }
  .empty { padding: 24px 16px; }
  .empty__ring { width: 49px; height: 49px; border-radius: 15px; background: var(--user-icon-field); box-shadow: none; }
  .empty__copy { max-width: 20em; }
  .help { min-height: 44px; margin-top: 6px; }
}
</style>
