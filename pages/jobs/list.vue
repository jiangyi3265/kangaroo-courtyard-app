<template>
  <!-- #ifdef MP-WEIXIN -->
  <page-meta :page-style="noticePopup.show || cityOpen || filterOpen ? 'overflow: hidden' : ''" />
  <!-- page-meta 必须是页面第一个节点。公告、城市与筛选弹层打开时锁住背景页面；
       只在小程序里加：H5 的 page-meta 关弹窗时清不掉这条样式，顶栏会从此不吸顶 -->
  <!-- #endif -->
  <k-feature-gate feature="recruitment">
  <view class="k-page jobs">
    <k-topbar :title="cur.title" back bg="#FCF9F3" />

    <view class="jobs-discovery">
      <!-- 氛围背景与岗位实拍分开：装饰图不参与岗位数据和实拍认证。 -->
      <view class="jobs-discovery__backdrop" aria-hidden="true"><image class="jobs-discovery__coast" src="/pages/jobs/static/discovery-coast.jpg" mode="aspectFill" /><view class="jobs-discovery__wash" />
        <!-- 2026-11-03 主人给的参考图：「全国 / 筛选」那一行右边留纸飞机 + 虚线装饰，订阅回到数量行 -->
        <view class="jobs-discovery__decor"><view class="jobs-discovery__trail" /><view class="jobs-discovery__plane"><k-icon name="send" :size="26" color="red" :stroke="1.2" :fill="true" /></view></view>
      </view>
      <view class="jobs-discovery__controls">
      <view class="job-kinds">
        <view v-for="(type, i) in TYPES" :key="type" class="job-kind" hover-class="k-press" :class="{ active: s === i + 1 }" @click="switchTab(i + 1)"><text class="job-kind__text">{{ TYPE_NAMES[type] }}</text><view class="job-kind__bar" /></view>
      </view>
      <job-search v-model="keyword" theme="travel" :type="curType()" :cities="cities" :max="MAX_CITIES" :placeholder="cur.placeholder" @search="doSearch" @clear="clearKeyword" @city="selectSearchCity" />
      <view v-if="s !== 4 && shownCities.length" class="city-tags">
        <view v-for="cityName in shownCities" :key="cityName" class="city-tag" hover-class="k-press" aria-role="button" :aria-label="'删除城市 ' + cityName" @click="removeChip('city:' + cityName)"><k-icon name="map-pin" :size="13" color="red" /><text>{{ cityName }}</text><k-icon name="x" :size="12" color="red" /></view>
        <view class="city-tags__reset" hover-class="k-press" @click="resetCities"><text>重置城市</text></view>
      </view>

      <!-- 城市与条件分开展示；打开面板后编辑草稿，确认后才生效。 -->
      <view class="fchips-wrap">
        <view class="fchips">
          <view v-if="s !== 4" class="fchip fchip--add" hover-class="k-press-s" aria-role="button" aria-label="选择城市" @click="openCityChip"><k-icon name="map-pin" :size="16" color="red" :stroke="2" :fill="true" /><text class="fchip__text">{{ shownCities.length ? '更换城市' : '全国' }}</text><k-icon name="chevron-down" :size="13" color="ink" :stroke="2" /></view>
          <view class="fchip-main" :class="{ open: filterOpen, on: chips.length }" hover-class="k-press-s" @click="toggleFilter"><k-icon name="filter" :size="16" color="ink2" :stroke="1.8" /><text class="fchip-main__text">筛选</text><view class="fchip-main__caret" :class="{ up: filterOpen }" /></view>
          <scroll-view scroll-x class="fchips__scroll" :show-scrollbar="false">
            <view class="fchips__inner">
              <view v-for="chipItem in conditionChips" :key="chipItem.key" class="fchip" hover-class="k-press-s" @click="removeChip(chipItem.key)"><text class="fchip__text">{{ chipItem.text }}</text><k-icon name="x" :size="11" color="red" :stroke="2.2" /></view>
              <text v-if="s === 4" class="online-scope">全国可接 · 不限所在城市</text>
            </view>
          </scroll-view>
        </view>
      </view>
      </view>
    </view>

    <view v-if="filterOpen" class="jobs-filter-mask" @click="filterOpen = false" @touchmove.stop.prevent />
    <view v-if="filterOpen" class="jobs-filter" role="dialog" aria-modal="true" aria-label="筛选岗位">
      <job-filter-panel :type="curType()" :draft="draft" :kinds="workKinds" :count="draftCount" :counting="counting" :count-error="countError" @pick="onPick" @reset="onReset" @confirm="onConfirm" @close="filterOpen = false" />
    </view>

    <view class="k-body k-pad-tab jobs-body">
      <view v-if="chips.length || keyword" class="filter-summary"><text>{{ chips.length ? '已选 ' + chips.length + ' 项条件' : '正在按关键词查找' }}</text><view hover-class="k-press" @click="resetFilters"><text>重置全部</text></view></view>

      <!-- 全职旅行：主人自己的「培训活动」横幅（2026-10-18，后台「首页内容管理」栏目选「全职培训横幅」的那场活动）；点了去活动详情报名，没有就不出 -->
      <view v-if="s === 3 && training" class="train" hover-class="k-press-s" @click="openTraining">
        <image v-if="training.img" class="train__img" :src="training.img" mode="aspectFill" />
        <view class="train__shade" :class="{ 'train__shade--plain': !training.img }" />
        <image v-if="!training.img" class="train__roo" src="/static/media/brand-kangaroo.png" mode="aspectFit" />
        <view class="train__copy">
          <view class="train__tag"><k-icon name="graduation-cap" :size="12" color="white" :stroke="2" /><text>培训活动</text></view>
          <text class="train__title">{{ training.title }}</text>
          <text v-if="training.meta" class="train__meta">{{ training.meta }}</text>
        </view>
        <view class="train__go"><text>去报名</text><k-icon name="chevron-right" :size="13" color="red" :stroke="2.4" /></view>
      </view>

      <!-- 数量 + 订阅 + 刷新（2026-11-03 主人参考图：订阅在数量行，「当前订阅 | 5秒更新」；每人只有一条订阅，没有就新建，有了点进去直接改「当前订阅」） -->
      <view class="list-status">
        <text class="count">{{ loading ? '正在获取最新岗位…' : loadError ? '岗位加载失败，请刷新重试' : cur.count }}</text>
        <view class="bell" :class="{ on: notify }" hover-class="k-press" @click="openSubscribe"><k-icon :name="notify ? 'bell-ring' : 'bell'" :size="15" :color="notify ? 'red' : 'ink'" :stroke="1.8" /><text class="bell__text">{{ notify ? '当前订阅' : '订阅' }}</text></view>
        <view class="refresh" aria-live="off"><k-icon name="clock" :size="15" color="ink" :stroke="1.7" /><text class="refresh__text">{{ autoRefreshing ? '更新中' : refreshSeconds + '秒更新' }}</text></view>
      </view>
      <text v-if="!loading && !loadError && !cur.jobs.length" class="empty-jobs">{{ keyword ? '没有找到匹配的岗位，换个说法或关键词试试。' : chips.length ? '没有符合这些条件的岗位，点「筛选」换个条件试试。' : s === 4 ? '暂无已上架的线上任务，新任务发布后会在这里展示。' : '暂无已上架的岗位，可切换其他分类查看。' }}</text>

      <!-- 实拍岗位用大图卡片；缺图或图片加载失败时自动收为紧凑卡片，真实条件分组展示。 -->
      <view v-for="job in cur.jobs" :key="job.jobId" class="card" :class="hasJobPhoto(job) ? 'card--photo' : 'card--compact'" hover-class="k-press-s" aria-role="button" :aria-label="'查看岗位：' + job.headline" @click="openJob(job)">
        <view class="card__left">
          <image v-if="hasJobPhoto(job)" class="card__img" :src="job.img" mode="aspectFill" @error="markJobPhotoFailed(job)" />
          <view v-else class="card__empty" aria-label="暂无岗位照片"><k-icon :name="s === 4 ? 'laptop' : 'house'" :size="26" color="red" :stroke="1.6" /></view>
          <view v-if="job.assured && hasJobPhoto(job)" class="card__badge" aria-label="经袋鼠实地拍摄并含保险"><job-badge size="ribbon" /></view>
          <view v-if="hasJobPhoto(job)" class="card__location" :aria-label="job.loc || '地点待定'"><k-icon :name="s === 4 ? 'store' : 'map-pin'" :size="13" color="white" :stroke="2" /><text>{{ job.locationLabel || job.loc || '地点待定' }}</text></view>
        </view>
        <view class="card__main">
          <k-job-urgency :job="job" />
          <view class="card__head">
            <view class="card__heading"><view class="card__title-row"><text class="title k-display">{{ displayWording(job.headline, [job.storeName]) }}</text></view><text v-if="job.subtitle" class="card__subtitle">{{ job.subtitle }}</text></view>
            <view class="card__open"><k-icon name="chevron-right" :size="16" color="muted" :stroke="1.7" /></view>
          </view>
          <view v-if="job.category || job.arrangement" class="card__meta">
            <text v-if="job.category" class="card__category">{{ job.category }}</text>
            <view v-if="job.arrangement" class="card__arrangement"><k-icon :name="job.arrangement.icon" :size="14" color="ink2" :stroke="1.6" /><text>{{ job.arrangement.text }}</text></view>
          </view>
          <view v-if="job.price" class="price"><text class="price__num">{{ job.price }}</text><text class="price__unit">{{ job.unit }}</text></view>
          <view v-if="!hasJobPhoto(job)" class="loc" :aria-label="job.loc || '地点待定'">
            <k-icon :name="s === 4 ? 'store' : 'map-pin'" :size="s === 4 ? 13 : 14" color="muted" :stroke="1.7" />
            <text class="loc__text">{{ job.locationLabel || job.loc || '地点待定' }}</text>
          </view>
        </view>
          <view v-if="job.flags.length || job.redpacket || job.keywordTags.length || job.remote || (job.assured && !hasJobPhoto(job))" class="tags card__tags">
            <view v-for="flagItem in job.flags" :key="'f' + flagItem.text" class="tag" :class="'tag--' + flagItem.tone"><text>{{ flagItem.text }}</text></view>
            <view v-if="job.redpacket" class="tag tag--gift"><k-icon name="gift" :size="13" color="#8A5A1C" :stroke="1.8" /><text>满月红包</text></view>
            <view v-if="job.keywordTags.length" class="card__keywords"><text v-for="tagText in job.keywordTags" :key="tagText">{{ tagText }}</text></view>
            <view v-if="job.remote" class="remote"><k-icon name="laptop" :size="13" color="green" :stroke="2" /><text>远程</text></view>
            <view v-if="job.assured && !hasJobPhoto(job)" class="card__trust" aria-label="安心商家 · 含保险"><k-icon name="shield-check" :size="15" color="green" :stroke="2" /><text>安心商家 · 含保险</text></view>
          </view>
        <view v-if="job.facts.length" class="card__facts" :class="'card__facts--' + job.facts.length">
          <view v-for="factItem in job.facts" :key="factItem.icon" class="card__fact" :class="{ 'card__fact--board': factItem.icon === 'utensils' }"><k-icon :name="factItem.icon" :size="16" :color="factItem.tone === 'green' ? 'green' : 'red'" :stroke="1.8" /><text>{{ factItem.text }}</text></view>
        </view>
        <view v-if="job.details.length" class="card__details">
          <view v-for="detailItem in job.details" :key="detailItem.text" class="card__detail" :class="{ 'card__detail--safe': detailItem.tone === 'green' }"><k-icon :name="detailItem.icon" :size="14" :color="detailItem.tone === 'green' ? 'green' : 'ink2'" :stroke="1.6" /><text>{{ detailItem.text }}</text></view>
        </view>
        <view v-if="(s === 2 && (job.days || job.time)) || (s === 3 && (job.train || job.probation || job.benefits.length)) || (s === 4 && (job.deliver || job.est))" class="card__extra">
          <!-- 兼职旅行：门店写的排班说明 / 上班时间 -->
          <view v-if="s === 2 && (job.days || job.time)" class="meta"><k-icon name="clock" :size="13" color="muted" :stroke="1.7" /><text>{{ job.days }}</text><text v-if="job.time" class="meta__time">{{ job.time }}</text></view>
          <!-- 全职旅行：培训 / 试用期 / 福利 -->
          <template v-else-if="s === 3">
            <view v-if="job.train || job.probation" class="meta meta--text"><text v-if="job.train">培训：{{ job.train }}</text><text v-if="job.probation">试用期：{{ job.probation }}</text></view>
            <view v-if="job.benefits.length" class="tags"><view v-for="benefitText in job.benefits" :key="benefitText" class="tag"><text>{{ benefitText }}</text></view></view>
          </template>
          <!-- 线上任务：交付 / 工时 -->
          <view v-else-if="s === 4 && (job.deliver || job.est)" class="meta meta--text">
            <view v-if="job.deliver" class="meta__item"><k-icon name="calendar-days" :size="13" color="muted" :stroke="1.7" /><text>交付日期：{{ job.deliver }}</text></view>
            <text v-if="job.est">预计工时：{{ job.est }}</text>
          </view>
        </view>
      </view>
      <!-- 触底翻页之前没有任何提示，看不出是还在加载还是已经到底 -->
      <text v-if="cur.jobs.length && !loading" class="list-end">{{ loadingMore ? '正在加载更多…' : hasMore[s - 1] ? '上滑加载更多' : '已经到底了' }}</text>
    </view>

    <job-city-panel v-if="cityOpen" :type="curType()" :value="cityValue" :max="MAX_CITIES" @close="cityOpen = false" @confirm="onCityConfirm" />
    <k-tabbar v-if="!cityOpen" active="home" />
    <!-- 进小程序时的公告弹窗（本次启动最多弹一次，和首页共用一份状态） -->
    <k-notice-popup />
  </view>
  </k-feature-gate>
