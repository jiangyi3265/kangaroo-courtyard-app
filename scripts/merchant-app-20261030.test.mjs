// 2026-10-30 商家端（V63）：node --test，不需要构建、不发真实请求。
// 守住这几件事：
//   · 成为商家：不问「想招的人」，填完即开通，刷新账号后进商家端；没自动开通的只看进度；已是商家的不再给表；
//   · 底栏：merchant、merchant_service、city_lead 只有 首页 / 消息 / 我的，各页传 active="business" 时亮「首页」；其他角色不变；
//   · 商家首页：四个板块 + 体验反馈 + 我发布的；房源、活动、报名入口不在首页；「线上任务」直接进发布，代运营、抖音卖房单独两个入口（10-31 主人拍板）；
//   · 代运营 / 抖音卖房表单、需求进度、被退回后修改；线上任务回发布表单里改；
//   · 商家发招募、线上任务的文案说的是换工主理人 / 商家服务人，其他角色还是平台审核；
//   · 新页在 staff 分包，白名单和 pages.json 同步，主包 common/api.js 没加接口。
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'
import test from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'vite'

const APP = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const require = createRequire(path.join(APP, 'package.json'))
const compiler = require('@vue/compiler-sfc'), vue = require('vue')
const read = (rel) => fs.readFileSync(path.join(APP, rel), 'utf8').replace(/\r\n/g, '\n')
const sfc = (rel) => compiler.parse(read(rel), { filename: rel }).descriptor
const plain = (v) => JSON.parse(JSON.stringify(v))
const flush = () => new Promise(resolve => setImmediate(resolve))

const vite = await createServer({ configFile: false, server: { middlewareMode: true, hmr: false } })
const session = await vite.ssrLoadModule('/common/experience.js')
const logic = await vite.ssrLoadModule('/pages/staff/merchant-request-logic.js')
await vite.close()

/** 在沙箱里跑页面的 script setup：导入一律先给永远不返回的函数，再用 stubs 覆盖用得到的那几个 */
function runSetup(rel, stubs) {
  const d = sfc(rel)
  const source = d.scriptSetup.content
  const ast = compiler.babelParse(source, { sourceType: 'module' })
  const body = ast.program.body.filter(n => n.type !== 'ImportDeclaration').map(n => source.slice(n.start, n.end)).join('\n')
  const sandbox = { console, setTimeout, clearTimeout, setInterval: () => 0, clearInterval() {}, Set }
  for (const n of ast.program.body.filter(n => n.type === 'ImportDeclaration')) for (const s of n.specifiers) sandbox[s.local.name] = () => new Promise(() => {})
  Object.assign(sandbox, { ref: vue.ref, computed: vue.computed, watch: vue.watch, reactive: vue.reactive, onShow() {}, onHide() {}, onLoad() {}, onUnload() {}, onUnmounted() {}, onMounted() {}, onBeforeUnmount() {}, defineOptions() {}, defineProps: (o) => o }, stubs)
  vm.createContext(sandbox)
  const scope = vue.effectScope()
  scope.run(() => vm.runInContext(body, sandbox, { filename: rel }))
  return { run: code => vm.runInContext(code, sandbox), json: code => JSON.parse(vm.runInContext('JSON.stringify(' + code + ')', sandbox)), stop: () => scope.stop(), template: d.template.content, sandbox }
}

const R = { staff: '/pages/staff/index', staffOnline: '/pages/staff/online-jobs', staffJobs: '/pages/staff/jobs', support: '/pages/notice/support', profile: '/pages/profile/index' }

// ---------------------------------------------------------------- 角色标志
test('experience：三个新标志只看当前门店的角色；切到别的门店跟着变', () => {
  const storage = new Map()
  globalThis.uni = { getStorageSync: k => storage.get(k), setStorageSync: (k, v) => storage.set(k, v), removeStorageSync: k => storage.delete(k) }
  session.logout()
  session.acceptAuthenticatedAccount({ id: 'm', staffGrants: [
    { storeId: 1, roleCode: 'merchant', active: true }, { storeId: 2, roleCode: 'merchant_service', active: true },
    { storeId: 3, roleCode: 'city_lead', active: true }, { storeId: 4, roleCode: 'keeper', active: true }, { storeId: 5, roleCode: 'online_staff', active: true }
  ] })
  const flags = () => [session.merchantStaff.value, session.merchantService.value, session.cityLead.value, session.threeTabStaff.value]
  session.setStaffStore(1); assert.deepEqual(flags(), [true, false, false, true])
  session.setStaffStore(2); assert.deepEqual(flags(), [false, true, false, true])
  session.setStaffStore(3); assert.deepEqual(flags(), [false, false, true, true])
  session.setStaffStore(4); assert.deepEqual(flags(), [false, false, false, false])
  session.setStaffStore(5); assert.deepEqual(flags(), [false, false, false, false])
  session.logout()
  assert.equal(session.threeTabStaff.value, false)
})

