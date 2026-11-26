// 10-13 第二轮页面修复的回归（node --test，不需要构建、不发请求）。跑的是页面真实的 script setup，接口一律换成假函数：
//   · 「授权管理」撤回选项不列《用户协议》《隐私政策》（服务端不让单独撤回），「已同意」一行照常列全部；
//   · 面试页保险办理：保单快到期 / 已到期（apply.renewable）时不再锁成「本次申请已提交」，起保日接在上一张保单之后；
//   · 二消订单里住宿单「查看详情」打开订单台这一单；没有「房源·查看」权限的员工仍看文字详情；
//   · 已暂停 / 不接受报名的岗位，标题旁不再是绿色「还招 N 人」，底部按钮写短原因；
//   · 「我的」头部昵称放不下显示「…」（10-15 起邮戳图已去掉）；发布找搭子选中的活动标签 ✓ 跟在文字右边。
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'
import { remainingHeadcount } from '../pages/jobs/store-page.js'
import test from 'node:test'
import assert from 'node:assert/strict'

const APP = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const require = createRequire(path.join(APP, 'package.json'))
const compiler = require('@vue/compiler-sfc'), vue = require('vue')
const readSfc = (rel) => compiler.parse(fs.readFileSync(path.join(APP, rel), 'utf8').replace(/\r\n/g, '\n'), { filename: rel }).descriptor
const flush = () => new Promise(resolve => setImmediate(resolve))

/** 在沙箱里跑页面的 script setup：导入一律先给永远不返回的函数，再用 stubs 覆盖用得到的那几个 */
function runSetup(rel, stubs) {
  const d = readSfc(rel)
  const source = d.scriptSetup.content
  const ast = compiler.babelParse(source, { sourceType: 'module' })
  const body = ast.program.body.filter(n => n.type !== 'ImportDeclaration').map(n => source.slice(n.start, n.end)).join('\n')
  const sandbox = { console }
  for (const n of ast.program.body.filter(n => n.type === 'ImportDeclaration')) for (const s of n.specifiers) sandbox[s.local.name] = () => new Promise(() => {})
  Object.assign(sandbox, {
    ref: vue.ref, computed: vue.computed, watch: vue.watch, reactive: vue.reactive,
    onShow() {}, onHide() {}, onUnload() {}, onUnmounted() {}
  }, stubs)
  vm.createContext(sandbox)
  const scope = vue.effectScope()
  scope.run(() => vm.runInContext(body, sandbox, { filename: rel + ':script-setup' }))
  return { run: code => vm.runInContext(code, sandbox), stop: () => scope.stop(), template: d.template.content, styles: d.styles.map(s => s.content).join('\n') }
}

// ---------------------------------------------------------------- 授权管理
function profileHarness(consents) {
  const modals = [], sheets = [], withdrawn = [], toasts = []
  const h = runSetup('pages/profile/index.vue', {
    useScreen: () => vue.ref(1),
    experience: vue.reactive({ account: { id: 7, nickname: '小院同学' }, mode: 'user' }),
    hasStaffAccess: vue.computed(() => false), onlineStaff: vue.computed(() => false), unreadCount: vue.ref(0),
    apiMeAuthorizations: async () => ({ data: { consents, resumeStores: [], note: '说明' } }),
    apiMeWithdrawConsent: async (doc) => { withdrawn.push(doc); return { data: { message: '已撤回' } } },
    sheet: async (items) => { sheets.push(items); return 0 },
    toast: (t) => toasts.push(t),
    uni: { showModal: (o) => { modals.push({ title: o.title, content: o.content, confirmText: o.confirmText }); o.success({ confirm: true }) } }
  })
  return { ...h, modals, sheets, withdrawn, toasts }
}

test('授权管理：撤回选项不列用户协议和隐私政策，同一份文件多个版本只列一次', async (t) => {
  const h = profileHarness([
    { doc: 'privacy', title: '《隐私政策》', time: '2026-10-13' },
    { doc: 'terms', title: '《用户协议》', time: '2026-10-13' },
    { doc: 'location', title: '位置信息', time: '2026-10-12' },
    { doc: 'resume_share', title: '简历提供给门店', time: '2026-10-10' },
    { doc: 'location', title: '位置信息', time: '2026-09-01' }
  ])
  t.after(h.stop)
  await h.run('openAuthorizations()')
  assert.match(h.modals[0].content, /已同意：《隐私政策》、《用户协议》、位置信息、简历提供给门店、位置信息/, '「已同意」照常列全部')
  assert.match(h.modals[0].content, /《用户协议》《隐私政策》不能单独撤回/)
  assert.equal(h.modals[0].confirmText, '去撤回')
  assert.deepEqual(h.sheets, [['位置信息（2026-10-12）', '简历提供给门店（2026-10-10）']])
  assert.deepEqual(h.withdrawn, ['location'])
})

