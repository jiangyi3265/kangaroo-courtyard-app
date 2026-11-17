<template>
  <view class="k-page daily">
    <k-topbar title="每日概况" back />
    <view class="k-body k-pad-tab daily-body">
      <!-- 日期切换：‹ 今天 · 10月17日 周六 ›，点中间选别的日子；右边「更新于 HH:mm」，下拉刷新 -->
      <view class="dbar">
        <view class="dbar__arrow" :class="{ off: !nav.canPrev }" hover-class="k-press-s" @click="move(-1)"><k-icon name="chevron-left" :size="20" color="ink" :stroke="2" /></view>
        <view class="dbar__mid" hover-class="k-press" @click="calendarOpen = true"><text class="dbar__title">{{ nav.title }}</text><k-icon name="calendar-days" :size="16" color="red" :stroke="1.8" /></view>
        <view class="dbar__arrow" :class="{ off: !nav.canNext }" hover-class="k-press-s" @click="move(1)"><k-icon name="chevron-right" :size="20" color="ink" :stroke="2" /></view>
      </view>
      <view class="k-between dmeta">
        <text v-if="!nav.isToday" class="dmeta__back" hover-class="k-press" @click="setDate(today)">回到今天</text>
        <text v-else class="dmeta__tip">数字每次打开都按订单和报名现算</text>
        <text class="dmeta__time">{{ loading ? '更新中…' : (data.updatedAt ? '更新于 ' + data.updatedAt : '') }}</text>
      </view>

      <view v-if="chips.length" class="chips">
        <view v-for="c in chips" :key="c.value || 'all'" class="chip" :class="{ on: c.on }" hover-class="k-press-s" @click="setCity(c.value)"><text>{{ c.label }}</text></view>
      </view>

      <view v-if="error" class="empty"><text>{{ error }}</text><view class="empty__btn" hover-class="k-press-s" @click="load()"><text>重试</text></view></view>

      <template v-else-if="loaded">
        <!-- 合计卡：全部（或所选城市）的入住与报名 -->
        <view class="sum">
          <text class="sum__title">{{ sumTitle }}</text>
          <view class="sum__grid">
            <view v-for="t in tiles" :key="t.key" class="tile" :class="{ warn: t.warn }">
              <text class="tile__label">{{ t.label }}</text>
              <text class="tile__value">{{ t.value }}</text>
              <text class="tile__sub">{{ t.sub }}</text>
            </view>
          </view>
        </view>

        <view v-for="c in blocks" :key="c.city" class="city">
          <view class="city__head">
            <text class="city__name">{{ c.city }}</text>
            <text class="city__count">{{ c.countText }}</text>
            <text class="city__sum">{{ c.sumLine }}</text>
          </view>
          <view v-for="h in c.stays" :key="h.stayId" class="stay" hover-class="k-press-s" @click="open(h.link, h.storeId)">
            <!-- 小院名一整行（窄屏也不被门店名、标签挤成「海.」）；门店名和「新订单 / 待审退款」放第二行 -->
            <view class="k-between stay__top">
              <text class="stay__name">{{ h.stayName }}</text>
              <k-icon name="chevron-right" :size="16" color="muted" :stroke="1.8" />
            </view>
            <view v-if="multiStore || h.flags.length" class="stay__sub">
              <text v-if="multiStore" class="stay__store">{{ h.storeName }}</text>
              <text v-for="f in h.flags" :key="f.text" class="flag" :class="'flag--' + f.tone">{{ f.text }}</text>
            </view>
            <view class="stats">
              <view v-for="x in h.stats" :key="x.label" class="stat"><text class="stat__value">{{ x.value }}</text><text class="stat__label">{{ x.label }}</text><text class="stat__sub">{{ x.sub }}</text></view>
            </view>
          </view>
          <view v-for="a in c.apps" :key="'a' + a.storeId" class="stay apps" hover-class="k-press-s" @click="open(a.link, a.storeId)">
            <view class="k-between stay__top">
              <text class="stay__name">报名 · {{ a.storeName }}</text>
              <k-icon name="chevron-right" :size="16" color="muted" :stroke="1.8" />
            </view>
            <view class="stats">
              <view v-for="x in a.stats" :key="x.label" class="stat" :class="{ warn: x.warn }"><text class="stat__value">{{ x.value }}</text><text class="stat__label">{{ x.label }}</text><text class="stat__sub">{{ x.sub }}</text></view>
            </view>
          </view>
        </view>
        <view v-if="!blocks.length" class="empty"><text>{{ data.city ? data.city + '这天没有可看的小院和报名' : '授权的门店还没有上线的小院和报名' }}</text></view>
        <text class="note">{{ data.note }}</text>
      </template>
      <view v-else class="empty"><text>正在读取…</text></view>
    </view>
    <k-date-picker v-if="calendarOpen" title="看哪一天的概况" :value="date" :min-date="nav.min" :max-date="nav.max" @cancel="calendarOpen = false" @confirm="confirmDate" />
    <k-tabbar mode="staff" active="business" />
  </view>
