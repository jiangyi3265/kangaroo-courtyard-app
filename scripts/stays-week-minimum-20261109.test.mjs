import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import { MIN_NIGHTS, tapRange, initialRange, editRange, addDays } from '../pages/stays/stays-range.js'
import { stayPayEntry } from '../pages/stays/stays-pay-entry.js'

test('日期选择与旧链接均拒绝1至6晚，7至30晚可订且可跨月跨年', () => {
  const start = '2026-12-28'
  for (let n = 1; n <= 31; n++) {
    const end = addDays(start, n), valid = n >= 7 && n <= 30
    const selection = tapRange({ start, end: '' }, end)
    assert.equal(selection.end === end, valid, String(n))
    assert.equal(initialRange(start, end).end === end, valid)
    assert.equal(stayPayEntry({ stayId: 1, roomTypeId: 2, checkIn: start, checkOut: end }, start).valid, valid)
    if (n < 7) assert.match(selection.msg, /一周起订/)
  }
  const previous = { start, end: addDays(start, 8) }
  assert.equal(editRange(previous, addDays(start, 6), 'end').end, previous.end)
})

test('默认日期和旧的短住缓存调整为7晚；更长的有效选择不变', () => {
  const source = fs.readFileSync(new URL('../pages/stays/stays-state.js', import.meta.url), 'utf8').replace(/^import .*\r?\n/gm, '').replace(/export /g, '')
  for (const saved of [{}, { checkIn: '2026-11-01', checkOut: '2026-11-02' }, { checkIn: '2026-11-15', checkOut: '2026-11-17' }, { checkIn: '2026-11-15', checkOut: '2026-11-30' }]) {
    const sandbox = { reactive: x => x, todayCn: () => '2026-11-09', shiftDate: addDays, MIN_NIGHTS, uni: { getStorageSync: () => saved, setStorageSync() {} } }
    vm.createContext(sandbox); vm.runInContext(source + '\nnormalizeDates()', sandbox)
    const actual = vm.runInContext('({ ...stayState })', sandbox)
    assert.equal(actual.checkIn, saved.checkIn && saved.checkIn >= '2026-11-09' ? saved.checkIn : '2026-11-09')
    assert.equal(actual.checkOut, saved.checkOut === '2026-11-30' ? saved.checkOut : addDays(actual.checkIn, 7))
  }
})
