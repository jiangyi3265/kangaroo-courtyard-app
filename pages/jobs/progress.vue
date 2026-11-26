<template>
  <view class="k-page progress" :class="[$userSurface, { 'progress--nobar': s === 3 }]">
    <k-topbar title="审核进度" back custom-back @back="onBack" />
      <departure-notice v-if="detail?.jobType === 'volunteer'" ref="departureNotice" :app-id="appId" />
    <k-order-mediation order-type="application" :order-id="appId" :volunteer-dispute="detail?.jobType === 'volunteer'" />
    <!-- 到店岗位：和报名页同一条 7 步进度（2026-10-18，见 ./apply-flow.js），按报名真实状态点亮，下面一句话说现在在等什么；线上任务照旧是交付六步 -->
    <view v-if="(detail || designMode) && !isOnline" class="steps steps--flow"><job-flow-steps :current="current" :arrival-enabled="canOpenArrival" @arrival="openArrival" :end-enabled="detail?.status === 'onboarded' || detail?.status === 'completed'" @end="go(R.jobInterview + '?appId=' + appId)" /><text v-if="flowTip" class="steps__tip">{{ flowTip }}</text></view>
    <view v-else-if="detail || designMode" class="steps"><k-steps :steps="stepNames" :current="current" /></view>

    <!-- 2026-11-03 主人圈掉到店岗位顶上这颗「联系主理人」：下面安全卡已有「联系 TA」，只给线上任务留着 -->
    <view v-if="detail && isOnline" class="contact-entry"><k-button type="outline" block icon="message-circle" @click="contactOwner">{{ contactLabel }}</k-button></view>
    <!-- 安全负责人、分享给亲友（2026-10-31 主人）：报名成功页离开后在这里还能找到；线上任务不出，已结束的报名组件自己不显示 -->
    <view v-if="detail && !isOnline" class="safety-entry"><safety-share compact :app-id="appId" :status="detail.status" @ready="onTrip" /></view>
    <!-- 1 报名已提交 -->
    <view v-if="s === 1" class="k-body k-pad-bottom">
      <k-card :pad="16">
        <view class="hero">
          <view class="hero__art"><k-icon name="clipboard-list" :size="32" color="red" /></view>
          <text class="hero__title">{{ heroTitle }}</text>
          <text class="hero__desc k-pre">{{ heroDesc }}</text>
          <k-button v-if="loadState === 'failed'" type="secondary" size="sm" @click="loadDetail()">重新读取进度</k-button>
        </view>
        <view class="k-divider k-mt16" />
        <view class="row"><view class="row__label"><k-icon name="file-clock" :size="16" color="muted" /><text>提交时间</text></view><text class="row__value">{{ submitTimeText }}</text></view>
        <view v-if="reviewEtaText" class="row"><view class="row__label"><k-icon name="clock" :size="16" color="muted" /><text>预计审核时长</text></view><text class="row__value">{{ reviewEtaText }}</text></view>
        <view class="row"><view class="row__label"><k-icon name="file-text" :size="16" color="muted" /><text>当前状态</text></view><view class="status"><text>{{ statusText }}</text></view></view>
        <view v-if="urgentInfo && (urgentInfo.urgent || urgentInfo.canUrgent)" class="row"><view class="row__label"><k-icon name="zap" :size="16" color="muted" /><text>加急投递</text></view><k-chip v-if="urgentInfo.urgent" tone="red" icon="zap">已加急</k-chip><k-button v-else type="secondary" size="xs" :label="urgentBusy ? '正在加急…' : urgentInfo.label" :disabled="urgentBusy" @click="onUrgent" /></view>
        <view class="tip k-mt8"><text class="tip__title">温馨提示</text><text class="tip__text k-pre">{{ tipText }}</text></view>
      </k-card>
      <!-- 撤回报名是危险操作：提醒红描边，不用实心主色（主人定：删除 / 危险操作保持红色）；主色实心给左边的「查看岗位 / 重新报名 / 签约到店」 -->
      <k-bottom flat pad="12px 16px"><view class="k-flex1"><k-button block :disabled="blank" @click="onLeftAction">{{ leftActionText }}</k-button></view><view class="k-flex1 danger"><k-button type="outline" block :disabled="blank || !canWithdraw" @click="withdraw">撤回报名</k-button></view></k-bottom>
    </view>

    <!-- 2 审核通过 -->
    <view v-else-if="s === 2" class="k-body k-pad-bottom">
      <view class="hero hero--plain hero--joined">
        <view class="hero__art hero__art--ok"><k-icon name="clipboard-check" :size="32" color="green" /></view>
        <text class="hero__title">{{ passTitle }}</text>
        <text class="hero__desc">{{ passDesc }}</text>
      </view>
      <view class="tips k-mt16">
        <view v-for="t in passTips" :key="t.text" class="tips__row"><view class="k-circle k-circle--outline tips__icon"><k-icon :name="t.icon" :size="16" color="muted" /></view><text class="tips__text k-pre">{{ t.text }}</text></view>
      </view>
      <!-- 审核通过、还没约面试时也能撤回（后端允许 review_passed 撤回）：之前这一屏只有约面试一个按钮，不想去了只能找门店终止 -->
      <k-bottom flat pad="12px 16px"><view v-if="!isOnline" class="withdraw danger"><k-button type="outline" block :disabled="blank || !canWithdraw" @click="withdraw">撤回报名</k-button></view><view class="k-flex1"><k-button block :disabled="blank" @click="onPassAction">{{ passActionText }}</k-button></view></k-bottom>
    </view>

    <!-- 3 审核未通过 -->
    <view v-else-if="s === 3" class="k-body k-pad-safe">
      <view class="hero hero--plain">
        <view class="hero__art"><k-icon name="file-x" :size="32" color="red" /></view>
        <text class="hero__title">审核未通过</text>
        <text class="hero__desc">很抱歉，本次报名未通过主理人审核。</text>
      </view>
      <k-card class="k-mt12 reason" :pad="14">
        <text class="reason__label">未通过原因</text>
        <text class="reason__title">{{ rejectTitle }}</text>
        <text class="reason__text">{{ rejectText }}</text>
      </k-card>
      <text class="k-title k-mt16 block">你可以</text>
      <view class="k-col k-gap8 k-mt8">
        <view v-for="a in actions" :key="a.text" class="action" hover-class="k-press" @click="a.fn"><k-icon :name="a.icon" :size="18" color="ink2" /><text>{{ a.text }}</text><k-icon name="chevron-right" :size="12" color="muted" /></view>
      </view>
      <text class="cheer">别灰心，合适的相遇需要一点时间，期待你下次的加入～</text>
      <view class="k-home-indicator" />
    </view>

    <!-- 4 选择面试时间 -->
    <view v-else-if="!isOnline && (detail || designMode)" class="k-body k-pad-bottom">
      <k-interview-slots v-if="detail?.jobType === 'volunteer' && appId" :key="appId" :app-id="appId" offer-role="candidate" :refresh-key="offerRefresh" @count="offerCount = $event" @stage-changed="loadDetail()" />
      <template v-if="detail?.jobType !== 'volunteer' || offerCount === 0">
      <text class="pick__title">{{ detail?.jobType === 'volunteer' ? '门店已开放的时段' : '请选择视频面试时间' }}</text>
      <text class="pick__sub">{{ slotsHint }}</text>
      <k-button v-if="slotsState !== 'loading'" type="outline" size="sm" @click="loadSlots">刷新时段</k-button>
      <view class="k-col k-gap12 k-mt12 opt-list">
        <view v-for="(o, i) in options" :key="o.slotId || i" class="opt" :class="{ on: picked === i }" @click="picked = i">
          <k-icon name="circle" :art="picked === i ? 'radio-on' : 'circle'" :size="18" />
          <view class="k-flex1">
            <view class="k-row-start k-gap12">
              <k-icon name="calendar-days" :size="18" color="muted" />
              <view class="k-col k-gap2"><text class="opt__date">{{ o.date }}</text><text class="opt__date">{{ o.time }}<text class="opt__tz">（北京时间）</text></text></view>
            </view>
            <view class="k-row k-gap24 opt__meta"><view class="k-row k-gap4"><k-icon name="clock" :size="12" color="muted" /><text>{{ o.dur ? '时长约 ' + o.dur : '时长以门店安排为准' }}</text></view><view class="k-row k-gap4"><k-icon name="video" :size="12" color="muted" /><text>腾讯会议{{ o.capacity > 1 ? ' · 最多 ' + o.capacity + ' 人' : '' }}</text></view></view>
          </view>
        </view>
      </view>
      <view class="tip tip--card k-mt16"><text class="tip__title">温馨提示</text><text class="tip__text">有可选时段时请选择并确认；暂无时段请联系当地主理人安排，稍后刷新。</text></view>
      <k-bottom flat pad="12px 16px"><view class="contact"><k-button block type="outline" icon="message-circle" label="联系当地主理人" @click="contactOwner" /></view><view class="k-flex1"><k-button block :disabled="!canBook || booking" :label="booking ? '提交中…' : '确认面试时间'" @click="confirmTime" /></view></k-bottom>
      </template>
      <view v-if="detail?.jobType === 'volunteer' && offerCount > 0" class="tip tip--card"><text class="tip__title">等商家确认时间</text><text class="tip__text">确认后你会收到面试通知，可从消息进入腾讯会议。</text></view>
    </view>
    <k-subscribe scenes="apply_progress" label="订阅报名与面试提醒" />
  </view>
