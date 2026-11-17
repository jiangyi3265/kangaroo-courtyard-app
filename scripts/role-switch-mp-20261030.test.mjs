// 2026-10-30 角色两阶段切换：小程序这边的回归（node --test，不构建、不发真请求）。守住这几件事：
//   · 入口读服务端：切换前（legacy）城市负责人的工作台和今天一样，不去碰切换后才开放的接口；切换后（new）才有本城数字和财务入口，不用再发版；
//   · 财务页：退款审批、驳回、取消收费活动打到约定的接口，自己的报名没有按钮，取消要两步确认，失败也刷新；切换前打开如实显示服务端的话；
//   · 资金判断不写死角色：活动看 canPay，保险退款看权限表；「添加成员」的选项读 grantOptions，空数组时入口不显示；
//   · X-App-Client 请求头符合服务端要的格式；白名单只多了约定的三页；日报没有收件人时切换后不拦；
//   · 文字：manager 的显示名切换前后都是「换工主理人」，点名后两个阶段都说得通，钱的事不点名。
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
const load = (rel) => import(pathToFileURL(path.join(APP, rel)).href)
const v = await load('pages/staff/request-view.js')
const { useRequestList } = await load('pages/staff/request-list.js')
const plain = (x) => (x === undefined ? undefined : JSON.parse(JSON.stringify(x)))
const flush = async () => { for (let i = 0; i < 8; i++) await new Promise(resolve => setImmediate(resolve)) }

/** 在沙箱里跑页面的 script setup：导入一律先给永远不返回的函数，再用 stubs 覆盖用得到的那几个 */
function runSetup(rel, stubs) {
  const d = compiler.parse(src(rel), { filename: rel }).descriptor
  const source = d.scriptSetup.content
  const ast = compiler.babelParse(source, { sourceType: 'module' })
  const body = ast.program.body.filter(n => n.type !== 'ImportDeclaration').map(n => source.slice(n.start, n.end)).join('\n')
  const sandbox = { console, setTimeout, clearTimeout, setImmediate }
  for (const n of ast.program.body.filter(n => n.type === 'ImportDeclaration')) for (const s of n.specifiers) sandbox[s.local.name] = () => new Promise(() => {})
  Object.assign(sandbox, { ref: vue.ref, computed: vue.computed, watch: vue.watch, reactive: vue.reactive, onShow() {}, onHide() {}, onUnload() {}, onLoad() {}, onReachBottom() {}, onPullDownRefresh() {}, onMounted() {}, onBeforeUnmount() {}, uni: { showToast() {}, stopPullDownRefresh() {} } }, stubs)
  vm.createContext(sandbox)
  const scope = vue.effectScope()
  scope.run(() => vm.runInContext(body, sandbox, { filename: rel + ':script-setup' }))
  return { run: code => vm.runInContext(code, sandbox), stop: () => scope.stop(), template: d.template.content, sandbox }
}

// ---------------------------------------------------------------- 请求头

/** 用假 uni / wx 真跑一次 request()，取发出去的请求头 */
async function headerOf(wx) {
  const saved = { uni: globalThis.uni, wx: globalThis.wx }
  let header = null
  globalThis.uni = { getStorageSync: () => null, setStorageSync() {}, removeStorageSync() {}, request(o) { header = o.header; o.success({ data: { code: 200, data: {} } }) } }
  if (wx) globalThis.wx = wx; else delete globalThis.wx
  try {
    // 模块里缓存了结果：每种情况都加载一份新的
    const mod = await import(pathToFileURL(path.join(APP, 'common/request.js')).href + '?case=' + Math.random())
    await mod.get('/app/auth/ping')
    return header
  } finally {
    globalThis.uni = saved.uni
    if (saved.wx) globalThis.wx = saved.wx; else delete globalThis.wx
  }
}
// 和 AppAuthInterceptor 校验的格式一致：(develop|trial|release)/[0-9A-Za-z._-]{1,32}
const CLIENT_FORMAT = /^(develop|trial|release)\/[0-9A-Za-z._-]{1,32}$/

