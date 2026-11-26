<template>
  <k-feature-gate feature="recruitment">
  <view class="k-page opp" :class="$userSurface">
    <k-topbar :title="titles[s - 1]" back custom-back @back="onBack" />

    <!-- 1 AI 技能标签云 -->
    <view v-if="s === 1" class="k-body k-pad-tab">
      <view class="intro">
        <view class="intro__ic"><k-icon name="tags" :size="18" color="red" /></view>
        <text class="intro__text">按关键词把你写的技能归到下面的标签，可查看出处（不替代原文）</text>
      </view>

      <view class="raw k-mt8">
        <view class="k-between">
          <view class="k-row k-gap4"><text class="k-title">你的原始文本</text><text class="k-text k-muted">（不可替代）</text></view>
          <view class="k-row k-gap2" hover-class="k-press" @click="go(R.resume + '?s=3')"><text class="ob k-small">查看全部</text><k-icon name="chevron-right" :size="12" color="muted" /></view>
        </view>
        <view class="raw__box k-mt10">
          <text class="raw__text" :class="{ 'is-empty': !rd.skillLength }">{{ rawText }}</text>
          <text class="k-small k-muted raw__count">{{ rawCount }}</text>
        </view>
      </view>

      <view class="k-between k-mt16">
        <view class="k-col" hover-class="k-press" @click="openJobs"><text class="k-h2">技能标签（{{ tags.length }}）</text><view class="k-row k-gap2 tags-jobs"><text class="k-meta k-mt2">点标签看出处，点这里看匹配机会</text><k-icon name="chevron-right" :size="12" color="red" /></view></view>
        <view class="help" hover-class="k-press" @click="explain"><k-icon name="circle-help" :size="16" color="muted" /></view>
      </view>

      <view class="k-grid-2 tags k-mt12">
        <view v-for="t in tags" :key="t.name" class="tag" :class="`is-${t.tone}`" hover-class="k-press-s" @click="showSources(t)">
          <view class="tag__ic"><k-icon :name="t.icon" :size="20" color="red" /></view>
          <view class="k-flex1">
            <view class="k-between"><text class="tag__name">{{ t.name }}</text><text class="tag__pct">{{ t.pct }}</text></view>
            <view class="k-between tag__sub"><view class="k-row k-gap2"><text class="tag__src">查看来源</text><k-icon name="chevron-right" :size="12" color="muted" /></view></view>
          </view>
        </view>
      </view>
      <view v-if="!tags.length" class="tags-empty"><view class="empty__ic"><k-icon name="tags" :size="32" color="red" /></view><text class="tags-empty__title">还没有技能标签</text></view>
      <text class="k-meta k-mt16 b tags-foot">标签按关键词规则生成，不替代你的原始经历与表达</text>
    </view>

    <!-- 2 技能匹配机会 -->
    <view v-else-if="s === 2" class="k-body k-pad-tab">
      <view class="hero">
        <view class="k-flex1 k-col">
          <text class="k-text hero__text">根据你的技能画像，找到适合你的机会</text>
          <view class="hero__kg hero__ic"><k-icon name="sparkles" :size="18" color="red" /></view>
        </view>
        <image class="hero__stamp" src="/pages/profile/static/opp-stamp.jpg" mode="aspectFit" />
      </view>

      <!-- 10-19 复查：没有技能标签时不列「xx%匹配」的机会（百分比没有依据），换成请他去简历里写技能 -->
      <view v-for="job in (skillBased ? jobs : [])" :key="job.jobId" class="card job k-mt12">
        <view class="job__top">
          <image class="job__img" :src="job.img" mode="aspectFill" />
          <view class="k-flex1 k-col">
            <view class="k-between">
              <view class="k-row job__name"><text class="job__title">{{ displayWording(job.title, [job.storeName]) }}</text></view>
              <view class="match"><text>{{ job.match }}匹配</text></view>
            </view>
            <view v-if="job.place || job.type" class="k-row k-gap4 k-mt8 job__meta"><k-icon v-if="job.place" name="map-pin" :size="14" color="muted" /><text v-if="job.place" class="k-small k-muted job__place">{{ job.place }}</text><text v-if="job.type" class="job__type">（{{ job.type }}）</text></view>
            <view class="k-row k-gap8 k-mt10 k-wrap"><view v-for="c in job.chips" :key="c.t" class="chip" :class="`is-${c.tone}`"><text>{{ c.t }}</text></view></view>
            <text v-if="job.reason" class="k-small k-mt10 b job__why"><text class="job__why-k">匹配原因：</text>{{ job.reason }}</text>
            <view v-else class="k-row k-gap4 k-mt8"><text class="k-price">{{ job.price }}</text><text class="k-small k-muted">{{ job.unit }}</text></view>
          </view>
        </view>
        <!-- k-button 是虚拟节点组件：等分宽度放在外层 view 上 -->
        <view class="k-row k-gap10 k-mt12">
          <view class="k-flex1"><k-button block type="outline" size="md" class="btn-serif" label="查看详情" @click="openDetail(job)" /></view>
          <view class="k-flex1"><k-button block size="md" class="btn-serif" label="一键报名" @click="toApply(job)" /></view>
        </view>
      </view>
      <view v-if="jobsLoaded && !skillBased" class="empty"><text>还没有技能标签</text><text class="k-small k-muted">在简历里写一段技能描述（比如咖啡拉花、摄影修图、前台接待），就能按技能为你匹配机会</text><k-button type="secondary" size="sm" label="去写技能描述" @click="go(R.resume + '?s=3')" /><view class="empty__ic"><k-icon name="sparkles" :size="32" color="red" /></view></view>
      <view v-else-if="jobsLoaded && !jobs.length" class="empty"><text>暂时没有和你技能匹配的机会</text><text class="k-small k-muted">在简历里多写几项技能，或去岗位列表看看全部机会</text><k-button type="secondary" size="sm" label="去看全部岗位" @click="go(R.jobsList)" /><view class="empty__ic"><k-icon name="search" :size="32" color="red" /></view></view>
    </view>

    <!-- 3 一键报名 -->
    <view v-else-if="s === 3" class="k-body k-pad-tab">
      <view class="card apply-job" :class="{ 'is-empty': !picked }">
        <view class="apply-job__ph"><k-icon name="image" :size="24" color="muted" /><image class="apply-job__img" :src="picked ? picked.img : '/static/media/cover-empty.png'" mode="aspectFill" /></view>
        <view class="k-flex1 k-col">
          <text class="apply-job__title">{{ displayWording(picked ? picked.title : '') }}</text>
          <view class="k-row k-mt6 job__meta"><text class="k-small k-muted job__place">{{ picked ? picked.place : '' }}</text><text v-if="picked && picked.type" class="job__type">（{{ picked.type }}）</text></view>
          <view class="k-row k-gap4 k-mt8"><text class="k-price apply-job__price">{{ picked ? picked.price : '' }}</text><text class="k-text k-muted">{{ picked ? picked.unit : '' }}</text></view>
        </view>
        <view class="match">{{ picked ? picked.match : '' }}匹配</view>
      </view>

      <view class="card k-mt12">
        <view class="k-between step-head"><view class="step"><view class="step__num"><text>1</text></view><text class="step__title">复用我的简历</text></view><view class="k-row k-gap2 step__link" hover-class="k-press" @click="go(R.resume)"><text class="ob k-small">预览简历</text><k-icon name="chevron-right" :size="12" color="muted" /></view></view>
        <view class="resume-box k-mt10">
          <view class="k-row k-gap12">
            <view class="resume-box__ph"><k-icon name="user" :size="24" color="muted" /><image class="resume-box__avatar" :src="avatar" mode="aspectFill" /></view>
            <view class="k-flex1 k-col"><text class="k-subtitle">{{ resumeName }}</text><text class="k-small k-muted k-mt4 resume-box__date">{{ resumeUpdated }}</text></view>
          </view>
          <view class="resume-box__foot"><view class="ok"><k-icon name="check" :size="14" color="green" /></view><text class="k-text">称呼、年龄、电话和技能会填进报名表</text></view>
        </view>

        <view class="step k-mt16"><view class="step__num"><text>2</text></view><text class="step__title">到岗日期</text></view>
        <view class="k-input date k-mt10" :class="{ 'k-input--error': dateError }" hover-class="k-press" @click="pickDate">
          <text class="k-flex1" :class="date ? '' : 'k-light'">{{ date || '请选择你可到岗的日期' }}</text>
          <k-icon name="calendar" :size="18" color="muted" />
        </view>
        <text v-if="dateError" class="k-small k-alert k-mt6 b">请选择到岗日期</text>

        <!-- 之前不问停留几天，提交时替用户填成 max(7, 岗位最短天数)，门店看到的「可停留 14 天」并不是本人说的 -->
        <view class="step k-mt16"><view class="step__num"><text>3</text></view><text class="step__title">可停留天数</text></view>
        <view class="k-mt10"><k-field v-model="days" type="number" :maxlength="3" :placeholder="daysHint" :error="daysError" /></view>

        <view class="k-between k-mt16">
          <view class="step step--note"><view class="step__num"><text>4</text></view><text class="step__title">相关经历</text><text class="k-text k-muted step__note">（来自简历，门店审核时能看到）</text></view>
          <view class="k-row k-gap2 step__link" hover-class="k-press" @click="go(R.resume + '?s=4')"><text class="k-small k-muted">编辑</text><k-icon name="chevron-right" :size="12" color="muted" /></view>
        </view>
        <view class="k-row k-gap10 k-mt12 k-wrap exp-list">
          <view v-for="(e, ei) in exps" :key="e" class="exp"><k-icon name="house" :size="14" color="red" /><text>{{ expParts[ei].t }}</text><text v-if="expParts[ei].n" class="exp__n">{{ expParts[ei].n }}</text></view>
        </view>
      </view>

      <view v-if="dateError || daysError" class="alert k-mt12">
        <view class="k-row k-gap6"><k-icon name="triangle-alert" :size="16" color="alert" /><text class="alert__title">请完善以下信息后报名</text></view>
        <view v-if="dateError" class="k-between k-mt10"><view class="k-row k-gap8"><view class="alert__bullet" /><text class="k-text">请选择到岗日期</text></view><view class="k-dot" /></view>
        <view v-if="daysError" class="k-between k-mt10"><view class="k-row k-gap8"><view class="alert__bullet" /><text class="k-text">{{ daysError }}</text></view><view class="k-dot" /></view>
      </view>

      <k-button block class="k-mt12 btn-serif" :disabled="submitting || !legalRead || !agreed" :label="submitting ? '提交中…' : '一键报名'" @click="submit" />
      <view class="agree k-mt12" hover-class="k-press" @click="toggleAgreement">
        <view class="k-check" :class="{ checked: agreed }"><k-icon v-if="agreed" name="check" :size="12" color="white" /></view>
        <text class="k-small k-muted">已阅读并同意</text><text class="k-small agree__link" @click.stop="showTerms('用户协议')">《用户协议》</text><text class="k-small agree__link" @click.stop="showTerms('隐私政策')">《隐私政策》</text>
      </view>
    </view>

    <!-- 4 认证与赚钱机会 -->
    <view v-else class="k-body k-pad-tab cert-page">
      <view class="card card--tight cert-main">
        <view class="cert-head">
          <view class="k-row"><text class="k-title">{{ certTitle }}</text><text class="k-text k-muted">{{ cert ? '（' + (cert.level || '已认证') + '）' : '' }}</text></view>
          <view class="k-row k-gap2" hover-class="k-press" @click="showCert"><text class="ob k-small">查看详情</text><k-icon name="chevron-right" :size="12" color="muted" /></view>
        </view>
        <view class="flow">
          <view v-for="(f, i) in flow" :key="f.label" class="flow__wrap">
            <view v-if="i > 0" class="flow__arrow"><view class="flow__line" /></view>
            <view class="flow__item">
              <view class="flow__dot" :class="{ done: f.done, cur: !f.done && (i === 0 || flow[i - 1].done) }"><k-icon :name="f.icon" :size="16" :color="f.done ? 'red' : (i === 0 || flow[i - 1].done) ? 'white' : 'muted'" /></view>
              <text class="flow__label">{{ f.label }}</text>
            </view>
          </view>
        </view>
        <view class="grade">
          <view class="grade__col">
            <text class="k-text">考核等级</text>
            <view class="k-row k-gap8 k-mt6"><text class="grade__num" :class="{ 'is-none': !cert || !cert.level }">{{ cert ? cert.level || '—' : '—' }}</text><text class="k-text">级</text><view class="grade__chip"><text>{{ cert ? cert.grade || '通过' : '未认证' }}</text></view></view>
            <text class="k-meta k-mt8">{{ cert ? '颁发于 ' + cert.issuedDate : '参加门店培训考核后获得' }}</text>
          </view>
          <view class="grade__col grade__col--r">
            <view class="k-row k-gap8"><text class="k-text">综合评分</text><text class="grade__score">{{ cert && cert.score != null ? cert.score + '分' : '—' }}</text></view>
            <view class="k-row k-gap6 k-mt8"><k-icon v-for="n in 5" :key="n" name="star" :size="16" color="ochre" :fill="n <= certStars" /></view>
            <text class="k-small k-muted k-mt8 grade__no">{{ cert ? '证书编号 ' + cert.certNo : '暂无考核记录' }}</text>
          </view>
        </view>
      </view>

      <view class="card k-mt12 cert-card">
        <view class="k-between cert-card__head">
          <text class="k-title">已通过证书</text>
          <view class="k-row k-gap2" hover-class="k-press" @click="showCert"><text class="ob k-small">查看证书</text><k-icon name="chevron-right" :size="12" color="muted" /></view>
        </view>
        <view v-if="cert" class="cert k-mt10">
          <view class="cert__ic"><k-icon name="award" :size="24" color="red" /></view>
          <view class="k-flex1 k-col k-gap4">
            <view class="cert__name"><text class="k-subtitle">{{ cert ? cert.name : '' }}</text><view class="cert__ok"><k-icon name="badge-check" :size="12" color="green" /><text>已认证</text></view></view>
            <text class="k-small k-muted">颁发机构：{{ cert ? cert.issuer : '' }}</text>
            <text class="k-small k-muted cert__no">证书编号：{{ cert ? cert.certNo : '' }}</text>
          </view>
        </view>
        <view v-else class="cert-empty"><view class="empty__ic"><k-icon name="award" :size="20" color="red" /></view><view class="rec-empty__copy"><text class="cert-empty__title">还没有证书</text><text class="cert-empty__desc">通过门店培训和实践考核后，证书会显示在这里</text></view></view>
      </view>

      <text class="k-title rec-head">为你推荐的赚钱机会</text>
      <view v-if="recs.length" class="card card--tight rec-card">
        <view v-for="(r, i) in recs" :key="r.jobId" class="rec" :class="{ 'has-line': i < recs.length - 1 }" hover-class="k-press" @click="openDetail(r)">
          <image class="rec__img" :src="r.img" mode="aspectFill" />
          <view class="k-flex1 k-col">
            <view class="k-between">
              <view class="k-row job__name"><text class="rec__title">{{ displayWording(r.title, [r.storeName]) }}</text></view>
              <view v-if="r.tag" class="rec__tag" :style="{ background: r.tagColor }"><text>{{ r.tag }}</text></view>
            </view>
            <view class="k-between k-mt4">
              <view class="k-row k-gap3 rec__place"><k-icon name="map-pin" :size="12" color="muted" /><text class="k-meta">{{ r.place }}</text><text v-if="r.type" class="k-small k-muted rec__type">（{{ r.type }}）</text></view>
              <view class="k-row k-gap3 rec__price-wrap"><text class="rec__price">{{ r.price }}</text><text class="k-meta">{{ r.unit }}</text></view>
            </view>
            <text v-if="r.reason" class="k-meta k-mt4">推荐理由：{{ r.reason }}</text>
          </view>
        </view>
      </view>

      <view v-else class="rec-empty"><view class="empty__ic"><k-icon name="briefcase" :size="20" color="red" /></view><view class="rec-empty__copy"><text class="cert-empty__title">暂时没有推荐</text><text class="cert-empty__desc">在简历里多写几项技能，或去岗位列表看看全部机会</text></view></view>

      <view class="learn k-mt12" hover-class="k-press" @click="learn">
        <view class="learn__ic"><k-icon name="graduation-cap" :size="22" color="red" /></view>
        <text class="k-small k-muted k-flex1">持续学习与实践，提升等级，可解锁更多高收益机会</text>
        <view class="k-row k-gap2 learn__btn"><text class="ob k-small">去学习</text><k-icon name="chevron-right" :size="12" color="red" /></view>
      </view>
    </view>

    <k-tabbar active="none" />
    <!-- 到岗日期之前是 60 天的分页菜单（「下一页…」翻好几页），改成日历点选 -->
    <k-date-picker v-if="dateOpen" title="选择到岗日期" :value="date" :min-date="shiftDate(todayCn(), 1)" :max-date="shiftDate(todayCn(), 60)" @cancel="dateOpen = false" @confirm="confirmDate" />
  </view>
  </k-feature-gate>
