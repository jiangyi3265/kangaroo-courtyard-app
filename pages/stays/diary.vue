<template>
  <k-feature-gate feature="stay-booking" :bypass="source?.kind === 'job'">
  <view class="k-page diary-page" :class="{ 'diary-page--store': source && source.kind === 'job', 'diary-page--stay': stayEntry }" :style="{ '--stay-paper': 'url(' + STAY_ART.paper + ')' }">
    <k-topbar :title="source ? source.title : '近期生活碎片'" back />

    <!-- 「近期生活碎片」（2026-10-17 旅居改版 R3，主人效果图）：顶部是员工端上传的背景图，上面一张磨砂卡（叶子 + 小院日记 + 副标题 + 两三行文案）；
         下面两列错落的白卡：照片 / 视频（视频带小播放标记）、左上角拍摄日期（10.12）、下面一句话。
         主人：「背景图、文案、照片视频都是后台员工端上传」—— 全部来自 GET /app/stay/{stayId}/diary（只给显示中的），页面不写死内容 -->
    <view v-if="loaded && !loadError" class="dh">
      <image v-if="header.bg" class="dh__bg" :src="absUrl(header.bg)" mode="aspectFill" />
      <view class="dh__shade" />
      <view class="dh__card">
        <view class="dh__head"><view class="dh__leaf"><k-icon name="leaf" :size="28" color="#9A835F" :stroke="0.8" /></view><text class="dh__title">{{ header.title }}</text></view>
        <text class="dh__sub">{{ header.subtitle }}</text>
        <view v-if="header.lines.length" class="dh__lines"><text v-for="(lineText, lineIdx) in header.lines" :key="lineIdx" class="dh__line">{{ lineText }}</text></view>
      </view>
    </view>

    <!-- 2026-10-31 小院评论（V65）：只有小院入口有页签和「写评论」；岗位「店里日常」入口没有。底部全站导航和「发布」不动 -->
    <view v-if="stayEntry" class="dt">
      <view class="dt__tab" :class="{ on: tab === TAB_DIARY }" role="tab" :aria-selected="tab === TAB_DIARY" hover-class="k-press" @click="setTab(TAB_DIARY)"><text>小院日记</text></view>
      <view class="dt__tab" :class="{ on: tab === TAB_COMMENT }" role="tab" :aria-selected="tab === TAB_COMMENT" hover-class="k-press" @click="setTab(TAB_COMMENT)"><text>{{ commentTabText }}</text></view>
    </view>

    <view v-if="tab === TAB_COMMENT" class="dg-body">
      <text class="cm-tip">小伙伴写的日常，经平台审核后展示；不打星，不计入小院评分。</text>
      <view v-if="commentError" class="dg-empty">
        <text class="dg-empty__title">{{ commentError }}</text>
        <view class="dg-empty__btn" hover-class="k-press-s" @click="loadComments(false)"><text>重新加载</text></view>
      </view>
      <view v-else-if="!commentLoaded" class="dg-empty"><text class="dg-empty__sub">正在加载评论…</text></view>
      <view v-else-if="!comments.length" class="dg-empty">
        <image class="dg-empty__img" src="/static/media/stays-kangaroo-stamp.png" mode="aspectFit" />
        <text class="dg-empty__title">还没有小伙伴写评论</text>
        <text class="dg-empty__sub">住过、做过换工，或者来过这里，都可以写一写</text>
      </view>
      <view v-else class="cm-list">
        <view v-for="cmt in comments" :key="cmt.commentId" class="cc" :class="{ 'cc--hold': cmt.notice }">
          <view class="cc__head">
            <image v-if="cmt.avatar" class="cc__avatar" :src="absUrl(cmt.avatar)" mode="aspectFill" />
            <view v-else class="cc__avatar cc__avatar--none"><k-icon name="user" :size="16" color="#9A835F" :stroke="1.8" /></view>
            <view class="cc__who">
              <view class="cc__line"><text class="cc__name">{{ cmt.name }}</text><text class="cc__tag" :class="'cc__tag--' + cmt.identity">{{ cmt.identityText }}</text></view>
              <text class="cc__date">{{ cmt.dateText }}</text>
            </view>
          </view>
          <text class="cc__text" user-select>{{ cmt.content }}</text>
          <view v-if="cmt.images.length" class="cc__pics" :class="'cc__pics--' + cmt.grid">
            <view v-for="(img, imgIdx) in cmt.images" :key="imgIdx" class="cc__cell" role="button" aria-label="查看照片" hover-class="k-press-s" @click="previewComment(cmt, imgIdx)"><image class="cc__pic" :src="absUrl(img)" mode="aspectFill" lazy-load /></view>
          </view>
          <view v-if="cmt.video" class="cc__video" role="button" aria-label="播放视频" hover-class="k-press-s" @click="playComment(cmt)">
            <image v-if="cmt.video.cover" class="cc__pic" :src="absUrl(cmt.video.cover)" mode="aspectFill" lazy-load />
            <view class="cc__play"><k-icon name="play" :size="20" color="white" fill /></view>
          </view>
          <view v-if="cmt.notice" class="cc__notice" :class="'cc__notice--' + cmt.status"><text>{{ cmt.notice }}</text></view>
          <view class="cc__foot">
            <view v-if="cmt.isMe" class="cc__act" role="button" aria-label="删除我的评论" hover-class="k-press" @click="removeComment(cmt)"><text>删除</text></view>
            <view v-else-if="cmt.status === 'online'" class="cc__act" role="button" aria-label="举报这条评论" hover-class="k-press" @click="reportComment(cmt)"><text>举报</text></view>
          </view>
        </view>
      </view>
      <text v-if="comments.length || commentLoading" class="dg-more">{{ commentLoading ? '加载中…' : (commentHasMore ? '上滑加载更多' : '没有更多了') }}</text>
    </view>

    <view v-else class="dg-body">
      <view v-if="loadError" class="dg-empty">
        <text class="dg-empty__title">{{ loadError }}</text>
        <view class="dg-empty__btn" hover-class="k-press-s" @click="reload"><text>重新加载</text></view>
      </view>
      <view v-else-if="!loaded" class="dg-empty"><text class="dg-empty__sub">正在加载日常…</text></view>
      <view v-else-if="!cards.length" class="dg-empty">
        <image class="dg-empty__img" src="/static/media/stays-kangaroo-stamp.png" mode="aspectFit" />
        <text class="dg-empty__title">主理人还没有更新生活碎片</text>
        <text class="dg-empty__sub">过几天再来看看小院的日常吧～</text>
      </view>
      <view v-else class="dg">
        <view v-for="(colCards, colIdx) in columns" :key="colIdx" class="dg__col">
          <view v-for="(card, cardIdx) in colCards" :key="card.diaryId" class="dc" role="button" :aria-label="(card.type === 'video' ? '播放视频：' : '查看照片：') + (card.caption || '店里日常')" hover-class="k-press-s" @click="open(card)">
            <view class="dc__media" :class="{ 'dc__media--empty': !card.thumb, 'dc__media--portrait': colIdx === 0 ? cardIdx % 3 !== 1 : cardIdx % 3 === 1, 'dc__media--square': colIdx === 1 && cardIdx % 3 === 2 }">
              <image v-if="card.thumb" class="dc__img" :src="absUrl(card.thumb)" mode="aspectFill" lazy-load />
              <text v-if="card.date" class="dc__date">{{ card.date }}</text>
              <view v-if="card.type === 'video'" class="dc__play"><k-icon name="play" :size="12" color="red" fill /></view>
            </view>
            <text v-if="card.caption" class="dc__cap">{{ card.caption }}</text>
          </view>
        </view>
      </view>
      <text v-if="cards.length || listLoading" class="dg-more">{{ listLoading ? '加载中…' : (hasMore ? '上滑加载更多' : '没有更多了') }}</text>
    </view>
    <view v-if="stayEntry" class="dw" role="button" aria-label="写评论" hover-class="k-press-s" @click="writeComment"><k-icon name="pencil" :size="16" color="white" :stroke="2" /><text>写评论</text></view>
    <stay-video-player :src="playing.url" :poster="playing.cover" :title="header.title" @close="closeVideo" />
    <k-tabbar active="home" theme="journal" />
  </view>
