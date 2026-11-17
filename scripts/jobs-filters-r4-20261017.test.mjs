// 10-17 主人反馈（岗位列表筛选 R4）：每个页签自己一套筛选条件，面板里不再有城市一行，排得更整齐（node --test，不需要构建、不发请求）。
// 守住这几件事：
//   · 换宿旅行：性别 / 技能 / 排班 / 时长 / 住宿 / 保障 / 换工类型（和之前同一组，组名两个字、没有说明小字）；
//   · 兼职旅行：食宿（包吃包住 / 包住 / 包吃 / 不包食宿）+ 日薪三档（80 / 100 / 120 元/天以上）→ board / payDay；
//   · 全职旅行：类型（民宿 / 酒店 / 咖啡餐饮 / 酒吧 / 其他）+ 食宿 + 月薪三档（3000以下 / 3000–4500 / 5000以上）→ categories / board / payMonthMin / payMonthMax；
//   · 线上任务：任务类型；
//   · 胶囊行列出这个页签的条件；换页签时新页签用不上的条件清掉（兼职 ↔ 全职的食宿带过去），城市照旧共用；
//   · 地址参数（filterQuery / filterFromQuery）来回一致，别的页签的条件不认；订阅页 / 「筛选条件」页（filter.vue）兼职、全职用同一组条件；
//   · 档位、取值和后端 JobTabFilters 一致。
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
const F = await import(pathToFileURL(path.join(APP, 'pages/jobs/job-filters.js')).href)
const tabJava = src('../RuoYi-Vue/ruoyi-kangaroo/src/main/java/com/ruoyi/kangaroo/domain/JobTabFilters.java')
const flush = () => new Promise(resolve => setImmediate(resolve))
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms))
const plain = (v) => JSON.parse(JSON.stringify(v))
const kinds = [{ value: 'photo', label: '摄影换工' }, { value: 'daily', label: '日常换工' }]

/** 在沙箱里跑页面的 script setup：导入一律先给永远不返回的函数，再用 stubs 覆盖用得到的那几个 */
function runSetup(rel, stubs) {
  const d = sfc(rel)
  const source = d.scriptSetup.content
  const ast = compiler.babelParse(source, { sourceType: 'module' })
  const body = ast.program.body.filter(n => n.type !== 'ImportDeclaration').map(n => source.slice(n.start, n.end)).join('\n')
  const sandbox = { console, setTimeout, clearTimeout }
  for (const n of ast.program.body.filter(n => n.type === 'ImportDeclaration')) for (const s of n.specifiers) sandbox[s.local.name] = () => new Promise(() => {})
  Object.assign(sandbox, { ref: vue.ref, computed: vue.computed, watch: vue.watch, reactive: vue.reactive, onShow() {}, onHide() {}, onUnload() {} }, stubs)
  vm.createContext(sandbox)
  const scope = vue.effectScope()
  scope.run(() => vm.runInContext(body, sandbox, { filename: rel + ':script-setup' }))
  return { run: code => vm.runInContext(code, sandbox), stop: () => scope.stop(), template: d.template.content }
}

// ---------------------------------------------------------------- 每个页签的条件组

test('四个页签各有自己的条件组：换宿七组照旧，兼职 = 食宿 / 日薪，全职 = 类型 / 食宿 / 月薪，线上 = 类型', () => {
  assert.deepEqual(F.GROUPS, {
    volunteer: ['gender', 'skills', 'restModes', 'minStay', 'roomTypes', 'assured', 'workKind'],
    parttime: ['board', 'payDay'],
    fulltime: ['categories', 'board', 'payMonth'],
    online: ['task']
  })
  const groups = (type) => F.panelGroups(type, F.blankFilter(), kinds).map(g => [g.title, g.options.map(o => o.label)])
  assert.deepEqual(groups('parttime'), [
    ['食宿条件', ['包吃包住', '包住', '包吃', '不包食宿']],
    ['日薪（元/天）', ['80元/天以上', '100元/天以上', '120元/天以上']]
  ])
  assert.deepEqual(groups('fulltime'), [
    ['店铺类型', ['民宿', '酒店', '咖啡餐饮', '酒吧', '其他']],
    ['食宿条件', ['包吃包住', '包住', '包吃', '不包食宿']],
    ['月薪（元/月）', ['3000以下', '3000–4500', '5000以上']]
  ])
  assert.deepEqual(groups('volunteer').map(g => g[0]), ['性别偏好', '技能需求', '休息排班', '可停留时长', '住宿条件', '安心保障', '换工类型'])
  assert.deepEqual(groups('volunteer').find(g => g[0] === '可停留时长')[1], ['能待一周', '能待半个月', '能待20天', '能待一个月'])
  assert.deepEqual(groups('online'), [['任务类型', ['内容写作', '图片设计', '视频剪辑', '社群运营', '数据整理', '其他']]])
  // 任何一个页签的面板里都没有城市组（城市在胶囊行 + 选城市面板里单独选）
  for (const type of F.TYPES) assert.ok(!F.panelGroups(type, F.blankFilter(), kinds).some(g => /城市/.test(g.title) || g.key === 'cities'), type)
})

