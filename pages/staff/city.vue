<template>
  <view class="k-page city-page">
    <template v-if="s === 1">
      <k-topbar title="本城情况" back />
      <view class="k-body k-pad-tab">
        <view class="city-switch"><view v-for="v in VIEWS" :key="v.key" :class="{ active: view === v.key }" hover-class="k-press" @click="setView(v.key)"><text>{{ v.label }}</text></view></view>

        <template v-if="view === 'requests'">
          <view class="req-head"><view class="req-head__copy"><text class="req-head__title">{{ list.city.value ? list.city.value + ' · ' : '' }}商家需求</text><text class="req-head__sub">{{ cityLeadFull ? '这里是总览；要处理请从「顶上日常」进入' : '只能查看；处理由换工主理人、商家服务人和平台负责' }}</text></view></view>
          <scroll-view scroll-x class="req-tabs" :show-scrollbar="false"><view class="req-tabs__row"><view v-for="t in CITY_TABS" :key="t.label" class="req-tab" :class="{ active: status === t.status }" hover-class="k-press" @click="setStatus(t.status)"><text>{{ t.label }}</text></view></view></scroll-view>
          <view v-if="list.error.value" class="req-state"><text>{{ list.error.value }}</text><k-button label="重新加载" size="md" type="outline" @click="list.reload" /></view>
          <template v-else>
            <k-request-row v-for="r in list.rows.value" :key="r.requestId" :item="r" @open="openDetail(r.requestId)" />
            <view v-if="list.hasMore.value" class="req-more" hover-class="k-press" @click="list.more"><text>{{ list.loading.value ? '正在加载…' : '加载更多' }}</text></view>
            <view v-if="!list.rows.value.length" class="req-state"><text>{{ list.loading.value || !list.loaded.value ? '正在读取…' : '这一类还没有需求' }}</text></view>
          </template>
        </template>

        <template v-else>
          <view class="req-head"><view class="req-head__copy"><text class="req-head__title">{{ overview.city || '当地' }} · 各店换工概况</text><text class="req-head__sub">{{ overview.date || '' }} · 本城全部合作门店</text></view><view class="req-head__act" hover-class="k-press-s" @click="loadOverview"><text>{{ overviewLoading ? '更新中…' : '刷新' }}</text></view></view>
          <view v-if="overviewError" class="req-state"><text>{{ overviewError }}</text><k-button label="重新加载" size="md" type="outline" @click="loadOverview" /></view>
          <template v-else-if="overviewLoaded">
            <view class="req-tiles"><view v-for="t in SHOP_TABS" :key="t.key" class="req-tile" :class="{ on: shopTab === t.key }" hover-class="k-press-s" @click="shopTab = t.key"><text class="req-tile__num">{{ overview[t.key] || 0 }}</text><text class="req-tile__label">{{ t.label }}</text></view></view>
            <view v-for="shop in visibleShops" :key="shop.storeId" class="city-shop">
              <view class="city-shop__head"><text class="city-shop__name">{{ shop.name }}</text><text class="city-shop__count">{{ shopTab === 'shortfall' ? '缺 ' + shop.shortfall + ' 人' : shopRows(shop).length + ' 人' }}</text></view>
              <template v-if="shopTab === 'shortfall'"><view v-for="job in shop.jobs" :key="job.jobId" class="city-shop__row"><text class="city-shop__title">{{ job.title }}</text><text class="city-shop__meta">还招 {{ job.shortfall }} 人</text></view></template>
              <template v-else><view v-for="person in shopRows(shop)" :key="person.appId" class="city-shop__row"><text class="city-shop__title">{{ person.name }}</text><text class="city-shop__meta">{{ person.jobTitle }}</text><text class="city-shop__meta">{{ shopTab === 'arriving' ? '预计到达：' + person.arrivalDate : '合约结束：' + person.endDate }}</text></view></template>
            </view>
            <view v-if="!visibleShops.length" class="req-state"><text>{{ shopEmpty }}</text></view>
            <text v-if="overview.note" class="req-foot">{{ overview.note }}</text>
          </template>
          <view v-else class="req-state"><text>正在读取…</text></view>
        </template>
      </view>
      <k-tabbar mode="staff" active="work" />
    </template>

    <template v-else>
      <k-topbar title="需求详情" back custom-back @back="leaveDetail" />
      <view class="k-body k-pad-tab">
        <view v-if="detailError" class="req-state"><text>{{ detailError }}</text><k-button label="重新加载" size="md" type="outline" @click="reloadDetail" /></view>
        <view v-else-if="!detail" class="req-state"><text>正在读取…</text></view>
        <template v-else><k-request-detail :detail="detail" /><k-button v-if="detail.canResume" label="接办这条需求" @click="resumeRequest" /></template>
      </view>
      <k-tabbar mode="staff" active="work" />
    </template>
  </view>
