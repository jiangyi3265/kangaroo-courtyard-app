<template>
  <k-feature-gate feature="stay-booking">
  <view class="k-page stay-reviews" :class="$userSurface" :style="{ '--stay-paper': 'url(' + STAY_ART.paper + ')' }">
    <k-topbar title="住过的家人评价" back />

    <view class="sr-body">
      <view v-if="loadError" class="sr-empty">
        <image class="sr-empty__img" src="/static/media/stays-kangaroo-stamp.png" mode="aspectFit" />
        <text class="sr-empty__title">{{ loadError }}</text>
        <view class="sr-empty__btn" hover-class="k-press-s" @click="reload"><text>重新加载</text></view>
      </view>

      <block v-else-if="loaded">
        <view class="sum">
          <view class="sum__top">
            <view class="sum__score">
              <text class="sum__num">{{ aiSummary.score || avgText }}</text>
              <view class="sum__score-side">
                <text class="sum__cap">{{ aiSummary.ready ? 'AI综合评分' : '综合评分' }}</text>
                <view v-if="!aiSummary.ready" class="sum__stars"><k-icon v-for="(lit, starIdx) in avgStars" :key="starIdx" name="star" :size="12" color="ochre" :fill="lit" /></view>
                <text v-else class="sum__original">住客评分 {{ avgText }}</text>
              </view>
            </view>
            <view class="sum__div" />
            <view class="sum__stat"><text class="sum__big">{{ total }}</text><text class="sum__cap">家人评价</text></view>
            <view class="sum__div" />
            <view class="sum__stat"><text class="sum__big">{{ recommend ? recommend.slice(0, -1) : '—' }}<text v-if="recommend" class="sum__percent">%</text></text><text class="sum__cap">推荐率</text></view>
          </view>
          <view v-if="sum.dims && sum.dims.length" class="sum__dims">
            <view v-for="dim in sum.dims" :key="dim.label" class="sum__dim"><text class="sum__dim-label">{{ dim.label }}</text><text class="sum__dim-num">{{ dimText(dim.avg) }}</text></view>
          </view>
          <text v-if="aiSummary.ready" class="sum__note">{{ aiSummary.note }}</text>
        </view>
        <view v-if="aiSummary.ready" class="ai-summary">
          <view class="ai-summary__head"><text>AI入住总结</text><text>基于{{ aiSummary.count }}条真实评价</text></view>
          <text class="ai-summary__copy">{{ aiSummary.summary }}</text>
          <view v-if="aiSummary.highlights.length" class="ai-summary__line"><text class="ai-summary__label">大家认可</text><text>{{ aiSummary.highlights.join('、') }}</text></view>
          <view v-if="aiSummary.cautions.length" class="ai-summary__line"><text class="ai-summary__label">入住留意</text><text>{{ aiSummary.cautions.join('、') }}</text></view>
        </view>
          <view v-if="sum.mentions && sum.mentions.length" class="mention">
            <text class="mention__title">大家提到</text>
            <view class="mention__chips">
              <view v-for="chip in sum.mentions" :key="chip.label" class="mention__chip" :class="{ on: mention === chip.label }" hover-class="k-press-s" @click="toggleMention(chip.label)">
                <text>{{ chip.label }}</text><text class="mention__count">{{ chip.count }}</text>
              </view>
            </view>
          </view>

        <view class="bar">
          <view class="bar__tabs">
            <view v-for="tabItem in tabs" :key="tabItem.key" class="bar__tab" :class="{ on: tab === tabItem.key }" @click="setTab(tabItem.key)">
              <text>{{ tabItem.label }}</text>
            </view>
          </view>
          <view class="bar__filter" :class="{ on: panelOpen || filterN }" hover-class="k-press-s" @click="togglePanel">
            <text>{{ filterN ? '筛选·' + filterN : '筛选' }}</text><k-icon :name="panelOpen ? 'chevron-up' : 'chevron-down'" :size="12" :color="panelOpen || filterN ? 'red' : 'ink'" />
          </view>

        </view>

        <view v-if="actives.length" class="actives">
          <view v-for="act in actives" :key="act.key" class="actives__chip" @click="clearFilter(act.key)"><text>{{ act.text }}</text><k-icon name="x" :size="12" color="red" /></view>
          <text class="actives__clear" @click="clearAll">清除</text>
        </view>

        <view v-for="review in rows" :key="review.reviewId" class="rv">
          <view class="rv__head">
            <image class="rv__avatar" :src="review.avatarSrc" mode="aspectFill" />
            <view class="rv__who">
              <view class="rv__line"><text class="rv__name">{{ review.name }}</text><text v-if="review.roomType" class="rv__room">{{ review.roomType }}</text></view>
              <view class="rv__line">
                <view class="rv__stars"><k-icon v-for="(lit, starIdx) in review.stars" :key="starIdx" name="star" :size="12" color="ochre" :fill="lit" /></view><text class="rv__date">{{ review.stayMonth || review.date }}</text>
              </view>
            </view>
            <text v-if="review.featured" class="rv__featured">精选</text>
          </view>
          <view v-if="review.parts.length" class="rv__text">
            <view v-for="(part, partIdx) in review.parts" :key="partIdx" class="rv__para"><text v-if="part.label" class="rv__label">{{ part.label }}</text><text class="rv__copy">{{ part.text }}</text></view>
          </view>
          <!-- 评价视频（2026-10-17 R3）：review.videos 的第一段（一条评价最多 1 段），满宽 16:9 封面 + 播放按钮，点了全屏播放 -->
          <view v-if="review.video" class="rv__video" hover-class="k-press-s" @click="playVideo(review.video)">
            <image v-if="review.video.cover" class="rv__video-img" :src="review.video.cover" mode="aspectFill" />
            <view class="rv__video-play"><k-icon name="play" :size="14" color="white" fill /></view>
            <text class="rv__video-tag">横屏全屏播放</text>
          </view>
          <!-- 参考稿三张缩略图同排；点任意照片查看原图。 -->
          <view v-if="review.pics.length" class="rv__pics" :class="'rv__pics--' + review.grid">
            <view v-for="(img, imgIdx) in review.pics" :key="imgIdx" class="rv__cell" :class="{ 'rv__cell--lead': review.grid === 'lead' && imgIdx === 0 }" @click="previewPics(review, imgIdx)"><image class="rv__pic" :src="img" mode="aspectFill" /></view>
          </view>
          <view v-if="review.chips.length" class="rv__chips"><text v-for="chipText in review.chips" :key="chipText" class="rv__chip">{{ chipText }}</text></view>
          <view v-if="review.reply" class="rv__reply"><text class="rv__reply-who">小院回复{{ review.replyDate ? ' · ' + review.replyDate : '' }}</text><text class="rv__reply-text">{{ review.reply }}</text></view>
        </view>

        <view v-if="listError" class="sr-empty sr-empty--inline"><text class="sr-empty__sub">{{ listError }}</text><view class="sr-empty__btn" hover-class="k-press-s" @click="retryList">重新加载评价</view></view>
        <view v-else-if="!rows.length && !listLoading" class="sr-empty sr-empty--inline">
          <text class="sr-empty__title">{{ filteredCopy.title }}</text>
          <text class="sr-empty__sub">{{ filteredCopy.sub }}</text>
          <view v-if="total" class="sr-empty__btn" hover-class="k-press-s" @click="clearAll"><text>清除筛选</text></view>
          <view v-else class="sr-empty__btn" hover-class="k-press-s" @click="back"><text>回去看看小院</text></view>
        </view>
        <text v-if="rows.length || listLoading" class="sr-more">{{ listLoading ? '加载中…' : (hasMore ? '上滑加载更多' : '没有更多了') }}</text>
      </block>

      <text v-else class="sr-more">加载中…</text>
    </view>
    <k-tabbar active="home" theme="journal" />
          <view v-if="panelOpen" class="panel-mask" @click="panelOpen = false" @touchmove.stop.prevent="noop" />
          <view v-if="panelOpen" class="panel">
            <view class="panel__head"><text class="panel__title">筛选评价</text><view class="panel__close" @click="panelOpen = false"><k-icon name="x" :size="16" color="ink2" /><text>关闭</text></view></view>
            <scroll-view class="panel__scroll" scroll-y><view class="panel__content">
            <!-- 房型和入住月份分别选择，确认后才应用。 -->
            <text class="panel__sub">房型</text>
            <view class="panel__opts">
              <view class="opt" :class="{ on: !draftRoom }" :style="'grid-column: span ' + roomSpans[0]" @click="draftRoom = 0"><text>不限</text></view>
              <view v-for="(room, roomIdx) in sum.roomTypes" :key="room.roomTypeId" class="opt" :class="{ on: draftRoom === room.roomTypeId }" :style="'grid-column: span ' + roomSpans[roomIdx + 1]" @click="draftRoom = room.roomTypeId"><text>{{ room.name }}</text></view>
            </view>
            <text v-if="!sum.roomTypes || !sum.roomTypes.length" class="panel__none">评价还没有对应到具体房型</text>
            <view class="panel__line" />
            <text class="panel__sub">入住时间</text>
            <view class="panel__opts">
              <view class="opt" :class="{ on: !draftMonth }" :style="'grid-column: span ' + monthSpans[0]" @click="draftMonth = ''"><text>不限</text></view>
              <view v-for="(mon, monIdx) in sum.months" :key="mon.month" class="opt" :class="{ on: draftMonth === mon.month }" :style="'grid-column: span ' + monthSpans[monIdx + 1]" @click="draftMonth = mon.month"><text>{{ mon.label }}</text></view>
            </view>
            </view></scroll-view>
            <view class="panel__foot"><view class="panel__reset" @click="resetDraft">重置</view><view class="panel__ok" hover-class="k-press-s" @click="applyPanel"><text>确定</text></view></view>
          </view>
    <stay-video-player :src="playing.url" :poster="playing.cover" title="住过的家人评价" landscape @close="closeVideo" />
  </view>
