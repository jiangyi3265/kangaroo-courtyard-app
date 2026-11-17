<template>
  <view class="k-page interview-page">
    <template v-if="s===1">
      <k-topbar title="面试日程" back />
      <view class="schedule k-pad-tab">
        <view style="padding:12px 16px"><k-button type="outline" block @click="s=5" :label="canEditSlots ? '设置可预约时段' : '查看可预约时段'" /></view>
        <!-- 2026-11-03 主人：简化选日期——‹ 今天 › 左右箭头直接翻天（按周时翻周），点中间直接出日历（默认选中正在看的那天）；不再先弹「昨天 / 今天 / 明天 / 后天 / 其他」菜单（写法参考 daily.vue） -->
        <view class="date-row"><view class="date-nav"><button class="date-arrow" aria-label="前一天" @click="moveDay(-1)"><k-icon name="chevron-left" :size="22" color="ink" :stroke="2" /></button><button class="date-pill" @click="pickDay"><text>{{ dayPill }}</text><k-icon name="calendar-days" :size="15" color="red" :stroke="1.8" /></button><button class="date-arrow" aria-label="后一天" @click="moveDay(1)"><k-icon name="chevron-right" :size="22" color="ink" :stroke="2" /></button></view><text class="date-title">{{ sched.title }}</text><button class="date-pill week" @click="toggleWeek"><text>{{ range === 'week' ? '按天' : '本周' }}</text></button></view>
        <view class="summary-card"><text class="summary-title">{{ summaryLabel }} <text class="red-text">{{ sum.total }}</text> 场</text><view class="summary-grid"><view class="summary-item amber"><text>待确认</text><text>{{ sum.pending }}</text></view><view class="summary-item indigo"><text>即将开始</text><text>{{ sum.upcoming }}</text></view><view class="summary-item green"><text>已改期</text><text>{{ sum.rescheduled }}</text></view></view></view>
        <view class="interview-list"><view v-for="item in rows" :key="item.interviewId" class="interview-card" :class="item.tone"><view class="interview-copy"><view class="time-line"><text class="time">{{ item.time }}</text><text class="status">{{ statusText(item) }}</text></view><text class="person">{{ personLine(item.name, item) }}</text><text class="job">{{ item.job }}</text><text class="place">{{ item.place }}</text><text class="source">{{ item.note }}</text></view><view class="interview-actions"><button class="video-button" @click="openDetail(item)"><k-icon name="video" :size="17" color="white" /><text>面试详情</text></button><button class="change-button" :disabled="!canEditSlots || item.appStatus !== 'interview_booked'" @click="quickReschedule(item)"><k-icon name="pencil" :size="17" color="ink" /><text>改期</text></button></view></view></view>
      </view><k-tabbar mode="staff" active="work" />
    </template>
    <template v-else-if="s===2">
      <k-topbar title="面试详情" back custom-back @back="s=1" />
      <view class="detail k-pad-tab">
        <view class="candidate-card"><image class="candidate-avatar" :src="avatarOf(d)" mode="aspectFill" /><view class="candidate-copy"><text class="candidate-name">{{ d.name || '' }} · <text class="candidate-meta">{{ metaText }}</text></text><text class="candidate-job">{{ d.jobTitle || '' }}</text><text class="candidate-sub">应聘来源：{{ d.source || '' }}</text></view><view class="candidate-side"><text>{{ d.match == null ? '' : d.match + '%匹配' }}</text><text>报名时间：{{ d.submitTime || '' }}</text></view></view>
        <view class="detail-section"><text class="section-title">面试时间（共 {{ slots.length }} 组可选）</text><view class="slot-row"><view v-for="slot in slots" :key="slot.slotId" class="slot" :class="{selected:slot.slotId===selSlot}" @click="selSlot=slot.slotId"><text>{{slot.time}}</text><text>{{slot.date}}</text><view v-if="slot.slotId===selSlot" class="slot-check"><k-icon name="check" :size="14" color="white" /></view></view></view></view>
        <view class="detail-section meeting-info">
          <text class="section-title">视频面试 · 腾讯会议</text>
          <template v-if="dm"><view v-if="dm.code" class="tm-row"><text>会议号</text><text class="tm-code">{{ groupCode(dm.code) }}</text></view><view v-if="dm.link" class="tm-row"><text>链接</text><text class="tm-link" user-select>{{ dm.link }}</text></view><view v-if="dm.pwd" class="tm-row"><text>密码</text><text class="tm-code">{{ dm.pwd }}</text></view><text v-if="dm.note" class="meeting-copy">{{ dm.note }}</text></template>
          <text v-else class="meeting-copy">{{ d.meetingInfo || '尚未填写腾讯会议号：请先在腾讯会议里预定会议，再把会议号填到这里。' }}</text>
          <text class="meeting-hint">{{ meetingHint }}</text>
          <view v-if="dm" class="meeting-host-guide"><text class="meeting-host-guide__title">主持人开会提醒</text><text>先用创建会议的账号开始会议，再到“管理成员 → 等候中”准入候选人。若看不到对方，请先核对双方会议号是否一致。</text><k-button type="outline" size="md" :disabled="meetingRefreshing || editingMeeting || meetingSaving" :label="meetingRefreshing ? '正在刷新…' : '刷新会议信息'" @click="refreshMeetingInfo(true)" /><text v-if="meetingRefreshError" class="meeting-error">{{ meetingRefreshError }}</text></view>
          <view class="meeting-actions"><k-button v-if="dm" icon="video" label="进入腾讯会议" @click="joinMeeting" /><k-button v-if="dm" type="outline" :label="dm.code ? '复制会议号' : '复制入会链接'" @click="copyCode" /><k-button v-else-if="d.meetingInfo" type="outline" label="复制会议信息" @click="copyMeeting" /><k-button v-if="d.canEditMeeting && !editingMeeting" :type="dm ? 'outline' : 'primary'" :label="dm ? '修改会议信息' : d.meetingInfo ? '改填腾讯会议号' : '填写腾讯会议号'" @click="editMeeting" /></view>
          <!-- 四栏都是单行 input（不用原生 textarea，免得盖住底部导航）；保存成 formatTencentMeeting 的固定写法，候选人就能一键进入。
               2026-11-03 主人：会议号栏可整段粘贴腾讯会议邀请或链接，失焦时拆到会议号 / 密码 / 链接三栏 -->
          <view v-if="editingMeeting" class="meeting-editor"><text v-if="d.meetingInfo && !dm" class="meeting-hint">上方原来的会议信息里没认出腾讯会议号，填写会议号保存后会替换它。</text><view class="tm-field"><text>腾讯会议号</text><input v-model="mCode" :disabled="meetingSaving" maxlength="2000" placeholder="可整段粘贴腾讯会议邀请" aria-label="腾讯会议号" @blur="fillCode" /></view><view class="tm-field"><text>会议密码</text><input v-model="mPwd" :disabled="meetingSaving" maxlength="40" placeholder="选填，没有就空着" aria-label="会议密码" @blur="fillCode" /></view><view class="tm-field"><text>入会链接</text><input v-model="mLink" :disabled="meetingSaving" maxlength="300" placeholder="选填，meeting.tencent.com 开头" aria-label="入会链接" @blur="fillCode" /></view><view class="tm-field"><text>备注</text><input v-model="mNote" :disabled="meetingSaving" maxlength="200" placeholder="选填，如：请提前 5 分钟入会" aria-label="备注" /></view><text v-if="meetingError" class="meeting-error">{{ meetingError }}</text><view class="meeting-actions"><k-button :disabled="meetingSaving || !(mCode.trim() || mLink.trim())" :label="meetingSaving ? '正在保存…' : '保存会议信息'" @click="saveMeeting" /><k-button type="outline" :disabled="meetingSaving" label="取消" @click="editingMeeting=false" /></view></view>
        </view>
        <view v-if="d.videoEnabled" class="detail-section devices"><text class="section-title">设备状态</text><view class="device-row"><view class="device"><k-icon name="camera" :size="34" color="ink" /><view><text>摄像头</text><text>{{ dev.camera }}</text></view></view><view class="device"><k-icon name="mic" :size="34" color="ink" /><view><text>麦克风</text><text>{{ dev.mic }}</text></view></view><view class="device"><k-icon name="wifi" :size="34" color="ink" /><view><text>网络</text><text>{{ dev.net }}</text></view></view></view></view>
        <view class="detail-section outline"><text class="section-title">面试提纲</text><view v-for="(q,i) in shownQuestions" :key="q" class="question"><text>{{i+1}}</text><text>{{q}}</text></view><text class="expand" @click="allQ=!allQ">{{ allQ ? '收起⌃' : '展开全部⌄' }}</text></view>
        <!-- 2026-11-03 主人：简化——原来的「会议信息与操作」菜单和上面的腾讯会议栏重复，去掉；电话联系 / 标记结束 / 双向确认各自一个大按钮，不用再翻菜单 -->
        <view class="detail-section operations"><text class="section-title">面试操作</text><view class="operation-grid"><button class="op-btn" :disabled="!canCall" @click="callCandidate"><k-icon name="phone" :size="18" :color="canCall ? 'ink' : 'light'" /><text>电话联系</text></button><button class="op-btn" :disabled="!d.canFinish" @click="finishInterview"><k-icon name="check-check" :size="18" :color="d.canFinish ? 'ink' : 'light'" /><text>标记结束</text></button><button class="op-btn primary" @click="s=3"><k-icon name="handshake" :size="18" color="white" /><text>双向确认</text></button><button class="op-btn" :disabled="!d.canReschedule" @click="doReschedule"><k-icon name="calendar-clock" :size="18" :color="d.canReschedule ? 'ink' : 'light'" /><text>改期</text></button></view><text v-if="opHint" class="op-hint">{{ opHint }}</text></view>
        <!-- 2026-11-03 主人：简化——评分直接在页面里点 5 颗星，评语在页面输入框里写，点「保存评价」；不再先弹「5 星 / 4 星…」菜单再弹系统输入框 -->
        <view class="detail-section" v-if="d.canRecordResult"><text class="section-title">面试结果</text><text class="rate-label">独立记录本次面试判断，不代替双方录用确认。</text><view class="operation-grid"><button v-for="item in interviewResults" :key="item.value" class="op-btn" :class="{primary:d.staffResult===item.value}" :disabled="rateSaving" @click="saveInterviewResult(item.value)">{{ item.label }}</button></view></view>
        <view class="detail-section rating"><text class="section-title">面试后评价 <text class="muted">（面试结束后可填写）</text></text><view class="stars" aria-label="面试评分"><button v-for="n in 5" :key="n" class="star-btn" :aria-label="n + ' 星'" :disabled="!d.canRate" @click="pickStar(n)"><k-icon name="star" :size="34" :color="n <= rateStars ? '#D79446' : '#B7B7B0'" :fill="n <= rateStars" /></button></view><text class="rate-label">{{ ratingHint }}</text><template v-if="d.canRate"><view class="tm-field"><text>评语</text><input v-model="rateNote" :disabled="rateSaving" maxlength="200" placeholder="选填，如：沟通顺畅，有咖啡经验" aria-label="面试评语" /></view><view class="meeting-actions"><k-button :disabled="rateSaving || !rateStars" :label="rateSaving ? '正在保存…' : '保存评价'" @click="saveRating" /></view></template></view>
      </view><k-tabbar mode="staff" active="work" />
    </template>
    <template v-else-if="s===3">
      <k-topbar title="双向确认" back custom-back @back="s=2" />
      <view class="confirm-page k-pad-tab">
        <view class="confirm-alert"><k-icon name="triangle-alert" :size="28" color="#D79446" /><view><text>{{ alertTitle }}</text><text>{{ alertSub }}</text></view></view>
        <view class="confirm-info"><text class="section-title">面试信息</text><text>候选人：　{{ personLine(d.maskedName, d) }}</text><text>岗位：　　{{ d.jobTitle || '' }}</text><text>面试时间：{{ d.dateText || '' }}</text><text>面试方式：{{ dm ? '腾讯会议' : d.meetingInfo ? '外部会议' : '电话或另行沟通' }}</text></view>
        <view class="confirm-card"><text class="section-title">用户（{{ d.maskedName || '' }}）确认</text><view class="confirm-person"><image class="confirm-avatar" :src="avatarOf(d)" mode="aspectFill" /><view class="confirm-copy"><text>{{ d.maskedName || '' }} · 候选人</text><text>{{ userLine }}</text></view><view class="confirmed"><text>{{ userState }}</text><view v-if="userConfirmed" class="confirm-badge"><k-icon name="check" :size="22" color="white" /></view></view></view><view v-if="feedbackRows.length" class="feedback-list"><view v-for="f in feedbackRows" :key="f.label" class="feedback-row"><text>{{ f.label }}</text><text :class="{ warn: f.warn }">{{ f.value }}</text></view></view><text v-else-if="feedbackEmpty" class="feedback-empty">{{ feedbackEmpty }}</text><view class="confirm-actions"><button class="pass" @click="userSide"><text>确认合适</text></button><button class="fail" @click="userSide"><text>不合适</text></button><button class="pending" @click="userSide"><text>待处理</text></button></view></view>
        <view class="confirm-card shop-card"><text class="section-title">商家（{{ d.storeName || '' }}）确认</text><view class="confirm-person"><view class="shop-avatar"><k-icon name="coffee" :size="40" color="ink" /></view><view class="confirm-copy"><text>{{ d.storeName || '' }}</text><text>{{ storeLine }}</text></view><view class="confirmed"><text>{{ storeConfirmed ? '已确认' : '待确认' }}</text><view v-if="storeConfirmed" class="confirm-badge"><k-icon name="check" :size="22" color="white" /></view></view></view><view class="confirm-actions"><button class="pass" :disabled="!canHire" @click="storePass"><text>确认合适</text></button><button class="fail" :disabled="!canHire" @click="storeFail"><text>不合适</text></button><button class="pending" @click="storeLater"><text>待处理</text></button></view></view>
        <view class="result-card"><text class="section-title">确认结果</text><view class="result-copy"><view v-if="storeConfirmed" class="confirm-badge result-badge"><k-icon name="check" :size="26" color="white" /></view><view><text>{{ result.title }}</text><text>{{ result.sub }}</text><text>{{ result.time }}</text></view></view><button @click="openContract"><text>{{ contractLabel }}</text></button></view>
      </view><k-tabbar mode="staff" active="work" />
    </template>
    <template v-else-if="s===4">
      <k-topbar title="保险办理" back custom-back @back="backInsurance" />
      <view class="insurance-page k-pad-tab">
        <view class="insurance-tabs"><view class="active" @click="openInsuranceList('toBuy')"><text>待申请　{{ insCounts.toBuy }}</text></view><view @click="openInsuranceList('effective')"><k-icon name="lock" :size="19" color="muted" /><text>已出单 {{ insCounts.effective }}</text></view><view @click="openInsuranceList('all')"><k-icon name="badge-check" :size="19" color="muted" /><text>全部 {{ insCounts.all }}</text></view></view>
        <view class="insured-card"><image class="insured-avatar" :src="avatarOf(cand)" mode="aspectFill" /><view><text>{{ personLine(cand.name, cand) }}</text><text>{{ cand.jobTitle || '' }}</text><text>到店日期：{{ cand.arrivalText || '' }}</text></view></view><text class="insurance-title">保险方案</text>
        <view v-if="insuranceLoading" class="insurance-help">正在读取保险方案…</view>
        <view v-else-if="insuranceError" class="insurance-help"><text>{{ insuranceError }}</text><k-button type="outline" label="重新加载" @click="reloadInsurance" /></view>
        <template v-else>
          <view v-if="lockedInsurance" class="insurance-help"><text>已提交方案：{{ apply.planName || '保险方案' }}</text><text>下方展示本次申请的参考保费和期限。</text></view>
          <template v-else>
            <view v-if="renewing && lastEndDate" class="insurance-help"><text>上一张保单保障到 {{ lastEndDate }}，可以续保：选好方案，起保日期最早从 {{ insuranceMinDate }} 开始。</text></view>
            <view v-if="!plans.length" class="insurance-help"><text class="section-title">暂无可选保险方案</text><text>请平台管理员在后台「员工运营 → 保险方案」设置保费、保障天数并上架。</text><k-button type="outline" label="刷新方案" @click="toInsurance" /></view>
            <view v-for="plan in plans" :key="plan.planId" class="plan-card" :class="{selected:plan.planId===selPlan}" @click="!insuranceSubmitting && (selPlan=plan.planId)"><view class="radio"><k-icon v-if="plan.planId===selPlan" name="check" :size="14" color="white" /></view><view class="plan-copy"><text>{{plan.name}}</text><text>{{plan.desc}}</text></view><view class="plan-price"><text>¥{{plan.priceYuan}}</text><text>/ {{plan.days}}天</text></view></view>
          </template>
          <view class="insurance-row" @click="pickStart"><text>保障期限</text><text>{{ periodText || '请先选择保险方案' }}</text><k-icon v-if="!lockedInsurance" name="calendar-days" :size="20" color="ink" /></view>
          <view class="insurance-row total"><text>参考保费合计</text><text>{{ premiumText }}</text></view>
          <view class="insurance-help"><text>参考保费与保障天数由后台保险方案统一设置；选择方案后可用日历调整起保日期，结束日期自动计算。</text><text>店家在缴费页面直接付款，退费可选择原路退回或预存保险余额。付款不代表已有保障，以实际保单为准。</text></view>
          <button class="buy" :disabled="insuranceLoading || !!insuranceError" @click="openInsuranceFinance"><text>投保、缴费与退费</text></button>
        </template>
        <view v-if="apply" class="success-card"><k-icon name="shield-check" :size="55" color="green" /><view><text>{{ applyTitle }}</text><text>保单号：{{ apply.policyNo || '待保险公司出具' }}</text><text>{{ apply.policyIssued ? '保单起保日期' : '拟起保日期' }}：{{ apply.startDate || '待核实' }}</text><text v-if="apply.startDate && apply.endDate">保障期限：{{ apply.startDate }} 至 {{ apply.endDate }}</text></view><text>{{ apply.statusLabel }}</text></view>
        <view v-if="apply" class="notice-card"><text class="section-title">通知记录</text><view><text>{{ noticeUser.text }}</text><text>{{ noticeUser.state }}</text></view><view><text>{{ noticeStore.text }}</text><text>{{ noticeStore.state }}</text></view></view>
      </view><k-tabbar mode="staff" active="work" />
    </template>
    <template v-else-if="s===5"><k-topbar :title="canEditSlots ? '面试时段设置' : '可预约时段'" back custom-back @back="backSlots" /><view class="interview-store">{{ scopedStoreName }}</view><view v-if="scopeError" class="interview-store">{{ scopeError }}</view><k-interview-slots v-else-if="scopeReady" :store-id="scopedStoreId" :can-edit="canEditSlots" /></template>
    <k-date-picker v-if="dayCalendar" title="查看哪一天的面试" :value="dayCalendarValue" @cancel="dayCalendar=false" @confirm="confirmDay" />
    <k-date-picker v-if="insuranceCalendar" title="选择起保日期" :value="startDate" :min-date="insuranceMinDate" :max-date="shiftDate(todayCn(), 90)" @cancel="insuranceCalendar=false" @confirm="confirmStart" />
  </view>
