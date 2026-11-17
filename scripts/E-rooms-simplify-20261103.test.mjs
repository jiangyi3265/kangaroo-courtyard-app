// 2026-11-03 主人：简化房源管理（E-rooms 组，node --test，不需要构建、不发请求）。
// 守住这几件事（每条都能说出「原来几个弹窗 → 现在几步」）：
//   K2 房态：原来卡片「房态」连弹 5 个系统框（选房型 / 选操作 / 开始日 / 结束日 / 填数），「查看本月房态」还是纯文字弹窗 →
//      现在直接进房型页第三屏（room-types.vue?s=3）：选房型 → 14 天小表 → 点一天出底部面板改价 / 改库存 / 关房 / 开房；整段改价「从…到…」+ 一个框 + 应用；
//   K3 「更多」瘦身：「提交审核 / 下架」按状态成了卡片第四个按钮（下架原因在卡片下面填，不弹系统框）；商圈 / 位置描述 / 封面并进编辑表单；「更多」只剩 4 项；
//   K4 更多选填：主理人三项、出行参考四段原来每项弹一个系统输入框（7 个）→ 现在就是页面里的输入框 / 文字块；
//   K5 生活碎片：原来添加要弹 3 个框、点一条弹 6 项菜单 → 现在两个添加钮，选完文件顶部出一张卡在卡上填一句话和日期、点「保存」；每张卡上一句话直接改、上移 / 下移 / 删除小钮。
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
const plain = (v) => JSON.parse(JSON.stringify(v))
const flush = () => new Promise(resolve => setImmediate(resolve))
const noComments = (t) => t.replace(/<!--[\s\S]*?-->/g, '')
const between = (s, a, b) => { const i = s.indexOf(a), j = s.indexOf(b, i + a.length); assert.ok(i >= 0 && j > i, `找不到 ${a} … ${b}`); return s.slice(i, j) }
const sub = await import(pathToFileURL(path.join(APP, 'pages/staff/stay-submission.js')).href)

/** 在沙箱里跑页面的 script setup（和 room-types-20261103 同一个做法）：导入一律先给永远不返回的函数，再用 stubs 覆盖用得到的那几个 */
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
  const compiled = compiler.compileTemplate({ source: d.template.content, filename: rel, id: rel })
  assert.deepEqual(compiled.errors, [], rel + ' 模板要能编译')
  return { run: code => vm.runInContext(code, sandbox), stop: () => scope.stop(), template: d.template.content, script: source, styles: d.styles.map(x => x.content).join('\n') }
}
const noBareClicks = (tpl, name) => assert.deepEqual([...tpl.matchAll(/<view\b[^>]*@click[^>]*>/g)].map(m => m[0]).filter(x => !x.includes('hover-class')), [], name + '：能点的 view 要有 hover-class')

// ---------------------------------------------------------------- 房态的小工具（stay-submission.js）

test('房态小工具：价格框 → 分；日期 → 「11-05 周三」；一个月的 days → 去掉过去的只留 14 行；下个月；两个日期之间几晚', () => {
  assert.equal(sub.nightPriceFen('198'), 19800)
  assert.equal(sub.nightPriceFen(' 268.5 '), 26850)
  for (const bad of ['', '0', '1.005', '100001', 'abc']) assert.throws(() => sub.nightPriceFen(bad), /每晚价格/, bad)
  assert.equal(sub.weekdayIndex('2026-11-05'), 3)
  assert.equal(sub.weekdayIndex('2026-11-08'), 6)
  assert.equal(sub.weekdayIndex('bad'), -1)
  assert.equal(sub.calDayLabel('2026-11-05'), '11-05 周四')
  assert.equal(sub.calDayLabel('2026-11-07'), '11-07 周六')
  const days = []
  for (let i = 1; i <= 30; i++) days.push({ date: '2026-11-' + String(i).padStart(2, '0'), priceFen: 19800 + i * 100, stock: 3, occupied: i % 4, closed: i === 10, past: i < 3 })
  const rows = sub.calendarRows(days)
  assert.equal(rows.length, 14)
  assert.equal(rows[0].date, '2026-11-03', '过去的不列')
  assert.deepEqual(rows[0], { date: '2026-11-03', label: '11-03 周二', weekend: false, priceFen: 20100, price: '201', stock: 3, occupied: 3, left: 0, closed: false })
  assert.equal(rows.find(r => r.date === '2026-11-10').closed, true)
  assert.equal(rows.find(r => r.date === '2026-11-07').weekend, true)
  assert.deepEqual(sub.calendarRows(null), [])
  assert.equal(sub.nextMonth('2026-11'), '2026-12')
  assert.equal(sub.nextMonth('2026-12'), '2027-01')
  assert.equal(sub.nightsBetween('2026-11-03', '2026-11-09'), 7)
  assert.equal(sub.nightsBetween('2026-11-03', '2026-11-03'), 1)
  assert.equal(sub.nightsBetween('2026-11-09', '2026-11-03'), 0)
  assert.equal(sub.nightsBetween('', '2026-11-03'), 0)
})

