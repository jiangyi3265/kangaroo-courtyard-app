<template>
  <view class="k-page city-work">
    <k-topbar title="城市工作台" />
    <view class="k-body k-pad-tab">
      <view class="req-store" hover-class="k-press-s" @click="switchStore"><view class="req-store__copy"><text class="req-store__eyebrow">城市负责人{{ (city || currentStaffStore?.city) ? ' · ' + (city || currentStaffStore?.city) : '' }}</text><text class="req-store__name">{{ identity.name }}</text><text v-if="identity.scope" class="identity-scope">{{ identity.scope }}</text></view><k-icon v-if="staffIdentities.length > 1" name="chevron-down" :size="18" color="muted" /></view>
      <template v-if="currentStaffStore?.storeId">
      <!-- 主人 2026-11-03：任务能发给全体员工、按岗位发，这个岗位也会收到管理员任务 -->
      <k-task-entry />
      <view class="req-links"><view class="req-link" hover-class="k-press" @click="go('/pages/staff/operations')"><k-icon name="file-text" :size="18" color="ink2"/><view class="req-link__copy"><text class="req-link__title">日报与月度任务</text><text class="req-link__sub">查看授权范围内的日报与月度总结</text></view><k-icon name="chevron-right" :size="12" color="muted"/></view></view>
      <view class="req-links"><view class="req-link" hover-class="k-press" @click="go('/pages/governance/mediation?mode=city')"><k-icon name="scale" :size="18" color="ink2"/><view class="req-link__copy"><text class="req-link__title">本城纠纷调解</text><text class="req-link__sub">接单、核实材料、独立裁决与执行跟进</text></view><k-icon name="chevron-right" :size="12" color="muted"/></view></view>
      <view class="req-links"><view class="req-link" hover-class="k-press" @click="go('/pages/staff/insurance-account?tab=refunds')"><k-icon name="receipt" :size="18" color="ink2"/><view class="req-link__copy"><text class="req-link__title">保险退费</text><text class="req-link__sub">查看本城退费进度，核实离店日期后办理退款</text></view><k-icon name="chevron-right" :size="12" color="muted"/></view></view>
      <!-- 全部权限（2026-11-01）：平时不用做日常，下级不在时从这里进这家店的工作台和业务；服务端授权带 fullAccess 才出现 -->
      <template v-if="cityLeadFull">
        <view class="req-heading"><text>顶上日常</text></view>
        <view class="req-links">
          <view class="req-link" hover-class="k-press" @click="go(R.staff + '?daily=1')"><k-icon name="file-text" :size="18" color="ink2" /><view class="req-link__copy"><text class="req-link__title">这家店的日常工作台</text><text class="req-link__sub">待办、接报名、面试</text></view><k-icon name="chevron-right" :size="12" color="muted" /></view>
          <view class="req-link" hover-class="k-press" @click="go(R.staffBusiness)"><k-icon name="briefcase-business" :size="18" color="ink2" /><view class="req-link__copy"><text class="req-link__title">这家店的全部业务</text><text class="req-link__sub">岗位、活动、旅居、线上任务、商家需求、日报周报</text></view><k-icon name="chevron-right" :size="12" color="muted" /></view>
        </view>
      </template>
      <!-- 本城数字和财务入口只在角色切换后显示：hub 带 cityRefundPending 才算（见 load） -->
      <template v-if="switched">
        <view class="req-heading"><text>本城数字</text></view>
        <view v-if="summaryError" class="city-tip" hover-class="k-press" @click="load"><text>{{ summaryError }}（点击重试）</text></view>
        <view class="req-tiles city-tiles"><view v-for="t in summaryTiles" :key="t.key" class="req-tile"><text class="req-tile__num">{{ t.value == null ? '—' : t.value }}</text><text class="req-tile__label">{{ t.label }}</text></view></view>
        <view class="req-heading"><text>财务与钱包</text></view>
        <view class="req-links">
          <view class="req-link" hover-class="k-press" @click="openFinance('refunds')"><k-icon name="receipt" :size="18" color="ink2" /><view class="req-link__copy"><text class="req-link__title">活动退款审批</text><text class="req-link__sub">{{ cityLeadFull ? '本城全部门店' : '只含你有授权的门店' }}</text></view><text v-if="refundPending > 0" class="req-link__num warn">{{ refundPending > 99 ? '99+' : refundPending }}</text><k-icon name="chevron-right" :size="12" color="muted" /></view>
          <view class="req-link" hover-class="k-press" @click="openFinance('activities')"><k-icon name="circle-x" :size="18" color="ink2" /><view class="req-link__copy"><text class="req-link__title">取消收费活动</text><text class="req-link__sub">收费或已有报名的活动，会批量退款并通知报名人</text></view><k-icon name="chevron-right" :size="12" color="muted" /></view>
          <view class="req-link" hover-class="k-press" @click="go(R.wallet)"><k-icon name="wallet-cards" :size="18" color="ink2" /><view class="req-link__copy"><text class="req-link__title">我的钱包</text><text class="req-link__sub">收益明细、申请结算</text></view><k-icon name="chevron-right" :size="12" color="muted" /></view>
          <view class="req-link" hover-class="k-press" @click="go(R.honor)"><k-icon name="medal" :size="18" color="ink2" /><view class="req-link__copy"><text class="req-link__title">荣誉与关怀</text><text class="req-link__sub">荣誉墙、生日礼物、委屈奖申报</text></view><k-icon name="chevron-right" :size="12" color="muted" /></view>
        </view>
      </template>
      <view class="req-heading"><text>今日换工概况</text><text class="req-heading__link" @click="openShops('')">各店情况</text></view>
      <view v-if="overviewError" class="city-tip" hover-class="k-press" @click="load"><text>{{ overviewError }}（点击重试）</text></view>
      <view class="req-tiles"><view v-for="t in overviewTiles" :key="t.key" class="req-tile" hover-class="k-press-s" @click="openShops(t.key)"><text class="req-tile__num">{{ t.value == null ? '—' : t.value }}</text><text class="req-tile__label">{{ t.label }}</text></view></view>
      <view class="req-heading"><text>本城商家需求</text><text class="req-heading__link" @click="openRequests('')">全部需求</text></view>
      <view v-if="unassigned > 0" class="city-alert" hover-class="k-press-s" @click="openRequests('unassigned')"><k-icon name="bell" :size="16" color="alert" /><text class="city-alert__text">{{ unassigned }} 条需求等平台安排（本城暂时没有接手的人）</text><k-icon name="chevron-right" :size="12" color="muted" /></view>
      <view v-if="error" class="req-state"><text>{{ error }}</text><k-button label="重新加载" size="md" type="outline" @click="load" /></view>
      <template v-else>
        <k-request-row v-for="r in recent" :key="r.requestId" :item="r" @open="openRow(r)" />
        <view v-if="!recent.length" class="req-state"><text>{{ loading ? '正在读取…' : '本城还没有商家需求' }}</text></view>
      </template>
      <text class="req-foot">{{ cityLeadFull ? '你可以办理授权范围内的门店业务，平时由小院主理人、换工主理人、线上任务专员和商家服务人处理，他们不在时可以从「顶上日常」进去接手。缺人需你办理或转平台时会提醒，其余可在「本城商家需求」查看；旅居和服务订单的退款由平台在后台处理。' : switched ? '换工概况和商家需求只能查看，处理由换工主理人、商家服务人和平台负责。可在「本城商家需求」查看办理进度。' : '商家发布招募或提交需求时，你会在「消息」里收到通知。' }}</text>
      </template>
      <view v-else class="req-state city-preparing"><k-icon name="map-pin" :size="28" color="ochre" /><text class="city-preparing__title">{{ currentStaffStore?.city || '当前城市' }}筹备中</text><text>城市负责人授权已生效，暂未开通门店。门店开通后，可在这里处理本城业务。</text></view>
    </view>
    <k-tabbar mode="staff" active="work" />
  </view>
