<template>
  <k-staff-pending v-if="pendingScope" />
  <k-online-work v-else-if="onlineStaff" />
  <k-merchant-work v-else-if="merchantStaff" />
  <k-service-work v-else-if="merchantService" />
  <k-city-work v-else-if="cityLead && !cityLeadDaily" />
  <template v-else>
  <view class="k-page staff">
    <!-- 1 门店工作台 -->
    <view v-if="s === 1">
      <k-topbar :nav-height="92">
        <template #left>
          <view class="hello">
            <image class="hello__avatar" :src="helloAvatar" mode="aspectFill" />
            <view class="k-col k-gap6 hello__text">
              <text class="hello__name">{{ helloName }}</text>
              <text class="hello__role">{{ roleLine }}</text>
            </view>
          </view>
        </template>
        <template #right>
          <view class="switch-btn" hover-class="k-press-s" @click="go(R.staffBusiness + '?s=2')"><text>切换门店</text></view>
        </template>
      </k-topbar>
    <k-subscribe scenes="apply_progress,online_task,order,work_task" label="订阅工作消息" />
      <view class="k-body k-pad-tab">
        <view class="store" hover-class="k-press" @click="go(R.staffBusiness + '?s=2')">
          <k-icon name="house" :size="18" color="ink" :stroke="1.6" />
          <text class="store__name k-flex1">{{ storeName }}</text>
          <k-icon name="chevron-down" :size="16" color="muted" :stroke="1.8" />
        </view>

        <view v-if="currentStaffStore?.roleCode === 'manager'" class="admin-task-entry" hover-class="k-press" @click="go('/pages/governance/mediation?mode=support')"><k-icon name="scale" :size="18" color="ink2"/><view class="k-flex1 k-col k-gap4"><text class="admin-task-entry__title">纠纷调解</text><text class="k-meta">店家补充材料后接单，跟进授权门店调解</text></view><k-icon name="chevron-right" :size="12" color="muted"/></view>

        <view v-if="canReviewInsurance || cityLeadDaily" class="admin-task-entry" hover-class="k-press" @click="go('/pages/staff/insurance-account?tab=refunds')"><k-icon name="receipt" :size="18" color="ink2"/><view class="k-flex1 k-col k-gap4"><text class="admin-task-entry__title">保险退费</text><text class="k-meta">{{ cityLeadDaily ? '核实或修改离店日期，决定退款金额' : '核实授权门店的离店日期' }}</text></view><k-icon name="chevron-right" :size="12" color="muted"/></view>

        <view v-if="isKeeper || currentStaffStore?.roleCode === 'manager' || cityLeadDaily" class="admin-task-entry" hover-class="k-press" @click="go('/pages/staff/operations')"><view><text class="admin-task-entry__title">日报与月度任务</text><text class="k-meta">核对日报、查看任务进度和月度总结</text></view><k-icon name="chevron-right" :size="12" color="muted" /></view>

        <!-- 工作台直接展示当地换工三项；点击带上分类进入同一接口的明细。小院主理人（10-30 店员 Luna 的备忘录）换成本店旅居订单三项，点了进订单台对应分组，不放换工概况的链接 -->
        <view class="k-between sec">
          <text class="sec__title">今日概览</text>
          <text v-if="isKeeper" class="k-small k-muted">{{ today }}</text>
          <view v-else class="k-row k-gap4 daily-link" hover-class="k-press" @click="go(DAILY_PAGE)"><text class="k-small k-muted">{{ today }}</text><text class="daily-link__text">当地换工概况</text><k-icon name="chevron-right" :size="12" color="#8A5E36" :stroke="2" /></view>
        </view>
        <text class="overview-scope">{{ isKeeper ? storeName + ' · 全部房源' : (overviewCity ? overviewCity + ' · 全部合作门店' : '当地全部合作门店') }}</text>
        <view class="stats volunteer-stats">
          <view v-for="it in overview" :key="it.label" class="stat" hover-class="k-press-s" @click="openOverview(it)">
            <text class="stat__label">{{ it.label }}</text>
            <text class="stat__value" :class="{ 'stat__value--long': String(it.value).length > 4, 'stat__value--xlong': String(it.value).length > 6 }">{{ it.value }}<text v-if="it.value !== '—'" class="stat__unit">{{ it.unit }}</text></text>
          </view>
        </view>
        <view v-if="overviewError" class="overview-error" hover-class="k-press" @click="loadOverview"><text>{{ overviewError }}</text><text>点击重试</text></view>

        <!-- 兼任商家服务人：多一排本城线上任务三项，详情都在「线上任务概况」 -->
        <template v-if="alsoService">
          <view class="k-between sec">
            <text class="sec__title">线上任务</text>
            <view class="k-row k-gap4 daily-link" hover-class="k-press" @click="openOnlineDaily"><text class="daily-link__text">线上任务概况</text><k-icon name="chevron-right" :size="12" color="#8A5E36" :stroke="2" /></view>
          </view>
          <view class="stats volunteer-stats">
            <view v-for="it in onlineOverview" :key="it.label" class="stat" hover-class="k-press-s" @click="openOnlineDaily">
              <text class="stat__label">{{ it.label }}</text>
              <text class="stat__value" :class="{ 'stat__value--long': String(it.value).length > 4, 'stat__value--xlong': String(it.value).length > 6 }">{{ it.value }}<text v-if="it.value !== '—'" class="stat__unit">{{ it.unit }}</text></text>
            </view>
          </view>
          <view v-if="onlineError" class="overview-error" hover-class="k-press" @click="loadService"><text>{{ onlineError }}</text><text>点击重试</text></view>
        </template>

        <!-- 没有待办时标题和卡片都不显示：之前只剩一个标题压着一条空卡片的细线 -->
        <view v-if="hasManagerTasks" class="admin-task-entry" hover-class="k-press" @click="go(STAFF_TASK_PAGE)"><view><text class="admin-task-entry__title">管理员任务</text><text class="k-meta">接收任务、回复提问、提交完成情况</text></view><view class="k-row k-gap6"><text v-if="staffTaskTodoCount" class="admin-task-entry__count">{{ staffTaskTodoCount }} 项待办</text><k-icon name="chevron-right" :size="12" color="muted" /></view></view>
        <view v-if="priority.length" class="k-between sec"><text class="sec__title">优先处理</text></view>
        <k-card v-if="priority.length" :pad="0">
          <view v-for="(it, i) in priority" :key="it.title" class="prio" :class="{ line: i < priority.length - 1 }" hover-class="k-press" @click="openTodo(it)">
            <view class="k-circle prio__icon" :class="it.cls"><k-icon :name="it.icon" :size="18" color="red" :stroke="it.stroke || 2" :fill="it.fill" /></view>
            <view class="k-flex1 k-col k-gap4">
              <view class="k-row k-gap4"><text class="prio__num">{{ it.num }}</text><text class="prio__title">{{ it.title }}</text></view>
              <text class="k-meta">{{ it.sub }}</text>
            </view>
            <view class="go-btn"><text>去处理</text></view>
          </view>
        </k-card>

        <view class="k-between sec"><text class="sec__title">快捷入口</text></view>
        <view class="k-grid-4 quick">
          <view v-for="q in quick" :key="q.label" class="quick__item" hover-class="k-press-s" @click="q.to()">
            <view class="quick__icon">
              <k-icon :name="q.icon" :size="22" color="red" :stroke="1.6" />
              <text v-if="q.badge" class="quick__badge">{{ q.badge }}</text>
            </view>
            <text class="quick__label">{{ q.label }}</text>
          </view>
        </view>

        <!-- 采购报销（V66，主人 10-31 拍板）：只给小院主理人，服务端 /access 说可以才出（直营，或者改成非直营前有老记录要看） -->
        <view v-if="(isKeeper || cityLeadDaily) && reimburseEntry" class="admin-task-entry" hover-class="k-press" @click="openReimburse"><view><text class="admin-task-entry__title">采购报销</text><text class="k-meta">小院采购花的钱，在这里提交，等平台审核</text></view><k-icon name="chevron-right" :size="12" color="muted" /></view>
        <!-- 主人 2026-11-03「小院主理人，审核活动」：本店提交的活动由小院主理人先审（平台后台照样能审）；自己提交的、内容检查要人工把关的交给平台 -->
        <view v-if="canKeeperReview" class="admin-task-entry" hover-class="k-press" @click="openKeeperReview"><view><text class="admin-task-entry__title">审核本店活动</text><text class="k-meta">本店提交的活动，通过后才会上线</text></view><view class="k-row k-gap6"><text v-if="keeperReview" class="admin-task-entry__count">{{ keeperReview }} 场待审核</text><k-icon name="chevron-right" :size="12" color="muted" /></view></view>

        <!-- 发布招募（2026-10-18 商家端改版）：四个板块直接点进对应的发布表；只给有「岗位管理·编辑」权限的人（主理人、管家）看。小院主理人只发线上任务和活动，标题改「发布」，两格铺满不留空位 -->
        <template v-if="canPublish && publishEntries.length">
          <view class="k-between sec"><text class="sec__title">{{ isKeeper ? '发布' : '发布招募' }}</text><text class="k-meta">提交后平台审核，通过后公示</text></view>
          <view class="publish-card" :class="'publish-card--' + publishEntries.length">
            <view v-for="p in publishEntries" :key="p.kind" class="publish-card__item" hover-class="k-press-s" @click="openPublish(p.kind)">
              <view class="publish-card__icon"><k-icon :name="p.icon" :size="22" color="red" :stroke="1.7" /></view>
              <text class="publish-card__label">{{ p.label }}</text>
            </view>
          </view>
        </template>
      </view>
      <k-tabbar mode="staff" active="work" />
    </view>

    <!-- 2 全部待办 -->
    <view v-else-if="s === 2">
      <k-topbar title="全部待办" back custom-back @back="backFromTodos" />
      <view class="k-body k-pad-tab">
        <view class="k-row k-gap10">
          <view class="search k-flex1">
            <k-icon name="search" :size="18" color="muted" :stroke="1.8" />
            <input v-model="keyword" placeholder="搜索任务、报名编号、订单号" placeholder-class="k-placeholder" />
          </view>
          <view class="filter-btn" hover-class="k-press-s" @click="filterTodos"><k-icon name="filter" :size="16" color="ink" :stroke="1.8" /><text>筛选</text></view>
        </view>
        <scroll-view scroll-x class="tabs-scroll" :show-scrollbar="false">
          <view class="tabs">
            <view v-for="t in todoTabs" :key="t" class="tabs__item" :class="{ active: todoTab === t }" hover-class="k-press" @click="todoTab = t"><text>{{ t }}</text></view>
          </view>
        </scroll-view>

        <view v-for="g in todoGroupsView" :key="g.title" class="group">
          <text class="group__title" :class="{ 'k-alert': g.overdue }" @click="g.retry && loadTodos()">{{ g.title }}</text>
          <k-card v-if="g.items.length" :pad="0">
            <view v-for="(t, i) in g.items" :key="t.title + i" class="todo" :class="{ line: i < g.items.length - 1 }" hover-class="k-press" @click="openTodo(t)">
              <view class="k-circle todo__icon" :class="t.cls"><k-icon :name="t.icon" :size="18" color="red" :stroke="t.stroke || 2" :fill="t.fill" /></view>
              <view class="k-flex1 k-col k-gap3">
                <text class="todo__title">{{ t.title }}</text>
                <text class="k-meta">{{ t.sub }}</text>
                <view class="todo__row"><text class="k-meta">截止</text><text class="todo__due">{{ t.due }}</text><text v-if="t.over" class="todo__due">{{ t.over }}</text></view>
              </view>
              <k-chip :tone="t.chipTone">{{ t.chip }}</k-chip>
              <k-icon name="chevron-right" :size="12" color="muted" :stroke="1.8" />
            </view>
          </k-card>
        </view>
      </view>
      <k-tabbar mode="staff" active="work" />
    </view>

    <!-- 3 今日经营数据 -->
    <view v-else-if="s === 3">
      <k-topbar title="今日经营数据" back custom-back @back="s = 1" />
      <view class="k-body k-pad-tab">
        <view class="k-between">
          <view class="date-box"><text>{{ today }}</text><k-icon name="calendar" :size="14" color="muted" :stroke="1.6" /></view>
          <view class="source"><text>系统自动统计</text></view>
        </view>
        <view v-for="m in metrics" :key="m.label" class="metric" hover-class="k-press-s" @click="openDashboard">
          <view class="metric__icon" :style="{ background: m.color }"><k-icon :name="m.icon" :size="20" color="red" :stroke="m.fill ? 0.8 : 2.2" :fill="m.fill" /></view>
          <view class="metric__body">
            <text class="metric__label">{{ m.label }}</text>
            <view class="k-row k-gap12">
              <text class="metric__value">{{ m.value }}</text>
              <view class="k-row k-gap4"><text class="k-meta">{{ m.delta ? '较昨日' : '' }}</text><text class="stat__delta" :style="deltaStyle(m)">{{ m.delta }}</text></view>
            </view>
          </view>
          <view class="spark">
            <view v-for="(seg, i) in sparkSegs(m.points)" :key="'l' + i" class="spark__seg" :style="{ left: seg.x + 'px', top: seg.y + 'px', width: seg.len + 'px', transform: 'rotate(' + seg.deg + 'deg)', background: m.color }" />
            <view v-for="(p, i) in sparkPts(m.points)" :key="'p' + i" class="spark__dot" :style="{ left: (p.x - 3.5) + 'px', top: (p.y - 3.5) + 'px', borderColor: m.color, background: i === 0 ? m.color : 'var(--k-paper)' }" />
          </view>
        </view>
        <text class="k-meta foot">{{ metricNote }}</text>
      </view>
      <k-tabbar mode="staff" active="work" />
    </view>

    <!-- 4 任务详情 -->
    <view v-else>
      <k-topbar title="任务详情" back custom-back @back="backFromTask" />
      <view class="k-body k-pad-tab">
        <view class="task-head">
          <view class="k-row-start k-gap12">
            <view class="k-circle k-circle--red task-head__icon"><k-icon name="clock" :size="20" color="red" :stroke="2.2" /></view>
            <view class="k-flex1 k-col k-gap6">
              <view class="k-between">
                <text class="task-head__title k-flex1">{{ task ? task.title : taskEmptyText }}</text>
                <view v-if="task && task.overdue" class="overdue-chip"><text>逾期</text></view>
              </view>
              <text class="k-small k-muted">{{ task ? task.subtitle : '' }}</text>
              <view v-if="task" class="k-row k-gap8"><text class="k-small k-muted">截止时间</text><text class="k-small k-alert">{{ task.dueText }}</text></view>
            </view>
          </view>
        </view>

        <k-card :pad="0" class="k-mt12">
          <view class="blk k-between">
            <text class="blk__title">责任人</text>
            <view class="k-row k-gap8">
              <image v-if="task" class="owner__avatar" :src="ownerAvatar" mode="aspectFill" />
              <text class="k-text">{{ task ? task.owner : '' }}</text>
              <view class="go-btn go-btn--sm" hover-class="k-press-s" @click="assign"><text>转派</text></view>
            </view>
          </view>
          <view class="blk">
            <text class="blk__title">关联信息</text>
            <view v-for="r in related" :key="r.label" class="rel" hover-class="k-press" @click="r.to()">
              <text class="rel__label">{{ r.label }}</text>
              <text class="rel__value k-flex1">{{ r.value }}</text>
              <k-icon v-if="r.route" name="chevron-right" :size="12" color="muted" :stroke="1.6" />
            </view>
          </view>
          <view class="blk">
            <text class="blk__title">任务描述</text>
            <text class="k-text desc">{{ task ? task.desc : '' }}</text>
          </view>
          <view class="blk">
            <view class="rel"><text class="rel__label">截止时间</text><text class="rel__value">{{ task ? task.due : '' }}</text></view>
            <view class="rel"><text class="rel__label">创建时间</text><text class="rel__value">{{ task ? task.created : '' }}</text></view>
          </view>
          <view class="blk">
            <text class="blk__title">操作日志</text>
            <view class="logs">
              <view v-for="(l, i) in logs" :key="l.time" class="log">
                <view class="log__rail"><view class="log__dot" /><view v-if="i < logs.length - 1" class="log__line" /></view>
                <text class="log__time" :class="{ 'k-alert': l.red }">{{ l.time }}</text>
                <text class="log__text" :class="{ 'k-alert': l.red }">{{ l.text }}</text>
              </view>
            </view>
          </view>
          <view class="blk blk--last k-between">
            <view class="k-col k-gap6"><text class="blk__title">备注</text><text class="k-small k-muted">{{ task && task.note ? task.note : '暂无备注' }}</text></view>
            <text class="k-link add-note" @click="addNote">添加备注</text>
          </view>
        </k-card>
        <view class="k-mt12"><k-button block label="开始处理" @click="handleTask" /></view>
      </view>
      <k-tabbar mode="staff" active="work" />
    </view>
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
import { absUrl } from '@/common/upload.js'
import { get } from '@/common/request.js'
import { sheet } from '@/common/ui.js'
import { ref, computed, watch } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { useScreen, back, toast } from '@/common/screen.js'
import { goFromWorkbench as go } from '@/common/visit-subscriptions.js'
import {
  apiWorkbenchHome, apiWorkbenchTodos, apiWorkbenchTodo, apiWorkbenchMetrics,
  apiWorkbenchAssign, apiWorkbenchNote, apiStaffHub
} from '@/common/api.js'
import { experience, ensureSession, hasStaffAccess, currentStaffStore, currentAlsoService, staffStoreUrl, getSessionRevision, selectStaffStore, refreshAccount } from '@/common/experience.js'
import R from '@/common/routes.js'
import { DAILY_PAGE } from './daily-view.js'
import { SERVICE_PAGE, SERVICE_ACTIVITIES_PAGE, ONLINE_DAILY_PAGE, ONLINE_DAILY_API, ACTIVITY_CREATE_PAGE, ALSO_SERVICE_ROLE } from './request-view.js'
import { staffCan } from '@/common/staff-perms.js'
import { STAFF_TASK_PAGE, staffTaskTodoCount, checkStaffTaskReminder, hasStaffTaskRole } from '@/common/staff-task-reminder.js'
import { keeperReviewCount } from './task-flow-view.js'
import { listUrl as reimburseListUrl, reimburseVisible } from './reimburse-logic.js'
// 主人 2026-11-03：任务能发给全体员工、按岗位发，所以有任务岗位（换工主理人、小院主理人、线上专员、商家服务人、城市负责人）的都显示入口
const hasManagerTasks = computed(() => hasStaffTaskRole(experience.account?.staffGrants))

