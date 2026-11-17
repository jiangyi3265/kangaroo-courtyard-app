// 城市服务入口与具体民宿关注分开；订阅只覆盖本城线下岗位。
export const LOCAL_JOB_TYPES = ['volunteer', 'parttime', 'fulltime']
export function coordinatorCity(value) {
  const city = String(value || '').trim()
  if (/^平潭(?:岛|县|综合实验区)?$/.test(city)) return '平潭'
  return city.replace(/市$/, '')
}
const list = value => Array.isArray(value) ? value : String(value || '').split(',').filter(Boolean)
export function localSubscriptionPayload(city) {
  const name = coordinatorCity(city)
  if (!name) return null
  return { cities: [name], jobTypes: [...LOCAL_JOB_TYPES], keyword: '', freq: 'instant' }
}
export function localSubscriptions(rows, city) {
  const name = coordinatorCity(city)
  if (!name) return []
  return (rows || []).filter(row => {
    const cities = list(row.cities).map(coordinatorCity)
    const types = [...new Set(list(row.jobTypes))]
    return row.subId && String(row.status) === '0' && !row.storeId && !String(row.keyword || '').trim() && !row.fromDate &&
      cities.length === 1 && cities[0] === name && types.length === LOCAL_JOB_TYPES.length && LOCAL_JOB_TYPES.every(type => types.includes(type))
  })
}
// 2026-11-03 主人：每人只有一条新机会订阅。当前订阅已经管到这座城市（城市里有它，或不限城市），且没限定成只收线上任务，
// 卡片就显示「已订阅」，不再另建一条只订本地的
const JOB_CODES = ['volunteer', 'parttime', 'fulltime', 'online']
export function coveredBySubscription(row, city) {
  const name = coordinatorCity(city)
  if (!name || !row || String(row.status) !== '0') return false
  const cities = list(row.cities).map(coordinatorCity)
  const codes = list(row.jobTypes).filter(type => JOB_CODES.includes(type))
  return (!cities.length || cities.includes(name)) && (!codes.length || codes.some(type => LOCAL_JOB_TYPES.includes(type)))
}