</template>

<script setup>
import DepartureNotice from './components/departure-notice.vue'
const departureNotice = ref(null)
import { ref, computed } from 'vue'
import { onShareAppMessage, onShow, onHide, onUnload } from '@dcloudio/uni-app'
import { getMessageScopeKey } from '@/common/experience.js'
import { useScreen, go, replace, back, toast } from '@/common/screen.js'
import { apiApplicationDetail, apiBookInterview, apiInterviewSlots, apiWithdrawApplication, apiUrgentInfo, apiUrgentApply } from '@/common/api.js'
import { modal } from '@/common/ui.js'
import R from '@/common/routes.js'
import { watch } from 'vue'
import { apiMyOnline } from '@/common/api.js'
import JobFlowSteps from './components/job-flow-steps.vue'
import SafetyShare from './components/safety-share.vue'
import { FLOW_STEPS, flowStepOf, flowHint } from './apply-flow.js'
import { jobShareFallback, tripShareMessage } from './trip-share.js'

// 线上任务之前只有「提交申请 → 发布方审核」两步，接单之后看不出进度；现在与交付页同一套六步（简版），见下方 onlineFlow
// 到店岗位 2026-10-18 起是 7 步（提交资料 → 确认信息 → 约定视频时间 → 签署安全协议 → 订票确认 → 进入地区群 → 到店确认），和报名页同一套
const stepNames = computed(() => isOnline.value ? ((onlineFlow.value && onlineFlow.value.steps) ? onlineFlow.value.steps.map(x => x.label) : ONLINE_STEPS) : FLOW_STEPS)
const INTERVIEW_TIPS = [
  { icon: 'alarm-clock', text: '请先选择可预约的面试时段，\n暂无时段时联系当地主理人安排。' },
  // 面试走腾讯会议、时长由门店按时段设（最长 4 小时）：之前这里写「微信视频、预计 20 分钟」，和候场页、实际时段都对不上
  { icon: 'timer', text: '面试通过腾讯会议进行，\n会议号预约后在候场页查看。' },
  { icon: 'calendar-check', text: '如需调整，可联系当地主理人协商新的时间。' }
]
// 线上任务没有面试，第 2 屏的三条提示换成交付与结算的说明（口径同交付页 deliver.vue 顶部注释）
const ONLINE_TIPS = [
  { icon: 'file-text', text: '请按任务说明完成交付物，\n在截止时间前提交成果。' },
  { icon: 'timer', text: '验收通过后生成结算单，\n发布方按约定方式付款，无需到店。' },
  { icon: 'message-circle', text: '对任务要求有疑问，可联系当地主理人沟通。' }
]

// ---------------------------------------------------------------------------
// 真实数据接入。
//
// "没有真实报名"有两种，必须分开，不能共用 detail === null 这一个信号：
//   · 设计走查 —— 显式带 ?s=1..4 且没有 appId。INTEGRATION.md 承诺四屏可直达，
//     这条路径上不发任何请求，直接摆出下面的 DESIGN 设计稿内容。
//   · 取数失败 —— 带了 appId 但请求失败、未登录，或压根没带 appId 进来。
//     这条路径绝不能落到 DESIGN：否则用户会看到一份并不存在的"正在审核的报名"，
//     还能对着它点撤回、约面试。此时只陈述状态，操作按钮一律禁用。
// ---------------------------------------------------------------------------
const DESIGN = {
  submitTime: '2025年9月5日 09:41',
  status: '等待商家审核',
  rejectTitle: '到岗日期不匹配',
  rejectText: '主理人希望你能更早到岗，与你当前可到岗时间不一致。',
  options: [
    { date: '2025年9月6日（周六）', time: '10:00 - 10:20', dur: '20 分钟' },
    { date: '2025年9月6日（周六）', time: '14:00 - 14:20', dur: '20 分钟' },
    { date: '2025年9月7日（周日）', time: '19:00 - 19:20', dur: '20 分钟' }
  ]
}
/**
 * 报名状态 → 本页屏号。有真实报名时每个状态都必须落到确定的一屏，不能留着 URL 里的 ?s=：
 * 旧的"审核通过"消息带着 ?s=2，报名早已约上面试 / 撤回 / 终止，点进来仍是"请选择视频面试时间"，
 * 再约一次只会撞唯一键或被状态机拒绝（2026-10-02 复核发现）。
 *   · 已撤回 / 已终止是终态，落第 1 屏：它只陈述服务端的 statusLabel，左键是「重新报名」，没有任何约面试入口
 *   · 不认识的新状态同样落第 1 屏，宁可只陈述状态，也不给一个可能注定失败的操作
 *   · 已约面试及之后的状态不归本页，见下面的 INTERVIEW_PAGE
 */
const SCREEN_BY_STATUS = { submitted: 1, review_passed: 2, review_rejected: 3, withdrawn: 1, terminated: 1 }
// 已约面试及之后的进度归面试页（它有自己的 SCREEN_BY_STATUS：候场 / 面试后反馈 / 双向确认 / 责任书）。
// 与后端 KgUserHubService.INTERVIEW_PAGE_STATUSES 同一口径，「我的订单」的「查看进度」也按它分流
const INTERVIEW_PAGE = ['interview_booked', 'interview_done', 'user_confirmed', 'store_confirmed', 'contract_signed', 'onboarded']
// 线上任务（详情里的 jobType = online）没有视频面试：审核通过即接单，之后一直在交付页提交成果、确认结算。
// 接单后的这些状态都算"进行中"，与后端 KgOnlineTaskService.WORKING 同一口径
const ONLINE_WORKING = ['review_passed', 'interview_booked', 'interview_done', 'store_confirmed', 'user_confirmed', 'contract_signed', 'onboarded']
const screenOf = (d) => {
  if (d.jobType === 'online' && ONLINE_WORKING.indexOf(d.status) >= 0) return 2
  return SCREEN_BY_STATUS[d.status] || 1
}

const appId = ref(null)
const detail = ref(null)
// 分享给亲友：读到行程发行程卡片，没读到（线上任务、已结束）右上角转发发岗位详情
const trip = ref(null)
const onTrip = (value) => { trip.value = value }
onShareAppMessage(() => tripShareMessage(trip.value, jobShareFallback(detail.value?.jobId, detail.value?.jobTitle)))
const offerCount = ref(null)
const slots = ref(null) // null 表示还没拉到真实时段
const picked = ref(-1)
const explicitScreen = ref(false)
// idle 没有 appId 不取数 / loading 取数中 / ready 拿到真实报名 / failed 请求失败或未登录
const loadState = ref('idle')
const loadError = ref('')
const loadErrorCode = ref(0)
const slotsState = ref('idle')
const slotsError = ref('')
let visible = false, pageEpoch = 0, detailRequest = 0, slotsRequest = 0
let loadedScope = null
const pageContext = () => ({ epoch: pageEpoch, id: appId.value, scope: getMessageScopeKey() })
const isCurrent = ctx => visible && ctx.epoch === pageEpoch && ctx.id === appId.value && ctx.scope === getMessageScopeKey()
const readyForAction = () => visible && loadState.value === 'ready' && loadedScope === getMessageScopeKey()

