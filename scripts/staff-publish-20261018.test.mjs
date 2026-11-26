// 10-18 晚 商家端发布改版（E1）：员工端发布入口改成四个板块 招募换工 / 招募兼职 / 招募全职 / 发布线上任务，
// 每个点进去一张分组表单，要填的 = 用户端岗位详情页展示的东西；提交 → 平台审核 → 通过后公示（node --test，不需要构建、不发请求）。
// 守住这几件事：
//   · 入口四个板块，线上任务去线上任务发布页；工作台「发布招募」直接点进某一类（?s=2&kind=），老链接 ?s=3 落到发布入口；
//   · 每一类的默认值：换宿包吃包住、不发补贴；兼职默认日薪、全职默认月薪（必填）；每日工时按类给默认；
//   · 没填的必填项就地标红（点过「提交审核」才标），提示第一项、不发请求；
//   · 新字段按约定的名字提交：boardType / boardDesc / dailyHours / shiftTime / settleDesc，全职多 probation / trainDesc / category；
//     年龄、技能写进「要求」前两行；不适用的项传空（换宿没有结算方式，兼职没有试用期）；
//   · 「按模板帮我写」只填空着的项，薪资没填好时先不带薪资；提交成功换成「已提交，等平台审核」；
//   · 门店级资料（店长、采访视频、亮点、交通、执照、店里日常）不在表里，给一行说明；
//   · 线上任务发布页：直接在表里填，带上用户端会显示的 预计耗时、我们希望你（最多 3 条）；素材接单后再发；
//   · 服务端：新字段落到 kg_job 现有的列（不加迁移）。
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { createRequire } from 'node:module'
import test from 'node:test'
import assert from 'node:assert/strict'
import * as genderPlan from '../common/job-gender.js'

const APP = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const require = createRequire(path.join(APP, 'package.json'))
const compiler = require('@vue/compiler-sfc'), vue = require('vue')
const src = (rel) => fs.readFileSync(path.join(APP, rel), 'utf8').replace(/\r\n/g, '\n')
const salary = await import(pathToFileURL(path.join(APP, 'common/job-salary.js')).href)
const plain = (v) => JSON.parse(JSON.stringify(v))
const flush = () => new Promise(resolve => setImmediate(resolve))
const JAVA = path.join(APP, '../RuoYi-Vue/ruoyi-kangaroo/src/main/java/com/ruoyi/kangaroo/ext/staff/KgStaffJobService.java')

/** 在沙箱里跑页面的 script setup：导入一律先给永远不返回的函数，再用 stubs 覆盖用得到的那几个 */
function runSetup(rel, stubs) {
  const d = compiler.parse(src(rel), { filename: rel }).descriptor
  const source = d.scriptSetup.content
  const ast = compiler.babelParse(source, { sourceType: 'module' })
  const body = ast.program.body.filter(n => n.type !== 'ImportDeclaration').map(n => source.slice(n.start, n.end)).join('\n')
  const sandbox = { console, setTimeout, clearTimeout }
  for (const n of ast.program.body.filter(n => n.type === 'ImportDeclaration')) for (const s of n.specifiers) sandbox[s.local.name] = () => new Promise(() => {})
  // Use synchronous production validation rather than the generic pending API stub.
  Object.assign(sandbox, genderPlan, { ensureSession: async () => {}, getSessionRevision: () => 0 })
  Object.assign(sandbox, { ref: vue.ref, computed: vue.computed, watch: vue.watch, reactive: vue.reactive, onShow() {}, onHide() {}, onUnload() {}, onUnmounted() {} }, stubs)
  vm.createContext(sandbox)
  const scope = vue.effectScope()
  scope.run(() => vm.runInContext(body, sandbox, { filename: rel + ':script-setup' }))
  return { run: code => vm.runInContext(code, sandbox), stop: () => scope.stop(), template: d.template.content, sandbox }
}

const R = { staffOnline: '/pages/staff/online-jobs', staffJobs: '/pages/staff/jobs' }

