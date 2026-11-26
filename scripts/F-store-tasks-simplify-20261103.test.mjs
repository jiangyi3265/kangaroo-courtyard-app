// 2026-11-03 主人：简化门店任务的发布与验收（F-store-tasks 组，node --test 直接跑，不构建、不发请求）。
//   发布（tasks.vue s=2）：原来每项「菜单 → 系统弹窗」两步，发一条约 15 个弹窗；现在一张表直接填，底栏一直写着「还差：…」，提交不弹确认。
//   验收：原来「选人 → 填工时 → 选星 → 写评语 → 问传不传凭证」5–6 个弹窗；现在一个底部面板一次填完，只在结算前确认一次。
//   守住：提交给服务端的字段和接口一项不变（taskPayload / checkPayload），规则和原来一样（字数、工时范围、名额、人数上限）。
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'
import * as F from '../pages/manage/tasks-form.js'

const APP = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const read = (p) => fs.readFileSync(path.join(APP, p), 'utf8')
const tasks = read('pages/manage/tasks.vue')
const require = createRequire(path.join(APP, 'package.json'))
const compiler = require('@vue/compiler-sfc'), vue = require('vue')

// ---------------------------------------------------------------- 发布：提交内容一项不变

const filled = () => ({
  ...F.blankTask('2026-11-05'), taskId: null, title: ' 周六手工课协助 ', description: '帮老师发材料', roleName: '课程协助换工',
  scopeText: '签到登记；课堂协助\n课后整理；；', place: '二楼教室', priority: 'high', startTime: '13:00', endTime: '17:00', estHours: 4,
  skills: ['手工基础'], mode: 'volunteer', quota: 5, assignees: [], acceptRule: '材料齐全', note: '带围裙'
})

test('taskPayload：字段名、取值和改版前一模一样（POST /app/manage/tasks）', () => {
  const p = F.taskPayload(filled(), 7, true)
  assert.deepEqual(p, {
    taskId: null, storeId: 7, title: '周六手工课协助', description: '帮老师发材料', roleName: '课程协助换工',
    scope: ['签到登记', '课堂协助', '课后整理'], place: '二楼教室', priority: 'high', taskDate: '2026-11-05', startTime: '13:00', endTime: '17:00', estHours: 4,
    skills: ['手工基础'], assignMode: 'volunteer', quota: 5, assignees: [], acceptRule: '材料齐全', note: '带围裙', publish: true
  })
  assert.deepEqual(Object.keys(p), ['taskId', 'storeId', 'title', 'description', 'roleName', 'scope', 'place', 'priority', 'taskDate', 'startTime', 'endTime', 'estHours', 'skills', 'assignMode', 'quota', 'assignees', 'acceptRule', 'note', 'publish'])
  // 没有门店时照旧传 undefined（服务端用员工当前门店）；存草稿 publish=false
  const d = F.taskPayload({ ...filled(), mode: 'staff', assignees: [3, 5] }, null, false)
  assert.equal(d.storeId, undefined)
  assert.equal(d.publish, false)
  assert.deepEqual(d.assignees, [3, 5])
  assert.equal(d.assignMode, 'staff')
})

test('taskPayload：字数上限和原来一样（标题 64、说明 / 验收 / 补充 300、身份 32、地点 64、职责最多 6 条）', () => {
  const long = (n) => '字'.repeat(n + 20)
  const p = F.taskPayload({ ...filled(), title: long(64), description: long(300), roleName: long(32), place: long(64), acceptRule: long(300), note: long(300), scopeText: '1；2；3；4；5；6；7；8' }, 1, true)
  assert.equal(p.title.length, 64)
  assert.equal(p.description.length, 300)
  assert.equal(p.roleName.length, 32)
  assert.equal(p.place.length, 64)
  assert.equal(p.acceptRule.length, 300)
  assert.equal(p.note.length, 300)
  assert.deepEqual(p.scope, ['1', '2', '3', '4', '5', '6'])
})

