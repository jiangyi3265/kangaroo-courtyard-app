// 2026-10-31 R12 采购报销小程序页的回归（node --test，不构建、不发请求）。主人原话：「后台增设一个报销按钮（自营院子里的东西采购报销，没写到表格的不报销）」。
// 守住这几件事：
//   · 工作台入口只给小院主理人，且 /access 说可以才出；别的角色不问 /access（问了会 403，还会多核对一次授权）；问不到不出、不拖慢工作台；
//   · 通知的 route 是服务端写死的 /pages/staff/reimburse?id=&storeId=，这个地址要打开详情；
//   · 按钮听服务端的 canEdit、canWithdraw；金额全程是字符串，页面不转数字；
//   · 连点只进一笔；响应丢了重试时服务端回 409「不用再交」当成功；别的失败留住填的内容；
//   · 填写屏不出浮动客服钮（主线定的），小院主理人是员工，操作条也没有客服钮；
//   · 分包里，不进主包的 api.js、routes.js；前端校验的上限和服务端一个数。
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { createRequire } from 'node:module'
import test from 'node:test'
import assert from 'node:assert/strict'
import { pendingStaffScope } from '../common/staff-scope.js'

const APP = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const require = createRequire(path.join(APP, 'package.json'))
const compiler = require('@vue/compiler-sfc'), vue = require('vue')
const src = (rel) => fs.readFileSync(path.join(APP, rel), 'utf8').replace(/\r\n/g, '\n')
const sfc = (rel) => compiler.parse(src(rel), { filename: rel }).descriptor
const L = await import(pathToFileURL(path.join(APP, 'pages/staff/reimburse-logic.js')).href)
const plain = (x) => (x === undefined ? undefined : JSON.parse(JSON.stringify(x)))
const flush = async () => { for (let i = 0; i < 12; i++) await new Promise(resolve => setImmediate(resolve)) }
const PAGE = 'pages/staff/reimburse.vue'
const TODAY = '2026-11-01'

/** 在沙箱里跑页面的 script setup：导入一律先给永远不返回的函数，再用 stubs 覆盖用得到的那几个 */
function runSetup(rel, stubs) {
  const d = sfc(rel)
  const source = d.scriptSetup.content
  const ast = compiler.babelParse(source, { sourceType: 'module' })
  const body = ast.program.body.filter(n => n.type !== 'ImportDeclaration').map(n => source.slice(n.start, n.end)).join('\n')
  const sandbox = { console, setTimeout, clearTimeout }
  for (const n of ast.program.body.filter(n => n.type === 'ImportDeclaration')) for (const s of n.specifiers) sandbox[s.local.name] = () => new Promise(() => {})
  const noop = () => {}
  Object.assign(sandbox, { pendingStaffScope, ref: vue.ref, computed: vue.computed, watch: vue.watch, reactive: vue.reactive, onShow: noop, onHide: noop, onUnload: noop, onUnmounted: noop, onLoad: noop, onReachBottom: noop, onPullDownRefresh: noop, onMounted: noop, onBeforeUnmount: noop, getCurrentPages: () => [{}, {}] }, stubs)
  vm.createContext(sandbox)
  const scope = vue.effectScope()
  scope.run(() => vm.runInContext(body, sandbox, { filename: rel + ':script-setup' }))
  return { run: code => vm.runInContext(code, sandbox), json: code => plain(vm.runInContext(code, sandbox)), stop: () => scope.stop(), template: d.template.content, sandbox }
}

const apiError = (message, code) => Object.assign(new Error(message), { code })
const ROW = (over = {}) => ({ reimburseId: 12, storeId: 3, storeName: '平潭袋鼠小院', submitterName: '小杨', itemName: '床单', quantity: 2, amount: '128.50', purchaseDate: '2026-10-30', receipts: ['/profile/upload/a.png'], remark: '', status: 'pending', statusText: '待审核', rejectReason: '', revision: 1, submitTime: '2026-10-31 10:00:00', auditTime: '', paidTime: '', isMine: true, canEdit: false, canWithdraw: true, ...over })

/** 报销页：hooks 收 onLoad / onShow 等，log 记所有请求和动作；answers 决定接口回什么（函数或值，抛错就是失败） */
function openPage(query, { answers = {}, role = 'keeper', confirmAnswer = true, chosen = [], pagesDeep = 2, manyStores = false } = {}) {
  const log = { get: [], post: [], put: [], del: [], gone: [], replaced: [], backs: 0, toasts: [], alerts: [], confirms: [], loads: 0, scrolled: [] }
  const hooks = {}
  const reply = (key, args) => {
    const a = answers[key]
    const v = typeof a === 'function' ? a(...args) : a
    return Promise.resolve(v)
  }
  const h = runSetup(PAGE, {
    ...L,
    onLoad: (fn) => { hooks.load = fn }, onShow: (fn) => { hooks.show = fn }, onHide: (fn) => { hooks.hide = fn }, onUnload: (fn) => { hooks.unload = fn }, onReachBottom: (fn) => { hooks.bottom = fn }, onPullDownRefresh: (fn) => { hooks.pull = fn },
    getCurrentPages: () => Array.from({ length: pagesDeep }, () => ({})),
    ensureSession: async () => {},
    currentStaffStore: { value: { roleCode: role, storeId: 3 } },
    staffStores: { value: manyStores ? [{ roleCode: 'keeper', storeId: 3 }, { roleCode: 'keeper', storeId: 4 }] : [{ roleCode: 'keeper', storeId: 3 }] },
    todayCn: () => TODAY,
    absUrl: x => 'https://x' + x,
    errText: (e, d) => (e && e.message) || d,
    get: (url, params) => { log.get.push([url, plain(params)]); return reply('get', [url, params]) },
    post: (url, body, opts) => { log.post.push([url, plain(body), plain(opts)]); return reply('post', [url, body, opts]) },
    put: (url, body) => { log.put.push([url, plain(body)]); return reply('put', [url, body]) },
    del: (url) => { log.del.push(url); return reply('del', [url]) },
    go: (u) => log.gone.push(u),
    replace: (u) => log.replaced.push(u),
    back: () => { log.backs++ },
    toast: (t) => log.toasts.push(t),
    alert: async (title, content) => { log.alerts.push([title, content]) },
    confirm: async (title, content) => { log.confirms.push([title, content]); return confirmAnswer },
    chooseImages: async (n) => { log.chooseN = n; return chosen },
    uploadTo: (url, p) => { log.uploaded = (log.uploaded || []).concat(p); if (p.startsWith('bad')) throw apiError('上传失败', 500); return Promise.resolve({ data: { url: '/profile/upload/' + p } }) },
    uni: { showLoading() {}, hideLoading() {}, stopPullDownRefresh() { log.pullStopped = true }, previewImage(o) { log.preview = plain(o) }, getSystemInfoSync: () => ({ statusBarHeight: 44 }), pageScrollTo(o) { log.scrolled.push(o.selector) } }
  })
  return { ...h, log, hooks, start: async () => { hooks.load(query); await flush(); if (hooks.show) await hooks.show(); await flush() } }
}
const listAnswer = (over = {}) => ({ data: { store: { storeId: 3, storeName: '平潭袋鼠小院', canSubmit: true }, rows: [ROW()], total: 1, hasMore: false, pageNum: 1, counts: { pending: 1, approved: 0, rejected: 0, paid: 0 }, ...over } })
const fill = (p, over = {}) => p.run(`Object.assign(form, ${JSON.stringify({ itemName: '床单', quantity: '2', amount: '128.5', purchaseDate: '2026-10-30', receipts: ['/profile/upload/a.png'], remark: ' 买给二楼 ', ...over })})`)

