<template>
  <!-- #ifdef MP-WEIXIN -->
  <page-meta :page-style="aiOpen ? 'overflow: hidden' : ''" />
  <!-- page-meta 必须是页面第一个节点：AI袋鼠弹层开着时锁住页面滚动（网页版由弹层自己锁 body） -->
  <!-- #endif -->
  <view class="k-page interview-page" :class="[$userSurface, { 'video-page': s === 2 }]">
    <k-topbar :title="s === 4 && focusRenewal && renewalFirst ? '换工续期' : titles[s - 1]" back :dark="s === 2" :bg="s === 2 ? '#121815' : ''" custom-back @back="onBack" />

    <view v-if="s === 4 && appId && detail" class="interview-messages">
      <k-application-dates v-if="pageVisible && renewalFirst" :app-id="appId" @navigate="leave" @updated="loadDetail(true)" />
      <application-messages :app-id="appId" :store-name="detail.storeName || ''" @navigate="leave" />
    </view>

    <view v-if="s !== 2 && s !== 4 && detail && detail.jobType !== 'online'" class="interview-flow">
      <view class="interview-flow__head"><text>报名流程</text><text v-if="flowCurrent" class="interview-flow__stage">{{ flowCurrent > FLOW_STEPS.length ? '流程已完成' : '第 ' + flowCurrent + ' / ' + FLOW_STEPS.length + ' 步' }}</text></view>
      <job-flow-steps :current="flowCurrent" :arrival-enabled="canOpenArrival" compact @arrival="openArrival" />
      <text class="interview-flow__hint">{{ flowTip }}</text>
    </view>

    <k-order-mediation v-if="s !== 2 && s !== 4 && detail?.jobType === 'volunteer'" order-type="application" :order-id="appId" volunteer-dispute />

    <view v-if="s === 1" class="lobby k-pad-safe">
      <view class="countdown"><text>面试将于</text><view><text>{{ countdownText }}</text><text>{{ countdownSuffix }}</text></view><text>{{ lobbyHint }}</text></view>
      <!-- 认出腾讯会议号：一键拉起腾讯会议小程序 + 复制会议号；认不出的旧文字（链接等）照旧显示原文，用下方按钮复制。
           2026-11-03 主人：会议号、密码、入会链接各占一行，点哪行复制哪行；只有腾讯会议链接时「进入」改为复制链接 -->
      <view v-if="tm" class="card meeting-card"><text class="tm-title">腾讯会议</text><view v-if="tm.code" class="tm-row" @click="copyText(tm.code)"><text>会议号</text><text class="tm-code">{{ tmCode }}</text><text class="tm-copy">复制</text></view><view v-if="tm.pwd" class="tm-row" @click="copyText(tm.pwd)"><text>密码</text><text class="tm-code">{{ tm.pwd }}</text><text class="tm-copy">复制</text></view><view v-if="tm.link" class="tm-row" @click="copyText(tm.link)"><text>链接</text><text class="tm-link">{{ tm.link }}</text><text class="tm-copy">复制</text></view><text v-if="tm.note" class="tm-note">{{ tm.note }}</text><view class="tm-actions"><k-button block icon="video" label="进入腾讯会议" @click="joinMeeting" /><k-button block type="outline" size="md" :label="tm.code ? '复制会议号' : '复制入会链接'" @click="copyCode" /></view><text class="tm-hint">{{ tm.code ? '首次进入需按腾讯会议提示授权手机号' : '复制链接后，用手机浏览器打开，或打开腾讯会议 App 加入' }}</text></view>
      <view v-else class="card meeting-card meeting-card--plain"><text>{{ meetingInfo || '尚未填写会议信息，请联系门店核对入会方式。' }}</text><text class="tm-hint">{{ meetingInfo ? '这段会议信息里没认出腾讯会议号，请复制后按其中方式入会。' :'面试通过腾讯会议进行，填好会议号后，可在这里一键进入。' }}</text></view>
      <view v-if="appId" class="meeting-help">
        <text class="meeting-help__title">在等候室一直进不去？</text>
        <text class="tm-hint">若你创建了会议，请用创建会议的账号开始会议，在「管理成员 → 等候中」允许对方加入。收到邀请的人点「进入腾讯会议」，或复制入会链接到浏览器打开。</text>
        <text v-if="meetingRefreshError" class="meeting-help__error">{{ meetingRefreshError }}</text>
        <view class="meeting-help__actions"><k-button type="outline" size="md" :disabled="meetingRefreshing" :label="meetingRefreshing ? '正在刷新…' : '刷新会议信息'" @click="refreshMeetingInfo(true)" /><k-button type="outline" size="md" label="联系商家" @click="contactStore" /></view>
      </view>
      <text class="section-title">面试岗位</text>
      <view class="job"><image v-if="jobCover" :src="jobCover" mode="aspectFill" /><view><text class="job__title">{{ displayWording(jobTitle) }}</text><view v-if="jobAddress"><k-icon name="map-pin" :size="14" color="muted" /><text>{{ jobAddress }}</text></view><view v-if="jobSalary"><k-icon name="briefcase-business" :size="14" color="muted" /><text>{{ jobSalary }}</text></view><k-chip v-if="jobSafe" tone="green"><k-icon name="shield-check" :size="12" color="green" /><text>安心商家</text></k-chip></view></view>
      <text class="section-title">设备检测</text>
      <view class="device card"><view v-for="item in devices" :key="item.label"><k-icon :name="item.icon" :size="18" color="muted" /><text>{{ item.label }}</text><view><text>未检测</text><k-icon name="circle-help" :size="14" color="muted" /></view></view></view>
      <text class="section-title">面试准备清单</text>
      <view class="checklist card"><view v-for="item in checklist" :key="item.label"><k-icon :name="item.icon" :size="18" color="muted" /><text>{{ item.label }}</text><view><text>请自行确认</text></view></view></view>
      <view class="lobby-actions"><k-button v-if="!tm || canFeedback" block :disabled="!canEnterVideo" :label="enterVideoText" @click="enterVideo" /><k-button block type="outline" :label="rescheduleText" @click="reschedule" /></view>
      <!-- 2026-11-03 主人：简化 —— 申请改期：可选时段做成页面内胶囊，点一个底部出「确认改到 …」按钮（原来弹底部菜单选时段、再弹一个确认框）；
           没有时段时页面内写明并给「联系当地主理人」；撤回报名从菜单里拿出来，单独一行文字钮（撤回是危险操作，仍保留一次确认） -->
      <view v-if="slotPanel" class="card slot-panel">
        <view class="slot-panel__head"><text class="slot-panel__title">申请改期</text><view class="slot-panel__close" hover-class="k-press" @click="closeSlots"><k-icon name="x" :size="18" color="muted" /></view></view>
        <text v-if="slotsLoading" class="slot-panel__hint">正在读取可选时段…</text>
        <template v-else-if="slots.length">
          <text class="slot-panel__hint">选一个门店还开放的时段，你还可以改期 {{ rescheduleLeft }} 次</text>
          <view class="slot-pills"><view v-for="x in slots" :key="x.slotId" class="slot-pill" :class="{ on: slotPick === x.slotId }" hover-class="k-press-s" @click="slotPick = x.slotId"><text>{{ fmtSlot(x.startTime) }}</text></view></view>
          <view v-if="slotPick" class="slot-panel__confirm"><text class="slot-panel__hint">原时段会放回可约池，门店会收到通知</text><k-button block :disabled="rescheduling" :label="rescheduling ? '提交中…' : '确认改到 ' + fmtSlot(pickedSlot.startTime)" @click="confirmReschedule" /></view>
        </template>
        <template v-else>
          <text class="slot-panel__hint">门店还没有放出其他面试时段，可以直接联系商家协商时间</text>
          <k-button block type="outline" label="联系商家" @click="contactStore" />
        </template>
      </view>
      <view v-if="canWithdraw" class="withdraw-link" hover-class="k-press" @click="withdraw"><text>撤回报名</text></view>
      <view class="help" @click="openHelp"><k-icon name="headphones" :size="14" color="muted" /><text>如需帮助，可联系商家或平台客服</text></view>
      <!-- 安全负责人、分享给亲友（2026-10-31）：约完面试后进度页会转到这一页，这里也要找得到。第 2 屏是视频示意、第 3 屏是问卷，不放 -->
      <safety-share v-if="appId && detail" compact :app-id="appId" :status="status" @ready="onTrip" />
    </view>

    <view v-else-if="s === 2" class="video-body">
      <view class="safe-tip"><k-icon name="shield-check" :size="18" color="red" /><text>视频通话未接入，本屏为流程示意</text></view><text class="video-time">{{ videoTimeText }}</text>
      <view class="video-panel"><image src="/static/media/cover-empty.png" mode="aspectFill" /><view class="video-name"><image src="/static/media/profile-avatar.jpg" mode="aspectFill" /><text>面试官（画面未接入）</text></view><view class="video-panel me-panel"><image src="/static/media/cover-empty.png" mode="aspectFill" /><view class="video-name"><image src="/static/media/profile-avatar.jpg" mode="aspectFill" /><text>我（画面未接入）</text><k-icon name="chart-no-axes-column-increasing" :size="12" color="green" /></view><view class="camera-flip"><k-icon name="camera" :size="20" color="white" /></view></view></view>
      <view class="video-controls"><view v-for="(item,i) in controls" :key="item.label" @click="onControl(i)"><view :class="{ light: i === 2, end: i === 3 }"><k-icon :name="item.icon" :size="28" color="white" /></view><text>{{ item.label }}</text></view></view>
    </view>

    <view v-else-if="s === 3" class="confirm-body k-pad-bottom">
      <view class="success-banner"><view class="banner-ico"><k-icon name="circle-check" :size="16" color="green" /></view><view><text>{{ confirmTitle }}</text><text>{{ confirmDesc }}</text></view></view>
      <view v-for="(group,gi) in confirmGroups" :key="group.title" class="confirm-group"><view class="confirm-title"><text>{{ gi + 1 }}</text><text>{{ group.title }}</text></view><text class="confirm-question">{{ group.question }}</text><view class="choice-card"><view v-for="(item,i) in group.choices" :key="item" :class="{ on: picks[gi] === i }" @click="pick(gi, i)"><k-icon name="circle" :art="picks[gi] === i ? 'radio-on' : 'circle'" :size="18" /><text>{{ item }}</text></view></view></view>
      <!-- 2026-11-03 主人：简化 —— 备注直接在框里写（原来点一下弹系统输入框）；不打字时用普通块显示，免得原生 textarea 盖住底部按钮 -->
      <view class="note-group"><view class="confirm-title"><text>4</text><text>备注（选填）</text></view><view class="note-box"><textarea v-if="editingNote" v-model="note" class="note-box__area" maxlength="200" :placeholder="noteHint" placeholder-class="k-placeholder" :focus="true" auto-focus @blur="note = $event.detail.value.trim().slice(0, 200); editingNote = false" /><view v-else class="note-box__idle" @click="editingNote = true"><text :class="{ 'k-placeholder': !note }">{{ note || noteHint }}</text></view><text>{{ note.length }}/200</text></view></view>
      <!-- 三个按钮各占一份等宽（k-button 是虚拟节点组件，宽度放外层 view 上） --><k-bottom pad="12px 16px"><view class="k-flex1"><k-button block type="outline" :disabled="submitting" label="不合适" @click="submitIntent('reject')" /></view><view class="k-flex1"><k-button block type="outline" :disabled="submitting" label="还想考虑" @click="submitIntent('pending')" /></view><view class="k-flex1"><k-button block :disabled="submitting" label="愿意前往" @click="submitIntent('accept')" /></view></k-bottom>
    </view>

    <view v-else class="progress-body k-pad-safe">
      <view class="success-banner"><view class="banner-ico"><k-icon name="circle-check" :size="16" color="green" /></view><view><text>{{ progressTitle }}</text><text>{{ progressDesc }}</text></view></view>
      <view class="steps-block"><text class="section-title">报名进度（共 {{ FLOW_STEPS.length }} 步）</text><job-flow-steps :end-enabled="status === 'onboarded' || status === 'completed'" @end="showWorkEnd" :current="flowCurrent" :arrival-enabled="canOpenArrival" compact @arrival="openArrival" /><text class="interview-flow__hint">{{ flowTip }}</text></view>
      <view v-if="appId && ['onboarded','completed'].includes(status)" id="work-end"><k-work-end :app-id="appId" :focus-on-load="focusWorkEnd" @focus="focusEndRecord" @updated="loadDetail()" /></view>
      <view class="confirm-cards"><view><text>您（应聘者）</text><view><view class="cc-ico"><k-icon :name="mineIcon" :size="16" :color="mineIconColor" /></view><text>{{ mineStatus }}</text></view><text>{{ mineTime }}</text></view><view><text>{{ storeCardName }}</text><view><view class="cc-ico"><k-icon :name="storeIcon" :size="16" :color="storeIconColor" /></view><text>{{ storeStatus }}</text></view><text>{{ storeTime }}</text></view></view>
      <view class="next card"><text class="section-title">下一步</text><text>{{ contractHint }}</text></view>
      <k-application-dates v-if="pageVisible && appId && detail && !renewalFirst" :app-id="appId" @navigate="leave" @updated="loadDetail(true)" /><k-bottom flat pad="12px 16px"><view class="k-flex1"><k-button block :disabled="!canOpenContract" icon="lock-keyhole" @click="openContract">{{ signBtnText }}</k-button></view></k-bottom>
    </view>
    <!-- 「联系客服」：AI袋鼠在本页底部弹出，不跳页 -->
    <k-ai-sheet :show="aiOpen" ctx="profile" @close="closeAi" />
  </view>
