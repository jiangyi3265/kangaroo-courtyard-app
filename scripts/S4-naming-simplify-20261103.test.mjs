// 2026-11-03 主人：全站叫法统一（S4）的回归，node --test 直接跑，不构建、不发请求：
//   N1 「在线任务」统一叫「线上任务」（员工岗位页页签、接单人交付页的任务类型兜底）
//   N2 用户看到的只有两个词：「袋鼠工作人员」（平台内部岗位统称）、「当地主理人」（门店那边的人）；
//      报名进度 / 交付 / 面试页的「联系主理人 / 联系专员」改成「联系当地主理人 / 联系袋鼠工作人员」，城市负责人卡片、房源详情「小院主理人」、
//      会话里服务端给的席位名、安全卡的角色名都按这条规则换；员工页面保留岗位名
//   N3 商家看到的岗位状态「待审核」叫「待完善」（筛选项和服务端状态字都按身份切换）；员工自己看的还是「待审核」
//   N4 「执行人」统一叫「接单人」（门店任务）；商家看的叫「我的需求」，换工主理人的审核页叫「商家需求审核」
//   N5 「小院主人」默认值改「当地主理人」
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
const sfc = (rel) => compiler.parse(src(rel), { filename: rel }).descriptor
const tasksForm = await import(pathToFileURL(path.join(APP, 'pages/manage/tasks-form.js')).href)
const plain = (v) => JSON.parse(JSON.stringify(v))
/** 用户真会看到的文字：去掉模板里的 <!-- --> 注释和脚本里整行的 // 注释 */
const shown = (rel) => {
  const d = sfc(rel)
  const tpl = (d.template ? d.template.content : '').replace(/<!--[\s\S]*?-->/g, '')
  const js = ((d.scriptSetup && d.scriptSetup.content) || (d.script && d.script.content) || '').split('\n').filter(l => !/^\s*\/\//.test(l)).join('\n')
  return tpl + '\n' + js
}

/** 在沙箱里跑页面的 script setup：导入一律先给永远不返回的函数，再用 stubs 覆盖用得到的那几个 */
function runSetup(rel, stubs) {
  const d = sfc(rel)
  const source = d.scriptSetup.content
  const ast = compiler.babelParse(source, { sourceType: 'module' })
  const body = ast.program.body.filter(n => n.type !== 'ImportDeclaration').map(n => source.slice(n.start, n.end)).join('\n')
  const sandbox = { console, setTimeout, clearTimeout }
  for (const n of ast.program.body.filter(n => n.type === 'ImportDeclaration')) for (const s of n.specifiers) sandbox[s.local.name] = () => new Promise(() => {})
  Object.assign(sandbox, { ref: vue.ref, computed: vue.computed, watch: vue.watch, reactive: vue.reactive, onShow() {}, onHide() {}, onUnload() {}, onUnmounted() {}, onMounted() {} }, stubs)
  vm.createContext(sandbox)
  const scope = vue.effectScope()
  scope.run(() => vm.runInContext(body, sandbox, { filename: rel + ':script-setup' }))
  return { run: code => vm.runInContext(code, sandbox), stop: () => scope.stop(), template: d.template.content, sandbox }
}

/** 抽一个顶层函数 / const 的源码，在小沙箱里跑（照 chat.test.mjs 的做法） */
function pick(rel, name) {
  const d = sfc(rel), source = d.scriptSetup.content
  const ast = compiler.babelParse(source, { sourceType: 'module' })
  const node = ast.program.body.find(n => (n.type === 'FunctionDeclaration' && n.id.name === name) || (n.type === 'VariableDeclaration' && n.declarations.some(x => x.id.name === name)))
  assert.ok(node, rel + ' 里没有 ' + name)
  return source.slice(node.start, node.end)
}

const INTERNAL = /换工主理人|小院主理人|商家服务人|城市负责人|线上任务专员|线上专员/

// ---------------------------------------------------------------- N1 线上任务
test('N1 「在线任务」统一叫「线上任务」：员工岗位页页签、交付页任务类型兜底里都没有「在线任务」', () => {
  const jobs = sfc('pages/staff/jobs.vue').template.content
  assert.match(jobs, /@click="setType\('online'\)">线上任务<\/text>/)
  assert.doesNotMatch(jobs, /在线任务/)
  const deliver = sfc('pages/jobs/deliver.vue').template.content
  assert.match(deliver, /\{\{ a\.taskType \|\| '线上任务' \}\}/)
  assert.doesNotMatch(deliver, /在线任务/)
  // 全部页面、组件里都不再写「在线任务」
  const walk = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(path.join(dir, e.name)) : /\.(vue|js)$/.test(e.name) ? [path.join(dir, e.name)] : [])
  const hits = [...walk(path.join(APP, 'pages')), ...walk(path.join(APP, 'components'))].filter(f => fs.readFileSync(f, 'utf8').includes('在线任务'))
  assert.deepEqual(hits, [])
})