// ---------------------------------------------------------------- 地址

test('地址：一页三用，通知的地址打开详情；编号不转数字', () => {
  assert.deepEqual(L.pageOf({ id: '12', storeId: '3' }), { mode: 'detail', id: '12' })
  assert.deepEqual(L.pageOf({ id: '12', edit: '1' }), { mode: 'form', id: '12' })
  assert.deepEqual(L.pageOf({ create: '1', storeId: '3' }), { mode: 'form', id: null })
  assert.deepEqual(L.pageOf({ storeId: '3' }), { mode: 'list', id: null })
  assert.deepEqual(L.pageOf(undefined), { mode: 'list', id: null })
  assert.deepEqual(L.pageOf({ id: 'abc' }), { mode: 'list', id: null }, '乱写的编号不请求')
  assert.deepEqual(L.pageOf({ id: '0' }), { mode: 'list', id: null })
  assert.equal(L.pageOf({ id: '9007199254740993' }).id, '9007199254740993', '大编号不丢精度')
  assert.equal(L.listUrl(3), '/pages/staff/reimburse?storeId=3')
  assert.equal(L.listUrl(null), '/pages/staff/reimburse')
  assert.equal(L.createUrl(3), '/pages/staff/reimburse?create=1&storeId=3')
  assert.equal(L.detailUrl(12, 3), '/pages/staff/reimburse?id=12&storeId=3')
  assert.equal(L.editUrl(12, 3), '/pages/staff/reimburse?id=12&edit=1&storeId=3')
})

test('通知的 route 和这一页对得上；接口前缀和服务端一致', () => {
  const java = src('../RuoYi-Vue/ruoyi-kangaroo/src/main/java/com/ruoyi/kangaroo/ext/stay/KgReimburseService.java')
  assert.match(java, /return "\/pages\/staff\/reimburse\?id=" \+ id \+ "&storeId=" \+ storeId;/)
  assert.equal(L.detailUrl(12, 3), '/pages/staff/reimburse?id=12&storeId=3', '服务端拼出来的就是这个地址')
  assert.match(src('../RuoYi-Vue/ruoyi-kangaroo/src/main/java/com/ruoyi/kangaroo/controller/app/AppStaffReimburseController.java'), /@RequestMapping\("\/app\/staff\/reimbursements"\)/)
  assert.equal(L.REIMBURSE_API, '/app/staff/reimbursements')
})

test('前端校验的上限和服务端一个数（谁改了都要红）', () => {
  const java = src('../RuoYi-Vue/ruoyi-kangaroo/src/main/java/com/ruoyi/kangaroo/ext/stay/KgReimburseService.java')
  const num = (name) => Number(new RegExp('static final int ' + name + ' = (\\d+);').exec(java)[1])
  assert.equal(L.ITEM_MAX, num('ITEM_MAX'))
  assert.equal(L.QUANTITY_MAX, num('QUANTITY_MAX'))
  assert.equal(L.MAX_RECEIPTS, num('RECEIPTS_MAX'))
  assert.equal(L.REMARK_MAX, num('REMARK_MAX'))
  assert.match(java, /AMOUNT_MAX = new BigDecimal\("100000"\)/)
  assert.match(java, /DATE_MIN = LocalDate\.of\(2000, 1, 1\)/)
  assert.equal(L.MIN_DATE, '2000-01-01')
})

// ---------------------------------------------------------------- 校验

test('金额：字符串比，不转浮点；边界和服务端一样', () => {
  const cases = {
    '': '请填写金额', '  ': '请填写金额',
    abc: '金额要是数字，最多两位小数', '1e5': '金额要是数字，最多两位小数', '１２': '金额要是数字，最多两位小数', '.5': '金额要是数字，最多两位小数', '5.': '金额要是数字，最多两位小数', '-1': '金额要是数字，最多两位小数', '1,000': '金额要是数字，最多两位小数',
    '12.345': '金额最多两位小数', '0.001': '金额最多两位小数',
    0: '金额要大于 0', '0.00': '金额要大于 0', '000': '金额要大于 0',
    '100000.01': '金额不能超过 100000 元', 100001: '金额不能超过 100000 元', 999999: '金额不能超过 100000 元', 1000000: '金额不能超过 100000 元', '99999999999999999999': '金额不能超过 100000 元'
  }
  for (const [v, want] of Object.entries(cases)) assert.equal(L.amountProblem(v), want, v)
  for (const v of ['0.01', '1', '128.5', '128.50', '0000012.5', '99999.99', '100000', '100000.00', ' 12 ']) assert.equal(L.amountProblem(v), '', v)
})

