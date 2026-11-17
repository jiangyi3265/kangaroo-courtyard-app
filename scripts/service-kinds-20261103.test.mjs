// 2026-11-03 主人看商家服务工作台：「任务页是哪个」「每个项目区分开别放到一起」「做成小院主理人那样的快捷入口，一个项目一个按钮，哪个有待办就有红点」。
// node --test，不构建、不发请求。守住：
//   · 商家需求页（商家服务人 service.vue、换工主理人 intake.vue）顶上按项目分：线上任务 | 代运营 | 抖音卖房，列表带 type；没指定项目时落到第一个有待办的；
//   · 「线上任务管理」（service.vue?manage=1）就是原来说明里的「任务页」入口：他接手的线上任务，行上直接「管理任务」「审核报名」，进 pages/staff/online-jobs；
//   · 工作台格子、优先处理的规则（serviceWorkbench）；只算他接手、已上架任务里的待审核报名和待验收成果。
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { createRequire } from 'node:module'
import test from 'node:test'
import assert from 'node:assert/strict'

const APP = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const require = createRequire(path.join(APP, 'package.json'))
const compiler = require('@vue/compiler-sfc'), vue = require('vue')
const src = (rel) => fs.readFileSync(path.join(APP, rel), 'utf8').replace(/\r\n/g, '\n')
const v = await import(pathToFileURL(path.join(APP, 'pages/staff/request-view.js')).href)
const { useRequestList } = await import(pathToFileURL(path.join(APP, 'pages/staff/request-list.js')).href)
const plain = (x) => (x === undefined ? undefined : JSON.parse(JSON.stringify(x)))
const flush = async () => { for (let i = 0; i < 8; i++) await new Promise(resolve => setImmediate(resolve)) }

function runSetup(rel, stubs) {
  const d = compiler.parse(src(rel), { filename: rel }).descriptor
  const source = d.scriptSetup.content
  const ast = compiler.babelParse(source, { sourceType: 'module' })
  const body = ast.program.body.filter(n => n.type !== 'ImportDeclaration').map(n => source.slice(n.start, n.end)).join('\n')
  const sandbox = { console, setTimeout, clearTimeout }
  for (const n of ast.program.body.filter(n => n.type === 'ImportDeclaration')) for (const s of n.specifiers) sandbox[s.local.name] = () => new Promise(() => {})
  Object.assign(sandbox, { ref: vue.ref, computed: vue.computed, watch: vue.watch, reactive: vue.reactive, onShow() {}, onHide() {}, onUnload() {}, onLoad() {}, onReachBottom() {}, onPullDownRefresh() {}, onMounted() {}, onBeforeUnmount() {}, getCurrentPages: () => [{}] }, stubs)
  vm.createContext(sandbox)
  const scope = vue.effectScope()
  scope.run(() => vm.runInContext(body, sandbox, { filename: rel + ':script-setup' }))
  return { run: code => vm.runInContext(code, sandbox), stop: () => scope.stop(), template: d.template.content, sandbox }
}

// ---------------------------------------------------------------- 规则（纯函数）

test('项目：地址带了用它；没带落到第一个有待办的，都没有就线上任务；页签数字超过 99 写 99+', () => {
  assert.deepEqual(v.REQUEST_KINDS.map(k => [k.type, k.label]), [['online_task', '线上任务'], ['managed', '代运营'], ['cloud_chain', '抖音卖房']])
  assert.equal(v.pickKind('cloud_chain', { managed: 3 }), 'cloud_chain')
  assert.equal(v.pickKind(undefined, { online_task: 0, managed: 0, cloud_chain: 2 }), 'cloud_chain')
  assert.equal(v.pickKind('volunteer', {}), 'online_task', '认不出的类型不用')
  assert.equal(v.pickKind('', null), 'online_task')
  assert.equal(v.kindBadge({ managed: 0 }, 'managed'), '')
  assert.equal(v.kindBadge({ managed: 5 }, 'managed'), '5')
  assert.equal(v.kindBadge({ managed: 120 }, 'managed'), '99+')
  assert.equal(v.kindInfo('nope').type, 'online_task')
})

