<template>
  <view class="k-page inbox-page">
    <k-topbar :title="personId ? '报名人的消息记录' : TITLES[type]" back />
    <view class="inbox-body k-pad-safe"><text v-if="type==='system'" class="inbox-explain">账号、内容审核、心愿处理与平台公告；报名、面试和订单请到对应分类查看。</text>
      <view v-if="experience.account" class="inbox-tools"><text>历史消息保留，长按可删除</text><button @click="managing = !managing">{{ managing ? '完成' : '管理' }}</button></view>
      <!-- 公告（后台「小程序公告」发布，游客也能看）：列最新两条，点「全部」看完整列表 -->
      <view v-if="type === 'system' && notices.length" class="ann">
        <view class="ann__head" hover-class="k-press" @click="go(R.notice + '?s=1')"><view class="ann__left"><k-icon name="bell-ring" :size="18" color="red" /><text class="ann__title">公告</text></view><view class="ann__left"><text class="ann__more">全部 {{ notices.length }} 条</text><k-icon name="chevron-right" :size="16" color="muted" /></view></view>
        <view v-for="n in notices.slice(0, 2)" :key="n.noticeId" class="ann__row" hover-class="k-press" @click="go(R.notice + '?id=' + n.noticeId)"><text class="ann__name k-ellipsis">{{ n.title }}</text><text v-if="n.fresh" class="ann__dot" /><text class="ann__date">{{ n.date }}</text></view>
      </view>

      <view v-if="type === 'system' && experience.account" class="unread-summary">
        <text>{{ unreadCount === null ? '未读消息' : `未读消息 ${unreadCount} 条` }}</text>
        <button v-if="unreadFailed" @click="loadUnreadCount">数量暂未获取，点此重试</button>
      </view>
      <view v-for="sec in sections" :key="sec.name" class="sec">
        <text v-if="sec.name" class="sec__name">{{ sec.name }}</text>
        <view class="group">
          <view v-for="m in sec.rows" :key="m.id" class="it" hover-class="k-press" @click="open(m)" @longpress.stop="removeMessage(m)">
            <text v-if="m.fresh" class="it__dot" />
            <!-- 评论 / 赞：对方头像（大多数账号没有头像，用昵称第一个字） + 动态首图 -->
            <template v-if="m.social">
              <image v-if="m.avatar" class="ava" :src="m.avatar" mode="aspectFill" />
              <view v-else-if="m.initial" class="ava ava--txt" :class="'c' + m.tint"><text>{{ m.initial }}</text></view>
              <view v-else class="tile" :class="'t-' + m.k[1]"><k-icon :name="m.k[0]" :size="22" :color="m.k[1]" /></view>
              <view class="it__main">
                <text class="it__name k-ellipsis">{{ m.name }}</text>
                <text class="it__act">{{ m.action }}</text>
                <text v-if="m.body" class="it__body">{{ m.body }}</text>
                <text v-if="m.wordingUpdated" class="wording-original" @click.stop="alert('消息原文', m.originalText)">称呼已更新 · 查看原文</text>
                <text v-if="m.quote" class="it__quote k-ellipsis">{{ m.quote }}</text>
              </view>
              <image v-if="m.cover" class="thumb" :src="m.cover" mode="aspectFill" />
              <view v-else class="thumb thumb--txt"><text>{{ m.postTitle }}</text></view>
            </template>
            <template v-else>
              <view class="tile" :class="'t-' + m.k[1]"><k-icon :name="m.k[0]" :size="22" :color="m.k[1]" /></view>
              <view class="it__main">
                <view class="it__top"><text class="it__title k-ellipsis">{{ m.title }}</text><text class="it__time">{{ m.time }}</text></view>
                <text class="it__desc">{{ m.desc }}</text>
                <text v-if="m.wordingUpdated" class="wording-original" @click.stop="alert('消息原文', m.originalText)">称呼已更新 · 查看原文</text>
              </view>
            </template>
            <button v-if="managing" class="message-delete" :disabled="deleting" aria-label="删除消息" @click.stop="removeMessage(m)"><k-icon name="trash-2" :size="18" color="alert" /></button>
          </view>
        </view>
      </view>

      <text v-if="paging" class="more">加载中…</text>
      <text v-else-if="failed" class="more" @click="load(failed === 2)">加载失败，点这里重试</text>
      <text v-else-if="rows.length >= PAGE && !hasMore" class="more">没有更多了</text>
      <view v-else-if="ready && !rows.length" class="empty">
        <view class="empty__ring"><k-icon :name="EMPTY[type][1]" :size="36" color="muted" /></view>
        <text class="empty__title">{{ experience.account ? EMPTY[type][0] : '登录后查看消息' }}</text>
        <k-button v-if="!experience.account" type="secondary" size="sm" label="去登录" @click="go(R.login)" />
        <k-button v-else-if="communityEnabled && type === 'comment'" type="secondary" size="sm" label="去社区发一条" @click="go(R.publish)" />
      </view>
    </view>
  </view>
