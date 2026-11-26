<template>
  <view class="k-page staff-apps">
    <template v-if="s === 1">
      <k-topbar><template #left><view class="brand" hover-class="k-press" @click="openStoreSwitch"><text>{{ brandName }}</text><k-icon name="chevron-down" :size="16" color="ink" /></view></template><view class="status-tabs"><view v-for="t in statusTabs" :key="t" :class="{ active: statusTab===t }" hover-class="k-press" @click="statusTab=t"><text>{{ t }}</text></view></view><view class="type-tabs"><view v-for="t in typeTabs" :key="t.value" :class="{active: typeTab===t.value}" hover-class="k-press" @click="typeTab=t.value"><text>{{ t.label }}</text></view></view></k-topbar>
    <k-subscribe scenes="apply_progress,online_task" label="订阅报名与任务提醒" />
      <view class="apps-body k-pad-tab">
        <view v-if="jobFilter" class="date-scope"><view><text class="date-scope__title">当前任务的报名</text><text class="k-muted">{{ applicationStoreName }}</text></view><button @click="clearJobFilter">查看本店全部</button></view>
        <view v-if="submitDate" class="date-scope"><view><text class="date-scope__title">{{ dateScopeText }}</text><text class="k-muted">{{ applicationStoreName }}</text></view><button @click="clearSubmitDate">全部日期</button></view>
        <k-employment-list v-if="typeTab !== 'online'" :store-id="applicationStoreId" :auto-open="employmentEntry" />
        <view v-if="typeTab !== 'online'" class="applications-tools"><view class="applications-tools__main"><k-button type="outline" block @click="go(staffStoreUrl(R.staffInterviews, applicationStoreId))" label="面试日程与时段" /></view><!-- 2026-11-03 主人：一键选时间、一键导出到店名单（身份证号、手机号、去哪家、起止时间）；只有「岗位管理·导出」有权限的角色看得到 --><view v-if="canExportList" class="applications-tools__export"><k-button type="secondary" block icon="file-down" label="导出名单" @click="go(APPLICANT_EXPORT_PAGE)" /></view></view><view class="sort-row"><view hover-class="k-press" @click="pickSort"><text>{{ sortText }}</text><k-icon name="chevron-down" :size="12" color="muted" /></view><k-icon name="filter" :size="16" color="ink2" @click="pickFilter" /><text>共 {{ total }} 份</text></view><view v-if="listLoading" class="list-state">正在读取报名…</view><view v-else-if="listError" class="list-state"><text>{{ listError }}</text><k-button type="outline" @click="fetchApplications()" label="重新加载" /></view><view v-else-if="!applications.length" class="list-state"><text>{{ submitDate ? '该日期暂无符合条件的报名' : '暂无符合条件的报名' }}</text><text v-if="submitDate">可切换状态或查看全部日期。</text></view><view v-for="app in applications" :key="app.appId" class="app-card" hover-class="k-press-s" @click="openDetail(app)"><view class="app-avatar"><image :src="app.avatar" mode="aspectFill" /><text>{{ app.state }}</text></view><view class="app-copy"><view><text class="app-name">{{ app.name }}（昵称）</text><k-chip v-if="app.urgent" tone="red">加急</k-chip><text>{{ app.code }}</text></view><text class="app-line">{{ [app.role, app.type].filter(Boolean).join(' · ') }}</text><text class="app-line">{{ app.place }}</text></view><view class="app-side"><text v-if="app.match" class="match">{{ app.match }}%匹配</text><text v-if="app.over" class="over">△ {{ app.over }}</text><text v-if="app.wait">已等待 {{ app.wait }}</text></view></view></view><k-tabbar mode="staff" :active="onlineStaff || merchantService ? 'business' : 'work'" /></template>

    <template v-else-if="s === 2">
      <k-topbar title="报名详情" back custom-back @back="backToList" />
      <k-order-mediation merchant order-type="application" :order-id="detail?.appId" />
      <view class="detail-body k-pad-bottom"><view class="candidate"><image :src="dAvatar" mode="aspectFill" /><view><text class="candidate-name">{{ dName }}</text><text>{{ dContact }}</text></view><view v-if="!isOnline" class="candidate-schedule"><text class="match large">{{ dStay }}</text><text>可停留时长</text></view></view><view class="apply-meta"><view><text>应聘岗位</text><text>{{ dType }}</text><text>{{ dJob }}</text></view><view><text>报名时间　{{ dSubmit }}</text><text>来源　　小程序报名</text></view></view><view v-if="stage" class="stage-banner" :class="'stage-banner--' + stage.tone"><text class="stage-banner__label">当前：{{ stage.label }}</text><text v-if="stage.date" class="stage-banner__date">{{ stage.date }}</text></view><view class="steps"><view v-for="(st,i) in steps" :key="st" :class="'step--' + (stepClass(i) || 'todo')"><view class="step-circle" :class="stepClass(i)"><k-icon v-if="stepClass(i) === 'done'" name="check" :size="12" color="white" /><k-icon v-else-if="stepClass(i) === 'stopped'" name="x" :size="12" color="muted" /><text v-else>{{i+1}}</text></view><text class="step-label">{{st}}</text></view></view><view class="action-status" aria-live="polite"><text v-if="detailLoading">正在读取最新报名状态…</text><template v-else-if="detailError"><text>{{ detailError }}</text><k-button type="outline" size="sm" @click="openDetail(current)" label="重新加载" /></template><template v-else><text>{{ actionHint }}</text><view v-if="pointsRule" class="points-rule" hover-class="k-press" @click="ruleOpen = !ruleOpen"><text>积分规则</text><k-icon :name="ruleOpen ? 'chevron-up' : 'chevron-down'" :size="14" color="muted" /></view><text v-if="pointsRule && ruleOpen" class="points-rule__body">{{ pointsRule }}</text></template></view><view v-if="!isOnline && extras?.resume" class="candidate-profile"><view v-for="field in profileFields" :key="field.key" class="profile-item"><text class="profile-item__label">{{ field.label }}</text><text class="profile-item__value">{{ field.value }}</text></view><image v-if="extras.resume.lifePhotoUrl" :src="absUrl(extras.resume.lifePhotoUrl)" class="candidate-portrait" mode="aspectFill" @click="previewResumeMedia(extras.resume.lifePhotoUrl)" /><view v-if="extras.resume.media?.length" class="candidate-media"><template v-for="media in extras.resume.media" :key="media.key"><video v-if="media.kind === 'video'" :src="absUrl(media.url)" controls :show-fullscreen-btn="true" /><image v-else :src="absUrl(media.url)" mode="aspectFill" @click="previewResumeMedia(media.url)" /></template></view></view><view v-if="detailReady && detail.interviewOfferRole" id="interview-offers" class="section"><k-interview-slots :key="detail.appId + '-' + detail.interviewOfferRole" :app-id="detail.appId" :offer-role="detail.interviewOfferRole" @chosen="openDetail(current)" @stage-changed="openDetail(current)" /></view><view v-if="detailReady" class="contact-actions"><k-button type="outline" @click="go(R.chat + '?appId=' + detail.appId)" label="联系报名人" /><k-button v-if="interviewInfo" type="outline" @click="openInterview" :label="curStatus === 'interview_booked' ? '面试详情与改期' : '去面试详情'" /><k-button v-if="showInsurance" type="outline" @click="openInsurance" label="办理／查看保险" /><k-button v-if="isOnline && detail.status !== 'submitted'" @click="go(R.staffOnline + '?appId=' + detail.appId)" :label="restricted ? '查看成果' : '成果与结算'" /></view><view v-if="!isOnline" class="section"><text class="section-title">技能标签</text><view class="skill-row"><text v-for="t in shownSkills" :key="t">{{t}}</text><text v-for="t in storeTags" :key="'store-' + t" class="store-tag" @click="removeStoreTag(t)">{{ t }}{{ detail && detail.canTag ? '　×' : '' }}</text><view v-if="detail && detail.canTag" hover-class="k-press" @click="addStoreTag"><k-icon name="plus" :size="18" color="ink" /></view></view><text v-if="resumeSkill" class="resume-skill">简历里的技能描述：{{ resumeSkill }}</text></view><view v-if="!isOnline" class="section"><text class="section-title">经历记录</text><view v-for="e in experiences" :key="e.key" class="experience"><view class="timeline-dot" /><view><text>{{e.date}}　 {{e.place}}　 {{e.role}}</text><text>{{e.desc}}</text></view></view><text v-if="!experiences.length && expEmpty" class="exp-empty">{{ expEmpty }}</text></view><view v-if="!isOnline && feedbackRows.length" class="section"><text class="section-title">面试后反馈（候选人填写）</text><view v-for="f in feedbackRows" :key="f.label" class="feedback-row"><text>{{ f.label }}</text><text :class="{ warn: f.warn }">{{ f.value }}</text></view></view><view v-if="isOnline" class="section online-note"><text class="section-title">接单说明</text><text>{{ detail?.note || '未填写' }}</text><text>全国远程完成，审核通过后即可提交成果。</text></view><view v-else class="section available"><text class="section-title">可到岗时间</text><view><k-icon name="calendar-check" :size="18" color="ink2" /><view><text>{{ dArrival }}</text><text>{{ dStay }}</text></view></view></view>
        <view id="volunteer-agreement"><volunteer-contract v-if="detailReady && detail.jobType === 'volunteer' && detail.canReviewVolunteerContract === true" ref="volunteerAgreement" :key="detail.appId" :app-id="detail.appId" @changed="openDetail(current)" /></view>
        <k-application-dates v-if="datesVisible && detailReady && !isOnline" :app-id="detail.appId" merchant />
        <view v-if="detailReady && !isOnline && ['onboarded', 'completed'].includes(curStatus) && detail.canViewWorkEnd === true" id="work-end"><k-work-end :app-id="detail.appId" staff :focus-on-load="workEndTarget === Number(detail.appId)" @focus="focusEndRecord" @updated="openDetail(current)" /></view>
        <k-employment-status v-if="detailReady && !isOnline && ['onboarded', 'completed'].includes(curStatus)" :app-id="detail.appId" />
        <view v-if="detailReady && !isOnline && detail.canViewRecruitmentDetails === true" class="section arrival-info">
          <view class="arrival-info__head"><text class="section-title">到店信息</text><k-button type="outline" size="sm" @click="openDetail(current)" label="刷新到店信息" /></view>
          <template v-if="arrivalInfo">
            <view v-for="field in arrivalFields" :key="field.label" class="arrival-info__row"><text>{{ field.label }}</text><text>{{ field.value }}</text></view>
            <text class="arrival-info__label">票据截图</text>
            <view v-if="arrivalTickets.length" class="arrival-info__tickets"><image v-for="(url, index) in arrivalTickets" :key="url" :src="url" mode="aspectFill" @click="previewArrivalTicket(index)" /></view>
            <text v-else class="k-muted">{{ arrivalTicketState || '未上传票据' }}</text>
            <text class="arrival-info__label">到店备注</text><text class="arrival-info__note">{{ arrivalInfo.note || '未填写' }}</text>
            <text v-if="arrivalInfo.updateTime" class="arrival-info__hint">更新于 {{ arrivalInfo.updateTime }}</text>
          </template>
          <text v-else class="k-muted">报名人尚未填写到店信息</text>
        </view>
      </view><k-bottom pad="10px 14px"><view class="action-wrap detail-reject"><k-button type="secondary" size="lg" block :disabled="!canReject" @click="onReject" :label="rejectLabel" /></view><view class="action-wrap detail-pass"><k-button size="lg" block :label="passLabel" :disabled="!canPass" @click="onPass" /></view><view v-if="detailReady && detail?.canNotifyRecruitManager" class="action-wrap detail-forward"><k-button type="secondary" size="lg" block :disabled="notifyingManager" @click="notifyManager" label="通知主理人" /></view><view v-else-if="canShareResume" class="action-wrap detail-forward"><k-button type="secondary" size="lg" block :disabled="!detailReady || actionBusy" @click="s=3" label="转发脱敏简历" /></view></k-bottom></template>

    <template v-else-if="s === 3 && canShareResume">
      <k-topbar title="脱敏简历" back custom-back @back="s=2" />
      <view class="masked-body k-pad-bottom"><view class="masked-tip"><k-icon name="shield-check" :size="16" color="green" /><text>已脱敏处理，隐去联系方式与具体地址</text></view><view class="resume-card"><view class="resume-head"><view class="avatar-placeholder"><k-icon name="user-round" :size="28" color="light" /></view><view><text class="candidate-name">{{ dMaskedName }}</text><text>{{ dAge }}</text></view><view v-if="!isOnline" class="candidate-schedule"><text class="match large">{{ dStay }}</text><text>可停留时长</text></view></view><view class="resume-line"><text>应聘岗位</text><text>{{ dJob }}</text></view><view v-if="!isOnline" class="resume-block"><text class="section-title">技能标签</text><view class="skill-row"><text v-for="t in maskedSkills" :key="t">{{t}}</text></view></view><view v-if="!isOnline" class="resume-block"><text class="section-title">经历记录</text><view v-for="e in experiences" :key="e.key" class="experience"><view class="timeline-dot" /><view><text>{{e.date}}　 {{e.place}}　 {{e.role}}</text><text>{{e.desc}}</text></view></view><text v-if="!experiences.length && expEmpty" class="exp-empty">{{ expEmpty }}</text></view><view v-if="!isOnline" class="resume-block available"><text class="section-title">可到岗时间</text><view><k-icon name="calendar-check" :size="18" color="ink2" /><view><text>{{ dArrival }}</text><text>{{ dStay }}</text></view></view></view><view class="resume-foot"><k-icon name="lock" :size="18" color="#A98A61" /><view><text>本简历已脱敏，仅用于招聘协作</text><text>仅供本次招聘协作查看</text></view><view class="stamp"><text>袋鼠全球青年</text><text>脱敏简历</text></view></view></view></view><k-bottom pad="10px 16px"><view class="action-wrap resume-preview"><k-button type="outline" size="lg" block @click="previewOriginal" label="预览原简历（仅自己可见）" /></view><view class="action-wrap resume-send"><k-button size="lg" block @click="s=4" label="转发" /></view></k-bottom></template>

    <template v-else-if="s === 4 && canShareResume">
      <k-topbar title="转发脱敏简历" back custom-back @back="s=3" />
      <view class="forward-body k-pad-tab">
        <text class="forward-title">转发给</text>
        <view class="target-row">
          <view v-for="option in forwardTargets" :key="option.value" class="target" :class="{ active: target === option.value }" hover-class="k-press-s" @click="selectForwardTarget(option.value)">
            <k-icon :name="option.icon" :size="22" :color="target === option.value ? 'red' : 'muted'" />
            <view><text>{{ option.label }}</text><text>{{ option.note }}</text></view>
            <view v-if="target === option.value" class="target-check"><k-icon name="check" :size="10" color="white" :stroke="3" /></view>
          </view>
        </view>
        <view v-if="target === 'cross_store'" class="forward-store-picker">
          <input v-model="storeSearch" :disabled="forwarding" maxlength="30" placeholder="搜索门店或城市" aria-label="搜索转发门店" @confirm="searchForwardStores" />
          <k-button type="outline" size="sm" :disabled="forwarding || searchingStores" @click="searchForwardStores" label="搜索门店" />
          <text v-if="searchingStores">正在加载门店…</text>
          <text v-else-if="storeSearchError">{{ storeSearchError }}</text>
          <text v-else-if="!forwardStores.length">没有匹配的可接收门店，请换个关键词。</text>
          <button v-for="store in forwardStores" :key="store.storeId" :disabled="forwarding" class="forward-store-option" :class="{selected: targetStoreId === store.storeId}" @click="targetStoreId = store.storeId; forwardLeadOnly = false">{{ [store.storeName, store.city].filter(Boolean).join(' · ') }}{{ targetStoreId === store.storeId ? ' ✓' : '' }}</button>
          <button v-if="targetAllowsLead" :disabled="forwarding" @click="forwardLeadOnly = !forwardLeadOnly">{{ forwardLeadOnly ? '✓ 仅发给该店城市负责人' : '仅发给该店城市负责人' }}</button>
        </view>
        <text class="forward-scope">{{ forwardScope }}</text>
        <text class="forward-label">岗位信息（将一并展示）</text>
        <view class="job-card"><text>{{ dType }}</text><text>{{ dJob }}</text></view>
        <template v-if="target !== 'wechat'">
          <text class="forward-label">审核建议 <text>（可选）</text></text>
          <view class="suggest"><textarea v-if="editingSuggestion" v-model="suggestion" :disabled="forwarding" maxlength="120" :focus="true" auto-focus @blur="suggestion = $event.detail.value; editingSuggestion = false" /><view v-else class="apps-area-idle" hover-class="k-press" @click="!forwarding && (editingSuggestion = true)"><text>{{ suggestion }}</text></view><text>{{ suggestion.length }}/120</text></view>
          <view class="track-row"><view><text>分享追踪</text><text>{{ trackNote }}</text></view><view class="switch" :class="{ on: track }" hover-class="k-press" @click="!forwarding && (track = !track)"><view /></view></view>
        </template>
        <k-button size="lg" block icon="send" :label="forwardButtonLabel" :disabled="forwarding || !detailReady || !forwardStoreId || (target !== 'wechat' && !canForward) || (target === 'cross_store' && !targetStoreId)" @click="doForward" />
        <k-resume-image v-if="target === 'wechat'" ref="resumeImage" />
        <text v-else class="send-note">{{ forwardNote }}</text>
      </view><k-tabbar mode="staff" :active="onlineStaff || merchantService ? 'business' : 'work'" /></template>
    <template v-else-if="s === 5">
      <k-topbar title="收到的脱敏简历" back />
      <view class="shared-resume k-pad-tab">
        <text v-if="sharedLoading">正在读取简历…</text>
        <view v-else-if="sharedError"><text>{{ sharedError }}</text><k-button type="outline" @click="loadSharedResume" label="重新加载" /></view>
        <template v-else-if="sharedResume">
          <text class="k-title">{{ sharedResume.name }}<text v-if="sharedResume.age"> · {{ sharedResume.age }}岁</text></text>
          <text>应聘岗位：{{ sharedResume.jobTitle }}</text>
          <text>技能：{{ (sharedResume.skills || []).join('、') || '未填写' }}</text>
          <text v-if="sharedExps">经历：{{ sharedExps }}</text>
          <text>可到岗日期：{{ sharedResume.arriveDate || '未填写' }}</text>
          <text>转发人：{{ sharedResume.from }}</text>
          <text v-if="sharedResume.suggestion">审核建议：{{ sharedResume.suggestion }}</text>
          <text class="forward-scope">仅用于招聘协作，联系方式和原报名操作不会开放给接收门店。</text>
        </template>
      </view>
    </template>
    <k-date-picker v-if="submitCalendar" title="按提交日期筛选" :value="isYmd(submitDate) ? submitDate : todayCn()" :max-date="todayCn()" @cancel="submitCalendar = false" @confirm="confirmSubmitDate" />
  </view>