</template>

<script setup>
import { sheet as uiSheet, todayCn } from '@/common/ui.js'
// ---------------------------------------------------------------------------
// 面试日程（员工端）接入情况：
//   s=1 日程：apiStaffInterviews（按天 / 按周），卡片上的"改期"弹出门店可约时段直接改
//   s=2 详情：候选人、可选时段、面试提纲、改期、面试后评分都来自 apiStaffInterviewDetail；
//       设备状态是本机真实检测（网络类型 + 到后端的往返延迟、摄像头/麦克风授权状态）
//   s=3 双向确认：候选人一侧只读（由候选人本人在小程序里表态）；门店一侧走报名状态机
//       （确认录用 = apiStaffConfirm，不合适 = apiStaffTerminate，必须写原因）
//   s=4 保险：方案由平台后台维护；这里提交的是"投保申请"，保单号只能由平台登记，
//       没登记之前卡片写"待保险公司出具"，不会出现假的"购买成功"
// 视频通话（实时音视频）尚未签约接入，页面不会假装进入了视频间。面试走腾讯会议：会议信息认得出会议号时，
// 详情里能一键拉起腾讯会议小程序（common/meeting.js）；会议号按「会议号 / 密码 / 备注」三栏填写。
// 2026-11-03 主人：简化——详情里的「会议信息与操作」菜单（和腾讯会议栏重复）去掉，电话联系 / 标记结束 / 双向确认各一个按钮；
// 评分改成页面内点星 + 评语框 + 保存；日程选日期改成 ‹ 今天 › 箭头 + 点中间出日历。
// ---------------------------------------------------------------------------
import { absUrl } from '@/common/upload.js'
import { ref, computed, watch, onUnmounted } from 'vue'
import { onShow, onHide, onUnload } from '@dcloudio/uni-app'
import { getToken, post } from '@/common/request.js'
import { useScreen, toast, go, back } from '@/common/screen.js'
import {
  apiPing, apiStaffInterviews, apiStaffInterviewDetail, apiStaffReschedule, apiStaffRateInterview,
  apiStaffFinishInterview, apiStaffConfirm, apiStaffTerminate, apiStaffApplicationDetail, apiStaffInsurance, apiStaffInsuranceForApp,
  apiStaffInsuranceApply, apiStaffPolicyNotices, apiStaffInterviewMeeting
} from '@/common/api.js'
import { experience, getSessionRevision, ensureSession, hasStaffAccess, currentStaffStoreId, staffStores } from '@/common/experience.js'
import { staffCan, loadStaffPerms } from '@/common/staff-perms.js'
import { parseTencentMeeting, groupCode, formatTencentMeeting, tencentInputError, readCodeInput, openTencentMeeting } from '@/common/meeting.js'