test('选中状态：单选组再点一次取消，类型可以多选', () => {
  const f = F.blankFilter()
  F.pickOption(f, 'board', 'self'); assert.equal(f.board, 'self')
  F.pickOption(f, 'board', 'meal'); assert.equal(f.board, 'meal')
  F.pickOption(f, 'board', 'meal'); assert.equal(f.board, '')
  F.pickOption(f, 'payDay', '100'); assert.equal(f.payDay, 100)
  F.pickOption(f, 'payDay', '120'); assert.equal(f.payDay, 120)
  F.pickOption(f, 'payDay', '120'); assert.equal(f.payDay, 0)
  F.pickOption(f, 'payMonth', '3'); assert.equal(f.payMonth, 3)
  F.pickOption(f, 'categories', 'homestay'); F.pickOption(f, 'categories', 'bar'); F.pickOption(f, 'categories', 'homestay')
  assert.deepEqual(f.categories, ['bar'])
  const on = F.panelGroups('fulltime', f).flatMap(g => g.options.filter(o => o.on).map(o => g.key + ':' + o.label))
  assert.deepEqual(on, ['categories:酒吧', 'payMonth:5000以上'])
})

// ---------------------------------------------------------------- 参数和后端一致

test('兼职：食宿 + 日薪档 → board / payDay（起薪折成元/天后不低于它），城市照旧', () => {
  const f = { ...F.blankFilter(), cities: ['大理'], board: 'self', payDay: 80 }
  assert.deepEqual(F.filterParams('parttime', f), { cities: '大理', board: 'self', payDay: 80 })
  // 别的页签的条件即使留在对象里也不带（性别、技能、月薪、类型）
  assert.deepEqual(F.filterParams('parttime', { ...f, gender: 'F', skills: ['做饭'], payMonth: 2, categories: ['bar'], assured: true }), { cities: '大理', board: 'self', payDay: 80 })
})

test('全职：类型 + 食宿 + 月薪档 → categories / board / payMonthMin（含）/ payMonthMax（不含），遵守指定三档，不扩充中档', () => {
  const p = (payMonth) => F.filterParams('fulltime', { ...F.blankFilter(), payMonth })
  assert.deepEqual(p(1), { payMonthMax: 3000 })
  assert.deepEqual(p(2), { payMonthMin: 3000, payMonthMax: 4500 })
  assert.deepEqual(p(3), { payMonthMin: 5000 })
  assert.deepEqual(p(0), {})
  assert.equal(F.PAY_MONTH_OPTS[1][2], 4500)
  assert.equal(F.PAY_MONTH_OPTS[2][1], 5000)
  assert.deepEqual(F.filterParams('fulltime', { ...F.blankFilter(), cities: ['丽江', '大理'], categories: ['homestay', 'other'], board: 'room', payMonth: 2 }),
    { cities: '丽江,大理', categories: 'homestay,other', board: 'room', payMonthMin: 3000, payMonthMax: 4500 })
})