</template>

<script setup>
import { ref, computed, onMounted, watch, onBeforeUnmount } from 'vue'
import { onReachBottom, onShow, onHide } from '@dcloudio/uni-app'
import { useScreen, toast, go } from '@/common/screen.js'
import { R } from '@/common/routes.js'
import { apiJobList, apiStaffApplicationDetail, apiStaffAppTag, apiStaffApplications, apiStaffAudit, apiStaffConfirm, apiStaffOnboard, apiStaffTerminate, apiNotifyRecruitManager, apiResumeForward, apiResumeForwards, apiSharedResume, apiResumePoster, apiStaffVolunteerDone } from '@/common/api.js'
import { experience, session, ensureSession, hasStaffAccess, currentStaffStore, currentStaffStoreId, staffStores, staffIdentities, staffIdentityLabel, staffStoreUrl, selectStaffStore, onlineStaff, merchantStaff, merchantService } from '@/common/experience.js'
import { sheet, prompt, isYmd, pickPaged, confirm, todayCn } from '@/common/ui.js'
import { absUrl } from '@/common/upload.js'
import { loadArrivalImages, releaseArrivalImages } from '@/common/arrival-media.js'
import { get } from '@/common/request.js'
import { OFFLINE_STEPS, ONLINE_STEPS, STEP_BY_STATUS, ONLINE_STEP_BY_STATUS, stepState, stageBanner, volunteerNextHint, volunteerRule } from './application-stage.js'
import { staffCan, loadStaffPerms } from '@/common/staff-perms.js'
import KEmploymentStatus from './components/k-employment-status.vue'
import KEmploymentList from './components/k-employment-list.vue'
import VolunteerContract from './components/volunteer-contract.vue'

// 消息里的员工待办深链是 /pages/staff/applications?appId=xxx，
// 记下来后在列表拉回时选中对应报名，这样从通知进来也能直接审核。
let deepAppId = 0
let resumeEntry = null
let shareId = 0
const submitDate = ref('')
const typeTab = ref('')
const employmentEntry = ref(false)
// 平台把岗位连报名转到本店的通知（?linked=1&jobType=换工 / 兼职 / 全职）：小院主理人这一次也要看得到，不然通知让他处理、列表里却没有。
// 只带 jobType 的老链接不算，小院主理人照旧只看线上任务
const linkedType = ref('')
const listStoreId = ref(null)
const jobFilter = ref(null)
function clearJobFilter() { jobFilter.value = null; fetchApplications() }
const workEndTarget = ref(0)
const s = useScreen(5, { onLoad: (q) => {
  jobFilter.value = Number(q?.jobId) > 0 ? Number(q.jobId) : null
  shareId = Number(q?.shareId) || 0
  deepAppId = Number(q?.appId) || 0
  workEndTarget.value = q?.focus === 'workEnd' ? deepAppId : 0
  submitDate.value = q?.submitDate || ''
  employmentEntry.value = q?.employment === '1'
  if (q?.status === 'submitted') statusTab.value = '待审核'
  typeTab.value = ['online','volunteer','parttime','fulltime'].includes(q?.jobType) ? q.jobType : ''
  linkedType.value = q?.linked && ['volunteer','parttime','fulltime'].includes(q?.jobType) ? q.jobType : ''
  listStoreId.value = Number(q?.storeId) > 0 ? Number(q.storeId) : null
  if (s.value === 3 || s.value === 4) {
    resumeEntry = deepAppId ? { appId: deepAppId, screen: s.value } : null
    s.value = deepAppId ? 2 : 1
  }
  else if (deepAppId && !q?.s) s.value = 2
} })

const statusTab = ref('全部')
// 同一份选项驱动选中标记、按钮文案和提交值，避免显示与实际收件范围不一致。
const FORWARD_TARGETS = [
  { value: 'manager', label: '换工主理人', note: '本店换工主理人', icon: 'crown' },
  { value: 'store', label: '门店同事', note: '本店全体同事', icon: 'users' },
  { value: 'cross_store', label: '其他门店', note: '跨店招聘协作', icon: 'house' },
  { value: 'wechat', label: '微信好友 / 群', note: '图片转发，无需注册', icon: 'send' }
]
const canShareResume = computed(() => !merchantStaff.value && detail.value?.canShareResume === true)
const canForward = computed(() => detail.value?.canForward === true)
const forwardTargets = computed(() => {
  const choices = FORWARD_TARGETS.filter(x => x.value === 'wechat' || canForward.value)
  if (canForward.value && detail.value?.canForwardToLead) choices.splice(1, 0, { value: 'city_lead', label: '城市负责人', note: '请本店城市负责人查看', icon: 'crown' })
  return choices
})
const target = ref('manager')
const selectedForwardTarget = computed(() => forwardTargets.value.find(x => x.value === target.value) || FORWARD_TARGETS[3])
const resumeImage = ref(null)
const forwardButtonLabel = computed(() => forwarding.value ? (target.value === 'wechat' ? '正在生成图片…' : '正在转发…') : (target.value === 'wechat' ? '生成微信简历图片' : '转发给' + selectedForwardTarget.value.label))
const selectForwardTarget = (value) => { if (!forwarding.value && (value === 'wechat' || canForward.value)) { target.value = value; if(value === 'cross_store') searchForwardStores() } }
const storeSearch = ref('')
const forwardStores = ref([])
const targetStoreId = ref(null)
const forwardLeadOnly = ref(false)
const targetAllowsLead = computed(() => forwardStores.value.some(store => store.storeId === targetStoreId.value && store.canForwardToLead))
const searchingStores = ref(false)
const storeSearchError = ref('')
let searchRequest = 0
async function searchForwardStores() {
  const request = ++searchRequest
  const source = forwardStoreId.value
  if (!source) return
  searchingStores.value = true
  targetStoreId.value = null
  storeSearchError.value = ''
  try { const res = await get('/app/staff/workbench/forward-stores', { storeId: source, q: storeSearch.value, appId: current.value?.appId }); if (request === searchRequest && source === forwardStoreId.value) forwardStores.value = res.data || [] }
  catch (e) { if (request === searchRequest) { forwardStores.value = []; storeSearchError.value = e?.message || '加载失败，请重新搜索' } }
  finally { if (request === searchRequest) searchingStores.value = false }
}
const sharedResume = ref(null)
const sharedError = ref('')
const sharedLoading = ref(false)
let shareRequest = 0
async function loadSharedResume() {
  const request = ++shareRequest
  s.value = 5
  sharedLoading.value = true
  sharedResume.value = null
  sharedError.value = ''
  try {
    await ensureSession()
    if (request !== shareRequest) return
    if (!experience.account || !hasStaffAccess.value) throw new Error('请先使用有接收门店授权的员工账号登录')
    const res = await apiSharedResume(shareId)
    if (request === shareRequest) sharedResume.value = res.data
  } catch (e) {
    if (request === shareRequest) sharedError.value = e?.message || '简历加载失败'
  } finally {
    if (request === shareRequest) sharedLoading.value = false
  }
}
const suggestion = ref('')
// 原生 textarea 会盖在底部导航上抢走点击，平时只画一个同样大小的 view，点了才换成真输入框
const editingSuggestion = ref(false)
// 切换页面或转发对象时输入框被直接销毁、不一定触发 blur，这里收回编辑态，免得下次一进来就弹键盘
watch([s, target], () => { editingSuggestion.value = false })
// 分享追踪：开着就记录这次转发生成的站内信被谁读过，用于「已读 n/m」
const track = ref(true)
const trackNote = computed(() => (track.value ? '记录同事是否已读这条转发' : '不记录已读情况'))
const forwarding = ref(false)
const forwardRecords = ref([])
const forwardNote = computed(() => {
  if (forwardRecords.value.length) {
    const r = forwardRecords.value[0]
    return '最近一次：' + r.from + ' 转给' + (r.target === '门店群' ? '门店同事' : r.target) + ' · ' + r.time + (r.readText ? ' · ' + r.readText : '')
  }
  return '同事在小程序消息中心接收，查看简历仍需该门店的员工授权。'
})
const statusTabs = computed(() => typeTab.value === 'online' ? ['全部', '待审核', '已通过'] : ['全部', '待审核', '待面试', '待签约', '待入职'])
const applicationGrant = computed(() => {
  const id = applicationStoreId.value, current = currentStaffStore.value
  if (id == null) return null
  if (current && String(current.storeId) === String(id)) return current
  const matches = staffStores.value.filter(g => String(g.storeId) === String(id))
  const sameRole = matches.find(g => g.roleCode === current?.roleCode)
  if (sameRole) return sameRole
  if (current?.scopeKind === 'service-city' || matches.length !== 1) return null
  return matches[0]
})
const restricted = computed(() => applicationGrant.value?.roleCode === 'online_staff')
const canViewOnline = computed(() => !!applicationGrant.value && !applicationGrant.value.sharedRecruitment && staffCan('online', 'view', applicationGrant.value))
// 到店名单导出（2026-11-03）：换工主理人、城市负责人有「岗位管理·导出」；服务端按同一格再把关
const canExportList = computed(() => !!applicationGrant.value && !applicationGrant.value.sharedRecruitment && staffCan('jobs', 'export', applicationGrant.value))
const APPLICANT_EXPORT_PAGE = '/pages/staff/applicant-export'
// 小院主理人（10-30 店员 Luna 的备忘录）：列表只看线上任务。和专员不同，只收列表：消息里的换工报名（?appId=）照样按 id 打开详情，详情、转发那几屏不收，服务端权限也不动
const keeperGrant = computed(() => applicationGrant.value?.roleCode === 'keeper')
const onlineListOnly = computed(() => restricted.value || (keeperGrant.value && !linkedType.value))
const typeTabs = computed(() => (jobFilter.value || onlineListOnly.value) ? [{value:'online',label:'线上任务'}] : keeperGrant.value ? [{value:'online',label:'线上任务'}, {value:linkedType.value,label:{volunteer:'换工',parttime:'兼职',fulltime:'全职'}[linkedType.value]}] : [{value:'',label:'全部'}, {value:'online',label:'线上任务'}, {value:'volunteer',label:'换工'}, {value:'parttime',label:'兼职'}, {value:'fulltime',label:'全职'}].filter(t => t.value !== 'online' || canViewOnline.value))