</template>

<script setup>
import { displayWording } from '@/common/display-wording.js'
import { serverTs, sheet, modal } from '@/common/ui.js'
// ---------------------------------------------------------------------------
// 本页接入情况（改一次就要同步改一次这段注释）：
//
// 已接后端（需要带 ?appId=，消息深链与进度页都会带）：
//   · 报名/面试详情      apiApplicationDetail(appId)
//   · 面试结果落库        apiFinishInterview(appId, { durationSeconds, 三组单选, feedbackNote })
//   · 面试后表态          apiConfirmIntent(appId, 'reject' | 'pending' | 'accept')
//   · 改期 / 撤回报名      apiRescheduleInterview / apiWithdrawApplication（候场页「申请改期」展开页面内时段面板、「撤回报名」文字钮，只对已约面试的报名开放）
//   · s=4 的双向确认进度、商家确认截止时间，全部来自上面的详情接口
//   · 会议信息（interview.meetingInfo）认得出腾讯会议号时，候场页一键拉起腾讯会议小程序（common/meeting.js），
//     认不出的旧文字照旧显示原文 + 复制
//   · 面试之前的状态、已撤回、线上任务不归本页，一律 redirectTo 回审核进度页（见 PROGRESS_PAGE）
//
// 仍未接入（页面上必须说明，不能装成已完成）：
//   · 视频通话本身 —— s=2 的两路画面、面试官姓名、静音/摄像头/扬声器都是静态示意
//   · s=1 的设备检测 —— 从没做过任何摄像头/麦克风检测，所以只能写"未检测"
//   · s=3 的备注 —— 2026-11-03 起是框里直接写的 textarea（不打字时用普通块显示），随问卷一起提交
//   · s=4 的责任书签署 —— 保险承担方、法律主体、实名认证（INTEGRATION.md 9.2 第 2/4/10 条）
//     都还没拍板，按钮保持 disabled
//
// 没有 appId 时是设计稿走查（?s=1..4 直达）：这条路径上一个请求都不发，
// 状态位一律留空或写明"设计稿走查"，不会显示任何像真实履约的内容。
// ---------------------------------------------------------------------------
import { absUrl } from '@/common/upload.js'
import { ref, computed, onUnmounted } from 'vue'
import { onShareAppMessage, onShow, onHide } from '@dcloudio/uni-app'
import { useScreen, back, go, replace, toast } from '@/common/screen.js'
import R from '@/common/routes.js'
import { apiApplicationDetail, apiJobDetail, apiFinishInterview, apiConfirmIntent, apiInterviewSlots, apiRescheduleInterview, apiWithdrawApplication } from '@/common/api.js'
import { parseTencentMeeting, groupCode, openTencentMeeting } from '@/common/meeting.js'
import { experience } from '@/common/experience.js'
import SafetyShare from './components/safety-share.vue'
import JobFlowSteps from './components/job-flow-steps.vue'
import ApplicationMessages from './components/application-messages.vue'
import { FLOW_STEPS, flowStepOf, flowHint } from './apply-flow.js'
import { jobShareFallback, tripShareMessage } from './trip-share.js'
const aiOpen = ref(false)

/** 没有对应后端接口的功能，统一回一句"未开放"，不能报"已提交/已保存" */
const notOpen = (what) => toast((what || '该功能') + '暂未开放')
const titles = ['面试候场','视频面试中','面试后确认','双向确认进度']
const devices = [{ icon:'camera',label:'摄像头' },{ icon:'mic',label:'麦克风' }]
const checklist = [{ icon:'sun',label:'选择安静明亮的环境' },{ icon:'wifi',label:'保证网络稳定（建议 Wi-Fi）' },{ icon:'camera-off',label:'关闭其他占用摄像头的应用' },{ icon:'user-round',label:'提前准备好个人介绍' }]
const controls = [{ icon:'mic',label:'静音' },{ icon:'video-off',label:'关闭摄像头' },{ icon:'volume-2',label:'扬声器' },{ icon:'phone-call',label:'结束面试' }]
const confirmGroups = [{ title:'岗位理解',question:'您对岗位的理解是否清晰？',choices:['理解清晰，符合预期','基本理解，部分需进一步沟通','不太清晰'] },{ title:'食宿条件确认',question:'您对商家提供的食宿条件是否满意？',choices:['满意，能够接受','基本满意，有一些顾虑','不满意，无法接受'] },{ title:'到岗日期确认',question:'您能否按约定时间到岗？',choices:['可以，按时到岗','可能调整，需要沟通','无法按时到岗'] }]
/** 设计稿第 1 屏的岗位卡片内容，只在"没有 appId 的设计走查"里用 */
const DESIGN_JOB = { cover:'/static/media/interview-cafe.jpg', title:'古城咖啡馆驻店伙伴', address:'大理古城 · 苍山路 88 号', salary:'120 元/天 · 月结' }

// ---------------------------------------------------------------------------
// 取数
// ---------------------------------------------------------------------------
const appId = ref(null)
const detail = ref(null)
const job = ref(null)
const explicitScreen = ref(false)
// 分享给亲友：读到行程发行程卡片，没读到（已结束）右上角转发发岗位详情
const trip = ref(null)
const onTrip = (value) => { trip.value = value }
onShareAppMessage(() => tripShareMessage(trip.value, jobShareFallback(detail.value?.jobId, detail.value?.jobTitle)))
// idle 没有 appId 不取数 / loading 取数中 / ready 拿到真实报名 / failed 请求失败或未登录
const loadState = ref('idle')
const loadError = ref('')

// 设计走查路径：显式带了 ?s= 又没有 appId，只有它能摆设计稿内容。
// 其余"没有真实报名"的情况（取数失败 / 未登录 / 压根没带 appId）都不能落到设计稿内容上，
// 否则用户会对着一份并不存在的面试点"愿意前往"
const designMode = computed(() => explicitScreen.value && !appId.value)
const status = computed(() => detail.value?.status || '')
const focusRenewal = ref(false)
const pageVisible = ref(true)
const renewalFirst = computed(() => detail.value?.jobType === 'volunteer' && (status.value === 'onboarded' || (focusRenewal.value && ['completed','terminated'].includes(status.value))))
// 和报名页、审核进度页共用七步流程，按真实状态高亮，不把候场当作已完成面试。
const showWorkEnd = () => uni.pageScrollTo({ selector: '#work-end', offsetTop: -88, duration: 220 })
function focusEndRecord(id) {
  if (!focusWorkEnd.value || String(appId.value) !== String(id)) return
  focusWorkEnd.value = false
  showWorkEnd()
}
const flowCurrent = computed(() => flowStepOf(status.value, detail.value?.workEndTime, detail.value?.arrivalStep))
const flowTip = computed(() => flowHint(detail.value?.workEndTime ? 'completed' : status.value, detail.value?.arrivalStep) || detail.value?.statusLabel || '当前进度以报名状态为准')

