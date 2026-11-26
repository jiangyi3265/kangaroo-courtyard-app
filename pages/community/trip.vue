<template>
<k-feature-gate feature="private-chat" :bypass="s <= 2">
<k-community-gate :bypass="s <= 2">
  <view class="k-page trip" :class="$userSurface">
    <!-- 1 我的行程列表（自动生成） -->
    <template v-if="s === 1">
      <!-- 之前没有返回键：从活动凭证 / 「我的」/ 签约页跳进来后只能靠系统手势退出。
           顶栏之前写的是品牌名「袋鼠小院」，看不出这是哪一页；10-16 改成页名「我的行程」，城市筛选照旧 -->
      <k-topbar back bg="var(--k-paper)">
        <template #left>
          <view class="brand"><text class="brand__name">我的行程</text></view>
        </template>
        <view class="tabs">
          <view v-for="t in tabs" :key="t" class="tabs__item" :class="{ active: tab === t }" hover-class="k-press" @click="setTab(t)"><text>{{ t }}</text></view>
          <view class="brand__city tabs__city" hover-class="k-press" @click="pickCity"><k-icon name="map-pin" :size="14" color="ink2" /><text>{{ city }}</text><k-icon name="chevron-down" :size="12" color="muted" /></view>
        </view>
      </k-topbar>
      <view v-if="communityEnabled && privateChatEnabled" class="trip-actions">
        <button v-if="communityEnabled" class="trip-action" @click="publishPlan"><view class="trip-action__ico"><k-icon name="square-plus" :size="22" color="red" /></view><text>发布行程找搭子</text></button>
        <button class="trip-action" @click="openMatches()"><view class="trip-action__ico"><k-icon name="users" :size="22" color="red" /></view><text>查看同行候选</text></button>
        <button class="trip-action" @click="myPlans"><view class="trip-action__ico"><k-icon name="route" :size="22" color="red" /></view><text>我的公开行程</text></button>
      </view>
      <view class="hint k-between">
        <view class="k-row k-gap4"><k-icon name="refresh-cw" :size="12" color="muted" /><text class="k-tiny">行程由报名、预订记录自动生成</text></view>
      </view>
      <view class="k-body k-pad-tab list">
        <view v-for="g in groups" :key="g.city + g.from" class="group">
          <view class="group__head"><text class="group__title">{{ g.city }} · {{ g.range }}</text><text class="k-meta">{{ g.total }}</text></view>
          <view v-for="it in g.items" :key="it.refType + it.refId" class="item" hover-class="k-press" @click="openItem(it)">
            <view class="item__tag" :class="'is-' + it.tone"><text>{{ it.tag }}</text></view>
            <view class="k-flex1"><text class="item__title">{{ displayWording(it.title, [it.storeName]) }}</text><text class="item__date">{{ it.date }}</text></view>
            <view class="item__status" :class="'is-' + it.stone"><text>{{ it.status }}</text></view>
          </view>
        </view>
        <!-- 之前一条行程都没有时只有一片空白 -->
        <view v-if="tripsLoaded && !groups.length" class="empty"><view class="empty-ico"><k-icon name="route" :size="32" color="red" /></view><text class="empty__title">{{ tab === '全部' ? '还没有行程' : '这一类还没有行程' }}</text><text class="k-meta">报名岗位、预订住宿或报名活动后，会在这里自动生成行程</text></view>
      </view>
      <k-tabbar active="trip" />
    </template>

    <!-- 2 行程详情 -->
    <template v-else-if="s === 2">
      <k-topbar title="行程详情" back custom-back @back="backTo(1)" />
      <view class="k-body k-pad-safe">
        <view class="head">
          <view class="k-row k-gap10">
            <view class="head__tag"><text>{{ d.head.tag }}</text></view>
            <text class="head__title k-flex1">{{ displayWording(d.head.title, [d.head.storeName]) }}</text>
            <view class="item__status is-green" :class="{ 'is-ochre': d.head.stone === 'ochre' }"><text>{{ d.head.status }}</text></view>
          </view>
          <view class="k-row k-gap4 k-mt10"><k-icon name="map-pin" :size="16" color="muted" /><text class="k-small k-muted">{{ d.place || d.city }}</text></view>
          <view class="head__line" />
          <view class="k-row k-gap12"><text class="k-small">{{ d.rangeText }}</text><text class="k-meta">{{ d.totalText }}</text></view>
        </view>

        <view class="tl">
          <view v-for="(d, i) in timeline" :key="d.date" class="tl__row" :class="{ last: i === timeline.length - 1 }">
            <view class="tl__left">
              <view class="tl__dot" /><view v-if="i < timeline.length - 1" class="tl__line" />
              <text class="tl__date">{{ d.date }}</text><text class="tl__week">{{ d.week }}</text>
            </view>
            <view class="tl__right">
              <view class="tl__dot tl__dot--r" /><view v-if="i < timeline.length - 1" class="tl__line" />
              <text v-for="(l, j) in d.lines" :key="j" class="tl__text" :class="{ today: l === '今天' }">{{ l }}</text>
              <text v-if="d.extra" class="tl__date tl__extra">{{ d.extra }}</text>
            </view>
          </view>
        </view>

        <view class="info">
          <view v-for="(r, i) in infoRows" :key="r.label" class="info__row" :class="{ 'has-line': i < infoRows.length - 1 }">
            <text class="info__label">{{ r.label }}</text>
            <view class="k-flex1 k-col k-gap6"><text v-for="(l, j) in r.lines" :key="j" class="k-small k-muted"><k-icon v-if="l.pin" name="map-pin" :size="14" color="muted" />{{ l.t || l }}</text></view>
            <k-button type="secondary" size="sm" :label="r.btn" @click="r.go()" />
          </view>
        </view>

        <view class="acts">
          <view v-for="a in acts.filter(x => (x.label !== '加入当地群' || groupChatEnabled) && (x.label !== '编辑行程' || communityEnabled))" :key="a.label" class="acts__item" hover-class="k-press" @click="a.go()"><view class="acts__ico"><k-icon :name="a.icon" :size="22" color="red" /></view><text>{{ a.label }}</text></view>
        </view>
        <view class="k-home-indicator" />
      </view>
    </template>

    <!-- 3 同行候选 -->
    <template v-else-if="s === 3">
      <!-- 之前返回到 s=2「行程详情」，可同行候选是从列表 / 外部链接进来的，详情是空白页 -->
      <k-topbar title="同行候选" back custom-back @back="backTo(1)">
        <!-- 城市切换之前放在右上角，正好压在微信胶囊按钮下面（还仿了胶囊的圆环）、点不到；挪到标题下面单独一行 -->
        <view class="city-row"><view class="city-cap" hover-class="k-press" @click="switchPlan"><k-icon name="map-pin" :size="16" color="ink" /><text>{{ matchCity }}</text><k-icon name="chevron-down" :size="14" color="ink" /></view><text class="k-meta">点城市切换用来匹配的公开行程</text></view>
      </k-topbar>
      <view class="k-body match">
        <view class="match__head">
          <view class="k-between"><text class="match__title">{{ matchTitle }}</text><view class="filter-pill" hover-class="k-press" @click="matchFilter"><text class="k-small">筛选</text><k-icon name="chevron-right" :size="12" color="muted" /></view></view>
          <view class="k-row k-gap6 k-mt6"><k-icon name="shield-check" :size="16" color="green" /><text class="k-small k-muted">已为你隐藏隐私信息，放心交流</text></view>
          <view v-for="p in people" :key="p.planId" class="person" hover-class="k-press-s" @click="openPerson(p)">
            <image class="person__avatar" :src="p.avatar" mode="aspectFill" />
            <view class="k-flex1">
              <view class="k-between"><text class="person__name">{{ p.name }}</text><text class="person__days">{{ p.days }}天重叠</text></view>
              <view class="k-row k-gap10 k-mt4"><text class="k-small k-muted">{{ p.meta }}</text></view>
              <view class="k-mt6 person__chips"><k-chip v-if="p.phoneVerified" tone="green" icon="shield-check" icon-fill>手机已验证</k-chip><k-chip v-if="p.tripVerified" tone="green" icon="shield-check" icon-fill>行程已验证</k-chip></view>
              <view class="person__hobby"><text class="k-small k-muted">共同兴趣</text><text class="k-small">{{ p.hobby }}</text></view>
            </view>
          </view>
          <view v-if="!people.length" class="empty"><view class="empty-ico"><k-icon name="users" :size="32" color="red" /></view><text class="empty__title">{{ mt.needPlan ? '发布公开行程后才能匹配同行' : '暂时没有重叠的同行' }}</text><text class="k-meta">{{ mt.needPlan ? '点上方城市或「筛选」可发布 / 切换公开行程' : '有新的公开行程和你重叠时会出现在这里' }}</text></view>
        </view>
      </view>
      <view class="privacy-bar privacy-bar--fixed">
        <view class="privacy-bar__icon"><k-icon name="lock" :size="12" color="green" /></view>
        <text class="k-small k-muted">隐私保护：不展示手机号、微信号等隐私信息</text>
        <view class="k-home-indicator" />
      </view>
    </template>

    <!-- 4 同行个人页 -->
    <template v-else>
      <k-topbar title="同行个人页" back custom-back @back="backTo(3)" />
      <view class="k-body k-pad-safe">
        <view class="profile">
          <view class="profile__top">
            <image class="profile__avatar" :src="personAvatar" mode="aspectFill" />
            <view class="k-flex1 k-col k-gap8">
              <text class="profile__name">{{ pp.name }}</text>
              <text class="k-small k-muted">{{ pp.meta }}</text>
              <view class="k-row k-gap8"><k-chip v-if="pp.phoneVerified" tone="green" icon="shield-check" icon-fill>手机已验证</k-chip><k-chip v-if="pp.tripVerified" tone="green" icon="shield-check" icon-fill>行程已验证</k-chip></view>
            </view>
          </view>
          <view class="overlap-bar"><k-icon name="calendar" :size="16" color="red" /><text class="profile__overlap">{{ pp.overlap }}</text></view>
          <view class="profile__sec"><text class="profile__h">公开简介</text><text class="k-small k-muted k-pre profile__bio">{{ pp.intro }}</text></view>
          <view v-if="skills.length" class="profile__sec"><text class="profile__h">想一起做的事</text><view class="k-row k-gap10 k-mt10"><view v-for="sk in skills" :key="sk" class="skill"><text>{{ sk }}</text></view></view></view>
          <view class="profile__sec"><text class="profile__h">旅行偏好</text>
            <view class="prefs"><view v-for="p in prefs" :key="p.label" class="prefs__item"><view class="prefs__circle"><k-icon :name="p.icon" :size="22" color="red" /></view><text class="k-small">{{ p.label }}</text></view></view>
          </view>
          <view class="profile__sec no-line"><view class="k-row k-gap4"><text class="profile__h">共同日期</text><text class="k-small k-muted">（重叠{{ pp.overlapDays || 0 }}天）</text></view>
            <view class="dates">
              <view v-for="(d, i) in dates" :key="d.d" class="dates__item"><text class="dates__d">{{ d.d }}</text><view class="dates__track"><view v-if="i > 0" class="dates__line dates__line--l" /><view v-if="i < dates.length - 1" class="dates__line dates__line--r" /><view class="dates__dot" /></view><text class="k-meta">{{ d.w }}</text></view>
            </view>
          </view>
          <view class="notice"><k-icon name="shield-check" :size="16" color="green" /><text class="k-small k-muted">将向对方发起私信，介绍你们自己与行程计划</text></view>
          <view class="meet-wrap"><k-button block class="k-mt10" @click="meet">认识一下</k-button></view>
          <view class="k-center-box k-mt10" @click="shareCard"><text class="k-small">分享我的行程名片</text></view>
          <view class="privacy-bar privacy-bar--inline">
            <view class="privacy-bar__icon"><k-icon name="lock" :size="12" color="green" /></view>
            <text class="k-small k-muted">隐私保护：不展示手机号、微信号等隐私信息</text>
          </view>
        </view>
        <view class="k-home-indicator" />
      </view>
    </template>
  </view>

