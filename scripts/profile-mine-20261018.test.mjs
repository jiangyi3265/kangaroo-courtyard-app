// 2026-10-18 晚主人反馈 D 组（「我的」+ 会员 + 消息）的回归：node --test，不构建、不发请求。
//   1. 「我的行程」（profile/orders 第 1 屏）：分类 旅居订单（进行中 / 已完成 / 退款）、参与活动、兼职 / 全职 / 换工旅行（主人原话的顺序），有线上任务才多一类；
//      老链接 ?tab=待付款 / 退款 落到旅居订单对应小页签；没指定时停在第一个有内容的分类；
//   2. 「简历与机会」：简历页概览下半部分是技能匹配机会（同一个接口），老路由 profile/resume、profile/opportunities 都还在；
//   3. 「成为商家」：profile 分包里的新页面 + 两个新接口（V56），前端先挡漏填，服务端照样校验；
//   4. 员工工作台只给有生效授权的人看；消息页私信行用对方名字的第一个字做头像。
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'
import { emptyMerchantForm } from '../pages/profile/merchant-draft.js'

const APP = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const require = createRequire(path.join(APP, 'package.json'))
const compiler = require('@vue/compiler-sfc'), vue = require('vue')
const read = (rel) => fs.readFileSync(path.join(APP, rel), 'utf8').replace(/\r\n/g, '\n')
const readSfc = (rel) => compiler.parse(read(rel), { filename: rel }).descriptor

function runSetup(rel, stubs) {
  const script = readSfc(rel).scriptSetup.content
  const ast = compiler.babelParse(script, { sourceType: 'module' })
  const body = ast.program.body.filter(n => n.type !== 'ImportDeclaration').map(n => script.slice(n.start, n.end)).join('\n')
  const sandbox = { console }
  for (const n of ast.program.body.filter(n => n.type === 'ImportDeclaration')) for (const s of n.specifiers) sandbox[s.local.name] = () => new Promise(() => {})
  Object.assign(sandbox, { ref: vue.ref, computed: vue.computed, watch: vue.watch, reactive: vue.reactive, onShow() {}, onHide() {}, onUnload() {}, onLoad() {}, onPullDownRefresh() {} }, stubs)
  vm.createContext(sandbox)
  const scope = vue.effectScope()
  scope.run(() => vm.runInContext(body, sandbox, { filename: rel }))
  return { run: code => vm.runInContext(code, sandbox), json: code => JSON.parse(vm.runInContext('JSON.stringify(' + code + ')', sandbox)), stop: () => scope.stop() }
}

// ---------------------------------------------------------------- 1 我的行程
const ORDERS = 'pages/profile/orders.vue'
const ROWS = [
  { type: '住宿', status: '待付款', title: 'A', sortKey: 1 }, { type: '住宿', status: '已完成', title: 'B', sortKey: 2 }, { type: '二消', status: '进行中', title: 'C', sortKey: 3 },
  { type: '住宿', status: '已取消', title: 'D', sortKey: 4 }, { type: '活动', status: '进行中', title: 'E', sortKey: 5 }, { type: '换工', status: '已结束', title: 'F', sortKey: 6 },
  { type: '全职', status: '进行中', title: 'G', sortKey: 7 }
]
const ordersHarness = (screen = 1) => {
  let loadOpts
  const h = runSetup(ORDERS, {
    useScreen: (n, opts) => { loadOpts = opts; return vue.ref(screen) },
    apiMyOrders: async () => ({ data: ROWS }), absUrl: (u) => u, R: { trip: '/t', activityMine: '/am' }, go() {}, toast() {}, ensureSession: async () => {}
  })
  return { ...h, load: (q) => loadOpts.onLoad(q || {}) }
}

test('我的行程：旅居订单分 进行中（含待付款）/ 已完成 / 退款（含已取消）；其余按类；线上任务没有单就不出现', async (t) => {
  const h = ordersHarness()
  t.after(h.stop)
  await h.load({})
  await h.run('loadOrders()')
  assert.deepEqual(h.json('cats.value.map(c => c.label)'), ['旅居订单', '参与活动', '兼职旅行', '全职旅行', '换工旅行'])
  assert.deepEqual(h.json('cats.value.map(c => c.count)'), [4, 1, 0, 1, 1])
  assert.equal(h.run('cat.value'), 'stay')
  assert.deepEqual(h.json('filteredOrders.value.map(o => o.title)'), ['A', 'C'])
  h.run("staySub.value = '已完成'")
  assert.deepEqual(h.json('filteredOrders.value.map(o => o.title)'), ['B'])
  h.run("staySub.value = '退款'")
  assert.deepEqual(h.json('filteredOrders.value.map(o => o.title)'), ['D'])
  h.run("pickCat('volunteer')")
  assert.deepEqual(h.json('filteredOrders.value.map(o => o.title)'), ['F'], '换工旅行不分小页签，已结束的也在')
  assert.equal(h.json('catLink.value').url, '/t', '原来的行程时间线从这里进')
  h.run("pickCat('activity')")
  assert.equal(h.json('catLink.value').url, '/am?tab=mine', '原来的「我的活动」从这里进')
  h.run("pickCat('parttime')")
  assert.equal(h.run('emptyText.value'), '还没有兼职旅行')
})

