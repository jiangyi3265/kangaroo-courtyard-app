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

// 微信只能在点击时一次询问至多三个不同模板。共用模板的业务合并，下一次使用从上次的位置继续。
export function createVisitSubscriptions({ scope, surface, prepare, accept, request, changed, readCursor, writeCursor }) {
  const initial = () => ({ groups: [], enabled: false, busy: false, loading: false, retry: false, error: '', notice: '' })
  let owner, controller, state = initial()
  const visits = new Map()
  function visit() {
    const key = surface()
    if (!visits.has(key)) visits.set(key, { prompted: false, seen: new Set() })
    return visits.get(key)
  }
  function remaining() {
    return state.groups.filter(g => g.quota < 5 && !visit().seen.has(g.templateId))
  }
  function publish() { changed({ ...state, remaining: remaining().length }) }
  function connect() {
    const next = scope()
    if (owner === next) return controller
    controller?.dispose()
    owner = next
    controller = null
    state = initial()
    publish()
    if (!owner) { visits.clear(); return null }
    controller = createSubscriptionController({
      identity: scope, prepare, accept, request,
      answered(ids) {
        ids.forEach(id => visit().seen.add(id))
        writeCursor(surface(), ids[ids.length - 1])
      },
      changed(value) { state = value; publish() }
    })
    return controller
  }
  function warm(force = false) {
    const active = connect()
    if (active && !state.busy && !state.retry && !state.loading && (force || !active.fresh())) return active.refresh()
  }
  function ask(manual = false) {
    const active = connect()
    if (!active || state.busy || state.retry || state.loading) return false
    if (!state.enabled) { warm(); return false }
    const current = visit()
    if (!manual && current.prompted) return false
    if (manual && !remaining().length) current.seen.clear()
    const last = readCursor(surface())
    const cursor = state.groups.findIndex(g => g.templateId === last)
    const ordered = state.groups.slice(cursor + 1).concat(state.groups.slice(0, cursor + 1))
    const batch = ordered.filter(g => g.quota < 5 && !current.seen.has(g.templateId)).slice(0, 3)
    if (!batch.length) return false
    const started = active.ask(batch.map(g => g.templateId))
    if (started) current.prompted = true
    return started
  }
  function endVisit() {
    // 系统授权弹窗或待保存的回执仍属于这一次操作。
    if (state.busy || state.retry) return
    visits.clear()
    controller?.dispose()
    controller = null
    owner = undefined
    state = initial()
    publish()
  }
  return { warm, ask, endVisit, retrySave: () => connect()?.retrySave() }
}

export function createSubscriptionController({ prepare, accept, request, identity, changed, clock = Date.now, answered = () => {} }) {
  let sequence = 0, owner = '', expires = 0, pending = null, disposed = false, saving = false
  const state = { loading: false, busy: false, enabled: false, groups: [], ticket: '', error: '', retry: false, notice: '' }
  const emit = () => { if (!disposed) changed({ ...state, groups: [...state.groups] }) }
  async function refresh() {
    if (disposed) return
    const seq = ++sequence; owner = identity(); state.loading = true; state.ticket = ''; state.error = ''; emit()
    try {
      const data = await prepare()
      if (seq !== sequence || owner !== identity()) return
      state.enabled = !!data.enabled; state.groups = groupSubscriptionRows(data.rows); state.ticket = data.ticket || ''
      const ttl = data.ticket ? Number(data.expiresIn) || 0 : 60
      expires = clock() + Math.max(0, ttl) * 1000 - 5000
    } catch (e) { if (seq === sequence) state.error = e?.message || '订阅设置暂时无法读取，请重试' }
    finally { if (seq === sequence) { state.loading = false; emit() } }
  }
  async function save() {
    if (saving) return
    if (disposed || !pending || owner !== identity()) { pending = null; state.busy = false; emit(); return }
    saving = true
    state.busy = true; state.error = ''; emit()
    try {
      const data = await accept(pending.body)
      if (disposed || owner !== identity()) return
      answered(pending.ids)
      pending = null; state.retry = false
      if (Array.isArray(data.rows)) state.groups = groupSubscriptionRows(data.rows)
      if (data.alreadyRecorded || data.accepted == null) state.notice = '本次订阅选择已保存。'
      else state.notice = data.accepted > 0 ? '已记录授权。每允许一次，可接收该模板的一条提醒。' : '本次没有新增授权，站内消息照常接收。'
      await refresh()
    } catch (e) { if (!disposed && owner === identity()) { if (e?.code === 422) { pending = null; state.retry = false; await refresh(); state.error = '授权记录已过期，请重新订阅' } else { state.retry = true; state.error = '授权记录未保存，请重试保存；不会重复弹出授权。' } } }
    finally { saving = false; state.busy = false; emit() }
  }
  function ask(templateIds) {
    if (disposed || state.busy || state.loading || pending) return false
    if (!state.ticket || clock() >= expires || owner !== identity()) { state.notice = '正在更新订阅设置，请稍后再点击'; emit(); refresh(); return false }
    const allowed = new Set(state.groups.map(g => g.templateId))
    const ids = [...new Set(templateIds)].filter(id => allowed.has(id))
    if (!ids.length || ids.length > 3) { state.error = '每次请选择一至三类提醒'; emit(); return false }
    const ticket = state.ticket, account = owner
    state.busy = true; state.ticket = ''; state.error = ''; state.notice = ''; emit()
    try {
      request({ tmplIds: ids,
        success(result) {
          if (disposed) return
          if (account !== identity()) { state.busy = false; emit(); return }
          const results = Object.fromEntries(ids.filter(id => ['accept', 'reject', 'ban'].includes(result[id])).map(id => [id, result[id]]))
          pending = { ids, body: { ticket, results } }
          save()
        },
        fail(error) { state.busy = false; const reason = error?.message || '微信授权未完成，可以重新点击'; refresh().then(() => { state.error = reason; emit() }) }
      })
    } catch (e) { state.busy = false; const reason = e?.message || '请在微信小程序内订阅'; refresh().then(() => { state.error = reason; emit() }) }
    return true
  }
  return { refresh, ask, fresh: () => clock() < expires, retrySave: save, dispose() { disposed = true; sequence++; owner = ''; pending = null } }
}
