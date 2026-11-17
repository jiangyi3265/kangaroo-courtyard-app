// 2026-10-30 商家需求（V63）员工端几页的回归（node --test，不构建、不发请求）。守住这几件事：
//   · 业务页：换工主理人看到「线上任务审核」「商家岗位」（带待办数），小院主理人只有「线上任务报名审核」（10-30 去掉换工审核，五种身份的全表见 luna-staff-20261030.test.mjs），个数不同列数跟着变；换工主理人周报入口叫「招募周报」；
//   · 线上任务审核页：按当前门店取本城需求，消息带来的门店先切过去；确认转发选人（一位 / 多位 / 没有人转平台）、退回必须写原因、代商家提交就地校验；
//   · 商家服务人：接手 → 上架（线上任务没上架不能标完成）→ 标记完成；接手后只有接手的人有按钮；管理任务要先切到那家商家店；
//   · 城市负责人：只读，页面里没有任何写请求，手机号不给拨打；
//   · 岗位管理：只有 canPublish 的草稿有「上架 / 完善岗位信息 / 不通过」，完善时把岗位内容填回表单、用 PUT 保存；普通草稿不变；
//   · 工作台分支：商家服务人、城市负责人走自己的工作台，不去取完整员工工作台的数据（那些接口对他们 403）。
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
const load = (rel) => import(pathToFileURL(path.join(APP, rel)).href)
const v = await load('pages/staff/request-view.js')
const { useRequestList } = await load('pages/staff/request-list.js')
const salary = await load('common/job-salary.js')
const plain = (x) => (x === undefined ? undefined : JSON.parse(JSON.stringify(x)))
const flush = async () => { for (let i = 0; i < 6; i++) await new Promise(resolve => setImmediate(resolve)) }

const NEW_FILES = ['pages/staff/intake.vue', 'pages/staff/service.vue', 'pages/staff/city.vue', 'pages/staff/components/k-service-work.vue',
  'pages/staff/components/k-city-work.vue', 'pages/staff/components/k-request-row.vue', 'pages/staff/components/k-request-detail.vue']

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
  Object.assign(sandbox, { ref: vue.ref, computed: vue.computed, watch: vue.watch, reactive: vue.reactive, onShow() {}, onHide() {}, onUnload() {}, onUnmounted() {}, onLoad() {}, onReachBottom() {}, onPullDownRefresh() {}, onMounted() {}, onBeforeUnmount() {}, getCurrentPages: () => [{}] }, stubs)
  vm.createContext(sandbox)
  const scope = vue.effectScope()
  scope.run(() => vm.runInContext(body, sandbox, { filename: rel + ':script-setup' }))
  return { run: code => vm.runInContext(code, sandbox), stop: () => scope.stop(), template: d.template.content, sandbox }
}

const ROW = { requestId: 7, requestType: 'online_task', typeLabel: '线上任务', title: '探店笔记', storeId: 201, storeName: '海边咖啡', city: '平潭', jobId: 88, status: 'pending_verify', statusLabel: '待换工主理人核实', source: 'merchant', createTime: '2026-10-30 09:30:00' }
const DETAIL = { ...ROW, content: '要 1 篇小红书', contactName: '林老板', contactPhone: '13800000001', images: [], verifyNote: '', returnReason: '', serviceUserId: null,
  job: { jobStatus: 'draft', headcount: 2, taskType: '内容写作', deliverables: '图文 1 篇', criteria: '原创', commissionFen: 12050, deadlineTime: '2026-11-01 20:00:00' } }

// ---------------------------------------------------------------- 规则（纯函数）

test('页签：?status= 只认这一页有的，别的落到第一个；商家服务人的「全部」是空状态', () => {
  assert.equal(v.tabOf(v.INTAKE_TABS, 'returned'), 'returned')
  assert.equal(v.tabOf(v.INTAKE_TABS, 'dispatched'), 'pending_verify')
  assert.equal(v.tabOf(v.INTAKE_TABS, undefined), 'pending_verify')
  assert.equal(v.tabOf(v.SERVICE_TABS, ''), '')
  assert.equal(v.tabOf(v.CITY_TABS, undefined), '')
})

test('列表标签：退回只写前半句（后半句是说给商家的），其余用服务端的中文', () => {
  assert.equal(v.shortStatus({ status: 'returned', statusLabel: '已退回，可修改后再提交' }), '已退回')
  assert.equal(v.shortStatus(ROW), '待换工主理人核实')
  for (const t of [...v.INTAKE_TABS, ...v.SERVICE_TABS, ...v.CITY_TABS, ...v.MERCHANT_JOB_TABS]) if (t.status) assert.notEqual(v.statusTone(t.status), undefined)
  assert.equal(v.statusTone('unassigned'), 'red')
  assert.equal(v.sourceText({ source: 'manager' }), '换工主理人代商家提交')
})

test('任务要点：佣金按分换算，空的不写；招募岗位写招募人数', () => {
  const rows = v.jobFacts(DETAIL.job)
  assert.deepEqual(rows.map(r => r.label), ['任务类型', '交付物', '验收标准', '单人佣金', '截止时间', '名额'])
  assert.equal(rows.find(r => r.label === '单人佣金').value, '¥120.5')
  assert.equal(v.jobFacts({ commissionFen: 12005 }).find(r => r.label === '单人佣金').value, '¥120.05')
  assert.deepEqual(v.jobFacts({ headcount: 3, content: '前台' }), [{ label: '招募人数', value: '3 人' }, { label: '工作内容', value: '前台' }])
  assert.deepEqual(v.jobFacts(null), [])
})

test('转发选人：一位直接列他；多位第一项是全部（不指定人）；没有人返回空', () => {
  assert.deepEqual(v.forwardChoices([{ userId: 5, name: '阿强' }]), [{ label: '阿强', userId: 5 }])
  const many = v.forwardChoices([{ userId: 5, name: '阿强' }, { userId: 6, name: '小美' }])
  assert.equal(many.length, 3)
  assert.equal(many[0].userId, null)
  assert.deepEqual(v.forwardChoices([]), [])
})

