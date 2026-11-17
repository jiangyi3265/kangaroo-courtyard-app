<template>
  <view class="k-page reminders">
    <k-topbar :title="titles[s - 1]" back custom-back @back="onBack" />

    <view v-if="s === 1" class="k-body k-pad-tab user-page">
      <view class="hello"><image :src="helloAvatar" mode="aspectFill" /><text>{{ helloName }}</text><view class="k-flex1" /><view class="k-row k-gap4" @click="s=4"><text>设置</text><k-icon name="chevron-right" :size="18" color="ink" /></view></view>
      <text class="count-title">共 {{ userReminders.length }} 条提醒</text>
      <view class="reminder-tabs">
        <button :class="{ active: reminderFilter === 'all' }" :aria-pressed="reminderFilter === 'all'" @click="reminderFilter = 'all'">全部 {{ userReminders.length }}</button>
        <button :class="{ active: reminderFilter === 'pending' }" :aria-pressed="reminderFilter === 'pending'" @click="reminderFilter = 'pending'">未读 {{ userPending }}</button>
        <button :class="{ active: reminderFilter === 'done' }" :aria-pressed="reminderFilter === 'done'" @click="reminderFilter = 'done'">已读 {{ userDone }}</button>
      </view>
      <view v-if="userRemindersLoading" class="reminder-empty"><text>正在加载提醒…</text></view>
      <view v-else-if="userReminderError" class="reminder-empty"><text>{{ userReminderError }}</text><k-button type="secondary" size="sm" @click="fetchReminders">重新加载</k-button></view>
      <view v-else-if="!filteredUserReminders.length" class="reminder-empty"><text>{{ reminderEmptyText }}</text></view>
      <view v-else class="user-list"><view v-for="item in filteredUserReminders" :key="item.id" class="user-reminder" @click="openReminder(item)"><view class="reminder-icon" :class="'reminder-icon--'+item.tone"><k-icon :name="item.icon" :size="18" color="white" /></view><view class="user-reminder__main"><text>{{ item.title }}</text><text>{{ item.desc }}</text></view><k-chip :tone="item.statusTone"><text>{{ item.status }}</text></k-chip><view class="user-reminder__next"><text>{{ item.source || item.time }}</text><text v-if="item.next">下一步：{{ item.next }}</text></view></view></view>
    </view>

    <view v-else-if="s === 2" class="k-body k-pad-tab merchant-page">
      <view class="shop-head"><image :src="storeImage" mode="aspectFill" /><view class="k-flex1"><text class="shop-head__name">{{ storeName }}</text><text class="shop-head__role">{{ storeRole }}</text></view><view class="switch-role" @click="go(R.staffBusiness + '?s=2')"><text>切换门店</text><k-icon name="chevron-right" :size="17" color="ink" /></view></view>
      <view class="k-between pending-head"><text>未读 {{ staffPending }} 条提醒</text><view v-if="overdueCount" class="k-row k-gap6 k-alert"><k-icon name="circle-alert" :size="16" color="alert" /><text>逾期 {{ overdueCount }} 条</text></view></view>
      <view class="large-list"><view v-for="item in merchantReminders" :key="item.id" class="large-reminder" @click="openReminder(item)"><view class="large-icon" :class="'large-icon--'+item.tone"><k-icon :name="item.icon" :size="22" color="white" /></view><view class="k-flex1"><text class="large-reminder__title">{{ item.title }}</text><text class="large-reminder__desc">{{ item.desc }}</text></view><text class="large-reminder__time" :class="item.urgent?'k-alert':'k-ochre'">{{ item.time }}</text><k-icon name="chevron-right" :size="19" color="ink" /></view></view>
    </view>

    <view v-else-if="s === 3" class="k-body k-pad-tab staff-page">
      <view class="shop-head"><image :src="helloAvatar" mode="aspectFill" /><view class="k-flex1"><text class="shop-head__name">{{ staffViewName }}</text><text class="shop-head__role">{{ staffViewRole }}</text></view><view class="switch-role" @click="go(R.identity + '?choose=1')"><text>切换角色</text><k-icon name="chevron-right" :size="17" color="ink" /></view></view>
      <view class="k-between pending-head"><text>未读 {{ staffPending }} 条提醒</text><k-button size="xs" type="secondary" @click="makeDigest">生成待办</k-button></view>
      <view class="large-list"><view v-for="item in staffReminders" :key="item.id" class="large-reminder" @click="openReminder(item)"><view class="large-icon" :class="'large-icon--'+item.tone"><k-icon :name="item.icon" :size="22" color="white" /></view><view class="k-flex1"><text class="large-reminder__title">{{ item.title }}</text><text class="large-reminder__desc">{{ item.desc }}</text></view><text class="large-reminder__time" :class="item.urgent?'k-alert':'k-ochre'">{{ item.time }}</text><k-icon name="chevron-right" :size="19" color="ink" /></view></view>
    </view>

    <view v-else class="k-body settings-page">
      <view class="setting-note"><text>{{ settingNote }}</text></view>
      <k-subscribe label="管理全部微信订阅提醒" />
      <view class="matrix"><view class="matrix-row matrix-head"><text>通知类型</text><text>微信订阅</text><text>小程序消息</text><text>员工通知</text></view><view v-for="row in notifyRows" :key="row.label" class="matrix-row"><view class="notify-type"><view class="reminder-icon" :class="'reminder-icon--'+row.tone"><k-icon :name="row.icon" :size="17" color="white" /></view><text>{{ row.label }}</text></view><view v-for="(on,index) in row.values" :key="index" class="check-box" :class="{on}" @click="toggleCell(row, index)"><k-icon v-if="on" name="check" :size="14" color="white" :stroke="3" /></view></view></view>
      <view class="sms-setting"><view class="quiet-head"><text class="settings-title">流程短信提醒</text><switch :checked="smsConsent" :disabled="smsSaving||!smsLoaded" color="#8b603b" @change="setSmsConsent"/></view><text class="quiet-note">同意通过已验证手机号接收纠纷、权益及合作复核提醒，可随时关闭。{{smsAvailable?'':'短信通道暂未开放，站内消息正常接收。'}}</text><text v-if="smsError" class="quiet-note">{{smsError}}</text></view><text class="settings-title">接收频率</text><view class="frequency"><view :class="{ active: freq === 'instant' }" @click="setFreq('instant')"><text>即时推送</text></view><view :class="{ active: freq === 'daily' }" @click="setFreq('daily')"><text>每日汇总（09:00）</text></view></view>
      <view class="quiet-head"><text class="settings-title">免打扰时段</text><view class="toggle" :style="{ background: quiet.on ? 'var(--k-green)' : 'var(--k-line2)' }" @click="quiet.on = !quiet.on"><view :style="{ marginLeft: quiet.on ? 'auto' : '0' }" /></view></view><view class="time-range"><view @click="pickTime('start')"><text>{{ quiet.start }}</text></view><text>至</text><view @click="pickTime('end')"><text>{{ quiet.end }}</text></view></view><text class="quiet-note">{{ quietNote }}</text>
      <k-button block size="md" class="save" :disabled="saving" @click="saveSettings">保存设置</k-button>
    </view>

    <k-tabbar v-if="s===1" active="messages" />
    <k-tabbar v-else-if="s===2 || s===3" mode="staff" active="work" />
  </view>
