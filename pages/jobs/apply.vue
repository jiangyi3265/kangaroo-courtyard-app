<template>
  <k-feature-gate feature="recruitment">
  <view class="k-page ap-page" :class="$userSurface">
    <k-topbar :title="isOnline ? '申请接单' : '报名加入'" back />
    <view class="ap">
      <!-- 7 步进度（2026-10-18，和进度页同一套，见 ./apply-flow.js）：报名页就是第 1 步「提交资料」；线上任务没有到店这一套，不出 -->
      <view v-if="!closedReason && jobType && !isOnline" class="ap-card ap-flow"><job-flow-steps :current="saved ? 2 : 1" /></view>

      <!-- 报的是哪个岗位：封面 + 名字 + 城市 / 类型 / 最短期限 -->
      <view v-if="jobTitle" class="ap-job">
        <image class="ap-job__img" :src="jobCover" mode="aspectFill" />
        <view class="ap-job__main"><text class="ap-job__title">{{ displayWording(jobTitle) }}</text><text v-if="jobSub" class="ap-job__sub">{{ jobSub }}</text></view>
      </view>

      <view v-if="jobTitleError" class="ap-card ap-state ap-state--error"><view class="ap-state__icon"><k-icon name="cloud-off" :size="32" color="muted" /></view><text class="ap-state__text ap-state__text--alert">{{ jobTitleError }}</text><view class="ap-state__btn"><k-button type="outline" size="md" label="重新加载岗位" @click="loadForm" /></view></view>
      <!-- 已满员 / 已截止 / 已暂停：只写原因，不摆一张填不了的表 -->
      <view v-else-if="closedReason" class="ap-card ap-state"><view class="ap-state__icon"><k-icon name="circle-alert" :size="32" color="muted" /></view><text class="ap-state__text ap-state__text--alert">{{ closedReason }}</text><text class="ap-state__text">{{ isOnline ? '这个任务现在不接新的申请，可以回去看看其他线上任务。' : '这个岗位现在不接新的报名，可以回去看看其他岗位。' }}</text><view class="ap-state__btn"><k-button type="outline" size="md" label="返回" @click="back()" /></view></view>

      <!-- 投递成功 -->
      <view v-else-if="saved" class="ap-card ap-done">
        <view class="ap-done__icon"><k-icon name="check" :size="24" color="white" /></view>
        <text class="ap-done__title">{{ isOnline ? '申请已提交' : '简历已投递' }}</text>
        <text class="ap-done__text">{{ isOnline ? '发布方审核通过后，就可以远程开始任务、在任务页提交成果。' : '主理人会尽快看你的简历，确认信息后通知你约视频时间。审核结果会发到「消息」里。' }}</text>
      </view>

      <view v-else-if="jobReady" class="ap-form">
        <view v-if="isOnline" key="online-contact" class="ap-online-form">
          <view class="ap-sec"><text class="ap-sec__title">接单联系信息</text><text class="ap-sec__sub">无需填写简历，仅用于本次任务联系</text></view>
          <view class="ap-card online-contact">
            <label>称呼<input v-model="contactName" maxlength="40" placeholder="怎么称呼你" /></label>
            <label>联系电话<input v-model="contactPhone" type="number" maxlength="11" placeholder="请输入手机号" /></label>
          </view>
        </view>
        <view v-if="!isOnline" key="offline-resume" class="ap-offline-form">
        <!-- 1 提交资料 = 我的简历（2026-10-18 主人：不再单独填姓名 / 年龄 / 手机 / 技能，用简历投递，只填一次） -->
        <view class="ap-sec"><text class="ap-sec__title">我的简历</text><text class="ap-sec__sub">投递时把这份简历发给主理人</text></view>
        <view v-if="resumeState === 'loading'" class="ap-card ap-resume ap-resume--loading"><text class="ap-muted">正在读取你的简历…</text></view>
        <view v-else-if="resumeState === 'failed'" class="ap-card ap-resume ap-resume--loading" hover-class="k-press-s" @click="loadResume"><text class="ap-muted">简历暂时读不到，点这里重试</text></view>
        <!-- 还没有简历：先去填（填完回到这里自动刷新） -->
        <view v-else-if="!card.exists" class="ap-card ap-empty">
          <view class="ap-empty__art"><image class="ap-empty__img" src="/static/user-icons/roo-mark.png" mode="aspectFit" /></view>
          <text class="ap-empty__title">还没有简历，先去填写</text>
          <text class="ap-empty__text">只填一次，以后报名直接确认投递</text>
          <view class="ap-empty__btn" hover-class="k-press-s" @click="openResume"><text>去填写简历</text><k-icon name="chevron-right" :size="12" color="white" /></view>
        </view>
        <!-- 有简历：头像、称呼、年龄 · 城市、手机（打码）、技能摘要；右上「修改简历」 -->
        <view v-else class="ap-card ap-resume" hover-class="k-press-s" @click="openResume">
          <view class="ap-resume__head">
            <image class="ap-resume__avatar" :src="avatar" mode="aspectFill" />
            <view class="ap-resume__who">
              <text class="ap-resume__name">{{ card.name || '未填称呼' }}</text>
              <text v-if="whoLine" class="ap-resume__meta">{{ whoLine }}</text>
            </view>
            <view class="ap-resume__edit"><text>修改简历</text><k-icon name="chevron-right" :size="12" color="red" /></view>
          </view>
          <view v-if="card.phone || card.skills" class="ap-resume__rows">
            <view v-if="card.phone" class="ap-resume__row"><k-icon name="phone" :size="14" color="muted" /><text>{{ card.phone }}</text></view>
            <view v-if="card.skills" class="ap-resume__row"><k-icon name="sparkles" :size="14" color="muted" /><text class="ap-resume__skills">{{ card.skills }}</text></view>
          </view>
          <view v-if="card.missing.length" class="ap-resume__miss"><k-icon name="info" :size="14" color="alert" /><text>简历还差：{{ card.missing.join('、') }}，补全后才能投递</text></view>
        </view>

        </view>
        <!-- 2 到岗安排（线下岗位）：到岗时间默认 = 岗位开始日期，更早的日子选不了；预计时长默认 = 岗位最短期限，只能更长 -->
        <template v-if="!isOnline">
          <view class="ap-sec"><text class="ap-sec__title">到岗安排</text></view>
          <view class="ap-card ap-plan">
            <!-- 到岗时间点开是月历（k-date-picker）：默认选中岗位开始日，之前的日子置灰点不了（2026-10-19 主人：「默认从他招募那天，之前是灰色的」）。
                 之前是原生日期滚轮：小程序里只是滚不到更早的日子、看不到灰色，网页版从 1876 年起都能滚 -->
            <view class="ap-row" hover-class="k-press-s" @click="openArrival">
              <view class="ap-row__icon"><k-icon name="calendar-days" :size="18" color="ink2" /></view>
              <view class="ap-row__main"><text class="ap-row__label">到岗时间</text><text class="ap-row__hint">{{ arrivalHint }}</text></view>
              <text class="ap-row__value">{{ arrivalLabel }}</text>
              <k-icon name="chevron-right" :size="12" color="muted" />
            </view>
            <view class="ap-plan__line" />
            <view class="ap-row ap-row--top">
              <view class="ap-row__icon"><k-icon name="hourglass" :size="18" color="ink2" /></view>
              <view class="ap-row__main"><text class="ap-row__label">预计时长</text><text class="ap-row__hint">{{ minDays > 0 ? '最短' + durationLabel(minDays) + '，可以选更长' : '选你打算待多久' }}</text></view>
              <text class="ap-row__value">{{ daysLabel }}</text>
            </view>
            <!-- 常用时长：按个数排列数（1–5 个一行、6 个两行三列，见 apply-flow.durationColumns），每行排满、胶囊一样宽；
                 「其他天数」单独一整行，像个输入框，点了自己填（2026-10-19：之前它挤在胶囊里，第二行只剩它一个） -->
            <view class="ap-durs" :class="'ap-durs--' + durCols">
              <view v-for="opt in durations" :key="opt.days" class="ap-dur" :class="{ on: days === opt.days }" hover-class="k-press-s" @click="pickDays(opt.days)"><text>{{ opt.label }}</text></view>
            </view>
            <view class="ap-other" :class="{ on: customDays }" hover-class="k-press-s" @click="askDays">
              <text class="ap-other__label">其他天数</text>
              <text class="ap-other__value">{{ customDays ? days + '天' : (minDays > 0 ? '自己填，至少 ' + minDays + ' 天' : '自己填') }}</text>
              <k-icon :name="otherOpen ? 'chevron-up' : 'chevron-down'" :size="12" :color="customDays ? 'red' : 'muted'" />
            </view>
            <!-- 2026-11-03 主人：简化 —— 点「其他天数」在胶囊下面出一个数字框 + 「确定」（原来弹系统输入框） -->
            <view v-if="otherOpen" class="ap-other-box"><input v-model="otherDays" class="ap-other-box__input" type="number" maxlength="3" :placeholder="minDays > 0 ? '至少 ' + minDays + ' 天，最多 365 天' : '最多 365 天'" placeholder-class="k-placeholder" :focus="true" @confirm="applyOther" /><text class="ap-other-box__unit">天</text><view class="ap-other-box__ok" hover-class="k-press-s" @click="applyOther"><text>确定</text></view></view>
          </view>
        </template>
        <!-- 线上任务：接单说明（选填） -->
        <template v-else>
          <view class="ap-sec"><text class="ap-sec__title">接单说明</text><text class="ap-sec__sub">选填</text></view>
          <view class="ap-card ap-note"><textarea v-model="note" class="ap-note__input" maxlength="500" placeholder="如相关作品、可投入时间或需要沟通的问题" placeholder-class="k-placeholder" :auto-height="true" /></view>
        </template>
        <text class="ap-foot-tip">{{ isOnline ? '全国可接 · 远程完成，无需到店。提交后由发布方审核。' : '确认投递后，简历会发给这家店的主理人；审核、约视频的通知会发到「消息」里。' }}</text>
      </view>

      <!-- 报名结束页（2026-10-31 主人）：安全负责人 + 分享给亲友 + 再投几家。线上任务不出；放在上面的 v-if 链之外，不动链本身 -->
      <k-order-mediation v-if="saved && jobType === 'volunteer' && appId" order-type="application" :order-id="appId" volunteer-dispute />
      <safety-share v-if="saved && !isOnline && appId" :app-id="appId" @ready="onTrip" />
      <multi-apply v-if="saved && !isOnline" :submit-tick="multiTick" :job="job" :job-id="jobId" :arrival="arrival" :days="days" :gender="card.gender" @picked="pickedCount = $event" @busy="multiBusy = $event" @login="askLogin" />
    </view>

    <k-bottom v-if="!closedReason && (jobReady || saved)" flat pad="12px 16px">
      <view class="k-flex1" :class="{ 'ap-two': saved && pickedCount }"><k-button block :type="saved && pickedCount ? 'outline' : 'primary'" :disabled="submitting || multiBusy || (!saved && !canSubmit)" :label="saved ? '查看审核进度' : submitting ? '提交中…' : (isOnline ? '确认提交申请' : '确认投递')" @click="saved ? openProgress() : submit()" /></view>
      <view v-if="saved && pickedCount" class="k-flex1 ap-two"><k-button block :disabled="multiBusy" :label="multiBusy ? '投递中…' : '一键投递（' + pickedCount + ' 家）'" @click="multiSubmit" /></view>
    </k-bottom>
    <k-date-picker v-if="arrivalOpen" title="选择到岗时间" :value="arrival" :min-date="minArrival" @cancel="arrivalOpen = false" @confirm="onArrival" />
  </view>
  </k-feature-gate>
