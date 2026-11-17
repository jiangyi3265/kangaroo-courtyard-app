import { normalizeClock } from '../../common/manual-time.js'

const HOUR = 3600000
export function cnMinute(at) {
  return new Date(at + 8 * HOUR).toISOString().slice(0, 16).replace('T', ' ')
}
export function scheduleTime(date, clock) {
  const time = normalizeClock(clock)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date || '') || !time) return NaN
  const at = Date.parse(`${date}T${time}:00+08:00`)
  return Number.isFinite(at) && cnMinute(at) === `${date} ${time}` ? at : NaN
}
export function restoreSchedule(saved, defaultDate) {
  const a = saved && typeof saved === 'object' ? saved : {}
  const date = Number.isFinite(scheduleTime(a.date, '00:00')) ? a.date : defaultDate
  const time = normalizeClock(a.time) || '08:00'
  const start = scheduleTime(date, time)
  const hours = Number(a.hours)
  const end = cnMinute(start + (hours > 0 && hours <= 72 ? hours : 4) * HOUR)
  const deadline = a.deadline === 'h2' || a.deadline === 'h12'
    ? cnMinute(start - (a.deadline === 'h2' ? 2 : 12) * HOUR)
    : cnMinute(scheduleTime(date, '20:00') - 24 * HOUR)
  const validEnd = Number.isFinite(scheduleTime(a.endDate, a.endTime))
  const validDeadline = Number.isFinite(scheduleTime(a.deadlineDate, a.deadlineTime))
  return {
    date, time, place: typeof a.place === 'string' ? a.place.slice(0, 60) : '',
    endDate: validEnd ? a.endDate : end.slice(0, 10), endTime: validEnd ? normalizeClock(a.endTime) : end.slice(11),
    deadlineDate: validDeadline ? a.deadlineDate : deadline.slice(0, 10), deadlineTime: validDeadline ? normalizeClock(a.deadlineTime) : deadline.slice(11)
  }
}
export function checkSchedule(a, now = Date.now()) {
  const start = scheduleTime(a.date, a.time), end = scheduleTime(a.endDate, a.endTime), deadline = scheduleTime(a.deadlineDate, a.deadlineTime)
  if (![start, end, deadline].every(Number.isFinite)) return { error: '请填写有效日期和时间，时间格式为 09:30' }
  if (start < now + HOUR) return { error: '集合时间至少在当前时间 1 小时后，今天也可以选择' }
  if (end <= start) return { error: '结束时间须晚于集合时间，跨天活动请选择结束日期' }
  if (deadline <= now) return { error: '报名截止时间已经过了，请重新设置' }
  if (deadline > start) return { error: '报名截止时间不能晚于集合时间' }
  return { startTime: cnMinute(start), endTime: cnMinute(end), deadline: cnMinute(deadline), hours: (end - start) / HOUR }
}