</template>

<script setup>
import { askTime } from '@/common/ui.js'
import { ref, computed, watch, onUnmounted } from 'vue'
import { onShow, onHide } from '@dcloudio/uni-app'
import { useScreen, toast, go, back } from '@/common/screen.js'
import { apiGovernanceSmsConsent, apiSetGovernanceSmsConsent, apiMarkRead, apiMessages, apiNotifySettings, apiSaveNotifySettings, apiWorkbenchDigest, apiSubscribeStatus, apiSubscribeAccept, apiSubscribeRevoke } from '@/common/api.js'
import { experience, ensureSession, hasStaffAccess, currentStaffStore, getMessageScopeKey, refreshUnread } from '@/common/experience.js'
import { absUrl } from '@/common/upload.js'
import R from '@/common/routes.js'
import { messageWording } from '@/common/display-wording.js'
// 之前：员工身份从「我的 → 我的提醒」进来也落在用户提醒屏（读的是用户消息），和菜单上员工身份的未读数对不上，
// 商家端那一屏没有任何入口；「通知管理」直接打开的设置屏（?s=4）返回会落到提醒列表，只有设置屏有返回键。
// 现在：员工身份没指定屏时落到商家端提醒；每屏都有返回，直接打开的那一屏返回原页面，从列表点进设置的回到列表
let landing = 1
const s = useScreen(4, { onLoad: (q) => {
  if (!q.s && experience.mode === 'staff' && hasStaffAccess.value) s.value = 2
  landing = s.value
} })
const onBack = () => { if (s.value === 4 && landing !== 4) s.value = landing; else back() }
const titles = ['提醒中心（我的提醒）', '提醒中心（商家端）', '提醒中心（员工/平台端）', '通知偏好设置']

