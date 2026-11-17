<template>
  <view class="k-page service-page">
    <template v-if="s === 1">
      <k-topbar :title="manage ? '线上任务管理' : '商家需求'" back />
      <view class="k-body k-pad-tab">
        <!-- 主人 2026-11-03：「线上任务管理」就是原来说明里的「任务页」入口：他接手的线上任务，点「管理任务」进去接单、验收、付款登记 -->
        <view v-if="manage" class="req-head"><view class="req-head__copy"><text class="req-head__title">{{ list.city.value ? list.city.value + ' · ' : '' }}线上任务管理</text><text class="req-head__sub">你接手的线上任务。上架后点「管理任务」接单、验收、登记付款；点「审核报名」看谁报了名。</text></view></view>
        <!-- 主人 2026-11-03：「每个项目区分开别放到一起」——顶上先分线上任务 / 代运营 / 抖音卖房，每个项目里再分状态；红色数字是待接手 -->
        <template v-else>
          <view class="req-kinds"><view v-for="k in REQUEST_KINDS" :key="k.type" class="req-kind" :class="{ active: kind === k.type }" hover-class="k-press-s" @click="setKind(k.type)"><text>{{ k.label }}</text><text v-if="kindBadge(kindCounts, k.type)" class="req-kind__badge">{{ kindBadge(kindCounts, k.type) }}</text></view></view>
          <view class="req-head"><view class="req-head__copy"><text class="req-head__title">{{ list.city.value ? list.city.value + ' · ' : '' }}{{ kindInfo(kind).name }}</text><text class="req-head__sub">{{ KIND_SUB[kind] }}</text></view></view>
          <view v-if="kind === 'online_task'" class="req-links req-links--top"><view class="req-link" hover-class="k-press-s" @click="openManage"><k-icon name="clipboard-check" :size="21" color="red" /><view class="req-link__copy"><text class="req-link__title">线上任务管理</text><text class="req-link__sub">上架后的接单、验收、付款登记</text></view><k-icon name="chevron-right" :size="15" color="light" /></view></view>
        </template>
        <scroll-view scroll-x class="req-tabs" :show-scrollbar="false"><view class="req-tabs__row"><view v-for="t in tabs" :key="t.label" class="req-tab" :class="{ active: status === t.status }" hover-class="k-press" @click="setStatus(t.status)"><text>{{ t.label }}</text></view></view></scroll-view>
        <view v-if="list.error.value" class="req-state"><text>{{ list.error.value }}</text><k-button label="重新加载" size="md" type="outline" @click="reloadList" /></view>
        <template v-else>
          <k-request-row v-for="r in list.rows.value" :key="r.requestId" :item="r" @open="openDetail(r.requestId)">
            <view v-if="canManageRow(r)" class="req-acts">
              <text v-if="todoText(r)" class="req-acts__todo">{{ todoText(r) }}</text>
              <view class="req-acts__row"><view class="req-acts__btn req-acts__btn--main" hover-class="k-press-s" @click.stop="manageRow(r)"><text>管理任务</text></view><view class="req-acts__btn" hover-class="k-press-s" @click.stop="applicationsRow(r)"><text>审核报名</text></view></view>
            </view>
            <text v-else-if="manage" class="req-acts__tip">{{ r.mine === false ? '由其他商家服务人负责' : '还没上架：点开核对后「审核通过并上架」' }}</text>
          </k-request-row>
          <view v-if="list.hasMore.value" class="req-more" hover-class="k-press" @click="list.more"><text>{{ list.loading.value ? '正在加载…' : '加载更多' }}</text></view>
          <view v-if="!list.rows.value.length" class="req-state"><text>{{ list.loading.value || !list.loaded.value ? '正在读取…' : emptyText }}</text></view>
        </template>
      </view>
      <k-tabbar mode="staff" :active="merchantService ? 'business' : 'work'" />
    </template>

    <template v-else>
      <k-topbar title="需求详情" back custom-back @back="leaveDetail" />
      <view class="k-body" :class="mainAction ? 'req-pad-bar' : 'k-pad-tab'">
        <view v-if="detailError" class="req-state"><text>{{ detailError }}</text><k-button label="重新加载" size="md" type="outline" @click="reloadDetail" /></view>
        <view v-else-if="!detail" class="req-state"><text>正在读取…</text></view>
        <template v-else>
          <k-request-detail :detail="detail" callable />
          <view v-if="hint" class="req-hint"><text>{{ hint }}</text></view>
        </template>
      </view>
      <view v-if="mainAction" class="req-bar">
        <view v-if="actions.includes('manage')" class="req-bar__btn"><k-button block size="md" type="secondary" label="管理任务" @click="manageTask" /></view>
        <view v-if="actions.includes('manage')" class="req-bar__btn"><k-button block size="md" type="secondary" label="审核报名" @click="openApplications" /></view>
        <view v-if="detail && detail.canReturn" class="req-bar__btn"><k-button block size="md" type="secondary" label="退回商家" @click="returnToMerchant" /></view>
        <!-- 2026-11-03 主人：简化——待接手的线上任务多一个「接手并上架」一键（原来：接手 → 确认 → 回来再点上架 → 确认，4 步；现在 1 点 1 确认）；想先沟通的照旧单独「接手」 -->
        <view v-if="canAcceptPublish" class="req-bar__btn"><k-button block size="md" type="secondary" :label="working ? '处理中…' : '接手'" @click="runMain" /></view>
        <view v-if="canAcceptPublish" class="req-bar__btn req-bar__btn--wide"><k-button block size="md" :label="working ? '处理中…' : '接手并上架'" @click="runAcceptPublish" /></view>
        <view v-else-if="mainAction !== 'manage'" class="req-bar__btn"><k-button block :size="actions.includes('manage') || (detail && detail.canReturn) ? 'md' : 'lg'" :label="working ? '处理中…' : ACTION_LABEL[mainAction]" @click="runMain" /></view>
      </view>
      <k-tabbar v-else mode="staff" :active="merchantService ? 'business' : 'work'" />
    </template>
  </view>