// 没有头像时退到品牌默认头像（袋鼠线稿），不能用设计稿里某个具体的人像冒充候选人
const DEFAULT_AVATAR = '/static/media/profile-avatar.jpg'
const avatarOf = (x) => (x && absUrl(x.avatar)) || DEFAULT_AVATAR

// 消息深链 /pages/staff/interviews?id=面试ID 直接打开详情
let deepId = 0
let deepInsuranceAppId = 0
let insuranceFromApplication = false
// 报名详情「设置面试时段」直接打开第 5 屏（?s=5）：之前返回落到从没看过的面试日程，要再按一次才回到那位候选人；
// 现在直接打开的这一屏返回来源页，从日程里点进来的仍回日程（与保险办理 backInsurance 同一口径）
let slotsFromLink = false
const requestedStoreId = ref(null)
const scopeReady = ref(false)
const scopeError = ref('')
const scopedStoreId = computed(() => requestedStoreId.value || currentStaffStoreId())
const scopedStoreName = computed(() => staffStores.value.find(g => String(g.storeId) === String(scopedStoreId.value))?.storeName || '')
const s = useScreen(5, { onLoad: (q) => { slotsFromLink = Number(q?.s) === 5; deepId = Number(q?.id) || 0; deepInsuranceAppId = Number(q?.s) === 4 ? Number(q?.appId) || 0 : 0; insuranceFromApplication = deepInsuranceAppId > 0; requestedStoreId.value = Number(q?.storeId) > 0 ? Number(q.storeId) : null; loadSchedule() } })
const backInsurance = () => insuranceFromApplication ? back() : (s.value = 3)
const backSlots = () => { if (slotsFromLink) return back(); s.value = 1; loadSchedule() }

// ---------------- 按角色显隐 ----------------
// 权限表取自服务端（staff-perms.js，与各写接口校验同一张表）。这一页可能经 ?storeId= 或消息深链打开
// 非当前切换门店的数据，而 staffCan 只认当前门店，所以别的门店单独取"那家门店上的角色"的权限表。
const PERM_ACTIONS = ['view', 'edit', 'audit', 'pay', 'export']
const otherPerms = ref({})
function canAt(storeId, item, action) {
  if (storeId == null || storeId === '' || String(storeId) === String(currentStaffStoreId())) return staffCan(item, action)
  const g = staffStores.value.find(x => String(x.storeId) === String(storeId))
  if (!g) return false
  const k = g.storeId + ':' + (g.roleCode || '')
  const table = otherPerms.value[k]
  if (!table) {
    // 与 staffCan 同一口径：表还没取到时先照常显示，由服务端拒绝并说明原因
    loadStaffPerms(g).then((t) => { if (t && !otherPerms.value[k]) otherPerms.value = { ...otherPerms.value, [k]: t } })
    return true
  }
  const v = (table[item] || [])[PERM_ACTIONS.indexOf(action)]
  return v === 'yes' || v === 'part'
}
// 新增 / 关闭面试时段服务端要「岗位管理·编辑」（主理人、管家）；普通员工只能查看时段，不再给一个点了必被拒的入口
const canEditSlots = computed(() => canAt(scopedStoreId.value, 'jobs', 'edit'))

// ---------------- 通用 ----------------
const errText = (e, dft) => (e && e.message) || dft
const modal = (title, content, extra = {}) => new Promise((resolve) => {
  uni.showModal({ title, content, ...extra, success: (r) => resolve(r), fail: () => resolve({ confirm: false }) })
})
const sheet = (itemList) => uiSheet(itemList)
const md = (v) => {
  const m = /^\d{4}-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})/.exec(String(v || ''))
  return m ? `${m[1]}-${m[2]} ${m[3]}:${m[4]}` : ''
}
const pad2 = (n) => (n < 10 ? '0' + n : '' + n)
// 「姓名 · 25岁 · 女」：缺哪项就省掉哪项，不留「 · 岁 · 」
const personLine = (name, x) => [name, x && x.age ? x.age + '岁' : '', x && x.gender].filter(Boolean).join(' · ')
// 改期 / 结束面试 / 评分 / 录用 / 终止都是写请求：网络慢时连点会重复提交（重复通知候选人）
let acting = false
const once = async (fn) => {
  if (acting) return
  acting = true
  try { return await fn() } finally { acting = false }
}
// 秒表：只有需要走字的倒计时才启动
const now = ref(Date.now())
let timer = null
const tick = () => { if (!timer) timer = setInterval(() => { now.value = Date.now() }, 1000) }
onUnmounted(() => { if (timer) clearInterval(timer); timer = null })

// ---------------- s=1 日程 ----------------
const range = ref('day')
const dayOffset = ref(0)
// "今天"以服务端日期为准（服务端按北京时间），第一次按天取数时记下来
const serverToday = ref('')
const sched = ref({ title: '', rows: [], summary: {} })
const rows = computed(() => sched.value.rows || [])
const sum = computed(() => ({ total: 0, pending: 0, upcoming: 0, rescheduled: 0, ...(sched.value.summary || {}) }))

const shiftDate = (ymd, n) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd || '')
  if (!m) return ''
  const t = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]) + n * 86400000)
  return `${t.getUTCFullYear()}-${pad2(t.getUTCMonth() + 1)}-${pad2(t.getUTCDate())}`
}
const DAY_NAMES = { '-1': '昨天', 0: '今天', 1: '明天', 2: '后天' }
const WEEK_NAMES = { '-7': '上周', 0: '本周', 7: '下周' }
const dayPill = computed(() => {
  // 按周看时箭头一次翻 7 天：本周 / 上周 / 下周，再远就写「几月几日那周」
  if (range.value === 'week') {
    if (WEEK_NAMES[dayOffset.value] !== undefined) return WEEK_NAMES[dayOffset.value]
    const w = shiftDate(serverToday.value, dayOffset.value)
    return w ? `${+w.slice(5, 7)}月${+w.slice(8, 10)}日那周` : '本周'
  }
  if (DAY_NAMES[dayOffset.value] !== undefined) return DAY_NAMES[dayOffset.value]
  const t = shiftDate(serverToday.value, dayOffset.value)
  return t ? `${+t.slice(5, 7)}月${+t.slice(8, 10)}日` : '今天'
})
const summaryLabel = computed(() => (range.value === 'week' ? '本周面试' : (dayOffset.value === 0 ? '今日面试' : '当日面试')))