</k-feature-gate>
</template>

<script setup>
import { stayBookingEnabled, refreshFeatures } from '@/common/features.js'
import { watch as watchStayGate } from 'vue'
// ---------------------------------------------------------------------------
// 小院「近期生活碎片」（2026-10-17 旅居改版 R3）。入口：房源详情「近期生活碎片」→ /pages/stays/diary?stayId=
//   GET /app/stay/{stayId}/diary?page=  顶部 {bg, title, subtitle, lines} + 显示中的生活碎片（每页 20 条，上滑加载）
// 点照片看大图（只翻照片），点视频全屏播放（stay-video-player，横拍的横屏占满）。
// 2026-10-31 小院评论（V65）：小院入口多一个「小伙伴评论」页签和固定的「写评论」按钮。
//   GET /app/stay/{stayId}/comments?page=  已通过的 rows（每页 20 条）+ 本人还没公开的 mine（只有第 1 页）；页面一进来就取，页签上要显示条数
//   通知带 tab=comment 打开这个页签（老版本不认这个参数，也能打开日记页）。写评论在 pages/profile/stay-comment。
// ---------------------------------------------------------------------------
import { ref, computed } from 'vue'
import { onReachBottom, onHide, onShow } from '@dcloudio/uni-app'
import { useScreen, go, toast } from '@/common/screen.js'
import { get, post, del } from '@/common/request.js'
import { errText, modal, confirm, sheet } from '@/common/ui.js'
import { absUrl } from '@/common/upload.js'
import { ensureSession, experience } from '@/common/experience.js'
import R from '@/common/routes.js'
import { diaryCard, twoColumns, diaryHeader, previewList, diarySource } from './stays-media.js'
import { TAB_DIARY, TAB_COMMENT, tabFromQuery, commentTabLabel, stayCommentWriteUrl, REPORT_REASONS, commentCard, commentList } from './stay-comments.js'
import StayVideoPlayer from './stay-video-player.vue'
import { STAY_ART } from './stays-art.js'