</template>

<script setup>
import { communityEnabled } from "@/common/features.js"
// ---------------------------------------------------------------------------
// 消息分组子页（分包）：消息页顶部三个入口点进来，?type=
//   用户身份 system 系统通知（顶部是公告卡片）/ comment 收到的评论 / like 收到的赞；
//   员工身份 system 系统通知 / apply 报名（报名、面试、签约、活动报名） / order 订单。
// 进入页面只读取消息，点开单条才标记已读。平台通知未读数量取服务端当前身份的
// buckets.system.unread，统计全部页；公告保留独立阅读状态，不混入正文通知数量。
// ---------------------------------------------------------------------------
import { ref, computed, watch } from 'vue'
import { onLoad, onShow, onHide, onUnload, onReachBottom } from '@dcloudio/uni-app'
import { go, toast } from '@/common/screen.js'
import { apiMessages, apiMessageSummary, apiMarkRead, apiNotices } from '@/common/api.js'
import { experience, ensureSession, refreshUnread, getMessageScopeKey } from '@/common/experience.js'
import { readSeenNotices, rememberNoticeSeen, clearNoticeBadge } from '@/common/notice.js'
import { absUrl } from '@/common/upload.js'
import R from '@/common/routes.js'
import { removeInboxMessage } from '@/common/message-actions.js'
import { messageWording } from '@/common/display-wording.js'
import { alert } from '@/common/ui.js'
import { get } from '@/common/request.js'
import { showMessagePreview } from '@/common/message-preview.js'

const managing = ref(false)
const deleting = ref(false)
let suppressOpenUntil = 0
let loadRequest = 0
const messageScope = getMessageScopeKey

const TITLES = { system: '平台通知', comment: '收到的评论', like: '收到的赞', apply: '报名', order: '订单' }
// 空状态：[标题, 图标]
const EMPTY = {
  system: ['暂无系统通知', 'bell'], comment: ['还没有人评论你的动态', 'message-square-text'], like: ['还没有收到赞', 'heart'],
  apply: ['暂无报名通知', 'clipboard-check'], order: ['暂无订单通知', 'receipt-text']
}
const PAGE = 20

// 每条消息归哪一组，和服务端 KgMessageMapper.xml 的 bucketOf、消息页 pages/messages/index.vue 同一口径
const bucketOf = (m, staff) => {
  const c = m.category, act = c === 'system' && /^activity/.test(m.bizType || '')
  return c === 'comment' || c === 'like' ? c
    : staff && (act || /^(apply|interview|contract|staff)$/.test(c)) ? 'apply'
      : staff && c === 'order' ? 'order'
        : c === 'system' && !act ? 'system' : 'main'
}
// 非互动行左边的彩色图块：[图标, 色调]。系统通知再按 bizType 细分
const KIND = {
  order: ['receipt-text', 'ochre'], apply: ['clipboard-check', 'red'], interview: ['calendar-clock', 'red'],
  contract: ['file-signature', 'red'], staff: ['briefcase-business', 'green'], activity: ['ticket', 'ochre'],
  job: ['briefcase-business', 'green'], support: ['headset', 'indigo'], post: ['message-square-text', 'green'],
  gift: ['gift', 'red'], report: ['file-text', 'indigo'], system: ['bell', 'indigo']
}
const kindOf = (m) => {
  const b = m.bizType || ''
  if (m.category !== 'system') return KIND[m.category] || KIND.system
  return KIND[/^activity/.test(b) ? 'activity' : /^(job|online|task)/.test(b) ? 'job' : /^support/.test(b) ? 'support'
    : /^(post|review|appeal)/.test(b) ? 'post' : /^(birthday|gift)/.test(b) ? 'gift' : /report/.test(b) ? 'report' : 'system']
}

