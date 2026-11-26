// 给已发岗位补填筛选条件（10-16 跟进，主人要的入口）的回归（node --test，不需要构建、不发请求）。跑的是页面真实的 script setup，接口一律换成假函数：
//   · 员工端岗位列表：有「岗位管理·编辑」权限的人，线下岗位（草稿 / 招聘中 / 暂停）的卡片菜单多一项「补填筛选条件」；线上任务、已关闭、没权限的不出现；
//   · 顶上提示「N 个岗位还没填排班 / 住宿等条件，补上后更容易被用户筛到」，点「去补填」打开最新的那个没填的岗位（不在当前列表里也能打开）；
//   · 弹层和发布页同一组选项和规则：性别偏好只有换宿、住宿条件只有包住、最短在店 7 / 15 / 20 / 30 / 不限；打开时带出当前值；
//     保存调 PUT /app/staff/jobs/{id}/conditions（写在分包页面里，不进主包的 common/api.js），提示「已保存」，这一行立刻更新并重新拉列表；
//   · 弹层开着锁住页面滚动：小程序靠 page-meta（带上 s === 1），H5 锁 body（和岗位列表页 lockPageScroll 同一写法），关掉、离开本页还原。
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'
import test from 'node:test'
import assert from 'node:assert/strict'
import * as gender from '../common/job-gender.js'
import { parseRecruitmentText } from '../pages/staff/recruitment-text.js'

const APP = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const require = createRequire(path.join(APP, 'package.json'))
const compiler = require('@vue/compiler-sfc'), vue = require('vue')
const src = (rel) => fs.readFileSync(path.join(APP, rel), 'utf8').replace(/\r\n/g, '\n')
const flush = () => new Promise(resolve => setImmediate(resolve))
const plain = (v) => JSON.parse(JSON.stringify(v))

/** 按平台处理 // #ifdef / #ifndef / #endif（uni-app 条件编译），只认这里用到的单个平台名 */
function preprocess(code, platform) {
  const keep = []
  const out = []
  for (const line of code.split('\n')) {
    const m = /^\s*\/\/\s*#(ifdef|ifndef|endif)\b\s*([\w-]*)/.exec(line)
    if (m) {
      if (m[1] === 'endif') keep.pop()
      else keep.push(m[1] === 'ifdef' ? m[2] === platform : m[2] !== platform)
      continue
    }
    if (keep.every(Boolean)) out.push(line)
  }
  return out.join('\n')
}

/** 在沙箱里跑页面的 script setup：导入一律先给永远不返回的函数，再用 stubs 覆盖用得到的那几个 */
function runSetup(rel, stubs, platform) {
  const d = compiler.parse(src(rel), { filename: rel }).descriptor
  const source = preprocess(d.scriptSetup.content, platform)
  const ast = compiler.babelParse(source, { sourceType: 'module' })
  const body = ast.program.body.filter(n => n.type !== 'ImportDeclaration').map(n => source.slice(n.start, n.end)).join('\n')
  const sandbox = { console }
  for (const n of ast.program.body.filter(n => n.type === 'ImportDeclaration')) for (const s of n.specifiers) sandbox[s.local.name] = () => new Promise(() => {})
  Object.assign(sandbox, { ref: vue.ref, computed: vue.computed, watch: vue.watch, reactive: vue.reactive, onShow() {}, onHide() {}, onUnload() {} }, gender, stubs)
  vm.createContext(sandbox)
  const scope = vue.effectScope()
  scope.run(() => vm.runInContext(body, sandbox, { filename: rel + ':script-setup' }))
  return { run: code => vm.runInContext(code, sandbox), stop: () => scope.stop(), sandbox, template: d.template.content }
}