test('换工主理人的按钮：只有待核实能转发、退回', () => {
  assert.deepEqual(v.intakeActions(DETAIL), ['forward', 'return'])
  for (const status of ['forwarded', 'accepted', 'done', 'returned', 'unassigned']) assert.deepEqual(v.intakeActions({ status }), [], status)
})

test('商家服务人的按钮：接手 → 没上架的线上任务先上架 → 标完成；不是自己接手的没有按钮', () => {
  const online = { requestType: 'online_task', jobId: 88 }
  const draft = { ...online, job: { jobStatus: 'draft' } }, live = { ...online, job: { jobStatus: 'published' } }
  assert.deepEqual(v.serviceActions({ ...draft, status: 'forwarded', mine: false }), ['accept'])
  assert.deepEqual(v.serviceActions({ ...draft, status: 'accepted', mine: true }), ['publish'])
  assert.deepEqual(v.serviceActions({ ...live, status: 'accepted', mine: true }), ['done', 'manage'])
  assert.deepEqual(v.serviceActions({ ...live, status: 'accepted', mine: false }), [])
  assert.deepEqual(v.serviceActions({ ...live, status: 'done', mine: true }), ['manage'])
  assert.deepEqual(v.serviceActions({ requestType: 'managed', jobId: null, status: 'accepted', mine: true }), ['done'])
  assert.deepEqual(v.serviceActions({ requestType: 'managed', jobId: null, status: 'done', mine: true }), [])
  assert.match(v.serviceHint({ status: 'accepted', mine: false }), /其他商家服务人接手/)
  assert.match(v.serviceHint({ ...draft, status: 'accepted', mine: true }), /还没上架/)
})

test('代提交校验和服务端同一套；选了商家店只带门店编号，手机号去掉空格', () => {
  const f = v.newSubmitForm()
  assert.deepEqual(Object.keys(v.submitErrors(f)), ['store', 'content', 'contactName', 'contactPhone'])
  Object.assign(f, { storeName: '老街民宿', content: ' 想做代运营 ', contactName: ' 林 ', contactPhone: '138 0000-0001', requestType: 'cloud_chain' })
  assert.deepEqual(v.submitErrors(f), {})
  assert.deepEqual(v.submitPayload(f), { requestType: 'cloud_chain', content: '想做代运营', contactName: '林', contactPhone: '13800000001', images: [], storeName: '老街民宿' })
  f.merchantStoreId = 201
  const withStore = v.submitPayload(f)
  assert.equal(withStore.merchantStoreId, 201)
  assert.equal('storeName' in withStore, false)
  assert.ok(v.submitErrors({ ...f, contactPhone: '12345' }).contactPhone)
  assert.ok(v.submitErrors({ ...f, content: 'x'.repeat(2001) }).content)
})

const CATEGORIES = [['民宿', 'homestay'], ['酒店', 'hotel'], ['咖啡餐饮', 'food'], ['酒吧', 'bar'], ['其他', 'other']]
test('岗位填回表单：年龄、技能从要求里拆出来，门店类型拆回 category，默认食宿说明不留，门店地址算没选，薪资回到字符串', () => {
  const job = { jobType: 'fulltime', title: '店长', workKind: '', images: ['/profile/upload/a.jpg'], address: '门店路 1 号', latitude: 25.5, longitude: 119.7, salaryType: 'monthly', salaryMin: 5000.5, bonusDesc: '满月 500', commissionDesc: null, insuranceFlag: '0', monthRedpacket: '0', boardType: 'room', boardDesc: '包住宿', startDate: '2026-11-08', shiftDesc: null, dailyHours: '每天 8 小时', shiftTime: '9:00-18:00', settleDesc: '月结', probation: '1个月', trainDesc: '带薪培训', genderPref: '', restMode: '5-2', roomType: 'single', minDays: 30, headcount: 3, tags: '民宿,接待,做饭', content: '负责排房\n带换工', requirement: '年龄：18–35岁\n技能：接待、做饭\n有经验优先\n能长期在店' }
  const base = { jobType: 'fulltime', headcount: 2, salaryType: 'monthly', images: [], keywords: [] }
  const { form, gen } = v.draftJobForm(job, base, { categories: CATEGORIES, storeAddress: '门店路 1 号' })
  assert.deepEqual(gen, { title: '店长', work: '负责排房\n带换工', hope: '有经验优先\n能长期在店' })
  assert.equal(form.age, '18–35岁')
  assert.deepEqual(form.keywords, ['接待', '做饭'])
  assert.equal(form.category, 'homestay')
  assert.equal(form.boardType, 'room')
  assert.equal(form.boardEnabled, true)
  assert.equal(form.boardDesc, '')
  assert.equal(form.address, '')
  assert.equal(form.latitude, null)
  assert.equal(form.salaryEnabled, true)
  assert.equal(form.salary, '5000.5')
  assert.equal(form.pay, 'salary')
  assert.equal(form.bonusEnabled, true)
  assert.equal(form.commissionEnabled, false)
  assert.equal(form.insuranceFlag, '0')
  assert.equal(form.monthRedpacket, true)
  assert.equal(form.minDays, 30)
  assert.equal(form.headcount, 3)
})

test('岗位填回表单：换宿没有薪资时留默认周期，老数据不认识的食宿回到包吃包住；地图选的地点保留坐标', () => {
  const { form } = v.draftJobForm({ jobType: 'volunteer', salaryType: 'none', salaryMin: 0, boardType: 'none', address: '南舍庄园', latitude: 25.1, longitude: 119.2, tags: '', requirement: '' },
    { jobType: 'volunteer', headcount: 2, salaryType: 'daily' }, { categories: CATEGORIES, storeAddress: '门店路 1 号' })
  assert.equal(form.salaryEnabled, false)
  assert.equal(form.salaryType, 'daily')
  assert.equal(form.salary, '')
  assert.equal(form.boardType, 'all')
  assert.equal(form.pay, 'board')
  assert.equal(form.address, '南舍庄园')
  assert.equal(form.latitude, 25.1)
  assert.equal(form.category, '')
})