async function loadSchedule() {
  await ensureSession()
  if (!hasStaffAccess.value) {
    if (deepInsuranceAppId) { insuranceLoading.value = false; insuranceError.value = '请先登录有门店授权的员工账号' }
    return
  }
  scopeReady.value = staffStores.value.some(g => String(g.storeId) === String(scopedStoreId.value))
  scopeError.value = scopeReady.value ? '' : '该门店暂无员工授权，请返回报名列表重新选择。'
  if (!scopeReady.value || s.value === 5) {
    if (deepInsuranceAppId && !scopeReady.value) { insuranceLoading.value = false; insuranceError.value = scopeError.value }
    return
  }
  // 报名详情直接办理保险，无需先找到历史面试。仍先读取真实报名并核对门店，不能把URL参数当成候选人数据。
  if (deepInsuranceAppId) {
    const appId = deepInsuranceAppId, epoch = insuranceEpoch
    const identity = insuranceIdentityKey(), storeId = scopedStoreId.value, screen = s.value
    const current = () => insurancePageActive && epoch === insuranceEpoch && identity === insuranceIdentityKey()
      && experience.mode === 'staff' && !!experience.account && hasStaffAccess.value
      && String(storeId) === String(scopedStoreId.value) && appId === deepInsuranceAppId && screen === s.value
    try {
      const application = (await apiStaffApplicationDetail(appId)).data
      if (!current()) return
      if (!application || application.jobType === 'online') throw new Error('线上任务无需办理用工保险')
      if (![application.storeId, application.fulfillmentStoreId].some(id => id != null && String(id) === String(scopedStoreId.value))) throw new Error('该报名不属于指定门店，请返回报名详情重新打开')
      d.value = { ...application, storeName: scopedStoreName.value }
      deepInsuranceAppId = 0
      await toInsurance()
    } catch (e) {
      if (!current()) return
      s.value = 4
      insuranceLoading.value = false
      insuranceError.value = errText(e, '保险信息加载失败')
    }
    return
  }
  try {
    const date = serverToday.value ? shiftDate(serverToday.value, dayOffset.value) : undefined
    const res = await apiStaffInterviews({ storeId: scopedStoreId.value, range: range.value, date })
    sched.value = res.data || { title: '', rows: [], summary: {} }
    if (!serverToday.value && range.value === 'day' && dayOffset.value === 0) serverToday.value = sched.value.date || ''
    if (rows.value.some(r => r.tone === 'blue')) tick()
    if (deepId) {
      const id = deepId
      deepId = 0
      openDetail({ interviewId: id })
    }
  } catch (e) {
    toast(errText(e, '面试日程加载失败'))
  }
}
// 2026-11-03 主人：简化——点日期直接出日历（默认选中正在看的那天，第一次就是今天），不再先弹「昨天 / 今天 / 明天 / 后天 / 其他」菜单。
// 原来：点一下 → 菜单 → 选「其他」→ 日历（3 步）；现在：点一下 → 日历（1 步）。服务端按任意日期取数
const pickDay = () => {
  dayCalendarValue.value = shiftDate(serverToday.value || todayCn(), dayOffset.value) || todayCn()
  dayCalendar.value = true
}
// ‹ › 箭头：按天看一次翻 1 天，按周看一次翻 7 天（和 daily.vue 的 move 同一个意思）
const moveDay = (n) => {
  dayOffset.value += n * (range.value === 'week' ? 7 : 1)
  loadSchedule()
}
const dayCalendar = ref(false)
const dayCalendarValue = ref('')
const confirmDay = (date) => {
  dayCalendar.value = false
  const ymd = (v) => { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(v || '')); return m ? Date.UTC(+m[1], +m[2] - 1, +m[3]) : NaN }
  const picked = ymd(date), base = ymd(serverToday.value || todayCn())
  if (Number.isNaN(picked) || Number.isNaN(base)) return
  range.value = 'day'
  dayOffset.value = Math.round((picked - base) / 86400000)
  loadSchedule()
}
const toggleWeek = () => {
  range.value = range.value === 'week' ? 'day' : 'week'
  loadSchedule()
}
const hms = (sec) => {
  const x = Math.max(0, Math.floor(sec))
  return `${pad2(Math.floor(x / 3600))}:${pad2(Math.floor((x % 3600) / 60))}:${pad2(x % 60)}`
}
// 24 小时内开始的面试在"即将开始"后面走倒计时
const statusText = (item) => {
  if (item.tone === 'blue' && item.startTs) {
    const left = (item.startTs - now.value) / 1000
    if (left > 0 && left < 86400) return '即将开始 ' + hms(left)
  }
  return item.status
}

// ---------------- s=2 详情 ----------------
const d = ref({})
const selSlot = ref(null)
const allQ = ref(false)
const dev = ref({ camera: '未检测', mic: '未检测', net: '未检测' })

// 设计稿一行放 3 个时段：当前时段 + 最近的 2 个可约时段；更多时段在日程卡片的"改期"里选
const slots = computed(() => {
  const list = d.value.slots || []
  return list.filter(x => x.current).concat(list.filter(x => !x.current)).slice(0, 3)
})
const shownQuestions = computed(() => {
  const qs = d.value.questions || []
  return allQ.value ? qs : qs.slice(0, 4)
})
const metaText = computed(() => [d.value.age ? d.value.age + '岁' : '', d.value.gender, d.value.city].filter(Boolean).join(' · '))
const ratingHint = computed(() => {
  if (d.value.rating) return `已评 ${d.value.rating} 星` + (d.value.staffNote ? '：' + d.value.staffNote : '') + (d.value.canRate ? '（改好后再点保存）' : '')
  return d.value.canRate ? '点星星打分，写好评语后点保存' : '当前无评价权限或面试状态不允许'
})
// 2026-11-03 主人：简化——评分、评语都在页面里，打开详情时带入已保存的值
const interviewResults = [{value:'pass',label:'通过'},{value:'reject',label:'未通过'},{value:'pending',label:'待定'}]
async function saveInterviewResult(result){
  if(!d.value.canRecordResult || rateSaving.value)return
  rateSaving.value=true
  try{await post('/app/staff/interviews/'+d.value.interviewId+'/result',{result});d.value={...d.value,staffResult:result};toast('面试结果已登记')}catch(e){toast(errText(e,'登记失败'))}finally{rateSaving.value=false}
}
const rateStars = ref(0)
const rateNote = ref('')
const rateSaving = ref(false)
const pickStar = (n) => { if (d.value.canRate) rateStars.value = n }
async function saveRating() {
  if (!d.value.interviewId || rateSaving.value) return
  if (!d.value.canRate) return toast('当前无评价权限或面试状态不允许')
  if (!rateStars.value) return toast('请先点星星打分')
  const rating = rateStars.value, note = rateNote.value.trim().slice(0, 200)
  rateSaving.value = true
  try {
    await apiStaffRateInterview(d.value.interviewId, rating, note)
    d.value = { ...d.value, rating, staffNote: note }
    toast('评价已保存')
  } catch (e) {
    toast(errText(e, '评价失败'))
  } finally {
    rateSaving.value = false
  }
}
// 电话联系：普通员工拿到的是脱敏号码（contactMasked），拨不通，按钮置灰
const canCall = computed(() => !!d.value.phone && !d.value.contactMasked)
const callCandidate = () => {
  if (!canCall.value) return
  uni.makePhoneCall({ phoneNumber: String(d.value.phone), fail: () => toast('无法拨号，请手动拨打 ' + d.value.phone) })
}
const opHint = computed(() => [
  d.value.phone && d.value.contactMasked ? '候选人号码已脱敏，只有换工主理人、小院主理人能直接拨打' : '',
  d.value.interviewId && !d.value.canFinish ? '面试进行完毕后才能标记结束' : ''
].filter(Boolean).join('；'))

// 会议走腾讯会议。后端只存一段 meetingInfo 文字：这里按「会议号 / 密码 / 备注」三栏填，保存成固定写法（formatTencentMeeting），
// 双方都能一键拉起腾讯会议小程序；认不出会议号的旧文字照旧显示原文 + 复制
const dm = computed(() => parseTencentMeeting(d.value.meetingInfo))
// 只有入会链接时小程序拉不起腾讯会议（腾讯会议小程序只认会议号），候选人得复制链接去浏览器打开：提示补会议号
const meetingHint = computed(() => (dm.value ? (dm.value.code ? '此按钮打开已填写的会议；能否入会由腾讯会议中的账号身份和主持人准入决定。首次需按腾讯会议提示授权手机号。' : '只有入会链接：候选人点进入会复制链接，要到浏览器或腾讯会议 App 打开。补上会议号可在微信里一键进入。')
  : d.value.meetingInfo ? '这段会议信息里没认出腾讯会议号，候选人只能复制文字；改填腾讯会议号后可一键进入。' : '填好腾讯会议号后，候选人可在小程序里一键进入。'))
const joinMeeting = () => {
  if (meetingRefreshing.value) return toast('正在刷新会议信息，请稍后')
  if (!dm.value) return toast('请先填写会议信息')
  return openTencentMeeting({ code: dm.value.code, pwd: dm.value.pwd, link: dm.value.link, nickname: experience.account?.nickname })
}
// 只有入会链接（没有会议号）时复制链接
const copyCode = () => uni.setClipboardData({ data: dm.value.code || dm.value.link })
const editingMeeting = ref(false)
const mCode = ref('')
const mPwd = ref('')
const mLink = ref('')
const mNote = ref('')
const meetingSaving = ref(false)
const meetingError = ref('')
const meetingRefreshing = ref(false)
const meetingRefreshError = ref('')
async function refreshMeetingInfo(manual = false) {
  if (!d.value.interviewId || meetingRefreshing.value || editingMeeting.value || meetingSaving.value) return
  const requestedId = d.value.interviewId
  meetingRefreshing.value = true
  meetingRefreshError.value = ''
  try {
    const res = await apiStaffInterviewDetail(requestedId)
    if (d.value.interviewId !== requestedId) return
    if (!res?.data) throw new Error('未读取到本次面试')
    d.value = { ...d.value, ...res.data }
    if (manual) toast('已更新本次会议信息')
  } catch (e) {
    if (d.value.interviewId === requestedId) meetingRefreshError.value = '刷新失败，请重试并核对会议号'
  } finally { meetingRefreshing.value = false }
}
// 认得出的会议信息拆回三栏（备注是单行 input，多行并成一行）；认不出的旧文字留在上方只读显示，填新会议号保存后替换它
function editMeeting() {
  const p = dm.value
  mCode.value = p ? p.code : ''; mPwd.value = p ? p.pwd : ''; mLink.value = p ? p.link : ''; mNote.value = p ? p.note.replace(/\s*\n\s*/g, ' ').slice(0, 200) : ''
  meetingError.value = ''; editingMeeting.value = true
}
// 会议号去掉空格 / 短横；粘贴整段腾讯会议邀请或链接时拆出会议号、密码、链接（邀请里的密码为准）
function fillCode() { const r = readCodeInput(mCode.value, mPwd.value, mLink.value); mCode.value = r.code; mPwd.value = r.pwd; mLink.value = r.link }
function copyMeeting() { if (d.value.meetingInfo) uni.setClipboardData({ data: d.value.meetingInfo }) }
async function saveMeeting() {
  if (meetingSaving.value || !d.value.canEditMeeting) return
  fillCode()
  const err = tencentInputError(mCode.value, mPwd.value, mLink.value)
  if (err) { meetingError.value = err; return }
  meetingSaving.value = true; meetingError.value = ''
  try {
    const res = await apiStaffInterviewMeeting(d.value.interviewId, formatTencentMeeting(mCode.value, mPwd.value, mNote.value, mLink.value))
    d.value = res.data; editingMeeting.value = false; toast('会议信息已保存，候选人可同步查看')
  } catch (e) { meetingError.value = errText(e, '保存失败，请重试') }
  finally { meetingSaving.value = false }
}

async function loadDetail(id) {
  editingMeeting.value = false
  const res = await apiStaffInterviewDetail(id)
  d.value = res.data || {}
  const cur = (d.value.slots || []).find(x => x.current)
  selSlot.value = cur ? cur.slotId : null
  rateStars.value = Number(d.value.rating) || 0
  rateNote.value = d.value.staffNote || ''
  if (d.value.deadlineTs) tick()
}
async function openDetail(item) {
  try {
    await loadDetail(item.interviewId)
    allQ.value = false
    s.value = 2
    checkDevices()
  } catch (e) {
    toast(errText(e, '面试详情加载失败'))
  }
}