// ---------------------------------------------------------------- 底栏
function tabbarOf({ threeTab = false, online = false, active = 'work', mode = 'staff' } = {}) {
  const h = runSetup('components/k-tabbar/k-tabbar.vue', {
    threeTabStaff: { value: threeTab }, onlineStaff: { value: online }, unreadCount: { value: 0 }, props: { active, mode, theme: '', badge: '' },
    communityEnabled: { value: true },
    defineProps: () => ({ active, mode, theme: '', badge: '' })
  })
  return { keys: h.json('items.value.map(i => i.key)'), labels: h.json('items.value.map(i => i.label)'), on: h.run('on.value'), stop: h.stop }
}
test('底栏：商家、商家服务人、城市负责人三个 tab；各页传 business 时亮首页；其他角色和用户身份不变', () => {
  const three = tabbarOf({ threeTab: true, active: 'business' })
  assert.deepEqual(three.keys, ['work', 'messages', 'profile'])
  assert.deepEqual(three.labels, ['首页', '消息', '我的'])
  assert.equal(three.on, 'work', '在没有「业务」格的身份下，online-jobs 这类页面传 business 也要有高亮')
  assert.equal(tabbarOf({ threeTab: true, active: 'messages' }).on, 'messages')
  assert.equal(tabbarOf({ threeTab: true, active: 'profile' }).on, 'profile')
  const keeper = tabbarOf({ active: 'business' })
  assert.deepEqual(keeper.labels, ['工作台', '业务', '发布', '消息', '我的'])
  assert.equal(keeper.on, 'business')
  assert.deepEqual(tabbarOf({ online: true }).labels, ['工作台', '报名', '发布', '消息', '我的'])
  const user = tabbarOf({ threeTab: true, mode: 'user', active: 'business' })
  assert.deepEqual(user.keys, ['home', 'community', 'publish', 'messages', 'profile'], '身份是用户时不受影响')
  assert.equal(user.on, 'business')
})
test('底栏：所有员工模式页面传的 active 都是这四个值之一（商家打开任何一页都有高亮）', () => {
  const walk = (dir) => fs.readdirSync(path.join(APP, dir), { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(dir + '/' + e.name) : (e.name.endsWith('.vue') ? [dir + '/' + e.name] : []))
  const found = []
  for (const rel of walk('pages')) {
    for (const m of read(rel).matchAll(/<k-tabbar\b[^>]*\bmode="staff"[^>]*>/g)) {
      const tag = m[0]
      const fixed = /\sactive="([^"]+)"/.exec(tag)
      const bound = /:active="([^"]+)"/.exec(tag)
      const values = fixed ? [fixed[1]] : [...(bound ? bound[1] : '').matchAll(/'([^']+)'/g)].map(x => x[1])
      found.push(rel)
      assert.ok(values.length > 0, rel + ' ' + tag)
      for (const v of values) assert.ok(['work', 'business', 'messages', 'profile'].includes(v), rel + ' ' + tag)
    }
  }
  assert.ok(found.includes('pages/staff/components/k-merchant-work.vue'))
  assert.ok(found.includes('pages/staff/online-jobs.vue'))
})