const source = ref(null)
const stayId = ref(0) // 只有小院入口才有；0 = 岗位「店里日常」入口，没有评论
const stayEntry = computed(() => stayId.value > 0)
useScreen(1, {
  onLoad: (q) => {
    source.value = diarySource(q)
    stayId.value = source.value && source.value.kind === 'stay' ? Number(q.stayId) : 0
    tab.value = tabFromQuery(q, stayId.value)
    reload()
    loadComments(false)
  }
})
const tab = ref(TAB_DIARY)
const setTab = (key) => { tab.value = key }

const header = ref(diaryHeader(null))
const cards = ref([])
const columns = computed(() => twoColumns(cards.value))
const loaded = ref(false)
const loadError = ref('')
const listLoading = ref(false)
const hasMore = ref(false)
let page = 1
let seq = 0

async function load(more) {
  if(source.value?.kind !== 'job' && !(await refreshFeatures()).stayBookingEnabled) return
  if (more && (!hasMore.value || listLoading.value)) return
  if (!source.value) {
    loadError.value = '没有找到这家小院'
    return
  }
  const mine = ++seq
  const next = more ? page + 1 : 1
  listLoading.value = true
  try {
    const res = (await get(source.value.url, { page: next })).data || {}
    if (mine !== seq) return
    header.value = diaryHeader(res.header)
    const list = (res.rows || []).map(diaryCard)
    cards.value = more ? cards.value.concat(list) : list
    page = next
    hasMore.value = !!res.hasMore
    loaded.value = true
    loadError.value = ''
  } catch (e) {
    if (mine !== seq) return
    if (more) toast(errText(e, '加载失败'))
    else loadError.value = errText(e, '生活碎片加载失败')
  } finally {
    if (mine === seq) listLoading.value = false
  }
}
const reload = () => load(false)
// 上滑只加载当前页签的下一页
onReachBottom(() => (tab.value === TAB_COMMENT ? loadComments(true) : load(true)))