</k-feature-gate>
</template>

<script setup>
import { stayBookingEnabled, refreshFeatures } from '@/common/features.js'
import { watch as watchStayGate } from 'vue'
// ---------------------------------------------------------------------------
// 小院「住过的家人评价」（2026-10-17 改版 R2）。入口：房源详情「住过的家人评价」→ /pages/stays/reviews?stayId=
//   GET /app/stay/{stayId}/reviews/summary  汇总卡 + 页签条数 + 筛选项（只取一次）
//   GET /app/stay/{stayId}/reviews          列表：tab=all|media|bad、roomTypeId、month=yyyy-MM、mention、pageNum（每页 10 条，上滑加载）
// 匿名评价后端已经去掉昵称和头像，这里只管显示。2026-10-17 R3：评价视频（review.videos，[{url, cover}]）满宽放在照片上面，点了全屏播放。
// ---------------------------------------------------------------------------
import { ref, computed } from 'vue'
import { onReachBottom } from '@dcloudio/uni-app'
import { useScreen, back } from '@/common/screen.js'
import { get } from '@/common/request.js'
import { errText } from '@/common/ui.js'
import { absUrl } from '@/common/upload.js'
import { scoreText, starFills, reviewTabs, reviewQuery, filterCount, contentParts, cardChips, photoGrid, recommendText, emptyCopy, activeFilters, optSpans } from './stays-reviews.js'
import { reviewVideo } from './stays-media.js'
import StayVideoPlayer from './stay-video-player.vue'
import { STAY_ART } from './stays-art.js'
import { stayAiSummary } from './stays-ai-summary.js'

let stayId = 0
useScreen(1, {
  onLoad: (q) => {
    stayId = Number(q.stayId) || 0
    const roomId = Number(q.roomTypeId)
    roomTypeId.value = Number.isSafeInteger(roomId) && roomId > 0 ? roomId : 0
    linkedRoomName.value = roomTypeId.value ? String(q.roomTypeName || '') : ''
    reload()
  }
})

const noop = () => {}
const loaded = ref(false)
const loadError = ref('')
const sum = ref({})
const aiSummary = computed(() => stayAiSummary(sum.value.ai))
const total = computed(() => Number(sum.value.count) || 0)
const avgText = computed(() => scoreText(sum.value.avg))
const avgStars = computed(() => starFills(sum.value.avg))
const recommend = computed(() => recommendText(sum.value.recommendRate))
const tabs = computed(() => reviewTabs(sum.value.tabs))
const dimText = (v) => scoreText(v)
// 分项进度条的长度：满分 5 分 = 100%，没有分 = 0
const dimPct = (v) => Math.max(0, Math.min(100, Math.round((Number(v) || 0) * 20)))
const noneCopy = emptyCopy(0, false)

