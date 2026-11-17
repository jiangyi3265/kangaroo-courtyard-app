<template>
  <view class="k-page merchant-work">
    <k-topbar title="首页" />
    <view class="k-body k-pad-tab">
      <view class="store" :hover-class="canSwitch ? 'k-press-s' : 'none'" @click="switchStore">
        <view class="store__copy"><text class="eyebrow">合作商家</text><text class="store-name">{{ identity.name }}</text><text v-if="identity.scope" class="identity-scope">{{ identity.scope }}</text></view>
        <k-icon v-if="canSwitch" name="chevron-down" :size="20" />
      </view>

      <!-- 2026-11-03 主人圈掉标题右边那颗反馈小按钮：左边常驻的「客服」按钮已经能找人工 -->
      <button class="review-entry" hover-class="k-press-s" @click="open(R.staffApplications + '?jobType=online&status=submitted')">
        <k-icon name="clipboard-check" :size="26" color="red" />
        <view class="link__copy"><text class="review-entry__title">线上任务报名审核</text><text class="hint">处理本店报名，通过或驳回接单申请</text></view>
        <k-icon name="chevron-right" :size="20" color="red" />
      </button>
      <view class="links fulfillment-links">
        <button v-for="entry in fulfillmentLinks" :key="entry.label" class="link" hover-class="k-press-s" @click="open(entry.route)">
          <k-icon :name="entry.icon" :size="21" color="red" />
          <view class="link__copy"><text>{{ entry.label }}</text><text class="hint">{{ entry.desc }}</text></view>
          <k-icon name="chevron-right" :size="17" color="muted" />
        </button>
      </view>

      <view v-if="recruitmentEnabled" class="heading"><text>发布需求</text></view>
      <view v-if="recruitmentEnabled" class="boards">
        <view v-for="b in boards" :key="b.kind" class="board" hover-class="k-press-s" @click="openBoard(b.kind)">
          <view class="board__icon"><k-icon :name="b.icon" :size="24" color="red" :stroke="1.8" /></view>
          <text class="board__label">{{ b.label }}</text>
          <k-icon name="chevron-right" :size="15" color="muted" />
        </view>
      </view>
      <!-- 代运营、抖音卖房单独两个入口（10-31 主人：从「线上任务」里拿出来），不再三选一 -->
      <view class="applies">
        <view v-for="entry in applyBoards" :key="entry.kind" class="apply" hover-class="k-press-s" @click="openBoard(entry.kind)">
          <view class="board__icon"><k-icon :name="entry.icon" :size="24" color="red" :stroke="1.8" /></view>
          <view class="link__copy"><text class="board__label">{{ entry.label }}</text><text class="hint">{{ entry.desc }}</text></view>
          <k-icon name="chevron-right" :size="15" color="muted" />
        </view>
      </view>
      <!-- 2026-11-03 主人：简化商家端文案，商家看到的一律叫「袋鼠工作人员」 -->
      <text v-if="recruitmentEnabled" class="boards-tip">招募填好提交后，袋鼠工作人员会核实并上架；线上任务也由袋鼠工作人员核实后上架。</text>
      <!-- 活动入口紧跟四个板块：「我发布的」列表可能很长，放在列表下面商家要滑好几屏 -->
      <view class="links">
        <view class="link" hover-class="k-press" @click="open('/pages/governance/mediation')"><k-icon name="scale" :size="21" color="red"/><view class="link__copy"><text>纠纷调解</text><text class="hint">查看本店调解通知，补充材料并查看进度</text></view><k-icon name="chevron-right" :size="15"/></view>
        <view v-for="entry in activityLinks" :key="entry.label" class="link" hover-class="k-press-s" @click="open(entry.route)">
          <k-icon :name="entry.icon" :size="21" color="red" />
          <view class="link__copy"><text>{{ entry.label }}</text><text class="hint">{{ entry.desc }}</text></view>
          <k-icon name="chevron-right" :size="17" color="muted" />
        </view>
      </view>

      <!-- 2026-11-03 主人：统一叫法——商家看到的叫「我的需求」 --><view class="heading"><text>我的需求</text><view class="refresh" hover-class="k-press-s" @click="load"><text>刷新</text></view></view>
      <text v-if="error" class="error" @click="load">{{ error }} · 点击重试</text>
      <view v-if="rows.length" class="requests">
        <view v-for="r in rows" :key="r.requestId" class="request" hover-class="k-press-s" @click="openRequest(r)">
          <view class="request__head"><text class="request__type">{{ r.typeLabel }}</text><text class="request__status" :class="'is-' + toneOf(r.status, r.jobStatus)">{{ staffWording(r.statusLabel) }}</text></view>
          <text class="request__title">{{ r.title }}</text>
          <text v-if="r.returnReason" class="request__reason">退回原因：{{ r.returnReason }}</text>
          <text class="request__time">{{ dayOf(r.createTime) }} 提交</text>
        </view>
        <view v-if="hasMore" class="more" hover-class="k-press-s" @click="loadMore"><text>{{ loadingMore ? '正在读取…' : '查看更多' }}</text></view>
      </view>
      <view v-else-if="loaded && !error" class="empty"><text>暂无需求记录。</text></view>

      <!-- 招募和线上任务的后续（岗位状态、报名、成果验收、登记付款）沿用原来的页面；老的草稿没有需求行，也从这里看 -->
      <view class="links">
        <view class="link" hover-class="k-press" @click="open('/pages/governance/mediation')"><k-icon name="scale" :size="21" color="red"/><view class="link__copy"><text>纠纷调解</text><text class="hint">查看本店调解通知，补充材料并查看进度</text></view><k-icon name="chevron-right" :size="15"/></view>
        <view v-for="entry in otherLinks" :key="entry.label" class="link" hover-class="k-press-s" @click="open(entry.route)">
          <k-icon :name="entry.icon" :size="21" color="red" />
          <view class="link__copy"><text>{{ entry.label }}</text><text class="hint">{{ entry.desc }}</text></view>
          <k-icon name="chevron-right" :size="17" color="muted" />
        </view>
      </view>
    </view>
    <k-tabbar mode="staff" active="work" />
  </view>
