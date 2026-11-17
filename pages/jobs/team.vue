<template>
  <!-- #ifdef MP-WEIXIN -->
  <page-meta :page-style="aiOpen ? 'overflow: hidden' : ''" />
  <!-- page-meta 必须是页面第一个节点：AI袋鼠弹层开着时锁住页面滚动（网页版由弹层自己锁 body） -->
  <!-- #endif -->
  <k-feature-gate feature="recruitment">
<k-feature-gate feature="private-chat">
  <view class="k-page team-page">
    <k-topbar :title="titles[s - 1]" back custom-back @back="onBack" />
    <view v-if="entryError" class="tm-card tm-entry-error"><text class="tm-card__title">岗位暂不可用</text><text class="tm-entry-error__copy">{{ entryError }}</text><k-button v-if="jobId" block type="outline" @click="retryEntry">重新加载</k-button><k-button block @click="openJobList">查看其他岗位</k-button></view>
    <!-- 寻伴同行：插画、关联岗位卡、四种分享方式。岗位及核验信息来自当前岗位。 -->
    <view v-else-if="s === 1" class="tm k-pad-tab">
      <view class="tm-hero">
        <view class="tm-sticker tm-sticker--pack"><k-icon name="backpack" :size="22" color="#C9782E" :stroke="2" /></view>
        <view class="tm-sticker tm-sticker--beer"><k-icon name="beer" :size="21" color="#C9782E" :stroke="2" /></view>
        <view class="tm-hero__copy">
          <text class="tm-hero__title" :class="{ 'tm-hero__title--long': (head.line1 + head.line2).length > 15 }">{{ head.line1 }}{{ head.line2 }}</text>
          <text class="tm-hero__sub">{{ TEAM_SUBTITLE }}</text>
        </view>
        <image class="tm-hero__scene" src="/pages/jobs/static/companion-coast-v2.jpg" mode="aspectFill" />
        <view class="tm-hero__fade" />
      </view>

      <!-- 岗位卡：封面、标题｜城市、「袋鼠实地探访·含保险」小胶囊（真有才挂）、门店；右上角小分享钮（小程序直接转发卡片，网页版复制链接） -->
      <view class="tm-job" hover-class="k-press-s" @click="openJob">
        <image class="tm-job__img" :src="jobImg" mode="aspectFill" />
        <view class="tm-job__main">
          <view class="tm-job__head"><text class="tm-job__title k-display">{{ displayWording(job.title, [job.storeName]) || '岗位' }}</text><text v-if="cityShort" class="tm-job__city">｜{{ cityShort }}</text></view>
          <view v-if="badgeText" class="tm-job__chip"><image class="tm-job__chip-icon" src="/static/media/brand-kangaroo.png" mode="aspectFit" /><text>{{ badgeText }}</text></view>
          <text v-if="jobMeta && !badgeText" class="tm-job__meta">{{ jobMeta }}</text>
        </view>
        <!-- #ifdef MP-WEIXIN -->
        <button class="tm-job__share" :open-type="jobReady ? 'share' : ''" :disabled="!jobReady" hover-class="k-press" @click.stop><k-icon name="share-2" :size="16" color="red" :stroke="2" /></button>
        <!-- #endif -->
        <!-- #ifndef MP-WEIXIN -->
        <view class="tm-job__share" hover-class="k-press" @click.stop="copyLink"><k-icon name="share-2" :size="16" color="red" :stroke="2" /></view>
        <!-- #endif -->
      </view>

      <!-- 选择分享方式：居中大标题；四张独立圆角卡（前两张浅橙渐变、后两张浅灰白），左边 48px 彩色圆图标、标题 + 小字、右边暖棕箭头；
           「微信好友 / 微信群」在小程序里是转发按钮（open-type=share），网页版复制链接 -->
      <view class="tm-ways">
        <text class="tm-ways__title">选择分享方式</text>
        <view class="tm-ways__panel">
        <button v-for="way in SHARE_WAYS.filter(item => communityEnabled || item.key !== 'community')" :key="way.key" class="tm-way" :open-type="jobReady && isMp && way.key === 'wechat' ? 'share' : ''" :disabled="!jobReady" hover-class="k-press-s" @click="tapWay(way.key)">
          <view class="tm-way__icon" :class="'tm-way__icon--' + way.tone"><k-icon :name="way.icon" :size="23" color="white" :stroke="2" :fill="way.icon === 'wechat'" /></view>
          <view class="tm-way__main"><text class="tm-way__title">{{ way.title }}</text><text class="tm-way__desc">{{ way.desc }}</text></view>
          <k-icon name="arrow-right" :size="20" color="#9A6B3F" :stroke="2.2" />
        </button>
        </view>
      </view>

      <view class="tm-safe"><k-icon name="shield-check" :size="16" color="#C9782E" :stroke="2" /><text v-for="(safeText, si) in TEAM_SAFETY" :key="safeText" class="tm-safe__item" :class="{ 'tm-safe__item--sep': si > 0 }">{{ safeText }}</text></view>

      <!-- 不论是否报名，都先进入独立的同行伙伴页；加入与退出由伙伴页处理。 -->
      <view v-if="teamLoaded" class="tm-cta" role="button" aria-label="查看同行伙伴" hover-class="k-press-s" @click="openCompanions"><view class="tm-cta__icon"><k-icon name="users" :size="22" color="red" :stroke="1.7" /></view><view class="tm-cta__copy"><view class="tm-cta__head"><text class="tm-cta__title">看看一起去的伙伴</text><text class="tm-cta__count">{{ companionCount }} 位</text></view><text class="tm-cta__text">{{ entryNotice }}</text></view><k-icon name="chevron-right" :size="17" color="red" /></view>
    </view>

    <view v-else-if="s === 3" class="poster-body k-pad-tab">
      <view class="poster-card"><image class="poster-hero" :src="jobImg" mode="aspectFill" /><view class="poster-benefits"><view v-for="item in posterBenefits" :key="item.label"><k-icon :name="item.icon" :size="27" color="ochre" /><text>{{ item.label }}</text></view></view><view class="poster-tags"><text class="poster-tags__title">岗位标签</text><view><k-chip v-for="item in posterTags" :key="item"><text>{{ item }}</text></k-chip></view></view><view class="poster-foot"><image v-if="false" src="/static/media/jobs-poster-qr.png" mode="aspectFit" /><view class="poster-foot__copy"><text>{{ displayWording(job.title, [job.storeName]) }}</text><text>微信搜索「袋鼠全球青年」查看</text></view><view class="poster-foot__brand"><text>来自 袋鼠全球青年</text><text>{{ posterId }}</text></view></view></view>
      <view class="poster-actions"><k-button block type="outline" @click="savePoster">保存图片</k-button><k-button block @click="shareTip">{{ isMp ? '转发给朋友' : '复制岗位链接' }}</k-button></view>
    </view>

    <view v-else class="shop-body k-pad-tab">
      <!-- 门店没传封面时不放「暂无图片」占位图，换成浅杏底 + 小店图标（和岗位详情门店卡同一个样子，10-19 复查） -->
      <view class="shop-head"><image v-if="store.cover" :src="shopImg" mode="aspectFill" /><view v-else class="shop-head__noimg"><k-icon name="store" :size="30" color="#B08A62" :stroke="1.5" /></view><view class="shop-head__main"><text class="shop-head__title">{{ store.storeName }}</text><text class="shop-head__place">{{ store.city }}</text><view class="shop-head__chips"><k-chip v-if="String(store.safeCert) === '0'" tone="green"><text>安心商家</text></k-chip><k-chip v-if="false" tone="ochre"><text></text></k-chip></view><text class="shop-head__meta">{{ shopMeta }}</text></view></view>
      <view class="ai-summary"><view class="ai-summary__copy"><view><view class="ai-mark"><text>统计</text></view><text class="block-title">评价概况</text></view><text>{{ shopSummary }}</text></view><view class="score"><text>{{ avg }}</text><text>{{ ratingStars }}</text><text>{{ scoreLabel }}</text></view></view>
      <view class="score-panels"><view class="distribution"><text class="block-title">评分分布</text><view v-for="row in scoreRows" :key="row.star" class="score-row"><text>{{ row.star }}星</text><view><view :style="{ width: row.width }" /></view><text>{{ row.percent }}</text></view></view><view class="filters"><text class="block-title">评价筛选</text><view><text v-for="(item,i) in reviewFilters" :key="item" :class="{ active: rfilter === item }" @click="setFilter(item)">{{ item }}</text></view></view></view>
      <view class="review-sort"><view @click="toggleSort"><text>{{ sortLabel }}</text><k-icon name="chevron-down" :size="15" color="ink" /></view><view @click="pickReviewTime"><text>{{ timeLabel }}</text><k-icon name="chevron-down" :size="15" color="ink" /></view></view>
      <view v-for="(r, ri) in reviews" :key="ri" class="shop-review"><view class="shop-review__head"><image :src="r.avatar" mode="aspectFill" /><view><view><text class="shop-review__name">{{ r.name || '伙伴' }}</text><k-chip v-if="r.tag"><text>{{ r.tag }}</text></k-chip></view><text class="shop-review__stars">{{ r.stars }}</text></view><text class="shop-review__date">{{ r.date }}</text></view><text class="shop-review__copy">{{ r.content }}</text><view v-if="r.photoCount" class="shop-review__photos"><image v-for="item in r.photos" :key="item" :src="item" mode="aspectFill" /><view><text>共{{ r.photoCount }}张</text></view></view><view v-if="r.reply" class="reply"><view><text>主理人回复</text><text>{{ r.replyDate }}</text></view><text>{{ r.reply }}</text></view></view>
      <text v-if="shopLoaded && !reviews.length" class="reviews-empty">{{ rfilter === '全部' && !reviewDays ? '这家店还没有评价' : '没有符合筛选条件的评价' }}</text><view class="shop-actions"><k-button type="outline" icon="bell-ring" :disabled="reminding" @click="remindVacancy">这家店缺人了提醒我</k-button><k-button icon="phone" @click="contact">联系客服</k-button></view>
    </view>
    <k-tabbar active="" />
    <!-- 「联系客服」：AI袋鼠在本页底部弹出，不跳页 -->
    <k-ai-sheet :show="aiOpen" ctx="city" @close="aiOpen = false" />
  </view>
