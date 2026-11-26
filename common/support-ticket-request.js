// 响应丢失时，弹层、整页和重新打开的小程序都能以同一标识取回原工单。
// 本机只保存内容指纹和随机标识，不保存用户的问题或订单资料。
const pending = new Map()

function attemptSlot(account, body) {
  const related = String(body.related || '')
  const reference = related.startsWith('订单：') ? related.split('　', 1)[0] : related
  const intent = JSON.stringify([body.mode, body.context, reference, body.followUpTicketId || '', body.question])
  let first = 2166136261, second = 5381
  for (let i = 0; i < intent.length; i++) {
    first = Math.imul(first ^ intent.charCodeAt(i), 16777619)
    second = Math.imul(second, 33) ^ intent.charCodeAt(i)
  }
  return 'kangaroo:' + account + ':support:' + (first >>> 0).toString(36) + '-' + (second >>> 0).toString(36)
}

export async function submitSupportTicket(account, body, postTicket, retryId) {
  const slot = attemptSlot(account, body)
  let id = retryId || pending.get(slot)
  if (!id) {
    try { id = uni.getStorageSync(slot) } catch { /* 无本地存储时，同次运行仍可重试 */ }
    if (typeof id !== 'string' || !/^[a-z0-9_-]{16,64}$/.test(id))
      id = 'ticket-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 12).padEnd(10, '0') + Math.random().toString(36).slice(2, 12)
    pending.set(slot, id)
    try { uni.setStorageSync(slot, id) } catch { /* 保留内存中的标识 */ }
  }
  let res
  try {
    res = await postTicket({ ...body, requestId: id })
    if (!res?.data?.ticketId) throw new Error('暂未收到工单编号，请重试')
  } catch (error) {
    const problem = error instanceof Error ? error : new Error(error?.message || '提交工单失败')
    problem.ticketRequestId = id
    throw problem
  }
  if (pending.get(slot) === id) pending.delete(slot)
  try { if (uni.getStorageSync(slot) === id) uni.removeStorageSync(slot) } catch { /* 已收到回执 */ }
  return res
}