test('授权管理：只有用户协议和隐私政策时只给「知道了」，不弹撤回选项', async (t) => {
  const h = profileHarness([
    { doc: 'privacy', title: '《隐私政策》', time: '2026-10-13' },
    { doc: 'terms', title: '《用户协议》', time: '2026-10-13' }
  ])
  t.after(h.stop)
  await h.run('openAuthorizations()')
  assert.equal(h.modals.length, 1)
  assert.equal(h.modals[0].confirmText, '知道了')
  assert.match(h.modals[0].content, /已同意：《隐私政策》、《用户协议》/)
  assert.deepEqual(h.sheets, [])
  assert.deepEqual(h.withdrawn, [])
})

// ---------------------------------------------------------------- 面试页 · 保险办理续保
function interviewHarness(data) {
  const h = runSetup('pages/staff/interviews.vue', {
    useScreen: () => vue.ref(4),
    experience: vue.reactive({ account: { id: 'owner' }, mode: 'staff' }),
    staffStores: vue.computed(() => [{ storeId: '101', roleCode: 'manager', active: true, storeName: 'own A' }]),
    hasStaffAccess: vue.computed(() => true), currentStaffStoreId: () => '101',
    getToken: () => 'synthetic-token', getSessionRevision: () => 0, todayCn: () => '2026-10-13', staffCan: () => true,
    apiStaffInsuranceForApp: async () => ({ data }),
    apiStaffInsurance: async () => ({ data: { counts: { toBuy: 1, effective: 1, all: 2 } } }),
    loadStaffPerms: async () => ({ insurance: ['yes', 'yes', 'no', 'no', 'no'] }),
    apiStaffPolicyNotices: async () => ({ data: [] })
  })
  return h
}
const PLAN = { planId: 7, name: '月度意外险', desc: '', priceYuan: '30', days: 30 }
const insured = (apply, extra) => ({ storeId: '101', candidate: { appId: 11, name: '续保人', insurable: true }, plans: [PLAN], apply, ...extra })
const openInsurance = async (h) => {
  h.run(`d.value = { appId: 11, storeId: '101', storeName: 'own A' }`)
  await h.run('toInsurance()')
  await flush()
}
const view = (h) => JSON.parse(h.run(`JSON.stringify({ locked: lockedInsurance.value, label: buyLabel.value, canBuy: canBuy.value, start: startDate.value,
  lastEnd: lastEndDate.value, min: insuranceMinDate.value, period: periodText.value, plan: selPlan.value, error: insuranceError.value })`))

test('保单 7 天内到期：方案放开、起保日接在上一张之后、按钮写提交续保申请', async (t) => {
  const h = interviewHarness(insured(
    { applyId: 5, planId: 7, status: 'effective', renewable: true, startDate: '2026-09-17', endDate: '2026-10-16', statusLabel: '已出单', priceYuan: '30' },
    { defaultStart: '2026-10-17', lastEndDate: '2026-10-16' }))
  t.after(h.stop)
  await openInsurance(h)
  assert.deepEqual(view(h), { locked: false, label: '提交续保申请', canBuy: true, start: '2026-10-17', lastEnd: '2026-10-16',
    min: '2026-10-17', period: '2026-10-17 至 2026-11-15（30天）', plan: 7, error: '' })
  assert.match(h.template, /:min-date="insuranceMinDate"/)
})

test('保单已经过期：最早起保日是今天', async (t) => {
  const h = interviewHarness(insured(
    { applyId: 5, planId: 7, status: 'effective', renewable: true, startDate: '2026-09-11', endDate: '2026-10-10', statusLabel: '已出单', priceYuan: '30' },
    { defaultStart: '2026-10-13', lastEndDate: '2026-10-10' }))
  t.after(h.stop)
  await openInsurance(h)
  const v = view(h)
  assert.equal(v.locked, false)
  assert.equal(v.min, '2026-10-13')
  assert.equal(v.start, '2026-10-13')
})

