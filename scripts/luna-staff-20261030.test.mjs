// 2026-10-30 店员 Luna 的备忘录（并入 20261030-merchant-roles）小程序部分的回归（node --test，不构建、不发请求）。守住这几件事：
//   · 小院主理人的工作台、业务页不再有换工内容：今日概览是本店旅居订单，不调换工接口；老链接和服务端权限不动，深链里的换工报名照样能打开；
//   · 同一个小院主理人开了「兼任商家服务人」：不切门店，工作台多线上任务三格和两条优先处理（点了去对应页面，不进任务详情），业务页多商家需求、活动审核、线上任务招募概况；
//   · 换工主理人、员工的页面不变；商家服务人走自己的工作台，不取完整工作台的数据；
//   · 商家首页四个板块不动，下面多「发布活动」；商家看到的活动文案不写「平台审核」；
//   · 商家服务人：上架按钮叫「审核通过并上架」，可以退回商家；新页 service-activities（审核活动）、online-daily（线上任务招募概况）。
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { createRequire } from 'node:module'
import test from 'node:test'
import assert from 'node:assert/strict'
import { pendingStaffScope, pendingStaffRoute } from '../common/staff-scope.js'
import { createServer } from 'vite'

const APP = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const require = createRequire(path.join(APP, 'package.json'))
const compiler = require('@vue/compiler-sfc'), vue = require('vue')
const src = (rel) => fs.readFileSync(path.join(APP, rel), 'utf8').replace(/\r\n/g, '\n')
const sfc = (rel) => compiler.parse(src(rel), { filename: rel }).descriptor
const load = (rel) => import(pathToFileURL(path.join(APP, rel)).href)
const v = await load('pages/staff/request-view.js')
const { useRequestList } = await load('pages/staff/request-list.js')
const plain = (x) => (x === undefined ? undefined : JSON.parse(JSON.stringify(x)))
const flush = async () => { for (let i = 0; i < 8; i++) await new Promise(resolve => setImmediate(resolve)) }

const vite = await createServer({ configFile: false, server: { middlewareMode: true, hmr: false } })
const session = await vite.ssrLoadModule('/common/experience.js')
await vite.close()

/** 在沙箱里跑页面的 script setup：导入一律先给永远不返回的函数，再用 stubs 覆盖用得到的那几个 */
function runSetup(rel, stubs) {
  const d = sfc(rel)
  const source = d.scriptSetup.content
  const ast = compiler.babelParse(source, { sourceType: 'module' })
  const body = ast.program.body.filter(n => n.type !== 'ImportDeclaration').map(n => source.slice(n.start, n.end)).join('\n')
  const sandbox = { console, setTimeout, clearTimeout }
  for (const n of ast.program.body.filter(n => n.type === 'ImportDeclaration')) for (const s of n.specifiers) sandbox[s.local.name] = () => new Promise(() => {})
  Object.assign(sandbox, { pendingStaffScope, ref: vue.ref, computed: vue.computed, watch: vue.watch, reactive: vue.reactive, onShow() {}, onHide() {}, onUnload() {}, onUnmounted() {}, onLoad() {}, onReachBottom() {}, onPullDownRefresh() {}, onMounted() {}, onBeforeUnmount() {}, getCurrentPages: () => [{}] }, stubs)
  vm.createContext(sandbox)
  const scope = vue.effectScope()
  scope.run(() => vm.runInContext(body, sandbox, { filename: rel + ':script-setup' }))
  return { run: code => vm.runInContext(code, sandbox), json: code => plain(vm.runInContext(code, sandbox)), stop: () => scope.stop(), template: d.template.content, sandbox }
}

const R = { weekly: '/pages/manage/weekly', tasks: '/pages/manage/tasks', daily: '/pages/manage/daily', dashboard: '/pages/manage/dashboard', staffApplications: '/pages/staff/applications', staff: '/pages/staff/index', messages: '/pages/messages/index', profile: '/pages/profile/index',
  staffOnline: '/pages/staff/online-jobs', staffJobs: '/pages/staff/jobs', staffInsurance: '/pages/staff/insurance', staffRooms: '/pages/staff/rooms', staffDispatch: '/pages/staff/dispatch', staffActivities: '/pages/staff/activities', staffReviews: '/pages/staff/reviews', staffStayOrders: '/pages/staff/stay-orders', staffTalents: '/pages/staff/talents' }
const storeUrl = (u, id = 102) => u + (u.includes('?') ? '&' : '?') + 'storeId=' + id

// 五种身份：和服务端 StaffPerms 这几项一致（只列页面用得到的）；also = 小院主理人开了兼任
const ROLES = {
  keeper: { role: 'keeper', roleName: '小院主理人', perms: { online: ['view', 'edit', 'audit'], jobs: ['view', 'edit', 'audit'], activities: ['view', 'edit', 'audit'], dashboard: ['view'] } },
  also: { role: 'keeper', roleName: '小院主理人', also: true, perms: { online: ['view', 'edit', 'audit'], jobs: ['view', 'edit', 'audit'], activities: ['view', 'edit', 'audit'], dashboard: ['view'] } },
  service: { role: 'merchant_service', roleName: '商家服务人', perms: { online: ['view', 'edit', 'audit'], intake: ['view', 'edit'] } },
  manager: { role: 'manager', roleName: '换工主理人', perms: { intake: ['view', 'edit', 'audit'], jobs: ['view', 'edit', 'audit'], activities: ['view', 'edit', 'audit'], dashboard: ['view'] } },
  staff: { role: 'staff', roleName: '员工', perms: { jobs: ['view'], activities: ['view'] } }
}
const can = (who) => (item, action) => (ROLES[who].perms[item] || []).includes(action)

// ---------------------------------------------------------------- 业务页

function business(who, { hub, recruitmentOpen = true } = {}) {
  const r = ROLES[who], log = { gone: [], sheets: [], hubCalls: 0 }
  const s = vue.ref(1)
  const h = runSetup('pages/staff/business.vue', {
    ...v, R, recruitmentEnabled: vue.ref(recruitmentOpen), useScreen: () => s, onlineStaff: { value: false }, merchantStaff: { value: false }, merchantService: { value: who === 'service' }, cityLead: { value: false },
    staffCan: can(who), currentStaffStore: { value: { roleCode: r.role, storeId: 102, roleName: r.roleName, alsoService: !!r.also } }, currentStaffStoreId: () => 102, currentAlsoService: { value: !!r.also },
    staffStoreUrl: storeUrl, go: (u) => log.gone.push(u), getSessionRevision: () => 1, ensureSession: async () => {}, hasStaffAccess: { value: true }, absUrl: x => x,
    apiStaffHub: async () => { log.hubCalls++; return { data: { storeId: 102, role: r.role, roleName: r.roleName, alsoService: !!r.also, ...hub } } },
    sheet: async (list) => { log.sheets.push(plain(list)); return -1 }, errText: (e, d) => d, toast() {}
  })
  h.run(`hub.value = ${JSON.stringify({ storeId: 102, role: r.role, roleName: r.roleName, alsoService: !!r.also, ...hub })}`)
  return { ...h, s, log }
}
test('工作台：后台刚勾上兼任、本机快照还是旧的：hub 说开了就刷新账号，线上任务概况和待办数跟着出来', async (t) => {
  const w = workbench('keeper', { hubData: { alsoService: true, servicePending: 2, serviceAuditPending: 1 } })
  t.after(w.stop)
  let refreshed = 0
  w.sandbox.refreshAccount = async () => { refreshed++; w.store.value = { ...w.store.value, alsoService: true } }
  await w.show()
  assert.equal(refreshed, 1)
  assert.equal(w.run('alsoService.value'), true)
  assert.ok(w.log.gets.some(g => g[0] === '/app/staff/daily/online'))
  assert.equal(w.json('servicePriority.value.length'), 2)
})
test('工作台：后台刚取消兼任：刷新账号，不再调概况接口，那两条待办也没了', async (t) => {
  const w = workbench('also', { hubData: { alsoService: false } })
  t.after(w.stop)
  let refreshed = 0
  w.sandbox.refreshAccount = async () => { refreshed++; w.store.value = { ...w.store.value, alsoService: false } }
  await w.show()
  assert.equal(refreshed, 1)
  assert.ok(!w.log.gets.some(g => g[0] === '/app/staff/daily/online'))
  assert.equal(w.json('servicePriority.value.length'), 0)
})
test('工作台：开关和服务端一样时不刷新账号；刷新失败也不影响页面', async (t) => {
  const same = workbench('also', { hubData: { alsoService: true, servicePending: 1 } })
  t.after(same.stop)
  let refreshed = 0
  same.sandbox.refreshAccount = async () => { refreshed++ }
  await same.show()
  assert.equal(refreshed, 0)
  const broken = workbench('keeper', { hubData: { alsoService: true } })
  t.after(broken.stop)
  broken.sandbox.refreshAccount = async () => { throw new Error('断网') }
  await broken.show()
  assert.equal(broken.run('alsoService.value'), false)
  assert.deepEqual(broken.json('overview.value.map(i => i.value)'), [3, 2, 0])
})
test('业务页：hub 和本机快照不一样时刷新账号，一样时不刷新', async (t) => {
  const b = business('keeper', { hub: { alsoService: true } })
  t.after(b.stop)
  let refreshed = 0
  b.sandbox.refreshAccount = async () => { refreshed++ }
  await b.run('loadHub()')
  assert.equal(refreshed, 1)
  const same = business('also')
  t.after(same.stop)
  same.sandbox.refreshAccount = async () => { refreshed++ }
  await same.run('loadHub()')
  assert.equal(refreshed, 1)
})