test('formFromTask：编辑草稿时回填和原来的 fillForm 一样，已取消的人不带回，缺原始日期要报错', () => {
  const d = { taskId: 9, title: 'T', description: 'D', editRoleName: 'R', scope: ['a', 'b'], editPlace: 'P', taskDate: '2026-11-06T00:00:00', startTime: '09:00:00', endTime: '12:00:00',
    estHours: '3', priority: 'low', assignees: [{ userId: 1, nickname: '甲', status: 'accepted' }, { userId: 2, status: 'cancelled' }, { userId: 3, status: 'pending' }],
    skills: ['s'], assignMode: 'staff', quota: 2, acceptRule: 'A', editNote: 'N' }
  const f = F.formFromTask(d, '2026-11-04')
  assert.equal(f.taskId, 9)
  assert.equal(f.scopeText, 'a；b')
  assert.equal(f.taskDate, '2026-11-06')
  assert.equal(f.startTime, '09:00')
  assert.equal(f.endTime, '12:00')
  assert.equal(f.estHours, 3)
  assert.deepEqual(f.assignees, [1, 3])
  assert.deepEqual(f.assigneeNames, ['甲', '用户3'])
  assert.equal(f.mode, 'staff')
  assert.deepEqual(F.taskPayload(f, 7, true).scope, ['a', 'b'])
  assert.throws(() => F.formFromTask({ ...d, startTime: '' }), /缺少原始日期/)
  // 老草稿没写分配方式 / 名额：和原来一样默认指定员工、1 人
  const g = F.formFromTask({ ...d, assignMode: undefined, quota: 0 }, '2026-11-04')
  assert.equal(g.mode, 'staff')
  assert.equal(g.quota, 1)
})

test('还差什么：存草稿只要标题；发布时指定员工要有人、结束要晚于开始；底栏一句话', () => {
  const f = { ...filled(), title: '' }
  assert.deepEqual(F.taskErrKeys(f, false), ['title'])
  assert.equal(F.taskTodoText(f, true), '还差：任务标题')
  const staff = { ...filled(), mode: 'staff', assignees: [] }
  assert.deepEqual(F.taskErrKeys(staff, true), ['assignees'])
  assert.deepEqual(F.taskErrKeys(staff, false), [], '存草稿不要求指定员工')
  assert.equal(F.taskTodoText(staff, true), '还差：指定员工')
  assert.equal(F.taskTodoText(filled(), true), '都填好了，可以发布')
  const bad = { ...filled(), startTime: '17:00', endTime: '13:00' }
  assert.equal(F.taskTodoText(bad, true), '还差：结束时间（要晚于开始时间）')
  assert.equal(F.taskTodoText({ ...filled(), title: '', mode: 'staff' }, true), '还差：任务标题、指定员工')
})

test('加减号：预估工时 0.5–12 步长 0.5，换工名额 1–50；技能 12 字、最多 5 个、不重复', () => {
  assert.equal(F.stepHours(4, 1), 4.5)
  assert.equal(F.stepHours(0.5, -1), 0.5)
  assert.equal(F.stepHours(12, 1), 12)
  assert.equal(F.stepHours('', 1), 1)
  assert.equal(F.stepQuota(5, -1), 4)
  assert.equal(F.stepQuota(1, -1), 1)
  assert.equal(F.stepQuota(50, 1), 50)
  assert.deepEqual(F.addSkill([], ' 手工基础 '), { skills: ['手工基础'] })
  assert.equal(F.addSkill([], '  ').error, '先写上技能名')
  assert.equal(F.addSkill(['a', 'b', 'c', 'd', 'e'], 'f').error, '最多 5 个技能')
  assert.equal(F.addSkill(['手工基础'], '手工基础').error, '这个技能已经有了')
  assert.equal(F.addSkill([], '一二三四五六七八九十一二三四').skills[0].length, 12)
  assert.deepEqual(F.removeSkill(['a', 'b', 'c'], 1), ['a', 'c'])
  assert.equal(F.taskDateText('2026-11-05'), '11月5日（周四）')
  assert.equal(F.taskDateText(''), '请选择')
})

// ---------------------------------------------------------------- 验收：提交内容一项不变

const task = () => ({ taskId: 21, title: '周六手工课协助', timeText: '11月5日 13:00-17:00 · 4小时',
  assignees: [{ userId: 11, nickname: '甲', status: 'accepted' }, { userId: 12, status: 'accepted' }, { userId: 13, nickname: '丙', status: 'pending' }, { userId: 14, nickname: '丁', status: 'done' }] })