</template>

<script setup>
// 商家服务人（merchant_service）的商家需求页：列表（按当前门店的城市，服务端强校验）、详情（接手 → 审核通过并上架线上任务 → 标记完成；岗位没上架前可以退回商家）。
// 接手后只有接手的人能继续；线上任务上架后的接单、验收、付款登记走现有的线上任务页（服务端转发时已补这家店的授权）。
// 主人 2026-11-03：列表先按项目分（?type=online_task / managed / cloud_chain，没带就落到第一个有待接手的）；?manage=1 是「线上任务管理」：
// 他接手的线上任务，每行直接有「管理任务」「审核报名」，不用再点进详情找（之前工作台说明里写「在任务页里做」，主人找不到任务页）。
import { ref, computed, watch } from 'vue'
import { onShow, onUnload, onReachBottom, onPullDownRefresh } from '@dcloudio/uni-app'
import { get, post } from '@/common/request.js'
import { useScreen, go, back, toast } from '@/common/screen.js'
import { ensureSession, hasStaffAccess, currentStaffStore, currentStaffStoreId, staffStores, merchantService, refreshAccount, selectStaffStore } from '@/common/experience.js'
import { errText, confirm, prompt } from '@/common/ui.js'
import R from '@/common/routes.js'
import { useRequestList } from './request-list.js'
import { SERVICE_API, SERVICE_PAGE, SERVICE_TABS, MANAGE_TABS, REQUEST_KINDS, ONLINE_DAILY_API, tabOf, kindInfo, pickKind, kindBadge, canManageRow, taskTodos, serviceActions, serviceHint, acceptPublishable } from './request-view.js'
import KRequestRow from './components/k-request-row.vue'
import KRequestDetail from './components/k-request-detail.vue'