// 2026-11-03 主人简化（D-staff-misc）：「二消管理」改叫「二消订单」；「人员管理」拆成「员工与权限」+「人才库」（人才库要岗位编辑权、小院主理人不出）
const FREQ_KEEPER = ['房源管理', '岗位管理', '活动管理', '评价管理', '二消订单', '员工与权限']
const FREQ_OTHER = ['岗位管理', '调度管理', '活动管理', '评价管理', '保险管理', '员工与权限']
const FREQ = { keeper: FREQ_KEEPER, also: FREQ_KEEPER, service: FREQ_OTHER, manager: ['纠纷调解', ...FREQ_OTHER, '人才库'], staff: FREQ_OTHER }
const REVIEW = {
  keeper: ['线上任务报名审核'],
  also: ['线上任务报名审核', '商家需求', '活动审核'],
  service: ['线上任务报名审核', '换工审核'],
  manager: ['商家需求审核', '商家岗位', '换工审核'],
  staff: ['换工审核']
}
// 2026-11-03 主人简化：「下周任务」拆成「查看任务」+「发布任务」（发布只给主理人 / 管家 / 员工这些能经营的角色）
const DAILY = {
  keeper: ['日报与月度任务', '周报管理', '查看任务', '发布任务', '日报管理', '数据看板'],
  also: ['日报与月度任务', '周报管理', '查看任务', '发布任务', '日报管理', '数据看板'],
  service: ['查看任务'],
  manager: ['日报与月度任务', '招募周报', '查看任务', '发布任务', '日报管理', '数据看板'],
  staff: ['周报管理', '查看任务', '发布任务', '日报管理']
}
for (const who of Object.keys(ROLES)) {
  test(`业务页 ${who}：报名审核、高频工作、日常管理的入口`, (t) => {
    const b = business(who)
    t.after(b.stop)
    assert.deepEqual(b.json('reviewEntries.value.map(e => e.label)'), REVIEW[who])
    assert.deepEqual(b.json('frequent.value.map(e => e.label)'), FREQ[who])
    assert.deepEqual(b.json('daily.value.map(e => e.label)'), DAILY[who])
    const jobs = b.json("frequent.value.find(e => e.label === '岗位管理').to")
    assert.equal(jobs, ['keeper', 'also'].includes(who) ? '/pages/staff/online-jobs?s=2' : '/pages/staff/jobs')
  })
}

test('业务页：兼任的两个新入口带待办数、去对应页面；普通小院主理人的唯一入口还是线上报名', (t) => {
  const a = business('also', { hub: { servicePending: 4, serviceAuditPending: 120 } })
  t.after(a.stop)
  assert.deepEqual(a.json('reviewEntries.value.map(e => [e.label, e.badge || 0])'), [['线上任务报名审核', 0], ['商家需求', 4], ['活动审核', 120]])
  a.run('reviewEntries.value.forEach(e => e.open())')
  assert.deepEqual(a.log.gone, ['/pages/staff/applications?jobType=online&storeId=102', '/pages/staff/service?storeId=102', '/pages/staff/service-activities?storeId=102'])
  assert.equal(a.run('roleLabel.value'), '小院主理人 + 商家服务人')

  const k = business('keeper')
  t.after(k.stop)
  assert.equal(k.run('roleLabel.value'), '小院主理人')
  k.run('reviewEntries.value[0].open()')
  assert.deepEqual(k.log.gone, ['/pages/staff/applications?jobType=online&storeId=102'])
  // 权限表还没回来时入口也在，不留一个空的「报名审核与交付」
  const empty = runSetup('pages/staff/business.vue', { ...v, R, useScreen: () => vue.ref(1), staffCan: () => false, currentStaffStore: { value: { roleCode: 'keeper', storeId: 102 } }, currentStaffStoreId: () => 102, currentAlsoService: { value: false }, staffStoreUrl: storeUrl })
  t.after(empty.stop)
  assert.deepEqual(empty.json('reviewEntries.value.map(e => e.label)'), ['线上任务报名审核'])
})

test('业务页：兼任听 hub 的；hub 还没回来或是上一家店的，听本机授权；别的角色就算带着这个字段也不算', (t) => {
  const a = business('also')
  t.after(a.stop)
  assert.equal(a.run('alsoService.value'), true)
  a.run("hub.value = { storeId: 102, role: 'keeper', alsoService: false }")
  assert.equal(a.run('alsoService.value'), false, '后台刚关掉：hub 说了算')
  a.run("hub.value = { storeId: 999, role: 'keeper', alsoService: false }")
  assert.equal(a.run('alsoService.value'), true, 'hub 是别家店的，退回本机授权')
  a.run('hub.value = {}')
  assert.equal(a.run('alsoService.value'), true)
  const m = business('manager', { hub: { alsoService: true } })
  t.after(m.stop)
  assert.equal(m.run('alsoService.value'), false)
})

test('业务页模板：普通小院主理人没有每日概况和换工主理人专区；兼任的每日概况是线上任务；换工主理人、员工不变', () => {
  const t = sfc('pages/staff/business.vue').template.content
  assert.match(t, /<template v-if="!isKeeper"><text class="group-title">每日概况<\/text><view class="owner-entry stay-entry daily-entry" hover-class="k-press-s" @click="go\(DAILY_PAGE\)">/)
  assert.match(t, /<template v-if="alsoService \|\| \(isCityLead && cityLeadFull\)"><text v-if="alsoService" class="group-title">每日概况<\/text><view class="owner-entry stay-entry daily-entry" hover-class="k-press-s" @click="go\(staffStoreUrl\(ONLINE_DAILY_PAGE, hub\.storeId\)\)">/)
  assert.match(t, /<text>线上任务招募概况<\/text><text>招募中 · 招募缺口 · 待审核报名<\/text>/)
  assert.match(t, /<template v-if="!isKeeper"><text class="group-title owner-title">换工主理人专区<\/text>/)
  // 旅居订单、日常管理对小院主理人还在
  assert.match(t, /<template v-if="canStay"><text class="group-title">旅居订单<\/text>/)
  assert.match(t, /<text class="group-title daily-title">日常管理<\/text>/)
  assert.match(t, /<k-chip v-if="roleLabel" tone="ochre"><text>\{\{ roleLabel \}\}<\/text><\/k-chip>/)
})

test('业务页：人才库对小院主理人不出；换工主理人还有（2026-11-03 简化后是两格直接进，不再弹菜单）', async (t) => {
  const k = business('keeper')
  t.after(k.stop)
  assert.equal(k.json("frequent.value.some(e => e.label === '人才库')"), false)
  await k.run("openItem(frequent.value.find(e => e.label === '员工与权限'))")
  assert.deepEqual(k.log.sheets, [], '直接进员工与权限')
  assert.equal(k.s.value, 3)
  const m = business('manager')
  t.after(m.stop)
  await m.run("openItem(frequent.value.find(e => e.label === '人才库'))")
  assert.deepEqual(m.log.sheets, [])
  assert.deepEqual(m.log.gone, ['/pages/staff/talents'])
})

test('业务页：商家服务人走自己的工作台，不取 hub', async (t) => {
  const b = business('service')
  t.after(b.stop)
  await b.run('loadScreen(1)')
  await flush()
  assert.equal(b.log.hubCalls, 0)
})

test('门店切换页的角色文字：兼任的写两个', () => {
  assert.equal(v.roleTextOf({ roleName: '小院主理人', alsoService: true }), '小院主理人 + 商家服务人')
  assert.equal(v.roleTextOf({ roleName: '小院主理人', alsoService: false }), '小院主理人')
  assert.equal(v.roleTextOf(null), '')
  const t = sfc('pages/staff/business.vue').template.content
  assert.match(t, /角色：\{\{ roleTextOf\(sel\) \}\}/)
  assert.match(t, /角色：\{\{ roleTextOf\(store\) \}\}/)
})

// ---------------------------------------------------------------- 工作台

