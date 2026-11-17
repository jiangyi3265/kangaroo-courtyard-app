// 2026-10-18 晚主人大批反馈「找机会」一节（A1–A9）的回归（node --test，不需要构建、不发请求）：
//   · 报名 7 步进度（提交资料 → 确认信息 → 约定视频时间 → 签署安全协议 → 订票确认 → 进入地区群 → 到店确认），报名页、进度页同一套，按报名真实状态点亮；
//   · 报名页用「我的简历」投递：到岗时间默认 = 岗位开始日、更早的选不了；预计时长默认 = 最短期限（30 天 =「一个月」），只能更长；
//   · 寻伴同行页：标题按岗位类型（做换工 / 做兼职 / 去工作）、四种分享方式、复制出去的那段话、发到「找搭子」带的参数；
//   · 选城市联想里的景区片区（大理古城 → 大理）；全职旅行列表顶上的培训活动横幅；岗位卡片标签一行排齐、角标小旗。
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'
import test from 'node:test'
import assert from 'node:assert/strict'
import * as F from '../pages/jobs/apply-flow.js'
import * as T from '../pages/jobs/team-page.js'
import * as J from '../pages/jobs/job-filters.js'
import * as SP from '../pages/jobs/store-page.js'
import * as CAL from '../common/calendar.js'

const APP = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const require = createRequire(path.join(APP, 'package.json'))
const compiler = require('@vue/compiler-sfc')
const src = (rel) => fs.readFileSync(path.join(APP, rel), 'utf8').replace(/\r\n/g, '\n')
const sfc = (rel) => compiler.parse(src(rel), { filename: rel }).descriptor
const css = (rel) => sfc(rel).styles.map(s => s.content).join('\n')

// ---------------------------------------------------------------- 7 步进度

test('7 步进度：名字、两行写法和报名状态对应的当前步（已结束的整条不亮，订票 / 进群不假装做过）', () => {
  assert.deepEqual(F.FLOW_STEPS, ['提交资料', '确认信息', '约定视频时间', '签署安全协议', '订票确认', '进入地区群', '到店确认'])
  assert.deepEqual(F.FLOW_LINES.map(l => l.join('')), F.FLOW_STEPS)
  assert.equal(F.FLOW_DONE, 8)
  const cases = {
    submitted: 2, review_rejected: 2, review_passed: 3, interview_booked: 3,
    interview_done: 4, user_confirmed: 4, store_confirmed: 4, contract_signed: 5, onboarded: 8,
    withdrawn: 0, terminated: 0, weird_new_status: 0, '': 0
  }
  for (const [status, step] of Object.entries(cases)) assert.equal(F.flowStepOf(status), step, status)
  // 签了协议以后停在「订票确认」：系统里没有订票、进群的记录，一句话说清楚是和主理人确认
  assert.match(F.flowHint('contract_signed'), /填写车票和到店信息/)
  assert.match(F.flowHint('contract_signed'), /“保险与地区群”查看群码/)
  assert.equal(F.flowHint('nope'), '')
  for (const s of ['submitted', 'review_passed', 'interview_booked', 'store_confirmed', 'onboarded']) assert.ok(F.flowHint(s), s)
})