</template>
<script setup>
import { displayWording } from '@/common/display-wording.js'
import { ref, computed, watch, onBeforeUnmount } from 'vue'
import { onLoad, onShareAppMessage, onShow } from '@dcloudio/uni-app'
import { back, go, replace, toast, decodeQuery } from '@/common/screen.js'
import { apiJobDetail, apiSubmitApplication, apiMyApplications, apiResume } from '@/common/api.js'
import { visitSubscriptions, askOnVisit } from '@/common/visit-subscriptions.js'
import { confirm, modal, todayCn } from '@/common/ui.js'
import { absUrl } from '@/common/upload.js'
import { bindShareAfterApply } from '@/common/share.js'
import { loadApplicationDraft, saveApplicationDraft, ensureSession, experience } from '@/common/experience.js'
import R from '@/common/routes.js'
import JobFlowSteps from './components/job-flow-steps.vue'
import SafetyShare from './components/safety-share.vue'
import MultiApply from './components/multi-apply.vue'
import { jobShareFallback, tripShareMessage } from './trip-share.js'
import { applicationDraftForJob, arrivalStart, defaultArrival, arrivalText, defaultDuration, durationOptions, durationColumns, durationLabel, checkDuration, resumeCard } from './apply-flow.js'

// ---------------------------------------------------------------------------
// 报名页（2026-10-18 主人重做）：顶上 7 步进度（这一页是第 1 步「提交资料」）→ 我的简历 → 到岗时间 + 预计时长 → 「确认投递」。
// 姓名 / 年龄 / 手机 / 技能不再在这里填：用「我的简历」投递（服务端从简历取，见 KgApplicationServiceImpl.resumeFallback），
// 线下岗位没有简历先去「我的 → 简历」填一次，填完回来自动刷新。线上任务独立填写称呼、手机和选填说明，不读取或要求简历。
// 到岗时间默认 = 岗位开始日期（已过就是今天），更早的日子选不了；预计时长默认 = 岗位最短期限（30 天就是「一个月」），只能选更长。
// 服务端照旧校验到岗日期不早于开始日、天数不少于最短期限（老版本小程序还在用同一个接口）。
// ---------------------------------------------------------------------------
let pageClosed = false
let formGeneration = 0
let resumeRequest = 0
const saved = ref(false)
const jobTitle = ref('')
const jobTitleError = ref('')
const jobReady = ref(false)
const jobType = ref('')
const isOnline = computed(() => jobType.value === 'online')
const contactName = ref('')
const contactPhone = ref('')
const contactReady = computed(() => !!contactName.value.trim() && /^1[3-9]\d{9}$/.test(contactPhone.value.trim()))
const job = ref({})
const jobId = ref(null)
const appId = ref(null)
const idemKey = ref('')
const submitting = ref(false)
const today = ref(todayCn())