// 设备检测：网络类型 + 到后端的真实往返延迟；摄像头 / 麦克风看授权状态（真正打开摄像头要等视频服务接入）
async function checkDevices() {
  dev.value = { camera: '检测中', mic: '检测中', net: '检测中' }
  const netType = await new Promise((resolve) => {
    uni.getNetworkType({ success: (r) => resolve(r.networkType), fail: () => resolve('unknown') })
  })
  if (netType === 'none') {
    dev.value.net = '无网络'
  } else {
    const t0 = Date.now()
    try {
      await apiPing()
      const ms = Date.now() - t0
      dev.value.net = (ms < 150 ? '良好 ' : ms < 400 ? '一般 ' : '较差 ') + ms + 'ms'
    } catch (e) {
      dev.value.net = '连接失败'
    }
  }
  const label = (v) => (v === true || v === 'granted' ? '已授权' : (v === false || v === 'denied' ? '未授权' : '使用时授权'))
  // #ifdef MP
  uni.getSetting({
    success: (r) => {
      dev.value.camera = label(r.authSetting['scope.camera'])
      dev.value.mic = label(r.authSetting['scope.record'])
    },
    fail: () => { dev.value.camera = '未检测'; dev.value.mic = '未检测' }
  })
  // #endif
  // #ifdef H5
  const q = (name) => (navigator.permissions && navigator.permissions.query
    ? navigator.permissions.query({ name }).then(p => p.state).catch(() => '')
    : Promise.resolve(''))
  const [cam, mic] = await Promise.all([q('camera'), q('microphone')])
  dev.value.camera = cam ? label(cam) : '未检测'
  dev.value.mic = mic ? label(mic) : '未检测'
  // #endif
}

async function doReschedule() {
  if (!d.value.interviewId) return
  if (!d.value.canReschedule) return toast('当前状态不能改期')
  const target = (d.value.slots || []).find(x => x.slotId === selSlot.value)
  if (!target || target.current) return toast('请先在上方选一个新的时段')
  const r = await modal('确认改期', `把面试改到 ${target.date} ${target.time}？候选人会收到站内通知。`)
  if (!r.confirm) return
  await once(async () => {
    try {
      const res = await apiStaffReschedule(d.value.interviewId, target.slotId)
      toast(res.msg || '已改期')
      await loadDetail(d.value.interviewId)
      loadSchedule()
    } catch (e) {
      toast(errText(e, '改期失败'))
    }
  })
}

// 日程卡片上的"改期"：列出门店可约时段直接选（超过 6 项时 sheet 会自动分页）
async function quickReschedule(item) {
  if (item.appStatus !== 'interview_booked') return toast('当前状态不能改期')
  try {
    const res = await apiStaffInterviewDetail(item.interviewId)
    if (!res.data?.canReschedule) return toast('当前无改期权限或面试状态不允许')
    const open = ((res.data || {}).slots || []).filter(x => !x.current)
    if (!open.length) return toast(canEditSlots.value ? '门店暂无其他可约时段，请返回日程点击设置可预约时段' : '门店暂无其他可约时段，请联系本店换工主理人或小院主理人添加')
    const i = await sheet(open.map(x => `${x.date} ${x.time}`))
    if (i < 0 || acting) return
    acting = true
    try {
      const r = await apiStaffReschedule(item.interviewId, open[i].slotId)
      toast(r.msg || '已改期')
      loadSchedule()
    } finally { acting = false }
  } catch (e) {
    toast(errText(e, '改期失败'))
  }
}

// 2026-11-03 主人：简化——「标记结束」单独一个按钮（原来藏在「会议信息与操作」菜单里：点菜单 → 选项 → 确认，3 步；现在点按钮 → 确认，2 步）。
// 标记后候选人要在小程序里确认意向，所以还留一道确认
async function finishInterview() {
  if (!d.value.interviewId) return
  if (!d.value.canFinish) return toast('面试进行完毕后才能标记结束')
  const r = await modal('结束面试', '确认面试已经进行完毕？候选人随后需要在小程序里确认意向。')
  if (!r.confirm) return
  await once(async () => {
    try {
      const res = await apiStaffFinishInterview(d.value.interviewId)
      toast(res.msg || '已标记面试结束')
      await loadDetail(d.value.interviewId)
      loadSchedule()
      s.value = 3
    } catch (e) {
      toast(errText(e, '操作失败'))
    }
  })
}

// ---------------- s=3 双向确认 ----------------
const USER_OK = ['user_confirmed', 'store_confirmed', 'contract_signed', 'onboarded']
const STORE_OK = ['store_confirmed', 'contract_signed', 'onboarded']
const TERMINABLE = ['interview_booked', 'interview_done', 'user_confirmed', 'store_confirmed', 'contract_signed']
const st = computed(() => d.value.appStatus || '')
const userConfirmed = computed(() => USER_OK.includes(st.value))
const storeConfirmed = computed(() => STORE_OK.includes(st.value))
const userState = computed(() => {
  if (userConfirmed.value) return '已确认'
  if (st.value === 'terminated' && d.value.userIntent === 'reject') return '不合适'
  return st.value ? '待确认' : ''
})
const userLine = computed(() => {
  if (d.value.userConfirmTime) return '已提交确认：' + md(d.value.userConfirmTime)
  if (st.value === 'interview_booked') return '面试尚未结束'
  if (d.value.userIntent === 'pending') return '候选人表示还想考虑'
  return st.value ? '尚未确认' : ''
})
// 商家一栏的确认录用 / 不合适（终止）：服务端 AppStaffController 要该报名所属门店上的「岗位管理·编辑」（主理人、管家），
// 与报名详情页一致。按这场面试所属报名的门店判，详情没回来前退回页面所在门店
const appStoreId = computed(() => d.value.storeId || scopedStoreId.value)
const canHire = computed(() => canAt(appStoreId.value, 'jobs', 'edit'))
const storeLine = computed(() => {
  if (d.value.storeConfirmTime) return '已提交确认：' + md(d.value.storeConfirmTime)
  if (!st.value) return ''
  return canHire.value ? '尚未确认' : '尚未确认 · 仅换工主理人或小院主理人可操作'
})
const alertTitle = computed(() => {
  if (!st.value) return ''
  if (storeConfirmed.value) return '双方已确认'
  if (st.value === 'user_confirmed') return '候选人已确认，请尽快确认录用'
  if (st.value === 'interview_done') return '面试已结束，等待候选人确认'
  if (st.value === 'interview_booked') return '面试尚未结束'
  return d.value.statusLabel || ''
})
const alertSub = computed(() => {
  if (storeConfirmed.value) return '已完成双向确认'
  if (st.value === 'user_confirmed' && d.value.deadlineTs) {
    const left = Math.max(0, Math.floor((d.value.deadlineTs - now.value) / 1000))
    return `剩余时间：${pad2(Math.floor(left / 3600))}小时 ${pad2(Math.floor((left % 3600) / 60))}分 ${pad2(left % 60)}秒`
  }
  return st.value ? '剩余时间：—' : ''
})
const result = computed(() => {
  if (storeConfirmed.value) {
    return {
      title: '录用已确认',
      sub: st.value === 'store_confirmed' ? (d.value.volunteerContractStatus === 'pending' ? '用户已确认三方协议，待店家核对' : '责任书已生成，待候选人签署') : '责任书已签署',
      time: d.value.storeConfirmTime ? '确认时间：' + md(d.value.storeConfirmTime) : ''
    }
  }
  return { title: st.value ? '等待双方确认' : '', sub: st.value ? '候选人与门店都确认后生成责任书' : '', time: '' }
})
const userSide = () => toast('这一栏由候选人本人在小程序里确认')
// 候选人面试后填的问卷和「想让门店知道的事」（面试详情接口带回）：之前门店在小程序里哪儿都看不到，
// 候选人选了「无法按时到岗」门店照样会点确认录用。三道单选里的差评项（不太清晰 / 不满意 / 无法按时到岗）标红，确认录用时再提醒一句
const FEEDBACK_LABELS = [['understandJob', '岗位理解'], ['acceptBoard', '食宿条件'], ['confirmArrival', '按时到岗'], ['feedbackNote', '想让门店知道的事']]
const feedbackRows = computed(() => FEEDBACK_LABELS.filter(([k]) => d.value[k]).map(([k, label]) => ({ label, value: d.value[k], warn: k !== 'feedbackNote' && /不太|不满意|无法/.test(d.value[k]) })))
const feedbackEmpty = computed(() => (['interview_done', 'user_confirmed', 'store_confirmed', 'contract_signed', 'onboarded'].includes(st.value) ? '候选人没有填写面试后问卷' : ''))
const HIRE_DENIED = '确认录用与终止仅限本店换工主理人或小院主理人操作'
async function storePass() {
  if (!d.value.appId) return
  if (!canHire.value) return toast(HIRE_DENIED)
  if (storeConfirmed.value) return toast('已确认录用')
  if (st.value === 'interview_booked') return toast('请先结束面试')
  if (st.value === 'interview_done') return toast('等候选人先确认意向后才能录用')
  if (st.value !== 'user_confirmed') return toast('当前状态不能确认录用')
  const warn = feedbackRows.value.filter(f => f.warn).map(f => '「' + f.value + '」').join('、')
  const r = await modal('确认录用', (warn ? `候选人在面试后问卷里选了${warn}，建议先和 TA 沟通。\n` : '') + `确认录用 ${d.value.name || '这位候选人'}？确认后候选人可以签署责任书。`)
  if (!r.confirm) return
  await once(async () => {
    try {
      await apiStaffConfirm(d.value.appId)
      toast('已确认录用')
      await loadDetail(d.value.interviewId)
      // 之前只刷新详情，返回日程后这张卡片仍是「待确认 · 候选人已确认，等待门店确认录用」；与「不合适」一样同时刷新日程
      loadSchedule()
    } catch (e) {
      toast(errText(e, '操作失败'))
    }
  })
}
async function storeFail() {
  if (!d.value.appId) return
  if (!canHire.value) return toast(HIRE_DENIED)
  if (!TERMINABLE.includes(st.value)) return toast('当前状态不能终止')
  const r = await modal('不合适', '', { editable: true, placeholderText: '请填写原因（会告知候选人）' })
  if (!r.confirm) return
  const reason = (r.content || '').trim()
  if (!reason) return toast('请填写原因')
  await once(async () => {
    try {
      await apiStaffTerminate(d.value.appId, reason.slice(0, 200))
      toast('已终止')
      await loadDetail(d.value.interviewId)
      loadSchedule()
    } catch (e) {
      toast(errText(e, '操作失败'))
    }
  })
}
const storeLater = () => {
  toast('已保留，可稍后在报名管理中处理')
  s.value = 1
}