/** 真实报名进本页时落在哪一屏。设计稿 4 屏只覆盖面试及之后的状态 */
const SCREEN_BY_STATUS = {
  interview_booked: 1,
  interview_done: 3,
  user_confirmed: 4, store_confirmed: 4, contract_signed: 4, onboarded: 4, completed: 4, terminated: 4
}
// 面试之前的状态（待审核 / 待约面试 / 未通过）和已撤回的报名不归本页，转回审核进度页。
// 之前这些状态不在上表里，页面就停在第 1 屏候场：撤回之后倒计时照走，「申请改期」点下去被后端拒绝。
// 线上任务没有面试，无论什么状态都转回进度页（那边给交付入口）
const PROGRESS_PAGE = ['submitted', 'review_passed', 'review_rejected', 'withdrawn']

const loadJob = async () => {
  const jobId = detail.value?.jobId
  if (!jobId) return
  try {
    const res = await apiJobDetail(jobId)
    job.value = res?.data || null
  } catch (e) {
    // 岗位下架后详情接口会直接报错。候场页的岗位卡片是次要信息，
    // 取不到就留空，绝不能退回 DESIGN_JOB —— 那会把别人的岗位显示成用户报名的岗位
    job.value = null
  }
}

const meetingRefreshing = ref(false)
const meetingRefreshError = ref('')
const focusWorkEnd = ref(false)
let detailRequest = 0
const loadDetail = async (refreshOnly = false, manual = false) => {
  if (!appId.value) return
  const request = ++detailRequest
  const requestedApp = appId.value
  const uid = experience.account?.id
  const current = () => request === detailRequest && requestedApp === appId.value && uid === experience.account?.id
  meetingRefreshing.value = true
  meetingRefreshError.value = ''
  if (!refreshOnly) loadState.value = 'loading'
  try {
    const res = await apiApplicationDetail(requestedApp)
    if (!current()) return
    const updated = res?.data
    const preserveScreen = refreshOnly && detail.value && updated?.status === status.value
    detail.value = updated || null
    loadState.value = detail.value ? 'ready' : 'failed'
    loadError.value = detail.value ? '' : '没有找到这条报名记录'
    if (!detail.value) { s.value = 1; return }
    if (manual) toast('请核对下方的最新会议信息')
    if (preserveScreen) return
    if (detail.value.jobType === 'online' || PROGRESS_PAGE.indexOf(status.value) >= 0) {
      // redirectTo 替换本页：返回键回到消息 / 订单，而不是回到一个已经不适用的候场页
      replace(`${R.jobProgress}?appId=${appId.value}`)
      return
    }
    // 有真实报名时屏号只认真实 status：?s= 在这条路径上是设计走查残留，
    // 拿它盖掉真实状态会让 interview_booked 的报名显示成"已双向确认"。
    // 不认识的新状态落第 4 屏：那一屏只陈述状态，没有候场页的改期 / 撤回操作
    s.value = SCREEN_BY_STATUS[status.value] || 4
    landing = s.value
    if (interviewStartTs.value) startTick()
    loadJob()
  } catch (e) {
    if (!current()) return
    if (refreshOnly && ![401,403,404].includes(e?.code)) {
      meetingRefreshError.value = '刷新失败，请重试并与主理人核对会议号'
      return
    }
    if ([401,403,404].includes(e?.code)) { detail.value = null; job.value = null }
    loadState.value = 'failed'
    loadError.value = e?.message || '面试信息加载失败'
    toast(loadError.value)
    // 退回第 1 屏：另外三屏对着空数据只会说与事实不符的话
    if (!detail.value) s.value = 1
  } finally {
    if (request === detailRequest) meetingRefreshing.value = false
  }
}

const s = useScreen(4, {
  onLoad: (q) => {
    focusWorkEnd.value = q?.focus === 'workEnd'
    focusRenewal.value = q?.focus === 'renewal'
    appId.value = q?.appId || null
    explicitScreen.value = !!q?.s
    if (appId.value) s.value = 1
    landing = s.value
    loadDetail()
  }
})
// 候场页点「填写反馈」进第 3 屏后，之前左上角返回直接离开本页（问卷还没交），现在先回到进页时状态对应的那一屏
let landing = 0
const onBack = () => { if (landing && s.value !== landing) s.value = landing; else back() }
// 从本页去签约 / 会话 / 客服再回来时，之前一直显示离开前的状态（签完责任书回来按钮还是「签署责任书」）。
// 只在状态真的变了时才按新状态重新分流，没变就只换数据，不打断正在填的问卷
let awayToPage = false
const leave = (url) => { awayToPage = true; go(url) }
function refreshMeetingInfo(manual = false) {
  if (meetingRefreshing.value) return
  return loadDetail(true, manual)
}
// 外部腾讯会议和切后台同样触发刷新，避免继续使用主理人已更换的会议号。
onHide(() => { pageVisible.value = false; awayToPage = true; detailRequest++; meetingRefreshing.value = false })
onShow(async () => {
  pageVisible.value = true
  if (!awayToPage || !appId.value) return
  awayToPage = false
  await refreshMeetingInfo()
})
// 之前两屏底部「联系平台客服」只是一行字，点了没反应；已约面试后审核进度页会转到本页，本页又没有联系门店的入口，
// 页面却让用户"通过消息联系门店安排"。现在点这一行可选联系主理人（报名会话）或平台客服
const openHelp = async () => {
  const id = appId.value || detail.value?.appId
  const i = id ? await sheet(['联系商家', '联系平台客服']) : 1
  if (i === 0) leave(R.chat + '?appId=' + id)
  else if (i === 1) aiOpen.value = true
}
// 平台客服是本页底部弹出的 AI袋鼠；点了回答里的按钮跳走的，回来时和别的离开一样刷新一次进度
const closeAi = (why) => { aiOpen.value = false; if (why === 'nav') awayToPage = true }

// ---------------------------------------------------------------------------
// 时间
// ---------------------------------------------------------------------------
// 后端统一输出 'yyyy-MM-dd HH:mm:ss'。手工切分而不是交给 new Date() 解析：
// iOS 与部分小程序 WebView 不接受带空格的日期串，会得到 Invalid Date
const parseTime = (v) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})/.exec(String(v || ''))
  return m ? { y: +m[1], mo: +m[2], d: +m[3], hh: m[4], mm: m[5] } : null
}
const formatDateTime = (v) => {
  const t = parseTime(v)
  return t ? `${t.y}年${t.mo}月${t.d}日 ${t.hh}:${t.mm}` : ''
}
// 服务端时间是北京时间（不带时区）：必须按 +08:00 解析，按设备本地时区算的话，境外或改了时区的手机倒计时整体偏移
const toTs = (v) => serverTs(v) || 0
const pad2 = (n) => (n < 10 ? '0' + n : '' + n)
const hms = (sec) => {
  const x = Math.max(0, Math.floor(sec))
  return `${pad2(Math.floor(x / 3600))}:${pad2(Math.floor((x % 3600) / 60))}:${pad2(x % 60)}`
}

// 倒计时与通话计时都靠这一个秒表，只有真的需要走字时才启动
const now = ref(Date.now())
let timer = null
const startTick = () => {
  if (!timer) timer = setInterval(() => { now.value = Date.now() }, 1000)
}
onUnmounted(() => {
  detailRequest++
  if (timer) clearInterval(timer)
  timer = null
})

const interviewStartTs = computed(() => toTs(detail.value?.interview?.startTime))
const countdownText = computed(() => {
  // 没有真实面试时间就保持设计稿的占位符，不能算出一个看着像真的数字
  if (!interviewStartTs.value) return '--:--:--'
  return hms((interviewStartTs.value - now.value) / 1000)
})
const countdownSuffix = computed(() => (interviewStartTs.value && interviewStartTs.value <= now.value ? ' 面试时间已到' : ' 后开始'))
const lobbyHint = computed(() => {
  if (loadState.value === 'loading') return '正在读取面试信息…'
  if (loadState.value === 'failed') return loadError.value || '面试信息加载失败'
  if (detail.value) return interviewStartTs.value ? (tm.value ? '请按预约时间进入腾讯会议参加面试' : '请按预约时间参加面试，会议信息见下方') : '尚未预约面试时间'
  return designMode.value ? '设计稿走查，未读取真实面试时间' : '请从消息通知进入才能看到真实面试'
})

// ---------------------------------------------------------------------------
// 第 1 屏：面试岗位。真实报名走 apiJobDetail，拿不到就只留报名里带的岗位名
// ---------------------------------------------------------------------------
// 岗位封面只用真实岗位自己的图。取不到就不挂图 —— 拿设计稿那张咖啡馆照片兜底，
// 等于给用户看了一个别的岗位
const jobCover = computed(() => absUrl(job.value?.cover) || (designMode.value && !detail.value ? DESIGN_JOB.cover : ''))
const jobTitle = computed(() => {
  if (job.value) return job.value.title || ''
  if (detail.value) return detail.value.jobTitle || ''
  return designMode.value ? DESIGN_JOB.title : ''
})
const jobAddress = computed(() => {
  if (job.value) return [job.value.city, job.value.address].filter(Boolean).join(' · ')
  if (detail.value) return detail.value.storeName || ''
  return designMode.value ? DESIGN_JOB.address : ''
})
const jobSalary = computed(() => {
  if (job.value) return job.value.salaryText || ''
  if (detail.value) return ''
  return designMode.value ? DESIGN_JOB.salary : ''
})
// 安心商家是认证结果，没读到认证位就不挂这个章。
// 极性是 '0' 已认证 / '1' 未认证（kg_store.safe_cert 的注释，见 V1__kangaroo_core.sql）。
// 这里原本写的是 === '1'，正好判反：未认证的门店反而挂上了绿色认证章。
// detail.vue 里有一条注释说"之前 s=1 与 s=2 各判一次极性，s=2 判反了"——
// 同一个坑在这一页又踩了第三次，所以 scripts 里补了一条静态断言守住它。
const jobSafe = computed(() => {
  if (job.value) {
    const cert = job.value.safeCert === undefined || job.value.safeCert === null ? job.value.store?.safeCert : job.value.safeCert
    return String(cert) === '0'
  }
  return !detail.value && designMode.value
})

