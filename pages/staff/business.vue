<template>
  <k-staff-pending v-if="pendingScope" />
  <k-online-work v-else-if="onlineStaff" />
  <k-merchant-work v-else-if="merchantStaff" />
  <k-service-work v-else-if="merchantService" active-tab="business" />
  <k-city-work v-else-if="cityLead && (!cityLeadFull || !currentStaffStore?.storeId)" />
  <template v-else>
  <view class="k-page business-page">
    <k-topbar v-if="s===1"><template #right><view /></template></k-topbar>
    <k-topbar v-else :title="titles[s-2]" back custom-back @back="backScreen" />

    <view v-if="s===1" class="k-body k-pad-business hub-page">
      <view class="staff-head"><image :src="absUrl(hub.avatar) || '/static/media/profile-avatar.jpg'" mode="aspectFill" /><view class="k-flex1"><text class="k-ellipsis">{{ hub.name ? '你好，' + hub.name : '你好' }}</text><text>{{ roleLabel ? '角色：' + roleLabel : '' }}</text></view><view class="head-icon" hover-class="k-press-s" @click="openMessages"><k-icon name="message-square" :size="22" color="ink" /><text v-if="hub.unread">{{ hub.unread > 99 ? '99+' : hub.unread }}</text></view><view class="head-icon" hover-class="k-press-s" @click="scan"><k-icon name="scan-line" :size="22" color="ink" /></view></view>
      <view class="current-store" :class="{ 'current-store--long': alsoService }" hover-class="k-press-s" @click="s=2"><k-icon name="house" :size="20" color="ink" /><view class="k-flex1"><view class="k-row k-gap8"><text class="store-name">{{ hub.storeName || '' }}</text><k-chip v-if="roleLabel" tone="ochre"><text>{{ roleLabel }}</text></k-chip></view><text>数据范围：{{ hub.storeName || '' }}</text></view><k-icon name="chevron-right" :size="12" color="muted" /></view>
      <text class="group-title">报名审核与交付</text><view class="function-grid review-entries" :class="'review-entries--' + reviewEntries.length"><view v-for="item in reviewEntries" :key="item.label" hover-class="k-press" @click="item.open()"><view class="review-icon"><k-icon :name="item.icon" :size="22" color="red" :stroke="1.7" /><text v-if="item.badge" class="review-badge">{{ item.badge > 99 ? '99+' : item.badge }}</text></view><text>{{ item.label }}</text></view></view>
      <!-- 每日概况（2026-10-17，主人要在手机上每天看各城市、各小院的入住和报名）：合起来看所有有授权的门店，不限当前门店。
           小院主理人（10-30 店员 Luna 的备忘录）不看换工：普通的整段不显示，下面的旅居订单就是他的概况；兼任商家服务人的换成线上任务 -->
      <template v-if="!isKeeper"><text class="group-title">每日概况</text><view class="owner-entry stay-entry daily-entry" hover-class="k-press-s" @click="go(DAILY_PAGE)"><view><k-icon name="chart-column" :size="20" color="red" /></view><view class="k-flex1"><text>当地换工招募概况</text><text>招募缺口 · 今日到达 · 一周内离开</text></view><k-icon name="chevron-right" :size="12" color="muted" /></view></template>
      <template v-if="alsoService || (isCityLead && cityLeadFull)"><text v-if="alsoService" class="group-title">每日概况</text><view class="owner-entry stay-entry daily-entry" hover-class="k-press-s" @click="go(staffStoreUrl(ONLINE_DAILY_PAGE, hub.storeId))"><view><k-icon name="chart-column" :size="20" color="red" /></view><view class="k-flex1"><text>线上任务招募概况</text><text>招募中 · 招募缺口 · 待审核报名</text></view><k-icon name="chevron-right" :size="12" color="muted" /></view></template>
      <!-- 旅居订单单独一个入口：新订单排房、今日到店 / 离店、办理入住退房（之前只能从消息或「二消订单」里翻） -->
      <template v-if="canStay"><text class="group-title">旅居订单</text><view class="owner-entry stay-entry" hover-class="k-press-s" @click="go(staffStoreUrl(R.staffStayOrders, hub.storeId))"><view><k-icon name="bed-double" :size="20" color="red" /></view><view class="k-flex1"><text>订单与排房</text><text>新订单排房 · 今日到店离店 · 房态图 · 办理入住退房</text></view><k-icon name="chevron-right" :size="12" color="muted" /></view>
      </template><text class="group-title">高频工作</text><view class="function-grid"><view v-for="item in frequent" :key="item.label" hover-class="k-press-s" @click="openItem(item)"><view class="fn-icon"><k-icon :name="item.icon" :size="22" color="red" :stroke="1.7" /></view><text>{{ item.label }}</text></view></view>
      <text class="group-title daily-title">日常管理</text><view class="function-grid daily-grid"><view v-for="item in daily" :key="item.label" hover-class="k-press-s" @click="openItem(item)"><view class="fn-icon"><k-icon :name="item.icon" :size="22" color="red" :stroke="1.7" /></view><text>{{ item.label }}</text></view></view>
      <!-- 2026-11-03 主人：简化——换工主理人专区不再是一条点了再弹菜单的入口，直接拆成「看板 / 钱包 / 荣誉」三格 -->
      <template v-if="!isKeeper"><text class="group-title owner-title">换工主理人专区</text><view class="function-grid owner-grid"><view v-for="item in ownerEntries" :key="item.label" hover-class="k-press-s" @click="openOwner(item)"><view class="fn-icon"><k-icon :name="item.icon" :size="22" color="red" :stroke="1.7" /></view><text>{{ item.label }}</text></view></view></template>
    </view>

    <view v-else-if="s===2" class="k-body k-pad-business switch-page">
      <view class="active-store"><text class="block-title">当前工作范围</text><view><image :src="absUrl(sel.cover) || '/static/media/cover-empty.png'" mode="aspectFill" /><view class="k-flex1"><view class="k-row k-gap8"><text class="store-name">{{ sel.storeName || sel.city || '' }}</text><k-chip v-if="sel.type" :tone="sel.tone || 'green'"><text>{{ sel.type }}</text></k-chip></view><text>角色：{{ roleTextOf(sel) }}</text><text>{{ sel.storeId ? '数据范围：本门店全部数据' : '城市筹备中，暂未开通门店' }}</text></view></view></view>
      <view class="managed"><view class="k-between"><text class="block-title">可管理门店与城市</text><text>共 {{ storeList.length }} 项</text></view><view v-for="(store,index) in stores" :key="staffGrantKey(store)" class="store-row" hover-class="k-press" @click="preview(store)"><image :src="absUrl(store.cover) || '/static/media/cover-empty.png'" mode="aspectFill" /><view class="store-row__main"><text class="store-row__name">{{ store.name }}</text><text v-if="store.roleName" class="store-row__role">角色：{{ roleTextOf(store) }}</text></view><k-chip v-if="store.type" :tone="store.tone"><text>{{ store.type }}</text></k-chip></view></view>
      <view class="store-info"><text class="block-title">门店信息</text><view v-for="row in storeInfo" :key="row[0]"><text>{{ row[0] }}</text><text>{{ row[1] }}</text></view></view>
      <k-button block size="lg" :disabled="switching" @click="switchStore" :label="switching ? '正在切换…' : '切换到该工作身份'" /><view class="switch-tip"><k-icon name="info" :size="15" color="muted" /><text>切换后按所选门店或城市授权展示</text></view>
    </view>

    <view v-else-if="s===3" class="k-body k-pad-business roles-page">
      <view class="role-tabs"><view class="active"><text>员工角色</text></view><view hover-class="k-press" @click="showTemplate"><text>权限模板</text></view></view><view class="role-head"><text>角色列表</text><view v-if="grantOptions.length" hover-class="k-press" @click="newRole"><k-icon name="plus" :size="14" color="red" /><text>新建角色</text></view></view>
      <view class="roles"><view v-for="role in roles" :key="role.name" hover-class="k-press" @click="openRole(role)"><view class="role-icon" :style="{background:role.bg}"><k-icon :name="role.icon" :size="18" color="red" /></view><text>{{ role.name }}</text><view class="k-flex1" /><text>{{ role.count }} 人</text><k-icon name="chevron-right" :size="12" color="muted" /></view></view>
      <view class="permission"><view class="permission-title"><view><text>权限配置（{{ perm.selectedName || '' }}）</text><text>有效期：{{ perm.validity || '' }}</text></view><text @click="editPerm">权限说明</text></view><view class="permission-row permission-head"><text>权限项</text><text v-for="head in ['查看','编辑','审核','支付','导出']" :key="head">{{ head }}</text></view><view v-for="row in permissions" :key="row.name"><view class="permission-row"><text>{{ row.name }}</text><view v-for="(value,index) in row.values" :key="index"><k-icon v-if="value==='yes'" name="check" :size="17" color="green" :stroke="2.4" /><text v-else-if="value==='part'">部分</text><text v-else>—</text></view></view><text v-if="row.note" class="permission-note">{{ row.note }}</text></view></view>
    </view>

    <view v-else class="k-body k-pad-business logs-page">
      <view class="log-filter"><view hover-class="k-press" @click="pickCategory"><text>{{ categoryLabel }}</text><k-icon name="chevron-down" :size="12" color="muted" /></view><view hover-class="k-press" @click="pickDays"><text>近 {{ days }} 天</text><k-icon name="chevron-down" :size="12" color="muted" /></view><view hover-class="k-press" @click="pickResult"><k-icon name="filter" :size="14" color="ink2" /><text>{{ resultLabel }}</text></view></view>
      <view class="summary-grid"><view v-for="item in summaries" :key="item.label"><text>{{ item.label }}</text><text :class="item.red?'k-alert':''">{{ item.value }}</text></view></view>
      <text class="logs-title">操作日志{{ opl.scope ? '（' + opl.scope + '）' : '' }}</text><view class="logs-table"><view class="table-head"><text></text><text>操作人 / 时间</text><text>设备</text><text>结果</text></view><view v-for="log in logs" :key="log.logId" class="log-row" hover-class="k-press" @click="logTap(log)"><view class="log-action"><view :style="{background:log.color}"><k-icon :name="log.icon" :size="17" color="red" /></view><text>{{ log.action }}</text></view><view><text>{{ log.person }}</text><text>{{ log.time }}</text></view><text>{{ log.device }}</text><view class="result"><text :class="log.ok?'k-green':'k-alert'">{{ log.ok?'成功':'失败' }}</text><text v-if="!log.ok">{{ log.reason }}</text></view></view></view>
      <k-button block type="outline" size="md" class="report-button" @click="reportOp" label="上报异常操作" />
    </view>

    <k-tabbar active="business" mode="staff" />
  </view>
  </template>