test('保单还在保障期 / 申请在途：仍锁住，显示本次申请已提交', async (t) => {
  for (const apply of [
    { applyId: 5, planId: 7, status: 'effective', renewable: false, startDate: '2026-10-01', endDate: '2026-10-30', statusLabel: '已出单', priceYuan: '30' },
    { applyId: 6, planId: 7, status: 'pending', startDate: '2026-10-14', endDate: '2026-11-12', statusLabel: '待出单', priceYuan: '30' }
  ]) {
    const h = interviewHarness(insured(apply, { defaultStart: '2026-10-14', lastEndDate: null }))
    t.after(h.stop)
    await openInsurance(h)
    const v = view(h)
    assert.equal(v.locked, true, apply.status)
    assert.equal(v.label, '本次申请已提交')
    assert.equal(v.canBuy, false)
    assert.equal(v.period, apply.startDate + ' 至 ' + apply.endDate)
  }
})

// ---------------------------------------------------------------- 二消订单 · 住宿单查看详情
function resaleHarness(roomsView) {
  const nav = [], alerts = []
  const grants = [{ storeId: '101', roleCode: 'manager', active: true, storeName: 'own A' }, { storeId: '202', roleCode: 'staff', active: true, storeName: 'own B' }]
  const h = runSetup('pages/staff/insurance.vue', {
    useScreen: () => vue.ref(3),
    experience: vue.reactive({ account: { id: 'owner' }, mode: 'staff' }),
    staffStores: vue.computed(() => grants), currentStaffStore: vue.computed(() => grants[0]),
    hasStaffAccess: vue.computed(() => true), currentStaffStoreId: () => '101',
    getToken: () => 'synthetic-token', getSessionRevision: () => 0, staffCan: () => true,
    absUrl: x => x, yuan: x => String(x), serverTs: () => Date.now(),
    loadStaffPerms: async () => ({ rooms: [roomsView, 'no', 'no', 'no', 'no'], finance: ['yes', 'no', 'no', 'no', 'no'] }),
    go: (url) => nav.push(url), alert: (...args) => { alerts.push(args); return Promise.resolve() }
  })
  return { ...h, nav, alerts }
}
const showRows = (h, storeId) => {
  // 先换筛选门店（会清空列表），再放这一页的订单
  h.run(`rq.value = { ...rq.value, tab: 'used', storeId: ${storeId ? `'${storeId}'` : 'null'} }`)
  h.run(`rs.value = { rows: [
    { orderNo: 'SO 1', bizType: 'stay', title: '海景房', status: 'completed', statusLabel: '已完成', payFen: 100 },
    { orderNo: 'SV2', bizType: 'shop', title: '冲浪课', status: 'used', statusLabel: '已核销', payFen: 200 }
  ], counts: {}, storeName: 'own B' }`)
}

test('住宿单「查看详情」打开订单台这一单，带上本页筛选的门店', async (t) => {
  const h = resaleHarness('yes')
  t.after(h.stop)
  showRows(h, '202')
  await h.run('onOrderBtn(orders.value[0])')
  assert.deepEqual(h.nav, ['/pages/staff/stay-orders?orderNo=SO%201&storeId=202'])
  assert.deepEqual(h.alerts, [])
  showRows(h, null)
  await h.run('onOrderBtn(orders.value[0])')
  assert.equal(h.nav[1], '/pages/staff/stay-orders?orderNo=SO%201')
})

test('没有「房源·查看」权限的员工、服务单：仍弹文字详情', async (t) => {
  const h = resaleHarness('no')
  t.after(h.stop)
  showRows(h, '202')
  await h.run('onOrderBtn(orders.value[0])')
  await h.run('onOrderBtn(orders.value[1])')
  assert.deepEqual(h.nav, [])
  assert.deepEqual(h.alerts.map(a => a[0]), ['订单详情', '订单详情'])
  assert.match(h.alerts[0][1], /住宿：海景房/)
  assert.match(h.alerts[1][1], /服务：冲浪课/)
})

// ---------------------------------------------------------------- 岗位详情 · 暂停 / 不接受报名
function detailHarness() {
  return runSetup('pages/jobs/detail.vue', {
    useScreen: () => vue.ref(1), experience: vue.reactive({ account: null }), absUrl: x => x, remainingHeadcount
  })
}
const chip = (h, d) => {
  h.run('detail.value = ' + JSON.stringify(d))
  return h.run('JSON.stringify([blockedShort.value, headcountText.value, applyBlockedText.value])')
}

