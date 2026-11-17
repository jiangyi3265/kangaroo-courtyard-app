<template>
  <k-feature-gate feature="recruitment">
  <view class="k-page opp">
    <k-topbar :title="titles[s - 1]" back custom-back @back="onBack" />

    <!-- 1 AI 技能标签云 -->
    <view v-if="s === 1" class="k-body k-pad-tab">
      <view class="intro">
        <image class="intro__img" src="/pages/profile/static/opp-kangaroo.jpg" mode="aspectFit" />
        <text class="intro__text">按关键词把你写的技能归到下面的标签，可查看出处（不替代原文）</text>
      </view>

      <view class="raw k-mt8">
        <view class="k-between">
          <view class="k-row k-gap4"><text class="k-title">你的原始文本</text><text class="k-text k-muted">（不可替代）</text></view>
          <view class="k-row k-gap2" @click="go(R.resume + '?s=3')"><text class="ob k-small">查看全部</text><k-icon name="chevron-right" :size="14" color="#9A6A22" /></view>
        </view>
        <view class="raw__box k-mt10">
          <text class="raw__text">{{ rawText }}</text>
          <text class="k-small k-muted raw__count">{{ rawCount }}</text>
        </view>
      </view>

      <view class="k-between k-mt16">
        <view class="k-col" @click="openJobs"><text class="k-h2">技能标签（{{ tags.length }}）</text><text class="k-meta k-mt2">点标签看出处，点这里看匹配机会</text></view>
        <view @click="explain"><k-icon name="circle-help" :size="22" color="muted" :stroke="1.5" /></view>
      </view>

      <view class="k-grid-2 tags k-mt12">
        <view v-for="t in tags" :key="t.name" class="tag" :class="`is-${t.tone}`" @click="showSources(t)">
          <k-icon :name="t.icon" :size="26" :color="toneColor[t.tone]" :stroke="1.6" />
          <view class="k-flex1">
            <view class="k-between"><text class="tag__name">{{ t.name }}</text><text class="tag__pct">{{ t.pct }}</text></view>
            <view class="k-row k-gap2"><text class="tag__src">查看来源</text><k-icon name="chevron-right" :size="12" :color="toneColor[t.tone]" /></view>
          </view>
        </view>
      </view>
      <text class="k-meta k-mt16 b">标签按关键词规则生成，不替代你的原始经历与表达</text>
    </view>

    <!-- 2 技能匹配机会 -->
    <view v-else-if="s === 2" class="k-body k-pad-tab">
      <view class="hero">
        <view class="k-flex1 k-col">
          <text class="k-text hero__text">根据你的技能画像，找到适合你的机会</text>
          <image class="hero__kg" src="/pages/profile/static/opp-banner-kangaroo.jpg" mode="aspectFit" />
        </view>
        <image class="hero__stamp" src="/pages/profile/static/opp-stamp.jpg" mode="aspectFit" />
      </view>

      <!-- 10-19 复查：没有技能标签时不列「xx%匹配」的机会（百分比没有依据），换成请他去简历里写技能 -->
      <view v-for="job in (skillBased ? jobs : [])" :key="job.jobId" class="card job k-mt12">
        <view class="job__top">
          <image class="job__img" :src="job.img" mode="aspectFill" />
          <view class="k-flex1 k-col">
            <view class="k-between">
              <view class="k-row job__name"><text class="job__title">{{ displayWording(job.title, [job.storeName]) }}</text><text v-if="job.type" class="job__type">（{{ job.type }}）</text></view>
              <view class="match"><text>{{ job.match }}匹配</text></view>
            </view>
            <view v-if="job.place" class="k-row k-gap4 k-mt8"><k-icon name="map-pin" :size="14" color="muted" :stroke="1.6" /><text class="k-small k-muted">{{ job.place }}</text></view>
            <view class="k-row k-gap8 k-mt10 k-wrap"><view v-for="c in job.chips" :key="c.t" class="chip" :class="`is-${c.tone}`"><text>{{ c.t }}</text></view></view>
            <text v-if="job.reason" class="k-small k-green k-mt10 b">匹配原因：{{ job.reason }}</text>
            <view v-else class="k-row k-gap4 k-mt8"><text class="k-price">{{ job.price }}</text><text class="k-small k-muted">{{ job.unit }}</text></view>
          </view>
        </view>
        <!-- k-button 是虚拟节点组件：等分宽度放在外层 view 上 -->
        <view class="k-row k-gap10 k-mt12">
          <view class="k-flex1"><k-button block type="outline" size="md" class="btn-serif" label="查看详情" @click="openDetail(job)" /></view>
          <view class="k-flex1"><k-button block size="md" class="btn-serif" label="一键报名" @click="toApply(job)" /></view>
        </view>
      </view>
      <view v-if="jobsLoaded && !skillBased" class="empty"><text>还没有技能标签</text><text class="k-small k-muted">在简历里写一段技能描述（比如咖啡拉花、摄影修图、前台接待），就能按技能为你匹配机会</text><k-button type="secondary" size="sm" label="去写技能描述" @click="go(R.resume + '?s=3')" /></view>
      <view v-else-if="jobsLoaded && !jobs.length" class="empty"><text>暂时没有和你技能匹配的机会</text><text class="k-small k-muted">在简历里多写几项技能，或去岗位列表看看全部机会</text><k-button type="secondary" size="sm" label="去看全部岗位" @click="go(R.jobsList)" /></view>
    </view>

    <!-- 3 一键报名 -->
    <view v-else-if="s === 3" class="k-body k-pad-tab">
      <view class="card apply-job">
        <image class="apply-job__img" :src="picked ? picked.img : '/static/media/cover-empty.png'" mode="aspectFill" />
        <view class="k-flex1 k-col">
          <text class="apply-job__title">{{ displayWording(pickedTitle) }}</text>
          <text class="k-small k-muted k-mt6">{{ picked ? picked.place : '' }}</text>
          <view class="k-row k-gap4 k-mt8"><text class="k-price apply-job__price">{{ picked ? picked.price : '' }}</text><text class="k-text k-muted">{{ picked ? picked.unit : '' }}</text></view>
        </view>
        <view class="match">{{ picked ? picked.match : '' }}匹配</view>
      </view>

      <view class="card k-mt12">
        <view class="step"><view class="step__num"><text>1</text></view><text class="step__title">复用我的简历</text></view>
        <view class="resume-box k-mt10">
          <view class="k-row k-gap12">
            <image class="resume-box__avatar" :src="avatar" mode="aspectFill" />
            <view class="k-flex1 k-col"><text class="k-subtitle">{{ resumeName }}</text><text class="k-small k-muted k-mt4">{{ resumeUpdated }}</text></view>
            <view class="k-row k-gap2" @click="go(R.resume)"><text class="k-text">预览简历</text><k-icon name="chevron-right" :size="16" color="ink" /></view>
          </view>
          <view class="resume-box__foot"><view class="k-circle k-circle--green ok"><k-icon name="check" :size="11" color="white" :stroke="3" /></view><text class="k-text">称呼、年龄、电话和技能会填进报名表</text></view>
        </view>

        <view class="step k-mt16"><view class="step__num"><text>2</text></view><text class="step__title">到岗日期</text></view>
        <view class="k-input date k-mt10" :class="{ 'k-input--error': dateError }" @click="pickDate">
          <text class="k-flex1" :class="date ? '' : 'k-light'">{{ date || '请选择你可到岗的日期' }}</text>
          <k-icon name="calendar" :size="20" color="muted" :stroke="1.5" />
        </view>
        <text v-if="dateError" class="k-small k-alert k-mt6 b">请选择到岗日期</text>

        <!-- 之前不问停留几天，提交时替用户填成 max(7, 岗位最短天数)，门店看到的「可停留 14 天」并不是本人说的 -->
        <view class="step k-mt16"><view class="step__num"><text>3</text></view><text class="step__title">可停留天数</text></view>
        <view class="k-mt10"><k-field v-model="days" type="number" :maxlength="3" :placeholder="daysHint" :error="daysError" /></view>

        <view class="k-between k-mt16">
          <view class="step"><view class="step__num"><text>4</text></view><text class="step__title">相关经历</text><text class="k-text k-muted">（来自简历，门店审核时能看到）</text></view>
          <view class="k-row k-gap2" @click="go(R.resume + '?s=4')"><text class="k-small k-muted">编辑</text><k-icon name="chevron-right" :size="14" color="muted" /></view>
        </view>
        <view class="k-row k-gap10 k-mt12 k-wrap">
          <view v-for="e in exps" :key="e" class="exp"><text>{{ e }}</text></view>
        </view>
      </view>

      <view v-if="dateError || daysError" class="alert k-mt12">
        <view class="k-row k-gap6"><k-icon name="triangle-alert" :size="16" color="alert" :stroke="2" fill /><text class="alert__title">请完善以下信息后报名</text></view>
        <view v-if="dateError" class="k-between k-mt10"><view class="k-row k-gap8"><view class="alert__bullet" /><text class="k-text">请选择到岗日期</text></view><view class="k-dot" /></view>
        <view v-if="daysError" class="k-between k-mt10"><view class="k-row k-gap8"><view class="alert__bullet" /><text class="k-text">{{ daysError }}</text></view><view class="k-dot" /></view>
      </view>

      <k-button block class="k-mt12 btn-serif" :disabled="submitting || !legalRead || !agreed" :label="submitting ? '提交中…' : '一键报名'" @click="submit" />
      <view class="agree k-mt12" @click="toggleAgreement">
        <view class="k-check" :class="{ checked: agreed }"><k-icon v-if="agreed" name="check" :size="12" color="white" :stroke="3" /></view>
        <text class="k-small k-muted">已阅读并同意</text><text class="k-small agree__link" @click.stop="showTerms('用户协议')">《用户协议》</text><text class="k-small agree__link" @click.stop="showTerms('隐私政策')">《隐私政策》</text>
      </view>
    </view>

    <!-- 4 认证与赚钱机会 -->
    <view v-else class="k-body k-pad-tab">
      <view class="card card--tight">
        <view class="cert-head">
          <view class="k-row"><text class="k-title">{{ certTitle }}</text><text class="k-text k-muted">{{ cert ? '（' + (cert.level || '已认证') + '）' : '' }}</text></view>
          <view class="k-row k-gap2" @click="showCert"><text class="ob k-small">查看详情</text><k-icon name="chevron-right" :size="14" color="#9A6A22" /></view>
        </view>
        <view class="flow">
          <view v-for="(f, i) in flow" :key="f.label" class="flow__wrap">
            <view v-if="i > 0" class="flow__arrow"><view class="flow__line" /><k-icon name="chevron-right" :size="12" color="#B98A4A" :stroke="2" /></view>
            <view class="flow__item">
              <view class="flow__dot" :class="{ done: f.done }"><k-icon :name="f.icon" :size="20" color="white" :stroke="f.done ? 2.6 : 1.7" /></view>
              <text class="flow__label">{{ f.label }}</text>
            </view>
          </view>
        </view>
        <view class="grade">
          <view class="grade__col">
            <text class="k-text">考核等级</text>
            <view class="k-row k-gap8 k-mt6"><text class="grade__num">{{ cert ? cert.level || '—' : '—' }}</text><text class="k-text">级</text><view class="grade__chip"><text>{{ cert ? cert.grade || '通过' : '未认证' }}</text></view></view>
            <text class="k-meta k-mt8">{{ cert ? '颁发于 ' + cert.issuedDate : '参加门店培训考核后获得' }}</text>
          </view>
          <view class="grade__col grade__col--r">
            <view class="k-row k-gap8"><text class="k-text">综合评分</text><text class="grade__score">{{ cert && cert.score != null ? cert.score + '分' : '—' }}</text></view>
            <view class="k-row k-gap6 k-mt8"><k-icon v-for="n in 5" :key="n" name="star" :size="28" color="#C99043" :stroke="1.4" :fill="n <= certStars" /></view>
            <text class="k-small k-muted k-mt8">{{ cert ? '证书编号 ' + cert.certNo : '暂无考核记录' }}</text>
          </view>
        </view>
      </view>

      <view class="card k-mt12">
        <view class="k-between">
          <text class="k-title">已通过证书</text>
          <view class="k-row k-gap2" @click="showCert"><text class="ob k-small">查看证书</text><k-icon name="chevron-right" :size="14" color="#9A6A22" /></view>
        </view>
        <view v-if="cert" class="cert k-mt10">
          <image class="cert__img" src="/pages/profile/static/opp-cert.jpg" mode="aspectFit" />
          <view class="k-flex1 k-col k-gap4">
            <text class="k-subtitle">{{ cert ? cert.name : '' }}</text>
            <text class="k-small k-muted">颁发机构：{{ cert ? cert.issuer : '' }}</text>
            <text class="k-small k-muted">证书编号：{{ cert ? cert.certNo : '' }}</text>
          </view>
          <image class="cert__stamp" src="/pages/profile/static/opp-cert-stamp.jpg" mode="aspectFit" />
        </view>
      </view>

      <view class="card card--tight k-mt12">
        <text class="k-title rec-head">为你推荐的赚钱机会</text>
        <view v-for="(r, i) in recs" :key="r.jobId" class="rec" :class="{ 'has-line': i < recs.length - 1 }" @click="openDetail(r)">
          <image class="rec__img" :src="r.img" mode="aspectFill" />
          <view class="k-flex1 k-col">
            <view class="k-between">
              <view class="k-row job__name"><text class="rec__title">{{ displayWording(r.title, [r.storeName]) }}</text><text v-if="r.type" class="k-small k-muted">（{{ r.type }}）</text></view>
              <view v-if="r.tag" class="rec__tag" :style="{ background: r.tagColor }"><text>{{ r.tag }}</text></view>
            </view>
            <view class="k-between k-mt4">
              <view class="k-row k-gap3"><k-icon name="map-pin" :size="12" color="muted" :stroke="1.6" /><text class="k-meta">{{ r.place }}</text></view>
              <view class="k-row k-gap3 rec__price-wrap"><text class="rec__price">{{ r.price }}</text><text class="k-meta">{{ r.unit }}</text></view>
            </view>
            <text v-if="r.reason" class="k-meta k-mt4">推荐理由：{{ r.reason }}</text>
          </view>
        </view>
      </view>

      <view class="learn k-mt12" @click="learn">
        <image class="learn__img" src="/pages/profile/static/opp-tip-kangaroo.jpg" mode="aspectFit" />
        <text class="k-small k-muted k-flex1">持续学习与实践，提升等级，可解锁更多高收益机会</text>
        <view class="k-row k-gap2"><text class="ob k-small">去学习</text><k-icon name="chevron-right" :size="14" color="#9A6A22" /></view>
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
import { loadLegalVersions } from '@/pages/auth/legal-state.js'
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
  if (!legalRead.value) return toast('请分别打开用户协议和隐私政策，阅读至末尾')
  agreed.value = !agreed.value
}
const avatar = computed(() => (experience.account && experience.account.avatar ? absUrl(experience.account.avatar) : '/pages/profile/static/opp-avatar.jpg'))
const resumeName = computed(() => rd.value.resume.name || '未填写称呼')
const resumeUpdated = computed(() => `最近更新：${rd.value.updated || '—'}`)
const exps = computed(() => (rd.value.exps || []).slice(0, 3).map(e => [e.title, e.total].filter(Boolean).join(' ')))
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
.tag.is-ochre { background: #F4E8D2; }
.tag.is-indigo { background: #E7EDF1; }
.tag.is-gray { background: #ECE8E1; }
.tag__name { font-family: var(--k-serif); font-weight: 700; font-size: 17px; }
.tag__pct { font-size: 13px; }
.tag__src { font-size: 12px; }
.is-green .tag__name, .is-green .tag__pct, .is-green .tag__src { color: #3F6B56; }
.is-ochre .tag__name, .is-ochre .tag__pct, .is-ochre .tag__src { color: #9A6A22; }
.is-indigo .tag__name, .is-indigo .tag__pct, .is-indigo .tag__src { color: #40576B; }
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
.match { height: 26px; padding: 0 8px; border-radius: 6px; background: var(--k-green); color: #fff; font-size: 13px; font-weight: 600; display: flex; align-items: center; flex: 0 0 auto; }
.chip { height: 24px; padding: 0 8px; border-radius: 5px; font-size: 12px; display: flex; align-items: center; }
.chip.is-ochre { background: #F4E8D2; color: #9A6A22; }
.chip.is-indigo { background: #E7EDF1; color: #40576B; }
.chip.is-green { background: var(--k-green-soft); color: var(--k-green); }
.chip.is-gray { background: #ECE8E1; color: var(--k-ink2); }

/* s3 */
.apply-job { display: flex; align-items: flex-start; gap: 12px; padding: 12px; }
.apply-job__img { width: 96px; height: 96px; border-radius: 10px; flex: 0 0 auto; }
.apply-job__title { font-family: var(--k-serif); font-weight: 700; font-size: 16px; line-height: 1.4; }
.apply-job__price { font-size: 24px; }
.step { display: flex; align-items: center; gap: 8px; }
.step__num { width: 22px; height: 22px; border-radius: 50%; background: #B0864A; color: #fff; font-size: 12px; font-weight: 700; display: flex; align-items: center; justify-content: center; }
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
.rec__tag { height: 22px; padding: 0 8px; border-radius: 5px; color: #fff; font-size: 12px; display: flex; align-items: center; flex: 0 0 auto; }
.rec__price { color: var(--k-red); font-family: var(--k-sans); font-weight: 700; font-size: 16px; }
.learn { display: flex; align-items: center; gap: 10px; padding: 8px 12px; background: var(--k-paper2); border: 1px solid var(--k-line); border-radius: 12px; }
.learn__img { width: 34px; height: 34px; flex: 0 0 auto; }
</style>
