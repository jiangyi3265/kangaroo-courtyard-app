// Render configured descriptions without making unclaimed vouchers look like missing benefits.
export function benefitLevels(data = {}) {
  const source = Array.isArray(data.levelPerks) && data.levelPerks.length
    ? data.levelPerks : (Array.isArray(data.member?.levels) ? data.member.levels : [])
  return source.map(item => {
    const description = String(item.description || '')
    const items = Array.isArray(item.items) ? item.items
      : description.split(/[\r\n]/.test(description) ? /[\r\n]+/ : /[、；;]+/)
    return { ...item, level: Number(item.level), minPoints: Number(item.minPoints) || 0,
      items: items.map(value => String(value).trim()).filter(Boolean) }
  }).filter(item => Number.isInteger(item.level) && item.level >= 0)
}

export function benefitLevelStatus(level, member) {
  if (!member || member.level == null) return `达到 ${level.minPoints} 积分可享`
  if (Number(member.level) < level.level) return `达到 ${level.minPoints} 积分解锁`
  if (member.memberFrozen) return '权益已冻结，请查看会员通知'
  return Number(member.level) === level.level ? '当前等级' : '已达到该等级'
}