</template>

<script setup>
import { publicShare, shareWithCover, timelineShare, showPublicShareMenu } from '@/common/public-share.js'
import { displayWording } from '@/common/display-wording.js'
import { absUrl } from '@/common/upload.js'
import { ref, reactive, computed, watch } from 'vue'
import { onShow, onHide, onUnload, onPullDownRefresh, onReachBottom, onShareAppMessage, onShareTimeline } from '@dcloudio/uni-app'
import { useScreen, go, toast } from '@/common/screen.js'
import { apiJobList, apiJobSubs, apiJobKinds, apiJobTrainingBanner } from '@/common/api.js'
import { checkNoticePopup, noticePopup } from '@/common/notice.js'
import { currentJobSubscription } from './subscription-model.js'
import R from '@/common/routes.js'
import JobBadge from './components/job-badge.vue'
import { remainingHeadcount } from './store-page.js'
import JobSearch from './components/job-search.vue'
import { toggleCitySelection } from '@/common/city-picker-model.js'
import JobFilterPanel from './components/job-filter-panel.vue'
import JobCityPanel from './components/job-city-panel.vue'
import { TYPES, TYPE_NAMES, MAX_CITIES, MAX_SKILLS, blankFilter, cloneFilter, filterParams, filterChips, dropChip, pickOption, filterFromQuery, filterForTab, filterQuery, queryString, minDaysLabel } from './job-filters.js'