const ROWS = [
  // 老岗位：四项都空（服务端标了 conditionsMissing）
  { jobId: 15057, jobType: 'volunteer', status: 'published', statusLabel: '招聘中', title: '古城咖啡馆帮手', boardType: 'all', housing: true,
    genderPref: '', restMode: '', roomType: '', minDays: null, conditionsMissing: true },
  // 填过的兼职（不包住）
  { jobId: 15055, jobType: 'parttime', status: 'paused', statusLabel: '已暂停', title: '平潭咖啡馆兼职', boardType: 'none', housing: false,
    genderPref: '', restMode: '3-2', roomType: '', minDays: 7, conditionsMissing: false },
  { jobId: 15060, jobType: 'online', status: 'published', statusLabel: '招聘中', title: '剪辑任务', housing: false, conditionsMissing: false },
  { jobId: 15061, jobType: 'fulltime', status: 'closed', statusLabel: '已关闭', title: '已关闭的全职', housing: false, conditionsMissing: false }
]

function harness(platform = 'MP-WEIXIN', { rows = ROWS, missing = 3, missingJob = null, putFail = null, canEdit = true, edit = true } = {}) {
  const log = { sheets: [], toasts: [], puts: [], loads: 0, hides: [], unloads: [], shows: [] }
  const ctl = { sheetPick: -1, holdLoads: false }
  const document = { body: { style: { overflow: '' } } }
  let onLoad = null
  const h = runSetup('pages/staff/jobs.vue', {
    useScreen: (n, opts) => { onLoad = opts && opts.onLoad; return vue.ref(1) },
    onShareAppMessage() {},
    onShow: (fn) => log.shows.push(fn), onHide: (fn) => log.hides.push(fn), onUnload: (fn) => log.unloads.push(fn),
    ensureSession: async () => {}, hasStaffAccess: { value: true }, currentStaffStoreId: () => 107, staffCan: () => edit, absUrl: x => x,
    todayCn: () => '2026-10-16', shiftDate: () => '2026-10-23', isYmd: () => true, validateSalaryForm: () => '', salaryPayload: () => ({}),
    jobBenefits: (f) => ({ boardEnabled: typeof f.boardEnabled === 'boolean' ? f.boardEnabled : f.pay === 'board', salaryEnabled: false }),
    errText: (e, d) => (e && e.message) || d,
    toast: (m) => log.toasts.push(m),
    go() {}, back() {},
    sheet: async (opts) => { log.sheets.push([...opts]); return typeof ctl.sheetPick === 'function' ? ctl.sheetPick(opts) : ctl.sheetPick },
    apiStaffJobs: async () => { log.loads++; if (ctl.holdLoads) return new Promise(() => {}); return { data: { rows: plain(rows), canEdit, storeCert: false, storeAddress: '', conditionsMissingCount: missing,
      conditionsMissingJob: missingJob } } },
    apiStaffShareStats: async () => ({ data: {} }),
    put: async (url, data) => {
      log.puts.push([url, plain(data)])
      if (putFail) throw putFail
      return { msg: '已保存', data: { jobId: Number(url.split('/')[4]), ...data, restModeLabel: '做五休二', conditionsMissing: false } }
    },
    document
  }, platform)
  return { ...h, log, ctl, document, load: async () => { onLoad && onLoad({}); await flush(); await flush() } }
}
const row = (h, id) => JSON.parse(h.run('JSON.stringify(jobList.value.find(r => r.jobId === ' + id + '))'))
const sheetState = (h) => JSON.parse(h.run('JSON.stringify(condSheet.value)'))

test('全职招聘识别确认期间切换门店或重新打开表单，旧结果不会写入', async (t) => {
  const h = harness()
  t.after(h.stop)
  await h.load()
  let store = 107, finish
  Object.assign(h.sandbox, {
    experience: { account: { id: 1 } }, currentStaffStoreId: () => store, parseRecruitmentText,
    confirm: () => new Promise(resolve => { finish = resolve })
  })
  h.run("s.value = 2; formOpen.value = true; form.value = newForm('fulltime'); recruitmentText.value = '招聘岗位：前台'")
  const first = h.run('fillRecruitmentText()')
  store = 108
  finish(true)
  await first
  assert.equal(h.run('gen.value.title'), undefined)
  const second = h.run('fillRecruitmentText()')
  h.run("form.value = newForm('fulltime')")
  finish(true)
  await second
  assert.equal(h.run('gen.value.title'), undefined)
})

