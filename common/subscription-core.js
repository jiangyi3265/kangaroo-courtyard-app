// Request must run synchronously in the tap handler; preload the server receipt separately.
export function groupSubscriptionRows(rows = []) {
  const groups = new Map()
  for (const row of rows) {
    if (!row?.templateId || !row?.bizKey) continue
    if (!groups.has(row.templateId)) groups.set(row.templateId, { templateId: row.templateId, keys: [], labels: [], quota: Number(row.quota) || 0 })
    const group = groups.get(row.templateId)
    if (!group.keys.includes(row.bizKey)) { group.keys.push(row.bizKey); group.labels.push(row.title || row.bizKey) }
  }
  return [...groups.values()]
}

export function createSubscriptionController({ prepare, accept, request, identity, changed, clock = Date.now }) {
  let sequence = 0, owner = '', expires = 0, pending = null
  const state = { loading: false, busy: false, enabled: false, groups: [], ticket: '', error: '', retry: false, notice: '' }
  const emit = () => changed({ ...state, groups: [...state.groups] })
  async function refresh() {
    const seq = ++sequence; owner = identity(); state.loading = true; state.ticket = ''; state.error = ''; emit()
    try {
      const data = await prepare()
      if (seq !== sequence || owner !== identity()) return
      state.enabled = !!data.enabled; state.groups = groupSubscriptionRows(data.rows); state.ticket = data.ticket || ''
      expires = clock() + Math.max(0, Number(data.expiresIn) || 0) * 1000 - 5000
    } catch (e) { if (seq === sequence) state.error = e?.message || '订阅设置暂时无法读取，请重试' }
    finally { if (seq === sequence) { state.loading = false; emit() } }
  }
  async function save() {
    if (!pending || owner !== identity()) { pending = null; state.busy = false; emit(); return }
    state.busy = true; state.error = ''; emit()
    try {
      const data = await accept(pending)
      if (owner !== identity()) return
      pending = null; state.retry = false
      state.notice = data.accepted > 0 ? '已记录授权。每允许一次，可接收该模板的一条提醒。' : '本次没有新增授权，站内消息照常接收。'
      await refresh()
    } catch (e) { if (owner === identity()) { if (e?.code === 422) { pending = null; state.retry = false; await refresh(); state.error = '授权记录已过期，请重新订阅' } else { state.retry = true; state.error = '授权记录未保存，请重试保存；不会重复弹出授权。' } } }
    finally { state.busy = false; emit() }
  }
  function ask(templateIds) {
    if (state.busy || state.loading || pending) return false
    if (!state.ticket || clock() >= expires || owner !== identity()) { state.notice = '正在更新订阅设置，请稍后再点击'; emit(); refresh(); return false }
    const allowed = new Set(state.groups.map(g => g.templateId))
    const ids = [...new Set(templateIds)].filter(id => allowed.has(id))
    if (!ids.length || ids.length > 3) { state.error = '每次请选择一至三类提醒'; emit(); return false }
    const ticket = state.ticket, account = owner
    state.busy = true; state.ticket = ''; state.error = ''; state.notice = ''; emit()
    try {
      request({ tmplIds: ids,
        success(result) {
          if (account !== identity()) { state.busy = false; refresh(); return }
          pending = { ticket, results: Object.fromEntries(ids.filter(id => ['accept', 'reject', 'ban'].includes(result[id])).map(id => [id, result[id]])) }
          save()
        },
        fail(error) { state.busy = false; const reason = error?.message || '微信授权未完成，可以重新点击'; refresh().then(() => { state.error = reason; emit() }) }
      })
    } catch (e) { state.busy = false; const reason = e?.message || '请在微信小程序内订阅'; refresh().then(() => { state.error = reason; emit() }) }
    return true
  }
  return { refresh, ask, retrySave: save, dispose() { sequence++; owner = ''; pending = null } }
}