onLoad(q0 => {
  const q = decodeQuery(q0)
  const id = Number(q?.jobId)
  if (Number.isFinite(id) && id > 0) jobId.value = id
  if (q?.title) jobTitle.value = q.title
  loadForm()
})
// 去简历页填完 / 去登录回来：重新读简历（简历卡自动换成填好的样子）
let resumeOpened = false
onShow(() => {
  today.value = todayCn()
  if (!jobReady.value || saved.value) return
  const loggedIn = resumeState.value === 'guest' && !!experience.account
  if (loggedIn) { restoreDraft(); loadProgressTemplate() }
  if (resumeOpened || loggedIn) { resumeOpened = false; loadResume() }
})
const isGuest = async () => { await ensureSession(); return !experience.account }
async function loadForm() {
  const id = jobId.value
  await ensureSession()
  if (pageClosed || id !== jobId.value) return
  const ready = await loadJob()
  if (!ready || pageClosed || id !== jobId.value) return
  if (!experience.account) {
    resumeState.value = 'guest'
    askLogin()
    return
  }
  loadProgressTemplate()
  await loadResume()
}
const askLogin = async () => {
  const scope = formGeneration
  const r = await modal('请先登录', isOnline.value ? '登录后即可申请线上任务，无需填写简历。' : '报名要用你的简历投递，需要先登录，登录后回到这里接着报名。', { confirmText: '去登录', cancelText: '稍后' })
  if (scope === formGeneration && r.confirm) go(R.login)
}

// ---------------- 岗位 ----------------
const closedReason = ref('')
const TYPE_TEXT = { volunteer: '换工旅行', parttime: '兼职旅行', fulltime: '全职旅行', online: '线上任务' }
const minDays = computed(() => Number(job.value.minDays) || 0)
const jobCover = computed(() => absUrl((Array.isArray(job.value.images) && job.value.images[0]) || job.value.cover) || '/static/media/cover-empty.png')
const jobSub = computed(() => [job.value.city, TYPE_TEXT[jobType.value], minDays.value > 0 && !isOnline.value ? '最短' + minDays.value + '天' : ''].filter(Boolean).join(' · '))
let jobRequest = 0
const loadJob = async () => {
  const request = ++jobRequest
  jobReady.value = false
  jobTitleError.value = ''
  closedReason.value = ''
  try {
    if (!jobId.value) throw new Error('请先选择要报名的岗位')
    const d = (await apiJobDetail(jobId.value))?.data
    if (request !== jobRequest) return
    if (!d?.title || !d?.jobType) throw new Error('岗位信息加载失败')
    job.value = d
    jobTitle.value = d.title
    jobType.value = d.jobType
    // 到岗时间、预计时长的默认值按这个岗位定（草稿里存的还有效就用草稿的）
    restoreDraft()
    if (d.acceptsApplication === false) {
      closedReason.value = d.applyClosedReason || (d.status === 'paused' ? '该岗位暂停招聘中，暂不接受报名' : '该岗位当前不接受报名')
      return
    }
    jobReady.value = true
    return true
  } catch (e) {
    if (request !== jobRequest) return
    const msg = e?.message || ''
    if (/不存在|已下架|已关闭|已结束/.test(msg)) closedReason.value = '这个岗位已结束招募或已下架，不再接受报名'
    else jobTitleError.value = msg || '岗位信息加载失败'
  }
}

// ---------------- 我的简历 ----------------
// loading 读取中 / ready 读到了 / failed 读不到 / guest 没登录
const resumeState = ref('loading')
const resume = ref(null)
const loadResume = async () => {
  const request = ++resumeRequest
  if (!experience.account) { resume.value = null; resumeState.value = 'guest'; return }
  if (isOnline.value) {
    if (!contactName.value) contactName.value = experience.account.nickname || ''
    if (!contactPhone.value && /^1[3-9]\d{9}$/.test(experience.account.phone || '')) contactPhone.value = experience.account.phone
    resumeState.value = 'ready'
    return
  }
  resumeState.value = 'loading' 
  resume.value = null
  try {
    const data = (await apiResume()).data
    if (request !== resumeRequest) return
    resume.value = data || null
    resumeState.value = 'ready'
  } catch (e) {
    if (request === resumeRequest) resumeState.value = e && Number(e.code) === 401 ? 'guest' : 'failed'
  }
}
const card = computed(() => resumeCard(resume.value, { online: isOnline.value, accountPhone: experience.account?.phone || '' }))
const avatar = computed(() => absUrl(experience.account?.avatar) || '/static/media/profile-avatar.jpg')
const whoLine = computed(() => [card.value.gender && card.value.gender !== '其他' ? card.value.gender : '', card.value.age ? card.value.age + '岁' : '', card.value.city].filter(Boolean).join(' · '))
// 简历页（「我的 → 简历与机会」）：填完返回本页，onShow 里重新读
const openResume = () => { resumeOpened = true; go(R.resume) }

