// 2026-11-03 主人：简化商家端（A-merchant-jobs 组，node --test，不需要构建、不发请求）。
// 守住这几件事：
//   M1  合作商家的岗位列表：不看四个指标、没有批量管理、不弹 5–6 项菜单；卡片只留状态 + 报名数，分享 / 暂停 / 恢复按状态直接摆在卡片上；
//       待上架的写「袋鼠工作人员正在完善，上架后通知你」；分享页只留链接 + 海报，不取追踪表。员工端照旧弹菜单、有「调整名额 / 紧急招募」；
//   M5  底栏已经写着「还差什么 / 可以提交」：点提交不再弹「确认提交？」，直接交、落到成功页；
//   M6  「帮我起草」不再要求先选到岗日期，没日期就不带；
//   M7  合作商家在「更多设置」里看不到「保险管理」和「安心商家认证」；
//   M10 商家看到的「换工主理人 / 商家服务人 / 城市负责人」一律叫「袋鼠工作人员」，进度条三步；
//   M12 商家被送回首页时有一句提示，toast 报错也不挡跳转。
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { createRequire } from 'node:module'
import test from 'node:test'
import assert from 'node:assert/strict'
import { pendingStaffRoute } from '../common/staff-scope.js'

const APP = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const require = createRequire(path.join(APP, 'package.json'))
const compiler = require('@vue/compiler-sfc'), vue = require('vue')
const src = (rel) => fs.readFileSync(path.join(APP, rel), 'utf8').replace(/\r\n/g, '\n')
const sfc = (rel) => compiler.parse(src(rel), { filename: rel }).descriptor
const salary = await import(pathToFileURL(path.join(APP, 'common/job-salary.js')).href)
const gender = await import(pathToFileURL(path.join(APP, 'common/job-gender.js')).href)
const view = await import(pathToFileURL(path.join(APP, 'pages/staff/request-view.js')).href)
const tpls = await import(pathToFileURL(path.join(APP, 'pages/staff/job-templates.js')).href)
const logic = await import(pathToFileURL(path.join(APP, 'pages/staff/merchant-request-logic.js')).href)
const plain = (v) => JSON.parse(JSON.stringify(v))
const flush = () => new Promise(resolve => setImmediate(resolve))

/** 在沙箱里跑页面的 script setup：导入一律先给永远不返回的函数，再用 stubs 覆盖用得到的那几个 */
function runSetup(rel, stubs) {
  const d = sfc(rel)
  const source = d.scriptSetup.content
  const ast = compiler.babelParse(source, { sourceType: 'module' })
  const body = ast.program.body.filter(n => n.type !== 'ImportDeclaration').map(n => source.slice(n.start, n.end)).join('\n')
  const sandbox = { console, setTimeout, clearTimeout }
  for (const n of ast.program.body.filter(n => n.type === 'ImportDeclaration')) for (const s of n.specifiers) sandbox[s.local.name] = () => new Promise(() => {})
  Object.assign(sandbox, { ref: vue.ref, computed: vue.computed, watch: vue.watch, reactive: vue.reactive, onShow() {}, onHide() {}, onUnload() {}, onUnmounted() {}, onMounted() {} }, gender, stubs)
  vm.createContext(sandbox)
  const scope = vue.effectScope()
  scope.run(() => vm.runInContext(body, sandbox, { filename: rel + ':script-setup' }))
  return { run: code => vm.runInContext(code, sandbox), stop: () => scope.stop(), template: d.template.content, sandbox, styles: d.styles.map(x => x.content).join('\n') }
}