// 当前筛选
const tab = ref('all')
const roomTypeId = ref(0)
const linkedRoomName = ref('')
const month = ref('')
const mention = ref('')
const filterN = computed(() => filterCount({ roomTypeId: roomTypeId.value, month: month.value }))
const actives = computed(() => activeFilters({ roomTypeId: roomTypeId.value, roomName: linkedRoomName.value, month: month.value, mention: mention.value }, sum.value))
const filteredCopy = computed(() => roomTypeId.value && tab.value === 'all' && !month.value && !mention.value
  ? { title: '该房型暂无评价', sub: '住过这个房型的家人评价会显示在这里，\n也可以清除筛选看看全部评价。' }
  : emptyCopy(total.value, true))

// 列表
const rows = ref([])
const pageNum = ref(1)
const hasMore = ref(false)
const listLoading = ref(false)
const listError = ref('')
let failedMore = false
let seq = 0

const card = (r) => {
  const pics = (r.images || []).map(absUrl)
  const video = reviewVideo(r)
  return {
    ...r,
    video: video ? { url: video.url, cover: video.cover ? absUrl(video.cover) : '' } : null,
    avatarSrc: r.avatar ? absUrl(r.avatar) : '/static/media/profile-avatar.jpg',
    stars: starFills(r.rating),
    parts: contentParts(r.content),
    pics,
    grid: photoGrid(pics.length),
    chips: cardChips(r)
  }
}

async function reload() {
  if(!(await refreshFeatures()).stayBookingEnabled) return
  if (!stayId) {
    loadError.value = '没有找到这家小院'
    return
  }
  loadError.value = ''
  try {
    sum.value = (await get('/app/stay/' + stayId + '/reviews/summary')).data || {}
    loaded.value = true
  } catch (e) {
    loadError.value = errText(e, '评价加载失败')
    return
  }
  if (total.value) loadList(false)
}

async function loadList(more) {
  if (more && (!hasMore.value || listLoading.value)) return
  const mine = ++seq
  const page = more ? pageNum.value + 1 : 1
  listLoading.value = true
  listError.value = ''
  failedMore = false
  if (!more) rows.value = []
  try {
    const res = (await get('/app/stay/' + stayId + '/reviews', reviewQuery({ tab: tab.value, roomTypeId: roomTypeId.value, month: month.value, mention: mention.value, pageNum: page }))).data || {}
    if (mine !== seq) return
    const list = (res.rows || []).map(card)
    rows.value = more ? rows.value.concat(list) : list
    pageNum.value = page
    hasMore.value = !!res.hasMore
  } catch (e) {
    if (mine === seq) {
      failedMore = !!more
      listError.value = errText(e, '评价加载失败，请重试')
    }
  } finally {
    if (mine === seq) listLoading.value = false
  }
}
const retryList = () => loadList(failedMore)
onReachBottom(() => { if (!listError.value) loadList(true) })

const setTab = (k) => {
  if (tab.value === k) return
  tab.value = k
  loadList(false)
}
const toggleMention = (label) => {
  mention.value = mention.value === label ? '' : label
  loadList(false)
}

// 筛选面板：先改草稿，点「确定」才生效
const panelOpen = ref(false)
const draftRoom = ref(0)
const draftMonth = ref('')
// 两组选项（「不限」+ 房型 / 月份）各占几栏，每行排满
const roomSpans = computed(() => optSpans(1 + ((sum.value.roomTypes || []).length)))
const monthSpans = computed(() => optSpans(1 + ((sum.value.months || []).length)))
const togglePanel = () => {
  if (!panelOpen.value) {
    draftRoom.value = roomTypeId.value
    draftMonth.value = month.value
  }
  panelOpen.value = !panelOpen.value
}
const resetDraft = () => {
  draftRoom.value = 0
  draftMonth.value = ''
}
const applyPanel = () => {
  panelOpen.value = false
  roomTypeId.value = draftRoom.value || 0
  month.value = draftMonth.value || ''
  loadList(false)
}
const clearFilter = (key) => {
  if (key === 'room') roomTypeId.value = 0
  else if (key === 'month') month.value = ''
  else if (key === 'mention') mention.value = ''
  loadList(false)
}
const clearAll = () => {
  tab.value = 'all'
  roomTypeId.value = 0
  month.value = ''
  mention.value = ''
  panelOpen.value = false
  loadList(false)
}

const previewPics = (review, i) => uni.previewImage({ urls: review.pics, current: review.pics[i] })
// 正在播的评价视频；空对象 = 没在播
const playing = ref({})
const playVideo = (v) => { if (v && v.url) playing.value = { url: v.url, cover: v.cover || '' } }
const closeVideo = () => { playing.value = {} }
watchStayGate(stayBookingEnabled, enabled => { if(enabled) reload() })
</script>

<style scoped lang="scss">