</k-feature-gate>
  </k-feature-gate>
</template>

<script setup>
import { communityEnabled } from "@/common/features.js"
import { displayWording } from '@/common/display-wording.js'
// ---------------------------------------------------------------------------
// 寻伴同行（?jobId= 必带；?storeId= 直达门店评价）：
//   s=1 寻伴同行（2026-10-18 主人按效果图重做，原「同行队伍」+「找人一起去」两屏合成一屏）：
//       暖色插画区 → 岗位卡 → 选择分享方式 → 安全提示 → 独立同行伙伴页入口。
//       同行伙伴只展示主动加入的人，查看、加入、退出及私信都在 companions 页完成。
//   s=2 旧链接里的「找人一起去」分享屏：并进 s=1
//   s=3 分享海报：本机画布生成（没有小程序码：需要 AppSecret 生成，不放假二维码）
//   s=4 门店评价：真实评价的平均分、分布、筛选与排序；"这家店缺人了提醒我" = 订阅这家店的新岗位
// ---------------------------------------------------------------------------
import { ref, computed } from 'vue'
import { onShow, onShareAppMessage, onReachBottom } from '@dcloudio/uni-app'
import { useScreen, go, back, toast } from '@/common/screen.js'
import { apiJobTeam, apiStoreReviews, apiAddJobSub, apiJobDetail } from '@/common/api.js'
import { ensureSession } from '@/common/experience.js'
import { errText, sheet, modal, copy } from '@/common/ui.js'
import { savePosterImage } from '@/common/poster.js'
import { absUrl } from '@/common/upload.js'
import R from '@/common/routes.js'
import { teamHeadline, TEAM_SUBTITLE, TEAM_SAFETY, SHARE_WAYS, jobPath, shareCopyText, buddyPublishQuery, teamEntryNotice } from './team-page.js'
import { interviewMode, heroVariant, scoreText } from './store-page.js'
import { companionMembers } from './companions-page.js'
const aiOpen = ref(false)

