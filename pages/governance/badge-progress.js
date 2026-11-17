export function badgeProgressLines(code, progress) {
  if (!progress?.criteria) return []
  const criteria = progress.criteria
  const count = key => Number(criteria[key]) || 0
  const lines = []
  if (code === 'referrer') {
    lines.push(`已推荐注册 ${count('registeredPeople')} 人，完成首次体验 ${count('experiencedPeople')} 人`)
    lines.push(`信用 ${count('creditScore')} 分，要求至少80分`)
    if (criteria.referralFraud) lines.push('存在核实的虚假推荐记录')
    if (criteria.downgradedFromGold) lines.push('已按金牌推荐官季度规则保留推荐官身份')
  }
  if (code === 'referrer_gold') {
    lines.push(`累计完成首次体验 ${count('experiencedPeople')} / 50 人`)
    lines.push(`本季度完成首次体验 ${count('quarterExperiencedPeople')} / 20 人，季度排名${count('quarterRank') ? '第' + count('quarterRank') + '名' : '暂无'}`)
    lines.push(`推荐用户中当前在岗 ${count('activeReferredWorkers')} / 10 人`)
    lines.push(`信用 ${count('creditScore')} 分，要求至少90分`)
    if (criteria.hasViolation) lines.push('存在核实的违规记录或当前限制')
    if (progress.retained) lines.push(`本季暂未达标，已连续 ${Number(progress.failedQuarters) || 0} 个完整季度未达标`)
  }
  if (code === 'juror_gold') {
    const participations = count('participations')
    const adopted = count('adoptedVotes')
    const rate = participations ? Math.floor(adopted * 1000 / participations) / 10 : 0
    lines.push(`有效参与 ${participations} 次，优质评审 ${count('qualityVotes')} 次`)
    lines.push(`个人意见被采纳 ${adopted} 次，采纳率 ${rate}%`)
    if (count('absenceCount')) lines.push(`有 ${count('absenceCount')} 次缺席记录`)
    if (criteria.disqualified || criteria.suspended) lines.push('评审资格受限，请查看平台处理记录')
  }
  if (code === 'traveler') {
    lines.push(`已完成体验 ${count('completedExperiences')} 次，累计旅居 ${count('travelDays')} 天`)
    lines.push(`优质内容 ${count('qualityContents')} / 10 条，其中精华 ${count('featuredContents')} / 3 条`)
    lines.push(`获官方转发或本周热门的内容 ${count('officialFeaturedContents')} / 3 条`)
    lines.push(`信用 ${count('creditScore')} 分，要求至少85分`)
    if (criteria.falseContent) lines.push('存在核实的虚假内容记录')
  }
  if (criteria.accountAvailable === false) lines.push('账号当前受限')
  if (criteria.historicalIntegrityNeedsReview) lines.push('历史会员处理记录待平台补充核定')
  return lines
}

export function badgeProgressStatus(progress) {
  if (progress?.retained) return '本季待达标，徽章当前保留'
  return progress?.eligible ? '已达到获取条件' : '当前进度'
}
