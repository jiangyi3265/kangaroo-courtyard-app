<template>
  <!-- #ifdef MP-WEIXIN -->
  <page-meta :page-style="dateOpen || skillOpen || noticePopup.show ? 'overflow: hidden' : ''" />
  <!-- page-meta 必须是页面第一个节点。日历、技能弹框、公告弹窗开着时锁住页面滚动：弹框里的 scroll-view 不能用 catchtouchmove 拦（拦了它自己也滑不动），之前在那块拖动会带着后面的页面一起滚；只在小程序里加：H5 的 page-meta 关弹窗时清不掉这条样式，顶栏会从此不吸顶 -->
  <!-- #endif -->
  <view class="k-page home-page">
    <template v-if="s === 1 || !recruitmentEnabled">
      <!-- 品牌占导航左侧，城市独立成行，完整长城市名不与微信胶囊争空间。 -->
      <k-topbar>
        <template #left><view class="brand"><text class="brand__name">袋鼠全球青年</text><image class="brand__logo" src="/static/media/brand-kangaroo-lg.png" mode="aspectFit" /></view></template>
        <view class="home-header">
          <view class="location" hover-class="home-soft-press" aria-role="button" :aria-label="'切换城市，当前' + city" @click="openCity"><k-icon name="map-pin" :size="18" color="ink2" :stroke="1.7" /><text class="location__name">{{ city }}</text><k-icon name="chevron-down" :size="15" color="ink2" :stroke="1.8" /></view>
        </view>
      </k-topbar>
      <view class="home-content k-pad-tab">
        <!-- 普通关键词搜索，输入和右侧圆钮进入同一个搜索结果页。 -->
        <view v-if="recruitmentEnabled || stayBookingEnabled" class="search-box"><view class="search-box__field"><k-icon name="search" :size="22" color="red" :stroke="1.5" /><input v-model="searchKeyword" class="search-box__input" maxlength="80" :placeholder="recruitmentEnabled ? (stayBookingEnabled ? '搜索岗位、旅居' : '搜索岗位、城市、技能') : '搜索旅居'" placeholder-class="search-box__placeholder" confirm-type="search" aria-label="搜索" @confirm="searchHome" /></view><button class="k-circle search-box__go" hover-class="k-press-s" aria-label="搜索" @click="searchHome"><k-icon name="search" :size="19" color="white" :stroke="2" /></button></view>
        <!-- 圆形浅底与双色线稿；入口标题和图标均可点击。 -->
        <view v-if="entries.length" class="entry-grid" :style="{gridTemplateColumns: `repeat(${entries.length},minmax(0,1fr))`}">
          <view v-for="item in entries" :key="item.name" class="entry" hover-class="home-soft-press" aria-role="button" :aria-label="item.name" @click="openEntry(item)"><view class="entry__icon" :class="'entry__icon--' + item.illustration"><image class="entry__drawing" :src="homeEntryIcon(item.illustration)" mode="aspectFit" /></view><text class="entry__name">{{ item.name }}</text></view>
        </view>
        <view class="handbook-banner" role="button" hover-class="home-soft-press" @click="go('/pages/camp/handbook')"><view><text class="handbook-banner__eyebrow">出发前，先认识袋鼠</text><text class="handbook-banner__title">袋鼠使用手册</text><text class="handbook-banner__copy">报名 · 订房 · 安心出行</text></view><view class="handbook-banner__action"><k-icon name="book-open" :size="30" color="green" /><text>翻开看看 ›</text></view></view>
        <!-- 近期活动采用整行图文卡，长标题与时间、地点、费用分层；只有一场时保留紧凑的「全部活动」入口。没有活动时显示筹备提示。
             之前没活动时只剩一行标题；加载中 / 出错时整块不显示 -->
        <template v-if="!feedLoading && !feedError">
          <view class="section-head"><text class="section-head__title k-display">{{ otherCityActs ? '其他城市的近期活动' : '近期活动' }}</text><view class="section-head__more" hover-class="k-press" @click="go(R.activity)"><text>更多</text><k-icon name="chevron-right" :size="15" color="muted" /></view></view>
          <view v-if="activities.length" class="activity-list">
            <view v-for="item in activities" :key="item.activityId" class="feed-card activity-card" hover-class="k-press-s" aria-role="button" :aria-label="'查看活动：' + item.title" @click="openActivity(item)">
              <view class="activity-card__main">
                <view class="feed-card__media activity-card__media"><image class="feed-card__img" :src="item.image" mode="aspectFill" /><text class="feed-card__badge" :class="{ 'is-few': item.few, 'is-full': item.full }">{{ item.badge }}</text></view>
                <view class="activity-card__copy">
                  <text class="feed-card__title activity-card__title">{{ displayWording(item.title) }}</text>
                  <view v-if="item.date" class="activity-card__meta"><k-icon name="calendar-days" :size="13" color="muted" :stroke="1.6" /><text class="activity-card__date">{{ item.date }}</text></view>
                  <view v-if="item.place" class="activity-card__meta"><k-icon name="map-pin" :size="13" color="muted" :stroke="1.6" /><text class="activity-card__place">{{ item.place }}</text></view>
                  <text class="activity-card__price" :class="item.free ? 'k-green' : 'k-red'">{{ item.price }}</text>
                </view>
              </view>

            </view>
            <view v-if="activities.length === 1" class="act-more" hover-class="k-press-s" aria-role="button" aria-label="全部活动，看各城市活动" @click="go(R.activity)"><k-icon name="calendar-days" :size="18" color="red" :stroke="1.7" /><text class="act-more__title">全部活动</text><text class="act-more__hint">看各城市活动</text><k-icon name="chevron-right" :size="15" color="muted" /></view>
          </view>
          <view v-else class="act-empty" hover-class="k-press-s" @click="go(R.activity)"><view class="k-flex1"><text class="act-empty__title">近期活动筹备中</text><text class="act-empty__copy">订阅城市活动，有新活动提醒你</text></view><view class="act-icon"><k-icon name="calendar-days" :size="26" color="red" :stroke="1.5" /></view></view>
        </template>
        <!-- 按后台门店运营类型分组，不按店名或安心认证推断自营。每组先露一行，独立展开。 -->
        <template v-if="stayBookingEnabled"><view class="section-head"><text class="section-head__title k-display">旅居推荐</text></view>
        <view v-if="feedLoading" class="feed-state"><text>正在加载推荐…</text></view>
        <view v-else-if="feedError" class="feed-state"><text>{{ feedError }}</text><k-button type="secondary" size="sm" @click="loadFeed">重新加载</k-button></view>
        <view v-else-if="recStays.length" class="stay-groups">
          <view v-for="group in stayGroups" :key="group.key" class="stay-group" :class="'stay-group--' + group.key">
            <view class="stay-group__head">
              <view class="stay-group__heading"><text class="stay-group__title">{{ group.title }}</text><text class="stay-group__count">{{ group.total }}家</text></view>
              <view v-if="group.total > 2" class="section-head__more" hover-class="k-press" aria-role="button" :aria-label="(group.expanded ? '收起' : '展开') + group.title" @click="openRecommendations(group.key)"><text>{{ group.expanded ? '收起' : '展开' }}</text><k-icon :name="group.expanded ? 'chevron-up' : 'chevron-down'" :size="15" color="muted" /></view>
            </view>
            <view class="card-grid stay-grid">
              <view v-for="stay in group.stays" :key="stay.stayId" class="stay-tile" hover-class="k-press-s" aria-role="button" :aria-label="'查看' + group.title + '：' + stay.stayName" @click="openStay(stay)">
                <view class="feed-card feed-card--stay">
                  <view class="stay-cover">
                    <image v-if="stay.cover && failedStayImages[stay.stayId] !== stay.image" class="stay-cover__image" :src="stay.image" mode="aspectFill" @error="markStayCoverFailed(stay)" />
                    <view v-else class="stay-cover__empty"><k-icon name="house" :size="28" color="muted" :stroke="1.3" /><text>小院照片待更新</text></view>
                  </view>
                  <text class="stay-source" :class="'stay-source--' + group.key">{{ group.title }}</text>
                  <view class="feed-card__body stay-copy"><text class="feed-card__title k-ellipsis">{{ stay.stayName }}</text><text class="feed-card__meta">{{ stay.sub }}</text></view>
                </view>
                <view v-if="stay.safe" class="safe-chip stay-trust"><k-icon name="shield-check" :size="14" color="green" /><text>安心商家</text></view>
              </view>
            </view>
          </view>
        </view>
        <view v-else class="feed-state"><text>暂无已上架的小院，稍后再来看看</text><k-button type="secondary" size="sm" @click="loadFeed">重新加载</k-button></view></template>
      </view>
      <k-tabbar active="home" />
    </template>

    <template v-else-if="s === 2">
      <k-topbar title="找机会" back custom-back @back="s = 1" />
      <view class="ai-body k-pad-safe">
        <!-- 头像换成首页品牌同一只袋鼠（144px 贴纸）：之前 49×50 的线稿放大到 56px 发糊 -->
        <view class="ai-avatar"><image class="ai-avatar__img" src="/static/media/brand-kangaroo-lg.png" mode="aspectFit" /></view>
        <text class="ai-title">你好，我是AI袋鼠！</text>
        <text class="ai-intro">写出来您的诉求或者想法，\n我会搜索全部信息尽可能帮您解决问题。</text>
        <!-- 小程序里 textarea 盖在页面最上层，日历 / 技能弹框 / 公告弹窗压在它上面时会点不动；不打字时先显示成普通文字，点了再换成真输入框 -->
        <view class="idea-box"><textarea v-if="editingIdea" v-model="idea" class="idea-box__input" :maxlength="200" :auto-height="false" placeholder="例如：丽江换工单间一个月或青岛兼职全职工作或想在阳朔住一周，预算500，还能抽空做点兼职" placeholder-class="k-placeholder" :focus="true" auto-focus @blur="idea = $event.detail.value; editingIdea = false" /><view v-else class="idea-box__input home-area-idle" @click="editingIdea = true"><text :class="{ 'k-placeholder': !idea }">{{ idea || '例如：丽江换工单间一个月或青岛兼职全职工作或想在阳朔住一周，预算500，还能抽空做点兼职' }}</text></view><text class="idea-box__count">{{ idea.length }}/200</text></view>
        <!-- 热门问法：新手不知道怎么问，点一下填进输入框并直接匹配。只用匹配规则认得的字眼（城市名、换宿 / 换工、天数、预算数字、拍照），点了一定按这些条件出结果 -->
        <view class="hot-words"><view v-for="w in hotWords" :key="w.text" class="hot-word" hover-class="k-press" @click="useHotWord(w)"><text>{{ w.text }}</text></view></view>
        <view class="preference-head"><view class="k-row k-gap6"><text class="preference-head__title">偏好设置</text><text class="preference-head__hint">（可选）</text></view><view class="preference-head__clear" hover-class="k-press" @click="clearPrefs">清空</view></view>
        <view class="pref-grid"><view v-for="item in preferences" :key="item.label" class="pref-card" hover-class="k-press-s" @click="editPref(item)"><k-icon :name="item.icon" :size="21" color="ink" :stroke="1.6" /><view class="pref-card__copy"><text class="pref-card__label">{{ item.label }}</text><text class="pref-card__value">{{ item.value }}</text></view></view></view>
        <k-button block icon="sparkles" class="match-button" @click="runMatch">开始匹配</k-button><text class="ai-note">按你填写的条件规则匹配，结果仅供参考</text><view class="k-home-indicator" />
      </view>
    </template>

    <template v-else-if="s === 3">
      <k-topbar title="综合结果" back custom-back @back="s = resultBack"><view class="result-tabs"><view class="result-tab" :class="{ active: rtab === 0 }" hover-class="k-press" @click="rtab = 0"><text>岗位 {{ tabCounts[0] }}</text></view><view v-if="stayBookingEnabled" class="result-tab" :class="{ active: rtab === 1 }" hover-class="k-press" @click="rtab = 1"><text>房源 {{ tabCounts[1] }}</text></view><view class="result-tab" :class="{ active: rtab === 2 }" hover-class="k-press" @click="rtab = 2"><text>活动 {{ tabCounts[2] }}</text></view></view></k-topbar>
      <view class="result-body k-pad-safe">
        <view class="result-sort"><text>综合匹配度从高到低排序</text><view class="k-row k-gap6" hover-class="k-press" @click="pickSort"><text>排序</text><k-icon name="list-filter" :size="17" color="ink" /></view></view>
        <view v-for="job in matchedJobs" :key="(job.jobId || job.stayId || job.activityId) + job.title" class="match-card" hover-class="k-press-s" @click="openResult(job)"><image class="match-card__image" :src="job.image" mode="aspectFill" /><view class="match-card__main"><k-job-urgency v-if="job.jobId" :job="job" /><text class="match-card__title">{{ displayWording(job.title) }}</text><view class="match-card__tag"><view v-if="job.safe" class="safe-chip"><k-icon name="shield-check" :size="12" color="green" :stroke="2" /><text>安心商家</text></view><text v-if="job.skill" class="match-card__skill">{{ job.skill }}</text></view><view class="match-card__price"><text class="k-price">{{ job.price }}</text><text> {{ job.unit }}</text></view><text class="match-card__date">{{ job.dateText }}</text><view class="match-card__line" /><text class="match-card__reason">原因：{{ displayWording(job.reason) }}</text></view><view class="match-card__score"><text class="match-card__percent">{{ job.score }}<text class="match-card__percent-sign">%</text></text><text>匹配度</text></view></view>
        <text class="result-end">{{ endText }}</text><view class="k-home-indicator" />
      </view>
    </template>

    <template v-else>
      <k-topbar title="推荐理由" back custom-back @back="s = 3" />
      <view class="reason-body k-pad-safe">
        <view class="score-card"><view class="score-ring"><text class="score-ring__num">{{ result.overall }}<text class="score-ring__sign">%</text></text><text class="score-ring__label">匹配度</text></view><text class="score-card__text">基于你的需求和偏好，\n我们为你推荐了最合适的\n{{ stayBookingEnabled ? '工作、房源和活动组合。' : '工作和活动组合。' }}</text></view>
        <text class="reason-title">匹配依据</text>
        <view class="reason-list"><view v-for="item in reasons" :key="item.label" class="reason-row"><view class="reason-row__icon"><k-icon :name="item.icon" :size="20" color="ink" :stroke="1.6" /></view><text class="reason-row__label">{{ item.label }}</text><text class="reason-row__desc">{{ item.desc }}</text><text class="reason-row__score">{{ item.score }}%</text></view></view>
        <view class="preference-head reason-pref-head"><view class="k-row k-gap6"><text class="preference-head__title">偏好设置</text><text class="preference-head__hint">（可编辑）</text></view><view class="k-row" hover-class="k-press" @click="s = 2"><text class="preference-head__clear">编辑</text><k-icon name="chevron-right" :size="14" color="muted" /></view></view>
        <view class="reason-prefs"><view v-for="item in preferences" :key="item.label" class="reason-pref"><text class="reason-pref__label">{{ item.label }}</text><text class="reason-pref__value">{{ item.value }}</text></view></view>
        <k-button block icon="sparkles" class="rematch-button" @click="s = 2">按新条件重新匹配</k-button><text class="ai-note reason-note">调整偏好后，我们将为你重新匹配更优结果</text><view class="k-home-indicator" />
      </view>
    </template>
    <!-- 找机会的旅行时间段：之前是「从 10.12 开始…下一页…」一页页翻，现在直接用日历点选出发日期，选完再挑旅行几天 -->
    <k-date-picker v-if="dateOpen" title="选择出发日期" :value="pref.from" :min-date="todayCn()" :max-date="shiftDate(todayCn(), 59)" @cancel="dateOpen = false" @confirm="confirmFrom" />
    <!-- 技能标签：之前也是分页弹框一次只能选一个，现在一屏铺开、点一下选中 / 再点取消，最多 5 个 -->
    <!-- 弹框里没有 scroll-view，滑动直接拦在最外层：之前只拦了遮罩，在面板上拖动后面的页面会跟着滚 -->
    <view v-if="skillOpen" class="skill-pop" @touchmove.stop.prevent>
      <view class="skill-pop__mask" @click="skillOpen = false" />
      <view class="skill-pop__panel">
        <view class="skill-pop__head"><text class="skill-pop__title">选择技能标签</text><text class="skill-pop__hint">最多 5 个，已选 {{ skillDraft.length }}</text></view>
        <view class="skill-pop__chips"><text v-for="x in SKILLS" :key="x" class="skill-pop__chip" :class="{ on: skillDraft.includes(x) }" @click="toggleSkill(x)">{{ x }}</text></view>
        <view class="skill-pop__foot"><view class="skill-pop__btn"><k-button block type="secondary" label="清空" @click="skillDraft = []" /></view><view class="skill-pop__btn skill-pop__btn--main"><k-button block label="确定" @click="confirmSkills" /></view></view>
      </view>
    </view>
    <!-- 进小程序时的公告弹窗（后台「小程序公告」里选了弹窗的公告，本次启动最多弹一次） -->
    <k-notice-popup />
  </view>