// ---------------------------------------------------------------- 成为商家
function merchantPage({ apply, grants = [] } = {}) {
  const log = { toasts: [], posted: [], alerts: [], launched: [], refreshed: 0, store: [], modes: [] }
  const staffStores = vue.ref(grants)
  const h = runSetup('pages/profile/merchant.vue', {
    toast: m => log.toasts.push(m), errText: (e, d) => (e && e.message) || d, experience: { account: { nickname: '阿杰' } }, staffStores,
    apiSubmitMerchantApply: async (b) => { log.posted.push(plain(b)); return apply(b) },
    alert: async (t, m) => { log.alerts.push([t, m]) },
    refreshAccount: async () => { log.refreshed++; staffStores.value = [{ storeId: 77, roleCode: 'merchant', active: true }] },
    setStaffStore: id => log.store.push(id), switchMode: m => { log.modes.push(m); return R.staff },
    uni: { reLaunch: o => log.launched.push(o.url), pageScrollTo() {} }
  })
  h.run("Object.assign(form, { contactName: '阿杰', phone: '13912345678', city: '大理', storeType: 'homestay', storeName: '喜洲小院' })")
  return { h, log }
}
test('成为商家：页面没有「想招的人」；提交即开通，刷新账号、切到新门店、进商家端', async (t) => {
  const tpl = sfc('pages/profile/merchant.vue').template.content
  assert.ok(!tpl.includes('想招的人'))
  assert.ok(!sfc('pages/profile/merchant.vue').scriptSetup.content.includes('toggleWant'))
  const { h, log } = merchantPage({ apply: async () => ({ data: { approved: true, storeId: 77, message: '已通过，可以开始发布招募了', latest: { status: 'settled' } } }) })
  t.after(h.stop)
  await h.run('submit()')
  assert.equal(log.posted.length, 1)
  assert.ok(!('wantTypes' in log.posted[0]), '不传想招的人')
  assert.deepEqual(log.alerts, [['已开通', '已通过，可以开始发布招募了']])
  assert.equal(log.refreshed, 1)
  assert.deepEqual(log.store, [77])
  assert.deepEqual(log.modes, ['staff'])
  assert.deepEqual(log.launched, [R.staff])
})
test('成为商家：没自动开通只显示进度；已是商家给按钮不给表；进商家端失败不跳走', async (t) => {
  const pending = merchantPage({ apply: async () => ({ data: { approved: false, message: '已提交，袋鼠小院会尽快电话联系你', latest: { status: 'new', open: true } } }) })
  t.after(pending.h.stop)
  await pending.h.run('submit()')
  assert.equal(pending.h.run('waiting.value'), true)
  assert.equal(pending.log.refreshed, 0)
  assert.deepEqual(pending.log.launched, [])
  assert.equal(pending.log.toasts.pop(), '已提交，袋鼠小院会尽快电话联系你')

  const already = merchantPage({ apply: async () => ({}), grants: [{ storeId: 5, roleCode: 'merchant', active: true }] })
  t.after(already.h.stop)
  assert.equal(already.h.json('merchantGrant.value').storeId, 5)
  assert.match(sfc('pages/profile/merchant.vue').template.content, /<k-button v-if="loaded && merchantGrant"[^>]*进入商家端/)

  const broken = merchantPage({ apply: async () => ({ data: { approved: true, storeId: 77 } }) })
  t.after(broken.h.stop)
  broken.h.sandbox.refreshAccount = async () => { throw new Error('网络连接失败') }
  await broken.h.run('submit()')
  assert.deepEqual(broken.log.launched, [])
  assert.equal(broken.log.toasts.pop(), '网络连接失败')
  assert.equal(broken.h.run('entering.value'), false, '失败后还能再点')
})

