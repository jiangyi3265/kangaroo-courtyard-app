// 2026-11-03 主人：简化 —— 线上任务管理页（商家、商家服务人、线上专员都用）pages/staff/online-jobs.vue（node --test，不需要构建、不发请求）。
//   M2 第 2 屏先是任务列表（每张卡写报名 / 待验收），点进去接单人一人一行、点行进交付页；去掉「点标题弹任务列表」「查看交付弹接单人列表」两个弹窗；
//      带 jobId 进来直接落到那条任务；合作商家藏「按技能找人」
//   M3 登记付款改成一个底部面板（方式按钮组 / 流水号输入框 / 凭证照片格 / 一个按钮）；更正时顶上写「这是更正」并保留一次确认
//   M4 发任务的预计完成时间默认 7 天后 18:00，点了用「日期 | 时 | 分」滚轮改
//   M5 底栏一直写着还差什么 / 可以提交，提交不再弹「确认提交？」；商家看到的是「袋鼠工作人员」
//   S2 到期任务「继续开启」用同一个滚轮，默认值听服务端
//   S3 工作台任务卡进来不再弹接单人列表
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
const FORM = await import(pathToFileURL(path.join(APP, 'common/activity-form.js')).href)
const raw = (rel) => fs.readFileSync(path.join(APP, rel), 'utf8')
const src = (rel) => raw(rel).replace(/\r\n/g, '\n')
const plain = (v) => JSON.parse(JSON.stringify(v))
const flush = () => new Promise(resolve => setImmediate(resolve))
const PAGE = 'pages/staff/online-jobs.vue'
const WORK = 'pages/staff/components/k-online-work.vue'
const R = { staff: '/pages/staff/index', staffOnline: '/pages/staff/online-jobs', staffTalents: '/pages/staff/talents', chat: '/pages/messages/chat' }

/** 在沙箱里跑页面的 script setup：导入一律先给永远不返回的函数，再用 stubs 覆盖用得到的那几个（和 other-forms 测试同一套） */
function runSetup(rel, stubs) {
  const d = compiler.parse(src(rel), { filename: rel }).descriptor
  const source = d.scriptSetup.content
  const ast = compiler.babelParse(source, { sourceType: 'module' })
  const body = ast.program.body.filter(n => n.type !== 'ImportDeclaration').map(n => source.slice(n.start, n.end)).join('\n')
  const sandbox = { console, setTimeout, clearTimeout, setInterval: () => 0, clearInterval() {} }
  for (const n of ast.program.body.filter(n => n.type === 'ImportDeclaration')) for (const s of n.specifiers) sandbox[s.local.name] = () => new Promise(() => {})
  Object.assign(sandbox, { ref: vue.ref, computed: vue.computed, watch: vue.watch, reactive: vue.reactive, onShow() {}, onHide() {}, onUnload() {}, onUnmounted() {} }, stubs)
  vm.createContext(sandbox)
  const scope = vue.effectScope()
  scope.run(() => vm.runInContext(body, sandbox, { filename: rel + ':script-setup' }))
  return { run: code => vm.runInContext(code, sandbox), json: code => plain(vm.runInContext(code, sandbox)), stop: () => scope.stop(), template: d.template.content, script: source, styles: d.styles.map(x => x.content).join('\n') }
}

const TASKS = [{ jobId: 5, title: '探店笔记', statusLabel: '招募中', applied: 3, waiting: 1 }, { jobId: 6, title: '短视频', statusLabel: '已到期', applied: 0, waiting: 0 }]
const PEOPLE = [{ appId: 31, name: '王*', statusLabel: '待验收', lastSubmitTime: '11-02 10:00' }, { appId: 32, name: '李*', statusLabel: '进行中', noMaterial: true }]