// 设计走查路径：只有它能用 DESIGN
const designMode = computed(() => explicitScreen.value && !appId.value)
// 既没有真实报名、也不是设计走查。页面只能陈述"为什么没有内容"，不能给可点的业务操作
const blank = computed(() => !detail.value && !designMode.value)

const WEEK = ['日', '一', '二', '三', '四', '五', '六']
// 后端统一输出 'yyyy-MM-dd HH:mm:ss'。这里手工切分而不是交给 new Date() 解析：
// iOS 与部分小程序 WebView 不接受带空格的日期串，会得到 Invalid Date。
const parseTime = (v) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})/.exec(String(v || ''))
  return m ? { y: +m[1], mo: +m[2], d: +m[3], hh: m[4], mm: m[5] } : null
}
const formatDateTime = (v) => {
  const t = parseTime(v)
  return t ? `${t.y}年${t.mo}月${t.d}日 ${t.hh}:${t.mm}` : ''
}
const formatSlotDate = (v) => {
  const t = parseTime(v)
  return t ? `${t.y}年${t.mo}月${t.d}日（周${WEEK[new Date(t.y, t.mo - 1, t.d).getDay()]}）` : ''
}
const formatSlotTime = (start, end) => {
  const a = parseTime(start)
  const b = parseTime(end)
  if (!a) return ''
  if (!b) return `${a.hh}:${a.mm}`
  const endDate = a.y === b.y && a.mo === b.mo && a.d === b.d ? '' : `${b.mo}月${b.d}日 `
  return `${a.hh}:${a.mm} - ${endDate}${b.hh}:${b.mm}`
}
// 时段时长按起止时间算（门店自己设，最长 4 小时）：30 分钟 / 1 小时 / 1 小时 30 分钟；算不出就不写
const formatSlotDuration = (start, end) => {
  const a = parseTime(start)
  const b = parseTime(end)
  if (!a || !b) return ''
  const min = Math.round((Date.UTC(b.y, b.mo - 1, b.d, +b.hh, +b.mm) - Date.UTC(a.y, a.mo - 1, a.d, +a.hh, +a.mm)) / 60000)
  if (!(min > 0)) return ''
  const h = Math.floor(min / 60)
  return h ? h + ' 小时' + (min % 60 ? ' ' + (min % 60) + ' 分钟' : '') : min + ' 分钟'
}

const loadSlots = async () => {
  if (!readyForAction() || !appId.value || !detail.value || isOnline.value || detail.value.status !== 'review_passed') return
  const ctx = pageContext(), request = ++slotsRequest
  const current = () => isCurrent(ctx) && request === slotsRequest && s.value === 4
  slots.value = []
  picked.value = -1
  slotsState.value = 'loading'
  slotsError.value = ''
  try {
    const res = await apiInterviewSlots(appId.value)
    if (!current()) return
    slots.value = (res?.data || []).map(o => ({
      slotId: o.slotId,
      capacity: o.capacity || 1,
      date: formatSlotDate(o.startTime),
      time: formatSlotTime(o.startTime, o.endTime),
      dur: formatSlotDuration(o.startTime, o.endTime)
    }))
    picked.value = -1
    slotsState.value = 'ready'
  } catch (e) {
    if (!current()) return
    // 拉不到就是空列表，不能退回 DESIGN 的示例时段让用户对着假时段点确认
    slots.value = []
    picked.value = -1
    slotsState.value = 'failed'
    slotsError.value = e?.message || '面试时段加载失败'
    toast(slotsError.value)
  }
}
const loadDetail = async () => {
  if (!visible || !appId.value) return
  const ctx = pageContext(), request = ++detailRequest
  const current = () => isCurrent(ctx) && request === detailRequest
  slotsRequest++
  loadState.value = 'loading'
  try {
    const res = await apiApplicationDetail(appId.value)
    if (!current()) return
    detail.value = res?.data || null
    loadedScope = detail.value ? ctx.scope : null
    loadState.value = detail.value ? 'ready' : 'failed'
    loadError.value = detail.value ? '' : '没有找到这条报名记录'
    loadErrorCode.value = 0
    // 查无此报名与请求失败同样处理：只有第 1 屏的文案能如实陈述"没有内容"
    if (!detail.value) { s.value = 1; return }
    // 已约面试及之后的到店岗位：转到面试页。用 redirectTo 替换本页而不是再压一层，
    // 否则返回键会退回本页、再被转走一次；线上任务不会走到这里（它没有面试页可去）
    if (detail.value.jobType !== 'online' && INTERVIEW_PAGE.indexOf(detail.value.status) >= 0) {
      replace(`${R.jobInterview}?appId=${appId.value}`)
      return
    }
    // 有真实报名时屏号只认真实 status：?s= 在这条路径上是设计走查残留，
    // 拿它盖掉真实状态会让 submitted 的报名显示成"审核通过"。
    // 第 4 屏（选面试时段）不由状态直达，只能从第 2 屏的按钮进入，线上任务那里换成了交付入口
    const resumeSlots = s.value === 4 && !isOnline.value && detail.value.status === 'review_passed'
    landing = screenOf(detail.value)
    s.value = resumeSlots ? 4 : landing
    if (resumeSlots) {
      offerRefresh.value++
      loadSlots()
    }
    loadUrgent()
  } catch (e) {
    if (!current()) return
    detail.value = null
    trip.value = null
    urgentInfo.value = null
    loadedScope = null
    loadState.value = 'failed'
    loadError.value = e?.message || '报名进度加载失败'
    loadErrorCode.value = e?.code || -1
    toast(loadError.value)
    // 退回第 1 屏：只有它的文案改造成了能如实陈述加载状态，
    // 另外三屏（审核通过/未通过/选时段）对着空数据只会说与事实不符的话
    s.value = 1
  }
}

const s = useScreen(4, {
  onLoad: (q) => {
    appId.value = q?.appId || null
    explicitScreen.value = !!q?.s
    // 智能助手「我的报名」等入口不带 appId：之前停在"请从消息通知里的进度入口进入"，用户无处可去。
    // 现在转到「我的订单」，报名都列在那里，每条都有「查看进度」
    if (!appId.value && !explicitScreen.value) return replace(R.orders)
    if (appId.value) s.value = 1
    landing = s.value
  }
})
const offerRefresh = ref(0)
onShow(() => {
  visible = true
  loadDetail()
})
const leaveProgress = () => {
  visible = false
  pageEpoch++
  picked.value = -1
  booking.value = urgentBusy.value = withdrawing.value = false
}
onHide(leaveProgress)
onUnload(leaveProgress)
watch(getMessageScopeKey, () => {
  pageEpoch++
  loadedScope = null
  detail.value = trip.value = urgentInfo.value = slots.value = null
  picked.value = -1
  booking.value = urgentBusy.value = withdrawing.value = false
  if (appId.value) s.value = 1
  if (visible) loadDetail()
})
// 第 4 屏（选面试时段）是从第 2 屏点进来的：之前左上角返回直接离开本页，现在先回到进页时的那一屏
let landing = 0
const onBack = () => { if (landing && s.value !== landing) s.value = landing; else back() }

