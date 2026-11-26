// 10-16 第二轮改版：岗位列表（效果图 23）、详情页角标 / 新字段、门店发布表单的新条件（node --test，不需要构建、不发请求）。
// 守住这几件事：
//   · 四类叫「换工旅行 / 兼职旅行 / 全职旅行 / 线上任务」；
//   · 筛选条件的参数名和取值和后端约定一致（cities / gender / restModes / roomTypes / skills / minStay / assured），
//     性别只给换宿、线上任务不带城市和安心保障，城市最多 5 个、技能最多 8 个；
//   · 选了的条件都能在胶囊行点掉；面板里改的是草稿，点「确定」才按条件重新拉；
//   · 「经袋鼠实地拍摄并含保险」只在门店已认证并且岗位含保险时挂，兼职、全职也挂，线上任务永远不挂；
//   · 门店发布表单：性别偏好只有换宿有，住宿条件只有包住才有，最短在店 7 / 15 / 20 / 30 / 不限，按约定的字段名提交；
//     线上任务没有排班 / 在店天数 / 住宿（2026-10-18 起工时只填「每日工时」，排班单独选，见 staff-publish-20261018.test.mjs）；
//   · 复核修订：面板开着时胶囊行改的是草稿；H5 面板开着锁住页面滚动；带 ?type= 进来只拉一次；面板组名和选项同一行。
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { createRequire } from 'node:module'
import test from 'node:test'
import assert from 'node:assert/strict'
import * as genderPlan from '../common/job-gender.js'

const APP = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const require = createRequire(path.join(APP, 'package.json'))
const compiler = require('@vue/compiler-sfc'), vue = require('vue')
const src = (rel) => fs.readFileSync(path.join(APP, rel), 'utf8').replace(/\r\n/g, '\n')
const F = await import(pathToFileURL(path.join(APP, 'pages/jobs/job-filters.js')).href)
const salary = await import(pathToFileURL(path.join(APP, 'common/job-salary.js')).href)
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms))
const flush = () => new Promise(resolve => setImmediate(resolve))
const plain = (v) => JSON.parse(JSON.stringify(v))

/** 在沙箱里跑页面的 script setup：导入一律先给永远不返回的函数，再用 stubs 覆盖用得到的那几个 */
function runSetup(rel, stubs) {
  const d = compiler.parse(src(rel), { filename: rel }).descriptor
  const source = d.scriptSetup.content
  const ast = compiler.babelParse(source, { sourceType: 'module' })
  const body = ast.program.body.filter(n => n.type !== 'ImportDeclaration').map(n => source.slice(n.start, n.end)).join('\n')
  const sandbox = { console, setTimeout, clearTimeout, setInterval: () => 0, clearInterval() {}, uni: { hideKeyboard() {}, pageScrollTo() {} } }
  for (const n of ast.program.body.filter(n => n.type === 'ImportDeclaration')) for (const s of n.specifiers) sandbox[s.local.name] = () => new Promise(() => {})
  // Use synchronous production validation rather than the generic pending API stub.
  Object.assign(sandbox, genderPlan, { ensureSession: async () => {}, getSessionRevision: () => 0 })
  Object.assign(sandbox, { ref: vue.ref, computed: vue.computed, watch: vue.watch, reactive: vue.reactive, onShow() {}, onHide() {}, onUnload() {} }, stubs)
  vm.createContext(sandbox)
  const scope = vue.effectScope()
  scope.run(() => vm.runInContext(body, sandbox, { filename: rel + ':script-setup' }))
  return { run: code => vm.runInContext(code, sandbox), stop: () => scope.stop(), template: d.template.content }
}

// ---------------------------------------------------------------- 条件 → 参数

test('四类岗位统一叫换工旅行 / 兼职旅行 / 全职旅行 / 线上任务', () => {
  assert.deepEqual(F.TYPE_NAMES, { volunteer: '换工旅行', parttime: '兼职旅行', fulltime: '全职旅行', online: '线上任务' })
  assert.match(src('pages/jobs/list.vue'), /import \{ TYPES, TYPE_NAMES,[^\n]*\} from '\.\/job-filters\.js'/)
  assert.match(src('pages/jobs/filter.vue'), /const JOB_TYPE_NAMES = \{ volunteer: '换工旅行', parttime: '兼职旅行', fulltime: '全职旅行', online: '线上任务' \}/)
})

test('换宿：每个条件按约定的参数名和取值带给 /app/job/list', () => {
  const f = { ...F.blankFilter(), cities: ['大理', '丽江'], gender: 'F', skills: ['做饭', '摄影'], restModes: ['5-2', '6-1'], minStay: 15, roomTypes: ['single'], assured: true, workKind: 'photo' }
  assert.deepEqual(F.filterParams('volunteer', f), { cities: '大理,丽江', gender: 'F', skills: '做饭,摄影', restModes: '5-2,6-1', minStay: 15, roomTypes: 'single', assured: 1, workKind: 'photo' })
  // 城市最多 5 个
  assert.equal(F.filterParams('volunteer', { ...F.blankFilter(), cities: ['a', 'b', 'c', 'd', 'e', 'f'] }).cities, 'a,b,c,d,e')
  // 什么都没选：不带任何条件
  assert.deepEqual(F.filterParams('volunteer', F.blankFilter()), {})
})

