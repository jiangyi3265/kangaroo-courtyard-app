<template>
  <!-- #ifdef MP-WEIXIN -->
  <page-meta :page-style="aiOpen ? 'overflow: hidden' : ''" />
  <!-- page-meta 必须是页面第一个节点：AI袋鼠弹层开着时锁住页面滚动（网页版由弹层自己锁 body） -->
  <!-- #endif -->
  <view class="k-page city-page" :class="$userSurface">
    <template v-if="s === 1 || (!recruitmentEnabled && s > 2)">
      <k-topbar :bg="scrollStep < 2 ? 'var(--k-top)' : ''"><template #left><view class="city-name" hover-class="k-press" @click="openSwitch"><k-icon name="map-pin" :size="14" color="red" /><text>{{ city }}</text><k-icon name="chevron-down" :size="12" color="muted" /></view></template></k-topbar>
      <view class="city-home k-pad-tab">
        <view class="city-hero">
          <text class="city-hero__eyebrow">本周氛围</text>
          <view class="city-hero__name"><view class="k-row k-gap6" hover-class="k-press" @click="openSwitch"><text class="city-hero__city">{{ city }}</text></view><text class="city-hero__region">{{ ov.region }}</text></view>
          <text class="city-hero__slogan">慢下来，\n遇见在地生活</text>
          <view class="city-hero__meta"><view class="city-hero__safe"><k-icon name="shield-check" :size="12" color="green" /><text>{{ safeText }}</text></view><text class="city-hero__note">天气以当地预报为准</text></view>
          <view class="bot-fab" @click="openChat"><image src="/static/user-icons/mine-ai.png" mode="aspectFit" /><view class="bot-fab__spark"><k-icon name="sparkles" :size="12" color="white" /></view></view>
        </view>
        <view class="stats"><view v-for="item in stats" :key="item.label" class="stat"><view class="stat__num" :class="{ 'is-zero': !item.num }">{{ item.num }}</view><text class="stat__label">{{ item.label }}</text></view></view>
        <view class="city-sections">
          <view v-for="item in citySections" :key="item.title" class="city-banner" hover-class="k-press-s" @click="go(item.route)">
            <view class="city-banner__pic"><k-icon :name="item.icon" :size="20" color="red" /></view>
            <view class="city-banner__copy"><text class="city-section__head">{{ item.title }}</text><text class="city-banner__title">{{ item.main }}</text><text class="city-banner__sub">{{ item.sub }}</text></view>
            <view class="k-row" hover-class="k-press" @click.stop="go(item.route)"><text>更多</text><k-icon name="chevron-right" :size="12" color="muted" /></view>
          </view>
        </view>
        <text v-if="city !== ALL" class="group-label">当前城市群</text>
        <view v-if="communityEnabled && city !== ALL" class="city-group" hover-class="k-press-s" @click="go(R.community)"><view class="city-group__icon"><k-icon name="users-round" :size="22" color="red" /></view><view class="k-flex1"><text class="city-group__title">{{ ov.region || city }}</text><text class="city-group__sub">{{ groupMembers }}</text></view><k-icon name="chevron-right" :size="12" color="muted" /></view>
        <view v-if="city !== ALL && ov.builders?.length" class="city-builders">
          <text class="group-label">城市共建人</text>
          <view class="city-builders__list">
            <view v-for="builder in ov.builders" :key="builder.userId" class="city-builder" hover-class="k-press" @click="go(R.userProfile + '?uid=' + builder.userId)">
              <view class="city-builder__icon"><text>{{ (builder.name || '').slice(0, 1) }}</text><view class="city-builder__badge"><k-icon name="medal" :size="12" color="red" /></view></view>
              <text class="city-builder__name">{{ builder.name }}</text>
              <k-icon name="chevron-right" :size="12" color="muted" />
            </view>
          </view>
        </view>
      </view>
      <k-tabbar active="home" />
    </template>

    <template v-else-if="s === 2">
      <k-topbar title="切换城市" back custom-back @back="backFrom(2)">
        <!-- 边打字边滑看结果：iOS 聚焦时输入框会被提到原生层，文字会脱离输入框浮在顶栏/列表上，always-embed 让它留在页面里 -->
        <view class="city-search-bar"><view class="city-search"><k-icon name="search" :size="16" color="muted" /><input :always-embed="true" v-model="keyword" placeholder="搜索城市、区县 / 拼音" placeholder-class="k-placeholder" /></view></view>
      </k-topbar>
      <view class="switch-body k-pad-bottom">
        <text class="switch-title switch-title--first">当前定位</text>
        <view class="city-card">
          <view class="current-city" @click="chooseLocated"><k-icon name="map-pin" :size="18" color="red" /><text class="current-city__name">{{ locLabel }}</text><k-chip v-if="located && located.found && located.name === city" tone="green"><text>当前城市</text></k-chip><view class="relocate" @click.stop><k-icon name="locate-fixed" :size="20" color="ink2" @click="locate" /></view></view>
          <!-- 从首页城市胶囊进来的才有「全部城市」：首页默认就是全部城市，选过某个城市后要能换回来（换回来后首页的 AI 匹配按全国找） -->
          <view v-if="fromHome" class="current-city" hover-class="k-press" @click="chooseAll"><k-icon name="globe" :size="18" color="ink2" /><text class="current-city__name">全部城市</text><k-icon v-if="city === ALL" name="check" :size="18" color="red" /></view>
        </view>
        <view class="switch-head"><text>最近访问</text><view class="switch-head__tool" :class="{ 'is-off': !recentShown.length }"><k-icon name="trash-2" :size="16" color="muted" @click="clearRecent" /></view></view>
        <text v-if="!recentShown.length" class="switch-empty">还没有访问过的城市，选过的会出现在这里</text>
        <!-- 当前选着的城市：胶囊浅棕底、深棕字，字后面一个小勾（全部城市在上面那行打勾）；它不在最近访问里时（比如只在兴趣城市里选过）排到最近访问第一个 -->
        <view class="city-chips"><view v-for="name in recentShown" :key="name" class="city-chip" :class="{ on: name === city }" @click="choose(name)"><text>{{ name }}</text><view v-if="name === city" class="city-chip__on"><k-icon name="check" :size="12" color="red" /></view></view></view>
        <text class="switch-title hot-title">热门城市</text>
        <view class="city-chips city-chips--five"><view v-for="name in hotCities" :key="name" class="city-chip" :class="{ on: name === city }" @click="choose(name)"><text>{{ name }}</text><view v-if="name === city" class="city-chip__on"><k-icon name="check" :size="12" color="red" /></view></view></view>
        <view class="switch-title alpha-title"><text>{{ keyword.trim() ? `搜索结果（${matchedCities.length}）` : '按字母查找' }}</text><text v-if="!keyword.trim()" class="alpha-hint"> · 支持全国区县搜索</text></view>
        <view v-for="group in alphaCities" :id="'city-group-' + group.letter" :key="group.letter" class="alpha-group"><text class="alpha-group__letter">{{ group.letter }}</text><view v-for="item in group.items" :key="item.name" class="alpha-group__city" hover-class="k-press" @click="choose(item.name)"><text>{{ item.name }}</text><text v-if="keyword.trim()" class="city-region">{{ item.province }}{{ item.parentName && item.parentName !== item.province ? ' · ' + item.parentName : '' }}</text></view></view>
        <view v-if="keyword.trim() && !matchedCities.length" class="city-search-empty"><view class="state-icon"><k-icon name="map-pin-x" :size="32" color="red" /></view><text>没有找到该城市或区县，试试全称或拼音</text></view>
        <text v-if="visibleLimit < matchedCities.length" class="city-search-more" @click="loadMoreCities">继续加载城市</text>
        <view class="alphabet"><text v-for="letter in letters" :key="letter" @click="jumpToLetter(letter)">{{ letter }}</text></view>
      </view>
      <view v-if="locateFailed" class="locate-failed"><view class="k-row k-gap8"><k-icon name="map-pin-x" :size="16" color="muted" /><text>暂时无法确认位置，可搜索后手动选择</text></view><text class="locate-failed__retry" @click="locate">重试定位</text><view class="k-home-indicator" /></view>
    </template>

    <template v-else>
      <k-topbar title="推荐更合适的机会" back custom-back @back="backFrom(4)" />
      <view class="empty-body k-pad-safe">
        <view class="state-icon empty-icon"><k-icon name="search" :size="32" color="red" /></view>
        <text class="empty-title">暂时没找到完全合适的</text>
        <text class="empty-desc">与你的部分条件存在冲突，我们为你推荐\n放宽条件，找到更多可能</text>
        <view class="relax-card"><view class="conflict-card"><text class="conflict-card__title">与你的条件冲突</text><view v-for="c in conflicts" :key="c" class="conflict-card__line"><k-icon name="circle-alert" :size="14" color="alert" /><text>{{ c }}</text></view></view>
        <text class="conflict-card__title relax-title">建议放宽条件（可多选）</text><view v-for="(item,i) in visibleRelax" :key="item.label" class="relax-row"><k-icon :name="item.icon" :size="18" color="red" /><text class="relax-row__label">{{ item.label }}</text><text class="relax-row__value">{{ item.value }}</text><view class="k-switch" :class="{ on: item.on }" @click="toggleRelax(item)" /></view></view>
        <view class="empty-actions"><view class="empty-action"><view class="subscribe" hover-class="k-press-s" @click="subscribe"><k-icon name="bell-ring" :size="16" color="red" /><text class="subscribe__title">订阅新机会</text></view><text class="empty-action__hint">上新及时通知你</text></view><view class="empty-action"><view class="contact" hover-class="k-press-s" @click="openChat"><k-icon name="headset" :size="16" color="white" /><text class="subscribe__title">联系客服</text></view><text class="empty-action__hint">人工协助更高效</text></view></view>
        <view class="bot-fab bot-fab--empty" @click="openChat"><image src="/static/user-icons/mine-ai.png" mode="aspectFit" /><view class="bot-fab__spark"><k-icon name="sparkles" :size="12" color="white" /></view></view><view class="k-home-indicator" />
      </view>
    </template>
    <!-- 悬浮袋鼠、「联系客服」：AI袋鼠在本页底部弹出，不再切到单独的客服屏 -->
    <k-ai-sheet :show="aiOpen" ctx="city" @close="closeAi" />
  </view>
