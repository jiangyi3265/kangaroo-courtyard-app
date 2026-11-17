const LABELS = ['', '一般招募', '较急招募', '紧急招募', '特急招募']

export function urgencyDeadline(value) {
  if (value == null || value === '') return null
  if (typeof value === 'number') return Number.isFinite(value) ? value : NaN
  const text = String(value).trim()
  // API wall-clock timestamps are Beijing time, independent of the phone timezone.
  const local = /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}(?::\d{2})?$/.test(text)
  return Date.parse(local ? text.replace(' ', 'T') + (text.length === 16 ? ':00' : '') + '+08:00' : text)
}

export function jobUrgency(job, now = Date.now()) {
  if (!job || (job.status && job.status !== 'published')) return null
  const level = Number(job.urgentLevel)
  if (!Number.isInteger(level) || level < 1 || level > 4) return null
  const deadline = urgencyDeadline(job.urgentDeadline)
  if (deadline !== null && (!Number.isFinite(deadline) || deadline <= now)) return null
  return {
    level, label: LABELS[level], deadline,
    deadlineText: deadline === null ? '' : new Date(deadline + 8 * 3600000).toISOString().slice(0, 16).replace('T', ' ')
  }
}
