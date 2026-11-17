// Only broadcast server-confirmed changes. Data is not cached or persisted here;
// each page still reads the server when opened/refreshed. Scope events to an account.
const listeners = new Set()

export function onJobFavoriteChange(listener) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function publishJobFavoriteChange(accountId, jobId, favorite) {
  if (!accountId || !jobId || typeof favorite !== 'boolean') return
  const change = { accountId: String(accountId), jobId: String(jobId), favorite }
  for (const listener of listeners) listener(change)
}