function jobsHarness({ canEdit = true, describe } = {}) {
  const log = { created: [], described: [], toasts: [], gone: [], confirms: [], backs: 0, scrolls: [] }
  const ctl = { confirm: true }
  let onLoad = null
  const s = vue.ref(1)
  const h = runSetup('pages/staff/jobs.vue', {
    useScreen: (n, opts) => { onLoad = opts && opts.onLoad; return s },
    onShareAppMessage() {}, ensureSession: async () => {}, hasStaffAccess: { value: true },
    currentStaffStoreId: () => 102, staffCan: () => true, absUrl: x => x,
    todayCn: () => '2026-10-18', shiftDate: () => '2026-10-25', isYmd: (v) => /^\d{4}-\d{2}-\d{2}$/.test(String(v || '')),
    validateSalaryForm: salary.validateSalaryForm, salaryPayload: salary.salaryPayload, jobBenefits: salary.jobBenefits,
    parseSalaryAmount: salary.parseSalaryAmount, SALARY_OPTIONS: salary.SALARY_OPTIONS, salaryOption: salary.salaryOption,
    toast: (m) => log.toasts.push(m), go: (u) => log.gone.push(u), back: () => { log.backs++ },
    confirm: async (title, msg) => { log.confirms.push([title, msg]); return ctl.confirm },
    errText: (e, d) => (e && e.message) || d, R,
    apiStaffJobs: async () => ({ data: { rows: [], canEdit, storeCert: true, storeAddress: '平潭海边' } }),
    apiStaffShareStats: async () => ({ data: {} }),
    apiStaffJobKeywords: async () => ({ data: ['咖啡', '接待', '做饭', '拍摄'] }),
    apiJobKinds: async () => ({ data: [{ value: 'daily', label: '日常换工', desc: '接待、打扫' }] }),
    apiStaffDescribeJob: async (storeId, payload) => { log.described.push(plain(payload)); return describe ? describe(payload) : { data: { title: '模板标题', work: '1. 模板工作。', hope: '• 模板要求。', variant: 0 } } },
    apiStaffCreateJob: async (storeId, payload) => { log.created.push(plain(payload)); return { msg: '已提交平台审核', data: { jobId: 321 } } },
    uni: { pageScrollTo: (o) => log.scrolls.push(o) }
  })
  return { ...h, s, log, ctl, load: async (q = {}) => { onLoad && onLoad(q); await flush(); await flush() } }
}

// ---------------------------------------------------------------- 入口

test('岗位复查：派单链接的门店已撤权，不能打开另一家店的发布表', async (t) => {
  const h = jobsHarness()
  t.after(h.stop)
  h.s.value = 2
  let calls = 0
  h.sandbox.selectStaffStore = async () => { throw new Error('该门店暂无员工授权') }
  h.sandbox.apiStaffJobs = async () => { calls++; return { data: { canEdit: true, rows: [] } } }
  await h.load({ s: '2', kind: 'fulltime', storeId: '203' })
  assert.equal(h.run('formOpen.value'), false)
  assert.equal(calls, 0)
  let store = 102
  const storesRead = []
  h.sandbox.currentStaffStoreId = () => store
  h.sandbox.selectStaffStore = async id => { store = Number(id) }
  h.sandbox.apiStaffJobs = async p => { storesRead.push(p.storeId); return { data: { canEdit: true, rows: [] } } }
  await h.run('retryJobs()')
  assert.equal(h.run('formOpen.value'), true)
  assert.equal(h.run('jobsError.value'), '')
  assert.ok(storesRead.length && storesRead.every(id => id === 203))
})

test('岗位复查：连续切换分类，先发出的迟到列表不能盖住最后选择的岗位和权限', async (t) => {
  const h = jobsHarness()
  t.after(h.stop)
  await h.load()
  const sends = []
  h.sandbox.apiStaffJobs = params => new Promise(resolve => sends.push({ params, resolve }))
  h.run("setType('parttime')")
  await flush()
  h.run("setType('fulltime')")
  await flush()
  sends[1].resolve({ data: { rows: [{ jobId: 3 }], canEdit: false } })
  await flush()
  sends[0].resolve({ data: { rows: [{ jobId: 2 }], canEdit: true } })
  await flush()
  assert.deepEqual(plain(h.run('rows.value')), [{ jobId: 3 }])
  assert.equal(h.run('canEdit.value'), false)
})