// ---------------------------------------------------------------- 分页

test('列表：换页签时晚到的旧结果不覆盖新的；翻页接在后面；出错给文字不抛', async () => {
  const pending = []
  const list = useRequestList((page) => new Promise((resolve, reject) => pending.push({ page, resolve, reject })))
  const first = list.reload()
  const second = list.reload()
  pending[1].resolve({ rows: [{ requestId: 2 }], total: 3, hasMore: true, city: '平潭' })
  await second
  pending[0].resolve({ rows: [{ requestId: 1 }], total: 1, hasMore: false, city: '大理' })
  await first
  assert.deepEqual(plain(list.rows.value), [{ requestId: 2 }])
  assert.equal(list.city.value, '平潭')
  const more = list.more()
  assert.equal(pending[2].page, 2)
  pending[2].resolve({ rows: [{ requestId: 3 }], hasMore: false })
  await more
  assert.deepEqual(plain(list.rows.value).map(r => r.requestId), [2, 3])
  assert.equal(list.hasMore.value, false)
  const again = list.reload()
  pending[3].reject(new Error('这项功能只有换工主理人可以使用'))
  await again
  assert.equal(list.error.value, '这项功能只有换工主理人可以使用')
  assert.deepEqual(plain(list.rows.value), [])
  assert.equal(list.loading.value, false)
})

// ---------------------------------------------------------------- 线上任务审核

function intakeHarness({ staff = [{ userId: 5, name: '阿强' }], stores = [{ storeId: 201, storeName: '海边咖啡' }], currentStore = 102, pick = () => 0, confirmOk = true, reason = '佣金没写清楚', page = 1 } = {}) {
  const log = { gets: [], posts: [], puts: [], toasts: [], gone: [], selected: [], confirms: [], backs: 0 }
  let boot = null, store = currentStore
  const s = vue.ref(page)
  const h = runSetup('pages/staff/intake.vue', {
    ...v, useRequestList,
    useScreen: (n, opts) => { boot = opts.onLoad; return s },
    ensureSession: async () => {}, hasStaffAccess: { value: true }, currentStaffStoreId: () => store,
    selectStaffStore: async (id) => { log.selected.push(id); store = id },
    get: async (url, params) => {
      log.gets.push([url, plain(params || {})])
      if (url.endsWith('/options')) return { data: { serviceStaff: staff, merchantStores: stores } }
      if (/\/intake\/\d+$/.test(url)) return { data: { ...DETAIL, verifyNote: '已电话核实' } }
      return { data: { rows: [ROW], total: 1, hasMore: false, city: '平潭' } }
    },
    post: async (url, body) => { log.posts.push([url, plain(body)]); return { msg: '已转给本城商家服务人', data: {} } },
    put: async (url, body) => { log.puts.push([url, plain(body)]); return { msg: '备注已保存' } },
    toast: (m) => log.toasts.push(m), go: (u) => log.gone.push(u), back: () => { log.backs++ },
    confirm: async (t, c) => { log.confirms.push([t, c]); return confirmOk }, prompt: async () => reason, pickPaged: async (labels) => pick(labels),
    errText: (e, d) => (e && e.message) || d, absUrl: x => x,
    uni: { pageScrollTo() {}, stopPullDownRefresh() {}, showLoading() {}, hideLoading() {} }
  })
  return { ...h, s, log, boot: async (q = {}) => { boot(q); await flush() } }
}

test('线上任务审核：默认取当前门店本城的待核实；消息带来的门店先切过去再打开那一条', async (t) => {
  const h = intakeHarness()
  t.after(h.stop)
  await h.boot()
  // 2026-11-03：先取三个项目的待核实数，落到第一个有的项目，列表带 type
  assert.deepEqual(h.log.gets[3], ['/app/staff/intake', { storeId: 102, type: 'online_task', status: 'pending_verify', pageNum: 1, pageSize: 20 }])
  assert.equal(h.run('list.rows.value.length'), 1)
  h.run("setStatus('returned')")
  await flush()
  assert.equal(h.log.gets.at(-1)[1].status, 'returned')

  const link = intakeHarness()
  t.after(link.stop)
  await link.boot({ storeId: '305', requestId: '7' })
  assert.deepEqual(link.log.selected, ['305'])
  assert.equal(link.s.value, 2)
  assert.deepEqual(link.log.gets[0], ['/app/staff/intake/7', { storeId: '305' }])
  assert.equal(link.run('noteDraft.value'), '已电话核实')
})

test('确认转发：一位直接转给他并带上备注；服务端用门店校验城市；转完回列表', async (t) => {
  const h = intakeHarness()
  t.after(h.stop)
  await h.boot({ requestId: '7' })
  h.run("noteDraft.value = ' 已确认佣金 '")
  await h.run('forward()')
  await flush()
  assert.deepEqual(h.log.posts, [['/app/staff/intake/7/forward?storeId=102', { serviceUserId: 5, verifyNote: '已确认佣金' }]])
  assert.match(h.log.confirms[0][1], /提醒阿强接手/)
  assert.equal(h.log.toasts.at(-1), '已转给本城商家服务人')
  assert.equal(h.s.value, 1)
})