// 从消息 / 三方提醒带 ?s=2 直接打开「全部待办」时，左上角返回回到来源页；之前固定切回工作台首页，
// 而首页没有返回键，用户回不到刚才的消息。在本页到过首页之后，返回照常回首页
let todosLanding = false
// 城市负责人默认看城市工作台；从那里点「这家店的日常工作台」（?daily=1）才进这家店的待办，能接报名、面试
const dailyLink = ref(false)
const cityLeadDaily = computed(() => dailyLink.value && cityLeadFull.value)
const s = useScreen(4, { onLoad: (q) => { dailyLink.value = String(q.daily) === '1'; todosLanding = Number(q.s) === 2; enterLinkedStore(q.storeId) } })
// 商家需求的消息点进来带着门店（/pages/staff/index?storeId=…）：切到那家店，工作台才是那家店、那个角色的
const pendingScope = computed(() => pendingStaffScope(currentStaffStore.value))
const fullWorkbench = () => !pendingScope.value && !onlineStaff.value && !merchantStaff.value && !merchantService.value && (!cityLead.value || cityLeadDaily.value)
async function enterLinkedStore(target) {
  if (target == null || target === '') return
  try {
    await ensureSession()
    if (String(target) === String(storeId.value)) return
    await selectStaffStore(target)
    // 这一页的 onShow 可能已经按旧门店取过数（结果会被作废），切完要按新门店再取一次；另外几种工作台自己会跟着门店变
    if (fullWorkbench()) {
      loadReimburseEntry(); loadKeeperReview()
      await Promise.all([loadHome(), loadOverview(), loadTodos(), loadService()])
    }
  } catch (e) {
    toast((e && e.message) || '切换门店失败')
  }
}
const backFromTodos = () => {
  if (todosLanding && getCurrentPages().length > 1) back()
  else s.value = 1
}
// 任务详情的返回回到点进来的那一屏：之前从首页「优先处理」点进去，返回却落到「全部待办」
let taskFrom = 2
const backFromTask = () => { s.value = taskFrom }
const keyword = ref('')
const todoTab = ref('全部')
const isKeeper = computed(() => currentStaffStore.value?.roleCode === 'keeper')
const canReviewInsurance = computed(() => currentStaffStore.value?.roleCode === 'manager'
  && experience.account?.staffGrants?.some(g => g.active === true && g.roleCode === 'manager' && g.storeId && !g.sharedRecruitment))
