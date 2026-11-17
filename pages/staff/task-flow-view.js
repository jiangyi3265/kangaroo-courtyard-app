// 2026-11-03 主人：「任务派发，需要有个流转过程，不能只单向发送」「小院主理人，审核活动」「线上任务，几天，是预期，过期了线上专员有个，增加一个继续开启的功能」。
// 小程序这边的纯逻辑：管理员任务页（platform-tasks.vue）、工作台、活动审核页、线上任务页共用。放 staff 分包，不进主包，不引 @/，node --test 直接跑。
// 状态、按钮能不能点（canAccept / canSubmit / canReopen …）都听服务端的，这里只管文字和分组。

export const TASK_API = '/app/staff/platform-tasks'
export const KEEPER_ACTIVITIES_API = '/app/staff/keeper/activities'
export const ONLINE_REOPEN_API = (jobId) => '/app/staff/online/tasks/' + jobId + '/reopen'

// 待接收 → 进行中 → 待审核 → 已完成 / 已驳回（→ 改完重交）/ 无法完成 / 已关闭
export const TASK_LABELS = { pending: '待接收', accepted: '进行中', submitted: '待审核', approved: '已完成', rejected: '已驳回', declined: '无法完成', closed: '已关闭' }
export const TASK_TABS = [{ key: 'todo', label: '待办' }, { key: 'submitted', label: '待审核' }, { key: 'approved', label: '已完成' }, { key: '', label: '全部' }]

/** 列表右下角的提示：下一步该做什么 */
export function nextStep(status) {
  return { pending: '去接收', accepted: '去完成', rejected: '修改重交', submitted: '等审核', declined: '等管理员处理' }[status] || '查看任务'
}

/** 详情页底部的动作按钮，按服务端给的 can* 决定有哪些 */
export function taskActions(t) {
  if (!t) return []
  const list = []
  if (t.canReply) list.push({ key: 'reply', label: '回复 / 提问' })
  if (t.canRequestExtend) list.push({ key: 'extend_request', label: '申请延期' })
  if (t.canDecline) list.push({ key: 'decline', label: '做不了' })
  return list
}

/** 填写动作时的说明文字和必填规则（和服务端 KgStaffTaskService.act 一致） */
export const ACT_FORM = {
  reply: { title: '回复管理员', placeholder: '想问的问题、进展或需要管理员知道的情况', needText: false, images: true },
  extend_request: { title: '申请延期', placeholder: '为什么需要延期（必填）', needText: true, date: true },
  decline: { title: '说明做不了', placeholder: '做不了的原因（必填），管理员会改派或关闭', needText: true }
}

/** 提交前先挡常见漏填，说法和服务端一样 */
export function checkAct(action, { content = '', fileIds = [], dueDate = '' } = {}, today = '') {
  const text = String(content || '').trim()
  if (!ACT_FORM[action]) return '操作不正确'
  if (action === 'reply' && !text && !fileIds.length) return '请填写回复内容或附上图片'
  if (ACT_FORM[action].needText && !text) return action === 'decline' ? '请填写无法完成的原因' : '请填写延期原因'
  if (text.length > 1000) return '内容不能超过1000字'
  if (action === 'extend_request') {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dueDate)) return '请选择希望延到的日期'
    if (today && dueDate < today) return '希望延到的日期不能早于今天'
  }
  return ''
}

/** 时间线一行：谁、什么时候、做了什么 */
export function eventLine(e) {
  const who = e.actorType === 'admin' ? '管理员' + (e.actorName ? ' ' + e.actorName : '') : (e.actorName || '我')
  return who + ' · ' + (e.actionLabel || e.action) + (e.dueDate ? '（' + e.dueDate + '）' : '')
}

/** 小院主理人工作台：本店还有几场活动等审核（只问要数，pageSize 1） */
export async function keeperReviewCount(get, storeId) {
  const r = await get(KEEPER_ACTIVITIES_API, { storeId, pageNum: 1, pageSize: 1 })
  return Number((r && r.data && r.data.total) || 0)
}

/** 线上任务「几天」是预计：到期停止接单，可以继续开启；剩余天数向上取整 */
export function expectLabel(deadline, now = Date.now()) {
  if (!deadline) return ''
  const t = new Date(String(deadline).replace(' ', 'T')).getTime()
  if (Number.isNaN(t)) return ''
  if (t <= now) return '已过预计完成时间'
  const days = Math.ceil((t - now) / 86400000)
  return '预计还要约 ' + days + ' 天'
}
