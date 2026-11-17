<template>
  <!-- 亲友打开的行程页（2026-10-31 主人：「分享过去就是这个人在哪天哪月去哪个地方」）：不用登录，链接只带岗位、日期、时长、称呼，不查报名，页面上没有手机号。 -->
  <view class="k-page trip-page">
    <k-topbar title="TA 的行程" back />
    <view class="trip" :class="{ 'trip--ready': state === 'ready' }">
      <!-- 链接坏了：岗位编号或日期不对 -->
      <view v-if="state === 'invalid'" class="trip-card trip-state">
        <view class="trip-state__icon"><k-icon name="info" :size="24" color="#8A5E36" :stroke="1.8" /></view>
        <text class="trip-state__title">这个行程链接打不开了</text>
        <text class="trip-state__text">可以让 TA 重新分享一次，或者先看看袋鼠全球青年。</text>
      </view>
      <view v-else-if="state === 'loading'" class="trip-card trip-state"><text class="trip-state__text">正在读取行程…</text></view>
      <!-- 网络问题：给重试 -->
      <view v-else-if="state === 'failed'" class="trip-card trip-state" role="button" hover-class="k-press-s" @click="load">
        <view class="trip-state__icon"><k-icon name="refresh-cw" :size="24" color="#8A5E36" :stroke="1.8" /></view>
        <text class="trip-state__title">行程暂时没读出来</text>
        <text class="trip-state__text">{{ loadError }}，点这里重试</text>
      </view>
      <!-- 岗位下架了：还写称呼和日期，不写地点 -->
      <view v-else-if="state === 'gone'" class="trip-card trip-state">
        <view class="trip-state__icon"><k-icon name="calendar-days" :size="24" color="#8A5E36" :stroke="1.8" /></view>
        <text class="trip-state__title">{{ goneTitle }}</text>
        <text class="trip-state__text">这个岗位现在已经下架，具体的地点和安排可以直接问问 TA。</text>
      </view>
      <template v-else>
        <image class="trip-hero" :src="heroImg" mode="aspectFill" />
        <view class="trip-card trip-main">
          <text class="trip-title">{{ title }}</text>
          <view class="trip-rows">
            <view v-for="row in rows" :key="row.label" class="trip-row">
              <view class="trip-row__icon"><k-icon :name="row.icon" :size="18" color="#8A5E36" :stroke="1.8" /></view>
              <text class="trip-row__label">{{ row.label }}</text>
              <text class="trip-row__value">{{ row.value }}</text>
            </view>
          </view>
        </view>
        <text class="trip-foot">这是 TA 分享给你的行程，不会显示手机号</text>
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
.trip-row + .trip-row { border-top: 1px solid var(--k-line); }
.trip-row__icon { flex: 0 0 auto; width: 32px; height: 32px; border-radius: 9px; background: #F5E9D8; display: flex; align-items: center; justify-content: center; }
.trip-row__label { flex: 0 0 auto; width: 64px; font-size: 14px; color: var(--k-muted); }
.trip-row__value { flex: 1; min-width: 0; font-size: 15px; line-height: 22px; font-weight: 600; color: var(--k-ink); text-align: right; overflow-wrap: anywhere; }
.trip-foot { display: block; margin-top: 12px; text-align: center; font-size: 13px; line-height: 20px; color: var(--k-muted); }
.trip-state { margin-top: 24px; padding: 28px 20px; display: flex; flex-direction: column; align-items: center; gap: 8px; text-align: center; }
.trip-state__icon { width: 52px; height: 52px; border-radius: 50%; background: #F5E9D8; display: flex; align-items: center; justify-content: center; }
.trip-state__title { font-family: var(--k-display-font); font-size: 18px; line-height: 26px; font-weight: 700; color: #3B2A1E; }
.trip-state__text { font-size: 14px; line-height: 22px; color: var(--k-ink2); }
.trip-page .k-bottom :deep(.k-button.is-primary) { background: #8A603D; box-shadow: 0 3px 9px rgba(95, 58, 27, .12); }
</style>