test('数量、品名、日期、凭证、备注', () => {
  assert.equal(L.quantityProblem(''), '请填写数量')
  for (const v of ['0', '-1', '1.5', 'a', '1234567890']) assert.equal(L.quantityProblem(v), '数量要是正整数', v)
  assert.equal(L.quantityProblem('1000000'), '数量不能超过 999999')
  for (const v of ['1', ' 2 ', '999999']) assert.equal(L.quantityProblem(v), '', v)

  for (const v of ['', '   ', '​', '　', '️']) assert.equal(L.itemProblem(v), '请填写品名（1–60 字）', JSON.stringify(v))
  assert.equal(L.itemProblem('床'.repeat(60)), '')
  assert.equal(L.itemProblem('床'.repeat(61)), '请填写品名（1–60 字）')
  assert.equal(L.itemProblem('😀'.repeat(60)), '', '表情按一个字算，和服务端一样')

  assert.equal(L.dateProblem('', TODAY), '请选择购买日期')
  assert.equal(L.dateProblem('2026/11/01', TODAY), '购买日期不对，请重新选择')
  assert.equal(L.dateProblem('1999-12-31', TODAY), '购买日期不对，请重新选择')
  assert.equal(L.dateProblem('2026-11-02', TODAY), '购买日期不能晚于今天')
  assert.equal(L.dateProblem(TODAY, TODAY), '')
  assert.equal(L.dateProblem('2000-01-01', TODAY), '')

  assert.equal(L.receiptsProblem([]), '请至少上传 1 张凭证照片')
  assert.equal(L.receiptsProblem(null), '请至少上传 1 张凭证照片')
  assert.equal(L.receiptsProblem(['a']), '')
  assert.equal(L.receiptsProblem(Array(9).fill('a')), '')
  assert.equal(L.receiptsProblem(Array(10).fill('a')), '凭证照片最多 9 张')

  assert.equal(L.remarkProblem('字'.repeat(200)), '')
  assert.equal(L.remarkProblem('字'.repeat(201)), '备注最多 200 字')
})

test('表单：错误按页面顺序；提交的 body 金额是字符串；带回驳回那一笔', () => {
  const blank = L.formErrors(L.newForm(), TODAY)
  assert.deepEqual(Object.keys(blank), ['itemName', 'quantity', 'amount', 'purchaseDate', 'receipts'], '备注选填；数量不预填，免得点进去接着打成 12')
  assert.equal(L.newForm().quantity, '')
  assert.deepEqual(L.FIELD_ORDER, ['itemName', 'quantity', 'amount', 'purchaseDate', 'receipts', 'remark'])
  const good = { itemName: ' 床单 ', quantity: '2', amount: '128.5', purchaseDate: '2026-10-30', receipts: ['/a.png'], remark: ' 备注 ' }
  assert.deepEqual(L.formErrors(good, TODAY), {})
  const body = L.payloadOf(good)
  assert.deepEqual(body, { itemName: '床单', quantity: '2', amount: '128.5', purchaseDate: '2026-10-30', receipts: ['/a.png'], remark: '备注' })
  assert.equal(typeof body.amount, 'string')
  body.receipts.push('x')
  assert.equal(good.receipts.length, 1, '不共用数组')

  const row = ROW({ status: 'rejected', remark: '备注', receipts: ['/a.png', '/b.png'] })
  const back = L.formFromRow(row)
  assert.deepEqual(back, { itemName: '床单', quantity: '2', amount: '128.50', purchaseDate: '2026-10-30', receipts: ['/a.png', '/b.png'], remark: '备注' })
  back.receipts.pop()
  assert.equal(row.receipts.length, 2, '改表单不动原来那一行')
})

test('状态：四种四个色调；详情一句话；页签条数；同事交的写名字', () => {
  assert.equal(new Set(['pending', 'approved', 'rejected', 'paid'].map(L.statusTone)).size, 4)
  assert.deepEqual(L.STATUS_TABS.map(t => t.value), ['', 'pending', 'approved', 'rejected', 'paid'])
  assert.deepEqual(L.STATUS_TABS.map(t => t.label), ['全部', '待审核', '已通过', '已驳回', '已打款'])
  assert.deepEqual(L.tabsOf({ pending: 2, approved: 1, rejected: 3, paid: 4 }).map(t => t.count), [10, 2, 1, 3, 4])
  assert.deepEqual(L.tabsOf(null).map(t => t.count), [0, 0, 0, 0, 0])
  assert.equal(L.statusHint({ status: 'pending' }), '已提交，等平台审核')
  assert.equal(L.statusHint({ status: 'approved' }), '已通过，等平台打款')
  assert.equal(L.statusHint({ status: 'rejected', canEdit: true }), '改好后可以再交一次')
  assert.equal(L.statusHint({ status: 'rejected', canEdit: false }), '平台已驳回', '同事的、门店改了非直营的：不说能再交')
  assert.equal(L.statusHint({ status: 'paid' }), '平台已标记打款，请留意收款')
  assert.equal(L.submitterText({ isMine: false, submitterName: '小杨' }), '小杨 提交')
  assert.equal(L.submitterText({ isMine: true, submitterName: '小杨' }), '')
  assert.equal(L.cnDate('2026-10-03'), '2026年10月3日')
  assert.equal(L.cnTime('2026-10-31 10:05:00'), '2026年10月31日 10:05')
  assert.equal(L.cnTime(''), '')
  assert.equal(L.alreadySubmitted(apiError('这一笔已经提交过了，不用再交', 409)), true)
  assert.equal(L.alreadySubmitted(apiError('账号已注销或不可用', 409)), false)
  assert.equal(L.alreadySubmitted(apiError('这一笔已经提交过了，不用再交', 500)), false)
  assert.deepEqual(L.mergeRows([{ reimburseId: 1 }, { reimburseId: 2 }], [{ reimburseId: 2 }, { reimburseId: 3 }]).map(r => r.reimburseId), [1, 2, 3])
})

// ---------------------------------------------------------------- 工作台入口