function workbench(who, { pms, hubData, online, onlineFail, volunteers, recruitmentOpen = true } = {}) {
  const r = ROLES[who], log = { gets: [], gone: [], hub: [], todo: [] }
  const s = vue.ref(1)
  let shown = null
  const store = vue.ref({ roleCode: r.role, storeId: 102, storeName: '海边小院', roleName: r.roleName, alsoService: !!r.also })
  const h = runSetup('pages/staff/index.vue', {
    ...v, R, recruitmentEnabled: vue.ref(recruitmentOpen), DAILY_PAGE: '/pages/staff/volunteers', useScreen: () => s, onShow: (fn) => { shown = fn },
    onlineStaff: { value: false }, merchantStaff: { value: false }, merchantService: { value: who === 'service' }, cityLead: { value: false },
    experience: { account: { staffGrants: [] } }, ensureSession: async () => {}, hasStaffAccess: { value: true }, checkStaffTaskReminder() {}, hasManagerTasks: false,
    currentStaffStore: store, currentAlsoService: vue.computed(() => store.value.alsoService === true), staffStoreUrl: storeUrl, getSessionRevision: () => 1,
    staffCan: can(who), staffTaskTodoCount: { value: 0 }, go: (u) => log.gone.push(u), toast() {}, absUrl: x => x,
    apiWorkbenchHome: async () => ({ data: { counts: {}, total: 5 } }),
    apiWorkbenchTodos: async () => ({ data: { groups: [{ title: '今天', items: [{ type: 'app_review', key: 'app_review:1', sub: '探店笔记' }] }], counts: {}, overdue: 0 } }),
    apiWorkbenchTodo: async (k) => { log.todo.push(k); return { data: { task: { key: k } } } },
    apiStaffHub: async (id) => { log.hub.push(id); if (hubData === 'fail') throw new Error('x'); return { data: hubData || {} } },
    get: async (url, params) => {
      log.gets.push([url, plain(params)])
      if (url === '/app/staff/stay/pms/overview') { if (pms === 'fail') throw new Error('订单概况读不出来'); return { data: pms || { counts: { arrivals: 3, departures: 2, unassigned: 0, inhouse: 9 } } } }
      if (url === '/app/staff/daily/online') { if (onlineFail) throw new Error('概况读不出来'); return { data: online || { recruiting: 2, shortfall: 5, toReview: 1, toAccept: 4 } } }
      return { data: volunteers || { city: '平潭', shortfall: 7, arriving: 1, leaving: 0 } }
    }
  })
  return { ...h, s, log, store, show: async () => { await shown(); await flush() } }
}
const QUICK = {
  keeper: ['全部待办', '线上报名', '订单管理', '活动管理'],
  also: ['全部待办', '线上报名', '订单管理', '活动管理'],
  service: ['全部待办', '报名管理', '保险管理'],
  manager: ['全部待办', '报名管理', '保险管理'],
  staff: ['全部待办', '报名管理', '保险管理']
}
const TODO_TABS = {
  keeper: ['全部', '报名', '订单', '活动'],
  also: ['全部', '报名', '订单', '活动'],
  service: ['全部', '报名', '保险', '活动', '调度'],
  manager: ['全部', '报名', '保险', '活动', '调度'],
  staff: ['全部', '报名', '保险', '活动', '调度']
}
const PUBLISH = {
  keeper: ['线上任务', '活动'],
  also: ['线上任务', '活动'],
  service: ['招募换工', '招募兼职', '招募全职', '线上任务'],
  manager: ['招募换工', '招募兼职', '招募全职'],
  staff: ['招募换工', '招募兼职', '招募全职']
}
for (const who of Object.keys(ROLES)) {
  test(`工作台 ${who}：快捷入口、待办页签、发布区`, (t) => {
    const w = workbench(who)
    t.after(w.stop)
    assert.deepEqual(w.json('quick.value.map(q => q.label)'), QUICK[who])
    assert.deepEqual(w.json('todoTabs.value'), TODO_TABS[who])
    assert.deepEqual(w.json('publishEntries.value.map(p => p.label)'), PUBLISH[who])
  })
}

test('招聘关闭：不展示发布、人才库和招募岗位，仍可处理已有报名、任务和活动', (t) => {
  const b = business('manager', { recruitmentOpen: false })
  const w = workbench('keeper', { recruitmentOpen: false })
  const m = merchantHome(false)
  for (const view of [b, w, m]) t.after(view.stop)
  const labels = b.json('frequent.value.map(item => item.label)')
  for (const label of ['岗位管理', '人才库', '调度管理']) assert.ok(!labels.includes(label), label)
  b.run("reviewEntries.value.find(item => item.label === '换工审核').open()")
  assert.deepEqual(b.log.gone, ['/pages/staff/applications?jobType=volunteer&storeId=102'])
  assert.deepEqual(w.json('publishEntries.value.map(entry => entry.label)'), ['活动'])
  assert.match(m.template, /v-if="recruitmentEnabled" class="boards"/)
  assert.deepEqual(m.json('otherLinks.value.map(link => link.label)'), ['线上任务与成果', '任务发布费用', '评价管理'])
})

test('工作台 普通小院主理人：今日概览是旅居订单三格，点了去订单台对应分组；不调换工接口，也不调兼任的接口', async (t) => {
  const w = workbench('keeper')
  t.after(w.stop)
  await w.show()
  const urls = w.log.gets.map(g => g[0])
  assert.deepEqual(urls, ['/app/staff/stay/pms/overview'])
  assert.deepEqual(w.log.gets[0][1], { storeId: 102 })
  assert.deepEqual(w.log.hub, [102], '要取一次 hub 核对兼任开关，其余接口不调')
  assert.deepEqual(w.json('overview.value.map(i => [i.label, i.value, i.unit])'), [['今日到店', 3, '单'], ['今日离店', 2, '单'], ['待排房', 0, '单']])
  assert.equal(w.run('roleLine.value'), '角色：小院主理人')
  assert.equal(w.json('priority.value.length'), 1)
  for (const i of [0, 1, 2]) w.run(`openOverview(overview.value[${i}])`)
  assert.deepEqual(w.log.gone, ['/pages/staff/stay-orders?allStays=1&tab=arrivals&storeId=102', '/pages/staff/stay-orders?allStays=1&tab=departures&storeId=102', '/pages/staff/stay-orders?allStays=1&tab=unassigned&storeId=102'])
  // 键名必须是订单台认的分组
  const known = /\['unassigned', 'arrivals', 'inhouse', 'departures', 'upcoming', 'done'\]\.includes\(q\?\.tab\)/
  assert.match(sfc('pages/staff/stay-orders.vue').scriptSetup.content, known)
  w.log.gone.length = 0
  w.run("quick.value[1].to(); quick.value[3].to()")
  assert.deepEqual(w.log.gone, ['/pages/staff/applications?jobType=online', '/pages/staff/activities'])
})

test('工作台 小院主理人：概况读取失败走 overviewError，点一下重试', async (t) => {
  const w = workbench('keeper', { pms: 'fail' })
  t.after(w.stop)
  await w.show()
  assert.equal(w.run('overviewError.value'), '订单概况读不出来')
  assert.deepEqual(w.json('overview.value.map(i => i.value)'), ['—', '—', '—'])
  assert.match(w.template, /class="overview-error" hover-class="k-press" @click="loadOverview"/)
})

test('工作台 小院主理人：发布区两格铺满；活动进创建屏，线上任务进发布页；标题改「发布」', async (t) => {
  const w = workbench('keeper')
  t.after(w.stop)
  w.run("openPublish('activity'); openPublish('online')")
  assert.deepEqual(w.log.gone, ['/pages/staff/activities?s=2&create=1', '/pages/staff/online-jobs?s=1'])
  assert.match(w.template, /\{\{ isKeeper \? '发布' : '发布招募' \}\}/)
  assert.match(w.template, /:class="'publish-card--' \+ publishEntries\.length"/)
  assert.match(sfc('pages/staff/index.vue').styles[0].content, /\.publish-card--2 \{ grid-template-columns: repeat\(2, minmax\(0, 1fr\)\); \}/)
  // 没有换工概况的链接
  assert.match(w.template, /<text v-if="isKeeper" class="k-small k-muted">\{\{ today \}\}<\/text>\s*<view v-else class="k-row k-gap4 daily-link" hover-class="k-press" @click="go\(DAILY_PAGE\)">/)
})

test('工作台 兼任：多线上任务三格；优先处理最前面多两条，点了去对应页面，不进任务详情', async (t) => {
  const w = workbench('also', { hubData: { servicePending: 2, serviceAuditPending: 1 } })
  t.after(w.stop)
  await w.show()
  assert.deepEqual(w.log.gets.map(g => g[0]).sort(), ['/app/staff/daily/online', '/app/staff/stay/pms/overview'])
  assert.deepEqual(w.log.hub, [102])
  assert.deepEqual(w.json('onlineOverview.value.map(i => [i.label, i.value, i.unit])'), [['招募中', 2, '个'], ['招募缺口', 5, '人'], ['待审核报名', 1, '份']])
  assert.equal(w.run('roleLine.value'), '角色：小院主理人 + 商家服务人')
  assert.deepEqual(w.json('priority.value.map(p => p.num + p.title)'), ['2条商家需求待接手', '1场活动待审核', '1份报名待审核'])
  await w.run('openTodo(priority.value[0]); openTodo(priority.value[1])')
  assert.deepEqual(w.log.gone, ['/pages/staff/service?storeId=102', '/pages/staff/service-activities?storeId=102'])
  assert.equal(w.s.value, 1, '不进任务详情屏')
  assert.deepEqual(w.log.todo, [])
  w.log.gone.length = 0
  w.run('openOnlineDaily()')
  assert.deepEqual(w.log.gone, ['/pages/staff/online-daily?storeId=102'])
  // 真待办还是进任务详情
  await w.run('openTodo(priority.value[2])')
  await flush()
  assert.equal(w.s.value, 4)
  assert.deepEqual(w.log.todo, ['app_review:1'])
})

test('工作台 兼任：没有待办时不出那两条；概况失败不影响待办数；待办数失败不影响概况', async (t) => {
  const none = workbench('also', { hubData: { servicePending: 0, serviceAuditPending: 0 } })
  t.after(none.stop)
  await none.show()
  assert.deepEqual(none.json('priority.value.map(p => p.title)'), ['份报名待审核'])

  const broken = workbench('also', { hubData: { servicePending: 3 }, onlineFail: true })
  t.after(broken.stop)
  await broken.show()
  assert.equal(broken.run('onlineError.value'), '概况读不出来')
  assert.deepEqual(broken.json('onlineOverview.value.map(i => i.value)'), ['—', '—', '—'])
  assert.equal(broken.json('priority.value[0].title'), '条商家需求待接手')

  const noHub = workbench('also', { hubData: 'fail' })
  t.after(noHub.stop)
  await noHub.show()
  assert.equal(noHub.run('onlineError.value'), '')
  assert.equal(noHub.json('onlineOverview.value[0].value'), 2)
  assert.deepEqual(noHub.json('priority.value.map(p => p.title)'), ['份报名待审核'])
})

