// Drafts stay on this device, scoped to the signed-in account. Saving never evicts another draft.
export const DRAFT_LIMIT = 10
const key = user => {
  if (!user || String(user) === 'guest') throw new Error('请先登录后使用草稿箱')
  return `kangaroo:drafts:v2:${user}`
}
const copy = value => JSON.parse(JSON.stringify(value))
export function listDrafts(user, kind) {
  const saved = uni.getStorageSync(key(user))
  const rows = Array.isArray(saved) ? saved.filter(x => x && x.id && x.kind && x.data) : []
  return copy(rows.filter(x => !kind || x.kind === kind).sort((a, b) => b.updatedAt - a.updatedAt))
}
export function saveLocalDraft(user, draft) {
  const rows = listDrafts(user)
  const index = draft.id ? rows.findIndex(x => x.id === draft.id && x.kind === draft.kind) : -1
  if (index < 0 && rows.length >= DRAFT_LIMIT) throw new Error('草稿箱最多保存10份，请先删除不需要的草稿')
  const row = { id: index < 0 ? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}` : rows[index].id,
    kind: draft.kind, label: draft.label || '', data: copy(draft.data), updatedAt: Date.now() }
  if (index < 0) rows.push(row)
  else rows[index] = row
  try { uni.setStorageSync(key(user), rows) }
  catch { throw new Error('草稿保存失败，请检查本机存储空间后重试') }
  return row
}
export function removeLocalDraft(user, id) {
  uni.setStorageSync(key(user), listDrafts(user).filter(x => x.id !== id))
}
export function migrateLocalDrafts(user) {
  if (!user) return
  for (const [legacy, kind] of [[`kangaroo:publish-draft:${user}`, 'community'], [`wish:draft:${user}`, 'wish']]) {
    const data = uni.getStorageSync(legacy)
    if (!data || typeof data !== 'object') continue
    const rows = listDrafts(user)
    const id = `legacy-${kind}`
    if (!rows.some(x => x.id === id)) {
      if (rows.length >= DRAFT_LIMIT) continue // Keep the original intact until there is space.
      rows.push({ id, kind, label: data.type || '心愿互助', data, updatedAt: Date.now() })
      uni.setStorageSync(key(user), rows)
    }
    uni.removeStorageSync(legacy)
  }
}