</template>

<script setup>
import { displayWording } from '@/common/display-wording.js'
// ---------------------------------------------------------------------------
// 技能画像与机会接入情况：
//   s=1 技能标签：把简历技能描述按关键词词典归到标签（不是 AI），每个标签能看到原文出处
//   s=2 技能匹配机会：apiOpportunities（按技能重合 + 城市 / 时间 / 食宿打分）
//   s=3 一键报名：复用简历（称呼 / 年龄 / 电话 / 技能）+ 选到岗日期、填可停留天数，真实提交报名（与报名页同一接口）；
//       简历里的经历不进报名表，门店审核时在报名详情里按报名人读简历（/app/staff/applications/{appId}/extras）
//   s=4 认证：平台考核后在后台登记的证书；没有证书就如实显示；推荐机会同 s=2
// ---------------------------------------------------------------------------
import { ref, computed, watch } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { useScreen, go, back, toast } from '@/common/screen.js'
import { apiResume, apiOpportunities, apiSubmitApplication, apiLegal } from '@/common/api.js'
import { loadLegalVersions } from '@/common/legal-state.js'
import { experience, ensureSession } from '@/common/experience.js'
import { alert, confirm, shiftDate, todayCn, errText } from '@/common/ui.js'
import { absUrl } from '@/common/upload.js'
import R from '@/common/routes.js'

let landing = 1
let ready = false
const s = useScreen(4, {
  onLoad: async () => {
    landing = s.value
    await ensureSession()
    await loadResume()
    ready = true
    if (s.value >= 2) loadJobs()
  }
})
const titles = ['技能标签云', '技能匹配机会', '一键报名', '认证与赚钱机会']
// 之前：从简历「查看认证」打开认证屏（?s=4），返回落到本页的技能标签屏，要再按一次才回到简历。
// 现在：直接打开的那一屏返回原页面；页内点进去的屏仍逐级回退（一键报名 → 匹配机会 → 进页那一屏）
const onBack = () => { if (s.value === 3 && landing !== 3) s.value = 2; else if (s.value !== landing) s.value = landing; else back() }
// 之前：只在进页时读一次简历。一键报名提示「简历还不完整」去补充、或去改技能 / 经历后回来，
// 这里仍拿旧简历判断，补完了还是一直提示不完整，报不了名。现在回到本页时重新读简历（不动已选岗位和到岗日期）
let shown = false
onShow(() => { if (shown && ready) loadResume(); shown = true })
const toneColor = { green: '#4A6E3A', ochre: '#9A6A22', indigo: '#40576B', gray: '#6F6A65' }
const rd = ref({ resume: {}, tags: [], exps: [], certs: [] })
async function loadResume() {
  try {
    rd.value = (await apiResume()).data || rd.value
  } catch (e) {
    toast(errText(e, '简历加载失败'))
  }
}
const rawText = computed(() => {
  const t = [rd.value.resume.skillText, rd.value.resume.extraText].filter(Boolean).join('\n')
  return t ? (t.length > 60 ? t.slice(0, 60) + '……' : t) : '还没写技能描述，点「查看全部」去简历里补充。'
})
const rawCount = computed(() => `共 ${rd.value.skillLength || 0} 字`)
const tags = computed(() => rd.value.tags || [])
const showSources = (t) => alert(`「${t.name}」的出处`, (t.sources || []).join('\n') || '—')
const explain = () => alert('技能标签怎么来的', '按关键词把你写的技能描述归到固定标签上（例如写了"拉花""手冲"会归到咖啡相关标签），用于匹配岗位；原文保留，标签不替代你的表达。')

// ---------------- s=2 ----------------
const opp = ref({ jobs: [] })
const jobsLoaded = ref(false)
async function loadJobs() {
  try {
    opp.value = (await apiOpportunities()).data || opp.value
    jobsLoaded.value = true
  } catch (e) {
    toast(errText(e, '机会加载失败'))
  }
}
const openJobs = () => { s.value = 2; loadJobs() }
// 匹配按简历技能标签算（服务端 opportunities 回的 skills）：一个标签都没有时，分数里技能那一项是默认值，百分比没有依据
const skillBased = computed(() => (opp.value.skills || []).length > 0)
const TONES = ['ochre', 'indigo', 'green', 'gray']
const IMGS = '/static/media/cover-empty.png'
const jobs = computed(() => (opp.value.jobs || []).map((j, i) => ({
  ...j, img: j.cover ? absUrl(j.cover) : IMGS, type: j.typeLabel, match: (j.score || 0) + '%', place: [j.storeName, j.city].filter(Boolean).join(' · '),
  chips: (j.tags || []).slice(0, 3).map((t, k) => ({ t, tone: TONES[k % 4] }))
})))
const openDetail = (j) => go(R.jobDetail + '?jobId=' + j.jobId)
const picked = ref(null)
const toApply = (j) => { picked.value = j; date.value = ''; dateError.value = false; days.value = ''; daysError.value = ''; s.value = 3 }