// ---------------------------------------------------------------- 商家首页
function homePage({ rows = [], hasMore = false } = {}) {
  const log = { gone: [], gets: [], sheets: [] }
  const current = { value: { storeId: 9, storeName: '喜洲小院' } }
  const h = runSetup('pages/staff/components/k-merchant-work.vue', {
    R, currentStaffStore: current, staffStores: { value: [current.value] }, ensureSession: async () => {}, getSessionRevision: () => 1,
    staffStoreUrl: url => url + (url.includes('?') ? '&' : '?') + 'storeId=9', go: u => log.gone.push(u), toast() {},
    APPLY_KINDS: logic.APPLY_KINDS, REQUEST_API: logic.REQUEST_API, REQUEST_PAGE: logic.REQUEST_PAGE, requestTone: logic.requestTone,
    sheet: async (list) => { log.sheets.push(plain(list)); return -1 },
    get: async (url, params) => { log.gets.push(plain([url, params])); return { data: { rows: params.pageNum > 1 ? [{ requestId: 2 }, { requestId: 3 }] : rows, hasMore: params.pageNum > 1 ? false : hasMore } } },
    watch() {}
  })
  return { h, log }
}
test('商家首页保留四个发布板块，提供房源、结算与任务发布费用入口', async (t) => {
  const { h, log } = homePage({ rows: [{ requestId: 1, storeId: 9, status: 'dispatched', statusLabel: '换工主理人完善中' }, { requestId: 2, storeId: 9 }], hasMore: true })
  t.after(h.stop)
  assert.deepEqual(h.json('boards.map(b => b.label)'), ['招募换工', '招募兼职', '招募全职', '线上任务'])
  assert.doesNotMatch(h.template, /体验反馈/)
  assert.match(h.template, /我的需求/)
  assert.doesNotMatch(h.template, /员工端/)
  assert.ok(h.json('links').some(link => link.route === '/pages/staff/publication-fees'))
  assert.ok(h.json('links').some(link => link.route === '/pages/staff/settlements'))
  await h.run('openBoard("volunteer")')
  await h.run('openBoard("parttime")')
  await h.run('openBoard("fulltime")')
  assert.deepEqual(log.gone, ['/pages/staff/jobs?s=2&kind=volunteer&storeId=9', '/pages/staff/jobs?s=2&kind=parttime&storeId=9', '/pages/staff/jobs?s=2&kind=fulltime&storeId=9'])
  log.gone.length = 0
  await h.run('load()')
  assert.deepEqual(log.gets[0], [logic.REQUEST_API, { storeId: 9, pageNum: 1, pageSize: 10 }])
  assert.equal(h.json('rows.value').length, 2)
  h.run('openRequest(rows.value[0])')
  assert.deepEqual(log.gone, ['/pages/staff/merchant-request?id=1&storeId=9'])
  // 查看更多：按编号去重（翻页时列表可能被新提交的挤动）
  await h.run('loadMore()')
  assert.deepEqual(h.json('rows.value.map(r => r.requestId)'), [1, 2, 3])
  assert.equal(h.run('hasMore.value'), false)
})
// 10-31 主人拍板：代运营、抖音卖房拿出来单独放，点「线上任务」直接进发布，不再弹三选一（原来这里断言三选一）
test('商家首页：「线上任务」直接进发布、不弹三选一；「申请代运营」「抖音卖房」单独两个入口，各去各的表单', async (t) => {
  const go = async (kind) => {
    const { h, log } = homePage()
    t.after(h.stop)
    await h.run('openBoard("' + kind + '")')
    assert.deepEqual(log.sheets, [], '不弹选择')
    return log.gone
  }
  assert.deepEqual(await go('online'), ['/pages/staff/online-jobs?s=1&storeId=9'])
  assert.deepEqual(await go('managed'), ['/pages/staff/merchant-request?type=managed&storeId=9'])
  assert.deepEqual(await go('cloud_chain'), ['/pages/staff/merchant-request?type=cloud_chain&storeId=9'])
  const { h } = homePage()
  t.after(h.stop)
  assert.deepEqual(h.json('applyBoards.map(b => [b.kind, b.label])'), [['managed', '申请代运营'], ['cloud_chain', '抖音卖房']])
  assert.match(h.template, /v-for="entry in applyBoards"/)
  assert.doesNotMatch(read('pages/staff/merchant-request-logic.js'), /ONLINE_CHOICES/)
})