// 2026-10-17 主人反馈：每个页签自己一套条件——兼职 = 食宿 + 日薪三档，全职 = 类型 + 食宿 + 月薪三档（详见 jobs-filters-r4-20261017.test.mjs）
test('兼职 / 全职只有自己那几项（没有性别、技能、排班、在店时长、房型、保障）；线上任务不带城市和安心保障，任务类型走 skill', () => {
  const all = { ...F.blankFilter(), cities: ['大理'], gender: 'F', skills: ['咖啡制作'], restModes: ['5-2'], minStay: 30, roomTypes: ['double'], assured: true, workKind: 'photo', board: 'room', payDay: 100, payMonth: 2, categories: ['homestay'], task: '内容写作' }
  assert.deepEqual(F.filterParams('parttime', all), { cities: '大理', board: 'room', payDay: 100 })
  // 全职按月薪档传区间（左闭右开）
  assert.deepEqual(F.filterParams('fulltime', all), { cities: '大理', categories: 'homestay', board: 'room', payMonthMin: 3000, payMonthMax: 4500 })
  assert.deepEqual(F.filterParams('online', all), { skill: '内容写作' })
  assert.deepEqual(F.panelGroups('online', all).map(g => g.title), ['任务类型'])
})

test('每个选了的条件都列成胶囊，点掉以后参数里也没有了', () => {
  const kinds = [{ value: 'photo', label: '摄影换工' }]
  for (const type of F.TYPES) {
    const f = { ...F.blankFilter(), cities: ['大理', '丽江'], gender: 'M', skills: ['做饭', '开车'], restModes: ['1-1'], minStay: 7, roomTypes: ['multi'], bathroom: 'private', assured: true, workKind: 'photo', board: 'all', payDay: 80, payMonth: 1, categories: ['bar', 'other'], task: '其他' }
    const chips = F.filterChips(type, f, kinds)
    assert.ok(chips.length > 0, type)
    assert.equal(new Set(chips.map(c => c.key)).size, chips.length, type + ' 胶囊 key 不重复')
    for (const c of chips) F.dropChip(f, c.key)
    assert.deepEqual(F.filterParams(type, f), {}, type + ' 全部点掉后不再带条件')
    assert.deepEqual(F.filterChips(type, f, kinds), [])
  }
  const texts = F.filterChips('volunteer', { ...F.blankFilter(), cities: ['平潭'], gender: 'F', skills: ['做饭', '摄影'], restModes: ['3-1'], minStay: 30, roomTypes: ['single'], bathroom: 'private', assured: true, workKind: 'photo' }, kinds).map(c => c.text)
  // 胶囊栏先展示城市和卫浴，换工类型在最后。
  assert.deepEqual(texts, ['平潭', '独卫', '性别：女', '会做饭', '拍摄', '做三休一', '能待一个月', '单人间', '经袋鼠实地拍摄并含保险', '摄影换工'])
  assert.deepEqual(F.panelGroups('volunteer', F.blankFilter(), kinds).map(g => g.title), ['性别偏好', '技能需求', '休息排班', '可停留时长', '住宿条件', '卫浴条件', '安心保障', '换工类型'])
  // 线上任务不列城市
  assert.deepEqual(F.filterChips('online', { ...F.blankFilter(), cities: ['平潭'], task: '图片设计' }).map(c => c.text), ['图片设计'])
})

test('面板里点选项：多选组来回切换，单选组再点一次取消；技能最多 8 个', () => {
  const f = F.blankFilter()
  F.pickOption(f, 'restModes', '5-2'); F.pickOption(f, 'restModes', '6-1'); F.pickOption(f, 'restModes', '5-2')
  assert.deepEqual(f.restModes, ['6-1'])
  F.pickOption(f, 'gender', 'F'); assert.equal(f.gender, 'F')
  F.pickOption(f, 'gender', 'F'); assert.equal(f.gender, '')
  F.pickOption(f, 'minStay', '20'); assert.equal(f.minStay, 20)
  F.pickOption(f, 'minStay', '20'); assert.equal(f.minStay, 0)
  F.pickOption(f, 'assured', '1'); assert.equal(f.assured, true)
  const values = F.skillOpts('parttime').map(o => o[1])
  for (const v of values.slice(0, 8)) assert.equal(F.pickOption(f, 'skills', v), true)
  assert.equal(F.pickOption(f, 'skills', values[8]), false)
  assert.equal(f.skills.length, 8)
  assert.equal(F.MAX_SKILLS, 8)
  // 选满了也能取消
  assert.equal(F.pickOption(f, 'skills', values[0]), true)
  assert.equal(f.skills.length, 7)
})

