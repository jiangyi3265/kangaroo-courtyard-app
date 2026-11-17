import { ref, watch } from 'vue'
import { experience, getSessionRevision } from './experience.js'
import { get, post, getToken } from './request.js'
import { go } from './screen.js'

export const STAFF_TASK_PAGE = '/pages/staff/platform-tasks'
export const staffTaskTodoCount = ref(0)
let timer = null, unwatch = null, busy = false, active = false, epoch = 0
// 主人 2026-11-03：任务可以发给全体员工、按岗位发，所以小院主理人、线上专员、商家服务人、城市负责人也会收到（合作商家不算员工）
export const STAFF_TASK_ROLES = ['manager', 'keeper', 'online_staff', 'merchant_service', 'city_lead']
export const hasStaffTaskRole = (grants) => (grants || []).some(g => g.active && STAFF_TASK_ROLES.includes(g.roleCode))
// 本城还没有门店的城市授权（只有 cityId）也算：任务挂在「城市（全城）」上，后端接口放行城市授权
const eligible = () => experience.mode === 'staff' && !!experience.account && !experience.account.preview && hasStaffTaskRole(experience.account.staffGrants) && (experience.account.staffGrants || []).some(g => g.active && (g.storeId != null || g.cityId != null) && STAFF_TASK_ROLES.includes(g.roleCode))
// 弹窗按后台最近一步说清楚发生了什么
const NOTICE = { reject: ['任务被驳回', '本次提交被驳回，请查看审核意见，修改后重新提交。'], reply: ['管理员回复了你', '管理员在任务里回复了你，请查看。'], extend: ['任务截止日期已调整', '管理员调整了截止日期，请查看。'], reopen: ['任务退回重新处理', '管理员把任务退回给你重新处理，请查看说明。'], reassign: ['你有新的待办任务', '有一项任务转给你负责，请查看要求。'] }
const scope = () => [getSessionRevision(), experience.account?.id, getToken(), experience.mode].join('|')

export async function checkStaffTaskReminder() {
  if (!eligible()) { staffTaskTodoCount.value = 0; return }
  if (!active || busy) return
  const stamp = scope(), generation = epoch
  const current = () => active && generation === epoch && stamp === scope() && eligible()
  busy = true
  try {
    const r = await get('/app/staff/platform-tasks/reminder')
    if (!current()) return
    staffTaskTodoCount.value = Number(r.data?.todoCount || 0)
    const items = r.data?.unseen || []
    const page = (getCurrentPages().slice(-1)[0] || {}).route || ''
    if (!items.length || page === STAFF_TASK_PAGE.slice(1)) return
    const rejected = items.filter(t => t.status === 'rejected')
    const first = rejected[0] || items[0]
    const [title, text] = NOTICE[rejected.length ? 'reject' : first.lastAction] || ['你有新的待办任务', '管理员派发了新任务，请先点「接收」，完成后填写说明并上传图片。']
    const content = `${first.storeName || ''} · ${first.title}\n${text}\n共 ${staffTaskTodoCount.value} 项待办，可在“管理员任务”中查看。`
    const result = await new Promise(resolve => uni.showModal({ title, content, confirmText: '去查看', cancelText: '稍后处理', success: resolve, fail: () => resolve(null) }))
    if (!result || !current()) return
    await post('/app/staff/platform-tasks/acknowledge', items.map(t => ({ taskId: t.taskId, noticeVersion: t.noticeVersion }))).catch(() => {})
    if (result.confirm && current()) go(STAFF_TASK_PAGE + (items.length === 1 ? '?taskId=' + first.taskId : ''))
  } catch (e) { /* 网络恢复后重试，任务和提醒状态仍以服务端为准。 */ }
  finally { busy = false }
}
export function startStaffTaskReminders() {
  active = true
  if (!timer) timer = setInterval(checkStaffTaskReminder, 30000)
  if (!unwatch) unwatch = watch(() => [scope(), eligible()].join('|'), () => { epoch++; staffTaskTodoCount.value = 0; checkStaffTaskReminder() })
  checkStaffTaskReminder()
}
export function stopStaffTaskReminders() {
  active = false; epoch++; clearInterval(timer); timer = null
  if (unwatch) unwatch(); unwatch = null
}