</template>

<script setup>
import { communityEnabled, stayBookingEnabled, recruitmentEnabled } from "@/common/features.js"
// ---------------------------------------------------------------------------
// 城市页接入情况：
//   s=1 城市主页：在招机会 / 本周上新 / 可报名活动、住哪里 / 做什么 / 去活动的真实数量、城市群、安心商家占比；
//       没有天气数据来源，天气卡不再显示温度，改为如实提示
//   s=2 切换城市：全国城市与区县搜索、热门 + 字母索引、最近访问、行政区边界定位；
//       从首页城市胶囊进来（?s=2&from=home）的多一行「全部城市」，选完直接回首页，不落到城市主页
//   s=3 智能客服：10-16 起改成底部弹出的 AI袋鼠（components/k-ai-sheet），旧链接 ?s=3 打开城市主页并弹出它，收起后回来源页
//   s=4 找不到合适的：首页匹配为空时进来，放宽日期 / 预算 / 城市后重新匹配；可订阅新机会
// ---------------------------------------------------------------------------
import { ref, reactive, computed, watch, nextTick, onUnmounted, getCurrentInstance } from 'vue'
import { onReachBottom, onShow, onPageScroll } from '@dcloudio/uni-app'
import { filterCities, groupCities, confirmedLocation, businessCityName, cityEntries } from '@/common/city-directory.js'
import { useScreen, go, back, toast } from '@/common/screen.js'
import { apiCities, apiCityOverview, apiHomeMatch, apiAddJobSub, apiJobSubs } from '@/common/api.js'
import { experience, ensureSession, savePreferences, saveAllCities } from '@/common/experience.js'
import { locateCity } from '@/common/locate.js'
import { confirm, errText } from '@/common/ui.js'
import R from '@/common/routes.js'

