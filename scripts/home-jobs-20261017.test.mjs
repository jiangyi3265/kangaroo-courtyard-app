// 10-17 改版 R1（主人发来的效果图 2 / 图 4）：首页首屏 + 岗位列表筛选面板（node --test，不需要构建、不发请求）。
// 守住这几件事：
//   · 筛选面板：每组左边固定宽度的组名一列，右边选项 3 列等宽网格（折行后对齐到第一个选项下面），提示在选项下面一行，
//     太长的选项（安心保障）占满一行；选中 = 浅暖底 + 暖棕描边 + 深棕粗字；底部「确定」渐变实心；
//   · 面板整块停在底栏上面：底栏 56 + 「发布」凸起 20 + 8px 空隙 + 安全区（job-filters.tabbarClearance / panelLayout），
//     胶囊行被吸顶的顶栏盖住一截时面板改成贴着顶栏下沿固定，胶囊行不抬到顶栏上面；选城市侧面板同样停在底栏上面；
//   · 首页（定位）城市不再自动塞进岗位筛选：首页岗位入口不带 ?city=，进列表就是全部城市；「筛选条件」页、订阅页默认也不选城市；
//     城市页「做什么」、社区等明确带了 ?city= 的照旧按带来的城市；旅居订房入口照旧带首页城市；首页城市胶囊照旧显示定位城市。
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
const css = (rel) => sfc(rel).styles.map(s => s.content).join('\n')
const rule = (style, sel) => (style.match(new RegExp(sel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ' \\{[^}]*\\}')) || [''])[0]
const F = await import(pathToFileURL(path.join(APP, 'pages/jobs/job-filters.js')).href)
const flush = () => new Promise(resolve => setImmediate(resolve))
const plain = (v) => JSON.parse(JSON.stringify(v))