test('哪行能直接「管理任务」：线上任务、上架过、他接手的（老服务端没有 mine 时交给服务端）', () => {
  const r = { requestType: 'online_task', jobId: 8, jobStatus: 'published', status: 'accepted', mine: true }
  assert.equal(v.canManageRow(r), true)
  assert.equal(v.canManageRow({ ...r, status: 'done', jobStatus: 'closed' }), true, '已完成、任务已关闭的也还能进去看验收付款')
  assert.equal(v.canManageRow({ ...r, mine: undefined }), true)
  assert.equal(v.canManageRow({ ...r, mine: false }), false)
  assert.equal(v.canManageRow({ ...r, jobStatus: 'draft' }), false, '还没上架')
  assert.equal(v.canManageRow({ ...r, status: 'forwarded' }), false, '还没接手')
  assert.equal(v.canManageRow({ ...r, requestType: 'managed', jobId: null }), false)
})

test('待办只算他接手的任务；工作台六个格子，优先处理最多四条', () => {
  const todo = v.taskTodos([{ jobId: 1, toReview: 2, toAccept: 0 }, { jobId: '2', toReview: 1, toAccept: 4 }, { jobId: 3, toReview: 9, toAccept: 9 }], [1, 2])
  assert.deepEqual(plain(todo), { byJob: { 1: { toReview: 2, toAccept: 0 }, 2: { toReview: 1, toAccept: 4 } }, toReview: 3, toAccept: 4 })
  const empty = v.serviceWorkbench({})
  assert.deepEqual(empty.quick.map(q => q.label), ['线上任务管理', '线上任务需求', '代运营', '抖音卖房', '待审核活动', '招募概况'])
  assert.ok(empty.quick.every(q => q.badge === ''))
  assert.deepEqual(empty.priority, [])
  const busy = v.serviceWorkbench({ online_task: 1, managed: 1, cloud_chain: 1, audit: 1, toReview: 1, toAccept: 1 })
  assert.equal(busy.priority.length, 4)
  assert.deepEqual(busy.priority.map(p => p.key), ['online_task', 'managed', 'cloud_chain', 'manage'])
  assert.equal(v.serviceWorkbench({ audit: null }).quick.find(q => q.key === 'audit').badge, '', '读不到不出红点')
})

// ---------------------------------------------------------------- 商家服务人的商家需求页

const ROW = { requestId: 7, requestType: 'online_task', typeLabel: '线上任务', title: '探店笔记', storeId: 201, storeName: '海边咖啡', jobId: 88, jobStatus: 'published', status: 'accepted', mine: true }
function servicePage({ counts = {}, rows = [ROW] } = {}) {
  const log = { gets: [], gone: [], selected: [] }
  let boot = null
  const s = vue.ref(1)
  const h = runSetup('pages/staff/service.vue', {
    ...v, useRequestList, R: { staffOnline: '/pages/staff/online-jobs', staffApplications: '/pages/staff/applications' },
    useScreen: (n, o) => { boot = o.onLoad; return s }, ensureSession: async () => {}, hasStaffAccess: { value: true }, currentStaffStoreId: () => 102,
    currentStaffStore: { value: { storeId: 102, roleCode: 'merchant_service' } }, staffStores: { value: [] }, refreshAccount: async () => {},
    selectStaffStore: async (id) => { log.selected.push(id) },
    get: async (url, params) => {
      log.gets.push([url, plain(params || {})])
      if (url === v.ONLINE_DAILY_API) return { data: { tasks: [{ jobId: 88, toReview: 2, toAccept: 1 }] } }
      if (params.pageSize === 1) return { data: { rows: [], total: counts[params.type] || 0 } }
      return { data: { rows, total: rows.length, hasMore: false, city: '平潭' } }
    },
    post: async () => ({}), toast() {}, go: (u) => log.gone.push(u), back() {}, confirm: async () => true, errText: (e, d) => d, uni: { stopPullDownRefresh() {} }
  })
  const lists = () => log.gets.filter(g => g[0] === v.SERVICE_API && g[1].pageSize === 20).map(g => g[1])
  return { ...h, s, log, lists, boot: async (q = {}) => { boot(q); await flush() } }
}