const parseTime = (value) => {
  if (!value) return null
  const raw = String(value)
  // ISO 串直接交给 Date；'yyyy-MM-dd HH:mm:ss' 要先把横杠换成斜杠，否则 iOS 与小程序解析不了
  const d = new Date(raw.indexOf('T') > 0 ? raw : raw.replace(/-/g, '/'))
  return isNaN(d.getTime()) ? null : d
}
// 今天显示时分，昨天显示「昨天」，今年显示月日，更早带上年份
const formatTime = (value) => {
  const d = parseTime(value)
  if (!d) return ''
  const pad = (n) => (n < 10 ? '0' + n : '' + n)
  const now = new Date()
  const sameDay = (a, b) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
  if (sameDay(d, now)) return pad(d.getHours()) + ':' + pad(d.getMinutes())
  if (sameDay(d, new Date(now.getTime() - 86400000))) return '昨天'
  const md = pad(d.getMonth() + 1) + '-' + pad(d.getDate())
  return d.getFullYear() === now.getFullYear() ? md : d.getFullYear() + '-' + md
}

// 互动行的标题由服务端拼好：「晨光 评论了你的动态」「阿布 回复了你的评论」「晨光 等 3 人赞了你的动态」，
// 拆成两行显示：昵称（赞是「晨光 等 3 人」） + 动作。拆不开的（迁过来的老评论通知「你的动态有新评论」）整句当第一行；
// 老通知迁移时补上了评论人的，第一行写昵称，动作按老标题换成同样的说法
const ACTION = /^(.*?)\s*((?:赞|评论|回复)了你的(?:动态|评论))$/
const OLD_ACTION = { '你的动态有新评论': '评论了你的动态', '有人回复了你的评论': '回复了你的评论' }
const social = (m, time) => {
  // 老标题「有人回复了你的评论」也套得上新格式，会把「有人」当成昵称：老标题先排除
  const hit = !OLD_ACTION[m.title] && ACTION.exec(m.title || '')
  const name = hit ? hit[1] : (m.actorName || m.title || '')
  const verb = hit ? hit[2] : m.actorName ? OLD_ACTION[m.title] : ''
  return {
    social: true,
    name,
    action: verb ? verb + ' · ' + time : time,
    avatar: m.actorAvatar ? absUrl(m.actorAvatar) : '',
    // 没有头像时用昵称第一个字，底色按人在 4 种浅色里轮换（同一个人每次同一种颜色）
    // 迁过来的老评论通知没有记是谁（actorName 为空、标题也拆不开）：不编名字，画评论 / 赞的图块
    initial: hit || m.actorName ? Array.from(m.actorName || name || '袋')[0] : '',
    k: m.category === 'like' ? ['heart', 'red'] : ['message-square-text', 'green'],
    tint: Math.abs(Number(m.actorId) || 0) % 4,
    // 评论的正文；赞没有正文，被赞的那条评论放进引用
    body: m.category === 'comment' ? m.content || '' : '',
    quote: m.quote || (m.category === 'like' && m.bizType === 'comment_like' ? m.content || '' : ''),
    cover: m.cover ? absUrl(m.cover) : '',
    postTitle: m.postTitle || '动态'
  }
}
const toRow = (m, fresh) => {
  const time = formatTime(m.createTime)
  const shown = messageWording(m)
  const base = { personId:m.personId, threadCount:m.threadCount, id: m.id, route: m.route || '', fresh, read: !!m.read, expiresAt: m.expiresAt, wordingUpdated: shown.title !== (m.title || '') || shown.content !== (m.content || '') || shown.postTitle !== (m.postTitle || ''), originalText: [m.title, m.content, m.postTitle].filter(Boolean).join('\n\n') }
  if (m.category === 'comment' || m.category === 'like') return { ...base, ...social(m, time), body: m.category === 'comment' ? shown.content : '', postTitle: shown.postTitle || '动态' }
  // 标题只占一行：带换行的标题（聊天会话名、门店写的多行标题）之前会折成两行，和右边的时间错开
  return { ...base, title: String(m.personName||shown.title).replace(/[\s　]+/g, ' ').trim(), desc: (m.threadCount?`${m.threadCount}条记录 · `:'')+shown.content, time, k: kindOf(m) }
}