test('确认转发：多位选「全部」不指定人；取消选择不发请求；没有人时问转平台', async (t) => {
  const many = intakeHarness({ staff: [{ userId: 5, name: '阿强' }, { userId: 6, name: '小美' }] })
  t.after(many.stop)
  await many.boot({ requestId: '7' })
  await many.run('forward()')
  assert.deepEqual(many.log.posts[0][1], { serviceUserId: null, verifyNote: '已电话核实' })
  assert.match(many.log.confirms[0][1], /本城全部商家服务人/)

  const cancel = intakeHarness({ pick: () => -1 })
  t.after(cancel.stop)
  await cancel.boot({ requestId: '7' })
  await cancel.run('forward()')
  assert.equal(cancel.log.posts.length, 0)

  const none = intakeHarness({ staff: [] })
  t.after(none.stop)
  await none.boot({ requestId: '7' })
  await none.run('forward()')
  assert.equal(none.log.confirms[0][0], '本城还没有商家服务人')
  assert.equal(none.log.posts[0][1].serviceUserId, null)
})

test('退回商家：没写原因不发请求；写了原因走退回接口', async (t) => {
  const empty = intakeHarness({ reason: '' })
  t.after(empty.stop)
  await empty.boot({ requestId: '7' })
  await empty.run('returnToMerchant()')
  assert.equal(empty.log.posts.length, 0)
  assert.equal(empty.log.toasts.at(-1), '请填写退回原因')

  const h = intakeHarness()
  t.after(h.stop)
  await h.boot({ requestId: '7' })
  await h.run('returnToMerchant()')
  assert.deepEqual(h.log.posts, [['/app/staff/intake/7/return?storeId=102', { reason: '佣金没写清楚' }]])
})

test('别人刚处理过（409）：留在详情并取回最新状态，不留着点不动的按钮', async (t) => {
  const h = intakeHarness()
  t.after(h.stop)
  await h.boot({ requestId: '7' })
  h.sandbox.post = async () => { const e = new Error('这条需求刚刚已被处理，请刷新后查看'); e.code = 409; throw e }
  const before = h.log.gets.length
  await h.run('forward()')
  await flush()
  assert.equal(h.s.value, 2)
  assert.equal(h.log.toasts.at(-1), '这条需求刚刚已被处理，请刷新后查看')
  assert.equal(h.log.gets.slice(before).filter(g => g[0] === '/app/staff/intake/7').length, 1)
})

test('备注：改了才出保存；保存走备注接口', async (t) => {
  const h = intakeHarness()
  t.after(h.stop)
  await h.boot({ requestId: '7' })
  assert.equal(h.run('noteDirty.value'), false)
  h.run("noteDraft.value = '新备注'")
  assert.equal(h.run('noteDirty.value'), true)
  await h.run('saveNote()')
  assert.deepEqual(h.log.puts, [['/app/staff/intake/7/note?storeId=102', { verifyNote: '新备注' }]])
  assert.equal(h.run('noteDirty.value'), false)
})

test('代商家提交：缺项就地标红不发请求；选本城商家店；提交后回列表', async (t) => {
  const h = intakeHarness()
  t.after(h.stop)
  await h.boot()
  await h.run('openSubmit()')
  await flush()
  assert.equal(h.s.value, 3)
  await h.run('submit()')
  assert.equal(h.log.posts.length, 0)
  assert.deepEqual(Object.keys(plain(h.run('err.value'))), ['store', 'content', 'contactName', 'contactPhone'])
  await h.run('pickStore()')
  h.run("form.value.content = '想做代运营'; form.value.contactName = '林'; form.value.contactPhone = '13800000001'")
  await h.run('submit()')
  await flush()
  assert.deepEqual(h.log.posts[0], ['/app/staff/intake/submit?storeId=102', { requestType: 'managed', content: '想做代运营', contactName: '林', contactPhone: '13800000001', images: [], merchantStoreId: 201 }])
  assert.equal(h.s.value, 1)
})

test('商家岗位（?kind=jobs）：取派单列表，点开切到那家店的岗位管理；没有代提交', async (t) => {
  const h = intakeHarness()
  t.after(h.stop)
  await h.boot({ kind: 'jobs' })
  assert.deepEqual(h.log.gets[0], ['/app/staff/merchant-jobs', { storeId: 102, status: 'dispatched', pageNum: 1, pageSize: 20 }])
  h.run('openRow({ requestId: 9, storeId: 305 })')
  assert.deepEqual(h.log.gone, ['/pages/staff/jobs?storeId=305'])
  assert.match(h.template, /<view v-if="!jobsMode" class="req-head__act"/)
})

// ---------------------------------------------------------------- 商家服务人

function serviceHarness(detail, { confirmOk = true } = {}) {
  const log = { gets: [], posts: [], toasts: [], gone: [], selected: [] }
  let boot = null, current = detail
  const s = vue.ref(1)
  const h = runSetup('pages/staff/service.vue', {
    ...v, useRequestList, R: { staffOnline: '/pages/staff/online-jobs', staffApplications: '/pages/staff/applications' },
    useScreen: (n, opts) => { boot = opts.onLoad; return s },
    ensureSession: async () => {}, hasStaffAccess: { value: true }, currentStaffStoreId: () => 102,
    selectStaffStore: async (id) => { log.selected.push(id) },
    get: async (url, params) => {
      log.gets.push([url, plain(params || {})])
      return /\/requests\/\d+$/.test(url) ? { data: current } : { data: { rows: [], total: 0, hasMore: false, city: '平潭' } }
    },
    post: async (url) => { log.posts.push(url); return { msg: '已接手' } },
    toast: (m) => log.toasts.push(m), go: (u) => log.gone.push(u), back() {}, confirm: async () => confirmOk, errText: (e, d) => (e && e.message) || d,
    uni: { stopPullDownRefresh() {} }
  })
  return { ...h, s, log, set: (d) => { current = d }, boot: async (q = {}) => { boot(q); await flush() } }
}