test('我的行程：老链接 ?tab=待付款 / 退款 落到旅居订单；没指定时停在第一个有内容的分类；页面标题叫「我的行程」', async (t) => {
  const a = ordersHarness()
  t.after(a.stop)
  await a.load({ tab: encodeURIComponent('退款') })
  await a.run('loadOrders()')
  assert.deepEqual([a.run('cat.value'), a.run('staySub.value')], ['stay', '退款'])
  const b = runSetup(ORDERS, {
    useScreen: () => vue.ref(1), apiMyOrders: async () => ({ data: ROWS.filter(o => o.type === '全职') }), absUrl: (u) => u, R: {}, go() {}, toast() {}
  })
  t.after(b.stop)
  await b.run('loadOrders()')
  assert.equal(b.run('cat.value'), 'fulltime', '没有旅居订单的人进来停在有内容的「全职旅行」')
  assert.match(read(ORDERS), /const titles = \['我的行程', '评价管理', '我的提醒', '旅行体验官攻略申请'\]/)
  assert.match(read(ORDERS), /:scroll-into-view="'cat-' \+ cat"/)
})

// ---------------------------------------------------------------- 2 简历与机会
test('简历与机会：简历页标题改名，概览下半部分直接进入匹配机会；老的机会页路由还在', () => {
  const sfc = readSfc('pages/profile/resume.vue')
  assert.match(sfc.scriptSetup.content, /const titles = \['简历与机会', '基本信息编辑', '自由技能编辑', '经历列表'\]/)
  assert.match(sfc.scriptSetup.content, /const response = await apiOpportunities\(\)/)
  assert.match(sfc.scriptSetup.content, /opp\.value = response\.data/)
  // 10-19 复查：一个技能标签都没有时不列机会（「xx%匹配」没有技能依据），先请他写技能
  assert.match(sfc.scriptSetup.content, /\(oppSkillBased\.value \? opp\.value\.jobs \|\| \[\] : \[\]\)\.slice\(0, 3\)/)
  const tpl = sfc.template.content
  assert.ok(tpl.indexOf('resume-person') < tpl.indexOf('resume-opportunities'), '上面填简历，下面看机会')
  const pages = JSON.parse(read('pages.json').replace(/^﻿/, ''))
  const profile = pages.subPackages.find(p => p.root === 'pages/profile').pages.map(p => p.path)
  for (const name of ['resume', 'opportunities', 'follows', 'orders', 'merchant']) assert.ok(profile.includes(name), name)
})

test('简历与机会 / 技能匹配机会：没有技能标签时不写「xx%匹配」，提示把技能写具体；有标签才列机会（10-19 复查）', async (t) => {
  const job = { jobId: 9, title: '咖啡师', score: 95, typeLabel: '换宿', storeName: '喜洲小院', city: '大理' }
  const make = (opp, skillText) => {
    const h = runSetup('pages/profile/resume.vue', {
      useScreen: () => vue.ref(1), apiOpportunities: async () => ({ data: opp }), absUrl: (x) => x, toast() {}, errText: (e, d) => d,
      experience: { account: { id: 1 } }, getSessionRevision: () => 0, uni: { pageScrollTo() {} }
    })
    t.after(h.stop)
    h.run('skill.value = ' + JSON.stringify(skillText))
    return h
  }
  let h = make({ skills: [], jobs: [job] }, '')
  await h.run('loadOpp()')
  assert.equal(h.run('oppJobs.value.length'), 0, '没技能：不列机会')
  assert.equal(h.run('oppEmptyText.value'), '写一段技能描述，就能按技能为你匹配机会')
  h = make({ skills: [], jobs: [job] }, '我人很好相处')
  await h.run('loadOpp()')
  assert.equal(h.run('oppJobs.value.length'), 0, '写了技能但一个标签都没对上：也不列')
  assert.match(h.run('oppEmptyText.value'), /^你写的技能暂时没有对应的岗位标签，多写几项/)
  h = make({ skills: ['咖啡'], jobs: [job] }, '会做手冲咖啡')
  await h.run('loadOpp()')
  assert.deepEqual(JSON.parse(JSON.stringify(h.run('oppJobs.value.map(j => j.match)'))), ['95%'])
  // 整页「技能匹配机会」同一个规则；推荐的赚钱机会照常列、没标签时不挂百分比
  const opp = readSfc('pages/profile/opportunities.vue')
  assert.match(opp.template.content, /<view v-for="job in \(skillBased \? jobs : \[\]\)" :key="job\.jobId" class="card job k-mt12">/)
  assert.match(opp.template.content, /<view v-if="jobsLoaded && !skillBased" class="empty"><text>还没有技能标签<\/text>/)
  assert.match(opp.scriptSetup.content, /tag: skillBased\.value \? j\.match \+ '匹配' : ''/)
  assert.match(opp.template.content, /<view v-if="r\.tag" class="rec__tag"/)
})