// 进度条当前步：线上任务以交付接口推好的为准，到店岗位按报名状态换算（见下）。没有真实报名也不是走查时给 0，
// 让所有节点都保持未完成态，避免暗示"提交报名"这一步已经发生过
const current = computed(() => {
  if (isOnline.value) {
    // 当前步以服务端推出来的为准（结算完成为 7 = 六步全部打勾）；还没取到时按报名状态粗略显示
    if (onlineFlow.value && typeof onlineFlow.value.current === 'number') return onlineFlow.value.current
    return ['withdrawn', 'terminated'].includes(detail.value.status) ? 0 : ['submitted', 'review_rejected'].includes(detail.value.status) ? 1 : 2
  }
  // 到店岗位按报名状态换算成 7 步里的第几步（apply-flow.flowStepOf）：已撤回 / 已终止 / 不认识的状态是 0（整条不亮），
  // 不再用服务端给的 step（那是老的六步口径，老版本小程序还在用，接口照旧给）
  if (detail.value) return flowStepOf(detail.value.status, detail.value.workEndTime, detail.value?.arrivalStep)
  return blank.value ? 0 : ({ 1: 2, 2: 3, 3: 2, 4: 3 })[s.value] || 1
})
// 进度条下面一句话：现在在等什么（只说系统里真有记录的事；订票、进群是和主理人线下确认的）
const flowTip = computed(() => (detail.value && !isOnline.value ? flowHint(detail.value.workEndTime ? 'completed' : detail.value.status, detail.value.arrivalStep) : ''))
const canOpenArrival = computed(() => !!detail.value && !isOnline.value && ['contract_signed', 'onboarded', 'completed'].includes(detail.value.status))
const openArrival = () => { if (canOpenArrival.value) go(R.jobContract + '?appId=' + appId.value + '&s=5') }

// 后端允许用户自己撤回的只有这三个状态（ApplicationStatus 的流转表）。
// 其余状态下这个按钮点下去必定被状态机拒绝，弹一句"当前状态不能撤回" ——
// 那是让用户去试一个注定失败的操作。这里只改按钮的可用状态，不动页面结构。
const WITHDRAWABLE = ['submitted', 'review_passed', 'interview_booked']
const canWithdraw = computed(() => designMode.value
  || (loadState.value === 'ready' && !withdrawing.value && !!detail.value && WITHDRAWABLE.indexOf(detail.value.status) >= 0))
// 设计稿第 1 屏整屏文案（等待审核、约 4 小时、保持电话畅通）只对 submitted 成立。
// 其余真实状态（已撤回、已预约面试、已终止…）设计稿没有对应屏，
// 这里改为直接摆出服务端的 statusLabel，而不是继续说"报名已提交、正在安排审核"
const awaitingReview = computed(() => designMode.value || detail.value?.status === 'submitted')
const heroTitle = computed(() => {
  if (awaitingReview.value) return '报名已提交'
  if (detail.value) return detail.value.statusLabel || '报名进度'
  if (loadState.value === 'loading') return '正在加载'
  return loadState.value === 'failed' ? '暂时无法显示报名进度' : '暂无可查看的报名'
})
// 已撤回 / 已终止是终态（落在第 1 屏）：不能再说"后续安排会通过消息通知你"，要说清楚这次报名已经结束、还能做什么
const ENDED = ['withdrawn', 'terminated']
const ended = computed(() => !!detail.value && ENDED.indexOf(detail.value.status) >= 0)
const heroDesc = computed(() => {
  if (awaitingReview.value) return '感谢你的信任，我们已收到你的报名信息，\n正在为你安排' + (detail.value && detail.value.contactSpecialist ? '袋鼠工作人员' : '当地主理人') + '审核。'
  if (ended.value && detail.value.status === 'withdrawn') return '你已撤回这次报名，\n如仍感兴趣可以重新报名。'
  if (ended.value) return '这次报名已结束。\n' + (detail.value.terminateReason ? '原因：' + detail.value.terminateReason : '可以看看其他岗位或重新报名。')
  if (detail.value) return '当前进度以下方的状态为准。'
  if (loadState.value === 'loading') return '正在读取报名进度…'
  if (loadState.value === 'failed') return (loadError.value || '报名进度加载失败') + '\n请稍后重试。'
  return '这里只显示指定的某一条报名，\n请从消息通知里的进度入口进入。'
})
const submitTimeText = computed(() => {
  if (detail.value) return formatDateTime(detail.value.submitTime)
  return designMode.value ? DESIGN.submitTime : ''
})
const statusText = computed(() => {
  if (detail.value) return detail.value.statusLabel || ''
  if (designMode.value) return DESIGN.status
  if (loadState.value === 'loading') return '加载中'
  return loadState.value === 'failed' ? '加载失败' : '暂无'
})
// 审核时长只对"还在等审核"的报名成立，审核已经结束时摆出来就是错的。
// 2026-10-19 复查：之前写「约 4 小时内」是设计稿的示意数字，平台给门店定的报名审核时限是 48 小时（员工端工作台「平台时限」同一口径，KgWorkbenchService.SLA_HOURS）
const reviewEtaText = computed(() => (awaitingReview.value ? '48 小时内' : ''))
const tipText = computed(() => {
  if (isOnline.value) return ended.value ? '这次接单申请已结束，如有疑问可联系发布方。' : '任务全国可接、远程完成，无需到店。审核通过后在任务页提交成果。'
  if (awaitingReview.value && urgentInfo.value?.urgent) return '你已加急：门店那边会排在前面并标「加急」，\n请保持电话畅通，方便沟通后续安排。'
  if (awaitingReview.value) return '平台要求门店在 48 小时内处理报名，\n请保持电话畅通，方便沟通后续安排。'
  if (ended.value) return '这次报名不会再有面试或录用安排，\n如有疑问可联系当地主理人。'
  if (detail.value) return '后续安排会通过消息通知你，\n请保持电话畅通。'
  if (loadErrorCode.value === 401) return '报名进度只对本人可见，\n请先登录后再进入。'
  return loadState.value === 'failed'
    ? '可稍后重试，\n或从消息通知里的进度入口重新进入。'
    : '需要查看某条报名的进度时，\n请从消息通知里的进度入口进入。'
})
const rejectTitle = computed(() => {
  // 主理人没填原因时之前这里整块空白，像是没加载出来
  if (detail.value) return detail.value.rejectReason || '未注明原因'
  return designMode.value ? DESIGN.rejectTitle : ''
})
// 设计稿把未通过原因拆成标题+说明两行，后端只有 rejectReason 一个字段，说明行无数据来源
const rejectText = computed(() => (designMode.value ? DESIGN.rejectText : (detail.value && !detail.value.rejectReason ? (contactSpecialist.value ? '发布方没有填写具体原因，可点下方「联系袋鼠工作人员」了解。' : '当地主理人没有填写具体原因，可点下方「联系当地主理人」了解。') : '')))
const options = computed(() => slots.value || (designMode.value ? DESIGN.options : []))
const slotsHint = computed(() => {
  if (options.value.length) return '主理人已为你提供以下可选时段'
  if (slotsState.value === 'loading') return '正在加载可选时段…'
  return slotsState.value === 'failed' ? (slotsError.value || '面试时段加载失败') : '当前没有可选的面试时段'
})
// 设计走查的示例时段没有 slotId，点确认只会得到"无法预约"的提示，但按钮保持可见可点，
// 以免走查时看到一个灰掉的按钮；真实场景下没有时段就直接禁用
const canBook = computed(() => options.value.length > 0 && (designMode.value || (loadState.value === 'ready' && slotsState.value === 'ready' && picked.value >= 0)))