// ---------------------------------------------------------------- 进度
test('进度条：招募、线上类、退回、关闭各画各的；当前一步只有一个', () => {
  const states = (t, s) => logic.requestSteps(t, s).map(x => x.state).join()
  const labels = (t, s) => logic.requestSteps(t, s).map(x => x.label)
  assert.equal(states('volunteer', 'dispatched'), 'done,now,todo')
  assert.equal(states('fulltime', 'published'), 'done,done,done')
  // 2026-11-03 主人：简化商家端——招募三步「已提交 → 袋鼠核实中 → 已上架」，线上类三步「已提交 → 袋鼠处理中 → 已完成」，不再分谁核实谁处理
  assert.deepEqual(labels('parttime', 'unassigned'), ['已提交', '袋鼠核实中', '已上架'])
  assert.equal(states('online_task', 'pending_verify'), 'done,now,todo')
  assert.equal(states('managed', 'forwarded'), 'done,now,todo')
  assert.equal(states('cloud_chain', 'accepted'), 'done,now,todo')
  assert.equal(states('managed', 'done'), 'done,done,done')
  assert.deepEqual(labels('managed', 'unassigned'), ['已提交', '袋鼠处理中', '已完成'])
  assert.deepEqual(labels('managed', 'returned'), ['已提交', '已退回，可修改后再提交'])
  assert.deepEqual(labels('volunteer', 'closed'), ['已提交', '已关闭'])
  assert.equal(logic.requestTone('returned'), 'bad')
  assert.equal(logic.requestTone('published'), 'good')
  assert.equal(logic.requestTone('closed'), 'mute')
  assert.equal(logic.requestTone('forwarded'), 'wait')
})
test('表单先挡漏填；后续入口只在上架后出现', () => {
  assert.equal(logic.formProblem({ content: '  ' }), '请填写需求说明')
  assert.equal(logic.formProblem({ content: 'x', contactName: '' }), '请填写联系人')
  assert.equal(logic.formProblem({ content: 'x', contactName: '阿杰', contactPhone: '123' }), '请填写 11 位手机号')
  assert.equal(logic.formProblem({ content: 'x', contactName: '阿杰', contactPhone: '13912345678' }), '')
  assert.equal(logic.requestFollowUp({ jobId: 8, storeId: 9, requestType: 'online_task', job: { jobStatus: 'draft' } }, R), null)
  assert.equal(logic.requestFollowUp({ jobId: null, requestType: 'managed' }, R), null)
  assert.deepEqual(logic.requestFollowUp({ jobId: 8, storeId: 9, requestType: 'online_task', job: { jobStatus: 'published' } }, R), { label: '查看报名与成果', url: '/pages/staff/online-jobs?jobId=8&storeId=9' })
  assert.deepEqual(logic.requestFollowUp({ jobId: 8, storeId: 9, requestType: 'volunteer', job: { jobStatus: 'published' } }, R), { label: '查看岗位', url: '/pages/staff/jobs?storeId=9' })
  assert.equal(logic.resubmitUrl({ requestId: 5, storeId: 9 }, R), '/pages/staff/online-jobs?s=1&requestId=5&storeId=9')
})