</template>

<script setup>
// 城市负责人的工作台（pages/staff/index 与 business 显式引入）：看本城需求和各店换工概况；角色切换后多本城数字和财务入口（写操作都在 city-finance 页）。staff 分包内组件，不占主包
import { computed, ref, watch, onMounted, onBeforeUnmount } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { get } from '@/common/request.js'
import { apiStaffHub } from '@/common/api.js'
import { experience, currentStaffStore, staffIdentities, staffIdentityLabel, selectStaffStore, ensureSession, getSessionRevision, refreshAccount, cityLeadFull } from '@/common/experience.js'
import { toast } from '@/common/screen.js'
import { goFromWorkbench as go } from '@/common/visit-subscriptions.js'
import { pickPaged, errText } from '@/common/ui.js'
import R from '@/common/routes.js'
import { CITY_API, CITY_OVERVIEW_API, CITY_PAGE, CITY_FINANCE_API, CITY_FINANCE_PAGE } from '../request-view.js'
import KRequestRow from './k-request-row.vue'
import KTaskEntry from './k-task-entry.vue'
import { workIdentity } from '../work-identity.js'

const identity = computed(() => workIdentity(experience.account, currentStaffStore.value))

const recent = ref([]), overview = ref(null), unassigned = ref(0), city = ref('')
const loading = ref(false), error = ref(''), overviewError = ref('')
// 切换前后不用发版：服务端只在切换后、城市负责人身份下给 cityRefundPending，有这个字段才开财务入口、才去取本城数字（切换前那个接口是 403）
const switched = ref(false), refundPending = ref(0), summary = ref(null), summaryError = ref('')
const summaryTiles = computed(() => {
  const o = summary.value
  return [{ key: 'storeCount', label: '本城门店' }, { key: 'todayApplications', label: '今日报名' }, { key: 'openJobs', label: '在招岗位' }, { key: 'inHouseGuests', label: '在住人数' }]
    .map(t => ({ ...t, value: o ? Number(o[t.key]) || 0 : null }))
})
const overviewTiles = computed(() => {
  const o = overview.value
  return [{ key: 'shortfall', label: '招募缺口' }, { key: 'arriving', label: '今日到达' }, { key: 'leaving', label: '一周内离开' }]
    .map(t => ({ ...t, value: o ? Number(o[t.key]) || 0 : null }))
})
let seq = 0
async function load() {
  const id = ++seq
  await ensureSession()
  const store = currentStaffStore.value?.storeId, session = getSessionRevision()
  const current = () => id === seq && store === currentStaffStore.value?.storeId && session === getSessionRevision()
  if (!store || currentStaffStore.value?.roleCode !== 'city_lead') {
    city.value = currentStaffStore.value?.city || ''
    recent.value = []; overview.value = null; unassigned.value = 0
    switched.value = false; summary.value = null; refundPending.value = 0
    loading.value = false; error.value = ''; overviewError.value = ''; summaryError.value = ''
    return
  }
  loading.value = true
  error.value = ''
  overviewError.value = ''
  // 三份数据互不牵连：概况读不到时，需求列表照样显示
  await Promise.all([
    get(CITY_API, { storeId: store, pageSize: 5 }).then((res) => {
      if (!current()) return
      recent.value = res.data?.rows || []
      city.value = res.data?.city || city.value
    }).catch((e) => { if (current()) { error.value = errText(e, '加载失败，请重试'); recent.value = [] } }),
    get(CITY_OVERVIEW_API, { storeId: store }).then((res) => {
      if (current()) overview.value = res.data || {}
    }).catch((e) => { if (current()) { overview.value = null; overviewError.value = errText(e, '换工概况读取失败') } }),
    apiStaffHub(store).then((res) => {
      if (!current()) return null
      unassigned.value = Number(res.data?.cityUnassigned) || 0
      switched.value = res.data?.cityRefundPending != null
      refundPending.value = Number(res.data?.cityRefundPending) || 0
      if (!switched.value) return null
      summaryError.value = ''
      return get(CITY_FINANCE_API + '/summary', { storeId: store }).then((r) => {
        if (current()) summary.value = r.data || {}
      }).catch((e) => { if (current()) { summary.value = null; summaryError.value = errText(e, '本城数字读取失败') } })
    }).catch(() => { if (current()) unassigned.value = 0 })
  ])
  if (current()) loading.value = false
}
const openRequests = (status) => go(CITY_PAGE + '?status=' + status)
const openShops = (tab) => go(CITY_PAGE + '?view=shops' + (tab ? '&tab=' + tab : ''))
const openRow = (r) => go(CITY_PAGE + '?requestId=' + r.requestId)
const openFinance = (tab) => go(CITY_FINANCE_PAGE + '?tab=' + tab)
async function switchStore() {
  try { await refreshAccount() } catch (e) { /* 用本机的门店清单 */ }
  const choices = staffIdentities.value.slice()
  if (choices.length < 2) return
  const i = await pickPaged(choices.map(staffIdentityLabel), '选择工作身份')
  if (i < 0) return
  await selectStaffStore(choices[i])
  uni.reLaunch({ url: R.staff })
}
watch(() => [currentStaffStore.value?.storeId, currentStaffStore.value?.city], load)
onMounted(load)
onShow(load)
onBeforeUnmount(() => { seq++ })
</script>