// 三方流程提醒按 category 分组：报名 → 面试 → 签约，其余（订单/系统/会话）排在后面。
const CATEGORY_ORDER = ['apply', 'interview', 'contract', 'order', 'system', 'chat', 'group']
// 图标与配色取自页面原有的视觉词汇，只按 category 选，不代表任何后端数值。
const CATEGORY_LOOK = {
  apply: { icon: 'clipboard-check', tone: 'green' },
  interview: { icon: 'calendar-clock', tone: 'blue' },
  contract: { icon: 'file-signature', tone: 'ochre' },
  order: { icon: 'badge-check', tone: 'ochre' },
  system: { icon: 'shield-check', tone: 'blue' },
  chat: { icon: 'messages-square', tone: 'purple' },
  group: { icon: 'users', tone: 'purple' }
}

// 提醒时间只有 createTime 一个真实来源：今天显示时分，昨天显示「昨天」，更早显示月日。
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

// 我的提醒那一行是单行（.user-reminder__main 占剩下的宽度，nowrap + 省略号；之前写死 147px，320 宽时标题压到状态胶囊下、右边时间被裁成「10:0」），
// 服务端的正文比设计稿里的示例长，按可容纳的字数收尾。
const clamp = (text, max) => (text.length > max ? text.slice(0, max) + '…' : text)

/**
 * 一条消息 → 模板原有的提醒字段。
 *
 * status 只表示未读 / 已读，不能把阅读通知当成完成报名、签署或调解。
 * source（通知渠道）、next（下一步）、urgent 与逾期时长后端都没有对应字段，
 * 按约定留空而不是编造一个看起来合理的值。
 */
const mapReminder = (m) => {
  const look = CATEGORY_LOOK[m.category] || CATEGORY_LOOK.system
  const shown = messageWording(m)
  return {
    id: m.id,
    category: m.category || 'system',
    title: shown.title,
    desc: clamp(shown.content || '', 14),
    time: formatTime(m.createTime),
    ts: parseTime(m.createTime) ? parseTime(m.createTime).getTime() : 0,
    read: !!m.read,
    expiresAt: Number(m.expiresAt) || 0,
    icon: look.icon,
    tone: look.tone,
    status: m.read ? '已读' : '未读',
    statusTone: m.read ? 'green' : 'ochre',
    urgent: false,
    source: '',
    next: '',
    // 落地页由服务端随消息下发；早先 mapReminder 把它丢了，点提醒既不跳转
    route: m.route || ''
  }
}

