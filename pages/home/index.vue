<template>
  <!-- #ifdef MP-WEIXIN -->
  <page-meta :page-style="dateOpen || skillOpen || noticePopup.show ? 'overflow: hidden' : ''" />
  <!-- page-meta 必须是页面第一个节点。日历、技能弹框、公告弹窗开着时锁住页面滚动：弹框里的 scroll-view 不能用 catchtouchmove 拦（拦了它自己也滑不动），之前在那块拖动会带着后面的页面一起滚；只在小程序里加：H5 的 page-meta 关弹窗时清不掉这条样式，顶栏会从此不吸顶 -->
  <!-- #endif -->
  <view class="k-page home-page" :class="$userSurface">
    <template v-if="s === 1 || !recruitmentEnabled">
      <k-topbar :bg="atTop ? 'var(--k-top)' : ''">
        <!-- 小程序里具名插槽的内容外面会多包一层，两个并排的块要自己包进一个横排容器，否则城市会掉到第二行 -->
        <template #left><view class="home-nav"><view class="brand"><image class="brand__logo" src="/static/user-icons/travel-roo.svg" mode="aspectFit" /><text class="brand__name">袋鼠青年旅行</text></view><view class="location" hover-class="home-soft-press" aria-role="button" :aria-label="'切换城市，当前' + city" @click="openCity"><k-icon name="map-pin" :size="14" color="red" /><text class="location__name">{{ city }}</text><k-icon name="chevron-down" :size="12" color="muted" /></view></view></template>
      </k-topbar>
      <view class="home-content k-pad-tab">
        <view class="home-top">
        <!-- 普通关键词搜索，输入和右侧「搜索」钮进入同一个搜索结果页。 -->
        <view v-if="recruitmentEnabled || stayBookingEnabled" class="search-box"><view class="search-box__field"><k-icon name="search" :size="16" color="muted" /><input v-model="searchKeyword" class="search-box__input" maxlength="80" placeholder="想要什么问ai，智能检索出答案" placeholder-class="search-box__placeholder" confirm-type="search" aria-label="搜索" @confirm="searchHome" /></view><button class="search-box__go" hover-class="k-press-s" aria-label="搜索" @click="searchHome">搜索</button></view>
        <view class="handbook-cover">
          <button v-if="!handbookReady" class="handbook-cover__fallback" @click="openHandbook()">打开袋鼠使用手册</button>
          <handbook-carousel :active="homeVisible && !noticePopup.show" :reduce-motion="reduceMotion" @ready="handbookReady = true" @open="openHandbook" />
        </view>
        <view v-if="entries.length" class="entry-grid" :style="{gridTemplateColumns: `repeat(${entries.length},minmax(0,1fr))`}">
          <view v-for="item in entries" :key="item.name" class="entry" hover-class="home-soft-press" aria-role="button" :aria-label="item.name" @click="openEntry(item)"><view class="entry__icon"><k-icon :name="item.icon" :art="item.illustration" :size="28" color="red" /></view><text class="entry__name">{{ item.name }}</text></view>
        </view>
        </view>
        <template v-if="!feedLoading && !feedError">
          <view class="section-head">
            <text class="section-head__title k-display">{{ otherCityActs ? '其他城市的近期活动' : '近期活动' }}</text>
            <view class="section-head__more" hover-class="k-press" aria-role="button" aria-label="全部活动，看各城市活动" @click="go(R.activity)"><text>{{ activities.length === 1 ? '全部活动' : '更多' }}</text><k-icon name="chevron-right" :size="12" color="muted" /></view>
          </view>
          <view v-if="activities.length" class="activity-list">
            <swiper class="activity-swiper" :current="activitySlideIndex" :next-margin="activities.length > 1 ? '160rpx' : '0px'"
              :circular="activities.length > 1" :autoplay="activities.length > 1 && homeVisible && !reduceMotion && !noticePopup.show"
              :interval="5000" :duration="reduceMotion ? 0 : 360" @change="activitySlideIndex = $event.detail.current">
              <swiper-item v-for="(item, index) in activitySlides" :key="index">
                <view class="activity-slide" :class="{ 'activity-slide--peek': activities.length > 1 }">
                  <view class="feed-card activity-card" hover-class="k-press-s" aria-role="button" :aria-hidden="index !== activitySlideIndex" :aria-label="[displayWording(item.title), item.date, item.place, item.badge, item.price].filter(Boolean).join('，')" @click="openActivity(item)">
                    <view class="feed-card__media activity-card__media">
                      <image v-if="item.hasCover" class="feed-card__img" :src="item.image" mode="aspectFill" @error="failedActivityImages[item.activityId] = item.image" />
                      <view v-else class="activity-card__blank" aria-hidden="true">
                        <template v-if="item.day"><text class="activity-card__month">{{ item.month }}</text><text class="activity-card__day">{{ item.day }}</text></template>
                        <k-icon v-else name="map" :size="30" color="red" />
                      </view>
                    </view>
                    <view class="activity-card__copy">
                      <text class="feed-card__title activity-card__title k-clamp2">{{ displayWording(item.title) }}</text>
                      <view v-if="item.when || item.place" class="activity-card__details">
                        <view v-if="item.when" class="activity-card__meta activity-card__date"><k-icon name="calendar-days" :size="12" color="muted" /><text>{{ item.when }}</text></view>
                        <view v-if="item.place" class="activity-card__meta activity-card__place"><k-icon name="map-pin" :size="12" color="muted" /><text>{{ item.place }}</text></view>
                      </view>
                    </view>
                    <view class="activity-card__foot">
                      <text class="feed-card__badge" :class="{ 'is-few': item.few, 'is-full': item.full }">{{ item.badge }}</text>
                      <text class="activity-card__price" :class="item.free ? 'k-green' : 'k-red'">{{ item.price }}</text>
                    </view>
                  </view>
                </view>
              </swiper-item>
            </swiper>
            <view v-if="activities.length > 1" class="activity-pages">
              <button v-for="(item, index) in activities" :key="item.activityId" class="activity-page" :class="{ 'is-current': activityPage === index }"
                :aria-label="'第' + (index + 1) + '场，' + displayWording(item.title)" :aria-current="activityPage === index" @click="selectActivityPage(index)"><view class="activity-page__mark" /></button>
            </view>
          </view>
          <view v-else class="act-empty" hover-class="k-press-s" @click="go(R.activity)"><view class="act-icon"><k-icon name="calendar-days" :size="22" color="red" /></view><view class="k-flex1"><text class="act-empty__title">近期活动筹备中</text><text class="act-empty__copy">订阅城市活动，有新活动提醒你</text></view><k-icon name="chevron-right" :size="12" color="muted" /></view>
        </template>
        <!-- 按后台门店运营类型分组，不按店名或安心认证推断自营。每组先露一行，独立展开。 -->
        <template v-if="stayBookingEnabled"><view class="section-head"><text class="section-head__title k-display">旅居推荐</text></view>
        <view v-if="feedLoading" class="feed-state feed-state--loading"><text>正在加载推荐…</text></view>
        <view v-else-if="feedError" class="feed-state"><view class="state-icon"><k-icon name="wifi-off" :size="32" color="red" /></view><text>{{ feedError }}</text><k-button type="secondary" size="sm" @click="loadFeed">重新加载</k-button></view>
        <view v-else-if="recStays.length" class="stay-groups">
          <view v-for="group in stayGroups" :key="group.key" class="stay-group" :class="'stay-group--' + group.key">
            <view class="stay-group__head">
              <view class="stay-group__heading"><text class="stay-group__title">{{ group.title }}</text><text class="stay-group__count">{{ group.total }}家</text></view>
              <view v-if="group.total > 2" class="section-head__more" hover-class="k-press" aria-role="button" :aria-label="(group.expanded ? '收起' : '展开') + group.title" @click="openRecommendations(group.key)"><text>{{ group.expanded ? '收起' : '展开' }}</text><k-icon :name="group.expanded ? 'chevron-up' : 'chevron-down'" :size="12" color="muted" /></view>
            </view>
            <view class="card-grid stay-grid" :class="{ 'stay-grid--one': group.stays.length === 1 }">
              <view v-for="stay in group.stays" :key="stay.stayId" class="stay-tile" hover-class="k-press-s" aria-role="button" :aria-label="'查看' + group.title + '：' + stay.stayName" @click="openStay(stay)">
                <view class="feed-card feed-card--stay">
                  <view class="stay-cover">
                    <image v-if="stay.cover && failedStayImages[stay.stayId] !== stay.image" class="stay-cover__image" :src="stay.image" :data-stay-id="stay.stayId" :data-cover="stay.image" mode="aspectFill" @error="markStayCoverFailed" />
                    <view v-else class="stay-cover__empty"><k-icon name="house" :size="32" color="red" /><text>小院照片待更新</text></view>
                  <text class="stay-source" :class="'stay-source--' + group.key">{{ group.title }}</text></view>
                  <view class="feed-card__body stay-copy"><text class="feed-card__title k-clamp2">{{ stay.stayName }}</text><text class="feed-card__meta">{{ stay.sub }}</text></view>
                </view>
                <view v-if="stay.safe" class="stay-tags"><view class="safe-chip"><k-icon name="shield-check" :size="12" color="green" /><text>安心商家</text></view></view>
              </view>
            </view>
          </view>
        </view>
        <view v-else class="feed-state feed-state--empty"><view class="state-icon"><k-icon name="house" :size="32" color="red" /></view><text>暂无已上架的小院，稍后再来看看</text><text class="state-sub">小院上新后会第一时间出现在这里</text><k-button type="secondary" size="sm" @click="loadFeed">重新加载</k-button></view></template>
      </view>
      <k-tabbar active="home" />
    </template>

    <template v-else-if="s === 2">
      <k-topbar title="找机会" back custom-back @back="s = 1" />
      <view class="ai-body k-pad-safe">
        <!-- 头像换成首页品牌同一只袋鼠（144px 贴纸）：之前 49×50 的线稿放大到 56px 发糊 -->
        <view class="ai-hello"><view class="ai-avatar"><image class="ai-avatar__img" src="/static/user-icons/mine-ai.png" mode="aspectFit" /></view><text class="ai-title">你好，我是AI袋鼠！</text></view>
        <text class="ai-intro">写出来您的诉求或者想法，\n我会搜索全部信息尽可能帮您解决问题。</text>
        <!-- 小程序里 textarea 盖在页面最上层，日历 / 技能弹框 / 公告弹窗压在它上面时会点不动；不打字时先显示成普通文字，点了再换成真输入框 -->
        <view class="idea-box"><textarea v-if="editingIdea" v-model="idea" class="idea-box__input" :maxlength="200" :auto-height="false" placeholder="例如：丽江换工单间一个月或青岛兼职全职工作或想在阳朔住一周，预算500，还能抽空做点兼职" placeholder-class="k-placeholder" :focus="true" auto-focus @blur="idea = $event.detail.value; editingIdea = false" /><view v-else class="idea-box__input home-area-idle" @click="editingIdea = true"><text :class="{ 'k-placeholder': !idea }">{{ idea || '例如：丽江换工单间一个月或青岛兼职全职工作或想在阳朔住一周，预算500，还能抽空做点兼职' }}</text></view><text class="idea-box__count">{{ idea.length }}/200</text></view>
        <!-- 热门问法：新手不知道怎么问，点一下填进输入框并直接匹配。只用匹配规则认得的字眼（城市名、换宿 / 换工、天数、预算数字、拍照），点了一定按这些条件出结果 -->
        <view class="hot-words"><view v-for="w in hotWords" :key="w.text" class="hot-word" hover-class="k-press" @click="useHotWord(w)"><text>{{ w.text }}</text></view></view>
        <view class="preference-head"><view class="k-row k-gap6"><text class="preference-head__title">偏好设置</text><text class="preference-head__hint">（可选）</text></view><view class="preference-head__clear" hover-class="k-press" @click="clearPrefs">清空</view></view>
        <view class="pref-grid"><view v-for="item in preferences" :key="item.label" class="pref-card" hover-class="k-press-s" @click="editPref(item)"><k-icon :name="item.icon" :size="18" color="red" /><text class="pref-card__label">{{ item.label }}</text><text class="pref-card__value" :class="{ 'is-unset': item.value === '不限' || item.value === '未选择' }">{{ item.value }}</text><k-icon name="chevron-right" :size="12" color="muted" /></view></view>
        <k-button block icon="sparkles" class="match-button" @click="runMatch">开始匹配</k-button><text class="ai-note">按你填写的条件规则匹配，结果仅供参考</text><view class="k-home-indicator" />
      </view>
    </template>

    <template v-else-if="s === 3">
      <k-topbar title="综合结果" back custom-back @back="s = resultBack"><view class="result-tabs"><view class="result-tab" :class="{ active: rtab === 0 }" hover-class="k-press" @click="rtab = 0"><text>岗位</text><text class="result-tab__n">{{ tabCounts[0] }}</text></view><view v-if="stayBookingEnabled" class="result-tab" :class="{ active: rtab === 1 }" hover-class="k-press" @click="rtab = 1"><text>房源</text><text class="result-tab__n">{{ tabCounts[1] }}</text></view><view class="result-tab" :class="{ active: rtab === 2 }" hover-class="k-press" @click="rtab = 2"><text>活动</text><text class="result-tab__n">{{ tabCounts[2] }}</text></view></view></k-topbar>
      <view class="result-body k-pad-safe">
        <view class="result-sort" :class="{ 'is-dim': !matchedJobs.length }"><text>综合匹配度从高到低排序</text><view class="k-row k-gap6" hover-class="k-press" @click="pickSort"><text>排序</text><k-icon name="list-filter" :size="14" :color="matchedJobs.length ? 'ink2' : 'muted'" /></view></view>
        <view v-for="job in matchedJobs" :key="(job.jobId || job.stayId || job.activityId) + job.title" class="match-card" hover-class="k-press-s" @click="openResult(job)"><view class="match-card__top"><image class="match-card__image" :src="job.image" mode="aspectFill" /><view class="match-card__main"><k-job-urgency v-if="job.jobId" :job="job" /><text class="match-card__title k-clamp2">{{ displayWording(job.title) }}</text><view class="match-card__tag"><view v-if="job.safe" class="safe-chip"><k-icon name="shield-check" :size="12" color="green" /><text>安心商家</text></view><text v-if="job.skill" class="match-card__skill">{{ job.skill }}</text></view><view class="match-card__row"><view class="match-card__price"><text class="k-price">{{ job.price }}</text><text> {{ job.unit }}</text></view><view class="match-card__score"><text class="match-card__percent">{{ job.score }}<text class="match-card__percent-sign">%</text></text><text>匹配度</text></view></view><text class="match-card__date">{{ job.dateText }}</text></view></view><view class="match-card__line" /><view class="match-card__reason"><k-icon name="lightbulb" :size="14" color="muted" /><text>原因：{{ displayWording(job.reason) }}</text></view></view>
        <view v-if="!matchedJobs.length" class="result-empty"><view class="state-icon"><k-icon name="search" :size="32" color="red" /></view><text class="result-end">{{ endText }}</text><text class="state-sub">换个城市、放宽日期或预算再试试</text><k-button type="secondary" size="sm" @click="s = 2">调整条件</k-button></view>
        <text v-else class="result-end is-end">{{ endText }}</text><view class="k-home-indicator" />
      </view>
    </template>

    <template v-else>
      <k-topbar title="推荐理由" back custom-back @back="s = 3" />
      <view class="reason-body k-pad-safe">
        <view class="score-card"><view class="preference-head reason-pref-head"><text class="preference-head__title">匹配依据</text></view><view class="score-card__top"><view class="score-ring" :style="{ background: 'conic-gradient(var(--k-red) ' + (Number(result.overall) || 0) * 3.6 + 'deg, var(--k-line) 0)' }"><text class="score-ring__num">{{ result.overall }}<text class="score-ring__sign">%</text></text><text class="score-ring__label">匹配度</text></view><text class="score-card__text">基于你的需求和偏好，\n我们为你推荐了最合适的\n{{ stayBookingEnabled ? '工作、房源和活动组合。' : '工作和活动组合。' }}</text></view>
        <view class="reason-list"><view v-for="item in reasons" :key="item.label" class="reason-row"><view class="reason-row__icon"><k-icon :name="item.icon" :size="18" color="red" /></view><view class="reason-row__copy"><text class="reason-row__label">{{ item.label }}</text><text class="reason-row__desc">{{ item.desc }}</text></view><text class="reason-row__score">{{ item.score }}%</text></view></view></view>
        <view class="reason-box"><view class="preference-head reason-pref-head"><view class="k-row k-gap6"><text class="preference-head__title">偏好设置</text><text class="preference-head__hint">（可编辑）</text></view><view class="k-row" hover-class="k-press" @click="s = 2"><text class="preference-head__clear">编辑</text><k-icon name="chevron-right" :size="12" color="muted" /></view></view>
        <view class="reason-prefs"><view v-for="item in preferences" :key="item.label" class="reason-pref"><view class="k-row k-gap4"><k-icon :name="item.icon" :size="14" color="muted" /><text class="reason-pref__label">{{ item.label }}</text></view><text class="reason-pref__value" :class="{ 'is-unset': item.value === '不限' || item.value === '未选择' }">{{ item.value }}</text></view></view></view>
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
import HandbookCarousel from '../camp/components/handbook-carousel.vue'
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
import { onShow, onHide, onShareAppMessage, onShareTimeline, onPageScroll } from '@dcloudio/uni-app'
import { experience, ensureSession, loadPreferences, savePreferences, saveAllCities } from '@/common/experience.js'
import { locateCity } from '@/common/locate.js'
import { checkNoticePopup, noticePopup } from '@/common/notice.js'
import { askOnVisit } from '@/common/visit-subscriptions.js'
import { useScreen, go, toast } from '@/common/screen.js'
import { apiHomeFeed, apiHomeMatch } from '@/common/api.js'
import { sheet, prompt, shiftDate, todayCn, errText, confirm } from '@/common/ui.js'
import { absUrl } from '@/common/upload.js'
import R from '@/common/routes.js'
import { displayWording } from '@/common/display-wording.js'