test('档位和取值和后端 JobTabFilters 一致：日薪 80 / 100 / 120，月薪分界 3000 / 5000，食宿四项、类型五类', () => {
  assert.deepEqual(F.PAY_DAY_OPTS.map(o => o[1]), JSON.parse('[' + /PART_DAY_BANDS = Collections\.unmodifiableList\(Arrays\.asList\(([^)]*)\)\)/.exec(tabJava)[1] + ']'))
  assert.deepEqual([...new Set(F.PAY_MONTH_OPTS.flatMap(o => [o[1], o[2]]).filter(Boolean))].sort((a,b) => a-b), JSON.parse('[' + /FULL_MONTH_EDGES = Collections\.unmodifiableList\(Arrays\.asList\(([^)]*)\)\)/.exec(tabJava)[1] + ']'))
  for (const [label, code] of F.BOARD_OPTS) assert.match(tabJava, new RegExp(`b\\.put\\("${code}", "${label}"\\);`), label)
  for (const [label, code] of F.CATEGORY_OPTS) assert.match(tabJava, new RegExp(`c\\.put\\("${code}", "${label}"\\);`), label)
  // 列表接口认这几个参数
  const ctl = src('../RuoYi-Vue/ruoyi-kangaroo/src/main/java/com/ruoyi/kangaroo/controller/app/AppJobController.java')
  for (const p of ['payDay', 'payMonthMin', 'payMonthMax', 'categories', 'board']) assert.match(ctl, new RegExp(`@RequestParam\\(required = false\\) \\w+ ${p},`), p)
})

// ---------------------------------------------------------------- 胶囊行

test('胶囊文字：兼职「包住」「100元/天以上」，全职「民宿」「月薪 3000–4500」，点掉一个参数里就没了', () => {
  const part = { ...F.blankFilter(), cities: ['大理'], board: 'room', payDay: 100 }
  assert.deepEqual(F.filterChips('parttime', part).map(c => c.text), ['大理', '包住', '100元/天以上'])
  const full = { ...F.blankFilter(), cities: ['大理'], categories: ['homestay', 'food'], board: 'self', payMonth: 2 }
  assert.deepEqual(F.filterChips('fulltime', full).map(c => c.text), ['大理', '民宿', '咖啡餐饮', '不包食宿', '月薪 3000–4500'])
  // 兼职不列全职的条件，全职不列兼职的
  assert.deepEqual(F.filterChips('parttime', { ...full, payDay: 120 }).map(c => c.text), ['大理', '不包食宿', '120元/天以上'])
  assert.deepEqual(F.filterChips('fulltime', part).map(c => c.text), ['大理', '包住'])
  for (const [type, f] of [['parttime', part], ['fulltime', full]]) {
    const chips = F.filterChips(type, f)
    for (const c of chips) F.dropChip(f, c.key)
    assert.deepEqual(F.filterParams(type, f), {}, type)
    assert.equal(F.anyCondition(type, f), false)
  }
})

// ---------------------------------------------------------------- 换页签

test('换页签：新页签用不上的条件清掉，兼职 ↔ 全职的食宿带过去，城市照旧', () => {
  const vol = { ...F.blankFilter(), cities: ['大理'], gender: 'F', skills: ['做饭'], minStay: 15, workKind: 'photo', assured: true }
  assert.deepEqual(F.filterForTab('parttime', vol), { ...F.blankFilter(), cities: ['大理'] })
  const part = { ...F.blankFilter(), board: 'meal', payDay: 120 }
  const full = F.filterForTab('fulltime', part)
  assert.equal(full.board, 'meal', '食宿两边都有，带过去')
  assert.equal(full.payDay, 0, '日薪档不带到全职')
  const back = F.filterForTab('parttime', { ...full, payMonth: 3, categories: ['bar'] })
  assert.deepEqual([back.board, back.payDay, back.payMonth, back.categories], ['meal', 0, 0, []])
  assert.deepEqual(F.filterForTab('online', { ...part, task: '图片设计' }), { ...F.blankFilter(), task: '图片设计' })
  // 拷贝出来的数组不和原来的共用
  const src2 = { ...F.blankFilter(), categories: ['bar'] }
  const copy = F.filterForTab('fulltime', src2)
  copy.categories.push('hotel')
  assert.deepEqual(src2.categories, ['bar'])
})

function listHarness() {
  const calls = []
  let onLoad = null
  const h = runSetup('pages/jobs/list.vue', {
    ...F,
    useScreen: (n, opts) => { onLoad = opts && opts.onLoad; return vue.ref(1) },
    absUrl: x => x,
    toast() {},
    uni: { pageScrollTo() {} },
    nextTick: (fn) => (fn ? Promise.resolve().then(fn) : Promise.resolve()),
    getCurrentInstance: () => null,
    apiJobList: async (params) => { calls.push(plain(params)); return { rows: [], total: params.pageSize === 1 ? 5 : 2, hasMore: false } },
    apiJobKinds: async () => ({ data: kinds }),
    apiJobSubs: async () => ({ data: [] }),
    checkNoticePopup() {},
    noticePopup: vue.reactive({ show: false }),
    go: (u) => calls.push({ go: u }),
    R: { jobsFilter: '/pages/jobs/filter', jobDetail: '/pages/jobs/detail' }
  })
  return { ...h, calls, load: (q) => onLoad && onLoad(q) }
}

