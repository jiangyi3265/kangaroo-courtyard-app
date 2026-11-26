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
export function paymentLabel(row) {
  const paid = Number(row.amountFen), refunded = Number(row.refundedFen)
  if (row.paymentStatus === 'paid' && refunded > 0 && refunded <= paid) {
    return refunded === paid ? '已退费' : '已部分退费'
  }
  return { legacy: '历史人工办理', pending: '待付款', paid: '已付款', closed: '支付已关闭', refunded: '已退费', part_refunded: '已部分退费' }[row.paymentStatus] || '付款状态待核实'
}
export function departureQuote(row, date) {
  const day = v => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(v || '')) return NaN
    const ms = Date.parse(v + 'T00:00:00Z')
    return Number.isFinite(ms) && new Date(ms).toISOString().slice(0,10) === v ? ms / 86400000 : NaN
  }
  const start = day(row.startDate), end = day(row.endDate), left = day(date), days = end - start + 1
  if (!Number.isFinite(days) || days <= 0 || !Number.isFinite(left)) return null
  const unused = Math.max(0, Math.min(days, end - left))
  return Math.max(0, Math.round(Number(row.amountFen) * unused / days) - Number(row.refundedFen || 0))
}
// 已出单保单核定可退为 0 时，服务端以 rejected 结案（总部不审已出单退费），不是「未通过审核」
export const refundLabel = row => row.status === 'pending' && row.departureDate
  ? (row.verifiedDepartureDate ? (Number(row.amountFen) === 0 ? '可退为零，待城市负责人确认' : '待城市负责人退款') : '待核实离店日期') : row.status === 'rejected' && row.verifiedDepartureDate ? '可退为零，已结案' : ({ pending: '平台审核中', approved: '退款处理中', processing: '退款处理中', queued: '退款处理中', success: row.destination === 'balance' ? '已存入保险余额' : '已原路退回', refunded: row.destination === 'balance' ? '已存入保险余额' : '已原路退回', rejected: '未通过审核', closed: '退款未完成', failed: '退款未完成', abnormal: '退款异常，平台处理中' }[row.status] || '退款状态待核实')