let landing = 1
// 纯展示：大字城市名滚出去后顶栏才显示城市名（60），头图滚完顶栏才换成页面底色（200）
const scrollStep = ref(0)
onPageScroll(e => { scrollStep.value = e.scrollTop < 60 ? 0 : e.scrollTop < 200 ? 1 : 2 })
const aiOpen = ref(false)
// 首页城市胶囊直接打开的切换城市屏：选完回首页（首页 onShow 会重新读城市、刷新推荐）
const fromHome = ref(false)
const s = useScreen(4, {
  onLoad: async (q) => {
    landing = s.value
    if (s.value === 3) { s.value = 1; aiOpen.value = true }
    fromHome.value = q?.from === 'home' && s.value === 2
    await ensureSession()
    if (q?.city) city.value = q.city
    loadOverview()
    if (s.value === 2) loadCities()
    if (s.value === 4) loadEmpty()
  }
})
// 之前切换城市 / 放宽条件屏的返回一律落到城市主页（主页没有返回键）：首页匹配为空进来的，返回后困在城市主页。
// 现在直接打开的那一屏回来源页，页内点进来的回城市主页。
// AI袋鼠是本页底部的弹层，开着时还在原来那一屏；旧链接 ?s=3 直接打开的，收起后回来源页（点了回答里的按钮跳走的不回）
const openChat = () => { aiOpen.value = true }
const closeAi = (why) => {
  aiOpen.value = false
  if (landing !== 3) return
  landing = 1
  if (why !== 'nav') back()
}
const backFrom = (n) => {
  if (n === landing) return back()
  s.value = 1
}
// 没选过城市的和首页一样是「全部城市」，按全部城市统计；之前默认成大理，首页写着全部城市，点进来却是大理的数据
const ALL = '全部城市'
const city = ref((!experience.allCities && experience.cities && experience.cities[0]) || ALL)
// 带上本页城市（全部城市时不带）：之前房源列表按上次搜索的城市打开，和这里写的「N 个旅居房源」不是同一个城市
const cityQuery = computed(() => (city.value === ALL ? '' : '?city=' + encodeURIComponent(city.value)))
const ov = ref({ siblings: [], builders: [] })
let overviewRequest = 0
async function loadOverview() {
  const request = ++overviewRequest
  const requestedCity = city.value
  ov.value = { ...ov.value, builders: [] }
  try {
    const data = (await apiCityOverview(requestedCity)).data
    if (request === overviewRequest && requestedCity === city.value && data) ov.value = data
  } catch (e) { /* 统计失败时数字显示为 0 */ }
}
onShow(() => { if (overviewRequest > 0 && s.value === 1) loadOverview() })
// 「安心商家认证进行中」9 个字在窄屏放不下，缩成「安心商家认证中」（意思不变）；再放不下时在胶囊里折行
const safeText = computed(() => (ov.value.safeRatio == null || ov.value.safeRatio === 0 ? '安心商家认证中' : `安心商家 ${ov.value.safeRatio}%`))
const stats = computed(() => [{ num: ov.value.jobs || 0, label: '在招机会' }, { num: ov.value.newJobs || 0, label: '本周上新' }, { num: ov.value.activities || 0, label: '可报名活动' }].filter(x => recruitmentEnabled.value || x.label === '可报名活动'))
const citySections = computed(() => [
  { title: '住哪里', main: `把${city.value === ALL ? '远方' : city.value}，过成日常`, sub: `${ov.value.stays || 0} 个旅居房源可预订`, icon: 'house', route: R.staysList + cityQuery.value },
  { title: '做什么', main: '手作工作 · 与在地共创', sub: '发现各地换工、兼职与全职机会', icon: 'briefcase-business', route: R.jobsList },
  { title: '去活动', main: '市集 / 沙龙 / 工作坊', sub: `本周 ${ov.value.weekActivities || 0} 场活动`, icon: 'calendar-days', route: R.activity }
].filter(item => (stayBookingEnabled.value || item.title !== '住哪里') && (recruitmentEnabled.value || item.route !== R.jobsList)))
const groupMembers = computed(() => (ov.value.siblings || []).join(' · ') || city.value)

