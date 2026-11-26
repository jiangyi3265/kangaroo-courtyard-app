<template>
  <!-- 亲友打开的行程页（2026-10-31 主人：「分享过去就是这个人在哪天哪月去哪个地方」）：不用登录，链接只带岗位、日期、时长、称呼，不查报名，页面上没有手机号。 -->
  <view class="k-page trip-page" :class="[$userSurface, { 'trip-page--state': state !== 'ready' }]">
    <k-topbar title="TA 的行程" back />
    <view class="trip" :class="{ 'trip--ready': state === 'ready' }">
      <!-- 链接坏了：岗位编号或日期不对 -->
      <view v-if="state === 'invalid'" class="trip-card trip-state">
        <view class="trip-state__icon"><k-icon name="link-2" :size="32" color="muted" /></view>
        <text class="trip-state__title">这个行程链接打不开了</text>
        <text class="trip-state__text">可以让 TA 重新分享一次，或者先看看袋鼠全球青年。</text>
      </view>
      <view v-else-if="state === 'loading'" class="trip-card trip-state"><text class="trip-state__text">正在读取行程…</text></view>
      <!-- 网络问题：给重试 -->
      <view v-else-if="state === 'failed'" class="trip-card trip-state" role="button" hover-class="k-press-s" @click="load">
        <view class="trip-state__icon"><k-icon name="refresh-cw" :size="32" color="muted" /></view>
        <text class="trip-state__title">行程暂时没读出来</text>
        <text class="trip-state__text">{{ loadError }}，点这里重试</text>
      </view>
      <!-- 岗位下架了：还写称呼和日期，不写地点 -->
      <view v-else-if="state === 'gone'" class="trip-card trip-state">
        <view class="trip-state__icon"><k-icon name="calendar-days" :size="32" color="muted" /></view>
        <text class="trip-state__title">{{ goneTitle }}</text>
        <text class="trip-state__text">这个岗位现在已经下架，具体的地点和安排可以直接问问 TA。</text>
      </view>
      <template v-else>
        <image class="trip-hero" :src="heroImg" mode="aspectFill" />
        <view class="trip-card trip-main">
          <text class="trip-title">{{ title }}</text>
          <view class="trip-rows">
            <view v-for="row in rows" :key="row.label" class="trip-row">
              <view class="trip-row__icon"><k-icon :name="row.icon" :size="16" color="red" /></view>
              <text class="trip-row__label">{{ row.label }}</text>
              <text class="trip-row__value">{{ row.value }}</text>
            </view>
          </view>
          <text class="trip-foot">这是 TA 分享给你的行程，不会显示手机号</text>
        </view>
      </template>
    </view>
    <k-bottom v-if="state !== 'loading' && state !== 'failed'" flat>
      <view class="k-flex1"><k-button block :label="state === 'ready' ? '查看这个地方' : '去袋鼠全球青年看看'" @click="onMain" /></view>
    </k-bottom>
  </view>
</template>

<script setup>
import { computed, ref } from 'vue'
import { onLoad, onShareAppMessage } from '@dcloudio/uni-app'
import { apiJobDetail } from '@/common/api.js'
import { decodeQuery, go, relaunch } from '@/common/screen.js'
import { absUrl } from '@/common/upload.js'
import R from '@/common/routes.js'
import { arrivalText, durationLabel } from './apply-flow.js'
import { jobShareFallback, monthDay, parseTripQuery, tripImageUrl, tripShareMessage, tripTitle } from './trip-share.js'

const query = ref({ invalid: true })
const job = ref(null)
// loading 读取中 / ready 正常 / invalid 链接参数不对 / gone 岗位没了 / failed 网络问题
const state = ref('loading')
const loadError = ref('')

