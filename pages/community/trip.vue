<template>
<k-feature-gate feature="private-chat" :bypass="s <= 2">
<k-community-gate :bypass="s <= 2">
  <view class="k-page trip">
    <!-- 1 我的行程列表（自动生成） -->
    <template v-if="s === 1">
      <!-- 之前没有返回键：从活动凭证 / 「我的」/ 签约页跳进来后只能靠系统手势退出。
           顶栏之前写的是品牌名「袋鼠小院」，看不出这是哪一页；10-16 改成页名「我的行程」，城市筛选照旧 -->
      <k-topbar back>
        <template #left>
          <view class="brand"><text class="brand__name">我的行程</text><view class="brand__city" @click="pickCity"><k-icon name="map-pin" :size="16" color="ink" :stroke="1.8" fill /><text>{{ city }}</text><k-icon name="chevron-down" :size="14" color="ink" :stroke="2" /></view></view>
        </template>
        <view class="tabs">
          <view v-for="t in tabs" :key="t" class="tabs__item" :class="{ active: tab === t }" @click="setTab(t)"><text>{{ t }}</text></view>
        </view>
      </k-topbar>
      <view v-if="communityEnabled && privateChatEnabled" class="trip-actions">
        <button v-if="communityEnabled" class="trip-action" @click="publishPlan"><k-icon name="square-plus" :size="18" color="red" /><text>发布行程找搭子</text></button>
        <button class="trip-action" @click="openMatches()"><k-icon name="users" :size="18" color="green" /><text>查看同行候选</text></button>
        <button class="trip-action" @click="myPlans"><k-icon name="route" :size="18" color="indigo" /><text>我的公开行程</text></button>
      </view>
      <view class="hint k-between">
        <view class="k-row k-gap4"><k-icon name="refresh-cw" :size="12" color="ochre" :stroke="2" /><text class="k-tiny">行程由报名、预订记录自动生成</text></view>
      </view>
      <view class="k-body k-pad-tab list">
        <view v-for="g in groups" :key="g.city + g.from" class="group">
          <view class="group__head"><text class="group__title">{{ g.city }} · {{ g.range }}</text><text class="k-meta">{{ g.total }}</text></view>
          <view v-for="it in g.items" :key="it.refType + it.refId" class="item" @click="openItem(it)">
            <view class="item__tag" :class="'is-' + it.tone"><text>{{ it.tag }}</text></view>
            <view class="k-flex1"><text class="item__title">{{ displayWording(it.title, [it.storeName]) }}</text><text class="item__date">{{ it.date }}</text></view>
            <view class="item__status" :class="'is-' + it.stone"><text>{{ it.status }}</text></view>
          </view>
        </view>
        <!-- 之前一条行程都没有时只有一片空白 -->
        <view v-if="tripsLoaded && !groups.length" class="empty"><text class="empty__title">{{ tab === '全部' ? '还没有行程' : '这一类还没有行程' }}</text><text class="k-meta">报名岗位、预订住宿或报名活动后，会在这里自动生成行程</text></view>
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
          <view class="k-row k-gap4 k-mt10"><k-icon name="map-pin" :size="15" color="muted" :stroke="1.8" /><text class="k-small k-muted">{{ d.place || d.city }}</text></view>
          <view class="head__line" />
          <view class="k-row k-gap12"><text class="k-small">{{ d.rangeText }}</text><text class="k-meta">{{ d.totalText }}</text></view>
        </view>

        <view class="tl">
          <view v-for="(d, i) in timeline" :key="d.date" class="tl__row" :class="{ last: i === timeline.length - 1 }">
            <view class="tl__left">
              <view class="tl__dot" /><view v-if="i < timeline.length - 1" class="tl__line" />
              <text class="tl__date">{{ d.date }}</text><text class="tl__week">{{ d.week }}</text>
              <text v-if="d.extra" class="tl__date tl__extra">{{ d.extra }}</text>
            </view>
            <view class="tl__right">
              <view class="tl__dot tl__dot--r" /><view v-if="i < timeline.length - 1" class="tl__line" />
              <text v-for="(l, j) in d.lines" :key="j" class="tl__text" :class="{ today: l === '今天' }">{{ l }}</text>
            </view>
          </view>
        </view>

        <view class="info">
          <view v-for="(r, i) in infoRows" :key="r.label" class="info__row" :class="{ 'has-line': i < infoRows.length - 1 }">
            <text class="info__label">{{ r.label }}</text>
            <view class="k-flex1 k-col k-gap6"><text v-for="(l, j) in r.lines" :key="j" class="k-small k-muted"><k-icon v-if="l.pin" name="map-pin" :size="13" color="muted" :stroke="1.8" />{{ l.t || l }}</text></view>
            <k-button type="secondary" size="sm" :label="r.btn" @click="r.go()" />
          </view>
        </view>

        <view class="acts">
          <view v-for="a in acts.filter(x => (x.label !== '加入当地群' || groupChatEnabled) && (x.label !== '编辑行程' || communityEnabled))" :key="a.label" class="acts__item" @click="a.go()"><k-icon :name="a.icon" :size="30" color="ink" :stroke="1.4" /><text>{{ a.label }}</text></view>
        </view>
        <view class="k-home-indicator" />
      </view>
    </template>

    <!-- 3 同行候选 -->
    <template v-else-if="s === 3">
      <!-- 之前返回到 s=2「行程详情」，可同行候选是从列表 / 外部链接进来的，详情是空白页 -->
      <k-topbar title="同行候选" back custom-back @back="backTo(1)">
        <!-- 城市切换之前放在右上角，正好压在微信胶囊按钮下面（还仿了胶囊的圆环）、点不到；挪到标题下面单独一行 -->
        <view class="city-row"><view class="city-cap" @click="switchPlan"><k-icon name="map-pin" :size="15" color="ink" :stroke="1.8" /><text>{{ matchCity }}</text><k-icon name="chevron-down" :size="14" color="ink" :stroke="2" /></view><text class="k-meta">点城市切换用来匹配的公开行程</text></view>
      </k-topbar>
      <view class="k-body match">
        <view class="match__head">
          <view class="k-between"><text class="match__title">{{ matchTitle }}</text><view class="filter-pill" @click="matchFilter"><text class="k-small">筛选</text><k-icon name="chevron-right" :size="14" color="ink" /></view></view>
          <view class="k-row k-gap6 k-mt6"><k-icon name="shield-check" :size="16" color="green" :stroke="1.8" /><text class="k-small k-muted">已为你隐藏隐私信息，放心交流</text></view>
          <view v-for="p in people" :key="p.planId" class="person" @click="openPerson(p)">
            <image class="person__avatar" :src="p.avatar" mode="aspectFill" />
            <view class="k-flex1">
              <view class="k-between"><text class="person__name">{{ p.name }}</text><text class="person__days">{{ p.days }}天重叠</text></view>
              <view class="k-row k-gap10 k-mt4"><text class="k-small k-muted">{{ p.meta }}</text><k-chip v-if="p.phoneVerified" tone="green" icon="shield-check" icon-fill>手机已验证</k-chip></view>
              <view class="k-mt6"><k-chip v-if="p.tripVerified" tone="green" icon="shield-check" icon-fill>行程已验证</k-chip></view>
              <view class="person__hobby"><text class="k-small k-muted">共同兴趣</text><text class="k-small">{{ p.hobby }}</text></view>
            </view>
          </view>
          <view v-if="!people.length" class="empty"><text class="empty__title">{{ mt.needPlan ? '发布公开行程后才能匹配同行' : '暂时没有重叠的同行' }}</text><text class="k-meta">{{ mt.needPlan ? '点上方城市或「筛选」可发布 / 切换公开行程' : '有新的公开行程和你重叠时会出现在这里' }}</text></view>
        </view>
      </view>
      <view class="privacy-bar privacy-bar--fixed">
        <view class="privacy-bar__icon"><k-icon name="lock" :size="14" color="green" :stroke="1.8" /></view>
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
          <text class="profile__overlap">{{ pp.overlap }}</text>
          <view class="profile__sec"><text class="profile__h">公开简介</text><text class="k-small k-muted k-pre profile__bio">{{ pp.intro }}</text></view>
          <view v-if="skills.length" class="profile__sec"><text class="profile__h">想一起做的事</text><view class="k-row k-gap10 k-mt10"><view v-for="sk in skills" :key="sk" class="skill"><text>{{ sk }}</text></view></view></view>
          <view class="profile__sec"><text class="profile__h">旅行偏好</text>
            <view class="prefs"><view v-for="p in prefs" :key="p.label" class="prefs__item"><view class="prefs__circle"><k-icon :name="p.icon" :size="22" color="ink" :stroke="1.5" /></view><text class="k-small">{{ p.label }}</text></view></view>
          </view>
          <view class="profile__sec no-line"><view class="k-row k-gap4"><text class="profile__h">共同日期</text><text class="k-small k-muted">（重叠{{ pp.overlapDays || 0 }}天）</text></view>
            <view class="dates">
              <view v-for="(d, i) in dates" :key="d.d" class="dates__item"><text class="dates__d">{{ d.d }}</text><view class="dates__track"><view v-if="i > 0" class="dates__line dates__line--l" /><view v-if="i < dates.length - 1" class="dates__line dates__line--r" /><view class="dates__dot" /></view><text class="k-meta">{{ d.w }}</text></view>
            </view>
          </view>
          <view class="notice"><k-icon name="shield-check" :size="16" color="green" :stroke="1.8" /><text class="k-small k-muted">将向对方发起私信，介绍你们自己与行程计划</text></view>
          <k-button block class="k-mt10" @click="meet">认识一下</k-button>
          <view class="k-center-box k-mt10" @click="shareCard"><text class="k-small">分享我的行程名片</text></view>
          <view class="privacy-bar privacy-bar--inline">
            <view class="privacy-bar__icon"><k-icon name="lock" :size="14" color="green" :stroke="1.8" /></view>
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
  { icon: 'bot', label: '编辑到店信息', go: () => (d.value.appId ? go(R.jobContract + '?appId=' + d.value.appId) : toast('这段行程没有需要填写的到店信息')) },
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
const PREF_ICON = { 户外徒步: 'footprints', 摄影创作: 'camera', 咖啡探店: 'coffee', 美食探索: 'cooking-pot', 手作体验: 'leaf', 逛市集: 'store', 城市漫步: 'map-pin', 其他: 'heart' }
const prefs = computed(() => (pp.value.prefs || []).slice(0, 4).map(l => ({ label: l, icon: PREF_ICON[l] || 'heart' })))
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
</style>