</k-community-gate>
</k-feature-gate>
</template>

<script setup>
import { groupChatEnabled, privateChatEnabled } from '@/common/features.js'
import { communityEnabled } from "@/common/features.js"
import { displayWording } from '@/common/display-wording.js'
import { selectCity } from '@/common/city-picker.js'
// ---------------------------------------------------------------------------
// 行程（用户端）接入情况：
//   s=1 我的行程：由岗位报名、住宿订单、活动报名自动生成（apiTrips），同城且时间相接的归为一段
//   s=2 行程详情：时间线 + 住宿 / 岗位 / 活动信息（apiTripDetail）；联系商家 = 与门店的会话
//   s=3 同行候选：与我的公开行程同城、重叠 ≥ 2 天的其他公开行程（没发布公开行程时引导去发布）
//   s=4 同行个人页：只展示对方公开行程里的信息；「认识一下」= 打开私信
// 只有主动发布了公开行程的人才会被匹配；手机号、微信号、精确住址一律不展示；本期没有实名认证。
// ---------------------------------------------------------------------------
import { ref, computed } from 'vue'
import { onShareAppMessage, onShow } from '@dcloudio/uni-app'
import { useScreen, go, back, toast } from '@/common/screen.js'
import { apiTrips, apiTripDetail, apiMatches, apiPlanPerson, apiChatOpen, apiMyPlans, apiClosePlan } from '@/common/api.js'
import { ensureSession, experience } from '@/common/experience.js'
import { sheet, confirm, alert } from '@/common/ui.js'
import { gated, fail, currentCity } from '@/common/community.js'
import { absUrl } from '@/common/upload.js'
import R from '@/common/routes.js'