// 顶栏在顶部是暖色，往下翻换成页面底色，和内容区不留色差
const atTop = ref(true)
onPageScroll(e => { atTop.value = e.scrollTop < 200 })
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
const activitySlideIndex = ref(0)
const failedActivityImages = ref({})
const handbookReady = ref(false)
const openHandbook = chapter => go('/pages/camp/handbook' + (chapter ? '?chapter=' + encodeURIComponent(chapter) : ''))
const homeVisible = ref(false)
const reduceMotion = ref(false)
const expandedStays = ref({ direct: false, partner: false })
let feedRequest = 0
async function loadFeed() {
  const request = ++feedRequest, requestedCity = selectedCity.value
  feedLoading.value = true
  feedError.value = ''
  feed.value = { activities: [], jobs: [], stays: [] }
  activitySlideIndex.value = 0
  failedActivityImages.value = {}
  failedStayImages.value = {}
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
onShow(async () => {
  homeVisible.value = true
  // #ifdef H5
  reduceMotion.value = typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  // #endif
  await ensureSession()
  loadPreferences()
  loadFeed()
  checkNoticePopup()
  autoLocateOnce()
})
onHide(() => { homeVisible.value = false })
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
function markStayCoverFailed(event) {
  const { stayId, cover } = event.currentTarget.dataset
  if (stayId && cover) failedStayImages.value[stayId] = cover
}
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
// 每个业务入口使用对应的浅杏插画。
const entries = computed(() => [
  { name: '换工旅行', icon: 'house', illustration: 'entry-exchange', ink: 'red', route: R.jobsList + '?type=volunteer' },
  { name: '兼职旅行', icon: 'briefcase-business', illustration: 'entry-parttime', ink: 'green', route: R.jobsList + '?type=parttime' },
  { name: '全职驻店', icon: 'store', illustration: 'entry-staffed', ink: 'red', route: R.jobsList + '?type=fulltime' },
  { name: '线上任务', icon: 'laptop', illustration: 'entry-online', ink: 'green', route: R.jobsList + '?type=online' },
  { name: '旅居订房', icon: 'bed-double', illustration: 'entry-stay', ink: 'red', route: R.staysList, withCity: true }
].filter(item => item.route === R.staysList ? stayBookingEnabled.value : recruitmentEnabled.value))
// 只有旅居订房带着首页城市进列表（订房列表读 ?city=，首页写着大理点进去就是大理的小院）。
// 四个岗位入口 2026-10-17 起不带：首页城市多半是第一次打开时自动定位来的，带进去就成了岗位筛选里一个「已选城市」，
// 主人反馈「选择地址的时候默认我在的位置也加到里面了」。岗位列表默认全部城市，想看哪个城市在列表里自己选
const openEntry = (item) => {
  askOnVisit()
  go(item.route + (item.withCity && selectedCity.value ? (item.route.includes('?') ? '&' : '?') + 'city=' + encodeURIComponent(selectedCity.value) : ''))
}
const ACT_IMG = '/static/media/cover-empty.png'
// 首页展示最近两场，更多活动从标题右侧进入。
const activities = computed(() => (feed.value.activities || []).slice(0, 2).map(a => ({
  activityId: a.activityId, title: a.title,
  date: ((a.dateText || '').replace('（', ' ').replace('）', '') + ' ' + (a.time || '').split('–')[0]).trim(),
  place: [a.city, a.place].filter(Boolean).join(' · '), price: a.priceText, free: !a.feeFen,
  badge: a.full ? '已满可候补' : (a.few ? '名额紧张' : '报名中'), few: a.few && !a.full, full: !!a.full,
  image: a.img ? absUrl(a.img) : ACT_IMG
})))
const activitySlides = computed(() => {
  const slides = activities.value.map(item => {
    const hasCover = item.image !== ACT_IMG && failedActivityImages.value[item.activityId] !== item.image
    const stamp = hasCover ? null : /^(\d{1,2}月)(\d{1,2})日\s*(.*)$/.exec(item.date)
    return { ...item, hasCover, month: stamp?.[1], day: stamp?.[2], when: stamp ? stamp[3] : item.date }
  })
  // 两场时前后邻居相同，重复一组以衔接循环两端的封面。
  return slides.length === 2 ? slides.concat(slides) : slides
})
const activityPage = computed(() => activitySlideIndex.value % (activities.value.length || 1))
function selectActivityPage(index) {
  activitySlideIndex.value += index - activityPage.value
}
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
  ...(selectedCity.value ? [{ text: selectedCity.value + ' 换工', city: selectedCity.value }] : []),
  { text: '大理 换工 一个月', city: '大理', days: 30 },
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

const pageShareMessage = () => publicShare('/pages/home/index', {}, '袋鼠青年旅行 · 一起旅行，一起生活')

onShareAppMessage((event) => shareWithCover(pageShareMessage(event)))
onShareTimeline(() => timelineShare(pageShareMessage()))
onShow(showPublicShareMenu)
</script>

<style scoped lang="scss">
@use '../../styles/user-search' as user-search;
.home-page { --k-bg: var(--k-page); --k-top: var(--k-red-soft); color: var(--k-ink); font-family: var(--k-sans); background: var(--k-bg); }
.home-page :deep(.k-button.is-lg) { height: 44px; border-radius: 22px; font-size: 15px; box-shadow: none; }
.home-page :deep(.k-button.is-sm) { border-radius: 16px; }
.home-nav { display: flex; align-items: center; min-width: 0; flex: 1; }
.brand { display: flex; align-items: center; gap: 6px; padding-left: 8px; flex: 0 0 auto; }
.brand__logo { width: 24px; height: 24px; flex: 0 0 auto; }
.brand__name { font-family: var(--k-brand); font-size: 17px; font-weight: 700; color: var(--k-ink); white-space: nowrap; letter-spacing: .2px; }
.location { min-width: 0; flex: 0 1 auto; height: 44px; margin-left: 2px; padding: 0 8px; display: flex; align-items: center; gap: 4px; overflow: hidden; border: 8px solid transparent; border-radius: 22px; background: var(--k-paper) padding-box; }
.location__name { display: block; min-width: 0; font-size: 13px; color: var(--k-ink); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.home-content { padding-left: 16px; padding-right: 16px; background: linear-gradient(180deg,var(--k-top) 0,var(--k-bg) 280px) no-repeat, var(--k-bg); }
.home-top { padding-top: 4px; }
.handbook-cover { position: relative; height: 55vw; min-height: 184px; max-height: 350px; margin: 12px -16px 0; overflow: hidden; background: #efe2c9; }
.handbook-cover__fallback { position: absolute; inset: 0; display: flex; align-items: center; padding: 0 6%; color: #452e1e; background: #efe2c9; font-size: 18px; border-radius: 0; }
.handbook-cover__fallback::after { border: 0; }
.search-box { height: 40px; display: flex; align-items: center; border-radius: 20px; background: var(--k-paper); }
.search-box__field { flex: 1; min-width: 0; height: 40px; padding: 0 8px 0 14px; display: flex; align-items: center; gap: 8px; }
.search-box__input { flex: 1; min-width: 0; height: 40px; color: var(--k-ink); font-size: 14px; }
.search-box__placeholder { color: var(--k-muted); font-size: 14px; }
.search-box__go { position: relative; height: 40px; flex: 0 0 auto; margin: 0; padding: 0 16px; border-radius: 0 20px 20px 0; background: none; color: var(--k-red-deep); font-size: 14px; font-weight: 600; line-height: 40px; }
.search-box__go::before { content: ''; position: absolute; left: 0; top: 12px; width: 1px; height: 16px; background: var(--k-line2); transform: scaleX(.5); }
.search-box__go::after { border: 0; }
.entry-grid { display: grid; grid-template-columns: repeat(5,minmax(0,1fr)); margin-top: 12px; padding: 16px 4px; border-radius: 12px; background: var(--k-paper); }
.entry { min-width: 0; display: flex; flex-direction: column; align-items: center; gap: 6px; }
.entry__icon { width: 46px; height: 46px; display: flex; align-items: center; justify-content: center; border-radius: 12px; background: var(--k-red-soft); }
.entry__name { font-size: 12px; line-height: 16px; color: var(--k-ink2); white-space: nowrap; }
.home-soft-press { opacity: .75; }
.section-head { display: flex; align-items: center; justify-content: space-between; gap: 8px; height: 24px; margin: 24px 0 12px; }
.section-head__title { font-family: var(--k-sans); font-size: 16px; font-weight: 700; line-height: 24px; letter-spacing: 0; }
.section-head__more { height: 44px; margin: -11px 0; display: flex; align-items: center; gap: 2px; color: var(--k-muted); font-size: 12px; flex: 0 0 auto; }
.card-grid { display: grid; grid-template-columns: repeat(2,minmax(0,1fr)); gap: 8px; }
.feed-card { display: flex; flex-direction: column; min-width: 0; overflow: hidden; border-radius: 12px; background: var(--k-paper); }
.feed-card__media { position: relative; overflow: hidden; background: var(--k-red-soft); }
.feed-card__img { display: block; width: 100%; height: 100%; }
.feed-card__badge { display: inline-flex; align-items: center; gap: 4px; color: var(--k-green); font-size: 11px; line-height: 16px; white-space: nowrap; }
.feed-card__badge::before { content: ''; width: 4px; height: 4px; border-radius: 50%; background: currentColor; }
.feed-card__badge.is-few { color: var(--k-alert); }
.feed-card__badge.is-full { color: var(--k-muted); }
.feed-card__title { font-size: 15px; font-weight: 600; line-height: 21px; color: var(--k-ink); }
.feed-card__meta { margin-top: 2px; color: var(--k-muted); font-size: 12px; line-height: 17px; display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 2; overflow: hidden; }
.activity-list { --activity-height: 128px; }
.activity-swiper { width: 100%; height: var(--activity-height); border-radius: 12px; overflow: hidden; }
.activity-slide { height: 100%; box-sizing: border-box; }
.activity-slide--peek { padding-right: 8px; }
.activity-card { display: grid; grid-template-columns: 29% minmax(0, 1fr); grid-template-rows: minmax(0, 1fr) auto; gap: 5px 9px; height: 100%; box-sizing: border-box; padding: 8px 10px 7px 8px; }
.activity-card__media { min-width: 0; min-height: 0; border-radius: 8px; }
.activity-card__blank { height: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center; background: var(--k-red-soft); }
.activity-card__month { color: var(--k-red-deep); font-size: 11px; font-weight: 600; line-height: 16px; }
.activity-card__month::after { content: ''; display: block; width: 18px; height: 1px; margin: 4px auto 2px; background: var(--k-red-line); }
.activity-card__day { color: var(--k-ink); font-size: 31px; font-weight: 600; line-height: 36px; font-variant-numeric: tabular-nums; }
.activity-card__copy { min-width: 0; display: flex; flex-direction: column; justify-content: center; gap: 5px; }
.activity-card__title { flex: 0 0 auto; font-size: 14px; line-height: 19px; text-wrap: balance; }
.activity-card__details { display: flex; flex-direction: column; gap: 2px; }
.activity-card__meta { display: flex; align-items: center; gap: 4px; min-width: 0; color: var(--k-muted); font-size: 12px; line-height: 16px; }
.activity-card__meta text { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.activity-card__foot { grid-column: 1 / -1; display: flex; justify-content: space-between; align-items: center; gap: 8px; padding-top: 4px; border-top: 1px solid var(--k-line); }
.activity-card__price { min-width: 0; text-align: right; font-size: 13px; font-weight: 600; line-height: 17px; font-variant-numeric: tabular-nums; overflow-wrap: anywhere; }
.activity-pages { display: flex; align-items: center; justify-content: center; }
.activity-page { width: 25px; height: 24px; margin: 0; padding: 0; display: flex; align-items: center; justify-content: center; border: 0; background: transparent; }
.activity-page::after { border: 0; }
.activity-page__mark { width: 4px; height: 3px; border-radius: 2px; background: var(--k-red-line); }
.activity-page.is-current .activity-page__mark { width: 13px; background: var(--k-red); }
.activity-list + .section-head { margin-top: 14px; }
.act-icon { width: 40px; height: 40px; flex: 0 0 auto; display: flex; align-items: center; justify-content: center; border-radius: 12px; background: var(--k-red-soft); }
.act-empty { display: flex; align-items: center; gap: 12px; padding: 14px 12px; border-radius: 12px; background: var(--k-paper); }
.act-empty__title { display: block; font-size: 14px; font-weight: 600; line-height: 20px; }
.act-empty__copy { display: block; margin-top: 2px; color: var(--k-muted); font-size: 12px; line-height: 17px; }
.stay-group + .stay-group { margin-top: 20px; }
.stay-group__head { display: flex; justify-content: space-between; align-items: center; gap: 8px; height: 20px; margin-bottom: 10px; }
.stay-group__heading { display: flex; align-items: baseline; gap: 6px; min-width: 0; }
.stay-group__title { font-size: 14px; line-height: 20px; font-weight: 600; color: var(--k-ink2); }
.stay-group__count { font-size: 12px; color: var(--k-muted); font-variant-numeric: tabular-nums; }
.stay-tile { display: flex; flex-direction: column; min-width: 0; overflow: hidden; border-radius: 12px; background: var(--k-paper); }
.feed-card--stay { position: relative; border-radius: 0; background: transparent; }
.stay-cover { position: relative; width: 100%; padding-top: 75%; overflow: hidden; background: var(--k-red-soft); }
.stay-cover__image { position: absolute; left: 0; top: 0; display: block; width: 100%; height: 100%; }
.stay-cover__empty { position: absolute; left: 0; top: 0; right: 0; bottom: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px; color: var(--k-muted); font-size: 12px; line-height: 16px; }
.stay-tags { margin-top: auto; display: flex; flex-wrap: wrap; align-items: center; gap: 4px 6px; min-height: 18px; padding: 0 10px 10px; }
.stay-source { position: absolute; left: 8px; top: 8px; z-index: 1; height: 18px; padding: 0 6px; border-radius: 10px; background: rgba(58,50,43,.55); color: var(--k-paper); font-size: 11px; font-weight: 500; line-height: 18px; white-space: nowrap; }
.stay-copy { display: flex; flex-direction: column; min-width: 0; padding: 10px 10px 8px; }
.feed-card--stay .feed-card__title { font-size: 14px; line-height: 20px; }
.safe-chip { align-self: flex-start; height: 18px; padding: 0 6px; border-radius: 4px; background: var(--k-green-soft); color: var(--k-green); display: inline-flex; align-items: center; gap: 2px; font-size: 11px; font-weight: 500; white-space: nowrap; flex: 0 0 auto; }
.feed-state { display: flex; flex-direction: column; align-items: center; gap: 12px; padding: 24px 16px; border-radius: 12px; background: var(--k-paper); color: var(--k-ink); font-size: 14px; font-weight: 500; line-height: 1.6; text-align: center; }
.feed-state--loading { padding: 40px 16px; background: transparent; color: var(--k-muted); font-size: 12px; font-weight: 400; }
.state-icon { width: 56px; height: 56px; display: flex; align-items: center; justify-content: center; border-radius: 16px; background: var(--k-red-soft); }
.state-sub { margin-top: -8px; color: var(--k-muted); font-size: 12px; font-weight: 400; line-height: 1.6; }
/* 输入框加高而不整体上移：右边的「清空」要落在悬浮客服钮下面 */
.ai-body { position: relative; min-height: calc(100vh - 88px); padding: 24px 16px 40px; }
/* 贴纸右边和底边是平切的：贴着圆的右下放，切口让圆框裁掉 */
.ai-hello { display: flex; align-items: center; gap: 12px; }
.ai-avatar { position: relative; width: 44px; height: 44px; border-radius: 50%; overflow: hidden; flex: 0 0 auto; background: var(--k-red-soft); }
.ai-avatar__img { position: absolute; left: 5px; top: 5px; width: 39px; height: 42px; }
.ai-title { font-size: 20px; font-weight: 700; line-height: 28px; }
.ai-intro { display: block; margin-top: 12px; color: var(--k-ink2); font-size: 13px; line-height: 1.6; white-space: pre-line; }
.idea-box { position: relative; margin-top: 20px; height: 136px; padding: 12px 14px; border-radius: 12px; background: var(--k-paper); }
.idea-box__input { width: 100%; height: 88px; font-size: 14px; line-height: 1.6; }
.home-area-idle { overflow: hidden; white-space: pre-wrap; word-break: break-all; }
.idea-box__count { position: absolute; right: 14px; bottom: 10px; color: var(--k-muted); font-size: 11px; font-variant-numeric: tabular-nums; }
.hot-words { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 16px; }
.hot-word { height: 28px; padding: 0 12px; border-radius: 14px; background: var(--k-paper); color: var(--k-ink2); font-size: 12px; line-height: 28px; white-space: nowrap; }
.preference-head { margin-top: 24px; display: flex; align-items: center; justify-content: space-between; }
.preference-head__title { font-size: 16px; font-weight: 700; line-height: 22px; }
.preference-head__hint, .preference-head__clear { color: var(--k-ink2); font-size: 12px; }
.preference-head__hint { margin-left: -4px; color: var(--k-muted); }
.pref-grid { margin-top: 12px; padding: 0 12px; border-radius: 12px; background: var(--k-paper); }
.pref-card { position: relative; height: 48px; display: flex; align-items: center; gap: 10px; }
.pref-card + .pref-card::before { content: ''; position: absolute; left: 28px; right: 0; top: 0; height: 1px; background: var(--k-line); transform: scaleY(.5); }
.pref-card__label { flex: 0 0 auto; color: var(--k-ink2); font-size: 14px; }
.pref-card__value { flex: 1; min-width: 0; text-align: right; font-size: 14px; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-variant-numeric: tabular-nums; }
.pref-card__value.is-unset, .reason-pref__value.is-unset { color: var(--k-muted); font-weight: 400; }
.reason-prefs { display: grid; grid-template-columns: repeat(2,minmax(0,1fr)); gap: 8px; row-gap: 16px; margin-top: 4px; }
.reason-pref { display: flex; flex-direction: column; gap: 4px; min-width: 0; border-radius: 12px; background: var(--k-paper); }
.reason-pref__label { color: var(--k-muted); font-size: 11px; line-height: 16px; white-space: nowrap; }
.reason-pref__value { font-size: 14px; font-weight: 600; line-height: 20px; word-break: break-all; font-variant-numeric: tabular-nums; }
.match-button, .rematch-button { margin-top: 20px; }
.ai-note { display: block; margin-top: 8px; color: var(--k-muted); text-align: center; font-size: 11px; }
.skill-pop { position: fixed; left: 0; top: 0; right: 0; bottom: 0; z-index: 1000; }
.skill-pop__mask { position: absolute; left: 0; top: 0; right: 0; bottom: 0; background: rgba(36,27,23,.45); }
.skill-pop__panel { position: absolute; left: 0; right: 0; bottom: 0; max-width: 540px; margin: 0 auto; padding: 20px 16px calc(12px + var(--k-safe-bottom)); border-radius: 16px 16px 0 0; background: var(--k-paper); }
.skill-pop__head { display: flex; align-items: baseline; justify-content: space-between; }
.skill-pop__title { font-size: 16px; font-weight: 700; }
.skill-pop__hint { color: var(--k-muted); font-size: 12px; }
.skill-pop__chips { display: flex; flex-wrap: wrap; gap: 4px; margin: 12px -2px 16px; }
.skill-pop__chip { height: 36px; padding: 0 14px; border: 2px solid transparent; border-radius: 18px; color: var(--k-ink2); font-size: 13px; line-height: 32px; background: var(--k-paper2) padding-box; }
.skill-pop__chip.on { color: var(--k-red-deep); background: var(--k-red-soft) padding-box; box-shadow: inset 0 0 0 1px var(--k-red-line); font-weight: 500; }
.skill-pop__foot { display: flex; gap: 8px; }
.skill-pop__btn { flex: 1; min-width: 0; }
.skill-pop__btn--main { flex: 2; }
.result-tabs { position: relative; height: 44px; display: flex; gap: 24px; padding: 0 16px; }
.result-tabs::after, .match-card__line::after { content: ''; position: absolute; left: 0; right: 0; bottom: 0; height: 1px; background: var(--k-line); transform: scaleY(.5); }
.result-tab { position: relative; display: flex; align-items: center; gap: 2px; font-size: 14px; line-height: 20px; color: var(--k-muted); }
.result-tab__n { font-size: 12px; font-weight: 400; color: var(--k-muted); font-variant-numeric: tabular-nums; }
.result-tab.active .result-tab__n { color: var(--k-ink2); }
.result-tab.active { color: var(--k-ink); font-weight: 600; }
.result-tab.active::after { content: ''; position: absolute; bottom: 6px; left: 6px; width: 16px; height: 3px; border-radius: 2px; background: var(--k-red); }
.result-body { position: relative; min-height: calc(100vh - 136px); padding: 12px 16px 36px; }
.result-sort { display: flex; align-items: center; justify-content: space-between; height: 20px; margin-bottom: 10px; color: var(--k-ink2); font-size: 12px; }
.result-sort.is-dim text { color: var(--k-muted); }
.match-card { position: relative; margin-bottom: 8px; border-radius: 12px; background: var(--k-paper); }
.match-card__top, .match-card__row { display: flex; gap: 8px; }
.match-card__row { align-items: baseline; justify-content: space-between; margin-top: 6px; }
.match-card__image { width: 84px; height: 84px; margin: 12px 0 0 12px; flex: 0 0 auto; border-radius: 8px; background: var(--k-red-soft); }
.match-card__main { flex: 1; min-width: 0; padding: 12px 12px 0 4px; }
.match-card__main :deep(.job-urgency) { display: flex; width: fit-content; margin-bottom: 4px; padding: 0 6px; border-radius: 4px; font-size: 11px; font-weight: 500; line-height: 18px; }
.match-card__title { font-size: 15px; font-weight: 600; line-height: 21px; }
.match-card__tag { min-width: 0; margin: 6px 0 0; display: flex; flex-wrap: wrap; align-items: center; gap: 4px 6px; }
.match-card__skill { min-width: 0; max-width: 100%; height: 18px; color: var(--k-muted); font-size: 12px; line-height: 18px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.match-card__price { min-width: 0; color: var(--k-muted); font-size: 11px; }
.match-card__price .k-price { font-size: 17px; font-variant-numeric: tabular-nums; }
.match-card__date { display: block; margin-top: 2px; color: var(--k-muted); font-size: 11px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.match-card__line { position: relative; height: 12px; margin: 0 12px; }
.match-card__reason { display: flex; gap: 4px; padding: 8px 12px 12px; color: var(--k-ink2); font-size: 12px; line-height: 1.6; white-space: pre-line; }
.match-card__reason :deep(.k-icon) { flex: 0 0 auto; margin-top: 3px; }
.match-card__score { flex: 0 0 auto; display: flex; flex-direction: row-reverse; align-items: baseline; gap: 4px; color: var(--k-muted); font-size: 11px; }
.match-card__percent { color: var(--k-ink2); font-size: 15px; font-weight: 600; font-variant-numeric: tabular-nums; }
.match-card__percent-sign { color: var(--k-muted); font-size: 11px; font-weight: 400; }
.result-end { display: block; margin: 16px 0 6px; color: var(--k-muted); text-align: center; font-size: 14px; }
.result-empty { display: flex; flex-direction: column; align-items: center; gap: 12px; padding: 32px 16px; border-radius: 12px; background: var(--k-paper); }
.result-empty .result-end { margin: 0; color: var(--k-ink); font-weight: 500; line-height: 1.6; }
.result-end.is-end { font-size: 12px; }
.reason-body { position: relative; min-height: calc(100vh - 88px); padding: 12px 16px 34px; }
.score-card { padding: 0 16px 16px; border-radius: 12px; background: var(--k-paper); }
.score-card__top { display: flex; align-items: center; gap: 16px; }
.score-ring { position: relative; width: 84px; height: 84px; flex: 0 0 auto; border-radius: 50%; display: flex; flex-direction: column; align-items: center; justify-content: center; }
.score-ring::before { content: ''; position: absolute; left: 6px; top: 6px; right: 6px; bottom: 6px; border-radius: 50%; background: var(--k-paper); }
.score-ring__num, .score-ring__label { position: relative; }
.score-ring__num { font-size: 24px; font-weight: 700; line-height: 1; font-variant-numeric: tabular-nums; }
.score-ring__sign { font-size: 13px; }
.score-ring__label { margin-top: 4px; color: var(--k-muted); font-size: 11px; }
/* 320 宽时右边约 180px：13px 字一行 11 个放得下，三行不会折成五行；卡片是最小高度，万一折行也不会溢出 */
.score-card__text { flex: 1; min-width: 0; color: var(--k-ink2); font-size: 13px; line-height: 1.7; white-space: pre-line; }
.reason-list { border-radius: 12px; background: var(--k-paper); }
.reason-box { margin-top: 12px; padding: 0 16px 16px; border-radius: 12px; background: var(--k-paper); }
.reason-row { position: relative; min-height: 60px; padding: 10px 0; display: flex; align-items: flex-start; gap: 12px; }
.reason-row:first-child { margin-top: 12px; }
.reason-row__icon { width: 32px; height: 32px; flex: 0 0 auto; display: flex; align-items: center; justify-content: center; border-radius: 10px; background: var(--k-red-soft); }
.reason-row + .reason-row::before { content: ''; position: absolute; left: 44px; right: 0; top: 0; height: 1px; background: var(--k-line); transform: scaleY(.5); }
.reason-row__copy { flex: 1; min-width: 0; }
.reason-row__label { display: block; width: 64px; font-size: 14px; font-weight: 600; line-height: 20px; white-space: nowrap; }
.reason-row__desc { display: block; margin-top: 2px; color: var(--k-muted); font-size: 12px; line-height: 1.5; white-space: pre-line; }
.reason-row__score { flex: 0 0 auto; width: 44px; text-align: right; color: var(--k-ink); font-size: 14px; font-weight: 600; line-height: 32px; font-variant-numeric: tabular-nums; }
.reason-pref-head { height: 48px; margin-top: 0; }
.ai-body .preference-head { padding-right: 12px; }
@media (max-width: 360px) {
  .handbook-cover { margin-left: -12px; margin-right: -12px; }
  .brand { gap: 4px; padding-left: 4px; }
  .brand__name { font-size: 14px; letter-spacing: 0; }
  .location { margin-left: 0; padding: 0 4px 0 6px; gap: 2px; border-width: 8px 0; }
  .location__name { font-size: 12px; }
  .home-content, .ai-body, .result-body, .reason-body { padding-left: 12px; padding-right: 12px; }
  .result-tabs { padding: 0 12px; }
  .entry-grid { padding: 16px 0; }
  .activity-list { --activity-height: 124px; }
  .activity-card { column-gap: 8px; padding-right: 9px; }
  .entry__icon { width: 40px; height: 40px; border-radius: 12px; }
  .reason-row { gap: 8px; }
  .reason-row + .reason-row::before { left: 40px; }
}

.home-page.user-surface {
  --k-top: #FAF7F1;
  .search-box { @include user-search.field; }
  .search-box__field { height: 44px; padding: 0; gap: 7px; }
  .search-box__input { @include user-search.input; }
  .search-box__placeholder { font-size: 13px; }
  .search-box__go { @include user-search.submit; }
  .entry-grid { margin-top: 5px; padding: 11px 0 12px; background: transparent; }
  .entry__icon { width: 39px; height: 39px; border-radius: 11px; background: #FFFDFA; }
  .section-head { margin-top: 21px; margin-bottom: 10px; }
  .section-head__title { font-size: 17px; font-weight: 600; }
  .activity-list + .section-head { margin-top: 14px; }
  .stay-cover { width: auto; margin: 5px 5px 0; padding-top: 63%; border-radius: 8px; }
  .stay-source { left: 6px; top: 6px; border-radius: 5px; background: rgba(255, 253, 249, .94); color: var(--k-ink); }
  .stay-tile { box-shadow: none; }
  .stay-copy { padding: 8px 10px 6px; }
  .stay-grid--one { grid-template-columns: minmax(0, 1fr); }
  .stay-grid--one .stay-tile, .stay-grid--one .feed-card--stay { flex-direction: row; align-items: center; }
  .stay-grid--one .feed-card--stay { display: flex; flex: 1; min-width: 0; }
  .stay-grid--one .stay-cover { flex: 0 0 32%; height: 68px; margin: 4px; padding-top: 0; border-radius: 6px; }
  .stay-grid--one .stay-source { display: none; }
  .stay-grid--one .stay-copy { padding: 8px 4px; }
  .stay-grid--one .stay-tags { flex-shrink: 0; min-height: 0; margin: 0; padding: 0 9px 0 0; }
}
@media (max-width: 359px) {
  .home-page.user-surface .entry-grid { padding: 11px 0; }
  .home-page.user-surface .entry__icon { width: 38px; height: 38px; }
}
</style>