</template>

<script setup>
// ---------------------------------------------------------------------------
// 员工端「每日概况」（2026-10-17，主人：「我手机的员工端能不能实现每天更新每个城市和小院的报名情况入住情况」）：
//   顶部 ‹ 今天 › 切日期（点中间用日历选），一张合计卡（在住 / 入住率 / 入住 / 离店 / 新订单 / 待审退款 / 新报名 / 待处理报名），
//   下面按城市 → 每家小院（入住 / 在住 / 离店 / 入住率）+ 每家门店的报名（新报名 / 待处理 / 录用 / 到岗）。
//   数据来自 GET /app/staff/daily（只算有授权的门店，每次现查，不落快照）；回到本页、下拉都会重新取，右上写「更新于 HH:mm」。
//   点小院进订单台（今天 → 对应分组；别的日子 → 房态图从那天看），点报名进报名管理；都带那家门店，多店授权也能直接看
// 接口只有这一页用：直接用 request.js 的 get，不往主包 common/api.js 里加
// ---------------------------------------------------------------------------
import { ref, computed } from 'vue'
import { onLoad, onShow, onPullDownRefresh } from '@dcloudio/uni-app'
import { go, toast } from '@/common/screen.js'
import { get } from '@/common/request.js'
import { errText, todayCn } from '@/common/ui.js'
import { ensureSession, hasStaffAccess, staffStoreUrl } from '@/common/experience.js'
import R from '@/common/routes.js'
import { DAILY_API, dayNav, shiftDay, summaryTiles, cityBlocks, cityChips, totalTitle } from './daily-view.js'

const today = ref(todayCn())
const date = ref(today.value)
const city = ref('')
const data = ref({})
const loaded = ref(false)
const loading = ref(false)
const error = ref('')
const calendarOpen = ref(false)
const nav = computed(() => dayNav(date.value, today.value))
const tiles = computed(() => summaryTiles(data.value.total, !!data.value.isToday))
const blocks = computed(() => cityBlocks(data.value, R))
const chips = computed(() => cityChips(data.value.cityOptions, city.value))
const sumTitle = computed(() => totalTitle(data.value.total, data.value.city))
const multiStore = computed(() => Number(data.value.scope && data.value.scope.stores) > 1)

let seq = 0
async function load() {
  const my = ++seq
  loading.value = true
  error.value = ''
  try {
    const d = (await get(DAILY_API, { date: date.value, city: city.value || undefined })).data || {}
    if (my !== seq) return
    data.value = d
    if (d.today) today.value = d.today
    // 选的城市这天被筛没了（比如换了日期没有这个城市了）：回到全部
    if (city.value && !(d.cityOptions || []).includes(city.value)) { city.value = ''; return load() }
    loaded.value = true
  } catch (e) {
    if (my === seq) error.value = errText(e, '概况加载失败')
  } finally {
    if (my === seq) loading.value = false
  }
}
const setDate = (v) => { if (v && v !== date.value) { date.value = v; load() } }
const move = (n) => {
  if ((n < 0 && !nav.value.canPrev) || (n > 0 && !nav.value.canNext)) return
  setDate(shiftDay(date.value, n))
}
const confirmDate = (v) => { calendarOpen.value = false; setDate(v) }
const setCity = (v) => { if (v !== city.value) { city.value = v; load() } }
const open = (url, storeId) => go(staffStoreUrl(url, storeId))

let booted = false
onLoad(async (q) => {
  if (q && /^\d{4}-\d{2}-\d{2}$/.test(q.date || '')) date.value = q.date
  if (q && q.city) { try { city.value = decodeURIComponent(q.city) } catch (e) { city.value = q.city } }
  await ensureSession()
  if (!hasStaffAccess.value) { error.value = '当前账号没有员工授权'; return }
  booted = true
  load()
})
// 从订单台 / 报名管理回来时重新取（那边办了入住、审了报名，这里的数要跟着变）
let shown = false
onShow(() => {
  if (shown && booted) load()
  shown = true
})
onPullDownRefresh(() => {
  if (!booted) { uni.stopPullDownRefresh(); return }
  load().finally(() => {
    uni.stopPullDownRefresh()
    if (!error.value) toast('已更新')
  })
})
</script>