/** 在沙箱里跑页面的 script setup：导入一律先给永远不返回的函数，再用 stubs 覆盖用得到的那几个（条件编译注释在这里不生效，两边的代码都会跑） */
function runSetup(rel, stubs) {
  const d = sfc(rel)
  // 首页定位用微信分支，网页端只在选城页主动定位。
  const source = rel === 'pages/home/index.vue'
    ? d.scriptSetup.content.replace(/^\s*\/\/ #ifndef MP-WEIXIN\b[\s\S]*?\/\/ #endif/gm, '')
    : d.scriptSetup.content
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

// ---------------------------------------------------------------- 筛选面板的版面

// 2026-10-17 第二次改（主人：筛选排得乱 + 城市已经单独选了）：面板里不再有「已选城市」一行，组名一律两个字、不再有说明小字，组和组之间一道浅线。
// 2026-10-18 主人效果图 42：顶上「已选城市 … 更换城市 ›」一行加回来（点了打开选城市面板，选完回到草稿；线上任务没有），其余不变
// 版面尺寸、滚动与可点击性在手机尺寸的浏览器测试中验证。
test('筛选保留完整条件标题、草稿城市入口和长选项，线上任务不显示城市', () => {
  const panel = sfc('pages/jobs/components/job-filter-panel.vue')
  const t = panel.template.content
  assert.doesNotMatch(t, /class="fp__city"/)
  assert.doesNotMatch(t, /@click="emit\('city'\)"/)
  assert.doesNotMatch(t, /'不限城市'/)
  assert.match(t, /@click="emit\('close'\)"/)
  assert.deepEqual(F.panelGroups('volunteer', F.blankFilter()).map(g=>g.title), ['性别偏好','技能需求','休息排班','可停留时长','住宿条件','卫浴条件','安心保障'])
  const style = panel.styles.map(s => s.content).join('\n')
  assert.match(rule(style, '.fp-opt__text'), /white-space: normal;/)
  assert.match(rule(style, '.fp-opt--wide'), /grid-column: 1 \/ -1;/)
})

test('面板条件组：太长的选项占满一行（安心保障、长的换工类型），字多的（「100元/天以上」）小一号字仍占一格，其余等宽排；不再有说明', () => {
  const kinds = [{ value: 'photo', label: '摄影换工' }, { value: 'long', label: '民宿管家兼前台接待' }]
  const vol = F.panelGroups('volunteer', F.blankFilter(), kinds)
  const wide = vol.flatMap(g => g.options.filter(o => o.wide).map(o => g.key + ':' + o.label))
  assert.deepEqual(wide, ['assured:经袋鼠实地拍摄并含保险', 'workKind:民宿管家兼前台接待'])
  for (const type of F.TYPES) for (const g of F.panelGroups(type, F.blankFilter(), kinds)) for (const o of g.options) {
    assert.equal(o.wide, F.textUnits(o.label) > F.WIDE_UNITS, o.label)
    assert.equal(o.long, F.textUnits(o.label) > F.LONG_UNITS && !o.wide, o.label)
  }
  const long = F.TYPES.flatMap(type => F.panelGroups(type, F.blankFilter(), kinds).flatMap(g => g.options.filter(o => o.long).map(o => o.label)))
  assert.deepEqual(long, ['80元/天以上', '100元/天以上', '120元/天以上'])
  // 「能待半个月」「3000–5000」放得下，正常字号
  assert.ok(F.textUnits('能待半个月') <= F.LONG_UNITS && F.textUnits('3000–5000') <= F.LONG_UNITS)
  // 所有页签的组都是同一种排法：组名 + 选项，没有说明
  for (const type of F.TYPES) for (const g of F.panelGroups(type, F.blankFilter(), kinds)) assert.deepEqual(Object.keys(g).sort(), ['key', 'long', 'options', 'title'], type + ':' + g.key)
})

// ---------------------------------------------------------------- 面板安全范围

test('半屏筛选覆盖底栏，选城市收起底栏，面板按钮避开系统手势区域', () => {
  const list = sfc('pages/jobs/list.vue').template.content
  assert.match(list, /<k-tabbar v-if="!cityOpen" active="home"/)
  assert.match(list, /<view v-if="filterOpen" class="jobs-filter"[^>]*role="dialog"/)
  const cp = css('pages/jobs/components/job-city-panel.vue')
  assert.match(rule(cp, '.cp__foot'), /padding: 8px 18px calc\(10px \+ var\(--k-safe-bottom\)\);/)
})

test('固定面板在不同高度下，按钮均位于安全区以内；线上任务释放城市栏空间', () => {
  for (const [win, safe] of [[568, 34], [844, 34], [736, 0], [640, 0], [420, 0]]) {
    const box = F.panelLayout({ windowHeight: win, navBottom: 88, safeBottom: safe })
    assert.equal(box.top, 96)
    assert.ok(box.bodyMax > 0)
    assert.equal(box.bottom, box.top + box.bodyMax + F.PANEL_HEAD_H + F.PANEL_FOOT_H + F.PANEL_CITY_H)
    assert.ok(box.bottom <= win - safe - 12)
    const online = F.panelLayout({ windowHeight: win, navBottom: 88, safeBottom: safe, online: true })
    assert.equal(online.bodyMax, box.bodyMax + F.PANEL_CITY_H)
  }
})

// ---------------------------------------------------------------- 列表页：量位置 + 不自动带城市

function listHarness({ rect = { top: 190, bottom: 220 }, win = 667 } = {}) {
  const calls = []
  let onLoad = null
  const query = { in() { return this }, select() { return this }, boundingClientRect(cb) { this.cb = cb; return this }, exec() { this.cb(rect) } }
  const h = runSetup('pages/jobs/list.vue', {
    ...F,
    useScreen: (n, opts) => { onLoad = opts && opts.onLoad; return vue.ref(1) },
    absUrl: x => x,
    toast() {},
    nextTick: (fn) => (fn ? Promise.resolve().then(fn) : Promise.resolve()),
    getCurrentInstance: () => null,
    apiJobList: async (params) => { calls.push(plain(params)); return { rows: [], total: 3, hasMore: false } },
    apiJobKinds: async () => ({ data: [] }),
    apiJobSubs: async () => ({ data: [] }),
    checkNoticePopup() {},
    noticePopup: vue.reactive({ show: false }),
    go() {},
    uni: { getSystemInfoSync: () => ({ windowHeight: win, screenHeight: win, safeArea: { bottom: win }, statusBarHeight: 20 }), createSelectorQuery: () => query, hideKeyboard() {} }
  })
  return { ...h, calls, load: (q) => onLoad && onLoad(q) }
}

test('打开筛选时使用窗口可用高度，页面滚动位置不影响面板', async (t) => {
  for (const rect of [{ top: 190, bottom: 220 }, { top: 40, bottom: 70 }]) {
    const h = listHarness({ rect })
    t.after(h.stop)
    h.load({ type: 'volunteer' })
    h.run('toggleFilter()')
    await flush()
    assert.equal(h.run('filterOpen.value'), true)
    assert.match(rule(css('pages/jobs/components/job-filter-panel.vue'), '.fp'), /height: 56vh; max-height: 56vh;/)
    assert.match(rule(css('pages/jobs/list.vue'), '.jobs-filter'), /position: fixed;[^}]*bottom: 0;/)
    h.run('filterOpen.value = false')
  }
})

test('不自动带定位城市：首页第一次定位到丽江后点「换工旅行」，岗位列表是全部城市（不带城市、没有城市胶囊）', async (t) => {
  // 首页：首次自动定位把丽江存成首页城市（城市胶囊显示丽江），但岗位入口不带它
  const gone = []
  const storage = {}
  const experience = vue.reactive({ cities: [], allCities: false })
  const home = runSetup('pages/home/index.vue', {
    useScreen: () => vue.ref(1), experience, go: (u) => gone.push(u), toast() {}, errText: (e, f) => f, absUrl: (u) => u,
    apiHomeFeed: async () => ({ data: { activities: [], stays: [] } }), checkNoticePopup() {},
    locateCity: async () => ({ name: '丽江' }),
    recruitmentEnabled: vue.ref(true), stayBookingEnabled: vue.ref(true), askOnVisit() {},
    savePreferences: (c) => { experience.cities = [...c] }, saveAllCities: (on) => { experience.allCities = !!on },
    todayCn: () => '2026-10-17', shiftDate: (d) => d,
    uni: { getSetting: ({success}) => success({ authSetting: { 'scope.userLocation': true } }), getStorageSync: (k) => storage[k], setStorageSync: (k, v) => { storage[k] = v }, pageScrollTo() {} },
    R: { jobsList: '/pages/jobs/list', staysList: '/pages/stays/list', city: '/pages/home/city', activity: '/pages/community/activity' }
  })
  t.after(home.stop)
  home.run('autoLocateOnce()')
  await flush()
  assert.equal(home.run('city.value'), '丽江', '首页城市胶囊照旧显示定位城市')
  home.run('entries.value.forEach(openEntry)')
  assert.deepEqual(gone, ['/pages/jobs/list?type=volunteer', '/pages/jobs/list?type=parttime', '/pages/jobs/list?type=fulltime', '/pages/jobs/list?type=online', '/pages/stays/list?city=' + encodeURIComponent('丽江')])
  // 岗位列表按首页给的地址打开：不带城市拉、胶囊行没有城市（露出「全部城市」），筛选面板里「已选城市」也是空的
  const q = Object.fromEntries(new URLSearchParams(gone[0].split('?')[1]))
  const list = listHarness()
  t.after(list.stop)
  list.load(q)
  await list.run('fetchJobs(0)')
  assert.equal(list.calls.at(-1).cities, undefined)
  assert.deepEqual(plain(list.run('cities.value')), [])
  assert.deepEqual(plain(list.run('chips.value')), [])
  list.run('toggleFilter()')
  assert.deepEqual(plain(list.run('draft.cities')), [])
  list.run('filterOpen.value = false')
  // 用户自己选了城市才有城市条件
  list.run('openCityLive()')
  list.run(`onCityConfirm(['大理'])`)
  await flush()
  assert.equal(list.calls.at(-1).cities, '大理')
})

test('城市页岗位入口也默认全国，显式筛选链接仍可传入城市', () => {
  assert.deepEqual(F.filterFromQuery({ type: 'volunteer' }).cities, [])
  assert.deepEqual(F.filterFromQuery({ type: 'volunteer', city: '大理' }).cities, ['大理'])
  assert.deepEqual(F.filterFromQuery({ cities: '大理,丽江' }).cities, ['大理', '丽江'])
  const city = src('pages/home/city.vue')
  assert.match(city, /const cityQuery = computed\(\(\) => \(city\.value === ALL \? '' : '\?city=' \+ encodeURIComponent\(city\.value\)\)\)/)
  assert.match(city, /route: R\.jobsList \}/)
  assert.doesNotMatch(city, /route: R\.jobsList \+/)
  // 首页只有旅居订房入口标了 withCity
  assert.match(src('pages/home/index.vue'), /go\(item\.route \+ \(item\.withCity && selectedCity\.value \?/)
})

test('「筛选条件」页、订阅页默认不选城市（之前默认塞首页城市）；带了 ?city= / ?cities= 照旧按带来的选；没选城市时写明「不选就是全部城市」', () => {
  const filter = src('pages/jobs/filter.vue')
  assert.match(filter, /const f = reactive\(\{ cities: \[\], fromDate: ''/)
  assert.match(filter, /function reset\(\) \{\n  Object\.assign\(tf, blankFilter\(\)\)\n  Object\.assign\(f, \{ cities: \[\], fromDate: ''/)
  assert.doesNotMatch(filter, /cities: \[home\]/)
  // 首页城市只是城市胶囊里的第一个快捷项（点了才选上）
  assert.match(filter, /cityOptions\.value = \[home, \.\.\.hot, '更多'\]/)
  assert.match(filter, /if \(q\.city !== undefined\) f\.cities = /)
  assert.match(filter, /hint: sub\.cities\.length \? '（可多选）' : '（不选就是全部城市）'/)
  assert.match(sfc('pages/jobs/filter.vue').template.content, /<text class="subscribe-card__hint">\{\{ group\.hint \}\}<\/text>/)
})

// 首页外观改版的浏览器覆盖见 acceptance/20261021-home-ui。
