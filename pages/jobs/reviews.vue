<template>
  <k-feature-gate feature="recruitment">
  <view class="jr-page">
    <k-topbar title="做过的伙伴评价" back bg="transparent" />
    <view class="jr-main">
      <view v-if="loadError" class="jr-state"><k-icon name="cloud-off" :size="32" color="#AA7C53" /><text>{{ loadError }}</text><button class="jr-retry" @click="reload">重新加载</button></view>
      <view v-else-if="!loaded" class="jr-state"><text>正在加载伙伴评价…</text></view>
      <template v-else>
        <view class="jr-summary">
          <view class="jr-stats">
            <view class="jr-stat"><text class="jr-number">{{ score(summary.avg) }}</text><view class="jr-rating-label"><text class="jr-label">综合评分</text><view class="jr-stars jr-stars--summary"><k-icon v-for="star in 5" :key="star" name="star" :size="9" :color="star <= Math.round(Number(summary.avg) || 0) ? '#E8964C' : '#E8DFD5'" fill /></view></view></view>
            <view class="jr-stat"><text class="jr-number">{{ summary.count || 0 }}</text><text class="jr-label">伙伴评价</text></view>
            <view class="jr-stat"><text class="jr-number">{{ summary.recommendRate == null ? '—' : summary.recommendRate }}<text v-if="summary.recommendRate != null" class="jr-percent">%</text></text><text class="jr-label">推荐率</text></view>
          </view>
          <view class="jr-dimensions"><view v-for="dim in dimensions" :key="dim.label" class="jr-dimension"><text>{{ dim.label }}</text><text class="jr-dimension__score">{{ score(dim.avg) }}</text></view></view>
        </view>
        <text v-if="summary.legacyDimensions" class="jr-legacy">历史评价的“吃住”分项沿用当时的住宿评分</text>

        <view class="jr-mentioned">
          <view class="jr-section-head"><text class="jr-heading">大家提到</text><text v-if="appId" class="jr-write" role="button" @click="writeReview">写评价 ›</text></view>
          <view v-if="summary.mentions && summary.mentions.length" class="jr-chips"><view v-for="item in summary.mentions" :key="item.label" class="jr-chip" :class="{ 'jr-chip--active': mention === item.label }" role="button" :aria-label="'筛选：' + item.label" @click="toggleMention(item.label)">{{ item.label }}<text class="jr-chip__count">{{ item.count }}</text></view></view>
          <text v-else class="jr-quiet">{{ summary.count ? '更多体验，藏在伙伴们的评价里' : '等一位体验过的伙伴，留下第一段分享' }}</text>
        </view>

        <view class="jr-toolbar">
          <view class="jr-tabs"><view v-for="item in tabs" :key="item.key" class="jr-tab" :class="{ 'jr-tab--active': tab === item.key }" role="button" @click="setTab(item.key)">{{ item.label }}</view></view>
          <view class="jr-filter" :class="{ 'jr-filter--active': days || sort !== 'latest' }" role="button" aria-label="筛选评价" @click="openFilter"><text>筛选{{ days || sort !== 'latest' ? ' ·' : '' }}</text><k-icon name="chevron-down" :size="12" color="#6A4934" /></view>
        </view>
        <view v-if="mention || days || sort !== 'latest'" class="jr-active"><text>{{ [mention, days ? '近 ' + days + ' 天' : '', sort === 'high' ? '评分从高到低' : sort === 'low' ? '评分从低到高' : ''].filter(Boolean).join(' · ') }}</text><text role="button" @click="clearFilters">清除筛选 ×</text></view>

        <view v-for="review in rows" :key="review.reviewId" class="jr-review">
          <view class="jr-review__head">
            <image v-if="review.avatar" class="jr-avatar" :src="absUrl(review.avatar)" mode="aspectFill" />
            <view v-else class="jr-avatar jr-avatar--empty"><k-icon name="user-round" :size="19" color="#AB8868" /></view>
            <view class="jr-identity"><view class="jr-name-row"><text class="jr-name">{{ review.name }}</text><text v-if="review.tag" class="jr-type">{{ review.tag }}</text></view><text class="jr-date">{{ review.date }}</text></view>
            <view class="jr-stars" :aria-label="review.rating + '星评价'"><k-icon v-for="star in 5" :key="star" name="star" :size="12" :color="star <= review.rating ? '#E8964C' : '#E8DFD5'" fill /></view>
          </view>
          <view class="jr-review__body">
            <text v-if="review.content" class="jr-content">{{ review.content }}</text><text v-else class="jr-content jr-content--empty">这位伙伴留下了评分，暂未填写文字。</text>
            <view v-if="review.video" class="jr-video" role="button" aria-label="播放评价视频" @click="playVideo(review.video)"><image v-if="review.video.cover" class="jr-video__cover" :src="absUrl(review.video.cover)" mode="aspectFill" /><view class="jr-video__play"><k-icon name="play" :size="24" color="white" fill /></view><text class="jr-video__caption">体验实拍</text></view>
            <view v-if="review.images && review.images.length" class="jr-photos"><image v-for="(src, photoIndex) in review.images.slice(0, 9)" :key="photoIndex" class="jr-photo" :src="absUrl(src)" mode="aspectFill" role="button" :aria-label="'查看评价照片 ' + (photoIndex + 1)" @click="previewImages(review, photoIndex)" /></view>
            <view class="jr-review__foot"><view class="jr-card-chips"><text v-for="label in review.chips || []" :key="label" class="jr-card-chip">{{ label }}</text></view><view class="jr-expand" role="button" :aria-label="review.expanded ? '收起分项评分' : '查看分项评分'" @click="review.expanded = !review.expanded"><text>{{ review.expanded ? '收起' : '分项' }}</text><k-icon :name="review.expanded ? 'chevron-up' : 'chevron-down'" :size="13" color="#A39586" /></view></view>
            <view v-if="review.expanded" class="jr-card-dims"><text v-if="Number(review.stayDays) > 0">体验 {{ review.stayDays }} 天</text><text v-for="dim in review.dims" :key="dim.label">{{ dim.label }} <text class="jr-dimension__score">{{ score(dim.avg) }}</text></text></view>
            <view v-if="review.reply" class="jr-reply"><text class="jr-reply__label">店家回复</text><text>{{ review.reply }}</text></view>
          </view>
        </view>
        <view v-if="listError" class="jr-state"><text>{{ listError }}</text><button class="jr-retry" @click="loadList(false)">重新加载评价</button></view>
        <view v-else-if="listLoading" class="jr-loading">正在加载评价…</view>
        <view v-else-if="!rows.length" class="jr-state jr-state--empty"><k-icon name="message-circle" :size="34" color="#B69A7F" /><text class="jr-empty-title">{{ summary.count ? '暂无符合条件的评价' : '还没有伙伴留下评价' }}</text><text class="jr-quiet">{{ summary.count ? '换个筛选，看看其他伙伴的体验吧' : '真实的工作与生活感受，值得被记录' }}</text><button v-if="summary.count" class="jr-retry" @click="clearFilters">查看全部评价</button></view>
        <view v-else class="jr-end" role="button" @click="loadList(true)">{{ hasMore ? '点击或上滑，查看更多评价' : '每一份真实分享，都值得认真看见' }}</view>
        <text class="jr-basis">基于真实岗位评价 · 推荐率按 4 星及以上评价统计</text>
      </template>
    </view>
    <k-tabbar active="home" theme="journal" />
    <view v-if="panelOpen" class="jr-mask" @click="panelOpen = false" @touchmove.stop.prevent="noop"><view class="jr-panel" @click.stop="noop"><view class="jr-panel__head"><text class="jr-heading">筛选评价</text><view role="button" aria-label="关闭筛选" @click="panelOpen = false"><k-icon name="x" :size="22" color="#684A35" /></view></view><text class="jr-panel__label">评价时间</text><view class="jr-options"><view v-for="span in [0, 30, 90, 365]" :key="span" class="jr-option" :class="{ 'jr-option--active': draftDays === span }" role="button" @click="draftDays = span">{{ span ? '近 ' + span + ' 天' : '不限时间' }}</view></view><text class="jr-panel__label">排列顺序</text><view class="jr-options"><view v-for="option in sorts" :key="option.key" class="jr-option" :class="{ 'jr-option--active': draftSort === option.key }" role="button" @click="draftSort = option.key">{{ option.label }}</view></view><view class="jr-panel__actions"><button class="jr-reset" @click="draftDays = 0; draftSort = 'latest'">重置</button><button class="jr-confirm" @click="applyFilter">确定</button></view></view></view>
    <view v-if="playing" class="jr-player" @touchmove.stop.prevent="noop"><view class="jr-player__close" role="button" aria-label="关闭视频" @click="playing = null"><k-icon name="x" :size="20" color="white" /><text>关闭</text></view><video class="jr-player__video" :src="absUrl(playing.url)" :poster="playing.cover ? absUrl(playing.cover) : ''" autoplay controls object-fit="contain" @error="videoError" /></view>
  </view>
  </k-feature-gate>
