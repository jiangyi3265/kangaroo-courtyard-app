export const validId = value => Number.isSafeInteger(Number(value)) && Number(value) > 0 ? Number(value) : 0
export function applicationMessages(data, appId) {
  if (!validId(appId) || validId(data?.appId) !== validId(appId)) throw new Error('报名消息未能加载，请重试')
  return {
    ...data,
    store: data.store?.bizType === 'chat_conv' && validId(data.store.id) && validId(data.store.bizId) ? data.store : null,
    rows: (Array.isArray(data.rows) ? data.rows : []).filter(m => m?.bizType === 'application' && validId(m.bizId) === validId(appId) && validId(m.id)),
    unread: Math.max(0, Number(data.unread) || 0), hasMore: data.hasMore === true, nextBefore: validId(data.nextBefore)
  }
}
export function messageTime(value) {
  if (!value) return ''
  const raw = String(value), date = new Date(raw.includes('T') ? raw : raw.replace(/-/g, '/'))
  if (!Number.isFinite(date.getTime())) return ''
  const pad = n => String(n).padStart(2, '0')
  return `${date.getFullYear() === new Date().getFullYear() ? '' : date.getFullYear() + '-'}${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`
}