// 落地屏：直接从链接打开的那一屏，返回就离开本页；页内点进去的，返回回到上一屏（打不开时退回行程列表，不再停在空白屏）
let landing = 1
const s = useScreen(4, {
  onLoad: async (q) => {
    await ensureSession()
    if (q?.refType && Number(q?.refId)) { landing = 2; if (await openDetail(q.refType, Number(q.refId))) return }
    else if (Number(q?.planId)) { landing = 4; if (await openPerson({ planId: Number(q.planId) })) return }
    else if (q?.view === 'match' || s.value === 3) { landing = 3; if (await openMatches()) return }
    landing = 1; s.value = 1
    loadTrips()
  }
})
const backTo = (n) => (landing === s.value ? back() : (s.value = n))
// 之前从「发布公开行程」回来，同行候选还停在「还没有公开行程」的旧结果；现在回到候选 / 列表时静默刷新一次（首次进入由 onLoad 加载）
let shownOnce = false
onShow(() => {
  if (!shownOnce) { shownOnce = true; return }
  if (s.value === 3) openMatches(mt.value.myPlan?.planId, true)
  else if (s.value === 1) loadTrips()
})

// ---------------- s=1 ----------------
const tabs = ['全部', '换工', '兼职', '全职', '住宿', '活动']
const tab = ref('全部')
const setTab = (t) => { tab.value = t; loadTrips() }
const data = ref({ groups: [], myPlan: null })
const tripsLoaded = ref(false)
const selectedCity = ref('')
const city = computed(() => selectedCity.value || (new Set((data.value.groups || []).map(g => g.city)).size > 1 ? '全部城市' : data.value.groups[0]?.city) || currentCity())
async function loadTrips() {
  try {
    data.value = (await apiTrips(tab.value === '全部' ? undefined : tab.value)).data || data.value
    if (selectedCity.value && !(data.value.groups || []).some(g => g.city === selectedCity.value)) selectedCity.value = ''
    tripsLoaded.value = true
  } catch (e) {
    fail(e, '行程加载失败')
  }
}
const groups = computed(() => (data.value.groups || []).filter(g => !selectedCity.value || g.city === selectedCity.value))
async function pickCity() {
  const cities = [...new Set((data.value.groups || []).map(g => g.city))]
  const value = await selectCity({ value: selectedCity.value, items: cities, allowAll: true, hint: '选择行程中的城市' })
  if (value !== null) selectedCity.value = value
}
const publishPlan = () => go(R.chat + '?view=trip-publish')
const planLabel = p => `${p.city} ${p.startDate.slice(5)}—${p.endDate.slice(5)}（${{ online: '公开中', pending: '审核中', rejected: '已驳回', closed: '已关闭' }[p.status]}）`
async function myPlans() {
  try {
    const list = (await apiMyPlans()).data || []
    if (!list.length) return (await confirm('公开行程', '你还没有公开行程，发布后才能匹配同行。现在去发布？')) && go(R.chat + '?view=trip-publish')
    const labels = list.map(planLabel)
    const i = await sheet(labels)
    if (i < 0) return
    const p = list[i]
    if (p.status === 'rejected') return alert('驳回原因', p.auditReason || '未填写')
    if (['online', 'pending'].includes(p.status) && (await confirm('关闭公开行程', '关闭后别人将无法再匹配到你，确认关闭？'))) {
      toast((await apiClosePlan(p.planId)).msg)
    }
  } catch (e) {
    fail(e, '加载失败')
  }
}

// ---------------- s=2 详情 ----------------
const d = ref({ head: {}, timeline: [], info: [] })
async function openDetail(refType, refId) {
  try {
    d.value = (await apiTripDetail(refType, refId)).data
    s.value = 2
    return true
  } catch (e) {
    fail(e, '行程不存在')
    return false
  }
}
const openItem = (it) => openDetail(it.refType, it.refId)
const timeline = computed(() => d.value.timeline || [])
const infoRows = computed(() => (d.value.info || []).map(r => ({ ...r, go: () => go(r.to) })))
// 打开会话的请求没回来前再点一次，会连开两个聊天页
let opening = false
async function openChat(params, dft) {
  if (opening) return
  opening = true
  try {
    const res = (await (params.type === 'private' ? gated(() => apiChatOpen(params)) : apiChatOpen(params))).data
    go(R.chat + '?convId=' + res.convId)
  } catch (e) {
    fail(e, dft)
  } finally {
    opening = false
  }
}
function contactStore() {
  if (!d.value.appId) return toast('这段行程没有关联岗位报名，住宿问题请在订单页联系门店')
  openChat({ type: 'store', appId: d.value.appId }, '暂时无法联系商家')
}
function joinGroup() {
  if (!d.value.activityId) return toast('这段行程里还没有已报名的活动，报名活动后可进活动群')
  openChat({ type: 'activity', activityId: d.value.activityId }, '暂时无法进群')
}
const acts = [
  { icon: 'pencil', label: '编辑行程', go: () => go(R.chat + '?view=trip-publish') },
  { icon: 'clipboard-pen', label: '编辑到店信息', go: () => (d.value.appId ? go(R.jobContract + '?appId=' + d.value.appId) : toast('这段行程没有需要填写的到店信息')) },
  { icon: 'headset', label: '联系商家', go: contactStore },
  { icon: 'users', label: '加入当地群', go: joinGroup }
]

// ---------------- s=3 同行候选 ----------------
const mt = ref({ people: [], needPlan: false })
async function openMatches(planId, quiet) {
  try {
    mt.value = (await apiMatches(planId)).data || mt.value
    s.value = 3
    if (!quiet && mt.value.needPlan && (await confirm('发布公开行程', '同行候选只在发布了公开行程的人之间匹配。现在发布你的行程？'))) go(R.chat + '?view=trip-publish')
    return true
  } catch (e) {
    if (!quiet) fail(e, '加载失败')
    return false
  }
}
const matchCity = computed(() => (mt.value.myPlan && mt.value.myPlan.city) || city.value)
const matchTitle = computed(() => `与你行程重叠≥2天 的同行（${(mt.value.people || []).length}人）`)
const onlyVerified = ref(false)
// 之前没头像的人轮流套用设计稿里的真人照片（trip-avatar-1~4），像是对方本人；现在统一用默认袋鼠头像
const people = computed(() => (mt.value.people || []).filter(p => !onlyVerified.value || p.tripVerified || p.phoneVerified)
  .map(p => ({ ...p, avatar: p.avatar ? absUrl(p.avatar) : '/static/media/profile-avatar.jpg' })))