test('X-App-Client：正式版带微信给的版本号；体验版、开发版没有版本号时用代码里的版本；读不到不带，请求照发', async () => {
  const { APP_VERSION } = await load('common/config.js')
  assert.match(APP_VERSION, /^\d{4}\.\d{2}\.\d{2}\.\d+$/)
  const release = await headerOf({ getAccountInfoSync: () => ({ miniProgram: { envVersion: 'release', version: '2026.11.03.3' } }) })
  assert.equal(release['X-App-Client'], 'release/2026.11.03.3')
  assert.match(release['X-App-Client'], CLIENT_FORMAT)
  const trial = await headerOf({ getAccountInfoSync: () => ({ miniProgram: { envVersion: 'trial', version: '' } }) })
  assert.equal(trial['X-App-Client'], 'trial/' + APP_VERSION)
  assert.match(trial['X-App-Client'], CLIENT_FORMAT)
  const broken = await headerOf({ getAccountInfoSync() { throw new Error('不支持') } })
  assert.equal('X-App-Client' in broken, false)
  const h5 = await headerOf(null)
  assert.equal('X-App-Client' in h5, false)
  assert.equal(h5['Content-Type'], 'application/json;charset=UTF-8')
})

test('新版提示：微信下载好新版后问一声，点重启才应用；老基础库没有这个接口时启动不受影响', () => {
  const source = src('App.vue').match(/<script>([\s\S]*?)<\/script>/)[1].replace(/^\s*import .+$/gm, '').replace('export default', 'globalThis.app =')
  const launch = (wx) => {
    const context = vm.createContext({ wx, API_BASE: '/dev-api', ensureSession() {}, noteInviter() {}, installBackGuard() {}, startNewsPolling() {}, stopNewsPolling() {}, startStaffTaskReminders() {}, stopStaffTaskReminders() {}, console })
    vm.runInContext(source, context)
    context.app.onLaunch({})
  }
  launch({})
  let ready = null, applied = 0, modal = null
  launch({ getUpdateManager: () => ({ onUpdateReady(fn) { ready = fn }, applyUpdate() { applied++ } }), showModal(o) { modal = o } })
  assert.equal(typeof ready, 'function')
  ready()
  modal.success({ confirm: false })
  assert.equal(applied, 0)
  modal.success({ confirm: true })
  assert.equal(applied, 1)
})

// ---------------------------------------------------------------- 注册、白名单

test('财务页在 staff 分包、能下拉刷新；路径放 request-view.js，不往主包的 common/api.js、routes.js 加', () => {
  const pages = JSON.parse(src('pages.json').replace(/^﻿/, ''))
  const page = pages.subPackages.find(p => p.root === 'pages/staff').pages.find(p => p.path === 'city-finance')
  assert.ok(page)
  assert.equal(page.style.navigationStyle, 'custom')
  assert.equal(page.style.enablePullDownRefresh, true)
  // 服务端消息的 route 写死了这个路径（KgActivityService，?storeId=）
  assert.equal(v.CITY_FINANCE_PAGE, '/pages/staff/city-finance')
  assert.equal(v.CITY_FINANCE_API, '/app/staff/city-finance')
  assert.doesNotMatch(src('common/api.js'), /city-finance/)
  assert.doesNotMatch(src('common/routes.js'), /city-finance/)
})