function requestPage({ detail = null, rows = [], fail = null } = {}) {
  const log = { posted: [], puts: [], toasts: [], alerts: [], launched: [], replaced: [], gets: [] }
  let onLoad = null
  const h = runSetup('pages/staff/merchant-request.vue', {
    R, onLoad: fn => { onLoad = fn }, ensureSession: async () => {}, currentStaffStoreId: () => 9, experience: { account: { nickname: '小杰' } }, absUrl: x => x,
    APPLY_KINDS: logic.APPLY_KINDS, REQUEST_API: logic.REQUEST_API, formProblem: logic.formProblem, requestFollowUp: logic.requestFollowUp, requestSteps: logic.requestSteps, requestTone: logic.requestTone, resubmitUrl: logic.resubmitUrl, staffWording: logic.staffWording,
    toast: m => log.toasts.push(m), errText: (e, d) => (e && e.message) || d, alert: async (t, m) => { log.alerts.push([t, m]) }, replace: u => log.replaced.push(u), go() {},
    get: async (url, params) => { log.gets.push(plain([url, params])); return url === logic.REQUEST_API ? { data: { rows } } : { data: detail } },
    post: async (url, body, opts) => { if (fail) throw fail; log.posted.push(plain([url, body, opts])); return { data: { message: '已提交，本城换工主理人会尽快核实' } } },
    put: async (url, body, opts) => { log.puts.push(plain([url, body, opts])); return { data: { message: '已重新提交，本城换工主理人会尽快核实' } } },
    uni: { reLaunch: o => log.launched.push(o.url), showLoading() {}, hideLoading() {} }
  })
  h.run('merchantAgreement.value = { confirm: async () => true }')
  return { h, log, load: async (q) => { await onLoad(q); await flush() } }
}
test('申请代运营：先带上上一条留的联系人；协议取消不提交，确认后提交带类型和门店', async (t) => {
  const { h, log, load } = requestPage({ rows: [{ contactName: '阿杰', contactPhone: '13912345678' }] })
  t.after(h.stop)
  await load({ type: 'managed' })
  assert.equal(h.run('pageTitle.value'), '申请代运营')
  assert.equal(h.run('editing.value'), true)
  assert.equal(h.run('form.contactName'), '阿杰')
  await h.run('submit()')
  assert.equal(log.toasts.pop(), '请填写需求说明')
  assert.equal(log.posted.length, 0)
  h.run("form.content = ' 想把线上运营交给你们 '")
  h.run('merchantAgreement.value = { confirm: async () => false }')
  await h.run('submit()')
  assert.equal(log.posted.length, 0)
  assert.equal(h.run('submitting.value'), false)
  h.run('merchantAgreement.value = { confirm: async () => true }')
  await h.run('submit()')
  assert.deepEqual(log.posted, [[logic.REQUEST_API, { content: '想把线上运营交给你们', contactName: '阿杰', contactPhone: '13912345678', images: [], requestType: 'managed' }, { params: { storeId: 9 } }]])
  // 2026-11-03 主人：简化商家端文案——服务端的「换工主理人」在商家这边显示成「袋鼠工作人员」
  assert.deepEqual(log.alerts, [['已提交', '已提交，本城袋鼠工作人员会尽快核实']])
  assert.deepEqual(log.launched, [R.staff])

  const bad = requestPage({ fail: new Error('请填写 11 位手机号') })
  t.after(bad.h.stop)
  await bad.load({ type: 'cloud_chain' })
  bad.h.run("Object.assign(form, { content: 'x', contactName: 'y', contactPhone: '13912345678' })")
  await bad.h.run('submit()')
  assert.deepEqual(bad.log.launched, [])
  assert.equal(bad.log.toasts.pop(), '请填写 11 位手机号')
  assert.equal(bad.h.run('submitting.value'), false)
})
test('需求进度：被退回的代运营就地改了再交（PUT）；线上任务回发布表单；没有可编辑时没有入口', async (t) => {
  const row = { requestId: 5, storeId: 9, requestType: 'managed', status: 'returned', typeLabel: '代运营', statusLabel: '已退回，可修改后再提交', title: '代运营 · 喜洲小院', content: '原来的说明', contactName: '阿杰', contactPhone: '13912345678', images: ['/profile/upload/a.jpg'], returnReason: '请写清房间数', canEdit: true }
  const { h, log, load } = requestPage({ detail: row })
  t.after(h.stop)
  await load({ id: '5', storeId: '9' })
  assert.deepEqual(log.gets[0], [logic.REQUEST_API + '/5', { storeId: '9' }])
  assert.equal(h.run('pageTitle.value'), '需求进度')
  assert.equal(h.json('steps.value').length, 2)
  h.run('startEdit()')
  assert.equal(h.run('editing.value'), true)
  assert.equal(h.run('returnReason.value'), '请写清房间数', '改的时候还能看到退回原因')
  h.run("form.content = '新的说明'")
  await h.run('submit()')
  assert.equal(log.posted.length, 0)
  assert.deepEqual(log.puts, [[logic.REQUEST_API + '/5', { content: '新的说明', contactName: '阿杰', contactPhone: '13912345678', images: ['/profile/upload/a.jpg'] }, { params: { storeId: '9' } }]])
  assert.deepEqual(log.launched, [R.staff])

  const online = requestPage({ detail: { ...row, requestType: 'online_task', jobId: 8 } })
  t.after(online.h.stop)
  await online.load({ id: '5', storeId: '9' })
  online.h.run('startEdit()')
  assert.equal(online.h.run('editing.value'), false)
  assert.deepEqual(online.log.replaced, ['/pages/staff/online-jobs?s=1&requestId=5&storeId=9'])
  assert.match(sfc('pages/staff/merchant-request.vue').template.content, /<k-button v-if="detail\.canEdit"/)
})

