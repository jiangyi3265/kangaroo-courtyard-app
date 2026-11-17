import assert from 'node:assert/strict'
import test from 'node:test'
import { readFile } from 'node:fs/promises'
const source = await readFile(new URL('../common/calendar.js', import.meta.url), 'utf8')
const { monthDays, shiftMonth } = await import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'))
test('leap year, month boundaries and Monday alignment are correct', () => {
  assert.equal(monthDays('2028-02-15').filter(d => d.current).length, 29)
  assert.equal(monthDays('2027-02-15').filter(d => d.current).length, 28)
  const oct = monthDays('2026-10-31')
  assert.equal(oct[3].date, '2026-10-01')
  assert.equal(oct[33].date, '2026-10-31')
  assert.equal(shiftMonth('2026-12-31', 1), '2027-01-01')
  assert.equal(shiftMonth('2027-01-31', -1), '2026-12-01')
})
test('past dates and adjacent-month cells cannot be selected', () => {
  const days = monthDays('2026-10-01', '2026-10-03')
  assert.equal(days.find(d => d.date === '2026-10-02').disabled, true)
  assert.equal(days.find(d => d.date === '2026-10-03').disabled, false)
  assert.ok(days.filter(d => !d.current).every(d => d.disabled))
})
test('maximum selectable date is inclusive and later dates are disabled', () => {
  const days = monthDays('2027-01-01', '2026-10-04', '2027-01-02')
  assert.equal(days.find(d => d.date === '2027-01-02').disabled, false)
  assert.equal(days.find(d => d.date === '2027-01-03').disabled, true)
  assert.equal(monthDays('2027-01-01').find(d => d.date === '2027-01-03').disabled, false)
})
