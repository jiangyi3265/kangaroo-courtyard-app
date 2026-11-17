<template>
  <k-feature-gate feature="recruitment">
  <view class="k-page ap-page">
    <k-topbar :title="isOnline ? '申请接单' : '报名加入'" back />
    <view class="ap">
      <!-- 7 步进度（2026-10-18，和进度页同一套，见 ./apply-flow.js）：报名页就是第 1 步「提交资料」；线上任务没有到店这一套，不出 -->
      <view v-if="!closedReason && jobType && !isOnline" class="ap-card ap-flow"><job-flow-steps :current="saved ? 2 : 1" /></view>

      <!-- 报的是哪个岗位：封面 + 名字 + 城市 / 类型 / 最短期限 -->
      <view v-if="jobTitle" class="ap-job">
        <image class="ap-job__img" :src="jobCover" mode="aspectFill" />
        <view class="ap-job__main"><text class="ap-job__title">{{ displayWording(jobTitle) }}</text><text v-if="jobSub" class="ap-job__sub">{{ jobSub }}</text></view>
      </view>

      <view v-if="jobTitleError" class="ap-card ap-state"><text class="ap-state__text ap-state__text--alert">{{ jobTitleError }}</text><view class="ap-state__btn"><k-button type="outline" size="md" label="重新加载岗位" @click="loadJob" /></view></view>
      <!-- 已满员 / 已截止 / 已暂停：只写原因，不摆一张填不了的表 -->
      <view v-else-if="closedReason" class="ap-card ap-state"><text class="ap-state__text ap-state__text--alert">{{ closedReason }}</text><text class="ap-state__text">{{ isOnline ? '这个任务现在不接新的申请，可以回去看看其他线上任务。' : '这个岗位现在不接新的报名，可以回去看看其他岗位。' }}</text><view class="ap-state__btn"><k-button type="outline" size="md" label="返回" @click="back()" /></view></view>

      <!-- 投递成功 -->
      <view v-else-if="saved" class="ap-card ap-done">
        <view class="ap-done__icon"><k-icon name="check" :size="26" color="white" :stroke="2.6" /></view>
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
          <view class="ap-empty__art"><image class="ap-empty__img" src="/static/media/brand-kangaroo.png" mode="aspectFit" /></view>
          <text class="ap-empty__title">还没有简历，先去填写</text>
          <text class="ap-empty__text">只填一次，以后报名直接确认投递</text>
          <view class="ap-empty__btn" hover-class="k-press-s" @click="openResume"><text>去填写简历</text><k-icon name="chevron-right" :size="15" color="white" :stroke="2.2" /></view>
        </view>
        <!-- 有简历：头像、称呼、年龄 · 城市、手机（打码）、技能摘要；右上「修改简历」 -->
        <view v-else class="ap-card ap-resume" hover-class="k-press-s" @click="openResume">
          <view class="ap-resume__head">
            <image class="ap-resume__avatar" :src="avatar" mode="aspectFill" />
            <view class="ap-resume__who">
              <text class="ap-resume__name">{{ card.name || '未填称呼' }}</text>
              <text v-if="whoLine" class="ap-resume__meta">{{ whoLine }}</text>
            </view>
            <view class="ap-resume__edit"><text>修改简历</text><k-icon name="chevron-right" :size="14" color="red" :stroke="2" /></view>
          </view>
          <view v-if="card.phone || card.skills" class="ap-resume__rows">
            <view v-if="card.phone" class="ap-resume__row"><k-icon name="phone" :size="14" color="muted" :stroke="1.8" /><text>{{ card.phone }}</text></view>
            <view v-if="card.skills" class="ap-resume__row"><k-icon name="sparkles" :size="14" color="muted" :stroke="1.8" /><text class="ap-resume__skills">{{ card.skills }}</text></view>
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
            <view class="ap-row" hover-class="k-press-s" @click="arrivalOpen = true">
              <view class="ap-row__icon"><k-icon name="calendar-days" :size="17" color="red" :stroke="1.8" /></view>
              <view class="ap-row__main"><text class="ap-row__label">到岗时间</text><text class="ap-row__hint">{{ arrivalHint }}</text></view>
              <text class="ap-row__value">{{ arrivalLabel }}</text>
              <k-icon name="chevron-right" :size="15" color="muted" />
            </view>
            <view class="ap-plan__line" />
            <view class="ap-row ap-row--top">
              <view class="ap-row__icon"><k-icon name="hourglass" :size="17" color="red" :stroke="1.8" /></view>
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
              <k-icon :name="otherOpen ? 'chevron-up' : 'chevron-down'" :size="14" :color="customDays ? 'red' : 'muted'" :stroke="2" />
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
      <safety-share v-if="saved && !isOnline && appId" :app-id="appId" @ready="onTrip" />
      <multi-apply v-if="saved && !isOnline" :submit-tick="multiTick" :job="job" :job-id="jobId" :arrival="arrival" :days="days" :gender="card.gender" @picked="pickedCount = $event" @busy="multiBusy = $event" @login="askLogin" />
    </view>

    <k-bottom v-if="!closedReason && (jobReady || saved)" flat>
      <view class="k-flex1" :class="{ 'ap-two': saved && pickedCount }"><k-button block :type="saved && pickedCount ? 'outline' : 'primary'" :disabled="submitting || multiBusy || (!saved && !canSubmit)" :label="saved ? '查看审核进度' : submitting ? '提交中…' : (isOnline ? '确认提交申请' : '确认投递')" @click="saved ? openProgress() : submit()" /></view>
      <view v-if="saved && pickedCount" class="k-flex1 ap-two"><k-button block :disabled="multiBusy" :label="multiBusy ? '投递中…' : '一键投递（' + pickedCount + ' 家）'" @click="multiSubmit" /></view>
    </k-bottom>
    <k-date-picker v-if="arrivalOpen" title="选择到岗时间" :value="arrival" :min-date="minArrival" @cancel="arrivalOpen = false" @confirm="onArrival" />
  </view>
  </k-feature-gate>