test('面板分组：换工八组（性别、技能、排班、时长、住宿、卫浴、保障、换工类型），兼职 = 食宿 / 日薪，全职 = 类型 / 食宿 / 月薪', () => {
  const kinds = [{ value: 'daily', label: '日常' }]
  // 2026-10-17：组名一律两个字（主人：筛选排得乱）
  assert.deepEqual(F.panelGroups('volunteer', F.blankFilter(), kinds).map(g => g.title), ['性别偏好', '技能需求', '休息排班', '可停留时长', '住宿条件', '卫浴条件', '安心保障', '换工类型'])
  // 换工类型字典没取到：这一组先不显示
  assert.ok(!F.panelGroups('volunteer', F.blankFilter(), []).some(g => g.key === 'workKind'))
  assert.deepEqual(F.panelGroups('parttime', F.blankFilter()).map(g => g.title), ['食宿条件', '日薪（元/天）'])
  assert.deepEqual(F.panelGroups('fulltime', F.blankFilter()).map(g => g.title), ['店铺类型', '食宿条件', '月薪（元/月）'])
  // 「食宿」四项：包吃包住 / 包住 / 包吃 / 不包食宿，组名不和选项重名
  const board = F.panelGroups('parttime', F.blankFilter()).find(g => g.key === 'board')
  assert.deepEqual([board.title, board.options.map(o => o.label)], ['食宿条件', ['包吃包住', '包住', '包吃', '不包食宿']])
  assert.ok(!board.options.some(o => o.label === board.title))
  const vol = F.panelGroups('volunteer', { ...F.blankFilter(), gender: 'F' }, kinds)
  assert.deepEqual(vol[0].options.map(o => [o.label, o.on]), [['男', false], ['女', true], ['男女不限', false]])
  assert.deepEqual(vol.find(g => g.key === 'restModes').options.map(o => o.label), ['做一休一', '做四休三', '做二休一', '做五休二', '做三休二', '做三休一', '做六休一'])
  assert.deepEqual(vol.find(g => g.key === 'bathroom').options.map(o => o.label), ['不限', '独卫', '公卫'])
  assert.deepEqual(vol.find(g => g.key === 'assured').options.map(o => o.label), ['经袋鼠实地拍摄并含保险'])
  // 效果图里重复的「女」「做三休一」不照抄
  for (const g of vol) assert.equal(new Set(g.options.map(o => o.label)).size, g.options.length, g.title)
})

test('地址里带的城市：?cities= 覆盖 ?city= 并去重，最多 5 个，「全部城市」不算；?kind= 只认合法的换工类型', () => {
  assert.deepEqual(F.filterFromQuery({ city: '大理', cities: '大理,丽江, 平潭' }).cities, ['大理', '丽江', '平潭'])
  assert.deepEqual(F.filterFromQuery({ city: '全部城市' }).cities, [])
  assert.deepEqual(F.filterFromQuery({ cities: 'a,b,c,d,e,f' }).cities, ['a', 'b', 'c', 'd', 'e'])
  assert.equal(F.filterFromQuery({ kind: 'photo' }).workKind, 'photo')
  assert.equal(F.filterFromQuery({ kind: 'DROP TABLE' }).workKind, '')
})

// ---------------------------------------------------------------- 列表页

function listLifecycle() {
  const show = [], hide = []
  return {
    onShow: callback => show.push(callback), onHide: callback => hide.push(callback),
    show: () => show.forEach(callback => callback()), hide: () => hide.forEach(callback => callback())
  }
}

function listHarness(extra = {}) {
  const calls = []
  const toasts = []
  let onLoad = null
  const stubs = {
    ...F,
    useScreen: (n, opts) => { onLoad = opts && opts.onLoad; return vue.ref(1) },
    absUrl: x => x,
    toast: (m) => toasts.push(m),
    nextTick: (fn) => (fn ? Promise.resolve().then(fn) : Promise.resolve()),
    getCurrentInstance: () => null,
    apiJobList: async (params) => { calls.push(plain(params)); return { rows: [], total: params.pageSize === 1 ? 7 : 3, hasMore: false } },
    apiJobKinds: async () => ({ data: [{ value: 'photo', label: '摄影换工' }] }),
    apiJobSubs: async () => ({ data: [] }),
    checkNoticePopup() {},
    noticePopup: vue.reactive({ show: false }),
    go() {},
    ...extra
  }
  const h = runSetup('pages/jobs/list.vue', stubs)
  return { ...h, calls, toasts, load: (q) => onLoad && onLoad(q) }
}

// 普通入口不带城市；显式旧筛选链接仍兼容 ?city=。
test('列表页：显式筛选链接带 ?city= 进来按这个城市拉；条件按约定的参数名带上', async (t) => {
  const h = listHarness()
  t.after(h.stop)
  h.load({ type: 'volunteer', city: '大理' })
  await h.run('fetchJobs(0)')
  assert.deepEqual(h.calls.at(-1), { type: 'volunteer', cities: '大理', pageNum: 1, pageSize: 20 })
  h.run(`Object.assign(sel.volunteer, { gender: 'F', skills: ['做饭'], restModes: ['5-2'], roomTypes: ['single'], minStay: 15, assured: true })`)
  h.run(`keyword.value = ' 海边 '`)
  await h.run('fetchJobs(0)')
  assert.deepEqual(h.calls.at(-1), { type: 'volunteer', keyword: '海边', cities: '大理', gender: 'F', skills: '做饭', restModes: '5-2', minStay: 15, roomTypes: 'single', assured: 1, pageNum: 1, pageSize: 20 })
  // 点掉城市胶囊：不带城市重新拉
  await h.run(`removeChip('city:大理')`)
  await flush()
  assert.equal(h.calls.at(-1).cities, undefined)
  assert.equal(h.calls.at(-1).gender, 'F')
})