/** 页面沙箱：记下 toast / 跳转 / 弹窗 / 请求，roles 决定是商家、专员还是别的 */
function page(stubs = {}) {
  const log = { toasts: [], confirms: [], sheets: [], prompts: [], alerts: [], backs: 0, gone: [], loaded: [], people: [], payouts: [], posts: [], uploads: [], created: [] }
  let onLoad = null
  const s = vue.ref(1)
  const h = runSetup(PAGE, {
    R, useScreen: (n, o) => { onLoad = o.onLoad; return s }, ensureSession: async () => {}, currentStaffStoreId: () => 102, onlineStaff: { value: false }, merchantStaff: { value: false },
    todayCn: () => '2026-11-03', shiftDate: (d, n) => '2026-11-10', toast: m => log.toasts.push(m), errText: (e, d) => (e && e.message) || d,
    confirm: async (t, m) => { log.confirms.push(m); return true }, sheet: async (l) => { log.sheets.push(plain(l)); return 0 }, prompt: async (t) => { log.prompts.push(t); return '' }, alert: async (t, m) => { log.alerts.push(t) },
    go: u => log.gone.push(u), back: () => { log.backs++ }, scrollToField() {}, lockPageScroll() {},
    whenColumns: FORM.whenColumns, whenIndex: FORM.whenIndex, whenPicked: FORM.whenPicked,
    apiOnlineTasks: async () => ({ data: TASKS }),
    apiOnlineTask: async (id, store) => { log.loaded.push([id, store]); return { data: { jobId: id, title: 'T' + id, skills: [], requirements: [], hasExt: true, reopenable: true, canReopen: true, reopenDeadline: '2026-11-12 18:00' } } },
    apiOnlineAssignments: async (id, store) => { log.people.push([id, store]); return { data: PEOPLE } },
    apiOnlineAssignment: async (appId) => ({ data: { appId, jobId: 5, storeId: 102, title: 'T5', latest: { status: 'submitted' } } }),
    apiOnlinePayout: async (appId, body) => { log.payouts.push([appId, plain(body)]); return { data: { appId, settlement: { status: 'payout_registered' } } } },
    apiOnlineCreate: async (p) => { log.created.push(plain(p)); return { data: { jobId: 88, message: '已提交平台审核' } } },
    post: async (url, body) => { log.posts.push([url, plain(body)]); return { msg: '已继续开启' } },
    chooseImage: async () => '/tmp/voucher.jpg', uploadTo: async (url, p) => { log.uploads.push([url, p]); return { data: { url: '/upload/v.jpg' } } },
    absUrl: (u) => u, uni: { previewImage() {}, reLaunch() {} },
    ...stubs
  })
  return { ...h, log, s, load: async (q) => { await onLoad(q); await flush(); await flush() } }
}

test('改过的页面能编译；online-jobs.vue 整文件 LF、k-online-work.vue 整文件 CRLF，都没有 BOM', () => {
  for (const rel of [PAGE, WORK]) {
    const d = compiler.parse(src(rel), { filename: rel }).descriptor
    const t = compiler.compileTemplate({ source: d.template.content, filename: rel, id: 'x' })
    assert.deepEqual(t.errors, [], rel)
    assert.ok(compiler.compileScript(d, { id: 'x' }).content.length > 0, rel)
    assert.ok(!raw(rel).startsWith('﻿'), rel + ' 没有 BOM')
  }
  assert.ok(!raw(PAGE).includes('\r'), 'online-jobs.vue 整文件 LF')
  const w = raw(WORK)
  assert.ok(w.includes('\r\n') && w.split('\r\n').length === w.split('\n').length, 'k-online-work.vue 整文件 CRLF')
  assert.ok(!/\r\r/.test(w))
})

// ---------------------------------------------------------------- M2 任务列表 → 详情 → 接单人一人一行