// ---------------- s=2 切换城市 ----------------
const keyword = ref('')
const dict = ref({ hot: [], groups: [] })
async function loadCities() {
  try {
    dict.value = (await apiCities()).data || dict.value
  } catch (e) {
    toast(errText(e, '城市加载失败'))
  }
  locate()
}
const openSwitch = () => { s.value = 2; loadCities() }
const RECENT_KEY = 'kangaroo:recent-cities'
const recentCities = ref((() => { try { return uni.getStorageSync(RECENT_KEY) || [] } catch (e) { return [] } })())
const recentShown = computed(() => (city.value === ALL || recentCities.value.includes(city.value) ? recentCities.value : [city.value, ...recentCities.value].slice(0, 8)))
const hotCities = computed(() => dict.value.hot || [])
const visibleLimit = ref(100)
const matchedCities = computed(() => filterCities(dict.value, keyword.value))
const alphaCities = computed(() => groupCities(matchedCities.value.slice(0, visibleLimit.value)))
const letters = computed(() => groupCities(matchedCities.value).map(g => g.letter))
watch(keyword, () => { visibleLimit.value = 100 })
const loadMoreCities = () => { visibleLimit.value += 100 }
onReachBottom(() => { if (s.value === 2) loadMoreCities() })
// 10-16 跟进：之前直接 pageScrollTo 到分组（如 Z）的顶端，分组字母停在屏幕最上沿，正好被吸顶的「切换城市」顶栏盖住。
// 现在量出分组和列表开头（.switch-body，紧贴在顶栏下面）的距离，滚到这个位置：分组字母刚好露在顶栏下沿。
// 不用 pageScrollTo 的 offsetTop：H5 不认它，小程序也要基础库 2.23 以上；顶栏高度（状态栏 + 44）各机型不同，量出来的差值最准
const cityPage = getCurrentInstance()
const letterScrollTop = (bodyTop, groupTop) => Math.max(0, Math.round(groupTop - bodyTop))
async function jumpToLetter(letter) {
  const index = matchedCities.value.findIndex(item => item.initial === letter)
  if (index < 0) return
  visibleLimit.value = Math.max(visibleLimit.value, index + 50)
  await nextTick()
  const selector = '#city-group-' + letter
  uni.createSelectorQuery().in(cityPage && cityPage.proxy).select('.switch-body').boundingClientRect().select(selector).boundingClientRect().exec((res) => {
    const [body, group] = res || []
    if (body && group) uni.pageScrollTo({ scrollTop: letterScrollTop(body.top, group.top), duration: 200 })
    else uni.pageScrollTo({ selector, duration: 200 })
  })
}
const located = ref(null)
const locateFailed = ref(false)
const locating = ref(false)
let locateAttempt = 0
onUnmounted(() => { locateAttempt++ })
const locLabel = computed(() => (confirmedLocation(located.value) ? located.value.label : (locateFailed.value ? '暂无法确认，请手动选择' : '正在定位…')))
// 定位本身在 common/locate.js（首页首次打开的自动定位也用它）；这里只管「正在定位 / 定位失败」的显示和过期结果
function locate() {
  if (locating.value) return
  const attempt = ++locateAttempt
  locating.value = true
  locateFailed.value = false
  located.value = null
  locateCity({ onFailure: message => { if (attempt === locateAttempt) toast(message) } }).then((result) => {
    if (attempt !== locateAttempt) return
    located.value = result
    locateFailed.value = !result
    locating.value = false
  })
}
function choose(name) {
  if (!name) return
  // 搜索选中区县时按所属城市保存与查询
  name = businessCityName(cityEntries(dict.value), name)
  city.value = name
  const rest = (experience.cities || []).filter(c => c !== name)
  savePreferences([name, ...rest].slice(0, 5))
  saveAllCities(false)
  recentCities.value = [name, ...recentCities.value.filter(c => c !== name)].slice(0, 8)
  try { uni.setStorageSync(RECENT_KEY, recentCities.value) } catch (e) { /* ignore */ }
  if (fromHome.value) return back()
  s.value = 1
  loadOverview()
}
// 换回「全部城市」：只记首页的「全部城市」开关（saveAllCities），兴趣城市列表不动。之前是清空兴趣城市，
// 社区、订房列表默认的城市和「选兴趣城市」页里选过的城市跟着全没了（最近访问也还留着，想换回去点一下就行）
function chooseAll() {
  city.value = ALL
  saveAllCities(true)
  back()
}
const chooseLocated = () => (located.value && located.value.found ? choose(located.value.name) : locate())
async function clearRecent() {
  if (!recentCities.value.length || !(await confirm('清空最近访问', '只清除本机记录，确认？'))) return
  recentCities.value = []
  try { uni.removeStorageSync(RECENT_KEY) } catch (e) { /* ignore */ }
}

