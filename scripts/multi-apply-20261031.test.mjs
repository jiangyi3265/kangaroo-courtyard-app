// 2026-10-31 主人：一键多投（报名成功页「再投几家」）。真接口、真页面的走查在 forms-batch/try/user-side/tools/，这里钉纯逻辑和模板。
import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { parse } from '@vue/compiler-sfc'
import * as M from '../pages/jobs/multi-apply.js'

const APP = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const src = (rel) => fs.readFileSync(path.join(APP, rel), 'utf8')
const norm = (s) => s.replace(/\r\n/g, '\n')
const sfc = (rel) => parse(src(rel)).descriptor

test('候选：当前岗位、投过（含已结束）、暂停、满员、线上任务都排除；名额没给的不算满员', () => {
  const rows = [
    { jobId: 1, jobType: 'volunteer', status: 'published', remainingCount: 3 },
    { jobId: 2, jobType: 'volunteer', status: 'published', remainingCount: 3 }, // 当前
    { jobId: 3, jobType: 'volunteer', status: 'published', remainingCount: 3 }, // 投过
    { jobId: 4, jobType: 'volunteer', status: 'paused', remainingCount: 3 },
    { jobId: 5, jobType: 'volunteer', status: 'published', remainingCount: 0 },
    { jobId: 6, jobType: 'online', status: 'published', remainingCount: 3 },
    { jobId: 7, jobType: 'parttime', status: 'published', remainingCount: null },
    { jobId: 8, jobType: 'fulltime', status: 'closed', remainingCount: 1 },
    null
  ]
  const applied = M.appliedSet([{ jobId: 3, status: 'withdrawn' }, { jobId: null }, {}])
  assert.deepEqual(M.candidates(rows, { currentJobId: '2', appliedJobIds: applied }).map(j => j.jobId), [1, 7])
  assert.deepEqual([...applied], ['3'], '没有 jobId 的行不算')
  assert.deepEqual(M.candidates(null, { currentJobId: 1, appliedJobIds: new Set() }), [])
})

test('到岗时间、时长：沿用刚才填的；早于这家的最早日期、短于这家的最短期限才调，365 封顶', () => {
  const today = '2026-10-31'
  // 沿用
  assert.deepEqual(M.planFor({ startDate: '2026-11-01', minDays: 30 }, { arrival: '2026-11-07', days: 30, today }), { arrival: '2026-11-07', days: 30, moved: false })
  // 这家开始得晚：调到开始日
  assert.deepEqual(M.planFor({ startDate: '2026-12-01', minDays: 30 }, { arrival: '2026-11-07', days: 30, today }), { arrival: '2026-12-01', days: 30, moved: true })
  // 这家开始日已过，刚才填的又是今天之前（跨天打开）：按今天
  assert.deepEqual(M.planFor({ startDate: '2026-01-01', minDays: 0 }, { arrival: '2026-10-30', days: 30, today }), { arrival: '2026-10-31', days: 30, moved: true })
  // 这家要待更久：调高
  assert.deepEqual(M.planFor({ startDate: '', minDays: 60 }, { arrival: '2026-11-07', days: 30, today }), { arrival: '2026-11-07', days: 60, moved: true })
  // 365 封顶（服务端只收 1-365）
  assert.equal(M.planFor({ minDays: 500 }, { arrival: '2026-11-07', days: 30, today }).days, 365)
  // 没写最短期限：沿用
  assert.equal(M.planFor({}, { arrival: '2026-11-07', days: 7, today }).days, 7)
  // 带时区的开始日只取年月日
  assert.equal(M.planFor({ startDate: '2026-12-01T00:00:00.000+08:00' }, { arrival: '2026-11-07', days: 7, today }).arrival, '2026-12-01')
})

test('勾选：再点取消；满 5 家不加', () => {
  const j = (id) => ({ jobId: id })
  let picks = []
  for (const id of [1, 2, 3, 4, 5]) picks = M.togglePick(picks, j(id)).picks
  assert.equal(picks.length, M.MAX_PICK)
  const r = M.togglePick(picks, j(6))
  assert.equal(r.limited, true)
  assert.equal(r.picks.length, 5)
  assert.deepEqual(M.togglePick(picks, j('3')).picks.map(x => x.jobId), [1, 2, 4, 5], '字符串编号也认')
})