test('M2 模板：第 2 屏是任务列表（报名 / 待验收）和带接单人行的详情；两个弹窗（pickTask / pickAssignment / pickPaged）都没了；商家藏「按技能找人」', (t) => {
  const h = page()
  t.after(h.stop)
  const tpl = h.template
  assert.match(tpl, /<view v-else-if="s === 2" class="k-body k-pad-tab" :class="task \? 'detail-page' : 'list-page'">/)
  assert.match(tpl, /<view v-for="\(tk, ti\) in tasks" :key="tk\.jobId" class="task-card" hover-class="k-press" @click="openTaskCard\(ti\)">/)
  assert.match(tpl, /报名 \{\{ tk\.applied \|\| 0 \}\} 人<\/text><text :class="Number\(tk\.waiting\) \? 'k-alert' : 'k-meta'">待验收 \{\{ tk\.waiting \|\| 0 \}\}<\/text>/)
  assert.match(tpl, /<view v-for="pp in people" :key="pp\.appId" class="person" hover-class="k-press" @click="openAssignment\(pp\.appId\)">/)
  assert.match(tpl, /\{\{ pp\.statusLabel \}\}\{\{ pp\.noMaterial \? ' · 未发素材' : '' \}\}\{\{ pp\.lastSubmitTime \? ' · 最后提交 ' \+ pp\.lastSubmitTime : '' \}\}/)
  assert.match(tpl, /<view class="all-tasks" hover-class="k-press" @click="showTaskList">/)
  // 标题不再能点、底下没有「查看交付」按钮
  assert.match(tpl, /<view class="hero__title"><text class="field-text">\{\{ T\.title \|\| '—' \}\}<\/text>/)
  assert.doesNotMatch(tpl, /pickTask|pickAssignment|查看交付（/)
  assert.doesNotMatch(h.script, /pickPaged|function pickTask|function pickAssignment/)
  assert.match(tpl, /<view v-if="!onlineStaff && !merchantStaff" class="k-row k-gap4" hover-class="k-press" @click="findTalents">/)
  // 能点的 view 都有 hover-class（老年用户：大块能点，不靠手势）
  const block = tpl.slice(tpl.indexOf('<view v-else-if="s === 2"'), tpl.indexOf('<view v-else-if="s === 3"'))
  assert.deepEqual([...block.matchAll(/<view\b[^>]*@click[^>]*>/g)].map(m => m[0]).filter(x => !x.includes('hover-class')), [])
  assert.match(h.styles, /\.person \{[^}]*min-height: 56px/)
  assert.match(h.styles, /\.all-tasks \{[^}]*min-height: 44px/)
})

test('M2 流程：?s=2 停在任务列表，点一张卡进详情并取接单人；返回回列表；从交付页退回时重新取接单人', async (t) => {
  const h = page()
  t.after(h.stop)
  h.s.value = 2
  await h.load({ s: '2' })
  assert.equal(h.s.value, 2)
  assert.equal(h.run('task.value'), null, '先是列表，不自动打开第一条')
  assert.equal(h.run('tasks.value.length'), 2)
  assert.deepEqual(h.log.loaded, [])
  assert.equal(h.run('titles.value[1]'), '线上任务')

  await h.run('openTaskCard(0)')
  await flush(); await flush()
  assert.deepEqual(h.log.loaded, [[5, 102]])
  assert.deepEqual(h.log.people, [[5, 102]], '接单人随任务一起取')
  assert.equal(h.json('people.value').length, 2)
  assert.equal(h.run('titles.value[1]'), '任务详情')

  // 点一行进交付页（待验收的直接进验收屏 s=4），返回到详情时重新取接单人
  await h.run('openAssignment(31)')
  await flush(); await flush()
  assert.equal(h.s.value, 4)
  h.run('onBack()')
  assert.equal(h.s.value, 3)
  h.run('onBack()')
  await flush()
  assert.equal(h.s.value, 2)
  assert.equal(h.log.people.length, 2, '从交付页退回详情时刷新接单人')
  assert.equal(h.log.backs, 0)

  // 从列表点进来的：返回回列表（不离开页面），列表重新取一遍
  h.run('onBack()')
  await flush()
  assert.equal(h.run('task.value'), null)
  assert.equal(h.log.backs, 0)
  assert.equal(h.s.value, 2)
  // 列表上再返回才离开页面
  h.run('onBack()')
  assert.equal(h.log.backs, 1)
})

test('M2 深链：带 jobId 进来直接落到那条任务（不弹列表），返回直接回来源页；详情上点「全部任务」能看列表', async (t) => {
  const h = page({ onlineStaff: { value: true } })
  t.after(h.stop)
  await h.load({ jobId: '6', storeId: '7' })
  assert.equal(h.s.value, 2)
  assert.equal(h.run('task.value.jobId'), 6)
  assert.deepEqual(h.log.loaded, [[6, 7]])
  assert.deepEqual(h.log.people, [[6, 7]], '接单列表按同一家门店取')
  h.run('onBack()')
  assert.equal(h.log.backs, 1, '不是从列表来的，返回回来源页')
  h.run('showTaskList()')
  await flush()
  assert.equal(h.run('task.value'), null)
  assert.equal(h.run('tasks.value.length'), 2)
})