const userReminders = ref([])
const reminderFilter = ref('all')
const userRemindersLoading = ref(true)
const userReminderError = ref('')
const filteredUserReminders = computed(() => userReminders.value.filter(item =>
  reminderFilter.value === 'all' || (reminderFilter.value === 'done' ? item.read : !item.read)))
const reminderEmptyText = computed(() => ({
  all: '暂无提醒', pending: '暂无未读提醒', done: '暂无已读提醒'
})[reminderFilter.value])
// 后端只有 user / staff 两种消息身份，没有把「门店商家」和「平台运营」分开，
// 所以商家端(s=2)与员工/平台端(s=3)取的是同一份 staff 消息。
const staffReminders = ref([])
const merchantReminders = computed(() => staffReminders.value)
const userPending = computed(() => userReminders.value.filter(r => !r.read).length)
const userDone = computed(() => userReminders.value.filter(r => r.read).length)
const staffPending = computed(() => staffReminders.value.filter(r => !r.read).length)
// 消息体里没有紧急/逆期字段，mapReminder 里 urgent 恒为 false，
// 所以这个数当前必为 0，页面上那一行也就不会出现；
// 将来服务端能判定逆期时，改 mapReminder 即可自动点亮。
const overdueCount = computed(() => staffReminders.value.filter(r => r.urgent).length)
const helloName = computed(() => {
  const nickname = experience.account?.nickname || ''
  return nickname ? '你好，' + nickname : '你好'
})
// 这里原来写死 reminders-avatar-abu.jpg —— 设计稿里"阿布"的真人照片，
// 摆在真实账号昵称旁边等于告诉用户"这是你的头像"。
// 账号头像目前恒为空（微信登录不采集昵称头像，见 pages/auth/login.vue 的说明），
// 所以退到品牌默认图（袋鼠线稿，不是任何人），与个人中心页的处理一致。
const helloAvatar = computed(
  () => (experience.account?.avatar ? absUrl(experience.account.avatar) : '') || '/static/media/profile-avatar.jpg')

// 商家端(s=2)与员工/平台端(s=3)的头部原来写死了设计稿里的门店与人物
//（"西湖边 · 温馨一居室 / 咖啡师兼职"、"小院管家 · 安安 / 平台运营专员"），
// 而下面列的是真实的员工消息 —— 真实数据配假身份，员工会以为在看别的门店。
// 门店名与角色名 account.staffGrants 里就有，直接接上。
// 之前取的是第一家有效授权，切换过门店后这里仍显示第一家；现在跟工作台一样取当前门店（「切换门店」即去工作台同一个切换页）
const activeGrant = computed(() => currentStaffStore.value || null)
const storeName = computed(() => activeGrant.value?.storeName || '未绑定门店')
const storeRole = computed(() => activeGrant.value?.roleName || '暂无员工授权')
// 门店照片后端没有下发，用品牌默认图占位，不套设计稿里某家具体民宿的照片
const storeImage = computed(() => '/static/media/cover-empty.png')
// s=3 后端没有"平台运营"这个角色（员工角色只有主理人/管家/店员），
// 这一屏取的和 s=2 是同一份 staff 消息，所以如实写成当前账号与其真实角色
const staffViewName = computed(() => experience.account?.nickname || '当前账号')
const staffViewRole = computed(
  () => (activeGrant.value?.roleName ? activeGrant.value.roleName + ' · 员工视角' : '暂无员工授权'))

