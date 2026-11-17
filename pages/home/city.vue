<template>
  <!-- #ifdef MP-WEIXIN -->
  <page-meta :page-style="aiOpen ? 'overflow: hidden' : ''" />
  <!-- page-meta 必须是页面第一个节点：AI袋鼠弹层开着时锁住页面滚动（网页版由弹层自己锁 body） -->
  <!-- #endif -->
  <view class="k-page city-page">
    <template v-if="s === 1 || (!recruitmentEnabled && s > 2)">
      <k-topbar><template #left><view class="city-name" @click="openSwitch"><text>{{ city }}</text><k-icon name="chevron-down" :size="16" color="ink" /></view></template></k-topbar>
      <view class="city-home k-pad-tab">
        <view class="weather-card">
          <view class="weather-card__visual"><image class="weather-card__image" src="/static/media/city-weather.jpg" mode="aspectFill" /><view class="weather-card__info"><view class="k-row"><text class="weather-card__degree">{{ city }}</text><text class="weather-card__weather">{{ ov.region }}</text></view><text class="weather-card__meta">天气以当地预报为准</text></view></view>
          <view class="weather-card__copy"><text class="weather-card__week">本周氛围</text><text class="weather-card__slogan">慢下来，\n遇见在地生活</text><view class="weather-card__score"><k-icon name="shield-check" :size="15" color="white" :stroke="2" /><text>{{ safeText }}</text></view></view>
        </view>
        <view class="stats"><view v-for="item in stats" :key="item.label" class="stat"><text class="stat__num">{{ item.num }}</text><text class="stat__label">{{ item.label }}</text></view></view>
        <view v-for="item in citySections" :key="item.title" class="city-section">
          <view class="city-section__head"><text>{{ item.title }}</text><view class="k-row" @click="go(item.route)"><text>更多</text><k-icon name="chevron-right" :size="15" color="muted" /></view></view>
          <view class="city-banner" @click="go(item.route)"><view class="city-banner__copy"><text class="city-banner__title">{{ item.main }}</text><text class="city-banner__sub">{{ item.sub }}</text></view><image class="city-banner__image" :src="item.image" mode="aspectFill" /></view>
        </view>
        <text v-if="city !== ALL" class="group-label">当前城市群</text>
        <view v-if="communityEnabled && city !== ALL" class="city-group" @click="go(R.community)"><view><text class="city-group__title">{{ ov.region || city }}</text><text class="city-group__sub">{{ groupMembers }}</text></view><k-icon name="chevron-right" :size="22" color="ink" /></view>
        <view v-if="city !== ALL && ov.builders?.length" class="city-builders">
          <text class="group-label">城市共建人</text>
          <view class="city-builders__list">
            <view v-for="builder in ov.builders" :key="builder.userId" class="city-builder" hover-class="k-press" @click="go(R.userProfile + '?uid=' + builder.userId)">
              <k-icon name="medal" :size="20" color="green" />
              <text class="city-builder__name">{{ builder.name }}</text>
              <k-icon name="chevron-right" :size="16" color="muted" />
            </view>
          </view>
        </view>
      </view>
      <view class="bot-fab" @click="openChat"><image src="/static/media/city-bot.jpg" mode="aspectFit" /></view>
      <k-tabbar active="home" />
    </template>

    <template v-else-if="s === 2">
      <k-topbar title="切换城市" back custom-back @back="backFrom(2)" />
      <view class="switch-body k-pad-bottom">
        <!-- 边打字边滑看结果：iOS 聚焦时输入框会被提到原生层，文字会脱离输入框浮在顶栏/列表上，always-embed 让它留在页面里一起滚 -->
        <view class="city-search"><k-icon name="search" :size="20" color="light" /><input :always-embed="true" v-model="keyword" placeholder="搜索城市、区县 / 拼音" placeholder-class="k-placeholder" /></view>
        <text class="switch-title">当前定位</text>
        <view class="current-city" @click="chooseLocated"><k-icon name="map-pin" :size="21" color="red" fill /><text class="current-city__name">{{ locLabel }}</text><k-chip v-if="located && located.found && located.name === city" tone="green"><text>当前城市</text></k-chip><view class="relocate" @click.stop><k-icon name="locate-fixed" :size="20" color="ink" @click="locate" /></view></view>
        <!-- 从首页城市胶囊进来的才有「全部城市」：首页默认就是全部城市，选过某个城市后要能换回来（换回来后首页的 AI 匹配按全国找） -->
        <view v-if="fromHome" class="current-city" hover-class="k-press" @click="chooseAll"><k-icon name="globe" :size="21" color="ink" /><text class="current-city__name">全部城市</text><k-icon v-if="city === ALL" name="check" :size="18" color="red" :stroke="2.2" /></view>
        <view class="switch-head"><text>最近访问</text><k-icon name="trash-2" :size="17" color="muted" @click="clearRecent" /></view>
        <!-- 当前选着的城市：胶囊描暖棕边、右上角打勾（全部城市在上面那行打勾）；它不在最近访问里时（比如只在兴趣城市里选过）排到最近访问第一个 -->
        <view class="city-chips"><view v-for="name in recentShown" :key="name" class="city-chip" :class="{ on: name === city }" @click="choose(name)"><text>{{ name }}</text><view v-if="name === city" class="city-chip__on"><k-icon name="check" :size="10" color="white" :stroke="3" /></view></view></view>
        <text class="switch-title hot-title">热门城市</text>
        <view class="city-chips city-chips--five"><view v-for="name in hotCities" :key="name" class="city-chip" :class="{ on: name === city }" @click="choose(name)"><text>{{ name }}</text><view v-if="name === city" class="city-chip__on"><k-icon name="check" :size="10" color="white" :stroke="3" /></view></view></view>
        <text class="switch-title alpha-title">{{ keyword.trim() ? `搜索结果（${matchedCities.length}）` : '按字母查找 · 支持全国区县搜索' }}</text>
        <view v-for="group in alphaCities" :id="'city-group-' + group.letter" :key="group.letter" class="alpha-group"><text class="alpha-group__letter">{{ group.letter }}</text><view v-for="item in group.items" :key="item.name" class="alpha-group__city" @click="choose(item.name)"><text>{{ item.name }}</text><text v-if="keyword.trim()" class="city-region">{{ item.province }}{{ item.parentName && item.parentName !== item.province ? ' · ' + item.parentName : '' }}</text></view></view>
        <text v-if="keyword.trim() && !matchedCities.length" class="city-search-empty">没有找到该城市或区县，试试全称或拼音</text>
        <text v-if="visibleLimit < matchedCities.length" class="city-search-more" @click="loadMoreCities">继续加载城市</text>
        <view class="alphabet"><text v-for="letter in letters" :key="letter" @click="jumpToLetter(letter)">{{ letter }}</text></view>
      </view>
      <view v-if="locateFailed" class="locate-failed"><view class="k-row k-gap8"><k-icon name="map-pin-x" :size="18" color="muted" /><text>暂时无法确认位置，可搜索后手动选择</text></view><text class="locate-failed__retry" @click="locate">重试定位</text><view class="k-home-indicator" /></view>
    </template>

    <template v-else>
      <k-topbar title="推荐更合适的机会" back custom-back @back="backFrom(4)" />
      <view class="empty-body k-pad-safe">
        <image class="empty-image" src="/static/media/city-empty.jpg" mode="aspectFit" />
        <text class="empty-title">暂时没找到完全合适的</text>
        <text class="empty-desc">与你的部分条件存在冲突，我们为你推荐\n放宽条件，找到更多可能</text>
        <view class="conflict-card"><text class="conflict-card__title">与你的条件冲突</text><text v-for="c in conflicts" :key="c">{{ c }}</text></view>
        <view class="relax-card"><text class="conflict-card__title">建议放宽条件（可多选）</text><view v-for="(item,i) in visibleRelax" :key="item.label" class="relax-row"><k-icon :name="item.icon" :size="19" color="ink" /><text class="relax-row__label">{{ item.label }}</text><text class="relax-row__value">{{ item.value }}</text><view class="k-switch" :class="{ on: item.on }" @click="toggleRelax(item)" /></view></view>
        <view class="empty-actions"><view class="subscribe" @click="subscribe"><text class="subscribe__title">订阅新机会</text><text>上新及时通知你</text></view><view class="contact" @click="openChat"><text class="subscribe__title">联系客服</text><text>人工协助更高效</text></view></view>
        <view class="bot-fab bot-fab--empty" @click="openChat"><image src="/static/media/city-bot.jpg" mode="aspectFit" /></view><view class="k-home-indicator" />
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
import { onReachBottom, onShow } from '@dcloudio/uni-app'
import { filterCities, groupCities, confirmedLocation, businessCityName, cityEntries } from '@/common/city-directory.js'
import { useScreen, go, back, toast } from '@/common/screen.js'
import { apiCities, apiCityOverview, apiHomeMatch, apiAddJobSub, apiJobSubs } from '@/common/api.js'
import { experience, ensureSession, savePreferences, saveAllCities } from '@/common/experience.js'
import { locateCity } from '@/common/locate.js'
import { confirm, errText } from '@/common/ui.js'
import R from '@/common/routes.js'