export function initialFinanceState() {
  return { loading: false, busy: false, error: '', readForbidden: false, notice: '', context: {}, rows: [], account: { balanceFen: 0, entries: [] }, selectedId: '', linkedSelection: null,
    form: { appId: '', planId: '', startDate: '', method: 'wechat' }, refundForm: { departureDate: '', amount: '', reason: '', destination: 'original' },
    policyForm: { policyNo: '', startDate: '', endDate: '' } }
}
export function createInsuranceFinance({ state: s, api, scope, allowed, confirm, payFlow, refundTasksOnly = () => false, applicationId = () => '', key = () => 'i' + Date.now().toString(36) + Math.random().toString(36).slice(2) }) {
  let active = false, epoch = 0, sequence = 0, mutation = 0
  const keys = new Map()
  const ticket = () => ({ epoch, scope: scope() })
  const current = t => active && allowed() && epoch === t.epoch && scope() === t.scope
  const stickyKey = (type, body) => { const id = scope() + type + JSON.stringify(body); if (!keys.has(id)) keys.set(id, key()); return keys.get(id) }
  // Retain a request key until the server acknowledges its record; a later business attempt needs a new key.
  const retireKey = requestKey => { for (const [id, value] of keys) if (value === requestKey) keys.delete(id) }
  const listedRow = () => s.rows.find(r => String(r.applyId) === String(s.selectedId))
  const selectedLink = () => s.linkedSelection && String(s.linkedSelection.id) === s.selectedId ? s.linkedSelection : null
  const row = () => listedRow() || selectedLink()?.record
  function clear() { Object.assign(s, initialFinanceState()); sequence++; mutation++ }
  function hide() { active = false; epoch++; clear() }
  function invalidate() { epoch++; keys.clear(); clear() }
  async function show() { active = true; return load() }
  async function fetchRecords() {
    if (refundTasksOnly()) return [null, await api.refundTasks(), null]
    const id = applicationId()
    if (!id) return Promise.all([api.context(), api.rows(), api.account()])
    const response = await api.application(id)
    const data = response?.data
    if (String(data?.appId) !== String(id) || !data.storeId || !Array.isArray(data.rows)
      || data.rows.some(r => String(r.appId) !== String(id) || !r.applyId)) throw new Error('报名保险记录未能核对，请重新读取')
    const candidates = (data.candidates || []).filter(c => String(c.appId) === String(id))
    return [{ data: { ...data, candidates, canApply: data.canApply === true && candidates.length === 1 } }, response, { data: data.account }]
  }
  async function load() {
    const t = ticket(), seq = ++sequence
    if (!current(t)) { clear(); return false }
    s.loading = true; s.error = ''; s.readForbidden = false
    const initializeForms = !row()
    try {
      // 核实离店和办理退款只读当前授权的退费队列，不依赖投保人员名单或个人余额。
      const [c, list, a] = await fetchRecords()
      if (!current(t) || seq !== sequence) return false
      s.context = c?.data || {}; s.rows = list.data?.rows || []; s.account = a?.data || { balanceFen: 0, entries: [] }
      if (!s.context.canApply) s.form = initialFinanceState().form
      if (!listedRow()) {
        if (selectedLink() && !applicationId()) return await readLinked(t, seq, initializeForms)
        s.linkedSelection = null
        s.selectedId = ''
      } else if (initializeForms) {
        fillRecordForms()
      }
      return true
    } catch (e) {
      if (current(t) && seq === sequence) { s.context = {}; s.rows = []; if (s.linkedSelection) s.linkedSelection.record = null; s.account = { balanceFen: 0, entries: [] }; s.readForbidden = e.code === 403; s.error = e.message || '保险信息读取失败，请重试' }
      return false
    } finally { if (current(t) && seq === sequence) s.loading = false }
  }
  function fillRecordForms() {
    const r = row()
    s.refundForm = { departureDate: r?.refund?.verifiedDepartureDate || r?.refund?.departureDate || '', amount: '', reason: '', destination: r?.paymentMethod === 'balance' ? 'balance' : 'original' }
    // 出单前，服务端记录的是拟起保日和按方案天数推算的结束日。
    s.policyForm = r?.policyNo
      ? { policyNo: r.policyNo, startDate: String(r.startDate || '').slice(0, 10), endDate: String(r.endDate || '').slice(0, 10) }
      : { policyNo: '', startDate: '', endDate: '' }
  }
  function choose(id) {
    if (s.busy) return
    s.selectedId = String(id || ''); s.linkedSelection = null
    fillRecordForms()
    s.notice = ''; s.error = ''
  }
  async function readLinked(t, seq, initializeForms) {
    const link = selectedLink()
    const stillSelected = () => current(t) && seq === sequence && selectedLink() === link
    try {
      const result = await api.detail(link.id)
      if (!stillSelected()) return false
      if (String(result.data?.applyId) !== String(link.id)) throw new Error('该投保记录读取失败，请重试')
      link.record = result.data
      if (initializeForms) fillRecordForms()
      return true
    } catch (e) {
      if (stillSelected()) { link.record = null; s.error = e.message || '该投保记录读取失败，请重试' }
      return false
    }
  }
  async function openRecord(id) {
    if (s.busy) return
    const t = ticket(), seq = ++sequence
    if (!current(t)) return
    choose(id)
    s.loading = false
    if (!s.selectedId) return
    if (applicationId() && !listedRow()) { choose(''); return }
    s.linkedSelection = { id, record: null }
    if (listedRow()) return
    s.loading = true
    try { await readLinked(t, seq, true) }
    finally { if (current(t) && seq === sequence) s.loading=false }
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
    const r = row(), form = JSON.stringify(s.refundForm), amountFen = r?.policyNo ? departureQuote(r, s.refundForm.departureDate) : parseFen(s.refundForm.amount)
    if (!r?.canRefund || !r.isPayer || r.paymentStatus === 'legacy') throw new Error('只有实际付款人可以申请退费')
    if (r.policyNo && !amountFen) throw new Error('请选择有可退保费的离店日期')
    if (!amountFen || amountFen > Number(r.refundableFen)) throw new Error('请填写不超过剩余可退金额的有效金额')
    const body = { ...(r.policyNo ? { departureDate: s.refundForm.departureDate } : { amountFen }), reason: s.refundForm.reason.trim() || (r.policyNo ? '义工离店退费' : ''), destination: s.refundForm.destination }
    if (body.reason.length < 2 || body.reason.length > 500) throw new Error('请填写 2 至 500 字退费原因')
    if (!['original', 'balance'].includes(body.destination) || (r.paymentMethod === 'balance' && body.destination !== 'balance')) throw new Error('余额缴费只能退回保险余额')
    if (!(await confirm('提交退费申请', `申请 ¥${money(amountFen)}，${body.destination === 'balance' ? '预存本人保险余额，用于下次缴费' : '退回原支付渠道'}。${r.policyNo ? '离店日期可由换工主理人或城市负责人核实，再由城市负责人办理退款。' : '平台核实可退金额后处理，提交不代表退费成功。'}`)) || !current(t) || form !== JSON.stringify(s.refundForm) || String(r.applyId) !== String(s.selectedId)) return
    const requestKey = stickyKey('refund:' + r.applyId, body), result = await api.refund(r.applyId, { ...body, requestKey })
    if (!current(t)) return
    const acknowledged = (result.data || result)?.refund
    if (!acknowledged?.refundId) throw new Error('退费申请结果尚未确认，请重试核对')
    retireKey(requestKey)
    s.notice = acknowledged.departureDate ? refundLabel(acknowledged) : acknowledged.status === 'pending' ? '退费申请已提交，等待平台审核' : '退费处理状态已更新，请核对下方进度'; await load()
  })
  const departure = step => act(async t => {
    const r = row(), rid = r?.refund?.refundId
    const permission = {add:'canAddDeparture',verify:'canVerifyDeparture',verifyPay:'canVerifyAndPayDeparture',pay:'canPayDeparture'}[step]
    if (!rid || !r[permission]) throw new Error('记录状态已变化，请刷新')
    const date = step === 'pay' ? r.refund.verifiedDepartureDate : s.refundForm.departureDate
    const amount = step === 'pay' ? Number(r.refund.amountFen) : departureQuote(r, date)
    if (step === 'pay' && (!date || !Number.isSafeInteger(amount) || amount < 0)) throw new Error('请刷新并核对退款金额')
    if (amount == null) throw new Error('请选择有效的离店日期')
    const closing = (step === 'verifyPay' || step === 'pay') && amount === 0
    const title = closing ? '确认零元结案' : {add:'补充离店日期',verify:'确认核实结果',verifyPay:'核实并退款',pay:'确认办理退款'}[step]
    if (!(await confirm(title, `离店日期 ${date}，可退 ¥${money(amount)}。${closing ? '确认后直接结案，不退款。' : ''}`)) || !current(t) || row()?.refund?.refundId !== rid || (step !== 'pay' && date !== s.refundForm.departureDate)) return
    try {
      await api.departure(r.applyId, rid, step, step === 'pay' || step === 'verifyPay' ? {departureDate:date, amountFen:amount} : step === 'verify' ? {departureDate:date, saveOnly:true} : {departureDate:date})
    } catch (error) {
      if (!current(t)) return
      if (error.code === 403 || error.code === 409) await load()
      else if (!error.code || error.code === -1 || error.code === 408 || error.code >= 500) {
        // 写入可能已经生效。只重读状态，不重放付款或核实请求。
        const refreshed = await load()
        if (!current(t)) return
        if (!refreshed) throw new Error('未能确认最新退费状态，请点「重新读取」核对进度。')
        if (!row()?.[permission] || row()?.refund?.refundId !== rid) {
          s.notice = '已重新读取退费进度，请核对最新状态。'
          return
        }
      }
      throw error
    }
    if (!current(t)) return
    s.notice = step === 'verify' ? '已核实离店日期' : '已提交，请查看退费进度'; await load()
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
  return { show, hide, invalidate, load, choose, openRecord, row, create, pay, cancel, refund, departure, register }
}