let reminderSequence = 0, reminderVisible = true, reminderExpiryTimer = null
const reminderScope = getMessageScopeKey
const clearReminderExpiry = () => { clearTimeout(reminderExpiryTimer); reminderExpiryTimer = null }
const pruneExpiredReminders = () => {
  const keep = item => !item.read || !item.expiresAt || item.expiresAt > Date.now()
  userReminders.value = userReminders.value.filter(keep)
  staffReminders.value = staffReminders.value.filter(keep)
}
const scheduleReminderExpiry = () => {
  clearReminderExpiry()
  pruneExpiredReminders()
  if (!reminderVisible) return
  const ends = [...userReminders.value, ...staffReminders.value].filter(item => item.read && item.expiresAt).map(item => item.expiresAt)
  if (ends.length) reminderExpiryTimer = setTimeout(() => { scheduleReminderExpiry(); refreshUnread() }, Math.min(2147483647, Math.max(1, Math.min(...ends) - Date.now() + 50)))
}
const fetchReminders = async () => {
  const sequence = ++reminderSequence
  userRemindersLoading.value = true
  userReminderError.value = ''
  // 冷启动时登录态还在恢复，先等它完成，否则会把已登录用户误判成游客
  await ensureSession()
  if (!reminderVisible || sequence !== reminderSequence) return false
  const account = experience.account
  const scope = reminderScope()
  const current = () => reminderVisible && sequence === reminderSequence && scope === reminderScope()
  if (!account) {
    userReminders.value = []
    staffReminders.value = []
    userRemindersLoading.value = false
    clearReminderExpiry()
    return false
  }
  // 服务端已按收件人过滤，这里再按 recipientId 核一次，与 experience.visibleMessages 同样的双保险
  const mine = (rows) => (Array.isArray(rows) ? rows : [])
    .filter(m => String(m.recipientId) === String(account.id))
    .map(mapReminder)
    .sort((a, b) => (CATEGORY_ORDER.indexOf(a.category) - CATEGORY_ORDER.indexOf(b.category)) || (b.ts - a.ts))
  try {
    const res = await apiMessages('user')
    if (!current()) return false
    userReminders.value = mine(res.rows)
    scheduleReminderExpiry()
  } catch (e) {
    if (!current()) return false
    userReminders.value = []
    userReminderError.value = e?.message || '提醒加载失败，请重试'
    toast(userReminderError.value)
  } finally { if (current()) userRemindersLoading.value = false }
  // 没有员工授权就不请求 staff 消息：后端会降级成 user 消息，那样商家/平台端会串内容
  if (!hasStaffAccess.value) {
    staffReminders.value = []
    return !userReminderError.value
  }
  try {
    const res = await apiMessages('staff')
    if (!current()) return false
    staffReminders.value = mine(res.rows)
    scheduleReminderExpiry()
  } catch (e) {
    if (!current()) return false
    staffReminders.value = []
    if (s.value === 2 || s.value === 3) toast(e?.message || '员工提醒加载失败，请重试')
    return false
  }
  return !userReminderError.value
}
onShow(() => { reminderVisible = true; fetchReminders() })
const leaveReminders = () => { reminderVisible = false; reminderSequence++; clearReminderExpiry() }
onHide(leaveReminders)
onUnmounted(leaveReminders)
watch(reminderScope, () => {
  reminderSequence++; clearReminderExpiry(); userReminders.value = []; staffReminders.value = []
  if (reminderVisible) fetchReminders()
})
// ---------------------------------------------------------------------------
// 通知偏好（s=4）。
//
// 三列的真实情况不一样，服务端在 /app/notify-settings 里如实标出来：
//   微信订阅  —— 后台配好模板且通道开着时可点：点一下调 wx.requestSubscribeMessage 申请授权，
//               微信是一次性订阅，授权一次只能发一条，所以勾上代表"还有授权额度"；
//   小程序消息 —— 真开关，关掉后这类消息不再写进消息中心；
//   员工通知  —— 真开关，只有拿到员工授权的账号才有意义，没有授权时整列不可点。
// 免打扰时段影响的是"主动推送"那一类（新机会提醒），与你正在办的事直接相关的通知照常送达。
// ---------------------------------------------------------------------------
const TONE_OF = { job_new: 'green', apply_progress: 'green', activity: 'blue', order: 'ochre', review: 'ochre', community: 'purple' }
const ICON_OF = { job_new: 'star', apply_progress: 'house', activity: 'calendar-days', order: 'badge-check', review: 'message-square', community: 'messages-square' }