test('卡片菜单：线下岗位（草稿 / 招聘中 / 暂停）有「补填筛选条件」；线上任务、已关闭、没有编辑权限的不出现', async (t) => {
  const h = harness()
  t.after(h.stop)
  await h.load()
  const menu = async (j) => { await h.run('jobActions(' + JSON.stringify(j) + ')'); return h.log.sheets.at(-1) }
  // 招聘中 / 暂停的岗位菜单项多（系统菜单一页最多 6 项）：改地点 / 补条件 / 换照片 / 住宿与宠物收成一项，点了再选
  const EDIT_MORE = '改地点 / 筛选条件 / 照片 / 住宿…'
  const r = row(h, 15057)
  assert.ok((await menu(r)).includes(EDIT_MORE))
  assert.ok((await menu(r)).length <= 6)
  assert.ok((await menu({ ...r, rawStatus: 'paused' })).includes(EDIT_MORE))
  assert.ok((await menu({ ...r, rawStatus: 'draft' })).includes('补填筛选条件'), '草稿菜单项少，直接列出来')
  assert.ok(!(await menu(row(h, 15060))).includes('补填筛选条件'), '线上任务没有这些条件')
  const before = h.log.sheets.length
  await h.run('jobActions(' + JSON.stringify(row(h, 15061)) + ')')
  assert.equal(h.log.sheets.length, before, '已关闭的岗位没有菜单')
  h.run('canEdit.value = false')
  assert.ok(!(await menu(r)).includes('补填筛选条件'), '没有岗位编辑权限的角色不出现')
  // 选了这一项就打开弹层
  h.run('canEdit.value = true')
  h.ctl.sheetPick = (opts) => opts.indexOf(opts.includes('补填筛选条件') ? '补填筛选条件' : EDIT_MORE)
  await h.run('jobActions(' + JSON.stringify(r) + ')')
  assert.deepEqual(h.log.sheets.at(-1), ['修改工作地点', '补填筛选条件', '换岗位照片', '住宿与宠物'], '第二层：改地点、补条件、换照片、住宿与宠物（R4）挨着')
  assert.equal(sheetState(h).jobId, 15057)

  const staffOnly = harness('MP-WEIXIN', { edit: false })
  t.after(staffOnly.stop)
  await staffOnly.load()
  await staffOnly.run('jobActions(' + JSON.stringify(row(staffOnly, 15057)) + ')')
  assert.ok(!staffOnly.log.sheets.at(-1).includes('补填筛选条件'), '本店角色没有「岗位管理·编辑」')
  staffOnly.run('openConditions(' + JSON.stringify(row(staffOnly, 15057)) + ')')
  assert.equal(staffOnly.run('condSheet.value'), null)
  assert.deepEqual(staffOnly.log.toasts, ['当前角色没有岗位编辑权限'])
})