</template>

<script setup>
import { publicShare, shareWithCover, timelineShare, showPublicShareMenu } from '@/common/public-share.js'
// ---------------------------------------------------------------------------
// 首页接入情况：
//   s=1 品牌与城市分行、关键词搜索条（输入后进入岗位 / 旅居搜索结果）、
//       5 个入口（旅居订房带着所选城市进列表；岗位入口 10-17 起不带，岗位列表默认全部城市）、近期活动（真实报名中的活动，固定两格）、旅居推荐（始终展示各地区已上架小院，不受所选城市影响）
//   s=2 找机会：自由描述 + 偏好（日期 / 人数 / 每天工时 / 技能）→ apiHomeMatch 规则打分（不是 AI）
//   s=3 结果：岗位 / 房源 / 活动三类，按匹配度排序；一条都没有时去城市页的"放宽条件"屏。从首页圆钮直接匹配的，返回回首页
//   s=4 匹配依据：城市 / 时间 / 技能 / 生活偏好 / 工时五个维度的得分与说明
// ---------------------------------------------------------------------------
import { stayBookingEnabled, recruitmentEnabled } from '@/common/features.js'
import { ref, computed, watch } from 'vue'
import { onShow, onShareAppMessage, onShareTimeline } from '@dcloudio/uni-app'
import { experience, ensureSession, loadPreferences, savePreferences, saveAllCities } from '@/common/experience.js'
import { locateCity } from '@/common/locate.js'
import { checkNoticePopup, noticePopup } from '@/common/notice.js'
import { useScreen, go, toast } from '@/common/screen.js'
import { apiHomeFeed, apiHomeMatch } from '@/common/api.js'
import { sheet, prompt, shiftDate, todayCn, errText, confirm } from '@/common/ui.js'
import { absUrl } from '@/common/upload.js'
import R from '@/common/routes.js'
import { displayWording } from '@/common/display-wording.js'
import { homeEntryIcon } from './entry-icons.js'