const smsConsent=ref(false),smsAvailable=ref(false),smsSaving=ref(false),smsLoaded=ref(false),smsError=ref('')
const loadSms=async()=>{try{const r=(await apiGovernanceSmsConsent()).data;smsConsent.value=!!r.enabled;smsAvailable.value=!!r.available;smsLoaded.value=true;smsError.value=''}catch(e){smsLoaded.value=false;smsError.value='短信设置暂时无法读取，请重新进入页面'}}
const setSmsConsent=async(e)=>{if(smsSaving.value)return;smsSaving.value=true;smsConsent.value=!!e.detail.value;try{const r=(await apiSetGovernanceSmsConsent(smsConsent.value)).data;smsConsent.value=!!r.enabled;smsError.value=''}catch(err){await loadSms();smsError.value=err.message||'保存失败，请重试'}finally{smsSaving.value=false}}
const notifyRows = ref([])
const freq = ref('instant')
const freqAvailable = ref(false)
const quiet = ref({ on: false, start: '22:00', end: '08:00' })
const staffAvailable = ref(false)
const settingNote = ref('正在读取通知设置…')
const quietNote = ref('免打扰时段内，将不再发送非重要通知')
const saving = ref(false)

// 微信订阅消息：模板由后台配置（订阅消息模板），用户在这一列逐类授权。
// 一次授权只能发一条，所以这里显示的是"还有没有授权额度"，不是一个长期开关。
const subscribeOn = ref(false)
const subscribeRows = ref([])
const subscribeOf = (key) => subscribeRows.value.find(x => x.bizKey === key) || null

const loadSubscribe = async () => {
  try {
    const res = await apiSubscribeStatus()
    const d = res.data || {}
    subscribeOn.value = !!d.enabled
    subscribeRows.value = d.rows || []
  } catch (e) {
    subscribeOn.value = false
    subscribeRows.value = []
  }
}

const loadSettings = async () => {
  await ensureSession()
  if (!experience.account) return
  await Promise.all([loadSubscribe(),loadSms()])
  try {
    const res = await apiNotifySettings()
    const d = res.data || {}
    notifyRows.value = (d.rows || []).map(r => ({
      key: r.key,
      label: r.label,
      tone: TONE_OF[r.key] || 'green',
      icon: ICON_OF[r.key] || 'bell',
      values: [!!(subscribeOf(r.key) && subscribeOf(r.key).on), !!r.app, !!r.staff]
    }))
    freq.value = d.freq || 'instant'
    freqAvailable.value = !!d.freqAvailable
    quiet.value = d.quiet || quiet.value
    staffAvailable.value = !!d.staffAvailable
    settingNote.value = d.note || ''
  } catch (e) {
    settingNote.value = '通知设置暂时读不到：' + ((e && e.message) || '请稍后重试')
  }
}

// 微信订阅那一列：点一下就去要授权（必须在用户点击里调），已授权时点则是关掉
const toggleWechat = row => go('/pages/profile/subscriptions?scenes=' + encodeURIComponent(row.key))

const toggleCell = (row, index) => {
  if (index === 0) {
    toggleWechat(row)
    return
  }
  if (index === 2 && !staffAvailable.value) {
    toast('拿到门店员工授权后才会收到员工通知')
    return
  }
  row.values[index] = !row.values[index]
}

const setFreq = (v) => {
  if (!freqAvailable.value) {
    toast('还没有岗位订阅，先在找机会页订阅城市或岗位')
    return
  }
  freq.value = v
}

// 之前要手动输入 HH:mm，现在用滚轮选
const pickTime = async (which) => {
  const v = await askTime(which === 'start' ? '免打扰开始时间' : '免打扰结束时间', which === 'start' ? quiet.value.start : quiet.value.end, 30)
  if (!v) return
  if (which === 'start') quiet.value.start = v
  else quiet.value.end = v
}

