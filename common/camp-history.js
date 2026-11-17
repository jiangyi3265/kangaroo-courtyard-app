const key = owner => `kangaroo:camp-destination:v1:${owner || 'guest'}`
export function rememberDestination(owner, city, at = Date.now()) {
  const name = String(city || '').trim()
  if (!name || name === '全部城市' || name.length > 32) return
  try { uni.setStorageSync(key(owner), { city: name, at }) } catch (_) { /* 不影响浏览 */ }
}
export function recentDestination(owner) {
  try {
    const row = uni.getStorageSync(key(owner))
    if (row?.city && Number.isFinite(row.at) && row.at > 0) return row
  } catch (_) { /* 存储不可用时仍可手动选城 */ }
  return { city: '', at: 0 }
}