let isMp = false
// #ifdef MP-WEIXIN
isMp = true
// #endif

const jobId = ref(0)
const storeId = ref(0)
const entryError = ref('')
const positiveId = value => Number.isSafeInteger(Number(value)) && Number(value) > 0 ? Number(value) : 0
const s = useScreen(4, {
  onLoad: async (q) => {
    jobId.value = positiveId(q?.jobId)
    storeId.value = positiveId(q?.storeId)
    reviewStayId.value = Number(q?.stayId) || undefined
    if (reviewFilters.includes(q?.filter)) rfilter.value = q.filter
    const shopOnly = !!storeId.value && !jobId.value
    // 旧链接的 s=2（找人一起去）并进了寻伴同行这一屏
    if (s.value === 2) s.value = 1
    landing = shopOnly ? 4 : s.value
    if (!jobId.value && !shopOnly) { entryError.value = '缺少有效岗位信息，请从岗位列表重新进入'; return }
    await ensureSession()
    if (jobId.value) { loadJobInfo(); await loadTeam() }
    if (s.value === 4 || shopOnly) openShop()
  }
})
const titles = ['寻伴同行', '寻伴同行', '分享海报', '商家评价']
// 寻伴同行 → 海报是点进来的：左上角返回先退回进页时那一屏
let landing = 0
const onBack = () => { if (landing && s.value > landing && s.value <= 3) s.value = landing; else back() }
const t = ref({ job: {}, members: [], longAvatars: [] })
const teamLoaded = ref(false)
// 点「去报名」、报完回来，同行队伍那一块要出来：回到本页就重读
onShow(() => { if (teamLoaded.value && jobId.value) loadTeam() })
async function loadTeam() {
  try {
    const data = (await apiJobTeam(jobId.value)).data
    if (!data?.job || positiveId(data.job.jobId) !== jobId.value) throw new Error('岗位不存在或已下架')
    t.value = data
    entryError.value = ''
    teamLoaded.value = true
    if (!storeId.value) storeId.value = t.value.job.storeId
  } catch (e) {
    teamLoaded.value = false
    t.value = { job: {}, members: [], longAvatars: [] }
    entryError.value = errText(e, '岗位信息加载失败，请重试')
  }
}
const retryEntry = () => { loadJobInfo(); return loadTeam() }
const openJobList = () => go(R.jobsList)
// 岗位详情：只用来判断挂不挂「袋鼠实地探访·含保险」小胶囊（同行接口里没有认证 / 保险 / 采访方式）、拿第一张照片；取不到就不挂
const info = ref(null)
async function loadJobInfo() {
  try { info.value = (await apiJobDetail(jobId.value)).data || null } catch (e) { info.value = null }
}
const BADGE_TEXT = { assured: '袋鼠实地探访·含保险', onsite: '袋鼠实地探访', online: '袋鼠线上采访' }
const badgeText = computed(() => {
  const d = info.value
  if (!d || d.jobType === 'online') return ''
  const certified = String(d.store && d.store.safeCert != null ? d.store.safeCert : d.safeCert) === '0'
  const mode = interviewMode({ isOnline: false, storePage: d.storePage, safeCertified: certified })
  return BADGE_TEXT[heroVariant({ isOnline: false, mode, insured: String(d.insuranceFlag) === '0' })] || ''
})
const job = computed(() => t.value.job || {})
const jobReady = computed(() => !entryError.value && teamLoaded.value && positiveId(job.value.jobId) === jobId.value)
const companionCount = computed(() => companionMembers(t.value).length)
const entryNotice = computed(() => t.value.joined ? '你已加入同行，看看伙伴们的出发计划' : t.value.myAppId ? '你已报名，加入同行后让伙伴认识你' : teamEntryNotice(job.value, info.value, t.value.remaining))
const requireJob = () => {
  if (jobReady.value) return true
  toast(entryError.value || '岗位信息加载中，请稍后再试')
  return false
}
const jobImg = computed(() => {
  const first = info.value && Array.isArray(info.value.images) && info.value.images[0]
  return absUrl(first || job.value.cover) || '/static/media/cover-empty.png'
})
const cityShort = computed(() => String(job.value.city || '').split('·')[0])
const head = computed(() => teamHeadline(job.value.jobType || (info.value && info.value.jobType), cityShort.value))
const TYPE = { volunteer: '换宿旅行', parttime: '兼职旅行', fulltime: '全职旅行', online: '线上任务' }
const jobMeta = computed(() => [TYPE[job.value.jobType], job.value.storeName].filter(Boolean).join(' · '))
const openJob = () => { if (requireJob()) go(R.jobDetail + '?jobId=' + jobId.value) }
const openCompanions = () => { if (requireJob()) go(R.jobCompanions + '?jobId=' + jobId.value) }