// ---------------------------------------------------------------- 发布页文案、被退回的线上任务
test('发布招募：商家看到的是「已提交 → 袋鼠核实中 → 已上架」，别的角色还是平台审核；点提交不再弹确认框；提交后回首页看进度', () => {
  const d = sfc('pages/staff/jobs.vue')
  // R7（主人要求改版）：底部操作条不再写流程字，同样的话在入口屏的流程条和提交成功页，商家和别的角色照样分开说。
  // 2026-11-03 主人：简化——商家的进度条不提换工主理人；底栏已经写着「还差什么 / 可以提交」，点提交直接交，不再弹「确认提交？」
  assert.match(d.scriptSetup.content, /merchantStaff\.value \? \['已提交', '袋鼠核实中', '已上架'\] : \['填写信息', '平台审核', '通过后公示'\]/)
  assert.doesNotMatch(d.scriptSetup.content, /confirm\('提交(招募|审核)'/)
  assert.match(d.template.content, /\{\{ merchantStaff \? '提交' : '提交审核' \}\}/)
  assert.match(d.template.content, /submitted\.message \? '已提交' : '已提交，等平台审核'/)
  assert.match(d.scriptSetup.content, /const doneToList = \(\) => \{ if \(merchantStaff\.value\) return uni\.reLaunch\(\{ url: R\.staff \}\)/)
  assert.match(d.scriptSetup.content, /message: res\.data && res\.data\.message \}/)
})
function onlinePage(stubs) {
  const log = { toasts: [], alerts: [], launched: [], puts: [], created: [], backs: 0, confirms: [] }
  let onLoad = null
  const s = vue.ref(1)
  const h = runSetup('pages/staff/online-jobs.vue', {
    R, useScreen: (n, o) => { onLoad = o.onLoad; return s }, ensureSession: async () => {}, currentStaffStoreId: () => 9, onlineStaff: { value: false }, merchantStaff: { value: true },
    shiftDate: () => '2026-11-06', todayCn: () => '2026-10-30', toast: m => log.toasts.push(m), errText: (e, d) => (e && e.message) || d, back: () => { log.backs++ },
    confirm: async (t, m) => { log.confirms.push(m); return true }, alert: async (t, m) => { log.alerts.push([t, m]) },
    put: async (url, body, opts) => { log.puts.push(plain([url, body, opts])); return { data: { message: '已重新提交，本城换工主理人会尽快核实' } } },
    get: async () => ({ data: { config: { enabled: '0', amountFen: 0, version: 0 } } }),
    apiOnlineCreate: async (b) => { log.created.push(plain(b)); return { data: { jobId: 8, message: '已提交，本城换工主理人会尽快核实' } } },
    uni: { reLaunch: o => log.launched.push(o.url), previewImage() {} },
    ...stubs
  })
  h.run('agreementRef.value={confirm:async()=>true}')
  return { h, log, s, load: async (q) => { await onLoad(q); await flush() } }
}
const RETURNED_TASK = { requestId: 5, storeId: 9, requestType: 'online_task', title: '写一篇推文', canEdit: true, returnReason: '佣金不对', job: { jobStatus: 'draft', taskType: '内容写作', deliverables: '推文一篇', criteria: '原创', commissionFen: 12550, headcount: 2, content: '任务描述', requirement: '有账号\n会排版', estHours: '半天', deadlineTime: '2026-11-20 18:00:00' } }
test('线上任务：被退回的带上原来填的，改完 PUT 需求；不能改的不进表单', async (t) => {
  const { h, log, load } = onlinePage({ get: async () => ({ data: RETURNED_TASK }) })
  t.after(h.stop)
  await load({ s: '1', requestId: '5', storeId: '9' })
  const f = h.json('form.value')
  assert.equal(f.title, '写一篇推文')
  assert.equal(f.deliverables, '推文一篇')
  assert.equal(f.commissionFen, 12550)
  assert.equal(h.run('commissionText.value'), '125.5')
  assert.equal(f.quota, 2)
  assert.equal(f.deadline, '2026-11-20 18:00')
  assert.deepEqual(f.requirements, ['有账号', '会排版'])
  assert.equal(h.run('titles.value[0]'), '修改线上任务')
  assert.equal(h.run('resubmit.value.reason'), '佣金不对', '改的时候能看到退回原因')
  await h.run('publish()')
  assert.equal(log.created.length, 0)
  assert.equal(log.puts[0][0], '/app/staff/merchant/requests/5')
  assert.deepEqual(log.puts[0][2], { params: { storeId: '9' } })
  assert.equal(log.puts[0][1].deliverables, '推文一篇')
  assert.deepEqual(log.alerts, [['已重新提交', '已重新提交，本城换工主理人会尽快核实']])
  assert.deepEqual(log.launched, [R.staff])

  const locked = onlinePage({ get: async () => ({ data: { ...RETURNED_TASK, canEdit: false } }) })
  t.after(locked.h.stop)
  await locked.load({ s: '1', requestId: '5' })
  assert.equal(locked.log.toasts.pop(), '这条需求现在不能修改')
  assert.equal(locked.log.backs, 1)
  assert.equal(locked.h.run('resubmit.value'), null)
})
test('线上任务：商家新发提示走核实流程，提交后回首页；非商家还是平台审核', async (t) => {
  const { h, log, load } = onlinePage({})
  t.after(h.stop)
  await load({ s: '1' })
  h.run("Object.assign(form.value, { title: 't', deliverables: 'd', criteria: 'c', commissionFen: 500 })")
  // 2026-11-03 简化：提交不再弹「确认提交？」，流程一直写在表单最后（flowNote）；商家看到的是「袋鼠工作人员」，不提内部角色名
  assert.match(h.run('flowNote.value'), /袋鼠工作人员核实后上架/)
  await h.run('publish()')
  assert.deepEqual(log.confirms, [], '提交前不再弹确认框')
  assert.equal(log.created.length, 1)
  assert.equal(log.created[0].commissionFen, 300, '新任务固定每条 3 元')
  assert.deepEqual(log.alerts, [['已提交', '已提交，本城换工主理人会尽快核实']])
  assert.deepEqual(log.launched, [R.staff])

  const other = onlinePage({ merchantStaff: { value: false }, apiOnlineTask: async () => ({ data: {} }) })
  t.after(other.h.stop)
  other.h.run("Object.assign(form.value, { title: 't', deliverables: 'd', criteria: 'c', commissionFen: 500 })")
  assert.match(other.h.run('flowNote.value'), /平台审核上架/)
  await other.h.run('publish()')
  assert.deepEqual(other.log.confirms, [])
  assert.deepEqual(other.log.launched, [])
  assert.equal(other.log.toasts.pop(), '已提交，本城换工主理人会尽快核实')
})

// ---------------------------------------------------------------- 我的
test('我的：商家看到商家身份和体验反馈；只有商家身份的账号切身份直接回用户身份；员工不变', async (t) => {
  const d = sfc('pages/profile/index.vue')
  assert.match(d.template.content, /<text class="k-meta">\{\{ staffRoleLine \}\}<\/text>/)
  assert.match(d.template.content, /<view v-if="merchantStaff" @click="go\(R\.support\)"><text>体验反馈<\/text>/)
  assert.match(d.template.content, /onlyMerchant \? '切换到用户身份' : '切换身份'/)
  assert.match(d.template.content, /onlyMerchant \? '商家工作台' : '员工工作台'/)
  assert.match(d.scriptSetup.content, /if \(staffMode\.value && onlyMerchant\.value\) return relaunch\(switchMode\('user'\)\)/)
  assert.match(d.scriptSetup.content, /if \(staffMode\.value\) return go\(R\.identity \+ '\?choose=1'\)/)
})

// ---------------------------------------------------------------- 分包、白名单
test('新页在 staff 分包；main.js 白名单同步；主包 api.js 和路由表没加东西', () => {
  const pages = JSON.parse(read('pages.json').replace(/^﻿/, ''))
  assert.ok(pages.subPackages.find(p => p.root === 'pages/staff').pages.some(p => p.path === 'merchant-request'))
  const main = read('main.js')
  const merchant = /role === 'merchant' && !\[([^\]]+)\]/.exec(main)[1]
  for (const route of ['index', 'business', 'merchant-request', 'jobs', 'online-jobs', 'applications', 'interviews']) assert.ok(merchant.includes(`'pages/staff/${route}'`), route)
  const service = /role === 'merchant_service' && !\[([^\]]+)\]/.exec(main)[1]
  for (const route of ['index', 'business', 'service', 'online-jobs', 'applications']) assert.ok(service.includes(`'pages/staff/${route}'`), route)
  const city = /role === 'city_lead' && !\[([^\]]+)\]/.exec(main)[1]
  assert.deepEqual(city.split(',').map(x => x.trim()).sort(), ["'pages/manage/honor'", "'pages/manage/wallet'", "'pages/staff/business'", "'pages/staff/city'", "'pages/staff/city-finance'", "'pages/staff/index'"])
  assert.ok(!read('common/api.js').includes('merchant/requests'))
  assert.ok(!read('common/routes.js').includes('merchant-request'))
  const home = sfc('pages/staff/components/k-merchant-work.vue').scriptSetup.content
  assert.match(home, /from '\.\.\/merchant-request-logic\.js'/)
  // 不能和页面同名：pages/staff/merchant-request.js 是页面编译产物，同名会被打到包根目录、算进主包
  assert.ok(!fs.existsSync(path.join(APP, 'pages/staff/merchant-request.js')))
  assert.ok(!/@\/common\/api\.js/.test(home), '首页直接用 common/request.js')
})