// ---------------- 到岗时间 / 预计时长 ----------------
const arrival = ref('')
const minArrival = computed(() => arrivalStart(job.value.startDate, today.value))
const arrivalLabel = computed(() => arrivalText(arrival.value) || '请选择')
// 提示短一点（320 宽之前折成三行）：右边大字已经写了默认的那天，月历里更早的日子是灰的
const arrivalHint = computed(() => (minArrival.value > today.value ? arrivalText(minArrival.value).split(' ')[0] + '起可以到岗' : '最早今天就能到'))
// 月历开着没有（k-date-picker）；点「确定日期」带回选中的那天
const arrivalOpen = ref(false)
const openArrival = () => { today.value = todayCn(); arrivalOpen.value = true }
const onArrival = (v) => {
  arrivalOpen.value = false
  if (!v) return
  today.value = todayCn()
  // 月历里更早的日子已经置灰、点不了；草稿里存的旧日期、跨天打开等情况这里再挡一次
  if (v < minArrival.value) { toast('最早 ' + arrivalText(minArrival.value) + ' 到岗'); arrival.value = minArrival.value; return }
  arrival.value = v
}
const days = ref(30)
const durations = computed(() => durationOptions(minDays.value))
const customDays = computed(() => !durations.value.some(o => o.days === days.value))
const durCols = computed(() => durationColumns(durations.value.length))
const daysLabel = computed(() => durationLabel(days.value) + (durationLabel(days.value).indexOf('天') < 0 ? '（' + days.value + '天）' : ''))
// 2026-11-03 主人：简化 —— 「其他天数」不再弹系统输入框：点一下在胶囊下面出数字框，填好点「确定」（或键盘上的完成）；再点一下收起。点常用胶囊也收起
const otherOpen = ref(false)
const otherDays = ref('')
function askDays() {
  if (otherOpen.value) { otherOpen.value = false; return }
  otherDays.value = customDays.value ? String(days.value) : ''
  otherOpen.value = true
}
function pickDays(n) { days.value = n; otherOpen.value = false }
function applyOther() {
  const raw = String(otherDays.value || '').trim()
  if (!raw) { toast('请填写天数'); return false }
  const r = checkDuration(raw, minDays.value)
  if (!r.ok) { toast(r.message); return false }
  days.value = r.days
  otherOpen.value = false
  return true
}
const note = ref('')
function restoreDraft() {
  const d = job.value
  if (!d?.jobType) return
  const draft = applicationDraftForJob(loadApplicationDraft(), jobId.value)
  arrival.value = defaultArrival(d.startDate, today.value, draft.arrival)
  const savedDays = Number(draft.days)
  days.value = Number.isInteger(savedDays) && savedDays >= Math.max(1, Number(d.minDays) || 1) && savedDays <= 365 ? savedDays : defaultDuration(d.minDays, d.jobType)
  note.value = typeof draft.note === 'string' ? draft.note : ''
}

// 能不能点「确认投递」：岗位能报、简历齐了、（线下）选了到岗日期
const canSubmit = computed(() => jobReady.value && (resumeState.value === 'guest' || (isOnline.value ? contactReady.value : (resumeState.value === 'ready' && card.value.ready))) && (isOnline.value || !!arrival.value))

const loadProgressTemplate = () => {
  // #ifdef MP-WEIXIN
  visitSubscriptions.warm()
  // #endif
}

