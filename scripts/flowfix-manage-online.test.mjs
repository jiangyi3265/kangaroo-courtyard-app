// 2026-10-14 发布前回归（20261013-flowfix，D 包）的小程序侧检查，node --test 直接跑，不构建、不发请求：
//   · R3-10 门店任务列表标题按正在看的那一周写（本周 / 下周 / 上周），换工照旧「门店任务」；
//   · R3-8  列表行上标出看的人自己的状态（我已认领 / 待我接受 / 我已完成）；
//   · R3-6  提前续保后，「保险与完成」页显示正在保障的保单，续保申请另起一行；
//   · R3-4  平台处理过介入申请后，交付页说明要等到什么时候才能再次请平台介入；
//   · 以及对应的后端口径（只做静态核对，行为由 ruoyi-kangaroo 的单测覆盖）。
// tasks.vue / contract.vue 跑的是真实的 script setup（接口一律挂起不返回）。
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'
import test from 'node:test'
import assert from 'node:assert/strict'

const APP = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const require = createRequire(path.join(APP, 'package.json'))
const compiler = require('@vue/compiler-sfc'), vue = require('vue')
const read = (p) => fs.readFileSync(path.join(APP, p), 'utf8').replace(/\r\n/g, '\n')
const JAVA = '../RuoYi-Vue/ruoyi-kangaroo/src/main/java/com/ruoyi/kangaroo/'

// 与 common/ui.js 同样的日期算法（按北京时间、只按日历日加减）
const pad2 = (n) => String(n).padStart(2, '0')
const todayCn = () => { const t = new Date(Date.now() + 8 * 3600000); return `${t.getUTCFullYear()}-${pad2(t.getUTCMonth() + 1)}-${pad2(t.getUTCDate())}` }
const shiftDate = (ymd, n) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd || '')
  if (!m) return ''
  const t = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]) + n * 86400000)
  return `${t.getUTCFullYear()}-${pad2(t.getUTCMonth() + 1)}-${pad2(t.getUTCDate())}`
}
const isYmd = (v) => /^\d{4}-\d{2}-\d{2}$/.test(v || '')

function load(file, extra = {}) {
  const parsed = compiler.parse(read(file), { filename: path.basename(file) })
  assert.equal(parsed.errors.length, 0)
  const source = parsed.descriptor.scriptSetup.content
  const ast = compiler.babelParse(source, { sourceType: 'module' })
  const body = ast.program.body.filter(n => n.type !== 'ImportDeclaration').map(n => source.slice(n.start, n.end)).join('\n')
  const sandbox = { console, Date, Math, Promise, JSON, setTimeout, clearTimeout, String, Number }
  for (const n of ast.program.body.filter(n => n.type === 'ImportDeclaration')) for (const s of n.specifiers) sandbox[s.local.name] = () => new Promise(() => {})
  Object.assign(sandbox, {
    ref: vue.ref, computed: vue.computed, watch: vue.watch, useScreen: () => vue.ref(1), onShow() {}, onHide() {}, onUnload() {},
    shiftDate, todayCn, isYmd, R: {}, hasStaffAccess: vue.computed(() => true), currentStaffStoreId: () => null
  }, extra)
  vm.createContext(sandbox)
  const scope = vue.effectScope()
  scope.run(() => vm.runInContext(body, sandbox, { filename: file + ':script-setup' }))
  return { run: code => vm.runInContext(code, sandbox), stop: () => scope.stop(), template: parsed.descriptor.template.content }
}

test('门店任务列表标题按正在看的那一周写', (t) => {
  const h = load('pages/manage/tasks.vue')
  t.after(h.stop)
  assert.match(h.template, /<k-topbar :title="s === 1 \? listTitle : titles\[s - 1\]"/)
  const today = todayCn()
  const mon = shiftDate(today, -((new Date(today + 'T00:00:00Z').getUTCDay() + 6) % 7))
  const title = (weekStart, isStaff = true) => {
    h.run(`list.value = { weekStart: ${JSON.stringify(weekStart)}, isStaff: ${isStaff}, canPublish: false, tabs: [], staffTasks: [], volunteerTasks: [] }`)
    return h.run('listTitle.value')
  }
  assert.equal(title(mon), '本周任务')
  assert.equal(title(shiftDate(mon, 7)), '下周任务')
  assert.equal(title(shiftDate(mon, -7)), '上周任务')
  assert.equal(title(shiftDate(mon, 21)), '门店任务')
  assert.equal(title(mon, false), '门店任务', '在店换工照旧叫门店任务')
  // 还没加载完：按链接里的周（可能不是周一）算
  h.run(`list.value = { tabs: [], staffTasks: [], volunteerTasks: [], isStaff: true }; weekStart.value = ${JSON.stringify(shiftDate(mon, 9))}`)
  assert.equal(h.run('listTitle.value'), '下周任务')
})