test('卡片一行：城市 · 类型 · 最短期限；确认时每家写日期和时长', () => {
  assert.equal(M.cardMeta({ city: '湘潭·湖南省', jobType: 'parttime', minDays: 7, minDaysText: '7天起' }), '湘潭 · 兼职 · 7天起')
  assert.equal(M.cardMeta({ city: '平潭', jobType: 'volunteer', minDays: null, minDaysText: '不限' }), '平潭 · 换工 · 不限')
  assert.equal(M.cardMeta({ jobType: 'fulltime' }), '全职')
  assert.equal(M.planText({ arrival: '2026-11-07', days: 30 }), '11月7日 · 一个月')
  assert.equal(M.planText({ arrival: '2026-11-07', days: 20 }), '11月7日 · 20天')
})

const failing = (message, code) => Object.assign(new Error(message), { code })
const rowsOf = (n) => Array.from({ length: n }, (_, i) => M.makeRow({ jobId: i + 1, title: '岗位' + (i + 1) }, { arrival: '2026-11-07', days: 30, moved: false }))

test('串行投递：一家失败不影响别家；已报名算「之前投过」；不并发', async () => {
  const rows = rowsOf(5)
  const seen = []
  let running = 0
  let maxRunning = 0
  const r = await M.submitAll(rows, async (row) => {
    running++
    maxRunning = Math.max(maxRunning, running)
    seen.push(row.jobId)
    await new Promise(resolve => setTimeout(resolve, 2))
    running--
    if (row.jobId === 2) throw failing('该岗位名额已满', 500)
    if (row.jobId === 4) throw failing('你已报名该岗位，请勿重复报名', 500)
    return { data: { appId: 100 + row.jobId } }
  })
  assert.equal(maxRunning, 1, '同一时间只有一个请求')
  assert.deepEqual(seen, [1, 2, 3, 4, 5], '第 2 家失败，第 3 家照发')
  assert.deepEqual(rows.map(x => x.state), ['done', 'failed', 'done', 'applied', 'done'])
  assert.equal(rows[0].appId, 101)
  assert.equal(rows[1].msg, '该岗位名额已满')
  assert.equal(M.stateText(rows[1]), '该岗位名额已满', '失败写服务端原话')
  assert.equal(M.stateText(rows[3]), '之前投过')
  assert.equal(M.stateText(rows[0]), '已投递')
  assert.deepEqual({ stopped: r.stopped, done: r.done, applied: r.applied, failed: r.failed, skipped: r.skipped }, { stopped: '', done: 3, applied: 1, failed: 1, skipped: 0 })
  assert.equal(M.summaryText(r), '已投递 4 家，1 家没投上')
})

test('每一行都报状态：waiting → sending → 结果，页面才能逐家显示', async () => {
  const rows = rowsOf(1)
  assert.equal(rows[0].state, 'waiting')
  const states = []
  await M.submitAll(rows, async () => ({ data: { appId: 1 } }), (row) => states.push(row.state))
  assert.deepEqual(states, ['sending', 'done'])
})

test('登录失效：这家和后面的都不发，标 loginHandled（登录框由页面问，不弹两个）', async () => {
  const rows = rowsOf(3)
  const err = failing('未登录或登录已失效', 401)
  let calls = 0
  const r = await M.submitAll(rows, async () => { calls++; throw err })
  assert.equal(calls, 1)
  assert.equal(err.loginHandled, true)
  assert.equal(r.stopped, 'login')
  assert.deepEqual(rows.map(x => x.state), ['skipped', 'skipped', 'skipped'])
  assert.equal(M.stateText(rows[0]), '未提交')
})

test('太频繁（429）：这家写原话，后面的「未提交」', async () => {
  const rows = rowsOf(3)
  let calls = 0
  const r = await M.submitAll(rows, async () => { calls++; throw failing('提交报名过于频繁，请稍后再试', 429) })
  assert.equal(calls, 1)
  assert.equal(r.stopped, 'limit')
  assert.deepEqual(rows.map(x => x.state), ['failed', 'skipped', 'skipped'])
  assert.equal(rows[0].msg, '提交报名过于频繁，请稍后再试')
})

test('离开页面：后面的不发，已成功的不受影响', async () => {
  const rows = rowsOf(3)
  let left = false
  const r = await M.submitAll(rows, async () => { left = true; return { data: { appId: 9 } } }, () => {}, () => left)
  assert.deepEqual(rows.map(x => x.state), ['done', 'skipped', 'skipped'])
  assert.equal(r.stopped, 'leave')
})