</template>
<script setup>
import { recruitmentEnabled } from '@/common/features.js'
// 商家端首页（2026-10-30 主人：四个板块 + 体验反馈小按钮；底栏 首页 / 消息 / 我的）。
// 需求进度读取 /app/staff/merchant/requests；线上报名审核放在身份卡下方，始终带上当前门店。
// 活动（10-30 店员 Luna 的备忘录）：四个板块不动，板块下面紧跟「发布活动」，提交后由本城商家服务人审核；后面跟「我的活动」，提交后看进度、被驳回了去改都从这里进。
// 10-31 主人：「申请代运营」「抖音卖房」（内部编码还是 cloud_chain）单独放两个入口；点「线上任务」直接进发布，不再弹三选一。
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { experience, currentStaffStore, staffStores, staffIdentities, staffIdentityLabel, selectStaffStore, setStaffStore, ensureSession, getSessionRevision, staffStoreUrl } from '@/common/experience.js'
import { get } from '@/common/request.js'
import { pickPaged } from '@/common/ui.js'
import { go, toast } from '@/common/screen.js'
import R from '@/common/routes.js'
import { APPLY_KINDS, REQUEST_API, REQUEST_PAGE, requestTone, staffWording } from '../merchant-request-logic.js'
import { ACTIVITY_CREATE_PAGE } from '../request-view.js'
import { workIdentity } from '../work-identity.js'

const identity = computed(() => workIdentity(experience.account, currentStaffStore.value))