// ---------------- 小伙伴评论 ----------------
const commentRows = ref([])
const commentMine = ref([])
const comments = computed(() => commentList(commentMine.value, commentRows.value))
const commentTotal = ref(null)
const commentTabText = computed(() => commentTabLabel(commentTotal.value))
const commentLoaded = ref(false)
const commentError = ref('')
const commentLoading = ref(false)
const commentHasMore = ref(false)
let commentPage = 1
let commentSeq = 0
async function loadComments(more) {
  if (!stayEntry.value) return
  if (more && (!commentHasMore.value || commentLoading.value)) return
  const mine = ++commentSeq
  const next = more ? commentPage + 1 : 1
  commentLoading.value = true
  try {
    const res = (await get('/app/stay/' + stayId.value + '/comments', { page: next })).data || {}
    if (mine !== commentSeq) return
    const list = (res.rows || []).map(commentCard)
    commentRows.value = more ? commentRows.value.concat(list) : list
    if (!more) commentMine.value = (res.mine || []).map(commentCard)
    commentTotal.value = Number(res.total) || 0
    commentPage = next
    commentHasMore.value = !!res.hasMore
    commentLoaded.value = true
    commentError.value = ''
  } catch (e) {
    if (mine !== commentSeq) return
    if (more) toast(errText(e, '加载失败'))
    else if (!commentLoaded.value) commentError.value = errText(e, '评论加载失败')
  } finally {
    if (mine === commentSeq) commentLoading.value = false
  }
}
// 写完、登录完回来要刷新；看大图回来（也会触发 onShow）不动。已经翻到后面几页时，切后台再回来也不把列表缩回第 1 页
let firstShow = true
let previewing = false
let mustRefresh = false
onShow(() => {
  if (firstShow) { firstShow = false; return }
  if (previewing) { previewing = false; return }
  if (mustRefresh || commentPage <= 1) {
    mustRefresh = false
    loadComments(false)
  }
})
async function needLogin(what) {
  await ensureSession()
  if (experience.account) return false
  const r = await modal('请先登录', what + '要先登录，登录后会回到这个页面。', { confirmText: '去登录', cancelText: '再看看' })
  if (r.confirm) {
    mustRefresh = true
    go(R.login)
  }
  return true
}
// 连点两下不开两个写评论页
let writeTappedAt = 0
async function writeComment() {
  const now = Date.now()
  if (now - writeTappedAt < 800) return
  writeTappedAt = now
  if (await needLogin('写评论')) return
  mustRefresh = true
  tab.value = TAB_COMMENT // 写完回来落在评论页签，马上能看到自己那条「审核中」
  go(stayCommentWriteUrl(stayId.value))
}
function previewComment(c, i) {
  previewing = true
  uni.previewImage({ urls: c.images.map(absUrl), current: absUrl(c.images[i]), fail: () => { previewing = false } })
}
const playComment = (c) => { if (c.video) playing.value = { url: c.video.url, cover: c.video.cover } }
async function removeComment(c) {
  if (!(await confirm('删除这条评论？', '删除后不能恢复。'))) return
  try {
    const res = await del('/app/stay/comments/' + c.commentId)
    toast(res.msg || '已删除')
    loadComments(false)
  } catch (e) {
    toast(errText(e, '删除失败'))
  }
}
async function reportComment(c) {
  if (await needLogin('举报')) return
  const i = await sheet(REPORT_REASONS)
  if (i < 0) return
  try {
    const res = await post('/app/stay/comments/' + c.commentId + '/report', { reason: REPORT_REASONS[i] })
    toast(res.msg || '举报已提交')
  } catch (e) {
    toast(errText(e, '举报失败'))
  }
}