test('工作台 兼任的模板：线上任务那一排只在 alsoService 时显示，失败可重试', () => {
  const t = sfc('pages/staff/index.vue').template.content
  assert.match(t, /<template v-if="alsoService">\s*<view class="k-between sec">\s*<text class="sec__title">线上任务<\/text>\s*<view class="k-row k-gap4 daily-link" hover-class="k-press" @click="openOnlineDaily"><text class="daily-link__text">线上任务概况<\/text>/)
  assert.match(t, /v-if="onlineError" class="overview-error" hover-class="k-press" @click="loadService"/)
})

test('工作台 换工主理人、员工：今日概览还是当地换工，单位是人；不调旅居和兼任的接口', async (t) => {
  for (const who of ['manager', 'staff']) {
    const w = workbench(who)
    t.after(w.stop)
    await w.show()
    assert.deepEqual(w.log.gets, [['/app/staff/daily/volunteers', { storeId: 102 }]], who)
    assert.deepEqual(w.log.hub, [], who)
    assert.deepEqual(w.json('overview.value.map(i => [i.label, i.value, i.unit])'), [['招募缺口', 7, '人'], ['今日到达', 1, '人'], ['一周内离开', 0, '人']], who)
    w.run('openOverview(overview.value[0])')
    assert.deepEqual(w.log.gone, ['/pages/staff/volunteers?tab=shortfall&storeId=102'], who)
    assert.equal(w.run('overviewCity.value'), '平潭', who)
  }
})

test('工作台 商家服务人：走自己的工作台，不取完整工作台的数据', async (t) => {
  const w = workbench('service')
  t.after(w.stop)
  await w.show()
  assert.deepEqual(w.log.gets, [])
  assert.deepEqual(w.log.hub, [])
})

test('工作台：从换工主理人的店切到小院，停在「保险」页签时落回全部', async (t) => {
  const w = workbench('manager')
  t.after(w.stop)
  w.run("todoTab.value = '保险'")
  w.store.value = { roleCode: 'keeper', storeId: 103, storeName: '小院', roleName: '小院主理人' }
  await flush()
  assert.equal(w.run('todoTab.value'), '全部')
})

// ---------------------------------------------------------------- 报名页

function applications(role, { q = {}, permsFail = false, detail, overrides = {} } = {}) {
  const log = { lists: [], details: [], notices: [] }
  const s = vue.ref(1)
  let boot = null, mounted = null
  const grants = [{ storeId: 102, roleCode: role, storeName: '海边小院', active: true }]
  const h = runSetup('pages/staff/applications.vue', {
    useScreen: (n, o) => { boot = o.onLoad; return s }, onMounted: (fn) => { mounted = fn }, R,
    experience: { account: { id: 1 } }, ensureSession: async () => {}, hasStaffAccess: { value: true }, currentStaffStore: { value: grants[0] }, currentStaffStoreId: () => 102, staffStores: { value: grants },
    staffStoreUrl: storeUrl, onlineStaff: { value: false }, merchantStaff: { value: role === 'merchant' }, staffIdentities: { value: grants }, toast() {}, go() {}, loadStaffPerms: async () => null,
    apiNotifyRecruitManager: async (storeId, appId) => { log.notices.push([storeId, appId]); return { data: {} } },
    staffCan: (item, action) => !permsFail && (role !== 'manager' || item !== 'online'),
    apiJobList: async () => ({ rows: [] }),
    apiStaffApplications: async (p) => { log.lists.push(plain(p)); return { rows: [], total: 0, hasMore: false } },
    apiStaffApplicationDetail: async (id) => { log.details.push(id); return { data: detail || { appId: id, jobType: 'volunteer', status: 'submitted' } } },
    apiResumeForwards: async () => ({ data: [] }), get: async () => ({ data: {} }), releaseArrivalImages() {}, loadArrivalImages: async () => [], onBeforeUnmount() {}, onReachBottom() {}, ...overrides
  })
  s.value = Number(q.s) || 1
  boot(q)
  return { ...h, s, log, start: async () => { await mounted(); await flush() } }
}
test('报名页 小院主理人：列表只看线上任务，页签也只有这一个，老链接带换工类型也落到线上', async (t) => {
  const k = applications('keeper', { q: { jobType: 'volunteer' } })
  t.after(k.stop)
  await k.start()
  assert.deepEqual(k.json('typeTabs.value'), [{ value: 'online', label: '线上任务' }])
  assert.equal(k.run('typeTab.value'), 'online')
  assert.ok(k.log.lists.length >= 1)
  for (const req of k.log.lists) assert.equal(req.jobType, 'online')
  assert.deepEqual(k.json('statusTabs.value'), ['全部', '待审核', '已通过'])
  assert.equal(k.run('restricted.value'), false, '不是专员：详情、转发那几屏不收')
})
test('报名页 小院主理人：岗位转到本店的通知（?linked=1&jobType=volunteer）看得到转来的换工报名，页签只多这一类', async (t) => {
  const k = applications('keeper', { q: { jobType: 'volunteer', linked: '1' } })
  t.after(k.stop)
  await k.start()
  assert.deepEqual(k.json('typeTabs.value'), [{ value: 'online', label: '线上任务' }, { value: 'volunteer', label: '换工' }])
  assert.equal(k.run('typeTab.value'), 'volunteer')
  for (const req of k.log.lists) assert.equal(req.jobType, 'volunteer')
  // 通知的落地页由服务端拼：带 linked，别的角色只是多一个类型筛选
  const job = fs.readFileSync(path.join(APP, '../RuoYi-Vue/ruoyi-kangaroo/src/main/java/com/ruoyi/kangaroo/service/impl/KgJobServiceImpl.java'), 'utf8')
  assert.match(job, /"&linked=1&jobType=" \+ job\.getJobType\(\)/)
})
test('报名页 专员：linked 不放宽，还是只有线上任务', async (t) => {
  const k = applications('online_staff', { q: { jobType: 'volunteer', linked: '1' } })
  t.after(k.stop)
  await k.start()
  assert.deepEqual(k.json('typeTabs.value'), [{ value: 'online', label: '线上任务' }])
  assert.equal(k.run('typeTab.value'), 'online')
})
test('报名页 小院主理人：消息里的换工报名（?appId=）照样按 id 打开详情，不被送回列表', async (t) => {
  const k = applications('keeper', { q: { appId: '901' } })
  t.after(k.stop)
  assert.equal(k.s.value, 2)
  await k.start()
  assert.deepEqual(k.log.details, [901])
  assert.equal(k.s.value, 2)
})
test('报名页 小院主理人：按原报名授权进入旧简历深链，无报名的旧链接回列表', async (t) => {
  const k = applications('keeper', {
    q: { s: '3', appId: '901' }, detail: { appId: 901, storeId: 102, jobType: 'volunteer', canShareResume: true }
  })
  t.after(k.stop)
  await k.start()
  assert.equal(k.s.value, 3)
  const blank = applications('keeper', { q: { s: '3' } })
  t.after(blank.stop)
  await blank.start()
  assert.equal(blank.s.value, 1)
})
test('报名页 从另一工作台打开商家门店的原报名：旧分享入口回详情，站内通知带报名自己的门店', async (t) => {
  const mixed = applications('manager', {
    q: { s: '4', appId: '901' },
    detail: { appId: 901, storeId: 208, jobType: 'parttime', canShareResume: false, canNotifyRecruitManager: true }
  })
  t.after(mixed.stop)
  await mixed.start()
  assert.equal(mixed.s.value, 2)
  assert.equal(mixed.run('canShareResume.value'), false)
  await mixed.run('notifyManager()')
  assert.deepEqual(mixed.log.notices, [[208, 901]])
  mixed.run('detail.value.canNotifyRecruitManager = false')
  await mixed.run('notifyManager()')
  assert.equal(mixed.log.notices.length, 1)
})
test('报名页 小院主理人：权限表读取失败时不来回改页签，照样取线上', async (t) => {
  const k = applications('keeper', { permsFail: true })
  t.after(k.stop)
  await k.start()
  assert.equal(k.run('typeTab.value'), 'online')
  assert.equal(k.log.lists.length, 1, '只取一次')
})
test('报名页 换工主理人、员工：页签不变，不强制线上', async (t) => {
  for (const role of ['manager', 'staff']) {
    const m = applications(role, { q: { jobType: 'volunteer' } })
    t.after(m.stop)
    await m.start()
    assert.equal(m.run('typeTab.value'), 'volunteer', role)
    assert.deepEqual(m.json('typeTabs.value.map(x => x.label)'), role === 'manager' ? ['全部', '换工', '兼职', '全职'] : ['全部', '线上任务', '换工', '兼职', '全职'], role)
    assert.equal(m.log.lists[0].jobType, 'volunteer', role)
  }
})

// ---------------------------------------------------------------- 商家首页、活动页文案