// ---------------------------------------------------------------------------
// 筛选条件（2026-10-16 第二轮改版，效果图 23）：
//   · 城市三个到店页签共用一份（首页和城市页入口都不带定位城市，默认全国；仅显式筛选链接可带入已选目的地），最多 5 个；线上任务全国可接，不带城市；
//   · 其余条件每个页签各存一份（换宿：性别 / 技能 / 排班 / 时长 / 住宿 / 保障 / 换工类型；兼职：食宿 / 日薪；全职：类型 / 食宿 / 月薪；线上：任务类型，见 job-filters.GROUPS）；
//     换页签时（switchTab，2026-10-17）新页签用不上的条件清掉，用得上的带过去（兼职 ↔ 全职的食宿），见 job-filters.filterForTab；
//   · 在面板里改的是草稿，底部实时数一下有多少个（同一个列表接口，只要 1 条），点「确定」才生效；点空白处收起就不算数。
// ---------------------------------------------------------------------------
const cities = ref([])
const sel = reactive({ volunteer: blankFilter(), parttime: blankFilter(), fulltime: blankFilter(), online: blankFilter() })
const s = useScreen(4, {
  onLoad: (q) => {
    const i = TYPES.indexOf(q?.type)
    if (i >= 0) s.value = i + 1
    // 地址里的城市 + 这个页签自己的条件（?kind= / ?board= / ?payDay= / ?categories= …，别的页签的不认，见 job-filters.filterFromQuery）
    const f = filterFromQuery(q || {})
    cities.value = f.cities
    Object.assign(sel[TYPES[s.value - 1]], cloneFilter({ ...f, cities: [] }))
  }
})
const curType = () => TYPES[s.value - 1]
const filterOf = (type) => ({ ...sel[type], cities: cities.value })
// 换工类型（后台「字典管理 → 换工类型」可改）：放进换宿的筛选面板，只取一次
const workKinds = ref([])
let kindsLoaded = false
const loadKinds = () => {
  if (kindsLoaded) return
  kindsLoaded = true
  apiJobKinds().then((r) => { workKinds.value = (r && r.data) || [] }).catch(() => { kindsLoaded = false })
}
const keyword = ref('')
// 新机会提醒：有订阅就显示为开（铃铛亮、写「当前订阅」）；点铃铛进订阅设置（城市 / 类型 / 频率），推送走消息中心。
// 每次回到列表（onShow）都重读：去订阅页保存完回来要马上亮
const notify = ref(false)
const loadNotify = () => apiJobSubs().then((r) => { notify.value = !!currentJobSubscription((r && r.data) || []) }).catch(() => {})
// 新增订阅时带上当前页签（type=）和选了的城市（cities=，线上任务不带），订阅页预选它们，用户可以在那边改；
// 2026-10-17 起这个页签选了的条件也按 filterQuery 带上（和列表页地址同一套参数名），筛选页「筛选条件」那一屏按同一组条件预选
const openNewSub = () => {
  const type = curType()
  go(R.jobsFilter + '?s=2&' + queryString(filterQuery(type, filterOf(type))))
}
// 2026-11-03 主人：订阅每人只能写一条，之后都是修改「当前订阅」，不要弹原生小菜单（新增 / 管理已有订阅）。
// 还没有订阅：带上列表条件去新建；已有：直接打开当前那条（cur=1 让订阅页一进来就按「当前订阅」显示）。
// notify 没读到时也走新建入口：订阅页自己会再查一次，查到已有就改成编辑那一条，不会建第二条
function openSubscribe() {
  if (notify.value) return go(R.jobsFilter + '?s=2&cur=1')
  openNewSub()
}

// 四类岗位共用卡片布局，搜索提示和统计文案随分类切换。
const screens = [
  { title: '换宿旅行', placeholder: '搜索城市、岗位或偏好', countText: (n) => `${n} 个换宿岗位` },
  { title: '兼职旅行', placeholder: '搜索城市或兼职，如咖啡、前台', countText: (n) => `${n} 个兼职岗位` },
  { title: '全职旅行', placeholder: '搜索城市或全职，如管家、店长', countText: (n) => `${n} 个全职岗位` },
  { title: '线上任务', placeholder: '搜索任务，如文案、视频剪辑', countText: (n) => `${n} 个线上任务` }
]
// ---------------------------------------------------------------------------
// 岗位卡片的数据来自 /app/job/list，映射成模板用的字段名。
// 「匹配度」没有对应的后端数据（匹配算法属于未确认的业务规则），不编百分比；有薪资就显示真实薪资。
// ---------------------------------------------------------------------------
const lists = ref([[], [], [], []])
const totals = ref([0, 0, 0, 0])
const loading = ref(false)
const loadError = ref('')