test('岗位复查：当前门店变化立即挡住旧页，重试只展示新门店的岗位', async (t) => {
  const h = jobsHarness()
  t.after(h.stop)
  const store = vue.ref(102)
  h.sandbox.currentStaffStoreId = () => store.value
  h.sandbox.apiStaffJobs = async p => ({ data: { rows: [{ storeId: p.storeId }], canEdit: p.storeId === 102 } })
  await h.load()
  store.value = 203
  assert.equal(h.run('jobsScopeChanged.value'), true)
  assert.match(h.template, /v-if="entryLoading \|\| jobsScopeChanged/)
  await h.run('retryJobs()')
  assert.equal(h.run('jobsScopeChanged.value'), false)
  assert.equal(h.run('canEdit.value'), false)
  assert.deepEqual(plain(h.run('rows.value')), [{ storeId: 203 }])
})

test('岗位复查：上一份招聘的起草回包不能写进下一份招聘', async (t) => {
  let resolve
  const h = jobsHarness({ describe: () => new Promise(r => { resolve = r }) })
  t.after(h.stop)
  await h.load()
  h.run("startPublish(); choosePublish('fulltime')")
  const old = h.run('generate()')
  await h.run('backFromPublish()')
  h.run("choosePublish('parttime')")
  resolve({ data: { title: '旧全职岗位', work: '旧工作' } })
  await old
  assert.equal(h.run('gen.value.title || ""'), '')
})

test('岗位复查：确认重写后继续改的字段保留，其他字段仍用模板', async (t) => {
  let resolve
  const h = jobsHarness({ describe: () => new Promise(r => { resolve = r }) })
  t.after(h.stop)
  await h.load()
  h.run("startPublish(); choosePublish('fulltime'); Object.assign(gen.value, { title:'旧标题', work:'旧工作', hope:'旧要求' })")
  const pending = h.run('generate()')
  await flush()
  h.run("setGen('title', '刚和店长确认的标题')")
  resolve({ data: { title: '模板标题', work: '模板工作', hope:'模板要求' } })
  await pending
  assert.deepEqual(plain(h.run('gen.value')), { title: '刚和店长确认的标题', work: '模板工作', hope:'模板要求' })
})

test('发布入口：四个板块，线上任务去线上任务发布页；门店资料只给一行说明', async (t) => {
  const h = jobsHarness()
  t.after(h.stop)
  await h.load()
  assert.deepEqual(plain(h.run('KIND_LIST')).map(k => [k.key, k.title]), [['volunteer', '招募换工'], ['parttime', '招募兼职'], ['fulltime', '招募全职'], ['online', '发布线上任务']])
  h.run('startPublish()')
  assert.equal(h.s.value, 2)
  assert.equal(h.run('formOpen.value'), false)
  h.run("choosePublish('online')")
  assert.deepEqual(h.log.gone, ['/pages/staff/online-jobs?s=1'])
  assert.equal(h.run('formOpen.value'), false)
  h.run("choosePublish('volunteer')")
  assert.equal(h.run('formOpen.value'), true)
  assert.match(h.template, /<view v-if="!formOpen && !submitted" class="pub-home k-pad-tab">/)
  // 板块列表后来改成按权限过滤的 publishKinds（没有线上任务发布权限的不出「发布线上任务」），KIND_LIST 还是四个
  assert.match(h.template, /<view v-for="kind in publishKinds" :key="kind\.key" class="pub-kind"/)
  assert.match(h.run('STORE_NOTE'), /店长介绍、采访视频、该店亮点、交通参考、营业执照、店里日常属于门店资料，由袋鼠员工在电脑后台「门店资料」里统一填写/)
  // R7（主人要求改版）：底部操作条只放按钮，流程字删了（确认框和提交成功页都说）；客服方块在提交按钮左边，员工看不到时提交按钮占满
  assert.match(h.template, /<view class="fc-bar__btns"><fc-kefu \/><view class="fc-btn" hover-class="k-press-s" @click="submitJob">/)
  assert.doesNotMatch(h.template, /提交 → 平台审核/)
  // 表单开着时底部是「提交审核」栏，不叠导航栏
  assert.match(h.template, /<k-tabbar v-if="!formOpen \|\| submitted" mode="staff" active="work" \/>/)
})

test('发布入口：没有岗位编辑权限的不能进；工作台直接点某一类（?s=2&kind=）权限回来后打开那张表；老链接 ?s=3 落到发布入口', async (t) => {
  const no = jobsHarness({ canEdit: false })
  t.after(no.stop)
  await no.load()
  no.run('startPublish()')
  assert.equal(no.s.value, 1)
  // 提示字后来改成按门店身份说（权限表来自服务端，不再写死「主理人或管家」）
  assert.equal(no.log.toasts.at(-1), '当前门店身份没有岗位发布权限')
  const deep = jobsHarness()
  t.after(deep.stop)
  deep.s.value = 2
  await deep.load({ s: '2', kind: 'fulltime' })
  assert.equal(deep.run('formOpen.value'), true)
  assert.equal(deep.run('form.value.jobType'), 'fulltime')
  // 没填东西直接返回：回来源页（工作台），不问
  await deep.run('backFromPublish()')
  assert.equal(deep.log.backs, 1)
  assert.equal(deep.log.confirms.length, 0)
  const old = jobsHarness()
  t.after(old.stop)
  old.s.value = 3
  await old.load({ s: '3' })
  assert.equal(old.s.value, 2)
  assert.equal(old.run('formOpen.value'), false)
})

test('每一类的默认值：换宿包吃包住不发补贴；兼职日薪、全职月薪必填；每日工时按类给', async (t) => {
  const h = jobsHarness()
  t.after(h.stop)
  await h.load()
  const pick = (k) => { h.run(`choosePublish('${k}')`); return plain(h.run('form.value')) }
  const v = pick('volunteer')
  assert.deepEqual([v.boardType, v.salaryEnabled, v.dailyHours, v.minDays, v.headcount, v.insuranceFlag], ['all', false, '每天 4 小时', null, 2, '1'])
  assert.deepEqual(plain(h.run('boardOptions.value')).map(o => o[0]), ['包吃包住', '只包住'])
  const p = pick('parttime')
  assert.deepEqual([p.boardType, p.salaryEnabled, p.salaryType, p.dailyHours], ['all', true, 'daily', '每天 6 小时'])
  assert.deepEqual(plain(h.run('boardOptions.value')).map(o => o[0]), ['包吃包住', '包住', '包吃', '不包食宿'])
  const f = pick('fulltime')
  assert.deepEqual([f.salaryEnabled, f.salaryType, f.dailyHours], [true, 'monthly', '每天 8 小时'])
  // 选了某一类才去取换工类型、技能清单
  await flush()
  assert.deepEqual(plain(h.run('skillChips.value')), ['咖啡', '接待', '做饭', '拍摄'])
  assert.equal(h.run('kindOptions.value.length'), 1)
})

// ---------------------------------------------------------------- 就地提示 + 提交

test('必填项没填：就地标红（点过提交才标），提示第一项并滚过去，不发请求', async (t) => {
  const h = jobsHarness()
  t.after(h.stop)
  await h.load()
  h.run("startPublish(); choosePublish('parttime')")
  assert.deepEqual(plain(h.run('err.value')), {}, '还没点提交不标红')
  await h.run('submitJob()')
  assert.equal(h.log.created.length, 0)
  assert.deepEqual(Object.keys(plain(h.run('err.value'))), ['title', 'images', 'work', 'salary'])
  assert.equal(h.log.toasts.at(-1), '请填写岗位标题')
  assert.equal(h.log.scrolls.at(-1).selector, '#pf-title')
  assert.equal(h.run('errCount.value'), 4)
  // 边改边消
  h.run("setGen('title', '古城咖啡店周末兼职')")
  assert.deepEqual(Object.keys(plain(h.run('err.value'))), ['images', 'work', 'salary'])
  await h.run('submitJob()')
  assert.equal(h.log.toasts.at(-1), '请至少上传 1 张岗位照片')
  assert.equal(h.log.scrolls.at(-1).selector, '#pf-images')
  h.run("form.value.images = ['/profile/upload/2026/10/25/test.jpg']")
  h.run("setGen('work', '吧台出品\\n收银'); form.value.salary = '0'")
  assert.equal(plain(h.run('err.value')).salary, '请填写薪资金额（大于 0，最多两位小数）')
  h.run("form.value.salary = '120'; form.value.bonusEnabled = true")
  assert.equal(plain(h.run('err.value')).bonus, '请写清奖金怎么算，或关掉「奖金」')
  h.run("form.value.bonusEnabled = false")
  assert.equal(h.run('errCount.value'), 0)
  // 换宿的补贴：打开了才要金额
  h.run("choosePublish('volunteer'); setGen('title', 't'); setGen('work', 'w'); tried.value = true")
  h.run("form.value.images = ['/profile/upload/2026/10/25/test.jpg']")
  assert.equal(h.run('errCount.value'), 0)
  h.run('toggleSalary()')
  assert.match(plain(h.run('err.value')).salary, /请填写补贴金额.*或关掉「另有补贴」/)
  h.run('toggleSalary()')
  assert.equal(h.run('errCount.value'), 0)
  // 要求连同年龄、性格（2026-11-03 加的）、技能超过 300 字
  h.run("form.value.age = '18–30岁'; setGen('hope', '很长'.repeat(150))")
  assert.equal(plain(h.run('err.value')).hope, '要求太长了：连同年龄、性格、技能一共 300 字以内')
})

test('提交：新字段按约定的名字带上，年龄 / 技能写进要求，不适用的项传空；成功后换成「已提交，等平台审核」', async (t) => {
  const h = jobsHarness()
  t.after(h.stop)
  await h.load()
  h.run("startPublish(); choosePublish('fulltime')")
  h.run("form.value.images = ['/profile/upload/2026/10/25/test.jpg']")
  h.run(`Object.assign(form.value, { salary: '5200', settleDesc: '月结', probation: '1个月', trainDesc: '入职带薪培训 3 天', category: 'homestay',
    shiftTime: '9:00-18:00', boardDesc: '独立单间', roomType: 'single', restMode: '5-2', age: '18–35岁', keywords: ['接待', '做饭'], genderPref: 'F' })`)
  h.run("setGen('title', '海边民宿店长'); setGen('work', '负责排房\\n带换工接待'); setGen('hope', '有民宿经验\\n\\n能长期在店')")
  await h.run('submitJob()')
  // 2026-11-03 主人：简化——底栏一直写着「还差什么 / 可以提交」，点提交直接交，不再弹「确认提交？」
  assert.equal(h.log.confirms.length, 0)
  const p = h.log.created.at(-1)
  assert.deepEqual([p.jobType, p.title, p.intro, p.work], ['fulltime', '海边民宿店长', '', '负责排房\n带换工接待'])
  assert.equal(p.hope, '年龄：18–35岁\n技能：接待、做饭\n有民宿经验\n能长期在店')
  assert.deepEqual([p.boardType, p.boardDesc, p.dailyHours, p.shiftTime, p.settleDesc, p.probation, p.trainDesc, p.category],
    ['all', '独立单间', '每天 8 小时', '9:00-18:00', '月结', '1个月', '入职带薪培训 3 天', 'homestay'])
  assert.deepEqual([p.salaryType, p.salary, p.genderPref, p.roomType, p.restMode], ['monthly', 5200, '', 'single', '5-2'], '全职不带性别')
  // 页面换成「已提交」，草稿清空
  assert.deepEqual(plain(h.run('submitted.value')), { title: '海边民宿店长', jobId: 321 })
  assert.equal(h.run('gen.value.title || ""'), '')
  assert.match(h.template, /<text class="pub-done__title">\{\{ submitted\.message \? '已提交' : '已提交，等平台审核' \}\}<\/text>/)
  h.run('publishAnother()')
  assert.equal(h.run('formOpen.value'), false)
  assert.equal(h.run('submitted.value'), null)

  // 换宿：没有结算方式、试用期、培训、门店类型；食宿只包住时带上住宿条件
  h.run("choosePublish('volunteer')")
  h.run("form.value.images = ['/profile/upload/2026/10/25/test.jpg']")
  h.run(`Object.assign(form.value, { settleDesc: '日结', probation: '1个月', category: 'bar', genderPref: 'M', roomType: 'multi' }); setBoard('room')`)
  h.run("setGen('title', '古城青旅换工'); setGen('work', '前台接待')")
  await h.run('submitJob()')
  const v = h.log.created.at(-1)
  assert.deepEqual([v.boardType, v.settleDesc, v.probation, v.category, v.genderPref, v.roomType, v.hope], ['room', '', '', '', 'M', 'multi', ''])
  // 兼职：不包食宿就没有食宿说明、住宿条件
  h.run("choosePublish('parttime')")
  h.run("form.value.images = ['/profile/upload/2026/10/25/test.jpg']")
  h.run(`Object.assign(form.value, { salary: '150', boardDesc: '写了也不带', roomType: 'double' }); setBoard('none')`)
  h.run("setGen('title', '周末兼职'); setGen('work', '收银')")
  await h.run('submitJob()')
  const p2 = h.log.created.at(-1)
  assert.deepEqual([p2.boardType, p2.boardEnabled, p2.boardDesc, p2.roomType, p2.probation], ['none', false, '', '', ''])
})

// 2026-11-03 主人：简化——点提交不再弹确认框（原来「不确认就不提交」），连点仍只提交一次
test('点提交不弹确认框、直接交；连点只提交一次；提交失败留着表单', async (t) => {
  const h = jobsHarness()
  t.after(h.stop)
  await h.load()
  h.run("choosePublish('volunteer'); setGen('title', 't'); setGen('work', 'w')")
  h.run("form.value.images = ['/profile/upload/2026/10/25/test.jpg']")
  h.ctl.confirm = false
  await Promise.all([h.run('submitJob()'), h.run('submitJob()')])
  assert.equal(h.log.created.length, 1)
  assert.equal(h.log.confirms.length, 0, '不再问「确认提交？」')
  h.run("choosePublish('volunteer'); setGen('title', 't2'); setGen('work', 'w')")
  h.run("form.value.images = ['/profile/upload/2026/10/25/test.jpg']")
  h.sandbox.apiStaffCreateJob = async () => { throw new Error('门店不存在') }
  await h.run('submitJob()')
  assert.equal(h.log.toasts.at(-1), '门店不存在')
  assert.equal(h.run('gen.value.title'), 't2')
  assert.equal(h.run('submitted.value'), null)
})

test('填了东西再返回要确认（表单不存草稿）；返回到四个板块', async (t) => {
  const h = jobsHarness()
  t.after(h.stop)
  await h.load()
  h.run("startPublish(); choosePublish('parttime'); form.value.shiftTime = '9:00-15:00'")
  h.ctl.confirm = false
  await h.run('backFromPublish()')
  assert.equal(h.run('formOpen.value'), true)
  assert.equal(h.log.confirms.at(-1)[0], '先不发了？')
  h.ctl.confirm = true
  await h.run('backFromPublish()')
  assert.equal(h.run('formOpen.value'), false)
  assert.equal(h.s.value, 2)
  await h.run('backFromPublish()')
  assert.equal(h.s.value, 1)
})

test('按模板帮我写：只填空着的项；薪资没填好先不带；三项都写了才问要不要整份替换', async (t) => {
  const h = jobsHarness()
  t.after(h.stop)
  await h.load()
  h.run("choosePublish('parttime'); setGen('title', '我自己写的标题')")
  await h.run('generate()')
  const d = h.log.described.at(-1)
  assert.equal(d.salaryEnabled, false, '日薪还没填，先不带（服务端会拒）')
  assert.equal(d.dailyHours, '每天 6 小时')
  assert.equal(h.run('gen.value.title'), '我自己写的标题', '写过的不覆盖')
  assert.equal(h.run('gen.value.work'), '1. 模板工作。')
  assert.equal(h.run('gen.value.hope'), '• 模板要求。')
  assert.equal(h.log.confirms.length, 0)
  h.ctl.confirm = false
  await h.run('generate()')
  assert.equal(h.log.confirms.at(-1)[0], '按模板重写')
  assert.equal(h.log.described.length, 1, '不替换就不请求')
  h.ctl.confirm = true
  h.run("form.value.salary = '150'")
  await h.run('generate()')
  assert.equal(h.log.described.at(-1).salaryEnabled, true)
  assert.equal(h.log.described.at(-1).variant, 1, '再写一次换一套句式')
  assert.equal(h.run('gen.value.title'), '模板标题')
})

test('每日工时（R1 主人：2、4、6、8 小时，别出现十小时）：一点就选、再点取消，没有自定义；老值照实带着不被改；食宿切到不包住清掉房型', async (t) => {
  const h = jobsHarness()
  t.after(h.stop)
  await h.load()
  h.run("choosePublish('volunteer')")
  assert.deepEqual(plain(h.run('HOUR_OPTS')), [['2 小时', '每天 2 小时'], ['4 小时', '每天 4 小时'], ['6 小时', '每天 6 小时'], ['8 小时', '每天 8 小时']])
  assert.doesNotMatch(h.template, /自定义/)
  h.run("pickDailyHours('每天 8 小时')")
  assert.equal(h.run('form.value.dailyHours'), '每天 8 小时')
  h.run("pickDailyHours('每天 8 小时')")
  assert.equal(h.run('form.value.dailyHours'), '')
  assert.equal(h.run('legacyHours.value'), '')
  // 老岗位存的别的值：哪格都不亮，下面照实写一句；不点就原样提交；点了新值才变，再点取消回到老值
  h.run("choosePublish('volunteer'); hoursBefore.value = '弹性时间'; form.value.dailyHours = '弹性时间'")
  assert.equal(h.run('legacyHours.value'), '弹性时间')
  assert.match(h.template, /<text v-if="legacyHours" class="fc-note">目前存的是「\{\{ legacyHours \}\}」，不选就保持不变<\/text>/)
  assert.equal(plain(h.run("jobPayload(form.value, 't')")).dailyHours, '弹性时间')
  h.run("pickDailyHours('每天 2 小时')")
  assert.equal(h.run('form.value.dailyHours'), '每天 2 小时')
  assert.equal(h.run('legacyHours.value'), '')
  assert.equal(plain(h.run("jobPayload(form.value, 't')")).dailyHours, '每天 2 小时')
  h.run("pickDailyHours('每天 2 小时')")
  assert.equal(h.run('form.value.dailyHours'), '弹性时间', '点错了再点一下回到老值，不是清空')
  h.run("choosePublish('parttime'); form.value.roomType = 'double'; setBoard('meal')")
  assert.equal(h.run('form.value.roomType'), '')
  assert.equal(h.run('form.value.boardEnabled'), true, '包吃也算提供食宿')
  assert.equal(h.run('housing.value'), false)
})

// ---------------------------------------------------------------- 模板与样式

test('表单分组：基本信息 / 时间与地点 / 工作安排 / 食宿与待遇 / 更多选填；选项 grid 等分；共用样式在分包里', () => {
  const page = src('pages/staff/jobs.vue')
  const tpl = compiler.parse(page).descriptor.template.content
  // R7（主人要求改版）：字段一个没少，只是换了版式；不常用的收进「更多选填」，要求那一组拆开了
  // 2026-11-03 主人：「操作太繁琐了看不懂，增加一个预设模板」：分三步 选模板 → 必填信息 → 时间和待遇，其余在「更多设置（选填）」；没有模板（完善商家岗位）时不写第几步
  const titles = [...tpl.matchAll(/<text class="fc-group__title">([^<]+)<\/text>/g)].map(m => m[1])
  assert.deepEqual(titles, ['粘贴全职招聘文案', '第 1 步 · 选个模板', '{{ stepTitles[0] }}', '{{ stepTitles[1] }}'])
  assert.match(tpl, /<text class="fc-more__t">更多设置<text class="fc-more__n">（选填，/)
  for (const label of ['岗位标题', '岗位照片', '工作内容', '每日工时', '食宿', '结算方式', '其他要求', '上班时段', '食宿说明', '试用期', '培训', '招募性别', '住宿条件', '住宿照片或视频', '餐补', '店里有宠物吗', '薪资']) {
    assert.match(tpl, new RegExp('<text class="fc-label__t">' + label + '<\\/text>'), label)
  }
  for (const label of ['换工类型', '门店类型', '工作地点', '到岗日期', '最短期限', '招募人数', '休息排班', '年龄', '技能 \\/ 关键词', '另有补贴', '做满一个月有红包', '奖金', '提成', '为录用人员安排保险', '安心商家认证']) {
    assert.match(tpl, new RegExp('<text class="fc-row__k">' + label + '<\\/text>'), label)
  }
  // 性别只给换宿、门店类型 / 试用期 / 培训只给全职、结算方式不给换宿
  assert.match(tpl, /<view v-if="form\.jobType === 'volunteer'" class="fc-field gender-plan">\s*<view class="fc-label"><text class="fc-label__t">招募性别<\/text>/)
  assert.match(tpl, /<view v-if="form\.jobType==='fulltime'" class="fc-row"[^>]*><view class="fc-row__copy"><text class="fc-row__k">门店类型<\/text>/)
  assert.match(tpl, /<template v-if="form\.jobType === 'fulltime'">\s*<view class="fc-field">\s*<view class="fc-label"><text class="fc-label__t">试用期<\/text>/)
  assert.match(tpl, /<view v-if="form\.jobType !== 'volunteer'" class="fc-field">\s*<view class="fc-label"><text class="fc-label__t">结算方式<\/text>/)
  // 小程序 textarea 是原生层：不在输入时换成同样外观的 view
  assert.match(tpl, /<textarea v-if="editing === 'work'"[^>]*@blur="endEdit\('work', \$event\)" \/>\s*<view v-else class="fc-area fc-area--idle"/)
  // 共用样式：两边 @import 同一份，放在 staff 分包目录；白字底色不浅于主色
  assert.match(page, /@import '\.\/publish-form\.scss';/)
  assert.match(page, /@import '\.\/form-clean\.scss';/)
  assert.match(src('pages/staff/online-jobs.vue'), /@import '\.\/publish-form\.scss';/)
  assert.match(src('pages/staff/online-jobs.vue'), /@import '\.\/form-clean\.scss';/)
  const scss = src('pages/staff/publish-form.scss')
  assert.match(scss, /\.pub-chips--4\{grid-template-columns:repeat\(4,minmax\(0,1fr\)\)\}/)
  assert.match(scss, /\.pub-sec\{[^}]*border-radius:12px;background:var\(--k-paper\)\}/) // 2026-11-17 改版「小而精」：白卡 12 圆角、不加阴影（原来是 16 圆角 + 柔和阴影）
  assert.ok(!/#A9794B/i.test(scss), '白字底色不用比主色浅的棕')
  // 发布表单的旧样式（步骤条、第 3 屏）都删掉了
  assert.ok(!/\.ai-page\{|\.next-button\{|stepLabels|chipPop/.test(page))
})

test('工作台「发布招募」：四格直接进对应的表，只给有岗位编辑权限的人（小院主理人只有线上任务、活动两格，见 luna-staff-20261030.test.mjs）', () => {
  const idx = src('pages/staff/index.vue')
  assert.match(idx, /<template v-if="canPublish && publishEntries\.length">/)
  assert.match(idx, /const canPublish = computed\(\(\) => staffCan\('jobs', 'edit'\)\)/)
  assert.match(idx, /const openPublish = \(kind\) => go\(kind === 'activity' \? ACTIVITY_CREATE_PAGE : kind === 'online' \? R\.staffOnline \+ '\?s=1' : R\.staffJobs \+ '\?s=2&kind=' \+ kind\)/)
  const entries = idx.slice(idx.indexOf('const PUBLISH_ENTRIES = ['), idx.indexOf('const KEEPER_PUBLISH = ['))
  assert.deepEqual([...entries.matchAll(/\{ kind: '(\w+)', label: '([^']+)'/g)].map(m => m[2]), ['招募换工', '招募兼职', '招募全职', '线上任务'])
})

// ---------------------------------------------------------------- 线上任务发布页

function onlineHarness() {
  const log = { created: [], toasts: [] }
  const h = runSetup('pages/staff/online-jobs.vue', {
    setInterval: () => 0, clearInterval() {},
    useScreen: () => vue.ref(1), ensureSession: async () => {}, currentStaffStoreId: () => 102, onlineStaff: { value: false },
    todayCn: () => '2026-10-18', shiftDate: () => '2026-10-25', toast: (m) => log.toasts.push(m), confirm: async () => true,
    errText: (e, d) => d, go() {}, back() {}, R,
    apiOnlineCreate: async (payload) => { log.created.push(plain(payload)); return { data: { jobId: 88, message: '已提交平台审核' } } },
    apiOnlineTask: async () => ({ data: { jobId: 88 } })
  })
  return { ...h, log }
}

test('线上任务发布页：直接在表里填；佣金就地校验；带上预计耗时和「我们希望你」（最多 3 条，每条 40 字）', async (t) => {
  const h = onlineHarness()
  t.after(h.stop)
  assert.match(h.template, /<view v-if="s === 1" class="fc-form publish-page">/)
  for (const label of ['任务标题', '任务类型', '交付物', '预计完成时间', '预计耗时', '单人佣金', '名额', '验收标准', '账号与参与要求', '任务描述']) {
    assert.match(h.template, new RegExp('<text class="(fc-label__t|fc-row__k)">' + label + '<\\/text>'), label)
  }
  assert.match(h.template, /接单后在「交付记录」里发给接单人（文字、图片、文件都行），这里不用传/)
  await h.run('publish()')
  assert.equal(h.log.created.length, 0)
  assert.deepEqual(Object.keys(plain(h.run('ferr.value'))), ['title', 'deliverables', 'commission', 'criteria'])
  h.run("setCommission('12.345')")
  assert.equal(h.run('form.value.commissionFen'), 0)
  assert.equal(plain(h.run('ferr.value')).commission, '佣金 1–5000 元，最多两位小数')
  h.run("setCommission('12.5')")
  assert.equal(h.run('form.value.commissionFen'), 1250)
  h.run("form.value.title = '探店笔记'; form.value.deliverables = '小红书图文 1 篇'; form.value.criteria = '原创'; form.value.estHours = '约 2 小时'")
  h.run("endText('requirements', { detail: { value: '有小红书账号\\n\\n会拍照\\n会修图\\n第四条不要' + '' } })")
  assert.deepEqual(plain(h.run('form.value.requirements')), ['有小红书账号', '会拍照', '会修图'])
  h.run("endText('requirements', { detail: { value: '长'.repeat(50) } })")
  assert.equal(h.run('form.value.requirements[0].length'), 40)
  h.run("stepQuota(100)")
  assert.equal(h.run('form.value.quota'), 50)
  await h.run('publish()')
  const p = h.log.created.at(-1)
  assert.deepEqual([p.title, p.commissionFen, p.quota, p.estHours, p.requirements.length], ['探店笔记', 1250, 50, '约 2 小时', 1])
  assert.equal(h.run('commissionText.value'), '', '提交后清空')
})

// ---------------------------------------------------------------- 服务端

test('服务端：新字段落到 kg_job 现有的列，不加迁移；老客户端不带时照旧', () => {
  const java = fs.readFileSync(JAVA, 'utf8')
  assert.match(java, /private void readPublishFields\(Map<String, Object> in\)/)
  for (const col of ['daily_hours', 'shift_time', 'settle_desc', 'probation', 'train_desc']) assert.match(java, new RegExp('row\\.put\\("' + col + '"'), col)
  assert.match(java, /row\.put\("board_type", d\.boardType\);/)
  assert.match(java, /throw new ServiceException\("换工岗位要提供住宿：请选包吃包住或只包住", 422\);/)
  assert.match(java, /return boardTyped \? BOARD_LABELS\.get\(boardType\) : "提供食宿";/)
  const sql = fs.readdirSync(path.join(APP, '../RuoYi-Vue/sql/kangaroo')).filter(f => /^V58__/.test(f))
  for (const name of sql) assert.doesNotMatch(fs.readFileSync(path.join(APP, '../RuoYi-Vue/sql/kangaroo', name), 'utf8'), /call kg_add_col_if_absent\('kg_job'/, '岗位发布字段不需要新增列')
})