</template>

<script setup>
import { ref, computed } from 'vue'
import { onReachBottom, onPullDownRefresh, onHide, onShow } from '@dcloudio/uni-app'
import { useScreen, go, toast } from '@/common/screen.js'
import { get } from '@/common/request.js'
import { absUrl } from '@/common/upload.js'
import { errText } from '@/common/ui.js'
import { R } from '@/common/routes.js'

const summary = ref({}), loaded = ref(false), loadError = ref(''), rows = ref([]), listLoading = ref(false), listError = ref('')
const tab = ref('all'), mention = ref(''), days = ref(0), sort = ref('latest'), page = ref(1), hasMore = ref(false), appId = ref(0)
const panelOpen = ref(false), draftDays = ref(0), draftSort = ref('latest'), playing = ref(null)
const tabs = [{ key: 'all', label: '全部' }, { key: 'media', label: '有图 · 视频' }, { key: 'bad', label: '差评' }]
const sorts = [{ key: 'latest', label: '最新发布' }, { key: 'high', label: '评分从高到低' }, { key: 'low', label: '评分从低到高' }]
const dimensions = computed(() => ['位置', '氛围', '工作', '吃住'].map(label => (summary.value.dims || []).find(d => d.label === label) || { label, avg: null }))
const score = value => value == null || value === '' || !Number.isFinite(Number(value)) ? '—' : Number(value).toFixed(1)
const noop = () => {}
let storeId = 0, filter = '', sequence = 0, summarySequence = 0, hidden = false
const endpoint = () => '/app/stores/' + storeId + '/job-reviews'
useScreen(1, { onLoad(q) { storeId = Number(q.storeId); filter = q.filter || ''; appId.value = Number(q.appId) || 0; reload() } })
async function reload() {
  const ticket = ++summarySequence
  ++sequence
  if (!Number.isSafeInteger(storeId) || storeId <= 0) { loadError.value = '没有找到这家门店'; uni.stopPullDownRefresh(); return }
  loadError.value = ''
  try {
    const data = (await get(endpoint() + '/summary', { filter })).data || {}
    if (ticket !== summarySequence) return
    summary.value = data; loaded.value = true
    await loadList(false)
  } catch (e) { if (ticket === summarySequence) loadError.value = errText(e, '评价加载失败') }
  finally { uni.stopPullDownRefresh() }
}
async function loadList(more) {
  if (more && (listLoading.value || !hasMore.value)) return
  const ticket = ++sequence, next = more ? page.value + 1 : 1
  listLoading.value = true; listError.value = ''
  if (!more) { rows.value = []; hasMore.value = false }
  try {
    const data = (await get(endpoint(), { filter, tab: tab.value, days: days.value, sort: sort.value, mention: mention.value, pageNum: next })).data || {}
    if (ticket !== sequence) return
    const incoming = (data.rows || []).map(r => ({ ...r, expanded: false }))
    rows.value = more ? rows.value.concat(incoming) : incoming; page.value = next; hasMore.value = !!data.hasMore
  } catch (e) { if (ticket === sequence) listError.value = errText(e, '评价加载失败，请重试') }
  finally { if (ticket === sequence) listLoading.value = false }
}
function setTab(key) { if (tab.value !== key) { tab.value = key; loadList(false) } }
function toggleMention(label) { mention.value = mention.value === label ? '' : label; loadList(false) }
function openFilter() { draftDays.value = days.value; draftSort.value = sort.value; panelOpen.value = true }
function applyFilter() { days.value = draftDays.value; sort.value = draftSort.value; panelOpen.value = false; loadList(false) }
function clearFilters() { tab.value = 'all'; mention.value = ''; days.value = 0; sort.value = 'latest'; loadList(false) }
function previewImages(row, i) { const urls = row.images.map(absUrl); uni.previewImage({ urls, current: urls[i] }) }
function playVideo(video) { playing.value = video }
function videoError() { playing.value = null; toast('视频暂时无法播放，请稍后重试') }
function writeReview() { if (appId.value) go(R.review + '?bizType=application&bizId=' + appId.value) }
onReachBottom(() => loadList(true))
onPullDownRefresh(reload)
onHide(() => { playing.value = null; panelOpen.value = false; hidden = true })
onShow(() => { if (hidden) { hidden = false; reload() } })
</script>