const BOARD_TEXT = { all: '包吃包住', room: '包住宿', meal: '包三餐', part: '包部分' }
const boardOf = (j) => (j.boardType && j.boardType !== 'none' ? (j.boardText || BOARD_TEXT[j.boardType] || '') : '')
const cond = (text, tone = '') => ({ text, tone })
const hoursLabel = (value) => /^\d+(\.\d+)?$/.test(String(value || '')) ? `每日 ${value} 小时` : value
const fact = (icon, text, tone = '') => text ? { icon, text, tone } : null
const compactHours = (value) => String(hoursLabel(value) || '').replace(/^(每天|每日)\s*(\d+(?:\.\d+)?)\s*小时$/, '每天$2小时')
const locationLabel = (j) => {
  const province = String(j.provinceName || j.province || String(j.address || '').match(/^(.{2,}?(?:省|自治区))/)?.[1] || '').replace(/省$/, '')
  return [...new Set([province, j.city].filter(Boolean))].join(' · ')
}
// 失败记录绑定图片地址；后台换了照片后会重新尝试，不把该岗位永久留在缺图状态。
const failedJobImages = ref({})
const hasJobPhoto = (job) => job.hasPhoto && failedJobImages.value[job.jobId] !== job.img
const markJobPhotoFailed = (job) => { failedJobImages.value[job.jobId] = job.img }