test('岗位详情：暂停 / 名额满 / 过截止时不再显示绿色「还招 N 人」，按钮写短原因', (t) => {
  const h = detailHarness()
  t.after(h.stop)
  const paused = { jobType: 'volunteer', status: 'paused', acceptsApplication: false, applyClosedReason: '该岗位暂停招聘中，暂不接受报名', headcount: 5, hiredCount: 2 }
  assert.equal(chip(h, paused), JSON.stringify(['已暂停招聘', '还招 3 人', '该岗位暂停招聘中，暂不接受报名']))
  assert.equal(JSON.parse(chip(h, { ...paused, jobType: 'online' }))[0], '已暂停招聘', '线上任务同理')
  assert.equal(JSON.parse(chip(h, { jobType: 'volunteer', status: 'published', acceptsApplication: true, headcount: 4, hiredCount: 4 }))[0], '名额已满')
  assert.equal(JSON.parse(chip(h, { jobType: 'online', status: 'published', acceptsApplication: false, applyClosedReason: '这个任务已过截止时间，不再接单', headcount: 5, hiredCount: 1 }))[0], '已过截止时间')
  assert.equal(JSON.parse(chip(h, { jobType: 'volunteer', status: 'published', acceptsApplication: false, applyClosedReason: '其他原因', headcount: null }))[0], '暂不可报名')
  assert.equal(chip(h, { jobType: 'volunteer', status: 'published', acceptsApplication: true, headcount: 5, hiredCount: 2 }), JSON.stringify(['', '还招 3 人', '']))
  // 胶囊：不能报名时灰色写短原因，能报名时才是绿色剩余名额；底部按钮不能报名时写短原因
  assert.match(h.template, /<k-chip v-if="blockedShort \|\| headcountText" :tone="blockedShort \? 'neutral' : 'green'"><text>\{\{ blockedShort \|\| headcountText \}\}<\/text><\/k-chip>/)
  const button = h.template.match(/<k-button[^>]*@click="openApply"[^>]*>/)?.[0]
  assert.ok(button, '底部报名按钮必须可操作')
  const disabled = button.match(/:disabled="([^"]+)"/)[1], label = button.match(/:label="([^"]+)"/)[1]
  const values = {detail: paused, applyBlockedText: '该岗位暂停招聘中', blockedShort:'已暂停招聘', isOnline:false}
  for (const [myApplication, expected] of [[null, [true, '已暂停招聘']], [{label:'查看报名进度'}, [false, '查看报名进度']]]) {
    assert.deepEqual([disabled,label].map(expr => vm.runInNewContext(expr,{...values,myApplication})), expected)
  }
})

// ---------------------------------------------------------------- 样式：邮戳、活动标签 ✓
const ruleOf = (css, selector) => [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].filter(m => m[1].trim() === selector).map(m => m[2])

test('「我的」头部：去掉邮戳图后昵称占满一栏，放不下显示「…」', () => {
  const d = readSfc('pages/profile/index.vue')
  const css = d.styles.map(s => s.content).join('\n').replace(/\/\*[\s\S]*?\*\//g, '')
  assert.doesNotMatch(d.template.content, /profile-stamp|me__stamp/)
  assert.equal(ruleOf(css, '.me__stamp').length, 0)
  assert.ok(ruleOf(css, '.me__name').some(r => /text-overflow:\s*ellipsis/.test(r) && /white-space:\s*nowrap/.test(r)))
  assert.ok(ruleOf(css, '.me__name').every(r => !/padding-right/.test(r)), '没有邮戳了，不用再给它让位置')
  assert.ok(ruleOf(css, '.me__info').some(r => /min-width:\s*0/.test(r)), '昵称一栏要能缩，省略号才会出来')
  // 2026-10-17 主人反馈「我的」首屏放不下「内容与关注」：头像 64→48px
  assert.ok(ruleOf(css, '.me__avatar').some(r => /width:\s*48px/.test(r) && /height:\s*48px/.test(r)))
})

test('发布找搭子：选中的活动标签 ✓ 跟在文字右边，不再绝对定位压字', () => {
  const d = readSfc('pages/community/chat.vue')
  const css = d.styles.map(s => s.content).join('\n').replace(/\/\*[\s\S]*?\*\//g, '')
  const picked = ruleOf(css, '.picked')
  assert.equal(picked.length, 1)
  assert.doesNotMatch(picked[0], /position:\s*absolute/)
  assert.match(picked[0], /flex:0 0 auto/)
  assert.ok(ruleOf(css, '.activity-grid>view').some(r => /gap:2px/.test(r)))
  assert.match(d.template.content, /<view class="activity-grid"><view v-for="a in tripActivities"[^>]*><text>\{\{ a \}\}<\/text><view v-if="selectedActivities\.includes\(a\)" class="picked">/)
})