const load = async () => {
  if (query.value.invalid) { state.value = 'invalid'; return }
  state.value = 'loading'
  try {
    const d = (await apiJobDetail(query.value.jobId))?.data
    // 线上任务没有到店这回事，正常分享不会有这种链接
    if (d && d.jobType === 'online') { state.value = 'invalid'; return }
    if (!d || !d.title) { state.value = 'gone'; return }
    job.value = d
    state.value = 'ready'
  } catch (e) {
    if (e?.code === 400 || e?.code === 404 || /不存在|已下架|已删除/.test(String(e?.message || ''))) state.value = 'gone'
    else { loadError.value = e?.message || '网络连接失败'; state.value = 'failed' }
  }
}
onLoad((q0) => {
  query.value = parseTripQuery(decodeQuery(q0))
  load()
})

const place = computed(() => { const d = job.value || {}; return d.storeName || d.store?.storeName || d.city || '' })
const city = computed(() => String(job.value?.city || '').split('·')[0].trim())
const heroImg = computed(() => {
  const d = job.value || {}
  return absUrl((Array.isArray(d.images) && d.images[0]) || d.cover) || '/static/media/cover-empty.png'
})
const tripData = computed(() => ({ name: query.value.name, arrival: query.value.date, days: query.value.days, jobId: query.value.jobId, place: place.value, jobType: job.value?.jobType, imageUrl: tripImageUrl(heroImg.value) }))
const title = computed(() => tripTitle(tripData.value))
const goneTitle = computed(() => query.value.name + ' ' + monthDay(query.value.date) + ' 出发')
const rows = computed(() => [
  { icon: 'calendar-days', label: '日期', value: arrivalText(query.value.date) },
  { icon: 'map-pin', label: '地点', value: [place.value, city.value].filter((x, i, all) => x && all.indexOf(x) === i).join(' · ') },
  { icon: 'briefcase-business', label: '岗位', value: job.value?.title || '' },
  { icon: 'hourglass', label: '预计时长', value: durationLabel(query.value.days) }
].filter(row => row.value))

const onMain = () => {
  if (state.value === 'ready') go(R.jobDetail + '?jobId=' + query.value.jobId)
  else relaunch('/pages/home/index')
}
// 亲友再转发：地点、岗位都是打开时按岗位查的，转发的链接和原来一样
onShareAppMessage(() => (state.value === 'ready'
  ? tripShareMessage(tripData.value, jobShareFallback(query.value.jobId, job.value?.title))
  : jobShareFallback(0, '袋鼠全球青年')))
</script>