const alsoService = currentAlsoService
// 小院主理人的待办没有保险、调度（服务端 KgWorkbenchService.collect 同样不出），报名只有线上任务
const todoTabs = computed(() => (isKeeper.value ? ['全部', '报名', '订单', '活动'] : ['全部', '报名', '订单', '保险', '活动', '调度'].filter(t => t !== '订单' || ['merchant', 'city_lead'].includes(currentStaffStore.value?.roleCode))))

// 门店与角色只能来自登录时服务端下发的员工授权，不从 UI 或本地存储推断。
// 当前门店（业务中心可切换），只是数据范围；权限仍由服务端按授权逐请求校验
const activeGrant = computed(() => currentStaffStore.value)
// 这里原本写死 /static/media/staff-avatar-abu.jpg —— 设计稿里某个真人的证件照，
// 紧挨着的就是真实账号昵称，摆在一起等于告诉用户"这是你的头像"。
// 退到品牌默认头像（袋鼠线稿，不是任何人），与 reminders.vue、个人中心一致：
// 既不冒充身份，也不让这个固定尺寸的圆形头像位塌成一个空洞。
const helloAvatar = computed(() => (experience.account?.avatar ? absUrl(experience.account.avatar) : '') || '/static/media/profile-avatar.jpg')
const helloName = computed(() => {
  const nickname = experience.account?.nickname || ''
  return nickname ? '你好，' + nickname : '你好'
})
const roleLine = computed(() => (activeGrant.value?.roleName ? '角色：' + (alsoService.value ? ALSO_SERVICE_ROLE : activeGrant.value.roleName) : ''))
const storeName = computed(() => activeGrant.value?.storeName || '')
const storeId = computed(() => activeGrant.value?.storeId || null)
// 数据看板服务端只对主理人 / 管家开放；普通员工点经营数据不再跳过去吃 403
const canManage = computed(() => staffCan('dashboard', 'view'))
const openDashboard = () => {
  if (!canManage.value) return toast('当前角色没有数据看板权限')
  go(staffStoreUrl(R.dashboard, storeId.value))
}

const WEEK = ['日', '一', '二', '三', '四', '五', '六']
// 设计稿里的 09/05 周四 是截图当天，改成真实的今天
const today = computed(() => {
  const d = new Date()
  const pad = (n) => (n < 10 ? '0' + n : '' + n)
  return pad(d.getMonth() + 1) + '/' + pad(d.getDate()) + ' 周' + WEEK[d.getDay()]
})