async function matchFilter() {
  const i = await sheet([onlyVerified.value ? '显示全部' : '只看已验证', '换一个公开行程'])
  if (i === 0) onlyVerified.value = !onlyVerified.value
  if (i === 1) switchPlan()
}
// 之前「换一个公开行程」和顶部城市胶囊调的是 myPlans()：选中一条只会问「关闭公开行程？」，换不了用来匹配的行程；
// 现在列出自己未关闭的公开行程，选中就按那一条重新匹配（被驳回的显示驳回原因）
async function switchPlan() {
  try {
    const list = ((await apiMyPlans()).data || []).filter(p => p.status !== 'closed')
    if (!list.length) return (await confirm('公开行程', '你还没有公开行程，发布后才能匹配同行。现在去发布？')) && go(R.chat + '?view=trip-publish')
    const i = await sheet(list.map(planLabel))
    if (i < 0) return
    if (list[i].status === 'rejected') return alert('驳回原因', list[i].auditReason || '未填写')
    openMatches(list[i].planId)
  } catch (e) {
    fail(e, '加载失败')
  }
}

// ---------------- s=4 个人页 ----------------
const pp = ref({ prefs: [], dates: [] })
async function openPerson(p) {
  try {
    pp.value = (await apiPlanPerson(p.planId)).data
    s.value = 4
    return true
  } catch (e) {
    fail(e, '对方的公开行程已关闭')
    return false
  }
}
const personAvatar = computed(() => (pp.value.avatar ? absUrl(pp.value.avatar) : '/static/media/profile-avatar-lg.jpg'))
// 11-18 返修（纯展示）：补上常见的自填偏好，不在表里的兜底用 sparkles（原来全兜成同一个爱心，四个一样的图标没有信息量）
const PREF_ICON = { 户外徒步: 'footprints', 摄影创作: 'camera', 咖啡探店: 'coffee', 美食探索: 'cooking-pot', 手作体验: 'leaf', 逛市集: 'store', 城市漫步: 'map-pin', 其他: 'heart', 慢节奏: 'leaf', 爱拍照: 'camera', 拍照: 'camera', 吃本地: 'utensils', 美食: 'utensils', 早睡: 'moon', 早起: 'sunrise', 徒步: 'footprints', 咖啡: 'coffee' }
const prefs = computed(() => (pp.value.prefs || []).slice(0, 4).map(l => ({ label: l, icon: PREF_ICON[l] || 'sparkles' })))
const skills = computed(() => (pp.value.prefs || []).slice(0, 4))
const dates = computed(() => pp.value.dates || [])
const meet = () => openChat({ type: 'private', planId: pp.value.planId }, '暂时无法发起私信')
const shareCard = () => alert('分享行程名片', '请点击右上角「···」→ 转发给朋友。转发的是你自己的公开行程卡片，不会带出别人的信息。')

onShareAppMessage(() => ({ title: '我的旅居行程 · 袋鼠全球青年', path: R.trip }))
</script>