</template>

<script setup>
import { recruitmentEnabled } from '@/common/features.js'
import { onlineStaff, merchantStaff, merchantService, cityLead, cityLeadFull } from '@/common/experience.js'
// 线上任务专员的工作台：staff 分包内的组件，显式引入（原先在 components/ 里走 easycom，被打进主包约 8KB）
import KOnlineWork from './components/k-online-work.vue'
import KMerchantWork from './components/k-merchant-work.vue'
import KServiceWork from './components/k-service-work.vue'
import KCityWork from './components/k-city-work.vue'
import KStaffPending from './components/k-staff-pending.vue'
import { pendingStaffScope } from '@/common/staff-scope.js'
import { INTAKE_PAGE, SERVICE_PAGE, SERVICE_ACTIVITIES_PAGE, ONLINE_DAILY_PAGE, ALSO_SERVICE_ROLE, roleTextOf } from './request-view.js'
// ---------------------------------------------------------------------------
// 员工业务中心接入情况：
//   s=1 身份、当前门店、未读消息来自 apiStaffHub；宫格入口跳到对应的员工页 / 经营页；右上角扫一扫识别本小程序的页面码
//   s=2 门店切换：可管理门店 = 登录态里的员工授权；切换只改本机的"当前门店"（数据范围），服务端每个请求仍按授权校验
//   s=3 角色与权限：成员来自员工授权表，临时换工 = 本店已入职的换工；权限矩阵就是服务端实际执行的那张表。
//       能添加 / 撤销哪些角色以服务端的 grantOptions 为准（角色切换后小程序里谁都不能），换工主理人、城市负责人只能由平台授予
//   s=4 操作与权限日志：员工写操作与越权被拒都会记录；只有主理人看全店，管家与普通员工只看自己的（服务端 opLogs），
//       标题后面按服务端返回的 scope 写明「本店全部员工 / 仅本人」，免得管家把自己的几条当成全店的；可上报异常操作到平台
// ---------------------------------------------------------------------------
import { absUrl } from '@/common/upload.js'
import { ref, computed, watch } from 'vue'
import { onLoad, onShow } from '@dcloudio/uni-app'
import { useScreen, toast, go, relaunch, back } from '@/common/screen.js'
import {
  apiStaffHub, apiStaffStoreInfo, apiStaffSwitchStore, apiStaffRoles, apiStaffGrant, apiStaffRevoke,
  apiStaffOpLogs, apiStaffReportOp
} from '@/common/api.js'
import {
  ensureSession, hasStaffAccess, currentStaffStore, currentStaffStoreId, currentAlsoService, selectStaffStore, getSessionRevision, staffStoreUrl, refreshAccount, staffStores, staffGrantKey
} from '@/common/experience.js'
import { errText, confirm, alert, prompt, sheet, pickPaged } from '@/common/ui.js'
import { staffCan } from '@/common/staff-perms.js'
import R from '@/common/routes.js'
import { DAILY_PAGE } from './daily-view.js'