// ---------------- s=4 放宽条件 ----------------
const last = ref(null)
const emptyRes = ref({ conflicts: [] })
async function loadEmpty() {
  try { last.value = uni.getStorageSync('kangaroo:last-match') || null } catch (e) { last.value = null }
  if (!last.value) return
  try {
    emptyRes.value = (await apiHomeMatch(last.value)).data
  } catch (e) { /* ignore */ }
}
const conflicts = computed(() => emptyRes.value.conflicts || [])
const relaxItems = reactive([
  { key: 'date', label: '放宽日期范围', value: '± 7 天', icon: 'calendar-days', on: false },
  { key: 'budget', label: '提高预算上限', value: '上浮 50%', icon: 'badge-dollar-sign', on: false },
  { key: 'city', label: '扩大到同城市群', value: '周边城市', icon: 'map-pin', on: false }
])
// 全国匹配（接口回的 city 是空串）时没有「同城市群」可扩，这一项不显示
const visibleRelax = computed(() => relaxItems.filter(x => x.key !== 'city' || emptyRes.value.city !== ''))
async function toggleRelax(item) {
  item.on = !item.on
  if (!last.value) return
  try {
    const res = (await apiHomeMatch({ ...last.value, relax: relaxItems.filter(x => x.on).map(x => x.key) })).data
    emptyRes.value = res
    if (!res.empty) {
      try { uni.setStorageSync('kangaroo:last-result', res) } catch (e) { /* ignore */ }
      toast(`放宽后找到 ${res.jobs.length + res.stays.length + res.activities.length} 个结果`)
      setTimeout(() => go(R.home + '?from=relax'), 500)
    } else {
      toast('放宽后仍然没有，可以订阅新机会')
    }
  } catch (e) {
    toast(errText(e, '重新匹配失败'))
  }
}
let subscribing = false
// 订阅实际匹配的那个城市（文字里写了「拉萨」就是按拉萨匹配的，接口回的 city 就是它）；之前一律用本页城市，没选过城市的人被订成了大理
async function subscribe() {
  const c = emptyRes.value.city || (last.value && last.value.city) || (city.value === ALL ? '' : city.value)
  if (!c) { toast('先选一个城市，再订阅它的新机会'); return openSwitch() }
  if (subscribing) return
  subscribing = true
  try {
    // 2026-11-03 主人：订阅每人只能有一条，之后都是修改。已有订阅（只关注门店的那种不算）就带着这座城市去「当前订阅」页改，不再另建一条
    const mine = ((await apiJobSubs()).data || []).filter(x => !(x.storeId && !x.cities && !x.jobTypes && !x.keyword))
    if (mine.length) return go(R.jobsFilter + '?s=2&cur=1&addCity=' + encodeURIComponent(c))
    await apiAddJobSub({ cities: [c], freq: 'instant' })
    toast(`已订阅${c}的新机会，上新会通知你`)
  } catch (e) {
    toast(errText(e, '订阅失败'))
  } finally {
    subscribing = false
  }
}
</script>