test('弹层带出当前值；选项、适用范围和发布页同一组（性别只有换宿，住宿只有包住）', async (t) => {
  const h = harness()
  t.after(h.stop)
  await h.load()
  h.run('openConditions(' + JSON.stringify(row(h, 15055)) + ')')
  assert.deepEqual(sheetState(h), { jobId: 15055, title: '平潭咖啡馆兼职', jobType: 'parttime', housing: false, genderPlan: '',
    draft: { genderPref: '', restMode: '3-2', roomType: '', minDays: 7 } })
  // 模板：和发布页同一组常量；性别偏好只在换宿时出、住宿条件只在包住时出；最短在店 不限 / 7 / 15 / 20 / 30
  const tpl = h.template
  assert.match(tpl, /v-if="condSheet\.genderPlan"[^>]*>招募计划：/)
  assert.match(tpl, /<template v-else-if="condSheet\.jobType==='volunteer'"><text class="cond-sheet__label">性别偏好<\/text><view class="seg three"><text v-for="genderItem in GENDER_OPTS"/)
  assert.match(tpl, /<text v-for="restItem in REST_MODES"[^>]*@click="toggleCond\('restMode', restItem\[1\]\)">/)
  assert.match(tpl, /<template v-if="condSheet\.housing"><text class="cond-sheet__label">住宿条件<\/text><view class="chip-pop__chips cond-sheet__chips"><text v-for="roomItem in ROOM_TYPES"/)
  assert.match(tpl, /<view class="seg five"><text v-for="dayItem in MIN_DAY_OPTS" :key="dayItem\[0\]" :class="\{active:\(condSheet\.draft\.minDays\|\|null\)===dayItem\[1\]\}"/)
  assert.deepEqual(plain(h.run('MIN_DAY_OPTS')).map(o => o[1]), [null, 7, 15, 20, 30])
  // 再点一下已选的排班 = 不填
  h.run("toggleCond('restMode', '3-2')")
  assert.equal(sheetState(h).draft.restMode, '')
  h.run("toggleCond('restMode', '5-2')")
  assert.equal(sheetState(h).draft.restMode, '5-2')
  // 老接口没给 housing：按同一规则自己算（换宿、包吃包住 / 包住宿算包住）
  h.run("openConditions({ jobId: 1, jobType: 'fulltime', rawStatus: 'published', boardType: 'room', title: 'x' })")
  assert.equal(sheetState(h).housing, true)
  h.run("openConditions({ jobId: 1, jobType: 'parttime', rawStatus: 'published', boardType: 'meal', title: 'x' })")
  assert.equal(sheetState(h).housing, false)
  // 后台填过的非常规天数（如 10 天）：选项里没有，提示写出来，原样保留
  h.run("openConditions({ jobId: 2, jobType: 'volunteer', rawStatus: 'published', housing: true, minDays: 10, title: 'y' })")
  assert.match(h.run('condHint.value'), /现在写的是最短在店 10 天/)
  assert.equal(sheetState(h).draft.minDays, 10)
  // 线上任务、已关闭的打不开
  h.run('closeConditions()')
  h.run('openConditions(' + JSON.stringify(row(h, 15060)) + ')')
  h.run('openConditions(' + JSON.stringify(row(h, 15061)) + ')')
  assert.equal(h.run('condSheet.value'), null)
  assert.deepEqual(h.log.toasts, ['线上任务没有这些条件', '岗位关闭后无法再改筛选条件'])
})

test('保存：PUT /app/staff/jobs/{id}/conditions，按发布同一规则收口；提示「已保存」，这一行立刻更新并重新拉列表', async (t) => {
  const h = harness()
  t.after(h.stop)
  await h.load()
  assert.equal(h.log.loads, 1)
  h.run('openConditions(' + JSON.stringify(row(h, 15057)) + ')')
  h.run("condSheet.value.draft.genderPref = 'F'; toggleCond('restMode', '5-2'); toggleCond('roomType', 'double'); condSheet.value.draft.minDays = 15")
  // 重新拉的列表先不让它回来：看这一行是不是先改过来了
  h.ctl.holdLoads = true
  await h.run('saveConditions()')
  // 不等重新拉列表，这一行先改过来（「待补条件」立刻消失）
  const r = row(h, 15057)
  assert.equal(r.restMode, '5-2')
  assert.equal(r.restModeLabel, '做五休二')
  assert.equal(r.conditionsMissing, false)
  await flush()
  assert.deepEqual(h.log.puts[0], ['/app/staff/jobs/15057/conditions', { genderPref: 'F', restMode: '5-2', roomType: 'double', minDays: 15 }])
  assert.ok(h.log.toasts.includes('已保存'))
  assert.equal(h.run('condSheet.value'), null, '保存后收起')
  assert.equal(h.log.loads, 2, '重新拉列表，顶上的数字跟着变')
  h.ctl.holdLoads = false

  // 兼职、不包住：性别、房型不带（就算草稿里有值）；不限 = null
  h.run('openConditions(' + JSON.stringify(row(h, 15055)) + ')')
  h.run("condSheet.value.draft.genderPref = 'M'; condSheet.value.draft.roomType = 'single'; condSheet.value.draft.minDays = null")
  await h.run('saveConditions()')
  assert.deepEqual(h.log.puts[1], ['/app/staff/jobs/15055/conditions', { genderPref: '', restMode: '3-2', roomType: '', minDays: null }])
})