const s = useScreen(4)
const pendingScope = computed(() => pendingStaffScope(currentStaffStore.value))
// 从工作台「切换门店」（?s=2）等入口直接打开某一屏时，左上角返回要回到来源页，
// 而不是落到本页第 1 屏；用户在本页到过第 1 屏之后，各屏的返回才回第 1 屏
let hubSeen = true
onLoad((q) => { const n = Number(q?.s || 1); hubSeen = !(n >= 2 && n <= 4) })
const backScreen = () => { if (hubSeen) s.value = 1; else back() }
onShow(() => loadScreen(s.value))
watch(s, (v) => { if (v === 1) hubSeen = true; loadScreen(v) })
const titles = ['门店切换', '角色与权限', '操作与权限日志']

async function loadScreen(v) {
  await ensureSession()
  if (!hasStaffAccess.value || onlineStaff.value || merchantStaff.value || merchantService.value || (cityLead.value && !cityLeadFull.value)) return
  if (!currentStaffStore.value?.storeId) return
  if (v === 1 || !hub.value.storeId) loadHub()
  if (v === 2) loadStores()
  if (v === 3) loadRoles()
  if (v === 4) loadLogs()
}

// ---------------- s=1 工作台 ----------------
const hub = ref({})
let hubRequest = 0
async function loadHub() {
  if (switching.value || !currentStaffStore.value?.storeId) return
  const request = ++hubRequest, storeId = currentStaffStoreId(), session = getSessionRevision()
  const current = () => request === hubRequest && session === getSessionRevision() && String(storeId) === String(currentStaffStoreId())
  try {
    const res = await apiStaffHub(storeId)
    if (current()) {
      hub.value = res.data || {}
      // hub 是实时的，工作台和 service.vue 读的是本机快照：后台刚勾上（或取消）兼任、或者角色变了（平台切换角色时页面还开着）时让快照跟上，失败了下次进来再对
      const staleService = typeof hub.value.alsoService === 'boolean' && hub.value.alsoService !== currentAlsoService.value
      const staleRole = !!hub.value.role && hub.value.role !== currentStaffStore.value?.roleCode
      if (staleService || staleRole) refreshAccount().catch(() => {})
    }
  } catch (e) {
    if (current()) toast(errText(e, '加载失败'))
  }
}
// 报名审核与交付（V63）：换工主理人看「线上任务审核」（本城商家需求的核实、转发，权限项 intake）和派给他的「商家岗位」，角标是待办数；
// 小院主理人原来的同名入口其实是审核线上任务的报名，改叫「线上任务报名审核」。个数不定，列数跟着个数走，不留空位。
// 小院主理人（10-30 店员 Luna 的备忘录）去掉换工审核（只改显示，老链接和服务端权限不动）；兼任商家服务人的多「商家需求」「活动审核」
const reviewEntries = computed(() => {
  const list = []
  if (staffCan('intake', 'audit')) {
    list.push({ label: '商家需求审核', icon: 'file-check', color: 'red', badge: Number(hub.value.intakePending) || 0, open: () => go(staffStoreUrl(INTAKE_PAGE, hub.value.storeId)) })
    list.push({ label: '商家岗位', icon: 'store', color: 'ochre', badge: Number(hub.value.merchantJobsPending) || 0, open: () => go(staffStoreUrl(INTAKE_PAGE + '?kind=jobs', hub.value.storeId)) })
  }
  if (isKeeper.value || staffCan('online', 'audit')) list.push({ label: '线上任务报名审核', icon: 'file-pen', color: 'red', open: () => go(staffStoreUrl(R.staffApplications + '?jobType=online', hub.value.storeId)) })
  if (alsoService.value || isCityLead.value) {
    list.push({ label: '商家需求', icon: 'store', color: 'ochre', badge: Number(hub.value.servicePending) || 0, open: () => go(staffStoreUrl(SERVICE_PAGE, hub.value.storeId)) })
    list.push({ label: '活动审核', icon: 'calendar-check', color: 'green', badge: Number(hub.value.serviceAuditPending) || 0, open: () => go(staffStoreUrl(SERVICE_ACTIVITIES_PAGE, hub.value.storeId)) })
  }
  if (!isKeeper.value) list.push({ label: '换工审核', icon: 'users', color: 'green', open: () => go(staffStoreUrl(R.staffApplications + '?jobType=volunteer', hub.value.storeId)) })
  return list
})
const frequentEntries = [
  { label: '纠纷调解', icon: 'scale', color: 'ochre', to: '/pages/governance/mediation?mode=support', managerOnly: true },
  { label: '房源管理', icon: 'warehouse', color: 'green', to: R.staffRooms, stay: true },
  // keeperTo / noKeeper：小院主理人不看换工、全职、兼职的岗位，岗位管理直接进线上任务；调度、保险不放入口
  { label: '岗位管理', icon: 'clipboard-list', color: 'ink', to: R.staffJobs, keeperTo: R.staffOnline + '?s=2' },
  { label: '调度管理', icon: 'list-checks', color: 'ink', to: R.staffDispatch, noKeeper: true },
  { label: '活动管理', icon: 'calendar-check', color: 'red', to: R.staffActivities },
  { label: '评价管理', icon: 'message-square', color: 'ochre', to: R.staffReviews },
  { label: '保险管理', icon: 'shield-check', color: 'ochre', to: R.staffInsurance, noKeeper: true },
  // 二消订单的核销与退款在保险与二消订单页的第 3 屏。2026-11-03 主人：这一页统一叫「二消订单」（工作台的「订单管理」改去旅居订单台了）
  { label: '二消订单', icon: 'badge-check', color: 'ochre', to: R.staffInsurance + '?s=3', stay: true },
  // 2026-11-03 主人：简化——原来「人员管理」点了先弹「员工与权限 / 人才库」菜单，拆成两格直接进。
  // 人才档案服务端要「岗位管理·编辑」，没有的角色不出这一格（与人才库页一致），免得点进去只有 403；人才库是换工、全职、兼职的报名人，小院主理人不出
  { label: '员工与权限', icon: 'user-round', color: 'ochre', action: 3 },
  { label: '人才库', icon: 'users', color: 'green', to: R.staffTalents, talents: true }
]
// 当前门店上的角色：服务端 hub 返回的是本次请求实际按哪家门店判的权，优先用它；
// hub 还没回来或属于上一家门店时，退回本机授权里同一家门店的角色。
const hubIsCurrent = computed(() => String(hub.value.storeId) === String(currentStaffStoreId()))
const storeRole = computed(() => (hubIsCurrent.value && hub.value.role)
  || currentStaffStore.value?.roleCode || '')
