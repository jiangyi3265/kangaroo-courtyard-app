// 同行页沿用真实报名和主动公开的队伍数据，不把报名人数当作可见伙伴人数。
export const positiveId = value => Number.isSafeInteger(Number(value)) && Number(value) > 0 ? Number(value) : 0

export function companionMembers(team, me) {
  const seen = new Set()
  return (Array.isArray(team?.members) ? team.members : []).filter(member => {
    const id = positiveId(member?.userId)
    if (!id || seen.has(id)) return false
    seen.add(id)
    return true
  }).map(member => ({
    userId: positiveId(member.userId), name: String(member.name || '').trim() || '同行伙伴',
    avatar: String(member.avatar || ''), meta: String(member.meta || '').trim() || '行程信息待补充',
    isMe: member.isMe === true || (!!positiveId(me) && positiveId(member.userId) === positiveId(me))
  })).sort((a, b) => Number(b.isMe) - Number(a.isMe))
}

export function applicationBlockReason(team = {}, detail = {}) {
  const status = team.job?.status || detail.status
  if (status === 'paused') return '岗位已暂停招聘，仍可查看同行伙伴'
  if (status === 'closed') return '岗位已结束招聘，暂不能报名'
  if (detail.acceptsApplication === false) return detail.applyClosedReason || '岗位暂不接受报名'
  if (team.remaining != null && String(team.remaining).trim() !== '' && Number(team.remaining) === 0) return '岗位名额已满，仍可查看同行伙伴'
  return ''
}