function merchantHome(recruitmentOpen = true) {
  const log = { gone: [] }
  const current = { value: { storeId: 9, storeName: '喜洲小院' } }
  const h = runSetup('pages/staff/components/k-merchant-work.vue', {
    ...v, R, recruitmentEnabled: vue.ref(recruitmentOpen), currentStaffStore: current, staffStores: { value: [current.value] }, ensureSession: async () => {}, getSessionRevision: () => 1,
    staffStoreUrl: url => url + (url.includes('?') ? '&' : '?') + 'storeId=9', go: u => log.gone.push(u), toast() {}, watch() {}, requestTone() {}
  })
  return { ...h, log }
}
test('商家首页：四个板块不动，业务入口包含「发布活动」，进创建屏', (t) => {
  const h = merchantHome()
  t.after(h.stop)
  assert.deepEqual(h.json('boards.map(b => b.label)'), ['招募换工', '招募兼职', '招募全职', '发布任务'])
  const first = h.json("links.find(link => link.label === '发布活动')")
  assert.equal(first.label, '发布活动')
  // 2026-11-03 主人：简化商家端文案，商家看到的一律叫「袋鼠工作人员」
  assert.match(first.desc, /旅游产品.*工作人员审核/)
  h.run("openBoard(boards.find(b => b.label === '发布任务').kind)")
  h.run("open(links.find(link => link.label === '发布活动').route)")
  assert.deepEqual(h.log.gone, ['/pages/staff/online-jobs?s=1&storeId=9', '/pages/staff/activities?s=2&create=1&storeId=9'])
  assert.doesNotMatch(src('pages/staff/components/k-merchant-work.vue').split('</template>')[0], /平台审核/)
})

test('商家首页：「发布活动」后面是「我的活动」，提交后能回来看进度；被驳回的详情页写清楚原因和怎么改', (t) => {
  const h = merchantHome()
  t.after(h.stop)
  assert.deepEqual(h.json('links.slice(2, 4).map(l => l.label)'), ['发布活动', '我的活动'])
  assert.deepEqual(h.json('activityLinks.map(l => l.label)'), ['账单与结算', '房源管理', '发布活动', '我的活动'])
  assert.deepEqual(h.json('otherLinks.value.map(l => l.label)'), ['招募岗位', '线上任务与成果', '任务发布费用', '评价管理'])
  // 活动入口要在「我发布的」列表上面：列表长的时候放下面要滑好几屏
  const homeTpl = h.template
  assert.equal(homeTpl.split("open('/pages/governance/mediation')").length - 1, 1)
  assert.ok(homeTpl.indexOf('activityLinks') > homeTpl.indexOf('boards-tip') && homeTpl.indexOf('activityLinks') < homeTpl.indexOf('<text>我的需求') && homeTpl.indexOf('<text>我的需求') < homeTpl.indexOf('otherLinks'))
  h.run("open(links.find(link => link.label === '我的活动').route)")
  assert.deepEqual(h.log.gone, ['/pages/staff/activities?storeId=9'])
  const page = sfc('pages/staff/activities.vue').template.content
  assert.match(page, /v-if="d\.status === 'rejected' && d\.auditReason"/)
  assert.match(page, /\{\{ d\.auditReason \}\}/)
  assert.match(page, /修改活动/) // 2026-11-03 主人：「更多设置」和「相册管理」合成「修改活动」
})

function onlineJobs(q, list) {
  const log = { toasts: [], loaded: [] }
  const s = vue.ref(Number(q.s) || 1)
  let boot = null
  const h = runSetup('pages/staff/online-jobs.vue', {
    R, useScreen: (n, o) => { boot = o.onLoad; return s }, ensureSession: async () => {}, onlineStaff: { value: false }, merchantStaff: { value: false }, currentStaffStoreId: () => 102,
    toast: (m) => log.toasts.push(m), errText: (e, d) => d, shiftDate: () => '2026-11-06', todayCn: () => '2026-10-30', MAX_IMAGES: 9, uni: {}, setInterval: () => 0, clearInterval() {},
    apiOnlineTasks: async () => { if (list === 'fail') throw new Error('x'); return { data: list } },
    apiOnlineTask: async (id) => { log.loaded.push(id); return { data: { jobId: id, skills: [], requirements: [] } } }, apiOnlineAssignments: async () => ({ data: [] })
  })
  return { ...h, s, log, boot: async () => { await boot(q); await flush() } }
}
// 2026-11-03 简化：?s=2 进来先是任务列表（不再自动打开第一条），有任务时停在列表、一条任务都不读
test('线上任务页：?s=2 还没有任务时不停在空详情，提示后去发布屏；有任务停在任务列表；读取失败不跳', async (t) => {
  const none = onlineJobs({ s: '2' }, [])
  t.after(none.stop)
  await none.boot()
  assert.equal(none.s.value, 1)
  assert.deepEqual(none.log.toasts, ['暂无线上任务'])

  const some = onlineJobs({ s: '2' }, [{ jobId: 5 }, { jobId: 6 }])
  t.after(some.stop)
  await some.boot()
  assert.equal(some.s.value, 2)
  assert.deepEqual(some.log.loaded, [], '停在列表，不自动打开第一条任务')
  assert.equal(some.run('tasks.value.length'), 2)
  assert.equal(some.run('task.value'), null)

  const broken = onlineJobs({ s: '2' }, 'fail')
  t.after(broken.stop)
  await broken.boot()
  assert.equal(broken.s.value, 2)
  assert.deepEqual(broken.log.toasts, ['任务加载失败'])
})

function stayOrders(q, stays) {
  const log = { overview: [], orders: [], board: [], sheets: [] }
  const s = vue.ref(Number(q.s) || 1)
  let boot = null, pick = -1
  const h = runSetup('pages/staff/stay-orders.vue', {
    R, useScreen: (n, o) => { boot = o.onLoad; return s }, ensureSession: async () => {}, hasStaffAccess: { value: true }, currentStaffStoreId: () => 102, getSessionRevision: () => 1,
    toast() {}, back() {}, errText: (e, d) => d, todayCn: () => '2026-10-30', shiftDate: () => '2026-11-06', uni: { getStorageSync: () => '', setStorageSync() {} },
    sheet: async (list) => { log.sheets.push(plain(list)); return pick },
    apiPmsOverview: async (p) => { log.overview.push(plain(p)); return { data: { stays, tabs: [], canEdit: true, canSetup: true } } },
    apiPmsOrders: async (p) => { log.orders.push(plain(p)); return { data: [] } },
    apiPmsBoard: async (p) => { log.board.push(plain(p)); return { data: { dates: [], types: [], waiting: 0 } } }
  })
  return { ...h, s, log, pickNext: (i) => { pick = i }, boot: async () => { await boot(q); await flush() } }
}
const TWO_STAYS = [{ stayId: 11, stayName: '一号院', status: 'online' }, { stayId: 12, stayName: '二号院', status: 'online' }]
test('订单台：从工作台概览进来（allStays）看全部房源，数字才对得上；能换到某一处，也能换回来', async (t) => {
  const h = stayOrders({ allStays: '1', tab: 'arrivals' }, TWO_STAYS)
  t.after(h.stop)
  await h.boot()
  assert.equal(h.run('stayId.value'), null)
  assert.equal(h.run('stayName.value'), '全部房源')
  assert.equal(h.log.orders.at(-1).stayId, undefined, '不带房源 = 整店')
  assert.equal(h.log.orders.at(-1).tab, 'arrivals')

  h.pickNext(2)
  await h.run('pickStay()')
  await flush()
  assert.deepEqual(h.log.sheets[0], ['全部房源', '一号院', '二号院'])
  assert.equal(h.run('stayId.value'), 12)
  assert.equal(h.log.orders.at(-1).stayId, 12)

  h.pickNext(0)
  await h.run('pickStay()')
  await flush()
  assert.equal(h.run('stayId.value'), null)
  assert.equal(h.log.orders.at(-1).stayId, undefined)

  // 房态图得选定一处：全部房源时看第一处，选择菜单也没有「全部房源」
  await h.run('openBoard()')
  await flush()
  assert.equal(h.log.board.at(-1).stayId, 11)
  h.pickNext(-1)
  await h.run('pickStay()')
  assert.deepEqual(h.log.sheets.at(-1), ['一号院', '二号院'])
})
test('订单台：不带 allStays 还是默认第一处；只有一处房源时带了也直接看这一处', async (t) => {
  const plainLink = stayOrders({ tab: 'arrivals' }, TWO_STAYS)
  t.after(plainLink.stop)
  await plainLink.boot()
  assert.equal(plainLink.run('stayId.value'), 11)
  const one = stayOrders({ allStays: '1' }, TWO_STAYS.slice(0, 1))
  t.after(one.stop)
  await one.boot()
  assert.equal(one.run('stayId.value'), 11)
})