const isKeeper = computed(() => storeRole.value === 'keeper')
const isCityLead = computed(() => storeRole.value === 'city_lead')
// 这家店的小院主理人是否兼任商家服务人：同样优先听 hub 的
const alsoService = computed(() => isKeeper.value && (hubIsCurrent.value ? hub.value.alsoService === true : currentAlsoService.value))
const roleLabel = computed(() => (alsoService.value ? ALSO_SERVICE_ROLE : hub.value.roleName || ''))
// 周报、日报服务端只对主理人 / 管家开放（"仅门店主理人或管家…"），普通员工不显示入口，免得点进去只有 403
const canManage = computed(() => ['manager', 'keeper', 'staff', 'city_lead'].includes(storeRole.value))
const canStay = computed(() => ['keeper', 'merchant', 'city_lead'].includes(storeRole.value))
const canTalents = computed(() => staffCan('jobs', 'edit') && !isKeeper.value)
const frequent = computed(() => frequentEntries.filter(item => (recruitmentEnabled.value || ![R.staffJobs,R.staffTalents,R.staffDispatch].includes(item.to)) && (!item.managerOnly || storeRole.value === 'manager') && (!item.stay || canStay.value) && !(item.noKeeper && isKeeper.value) && (!item.talents || canTalents.value))
  .map(item => (item.keeperTo && isKeeper.value ? { ...item, to: item.keeperTo } : item)))
const dailyEntries = [
  { label: '日报与月度任务', icon: 'file-text', color: 'ochre', to: '/pages/staff/operations', roles: ['keeper', 'manager', 'city_lead'] },
  { label: '周报管理', icon: 'clipboard-list', color: 'ink', to: R.weekly, scoped: true, manage: true },
  // 城市负责人两本账都能做：经营账（小院主理人）和招募账（换工主理人）分开进
  { label: '招募周报', icon: 'clipboard-list', color: 'red', to: R.weekly + '?as=recruit', scoped: true, manage: true, leadOnly: true },
  { label: '招募日报', icon: 'file-text', color: 'red', to: R.daily + '?as=recruit', scoped: true, manage: true, leadOnly: true },
  // 2026-11-03 主人：简化——原来「下周任务」点了先弹「查看任务 / 发布任务」菜单，拆成两格直接进；发布只给主理人 / 管家（服务端同样只对他们开放）
  { label: '查看任务', icon: 'notebook-pen', color: 'ochre', to: R.tasks, scoped: true },
  { label: '发布任务', icon: 'square-pen', color: 'red', to: R.tasks + '?s=2', scoped: true, manage: true },
  { label: '日报管理', icon: 'file-text', color: 'ochre', to: R.daily, scoped: true, manage: true },
  // 数据看板是经营页（pages/manage/dashboard），带上当前门店；之前误跳到本页的「操作与权限日志」。
  // 服务端看板只对主理人 / 管家开放（KgManageService），权限表里普通员工的"部分"不够，所以两条都要满足
  { label: '数据看板', icon: 'chart-pie', color: 'indigo', to: R.dashboard, scoped: true, manage: true, dashboard: true }
]
// 换工主理人的周报是「换工招募情况周报」，入口跟着改名；小院主理人、员工还是周报管理
const daily = computed(() => dailyEntries.filter(item => (!item.roles || item.roles.includes(storeRole.value)) && (!item.manage || canManage.value) && (!item.leadOnly || isCityLead.value)
  && (!item.dashboard || staffCan('dashboard', 'view')))
  .map(item => (item.to === R.weekly && storeRole.value === 'manager' ? { ...item, label: '招募周报' } : item)))