.stay-reviews { background: var(--k-bg); color: var(--k-ink); font-family: var(--k-sans); }
.sr-body { padding: 8px 16px calc(110px + var(--k-safe-bottom)); }
.sum { padding: 18px 16px 14px; border-radius: 16px; background: var(--k-paper); border: 1px solid #EEE7DE; box-shadow: 0 4px 16px rgba(58, 50, 43, .04); }
.sum__stay { display: block; margin-bottom: 18px; font-size: 13px; color: var(--k-muted); }
.sum__top { display: flex; align-items: flex-start; }
.sum__score, .sum__stat { flex: 1; min-width: 0; display: flex; flex-direction: column; align-items: center; gap: 6px; }
.sum__num, .sum__big { font-size: 34px; font-weight: 700; line-height: 1.15; letter-spacing: -1px; font-variant-numeric: tabular-nums; }
.sum__num { color: var(--k-red-deep); }
.sum__score-side { display: flex; flex-direction: column; align-items: center; gap: 5px; }
.sum__stars { display: flex; gap: 1px; }
.sum__cap { font-size: 12px; color: var(--k-muted); white-space: nowrap; }
.sum__div { width: 1px; height: 42px; margin: 10px 4px 0; background: #EEE7DE; flex: 0 0 auto; }
.sum__dims { display: flex; gap: 10px; margin-top: 18px; padding-top: 16px; border-top: 1px solid #EEE7DE; }
.sum__dim { flex: 1; min-width: 0; display: flex; flex-direction: column; align-items: center; gap: 4px; }
.sum__dim-label { font-size: 12px; color: var(--k-ink2); }
.sum__dim-num { font-size: 16px; font-weight: 600; color: var(--k-red-deep); }
.sum__bar { width: 100%; height: 3px; border-radius: 3px; background: #F2EBE2; overflow: hidden; }
.sum__bar-fill { height: 100%; background: #B58B61; }
.sum__note { display: block; margin-top: 14px; font-size: 11px; color: var(--k-muted); text-align: center; }
.mention { margin-top: 24px; }
.mention__title { display: block; font-size: 18px; font-weight: 700; }
.mention__chips { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 12px; }
.mention__chip { min-height: 40px; padding: 0 12px; border-radius: 12px; background: var(--k-paper); border: 1px solid #D8C5B0; color: #795331; font-size: 13px; display: flex; align-items: center; gap: 6px; box-sizing: border-box; }
.mention__chip.on { background: #F3E5D2; border-color: var(--k-red); font-weight: 600; }
.mention__count { font-size: 11px; color: var(--k-muted); }
.bar { margin-top: 20px; display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.bar__tabs { display: flex; align-items: center; gap: 4px; min-width: 0; }
.bar__tab { min-height: 44px; padding: 0 12px; border-radius: 12px; display: flex; align-items: center; justify-content: center; font-size: 14px; white-space: nowrap; color: var(--k-ink2); }
.bar__tab.on { background: #F3E5D2; color: #795331; font-weight: 700; }
.bar__filter { flex: 0 0 auto; min-height: 44px; padding: 0 10px; border: 1px solid #D8C5B0; border-radius: 12px; display: flex; align-items: center; gap: 4px; color: #795331; font-size: 13px; background: var(--k-paper); box-sizing: border-box; }
.bar__filter.on { background: #F3E5D2; border-color: var(--k-red); }
.panel-mask { position: fixed; inset: 0; z-index: 800; background: rgba(38, 32, 27, .35); }
.panel { position: fixed; z-index: 801; left: 0; right: 0; bottom: 0; background: var(--k-paper); border-radius: 20px 20px 0 0; overflow: hidden; }
.panel__head { padding: 12px 20px 4px; display: flex; align-items: center; justify-content: space-between; }
.panel__title { font-size: 19px; font-weight: 700; }
.panel__close { min-height: 44px; padding-left: 12px; display: flex; align-items: center; gap: 4px; font-size: 13px; color: var(--k-ink2); }
.panel__scroll { height: 48vh; }
.panel__content { padding: 8px 20px 20px; }
.panel__sub { display: block; margin: 8px 0 12px; font-size: 15px; font-weight: 600; }
.panel__opts { display: grid; grid-template-columns: repeat(12, minmax(0, 1fr)); gap: 8px; }
.opt { min-width: 0; min-height: 44px; padding: 10px 8px; border-radius: 12px; background: #F7F4EF; border: 1px solid transparent; display: flex; align-items: center; justify-content: center; font-size: 13px; color: var(--k-ink2); box-sizing: border-box; }
.opt text { text-align: center; line-height: 1.5; overflow-wrap: anywhere; }
.opt.on { background: #F3E5D2; border-color: var(--k-red); color: #795331; font-weight: 600; }
.panel__none { display: block; margin-top: 8px; font-size: 12px; color: var(--k-muted); }
.panel__line { height: 1px; margin: 24px 0; background: #EEE7DE; }
.panel__foot { padding: 12px 20px calc(16px + var(--k-safe-bottom)); display: flex; align-items: center; gap: 12px; border-top: 1px solid #EEE7DE; }
.panel__reset, .panel__ok { min-height: 48px; border-radius: 12px; display: flex; align-items: center; justify-content: center; font-size: 16px; box-sizing: border-box; }
.panel__reset { flex: 1; border: 1px solid #D8C5B0; color: #795331; }
.panel__ok { flex: 2; background: var(--k-red); color: var(--k-paper); font-weight: 600; }
.actives { margin-top: 10px; display: flex; flex-wrap: wrap; align-items: center; gap: 6px; }
.actives__chip { min-height: 36px; padding: 6px 10px; border-radius: 10px; background: #F3E5D2; color: #795331; font-size: 12px; display: flex; align-items: center; gap: 6px; box-sizing: border-box; }
.actives__chip text { min-width: 0; overflow-wrap: anywhere; }
.actives__clear { font-size: 12px; color: var(--k-muted); padding: 12px 4px; }
.rv { margin-top: 14px; padding: 16px; border-radius: 16px; background: var(--k-paper); border: 1px solid #EEE7DE; box-shadow: 0 4px 16px rgba(58, 50, 43, .035); }
.rv__head { display: flex; align-items: flex-start; gap: 10px; }
.rv__avatar { width: 36px; height: 36px; border-radius: 50%; flex: 0 0 auto; background: #F7F4EF; }
.rv__who { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 7px; }
.rv__line { display: flex; align-items: center; flex-wrap: wrap; gap: 6px; min-width: 0; }
.rv__name { max-width: 100%; font-size: 15px; font-weight: 600; overflow-wrap: anywhere; }
.rv__room { min-width: 0; padding: 3px 7px; border-radius: 6px; background: #F3E5D2; color: #795331; font-size: 11px; line-height: 1.4; overflow-wrap: anywhere; }
.rv__stars { display: flex; gap: 1px; flex: 0 0 auto; }
.rv__date { font-size: 11px; color: var(--k-muted); }
.rv__featured { flex: 0 0 auto; padding: 3px 6px; border-radius: 6px; background: #F3E5D2; color: #795331; font-size: 11px; }
.rv__text { margin-top: 14px; display: flex; flex-direction: column; gap: 4px; }
.rv__para { font-size: 15px; line-height: 1.75; color: var(--k-ink); overflow-wrap: anywhere; }
.rv__label { margin-right: 6px; font-size: 12px; font-weight: 600; color: var(--k-red-deep); }
.rv__copy { white-space: pre-wrap; }
.rv__pics { margin-top: 12px; display: grid; gap: 8px; grid-template-columns: repeat(2, minmax(0, 1fr)); }
.rv__pics--one { grid-template-columns: minmax(0, 1fr); }
.rv__cell { position: relative; width: 100%; height: 0; padding-bottom: 100%; border-radius: 10px; overflow: hidden; background: #F7F4EF; }
.rv__pics--one .rv__cell { padding-bottom: 75%; }
.rv__cell--lead { grid-column: span 2; padding-bottom: 66.67%; }
.rv__pic { position: absolute; left: 0; top: 0; width: 100%; height: 100%; }
.rv__video { position: relative; margin-top: 12px; width: 100%; height: 0; padding-bottom: 56.25%; border-radius: 10px; overflow: hidden; background: var(--k-ink); }
.rv__video-img { position: absolute; left: 0; top: 0; width: 100%; height: 100%; }
.rv__video-play { position: absolute; left: 50%; top: 50%; width: 52px; height: 52px; margin: -26px 0 0 -26px; border-radius: 50%; background: rgba(38, 32, 27, .55); border: 1px solid rgba(255, 255, 255, .8); display: flex; align-items: center; justify-content: center; }
.rv__video-tag { position: absolute; left: 10px; bottom: 10px; padding: 4px 8px; border-radius: 6px; background: rgba(38, 32, 27, .65); color: var(--k-paper); font-size: 11px; }
.rv__chips { margin-top: 12px; display: flex; flex-wrap: wrap; gap: 6px; }
.rv__chip { padding: 4px 8px; border-radius: 6px; background: #F7F4EF; color: var(--k-ink2); font-size: 11px; }
.rv__reply { margin-top: 14px; padding: 12px; border-radius: 10px; background: #F7F4EF; display: flex; flex-direction: column; gap: 6px; }
.rv__reply-who { font-size: 12px; font-weight: 600; color: var(--k-red-deep); }
.rv__reply-text { font-size: 13px; line-height: 1.7; color: var(--k-ink2); white-space: pre-wrap; overflow-wrap: anywhere; }
.sr-empty { margin-top: 40px; display: flex; flex-direction: column; align-items: center; text-align: center; }
.sr-empty--inline { margin-top: 28px; }
.sr-empty__img { width: 150px; height: 100px; }
.sr-empty__title { margin-top: 12px; font-size: 18px; font-weight: 600; }
.sr-empty__sub { margin-top: 8px; font-size: 13px; line-height: 1.7; color: var(--k-muted); white-space: pre-line; }
.sr-empty__btn { margin-top: 18px; min-height: 44px; padding: 0 22px; border-radius: 12px; background: var(--k-red); display: flex; align-items: center; color: var(--k-paper); font-size: 14px; font-weight: 600; }
.sr-more { display: block; margin-top: 20px; text-align: center; font-size: 12px; color: var(--k-muted); }
@media (max-width: 359px) {
  .sr-body { padding-left: 12px; padding-right: 12px; }
  .sum { padding-left: 12px; padding-right: 12px; }
  .sum__num, .sum__big { font-size: 28px; }
  .sum__dims { gap: 8px; }
  .bar { gap: 4px; }
  .bar__tabs { gap: 2px; }
  .bar__tab { padding: 0 8px; font-size: 13px; }
  .bar__filter { padding: 0 8px; font-size: 12px; }
  .rv { padding: 12px; }
}
/* 参考图的三列总览与横向分项；AI解释独立显示，避免模型分冒充原始评价分。 */
.sr-body { padding: 10px 12px calc(110px + var(--k-safe-bottom)); }
.sum { padding: 14px 12px 10px; border-radius: 13px; }
.sum__num, .sum__big { font-size: 36px; color: var(--k-ink); }
.sum__score, .sum__stat { gap: 6px; }
.sum__score-side { gap: 3px; }
.sum__cap { font-size: 12px; }
.sum__original { font-size: 10px; color: var(--k-muted); }
.sum__dims { margin-top: 12px; padding-top: 10px; gap: 6px; }
.sum__dim { flex-direction: row; justify-content: center; gap: 4px; }
.sum__dim-label { color: var(--k-ink); font-size: 12px; font-weight: 600; }
.sum__dim-num { font-size: 14px; }
.sum__note { margin-top: 10px; font-size: 10px; }
.ai-summary { margin-top: 10px; padding: 12px 14px; border-radius: 12px; background: var(--k-red-soft); }
.ai-summary__head { display: flex; flex-wrap: wrap; align-items: baseline; justify-content: space-between; gap: 5px; color: var(--k-red-deep); font-size: 14px; font-weight: 600; }
.ai-summary__head>text:last-child { font-size: 11px; font-weight: 400; color: var(--k-muted); }
.ai-summary__copy { display: block; margin-top: 7px; font-size: 14px; line-height: 1.65; overflow-wrap: anywhere; }
.ai-summary__line { display: flex; gap: 7px; margin-top: 7px; font-size: 12px; line-height: 1.6; color: var(--k-ink2); }
.ai-summary__line>text:last-child { flex: 1; min-width: 0; overflow-wrap: anywhere; }
.ai-summary__label { flex: 0 0 auto; font-weight: 600; color: var(--k-red-deep); }
.mention { margin-top: 18px; }
.mention__chips { gap: 7px; margin-top: 10px; }
.mention__chip { min-height: 32px; border-radius: 999px; padding: 0 11px; font-size: 12px; }
.mention__count { display: none; }
.bar { margin-top: 12px; }
.bar__tab { min-height: 36px; border-radius: 999px; font-weight: 600; }
.bar__filter { min-height: 32px; border-radius: 999px; }
.rv { margin-top: 10px; padding: 14px 12px; border-radius: 14px; }
.rv__head { gap: 8px; }
.rv__avatar { width: 30px; height: 30px; }
.rv__who { gap: 4px; }
.rv__line { gap: 5px; }
.rv__name { font-size: 14px; }
.rv__room { border-radius: 999px; padding: 2px 7px; font-size: 10px; }
.rv__date { font-size: 10px; }
.rv__text { margin-top: 10px; }
.rv__para { line-height: 1.65; }
.rv__video { margin-left: -12px; width: calc(100% + 24px); padding-bottom: 60.5%; border-radius: 0; }
.rv__pics { gap: 6px; }
@media (max-width:359px) {
 .sum__num,.sum__big { font-size: 30px; }
 .sum__cap { font-size: 11px; }
 .sum__dims { gap: 4px; }
 .sum__dim { gap: 3px; }
 .sum__dim-label { font-size: 11px; }
 .sum__dim-num { font-size: 13px; }
 .rv { padding: 12px; }
}
/* 原稿的暖色评分卡、同一行作者信息与右侧星级。 */
@import './stays-premium.scss';
.stay-reviews { @include stays-surface; background: linear-gradient(155deg,#F4E4D2 0,#FFFBF7 320px,#F5F5F4 620px); }
.sum { background: linear-gradient(125deg,var(--k-paper),#FFF9F2); border: 1px solid white; box-shadow: 0 3px 9px rgba(111,75,42,.15); }
.sum__score { align-items: flex-start; }
.sum__num,.sum__big { color: #452C1C; }
.sum__dim-num { color: #80512D; }
.sum__dims { padding-top: 11px; }
.mention__title { font-size: 19px; color: #4A2F1D; }
.mention__chips { gap: 7px; }
.mention__chip { min-height: 29px; padding: 0 10px; border-color: #AE8257; background: rgba(255,255,255,.7); }
.bar { margin-top: 10px; }
.bar__tab.on { background: linear-gradient(100deg,#F1CCA4,#E6B67E); color: #6B401E; }
.rv { border: 1px solid rgba(220,212,202,.55); box-shadow: 0 3px 7px rgba(61,47,34,.08); }
.rv__who { flex-direction: row; flex-wrap: wrap; align-items: flex-start; justify-content: space-between; gap: 5px; }
.rv__line { flex-wrap: wrap; }
.rv__who>.rv__line:first-child { flex: 1; min-width: 0; }
.rv__who>.rv__line:last-child { margin-left: auto; }
.rv__name { font-size: 14px; }
.rv__room { background: #F7E8D7; }
.rv__date { font-size: 10px; }
.rv__text { margin-left: 38px; }
.rv__para { font-size: 14px; line-height: 1.7; color: #352B24; }
.rv__video { margin-left: -12px; width: calc(100% + 24px); border-radius: 0; }
.rv__pics { gap: 6px; }
.rv__cell,.rv__video { background: #E8DFD4; }
@media(max-width:359px) { .rv__text { margin-left: 0; } .rv__who { gap: 3px; } .rv__room { padding: 2px 5px; font-size: 9px; } }
/* 参考稿：作者信息后缩进正文，三张照片同排、视频为正文列内的横向封面。 */
.stay-reviews { background: linear-gradient(155deg,#F9EBDB 0,#FFFAF5 220px,#F6F6F5 430px); }
.sum { padding: 14px 16px 10px; border-radius: 14px; }
.sum__top { justify-content: space-between; }
.sum__score,.sum__stat { flex: 1; align-items: center; }
.sum__num,.sum__big { font-size: 34px; line-height: 1.1; }
.sum__cap { font-size: 12px; white-space: nowrap; }
.sum__score-side { align-items: center; }
.sum__stars { gap: 0; }
.sum__note { font-size: 9px; }
.sum__dims { flex-wrap: wrap; }
.sum__dim { flex: 1; min-width: 48px; }
.mention { margin-top: 16px; }
.mention__title { font-size: 18px; }
.mention__chips { gap: 7px; }
.mention__chip { padding: 0 13px; font-size: 13px; min-height: 28px; }
.rv { padding: 13px 14px 15px; border-radius: 14px; }
.rv__who { display: block; position: relative; }
.rv__who>.rv__line:first-child { padding-right: 68px; }
.rv__who>.rv__line:last-child { position: absolute; top: 0; right: 0; }
.rv__room { max-width: 106px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.rv__date { margin-left: auto; }
.rv__text { margin: 13px 0 0 37px; }
.rv__para { font-size: 14px; line-height: 1.65; }
.rv__pics { margin: 10px 0 0 37px; grid-template-columns: repeat(3,minmax(0,1fr)); gap: 4px; }
.rv__pics--two { grid-template-columns: repeat(3,minmax(0,1fr)); }
.rv__pics--one { grid-template-columns: repeat(3,minmax(0,1fr)); }
.rv__cell,.rv__pics--one .rv__cell { padding-bottom: 100%; border-radius: 7px; }
.rv__video { margin: 10px 0 0 37px; width: calc(100% - 37px); padding-bottom: 48%; border-radius: 8px; }
.rv__video-tag { font-size: 10px; }
.rv__chips { margin-left: 37px; gap: 5px; }
.rv__chip { font-size: 11px; padding: 2px 6px; border-radius: 6px; }
@media(max-width:359px) {
 .sum { padding: 12px 10px; } .sum__num,.sum__big { font-size: 30px; } .sum__cap { font-size: 11px; }
 .rv__text,.rv__pics,.rv__video,.rv__chips { margin-left: 0; }
 .rv__video { width: 100%; padding-bottom: 56.25%; }
}
@import './reviews-reference.scss';

/* 2026-11-17 改版「小而精」（主人按样张第三版拍板）：浅灰底 + 纯白卡，不用阴影、不描边、不铺纸纹；评分总览、提到的词、页签、评价卡、筛选面板都收小一档，
   评价正文从加粗改回常规字重。功能和文字一样不少；上面几轮的规则保留不动，这里统一用 .stay-reviews 开头的规则盖过去。 */
.stay-reviews { @include stays-fine; background-image: none; }
.stay-reviews :deep(.k-topbar) { background-image: none; }
.stay-reviews .sr-body { padding: 8px 12px calc(110px + var(--k-safe-bottom)); }
.stay-reviews .sum { padding: 12px; border: 0; border-radius: 12px; background: var(--k-paper); box-shadow: none; }
.stay-reviews .sum__num, .stay-reviews .sum__big { color: var(--k-ink); font-family: var(--k-sans); font-size: 24px; font-weight: 700; line-height: 30px; letter-spacing: 0; }
.stay-reviews .sum__num { color: var(--k-red-deep); }
.stay-reviews .sum__percent { font-size: 12px; }
.stay-reviews .sum__cap { color: var(--k-muted); font-size: 11px; }
.stay-reviews .sum__div { height: 28px; background: var(--k-line); }
.stay-reviews .sum__dims { margin-top: 10px; padding-top: 10px; border-top-color: var(--k-line); }
.stay-reviews .sum__dim-label { color: var(--k-muted); font-size: 12px; font-weight: 400; }
.stay-reviews .sum__dim-num { color: var(--k-ink); font-size: 13px; font-weight: 600; }
.stay-reviews .sum__note { margin-top: 8px; color: var(--k-muted); font-size: 10px; }
.stay-reviews .ai-summary { margin-top: 8px; padding: 12px; border-radius: 12px; background: var(--k-paper); }
.stay-reviews .ai-summary__head { color: var(--k-ink); font-size: 14px; font-weight: 600; }
.stay-reviews .ai-summary__copy { margin-top: 6px; color: var(--k-ink2); font-size: 13px; line-height: 20px; }
.stay-reviews .ai-summary__line { margin-top: 6px; font-size: 12px; line-height: 18px; }
.stay-reviews .mention { margin-top: 14px; }
.stay-reviews .mention__title { color: var(--k-ink); font-family: var(--k-sans); font-size: 15px; font-weight: 700; line-height: 21px; }
.stay-reviews .mention__chips { gap: 6px; margin-top: 8px; }
.stay-reviews .mention__chip { min-height: 28px; padding: 0 12px; border: 1px solid transparent; border-radius: 14px; background: var(--k-paper); color: var(--k-ink2); font-size: 12px; font-weight: 400; }
.stay-reviews .mention__chip.on { border-color: var(--k-red-line); background: var(--k-red-soft); color: var(--k-red-deep); font-weight: 600; }
.stay-reviews .bar { margin-top: 12px; }
.stay-reviews .bar__tabs { gap: 2px; }
.stay-reviews .bar__tab { min-height: 28px; padding: 0 12px; border-radius: 14px; color: var(--k-ink2); font-size: 13px; font-weight: 400; }
.stay-reviews .bar__tab.on { background: var(--k-red-soft); color: var(--k-red-deep); font-weight: 600; }
.stay-reviews .bar__filter { min-height: 28px; padding: 0 8px 0 12px; gap: 2px; border: 0; border-radius: 14px; background: var(--k-paper); color: var(--k-ink2); font-size: 12px; }
.stay-reviews .bar__filter.on { background: var(--k-red-soft); color: var(--k-red-deep); }

.stay-reviews .actives { margin-top: 8px; }
.stay-reviews .actives__chip { min-height: 28px; padding: 0 8px 0 10px; gap: 4px; border-radius: 14px; background: var(--k-red-soft); color: var(--k-red-deep); font-size: 12px; }
.stay-reviews .actives__clear { padding: 8px 6px; color: var(--k-muted); }
.stay-reviews .rv { margin-top: 8px; padding: 12px; border: 0; border-radius: 12px; background: var(--k-paper); box-shadow: none; }
.stay-reviews .rv__avatar { width: 28px; height: 28px; background: var(--k-paper2); }
.stay-reviews .rv__name { color: var(--k-ink); font-size: 13px; font-weight: 600; line-height: 18px; }
.stay-reviews .rv__room { height: 17px; padding: 0 5px; border-radius: 4px; background: var(--k-fill); color: var(--k-ink2); font-size: 10px; font-weight: 500; line-height: 17px; }
.stay-reviews .rv__date { color: var(--k-muted); font-size: 11px; }
.stay-reviews .rv__featured { height: 17px; padding: 0 5px; border-radius: 4px; background: var(--k-ochre-soft); color: var(--k-ochre-deep); font-size: 10px; font-weight: 500; line-height: 17px; }
.stay-reviews .rv__para { color: var(--k-ink); font-size: 13px; font-weight: 400; line-height: 20px; }
.stay-reviews .rv__label { color: var(--k-red-deep); font-size: 12px; font-weight: 600; }
.stay-reviews .rv__cell, .stay-reviews .rv__pics--one .rv__cell { border-radius: 8px; background: var(--k-paper2); }
.stay-reviews .rv__video { border-radius: 8px; background: var(--k-ink); }
.stay-reviews .rv__video-play { width: 32px; height: 32px; margin: -16px 0 0 -16px; border: 0; border-radius: 50%; background: rgba(20,14,10,.5); }

.stay-reviews .rv__video-tag { left: 4px; bottom: 4px; height: 16px; padding: 0 5px; border-radius: 8px; background: rgba(20,14,10,.5); font-size: 10px; line-height: 16px; }
.stay-reviews .rv__chips { gap: 4px; }
.stay-reviews .rv__chip { height: 17px; padding: 0 5px; border: 0; border-radius: 4px; background: var(--k-fill); color: var(--k-ink2); font-size: 10px; font-weight: 500; line-height: 17px; }
.stay-reviews .rv__reply { margin-top: 10px; padding: 10px; gap: 4px; border-radius: 8px; background: var(--k-page); }
.stay-reviews .rv__reply-who { color: var(--k-red-deep); font-size: 12px; font-weight: 600; }
.stay-reviews .rv__reply-text { color: var(--k-ink2); font-size: 12px; line-height: 18px; }
.stay-reviews .sr-empty__img { width: 120px; height: 80px; border-radius: 12px; }
.stay-reviews .sr-empty__title { color: var(--k-ink); font-size: 15px; font-weight: 600; }
.stay-reviews .sr-empty__sub { margin-top: 6px; color: var(--k-muted); font-size: 12px; line-height: 18px; }
.stay-reviews .sr-empty__btn { min-height: 36px; margin-top: 14px; padding: 0 18px; border-radius: 18px; background: linear-gradient(135deg,#B5814D,#8E5E33); font-size: 13px; font-weight: 600; }
.stay-reviews .sr-more { margin-top: 14px; color: var(--k-muted); font-size: 11px; }
/* 筛选面板：16 圆角的底部弹层，选项 36 高浅灰块，底部两颗 42 高的胶囊钮 */
.stay-reviews .panel-mask { background: rgba(20,14,10,.4); }
.stay-reviews .panel { border-radius: 16px 16px 0 0; }
.stay-reviews .panel__head { padding: 8px 12px 0; }
.stay-reviews .panel__title { font-size: 16px; font-weight: 700; }
.stay-reviews .panel__close { color: var(--k-muted); font-size: 12px; }

.stay-reviews .panel__content { padding: 4px 12px 16px; }
.stay-reviews .panel__sub { margin: 8px 0; font-size: 13px; font-weight: 600; }
.stay-reviews .opt { min-height: 36px; padding: 6px; border-radius: 8px; background: var(--k-fill); color: var(--k-ink2); font-size: 13px; }
.stay-reviews .opt.on { border-color: var(--k-red-line); background: var(--k-red-soft); color: var(--k-red-deep); font-weight: 600; }
.stay-reviews .panel__line { margin: 16px 0 8px; background: var(--k-line); }
.stay-reviews .panel__foot { padding: 8px 12px calc(8px + var(--k-safe-bottom)); gap: 8px; border-top-color: var(--k-line); }
.stay-reviews .panel__reset, .stay-reviews .panel__ok { min-height: 42px; border-radius: 21px; font-size: 14px; }
.stay-reviews .panel__reset { border-color: var(--k-red-line); color: var(--k-red-deep); }
.stay-reviews .panel__ok { background: linear-gradient(135deg,#B5814D,#8E5E33); font-weight: 600; }
/* 2026-11-18 第二轮精修：评分总览只留总分一个重点（24 / 700 暖棕），评价数、推荐率收成 18 / 700 深墨，数字都等宽；星星和全组统一成赭黄 var(--k-ochre)；
   「大家提到」选中的胶囊留细棕边（放在浅灰页面底上，没边就和没选中分不开）、字重 500；评价列表为空时放进白卡，「清除筛选 / 回去看看小院 / 重新加载」改成 32 高的次按钮小胶囊（上下各多 4px 透明可点范围）。 */
.stay-reviews .sum__num { color: var(--k-red); font-variant-numeric: tabular-nums; }
.stay-reviews .sum__big { font-size: 18px; line-height: 30px; font-variant-numeric: tabular-nums; }
.stay-reviews .sum__dim-num { font-variant-numeric: tabular-nums; }
.stay-reviews .mention__chip.on { border-color: var(--k-red-line); font-weight: 500; }
.stay-reviews .sr-empty--inline { margin-top: 8px; padding: 28px 12px; border-radius: 12px; background: var(--k-paper); }
.stay-reviews .sr-empty--inline .sr-empty__title { margin-top: 0; color: var(--k-ink2); font-size: 14px; font-weight: 500; }
.stay-reviews .sr-empty--inline .sr-empty__sub { margin-top: 4px; line-height: 1.6; }
.stay-reviews .sr-empty__btn { position: relative; min-height: 32px; height: 32px; margin-top: 12px; padding: 0 14px; border: 1px solid var(--k-red-line); border-radius: 16px; background: var(--k-paper); color: var(--k-red-deep); font-size: 12px; font-weight: 500; }
.stay-reviews .sr-empty__btn::after { content: ''; position: absolute; left: 0; right: 0; top: -5px; bottom: -5px; }
@media (max-width: 359px) {
  .stay-reviews .sum__num { font-size: 22px; }
  .stay-reviews .bar__tab { padding: 0 8px; font-size: 12px; }
}
/* 2026-11-18 第三轮逐页精修：
   · 总评卡：内边距 16，综合分 28 / 700，星星固定 12、间距 1，和「综合评分」垂直居中；分项与上面空 12；
   · 「全部 / 有图·视频 / 差评」和「筛选」同一种 28 高胶囊：未选白底 12 二级墨，选中浅棕底深棕字；
   · 评价里的视频和照片对齐到同一套三列网格：照片 1:1 方格、间距 4；视频占两列宽、16:9，左边缘和照片一条线；
   · 卡与卡 8、卡内 16 / 12。 */
.stay-reviews .sum { padding: 16px 12px 14px; }
.stay-reviews .sum__num { font-size: 28px; line-height: 34px; }
.stay-reviews .sum__big { font-size: 20px; line-height: 34px; }
.stay-reviews .sum__score-side { gap: 2px; }
.stay-reviews .sum__stars { gap: 1px; align-items: center; }

.stay-reviews .sum__dims { margin-top: 12px; padding-top: 12px; }
.stay-reviews .bar { margin: 16px 0 4px; align-items: center; }
.stay-reviews .bar__tabs { gap: 8px; }
.stay-reviews .bar__tab { height: 28px; min-height: 28px; padding: 0 12px; border-radius: 14px; background: var(--k-paper); color: var(--k-ink2); font-size: 12px; font-weight: 400; display: flex; align-items: center; }
.stay-reviews .bar__tab.on { background: var(--k-red-soft); color: var(--k-red-deep); font-weight: 500; }
.stay-reviews .bar__filter { height: 28px; padding: 0 10px 0 12px; gap: 4px; }
.stay-reviews .rv { padding: 14px 12px; }
.stay-reviews .rv__pics, .stay-reviews .rv__pics--one, .stay-reviews .rv__pics--two { grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 4px; margin-top: 8px; }
.stay-reviews .rv__cell, .stay-reviews .rv__pics--one .rv__cell, .stay-reviews .rv__cell--lead { grid-column: auto; padding-bottom: 100%; border-radius: 8px; }
.stay-reviews .rv__video { margin: 10px 0 0 37px; width: calc((100% - 45px) * 2 / 3 + 4px); padding-bottom: calc(((100% - 45px) * 2 / 3 + 4px) * .5625); border-radius: 8px; }
.stay-reviews .rv__video + .rv__pics { margin-top: 4px; }
.stay-reviews .sr-more { padding: 16px 0 8px; }
@media (max-width: 359px) {
  .stay-reviews .bar__tabs { gap: 4px; }
  .stay-reviews .bar__tab { padding: 0 10px; }
}
/* 11-19 独立复评返修：320 宽评价里的视频和正文、照片对齐到同一条左线（不再缩进 37），宽度仍是三列网格里的两列 + 一个间距，16:9 */
@media (max-width: 359px) {
  .stay-reviews .rv__video { margin-left: 0; width: calc((100% - 8px) * 2 / 3 + 4px); padding-bottom: calc(((100% - 8px) * 2 / 3 + 4px) * .5625); }
}
/* 11-19 微信实拍返修：
   · 评价卡头：第一行只放名字 + 房型；入住月份挪到第二行跟在星星后面（隔 8），头像 28 和两行字上下居中；
   · 评价视频做主角：正文列满宽 16:9（375 宽约 290×163），照片在下面三列方格、间距 4，和视频左右边对齐，不再单独掉一行留一大块空；
   · 分项名「卫生 / 设施相符…」改二级墨 12/500，和正文隔 8；暖棕只留给大分数和选中胶囊。 */
.stay-reviews .rv__head { align-items: center; }
.stay-reviews .rv__who>.rv__line:first-child { padding-right: 0; }
.stay-reviews .rv__who>.rv__line:last-child { position: static; margin: 4px 0 0; gap: 8px; }
.stay-reviews .rv__who>.rv__line:last-child>.rv__date { margin-left: 0; }
.stay-reviews .rv__video { width: calc(100% - 37px); padding-bottom: calc((100% - 37px) * .5625); }
.stay-reviews .rv__label { margin-right: 8px; color: var(--k-ink2); font-size: 12px; font-weight: 500; }
@media (max-width: 359px) {
  .stay-reviews .rv__video { width: 100%; padding-bottom: 56.25%; }
}
</style>
