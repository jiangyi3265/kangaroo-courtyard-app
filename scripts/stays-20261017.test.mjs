// 2026-10-17 旅居改版 R1（主人效果图 5 订房入口 / 6 小院列表 / 7 小院详情，只用现有数据）的回归（node --test，不构建、不发请求）。
// 守住这几件事：
//   · 列表标题 = 城市 + 房源（丽江房源），没城市时「全部房源」；
//   · 位置 / 价格 / 房型 / 排序是标题下展开的面板，不再跳整页筛选；整页筛选从「更多筛选」进；
//   · 选项胶囊每一行都铺满、不留空洞（主人：「不要双人间底下是空着的」）；
//   · 来源改名 袋鼠直营 / 袋鼠合作（只改住客端显示，后端标签员工端还在用）；
//   · 详情页选房型 → 底部「已选：…」→ 立即预订带 roomTypeId；
//   · 现有数据撑不起的块（出行参考、3 分钟看小院、生活碎片）不出现，主理人什么都没填时主理人卡不出现。
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'
import test from 'node:test'
import assert from 'node:assert/strict'
import * as ui from '../pages/stays/stays-ui.js'

const APP = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const require = createRequire(path.join(APP, 'package.json'))
const compiler = require('@vue/compiler-sfc'), vue = require('vue')
const readSfc = (rel) => compiler.parse(fs.readFileSync(path.join(APP, rel), 'utf8').replace(/\r\n/g, '\n'), { filename: rel }).descriptor
const flush = () => new Promise(resolve => setImmediate(resolve))
const noComments = (t) => t.replace(/<!--[\s\S]*?-->/g, '')
const list = readSfc('pages/stays/list.vue')
const detail = readSfc('pages/stays/detail.vue')
const listT = list.template.content
const detailT = detail.template.content
const listCss = list.styles.map(s => s.content).join('\n')
const detailCss = detail.styles.map(s => s.content).join('\n')

// 把 list.vue 的 <script setup> 放进沙箱跑：import 进来的接口换成记录参数的假函数，stays-ui.js 用真的
// 2026-10-17 R2：位置面板多了区县一组（/app/stay/districts，list.vue 里直接用 request.js 的 get 调），districts 不传时这座城市没有区县
function runList({ areas = [{ area: '大理古城', count: 3 }, { area: '双廊', count: 1 }], districts = [], all = 0, stubs = {} } = {}) {
  const source = list.scriptSetup.content
  const ast = compiler.babelParse(source, { sourceType: 'module' })
  const body = ast.program.body.filter(n => n.type !== 'ImportDeclaration').map(n => source.slice(n.start, n.end)).join('\n')
  const sandbox = { console, setTimeout, clearTimeout, setInterval, clearInterval }
  for (const n of ast.program.body.filter(n => n.type === 'ImportDeclaration')) for (const s of n.specifiers) sandbox[s.local.name] = () => new Promise(() => {})
  const calls = [], toasts = [], screen = {}, unmount = []
  Object.assign(sandbox, ui, {
    stayBookingEnabled: vue.ref(true), refreshFeatures: async () => ({ stayBookingEnabled: true }),
    ref: vue.ref, reactive: vue.reactive, computed: vue.computed, watch: vue.watch, onUnmounted(fn) { unmount.push(fn) }, onReachBottom() {},
    useScreen: (max, extra) => { screen.s = vue.ref(1); screen.extra = extra; return screen.s },
    stayState: vue.reactive({ city: '', checkIn: '2026-10-17', checkOut: '2026-10-18', guests: 1 }), normalizeDates() {}, saveStayState() {},
    dotText: (ymd) => { const m = /^\d{4}-(\d{2})-(\d{2})$/.exec(ymd || ''); return m ? `${+m[1]}.${+m[2]}` : '' },
    apiStayCities: async () => ({ data: [{ city: '大理', count: 4 }] }), apiStayAreas: async () => ({ data: areas }),
    get: async (url) => (url === '/app/stay/districts' ? { data: { city: '大理', all, districts } } : { data: { all: [] } }),
    apiStayList: async (p) => { calls.push(p); return { data: { rows: [], total: 0, hasMore: false, counts: { all: 0, direct: 0, managed: 0 } } } },
    yuan: (fen) => String(Number(fen) / 100), errText: (e, d) => d,
    experience: vue.reactive({ cities: [] }), toast: (t) => toasts.push(t), uni: { getStorageSync() {}, setStorageSync() {} }, ...stubs
  })
  vm.createContext(sandbox)
  const scope = vue.effectScope()
  scope.run(() => vm.runInContext(body + '\n;globalThis.__x = { dd, toggleDd, draft, applyDraft, resetDraft, toggleDraftFac, PANEL_FACS, roomOpts, bathOpts, areaChoices, areaSpans, applyArea, districtOpts, districtSpans, applyDistrict, pickPlace, facilities, facGridSpans, applyPrice, applySort, filter, sort, listTitle, srcTabs, search, kw, setSrc, src, filterBar, loadPromos, promo, previewTotal, promoError, promoLoaded }', sandbox, { filename: 'list.vue:script-setup' }))
  return { x: sandbox.__x, calls, toasts, screen, state: sandbox.stayState, stop: () => { unmount.forEach(fn => fn()); scope.stop() } }
}
const lastList = (calls) => calls.filter(p => p.pageSize !== 1).slice(-1)[0]

