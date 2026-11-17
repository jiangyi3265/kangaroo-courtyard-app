// 门店关注单独维护，不当作岗位条件订阅。
export function currentJobSubscription(rows = []) {
  return rows.filter(x => !(x.storeId && !x.cities && !x.jobTypes && !x.keyword))
    .sort((a, b) => Number(String(b.status) === '0') - Number(String(a.status) === '0') || Number(b.subId) - Number(a.subId))[0] || null
}
export const splitSubscription = value => String(value || '').split(',').map(x => x.trim()).filter(Boolean)