// ---------------------------------------------------------------- N2 用户只见两个词
test('N2 报名进度 / 交付 / 面试页：「联系当地主理人 / 联系袋鼠工作人员」，没有「联系主理人 / 联系专员」', () => {
  const progress = shown('pages/jobs/progress.vue')
  assert.match(progress, /const contactLabel = computed\(\(\) => \(contactSpecialist\.value \? '联系袋鼠工作人员' : '联系当地主理人'\)\)/)
  assert.match(progress, /label="联系当地主理人" @click="contactOwner"/)
  assert.match(progress, /t\.text\.replace\('联系当地主理人', contactLabel\.value\)/)
  assert.match(progress, /contactSpecialist \? '袋鼠工作人员' : '当地主理人'\) \+ '审核。'/)
  assert.doesNotMatch(progress, /联系主理人|联系专员|「联系专员」/)
  const deliver = shown('pages/jobs/deliver.vue')
  assert.match(deliver, /\{\{ a\.contactSpecialist \? '联系袋鼠工作人员' : '联系当地主理人' \}\}/)
  assert.match(deliver, /可以先私信\{\{ a\.contactSpecialist \? '袋鼠工作人员' : '当地主理人' \}\}沟通/)
  assert.doesNotMatch(deliver, /联系主理人|联系专员/)
  const interview = shown('pages/jobs/interview.vue')
  assert.match(interview, /await sheet\(\['联系商家', '联系平台客服'\]\)/)
  assert.match(interview, /可联系商家或平台客服/)
  assert.doesNotMatch(interview, /联系主理人(?!或)|联系专员/)
})

test('N2 城市负责人卡片对用户叫「袋鼠工作人员」；房源详情的「小院主理人」叫「当地主理人」', () => {
  const card = sfc('pages/jobs/components/city-coordinator.vue').template.content
  assert.match(card, /\{\{ cityName \? cityName \+ '袋鼠工作人员' : '袋鼠工作人员' \}\}/)
  assert.match(card, /工作人员资料读取失败，点击重试/)
  assert.doesNotMatch(card, /城市负责人|袋鼠负责人/)
  const stay = shown('pages/stays/detail.vue')
  assert.match(stay, /<text class="sec-title">当地主理人<\/text><view v-if="host\.storeId"/)
  assert.match(stay, /<text class="sec-title">当地主理人<\/text><\/view><text class="section-pending">当地主理人介绍待补充<\/text>/)
  assert.doesNotMatch(stay, /小院主理人/)
})

test('N2 会话里的席位名：报名人 / 接单人那一侧内部岗位名写「袋鼠工作人员 / 当地主理人」，门店员工那一侧照旧', () => {
  const c = {}
  vm.createContext(c)
  vm.runInContext(`const conv={value:{}};${pick('pages/community/chat.vue', 'senderLabel')};this.api={conv,senderLabel};`, c)
  const { conv, senderLabel } = c.api
  conv.value = { type: 'store', myRole: 'member', sourceLabel: '线上任务' }
  assert.equal(senderLabel({ role: 'store', name: '阿青', seatLabel: '专员', mine: false }), '袋鼠工作人员 · 阿青')
  assert.equal(senderLabel({ role: 'store', name: '阿青', seatLabel: '线上任务专员', mine: false }), '袋鼠工作人员 · 阿青')
  assert.equal(senderLabel({ role: 'store', name: '大山', seatLabel: '城市负责人', mine: false }), '袋鼠工作人员 · 大山')
  assert.equal(senderLabel({ role: 'store', name: '阿东', seatLabel: '换工主理人', mine: false }), '当地主理人 · 阿东')
  assert.equal(senderLabel({ role: 'store', name: '阿东', seatLabel: '小院主理人', mine: false }), '当地主理人 · 阿东')
  assert.equal(senderLabel({ role: 'store', name: '黑子', mine: false }), '接待 · 黑子')
  // 门店员工自己这一侧（myRole = store）照旧看岗位名
  conv.value = { type: 'store', myRole: 'store', sourceLabel: '线上任务' }
  assert.equal(senderLabel({ role: 'store', name: '阿青', seatLabel: '专员', mine: false }), '专员 · 阿青')
  assert.equal(senderLabel({ role: 'store', name: '阿东', seatLabel: '换工主理人', mine: false }), '换工主理人 · 阿东')
  assert.equal(senderLabel({ role: 'user', name: '雪兔子', mine: false }), '接单人 · 雪兔子')
})