// ---------------------------------------------------------------------------
// 第 2 屏：视频通话没有后端，这里唯一真实的只有"在通话屏停留了多久"，
// 它就是 finish-interview 的 durationSeconds
// ---------------------------------------------------------------------------
const videoStartedAt = ref(0)
const videoEndedAt = ref(0)
const videoSeconds = computed(() => {
  if (!videoStartedAt.value) return 0
  return Math.max(0, Math.floor(((videoEndedAt.value || now.value) - videoStartedAt.value) / 1000))
})
const videoTimeText = computed(() => hms(videoSeconds.value))
// 没有真实报名（取数失败）或者压根没约上面试时，这条路只会走到"尚未预约面试"的报错，
// 不如直接禁用，别让用户先走一遍假的通话屏
// 面试改在会议里进行后，这个按钮只剩"复制会议信息"，第 2、3 屏再也进不去，
// 用户自己的面试问卷（finish-interview）就交不上了。后端只在 interview_booked 且预约开始时间已到时收问卷，
// 这里按同一条件把"填写反馈"放回来；会议信息仍然随时可复制
const canFeedback = computed(() => status.value === 'interview_booked' && interviewStartTs.value > 0 && interviewStartTs.value <= now.value)
// 面试走腾讯会议：认出会议号时入会 / 复制会议号都放在上方会议卡片里，随时一键可用（不因面试开始就藏进二级菜单）；
// 认不出的旧文字（链接等）照旧走下面这个按钮复制整段
const meetingInfo = computed(() => detail.value?.interview?.meetingInfo || '')
const tm = computed(() => parseTencentMeeting(meetingInfo.value))
const tmCode = computed(() => (tm.value ? groupCode(tm.value.code) : ''))
// 昵称只用来在会议里显示名字，取不到就不带，由腾讯会议自己处理
const joinMeeting = () => {
  if (meetingRefreshing.value) return toast('正在刷新会议信息，请稍后')
  if (!tm.value) return toast('会议信息尚未填写，请联系商家')
  return openTencentMeeting({ code: tm.value.code, pwd: tm.value.pwd, link: tm.value.link, nickname: experience.account?.nickname })
}
// 只有入会链接（没有会议号）时复制链接
const copyCode = () => uni.setClipboardData({ data: tm.value.code || tm.value.link })
// 微信复制后自己会提示「内容已复制」
const copyText = (data) => uni.setClipboardData({ data })
const canEnterVideo = computed(() => designMode.value || !!meetingInfo.value || canFeedback.value)
// 认出腾讯会议号时这个按钮只剩填写反馈（只在面试开始后显示）
const enterVideoText = computed(() => (tm.value ? '面试已结束，填写反馈' : canFeedback.value ? '会议信息 / 填写反馈' : '复制会议信息'))
const copyMeeting = () => uni.setClipboardData({ data: meetingInfo.value })
// 通话不在小程序里，没有可计的通话时长：videoStartedAt 留 0，提交时 durationSeconds 为 null
// 候场页很长，按钮在底部：之前切到问卷屏还停在原来的滚动位置，小屏手机上第 1 题和说明都在屏幕外，
// 用户没看到第 1 题就点了「愿意前往」，问卷只能交这一次。切屏后回到顶部
const toTop = () => uni.pageScrollTo({ scrollTop: 0, duration: 0, fail: () => {} })
const openFeedback = () => { videoStartedAt.value = 0; videoEndedAt.value = 0; s.value = 3; toTop() }
const enterVideo = () => {
  if (!designMode.value) {
    const meeting = meetingInfo.value
    if (tm.value) { if (canFeedback.value) openFeedback(); return }
    if (!canFeedback.value) { if (meeting) copyMeeting(); return }
    if (!meeting) return openFeedback()
    return uni.showActionSheet({ itemList: ['复制会议信息', '面试已结束，填写反馈'], success: ({ tapIndex }) => (tapIndex === 0 ? copyMeeting() : openFeedback()) })
  }
  if (!canEnterVideo.value) return toast('预约面试时间尚未开始')
  videoStartedAt.value = Date.now()
  videoEndedAt.value = 0
  now.value = Date.now()
  s.value = 2
  startTick()
}
const onControl = (i) => {
  if (i !== 3) return notOpen('视频面试功能')
  // 结束通话本身没有后端。面试结果（时长 + 三组单选）只能随
  // interview_booked -> interview_done 这一次流转写入，而这一步只允许发生一次，
  // 所以这里不抢先调 finish-interview，先把计时停住、带用户去填问卷，
  // 由第 3 屏的表态按钮一次性提交（否则问卷答案后端没有地方收）
  videoEndedAt.value = Date.now()
  s.value = 3
  toTop()
}

// ---------------------------------------------------------------------------
// 第 3 屏：面试后问卷 + 表态
// ---------------------------------------------------------------------------
// 默认一个都不选：写死选中第一项等于替用户答了题
const picks = ref([-1, -1, -1])
const pick = (gi, i) => { picks.value[gi] = i }
const choiceOf = (gi) => {
  const i = picks.value[gi]
  return i >= 0 ? confirmGroups[gi].choices[i] : null
}
// 问卷随"面试结束"这一次流转落库；门店先点了「标记结束」（面试已完成）而自己还没交过问卷的，也还能补交这一次（服务端同一口径）
const canSubmitQuestionnaire = computed(() => status.value === 'interview_booked'
  || (status.value === 'interview_done' && !!detail.value?.interview && detail.value.interview.feedbackSubmitted === false))
const confirmTitle = computed(() => {
  if (detail.value) return '面试后确认'
  return designMode.value ? '面试后确认（设计稿走查）' : '暂无可确认的面试'
})
const confirmDesc = computed(() => {
  if (canSubmitQuestionnaire.value) return '选择意向时会一并提交以上问卷'
  if (status.value === 'interview_done') return '面试结果已提交，以下选择不会再回传'
  if (detail.value) return '本次报名已进入下一步，这里不再接受提交'
  return designMode.value ? '设计稿走查，这里的选择不会提交' : '请从消息通知进入才能提交面试意向'
})
// 2026-11-03 主人：简化 —— 备注直接在框里写（原来点一下弹系统输入框）；提交时随问卷一起回传
const note = ref('')
const noteHint = '点这里写备注（选填，200 字以内）'
const editingNote = ref(false)

// ---------------------------------------------------------------------------
// 申请改期：换一个门店还开放的面试时段。
// 服务端的约束（开始前 2 小时内不能改、最多 2 次、时段必须仍空着）由它自己把关，
// 这里只负责把可选时段列出来并把选择发过去；改完门店会收到通知。
// ---------------------------------------------------------------------------
const rescheduling = ref(false)
const fmtSlot = (v) => {
  const d = new Date(String(v).indexOf('T') > 0 ? v : String(v).replace(/-/g, '/'))
  if (isNaN(d.getTime())) return String(v)
  const pad = (n) => (n < 10 ? '0' + n : '' + n)
  return (d.getMonth() + 1) + '月' + d.getDate() + '日 ' + pad(d.getHours()) + ':' + pad(d.getMinutes())
}
// 已约面试的报名只有候场页这一个入口（审核进度页会把它转过来），撤回报名也得放在这里，
// 否则 interview_booked → withdrawn 这条后端允许的流转在小程序里就没有地方发起了。
// 2026-11-03 主人：简化 —— 之前「申请改期 / 撤回报名」一个按钮弹菜单二选一；现在「申请改期」直接打开时段面板，撤回报名是下面单独一行文字钮
const canWithdraw = computed(() => status.value === 'interview_booked')
const rescheduleText = computed(() => (slotPanel.value ? '收起时段' : '申请改期'))
const withdraw = () => uni.showModal({
  title: '撤回报名',
  content: '撤回后需重新提交报名，确定撤回吗？',
  confirmColor: '#C04437', // 撤回是危险操作，用提醒红（= --k-alert）
  success: async (r) => {
    if (!r.confirm) return
    try {
      const res = await apiWithdrawApplication(appId.value)
      toast(res?.msg || '已撤回报名')
      // 撤回后按服务端的新状态重新分流（withdrawn 会转回审核进度页的终态屏）
      await loadDetail()
    } catch (e) {
      toast(e?.message || '撤回失败，请重试')
    }
  }
})
// 2026-11-03 主人：简化 —— 原来：点「申请改期 / 撤回报名」弹菜单 → 弹时段菜单（超过 6 个还分页）→ 弹确认框（3 个弹窗）；
// 现在：点「申请改期」在页面里展开时段面板（胶囊），点一个时段底部出「确认改到 …」按钮，点了直接提交（0 个弹窗）。
// 服务端的约束（开始前 2 小时内不能改、最多 2 次、时段必须仍空着）照旧由它自己把关
const slotPanel = ref(false)
const slots = ref([])
const slotsLoading = ref(false)
const slotPick = ref(0)
const pickedSlot = computed(() => slots.value.find(x => x.slotId === slotPick.value) || {})
const rescheduleLeft = computed(() => {
  const used = detail.value?.interview?.rescheduleCount || 0
  const limit = detail.value?.interview?.rescheduleLimit || 2
  return Math.max(0, limit - used)
})
const closeSlots = () => { slotPanel.value = false; slotPick.value = 0 }
// 没有可选时段时：进这条报名的门店会话找当地主理人
const contactStore = () => leave(R.chat + '?appId=' + (appId.value || detail.value?.appId))
const reschedule = () => (slotPanel.value ? closeSlots() : doReschedule())
const doReschedule = async () => {
  if (!appId.value) {
    toast(designMode.value ? '设计稿走查，没有可改期的面试' : '没有可改期的面试')
    return
  }
  // 只有已约面试的报名能改期：撤回 / 终止 / 面试已结束之后点下去必定被后端拒绝，不让用户去试
  if (status.value !== 'interview_booked') {
    toast(detail.value ? '当前状态不能改期' : (loadError.value || '面试信息加载失败'))
    return
  }
  if (slotsLoading.value) return
  slotPanel.value = true
  slotPick.value = 0
  slotsLoading.value = true
  try {
    const res = await apiInterviewSlots(appId.value)
    slots.value = (res.data || []).filter(x => x.slotId)
  } catch (e) {
    slotPanel.value = false
    toast((e && e.message) || '时段加载失败')
  } finally {
    slotsLoading.value = false
  }
}
const confirmReschedule = async () => {
  const slot = pickedSlot.value
  if (!slot.slotId || rescheduling.value) return
  rescheduling.value = true
  try {
    await apiRescheduleInterview(appId.value, slot.slotId, '')
    toast('面试已改期')
    closeSlots()
    await loadDetail()
  } catch (e) {
    toast((e && e.message) || '改期失败')
    if (e?.code === 409) {
      closeSlots()
      await loadDetail()
      if (loadState.value === 'ready' && status.value === 'interview_booked') await doReschedule()
    }
  } finally {
    rescheduling.value = false
  }
}