const R = { staffOnline: '/pages/staff/online-jobs', staffJobs: '/pages/staff/jobs', staff: '/pages/staff/index' }
const PHOTO = '/profile/upload/2026/11/03/a.jpg'
const ROWS = [
  { jobId: 1, title: '前台换工', jobType: 'volunteer', status: 'published', statusLabel: '招聘中', apply: 3, images: [PHOTO] },
  { jobId: 2, title: '周末吧台', jobType: 'parttime', status: 'paused', statusLabel: '已暂停', apply: 1, images: [PHOTO] },
  { jobId: 3, title: '民宿管家', jobType: 'fulltime', status: 'draft', statusLabel: '换工主理人完善中', apply: 0, images: [] },
  { jobId: 4, title: '旧岗位', jobType: 'volunteer', status: 'closed', statusLabel: '已关闭', apply: 0, images: [] }
]

function jobsHarness({ merchant = false, rows = ROWS, missing = 3 } = {}) {
  const log = { created: [], describes: [], batches: [], toasts: [], sheets: [], confirms: 0, gone: [], stats: 0, shares: [] }
  let onLoad = null
  const s = vue.ref(1)
  const h = runSetup('pages/staff/jobs.vue', {
    useScreen: (n, opts) => { onLoad = opts && opts.onLoad; return s },
    onShareAppMessage() {}, ensureSession: async () => {}, hasStaffAccess: { value: true }, merchantStaff: { value: merchant },
    currentStaffStoreId: () => 102, selectStaffStore: async () => {}, staffCan: () => true, absUrl: x => 'https://api.test' + x,
    todayCn: () => '2026-11-03', shiftDate: () => '2026-11-10', isYmd: (v) => /^\d{4}-\d{2}-\d{2}$/.test(String(v || '')),
    validateSalaryForm: salary.validateSalaryForm, salaryPayload: salary.salaryPayload, jobBenefits: salary.jobBenefits,
    parseSalaryAmount: salary.parseSalaryAmount, SALARY_OPTIONS: salary.SALARY_OPTIONS, salaryOption: salary.salaryOption,
    MERCHANT_JOBS_API: view.MERCHANT_JOBS_API, draftJobForm: view.draftJobForm,
    templatesOf: tpls.templatesOf, applyTemplate: tpls.applyTemplate, mergeLastJob: tpls.mergeLastJob, undoPatch: tpls.undoPatch,
    toast: (m) => log.toasts.push(m), go: (u) => log.gone.push(u), back() {}, errText: (e, d) => (e && e.message) || d, R,
    confirm: async () => { log.confirms++; return true }, alert: async () => {}, prompt: async () => null,
    sheet: async (opts) => { log.sheets.push([...opts]); return -1 },
    apiStaffJobs: async () => ({ data: { rows, canEdit: true, storeCert: false, storeAddress: '平潭海边', conditionsMissingCount: missing, conditionsMissingJob: missing ? { jobId: 1 } : null } }),
    apiStaffBatchJobs: async (storeId, ids, action) => { log.batches.push([ids, action]); return { msg: '已处理' } },
    apiStaffShareStats: async () => { log.stats++; return { data: {} } },
    apiStaffShareJob: async (jobId, channel) => { log.shares.push(channel); return { data: { link: 'https://x/' + jobId, shareCode: 'c' } } },
    apiStaffJobKeywords: async () => ({ data: ['咖啡', '接待'] }),
    apiJobKinds: async () => ({ data: [{ value: 'daily', label: '日常换工', desc: '' }] }),
    apiStaffDescribeJob: async (storeId, payload) => { log.describes.push(plain(payload)); return { data: { title: '海边民宿前台换工', work: '接待客人', hope: '有责任心', variant: 0 } } },
    apiStaffCreateJob: async (storeId, payload) => { log.created.push(plain(payload)); return { msg: '已提交', data: { jobId: 777, message: '已提交，本城换工主理人会尽快完善并上架' } } },
    get: async () => ({ data: {} }), put: async () => ({}), post: async () => ({}),
    uni: { pageScrollTo() {}, showLoading() {}, hideLoading() {}, previewImage() {}, reLaunch() {} }
  })
  h.run('merchantAgreement.value = { confirm: async () => true }')
  return { ...h, s, log, load: async (q = {}) => { onLoad && onLoad(q); await flush(); await flush() } }
}