</template>
<script setup>
import { displayWording } from '@/common/display-wording.js'
import { ref, computed } from 'vue'
import { onLoad, onShareAppMessage, onShow } from '@dcloudio/uni-app'
import { back, go, replace, toast, decodeQuery } from '@/common/screen.js'
import { apiJobDetail, apiSubmitApplication, apiMyApplications, apiSubscribePrepare, apiSubscribeAccept, apiResume } from '@/common/api.js'
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
const today = todayCn()

onLoad(q0 => {
  const q = decodeQuery(q0)
  const id = Number(q?.jobId)
  if (Number.isFinite(id) && id > 0) jobId.value = id
  if (q?.title) jobTitle.value = q.title
  // 不收报名的岗位不再催游客去登录（登录了也报不了）
  loadJob().then(isGuest).then(g => {
    if (g && !closedReason.value) askLogin()
    else if (!g) { restoreDraft(); loadProgressTemplate(); loadResume() }
  })
})
// 去简历页填完 / 去登录回来：重新读简历（简历卡自动换成填好的样子）
let resumeOpened = false
onShow(() => {
  if (!jobId.value || saved.value) return
  if (resumeState.value === 'guest' && experience.account) restoreDraft()
  if (resumeOpened || (resumeState.value === 'guest' && experience.account)) { resumeOpened = false; loadResume() }
})
const isGuest = async () => { await ensureSession(); return !experience.account }
const askLogin = async () => {
  const r = await modal('请先登录', isOnline.value ? '登录后即可申请线上任务，无需填写简历。' : '报名要用你的简历投递，需要先登录，登录后回到这里接着报名。', { confirmText: '去登录', cancelText: '稍后' })
  if (r.confirm) go(R.login)
}