test('列表页点页签：清掉新页签用不上的条件、带上食宿，按新页签自己的参数拉；胶囊行跟着变', async (t) => {
  const h = listHarness()
  t.after(h.stop)
  h.load({ type: 'parttime', city: '大理' })
  h.run('pageVisible = true')  // 页面在前台：换页签时按新页签重新拉
  h.run(`Object.assign(sel.parttime, { board: 'room', payDay: 100 })`)
  await h.run('fetchJobs(1)')
  assert.deepEqual(h.calls.at(-1), { type: 'parttime', cities: '大理', board: 'room', payDay: 100, pageNum: 1, pageSize: 20 })
  assert.deepEqual(plain(h.run('chips.value')).map(c => c.text), ['大理', '包住', '100元/天以上'])
  // 全职那边之前留着的条件（类型、月薪）换过来时被清掉，食宿带过去
  h.run(`Object.assign(sel.fulltime, { categories: ['bar'], payMonth: 3 })`)
  h.run('switchTab(3)')
  assert.equal(h.run('s.value'), 3)
  assert.deepEqual(plain(h.run('sel.fulltime')), { ...F.blankFilter(), board: 'room' })
  assert.deepEqual(plain(h.run('chips.value')).map(c => c.text), ['大理', '包住'])
  await flush()
  assert.deepEqual(h.calls.at(-1), { type: 'fulltime', cities: '大理', board: 'room', pageNum: 1, pageSize: 20 })
  // 再换到换宿：食宿不适用，清掉；城市还在
  h.run('switchTab(1)')
  await flush()
  assert.deepEqual(h.calls.at(-1), { type: 'volunteer', cities: '大理', pageNum: 1, pageSize: 20 })
  assert.deepEqual(plain(h.run('chips.value')).map(c => c.text), ['大理'])
  // 点当前页签不清条件
  h.run(`sel.volunteer.gender = 'F'`)
  h.run('switchTab(1)')
  assert.equal(h.run('sel.volunteer.gender'), 'F')
})

test('列表页面板：全职选类型 + 月薪，草稿实时数一下，点「确定」按 categories / payMonthMin / payMonthMax 拉', async (t) => {
  const h = listHarness()
  t.after(h.stop)
  h.load({ type: 'fulltime' })
  h.run('toggleFilter()')
  h.run(`onPick('categories', 'homestay'); onPick('categories', 'hotel'); onPick('payMonth', '1')`)
  await sleep(450)
  assert.deepEqual(h.calls.at(-1), { type: 'fulltime', categories: 'homestay,hotel', payMonthMax: 3000, pageNum: 1, pageSize: 1 })
  assert.equal(h.run('draftCount.value'), 5)
  h.run('onConfirm()')
  await flush()
  assert.deepEqual(h.calls.at(-1), { type: 'fulltime', categories: 'homestay,hotel', payMonthMax: 3000, pageNum: 1, pageSize: 20 })
  assert.deepEqual(plain(h.run('chips.value')).map(c => c.text), ['民宿', '酒店', '月薪 3000以下'])
  // 点掉「酒店」胶囊：只剩民宿
  await h.run(`removeChip('categories:hotel')`)
  await flush()
  assert.equal(h.calls.at(-1).categories, 'homestay')
})

// ---------------------------------------------------------------- 面板版面：顶上一行已选城市（2026-10-17 去掉过，2026-10-18 按主人效果图 42 加回来）

test('城市在面板外独立选择，面板重置不清除城市', (t) => {
  const panel = sfc('pages/jobs/components/job-filter-panel.vue')
  assert.doesNotMatch(panel.template.content, /fp__city|已选城市|更换城市/)
  assert.equal(F.PANEL_CITY_H, 0)
  const h = listHarness()
  t.after(h.stop)
  h.run("draft.cities = ['丽江']; draft.board = 'room'; onReset()")
  assert.deepEqual(JSON.parse(h.run('JSON.stringify(draft.cities)')), ['丽江'])
  assert.equal(h.run('draft.board'), '')
  h.run('clearTimeout(countTimer)')
})