// ---------------- s=3 ----------------
const date = ref('')
const dateError = ref(false)
// 可停留天数由本人填（与报名页同一校验：1–365 天），岗位有最短天数时写在提示里
const days = ref('')
const daysError = ref('')
watch(days, () => { daysError.value = '' })
const daysHint = computed(() => (picked.value && Number(picked.value.minDays) > 0 ? `这个岗位最少待 ${picked.value.minDays} 天，请填本次可停留天数` : '请填本次可停留天数'))
const agreed = ref(false)
const readVersions = ref({})
const legalRead = computed(() => !!readVersions.value.terms && !!readVersions.value.privacy)
function toggleAgreement() {
  if (!legalRead.value) return toast('请分别打开用户协议和隐私政策，点「已读完，返回」')
  agreed.value = !agreed.value
}
const avatar = computed(() => (experience.account && experience.account.avatar ? absUrl(experience.account.avatar) : '/pages/profile/static/opp-avatar.jpg'))
const resumeName = computed(() => rd.value.resume.name || '未填写称呼')
const resumeUpdated = computed(() => `最近更新：${rd.value.updated || '—'}`)
const exps = computed(() => (rd.value.exps || []).slice(0, 3).map(e => [e.title, e.total].filter(Boolean).join(' ')))
// 纯展示：经历行把名称和「共 N 天」分成两段（天数靠右不拆行），内容和 exps 一样
const expParts = computed(() => (rd.value.exps || []).slice(0, 3).map(e => ({ t: e.title || '', n: e.total || '' })))
// 岗位类型缺失时不显示空括号「（）」
const pickedTitle = computed(() => (picked.value ? picked.value.title + (picked.value.type ? '（' + picked.value.type + '）' : '') : ''))
const dateOpen = ref(false)
const pickDate = () => { dateOpen.value = true }
function confirmDate(v) {
  dateOpen.value = false
  if (v) { date.value = v; dateError.value = false }
}
let idemKey = ''
// 提交成功后 0.6 秒才跳到进度页：这段时间和请求途中都锁着按钮，连点不会再报一次名；失败才放开
const submitting = ref(false)
async function submit() {
  const j = picked.value
  if (!j || submitting.value) return
  if (!date.value) { dateError.value = true; return toast('请选择到岗日期') }
  if (!/^\d+$/.test(days.value) || Number(days.value) < 1 || Number(days.value) > 365) { daysError.value = '请填写 1 至 365 天的可停留天数'; return toast(daysError.value) }
  if (!legalRead.value || !agreed.value) return toast('请先阅读并同意协议')
  const r = rd.value.resume || {}
  if (!r.name || !r.age || !r.phone) {
    if (await confirm('简历还不完整', '一键报名需要简历里的称呼、年龄和联系电话，现在去补充？')) go(R.resume + '?s=2')
    return
  }
  if (!idemKey) idemKey = `${j.jobId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  submitting.value = true
  try {
    const versions = await loadLegalVersions(apiLegal)
    if (['terms', 'privacy'].some(key => readVersions.value[key] !== versions[key + 'Version'])) {
      readVersions.value = {}; agreed.value = false
      throw new Error('协议已更新，请重新阅读并同意')
    }
    const res = await apiSubmitApplication({
      jobId: j.jobId, name: r.name, age: Number(r.age), phone: r.phone, skills: String(r.skillText || '').slice(0, 200),
      arrival: date.value, days: Number(days.value), note: '通过「技能匹配机会」一键报名', idemKey
    })
    idemKey = ''
    toast('报名已提交')
    const appId = res && res.data && res.data.appId
    setTimeout(() => { submitting.value = false; go(appId ? R.jobProgress + '?appId=' + appId : R.jobProgress) }, 600)
  } catch (e) {
    submitting.value = false
    toast(errText(e, '报名失败'))
  }
}
// 之前点《用户协议》《隐私政策》只弹一段摘要，还让去「我的 → 设置 → 协议与隐私」找全文，可那里没有这个入口；
// 现在和登录页一样打开后台发布的协议全文页
function showTerms(name) {
  const key = name === '用户协议' ? 'terms' : 'privacy'
  uni.navigateTo({ url: R.legal + '?key=' + key, events: { read: value => {
    if (value?.key === key && value.version) { readVersions.value = { ...readVersions.value, [key]: value.version }; agreed.value = false }
  } } })
}

// ---------------- s=4 认证 ----------------
const cert = computed(() => (rd.value.certs || [])[0] || null)
const certTitle = computed(() => (cert.value ? `成长认证：${cert.value.category || cert.value.name}` : '成长认证：暂无'))
const flow = computed(() => [
  { label: '参加培训', icon: 'graduation-cap', done: !!cert.value },
  { label: '实践考核', icon: 'clipboard-check', done: !!cert.value },
  { label: '平台登记', icon: 'badge-check', done: !!cert.value },
  { label: '获得证书', icon: 'award', done: !!cert.value }
])
const certStars = computed(() => (cert.value && cert.value.score ? Math.round(cert.value.score / 20) : 0))
const showCert = () => alert(cert.value ? cert.value.name : '暂无证书', cert.value ? `编号：${cert.value.certNo}\n颁发机构：${cert.value.issuer}\n颁发日期：${cert.value.issuedDate}` : '门店或平台组织的培训考核通过后，会由平台登记证书并展示在这里。')
// 推荐的赚钱机会照常列；没有技能标签时不挂「xx%匹配」（那个百分比没有技能依据）
const recs = computed(() => jobs.value.slice(0, 3).map(j => ({ ...j, tag: skillBased.value ? j.match + '匹配' : '', tagColor: '#4A6E3A' })))
const learn = () => go(R.activity)
</script>

<style scoped lang="scss">
.b { display: block; }
.k-mt2 { margin-top: 2px; }
.k-mt6 { margin-top: 6px; }
.k-mt10 { margin-top: 10px; }
.k-gap3 { gap: 3px; }
.ob { color: #9A6A22; }
.card { background: var(--k-paper); border: 1px solid var(--k-line); border-radius: 14px; padding: 14px; }
.card--tight { padding: 0; }
.btn-serif { font-family: var(--k-serif); font-weight: 700; }
.ok { width: 16px; height: 16px; }

/* s1 */
.intro { display: flex; align-items: center; gap: 12px; padding: 6px 0 8px; }
.intro__img { width: 88px; height: 92px; flex: 0 0 auto; }
.intro__text { flex: 1; font-size: 15px; line-height: 1.8; color: var(--k-ink); }
.raw { background: var(--k-paper2); border: 1px solid var(--k-line); border-radius: 14px; padding: 14px 12px 12px; }
.raw__box { background: var(--k-paper); border: 1px solid var(--k-line); border-radius: 10px; padding: 10px 12px 8px; display: flex; flex-direction: column; }
.raw__text { font-size: 14px; line-height: 1.8; color: var(--k-ink); }
.raw__count { align-self: flex-end; margin-top: 4px; }
.tags { gap: 12px 14px; }
.tag { display: flex; align-items: center; gap: 10px; padding: 10px 12px; border-radius: 12px; min-height: 62px; }
.tag.is-green { background: var(--k-green-soft); }
.tag.is-ochre { background: var(--k-ochre-soft); }
.tag.is-indigo { background: var(--k-indigo-soft); }
.tag.is-gray { background: #ECE8E1; }
.tag__name { font-family: var(--k-serif); font-weight: 700; font-size: 17px; }
.tag__pct { font-size: 13px; }
.tag__src { font-size: 12px; }
.is-green .tag__name, .is-green .tag__pct, .is-green .tag__src { color: #3F6B56; }
.is-ochre .tag__name, .is-ochre .tag__pct, .is-ochre .tag__src { color: #9A6A22; }
.is-indigo .tag__name, .is-indigo .tag__pct, .is-indigo .tag__src { color: var(--k-indigo); }
.is-gray .tag__name, .is-gray .tag__pct, .is-gray .tag__src { color: var(--k-muted); }

/* s2 */
.hero { display: flex; align-items: center; gap: 8px; padding: 12px 10px 4px 14px; background: var(--k-paper2); border: 1px solid var(--k-line); border-radius: 14px; min-height: 82px; }
.hero__text { font-size: 15px; }
.hero__kg { width: 50px; height: 44px; margin-top: 2px; margin-left: 12px; }
.hero__stamp { width: 98px; height: 70px; flex: 0 0 auto; }
.job { padding: 12px; }
.job__top { display: flex; align-items: flex-start; gap: 12px; }
.job__img { width: 112px; height: 122px; border-radius: 10px; flex: 0 0 auto; }
.job__title { font-family: var(--k-serif); font-weight: 700; font-size: 17px; line-height: 1.3; }
/* 岗位名太长时省略，右边的「xx%匹配」不被挤走 */
.job__name { flex: 1; min-width: 0; margin-right: 6px; }
.job__name>text:first-child { min-width: 0; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
.job__name>text:nth-child(2) { flex: 0 0 auto; }
.empty { display: flex; flex-direction: column; align-items: center; gap: 8px; padding: 36px 16px; text-align: center; font-size: 14px; }
.job__type { font-size: 15px; color: var(--k-ink); }
.match { height: 26px; padding: 0 8px; border-radius: 6px; background: var(--k-green); color: var(--k-paper); font-size: 13px; font-weight: 600; display: flex; align-items: center; flex: 0 0 auto; }
.chip { height: 24px; padding: 0 8px; border-radius: 5px; font-size: 12px; display: flex; align-items: center; }
.chip.is-ochre { background: var(--k-ochre-soft); color: #9A6A22; }
.chip.is-indigo { background: var(--k-indigo-soft); color: var(--k-indigo); }
.chip.is-green { background: var(--k-green-soft); color: var(--k-green); }
.chip.is-gray { background: #ECE8E1; color: var(--k-ink2); }

/* s3 */
.apply-job { display: flex; align-items: flex-start; gap: 12px; padding: 12px; }
.apply-job__img { width: 96px; height: 96px; border-radius: 10px; flex: 0 0 auto; }
.apply-job__title { font-family: var(--k-serif); font-weight: 700; font-size: 16px; line-height: 1.4; }
.apply-job__price { font-size: 24px; }
.step { display: flex; align-items: center; gap: 8px; }
.step__num { width: 22px; height: 22px; border-radius: 50%; background: #B0864A; color: var(--k-paper); font-size: 12px; font-weight: 700; display: flex; align-items: center; justify-content: center; }
.step__title { font-family: var(--k-serif); font-weight: 700; font-size: 17px; }
.resume-box { border: 1px solid var(--k-line); border-radius: 10px; padding: 10px 12px; }
.resume-box__avatar { width: 56px; height: 56px; border-radius: 50%; flex: 0 0 auto; }
.resume-box__foot { display: flex; align-items: center; gap: 8px; margin-top: 10px; padding-top: 10px; border-top: 1px solid var(--k-line); }
.date { min-height: 42px; }
.exp { height: 36px; padding: 0 12px; border: 1px solid var(--k-line2); border-radius: 8px; background: var(--k-paper); display: flex; align-items: center; font-size: 14px; }
.alert { background: #FBF3F0; border: 1px solid #E3BFB5; border-radius: 10px; padding: 12px 12px; }
.alert__title { color: var(--k-alert); font-size: 14px; font-weight: 600; }
.alert__bullet { width: 6px; height: 6px; border-radius: 50%; background: #B98A4A; }
.agree { display: flex; align-items: center; gap: 6px; }
.agree__link { color: var(--k-indigo); }

/* s4 */
.cert-head { display: flex; align-items: center; justify-content: space-between; padding: 12px 14px; background: #F7F2EA; border-radius: 14px 14px 0 0; border-bottom: 1px solid var(--k-line); }
.flow { display: flex; align-items: flex-start; padding: 14px 16px 12px; border-bottom: 1px solid var(--k-line); }
.flow__wrap { display: flex; align-items: flex-start; flex: 1; min-width: 0; }
.flow__wrap:first-child { flex: 0 0 auto; }
.flow__item { display: flex; flex-direction: column; align-items: center; gap: 6px; width: 56px; flex: 0 0 auto; }
.flow__arrow { flex: 1; display: flex; align-items: center; height: 44px; padding: 0 2px; }
.flow__line { flex: 1; height: 1.5px; background: #C9A878; }
.flow__dot { width: 44px; height: 44px; border-radius: 50%; background: #B0864A; display: flex; align-items: center; justify-content: center; }
.flow__dot.done { background: var(--k-red); }
.flow__label { font-size: 13px; color: var(--k-ink); white-space: nowrap; }
.grade { display: flex; padding: 12px 14px 14px; }
.grade__col { flex: 1; display: flex; flex-direction: column; }
.grade__col--r { border-left: 1px solid var(--k-line); padding-left: 18px; }
.grade__num { font-family: var(--k-sans); font-weight: 700; font-size: 32px; line-height: 1; }
.grade__chip { height: 26px; padding: 0 10px; border: 1px solid var(--k-line2); border-radius: 6px; background: var(--k-paper2); font-size: 13px; display: flex; align-items: center; margin-left: 4px; }
.grade__score { font-size: 16px; font-weight: 700; }
.cert { display: flex; align-items: center; gap: 12px; padding: 10px 12px; background: var(--k-paper2); border: 1px solid var(--k-line); border-radius: 10px; }
.cert__img { width: 46px; height: 62px; flex: 0 0 auto; }
.cert__stamp { width: 60px; height: 60px; flex: 0 0 auto; }
.rec-head { display: block; padding: 12px 14px 8px; }
.rec { display: flex; align-items: center; gap: 10px; padding: 10px 12px 10px 12px; }
.rec.has-line { border-bottom: 1px solid var(--k-line); }
.rec__img { width: 58px; height: 64px; border-radius: 8px; flex: 0 0 auto; }
.rec__title { font-family: var(--k-serif); font-weight: 700; font-size: 15px; }
.rec__tag { height: 22px; padding: 0 8px; border-radius: 5px; color: var(--k-paper); font-size: 12px; display: flex; align-items: center; flex: 0 0 auto; }
.rec__price { color: var(--k-red); font-family: var(--k-sans); font-weight: 700; font-size: 16px; }
.learn { display: flex; align-items: center; gap: 10px; padding: 8px 12px; background: var(--k-paper2); border: 1px solid var(--k-line); border-radius: 12px; }
.learn__img { width: 34px; height: 34px; flex: 0 0 auto; }

/* ---------------------------------------------------------------------------------------------------------------
   2026-11-17 改版「小而精」（主人按样张第三版拍板）：技能标签、匹配机会、一键报名、认证四屏 —— 浅灰底、白卡 12 圆角、不描边不加阴影，
   图、字、标签收小一档。功能和文字不变；到岗日期等输入框保持 44 高。
   几张小插画是带米色底的 JPG：直接放在页面上的用 darken 混合让底色融进页面，放在色块里的把色块调成和图片一样的米色。
   --------------------------------------------------------------------------------------------------------------- */
.opp { --k-bg: var(--k-page); --k-radius: 12px; background: var(--k-page); }
.opp :deep(.k-navbar__title) { font-family: var(--k-sans); font-size: 16px; font-weight: 600; }
.opp .k-body { padding-left: 12px; padding-right: 12px; }
.opp :deep(.k-button.is-lg) { height: 44px; font-size: 15px; box-shadow: none; }
.opp :deep(.k-button) { border-radius: 999px; }
/* 不能点的按钮（没勾协议时的「一键报名」）：11-18 第二轮起交给公共组件 —— 原配色整体 .45，不再盖成冷灰块 */
.opp .k-title { font-family: var(--k-sans); font-size: 15px; }
.opp .k-h2 { font-family: var(--k-sans); font-size: 16px; }
.opp .k-subtitle { font-family: var(--k-sans); font-size: 14px; font-weight: 600; }
.opp .k-text { font-size: 13px; }
.opp .k-price { font-size: 17px; color: var(--k-red-deep); }
.opp .card.k-mt12 { margin-top: 8px; }
.card { border: 0; border-radius: 12px; padding: 12px; }
.card--tight { padding: 0; }
.btn-serif { font-family: var(--k-sans); font-weight: 600; }
.ob { color: var(--k-ochre-deep); }
/* 1 技能标签 */
.intro { gap: 10px; padding: 0 0 8px; }
.intro__img { width: 64px; height: 67px; mix-blend-mode: darken; }
.intro__text { font-size: 13px; line-height: 1.65; color: var(--k-ink2); }
.raw { padding: 12px; border: 0; border-radius: 12px; background: var(--k-paper); }
.raw__box { padding: 10px 12px 8px; border: 0; border-radius: 8px; background: #F9F7F3; }
.raw__text { font-size: 13px; line-height: 1.7; color: var(--k-ink2); }
.raw__count { font-size: 11px; }
.tags { gap: 8px; }
.tag { gap: 8px; min-height: 56px; padding: 8px 12px; }
.tag.is-gray { background: #F0EDE8; }
.tag__name { font-family: var(--k-sans); font-size: 14px; font-weight: 600; }
.tag__pct { font-size: 12px; }
.tag__src { font-size: 11px; }
.is-green .tag__name, .is-green .tag__pct, .is-green .tag__src { color: var(--k-green); }
.is-ochre .tag__name, .is-ochre .tag__pct, .is-ochre .tag__src { color: var(--k-ochre-deep); }
/* 2 匹配机会 */
.hero { min-height: 72px; padding: 10px 10px 4px 12px; border: 0; border-radius: 12px; background: #F9F3E8; }
.hero__text { font-size: 13px; color: var(--k-ink2); }
.hero__kg, .hero__stamp { mix-blend-mode: darken; }
.job { padding: 12px; }
.job__top { gap: 10px; }
.job__top .k-mt8, .job__top .k-mt10 { margin-top: 6px; }
.job__top .k-small { font-size: 12px; }
.job__img { width: 88px; height: 96px; border-radius: 8px; }
.job__title { font-family: var(--k-sans); font-size: 14px; font-weight: 600; line-height: 20px; }
.job__type { font-size: 12px; color: var(--k-muted); }
.match { height: 18px; padding: 0 6px; border-radius: 4px; background: var(--k-green-soft); color: var(--k-green); font-size: 11px; font-weight: 500; }
.chip { height: 18px; padding: 0 6px; border-radius: 4px; font-size: 11px; }
.chip.is-ochre { background: var(--k-ochre-soft); color: var(--k-ochre-deep); }
.chip.is-gray { background: var(--k-fill); }
.job :deep(.k-button) { height: 36px; border-radius: 999px; font-size: 13px; }
.job :deep(.k-button.is-outline) { border-color: var(--k-red-line); color: var(--k-red-deep); }
/* 3 一键报名 */
.apply-job { gap: 10px; padding: 12px; }
.apply-job__img { width: 72px; height: 72px; border-radius: 8px; }
.apply-job__title { font-family: var(--k-sans); font-size: 14px; font-weight: 600; line-height: 20px; }
.apply-job__price { font-size: 17px; }
.apply-job .k-small, .apply-job .k-text { font-size: 12px; }
.apply-job .k-mt6, .apply-job .k-mt8 { margin-top: 4px; }
.step { gap: 6px; }
.step__num { width: 18px; height: 18px; background: var(--k-red); font-size: 11px; font-weight: 600; }
.step__title { font-family: var(--k-sans); font-size: 14px; font-weight: 600; }
.step .k-text { font-size: 12px; }
/* 320 宽：「相关经历」和右边的「编辑」不折成一字一行，括号里的说明自己换行 */
.step { min-width: 0; }
.step__title { flex: 0 0 auto; white-space: nowrap; }
.k-between > .step + .k-row { flex: 0 0 auto; margin-left: 6px; }
.k-between > .step + .k-row text { white-space: nowrap; }
/* 勾选协议这一行：位置不变，点按高度撑到 36（之前只有一行字高） */
.agree { min-height: 36px; margin-top: 4px; }
.resume-box { padding: 10px 12px; border: 0; border-radius: 8px; background: #F9F7F3; }
.resume-box__avatar { width: 40px; height: 40px; }
.resume-box__foot { margin-top: 8px; padding-top: 8px; }
.resume-box__foot .k-text { font-size: 12px; color: var(--k-ink2); }
.date { min-height: 44px; }
.exp { height: 26px; padding: 0 10px; border: 0; border-radius: 4px; background: var(--k-fill); color: var(--k-ink2); font-size: 12px; }
.alert { border: 0; border-radius: 12px; background: var(--k-alert-soft); }
.alert__title { font-size: 13px; }
.alert__bullet { background: var(--k-alert); }
/* 4 认证与赚钱机会 */
.cert-head { min-height: 44px; padding: 0 12px; border-radius: 0; background: transparent; }
.flow { padding: 14px 12px 12px; }
.flow__item { width: 52px; gap: 4px; }
.flow__arrow { height: 36px; }
.flow__line { height: 1px; background: #E0CDB0; }
.flow__dot { width: 36px; height: 36px; background: #C4A77E; }
.flow__label { font-size: 11px; color: var(--k-ink2); }
.grade { padding: 12px; }
.grade__col--r { padding-left: 14px; }
.grade__col--r .k-small { font-size: 11px; }
.grade__num { font-size: 24px; }
.grade__chip { height: 18px; padding: 0 6px; border: 0; border-radius: 4px; background: var(--k-ochre-soft); color: var(--k-ochre-deep); font-size: 11px; }
.grade__score { font-size: 14px; }
.cert { gap: 10px; padding: 10px 12px; border: 0; border-radius: 8px; background: #FAF8F3; }
.cert__img, .cert__stamp, .learn__img { mix-blend-mode: darken; }
.cert__stamp { width: 48px; height: 48px; }
.cert .k-small { font-size: 12px; }
.rec-head { padding: 12px 12px 4px; }
.rec { padding: 10px 12px; }
.rec__img { width: 56px; height: 56px; }
.rec__title { font-family: var(--k-sans); font-size: 14px; font-weight: 600; }
/* 「xx%匹配」和匹配机会屏的同一个标签一个样子（浅绿底绿字）；模板里行内写的是深绿底，这里用 !important 盖过 */
.rec__tag { height: 18px; padding: 0 6px; border-radius: 4px; background: var(--k-green-soft) !important; color: var(--k-green); font-size: 11px; font-weight: 500; }
.rec__price { color: var(--k-red-deep); font-size: 14px; }
.learn { border: 0; border-radius: 12px; background: #F5EFE5; }
/* 2026-11-18 评审修正（只动样子） */
/* 1) 匹配机会屏顶部横幅：两张小图是 44×38、84×61 的低清图，放大后发虚，邮戳后面还露出一块方形底色。
      横幅换成干净的浅暖色底（#FFF8EE 渐到白）+ 一行 14 / 600 的字；袋鼠收成字左边的一枚圆角小图（收小后不那么虚），纯装饰的邮戳图不显示 */
.hero { min-height: 0; padding: 12px; background: linear-gradient(90deg, #FFF8EE, var(--k-paper)); }
.hero > .k-col { flex-direction: row-reverse; justify-content: flex-end; align-items: center; gap: 10px; }
.opp .hero__text { flex: 1; min-width: 0; font-size: 14px; font-weight: 600; line-height: 20px; color: var(--k-ink); }
.hero__kg { flex: 0 0 auto; width: 32px; height: 28px; margin: 0; border-radius: 8px; mix-blend-mode: normal; }
.hero__stamp { display: none; }
/* 2) 认证屏的四个步骤：没完成的是浅米色圆 + 棕色线条图标（图标颜色在模板里按完成与否切换），完成了才是实心暖棕 + 白图标 */
.flow__dot { background: var(--k-red-soft); }
.flow__dot.done { background: var(--k-red); }
/* 3) 「为你推荐的赚钱机会」没有推荐内容时只剩一行标题：上下留白对齐成 12（之前上 12 下 4，像被切掉半截）；有推荐时第一条紧跟标题，间距不变大 */
.rec-head { padding: 12px; }
.rec-head + .rec { padding-top: 0; }
/* 4) 底部「去学习」米色条和上面的卡之间也是 8（之前 12，和别的卡间距不一样） */
.opp .learn.k-mt12 { margin-top: 8px; }
/* 11-18 第二轮精修（只动样子） */
/* 1) 「查看全部 / 查看详情 / 查看证书 / 去学习 / 预览简历」这类右侧链接：12 / 400 灰字 + 12 号灰箭头（模板里改了箭头大小颜色，「预览简历」换成同一个类名） */
.ob { font-size: 12px; font-weight: 400; color: var(--k-muted); }
/* 2) 小标签（技能标签、匹配度、等级、推荐匹配）：17 高、10 / 500、圆角 4 */
.chip, .match, .grade__chip, .rec__tag { height: 17px; padding: 0 5px; border-radius: 4px; font-size: 10px; font-weight: 500; line-height: 17px; }
/* 3) 匹配机会屏没有结果时：放进白卡里居中；标题 14 / 500 二级墨，说明 12 灰行高 1.6，按钮是 32 高的次按钮小胶囊 */
.empty { gap: 8px; margin-top: 8px; padding: 28px 12px; border-radius: 12px; background: var(--k-paper); }
.empty > text:first-child { font-size: 14px; font-weight: 500; color: var(--k-ink2); }
.empty > .k-small { font-size: 12px; line-height: 1.6; }
.empty :deep(.k-button.is-sm) { padding: 0 16px; border-radius: 16px; border-color: var(--k-red-line); color: var(--k-red-deep); font-size: 13px; font-weight: 500; }
/* ===================================================================================================
   11-18 第三轮「逐页精修」（只动样子；功能、文字、点按区不变）
   节奏：页边距 16、卡内 16、卡间 12、区块之间 24；卡里小标题 14 / 600，卡外区块标题 16 / 700。
   图标：全部线性、语义色（不再按标签各配一种绿 / 赭 / 蓝）；入口和标签的图标统一放在 36 浅棕方块里。
   =================================================================================================== */
.opp .k-body { padding-left: 16px; padding-right: 16px; }
.opp .card { padding: 16px; }
.opp .card--tight { padding: 0; }
/* 1 技能标签云 */
.opp .intro { gap: 12px; padding: 4px 0 12px; }
.opp .intro__img { width: 56px; height: 59px; }
.opp .intro__text { font-size: 13px; line-height: 1.6; color: var(--k-ink2); }
.opp .raw { padding: 16px; }
.opp .raw .k-title { font-size: 14px; font-weight: 600; }
.opp .raw .k-text { font-size: 12px; }
.opp .raw__box { margin-top: 12px; padding: 12px; border-radius: 8px; background: var(--k-bg); }
.opp .raw__text { font-size: 13px; line-height: 1.65; }
.opp .raw + .k-between { margin-top: 24px; align-items: flex-start; }
.opp .k-h2 { font-size: 16px; font-weight: 700; line-height: 22px; }
.opp .k-h2 + .k-meta { margin-top: 2px; font-size: 12px; }
.help { width: 44px; height: 44px; margin: -12px -12px -12px 0; display: flex; align-items: center; justify-content: center; }
.opp .tags { gap: 8px; margin-top: 12px; }
.opp .tag { gap: 10px; min-height: 64px; padding: 12px; border-radius: 12px; background: var(--k-paper); }
.tag__ic { flex: 0 0 auto; width: 36px; height: 36px; border-radius: 10px; background: var(--k-red-soft); display: flex; align-items: center; justify-content: center; }
.opp .tag .tag__name { font-size: 14px; font-weight: 600; line-height: 20px; color: var(--k-ink); }
.opp .tag .tag__pct { font-size: 12px; font-weight: 600; color: var(--k-red-deep); font-variant-numeric: tabular-nums; }
.opp .tag .tag__src { font-size: 11px; line-height: 16px; color: var(--k-muted); }
/* 没有标签：白卡空状态（56 浅棕方块 + 图标 + 一句话），下面那行灰字是它的说明 */
.tags-empty { display: flex; flex-direction: column; align-items: center; margin-top: 12px; padding: 28px 16px 8px; border-radius: 12px 12px 0 0; background: var(--k-paper); }
.tags-empty__title { margin-top: 12px; font-size: 14px; font-weight: 500; line-height: 20px; color: var(--k-ink2); }
.empty__ic { width: 56px; height: 56px; border-radius: 16px; background: var(--k-red-soft); display: flex; align-items: center; justify-content: center; }
.opp .tags-foot { margin-top: 16px; font-size: 11px; line-height: 1.6; color: var(--k-muted); text-align: center; }
.tags-empty + .tags-foot { margin-top: 0; padding: 0 16px 28px; border-radius: 0 0 12px 12px; background: var(--k-paper); font-size: 12px; }
/* 2 技能匹配机会 */
.opp .hero { padding: 12px 16px; }
.opp .job { padding: 16px; }
.opp .job.k-mt12 { margin-top: 12px; }
.opp .job__img { width: 80px; height: 80px; }
.opp .job__top .k-small { font-size: 12px; }
.opp .empty { gap: 0; margin-top: 12px; padding: 32px 16px 28px; }
.opp .empty .empty__ic { order: -1; }
.opp .empty > text:first-child { margin-top: 12px; font-size: 14px; font-weight: 500; line-height: 20px; color: var(--k-ink2); }
.opp .empty > .k-small { margin-top: 4px; font-size: 12px; line-height: 1.6; color: var(--k-muted); }
.opp .empty :deep(.k-button) { margin-top: 16px; }
/* 3 一键报名：步骤号 18 浅棕圆 + 深棕字；简历块里的勾是 14 号线性绿勾（不再是实心绿圆）；协议链接用深棕 */
.opp .apply-job { padding: 16px; }
.opp .apply-job__img { width: 72px; height: 72px; }
.opp .card.k-mt12 { margin-top: 12px; }
.opp .step__num { width: 18px; height: 18px; background: var(--k-red-soft); color: var(--k-red-deep); font-size: 11px; font-weight: 600; }
.opp .step.k-mt16, .opp .k-between.k-mt16 { margin-top: 20px; }
.opp .resume-box { margin-top: 10px; padding: 12px; }
.opp .ok { width: 14px; height: 14px; background: transparent; display: flex; align-items: center; justify-content: center; flex: 0 0 auto; }
.opp .date { margin-top: 10px; border: 0; border-radius: 8px; background: var(--k-bg); }
.opp .agree__link { color: var(--k-red-deep); }
.opp .agree { justify-content: center; }
/* 4 认证与赚钱机会：四步只留一条发丝连线（去掉线后的小箭头）；星星 16；「为你推荐的赚钱机会」放到卡外当区块标题，下面的「去学习」是一张白卡入口 */
.opp .cert-head { min-height: 48px; padding: 0 16px; }
.opp .flow { padding: 16px 16px 14px; }
.opp .flow__line { height: 1px; background: var(--k-line); transform: scaleY(.5); }
.opp .flow__dot { background: var(--k-red-soft); }
.opp .flow__dot.done { background: var(--k-red); }
.opp .flow__label { font-size: 12px; }
.opp .flow, .opp .cert-head { border-bottom: 0; position: relative; }
.opp .cert-head::after, .opp .flow::after { content: ""; position: absolute; left: 16px; right: 16px; bottom: 0; height: 1px; background: var(--k-line); transform: scaleY(.5); }
.opp .grade { padding: 16px; }
.opp .grade__col--r { border-left: 0; padding-left: 16px; box-shadow: inset 1px 0 0 0 var(--k-line); }
.opp .grade__col--r .k-row.k-gap6 { gap: 4px; }
.opp .grade__num { font-size: 24px; font-variant-numeric: tabular-nums; }
.opp .card.k-mt12 .k-title, .opp .cert-head .k-title { font-size: 14px; font-weight: 600; }
.opp .rec-head { display: block; margin: 24px 0 10px; padding: 0; font-size: 16px; font-weight: 700; line-height: 22px; color: var(--k-ink); }
.opp .rec-card { margin-bottom: 8px; }
.opp .rec-head + .rec-card .rec { padding-top: 12px; }
.opp .rec { align-items: flex-start; gap: 12px; padding: 16px; }
.opp .rec__img { width: 56px; height: 56px; border-radius: 8px; }
.opp .rec__price { font-size: 15px; font-weight: 700; font-variant-numeric: tabular-nums; }
.opp .learn, .opp .learn.k-mt12 { gap: 12px; margin-top: 0; min-height: 64px; padding: 12px 16px; border-radius: 12px; background: var(--k-paper); }
.opp .learn__img { width: 40px; height: 40px; border-radius: 10px; mix-blend-mode: normal; background: var(--k-red-soft); }
.opp .learn > .k-small { font-size: 12px; line-height: 1.6; color: var(--k-ink2); }
.opp .learn__btn { flex: 0 0 auto; height: 28px; padding: 0 10px 0 12px; border-radius: 14px; background: var(--k-red-soft); }
.opp .learn__btn .ob { color: var(--k-red-deep); font-weight: 500; }
@media (max-width: 350px) {
  .opp .k-body { padding-left: 12px; padding-right: 12px; }
  .opp .tag { gap: 8px; padding: 10px; }
  .tag__ic { width: 32px; height: 32px; }
  .opp .flow { padding-left: 10px; padding-right: 10px; }
}
/* 第三轮复查 1：岗位名不再被「匹配度」和类型挤成「洱海边咖啡馆 • …」—— 名字和（类型）连成一段、最多两行；
   列表里每张卡的两个按钮收成靠右的 32 高小胶囊（「一键报名」浅棕底深棕字），一屏不再排着三颗实心大棕钮 */
.opp .job__top > .k-flex1 > .k-between, .opp .rec .k-flex1 > .k-between:first-child { align-items: flex-start; }
.opp .job__name { display: block; flex: 1; min-width: 0; margin-right: 8px; overflow: hidden; display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 2; line-height: 20px; }
.opp .job__name > text:first-child { min-width: 0; overflow: visible; white-space: normal; text-overflow: clip; }
.opp .job__name > text { display: inline; }
.opp .job__title, .opp .rec__title { font-size: 14px; font-weight: 600; line-height: 20px; color: var(--k-ink); }
.opp .job__type, .opp .rec .job__name .k-small { font-size: 12px; color: var(--k-muted); }
.opp .match, .opp .rec__tag { margin-top: 1px; }
.opp .job .k-row.k-gap10.k-mt12 { justify-content: flex-end; gap: 8px; margin-top: 12px; }
.opp .job .k-row.k-gap10.k-mt12 > .k-flex1 { flex: 0 0 96px; }
.opp .job :deep(.k-button) { height: 32px; border-radius: 16px; font-size: 13px; font-weight: 600; }
.opp .job :deep(.k-button.is-primary) { background: var(--k-red-soft); color: var(--k-red-deep); box-shadow: none; }
.opp .rec__place { min-width: 0; flex: 1; }
.opp .rec__place .k-meta { overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
.opp .rec .k-meta.k-mt4 { display: block; line-height: 1.6; }
/* 第三轮复查 2：320 宽时标签名和百分比不再贴在一起 */
.opp .tag .k-between { gap: 4px; }
@media (max-width: 350px) { .opp .tag .tag__name { font-size: 13px; } .opp .tag .tag__pct { font-size: 11px; } }
/* 一键报名：两项输入一个样子（都是浅灰平底、8 圆角，出错 / 正在输入时描一圈细线）；图片没到之前先露浅棕底，不留一块空白 */
.opp .apply-job__img, .opp .resume-box__avatar { background: var(--k-red-soft); }
.opp :deep(.k-field__box) { min-height: 44px; border: 0; border-radius: 8px; background: var(--k-bg); }
.opp :deep(.k-field__box.is-focus) { box-shadow: inset 0 0 0 1px var(--k-red-line); }
.opp :deep(.k-field__box.is-error), .opp .date.k-input--error { box-shadow: inset 0 0 0 1px var(--k-alert); }
.opp .date { min-height: 44px; }
/* ===================================================================================================
   11-18 第三轮返修（独立评审第 1 轮；只动样子）
   =================================================================================================== */
/* 标签 / 徽章统一 11 / 500、高 18（不再有 10 号字）；岗位卡里的技能标签只用浅棕一种，整张卡只剩匹配徽章一个绿色 */
.opp .chip, .opp .match, .opp .grade__chip, .opp .rec__tag { height: 18px; padding: 0 6px; font-size: 11px; font-weight: 500; line-height: 18px; }
.opp .chip, .opp .chip.is-ochre, .opp .chip.is-indigo, .opp .chip.is-green, .opp .chip.is-gray { background: var(--k-red-soft); color: var(--k-red-deep); }
/* 1 技能标签云：顶部插画换成 40 浅棕方块 + 线性图标（和下面的标签方块一套画法）；「点这里看匹配机会」是暖棕字 + 箭头，看得出能点 */
.opp .intro__ic { flex: 0 0 auto; width: 40px; height: 40px; border-radius: 12px; background: var(--k-red-soft); display: flex; align-items: center; justify-content: center; }
.opp .tags-jobs { margin-top: 2px; }
.opp .tags-jobs .k-meta { margin-top: 0; font-size: 12px; color: var(--k-red-deep); }
/* 标签格：名称一行，百分比挪到「查看来源」那行右边（12 / 600 暖棕），窄屏也不和名称挤在一起 */
.opp .tag .tag__sub { margin-top: 2px; }
.opp .tag .tag__sub .tag__pct { font-size: 12px; font-weight: 600; line-height: 16px; color: var(--k-red-deep); }
/* 2 技能匹配机会：匹配原因 12 号二级墨，「匹配原因：」500；（换宿）不拆开；按钮和上面隔 8 */
.opp .job__why { color: var(--k-ink2); font-size: 12px; line-height: 18px; }
.opp .job__why-k { font-weight: 500; }
.opp .job__type, .opp .rec__type { white-space: nowrap; }
.opp .job__name { margin-right: 8px; }
.opp .job .k-row.k-gap10.k-mt12 { margin-top: 8px; }
.opp .job__top { position: relative; }
@media (max-width: 359px) {
  /* 窄屏：匹配徽章挪到图片左上角，做成白色小胶囊，标题用满宽 */
  .opp .job .match { position: absolute; left: 4px; top: 4px; margin: 0; background: var(--k-paper); color: var(--k-green); box-shadow: 0 1px 2px rgba(58,50,43,.12); }
  .opp .job__name { margin-right: 0; }
}
/* 3 一键报名：经历条按内容长高（不再写死 26 高、折行后字露到灰底外）；简历块的「预览简历」挪到步骤标题右边，日期不拆行；
   第 4 步的说明放到标题下一行；图和头像没到之前露 24 号线性占位图标 */
.opp .exp { height: auto; min-height: 26px; padding: 4px 10px; line-height: 18px; box-sizing: border-box; }
.opp .step-head { min-height: 20px; }
.opp .step__link { flex: 0 0 auto; }
.opp .resume-box__date { white-space: nowrap; }
.opp .step__note { display: block; margin-top: 4px; padding-left: 24px; font-size: 12px; line-height: 18px; color: var(--k-muted); }
.opp .step__note + .k-row.k-mt12 { margin-top: 10px; }
.opp .apply-job__ph, .opp .resume-box__ph { position: relative; flex: 0 0 auto; display: flex; align-items: center; justify-content: center; overflow: hidden; background: var(--k-red-soft); }
.opp .apply-job__ph { width: 72px; height: 72px; border-radius: 8px; }
.opp .resume-box__ph { width: 40px; height: 40px; border-radius: 50%; }
.opp .apply-job__ph .apply-job__img, .opp .resume-box__ph .resume-box__avatar { position: absolute; left: 0; top: 0; width: 100%; height: 100%; background: transparent; }
@media (max-width: 359px) {
  .opp .k-body { padding-left: 12px; padding-right: 12px; }
  .opp .card, .opp .apply-job { padding: 12px; }
  .opp :deep(.k-field__box) { padding: 0 8px; }
  .opp :deep(.k-field__input) { font-size: 13px; }
}
/* 4 认证与赚钱机会：四步 32 圆 —— 做完的浅棕底 + 暖棕图标，当前那步才是实心，没到的是灰底灰图标 */
.opp .flow__dot { width: 32px; height: 32px; background: var(--k-bg); }
.opp .flow__dot.done { background: var(--k-red-soft); }
.opp .flow__dot.cur { background: var(--k-red); }
/* 证书卡：40 浅棕方块 + 奖章（不再用证书照片和灰邮戳）；「已认证」是标题旁 18 高的绿色小胶囊；编号不拆行 */
.opp .cert { align-items: flex-start; }
.opp .cert__ic { flex: 0 0 auto; width: 40px; height: 40px; border-radius: 12px; background: var(--k-red-soft); display: flex; align-items: center; justify-content: center; }
.opp .cert__name { display: flex; align-items: center; flex-wrap: wrap; gap: 4px 6px; }
.opp .cert__ok { flex: 0 0 auto; display: flex; align-items: center; gap: 2px; height: 18px; padding: 0 6px; border-radius: 4px; background: var(--k-green-soft); color: var(--k-green); font-size: 11px; font-weight: 500; line-height: 18px; }
.opp .cert__no, .opp .grade__no { white-space: nowrap; font-size: 12px; font-variant-numeric: tabular-nums; }
/* 没有证书 / 没有推荐：像样的空状态（56 方块 + 32 图标 + 14 / 500 标题 + 12 说明） */
.opp .cert-empty, .opp .rec-empty { display: flex; flex-direction: column; align-items: center; text-align: center; padding: 24px 16px 8px; }
.opp .rec-empty { padding: 28px 16px 24px; border-radius: 12px; background: var(--k-paper); margin-bottom: 8px; }
.opp .cert-empty__title { margin-top: 12px; font-size: 14px; font-weight: 500; line-height: 20px; color: var(--k-ink2); }
.opp .cert-empty__desc { margin-top: 4px; font-size: 12px; line-height: 1.6; color: var(--k-muted); }
/* 学习条：插画换成 40 浅棕方块 + 学士帽 */
.opp .learn__ic { flex: 0 0 auto; width: 40px; height: 40px; border-radius: 12px; background: var(--k-red-soft); display: flex; align-items: center; justify-content: center; }
@media (max-width: 359px) {
  /* 窄屏：考核等级和综合评分上下排，证书编号有整行宽度 */
  .opp .grade { flex-direction: column; }
  .opp .grade__col--r { margin-top: 12px; padding-left: 0; padding-top: 12px; box-shadow: inset 0 1px 0 0 var(--k-line); }
}
/* 返修第 2 遍：匹配页顶部的袋鼠插画也换成 32 浅棕方块 + 线性图标；窄屏标签格「查看来源」不拆字；推荐列表窄屏时匹配徽章挪到图片左上角 */
.opp .hero__ic { width: 32px; height: 32px; border-radius: 8px; background: var(--k-paper); display: flex; align-items: center; justify-content: center; }
.opp .tag .tag__sub > .k-row { flex: 0 0 auto; }
.opp .tag .tag__src { white-space: nowrap; }
.opp .rec { position: relative; }
@media (max-width: 359px) {
  .opp .tag { gap: 6px; padding: 10px 8px; }
  .opp .tag__ic { width: 28px; height: 28px; border-radius: 8px; }
  .opp .rec .rec__tag { position: absolute; left: 20px; top: 16px; margin: 0; background: var(--k-paper) !important; color: var(--k-green); box-shadow: 0 1px 2px rgba(58,50,43,.12); }
  .opp .rec .job__name { margin-right: 0; }
}
/* ===================================================================================================
   11-18 第三轮返修 2（独立评审第 2 轮；只动样子）
   =================================================================================================== */
/* 1 技能标签云：顶部说明和 40 方块垂直居中；标签格第一行 = 名称 + 百分比（15 / 700 右对齐），第二行只放「查看来源」 */
.opp .intro { align-items: center; }
.opp .tag .k-between:first-child { align-items: center; }
.opp .tag .tag__name { flex: 1; min-width: 0; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
.opp .tag .k-between .tag__pct { flex: 0 0 auto; font-size: 15px; font-weight: 700; line-height: 20px; color: var(--k-red-deep); }
/* 2 技能匹配机会：顶部横幅去掉卡底，只留 18 图标 + 13 / 500 说明一行；匹配徽章所有宽度都放在图片左上角，标题拿到整行；匹配原因 1 行省略；空状态说明收窄到 260 居中 */
.opp .hero { min-height: 0; padding: 0 0 4px; background: transparent; border: 0; box-shadow: none; }
.opp .hero > .k-col { gap: 6px; }
.opp .hero__ic { width: 18px; height: 18px; background: transparent; }
.opp .hero__text { font-size: 13px; font-weight: 500; line-height: 18px; color: var(--k-ink2); }
.opp .job .match { position: absolute; left: 4px; top: 4px; margin: 0; background: var(--k-paper); color: var(--k-green); box-shadow: 0 1px 2px rgba(58,50,43,.12); }
.opp .job__name { margin-right: 0; }
.opp .job__why { display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 1; overflow: hidden; white-space: normal; }
.opp .empty > .k-small { max-width: 260px; }
/* 3 一键报名：第 4 步的说明并到标题行（12 灰），经历是满宽 36 高的列表行（house 14 + 名称），行间发丝线；不能点的「一键报名」是浅棕平色 + 灰字 */
.opp .step--note { flex: 1; min-width: 0; }
.opp .step--note .step__note { flex: 1; min-width: 0; margin: 0; padding: 0; font-size: 12px; line-height: 18px; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
.opp .exp-list { flex-direction: column; flex-wrap: nowrap; align-items: stretch; gap: 0; margin-top: 8px; }
.opp .exp-list .exp { position: relative; gap: 6px; min-height: 36px; height: auto; padding: 8px 0; border: 0; border-radius: 0; background: transparent; color: var(--k-ink); font-size: 13px; line-height: 20px; }
.opp .exp-list .exp + .exp::before { content: ""; position: absolute; left: 20px; right: 0; top: 0; height: 1px; background: var(--k-line); transform: scaleY(.5); }
.opp .exp-list .exp > text { flex: 1; min-width: 0; }
.opp :deep(.k-button.is-disabled.is-primary) { opacity: 1; background: var(--k-red-soft) !important; color: var(--k-muted) !important; box-shadow: none; }
/* 4 认证与赚钱机会：三块都用卡外 16 / 700 分区标题（成长认证 / 已通过证书 / 为你推荐的赚钱机会），卡里只放内容；证书行不再框套框 */
.opp .cert-main { background: transparent; box-shadow: none; }
.opp .cert-main .cert-head { min-height: 22px; margin-bottom: 10px; padding: 0; }
.opp .cert-main .cert-head::after { display: none; }
.opp .cert-main .cert-head .k-title, .opp .cert-card__head .k-title { font-size: 16px; font-weight: 700; line-height: 22px; }
.opp .cert-main .flow { border-radius: 12px 12px 0 0; background: var(--k-paper); }
.opp .cert-main .grade { border-radius: 0 0 12px 12px; background: var(--k-paper); }
.opp .card.cert-card { margin-top: 24px; padding: 0; background: transparent; box-shadow: none; }
.opp .cert-card__head { min-height: 22px; margin-bottom: 10px; }
.opp .cert-card .cert { margin-top: 0; padding: 16px; border-radius: 12px; background: var(--k-paper); }
.opp .cert-card .cert-empty { padding: 24px 16px; border-radius: 12px; background: var(--k-paper); }
.opp .grade__num { font-size: 20px; font-weight: 700; line-height: 24px; }
.opp .grade__num + .k-text { font-size: 13px; }
/* 没有推荐：不再叠第二张大空状态，收成一行紧凑提示（32 方块 + 16 图标 + 标题 / 说明） */
.opp .rec-empty { flex-direction: row; align-items: center; gap: 12px; padding: 12px 16px; text-align: left; }
.opp .rec-empty .empty__ic { flex: 0 0 auto; width: 32px; height: 32px; border-radius: 10px; }
.opp .rec-empty__copy { flex: 1; min-width: 0; display: flex; flex-direction: column; }
.opp .rec-empty .cert-empty__title { margin-top: 0; font-size: 13px; line-height: 18px; }
.opp .rec-empty .cert-empty__desc { margin-top: 2px; font-size: 12px; line-height: 18px; }
@media (max-width: 359px) {
  /* 窄屏：卡本身不加内边距，卡里每块统一 12，全页只有「页边 12」和「卡内 24」两条左线；推荐行的匹配徽章留在标题行右边 */
  .opp .card--tight, .opp .cert-card { padding: 0; }
  .opp .cert-main .flow, .opp .cert-main .grade, .opp .rec, .opp .cert-card .cert { padding-left: 12px; padding-right: 12px; }
  .opp .cert-main .cert-head { padding: 0; }
  .opp .rec .rec__tag { position: static; margin-top: 1px; background: var(--k-green-soft) !important; color: var(--k-green); box-shadow: none; }
  .opp .rec .job__name { margin-right: 8px; }
  .opp .step--note { flex-wrap: wrap; row-gap: 2px; }
  .opp .step--note .step__note { flex: 0 0 100%; padding-left: 24px; white-space: normal; }
}
/* ===================================================================================================
   11-18 第三轮返修 3（独立评审第 3 轮；只动样子）
   =================================================================================================== */
/* 2 技能匹配机会：标题 15 / 600 一行省略；「（兼职）」不再接在标题后面掉行，挪到「店名 · 城市」那行末尾（12 灰）；
   标签行不换行，三张卡一样高 */
.opp .job__name, .opp .rec .job__name { display: block; flex: 1; min-width: 0; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; -webkit-line-clamp: unset; line-height: 21px; }
.opp .job__name > text, .opp .job__name > text:first-child { white-space: nowrap; }
.opp .job__title, .opp .rec__title { font-size: 15px; font-weight: 600; line-height: 21px; }
.opp .job__meta { flex-wrap: nowrap; min-width: 0; }
.opp .job__meta .job__place, .opp .rec__place .k-meta { flex: 0 1 auto; min-width: 0; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
.opp .job__meta .job__type, .opp .rec__place .rec__type { flex: 0 0 auto; margin-left: -4px; font-size: 12px; line-height: 18px; color: var(--k-muted); white-space: nowrap; }
.opp .job__top .k-row.k-wrap { flex-wrap: nowrap; overflow: hidden; margin-top: 8px; }
.opp .job__top .job__why { margin-top: 8px; }
/* 3 一键报名：标题 15 / 600 最多两行，类型跟在店名行；经历行图标对第一行，「共 N 天」靠右不拆开 */
.opp .apply-job__title { font-size: 15px; font-weight: 600; line-height: 21px; overflow: hidden; display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 2; }
.opp .apply-job .job__meta .job__type { margin-left: 0; }
/* 匹配徽章和匹配机会列表一样放在图片左上角（白色小胶囊），标题拿到整行宽，不再把最后一个字挤到第二行 */
.opp .apply-job { position: relative; }
.opp .apply-job > .match { position: absolute; left: 20px; top: 20px; margin: 0; background: var(--k-paper); color: var(--k-green); box-shadow: 0 1px 2px rgba(58,50,43,.12); }
@media (max-width: 359px) { .opp .apply-job > .match { left: 16px; top: 16px; } }
.opp .exp-list .exp { align-items: flex-start; }
.opp .exp-list .exp > :deep(.k-icon), .opp .exp-list .exp > .k-icon { margin-top: 3px; }
.opp .exp-list .exp > .exp__n { flex: 0 0 auto; margin-left: 8px; font-size: 12px; line-height: 20px; color: var(--k-muted); white-space: nowrap; font-variant-numeric: tabular-nums; }
/* 4 认证：两列都是三行固定高（20 / 28 / 18，行距 8），每行左右对齐 */
.opp .grade__col { display: flex; flex-direction: column; gap: 8px; }
.opp .grade__col > .k-text:first-child, .opp .grade__col > .k-row:first-child { height: 20px; line-height: 20px; margin-top: 0; align-items: center; }
.opp .grade__col > .k-row:nth-child(2) { height: 28px; margin-top: 0; align-items: center; }
.opp .grade__col > text:nth-child(3), .opp .grade__col > .k-meta, .opp .grade__col > .grade__no { height: 18px; margin-top: 0; font-size: 12px; line-height: 18px; color: var(--k-muted); }
.opp .grade__score { font-variant-numeric: tabular-nums; }
/* 推荐列表：分隔线是从文字列开始的发丝线（不再是通栏 1px 实线） */
.opp .rec.has-line { border-bottom: 0; }
.opp .rec.has-line::after { content: ""; position: absolute; left: 84px; right: 16px; bottom: 0; height: 1px; background: var(--k-line); transform: scaleY(.5); }
/* 1 技能标签云：标签名 14 / 600 墨色为主，百分比 13 / 600 暖棕等宽为次，中间至少 8 */
.opp .tag .k-between:first-child { gap: 8px; }
.opp .tag .tag__name { font-size: 14px; font-weight: 600; }
.opp .tag .k-between .tag__pct { font-size: 13px; font-weight: 600; line-height: 20px; font-variant-numeric: tabular-nums; }
@media (max-width: 359px) {
  .opp .rec.has-line::after { left: 80px; right: 12px; }
  .opp .tag .tag__name { font-size: 14px; }
  .opp .tag .k-between .tag__pct { font-size: 12px; }
}
/* ===================================================================================================
   11-18 第三轮返修 4（独立评审第 4 轮；只动样子）
   =================================================================================================== */
/* 1 技能标签云：页首说明收进白卡（内边距 16），图标方块和下面卡里的字同一条左线 x=32 */
.opp .intro { padding: 16px; border-radius: 12px; background: var(--k-paper); }
.opp .intro + .raw { margin-top: 12px; }
/* 2 / 3 / 4 店名 · 城市后面的「（换宿）」和城市隔 4、用更浅一档的灰，不再像城市名的一部分 */
.opp .job__meta .job__type, .opp .apply-job .job__meta .job__type { margin-left: 0; color: var(--k-light); }
.opp .rec__place .rec__type { margin-left: 1px; color: var(--k-light); }
/* 3 一键报名「相关经历」：每行 44 高，名称一行省略（右边已有「共 N 天」），图标和字垂直居中 */
.opp .exp-list .exp { align-items: center; min-height: 44px; padding: 0; }
.opp .exp-list .exp > :deep(.k-icon), .opp .exp-list .exp > .k-icon { margin-top: 0; }
.opp .exp-list .exp > text:not(.exp__n) { overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
@media (max-width: 359px) {
  /* 1 右列标签卡右内边距 12（名称和百分比间距收到 6，「摄影修图」不被截），「88%」和右边的客服竖钮隔开 */
  .opp .tag:nth-child(2n) { padding-right: 12px; }
  .opp .tag .k-between:first-child { gap: 6px; }
  /* 4 推荐行：匹配徽章挪到缩略图左上角（和匹配机会列表一样），标题拿回整行；价格单独一行右对齐 */
  .opp .rec { padding-top: 12px; padding-bottom: 12px; }
  .opp .rec .rec__tag { position: absolute; left: 16px; top: 16px; margin: 0; background: var(--k-paper) !important; color: var(--k-green); box-shadow: 0 1px 2px rgba(58,50,43,.12); }
  .opp .rec .job__name { margin-right: 0; }
  .opp .rec .k-flex1 > .k-between.k-mt4 { flex-wrap: wrap; row-gap: 2px; }
  .opp .rec .k-flex1 > .k-between.k-mt4 > .rec__place { flex: 0 0 100%; }
  .opp .rec .k-flex1 > .k-between.k-mt4 > .rec__price-wrap { margin-left: auto; }
}
/* ===================================================================================================
   11-18 第三轮返修 5（独立评审第 5 轮；只动样子）
   =================================================================================================== */
/* 2 技能匹配机会：「匹配原因」是这一页最要紧的信息，最多两行（和认证页「推荐理由」一致）；
   「一键报名」回到实心暖棕主按钮（白字），「查看详情」是描边次按钮，主次分明 */
.opp .job__why { -webkit-line-clamp: 2; text-wrap: balance; }
.opp .job :deep(.k-button.is-primary) { background: var(--k-grad-brown); color: var(--k-paper); }
/* 2 / 3 店名 · 城市和后面的「（换宿）」两页同一个间距 */
.opp .job__meta .job__type { margin-left: -2px; }
.opp .apply-job .job__meta .job__type { margin-left: 2px; }
@media (max-width: 359px) {
  /* 2 窄屏地点行：店名 · 城市不再截掉城市，放不下时「（换宿）」折到第二行，和地点文字同一条左线（图标悬在左边） */
  .opp .job .job__meta { flex-wrap: wrap; row-gap: 2px; padding-left: 18px; }
  .opp .job .job__meta > :deep(.k-icon), .opp .job .job__meta > .k-icon { margin-left: -18px; }
  .opp .job .job__meta .job__place { flex: 0 1 auto; white-space: normal; overflow: visible; text-overflow: clip; }
  .opp .job .job__meta .job__type { margin-left: -6px; }
}
/* 4 认证页「暂时没有推荐」和「还没有证书」同一种空状态：56 浅棕方块 + 32 图标，居中竖排 */
.opp .rec-empty { flex-direction: column; align-items: center; gap: 0; padding: 24px 16px; text-align: center; }
.opp .rec-empty .empty__ic { width: 56px; height: 56px; border-radius: 16px; }
.opp .rec-empty__copy { align-items: center; }
.opp .rec-empty .cert-empty__title { margin-top: 12px; font-size: 14px; line-height: 20px; }
.opp .rec-empty .cert-empty__desc { margin-top: 4px; font-size: 12px; line-height: 1.6; }
/* ===================================================================================================
   11-18 第四轮精修（微信实拍评审；只动样子）。前缀 .k-page.opp 压过上面各轮
   =================================================================================================== */
/* 1 技能标签云：页首说明不要卡和方块，和 s=2 一样是一行（18 图标 + 13 / 500 二级墨）；原文直接放在卡里（15 / 1.7 墨色），计数右下 11 灰；标题到空卡 12 */
.k-page.opp .intro { align-items:flex-start;gap:6px;padding:0 4px;border:0;border-radius:0;background:transparent;box-shadow:none; }
.k-page.opp .intro__ic { width:18px;height:20px;border-radius:0;background:transparent; }
.k-page.opp .intro__text { font-size:13px;font-weight:500;line-height:20px;color:var(--k-ink2); }
.k-page.opp .intro + .raw { margin-top:12px; }
.k-page.opp .raw__box { display:flex;flex-direction:column;margin-top:12px;padding:0;border:0;border-radius:0;background:transparent; }
.k-page.opp .raw__text { font-size:15px;line-height:1.7;color:var(--k-ink); }
.k-page.opp .raw__count { position:static;align-self:flex-end;margin-top:4px;font-size:11px;line-height:16px;color:var(--k-muted); }
.k-page.opp .tags-empty { margin-top:0; }
/* 2 技能匹配机会：岗位名、店名 · 城市、匹配原因都整段显示（放不下就换行，不再一行 / 两行省略）；中文不用 balance */
.k-page.opp .job__name, .k-page.opp .rec .job__name { display:block;white-space:normal;overflow:visible;text-overflow:clip;-webkit-line-clamp:unset; }
.k-page.opp .job__name > text, .k-page.opp .job__name > text:first-child { white-space:normal; }
.k-page.opp .job .job__meta { flex-wrap:wrap;row-gap:2px;padding-left:18px; }
.k-page.opp .job .job__meta > .k-icon, .k-page.opp .job .job__meta > :deep(.k-icon) { margin-left:-18px; }
.k-page.opp .job__meta .job__place, .k-page.opp .rec__place .k-meta { white-space:normal;overflow:visible;text-overflow:clip; }
.k-page.opp .rec__place { flex-wrap:wrap; }
.k-page.opp .job__why { display:block;overflow:visible;-webkit-line-clamp:unset;text-wrap:wrap; }
/* 整页空状态：不要卡，放在页面底色上、距顶约 1/5；56 方块 + 32 图标、17 / 700 标题、13 灰说明（最宽 280）、248 × 44 主按钮（和写评论出错页一套） */
.k-page.opp .empty { margin-top:0;padding:16vh 16px 0;border:0;border-radius:0;background:transparent;box-shadow:none; }
.k-page.opp .empty > text:first-child { margin-top:16px;font-size:17px;font-weight:700;line-height:24px;color:var(--k-ink); }
.k-page.opp .empty > .k-small { max-width:280px;margin-top:6px;font-size:13px;line-height:1.7;color:var(--k-muted); }
.k-page.opp .empty :deep(.k-button) { width:248px;height:44px;margin-top:24px;padding:0;border:0;border-radius:22px;background:var(--k-grad-brown);box-shadow:none;color:var(--k-paper);font-size:15px;font-weight:600;line-height:44px; }
/* 3 一键报名：岗位摘要压成一行（64 缩略图 + 标题 + 价格）；没有岗位时右边画两条骨架条、「匹配」变淡灰，不再是一张空卡 */
.k-page.opp .apply-job { padding:12px;gap:12px; }
.k-page.opp .apply-job__ph { width:64px;height:64px; }
.k-page.opp .apply-job > .match { left:16px;top:16px; }
.k-page.opp .apply-job.is-empty::before, .k-page.opp .apply-job.is-empty::after { content:"";position:absolute;left:88px;height:14px;border-radius:4px;background:var(--k-fill); }
.k-page.opp .apply-job.is-empty::before { top:24px;width:52%; }
.k-page.opp .apply-job.is-empty::after { top:48px;width:28%;height:12px; }
.k-page.opp .apply-job.is-empty > .match { background:var(--k-fill);box-shadow:none;color:var(--k-muted); }
/* 复用简历：不再框套框，头像行和勾选行直接放在步骤 1 下面，中间一条发丝线 */
.k-page.opp .resume-box { margin-top:12px;padding:0;border:0;border-radius:0;background:transparent; }
.k-page.opp .resume-box__foot { position:relative;margin-top:12px;padding-top:12px;border-top:0; }
.k-page.opp .resume-box__foot::before { content:"";position:absolute;left:0;right:0;top:0;height:1px;background:var(--k-line);transform:scaleY(.5); }
/* 第 4 步说明放不下就换行；相关经历整段显示（允许两行），「共 N 天」顶对齐 */
.k-page.opp .step--note { flex-wrap:wrap;row-gap:2px; }
.k-page.opp .step--note .step__note { flex:1 1 auto;min-width:0;white-space:normal;overflow:visible;text-overflow:clip; }
.k-page.opp .exp-list .exp { align-items:flex-start;min-height:44px;padding:12px 0; }
.k-page.opp .exp-list .exp > text:not(.exp__n) { white-space:normal;overflow:visible;text-overflow:clip;line-height:20px; }
.k-page.opp .exp-list .exp > .k-icon, .k-page.opp .exp-list .exp > :deep(.k-icon) { margin-top:3px; }
.k-page.opp .exp-list .exp > .exp__n { flex:0 0 auto;line-height:20px; }
/* 不能点的「一键报名」：和全端一样保持渐变、整体 .6 透明 */
.k-page.opp :deep(.k-button.is-disabled.is-primary) { opacity:.6;background:var(--k-grad-brown) !important;color:var(--k-paper) !important; }
/* 4 认证：「— 级」没数据时破折号退成浅灰、「级」贴近 4；右栏分隔改成伪元素发丝线（去掉 inset 阴影带出来的底线） */
.k-page.opp .grade__num.is-none { color:var(--k-light); }
.k-page.opp .grade__num + .k-text { margin-left:-4px; }
.k-page.opp .grade__col--r { position:relative;border:0;box-shadow:none; }
.k-page.opp .grade__col--r::before { content:"";position:absolute;left:0;top:0;bottom:0;width:1px;background:var(--k-line);transform:scaleX(.5); }
@media (max-width:359px) {
  .k-page.opp .grade__col--r::before { right:0;bottom:auto;width:auto;height:1px;transform:scaleY(.5); }
}
/* 「还没有证书」「暂时没有推荐」：紧凑的行式空状态（40 方块 + 20 图标 + 左对齐 14 / 500 标题 + 12 说明，内边距 16），「去学习」回到第一屏 */
.k-page.opp .cert-card .cert-empty, .k-page.opp .rec-empty { display:flex;flex-direction:row;align-items:center;gap:12px;margin-bottom:8px;padding:16px;border-radius:12px;background:var(--k-paper);text-align:left; }
.k-page.opp .cert-card .cert-empty { margin-bottom:0; }
.k-page.opp .cert-empty .empty__ic, .k-page.opp .rec-empty .empty__ic { flex:0 0 auto;width:40px;height:40px;border-radius:10px; }
.k-page.opp .rec-empty__copy { flex:1;min-width:0;display:flex;flex-direction:column;align-items:flex-start; }
.k-page.opp .cert-empty .cert-empty__title, .k-page.opp .rec-empty .cert-empty__title { margin-top:0;font-size:14px;font-weight:500;line-height:20px;color:var(--k-ink); }
.k-page.opp .cert-empty .cert-empty__desc, .k-page.opp .rec-empty .cert-empty__desc { margin-top:2px;font-size:12px;line-height:18px;color:var(--k-muted); }
/* 第四轮复查：说明句只在标点处断行（不再「（不 / 替代原文）」「补 / 充。」）；推荐行缩略图 64（1:1），匹配徽章挪到缩略图左上角，标题拿到整行宽（不再折出「选）」） */
.k-page.opp .intro__text, .k-page.opp .raw__text.is-empty { word-break:keep-all;overflow-wrap:break-word;overflow-wrap:anywhere; }
.k-page.opp .raw__text.is-empty { font-size:14px;color:var(--k-muted); }
.k-page.opp .rec__img { width:64px;height:64px;border-radius:8px; }
.k-page.opp .rec .rec__tag { position:absolute;left:20px;top:20px;margin:0;background:var(--k-paper) !important;box-shadow:0 1px 2px rgba(58,50,43,.12);color:var(--k-green); }
.k-page.opp .rec .job__name { margin-right:0; }
.k-page.opp .rec.has-line::after { left:92px; }
@media (max-width:359px) {
  .k-page.opp .rec .rec__tag { left:16px;top:16px; }
  .k-page.opp .rec.has-line::after { left:88px; }
}
/* 第四轮复查：岗位名、经历名、固定说明只在空格 / 标点处断行（「洱海边咖啡馆 ·」/「咖啡师换工」，「平潭海边民宿前台」/「（夜班可选）」），不再掉单字 */
.k-page.opp .job__title, .k-page.opp .rec__title, .k-page.opp .apply-job__title, .k-page.opp .exp-list .exp > text:not(.exp__n), .k-page.opp .empty > .k-small, .k-page.opp .cert-empty__desc, .k-page.opp .learn > .k-small, .k-page.opp .step__note, .k-page.opp .tags-foot { word-break:keep-all;overflow-wrap:break-word;overflow-wrap:anywhere; }
.k-page.opp .empty > .k-small { max-width:300px; }
/* 标签名不再一行省略（窄屏放不下就换行） */
.k-page.opp .tag .tag__name { white-space:normal;overflow:visible;text-overflow:clip; }
/* ===================================================================================================
   11-19 第四轮返修（独立复评；只动样子）
   =================================================================================================== */
/* 2 匹配原因只在标点处断行（「匹配原因：做过民宿前台接待，」/「会用订房系统」），不再末行掉一个「统」 */
.k-page.opp .job__why { word-break:keep-all;overflow-wrap:break-word;overflow-wrap:anywhere; }
/* 列表里的「一键报名」退成 40 高浅棕软按钮（暖棕实心只留给报名页底部那一颗） */
.k-page.opp .job :deep(.k-button.is-primary) { height:40px;border:0;background:var(--k-red-soft);box-shadow:none;color:var(--k-red-deep);font-weight:600; }
.k-page.opp .job :deep(.k-button.is-primary .k-button__label) { color:var(--k-red-deep); }
.k-page.opp .job :deep(.k-button.is-outline) { height:40px; }
/* 3 直接进入、没有岗位：骨架条是静止的浅线色空位，「匹配」保持角标形状（白底 + 发丝边） */
.k-page.opp .apply-job.is-empty::before, .k-page.opp .apply-job.is-empty::after { background:var(--k-line);animation:none; }
.k-page.opp .apply-job.is-empty > .match { background:var(--k-paper);border:1px solid var(--k-line);box-sizing:border-box; }
/* 4 推荐行：匹配角标挪到缩略图左下角，不再压住占位图里的图片图标 */
.k-page.opp .rec .rec__tag { top:59px; }
/* 整页空状态的按钮和出错页一套（248 × 44 主按钮，见上），这里不再改 */
@media (max-width:359px) {
  .k-page.opp .rec .rec__tag { top:55px; }
}
/* ===================================================================================================
   11-19 微信实拍返修（只动样子）
   =================================================================================================== */
/* 1 技能标签云：「你的原始文本」和「技能标签」一套区块标题 —— 都在卡外、16 / 700 墨色、和页首说明同一条左线，标题到卡 12；原文放进下面的白卡（内边距 16）
   页首说明宽度定在 18 个字：固定在「，」处断成两行（不再第二行只挂「（不替代原文）」） */
.k-page.opp .intro { padding:0; }
.k-page.opp .intro__text { flex:0 1 auto;max-width:calc(18em + 6px); }
.k-page.opp .intro + .raw { margin-top:16px; }
.k-page.opp .raw { padding:0;border:0;border-radius:0;background:transparent;box-shadow:none; }
.k-page.opp .raw .k-title { font-size:16px;font-weight:700;line-height:22px;color:var(--k-ink); }
.k-page.opp .raw__box { margin-top:12px;padding:16px;border-radius:12px;background:var(--k-paper); }
/* 3 一键报名：步骤号回到 18 浅棕圆 + 深棕字（一屏只留底部一颗暖棕实心按钮） */
.k-page.opp .step__num { width:18px;height:18px;border-radius:50%;background:var(--k-red-soft);color:var(--k-red-deep);font-size:11px;font-weight:600; }
.k-page.opp .step__num text { color:var(--k-red-deep); }
</style>