// ---------------------------------------------------------------------------
// 工作台数据全部来自 /app/staff/workbench/*：
//   home    今日三项概览（今天 0 点起，对比昨天同口径）+ 各类待办条数
//   todos   实时聚合的待办（报名 / 订单 / 保险 / 活动 / 调度），支持分类与搜索
//   todo    单条待办详情：关联信息、时间线、责任人与备注
//   metrics 今日经营数据六项 + 近 7 天趋势
//
// 待办不落表：处理完业务，下一次拉取它就不在了，不存在"事办完了待办还挂着"。
// 截止时间分两种来源：面试 / 活动 / 到岗日期是业务里真实存在的时间；
// 报名审核、退款、保险办理用的是平台设定的处理时限，卡片上会标出「平台时限」。
// ---------------------------------------------------------------------------
const VOLUNTEER_OVERVIEW = [
  { label: '招募缺口', key: 'shortfall', unit: '人' },
  { label: '今日到达', key: 'arriving', unit: '人' },
  { label: '一周内离开', key: 'leaving', unit: '人' }
]
// 小院主理人：键名就是订单台（stay-orders.vue）的分组，点了直接到那一组
const STAY_OVERVIEW = [
  { label: '今日到店', key: 'arrivals', unit: '单' },
  { label: '今日离店', key: 'departures', unit: '单' },
  { label: '待排房', key: 'unassigned', unit: '单' }
]
const overviewValues = ref({})
const overview = computed(() => (isKeeper.value ? STAY_OVERVIEW : VOLUNTEER_OVERVIEW).map(it => ({ ...it, value: overviewValues.value[it.key] ?? '—' })))
const overviewCity = ref(''), overviewError = ref('')
// 小院主理人的三个数是全店所有房源的合计（overview 没传 stayId）：点进订单台也要看全部房源，不然数字对不上（allStays，见 stay-orders.vue）
const openOverview = item => go(staffStoreUrl((isKeeper.value ? R.staffStayOrders + '?allStays=1&tab=' : DAILY_PAGE + '?tab=') + item.key, storeId.value))
let overviewRequest = 0
async function loadOverview() {
  const request = ++overviewRequest, store = storeId.value, session = getSessionRevision(), keeper = isKeeper.value
  const current = () => request === overviewRequest && store === storeId.value && session === getSessionRevision()
  overviewError.value = ''; overviewCity.value = ''
  overviewValues.value = {}
  if (!store) return
  try {
    if (keeper) {
      const d = (await get('/app/staff/stay/pms/overview', { storeId: store })).data || {}
      if (current()) overviewValues.value = d.counts || {}
      return
    }
    const d = (await get('/app/staff/daily/volunteers', { storeId: store })).data || {}
    if (!current()) return
    overviewCity.value = d.city || ''
    overviewValues.value = d
  } catch (e) { if (current()) overviewError.value = e?.message || (keeper ? '旅居订单概况暂时无法加载' : '换工概况暂时无法加载') }
}
// 采购报销入口（V66）：只问小院主理人（别的角色调 /access 会被拦截器 403，还会多核对一次授权）。读不到就不出，不打扰工作台，所以不等它、不进下面的 Promise.all
const reimburseEntry = ref(false)
let reimburseRequest = 0
async function loadReimburseEntry() {
  const request = ++reimburseRequest, store = storeId.value
  if (!store || !(isKeeper.value || cityLeadDaily.value)) { reimburseEntry.value = false; return }
  const visible = await reimburseVisible(get, store)
  if (request === reimburseRequest && String(store) === String(storeId.value)) reimburseEntry.value = visible
}
// 主人 2026-11-03「小院主理人，审核活动」：本店待审核的活动数（城市负责人顶上日常时也算）。读不到当 0，不打扰工作台
const keeperReview = ref(0)
const canKeeperReview = computed(() => (isKeeper.value || cityLeadDaily.value) && staffCan('activities', 'audit'))
const openKeeperReview = () => go(staffStoreUrl(SERVICE_ACTIVITIES_PAGE + '?as=keeper', storeId.value))
let keeperReviewRequest = 0
async function loadKeeperReview() {
  const request = ++keeperReviewRequest, store = storeId.value
  if (!store || !canKeeperReview.value) { keeperReview.value = 0; return }
  const n = await keeperReviewCount(get, store).catch(() => 0)
  if (request === keeperReviewRequest && String(store) === String(storeId.value)) keeperReview.value = n
}
const openReimburse = () => go(reimburseListUrl(storeId.value))
// 兼任商家服务人：本城线上任务三项（/app/staff/daily/online）和两个待办数（hub 的 servicePending、serviceAuditPending）。
// 两个接口互不牵连：概况读不出来时待办数照样显示；待办数读不出来就不出那两条，下次回到这页再取
const ONLINE_OVERVIEW = [
  { label: '招募中', key: 'recruiting', unit: '个' },
  { label: '招募缺口', key: 'shortfall', unit: '人' },
  { label: '待审核报名', key: 'toReview', unit: '份' }
]
const onlineValues = ref({}), onlineError = ref(''), serviceCounts = ref({})
const onlineOverview = computed(() => ONLINE_OVERVIEW.map(it => ({ ...it, value: onlineValues.value[it.key] ?? '—' })))
const openOnlineDaily = () => go(staffStoreUrl(ONLINE_DAILY_PAGE, storeId.value))
let serviceRequest = 0
async function loadService() {
  const request = ++serviceRequest, store = storeId.value, session = getSessionRevision()
  const current = () => request === serviceRequest && store === storeId.value && session === getSessionRevision()
  onlineError.value = ''
  if (!store || !isKeeper.value) { onlineValues.value = {}; serviceCounts.value = {}; return }
  // 开没开兼任以服务端为准：本机快照只在冷启动时更新，后台刚勾上（或取消）时这里还是旧的。hub 说的不一样就刷新账号，工作台和业务页才对得上
  const hub = await apiStaffHub(store).catch(() => null)
  if (!current()) return
  if (typeof hub?.data?.alsoService === 'boolean' && hub.data.alsoService !== alsoService.value) {
    await refreshAccount().catch(() => {})
    if (!current()) return
  }
  if (!alsoService.value) { onlineValues.value = {}; serviceCounts.value = {}; return }
  const daily = await get(ONLINE_DAILY_API, { storeId: store }).catch((e) => { if (current()) onlineError.value = e?.message || '线上任务概况暂时无法加载'; return null })
  if (!current()) return
  if (hub) serviceCounts.value = hub.data || {}
  onlineValues.value = (daily && daily.data) || {}
}
const counts = ref({})
const todoTotal = ref(0)
const todoData = ref({ groups: [], counts: {}, overdue: 0 })
const slaNote = ref('')
const metrics = ref([])
const metricNote = ref('')
const task = ref(null)
const staffs = ref([])
// 责任人头像：本店员工列表里按 ownerId 找；找不到用品牌默认图（不冒充任何人）
const ownerAvatar = computed(() => {
  const t = task.value
  const one = t && (staffs.value || []).find(x => String(x.userId) === String(t.ownerId))
  return (one && one.avatar ? absUrl(one.avatar) : '') || '/static/media/profile-avatar.jpg'
})
const loading = ref(false)

// 待办类型 → 卡片左侧的图标与配色（沿用页面既有的视觉词汇，不代表任何数值）
const LOOK = {
  app_review: { icon: 'clock', cls: 'k-circle--red', iconColor: 'white', stroke: 2.2, fill: false },
  interview: { icon: 'video', cls: 'k-circle--ochre', iconColor: 'white', stroke: 0.8, fill: true },
  offer: { icon: 'user-round-check', cls: 'k-circle--green', iconColor: 'white', stroke: 2, fill: false },
  stay_refund: { icon: 'wallet-cards', cls: 'k-circle--ochre', iconColor: 'white', stroke: 2, fill: false },
  shop_refund: { icon: 'shopping-bag', cls: 'k-circle--ochre', iconColor: 'white', stroke: 2, fill: false },
  insurance: { icon: 'shield-check', cls: 'k-circle--green', iconColor: 'white', stroke: 2, fill: false },
  activity: { icon: 'calendar-days', cls: 'k-circle--ochre', iconColor: 'white', stroke: 2, fill: false },
  dispatch: { icon: 'users-round', cls: 'k-circle--red', iconColor: 'white', stroke: 2, fill: false }
}
const look = (t) => LOOK[t] || LOOK.app_review