const { pendingStaffRoute } = await import('../common/staff-scope.js')
function runGuard({ route, query = {}, current, grants }) {
  const code = src('main.js')
  const start = code.indexOf('async onLoad(q) {')
  const end = code.indexOf('\n\t\t}\n\t})', start)
  assert.ok(start > 0 && end > start, 'main.js 守卫没找到')
  const body = code.slice(start + 'async onLoad(q) {'.length, end)
  const redirects = []
  const sandbox = {
    pendingStaffRoute,
    getCurrentPages: () => [{ route }], ensureSession: async () => {},
    uni: { redirectTo: (o) => redirects.push(o.url), showToast() {} },
    experience: { account: { staffGrants: grants.map(g => ({ ...g, active: true })) } },
    currentStaffStore: { value: grants.find(g => g.storeId === current) }, staffStores: { value: grants }, hasStaffAccess: { value: true }, q: query, redirects
  }
  vm.createContext(sandbox)
  return vm.runInContext('(async () => {' + body + '\n})()', sandbox).then(() => redirects)
}

test('白名单：城市负责人多财务页、钱包、荣誉三页，别的经营页还是送回工作台；消息带门店按那家店的角色判', async () => {
  const lead = [{ storeId: 5, roleCode: 'city_lead' }]
  for (const route of ['pages/staff/index', 'pages/staff/business', 'pages/staff/city', 'pages/staff/city-finance', 'pages/manage/wallet', 'pages/manage/honor']) {
    assert.deepEqual(await runGuard({ route, current: 5, grants: lead }), [], route)
  }
  for (const route of ['pages/staff/activities', 'pages/staff/applications', 'pages/staff/jobs', 'pages/staff/insurance', 'pages/manage/dashboard', 'pages/manage/daily', 'pages/manage/weekly', 'pages/staff/online-jobs', 'pages/staff/stay-orders']) {
    assert.deepEqual(await runGuard({ route, current: 5, grants: lead }), ['/pages/staff/index'], route)
  }
  // 一人两个身份：当前在换工主理人那家店，消息点开退款审批带的是城市负责人那家店
  const both = [{ storeId: 2, roleCode: 'manager' }, { storeId: 5, roleCode: 'city_lead' }]
  assert.deepEqual(await runGuard({ route: 'pages/staff/city-finance', query: { storeId: '5' }, current: 2, grants: both }), [])
  // 换工主理人的线上任务、旅居页仍然进不去，和今天一样
  assert.deepEqual(await runGuard({ route: 'pages/staff/stay-orders', current: 2, grants: both }), ['/pages/staff/index'])
  assert.deepEqual(await runGuard({ route: 'pages/staff/online-jobs', current: 2, grants: both }), ['/pages/staff/index'])
})

test('城市预授权不能由业务子页直达绕过筹备态，有实店授权仍按原角色进入', async () => {
  for (const roleCode of ['manager', 'keeper', 'online_staff', 'merchant_service', 'merchant', 'city_lead']) {
    const grants = [{ active: true, storeId: null, cityId: 20, city: '大连', roleCode, fullAccess: roleCode === 'city_lead' }]
    assert.deepEqual(await runGuard({ route: 'pages/staff/jobs', current: null, grants }), ['/pages/staff/index'])
    assert.deepEqual(await runGuard({ route: 'pages/staff/business', current: null, grants }), [])
    grants.push({ active: true, storeId: 8, roleCode: 'manager' })
    assert.deepEqual(await runGuard({ route: 'pages/staff/jobs', current: null, query: { storeId: '8' }, grants }), [])
  }
})

// ---------------------------------------------------------------- 城市负责人工作台

function cityWork(hubData, { summaryThrows } = {}) {
  const calls = []
  const h = runSetup('pages/staff/components/k-city-work.vue', {
    ...v,
    get: async (url, params) => {
      calls.push(url)
      if (url === v.CITY_FINANCE_API + '/summary') {
        if (summaryThrows) throw new Error(summaryThrows)
        return { data: { city: '大理', storeId: 5, storeCount: 7, todayApplications: 3, openJobs: 12, inHouseGuests: 4 } }
      }
      if (url === v.CITY_API) return { data: { rows: [], city: '大理' } }
      return { data: { shortfall: 1, arriving: 2, leaving: 3 } }
    },
    apiStaffHub: async () => { calls.push('hub'); return { data: hubData } },
    ensureSession: async () => {}, getSessionRevision: () => 1, currentStaffStore: { value: { storeId: 5, roleCode: 'city_lead', storeName: '大理小院' } },
    staffStores: { value: [] }, go: (u) => calls.push('go:' + u), R: { wallet: '/pages/manage/wallet', honor: '/pages/manage/honor', staff: '/pages/staff/index' }, errText: (e, d) => e?.message || d, pickPaged: async () => -1
  })
  return { ...h, calls }
}