<style scoped lang="scss">
.trip-page { --k-bg: #FCF9F3; background: #FCF9F3; }
.trip { padding: 8px 16px calc(96px + var(--k-safe-bottom)); }
.trip-card { border: 1px solid #E9DFD3; border-radius: 15px; background: var(--k-paper); box-shadow: 0 3px 10px rgba(91, 61, 32, .04); }
.trip-hero { display: block; width: 100%; height: 190px; border-radius: 15px; background: var(--k-paper2); }
.trip-main { margin-top: 12px; padding: 18px 16px 8px; }
/* 只在空格处折行，「做换工」不拆成两行；太长的店名才断开 */
.trip-title { display: block; font-family: var(--k-display-font); font-size: 21px; line-height: 31px; font-weight: 700; color: #3B2A1E; word-break: keep-all; overflow-wrap: anywhere; }
.trip-rows { margin-top: 10px; }
.trip-row { min-height: 52px; padding: 8px 0; display: flex; align-items: center; gap: 10px; box-sizing: border-box; }
.trip-row + .trip-row { border-top: 0; background-image: linear-gradient(to bottom, var(--k-line) 50%, transparent 50%); background-size: 100% 1px; background-repeat: no-repeat; background-position: left top; }
.trip-row__icon { flex: 0 0 auto; width: 32px; height: 32px; border-radius: 9px; background: #F5E9D8; display: flex; align-items: center; justify-content: center; }
.trip-row__label { flex: 0 0 auto; width: 64px; font-size: 14px; color: var(--k-muted); }
.trip-row__value { flex: 1; min-width: 0; font-size: 15px; line-height: 22px; font-weight: 600; color: var(--k-ink); text-align: right; overflow-wrap: anywhere; }
.trip-foot { display: block; margin-top: 12px; text-align: center; font-size: 13px; line-height: 20px; color: var(--k-muted); }
.trip-state { margin-top: 24px; padding: 28px 20px; display: flex; flex-direction: column; align-items: center; gap: 8px; text-align: center; }
.trip-state__icon { width: 52px; height: 52px; border-radius: 50%; background: #F5E9D8; display: flex; align-items: center; justify-content: center; }
.trip-state__title { font-family: var(--k-display-font); font-size: 18px; line-height: 26px; font-weight: 700; color: #3B2A1E; }
.trip-state__text { font-size: 14px; line-height: 22px; color: var(--k-ink2); }
.trip-page .k-bottom :deep(.k-button.is-primary) { background: #8A603D; box-shadow: 0 3px 9px rgba(95, 58, 27, .12); }
/* 2026-11-17 改版「小而精」：浅灰底 + 白卡（12 圆角、不描边、不加阴影）；封面照片完整露出；标题 17 / 700，四行信息的图标放在 32 的浅色圆角方块里；
   底部按钮是 44 高的暖棕渐变胶囊。亲友看的页面，字不再往下缩。 */
.trip-page { --k-bg: #F7F5F2; background: #F7F5F2; }
.trip { padding: 8px 12px calc(96px + var(--k-safe-bottom)); }
.trip-card { border: 0; border-radius: 12px; box-shadow: none; }
.trip-hero { height: 200px; border-radius: 12px; }
.trip-main { margin-top: 8px; padding: 14px 12px 4px; }
.trip-title { font-family: var(--k-sans); font-size: 17px; line-height: 25px; color: var(--k-ink); }
.trip-rows { margin-top: 6px; }
.trip-row { min-height: 50px; }
.trip-row__icon { border-radius: 10px; background: linear-gradient(160deg, #FFF6EA, #FFE7CC); }

.trip-row__label { width: 60px; font-size: 13px; }
.trip-row__value { font-size: 14px; line-height: 20px; }
.trip-foot { font-size: 12px; line-height: 18px; }
.trip-state { margin-top: 12px; }
.trip-state__icon { width: 48px; height: 48px; border-radius: 14px; background: linear-gradient(160deg, #FFF6EA, #FFE7CC); }
.trip-state__title { font-family: var(--k-sans); font-size: 16px; line-height: 24px; color: var(--k-ink); }
.trip-state__text { font-size: 13px; line-height: 20px; }
.trip-page .k-bottom { background: #FFFFFF; }
.trip-page .k-bottom :deep(.k-button.is-lg) { height: 44px; border-radius: 22px; font-size: 15px; }
.trip-page .k-bottom :deep(.k-button.is-primary) { background: linear-gradient(135deg, #B5814D, #8E5E33); box-shadow: none; }
/* 第二轮：底部操作条白底 + 顶上一条发丝线（flat 的顶线是透明的） */
.trip-page .k-bottom { border-top-color: transparent; }
.trip-page .k-bottom::before { content: ''; position: absolute; left: 0; right: 0; top: 0; height: 1px; background: var(--k-line); transform: scaleY(.5); pointer-events: none; }
/* ==== r3jobsb 第三轮 start ==== */
/* 第三轮（11-18）：状态卡按全站空状态——56 浅棕圆角方块 + 28 号图标、标题 14/500/ink2、说明 12/muted；页边距 16；头图固定 4:3 */
.trip { padding-left: 16px; padding-right: 16px; }
.trip-state { margin-top: 16px; padding: 32px 24px; gap: 0; }
.trip-state__icon { width: 56px; height: 56px; border-radius: 16px; background: var(--k-red-soft); }

.trip-state__title { margin-top: 12px; font-size: 14px; font-weight: 500; line-height: 20px; color: var(--k-ink2); }
.trip-state__text { margin-top: 4px; font-size: 12px; line-height: 1.6; color: var(--k-muted); }
.trip-state__icon + .trip-state__text { margin-top: 12px; }
.trip-hero { height: auto; aspect-ratio: 4 / 3; }
.trip-main { padding: 16px 16px 4px; }
.trip-row__icon { width: 32px; height: 32px; border-radius: 10px; background: var(--k-red-soft); }
.trip-row__label { color: var(--k-muted); }
/* —— 返修 4 start（11-18 夜）—— */
.trip-page { --k-bg: var(--k-page); background: var(--k-page); }
/* 头图和信息合成一张卡：头图只圆上面两个角，信息紧贴在下面 */
.trip-hero { border-radius: 12px 12px 0 0; }
.trip-main { margin-top: 0; border-radius: 0 0 12px 12px; }
/* 信息行：数值跟在标签后面左对齐，长岗位名折两行也整齐 */
.trip-row__value { text-align: left; }
/* 链接坏了 / 读不出 / 下架：不要白卡，整组空状态放到约 30% 屏高 */
.trip-state { margin-top: 22vh; padding: 0 16px; background: none; }
/* —— 返修 4 end —— */
/* —— 返修 5 start（11-18 深夜）—— */
/* 说明收进信息卡底部：发丝线下、12 灰字居中，卡片外不留零散文字 */
.trip-main .trip-foot { position: relative; margin: 4px 0 0; padding: 12px 0; text-align: center; font-size: 12px; line-height: 18px; color: var(--k-muted); }
.trip-main .trip-foot::before { content: ''; position: absolute; left: 0; right: 0; top: 0; height: 1px; background: var(--k-line); transform: scaleY(.5); transform-origin: 0 0; }
/* 链接打不开：说明两行均分，「青年。」不单独掉行 */
.trip-state__text { text-wrap: balance; }
@media (max-width: 359px) { .trip-state { padding-left: 20px; padding-right: 20px; } }
/* —— 返修 5 end —— */
/* ==== r3jobsb 第四轮 start（11-18 夜，以微信实拍为准）==== */
/* 链接失效 / 岗位下架：空状态放大一档，按钮紧跟在说明下面 24（宽 240、高 40），做成一个完整的居中模块 */
.trip-page--state .trip { padding-bottom: 0; }
.trip-page--state .trip-state { margin-top: 24vh; }
.trip-page--state :deep(.k-bottom::before) { display: none; }
.trip-page--state .trip-state__title { font-size: 16px; font-weight: 600; line-height: 24px; color: var(--k-ink); }
.trip-page--state .trip-state__text { font-size: 13px; line-height: 1.6; }
.trip-page--state :deep(.k-bottom) { position: static; border-top: 0; background: transparent; }
.trip-page--state :deep(.k-bottom__inner) { justify-content: center; padding: 24px 16px 0 !important; }
.trip-page--state :deep(.k-bottom__safe) { display: none; }
.trip-page--state .k-flex1 { flex: 0 0 240px; width: 240px; }
.trip-page--state .k-flex1 :deep(.k-button) { height: 40px; border-radius: 20px; }
/* ==== r3jobsb 第四轮 end ==== */
/* ==== r3jobsb 第四轮返修 start（11-19，复评遗留）==== */
/* 整组上移到 20vh；说明最宽 280、只在标点处折行，320 宽不会最后掉一个「年。」 */
.trip-page--state .trip-state { margin-top: 20vh; }
.trip-page--state .trip-state__text { max-width: 280px; margin-left: auto; margin-right: auto; word-break: keep-all; overflow-wrap: anywhere; }
/* ==== r3jobsb 第四轮返修 end ==== */
/* ==== r3jobsb 第五轮 start（11-19，按微信实拍复评）==== */
/* 打不开 / 没读出来 / 已下架：本组统一的空状态方块——56、圆角 16、中性浅底、32 号灰色线性图标 */
.trip-page .trip-state__icon { background: var(--k-fill); }
/* ==== r3jobsb 第五轮 end ==== */
/* ==== r3jobsb 第三轮 end ==== */
</style>