// ---------------------------------------------------------------- M3 登记付款：一个底部面板

test('M3 登记付款：点按钮开面板（不弹方式菜单 / 流水号框 / 提示），凭证点格子选、选了就传；一个「登记付款」按钮提交，不再确认', async (t) => {
  const h = page()
  t.after(h.stop)
  const tpl = h.template
  assert.match(tpl, /<view v-if="payoutOpen" class="return-mask" @touchmove\.stop\.prevent>/)
  assert.match(tpl, /<view v-for="pm in payoutMethods" :key="pm" class="pay-methods__btn" :class="\{ on: payoutMethod === pm \}" hover-class="k-press-s" @click="payoutMethod = pm">/)
  assert.match(tpl, /<input class="pay-input" :value="payoutRef"[^>]*maxlength="64"/)
  assert.match(tpl, /<view class="pay-voucher" hover-class="k-press" @click="pickVoucher">/)
  assert.match(tpl, /@click="submitPayout" \/>/)
  assert.match(h.styles, /\.pay-methods__btn \{[^}]*min-height: 44px/)
  assert.match(h.styles, /\.pay-input \{[^}]*height: 44px/)

  h.run("a.value = { appId: 31, settlement: { status: 'pending_payout', amount: '¥50.00' }, canPay: true, payoutMethods: ['微信转账', '现金'] }")
  await h.run('onSettle()')
  assert.equal(h.run('payoutOpen.value'), true)
  assert.equal(h.run('payoutMethod.value'), '微信转账', '默认选第一个方式')
  assert.equal(h.run('payoutCorrecting.value'), false)
  assert.deepEqual([h.log.sheets, h.log.prompts, h.log.alerts], [[], [], []], '不再连弹四个系统弹窗')

  await h.run('submitPayout()')
  assert.match(h.run('payoutError.value'), /凭证/, '没凭证不能登记，错误写在面板里')
  assert.deepEqual(h.log.payouts, [])

  await h.run('pickVoucher()')
  assert.deepEqual(h.log.uploads, [['/app/upload/image', '/tmp/voucher.jpg']])
  assert.equal(h.run('payoutVoucher.value'), '/upload/v.jpg')
  h.run("payoutMethod.value = '现金'; payoutRef.value = ' NO-1 '")
  await h.run('submitPayout()')
  assert.deepEqual(h.log.payouts, [[31, { method: '现金', ref: 'NO-1', voucher: '/upload/v.jpg', correctionNote: '' }]])
  assert.deepEqual(h.log.confirms, [], '普通登记不再弹确认')
  assert.equal(h.run('payoutOpen.value'), false)
  assert.equal(h.log.toasts.at(-1), '已登记线下付款，等待对方确认收款')
  assert.equal(h.run('a.value.settlement.status'), 'payout_registered', '用服务端返回的结算状态')
})

test('M3 更正争议凭证：面板顶上写「这是更正」，说明必填，提交前保留一次确认（涉及钱）', async (t) => {
  const h = page()
  t.after(h.stop)
  assert.match(h.template, /<text v-if="payoutCorrecting" class="panel-hint k-alert">这是更正：/)
  h.run("a.value = { appId: 31, settlement: { status: 'disputed', amount: '¥50.00', method: '现金', ref: 'OLD' }, canPay: true, canCorrectPayout: true }")
  await h.run('onSettle()')
  assert.equal(h.run('payoutCorrecting.value'), true)
  assert.deepEqual([h.run('payoutMethod.value'), h.run('payoutRef.value'), h.run('payoutVoucher.value')], ['现金', 'OLD', ''], '方式、流水号带上原来的，凭证要重选')
  h.run("payoutVoucher.value = '/upload/v2.jpg'")
  await h.run('submitPayout()')
  assert.match(h.run('payoutError.value'), /核实与更正说明/)
  h.run("payoutNote.value = '已核实实付现金'")
  await h.run('submitPayout()')
  assert.equal(h.log.confirms.length, 1, '更正保留一次确认')
  assert.match(h.log.confirms[0], /原结算金额 ¥50\.00 不变/)
  assert.deepEqual(h.log.payouts[0][1], { method: '现金', ref: 'OLD', voucher: '/upload/v2.jpg', correctionNote: '已核实实付现金' })
  // 没权限的还是进不了面板
  const no = page()
  t.after(no.stop)
  no.run("a.value = { appId: 31, settlement: { status: 'disputed', amount: '¥50.00' }, canPay: true, canCorrectPayout: false }")
  await no.run('onSettle()')
  assert.equal(no.run('payoutOpen.value'), false)
  assert.equal(no.log.toasts.at(-1), '当前角色不能更正争议付款凭证')
})