// 兼任商家服务人：「优先处理」最前面多两条。带 open 的条目点了直接去那一页，不进任务详情（它们不是工作台待办，服务端查不到详情）
const servicePriority = computed(() => {
  // 小院主理人审核本店活动（2026-11-03）：有待审核的排最前
  const list = keeperReview.value > 0 ? [{ icon: 'calendar-check', cls: 'k-circle--ochre', iconColor: 'white', num: String(keeperReview.value), title: '场本店活动待审核', sub: '本店提交的活动，通过后才会上线', open: openKeeperReview }] : []
  if (!alsoService.value) return list
  const pending = Number(serviceCounts.value.servicePending) || 0, audit = Number(serviceCounts.value.serviceAuditPending) || 0
  if (pending) list.push({ icon: 'store', cls: 'k-circle--red', iconColor: 'white', num: String(pending), title: '条商家需求待接手', sub: '本城换工主理人核实后转来', open: () => go(staffStoreUrl(SERVICE_PAGE, storeId.value)) })
  if (audit) list.push({ icon: 'calendar-check', cls: 'k-circle--ochre', iconColor: 'white', num: String(audit), title: '场活动待审核', sub: '本城合作商家提交的活动', open: () => go(staffStoreUrl(SERVICE_ACTIVITIES_PAGE, storeId.value)) })
  return list
})
// 「优先处理」取待办里最靠前的两类：数字与副标题都来自真实待办，没有就不显示这张卡
const priority = computed(() => {
  const items = todoData.value.groups.flatMap(g => g.items)
  const byType = {}
  items.forEach(i => { (byType[i.type] = byType[i.type] || []).push(i) })
  const order = ['app_review', 'interview', 'offer', 'stay_refund', 'shop_refund', 'insurance', 'activity', 'dispatch']
  const TITLE = {
    app_review: '份报名待审核', interview: '场面试待进行', offer: '人待确认录用',
    stay_refund: '笔住宿退款待处理', shop_refund: '笔服务退款待处理', insurance: '份保险待办理',
    activity: '场活动即将开始', dispatch: '个岗位缺人'
  }
  return servicePriority.value.concat(order.filter(t => byType[t] && byType[t].length).slice(0, 2).map(t => {
    const l = look(t)
    const rows = byType[t]
    return {
      icon: l.icon, cls: l.cls, iconColor: l.iconColor, fill: l.fill, stroke: l.stroke,
      num: String(rows.length), title: TITLE[t] || '条待办',
      sub: rows.slice(0, 2).map(r => r.sub).join('；'),
      key: rows[0].key
    }
  }))
})

const todoGroups = computed(() => todoData.value.groups.map(g => ({
  title: g.title,
  overdue: g.overdue,
  items: g.items.map(i => ({ ...i, ...look(i.type) }))
})))
// 全部待办没有待办时原先整屏空白，看不出是"没有待办"还是"没加载出来"。
// 不加新节点：借分组标题这一行显示读取中 / 读取失败（点击重试）/ 暂无待办，此时不渲染空卡片
const todosError = ref('')
const todoGroupsView = computed(() => {
  if (todoGroups.value.length) return todoGroups.value
  let title
  if (loading.value) title = '正在读取待办…'
  else if (todosError.value) title = todosError.value + '，点此重试'
  else if (keyword.value.trim()) title = '没有匹配「' + keyword.value.trim() + '」的待办'
  else title = todoTab.value === '全部' ? '暂无待办，处理完的事项不会留在这里' : '「' + todoTab.value + '」暂无待办'
  return [{ title, overdue: false, items: [], retry: !!todosError.value && !loading.value }]
})

const loadHome = async () => {
  if (!storeId.value) return
  const requestedStore = storeId.value, request = ++homeRequest
  const current = () => request === homeRequest && String(requestedStore) === String(storeId.value)
  try {
    const res = await apiWorkbenchHome(requestedStore)
    if (!current()) return
    const d = res.data || {}
    counts.value = d.counts || {}
    todoTotal.value = d.total || 0
  } catch (e) {
    if (current()) toast((e && e.message) || '概览加载失败')
  }
}

const loadTodos = async () => {
  if (!storeId.value) return
  const requestedStore = storeId.value, request = ++todosRequest
  const current = () => request === todosRequest && String(requestedStore) === String(storeId.value)
  loading.value = true
  todosError.value = ''
  try {
    const res = await apiWorkbenchTodos({ storeId: requestedStore, tab: todoTab.value, keyword: keyword.value })
    if (!current()) return
    todoData.value = res.data || { groups: [], counts: {}, overdue: 0 }
    slaNote.value = (res.data && res.data.slaNote) || ''
  } catch (e) {
    if (current()) {
      todosError.value = '待办加载失败'
      toast((e && e.message) || '待办加载失败')
    }
  } finally {
    if (request === todosRequest) loading.value = false
  }
}

const loadMetrics = async () => {
  if (!storeId.value) return
  const requestedStore = storeId.value, request = ++metricsRequest
  const current = () => request === metricsRequest && String(requestedStore) === String(storeId.value)
  try {
    const res = await apiWorkbenchMetrics(requestedStore)
    if (!current()) return
    const d = res.data || {}
    metrics.value = (d.metrics || []).map((m, i) => ({
      ...m,
      icon: METRIC_LOOK[i].icon, color: METRIC_LOOK[i].color, fill: METRIC_LOOK[i].fill
    }))
    metricNote.value = d.note || ''
  } catch (e) {
    if (current()) toast((e && e.message) || '经营数据加载失败')
  }
}

// 「较昨日」之前一律绿色，下降（服务端 up=false）也显示成绿色；下降改成红色
const deltaStyle = (it) => (it && it.delta && it.up === false ? 'color: var(--k-alert)' : '')

// 六个指标的图标与配色（顺序与服务端返回一致）
const METRIC_LOOK = [
  { icon: 'house', color: '#4A6E3A' },
  { icon: 'circle-dollar-sign', color: '#C99043' },
  { icon: 'file-text', color: '#40576B' },
  { icon: 'shopping-bag', color: '#8B7BB5' },
  { icon: 'star', color: '#4A6E3A', fill: true },
  { icon: 'users-round', color: '#D2692E' }
]

const taskLoading = ref(false)
// 直接用 ?s=4 打开（没有从列表选任务）时不能一直显示"加载中"，如实提示怎么进来
const taskEmptyText = computed(() => (taskLoading.value ? '加载中…' : '请从「全部待办」里选一条任务'))

const openTodo = async (t) => {
  if (t.open) return t.open()
  const requestedStore = storeId.value
  if (s.value !== 4) taskFrom = s.value === 1 ? 1 : 2
  s.value = 4
  task.value = null
  taskLoading.value = true
  try {
    const res = await apiWorkbenchTodo(t.key, requestedStore)
    if (String(requestedStore) !== String(storeId.value)) return
    task.value = (res.data && res.data.task) || null
    staffs.value = (res.data && res.data.staffs) || []
  } catch (e) {
    toast((e && e.message) || '任务详情加载失败')
  } finally {
    taskLoading.value = false
  }
}

const related = computed(() => (task.value ? (task.value.related || []).map(r => ({ ...r, to: () => (r.route ? go(r.route) : null) })) : []))
const logs = computed(() => (task.value ? task.value.logs || [] : []))

const filterTodos = async () => {
  const items = ['全部'].concat(todoTabs.value.slice(1)).map(t => {
    const n = todoData.value.counts ? todoData.value.counts[t] : undefined
    return t + (n === undefined ? '' : '（' + n + '）')
  })
  const i = await sheet(items)
  if (i < 0) return
  todoTab.value = todoTabs.value[i]
  loadTodos()
}