// 状态 Tab -> 后端报名状态（逗号分隔可传几个，服务端逐个校验）。之前每个 Tab 只落到一个状态，
// 审核通过待约面试、面试已完成、待确认录用、已签约待入职四种只在「全部」里：
//   待审核 = submitted（已提交，等商家审核）
//   待面试 = review_passed + interview_booked + interview_done（审核通过待约、已约待面、面完待候选人表态）
//   待签约 = user_confirmed + store_confirmed（候选人愿意前往待门店确认录用（24 小时内）、已录用待签责任书）
//   待入职 = contract_signed（已签责任书，待门店标记入职）
const TAB_STATUS = { 已通过: 'review_passed', 全部: '', 待审核: 'submitted', 待面试: 'review_passed,interview_booked,interview_done', 待签约: 'user_confirmed,store_confirmed', 待入职: 'contract_signed' }

// 员工端报名列表不带岗位类型，从公开岗位接口补一张 jobId -> 类型 的表，
// 而不是照着岗位标题猜一个类型出来。
const JOB_TYPE_LABEL = { volunteer: '换工', parttime: '兼职', fulltime: '全职', online: '线上任务' }

const applications = ref([])
const total = ref(0)
const jobTypes = ref({})
// s=2/3/4 这几屏操作的是哪一份报名，由列表点击带过来
const current = ref(null)
// 详情屏用的完整报名数据（列表接口不下发技能、备注、到岗日期等字段）
const detail = ref(null)
const arrivalInfo = computed(() => detail.value?.canViewRecruitmentDetails === true ? detail.value.arrival || null : null)
const arrivalFields = computed(() => {
  const a = arrivalInfo.value || {}
  return [
    { label: '到达日期', value: a.arriveDate || '未填写' },
    { label: '到达时间', value: a.arriveTime || '未填写' },
    { label: '交通方式', value: a.transport || '未填写' },
    { label: '车次 / 航班', value: a.transportNo || '未填写' }
  ]
})
const arrivalTickets = ref([])
const arrivalTicketState = ref('')
let arrivalTicketSeq = 0
watch(() => [detail.value?.appId, arrivalInfo.value?.tickets], async () => {
  const seq = ++arrivalTicketSeq
  releaseArrivalImages(arrivalTickets.value); arrivalTickets.value = []
  arrivalTicketState.value = ''
  const refs = String(arrivalInfo.value?.tickets || '').split(',').filter(Boolean)
  if (!detail.value?.appId || !refs.length) return
  arrivalTicketState.value = '正在读取票据…'
  try {
    const urls = await loadArrivalImages(detail.value.appId, refs)
    if (seq !== arrivalTicketSeq) { releaseArrivalImages(urls); return }
    arrivalTickets.value = urls
    arrivalTicketState.value = ''
  } catch (e) { if (seq === arrivalTicketSeq) arrivalTicketState.value = e?.message || '票据读取失败，请刷新到店信息' }
})
onBeforeUnmount(() => { arrivalTicketSeq++; releaseArrivalImages(arrivalTickets.value) })
// 小程序里看票据大图会先 onHide 再 onShow：之前回来就整页重拉详情、票据重新下载，按钮变成"正在加载…"，
// 想接着看下一张要等它读完。现在从大图回来的这一次 onShow 不刷新（看图不会改变报名状态）
let previewingTicket = false
const previewArrivalTicket = (index) => {
  // #ifdef MP
  previewingTicket = true
  // #endif
  uni.previewImage({ urls: arrivalTickets.value, current: index, fail: () => { previewingTicket = false } })
}

// 门店信息来自登录时服务端下发的员工授权，不从 UI 或本地存储推断。
// 当前门店（业务中心可切换），只是数据范围；权限仍由服务端按授权逐请求校验
const activeGrant = computed(() => currentStaffStore.value)
const applicationStoreId = computed(() => listStoreId.value || activeGrant.value?.storeId)
const applicationStoreName = computed(() => staffStores.value.find(g => String(g.storeId) === String(applicationStoreId.value))?.storeName || '')
// 筛选按钮也能单独设日期，此时状态页签可能不是「全部」：说明文字跟着页签走，不再一律写"含已处理报名"
const dateScopeText = computed(() => `${submitDate.value === 'today' ? '今日' : submitDate.value}新增报名 · ${statusTab.value === '全部' ? '含已处理报名' : statusTab.value}`)

// 顶部门店名原先写死"袋鼠小院"、带着下拉箭头却点不动。改为显示列表实际取数的门店（通知深链 ?storeId= 指定的优先），
// 点开走业务中心已有的门店切换页（与工作台「切换门店」同一流程），切换回来按新门店重新取列表。
const brandName = computed(() => applicationStoreName.value || activeGrant.value?.storeName || '袋鼠全球青年')
let storeBeforeSwitch = null
const openStoreSwitch = async () => {
  if (merchantService.value) {
    // 这里只筛报名所属商家，返回工作台时仍是同一个城市服务身份。
    const choices = staffStores.value.filter(g => g.roleCode === 'merchant_service' && String(g.city || '').trim() === String(activeGrant.value?.city || '').trim())
    if (choices.length < 2) return toast('当前查看这家商家的报名，其他商家申请可到我的业务处理')
    const i = await pickPaged(choices.map(g => g.storeName || '商家'), '选择报名所属商家')
    if (i < 0) return
    listStoreId.value = choices[i].storeId
    jobFilter.value = null
    typeTab.value = 'online'
    fetchApplications()
    return
  }
  if (restricted.value) {
    const choices = staffIdentities.value.slice()
    const i = await pickPaged(choices.map(staffIdentityLabel), '选择工作身份')
    if (i < 0) return
    await selectStaffStore(choices[i])
    listStoreId.value = null
    jobFilter.value = null
    typeTab.value = 'online'
    fetchApplications()
    return
  }
  if (staffStores.value.length < 2) return toast('你只有这一家门店的授权')
  storeBeforeSwitch = currentStaffStoreId()
  go(R.staffBusiness + '?s=2')
}
// 列表上一次按哪家门店取的数；回到本页时门店变了就重取，不能让门店名和列表内容对不上
let fetchedStore = null
const datesVisible = ref(true)
onHide(() => { datesVisible.value = false })
onShow(() => {
  datesVisible.value = true
  if (previewingTicket) { previewingTicket = false; return }
  // 只有从这里去切换、并且真的换了门店，才放弃深链指定的门店，改跟随当前门店
  if (storeBeforeSwitch != null && String(storeBeforeSwitch) !== String(currentStaffStoreId())) { listStoreId.value = null; jobFilter.value = null }
  storeBeforeSwitch = null
  if (s.value === 2 && current.value?.appId && !detailLoading.value && !actionBusy.value) openDetail(current.value)
  if (s.value === 1 && fetchedStore != null && String(fetchedStore) !== String(applicationStoreId.value)) fetchApplications()
})

// 排序：原先写死"默认排序：按等待时长"且点不动，实际一直是最新报名在前。
// 后端只开放白名单（'' = 最新报名在前，与原先一致；wait = 等待最久在前）。
const SORTS = [
  // 两种排序都是「加急的待审核报名在最前面」（用户花积分加急，后端 AppStaffController.URGENT_FIRST），之后再按时间
  { value: '', label: '默认：加急优先，最新在前', option: '加急优先，最新报名在前' },
  { value: 'wait', label: '加急优先，等待最久在前', option: '加急优先，等待最久在前' }
]
const sortBy = ref('')
const sortText = computed(() => (SORTS.find(x => x.value === sortBy.value) || SORTS[0]).label)
const pickSort = async () => {
  const i = await sheet(SORTS.map(x => x.option))
  if (i < 0 || SORTS[i].value === sortBy.value) return
  sortBy.value = SORTS[i].value
}
// 筛选图标：岗位类型与状态已有上方两排页签，后端另外支持按提交日期筛（与工作台「新增报名」同一口径）
const pickFilter = async () => {
  const i = await sheet(['全部日期', '今日新增报名', '按提交日期筛选…'])
  if (i < 0) return
  if (i === 2) { submitCalendar.value = true; return }
  const next = i === 1 ? 'today' : ''
  if (next === submitDate.value) return
  submitDate.value = next
  fetchApplications()
}
const submitCalendar = ref(false)
const confirmSubmitDate = (date) => {
  submitCalendar.value = false
  if (!date || date === submitDate.value) return
  submitDate.value = date
  fetchApplications()
}
// 通知可能打开非当前切换门店的报名，转发必须跟随报名本身，不能取当前门店兜底。
const forwardStoreId = computed(() => detail.value?.storeId || current.value?.storeId || null)
const forwardStoreName = computed(() => staffStores.value.find(g => String(g.storeId) === String(forwardStoreId.value))?.storeName || '')
const forwardScope = computed(() => {
  if (target.value === 'wechat') return '生成脱敏图片后，由你选择微信好友或群聊发送。接收人无需小程序账号，图片不支持已读追踪。'
  if (!forwardStoreId.value) return '请先选择一份报名，确认所属门店。'
  if (target.value === 'city_lead') return '发送给能处理本店报名的城市负责人。'
  if (target.value === 'cross_store') return '接收门店只能查看脱敏简历，不能查看联系方式或操作原报名。'
  const store = forwardStoreName.value || '报名所属门店'
  return target.value === 'manager'
    ? `${store}：发送给本店其他换工主理人的消息中心。`
    : `${store}：发送给本店其他在职同事的消息中心。`
})

/**
 * 报名编号在卡片上只能占一小条。
 *
 * 设计稿里的编号是 5 位短码（K0826），真实 appNo 是 22 位
 * （KA + 日期8 + 岗位4 + 用户4 + 时间戳4）。整串塞进去会把姓名挤成三行、
 * 撑破卡片固定的 89px 高度，所以这里只做显示层截断（保留 KA 前缀与可区分的后 6 位），
 * 不改动编号本身——完整编号仍在 app.appNo 上。
 */
const shortNo = (appNo) => {
  const no = appNo || ''
  return no.length > 10 ? no.slice(0, 2) + '…' + no.slice(-6) : no
}

/** 从提交时间算已等待时长，对应卡片右下角"已等待 x"。
 *
 * 不能用 Date.parse：后端下发的是 'yyyy-MM-dd HH:mm:ss'（Jackson 配了 GMT+8 但不带时区标记），
 * iOS 与部分小程序 WebView 对这个格式直接返回 NaN —— 整列"已等待"会变成空白。
 * 本项目其余三处（progress.vue / interview.vue / 本文件的 fmtDateTime）都是正则切分，
 * 这里对齐同一口径：切出各字段后按 GMT+8 显式构造时刻。
 */
const parseServerTime = (v) => {
  const m = String(v || '').match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?/)
  if (!m) return NaN
  return Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4] - 8, +m[5], +(m[6] || 0))
}
const waitText = (submitTime) => {
  const t = submitTime ? parseServerTime(submitTime) : NaN
  if (!t || Number.isNaN(t)) return ''
  const ms = Date.now() - t
  if (ms < 0) return ''
  const hours = Math.floor(ms / 3600000)
  if (hours < 1) return Math.max(1, Math.floor(ms / 60000)) + '分钟'
  const days = Math.floor(hours / 24)
  return days ? days + '天' + (hours % 24) + '小时' : hours + '小时'
}

// 映射成模板原有的字段名，模板与样式因此一行未动。
//
// match（匹配度）与 over（超时提醒）后端都没有对应数据：匹配算法和审核时效
// 都属于未确认的业务规则，不能凭空造一个百分比或超时标记，所以留空。
// over 为空时模板既有的 v-if 会自动隐藏那个角标。
//
// avatar：报名列表不下发应聘者头像，不能套设计稿里那张具体的人像图（会被当成本人）。
// 但也不能留空 —— 卡片里这个头像位是 52×52 的固定尺寸，留空就是每张卡片上一个空方块，
// 而这是员工最常看的一屏。退到品牌默认头像（袋鼠线稿，不是任何人），版式保住，
// 也不构成任何身份声明。
const mapRow = (r) => ({
  appId: r.appId,
  storeId: r.storeId,
  appNo: r.appNo || '',
  code: shortNo(r.appNo),
  name: r.applicantName || '',
  state: r.statusLabel || '',
  // 原始状态码：详情屏的进度条要按它算当前步，只有中文 statusLabel 算不出来
  status: r.status || '',
  role: r.jobTitle || '',
  jobType: r.jobType || '',
  type: JOB_TYPE_LABEL[r.jobType] || jobTypes.value[r.jobId] || '',
  place: applicationStoreName.value,
  wait: waitText(r.submitTime),
  // 用户花积分加急、还在等审核：卡片上标红色「加急」（服务端已把它排在最前面）
  urgent: r.urgent === true,
  match: '',
  over: '',
  avatar: '/static/media/profile-avatar.jpg'
})