test('商家需求页：工作台带了项目就直接开那一栏（列表带 type），页签上是三类的待接手数', async (t) => {
  const h = servicePage({ counts: { managed: 2, cloud_chain: 1 } })
  t.after(h.stop)
  await h.boot({ type: 'managed', status: 'forwarded' })
  assert.deepEqual(h.lists(), [{ storeId: 102, type: 'managed', status: 'forwarded', pageNum: 1, pageSize: 20 }])
  assert.deepEqual(plain(h.run('kindCounts.value')), { online_task: 0, managed: 2, cloud_chain: 1 })
  // 换状态不换项目；换项目回到待接手
  h.run("setStatus('done')")
  await flush()
  assert.deepEqual(h.lists().at(-1), { storeId: 102, type: 'managed', status: 'done', pageNum: 1, pageSize: 20 })
  h.run("setKind('cloud_chain')")
  await flush()
  assert.deepEqual(h.lists().at(-1), { storeId: 102, type: 'cloud_chain', status: 'forwarded', pageNum: 1, pageSize: 20 })
  assert.equal(h.run('emptyText.value'), '「抖音卖房」这一栏还没有需求')
})

test('商家需求页：老入口没带项目时先看哪类有待接手，落到那一栏', async (t) => {
  const h = servicePage({ counts: { cloud_chain: 3 } })
  t.after(h.stop)
  await h.boot({})
  assert.equal(h.run('kind.value'), 'cloud_chain')
  assert.deepEqual(h.lists(), [{ storeId: 102, type: 'cloud_chain', status: 'forwarded', pageNum: 1, pageSize: 20 }])
  assert.ok(h.log.gets.findIndex(g => g[1].pageSize === 1) < h.log.gets.findIndex(g => g[1].pageSize === 20), '先取数再取列表')
})

test('商家需求页：消息带 requestId 打开详情，回列表时落在这条需求的项目上', async (t) => {
  const h = servicePage()
  t.after(h.stop)
  h.sandbox.get = async (url, params) => { h.log.gets.push([url, plain(params || {})]); return /\/requests\/\d+$/.test(url) ? { data: { ...ROW, requestType: 'managed', jobId: null } } : { data: { rows: [], total: 0 } } }
  await h.boot({ requestId: '7' })
  assert.equal(h.s.value, 2)
  assert.equal(h.run('kind.value'), 'managed')
})

test('线上任务管理（?manage=1）：只列线上任务，进行中 / 已完成；行上直接管理任务、审核报名，写着待办数', async (t) => {
  const h = servicePage()
  t.after(h.stop)
  await h.boot({ manage: '1' })
  assert.equal(h.run('manage.value'), true)
  assert.deepEqual(plain(h.run('tabs.value')), plain(v.MANAGE_TABS))
  assert.deepEqual(h.lists(), [{ storeId: 102, type: 'online_task', status: 'accepted', pageNum: 1, pageSize: 20 }])
  assert.ok(h.log.gets.some(g => g[0] === v.ONLINE_DAILY_API), '取了任务的待办数')
  assert.ok(!h.log.gets.some(g => g[1].pageSize === 1), '管理屏不取三类待接手数')
  assert.equal(h.run('todoText(list.rows.value[0])'), '2 份报名待审核 · 1 份成果待验收')
  await h.run('manageRow(list.rows.value[0])')
  assert.deepEqual(h.log.selected, [201], '纯商家服务人先切到那家商家店（和详情里的「管理任务」一样）')
  assert.deepEqual(h.log.gone, ['/pages/staff/online-jobs?jobId=88&storeId=201'])
  await h.run('applicationsRow(list.rows.value[0])')
  assert.equal(h.log.gone.at(-1), '/pages/staff/applications?jobType=online&storeId=201')
  assert.equal(h.run('emptyText.value'), '还没有你接手的线上任务')
})