// ---------------------------------------------------------------- M1 列表
test('M1 商家列表：四个指标、批量管理、匹配率 / 分享访问都不出；卡片上按状态摆 分享 / 暂停 / 恢复；补条件提示不出', async (t) => {
  const h = jobsHarness({ merchant: true })
  t.after(h.stop)
  await h.load()
  assert.match(h.template, /<view v-if="!merchantStaff" class="metrics">/)
  assert.match(h.template, /<button v-if="!merchantStaff" :class="\{ off: !canEdit \}" @click="batchManage">/)
  assert.match(h.template, /<template v-if="!merchantStaff"><text>匹配率/)
  assert.match(h.template, /<view v-if="merchantStaff" class="job-acts" @click\.stop>/)
  // 原来点卡片弹 5–6 项菜单（1 点卡片 → 2 选菜单 → 3 操作）；现在一步：按钮就在卡片上
  const acts = (i) => plain(h.run('merchantActs(jobList.value[' + i + '])'))
  assert.deepEqual(acts(0), ['分享', '暂停'])
  assert.deepEqual(acts(1), ['分享', '恢复'])
  assert.deepEqual(acts(2), [])
  assert.deepEqual(acts(3), [])
  assert.equal(h.run('MERCHANT_DRAFT_TIP'), '袋鼠工作人员正在完善，上架后通知你')
  assert.match(h.template, /<text v-else-if="j\.rawStatus === 'draft'" class="job-acts__tip">\{\{ MERCHANT_DRAFT_TIP \}\}<\/text>/)
  // 暂停 / 恢复直接走原来的接口，不再经过菜单
  await h.run("merchantAct(jobList.value[0], '暂停')")
  await h.run("merchantAct(jobList.value[1], '恢复')")
  assert.deepEqual(plain(h.log.batches), [[[1], 'pause'], [[2], 'resume']])
  assert.equal(h.log.sheets.length, 0)
  // 补填筛选条件的提示：服务端说有 3 个，商家这边不出（也不去补）
  assert.equal(h.run('missingCount.value'), 0)
  assert.equal(h.run('missingJob.value'), null)
  // 按钮高度不低于 44
  assert.match(h.styles, /\.job-act\{[^}]*height:44px/)
  assert.match(h.styles, /\.job-card--merchant\{height:auto/)
})

test('M1 商家点卡片：上架的看详情，待上架的提示「袋鼠工作人员正在完善」，已关闭的说已关闭；jobActions 也不再弹菜单', async (t) => {
  const h = jobsHarness({ merchant: true })
  t.after(h.stop)
  await h.load()
  assert.match(h.template, /class="job-card" :class="\{ 'job-card--merchant': merchantStaff \}" hover-class="k-press-s" @click="cardTap\(j\)"/)
  await h.run('cardTap(jobList.value[0])')
  assert.deepEqual(h.log.gone, ['/pages/jobs/detail?jobId=1'])
  await h.run('cardTap(jobList.value[2])')
  assert.equal(h.log.toasts.at(-1), '袋鼠工作人员正在完善，上架后通知你')
  await h.run('cardTap(jobList.value[3])')
  assert.equal(h.log.toasts.at(-1), '岗位关闭后无法再操作')
  await h.run('jobActions(jobList.value[0])')
  assert.equal(h.log.sheets.length, 0)
  // 服务端给的状态字里的「换工主理人」在商家这边换成「袋鼠工作人员」
  assert.equal(h.run('jobList.value[2].status'), '袋鼠工作人员完善中')
})

test('M1 商家分享页：只留链接 + 海报，不取追踪表、不显示分享榜', async (t) => {
  const h = jobsHarness({ merchant: true })
  t.after(h.stop)
  await h.load()
  await h.run("merchantAct(jobList.value[0], '分享')")
  await flush()
  assert.equal(h.s.value, 4)
  assert.deepEqual(h.log.shares, ['link', 'friend'])
  assert.equal(h.log.stats, 0, '商家不取按员工 / 渠道的追踪表')
  await h.run('loadStats()')
  assert.equal(h.log.stats, 0)
  const share = h.template.slice(h.template.indexOf('class="share-page'), h.template.lastIndexOf('</template>'))
  assert.match(share, /<template v-if="!merchantStaff">[\s\S]*追踪维度[\s\S]*员工分享榜 TOP5[\s\S]*<\/template>/)
  assert.ok(share.indexOf('岗位链接') < share.indexOf('<template v-if="!merchantStaff">'), '链接和海报在商家也看得到的那段里')
})

test('M1 员工端不变：点卡片还是弹菜单，有「调整名额 / 紧急招募」；四个指标、批量管理、补条件提示都在；状态字不换', async (t) => {
  const h = jobsHarness({ merchant: false })
  t.after(h.stop)
  await h.load()
  await h.run('jobActions(jobList.value[0])')
  assert.ok(h.log.sheets.at(-1).includes('调整名额 / 紧急招募'), JSON.stringify(h.log.sheets.at(-1)))
  assert.ok(h.log.sheets.at(-1).includes('分享与追踪'))
  await h.run('cardTap(jobList.value[0])')
  assert.equal(h.log.sheets.length, 2, '员工点卡片走 jobActions')
  assert.equal(h.run('missingCount.value'), 3)
  assert.equal(h.run('jobList.value[2].status'), '换工主理人完善中')
  await h.run('loadStats()')
  assert.equal(h.log.stats, 1)
})

// ---------------------------------------------------------------- M5 / M6 / M7 发布表单
const openForm = async (t, merchant, kind = 'volunteer') => {
  const h = jobsHarness({ merchant })
  t.after(h.stop)
  await h.load()
  h.run(`startPublish(); choosePublish('${kind}')`)
  await flush()
  return h
}

test('M5 已确认商家协议后提交：直接交、落到成功页，不再弹额外确认框', async (t) => {
  for (const merchant of [true, false]) {
    const h = await openForm(t, merchant)
    h.run(`form.value.images = ['${PHOTO}']; setGen('title', '前台换工'); setGen('work', '接待客人')`)
    assert.equal(h.run('todoText.value'), '必填的都填好了，可以提交')
    await h.run('submitJob()')
    await flush()
    assert.equal(h.log.confirms, 0, '不弹确认框')
    assert.equal(h.log.created.length, 1)
    assert.equal(h.run('submitted.value.title'), '前台换工')
  }
  const code = sfc('pages/staff/jobs.vue').scriptSetup.content
  assert.doesNotMatch(code, /confirm\('提交(招募|审核)'/)
})

test('商家取消协议确认时不提交，表单保留且可重试', async t => {
  const h = await openForm(t, true)
  h.run(`form.value.images = ['${PHOTO}']; setGen('title', '前台换工'); setGen('work', '接待客人'); merchantAgreement.value = { confirm: async () => false }`)
  await h.run('submitJob()')
  assert.equal(h.log.created.length, 0)
  assert.equal(h.run('gen.value.title'), '前台换工')
  h.run('merchantAgreement.value = { confirm: async () => true }')
  await h.run('submitJob()')
  assert.equal(h.log.created.length, 1)
})

test('M5 成功页：商家看到的去向是「袋鼠工作人员」；进度条「已提交 → 袋鼠核实中 → 已上架」，员工的还是平台审核', async (t) => {
  const m = await openForm(t, true)
  assert.deepEqual(plain(m.run('FLOW_STEPS.value')), ['已提交', '袋鼠核实中', '已上架'])
  m.run(`form.value.images = ['${PHOTO}']; setGen('title', '前台换工'); setGen('work', '接待客人')`)
  await m.run('submitJob()')
  await flush()
  assert.equal(m.run('staffWording(submitted.value.message)'), '已提交，本城袋鼠工作人员会尽快完善并上架')
  assert.match(m.template, /staffWording\(submitted\.message\)/)
  assert.match(m.template, /merchantStaff \? '选一个板块填好提交，袋鼠工作人员核实后上架'/)
  const e = await openForm(t, false)
  assert.deepEqual(plain(e.run('FLOW_STEPS.value')), ['填写信息', '平台审核', '通过后公示'])
})

test('M6 帮我起草：不再要求先选到岗日期；没日期就不带（服务端不写到岗那句），有日期照带', async (t) => {
  const h = await openForm(t, true)
  h.run("form.value.startDate = ''")
  await h.run('generate()')
  await flush()
  assert.ok(!h.log.toasts.includes('请先选择到岗日期'))
  assert.equal(h.log.describes.length, 1)
  assert.equal(h.log.describes[0].startDate, '')
  assert.equal(h.run('gen.value.title'), '海边民宿前台换工')
  h.run("form.value.startDate = '2026-11-20'; gen.value = {}")
  await h.run('generate()')
  await flush()
  assert.equal(h.log.describes[1].startDate, '2026-11-20')
  // 提交时到岗日期照样必填
  h.run(`form.value.startDate = ''; form.value.images = ['${PHOTO}']; setGen('title', 'x'); setGen('work', 'y')`)
  assert.ok(h.run('todoKeys.value').includes('startDate'))
})

test('M7 更多设置：商家看不到「保险管理」链接和「安心商家认证」那行，项数少一项；员工照旧', async (t) => {
  const tpl = sfc('pages/staff/jobs.vue').template.content
  assert.match(tpl, /<view v-if="!merchantStaff" class="fc-act" hover-class="k-press" @click="goInsurance"><text>保险管理<\/text><\/view>/)
  assert.match(tpl, /<view v-if="!merchantStaff" class="fc-row" hover-class="k-press" @click="showCertification"><text class="fc-row__k">安心商家认证<\/text>/)
  const m = await openForm(t, true)
  const e = await openForm(t, false)
  assert.equal(m.run('moreCount.value'), e.run('moreCount.value') - 1)
})

// ---------------------------------------------------------------- M10 文案
test('M10 商家文案：staffWording 把三种内部角色都换成「袋鼠工作人员」；申请说明、首页提示里没有内部角色名', () => {
  assert.equal(logic.staffWording('待换工主理人核实'), '待袋鼠工作人员核实')
  assert.equal(logic.staffWording('已转商家服务人，城市负责人已知'), '已转袋鼠工作人员，袋鼠工作人员已知')
  assert.equal(logic.staffWording(null), '')
  assert.equal(logic.staffWording('已上架'), '已上架')
  const internal = /换工主理人|商家服务人|城市负责人/
  for (const k of Object.values(logic.APPLY_KINDS)) assert.doesNotMatch(k.tip, internal)
  const home = sfc('pages/staff/components/k-merchant-work.vue')
  assert.doesNotMatch(home.template.content, internal)
  assert.doesNotMatch(home.template.content, /平台审核/)
  assert.match(home.template.content, /袋鼠工作人员会核实并上架/)
  assert.match(home.template.content, /\{\{ staffWording\(r\.statusLabel\) \}\}/)
  // 脚本里只有注释提内部角色，链接说明不提
  const links = home.scriptSetup.content.slice(home.scriptSetup.content.indexOf('const links = ['), home.scriptSetup.content.indexOf('const activityLinks'))
  assert.doesNotMatch(links, internal)
  const req = sfc('pages/staff/merchant-request.vue')
  assert.match(req.template.content, /\{\{ staffWording\(detail\.statusLabel\) \}\}/)
  assert.match(req.scriptSetup.content, /await alert\('已提交', staffWording\(/)
  // 员工自己的页面不动：岗位列表的派单提示、分享页的「按换工主理人」还在（只对员工显示）
  const jobs = sfc('pages/staff/jobs.vue').template.content
  assert.match(jobs, /个商家岗位等你完善并上架/)
  assert.match(jobs, /按换工主理人/)
})

test('M10 进度条：招募三步、线上类三步；退回 / 关闭两步；当前一步只有一个', () => {
  const steps = (t, s) => logic.requestSteps(t, s)
  assert.deepEqual(steps('volunteer', 'dispatched').map(x => x.label + ':' + x.state), ['已提交:done', '袋鼠核实中:now', '已上架:todo'])
  assert.deepEqual(steps('volunteer', 'unassigned').map(x => x.state), ['done', 'now', 'todo'])
  assert.deepEqual(steps('fulltime', 'published').map(x => x.state), ['done', 'done', 'done'])
  assert.deepEqual(steps('online_task', 'pending_verify').map(x => x.label + ':' + x.state), ['已提交:done', '袋鼠处理中:now', '已完成:todo'])
  assert.deepEqual(steps('managed', 'forwarded').map(x => x.state), ['done', 'now', 'todo'])
  assert.deepEqual(steps('cloud_chain', 'accepted').map(x => x.state), ['done', 'now', 'todo'])
  assert.deepEqual(steps('managed', 'done').map(x => x.state), ['done', 'done', 'done'])
  assert.deepEqual(steps('managed', 'returned').map(x => x.label), ['已提交', '已退回，可修改后再提交'])
  assert.deepEqual(steps('volunteer', 'closed').map(x => x.label), ['已提交', '已关闭'])
  for (const [t, s] of [['volunteer', 'dispatched'], ['online_task', 'accepted'], ['managed', 'returned']]) assert.equal(steps(t, s).filter(x => x.state === 'now').length, 1)
})

// ---------------------------------------------------------------- M12 main.js 守卫
function runGuard({ route, current, grants, toastThrows = false }) {
  const code = src('main.js')
  const start = code.indexOf('async onLoad(q) {')
  const end = code.indexOf('\n\t\t}\n\t})', start)
  assert.ok(start > 0 && end > start, 'main.js 守卫没找到')
  const body = code.slice(start + 'async onLoad(q) {'.length, end)
  const redirects = [], toasts = []
  const sandbox = {
    pendingStaffRoute,
    getCurrentPages: () => [{ route }], ensureSession: async () => {},
    uni: { redirectTo: (o) => redirects.push(o.url), showToast: (o) => { if (toastThrows) throw new Error('page not ready'); toasts.push(o.title) } },
    experience: { account: { staffGrants: grants.map(g => ({ ...g, active: true })) } },
    currentStaffStore: { value: grants.find(g => g.storeId === current) }, staffStores: { value: grants }, hasStaffAccess: { value: true }, q: {}
  }
  vm.createContext(sandbox)
  return vm.runInContext('(async () => {' + body + '\n})()', sandbox).then(() => ({ redirects, toasts }))
}
test('M12 商家白名单兜底：被送回首页时提示「商家身份没有这个页面」；白名单里的页不提示；toast 报错也照样送回', async () => {
  const merchant = [{ storeId: 9, roleCode: 'merchant' }]
  assert.deepEqual(await runGuard({ route: 'pages/staff/dispatch', current: 9, grants: merchant }), { redirects: ['/pages/staff/index'], toasts: ['商家身份没有这个页面'] })
  assert.deepEqual(await runGuard({ route: 'pages/staff/insurance', current: 9, grants: merchant }), { redirects: ['/pages/staff/index'], toasts: ['商家身份没有这个页面'] })
  for (const route of ['pages/staff/index', 'pages/staff/jobs', 'pages/staff/merchant-request', 'pages/staff/activities']) {
    assert.deepEqual(await runGuard({ route, current: 9, grants: merchant }), { redirects: [], toasts: [] }, route)
  }
  assert.deepEqual((await runGuard({ route: 'pages/staff/dispatch', current: 9, grants: merchant, toastThrows: true })).redirects, ['/pages/staff/index'])
  // 别的角色没有这句（他们各有各的提示或直接送回）
  assert.deepEqual((await runGuard({ route: 'pages/staff/dispatch', current: 3, grants: [{ storeId: 3, roleCode: 'merchant_service' }] })).toasts, [])
})