test('工作台·切换前：hub 没有 cityRefundPending，不显示财务入口，也不去碰切换后才开放的接口（避免 403）', async (t) => {
  const h = cityWork({ cityUnassigned: 2 })
  t.after(h.stop)
  await h.run('load()')
  await flush()
  assert.equal(plain(h.run('switched.value')), false)
  assert.ok(!h.calls.some(u => u.includes('city-finance')), h.calls.join())
  assert.equal(plain(h.run('unassigned.value')), 2)
  assert.deepEqual(plain(h.run('overviewTiles.value.map(t => t.value)')), [1, 2, 3])
  // 财务入口、本城数字都包在 v-if="switched" 里；只读说明切换前还是原话
  assert.match(h.template, /<template v-if="switched">[\s\S]*本城数字[\s\S]*活动退款审批[\s\S]*取消收费活动[\s\S]*我的钱包[\s\S]*荣誉与关怀[\s\S]*<\/template>\s*<view class="req-heading"><text>今日换工概况/)
  assert.match(h.template, /这里只能查看。商家发布招募或提交需求时，你也会在「消息」里收到通知。/)
})

test('工作台·切换后：不用发版，hub 带上字段就有本城数字、角标和四个入口', async (t) => {
  const h = cityWork({ cityUnassigned: 0, cityRefundPending: 3 })
  t.after(h.stop)
  await h.run('load()')
  await flush()
  assert.equal(plain(h.run('switched.value')), true)
  assert.equal(plain(h.run('refundPending.value')), 3)
  assert.deepEqual(plain(h.run('summaryTiles.value.map(t => [t.label, t.value])')), [['本城门店', 7], ['今日报名', 3], ['在招岗位', 12], ['在住人数', 4]])
  h.run("openFinance('refunds'); openFinance('activities')")
  assert.deepEqual(h.calls.filter(u => u.startsWith('go:')), ['go:/pages/staff/city-finance?tab=refunds', 'go:/pages/staff/city-finance?tab=activities'])
})

test('工作台·切换后：待审批是 0 也算切换后；本城数字读不到时说原因，别的照常', async (t) => {
  const h = cityWork({ cityRefundPending: 0 }, { summaryThrows: '请先在后台为当前门店设置所在城市' })
  t.after(h.stop)
  await h.run('load()')
  await flush()
  assert.equal(plain(h.run('switched.value')), true)
  assert.equal(plain(h.run('summaryError.value')), '请先在后台为当前门店设置所在城市')
  assert.deepEqual(plain(h.run('summaryTiles.value.map(t => t.value)')), [null, null, null, null])
  assert.deepEqual(plain(h.run('overviewTiles.value.map(t => t.value)')), [1, 2, 3])
})