const loadJobTypes = async () => {
  if (Object.keys(jobTypes.value).length) return
  try {
    const res = await apiJobList({ pageNum: 1, pageSize: 50 })
    const map = {}
    ;(res.rows || []).forEach((j) => { map[j.jobId] = JOB_TYPE_LABEL[j.jobType] || '' })
    jobTypes.value = map
  } catch (e) {
    // 岗位类型只是卡片副标题的一部分，取不到就留空，不影响报名列表本身
  }
}

// 分页游标。
// 这里原先固定请求第 1 页 20 条、没有任何翻页，而卡片上方写着"共 N 份"——
// 第 21 份之后的报名在员工端够不着。后端已经下发 hasMore，页面没读。
const PAGE_SIZE = 20
const pageNum = ref(1)
const hasMore = ref(false)
const loadingMore = ref(false)
const listLoading = ref(false)
const listError = ref('')
let listRequest = 0
// 之前审核通过后停在详情屏，点返回回到列表，卡片还写着「待审核」、「待审核」页签里也还挂着这条，像是没审成功。
// 现在详情状态和列表不一致时记一笔，返回列表（backToList）重新拉一次
let listStale = false
const clearSubmitDate = () => {
  submitDate.value = ''
  if (statusTab.value !== '全部') statusTab.value = '全部'
  else fetchApplications()
}

const fetchApplications = async (append = false) => {
  if (append && (listLoading.value || loadingMore.value)) return
  const request = ++listRequest
  // 冷启动时登录态是异步恢复的，先等恢复完再请求，否则会拿不到令牌白跑一次。
  await ensureSession()
  if (request !== listRequest) return
  // 没有员工授权时 main.js 的路由守卫会把页面带去身份页，这里不重复处理
  if (!hasStaffAccess.value) return
  if (applicationGrant.value && !applicationGrant.value.sharedRecruitment) await loadStaffPerms(applicationGrant.value)
  if (request !== listRequest) return
  // 只看线上的两种身份先判：权限表读取失败时 canViewOnline 是 false，两句互相改 typeTab 会一直转
  if (onlineListOnly.value && typeTab.value !== 'online') { typeTab.value = 'online'; return }
  if (!onlineListOnly.value && !canViewOnline.value && typeTab.value === 'online') { typeTab.value = ''; return }
  if (restricted.value && s.value > 2) s.value = 1
  const requestedJob = jobFilter.value
  const requestedStore = applicationStoreId.value
  const requestedDate = submitDate.value
  const requestedStatus = statusTab.value
  const requestedType = typeTab.value
  const requestedSort = sortBy.value
  const isCurrent = () => request === listRequest && requestedStore === applicationStoreId.value
    && requestedDate === submitDate.value && requestedStatus === statusTab.value && requestedType === typeTab.value
    && requestedSort === sortBy.value && requestedJob === jobFilter.value
  fetchedStore = requestedStore
  const next = append ? pageNum.value + 1 : 1
  listError.value = ''
  if (append) loadingMore.value = true
  else { listLoading.value = true; applications.value = []; total.value = 0; hasMore.value = false; listStale = false }
  try {
    await loadJobTypes()
    const res = await apiStaffApplications({
      storeId: requestedStore,
      jobId: requestedJob || undefined,
      jobType: requestedType || undefined,
      sort: requestedSort || undefined,
      status: TAB_STATUS[requestedStatus] || undefined,
      submitDate: requestedDate || undefined,
      pageNum: next,
      pageSize: PAGE_SIZE
    })
    if (!isCurrent()) return
    if (requestedDate === 'today' && res.submitDate) submitDate.value = res.submitDate
    const rows = (res.rows || []).map(mapRow)
    applications.value = append ? applications.value.concat(rows) : rows
    total.value = res.total || 0
    pageNum.value = next
    hasMore.value = typeof res.hasMore === 'boolean'
      ? res.hasMore
      : applications.value.length < (res.total || 0)
    // 选中态跟着最新列表走：审核完这条可能已经不在当前 Tab 里了
    const keep = deepAppId || (current.value && current.value.appId)
    current.value = applications.value.find(a => a.appId === keep) || null
    // 通知深链 ?s=2&appId=… 直接进详情屏：必须拉详情，否则只有列表里脱敏的姓名，电话 / 技能 / 时间都没有，
    // 录用按钮也判断不出门店角色。报名不在当前这一页 / 当前页签里时，按 id 直接取
    if (deepAppId && s.value === 2) openDetail(current.value || { appId: deepAppId })
    deepAppId = 0
  } catch (e) {
    if (!isCurrent()) return
    listError.value = e?.message || '报名加载失败，请重试'
    if (!append) {
      applications.value = []
      total.value = 0
      current.value = null
      hasMore.value = false
    }
    toast((e && e.message) || '加载失败')
    // 之前通知深链（?appId= / ?s=2&appId=）进来时列表一失败，详情屏就一直空着、按钮停在"正在加载…"，
    // 既没有错误说明也没有重新加载。详情按 id 单独取，不依赖列表，这里照样打开
    if (deepAppId && s.value === 2) { openDetail({ appId: deepAppId }); deepAppId = 0 }
  } finally {
    if (request === listRequest) { loadingMore.value = false; listLoading.value = false }
  }
}

// 触底继续加载下一页（只在列表屏）
onReachBottom(() => {
  if (s.value !== 1 || loadingMore.value || !hasMore.value) return
  fetchApplications(true)
})

/**
 * 打开详情屏。
 *
 * 必须在这里把真实详情拉回来：详情屏底部的"通过并约面试/不合适"操作的是
 * current 指向的那份报名，如果屏幕上显示的还是设计稿里的示例应聘者，
 * 操作员看到的人和实际被审核的人就是两个人。
 */
// 请求竞态令牌：连点两条报名时，先发的响应可能后到。
// 没有它的话 B 的详情会被盖到 A 的界面上，而底部的审核按钮操作的是 current（A）——
// 主理人看着 B 的姓名电话，对 A 做了"通过/不合适"的决定。
let detailSeq = 0
// 详情屏的返回：列表已过期（listStale，见列表分页处）就重取
const backToList = () => { s.value = 1; if (listStale) { listStale = false; fetchApplications() } }
const detailLoading = ref(false)
const detailError = ref('')
const actionBusy = ref(false)

const openDetail = async (app) => {
  const seq = ++detailSeq
  if (Number(app.appId) !== workEndTarget.value) workEndTarget.value = 0
  current.value = app
  detail.value = null
  detailLoading.value = true
  detailError.value = ''
  forwardRecords.value = []
  suggestion.value = ''
  extras.value = null
  extrasState.value = ''
  s.value = 2
  try {
    const res = await apiStaffApplicationDetail(app.appId)
    if (seq !== detailSeq) return   // 已经有更新的请求发出去了，这份响应作废
    if (!res.data?.appId) throw new Error('报名详情不完整，请重新加载')
    detail.value = res.data
    if (resumeEntry?.appId === app.appId) {
      if (s.value === 2 && canShareResume.value) s.value = resumeEntry.screen
      resumeEntry = null
    }
    if (res.data.jobType !== 'online' && res.data.canViewRecruitmentDetails === true) loadExtras(res.data.appId, seq)
    // 详情里的最新状态和列表卡片对不上（本页刚审核通过、或在面试页确认录用后回来刷新到新状态），返回列表时要重取
    const row = applications.value.find(a => a.appId === res.data.appId)
    if (row && row.status !== res.data.status) listStale = true
  } catch (e) {
    if (seq !== detailSeq) return
    detailError.value = e?.message || '加载报名详情失败'
  } finally {
    if (seq === detailSeq) detailLoading.value = false
  }
}
function focusEndRecord(id) {
  if (s.value !== 2 || !detailReady.value || Number(id) !== workEndTarget.value) return
  workEndTarget.value = 0
  uni.pageScrollTo({ selector: '#work-end', offsetTop: -88, duration: 220 })
}

/** 驳回必须带原因，用系统弹窗取，不在页面上新增结构。 */
const askRejectReason = () => new Promise((resolve) => {
  uni.showModal({
    title: '驳回原因',
    editable: true,
    placeholderText: '请填写驳回原因，将同步给报名人',
    success: (r) => resolve(r.confirm ? String(r.content || '').trim() : null),
    fail: () => resolve(null)
  })
})

const audit = async (pass) => {
  if (actionBusy.value || !detailReady.value || !canAudit.value) return
  const app = current.value
  const seq = detailSeq
  if (!app) {
    toast('请先在列表中选择一份报名')
    return
  }
  actionBusy.value = true
  try {
    let reason = ''
    if (!pass) {
      reason = await askRejectReason()
      if (seq !== detailSeq || !canAudit.value || reason === null) return
      if (!reason) {
        toast('请填写驳回原因')
        return
      }
    }
    const res = await apiStaffAudit(app.appId, pass, reason)
    if (seq !== detailSeq) return
    toast((res && res.msg) || (pass ? '已通过审核' : '已驳回'))
    // 审核通过后保留详情，立即显示下一步；不再让操作者找不到面试时段入口。
    if (pass) await openDetail(app)
    else { await fetchApplications(); s.value = 1 }
  } catch (e) {
    if (seq === detailSeq) toast((e && e.message) || '操作失败')
  } finally {
    actionBusy.value = false
  }
}

function invalidateApplicationRequests() {
  listRequest++
  detailSeq++
  shareRequest++
  searchRequest++
}
onBeforeUnmount(invalidateApplicationRequests)
let awaitingFirstAccount = !experience.account?.id
watch(() => {
  // 冷启动先取得账号，再恢复员工身份。两者就绪后才开始比较身份，以保留通知指定的报名。
  if (!experience.account?.id || (awaitingFirstAccount && session.restoring)) return null
  return JSON.stringify([experience.account.id, experience.mode, currentStaffStore.value?.identityKey,
    currentStaffStore.value?.storeId, currentStaffStore.value?.roleCode, currentStaffStore.value?.sharedRecruitment])
}, (scope, previous) => {
  if (scope) awaitingFirstAccount = false
  if (!previous) return
  invalidateApplicationRequests()
  applications.value = []
  total.value = 0
  current.value = null
  detail.value = null
  extras.value = null
  forwardRecords.value = []
  sharedResume.value = null
  deepAppId = 0
  shareId = 0
  resumeEntry = null
  jobFilter.value = null
  listStoreId.value = null
  s.value = 1
  if (scope && hasStaffAccess.value) fetchApplications()
}, { flush: 'sync' })

// 包一层：onMounted / watch 会把自己的参数传进来（watch 的第一个参数是新值），
// 直接把 fetchApplications 当回调会被当成 append=true。
onMounted(() => shareId ? loadSharedResume() : fetchApplications())
watch(statusTab, () => fetchApplications())
watch(typeTab, () => { if (!statusTabs.value.includes(statusTab.value)) statusTab.value = '全部'; else fetchApplications() })
watch(sortBy, () => fetchApplications())
// 进到转发屏时把这份报名的历史转发记录带出来（谁转给谁、读了没）
watch([s, canShareResume], ([screen, allowed]) => {
  if (!allowed && [3, 4].includes(screen)) s.value = current.value?.appId || deepAppId ? 2 : 1
}, { immediate: true })
const notifyingManager = ref(false)
async function notifyManager() {
  const app = detail.value
  if (notifyingManager.value || !detailReady.value || !app?.canNotifyRecruitManager) return
  notifyingManager.value = true
  try {
    const res = await apiNotifyRecruitManager(app.storeId, app.appId)
    toast(res.data?.message || '已通知主理人')
  } catch (e) {
    toast(e.message || '通知失败，请重试')
  } finally { notifyingManager.value = false }
}
watch(s, (v) => { if (v === 4 && canShareResume.value) { if (!canForward.value) target.value = 'wechat'; loadForwards() } })

const isOnline = computed(() => (detail.value?.jobType || current.value?.jobType) === 'online')
const steps = computed(() => isOnline.value ? ONLINE_STEPS : OFFLINE_STEPS)
// 详情屏的进度条按状态算当前步（STEP_BY_STATUS / ONLINE_STEP_BY_STATUS 在 application-stage.js）。
// 主人（2026-11-03）：六步全打勾也看不出现在是什么状态——步骤上面加「当前：…」状态条，
// 进行中的那一步（空心红圈）和已完成的（实心打勾）画法分开，审核未通过停住的那一步画成灰色叉
// 按服务端详情决定可执行动作；列表缓存不能作为审核依据。
const curStatus = computed(() => (detail.value && detail.value.status) || (current.value && current.value.status) || '')
// 主人（2026-11-03）：「当前：已入职（入职成功）」+ 日期；时间字段只用详情接口的，详情没读出来前只按列表状态显示状态
const stage = computed(() => stageBanner(curStatus.value, { online: isOnline.value, detail: detailReady.value ? detail.value : {}, interview: interviewInfo.value }))
const stepClass = (i) => stepState(i, dStep.value, curStatus.value)
// 积分规则默认收起，换一份报名时也收起
const ruleOpen = ref(false)
watch(() => detail.value && detail.value.appId, () => { ruleOpen.value = false })
const pointsRule = computed(() => (detailReady.value && curStatus.value === 'onboarded' && canFinishVolunteer.value ? volunteerRule(detail.value) : ''))
const detailReady = computed(() => !detailLoading.value && !detailError.value && !!detail.value?.appId && detail.value.appId === current.value?.appId)
const canAudit = computed(() => detailReady.value && detail.value.canAudit === true)

