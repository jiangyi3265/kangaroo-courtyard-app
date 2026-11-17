import test from 'node:test'
import assert from 'node:assert/strict'
import { bookingPriceDisplay } from '../pages/stays/period-price.js'

const periods = () => [
  { nights: 7, payFen: 11900, checkIn: '2026-12-20', bookable: true },
  { nights: 15, payFen: 21675, checkIn: '2026-12-20', bookable: true },
  { nights: 30, payFen: 43350, checkIn: '2026-12-20', bookable: true }
]

test('15-night booking keeps the seven-night price separate from its discounted selected-date total', () => {
  const shown = bookingPriceDisplay({ periodPrices: periods(), displayPriceFen: 25500, displayPayFen: 21675 })
  assert.equal(shown.price, '119')
  assert.equal(shown.selectedPrice, '216.75')
  assert.equal(shown.weekUnavailable, false)
  assert.match(shown.periodText, /半个月（15晚）¥216\.75/)
  assert.match(shown.periodText, /一个月（30晚）¥433\.5/)
})

test('changing selected dates updates the right total without replacing the seven-night comparison', () => {
  const week = bookingPriceDisplay({ periodPrices: periods(), displayPayFen: 11900 })
  const month = bookingPriceDisplay({ periodPrices: periods(), displayPriceFen: 51000, displayPayFen: 43350 })
  assert.equal(week.price, month.price)
  assert.equal(week.selectedPrice, '119')
  assert.equal(month.selectedPrice, '433.5')
  assert.equal(week.periodText, month.periodText)
})

test('missing weekly quote never relabels the selected-date total as a seven-night price', () => {
  const shown = bookingPriceDisplay({ periodPrices: periods().slice(1), displayPayFen: 21675 })
  assert.equal(shown.price, '--')
  assert.equal(shown.selectedPrice, '216.75')
  assert.match(shown.periodText, /15晚.*216\.75/)
  assert.match(shown.periodText, /30晚.*433\.5/)
})

test('selected-date total falls back only when the discounted total is missing', () => {
  for (const displayPayFen of [undefined, null]) {
    assert.equal(bookingPriceDisplay({ periodPrices: periods(), displayPayFen, displayPriceFen: 17850 }).selectedPrice, '178.5')
  }
  assert.equal(bookingPriceDisplay({ periodPrices: periods() }).selectedPrice, '--')
  assert.equal(bookingPriceDisplay({ periodPrices: periods(), displayPayFen: 0, displayPriceFen: 17850 }).selectedPrice, '0')
})

test('invalid amounts remain unavailable instead of becoming a zero or fabricated quote', () => {
  for (const invalid of [-1, NaN, Infinity, 'bad', '', ' ', false, {}, 1.5, Number.MAX_SAFE_INTEGER + 1]) {
    const shown = bookingPriceDisplay({ periodPrices: [{ nights: 7, payFen: invalid }], displayPayFen: invalid })
    assert.equal(shown.price, '--', 'invalid weekly amount: ' + String(invalid))
    assert.equal(shown.selectedPrice, '--', 'invalid selected-date amount: ' + String(invalid))
  }
})

test('sold-out periods are labelled unavailable independently of the selected booking interval', () => {
  const values = periods()
  values[0].bookable = false
  values[2].bookable = false
  const shown = bookingPriceDisplay({ periodPrices: values, displayPayFen: 21675, bookable: true })
  assert.equal(shown.price, '119')
  assert.equal(shown.weekUnavailable, true)
  assert.equal(shown.selectedPrice, '216.75')
  assert.match(shown.periodText, /半个月（15晚）¥216\.75/)
  assert.match(shown.periodText, /一个月（30晚）暂无空房/)
})

test('unquoted longer periods show pending values and valid numeric-string fen stays exact', () => {
  const shown = bookingPriceDisplay({ periodPrices: [{ nights: '7', payFen: '12515', bookable: true }], displayPayFen: '17885' })
  assert.equal(shown.price, '125.15')
  assert.equal(shown.selectedPrice, '178.85')
  assert.match(shown.periodText, /半个月（15晚）待查询/)
  assert.match(shown.periodText, /一个月（30晚）待查询/)
})

test('server amounts are displayed directly without multiplying nights or reapplying store markup', () => {
  const direct = bookingPriceDisplay({ opType: 'direct', periodPrices: periods(), displayPayFen: 21675 })
  const partner = bookingPriceDisplay({ opType: 'partner', periodPrices: [
    { nights: 7, payFen: 12495 }, { nights: 15, payFen: 22759 }, { nights: 30, payFen: 45518 }
  ], displayPayFen: 22759 })
  assert.equal(direct.price, '119')
  assert.equal(partner.price, '124.95')
  assert.equal(partner.selectedPrice, '227.59')
  assert.match(partner.periodText, /30晚.*455\.18/)
})