test('列表页：面板里改草稿只数一下（取 1 条），点「确定」才写回并重新拉；点空白收起不算数', async (t) => {
  const h = listHarness()
  t.after(h.stop)
  h.load({ type: 'parttime' })
  h.run('s.value = 2')
  h.run('toggleFilter()')
  assert.equal(h.run('filterOpen.value'), true)
  // 2026-10-17：兼职只有 食宿 + 日薪 两组
  h.run(`onPick('board', 'all'); onPick('payDay', '100')`)
  await sleep(450)
  const count = h.calls.at(-1)
  assert.deepEqual(count, { type: 'parttime', board: 'all', payDay: 100, pageNum: 1, pageSize: 1 })
  assert.equal(h.run('draftCount.value'), 7)
  // 还没确定：列表条件没变
  assert.equal(h.run('sel.parttime.payDay'), 0)
  h.run('onConfirm()')
  await flush()
  assert.equal(h.run('filterOpen.value'), false)
  assert.deepEqual(h.calls.at(-1), { type: 'parttime', board: 'all', payDay: 100, pageNum: 1, pageSize: 20 })
  // 再打开、改一下、点遮罩收起：不写回
  h.run('toggleFilter()')
  h.run(`onPick('board', 'room')`)
  h.run('filterOpen.value = false')
  assert.equal(h.run('sel.parttime.board'), 'all')
  // 重置：清掉条件，已选城市保留
  h.run(`cities.value = ['平潭']`)
  h.run('toggleFilter()')
  h.run('onReset()')
  assert.deepEqual(plain(h.run('draft.cities')), ['平潭'], '条件重置保留独立城市选择')
  assert.equal(h.run('draft.board'), '')
  assert.equal(h.run('draft.payDay'), 0)
  await sleep(450)
})

test('列表页：选城市面板从筛选面板进来改草稿，从胶囊行「全部城市」进来立刻生效', async (t) => {
  const h = listHarness()
  t.after(h.stop)
  h.load({ type: 'volunteer' })
  h.run('toggleFilter()')
  h.run('openCityDraft()')
  assert.equal(h.run('cityOpen.value'), true)
  h.run(`onCityConfirm(['大理', '丽江', '平潭', '厦门', '青岛', '威海'])`)
  assert.deepEqual(plain(h.run('draft.cities')), ['大理', '丽江', '平潭', '厦门', '青岛'])
  assert.deepEqual(plain(h.run('cities.value')), [])
  h.run('filterOpen.value = false')
  h.run('openCityLive()')
  h.run(`onCityConfirm(['丽江'])`)
  await flush()
  assert.deepEqual(plain(h.run('cities.value')), ['丽江'])
  assert.equal(h.calls.at(-1).cities, '丽江')
})

test('列表页：面板开着时胶囊行改的是草稿，点「确定」后请求里就是这一行列出的城市；点空白收起不算数', async (t) => {
  const h = listHarness()
  t.after(h.stop)
  h.load({ type: 'volunteer', city: '大理' })
  h.run('toggleFilter()')
  h.run(`onPick('gender', 'F')`)
  // 面板开着：胶囊行列的是草稿
  assert.deepEqual(plain(h.run('chips.value')).map(c => c.text), ['大理', '性别：女'])
  // 点掉城市胶囊：只改草稿，不重新拉列表
  h.run(`removeChip('city:大理')`)
  assert.deepEqual(plain(h.run('draft.cities')), [])
  assert.deepEqual(plain(h.run('cities.value')), ['大理'])
  assert.equal(h.run('shownCities.value.length'), 0, '草稿里没有城市了，胶囊行露出「全部城市」')
  assert.ok(!h.calls.some(c => c.pageSize === 20), '没确定之前不拉列表')
  // 胶囊行的「全部城市」：面板开着时也回到草稿
  h.run('openCityChip()')
  assert.equal(h.run('cityOpen.value'), true)
  h.run(`onCityConfirm(['厦门'])`)
  assert.deepEqual(plain(h.run('draft.cities')), ['厦门'])
  assert.deepEqual(plain(h.run('cities.value')), ['大理'])
  assert.deepEqual(plain(h.run('chips.value')).map(c => c.text), ['厦门', '性别：女'])
  // 确定：生效的条件 = 胶囊行刚才列的
  h.run('onConfirm()')
  await flush()
  assert.deepEqual(plain(h.run('cities.value')), ['厦门'])
  assert.deepEqual(h.calls.at(-1), { type: 'volunteer', cities: '厦门', gender: 'F', pageNum: 1, pageSize: 20 })
  assert.deepEqual(plain(h.run('chips.value')).map(c => c.text), ['厦门', '性别：女'])
  // 面板关着：点掉胶囊直接按生效的条件重新拉
  await h.run(`removeChip('gender')`)
  await flush()
  assert.equal(h.calls.at(-1).gender, undefined)
  assert.equal(h.calls.at(-1).cities, '厦门')
  // 再打开、在胶囊行点掉城市、点空白收起：不算数，胶囊行回到生效的条件
  h.run('toggleFilter()')
  h.run(`removeChip('city:厦门')`)
  assert.deepEqual(plain(h.run('chips.value')).map(c => c.text), [])
  h.run('filterOpen.value = false')
  assert.deepEqual(plain(h.run('chips.value')).map(c => c.text), ['厦门'])
  assert.match(h.template, /<view v-if="s !== 4" class="fchip fchip--add" hover-class="k-press-s" aria-role="button" aria-label="选择城市" @click="openCityChip">/)
  await sleep(450)
})

test('列表页：从首页入口带 ?type= 进到不是第一个的页签，列表只拉一次（onLoad 改页签 + onShow，不再两次）', async (t) => {
  const hooks = listLifecycle()
  const h = listHarness({ onShow: hooks.onShow, onHide: hooks.onHide })
  t.after(h.stop)
  h.load({ type: 'parttime', city: '大理' })
  hooks.show()
  await flush()
  await flush()
  const lists = () => h.calls.filter(c => c.pageSize === 20)
  assert.equal(lists().length, 1, JSON.stringify(h.calls))
  assert.deepEqual(lists()[0], { type: 'parttime', cities: '大理', pageNum: 1, pageSize: 20 })
  // 之后自己换页签照常拉
  h.run('s.value = 3')
  await flush()
  assert.equal(lists().length, 2)
  assert.equal(lists().at(-1).type, 'fulltime')
  // 离开再回来：onShow 重读一次
  hooks.hide()
  hooks.show()
  await flush()
  assert.equal(lists().length, 3)
  assert.equal(lists().at(-1).type, 'fulltime')
})