function workbench(role, { visible = true, never = false } = {}) {
  const log = { gone: [], asked: [] }
  let shown = null
  const store = vue.ref({ roleCode: role, storeId: 102, storeName: '海边小院', roleName: '角色' })
  const h = runSetup('pages/staff/index.vue', {
    useScreen: () => vue.ref(1), onShow: (fn) => { shown = fn },
    onlineStaff: { value: false }, merchantStaff: { value: false }, merchantService: { value: false }, cityLead: { value: false },
    experience: { account: { staffGrants: [] } }, ensureSession: async () => {}, hasStaffAccess: { value: true }, checkStaffTaskReminder() {},
    currentStaffStore: store, currentAlsoService: vue.computed(() => false), staffStoreUrl: (u, id = 102) => u + '?storeId=' + id, getSessionRevision: () => 1,
    staffCan: () => true, staffTaskTodoCount: { value: 0 }, go: (u) => log.gone.push(u), toast() {}, absUrl: x => x,
    apiWorkbenchHome: async () => ({ data: { counts: {}, total: 0 } }), apiWorkbenchTodos: async () => ({ data: { groups: [], counts: {}, overdue: 0 } }), apiStaffHub: async () => ({ data: {} }),
    get: async () => ({ data: {} }),
    listUrl: L.listUrl, reimburseListUrl: L.listUrl,
    reimburseVisible: (get, id) => { log.asked.push(id); return never ? new Promise(() => {}) : Promise.resolve(visible) }
  })
  return { ...h, log, store, show: async () => { await shown(); await flush() } }
}

test('工作台入口：小院主理人且 /access 说可以才出，点了带门店进报销页', async (t) => {
  const yes = workbench('keeper')
  t.after(yes.stop)
  assert.equal(yes.run('reimburseEntry.value'), false, '问之前不出')
  await yes.show()
  assert.deepEqual(yes.log.asked, [102])
  assert.equal(yes.run('reimburseEntry.value'), true)
  yes.run('openReimburse()')
  assert.deepEqual(yes.log.gone, ['/pages/staff/reimburse?storeId=102'])

  const no = workbench('keeper', { visible: false })
  t.after(no.stop)
  await no.show()
  assert.equal(no.run('reimburseEntry.value'), false, '非直营、没有老记录')
})

for (const role of ['manager', 'staff']) {
  test(`工作台入口：${role} 不出，也不问 /access（问了会 403）`, async (t) => {
    const w = workbench(role)
    t.after(w.stop)
    await w.show()
    assert.deepEqual(w.log.asked, [])
    assert.equal(w.run('reimburseEntry.value'), false)
  })
}

test('工作台入口：/access 卡住不拖慢工作台；换门店先收起再重新问；旧门店的回答作废', async (t) => {
  const w = workbench('keeper', { never: true })
  t.after(w.stop)
  await Promise.race([w.show(), new Promise((resolve, reject) => setTimeout(() => reject(new Error('工作台被 /access 卡住了')), 500))])
  assert.equal(w.run('reimburseEntry.value'), false)

  const s = workbench('keeper')
  t.after(s.stop)
  await s.show()
  assert.equal(s.run('reimburseEntry.value'), true)
  s.store.value = { roleCode: 'keeper', storeId: 103, storeName: '别家', roleName: '角色' }
  await flush()
  assert.equal(s.run('reimburseEntry.value'), false, '换了门店，上一家的结论不算')
  await s.show()
  assert.deepEqual(s.log.asked, [102, 103])
  assert.equal(s.run('reimburseEntry.value'), true)
  // 换到不是小院主理人的门店：不问
  s.store.value = { roleCode: 'manager', storeId: 104, storeName: '第三家', roleName: '角色' }
  await flush()
  await s.show()
  assert.deepEqual(s.log.asked, [102, 103])
  assert.equal(s.run('reimburseEntry.value'), false)

  const logic = await L.reimburseVisible(async (url, params) => { assert.equal(url, '/app/staff/reimbursements/access'); assert.deepEqual(params, { storeId: 7 }); return { data: { visible: true, canSubmit: false } } }, 7)
  assert.equal(logic, true, '门店改成非直营但有老记录：入口还在')
  assert.equal(await L.reimburseVisible(async () => { throw new Error('断网') }, 7), false)
  assert.equal(await L.reimburseVisible(async () => ({ data: { visible: false, canSubmit: false } }), 7), false)
})

test('工作台模板：入口写在快捷入口和发布区之间，能点的 view 带 hover-class；不进 quick，老断言钉的四格不变', () => {
  const d = sfc('pages/staff/index.vue')
  const t = d.template.content
  assert.match(t, /<view v-if="\(isKeeper \|\| cityLeadDaily\) && reimburseEntry" class="admin-task-entry" hover-class="k-press" @click="openReimburse">/)
  assert.ok(t.indexOf('class="k-grid-4 quick"') < t.indexOf('reimburseEntry') && t.indexOf('reimburseEntry') < t.indexOf('<template v-if="canPublish && publishEntries.length">'))
  assert.doesNotMatch(d.scriptSetup.content, /label: '采购报销'/, '不加进 quick（luna-staff 钉着四格）')
  assert.match(d.scriptSetup.content, /from '\.\/reimburse-logic\.js'/)
})

// ---------------------------------------------------------------- 列表

test('列表：带门店取；表头、页签、行都用服务端给的；金额原样显示', async (t) => {
  const p = openPage({ storeId: '3' }, { answers: { get: listAnswer() } })
  t.after(p.stop)
  await p.start()
  assert.deepEqual(p.log.get, [[L.REIMBURSE_API, { storeId: '3', status: '', page: 1 }]])
  assert.equal(p.run('mode.value'), 'list')
  assert.equal(p.json('store.value').storeName, '平潭袋鼠小院')
  assert.deepEqual(p.json('tabs.value.map(t => t.count)'), [1, 1, 0, 0, 0])
  assert.equal(p.json('rows.value')[0].amount, '128.50')
  p.run('openRow(rows.value[0])')
  assert.deepEqual(p.log.gone, ['/pages/staff/reimburse?id=12&storeId=3'])
  p.run('openCreate()')
  assert.equal(p.log.gone[1], '/pages/staff/reimburse?create=1&storeId=3')
})

test('列表：没带门店时用当前门店；当前门店不是小院主理人身份就不传，服务端取第一家', async (t) => {
  const k = openPage({}, { answers: { get: listAnswer() } })
  t.after(k.stop)
  await k.start()
  assert.equal(k.log.get[0][1].storeId, 3)
  const m = openPage({}, { role: 'manager', answers: { get: listAnswer({ store: { storeId: 9, storeName: '第一家', canSubmit: true } }) } })
  t.after(m.stop)
  await m.start()
  assert.equal(m.log.get[0][1].storeId, null)
  assert.equal(m.run('storeId.value'), 9, '后面的请求用服务端说的那家')
})

