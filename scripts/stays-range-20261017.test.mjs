// 2026-10-17 R4 旅居订房「入住 / 离店」区间日历的回归（node --test，不构建、不发请求）。
// 主人：「点进去的页面，选择住几晚就不要跳了，直接可以选择开始日期和截止日期即可」。守住这几件事：
//   · 点选顺序：先点入住、再点离店；点入住当天或更早 = 换入住日重来；选好一整段后再点 = 重新开始；
//   · 最多连住 30 晚（和预订页、下单接口一致），超过的离店日是灰的、点了给提示；入住最晚今天 + 180；
//   · 格子上标「入住 / 离店」，中间一段 inRange；标题「共 N 晚」，按钮「确定（共N晚）」；
//   · 订房入口（list.vue s=1）和小院详情「可选空余房型」都用这一个日历，不再弹「住几晚」菜单；
//   · 组件在 pages/stays/components 里显式引入，不进主包（不走 components/ 的 easycom）。
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'
import test from 'node:test'
import assert from 'node:assert/strict'
import * as r from '../pages/stays/stays-range.js'

const APP = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const require = createRequire(path.join(APP, 'package.json'))
const compiler = require('@vue/compiler-sfc')
const read = (rel) => fs.readFileSync(path.join(APP, rel), 'utf8').replace(/\r\n/g, '\n')
const readSfc = (rel) => compiler.parse(read(rel), { filename: rel }).descriptor
const noComments = (t) => t.replace(/<!--[\s\S]*?-->/g, '')
const O = { min: '2026-10-17', maxStart: '2027-04-15', maxNights: 30 }

test('单独修改入住与离店：晚数自动计算，非法离店日不改变原来的入住日', () => {
  const current = { start: '2026-10-30', end: '2026-11-02' }
  assert.deepEqual(r.editRange(current, '2026-11-06', 'end', O), { start: current.start, end: '2026-11-06', msg: '' })
  assert.equal(r.nightsOf(current.start, '2026-11-06'), 7)
  for (const date of ['2026-10-30', '2026-10-29', '2026-12-01']) {
    const rejected = r.editRange(current, date, 'end', O)
    assert.ok(rejected.msg)
    assert.equal(rejected.start, current.start)
    assert.equal(rejected.end, current.end)
  }
  assert.deepEqual(r.editRange(current, '2026-11-01', 'start', O), { start: '2026-11-01', end: '', msg: '' })
})

test('点两下：先入住、再离店；共 N 晚', () => {
  let s = r.tapRange({ start: '', end: '' }, '2026-10-17', O)
  assert.deepEqual(s, { start: '2026-10-17', end: '', msg: '' })
  assert.equal(r.rangeHint(s), '请选择离店日期')
  assert.equal(r.confirmLabel(s), '请选择离店日期')
  s = r.tapRange(s, '2026-10-24', O)
  assert.deepEqual(s, { start: '2026-10-17', end: '2026-10-24', msg: '' })
  assert.equal(r.nightsOf(s.start, s.end), 7)
  assert.equal(r.rangeHint(s), '共 7 晚')
  assert.equal(r.confirmLabel(s), '确定（共7晚）')
  assert.equal(r.confirmLabel({ start: '2026-10-30', end: '2026-11-02' }), '确定（共3晚）', '跨月')
  assert.equal(r.rangeHint({ start: '', end: '' }), '请选择入住日期')
})

test('点得比入住早或就是入住当天 = 换入住日重来；选好一整段后再点 = 重新开始', () => {
  const a = { start: '2026-10-20', end: '' }
  assert.deepEqual(r.tapRange(a, '2026-10-18', O), { start: '2026-10-18', end: '', msg: '' })
  assert.deepEqual(r.tapRange(a, '2026-10-20', O), { start: '2026-10-20', end: '', msg: '' })
  const full = { start: '2026-10-20', end: '2026-10-22' }
  assert.deepEqual(r.tapRange(full, '2026-10-25', O), { start: '2026-10-25', end: '', msg: '' }, '已选好一段，点更晚的也是新入住日')
  assert.deepEqual(r.tapRange(full, '2026-10-19', O), { start: '2026-10-19', end: '', msg: '' })
})