// ---------------------------------------------------------------- 地址参数

test('地址参数来回一致：filterQuery → 地址 → filterFromQuery 还原这个页签的条件，别的页签的条件不认', () => {
  const cases = [
    ['volunteer', { ...F.blankFilter(), cities: ['大理', '丽江'], gender: 'F', skills: ['做饭', '摄影'], restModes: ['5-2'], minStay: 15, roomTypes: ['single'], assured: true, workKind: 'photo' }],
    ['parttime', { ...F.blankFilter(), cities: ['平潭'], board: 'self', payDay: 120 }],
    ['fulltime', { ...F.blankFilter(), cities: ['大理'], categories: ['homestay', 'other'], board: 'all', payMonth: 2 }],
    ['online', { ...F.blankFilter(), cities: ['大理'], task: '图片设计' }]
  ]
  for (const [type, f] of cases) {
    const url = '/pages/jobs/list?' + F.queryString(F.filterQuery(type, f))
    const q = Object.fromEntries(new URLSearchParams(url.split('?')[1]))
    assert.equal(q.type, type)
    const back = F.filterFromQuery(q)
    // 线上任务的城市不进地址
    assert.deepEqual(back, type === 'online' ? { ...F.filterForTab(type, f), cities: [] } : F.filterForTab(type, f), type)
    assert.deepEqual(F.filterParams(type, back), F.filterParams(type, f), type)
  }
  assert.deepEqual(F.filterQuery('parttime', { ...F.blankFilter(), cities: ['大理'], board: 'room', payDay: 80, gender: 'F' }), { type: 'parttime', cities: '大理', board: 'room', payDay: '80' })
  // 别的页签的条件、不认识的取值都丢掉
  const junk = F.filterFromQuery({ type: 'parttime', gender: 'F', kind: 'photo', payDay: '90', payMonth: '2', board: 'part', categories: 'bar' })
  assert.deepEqual(junk, F.blankFilter())
  assert.deepEqual(F.filterFromQuery({ type: 'fulltime', categories: 'bar,cafe,bar', payMonth: '9', board: 'meal' }), { ...F.blankFilter(), categories: ['bar'], board: 'meal' })
  // 不带 type = 换宿旅行（老入口 ?kind= 照旧）
  assert.equal(F.filterFromQuery({ kind: 'photo' }).workKind, 'photo')
  assert.equal(F.filterFromQuery({ type: 'parttime', kind: 'photo' }).workKind, '')
})

test('列表页地址带了这个页签的条件就按它拉；小铃铛进订阅屏带上 type + 城市 + 这个页签的条件', async (t) => {
  const h = listHarness()
  t.after(h.stop)
  h.load({ type: 'parttime', cities: '大理', board: 'meal', payDay: '100', gender: 'F' })
  await h.run('fetchJobs(1)')
  assert.deepEqual(h.calls.at(-1), { type: 'parttime', cities: '大理', board: 'meal', payDay: 100, pageNum: 1, pageSize: 20 })
  h.run('s.value = 2')
  h.run('openNewSub()')
  assert.deepEqual(h.calls.at(-1), { go: '/pages/jobs/filter?s=2&type=parttime&cities=' + encodeURIComponent('大理') + '&board=meal&payDay=100' })
})

// ---------------------------------------------------------------- 「筛选条件」页（filter.vue）兼职 / 全职用同一组条件

function filterHarness() {
  const searches = []
  let onLoad = null
  const h = runSetup('pages/jobs/filter.vue', {
    ...F,
    dropTabChip: F.dropChip,
    useScreen: (n, opts) => { onLoad = opts && opts.onLoad; return vue.ref(1) },
    ensureSession: async () => {},
    experience: { cities: ['大理'] },
    apiCities: async () => ({ data: { hot: ['丽江'] } }),
    apiJobKinds: async () => ({ data: kinds }),
    apiJobSubs: async () => ({ data: [] }),
    apiJobSearch: async (b) => { searches.push(plain(b)); return { data: { jobs: [], total: 4 } } },
    toast() {}, go() {}, back() {}, absUrl: x => x,
    todayCn: () => '2026-10-17', shiftDate: (d) => d, errText: (e, f) => f
  })
  return { ...h, searches, load: (q) => onLoad && onLoad(q) }
}