// ---------------------------------------------------------------- M4 预计完成时间：默认 7 天后 18:00 + 一个滚轮

test('M4 预计完成时间：默认 7 天后 18:00；日历选日期、时间选择器选时刻', (t) => {
  const h = page()
  t.after(h.stop)
  assert.equal(h.run('form.value.deadline'), '2026-11-10 18:00')
  assert.equal(h.run('deadlineLabel.value'), '2026年11月10日 18:00')
  assert.match(h.template, /k-date-picker/)
  assert.match(h.template, /picker mode="time"/)
  assert.doesNotMatch(h.script, /askTime|DEADLINE_TIMES|confirmDeadlineDate/)
  assert.deepEqual(h.json('whenIndex(deadlineWhen.value, when.value.dates)'), [7, 18, 0], '滚轮停在当前值那几行')
  // 滚到 第 9 天 | 09 时 | 30 分
  h.run('setDeadline({ detail: { value: [9, 9, 6] } })')
  assert.equal(h.run('form.value.deadline'), '2026-11-12 09:30', '存的还是 yyyy-MM-dd HH:mm')
  assert.equal(h.run('deadlineLabel.value'), '2026年11月12日 09:30')
  assert.equal(h.run('when.value.dates.length'), 366)
})

// ---------------------------------------------------------------- M5 底栏写还差什么，提交不再确认

test('M5 底栏一直写着还差什么 / 可以提交；提交不弹「确认提交？」；流程一直写在表单最后，商家看到的是「袋鼠工作人员」', async (t) => {
  const h = page()
  t.after(h.stop)
  assert.match(h.template, /<view v-if="s === 1" class="fc-bar"><view class="fc-bar__todo"[^>]*hover-class="k-press" @click="showTodo"><text>\{\{ todoText \}\}<\/text><\/view>/)
  assert.match(h.template, /<text class="fc-footnote">\{\{ flowNote \}\}<\/text>/)
  assert.equal(h.run('todoText.value'), '还差：任务标题、交付物、单人佣金、验收标准（点这里去填）')
  assert.equal(h.run('tried.value'), false, '没点提交前不标红')
  h.run("form.value.title = 't'; setCommission('50')")
  assert.equal(h.run('todoText.value'), '还差：交付物、验收标准（点这里去填）')
  h.run("form.value.deliverables = 'd'; form.value.criteria = 'c'")
  assert.equal(h.run('todoText.value'), '必填的都填好了，可以提交')
  assert.equal(h.run('flowNote.value'), '佣金 ¥50.00 × 3 人，由门店在验收后线下结算。提交后由平台审核上架。')
  await h.run('publish()')
  assert.deepEqual(h.log.confirms, [], '不再弹确认框')
  assert.equal(h.log.created.length, 1)
  assert.equal(h.s.value, 2)

  const m = page({ merchantStaff: { value: true } })
  t.after(m.stop)
  assert.match(m.run('flowNote.value'), /袋鼠工作人员核实后上架/)
  assert.doesNotMatch(m.run('flowNote.value'), /商家服务人/)
  const o = page({ onlineStaff: { value: true } })
  t.after(o.stop)
  assert.match(o.run('flowNote.value'), /平台审核上架，并通知本店负责付款的人/)
  // 没填好点「还差」那行：标红并滚到第一项
  const n = page()
  t.after(n.stop)
  n.run('showTodo()')
  assert.equal(n.run('tried.value'), true)
  assert.deepEqual(Object.keys(n.json('ferr.value')), ['title', 'deliverables', 'commission', 'criteria'])
})

// ---------------------------------------------------------------- S2 继续开启用滚轮