<style scoped lang="scss">
/* s1 */
.brand { display: flex; align-items: center; gap: 12px; padding-left: 8px; }
.brand__name { font-family: var(--k-brand); font-weight: 700; font-size: 21px; letter-spacing: 1px; }
.brand__city { display: flex; align-items: center; gap: 3px; font-size: 15px; }
.tabs { display: flex; align-items: center; justify-content: space-between; padding: 0 16px; height: 44px; border-bottom: 1px solid var(--k-line); }
.tabs__item { position: relative; height: 44px; display: flex; align-items: center; font-size: 15px; color: var(--k-ink); padding: 0 6px; }
.tabs__item.active { font-weight: 700; }
.tabs__item.active::after { content: ""; position: absolute; left: 6px; right: 6px; bottom: 0; height: 2px; background: var(--k-red); border-radius: 1px; }
.hint { height: 32px; padding: 0 16px; border-bottom: 1px solid var(--k-line); }
.trip-actions { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:6px; padding:12px 16px 8px; }
.trip-action { display:flex; flex-direction:column; align-items:center; justify-content:center; gap:7px; min-width:0; min-height:64px; margin:0; padding:8px 2px; border:1px solid var(--k-line); border-radius:10px; background:var(--k-paper); color:var(--k-ink2); font:500 12px/1.4 var(--k-sans); }
.trip-action::after { border:0; }
.list { padding-top: 8px; display: flex; flex-direction: column; gap: 10px; }
.group { border: 1px solid var(--k-line); border-radius: 12px; background: var(--k-paper); padding: 8px 8px 8px; }
.group__head { display: flex; align-items: baseline; gap: 12px; padding: 2px 2px 8px; }
.group__title { font-family: var(--k-serif); font-weight: 700; font-size: 16px; }
.item { display: flex; align-items: center; gap: 12px; padding: 8px 8px 8px 10px; border: 1px solid var(--k-line); border-radius: 8px; background: var(--k-bg); margin-top: 8px; }
.item:first-of-type { margin-top: 0; }
.item__tag { width: 40px; height: 22px; border-radius: 5px; display: flex; align-items: center; justify-content: center; font-size: 13px; flex: 0 0 auto; }
.item__tag.is-ochre { background: var(--k-ochre-soft); color: #9A6A22; }
.item__tag.is-blue { background: var(--k-indigo-soft); color: var(--k-indigo); }
.item__title { display: block; font-family: var(--k-serif); font-weight: 700; font-size: 16px; line-height: 1.3; }
.item__date { display: block; font-size: 13px; color: var(--k-muted); margin-top: 2px; line-height: 1.4; }
.item__status { height: 22px; padding: 0 8px; border-radius: 5px; display: flex; align-items: center; font-size: 13px; flex: 0 0 auto; }
.item__status.is-green { background: var(--k-green-soft); color: var(--k-green); }
.item__status.is-ochre { background: var(--k-ochre-soft); color: #9A6A22; }

/* s2 */
.head { background: var(--k-paper2); border: 1px solid var(--k-line); border-radius: 12px; padding: 12px 14px; }
.head__tag { height: 22px; padding: 0 8px; border-radius: 5px; background: var(--k-green-soft); color: var(--k-green); font-size: 13px; display: flex; align-items: center; }
.head__title { font-family: var(--k-serif); font-weight: 700; font-size: 17px; }
.head__line { height: 1px; background: var(--k-line); margin: 12px 0 10px; }
.tl { padding: 16px 0 6px; }
.tl__row { display: flex; }
.tl__left { position: relative; width: 107px; flex: 0 0 auto; padding-left: 66px; padding-bottom: 14px; }
.tl__right { position: relative; flex: 1; min-width: 0; padding-left: 29px; padding-bottom: 14px; }
.tl__dot { position: absolute; left: 48px; top: 7px; width: 7px; height: 7px; border-radius: 50%; background: #9A6A22; }
.tl__dot--r { left: 12px; }
.tl__line { position: absolute; top: 15px; bottom: -6px; width: 1px; background: var(--k-line2); }
.tl__left .tl__line { left: 51px; }
.tl__right .tl__line { left: 15px; }
.tl__row.last .tl__left, .tl__row.last .tl__right { padding-bottom: 0; }
.tl__date { display: block; font-family: var(--k-serif); font-weight: 700; font-size: 15px; line-height: 1.4; }
.tl__week { display: block; font-size: 12px; color: var(--k-muted); margin-top: 1px; }
.tl__extra { font-size: 13px; margin-top: 3px; }
.tl__text { display: block; font-size: 14px; line-height: 1.4; margin-bottom: 4px; }
.tl__text.today { color: #9A6A22; }
.info { border: 1px solid var(--k-line); border-radius: 12px; background: var(--k-paper); padding: 0 10px; margin-top: 8px; }
.info__row { display: flex; align-items: center; gap: 12px; padding: 14px 0; }
.info__row.has-line { border-bottom: 1px solid var(--k-line); }
.info__label { width: 68px; flex: 0 0 auto; font-family: var(--k-serif); font-weight: 700; font-size: 16px; align-self: flex-start; white-space: nowrap; }
.acts { display: flex; justify-content: space-around; padding: 14px 8px 12px; border: 1px solid var(--k-line); border-radius: 12px; background: var(--k-paper); margin-top: 12px; }
.acts__item { display: flex; flex-direction: column; align-items: center; gap: 10px; font-size: 14px; }
.empty { display: flex; flex-direction: column; align-items: center; gap: 6px; padding: 32px 16px; text-align: center; }
.empty__title { font-family: var(--k-serif); font-weight: 700; font-size: 15px; }

/* s3 */
.city-row { display: flex; align-items: center; gap: 10px; padding: 2px 16px 8px; }
.city-cap { flex: 0 0 auto; height: 30px; border: 1px solid var(--k-line2); border-radius: 15px; background: var(--k-paper); display: flex; align-items: center; gap: 3px; padding: 0 8px 0 10px; font-size: 14px; }
/* 之前只垫了 60px，底部「隐私保护」条两行字时会挡住最后一张卡片；现在垫够条的高度，并且不只靠 var(env()) 变量（个别机型不生效时整条作废） */
.match { padding-top: 4px; padding-bottom: 130px; padding-bottom: calc(96px + constant(safe-area-inset-bottom)); padding-bottom: calc(96px + env(safe-area-inset-bottom)); }
/* #ifdef H5 */
.match { padding-bottom: 130px; }
/* #endif */
.match__head { border: 1px solid var(--k-line); border-radius: 12px; background: var(--k-paper2); padding: 12px 8px 8px; }
.match__title { font-family: var(--k-serif); font-weight: 700; font-size: 16px; padding-left: 4px; }
.filter-pill { height: 28px; padding: 0 6px 0 10px; border: 1px solid var(--k-line); border-radius: 6px; background: var(--k-paper); display: flex; align-items: center; }
.match__head .k-row.k-gap6 { padding-left: 4px; }
.person { display: flex; gap: 14px; padding: 12px 12px 14px; border: 1px solid var(--k-line); border-radius: 12px; background: var(--k-paper); margin-top: 10px; }
.person__avatar { width: 52px; height: 52px; border-radius: 50%; flex: 0 0 auto; margin-top: 2px; }
.person__name { font-family: var(--k-serif); font-weight: 700; font-size: 17px; }
.person__days { color: #9A6A22; font-weight: 700; font-size: 15px; font-family: var(--k-sans); }
.person__hobby { display: flex; gap: 20px; margin-top: 12px; margin-left: -66px; }
.privacy-bar { display: flex; align-items: center; gap: 12px; padding: 14px 16px; background: var(--k-paper2); border-top: 1px solid var(--k-line); }
.privacy-bar--fixed { position: fixed; left: 0; right: 0; bottom: 0; z-index: 50; padding-bottom: calc(14px + var(--k-safe-bottom)); }
.privacy-bar--inline { margin: 12px -14px -12px; border-radius: 0 0 12px 12px; padding: 12px 16px; }
.privacy-bar__icon { width: 24px; height: 24px; border-radius: 50%; border: 1.5px solid var(--k-green); display: flex; align-items: center; justify-content: center; }

/* s4 */
.profile { border: 1px solid var(--k-line); border-radius: 12px; background: var(--k-paper); padding: 12px 14px 12px; }
.profile__top { display: flex; align-items: center; gap: 18px; padding: 4px 0 0 0; }
.profile__avatar { width: 84px; height: 84px; border-radius: 50%; flex: 0 0 auto; }
.profile__name { font-family: var(--k-serif); font-weight: 700; font-size: 22px; }
.profile__overlap { display: block; text-align: center; font-size: 14px; margin-top: 10px; }
.profile__sec { padding: 12px 0; border-top: 1px solid var(--k-line); margin-top: 0; }
.profile__sec:first-of-type { margin-top: 12px; }
.profile__sec.no-line { padding-bottom: 8px; }
.profile__h { font-family: var(--k-serif); font-weight: 700; font-size: 16px; }
.profile__bio { display: block; margin-top: 8px; line-height: 1.7; }
.skill { height: 30px; padding: 0 14px; border: 1px solid var(--k-line2); border-radius: 8px; background: var(--k-paper); display: flex; align-items: center; font-size: 13px; white-space: nowrap; }
.prefs { display: flex; justify-content: space-between; padding: 10px 2px 0; }
.prefs__item { display: flex; flex-direction: column; align-items: center; gap: 8px; }
.prefs__circle { width: 42px; height: 42px; border-radius: 50%; background: var(--k-paper2); border: 1px solid var(--k-line); display: flex; align-items: center; justify-content: center; }
.dates { display: flex; margin-top: 8px; }
.dates__item { flex: 1; display: flex; flex-direction: column; align-items: center; gap: 6px; }
.dates__d { font-size: 14px; }
.dates__track { position: relative; width: 100%; height: 12px; display: flex; align-items: center; justify-content: center; }
.dates__line { position: absolute; top: 50%; height: 1px; background: var(--k-line2); }
.dates__line--l { left: 0; right: 50%; }
.dates__line--r { left: 50%; right: 0; }
.dates__dot { position: relative; width: 9px; height: 9px; border-radius: 50%; background: #9A6A22; }
.notice { display: flex; align-items: center; gap: 10px; padding: 11px 14px; background: var(--k-paper2); border: 1px solid var(--k-line); border-radius: 10px; margin-top: 6px; }
.tl { padding-top: 9px; }
.tl__left, .tl__right { padding-bottom: 7px; }
.tl__text { line-height: 1.25; margin-bottom: 2px; }
.info__row { padding: 9px 0; }
.acts { margin-top: 8px; padding-top: 10px; padding-bottom: 9px; }

/* 2026-11-17 改版「小而精」（主人按样张第三版拍板）：浅灰底上放白卡，不描边、不加阴影，圆角 12、标签 4；页名 17、卡片标题 14、辅助 11。
   功能和文字不变：选城市、四个页签、发布行程 / 同行候选 / 我的公开行程、行程详情的时间线和各按钮、同行候选的切换和筛选、
   同行个人页的「认识一下」和分享名片都在。上面的旧规则保留不动，这里用 .k-page.trip 开头的规则盖过去。 */
.k-page.trip {
  --k-bg: var(--k-page); --k-paper2: var(--k-fill); /* 本组暖米填充，只在根上定义一次 */
  background: var(--k-page);
  :deep(.k-topbar) { background: var(--k-page); }
  :deep(.k-navbar__title) { font-family: var(--k-sans); font-size: 16px; font-weight: 600; }
  :deep(.k-chip) { height: 17px; padding: 0 5px; border-radius: 4px; font-size: 11px; font-weight: 500; }
  .k-body { padding-top: 8px; padding-left: 12px; padding-right: 12px; }

  /* ---------- 我的行程 ---------- */
  .brand { gap: 8px; padding-left: 4px; }
  .brand__name { font-size: 17px; letter-spacing: .2px; }
  .brand__city { position: relative; gap: 2px; color: var(--k-ink2); font-size: 13px; } .brand__city::before { content: ''; position: absolute; left: -4px; right: -8px; top: -12px; bottom: -12px; } /* 字小了，上下各多出 12 的透明可点范围 */
  .brand__city :deep(.k-icon) { opacity: .78; }
  .tabs { height: 40px; padding: 0 12px; border-bottom: 0; }
  /* 下划线页签：未选 14 / 400 浅灰，选中 14 / 600 深墨 + 16×3 暖棕短条，行高 40 */
  .tabs__item { height: 40px; color: var(--k-muted); font-size: 14px; font-weight: 400; }
  .tabs__item.active { color: var(--k-ink); font-weight: 600; }
  .tabs__item.active::after { left: 50%; right: auto; bottom: 4px; width: 16px; height: 3px; margin-left: -8px; border-radius: 2px; background: var(--k-red); }
  .trip-actions { gap: 8px; padding: 8px 12px 0; }
  .trip-action { min-height: 60px; gap: 5px; border: 0; border-radius: 12px; font-size: 11px; }
  .hint { height: 30px; padding: 0 14px; border-bottom: 0; }
  .list { padding-top: 0; gap: 8px; }
  .group { padding: 12px 12px 2px; border: 0; border-radius: 12px; }
  .group__head { gap: 8px; padding: 0 2px 2px; }
  .group__title { font-family: var(--k-sans); font-size: 14px; font-weight: 700; }
  /* 卡里的每一项是列表行：不再垫浅灰小块（卡中卡），行间一道发丝线，最后一行不画 */
  .item { gap: 8px; margin-top: 0; padding: 10px 0; border: 0; border-radius: 0; background: transparent; }
  .item + .item { box-shadow: inset 0 .5px 0 var(--k-line); }
  .item:first-of-type { margin-top: 0; }
  .item__tag { width: auto; min-width: 32px; height: 17px; padding: 0 5px; border-radius: 4px; font-size: 11px; font-weight: 500; }
  .item__tag.is-ochre, .item__status.is-ochre { color: var(--k-ochre-deep); }
  .item__tag.is-blue { background: var(--k-red-soft); color: var(--k-red-deep); } /* 「活动」等类型标签用品牌浅棕，不再出现规范之外的蓝色 */
  .item__title { font-family: var(--k-sans); font-size: 14px; line-height: 20px; font-weight: 600; }
  .item__date { margin-top: 1px; font-size: 11px; }
  .item__status { height: 17px; padding: 0 5px; border-radius: 4px; font-size: 11px; font-weight: 500; }
  /* 空状态：白卡内居中，标题 14 / 500 二级墨、说明 12 浅灰，上下留白 28 */
  .empty { gap: 4px; padding: 28px 16px; border-radius: 12px; background: var(--k-paper); }
  .match .empty { margin-top: 8px; }
  .empty__title { font-family: var(--k-sans); font-size: 14px; font-weight: 500; color: var(--k-ink2); }
  .empty .k-meta { font-size: 12px; line-height: 1.6; color: var(--k-muted); }

  /* ---------- 行程详情 ---------- */
  .head { padding: 12px; border: 0; border-radius: 12px; background: var(--k-paper); }
  .head__tag { height: 17px; padding: 0 5px; border-radius: 4px; font-size: 11px; font-weight: 500; }
  .head__title { font-family: var(--k-sans); font-size: 15px; font-weight: 700; }
  .head__line { margin: 10px 0 8px; }
  .tl__dot, .dates__dot { background: var(--k-red); }
  .tl__date { font-family: var(--k-sans); font-size: 13px; font-weight: 600; }
  .tl__week { font-size: 11px; }
  .tl__extra { font-size: 12px; }
  .tl__text { font-size: 13px; }
  .tl__text.today { color: var(--k-red-deep); }
  .info { padding: 0 12px; border: 0; border-radius: 12px; }
  .info__label { width: 60px; font-family: var(--k-sans); font-size: 13px; font-weight: 600; }
  .info :deep(.k-button) { height: 28px; border-radius: 14px; font-size: 12px; }
  .acts { padding: 12px 8px; border: 0; border-radius: 12px; }
  .acts__item { gap: 6px; color: var(--k-ink2); font-size: 11px; }

  /* ---------- 同行候选 ---------- */
  .city-row { gap: 8px; padding: 0 12px 8px; }
  .city-cap { position: relative; height: 28px; gap: 2px; border: 0; border-radius: 14px; background: var(--k-paper2); font-size: 12px; } .city-cap::before, .filter-pill::before { content: ''; position: absolute; left: 0; right: 0; top: -5px; bottom: -5px; }
  .city-cap :deep(.k-icon) { width: 12px !important; height: 12px !important; }
  .match__head { padding: 0; border: 0; border-radius: 0; background: transparent; }
  .match__title { padding-left: 2px; font-family: var(--k-sans); font-size: 16px; line-height: 22px; font-weight: 700; }
  .filter-pill { position: relative; height: 28px; padding: 0 8px 0 12px; gap: 2px; border: 0; border-radius: 14px; }
  .filter-pill .k-small { font-size: 12px; }
  .match__head .k-row.k-gap6 { padding-left: 2px; }
  .match__head .k-row.k-gap6 .k-small { font-size: 11px; }
  .person { gap: 10px; margin-top: 8px; padding: 12px; border: 0; border-radius: 12px; }
  .person__avatar { width: 44px; height: 44px; margin-top: 0; }
  .person__name { font-family: var(--k-sans); font-size: 15px; font-weight: 600; }
  .person__days { color: var(--k-red-deep); font-size: 12px; font-weight: 600; }
  .person__hobby { gap: 12px; margin-top: 8px; margin-left: -54px; }
  .person .k-small { font-size: 12px; }
  .privacy-bar { gap: 8px; padding: 10px 12px; border-top: 0; background: var(--k-paper); box-shadow: 0 -.5px 0 rgba(58, 50, 43, .1); }
  .privacy-bar .k-small { font-size: 11px; }
  .privacy-bar--fixed { padding-bottom: calc(10px + var(--k-safe-bottom)); }
  .privacy-bar--inline { margin: 12px -12px -12px; padding: 10px 12px; background: var(--k-page); box-shadow: none; }
  .privacy-bar__icon { width: 20px; height: 20px; border-width: 1px; }

  /* ---------- 同行个人页 ---------- */
  .profile { padding: 12px; border: 0; border-radius: 12px; }
  .profile__top { gap: 12px; }
  .profile__avatar { width: 64px; height: 64px; }
  .profile__name { font-family: var(--k-sans); font-size: 18px; }
  .profile__overlap { color: var(--k-red-deep); font-size: 12px; }
  .profile__h { font-family: var(--k-sans); font-size: 14px; font-weight: 700; }
  .skill { height: 26px; padding: 0 11px; border: 0; border-radius: 13px; background: var(--k-paper2); font-size: 12px; }
  .prefs__circle { width: 38px; height: 38px; border: 0; background: var(--k-paper2); }
  .prefs__item .k-small { font-size: 11px; }
  .dates__d { font-size: 12px; }
  .notice { gap: 6px; padding: 9px 10px; border: 0; border-radius: 8px; background: var(--k-green-soft); }
  .notice .k-small { font-size: 12px; }
  .profile :deep(.k-button) { height: 44px; border-radius: 22px; box-shadow: none; font-size: 15px; }
}
</style>

<style scoped lang="scss">
/* 11-18 第三轮精修：行程条目的类型 / 状态小标签和标题第一行对齐（标题折两行时不再悬在中间）；空状态补 56 浅棕方块图标 */
.k-page.trip {
  .item { align-items: flex-start; }
  .item__tag, .item__status { align-self: flex-start; margin-top: 2px; }
  .group__head { align-items: center; padding: 2px 2px 4px; }
  .group__title { font-size: 15px; line-height: 22px; }
  .empty-ico { width: 56px; height: 56px; margin-bottom: 6px; display: flex; align-items: center; justify-content: center; border-radius: 16px; background: var(--k-red-soft); }
  .empty { padding: 32px 16px; }
}
</style>
<style scoped lang="scss">
/* 11-18 返修第 1 轮：行程时间线收进白卡，只留一列圆点 + 竖线（左边 48 宽日期列）；门店地址图标和字间距 4；
   同行个人页：偏好圆圈 40、重叠提示下方 12、「分享我的行程名片」离按钮 12 */
.k-page.trip {
  .tl { margin: 8px 0 0; padding: 12px; border-radius: 12px; background: var(--k-paper); }
  .tl__row { display: flex; }
  .tl__left { width: 48px; flex: 0 0 48px; padding: 0 0 12px; }
  .tl__left .tl__dot, .tl__left .tl__line { display: none; }
  .tl__right { flex: 1; min-width: 0; padding: 0 0 12px 20px; display: flex; flex-direction: column; gap: 4px; }
  .tl__row.last .tl__left, .tl__row.last .tl__right { padding-bottom: 0; }
  .tl__dot--r { left: 0; top: 7px; width: 7px; height: 7px; }
  .tl__right .tl__line { left: 3px; top: 18px; bottom: -4px; width: 1px; background: var(--k-line2); }
  .tl__date { font-size: 13px; line-height: 20px; font-weight: 600; color: var(--k-ink); }
  .tl__week { margin-top: 0; font-size: 11px; line-height: 16px; color: var(--k-muted); }
  .tl__extra { margin-top: 4px; font-size: 12px; font-weight: 500; color: var(--k-ink2); }
  .tl__text { margin: 0; font-size: 14px; line-height: 20px; color: var(--k-ink); }
  .tl__text.today { font-size: 12px; line-height: 16px; color: var(--k-red-deep); }
  .info__row :deep(.k-icon) { margin-right: 4px; vertical-align: -2px; }
  .profile__overlap { margin-bottom: 12px; }
  .prefs__circle { width: 40px; height: 40px; }
  .k-center-box.k-mt10 { margin-top: 12px; padding: 4px 0; }
}
</style>
<style scoped lang="scss">
/* 11-18 返修第 2 轮：三个入口改成方块图标卡（88 高、40 浅棕方块 + 22 图标、12/500 字）；类型标签统一浅棕；
   行程详情信息卡标签 13/500 灰、内容 14/500 墨、按钮最小宽 72 高 32；同行候选标题 16/700、筛选不折行、认证标签一行；
   同行个人页：提示条和「认识一下」之间 12、重叠说明左对齐、区块标题到内容统一 10 */
.k-page.trip {
  .trip-action { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px; height: 88px; min-height: 88px; padding: 0 4px; font-size: 12px; font-weight: 500; line-height: 16px; color: var(--k-ink2); }
  .trip-action__ico { width: 40px; height: 40px; display: flex; align-items: center; justify-content: center; border-radius: 12px; background: var(--k-red-soft); }
  .trip-action > text { white-space: nowrap; }
  .head__tag { background: var(--k-red-soft); color: var(--k-red-deep); }
  .info__row { align-items: center; }
  .info__label { flex: 0 0 48px; width: 48px; font-size: 13px; line-height: 20px; font-weight: 500; color: var(--k-muted); }
  .info__row .k-col > text { font-size: 14px; line-height: 20px; font-weight: 500; color: var(--k-ink); }
  .info__row :deep(.k-button) { min-width: 72px; height: 32px; min-height: 32px; padding: 0 12px; font-size: 13px; }
  .match__title { min-width: 0; font-size: 16px; line-height: 22px; font-weight: 700; }
  .filter-pill { flex-shrink: 0; white-space: nowrap; }
  .person__chips { display: flex; flex-wrap: nowrap; gap: 6px; min-height: 20px; overflow: hidden; }
  .meet-wrap { margin-top: 12px; }
  .meet-wrap :deep(.k-button) { margin-top: 0; }
  .profile__overlap { text-align: left; align-self: flex-start; }
  .profile__h { display: block; margin-bottom: 10px; }
  .profile__sec .k-row.k-mt10 { margin-top: 0; }
  .profile__bio { margin-top: 0; }
  .prefs { margin-top: 0; }
}
</style>
<style scoped lang="scss">
/* 11-18 第四轮：行程详情底部四个操作和上面入口同一套（40 浅棕方块 + 22 暖棕图标 + 12 字）；门店 / 住宿行按钮统一 64×28；
   同行个人页「重叠天数」做成浅棕横条（日历图标 + 14/500 暖棕字）；旅行偏好 4 列等分 */
.k-page.trip {
  .acts { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 4px; padding: 16px 8px; }
  .acts__item { gap: 8px; min-width: 0; font-size: 12px; line-height: 16px; font-weight: 500; color: var(--k-ink2); text-align: center; }
  .acts__ico { width: 40px; height: 40px; display: flex; align-items: center; justify-content: center; border-radius: 12px; background: var(--k-red-soft); }
  .info__row :deep(.k-button) { width: 64px; min-width: 64px; height: 28px; min-height: 28px; padding: 0; border-radius: 14px; font-size: 12px; }
  .overlap-bar { display: flex; align-items: center; gap: 6px; align-self: stretch; margin: 12px 0; padding: 10px 12px; border-radius: 12px; background: var(--k-red-soft); }
  .overlap-bar .profile__overlap { flex: 1; min-width: 0; margin: 0; font-size: 14px; line-height: 20px; font-weight: 500; color: var(--k-red-deep); text-align: left; }
  .prefs { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); padding: 10px 0 0; }
  .prefs__item { min-width: 0; }
  .acts__item > text { white-space: nowrap; }
  @media (max-width: 359px) { .acts { gap: 0; padding: 16px 4px; } .acts__item { font-size: 11px; } }
}
</style>
<style scoped lang="scss">
/* 11-18 返修第 5 轮：同行个人页底部绿条在逗号处换行，不让最后一个字单独掉行 */
.k-page.trip {
  .notice .k-small { word-break: keep-all; overflow-wrap: anywhere; }
}
</style>
<style scoped lang="scss">
/* 11-18 返修第 6 轮：时间线「休息」这类当天事项挪到右列；320 宽门店行地址改 13 号常规字，「联系门店」另起一行对齐到内容列 */
.k-page.trip {
  .tl__right .tl__extra { margin: 0; font-size: 14px; line-height: 20px; font-weight: 400; color: var(--k-muted); }
  @media (max-width: 359px) {
    .info__row { flex-wrap: wrap; row-gap: 8px; }
    .info__row > .k-flex1 { flex: 1 1 calc(100% - 60px); }
    .info__row .k-col > text { font-size: 13px; font-weight: 400; }
    .info__row :deep(.k-button) { margin-left: 60px; }
  }
}
</style>
<style scoped lang="scss">
/* 11-18 返修第 6 轮：同行个人页「旅行偏好」和组里其他入口一样：40 浅棕圆角方块 + 22 暖棕图标 */
.k-page.trip {
  .prefs__circle { width: 40px; height: 40px; border: 0; border-radius: 12px; background: var(--k-red-soft); }
}
</style>
<style scoped lang="scss">
/* 11-18 夜 第四轮精修：「我的行程」标题和全端二级页一样居中；城市切换挪到页签行右端（13 号 + map-pin 14 + chevron-down 12）；
   顶栏连同页签白底，下沿一条发丝线 */
.k-page.trip {
  .brand { padding-left: 0; }
  .brand__name { position: absolute; left: 102px; right: 102px; top: 50%; transform: translateY(-50%); text-align: center; font-size: 17px; font-weight: 700; line-height: 24px; pointer-events: none; }
  .tabs { justify-content: flex-start; gap: 0; padding: 0 12px; box-shadow: inset 0 -.5px 0 var(--k-line); }
  .tabs__item { flex: 1; justify-content: center; padding: 0; }
  .tabs__city { flex: none; height: 40px; margin-left: 8px; padding-left: 10px; gap: 2px; font-size: 13px; color: var(--k-ink2); white-space: nowrap; }
  .tabs__city::after { content: ''; position: absolute; left: 0; top: 12px; bottom: 12px; width: 1px; transform: scaleX(.5); background: var(--k-line2); }
  @media (max-width: 340px) { .brand__name { left: 96px; right: 96px; font-size: 15px; } .tabs__city { margin-left: 4px; padding-left: 6px; } }
}
</style>
<style scoped lang="scss">
/* 11-19 第四轮返修：340 以下页签 13 号、城市切换收紧（微信字更宽，留出余量）；同行候选的「手机 / 行程已验证」去掉浅绿底，只留绿字 + 盾牌 */
.k-page.trip {
  .person__chips :deep(.k-chip) { height: 18px; padding: 0; border: 0; background: transparent; font-size: 12px; font-weight: 400; }
  @media (max-width: 340px) {
    .tabs { padding: 0 8px; }
    .tabs__item { font-size: 13px; }
    .tabs__city { margin-left: 6px; padding-left: 6px; font-size: 12px; }
  }
}
</style>
<style scoped lang="scss">
/* 11-19 微信实拍返修：行程状态改成无底小字（同一行只留类型胶囊一种底色，和活动页「名额」同一个做法）；
   同行候选「筛选」改成无底文字 + 箭头，右对齐到 16 线 */
.k-page.trip {
  .item__status, .item__status.is-green, .item__status.is-ochre { height: auto; padding: 0; border-radius: 0; background: transparent; font-size: 12px; line-height: 17px; }
  .filter-pill { padding: 0; border: 0; border-radius: 0; background: transparent; }
  .filter-pill .k-small { font-size: 13px; color: var(--k-ink2); }
}
</style>