test('最多 30 晚：第 30 晚可以，31 晚不收并提示，入住日保留', () => {
  const a = { start: '2026-10-17', end: '' }
  assert.deepEqual(r.tapRange(a, r.addDays('2026-10-17', 30), O), { start: '2026-10-17', end: '2026-11-16', msg: '' })
  const over = r.tapRange(a, r.addDays('2026-10-17', 31), O)
  assert.equal(over.start, '2026-10-17')
  assert.equal(over.end, '')
  assert.match(over.msg, /最多连住 30 晚/)
  assert.equal(r.MAX_NIGHTS, 30, '和预订页 booking.vue、KgStayBrowseService.MAX_NIGHTS 一致')
})

test('早于今天点不了；入住最晚到 maxStart，离店可以到 maxStart + 30', () => {
  assert.deepEqual(r.tapRange({ start: '', end: '' }, '2026-10-16', O), { start: '', end: '', msg: '' })
  assert.deepEqual(r.tapRange({ start: '', end: '' }, 'bad', O), { start: '', end: '', msg: '' })
  const late = r.tapRange({ start: '', end: '' }, '2027-04-16', O)
  assert.equal(late.start, '')
  assert.match(late.msg, /入住日期最晚可选 4月15日/)
  assert.deepEqual(r.tapRange({ start: '2027-04-15', end: '' }, '2027-05-15', O), { start: '2027-04-15', end: '2027-05-15', msg: '' })
  assert.equal(r.lastDay('2027-04-15'), '2027-05-15')
  assert.deepEqual(r.monthsBetween('2026-10-17', r.lastDay('2027-04-15')), ['2026-10', '2026-11', '2026-12', '2027-01', '2027-02', '2027-03', '2027-04', '2027-05'])
  assert.deepEqual(r.monthsBetween('2026-12-30', '2027-01-02'), ['2026-12', '2027-01'], '跨年')
})

test('打开日历时带入已选区间：过期 / 超长 / 不合法的不带', () => {
  assert.deepEqual(r.initialRange('2026-10-17', '2026-10-24', O), { start: '2026-10-17', end: '2026-10-24' })
  assert.deepEqual(r.initialRange('2026-10-10', '2026-10-12', O), { start: '', end: '' })
  assert.deepEqual(r.initialRange('2026-10-17', '2026-12-30', O), { start: '2026-10-17', end: '' })
  assert.deepEqual(r.initialRange('2026-10-17', '2026-10-17', O), { start: '2026-10-17', end: '' })
  assert.deepEqual(r.initialRange('', '', O), { start: '', end: '' })
})

test('月格子：周一开头补空格、标「入住 / 离店 / 今天」，中间一段 inRange；等离店时 30 晚以外变灰', () => {
  const cells = r.rangeMonth('2026-10', { start: '2026-10-18', end: '2026-10-21' }, { ...O, today: '2026-10-17' })
  // 2026-10-01 是周四：前面补 3 个空格（一、二、三）
  assert.equal(cells.filter(c => c.empty).length, 3)
  assert.equal(cells.filter(c => !c.empty).length, 31)
  const by = Object.fromEntries(cells.filter(c => !c.empty).map(c => [c.ymd, c]))
  assert.equal(by['2026-10-16'].disabled, true, '今天以前是灰的')
  assert.equal(by['2026-10-17'].tag, '今天')
  assert.equal(by['2026-10-18'].tag, '入住')
  assert.equal(by['2026-10-18'].start, true)
  assert.equal(by['2026-10-21'].tag, '离店')
  assert.equal(by['2026-10-21'].end, true)
  assert.deepEqual(cells.filter(c => c.inRange).map(c => c.ymd), ['2026-10-19', '2026-10-20'])
  const wait = r.rangeMonth('2026-11', { start: '2026-10-20', end: '' }, O)
  const w = Object.fromEntries(wait.filter(c => !c.empty).map(c => [c.ymd, c]))
  assert.equal(w['2026-11-19'].disabled, false, '第 30 晚的离店日能点')
  assert.equal(w['2026-11-20'].disabled, true, '31 晚以外是灰的')
  const far = r.rangeMonth('2027-04', { start: '', end: '' }, O)
  assert.equal(far.find(c => c.ymd === '2027-04-15').disabled, false)
  assert.equal(far.find(c => c.ymd === '2027-04-16').disabled, true, '没在等离店时，maxStart 之后不能当入住日')
})