test('商家需求页模板：项目页签在状态页签上面；线上任务一栏有「线上任务管理」入口；行上的按钮不触发打开详情', () => {
  const tpl = src('pages/staff/service.vue')
  assert.ok(tpl.indexOf('class="req-kinds"') < tpl.indexOf('class="req-tabs"'))
  assert.match(tpl, /<view v-if="kind === 'online_task'" class="req-links req-links--top">[\s\S]*?@click="openManage"[\s\S]*?线上任务管理[\s\S]*?接单、验收、付款登记/)
  assert.match(tpl, /@click\.stop="manageRow\(r\)"><text>管理任务<\/text>/)
  assert.match(tpl, /@click\.stop="applicationsRow\(r\)"><text>审核报名<\/text>/)
  assert.match(src('pages/staff/components/k-request-row.vue'), /<slot \/>\n {2}<\/view>\n<\/template>/)
})

// ---------------------------------------------------------------- 换工主理人：线上任务审核

function intakePage({ counts = {} } = {}) {
  const log = { gets: [] }
  let boot = null
  const s = vue.ref(1)
  const h = runSetup('pages/staff/intake.vue', {
    ...v, useRequestList, useScreen: (n, o) => { boot = o.onLoad; return s }, ensureSession: async () => {}, hasStaffAccess: { value: true }, currentStaffStoreId: () => 102, selectStaffStore: async () => {},
    get: async (url, params) => { log.gets.push([url, plain(params || {})]); return params.pageSize === 1 ? { data: { rows: [], total: counts[params.type] || 0 } } : { data: { rows: [], total: 0, city: '平潭' } } },
    toast() {}, go() {}, back() {}, errText: (e, d) => d, uni: { stopPullDownRefresh() {} }
  })
  return { ...h, s, log, boot: async (q = {}) => { boot(q); await flush() } }
}

test('线上任务审核：同样按项目分，落到第一个有待核实的；商家岗位（?kind=jobs）不分、不带 type', async (t) => {
  const h = intakePage({ counts: { managed: 1 } })
  t.after(h.stop)
  await h.boot({})
  assert.deepEqual(h.log.gets.filter(g => g[1].pageSize === 1).map(g => g[1].type + ':' + g[1].status), ['online_task:pending_verify', 'managed:pending_verify', 'cloud_chain:pending_verify'])
  assert.deepEqual(h.log.gets.at(-1), ['/app/staff/intake', { storeId: 102, type: 'managed', status: 'pending_verify', pageNum: 1, pageSize: 20 }])
  h.run("setKind('online_task')")
  await flush()
  assert.equal(h.log.gets.at(-1)[1].type, 'online_task')

  const jobs = intakePage()
  t.after(jobs.stop)
  await jobs.boot({ kind: 'jobs' })
  assert.deepEqual(jobs.log.gets, [['/app/staff/merchant-jobs', { storeId: 102, status: 'dispatched', pageNum: 1, pageSize: 20 }]])
  assert.match(src('pages/staff/intake.vue'), /<view v-if="!jobsMode" class="req-kinds">/)
})

test('改过的文件能编译，没有表情', () => {
  for (const rel of ['pages/staff/service.vue', 'pages/staff/intake.vue', 'pages/staff/components/k-service-work.vue', 'pages/staff/components/k-request-row.vue']) {
    const { errors, descriptor } = compiler.parse(src(rel), { filename: rel })
    assert.deepEqual(errors, [], rel)
    assert.deepEqual(compiler.compileTemplate({ source: descriptor.template.content, filename: rel, id: 'x' }).errors, [], rel)
    compiler.compileScript(descriptor, { id: 'x' })
    assert.doesNotMatch(src(rel), /[\u{1F300}-\u{1FAFF}]/u, rel)
  }
})