function activitiesPage(q) {
  const log = { lists: 0, drafts: 0, backs: 0 }
  let boot = null
  const s = vue.ref(Number(q.s) || 1)
  const h = runSetup('pages/staff/activities.vue', {
    R, useScreen: (n, o) => { boot = o.onLoad; return s }, ensureSession: async () => {}, hasStaffAccess: { value: true }, currentStaffStoreId: () => 9, currentStaffStore: { value: { storeId: 9, storeName: '喜洲小院', roleCode: 'merchant' } }, merchantStaff: { value: true },
    shiftDate: () => '2026-11-02', todayCn: () => '2026-10-30', staffCan: () => true, isStoreManager: () => false, toast() {}, go() {}, back: () => { log.backs++ }, errText: (e, d) => d, gated: x => x, absUrl: x => x, pad2: x => x, codeMessage() {}, previewActivityCode() {},
    apiStaffActivities: async () => { log.lists++; return { data: { rows: [], counts: {} } } }, uni: { getStorageSync: () => '', setStorageSync() {}, removeStorageSync() {} }
  })
  boot(q)
  return { ...h, s, log }
}
test('活动页：?s=2&create=1 直接进创建屏、填好默认值，不取列表；返回回来源页', async (t) => {
  const h = activitiesPage({ s: '2', create: '1' })
  t.after(h.stop)
  await flush()
  assert.equal(h.s.value, 2)
  assert.equal(h.log.lists, 0)
  assert.equal(h.run('place.value'), '喜洲小院', '门店名是新建才带的默认地点')
  assert.equal(h.run('start.value.date'), '2026-11-02')
  assert.equal(h.run('editId.value'), null)
  h.run('onBack()')
  assert.equal(h.log.backs, 1)
})
test('活动页：不带 create 照旧取列表', async (t) => {
  const h = activitiesPage({})
  t.after(h.stop)
  await flush()
  assert.equal(h.s.value, 1)
  assert.equal(h.log.lists, 1)
})
test('活动页文案：商家看到「待审核」，别的角色还是「待平台审核」', () => {
  const page = sfc('pages/staff/activities.vue')
  assert.match(page.template.content, /d\.status === 'pending' \? \(merchantStaff \? '（待审核）' : '（待平台审核）'\) : ''/)
  assert.match(page.scriptSetup.content, /import \{[^}]*\bmerchantStaff\b[^}]*\} from '@\/common\/experience\.js'/)
})

// ---------------------------------------------------------------- 商家需求页：审核通过并上架、退回

const REQ = { requestId: 7, requestType: 'online_task', title: '探店笔记', storeId: 201, jobId: 88, status: 'accepted', mine: true, canReturn: true, job: { jobStatus: 'draft' } }
function servicePage(detail, { reason = '工作内容不清楚', postFail } = {}) {
  const log = { gets: [], posts: [], toasts: [], backs: 0 }
  let boot = null, current = detail
  const s = vue.ref(1)
  const h = runSetup('pages/staff/service.vue', {
    ...v, useRequestList, R, useScreen: (n, o) => { boot = o.onLoad; return s }, ensureSession: async () => {}, hasStaffAccess: { value: true }, currentStaffStoreId: () => 102, selectStaffStore: async () => {},
    get: async (url, params) => { log.gets.push(url); return /\/requests\/\d+$/.test(url) ? { data: current } : { data: { rows: [], total: 0, hasMore: false } } },
    post: async (url, body) => { log.posts.push([url, plain(body)]); if (postFail) throw postFail; return { msg: '已退回商家' } },
    toast: m => log.toasts.push(m), go() {}, back: () => { log.backs++ }, confirm: async () => true, prompt: async () => reason, errText: (e, d) => (e && e.message) || d, uni: { stopPullDownRefresh() {} }
  })
  return { ...h, s, log, set: d => { current = d }, boot: async (q = {}) => { boot(q); await flush() } }
}
test('商家需求：线上任务的按钮叫「审核通过并上架」，确认框同样说清楚', async (t) => {
  const h = servicePage(REQ)
  t.after(h.stop)
  await h.boot()
  await h.run('openDetail(7)')
  assert.equal(h.run('mainAction.value'), 'publish')
  assert.equal(h.run('ACTION_LABEL[mainAction.value]'), '审核通过并上架')
  assert.equal(h.run('CONFIRM.publish[0]'), '审核通过并上架')
  assert.match(v.serviceHint({ ...REQ }), /审核通过并上架/)
})
test('商家需求：canReturn 才有退回按钮；退回带原因，成功后回列表，不再取详情（详情已经 403）', async (t) => {
  const h = servicePage(REQ)
  t.after(h.stop)
  assert.match(h.template, /<view v-if="detail && detail\.canReturn" class="req-bar__btn"><k-button block size="md" type="secondary" label="退回商家" @click="returnToMerchant" \/><\/view>/)
  await h.boot()
  await h.run('openDetail(7)')
  h.log.gets.length = 0
  await h.run('returnToMerchant()')
  await flush()
  assert.deepEqual(h.log.posts, [['/app/staff/service/requests/7/return?storeId=102', { reason: '工作内容不清楚' }]])
  assert.deepEqual(h.log.toasts, ['已退回商家'])
  assert.equal(h.s.value, 1)
  // 2026-11-03：回列表时连同三个项目页签上的待接手数一起取，但不再取详情
  assert.ok(h.log.gets.length && h.log.gets.every(u => u === '/app/staff/service/requests'), '只重新取列表')
})
test('商家需求：退回没写原因、取消、超长都不发请求', async (t) => {
  for (const [reason, toast] of [['', /要写原因/], [null, null], ['长'.repeat(501), /最多 500 字/]]) {
    const h = servicePage(REQ, { reason })
    t.after(h.stop)
    await h.boot()
    await h.run('openDetail(7)')
    await h.run('returnToMerchant()')
    assert.deepEqual(h.log.posts, [])
    if (toast) assert.match(h.log.toasts[0], toast)
    else assert.deepEqual(h.log.toasts, [])
    assert.equal(h.s.value, 2)
  }
})
test('商家需求：退回失败（比如任务刚上架）提示原因，留在详情，取最新状态', async (t) => {
  const h = servicePage(REQ, { postFail: Object.assign(new Error('任务已上架，不能退回'), { code: 409 }) })
  t.after(h.stop)
  await h.boot()
  await h.run('openDetail(7)')
  h.log.gets.length = 0
  h.set({ ...REQ, canReturn: false, job: { jobStatus: 'published' } })
  await h.run('returnToMerchant()')
  assert.deepEqual(h.log.toasts, ['任务已上架，不能退回'])
  assert.equal(h.s.value, 2)
  assert.deepEqual(h.log.gets, ['/app/staff/service/requests/7'])
  assert.equal(h.run('detail.value.canReturn'), false)
})

// ---------------------------------------------------------------- 审核活动页