// 线上任务的「审核通过」就是上架：没有单独的审核一步（10-30 店员 Luna 的备忘录：商家服务人有审核通过权限）
const ACTION_LABEL = { accept: '接手', publish: '审核通过并上架', done: '标记完成' }
const CONFIRM = {
  accept: ['接手这条需求', '接手后由你负责，商家会收到通知。'],
  publish: ['审核通过并上架', '通过后任务就上架了，用户能看到并接单。确认通过？'],
  done: ['标记完成', '确认这条需求已经办完？商家会收到通知。'],
  // 2026-11-03 主人：简化——一键接手并上架
  acceptPublish: ['接手并上架', '接手后立刻审核通过并上架，用户能看到并接单；商家会收到通知。确认？']
}
const KIND_SUB = {
  online_task: '换工主理人核实后转来的线上任务：接手，核对后审核通过并上架。',
  managed: '换工主理人核实后转来的代运营需求：接手后和商家沟通办理，办完标记完成。',
  cloud_chain: '换工主理人核实后转来的抖音卖房需求：接手后和商家沟通办理，办完标记完成。'
}
const manage = ref(false)
const kind = ref(REQUEST_KINDS[0].type)
const status = ref(SERVICE_TABS[0].status)
const tabs = computed(() => (manage.value ? MANAGE_TABS : SERVICE_TABS))
const emptyText = computed(() => (manage.value
  ? (status.value === 'done' ? '还没有已完成的线上任务' : '还没有你接手的线上任务')
  : '「' + kindInfo(kind.value).name + '」这一栏还没有需求'))
const storeParams = () => ({ storeId: currentStaffStoreId() })
const list = useRequestList(async (pageNum) => (await get(SERVICE_API, { ...storeParams(), type: manage.value ? 'online_task' : kind.value, status: status.value, pageNum, pageSize: 20 })).data)

// 项目页签上的待接手数（三类各取一次总数）；读不到就不显示数字
const kindCounts = ref({})
let countSeq = 0
async function loadKindCounts() {
  const id = ++countSeq
  try {
    const res = await Promise.all(REQUEST_KINDS.map(k => get(SERVICE_API, { ...storeParams(), type: k.type, status: 'forwarded', pageSize: 1 })))
    if (id !== countSeq) return
    const c = {}
    REQUEST_KINDS.forEach((k, i) => { c[k.type] = Number(res[i].data?.total) || 0 })
    kindCounts.value = c
  } catch (e) {
    if (id === countSeq) kindCounts.value = {}
  }
}
// 线上任务管理：每个任务待审核的报名、待验收的成果（线上任务概况按任务给的数）；读不到就不写
const todos = ref({})
let todoSeq = 0
async function loadTodos() {
  const id = ++todoSeq
  try {
    const tasks = (await get(ONLINE_DAILY_API, storeParams())).data?.tasks || []
    if (id === todoSeq) todos.value = taskTodos(tasks, tasks.map(t => t.jobId)).byJob
  } catch (e) {
    if (id === todoSeq) todos.value = {}
  }
}
const todoText = (r) => {
  const t = todos.value[r.jobId]
  return t ? [t.toReview ? t.toReview + ' 份报名待审核' : '', t.toAccept ? t.toAccept + ' 份成果待验收' : ''].filter(Boolean).join(' · ') : ''
}
function reloadList() {
  if (manage.value) loadTodos()
  else loadKindCounts()
  return list.reload()
}
const setStatus = (v) => { if (status.value !== v) { status.value = v; list.reload() } }
// 换项目：状态回到待接手（新项目最要紧的是有没有人等着接）
const setKind = (v) => { if (kind.value !== v) { kind.value = v; status.value = SERVICE_TABS[0].status; list.reload() } }
const openManage = () => go(SERVICE_PAGE + '?manage=1')