const personId=ref(null)
const type = ref('system')
const rows = ref([])
const hasMore = ref(false)
const paging = ref(false)
const ready = ref(false)
let pageVisible = true
let hasShown = false
let expiryTimer = null
const clearExpiry = () => { if (expiryTimer) clearTimeout(expiryTimer); expiryTimer = null }
// 计时器只重新查询收件箱，是否过期由服务端决定；设备时钟偏差不会删除未读或聊天记录。
const scheduleExpiry = () => {
  clearExpiry()
  if (!pageVisible) return
  const deadlines = rows.value.filter(m => m.read && Number(m.expiresAt) > 0).map(m => Number(m.expiresAt))
  if (deadlines.length) expiryTimer = setTimeout(() => load(false), Math.min(2147483647, Math.max(60000, Math.min(...deadlines) - Date.now() + 500)))
}
const rememberRead = (list, ids, now = Date.now()) => {
  list.forEach(m => {
    if (!ids.has(String(m.id))) return
    m.read = true
  })
}
// 取失败：1 第一页、2 下一页（重试时接着取同一种）
const failed = ref(0)
let fetched = 0
let loadedScope = ''
const unreadCount = ref(null)
const unreadFailed = ref(false)
let unreadRequest = 0
async function loadUnreadCount() {
  const request = ++unreadRequest, scope = messageScope()
  if (type.value !== 'system' || !experience.account) return
  unreadFailed.value = false
  try {
    const res = await apiMessageSummary(experience.mode)
    if (!pageVisible || request !== unreadRequest || scope !== messageScope()) return
    const count = res?.buckets?.system?.unread
    if (count == null || !Number.isSafeInteger(Number(count)) || Number(count) < 0) throw new Error('未读数量暂未获取')
    unreadCount.value = Number(count)
  } catch (_) {
    if (!pageVisible || request !== unreadRequest || scope !== messageScope()) return
    unreadCount.value = null
    unreadFailed.value = true
  }
}
const freshOf = (m) => !m.read
// 分成「新的」「更早」两段；只有一种时不写段名
const sections = computed(() => {
  const fresh = rows.value.filter(m => m.fresh), old = rows.value.filter(m => !m.fresh)
  if (type.value === 'system') return [
    ...(fresh.length ? [{ name: '', rows: fresh }] : []),
    ...(old.length ? [{ name: '已读消息', rows: old }] : [])
  ]
  if (!fresh.length || !old.length) return rows.value.length ? [{ name: '', rows: rows.value }] : []
  return [{ name: '新的', rows: fresh }, { name: '更早', rows: old }]
})

// 公告：没看过当前版本的标小红点。进「系统通知」就算看过（入口角标跟着清），
// 但要弹窗提醒的公告（如「线上兼职须知」）不在这里记，留给首页弹窗或点开全文
const notices = ref([])
const loadNotices = async () => {
  try {
    const seen = readSeenNotices()
    notices.value = ((await apiNotices()).data || []).map(n => ({ ...n, fresh: !n.read && (Number(seen[String(n.noticeId)]) || 0) < (Number(n.version) || 1) }))
    
    // 要弹窗的公告这里不记「看过」（留给首页弹窗），但入口角标要清掉，否则弹窗没出来时角标一直是 1（2026-10-17 主人反馈）
    
  } catch (e) {
    // 公告取不到时卡片不显示，不影响下面的通知
    notices.value = []
  }
}