const ACT = { activityId: 31, title: '手作课', cover: '', category: '手作课程', startTime: '2026-11-03 14:00:00', endTime: '2026-11-03 17:00:00', deadline: null, city: '平潭', place: '小院一楼', feeFen: 5000, feeMode: 'offline', feeIncludes: null, priceText: '¥50.00', capacity: 20, intro: '做陶', safetyNote: null, storeId: 201, storeName: '海边咖啡', organizerName: '海边咖啡', creator: '林老板', submitTime: '2026-10-30 09:00:00', status: 'pending', statusLabel: '待审核' }
function auditPage({ rows = [ACT], current = 102, also = false, serviceRole = false, confirmOk = true, reason = '时间不合适', postFail, listFail } = {}) {
  const log = { gets: [], posts: [], toasts: [], selected: [] }
  let boot = null, store = current
  const s = vue.ref(1)
  const h = runSetup('pages/staff/service-activities.vue', {
    ...v, useRequestList, useScreen: (n, o) => { boot = o.onLoad; return s }, ensureSession: async () => {}, hasStaffAccess: { value: true }, currentStaffStoreId: () => store, currentAlsoService: { value: also }, merchantService: { value: serviceRole },
    selectStaffStore: async (id) => { log.selected.push(id); store = id }, absUrl: x => '/abs' + x, mdhm: x => String(x).slice(5, 16), toast: m => log.toasts.push(m),
    errText: (e, d) => (e && e.message) || d, confirm: async () => confirmOk, prompt: async () => reason, uni: { stopPullDownRefresh() {}, showToast() {} },
    get: async (url, params) => { log.gets.push([url, plain(params)]); if (listFail) throw listFail; return { data: { rows, total: rows.length, hasMore: false, city: '平潭', pageNum: 1, pageSize: 50 } } },
    post: async (url, body) => { log.posts.push([url, plain(body)]); if (postFail) throw postFail; return { msg: body.pass ? '已通过，活动已公开' : '已驳回，商家会收到原因' } }
  })
  return { ...h, s, log, boot: async (q = {}) => { boot(q); await flush() } }
}
test('审核活动：按当前门店取待审核；空态、失败文字都在', async (t) => {
  const h = auditPage()
  t.after(h.stop)
  await h.boot()
  assert.deepEqual(h.log.gets[0], ['/app/staff/service/activities', { storeId: 102, status: 'pending', pageNum: 1, pageSize: 50 }])
  assert.equal(h.run('list.rows.value.length'), 1)
  assert.equal(h.run('coverOf(list.rows.value[0])'), '/static/media/cover-empty.png')
  assert.equal(h.run('coverOf({ cover: "/x.jpg" })'), '/abs/x.jpg')
  assert.match(h.template, /现在没有待审核的活动/)
  assert.match(h.template, /<k-button label="重新加载" size="md" type="outline" @click="retryEntry" \/>/)
  const broken = auditPage({ listFail: Object.assign(new Error('没有权限'), { code: 403 }) })
  t.after(broken.stop)
  await broken.boot()
  assert.equal(broken.run('list.error.value'), '没有权限')
})
test('审核活动：消息带门店：商家服务人切过去；兼任的不切，按地址的门店取数；同一家不动', async (t) => {
  const pure = auditPage()
  t.after(pure.stop)
  await pure.boot({ storeId: '201', id: '31' })
  assert.deepEqual(pure.log.selected, ['201'])
  assert.equal(pure.log.gets[0][1].storeId, '201')

  const also = auditPage({ also: true })
  t.after(also.stop)
  await also.boot({ storeId: '201', id: '31' })
  assert.deepEqual(also.log.selected, [])
  assert.equal(also.log.gets[0][1].storeId, '201')

  const same = auditPage({ also: true })
  t.after(same.stop)
  await same.boot({ storeId: '102' })
  assert.deepEqual(same.log.selected, [])
  assert.equal(same.log.gets[0][1].storeId, 102)
})
test('审核活动：id 打开那一条；已经被处理的提示一声，停在列表', async (t) => {
  const h = auditPage()
  t.after(h.stop)
  await h.boot({ id: '31' })
  assert.equal(h.s.value, 2)
  assert.equal(h.run('current.value.activityId'), 31)
  const facts = h.json('facts.value')
  assert.deepEqual(facts.map(f => f.label), ['活动时间', '集合地点', '费用', '名额', '发起门店', '发起人', '提交时间'], '空的不写')
  assert.equal(facts[0].value, '2026-11-03 14:00 至 2026-11-03 17:00')
  assert.equal(facts[2].value, '¥50.00 · 到场支付')

  const gone = auditPage()
  t.after(gone.stop)
  await gone.boot({ id: '99' })
  assert.equal(gone.s.value, 1)
  assert.deepEqual(gone.log.toasts, ['这场活动已经处理过了'])
})
test('审核活动：多城商家服务人从消息进入，用提醒里的门店打开并提交同一场活动', async (t) => {
  const h = auditPage({ current: 102, serviceRole: true })
  t.after(h.stop)
  await h.boot({ storeId: '201', id: '31' })
  assert.equal(h.log.gets[0][1].storeId, '201')
  assert.equal(h.run('current.value.activityId'), 31)
  await h.run('audit(true)')
  assert.deepEqual(h.log.posts, [['/app/staff/service/activities/31/audit?storeId=201', { pass: true }]])
})
test('审核活动：通过先确认；取消不发请求；成功回列表重取', async (t) => {
  const no = auditPage({ confirmOk: false })
  t.after(no.stop)
  await no.boot({ id: '31' })
  await no.run('audit(true)')
  assert.deepEqual(no.log.posts, [])
  assert.equal(no.s.value, 2)

  const h = auditPage()
  t.after(h.stop)
  await h.boot({ id: '31' })
  h.log.gets.length = 0
  await h.run('audit(true)')
  await flush()
  assert.deepEqual(h.log.posts, [['/app/staff/service/activities/31/audit?storeId=102', { pass: true }]])
  assert.deepEqual(h.log.toasts, ['已通过，活动已公开'])
  assert.equal(h.s.value, 1)
  assert.equal(h.log.gets.length, 1)
  assert.equal(h.run('current.value'), null)
})
test('审核活动：驳回必须写原因（1-255 字），取消不发请求', async (t) => {
  assert.equal(v.auditReasonError('  '), '驳回要写原因，商家才知道改什么')
  assert.match(v.auditReasonError('长'.repeat(256)), /最多 255 字/)
  assert.equal(v.auditReasonError('长'.repeat(255)), '')
  for (const [reason, toast] of [['', /要写原因/], [null, null], ['长'.repeat(256), /最多 255 字/]]) {
    const h = auditPage({ reason })
    t.after(h.stop)
    await h.boot({ id: '31' })
    await h.run('audit(false)')
    assert.deepEqual(h.log.posts, [])
    assert.equal(h.s.value, 2)
    if (toast) assert.match(h.log.toasts[0], toast)
  }
  const ok = auditPage()
  t.after(ok.stop)
  await ok.boot({ id: '31' })
  await ok.run('audit(false)')
  assert.deepEqual(ok.log.posts, [['/app/staff/service/activities/31/audit?storeId=102', { pass: false, reason: '时间不合适' }]])
})
test('审核活动：别人先处理了（409 等）回列表；网络问题留在详情可以再点', async (t) => {
  for (const code of [403, 404, 409]) {
    const h = auditPage({ postFail: Object.assign(new Error('已经处理过了'), { code }) })
    t.after(h.stop)
    await h.boot({ id: '31' })
    await h.run('audit(true)')
    await flush()
    assert.equal(h.s.value, 1, String(code))
    assert.deepEqual(h.log.toasts, ['已经处理过了'])
  }
  const net = auditPage({ postFail: new Error('网络不好') })
  t.after(net.stop)
  await net.boot({ id: '31' })
  await net.run('audit(true)')
  assert.equal(net.s.value, 2)
  assert.equal(net.run('working.value'), false)
})
test('审核活动：连点只发一次；按钮处理中不能点', async (t) => {
  const h = auditPage()
  t.after(h.stop)
  await h.boot({ id: '31' })
  await Promise.all([h.run('audit(true)'), h.run('audit(true)'), h.run('audit(false)')])
  await flush()
  assert.equal(h.log.posts.length, 1)
  assert.match(h.template, /:disabled="working" label="驳回"/)
  assert.match(h.template, /:disabled="working" :label="working \? '处理中…' : '通过'"/)
})

// ---------------------------------------------------------------- 线上任务招募概况