// ---------------- 岗位 ----------------
const closedReason = ref('')
const TYPE_TEXT = { volunteer: '换宿旅行', parttime: '兼职旅行', fulltime: '全职旅行', online: '线上任务' }
const minDays = computed(() => Number(job.value.minDays) || 0)
const jobCover = computed(() => absUrl((Array.isArray(job.value.images) && job.value.images[0]) || job.value.cover) || '/static/media/cover-empty.png')
const jobSub = computed(() => [job.value.city, TYPE_TEXT[jobType.value], minDays.value > 0 && !isOnline.value ? '最短' + minDays.value + '天' : ''].filter(Boolean).join(' · '))
const loadJob = async () => {
  jobReady.value = false
  jobTitleError.value = ''
  closedReason.value = ''
  try {
    if (!jobId.value) throw new Error('请先选择要报名的岗位')
    const d = (await apiJobDetail(jobId.value))?.data
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
  } catch (e) {
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
  if (!experience.account) { resumeState.value = 'guest'; return }
  if (isOnline.value) {
    if (!contactName.value) contactName.value = experience.account.nickname || ''
    if (!contactPhone.value && /^1[3-9]\d{9}$/.test(experience.account.phone || '')) contactPhone.value = experience.account.phone
    resumeState.value = 'ready'
    return
  }
  resumeState.value = 'loading' 
  resume.value = null
  try {
    resume.value = (await apiResume()).data || null
    resumeState.value = 'ready'
  } catch (e) {
    resumeState.value = e && Number(e.code) === 401 ? 'guest' : 'failed'
  }
}
const card = computed(() => resumeCard(resume.value, { online: isOnline.value, accountPhone: experience.account?.phone || '' }))
const avatar = computed(() => absUrl(experience.account?.avatar) || '/static/media/profile-avatar.jpg')
const whoLine = computed(() => [card.value.gender && card.value.gender !== '其他' ? card.value.gender : '', card.value.age ? card.value.age + '岁' : '', card.value.city].filter(Boolean).join(' · '))
// 简历页（「我的 → 简历与机会」）：填完返回本页，onShow 里重新读
const openResume = () => { resumeOpened = true; go(R.resume) }

// ---------------- 到岗时间 / 预计时长 ----------------
const arrival = ref('')
const minArrival = computed(() => arrivalStart(job.value.startDate, today))
const arrivalLabel = computed(() => arrivalText(arrival.value) || '请选择')
// 提示短一点（320 宽之前折成三行）：右边大字已经写了默认的那天，月历里更早的日子是灰的
const arrivalHint = computed(() => (minArrival.value > today ? arrivalText(minArrival.value).split(' ')[0] + '起可以到岗' : '最早今天就能到'))
// 月历开着没有（k-date-picker）；点「确定日期」带回选中的那天
const arrivalOpen = ref(false)
const onArrival = (v) => {
  arrivalOpen.value = false
  if (!v) return
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
  if (!raw) { toast('请填写天数'); return }
  const r = checkDuration(raw, minDays.value)
  if (!r.ok) { toast(r.message); return }
  days.value = r.days
  otherOpen.value = false
}
const note = ref('')
function restoreDraft() {
  const d = job.value
  if (!d?.jobType) return
  const draft = applicationDraftForJob(loadApplicationDraft(), jobId.value)
  arrival.value = defaultArrival(d.startDate, today, draft.arrival)
  const savedDays = Number(draft.days)
  days.value = Number.isInteger(savedDays) && savedDays >= Math.max(1, Number(d.minDays) || 1) && savedDays <= 365 ? savedDays : defaultDuration(d.minDays, d.jobType)
  note.value = typeof draft.note === 'string' ? draft.note : ''
}

// 能不能点「确认投递」：岗位能报、简历齐了、（线下）选了到岗日期
const canSubmit = computed(() => jobReady.value && (resumeState.value === 'guest' || (isOnline.value ? contactReady.value : (resumeState.value === 'ready' && card.value.ready))) && (isOnline.value || !!arrival.value))

// ---------------- 微信订阅提醒（照旧） ----------------
// 后台配了「报名进度」订阅模板（bizKey apply_progress）且开通了微信订阅时，点「确认投递」的那一下先弹微信的授权框；
// 微信只认点击当下的调用，模板 ID 进页面时先取好，点击里同步调用。成功、拒绝、失败都不挡报名。每次打开本页最多问一次
let progressTmpl = ''
let progressTicket = ''
let progressExpires = 0
let tmplLoaded = false
let subscribeAsked = false
const loadProgressTemplate = async () => {
  // #ifdef MP-WEIXIN
  if (tmplLoaded && Date.now() < progressExpires) return
  try {
    const d = (await apiSubscribePrepare()).data || {}
    progressTicket = d.ticket || ''
    progressExpires = Date.now() + Math.max(0, Number(d.expiresIn) || 0) * 1000 - 5000
    const row = (d.rows || []).find(x => x && x.bizKey === 'apply_progress')
    progressTmpl = d.enabled && row && row.templateId && Number(row.quota || 0) < 5 ? String(row.templateId) : ''
    tmplLoaded = true
  } catch (e) {
    progressTmpl = ''
  }
  // #endif
}
const askProgressSubscribe = () => {
  // #ifdef MP-WEIXIN
  if (!progressTmpl || !progressTicket || subscribeAsked) return
  if (Date.now() >= progressExpires) { loadProgressTemplate(); return }
  subscribeAsked = true
  try {
    uni.requestSubscribeMessage({ tmplIds: [progressTmpl], success: (r) => { apiSubscribeAccept({ticket:progressTicket, results:r}).catch(() => {}) }, fail: () => {} })
  } catch (e) { /* 基础库太低等情况：不影响报名 */ }
  // #endif
}

// 幂等键：第一次点「确认投递」时生成，之后重试都用同一个，后端把重复请求收成同一条报名
const makeIdemKey = () => `${jobId.value || 'nojob'}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
async function submit() {
  if (!jobReady.value || submitting.value) return
  if (experience.account && (isOnline.value ? contactReady.value : card.value.ready)) askProgressSubscribe()
  if (await isGuest()) { askLogin(); return }
  loadProgressTemplate()
  if (isOnline.value) {
    if (!contactReady.value) { toast('请填写称呼和有效的联系电话'); return }
  } else {
  if (resumeState.value !== 'ready') { await loadResume() }
  if (resumeState.value !== 'ready') { toast('简历暂时读不到，请重试后再投递'); return }
  if (!card.value.exists) { toast('先填写简历，再投递'); return }
  if (!card.value.ready) {
    if (await confirm('简历还差一点', '简历还差：' + card.value.missing.join('、') + '。补全后回到这里就能投递，现在去补全？')) openResume()
    return
  }
  }
  if (!isOnline.value) {
    if (!arrival.value || arrival.value < minArrival.value) { toast('请选择 ' + arrivalText(minArrival.value) + ' 或之后的到岗时间'); return }
    if (minDays.value > 0 && days.value < minDays.value) { toast('这个岗位最短要待 ' + minDays.value + ' 天'); return }
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
    appId.value = res?.data?.appId ?? null
    bindShareAfterApply(jobId.value, appId.value)
    try { saveApplicationDraft({ arrival: arrival.value, days: String(days.value), note: note.value, jobId: jobId.value, jobTitle: jobTitle.value }) } catch (e) { /* 存不进不影响已提交的报名 */ }
    saved.value = true
    toast(isOnline.value ? '申请已提交' : '已投递', 'success')
    uni.pageScrollTo({ scrollTop: 0, duration: 200, fail: () => {} })
  } catch (e) {
    if (e?.code === 401) { e.loginHandled = true; askLogin(); return }
    const msg = e?.message || '提交失败，请重试'
    if (/已报名该岗位/.test(msg)) openExisting(msg)
    else toast(msg)
  } finally {
    submitting.value = false
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
  try {
    const mine = (await apiMyApplications()).data || []
    const a = mine.find(x => String(x.jobId) === String(jobId.value) && ENDED.indexOf(x.status) < 0)
    if (a) {
      if (await confirm('这个岗位你已报过名', '同一岗位只能有一条进行中的报名，去查看那条报名的进度？')) replace(R.jobProgress + '?appId=' + a.appId)
      return
    }
  } catch (e) { /* 查不到就只提示原因 */ }
  toast(msg)
}
</script>
<style scoped lang="scss">
/* 10-19 和岗位详情（参考图「岗位详情」）同一套视觉：极浅暖米渐变底、白卡 18 圆角 + 暖色细边 + 柔和暖阴影、标题用标题字体、选中是浅橙底橙棕描边、底部暖棕渐变大胶囊 */
.ap-page { --k-bg: #F7EFE6; background: linear-gradient(180deg, #F7EFE6 0%, #FBF7F1 360px, #FBF7F1 100%); }
.ap-page .k-bottom { background: #FFFFFF; box-shadow: 0 -6px 18px rgba(120, 84, 48, .08); }
.ap-page .k-bottom :deep(.k-button) { height: 50px; border-radius: 25px; font-family: var(--k-display-font); font-size: 17px; font-weight: 700; letter-spacing: 2px; }
.ap-page .k-bottom :deep(.k-button.is-primary) { background: linear-gradient(135deg, #8E5E37 0%, #6E4628 100%); box-shadow: 0 6px 14px rgba(110, 70, 40, .28); }
/* 还没简历 / 简历缺项时「确认投递」点不了：之前暖棕渐变盖住了按钮自带的灰底，浅灰字压在棕色上几乎看不见，也看不出是点不了 */
.ap-page .k-bottom :deep(.k-button.is-primary.is-disabled) { background: #ECE5DC; box-shadow: none; color: #A39A92; }
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
</style>