async function load(more) {
  if (more && (paging.value || !hasMore.value)) return
  const request = ++loadRequest, scope = messageScope()
  if (scope !== loadedScope) {
    loadedScope = scope
    rows.value = []
    fetched = 0
    more = false
    clearExpiry()
  }
  paging.value = true
  if (!more) { unreadCount.value = null; loadUnreadCount() }
  const mode = experience.mode
  let paged = false
  try {
    if (!experience.account) return (ready.value = true)
    const queryPage=more ? Math.floor(fetched / PAGE) + 1 : 1
    const res = type.value==='apply' && mode==='staff' ? await get('/app/message/application-threads',{page:queryPage,personId:personId.value||undefined}) : await apiMessages(mode, undefined, { bucket: type.value, page: queryPage, size: PAGE })
    if (request !== loadRequest || scope !== messageScope()) return
    const list = res.rows || []
    paged = typeof res.hasMore === 'boolean'
    fetched = (more ? fetched : 0) + list.length
    // Only the explicitly opened message is marked read.
    const previous = more ? rows.value : []
    const seen = new Set(previous.map(m => m.id))
    rows.value = previous.concat(list.filter(m => !seen.has(m.id) && (paged || bucketOf(m, mode === 'staff') === type.value)).map(m => toRow(m, freshOf(m))))
    hasMore.value = paged && res.hasMore
    failed.value = 0
    ready.value = true
  } catch (e) {
    if (request !== loadRequest || scope !== messageScope()) return
    // 取失败时不显示「暂无…」，免得把网络问题说成没有通知
    paged = false
    failed.value = more ? 2 : 1
    toast((e && e.message) || '消息加载失败')
  } finally {
    if (request === loadRequest) { paging.value = false; scheduleExpiry() }
  }
}

// 点开单条才确认已读，再刷新本页完整数量和底栏角标。
const open = (m) => {
  if (managing.value || deleting.value || Date.now() < suppressOpenUntil) return
  if(m.personId)return go(R.inbox+'?type=apply&personId='+m.personId)
  if (!m.read && !m.marked) {
    m.marked = true
    const scope = messageScope()
    apiMarkRead(m.id).then(res => {
      if (scope !== messageScope()) return
      const updated = res?.data?.updated
      if (updated != null && Number(updated) >= 0) {
        rememberRead([m], new Set([String(m.id)])); m.fresh = false
        if (unreadCount.value !== null && Number(updated) > 0) unreadCount.value = Math.max(0, unreadCount.value - 1)
      }
      loadUnreadCount()
      scheduleExpiry()
      refreshUnread()
    }).catch(() => { m.marked = false })
  }
  showMessagePreview({title:m.title||m.name,content:m.desc||m.body||m.quote,route:m.route})
}

const removeMessage = async (m) => {
  if (deleting.value) return
  const scope = messageScope()
  deleting.value = true
  suppressOpenUntil = Date.now() + 1000
  try {
    if (!await removeInboxMessage(m.id) || scope !== messageScope()) return
    rows.value = rows.value.filter(row => row.id !== m.id)
    await load(false)
  } finally { deleting.value = false; suppressOpenUntil = Date.now() + 500 }
}

onLoad(async (q) => {
  type.value = TITLES[q && q.type] ? q.type : 'system'
  personId.value=Number(q?.personId)||null
  await ensureSession()
  if (type.value === 'system') loadNotices()
  load(false)
})
onShow(() => {
  pageVisible = true
  if (hasShown) load(false)
  hasShown = true
})
const leave = () => { pageVisible = false; clearExpiry(); loadRequest++; unreadRequest++; paging.value = false }
watch(messageScope, () => {
  loadRequest++
  unreadRequest++
  unreadCount.value = null
  unreadFailed.value = false
  rows.value = []
  hasMore.value = false
  ready.value = false
  failed.value = 0
  paging.value = false
  managing.value = false
  clearExpiry()
  if (pageVisible) load(false)
})
onHide(leave)
onUnload(leave)
onReachBottom(() => load(true))
</script>