test('H5：筛选 / 选城市面板开着时锁住页面滚动，关掉、离开本页时还原（小程序仍用 page-meta）', async (t) => {
  const hooks = listLifecycle()
  const doc = { documentElement: { style: { overflow: '' } }, body: { style: { overflow: 'scroll' } } }
  const h = listHarness({ document: doc, onShow: hooks.onShow, onHide: hooks.onHide })
  t.after(h.stop)
  const body = () => doc.body.style.overflow
  h.load({ type: 'volunteer' })
  hooks.show()
  h.run('toggleFilter()')
  await flush()
  assert.equal(body(), 'hidden')
  // 只锁 body，html 不动（html 一写 hidden，body 自己变成一屏高的滚动框，页面跳回顶上）
  assert.equal(doc.documentElement.style.overflow, '')
  // 从筛选面板进选城市面板，两层都开着：还是锁着
  h.run('openCityDraft()')
  await flush()
  h.run(`onCityConfirm(['平潭'])`)
  await flush()
  assert.equal(body(), 'hidden')
  // 关掉面板：还原成原来的值
  h.run('filterOpen.value = false')
  await flush()
  assert.equal(body(), 'scroll')
  // 面板开着时离开本页（onHide）：先还原，回来再锁上
  h.run('toggleFilter()')
  await flush()
  hooks.hide()
  assert.equal(body(), 'scroll')
  hooks.show()
  assert.equal(body(), 'hidden')
  h.run('filterOpen.value = false')
  await flush()
  assert.equal(body(), 'scroll')
  assert.equal(doc.documentElement.style.overflow, '')
  const list = src('pages/jobs/list.vue')
  assert.match(list, /<!-- #ifdef MP-WEIXIN -->\n  <page-meta :page-style="noticePopup\.show \|\| cityOpen \|\| filterOpen \? 'overflow: hidden' : ''" \/>/)
  assert.match(list, /function lockPageScroll\(on\) \{\n  \/\/ #ifdef H5\n[\s\S]*?\n  \/\/ #endif\n\}/)
  assert.match(list, /onUnload\(\(\) => \{[^\n]*lockPageScroll\(false\)/)
  // 面板里真正滚动的那一层滚到头不带着页面滚（只在 H5 里写）
  for (const [f, cls] of [['job-filter-panel.vue', 'fp__body'], ['job-city-panel.vue', 'cp__body']]) {
    assert.match(src('pages/jobs/components/' + f), new RegExp('\\.' + cls + ' :deep\\(\\.uni-scroll-view\\)[^{]*\\{ overscroll-behavior: contain; \\}'), f)
  }
  await sleep(450)
})

// 2026-10-17 主人效果图 2 改了排法：组名不再和选项挤在同一行 flex 折行（第二行从组名下面开始，参差不齐），
// 改成左边固定宽度的组名一列 + 右边 3 列等宽网格；同日第二次反馈（「排得乱」）又去掉了说明小字：
// 在店时长的选项直接写「能待…」，薪资组名写「日薪 / 月薪」。版面细节见 home-jobs-20261017.test.mjs。这里守住还成立的部分
// Full filter labels and min-stay help are covered by the browser acceptance.

test('列表卡片：门店已认证并且含保险才显示保障，真实照片挂45°角标，线上任务不挂', (t) => {
  const h = listHarness()
  t.after(h.stop)
  const job = { jobId: 1, title: '南舍庄园招直播换工', safeCert: '0', insuranceFlag: '0', minDays: 30, boardType: 'all', boardText: '包吃包住', restModeLabel: '做五休二', roomTypeLabel: '单人间', tags: ['直播'], monthRedpacket: true }
  const vol = plain(h.run(`mapJob(${JSON.stringify(job)}, 'volunteer')`))
  assert.equal(vol.assured, true)
  assert.deepEqual(vol.conds.map(c => c.text), ['最短30天', '包吃包住', '做五休二', '单人间'])
  assert.equal(vol.redpacket, true)
  for (const type of ['parttime', 'fulltime']) {
    const m = plain(h.run(`mapJob(${JSON.stringify({ ...job, salaryType: 'daily', salaryMin: 150, salaryText: '150 元/天' })}, '${type}')`))
    assert.equal(m.assured, true, type)
    assert.ok(m.conds.some(c => c.text === '做五休二'), type)
  }
  assert.equal(plain(h.run(`mapJob(${JSON.stringify({ ...job, jobType: 'online' })}, 'online')`)).assured, false)
  // 只有一样：不挂角标，在条件里写（绿色）
  const certOnly = plain(h.run(`mapJob(${JSON.stringify({ ...job, insuranceFlag: '1' })}, 'parttime')`))
  assert.equal(certOnly.assured, false)
  assert.deepEqual(certOnly.conds.filter(c => c.tone === 'green').map(c => c.text), ['安心商家'])
  // 没填的新字段不显示空条件
  const bare = plain(h.run(`mapJob(${JSON.stringify({ jobId: 2, title: 'x', minDays: null, boardType: 'none' })}, 'volunteer')`))
  assert.deepEqual(bare.conds, [])
  assert.match(h.template, /<view v-if="job\.assured && hasJobPhoto\(job\)" class="card__badge"[^>]*><job-badge size="ribbon" \/><\/view>/)
  assert.match(h.template, /v-if="job\.assured && !hasJobPhoto\(job\)"[\s\S]*?安心商家 · 含保险/)
})

test('列表页：去掉「只看X的岗位」那一行和「全部筛选」；新机会提醒变成数量行旁边的小铃铛', () => {
  const list = src('pages/jobs/list.vue')
  assert.doesNotMatch(list, /只看\{\{|点此看全部城市|有新机会提醒我<\/text>/)
  assert.match(list, /<view class="bell" :class="\{ on: notify \}" hover-class="k-press" @click="openSubscribe"><k-icon :name="notify \? 'bell-ring' : 'bell'"/)
  assert.match(list, /<view class="refresh" aria-live="off"><k-icon name="clock"/)
  assert.match(list, /autoRefreshing \? '更新中' : refreshSeconds \+ '秒更新'/)
  assert.match(list, /placeholder: '搜索城市、岗位或偏好'/)
  assert.match(list, /countText: \(n\) => `\$\{n\} 个换工岗位`/)
})

test('新组件都在 jobs 分包里（不进主包），角标用主包里已有的袋鼠贴纸 PNG', () => {
  for (const f of ['job-badge.vue', 'job-filter-panel.vue', 'job-city-panel.vue']) assert.ok(fs.existsSync(path.join(APP, 'pages/jobs/components', f)), f)
  assert.ok(!fs.existsSync(path.join(APP, 'components/job-badge')))
  const badge = src('pages/jobs/components/job-badge.vue')
  assert.match(badge, /<image class="jb__icon" src="\/static\/user-icons\/roo-mark\.png" mode="aspectFit" \/>/)
  assert.ok(fs.existsSync(path.join(APP, 'static/user-icons/roo-mark.png')))
  assert.match(badge, /<text class="jb__text">经袋鼠实地拍摄<\/text><text class="jb__text">并含保险<\/text>/)
  // 字号不小于 10px
  for (const m of badge.matchAll(/font-size: (\d+)px/g)) assert.ok(Number(m[1]) >= 10, m[0])
  assert.doesNotMatch(src('common/api.js'), /restModes|roomTypes|job-filter/)
})

// ---------------------------------------------------------------- 详情页

test('详情页：两样都有时头图挂同一个角标；显示性别偏好（只换宿）、休息排班、住宿条件', (t) => {
  const h = runSetup('pages/jobs/detail.vue', { useScreen: () => vue.ref(1), experience: vue.reactive({ account: null }), absUrl: x => x })
  t.after(h.stop)
  assert.match(h.template, /<view v-if="assured" class="hero__badge"><job-badge size="hero" \/><\/view>/)
  h.run(`detail.value = { jobType: 'volunteer', title: 't', safeCert: '1', store: { safeCert: '0' }, insuranceFlag: '0', genderPref: 'F', restModeLabel: '做五休二', shiftDesc: '每周 2 天', roomTypeLabel: '单人间', boardType: 'all' }`)
  assert.equal(h.run('assured.value'), true)
  const rows = Object.fromEntries(plain(h.run('overviewRows.value')).map(r => [r.label, r.value]))
  assert.equal(rows['性别偏好'], '女生')
  assert.equal(rows['排班方式'], '做五休二 · 每周 2 天')
  assert.equal(rows['住宿条件'], '单人间')
  h.run(`detail.value = { jobType: 'volunteer', title: 't', safeCert: '0', insuranceFlag: '1', genderPref: '' }`)
  assert.equal(h.run('assured.value'), false)
  assert.equal(Object.fromEntries(plain(h.run('overviewRows.value')).map(r => [r.label, r.value]))['性别偏好'], '男女不限')
  h.run(`detail.value = { jobType: 'parttime', title: 't', safeCert: '0', insuranceFlag: '0', genderPref: 'F' }`)
  assert.equal(h.run('assured.value'), true)
  assert.ok(!plain(h.run('overviewRows.value')).some(r => r.label === '性别偏好'), '兼职不显示性别')
  h.run(`detail.value = { jobType: 'online', title: 't', safeCert: '0', insuranceFlag: '0' }`)
  assert.equal(h.run('assured.value'), false)
})

// ---------------------------------------------------------------- 门店发布表单

function staffHarness(extra = {}) {
  const created = []
  const h = runSetup('pages/staff/jobs.vue', {
    useScreen: () => vue.ref(2), onShareAppMessage() {}, ensureSession: async () => {}, hasStaffAccess: { value: true },
    currentStaffStoreId: () => 102, staffCan: () => true, absUrl: x => x,
    currentStaffStore: vue.ref({ storeId: 102, roleCode: 'manager', identityKey: 'manager:102' }),
    experience: { account: { id: 21 } }, merchantStaff: vue.ref(false),
    todayCn: () => '2026-10-16', shiftDate: () => '2026-10-23', isYmd: () => true,
    validateSalaryForm: () => '', salaryPayload: () => ({}), jobBenefits: salary.jobBenefits, parseSalaryAmount: salary.parseSalaryAmount,
    toast() {}, go() {}, back() {}, confirm: async () => true, errText: (e, d) => d,
    apiStaffJobs: async () => ({ data: { rows: [], canEdit: true, storeAddress: '测试门店地址' } }), apiStaffShareStats: async () => ({ data: {} }),
    apiStaffCreateJob: async (storeId, payload) => { created.push(plain(payload)); return { msg: '已提交平台审核' } },
    ...extra
  })
  const openPublish = async kind => {
    assert.equal(await h.run('loadJobs()'), true)
    h.run('startPublish(); choosePublish(' + JSON.stringify(kind) + ')')
    assert.equal(h.run('formOpen.value'), true)
  }
  return { ...h, created, openPublish }
}

test('发布表单：性别偏好只有换宿有，住宿条件只有包住才有，最短在店 7 / 15 / 20 / 30 / 不限', (t) => {
  const h = staffHarness()
  t.after(h.stop)
  // 2026-10-18 商家端改版：选项都摊在表里（不再弹菜单），胶囊按 grid 等分
  assert.match(h.template, /<view v-if="form\.jobType === 'volunteer'" class="fc-field gender-plan">\s*<view class="fc-label"><text class="fc-label__t">招募性别<\/text><\/view>/)
  assert.match(h.template, /<view v-if="housing" class="fc-field">\s*<view class="fc-label"><text class="fc-label__t">住宿条件<\/text><\/view>/)
  assert.match(h.template, /<text class="fc-row__k">休息排班<\/text>/)
  assert.deepEqual(plain(h.run('MIN_DAY_OPTS')), [['不限', null], ['一周', 7], ['半个月', 15], ['20天', 20], ['一个月', 30]])
  assert.deepEqual(plain(h.run('REST_MODES')).map(o => o[1]), F.REST_OPTS.map(o => o[1]))
  assert.deepEqual(plain(h.run('ROOM_TYPES')).map(o => o[1]), F.ROOM_OPTS.map(o => o[1]))
  h.run(`form.value = newForm('parttime'); setBoard('meal')`)
  assert.equal(h.run('housing.value'), false, '只包吃不包住')
  h.run(`setBoard('room')`)
  assert.equal(h.run('housing.value'), true)
  h.run(`form.value.roomType = 'double'; setBoard('none')`)
  assert.equal(h.run('housing.value'), false)
  assert.equal(h.run('form.value.roomType'), '', '不包住了，房型跟着清掉')
  h.run(`form.value = newForm('volunteer')`)
  assert.equal(h.run('housing.value'), true, '换宿一律包住')
  assert.deepEqual(plain(h.run('boardOptions.value')).map(o => o[1]), ['all', 'room'], '换宿只能包吃包住 / 只包住')
})

test('发布表单：按约定的字段名提交，不适用的项传空（兼职不带性别，不包住不带房型）', async (t) => {
  const h = staffHarness()
  t.after(h.stop)
  await h.openPublish('volunteer')
  h.run(`gen.value = { title: '标题', work: 'b', hope: 'c' }`)
  h.run(`Object.assign(form.value, { images: ['/profile/upload/test.jpg'], jobType: 'volunteer', genderPref: 'F', restMode: '5-2', roomType: 'double', minDays: 15 })`)
  await h.run('submitJob()')
  const v = h.created.at(-1)
  assert.ok(v, '完整照片、地址与内容应通过发布校验')
  assert.deepEqual([v.genderPref, v.restMode, v.roomType, v.minDays], ['F', '5-2', 'double', 15])
  await h.openPublish('parttime')
  h.run(`gen.value = { title: '标题', work: 'b', hope: 'c' }`)
  h.run(`Object.assign(form.value, { images: ['/profile/upload/test.jpg'], genderPref: 'F', restMode: '6-1', roomType: 'double', minDays: null, salary: '120' }); setBoard('none')`)
  await h.run('submitJob()')
  const p = h.created.at(-1)
  assert.deepEqual([p.genderPref, p.restMode, p.roomType, p.minDays, p.boardType], ['', '6-1', '', null, 'none'])
  await h.openPublish('fulltime')
  h.run(`gen.value = { title: '标题', work: 'b', hope: 'c' }`)
  h.run(`Object.assign(form.value, { images: ['/profile/upload/test.jpg'], roomType: 'single', salary: '5000' })`)
  await h.run('submitJob()')
  assert.equal(h.created.at(-1).roomType, 'single')
  assert.equal(h.created.at(-1).boardType, 'all')
})

test('发布表单：分别设置人数按真实同步校验拦截无效值，修正后合计并提交', async (t) => {
  const h = staffHarness(); t.after(h.stop)
  await h.openPublish('volunteer')
  h.run(`gen.value = { title: '测试岗位', work: '接待访客' }; form.value.images = ['/profile/upload/test.jpg']; chooseGenderMode('split'); setGenderCount('genderMaleCount', ''); setGenderCount('genderFemaleCount', '2')`)
  await h.run('submitJob()')
  assert.equal(h.created.length, 0, '空人数不能提交')
  assert.ok(h.run('err.value.genderCounts'))
  h.run(`setGenderCount('genderMaleCount', '1')`)
  assert.equal(h.run('form.value.headcount'), 3)
  assert.equal(h.run('err.value.genderCounts'), undefined)
  await h.run('submitJob()')
  assert.equal(h.created.length, 1)
  const p = h.created[0]
  assert.deepEqual([p.headcount, p.genderMaleCount, p.genderFemaleCount, p.genderPref, p.genderCountsEnabled], [3, 1, 2, '', true])
})

test('发布表单：线上任务不走这张表，不带休息排班、最短在店、住宿条件和新加的几项', (t) => {
  const h = staffHarness()
  t.after(h.stop)
  h.run(`Object.assign(form.value, { jobType: 'online', restMode: '5-2', minDays: 15, roomType: 'single', boardType: 'all', dailyHours: '每天 4 小时', settleDesc: '日结' })`)
  assert.equal(h.run('housing.value'), false, '线上任务没有住宿')
  assert.deepEqual(plain(h.run('conditionPayload(form.value)')), { genderPref: '', restMode: '', roomType: '', minDays: null })
  assert.deepEqual(plain(h.run('publishExtras(form.value)')), { boardType: '', boardDesc: '', dailyHours: '', shiftTime: '', settleDesc: '', probation: '', trainDesc: '', category: '' })
  // 切回兼职：之前选的照常带上
  h.run(`form.value.jobType = 'parttime'`)
  assert.deepEqual(plain(h.run('conditionPayload(form.value)')), { genderPref: '', restMode: '5-2', roomType: 'single', minDays: 15 })
  // 提醒红仍用 token（补填筛选条件的提示里用）
  assert.match(src('pages/staff/jobs.vue'), /\.insurance-hint--warn\{color:var\(--k-alert\)\}/)
})

// 选了排班后「工作时长」和「每周 N 天」打架的两条（10-16）已不适用：2026-10-18 起工时只填「每日工时」，排班单独选，
// 不会再写出「每周 2 天，每天 4 小时；休息安排：做三休一」。新表单的用例在 scripts/staff-publish-20261018.test.mjs

// 10-24 已确认的大图 / 紧凑卡片：条件分组不造默认值，图片异常保留可读信息。
test('大图卡片按真实数据分组，线下完整标题保留，线上尾注另列，地址不丢失', (t) => {
  const h = listHarness(); t.after(h.stop)
  const row = { jobId: 71, title: '南舍庄园招直播换工2人（提供食宿 + 奖金）', images: ['/real.jpg'], address: '福建省平潭县东湖山庄98号', city: '平潭', minDays: 30, dailyHours: '每天 4 小时', boardType: 'all', restModeLabel: '做一休一', roomTypeLabel: '双人间', salaryText: '150元/天', safeCert: '0', insuranceFlag: '0' }
  const job = plain(h.run(`mapJob(${JSON.stringify(row)}, 'volunteer')`))
  assert.equal(job.title, row.title)
  assert.equal(job.headline, row.title)
  assert.equal(job.subtitle, '')
  assert.equal(job.locationLabel, '福建 · 平潭')
  assert.equal(job.loc, '福建省平潭县东湖山庄98号 · 平潭')
  assert.equal(job.price, '150元/天')
  assert.equal(job.hasPhoto, true)
  assert.deepEqual(job.facts.map(x => x.text), ['最短30天', '每天4小时', '包吃包住'])
  assert.equal(job.arrangement.text, '做一休一 · 双人间')
  assert.deepEqual(job.details, [])
  const empty = plain(h.run(`mapJob({jobId:72,title:'岗位',boardType:'none'}, 'volunteer')`))
  assert.deepEqual(empty.facts, [])
  assert.deepEqual(empty.details, [])
  assert.equal(empty.hasPhoto, false)
  assert.equal(empty.subtitle, '')
  assert.equal(h.run(`mapJob({dailyHours:'晚间协商'}, 'parttime').facts[0].text`), '晚间协商')
})

test('缺图和加载失败收为紧凑卡片；更换图片后可重试，同一地址失败不影响其他岗位', (t) => {
  const h = listHarness(); t.after(h.stop)
  h.run(`globalThis.photoJob = mapJob({jobId:81,cover:'/first.jpg',safeCert:'0',insuranceFlag:'0'}, 'volunteer')`)
  assert.equal(h.run('hasJobPhoto(photoJob)'), true)
  h.run('markJobPhotoFailed(photoJob)')
  assert.equal(h.run('hasJobPhoto(photoJob)'), false)
  assert.equal(h.run('photoJob.assured'), true)
  assert.equal(h.run(`hasJobPhoto(mapJob({jobId:81,cover:'/new.jpg'}, 'volunteer'))`), true)
  assert.equal(h.run(`hasJobPhoto(mapJob({jobId:82,cover:'/first.jpg'}, 'volunteer'))`), true)
  for (const cover of ['', '/static/media/cover-empty.png', '/static/media/cover-empty.png?v=2']) {
    assert.equal(h.run(`hasJobPhoto(mapJob({jobId:83,cover:${JSON.stringify(cover)}}, 'volunteer'))`), false)
  }
})

test('线上任务展示发单方与交付信息，不带线下条件和保障', (t) => {
  const h = listHarness(); t.after(h.stop)
  const row = { jobId:91,title:'剪辑任务', publisherName:'袋鼠小院', city:'平潭', address:'福建省平潭县', salaryText:'500元/单', salaryUnit:'元/单', deliverDesc:'三天内', estHours:'6小时', remoteFlag:'0', dailyHours:'6', minDays:30, boardType:'all', safeCert:'0', insuranceFlag:'0' }
  const job = plain(h.run(`mapJob(${JSON.stringify(row)}, 'online')`))
  assert.equal(job.locationLabel, '袋鼠小院')
  assert.deepEqual(job.facts, [])
  assert.deepEqual(job.details, [])
  assert.equal(job.assured, false)
  assert.equal(job.price, '500')
  assert.equal(job.unit, '元/单')
  assert.equal(job.deliver, '三天内')
  assert.equal(job.est, '6小时')
  assert.equal(job.remote, true)
})