const searchKeyword = ref('')
const searchHome = () => go(R.search + '?keyword=' + encodeURIComponent(searchKeyword.value.trim()))
const s = useScreen(4, {
  onLoad: (q) => {
    // 城市页"放宽条件"重新匹配出了结果，带回来直接看结果屏
    if (q?.from !== 'relax') return
    try {
      const r = uni.getStorageSync('kangaroo:last-result')
      if (r && r.jobs) {
        result.value = r
        rtab.value = r.jobs.length ? 0 : (r.stays.length ? 1 : 2)
        s.value = 3
      }
    } catch (e) { /* 没有带回结果就停在首页 */ }
  }
})
// 四屏是同一个页面，之前切屏时滚动位置跟着带过去：320x640 上找机会要往下滚才点得到「开始匹配」，结果屏一打开就是滚过的，
// 匹配度最高的那张卡顶部压在顶栏下面。现在每次切屏都回到顶部（小程序和 H5 都适用）
watch(s, () => uni.pageScrollTo({ scrollTop: 0, duration: 0 }))
// 选了「全部城市」时兴趣城市列表还在（社区、订房要用），首页只看 allCities 这个开关
const selectedCity = computed(() => (!experience.allCities && experience.cities && experience.cities[0]) || '')
const city = computed(() => selectedCity.value || '全部城市')
// 城市胶囊进「切换城市」屏（city.vue s=2，有当前定位和最近访问）；from=home 让它选完直接返回首页，首页 onShow 重新读城市
const openCity = () => go(R.city + '?s=2&from=home')
const feed = ref({ activities: [], jobs: [], stays: [] })
const feedLoading = ref(true)
const feedError = ref('')
const expandedStays = ref({ direct: false, partner: false })
let feedRequest = 0
async function loadFeed() {
  const request = ++feedRequest, requestedCity = selectedCity.value
  feedLoading.value = true
  feedError.value = ''
  feed.value = { activities: [], jobs: [], stays: [] }
  expandedStays.value = { direct: false, partner: false }
  try {
    const data = (await apiHomeFeed(requestedCity)).data
    if (request === feedRequest && requestedCity === selectedCity.value) feed.value = data || feed.value
  } catch (e) {
    if (request === feedRequest) feedError.value = errText(e, '推荐加载失败，请重试')
  } finally {
    if (request === feedRequest) feedLoading.value = false
  }
}
// 之前进首页只恢复登录态、拉推荐；现在登录态恢复后再看一眼有没有要弹的公告（本次启动只弹一次，见 common/notice.js）
onShow(async () => { await ensureSession(); loadPreferences(); loadFeed(); checkNoticePopup(); autoLocateOnce() })
// 首次浏览先说明位置用途，经用户同意再请求位置权限；成功后才保存定位标记。
const LOCATED_KEY = 'kangaroo:located-once'
let lastLocateAttempt = 0
let locationPrompted = false
const neverChose = () => !experience.allCities && !experience.cities.length
async function autoLocateOnce() {
  if (!neverChose()) return
  if (Date.now() - lastLocateAttempt < 60000) return
  lastLocateAttempt = Date.now()
  // #ifdef MP-WEIXIN
  try {
    // 旧版失败前就写永久标记，开启GPS后也再不尝试。现在仅成功后记住城市。
    const settings = await new Promise(resolve => uni.getSetting({ success: resolve, fail: () => resolve({}) }))
    const permission = settings.authSetting?.['scope.userLocation']
    if (permission === false) return // 可在城市选择页自行重试，不反复请求。
    if (permission !== true) {
      if (locationPrompted) return
      locationPrompted = true
      if (!await confirm('查找附近的小院', '是否使用当前位置匹配所在城市？只用于附近推荐，不同意也可正常浏览并手动选城。')) return
    }
  } catch (e) { return }
  // #endif
  // #ifndef MP-WEIXIN
  return // 网页端定位由用户在城市选择页主动发起。
  // #endif
  const selectedBefore=JSON.stringify(experience.cities)
  locateCity({ onFailure: message => toast(message) }).then((r) => {
    if (!r || !neverChose() || selectedBefore!==JSON.stringify(experience.cities)) return
    savePreferences([r.name])
    saveAllCities(false)
    uni.setStorageSync(LOCATED_KEY, 1)
    toast(`已为你定位到${r.name}，可点城市切换`)
    loadFeed()
  })
}
const recStays = computed(() => (feed.value.stays || []).map(stay => ({
  ...stay, image: stay.cover ? absUrl(stay.cover) : '/static/media/cover-empty.png', sub: [stay.city, stay.intro].filter(Boolean).join(' · ')
})))
const failedStayImages = ref({})
const markStayCoverFailed = stay => { failedStayImages.value[stay.stayId] = stay.image }
const stayGroups = computed(() => [
  { key: 'direct', title: '袋鼠自营', rows: recStays.value.filter(stay => stay.opType === 'direct') },
  { key: 'partner', title: '合作商家', rows: recStays.value.filter(stay => stay.opType !== 'direct') }
].filter(group => group.rows.length).map(group => ({
  key: group.key, title: group.title, total: group.rows.length,
  expanded: expandedStays.value[group.key],
  stays: group.rows.slice(0, expandedStays.value[group.key] ? 12 : 2)
})))
const openStay = stay => go(R.stayDetail + '?stayId=' + stay.stayId)
const openRecommendations = key => { if (key === 'direct' || key === 'partner') expandedStays.value[key] = !expandedStays.value[key] }
// 名字和岗位列表的页签一致（换宿旅行 / 兼职旅行 / 全职旅行 / 线上任务），第 5 个是旅居订房。
// 暖棕与豆绿的双色入口插画；分类路由保持一致。
const entries = computed(() => [
  { name: '换宿旅行', icon: 'house', illustration: 'house', ink: 'red', route: R.jobsList + '?type=volunteer' },
  { name: '兼职旅行', icon: 'briefcase-business', illustration: 'backpack', ink: 'green', route: R.jobsList + '?type=parttime' },
  { name: '全职驻店', icon: 'store', illustration: 'store', ink: 'red', route: R.jobsList + '?type=fulltime' },
  { name: '线上任务', icon: 'laptop', illustration: 'cloud', ink: 'green', route: R.jobsList + '?type=online' },
  { name: '旅居订房', icon: 'bed-double', illustration: 'stay', ink: 'red', route: R.staysList, withCity: true }
].filter(item => item.route === R.staysList ? stayBookingEnabled.value : recruitmentEnabled.value))
// 只有旅居订房带着首页城市进列表（订房列表读 ?city=，首页写着大理点进去就是大理的小院）。
// 四个岗位入口 2026-10-17 起不带：首页城市多半是第一次打开时自动定位来的，带进去就成了岗位筛选里一个「已选城市」，
// 主人反馈「选择地址的时候默认我在的位置也加到里面了」。岗位列表默认全部城市，想看哪个城市在列表里自己选
const openEntry = (item) => go(item.route + (item.withCity && selectedCity.value ? (item.route.includes('?') ? '&' : '?') + 'city=' + encodeURIComponent(selectedCity.value) : ''))
const ACT_IMG = '/static/media/cover-empty.png'
// 首页只露两张大卡：「10月16日 周五 14:00」、「城市 · 集合地」、价格（免费绿、收费红）、名额状态签
const activities = computed(() => (feed.value.activities || []).slice(0, 2).map(a => ({
  activityId: a.activityId, title: a.title,
  date: ((a.dateText || '').replace('（', ' ').replace('）', '') + ' ' + (a.time || '').split('–')[0]).trim(),
  place: [a.city, a.place].filter(Boolean).join(' · '), price: a.priceText, free: !a.feeFen,
  badge: a.full ? '已满可候补' : (a.few ? '名额紧张' : '报名中'), few: a.few && !a.full, full: !!a.full,
  image: a.img ? absUrl(a.img) : ACT_IMG
})))
// 选了城市、露出来的活动却一场都不在这个城市（本城不够两场时后端补的是其他城市的）：标题写「其他城市的近期活动」；全部城市照旧
const otherCityActs = computed(() => {
  const list = (feed.value.activities || []).slice(0, 2), mine = [selectedCity.value, feed.value.city]
  return !!selectedCity.value && list.length > 0 && !list.some(a => a.city && mine.includes(a.city))
})
const openActivity = (a) => go(R.activity + '?id=' + a.activityId + '&channel=home')
const REC_IMG = '/static/media/cover-empty.png'
// ---------------- s=2 找机会 ----------------
const idea = ref('')
// 只有正在打字时才放真 textarea，平时显示成文字，免得它挡住压在上面的弹框按钮
const editingIdea = ref(false)
// 首页搜索条的输入区：进找机会，直接换成真输入框（带 focus），小程序里键盘跟着弹出来
const openFinder = () => { s.value = 2; editingIdea.value = true }
// 热门问法：首页选了城市时「X 换宿」排第一。带城市的按词里的城市匹配（不受首页所选城市影响），不带的按首页城市；
// 写了天数的顺手把旅行天数改成对应天数（出发日期不变），和词里说的一致
const hotWords = computed(() => [
  ...(selectedCity.value ? [{ text: selectedCity.value + ' 换宿', city: selectedCity.value }] : []),
  { text: '大理 换宿 一个月', city: '大理', days: 30 },
  { text: '丽江 换工 包住', city: '丽江' },
  { text: '会拍照 想找民宿换工' },
  { text: '住一周 预算500', days: 7 }
])
let hotPick = null
function useHotWord(w) {
  idea.value = w.text
  editingIdea.value = false
  hotPick = w
  if (w.days) pref.value.to = shiftDate(pref.value.from, w.days - 1)
  runMatch()
}
const pref = ref({ from: shiftDate(todayCn(), 3), to: shiftDate(todayCn(), 9), people: 1, hours: null, skills: [] })
const md = (ymd) => `${+ymd.slice(5, 7)}.${+ymd.slice(8, 10)}`
const preferences = computed(() => [
  { key: 'date', label: '旅行时间段', value: `${md(pref.value.from)}–${md(pref.value.to)}`, icon: 'calendar-days' },
  { key: 'people', label: '人数', value: `${pref.value.people} 人`, icon: 'user-round' },
  { key: 'hours', label: '工作时长偏好', value: pref.value.hours ? `每天 ${pref.value.hours} 小时内` : '不限', icon: 'clock-3' },
  { key: 'skills', label: '技能标签（可选）', value: pref.value.skills.length ? pref.value.skills.join(' / ') : '未选择', icon: 'tags' }
])
const SKILLS = ['咖啡制作', '拉花', '摄影', '视频剪辑', '门店服务', '收银接待', '社群运营', '活动策划', '内容创作', '手作', '烘焙', '教学讲解', '外语', '民宿管家']
async function editPref(item) {
  if (item.key === 'date') {
    dateOpen.value = true
  } else if (item.key === 'people') {
    const i = await sheet(['1 人', '2 人', '3 人', '4 人及以上'])
    if (i >= 0) pref.value.people = i + 1
  } else if (item.key === 'hours') {
    const opts = [null, 4, 6, 8]
    const i = await sheet(['不限', '每天 4 小时内', '每天 6 小时内', '每天 8 小时内'])
    if (i >= 0) pref.value.hours = opts[i]
  } else {
    skillDraft.value = [...pref.value.skills]
    skillOpen.value = true
  }
}
const dateOpen = ref(false)
async function confirmFrom(from) {
  dateOpen.value = false
  if (!from) return
  const lens = [3, 7, 14, 30, 60]
  const j = await sheet(lens.map(n => `旅行 ${n} 天`))
  if (j < 0) return
  pref.value.from = from
  pref.value.to = shiftDate(from, lens[j] - 1)
}
const skillOpen = ref(false)
const skillDraft = ref([])
function toggleSkill(x) {
  const i = skillDraft.value.indexOf(x)
  if (i >= 0) skillDraft.value.splice(i, 1)
  else if (skillDraft.value.length >= 5) toast('最多选 5 个')
  else skillDraft.value.push(x)
}
function confirmSkills() {
  pref.value.skills = [...skillDraft.value]
  skillOpen.value = false
}
const clearPrefs = () => {
  idea.value = ''
  pref.value = { from: shiftDate(todayCn(), 3), to: shiftDate(todayCn(), 9), people: 1, hours: null, skills: [] }
  toast('已清空')
}
const result = ref({ jobs: [], stays: [], activities: [], reasons: [], overall: 0 })
// 匹配中：首页圆钮变淡，连点只发一次
const matching = ref(false)
// 结果屏的返回落到哪一屏：从找机会点「开始匹配」的回找机会（2），首页圆钮直接匹配的回首页（1）
const resultBack = ref(2)
// 城市传空串 = 全国匹配（后端 KgHomeService.match：没选城市、文字里也没写城市时不再默认成大理）
async function runMatch(from) {
  if (matching.value) return
  matching.value = true
  try {
    const pickCity = hotPick && hotPick.text === idea.value && hotPick.city
    const payload = { text: idea.value, city: pickCity || (city.value === '全部城市' ? '' : city.value), from: pref.value.from, to: pref.value.to, people: pref.value.people, hours: pref.value.hours, skills: pref.value.skills }
    result.value = (await apiHomeMatch(payload)).data
    if (result.value.empty) {
      try { uni.setStorageSync('kangaroo:last-match', payload) } catch (e) { /* ignore */ }
      return go(R.city + '?s=4&from=match')
    }
    rtab.value = result.value.jobs.length ? 0 : (result.value.stays.length ? 1 : 2)
    resultBack.value = from === 1 ? 1 : 2
    s.value = 3
  } catch (e) {
    toast(errText(e, '匹配失败'))
  } finally {
    matching.value = false
  }
}
// 首页搜索条的圆钮：不进找机会，按当前城市（全部城市时全国）和找机会里现有的条件（没改过就是默认条件）直接出结果
const quickMatch = () => runMatch(1)