test('S2 继续开启：默认值用服务端的 reopenDeadline（没有就 7 天后 18:00），同一个滚轮改，提交 yyyy-MM-dd HH:mm；不再手敲', async (t) => {
  const h = page()
  t.after(h.stop)
  await h.load({ jobId: '6' })
  assert.deepEqual(h.json('reopenPicked.value'), { date: '2026-11-12', time: '18:00' })
  assert.equal(h.run('reopenLabel.value'), '2026年11月12日 18:00')
  h.run('setReopen({ detail: { value: [10, 20, 0] } })')
  assert.deepEqual(h.json('reopenPicked.value'), { date: '2026-11-13', time: '20:00' })
  await h.run('reopenTask()')
  assert.deepEqual(h.log.posts[0][1], { deadline: '2026-11-13 20:00' })
  assert.match(h.log.posts[0][0], /\?storeId=102$/)
  assert.equal(h.log.toasts.at(-1), '已继续开启')
  assert.deepEqual(h.log.prompts, [])
  // 换一条任务后，选过的时间不带过去；服务端没给默认时就本机算 7 天后 18:00
  const none = page({ apiOnlineTask: async (id) => ({ data: { jobId: id, skills: [], requirements: [], reopenable: true, canReopen: true } }) })
  t.after(none.stop)
  await none.load({ jobId: '9' })
  assert.deepEqual(none.json('reopenPicked.value'), { date: '2026-11-10', time: '18:00' })
})

// ---------------------------------------------------------------- S3 工作台任务卡

test('S3 工作台任务卡直接带 jobId 进任务详情，页面不再弹接单人列表', () => {
  const w = src(WORK)
  assert.match(w, /const openTask = \(task\) => go\(R\.staffOnline \+ '\?jobId=' \+ task\.jobId\)/)
  assert.match(w, /2026-11-03 主人：简化/)
  assert.match(src(PAGE), /else if \(Number\(q\?\.jobId\)\) \{ await loadTask\(Number\(q\.jobId\), Number\(q\.storeId\) \|\| sid\(\)\); if \(!task\.value\) await loadTasks\(\); s\.value = 2 \}/)
})

// ---------------------------------------------------------------- 复查补的边角（2026-11-03）

test('复查：深链的任务取不到就退到任务列表（不停在空详情）；从交付页退回时任务没取到也取列表；服务端付款方式给空列表用默认的；接单人行的分隔线写法', async (t) => {
  // ?jobId 指向的任务已删 / 不属于这家店：提示后落到任务列表，列表是取过的
  const h = page({ apiOnlineTask: async () => { throw new Error('任务不存在') } })
  t.after(h.stop)
  await h.load({ jobId: '99' })
  assert.equal(h.s.value, 2)
  assert.equal(h.run('task.value'), null)
  assert.equal(h.run('tasks.value.length'), 2, '任务取不到时列表已取过，不是假的「还没有线上任务」')
  assert.equal(h.log.toasts.at(-1), '任务不存在')
  // 深链的接单（?appId）所属任务取不到：进验收屏，退回第 2 屏时取列表（旧的 !a.value?.jobId 挡着不取）
  const g = page({ apiOnlineTask: async () => { throw new Error('任务不存在') } })
  t.after(g.stop)
  await g.load({ appId: '31' })
  assert.equal(g.s.value, 4)
  assert.equal(g.run('a.value.jobId'), 5)
  g.run('onBack()'); g.run('onBack()')
  await flush(); await flush()
  assert.equal(g.s.value, 2)
  assert.equal(g.run('tasks.value.length'), 2)
  // 付款方式：服务端给空列表（或没给）时用默认 5 个，按钮组不会是空的
  const p = page()
  t.after(p.stop)
  p.run("a.value = { appId: 31, settlement: { status: 'pending_payout', amount: '¥50.00' }, canPay: true, payoutMethods: [] }")
  assert.deepEqual(p.json('payoutMethods.value'), ['银行转账', '微信转账', '支付宝转账', '现金', '其他'])
  await p.run('onSettle()')
  assert.equal(p.run('payoutMethod.value'), '银行转账')
  // 接单人一人一行：行与行之间的线用 .person + .person（.people 里第一个 view 是标题行，:first-of-type 对不上第一个人）
  assert.match(p.styles, /\.person \+ \.person \{ border-top: 1px solid var\(--k-line\); \}/)
  assert.doesNotMatch(p.styles, /\.person:first-of-type/)
})