test('N2 安全卡上没昵称时写的角色：内部岗位名换成「当地主理人 / 袋鼠工作人员」', () => {
  const c = {}
  vm.createContext(c)
  vm.runInContext(`${pick('pages/jobs/components/safety-share.vue', 'userRoleWording')};this.f=userRoleWording;`, c)
  assert.equal(c.f('换工主理人'), '当地主理人')
  assert.equal(c.f('小院主理人'), '当地主理人')
  assert.equal(c.f('线上任务专员'), '袋鼠工作人员')
  assert.equal(c.f('城市负责人'), '袋鼠工作人员')
  assert.equal(c.f('袋鼠客服'), '袋鼠客服')
  assert.equal(c.f(''), '')
  assert.match(shown('pages/jobs/components/safety-share.vue'), /safety\.value\.name \|\| userRoleWording\(safety\.value\.roleLabel\) \|\| '门店接待'/)
})

test('N2 用户端页面（jobs / stays / community / profile / messages / home）看得到的文字里没有内部岗位名', () => {
  const walk = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(path.join(dir, e.name)) : /\.vue$/.test(e.name) ? [path.join(dir, e.name)] : [])
  const bad = []
  for (const dir of ['pages/jobs', 'pages/stays', 'pages/community', 'pages/profile', 'pages/messages', 'pages/home']) {
    for (const f of walk(path.join(APP, dir))) {
      const rel = path.relative(APP, f).replace(/\\/g, '/')
      // 换叫法的那几行正则（.replace(/换工主理人…/)）是代码不是给人看的字，跳过
      const text = shown(rel).split('\n').filter(l => !l.includes('.replace(/')).join('\n')
      if (rel === 'pages/profile/team-reports.vue') {
        assert.match(text, /v-else-if="!allowed"/)
        assert.match(text, /get\('\/app\/team-reports\/access'\)/)
        assert.match(text, /<template v-else>[\s\S]+roleName\(r\.roleCode\)/)
        if (INTERNAL.test(text.replace(/^const roleName = .*$/m, ''))) bad.push(rel)
      } else if (INTERNAL.test(text)) bad.push(rel)
    }
  }
  assert.deepEqual(bad, [])
})