// 线上任务专员发布的任务（详情里 contactSpecialist = true，2026-10-16 主人拍板）：「联系当地主理人」改叫「联系袋鼠工作人员」（2026-11-03 主人：统一叫法，用户只见「袋鼠工作人员」「当地主理人」两个词），
// 点进去还是这份报名的门店会话，发布的专员一定在里面（服务端 KgChatReception.publishers），顶栏写「专员 · 昵称」
const contactSpecialist = computed(() => !!detail.value?.contactSpecialist)
const contactLabel = computed(() => (contactSpecialist.value ? '联系袋鼠工作人员' : '联系当地主理人'))
// 会话页靠 appId 找到这条报名对应的门店会话；不带参数时会被弹回消息中心（2026-09-30 审计发现）
const contactOwner = () => {
  const id = appId.value || detail.value?.appId
  if (!id) return toast('请先选择一份报名')
  go(R.chat + '?appId=' + id)
}
const openApply = () => go(R.jobApply + (detail.value?.jobId ? '?jobId=' + detail.value.jobId : ''))
// 左侧按钮原来固定是「修改报名信息」，实际只是重新走一遍报名，对在途报名提交必然被拒，商家确认录用之后更是找不到签约入口
// （2026-09-28 复核发现）。按真实状态切换含义，不增加任何控件：
//   商家已确认录用 / 已签约 → 「签约到店」（进责任书页）；已驳回 / 已撤回 / 已终止 → 「重新报名」；其余在途状态 → 「查看岗位」
const REAPPLY_OK = ['review_rejected', 'withdrawn', 'terminated', 'user_rejected']
const leftActionText = computed(() => {
  const st = detail.value?.status
  if (st === 'store_confirmed' || st === 'contract_signed') return st === 'contract_signed' ? '查看责任书' : '签约到店'
  return REAPPLY_OK.indexOf(st) >= 0 ? '重新报名' : '查看岗位'
})
const onLeftAction = () => {
  const st = detail.value?.status
  const id = appId.value || detail.value?.appId
  if (st === 'store_confirmed' || st === 'contract_signed') return go(R.jobContract + '?appId=' + id)
  if (REAPPLY_OK.indexOf(st) >= 0) return openApply()
  go(R.jobDetail + (detail.value?.jobId ? '?jobId=' + detail.value.jobId : ''))
}
const actions = computed(() => [
  { icon: 'file-text', text: isOnline.value ? '补充资料重新申请' : '修改时间重新提交', fn: () => openApply() },
  { icon: 'search', text: '查看相似机会', fn: () => go(R.jobsList + (isOnline.value ? '?type=online' : '')) },
  { icon: 'message-circle', text: contactLabel.value, fn: () => contactOwner() }
])
// ---------------------------------------------------------------------------
// 第 2 屏：审核通过。到店岗位接着约视频面试；线上任务没有面试，按钮换成去交付页提交成果。
// 交付页的路由和参数与「我的订单」里的「提交成果 / 结算」按钮一致（KgUserHubService.orders）。
// 原先这一屏对线上任务也写"请选择视频面试时间"，预约被后端以"线上任务不需要预约面试"拒绝，
// 整个页面没有任何提交成果的入口（2026-10-02 复核发现）
// ---------------------------------------------------------------------------
const isOnline = computed(() => detail.value?.jobType === 'online')
// 线上任务的步骤条（简版，与交付页同一套）：报名 → 已接单 → 素材已发 → 已交付 → 验收通过 → 结算（待打款 / 已登记打款 / 已到账）。
// 步骤名和当前步取交付接口里服务端推好的 flow（按报名状态、门店素材发送时间、成果轮次、结算单），本页不自己推
const ONLINE_STEPS = ['报名', '已接单', '素材已发', '已交付', '验收通过', '结算']
const onlineFlow = ref(null)
watch(detail, async (d) => {
  onlineFlow.value = null
  if (!d || d.jobType !== 'online' || !appId.value) return
  const ctx = pageContext()
  try {
    const res = await apiMyOnline(appId.value)
    if (isCurrent(ctx) && detail.value === d) onlineFlow.value = res?.data?.flow || null
  } catch (e) {
    // 取不到就按报名状态粗略显示（见 current），不打断进度页
    if (isCurrent(ctx) && detail.value === d) onlineFlow.value = null
  }
})
const passTitle = computed(() => (isOnline.value ? '接单申请已通过' : '审核通过'))
const passDesc = computed(() => (isOnline.value ? '发布方已通过你的接单申请。无需到店，请远程完成任务，并在下方提交成果。' : '恭喜你！主理人已通过你的报名申请。'))
const passTips = computed(() => (isOnline.value ? ONLINE_TIPS.map((t) => ({ ...t, text: t.text.replace('联系当地主理人', contactLabel.value) })) : INTERVIEW_TIPS))
const passActionText = computed(() => (isOnline.value ? '提交成果 / 结算' : detail.value?.jobType === 'volunteer' ? '安排视频面试时间' : '请选择视频面试时间'))
const openDeliver = () => go(R.jobDeliver + '?appId=' + (appId.value || detail.value?.appId))
const openSlots = () => {
  // 线上任务的选时段屏不存在：后端 bookInterview 会直接拒绝，这里不给它进去的机会
  if (isOnline.value) return openDeliver()
  offerCount.value = null
  s.value = 4
  loadSlots()
}
const onPassAction = () => (isOnline.value ? openDeliver() : openSlots())
const withdrawing = ref(false)
const doWithdraw = async (ctx) => {
  // 没有 appId（设计走查 / 取数失败）时不存在可撤回的对象。
  // 这里报"已撤回报名"会让用户以为报名真的被撤了，而实际上一个请求都没发出去
  if (!appId.value) return toast('没有可撤回的报名')
  if (!isCurrent(ctx) || !readyForAction() || !canWithdraw.value) return
  withdrawing.value = true
  try {
    const res = await apiWithdrawApplication(appId.value)
    if (!isCurrent(ctx)) return
    toast(res?.msg || '已撤回报名')
    // 撤回后按服务端的真实状态重新渲染，不再武断切到"审核未通过"那一屏
    await loadDetail()
  } catch (e) {
    if (isCurrent(ctx)) toast(e?.message || '撤回失败，请重试')
  } finally { if (isCurrent(ctx)) withdrawing.value = false }
}
const withdraw = () => { const ctx = pageContext(); uni.showModal({ title: '撤回报名', content: '撤回后需重新提交报名，确定撤回吗？', confirmColor: '#C04437', success: (r) => { if (r.confirm) doWithdraw(ctx) } }) }

// ---------------------------------------------------------------------------
// 加急投递：还在等门店审核的报名，可以花积分标成「加急」，门店的报名列表会把它排在最前面并标红色「加急」。
// 能不能加急、要花多少、现在有多少积分都以服务端为准（花费由运营在后台参数设置里配），每条报名只能加急一次。
// ---------------------------------------------------------------------------
const urgentInfo = ref(null)
const urgentBusy = ref(false)
const loadUrgent = async () => {
  if (!appId.value || detail.value?.status !== 'submitted') { urgentInfo.value = null; return }
  const ctx = pageContext(), request = detailRequest
  const current = () => isCurrent(ctx) && request === detailRequest && detail.value?.status === 'submitted'
  try {
    const res = await apiUrgentInfo(appId.value)
    if (current()) urgentInfo.value = res?.data || null
  } catch (e) {
    // 读不到就不显示这一行，不影响看进度
    if (current()) urgentInfo.value = null
  }
}
const onUrgent = async () => {
  const u = urgentInfo.value
  if (!readyForAction() || !u || !u.canUrgent || urgentBusy.value) return
  const ctx = pageContext()
  if (Number(u.balance) < Number(u.cost)) {
    const r = await modal('积分不够', `加急一次要 ${u.cost} 积分，你现在有 ${u.balance} 分，还差 ${u.shortBy} 分。\n完成换工、门店任务，或者邀请朋友，都能攒积分。`, { confirmText: '看看积分', cancelText: '知道了' })
    if (r.confirm && isCurrent(ctx)) go(R.profile + '?s=3')
    return
  }
  const ok = await modal('加急投递', `花 ${u.cost} 积分把这条报名设为「加急」：门店那边会排在前面并标「加急」，更快看到你。\n你现在有 ${u.balance} 分，加急后剩 ${u.balance - u.cost} 分。\n每条报名只能加急一次，积分用掉后不退（门店没录用、自己撤回也不退）。`, { confirmText: '确定加急', confirmColor: '#9A6B3F' })
  if (!ok.confirm || !isCurrent(ctx) || !readyForAction() || urgentBusy.value || urgentInfo.value !== u) return
  urgentBusy.value = true
  try {
    const res = await apiUrgentApply(appId.value)
    if (!isCurrent(ctx)) return
    toast(res?.msg || '已加急')
    await loadUrgent()
  } catch (e) {
    if (!isCurrent(ctx)) return
    toast(e?.message || '加急失败，请重试')
    loadUrgent()
  } finally {
    if (isCurrent(ctx)) urgentBusy.value = false
  }
}
// 预约要等服务端返回：连点会发两次预约，第二次必定撞「已约过」报错
const booking = ref(false)
const confirmTime = async () => {
  if (!designMode.value && (!readyForAction() || slotsState.value !== 'ready')) return
  const ctx = pageContext()
  if (isOnline.value) return openDeliver()
  const opt = options.value[picked.value]
  if (picked.value < 0 || !opt) return toast('请选择一个面试时段')
  // 没有真实报名或真实 slotId 时不能跳转 —— 跳过去等于宣称面试已约上
  if (!appId.value || !opt.slotId) return toast(designMode.value ? '这是设计稿示例时段，无法预约' : '当前没有可预约的面试时段')
  if (booking.value) return
  booking.value = true
  try {
    const res = await apiBookInterview(appId.value, opt.slotId)
    if (!isCurrent(ctx)) return
    toast(res?.msg || '面试时间已确认')
    // 预约成功后回到设计稿里的落点：面试候场页。
    //
    // 这条跳转在接线时被删过一次，当时的理由是"那页没接后端"。
    // 但 interview.vue 后来接上了（apiApplicationDetail / apiFinishInterview /
    // apiConfirmIntent 都在它里面），跳转却没有恢复 ——
    // 于是整个小程序里再没有任何入口进得去那一页，
    // 报名走到 interview_booked 之后 finish-interview 与 confirm 都发不出去，
    // 履约链路从这里断死，被约走的时段也因为到不了终态而一直占着。
    // 带上 appId：没有它的话那页会落到"设计稿走查"分支。
    replace(`${R.jobInterview}?appId=${appId.value}`)
  } catch (e) {
    if (!isCurrent(ctx)) return
    toast(e?.message || '预约失败，请重试')
    // 失败通常是时段刚被别人占用，本地列表已经过期，重新拉一次让用户在真实可选时段里再挑
    loadSlots()
  } finally {
    if (isCurrent(ctx)) booking.value = false
  }
}
</script>