// ---------------------------------------------------------------- K2 房型页第三屏「房态」

const STAY = (over = {}) => ({ stayId: 66, stayName: '古城拾光', status: 'online', statusLabel: '已上线', roomTypes: [
  { roomTypeId: 7, typeName: '院子客房', roomKind: 'private', capacity: 2, stock: 3, unitLabel: '间', basePriceFen: 19800, weekPriceFen: null, status: '0' },
  { roomTypeId: 8, typeName: '通铺', roomKind: 'shared', capacity: 6, stock: 8, unitLabel: '床位', basePriceFen: 8800, weekPriceFen: null, status: '0' }
], ...over })
const monthDays = (ym, past) => Array.from({ length: 30 }, (_, i) => ({ date: ym + '-' + String(i + 1).padStart(2, '0'), priceFen: 19800, stock: 3, occupied: i === 2 ? 2 : 0, closed: i === 5, past: past(i + 1) }))

function roomTypes(stubs = {}) {
  const log = { calendars: [], sets: [], toasts: [], confirms: [], back: 0 }
  let onLoad = null, show = null
  const s = vue.ref(1)
  const h = runSetup('pages/staff/room-types.vue', {
    useScreen: (n, o) => { onLoad = o.onLoad; return s }, onShow: (fn) => { show = fn },
    ensureSession: async () => {}, hasStaffAccess: { value: true }, toast: m => log.toasts.push(m), errText: (e, d) => (e && e.msg) || d, back: () => { log.back++ },
    confirm: async (t) => { log.confirms.push(t); return true }, prompt: async () => '调整价格', todayCn: () => '2026-11-03', shiftDate: (d, n) => '2026-11-' + String(Number(d.slice(8)) + n).padStart(2, '0'),
    apiStaffStay: async () => ({ data: STAY() }),
    apiStaffRoomCalendar: async (id, ym) => { log.calendars.push([id, ym]); return { data: { ym, days: ym === '2026-11' ? monthDays('2026-11', d => d < 3) : monthDays('2026-12', () => false) } } },
    apiStaffSetRoomCalendar: async (id, body) => { log.sets.push([id, plain(body)]); return { msg: '已更新 ' + (body.to === body.from ? 1 : 7) + ' 晚的房态' } },
    WEEK_DAYS: sub.WEEK_DAYS, weekPricesOf: sub.weekPricesOf, fillWeek: sub.fillWeek, roomTypeWeekPayload: sub.roomTypeWeekPayload, weekPriceText: sub.weekPriceText,
    nightPriceFen: sub.nightPriceFen, calendarRows: sub.calendarRows, nextMonth: sub.nextMonth, nightsBetween: sub.nightsBetween,
    ...stubs
  })
  return { ...h, log, s, load: async (q = { stayId: '66', s: '3' }) => { onLoad(q); await flush(); await flush(); await flush() }, show: () => show && show() }
}