test('进度页（到店岗位）用同一套 7 步，按状态换算；线上任务照旧是交付六步', () => {
  const p = src('pages/jobs/progress.vue')
  assert.match(p, /<view v-if="\(detail \|\| designMode\) && !isOnline" class="steps steps--flow"><job-flow-steps :current="current" :arrival-enabled="canOpenArrival" @arrival="openArrival" \/><text v-if="flowTip" class="steps__tip">\{\{ flowTip \}\}<\/text><\/view>/)
  assert.match(p, /<view v-else-if="detail \|\| designMode" class="steps"><k-steps :steps="stepNames" :current="current" \/><\/view>/)
  assert.match(p, /if \(detail\.value\) return flowStepOf\(detail\.value\.status\)/)
  assert.match(p, /import JobFlowSteps from '\.\/components\/job-flow-steps\.vue'/)
  // 报名页：第 1 步（投递成功后第 2 步亮起来）；线上任务不出
  const a = src('pages/jobs/apply.vue')
  assert.match(a, /<view v-if="!closedReason && jobType && !isOnline" class="ap-card ap-flow"><job-flow-steps :current="saved \? 2 : 1" \/><\/view>/)
  // 组件：7 个点、名字两行；current 0 = 都不亮
  const c = sfc('pages/jobs/components/job-flow-steps.vue')
  assert.match(c.template.content, /<view v-for="\(lines, i\) in stepLines" :key="i" class="jfs__item" :class="\[stateOf\(i \+ 1\),/)
  assert.match(c.scriptSetup.content, /n === 7 && props.arrivalEnabled/)
  assert.match(c.scriptSetup.content, /props\.current <= 0 \? 'todo'/)
  for (const m of c.styles.map(s => s.content).join('\n').matchAll(/font-size: (\d+)px/g)) assert.ok(Number(m[1]) >= 9, m[0])
})

// ---------------------------------------------------------------- 报名页：到岗时间 / 预计时长 / 简历

test('到岗时间：默认 = 岗位开始日期（只取年月日，不按时区换算）；开始日已过就是今天；草稿里的日期还有效才用', () => {
  assert.equal(F.arrivalStart('2026-10-25T00:00:00.000-08:00', '2026-10-18'), '2026-10-25')
  assert.equal(F.arrivalStart('2026-10-01', '2026-10-18'), '2026-10-18')
  assert.equal(F.arrivalStart('', '2026-10-18'), '2026-10-18')
  assert.equal(F.defaultArrival('2026-10-25', '2026-10-18'), '2026-10-25')
  assert.equal(F.defaultArrival('2026-10-25', '2026-10-18', '2026-11-02'), '2026-11-02')
  assert.equal(F.defaultArrival('2026-10-25', '2026-10-18', '2026-10-20'), '2026-10-25', '草稿日期早于开始日：不用')
  assert.equal(F.arrivalText('2026-10-25'), '10月25日 周日')
  assert.equal(F.arrivalText(''), '')
  // 页面（2026-10-19 复查）：到岗时间点开是月历 k-date-picker，min-date 就是这一天，默认选中它、更早的日子置灰点不了；
  // 之前的原生日期滚轮在网页版从 1876 年起都能滚，小程序里也看不出灰色。确定后再挡一次（草稿里的旧日期）
  const a = src('pages/jobs/apply.vue')
  assert.doesNotMatch(a, /<picker mode="date"/)
  assert.match(a, /<view class="ap-row" hover-class="k-press-s" @click="arrivalOpen = true">/)
  assert.match(a, /<k-date-picker v-if="arrivalOpen" title="选择到岗时间" :value="arrival" :min-date="minArrival" @cancel="arrivalOpen = false" @confirm="onArrival" \/>/)
  assert.match(a, /if \(v < minArrival\.value\) \{ toast\(/)
  // 月历：开始日（10-25）之前的格子 disabled（置灰），开始日和之后的能点
  const cells = CAL.monthDays('2026-10-25', F.arrivalStart('2026-10-25', '2026-10-18'))
  const cell = (d) => cells.find(c => c.date === d)
  assert.equal(cell('2026-10-24').disabled, true)
  assert.equal(cell('2026-10-19').disabled, true)
  assert.equal(cell('2026-10-25').disabled, false)
  assert.equal(cell('2026-10-31').disabled, false)
})

test('预计时长：默认 = 最短期限（30 →「一个月」）；选项不给比最短期限短的；自己填的天数同样不能短、最多 365', () => {
  assert.equal(F.defaultDuration(30), 30)
  assert.equal(F.durationLabel(30), '一个月')
  assert.equal(F.durationLabel(15), '半个月')
  assert.equal(F.durationLabel(20), '20天')
  assert.equal(F.defaultDuration(0, 'volunteer'), 30)
  assert.equal(F.defaultDuration(null, 'parttime'), 7)
  assert.equal(F.defaultDuration(undefined, 'fulltime'), 90)
  assert.deepEqual(F.durationOptions(30).map(o => o.label), ['一个月', '两个月', '三个月', '半年'])
  assert.deepEqual(F.durationOptions(20).map(o => o.days), [20, 30, 60, 90, 180], '最短期限不在常用档里时单独放第一个')
  assert.deepEqual(F.durationOptions(0).map(o => o.days), [7, 15, 30, 60, 90, 180], '没写最短期限：只给常用档')
  for (const min of [1, 7, 20, 30, 45, 200]) assert.ok(F.durationOptions(min).every(o => o.days >= min), String(min))
  // 2026-10-19：胶囊每行排满、一样宽 —— 最多 6 个（不到一周的最短期限去掉「半年」，用「其他天数」填），列数按个数定；「其他天数」另起一整行
  assert.deepEqual(F.durationOptions(3).map(o => o.days), [3, 7, 15, 30, 60, 90])
  for (let min = 0; min <= 366; min++) {
    const n = F.durationOptions(min).length
    const cols = F.durationColumns(n)
    assert.ok(n >= 1 && n <= F.DURATION_MAX_OPTIONS, 'min ' + min + ': ' + n + ' 个')
    assert.equal(n % cols, 0, 'min ' + min + '：' + n + ' 个排 ' + cols + ' 列，最后一行没排满')
    assert.ok(cols <= 5, 'min ' + min + '：一行最多 5 个')
  }
  const ap = sfc('pages/jobs/apply.vue')
  assert.match(ap.template.content, /<view class="ap-durs" :class="'ap-durs--' \+ durCols">\s*<view v-for="opt in durations"[^\n]*<\/view>\s*<\/view>\s*<view class="ap-other" :class="\{ on: customDays \}" hover-class="k-press-s" @click="askDays">/)
  assert.doesNotMatch(ap.template.content, /class="ap-dur"[^>]*@click="askDays"/, '「其他天数」不再挤在胶囊里')
  const apCss = ap.styles.map(s => s.content).join('\n')
  for (const c of [1, 2, 3, 5]) assert.match(apCss, new RegExp('\\.ap-durs--' + c + ' \\{ grid-template-columns: '))
  assert.deepEqual(F.checkDuration('40', 30), { ok: true, days: 40 })
  assert.equal(F.checkDuration('20', 30).ok, false)
  assert.match(F.checkDuration('20', 30).message, /最短要待 30 天/)
  assert.equal(F.checkDuration('400', 30).ok, false)
  assert.equal(F.checkDuration('3.5', 0).ok, false)
  assert.equal(F.checkDuration('', 0).ok, false)
})

test('我的简历卡：有简历 / 缺项 / 没有简历三种；账号绑了手机也算有手机；手机打码；技能摘要优先用归类出的标签', () => {
  const full = F.resumeCard({ resume: { name: '小林', age: 24, phone: '13812345678', city: '大理', gender: '女', skillText: '会做咖啡' }, tags: [{ name: '咖啡制作' }, { name: '摄影' }], completeness: 80 })
  assert.deepEqual([full.exists, full.ready, full.missing, full.phone, full.skills, full.age], [true, true, [], '138****5678', '咖啡制作 · 摄影', '24'])
  const noAge = F.resumeCard({ resume: { name: '小林', phone: '' } }, { accountPhone: '13900001111' })
  assert.deepEqual([noAge.ready, noAge.missing, noAge.phone], [false, ['年龄'], '139****1111'])
  // 线上任务不要年龄
  assert.equal(F.resumeCard({ resume: { name: '小林', phone: '13812345678' } }, { online: true }).ready, true)
  // 从没建过简历（服务端用账号资料凑的 isNew 行）：exists = false，页面出「先去填写」
  const fresh = F.resumeCard({ resume: { isNew: true, name: '微信用户', phone: '13812345678' } })
  assert.deepEqual([fresh.exists, fresh.ready], [false, false])
  assert.equal(F.resumeCard(null).exists, false)
  // 技能没归出标签时截原文
  assert.equal(F.resumeCard({ resume: { name: 'a', age: 20, phone: '13812345678', skillText: '一二三四五六七八九十一二三四五六七八九十一二三四五六七八九十' } }).skills.length, 29)
  assert.equal(F.maskPhone('123'), '')
})

test('报名页：不再单独填姓名 / 年龄 / 手机 / 技能，用简历投递；没有简历去「我的 → 简历」，回来自动刷新', () => {
  const a = src('pages/jobs/apply.vue')
  const tpl = sfc('pages/jobs/apply.vue').template.content
  assert.doesNotMatch(tpl, /<k-field[^>]*form\.(name|age|phone|skills)/, '没有姓名 / 年龄 / 手机 / 技能输入框了')
  assert.match(tpl, /<text class="ap-empty__title">还没有简历，先去填写<\/text>/)
  assert.match(tpl, /<text class="ap-empty__text">只填一次，以后报名直接确认投递<\/text>/)
  assert.match(tpl, /<text>修改简历<\/text>/)
  assert.match(a, /const openResume = \(\) => \{ resumeOpened = true; go\(R\.resume\) \}/)
  assert.match(a, /if \(resumeOpened \|\| \(resumeState\.value === 'guest' && experience\.account\)\) \{ resumeOpened = false; loadResume\(\) \}/)
  // 提交：线下只带到岗日期和天数，线上只带接单说明（姓名 / 手机由服务端从简历取）
  assert.match(a, /\.\.\.\(!isOnline\.value \? \{ arrival: arrival\.value, days: days\.value \} : \{ note: note\.value \}\),/)
  assert.match(tpl, /:label="saved \? '查看审核进度' : submitting \? '提交中…' : \(isOnline \? '确认提交申请' : '确认投递'\)"/)
})

// ---------------------------------------------------------------- 寻伴同行

test('寻伴同行：标题按类型（做换工 / 做兼职 / 去工作）；四种分享方式；复制的话不编打不开的链接；发到找搭子带上岗位关联', () => {
  assert.deepEqual(T.teamHeadline('volunteer', '大理'), { line1: '找个搭子，', line2: '一起去大理做换工' })
  assert.deepEqual(T.teamHeadline('parttime', '湘潭·湖南省'), { line1: '找个搭子，', line2: '一起去湘潭做兼职' })
  assert.deepEqual(T.teamHeadline('fulltime', '杭州'), { line1: '找个搭子，', line2: '一起到杭州去工作' })
  assert.deepEqual(T.teamHeadline('volunteer', ''), { line1: '找个搭子，', line2: '一起去做换工' })
  assert.equal(T.TEAM_SUBTITLE, '分享岗位，约同行，结伴出发更安心')
  assert.deepEqual(T.TEAM_SAFETY, ['平台已核验门店', '部分岗位含保险', '结伴报名更安心'])
  assert.deepEqual(T.SHARE_WAYS.map(w => w.title), ['小程序搭子社区', '微信好友 / 微信群', '微信朋友圈', '复制链接'])
  assert.deepEqual(T.SHARE_WAYS.map(w => w.desc), ['发到站内搭子墙，快速找同行', '转发小程序卡片，直接约朋友', '生成分享海报，公开招募搭子', '复制岗位链接，发到任意地方'])
  // 图标都在主包的 icons.js 里
  const icons = src('common/icons.js')
  for (const w of T.SHARE_WAYS) assert.ok(icons.includes('"' + w.icon + '":'), w.icon)
  assert.equal(T.jobPath(15), '/pages/jobs/detail?jobId=15')
  assert.equal(T.shareCopyText({ title: '南舍庄园', city: '平潭', jobId: 15, href: 'https://h5.test/#/pages/jobs/team?jobId=15' }), '【袋鼠全球青年】南舍庄园｜平潭 https://h5.test/#/pages/jobs/detail?jobId=15')
  const copied = T.shareCopyText({ title: '南舍庄园', city: '平潭', jobId: 15 })
  const target = new URL(copied.slice(copied.indexOf('https://')))
  assert.equal(target.origin, 'https://daishu.oksja.cn')
  assert.equal(target.hash, '#/pages/jobs/detail?jobId=15', '小程序复制的公开链接准确指向当前岗位')
  assert.equal(T.buddyPublishQuery({ jobId: 15, title: '南舍庄园', city: '平潭' }), 'kind=buddy&linkType=job&linkId=15&linkTitle=' + encodeURIComponent('南舍庄园') + '&linkCity=' + encodeURIComponent('平潭'))
})

test('寻伴同行页：保留岗位分享方式，伙伴入口统一打开独立同行页', () => {
  const d = sfc('pages/jobs/team.vue')
  const t = d.template.content
  assert.match(t, /\{\{ head\.line1 \}\}\{\{ head\.line2 \}\}/)
  assert.match(t, /src="\/static\/media\/brand-kangaroo\.png"/)
  assert.match(t, /<button class="tm-job__share" :open-type="jobReady \? 'share' : ''" :disabled="!jobReady"/)
  assert.match(t, /<button v-for="way in SHARE_WAYS" :key="way\.key" class="tm-way" :open-type="jobReady && isMp && way\.key === 'wechat' \? 'share' : ''" :disabled="!jobReady" hover-class="k-press-s" @click="tapWay\(way\.key\)">/)
  assert.match(t, /<view v-if="teamLoaded" class="tm-cta"[^>]*@click="openCompanions"/)
  assert.match(t, /<view v-if="badgeText" class="tm-job__chip">/)
  const s = d.scriptSetup.content
  assert.match(s, /const titles = \['寻伴同行', '寻伴同行', '分享海报', '商家评价'\]/)
  assert.match(s, /if \(key === 'community'\) return go\(R\.publish \+ '\?' \+ buddyPublishQuery\(/)
  assert.match(s, /if \(key === 'moments'\) \{ s\.value = 3; return \}/)
  assert.match(s, /onShareAppMessage\(\(\) => jobReady\.value \? \(\{ title: [^\n]*path: jobPath\(jobId\.value\)/)
  // 角标文字：「袋鼠实地探访·含保险」只在真的实地探访 + 含保险时挂（同行接口没有这些字段，另取岗位详情）
  assert.match(s, /const BADGE_TEXT = \{ assured: '袋鼠实地探访·含保险', onsite: '袋鼠实地探访', online: '袋鼠线上采访' \}/)
  // 最新设计稿按钮叫「找人一起去」，仍进入现有寻伴同行页并携带岗位编号。
  assert.match(src('pages/jobs/detail.vue'), /label="找人一起去" @click="openTeam"/)
  assert.match(src('pages/jobs/detail.vue'), /const openTeam = \(\) => go\(R\.jobTeam \+ '\?jobId=' \+ jobId\.value\)/)
  for (const m of css('pages/jobs/team.vue').slice(0, css('pages/jobs/team.vue').indexOf('/* ---------------- 3 海报')).matchAll(/font-size: (\d+)px/g)) assert.ok(Number(m[1]) >= 11, m[0])
})

// ---------------------------------------------------------------- 列表：城市联想 / 培训横幅 / 卡片

test('选城市联想：景区片区（大理古城 → 大理）跟在同名城市后面，选它就是选所属城市；城市名对得上字典', () => {
  assert.deepEqual(J.scenicSuggest('大理').map(x => x.name), ['大理古城', '双廊', '喜洲古镇', '洱海'])
  assert.deepEqual(J.scenicSuggest('古城'), [{ name: '大理古城', city: '大理' }, { name: '丽江古城', city: '丽江' }])
  assert.deepEqual(J.scenicSuggest(''), [])
  assert.ok(J.scenicSuggest('丽江').length <= 6)
  for (const [name, city] of J.SCENIC_AREAS) assert.notEqual(name, city)
  const panel = src('pages/jobs/components/job-city-panel.vue')
  assert.match(panel, /@click="toggle\(rowItem\.pick \|\| rowItem\.name\)"/)
  assert.match(panel, /<text v-if="rowItem\.scenic" class="cp-row__kind">景区片区<\/text>/)
})

test('全职旅行列表顶上的培训活动横幅：后台配了才出，按已选城市取，点了去活动详情报名', () => {
  const l = src('pages/jobs/list.vue')
  assert.match(l, /<view v-if="s === 3 && training" class="train" hover-class="k-press-s" @click="openTraining">/)
  assert.match(l, /if \(!append && type === 'fulltime'\) loadTraining\(\)/)
  assert.match(l, /apiJobTrainingBanner\(key\)/)
  assert.match(l, /const openTraining = \(\) => \{ if \(training\.value\) go\(R\.activity \+ '\?id=' \+ training\.value\.id\) \}/)
  assert.match(src('common/api.js'), /export const apiJobTrainingBanner = \(cities\) => get\('\/app\/job\/training-banner', \{ cities: cities \|\| undefined \}\)/)
})

test('岗位卡片：真实标签与待遇分区；长文本可换行、宽度受限，保留45度角标', () => {
  const l = sfc('pages/jobs/list.vue')
  const t = l.template.content
  // 新版已将食宿 / 工时移到 facts，休息 / 房型 / 保障移到 details；状态和关键词仍必须显示。
  assert.match(t, /class="tags card__tags"/)
  assert.match(t, /v-for="flagItem in job\.flags"/)
  assert.match(t, /v-if="job\.redpacket"/)
  assert.match(t, /v-for="tagText in job\.keywordTags"/)
  assert.match(t, /v-for="factItem in job\.facts"/)
  assert.match(t, /v-for="detailItem in job\.details"/)
  assert.doesNotMatch(t, /class="conds"/)
  // 检查包含 list-premium.scss 覆盖后的规则，不能只读已被覆盖的旧24px高样式。
  const sass = require('sass'), postcss = createRequire(require.resolve('vite/package.json'))('postcss')
  const cssRoot = postcss.parse(sass.compileString(l.styles.map(s => s.content).join('\n'), { loadPaths: [path.join(APP, 'pages/jobs')] }).css)
  const style = (...selectors) => {
    const properties = {}
    cssRoot.walkRules(rule => {
      if (rule.parent.type === 'atrule' || !selectors.some(selector => rule.selectors.includes(selector))) return
      rule.walkDecls(decl => { properties[decl.prop] = decl.value })
    })
    return properties
  }
  assert.equal(style('.tags', '.card__tags')['flex-wrap'], 'wrap')
  assert.equal(style('.card__keywords')['flex-wrap'], 'wrap')
  const tag = style('.tag', '.card .tag')
  assert.equal(tag['max-width'], '100%')
  assert.equal(tag.height, 'auto')
  assert.equal(tag['white-space'], 'normal')
  assert.equal(tag['overflow-wrap'], 'anywhere')
  assert.ok(parseFloat(tag['min-height']) > 0 && parseFloat(tag['border-radius']) > 0)
  assert.equal(style('.card__fact')['min-width'], '0')
  assert.equal(style('.card__fact text')['overflow-wrap'], 'anywhere')
  assert.equal(style('.title', '.card .title')['overflow-wrap'], 'anywhere')
  assert.match(t, /<job-badge size="ribbon" \/>/)
  const b = sfc('pages/jobs/components/job-badge.vue')
  assert.match(b.template.content, /<view v-if="size === 'card'" class="jb__fold" \/>/)
  assert.match(b.template.content, /<view v-if="size !== 'detail' && size !== 'ribbon'" class="jb__seal"><image class="jb__icon" src="\/static\/media\/brand-kangaroo\.png" mode="aspectFit" \/><\/view>/)
  assert.match(css('pages/jobs/components/job-badge.vue'), /\.jb--ribbon \{[^}]*transform: rotate\(-45deg\)/)
})

test('全职岗位详情的「工作待遇」：填了试用期、培训才写这两行；兼职 / 换宿不写', () => {
  const ft = SP.welfareCard({ jobType: 'fulltime', compensationText: '5000 元/月', probation: '1个月', trainDesc: '带薪培训 7 天' }, {})
  assert.equal(ft.title, '工作待遇')
  assert.deepEqual(ft.items, ['试用期：1个月', '培训：带薪培训 7 天'])
  assert.deepEqual(SP.welfareCard({ jobType: 'fulltime', compensationText: '5000 元/月', probation: ' ', trainDesc: '' }, {}).items, [])
  assert.deepEqual(SP.welfareCard({ jobType: 'parttime', compensationText: '150 元/天', probation: '1个月', trainDesc: '有' }, {}).items, [])
  // 只填了试用期、别的都没填的全职岗位，这张卡也出
  assert.deepEqual(SP.welfareCard({ jobType: 'fulltime', probation: '3个月' }, {}), { title: '工作待遇', highlights: [], items: ['试用期：3个月'] })
})