// 详情屏底部这两个按钮按报名状态切换含义（2026-09-18 用户决定：员工端加确认录用 / 标记入职 / 终止）。
// 不新增按钮：待审核时仍是"不合适 / 通过并约面试"；之后的状态里左边变成"终止"，
// 审核通过后可设置时段；等待候选人的状态显示原因，不能重复审核。
// 状态机见后端 ApplicationStatus：员工可终止的是审核通过（用户还没约面试）之后、入职之前的六个状态。
const TERMINABLE = ['review_passed', 'interview_booked', 'interview_done', 'user_confirmed', 'store_confirmed', 'contract_signed']
const PASS_ACTION = { submitted: '通过并约面试', review_passed: '设置面试时段', user_confirmed: '确认录用', contract_signed: '标记入职' }
const WAIT_LABEL = { review_rejected: '审核未通过', interview_booked: '已预约面试', interview_done: '待用户确认', store_confirmed: '待用户签约', onboarded: '已入职', withdrawn: '已撤回', terminated: '已终止' }
// 使用当前报名详情的服务端权限，避免缓存角色或另一门店的授权使普通员工出现审核入口。
const canHire = computed(() => detailReady.value && detail.value.canManage === true)
const volunteerAgreement = ref(null)
const canCheckAgreement = computed(() => canHire.value && detail.value.canReviewVolunteerContract === true && curStatus.value === 'store_confirmed' && detail.value.jobType === 'volunteer' && detail.value.volunteerContractStatus === 'pending')
const showInsurance = computed(() => detailReady.value && !isOnline.value && ['store_confirmed', 'contract_signed', 'onboarded', 'completed'].includes(curStatus.value))
const openInsurance = () => {
  if (!showInsurance.value || actionBusy.value) return
  go(staffStoreUrl('/pages/staff/insurance-account?applicationId=' + encodeURIComponent(detail.value.appId), detail.value.fulfillmentStoreId || detail.value.storeId))
}
// 换工换宿：已入职的换工报名，主理人 / 管家可以「确认换工完成」并填实际天数（服务端按天数发积分）；
// 计划结束 3 天后（并且标记入职也满 3 天）还没确认的，服务端按报名天数自动完成。能不能点由服务端 canFinishVolunteer 决定
const canFinishVolunteer = computed(() => detailReady.value && detail.value.canFinishVolunteer === true)
const canPass = computed(() => detailReady.value && !actionBusy.value && (canAudit.value || canCheckAgreement.value || (!isOnline.value && (
  !!detail.value.interviewOfferRole || detail.value.canScheduleInterview === true || detail.value.canConfirm === true || detail.value.canOnboard === true || detail.value.canFinishVolunteer === true
))))
const passLabel = computed(() => {
  if (actionBusy.value) return '正在处理…'
  if (!detailReady.value) return detailError.value ? '详情未加载' : '正在加载…'
  // 线上接单结算完成后状态仍是 review_passed，按详情里的结算状态说「结算完成」
  const onlineDone = detail.value.settleStatus === 'confirmed' ? '结算完成' : '已通过'
  if (detail.value.interviewOfferRole) return detail.value.interviewOfferRole === 'merchant' ? '选择面试时间' : '设置候选时段'
  if (!canHire.value && !canAudit.value) return isOnline.value && curStatus.value === 'review_passed' ? onlineDone : '只读查看'
  if (isOnline.value) return ONLINE_STEP_BY_STATUS[curStatus.value] >= 3 ? onlineDone : WAIT_LABEL[curStatus.value] || '通过'
  if (canCheckAgreement.value) return '核对三方协议'
  if (curStatus.value === 'store_confirmed' && detail.value.volunteerContractStatus === 'rejected') return '待用户重新确认'
  if (detail.value.workEndTime) return canFinishVolunteer.value ? '核算实际天数' : '工作已结束'
  if (curStatus.value === 'onboarded' && canFinishVolunteer.value) return '确认换工完成'
  if (curStatus.value === 'onboarded' && detail.value.volunteerDone === true) return '换工已完成'
  return PASS_ACTION[curStatus.value] || WAIT_LABEL[curStatus.value] || '暂无操作'
})
const canReject = computed(() => detailReady.value && !actionBusy.value && (canAudit.value || detail.value.canTerminate === true))
const rejectLabel = computed(() => (canAudit.value || !canReject.value ? '不合适' : '终止'))
const actionHint = computed(() => {
  if (!detailReady.value) return ''
  const st = curStatus.value
  if (detail.value.workEndTime) return canFinishVolunteer.value ? '工作已结束，可按实际服务天数核算积分。' : '这段工作已结束。'
  if (st === 'submitted' && detail.value.auditBlockReason) return detail.value.auditBlockReason
  if (isOnline.value && st !== 'submitted') return detail.value.onlineTip || (st === 'review_passed' ? '报名已审核通过，可查看成果与结算。' : (WAIT_LABEL[st] || '当前报名无需审核。'))
  // 报名人花积分加急了：提示优先处理（列表里已排在最前面并标「加急」）
  if (st === 'submitted' && detail.value.urgent === true) return '报名人用积分加急了这份报名，请优先审核。' + (canAudit.value ? '' : '（当前账号只能查看，请联系本门店换工主理人或小院主理人审核）')
  if (st === 'onboarded' && !isOnline.value && detail.value.volunteerDone === true) return detail.value.volunteerDoneText || '这段换工已确认完成。'
  // 主人（2026-11-03）：这里原来是服务端 volunteerFinishTip 整段积分规则，太长；改成一句「下一步」，规则收进下面的「积分规则」展开（全文仍以服务端为准）
  if (st === 'onboarded' && canFinishVolunteer.value) return volunteerNextHint(detail.value)
  if (detail.value.interviewOfferRole) return detail.value.interviewOfferRole === 'merchant' ? '从下方候选时段中选择一场面试，确认后会通知义工。' : '可为本次报名提交合适的时间和腾讯会议邀请，由商家确认。'
  if (!canHire.value && !canAudit.value && !restricted.value) return '当前报名为只读，请由本门店换工主理人或小院主理人审核、安排面试及处理录用。'
  if (st === 'submitted') return isOnline.value ? '审核通过后，接单人即可提交成果，无需面试、签约和保险。' : '审核通过后，请设置本门店的可预约时段，由候选人选择面试时间。'
  if (isOnline.value && ONLINE_STEP_BY_STATUS[st] >= 3) return detail.value.onlineTip || '申请已通过，无需重复审核。接单人可在任务交付页提交成果。'
  if (st === 'review_passed') return canHire.value ? '审核已通过，无需再次通过。请设置可预约时段，由候选人在报名进度中选择面试时间。' : '审核已通过，请联系本门店换工主理人或小院主理人设置面试时段，再由候选人预约。'
  if (st === 'user_confirmed' && !canHire.value) return '候选人已确认意向，请由本门店换工主理人或小院主理人确认录用。'
  if (st === 'contract_signed' && !canHire.value) return '候选人已签约，请由本门店换工主理人或小院主理人确认到岗后标记入职。'
  // 还没到约定到岗日前 1 天（服务端 onboardWait）：先说明，标记入职会被拒
  if (st === 'contract_signed' && detail.value.onboardWait) return detail.value.onboardWait
  if (st === 'store_confirmed' && detail.value.jobType === 'volunteer') return detail.value.volunteerContractStatus === 'pending' ? '用户已确认三方协议，请核对全部填写信息后代表店家确认；信息有误可退回修改。' : detail.value.volunteerContractStatus === 'rejected' ? '协议已退回，等待用户修改后重新确认。' : '门店已确认录用，等待用户填写并确认三方协议。'
  if (st === 'interview_booked' && interviewInfo.value?.dateText) return '候选人已预约 ' + interviewInfo.value.dateText + ' 的面试，点「去面试详情」填写腾讯会议号、处理面试。'
  return { interview_booked: '候选人已预约，请在面试日程中查看时间、会议信息并处理面试。', interview_done: '面试已结束，等待候选人在报名进度中确认意向。', user_confirmed: '候选人已确认意向，核对后可确认录用。', store_confirmed: '门店已确认录用，等待候选人在报名进度中签署责任书。', contract_signed: '候选人已签约，确认实际到岗后可标记入职。', review_rejected: detail.value?.rejectReason || '本次报名未通过审核，不能重复操作。', withdrawn: '候选人已撤回本次报名。', terminated: '本次报名流程已终止。', onboarded: '已标记入职，可办理或查看保险；保障状态以实际保单为准。' }[st] || '当前状态暂无可执行操作。'
})

const askTerminateReason = () => new Promise((resolve) => {
  uni.showModal({
    title: '终止原因',
    editable: true,
    placeholderText: '请填写终止原因，将同步给报名人',
    success: (r) => resolve(r.confirm ? String(r.content || '').trim() : null),
    fail: () => resolve(null)
  })
})
const confirmModal = (title, content) => new Promise((resolve) => {
  uni.showModal({ title, content, success: (r) => resolve(!!r.confirm), fail: () => resolve(false) })
})

/** 执行一个员工动作：成功后提示、重新拉列表回到列表屏；失败如实提示服务端原因 */
const runAction = async (fn, okText) => {
  if (actionBusy.value) return
  actionBusy.value = true
  try {
    const res = await fn()
    toast((res && res.msg) || okText)
    await fetchApplications()
    s.value = 1
  } catch (e) {
    toast((e && e.message) || '操作失败')
  } finally {
    actionBusy.value = false
  }
}

const onPass = async () => {
  const app = current.value
  if (!app) return toast('请先在列表中选择一份报名')
  if (!canPass.value) return
  const st = curStatus.value
  if (canCheckAgreement.value) {
    volunteerAgreement.value?.open()
    uni.pageScrollTo({ selector: '#volunteer-agreement', duration: 200 })
    return
  }
  if (st === 'review_passed' && detail.value.interviewOfferRole) return uni.pageScrollTo({selector:'#interview-offers', duration:200})
  if (st === 'review_passed') return go(staffStoreUrl(R.staffInterviews + '?s=5', detail.value.storeId))
  if (st === 'submitted') return audit(true)
  if (st === 'user_confirmed') {
    const warn = feedbackRows.value.filter(f => f.warn).map(f => '「' + f.value + '」').join('、')
    if (!(await confirmModal('确认录用', (warn ? '候选人在面试后问卷里选了' + warn + '，建议先和 TA 沟通。\n' : '') + '确认录用后会占用该岗位一个名额，并通知报名人签署责任书。'))) return
    return runAction(() => apiStaffConfirm(app.appId), '已确认录用')
  }
  if (st === 'contract_signed') {
    if (detail.value.onboardWait) return uni.showModal({ title: '还不能标记入职', content: detail.value.onboardWait, showCancel: false })
    if (!(await confirmModal('标记入职', '确认报名人已到岗入职？标记后该报名进入终态，不可再流转。'))) return
    return runAction(() => apiStaffOnboard(app.appId), '已标记入职')
  }
  if (st === 'onboarded' && canFinishVolunteer.value) {
    const max = Number(detail.value.volunteerMaxDays) || 1
    const v = await prompt('确认换工完成', { value: String(max), placeholder: `实际做了几天（1–${max}）` })
    if (v === null) return
    const days = Number(v)
    if (!/^\d+$/.test(v) || days < 1 || days > max) return toast(`实际天数请填 1–${max} 的整数`)
    // 每天积分是 0（会员规则开着按会员口径发分、积分上线前已结束、换工积分停发）时不写「发 0 积分」，改写服务端给的积分说明（volunteerFinishTip）
    const perDay = Number(detail.value.volunteerPerDay) || 0
    const tip = String(detail.value.volunteerFinishTip || '').trim()
    const pointsText = perDay ? '，给 TA 发 ' + days * perDay + ' 积分。' : '。' + (tip ? '\n积分说明：' + tip + '\n' : '')
    if (!(await confirmModal('确认换工完成', '按 ' + days + ' 天确认完成' + pointsText + '确认后不能再改。'))) return
    return runAction(() => apiStaffVolunteerDone(app.appId, days), '已确认完成')
  }
}

const onReject = async () => {
  if (!canReject.value) return
  const app = current.value
  if (!app) return toast('请先在列表中选择一份报名')
  if (canAudit.value) return audit(false)
  if (TERMINABLE.indexOf(curStatus.value) < 0) return
  const reason = await askTerminateReason()
  if (reason === null) return
  if (!reason) return toast('请填写终止原因')
  return runAction(() => apiStaffTerminate(app.appId, reason), '已终止')
}

const dStep = computed(() => {
  // 线上接单的步骤以服务端为准（交付 / 验收 / 结算进度），结算完成时是 4，三步都打勾
  if (isOnline.value && detailReady.value && detail.value && detail.value.onlineStep) return detail.value.onlineStep
  const st = (detail.value && detail.value.status) || (current.value && current.value.status) || ''
  return (isOnline.value ? ONLINE_STEP_BY_STATUS : STEP_BY_STATUS)[st] || 0
})