test('列表：翻页去重；回来时翻过几页就取几页，已经滑到的位置不跳；换页签回第一页', async (t) => {
  const pages = { 1: [ROW({ reimburseId: 1 }), ROW({ reimburseId: 2 })], 2: [ROW({ reimburseId: 2 }), ROW({ reimburseId: 3 })] }
  const p = openPage({ storeId: '3' }, { answers: { get: (url, q) => listAnswer({ rows: pages[q.page], hasMore: q.page < 2 }) } })
  t.after(p.stop)
  await p.start()
  assert.equal(p.json('rows.value').length, 2)
  assert.equal(p.run('hasMore.value'), true)
  p.hooks.bottom()
  await flush()
  assert.deepEqual(p.json('rows.value.map(r => r.reimburseId)'), [1, 2, 3])
  assert.equal(p.run('hasMore.value'), false)
  p.log.get.length = 0
  await p.hooks.show()
  await flush()
  assert.deepEqual(p.log.get.map(g => g[1].page), [1, 2], '回到这一页：两页都重新取')
  assert.deepEqual(p.json('rows.value.map(r => r.reimburseId)'), [1, 2, 3])
  p.log.get.length = 0
  p.run("pickStatus('rejected')")
  assert.deepEqual(p.json('rows.value'), [], '上一个页签的行先收起来')
  assert.equal(p.run('listStateText.value'), '正在读取…')
  await flush()
  assert.deepEqual(p.log.get, [[L.REIMBURSE_API, { storeId: 3, status: 'rejected', page: 1 }]])
  assert.equal(p.json('rows.value').length, 2)
})

test('列表：晚到的旧页签结果不覆盖新页签', async (t) => {
  let release
  const slow = new Promise(resolve => { release = resolve })
  const p = openPage({ storeId: '3' }, { answers: { get: (url, q) => (q.status === 'paid' ? slow : listAnswer({ rows: [ROW({ reimburseId: 9, status: q.status })] })) } })
  t.after(p.stop)
  await p.start()
  p.run("pickStatus('paid')")
  p.run("pickStatus('rejected')")
  await flush()
  release(listAnswer({ rows: [ROW({ reimburseId: 7 })] }))
  await flush()
  assert.deepEqual(p.json('rows.value.map(r => r.reimburseId)'), [9])
})

test('列表：读失败写原因和重新加载；没权限不放重新加载、不出页签；刷新失败不清空', async (t) => {
  const net = openPage({ storeId: '3' }, { answers: { get: () => { throw apiError('网络连接失败，请检查网络后重试', -1) } } })
  t.after(net.stop)
  await net.start()
  assert.equal(net.run('listStateText.value'), '网络连接失败，请检查网络后重试')
  assert.equal(net.run('listRetry.value'), true)

  const denied = openPage({ storeId: '3' }, { answers: { get: () => { throw apiError('只有这家店的小院主理人可以使用采购报销（当前角色：换工主理人）', 403) } } })
  t.after(denied.stop)
  await denied.start()
  assert.match(denied.run('listStateText.value'), /只有这家店的小院主理人/)
  assert.equal(denied.run('listRetry.value'), false)
  assert.equal(denied.run('store.value'), null, '模板 v-if="store"：不出页签')

  let fail = false
  const again = openPage({ storeId: '3' }, { answers: { get: () => { if (fail) throw apiError('断网', -1); return listAnswer() } } })
  t.after(again.stop)
  await again.start()
  fail = true
  await again.hooks.show()
  await flush()
  assert.equal(again.json('rows.value').length, 1)
  assert.deepEqual(again.log.toasts, ['断网'])
})

// ---------------------------------------------------------------- 详情

test('详情：通知的地址直接打开；按钮只看服务端的 canEdit、canWithdraw（模板）', async (t) => {
  const p = openPage({ id: '12', storeId: '3' }, { answers: { get: { data: ROW({ status: 'rejected', statusText: '已驳回', rejectReason: '小票看不清', canEdit: true, canWithdraw: false }) } } })
  t.after(p.stop)
  await p.start()
  assert.equal(p.run('mode.value'), 'detail')
  assert.deepEqual(p.log.get, [[L.REIMBURSE_API + '/12', undefined]])
  p.run('openEdit()')
  assert.deepEqual(p.log.gone, ['/pages/staff/reimburse?id=12&edit=1&storeId=3'])
  p.run("preview(row.value.receipts, 0)")
  assert.deepEqual(p.log.preview, { current: 0, urls: ['https://x/profile/upload/a.png'] })
  const t2 = p.template
  assert.match(t2, /<view v-if="row\.canEdit" class="fc-btn" hover-class="k-press-s" @click="openEdit">/)
  assert.match(t2, /<view v-if="row\.canWithdraw" class="fc-btn rb-btn--danger" hover-class="k-press-s" @click="withdraw">/)
  assert.match(t2, /<view v-if="row\.canEdit \|\| row\.canWithdraw" class="fc-bar">/)
  assert.match(t2, /驳回理由：\{\{ row\.rejectReason \}\}/)
})

test('撤回：先问；取消不发请求；成功回上一页；没有上一页回报销表；服务端说不行就写原话再按最新状态显示', async (t) => {
  const no = openPage({ id: '12', storeId: '3' }, { confirmAnswer: false, answers: { get: { data: ROW() } } })
  t.after(no.stop)
  await no.start()
  await no.run('withdraw()')
  assert.deepEqual(no.log.del, [])

  const yes = openPage({ id: '12', storeId: '3' }, { answers: { get: { data: ROW() }, del: { msg: '已撤回' } } })
  t.after(yes.stop)
  await yes.start()
  await yes.run('withdraw()')
  assert.deepEqual(yes.log.del, [L.REIMBURSE_API + '/12'])
  assert.deepEqual(yes.log.toasts, ['已撤回'])
  assert.equal(yes.log.backs, 1)

  const alone = openPage({ id: '12', storeId: '3' }, { pagesDeep: 1, answers: { get: { data: ROW() }, del: { msg: '已撤回' } } })
  t.after(alone.stop)
  await alone.start()
  await alone.run('withdraw()')
  assert.deepEqual(alone.log.replaced, ['/pages/staff/reimburse?storeId=3'], '没有上一页不退回首页')

  const late = openPage({ id: '12', storeId: '3' }, { answers: { get: { data: ROW() }, del: () => { throw apiError('只有待审核的报销可以撤回', 409) } } })
  t.after(late.stop)
  await late.start()
  const before = late.log.get.length
  await late.run('withdraw()')
  await flush()
  assert.deepEqual(late.log.alerts, [['撤回失败', '只有待审核的报销可以撤回']])
  assert.equal(late.log.backs, 0)
  assert.equal(late.log.get.length, before + 1, '重新取了一次')

  const off = openPage({ id: '12', storeId: '3' }, { answers: { get: { data: ROW({ canWithdraw: false }) } } })
  t.after(off.stop)
  await off.start()
  await off.run('withdraw()')
  assert.deepEqual(off.log.del, [], '服务端说不能撤就不发')
})