test('商家服务人：列表默认待接手；接手、上架、标完成各走自己的接口，做完取回最新状态', async (t) => {
  const h = serviceHarness({ ...DETAIL, status: 'forwarded', statusLabel: '已转商家服务人', mine: false })
  t.after(h.stop)
  await h.boot()
  assert.deepEqual(h.log.gets[3], ['/app/staff/service/requests', { storeId: 102, type: 'online_task', status: 'forwarded', pageNum: 1, pageSize: 20 }])
  await h.run('openDetail(7)')
  assert.equal(h.run('mainAction.value'), 'accept')
  await h.run('runMain()')
  assert.deepEqual(h.log.posts, ['/app/staff/service/requests/7/accept?storeId=102'])

  h.set({ ...DETAIL, status: 'accepted', mine: true })
  await h.run('reloadDetail()')
  assert.equal(h.run('mainAction.value'), 'publish')
  await h.run('runMain()')
  assert.equal(h.log.posts.at(-1), '/app/staff/service/requests/7/publish?storeId=102')

  h.set({ ...DETAIL, status: 'accepted', mine: true, job: { ...DETAIL.job, jobStatus: 'published' } })
  await h.run('reloadDetail()')
  assert.equal(h.run('mainAction.value'), 'done')
  assert.deepEqual(plain(h.run('actions.value')), ['done', 'manage'])
  await h.run('runMain()')
  assert.equal(h.log.posts.at(-1), '/app/staff/service/requests/7/done?storeId=102')
})

test('商家服务人：不确认不发请求；别人接手的没有主按钮；管理任务先切到那家商家店', async (t) => {
  const h = serviceHarness({ ...DETAIL, status: 'forwarded', mine: false }, { confirmOk: false })
  t.after(h.stop)
  await h.boot({ requestId: '7' })
  assert.equal(h.s.value, 2)
  await h.run('runMain()')
  assert.equal(h.log.posts.length, 0)

  h.set({ ...DETAIL, status: 'accepted', mine: false })
  await h.run('reloadDetail()')
  assert.equal(h.run('mainAction.value'), '')

  h.set({ ...DETAIL, status: 'done', mine: true, job: { ...DETAIL.job, jobStatus: 'published' } })
  await h.run('reloadDetail()')
  assert.equal(h.run('mainAction.value'), 'manage')
  await h.run('manageTask()')
  assert.deepEqual(h.log.selected, [201])
  assert.deepEqual(h.log.gone, ['/pages/staff/online-jobs?jobId=88&storeId=201'])
  await h.run('openApplications()')
  assert.equal(h.log.gone.at(-1), '/pages/staff/applications?jobType=online&storeId=201')
})

test('兼任的小院主理人：打开任务不切当前门店（工作台还是小院），地址带门店；本机还不知道这家店时刷新一次，还没有就提示', async (t) => {
  const h = serviceHarness({ ...DETAIL, status: 'done', mine: true, job: { ...DETAIL.job, jobStatus: 'published' } })
  t.after(h.stop)
  let refreshed = 0
  const stores = vue.ref([{ storeId: 102, roleCode: 'keeper', alsoService: true }])
  Object.assign(h.sandbox, { currentStaffStore: { value: { storeId: 102, roleCode: 'keeper', alsoService: true } }, staffStores: stores, refreshAccount: async () => { refreshed++ } })
  await h.boot({ requestId: '7' })

  await h.run('manageTask()')
  assert.deepEqual(h.log.selected, [], '不切门店')
  assert.equal(refreshed, 1, '本机没有这家店：刷新一次账号')
  assert.deepEqual(h.log.gone, [], '刷新后还没有：授权已被撤销，不进任务页')
  assert.match(h.log.toasts.at(-1), /授权已失效/)

  stores.value = [...stores.value, { storeId: 201, roleCode: 'merchant_service' }]
  await h.run('manageTask()')
  assert.deepEqual(h.log.selected, [])
  assert.equal(refreshed, 1, '已经知道的不再刷新')
  assert.deepEqual(h.log.gone, ['/pages/staff/online-jobs?jobId=88&storeId=201'])
  await h.run('openApplications()')
  assert.equal(h.log.gone.at(-1), '/pages/staff/applications?jobType=online&storeId=201')
  assert.deepEqual(h.log.selected, [])
})

test('后台刚勾上兼任、本机快照还是旧的：先刷新账号再判断，不把当前门店切到商家店', async (t) => {
  const h = serviceHarness({ ...DETAIL, status: 'done', mine: true, job: { ...DETAIL.job, jobStatus: 'published' } })
  t.after(h.stop)
  let refreshed = 0
  const store = { value: { storeId: 102, roleCode: 'keeper', alsoService: false } }
  const stores = vue.ref([store.value, { storeId: 201, roleCode: 'merchant_service' }])
  Object.assign(h.sandbox, { currentStaffStore: store, staffStores: stores, refreshAccount: async () => { refreshed++; store.value = { ...store.value, alsoService: true } } })
  await h.boot({ requestId: '7' })
  await h.run('manageTask()')
  assert.equal(refreshed, 1)
  assert.deepEqual(h.log.selected, [], '不切门店')
  assert.deepEqual(h.log.gone, ['/pages/staff/online-jobs?jobId=88&storeId=201'])

  // 刷新后确实没开兼任（普通小院主理人走到这里只可能是旧链接）：按原来的切门店走；刷新失败：不切，提示
  store.value = { storeId: 102, roleCode: 'keeper', alsoService: false }
  h.sandbox.refreshAccount = async () => {}
  await h.run('manageTask()')
  assert.deepEqual(h.log.selected, [201])
  h.sandbox.refreshAccount = async () => { throw new Error('网络不好') }
  await h.run('manageTask()')
  assert.deepEqual(h.log.selected, [201], '读不到最新状态时不切')
  assert.equal(h.log.toasts.at(-1), '网络不好')
})