// 2026-11-03 主人：简化——点格子直接进，不再先弹菜单（人员管理、下周任务原来各有一个菜单，现在各拆成两格）
const openItem = (item) => {
  if (item.action) s.value = item.action
  else if (item.manage && !canManage.value) toast('当前角色没有该门店的经营权限')
  // 经营页带上当前门店，否则服务端默认取第一家主理门店，日报会记到别的门店上
  else if (item.to) go(item.scoped ? staffStoreUrl(item.to) : item.to)
}
const openMessages = () => relaunch(R.messages)
// 2026-11-03 主人：简化——换工主理人专区拆成三格直接进（原来点一条入口再弹「数据看板 / 我的钱包 / 荣誉与关怀」菜单）
const ownerEntries = [
  { label: '看板', icon: 'chart-pie', color: 'indigo', to: () => go(staffStoreUrl(R.dashboard)) },
  { label: '钱包', icon: 'wallet', color: 'ochre', to: () => go(R.wallet) },
  { label: '荣誉', icon: 'award', color: 'red', to: () => go(R.honor) }
]
const openOwner = (item) => {
  if (!hub.value.isManager) return toast('换工主理人专区仅对本店换工主理人开放')
  item.to()
}
// 扫一扫：只认本小程序的页面码（岗位、活动等）和顾客出示的 10 位核销码，别的码不跳转。
// 之前顾客订单页的核销二维码 / 条形码里只有 10 位数字，扫了提示「不是袋鼠小院的二维码」
const scan = () => {
  // #ifdef MP
  uni.scanCode({
    success: (r) => {
      const verifyCode = r.path ? '' : String(r.result || '').replace(/\s/g, '')
      if (/^\d{10}$/.test(verifyCode) && !canStay.value) return toast('当前角色没有订单核销权限')
      if (/^\d{10}$/.test(verifyCode)) return go(R.staffInsurance + '?s=4&code=' + verifyCode)
      const m = /pages\/[\w/-]+(\?[^\s#]*)?/.exec(r.path || r.result || '')
      if (m) go('/' + m[0])
      else toast('不是袋鼠全球青年的二维码')
    }
  })
  // #endif
  // #ifndef MP
  toast('请在微信小程序中使用扫一扫')
  // #endif
}
// ---------------- s=2 门店切换 ----------------
const storeData = ref({ stores: [], current: null, info: [] })
const viewId = ref(null)
const switching = ref(false)
let storesRequest = 0
const storeList = computed(() => [...(storeData.value.stores || []), ...(staffStores.value || []).filter(g => !g.storeId && g.cityId != null).map(g => ({ ...g, role: g.roleCode, type: g.roleCode === 'merchant' ? '待绑定门店' : '城市授权', tone: 'ochre' }))])
const sel = computed(() => storeList.value.find(x => !x.storeId && String(staffGrantKey(x)) === String(viewId.value)) || storeList.value.find(x => x.current) || {})
const stores = computed(() => storeList.value.filter(x => !x.current).map(x => ({
  ...x, name: (String(staffGrantKey(x)) === String(viewId.value) ? '✓ ' : '') + (x.storeName || x.city || '城市筹备中')
})))
const storeInfo = computed(() => !sel.value.storeId && sel.value.city ? [['城市', sel.value.city], ['门店状态', '筹备中']] : storeData.value.info || [])
async function loadStores() {
  if (switching.value) return
  if (String(viewId.value || '').startsWith('city:')) return
  const request = ++storesRequest, storeId = currentStaffStoreId(), view = viewId.value, session = getSessionRevision()
  const current = () => request === storesRequest && session === getSessionRevision()
    && String(storeId) === String(currentStaffStoreId()) && String(view) === String(viewId.value)
  try {
    const res = await apiStaffStoreInfo(storeId, view || undefined)
    if (current()) storeData.value = res.data || {}
  } catch (e) {
    if (current()) toast(errText(e, '门店加载失败'))
  }
}
const preview = (store) => {
  if (switching.value) return
  viewId.value = staffGrantKey(store)
  if (!store.storeId) return
  loadStores()
}
async function switchStore() {
  if (switching.value) return
  const target = viewId.value
  if (!target || String(target) === String(currentStaffStoreId())) {
    return toast(storeList.value.length > 1 ? '请先在"可管理门店"里选一家' : '你只有这一家门店的授权')
  }
  switching.value = true
  const session = getSessionRevision()
  // 作废还在途中的旧门店和预览请求，防止它们晚到后覆盖新门店。
  storesRequest++
  hubRequest++
  try {
    const cityGrant = storeList.value.find(x => !x.storeId && String(staffGrantKey(x)) === String(target))
    if (cityGrant) {
      await refreshAccount()
      if (session !== getSessionRevision()) return
      await selectStaffStore(cityGrant)
      if (session === getSessionRevision()) relaunch(R.staff)
      return
    }
    const res = await apiStaffSwitchStore(target)
    if (session !== getSessionRevision()) return
    // 线上任务专员、商家服务人、城市负责人的门店没有本页这套业务入口：和线上任务工作台（k-online-work）里切门店一样，
    // 落好本机当前门店后回工作台，由工作台显示线上任务。之前列表里根本没有专员门店，切不过去
    if (['online_staff', 'merchant_service', 'city_lead'].includes(storeList.value.find(x => String(x.storeId) === String(target))?.role)) {
      await selectStaffStore(target)
      if (session === getSessionRevision()) relaunch(R.staff)
      return
    }
    if (staffStores.value.find(grant => String(grant.storeId) === String(target))?.sharedRecruitment) {
      await selectStaffStore(target)
      if (session === getSessionRevision()) relaunch(R.staffApplications + '?storeId=' + target)
      return
    }
    const [storesRes, hubRes] = await Promise.all([apiStaffStoreInfo(target), apiStaffHub(target)])
    if (session !== getSessionRevision()) return
    const selected = storesRes.data?.stores?.find(x => x.current && String(x.storeId) === String(target))
    if (!selected || String(hubRes.data?.storeId) !== String(target)) throw new Error('门店数据未更新，请重新切换')
    // 服务端已按实时授权接受这家门店；本机授权若是旧快照（会话中新授予的门店），先刷新账号再落本机，
    // 让本机门店、角色与服务端一致，而不是在服务端切换成功后报"暂无授权"。
    await selectStaffStore(target)
    if (session !== getSessionRevision()) return
    storeData.value = storesRes.data
    hub.value = hubRes.data
    viewId.value = null
    toast(res.msg || '已切换门店')
  } catch (e) {
    if (session === getSessionRevision()) toast(errText(e, '切换失败'))
  } finally {
    switching.value = false
  }
}

// ---------------- s=3 角色与权限 ----------------
const perm = ref({ roles: [], permissions: [], selectedName: '', validity: '', canManage: false })
const permRole = ref('')
const roles = computed(() => perm.value.roles || [])
const permissions = computed(() => perm.value.permissions || [])
// 这个账号在小程序里能开哪些角色，服务端给；空数组时「新建角色」和添加、撤销都不显示（角色切换后成员只由平台后台开通、撤销）
const grantOptions = computed(() => perm.value.grantOptions || [])
async function loadRoles() {
  try {
    perm.value = (await apiStaffRoles(currentStaffStoreId(), permRole.value || undefined)).data || {}
  } catch (e) {
    toast(errText(e, '角色加载失败'))
  }
}
// 授权 / 撤销 / 上报是写请求：网络慢时连点会重复提交
let busy = false
async function addMember(code, name) {
  // 对方「我的」页和员工入口上显示的「会员编号」就是账号 ID
  const v = await prompt('添加' + name, { placeholder: '对方的会员编号（账号 ID）或手机号' })
  if (!v || busy) return
  busy = true
  try {
    const res = await apiStaffGrant(currentStaffStoreId(), v, code)
    toast(res.msg || '已授予')
    loadRoles()
  } catch (e) {
    toast(errText(e, '授权失败'))
  } finally {
    busy = false
  }
}
async function openRole(role) {
  if (role.code !== 'temp' && role.code !== permRole.value) {
    permRole.value = role.code
    loadRoles()
  }
  const members = role.members || []
  const manage = perm.value.canManage && grantOptions.value.some(o => o.code === role.code)
  // 员工入口建的账号都叫「小院同学」，只看昵称分不清要撤销的是谁：名字后面带上会员编号（账号 ID，添加成员时填的就是它）；长昵称截短，免得编号被菜单挤掉
  const who = (m) => { const n = String(m.name || ''); return m.userId && n !== '用户' + m.userId ? `${n.length > 8 ? n.slice(0, 8) + '…' : n}（会员编号 ${m.userId}）` : n }
  const opts = members.map(m => (m.self ? m.name + '（我）' : who(m))).concat(manage ? ['＋ 添加' + role.name] : [])
  if (!opts.length) return toast(role.code === 'temp' ? '本店暂无在岗的临时换工' : '暂无成员')
  const i = await pickPaged(opts, '成员')
  if (i < 0) return
  if (manage && i === opts.length - 1) return addMember(role.code, role.name)
  const m = members[i]
  if (manage && m.grantId && !m.self) {
    if (!(await confirm('撤销授权', `撤销 ${who(m)} 的「${role.name}」授权？撤销后对方立即失去这家门店的员工身份。`)) || busy) return
    busy = true
    try {
      const res = await apiStaffRevoke(currentStaffStoreId(), m.grantId)
      toast(res.msg || '已撤销')
      loadRoles()
    } catch (e) {
      toast(errText(e, '撤销失败'))
    } finally {
      busy = false
    }
    return
  }
  alert(m.name, `${m.userId ? '会员编号 ' + m.userId + ' · ' : ''}${role.name}${m.since ? ' · ' + String(m.since).slice(0, 10) + ' 起' : ''}`)
}
async function newRole() {
  const options = grantOptions.value
  if (!options.length) return
  const i = await sheet(options.map(o => '添加' + o.name).concat('自定义角色'))
  if (i < 0) return
  if (i === options.length) return alert('自定义角色', '门店角色由平台统一维护，权限矩阵与服务端实际执行的一致。需要新角色请联系平台运营。')
  addMember(options[i].code, options[i].name)
}
const editPerm = () => alert('权限说明', '角色权限由平台统一维护，这里展示的就是服务端实际执行的权限；如需调整请联系平台运营。')
// 「权限模板」页签：选一个角色，下方「权限配置」换成该角色的那张矩阵（与服务端实际执行的同一张表），并滚到矩阵处。
// 之前这个页签跳到了「操作与权限日志」，名不副实
async function showTemplate() {
  const list = roles.value.filter(r => r.code !== 'temp')
  if (!list.length) return toast('角色还在加载，请稍后再试')
  const i = await sheet(list.map(r => r.name + '的权限模板'))
  if (i < 0) return
  permRole.value = list[i].code
  await loadRoles()
  uni.pageScrollTo({ selector: '.permission', duration: 200, fail: () => {} })
}

// ---------------- s=4 操作与权限日志 ----------------
const opl = ref({ summaries: [], rows: [] })
const category = ref('')
const days = ref(7)
const result = ref('')
const CATS = [{ v: '', l: '全部类型' }, { v: 'general', l: '一般操作' }, { v: 'grant', l: '授权变更' }, { v: 'export', l: '数据导出' }, { v: 'fund', l: '资金操作' }]
const categoryLabel = computed(() => CATS.find(c => c.v === category.value).l)
const resultLabel = computed(() => (result.value === 'failed' ? '仅看异常' : '筛选'))
const summaries = computed(() => (opl.value.summaries && opl.value.summaries.length ? opl.value.summaries
  : [{ label: '全部操作', value: '0' }, { label: '异常操作', value: '0', red: true }, { label: '数据导出', value: '0' }, { label: '资金操作', value: '0' }]))
const logs = computed(() => opl.value.rows || [])
async function loadLogs() {
  try {
    opl.value = (await apiStaffOpLogs({
      storeId: currentStaffStoreId(), category: category.value || undefined, days: days.value, result: result.value || undefined
    })).data || {}
  } catch (e) {
    toast(errText(e, '日志加载失败'))
  }
}
const pickCategory = async () => {
  const i = await sheet(CATS.map(c => c.l))
  if (i < 0) return
  category.value = CATS[i].v
  loadLogs()
}
const pickDays = async () => {
  const opts = [7, 30, 90]
  const i = await sheet(opts.map(d => `近 ${d} 天`))
  if (i < 0) return
  days.value = opts[i]
  loadLogs()
}
const pickResult = async () => {
  const i = await sheet(['全部结果', '仅看异常（失败 / 被拒）'])
  if (i < 0) return
  result.value = i === 1 ? 'failed' : ''
  loadLogs()
}
const logTap = (log) => alert(log.action, [log.person, log.time, log.device, log.ok ? '结果：成功' : '结果：失败（' + (log.reason || '') + '）', log.detail || ''].filter(Boolean).join('\n'))
async function reportOp() {
  const list = logs.value
  if (!list.length) return toast('这段时间没有操作记录')
  const i = await pickPaged(list.map(l => `${l.time} ${l.action}${l.ok ? '' : '（失败）'}`), '操作日志')
  if (i < 0) return
  const reason = await prompt('描述异常情况', { placeholder: '例如：不是本人操作 / 越权导出数据' })
  if (!reason || busy) return
  busy = true
  try {
    const res = await apiStaffReportOp(list[i].logId, reason.slice(0, 200))
    toast(res.msg || '已上报平台')
  } catch (e) {
    toast(errText(e, '上报失败'))
  } finally {
    busy = false
  }
}
</script>

<style scoped lang="scss">
.function-grid.review-entries { grid-template-columns: repeat(2, minmax(0, 1fr)); }
.function-grid.review-entries--1 { grid-template-columns: minmax(0, 1fr); }
.function-grid.review-entries--3 { grid-template-columns: repeat(3, minmax(0, 1fr)); }
.function-grid.review-entries > view { font-size: 14px; }
/* 2026-11-03 主人：简化——换工主理人专区三格 */
.function-grid.owner-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); }
.function-grid.owner-grid > view { font-size: 14px; }
.function-grid.review-entries--3 > view { font-size: 13px; }
/* 兼任时角色小标签很长：320 宽放不下店名，小标签折到下一行、卡片跟着长高，不把店名挤没；顶上的角色行收成一行 */
.current-store.current-store--long { height: auto; min-height: 62px; padding: 8px 12px; box-sizing: border-box; }
.current-store--long .k-row { flex-wrap: wrap; row-gap: 6px; }
.current-store--long .store-name { max-width: 100%; }
.staff-head>view:nth-child(2) { min-width: 0; }
.staff-head>view:nth-child(2)>text:last-child { overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
/* 三格时「线上任务报名审核」在 320 宽要折成两行：格子跟着长高，不压图标 */
.function-grid.review-entries--3 > view { height: auto; min-height: 72px; padding: 8px 4px; box-sizing: border-box; text-align: center; }
.review-icon { position: relative; display: flex; }
.review-badge { position: absolute; top: -6px; left: 20px; min-width: 18px; height: 18px; padding: 0 4px; box-sizing: border-box; border-radius: 9px; background: var(--k-alert); color: #fff; font-size: 10px; line-height: 18px; text-align: center; white-space: nowrap; }
.k-pad-business{padding-bottom:92px}.staff-head{height:68px;display:flex;align-items:center;gap:13px}.staff-head>image{width:50px;height:50px;border-radius:50%}.staff-head>view:nth-child(2)>text{display:block}.staff-head>view:nth-child(2)>text:first-child{font-family:var(--k-serif);font-size:18px;font-weight:700}.staff-head>view:nth-child(2)>text:last-child{margin-top:9px;color:var(--k-muted);font-size:11px}.head-icon{position:relative;flex-shrink:0;padding:6px;margin:-6px}.head-icon>text{position:absolute;top:-4px;right:-3px;min-width:18px;height:18px;border-radius:10px;background:var(--k-alert);color:white;font-size:10px;line-height:18px;text-align:center}.current-store{height:62px;padding:0 12px;border:1px solid var(--k-line);border-radius:10px;background:var(--k-paper);display:flex;align-items:center;gap:12px}.current-store view>text{display:block}.current-store view>view>text{font-family:var(--k-serif);font-size:15px;font-weight:700}.store-name{min-width:0;overflow:hidden;white-space:nowrap;text-overflow:ellipsis}.current-store>view>text:last-child{margin-top:9px;color:var(--k-muted);font-size:10px}.group-title{display:block;margin:17px 2px 9px;font-family:var(--k-serif);font-size:16px;font-weight:700}.function-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:10px}.function-grid>view{height:72px;border:1px solid var(--k-line);border-radius:9px;background:var(--k-paper);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:9px;font-family:var(--k-sans);font-size:12px}.daily-title{margin-top:14px}.daily-grid>view{height:70px}.owner-title{margin-top:14px}.owner-entry{height:62px;padding:0 13px;border:1px solid var(--k-line);border-radius:10px;background:var(--k-paper);display:flex;align-items:center;gap:12px}.owner-entry>view:first-child{width:38px;height:38px;border-radius:10px;background:#FAF1E5;display:flex;align-items:center;justify-content:center}.stay-entry{margin-bottom:4px}.stay-entry>view:first-child{background:var(--k-green-soft)}.daily-entry>view:first-child{background:var(--k-red-soft)}.owner-entry>view:nth-child(2)>text{display:block}.owner-entry>view:nth-child(2)>text:first-child{font-family:var(--k-serif);font-size:14px;font-weight:700}.owner-entry>view:nth-child(2)>text:last-child{margin-top:7px;color:var(--k-muted);font-size:10px}
.block-title{font-family:var(--k-serif);font-size:15px;font-weight:700}.active-store,.managed,.store-info{border:1px solid var(--k-line);border-radius:10px;background:var(--k-paper);padding:11px;margin-bottom:10px}.active-store>.block-title{display:block;margin-bottom:9px}.active-store>view{display:flex;align-items:center;gap:12px}.active-store image{width:102px;height:70px;border-radius:7px}.active-store view>view>text{font-family:var(--k-serif);font-size:15px;font-weight:700}.active-store view>text{display:block;margin-top:9px;color:var(--k-muted);font-size:10px}.managed>.k-between{height:27px}.managed>.k-between>text:last-child{font-size:12px}.store-row{height:55px;padding:5px 8px;border:1px solid var(--k-line);border-radius:8px;display:flex;align-items:center;gap:10px;margin-top:7px}.store-row image{width:57px;height:43px;border-radius:6px}.store-row>text{flex:1;min-width:0;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;font-family:var(--k-serif);font-size:13px;font-weight:700}.store-info>.block-title{display:block;height:26px}.store-info>view{min-height:31px;padding:5px 0;border-top:1px solid var(--k-line);display:flex;align-items:center;font-size:11px}.store-info>view text:first-child{flex-shrink:0;color:var(--k-muted)}.store-info>view text:last-child{min-width:0;margin-left:auto;padding-left:12px;text-align:right;word-break:break-all}.switch-tip{height:27px;display:flex;align-items:center;justify-content:center;gap:6px;color:var(--k-muted);font-size:10px}
.role-tabs{height:38px;border:1px solid var(--k-line);border-radius:9px 9px 0 0;display:grid;grid-template-columns:1fr 1fr}.role-tabs>view{display:flex;align-items:center;justify-content:center;font-family:var(--k-sans);font-size:14px}.role-tabs>view.active{color:var(--k-red);border-bottom:2px solid var(--k-red)}.role-head{height:42px;display:flex;align-items:center;font-family:var(--k-serif);font-size:15px;font-weight:700}.role-head>view{margin-left:auto;display:flex;align-items:center;gap:5px;font-family:var(--k-sans);font-size:11px;font-weight:400}.roles{border:1px solid var(--k-line);border-radius:9px;overflow:hidden}.roles>view{height:40px;padding:0 11px;border-top:1px solid var(--k-line);display:flex;align-items:center;gap:10px;font-family:var(--k-sans);font-size:13px}.roles>view:first-child{border-top:0}.role-icon{width:29px;height:29px;border-radius:9px;display:flex;align-items:center;justify-content:center}.roles>view>text:nth-of-type(2){color:var(--k-muted);font-family:var(--k-sans);font-size:11px}.permission{margin-top:11px;border:1px solid var(--k-line);border-radius:10px;background:var(--k-paper);padding:9px;overflow:hidden}.permission-title{height:45px;display:flex;align-items:center}.permission-title view text{display:block}.permission-title view text:first-child{font-family:var(--k-serif);font-size:14px;font-weight:700}.permission-title view text:last-child{margin-top:7px;color:var(--k-muted);font-size:9px}.permission-title>text{margin-left:auto;color:var(--k-indigo);font-size:11px;font-weight:700}.permission-row{height:27px;display:grid;grid-template-columns:1.35fr repeat(5,.8fr);align-items:center;border-top:1px solid var(--k-line);text-align:center;font-size:10px}.permission-row>text:first-child{text-align:left}.permission-row>view{display:flex;align-items:center;justify-content:center}.permission-row>view>text{color:var(--k-light)}.permission-row>view>text:first-child{color:var(--k-ochre);font-weight:700}.permission-head{height:30px;background:var(--k-paper2);font-family:var(--k-serif);font-weight:700}
.log-filter{height:43px;display:grid;grid-template-columns:1fr 1fr .9fr;gap:9px}.log-filter>view{height:34px;border:1px solid var(--k-line);border-radius:8px;display:flex;align-items:center;justify-content:center;gap:8px;font-size:12px}.summary-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-top:7px}.summary-grid>view{height:72px;padding:11px;border:1px solid var(--k-line);border-radius:9px;background:var(--k-paper);display:flex;flex-direction:column;justify-content:space-between}.summary-grid text:first-child{font-family:var(--k-sans);font-size:12px}.summary-grid text:last-child{font-family:var(--k-sans);font-size:26px}.logs-title{display:block;margin:13px 2px 8px;font-family:var(--k-serif);font-size:15px;font-weight:700}.logs-table{border:1px solid var(--k-line);border-radius:9px;overflow:hidden}.table-head{height:29px;display:grid;grid-template-columns:1.25fr 1.45fr .85fr .55fr;align-items:center;background:var(--k-paper2);font-family:var(--k-sans);font-size:10px;text-align:center}.log-row{height:47px;padding:0 6px;border-top:1px solid var(--k-line);display:grid;grid-template-columns:1.25fr 1.45fr .85fr .55fr;align-items:center;font-size:9px}.log-row>view:nth-child(2)>text{display:block;margin-top:3px}.log-action{display:flex;align-items:center;gap:7px;font-family:var(--k-serif);font-size:11px;font-weight:700}.log-action>view{width:27px;height:27px;border-radius:6px;display:flex;align-items:center;justify-content:center}.result{text-align:center}.result>text{display:block;font-weight:700}.result>text:last-child{margin-top:4px;font-size:8px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.report-button{margin-top:10px}.k-green{color:var(--k-green)}.k-red{color:var(--k-red)}
.switch-page .store-row{height:48px}.switch-page .store-row image{height:37px}.switch-page .store-info>view{min-height:27px}
.store-row__main{flex:1;min-width:0;display:flex;flex-direction:column;gap:4px}.store-row__main>text{overflow:hidden;white-space:nowrap;text-overflow:ellipsis}.store-row__name{font-family:var(--k-serif);font-size:13px;font-weight:700}.store-row__role{color:var(--k-muted);font-size:10px}
/* 2026-11-17 改版「小而精」：浅灰底 + 白卡（12 圆角、不描边、不加阴影），标题用系统黑体；宫格收进一张白卡，图标放在浅暖色的圆角方块里（和「我的」同一个样子）。
   入口、角标、按钮和文字一个不少；9px 的小字提到 10–11px。共用写法在 ./work-lite.scss。 */
@import './work-lite.scss';
.business-page{@include lite-page}
/* 其他身份的工作台是组件，整页顶替 .business-page：顶栏标题、按钮这几条穿透要写在页面里，小程序才认 */
@include lite-role-hosts;
.staff-head{height:60px;gap:10px}.staff-head>image{width:44px;height:44px}.staff-head>view:nth-child(2)>text:first-child{font-family:var(--k-sans);font-size:17px;font-weight:700}.staff-head>view:nth-child(2)>text:last-child{margin-top:3px;font-size:12px}
.head-icon>text{min-width:16px;height:16px;padding:0 4px;box-sizing:border-box;border-radius:8px;font-size:10px;line-height:16px}
/* 右上角「消息」「扫一扫」图标收小了，四周多留一圈看不见的可点范围（保持原来 38 左右见方），红点跟着挪回图标右上角 */
.head-icon{padding:8px;margin:-8px}.head-icon>text{top:-2px;right:-1px}.head-icon+.head-icon{margin-left:-2px}
.current-store{height:56px;padding:0 12px;border:0;border-radius:12px;gap:10px}.current-store view>view>text{font-family:var(--k-sans);font-size:14px;font-weight:600}.current-store>view>text:last-child{margin-top:4px;font-size:11px}
.current-store.current-store--long{min-height:56px}
.current-store :deep(.k-chip) text,.active-store :deep(.k-chip) text{font-family:var(--k-sans);font-size:10px;font-weight:500}
.group-title{margin:16px 2px 8px;font-family:var(--k-sans);font-size:16px;font-weight:700;line-height:22px}.daily-title,.owner-title{margin-top:16px}
.function-grid{gap:4px 0;padding:10px 4px;border-radius:12px;background:var(--k-paper)}
.function-grid>view{height:66px;border:0;border-radius:0;background:transparent;gap:6px;font-size:12px;color:var(--k-ink2)}.daily-grid>view{height:66px}
.function-grid.review-entries>view,.function-grid.owner-grid>view{font-size:13px}.function-grid.review-entries--3>view{font-size:12px}
.fn-icon,.review-icon{position:relative;width:40px;height:40px;border-radius:12px;background:linear-gradient(145deg,#FCF4E8,#F4E4CC);display:flex;align-items:center;justify-content:center;flex:0 0 auto}
.review-badge{top:-5px;left:auto;right:-8px;min-width:16px;height:16px;border-radius:8px;font-weight:600;line-height:16px}
.owner-entry{height:auto;min-height:60px;padding:8px 12px;box-sizing:border-box;border:0;border-radius:12px;gap:10px}.owner-entry>view:first-child{border-radius:12px}.owner-entry>view:nth-child(2)>text:first-child{font-family:var(--k-sans);font-size:14px;font-weight:600}.owner-entry>view:nth-child(2)>text:last-child{margin-top:3px;font-size:11px}.stay-entry{margin-bottom:0}
.block-title{font-family:var(--k-sans);font-size:15px;font-weight:700}
.active-store,.managed,.store-info{border:0;border-radius:12px;padding:12px;margin-bottom:8px}.active-store image{border-radius:8px}.active-store view>view>text{font-family:var(--k-sans);font-size:14px;font-weight:600}.active-store view>text{margin-top:6px;font-size:11px}
.active-store>view>view>text{font-family:var(--k-sans);font-size:11px;font-weight:400}
/* 当前门店的名字用正文深色，和右边的小标签对齐（原来跟着下面两行说明一起成了灰字、还往下错了几像素） */
.active-store .store-name{margin-top:0;color:var(--k-ink)}
.managed>.k-between>text:last-child{color:var(--k-muted)}
.store-row{border:0;border-radius:8px;background:#F7F5F2}.store-row>text{font-family:var(--k-sans);font-weight:600}.store-row__name{font-family:var(--k-sans);font-size:13px;font-weight:600}.store-row__role{font-size:11px}
.store-info>view{font-size:12px}.switch-tip{font-size:11px}
.role-tabs{height:40px;border:0;border-radius:12px;background:var(--k-paper);overflow:hidden}.role-tabs>view{position:relative;font-size:14px;color:var(--k-muted)}.role-tabs>view.active{border-bottom:0;color:var(--k-ink);font-weight:600}.role-tabs>view.active::after{content:'';position:absolute;left:50%;bottom:4px;width:16px;height:3px;margin-left:-8px;border-radius:2px;background:var(--k-red)}
.role-head{font-family:var(--k-sans);font-size:15px}.role-head>view{font-size:12px;color:var(--k-red-deep)}
.roles{border:0;border-radius:12px;background:var(--k-paper)}.roles>view{height:48px;padding:0 12px;font-size:14px}.role-icon{width:30px;height:30px}.roles>view>text:nth-of-type(2){font-size:12px}
.permission{margin-top:8px;border:0;border-radius:12px;padding:10px 12px}.permission-title view text:first-child{font-family:var(--k-sans);font-size:14px;font-weight:600}.permission-title view text:last-child{margin-top:4px;font-size:11px}.permission-title>text{color:var(--k-red-deep);font-size:12px;font-weight:500}
.permission-note{display:block;padding-bottom:6px;color:var(--k-muted);font-size:11px}.permission-row{height:30px;font-size:11px}.permission-row>view>text:first-child{color:var(--k-ochre-deep)}.permission-head{border-top:0;border-radius:6px;background:#F5F1EB;font-family:var(--k-sans);font-weight:600}
.log-filter{gap:8px}.log-filter>view{height:28px;border:0;border-radius:999px;background:var(--k-paper);gap:4px;font-size:12px;color:var(--k-ink2)}
.summary-grid{margin-top:4px}.summary-grid>view{height:68px;padding:10px;border:0;border-radius:12px}.summary-grid text:first-child{font-size:11px;color:var(--k-muted)}.summary-grid text:last-child{font-size:18px;font-weight:700;line-height:1.15;font-variant-numeric:tabular-nums}
.logs-title{margin:16px 2px 8px;font-family:var(--k-sans);font-size:15px}.logs-table{border:0;border-radius:12px;background:var(--k-paper)}.table-head{background:#F5F1EB}
.log-row{height:50px;font-size:10px}.log-action{font-family:var(--k-sans);font-weight:600}.log-action>view{border-radius:8px}.result>text{font-weight:600}.result>text:last-child{font-size:11px}.result>text+text:last-child{font-size:10px;font-weight:400;color:var(--k-ink2)}
/* 11-18 精修：入口图标都放进 40 的浅暖色渐变方块、暖棕线性图标（和「我的」宫格同一做法），不再一屏五六种颜色；
   角色、日志的图标方块同样改成浅暖色（脚本给的行内底色用 !important 盖过，名字照样写在旁边） */
.stay-entry>view:first-child,.daily-entry>view:first-child{width:40px;height:40px;background:linear-gradient(145deg,#FCF4E8,#F4E4CC)}
.role-icon,.log-action>view{background:linear-gradient(145deg,#FCF4E8,#F4E4CC) !important}
/* 门店信息：标题下面留 4，行高 36，行间发丝线，紧挨标题的第一行不画线 */
.store-info>.block-title{height:auto;margin-bottom:4px}
.store-info>view{position:relative;border-top:0}
.store-info>view::before{content:'';position:absolute;left:0;right:0;top:0;height:1px;background:var(--k-line);transform:scaleY(.5)}
.store-info>.block-title+view::before{display:none}
.switch-page .store-info>view{min-height:36px}
</style>
