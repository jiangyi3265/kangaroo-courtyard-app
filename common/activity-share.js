// Explicit public fields only: never include a signup number, attendee or phone.
export function activitySharePayload(activity = {}, base = '') {
  const id = Number(activity.activityId)
  const activityId = Number.isSafeInteger(id) && id > 0 ? id : null
  const path = '/pages/community/activity' + (activityId ? '?id=' + activityId + '&channel=share' : '')
  return {
    activityId,
    title: String(activity.title || '袋鼠全球青年 · 同城活动'),
    path,
    url: String(base).replace(/\/+$/, '') + '/#' + path,
    imageUrl: String(activity.img || ''),
    summary: [activity.timeText, activity.place].filter(Boolean).join(' · ')
  }
}