const fmtDate = (v) => {
  if (!v) return ''
  const m = String(v).match(/(\d{4})-(\d{2})-(\d{2})/)
  return m ? Number(m[2]) + '月' + Number(m[3]) + '日' : ''
}
const fmtDateTime = (v) => {
  if (!v) return ''
  const m = String(v).match(/(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/)
  return m ? m[2] + '-' + m[3] + ' ' + m[4] + ':' + m[5] : ''
}

// 详情屏的展示值全部来自 detail（真实报名），取不到就留空。
// 学历、匹配度后端没有采集，不编造；性别取简历 / 账号资料，经历在补充接口（extras）里。
//
// 姓名/手机号分两档：
//   详情屏（s=2）是门店员工的审核工作台，要靠姓名+电话联系到应聘者，
//   服务端 /app/staff/applications/{appId} 为此额外下发 realName 与 phone（已校验门店授权）；
//   phone 只有主理人 / 管家拿到完整号码，普通员工拿到的是脱敏号码（contactMasked=true，2026-09-24 起）；
//   列表屏（s=1）与脱敏简历屏（s=3）继续用服务端的脱敏字段，脱敏简历是要转发出去的，
//   一旦换成完整值就不叫脱敏了。
const dMaskedName = computed(() => (detail.value && detail.value.applicantName) || (current.value && current.value.name) || '')
const dName = computed(() => (detail.value && detail.value.realName) || dMaskedName.value)
const dAge = computed(() => (detail.value && detail.value.age != null ? detail.value.age + '岁' : ''))
const dPhone = computed(() => (detail.value && detail.value.phone) || '')
// 性别（服务端先取简历、没填退回账号资料）：知道就写；没填时只有分了男女名额的岗位（genderPlanned）才写「性别未填」提醒核对
const dGender = computed(() => {
  const g = (detail.value && detail.value.gender) || ''
  return g && (g !== '性别未填' || detail.value.genderPlanned === true) ? g : ''
})
// 姓名下面这行原本只放年龄，把性别、手机号并进来：详情屏没有多余的行可用，
// 而这行本来就是应聘者的基本信息行，不需要新增任何标签
const dContact = computed(() => [dAge.value, dGender.value, dPhone.value].filter(Boolean).join(' · '))
// 报名记录里没有应聘者头像字段。设计稿那张 staff-app-1.jpg 是一张具体的人像照片，
// 摆在真实姓名旁边会被当成本人，不能用。
//
// 但也不能置空：置空之后这里是一个宽高固定、没有图的空洞，版式塌了一块，
// 而设计稿那个位置本来就该有个圆形头像。所以退到品牌默认头像（一只袋鼠的线稿，
// 不是任何人），既不冒充身份，也不破坏版式。个人中心页早就是这么处理的。
const dAvatar = '/static/media/profile-avatar.jpg'
const dJob = computed(() => (detail.value && detail.value.jobTitle) || (current.value && current.value.role) || '')
const dType = computed(() => JOB_TYPE_LABEL[detail.value?.jobType] || current.value?.type || '')

// 脱敏简历屏的「预览原简历（仅自己可见）」原先点了没反应。转发前要能核对原始报名信息：
// 只在本机弹窗里展示详情接口已经下发给自己的数据，不发请求、不进转发内容；
// 电话照旧按角色口径（普通员工本来就只拿到脱敏号码）。
const previewOriginal = () => {
  if (!detailReady.value) return toast(detailError.value || '报名详情还在加载，请稍候')
  const d = detail.value
  const lines = [
    '姓名：' + (dName.value || '未填写'),
    '联系电话：' + (dPhone.value || '未填写') + (d.contactMasked ? '（当前角色只显示脱敏号码）' : ''),
    d.age != null ? '年龄：' + d.age + '岁' : '',
    '应聘岗位：' + [dType.value, dJob.value].filter(Boolean).join(' · '),
    dSubmit.value ? '报名时间：' + dSubmit.value : '',
    isOnline.value ? '' : '到岗与停留：' + ([dArrival.value, dStay.value].filter(Boolean).join('，') || '未填写'),
    '技能与经历：' + (String(d.skills || '').trim() || '未填写'),
    (isOnline.value ? '接单说明：' : '备注：') + (String(d.note || '').trim() || '未填写')
  ].filter(Boolean)
  uni.showModal({ title: '原简历（仅自己可见）', content: lines.join('\n'), showCancel: false, confirmText: '知道了' })
}
// ---------------------------------------------------------------------------
// 简历转发（s=4）。
//
// 转发不复制简历内容：同事收到的是一条站内信，点开回到报名详情，
// 能看到多少仍由他自己的角色权限决定。开了分享追踪就按站内信的已读状态统计。
// ---------------------------------------------------------------------------
const loadForwards = async () => {
  const app = current.value
  const storeId = forwardStoreId.value
  if (!app || !storeId || detail.value?.canViewRecruitmentDetails !== true) return
  try {
    const res = await apiResumeForwards(app.appId, storeId)
    if (current.value?.appId === app.appId) forwardRecords.value = res.data || []
  } catch (e) {
    if (current.value?.appId === app.appId) forwardRecords.value = []
  }
}

const doForward = async () => {
  const app = current.value
  if (!app || !forwardStoreId.value) {
    toast('请先从列表里选一份报名')
    return
  }
  if (!canShareResume.value || forwarding.value || !detailReady.value || (target.value !== 'wechat' && !canForward.value)) return
  forwarding.value = true
  try {
    if (target.value === 'wechat') {
      const res = await apiResumePoster(current.value.appId, forwardStoreId.value)
      if (resumeImage.value) await resumeImage.value.generate(res.data)
      return
    }
    const res = await apiResumeForward({
      appId: app.appId,
      storeId: forwardStoreId.value,
      target: target.value,
      leadOnly: target.value === 'cross_store' && targetAllowsLead.value && forwardLeadOnly.value,
      targetStoreId: target.value === 'cross_store' ? targetStoreId.value : undefined,
      suggestion: suggestion.value,
      track: track.value ? '1' : '0'
    })
    toast((res.data && res.data.message) || '已转发')
    if (current.value?.appId === app.appId) {
      forwardRecords.value = (res.data && res.data.records) || forwardRecords.value
      suggestion.value = ''
    }
  } catch (e) {
    toast((e && e.message) || '转发失败')
  } finally {
    forwarding.value = false
  }
}

const dSubmit = computed(() => fmtDateTime(detail.value && detail.value.submitTime))
const dArrival = computed(() => {
  const d = fmtDate(detail.value && detail.value.arrivalDate)
  return d ? '最快 ' + d + ' 可到岗' : ''
})
const dStay = computed(() => (detail.value && detail.value.stayDays != null ? '可停留 ' + detail.value.stayDays + ' 天' : ''))
// 报名表单里的"技能与经历"是一段自由文本，按顿号/逗号/换行拆成标签
const skills = computed(() => {
  const raw = (detail.value && detail.value.skills) || ''
  return raw.split(/[，,、\n;；]/).map(t => t.trim()).filter(Boolean).slice(0, 8)
})
// 这段文字是报名人自己写的，可能夹着电话、微信号：脱敏简历屏（s=3）一律不展示像联系方式的标签，
// 详情屏只对看脱敏号码的角色（contactMasked）隐去；简历经历、技能描述在服务端已按同一口径隐去联系方式。
// 看脱敏号码的角色拿到的这段文字服务端已遮过（「[手机号已隐藏]」「***」），这类残片标签也不展示；全角数字、「威信 / 加V」同样认
// 斜杠、括号分隔的 11 位号码（138/1234/5678、(138)1234-5678）和「wechat id: xxx」也算（10-14 回归）；日期只有 8 位数字，不受影响
const CONTACT_LIKE = /[\d０-９](?:[\s.\-－]?[\d０-９]){6,}|(?:[\d０-９][\s.\-－/／()（）]{0,3}){10}[\d０-９]|(?:微信|威信|薇信|v信|wechat|weixin|wx|vx|加v|qq|扣扣)(?:\s*id)?[号是为:：\s]*[a-z0-9_-]{5,}|[@＠]|已隐藏|\*{3}/i
const maskedSkills = computed(() => skills.value.filter(t => !CONTACT_LIKE.test(t)))
const shownSkills = computed(() => (detail.value && detail.value.contactMasked ? maskedSkills.value : skills.value))
// 「＋技能标签」：之前点了没反应（后端也没有这个功能）。现在门店可以给报名人加 / 删自己的标签（V35，存人才库标记，
// 人才库按标签也能筛到）；报名人自己填的技能照旧在前面，门店加的排在后面、点一下可删除。转给别的门店的脱敏简历不带门店标签
const storeTags = computed(() => (detail.value && detail.value.storeTags) || [])
let tagBusy = false
async function saveStoreTag(d, tag, add) {
  if (tagBusy) return
  tagBusy = true
  try {
    const res = await apiStaffAppTag(d.appId, tag, add ? 'add' : 'remove')
    if (detail.value !== d) return
    detail.value = { ...d, storeTags: res.data || [] }
    toast(add ? '标签已添加' : '标签已删除')
  } catch (e) {
    if (detail.value === d) toast(e?.message || '标签保存失败')
  } finally { tagBusy = false }
}
async function addStoreTag() {
  const d = detail.value
  if (!d || !d.canTag) return
  const v = await prompt('添加技能标签', { placeholder: '例如：会拍照、咖啡师（最多 12 字）' })
  if (v === null || detail.value !== d) return
  if (!v) return toast('请填写标签')
  if (v.length > 12) return toast('标签最多 12 个字')
  saveStoreTag(d, v, true)
}
async function removeStoreTag(t) {
  const d = detail.value
  if (!d || !d.canTag) return
  if (!(await confirm('删除标签', `删除门店标签「${t}」？`)) || detail.value !== d) return
  saveStoreTag(d, t, false)
}
// ---------------------------------------------------------------------------
// 报名详情补充（/app/staff/applications/{appId}/extras）：报名人简历里的技能描述与经历、约好的面试、面试后问卷。
// 之前「经历记录」永远是空标题（候选人在简历里填的经历送不到门店），「面试已预约」点进来既看不到面试时间、
// 也没有入口去这场面试；候选人面试后填的问卷和「想让门店知道的事」门店在小程序里哪儿都看不到。
// 报名详情接口没有这几块，单独取；取不到只影响这几块的显示，不影响审核、录用等操作
// ---------------------------------------------------------------------------
const extras = ref(null)
const extrasState = ref('')
async function loadExtras(appId, seq) {
  extrasState.value = 'loading'
  try {
    const res = await get('/app/staff/applications/' + appId + '/extras')
    if (seq !== detailSeq) return
    extras.value = res.data || null
    extrasState.value = ''
  } catch (e) {
    if (seq === detailSeq) extrasState.value = 'failed'
  }
}
const experiences = computed(() => (extras.value && extras.value.resume && extras.value.resume.exps) || [])
// 简历里的兴趣爱好 / 性格 / 相关经历。主人（2026-11-03）：原来标题和内容挤在一起，内容贴着下一个标题；
// 改成每项「灰色小标签在上、内容在下」，项与项之间留空隙加细线，长文字自动换行。没填的项不出
const PROFILE_FIELDS = [['hobbies', '兴趣爱好'], ['personality', '性格'], ['background', '相关经历']]
const profileFields = computed(() => {
  const r = (extras.value && extras.value.resume) || {}
  return PROFILE_FIELDS.map(([key, label]) => ({ key, label, value: String(r[key] == null ? '' : r[key]).trim() })).filter(f => f.value)
})
const previewResumeMedia = url => uni.previewImage({urls:[absUrl(url)]})
const resumeSkill = computed(() => (extras.value && extras.value.resume && extras.value.resume.skillText) || '')
// 报名详情还在读、或没读出来时不能说「还没有填写经历」（读出来之前补充接口还没发）；没读出来时上面已有出错说明和「重新加载」
const expEmpty = computed(() => (extrasState.value === 'loading' || detailLoading.value ? '正在读取简历…' : extrasState.value === 'failed' ? (s.value === 2 ? '简历读取失败，可点下方「刷新到店信息」重新读取' : '简历读取失败，请回到报名详情点「刷新到店信息」重新读取') : detailReady.value && detail.value.canViewRecruitmentDetails === true ? '报名人的简历里还没有填写经历' : ''))
const interviewInfo = computed(() => (extras.value && extras.value.interview) || null)
// 去这场面试的详情（填腾讯会议号、结束面试、评分、双向确认），按报名所属门店打开
const openInterview = () => { if (interviewInfo.value) go(staffStoreUrl(R.staffInterviews + '?id=' + interviewInfo.value.interviewId, detail.value?.storeId)) }
// 问卷三道单选里的差评项（不太清晰 / 不满意 / 无法按时到岗）标红，确认录用时也提醒一句
const FEEDBACK_LABELS = [['understandJob', '岗位理解'], ['acceptBoard', '食宿条件'], ['confirmArrival', '按时到岗'], ['feedbackNote', '想让门店知道的事']]
const feedbackRows = computed(() => {
  const iv = interviewInfo.value || {}
  return FEEDBACK_LABELS.filter(([k]) => iv[k]).map(([k, label]) => ({ label, value: iv[k], warn: k !== 'feedbackNote' && /不太|不满意|无法/.test(iv[k]) }))
})
// 跨店收到的脱敏简历：经历只有时间、岗位和类型
const sharedExps = computed(() => ((sharedResume.value && sharedResume.value.exps) || []).map(e => e.date + ' ' + e.role).join('；'))
</script>

<style scoped lang="scss">
.arrival-info__head{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:6px}.arrival-info__head .section-title{margin-bottom:0}.arrival-info__row{display:flex;justify-content:space-between;gap:16px;padding:9px 0;font-size:14px;border-bottom:1px solid var(--k-line)}.arrival-info__row>text:first-child{color:var(--k-muted);flex-shrink:0}.arrival-info__row>text:last-child{text-align:right;overflow-wrap:anywhere}.arrival-info__label{display:block;margin:14px 0 8px;font-size:14px;font-weight:600}.arrival-info__tickets{display:flex;flex-wrap:wrap;gap:8px}.arrival-info__tickets image{width:96px;height:96px;border-radius:8px}.arrival-info__note{display:block;font-size:14px;white-space:pre-wrap;overflow-wrap:anywhere}.arrival-info__hint{display:block;margin-top:10px;color:var(--k-muted);font-size:12px;line-height:1.6}
.type-tabs .active { color: var(--k-red); font-weight: 700; border-bottom: 2px solid var(--k-red); }
/* 报名详情补充：简历技能描述、经历为空时的说明、面试后问卷（差评项标红） */
.resume-skill{display:block;margin-top:10px;font-size:12px;line-height:1.6;color:var(--k-muted);white-space:pre-wrap;overflow-wrap:anywhere}
.exp-empty{display:block;font-size:12px;color:var(--k-muted)}
.feedback-row{display:flex;justify-content:space-between;gap:16px;padding:7px 0;font-size:13px;line-height:1.6}.feedback-row>text:first-child{flex-shrink:0;color:var(--k-muted)}.feedback-row>text:last-child{text-align:right;overflow-wrap:anywhere}.feedback-row>text.warn{color:var(--k-alert);font-weight:700}
.contact-actions { display: flex; flex-wrap: wrap; gap: 10px; padding: 12px 0; }
.action-status{padding:14px 0;display:flex;flex-direction:column;align-items:flex-start;gap:10px;font-size:14px;line-height:1.7;color:var(--k-muted);border-bottom:1px solid var(--k-line)}
.date-scope{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:12px 0;border-bottom:1px solid var(--k-line);margin-bottom:12px;font-size:14px}.date-scope>view{display:flex;flex-direction:column;gap:6px;min-width:0}.date-scope__title{font-weight:600;overflow-wrap:anywhere}.date-scope button{flex-shrink:0;min-height:48px;display:flex;align-items:center;margin:0;padding:0 12px;border:1px solid var(--k-line);border-radius:8px;background:var(--k-paper);color:var(--k-red);font-size:14px}.date-scope button::after{border:0}.list-state{display:flex;flex-direction:column;align-items:center;gap:12px;padding:32px 16px;text-align:center;font-size:14px;color:var(--k-muted)}

.online-note{display:flex;flex-direction:column;gap:10px;font-size:14px;line-height:1.7;white-space:pre-wrap;overflow-wrap:anywhere}.staff-apps{background:var(--k-bg)}.brand{padding-left:9px;display:flex;align-items:center;gap:8px;font-family:var(--k-serif);font-size:20px;font-weight:700}.status-tabs,.type-tabs{margin:3px 16px 8px;height:34px;border:1px solid var(--k-line2);border-radius:8px;background:var(--k-paper);display:flex}.status-tabs>view,.type-tabs>view{flex:1;border-right:1px solid var(--k-line);display:flex;align-items:center;justify-content:center;gap:4px;font-size:13px}.status-tabs>view:last-child,.type-tabs>view:last-child{border:0}.status-tabs>view.active{border-radius:7px;background:var(--k-red);color:#fff}.apps-body{padding:8px 14px 98px}.applications-tools{margin:4px 0 12px;display:flex;gap:8px}.applications-tools__main{flex:1;min-width:0}.applications-tools__export{flex:0 0 118px}.sort-row{height:38px;display:flex;align-items:center;gap:30px;color:var(--k-muted);font-size:13px}.sort-row>view{display:flex;align-items:center;gap:6px}.sort-row>text{margin-left:auto}.app-card{min-height:89px;padding:10px;margin-bottom:7px;border:1px solid var(--k-line2);border-radius:10px;background:var(--k-paper);display:flex;gap:10px;box-sizing:border-box}.app-avatar{position:relative;width:52px;flex:0 0 auto}.app-avatar image{width:52px;height:52px;border-radius:8px}.app-avatar>text{display:block;margin-top:4px;width:52px;text-align:center;padding:1px;border:1px solid var(--k-line2);border-radius:4px;background:var(--k-paper);font-size:9px}.app-copy{min-width:0;flex:1;display:flex;flex-direction:column;gap:4px;line-height:1.35;color:var(--k-muted);font-size:11px}.app-copy>view{display:flex;align-items:center;gap:8px}.app-copy>view>text:last-child{flex-shrink:0}.app-name{min-width:0;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;font-family:var(--k-serif);font-size:15px;font-weight:700;color:var(--k-ink)}.app-line{overflow:hidden;white-space:nowrap;text-overflow:ellipsis}.app-side{flex-shrink:0;display:flex;flex-direction:column;align-items:flex-end;gap:6px;color:var(--k-muted);font-size:11px}.match{color:var(--k-green);font-size:15px;font-weight:700}.over{color:var(--k-red);font-size:10px}
.detail-body{padding:10px 16px calc(88px + var(--k-safe-bottom))}.candidate{display:flex;align-items:center;gap:13px;padding-bottom:10px;border-bottom:1px solid var(--k-line)}.candidate>image{width:62px;height:62px;border-radius:8px}.candidate>view:nth-child(2){min-width:0;flex:1;display:flex;flex-direction:column;gap:8px;color:var(--k-muted);font-size:13px}.candidate-name{font-family:var(--k-serif);font-size:20px;font-weight:700;color:var(--k-ink)}.candidate>.candidate-schedule,.resume-head>.candidate-schedule{display:flex;flex-direction:column;align-items:flex-end;gap:5px;color:var(--k-muted);font-size:12px}.match.large{font-size:20px}.apply-meta{display:flex;padding:12px 0;border-bottom:1px solid var(--k-line)}.apply-meta>view{width:50%;display:flex;flex-direction:column;gap:7px;color:var(--k-muted);font-size:12px}.apply-meta>view:first-child{border-right:1px solid var(--k-line)}.apply-meta>view:first-child text:nth-child(2){font-family:var(--k-serif);font-size:16px;font-weight:700;color:var(--k-ink)}.apply-meta>view:last-child{padding-left:18px}.steps{display:flex;justify-content:space-between;padding:16px 2px;border-bottom:1px solid var(--k-line)}.steps>view{position:relative;flex:1;display:flex;flex-direction:column;align-items:center;gap:7px;font-size:11px}.step-circle{width:27px;height:27px;border:1px solid var(--k-line2);border-radius:50%;display:flex;align-items:center;justify-content:center;color:var(--k-muted)}.step-circle.done{background:var(--k-red);border-color:var(--k-red);color:#fff}.section{padding:11px 0;border-bottom:1px solid var(--k-line)}.section-title{display:block;margin-bottom:9px;font-family:var(--k-serif);font-size:16px;font-weight:700}.skill-row{display:flex;flex-wrap:wrap;align-items:center;gap:7px}.skill-row>text.store-tag{border-color:var(--k-ochre);color:#B36A20}.skill-row>text{padding:5px 11px;border:1px solid var(--k-line2);border-radius:7px;background:var(--k-paper2);font-size:12px}.skill-row>view{width:27px;height:27px;border:1px solid var(--k-line2);border-radius:50%;display:flex;align-items:center;justify-content:center}.experience{position:relative;display:flex;gap:10px;padding:5px 0}.timeline-dot{width:8px;height:8px;margin-top:5px;border:2px solid var(--k-ink);border-radius:50%}.experience>view:last-child{display:flex;flex-direction:column;gap:5px;font-size:12px}.experience>view:last-child text:last-child{color:var(--k-muted)}.available>view{display:flex;align-items:center;gap:12px}.available>view>view{display:flex;flex-direction:column;gap:6px;font-size:12px}.available>view>view text:last-child{color:var(--k-muted)}.action-wrap{min-width:0;flex:1}.detail-reject{flex:0 0 68px}.detail-pass{flex:1}.detail-forward{flex:0 0 98px}.detail-body~.k-bottom :deep(.k-button){padding:0 6px;font-size:14px}.resume-preview{flex:1.18}.resume-send{flex:.82}
.masked-body{padding:8px 16px calc(88px + var(--k-safe-bottom))}.masked-tip{height:35px;padding:0 10px;border-radius:7px;background:var(--k-green-soft);display:flex;align-items:center;gap:8px;color:var(--k-green);font-size:12px}.resume-card{margin-top:10px;padding:16px 14px;border:1px solid var(--k-line2);border-radius:10px;background:var(--k-paper)}.resume-head{display:flex;align-items:center;gap:12px;padding-bottom:11px;border-bottom:1px solid var(--k-line)}.avatar-placeholder{width:61px;height:61px;border:1px solid var(--k-line2);border-radius:8px;background:var(--k-paper2);display:flex;align-items:center;justify-content:center}.resume-head>view:nth-child(2){min-width:0;flex:1;display:flex;flex-direction:column;gap:8px;color:var(--k-muted);font-size:13px}.resume-line{padding:10px 0;border-bottom:1px solid var(--k-line);display:flex;flex-direction:column;gap:5px;font-size:13px}.resume-block{padding:10px 0;border-bottom:1px solid var(--k-line)}.resume-foot{position:relative;padding-top:13px;display:flex;align-items:flex-start;gap:9px}.resume-foot>view:nth-child(2){display:flex;flex-direction:column;gap:7px;color:var(--k-muted);font-size:11px}.stamp{position:absolute;right:5px;top:-4px;width:88px;height:88px;border:2px double rgba(169,138,97,.4);border-radius:50%;display:flex;flex-direction:column;align-items:center;justify-content:center;transform:rotate(-10deg);color:rgba(169,138,97,.6);font-size:11px}
.forward-body{padding:13px 16px 100px}.forward-title{display:block;font-family:var(--k-serif);font-size:18px;font-weight:700}.target-row{display:flex;gap:12px;margin-top:10px}.target{position:relative;flex:1;height:88px;padding:0 18px;border:1px solid var(--k-line2);border-radius:10px;background:var(--k-paper);display:flex;align-items:center;gap:13px}.target.active{border:1.5px solid var(--k-red)}.target>view{display:flex;flex-direction:column;gap:8px}.target>view text:first-child{font-family:var(--k-serif);font-size:17px;font-weight:700}.target>view text:last-child{color:var(--k-muted);font-size:12px}.target-check{position:absolute;right:6px;top:6px;width:20px;height:20px;border-radius:50%;background:var(--k-red);color:#fff;text-align:center;line-height:20px}.forward-label{display:block;margin:22px 0 8px;font-family:var(--k-serif);font-size:17px;font-weight:700}.forward-label>text{color:var(--k-muted);font-size:12px;font-weight:400}.job-card{padding:13px;border:1px solid var(--k-line2);border-radius:9px;background:var(--k-paper);display:flex;flex-direction:column;gap:9px}.job-card text:first-child{font-family:var(--k-serif);font-size:17px;font-weight:700}.job-card text:last-child{color:var(--k-muted);font-size:13px}.suggest{position:relative;height:90px;padding:11px;border:1px solid var(--k-line2);border-radius:9px;background:var(--k-paper)}.suggest textarea{width:100%;height:65px;font-size:13px}.suggest .apps-area-idle{width:100%;height:65px;font-size:13px;overflow:hidden;white-space:pre-wrap;word-break:break-all}.suggest>text{position:absolute;right:12px;bottom:8px;color:var(--k-muted);font-size:11px}.track-row{margin:20px 0 70px;display:flex;align-items:center;justify-content:space-between}.track-row>view:first-child{display:flex;flex-direction:column;gap:8px}.track-row>view:first-child text:first-child{font-family:var(--k-serif);font-size:17px;font-weight:700}.track-row>view:first-child text:last-child{color:var(--k-muted);font-size:12px}.switch{width:48px;height:28px;padding:2px;border-radius:16px;background:#BBB}.switch.on{background:var(--k-green)}.switch>view{width:24px;height:24px;border-radius:50%;background:#fff}.switch.on>view{transform:translateX(20px)}.send-note{display:block;margin-top:10px;text-align:center;color:var(--k-muted);font-size:12px}
.forward-body .target-row{flex-wrap:wrap;height:auto;gap:8px}.forward-body .target{flex:1 1 130px;min-height:84px}.forward-store-picker{display:flex;flex-direction:column;gap:10px;margin:16px 0;font-size:14px}.forward-store-picker input{min-height:44px;padding:0 12px;border:1px solid var(--k-line2);border-radius:8px}.forward-store-option{padding:12px;font-size:14px;line-height:1.5;min-height:48px;text-align:left;background:var(--k-paper);border:1px solid var(--k-line2)}.forward-store-option.selected{border-color:var(--k-red);color:var(--k-red)}.shared-resume{padding:20px 16px calc(96px + var(--k-safe-bottom));display:flex;flex-direction:column;gap:18px;font-size:14px;line-height:1.7;overflow-wrap:anywhere}
</style>

<style lang="scss">
.staff-apps .detail-forward .k-button{padding-left:6px;padding-right:6px;font-size:13px}
.staff-apps .resume-preview .k-button{padding-left:6px;padding-right:6px;font-size:12px}
.staff-apps .forward-body .target{min-width:0;padding:0 12px;gap:8px}
.staff-apps .forward-body .target>view{min-width:0}
.staff-apps .forward-body .target>view text:first-child{font-size:16px}
.staff-apps .forward-body .track-row{margin-bottom:24px}
.staff-apps .forward-scope{display:block;margin-top:12px;color:var(--k-muted);font-size:13px;line-height:1.6;overflow-wrap:anywhere}
</style>

<style scoped>.candidate-profile{padding:16px;background:#fff;border-radius:12px;margin:12px 0}
/* 2026-11-03 主人：简历卡每项「灰色小标签在上、内容在下」，项与项之间留空隙加细线；长文字换行 */
.profile-item{display:flex;flex-direction:column;gap:4px}.profile-item+.profile-item{margin-top:12px;padding-top:12px;border-top:1px solid var(--k-line)}.profile-item__label{font-size:12px;line-height:1.5;color:var(--k-muted)}.profile-item__value{font-size:14px;line-height:1.7;color:var(--k-ink);white-space:pre-line;overflow-wrap:anywhere;word-break:break-word}
/* 2026-11-03 主人：步骤上面的「当前：…」状态条；进行中的那一步空心红圈、已完成实心打勾、停住的灰色叉 */
.stage-banner{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:4px 12px;margin-top:12px;padding:10px 12px;border-radius:8px;background:var(--k-red-soft);color:var(--k-red)}.stage-banner__label{font-size:15px;font-weight:700;line-height:1.5}.stage-banner__date{font-size:12px;line-height:1.5;opacity:.85}.stage-banner--ok{background:var(--k-green-soft);color:var(--k-green)}.stage-banner--stop{background:var(--k-paper2);color:var(--k-muted)}
.step-circle.current{background:#fff;border:2px solid var(--k-red);color:var(--k-red);font-weight:700}.step-circle.stopped{background:var(--k-paper2);border-style:dashed}.step--done .step-label{color:var(--k-ink)}.step--current .step-label{color:var(--k-red);font-weight:700}.step--todo .step-label,.step--stopped .step-label{color:var(--k-muted)}
.points-rule{display:flex;align-items:center;gap:4px;min-height:32px;font-size:13px;color:var(--k-ink2)}.points-rule__body{font-size:12px;line-height:1.7;color:var(--k-muted);overflow-wrap:anywhere}
.candidate-portrait{width:80px;height:100px;border-radius:10px;margin:12px 0}.candidate-media{display:flex;flex-wrap:wrap;gap:8px;margin-top:12px}.candidate-media image{width:96px;height:96px;border-radius:8px}.candidate-media video{width:100%;height:200px}

/* 2026-11-17 改版「小而精」：浅灰底 + 白卡（12 圆角、不描边、不加阴影），标题用系统黑体；列表行标题 14、辅助 12，状态用统一的小标签，逾期用提醒红；
   详情页各段各自成卡；底部按钮收成 44 高的胶囊。筛选、按钮、标签、文字一个不少。 */
.staff-apps{--k-bg:#F7F5F2;--k-sh1:none;background:#F7F5F2}
.staff-apps :deep(.k-navbar__title){font-family:var(--k-sans);font-size:16px;font-weight:600}
.staff-apps :deep(.k-button){border-radius:999px}
.staff-apps :deep(.k-button.is-lg){height:44px;font-size:15px}
.staff-apps :deep(.k-chip:not(.is-pill)){height:17px;padding:0 5px;border-radius:4px;font-size:10px;font-weight:500}
.brand{gap:6px;font-family:var(--k-sans);font-size:17px}
.status-tabs,.type-tabs{margin:3px 12px 8px;height:34px;border:0;border-radius:10px;overflow:hidden}
.status-tabs>view,.type-tabs>view{border-right:0;font-size:13px;color:var(--k-ink2)}
.status-tabs>view.active{border-radius:10px;background:linear-gradient(135deg,#B5814D,#8E5E33);color:#fff;font-weight:600}
.type-tabs .active{color:var(--k-red-deep);font-weight:600}
.apps-body{padding:8px 12px 98px}
.date-scope{padding:10px 12px;border:0;border-radius:12px;background:var(--k-paper);margin-bottom:8px;font-size:13px}.date-scope>view{gap:2px}
.date-scope button{min-height:36px;border:1px solid var(--k-red-line);border-radius:999px;color:var(--k-red-deep);font-size:12px}
.applications-tools{margin:8px 0}.applications-tools :deep(.k-button.is-lg){height:38px;font-size:13px;font-weight:500}
.staff-apps :deep(.subscribe-entry){padding:4px 12px 0}
.staff-apps :deep(.subscribe-entry button){min-height:36px;border:0;border-radius:12px;background:var(--k-paper);color:var(--k-ochre-deep);font-size:12px}
.sort-row{height:36px;gap:20px;font-size:12px}
.list-state{font-size:13px}
.app-card{min-height:84px;padding:12px;margin-bottom:8px;border:0;border-radius:12px}
.app-avatar>text{height:17px;padding:0;border:0;border-radius:4px;background:#F5F1EB;color:var(--k-ink2);font-size:10px;font-weight:500;line-height:17px}
.app-copy{font-size:12px}.app-name{font-family:var(--k-sans);font-size:14px;font-weight:600}
/* 窄屏（320 宽）时名字至少露出两三个字，报名编号可以收一点：之前带「加急」的那行名字被挤没了 */
@media (max-width:359px){.app-name{min-width:3em}.app-copy>view>text:last-child{flex-shrink:1;min-width:0;overflow:hidden;white-space:nowrap;text-overflow:ellipsis}}
.app-side{font-size:11px}.match{font-size:14px}.over{color:var(--k-alert);font-size:11px;font-weight:600}
.detail-body{padding:8px 12px calc(88px + var(--k-safe-bottom))}
.candidate,.apply-meta,.steps,.action-status,.section{margin-top:8px;padding:12px;border:0;border-radius:12px;background:var(--k-paper)}.candidate{margin-top:0}
.candidate>image{width:56px;height:56px}.candidate>view:nth-child(2){gap:4px;font-size:12px}.candidate-name{font-family:var(--k-sans);font-size:17px}.match.large{font-size:17px}
.apply-meta>view{gap:4px}.apply-meta>view:first-child text:nth-child(2){font-family:var(--k-sans);font-size:14px;font-weight:600}
.steps{padding:14px 4px 12px}.step-circle{width:24px;height:24px;font-size:11px}
.action-status{font-size:13px}
.section-title{margin-bottom:8px;font-family:var(--k-sans);font-size:15px}
.skill-row>text{height:24px;padding:0 8px;border:0;border-radius:4px;background:#F5F1EB;color:var(--k-ink2);line-height:24px}
.skill-row>text.store-tag{background:var(--k-ochre-soft);color:var(--k-ochre-deep)}
.skill-row>view{width:24px;height:24px}
.arrival-info__row{font-size:13px}.arrival-info__label{font-size:13px}.arrival-info__note{font-size:13px}
.candidate-profile{margin:8px 0 0;padding:12px}
.stage-banner{margin-top:8px;border-radius:12px;color:var(--k-red-deep)}.stage-banner__label{font-size:14px;font-weight:600}
.step--current .step-label{font-weight:600}
.contact-actions{gap:8px;padding:8px 0 0}.contact-actions :deep(.k-button.is-lg){height:36px;padding:0 14px;font-size:13px;font-weight:500}
.staff-apps :deep(.k-bottom){background:var(--k-paper)}
.masked-body{padding:8px 12px calc(88px + var(--k-safe-bottom))}.masked-tip{border-radius:8px}
.resume-card{margin-top:8px;padding:14px 12px;border:0;border-radius:12px}.avatar-placeholder{border:0;background:#F5F1EB}
.forward-body{padding:12px 12px 100px}.forward-title{margin:0 2px;font-family:var(--k-sans);font-size:15px}.forward-label{margin:16px 2px 8px;font-family:var(--k-sans);font-size:15px}
.target{border:0;border-radius:12px}.target.active{border:0;background:var(--k-red-soft);box-shadow:inset 0 0 0 1px var(--k-red-line)}
.staff-apps .forward-body .target>view text:first-child{font-family:var(--k-sans);font-size:15px;font-weight:600}
.job-card{padding:12px;border:0;border-radius:12px;gap:4px}.forward-body :deep(.k-button.is-block){margin-top:16px}.job-card text:first-child{font-family:var(--k-sans);font-size:15px;font-weight:600}
.suggest{border:0;border-radius:12px}
.track-row>view:first-child{gap:4px}.track-row>view:first-child text:first-child{font-family:var(--k-sans);font-size:15px;font-weight:600}
.switch{background:var(--k-line2)}.switch.on{background:var(--k-green)}
.forward-store-picker input{border:0;border-radius:10px;background:var(--k-paper)}
.forward-store-option{border:0;border-radius:10px}.forward-store-option::after{border:0}.forward-store-option.selected{color:var(--k-red-deep);box-shadow:inset 0 0 0 1px var(--k-red)}
.shared-resume{padding:16px 12px calc(96px + var(--k-safe-bottom));gap:12px}
/* 详情页里的「在岗与离店登记」也收成一张白卡（名单里的那份不套卡） */
.detail-body :deep(.employment){margin-top:8px;padding:12px;border:0;border-radius:12px;background:var(--k-paper)}
/* 名单里点开某个人后的那份登记：已经在名单的白卡里了，去掉它自己的底线（小程序里组件管不到再下一层组件，写在页面里才生效） */
.apps-body :deep(.roster .employment){padding-bottom:4px;border-bottom:0}
/* 详情页里的「确认时间」卡（公共组件）和上下的白卡对齐：12 圆角、不描边，标题和别的区块标题一样大 */
.detail-body :deep(.ad-card){margin-top:8px;padding:12px;border:0;border-radius:12px}
.detail-body :deep(.ad-heading){font-size:15px}
/* 2026-11-18 第二轮精修（报名列表、详情、脱敏简历、转发、收到的简历），按精修词典统一：
   报名状态是胶囊分段控件（选中白底，不再是渐变实心棕），岗位类型是下划线页签（选中 ink 600 + 16×3 暖棕短条）；排序行图标收小；
   次按钮统一白底 + 暖棕细边 + 深棕字；卡片标题 16/700，细线换发丝线；脱敏简历的占位头像、时间线点、印章收小；转发目标的勾是 16 的暖棕圆点、开关暖棕；
   收到的简历放进白卡；底部操作条内边距 8 12。按钮、筛选、文字一个不少 */
.status-tabs{height:32px;padding:2px;box-sizing:border-box;border-radius:16px;background:#F0EBE4;overflow:visible}
.status-tabs>view{position:relative;border-radius:14px;font-weight:400;color:var(--k-ink2)}
.status-tabs>view.active{border-radius:14px;background:var(--k-paper);color:var(--k-ink);font-weight:600}
/* 分段看着 28 高，上下各多出一圈看不见的可点范围 */
.status-tabs>view::after{content:'';position:absolute;left:0;right:0;top:-6px;bottom:-6px}
.type-tabs{height:40px;margin:0 12px 2px;border-radius:0;background:transparent;overflow:visible}
.type-tabs>view{position:relative;font-size:14px;font-weight:400;color:var(--k-muted)}
.type-tabs .active{border-bottom:0;color:var(--k-ink);font-weight:600}
.type-tabs .active::after{content:'';position:absolute;left:50%;bottom:4px;width:16px;height:3px;margin-left:-8px;border-radius:2px;background:var(--k-red)}
/* 排序行：筛选图标 16、下拉箭头 12；筛选图标四周加一圈透明边，看着小、点的范围仍有 36 */
.sort-row>:deep(.k-icon){box-sizing:content-box;border:10px solid transparent;margin:-10px}
/* 「已等待 x 天」沉到右下角，和左栏最后一行对齐 */
.app-side>text:last-child{margin-top:auto}
.staff-apps :deep(.k-button.is-outline),.staff-apps :deep(.k-button.is-secondary){border-color:var(--k-red-line);color:var(--k-red-deep)}
.applications-tools :deep(.k-button),.applications-tools :deep(.k-button.is-lg){height:36px;font-size:13px;font-weight:500}
.match.large{font-size:15px;font-weight:600;color:var(--k-ink);font-variant-numeric:tabular-nums}
.section-title{font-size:16px;line-height:22px}.detail-body :deep(.ad-heading){font-size:16px}
.profile-item+.profile-item{position:relative;border-top:0}.profile-item+.profile-item::before{content:'';position:absolute;left:0;right:0;top:0;height:1px;background:var(--k-line);transform:scaleY(.5)}
.apply-meta>view:first-child{border-right:0}.apply-meta>view:last-child{padding-left:12px}
.candidate>image,.candidate-portrait{border-radius:8px}
.avatar-placeholder{width:56px;height:56px;background:#F5F1EB}
.resume-line>text:first-child{font-size:12px;color:var(--k-muted)}.resume-line>text:last-child{font-size:14px;font-weight:500}
.experience>view:last-child text:first-child{font-size:13px;font-weight:500}
.timeline-dot{flex-shrink:0;width:7px;height:7px;border:1.5px solid var(--k-muted)}
/* 印章收到 64，底部这一行至少 60 高，印章不再伸出卡片 */
.resume-foot{min-height:60px}.stamp{width:64px;height:64px;font-size:10px;line-height:1.3}
.forward-title,.forward-label{font-size:16px;font-weight:700}
.staff-apps .forward-body .track-row>view:first-child text:first-child{font-size:14px;font-weight:600}
.target-check{width:16px;height:16px;top:6px;right:6px;display:flex;align-items:center;justify-content:center;line-height:normal}
.forward-store-option.selected{background:var(--k-red-soft);box-shadow:inset 0 0 0 1px var(--k-red-line)}
.switch.on{background:var(--k-red-deep)}
.shared-resume{margin:8px 12px calc(24px + var(--k-safe-bottom));padding:16px 12px;border-radius:12px;background:var(--k-paper)}
.shared-resume .k-title{font-family:var(--k-sans);font-size:16px;font-weight:700;line-height:22px}
.staff-apps .shared-resume .forward-scope{position:relative;margin-top:4px;padding-top:12px;font-size:12px}
.staff-apps .shared-resume .forward-scope::before{content:'';position:absolute;left:0;right:0;top:0;height:1px;background:var(--k-line);transform:scaleY(.5)}
.staff-apps :deep(.k-bottom__inner){padding:8px 12px!important;gap:8px}
/* 详情底栏「转发脱敏简历」：原来 98 宽装 15 号的六个字，字贴着按钮边。常见手机上把它放宽到 116（中间主按钮仍有 150 以上）；
   360 宽以下放不下，才退回 98 宽、13 号字、左右 6 的内边距 */
.staff-apps .detail-forward{flex:0 0 116px}
.staff-apps .detail-forward :deep(.k-button.is-lg){padding:0 12px}
@media (max-width:360px){.staff-apps .detail-forward{flex:0 0 98px}.staff-apps .detail-forward :deep(.k-button.is-lg){padding:0 6px;font-size:13px}}
</style>