function dailyPage({ fail, current = 102 } = {}) {
  const log = { gets: [] }
  let loaded = null
  const h = runSetup('pages/staff/online-daily.vue', {
    ...v, onLoad: fn => { loaded = fn }, ensureSession: async () => {}, hasStaffAccess: { value: true }, currentStaffStoreId: () => current, getSessionRevision: () => 1, errText: (e, d) => (e && e.message) || d,
    get: async (url, params) => { log.gets.push([url, plain(params)]); if (fail) throw fail; return { data: { city: '平潭', date: '2026-10-30', recruiting: 2, shortfall: 5, toReview: 1, toAccept: 4, note: '说明', tasks: [{ jobId: 1, title: '探店', storeName: '海边咖啡', status: 'published', statusLabel: '招募中', headcount: 5, working: 2, shortfall: 3, toReview: 1, toAccept: 0 }, { jobId: 2, title: '已关的', storeName: '海边咖啡', status: 'closed', statusLabel: '已关闭', headcount: 1, working: 1, shortfall: 0, toReview: 0, toAccept: 4 }] } } },
    uni: { stopPullDownRefresh() {} }
  })
  return { ...h, log, boot: async (q) => { await loaded(q); await flush() } }
}
test('线上任务招募概况：地址带门店就按它取，不切当前门店；只读，没有写请求和报名人', async (t) => {
  const h = dailyPage()
  t.after(h.stop)
  await h.boot({ storeId: '201' })
  assert.deepEqual(h.log.gets, [['/app/staff/daily/online', { storeId: '201' }]])
  assert.equal(h.json('tasks.value').length, 2)
  assert.equal(h.run('loaded.value'), true)
  const page = src('pages/staff/online-daily.vue')
  assert.doesNotMatch(page, /\b(post|put|del)\(/)
  assert.doesNotMatch(page, /selectStaffStore/)
  assert.match(page, /import \{ get \} from '@\/common\/request\.js'/)
  assert.match(h.template, /<k-tabbar mode="staff" active="business" \/>/)
  const none = dailyPage()
  t.after(none.stop)
  await none.boot({})
  assert.deepEqual(none.log.gets, [['/app/staff/daily/online', { storeId: 102 }]])
})
test('线上任务招募概况：普通小院主理人、换工主理人被 403 时显示那句话，可以重试', async (t) => {
  const h = dailyPage({ fail: Object.assign(new Error('当前角色不能查看'), { code: 403 }) })
  t.after(h.stop)
  await h.boot({})
  assert.equal(h.run('error.value'), '当前角色不能查看')
  assert.equal(h.run('loaded.value'), false)
  assert.match(h.template, /<k-button label="重新加载" size="md" type="outline" @click="load" \/>/)
})
test('任务卡片的数：名额、在做、缺口、待审核、待验收；有缺口、有待办的标出来', () => {
  const row = v.onlineTaskStats({ headcount: 5, working: 2, shortfall: 3, toReview: 0, toAccept: 1 })
  assert.deepEqual(row.map(c => [c.label, c.value, !!c.warn]), [['名额', 5, false], ['在做', 2, false], ['缺口', 3, true], ['待审核', 0, false], ['待验收', 1, true]])
  assert.equal(v.onlineTaskTone({ status: 'published' }), 'green')
  assert.equal(v.onlineTaskTone({ status: 'closed' }), 'neutral')
})

// ---------------------------------------------------------------- 商家服务人工作台

// 主人 2026-11-03：工作台改成和小院主理人一样的「优先处理」+「快捷入口」，一个项目一格，有待办出红色数字；去掉混在一起的列表和「任务页」那段说明
const MY_TASKS = [{ requestType: 'online_task', jobId: 88, jobStatus: 'published', status: 'accepted', mine: true }, { requestType: 'online_task', jobId: 99, jobStatus: 'published', status: 'accepted', mine: false }]
function serviceWork({ auditFail, listFail } = {}) {
  const log = { gets: [], gone: [] }
  const current = { value: { storeId: 102, roleCode: 'merchant_service', storeName: '海边小院' } }
  const h = runSetup('pages/staff/components/k-service-work.vue', {
    ...v, R, defineProps: () => ({ activeTab: 'work' }), currentStaffStore: current, staffStores: { value: [current.value] }, ensureSession: async () => {}, getSessionRevision: () => 1, staffStoreUrl: storeUrl, go: u => log.gone.push(u), toast() {}, errText: (e, d) => d,
    get: async (url, params) => {
      log.gets.push([url, plain(params)])
      if (url === v.SERVICE_ACTIVITIES_API) { if (auditFail) throw new Error('x'); return { data: { rows: [{ title: '海边音乐会', storeName: '海边咖啡' }], total: 3 } } }
      if (url === v.ONLINE_DAILY_API) return { data: { tasks: [{ jobId: 88, toReview: 2, toAccept: 1 }, { jobId: 99, toReview: 5, toAccept: 5 }] } }
      if (listFail) throw new Error('x')
      if (params.status === 'forwarded') return { data: { rows: params.type === 'managed' ? [{ title: '代运营 · 海边咖啡', typeLabel: '代运营', storeName: '海边咖啡' }] : [], total: params.type === 'managed' ? 2 : 0, city: '平潭' } }
      return { data: { rows: params.status === 'accepted' ? MY_TASKS : [], total: 0 } }
    }
  })
  return { ...h, log }
}
test('商家服务人工作台：三类需求各取待接手数，线上任务管理只算他接手的任务；每格有自己的红色数字', async (t) => {
  const h = serviceWork()
  t.after(h.stop)
  await h.run('load()')
  await flush()
  assert.deepEqual(h.log.gets.filter(g => g[1].status === 'forwarded').map(g => g[1]), [
    { storeId: 102, type: 'online_task', status: 'forwarded', pageSize: 1 }, { storeId: 102, type: 'managed', status: 'forwarded', pageSize: 1 }, { storeId: 102, type: 'cloud_chain', status: 'forwarded', pageSize: 1 }])
  assert.deepEqual(plain(h.run('counts.value')), { online_task: 0, managed: 2, cloud_chain: 0, audit: 3, toReview: 2, toAccept: 1 })
  assert.deepEqual(plain(h.run('board.value.quick.map(q => [q.label, q.badge])')), [['线上任务管理', '3'], ['线上任务需求', ''], ['代运营', '2'], ['抖音卖房', ''], ['待审核活动', '3'], ['招募概况', '']])
  assert.deepEqual(plain(h.run('board.value.priority.map(p => p.num + p.title + ' + "'｜'" + ' + p.sub)')), ['2条代运营待接手｜海边咖啡', '2份线上任务报名待审核｜在「线上任务管理」里接单', '1份线上任务成果待验收｜在「线上任务管理」里验收、登记付款', '3场活动待审核｜海边咖啡 · 海边音乐会'])
  h.run("open('manage'); open('managed'); open('audit'); open('daily')")
  assert.deepEqual(h.log.gone, ['/pages/staff/service?manage=1', '/pages/staff/service?type=managed&status=forwarded', '/pages/staff/service-activities?storeId=102', '/pages/staff/online-daily?storeId=102'])
  assert.doesNotMatch(h.template, /任务页|req-foot|req-tiles|k-request-row/)
  assert.match(h.template, /优先处理[\s\S]*去处理[\s\S]*快捷入口[\s\S]*sw-quick__badge/)
})
test('商家服务人工作台：活动的数读不出来不连累需求；需求读不出来提示重试，快捷入口照样能点', async (t) => {
  const broken = serviceWork({ auditFail: true })
  t.after(broken.stop)
  await broken.run('load()')
  await flush()
  assert.equal(broken.run('error.value'), '')
  assert.equal(broken.run('counts.value.managed'), 2)
  assert.equal(broken.run('counts.value.audit'), null)
  assert.equal(broken.run("board.value.quick.find(q => q.key === 'audit').badge"), '')
  const down = serviceWork({ listFail: true })
  t.after(down.stop)
  await down.run('load()')
  await flush()
  assert.equal(down.run('error.value'), '加载失败，请重试')
  assert.equal(down.run('board.value.quick.length'), 6)
  assert.equal(down.run('board.value.priority.length'), 0)
  assert.match(down.template, /<view v-if="error" class="sw-error"[^>]*@click="load"/)
})

// ---------------------------------------------------------------- 注册、守卫、主包

test('新页在 staff 分包、能下拉刷新；路径放 request-view.js，不往 common/api.js、routes.js 加', () => {
  const pages = JSON.parse(src('pages.json').replace(/^﻿/, ''))
  const staff = pages.subPackages.find(p => p.root === 'pages/staff')
  for (const name of ['service-activities', 'online-daily']) {
    const page = staff.pages.find(p => p.path === name)
    assert.ok(page, name)
    assert.equal(page.style.navigationStyle, 'custom')
    assert.equal(page.style.enablePullDownRefresh, true)
    assert.ok(fs.existsSync(path.join(APP, 'pages/staff', name + '.vue')), name)
  }
  // 服务端消息的 route 写死了这个路径（KgActivityService）
  assert.equal(v.SERVICE_ACTIVITIES_PAGE, '/pages/staff/service-activities')
  assert.equal(v.ONLINE_DAILY_PAGE, '/pages/staff/online-daily')
  assert.doesNotMatch(src('common/api.js'), /service\/activities|daily\/online/)
  assert.doesNotMatch(src('common/routes.js'), /service-activities|online-daily/)
})

test('新文件能被编译器解析，模板能编译，没有表情', () => {
  for (const rel of ['pages/staff/service-activities.vue', 'pages/staff/online-daily.vue', 'pages/staff/index.vue', 'pages/staff/business.vue', 'pages/staff/service.vue', 'pages/staff/components/k-service-work.vue', 'pages/staff/components/k-merchant-work.vue']) {
    const { errors, descriptor } = compiler.parse(src(rel), { filename: rel })
    assert.deepEqual(errors, [], rel)
    const compiled = compiler.compileTemplate({ source: descriptor.template.content, filename: rel, id: 'x' })
    assert.deepEqual(compiled.errors, [], rel)
    assert.doesNotMatch(src(rel), /[\u{1F300}-\u{1FAFF}]/u, rel)
  }
})

test('currentAlsoService：只有小院主理人那条授权开了兼任才算，跟着当前门店走', () => {
  const storage = new Map()
  globalThis.uni = { getStorageSync: k => storage.get(k), setStorageSync: (k, x) => storage.set(k, x), removeStorageSync: k => storage.delete(k) }
  session.logout()
  session.acceptAuthenticatedAccount({ id: 'luna', staffGrants: [
    { storeId: 1, roleCode: 'keeper', active: true, alsoService: true }, { storeId: 2, roleCode: 'keeper', active: true, alsoService: false },
    { storeId: 3, roleCode: 'merchant_service', active: true, alsoService: true }, { storeId: 4, roleCode: 'manager', active: true }
  ] })
  const results = [1, 2, 3, 4].map(id => { session.setStaffStore(id); return session.currentAlsoService.value })
  assert.deepEqual(results, [true, false, false, false])
  session.setStaffStore(1)
  assert.equal(session.merchantService.value, false, '兼任还是小院主理人的工作台')
  assert.equal(session.threeTabStaff.value, false, '底栏还是四格')
})

/** 真跑一遍 main.js 里的 onLoad 守卫：把 import 换成假的 experience，看页面有没有被送走 */
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
test('守卫：商家服务人能进两个新页，别的页面还是送回；兼任的小院主理人一路通；消息带门店按那家店的角色判', async () => {
  const service = [{ storeId: 3, roleCode: 'merchant_service' }]
  for (const route of ['pages/staff/service-activities', 'pages/staff/online-daily', 'pages/staff/service', 'pages/staff/online-jobs', 'pages/staff/applications']) {
    assert.deepEqual(await runGuard({ route, current: 3, grants: service }), [], route)
  }
  assert.deepEqual(await runGuard({ route: 'pages/staff/dispatch', current: 3, grants: service }), ['/pages/staff/index'])
  const luna = [{ storeId: 1, roleCode: 'keeper', alsoService: true }, { storeId: 3, roleCode: 'merchant_service' }]
  for (const route of ['pages/staff/service-activities', 'pages/staff/online-daily', 'pages/staff/service', 'pages/staff/online-jobs']) {
    assert.deepEqual(await runGuard({ route, current: 1, grants: luna }), [], route)
  }
  assert.deepEqual(await runGuard({ route: 'pages/staff/service-activities', query: { storeId: '3', id: '31' }, current: 1, grants: luna }), [])
  // 换工主理人不走白名单：能打开页面，服务端 403，页面显示那句话
  assert.deepEqual(await runGuard({ route: 'pages/staff/online-daily', current: 2, grants: [{ storeId: 2, roleCode: 'manager' }] }), [])
  // 小院主理人的老路线不收：换工概况、调度、保险的链接还能打开
  for (const route of ['pages/staff/volunteers', 'pages/staff/dispatch', 'pages/staff/insurance', 'pages/staff/jobs', 'pages/staff/talents']) {
    assert.deepEqual(await runGuard({ route, current: 1, grants: luna }), [], route)
  }
})


test('报名详情切换同店身份后清空，上一身份迟到的详情不能显示', async t => {
  let finish
  const store = vue.ref({ storeId: 102, roleCode: 'manager' })
  const h = applications('manager', { overrides: {
    currentStaffStore: store,
    apiStaffApplicationDetail: () => new Promise(resolve => { finish = resolve })
  } })
  t.after(h.stop)
  await h.start()
  const reading = h.run('openDetail({ appId: 79 })')
  assert.equal(h.s.value, 2)
  store.value = { storeId: 102, roleCode: 'merchant' }
  finish({ data: { appId: 79, canAudit: true } })
  await reading
  await flush()
  assert.equal(h.s.value, 1)
  assert.equal(h.run('current.value'), null)
  assert.equal(h.run('detail.value'), null)
  assert.equal(h.run('canAudit.value'), false)
})