// 正在播的视频；空对象 = 没在播
const playing = ref({})
const closeVideo = () => { playing.value = {} }
onHide(closeVideo)
function open(card) {
  if (card.type === 'video') {
    if (!card.url) return toast('视频暂时看不了')
    playing.value = { url: card.url, cover: card.thumb }
    return
  }
  const p = previewList(cards.value, card)
  if (p.urls.length) {
    previewing = true
    uni.previewImage({ urls: p.urls.map(absUrl), current: absUrl(p.current) })
  }
}
watchStayGate(stayBookingEnabled, enabled => { if(enabled) load() })
</script>

<style scoped lang="scss">
@import '../../styles/look.scss';
@import './reference-font.scss';
.diary-page { --k-sans: 'KG Detail', 'PingFang SC', 'Microsoft YaHei', sans-serif; font-family: var(--k-sans); --k-bg: #FCF9F3; background: var(--k-bg); }
/* 图文高度随员工文案展开，长标题和三行长文案不会被固定高度裁掉。 */
.dh { position: relative; min-height: 220px; padding: 20px 14px; box-sizing: border-box; display: flex; align-items: center; background: #E9E0D3; }
.dh__bg { position: absolute; inset: 0; width: 100%; height: 100%; }
.dh__shade { position: absolute; inset: 0; background: rgba(58, 50, 43, .08); }
.dh__card { position: relative; width: 85%; max-width: 420px; box-sizing: border-box; padding: 18px; border-radius: 16px; background: rgba(252, 249, 243, .9); border: 1px solid rgba(255, 255, 255, .65); overflow-wrap: anywhere; }
.dh__head { display: flex; align-items: flex-start; gap: 10px; }
.dh__leaf { width: 24px; height: 28px; flex-shrink: 0; display: flex; align-items: center; justify-content: center; }
.dh__title { min-width: 0; font-size: 23px; font-weight: 700; line-height: 1.35; color: var(--k-ink); }
.dh__sub { display: block; margin-top: 8px; font-size: 14px; line-height: 1.65; color: var(--k-ink2); }
.dh__lines { margin-top: 14px; display: flex; flex-direction: column; gap: 4px; }
.dh__line { font-size: 14px; line-height: 1.75; color: var(--k-ink2); }
@media (max-width: 359px) { .dh__card { width: 94%; padding: 16px; } .dh__title { font-size: 21px; } }

/* 两列错落的白卡 */
.dg-body { padding: 16px 14px calc(110px + var(--k-safe-bottom)); }
.dg { display: flex; align-items: flex-start; gap: 12px; }
.dg__col { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 12px; }
.dc { border-radius: 16px; background: var(--k-paper); border: 1px solid #ECE3D9; box-shadow: 0 3px 12px rgba(58,50,43,.06); overflow: hidden; }
.dc__media { position: relative; background: var(--k-paper2); }
.dc__media--empty { height: 0; padding-bottom: 75%; background: #3A322B; }
.dc__img { display: block; width: 100%; }
.dc__date { position: absolute; left: 8px; top: 8px; height: 22px; padding: 0 9px; border-radius: 11px; background: #8A5E36; color: #fff; font-family: var(--k-sans); font-size: 11px; font-weight: 700; line-height: 22px; letter-spacing: .3px; } /* 参考图 11：左上暖棕日期胶囊 */
.dc__play { position: absolute; left: 8px; bottom: 8px; width: 28px; height: 28px; border-radius: 50%; background: rgba(255, 255, 255, .94); box-shadow: 0 2px 8px rgba(36, 27, 23, .22); display: flex; align-items: center; justify-content: center; } /* 视频：左下白色小播放圆钮 */
.dc__cap { display: block; padding: 10px 12px 12px; font-size: 15px; font-weight: 700; color: $look-ink; line-height: 1.55; word-break: break-all; }

.dg-empty { margin-top: 30px; display: flex; flex-direction: column; align-items: center; text-align: center; }
.dg-empty__img { width: 150px; height: 100px; }
.dg-empty__title { margin-top: 12px; font-size: 16px; font-weight: 700; color: var(--k-ink); }
.dg-empty__sub { margin-top: 6px; font-size: 13px; color: var(--k-muted); }
.dg-empty__btn { margin-top: 16px; height: 38px; padding: 0 20px; border-radius: 999px; background: $look-grad-brown; display: flex; align-items: center; color: #fff; font-size: 14px; font-weight: 700; }
.dg-more { display: block; margin-top: 16px; text-align: center; font-size: 12px; color: var(--k-muted); }
/* 两列封面遵循参考稿的交错比例；打开后仍为员工上传原图。 */
@import './stays-premium.scss';
.diary-page { @include stays-surface; }
.dh { min-height: 185px; padding: 14px 12px; }
.dh__card { width: 88%; padding: 14px 16px; border-radius: 14px; background: linear-gradient(90deg,rgba(255,249,240,.95),rgba(255,249,240,.6)); border: 1px solid rgba(255,255,255,.55); }
.dh__head { gap: 8px; }
.dh__leaf { height: 28px; width: 24px; }
.dh__title { font-size: 18px; color: #714429; letter-spacing: 1px; }
.dh__sub { margin-top: 5px; margin-left: 32px; font-size: 12px; font-weight: 600; line-height: 1.5; color: #714429; }
.dh__lines { margin-top: 14px; gap: 3px; }
.dh__line { font-size: 13px; line-height: 1.65; color: #714429; }
.dg-body { padding: 12px 12px calc(95px + var(--k-safe-bottom)); }
.dg { gap: 10px; }
.dg__col { gap: 10px; }
.dc { border-radius: 12px; border-color: #E9DFD3; box-shadow: 0 2px 5px rgba(89,57,31,.13); }
.dc__media,.dc__media--empty { height: 0; padding-bottom: 65%; overflow: hidden; }
.dc__media--portrait { padding-bottom: 107%; }
.dc__media--square { padding-bottom: 112%; }
.dc__img { position: absolute; inset: 0; width: 100%; height: 100%; }
.dc__date { top: 8px; left: 8px; height: 24px; line-height: 24px; font-size: 13px; padding: 0 9px; border-radius: 999px; background: #AA743D; }
.dc__play { background: rgba(255,255,255,.65); }
.dc__cap { padding: 7px 10px 9px; font-size: 14px; line-height: 1.4; color: #714429; }
@media (max-width:359px) { .dh__card { width: 92%; padding: 12px; } .dh__title { font-size: 18px; } .dh__sub { margin-left: 0; } }

/* 岗位入口：介绍卡向右渐隐，留出一侧小院景色；长文案自然撑开。 */
.diary-page--store {
  .dh { min-height: 188px; padding: 14px 12px; }
  .dh__card { width: 88%; border: 0; background: linear-gradient(100deg, rgba(255,249,240,.96) 0%, rgba(255,249,240,.88) 58%, rgba(255,249,240,.36) 100%); }
  .dh__leaf { color: #9A835F; }
  .dc__cap { font-weight: 600; }
}

.dh__card { border: 0; background: linear-gradient(100deg,rgba(255,249,240,.96) 0%,rgba(255,249,240,.88) 58%,rgba(255,249,240,.36) 100%); }
.dh__lines { padding-left: 12px; }
.diary-page { background-image: var(--stay-paper); background-size: 96px 96px; }
.diary-page :deep(.k-topbar) { background-image: var(--stay-paper); background-size: 96px 96px; }

/* 2026-10-31 小院评论：页签、固定的「写评论」、评论卡 */
.dt { display: flex; align-items: center; gap: 24px; padding: 8px 16px 0; }
.dt__tab { position: relative; padding: 8px 0 10px; font-size: 15px; font-weight: 600; color: #7A6A5C; }
.dt__tab.on { font-weight: 700; color: #714429; }
.dt__tab.on::after { content: ''; position: absolute; left: 0; right: 0; bottom: 2px; height: 3px; border-radius: 2px; background: #AA743D; }
.diary-page--stay .dg-body { padding-bottom: calc(136px + var(--k-safe-bottom)); }
.dw { position: fixed; right: 14px; bottom: calc(70px + var(--k-safe-bottom)); z-index: 45; height: 44px; padding: 0 18px; border-radius: 22px; background: $look-grad-brown; box-shadow: 0 4px 12px rgba(89, 57, 31, .28); display: flex; align-items: center; gap: 6px; color: #fff; font-size: 15px; font-weight: 700; }

.cm-tip { display: block; margin-bottom: 10px; font-size: 12px; line-height: 1.6; color: #7A6A5C; }
.cc { margin-bottom: 10px; padding: 12px; border-radius: 12px; background: var(--k-paper); border: 1px solid #E9DFD3; box-shadow: 0 2px 5px rgba(89, 57, 31, .08); }
.cc--hold { background: #FBF4EA; border-color: #E5D3BC; }
.cc__head { display: flex; align-items: center; gap: 8px; }
.cc__avatar { flex-shrink: 0; width: 34px; height: 34px; border-radius: 50%; background: #F1E8DC; }
.cc__avatar--none { display: flex; align-items: center; justify-content: center; }
.cc__who { flex: 1; min-width: 0; }
.cc__line { display: flex; flex-wrap: wrap; align-items: center; gap: 2px 6px; }
.cc__name { font-size: 14px; font-weight: 600; color: var(--k-ink); overflow-wrap: anywhere; }
.cc__tag { padding: 1px 6px; border-radius: 4px; font-size: 11px; line-height: 16px; }
.cc__tag--guest { background: #E5F1E7; color: #1E6B48; }
.cc__tag--volunteer { background: #F4E6D3; color: #7A4D26; }
.cc__tag--unverified { background: #EEEAE4; color: #625448; }
.cc__date { display: block; font-size: 12px; color: #7A6A5C; }
.cc__text { display: block; margin-top: 8px; font-size: 14px; line-height: 1.65; color: var(--k-ink); white-space: pre-wrap; overflow-wrap: anywhere; }
.cc__pics { margin-top: 8px; display: grid; gap: 6px; grid-template-columns: repeat(3, minmax(0, 1fr)); }
.cc__pics--two { grid-template-columns: repeat(2, minmax(0, 1fr)); }
.cc__pics--one { grid-template-columns: minmax(0, 70%); }
.cc__cell { position: relative; height: 0; padding-bottom: 100%; border-radius: 8px; overflow: hidden; background: #F1E8DC; }
.cc__pics--one .cc__cell { padding-bottom: 75%; }
.cc__pic { position: absolute; left: 0; top: 0; width: 100%; height: 100%; }
.cc__video { position: relative; margin-top: 8px; width: 100%; height: 0; padding-bottom: 56.25%; border-radius: 8px; overflow: hidden; background: #3A322B; }
.cc__play { position: absolute; left: 50%; top: 50%; width: 44px; height: 44px; margin: -22px 0 0 -22px; border-radius: 50%; background: rgba(38, 32, 27, .55); display: flex; align-items: center; justify-content: center; }
.cc__notice { margin-top: 8px; padding: 6px 10px; border-radius: 8px; font-size: 13px; line-height: 1.55; background: #F4E6D3; color: #7A4D26; }
.cc__notice--rejected, .cc__notice--offline { background: #F8E7E3; color: #A33A2C; }
.cc__foot { display: flex; justify-content: flex-end; min-height: 8px; }
.cc__act { margin: 2px -6px -6px 0; padding: 8px 6px; font-size: 13px; color: #7A6A5C; }

</style>
