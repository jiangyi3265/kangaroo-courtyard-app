import test from 'node:test'
import assert from 'node:assert/strict'
import { stayPayEntry } from '../pages/stays/stays-pay-entry.js'

const today = '2026-10-27'
const base = { stayId: '7', roomTypeId: '23', checkIn: '2026-10-28', checkOut: '2026-11-04', guests: '2' }
test('完整链接保留真实房源、房型、日期人数；未指定人数默认一人', () => {
  const v = stayPayEntry(base, today)
  assert.equal(v.valid, true); assert.equal(v.stayId, 7); assert.equal(v.roomTypeId, 23); assert.equal(v.guests, 2)
  assert.equal(stayPayEntry({ ...base, guests: undefined }, today).guests, 1)
})
test('缺失、非整数和非法房源房型编号不报价，保留能恢复的房源', () => {
  for (const bad of [undefined, '', '0', '-1', 'abc', '1.5', '1e2', '9007199254740993']) {
    assert.equal(stayPayEntry({ ...base, stayId: bad }, today).valid, false)
    const v = stayPayEntry({ ...base, roomTypeId: bad }, today)
    assert.equal(v.valid, false); assert.equal(v.stayId, 7)
  }
})
test('日期必须是真实未来区间，最长30晚、提前180天', () => {
  for (const [checkIn, checkOut] of [[undefined,undefined],['2026-02-30','2026-03-02'],['2026-13-01','2026-13-02'],['2026-10-26','2026-10-29'],['2026-10-28','2026-10-28'],['2026-10-29','2026-10-28'],['2026-10-28','2026-11-28'],['2027-04-26','2027-04-27']]) {
    assert.equal(stayPayEntry({ ...base, checkIn, checkOut }, today).valid, false, `${checkIn}–${checkOut}`)
  }
  assert.equal(stayPayEntry({ ...base, checkIn: '2026-10-27', checkOut: '2026-11-26' }, today).valid, true)
  assert.equal(stayPayEntry({ ...base, checkIn: '2027-04-25', checkOut: '2027-05-02' }, today).valid, true)
})
test('非法入住人数不静默变成一人', () => {
  for (const guests of ['0', '-1', '7', '1.5', 'abc']) assert.equal(stayPayEntry({ ...base, guests }, today).valid, false)
})