test('详情：撤回过的（404）写原话，不放重新加载', async (t) => {
  const p = openPage({ id: '12', storeId: '3' }, { answers: { get: () => { throw apiError('报销不存在或已撤回', 404) } } })
  t.after(p.stop)
  await p.start()
  assert.equal(p.run('detailError.value'), '报销不存在或已撤回')
  assert.equal(p.run('detailRetry.value'), false)
})

// ---------------------------------------------------------------- 填写

test('提交：点过一次才标红；没填全不发请求，滚到第一个错；填好了字符串金额带门店发出去，成功回上一页', async (t) => {
  const p = openPage({ create: '1', storeId: '3' }, { answers: { get: { data: { storeId: 3, storeName: '平潭袋鼠小院', canSubmit: true, visible: true } }, post: { msg: '已提交，等平台审核', data: ROW() } } })
  t.after(p.stop)
  await p.start()
  assert.equal(p.run('mode.value'), 'form')
  assert.deepEqual(p.json('errs.value'), {}, '还没点提交不标红')
  await p.run('submit()')
  assert.deepEqual(p.log.post, [])
  assert.equal(p.run('errCount.value'), 5)
  assert.deepEqual(p.log.scrolled, ['#rb-itemName'])
  assert.deepEqual(p.log.toasts, ['请填写品名（1–60 字）'])
  fill(p)
  await p.run('submit()')
  assert.deepEqual(p.log.post, [[L.REIMBURSE_API, { itemName: '床单', quantity: '2', amount: '128.5', purchaseDate: '2026-10-30', receipts: ['/profile/upload/a.png'], remark: '买给二楼' }, { params: { storeId: 3 } }]])
  assert.equal(typeof p.log.post[0][1].amount, 'string')
  assert.equal(p.log.toasts.at(-1), '已提交，等平台审核')
  assert.equal(p.log.backs, 1)
  assert.equal(p.run('submitting.value'), false)
})

test('提交：连点只发一次；照片没传完不让交', async (t) => {
  let release
  const p = openPage({ create: '1', storeId: '3' }, { answers: { get: { data: { canSubmit: true } }, post: () => new Promise(resolve => { release = resolve }) } })
  t.after(p.stop)
  await p.start()
  fill(p)
  p.run('submit()')
  p.run('submit()')
  await flush()
  assert.equal(p.log.post.length, 1)
  assert.equal(p.run('submitLabel.value'), '提交中…')
  release({ msg: '已提交，等平台审核' })
  await flush()
  assert.equal(p.log.backs, 1)

  const u = openPage({ create: '1', storeId: '3' }, { answers: { get: { data: { canSubmit: true } } } })
  t.after(u.stop)
  await u.start()
  fill(u)
  u.run('uploading.value = true')
  await u.run('submit()')
  assert.deepEqual(u.log.post, [])
  assert.deepEqual(u.log.toasts, ['照片还在上传，请稍候'])
})

test('提交失败：响应丢了内容留着，再点服务端说不用再交就当成功；别的失败写原话不离开', async (t) => {
  let tries = 0
  const p = openPage({ create: '1', storeId: '3' }, { answers: { get: { data: { canSubmit: true } }, post: () => { tries++; throw tries === 1 ? apiError('网络连接失败，请检查网络后重试', -1) : apiError('这一笔已经提交过了，不用再交', 409) } } })
  t.after(p.stop)
  await p.start()
  fill(p)
  await p.run('submit()')
  assert.deepEqual(p.log.alerts, [['提交失败', '网络连接失败，请检查网络后重试']])
  assert.equal(p.log.backs, 0)
  assert.equal(p.run('form.itemName'), '床单', '填的内容还在')
  assert.equal(p.run('submitting.value'), false, '能再点')
  await p.run('submit()')
  assert.equal(p.log.backs, 1)
  assert.equal(p.log.toasts.at(-1), '这一笔已经提交过了，不用再交')
  assert.equal(p.log.alerts.length, 1)

  for (const [code, msg] of [[403, '只有直营小院可以提交采购报销'], [422, '凭证照片不存在或无法读取，请重新上传'], [429, '提交太频繁了，一小时最多 20 条，请稍后再试'], [409, '账号已注销或不可用']]) {
    const q = openPage({ create: '1', storeId: '3' }, { answers: { get: { data: { canSubmit: true } }, post: () => { throw apiError(msg, code) } } })
    t.after(q.stop)
    await q.start()
    fill(q)
    await q.run('submit()')
    assert.deepEqual(q.log.alerts, [['提交失败', msg]], msg)
    assert.equal(q.log.backs, 0, msg)
    assert.equal(q.run('form.itemName'), '床单', msg)
  }
})