const submitting = ref(false)
const INTENT_MSG = { accept: '已确认愿意前往', pending: '已记录：还想考虑', reject: '已提交：不合适' }
const submitIntent = async (intent) => {
  if (!appId.value) {
    // 设计走查只保留"翻到下一屏看设计"的行为，不发请求也不报成功
    if (designMode.value && intent === 'accept') { s.value = 4; return }
    return toast(designMode.value ? '设计稿走查，未提交任何选择' : '没有可确认的面试')
  }
  if (submitting.value) return
  // 问卷只能随这一次表态落库：选「愿意前往 / 还想考虑」时还有题没答，先问一句（选「不合适」不拦）
  const unanswered = confirmGroups.filter((g, i) => picks.value[i] < 0).map(g => g.title)
  if (canSubmitQuestionnaire.value && intent !== 'reject' && unanswered.length) {
    const r = await modal('还有题没答', '「' + unanswered.join('」「') + '」还没选。问卷只能随这次一起提交，之后改不了，门店会据此安排录用。', { confirmText: '直接提交', cancelText: '去填写' })
    if (!r.confirm) { toTop(); return }
  }
  submitting.value = true
  try {
    if (canSubmitQuestionnaire.value) {
      await apiFinishInterview(appId.value, {
        durationSeconds: videoStartedAt.value ? videoSeconds.value : null,
        understandJob: choiceOf(0),
        acceptBoard: choiceOf(1),
        confirmArrival: choiceOf(2),
        feedbackNote: note.value
      })
    }
    await apiConfirmIntent(appId.value, intent)
    toast(INTENT_MSG[intent] || '已提交')
    // 停在哪一屏由服务端的新状态决定，不自己猜
    await loadDetail()
  } catch (e) {
    toast(e?.message || '提交失败，请重试')
  } finally {
    submitting.value = false
  }
}

// ---------------------------------------------------------------------------
// 第 4 屏：双向确认。全部读真实 status / confirmDeadline / 流转日志
// ---------------------------------------------------------------------------
const DONE_AFTER = ['user_confirmed', 'store_confirmed', 'contract_signed', 'onboarded']
const canOpenArrival = computed(() => !!detail.value && detail.value.jobType !== 'online' && ['contract_signed', 'onboarded', 'completed'].includes(status.value))
const openArrival = () => { if (canOpenArrival.value) go(R.jobContract + '?appId=' + appId.value + '&s=5') }

const progressTitle = computed(() => {
  if (detail.value) return detail.value.statusLabel || '双向确认进度'
  return designMode.value ? '双向确认流程示意' : '暂无可显示的进度'
})
const progressDesc = computed(() => {
  if (detail.value) return '以下进度来自本次报名'
  return designMode.value ? '设计稿走查，未接入真实报名' : '请从消息通知里的进度入口进入'
})

const logTime = (toStatus) => {
  const rows = detail.value?.logs || []
  for (let i = rows.length - 1; i >= 0; i--) {
    if (rows[i].toStatus === toStatus) return formatDateTime(rows[i].createTime)
  }
  return ''
}
const mineStatus = computed(() => {
  if (!detail.value) return '暂无状态'
  if (status.value === 'terminated') return detail.value.userIntent === 'reject' ? '已婉拒' : '已终止'
  if (DONE_AFTER.indexOf(status.value) >= 0) return '已确认前往'
  if (detail.value.userIntent === 'pending') return '还想考虑'
  if (status.value === 'interview_done') return '待确认'
  return detail.value.statusLabel || '暂无状态'
})
const mineIcon = computed(() => (DONE_AFTER.indexOf(status.value) >= 0 ? 'circle-check' : 'hourglass'))
const mineTime = computed(() => (detail.value ? logTime('user_confirmed') : ''))
// 商家名可能很长，卡片只有半屏宽，真实数据下不把名字塞进标题
const storeCardName = computed(() => (detail.value ? '商家' : designMode.value ? '商家（小鹿老板）' : '商家'))
const storeStatus = computed(() => {
  if (!detail.value) return '暂无状态'
  if (['store_confirmed', 'contract_signed', 'onboarded'].indexOf(status.value) >= 0) return '已确认录用'
  if (status.value === 'user_confirmed') return '待确认'
  if (status.value === 'terminated') return '已终止'
  return '暂无状态'
})
const storeIcon = computed(() => (['store_confirmed', 'contract_signed', 'onboarded'].indexOf(status.value) >= 0 ? 'circle-check' : 'hourglass'))
const storeTime = computed(() => (detail.value ? formatDateTime(detail.value.storeConfirmTime) : ''))
// 11-19 第五轮（纯展示）：状态小图标的颜色——已确认暖棕、等待中有状态赭色、暂无状态 / 已结束灰色；不动 mineIcon / storeIcon 的判断
const iconTone = (icon, text) => (icon === 'circle-check' ? 'red' : ['暂无状态', '已终止', '已婉拒'].indexOf(text) >= 0 ? 'muted' : 'ochre')
const mineIconColor = computed(() => iconTone(mineIcon.value, mineStatus.value))
const storeIconColor = computed(() => iconTone(storeIcon.value, storeStatus.value))

// 责任书签署早已接通（进 /pages/jobs/contract：阅读条款 → 签署留证 → 到店信息），商家确认录用后才可签
// 没有真实报名（设计走查 / 直接打开页面）时保持设计稿里「锁住」的样子：按钮禁用，不能因为没数据就变成可点
const canOpenContract = computed(() => !!detail.value && (status.value === 'store_confirmed' || status.value === 'contract_signed' || status.value === 'onboarded'))
const signBtnText = computed(() => (status.value === 'store_confirmed' ? '签署责任书' : (status.value === 'contract_signed' || status.value === 'onboarded' ? '查看责任书' : '商家确认录用后可签署')))
const contractHint = computed(() => (status.value === 'store_confirmed' ? '阅读并签署责任书后，继续订票与到店准备' : canOpenContract.value ? '查看责任书后，继续订票与到店准备' : '商家确认录用后，可以阅读并签署责任书'))
const openContract = () => {
  if (!detail.value) return toast('请从报名进度进入')
  if (!canOpenContract.value) return toast('商家确认录用后才可以签署')
  leave(R.jobContract + '?appId=' + (appId.value || detail.value.appId) + '&view=terms')
}
</script>