let landing = 1
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
  { title: '住哪里', main: `把${city.value === ALL ? '远方' : city.value}，过成日常`, sub: `${ov.value.stays || 0} 个旅居房源可预订`, image: '/static/media/city-stay.jpg', route: R.staysList + cityQuery.value },
  { title: '做什么', main: '手作工作 · 与在地共创', sub: '发现各地换宿、兼职与全职机会', image: '/static/media/city-work.jpg', route: R.jobsList },
  { title: '去活动', main: '市集 / 沙龙 / 工作坊', sub: `本周 ${ov.value.weekActivities || 0} 场活动`, image: '/static/media/city-event.jpg', route: R.activity }
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
/* 10-19 字体复查：--k-serif 现在指向标题字体（KG Sans，只有 700 / 900），整页挂着会把正文、小字都变成粗体 —— 整页用系统黑体，下面这些标题、大数字单独用标题字体 */
.city-page { font-family: var(--k-sans); }
.city-name, .weather-card__degree, .stat__num, .city-section__head, .city-banner__title, .group-label, .city-group__title, .switch-title, .current-city__name, .switch-head, .empty-title, .conflict-card__title, .subscribe__title { font-family: var(--k-display-font); }
.city-name { padding-left: 8px; display: flex; align-items: center; gap: 5px; font-size: 20px; font-weight: 700; }
/* 底部留到客服悬浮按钮（底 96px + 高 60px）上面：之前只留 108px，滑到底「当前城市群」那一行被悬浮按钮压住 */
.city-home { padding: 4px 16px 168px; }
/* 之前卡片定高 122px、左图占 55%：右栏「本周氛围 + 两行标语 + 绿色认证胶囊」在 360–390px 宽的手机上放不下，
   胶囊被挤得折行、压到标语上（内测截图「安心商家认证进行中」那一块）。现在卡片最低 122px、内容多了自动长高，
   左图收窄到 50%，右栏可收缩，胶囊文字放不下时在胶囊里折行而不是溢出 */