const PAGE_SIZE = 10
const boards = [
  { kind: 'volunteer', label: '招募换工', icon: 'heart-handshake' },
  { kind: 'parttime', label: '招募兼职', icon: 'briefcase' },
  { kind: 'fulltime', label: '招募全职', icon: 'briefcase-business' },
  { kind: 'online', label: '发布任务', icon: 'laptop' }
]
const applyBoards = [
  { kind: 'managed', label: '申请代运营', desc: '想让我们帮你运营店铺，从这里申请', icon: 'store' },
  { kind: 'cloud_chain', label: '抖音卖房', desc: '想在抖音上卖房，从这里申请', icon: 'clapperboard' }
]
const fulfillmentLinks = [
  { label: '在岗与离店登记', desc: '查看本店人员，登记或更正实际离店时间', route: R.staffApplications + '?jobType=volunteer&employment=1', icon: 'clipboard-check' },
  { label: '义工保险', desc: '为本店录用人员申请保险、查看办理进度', route: R.staffInsurance, icon: 'shield-check' }
]
const links = [
  { label: '账单与结算', desc: '房费分账、工资和招聘服务费', route: '/pages/staff/settlements', icon: 'wallet' },
  { label: '房源管理', desc: '发布房源、填写结算价和管理房态', route: R.staffRooms, icon: 'house' },
  { label: '发布活动', desc: '可发布旅游产品，提交后由工作人员审核', route: ACTIVITY_CREATE_PAGE, icon: 'calendar-plus' },
  { label: '我的活动', desc: '看审核进度和报名，被驳回了可修改再提交', route: R.staffActivities, icon: 'calendar-days' },
  { label: '招募岗位', desc: '已发布岗位的状态与名额', route: R.staffJobs, icon: 'briefcase-business' },
  { label: '线上任务与成果', desc: '报名、成果验收与确认完成', route: R.staffOnline + '?s=2', icon: 'laptop' },
  { label: '任务发布费用', desc: '查看发布计费和收款记录', route: '/pages/staff/publication-fees', icon: 'receipt-text' },
  { label: '评价管理', desc: '看换工和接单人的评价、写回复', route: R.staffReviews, icon: 'star' }
]
const activityLinks = links.slice(0, 4), otherLinks = computed(() => links.slice(4).filter(x => recruitmentEnabled.value || x.route !== R.staffJobs))
const rows = ref([]), loaded = ref(false), error = ref(''), hasMore = ref(false), loadingMore = ref(false)
let pageNum = 1, seq = 0
const canSwitch = computed(() => staffIdentities.value.length > 1)
const toneOf = requestTone
const dayOf = (t) => String(t || '').slice(0, 10)
const open = (url) => go(staffStoreUrl(url))
const openRequest = (r) => go(REQUEST_PAGE + '?id=' + r.requestId + '&storeId=' + r.storeId)

function openBoard(kind) {
  if (kind === 'online') return open(R.staffOnline + '?s=1')
  if (APPLY_KINDS[kind]) return open(REQUEST_PAGE + '?type=' + kind)
  open(R.staffJobs + '?s=2&kind=' + kind)
}