// 转派 / 保存备注：网络慢时连点会重复提交
let saving = false
const assign = async () => {
  if (!task.value) return
  if (!staffs.value.length) {
    toast('本店暂时没有可转派的员工')
    return
  }
  const i = await sheet(staffs.value.map(x => x.name + (x.role ? '（' + x.role + '）' : '')))
  if (i < 0 || saving) return
  saving = true
  try {
    const out = await apiWorkbenchAssign(task.value.key, staffs.value[i].userId, storeId.value)
    toast((out.data && out.data.message) || '已转派')
    await openTodo(task.value)
  } catch (e) {
    toast((e && e.message) || '转派失败')
  } finally {
    saving = false
  }
}

const addNote = () => {
  if (!task.value) return
  uni.showModal({
    title: '备注',
    editable: true,
    placeholderText: '只有本店员工能看到，200 字以内',
    content: task.value.note || '',
    success: async (r) => {
      if (!r.confirm || saving) return
      const note = (r.content || '').trim()
      if (note.length > 200) return toast('备注最多 200 字')
      saving = true
      try {
        const out = await apiWorkbenchNote(task.value.key, note, storeId.value)
        toast((out.data && out.data.message) || '已保存')
        await openTodo(task.value)
      } catch (e) {
        toast((e && e.message) || '保存失败')
      } finally {
        saving = false
      }
    }
  })
}

// 没有任务（直接 ?s=4 打开、任务已被别人处理完）时，之前「开始处理」一律跳去报名管理，和这条任务无关；
// 现在回到「全部待办」重新选
const handleTask = () => {
  if (task.value && task.value.route) {
    go(task.value.route)
    return
  }
  s.value = 2
}

// 小院主理人：报名管理换成线上报名，保险管理换成活动管理（工作台不再放换工相关的入口）
const quick = computed(() => [
  { icon: 'file-text', color: 'ink', label: '全部待办', badge: todoTotal.value ? String(todoTotal.value) : '', to: () => { s.value = 2 } },
  isKeeper.value
    ? { icon: 'file-pen', color: 'ochre', label: '线上报名', to: () => go(R.staffApplications + '?jobType=online') }
    : { icon: 'file-pen', color: 'ochre', label: '报名管理', to: () => go(R.staffApplications) },
  // 2026-11-03 主人：「订单管理」改去旅居订单台（排房 / 房态 / 入住退房）；二消那页统一叫「二消订单」，在业务页的高频工作里
  { icon: 'clipboard-list', color: 'ink', label: '订单管理', stay: true, to: () => go(staffStoreUrl(R.staffStayOrders, storeId.value)) },
  isKeeper.value
    ? { icon: 'calendar-check', color: 'ochre', label: '活动管理', to: () => go(R.staffActivities) }
    : { icon: 'shield-check', color: 'ochre', label: '保险管理', to: () => go(R.staffInsurance) }
].filter(item => !item.stay || ['keeper','merchant','city_lead'].includes(currentStaffStore.value?.roleCode)))

// 发布招募：换工 / 兼职 / 全职进岗位发布表（jobs.vue ?s=2&kind=），线上任务进线上任务发布页
const PUBLISH_ENTRIES = [
  { kind: 'volunteer', label: '招募换工', icon: 'heart-handshake' },
  { kind: 'parttime', label: '招募兼职', icon: 'briefcase' },
  { kind: 'fulltime', label: '招募全职', icon: 'briefcase-business' },
  { kind: 'online', label: '线上任务', icon: 'laptop' }
]
const KEEPER_PUBLISH = [
  { kind: 'online', label: '线上任务', icon: 'laptop', item: 'online' },
  { kind: 'activity', label: '活动', icon: 'calendar-plus', item: 'activities' }
]
const publishEntries = computed(() => (isKeeper.value
  ? KEEPER_PUBLISH.filter(p => staffCan(p.item, 'edit'))
  : PUBLISH_ENTRIES.filter(p => p.kind !== 'online' || staffCan('online', 'edit'))).filter(p => recruitmentEnabled.value || p.kind === 'activity'))
const canPublish = computed(() => staffCan('jobs', 'edit'))
const openPublish = (kind) => go(kind === 'activity' ? ACTIVITY_CREATE_PAGE : kind === 'online' ? R.staffOnline + '?s=1' : R.staffJobs + '?s=2&kind=' + kind)

const SW = 82, SH = 36
const sparkPts = (pts) => pts.map((v, i) => ({ x: 4 + (i * (SW - 8)) / (pts.length - 1), y: 4 + (1 - v) * (SH - 8) }))
const sparkSegs = (pts) => {
  const p = sparkPts(pts)
  return p.slice(0, -1).map((a, i) => {
    const b = p[i + 1]
    const dx = b.x - a.x, dy = b.y - a.y
    return { x: a.x, y: a.y, len: Math.sqrt(dx * dx + dy * dy), deg: (Math.atan2(dy, dx) * 180) / Math.PI }
  })
}

// 搜索框输入后延迟再查，避免每敲一个字就打一次接口
let timer = null
watch(keyword, () => {
  if (timer) clearTimeout(timer)
  timer = setTimeout(loadTodos, 350)
})
watch(todoTab, loadTodos)
watch(s, (v) => {
  if (v === 1) todosLanding = false
  if (v === 2) loadTodos()
  if (v === 3) loadMetrics()
})

let homeRequest = 0, todosRequest = 0, metricsRequest = 0
watch(storeId, () => {
  homeRequest++; todosRequest++; metricsRequest++; overviewRequest++; serviceRequest++; reimburseRequest++; keeperReviewRequest++
  reimburseEntry.value = false; keeperReview.value = 0
  overviewValues.value = {}
  overviewCity.value = ''; overviewError.value = ''
  onlineValues.value = {}; onlineError.value = ''; serviceCounts.value = {}
  if (!todoTabs.value.includes(todoTab.value)) todoTab.value = '全部'
  counts.value = {}; todoTotal.value = 0
  todoData.value = { groups: [], counts: {}, overdue: 0 }; todosError.value = ''
  slaNote.value = ''; metrics.value = []; metricNote.value = ''
  task.value = null; staffs.value = []; loading.value = false
})

onShow(async () => {
  // 冷启动时登录态是异步恢复的，等恢复完再请求；没有员工授权时
  // main.js 的路由守卫会把页面带去身份页，这里不重复处理。
  await ensureSession()
  if (currentStaffStore.value?.sharedRecruitment) {
    uni.redirectTo({ url: staffStoreUrl(R.staffApplications, currentStaffStore.value.storeId) })
    return
  }
  // 本城还没有门店（城市授权）时工作台只显示筹备页，但管理员任务照样能派来：待办数先刷新
  checkStaffTaskReminder()
  if (pendingScope.value) return
  if (!hasStaffAccess.value || !fullWorkbench()) return
  loadReimburseEntry(); loadKeeperReview()
  // 从门店切换页返回时也刷新，不能只在首次挂载时读取旧门店数据。
  await Promise.all([loadHome(), loadOverview(), loadTodos(), loadService(), ...(s.value === 3 ? [loadMetrics()] : [])])
})
</script>

<style scoped lang="scss">
/* 2026-11-17 改版「小而精」：浅灰底上放白卡（12 圆角、不描边、不加阴影），标题用系统黑体，数字加粗做大小对比；和用户端「我的」「消息」一个路子，只是更紧凑。
   入口、按钮、文字、状态一个不少，只改大小和样子。 */