test('订房入口：一个区间日历，不再弹「住几晚」菜单；组件在旅居分包里显式引入', () => {
  const list = readSfc('pages/stays/list.vue')
  const t = noComments(list.template.content)
  const js = list.scriptSetup.content
  assert.ok(t.includes("@click=\"pickDates('start')\""))
  assert.ok(t.includes("@click=\"pickDates('end')\""))
  assert.match(t, /<stay-range-picker v-if="dateOpen" :initial-field="dateField"/)
  assert.ok(!t.includes('<k-date-picker'), '不再用单日日历')
  assert.ok(!js.includes('住 1 晚') && !js.includes('入住晚数'), '「住几晚」菜单和手填晚数都去掉了')
  assert.match(js, /import StayRangePicker from '\.\/components\/stay-range-picker\.vue'/)
  assert.match(js, /function confirmDates\(r\) \{\n  dateOpen\.value = false\n  if \(!r \|\| !r\.start \|\| !r\.end\) return\n  state\.checkIn = r\.start\n  state\.checkOut = r\.end\n  normalizeDates\(\)\n  saveStayState\(\)\n  loadPreviews\(\)\n\}/)
  assert.match(t, /<text class="sbox__big">\{\{ dayText\(state\.checkIn\) \}\}<\/text><text class="sbox__wk">\{\{ weekText\(state\.checkIn\) \}\}<\/text>/)
  assert.match(t, /<text class="dpill__nights">共\{\{ nights \}\}晚<\/text>/)
  const css = list.styles.map(x => x.content).join('\n')
})

test('小院详情：「可选空余房型」右边的日期能点开同一个日历，确定后按新日期重取房型', () => {
  const d = readSfc('pages/stays/detail.vue')
  const t = noComments(d.template.content)
  const js = d.scriptSetup.content
  assert.match(t, /<view class="rooms-head__note" hover-class="k-press" @click="dateOpen = true">/)
  assert.match(t, /<text class="rooms-head__edit">改日期<\/text>/)
  assert.match(t, /<stay-range-picker v-if="dateOpen" [^>]*@confirm="confirmDates" \/>/)
  assert.match(js, /import StayRangePicker from '\.\/components\/stay-range-picker\.vue'/)
  assert.match(js, /state\.checkIn = r\.start\n  state\.checkOut = r\.end\n  normalizeDates\(\)\n  saveStayState\(\)\n  loadRooms\(\)/)
})

test('日历组件：标题栏「共 N 晚」、底部「确定（共N晚）」没选好不能点；不用主包的 easycom 组件目录', () => {
  const c = readSfc('pages/stays/components/stay-range-picker.vue')
  const t = noComments(c.template.content)
  assert.match(t, /<text class="rp-hint" :class="\{ on: sel\.start && sel\.end \}">\{\{ hint \}\}<\/text>/)
  assert.match(t, /<k-button block :disabled="!\(sel\.start && sel\.end\)" :label="btnText" @click="ok" \/>/)
  assert.match(t, /<text v-if="c\.tag" class="rp-day__tag">\{\{ c\.tag \}\}<\/text>/)
  assert.match(c.scriptSetup.content, /from '\.\.\/stays-range\.js'/)
  assert.ok(!fs.existsSync(path.join(APP, 'components/stay-range-picker')), '不放进根 components/（easycom 会打进主包）')
  // 预订页的房态日历（带每晚价格 / 满房）保持原样：仍是第一次点入住、第二次点离店，最多 30 晚
  const b = read('pages/stays/booking.vue')
  assert.match(b, /if \(n > MAX_NIGHTS\) return toast\('最多连住 30 晚'\)/)
})