// 「责任书」按钮原先写着"查看并签署责任书"却直接跳到保险办理。责任书由候选人本人在小程序「报名进度」里签署
// （用户端签约页 /pages/jobs/contract 只对报名人本人开放，门店打不开），门店这边只能看签署留痕：
// 按面试详情里服务端返回的签署记录如实显示进度；门店确认录用之后（服务端从这时起允许投保）再把保险办理作为下一步给出来。
const contractSigned = computed(() => !!d.value.contractSigned || ['contract_signed', 'onboarded'].includes(st.value))
const contractLabel = computed(() => {
  if (d.value.jobType === 'volunteer' && (!contractSigned.value || String(d.value.contractVersion || '').startsWith('W'))) return '核对换工三方协议'
  if (contractSigned.value) return '查看责任书签署记录'
  if (st.value === 'store_confirmed') return '责任书待候选人签署'
  return '查看责任书签署进度'
})
async function openContract() {
  if (!d.value.appId) return
  if (d.value.jobType === 'volunteer' && (!contractSigned.value || String(d.value.contractVersion || '').startsWith('W'))) { go(R.staffApplications + '?appId=' + d.value.appId + '&storeId=' + d.value.storeId); return }
  let content
  if (contractSigned.value) {
    content = (d.value.contractSignTime
      ? `${d.value.contractSigner || '候选人'} 已于 ${d.value.contractSignTime} 签署《岗位责任确认书》${d.value.contractVersion ? '（' + d.value.contractVersion + ' 版）' : ''}。`
      : '候选人已签署《岗位责任确认书》。') + '签署记录由平台留存。'
  } else if (st.value === 'store_confirmed') {
    content = '门店已确认录用，责任书已开放给候选人，由候选人本人在小程序「报名进度」里阅读并签署；签署后这里会显示签署时间。'
  } else if (['terminated', 'withdrawn', 'review_rejected'].includes(st.value)) {
    content = '本次报名流程已结束，不会再签署责任书。'
  } else {
    content = '门店确认录用后，候选人才能在小程序里签署责任书。'
  }
  const insurable = STORE_OK.includes(st.value)
  const r = await modal('岗位责任确认书', content, insurable ? { confirmText: '办理保险', cancelText: '知道了' } : { showCancel: false, confirmText: '知道了' })
  if (insurable && r.confirm) toInsurance()
}

// ---------------- s=4 保险 ----------------
const insCounts = ref({ toBuy: 0, effective: 0, all: 0 })
const cand = ref({})
const plans = ref([])
const apply = ref(null)
const selPlan = ref(null)
const startDate = ref('')
// 这条报名已出单保单里最晚的止保日（服务端 lastEndDate，没出过单为空）：续保的起保日不能早于它的次日
const lastEndDate = ref('')
const insuranceLoading = ref(false)
const insuranceError = ref('')
const insuranceSubmitting = ref(false)
const insuranceCalendar = ref(false)
const insuranceCanEdit = ref(false)
const insuranceStoreId = ref(null)
let insuranceRequest = 0
let insurancePageActive = true
let insuranceEpoch = 0
const insuranceIdentityKey = () => JSON.stringify([
  getSessionRevision(), String(experience.account?.id || ''), getToken(), experience.mode,
  staffStores.value.map(g => [String(g.storeId), g.roleCode || '', g.active]).sort((a,b) => a[0].localeCompare(b[0]))
])
const insuranceContextKey = () => JSON.stringify([insuranceIdentityKey(), s.value, String(d.value.appId || ''), String(appStoreId.value || '')])
const insuranceScope = () => ({ epoch: insuranceEpoch, key: insuranceContextKey() })
const currentInsuranceScope = scope => insurancePageActive && !!getToken() && !!experience.account && experience.mode === 'staff'
  && s.value === 4 && hasStaffAccess.value && scope.epoch === insuranceEpoch && scope.key === insuranceContextKey()
function resetInsuranceView() {
  cand.value = {}; plans.value = []; apply.value = null; selPlan.value = null; startDate.value = ''; lastEndDate.value = ''
  insuranceCalendar.value = false; insuranceCanEdit.value = false; insuranceStoreId.value = null
  insuranceLoading.value = false; insuranceError.value = ''
  notices.value = []; noticeState.value = ''; insCounts.value = { toBuy: 0, effective: 0, all: 0 }
}
function clearInsuranceState() {
  insuranceEpoch++; insuranceRequest++; noticeRequest++
  resetInsuranceView(); insuranceSubmitting.value = false
}
// 最近一条申请已出单、保单 7 天内到期或已到期、也没有在途申请时，服务端给 apply.renewable=true：不再锁成「本次申请已提交」，
// 方案和起保日期放开办续保。起保日默认接在上一张保单之后（defaultStart），日历最早只能选上一张止保日的次日，和服务端同一口径
const lockedInsurance = computed(() => !!apply.value && apply.value.status !== 'rejected' && !apply.value.renewable)
const renewing = computed(() => !!apply.value && !!apply.value.renewable)
const insuranceMinDate = computed(() => {
  const today = todayCn(), next = shiftDate(lastEndDate.value, 1)
  return next && next > today ? next : today
})
const selPlanObj = computed(() => plans.value.find(p => p.planId === selPlan.value) || null)
const periodText = computed(() => {
  if (lockedInsurance.value) return `${apply.value.startDate} 至 ${apply.value.endDate}`
  if (!startDate.value || !selPlanObj.value) return ''
  const days = selPlanObj.value.days
  return `${startDate.value} 至 ${shiftDate(startDate.value, days - 1)}（${days}天）`
})
const premiumText = computed(() => {
  const price = lockedInsurance.value ? apply.value.priceYuan : selPlanObj.value?.priceYuan
  return price == null ? '—' : '¥' + price
})
const canInsure = computed(() => insuranceCanEdit.value)
const buyLabel = computed(() => insuranceSubmitting.value ? '正在提交…' : lockedInsurance.value ? '本次申请已提交' : (canInsure.value ? (renewing.value ? '提交续保申请' : '提交投保申请') : '请由本店有保险申请权限的人员办理'))
const canBuy = computed(() => !!(!insuranceLoading.value && !insuranceError.value && !insuranceSubmitting.value && canInsure.value && cand.value.insurable && selPlanObj.value && startDate.value && !lockedInsurance.value))
const applyTitle = computed(() => {
  if (!apply.value) return ''
  return apply.value.statusLabel || '投保状态待核实'
})
const storeLabel = computed(() => staffStores.value.find(g => String(g.storeId) === String(insuranceStoreId.value))?.storeName || d.value.storeName || '')

// 通知记录原先写死「已通知候选人 / 已通知商家 · 已送达」，被驳回、没通知候选人的申请也这么写。
// 改为读这条投保申请真实的站内信记录（收件人类型 + 是否已读），读不到就如实说读不到
const notices = ref([])
const noticeState = ref('')
let noticeRequest = 0
async function loadNotices(applyId) {
  const request = ++noticeRequest, scope = insuranceScope(), insuranceVersion = insuranceRequest
  notices.value = []
  noticeState.value = applyId ? 'loading' : ''
  if (!applyId) return
  try {
    const res = await apiStaffPolicyNotices(applyId)
    if (request !== noticeRequest || insuranceVersion !== insuranceRequest || !currentInsuranceScope(scope)) return
    notices.value = res.data || []
    noticeState.value = ''
  } catch (e) {
    if (request === noticeRequest && insuranceVersion === insuranceRequest && currentInsuranceScope(scope)) noticeState.value = 'error'
  }
}
const noticeLine = (to, label) => {
  if (noticeState.value === 'loading') return { text: '⊙ ' + label, state: '读取中…' }
  if (noticeState.value === 'error') return { text: '⊙ ' + label, state: '通知记录读取失败' }
  const rows = notices.value.filter(n => n.to === to)
  if (!rows.length) return { text: '⊙ ' + label, state: '未发送通知' }
  const read = rows.filter(n => n.read).length
  return {
    text: '⊙ 已通知' + label + (rows.length > 1 ? ' ' + rows.length + ' 条' : ''),
    state: read === 0 ? '已送达 · 未读' : (read === rows.length ? '已读' : '已读 ' + read + '/' + rows.length)
  }
}
const noticeUser = computed(() => noticeLine('候选人', '候选人（' + (cand.value.name || '') + '）'))
const noticeStore = computed(() => noticeLine('门店员工', '门店员工（' + storeLabel.value + '）'))