test('房态屏：?s=3 直接进来，自动选第一个房型、拉这个月 + 下个月，表里是未来 14 天；房型是一排大格子，点一个换房型', async (t) => {
  const h = roomTypes()
  t.after(h.stop)
  await h.load()
  assert.equal(h.s.value, 3)
  assert.equal(h.run('calRoom.value.roomTypeId'), 7)
  assert.deepEqual(h.log.calendars, [[7, '2026-11'], [7, '2026-12']])
  const rows = plain(h.run('calDays.value'))
  assert.equal(rows.length, 14)
  assert.equal(rows[0].date, '2026-11-03', '今天是 11-03，前两天不列')
  assert.deepEqual(rows[0], { date: '2026-11-03', label: '11-03 周二', weekend: false, priceFen: 19800, price: '198', stock: 3, occupied: 2, left: 1, closed: false })
  assert.equal(rows[3].closed, true)
  assert.deepEqual(plain(h.run('[range.from, range.to, range.price]')), ['2026-11-03', '2026-11-09', ''], '整段改价默认从今天起 7 晚')
  h.run('pickCalRoom(rooms.value[1])')
  await flush(); await flush()
  assert.equal(h.run('calRoom.value.roomTypeId'), 8)
  assert.deepEqual(h.log.calendars.slice(2), [[8, '2026-11'], [8, '2026-12']])
  assert.equal(h.run('unitOf(calRoom.value)'), '床位')
  // 模板：房型格子、14 天表、底部面板、页内日历都在第三屏里；能点的都有 hover-class；没有系统菜单
  const cal = noComments(h.template.slice(h.template.indexOf('<view v-else-if="s === 3" class="fc-form cal-form">')))
  assert.match(cal, /<view v-for="room in rooms" :key="room\.roomTypeId" class="cal-type"[^>]*@click="pickCalRoom\(room\)">/)
  assert.match(cal, /<view v-for="dayRow in calDays" :key="dayRow\.date" class="cal-tr"[^>]*@click="openDay\(dayRow\)">/)
  for (const w of ['未来 14 天', '整段改价', '{{ dayRow.label }}', '¥{{ dayRow.price }}', '{{ dayRow.left }} / {{ dayRow.stock }}', "dayRow.closed ? '已关房' : '可订'", '@click="pickRangeDate(\'from\')"', '@click="pickRangeDate(\'to\')"', 'v-model="range.price"', '@click="applyRangePrice"', '@click="applyRangeClosed(true)"', '@click="applyRangeClosed(false)"']) assert.ok(cal.includes(w), w)
  assert.match(cal, /<view v-if="dayEdit" class="cal-sheet">[\s\S]*v-model="dayEdit\.price"[\s\S]*@click="stepDayStock\(-1\)"[\s\S]*@click="toggleDayClosed"[\s\S]*@click="saveDay"/)
  assert.match(cal, /<k-date-picker v-if="datePick"/)
  noBareClicks(h.template, '房型页')
  assert.doesNotMatch(h.script, /showActionSheet|showModal|pickPaged|sheet\(/, '房态不再用系统菜单 / 纯文字弹窗')
  assert.match(h.styles, /\.cal-type \{[^}]*min-height: 44px;/)
  assert.match(h.styles, /\.cal-tr \{[^}]*min-height: 48px;/)
  assert.match(h.styles, /\.cal-sheet \{[^}]*z-index: 998;/)
})

test('房态屏：点一天出面板 → 改价 + 改库存一次保存（from = to = 那天）；关房 / 开房一个钮；库存不能低于已订；价格填错就地标红不发', async (t) => {
  const h = roomTypes()
  t.after(h.stop)
  await h.load()
  h.run('openDay(calDays.value[0])')
  assert.deepEqual(plain(h.run('dayEdit.value')), { date: '2026-11-03', label: '11-03 周二', price: '198', stock: 3, occupied: 2, closed: false })
  h.run('stepDayStock(-1); stepDayStock(-1); stepDayStock(-1)')
  assert.equal(h.run('dayEdit.value.stock'), 2, '已订 2 间，库存减不到 2 以下')
  h.run("dayEdit.value.price = 'abc'")
  await h.run('saveDay()')
  assert.match(h.run('dayErr.value'), /每晚价格/)
  assert.equal(h.log.sets.length, 0)
  h.run("dayEdit.value.price = '258'")
  await h.run('saveDay()')
  await flush()
  assert.deepEqual(h.log.sets, [[7, { from: '2026-11-03', to: '2026-11-03', priceFen: 25800, stock: 2 }]])
  assert.equal(h.log.toasts.at(-1), '已更新 1 晚的房态', '提示用接口返回的话')
  assert.equal(h.run('dayEdit.value'), null, '保存后面板收起')
  assert.equal(h.log.calendars.length, 4, '保存后重新拉表')
  h.run('openDay(calDays.value[1])')
  await h.run('toggleDayClosed()')
  assert.deepEqual(h.log.sets.at(-1), [7, { from: '2026-11-04', to: '2026-11-04', closed: true }])
  assert.equal(h.run('dayEdit.value.closed'), true, '面板上的钮跟着变成「开房」')
  await h.run('toggleDayClosed()')
  assert.deepEqual(h.log.sets.at(-1), [7, { from: '2026-11-04', to: '2026-11-04', closed: false }])
  // 面板开着时返回只是收起面板；再返回才离开
  await h.run('onBack()')
  assert.equal(h.run('dayEdit.value'), null)
  assert.equal(h.log.back, 0)
  await h.run('onBack()')
  assert.equal(h.log.back, 1)
})

test('房态屏（2026-11-09）：点一天只发这次改了的字段——只改库存不带价格（不把那天价格钉死），只改价不带库存，没改不发', async (t) => {
  const h = roomTypes()
  t.after(h.stop)
  await h.load()
  h.run('openDay(calDays.value[0])')
  h.run('stepDayStock(1)')
  await h.run('saveDay()')
  await flush()
  assert.deepEqual(h.log.sets.at(-1), [7, { from: '2026-11-03', to: '2026-11-03', stock: 4 }])
  h.run('openDay(calDays.value[1])')
  h.run("dayEdit.value.price = '208'")
  await h.run('saveDay()')
  await flush()
  assert.deepEqual(h.log.sets.at(-1), [7, { from: '2026-11-04', to: '2026-11-04', priceFen: 20800 }])
  const before = h.log.sets.length
  h.run('openDay(calDays.value[2])')
  h.run("dayEdit.value.price = '198.00'")
  await h.run('saveDay()')
  assert.equal(h.log.sets.length, before, '价格写法变了但数没变、库存没动：不发')
  assert.equal(h.log.toasts.at(-1), '没有改动')
  assert.equal(h.run('dayEdit.value'), null)
})

test('房态屏：整段改价「从…到…」+ 一个数字框 + 应用；日期反了 / 没填价不发；整段关房问一句、开房不问', async (t) => {
  const h = roomTypes()
  t.after(h.stop)
  await h.load()
  await h.run('applyRangePrice()')
  assert.match(h.run('rangeErr.value'), /请填写每晚价格/)
  assert.equal(h.log.sets.length, 0)
  h.run("range.price = '168'; range.to = '2026-11-01'")
  await h.run('applyRangePrice()')
  assert.match(h.run('rangeErr.value'), /不能早于/)
  assert.equal(h.log.sets.length, 0)
  h.run("range.to = '2026-11-12'")
  assert.equal(h.run('rangeNights.value'), 10)
  await h.run('applyRangePrice()')
  await flush()
  assert.deepEqual(h.log.sets, [[7, { from: '2026-11-03', to: '2026-11-12', priceFen: 16800 }]])
  assert.equal(h.run('rangeErr.value'), '')
  await h.run('applyRangeClosed(true)')
  assert.equal(h.log.confirms.length, 1, '整段关房先问一句')
  assert.deepEqual(h.log.sets.at(-1), [7, { from: '2026-11-03', to: '2026-11-12', closed: true }])
  await h.run('applyRangeClosed(false)')
  assert.equal(h.log.confirms.length, 1, '开房不问')
  assert.deepEqual(h.log.sets.at(-1), [7, { from: '2026-11-03', to: '2026-11-12', closed: false }])
  // 「从」选到「到」后面，「到」自动跟过来
  const p = h.run('pickRangeDate(\'from\')')
  h.run("closeDatePick('2026-11-20')")
  await p
  assert.deepEqual(plain(h.run('[range.from, range.to]')), ['2026-11-20', '2026-11-20'])
})

test('房态屏：不带 s=3 从房型列表开始；填完房型继续补齐资质后统一提交审核', async (t) => {
  const h = roomTypes()
  t.after(h.stop)
  await h.load({ stayId: '66' })
  assert.equal(h.s.value, 1)
  assert.equal(h.log.calendars.length, 0, '列表屏不拉房态')
  assert.ok(h.template.includes('继续补齐资质后统一提交审核'))
  assert.doesNotMatch(h.template, /更多 → 提交审核/)
})

// ---------------------------------------------------------------- 房源管理（rooms.vue）

const ROWS = [
  { stayId: 1, stayName: '草稿院', status: 'draft', statusLabel: '草稿' },
  { stayId: 2, stayName: '上线院', status: 'online', statusLabel: '营业中', occupancy: 50, todayOrders: 1 },
  { stayId: 3, stayName: '审核院', status: 'pending', statusLabel: '待审核' },
  { stayId: 4, stayName: '下架院', status: 'offline', statusLabel: '已下架' },
  { stayId: 5, stayName: '驳回院', status: 'rejected', statusLabel: '已驳回' }
]
const DETAIL = { stayId: 66, stayName: '小院', address: '平潭', status: 'draft', operateModeLabel: '直营', hostStory: '简介', tags: '', hostName: '', latitude: null, longitude: null, district: '', hostAge: '', hostHometown: '', hostSkills: '', travelPros: '', travelCons: '', travelAirport: '', travelRail: '', facilities: '', cookable: '0', quals: [], area: '古城', areaDesc: '步行到洱海', cover: '/c.jpg' }
function rooms(stubs = {}) {
  const log = { go: [], offline: [], edited: [], created: [], toasts: [], posts: [], puts: [], dels: [], confirms: [], previews: [], uploads: [] }
  const s = vue.ref(1)
  const h = runSetup('pages/staff/rooms.vue', {
    useScreen: () => s, ensureSession: async () => {}, hasStaffAccess: { value: true }, currentStaffStoreId: () => 102, experience: { account: {} },
    toast: m => log.toasts.push(m), errText: (e, d) => d, absUrl: x => x, go: (u) => log.go.push(u), back() {}, coordinates: () => null, scrollToField() {},
    todayCn: () => '2026-11-03', shiftDate: () => '2026-11-10', isYmd: () => true, confirm: async (t) => { log.confirms.push(t); return true },
    apiStaffStays: async () => ({ data: { rows: ROWS, stats: {}, tabs: {}, operateModeLabel: '直营' } }),
    apiStaffStay: async () => ({ data: { ...DETAIL } }),
    apiStaffOfflineStay: async (id, why) => { log.offline.push([id, why]); return { msg: '已下架' } },
    apiStaffCreateStay: async (id, p) => { log.created.push([id, plain(p)]); return { data: { stayId: 88 } } },
    apiStaffEditStay: async (id, p) => { log.edited.push([id, plain(p)]); return { data: { stayId: id } } },
    get: async () => ({ data: { districts: [], facilities: [] } }),
    post: async (url, body) => { log.posts.push([url, plain(body)]); return { data: { stayId: 66, entries: [{ diaryId: 9, type: 'image', url: '/p.jpg', cover: '/p.jpg', caption: '', shotDate: '2026-11-03' }] } } },
    put: async (url, body) => { log.puts.push([url, plain(body)]); return { data: { stayId: 66, entries: [] } } },
    del: async (url) => { log.dels.push(url); return { data: { stayId: 66, entries: [] } } },
    chooseImage: async () => '/tmp/a.jpg', uploadTo: async (url, p) => { log.uploads.push([url, p]); return { data: { url: '/up/a.jpg' } } },
    uni: { getStorageSync: () => '', setStorageSync() {}, removeStorageSync() {}, showLoading() {}, hideLoading() {}, previewImage: (o) => log.previews.push(o) },
    ...stubs
  })
  return { ...h, log, s }
}

test('K3 卡片第四个按钮按状态变：草稿 / 驳回 / 下架 →「提交审核」、上线 →「下架」、审核中 →「审核中」；「房态」跳房型页 ?s=3；「更多」只剩 4 项', async (t) => {
  const h = rooms()
  t.after(h.stop)
  await h.run('loadList()')
  await flush()
  assert.deepEqual(plain(h.run('rooms.value')).map(r => [r.name, r.actionLabel, r.actionIcon]), [['草稿院', '提交审核', 'send'], ['上线院', '下架', 'power'], ['审核院', '审核中', 'hourglass'], ['下架院', '提交审核', 'send'], ['驳回院', '提交审核', 'send']])
  h.run('openCalendar({ stayId: 66 })')
  assert.deepEqual(h.log.go, ['/pages/staff/room-types?stayId=66&s=3'])
  assert.doesNotMatch(h.script, /async function editCalendar|'查看本月房态'|apiStaffRoomCalendar|apiStaffSetRoomCalendar|async function setStayLocation|uni\.showModal/, '5 连弹的房态、纯文字房态弹窗、地图位置菜单项都删掉了')
  const more = h.script.slice(h.script.indexOf('async function moreActions(r) {'))
  assert.match(more.slice(0, more.indexOf('\n}\n')), /const acts = \['视频与生活碎片', '住客群码', '资质上传与审核', '上传 Vlog'\]\n\s*const i = await sheet\(acts\)/)
  const card = noComments(between(h.template, '<view v-if="r.actions" class="room__actions">', '<view v-if="offlineBox'))
  assert.deepEqual([...card.matchAll(/<text>([^<]+)<\/text>/g)].map(m => m[1]), ["{{ ['draft','rejected','offline'].includes(r.rawStatus) ? '继续上架' : '编辑房源' }}", '房型管理', '房态', '{{ r.actionLabel }}', '更多'])
  assert.match(card, /@click="openCalendar\(r\)"/)
  assert.match(card, /class="room__act room__act--main" hover-class="k-press" @click="statusAction\(r\)"><k-icon :name="r\.actionIcon"/)
  assert.match(h.styles, /\.room__act--main \{[^}]*font-size: 13px;/)
})

test('K3 下架：点「下架」在卡片下面展开输入框（不弹系统框），空原因不发，写了原因点「确认下架」才发并收起；别的状态进资质与审核屏', async (t) => {
  const h = rooms()
  t.after(h.stop)
  await h.run('loadList()')
  await flush()
  h.run('statusAction(rooms.value[1])')
  assert.deepEqual(plain(h.run('offlineBox.value')), { stayId: 2, reason: '' })
  await h.run('confirmOffline()')
  assert.equal(h.log.toasts.at(-1), '请写一句下架原因')
  assert.equal(h.log.offline.length, 0)
  h.run("offlineBox.value.reason = '  房源  整改中 '")
  await h.run('confirmOffline()')
  await flush()
  assert.deepEqual(h.log.offline, [[2, '房源 整改中']])
  assert.equal(h.run('offlineBox.value'), null)
  assert.equal(h.log.toasts.at(-1), '已下架')
  const box = noComments(between(h.template, '<view v-if="offlineBox && offlineBox.stayId === r.stayId" class="room__offline">', '<view class="fab-bar">'))
  assert.match(box, /<input v-model="offlineBox\.reason" class="fc-input"/)
  assert.match(box, /@click="offlineBox = null"><text>先不下架<\/text>/)
  assert.match(box, /@click="confirmOffline"><text>确认下架<\/text>/)
  assert.match(h.styles, /\.room__obtn \{[^}]*height: 48px;/)
  // 草稿 → 提交审核进第 3 屏
  await h.run('statusAction(rooms.value[0])')
  await flush()
  assert.equal(h.s.value, 3)
})

test('K3 商圈 / 位置描述 / 封面并进编辑表单：打开房源时回填，保存时随表单一起带上；封面选了马上传、存在表单里；审核中 / 上线中不让换封面', async (t) => {
  const h = rooms()
  t.after(h.stop)
  await h.run('openStay(66, 2)')
  await flush()
  assert.deepEqual(plain(h.run('[form.area, form.areaDesc, form.cover]')), ['古城', '步行到洱海', '/c.jpg'])
  h.run("form.area = '大理古城'")
  await h.run('pickFormCover()')
  await flush()
  assert.deepEqual(h.log.uploads, [['/app/upload/image', '/tmp/a.jpg']])
  assert.equal(h.run('form.cover'), '/up/a.jpg')
  await h.run('saveStay(false)')
  await flush()
  const p = h.log.edited[0][1]
  assert.equal(p.area, '大理古城')
  assert.equal(p.areaDesc, '步行到洱海')
  assert.equal(p.cover, '/up/a.jpg')
  // 上线中：封面要先下架
  h.run("stayInfo.value = { ...stayInfo.value, status: 'online' }")
  await h.run('pickFormCover()')
  assert.match(h.log.toasts.at(-1), /先下架/)
  assert.equal(h.log.uploads.length, 1)
  // 新建：三项清空
  await h.run('newStay()')
  await flush()
  assert.deepEqual(plain(h.run('[form.area, form.areaDesc, form.cover]')), ['', '', ''])
  const block = noComments(between(h.template, '<template v-else-if="s === 2">', '<!-- 3 资质上传与审核'))
  assert.match(block, /<text class="fc-label__t">商圈<\/text>[\s\S]*?<input v-model="form\.area" class="fc-input" maxlength="32"/)
  assert.match(block, /<text class="fc-label__t">位置描述<\/text>[\s\S]*?<input v-model="form\.areaDesc" class="fc-input" maxlength="64"/)
  assert.match(block, /<text class="fc-label__t">房源封面<\/text>[\s\S]*?<view class="fc-cover" hover-class="k-press-s" @click="pickFormCover">/)
})

test('K4 更多选填 7 项：主理人三项是输入框、出行参考四段是和房源简介一样的文字块（点开才放 textarea）；没有 editField；离开表单屏收起', async (t) => {
  const h = rooms()
  t.after(h.stop)
  const block = noComments(between(h.template, '<view v-if="moreOpen">', '<view class="fc-bar">'))
  assert.match(block, /<view v-for="f in HOST_FIELDS" :key="f\.key" class="fc-field">\s*<view class="fc-label"><text class="fc-label__t">主理人\{\{ f\.label \}\}<\/text><text class="fc-count">\{\{ form\[f\.key\]\.length \}\}\/\{\{ f\.max \}\}<\/text><\/view>\s*<input v-model="form\[f\.key\]" class="fc-input" :maxlength="f\.max" :placeholder="f\.placeholder" placeholder-class="fc-ph" \/>/)
  assert.match(block, /<view v-for="f in TRAVEL_FIELDS" :key="f\.key" class="fc-field">[\s\S]*?<textarea v-if="editingField === f\.key" v-model="form\[f\.key\]" class="fc-area fc-area--short" :maxlength="f\.max"[^>]*@blur="form\[f\.key\] = \$event\.detail\.value; editingField = ''" \/>\s*<view v-else class="fc-area fc-area--short fc-area--idle" hover-class="k-press" @click="editingField = f\.key">/)
  assert.doesNotMatch(block, /editField|fc-row__long|chevron-right" :size="18" color="muted" \/><\/view>\s*<!-- 出行/)
  assert.doesNotMatch(h.script, /function editField\(|prompt\(f\.title/)
  h.s.value = 2
  h.run("editingField.value = 'travelPros'")
  h.s.value = 3
  await flush()
  assert.equal(h.run('editingField.value'), '', '离开表单屏收起 textarea')
  assert.equal(h.run('HOST_FIELDS.length + TRAVEL_FIELDS.length'), 7)
})

test('K5 生活碎片：选完照片顶部出一张「还没保存」的卡，一句话 / 日期在卡上填，点「保存」才发；超 32 字不发；「不要了」丢掉', async (t) => {
  const h = rooms()
  t.after(h.stop)
  h.run("media.value = { ...media.value, stayId: 66, entries: [] }")
  await h.run("addDiary('image')")
  await flush()
  assert.deepEqual(plain(h.run('diaryDraft.value')), { mediaType: 'image', url: '/up/a.jpg', cover: '/up/a.jpg', caption: '', shotDate: '2026-11-03' })
  assert.equal(h.log.posts.length, 0, '选完不发，等「保存」')
  await h.run("addDiary('image')")
  assert.match(h.log.toasts.at(-1), /先把上面那条保存/)
  h.run("diaryDraft.value.caption = '字'.repeat(33)")
  await h.run('saveDraftDiary()')
  assert.equal(h.log.toasts.at(-1), '一句话最多 32 个字')
  assert.equal(h.log.posts.length, 0)
  h.run("diaryDraft.value.caption = ' 火烧云 '")
  await h.run('saveDraftDiary()')
  await flush()
  assert.deepEqual(h.log.posts, [['/app/staff/stay/stays/66/diary', { mediaType: 'image', url: '/up/a.jpg', caption: '火烧云', shotDate: '2026-11-03' }]])
  assert.equal(h.run('diaryDraft.value'), null, '保存后草稿卡收起')
  assert.equal(h.run('media.value.entries.length'), 1, '用接口返回的刷新')
  assert.equal(h.log.toasts.at(-1), '已添加')
  // 模板：两个添加钮、草稿卡、每张卡上的输入框 / 日期 / 上移 下移 删除 保存；没有 6 项菜单、没有「照片 / 视频」选择框
  const media = noComments(between(h.template, '<view v-else-if="s === 5" class="k-body media-body">', '<!-- 4 Vlog 上传与审核'))
  assert.match(media, /<view class="dadd__btn" hover-class="k-press-s" @click="addDiary\('image'\)">/)
  assert.match(media, /<view class="dadd__btn" hover-class="k-press-s" @click="addDiary\('video'\)">/)
  assert.match(media, /<view v-if="diaryDraft" class="dcard dcard--new">[\s\S]*?<input v-model="diaryDraft\.caption" class="dcard__input" maxlength="32"[\s\S]*?@click="pickDraftDate"[\s\S]*?@click="diaryDraft = null"><text>不要了<\/text>[\s\S]*?@click="saveDraftDiary"><text>保存<\/text>/)
  assert.match(media, /<view v-for="\(entry, entryIdx\) in diaryCards" :key="entry\.diaryId" class="dcard">[\s\S]*?<input :value="entry\.caption" class="dcard__input" maxlength="32"[^>]*@input="editDiaryCaption\(entry, \$event\)"[\s\S]*?@click="editDiaryDate\(entry\)"[\s\S]*?@click="moveDiary\(entry, entryIdx, -1\)"[\s\S]*?@click="moveDiary\(entry, entryIdx, 1\)"[\s\S]*?@click="deleteDiary\(entry\)"[\s\S]*?<view v-if="entry\.dirty" class="dbtn dbtn--main"[^>]*@click="saveDiary\(entry\)">/)
  assert.doesNotMatch(media, /fc-|tapDiary|dgrid|dcell/)
  assert.doesNotMatch(h.script, /'预览', '改一句话'|'添加照片', `添加视频|async function tapDiary/)
  for (const alias of [...media.matchAll(/v-for="\(?([^)"]+?)\)? in /g)].flatMap(x => x[1].split(',').map(s => s.trim()))) assert.ok(alias.length >= 3, 'v-for 别名太短：' + alias)
  assert.match(h.styles, /\.dbtn \{[^}]*min-height: 44px;/)
  assert.match(h.styles, /\.dadd__btn \{[^}]*min-height: 52px;/)
  assert.match(h.styles, /:global\(\.d-ph\)/)
})

test('K5 已有的一条：一句话在卡上直接改 → 出「保存」→ 发 caption + shotDate 并清掉改动；上移 / 下移；删除问一次；点图预览', async (t) => {
  const h = rooms()
  t.after(h.stop)
  h.run("media.value = { ...media.value, stayId: 66, entries: [{ diaryId: 1, type: 'image', url: '/1.jpg', cover: '/1.jpg', caption: '早餐', shotDate: '2026-10-01' }, { diaryId: 2, type: 'video', url: '/2.mp4', cover: '/2.jpg', caption: '', shotDate: '' }] }")
  assert.deepEqual(plain(h.run('diaryCards.value')).map(c => c.dirty), [false, false])
  h.run("editDiaryCaption(diaryCards.value[0], { detail: { value: '早餐时光' } })")
  assert.deepEqual(plain(h.run('diaryCards.value')).map(c => [c.caption, c.dirty]), [['早餐时光', true], ['', false]])
  const p = h.run('editDiaryDate(diaryCards.value[0])')
  h.run("closeDatePick('2026-10-02')")
  await p
  assert.equal(h.run('diaryCards.value[0].shotDate'), '2026-10-02')
  h.run('saveDiary(diaryCards.value[0])')
  await flush(); await flush()
  assert.deepEqual(h.log.puts, [['/app/staff/stay/diary/1', { caption: '早餐时光', shotDate: '2026-10-02' }]])
  assert.deepEqual(plain(h.run('diaryEdits.value')), {}, '保存后清掉改动')
  assert.equal(h.log.toasts.at(-1), '已保存')
  // 接口返回后 setMedia 会用返回的 entries 覆盖（这里的桩返回空），所以每一步前把两条重新放回去
  const two = "media.value = { ...media.value, stayId: 66, entries: [{ diaryId: 1, type: 'image', url: '/1.jpg', caption: '早餐', shotDate: '2026-10-01' }, { diaryId: 2, type: 'video', url: '/2.mp4', cover: '/2.jpg', caption: '', shotDate: '' }] }"
  h.run(two)
  await h.run('moveDiary(diaryCards.value[1], 1, -1)')
  await flush()
  assert.deepEqual(h.log.puts.at(-1), ['/app/staff/stay/stays/66/diary-order', { ids: [2, 1] }])
  assert.equal(h.log.toasts.at(-1), '顺序已调整')
  h.run(two)
  await h.run('moveDiary(diaryCards.value[0], 0, -1)')
  assert.equal(h.log.toasts.at(-1), '已经在最前面了')
  await h.run('moveDiary(diaryCards.value[1], 1, 1)')
  assert.equal(h.log.toasts.at(-1), '已经在最后面了')
  assert.equal(h.log.puts.length, 2, '到头了不发')
  await h.run('deleteDiary(diaryCards.value[0])')
  await flush()
  assert.deepEqual(h.log.confirms, ['删除这条生活碎片'])
  assert.deepEqual(h.log.dels, ['/app/staff/stay/diary/1'])
  assert.equal(h.log.toasts.at(-1), '已删除')
  h.run(two)
  h.run('previewDiary(diaryCards.value[0])')
  assert.deepEqual(plain(h.log.previews), [{ urls: ['/1.jpg'] }])
})

// ---------------------------------------------------------------- 复查补的（2026-11-03 复查人）

test('复查：房态屏的页内日历 / 底部面板开着时小程序锁住页面滚动（page-meta 是第一个节点，和 rooms.vue 同一个做法）', () => {
  const d = compiler.parse(src('pages/staff/room-types.vue'), { filename: 'room-types.vue' }).descriptor
  assert.match(d.template.content, /^\s*<!-- #ifdef MP-WEIXIN -->\s*<page-meta :page-style="datePick \|\| dayEdit \? 'overflow: hidden' : ''" \/>/)
  assert.deepEqual(compiler.compileTemplate({ source: d.template.content, filename: 'room-types.vue', id: 'rt' }).errors, [])
})

test('复查：老年用户点得到——生活碎片卡上的「拍摄日期」行、上移 / 下移 / 删除、两个添加钮、房型格子、14 天表每行都不矮于 44px；表单里没人用的 title 字段去掉', async (t) => {
  const h = rooms()
  t.after(h.stop)
  // 样式里某个类的 height / min-height（px）
  const px = (css, sel) => { const i = css.indexOf(sel + ' {'); const m = i >= 0 && /(?:min-)?height: (\d+)px;/.exec(css.slice(i, css.indexOf('}', i))); return m ? Number(m[1]) : NaN }
  for (const [sel, min] of [['.dcard__date', 44], ['.dbtn', 44], ['.dadd__btn', 52], ['.dcard__input', 44], ['.room__act', 56], ['.room__obtn', 48]]) assert.ok(px(h.styles, sel) >= min, sel + ' 应不矮于 ' + min + 'px，现在是 ' + px(h.styles, sel))
  const rt = runSetup('pages/staff/room-types.vue', { useScreen: () => vue.ref(1), onShow() {} })
  t.after(rt.stop)
  for (const [sel, min] of [['.cal-type', 44], ['.cal-tr', 48], ['.cal-sheet__x', 44], ['.rt-btn', 48]]) assert.ok(px(rt.styles, sel) >= min, sel + ' 应不矮于 ' + min + 'px，现在是 ' + px(rt.styles, sel))
  for (const f of plain(h.run('[...HOST_FIELDS, ...TRAVEL_FIELDS]'))) assert.deepEqual(Object.keys(f).sort(), ['key', 'label', 'max', 'placeholder'], f.key + '：editField 删掉后 title 没人用')
})