test('列表行标出自己在这条任务里的状态', () => {
  const tpl = read('pages/manage/tasks.vue')
  assert.match(tpl, /人已认领<text v-if="item\.mine" class="mine-tag">\{\{ item\.mine \}\}<\/text>/)
  assert.match(tpl, /<text v-if="item\.mine" class="mine-line">\{\{ item\.mine \}\}<\/text>/)
  const java = read(JAVA + 'ext/manage/KgTaskService.java')
  assert.match(java, /a\.app_user_id = :me limit 1\) my_status/)
  assert.match(java, /"accepted"\.equals\(my\) \? \(vol \? "我已认领" : "我已接受"\)/)
  // 自己已接受的先进「进行中」，已结束的不再进「待认领」
  const order = ['"accepted".equals(my)', '"done".equals(my)', '!ended && (pending > 0 || volOpen)']
  const at = order.map(s => java.indexOf(s))
  assert.ok(at.every((x, i) => x > 0 && (i === 0 || x > at[i - 1])), '分组顺序')
  assert.match(java, /if \(publish && LocalDateTime\.now\(\)\.isAfter\(time\(d, et, 18\)\)\)/)
})

test('提前续保后保险页显示正在保障的保单和续保申请', (t) => {
  const h = load('pages/jobs/contract.vue')
  t.after(h.stop)
  h.run(`c.value = { terms: [], arrival: {}, sign: null, insurance: { status: 'effective', policyNo: 'POL-t3', startDate: '2026-09-18', endDate: '2026-10-17',
    planName: '用工意外险', policyIssued: true, coverageStatus: 'active', statusLabel: '生效中',
    renewal: { status: 'pending', statusLabel: '待登记保单', coverageStatus: 'pending', startDate: '2026-10-18', endDate: '2026-11-16' } } }`)
  assert.equal(h.run('insTitle.value'), '生效中')
  assert.equal(h.run('insSub.value'), '当前保单保障到 2026-10-17，续保情况见下方')
  const rows = JSON.parse(JSON.stringify(h.run('policy.value')))
  assert.deepEqual(rows.map(r => r.label), ['保单号', '保单起保日期', '保障期限', '保障方案', '续保'])
  assert.equal(rows[0].value, 'POL-t3')
  assert.equal(rows[4].value, '待登记保单 · 10-18 起')
  h.run(`c.value.insurance.renewal = { statusLabel: '已驳回', coverageStatus: 'rejected', startDate: '2026-10-18' }`)
  assert.equal(JSON.parse(JSON.stringify(h.run('policy.value')))[4].value, '申请未通过，门店会重新办理')
  // 没有续保（或老服务端）：和原来一样四行
  h.run(`delete c.value.insurance.renewal`)
  assert.equal(h.run('policy.value').length, 4)
  assert.equal(h.run('insSub.value'), '按保单起止日期核对保障，下方信息以保险公司保单为准')
  const ins = read(JAVA + 'ext/staff/KgInsuranceService.java')
  assert.match(ins, /public static Map<String, Object> userCoverage\(KgJdbc db, Long appId\)/)
  assert.match(ins, /r\.put\("renewal", newest\)/)
})

test('平台处理过介入申请后，要等一段时间才能再次请平台介入', () => {
  const deliver = read('pages/jobs/deliver.vue')
  assert.match(deliver, /a\.escalateAgain \? '平台已处理你的介入申请，结果见消息' : '成果已交给门店验收'/)
  assert.match(deliver, /可以\{\{ a\.escalateAgain \? '再次' : '' \}\}请平台介入/)
  const java = read(JAVA + 'ext/staff/KgOnlineTaskService.java')
  assert.match(java, /status in \('resolved','rejected'\) and create_time >= :since"/)
  assert.match(java, /m\.put\("escalateAgain", escalateAgain\)/)
})

test('后台申报处理两个动作都写清楚这段话会原样发给谁；员工端报名详情带上线上接单的步骤', () => {
  const mod = read(JAVA + 'ext/manage/KgManageModule.java')
  assert.match(mod, /\.promptLabel\("resolve", "处理结果（会原样发到申报人的消息中心；线上任务的收款 \/ 验收申诉，门店也会收到这段话）"\)/)
  assert.match(mod, /\.promptLabel\("reject", "不予受理的原因（/)
  const ctl = read(JAVA + 'controller/app/AppStaffController.java')
  assert.match(ctl, /data\.putAll\(onlineTasks\.staffStage\(appId\)\)/)
})
