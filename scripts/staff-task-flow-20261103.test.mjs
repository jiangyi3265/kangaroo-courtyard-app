// 2026-11-03 主人：「任务派发，需要有个流转过程，不能只单向发送，派发任务，可以一键发送给所有全体员工。我还可以给某一个岗位，单独的发布任务」
// 「小院主理人，审核活动，线上任务，几天，是预期，过期了线上专员有个，增加一个继续开启的功能，线上任务的权限」。守住小程序这边：
//   · 管理员任务：有任务岗位的都有入口和提醒（合作商家不算）；先接收再做；能回复提问、申请延期、说明做不了；处理记录按时间排；
//   · 小院主理人在工作台看到本店待审核活动，审核页走 /app/staff/keeper/activities，要平台人工复核的只给驳回；
//   · 线上任务的「截止时间」改叫「预计完成时间」，到期停止接单的给「继续开启」。
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
const raw = (rel) => fs.readFileSync(path.join(APP, rel), 'utf8')
const src = (rel) => raw(rel).replace(/\r\n/g, '\n')
const sfc = (rel) => compiler.parse(src(rel), { filename: rel }).descriptor
const load = (rel) => import(pathToFileURL(path.join(APP, rel)).href)
const f = await load('pages/staff/task-flow-view.js')
const v = await load('pages/staff/request-view.js')
const { useRequestList } = await load('pages/staff/request-list.js')
const plain = (x) => (x === undefined ? undefined : JSON.parse(JSON.stringify(x)))
const flush = async () => { for (let i = 0; i < 8; i++) await new Promise(resolve => setImmediate(resolve)) }

function runSetup(rel, stubs) {
  const d = sfc(rel)
  const source = d.scriptSetup.content
  const ast = compiler.babelParse(source, { sourceType: 'module' })
  const body = ast.program.body.filter(n => n.type !== 'ImportDeclaration').map(n => source.slice(n.start, n.end)).join('\n')
  const sandbox = { console, setTimeout, clearTimeout, setInterval: () => 0, clearInterval() {} }
  for (const n of ast.program.body.filter(n => n.type === 'ImportDeclaration')) for (const s of n.specifiers) sandbox[s.local.name] = () => new Promise(() => {})
  Object.assign(sandbox, { ref: vue.ref, computed: vue.computed, watch: vue.watch, reactive: vue.reactive, onShow() {}, onHide() {}, onUnload() {}, onLoad() {}, onReachBottom() {}, onPullDownRefresh() {}, onBeforeUnmount() {}, getCurrentPages: () => [{}] }, stubs)
  vm.createContext(sandbox)
  const scope = vue.effectScope()
  scope.run(() => vm.runInContext(body, sandbox, { filename: rel + ':script-setup' }))
  return { run: code => vm.runInContext(code, sandbox), json: code => plain(vm.runInContext(code, sandbox)), stop: () => scope.stop(), template: d.template.content }
}

test('改过的页面和组件都能编译；文件换行保持一致', () => {
  for (const rel of ['pages/staff/platform-tasks.vue', 'pages/staff/service-activities.vue', 'pages/staff/online-jobs.vue', 'pages/staff/index.vue',
    'pages/staff/components/k-task-entry.vue', 'pages/staff/components/k-online-work.vue', 'pages/staff/components/k-service-work.vue', 'pages/staff/components/k-city-work.vue']) {
    const d = sfc(rel)
    const t = compiler.compileTemplate({ source: d.template.content, filename: rel, id: 'x' })
    assert.deepEqual(t.errors, [], rel)
    assert.ok(compiler.compileScript(d, { id: 'x' }).content.length > 0, rel)
  }
  for (const rel of ['pages/staff/index.vue', 'pages/staff/components/k-online-work.vue', 'pages/staff/platform-tasks.vue', 'pages/staff/service-activities.vue', 'pages/staff/online-jobs.vue', 'pages/staff/task-flow-view.js', 'common/staff-task-reminder.js',
    'pages/staff/components/k-service-work.vue', 'pages/staff/components/k-city-work.vue', 'pages/staff/components/k-task-entry.vue']) {
    const value = raw(rel), withoutCrlf = value.replace(/\r\n/g, '')
    assert.ok(!withoutCrlf.includes('\r'), rel + ' 不含单独 CR')
    assert.ok(!value.includes('\r\n') || !withoutCrlf.includes('\n'), rel + ' 不混用 CRLF 与 LF')
  }
})