</template>

<script setup>
// 城市负责人（city_lead）：这一页只读（全部权限后要处理走「顶上日常」）。本城商家需求（手机号服务端已脱敏，不给拨打）+ 各店换工概况（和「当地换工招募概况」同一份数据，不给进报名详情）。
// 管人、审批合营院子是下一轮的事，这里没有任何写操作。
import { ref, computed, watch } from 'vue'
import { onShow, onUnload, onReachBottom, onPullDownRefresh } from '@dcloudio/uni-app'
import { get, post } from '@/common/request.js'
import { useScreen, back, toast } from '@/common/screen.js'
import { ensureSession, hasStaffAccess, currentStaffStoreId, getSessionRevision, selectStaffStore, cityLeadFull } from '@/common/experience.js'
import { errText } from '@/common/ui.js'
import { useRequestList } from './request-list.js'
import { CITY_API, CITY_OVERVIEW_API, CITY_TABS, tabOf } from './request-view.js'
import KRequestRow from './components/k-request-row.vue'
import KRequestDetail from './components/k-request-detail.vue'

const VIEWS = [{ key: 'requests', label: '商家需求' }, { key: 'shops', label: '各店概况' }]
const SHOP_TABS = [{ key: 'shortfall', label: '招募缺口' }, { key: 'arriving', label: '今日到达' }, { key: 'leaving', label: '一周内离开' }]
const view = ref('requests'), status = ref('')
const storeParams = () => ({ storeId: currentStaffStoreId() })
const list = useRequestList(async (pageNum) => (await get(CITY_API, { ...storeParams(), status: status.value, pageNum, pageSize: 20 })).data)
const setStatus = (v) => { if (status.value !== v) { status.value = v; list.reload() } }
function setView(v) {
  if (view.value === v) return
  view.value = v
  if (v === 'shops') loadOverview(); else list.reload()
}

let booted = false, shown = false, landedOnDetail = false
const s = useScreen(2, { onLoad: boot })
async function boot(q) {
  status.value = tabOf(CITY_TABS, q.status)
  view.value = q.view === 'shops' ? 'shops' : 'requests'
  if (SHOP_TABS.some(t => t.key === q.tab)) shopTab.value = q.tab
  try {
    await ensureSession()
    if (!hasStaffAccess.value) return
    if (q.storeId && String(q.storeId) !== String(currentStaffStoreId())) await selectStaffStore(q.storeId)
  } catch (e) {
    toast(errText(e, '切换门店失败'))
  }
  booted = true
  if (Number(q.requestId)) { landedOnDetail = true; openDetail(q.requestId) } else refresh()
}
const refresh = () => (view.value === 'shops' ? loadOverview() : list.reload())
onShow(() => { if (shown && booted && s.value === 1) refresh(); shown = true })
onUnload(() => { list.cancel(); detailSeq++; overviewSeq++ })
onReachBottom(() => { if (s.value === 1 && view.value === 'requests') list.more() })
onPullDownRefresh(async () => {
  if (s.value === 1) await refresh()
  else await reloadDetail()
  uni.stopPullDownRefresh()
})
watch(s, (v, old) => { if (v === 1 && old !== 1 && booted) refresh() })

// ---------------- 详情 ----------------
const detail = ref(null), detailError = ref('')
let detailSeq = 0, openId = null
async function resumeRequest() {
  try {
    const result = await post(CITY_API + '/' + openId + '/resume?storeId=' + currentStaffStoreId())
    uni.navigateTo({ url: result.data.route })
  } catch (e) { toast(errText(e, '接办失败，请刷新')); await reloadDetail() }
}
async function reloadDetail() {
  const id = ++detailSeq
  detailError.value = ''
  try {
    const d = (await get(CITY_API + '/' + openId, storeParams())).data || {}
    if (id === detailSeq) detail.value = d
  } catch (e) {
    if (id === detailSeq) detailError.value = errText(e, '详情加载失败')
  }
}
function openDetail(requestId) {
  openId = requestId
  detail.value = null
  s.value = 2
  return reloadDetail()
}
function leaveDetail() {
  if (landedOnDetail && getCurrentPages().length > 1) return back()
  landedOnDetail = false
  s.value = 1
}