const saveSettings = async () => {
  if (saving.value) return
  saving.value = true
  try {
    const payload = {
      rows: notifyRows.value.map(r => ({ key: r.key, app: r.values[1], staff: r.values[2] })),
      quiet: { on: quiet.value.on, start: quiet.value.start, end: quiet.value.end }
    }
    if (freqAvailable.value) payload.freq = freq.value
    const res = await apiSaveNotifySettings(payload)
    toast((res.data && res.data.message) || '已保存')
    await loadSettings()
  } catch (e) {
    toast((e && e.message) || '保存失败')
  } finally {
    saving.value = false
  }
}

// 点一条提醒：标为已读并跳到它对应的页面（服务端随消息下发 route，没有就只标已读）
const readingReminderIds = new Set()
const openReminder = async (item) => {
  if (readingReminderIds.has(item.id)) return
  const scope = reminderScope()
  const current = () => reminderVisible && scope === reminderScope()
  if (item.read && item.expiresAt && item.expiresAt <= Date.now()) { scheduleReminderExpiry(); return }
  readingReminderIds.add(item.id)
  try {
    if (!item.read || !item.expiresAt) {
      await apiMarkRead(item.id)
      if (!current()) return
      // 再读取服务端首次 read_time 派生的期限；重复阅读不重新开始 72 小时。
      await fetchReminders()
      if (!current()) return
      await refreshUnread()
    }
    if (current() && item.route) go(item.route)
  } catch (e) {
    if (current()) toast(e?.message || '未能标记已读，请重试')
  } finally { readingReminderIds.delete(item.id) }
}

// 「生成待办」：把门店当前的待办按类型汇总成一条清单发到自己的消息中心
const makeDigest = async () => {
  if (!hasStaffAccess.value) {
    toast('需要门店员工授权')
    return
  }
  try {
    const res = await apiWorkbenchDigest(currentStaffStore.value?.storeId)
    const d = res.data || {}
    uni.showModal({
      title: '待办清单',
      content: d.message || '已生成',
      confirmText: d.total ? '去处理' : '知道了',
      showCancel: !!d.total,
      success: (r) => { if (r.confirm && d.total) go(R.staff + '?s=2') }
    })
    await fetchReminders()
  } catch (e) {
    toast((e && e.message) || '生成失败')
  }
}

onShow(loadSettings)
</script>