let booted = false, shown = false, landedOnDetail = false
const s = useScreen(2, { onLoad: boot })
async function boot(q) {
  manage.value = String(q.manage) === '1'
  status.value = tabOf(tabs.value, q.status)
  const named = REQUEST_KINDS.some(k => k.type === q.type)
  try {
    await ensureSession()
    if (!hasStaffAccess.value) return
    // 消息里的门店是申请所属商家；服务人继续使用城市身份，详情由服务端核对管辖范围。
    if (!merchantService.value && q.storeId && String(q.storeId) !== String(currentStaffStoreId())) await selectStaffStore(q.storeId)
  } catch (e) {
    toast(errText(e, '切换门店失败'))
  }
  booted = true
  if (Number(q.requestId)) {
    landedOnDetail = true
    await openDetail(q.requestId)
    // 消息点进来的：回到列表时落在这条需求的项目上
    if (!manage.value) kind.value = pickKind(named ? q.type : detail.value && detail.value.requestType, {})
    return
  }
  if (manage.value) return reloadList()
  // 没指定项目（老消息、老入口）：先看哪个项目有待接手的，落到那一栏
  if (!named) await loadKindCounts()
  kind.value = pickKind(q.type, kindCounts.value)
  if (named) loadKindCounts()
  list.reload()
}
onShow(() => {
  if (shown && booted) { if (s.value === 1) reloadList(); else if (openId) reloadDetail() }
  shown = true
})
onUnload(() => { list.cancel(); detailSeq++ })
onReachBottom(() => { if (s.value === 1) list.more() })
onPullDownRefresh(async () => {
  if (s.value === 1) await reloadList()
  else await reloadDetail()
  uni.stopPullDownRefresh()
})
watch(s, (v, old) => { if (v === 1 && old !== 1 && booted) reloadList() })