test('提醒和入口：有任务岗位的员工都算，合作商家不算；弹窗按后台最近一步说', () => {
  const s = src('common/staff-task-reminder.js')
  const roles = s.match(/export const STAFF_TASK_ROLES = (\[.*\])/)[1]
  assert.deepEqual(JSON.parse(roles.replace(/'/g, '"')), ['manager', 'keeper', 'online_staff', 'merchant_service', 'city_lead'])
  const has = new Function('STAFF_TASK_ROLES', 'return ' + s.match(/export const hasStaffTaskRole = (.*)/)[1])(JSON.parse(roles.replace(/'/g, '"')))
  assert.equal(has([{ active: true, roleCode: 'keeper' }]), true)
  assert.equal(has([{ active: true, roleCode: 'merchant' }]), false)
  assert.equal(has([{ active: false, roleCode: 'manager' }]), false)
  assert.match(s, /hasStaffTaskRole\(experience\.account\.staffGrants\)/)
  for (const k of ['reject', 'reply', 'extend', 'reopen', 'reassign']) assert.match(s, new RegExp(k + ": \\['"))
  assert.match(s, /NOTICE\[rejected\.length \? 'reject' : first\.lastAction\]/)
  const index = src('pages/staff/index.vue')
  assert.match(index, /const hasManagerTasks = computed\(\(\) => hasStaffTaskRole\(experience\.account\?\.staffGrants\)\)/)
  // 线上专员、商家服务人、城市负责人的工作台也有入口（组件在 staff 分包里，显式引入）
  for (const rel of ['k-online-work.vue', 'k-service-work.vue', 'k-city-work.vue']) {
    const c = src('pages/staff/components/' + rel)
    assert.match(c, /<k-task-entry \/>/, rel)
    assert.match(c, /import KTaskEntry from '\.\/k-task-entry\.vue'/, rel)
  }
  assert.match(src('pages/staff/components/k-task-entry.vue'), /@click="go\(STAFF_TASK_PAGE\)"/)
})

test('纯逻辑：状态文字、下一步、动作按钮听服务端 can*、漏填先挡', async () => {
  assert.deepEqual(f.TASK_LABELS, { pending: '待接收', accepted: '进行中', submitted: '待审核', approved: '已完成', rejected: '已驳回', declined: '无法完成', closed: '已关闭' })
  assert.deepEqual(f.TASK_TABS.map(t => t.key), ['todo', 'submitted', 'approved', ''])
  assert.equal(f.nextStep('pending'), '去接收')
  assert.equal(f.nextStep('rejected'), '修改重交')
  assert.equal(f.nextStep('closed'), '查看任务')
  assert.deepEqual(f.taskActions({ canReply: true, canRequestExtend: true, canDecline: true }).map(a => a.key), ['reply', 'extend_request', 'decline'])
  assert.deepEqual(f.taskActions({ canReply: true }).map(a => a.key), ['reply'], '待审核只能回复')
  assert.deepEqual(f.taskActions(null), [])
  assert.equal(f.checkAct('reply', {}), '请填写回复内容或附上图片')
  assert.equal(f.checkAct('reply', { fileIds: [3] }), '')
  assert.equal(f.checkAct('decline', { content: ' ' }), '请填写无法完成的原因')
  assert.equal(f.checkAct('extend_request', { content: '等材料' }), '请选择希望延到的日期')
  assert.equal(f.checkAct('extend_request', { content: '等材料', dueDate: '2026-11-01' }, '2026-11-03'), '希望延到的日期不能早于今天')
  assert.equal(f.checkAct('extend_request', { content: '等材料', dueDate: '2026-11-08' }, '2026-11-03'), '')
  assert.equal(f.checkAct('reply', { content: 'x'.repeat(1001) }), '内容不能超过1000字')
  assert.equal(f.eventLine({ actorType: 'admin', actorName: 'admin', actionLabel: '调整截止日期', dueDate: '2026-11-10' }), '管理员 admin · 调整截止日期（2026-11-10）')
  assert.equal(f.eventLine({ actorType: 'staff', actorName: '小林', actionLabel: '接收任务' }), '小林 · 接收任务')
  const calls = []
  assert.equal(await f.keeperReviewCount(async (url, q) => { calls.push([url, q]); return { data: { total: 4, rows: [{}] } } }, 102), 4)
  assert.deepEqual(calls, [['/app/staff/keeper/activities', { storeId: 102, pageNum: 1, pageSize: 1 }]])
  assert.equal(f.ONLINE_REOPEN_API(9), '/app/staff/online/tasks/9/reopen')
  const now = Date.parse('2026-11-03T10:00:00')
  assert.equal(f.expectLabel('2026-11-05 18:00', now), '预计还要约 3 天')
  assert.equal(f.expectLabel('2026-11-01 18:00', now), '已过预计完成时间')
  assert.equal(f.expectLabel(null, now), '')
})

const TASK = (over = {}) => ({ taskId: 7, version: 3, noticeVersion: 1, title: '整理仓库', status: 'pending', storeName: '海边小院', createBy: 'admin', dueDate: '2026-11-10', description: '把仓库整理好', submissions: [],
  events: [{ eventId: 1, actorType: 'admin', actorName: 'admin', action: 'assign', actionLabel: '派发任务', createTime: '2026-11-03 09:00:00', images: [] }],
  canAccept: true, canSubmit: true, canReply: true, canRequestExtend: true, canDecline: true, ...over })
function tasksPage({ detail = TASK(), postFail, modal = true } = {}) {
  const log = { gets: [], posts: [], toasts: [], modals: [] }
  let loaded = null, shown = null
  const h = runSetup('pages/staff/platform-tasks.vue', {
    ...f, base: f.TASK_API, tabs: f.TASK_TABS, onLoad: fn => { loaded = fn }, onShow: fn => { shown = fn },
    experience: { account: { id: 1 } }, getSessionRevision: () => 1, getToken: () => 't', ensureSession: async () => {}, toast: m => log.toasts.push(m), back() {},
    staffTaskTodoCount: vue.ref(2), checkStaffTaskReminder() {}, absUrl: x => x,
    uni: { showModal: (o) => { log.modals.push(o.title); o.success({ confirm: modal }) }, stopPullDownRefresh() {} },
    get: async (url, q) => { log.gets.push([url, plain(q)]); return { data: url.endsWith('/7') ? detail : { rows: [], hasMore: false, pageNum: 1 } } },
    post: async (url, body) => { log.posts.push([url, plain(body)]); if (url.endsWith('/acknowledge')) return {}; if (postFail) throw postFail; return { data: TASK({ status: 'accepted', version: 4, canAccept: false }) } }
  })
  return { ...h, log, open: async () => { loaded({ taskId: '7' }); await shown(); await flush() } }
}

test('管理员任务：先接收；待接收时不出完成表单；接收带版本号走 /act', async (t) => {
  const h = tasksPage()
  t.after(h.stop)
  await h.open()
  assert.equal(h.run('canSubmit.value'), false, '待接收先接收')
  assert.deepEqual(h.json('actions.value').map(a => a.key), ['reply', 'extend_request', 'decline'])
  await h.run("act('accept')")
  assert.deepEqual(h.log.posts.find(p => p[0].endsWith('/act')), ['/app/staff/platform-tasks/7/act', { version: 3, action: 'accept', content: '', fileIds: [], dueDate: '' }])
  assert.equal(h.run('task.value.status'), 'accepted')
  assert.equal(h.run('canSubmit.value'), true)
  assert.ok(h.log.toasts.includes('已接收，可以开始做了'))
  assert.match(h.template, /v-for="e in task\.events"/)
  assert.match(h.template, /处理记录/)
})

test('管理员任务：申请延期要日期和原因；做不了先确认；回复可以只发图片', async (t) => {
  const h = tasksPage({ detail: TASK({ status: 'accepted', canAccept: false }) })
  t.after(h.stop)
  await h.open()
  h.run("toggleAct('extend_request')")
  h.run("actText.value = '等供应商送货'")
  await h.run("act('extend_request')")
  assert.equal(h.log.posts.filter(p => p[0].endsWith('/act')).length, 0)
  assert.equal(h.log.toasts.at(-1), '请选择希望延到的日期')
  h.run("actDue.value = '2099-01-01'")
  await h.run("act('extend_request')")
  assert.deepEqual(h.log.posts.filter(p => p[0].endsWith('/act')).at(-1)[1], { version: 3, action: 'extend_request', content: '等供应商送货', fileIds: [], dueDate: '2099-01-01' })
  assert.equal(h.run('actKey.value'), '', '发完收起表单')

  const d = tasksPage({ detail: TASK({ status: 'accepted', canAccept: false }), modal: false })
  t.after(d.stop)
  await d.open()
  d.run("toggleAct('decline'); actText.value = '人手不够'")
  await d.run("act('decline')")
  assert.deepEqual(d.log.modals, ['确认做不了？'])
  assert.equal(d.log.posts.filter(p => p[0].endsWith('/act')).length, 0, '取消就不发')

  const r = tasksPage({ detail: TASK({ status: 'accepted', canAccept: false }) })
  t.after(r.stop)
  await r.open()
  r.run("toggleAct('reply'); actImages.value.push({ fileId: 9, url: '/x.jpg' })")
  await r.run("act('reply')")
  assert.deepEqual(r.log.posts.filter(p => p[0].endsWith('/act')).at(-1)[1].fileIds, [9])
})

test('管理员任务：别人刚动过（409）提示一声并同步最新状态，写的内容留着', async (t) => {
  const h = tasksPage({ detail: TASK({ status: 'accepted', canAccept: false }), postFail: Object.assign(new Error('任务已被更新，请刷新后再操作'), { code: 409 }) })
  t.after(h.stop)
  await h.open()
  h.run("toggleAct('reply'); actText.value = '仓库钥匙在哪'")
  const before = h.log.gets.length
  await h.run("act('reply')")
  await flush()
  assert.equal(h.log.toasts.at(-1), '任务已被更新，请刷新后再操作')
  assert.ok(h.log.gets.length > before, '重新取了详情')
  assert.equal(h.run('actText.value'), '仓库钥匙在哪')
})

const ACT = { activityId: 31, title: '手作课', cover: '', startTime: '2026-11-08 14:00:00', priceText: '免费', storeId: 102, storeName: '海边小院', creator: '小林', submitTime: '2026-11-03 09:00:00', status: 'pending', statusLabel: '待审核', needsPlatform: false }
function auditPage(rows = [ACT]) {
  const log = { gets: [], posts: [], toasts: [] }
  let boot = null
  const s = vue.ref(1)
  const h = runSetup('pages/staff/service-activities.vue', {
    ...v, KEEPER_ACTIVITIES_API: f.KEEPER_ACTIVITIES_API, useRequestList, useScreen: (n, o) => { boot = o.onLoad; return s }, ensureSession: async () => {}, hasStaffAccess: { value: true },
    currentStaffStoreId: () => 102, currentAlsoService: { value: false }, selectStaffStore: async () => {}, absUrl: x => x, mdhm: x => x, toast: m => log.toasts.push(m),
    errText: (e, d) => (e && e.message) || d, confirm: async () => true, prompt: async () => '时间不合适', uni: { stopPullDownRefresh() {} },
    get: async (url, params) => { log.gets.push([url, plain(params)]); return { data: { rows, total: rows.length, hasMore: false, pageNum: 1, pageSize: 50 } } },
    post: async (url, body) => { log.posts.push([url, plain(body)]); return { msg: '已通过' } }
  })
  return { ...h, s, log, boot: async (q = {}) => { boot(q); await flush() } }
}

test('小院主理人审核本店活动：?as=keeper 换成 keeper 接口；要平台复核的只给驳回；工作台有入口和优先处理', async (t) => {
  const h = auditPage()
  t.after(h.stop)
  await h.boot({ as: 'keeper', id: '31' })
  assert.equal(h.log.gets[0][0], '/app/staff/keeper/activities')
  assert.equal(h.s.value, 2)
  await h.run('audit(true)')
  assert.deepEqual(h.log.posts[0], ['/app/staff/keeper/activities/31/audit?storeId=102', { pass: true }])
  const plainPage = auditPage()
  t.after(plainPage.stop)
  await plainPage.boot({})
  assert.equal(plainPage.log.gets[0][0], '/app/staff/service/activities', '商家服务人照旧')
  assert.match(h.template, /<view v-if="!current\.needsPlatform" class="req-bar__btn">/)
  assert.match(h.template, /asKeeper \? '本店待审核活动'/)
  const index = src('pages/staff/index.vue')
  assert.match(index, /const canKeeperReview = computed\(\(\) => \(isKeeper\.value \|\| cityLeadDaily\.value\) && staffCan\('activities', 'audit'\)\)/)
  assert.match(index, /SERVICE_ACTIVITIES_PAGE \+ '\?as=keeper'/)
  assert.match(index, /keeperReviewCount\(get, store\)/)
  assert.match(index, /title: '场本店活动待审核'/)
})

test('线上任务：截止时间改叫预计完成时间；到期停止接单的给「继续开启」，默认时间听服务端', () => {
  const page = src('pages/staff/online-jobs.vue')
  assert.match(page, /<text class="fc-row__k">预计完成时间<\/text>/)
  assert.match(page, /<view><text>预计完成<\/text><text>\{\{ T\.deadline \|\| '—' \}\}<\/text><\/view>/)
  assert.match(page, /'距离预计完成'/)
  assert.doesNotMatch(page, /'距离截止'|<text>交付日期<\/text>/)
  assert.match(page, /<view v-if="T\.reopenable" class="reopen-card">/)
  assert.match(page, /<k-button v-if="T\.canReopen"[^>]*@click="reopenTask" \/>/)
  // 2026-11-03 简化：不再手敲时间，用「日期 | 时 | 分」滚轮，默认值仍听服务端 reopenDeadline（没有就 7 天后 18:00）
  assert.match(page, /<picker mode="multiSelector" :range="when\.cols" :value="whenIndex\(reopenPicked, when\.dates\)" @change="setReopen\(\$event\)">/)
  assert.match(page, /const w = toWhen\(T\.value\.reopenDeadline\)\s+return w\.date \? w : \{ date: shiftDate\(todayCn\(\), 7\), time: '18:00' \}/)
  assert.match(page, /const v = fromWhen\(reopenPicked\.value\)/)
  assert.match(page, /post\(ONLINE_REOPEN_API\(t\.jobId\) \+ '\?storeId=' \+ store, \{ deadline: v \}\)/)
})