<style scoped lang="scss">
.hello,.shop-head{height:75px;display:flex;align-items:center;gap:12px;border-bottom:1px solid var(--k-line);font-family:var(--k-sans);font-size:18px}.hello>text{font-family:var(--k-serif);font-weight:700}.hello image{width:48px;height:48px;border-radius:50%}.count-title{display:block;margin:10px 2px 7px;font-family:var(--k-serif);font-size:15px;font-weight:700}.reminder-tabs{display:flex;gap:8px;margin-bottom:8px}.reminder-tabs>button{flex:1;min-width:0;height:48px;margin:0;padding:0;border:1px solid var(--k-line);border-radius:24px;background:transparent;display:flex;align-items:center;justify-content:center;color:var(--k-ink);font-size:14px;line-height:1.4}.reminder-tabs>button::after{border:0}.reminder-tabs>button.active{border-color:var(--k-red);background:var(--k-paper2);color:var(--k-red-deep);font-weight:600}.reminder-empty{padding:32px 16px;display:flex;flex-direction:column;align-items:center;gap:12px;color:var(--k-muted);font-size:14px;text-align:center}.user-list{border:1px solid var(--k-line);border-radius:10px;overflow:hidden}.user-reminder{height:48px;padding:0 9px;border-top:1px solid var(--k-line);display:flex;align-items:center;gap:8px}.user-reminder:first-child{border-top:0}.reminder-icon{width:27px;height:27px;border-radius:9px;display:flex;align-items:center;justify-content:center;flex:0 0 auto}.reminder-icon--green{background:var(--k-green)}.reminder-icon--ochre{background:#CC861C}.reminder-icon--blue{background:#35638D}.reminder-icon--red{background:var(--k-red)}.reminder-icon--purple{background:#7E5E9C}.user-reminder__main{flex:1;min-width:0}.user-reminder__main text{display:block;font-size:10px;color:var(--k-muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.user-reminder__main text:first-child{font-family:var(--k-serif);font-size:14px;font-weight:700;color:var(--k-ink);margin-bottom:4px}.user-reminder__next{flex:0 0 auto;margin-left:auto;padding-left:10px;border-left:1px solid var(--k-line);min-width:52px;max-width:122px}.user-reminder__next text{display:block;color:var(--k-muted);font-size:10px;margin-top:4px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.shop-head image{width:58px;height:58px;border-radius:50%}.shop-head__name{display:block;font-family:var(--k-serif);font-size:17px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.shop-head__role{display:block;margin-top:8px;color:var(--k-muted);font-size:12px}.switch-role{height:32px;padding:0 9px;border:1px solid #B89472;border-radius:17px;display:flex;align-items:center;gap:3px;font-size:12px}.pending-head{height:55px;font-family:var(--k-serif);font-size:16px;font-weight:700}.large-list{display:flex;flex-direction:column;gap:8px}.large-reminder{height:61px;padding:0 11px;border:1px solid var(--k-line);border-radius:10px;background:var(--k-paper);display:flex;align-items:center;gap:10px}.large-icon{width:36px;height:36px;border-radius:10px;display:flex;align-items:center;justify-content:center}.large-icon--green{background:var(--k-green)}.large-icon--ochre{background:#CC861C}.large-icon--blue{background:#35638D}.large-icon--red{background:var(--k-red)}.large-icon--purple{background:#7E5E9C}.large-reminder__title,.large-reminder__desc{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.large-reminder__title{display:block;font-family:var(--k-serif);font-size:15px;font-weight:700}.large-reminder__desc{display:block;margin-top:6px;color:var(--k-muted);font-size:11px}.large-reminder__time{font-family:var(--k-serif);font-size:13px;font-weight:700;white-space:nowrap}.k-ochre{color:#C98324}
.setting-note{height:36px;padding:0 11px;border:1px solid var(--k-line);border-radius:8px;background:var(--k-paper2);display:flex;align-items:center;color:var(--k-ink2);font-size:11px}.matrix{margin-top:20px}.matrix-row{height:47px;display:grid;grid-template-columns:1.2fr repeat(3,1fr);align-items:center;border-bottom:1px solid var(--k-line);text-align:center;font-size:13px}.matrix-head{height:34px;border-bottom:0;font-family:var(--k-serif);font-size:14px;font-weight:700}.notify-type{display:flex;align-items:center;gap:8px;text-align:left;padding-left:7px}.check-box{width:20px;height:20px;margin:auto;border:1.5px solid var(--k-line2);border-radius:5px;display:flex;align-items:center;justify-content:center}.check-box.on{border-color:var(--k-green);background:var(--k-green)}.settings-title{display:block;margin-top:20px;font-family:var(--k-serif);font-size:16px;font-weight:700}.frequency{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-top:9px}.frequency>view{height:37px;border:1px solid var(--k-line);border-radius:8px;display:flex;align-items:center;justify-content:center;color:var(--k-muted);font-size:13px}.frequency>view.active{color:var(--k-red-deep);border-color:var(--k-red)}.quiet-head{display:flex;align-items:center;justify-content:space-between}.toggle{width:46px;height:27px;border-radius:14px;background:var(--k-green);padding:2px}.toggle view{width:23px;height:23px;margin-left:auto;border-radius:50%;background:var(--k-paper)}.time-range{display:flex;align-items:center;gap:12px;margin-top:10px}.time-range>view{width:90px;height:36px;border:1px solid var(--k-line);border-radius:7px;display:flex;align-items:center;justify-content:center;font-size:14px}.quiet-note{display:block;margin-top:10px;color:var(--k-muted);font-size:11px}.save{margin-top:31px}
</style>
