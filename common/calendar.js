const pad = n => String(n).padStart(2, '0')
const ymd = d => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`

// 用 UTC 做纯日期运算，手机时区和夏令时不影响日期格的位置。
export function calendarMonth(value) {
  return String(value).slice(0, 7) + '-01'
}
export function shiftMonth(value, offset) {
  const d = new Date(calendarMonth(value) + 'T00:00:00Z')
  d.setUTCMonth(d.getUTCMonth() + offset)
  return ymd(d)
}
export function monthDays(value, minDate = '', maxDate = '') {
  const first = new Date(calendarMonth(value) + 'T00:00:00Z')
  const offset = (first.getUTCDay() + 6) % 7
  return Array.from({ length: 42 }, (_, i) => {
    const d = new Date(first)
    d.setUTCDate(1 + i - offset)
    const date = ymd(d)
    const current = d.getUTCMonth() === first.getUTCMonth()
    return { date, day: d.getUTCDate(), current, disabled: !current || (!!minDate && date < minDate) || (!!maxDate && date > maxDate) }
  })
}