async function toInsurance() {
  const id = d.value.appId
  s.value = 4
  const scope = insuranceScope(), request = ++insuranceRequest
  const current = () => currentInsuranceScope(scope) && request === insuranceRequest
  resetInsuranceView()
  if (!current()) return
  insuranceLoading.value = true
  if (!id) { insuranceLoading.value = false; insuranceError.value = '请先从报名详情选择需要投保的候选人'; return }
  try {
    // 代招报名的管理门店可能不同于实际招募门店，保险范围以服务端返回的履约店为准。
    const one = await apiStaffInsuranceForApp(id)
    if (!current()) return
    const data = one.data || {}
    const storeId = data.storeId
    if (!storeId || String(data.candidate?.appId) !== String(id)) throw new Error('保险所属门店或候选人信息不完整，请重新加载')
    const grant = staffStores.value.find(g => String(g.storeId) === String(storeId))
    if (!grant) throw new Error('该报名实际招募门店暂无员工授权')
    const [all, permissions] = await Promise.all([
      apiStaffInsurance({ storeId, tab: 'toBuy' }), loadStaffPerms(grant)
    ])
    if (!current()) return
    if (!permissions) throw new Error('投保权限读取失败，请重新加载')
    insuranceCanEdit.value = ['yes', 'part'].includes((permissions.insurance || [])[PERM_ACTIONS.indexOf('edit')])
    insuranceStoreId.value = storeId
    cand.value = data.candidate || {}; plans.value = data.plans || []; apply.value = data.apply || null
    startDate.value = data.defaultStart || ''
    lastEndDate.value = data.lastEndDate || ''
    selPlan.value = plans.value.find(p => p.planId === apply.value?.planId)?.planId || plans.value[0]?.planId || null
    insCounts.value = { toBuy: 0, effective: 0, all: 0, ...((all.data || {}).counts || {}) }
    loadNotices(apply.value && apply.value.applyId)
  } catch (e) {
    if (current()) insuranceError.value = errText(e, '保险信息加载失败')
  } finally { if (current()) insuranceLoading.value = false }
}
const reloadInsurance = () => deepInsuranceAppId ? loadSchedule() : toInsurance()
function pickStart() {
  if (lockedInsurance.value || insuranceSubmitting.value) return
  if (!selPlanObj.value) return toast('请先选择保险方案')
  insuranceCalendar.value = true
}
function confirmStart(date) { startDate.value = date; insuranceCalendar.value = false }
async function buy() {
  if (!canBuy.value) {
    if (!canInsure.value) return toast('请由本店有保险申请权限的商家或工作人员提交')
    if (!cand.value.insurable) return toast('商家确认录用后才能投保')
    return toast(lockedInsurance.value ? '这位候选人已有投保申请' : '请先选择可用的保险方案')
  }
  const scope = insuranceScope(), p = selPlanObj.value
  const payload = { appId: cand.value.appId, planId: p.planId, startDate: startDate.value }
  const formKey = () => JSON.stringify([cand.value.appId, selPlan.value, startDate.value])
  const form = formKey()
  const current = () => currentInsuranceScope(scope) && form === formKey() && insuranceCanEdit.value && !lockedInsurance.value
  if (!current()) return
  insuranceSubmitting.value = true
  try {
    const r = renewing.value
      ? await modal('提交续保申请', `为 ${cand.value.name} 续保「${p.name}」，从 ${startDate.value} 起保，参考保费 ¥${p.priceYuan}。此操作不付款。提交申请不代表已有保障，出单后按保单日期核对保障。`)
      : await modal('提交投保申请', `为 ${cand.value.name} 申请「${p.name}」，参考保费 ¥${p.priceYuan}。此操作不付款。提交申请不代表已有保障，出单后按保单日期核对保障。`)
    if (!r.confirm || !current()) return
    const res = await apiStaffInsuranceApply(payload)
    if (!current()) return
    toast(res.msg || '投保申请已提交')
    await toInsurance()
  } catch (e) {
    if (currentInsuranceScope(scope)) toast(errText(e, '提交失败'))
  } finally { if (currentInsuranceScope(scope)) insuranceSubmitting.value = false }
}
function openInsuranceFinance() {
  if (!currentInsuranceScope(insuranceScope()) || insuranceLoading.value || insuranceError.value) return
  const parts = ['storeId=' + encodeURIComponent(insuranceStoreId.value || appStoreId.value || '')]
  if (apply.value?.applyId && !renewing.value) parts.push('applyId=' + encodeURIComponent(apply.value.applyId))
  else {
    parts.push('appId=' + encodeURIComponent(cand.value.appId || d.value.appId || ''))
    if (selPlan.value) parts.push('planId=' + encodeURIComponent(selPlan.value))
    if (startDate.value) parts.push('startDate=' + encodeURIComponent(startDate.value))
  }
  go('/pages/staff/insurance-account?' + parts.join('&'))
}
const openInsuranceList = (tab) => {
  if (!insuranceStoreId.value || insuranceLoading.value) return toast('请先等待保险所属门店加载完成')
  go('/pages/staff/insurance?tab=' + tab + '&storeId=' + insuranceStoreId.value)
}
watch(insuranceContextKey, clearInsuranceState, { flush: 'sync' })
let meetingAway = false
onHide(() => { meetingAway = true; insurancePageActive = false; clearInsuranceState() })
onUnload(() => { insurancePageActive = false; clearInsuranceState() })
onShow(() => { insurancePageActive = true; if (meetingAway && s.value === 2) refreshMeetingInfo(); meetingAway = false; if (s.value === 4) { if (deepInsuranceAppId) loadSchedule(); else if (d.value.appId) toInsurance() } })
</script>

<style scoped lang="scss">
.meeting-host-guide { display: flex; flex-direction: column; align-items: flex-start; gap: 10px; padding: 12px 0; border-top: 1px solid var(--k-line); font-size: 13px; line-height: 1.7; color: var(--k-muted); }
.meeting-host-guide__title { font-weight: 600; color: var(--k-ink); font-size: 14px; }
.meeting-copy,.meeting-hint,.meeting-error{display:block;white-space:pre-wrap;overflow-wrap:anywhere;font-size:14px;line-height:1.7}
.meeting-hint{color:var(--k-muted);margin:8px 0}.meeting-error{color:var(--k-alert)}
.meeting-actions{display:flex;flex-wrap:wrap;gap:10px;margin-top:12px}.meeting-editor{margin-top:16px}
.detail .candidate-card{height:auto;min-height:87px}.detail .candidate-copy{gap:6px}.detail .candidate-side{flex-shrink:0}
/* 腾讯会议：会议号、密码用大号数字方便对着手输；编辑区三栏单行输入 */
.tm-row{display:flex;align-items:baseline;gap:12px;margin:2px 0 4px;font-size:13px;color:var(--k-muted)}.tm-code{color:var(--k-ink);font:700 20px/1.3 var(--k-sans);letter-spacing:1px}.tm-link{flex:1;min-width:0;color:var(--k-ink);overflow-wrap:anywhere}
.tm-field{display:flex;align-items:center;gap:12px;min-height:46px;border-bottom:1px solid var(--k-line);font-size:14px}.tm-field>text{flex-shrink:0;width:5em;color:var(--k-muted)}.tm-field input{flex:1;min-width:0;height:46px;font-size:14px}
.insurance-help{display:flex;flex-direction:column;gap:10px;font-size:14px;line-height:1.7;color:var(--k-muted);padding:14px 0}