test('保存失败：提示服务端的原因，弹层留着可以再改；保存中再点不重复提交', async (t) => {
  const h = harness('MP-WEIXIN', { putFail: new Error('线上任务没有这些条件') })
  t.after(h.stop)
  await h.load()
  h.run('openConditions(' + JSON.stringify(row(h, 15057)) + ')')
  const a = h.run('saveConditions()')
  const b = h.run('saveConditions()')
  await Promise.all([a, b])
  assert.equal(h.log.puts.length, 1)
  assert.deepEqual(h.log.toasts, ['线上任务没有这些条件'])
  assert.equal(sheetState(h).jobId, 15057)
  assert.equal(h.run('condSaving.value'), false)
})

test('顶上提示：有编辑权限、有没填的已上架岗位才出；「去补填」打开最新的那一个（不在当前列表里也能打开）', async (t) => {
  const tpl = src('pages/staff/jobs.vue')
  assert.match(tpl, /<view v-if="canEdit && missingCount > 0" class="cond-banner">/)
  assert.match(tpl, /\{\{ missingCount \}\} 个岗位还没填排班 \/ 住宿等条件，补上后更容易被用户筛到<\/text><view class="cond-banner__btn" hover-class="k-press-s" @click="fillFirstMissing"><text>去补填<\/text><\/view>/)
  // 卡片上的「待补条件」只给有编辑权限的人看
  assert.match(tpl, /<text v-if="canEdit && j\.conditionsMissing" class="job-cond">待补条件<\/text>/)

  const h = harness('MP-WEIXIN', { missing: 3, missingJob: { jobId: 15057, title: '古城咖啡馆帮手', jobType: 'volunteer', status: 'published', housing: true,
    genderPref: '', restMode: '', roomType: '', minDays: null } })
  t.after(h.stop)
  await h.load()
  assert.equal(h.run('missingCount.value'), 3)
  h.run('fillFirstMissing()')
  assert.equal(sheetState(h).jobId, 15057)
  assert.equal(sheetState(h).title, '古城咖啡馆帮手')

  // 被类型筛掉了（当前列表里没有它）：用服务端一起给的那一个
  const other = harness('MP-WEIXIN', { rows: [ROWS[1]], missing: 1, missingJob: { jobId: 99, title: '别的岗位', jobType: 'fulltime', status: 'published', housing: false,
    genderPref: '', restMode: '', roomType: '', minDays: null } })
  t.after(other.stop)
  await other.load()
  other.run('fillFirstMissing()')
  assert.deepEqual(sheetState(other), { jobId: 99, title: '别的岗位', jobType: 'fulltime', housing: false, genderPlan: '', draft: { genderPref: '', restMode: '', roomType: '', minDays: null } })

  // 没有没填的：不出提示，「去补填」什么也不做
  const none = harness('MP-WEIXIN', { missing: 0, missingJob: null })
  t.after(none.stop)
  await none.load()
  assert.equal(none.run('missingCount.value'), 0)
  none.run('fillFirstMissing()')
  assert.equal(none.run('condSheet.value'), null)
})