test('线上任务页：地址带了门店时，切换任务也看那家店（兼任的人当前门店是自己的小院）', () => {
  const s = src('pages/staff/online-jobs.vue')
  assert.match(s, /apiOnlineTasks\(taskStore\.value \|\| sid\(\)\)/)
  assert.match(s, /loadTask\(tasks\.value\[i\]\.jobId, taskStore\.value \|\| sid\(\)\)/)
  // 页面不按当前门店的角色藏验收、付款：都听服务端按那家店授权算的 canReview / canPay
  assert.doesNotMatch(s, /staffCan\(/)
})

// ---------------------------------------------------------------- 城市负责人

test('城市负责人：页面里只有读接口，详情不给拨打；工作台也是', () => {
  for (const rel of ['pages/staff/city.vue', 'pages/staff/components/k-city-work.vue']) {
    const s = src(rel)
    assert.doesNotMatch(s, /\b(post|put|del)\(/, rel)
    assert.match(s, /import \{ get \} from '@\/common\/request\.js'/, rel)
    assert.doesNotMatch(s, /callable/, rel)
  }
})

test('城市负责人：各店概况读 /city/overview；需求按状态筛；切页签才取那一份', async (t) => {
  const log = []
  let boot = null
  const s = vue.ref(1)
  const h = runSetup('pages/staff/city.vue', {
    ...v, useRequestList, useScreen: (n, opts) => { boot = opts.onLoad; return s }, ensureSession: async () => {}, hasStaffAccess: { value: true },
    currentStaffStoreId: () => 102, getSessionRevision: () => 1, errText: (e, d) => (e && e.message) || d, toast() {}, back() {},
    get: async (url, params) => {
      log.push([url, plain(params || {})])
      return url.endsWith('/overview')
        ? { data: { city: '平潭', shortfall: 3, arriving: 1, leaving: 0, shops: [{ storeId: 1, name: '甲', shortfall: 3, jobs: [], arrivals: [{ appId: 1 }], departures: [] }, { storeId: 2, name: '乙', shortfall: 0, jobs: [], arrivals: [], departures: [] }] } }
        : { data: { rows: [], total: 0, hasMore: false, city: '平潭' } }
    },
    uni: { stopPullDownRefresh() {} }
  })
  t.after(h.stop)
  boot({})
  await flush()
  assert.deepEqual(log, [['/app/staff/city/requests', { storeId: 102, status: '', pageNum: 1, pageSize: 20 }]])
  h.run("setView('shops')")
  await flush()
  assert.deepEqual(log.at(-1), ['/app/staff/city/overview', { storeId: 102 }])
  assert.deepEqual(plain(h.run('visibleShops.value')).map(x => x.name), ['甲'])
  h.run("shopTab.value = 'leaving'")
  assert.equal(h.run('visibleShops.value.length'), 0)
  assert.equal(h.run('shopEmpty.value'), '未来一周暂无合约到期的换工')
})

// ---------------------------------------------------------------- 业务页、工作台分支

const PERMS = { manager: { intake: ['view', 'edit', 'audit'], online: [] }, keeper: { intake: [], online: ['view', 'edit', 'audit'] }, staff: { intake: [], online: [] } }
function businessHarness(role) {
  const log = { gone: [] }
  const h = runSetup('pages/staff/business.vue', {
    ...v, R: { weekly: '/pages/manage/weekly', tasks: '/pages/manage/tasks', daily: '/pages/manage/daily', dashboard: '/pages/manage/dashboard', staffApplications: '/pages/staff/applications', staff: '/pages/staff/index', messages: '/pages/messages/index', profile: '/pages/profile/index' },
    useScreen: () => vue.ref(1), onlineStaff: { value: false }, merchantStaff: { value: false }, merchantService: { value: false }, cityLead: { value: false },
    staffCan: (item, action) => (PERMS[role][item] || ['view']).includes(action), currentStaffStore: { value: { roleCode: role, storeId: 102 } }, currentStaffStoreId: () => 102,
    staffStoreUrl: (u, id = 102) => u + (u.includes('?') ? '&' : '?') + 'storeId=' + id, go: (u) => log.gone.push(u), getSessionRevision: () => 1, ensureSession: async () => {}, hasStaffAccess: { value: true }, absUrl: x => x
  })
  return { ...h, log }
}

test('业务页入口：换工主理人「线上任务审核 / 商家岗位 / 换工审核」带待办数；小院主理人只有「线上任务报名审核」；员工只有一个，列数跟着变', async (t) => {
  const m = businessHarness('manager')
  t.after(m.stop)
  m.run("hub.value = { storeId: 102, role: 'manager', intakePending: 3, merchantJobsPending: 2 }")
  const entries = () => plain(m.run('reviewEntries.value.map(e => [e.label, e.badge || 0])'))
  assert.deepEqual(entries(), [['商家需求审核', 3], ['商家岗位', 2], ['换工审核', 0]])
  m.run('reviewEntries.value[0].open(); reviewEntries.value[1].open()')
  assert.deepEqual(m.log.gone, ['/pages/staff/intake?storeId=102', '/pages/staff/intake?kind=jobs&storeId=102'])
  assert.deepEqual(plain(m.run('daily.value.map(x => x.label)'))[0], '招募周报')

  const k = businessHarness('keeper')
  t.after(k.stop)
  k.run("hub.value = { storeId: 102, role: 'keeper' }")
  assert.deepEqual(plain(k.run('reviewEntries.value.map(e => e.label)')), ['线上任务报名审核'])
  k.run('reviewEntries.value[0].open()')
  assert.deepEqual(k.log.gone, ['/pages/staff/applications?jobType=online&storeId=102'])
  assert.equal(plain(k.run('daily.value.map(x => x.label)'))[0], '周报管理')

  const st = businessHarness('staff')
  t.after(st.stop)
  st.run("hub.value = { storeId: 102, role: 'staff' }")
  assert.deepEqual(plain(st.run('reviewEntries.value.map(e => e.label)')), ['换工审核'])

  const page = src('pages/staff/business.vue')
  assert.match(page, /:class="'review-entries--' \+ reviewEntries\.length"/)
  assert.match(page, /\.function-grid\.review-entries--1 \{ grid-template-columns: minmax\(0, 1fr\); \}/)
  assert.match(page, /\.function-grid\.review-entries--3 \{ grid-template-columns: repeat\(3, minmax\(0, 1fr\)\); \}/)
})

test('工作台分支：两个新角色排在商家后面，显式引入、不走 easycom；不去取完整工作台的数据', () => {
  // 2026-11-01：城市工作台的分支多了条件（全部权限的城市负责人还能进日常），见 citylead-full-20261101.test.mjs
  for (const rel of ['pages/staff/index.vue', 'pages/staff/business.vue']) {
    const s = src(rel)
    assert.match(s, /<k-merchant-work v-else-if="merchantStaff" \/>\n {2}<k-service-work v-else-if="merchantService"(?: active-tab="business")? \/>\n {2}<k-city-work v-else-if="cityLead && [^"]+" \/>\n {2}<template v-else>/, rel)
    assert.match(s, /import KServiceWork from '\.\/components\/k-service-work\.vue'/, rel)
    assert.match(s, /import KCityWork from '\.\/components\/k-city-work\.vue'/, rel)
    assert.match(s, /import \{[^}]*\bmerchantService\b[^}]*\bcityLead\b[^}]*\} from '@\/common\/experience\.js'/, rel)
  }
  assert.match(src('pages/staff/index.vue'), /if \(!hasStaffAccess\.value \|\| !fullWorkbench\(\)\) return/)
  assert.match(src('pages/staff/business.vue'), /onlineStaff\.value \|\| merchantStaff\.value \|\| merchantService\.value \|\| \(cityLead\.value && !cityLeadFull\.value\)\) return/)
})