test('验收面板：只列进行中的人，预估工时先填进去，只有一个人时直接选上', () => {
  const c = F.blankCheck(task())
  assert.deepEqual(c.people, [{ userId: 11, name: '甲' }, { userId: 12, name: '用户12' }])
  assert.equal(c.userId, null)
  assert.equal(c.hours, 4)
  assert.equal(c.rating, 5)
  assert.deepEqual(c.proofs, [])
  const one = F.blankCheck({ ...task(), assignees: [{ userId: 11, nickname: '甲', status: 'accepted' }] })
  assert.equal(one.userId, 11)
  assert.equal(F.blankCheck({ taskId: 1, assignees: [] }).people.length, 0)
  assert.equal(F.estHoursOf('没写工时'), '')
})

test('checkPayload：字段名、取值和改版前一模一样（POST /app/manage/tasks/{id}/check）', () => {
  const c = { ...F.blankCheck(task()), userId: 12, hours: '3.5', rating: 4, comment: ' 细心负责 ' + '长'.repeat(300), proofs: ['/profile/a.jpg'] }
  const p = F.checkPayload(c)
  assert.deepEqual(Object.keys(p), ['userId', 'hours', 'rating', 'comment', 'proofs'])
  assert.equal(p.userId, 12)
  assert.equal(p.hours, 3.5)
  assert.equal(p.rating, 4)
  assert.equal(p.comment.length, 200)
  assert.ok(p.comment.startsWith('细心负责'))
  assert.deepEqual(p.proofs, ['/profile/a.jpg'])
  assert.deepEqual(F.checkPayload({ ...c, comment: '', proofs: undefined }).proofs, [])
})

test('验收面板还差什么：工时 0.5–24 最多一位小数、要选人、评语 200 字；结算前的确认框写清给谁记多少', () => {
  const c = F.blankCheck(task())
  assert.equal(F.checkTodoText(c), '还差：选一位接单人')
  c.userId = 11
  assert.equal(F.checkTodoText(c), '都填好了，点「验收通过」')
  for (const h of ['', '0', '25', '3.25', 'abc']) assert.ok(F.checkErrors({ ...c, hours: h }).hours, '工时 ' + JSON.stringify(h))
  for (const h of ['0.5', '24', 3.5, '8']) assert.equal(F.checkErrors({ ...c, hours: h }).hours, undefined, '工时 ' + JSON.stringify(h))
  assert.ok(F.checkErrors({ ...c, rating: 0 }).rating)
  assert.ok(F.checkErrors({ ...c, comment: '字'.repeat(201) }).comment)
  assert.equal(F.stepCheckHours(4, 1), 4.5)
  assert.equal(F.stepCheckHours(24, 1), 24)
  assert.equal(F.stepCheckHours('abc', -1), 0.5)
  assert.equal(F.checkConfirmText({ ...c, hours: '3.5', rating: 4, proofs: ['x'] }), '给 甲 记 3.5 小时、4 星（很好），凭证 1 张。验收通过后积分随即发放，不能撤回。')
  assert.equal(F.checkConfirmText({ ...c, userId: 999, hours: 2, rating: 5 }), '给 接单人 记 2 小时、5 星（非常好）。验收通过后积分随即发放，不能撤回。')
})

// ---------------------------------------------------------------- 页面：弹窗真的没了，接口没换