// ---------------- 选择分享方式 ----------------
function tapWay(key) {
  if (!requireJob()) return
  if (key === 'community') return go(R.publish + '?' + buddyPublishQuery({ jobId: jobId.value, title: job.value.title, city: cityShort.value }))
  // 小程序里这一行本身就是转发按钮（open-type=share），点了微信自己弹转发面板；网页版没有转发，复制链接
  if (key === 'wechat') return isMp ? undefined : copyLink()
  if (key === 'moments') { s.value = 3; return }
  if (key === 'link') return copyLink()
}
function copyLink() {
  if (!requireJob()) return
  let href = ''
  // #ifdef H5
  href = window.location.href
  // #endif
  copy(shareCopyText({ title: job.value.title, city: cityShort.value, jobId: jobId.value, href }), '岗位链接已复制')
}

// ---------------- s=3 海报 ----------------
const posterBenefits = computed(() => {
  const b = []
  if (job.value.boardType === 'all') b.push({ icon: 'bed-double', label: '包吃包住' })
  else if (job.value.boardType === 'room') b.push({ icon: 'bed-double', label: '提供住宿' })
  b.push({ icon: 'smile', label: TYPE[job.value.jobType] || '岗位' })
  if (job.value.city) b.push({ icon: 'notebook-pen', label: cityShort.value })
  return b
})
const posterTags = computed(() => String(job.value.tags || '').split(',').filter(Boolean).slice(0, 4))
const posterId = computed(() => `岗位编号 ${jobId.value || '—'}`)
async function savePoster() {
  if (!requireJob()) return
  try {
    await savePosterImage({ cover: jobImg.value, title: displayWording(job.value.title, [job.value.storeName]), summary: [head.value.line1 + head.value.line2, TEAM_SUBTITLE].join(' · '), code: '' })
    toast('海报已保存，可以发朋友圈招募搭子了')
  } catch (e) {
    toast(errText(e, '海报保存失败'))
  }
}
const shareTip = () => (isMp ? toast('点右上角「···」可以转发给朋友') : copyLink())