// ---------------- s=3 结果 ----------------
const rtab = ref(0)
watch(stayBookingEnabled, enabled => { if(!enabled && rtab.value===1) rtab.value=0 })
const TAB_NAMES = ['岗位', '房源', '活动']
const tabCounts = computed(() => [result.value.jobs.length, result.value.stays.length, result.value.activities.length])
const sortBy = ref('score')
const matchedJobs = computed(() => {
  const list = [result.value.jobs, result.value.stays, result.value.activities][rtab.value] || []
  const rows = list.map(x => ({ ...x, image: x.cover ? absUrl(x.cover) : REC_IMG, skill: (x.tags && x.tags[0]) || x.typeLabel || x.unit || '', safe: !!x.safe }))
  return sortBy.value === 'price' ? [...rows].sort((a, b) => Number(a.price) - Number(b.price)) : rows
})
async function pickSort() {
  const i = await sheet(['按匹配度', '按价格从低到高'])
  if (i >= 0) sortBy.value = i === 0 ? 'score' : 'price'
}
async function openResult(x) {
  const i = await sheet(['查看详情', '查看推荐理由'])
  if (i === 1) { s.value = 4; return }
  if (i !== 0) return
  if (x.jobId) go(R.jobDetail + '?jobId=' + x.jobId)
  else if (x.stayId) go(R.stayDetail + '?stayId=' + x.stayId)
  else if (x.activityId) go(R.activity + '?id=' + x.activityId + '&channel=home')
}
// 某一类一条都没有时，之前只显示「已显示全部…」，像是加载失败
const endText = computed(() => (matchedJobs.value.length ? `— 已显示全部${TAB_NAMES[rtab.value]} —` : `暂无匹配的${TAB_NAMES[rtab.value]}，看看其他分类`))
const reasons = computed(() => result.value.reasons || [])