test('重试：用第一次的 idemKey；已成功的不再发；两行的 idemKey 不同', async () => {
  const rows = rowsOf(2)
  assert.notEqual(rows[0].idemKey, rows[1].idemKey)
  assert.match(rows[0].idemKey, /^1-\d+-[a-z0-9]+$/)
  const keys = []
  let fail = true
  const submit = async (row) => {
    keys.push(row.idemKey)
    if (row.jobId === 2 && fail) throw failing('网络连接失败，请检查网络后重试', -1)
    return { data: { appId: row.jobId } }
  }
  await M.submitAll(rows, submit)
  assert.equal(rows[1].state, 'failed')
  fail = false
  await M.submitAll(rows, submit)
  assert.deepEqual(rows.map(x => x.state), ['done', 'done'])
  assert.deepEqual(keys, [rows[0].idemKey, rows[1].idemKey, rows[1].idemKey], '第一家不重发，第二家复用同一个键')
})

test('结果提示语', () => {
  assert.equal(M.summaryText({ done: 5, applied: 0, failed: 0, skipped: 0 }), '已投递 5 家')
  assert.equal(M.summaryText({ done: 0, applied: 2, failed: 0, skipped: 0 }), '都已经投过了')
  assert.equal(M.summaryText({ done: 0, applied: 0, failed: 2, skipped: 1 }), '这次没投上，可以看看原因再重试')
})

test('取列表：滤完不够自动再取一页，最多 3 页；够了就停；hasMore 老接口没有时按 total 算', async () => {
  const page = (ids, hasMore) => ({ rows: ids.map(jobId => ({ jobId })), hasMore })
  const asked = []
  let r = await M.collectCandidates(async (p) => { asked.push(p); return page(p === 1 ? [1] : p === 2 ? [2, 2] : [3], true) }, { need: 6 })
  assert.deepEqual(asked, [1, 2, 3], '滤完不够最多连取 3 页')
  assert.deepEqual(r.rows.map(j => j.jobId), [1, 2, 3], '翻页时重复的只算一次')
  assert.equal(r.pageNum, 3)
  assert.equal(r.hasMore, true)
  asked.length = 0
  r = await M.collectCandidates(async (p) => { asked.push(p); return page([1, 2, 3, 4, 5, 6, 7], true) }, { need: 6, startPage: 4 })
  assert.deepEqual(asked, [4], '够了就不再取')
  assert.equal(r.pageNum, 4)
  asked.length = 0
  r = await M.collectCandidates(async (p) => { asked.push(p); return { rows: [{ jobId: p }], total: 40 } }, { need: 6, keep: () => [] })
  assert.deepEqual(asked, [1, 2], '老接口没有 hasMore 时按 total：30 条一页，40 条取 2 页')
  assert.equal(r.hasMore, false)
  r = await M.collectCandidates(async () => ({ rows: [], hasMore: true }), { need: 6 })
  assert.equal(r.hasMore, false, '空页不再往下翻')
})

test('性别：简历写了才滤，其他和没填不传', () => {
  assert.equal(M.genderParam('女'), 'F')
  assert.equal(M.genderParam('男'), 'M')
  assert.equal(M.genderParam('其他'), undefined)
  assert.equal(M.genderParam(''), undefined)
})

test('限流够用：60 次/小时、同岗 12 次/天。如果有人调低，一次投 5 家可能被挡，要回来看这里', () => {
  const java = src('../RuoYi-Vue/ruoyi-kangaroo/src/main/java/com/ruoyi/kangaroo/controller/app/AppApplicationController.java')
  assert.match(java, /60, 3600/)
  assert.match(java, /12, 86400/)
  assert.ok(M.MAX_PICK <= 5)
})

test('报名页：线上任务不出；放在 v-if 链之外；老的按钮文字不动；勾选后底栏多一个「一键投递」', () => {
  const tpl = norm(sfc('pages/jobs/apply.vue').template.content)
  assert.match(tpl, /<multi-apply v-if="saved && !isOnline" :submit-tick="multiTick"/)
  // 放在 </template>（jobReady 那段）之后，不夹进 v-if 链
  assert.ok(tpl.indexOf('<multi-apply') > tpl.indexOf('class="ap-foot-tip"'))
  assert.ok(tpl.indexOf('<multi-apply') < tpl.indexOf('<k-bottom'))
  assert.match(tpl, /:label="saved \? '查看审核进度' : submitting \? '提交中…' : \(isOnline \? '确认提交申请' : '确认投递'\)"/)
  assert.match(tpl, /<view v-if="saved && pickedCount" class="k-flex1 ap-two">/)
  assert.match(tpl, /:label="multiBusy \? '投递中…' : '一键投递（' \+ pickedCount \+ ' 家）'"/)
  // 投递途中不能点「查看审核进度」把页面换掉（换掉就不再发下一家）
  assert.match(tpl, /:disabled="submitting \|\| multiBusy \|\| \(!saved && !canSubmit\)"/)
  const s = src('pages/jobs/apply.vue')
  assert.match(s, /const multiTick = ref\(0\)/)
  assert.match(s, /const pickedCount = ref\(0\)/)
  assert.match(s, /const multiBusy = ref\(false\)/)
  assert.match(s, /const multiSubmit = /)
})