test('「筛选条件」页：兼职 / 全职只显示列表面板那几组（没有可到岗日期、安心保障），发给 /app/job/search 的条件同一口径', async (t) => {
  const h = filterHarness()
  t.after(h.stop)
  await h.load({ type: 'fulltime', cities: '大理', categories: 'homestay', board: 'self', payMonth: '3' })
  await flush()
  assert.equal(h.run('tabMode.value'), true)
  const groups = plain(h.run('filterGroups.value')).map(g => [g.title, g.options, g.selected, g.cols])
  assert.deepEqual(groups, [
    ['店铺类型', ['民宿', '酒店', '咖啡餐饮', '酒吧', '其他'], [0], 3],
    ['食宿条件', ['包吃包住', '包住', '包吃', '不包食宿'], [3], 4],
    ['月薪（元/月）', ['3000以下', '3000–4500', '5000以上'], [2], 3]
  ])
  // 第一组右上角照旧能换岗位大类
  assert.equal(plain(h.run('filterGroups.value'))[0].meta, '全职旅行')
  assert.deepEqual(h.searches.at(-1), { cities: ['大理'], jobType: 'fulltime', board: 'self', payMonthMin: 5000, categories: ['homestay'] })
  // 点「月薪 3000–4500」「酒吧」
  h.run(`tapOption(filterGroups.value[2], 1); tapOption(filterGroups.value[0], 3)`)
  await sleep(450)
  assert.deepEqual(h.searches.at(-1), { cities: ['大理'], jobType: 'fulltime', board: 'self', payMonthMin: 3000, payMonthMax: 4500, categories: ['homestay', 'bar'] })
  assert.deepEqual(plain(h.run('chips.value')).map(c => c.label), ['大理 ×', '全职旅行 ×', '民宿 ×', '酒吧 ×', '不包食宿 ×', '月薪 3000–4500 ×'])
  // 模板：可到岗日期、安心保障在兼职 / 全职不显示；胶囊列数跟着选项个数走
  assert.match(h.template, /<view v-if="!isOnline && !tabMode" class="sec sec--line" hover-class="k-press" @click="pickFrom">/)
  assert.match(h.template, /<view v-if="!isOnline && !tabMode" class="sec"><view class="sec-head"><text class="sec-head__title">安心保障<\/text>/)
  assert.match(h.template, /<view class="pills" :class="'pills--' \+ \(group\.cols \|\| 5\)">/)
  assert.match(sfc('pages/jobs/filter.vue').styles.map(s => s.content).join('\n'), /\.pills--4 \{ grid-template-columns: repeat\(4, minmax\(0, 1fr\)\); \}/)
  // 放宽建议：薪资档 / 类型
  h.run(`applyRelax({ key: 'payBand' }); applyRelax({ key: 'categories' })`)
  assert.equal(h.run('tf.payMonth'), 0)
  assert.deepEqual(plain(h.run('tf.categories')), [])
  await sleep(500)
})

test('「筛选条件」页：兼职 = 食宿 / 日薪；换宿照旧是原来那几组（时长 / 换工类型 / 工时 / 食宿）', async (t) => {
  const h = filterHarness()
  t.after(h.stop)
  await h.load({ type: 'parttime', board: 'room', payDay: '80' })
  await flush()
  assert.deepEqual(plain(h.run('filterGroups.value')).map(g => [g.title, g.selected, g.cols]), [['食宿条件', [1], 4], ['日薪（元/天）', [0], 2]])
  assert.deepEqual(h.searches.at(-1), { cities: [], jobType: 'parttime', board: 'room', payDay: 80, categories: [] })
  h.run('reset()')
  await sleep(450)
  assert.deepEqual(h.searches.at(-1), { cities: [], jobType: 'parttime', board: 'none', categories: [] })

  const v = filterHarness()
  t.after(v.stop)
  await v.load({ type: 'volunteer' })
  await flush()
  assert.equal(v.run('tabMode.value'), false)
  assert.deepEqual(plain(v.run('filterGroups.value')).map(g => g.title), ['最低在店时长', '换工类型', '每天工时（小时）', '食宿'])
  await sleep(450)
})
