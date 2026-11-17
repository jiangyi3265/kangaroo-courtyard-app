const REASONS = {
  recent: '该岗位24小时内已通知', pastApplication: '曾向本店报名',
  preferenceOff: '已关闭新机会提醒', quietHours: '处于免打扰时段',
  dailyDigest: '选择了每日汇总', notWritten: '未生成站内通知'
}
export function urgentResult(data = {}) {
  const staff = Number(data.staffNotified) || 0, users = Number(data.usersNotified) || 0
  const reasons = Object.entries(REASONS).filter(([key]) => Number(data.skipReasons?.[key]) > 0)
    .map(([key, text]) => `${text} ${Number(data.skipReasons[key])} 人`)
  if (!reasons.length && data.throttled) reasons.push('该岗位24小时内已通知用户，本次仅更新标记')
  if (Number(data.staffSkipped) > 0) reasons.push(`员工通知未写入 ${Number(data.staffSkipped)} 人`)
  return {
    title: '紧急标记已更新',
    summary: `站内通知已发送：用户 ${users} 人，员工 ${staff} 人`, reasons
  }
}