// ---------------------------------------------------------------- 3 成为商家
test('成为商家：profile 分包新页面，两个接口；前端先挡漏填，不再问想招的人；没开通时换成进度卡', async (t) => {
  assert.match(read('common/routes.js'), /merchant: '\/pages\/profile\/merchant',/)
  const api = read('common/api.js')
  assert.match(api, /export const apiMerchantApply = \(\) => get\('\/app\/merchant\/apply'\)/)
  assert.match(api, /export const apiSubmitMerchantApply = \(payload\) => post\('\/app\/merchant\/apply', payload\)/)
  const tpl = readSfc('pages/profile/merchant.vue').template.content
  assert.match(tpl, /<view v-if="loaded && !merchantGrant && !waiting" class="form">/)
  for (const label of ['联系人', '手机号', '城市', '店铺类型', '店铺名称', '简单介绍']) assert.ok(tpl.includes(label), label)
  assert.ok(!tpl.includes('想招的人'), '2026-10-30 主人：去掉想招的人')
  // 10-19 复查：店铺类型 5 个时 6 等分（3 + 2，两行都排满，不再第二行空一格）
  assert.match(tpl, /<view class="pills" :class="storeTypes\.length === 5 \? 'pills--5' : 'pills--3'">/)
  const mcss = readSfc('pages/profile/merchant.vue').styles.map(s => s.content).join('\n')
  assert.match(mcss, /\.pills--5 \{ grid-template-columns: repeat\(6, minmax\(0, 1fr\)\); \}\n\.pills--5 \.pill \{ grid-column: span 2; \}\n\.pills--5 \.pill:nth-child\(n\+4\) \{ grid-column: span 3; \}/)
  // 合作介绍不写数字和没依据的承诺
  assert.doesNotMatch(tpl + readSfc('pages/profile/merchant.vue').scriptSetup.content, /\d+\s*万|免费|保证|零风险|无押金/)
  const toasts = [], posted = []
  const h = runSetup('pages/profile/merchant.vue', {
    emptyMerchantForm,
    toast: (m) => toasts.push(m), errText: (e, d) => d, experience: { account: { id: 7, nickname: '阿杰', phoneVerified: true, phone: '139****5678' } }, uni: { pageScrollTo() {} }, staffStores: vue.ref([]),
    apiSubmitMerchantApply: async (b) => { posted.push(b); return { data: { approved: false, message: '已提交，袋鼠小院会尽快电话联系你', latest: { open: true, status: 'new' } } } }
  })
  t.after(h.stop)
  await h.run('submit()')
  assert.equal(toasts.pop(), '请填写联系人')
  h.run("form.contactName = '阿杰'")
  await h.run('submit()')
  assert.equal(toasts.pop(), '请选择城市')
  h.run("Object.assign(form, { city: '大理', storeType: 'homestay', storeName: '喜洲小院' })")
  await h.run('submit()')
  assert.equal(posted.length, 1)
  assert.equal(posted[0].wantTypes, undefined, '不再传想招的人')
  // 没有自动开通（授权被撤销过等）：提示照服务端原话，只显示进度
  assert.equal(toasts.pop(), '已提交，袋鼠小院会尽快电话联系你')
  assert.equal(h.json('latest.value').open, true)
  assert.equal(h.run('waiting.value'), true)
})

// ---------------------------------------------------------------- 4 员工端入口 / 消息页
test('员工工作台只给有生效授权的人看；「我的」里没有门店任务；消息页私信行用对方名字第一个字做头像', () => {
  const tpl = readSfc('pages/profile/index.vue').template.content
  assert.match(tpl, /<view v-if="hasStaffAccess" class="card staff"/)
  assert.doesNotMatch(tpl + readSfc('pages/profile/index.vue').scriptSetup.content, /门店任务'/)
  const msg = readSfc('pages/messages/index.vue')
  assert.match(msg.template.content, /<view class="ava" :class="m\.ini \? 'ava--ini' : 't-' \+ m\.k\[1\]" :style="\{ background: m\.color \}"><text v-if="m\.ini">\{\{ m\.ini \}\}<\/text>/)
  assert.match(msg.scriptSetup.content, /ini: m\.category === 'chat' \? oneLine\(m\.title\)\.slice\(0, 1\) : ''/)
})
