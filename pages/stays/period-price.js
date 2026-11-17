// Prices are server quotes for the same arrival date, never cheapest-night × days.
export function periodDisplay(row, from = false) {
  const periods = Array.isArray(row?.periodPrices) ? row.periodPrices : []
  const amount = nights => periods.find(p => Number(p.nights) === nights)
  const money = p => p?.payFen != null && Number.isSafeInteger(Number(p.payFen)) && Number(p.payFen) >= 0
    ? (Number(p.payFen) / 100).toFixed(2).replace(/\.00$/, '').replace(/(\.\d)0$/, '$1') : null
  const week = amount(7), price = money(week)
  if (price == null) return {}
  const text = (n, label) => {
    const p = amount(n), value = money(p)
    return label + '（' + n + '晚）' + (value == null ? '待查询' : p.bookable === false ? '暂无空房' : '¥' + value + (from ? '起' : ''))
  }
  return {price, priceLabel:'7晚' + (from ? '起' : '总价') + (week.bookable === false ? ' · 暂无空房' : ''),
    periodText:(week.checkIn ? week.checkIn.slice(5).replace('-', '/') + '入住\n' : '') + text(15,'半月') + '\n' + text(30,'一个月')}
}

// Pick a bookable room for each duration; sold-out low prices are not advertised as available.
export function lowestPeriods(rooms) {
  return [7, 15, 30].map(nights => {
    const prices = rooms.flatMap(r => r.periodPrices || []).filter(p => Number(p.nights) === nights && p.payFen != null)
    const available = prices.filter(p => p.bookable !== false)
    return (available.length ? available : prices).sort((a, b) => Number(a.payFen) - Number(b.payFen))[0]
  }).filter(Boolean)
}

// A room card shows fixed-duration quotes separately from the selected dates.
export function bookingPriceDisplay(row) {
  const periods = Array.isArray(row?.periodPrices) ? row.periodPrices : []
  const find = nights => periods.find(p => Number(p.nights) === nights)
  const money = value => {
    if (value == null || typeof value === 'boolean' || String(value).trim() === '') return null
    const fen = Number(value)
    return Number.isSafeInteger(fen) && fen >= 0
      ? (fen / 100).toFixed(2).replace(/\.00$/, '').replace(/(\.\d)0$/, '$1') : null
  }
  const week = find(7)
  const line = (nights, label) => {
    const quote = find(nights), price = money(quote?.payFen)
    return label + '（' + nights + '晚）' + (price == null ? '待查询' : quote.bookable === false ? '暂无空房' : '¥' + price)
  }
  return {
    price: money(week?.payFen) ?? '--',
    weekUnavailable: week?.bookable === false,
    periodText: line(15, '半个月') + '\n' + line(30, '一个月'),
    selectedPrice: money(row?.displayPayFen ?? row?.displayPriceFen) ?? '--'
  }
}