function deferred() {
  let resolve, reject
  const promise = new Promise((ok, fail) => { resolve = ok; reject = fail })
  return { promise, resolve, reject }
}

test('切换城市时，晚到的上一城特价不能覆盖当前城市', async () => {
  const a = deferred(), b = deferred()
  const h = runList({ stubs: { apiStayPromos: city => city === '大理' ? a.promise : b.promise, serverTs: () => 0, setInterval: () => 1 } })
  h.state.city = '大理'
  const first = h.x.loadPromos()
  h.state.city = '平潭'
  const next = h.x.loadPromos()
  b.resolve({ data: { rows: [{ promoId: 2 }] } })
  await next
  a.resolve({ data: { rows: [{ promoId: 1 }] } })
  await first
  assert.equal(h.x.promo.value.rows[0].promoId, 2)
  h.stop()
})

test('离开页面后，晚到的早鸟活动不会启动倒计时', async () => {
  const offer = deferred()
  let timers = 0
  const h = runList({ stubs: { apiStayPromos: () => offer.promise, serverTs: () => 0, setInterval: () => ++timers } })
  const pending = h.x.loadPromos()
  h.stop()
  offer.resolve({ data: { rows: [], nearestSaleEnd: '2026-12-31 18:00:00' } })
  await pending
  assert.equal(timers, 0)
})

test('筛选房源数量只使用最新条件，先查后到的结果不能覆盖', async () => {
  const a = deferred(), b = deferred(), calls = []
  const h = runList({ stubs: { apiStayList: q => { calls.push(q); return calls.length === 1 ? a.promise : b.promise } } })
  h.screen.s.value = 4
  await new Promise(resolve => setTimeout(resolve, 360))
  h.x.filter.room = '双人间'
  await new Promise(resolve => setTimeout(resolve, 360))
  assert.equal(calls.length, 2)
  b.resolve({ data: { total: 1 } })
  await flush()
  a.resolve({ data: { total: 27 } })
  await flush()
  assert.equal(h.x.previewTotal.value, 1)
  h.stop()
})

test('点一次查找房源只取一次列表第一页', async () => {
  const h = runList()
  h.x.search()
  await flush()
  assert.equal(h.calls.filter(x => x.pageSize === 10 && x.pageNum === 1).length, 1)
  h.stop()
})