// ---------------------------------------------------------------- N3 商家「待完善」
test('N3 商家的岗位筛选项和状态字里「待审核」叫「待完善」；员工自己看的还是「待审核」', async (t) => {
  const open = (merchant) => runSetup('pages/staff/jobs.vue', {
    useScreen: () => vue.ref(1), onShareAppMessage() {}, ensureSession: async () => {}, hasStaffAccess: { value: true }, merchantStaff: { value: merchant },
    currentStaffStoreId: () => 102, staffCan: () => true, absUrl: x => x, R: {}, uni: {}
  })
  const m = open(true), k = open(false)
  t.after(() => { m.stop(); k.stop() })
  const rows = "[{ jobId: 1, status: 'draft', statusLabel: '待审核', images: [] }, { jobId: 2, status: 'published', statusLabel: '招聘中', images: [] }]"
  m.run('rows.value = ' + rows); k.run('rows.value = ' + rows)
  assert.deepEqual(plain(m.run('STATUS_OPTS.value.map(o => o.l)')), ['全部状态', '招聘中', '缺人中', '已暂停', '待完善', '已关闭'])
  assert.deepEqual(plain(k.run('STATUS_OPTS.value.map(o => o.l)')), ['全部状态', '招聘中', '缺人中', '已暂停', '待审核', '已关闭'])
  // 值不变（接口照旧传 draft），只换显示
  assert.deepEqual(plain(m.run('STATUS_OPTS.value.map(o => o.v)')), ['', 'recruiting', 'short', 'paused', 'draft', 'closed'])
  assert.deepEqual(plain(m.run('jobList.value.map(j => j.status)')), ['待完善', '招聘中'])
  assert.deepEqual(plain(k.run('jobList.value.map(j => j.status)')), ['待审核', '招聘中'])
  assert.equal(m.run("merchantJobStatus('待换工主理人审核')"), '待袋鼠工作人员审核')
  // 选了筛选项后顶上的字也跟着身份
  m.run("statusFilter.value = 'draft'"); k.run("statusFilter.value = 'draft'")
  assert.equal(m.run('statusFilterLabel.value'), '待完善')
  assert.equal(k.run('statusFilterLabel.value'), '待审核')
})

test('N3 商家发线上任务：流程说明、到期提示里只有「袋鼠工作人员」', () => {
  const page = shown('pages/staff/online-jobs.vue')
  assert.match(page, /merchantStaff\.value \? '袋鼠工作人员核实后上架' : '平台审核上架'/)
  assert.match(page, /\(merchantStaff \? '需要袋鼠工作人员继续开启。' : '需要线上任务专员、小院主理人或平台继续开启。'\)/)
})

// ---------------------------------------------------------------- N4 接单人 / 需求
test('N4 门店任务的「执行人」统一叫「接单人」', () => {
  for (const rel of ['pages/manage/tasks.vue', 'pages/manage/dashboard.vue']) assert.doesNotMatch(shown(rel), /执行人/, rel)
  assert.doesNotMatch(src('pages/manage/tasks-form.js').split('\n').filter(l => !/^\s*\/\//.test(l)).join('\n'), /执行人/)
  const tasks = sfc('pages/manage/tasks.vue').template.content
  assert.match(tasks, /<text class="chip-pop__title">验收接单人<\/text>/)
  assert.match(tasks, /接单人认领前就能看到/)
  assert.match(shown('pages/manage/tasks.vue'), /\['验收接单人', '查看执行情况', '取消任务'\]/)
  assert.match(shown('pages/manage/tasks.vue'), /prompt\('取消原因（会通知接单人）'/)
  assert.match(shown('pages/manage/tasks.vue'), /toast\('没有进行中的接单人'\)/)
  assert.equal(tasksForm.checkErrors({ userId: '', hours: 2, rating: 5, proofs: [], people: [] }).userId, '选一位接单人')
  assert.match(tasksForm.checkConfirmText({ userId: 9, hours: 2, rating: 5, proofs: [], people: [] }), /^给 接单人 记 2 小时/)
})

test('N4 商家看「我的需求」；换工主理人的审核页叫「商家需求审核」', () => {
  assert.match(shown('pages/staff/merchant-request.vue'), /return kind\.value \? kind\.value\.title : '我的需求'/)
  const home = shown('pages/staff/components/k-merchant-work.vue')
  assert.match(home, /<view class="heading"><text>我的需求<\/text>/)
  assert.doesNotMatch(home, /我发布的/)
  assert.match(shown('pages/staff/business.vue'), /label: '商家需求审核', icon: 'file-check'/)
  assert.match(sfc('pages/staff/intake.vue').template.content, /<k-topbar :title="jobsMode \? '商家岗位' : '商家需求审核'" back \/>/)
  assert.doesNotMatch(shown('pages/staff/business.vue') + shown('pages/staff/intake.vue'), /线上任务审核/)
})

// ---------------------------------------------------------------- N5 小院主人
test('N5 小院资料里主理人称呼没填时写「当地主理人」，不再是「小院主人」', () => {
  const rooms = sfc('pages/staff/rooms.vue').template.content
  assert.match(rooms, /\{\{ form\.hostName \|\| '当地主理人' \}\}/)
  assert.doesNotMatch(rooms, /小院主人/)
})