<style scoped lang="scss">
@import '../request-pages.scss';
/* 2026-11-17 改版「小而精」：浅灰底 + 白卡 12 圆角、去阴影；入口行、数字格收小一档（共用写法在 ../work-lite.scss；.req-* 在 ../request-pages.scss） */
@import '../work-lite.scss';
.city-work{@include lite-page}
.identity-scope{display:block;margin-top:2px;font-size:12px;line-height:1.5;color:var(--k-muted);overflow-wrap:anywhere}
/* 筹备中本来就是白卡：11-18 共用的 .req-state 改成白卡、字 14 / 500 后，这里把说明字留在原来的 13 / muted */
.city-preparing{margin-top:8px;padding:24px;border-radius:12px;background:var(--k-paper);gap:10px;line-height:1.7;font-size:13px;font-weight:400;color:var(--k-muted)}
.city-preparing__title{font-size:15px;font-weight:600;color:var(--k-ink)}
.city-tip{margin:0 0 8px;font-size:12px;line-height:1.6;color:var(--k-alert)}
.city-alert{margin-bottom:8px;padding:10px 12px;border-radius:12px;background:var(--k-alert-soft);display:flex;align-items:center;gap:8px}
.city-alert__text{min-width:0;flex:1;font-size:12px;line-height:1.55;color:var(--k-alert)}
.city-tiles{grid-template-columns:repeat(4,minmax(0,1fr));gap:8px;margin-top:0}
.city-tiles .req-tile{padding:12px 4px}
</style>