test('组件：点文字进详情、点圆圈勾选、提交前确认、只传四样、不进主包', () => {
  const d = sfc('pages/jobs/components/multi-apply.vue')
  const tpl = d.template.content
  const s = d.scriptSetup.content
  assert.match(tpl, /class="ma-card__main"[^>]*@click="openJob\(jobItem\)"/)
  assert.match(tpl, /class="ma-card__pick"[^>]*@click\.stop="toggle\(jobItem\)"/)
  assert.match(tpl, /hover-class="k-press-s" @click\.stop="retry\(rowItem\)"/)
  // 失败写原话；后面没发的写「未提交」，都能重试
  assert.match(tpl, /v-if="rowItem\.state === 'failed'" class="ma-result__msg">\{\{ rowItem\.stateText \}\}/)
  assert.match(tpl, /v-else-if="rowItem\.state === 'skipped'"[^>]*>\{\{ rowItem\.stateText \}\}/)
  // 提交前确认：逐家日期、调过的写明，点「确认投递」才发
  assert.match(tpl, /<text class="ma-sheet__title">投给这 \{\{ confirming\.length \}\} 家<\/text>/)
  assert.match(tpl, /v-for="planItem in confirming"/)
  assert.match(tpl, /\{\{ planItem\.planText \}\}/)
  assert.match(tpl, /<text v-if="planItem\.moved" class="ma-sheet__moved">已按这家调整<\/text>/)
  assert.match(tpl, /label="确认投递" @click="send"/)
  assert.doesNotMatch(s.slice(s.indexOf('function submit()'), s.indexOf('const closeConfirm')), /apiSubmitApplication|submitOne|runRows/, 'submit 只弹确认，不发请求')
  assert.match(s, /apiSubmitApplication\(\{ jobId: row\.jobId, arrival: row\.arrival, days: row\.days, idemKey: row\.idemKey \}\)/)
  assert.match(s, /bindShareAfterApply\(row\.jobId, row\.appId\)/)
  assert.match(s, /onShow\(/, '点进详情自己投了，回来要从列表消失')
  assert.match(s, /onUnmounted\(\(\) => \{ left = true \}\)/)
  assert.match(s, /watch\(\(\) => props\.submitTick, \(now, before\) => \{ if \(now !== before\) submit\(\) \}\)/)
  // v-for 别名不用单字母（check-wxml-bindings 的 findShadowedProps；项目检查不接受 l）
  for (const m of tpl.matchAll(/v-for="(?:\()?([A-Za-z_]+)/g)) assert.ok(m[1].length > 1, m[1])
  // 能点的 view 要有按下效果
  for (const m of tpl.matchAll(/<view\b[^>]*@click[^>]*>/g)) if (!/class="k-mask"/.test(m[0])) assert.match(m[0], /hover-class/, m[0])
  // 只用主包已有的模块，新逻辑都在 jobs 分包
  for (const m of s.matchAll(/from '(@\/[^']+)'/g)) assert.ok(['@/common/api.js', '@/common/share.js', '@/common/experience.js', '@/common/city-picker.js', '@/common/upload.js', '@/common/screen.js', '@/common/ui.js', '@/common/routes.js', '@/common/display-wording.js'].includes(m[1]), m[1])
  assert.match(s, /import \{ displayWording \} from '@\/common\/display-wording\.js'/, '复用主包已有的展示称呼工具')
  const logic = src('pages/jobs/multi-apply.js')
  assert.doesNotMatch(logic, /from '@\//, '纯函数，不引 @/')
  // 主包没有多投的新东西
  const pages = src('pages.json')
  assert.doesNotMatch(pages.slice(0, pages.indexOf('"subPackages"')), /itinerary|multi/)
  assert.doesNotMatch(src('common/api.js'), /after-apply|multi/)
  assert.doesNotMatch(src('common/routes.js'), /itinerary/)
})