test('驳回后修改：带回内容和理由；PUT 带全部字段；回详情；状态变了不覆盖，写原话回详情', async (t) => {
  const row = ROW({ status: 'rejected', statusText: '已驳回', rejectReason: '小票看不清', remark: '原备注', canEdit: true, canWithdraw: false })
  const p = openPage({ id: '12', edit: '1', storeId: '3' }, { answers: { get: { data: row }, put: { msg: '已重新提交，等平台审核' } } })
  t.after(p.stop)
  await p.start()
  assert.equal(p.run('mode.value'), 'form')
  assert.equal(p.run('rowId.value'), '12')
  assert.equal(p.run('rejectReason.value'), '小票看不清')
  assert.deepEqual(p.json('form'), { itemName: '床单', quantity: '2', amount: '128.50', purchaseDate: '2026-10-30', receipts: ['/profile/upload/a.png'], remark: '原备注' })
  assert.equal(p.run('submitLabel.value'), '改好了，再交一次')
  p.run("form.amount = '130'")
  await p.run('submit()')
  assert.deepEqual(p.log.put, [[L.REIMBURSE_API + '/12', { itemName: '床单', quantity: '2', amount: '130', purchaseDate: '2026-10-30', receipts: ['/profile/upload/a.png'], remark: '原备注' }]])
  assert.deepEqual(p.log.post, [], '修改不走新增')
  assert.equal(p.log.backs, 1)

  const late = openPage({ id: '12', edit: '1', storeId: '3' }, { answers: { get: { data: row }, put: () => { throw apiError('只有被驳回的报销可以修改后再交', 409) } } })
  t.after(late.stop)
  await late.start()
  await late.run('submit()')
  assert.deepEqual(late.log.alerts, [['提交失败', '只有被驳回的报销可以修改后再交']])
  assert.equal(late.log.backs, 1, '回详情看最新状态')

  const closed = openPage({ id: '12', edit: '1', storeId: '3' }, { answers: { get: { data: ROW({ canEdit: false }) } } })
  t.after(closed.stop)
  await closed.start()
  assert.match(closed.run('formBlock.value'), /这一笔现在不能修改/)
})

test('新增：服务端说不能交（非直营）就挡住，读不到不挡；门店名只有管几家时才写', async (t) => {
  const blocked = openPage({ create: '1' }, { answers: { get: { data: { storeId: 3, storeName: '南舍庄园', canSubmit: false, visible: false } } } })
  t.after(blocked.stop)
  await blocked.start()
  assert.deepEqual(blocked.log.get[0], [L.REIMBURSE_API + '/access', { storeId: 3 }])
  assert.match(blocked.run('formBlock.value'), /只有直营小院/)
  assert.equal(blocked.run('manyStores.value'), false)

  const broken = openPage({ create: '1', storeId: '3' }, { answers: { get: () => Promise.reject(apiError('断网', -1)) } })
  t.after(broken.stop)
  await broken.start()
  assert.equal(broken.run('formBlock.value'), '')

  const many = openPage({ create: '1', storeId: '4' }, { manyStores: true, answers: { get: { data: { storeId: 4, storeName: '大理袋鼠小院', canSubmit: true } } } })
  t.after(many.stop)
  await many.start()
  assert.equal(many.run('manyStores.value'), true)
  assert.equal(many.run('formStoreName.value'), '大理袋鼠小院')
  assert.match(many.template, /<view v-if="manyStores && formStoreName" class="fc-row">/)
})

test('下拉刷新：列表、详情重新取；填写屏不取，填的内容不动，转圈也要收', async (t) => {
  const list = openPage({ storeId: '3' }, { answers: { get: listAnswer() } })
  t.after(list.stop)
  await list.start()
  list.log.get.length = 0
  await list.hooks.pull()
  assert.equal(list.log.get.length, 1)
  assert.equal(list.log.pullStopped, true)

  const detail = openPage({ id: '12', storeId: '3' }, { answers: { get: { data: ROW() } } })
  t.after(detail.stop)
  await detail.start()
  detail.log.get.length = 0
  await detail.hooks.pull()
  assert.deepEqual(detail.log.get, [[L.REIMBURSE_API + '/12', undefined]])
  assert.equal(detail.log.pullStopped, true)

  const form = openPage({ create: '1', storeId: '3' }, { answers: { get: { data: { canSubmit: true } } } })
  t.after(form.stop)
  await form.start()
  form.run("form.itemName = '床单'")
  form.log.get.length = 0
  await form.hooks.pull()
  assert.deepEqual(form.log.get, [])
  assert.equal(form.run('form.itemName'), '床单')
  assert.equal(form.log.pullStopped, true)
  // 回到填写屏（选图、看大图回来都会触发 onShow）也不重新取
  await form.hooks.show()
  assert.deepEqual(form.log.get, [])
})

test('离开表单：没改不问；改了问一声，选取消留下；上传、提交中不让走', async (t) => {
  const clean = openPage({ create: '1', storeId: '3' }, { answers: { get: { data: { canSubmit: true } } } })
  t.after(clean.stop)
  await clean.start()
  await clean.run('leaveForm()')
  assert.deepEqual(clean.log.confirms, [])
  assert.equal(clean.log.backs, 1)

  const stay = openPage({ create: '1', storeId: '3' }, { confirmAnswer: false, answers: { get: { data: { canSubmit: true } } } })
  t.after(stay.stop)
  await stay.start()
  stay.run("form.itemName = '床单'")
  await stay.run('leaveForm()')
  assert.deepEqual(stay.log.confirms, [['先不交了？', '已经填的内容不会保存。']])
  assert.equal(stay.log.backs, 0)

  const edit = openPage({ id: '12', edit: '1', storeId: '3' }, { answers: { get: { data: ROW({ canEdit: true }) } } })
  t.after(edit.stop)
  await edit.start()
  await edit.run('leaveForm()')
  assert.deepEqual(edit.log.confirms, [], '带回来的内容不算改过')
  assert.equal(edit.log.backs, 1)

  const busy = openPage({ create: '1', storeId: '3' }, { answers: { get: { data: { canSubmit: true } } } })
  t.after(busy.stop)
  await busy.start()
  busy.run('uploading.value = true')
  await busy.run('leaveForm()')
  assert.equal(busy.log.backs, 0)
  assert.deepEqual(busy.log.toasts, ['正在处理，请稍候'])
})