<style scoped lang="scss">
.jr-page { min-height: 100vh; color: #503827; background: linear-gradient(165deg, #FFF2E4 0, #FBF8F5 275px, #F5F5F3 580px); padding-bottom: calc(90px + env(safe-area-inset-bottom)); box-sizing: border-box; }
.jr-main { padding: 0 12px; }
.jr-summary { margin-top: 3px; padding: 14px 14px 12px; border-radius: 12px; border: 1px solid rgba(255,255,255,.9); background: rgba(255,255,255,.78); box-shadow: 0 3px 7px rgba(96,62,35,.09); }
.jr-stats { display: flex; align-items: stretch; }
.jr-stat { flex: 1; min-width: 0; text-align: center; position: relative; }
.jr-stat + .jr-stat::before { content: ''; position: absolute; left: 0; top: 8px; height: 38px; width: 1px; background: #E8DED5; }
.jr-number { display: block; font-size: 28px; line-height: 1.15; font-weight: 700; color: #452A17; font-variant-numeric: tabular-nums; }
.jr-percent { font-size: 16px; margin-left: 2px; }
.jr-label { display: block; margin-top: 6px; font-size: 11px; line-height: 15px; color: #75665B; }
.jr-rating-label { display: flex; flex-wrap: wrap; justify-content: center; align-items: center; gap: 4px; margin-top: 6px; }
.jr-rating-label .jr-label { margin-top: 0; flex-shrink: 0; white-space: nowrap; }
.jr-stars--summary { flex-shrink: 0; }
.jr-stars { display: flex; align-items: center; gap: 2px; flex-shrink: 0; }
.jr-stars--summary { justify-content: center; gap: 1px; }
.jr-dimensions { display: flex; justify-content: space-between; gap: 8px; border-top: 1px solid #EDE6DE; padding-top: 10px; margin-top: 13px; }
.jr-dimension { display: flex; gap: 5px; font-size: 13px; font-weight: 600; }
.jr-dimension__score { color: #966031; font-weight: 700; }
.jr-basis, .jr-legacy { display: block; color: #918172; font-size: 10px; line-height: 1.6; text-align: center; margin: 8px 0 0; }
.jr-legacy { margin-top: 0; }
.jr-mentioned { margin-top: 17px; }
.jr-section-head { display: flex; align-items: center; justify-content: space-between; }
.jr-heading { font-size: 16px; font-weight: 700; color: #543421; }
.jr-write { font-size: 12px; color: #9D683C; padding: 8px 0 8px 8px; }
.jr-chips { display: flex; flex-wrap: wrap; gap: 7px 9px; margin-top: 12px; }
.jr-chip { display: flex; align-items: center; min-height: 26px; padding: 0 12px; box-sizing: border-box; border: 1px solid #B5A58C; background: rgba(255,255,255,.72); border-radius: 22px; color: #755735; font-size: 12px; }
.jr-chip__count { display: none; }
.jr-chip--active { background: #F2DDC3; border-color: #BF9262; }
.jr-quiet { display: block; font-size: 12px; color: #9A8B7D; line-height: 1.7; margin-top: 10px; }
.jr-toolbar { display: flex; justify-content: space-between; align-items: center; margin: 15px 0 10px; gap: 8px; }
.jr-tabs { display: flex; gap: 11px; align-items: center; }
.jr-tab { font-size: 14px; font-weight: 600; padding: 6px 9px; border-radius: 20px; color: #473D34; white-space: nowrap; }
.jr-tab--active { background: #F0D0A7; color: #5D351B; }
.jr-filter { display: flex; align-items: center; gap: 4px; font-size: 12px; background: #FFFFFF; border: 1px solid #C8C0B7; border-radius: 20px; padding: 5px 10px; white-space: nowrap; }
.jr-filter--active { background: #F6E6D3; }
.jr-active { display: flex; align-items: center; justify-content: space-between; gap: 8px; font-size: 11px; color: #976A42; margin-bottom: 11px; }
.jr-review { background: #FFF; border: 1px solid #F0ECE7; border-radius: 15px; padding: 13px 12px 12px; margin-bottom: 9px; box-shadow: 0 2px 3px rgba(52,37,23,.05); }
.jr-review__head { display: flex; align-items: center; gap: 8px; }
.jr-avatar { width: 29px; height: 29px; border-radius: 50%; flex-shrink: 0; }
.jr-avatar--empty { display: flex; align-items: center; justify-content: center; background: #F3EDE5; }
.jr-identity { flex: 1; min-width: 0; display: flex; align-items: center; gap: 7px; flex-wrap: wrap; }
.jr-name-row { display: flex; align-items: center; gap: 7px; flex-wrap: wrap; }
.jr-name { font-size: 14px; font-weight: 600; color: #352D25; max-width: 105px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.jr-type { font-size: 10px; line-height: 17px; border-radius: 9px; padding: 0 6px; color: #93603A; background: #F7EDDF; }
.jr-date { display: block; font-size: 10px; color: #999187; }
.jr-review__head > .jr-stars { padding-top: 3px; }
.jr-review__body { margin-left: 37px; }
.jr-content { display: block; font-size: 13px; line-height: 1.65; color: #332E28; margin: 8px 0; white-space: pre-wrap; overflow-wrap: anywhere; }
.jr-content--empty { color: #9B8F82; font-size: 12px; }
.jr-photos { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 8px; }
.jr-photo { width: 135rpx; height: 135rpx; border-radius: 8px; background: #F0EBE6; }
.jr-video { width: 170px; max-width: 100%; height: 96px; position: relative; overflow: hidden; border-radius: 9px; background: #B5A28D; margin: 9px 0; }
.jr-video__cover { width: 100%; height: 100%; }
.jr-video__play { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; background: rgba(0,0,0,.09); }
.jr-video__caption { position: absolute; right: 6px; bottom: 5px; color: #FFF; background: rgba(0,0,0,.4); font-size: 10px; padding: 2px 5px; border-radius: 5px; }
.jr-review__foot { display: flex; align-items: center; justify-content: space-between; gap: 7px; margin-top: 8px; }
.jr-card-chips { display: flex; gap: 5px; flex-wrap: wrap; }
.jr-card-chip { padding: 2px 6px; border: 1px solid #ECE9E4; background: #FAF9F6; border-radius: 6px; font-size: 10px; color: #736353; }
.jr-expand { display: flex; gap: 2px; align-items: center; font-size: 10px; color: #9A8B7D; padding: 5px 0 5px 6px; white-space: nowrap; }
.jr-card-dims { display: flex; flex-wrap: wrap; gap: 7px 14px; font-size: 11px; background: #FAF6F0; padding: 8px; margin-top: 6px; border-radius: 7px; }
.jr-reply { background: #F6F1EB; color: #74604D; padding: 9px; font-size: 12px; line-height: 1.6; border-radius: 8px; margin-top: 8px; white-space: pre-wrap; }
.jr-reply__label { display: block; color: #9D7047; margin-bottom: 3px; }
.jr-state { display: flex; flex-direction: column; align-items: center; gap: 10px; text-align: center; padding: 45px 12px; color: #8C7461; font-size: 14px; }
.jr-state--empty { padding-top: 30px; }
.jr-empty-title { font-weight: 600; margin-top: 3px; }
.jr-state .jr-quiet { margin: 0; }
.jr-retry { margin: 8px 0 0; font-size: 13px; line-height: 36px; padding: 0 20px; color: #84532D; background: #F0DCC4; border-radius: 20px; }
.jr-retry::after, .jr-panel button::after { border: 0; }
.jr-end, .jr-loading { text-align: center; font-size: 11px; color: #A49382; padding: 18px 0; }
.jr-mask { position: fixed; inset: 0; background: rgba(38,27,18,.38); z-index: 900; display: flex; align-items: flex-end; }
.jr-panel { width: 100%; box-sizing: border-box; background: #FFFCF8; border-radius: 22px 22px 0 0; padding: 22px 18px calc(24px + env(safe-area-inset-bottom)); }
.jr-panel__head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 23px; }
.jr-panel__label { display: block; font-size: 13px; font-weight: 600; margin: 18px 0 12px; }
.jr-options { display: flex; flex-wrap: wrap; gap: 8px; }
.jr-option { padding: 10px 13px; background: #F2EDE7; border-radius: 9px; font-size: 12px; border: 1px solid transparent; }
.jr-option--active { background: #F3DCC0; border-color: #CDA271; color: #80532D; }
.jr-panel__actions { display: flex; gap: 10px; margin-top: 30px; }
.jr-panel__actions button { flex: 1; font-size: 14px; border-radius: 23px; line-height: 43px; }
.jr-reset { background: #F1EBE4; color: #8C6D4F; }
.jr-confirm { background: #A47143; color: white; }
.jr-player { position: fixed; inset: 0; z-index: 1200; background: #15120F; display: flex; align-items: center; justify-content: center; }
.jr-player__video { width: 100%; height: 70%; }
.jr-player__close { position: absolute; top: calc(20px + env(safe-area-inset-top)); left: 20px; display: flex; align-items: center; gap: 7px; color: white; font-size: 14px; z-index: 1; padding: 10px; }
@media (max-width: 350px) { .jr-tabs { gap: 0; } .jr-tab { font-size: 13px; padding: 6px 8px; } .jr-main { padding: 0 9px; } .jr-dimension { font-size: 12px; gap: 3px; } .jr-dimensions { gap: 4px; } .jr-review { padding: 11px 9px; } .jr-photo { height: 62px; } .jr-name-row { gap: 4px; } .jr-name { max-width: 70px; } .jr-review__head > .jr-stars { gap: 0; } }
</style>