.interview-store{padding:12px 16px;font-size:14px;line-height:1.7;color:var(--k-muted)}
/* 双向确认 · 用户一栏：候选人面试后问卷（差评项标红） */
.feedback-list{margin-top:10px;padding:6px 10px;border-radius:8px;background:var(--k-paper2)}.feedback-row{display:flex;justify-content:space-between;gap:14px;padding:4px 0;font-size:12px;line-height:1.6}.feedback-row>text:first-child{flex-shrink:0;color:var(--k-muted)}.feedback-row>text:last-child{text-align:right;overflow-wrap:anywhere}.feedback-row>text.warn{color:var(--k-alert);font-weight:700}.feedback-empty{display:block;margin-top:8px;font-size:12px;color:var(--k-muted)}
.interview-page{background:var(--k-bg)}button{margin:0;padding:0;border:0;background:transparent;line-height:1.2}.date-row{height:48px;padding:0 10px;display:flex;align-items:center;justify-content:space-between;gap:6px}.date-pill{min-width:57px;padding:0 9px;height:36px;border:1px solid var(--k-line2);border-radius:18px;background:var(--k-paper);font-size:13px;display:flex;align-items:center;justify-content:center;gap:4px}.date-pill.week{min-width:59px;flex-shrink:0}.date-title{min-width:0;flex:1;text-align:center;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;font-family:var(--k-serif);font-size:15px;font-weight:700}
/* 2026-11-03 主人：简化——‹ 今天 › 左右箭头，箭头 44px 见方好点 */
.date-nav{flex-shrink:0;display:flex;align-items:center}.date-arrow{width:44px;height:44px;display:flex;align-items:center;justify-content:center}.summary-card{margin:0 14px 9px;padding:8px;border:1px solid var(--k-line2);border-radius:10px;background:var(--k-paper)}.summary-title{display:block;margin:0 2px 7px;font-family:var(--k-serif);font-size:14px;font-weight:700}.red-text{color:var(--k-red-deep)}.summary-grid{display:flex;gap:8px}.summary-item{height:35px;flex:1;border:1px solid var(--k-line2);border-radius:8px;display:flex;align-items:center;justify-content:center;gap:10px;font-family:var(--k-serif);font-size:13px;font-weight:700}.summary-item text:last-child{font-size:19px}.summary-item.amber{color:#A66A30}.summary-item.indigo{color:var(--k-indigo)}.summary-item.green{color:var(--k-green)}.interview-list{padding:0 14px 86px}.interview-card{position:relative;min-height:96px;margin-bottom:6px;padding:9px 8px 8px 13px;border:1px solid var(--k-line2);border-radius:10px;background:var(--k-paper);box-sizing:border-box;display:flex}.interview-card:before{content:'';position:absolute;left:0;top:0;bottom:0;width:4px;border-radius:10px 0 0 10px;background:var(--k-alert)}.interview-card.blue:before{background:var(--k-indigo)}.interview-card.green:before{background:var(--k-green)}.interview-card.amber:before{background:#B66A19}.interview-copy{min-width:0;flex:1;display:flex;flex-direction:column;gap:3px}.time-line{display:flex;align-items:center;gap:9px}.time{font-size:14px;font-weight:700}.status{padding:2px 6px;border-radius:9px;background:var(--k-paper2);color:#A76A34;font-size:10px}.blue .status{color:var(--k-indigo)}.green .status{color:var(--k-green)}.red .status{color:var(--k-alert);background:var(--k-alert-soft)}.person{font-family:var(--k-serif);font-size:14px;font-weight:700}.job,.place,.source{font-size:10px;color:var(--k-muted)}.person,.job,.place,.source{overflow:hidden;white-space:nowrap;text-overflow:ellipsis}.interview-actions{flex-shrink:0;width:102px;display:flex;flex-direction:column;gap:6px}.video-button,.change-button{height:36px;border-radius:6px;display:flex;align-items:center;justify-content:center;gap:7px;font-family:var(--k-serif);font-size:14px;font-weight:700}.video-button{background:var(--k-red);color:#fff;border:2px solid var(--k-red-deep);box-shadow:inset 0 0 0 1px rgba(255,255,255,.25)}.change-button{border:1px solid var(--k-red-line);background:var(--k-paper)}
.detail{padding:0 14px calc(88px + var(--k-safe-bottom))}.candidate-card{height:87px;padding:10px;border:1px solid var(--k-line2);border-radius:10px;background:var(--k-paper);display:flex;gap:10px;box-sizing:border-box}.candidate-avatar{width:54px;height:54px;border-radius:8px}.candidate-copy{min-width:0;flex:1;display:flex;flex-direction:column;gap:8px}.candidate-name,.candidate-job{font-family:var(--k-serif);font-size:15px;font-weight:700}.candidate-meta,.candidate-sub{font-family:var(--k-sans);font-size:11px;color:var(--k-muted);font-weight:400}.candidate-side{display:flex;flex-direction:column;align-items:flex-end;justify-content:space-between;color:var(--k-muted);font-size:10px}.candidate-side text:first-child{color:var(--k-green);font-size:16px;font-weight:700}.detail-section{margin-top:9px;padding:10px;border:1px solid var(--k-line2);border-radius:10px;background:var(--k-paper)}.section-title{display:block;margin-bottom:9px;font-family:var(--k-serif);font-size:15px;font-weight:700}.slot-row{display:flex;gap:9px}.slot{position:relative;height:58px;flex:1;border:1px solid var(--k-line2);border-radius:8px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:7px}.slot text:first-child{font-family:var(--k-serif);font-size:14px;font-weight:700}.slot text:nth-child(2){font-size:11px;color:var(--k-muted)}.slot.selected{border:1.5px solid var(--k-red)}.slot-check{position:absolute;right:-1px;bottom:-1px;width:20px;height:20px;border-radius:50% 0 8px 0;background:var(--k-red);display:flex;align-items:center;justify-content:center}.devices{padding-bottom:9px}.device-row{display:flex;gap:9px}.device{height:54px;flex:1;border:1px solid var(--k-line2);border-radius:8px;display:flex;align-items:center;justify-content:center;gap:8px}.device>view{display:flex;flex-direction:column;gap:5px;font-size:12px}.device>view text:last-child{color:var(--k-green);font-size:10px}.outline{padding-bottom:7px}.question{display:flex;gap:8px;align-items:center;margin:6px 0;font-size:11px}.question>text:first-child{flex-shrink:0;width:18px;height:18px;border:1px solid var(--k-line2);border-radius:50%;display:flex;align-items:center;justify-content:center}.expand{display:block;text-align:center;margin-top:8px;color:var(--k-muted);font-size:11px}.operations{padding-bottom:9px}
/* 2026-11-03 主人：简化——面试操作四个大按钮（两行两列，每个 46px 高），置灰的一眼能看出来；评分星星每颗 44px 触摸区 */
.operation-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}.op-btn{height:46px;border:1px solid var(--k-red-line);border-radius:8px;background:var(--k-paper);display:flex;align-items:center;justify-content:center;gap:7px;font-family:var(--k-serif);font-size:15px;font-weight:700;color:var(--k-ink)}.op-btn.primary{background:var(--k-red);border-color:var(--k-red);color:#fff}.op-btn[disabled]{opacity:.45}.op-hint{display:block;margin-top:8px;color:var(--k-muted);font-size:12px;line-height:1.6}
.rating{padding-bottom:8px}.rating .section-title{margin-bottom:4px}.muted{font-family:var(--k-sans);font-size:11px;color:var(--k-muted);font-weight:400}.stars{display:flex;justify-content:center;gap:4px}.star-btn{width:44px;height:44px;display:flex;align-items:center;justify-content:center}.star-btn[disabled]{opacity:.6}.rate-label{display:block;text-align:center;color:var(--k-muted);font-size:12px;line-height:1.6}
.confirm-page{padding:0 14px calc(90px + var(--k-safe-bottom))}.confirm-alert{height:49px;padding:0 12px;border:1px solid #E6C791;border-radius:9px;background:#FFF5E3;display:flex;align-items:center;gap:10px}.confirm-alert>view{display:flex;flex-direction:column;gap:5px;font-size:12px;font-weight:700}.confirm-info,.confirm-card,.result-card{margin-top:9px;padding:12px;border:1px solid var(--k-line2);border-radius:10px;background:var(--k-paper)}.confirm-info{min-height:127px;box-sizing:border-box;display:flex;flex-direction:column;gap:6px;font-size:12px}.confirm-info .section-title{margin-bottom:3px}.confirm-person{display:flex;align-items:center;gap:11px}.confirm-avatar,.shop-avatar{width:51px;height:51px;border-radius:12px}.shop-avatar{border:1px solid var(--k-line2);background:var(--k-paper2);display:flex;align-items:center;justify-content:center}.confirm-copy{min-width:0;flex:1;display:flex;flex-direction:column;gap:8px;font-size:12px}.confirm-copy text:first-child{font-family:var(--k-serif);font-size:15px;font-weight:700}.confirm-copy text:last-child{color:var(--k-muted)}.confirmed{display:flex;align-items:center;gap:6px;color:var(--k-green);font-weight:700}.confirm-badge{width:34px;height:34px;border-radius:50%;background:var(--k-green);display:flex;align-items:center;justify-content:center}.result-badge{width:42px;height:42px;flex:0 0 auto}.confirm-actions{display:flex;gap:10px;margin-top:10px}.confirm-actions button{height:38px;flex:1;display:flex;align-items:center;justify-content:center;border-radius:7px;background:var(--k-paper);font-family:var(--k-serif);font-size:14px;font-weight:700}.confirm-actions .pass{border:1px solid var(--k-green);color:var(--k-green)}.confirm-actions .fail{border:1px solid var(--k-alert);color:var(--k-alert)}.confirm-actions .pending{border:1px solid #D69242;color:#B66A19}.shop-card{min-height:141px;box-sizing:border-box;padding-top:9px;padding-bottom:9px}.shop-card .section-title{margin-bottom:4px}.shop-card .confirm-actions{margin-top:7px}.shop-card .confirm-actions button{height:34px}.result-card{background:#F4F8F1}.result-copy{display:flex;align-items:center;gap:12px}.result-copy>view:last-child{display:flex;flex-direction:column;gap:3px;color:var(--k-muted);font-size:11px}.result-copy>view:last-child text:first-child{color:var(--k-green);font-family:var(--k-serif);font-size:16px;font-weight:700}.result-card>button{width:100%;height:38px;display:flex;align-items:center;justify-content:center;margin-top:5px;border-radius:7px;background:var(--k-red);color:#fff;font-family:var(--k-serif);font-size:15px;font-weight:700}
.insurance-page{padding:0 14px calc(88px + var(--k-safe-bottom))}.insurance-tabs{height:42px;display:flex}.insurance-tabs>view{flex:1;display:flex;align-items:center;justify-content:center;gap:7px;color:var(--k-muted);font-size:13px}.insurance-tabs>view.active{height:31px;border-radius:8px;background:var(--k-red);color:#fff}.insured-card{min-height:83px;padding:9px;border:1px solid var(--k-line2);border-radius:10px;background:var(--k-paper);display:flex;gap:12px}.insured-avatar{width:61px;height:61px;border-radius:8px}.insured-card>view{min-width:0;flex:1;display:flex;flex-direction:column;gap:7px}.insured-card>view text:first-child,.insured-card>view text:nth-child(2){font-family:var(--k-serif);font-size:15px;font-weight:700}.insured-card>view text:last-child{font-size:11px;color:var(--k-muted)}.insurance-title{display:block;margin:12px 0 7px;font-family:var(--k-serif);font-size:16px;font-weight:700}.plan-card{height:54px;margin-bottom:7px;padding:7px 10px;border:1px solid var(--k-line2);border-radius:9px;background:var(--k-paper);display:flex;align-items:center;gap:10px}.plan-card.selected{border:1.5px solid var(--k-red)}.radio{width:21px;height:21px;border:1.5px solid var(--k-line2);border-radius:50%;display:flex;align-items:center;justify-content:center}.selected .radio{background:var(--k-red);border-color:var(--k-red)}.plan-copy{min-width:0;flex:1;display:flex;flex-direction:column;gap:5px}.plan-copy text:first-child{font-family:var(--k-serif);font-size:13px;font-weight:700}.plan-copy text:last-child{color:var(--k-muted);font-size:10px}.plan-copy text{overflow:hidden;white-space:nowrap;text-overflow:ellipsis}.plan-price{flex-shrink:0;display:flex;align-items:baseline;gap:3px;color:var(--k-muted);font-size:12px}.plan-price text:first-child{color:var(--k-red);font-family:var(--k-serif);font-size:20px;font-weight:700}.insurance-row{height:38px;margin-bottom:6px;padding:0 10px;border:1px solid var(--k-line2);border-radius:8px;background:var(--k-paper);display:flex;align-items:center;gap:8px;font-size:12px}.insurance-row>text:first-child{font-family:var(--k-serif);font-size:14px;font-weight:700}.insurance-row>text:nth-child(2){margin-left:auto}.insurance-row.total>text:last-child{color:var(--k-red);font-size:21px;font-weight:700}.buy{width:100%;height:44px;display:flex;align-items:center;justify-content:center;border-radius:8px;background:var(--k-red);color:#fff;font-family:var(--k-serif);font-size:16px;font-weight:700}.success-card{position:relative;min-height:95px;box-sizing:border-box;margin-top:10px;padding:9px 12px;border:1px solid #CDDCC8;border-radius:10px;background:#F4F8F1;display:flex;align-items:center;gap:12px}.success-card>view{min-width:0;flex:1;padding-right:56px;display:flex;flex-direction:column;gap:4px;color:var(--k-muted);font-size:10px}.success-card>view text:first-child{font-family:var(--k-serif);font-size:15px;font-weight:700;color:var(--k-ink)}.success-card>text{position:absolute;right:12px;top:10px;padding:3px 8px;border:1px solid var(--k-green);border-radius:12px;color:var(--k-green);font-size:11px}.notice-card{margin-top:9px;padding:10px;border:1px solid var(--k-line2);border-radius:10px;background:var(--k-paper)}.notice-card>view{display:flex;justify-content:space-between;margin-top:7px;color:var(--k-muted);font-size:11px}.notice-card>view text:last-child{color:var(--k-green)}
</style>
