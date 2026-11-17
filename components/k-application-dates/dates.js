export function dateDays(start, end) {
  const parse = value => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || ''))) return NaN
    const n = Date.parse(value + 'T00:00:00Z')
    return Number.isFinite(n) && new Date(n).toISOString().slice(0, 10) === value ? n : NaN
  }
  const days = (parse(end) - parse(start)) / 86400000 + 1
  return Number.isInteger(days) && days > 0 ? days : 0
}
export function datePlan(value, appId) {
  if (!value || Number(value.appId) !== Number(appId) || !Number.isSafeInteger(Number(value.revision)) || Number(value.revision) < 0 || !['not_set', 'pending', 'confirmed'].includes(value.state)) throw new Error('时间信息未能加载，请重试')
  if (value.state !== 'not_set' && (!dateDays(value.startDate, value.endDate) || Number(value.revision) === 0)) throw new Error('时间信息不完整，请重试')
  return value
}
export function dateError(start, end, data) {
  const days = dateDays(start, end)
  if (!days) return '请选择有效的起止日期，结束日期不能早于开始日期'
  if (start < data.minDate) return '开始日期不能早于 ' + data.minDate
  if (days < Number(data.minDays || 1)) return '该岗位最短需停留 ' + data.minDays + ' 天'
  if (days > 365) return '时间段最多 365 天'
  return ''
}