<style scoped lang="scss">
.city-page { font-family: var(--k-sans); }
.city-page { --k-bg: var(--k-page); --k-top: var(--k-red-soft); --k-sh1: none; }
.city-name { height: 44px; margin-left: 8px; display: flex; align-items: center; gap: 4px; font-size: 13px; }
.state-icon { width: 56px; height: 56px; display: flex; align-items: center; justify-content: center; border-radius: 16px; background: var(--k-red-soft); }
.city-home { padding-left: 16px; padding-right: 16px; background: var(--k-bg); }
.city-hero { position: relative; margin: 0 -16px; padding: 8px 88px 56px 16px; background: linear-gradient(180deg,var(--k-red-soft) 0,var(--k-red-soft) 62%,var(--k-page) 100%); }
.city-hero__eyebrow { display: block; color: var(--k-red-deep); font-size: 12px; font-weight: 500; line-height: 16px; letter-spacing: 1px; }
.city-hero__name { display: flex; flex-wrap: wrap; align-items: baseline; gap: 0 8px; margin-top: 4px; }
.city-hero__city { font-size: 32px; font-weight: 700; line-height: 44px; letter-spacing: 1px; }
.city-hero__region { color: var(--k-ink2); font-size: 13px; }
.city-hero__slogan { display: block; margin-top: 4px; color: var(--k-ink2); font-size: 15px; line-height: 1.6; white-space: pre-line; }
.city-hero__meta { display: flex; align-items: center; flex-wrap: wrap; gap: 4px 8px; margin: 12px -72px 0 0; }
.city-hero__note { color: var(--k-muted); font-size: 11px; line-height: 16px; }
.city-hero__safe { max-width: 100%; box-sizing: border-box; min-height: 20px; padding: 2px 6px; border-radius: 4px; background: var(--k-green-soft); color: var(--k-green); display: inline-flex; align-items: center; gap: 4px; font-size: 11px; font-weight: 500; line-height: 16px; }
.city-hero__safe > text { min-width: 0; word-break: break-all; }
/* 不能写 「> :first-child」 这种冒号前不带元素的选择器：微信小程序样式编译报错，整个小程序上传失败（2026-10-11 遇到过） */
.stats { position: relative; z-index: 1; margin-top: -32px; padding: 16px 0; display: flex; border-radius: 12px; background: var(--k-paper); }
.stat { position: relative; flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; }
.stat__num { font-size: 24px; font-weight: 700; line-height: 28px; font-variant-numeric: tabular-nums; }
.stat__num.is-zero { color: var(--k-ink2); font-weight: 600; }
.stat__label { margin-top: 2px; color: var(--k-muted); font-size: 11px; }
.city-sections { margin-top: 12px; border-radius: 12px; background: var(--k-paper); overflow: hidden; }
.city-banner { position: relative; display: flex; align-items: center; gap: 12px; padding: 12px 16px; }
.city-banner + .city-banner::before { content: ''; position: absolute; left: 68px; right: 0; top: 0; height: 1px; background: var(--k-line); transform: scaleY(.5); }
.city-banner .k-row { flex: 0 0 auto; height: 44px; gap: 2px; color: var(--k-muted); font-size: 12px; }
.city-section__head { display: block; color: var(--k-muted); font-size: 11px; font-weight: 500; line-height: 16px; }
.city-banner__pic { width: 40px; height: 40px; flex: 0 0 auto; display: flex; align-items: center; justify-content: center; border-radius: 12px; background: var(--k-red-soft); }
.city-banner__copy { flex: 1; min-width: 0; }
.city-banner__title, .city-banner__sub { display: block; }
.city-banner__title { font-size: 15px; font-weight: 600; line-height: 22px; }
.city-banner__sub { color: var(--k-muted); font-size: 12px; line-height: 16px; }
.group-label { display: block; margin: 24px 0 12px; font-size: 16px; font-weight: 700; line-height: 22px; }
.city-group { min-height: 64px; padding: 12px 16px; display: flex; align-items: center; gap: 12px; border-radius: 12px; background: var(--k-paper); }
.city-group__icon { width: 40px; height: 40px; flex: 0 0 auto; display: flex; align-items: center; justify-content: center; border-radius: 12px; background: var(--k-red-soft); }
.city-group__title { display: block; font-size: 15px; font-weight: 600; line-height: 22px; }
.city-group__sub { display: block; margin-top: 2px; color: var(--k-muted); font-size: 12px; line-height: 1.5; }
.city-builders__list { padding: 0 16px; border-radius: 12px; background: var(--k-paper); overflow: hidden; }
.city-builder { position: relative; display: flex; align-items: center; gap: 12px; min-height: 52px; padding: 8px 0; }
.city-builder__icon { position: relative; width: 32px; height: 32px; flex: 0 0 auto; border-radius: 50%; background: var(--k-red-soft); color: var(--k-red-deep); font-size: 14px; font-weight: 600; line-height: 32px; text-align: center; }
.city-builder__badge { position: absolute; right: -4px; bottom: -4px; width: 16px; height: 16px; display: flex; align-items: center; justify-content: center; border-radius: 50%; background: var(--k-paper); }
.city-builder + .city-builder::before { content: ''; position: absolute; left: 44px; right: 0; top: 0; height: 1px; background: var(--k-line); transform: scaleY(.5); }
.city-builder__name { flex: 1; min-width: 0; font-size: 14px; line-height: 1.5; overflow-wrap: anywhere; }
.bot-fab { position: fixed; z-index: 60; right: 12px; bottom: 104px; width: 44px; height: 44px; border-radius: 50%; background: var(--k-paper); display: flex; align-items: center; justify-content: center; box-shadow: var(--k-sh2); }
.bot-fab image { width: 26px; height: 28px; }
.city-hero .bot-fab { position: absolute; z-index: 1; right: 16px; top: 28px; width: 56px; height: 56px; box-shadow: none; border: 1px solid var(--k-red-line); }
.bot-fab__spark { position: absolute; right: -2px; bottom: -2px; width: 20px; height: 20px; border-radius: 50%; background: var(--k-red); box-shadow: 0 0 0 2px var(--k-paper); display: flex; align-items: center; justify-content: center; }
.city-hero .bot-fab image { width: 32px; height: 34px; }
@media (max-width: 360px) { .city-home { padding-left: 12px; padding-right: 12px; } .city-hero { margin: 0 -12px; padding-left: 12px; } .city-banner, .city-group { padding: 12px; } .city-banner + .city-banner::before { left: 64px; } .city-builders__list { padding: 0 12px; } .city-group__sub { font-size: 11px; } }
.city-search-bar { padding: 2px 16px 10px; }
/* 吸顶栏下沿发丝线（定位到顶栏上，搜索栏就是顶栏最下面一块） */
.city-search-bar::after { content: ''; position: absolute; left: 0; right: 0; bottom: 0; height: 1px; background: var(--k-line); transform: scaleY(.5); }
.city-search { height: 40px; margin-right: 30px; padding: 0 14px; border-radius: 20px; background: var(--k-paper); display: flex; align-items: center; gap: 8px; }
.city-search input { flex: 1; height: 40px; font-size: 14px; }
/* 右边留 46 给 A–Z 索引（让开客服竖钮） */
.switch-body { position: relative; padding: 10px 46px calc(76px + var(--k-safe-bottom)) 16px; }
.switch-title { display: block; margin: 24px 0 12px; font-size: 16px; font-weight: 700; line-height: 22px; }
.switch-title--first { margin-top: 6px; }
.city-card { padding: 0 16px; border-radius: 12px; background: var(--k-paper); }
.current-city { position: relative; height: 52px; display: flex; align-items: center; gap: 8px; }
.current-city + .current-city::before { content: ''; position: absolute; left: 26px; right: 0; top: 0; height: 1px; background: var(--k-line); transform: scaleY(.5); }
.current-city__name { flex: 1; min-width: 0; font-size: 15px; font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
@media (max-width: 340px) { .current-city__name { font-size: 15px; } }
/* 重新定位：小程序里 k-icon 上的 @click.stop 拦不住内部 image 的 bindtap，点定位图标会连带触发外层「选这个城市」；
   动作挂在图标自己的 @click 上，外层 view 只用 @click.stop 拦住冒泡。点击区域 36px */
.current-city :deep(.k-chip.is-green) { color: var(--k-red-deep); background: var(--k-red-soft); font-weight: 500; }
.relocate { width: 36px; height: 36px; margin-right: -8px; display: flex; align-items: center; justify-content: center; }
.switch-head { display: flex; align-items: center; justify-content: space-between; height: 22px; margin: 24px 0 12px; font-size: 16px; font-weight: 700; }
.switch-head__tool.is-off { opacity: .3; }
.switch-head__tool { width: 36px; height: 36px; margin-right: -10px; display: flex; align-items: center; justify-content: center; }
.city-chips { display: grid; grid-template-columns: repeat(5,minmax(0,1fr)); gap: 8px; }
.switch-empty { display: block; color: var(--k-muted); font-size: 12px; line-height: 1.6; }
.alpha-hint { color: var(--k-muted); font-size: 12px; font-weight: 400; }
.city-chip { height: 32px; padding: 0 4px; border: 1px solid var(--k-paper); border-radius: 16px; background: var(--k-paper); display: flex; align-items: center; justify-content: center; gap: 2px; color: var(--k-ink2); font-size: 13px; }
.city-chip > text { min-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.city-chip.on { border-color: var(--k-red-soft); background: var(--k-red-soft); color: var(--k-red-deep); font-weight: 500; }
.city-chip__on { flex: 0 0 auto; display: flex; }
.alpha-group { margin-top: 8px; padding: 0 16px; border-radius: 12px; background: var(--k-paper); }
.alpha-title + .alpha-group { margin-top: 0; }
.alpha-group__letter { display: block; height: 32px; line-height: 32px; color: var(--k-red-deep); font-size: 12px; font-weight: 600; }
.alpha-group__city { position: relative; display: flex; flex-direction: column; justify-content: center; min-height: 48px; padding: 6px 0; font-size: 14px; line-height: 1.5; }
.alpha-group__city::before { content: ''; position: absolute; left: 0; right: 0; top: 0; height: 1px; background: var(--k-line); transform: scaleY(.5); }
.city-region { color: var(--k-muted); font-size: 11px; margin-top: 2px; }
.city-search-empty { display: flex; flex-direction: column; align-items: center; gap: 12px; padding: 28px 16px; border-radius: 12px; background: var(--k-paper); color: var(--k-ink2); font-size: 14px; font-weight: 500; text-align: center; }
.city-search-more { display: block; padding: 18px 8px; font-size: 13px; color: var(--k-red-deep); text-align: center; }
/* 每个字母的高度跟着屏幕高度走（2.5vh，812 高约 20px、640 高 16px、568 高约 14px）：22 个字母共 55vh，矮屏也全部露出来 */
.alphabet { position: fixed; right: 20px; top: 26%; max-height: 60vh; overflow-y: auto; color: var(--k-ink2); font-size: 11px; font-weight: 500; text-align: center; }
.alphabet > text { display: block; min-width: 20px; height: 2.5vh; padding: 0 2px; line-height: 2.5vh; }
.locate-failed { position: fixed; left: 0; right: 0; bottom: 0; z-index: 50; height: calc(52px + var(--k-safe-bottom)); padding: 0 16px var(--k-safe-bottom); box-shadow: 0 -.5px 0 var(--k-line); background: var(--k-paper); display: flex; align-items: center; justify-content: space-between; gap: 8px; color: var(--k-muted); font-size: 12px; }
.locate-failed .k-row { min-width: 0; }
.locate-failed .k-row text { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.locate-failed__retry { flex: 0 0 auto; height: 28px; padding: 0 0 0 12px; color: var(--k-red-deep); font-size: 13px; font-weight: 600; line-height: 28px; }
.empty-body { position: relative; min-height: calc(100vh - 88px); padding: 16px 16px calc(24px + var(--k-safe-bottom)); text-align: center; }
.empty-icon { margin: 8px auto 0; }
.empty-title { display: block; margin-top: 16px; font-size: 18px; font-weight: 700; line-height: 25px; }
.empty-desc { display: block; max-width: 280px; margin: 6px auto 0; color: var(--k-muted); font-size: 12px; line-height: 1.6; white-space: pre-line; }
.relax-card { margin-top: 20px; padding: 16px 16px 4px; border-radius: 12px; background: var(--k-paper); text-align: left; }
.conflict-card { position: relative; display: flex; flex-direction: column; gap: 8px; padding-bottom: 16px; }
.conflict-card::after { content: ''; position: absolute; left: 0; right: 0; bottom: 0; height: 1px; background: var(--k-line); transform: scaleY(.5); }
.conflict-card__title { font-size: 15px; font-weight: 600; line-height: 21px; }
.conflict-card__line { display: flex; align-items: flex-start; gap: 6px; color: var(--k-ink2); font-size: 14px; line-height: 1.6; }
.conflict-card__line :deep(.k-icon) { flex: 0 0 auto; margin-top: 4px; }
.relax-title { display: block; margin: 16px 0 4px; }
.relax-row { position: relative; min-height: 52px; display: flex; align-items: center; gap: 8px; }
.relax-row + .relax-row::before { content: ''; position: absolute; left: 26px; right: 0; top: 0; height: 1px; background: var(--k-line); transform: scaleY(.5); }
.relax-row__label { flex: 1; font-size: 14px; }
.relax-row__value { color: var(--k-muted); font-size: 12px; }
.empty-actions { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-top: 24px; }
.empty-action { min-width: 0; display: flex; flex-direction: column; align-items: center; gap: 6px; }
.subscribe, .contact { width: 100%; height: 44px; box-sizing: border-box; border: 1px solid var(--k-red-line); border-radius: 22px; background: var(--k-paper); color: var(--k-red-deep); display: flex; align-items: center; justify-content: center; gap: 6px; }
.contact { border: 0; background: var(--k-grad-brown); color: var(--k-paper); }
.subscribe__title { font-size: 15px; font-weight: 600; }
.empty-action__hint { color: var(--k-muted); font-size: 11px; }
.bot-fab--empty { right: 16px; bottom: calc(16px + var(--k-safe-bottom)); width: 40px; height: 40px; box-shadow: none; border: 1px solid var(--k-red-line); }
@media (max-width: 360px) { .locate-failed { padding: 0 12px var(--k-safe-bottom); } .locate-failed .k-row text { font-size: 11px; } .conflict-card__line { font-size: 13px; gap: 4px; } .relax-card { padding: 16px 12px 4px; } .city-chips { grid-template-columns: repeat(4,minmax(0,1fr)); } .switch-body { padding-left: 12px; } .city-search-bar { padding: 2px 12px 10px; } .city-search { margin-right: 34px; } .city-card, .alpha-group { padding: 0 12px; } .current-city__name { font-size: 14px; } }
</style>