// 幂等键：第一次点「确认投递」时生成，之后重试都用同一个，后端把重复请求收成同一条报名
const makeIdemKey = () => `${jobId.value || 'nojob'}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
async function submit() {
  if (!jobReady.value || submitting.value) return
  if (!isOnline.value) {
    today.value = todayCn()
    if (!arrival.value || arrival.value < minArrival.value) { toast('请选择 ' + arrivalText(minArrival.value) + ' 或之后的到岗时间'); return }
    if (otherOpen.value && !applyOther()) return
    if (minDays.value > 0 && days.value < minDays.value) { toast('这个岗位最短要待 ' + minDays.value + ' 天'); return }
  }
  if (experience.account && (isOnline.value ? contactReady.value : card.value.ready)) askOnVisit()
  const scope = formGeneration
  const guest = await isGuest()
  if (scope !== formGeneration || submitting.value) return
  if (guest) { askLogin(); return }
  loadProgressTemplate()
  if (isOnline.value) {
    if (!contactReady.value) { toast('请填写称呼和有效的联系电话'); return }
  } else {
  if (resumeState.value !== 'ready') { await loadResume() }
  if (scope !== formGeneration || submitting.value) return
  if (resumeState.value !== 'ready') { toast('简历暂时读不到，请重试后再投递'); return }
  if (!card.value.exists) { toast('先填写简历，再投递'); return }
  if (!card.value.ready) {
    if (await confirm('简历还差一点', '简历还差：' + card.value.missing.join('、') + '。补全后回到这里就能投递，现在去补全？') && scope === formGeneration) openResume()
    return
  }
  }
  if (!jobId.value) { toast('请先选择要报名的岗位'); return }
  if (!idemKey.value) idemKey.value = makeIdemKey()
  submitting.value = true
  try {
    // 姓名 / 年龄 / 手机 / 技能不传：服务端从简历取
    const res = await apiSubmitApplication({
      jobId: jobId.value,
      ...(!isOnline.value ? { arrival: arrival.value, days: days.value } : { note: note.value, name: contactName.value.trim(), phone: contactPhone.value.trim() }),
      idemKey: idemKey.value
    })
    if (scope !== formGeneration) return
    appId.value = res?.data?.appId ?? null
    bindShareAfterApply(jobId.value, appId.value)
    try { saveApplicationDraft({ arrival: arrival.value, days: String(days.value), note: note.value, jobId: jobId.value, jobTitle: jobTitle.value }) } catch (e) { /* 存不进不影响已提交的报名 */ }
    saved.value = true
    toast(isOnline.value ? '申请已提交' : '已投递', 'success')
    uni.pageScrollTo({ scrollTop: 0, duration: 200, fail: () => {} })
  } catch (e) {
    if (scope !== formGeneration) return
    if (e?.code === 401) { e.loginHandled = true; askLogin(); return }
    const msg = e?.message || '提交失败，请重试'
    if (/已报名该岗位/.test(msg)) openExisting(msg)
    else toast(msg)
  } finally {
    if (scope === formGeneration) submitting.value = false
  }
}
// ---------------- 报名结束页（2026-10-31 主人）：分享给亲友、一键多投 ----------------
// 右上角「···转发」和页面里的分享钮都走这里：报名成功、读到行程后发行程卡片（亲友打开不用登录的行程页）；还没报名成功时发岗位详情
const trip = ref(null)
const onTrip = (value) => { trip.value = value }
onShareAppMessage(() => tripShareMessage(trip.value, jobShareFallback(jobId.value, jobTitle.value)))
// 「再投几家」勾了几家、在不在投：底栏第二个按钮看它们；点了调组件的 submit（确认、逐家投递都在组件里）
const multiTick = ref(0)
const pickedCount = ref(0)
const multiBusy = ref(false)
const multiSubmit = () => { multiTick.value++ }
// 投递成功后换成进度页（替换本页，返回直接回岗位详情）
const openProgress = () => { if (appId.value) replace(R.jobProgress + '?appId=' + appId.value); else back() }
// 重复报名：查出这个岗位进行中的那条报名，问一句要不要去看进度（进行中的口径与后端 countActiveByUserAndJob 一致）
const ENDED = ['review_rejected', 'withdrawn', 'terminated']
async function openExisting(msg) {
  const scope = formGeneration
  try {
    const mine = (await apiMyApplications()).data || []
    if (scope !== formGeneration) return
    const a = mine.find(x => String(x.jobId) === String(jobId.value) && ENDED.indexOf(x.status) < 0)
    if (a) {
      if (await confirm('这个岗位你已报过名', '同一岗位只能有一条进行中的报名，去查看那条报名的进度？') && scope === formGeneration) replace(R.jobProgress + '?appId=' + a.appId)
      return
    }
  } catch (e) { /* 查不到就只提示原因 */ }
  if (scope === formGeneration) toast(msg)
}

watch([() => experience.account?.id, jobId], ([id, jobKey], [, previousJob]) => {
  if (jobKey !== previousJob) {
    jobRequest++
    job.value = {}
    jobReady.value = false
    jobType.value = jobTitle.value = arrival.value = closedReason.value = jobTitleError.value = ''
    days.value = 30
  }
  formGeneration++
  resumeRequest++
  saved.value = false
  appId.value = null
  resume.value = null
  trip.value = null
  resumeState.value = id ? 'loading' : 'guest'
  contactName.value = contactPhone.value = note.value = idemKey.value = ''
  submitting.value = multiBusy.value = false
  resumeOpened = arrivalOpen.value = otherOpen.value = false
  pickedCount.value = multiTick.value = 0
  otherDays.value = ''
  restoreDraft()
  if (id && jobReady.value) { loadProgressTemplate(); loadResume() }
}, { flush: 'sync' })
onBeforeUnmount(() => { pageClosed = true; formGeneration++; resumeRequest++; jobRequest++ })
</script>
<style scoped lang="scss">
/* 10-19 和岗位详情（参考图「岗位详情」）同一套视觉：极浅暖米渐变底、白卡 18 圆角 + 暖色细边 + 柔和暖阴影、标题用标题字体、选中是浅橙底橙棕描边、底部暖棕渐变大胶囊 */
.ap-page { --k-bg: #F7EFE6; background: linear-gradient(180deg, #F7EFE6 0%, #FBF7F1 360px, #FBF7F1 100%); }
.ap-page .k-bottom { background: #FFFFFF; box-shadow: 0 -6px 18px rgba(120, 84, 48, .08); }
.ap-page .k-bottom :deep(.k-button) { height: 50px; border-radius: 25px; font-family: var(--k-display-font); font-size: 17px; font-weight: 700; letter-spacing: 2px; }
.ap-page .k-bottom :deep(.k-button.is-primary) { background: linear-gradient(135deg, #8E5E37 0%, #6E4628 100%); box-shadow: 0 6px 14px rgba(110, 70, 40, .28); }
/* 还没简历 / 简历缺项时「确认投递」点不了：第二轮起按公共按钮的「原配色整体变淡」，这里不再盖冷灰 */
.ap { padding: 6px 16px calc(104px + var(--k-safe-bottom)); }
.ap-card { margin-top: 12px; border-radius: 18px; background: var(--k-paper); box-shadow: 0 8px 24px rgba(120, 84, 48, .08), 0 0 0 1px rgba(160, 120, 80, .1); }
.ap-flow { margin-top: 4px; padding: 14px 6px 12px; }
/* 报的是哪个岗位：一条浅色横条，不抢简历卡的风头 */
.ap-job { margin-top: 14px; display: flex; align-items: center; gap: 12px; }
.ap-job__img { flex: 0 0 auto; width: 56px; height: 56px; border-radius: 14px; box-shadow: 0 4px 12px rgba(120, 84, 48, .14); background: var(--k-paper2); }
.ap-job__main { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 3px; }
.ap-job__title { font-family: var(--k-display-font); font-size: 18px; font-weight: 700; line-height: 1.35; color: var(--k-ink); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ap-job__sub { font-size: 12px; color: var(--k-muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ap-sec { margin-top: 22px; padding-left: 14px; display: flex; align-items: baseline; gap: 8px; } /* 小标题和卡片里的字对齐，也让开左边的客服小钮（k-fab 宽 28） */
.ap-sec__title { font-family: var(--k-display-font); font-size: 19px; font-weight: 900; letter-spacing: .5px; color: #3B2A1E; }
.ap-sec__sub { font-size: 12px; color: var(--k-muted); }
.ap-muted { font-size: 13px; color: var(--k-muted); }
.ap-state { padding: 18px 16px; display: flex; flex-direction: column; gap: 8px; }
.ap-state__text { font-size: 14px; line-height: 1.7; color: var(--k-muted); }
.ap-state__text--alert { color: var(--k-alert); font-weight: 600; }
.ap-state__btn { margin-top: 4px; align-self: flex-start; width: 140px; }
/* 简历卡 */
.ap-resume { padding: 16px; }
.ap-resume--loading { min-height: 84px; display: flex; align-items: center; justify-content: center; }
.ap-resume__head { display: flex; align-items: center; gap: 12px; }
.ap-resume__avatar { flex: 0 0 auto; width: 56px; height: 56px; border-radius: 50%; border: 3px solid #FFFFFF; box-shadow: 0 3px 10px rgba(120, 84, 48, .18); background: var(--k-paper2); }
.ap-resume__who { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 3px; }
.ap-resume__name { font-family: var(--k-display-font); font-size: 19px; font-weight: 700; color: var(--k-ink); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
/* 「女 · 24岁 · 杭州」一行写完（320 宽之前折成「杭 / 州」）；技能摘要只在「 · 」处换行，不把「民宿管家」拆成两行 */
.ap-resume__meta { font-size: 13px; color: var(--k-ink2); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.ap-resume__edit { flex: 0 0 auto; height: 28px; padding: 0 8px 0 12px; border-radius: 14px; background: #FCEBD8; box-shadow: inset 0 0 0 1px #EFD3B3; display: flex; align-items: center; gap: 2px; font-size: 12px; font-weight: 600; color: var(--k-red-deep); }
.ap-resume__rows { margin-top: 14px; padding-top: 12px; border-top: 1px solid var(--k-line); display: flex; flex-direction: column; gap: 8px; }
.ap-resume__row { display: flex; align-items: flex-start; gap: 8px; font-size: 13px; line-height: 18px; color: var(--k-ink2); }
.ap-resume__skills { flex: 1; min-width: 0; word-break: keep-all; overflow-wrap: break-word; }
.ap-resume__miss { margin-top: 12px; padding: 8px 10px; border-radius: 10px; background: var(--k-alert-soft); display: flex; align-items: center; gap: 6px; font-size: 12px; line-height: 1.5; color: var(--k-alert); }
/* 没有简历：袋鼠贴纸 + 一句话 + 暖棕按钮 */
.ap-empty { padding: 22px 16px 20px; display: flex; flex-direction: column; align-items: center; text-align: center; background: linear-gradient(180deg, #FBF4EA 0%, #FFFFFF 70%); }
.ap-empty__art { width: 64px; height: 64px; border-radius: 50%; background: #fff; box-shadow: 0 4px 14px rgba(154, 107, 63, .16); display: flex; align-items: center; justify-content: center; }
.ap-empty__img { width: 40px; height: 42px; }
.ap-empty__title { margin-top: 12px; font-family: var(--k-display-font); font-size: 17px; font-weight: 700; color: var(--k-ink); }
.ap-empty__text { margin-top: 4px; font-size: 13px; color: var(--k-muted); }
.ap-empty__btn { margin-top: 14px; height: 38px; padding: 0 14px 0 20px; border-radius: 19px; background: linear-gradient(135deg, #8E5E37 0%, #6E4628 100%); box-shadow: 0 4px 12px rgba(154, 107, 63, .28); display: flex; align-items: center; gap: 4px; font-size: 14px; font-weight: 600; color: #fff; }
/* 到岗安排 */
.ap-plan { padding: 4px 16px 16px; }
.ap-plan__line { height: 1px; margin-left: 42px; background: var(--k-line); }
.ap-row { min-height: 62px; display: flex; align-items: center; gap: 10px; }
.ap-row--top { min-height: 58px; }
.ap-row__icon { flex: 0 0 auto; width: 32px; height: 32px; border-radius: 10px; background: #FCEBD8; display: flex; align-items: center; justify-content: center; }
.ap-row__main { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
.ap-row__label { font-size: 15px; font-weight: 600; color: var(--k-ink); }
.ap-row__hint { font-size: 11px; line-height: 1.45; color: var(--k-muted); }
.ap-row__value { flex: 0 0 auto; font-family: var(--k-display-font); font-size: 16px; font-weight: 700; color: #A0632E; }
/* 时长：4 列等宽胶囊，选中暖棕描边 + 浅底（和筛选面板同一个样子） */
.ap-durs { margin-left: 42px; display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 8px; }
/* 列数跟着选项个数走（durationColumns）：每行排满，不在第二行留一个孤零零的胶囊 */
.ap-durs--1 { grid-template-columns: minmax(0, 1fr); }
.ap-durs--2 { grid-template-columns: repeat(2, minmax(0, 1fr)); }
.ap-durs--3 { grid-template-columns: repeat(3, minmax(0, 1fr)); }
.ap-durs--5 { grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 6px; }
.ap-dur { min-width: 0; height: 32px; box-sizing: border-box; border: 1px solid transparent; border-radius: 16px; background: #F4F1EC; display: flex; align-items: center; justify-content: center; font-size: 13px; color: #3A322B; white-space: nowrap; }
.ap-dur.on { border-color: #E0A86E; background: #FCEBD7; color: #A0632E; font-weight: 700; }
/* 「其他天数」：一整行，左边名字、右边「自己填，至少 N 天」或填好的天数，选中和胶囊同一个样子 */
.ap-other { margin: 8px 0 0 42px; height: 34px; padding: 0 10px 0 14px; box-sizing: border-box; border: 1px solid transparent; border-radius: 17px; background: #F4F1EC; display: flex; align-items: center; gap: 6px; }
.ap-other.on { border-color: #E0A86E; background: #FCEBD7; }
.ap-other__label { flex: 0 0 auto; font-size: 13px; color: #3A322B; }
.ap-other__value { flex: 1; min-width: 0; text-align: right; font-size: 12px; color: var(--k-muted); overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
.ap-other.on .ap-other__label, .ap-other.on .ap-other__value { color: #A0632E; font-weight: 700; }
/* 2026-11-03 主人：简化 —— 「其他天数」下面的数字框：左边输入、「天」、右边「确定」（44px 高，老年人好点） */
.ap-other-box { margin: 8px 0 0 42px; height: 44px; padding: 0 4px 0 14px; box-sizing: border-box; border: 1px solid #E0A86E; border-radius: 22px; background: var(--k-paper); display: flex; align-items: center; gap: 6px; }
.ap-other-box__input { flex: 1; min-width: 0; height: 42px; font-size: 16px; color: var(--k-ink); }
.ap-other-box__unit { flex: 0 0 auto; font-size: 14px; color: var(--k-muted); }
.ap-other-box__ok { flex: 0 0 auto; height: 40px; padding: 0 16px; border-radius: 20px; background: linear-gradient(135deg, #8E5E37 0%, #6E4628 100%); color: #fff; font-size: 14px; font-weight: 600; display: flex; align-items: center; }
/* 底栏两个按钮并排（勾选了「再投几家」时）：字收小一点，320 宽也放得下「一键投递（5 家）」 */
.ap-page .k-bottom .ap-two :deep(.k-button) { padding: 0 6px; font-size: 15px; letter-spacing: 0; }
@media (max-width: 359px) {
  .ap-durs, .ap-other { margin-left: 0; }
  .ap-durs--5 .ap-dur { font-size: 12px; }
}
/* 320 宽：头像、「修改简历」收小一点，给名字和「女 · 24岁 · 杭州」留出一行的宽度 */
@media (max-width: 359px) {
  .ap-resume__head { gap: 10px; }
  .ap-resume__avatar { width: 46px; height: 46px; }
  .ap-resume__edit { padding: 0 5px 0 9px; font-size: 11px; }
  .ap-resume__meta { font-size: 12px; }
}
.ap-note { padding: 12px 14px; }
.ap-note__input { width: 100%; min-height: 96px; font-size: 14px; line-height: 1.6; color: var(--k-ink); }
.ap-foot-tip { display: block; margin-top: 14px; padding: 0 2px; font-size: 12px; line-height: 1.7; color: var(--k-muted); }
/* 投递成功 */
/* 2026-10-31 成功页下面多了安全负责人、分享、再投几家：这一张收成左图标右文字一横条，别占大半屏 */
.ap-done { padding: 14px 14px 14px 18px; display: grid; grid-template-columns: 44px minmax(0, 1fr); column-gap: 14px; align-items: start; }
.ap-done__icon { grid-row: 1 / 3; width: 44px; height: 44px; margin-top: 3px; border-radius: 50%; background: linear-gradient(135deg, #F0A35A 0%, #E07E2E 100%); box-shadow: 0 0 0 6px rgba(154, 107, 63, .12); display: flex; align-items: center; justify-content: center; }
.ap-done__title { font-family: var(--k-display-font); font-size: 19px; line-height: 26px; font-weight: 900; color: var(--k-ink); }
.ap-done__text { margin-top: 2px; font-size: 13px; line-height: 20px; color: var(--k-ink2); }
@import "flow-premium.scss";
</style>

<style scoped>
.online-contact{padding:18px;display:flex;flex-direction:column;gap:18px}.online-contact label{font-size:14px}.online-contact input{margin-top:8px;min-height:44px;padding:0 12px;border:1px solid var(--k-line);border-radius:10px;background:var(--k-paper2)}
</style>

<style scoped>
.online-contact label{display:block;font-weight:600;margin:12px 0}.online-contact input{box-sizing:border-box;width:100%;height:46px;border:1px solid var(--k-line);border-radius:12px;padding:10px;margin-top:8px;background:white;font-weight:400}
/* ==== r3jobsb 第三轮 start ==== */
/* 第三轮（11-18）：到岗安排两个数值同一个样子（14/600 深棕、等宽数字），没箭头的那行右边空出箭头的位置，两个数值右边缘对齐；
   页边距 16、卡内 16，区块标题上 20 下 10。 */
.ap-page .ap { padding-left: 16px; padding-right: 16px; }
.ap-page .ap-row__value { font-size: 14px; font-weight: 600; color: var(--k-red-deep); font-variant-numeric: tabular-nums; }
.ap-page .ap-row--top .ap-row__value { margin-right: 22px; }
.ap-page .ap-sec { margin-top: 20px; margin-bottom: 2px; padding-left: 4px; }
.ap-page .ap-job { padding: 12px; }
.ap-page .ap-resume { padding: 16px; }
.ap-page .ap-plan { padding: 2px 16px 16px; }
.ap-page .ap-row__icon { width: 36px; height: 36px; border-radius: 10px; background: var(--k-red-soft); }
.ap-page .ap-empty__art { background: var(--k-red-soft); }
.ap-page .ap-row__icon, .ap-page .ap-empty__art { flex: 0 0 auto; }
.ap-page .ap-foot-tip { padding: 0 4px; font-size: 12px; line-height: 1.6; color: var(--k-muted); }
@media (max-width: 359px) { .ap-page .ap { padding-left: 12px; padding-right: 12px; } }

/* —— 返修 1：整条报名流程（报名 / 审核进度 / 面试 / 签约 / 交付）页边距统一 12；区块标题、底部说明和白卡左边对齐（不再多缩 4） —— */
.ap-page .ap { padding-left: 12px; padding-right: 12px; }
.ap-page .ap-sec { padding-left: 0; }
.ap-page .ap-foot-tip { padding: 0; }
/* 时长选项和筛选页胶囊同一种形状：32 高、全圆角 */
.ap-page .ap-dur { height: 32px; border-radius: 16px; }
/* 「一个月（30天）」末尾全角括号自带右侧空白，往右挪 6 抵掉，和上面日期的右边缘对齐 */
.ap-page .ap-row--top .ap-row__value { margin-right: 16px; }
.ap-page .ap-row__main { flex: 1; min-width: 0; }
.ap-page .ap-row__value { flex: 0 0 auto; }
/* 还没有简历：和全站空状态同一套——56 浅棕圆角方块，里面 32 的品牌袋鼠标 */
.ap-page .ap-empty { background: var(--k-paper); }
.ap-page .ap-empty__art { width: 56px; height: 56px; border-radius: 16px; background: var(--k-red-soft); box-shadow: none; }
.ap-page .ap-empty__img { width: 32px; height: 32px; }
/* 岗位加载失败 / 不接报名：卡内居中——56 浅棕方块 + 32 线性图标、14/500 标题、12 说明、36 高次按钮小胶囊 */
.ap-page .ap-state { padding: 32px 24px; align-items: center; gap: 0; text-align: center; }
.ap-page .ap-state--error { margin-top: 64px; }
.ap-page .ap-state__icon { width: 56px; height: 56px; margin-bottom: 12px; border-radius: 16px; background: var(--k-red-soft); display: flex; align-items: center; justify-content: center; }
.ap-page .ap-state__text { font-size: 12px; line-height: 1.6; color: var(--k-muted); }
.ap-page .ap-state__text + .ap-state__text { margin-top: 4px; }
.ap-page .ap-state__text--alert { font-size: 14px; font-weight: 500; line-height: 20px; color: var(--k-ink2); }
.ap-page .ap-state__btn { width: auto; margin-top: 16px; align-self: center; }
.ap-page .ap-state__btn :deep(.k-button) { height: 36px; padding: 0 16px; border-radius: 18px; font-size: 13px; font-weight: 500; }
@media (max-width: 359px) {
  .ap-page .ap-row__value { font-size: 13px; }
  .ap-page .ap-row__hint { font-size: 11px; }
}
/* —— 返修 2 start —— */
/* 底栏按钮和上面白卡同一条边（页边距 12，见 k-bottom 的 pad） */
/* 区块标题到白卡看上去 10 */
.ap-page .ap-sec { margin-bottom: 6px; }
/* 到岗安排：时长胶囊、「其他天数」、数字框、分隔线左边和行标题文字对齐（36 图标 + 10） */
.ap-page .ap-durs, .ap-page .ap-other, .ap-page .ap-other-box, .ap-page .ap-plan__line { margin-left: 46px; }
@media (max-width: 359px) {
  /* 「最短一个月，可以选更长」一行写完，放不下就省略，不再把「更长」甩到第二行 */
  .ap-page .ap-row--top .ap-row__hint { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
}
/* —— 返修 2 end —— */
/* —— 返修 3 start（11-18 晚）—— */
/* 整条报名流程页边距 16（筛选 / 通知 / 行程也是 16，翻页时左右不跳） */
.ap-page .ap { padding-left: 16px; padding-right: 16px; }
/* 岗位加载失败：不要白卡，整组空状态放到约 40% 屏高 */
.ap-page .ap-state--error { margin-top: 22vh; padding: 0 16px; border: 0; background: none; box-shadow: none; }
/* —— 返修 3 end —— */
/* —— 返修 4 start（11-18 夜）—— */
/* 岗位卡内边距 12 / 16：封面左边和简历卡头像、到岗安排的方块同一条线 */
.ap-page .ap-job { padding: 12px 16px; }
/* 岗位加载失败：标题 15/600 做焦点，标题到按钮 12 */
.ap-page .ap-state--error .ap-state__text--alert { font-size: 15px; font-weight: 600; line-height: 22px; color: var(--k-ink); }
.ap-page .ap-state--error .ap-state__btn { margin-top: 12px; }
@media (max-width: 359px) {
  /* 320 宽「最短一个月，可以选更长」写全：允许两行，不再省略 */
  .ap-page .ap-row--top .ap-row__hint { white-space: normal; overflow: visible; text-overflow: clip; }
}
/* —— 返修 4 end —— */
/* —— 返修 5 start（11-18 深夜）—— */
@media (max-width: 359px) {
  /* 「预计时长」：说明独占一行，值放到说明下面左对齐，一行一个意思 */
  .ap-page .ap-row--top { flex-wrap: wrap; }
  .ap-page .ap-row--top .ap-row__main { flex: 1 1 0; }
  .ap-page .ap-row--top .ap-row__value { flex: 0 0 100%; margin-top: 4px; padding-left: 46px; box-sizing: border-box; text-align: left; }
}
/* 底部说明不被底栏挡住：页面底部留白 = 底栏（12 + 50 + 12）+ 16 */
.ap-page .ap { padding-bottom: calc(90px + var(--k-safe-bottom)); }
/* 简历还在读取（含未登录时）：不再是一张空白卡，字居中、浅棕底的小卡 */
.ap-page .ap-resume--loading { min-height: 72px; border: 0; background: var(--k-paper); }
.ap-page .ap-resume--loading .ap-muted { font-size: 13px; color: var(--k-muted); }
/* 岗位加载失败：标题到按钮 16，按钮高 36 */
.ap-page .ap-state--error .ap-state__btn { margin-top: 16px; }
.ap-page .ap-state--error .ap-state__btn :deep(.k-button) { height: 36px; }
/* —— 返修 5 end —— */
/* ==== r3jobsb 第四轮 start（11-18 夜，以微信实拍为准）==== */
/* 步骤条不再套白卡，直接放在页首；岗位卡做首屏主角（72 方图 + 16/600 两行标题） */
.ap-page .ap-flow { margin-top: 0; padding: 8px 0 4px; background: transparent; box-shadow: none; }
.ap-page .ap-job { margin-top: 12px; padding: 12px; gap: 12px; align-items: center; }
.ap-page .ap-job__img { width: 72px; height: 72px; flex: 0 0 72px; border-radius: 8px; }
.ap-page .ap-job__title { font-size: 16px; font-weight: 600; line-height: 22px; word-break: break-all; }
.ap-page .ap-job__sub { margin-top: 4px; font-size: 12px; line-height: 18px; color: var(--k-muted); }
.ap-page .ap-sec { margin-top: 24px; }
/* 简历卡：「修改简历」用卡片小按钮的 soft 款（浅棕底、无边、28 高）；电话和技能并成一行 */
.ap-page .ap-resume__edit { height: 28px; padding: 0 8px 0 12px; gap: 2px; border: 0; border-radius: 14px; background: var(--k-red-soft); box-shadow: none; font-size: 12px; font-weight: 500; color: var(--k-red-deep); }
.ap-page .ap-resume__rows { display: flex; flex-direction: row; flex-wrap: wrap; align-items: center; gap: 4px 16px; margin-top: 12px; padding-top: 12px; }
.ap-page .ap-resume__row { gap: 4px; font-size: 13px; line-height: 18px; color: var(--k-ink2); }
/* 到岗安排：值改墨色 15/600 等宽（全屏只留底栏一处暖棕实心）；图标不加底 */
.ap-page .ap-row__icon { width: 18px; height: 18px; flex: 0 0 18px; border-radius: 0; background: none; }
.ap-page .ap-row { gap: 8px; }
.ap-page .ap-row__value { font-size: 15px; font-weight: 600; color: var(--k-ink); font-variant-numeric: tabular-nums; }
.ap-page .ap-durs, .ap-page .ap-other, .ap-page .ap-other-box, .ap-page .ap-plan__line { margin-left: 26px; }
.ap-page .ap-dur { height: 32px; border: 1px solid transparent; border-radius: 16px; background: var(--k-fill); font-size: 13px; color: var(--k-ink2); }
.ap-page .ap-dur.on { border-color: var(--k-red); background: var(--k-red-soft); color: var(--k-red-deep); font-weight: 600; }
/* 「其他天数」：不再是白卡里的米色框，改成上方发丝线的列表行（高 44） */
.ap-page .ap-other { position: relative; height: 44px; margin-top: 12px; padding: 0; border: 0; border-radius: 0; background: transparent; }
.ap-page .ap-other::before { content: ''; position: absolute; left: 0; right: 0; top: 0; height: 1px; background: var(--k-line); transform: scaleY(.5); transform-origin: 0 0; }
.ap-page .ap-other.on { background: transparent; }
.ap-page .ap-other__label { font-size: 14px; color: var(--k-ink); }
.ap-page .ap-other__value { font-size: 13px; color: var(--k-muted); }
.ap-page .ap-foot-tip { margin-top: 12px; font-size: 12px; line-height: 1.6; color: var(--k-muted); }
@media (max-width: 359px) {
  .ap-page .ap-row--top .ap-row__value { padding-left: 26px; }
  .ap-page .ap-job__img { width: 64px; height: 64px; flex-basis: 64px; }
}
/* ==== r3jobsb 第四轮 end ==== */
/* ==== r3jobsb 第四轮返修 start（11-19，复评遗留）==== */
/* 到岗安排：「一个月（30天）」右边让出上一行箭头的位置（12 + 间距 8），两个值右边对齐 */
.ap-page .ap-row--top .ap-row__value { margin-right: 20px; }
@media (max-width: 359px) { .ap-page .ap-row--top .ap-row__value { margin-right: 0; } }
/* ==== r3jobsb 第四轮返修 end ==== */
/* ==== r3jobsb 第五轮 start（11-19，按微信实拍复评）==== */
/* 步骤条（job-flow-steps 里已退成 10 号浅灰、当前步 11/600）：上下只留 4，岗位卡往上提 */
.ap-page .ap-flow { padding: 4px 0 0; }
/* 「修改简历」改成无底文字按钮：13/500 深棕 + 12 号箭头（箭头字形和卡片内容右边对齐）；浅棕底只留给选中的时长胶囊 */
.ap-page .ap-resume__edit { height: 28px; margin-right: -4px; padding: 0; gap: 2px; border: 0; border-radius: 0; background: transparent; box-shadow: none; font-size: 13px; font-weight: 500; color: var(--k-red-deep); }
@media (max-width: 359px) { .ap-page .ap-resume__edit { padding: 0; font-size: 12px; } }
/* 岗位加载失败 / 不接报名 / 没有简历：和本组其它空状态同一种方块（56、圆角 16、中性浅底、32 号灰色线性图标） */
.ap-page .ap-state__icon, .ap-page .ap-empty__art { background: var(--k-fill); }
/* ==== r3jobsb 第五轮 end ==== */
/* ==== r3jobsb 第三轮 end ==== */
</style>

<style scoped lang="scss">
.ap-page.user-surface {
  .ap-card, .ap-job { border-radius: 12px; }
  .ap-job__img { border-radius: 9px; }
  .ap-row { min-height: 44px; }
  .ap-row__value { min-width: 0; }
  .ap-sec__title { color: var(--k-ink); }
  .ap-other-box:focus-within { box-shadow: inset 0 0 0 1px var(--k-red-line); }
  .ap-empty__art { background-color: var(--user-icon-field); }
}
</style>
