// Insurance principal is separate from commissions and membership points.
export const money = value => (Number(value || 0) / 100).toFixed(2)
export function parseFen(value) {
  const text = String(value).trim()
  if (!/^(?:0|[1-9]\d{0,7})(?:\.\d{1,2})?$/.test(text)) return null
  const [whole, cents = ''] = text.split('.')
  const fen = Number(whole) * 100 + Number(cents.padEnd(2, '0'))
  return Number.isSafeInteger(fen) && fen > 0 ? fen : null
}
export function validPolicy(body) {
  const valid = value => /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value + 'T00:00:00Z')) && new Date(value + 'T00:00:00Z').toISOString().slice(0, 10) === value
  if (!body.policyNo.trim() || body.policyNo.trim().length > 64 || !valid(body.startDate) || !valid(body.endDate) || body.endDate < body.startDate) return false
  const latest = new Date(body.startDate + 'T00:00:00Z'), month = latest.getUTCMonth()
  latest.setUTCFullYear(latest.getUTCFullYear() + 10)
  if (latest.getUTCMonth() !== month) latest.setUTCDate(0)
  return body.endDate <= latest.toISOString().slice(0, 10)
}
export const paymentLabel = row => ({ legacy: '历史人工办理', pending: '待付款', paid: '已付款', closed: '支付已关闭', refunded: '已退费', part_refunded: '已部分退费' }[row.paymentStatus] || '付款状态待核实')
export const refundLabel = row => ({ pending: '平台审核中', approved: '退款处理中', processing: '退款处理中', queued: '退款处理中', success: row.destination === 'balance' ? '已存入保险余额' : '已原路退回', refunded: row.destination === 'balance' ? '已存入保险余额' : '已原路退回', rejected: '未通过审核', closed: '退款未完成', failed: '退款未完成', abnormal: '退款异常，平台处理中' }[row.status] || '退款状态待核实')
export function initialFinanceState() {
  return { loading: false, busy: false, error: '', notice: '', context: {}, rows: [], account: { balanceFen: 0, entries: [] }, selectedId: '',
    form: { appId: '', planId: '', startDate: '', method: 'wechat' }, refundForm: { amount: '', reason: '', destination: 'original' },
    policyForm: { policyNo: '', startDate: '', endDate: '' } }
}
export function createInsuranceFinance({ state: s, api, scope, allowed, confirm, payFlow, key = () => 'i' + Date.now().toString(36) + Math.random().toString(36).slice(2) }) {
  let active = false, epoch = 0, sequence = 0, mutation = 0
  const keys = new Map()
  const ticket = () => ({ epoch, scope: scope() })
  const current = t => active && allowed() && epoch === t.epoch && scope() === t.scope
  const stickyKey = (type, body) => { const id = scope() + type + JSON.stringify(body); if (!keys.has(id)) keys.set(id, key()); return keys.get(id) }
  // Retain a request key until the server acknowledges its record; a later business attempt needs a new key.
  const retireKey = requestKey => { for (const [id, value] of keys) if (value === requestKey) keys.delete(id) }
  const row = () => s.rows.find(r => String(r.applyId) === String(s.selectedId))
  function clear() { Object.assign(s, initialFinanceState()); sequence++; mutation++ }
  function hide() { active = false; epoch++; clear() }
  function invalidate() { epoch++; keys.clear(); clear() }
  async function show() { active = true; return load() }
  async function load() {
    const t = ticket(), seq = ++sequence
    if (!current(t)) { clear(); return false }
    s.loading = true; s.error = ''
    const selected = s.selectedId
    try {
      const [c, list, a] = await Promise.all([api.context(), api.rows(), api.account()])
      if (!current(t) || seq !== sequence) return false
      s.context = c.data || {}; s.rows = list.data?.rows || []; s.account = a.data || { balanceFen: 0, entries: [] }
      s.selectedId = s.rows.some(r => String(r.applyId) === String(selected)) ? selected : ''
      if (!s.context.canApply) s.form = initialFinanceState().form
      return true
    } catch (e) {
      if (current(t) && seq === sequence) { s.context = {}; s.rows = []; s.account = { balanceFen: 0, entries: [] }; s.error = e.message || '保险信息读取失败，请重试' }
      return false
    } finally { if (current(t) && seq === sequence) s.loading = false }
  }
  function choose(id) {
    if (s.busy) return
    s.selectedId = String(id || '')
    const r = row()
    s.refundForm = { amount: '', reason: '', destination: r?.paymentMethod === 'balance' ? 'balance' : 'original' }
    s.policyForm = { policyNo: r?.policyNo || '', startDate: String(r?.startDate || '').slice(0, 10), endDate: String(r?.endDate || '').slice(0, 10) }
    s.notice = ''; s.error = ''
  }
  async function openRecord(id) {
    if (s.busy) return
    choose(id)
    if (row() || !id) return
    const t = ticket(), seq = ++sequence
    s.loading = true
    try {
      const result = await api.detail(id)
      if (!current(t) || seq !== sequence || String(id) !== s.selectedId) return
      s.rows = [result.data, ...s.rows]; choose(id)
    } catch (e) {
      if (current(t) && seq === sequence) { s.selectedId=''; s.error=e.message || '该投保记录读取失败，请重试' }
    } finally { if (current(t) && seq === sequence) s.loading=false }
  }
  async function act(fn) {
    if (s.busy || s.loading || !allowed() || !active) return
    const t = ticket(), id = ++mutation
    s.busy = true; s.error = ''; s.notice = ''
    try { await fn(t) } catch (e) { if (current(t)) s.error = e.message || '操作未完成，请刷新后重试' }
    finally { if (current(t) && id === mutation) s.busy = false }
  }
  async function payResult(result, t) {
    const r = result.data || result
    if (!current(t)) return
    s.selectedId = String(r.applyId || s.selectedId)
    if (r.paymentStatus === 'paid') { s.notice = '缴费已确认，等待登记真实保单'; await load(); return }
    if (r.payNo && r.paymentStatus === 'pending') {
      const answer = await payFlow(r.payNo, { isCurrent: () => current(t) })
      if (!current(t)) return
      s.notice = answer.status === 'paid' ? '已确认付款，请核对下方投保状态' : answer.status === 'cancel' ? '已取消付款，可从此记录继续缴费' : '付款结果确认中，请刷新状态；不要重复付款'
    } else s.notice = '申请已保存，请查看最新缴费状态'
    await load()
  }
  const create = () => act(async t => {
    const body = { ...s.form }, form = JSON.stringify(body)
    const candidate = (s.context.candidates || []).find(r => String(r.appId) === String(body.appId))
    const plan = (s.context.plans || []).find(r => String(r.planId) === String(body.planId))
    if (!s.context.canApply || !candidate || !plan) throw new Error('请选择当前门店可投保的人员和保险方案')
    if (!/^\d{4}-\d{2}-\d{2}$/.test(body.startDate)) throw new Error('请选择起保日期')
    if (!['wechat', 'balance'].includes(body.method)) throw new Error('请选择付款方式')
    if (body.method === 'balance' && Number(s.account.balanceFen) < Number(plan.price)) throw new Error('保险余额不足，请选择微信支付')
    const answer = await confirm('确认投保并缴费', `${candidate.name || candidate.insuredName || '所选人员'} · ${plan.name || plan.planName}\n保费 ¥${money(plan.price)}，${body.method === 'balance' ? '从本人保险余额扣除' : '使用微信支付'}。付款不代表保障生效，以实际保单为准。`)
    if (!answer || !current(t) || form !== JSON.stringify(s.form)) return
    const requestKey = stickyKey('create', body), result = await api.create({ ...body, requestKey })
    if (!current(t)) return
    if (!(result.data || result)?.applyId) throw new Error('投保申请结果尚未确认，请重试核对；不要重新填写其他申请')
    retireKey(requestKey)
    await payResult(result, t)
  })
  const pay = () => act(async t => {
    const r = row(); if (!r?.canPay) throw new Error('当前记录不能付款，请刷新状态')
    const id = r.applyId
    if (!(await confirm('继续缴费', `保费 ¥${money(r.amountFen)}。${r.paymentMethod === 'balance' ? '使用本人保险余额。' : '将打开微信支付。'}`)) || !current(t) || String(id) !== String(s.selectedId)) return
    await payResult(await api.pay(id), t)
  })
  const cancel = () => act(async t => {
    const r = row(); if (!r?.canCancel) throw new Error('该申请当前不能取消')
    if (!(await confirm('取消未付款申请', '服务端将核对支付结果。已经到账的费用需另行申请退费。')) || !current(t) || String(r.applyId) !== String(s.selectedId)) return
    await api.cancel(r.applyId)
    if (!current(t)) return
    s.notice = '取消操作已处理，请核对最新状态'; await load()
  })
  const refund = () => act(async t => {
    const r = row(), form = JSON.stringify(s.refundForm), amountFen = parseFen(s.refundForm.amount)
    if (!r?.canRefund || !r.isPayer || r.paymentStatus === 'legacy') throw new Error('只有实际付款人可以申请退费')
    if (!amountFen || amountFen > Number(r.refundableFen)) throw new Error('请填写不超过剩余可退金额的有效金额')
    const body = { amountFen, reason: s.refundForm.reason.trim(), destination: s.refundForm.destination }
    if (body.reason.length < 2 || body.reason.length > 500) throw new Error('请填写 2 至 500 字退费原因')
    if (!['original', 'balance'].includes(body.destination) || (r.paymentMethod === 'balance' && body.destination !== 'balance')) throw new Error('余额缴费只能退回保险余额')
    if (!(await confirm('提交退费申请', `申请 ¥${money(amountFen)}，${body.destination === 'balance' ? '预存本人保险余额，用于下次缴费' : '退回原支付渠道'}。平台核实可退金额后处理，提交不代表退费成功。`)) || !current(t) || form !== JSON.stringify(s.refundForm) || String(r.applyId) !== String(s.selectedId)) return
    const requestKey = stickyKey('refund:' + r.applyId, body), result = await api.refund(r.applyId, { ...body, requestKey })
    if (!current(t)) return
    const acknowledged = (result.data || result)?.refund
    if (!acknowledged?.refundId) throw new Error('退费申请结果尚未确认，请重试核对')
    retireKey(requestKey)
    s.notice = acknowledged.status === 'pending' ? '退费申请已提交，等待平台审核' : '退费处理状态已更新，请核对下方进度'; await load()
  })
  const register = () => act(async t => {
    const r = row(), body = { ...s.policyForm, policyNo: s.policyForm.policyNo.trim() }, form = JSON.stringify(s.policyForm)
    if (!r?.canRegister) throw new Error('当前身份不能登记此保单')
    if (!validPolicy(body)) throw new Error('请填写真实保单号和有效的保障起止日期')
    if (!(await confirm('确认登记真实保单', `${body.policyNo}\n保障日期：${body.startDate} 至 ${body.endDate}。请与保险公司保单核对一致。`)) || !current(t) || form !== JSON.stringify(s.policyForm) || String(r.applyId) !== String(s.selectedId)) return
    await api.policy(r.applyId, body)
    if (!current(t)) return
    s.notice = '保单已登记，保障状态按实际日期显示'; await load()
  })
  return { show, hide, invalidate, load, choose, openRecord, row, create, pay, cancel, refund, register }
}