<style scoped lang="scss">
.meeting-help { padding: 0 2px 16px; border-bottom: 1px solid var(--k-line); margin: 0 0 18px; }
.meeting-help__title { display: block; font-size: 14px; font-weight: 600; }
.meeting-help .tm-hint { display: block; margin: 8px 0 12px; line-height: 1.7; }
.meeting-help__actions { display: flex; flex-wrap: wrap; gap: 10px; }
.meeting-help__error { display: block; font-size: 13px; line-height: 1.6; color: var(--k-alert); margin-bottom: 10px; }
.interview-messages { padding: 0 16px 12px; }
.interview-flow { margin: 8px 16px 0; padding: 12px 8px; border: 1px solid var(--k-line); border-radius: 16px; background: var(--k-paper); }
.interview-flow__head { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin: 0 6px 14px; font-size: 14px; font-weight: 650; }
.interview-flow__stage { padding: 3px 8px; border-radius: 6px; color: var(--k-red-deep); background: var(--k-paper2); font-size: 11px; font-weight: 500; }
.interview-flow__hint { display: block; margin: 12px 6px 0; padding-top: 10px; border-top: 1px solid var(--k-line); font-size: 12px; line-height: 1.6; color: var(--k-ink2); overflow-wrap: anywhere; }
.interview-page { font-family: var(--k-sans); }.video-page { min-height: 100vh; color: white; background: #121815; }.lobby,.confirm-body,.progress-body { padding: 10px 16px 18px; }.countdown,.card,.success-banner,.confirm-cards>view,.confirm-group .choice-card,.note-box { border: 1px solid var(--k-line); border-radius: 12px; background: rgba(253,251,247,.78); }
.countdown { height: 68px; display: grid; grid-template-columns: 86px 1fr; align-items: center; padding: 10px 14px; }.countdown>text:first-child { grid-row: 1/3; font-size: 16px; font-weight: 700; }.countdown>view text:first-child { color: var(--k-red); font: 700 24px/1 var(--k-sans); }.countdown>view text:last-child { font-size: 16px; }.countdown>text:last-child { color: var(--k-muted); font-size: 12px; }.section-title { display: block; margin: 12px 4px 7px; font-size: 17px; font-weight: 700; }.job { height: 116px; padding: 9px; border: 1px solid var(--k-line); border-radius: 12px; display: flex; }.job>image { width: 100px; height: 96px; border-radius: 9px; }.job>view { padding: 3px 0 0 12px; }.job__title { display: block; font-size: 17px; font-weight: 700; margin-bottom: 7px; }.job>view>view { display: flex; align-items: center; gap: 5px; color: var(--k-muted); font-size: 12px; margin: 5px 0; }.device,.checklist { padding: 0 12px; }.device>view,.checklist>view { display: flex; align-items: center; gap: 13px; border-bottom: 1px solid var(--k-line); }.device>view:last-child,.checklist>view:last-child { border-bottom: 0; }.device>view { height: 50px; font-size: 15px; }.checklist>view { height: 35px; font-size: 12px; }.device>view>view,.checklist>view>view { margin-left: auto; display: flex; align-items: center; gap: 6px; color: var(--k-green); }.lobby-actions { margin-top: 14px; display: grid; gap: 8px; }.help { margin-top: 14px; display: flex; align-items: center; justify-content: center; gap: 8px; color: var(--k-muted); font-size: 12px; }
.video-body { background: #121815; }.safe-tip { height: 38px; margin: 0 16px; padding: 0 12px; border: 1px solid #6E5C3A; border-radius: 10px; background: #322A1E; display: flex; align-items: center; gap: 9px; color: #F1E5CD; font-size: 12px; }.video-time { display: flex; height: 35px; align-items: center; justify-content: center; font: 18px var(--k-sans); }.video-panel { position: relative; height: 225px; margin: 0 12px 5px; overflow: hidden; border-radius: 11px; border: 1px solid rgba(255,255,255,.35); }.video-panel>image { width: 100%; height: 225px; }.me-panel { height: 238px; }.me-panel>image { width: 100%; height: 238px; }.video-name { position: absolute; left: 8px; bottom: 8px; height: 31px; padding: 0 10px 0 4px; border-radius: 16px; background: rgba(20,20,18,.68); display: flex; align-items: center; gap: 6px; font-size: 12px; }.video-name image { width: 25px; height: 25px; border-radius: 50%; }.camera-flip { position: absolute; right: 10px; bottom: 10px; width: 47px; height: 47px; border-radius: 50%; background: rgba(255,255,255,.92); display: flex; align-items: center; justify-content: center; }.video-controls { height: 129px; display: flex; align-items: center; justify-content: space-around; background: #0E1311; }.video-controls>view { width: 25%; display: flex; flex-direction: column; align-items: center; gap: 8px; font-size: 12px; }.video-controls>view>view { width: 52px; height: 52px; border: 1px solid #85908B; border-radius: 50%; display: flex; align-items: center; justify-content: center; }.video-controls>view>view.light { background: white; }.video-controls>view>view.end { background: var(--k-red); border-color: var(--k-red); }
.confirm-body { padding-bottom: calc(82px + var(--k-safe-bottom)); }.success-banner { padding: 12px; display: flex; align-items: center; gap: 10px; background: var(--k-green-soft); }.success-banner>view { display: flex; flex-direction: column; gap: 4px; }.success-banner>view text:first-child { color: var(--k-green); font-size: 15px; font-weight: 700; }.success-banner>view text:last-child { color: var(--k-muted); font-size: 11px; }.confirm-group { margin-top: 12px; }.confirm-title { display: flex; align-items: center; gap: 8px; font-size: 16px; font-weight: 700; }.confirm-title>text:first-child { width: 24px; height: 24px; border-radius: 50%; background: var(--k-red); color: white; display: flex; align-items: center; justify-content: center; }.confirm-question { display: block; margin: 7px 8px; color: var(--k-muted); font-size: 12px; }.choice-card { padding: 6px 12px; }.choice-card>view { height: 30px; display: flex; align-items: center; gap: 10px; font-size: 13px; }.choice-radio { width: 18px; height: 18px; border: 1.5px solid var(--k-line2); border-radius: 50%; display: flex; align-items: center; justify-content: center; }.choice-radio.active { border-color: var(--k-green); }.choice-radio.active>view { width: 9px; height: 9px; border-radius: 50%; background: var(--k-green); }.note-group { margin-top: 12px; }.note-box { height: 72px; margin-top: 8px; padding: 10px; display: flex; flex-direction: column; justify-content: space-between; color: var(--k-light); font-size: 11px; }.note-box text:last-child { align-self: flex-end; }.confirm-body :global(.k-bottom__inner) { grid-template-columns: repeat(3,1fr); }
.progress-body { padding-bottom: calc(20px + var(--k-safe-bottom)); }.confirm-cards { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-top: 12px; }.confirm-cards>view { height: 95px; padding: 11px 13px; display: flex; flex-direction: column; }.confirm-cards>view>view { display: flex; align-items: center; gap: 8px; margin-top: 8px; font-size: 16px; font-weight: 700; color: var(--k-green); }.confirm-cards>view:nth-child(2)>view { color: var(--k-ochre); }.confirm-cards>view>text:last-child { margin-top: auto; color: var(--k-muted); font-size: 11px; }.steps-block { margin-top: 16px; }.steps { display: flex; align-items: flex-start; }.steps>view { position: relative; flex: 1; display: flex; flex-direction: column; align-items: center; gap: 5px; text-align: center; color: var(--k-muted); font-size: 10px; }.step-dot { width: 23px; height: 23px; border: 1px solid var(--k-line2); border-radius: 50%; background: var(--k-paper); display: flex; align-items: center; justify-content: center; z-index: 2; }.step-dot.done { background: var(--k-green); border-color: var(--k-green); color: white; }.step-line { position: absolute; left: 63%; top: 11px; width: 75%; height: 2px; background: var(--k-line2); }.step-line.done { background: var(--k-green); }.deadline { margin-top: 14px; padding: 9px 12px; }.deadline>.section-title { margin: 0 0 6px; }.deadline>view { display: flex; align-items: center; gap: 7px; font-size: 12px; }.deadline>view text:nth-of-type(2) { margin-left: auto; color: var(--k-red); }.deadline>text:last-child { display: block; margin-top: 6px; color: var(--k-muted); font-size: 11px; }.notice-title { margin-top: 14px; }.notice { padding: 0 10px; }.notice>view { min-height: 56px; display: flex; align-items: center; border-bottom: 1px solid var(--k-line); }.notice>view:last-child { border-bottom: 0; }.notice image { width: 36px; height: 36px; border-radius: 50%; margin-right: 8px; }.notice>view>view { flex: 1; }.notice>view>view>view { display: flex; align-items: center; gap: 5px; font-weight: 700; }.notice>view>view>text { display: block; color: var(--k-muted); font-size: 11px; }.notice>view>text { color: var(--k-muted); font-size: 10px; }.next { margin-top: 12px; padding: 10px 12px; }.next>.section-title { margin: 0; }.next>text { display: block; margin: 4px 0 8px; color: var(--k-muted); font-size: 11px; }.next>view { margin-top: 8px; display: flex; justify-content: center; align-items: center; color: var(--k-indigo); }
/* 候场页底部没有固定栏，但要让出 iPhone 底部横条；岗位名 / 地址太长时一行省略，卡片是固定高度 */
.lobby { padding-bottom: calc(18px + var(--k-safe-bottom)); }
.job>view { flex: 1; min-width: 0; }
.job__title, .job>view>view>text { overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
.job>view>view>text { min-width: 0; }
/* 会议卡片：会议号、密码用大号数字，方便对着手输；入会按钮放在号码正下方 */
.meeting-card { margin-top: 12px; padding: 14px; font-size: 14px; line-height: 1.7; white-space: pre-wrap; overflow-wrap: anywhere; }
.tm-title { display: block; font-size: 15px; font-weight: 700; }
.tm-row { display: flex; align-items: baseline; gap: 12px; margin-top: 4px; color: var(--k-muted); font-size: 13px; }
.tm-copy { margin-left: auto; flex-shrink: 0; color: var(--k-red); }
.tm-link { flex: 1; min-width: 0; color: var(--k-ink); overflow-wrap: anywhere; }
.tm-code { color: var(--k-ink); font: 700 22px/1.3 var(--k-sans); letter-spacing: 1px; }
.tm-note { display: block; margin-top: 6px; overflow-wrap: anywhere; }
.tm-actions { margin-top: 12px; display: grid; gap: 8px; }
.tm-hint { display: block; margin-top: 8px; color: var(--k-muted); font-size: 12px; }
.video-panel { height: 252px; }.video-panel>image { height: 252px; }.me-panel { height: 273px; }.me-panel>image { height: 273px; }.video-controls { height: 140px; }
/* 2026-11-03 主人：简化 —— 改期时段面板（页面内胶囊 + 底部确认钮）、撤回报名文字钮、备注输入框 */
.slot-panel { margin-top: 10px; padding: 12px 14px 14px; display: flex; flex-direction: column; gap: 10px; }
.slot-panel__head { display: flex; align-items: center; justify-content: space-between; }
.slot-panel__title { font-size: 16px; font-weight: 700; }
.slot-panel__close { width: 44px; height: 44px; margin: -12px -14px -12px 0; display: flex; align-items: center; justify-content: center; }
.slot-panel__hint { font-size: 13px; line-height: 1.6; color: var(--k-muted); }
.slot-pills { display: flex; flex-wrap: wrap; gap: 8px; }
.slot-pill { min-height: 44px; padding: 0 14px; border: 1px solid var(--k-line2); border-radius: 999px; background: var(--k-paper); font-size: 14px; display: flex; align-items: center; }
.slot-pill.on { border-color: #C9935F; background: #F6EBDD; color: #8A5A30; font-weight: 600; }
.slot-panel__confirm { display: flex; flex-direction: column; gap: 8px; }
.withdraw-link { min-height: 44px; margin-top: 4px; display: flex; align-items: center; justify-content: center; color: var(--k-alert); font-size: 14px; }
.note-box { height: auto; min-height: 72px; color: var(--k-ink); }
.note-box__area, .note-box__idle { width: 100%; min-height: 48px; font-size: 13px; line-height: 1.6; color: var(--k-ink); }
.note-box__idle { white-space: pre-wrap; word-break: break-all; }
.note-box>text:last-child { margin-top: 6px; color: var(--k-light); }
/* 2026-11-18 看图评审（第 2 屏「视频面试中」示意）：上下两块画面区原来是亮米色底 + 一个很大的通用「图片」占位图，压在近黑的页面上很刺眼，像图片没加载出来。
   画面没接入时改成比页面稍亮一点的深灰绿底，中间一个 40 的「摄像头关闭」线条小图（图标库里的 video-off，写成内嵌图）；那张通用占位图是纯装饰，收成透明。
   左下角的名字条（写着「画面未接入」）、右下角的翻转镜头照旧。 */
.video-panel { border-color: rgba(255, 255, 255, .1); background: #1E2622 url("data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgc3Ryb2tlPSIjN0U4QTg0IiBzdHJva2Utd2lkdGg9IjEuNCIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIj48cGF0aCBkPSJNMTAuNjYgNkgxNGEyIDIgMCAwIDEgMiAydjIuNWw1LjI0OC0zLjA2MkEuNS41IDAgMCAxIDIyIDcuODd2OC4xOTYiIC8+PHBhdGggZD0iTTE2IDE2YTIgMiAwIDAgMS0yIDJINGEyIDIgMCAwIDEtMi0yVjhhMiAyIDAgMCAxIDItMmgyIiAvPjxwYXRoIGQ9Im0yIDIgMjAgMjAiIC8+PC9zdmc+") center / 40px 40px no-repeat; }
.video-panel > image { opacity: 0; }
.video-name { background: rgba(255, 255, 255, .1); color: rgba(255, 255, 255, .86); }
@import "flow-premium.scss";
/* ==== r3jobsb 第三轮 start ==== */
/* 第三轮（11-18）：清单右侧「⊖」像删除键，换成空心圆（待确认）；没会议信息时那两行字做成浅棕提示块；
   描边按钮统一次按钮样子（flow-premium）；问卷底部「不合适 / 还想考虑」固定 88 宽，「愿意前往」占满剩下的；视频屏挂断键用提醒红。 */
.interview-page .lobby { padding-top: 8px; }
.interview-page .section-title { display: block; margin: 20px 4px 10px; }
.interview-page .job { padding: 12px; }
.interview-page .job > view > view { gap: 4px; font-size: 12px; color: var(--k-muted); }

/* flow-premium 里 .lobby .card 是白底，这里要同样具体才盖得住 */
.interview-page .lobby .meeting-card--plain { padding: 12px; background: var(--k-red-soft); }
.interview-page .meeting-card--plain > text:first-child { display: block; font-size: 13px; font-weight: 600; line-height: 1.6; color: var(--k-ink); }
.interview-page .meeting-card--plain .tm-hint { display: block; margin-top: 4px; font-size: 12px; line-height: 1.6; color: var(--k-muted); }
.interview-page .meeting-help { padding: 16px; }
.interview-page .meeting-help__title { font-size: 14px; }
.interview-page .meeting-help .tm-hint { font-size: 12px; }
.interview-page .meeting-help__actions :deep(.k-button) { height: 36px; padding: 0 16px; border-radius: 18px; font-size: 13px; }
.interview-page .device, .interview-page .checklist { padding: 0 16px; }
.interview-page .device > view, .interview-page .checklist > view { gap: 10px; }
.interview-page .device > view > view, .interview-page .checklist > view > view { gap: 4px; font-size: 12px; color: var(--k-muted); }

.interview-page .lobby-actions { margin-top: 20px; gap: 8px; }
.interview-page .lobby-actions :deep(.k-button) { height: 44px; border-radius: 22px; font-size: 15px; }
.interview-page .help { margin-top: 16px; gap: 4px; font-size: 12px; }
/* 问卷 */
.interview-page .confirm-body { padding-top: 8px; }
.interview-page .confirm-group { margin-top: 20px; }
.interview-page .confirm-title { padding-left: 4px; }
.interview-page .confirm-question { margin: 4px 4px 10px; font-size: 12px; color: var(--k-muted); }
.interview-page .confirm-group .choice-card { padding: 4px 16px; }
.interview-page .choice-card > view { min-height: 44px; gap: 10px; font-size: 14px; }
.interview-page .confirm-body .k-flex1:not(:last-child) { flex: 0 0 88px; }
.interview-page .confirm-body .k-flex1:not(:last-child) :deep(.k-button) { padding: 0 8px; font-size: 14px; }
/* 双向确认进度 */
.interview-page .progress-body { padding-top: 8px; }
/* 视频屏（深色气氛保留）：挂断键用提醒红 */
.interview-page .video-controls > view > view.end { background: var(--k-alert); border-color: var(--k-alert); }

/* —— 返修 1 —— */
/* 准备清单右侧不再放空心圆（不能点，像假复选框），改成 12 号说明小字 + 前面 12 号提示图标 */

/* 区块标题 / 题号标题 / 题目说明和下面白卡左边对齐（不再多缩 4） */
.interview-page .section-title { margin-left: 0; margin-right: 0; }
.interview-page .confirm-title { padding-left: 0; }
.interview-page .confirm-question { margin-left: 0; margin-right: 0; }
/* —— 返修 2 start —— */
/* 候场页几张卡内边距统一 16（倒计时、岗位、会议提示和设备检测、准备清单字的左边对齐） */
.interview-page .countdown { padding-left: 16px; padding-right: 16px; }
.interview-page .job { padding: 16px; }
.interview-page .lobby .meeting-card, .interview-page .lobby .meeting-card--plain { padding: 16px; }
/* 「安心商家」小标签：图标 12、字 11 */
.interview-page .job > view > :deep(.k-chip) { font-size: 11px; }

/* 会议提示两段字不留一个字单独折行 */
.interview-page .meeting-card--plain > text { text-wrap: pretty; }
/* 问卷第 4 题标题和前三题一样隔 20 */
.interview-page .note-group { margin-top: 20px; }
@media (max-width: 359px) {
  /* 320 宽：准备清单右边只留「请自行确认」11 号字，左边每行一行写完 */
  .interview-page .checklist > view > view :deep(.k-icon) { display: none; }
  .interview-page .checklist > view > view { font-size: 11px; }
  .interview-page .checklist > view > text { font-size: 13px; }
}
/* —— 返修 2 end —— */
/* —— 返修 3 start（11-18 晚）—— */
/* 整条报名流程页边距 16、卡内 16 */
.interview-page .lobby, .interview-page .confirm-body, .interview-page .progress-body { padding-left: 16px; padding-right: 16px; }
.interview-page .interview-flow { margin-left: 16px; margin-right: 16px; }
.interview-page .interview-messages { padding-left: 16px; padding-right: 16px; }
.interview-page .card, .interview-page .meeting-card, .interview-page .meeting-help, .interview-page .slot-panel, .interview-page .success-banner { padding-left: 16px; padding-right: 16px; }
.interview-page .job { padding: 12px 16px; }
/* s=1 候场：倒计时是这一屏的焦点——居中排，12 灰「面试将于」→ 28/700 等宽暖棕数字 → 12 灰说明 */
.interview-page .countdown { height: auto; display: flex; flex-direction: column; align-items: center; padding: 20px 16px; text-align: center; }
.interview-page .countdown > text:first-child { font-size: 12px; font-weight: 400; line-height: 18px; color: var(--k-muted); }
.interview-page .countdown > view { display: flex; align-items: baseline; justify-content: center; gap: 4px; margin-top: 4px; }
.interview-page .countdown > view > text:first-child { font-size: 28px; font-weight: 700; line-height: 36px; font-variant-numeric: tabular-nums; color: var(--k-red-deep); }
.interview-page .countdown > view > text:last-child { font-size: 13px; color: var(--k-ink2); }
.interview-page .countdown > text:last-child { margin-top: 4px; font-size: 12px; line-height: 18px; color: var(--k-muted); }
/* s=4 双向确认：禁用按钮挪到底栏；两张状态卡 88 高、40 浅棕方块 + 22 图标，卡间 12 */
.interview-page .progress-body { padding-bottom: calc(92px + var(--k-safe-bottom)); }
.interview-page .progress-body :deep(.k-bottom) { border-top: 0; }
.interview-page .confirm-cards { gap: 12px; margin-top: 12px; }
.interview-page .confirm-cards > view { height: auto; min-height: 88px; padding: 16px; }
.interview-page .confirm-cards > view > view { display: flex; align-items: center; gap: 8px; margin-top: 8px; }
.interview-page .cc-ico { flex: 0 0 auto; width: 40px; height: 40px; border-radius: 12px; background: var(--k-red-soft); display: flex; align-items: center; justify-content: center; }
.interview-page .next { margin-top: 12px; padding: 16px; }
.interview-page .steps-block { padding: 16px; }
/* s=3 问卷：选中行浅棕底 + 500 字；单选圈 20 */
.interview-page .choice-radio { width: 20px; height: 20px; box-sizing: border-box; }
/* —— 返修 3 end —— */
/* —— 返修 4 start（11-18 夜）—— */
/* s=1：会议提示说明限宽，在「会议号后」处折行，不剩「进入。」单独一行 */
.interview-page .meeting-card--plain .tm-hint { max-width: 246px; }
/* s=1 倒计时：数字和「后开始」同一行居中对齐，「后开始」14/500 */
.interview-page .countdown > view { align-items: center; }
.interview-page .countdown > view > text:last-child { font-size: 14px; font-weight: 500; line-height: 20px; }
/* s=2 视频示意：面试官画面占满中间区域（圆角 12），「我」是右下角 120×160 小窗，翻转镜头钮挪到小窗左下；名字条移到大画面左上 */
.interview-page .video-panel:not(.me-panel) { height: calc(100vh - 330px); min-height: 320px; margin: 0 16px 12px; border-radius: 12px; }
.interview-page .video-panel:not(.me-panel) > image { height: 100%; }
.interview-page .video-panel:not(.me-panel) > .video-name { top: 8px; bottom: auto; }
.interview-page .me-panel { position: absolute; right: 12px; bottom: 12px; z-index: 2; width: 120px; height: 160px; margin: 0; overflow: visible; border-radius: 12px; border-color: var(--k-ink2); background-size: 24px 24px; }
.interview-page .me-panel > image { height: 100%; border-radius: 12px; }
.interview-page .me-panel .video-name { left: 4px; right: 4px; bottom: 4px; height: 24px; padding: 0 4px; gap: 2px; border-radius: 12px; font-size: 11px; white-space: nowrap; }
.interview-page .me-panel .video-name > image:first-child { display: none; } /* 11-18 微信核对：只藏头像，后面的信号小图标（k-icon 在微信里也是 image）要留着 */
.interview-page .me-panel .camera-flip { right: auto; left: -52px; bottom: 0; width: 40px; height: 40px; }
/* s=3 问卷：选中的选项浅棕底 + 500 字；底栏三个按钮间距 8 */
.interview-page .choice-card > view.on { margin: 0 -8px; padding: 0 8px; border-radius: 8px; background: var(--k-red-soft); font-weight: 500; }
.interview-page .confirm-body :deep(.k-bottom__inner) { gap: 8px; }
/* s=3 / s=4 浅绿横幅：和签约页「已投保」同一种——40 白方块 + 24 图标，标题 16/600，说明 12 */
.interview-page .success-banner { gap: 12px; padding: 16px; align-items: center; }
.interview-page .success-banner > .banner-ico { flex: 0 0 40px; width: 40px; height: 40px; border-radius: 12px; background: var(--k-paper); display: flex; flex-direction: row; align-items: center; justify-content: center; }
.interview-page .success-banner > view:last-child { flex: 1; min-width: 0; gap: 2px; }
.interview-page .success-banner > view:last-child > text:first-child { font-size: 16px; font-weight: 600; line-height: 22px; color: var(--k-green); }
.interview-page .success-banner > view:last-child > text:last-child { font-size: 12px; line-height: 18px; color: var(--k-ink2); word-break: keep-all; overflow-wrap: anywhere; }
/* s=4：「报名进度」卡标题和下面几张卡的文字同一条左线（卡内 16，不再多缩 6） */
.interview-page .steps-block > .section-title { margin: 0 0 12px; }
/* —— 返修 4 end —— */
/* —— 返修 5 start（11-18 深夜）—— */
/* 准备清单右边只留「请自行确认」12 号浅灰字，不再每行一个提示图标 */
.interview-page .checklist > view > view { font-size: 12px; color: var(--k-light); }
/* 没有会议信息的横幅：两三行均分，「安排。」不单独掉行 */
.interview-page .meeting-card--plain > text:first-child { text-wrap: balance; }
/* 视频面试：4 个控制钮同一种描边圆 + 白图标（扬声器不再是白色实心，像被选中），只有「结束面试」是提醒红实心 */
.interview-page .video-controls > view > view.light { background: transparent; }
/* 面试后问卷：没选的圆圈 18、浅灰边，一眼看出能点；选中暖棕实心 + 白点 */
.interview-page .choice-radio { width: 18px; height: 18px; border: 1.5px solid var(--k-light); background: var(--k-paper); }
.interview-page .choice-radio.active { border-color: var(--k-red); background: var(--k-red); }
.interview-page .choice-radio.active > view { width: 6px; height: 6px; background: var(--k-paper); }
/* 报名进度卡：说明和分隔线回到卡片内边距那条线 */
.interview-page .steps-block .interview-flow__hint { margin-left: 0; margin-right: 0; }
/* —— 返修 5 end —— */
/* ==== r3jobsb 第四轮 start（11-18 夜，以微信实拍为准）==== */
/* s=1 倒计时做首屏主角：32/600 等宽数字，「后开始」放下一行 */
.interview-page .countdown { padding: 24px 16px; }
.interview-page .countdown > view { flex-direction: column; align-items: center; gap: 4px; margin-top: 8px; }
.interview-page .countdown > view > text:first-child { font-size: 32px; font-weight: 600; line-height: 40px; letter-spacing: 1px; color: var(--k-ink); font-variant-numeric: tabular-nums; }
.interview-page .countdown > view > text:last-child { font-size: 13px; font-weight: 400; line-height: 18px; color: var(--k-muted); }
.interview-page .countdown > text:last-child { margin-top: 8px; }
/* 会议提醒：不再是全屏最重的米棕色块，改成白卡 + 14/600 标题 + 13 灰说明 */
.interview-page .lobby .meeting-card--plain { background: var(--k-paper); }
.interview-page .meeting-card--plain > text:first-child { font-size: 14px; font-weight: 600; line-height: 22px; }
.interview-page .meeting-card--plain .tm-hint { max-width: none; margin-top: 4px; font-size: 13px; line-height: 1.6; word-break: keep-all; overflow-wrap: anywhere; }
/* 设备检测和准备清单同一种列表：行高 52，行间发丝线（左起文字、右止内边距） */
.interview-page .device > view, .interview-page .checklist > view { position: relative; min-height: 52px; border: 0; }
.interview-page .device > view + view::before, .interview-page .checklist > view + view::before { content: ''; position: absolute; left: 28px; right: 0; top: 0; height: 1px; background: var(--k-line); transform: scaleY(.5); transform-origin: 0 0; }
.interview-page .checklist > view { border-top: 0; border-bottom: 0; background-image: none; }
/* 底部两颗按钮左右并排：申请改期（次按钮）在左占 1 份，主按钮占 2 份 */
.interview-page .lobby-actions { display: flex; flex-direction: row; align-items: center; gap: 12px; }
.interview-page .lobby-actions :deep(.k-button) { flex: 1 1 0; min-width: 0; width: auto; height: 44px; border-radius: 22px; font-size: 15px; }
.interview-page .lobby-actions :deep(.k-button.is-primary) { flex-grow: 2; }
.interview-page .lobby-actions :deep(.k-button.is-outline) { order: -1; border-color: var(--k-red-line); background: var(--k-paper); color: var(--k-red-deep); }
/* s=2 视频：计时 16/600 等宽；翻转镜头和控制钮同款（透明底 + 细边 + 白图标）；自拍小窗的头像放回来（16 圆） */
.interview-page .video-time { font-size: 16px; font-weight: 600; font-variant-numeric: tabular-nums; }
.interview-page .camera-flip { background: transparent; border: 1px solid var(--k-light); box-shadow: none; }
.interview-page .me-panel .video-name { padding: 0 6px; gap: 4px; }
.interview-page .me-panel .video-name > image:first-child { display: block; flex: 0 0 16px; width: 16px; height: 16px; border-radius: 50%; }
/* s=3、s=4 走查提示：一行小字（绿色勾 + 13/600 标题 + 12 灰说明），不加底卡 */
.interview-page .success-banner { margin: 0; padding: 4px 0; gap: 6px; align-items: flex-start; border-radius: 0; background: transparent; }
.interview-page .success-banner > .banner-ico { flex: 0 0 16px; width: 16px; height: 20px; border-radius: 0; background: none; }
.interview-page .success-banner > view:last-child { flex-direction: row; flex-wrap: wrap; align-items: baseline; gap: 0 8px; }
.interview-page .success-banner > view:last-child > text:first-child { font-size: 13px; font-weight: 600; line-height: 20px; }
.interview-page .success-banner > view:last-child > text:last-child { font-size: 12px; line-height: 20px; color: var(--k-muted); }
/* s=3 题号：浅棕底 + 深棕字，不再是 4 个实心暖棕圆 */
.interview-page .confirm-title > text:first-child { background: var(--k-red-soft); color: var(--k-red-deep); font-size: 12px; font-weight: 600; }
/* s=3 底栏：主按钮占满一行在上，「不合适 / 还想考虑」做成下面并排的文字按钮 */
.interview-page .confirm-body { padding-bottom: calc(116px + var(--k-safe-bottom)); }
.interview-page .confirm-body :deep(.k-bottom__inner) { flex-wrap: wrap; gap: 4px 12px; padding: 8px 16px 4px !important; }
.interview-page .confirm-body .k-flex1 { flex: 1 1 0; }
.interview-page .confirm-body .k-flex1:last-child { flex: 0 0 100%; order: -1; }
.interview-page .confirm-body .k-flex1 :deep(.k-button.is-outline) { height: 36px; border-color: transparent; background: transparent; font-size: 14px; font-weight: 500; color: var(--k-ink2); }
/* s=4 两张「暂无状态」合成一张两列卡，中间竖发丝线；状态 14/500 灰字 + 16 号图标，不加底 */
.interview-page .confirm-cards { gap: 0; margin-top: 12px; border-radius: 12px; background: var(--k-paper); }
.interview-page .confirm-cards > view { position: relative; min-height: 0; padding: 16px; border-radius: 0; background: transparent; }
.interview-page .confirm-cards > view + view::before { content: ''; position: absolute; left: 0; top: 16px; bottom: 16px; width: 1px; background: var(--k-line); transform: scaleX(.5); transform-origin: 0 0; }
.interview-page .cc-ico { flex: 0 0 16px; width: 16px; height: 16px; border-radius: 0; background: none; }
.interview-page .confirm-cards > view > view > text { font-size: 14px; font-weight: 500; color: var(--k-ink2); }
.interview-page .progress-body .steps-block { margin-top: 12px; }
/* ==== r3jobsb 第四轮 end ==== */
/* ==== r3jobsb 第四轮返修 start（11-19，复评遗留）==== */
/* s=1 设备检测：去掉 flow-premium 留下的整行底线（从卡内边距起），只留和准备清单一样从文字起的发丝线 */
.interview-page .device > view { background-image: none; }
/* s=2 自拍小窗：放宽到 148 × 196，名字条一行放得下「我（画面未接入）」 */
.interview-page .me-panel { width: 148px; height: 196px; }
.interview-page .me-panel .video-name > text { flex: 0 1 auto; min-width: 0; font-size: 11px; white-space: nowrap; }
/* s=3 底栏：「不合适 / 还想考虑」两颗各 120 宽，在主按钮下面居中，间距 12 */
.interview-page .confirm-body :deep(.k-bottom__inner) { justify-content: center; column-gap: 12px; }
.interview-page .confirm-body .k-flex1:not(:last-child) { flex: 0 0 120px; }
/* s=4「下一步」卡：上下内边距都是 16 */
.interview-page .next { padding: 16px; }
.interview-page .next > text:last-child { margin: 4px 0 0; }
/* ==== r3jobsb 第四轮返修 end ==== */
/* ==== r3jobsb 第五轮 start（11-19，按微信实拍复评）==== */
/* s=1：会议信息挪到倒计时正下方（倒计时 → 怎么进面试 → 面试岗位），和倒计时隔 12；候场页区块标题上 24、下 12 */
.interview-page .lobby .meeting-card { margin-top: 12px; }
.interview-page .lobby .section-title { margin-top: 24px; margin-bottom: 12px; }
/* s=4：报名进度不套卡，和审核进度页的步骤条同一种样子——标题 16/700、下距 12；进度条下 8 一行 12 号灰字 */
.interview-page .progress-body .steps-block { margin-top: 16px; padding: 0; border-radius: 0; background: transparent; box-shadow: none; }
.interview-page .progress-body .steps-block .interview-flow__hint { margin: 8px 0 0; padding-top: 0; background-image: none; font-size: 12px; line-height: 18px; color: var(--k-muted); }
/* 双方状态和「下一步」合成一张卡：状态块只留上圆角，「下一步」只留下圆角，中间一条左右各缩 16 的发丝线；和上面的进度块隔 24 */
.interview-page .progress-body .confirm-cards { margin-top: 24px; border-radius: 12px 12px 0 0; }
.interview-page .progress-body .confirm-cards + .next { position: relative; margin-top: 0; border-radius: 0 0 12px 12px; }
.interview-page .progress-body .confirm-cards + .next::before { content: ''; position: absolute; left: 16px; right: 16px; top: 0; height: 1px; background: var(--k-line); transform: scaleY(.5); transform-origin: 0 0; }
/* ==== r3jobsb 第五轮 end ==== */
/* ==== r3jobsb 第三轮 end ==== */
</style>
