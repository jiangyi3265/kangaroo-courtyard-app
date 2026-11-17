import { cnMinute, restoreSchedule, scheduleTime } from './buddy-schedule.js'

const minute = value => String(value || '').replace('T', ' ').slice(0, 16)
export function activitySchedule(activity, defaultDate) {
  const start = minute(activity?.startTime), end = minute(activity?.endTime), deadline = minute(activity?.deadline)
  const result = restoreSchedule({ date: start.slice(0, 10), time: start.slice(11), endDate: end.slice(0, 10), endTime: end.slice(11), deadlineDate: deadline.slice(0, 10), deadlineTime: deadline.slice(11) }, defaultDate)
  if (start && !deadline) { result.deadlineDate = ''; result.deadlineTime = '' }
  return result
}

// Existing deadlines may already have passed. Keeping one must not reopen registration.
export function checkActivitySchedule(form, original = {}, now = Date.now()) {
  const start = scheduleTime(form.date, form.time), end = scheduleTime(form.endDate, form.endTime)
  const noDeadline = !form.deadlineDate && !form.deadlineTime && original.startTime && !original.deadline
  const deadline = noDeadline ? null : scheduleTime(form.deadlineDate, form.deadlineTime)
  if (![start, end].every(Number.isFinite) || (!noDeadline && !Number.isFinite(deadline))) return { error: '请填写有效日期和时间，时间格式为 09:30' }
  const keptStart = cnMinute(start) === minute(original.startTime)
  const keptDeadline = noDeadline || cnMinute(deadline) === minute(original.deadline)
  if (start <= now || (!keptStart && start < now + 3600000)) return { error: '新的集合时间至少在当前时间 1 小时后' }
  if (end <= start) return { error: '结束时间须晚于集合时间，跨天活动请选择结束日期' }
  if (!noDeadline && deadline > start) return { error: '报名截止时间不能晚于集合时间' }
  if (!noDeadline && !keptDeadline && deadline <= now) return { error: '新的报名截止时间须晚于当前时间' }
  return {
    startTime: keptStart ? original.startTime : cnMinute(start),
    endTime: cnMinute(end) === minute(original.endTime) ? original.endTime : cnMinute(end),
    deadline: keptDeadline ? (original.deadline || '') : cnMinute(deadline)
  }
}