async function fetchPage(page) {
  return (await get(REQUEST_API, { storeId: currentStaffStore.value?.storeId, pageNum: page, pageSize: PAGE_SIZE })).data || {}
}
async function load() {
  const id = ++seq
  await ensureSession()
  const store = currentStaffStore.value?.storeId, revision = getSessionRevision()
  if (!store) return
  error.value = ''
  try {
    const d = await fetchPage(1)
    if (id !== seq || store !== currentStaffStore.value?.storeId || revision !== getSessionRevision()) return
    rows.value = d.rows || []
    hasMore.value = d.hasMore === true
    pageNum = 1
    loaded.value = true
  } catch (e) {
    if (id === seq) error.value = e.message || '暂时未能读取进度'
  }
}
async function loadMore() {
  if (loadingMore.value) return
  loadingMore.value = true
  const id = seq
  try {
    const d = await fetchPage(pageNum + 1)
    if (id !== seq) return
    const seen = new Set(rows.value.map(r => r.requestId))
    rows.value = rows.value.concat((d.rows || []).filter(r => !seen.has(r.requestId)))
    hasMore.value = d.hasMore === true
    pageNum += 1
  } catch (e) {
    toast(e.message || '读取失败，请重试')
  } finally {
    loadingMore.value = false
  }
}
async function switchStore() {
  const choices = staffIdentities.value.slice()
  if (choices.length < 2) return
  const i = await pickPaged(choices.map(staffIdentityLabel), '选择工作身份')
  if (i < 0) return
  await selectStaffStore(choices[i])
  uni.reLaunch({ url: R.staff })
}
// 需求进度的消息带着 ?storeId=（一个人有几家店时点开就是那一家）；不是自己的门店就不管
async function applyMessageStore() {
  await ensureSession()
  const pages = typeof getCurrentPages === 'function' ? getCurrentPages() : []
  const wanted = pages[pages.length - 1]?.options?.storeId
  if (wanted && String(wanted) !== String(currentStaffStore.value?.storeId) && staffStores.value.some(g => String(g.storeId) === String(wanted))) setStaffStore(wanted)
}
onMounted(() => applyMessageStore().then(load))
onShow(load)
watch(() => currentStaffStore.value?.storeId, load)
onBeforeUnmount(() => { seq++ })
</script>
<style scoped>
.merchant-work{background:#FCF9F3}
.store{display:flex;justify-content:space-between;align-items:center;padding:18px;border:1px solid #E3D5C3;border-radius:16px;background:#fff;color:#3A322B}
.review-entry{display:flex;align-items:center;gap:12px;width:100%;margin:14px 0 0;padding:16px 13px;min-height:78px;background:var(--k-paper);border:1px solid var(--k-red);border-radius:14px;text-align:left;line-height:1.5;color:var(--k-ink)}
.review-entry::after{border:0}.review-entry__title{font-size:17px;font-weight:600}.review-entry .hint{font-size:12px;line-height:1.5}.review-entry:focus-visible{outline:2px solid var(--k-red);outline-offset:3px}
.store__copy{display:flex;flex-direction:column;gap:7px;min-width:0}
.eyebrow{font-size:12px;color:#8B6849}
.store-name{font-size:21px;font-weight:700;line-height:1.4}
.identity-scope{font-size:12px;line-height:1.5;color:#81766C;overflow-wrap:anywhere}
.heading{display:flex;justify-content:space-between;align-items:center;margin:24px 0 12px;font-size:18px;font-weight:600;color:#3A322B}
.refresh{padding:6px 8px;font-size:13px;font-weight:400;color:#9A6B3F}
.boards{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}
.board{display:flex;align-items:center;gap:8px;min-height:68px;padding:12px 10px;border:1px solid #E9E1D6;border-radius:14px;background:#fff}
.board__icon{flex:0 0 auto;width:40px;height:40px;border-radius:50%;background:#F6EBDD;display:flex;align-items:center;justify-content:center}
.board__label{flex:1;min-width:0;font-size:15px;font-weight:600;color:#3A322B}
/* 320 宽的手机：四个字放不下一行时收一点，不让「招募换工」折成两行 */
@media (max-width:340px){.board{gap:6px;padding:12px 8px}.board__icon{width:34px;height:34px}.board__label{font-size:14px}.board:last-child .board__label{white-space:normal}}
.boards-tip{display:block;margin-top:10px;font-size:12px;line-height:1.6;color:#81766C}
.applies{display:flex;flex-direction:column;gap:10px;margin-top:10px}
.apply{display:flex;align-items:center;gap:10px;min-height:68px;padding:12px;border:1px solid #E9E1D6;border-radius:14px;background:#fff}
.requests{display:flex;flex-direction:column;gap:10px}
.request{display:flex;flex-direction:column;gap:5px;padding:14px;border:1px solid #E9E1D6;border-radius:14px;background:#fff}
.request__head{display:flex;justify-content:space-between;align-items:center;gap:8px}
.request__type{height:22px;padding:0 8px;border-radius:11px;background:#F6EBDD;font-size:12px;line-height:22px;color:#815631}
.request__status{font-size:13px;font-weight:600;color:#8A5E36;text-align:right}
.request__status.is-good{color:var(--k-green)}
.request__status.is-bad{color:#B4472E}
.request__status.is-mute{color:#81766C}
.request__title{font-size:15px;font-weight:600;line-height:1.5;color:#3A322B;overflow:hidden;white-space:nowrap;text-overflow:ellipsis}
.request__reason{font-size:13px;line-height:1.5;color:#8C3B28}
.request__time{font-size:12px;color:#81766C}
.more{padding:8px;text-align:center;font-size:13px;color:#9A6B3F}
.empty{padding:22px 14px;border-radius:14px;background:#fff;border:1px dashed #E3D5C3;font-size:13px;text-align:center;color:#81766C}
.links{margin-top:14px;background:#fff;border-radius:14px;border:1px solid #E9E1D6;overflow:hidden}
.link{display:flex;align-items:center;gap:12px;padding:15px 13px;border-bottom:1px solid #F0EBE4;font-size:15px;color:#3A322B}
.link:last-child{border-bottom:0}
.fulfillment-links .link{width:100%;margin:0;border-radius:0;background:transparent;text-align:left;line-height:1.5}
.fulfillment-links .link::after{border:0}
.fulfillment-links .link:focus-visible{outline:2px solid var(--k-red);outline-offset:-3px}
.link__copy{display:flex;flex-direction:column;gap:4px;flex:1;min-width:0}
.hint{font-size:12px;color:#81766C;font-weight:400}
.error{display:block;margin-bottom:10px;font-size:13px;color:#A63B2B}
</style>