const pageShareMessage = () => publicShare('/pages/home/index', {}, '袋鼠全球青年 · 一起旅行，一起生活')

onShareAppMessage((event) => shareWithCover(pageShareMessage(event)))
onShareTimeline(() => timelineShare(pageShareMessage()))
onShow(showPublicShareMenu)
</script>

<style scoped lang="scss">
.handbook-banner { display:flex; align-items:center; justify-content:space-between; gap:16px; padding:22px 20px; margin:16px 0 24px; background:#e4edda; color:#3a4931; border-radius:16px; }
.handbook-banner__eyebrow,.handbook-banner__title,.handbook-banner__copy { display:block; }.handbook-banner__eyebrow { font-size:11px; letter-spacing:1px; }.handbook-banner__title { font-size:22px; font-weight:700; margin:6px 0 8px; }.handbook-banner__copy { font-size:12px; }.handbook-banner__action { display:flex; flex-direction:column; align-items:center; gap:12px; flex-shrink:0; font-size:12px; }

/* 首页：品牌导航、城市、搜索与图文推荐，遵循系统安全区。 */
.home-page { --k-bg:#F8F8F6; --k-paper:#FFFEFC; color: var(--k-ink); font-family: var(--k-sans);background:#F8F8F6; }
.home-header { display: flex; align-items: center; padding: 6px 16px 10px; }
.brand { display: flex; align-items: center; gap: 8px; padding-left: 8px; min-width: 0; }
.brand__logo { width: 28px; height: 32px; flex: 0 0 auto; }
.brand__name { font-family: var(--k-brand); font-size: 24px; font-weight: 700; color: var(--k-ink); white-space: nowrap; letter-spacing: 0; }
.location { min-width: 0; max-width: 100%; min-height: 40px; padding: 0 14px; display: flex; align-items: center; gap: 7px; border-radius: 22px; background: #EEEEE9; border: 1px solid #DDDCD6; }
.location__name { display: block; min-width: 0; font-size: 15px; font-weight: 600; color: var(--k-ink); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.home-content { padding: 0 16px calc(100px + var(--k-safe-bottom)); background: var(--k-bg); }
.search-box { height: 56px; padding-right: 4px; display: flex; align-items: center; border: 1px solid #B69772; border-radius: 999px; background: var(--k-paper); box-shadow: 0 5px 13px rgba(83,60,34,.11); }
.search-box__field { flex: 1; min-width: 0; height: 56px; padding: 0 6px 0 17px; display: flex; align-items: center; gap: 9px; }
.search-box__input { flex: 1; min-width: 0; height: 48px; color: var(--k-ink); font-size: 16px; }
.search-box__placeholder { color: #75695F; font-size: 16px; font-weight: 500; }
.search-box__go { width: 46px; height: 46px; flex: 0 0 auto; margin: 0; padding: 0; background: linear-gradient(135deg,#BB895A,#9F6A3E); }
.search-box__go::after { border: 0; }
.entry-grid { display: grid; grid-template-columns: repeat(5,minmax(0,1fr)); gap: 8px; margin-top: 18px; }
.entry { min-width: 0; min-height: 82px; display: flex; flex-direction: column; align-items: center; gap: 7px; padding: 0; border-radius: 12px; }
.entry__icon { width: 60px; height: 60px; display: flex; align-items: center; justify-content: center; border-radius: 50%; background: #F0E4D3;box-shadow:inset 0 1px 4px rgba(255,255,255,.35); }
.entry__icon--backpack { background: #F1E7DD; }
.entry__icon--store { background: #E8EDE4; }
.entry__icon--cloud { background: #E5EDEA; }
.entry__icon--stay { background: #EEEEE5; }
.entry__drawing { display: block; width: 48px; height: 48px; }
.entry__name { font-size: 14px; font-weight: 500; line-height: 20px; color: var(--k-ink); white-space: nowrap; }
.home-soft-press { opacity: .75; }
/* #ifdef H5 */
@media (hover: hover) { .entry:hover { background: var(--k-paper2); } }
/* #endif */
.section-head { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin: 16px 0 12px; min-height: 36px; }
.section-head__title { font-family: var(--k-sans); font-size: 20px; font-weight: 700; line-height: 28px; letter-spacing: 0; }
.section-head__more { min-height: 44px; display: flex; align-items: center; gap: 2px; color: var(--k-muted); font-size: 14px; flex: 0 0 auto; }
.card-grid { display: grid; grid-template-columns: repeat(2,minmax(0,1fr)); gap: 12px; }
.feed-card { display: flex; flex-direction: column; min-width: 0; overflow: hidden; border-radius: 18px; background: var(--k-paper); box-shadow: 0 6px 14px rgba(58,50,43,.10),0 1px 2px rgba(58,50,43,.04); }
.feed-card__media { position: relative; display: block; width: 100%; height: 275rpx; border-radius: 18px 18px 0 0; overflow: hidden; background: var(--k-paper2); }
.feed-card__img { width: 100%; height: 100%; }
.feed-card__body { flex: 1; min-width: 0; padding: 10px 11px 12px; display: flex; flex-direction: column; }
.feed-card__badge { position: absolute; left: 8px; top: 8px; height: 24px; padding: 0 8px; border-radius: 8px; background: var(--k-green-soft); color: var(--k-green); font-size: 11px; font-weight: 600; line-height: 24px; }
.feed-card__badge.is-few { background: var(--k-alert); color: var(--k-paper); }
.feed-card__badge.is-full { background: var(--k-paper2); color: var(--k-red-deep); }
.feed-card__title { font-family: var(--k-sans); font-size: 16px; font-weight: 600; line-height: 24px; color: var(--k-ink); }
.feed-card__title.k-clamp2 { min-height: 48px; }
.feed-card__meta { margin-top: 4px; color: var(--k-muted); font-size: 13px; line-height: 20px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.feed-card__foot { display: flex; align-items: center; gap: 6px; }
.feed-card__price { margin-top: 4px; font-size: 13px; font-weight: 700; flex: 0 0 auto; }
.activity-list { display: flex; flex-direction: column; gap: 12px; }
.activity-card { box-shadow: var(--k-sh1); border-radius: var(--k-radius); }
.activity-card__main { display: flex; align-items: flex-start; gap: 12px; padding: 12px; }
.activity-card__media { width: 78px; height: 88px; flex: 0 0 78px; border-radius: 10px; }
.activity-card__media .feed-card__badge { top: 6px; left: 6px; padding: 0 6px; font-size: 10px; }
.activity-card__copy { flex: 1; min-width: 0; }
.activity-card__title { display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 2; overflow: hidden; overflow-wrap: anywhere; line-height: 21px; }
.activity-card__meta { display: flex; align-items: center; gap: 5px; min-width: 0; margin-top: 3px; color: var(--k-muted); font-size: 12px; line-height: 18px; }
.activity-card__date { flex: 1; min-width: 0; overflow-wrap: anywhere; }
.activity-card__place { flex: 1; min-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.activity-card__footer { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin: 0 12px; padding: 10px 0 12px; border-top: 1px solid var(--k-line); }
.activity-card__price { flex: 1; min-width: 0; font-size: 15px; font-weight: 700; line-height: 21px; overflow-wrap: anywhere; }
.activity-card__detail { display: flex; align-items: center; gap: 2px; flex: 0 0 auto; color: var(--k-red); font-size: 12px; line-height: 20px; }
@media (max-width: 360px) { .activity-card__media { width: 70px; height: 84px; flex-basis: 70px; } }
.act-icon { width: 52px; height: 52px; flex: 0 0 auto; display: flex; align-items: center; justify-content: center; border-radius: 50%; background: #FFFEFC; border: 1px solid #F1EEE8;box-shadow:0 1px 4px rgba(65,52,38,.05); }
.act-more { display: flex; align-items: center; gap: 8px; min-height: 48px; padding: 0 12px; border-radius: 12px; background: var(--k-paper); }
.act-more__title { font-size: 14px; font-weight: 600; }
.act-more__hint { flex: 1; min-width: 0; text-align: right; color: var(--k-muted); font-size: 12px; }
.act-empty { min-height: 102px; padding: 20px 17px; display: flex; align-items: center; gap: 12px; border-radius: 19px; background: var(--k-paper); box-shadow: 0 6px 15px rgba(58,50,43,.085); }
.act-empty__title { display: block; font-family: var(--k-sans); font-size: 18px; font-weight: 650; line-height: 27px; }
.act-empty__copy { display: block; margin-top: 7px; color: var(--k-ink2); font-size: 14px; line-height: 1.6; }
.act-empty + .section-head { margin-top: 26px; }
.stay-grid { align-items: start; row-gap: 20px; }
.stay-group + .stay-group { margin-top: 24px; padding-top: 18px; border-top: 1px solid var(--k-line); }
.stay-group__head { display: flex; justify-content: space-between; align-items: center; gap: 8px; min-height: 44px; margin-bottom: 8px; }
.stay-group__heading { display: flex; align-items: baseline; gap: 8px; min-width: 0; }
.stay-group__title { font-size: 17px; line-height: 25px; font-weight: 600; color: var(--k-ink); }
.stay-group__count { font-size: 12px; line-height: 18px; color: var(--k-muted); }
.stay-source { position: absolute; top: 9px; left: 9px; z-index: 1; padding: 3px 8px; border-radius: 6px; background: var(--k-paper); color: var(--k-ink2); font-size: 11px; font-weight: 600; line-height: 18px; }
.stay-source--direct { background: var(--k-red-soft); color: var(--k-red-deep); }
.stay-tile { min-width: 0; }
/* 照片铺满卡片；上方留出 4:3 画面，渐变文字层下方露出 6px 照片边。 */
.feed-card--stay { position: relative; padding-top: 75%; padding-bottom: 6px; border-radius: var(--k-radius); box-shadow: 0 2px 3px rgba(58,50,43,.035), 0 7px 16px rgba(58,50,43,.065); }
.stay-cover { position: absolute; inset: 0; width: 100%; height: 100%; overflow: hidden; background: var(--k-paper2); }
.stay-cover__image { position: absolute; inset: 0; display: block; width: 100%; height: 100%; }
.stay-cover__empty { position: absolute; inset: 0 0 74px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px; color: var(--k-muted); font-size: 12px; line-height: 18px; }
.feed-card--stay .stay-copy { position: relative; z-index: 1; flex: 0 0 auto; padding: 10px 12px 12px; border-radius: 0 0 12px 12px; background: linear-gradient(110deg, rgba(255,254,252,.90) 0%, rgba(255,254,252,.88) 20%, rgba(255,254,252,.82) 45%, rgba(255,254,252,.72) 75%, rgba(255,254,252,.62) 100%); }
.feed-card--stay .feed-card__title { line-height: 22px; }
.feed-card--stay .feed-card__meta { margin-top: 5px; line-height: 19px; color: var(--k-ink2); }
.stay-trust { margin: 8px 0 0 8px; box-shadow: none; }
.safe-chip { align-self: flex-start; height: 24px; padding: 0 8px; border-radius: 8px; background: var(--k-green-soft); color: var(--k-green); display: inline-flex; align-items: center; gap: 3px; font-size: 11px; font-weight: 500; white-space: nowrap; flex: 0 0 auto; }
.feed-state { padding: 28px 12px; display: flex; flex-direction: column; align-items: center; gap: 12px; color: var(--k-muted); font-size: 14px; text-align: center; }
@media (max-width: 360px) {
  .brand { gap: 5px; }
  .brand__name { font-size: 20px; }
  .brand__logo { width: 24px; height: 28px; }
  .entry-grid { gap: 4px; }
  .entry__icon { width: 50px; height: 50px; }
  .entry__drawing { width: 42px; height: 42px; }
  .entry__name { font-size: 13px; }
  .search-box__field { padding-left: 12px; gap: 7px; }
  .search-box__placeholder { font-size: 14px; letter-spacing: -.3px; }
  .search-box__go { width: 44px; height: 44px; }
  .feed-card__body { padding: 10px; }
  .feed-card__title { font-size: 15px; }
  .feed-card--stay .stay-copy { padding: 10px; }
  .act-empty { padding: 18px 14px; gap: 10px; }
  .act-icon { width: 44px; height: 44px; }
}
.ai-body { position: relative; min-height: calc(100vh - 88px); padding: 28px 18px 42px; }
/* 贴纸右边和底边是平切的：贴着圆的右下放，切口让圆框裁掉 */
.ai-avatar { position: relative; width: 56px; height: 56px; border-radius: 50%; overflow: hidden; background: var(--k-paper2); box-shadow: var(--k-sh1); }
.ai-avatar__img { position: absolute; left: 7px; top: 6px; width: 49px; height: 53px; }
.ai-title { display: block; margin-top: 14px; font-size: 22px; font-weight: 600; }
.ai-intro { display: block; margin-top: 10px; color: var(--k-ink2); font-size: 14px; line-height: 1.7; white-space: pre-line; }
.idea-box { position: relative; margin-top: 26px; height: 128px; border: 1px solid var(--k-line2); border-radius: var(--k-radius); background: var(--k-paper); padding: 14px; }
/* 新例句占 3 行：框 110→128、输入区 72→80（3 行 × 25.6px），第 3 行不被裁、也不碰右下角「0/200」 */
.idea-box__input { width: 100%; height: 80px; font-size: 16px; line-height: 1.6; }
/* 不打字时的占位文字：和输入框一样大，长文字换行、超出的藏起来 */
.home-area-idle { overflow: hidden; white-space: pre-wrap; word-break: break-all; }
.idea-box__count { position: absolute; right: 14px; bottom: 10px; color: var(--k-muted); font-size: 12px; }
/* 热门问法：奶油色小胶囊，放不下就折行 */
.hot-words { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 12px; }
.hot-word { height: 30px; padding: 0 12px; border-radius: 15px; background: var(--k-paper2); color: var(--k-ink2); font-size: 13px; line-height: 30px; white-space: nowrap; }
.hot-words + .preference-head { margin-top: 24px; }
.preference-head { margin-top: 32px; display: flex; align-items: center; justify-content: space-between; }
.preference-head__title { font-size: 15px; font-weight: 700; }
.preference-head__hint, .preference-head__clear { color: var(--k-ink2); font-size: 12px; }
.pref-grid { display: grid; grid-template-columns: repeat(2,minmax(0,1fr)); gap: 10px; margin-top: 12px; }
.pref-card { height: 66px; padding: 0 11px; display: flex; align-items: center; gap: 9px; border-radius: var(--k-radius); background: var(--k-paper); box-shadow: var(--k-sh1); }
.pref-card__copy { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 4px; }
.pref-card__label { color: var(--k-muted); font-size: 12px; white-space: nowrap; }
.pref-card__value { font-size: 14px; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.match-button { margin-top: 34px; }
.skill-pop { position: fixed; inset: 0; z-index: 1000; }
.skill-pop__mask { position: absolute; inset: 0; background: rgba(36,27,23,.45); }
.skill-pop__panel { position: absolute; left: 0; right: 0; bottom: 0; max-width: 540px; margin: 0 auto; padding: 18px 16px calc(16px + var(--k-safe-bottom)); border-radius: 20px 20px 0 0; background: var(--k-paper); }
.skill-pop__head { display: flex; align-items: baseline; justify-content: space-between; }
.skill-pop__title { font-size: 18px; font-weight: 700; }
.skill-pop__hint { color: var(--k-muted); font-size: 13px; }
.skill-pop__chips { display: flex; flex-wrap: wrap; gap: 10px; margin: 16px 0 20px; }
.skill-pop__chip { padding: 8px 14px; border: 1px solid var(--k-line); border-radius: 18px; font-size: 14px; background: var(--k-bg); }
.skill-pop__chip.on { color: #fff; border-color: var(--k-red); background: var(--k-red); font-weight: 600; }
.skill-pop__foot { display: flex; gap: 12px; }
.skill-pop__btn { flex: 1; min-width: 0; }
.skill-pop__btn--main { flex: 2; }
.ai-note { display: block; margin-top: 16px; color: var(--k-ink2); text-align: center; font-size: 12px; }
.result-tabs { height: 48px; display: flex; border-bottom: 1px solid var(--k-line); }
.result-tab { position: relative; flex: 1; display: flex; align-items: center; justify-content: center; font-size: 15px; font-weight: 700; }
.result-tab.active { color: var(--k-red); }
.result-tab.active::after { content: ''; position: absolute; bottom: 0; left: 50%; width: 50px; height: 3px; border-radius: 2px; background: var(--k-red); transform: translateX(-50%); }
.result-body { position: relative; min-height: calc(100vh - 136px); padding: 14px 16px 36px; }
.result-sort { display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; color: var(--k-ink2); font-size: 12px; }
/* 结果卡、圆环卡、匹配依据和下面四格偏好：和首页一样是 16px 圆角白卡 + 轻阴影，不再描边（之前 12px 圆角 + 1px 边） */
.match-card { position: relative; min-height: 150px; margin-bottom: 12px; display: flex; overflow: hidden; border-radius: var(--k-radius); background: var(--k-paper); box-shadow: var(--k-sh1); }
.match-card__image { width: 92px; min-height: 150px; height: auto; flex: 0 0 auto; border-radius: var(--k-radius) 0 0 var(--k-radius); }
.match-card__main { flex: 1; min-width: 0; padding: 12px 10px; }
/* 长标题之前不截断，一直伸到右上角的匹配度数字下面 */
.match-card__title { display: block; margin-right: 56px; font-size: 15px; font-weight: 700; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
/* 标签行右边让出匹配度数字的位置（最宽是「100%」约 64px）：之前 320 宽「安心商家 / 咖啡制作」和「95%」叠在一起。
   放不下时技能折到下一行，再长就省略号 */
.match-card__tag { min-width: 0; margin: 5px 68px 0 0; display: flex; flex-wrap: wrap; align-items: center; gap: 4px 6px; }
.match-card__skill { min-width: 0; max-width: 100%; color: var(--k-muted); font-size: 11px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.match-card__price { margin-top: 7px; font-size: 12px; }
.match-card__date { display: block; margin-top: 5px; color: var(--k-muted); font-size: 11px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.match-card__line { height: 1px; margin: 8px 0 6px; background: var(--k-line); }
.match-card__reason { display: block; color: var(--k-muted); font-size: 11px; line-height: 1.5; white-space: pre-line; }
.match-card__score { position: absolute; right: 10px; top: 31px; display: flex; flex-direction: column; align-items: flex-end; color: var(--k-muted); font-size: 10px; }
/* 匹配度数字之前是 Georgia 衬线，10-16 改版全站系统黑体，改成黑体加粗（下面圆环里的、匹配依据的分数同样） */
.match-card__percent { color: var(--k-green); font-size: 30px; font-weight: 700; line-height: 1; }
.match-card__percent-sign { font-size: 16px; }
.result-end { display: block; margin: 18px 0 6px; color: var(--k-muted); text-align: center; font-size: 14px; }
.reason-body { position: relative; min-height: calc(100vh - 88px); padding: 10px 16px 34px; }
.score-card { min-height: 128px; padding: 14px; display: flex; align-items: center; gap: 12px; border-radius: var(--k-radius); background: var(--k-paper); box-shadow: var(--k-sh1); }
.score-ring { width: 92px; height: 92px; border-radius: 50%; border: 7px solid var(--k-green); box-shadow: inset 0 0 0 5px var(--k-paper), inset 0 0 0 6px var(--k-line); display: flex; flex-direction: column; align-items: center; justify-content: center; flex: 0 0 auto; }
.score-ring__num { color: var(--k-green); font-size: 32px; font-weight: 700; line-height: 1; }
.score-ring__sign { font-size: 17px; }
.score-ring__label { margin-top: 6px; font-size: 12px; }
/* 320 宽时右边只剩约 156px：14px 字一行 11 个刚好放下，三行不再折成五行；卡片改成最小高度，万一折行也不会溢出 */
.score-card__text { font-size: 14px; line-height: 1.7; white-space: pre-line; }
.reason-title { display: block; margin: 14px 0 8px; font-size: 16px; font-weight: 700; }
.reason-list { padding: 0 10px; border-radius: var(--k-radius); background: var(--k-paper); box-shadow: var(--k-sh1); }
.reason-row { min-height: 64px; display: flex; align-items: center; gap: 10px; border-bottom: 1px solid var(--k-line); }
.reason-row:last-child { border-bottom: 0; }
.reason-row__icon { width: 36px; height: 36px; border-radius: 50%; background: var(--k-green-soft); display: flex; align-items: center; justify-content: center; flex: 0 0 auto; }
/* 「生活偏好」4 个 14px 粗体字要 56px：之前宽 46px 被折成「生活偏 / 好」两行 */
.reason-row__label { width: 58px; font-size: 14px; font-weight: 700; white-space: nowrap; flex: 0 0 auto; }
.reason-row__desc { flex: 1; min-width: 0; color: var(--k-muted); font-size: 11px; line-height: 1.55; white-space: pre-line; }
.reason-row__score { color: var(--k-green); font-size: 17px; font-weight: 700; }
.reason-pref-head { margin-top: 14px; }
/* 四格偏好：小标题之前只有 9px（为了 320 宽一排塞下 4 格），现在 11px。375 宽及以上一排 4 格，按 375 宽量过「技能标签（可选）」放得下；
   更窄时改成两排两格，日期、技能也不会被截 */
.reason-prefs { display: grid; grid-template-columns: 1.6fr .7fr 1.4fr 1.75fr; gap: 4px; margin-top: 10px; }
.reason-pref { min-width: 0; min-height: 53px; padding: 8px 6px; border-radius: var(--k-radius); background: var(--k-paper); box-shadow: var(--k-sh1); }
.reason-pref__label { display: block; color: var(--k-muted); font-size: 11px; white-space: nowrap; }
@media (max-width: 374px) {
  .reason-prefs { grid-template-columns: repeat(2,minmax(0,1fr)); gap: 8px; }
  .reason-pref { padding: 8px 10px; }
}
.reason-pref__value { display: block; margin-top: 5px; font-size: 11px; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.rematch-button { margin-top: 16px; }
.reason-note { margin-top: 11px; }
</style>