test('工作台没有任何写请求：写操作都在财务页', () => {
  const s = src('pages/staff/components/k-city-work.vue')
  assert.doesNotMatch(s, /\b(post|put|del)\(/)
  assert.match(s, /import \{ get \} from '@\/common\/request\.js'/)
})

// ---------------------------------------------------------------- 财务页

const REFUND = { signupId: 31, activityId: 8, activityTitle: '洱海徒步', startTime: '2026-11-02 09:00:00', storeId: 5, storeName: '大理小院', city: '大理', name: '张*', phone: '138****0001', feeFen: 5000, refundFen: 5000, refundYuan: '50', cancelReason: '临时有事', cancelTime: '2026-10-30 10:00:00', mine: false }
const ACTIVITY = { activityId: 8, title: '洱海徒步', startTime: '2026-11-02 09:00:00', status: 'open', feeFen: 5000, feeYuan: '50', signed: 4, storeId: 5, storeName: '大理小院', city: '大理' }

function finance({ refunds = [REFUND], activities = [ACTIVITY], getThrows, postThrows, answers = {} } = {}) {
  const log = { gets: [], posts: [], toasts: [], confirms: [], prompts: [] }
  let onLoaded = null
  const h = runSetup('pages/staff/city-finance.vue', {
    ...v, useRequestList,
    get: async (url, params) => {
      log.gets.push([url, plain(params)])
      if (getThrows) throw new Error(getThrows)
      return { data: { rows: url.endsWith('/refunds') ? refunds : activities, total: (url.endsWith('/refunds') ? refunds : activities).length, hasMore: false } }
    },
    post: async (url, body) => {
      log.posts.push([url, plain(body)])
      if (postThrows) throw new Error(postThrows)
      return { code: 200, msg: '已处理', data: null }
    },
    ensureSession: async () => {},
    toast: (m) => log.toasts.push(m), errText: (e, d) => e?.message || d,
    confirm: async (title, content) => { log.confirms.push([title, content]); return answers.confirm !== false },
    prompt: async (title) => { log.prompts.push(title); return answers.prompt === undefined ? '人数不够' : answers.prompt },
    onLoad: (fn) => { onLoaded = fn }
  })
  return { ...h, log, open: (q) => onLoaded(q) }
}

test('财务页：默认看退款，消息带 ?storeId= 只看那一家，点「看全部门店」去掉；取消页签走 ?tab=activities', async (t) => {
  const h = finance()
  t.after(h.stop)
  await h.open({ storeId: '5' })
  await flush()
  assert.deepEqual(h.log.gets.at(-1), ['/app/staff/city-finance/refunds', { storeId: '5', pageNum: 1, pageSize: 20 }])
  h.run('clearStore()')
  await flush()
  assert.deepEqual(h.log.gets.at(-1), ['/app/staff/city-finance/refunds', { pageNum: 1, pageSize: 20 }])
  const a = finance()
  t.after(a.stop)
  await a.open({ tab: 'activities' })
  await flush()
  assert.deepEqual(a.log.gets.at(-1), ['/app/staff/city-finance/activities', { pageNum: 1, pageSize: 20 }])
})

test('财务页·同意退款：先确认，取消就不发；确认后打到约定的接口，提示服务端的话，再刷新', async (t) => {
  const no = finance({ answers: { confirm: false } })
  t.after(no.stop)
  await no.open({})
  await flush()
  await no.run('approveRefund(' + JSON.stringify(REFUND) + ')')
  assert.deepEqual(no.log.posts, [])

  const h = finance()
  t.after(h.stop)
  await h.open({})
  await flush()
  const before = h.log.gets.length
  await h.run('approveRefund(' + JSON.stringify(REFUND) + ')')
  await flush()
  assert.deepEqual(h.log.posts, [['/app/staff/city-finance/refunds/31/approve', undefined]])
  assert.match(h.log.confirms[0][1], /¥50/)
  assert.deepEqual(h.log.toasts, ['已处理'])
  assert.equal(h.log.gets.length, before + 1)
})

test('财务页·驳回：原因必填，取消不发；带原因打到约定的接口', async (t) => {
  const cancel = finance({ answers: { prompt: null } })
  t.after(cancel.stop)
  await cancel.open({})
  await flush()
  await cancel.run('rejectRefund(' + JSON.stringify(REFUND) + ')')
  assert.deepEqual(cancel.log.posts, [])
  const empty = finance({ answers: { prompt: '' } })
  t.after(empty.stop)
  await empty.open({})
  await flush()
  await empty.run('rejectRefund(' + JSON.stringify(REFUND) + ')')
  assert.deepEqual(empty.log.posts, [])
  assert.deepEqual(empty.log.toasts, ['请写明驳回原因'])
  const h = finance()
  t.after(h.stop)
  await h.open({})
  await flush()
  await h.run('rejectRefund(' + JSON.stringify(REFUND) + ')')
  await flush()
  assert.deepEqual(h.log.posts, [['/app/staff/city-finance/refunds/31/reject', { reason: '人数不够' }]])
})

test('财务页·取消活动：写原因后再确认一次（说清多少人会被退款和通知），确认才发', async (t) => {
  const no = finance({ answers: { confirm: false } })
  t.after(no.stop)
  await no.open({ tab: 'activities' })
  await flush()
  await no.run('cancelActivity(' + JSON.stringify(ACTIVITY) + ')')
  assert.deepEqual(no.log.posts, [])
  assert.equal(no.log.prompts.length, 1)
  assert.match(no.log.confirms[0][1], /已报名的 4 人会收到通知，已交的费用批量退款/)
  const h = finance()
  t.after(h.stop)
  await h.open({ tab: 'activities' })
  await flush()
  await h.run('cancelActivity(' + JSON.stringify(ACTIVITY) + ')')
  await flush()
  assert.deepEqual(h.log.posts, [['/app/staff/city-finance/activities/8/cancel', { reason: '人数不够' }]])
})

test('财务页：别人先审了（409）提示服务端的话并刷新；连点只发一次', async (t) => {
  const h = finance({ postThrows: '这条退款已经处理过了，请刷新' })
  t.after(h.stop)
  await h.open({})
  await flush()
  const before = h.log.gets.length
  await h.run('approveRefund(' + JSON.stringify(REFUND) + ')')
  await flush()
  assert.deepEqual(h.log.toasts, ['这条退款已经处理过了，请刷新'])
  assert.equal(h.log.gets.length, before + 1)
  const d = finance()
  t.after(d.stop)
  await d.open({})
  await flush()
  await Promise.all([d.run('approveRefund(' + JSON.stringify(REFUND) + ')'), d.run('approveRefund(' + JSON.stringify(REFUND) + ')')])
  await flush()
  assert.equal(d.log.posts.length, 1)
})

test('财务页·切换前：接口 403 时如实显示服务端的话，不是空列表', async (t) => {
  const h = finance({ getThrows: '这项功能要等角色切换后才开放' })
  t.after(h.stop)
  await h.open({})
  await flush()
  assert.equal(plain(h.run('refunds.error.value')), '这项功能要等角色切换后才开放')
  assert.deepEqual(plain(h.run('refunds.rows.value')), [])
})

test('财务页模板：自己的报名没有按钮；没有去平台外的入口；能编译；不写表情', () => {
  const rel = 'pages/staff/city-finance.vue'
  const { errors, descriptor } = compiler.parse(src(rel), { filename: rel })
  assert.deepEqual(errors, [])
  assert.deepEqual(compiler.compileTemplate({ source: descriptor.template.content, filename: rel, id: 'x' }).errors, [])
  assert.match(descriptor.template.content, /<text v-if="row\.mine"[^>]*>这是你自己的报名，请让平台处理<\/text>\s*<view v-else class="finance-card__acts">/)
  assert.doesNotMatch(src(rel), /[\u{1F300}-\u{1FAFF}]/u)
})

// ---------------------------------------------------------------- 资金判断、添加成员

test('资金判断不写死角色：活动只看服务端 canPay，保险退款看那家店角色的权限表；老的 isStoreManager 没有了', () => {
  assert.doesNotMatch(src('common/staff-perms.js'), /isStoreManager|isManagerOrKeeper/)
  for (const rel of ['pages/staff/activities.vue', 'pages/staff/insurance.vue']) assert.doesNotMatch(src(rel), /isStoreManager/, rel)
  assert.match(src('pages/staff/activities.vue'), /const canPayAct = computed\(\(\) => d\.value\.canPay != null \? !!d\.value\.canPay : staffCan\('activities', 'pay'\)\)/)
  // 2026-11-09 复查：切换后城市负责人权限表里 财务·支付 = 能，但服务端 needManager 只认切换前的 manager，按钮要跟服务端一致
  assert.match(src('pages/staff/insurance.vue'), /const canApprove = computed\(\(\) => \{ const g = grantAt\(rsStoreId\(\)\); return !!g && g\.roleCode === 'manager' && staffCan\('finance', 'pay', g\) \}\)/)
})

function businessRoles(data) {
  const log = { sheets: [], added: [], picked: [] }
  const h = runSetup('pages/staff/business.vue', {
    useScreen: () => vue.ref(3), onlineStaff: { value: false }, merchantStaff: { value: false }, merchantService: { value: false }, cityLead: { value: false },
    R: {}, staffCan: () => false, currentStaffStore: { value: { roleCode: 'manager', storeId: 102 } }, currentStaffStoreId: () => 102, staffStoreUrl: u => u,
    go() {}, getSessionRevision: () => 1, ensureSession: async () => {}, hasStaffAccess: { value: true }, absUrl: x => x,
    apiStaffRoles: async () => ({ data }), sheet: async (items) => { log.sheets.push(items); return log.answer ?? -1 }, pickPaged: async (items) => { log.picked.push(items); return -1 },
    prompt: async () => null, alert: async () => {}, toast() {}
  })
  return { ...h, log }
}

test('添加成员：切换前老主理人的选项和今天一样（读服务端），切换后空数组时入口不显示、点成员只看信息', async (t) => {
  const legacy = businessRoles({ canManage: true, roles: [{ code: 'staff', name: '员工', members: [] }], grantOptions: [{ code: 'staff', name: '员工' }, { code: 'keeper', name: '小院主理人' }, { code: 'online_staff', name: '线上任务专员' }] })
  t.after(legacy.stop)
  await legacy.run('loadRoles()')
  await legacy.run('newRole()')
  assert.deepEqual(plain(legacy.log.sheets[0]), ['添加员工', '添加小院主理人', '添加线上任务专员', '自定义角色'])
  await legacy.run("openRole({ code: 'staff', name: '员工', members: [] })")
  assert.deepEqual(plain(legacy.log.picked[0]), ['＋ 添加员工'])

  const switched = businessRoles({ canManage: false, roles: [], grantOptions: [] })
  t.after(switched.stop)
  await switched.run('loadRoles()')
  await switched.run('newRole()')
  assert.deepEqual(switched.log.sheets, [])
  await switched.run("openRole({ code: 'manager', name: '换工主理人', members: [{ name: '李四', userId: 9 }] })")
  assert.deepEqual(plain(switched.log.picked[0]), ['李四（会员编号 9）'])
  assert.match(switched.template, /<view v-if="grantOptions\.length" hover-class="k-press" @click="newRole">/)
})

// ---------------------------------------------------------------- 日报

function dailySend(data) {
  const log = { sent: 0, toasts: [] }
  const h = runSetup('pages/manage/daily.vue', {
    useScreen: () => vue.ref(4), apiDailySend: async () => { log.sent++; return { data: { sent: 0, message: '本城还没有城市负责人，日报已留在系统里，平台可以在后台查看' } } },
    toast: (m) => log.toasts.push(m), errText: (e, d) => e?.message || d, absUrl: x => x, ensureSession: async () => {}, hasStaffAccess: { value: true }, staffCan: () => false, experience: {}, currentStaffStore: { value: { storeId: 5, roleCode: 'keeper' } }, currentStaffStoreId: () => 5
  })
  h.run('(data) => { d.value = data }')(data)
  return { ...h, log }
}

test('日报发送：切换后旅居账没有城市负责人也能点（服务端如实回 sent:0）；切换前旅居账、招募账没有收件人还是拦', async (t) => {
  const none = dailySend({ managers: [], recipientKind: 'none', recipientTitle: '发送给城市负责人', recipientNote: '本城还没有城市负责人，日报留在系统里，平台可以在后台查看' })
  t.after(none.stop)
  await none.run('sendReport()')
  assert.equal(none.log.sent, 1)
  assert.match(none.log.toasts[0], /本城还没有城市负责人/)
  assert.equal(plain(none.run('managerName.value')), '暂时没有收件人')

  const legacy = dailySend({ managers: [] })
  t.after(legacy.stop)
  await legacy.run('sendReport()')
  assert.equal(legacy.log.sent, 0)
  assert.deepEqual(legacy.log.toasts, ['本店还没有换工主理人账号'])

  const recruit = dailySend({ managers: [], recipientKind: 'none', recipientEmpty: '本城还没有城市负责人，本店也没有其他换工主理人，暂时没有人可以发送' })
  t.after(recruit.stop)
  await recruit.run('sendReport()')
  assert.equal(recruit.log.sent, 0)
  assert.match(recruit.log.toasts[0], /暂时没有人可以发送/)
})

// ---------------------------------------------------------------- 文字

test('文字：不再把钱的事点名给主理人；「主理人或管家」的老说法换成切换前后都对的角色名', () => {
  assert.doesNotMatch(src('pages/staff/online-jobs.vue'), /待主理人|只有主理人可以登记付款|只有本店主理人可以更正|通知本店主理人/)
  assert.doesNotMatch(src('pages/staff/insurance.vue'), /待主理人审批|只有本店主理人可以审批退款/)
  assert.match(src('pages/staff/components/k-online-work.vue'), /验收通过后按结算流程处理/)
  for (const rel of ['pages/staff/applications.vue', 'pages/staff/interviews.vue', 'pages/staff/talents.vue', 'pages/staff/vlog.vue', 'pages/manage/weekly.vue']) {
    const shown = src(rel).split('\n').filter(line => !/^\s*\/\//.test(line)).join('\n')
    assert.doesNotMatch(shown, /主理人或管家|主理人或店长/, rel)
  }
  assert.match(src('pages/manage/tasks.vue'), /仅换工主理人或小院主理人可以发布任务/)
  // 面向用户的「联系主理人」和房源「主理人」不动
  assert.match(src('pages/manage/tasks.vue'), /请直接联系这家门店的主理人或管家沟通/)
  assert.match(src('pages/staff/rooms.vue'), /<text class="fc-row__k">主理人<\/text>/)
})

test('钱包：标题不写死「主理人」，小标签写账号实际的角色名；荣誉页城市负责人不放去经营页的按钮', async (t) => {
  const w = runSetup('pages/manage/wallet.vue', {
    useScreen: () => vue.ref(1), ensureSession: async () => {}, R: {}, go() {},
    experience: { account: { staffGrants: [{ active: true, roleCode: 'city_lead', roleName: '城市负责人' }, { active: true, roleCode: 'manager', roleName: '换工主理人' }, { active: false, roleCode: 'keeper', roleName: '小院主理人' }] } }
  })
  t.after(w.stop)
  assert.equal(plain(w.run('titles[0]')), '我的钱包')
  assert.equal(plain(w.run('ownerRole.value')), '')
  w.run('(x) => { w.value = x }')({ isManager: true })
  assert.equal(plain(w.run('ownerRole.value')), '城市负责人')
  const honor = src('pages/manage/honor.vue')
  for (const m of ['@click="openTrend"', '@click="openReviews"', '@click="openActivities"', '@click="openAdvice"']) {
    assert.ok(new RegExp('v-if="!cityLead"[^>]*' + m).test(honor), m)
  }
})

test('线上接待的名单：合作商家不再写成员工', () => {
  assert.match(src('components/k-chat-reception/k-chat-reception.vue'), /person\.roleCode === 'merchant' \? '合作商家' : '员工'/)
})