<style scoped lang="scss">
/* 10-19 和岗位详情、报名页同一套视觉：极浅暖米渐变底、白卡 18 圆角 + 暖色细边 + 柔和暖阴影、底部暖棕渐变大胶囊（撤回仍是提醒红描边） */
.progress { --k-bg: #F7EFE6; background: linear-gradient(180deg, #F7EFE6 0%, #FBF7F1 360px, #FBF7F1 100%); }
.progress :deep(.k-card) { border-radius: 18px !important; box-shadow: 0 8px 24px rgba(120, 84, 48, .08), 0 0 0 1px rgba(160, 120, 80, .1); }
.progress .k-bottom { background: #FFFFFF; box-shadow: 0 -6px 18px rgba(120, 84, 48, .08); }
.progress .k-bottom :deep(.k-button) { height: 48px; border-radius: 24px; font-size: 16px; font-weight: 700; }
.progress .k-bottom :deep(.k-button.is-primary) { background: linear-gradient(135deg, #8E5E37 0%, #6E4628 100%); box-shadow: 0 6px 14px rgba(110, 70, 40, .26); }
.contact-entry { padding: 10px 16px 0; }
.safety-entry { padding: 0 16px; }
.steps { padding: 12px 8px 6px; }
/* 7 步进度：白卡浮在奶白底上，下面一句当前在等什么 */
.steps--flow { margin: 8px 16px 0; padding: 14px 6px 12px; border-radius: 18px; background: var(--k-paper); box-shadow: 0 8px 24px rgba(120, 84, 48, .08), 0 0 0 1px rgba(160, 120, 80, .1); }
.steps__tip { display: block; margin: 12px 10px 0; padding-top: 10px; border-top: 1px dashed var(--k-line2); font-size: 12px; line-height: 1.6; color: var(--k-ink2); text-align: center; }
.k-gap2 { gap: 2px; } .k-gap24 { gap: 24px; }
.block { display: block; }
.hero { display: flex; flex-direction: column; align-items: center; text-align: center; padding-top: 10px; }
.hero--plain { padding-top: 22px; }
.hero__img--1 { width: 132px; height: 104px; }
.hero__img--2 { width: 156px; height: 158px; }
.hero__img--3 { width: 136px; height: 112px; }
.hero__title { margin-top: 14px; font-family: var(--k-display-font); font-weight: 900; font-size: 26px; letter-spacing: .5px; color: #3B2A1E; line-height: 1.3; }
.hero__desc { margin-top: 10px; font-size: 14px; line-height: 1.6; color: var(--k-muted); }
.row { display: flex; align-items: center; justify-content: space-between; height: 44px; font-size: 14px; }
.row__label { display: flex; align-items: center; gap: 10px; color: var(--k-ink); }
.row__value { color: var(--k-ink); }
.status { height: 26px; padding: 0 12px; border-radius: 6px; background: var(--k-green-soft); border: 1px solid #C9DACC; color: var(--k-green); font-size: 13px; display: flex; align-items: center; }
.tip { padding: 12px; border-radius: 12px; background: #FBF3EA; border: 1px solid rgba(160, 120, 80, .16); }
.tip--card { background: var(--k-paper); }
.tip__title { font-size: 14px; font-weight: 600; }
.tip__text { display: block; margin-top: 6px; font-size: 14px; line-height: 1.7; color: var(--k-ink2); } /* 奶油底上用二级墨 */
.tip--card .tip__text { color: var(--k-muted); }
.tips { padding: 14px; border-radius: 16px; background: linear-gradient(180deg, #F6ECE0 0%, #FBF6F0 100%); border: 1px solid rgba(160, 120, 80, .22); display: flex; flex-direction: column; gap: 14px; }
.tips__row { display: flex; align-items: flex-start; gap: 14px; }
.tips__icon { width: 34px; height: 34px; border-color: var(--k-line2); background: var(--k-paper); }
.tips__text { font-size: 14px; line-height: 1.7; padding-top: 3px; }
.reason__label { font-size: 14px; font-weight: 600; }
.reason__title { display: block; margin-top: 8px; font-family: var(--k-display-font); font-weight: 700; font-size: 18px; color: var(--k-alert); }
.reason__text { display: block; margin-top: 6px; font-size: 14px; line-height: 1.65; color: var(--k-muted); }
.action { height: 48px; padding: 0 16px; border: 1px solid rgba(160, 120, 80, .2); border-radius: 14px; background: var(--k-paper); display: flex; align-items: center; justify-content: center; gap: 14px; font-size: 15px; }
.cheer { display: block; margin-top: 20px; text-align: center; font-size: 13px; color: var(--k-muted); }
.pick__title { display: block; margin-top: 12px; font-family: var(--k-display-font); font-weight: 700; font-size: 20px; }
.pick__sub { display: block; margin-top: 8px; font-size: 14px; color: var(--k-muted); }
.opt { display: flex; align-items: center; gap: 14px; padding: 16px 12px; border: 1px solid rgba(160, 120, 80, .16); border-radius: 16px; background: var(--k-paper); box-shadow: 0 6px 18px rgba(120, 84, 48, .06); }
.opt.on { border-color: #E0A86E; background: #FFF8F0; }
.opt__date { font-size: 16px; line-height: 1.35; }
.opt__meta { margin-top: 8px; padding-left: 34px; font-size: 13px; color: var(--k-muted); }
.contact { width: 140px; flex: 0 0 auto; }
/* 审核通过屏底栏的「撤回报名」：收窄边距，320 宽的手机上旁边「请选择视频面试时间」也放得下 */
.withdraw { width: 88px; flex: 0 0 auto; }
.withdraw :deep(.k-button) { padding: 0 8px; }
/* 「撤回报名」：提醒红字 + 浅红描边；不能撤回时还是这套颜色、整体变淡（第二轮：不再盖灰，公共按钮的禁用色带 !important，这里要更具体才盖得住） */
.danger :deep(.k-button) { color: var(--k-alert); border-color: rgba(192, 68, 55, .45); }
.progress .danger :deep(.k-button.is-disabled) { color: var(--k-alert) !important; border-color: rgba(192, 68, 55, .45) !important; }
@import "flow-premium.scss";
/* ==== r3jobsb 第三轮 start ==== */
/* 第三轮（11-18）：
   ① 插画原来自带一块奶油色方底，在白卡上像贴纸——放进 104 的浅棕圆里，用「取较暗的颜色」叠上去，方底和圆融成一体，只留线条；
   ② 右对齐的提交时间钻到「客服」小钮底下——信息行右边让出 12；
   ③「等待商家审核」原来是豆绿（全站绿 = 成功），等待类改成赭黄浅底；
   ④ 白卡内边距 16，标题 18/700、说明 13/muted；「你可以」三行加行尾箭头。 */
.progress :deep(.k-card) { padding: 16px !important; }
.progress .hero { padding-top: 0; }
.progress .hero--plain { padding: 20px 16px; }
.progress .hero__art { width: 104px; height: 104px; border-radius: 50%; background: var(--k-red-soft); display: flex; align-items: center; justify-content: center; overflow: hidden; }
.progress .hero__art .hero__img { display: block; border-radius: 0; mix-blend-mode: darken; }
.progress .hero__img--1 { width: 80px; height: 63px; }
.progress .hero__img--2 { width: 76px; height: 77px; }
.progress .hero__img--3 { width: 80px; height: 66px; }
.progress .hero__title { margin-top: 12px; font-size: 18px; font-weight: 700; line-height: 26px; }
.progress .hero__desc { margin-top: 4px; font-size: 13px; line-height: 1.6; color: var(--k-muted); }
.progress .k-divider { margin-top: 16px; }
.progress .row { height: 44px; padding-right: 12px; font-size: 13px; }
.progress .row__label { gap: 6px; color: var(--k-ink2); }

.progress .row__value { color: var(--k-ink); font-variant-numeric: tabular-nums; }
.progress .status { height: 20px; padding: 0 6px; border-radius: 4px; background: var(--k-ochre-soft); color: var(--k-ochre-deep); font-size: 11px; font-weight: 500; }
.progress .tip { margin-top: 8px; padding: 12px; border-radius: 8px; background: var(--k-page); }
.progress .tip--card { margin-top: 8px; border-radius: 12px; background: var(--k-paper); }
.progress .tip__title { font-size: 13px; font-weight: 600; line-height: 20px; }
.progress .tip__text { margin-top: 2px; font-size: 12px; line-height: 1.6; color: var(--k-muted); }
.progress .tips { margin-top: 8px; padding: 16px; gap: 14px; }
.progress .tips__row { gap: 12px; align-items: center; }
.progress .tips__icon { flex: 0 0 auto; width: 36px; height: 36px; border-radius: 10px; background: var(--k-red-soft); }
.progress .tips__text { padding-top: 0; font-size: 13px; line-height: 1.6; color: var(--k-ink2); }
.progress .reason__label { font-size: 12px; color: var(--k-muted); }
.progress .reason__title { margin-top: 4px; font-size: 16px; font-weight: 600; line-height: 22px; }
.progress .reason__text { font-size: 13px; line-height: 1.6; }
.progress .k-title.block { margin: 20px 4px 10px; }
.progress .k-col.k-gap8.k-mt8 { margin-top: 0; }
.progress .action { padding: 0 16px; gap: 10px; }
.progress .action > text { flex: 1; min-width: 0; color: var(--k-ink); }
.progress .action + .action::before { left: 44px; }

.progress .cheer { margin-top: 20px; font-size: 12px; line-height: 1.6; }
/* 选面试时间：标题 16/700，刷新时段是 28 高的次按钮小胶囊；时段卡 16 内边距、选中浅棕底 + 细棕边 */
.progress .pick__title { margin-top: 12px; padding-left: 4px; font-size: 16px; font-weight: 700; }
.progress .pick__sub { margin-top: 2px; padding-left: 4px; font-size: 12px; color: var(--k-muted); }
.progress .opt { padding: 14px 16px; gap: 12px; }
.progress .opt.on { background: var(--k-red-soft); border-color: var(--k-red-line); }
.progress .opt .k-gap12 { gap: 8px; }

.progress .opt .k-col > .opt__date { font-variant-numeric: tabular-nums; }
.progress .opt .k-col > .opt__date:last-child { font-size: 15px; font-weight: 600; color: var(--k-ink); }
.progress .opt__meta { margin-top: 8px; padding-left: 26px; gap: 16px; font-size: 12px; }

.progress .k-col.k-gap12.k-mt12 { gap: 8px; }

/* —— 返修 1 —— */
/* 信息行数值仍右缩 12 躲开「客服」小钮；分隔线和温馨提示块跟着一起右缩 12，卡内右边只剩一条线 */
/* 返修 3：分隔线、提示块不再右让 12（左右内边距对称，躲客服钮交给公共层） */
/* 底部两个按钮间距 8 */
.progress :deep(.k-bottom__inner) { gap: 8px; }
/* 审核通过：印章放大到 92，外缘贴近圆边 */
.progress .hero__img--2 { width: 92px; height: 93px; }
/* 「你可以」「请选择视频面试时间」标题和下面的白卡左边对齐 */
.progress .k-title.block { margin-left: 0; margin-right: 0; }
.progress .pick__title, .progress .pick__sub { padding-left: 0; }
/* 未通过原因：收成 15/600 墨色字，左边一根 3×14 的提醒色短竖条做点缀，不和主标题抢 */
.progress .reason__title { position: relative; padding-left: 11px; font-size: 15px; font-weight: 600; line-height: 22px; color: var(--k-ink); }
.progress .reason__title::before { content: ''; position: absolute; left: 0; top: 4px; width: 3px; height: 14px; border-radius: 2px; background: var(--k-alert); }
/* 选面试时间底栏：主按钮占满，次按钮宽度随字 */
.progress .contact { flex: 0 0 auto; width: auto; }
.progress .contact :deep(.k-button) { padding: 0 14px; }
@media (max-width: 359px) {
  .progress .contact :deep(.k-button) { padding: 0 12px; font-size: 13px; }
}
/* —— 返修 2 start —— */
/* 底栏按钮和白卡同一条边（k-bottom 的 pad 12） */
/* 选面试时间：单选圈挪到卡片右侧、垂直居中；左边只留一个日历图标打头 */
.progress .opt { align-items: center; }
.progress .opt > .k-radio { order: 2; flex: 0 0 auto; }
.progress .opt__meta { padding-left: 26px; }
.progress .opt__tz { font-size: 12px; font-weight: 400; color: var(--k-muted); }
/* —— 返修 2 end —— */
/* —— 返修 3 start（11-18 晚）—— */
/* 整条报名流程页边距 16、卡内 16；主卡左右对称（信息行右边不再多让 12） */
.progress .k-body { padding-left: 16px; padding-right: 16px; }
.progress .safety-entry { padding: 0 16px; }
.progress :deep(.order-mediation) { margin: 12px 16px 0; }
.progress .k-body > :deep(.k-button.is-sm.is-outline) { right: 16px; }
.progress .row { padding-right: 0; }
/* 三种状态同一种插画：96 圆 + 40 线性图标（审核通过换浅绿圆） */
.progress .hero__art { width: 96px; height: 96px; }
.progress .hero__art--ok { background: var(--k-green-soft); }
/* 「撤回报名」做轻：不要描边，14/500 提醒红文字按钮 */
.progress .danger :deep(.k-button.is-outline), .progress .danger :deep(.k-button.is-outline.is-disabled) { border-color: transparent !important; background: transparent !important; font-size: 14px; font-weight: 500; }
/* 选面试时间：单选圈 20、1.5 边，没选时也看得出能点 */
.progress .opt > .k-radio { width: 20px; height: 20px; box-sizing: border-box; border: 1.5px solid var(--k-light); }
.progress .opt > .k-radio.checked { border-color: var(--k-red); }
/* —— 返修 3 end —— */
/* —— 返修 4 start（11-18 夜）—— */
/* 订阅条、步骤条、联系入口和下面的白卡同一条左右线（页边距 16，底栏 pad 12 16） */
.progress :deep(.subscribe-entry) { padding: 8px 16px 0; }
.progress .steps--flow { margin: 8px 16px 0; }
.progress .contact-entry { padding: 8px 16px 0; }
/* 三种状态插画收成 80 圆 + 32 图标；审核通过 / 未通过的主卡上下 24，不再头重脚轻 */
.progress .hero__art { width: 80px; height: 80px; }
.progress .hero--plain { padding: 24px 16px; }
/* 未通过：状态卡到原因卡 12，原因卡到「你可以」24（卡与卡 12、区块与区块 24） */
.progress :deep(.k-card.reason) { margin-top: 12px !important; }
.progress .k-title.block { margin-top: 24px; }
/* 选面试时间：时段卡之间 12；温馨提示卡内边距 16，和时段卡同一条左线 */
.progress .k-col.k-gap12.k-mt12 { gap: 12px; }
.progress .tip--card { padding: 16px; }
/* —— 返修 4 end —— */
/* —— 返修 5 start（11-18 深夜）—— */
/* 温馨提示：不再白卡套灰块，上面一条发丝线隔开；标题 13/600，正文 12 灰 */
.progress .tip:not(.tip--card) { position: relative; margin-top: 12px; padding: 12px 0 0; border: 0; border-radius: 0; background: none; }
.progress .tip:not(.tip--card)::before { content: ''; position: absolute; left: 0; right: 0; top: 0; height: 1px; background: var(--k-line); transform: scaleY(.5); transform-origin: 0 0; }
.progress .tip__title { font-size: 13px; font-weight: 600; }
.progress .tip__text { font-size: 12px; color: var(--k-muted); }
/* 未通过页尾：两行均分，「～」不单独掉行 */
.progress .cheer { text-wrap: balance; }
/* 选面试时间：「刷新时段」和标题那一行上下居中（标题行高 28，按钮高 28，顶边取同一个值） */
.progress .pick__title { margin-top: 12px; line-height: 28px; }
/* —— 返修 5 end —— */
/* ==== r3jobsb 第四轮 start（11-18 夜，以微信实拍为准）==== */
/* 步骤条不再套白卡，直接放在页首，主卡成为首屏唯一的白卡 */
.progress .steps--flow { margin: 4px 16px 0; padding-left: 0; padding-right: 0; background: transparent; box-shadow: none; }
/* 订阅提醒：放到主卡下面，一行 13/500 暖棕文字链接，不加底卡；底栏留白挪到它下面 */
.progress .k-body.k-pad-bottom { padding-bottom: 0; }
.progress :deep(.subscribe-entry) { padding: 12px 16px calc(88px + var(--k-safe-bottom)); }
.progress :deep(.subscribe-entry button) { min-height: 32px; height: 32px; padding: 0; border-radius: 0; background: transparent; font-size: 13px; font-weight: 500; line-height: 32px; }
/* 主卡里只有一种线：hero 下面的分隔线也改成发丝线 */
.progress .k-divider { height: 1px; background: var(--k-line); transform: scaleY(.5); transform-origin: 0 0; }
/* 结果页大图标统一 64 圆；卡内上下 24 */
.progress .hero__art { width: 64px; height: 64px; }
.progress .hero--plain { padding: 24px 16px 20px; }
/* 审核通过：hero 和三条说明合成一张卡，中间发丝线；说明前是 16 号灰色图标，不加底 */
.progress .hero--plain + .tips { position: relative; margin-top: 0; padding: 16px; gap: 12px; border-radius: 0 0 12px 12px; }
.progress .hero--plain + .tips::before { content: ''; position: absolute; left: 16px; right: 16px; top: 0; height: 1px; background: var(--k-line); transform: scaleY(.5); transform-origin: 0 0; }
.progress .tips__row { align-items: flex-start; gap: 8px; }
.progress .tips__icon { flex: 0 0 16px; width: 16px; height: 22px; border: 0; border-radius: 0; background: none; }
.progress .tips__text { font-size: 14px; line-height: 22px; color: var(--k-ink2); word-break: keep-all; overflow-wrap: anywhere; }
/* 未通过：原因说明只在标点处折行；「你可以」列表发丝线左起文字、右止卡内边距 16 */
.progress .reason__text { word-break: keep-all; overflow-wrap: anywhere; text-wrap: balance; }
.progress .action + .action::before { left: 44px; right: 16px; }
/* 选面试时段：三个时段合成一张列表卡，行间发丝线；选中整行浅棕底；时间 18/700 等宽 */
.progress .opt-list { gap: 0; margin-top: 12px; border-radius: 12px; background: var(--k-paper); overflow: hidden; }
.progress .opt { position: relative; padding: 16px; border: 0; border-radius: 0; background: transparent; box-shadow: none; }
.progress .opt + .opt::before { content: ''; position: absolute; left: 46px; right: 16px; top: 0; height: 1px; background: var(--k-line); transform: scaleY(.5); transform-origin: 0 0; }
.progress .opt.on { border-color: transparent; background: var(--k-red-soft); }
.progress .opt .k-col > .opt__date:last-child { font-size: 18px; font-weight: 700; line-height: 26px; }
.progress .tip--card { margin-top: 12px; padding: 0 4px; border-radius: 0; background: transparent; }
.progress .tip--card .tip__title { font-size: 12px; font-weight: 600; color: var(--k-ink2); }
.progress .tip--card .tip__text { font-size: 12px; line-height: 1.6; color: var(--k-muted); word-break: keep-all; overflow-wrap: anywhere; }
/* 底栏：撤回报名（危险动作）放左边 96 宽的文字按钮，主按钮占其余；高都是 44 */
.progress .k-flex1.danger, .progress .withdraw.danger { flex: 0 0 96px; width: 96px; order: -1; }
.progress .danger :deep(.k-button) { height: 44px; padding: 0; font-size: 15px; font-weight: 500; color: var(--k-alert); }
.progress :deep(.k-bottom__inner) { gap: 12px; }
/* ==== r3jobsb 第四轮 end ==== */
/* ==== r3jobsb 第四轮返修 start（11-19，复评遗留）==== */
/* s=1 当前状态：去掉小底色标签，13/600 赭色纯文字，和同卡其它值一个样子 */
.progress .status { height: auto; padding: 0; border: 0; border-radius: 0; background: transparent; font-size: 13px; font-weight: 600; line-height: 20px; color: var(--k-ochre-deep); }
/* s=2 hero 和三条说明真正合成一张卡：hero 只留上圆角、下边贴住说明块 */
.progress .hero--joined { margin-bottom: 0; border-radius: 12px 12px 0 0; }
.progress .hero--joined + .tips { margin-top: 0; border-top: 0; border-radius: 0 0 12px 12px; }
/* s=3 没有底栏：订阅链接紧跟在「别灰心…」下面，下边只留安全区 */
.progress.progress--nobar .k-body.k-pad-safe { padding-bottom: 16px; }
.progress.progress--nobar :deep(.subscribe-entry) { padding: 0 16px calc(24px + var(--k-safe-bottom)); }
/* 原因说明：微信不认 text-wrap，折行靠 keep-all 落在逗号后 */
.progress .reason__text, .progress .cheer { text-wrap: wrap; word-break: keep-all; overflow-wrap: anywhere; }
/* s=4「刷新时段」：顶边和标题行（行高 28）同一条线，上下居中 */
.progress .k-body > :deep(.k-button.is-sm.is-outline) { top: 24px; }
/* 页尾鼓励语：最宽 240，在第二个逗号后分两行，「～」不会单独掉到下一行（微信不认 text-wrap） */
.progress .cheer { max-width: 240px; margin-left: auto; margin-right: auto; }
/* ==== r3jobsb 第四轮返修 end ==== */
/* ==== r3jobsb 第五轮 start（11-19，按微信实拍复评）==== */
/* s=3 未通过：原因并进状态卡——状态块只留上圆角，原因块贴住它、只留下圆角，中间一条左右各缩 16 的发丝线（和审核通过那屏同一种做法）；到「你可以」仍是 24 */
.progress .hero--plain { border-radius: 12px 12px 0 0; }
.progress :deep(.k-card.reason) { position: relative; margin-top: 0 !important; padding: 16px !important; border-radius: 0 0 12px 12px !important; }
.progress :deep(.k-card.reason)::before { content: ''; position: absolute; left: 16px; right: 16px; top: 0; height: 1px; background: var(--k-line); transform: scaleY(.5); transform-origin: 0 0; }
/* ==== r3jobsb 第五轮 end ==== */
/* ==== r3jobsb 第三轮 end ==== */
</style>