.weather-card { min-height: 122px; display: flex; align-items: stretch; overflow: hidden; border: 1px solid var(--k-line); border-radius: 12px; background: var(--k-paper); }
.weather-card__visual { position: relative; width: 50%; flex: 0 0 50%; min-height: 122px; overflow: hidden; }
.weather-card__image { position: absolute; left: 0; top: 0; width: 100%; height: 100%; }
.weather-card__info { position: absolute; inset: 12px 10px; }
.weather-card__info .k-row { flex-wrap: wrap; align-items: baseline; gap: 2px 10px; }
/* 10-16 改版全站系统黑体：大字城市名和统计数字不再用 Georgia 衬线 */
.weather-card__degree { font-size: 34px; font-weight: 700; line-height: 1; }
.weather-card__weather { font-size: 14px; font-weight: 700; }
.weather-card__meta { display: block; margin-top: 8px; font-size: 12px; }
.weather-card__copy { flex: 1; min-width: 0; padding: 12px 10px 12px 12px; display: flex; flex-direction: column; align-items: flex-start; }
.weather-card__week { display: block; font-size: 12px; font-weight: 700; }
.weather-card__slogan { display: block; margin-top: 5px; font-size: 16px; line-height: 1.4; white-space: pre-line; }
.weather-card__score { max-width: 100%; box-sizing: border-box; min-height: 24px; margin-top: 8px; padding: 4px 9px 4px 7px; border-radius: 12px; background: var(--k-green); color: #fff; display: inline-flex; align-items: center; gap: 4px; font-size: 11px; line-height: 1.3; }
.weather-card__score > text { min-width: 0; word-break: break-all; }
/* 不能写 「> :first-child」 这种冒号前不带元素的选择器：微信小程序样式编译报错，整个小程序上传失败（2026-10-11 遇到过） */
.stats { height: 64px; margin-top: 10px; display: flex; border: 1px solid var(--k-line); border-radius: 12px; background: var(--k-paper); }
.stat { position: relative; flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; }
.stat + .stat::before { content: ''; position: absolute; left: 0; height: 36px; width: 1px; background: var(--k-line); }
.stat__num { font-size: 22px; font-weight: 700; line-height: 1.1; }
.stat__label { margin-top: 4px; font-size: 11px; font-weight: 700; }
.city-section { margin-top: 12px; }
.city-section__head { height: 26px; display: flex; align-items: center; justify-content: space-between; font-size: 15px; font-weight: 700; }
.city-section__head .k-row { color: var(--k-muted); font-size: 11px; font-weight: 400; }
.city-banner { height: 74px; overflow: hidden; display: flex; align-items: stretch; border: 1px solid var(--k-line); border-radius: 11px; background: var(--k-paper); }
.city-banner__copy { flex: 1; padding: 11px 12px; }
.city-banner__title { display: block; font-size: 15px; font-weight: 700; }
.city-banner__sub { display: block; margin-top: 7px; color: var(--k-muted); font-size: 11px; }
.city-banner__image { width: 44%; height: 74px; }
.group-label { display: block; margin-top: 12px; font-size: 15px; font-weight: 700; }
.city-group { height: 58px; margin-top: 6px; padding: 0 12px; border: 1px solid var(--k-line); border-radius: 10px; background: var(--k-paper); display: flex; align-items: center; justify-content: space-between; }
.city-group__title { display: block; font-size: 14px; font-weight: 700; }
.city-group__sub { display: block; margin-top: 3px; color: var(--k-muted); font-size: 10px; }
.city-builders { margin-top: 22px; }
.city-builders__list { margin-top: 8px; border: 1px solid var(--k-line); border-radius: 10px; background: var(--k-paper); overflow: hidden; }
.city-builder { display: flex; align-items: center; gap: 10px; min-height: 50px; padding: 12px; }
.city-builder + .city-builder { border-top: 1px solid var(--k-line); }
.city-builder__name { flex: 1; min-width: 0; font-size: 14px; line-height: 1.5; overflow-wrap: anywhere; }
.bot-fab { position: fixed; z-index: 60; right: 24px; bottom: 96px; width: 60px; height: 60px; border-radius: 50%; border: 3px solid #91A1AE; background: var(--k-indigo); display: flex; align-items: center; justify-content: center; box-shadow: 0 5px 14px rgba(36,27,23,.18); }
.bot-fab image { width: 38px; height: 38px; border-radius: 50%; }
/* 右边留 30px 给固定在屏幕右侧的 A–Z 索引（宽 24px）：之前 320 / 375 宽时索引字母压在定位行、城市胶囊的右边上。
   搜索框在索引上方，用负外边距照旧铺满 */
.switch-body { position: relative; padding: 10px 30px calc(76px + var(--k-safe-bottom)) 16px; }
.city-search { margin-right: -14px; height: 42px; padding: 0 12px; border: 1px solid var(--k-line); border-radius: 22px; background: var(--k-paper); display: flex; align-items: center; gap: 9px; }
.city-search input { flex: 1; height: 40px; font-size: 14px; }
.switch-title { display: block; margin-top: 22px; font-size: 15px; font-weight: 700; }
.current-city { height: 52px; margin-top: 8px; padding: 0 14px; display: flex; align-items: center; gap: 10px; border: 1px solid var(--k-line); border-radius: 10px; background: var(--k-paper); }
.current-city__name { flex: 1; min-width: 0; font-size: 16px; font-weight: 700; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
/* 右边让给索引后，320 宽时「暂无法确认，请手动选择」16px 放不下一行，收到 15px */
@media (max-width: 340px) { .current-city__name { font-size: 15px; } }
/* 重新定位：小程序里 k-icon 上的 @click.stop 拦不住内部 image 的 bindtap，点定位图标会连带触发外层「选这个城市」；
   动作挂在图标自己的 @click 上，外层 view 只用 @click.stop 拦住冒泡。顺带把点击区域放大到 36px */
.relocate { width: 36px; height: 36px; margin-right: -8px; display: flex; align-items: center; justify-content: center; }
.switch-head { margin-top: 20px; display: flex; align-items: center; justify-content: space-between; font-size: 15px; font-weight: 700; }
.city-chips { display: grid; grid-template-columns: repeat(4,minmax(0,1fr)); gap: 8px; margin-top: 8px; }
.city-chips--five { grid-template-columns: repeat(5,minmax(0,1fr)); }
.city-chip { height: 30px; padding: 0 4px; border: 1px solid var(--k-line); border-radius: 10px; background: var(--k-paper); display: flex; align-items: center; justify-content: center; font-size: 14px; }
.city-chip > text { min-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.city-chip.on { position: relative; border-color: var(--k-red); background: var(--k-red-soft); color: var(--k-red-deep); font-weight: 700; }
.city-chip__on { position: absolute; right: -5px; top: -6px; width: 16px; height: 16px; border-radius: 50%; border: 1.5px solid var(--k-bg); background: var(--k-red); display: flex; align-items: center; justify-content: center; }
.hot-title { margin-top: 22px; }
.alpha-title { margin-top: 22px; }
.alpha-group__letter { display: block; height: 34px; padding-top: 10px; border-bottom: 1px solid var(--k-line); font-size: 14px; }
.alpha-group__city { display: flex; flex-direction: column; justify-content: center; min-height: 48px; padding: 8px; font-size: 14px; line-height: 1.5; }
.city-region { color: var(--k-muted); font-size: 12px; margin-top: 2px; }
.city-search-empty, .city-search-more { display: block; padding: 18px 8px; font-size: 14px; color: var(--k-muted); }
.city-search-more { color: var(--k-red); text-align: center; }
/* 每个字母的高度跟着屏幕高度走（2.5vh，812 高约 20px、640 高 16px、568 高约 14px）：22 个字母共 55vh，矮屏也全部露出来。
   之前固定 22px 一个，320x640 上只露出 A–S，后面几个要在索引里滑才看得到 */
.alphabet { position: fixed; right: 0; top: 26%; max-height: 60vh; overflow-y: auto; color: var(--k-muted); font-size: 11px; text-align: center; }
.alphabet > text { display: block; min-width: 24px; height: 2.5vh; padding: 0 2px; line-height: 2.5vh; }
.locate-failed { position: fixed; left: 0; right: 0; bottom: 0; z-index: 50; height: calc(58px + var(--k-safe-bottom)); padding: 0 18px var(--k-safe-bottom); border-top: 1px solid var(--k-line); background: var(--k-paper); display: flex; align-items: center; justify-content: space-between; color: var(--k-muted); font-size: 12px; }
.locate-failed__retry { color: var(--k-red); font-weight: 700; }
/* 底部给客服悬浮按钮让位：之前滑到底「联系客服」按钮被悬浮按钮压住 */
.empty-body { position: relative; min-height: calc(100vh - 88px); padding: 18px 18px calc(96px + var(--k-safe-bottom)); text-align: center; }
.empty-image { width: 126px; height: 126px; margin: 0 auto; }
.empty-title { display: block; margin-top: 4px; font-size: 20px; font-weight: 700; }
.empty-desc { display: block; margin-top: 8px; color: var(--k-muted); font-size: 13px; line-height: 1.7; white-space: pre-line; }
.conflict-card, .relax-card { margin-top: 14px; padding: 14px; border: 1px solid var(--k-line); border-radius: 11px; background: var(--k-paper); text-align: left; display: flex; flex-direction: column; gap: 10px; font-size: 13px; }
.conflict-card__title { font-size: 15px; font-weight: 700; }
.relax-card { gap: 0; }
.relax-row { min-height: 44px; display: flex; align-items: center; gap: 10px; }
.relax-row__label { flex: 1; font-size: 13px; }
.relax-row__value { color: var(--k-muted); font-size: 13px; }
.empty-actions { display: grid; grid-template-columns: .95fr 1.05fr; gap: 10px; margin-top: 20px; }
.subscribe, .contact { height: 64px; border: 1px solid var(--k-red); border-radius: 10px; color: var(--k-red); display: flex; flex-direction: column; align-items: center; justify-content: center; font-size: 11px; }
.contact { background: var(--k-red); color: #fff; }
.subscribe__title { display: block; font-size: 16px; font-weight: 700; }
.bot-fab--empty { right: 24px; bottom: calc(18px + var(--k-safe-bottom)); }
</style>