<style scoped lang="scss">
.daily-body { padding-top: 6px; }
.dbar { display: flex; align-items: center; gap: 8px; }
.dbar__arrow { width: 40px; height: 40px; border: 1px solid var(--k-line2); border-radius: 10px; background: var(--k-paper); display: flex; align-items: center; justify-content: center; flex: 0 0 auto; }
.dbar__arrow.off { opacity: .35; }
.dbar__mid { flex: 1; min-width: 0; height: 40px; border: 1px solid var(--k-line2); border-radius: 10px; background: var(--k-paper); display: flex; align-items: center; justify-content: center; gap: 6px; }
.dbar__title { font-size: 15px; font-weight: 700; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.dmeta { margin: 8px 2px 4px; font-size: 12px; }
.dmeta__tip, .dmeta__time { color: var(--k-muted); }
.dmeta__back { color: var(--k-red); font-weight: 700; }
.chips { margin-top: 6px; display: flex; flex-wrap: wrap; gap: 8px; }
.chip { height: 30px; padding: 0 14px; border: 1px solid var(--k-line2); border-radius: 999px; background: var(--k-paper); display: flex; align-items: center; font-size: 13px; }
.chip.on { border-color: var(--k-red); background: var(--k-red-soft); color: var(--k-red-deep); font-weight: 700; }
.sum { margin-top: 10px; padding: 12px 12px 6px; border-radius: 14px; background: var(--k-paper); box-shadow: var(--k-sh1); }
.sum__title { display: block; font-size: 15px; font-weight: 700; margin: 0 2px 8px; }
.sum__grid { display: flex; flex-wrap: wrap; }
.tile { width: 25%; padding: 6px 2px 10px; box-sizing: border-box; display: flex; flex-direction: column; align-items: center; min-width: 0; }
.tile__label { font-size: 12px; color: var(--k-muted); white-space: nowrap; }
.tile__value { margin-top: 2px; font-size: 22px; font-weight: 700; line-height: 1.2; color: var(--k-ink); }
.tile__sub { margin-top: 1px; font-size: 10.5px; color: var(--k-light); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 100%; }
.tile.warn .tile__value { color: var(--k-alert); }
.city { margin-top: 16px; }
.city__head { display: flex; align-items: baseline; gap: 8px; margin: 0 2px 8px; flex-wrap: wrap; }
.city__name { font-size: 17px; font-weight: 700; }
.city__count { font-size: 12px; color: var(--k-muted); }
.city__sum { margin-left: auto; font-size: 12px; color: var(--k-ink2); }
.stay { margin-top: 8px; padding: 10px 12px 8px; border: 1px solid var(--k-line); border-radius: 12px; background: var(--k-paper); }
.stay.apps { background: var(--k-bg); }
.stay__top { gap: 8px; }
.stay__name { flex: 1; min-width: 0; font-size: 15px; font-weight: 700; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.stay__sub { margin-top: 4px; display: flex; align-items: center; flex-wrap: wrap; gap: 6px; }
.stay__store { min-width: 0; max-width: 100%; font-size: 11px; color: var(--k-muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.flag { font-size: 11px; padding: 1px 6px; border-radius: 5px; }
.flag--green { color: var(--k-green); background: var(--k-green-soft); }
.flag--alert { color: var(--k-alert); background: var(--k-alert-soft); }
.flag--muted { color: var(--k-muted); background: var(--k-paper2); }
.stats { margin-top: 6px; display: flex; }
.stat { flex: 1; min-width: 0; display: flex; flex-direction: column; align-items: center; }
.stat__value { font-size: 18px; font-weight: 700; line-height: 1.25; }
.stat__label { font-size: 12px; color: var(--k-muted); }
.stat__sub { min-height: 14px; font-size: 10.5px; color: var(--k-light); white-space: nowrap; }
.stat.warn .stat__value { color: var(--k-alert); }
.empty { margin-top: 40px; display: flex; flex-direction: column; align-items: center; gap: 12px; color: var(--k-muted); font-size: 14px; text-align: center; }
.empty__btn { height: 34px; padding: 0 20px; border-radius: 999px; border: 1px solid var(--k-red); color: var(--k-red); display: flex; align-items: center; }
.note { display: block; margin: 16px 4px 0; font-size: 11.5px; line-height: 1.6; color: var(--k-muted); }
</style>