const detail = ref(null), detailError = ref(''), working = ref(false)
const actions = computed(() => serviceActions(detail.value))
const hint = computed(() => serviceHint(detail.value))
// 底部栏：接手 / 上架 / 标记完成是主按钮；任务页入口排在它前面
const mainAction = computed(() => actions.value.find(a => a !== 'manage') || (actions.value.includes('manage') ? 'manage' : ''))
// 2026-11-03 主人：简化——待接手的线上任务（岗位还是草稿）多一个「接手并上架」，代运营、抖音卖房没有
const canAcceptPublish = computed(() => mainAction.value === 'accept' && acceptPublishable(detail.value))
let detailSeq = 0, openId = null
async function reloadDetail() {
  const id = ++detailSeq
  detailError.value = ''
  try {
    const d = (await get(SERVICE_API + '/' + openId, storeParams())).data || {}
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
async function runMain() {
  const action = mainAction.value
  if (working.value || !ACTION_LABEL[action]) return
  if (!(await confirm(CONFIRM[action][0], CONFIRM[action][1]))) return
  if (working.value) return
  working.value = true
  try {
    const res = await post(SERVICE_API + '/' + openId + '/' + action + '?storeId=' + currentStaffStoreId())
    toast(res.msg || '已处理')
  } catch (e) {
    toast(errText(e, '操作失败'))
  } finally {
    working.value = false
  }
  // 成功换成下一步的按钮；失败多半是状态变了（别人先接手、已上架），也要拿最新的
  await reloadDetail()
}
// 2026-11-03 主人：简化——「接手并上架」一键：前端连调两次现有接口（先接手，成功了再审核通过并上架），不改服务端。
// 第二步失败时需求已经是接手中，提示再点一次上架；刷新详情后底栏就是「审核通过并上架」
async function runAcceptPublish() {
  if (working.value || !canAcceptPublish.value) return
  if (!(await confirm(CONFIRM.acceptPublish[0], CONFIRM.acceptPublish[1]))) return
  if (working.value) return
  working.value = true
  try {
    await post(SERVICE_API + '/' + openId + '/accept?storeId=' + currentStaffStoreId())
    try {
      const res = await post(SERVICE_API + '/' + openId + '/publish?storeId=' + currentStaffStoreId())
      toast(res.msg || '已接手并上架')
    } catch (e) {
      toast('已接手，上架没成功，请再点一次上架')
    }
  } catch (e) {
    toast(errText(e, '接手失败'))
  } finally {
    working.value = false
  }
  await reloadDetail()
}
// 退回商家：原因必填，商家改完再提交。退回后这条对商家服务人就看不到了（详情 403），所以成功后回列表，不再取详情
async function returnToMerchant() {
  if (working.value) return
  const reason = await prompt('退回商家', { placeholder: '写清楚要改什么，商家会看到（必填）' })
  if (reason === null || working.value) return
  if (!reason) return toast('退回要写原因，商家才知道改什么')
  if (reason.length > 500) return toast('原因最多 500 字，现在 ' + reason.length + ' 字')
  working.value = true
  let returned = false
  try {
    const res = await post(SERVICE_API + '/' + openId + '/return?storeId=' + currentStaffStoreId(), { reason })
    toast(res.msg || '已退回商家')
    returned = true
  } catch (e) {
    toast(errText(e, '退回失败'))
  } finally {
    working.value = false
  }
  if (returned) leaveDetail()
  // 失败多半是状态变了（已上架、别人接手了），拿最新的，退回按钮该没就没
  else await reloadDetail()
}
// 具体任务携带所属商家，城市服务身份保持不变；刚接手补出的授权刷新后才能展示报名操作。
// 兼任的小院主理人也保留原工作身份，最终权限由服务端按记录所属商家校验。
async function enterTaskStore(storeId) {
  if (merchantService.value) {
    const city = currentStaffStore.value?.city
    await refreshAccount()
    if (!merchantService.value || currentStaffStore.value?.city !== city) throw new Error('当前商家服务身份已变化，请返回我的业务重新打开')
    const grant = staffStores.value.find(g => String(g.storeId) === String(storeId) && g.roleCode === 'merchant_service' && String(g.city || '').trim() === String(city || '').trim())
    if (!grant) throw new Error('这家店的授权已失效，请联系平台')
    return
  }
  if (currentStaffStore.value?.roleCode === 'keeper' && currentStaffStore.value?.alsoService !== true) await refreshAccount()
  if (currentStaffStore.value?.alsoService !== true) return selectStaffStore(storeId)
  const known = () => staffStores.value.some(g => String(g.storeId) === String(storeId))
  if (!known()) await refreshAccount()
  if (!known()) throw new Error('这家店的授权已失效，请联系平台')
}
// 任务页（pages/staff/online-jobs）：接单、验收、付款登记都在这里
async function openTask(storeId, jobId) {
  try {
    await enterTaskStore(storeId)
    go(R.staffOnline + '?jobId=' + jobId + '&storeId=' + storeId)
  } catch (e) {
    toast(errText(e, '这家店的授权已失效，请联系平台'))
  }
}
async function openApps(storeId) {
  try {
    await enterTaskStore(storeId)
    go(R.staffApplications + '?jobType=online&storeId=' + storeId)
  } catch (e) {
    toast(errText(e, '这家店的授权已失效，请联系平台'))
  }
}
const manageTask = () => openTask(detail.value.storeId, detail.value.jobId)
const openApplications = () => openApps(detail.value.storeId)
// 列表上直接点（主人 2026-11-03：不用再点进详情找按钮）
const manageRow = (r) => openTask(r.storeId, r.jobId)
const applicationsRow = (r) => openApps(r.storeId)
</script>

<style scoped lang="scss">
@import './request-pages.scss';
/* 2026-11-03 主人：简化——「接手并上架」是主按钮，比旁边的「接手」宽一些 */
.req-bar__btn--wide{flex:1.6}
</style>