test('弹层开着锁住页面滚动：小程序 page-meta 带上 s === 1；H5 锁 body，关掉、离开本页还原，回来再锁', async (t) => {
  const page = src('pages/staff/jobs.vue')
  assert.match(page, /^<template>\n  <!-- #ifdef MP-WEIXIN -->\n  <page-meta :page-style="\(s === 2 && \(startCalendar \|\| sheetKey\)\) \|\| \(s === 1 && \(condSheet \|\| photoSheet \|\| extrasSheet\)\) \? 'overflow: hidden' : ''" \/>/)
  // 遮罩、标题、按钮区拦 touchmove；中间的选项区是 scroll-view，自己能滚
  assert.match(page, /<view v-if="condSheet" class="chip-pop cond-sheet">\n        <view class="chip-pop__mask" @click="closeConditions" @touchmove\.stop\.prevent \/>/)
  assert.match(page, /<scroll-view scroll-y class="chip-pop__scroll cond-sheet__scroll">/)
  // H5 的锁只编进 H5
  const at = page.indexOf("body.style.overflow = 'hidden'")
  assert.ok(page.lastIndexOf('// #ifdef H5', at) > page.lastIndexOf('// #endif', at))

  const h = harness('H5')
  t.after(h.stop)
  await h.load()
  h.run('openConditions(' + JSON.stringify(row(h, 15057)) + ')')
  await flush()
  assert.equal(h.document.body.style.overflow, 'hidden')
  h.run('closeConditions()')
  await flush()
  assert.equal(h.document.body.style.overflow, '')
  h.run('openConditions(' + JSON.stringify(row(h, 15057)) + ')')
  await flush()
  h.log.hides.forEach(fn => fn())
  assert.equal(h.document.body.style.overflow, '', '离开本页还原')
  h.log.shows.forEach(fn => fn())
  assert.equal(h.document.body.style.overflow, 'hidden', '回来弹层还开着就再锁上')
  // 切到别的屏（发布 / 分享）：收起弹层、解锁
  h.run('s.value = 2')
  await flush()
  assert.equal(h.run('condSheet.value'), null)
  assert.equal(h.document.body.style.overflow, '')
  h.log.unloads.forEach(fn => fn())

  // 小程序不碰 body（靠 page-meta）
  const mp = harness('MP-WEIXIN')
  t.after(mp.stop)
  await mp.load()
  mp.run('openConditions(' + JSON.stringify(row(mp, 15057)) + ')')
  await flush()
  assert.equal(mp.document.body.style.overflow, '')
})

test('接口写在 staff 分包页面里（主包 common/api.js 不加）；新加的 <text> 不带 hover-class；弹层样式 320 宽也放得下', () => {
  const page = src('pages/staff/jobs.vue')
  assert.match(page, /import \{ post, put \} from '@\/common\/request\.js'/)
  assert.match(page, /const apiStaffJobConditions = \(jobId, payload\) => put\('\/app\/staff\/jobs\/' \+ jobId \+ '\/conditions', payload\)/)
  assert.doesNotMatch(src('common/api.js'), /conditions/)
  assert.doesNotMatch(page, /<text[^>]*hover-class/)
  const css = compiler.parse(page).descriptor.styles.map(s => s.content).join('\n')
  assert.match(css, /\.cond-sheet \.cond-sheet__scroll\{max-height:calc\(100vh - 210px\)/)
  // 岗位名单独一行（长标题不再把「补填筛选条件」挤成两行），过长省略
  assert.match(css, /\.cond-sheet \.chip-pop__head\{flex-direction:column;align-items:flex-start;gap:4px\}\.cond-sheet__job\{max-width:100%;overflow:hidden;white-space:nowrap;text-overflow:ellipsis\}/)
  assert.match(css, /\.job-cond\{flex-shrink:0;margin-left:auto;/)
})