test('页面都在 staff 分包注册；接口和路由不往主包的 common/api.js、routes.js 加', () => {
  const pages = JSON.parse(src('pages.json'))
  const staff = pages.subPackages.find(p => p.root === 'pages/staff')
  for (const name of ['intake', 'service', 'city']) {
    const page = staff.pages.find(p => p.path === name)
    assert.ok(page, name)
    assert.equal(page.style.navigationStyle, 'custom')
    assert.equal(page.style.enablePullDownRefresh, true)
  }
  assert.doesNotMatch(src('common/api.js'), /\/app\/staff\/(intake|service|city|merchant-jobs)/)
  assert.doesNotMatch(src('common/routes.js'), /staff\/(intake|service|city)'/)
})

test('新文件能被编译器解析，没有表情', () => {
  for (const rel of NEW_FILES) {
    const { errors, descriptor } = compiler.parse(src(rel), { filename: rel })
    assert.deepEqual(errors, [], rel)
    assert.ok(descriptor.template && descriptor.scriptSetup, rel)
    const compiled = compiler.compileTemplate({ source: descriptor.template.content, filename: rel, id: 'x' })
    assert.deepEqual(compiled.errors, [], rel)
    assert.doesNotMatch(src(rel), /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u, rel)
  }
})

// ---------------------------------------------------------------- 岗位管理

function jobsHarness({ rows = [], picks = [], reason = '工作内容不清楚', detail } = {}) {
  const log = { gets: [], posts: [], puts: [], sheets: [], toasts: [], selected: [], confirms: [] }
  let onLoad = null, store = 102
  const s = vue.ref(1)
  const queue = picks.slice()
  const h = runSetup('pages/staff/jobs.vue', {
    ...v,
    useScreen: (n, opts) => { onLoad = opts && opts.onLoad; return s },
    onShareAppMessage() {}, ensureSession: async () => {}, hasStaffAccess: { value: true }, merchantStaff: { value: false },
    currentStaffStoreId: () => store, selectStaffStore: async (id) => { log.selected.push(id); store = id }, staffCan: () => true, absUrl: x => x,
    todayCn: () => '2026-10-30', shiftDate: () => '2026-11-06', isYmd: (x) => /^\d{4}-\d{2}-\d{2}$/.test(String(x || '')),
    validateSalaryForm: salary.validateSalaryForm, salaryPayload: salary.salaryPayload, jobBenefits: salary.jobBenefits,
    parseSalaryAmount: salary.parseSalaryAmount, SALARY_OPTIONS: salary.SALARY_OPTIONS, salaryOption: salary.salaryOption,
    toast: (m) => log.toasts.push(m), go() {}, back() {}, errText: (e, d) => (e && e.message) || d, R: { staffOnline: '/pages/staff/online-jobs', staffJobs: '/pages/staff/jobs' },
    confirm: async (title, msg) => { log.confirms.push([title, msg]); return true }, prompt: async () => reason,
    sheet: async (opts) => { log.sheets.push(opts); return queue.length ? opts.indexOf(queue.shift()) : -1 },
    apiStaffJobs: async () => ({ data: { rows, canEdit: true, storeCert: false, storeAddress: '门店路 1 号' } }),
    apiStaffJobKeywords: async () => ({ data: [] }), apiJobKinds: async () => ({ data: [] }),
    get: async (url) => { log.gets.push(url); return { data: detail } },
    post: async (url, body) => { log.posts.push([url, plain(body)]); return { msg: '已上架' } },
    put: async (url, body) => { log.puts.push([url, plain(body)]); return { msg: '已保存', data: { jobId: 321, title: body.title } } },
    uni: { pageScrollTo() {} }
  })
  return { ...h, s, log, load: async (q = {}) => { onLoad(q); await flush() } }
}
const DRAFT = { jobId: 321, title: '前台换工', jobType: 'volunteer', status: 'draft', statusLabel: '换工主理人完善中', canPublish: true, requestId: 9, requestStatus: 'dispatched', images: [] }
const PLAIN_DRAFT = { ...DRAFT, jobId: 322, statusLabel: '待平台审核', canPublish: false, requestId: null }

test('岗位管理：消息带来的门店先切过去再取列表；顶上提示只数派给他的草稿', async (t) => {
  const h = jobsHarness({ rows: [DRAFT, PLAIN_DRAFT] })
  t.after(h.stop)
  await h.load({ storeId: '305' })
  assert.deepEqual(h.log.selected, ['305'])
  assert.equal(h.run('draftRows.value.length'), 1)
  assert.match(h.template, /个商家岗位等你完善并上架/)
})

test('岗位管理：派单草稿有上架 / 完善 / 不通过，普通草稿没有（仍只能后台上架）', async (t) => {
  const h = jobsHarness({ rows: [DRAFT, PLAIN_DRAFT] })
  t.after(h.stop)
  await h.load()
  await h.run('jobActions(jobList.value[0])')
  assert.deepEqual(plain(h.log.sheets[0]).slice(0, 3), ['上架', '完善岗位信息', '不通过'])
  assert.ok(h.log.sheets[0].length <= 6, '系统菜单最多 6 项')
  await h.run('jobActions(jobList.value[1])')
  for (const a of ['上架', '完善岗位信息', '不通过']) assert.equal(h.log.sheets[1].includes(a), false, a)
})

test('岗位管理：上架、不通过走商家岗位接口；不通过必须写原因', async (t) => {
  const h = jobsHarness({ rows: [DRAFT], picks: ['上架'] })
  t.after(h.stop)
  await h.load()
  await h.run('jobActions(jobList.value[0])')
  await flush()
  assert.match(h.log.confirms[0][1], /上架后用户就能看到并报名/)
  assert.deepEqual(h.log.posts[0][0], '/app/staff/merchant-jobs/321/publish')

  const c = jobsHarness({ rows: [DRAFT], picks: ['不通过'] })
  t.after(c.stop)
  await c.load()
  await c.run('jobActions(jobList.value[0])')
  await flush()
  assert.deepEqual(c.log.posts[0], ['/app/staff/merchant-jobs/321/close', { reason: '工作内容不清楚' }])

  const e = jobsHarness({ rows: [DRAFT], picks: ['不通过'], reason: '' })
  t.after(e.stop)
  await e.load()
  await e.run('jobActions(jobList.value[0])')
  await flush()
  assert.equal(e.log.posts.length, 0)
  assert.equal(e.log.toasts.at(-1), '请填写不通过的原因')
})

const JOB_ROW = { jobType: 'parttime', title: '周末吧台', images: ['/profile/upload/a.jpg'], address: '门店路 1 号', salaryType: 'daily', salaryMin: 150, boardType: 'none', startDate: '2026-11-08', headcount: 2, tags: '咖啡', content: '出品咖啡', requirement: '年龄：18–30岁\n技能：咖啡\n周末能到岗', insuranceFlag: '1', monthRedpacket: '1' }
test('岗位管理：完善时内容填回表单，PUT 保存（不新建岗位）；保存后问要不要上架；返回时没改不问、改了才问', async (t) => {
  const h = jobsHarness({ rows: [DRAFT], picks: ['完善岗位信息'], detail: { canEdit: true, job: JOB_ROW } })
  t.after(h.stop)
  await h.load()
  await h.run('jobActions(jobList.value[0])')
  await flush()
  // 2026-11-03：打开表单时顺带取一次年龄段 / 性格选项（V67），不算岗位读取
  assert.deepEqual(h.log.gets.filter(u => u !== '/app/job/requirement-options'), ['/app/staff/merchant-jobs/321'])
  assert.equal(h.s.value, 2)
  assert.equal(h.run('formOpen.value'), true)
  assert.equal(h.run('gen.value.title'), '周末吧台')
  assert.equal(h.run('gen.value.hope'), '周末能到岗')
  assert.equal(h.run('form.value.salary'), '150')
  assert.match(h.template, /<view v-if="formOpen && !submitted && draftJob" class="fc-bar">/)

  await h.run('backFromPublish()')
  assert.equal(h.log.confirms.length, 0, '没改不问')
  assert.equal(h.s.value, 1)
  assert.equal(h.run('draftJob.value'), null)

  const e = jobsHarness({ rows: [DRAFT], picks: ['完善岗位信息'], detail: { canEdit: true, job: JOB_ROW } })
  t.after(e.stop)
  await e.load()
  await e.run('jobActions(jobList.value[0])')
  await flush()
  e.run("gen.value = { ...gen.value, title: '周末吧台（改）' }")
  await e.run('submitJob()')
  await flush()
  assert.equal(e.log.puts.length, 1)
  const [url, body] = e.log.puts[0]
  assert.equal(url, '/app/staff/merchant-jobs/321')
  assert.equal(body.title, '周末吧台（改）')
  assert.equal(body.work, '出品咖啡')
  assert.equal(body.hope, '年龄：18–30岁\n技能：咖啡\n周末能到岗')
  assert.equal(body.salary, 150)
  assert.equal(body.salaryType, 'daily')
  assert.equal(body.boardType, 'none')
  assert.equal(e.s.value, 1)
  assert.equal(e.run('formOpen.value'), false)
  assert.deepEqual(e.log.confirms.at(-1)[0], '上架岗位', '保存后接着问要不要上架')
  assert.match(e.log.confirms.at(-1)[1], /周末吧台（改）/)
})

test('岗位管理：已经被处理过的（canEdit=false）不打开表单，刷新列表', async (t) => {
  const h = jobsHarness({ rows: [DRAFT], picks: ['完善岗位信息'], detail: { canEdit: false, job: JOB_ROW } })
  t.after(h.stop)
  await h.load()
  await h.run('jobActions(jobList.value[0])')
  await flush()
  assert.equal(h.run('formOpen.value'), false)
  assert.equal(h.log.toasts.at(-1), '这个商家岗位已经处理过了')
})