// ---------------- 各店概况 ----------------
const overview = ref({}), overviewLoaded = ref(false), overviewLoading = ref(false), overviewError = ref(''), shopTab = ref('shortfall')
let overviewSeq = 0
const shopRows = (shop) => shop[shopTab.value === 'arriving' ? 'arrivals' : 'departures'] || []
const visibleShops = computed(() => (overview.value.shops || []).filter(x => (shopTab.value === 'shortfall' ? x.shortfall > 0 : shopRows(x).length)))
const shopEmpty = computed(() => ({ shortfall: '当前城市暂无招聘中的换工缺口', arriving: '今天暂无预计到达的换工', leaving: '未来一周暂无合约到期的换工' })[shopTab.value])
async function loadOverview() {
  const id = ++overviewSeq, store = currentStaffStoreId(), session = getSessionRevision()
  overviewLoading.value = true
  overviewError.value = ''
  try {
    const d = (await get(CITY_OVERVIEW_API, { storeId: store })).data || {}
    if (id !== overviewSeq || store !== currentStaffStoreId() || session !== getSessionRevision()) return
    overview.value = d
    overviewLoaded.value = true
  } catch (e) {
    if (id === overviewSeq) overviewError.value = errText(e, '各店概况加载失败')
  } finally {
    if (id === overviewSeq) overviewLoading.value = false
  }
}
</script>

<style scoped lang="scss">
@import './request-pages.scss';
/* 2026-11-17 改版「小而精」：浅灰底 + 白卡（12 圆角、去阴影），切换条和人数标签按统一规范；内容不变。共用写法在 ./work-lite.scss；.req-* 在 ./request-pages.scss */
@import './work-lite.scss';
.city-page{@include lite-page}
/* 分段控件（11-18 第二轮精修，和「我的」钱包页一个样子）：外框 #F0EBE4、高 32、圆角 16、内边距 2；选中白块圆角 14、13 / 600 墨色，没选 13 / 400 二级墨。
   块看着 28 高，上下各多出一圈看不见的可点范围，可点高度仍有 40 */
.city-switch{height:32px;margin-bottom:10px;padding:2px;box-sizing:border-box;border-radius:16px;background:#F0EBE4;display:grid;grid-template-columns:1fr 1fr}
.city-switch>view{border-radius:14px;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:400;color:var(--k-ink2)}
.city-switch>view.active{background:var(--k-paper);color:var(--k-ink);font-weight:600;box-shadow:none}
.city-switch>view{position:relative}.city-switch>view::after{content:"";position:absolute;left:0;right:0;top:-4px;bottom:-4px}
.req-tile.on{background:var(--k-red-soft);box-shadow:none}
.city-shop{margin-top:8px;padding:12px;border-radius:12px;background:var(--k-paper);box-shadow:none}
.city-shop__head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;padding-bottom:8px}
.city-shop__name{min-width:0;flex:1;font-size:14px;font-weight:600;line-height:20px;color:var(--k-ink);overflow-wrap:anywhere}
.city-shop__count{flex-shrink:0;height:17px;padding:0 5px;border-radius:4px;background:var(--k-red-soft);font-size:10px;font-weight:500;line-height:17px;color:var(--k-red-deep)}
.city-shop__row{position:relative;padding:8px 0;display:flex;flex-direction:column;gap:2px}
/* 11-18 第二轮精修：分隔换成发丝线 */
.city-shop__row::before{content:"";position:absolute;left:0;right:0;top:0;height:1px;background:var(--k-line);transform:scaleY(.5);transform-origin:0 0}
.city-shop__title{font-size:13px;line-height:1.5;color:var(--k-ink);overflow-wrap:anywhere}
.city-shop__meta{font-size:12px;line-height:1.5;color:var(--k-muted)}
</style>