.staff { --k-bg: #F7F5F2; --k-sh1: none; background: #F7F5F2; }
.staff .k-body { padding-left: 12px; padding-right: 12px; }
.staff :deep(.k-card) { border-radius: 12px !important; box-shadow: none; }
.staff :deep(.k-navbar__title) { font-family: var(--k-sans); font-size: 16px; font-weight: 600; }
.staff :deep(.k-button) { border-radius: 999px; }
.staff :deep(.k-button.is-lg) { height: 44px; font-size: 15px; }
.staff :deep(.k-chip:not(.is-pill)) { height: 17px; padding: 0 5px; border-radius: 4px; font-size: 10px; font-weight: 500; }
.staff :deep(.subscribe-entry) { padding: 4px 12px 8px; }
.staff :deep(.subscribe-entry button) { min-height: 36px; border: 0; border-radius: 12px; background: var(--k-paper); color: var(--k-ochre-deep); font-size: 12px; }
/* 其他身份的工作台是组件，整页顶替上面的 .staff：顶栏标题、按钮这几条穿透要写在页面里，小程序才认（说明见 ./work-lite.scss） */
@import './work-lite.scss';
@include lite-role-hosts;
.admin-task-entry { display:flex;align-items:center;justify-content:space-between;gap:12px;min-height:60px;padding:10px 12px;margin-top:8px;border:0;border-radius:12px;background:var(--k-paper); }
.admin-task-entry>view:first-child { display:flex;flex-direction:column;gap:3px;min-width:0; }
.admin-task-entry__title { font-size:14px;font-weight:600;line-height:20px; }.admin-task-entry__count { color:var(--k-red-deep);font-size:12px;font-weight:600;white-space:nowrap; }
.hello { display: flex; align-items: center; gap: 10px; padding-left: 8px; min-width: 0; }
.hello__text { min-width: 0; }
.hello__avatar { width: 44px; height: 44px; border-radius: 50%; flex: 0 0 auto; }
.hello__name { font-family: var(--k-sans); font-weight: 700; font-size: 17px; line-height: 1.3; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
.hello__role { font-size: 12px; color: var(--k-muted); }
.switch-btn { flex-shrink: 0; height: 28px; padding: 0 12px; border: 1px solid var(--k-red-line); border-radius: 999px; background: var(--k-paper); display: flex; align-items: center; color: var(--k-ochre-deep); font-size: 12px; font-weight: 500; margin-right: 8px; }
.store { margin-top: 2px; height: 44px; padding: 0 12px; border: 0; border-radius: 12px; background: var(--k-paper); display: flex; align-items: center; gap: 8px; }
.store__name { font-size: 14px; font-weight: 600; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
/* 11-18 第二轮精修：区块标题 16 / 700，左边和白卡齐平（不再多缩 2px） */
.sec { margin: 16px 0 8px; }
.sec__title { font-family: var(--k-sans); font-weight: 700; font-size: 16px; line-height: 22px; color: var(--k-ink); }
.daily-link { flex-shrink: 0; }
.daily-link__text { margin-left: 6px; font-size: 12px; color: var(--k-red-deep); font-weight: 500; }
.stat { height: 100px; border: 0; border-radius: 12px; background: var(--k-paper); display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 6px; }
/* 数据格（11-18 第二轮精修）：数字在上 18 / 700 等宽，说明 11 / muted 在下（只用 order 调顺序，模板不动） */
.stat__label { font-size: 11px; color: var(--k-muted); }
.stat__value { order: -1; font-size: 18px; font-weight: 700; line-height: 1.25; font-variant-numeric: tabular-nums; }
.stat__delta { font-size: 12px; color: var(--k-green); font-weight: 600; }
.overview-scope { display:block; margin:-4px 0 8px; font-size:11px; color:var(--k-muted); }
.volunteer-stats { display:flex; border:0; border-radius:12px; overflow:hidden; background:var(--k-paper); }
.volunteer-stats .stat { position:relative; flex:1; border:0; border-radius:0; height:64px; gap:2px; }
/* 第一格原来铺浅棕底，像被选中的页签，其实不是：和另外两格一样白底 */
.volunteer-stats .stat:first-child { background:var(--k-paper); color:inherit; }
/* 格子之间一条短的发丝竖线，不通到顶 */
.volunteer-stats .stat + .stat::before { content:""; position:absolute; left:0; top:18px; bottom:18px; width:1px; background:var(--k-line); transform:scaleX(.5); }
.stat__unit { font-size:11px; font-weight:400; margin-left:3px; }
.overview-error { display:flex; justify-content:space-between; gap:10px; padding:10px 0; color:var(--k-alert); font-size:12px; line-height:1.6; }
/* 320 宽一张卡只有约 90px：5 位以上的数字字号收小，再长就省略号；「较昨日 +1234」一行也不许撑出卡片 */
.stat { min-width: 0; box-sizing: border-box; padding: 0 6px; }
.stat__value, .stat__row { max-width: 100%; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
.stat__value--long { font-size: 16px; }
.stat__value--xlong { font-size: 14px; }
.stat__row>text { flex-shrink: 0; white-space: nowrap; }
.stat__row .stat__delta { flex-shrink: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; }
.prio { position: relative; display: flex; align-items: center; gap: 10px; padding: 10px 12px; }
/* 行间发丝线（11-18）：不再从卡片左边通到右边的 1px 实线，最后一行自然没有线 */
.prio + .prio::before, .todo + .todo::before { content: ""; position: absolute; left: 12px; right: 0; top: 0; height: 1px; background: var(--k-line); transform: scaleY(.5); transform-origin: 0 0; }
/* 待办类型图标（11-18）：和快捷入口一家，浅暖色圆角方块里放暖棕线性图标（原来是实心彩色圆 + 白图标，一屏叠三四个最重） */
.prio__icon, .todo__icon { width: 36px; height: 36px; border-radius: 12px; background: linear-gradient(145deg, #FCF4E8, #F4E4CC); }
/* 数字和标题按基线对齐；副标题一行，放不下省略（和商家服务工作台同一种行一致） */
.prio .k-row { align-items: baseline; }
.prio .k-flex1 { min-width: 0; }
.prio .k-meta { overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
/* 「去处理」每行都有一个：浅底暖棕字，不描边 */
.prio .go-btn { border-color: transparent; background: var(--k-red-soft); }
.prio__num { font-size: 16px; font-weight: 700; color: var(--k-red-deep); }
.prio__title { font-size: 14px; font-weight: 600; }
.go-btn { height: 28px; padding: 0 12px; border: 1px solid var(--k-red-line); border-radius: 999px; display: flex; align-items: center; color: var(--k-red-deep); font-size: 12px; font-weight: 500; background: var(--k-paper); flex: 0 0 auto; }
.go-btn--sm { height: 26px; }
/* 「切换门店」「转派」是单独能点的小胶囊：样子不变，上下各多出一圈看不见的可点范围，手指好点 */
.switch-btn, .go-btn--sm { position: relative; }
.switch-btn::after, .go-btn--sm::after { content: ""; position: absolute; left: -4px; right: -4px; top: -8px; bottom: -8px; }
/* 快捷入口：一张白卡里一排，图标放在浅暖色的圆角方块里（和「我的」宫格同一个样子） */
.quick { gap: 0; padding: 12px 4px 10px; border-radius: 12px; background: var(--k-paper); }
.quick__item { min-height: 62px; border: 0; border-radius: 0; background: transparent; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 6px; }
.quick__icon { position: relative; width: 40px; height: 40px; border-radius: 12px; background: linear-gradient(145deg, #FCF4E8, #F4E4CC); display: flex; align-items: center; justify-content: center; }
.quick__badge { position: absolute; top: -5px; right: -8px; min-width: 16px; height: 16px; padding: 0 4px; border-radius: 8px; background: var(--k-alert); color: #fff; font-size: 10px; line-height: 16px; text-align: center; font-weight: 600; }
.quick__label { font-size: 12px; line-height: 17px; color: var(--k-ink2); }
/* 发布招募：一张白卡里四格，暖棕浅底圆角图标 */
.publish-card { padding: 12px 4px 10px; border-radius: 12px; background: var(--k-paper); box-shadow: none; display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); }
.publish-card--1 { grid-template-columns: minmax(0, 1fr); }
.publish-card--2 { grid-template-columns: repeat(2, minmax(0, 1fr)); }
.publish-card__item { min-height: 62px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 6px; }
.publish-card__icon { width: 40px; height: 40px; border-radius: 12px; background: linear-gradient(145deg, #FCF4E8, #F4E4CC); display: flex; align-items: center; justify-content: center; }
.publish-card__label { font-size: 12px; line-height: 17px; font-weight: 400; color: var(--k-ink2); }

.search { height: 36px; padding: 0 12px; border: 0; border-radius: 999px; background: var(--k-paper); display: flex; align-items: center; gap: 8px; }
.search input { flex: 1; min-width: 0; height: 36px; font-size: 14px; }
.filter-btn { height: 36px; padding: 0 14px; border: 0; border-radius: 999px; background: var(--k-paper); display: flex; align-items: center; gap: 6px; font-size: 13px; flex: 0 0 auto; }
.tabs-scroll { margin: 8px -12px 0; width: calc(100% + 24px); white-space: nowrap; }
/* 页签（下划线式，11-18）：字 14，没选 400 / muted，选中 600 / 墨色 + 下面 16×3 的暖棕短条；底线换成发丝线；行高约 40 */
.tabs { position: relative; display: flex; justify-content: space-between; padding: 0 14px; border-bottom: 0; width: 100%; }
.tabs::before { content: ""; position: absolute; left: 0; right: 0; bottom: 0; height: 1px; background: var(--k-line); transform: scaleY(.5); transform-origin: 0 100%; }
.tabs__item { position: relative; padding: 10px 2px 11px; font-size: 14px; font-weight: 400; color: var(--k-muted); flex: 0 0 auto; }
.tabs__item.active { color: var(--k-ink); font-weight: 600; }
.tabs__item.active::after { content: ""; position: absolute; left: 50%; right: auto; width: 16px; margin-left: -8px; bottom: 0; height: 3px; background: var(--k-red); border-radius: 2px; }
.group { margin-top: 12px; }
.group__title { display: block; font-size: 13px; font-weight: 500; color: var(--k-ink2); margin: 0 0 6px; }
.todo { position: relative; display: flex; align-items: center; gap: 10px; padding: 10px 10px 10px 12px; }
.todo__row { display: flex; align-items: center; gap: 4px; white-space: nowrap; overflow: hidden; }
/* 窄屏（320）上「截止」会被挤成竖排两个字：每段文字不许再压缩，放不下时「已超时 x 小时」整段换到下一行 */
.todo__row { flex-wrap: wrap; row-gap: 0; }
.todo__row > text { flex-shrink: 0; }
/* 说明行（如「小满 · 22 岁 · 可停留 30 天」）是员工审核要看的数据，放不下就照常换行，不用省略号吃字 */
.todo__title { font-family: var(--k-sans); font-weight: 600; font-size: 14px; line-height: 1.4; }
.todo__due { font-size: 12px; color: var(--k-alert); font-weight: 600; }
.k-gap3 { gap: 3px; }

/* 日期只是显示、点不了：去掉白底胶囊，不再像按钮 */
.date-box { height: 36px; padding: 0 2px; border: 0; border-radius: 0; background: transparent; display: flex; align-items: center; gap: 6px; font-size: 14px; font-weight: 600; }
.source { height: 22px; padding: 0 8px; border-radius: 4px; background: #F5F1EB; display: flex; align-items: center; font-size: 11px; color: var(--k-ink2); }
.metric { margin-top: 8px; height: 72px; padding: 0 12px; border: 0; border-radius: 12px; background: var(--k-paper); display: flex; align-items: center; gap: 12px; }
.metric__icon { width: 40px; height: 40px; border-radius: 12px; display: flex; align-items: center; justify-content: center; flex: 0 0 auto; }
.metric__body { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
.metric__label { font-size: 12px; color: var(--k-ink2); }
.metric__value { font-size: 22px; font-weight: 700; line-height: 1.15; }
/* 窄屏（320）上「较昨日」会被挤成竖排：数字和「较昨日 +2」各自不折行，放不下时「较昨日」整段换到数字下面 */
.metric__body > .k-row { flex-wrap: wrap; row-gap: 0; }
.metric__value { flex-shrink: 0; white-space: nowrap; font-variant-numeric: tabular-nums; }
.metric__body .k-gap4 { flex-shrink: 0; white-space: nowrap; }
.spark { position: relative; width: 82px; height: 36px; flex: 0 0 auto; }
.spark__seg { position: absolute; height: 1.5px; transform-origin: 0 50%; }
.spark__dot { position: absolute; width: 7px; height: 7px; border-radius: 50%; border: 1.5px solid; }
/* 11-18：六个指标原来各用一种颜色（像调色盘），统一成暖棕；图标底是浅暖色方块。行内 :style 给的颜色要 !important 才盖得住。「较昨日」的涨跌红绿保留 */
.metric__icon { background: linear-gradient(145deg, #FCF4E8, #F4E4CC) !important; }
.spark__seg { background: var(--k-red) !important; }
.spark__dot { border-color: var(--k-red) !important; }
.spark__seg + .spark__dot, .spark__dot:first-child { background: var(--k-red) !important; }
.foot { display: block; text-align: center; margin-top: 14px; }

.task-head { padding: 12px; border: 0; border-radius: 12px; background: var(--k-paper); }
.task-head__icon { width: 40px; height: 40px; border-radius: 12px; background: linear-gradient(145deg, #FCF4E8, #F4E4CC); }
.task-head__title { font-family: var(--k-sans); font-weight: 700; font-size: 16px; line-height: 1.4; }
.overdue-chip { flex-shrink: 0; margin-left: 8px; height: 17px; padding: 0 5px; border: 0; border-radius: 4px; background: var(--k-alert-soft); display: flex; align-items: center; color: var(--k-alert); font-size: 10px; font-weight: 500; }
.blk { position: relative; padding: 12px; }
.blk + .blk::before { content: ""; position: absolute; left: 12px; right: 0; top: 0; height: 1px; background: var(--k-line); transform: scaleY(.5); transform-origin: 0 0; }
.blk__title { display: block; font-family: var(--k-sans); font-weight: 600; font-size: 14px; line-height: 20px; }
.owner__avatar { width: 26px; height: 26px; border-radius: 50%; }
.rel { display: flex; align-items: center; min-height: 28px; font-size: 13px; }
.rel__label { width: 88px; color: var(--k-muted); flex: 0 0 auto; }
.rel__value { min-width: 0; color: var(--k-ink); word-break: break-all; }
.desc { display: block; margin-top: 2px; }
.logs { margin-top: 8px; }
.log { display: flex; align-items: flex-start; min-height: 23px; font-size: 12px; }
.log__rail { width: 8px; margin-right: 12px; display: flex; flex-direction: column; align-items: center; flex: 0 0 auto; align-self: stretch; }
.log__dot { width: 8px; height: 8px; margin-top: 5px; border-radius: 50%; border: 1px solid var(--k-red-line); background: var(--k-paper); flex: 0 0 auto; }
.log__line { width: 1px; flex: 1; background: var(--k-line2); }
.log__time { width: 96px; flex: 0 0 auto; color: var(--k-muted); }
.log__text { flex: 1; min-width: 0; color: var(--k-muted); }
.add-note { color: var(--k-red-deep); font-size: 13px; }
/* 320 宽：「角色：小院主理人 + 商家服务人」原来折成两行、第二行只剩「务人」。头像、间距、「切换门店」各收一点，角色字 11，一行放得下（不截字） */
@media (max-width: 360px) {
  .hello { gap: 8px; padding-left: 4px; }
  .hello__avatar { width: 40px; height: 40px; }
  .hello__role { font-size: 11px; }
  .switch-btn { padding: 0 10px; margin-right: 4px; }
  /* 全部待办的搜索框：占位字「搜索任务、报名编号、订单号」13 个字，320 宽原来最后半个字被截掉。「筛选」和搜索框的内边距各收一点、字回到 13，整句放得下 */
  .search { padding: 0 10px; gap: 6px; }
  .search input { font-size: 13px; }
  .filter-btn { padding: 0 10px; }
}
</style>