<style scoped lang="scss">
.wording-original { display: block; font-size: 11px; line-height: 18px; color: var(--k-muted); text-decoration: underline; margin-top: 3px; }
.inbox-explain{display:block;margin:12px 16px;font-size:13px;line-height:1.7;color:var(--k-muted)}
.inbox-page{background:var(--k-bg)}
.inbox-body{padding-top:4px}
.inbox-tools{display:flex;align-items:center;justify-content:space-between;margin:0 16px;gap:8px;color:var(--k-muted);font-size:11px}
.inbox-tools button{margin:0 -6px 0 0;padding:10px 6px;background:transparent;color:#8A623E;font-size:12px;line-height:22px}
.inbox-tools button::after,.message-delete::after{border:0}
.unread-summary{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:16px 16px 6px;font-size:14px;font-weight:600;color:var(--k-ink)}
.unread-summary button{margin:0;padding:8px 0;background:transparent;color:var(--k-muted);font-size:11px;line-height:1.5;font-weight:400}
.unread-summary button::after{border:0}
.message-delete{display:flex;align-items:center;justify-content:center;flex:0 0 32px;width:32px;height:44px;margin:0;padding:0;background:transparent}
.ann{margin:8px 16px 4px;padding:4px 14px 6px;border-radius:12px;background:var(--k-paper);box-shadow:var(--k-sh1)}
.ann__head{min-height:42px;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid var(--k-line)}
.ann__left{display:flex;align-items:center;gap:6px}
.ann__title{font-size:15px;font-weight:600}
.ann__more{font-size:12px;color:var(--k-muted)}
.ann__row{min-height:40px;display:flex;align-items:center;gap:8px}
.ann__row+.ann__row{border-top:1px dashed var(--k-line)}
.ann__name{flex:1;min-width:0;font-size:14px}
.ann__dot{width:6px;height:6px;border-radius:50%;background:var(--k-alert);flex:none}
.ann__date{flex:none;font-size:11px;color:var(--k-light)}
.sec__name{display:block;padding:12px 16px 6px;font-size:12px;color:var(--k-light)}
.group{margin-top:8px;background:var(--k-paper)}
.sec__name+.group{margin-top:0}
.it{position:relative;padding:14px 16px;display:flex;align-items:flex-start;gap:12px}
.it+.it::before{content:'';position:absolute;left:68px;right:0;top:0;height:1px;background:var(--k-line2);transform:scaleY(.5)}
.it__dot{position:absolute;left:8px;top:18px;width:6px;height:6px;border-radius:50%;background:var(--k-alert)}
.ava{width:40px;height:40px;border-radius:50%;flex:none}
.ava--txt{display:flex;align-items:center;justify-content:center;font-size:16px;font-weight:600}
.c0{background:var(--k-indigo-soft);color:var(--k-indigo)}.c1{background:var(--k-green-soft);color:var(--k-green)}.c2{background:var(--k-ochre-soft);color:#9B6A29}.c3{background:var(--k-red-soft);color:var(--k-red)}
.it__main{flex:1;min-width:0;display:flex;flex-direction:column;gap:3px}
.it__name{font-size:14px;font-weight:600}
.it__act{font-size:13px;color:var(--k-muted)}
.it__body{margin-top:3px;font-size:14px;line-height:1.55;display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:2;overflow:hidden}
.it__quote{margin-top:3px;padding-left:8px;border-left:2px solid var(--k-line2);font-size:12px;color:var(--k-light)}
.thumb{width:52px;height:52px;border-radius:8px;flex:none}
.thumb--txt{padding:6px;background:var(--k-paper2);font-size:11px;line-height:1.4;color:var(--k-muted);overflow:hidden}
.thumb--txt text{display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:2;overflow:hidden;word-break:break-all}
.tile{width:40px;height:40px;border-radius:12px;flex:none;display:flex;align-items:center;justify-content:center}
.t-indigo{background:var(--k-indigo-soft)}.t-green{background:var(--k-green-soft)}.t-red{background:var(--k-red-soft)}.t-ochre{background:var(--k-ochre-soft)}
.it__top{display:flex;align-items:center;gap:8px}
.it__title{flex:1;min-width:0;font-size:15px;font-weight:600}
.it__time{flex:none;font-size:11px;color:var(--k-light)}
.it__desc{font-size:13px;line-height:1.5;color:var(--k-muted);display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:2;overflow:hidden}
.more{display:block;padding:16px 0;text-align:center;font-size:12px;color:var(--k-light)}
.empty{display:flex;flex-direction:column;align-items:center;gap:12px;padding:56px 24px;text-align:center}
.empty__ring{width:80px;height:80px;border-radius:50%;background:var(--k-paper2);display:flex;align-items:center;justify-content:center}
.empty__title{font-size:16px;font-weight:600}
</style>