test('凭证：最多 9 张（只让选剩下的）；传失败的不算；删一张；上传走 /app/upload/image', async (t) => {
  const p = openPage({ create: '1', storeId: '3' }, { chosen: ['a.png', 'bad.png', 'c.png'], answers: { get: { data: { canSubmit: true } } } })
  t.after(p.stop)
  await p.start()
  p.run("form.receipts.push('/x1', '/x2')")
  await p.run('addReceipts()')
  assert.equal(p.log.chooseN, 7)
  assert.deepEqual(p.log.uploaded, ['a.png', 'bad.png', 'c.png'])
  assert.deepEqual(p.json('form.receipts'), ['/x1', '/x2', '/profile/upload/a.png', '/profile/upload/c.png'])
  assert.deepEqual(p.log.toasts, ['有 1 张没传上，可以再加一次'])
  p.run('removeReceipt(0)')
  assert.deepEqual(p.json('form.receipts'), ['/x2', '/profile/upload/a.png', '/profile/upload/c.png'])

  const full = openPage({ create: '1', storeId: '3' }, { chosen: ['a.png'], answers: { get: { data: { canSubmit: true } } } })
  t.after(full.stop)
  await full.start()
  full.run("for (let i = 0; i < 9; i++) form.receipts.push('/x' + i)")
  await full.run('addReceipts()')
  assert.equal(full.log.chooseN, undefined, '满了不打开相册')
  assert.match(full.template, /<view v-if="form\.receipts\.length < MAX_RECEIPTS" class="fc-photo"/)

  const src2 = sfc(PAGE).scriptSetup.content
  assert.match(src2, /uploadTo\('\/app\/upload\/image', path\)/)
})

// ---------------------------------------------------------------- 模板、样式、注册

test('页面写明那一句，就一句；填写屏同一套 form-clean 版式；不出客服钮；提交按钮占满', () => {
  const d = sfc(PAGE)
  const t = d.template.content
  assert.equal(L.RULE_NOTE, '没提交进表的不报销')
  assert.match(t, /<text v-if="store\.canSubmit" class="rb-rule">\{\{ RULE_NOTE \}\}<\/text>/, '列表显眼的一句')
  assert.match(t, /<text class="fc-footnote">\{\{ RULE_NOTE \}\}<\/text>/, '填写屏页尾（forms-design 4.6）')
  assert.doesNotMatch(t, /没提交进表的不报销/, '字只写在一个地方')
  assert.match(d.styles[0].content, /@import '\.\/form-clean\.scss';/)
  for (const cls of ['fc-form', 'fc-block', 'fc-group__title', 'fc-field', 'fc-input', 'fc-num', 'fc-money', 'fc-row', 'fc-photos', 'fc-area--short', 'fc-footnote', 'fc-bar', 'fc-btn']) assert.ok(t.includes(cls), cls)
  assert.match(t, /<k-topbar v-if="mode === 'form'" [^>]*back custom-back :fab="false" @back="leaveForm" \/>/)
  assert.match(t, /<k-topbar v-else :title="mode === 'detail' \? '报销详情' : '采购报销'" back \/>/, '两个顶栏互斥')
  assert.doesNotMatch(t, /fc-kefu|open-type="contact"/, '小院主理人是员工，操作条没有客服钮')
  assert.doesNotMatch(d.scriptSetup.content, /fc-kefu|support-fab/)
  assert.doesNotMatch(t, /k-tabbar/, '填写屏不要底栏')
  assert.match(t, /placeholder-class="fc-ph"/)
  assert.match(t, /<k-date-picker v-if="dateOpen" [^>]*:min-date="MIN_DATE" :max-date="todayCn\(\)"/)
  assert.match(t, /<page-meta :page-style="dateOpen \? 'overflow: hidden' : ''" \/>/)
  for (const key of L.FIELD_ORDER) assert.ok(t.includes(`id="rb-${key}"`), '报错要滚得到：' + key)
})

test('能点的 view 都有 hover-class；v-for 别名是完整的词；text 上不写 hover-class', () => {
  const t = sfc(PAGE).template.content
  const opens = [...t.matchAll(/<(view|text|image)\b(?:[^"'<>]|"[^"]*"|'[^']*')*>/g)].map(m => m[0])
  const clickable = opens.filter(tag => /@click/.test(tag))
  assert.ok(clickable.length >= 10)
  for (const tag of clickable) {
    assert.ok(tag.startsWith('<view'), '可点的都是 view：' + tag)
    assert.match(tag, /hover-class=/, tag)
  }
  for (const m of t.matchAll(/v-for="\(?\s*([A-Za-z_$][\w$]*)/g)) assert.ok(m[1].length > 1, 'v-for 别名：' + m[1])
  assert.doesNotMatch(t, /<text [^>]*hover-class/)
})

test('金额全程字符串：页面和逻辑都不转数字、不做加减；全站色调走变量', () => {
  const d = sfc(PAGE)
  const logic = src('pages/staff/reimburse-logic.js')
  for (const code of [d.scriptSetup.content, logic]) {
    assert.doesNotMatch(code, /parseFloat|toFixed|Number\([^)]*amount/, '金额不转浮点')
  }
  assert.match(d.template.content, /¥\{\{ row\.amount \}\}/)
  const css = d.styles[0].content
  assert.doesNotMatch(css, /#[0-9a-fA-F]{3,8}\b/, '颜色只用 --k-* 变量')
  assert.doesNotMatch(css, /linear-gradient/)
  for (const m of css.matchAll(/font-size:\s*(\d+)px/g)) assert.ok(Number(m[1]) >= 13, '字不小于 13px：' + m[0])
})

test('注册：staff 分包，能下拉刷新；不进主包的 api.js、routes.js；逻辑文件不引 @/、不和页面同名', () => {
  const pages = JSON.parse(src('pages.json').replace(/^﻿/, ''))
  const staff = pages.subPackages.find(p => p.root === 'pages/staff')
  const page = staff.pages.find(p => p.path === 'reimburse')
  assert.ok(page)
  assert.equal(page.style.navigationStyle, 'custom')
  assert.equal(page.style.enablePullDownRefresh, true)
  assert.ok(!pages.pages.some(p => p.path.includes('reimburse')), '不进主包')
  assert.ok(fs.existsSync(path.join(APP, PAGE)))
  assert.ok(!fs.existsSync(path.join(APP, 'pages/staff/reimburse.js')), '同名会被打到包根目录、算进主包')
  assert.doesNotMatch(src('pages/staff/reimburse-logic.js'), /from '@\//)
  assert.doesNotMatch(src('common/api.js'), /reimburse/)
  assert.doesNotMatch(src('common/routes.js'), /reimburse/)
  assert.doesNotMatch(sfc(PAGE).scriptSetup.content, /from '@\/common\/api\.js'/, '接口直接用 common/request.js')
  // 路由守卫不用改：merchant、商家服务人、城市负责人、线上专员的白名单里没有它，他们直接打开会被送回工作台
  const main = src('main.js')
  assert.doesNotMatch(main, /reimburse/)
})