test('发布表单是页面内的输入框 / 方块 / 加减号，不再「菜单 → 系统弹窗」，提交不弹确认', () => {
  const tpl = compiler.parse(tasks, { filename: 'tasks.vue' }).descriptor.template.content
  const form = tpl.slice(tpl.indexOf('v-else-if="s === 2"'), tpl.indexOf('v-else-if="s === 3"'))
  assert.match(form, /class="fc-form publish"/)
  // 11 项都在表里：标题、说明、身份、职责、地点、优先级、工时、技能、名额、验收标准、补充说明
  for (const label of ['任务标题', '任务说明', '任务身份', '职责范围', '地点', '优先级', '预估工时', '所需技能', '换工名额', '验收标准', '补充说明']) assert.ok(form.includes(label), label)
  assert.match(form, /<input class="fc-input"[^>]*@input="f\.title = \$event\.detail\.value"/)
  assert.match(form, /<textarea v-if="editing === 'description'"/)
  assert.match(form, /<textarea v-if="editing === 'scope'"/)
  assert.match(form, /<textarea v-if="editing === 'accept'"/)
  assert.match(form, /<textarea v-if="editing === 'note'"/)
  assert.match(form, /v-for="pr in PRIORITIES"[^>]*@click="f\.priority = pr\[1\]"/)
  assert.match(form, /v-for="md in MODES"[^>]*@click="f\.mode = md\[1\]"/)
  assert.match(form, /@click="f\.estHours = stepHours\(f\.estHours, -1\)"/)
  assert.match(form, /@click="f\.quota = stepQuota\(f\.quota, 1\)"/)
  assert.match(form, /@confirm="pushSkill"/)
  assert.match(form, /<picker mode="time" :value="f\.startTime"/)
  assert.match(form, /<picker mode="time" :value="f\.endTime"/)
  // 底栏一直写着还差什么；两个按钮直接提交
  assert.match(form, /class="fc-bar__todo"[^>]*><text>\{\{ todoText \}\}<\/text>/)
  assert.match(form, /@click="save\(false\)"><text>存草稿<\/text>/)
  assert.match(form, /@click="save\(true\)"><text>发布任务<\/text>/)
  // 老的弹窗入口都没了
  for (const gone of ['editContent', 'editHours', 'editSkills', 'editAccept', 'editNote', 'pickVolunteer', 'pickDateTime', 'askTime', 'uploadCheckProofs']) assert.equal(tasks.includes(gone), false, gone + ' 还在')
  assert.doesNotMatch(tasks, /prompt\('任务标题/)
  assert.doesNotMatch(tasks, /prompt\('换工名额/)
  assert.doesNotMatch(tasks, /prompt\('实际工时/)
  assert.doesNotMatch(tasks, /sheet\(\['5 星/)
  // 发布表单有自己的底栏，底部导航让开
  assert.match(tpl, /<k-tabbar v-if="s !== 2"/)
  // 提交走的还是原来的接口和 payload 函数
  assert.match(tasks, /await apiTaskSave\(taskPayload\(x, storeId\.value, publish\)\)/)
  assert.match(tasks, /await apiTaskCheck\(c\.taskId, payload\)/)
  assert.match(tasks, /const payload = checkPayload\(c\)/)
  assert.match(tasks, /@import '\.\.\/staff\/form-clean\.scss';/)
})

test('验收是一个底部面板：人、工时、5 颗星、评语、凭证一次填完，结算前只确认一次', () => {
  const tpl = compiler.parse(tasks, { filename: 'tasks.vue' }).descriptor.template.content
  const pop = tpl.slice(tpl.indexOf('v-if="checkPop"'))
  assert.match(pop, /v-for="p in checkPop\.people"[^>]*@click="checkPop\.userId = p\.userId"/)
  assert.match(pop, /@click="checkPop\.hours = stepCheckHours\(checkPop\.hours, -1\)"/)
  assert.match(pop, /<input class="check-pop__hours" type="digit"/)
  assert.match(pop, /v-for="n in 5"[^>]*class="check-pop__star"[^>]*@click="checkPop\.rating = n"/)
  assert.match(pop, /name="star" :size="30" color="ochre" :fill="n <= checkPop\.rating"/)
  assert.match(pop, /<textarea v-if="editing === 'comment'"/)
  assert.match(pop, /@click="addProofs"/)
  assert.match(pop, /@click="submitCheck"><text>验收通过<\/text>/)
  assert.match(pop, /\{\{ checkTodo \}\}/)
  // 日历、指定员工、验收面板开着时都锁住页面滚动
  assert.match(tasks, /calendar \|\| staffPop \|\| checkPop \? 'overflow: hidden'/)
  // 结算前的那一次确认保留；上传失败不再问「还要不要验收」
  const script = compiler.parse(tasks, { filename: 'tasks.vue' }).descriptor.scriptSetup.content
  const sub = script.slice(script.indexOf('async function submitCheck'), script.indexOf('async function submitCheck') + 900)
  assert.match(sub, /await confirm\('验收通过', checkConfirmText\(c\)\)/)
  assert.equal((script.match(/await confirm\('验收通过'/g) || []).length, 1)
  assert.doesNotMatch(script, /仍然继续验收吗/)
  assert.match(script, /有 \$\{failed\} 张照片没传上去/)
  // 发布人菜单里点「验收执行人」直接开面板
  assert.match(script, /\r?\n  openCheck\(d\)\r?\n\}/)
  // 面板里点「添加」最多补到 6 张
  assert.match(script, /chooseImages\(CHECK_PROOF_MAX - c\.proofs\.length\)/)
})

// 页面的 script setup 真的跑一遍（接口一律挂起不返回），看表单状态和底栏文字
function load(file, extra = {}) {
  const parsed = compiler.parse(read(file), { filename: path.basename(file) })
  assert.equal(parsed.errors.length, 0)
  const source = parsed.descriptor.scriptSetup.content
  const ast = compiler.babelParse(source, { sourceType: 'module' })
  const body = ast.program.body.filter(n => n.type !== 'ImportDeclaration').map(n => source.slice(n.start, n.end)).join('\n')
  const sandbox = { console, Date, Math, Promise, JSON, setTimeout, clearTimeout, String, Number, Object, Array }
  for (const n of ast.program.body.filter(n => n.type === 'ImportDeclaration')) for (const s of n.specifiers) sandbox[s.local.name] = () => new Promise(() => {})
  const toasts = []
  Object.assign(sandbox, {
    ref: vue.ref, computed: vue.computed, watch: vue.watch, useScreen: () => vue.ref(1), onShow() {}, onHide() {}, onUnload() {},
    shiftDate: (d) => d, todayCn: () => '2026-11-04', isYmd: () => true, R: {}, hasStaffAccess: vue.computed(() => true), currentStaffStoreId: () => null,
    toast: (m) => toasts.push(m), ...F
  }, extra)
  vm.createContext(sandbox)
  const scope = vue.effectScope()
  scope.run(() => vm.runInContext(body, sandbox, { filename: file + ':script-setup' }))
  return { run: code => vm.runInContext(code, sandbox), stop: () => scope.stop(), toasts }
}

test('页面：底栏「还差」随填随变，点发布漏填只标红不提交，填好了直接提交原来的 payload', async (t) => {
  const calls = []
  const h = load('pages/manage/tasks.vue', { apiTaskSave: async (p) => { calls.push(p); return { data: { message: '任务已发布' } } } })
  t.after(h.stop)
  assert.equal(h.run('todoText.value'), '还差：任务标题')
  assert.equal(h.run('tried.value'), false)
  h.run(`save(true)`)
  assert.equal(h.run('tried.value'), true, '点了发布才标红')
  assert.equal(calls.length, 0, '漏填不提交')
  assert.equal(h.toasts.pop(), '还差：任务标题')
  assert.ok(h.run('errs.value.title'))
  h.run(`f.value.title = '周六手工课协助'; f.value.mode = 'staff'`)
  assert.equal(h.run('todoText.value'), '还差：指定员工')
  h.run(`f.value.assignees = [3]; f.value.assigneeNames = ['甲']; f.value.scopeText = '签到；协助'`)
  assert.equal(h.run('todoText.value'), '都填好了，可以发布')
  assert.equal(h.run('scopeCount.value'), 2)
  h.run(`skillDraft.value = '手工'; pushSkill()`)
  assert.deepEqual(JSON.parse(JSON.stringify(h.run('f.value.skills'))), ['手工'])
  assert.equal(h.run('skillDraft.value'), '')
  h.run(`storeId.value = 7; save(true)`)
  await new Promise(r => setTimeout(r, 0))
  assert.equal(calls.length, 1)
  assert.deepEqual(JSON.parse(JSON.stringify(calls[0])), { taskId: null, storeId: 7, title: '周六手工课协助', description: '', roleName: '', scope: ['签到', '协助'], place: '', priority: 'medium',
    taskDate: '2026-11-04', startTime: '13:00', endTime: '17:00', estHours: 4, skills: ['手工'], assignMode: 'staff', quota: 5, assignees: [3], acceptRule: '', note: '', publish: true })
  assert.equal(h.toasts.pop(), '任务已发布')
  assert.equal(h.run('s.value'), 1)
  assert.equal(h.run('f.value.title'), '', '发完清空')
})

test('页面：验收面板开 → 填 → 确认一次 → 提交原来的 payload；不确认就不提交', async (t) => {
  const calls = []
  let answer = false
  const h = load('pages/manage/tasks.vue', { apiTaskCheck: async (id, p) => { calls.push([id, p]); return {} }, confirm: async () => answer, apiTasks: async () => ({ data: {} }) })
  t.after(h.stop)
  h.run(`openCheck(${JSON.stringify(task())})`)
  assert.equal(h.run('checkTodo.value'), '还差：选一位接单人')
  h.run(`submitCheck()`)
  await new Promise(r => setTimeout(r, 0))
  assert.equal(calls.length, 0)
  assert.equal(h.toasts.pop(), '还差：选一位接单人')
  h.run(`checkPop.value.userId = 11; checkPop.value.hours = stepCheckHours(checkPop.value.hours, -1); checkPop.value.rating = 4; checkPop.value.comment = ' 很细心 '; checkPop.value.proofs.push('/profile/p.jpg')`)
  assert.equal(h.run('checkTodo.value'), '都填好了，点「验收通过」')
  h.run(`submitCheck()`)
  await new Promise(r => setTimeout(r, 0))
  assert.equal(calls.length, 0, '确认框点了取消不提交')
  assert.ok(h.run('checkPop.value'), '面板还开着')
  answer = true
  h.run(`submitCheck()`)
  await new Promise(r => setTimeout(r, 0))
  assert.equal(calls.length, 1)
  assert.deepEqual(JSON.parse(JSON.stringify(calls[0])), [21, { userId: 11, hours: 3.5, rating: 4, comment: '很细心', proofs: ['/profile/p.jpg'] }])
  assert.equal(h.run('checkPop.value'), null)
  assert.equal(h.toasts.pop(), '已验收，凭证 1 张，积分已发放')
  // 没有进行中的人：不开面板
  h.run(`openCheck({ taskId: 2, assignees: [{ userId: 1, status: 'pending' }] })`)
  assert.equal(h.run('checkPop.value'), null)
  assert.equal(h.toasts.pop(), '没有进行中的接单人')
})

// ---------------------------------------------------------------- 复查补的几条（2026-11-03）

test('复查：验收面板先用任务详情自带的 estHours，timeText 只作兜底；草稿缺日期时「编辑并发布」用提示说出来而不是没反应', async (t) => {
  assert.equal(F.blankCheck({ ...task(), estHours: 3.5 }).hours, 3.5)
  assert.equal(F.blankCheck({ ...task(), estHours: 0 }).hours, 4, 'estHours 为 0 时退回 timeText')
  assert.equal(F.blankCheck({ ...task(), estHours: 'x' }).hours, 4)
  const h = load('pages/manage/tasks.vue', { sheet: async () => 0, apiTasks: async () => ({ data: {} }) })
  t.after(h.stop)
  h.run(`publisherMenu({ taskId: 5, status: 'draft', title: '旧草稿', assignees: [] })`)
  await new Promise(r => setTimeout(r, 0))
  assert.match(h.toasts.pop() || '', /缺少原始日期/)
  assert.equal(h.run('s.value'), 1, '没回填成功就不进发布页')
})

test('复查：老年用户视角——能点的都不低于 44，输入框都有占位提示，主按钮 48', () => {
  const style = compiler.parse(tasks, { filename: 'tasks.vue' }).descriptor.styles[0].content
  assert.match(style, /\.chip-pop__chip \{[^}]*min-height: 44px/)
  assert.match(style, /\.check-pop__star \{ width: 44px; height: 44px/)
  assert.match(style, /\.check-pop__hours \{[^}]*height: 44px/)
  assert.match(style, /\.skill-add__btn \{[^}]*height: 48px/)
  const tpl = compiler.parse(tasks, { filename: 'tasks.vue' }).descriptor.template.content
  for (const m of tpl.matchAll(/<(input|textarea)\b[^>]*>/g)) assert.match(m[0], /placeholder="[^"]+"/, m[0].slice(0, 80) + ' 没有占位提示')
})

test('tasks-form.js 在 manage 分包里、不引主包、文件名不和页面同名', () => {
  const src = read('pages/manage/tasks-form.js')
  assert.doesNotMatch(src, /from '@\//)
  assert.doesNotMatch(src, /from '\.\.\/\.\.\/common/)
  assert.ok(!fs.existsSync(path.join(APP, 'pages/manage/tasks.js')))
  assert.match(read('pages.json'), /"root": "pages\/manage"/)
})