test('早鸟直达链接等旅居开关确认后只请求一次，查询失败可在本页重试', async () => {
  const flag = vue.ref(false), gate = deferred()
  let requests = 0
  const h = runList({ stubs: {
    stayBookingEnabled: flag, watchStayGate: vue.watch, refreshFeatures: () => gate.promise, serverTs: () => 0,
    apiStayPromos: async () => {
      if (++requests === 1) throw new Error('网络未连接')
      return { data: { rows: [{ promoId: 3 }] } }
    }
  } })
  h.screen.extra.onLoad({ city: '平潭', view: 'promo' })
  await flush()
  assert.equal(requests, 0)
  flag.value = true
  gate.resolve({ stayBookingEnabled: true })
  await flush()
  assert.equal(requests, 1)
  assert.equal(h.x.promoLoaded.value, false)
  assert.ok(h.x.promoError.value)
  await h.x.loadPromos()
  assert.equal(h.x.promoError.value, '')
  assert.equal(h.x.promo.value.rows[0].promoId, 3)
  h.stop()
})

test('列表标题：城市 + 房源；还没定城市时「全部房源」；顶栏用它', async () => {
  assert.equal(ui.cityTitle('丽江'), '丽江房源')
  assert.equal(ui.cityTitle(' 哈尔滨 '), '哈尔滨房源')
  assert.equal(ui.cityTitle(''), '全部房源')
  assert.equal(ui.cityTitle(null), '全部房源')
  // 2026-10-19 一比一还原：标题改成靠左的超粗大字（顶栏左侧插槽），仍是 listTitle
  assert.match(listT, /<k-topbar back custom-back @back="s = 1">\s*<template #left><text class="ltitle k-display"[^\n]*>\{\{ listTitle \}\}<\/text><\/template>/)
  assert.ok(!listT.includes('title="全部房源"'), '标题不再写死')
  const h = runList()
  h.screen.extra.onLoad({ city: '大理' }); await flush(); await flush()
  assert.equal(h.x.listTitle.value, '大理房源')
  h.stop()
})

test('不留空洞：evenSpans 每行加起来正好 12 栏，5 个排成 3 + 2', () => {
  assert.deepEqual(ui.evenSpans(5, 3), [4, 4, 4, 6, 6], '不限/单人间/双人间 一行，男生/女生多人间 各占半行')
  assert.deepEqual(ui.evenSpans(8, 4), [3, 3, 3, 3, 3, 3, 3, 3])
  assert.deepEqual(ui.evenSpans(7, 4), [3, 3, 3, 3, 4, 4, 4])
  assert.deepEqual(ui.evenSpans(1, 3), [12])
  assert.deepEqual(ui.evenSpans(0, 3), [])
  for (const max of [1, 2, 3, 4]) for (let n = 1; n <= 20; n++) {
    const spans = ui.evenSpans(n, max)
    assert.equal(spans.length, n)
    let row = 0
    for (const sp of spans) { assert.ok(Number.isInteger(sp) && sp >= 12 / max, `${n}/${max}`); row += sp; if (row === 12) row = 0; assert.ok(row < 12) }
    assert.equal(row, 0, `n=${n} max=${max} 最后一行没铺满`)
  }
})

// 2026-10-18：价格改成四档、评分四档（主人效果图四列一行），订房入口四组都用四列等宽的 grid4（stays-20261018.test.mjs 里还有更细的检查）
test('不留空洞：原稿五个房型排成三加二，价格与评分四档、卫浴三项', () => {
  const script = list.scriptSetup.content
  const literal = (name) => new Function('return ' + new RegExp(`const ${name} = (\\[[^\\]]*\\])`).exec(script)[1])()
  const cols = (cls) => Number(new RegExp(`\\.${cls} \\{ grid-template-columns: repeat\\((\\d), minmax\\(0, 1fr\\)\\);`).exec(listCss)[1])
  assert.equal(cols('opts--room'), 6)
  assert.equal(literal('roomOpts').length, 5)
  assert.match(listCss, /\.opts--room \.opt \{ grid-column: span 2;/)
  assert.match(listCss, /\.opts--room \.opt:nth-child\(n\+4\) \{ grid-column: span 3;/)
  assert.equal(literal('priceOpts').length % cols('opts--4'), 0)
  assert.equal(literal('bathOpts').length % cols('opts--3'), 0)
  assert.equal(literal('scoreOpts').length % cols('opts--4'), 0)
  for (const [list, grid] of [['roomOpts', 'opts--room'], ['bathOpts', 'opts--3'], ['priceOpts', 'opts--4'], ['scoreOpts', 'opts--4']]) {
    for (const m of listT.matchAll(new RegExp(`<view class="opts ${grid}[^"]*">\\s*<view v-for="o in ${list}"`, 'g'))) assert.ok(m, list)
  }
  // 价格每一档都有对应的价格区间参数
  const range = new Function('return ' + /const PRICE_RANGE = (\{[^\n]*\})/.exec(script)[1])()
  for (const o of literal('priceOpts').filter(x => x !== '不限')) assert.ok(range[o], o)
  // 下拉面板里个数跟着数据变的（位置、商圈）和价格用 12 栏 + evenSpans 算出来的宽度
  assert.match(listCss, /\.grid12 \{ display: grid; grid-template-columns: repeat\(12, minmax\(0, 1fr\)\);/)
  for (const v of ['areaSpans', 'priceSpans', 'districtSpans']) assert.ok(listT.includes(`:style="'grid-column: span ' + ${v}[i]"`), v)
  // 10-19 复查（主人：「里面的什么房型，要一样的，不要双人间底下是空着的，要排列好看」）：「房型」面板三组按个数定列数，
  // 同组胶囊一样大、每行排满 —— 房型和订房入口同一组 roomOpts（8 个四列）、卫浴 3 个三列、配套设施 5 个五列；不再用半行宽的格子凑
  const gcols = (n) => Number(new RegExp(`\\.gcols--${n} \\{ grid-template-columns: repeat\\((\\d), minmax\\(0, 1fr\\)\\);`).exec(listCss)[1])
  const panel = listT.slice(listT.indexOf(`<view v-else-if="dd === 'room'"`), listT.indexOf('<view class="dd__ok"'))
  assert.match(panel, /<view class="gcols gcols--room">\s*<view v-for="o in roomOpts" :key="o" class="opt" :class="\{ on: draft\.room === o \}"/, '面板和完整筛选使用同一组五个房型')
  assert.match(panel, /<view class="gcols gcols--3">\s*<view v-for="o in bathOpts"/)
  assert.match(panel, /<view class="gcols gcols--5">\s*<view v-for="\(f, i\) in PANEL_FACS"/)
  assert.ok(!/roomSpans|panelRooms/.test(panel), '房型使用完整的统一选项')
  assert.match(listCss, /\.gcols--room \.opt:nth-child\(n\+4\) \{ grid-column: span 3;/)
  assert.equal(literal('bathOpts').length % gcols(3), 0)
  assert.match(panel, /grid-column: span.*panelFacSpans/)
  // 订房入口：卫浴三列（grid3），不在四列里空一格
})

test('四个下拉：点开在标题下展开面板，不跳整页筛选；房型面板改草稿、点「确定」才查', async () => {
  const top = listT.indexOf('<k-topbar back custom-back @back="s = 1">')
  assert.ok(top > 0)
  const bar = listT.slice(top, listT.indexOf('</k-topbar>', top))
  assert.match(bar, /class="filters__item"[^>]*@click="toggleDd\(f\.key\)"/)
  for (const k of ['area', 'price', 'room']) assert.ok(bar.includes(`dd === '${k}'`), k)
  assert.match(bar, /v-for="o in SORT_OPTS"/)
  assert.match(bar, /class="dd__reset" hover-class="k-press" @click="resetDraft">重置</)
  assert.match(bar, /class="dd__ok" hover-class="k-press-s" @click="applyDraft"><text>确定</)
  // 整页筛选还在：「更多筛选」进
  assert.match(listT, /class="more-filter" hover-class="k-press" @click="s = 4">[\s\S]*?更多筛选/)

  const h = runList()
  h.screen.extra.onLoad({ city: '大理' }); await flush(); await flush()
  h.screen.s.value = 2; await flush()
  const { x } = h
  assert.deepEqual([...x.filterBar.value.map(f => f.text)], ['位置', '价格', '房型', '排序'])
  x.toggleDd('room')
  assert.equal(x.dd.value, 'room')
  // 10-19：面板里的房型就是订房入口 / 整页筛选那一组 8 个（四列两行，每格一样大）
  assert.deepEqual([...x.roomOpts], ['不限', '单人间', '双人间', '男生多人间', '女生多人间'])
  assert.deepEqual([...x.bathOpts], ['不限', '独立卫浴', '公共卫浴'])
  x.draft.room = '女生多人间'
  x.draft.bath = '公共卫浴'
  x.toggleDraftFac(x.PANEL_FACS[1])
  x.toggleDraftFac(x.PANEL_FACS[2])
  assert.equal(x.filter.room, '不限', '没点确定之前不改真正的条件')
  const before = h.calls.length
  x.applyDraft(); await flush()
  assert.equal(x.dd.value, '')
  const p = lastList(h.calls.slice(before))
  assert.equal(p.roomSize, 'dorm_female')
  assert.equal(p.bath, 'shared')
  assert.equal(p.facilities, 'ac')
  assert.equal(p.cookable, 1)
  assert.equal(x.filterBar.value[2].set, true)
  // 再打开：草稿从当前条件开始；重置只清草稿
  x.toggleDd('room')
  assert.equal(x.draft.room, '女生多人间')
  x.resetDraft()
  assert.equal(x.draft.room, '不限')
  assert.equal(x.filter.room, '女生多人间')
  x.toggleDd('room')
  assert.equal(x.dd.value, '', '再点一次同一个胶囊收起')
  // 完整筛选与下拉面板的选择保持同步。
  x.filter.room = '男生多人间'
  x.toggleDd('room')
  assert.equal(x.draft.room, '男生多人间')
  assert.ok(x.roomOpts.includes('男生多人间'))
  // 位置：第一组「全部位置」（R2 起和区县在一组），第二组商圈；点了直接查
  x.toggleDd('area')
  assert.deepEqual([...x.districtOpts.value.map(o => o.label)], ['全部位置'])
  assert.deepEqual([...x.areaChoices.value.map(o => o.label)], ['大理古城(3)', '双廊(1)'])
  assert.deepEqual([...x.areaSpans.value], [6, 6])
  x.applyArea('双廊'); await flush()
  assert.equal(lastList(h.calls).area, '双廊')
  x.applyPrice('¥200–400'); await flush()
  assert.deepEqual([lastList(h.calls).priceMinFen, lastList(h.calls).priceMaxFen], [20000, 40000])
  x.applySort('price_asc'); await flush()
  assert.equal(lastList(h.calls).sort, 'price_asc')
  assert.equal(x.dd.value, '')
  h.stop()
})

test('位置面板：这个城市没有区县、也没有商圈时只有「全部位置」+ 一句说明', async () => {
  const h = runList({ areas: [] })
  h.screen.extra.onLoad({ city: '大理' }); await flush(); await flush()
  h.x.toggleDd('area')
  assert.deepEqual([...h.x.districtOpts.value.map(o => o.label)], ['全部位置'])
  assert.deepEqual([...h.x.districtSpans.value], [12])
  assert.deepEqual([...h.x.areaChoices.value], [])
  assert.match(listT, /<text v-if="!areasLoading && !areasError && !districtRows\.length && !areaRows\.length" class="dd__empty">这个城市的房源还没有细分区域，先看全部位置<\/text>/)
  h.stop()
})

test('来源改名：袋鼠直营 / 袋鼠合作（页签、整页筛选、卡片、详情）；后端标签不动（员工端在用）', async () => {
  assert.equal(ui.srcLabel('direct'), '袋鼠直营')
  assert.equal(ui.srcLabel(''), '袋鼠直营')
  assert.equal(ui.srcLabel('managed'), '袋鼠合作')
  assert.equal(ui.srcLabel('franchise'), '袋鼠合作')
  const h = runList()
  assert.deepEqual([...h.x.srcTabs.value.map(t => t.label)], ['全部', '袋鼠直营', '袋鼠合作'])
  h.x.setSrc('agent'); await flush()
  assert.equal(h.x.filter.source, '袋鼠合作')
  assert.equal(lastList(h.calls).operateMode, 'managed')
  h.stop()
  const script = list.scriptSetup.content
  assert.match(script, /const srcOpts = \['不限', '袋鼠直营', '袋鼠合作'\]/)
  assert.match(script, /const SRC_MODE = \{ direct: 'direct', agent: 'managed', 袋鼠直营: 'direct', 袋鼠合作: 'managed' \}/)
  for (const t of [listT, detailT]) assert.ok(!/operateModeLabel|代运营/.test(noComments(t)), '住客端不再显示「直营 / 代运营」')
  assert.match(detail.scriptSetup.content, /text: srcLabel\(d\.value\.operateMode\), tone: 'src'/)
  // 员工端房源管理页还在用后端的 直营 / 代运营 / 加盟，后端 operateLabel 保持原样
  const java = fs.readFileSync(path.join(APP, '..', 'RuoYi-Vue', 'ruoyi-kangaroo', 'src', 'main', 'java', 'com', 'ruoyi', 'kangaroo', 'ext', 'stay', 'KgStayBrowseService.java'), 'utf8')
  assert.match(java, /"managed"\.equals\(opType\) \? "代运营" : \("franchise"\.equals\(opType\) \? "加盟" : "直营"\)/)
})

test('订房入口：查找房源带上城市、区域、日期、人数和关键词', async () => {
  assert.equal(ui.searchLine({ area: '大理古城', guests: 1, dates: '10.17-10.18', room: '不限', bath: '不限' }), '已选：大理古城 | 1人 | 10.17-10.18 | 不限房型')
  assert.equal(ui.searchLine({ area: '', guests: 2, dates: '10.17-10.19', room: '单人间', bath: '独立卫浴' }), '已选：全部区域 | 2人 | 10.17-10.19 | 单人间·独立卫浴')
  // 10-19 复查：「已选」固定两行（区域｜人数 / 日期｜房型），每行不拆
  assert.ok(!/function search\(\) \{[^}]*filter\.area = ''/.test(list.scriptSetup.content))
  const h = runList()
  h.screen.extra.onLoad({ city: '大理' }); await flush(); await flush()
  h.x.pickPlace('大理古城', '')
  h.state.guests = 3
  h.x.kw.value = '安静'
  h.x.search(); await flush()
  assert.equal(h.screen.s.value, 2)
  const params = lastList(h.calls)
  assert.equal(params.city, '大理')
  assert.equal(params.district, '大理古城')
  assert.equal(params.guests, 3)
  assert.equal(params.keyword, '安静')
  assert.equal(params.checkIn, '2026-10-17')
  assert.equal(params.checkOut, '2026-10-18')
  // 可租小院：当前城市第一页 4 条
  assert.ok(h.calls.some(p => p.city === '大理' && p.pageSize === 6 && p.pageNum === 1))
  h.stop()
  assert.match(listT, /<view v-if="previews\.length" class="k-grid-2 pv-grid pv-grid--catalog"/)
})

test('列表卡：「4.8分 127条评价」或暂无评价、「¥168起」、「可订 10.17-10.18」、底部小标签', () => {
  assert.deepEqual(ui.ratingParts('4.80', 127), { score: '4.8分', count: '127条评价' })
  assert.deepEqual(ui.ratingParts(5, 3), { score: '5.0分', count: '3条评价' })
  assert.equal(ui.ratingParts(null, 0), null)
  assert.equal(ui.ratingParts(4.5, 0), null, '没有评价时不显示评分')
  assert.equal(ui.dateRange('10.17', '10.18'), '10.17-10.18')
  const card = listT.slice(listT.indexOf('<view v-for="h in homes"'), listT.indexOf('<view v-if="listLoaded'))
  assert.match(card, /<text v-else class="home__meta">暂无评价<\/text>/)
  assert.match(card, /<text class="home__unit">\{\{ h\.priceLabel \}\}<\/text>/)
  // 2026-10-18：底部小标签一个一个画成浅色小胶囊（之前是「a | b | c」一行字）
  assert.match(card, /<view v-if="h\.tags\.length" class="home__tagline"><text v-for="t in h\.tags" :key="t" class="home__tag">\{\{ t \}\}<\/text><\/view>/)
  assert.match(card, /class="home__fav" hover-class="k-press-s" @click\.stop="toggleFav\(h\)"/)
})

test('详情：选择房型立即进入预订并带 roomTypeId；返回后立即预订仍保留所选房型', () => {
  assert.equal(ui.bookingQuery({ stayId: 12, roomTypeId: 5 }), 'stayId=12&roomTypeId=5')
  assert.equal(ui.bookingQuery({ stayId: 12, roomTypeId: 0, promoId: 4, vlogId: 9 }), 'stayId=12&promoId=4&vlogId=9')
  assert.equal(ui.pickedLine('单人间', '10.17-10.18', 1), '已选：单人间 | 10.17-10.18 | 1晚')
  assert.equal(ui.pickedLine('', '10.17-10.18', 2), '已选：未选房型 | 10.17-10.18 | 2晚')
  assert.equal(ui.fewLeft({ bookable: true, remain: 2 }), true)
  assert.equal(ui.fewLeft({ bookable: true, remain: 9 }), false)
  assert.equal(ui.fewLeft({ bookable: false, remain: 1 }), false)
  assert.equal(ui.roomLine({ capacity: 2, features: ['独立卫浴', '空调', '书桌'] }), '可住2人 | 独立卫浴 | 空调')
  const s = detail.scriptSetup.content
  // 跑一遍详情页的选房 + 预订
  const block = s.slice(s.indexOf('const pickedRoom = computed('), s.indexOf('const bookNow') + 'const bookNow = () => toBooking(pickedRoom.value)'.length)
  const gone = []
  const run = new Function('computed', 'ref', 'roomList', 'toast', 'pickedLine', 'datesText', 'nights', 'priceFrom', 'toBooking', 'selRoomId', 'pickedParts', 'roomsLoaded', 'roomsLoading', 'roomsError',
    block + ';return { pickRoom, pickedText, bookNow }')
  const C = (fn) => ({ get value() { return fn() } })
  const sel = { value: 0 }
  const toasts = []
  const rooms = { value: [{ roomTypeId: 1, name: '单人间', price: '168', bookable: true }, { roomTypeId: 3, name: '双人间', price: '268', bookable: false, reason: '满房' }] }
  const r = run(C, (v) => ({ value: v }), rooms, (t) => toasts.push(t), ui.pickedLine, { value: '10.17-10.18' }, { value: 1 }, { value: '6' },
    (room) => gone.push(ui.bookingQuery({ stayId: 100, roomTypeId: room && room.roomTypeId })), sel, ui.pickedParts, { value: true }, { value: false }, { value: '' })
  assert.equal(r.pickedText.value, '已选：未选房型 | 10.17-10.18 | 1晚')
  r.pickRoom(rooms.value[1])
  assert.equal(sel.value, 0, '满房的房型选不上')
  assert.match(toasts[0], /^满房/)
  r.pickRoom(rooms.value[0])
  assert.equal(r.pickedText.value, '已选：单人间 | 10.17-10.18 | 1晚')
  assert.deepEqual(gone, ['stayId=100&roomTypeId=1'])
  gone.length = 0
  r.bookNow()
  assert.deepEqual(gone, ['stayId=100&roomTypeId=1'])
  assert.match(s, /go\(R\.stayBooking \+ '\?' \+ bookingQuery\(\{ stayId, roomTypeId: room && room\.roomTypeId, promoId, vlogId: fromVlog \}\)\)/)
  assert.match(s, /const params = \{ checkIn: state\.checkIn, checkOut: state\.checkOut, guests: state\.guests/)
  assert.match(s, /apiStayRoomTypes\(stayId, params\)/)
  assert.match(detailT, /class="rt" :class="\{ on: selRoomId === r\.roomTypeId, off: !r\.bookable \}" hover-class="k-press-s" @click="pickRoom\(r\)"/)
  assert.match(detailT, /<view class="picked__text" :aria-label="pickedText"><text class="picked__seg">已选：<\/text><text v-for="\(p, i\) in pickedSegs"/)
  assert.deepEqual(ui.pickedParts('单人间', '10.17-10.18', 1), ['单人间', '10.17-10.18', '1晚'])
  assert.match(detailT, /class="book"[^>]*:aria-disabled="!canBook"[^>]*hover-class="k-press-s" @click="bookNow"><text class="book__main">\{\{ roomsLoading \? '查询中' : \(canBook \? \(d\.onlinePaymentAvailable === false \? '查看房态' : '立即预订'\) : '暂不可订'\) \}\}<\/text>/)
  const booking = fs.readFileSync(path.join(APP, 'pages/stays/booking.vue'), 'utf8')
  assert.match(booking, /selRoomId\.value = entryRoomId\.value \|\| null/)
  assert.match(booking, /s\.value = directCalendar\.value \? 2 : 1/)
})

test('详情：缺少资料保留待补充模块；主理人内容、视频按钮、图集按真实数据显示', () => {
  const t = noComments(detailT)
  // 2026-10-17 R2 起「出行参考」卡、主理人年龄 / 籍贯 / 擅长按数据显示（见 stays-r2-20261017.test.mjs）；
  // R3 起「3分钟看小院」「近期生活碎片」按数据显示（员工端上传了才有，见 stays-r3-20261017.test.mjs）：模板里只能挂在 v-if 后面，不写死文字
  for (const gone of ['3分钟看小院', '生活碎片']) assert.ok(!t.includes(gone), gone)
  assert.match(t, /<view v-if="introVideo" class="sec-card vcard">/)
  assert.match(t, /<view class="entry entry--diary"/)
  assert.match(t, /<view v-if="hasHost" class="sec-card host2">/)
  assert.match(t, /<view v-if="vlogs\.length" class="entry"/)
  assert.match(t, /<swiper v-if="gallery\.length > 1" class="hero" circular/)
  assert.match(t, /<text v-if="gallery\.length > 1" class="hero-count">/)
  assert.match(t, /<view v-if="host\.story" class="host2__story"/)
  assert.match(t, /<text v-else-if="roomsLoaded && !roomList\.length" class="list-empty">暂无可订房型<\/text>/)
  const s = detail.scriptSetup.content
  const hasHost = new Function('computed', 'host', /const hasHost = (computed\([^\n]*\))/.exec(s)[1] + '')
  const C = (fn) => ({ get value() { return fn() } })
  const evalHost = (h) => new Function('computed', 'host', 'return ' + /const hasHost = (computed\([^\n]*\))/.exec(s)[1])(C, { value: h }).value
  assert.equal(typeof hasHost, 'function')
  assert.equal(evalHost({ storeId: 7 }), false, '只有门店编号、主理人什么都没填：不出主理人卡')
  assert.equal(evalHost({ name: '阿桑' }), true)
  assert.equal(evalHost({ intro: '在大理住了 6 年' }), true)
  // 没有评价时写「暂无家人评价」；图集 = 封面 + images 去重
  assert.match(s, /'暂无家人评价'\)\)/)
  const gallery = new Function('computed', 'd', 'return ' + /const gallery = (computed\([^\n]*\))/.exec(s)[1])(C, { value: { cover: 'a.jpg', images: ['a.jpg', 'b.jpg', ''] } }).value
  assert.deepEqual(gallery, ['a.jpg', 'b.jpg'])
  // 昨天的整卡可点的地址卡保留
  assert.match(t, /class="location" @click="openMap">/)
  assert.match(detailCss, /\.info \{ position: relative; z-index: 1; margin: -26px 12px 0;/)
})
