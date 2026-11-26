<template>
  <k-feature-gate feature="recruitment">
  <view class="jr-page" :class="$userSurface">
    <k-topbar title="做过的伙伴评价" back bg="transparent" />
    <view class="jr-main">
      <view v-if="loadError" class="jr-state jr-state--card"><view class="jr-state__icon"><k-icon :name="String(loadError).includes('门店') ? 'store' : 'cloud-off'" :size="28" color="red" /></view><text class="jr-state__title">{{ loadError }}</text><button class="jr-retry" @click="reload">重新加载</button></view>
      <view v-else-if="!loaded" class="jr-state"><text>正在加载伙伴评价…</text></view>
      <template v-else>
        <view class="jr-summary" :class="{ 'jr-summary--empty': !summary.count }">
          <view class="jr-stats">
            <view class="jr-stat"><text class="jr-number">{{ score(summary.avg) }}</text><view class="jr-rating-label"><text class="jr-label">综合评分</text><view class="jr-stars jr-stars--summary"><k-icon v-for="star in 5" :key="star" name="star" :size="12" :color="star <= Math.round(Number(summary.avg) || 0) ? 'red' : 'line'" fill /></view></view></view>
            <view class="jr-stat"><text class="jr-number">{{ summary.count || 0 }}</text><text class="jr-label">伙伴评价</text></view>
            <view class="jr-stat"><text class="jr-number">{{ summary.recommendRate == null ? '—' : summary.recommendRate }}<text v-if="summary.recommendRate != null" class="jr-percent">%</text></text><text class="jr-label">推荐率</text></view>
          </view>
          <view class="jr-dimensions"><view v-for="dim in dimensions" :key="dim.label" class="jr-dimension"><text>{{ dim.label }}</text><text class="jr-dimension__score">{{ score(dim.avg) }}</text></view></view>
        </view>
        <text v-if="summary.legacyDimensions" class="jr-legacy">历史评价的“吃住”分项沿用当时的住宿评分</text>

        <view class="jr-mentioned">
          <view class="jr-section-head"><text class="jr-heading">大家提到</text><view v-if="appId" class="jr-write" role="button" hover-class="k-press" @click="writeReview"><text>写评价</text><k-icon name="chevron-right" :size="12" color="red" /></view></view>
          <view v-if="summary.mentions && summary.mentions.length" class="jr-chips"><view v-for="item in summary.mentions" :key="item.label" class="jr-chip" :class="{ 'jr-chip--active': mention === item.label }" role="button" :aria-label="'筛选：' + item.label" @click="toggleMention(item.label)">{{ item.label }}<text class="jr-chip__count">{{ item.count }}</text></view></view>
          <text v-else class="jr-quiet">{{ summary.count ? '更多体验，藏在伙伴们的评价里' : '等一位体验过的伙伴，留下第一段分享' }}</text>
        </view>

        <view class="jr-toolbar" :class="{ 'jr-toolbar--idle': !summary.count }">
          <view class="jr-tabs"><view v-for="item in tabs" :key="item.key" class="jr-tab" :class="{ 'jr-tab--active': tab === item.key }" role="button" @click="setTab(item.key)">{{ item.label }}</view></view>
          <view class="jr-filter" :class="{ 'jr-filter--active': days || sort !== 'latest' }" role="button" aria-label="筛选评价" @click="openFilter"><text>筛选{{ days || sort !== 'latest' ? ' ·' : '' }}</text><k-icon name="chevron-down" :size="12" color="muted" /></view>
        </view>
        <view v-if="mention || days || sort !== 'latest'" class="jr-active"><text>{{ [mention, days ? '近 ' + days + ' 天' : '', sort === 'high' ? '评分从高到低' : sort === 'low' ? '评分从低到高' : ''].filter(Boolean).join(' · ') }}</text><view class="jr-clear" role="button" hover-class="k-press" @click="clearFilters"><text>清除筛选</text><k-icon name="x" :size="12" color="red" /></view></view>

        <view v-for="review in rows" :key="review.reviewId" class="jr-review">
          <view class="jr-review__head">
            <image v-if="review.avatar" class="jr-avatar" :src="absUrl(review.avatar)" mode="aspectFill" />
            <view v-else class="jr-avatar jr-avatar--empty"><k-icon name="user-round" :size="20" color="muted" /></view>
            <view class="jr-identity"><view class="jr-name-row"><text class="jr-name">{{ review.name }}</text><text v-if="review.tag" class="jr-type">{{ review.tag }}</text></view><text class="jr-date">{{ review.date }}</text></view>
            <view class="jr-stars" :aria-label="review.rating + '星评价'"><k-icon v-for="star in 5" :key="star" name="star" :size="12" :color="star <= review.rating ? 'red' : 'line'" fill /></view>
          </view>
          <view class="jr-review__body">
            <text v-if="review.content" class="jr-content">{{ review.content }}</text><text v-else class="jr-content jr-content--empty">这位伙伴留下了评分，暂未填写文字。</text>
            <view v-if="review.video" class="jr-video" role="button" aria-label="播放评价视频" @click="playVideo(review.video)"><image v-if="review.video.cover" class="jr-video__cover" :src="absUrl(review.video.cover)" mode="aspectFill" /><view class="jr-video__play"><k-icon name="play" :size="24" color="white" fill /></view><text class="jr-video__caption">体验实拍</text></view>
            <view v-if="review.images && review.images.length" class="jr-photos"><image v-for="(src, photoIndex) in review.images.slice(0, 9)" :key="photoIndex" class="jr-photo" :src="absUrl(src)" mode="aspectFill" role="button" :aria-label="'查看评价照片 ' + (photoIndex + 1)" @click="previewImages(review, photoIndex)" /></view>
            <view class="jr-review__foot"><view class="jr-card-chips"><text v-for="label in review.chips || []" :key="label" class="jr-card-chip">{{ label }}</text></view><view class="jr-expand" role="button" :aria-label="review.expanded ? '收起分项评分' : '查看分项评分'" @click="review.expanded = !review.expanded"><text>{{ review.expanded ? '收起' : '分项' }}</text><k-icon :name="review.expanded ? 'chevron-up' : 'chevron-down'" :size="12" color="muted" /></view></view>
            <view v-if="review.expanded" class="jr-card-dims"><text v-if="Number(review.stayDays) > 0">体验 {{ review.stayDays }} 天</text><text v-for="dim in review.dims" :key="dim.label">{{ dim.label }} <text class="jr-dimension__score">{{ score(dim.avg) }}</text></text></view>
            <view v-if="review.reply" class="jr-reply"><text class="jr-reply__label">店家回复</text><text>{{ review.reply }}</text></view>
          </view>
        </view>
        <view v-if="listError" class="jr-state"><text>{{ listError }}</text><button class="jr-retry" @click="loadList(false)">重新加载评价</button></view>
        <view v-else-if="listLoading" class="jr-loading">正在加载评价…</view>
        <view v-else-if="!rows.length" class="jr-state jr-state--empty"><view class="jr-state__icon"><k-icon name="message-circle" :size="32" color="red" /></view><text class="jr-empty-title">{{ summary.count ? '暂无符合条件的评价' : '还没有伙伴留下评价' }}</text><text class="jr-quiet">{{ summary.count ? '换个筛选，看看其他伙伴的体验吧' : '真实的工作与生活感受，值得被记录' }}</text><button v-if="summary.count" class="jr-retry" @click="clearFilters">查看全部评价</button></view>
        <view v-else class="jr-end" role="button" @click="loadList(true)">{{ hasMore ? '点击或上滑，查看更多评价' : '每一份真实分享，都值得认真看见' }}</view>
        <text class="jr-basis">基于真实岗位评价 · 推荐率按 4 星及以上评价统计</text>
      </template>
    </view>
    <k-tabbar active="home" theme="journal" />
    <view v-if="panelOpen" class="jr-mask" @click="panelOpen = false" @touchmove.stop.prevent="noop"><view class="jr-panel" @click.stop="noop"><view class="jr-panel__head"><text class="jr-heading">筛选评价</text><view role="button" aria-label="关闭筛选" @click="panelOpen = false"><k-icon name="x" :size="22" color="ink2" /></view></view><text class="jr-panel__label">评价时间</text><view class="jr-options"><view v-for="span in [0, 30, 90, 365]" :key="span" class="jr-option" :class="{ 'jr-option--active': draftDays === span }" role="button" @click="draftDays = span">{{ span ? '近 ' + span + ' 天' : '不限时间' }}</view></view><text class="jr-panel__label">排列顺序</text><view class="jr-options"><view v-for="option in sorts" :key="option.key" class="jr-option" :class="{ 'jr-option--active': draftSort === option.key }" role="button" @click="draftSort = option.key">{{ option.label }}</view></view><view class="jr-panel__actions"><button class="jr-reset" @click="draftDays = 0; draftSort = 'latest'">重置</button><button class="jr-confirm" @click="applyFilter">确定</button></view></view></view>
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
.jr-basis, .jr-legacy { display: block; color: #918172; font-size: 11px; line-height: 1.6; text-align: center; margin: 8px 0 0; }
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
.jr-type { font-size: 11px; line-height: 17px; border-radius: 9px; padding: 0 6px; color: #93603A; background: #F7EDDF; }
.jr-date { display: block; font-size: 11px; color: #999187; }
.jr-review__head > .jr-stars { padding-top: 3px; }
.jr-review__body { margin-left: 37px; }
.jr-content { display: block; font-size: 13px; line-height: 1.65; color: #332E28; margin: 8px 0; white-space: pre-wrap; overflow-wrap: anywhere; }
.jr-content--empty { color: #9B8F82; font-size: 12px; }
.jr-photos { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 8px; }
.jr-photo { width: 135rpx; height: 135rpx; border-radius: 8px; background: #F0EBE6; }
.jr-video { width: 170px; max-width: 100%; height: 96px; position: relative; overflow: hidden; border-radius: 9px; background: #B5A28D; margin: 9px 0; }
.jr-video__cover { width: 100%; height: 100%; }
.jr-video__play { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; background: rgba(0,0,0,.09); }
.jr-video__caption { position: absolute; right: 6px; bottom: 5px; color: #FFF; background: rgba(0,0,0,.4); font-size: 11px; padding: 2px 5px; border-radius: 5px; }
.jr-review__foot { display: flex; align-items: center; justify-content: space-between; gap: 7px; margin-top: 8px; }
.jr-card-chips { display: flex; gap: 5px; flex-wrap: wrap; }
.jr-card-chip { padding: 2px 6px; border: 1px solid #ECE9E4; background: #FAF9F6; border-radius: 6px; font-size: 11px; color: #736353; }
.jr-expand { display: flex; gap: 2px; align-items: center; font-size: 11px; color: #9A8B7D; padding: 5px 0 5px 6px; white-space: nowrap; }
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
/* 2026-11-17 改版「小而精」：浅灰底（顶上一点很浅的暖色）+ 白卡，卡片 12 圆角、不描边、不加阴影；「大家提到」和页签收成小胶囊；
   评分、分项、筛选、照片、视频、店家回复、写评价都照旧。 */
.jr-page { color: var(--k-ink); background: linear-gradient(180deg, var(--k-bg), #F7F5F2 140px); }
.jr-summary { margin-top: 4px; padding: 14px 12px 12px; border: 0; background: var(--k-paper); box-shadow: none; }
.jr-stat + .jr-stat::before { top: 6px; height: 32px; background: var(--k-line); }
.jr-number { font-size: 22px; color: var(--k-ink); }
.jr-percent { font-size: 13px; }
.jr-label { margin-top: 4px; color: var(--k-muted); }
.jr-rating-label { margin-top: 4px; }
.jr-dimensions { margin-top: 12px; border-top-color: var(--k-line); }
.jr-dimension { font-size: 12px; font-weight: 500; color: var(--k-ink2); }
.jr-dimension__score { color: var(--k-red-deep); font-weight: 600; }
.jr-basis, .jr-legacy { color: var(--k-muted); }
.jr-mentioned { margin-top: 16px; }
.jr-heading { font-size: 15px; color: var(--k-ink); }
.jr-write { color: var(--k-red-deep); }
.jr-chips { gap: 6px; margin-top: 8px; }
.jr-chip { min-height: 26px; padding: 0 10px; border: 0; border-radius: 13px; background: var(--k-paper); color: var(--k-ink2); }
.jr-chip--active { background: var(--k-red-soft); box-shadow: inset 0 0 0 1px var(--k-red-line); color: var(--k-red-deep); font-weight: 600; }
.jr-quiet { margin-top: 6px; color: var(--k-muted); }
.jr-toolbar { margin: 16px 0 8px; }
.jr-tabs { gap: 6px; }
.jr-tab { padding: 6px 10px; border-radius: 16px; font-size: 13px; font-weight: 500; line-height: 20px; color: var(--k-ink2); }
.jr-tab--active { background: var(--k-red-soft); color: var(--k-red-deep); font-weight: 600; }
.jr-filter { border: 0; border-radius: 16px; padding: 6px 8px 6px 10px; line-height: 20px; background: var(--k-paper); color: var(--k-ink2); }
.jr-filter--active { background: var(--k-red-soft); color: var(--k-red-deep); }
.jr-active { margin-bottom: 8px; color: var(--k-red-deep); }
.jr-review { margin-bottom: 8px; padding: 12px; border: 0; border-radius: 12px; box-shadow: none; }
.jr-avatar { width: 32px; height: 32px; }
.jr-avatar--empty { background: #F5F1EB; }
.jr-name { font-size: 13px; color: var(--k-ink); }
.jr-type { padding: 0 5px; border-radius: 4px; background: var(--k-red-soft); color: var(--k-red-deep); font-weight: 500; }
.jr-date { color: var(--k-muted); }
.jr-review__body { margin-left: 40px; }
.jr-content { margin: 6px 0; line-height: 1.7; color: var(--k-ink); }
.jr-content--empty { color: var(--k-muted); }
.jr-photo { background: #F5F1EB; }
.jr-video { border-radius: 8px; }
.jr-video__caption { border-radius: 4px; }
.jr-card-chips { gap: 4px; }
.jr-card-chip { padding: 0 5px; border: 0; border-radius: 4px; background: #F5F1EB; line-height: 17px; color: var(--k-ink2); }
.jr-expand { color: var(--k-muted); }
.jr-card-dims { border-radius: 8px; background: #F7F5F2; color: var(--k-ink2); }
.jr-reply { padding: 8px 10px; border-radius: 8px; background: #F7F5F2; color: var(--k-ink2); }
.jr-reply__label { color: var(--k-red-deep); font-weight: 500; }
.jr-state { gap: 8px; color: var(--k-muted); font-size: 13px; }
.jr-empty-title { color: var(--k-ink); font-size: 15px; }
.jr-retry { margin-top: 6px; padding: 0 18px; border-radius: 18px; background: var(--k-paper); box-shadow: inset 0 0 0 1px var(--k-red-line); color: var(--k-red-deep); line-height: 36px; }
.jr-end, .jr-loading { color: var(--k-muted); }
.jr-panel { padding: 18px 16px calc(16px + env(safe-area-inset-bottom)); border-radius: 16px 16px 0 0; background: var(--k-paper); }
.jr-panel__head { margin-bottom: 12px; }
.jr-panel__label { margin: 14px 0 8px; color: var(--k-ink); }
.jr-option { padding: 8px 14px; border-radius: 8px; background: #F5F1EB; font-size: 13px; color: var(--k-ink2); }
.jr-option--active { border-color: var(--k-red-line); background: var(--k-red-soft); color: var(--k-red-deep); font-weight: 600; }
.jr-panel__actions { margin-top: 20px; }
.jr-panel__actions button { border-radius: 21px; line-height: 42px; }
.jr-panel__actions .jr-reset { flex: 0 0 30%; background: var(--k-paper); box-shadow: inset 0 0 0 1px var(--k-red-line); color: var(--k-red-deep); }
.jr-confirm { background: linear-gradient(135deg, #B5814D, #8E5E33); font-weight: 600; }
/* —— 第二轮精修（11-18）—— */
.jr-heading { font-size: 16px; line-height: 22px; }
.jr-write, .jr-clear { display: flex; align-items: center; gap: 2px; white-space: nowrap; }
.jr-clear { flex: 0 0 auto; }
/* 「全部 / 有图·视频 / 差评」是切换不是筛选：按分段控件（浅灰底槽 + 白色选中块），和下面「大家提到」的筛选胶囊分开 */
.jr-tabs { height: 32px; padding: 2px; gap: 0; box-sizing: border-box; border-radius: 16px; background: #F0EBE4; }
.jr-tab { height: 28px; padding: 0 12px; box-sizing: border-box; border-radius: 14px; font-size: 13px; font-weight: 400; line-height: 28px; color: var(--k-ink2); }
.jr-tab--active { background: #FFFFFF; color: var(--k-ink); font-weight: 600; }
/* 「大家提到」：页面底色上的筛选胶囊，选中不描边 */
.jr-chip { height: 28px; min-height: 28px; padding: 0 12px; border-radius: 14px; font-size: 12px; }
.jr-chip--active { box-shadow: none; font-weight: 500; }
.jr-date, .jr-expand, .jr-basis, .jr-legacy { font-size: 11px; }
.jr-number { font-size: 18px; font-weight: 700; color: var(--k-ink); font-variant-numeric: tabular-nums; }
.jr-panel__actions button { height: 44px; line-height: 44px; border-radius: 22px; }
@media (max-width: 350px) { .jr-tab { padding: 0 10px; } }
/* —— 第三轮逐页精修（11-18，r3jobsa）——
   ① 读不到门店 / 读取失败：白卡里居中（离顶栏留出一段），56 的浅棕圆角方块 + 32 号门店图标，不再贴着顶栏、下面一大片空；
   ② 没有评价：同一种图标方块；③ 评分星星统一暖棕实心 + 浅线色空心；④ 评分卡数字 20 / 700，三格之间发丝竖线。 */
.jr-state__icon { width: 56px; height: 56px; border-radius: 16px; background: var(--k-red-soft); display: flex; align-items: center; justify-content: center; }
.jr-state--card { margin-top: 24px; padding: 40px 24px 32px; border-radius: 12px; background: var(--k-paper); gap: 8px; }
.jr-state--card > text { font-size: 14px; font-weight: 500; line-height: 20px; color: var(--k-ink); }
.jr-state--card .jr-retry { margin-top: 8px; height: 36px; line-height: 36px; font-size: 13px; font-weight: 600; }
.jr-state--empty { margin-top: 0; padding: 32px 24px; border-radius: 12px; background: var(--k-paper); }
.jr-state--empty .jr-empty-title { margin-top: 4px; font-size: 14px; font-weight: 500; }
.jr-state--empty .jr-quiet { max-width: 240px; font-size: 12px; }
.jr-summary { padding: 16px 12px 12px; }
.jr-number { font-size: 20px; line-height: 26px; }
.jr-stat + .jr-stat::before { transform: scaleX(.5); }
.jr-dimensions { position: relative; border-top: 0; }
.jr-dimensions::before { content: ''; position: absolute; left: 0; right: 0; top: 0; height: 1px; background: var(--k-line); transform: scaleY(.5); }
.jr-mentioned { margin-top: 20px; }
.jr-toolbar { margin: 20px 0 8px; }
.jr-name { font-size: 14px; }
.jr-review { padding: 14px 12px 12px; }
/* 2026-11-18 第三轮返修（r3jobsa）：汇总卡离顶栏 12；三格数字底边对齐（「92%」的 % 是小字，原来低 3px）；
   底部两行说明不再被凸起的「发布」钮盖住，两行间距 8；出错卡多一行 12 号灰字说下一步怎么办 */
.jr-main { padding-top: 12px; }
.jr-summary { margin-top: 0; }
.jr-number { height: 30px; display: flex; align-items: flex-end; justify-content: center; line-height: 26px; }
.jr-stat .jr-label, .jr-rating-label { margin-top: 4px; }
.jr-page { padding-bottom: calc(96px + var(--k-safe-bottom)); }
.jr-end { padding: 16px 0 0; }
.jr-basis { margin-top: 8px; }
.jr-state__hint { margin-top: -4px; font-size: 12px; line-height: 18px; color: var(--k-muted); }
.jr-retry { height: 36px; line-height: 36px; }
@media (max-width: 359px) {

}
/* 2026-11-18 第三轮返修第 2 轮（r3jobsa）：
   ① 顶栏吸顶但原来是透明底，往下滑时汇总卡的数字从标题底下穿过：顶栏铺成和页面顶部一样的浅暖底；
   ② 出错卡：标题 15 / 600 深字，说明 12 灰字，按钮离说明 16（和「还没有评价」那张同一种主次）；
   ③ 「综合评分」下面的星星：390 和 320 都单独一行；④ 底部留出凸起「发布」钮的高度；⑤ 窄屏评价卡右边多让一点给客服浮钮 */
.jr-page :deep(.k-topbar) { background: var(--k-bg) !important; }
.jr-state--card { gap: 0; }
.jr-state--card .jr-state__icon { margin-bottom: 12px; }
.jr-state--card > .jr-state__title, .jr-state--empty .jr-empty-title { margin-top: 0; font-size: 15px; font-weight: 600; line-height: 22px; color: var(--k-ink); }
.jr-state--card > .jr-state__hint { margin-top: 4px; font-size: 12px; font-weight: 400; line-height: 18px; color: var(--k-muted); }
.jr-state--card .jr-retry { margin-top: 16px; }
.jr-state--empty { gap: 0; }
.jr-state--empty .jr-state__icon { margin-bottom: 12px; }
.jr-state--empty .jr-quiet { margin-top: 4px; line-height: 18px; }
.jr-rating-label { flex-direction: column; flex-wrap: nowrap; gap: 4px; }
.jr-main > .jr-mentioned:first-child, .jr-legacy + .jr-mentioned { margin-top: 4px; }
.jr-page { padding-bottom: calc(120px + var(--k-safe-bottom)); }
@media (max-width: 359px) {
  .jr-review { padding-right: 24px; }
}
/* 2026-11-18 第三轮返修第 4 轮：评分汇总三列数字、标签各自对齐在同一条线上（星星放到「综合评分」下面）；
   没有评价时「全部 / 有图·视频 / 差评 / 筛选」退成半透明灰字；出错白卡往下放、内容竖向居中，不再上挤下空。 */
.jr-stats { align-items: flex-start; }
.jr-number { height: 28px; font-size: 22px; line-height: 28px; white-space: nowrap; }
.jr-percent { display: inline; font-size: 13px; line-height: 28px; vertical-align: baseline; }
.jr-label { height: 16px; margin-top: 4px; font-size: 11px; line-height: 16px; }
.jr-rating-label { margin-top: 4px; flex-direction: column; flex-wrap: nowrap; gap: 4px; }
.jr-stat + .jr-stat::before { top: 4px; height: 40px; }
.jr-toolbar--idle .jr-tab, .jr-toolbar--idle .jr-filter { opacity: .5; color: var(--k-muted); }
.jr-toolbar--idle .jr-tab--active { background: var(--k-paper2); }
.jr-state--card { margin-top: 40px; min-height: 420px; justify-content: center; box-sizing: border-box; }
.jr-state--empty { min-height: 320px; justify-content: center; box-sizing: border-box; }
/* 2026-11-18 第三轮返修第 5 轮：
   ① 统计块恢复成一直显示（没评价时也有 0.0 / 0 / — 和四个分项），没评价时整块收紧、数字变灰；
   ② 三格数字统一 20/700、28 行高、底边对齐（% 是同一行里的小字，不再把数字顶高）；三个说明同一条线；
   ③ 出错卡离顶栏 16、最小高 300；空评价卡最小高 240。 */
.jr-number { display: block; height: 28px; font-size: 20px; font-weight: 700; line-height: 28px; text-align: center; white-space: nowrap; font-variant-numeric: tabular-nums; }
.jr-percent { display: inline; margin-left: 1px; font-size: 12px; font-weight: 600; line-height: 1; vertical-align: baseline; }
.jr-stat .jr-label, .jr-rating-label { margin-top: 4px; }
.jr-rating-label .jr-label { height: 16px; margin-top: 0; line-height: 16px; }
.jr-summary--empty { padding-top: 12px; padding-bottom: 8px; }
.jr-summary--empty .jr-number, .jr-summary--empty .jr-dimension__score { color: var(--k-light); }
.jr-state--card { margin-top: 4px; min-height: 300px; } /* 页面上边距 12 + 4 = 离顶栏 16 */
.jr-state--empty { min-height: 240px; }
/* 2026-11-18 第四轮：二级页不加暖色，顶栏和页面同为 --k-page；整页出错不套白卡，放在页面上 1/4 处；「重新加载」是 32 高的次按钮 */
.jr-page { background: var(--k-page); }
.jr-page :deep(.k-topbar) { background: var(--k-page) !important; }
.jr-state--card { min-height: 0; margin-top: 84px; padding: 0 24px; border-radius: 0; background: transparent; box-shadow: none; justify-content: flex-start; }
.jr-state--card > .jr-state__title { font-size: 15px; font-weight: 600; line-height: 22px; color: var(--k-ink); } /* 11-19 返修：和全站空状态标题同一档 */
.jr-state--card .jr-retry, .jr-state .jr-retry { height: 32px; min-height: 32px; margin-top: 16px; padding: 0 16px; border-radius: 16px; background: var(--k-paper); box-shadow: inset 0 0 0 1px var(--k-red-line); color: var(--k-red-deep); font-size: 13px; font-weight: 600; line-height: 32px; }
</style>