// ---------------- s=4 门店评价 ----------------
const shop = ref({ store: {}, rows: [], list: [] })
const shopLoaded = ref(false)
const rfilter = ref('全部')
const sort = ref('new')
const reviewStayId = ref()
const reviewDays = ref(0)
const reviewPage = ref(1)
let reviewRequest = 0
let reviewLoading = false
const TIME_OPTIONS = [{ label: '全部时间', days: 0 }, { label: '近30天', days: 30 }, { label: '近90天', days: 90 }, { label: '近一年', days: 365 }]
const timeLabel = computed(() => TIME_OPTIONS.find(t => t.days === reviewDays.value).label)
async function pickReviewTime() {
  const i = await sheet(TIME_OPTIONS.map(t => t.label))
  if (i < 0) return
  reviewDays.value = TIME_OPTIONS[i].days
  openShop()
}
async function openShop(append = false) {
  if (!storeId.value) return toast('缺少门店信息')
  if (append && (reviewLoading || !shop.value.hasMore)) return
  const request = ++reviewRequest
  const pageNum = append ? reviewPage.value + 1 : 1
  reviewLoading = true
  try {
    const data = (await apiStoreReviews(storeId.value, { filter: rfilter.value === '全部' ? undefined : rfilter.value, sort: sort.value, days: reviewDays.value, pageNum, stayId: reviewStayId.value })).data
    if (request !== reviewRequest) return
    shop.value = append ? { ...data, list: [...shop.value.list, ...data.list] } : data
    reviewPage.value = pageNum
    shopLoaded.value = true
    s.value = 4
  } catch (e) {
    if (request === reviewRequest) toast(errText(e, '评价加载失败'))
  } finally {
    if (request === reviewRequest) reviewLoading = false
  }
}
onReachBottom(() => { if (s.value === 4) openShop(true) })
// 2026-10-19 加「全职」：岗位详情「用户反馈」按同类岗位筛（换宿 → 换工、兼职 → 兼职、全职 → 全职），点「查看全部」进来带同一个筛选；两列正好排满三行
const reviewFilters = ['全部', '换工', '兼职', '全职', '住宿', '有图']
const setFilter = (item) => { rfilter.value = item; openShop() }
const toggleSort = () => { sort.value = sort.value === 'new' ? 'high' : 'new'; openShop() }
const sortLabel = computed(() => (sort.value === 'new' ? '最新评价' : '评分最高'))
const store = computed(() => shop.value.store || {})
const shopImg = computed(() => (store.value.cover ? absUrl(store.value.cover) : '/static/media/cover-empty.png'))
const shopMeta = computed(() => `在招岗位 ${shop.value.jobs || 0} · 累计评价 ${shop.value.count || 0}`)
// 顶上的分、星、评分分布、概况那句话都按当前筛选这一批评价算（服务端 filteredAvg / filteredRows / filteredSummary，2026-10-19）：
// 从岗位详情「用户反馈」点进来是同类岗位那一批，两边写同一个数；没筛选时就是全店。老服务端没有这几项时退回全店的
const shownAvg = computed(() => (shop.value.filteredAvg !== undefined ? shop.value.filteredAvg : shop.value.avg))
const ratingStars = computed(() => { const n = Math.max(0, Math.min(5, Math.round(Number(shownAvg.value) || 0))); return '★'.repeat(n) + '☆'.repeat(5 - n) })
// 评分写一位小数（4 →「4.0」），和岗位详情「用户反馈」、门店卡片同一个写法（store-page.scoreText）：之前这里写「4」、详情写「4.0」
const avg = computed(() => scoreText(shownAvg.value) || '—')
const scoreRows = computed(() => shop.value.filteredRows || shop.value.rows || [])
const shopSummary = computed(() => shop.value.filteredSummary || shop.value.summary || '')
const scoreLabel = computed(() => (rfilter.value === '全部' && !reviewDays.value && !reviewStayId.value ? '综合评分' : '筛选后评分'))
const reviews = computed(() => (shop.value.list || []).map((r, i) => ({
  ...r, avatar: r.avatar ? absUrl(r.avatar) : '/static/media/profile-avatar.jpg', stars: '★'.repeat(Number(r.rating || 0)) + ' ' + Number(r.rating || 0).toFixed(1),
  photos: (r.images || []).filter(Boolean).slice(0, 3).map(absUrl), photoCount: (r.images || []).filter(Boolean).length
})))
// 连点会建两条一样的订阅：请求返回前锁住按钮
const reminding = ref(false)
async function remindVacancy() {
  if (reminding.value) return
  reminding.value = true
  try {
    const d = (await apiAddJobSub({ storeId: storeId.value, freq: 'instant' })).data
    toast((d && d.message) || '订阅已保存，这家店上新会通知你')
  } catch (e) {
    // 游客订阅：之前只弹「未登录或登录已失效」，没有登录入口。登录页压在本页上面，登录完自动回到这里
    if (e && e.code === 401) {
      // 同步标上 loginHandled，request.js 就不再弹通用登录框：否则它会顶掉下面这个框，这里的 await 永远不回来，按钮一直锁着
      e.loginHandled = true
      if ((await modal('请先登录', '订阅这家店的上新提醒需要先登录，登录后会回到这里。', { confirmText: '去登录', cancelText: '再看看' })).confirm) go(R.login)
      return
    }
    toast(errText(e, '设置失败'))
  } finally {
    reminding.value = false
  }
}
// 「联系客服」：AI袋鼠在本页底部弹出（之前跳到城市页的客服屏）
const contact = () => { aiOpen.value = true }

// 转发卡片（右上角「···」、岗位卡的分享钮、「微信好友 / 微信群」那一行）：打开的是岗位详情，封面用岗位第一张照片
onShareAppMessage(() => jobReady.value ? ({ title: job.value.title ? '找个搭子一起去：' + displayWording(job.value.title, [job.value.storeName]) : '袋鼠全球青年 · 一起去旅居', path: jobPath(jobId.value), ...(jobImg.value.indexOf('/static/') === 0 ? {} : { imageUrl: jobImg.value }) }) : ({ title: '袋鼠全球青年 · 旅行岗位', path: R.jobsList }))
</script>

<style scoped lang="scss">
.team-page { font-family: var(--k-sans); }
/* ---------------- 1 寻伴同行（2026-10-18；10-19 按参考图一比一还原）：暖杏渐变插画区 + 贴纸 + 超粗两行标题 + 手绘小场景（svg），
   岗位卡压在插画下沿，分享方式是四张独立圆角卡 ---------------- */