const mapJob = (j, type) => {
  const title = String(j.title || '')
  const titleParts = title.match(/^(.+?)[（(]([^（）()]+)[）)]$/)
  const photo = (Array.isArray(j.images) && j.images[0]) || j.cover
  const extraPay = [j.bonusDesc ? '奖金' : '', j.commissionDesc ? '提成' : ''].filter(Boolean).join(' + ')
  // 名额满了报不上名（服务端按同一个数拒绝报名；线上任务的 hiredCount 是进行中的接单人数）：卡片上直接标出来，不让人点进去白填表
  const full = remainingHeadcount(j) === 0
  // 字典 safe_cert「0已认证 1未认证」、insurance_flag「0含 1不含」，'0' 才是"有"；按真实字段渲染，不给不符合的岗位挂（虚假承诺）
  const certified = String(j.safeCert) === '0'
  const insured = String(j.insuranceFlag) === '0'
  // 两样都有：封面挂「经袋鼠实地拍摄并含保险」；只有一样：在条件里用绿色对勾写出来。线上任务没有这些
  const assured = type !== 'online' && certified && insured && j.assured !== false
  const safety = type === 'online' || assured ? [] : [...(certified ? [cond('安心商家', 'green')] : []), ...(insured ? [cond('含保险', 'green')] : [])]
  const base = {
    jobId: j.jobId,
    status: j.status,
    urgentLevel: j.urgentLevel,
    urgentDeadline: j.urgentDeadline,
    storeName: j.storeName,
    // 卡片封面用岗位第一张照片（V49）；没传照片时用服务端给的封面（岗位封面 / 门店封面）
    img: absUrl((Array.isArray(j.images) && j.images[0]) || j.cover) || '/static/media/cover-empty.png',
    hasPhoto: typeof photo === 'string' && !!photo.trim() && !/\/cover-empty\.png(?:[?#]|$)/.test(photo),
    title,
    category: type === 'volunteer' ? (j.workKindLabel || '') : '',
    // 到店岗位直接显示后台门店名，城市、岗位类别和食宿信息各自单独展示。
    headline: type === 'online' ? (titleParts ? titleParts[1].trim() : title) : (title.trim() || String(j.storeName || '').trim() || '岗位标题待补充'),
    subtitle: type === 'online' && titleParts ? titleParts[2].trim() : '',
    flags: [...(type==='volunteer' ? [{text:j.genderPref==='F'?'招募女生':j.genderPref==='M'?'招募男生':'男女不限',tone:'green'}] : []), ...(j.myApplication ? [{text:j.myApplication.label,tone:'green'}] : []), ...(j.status === 'paused' ? [{ text: '已暂停招聘', tone: 'muted' }] : []), ...(full ? [{ text: '名额已满', tone: 'alert' }] : [])],
    // 换工类型（如「摄影换工」）排在关键词最前面，一眼看出是哪一类
    tags: [...new Set([...(type === 'volunteer' && j.workKindLabel ? [j.workKindLabel] : []), ...(j.tags || []), ...(j.bonusDesc ? ['奖金'] : []), ...(j.commissionDesc ? ['提成'] : [])])],
    loc: [j.address, j.city].filter(Boolean).join(' · '),
    locationLabel: locationLabel(j),
    // 做满一个月有红包（V44，后端给布尔）；线上任务没有「做满一个月」，不显示
    redpacket: type !== 'online' && j.monthRedpacket === true,
    assured,
    facts: type === 'online' ? [] : [
      type === 'volunteer' ? fact('calendar-days', minDaysLabel(j.minDays)) : null,
      fact('clock', compactHours(j.dailyHours)),
      fact('utensils', boardOf(j), 'green')
    ].filter(Boolean),
    // 排班和房型与岗位类型横排，保障信息仍保留在条件区。
    arrangement: type === 'online' ? null : fact(j.restModeLabel ? 'calendar' : 'bed-double', [j.restModeLabel, j.roomTypeLabel].filter(Boolean).join(' · ')),
    details: safety.map(item => fact('shield-check', item.text, item.tone)).filter(Boolean),
    conds: []
  }
  base.keywordTags = base.tags.filter(tag => tag !== base.category)
  if (type === 'volunteer') {
    return {
      ...base,
      // 换宿主要是换食宿：门店给了真实薪资才显示，奖金 / 提成已经在标签里，不再挤到标题右边
      price: j.salaryText || '', unit: '',
      conds: [minDaysLabel(j.minDays), boardOf(j), j.restModeLabel, j.roomTypeLabel, hoursLabel(j.dailyHours)].filter(Boolean).map(t => cond(t)).concat(safety)
    }
  }
  if (type === 'parttime') {
    const paid = j.salaryType !== 'none' && j.salaryMin != null
    return {
      ...base,
      price: paid ? String(j.salaryMin).replace(/\.0+$/, '') : extraPay,
      unit: paid ? (j.salaryUnit || '') : '',
      days: j.shiftDesc || '', time: j.shiftTime || '',
      conds: [j.restModeLabel, boardOf(j), j.roomTypeLabel].filter(Boolean).map(t => cond(t)).concat(safety)
    }
  }
  if (type === 'fulltime') {
    return {
      ...base,
      price: j.salaryText ? j.salaryText.replace(/\s*元?\/[^/]+$/, '') : extraPay,
      unit: j.salaryText ? (j.salaryUnit || '') : '',
      train: j.trainDesc || '', probation: j.probation || '', benefits: j.benefits || [],
      conds: [j.restModeLabel, boardOf(j), j.roomTypeLabel].filter(Boolean).map(t => cond(t)).concat(safety)
    }
  }
  return {
    ...base,
    price: j.salaryText ? j.salaryText.replace(/\s*元\/.*$/, '') : extraPay,
    unit: j.salaryText ? (j.salaryUnit || '') : '',
    // 发单方：后端对员工发布的任务已改成门店名（不再下发员工个人昵称），没有发单方时也显示门店名，和详情页、全部筛选结果一致
    loc: j.publisherName || j.storeName || base.loc,
    locationLabel: j.publisherName || j.storeName || base.loc,
    deliver: j.deliverDesc || '', est: j.estHours || '',
    // 字典 remote_flag「0远程 1非远程」，'0' 才是远程（按真实字段渲染，非远程的不标）
    remote: String(j.remoteFlag) === '0'
  }
}

// 分页游标：每个分类各记一份；后端下发 hasMore，没给时退回"已拿到的条数 < total"
const PAGE_SIZE = 20
const pages = ref(TYPES.map(() => 1))
const hasMore = ref(TYPES.map(() => false))
const loadingMore = ref(false)

let listRequest = 0
let pageVisible = false
// 最近一次从第一页拉的是哪个页签：从首页入口带 ?type= 进来时，onLoad 改页签、onShow 已经拉过这一页签，
// 换页签的 watch 随后才跑，不能再拉一遍（之前同一个 /app/job/list 请求发两次）
let listIndex = -1
let requestedKeyword = ''
const listParams = (type, f) => ({ type, keyword: keyword.value.trim() || undefined, ...filterParams(type, f) })
const fetchJobs = async (index, append = false, silent = false) => {
  if (!silent) requestedKeyword = keyword.value.trim()
  const request = ++listRequest
  const type = TYPES[index]
  const pageNum = append ? pages.value[index] + 1 : 1
  if (!append) listIndex = index
  if (!append && type === 'fulltime') loadTraining()
  if (append) loadingMore.value = true
  else if (!silent) loading.value = true
  if (!silent) loadError.value = ''
  try {
    const params = listParams(type, filterOf(type))
    const batches = silent ? await Promise.all(Array.from({ length: pages.value[index] }, (_, i) => apiJobList({ ...params, pageNum: i + 1, pageSize: PAGE_SIZE }))) : null
    const res = batches ? { ...batches[0], rows: batches.flatMap(x => x.rows || []), hasMore: batches[batches.length - 1].hasMore } : await apiJobList({ ...params, pageNum, pageSize: PAGE_SIZE })
    if (request !== listRequest) return
    loadError.value = ''
    const rows = (res.rows || []).map(j => mapJob(j, type))
    lists.value[index] = append ? lists.value[index].concat(rows) : rows
    totals.value[index] = res.total || 0
    if (!silent) pages.value[index] = pageNum
    hasMore.value[index] = typeof res.hasMore === 'boolean' ? res.hasMore : lists.value[index].length < (res.total || 0)
  } catch (e) {
    if (request !== listRequest) return
    if (silent) return
    if (!append) {
      lists.value[index] = []
      totals.value[index] = 0
      hasMore.value[index] = false
    }
    loadError.value = e?.message || '加载失败'
    toast(loadError.value)
  } finally {
    if (request === listRequest) { loading.value = false; loadingMore.value = false }
  }
}

// ---------------------------------------------------------------------------
// 全职旅行的培训活动横幅（2026-10-18）：按已选城市取一次（城市变了再取）；后台没配、活动结束了就没有，横幅不出
// ---------------------------------------------------------------------------
const trainingRaw = ref(null)
let trainingKey = null
function loadTraining() {
  const key = cities.value.join(',')
  if (key === trainingKey) return
  trainingKey = key
  apiJobTrainingBanner(key).then((r) => { if (trainingKey === key) trainingRaw.value = (r && r.data && r.data.activityId) ? r.data : null })
    .catch(() => { if (trainingKey === key) { trainingRaw.value = null; trainingKey = null } })
}
const training = computed(() => {
  const a = trainingRaw.value
  if (!a) return null
  return {
    id: a.activityId, title: a.title || '培训活动', img: a.img ? absUrl(a.img) : '',
    meta: [a.dateText, a.city, a.priceText].filter(Boolean).join(' · ')
  }
})
const openTraining = () => { if (training.value) go(R.activity + '?id=' + training.value.id) }

// 触底继续加载当前分类的下一页
onReachBottom(() => {
  const index = s.value - 1
  if (loading.value || loadingMore.value) return
  if (!hasMore.value[index]) return
  fetchJobs(index, true)
})

const cur = computed(() => {
  const conf = screens[s.value - 1]
  return { ...conf, jobs: lists.value[s.value - 1], count: conf.countText(totals.value[s.value - 1]) }
})

// 上架、暂停可能发生在别的设备；每次回到列表重新读取服务端，不能只在首次挂载时加载。
const refreshJobs = () => fetchJobs(s.value - 1)
const refreshSeconds = ref(5)
const autoRefreshing = ref(false)
let refreshTimer = null
function stopAutoRefresh() { clearInterval(refreshTimer); refreshTimer = null }
function startAutoRefresh() {
  stopAutoRefresh()
  refreshSeconds.value = 5
  refreshTimer = setInterval(async () => {
    if (!pageVisible || loading.value || loadingMore.value || autoRefreshing.value || filterOpen.value || cityOpen.value || noticePopup.show || keyword.value.trim() !== requestedKeyword) return
    // #ifdef H5
    if (document.hidden) return
    // #endif
    if (--refreshSeconds.value > 0) return
    autoRefreshing.value = true
    try { await fetchJobs(s.value - 1, false, true) }
    finally { autoRefreshing.value = false; refreshSeconds.value = 5 }
  }, 1000)
}
// 进列表时顺带取换工类型（只取一次），并看一眼有没有要弹的公告（本次启动只弹一次）
onShow(() => { pageVisible = true; startAutoRefresh(); refreshJobs(); loadNotify(); loadKinds(); checkNoticePopup(); lockPageScroll(cityOpen.value || filterOpen.value) })
onHide(() => { pageVisible = false; stopAutoRefresh(); listRequest++; loading.value = false; loadingMore.value = false; lockPageScroll(false) })
onUnload(() => { pageVisible = false; stopAutoRefresh(); lockPageScroll(false) })
// 弹层内操作或正在编辑筛选草稿时，不触发下拉刷新；页内筛选仍可正常滚动。
onPullDownRefresh(() => {
  if (noticePopup.show || filterOpen.value || cityOpen.value) { uni.stopPullDownRefresh(); return }
  refreshJobs().finally(() => uni.stopPullDownRefresh())
})
// 点页签（2026-10-17）：新页签用不上的条件清掉，用得上的（兼职 ↔ 全职的食宿）带过去，城市照旧共用；
// 只在用户点页签时做，地址里带 ?type= 进来的那一页签按地址里的条件，不被别的页签盖掉
function switchTab(n) {
  if (n === s.value) return
  const to = TYPES[n - 1]
  Object.assign(sel[to], filterForTab(to, { ...sel[curType()], cities: [] }))
  s.value = n
}
// 换页签：收起面板，按这个页签自己的条件重新拉（城市是共用的，可能在别的页签改过）；这一页签刚拉过（见 listIndex）就不重复拉
watch(s, (v) => { filterOpen.value = false; cityOpen.value = false; if (pageVisible && listIndex !== v - 1) fetchJobs(v - 1) })

// ---------------------------------------------------------------------------
// 胶囊行：选了的条件一枚一枚列出来，点一下去掉这一条并重新拉列表。
// 筛选面板开着时，这一行列的是面板里的草稿，点掉胶囊 / 点「全部城市」改的也是草稿（之前改的是已生效的条件，
// 点「确定」时又被草稿盖回去：面板开着时在这一行选的城市一按「确定」就没了）
// ---------------------------------------------------------------------------
const chips = computed(() => filterChips(curType(), filterOpen.value ? draft : filterOf(curType()), workKinds.value))
const conditionChips = computed(() => chips.value.filter(c => !c.key.startsWith('city:')))
const shownCities = computed(() => (filterOpen.value ? draft.cities : cities.value))
function removeChip(key) {
  if (filterOpen.value) {
    dropChip(draft, key)
    scheduleCount()
    return
  }
  if (key.indexOf('city:') === 0) cities.value = cities.value.filter(c => c !== key.slice(5))
  else dropChip(sel[curType()], key)
  fetchJobs(s.value - 1)
}
function selectSearchCity(name) {
  if (curType() === 'online') return
  const next = toggleCitySelection(cities.value, name, MAX_CITIES)
  if (next.limited) return toast(`最多选 ${MAX_CITIES} 个城市`)
  cities.value = next.selected
  keyword.value = ''
  fetchJobs(s.value - 1)
}
function resetCities() {
  if (filterOpen.value) { draft.cities = []; scheduleCount(); return }
  cities.value = []
  fetchJobs(s.value - 1)
}
function resetFilters() {
  cities.value = []; keyword.value = ''
  Object.assign(sel[curType()], blankFilter())
  Object.assign(draft, blankFilter())
  filterOpen.value = false
  fetchJobs(s.value - 1)
}
const openCityChip = () => (filterOpen.value ? openCityDraft() : openCityLive())
const doSearch = () => { uni.hideKeyboard(); fetchJobs(s.value - 1) }
const clearKeyword = () => { keyword.value = ''; fetchJobs(s.value - 1) }
const openJob = (job) => go(R.jobDetail + '?jobId=' + job.jobId)

// ---------------------------------------------------------------------------
// 筛选面板：打开时把当前条件抄一份草稿；改草稿后等 400ms 数一下符合的岗位数（同一个列表接口，只取 1 条看 total）
// ---------------------------------------------------------------------------
const filterOpen = ref(false)
const draft = reactive(blankFilter())
const draftCount = ref(0)
const counting = ref(false)
const countError = ref(false)
let countTimer = null
let countSeq = 0
function toggleFilter() {
  if (filterOpen.value) { filterOpen.value = false; return }
  Object.assign(draft, cloneFilter(filterOf(curType())))
  draftCount.value = totals.value[s.value - 1]
  counting.value = false
  countError.value = false
  loadKinds()
  filterOpen.value = true
}
function scheduleCount() {
  clearTimeout(countTimer)
  counting.value = true
  countSeq++
  countTimer = setTimeout(countDraft, 400)
}
async function countDraft() {
  const seq = ++countSeq
  const type = curType()
  try {
    const res = await apiJobList({ ...listParams(type, draft), pageNum: 1, pageSize: 1 })
    if (seq !== countSeq) return
    draftCount.value = res.total || 0
    countError.value = false
  } catch (e) {
    if (seq !== countSeq) return
    countError.value = true
  } finally {
    if (seq === countSeq) counting.value = false
  }
}
const onPick = (key, value) => {
  if (!pickOption(draft, key, value)) { toast(`技能最多选 ${MAX_SKILLS} 个`); return }
  scheduleCount()
}
// 城市在面板外单独选择，重置条件只清本页签的条件。
const onReset = () => { const selectedCities = [...draft.cities]; Object.assign(draft, blankFilter(), { cities: selectedCities }); scheduleCount() }
function onConfirm() {
  const type = curType()
  clearTimeout(countTimer)
  countSeq++
  if (type !== 'online') cities.value = draft.cities.slice(0, MAX_CITIES)
  Object.assign(sel[type], cloneFilter({ ...draft, cities: [] }))
  filterOpen.value = false
  fetchJobs(s.value - 1)
  uni.pageScrollTo({ scrollTop: 0, duration: 0 })
}
// 城市和筛选弹层锁住 H5 body，关闭或离页时还原。
let restoreScroll = null
function lockPageScroll(on) {
  // #ifdef H5
  if (typeof document === 'undefined') return
  if (on && !restoreScroll) {
    const body = document.body
    const before = body.style.overflow
    body.style.overflow = 'hidden'
    restoreScroll = () => { body.style.overflow = before }
  } else if (!on && restoreScroll) {
    restoreScroll()
    restoreScroll = null
  }
  // #endif
}
// ---------------------------------------------------------------------------
// 选城市面板：从胶囊行的「全部城市」、筛选面板顶上的「更换城市」（2026-10-18 加回来）进来，筛选面板开着时选完回到面板草稿，
// 面板没开时选完立刻生效
// ---------------------------------------------------------------------------
const cityOpen = ref(false)
const cityValue = ref([])
let cityToDraft = false
// 面板顶边对齐顶栏下沿：小程序右上角的胶囊按钮在顶栏里，不压住面板标题
let navTop = 88
// #ifndef H5
try { navTop = (uni.getSystemInfoSync().statusBarHeight || 20) + 44 } catch (e) { navTop = 64 }
// #endif
function openCityDraft() {
  cityToDraft = true
  cityValue.value = draft.cities.slice()
  cityOpen.value = true
}
function openCityLive() {
  cityToDraft = false
  cityValue.value = cities.value.slice()
  cityOpen.value = true
}
function onCityConfirm(list) {
  const picked = (list || []).slice(0, MAX_CITIES)
  cityOpen.value = false
  if (cityToDraft && filterOpen.value) {
    draft.cities = picked
    scheduleCount()
    return
  }
  cities.value = picked
  fetchJobs(s.value - 1)
}
watch([cityOpen, filterOpen], ([city, filter]) => { if (pageVisible) lockPageScroll(city || filter) })

const pageShareMessage = () => publicShare('/pages/jobs/list', {type:curType()}, '袋鼠全球青年 · 旅行岗位')

onShareAppMessage((event) => shareWithCover(pageShareMessage(event)))
onShareTimeline(() => timelineShare(pageShareMessage()))
onShow(showPublicShareMenu)
</script>

<style scoped lang="scss">
/* 10-19 按参考图「换宿旅行列表与筛选」一比一还原：页面极浅暖米渐变底（顶栏跟着 --k-bg），顶栏标题超粗；
   页签大字（选中橙棕超粗 + 短粗圆头下划线，没选中深棕粗字）；白色大胶囊搜索框；浅橙描边的已选胶囊；白卡 + 浅橙底细边的标签 */
.jobs { --k-bg: #FCF9F3; --k-display-font: var(--k-sans); background: #FCF9F3; }
.jobs :deep(.k-navbar__title) { font-family: var(--k-sans); font-size: 18px; font-weight: 600; color: #3A322B; }
.jobs-body { padding-top: 4px; }
/* 页签：四个均分一行；选中的 21px 橙棕超粗，下面一道圆头短粗线；没选中的 17px 深棕粗字 */
.job-kinds { display: flex; align-items: flex-end; justify-content: space-between; gap: 4px; height: 44px; margin-bottom: 8px; }
.job-kind { position: relative; flex: 0 1 auto; min-width: 0; height: 46px; display: flex; align-items: center; justify-content: center; padding: 0 2px 8px; box-sizing: border-box; font-size: 17px; font-weight: 700; color: #3B2A1E; white-space: nowrap; font-family: var(--k-display-font); }
.job-kind__text { white-space: nowrap; }
.job-kind__bar { position: absolute; left: 50%; bottom: 1px; width: 24px; height: 4px; margin-left: -12px; border-radius: 2px; background: transparent; }
.job-kind.active { font-size: 17px; font-weight: 600; color: #8A603D; }
.job-kind.active .job-kind__bar { background: linear-gradient(90deg, #D08A45 0%, #A9692F 100%); }
@media (max-width: 359px) { .job-kind { font-size: 15px; } .job-kind.active { font-size: 15px; } }
.fchips-wrap { position: relative; margin-top: 12px; }
.fchips { display: flex; align-items: center; gap: 8px; }
.fchip-main { flex: 0 0 auto; height: 32px; box-sizing: border-box; padding: 0 12px 0 16px; border: 1.5px solid #C9935F; border-radius: 16px; background: #FFFCF8; display: flex; align-items: center; gap: 6px; font-size: 15px; font-weight: 700; color: #A0632E; }
.fchip-main.on, .fchip-main.open { border-color: #B5763C; background: #FDF1E3; }
/* 实心小三角（参考图「筛选 ▾」）；面板打开时朝上 */
.fchip-main__caret { width: 0; height: 0; border-left: 5px solid transparent; border-right: 5px solid transparent; border-top: 6px solid #B5763C; }
.fchip-main__caret.up { border-top: 0; border-bottom: 6px solid #B5763C; }
.fchip-main__text { white-space: nowrap; }
.fchips__scroll { flex: 1; min-width: 0; white-space: nowrap; }
.fchips__inner { display: inline-flex; align-items: center; gap: 6px; padding-right: 4px; }
.fchip { flex: 0 0 auto; height: 30px; box-sizing: border-box; padding: 0 9px 0 12px; border-radius: 15px; background: #FBEBD8; box-shadow: inset 0 0 0 1px #E6B98A; display: inline-flex; align-items: center; gap: 4px; font-size: 14px; font-weight: 700; color: #A0632E; white-space: nowrap; }
.fchip__text { white-space: nowrap; }
.fchip--add { padding: 0 12px 0 10px; box-shadow: none; background: #F2EEE8; font-weight: 600; color: #5A4636; }
.online-scope { display: inline-block; font-size: 13px; color: var(--k-green); white-space: nowrap; }
/* 2026-11-03 主人：筛选不占整屏，做成底部弹层（半屏左右，高度见 job-filter-panel 的 .fp）：背后压一层暗色，点暗处收起 */
.jobs-filter-mask { position: fixed; left: 0; right: 0; top: 0; bottom: 0; z-index: 80; background: rgba(58,50,43,.36); }
.jobs-filter { position: fixed; left: 0; right: 0; bottom: 0; z-index: 81; animation: jobs-sheet-up .2s ease-out; }
@keyframes jobs-sheet-up { from { transform: translateY(40px); opacity: .4; } to { transform: none; opacity: 1; } }
/* 数量行：左边「N 个换宿岗位」，右边刷新倒计时；订阅按钮在上面「全国 / 筛选」那一行右边（样式见 list-premium.scss） */
.list-status { display: flex; align-items: center; gap: 10px; margin-top: 12px; }
.count { flex: 1; min-width: 0; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; font-size: 15px; font-weight: 700; color: #3B2A1E; }
.bell, .refresh { flex: 0 0 auto; height: 28px; display: flex; align-items: center; gap: 3px; font-size: 14px; font-weight: 600; }
.bell { color: #A0632E; }
.bell.on { color: #A0632E; }
.refresh { color: #A0632E; }
.refresh--busy { opacity: .5; }
.bell__text, .refresh__text { white-space: nowrap; }
@media (max-width: 359px) { .bell__text { display: none; } }
.empty-jobs { display: block; color: var(--k-muted); font-size: 14px; line-height: 1.7; padding: 24px 0; }
/* 全职旅行的培训活动横幅：活动封面铺满，左边一层暖深色渐变压字；没封面时暖色渐变 + 袋鼠贴纸 */
.train { position: relative; margin-top: 12px; height: 104px; border-radius: var(--k-radius); overflow: hidden; background: linear-gradient(120deg, #F3DDBF 0%, #E7BF92 100%); box-shadow: 0 6px 20px rgba(58, 50, 43, .1); }
.train__img { position: absolute; left: 0; top: 0; width: 100%; height: 100%; }
.train__shade { position: absolute; left: 0; top: 0; right: 0; bottom: 0; background: linear-gradient(90deg, rgba(58, 38, 22, .78) 0%, rgba(58, 38, 22, .45) 55%, rgba(58, 38, 22, .08) 100%); }
.train__shade--plain { background: transparent; }
.train__roo { position: absolute; right: 18px; top: 16px; width: 56px; height: 60px; opacity: .9; }
.train__copy { position: absolute; left: 16px; right: 96px; top: 14px; display: flex; flex-direction: column; align-items: flex-start; gap: 5px; }
.train__tag { height: 20px; padding: 0 8px 0 6px; border-radius: 10px; background: rgba(255, 255, 255, .22); box-shadow: inset 0 0 0 .5px rgba(255, 255, 255, .45); display: flex; align-items: center; gap: 3px; font-size: 11px; font-weight: 600; color: #fff; }
.train__title { max-width: 100%; font-size: 17px; font-weight: 700; line-height: 1.3; color: #fff; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
.train__meta { max-width: 100%; font-size: 12px; color: rgba(255, 255, 255, .88); overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
.train__shade--plain ~ .train__copy .train__tag { background: rgba(138, 94, 54, .85); }
.train__shade--plain ~ .train__copy .train__title { color: #4A3423; }
.train__shade--plain ~ .train__copy .train__meta { color: #7A5A3E; }
.train__go { position: absolute; right: 14px; bottom: 14px; height: 28px; padding: 0 8px 0 12px; border-radius: 14px; background: #fff; box-shadow: 0 2px 8px rgba(58, 50, 43, .18); display: flex; align-items: center; gap: 1px; font-size: 13px; font-weight: 600; color: var(--k-red-deep); }
/* 卡片：白底、16px 圆角、很柔的暖色阴影 + 一圈极淡的暖边（参考图），左图右文 */
.card { margin-top: 12px; display: flex; align-items: flex-start; gap: 12px; padding: 12px; border-radius: 16px; background: var(--k-paper); box-shadow: 0 8px 24px rgba(120, 84, 48, .10), 0 0 0 1px rgba(160, 120, 80, .08); }
.card__left { position: relative; flex: 0 0 auto; display: flex; flex-direction: column; align-items: flex-start; gap: 8px; }
.card__img { border-radius: 14px; display: block; background: var(--k-paper2); }
/* 角标的裁剪容器；大图中的45°布局见 list-premium.scss。 */
.card__badge { position: absolute; left: 0; right: 0; top: 14px; z-index: 1; }
.card__main { flex: 1; min-width: 0; }
.card__head { display: flex; align-items: flex-start; justify-content: space-between; gap: 8px; }
.head--stack { flex-direction: column; align-items: flex-start; gap: 4px; }
.title { flex: 1; min-width: 0; font-weight: 700; font-size: 17px; line-height: 1.38; letter-spacing: .5px; color: #3B2A1E; display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 2; overflow: hidden; }
.head--stack .title { width: 100%; }
.title--sm { font-size: 15px; }
.price { display: flex; align-items: baseline; gap: 1px; flex: 0 0 auto; max-width: 100%; color: var(--k-red); }
.price__num { font-family: var(--k-display-font); white-space: nowrap; font-weight: 700; font-size: 18px; line-height: 1.2; color: #A0632E; }
.price__unit { font-size: 11px; font-weight: 500; }
.remote { display: flex; align-items: center; gap: 3px; height: 22px; padding: 0 7px; border-radius: 6px; background: var(--k-green-soft); color: var(--k-green); font-size: 12px; }
.loc { display: flex; align-items: center; gap: 4px; margin-top: 6px; font-size: 12px; color: var(--k-muted); }
.loc--tiny { font-size: 11px; }
.loc__text { min-width: 0; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
/* 标签一行排齐：所有小标签同高 24px、同圆角 8px、同字号 12px，间距 6px，折行左对齐（2026-10-18 主人：一行排齐、不要大小不一）。
   10-19 参考图：关键词也是浅橙底 + 暖色细边、深棕粗字；状态：已暂停灰、名额已满提醒红；满月红包：浅暖底棕字带小礼物 */
.tags { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 9px; }
.tag { max-width: 100%; height: 24px; box-sizing: border-box; padding: 0 8px; border-radius: 8px; box-shadow: none; background: #F7F2EA; color: #6B5542; font-size: 12px; font-weight: 500; display: flex; align-items: center; gap: 3px; white-space: nowrap; overflow: hidden; }
.tag--muted { box-shadow: none; background: #EEEAE4; color: var(--k-muted); }
.tag--alert { box-shadow: none; background: var(--k-alert-soft); color: var(--k-alert); font-weight: 600; }
.tag--gift { box-shadow: inset 0 0 0 1px #EFD3B3; background: #FFF6EC; color: #A0632E; font-weight: 700; }
/* 条件：浅橙底 + 暖色细边，前面一个橙色实心小对勾（参考图）；绿色的是安心商家 / 含保险 */
.cond { max-width: 100%; height: 24px; box-sizing: border-box; padding: 0 8px 0 4px; border-radius: 8px; background: #F7F2EA; box-shadow: none; display: flex; align-items: center; gap: 4px; font-size: 12px; font-weight: 700; color: #5A3A22; white-space: nowrap; }
.cond__dot { flex: 0 0 auto; width: 15px; height: 15px; border-radius: 50%; background: linear-gradient(135deg, #F0A35A 0%, #DB8233 100%); display: flex; align-items: center; justify-content: center; }
.cond__text { min-width: 0; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
.cond--green { background: #EEF6EA; box-shadow: inset 0 0 0 1px #CDE3C3; color: #3F6B33; }
.cond--green .cond__dot { background: linear-gradient(135deg, #6DBA6A 0%, #3F8F4A 100%); }
.meta { display: flex; flex-wrap: wrap; align-items: center; gap: 4px 10px; margin-top: 8px; font-size: 12px; color: var(--k-muted); }
.meta--text { color: var(--k-muted); font-size: 12px; }
.meta__item { display: flex; align-items: center; gap: 4px; }
.meta__time { margin-left: 4px; }
.list-end { display: block; padding: 14px 0 4px; text-align: center; font-size: 12px; color: var(--k-light); }
.city-tags { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; margin: -4px 0 10px; }
.city-tag { display: flex; align-items: center; gap: 5px; min-height: 34px; max-width: 100%; padding: 0 9px; border: 1px solid #E5CEB3; border-radius: 10px; background: #F8EDDD; color: #84572D; font-size: 12px; box-sizing: border-box; }
.city-tag text { min-width: 0; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
.city-tags__reset { display: flex; align-items: center; min-height: 36px; padding: 0 4px; color: var(--k-muted); font-size: 12px; }
.filter-summary { display: flex; align-items: center; justify-content: space-between; color: var(--k-muted); font-size: 12px; }
.filter-summary view { min-height: 36px; display: flex; align-items: center; color: var(--k-red-deep); }
@import "list-premium.scss";
</style>