.tm { padding: 0 0 calc(92px + var(--k-safe-bottom)); }
.tm-hero { position: relative; height: 318px; overflow: hidden; background: linear-gradient(180deg, #FBEBD6 0%, #F8E0C2 55%, #F3D3AE 100%); }
/* 插画下面压着岗位卡：场景整体抬高 30px，下面接一截同色的沙地，小人和路牌不被卡片挡住 */
.tm-hero__ground { position: absolute; left: 0; right: 0; bottom: 0; height: 32px; background: #EBC495; }
.tm-hero__sun { position: absolute; right: 70px; top: 26px; width: 96px; height: 96px; border-radius: 50%; background: radial-gradient(circle, rgba(255, 249, 236, .95) 0%, rgba(255, 240, 214, .5) 55%, rgba(255, 240, 214, 0) 72%); }
/* 贴纸：白底圆 + 白色粗描边 + 轻阴影，微微歪一点 */
.tm-sticker { position: absolute; z-index: 1; width: 42px; height: 42px; border-radius: 50%; background: #FFF8EE; border: 3px solid #FFFFFF; box-shadow: 0 4px 10px rgba(138, 94, 54, .2); display: flex; align-items: center; justify-content: center; box-sizing: border-box; }
.tm-sticker--pack { left: 16px; top: 14px; transform: rotate(-10deg); }
.tm-sticker--beer { right: 18px; top: 18px; transform: rotate(12deg); }
.tm-hero__roo { position: absolute; z-index: 1; right: 18px; top: 92px; width: 70px; height: 70px; border-radius: 50%; background: rgba(255, 255, 255, .7); border: 3px solid #FFFFFF; box-shadow: 0 6px 16px rgba(138, 94, 54, .18); display: flex; align-items: center; justify-content: center; box-sizing: border-box; }
.tm-hero__roo-img { width: 46px; height: 50px; }
.tm-hero__copy { position: absolute; z-index: 1; left: 20px; top: 64px; right: 96px; display: flex; flex-direction: column; }
/* 两行超粗大标题（参考图）：用标题字体 900 */
.tm-hero__t1, .tm-hero__t2 { font-family: var(--k-display-font); font-size: 27px; font-weight: 900; line-height: 1.3; letter-spacing: 1px; color: #3B2A1E; }
.tm-hero__sub { margin-top: 8px; font-size: 14px; font-weight: 500; line-height: 1.5; color: #7A5A3E; }
.tm-hero__scene { position: absolute; left: 0; right: 0; bottom: 30px; width: 100%; height: auto; }
@media (max-width: 359px) { .tm-hero__t1, .tm-hero__t2 { font-size: 23px; } .tm-hero__copy { right: 84px; } .tm-hero__roo { width: 60px; height: 60px; } }
/* 岗位卡：叠在插画区下沿 */
.tm-job { position: relative; z-index: 2; margin: -40px 16px 0; padding: 12px; border-radius: 18px; background: var(--k-paper); box-shadow: 0 8px 24px rgba(120, 84, 48, .14), 0 0 0 1px rgba(160, 120, 80, .08); display: flex; gap: 12px; }
.tm-job__img { flex: 0 0 auto; width: 76px; height: 76px; border-radius: 14px; background: var(--k-paper2); }
.tm-job__main { flex: 1; min-width: 0; padding-right: 30px; display: flex; flex-direction: column; justify-content: center; gap: 6px; }
.tm-job__head { display: flex; align-items: baseline; min-width: 0; }
.tm-job__title { min-width: 0; font-size: 17px; font-weight: 700; line-height: 1.35; color: #3B2A1E; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
.tm-job__city { flex: 0 0 auto; font-size: 14px; font-weight: 600; color: #5A4636; }
.tm-job__chip { align-self: flex-start; height: 24px; padding: 0 10px 0 5px; border-radius: 12px; background: linear-gradient(135deg, #FDF0E0 0%, #F9E2C6 100%); box-shadow: inset 0 0 0 1px rgba(201, 147, 95, .45); display: flex; align-items: center; gap: 3px; font-size: 12px; font-weight: 700; color: #8A5A30; white-space: nowrap; }
.tm-job__chip-icon { width: 14px; height: 15px; }
.tm-job__meta { font-size: 12px; color: var(--k-muted); overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
.tm-job .tm-job__share { position: absolute; right: 10px; top: 10px; width: 32px; height: 32px; border-radius: 50%; background: #FCEBD8; display: flex; align-items: center; justify-content: center; }
/* 白卡：同行队伍 */
.tm-card { margin: 14px 16px 0; padding: 14px 16px 6px; border-radius: 18px; background: var(--k-paper); box-shadow: 0 8px 24px rgba(120, 84, 48, .08), 0 0 0 1px rgba(160, 120, 80, .08); }
.tm-card__title { display: block; font-family: var(--k-display-font); font-size: 17px; font-weight: 700; color: #3B2A1E; }
.tm-entry-error { display: flex; flex-direction: column; gap: 12px; padding-bottom: 16px; }
.tm-entry-error__copy { font-size: 13px; line-height: 1.7; color: var(--k-ink2); }
/* 选择分享方式：居中大标题 + 四张独立圆角卡 */
.tm-ways { margin: 22px 16px 0; }
.tm-ways__title { display: block; margin-bottom: 4px; text-align: center; font-family: var(--k-display-font); font-size: 21px; font-weight: 900; letter-spacing: 1px; color: #3B2A1E; }
/* 四行都是 button（小程序里「微信好友」那一行要 open-type=share）：把按钮自带的灰底、边框、内边距、行高都去掉，看着和普通卡一样 */
.tm-way, .tm-job__share { margin: 0; padding: 0; line-height: normal; font-size: inherit; color: inherit; background: transparent; border: 0; border-radius: 0; }
.tm-way::after, .tm-job__share::after { display: none; border: 0; }
.tm-ways .tm-way { width: 100%; margin-top: 10px; min-height: 76px; padding: 0 16px 0 14px; border-radius: 18px; display: flex; align-items: center; gap: 14px; text-align: left; box-sizing: border-box; background: #FAF8F5; box-shadow: 0 4px 14px rgba(120, 84, 48, .06), inset 0 0 0 1px rgba(160, 120, 80, .12); }
.tm-ways .tm-way:nth-child(2), .tm-ways .tm-way:nth-child(3) { background: linear-gradient(135deg, #FFF3E5 0%, #FBE3C9 100%); box-shadow: 0 4px 14px rgba(224, 126, 46, .1), inset 0 0 0 1px rgba(224, 160, 100, .28); }
.tm-way__icon { flex: 0 0 auto; width: 48px; height: 48px; border-radius: 50%; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 10px rgba(58, 50, 43, .14); }
.tm-way__icon--orange { background: linear-gradient(135deg, #F8B66C 0%, #E9822F 100%); }
.tm-way__icon--wechat { background: linear-gradient(135deg, #3FCB6E 0%, #12A84F 100%); }
.tm-way__icon--blue { background: linear-gradient(135deg, #7DB4EE 0%, #3F7FD0 100%); }
.tm-way__icon--pink { background: linear-gradient(135deg, #F9A98A 0%, #EC6F5A 100%); }
.tm-way__main { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 3px; }
.tm-way__title { font-family: var(--k-display-font); font-size: 18px; font-weight: 700; line-height: 1.35; color: #3B2A1E; }
.tm-way__desc { font-size: 13px; line-height: 1.4; color: #8A817A; }
/* 安全提示：一条浅橙底圆角条，盾牌 + 三句 */
.tm-safe { margin: 16px 16px 0; min-height: 40px; padding: 8px 12px; border-radius: 14px; background: linear-gradient(90deg, #FDEFDF 0%, #FBE6CF 100%); display: flex; align-items: center; justify-content: center; flex-wrap: wrap; gap: 2px 0; font-size: 12px; font-weight: 600; color: #8A5A30; }
.tm-safe__item { white-space: nowrap; margin-left: 5px; }
.tm-safe__item--sep { margin-left: 8px; padding-left: 8px; border-left: 1px solid rgba(138, 90, 48, .3); }
/* 同行伙伴的独立页面入口 */
.tm-cta { margin: 14px 16px 0; min-height: 72px; padding: 14px; border-radius: 16px; border: 1px solid var(--k-line); background: var(--k-paper); display: flex; align-items: center; gap: 12px; }
.tm-cta__icon { flex: 0 0 42px; width: 42px; height: 42px; border-radius: 14px; background: var(--k-paper2); display: flex; align-items: center; justify-content: center; }
.tm-cta__copy { flex: 1; min-width: 0; }
.tm-cta__head { display: flex; flex-wrap: wrap; align-items: center; gap: 5px 8px; }
.tm-cta__title { font-size: 15px; font-weight: 650; }
.tm-cta__count { font-size: 12px; color: var(--k-red-deep); }
.tm-cta__text { display: block; margin-top: 5px; font-size: 12px; line-height: 1.6; color: var(--k-muted); }
/* ---------------- 3 海报 / 4 商家评价（样式沿用，卡片换成白卡 + 柔和阴影） ---------------- */
.poster-body,.shop-body { padding: 10px 14px calc(92px + var(--k-safe-bottom)); }
.poster-card,.shop-head,.ai-summary,.score-panels,.shop-review { border-radius: 16px; background: var(--k-paper); box-shadow: 0 6px 20px rgba(58, 50, 43, .08); }
.block-title { font-size: 16px; font-weight: 700; }
.poster-body { padding-top: 4px; }.poster-card { overflow: hidden; }.poster-hero { width: 100%; height: 241px; }.poster-benefits { height: 75px; display: flex; align-items: center; justify-content: space-around; }.poster-benefits view { width: 30%; display: flex; flex-direction: column; align-items: center; gap: 7px; font-size: 13px; }.poster-tags { padding: 12px 18px 15px; }.poster-tags__title { display: block; font-size: 15px; font-weight: 700; margin-bottom: 9px; }.poster-tags>view { display: flex; justify-content: space-between; }.poster-foot { border-top: 1px dashed var(--k-line); padding: 14px 18px; display: flex; align-items: center; }.poster-foot image { width: 70px; height: 70px; }.poster-foot__copy,.poster-foot__brand { display: flex; flex-direction: column; gap: 5px; }.poster-foot__copy { margin-left: 14px; font-size: 13px; }.poster-foot__brand { margin-left: auto; text-align: right; color: var(--k-muted); font-size: 11px; }.poster-actions { margin-top: 18px; display: grid; grid-template-columns: 1fr 1.08fr; gap: 16px; }
.shop-body { padding: 8px 12px calc(164px + var(--k-safe-bottom)); }.shop-head { display: flex; border: 0; background: transparent; }.shop-head>image { width: 126px; height: 102px; border-radius: 10px; }.shop-head__noimg { flex: 0 0 126px; width: 126px; height: 102px; border-radius: 10px; background: #F3E9DD; display: flex; align-items: center; justify-content: center; }.shop-head__main { padding: 6px 0 0 14px; min-width: 0; }.shop-head__title { display: block; font-size: 20px; font-weight: 700; }.shop-head__place { display: block; color: var(--k-muted); font-size: 14px; margin-top: 2px; }.shop-head__chips { display: flex; gap: 8px; margin-top: 8px; }.shop-head__meta { display: block; margin-top: 7px; font-size: 12px; }
.ai-summary { margin-top: 10px; padding: 12px; display: flex; }.ai-summary__copy { flex: 1; padding-right: 10px; }.ai-summary__copy>view { display: flex; align-items: center; gap: 7px; }.ai-summary__copy>text { display: block; margin-top: 6px; color: var(--k-muted); font-size: 12px; line-height: 1.6; }.ai-mark { flex: 0 0 auto; height: 22px; padding: 0 6px; border-radius: 6px; background: var(--k-indigo); display: flex; align-items: center; justify-content: center; color: white; font-size: 12px; font-weight: 700; white-space: nowrap; }.score { width: 92px; border-left: 1px solid var(--k-line); display: flex; flex-direction: column; align-items: center; justify-content: center; }.score text:first-child { color: var(--k-red); font: 38px/1 var(--k-sans); }.score text:nth-child(2) { color: var(--k-ochre); font-size: 17px; letter-spacing: 1px; }.score text:last-child { color: var(--k-muted); font-size: 12px; }
.score-panels { margin-top: 8px; display: grid; grid-template-columns: 1.3fr 1fr; }.distribution,.filters { padding: 10px; }.distribution { border-right: 1px solid var(--k-line); }.score-row { display: grid; grid-template-columns: 27px 1fr 31px; gap: 5px; align-items: center; font-size: 11px; margin-top: 5px; }.score-row>view { height: 5px; border-radius: 3px; background: var(--k-line); overflow: hidden; }.score-row>view>view { height: 100%; border-radius: 3px; background: var(--k-red); }.filters>view { margin-top: 8px; display: grid; grid-template-columns: 1fr 1fr; gap: 7px; }.filters>view text { height: 30px; border: 1px solid var(--k-line); border-radius: 7px; display: flex; align-items: center; justify-content: center; font-size: 12px; }.filters>view text.active { border-color: var(--k-red); color: var(--k-red); }
.review-sort { margin: 8px 0; display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }.review-sort>view { height: 32px; border: 1px solid var(--k-line); border-radius: 15px; padding: 0 12px; display: flex; align-items: center; justify-content: space-between; font-size: 12px; }.shop-review { padding: 11px; }.shop-review__head { display: flex; align-items: flex-start; }.shop-review__head>image { width: 38px; height: 38px; border-radius: 50%; margin-right: 8px; }.shop-review__head>view>view { display: flex; align-items: center; gap: 5px; }.shop-review__name { font-weight: 700; }.shop-review__stars { display: block; margin-top: 3px; color: var(--k-ochre); font-size: 12px; }.shop-review__date { margin-left: auto; color: var(--k-muted); font-size: 10px; }.shop-review__copy { display: block; margin-top: 8px; font-size: 12px; line-height: 1.55; }.shop-review__photos { margin-top: 8px; display: grid; grid-template-columns: repeat(4,1fr); gap: 7px; }.shop-review__photos image,.shop-review__photos>view { width: 100%; height: 51px; border-radius: 7px; }.shop-review__photos>view { background: var(--k-line2); display: flex; align-items: center; justify-content: center; color: white; font-size: 12px; }.reply { margin-top: 8px; padding: 8px 10px; border-radius: 8px; background: var(--k-paper2); font-size: 11px; }.reply>view { display: flex; justify-content: space-between; margin-bottom: 3px; font-weight: 700; }.reply>view text:last-child { color: var(--k-muted); font-weight: 400; }.shop-actions { position: fixed; z-index: 45; left: 0; right: 0; bottom: calc(90px + var(--k-safe-bottom)); padding: 8px 12px; background: rgba(253,251,247,.96); border-top: 1px solid var(--k-line); display: grid; grid-template-columns: 1.15fr 1fr; gap: 10px; }
.reviews-empty { display: block; padding: 28px 0; text-align: center; color: var(--k-muted); font-size: 13px; }
@import "./team-reference.scss";
</style>
