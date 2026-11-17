// 房源详情「小院活动」（2026-11-03 主人：「加一个二销产品的价格，可以发活动限时还可以看到往期活动，在这插入，显示对应的活动，不需要关注他」）
// 数据：GET /app/activities/store/{storeId} → { current 进行中 / 报名中, past 往期 }，按活动的主办门店和房源所属门店对上，游客也能看。
// 这里只把接口的卡片整理成页面要画的样子，纯函数，不碰页面状态。

const DAY = 86400000
const HOUR = 3600000
const MIN = 60000

/** 往期活动独立页面，保持房源所属门店范围。 */
export const stayPastActivitiesUrl = (storeId, stayName = '') => {
  const id = Number(storeId)
  if (!Number.isSafeInteger(id) || id <= 0) return ''
  return '/pages/stays/past-activities?storeId=' + id + (stayName ? '&stayName=' + encodeURIComponent(stayName) : '')
}

/** 报名还剩多久：≥1 天写「剩 N 天」，≥1 小时写「剩 N 小时」，再短写「剩 N 分钟」；已过 / 没有截止返回 '' */
export const leftText = (deadlineAt, now) => {
  const left = Number(deadlineAt) - Number(now)
  if (!(Number(deadlineAt) > 0) || !(left > 0)) return ''
  if (left >= DAY) return '剩' + Math.floor(left / DAY) + '天'
  if (left >= HOUR) return '剩' + Math.floor(left / HOUR) + '小时'
  return '剩' + Math.max(1, Math.floor(left / MIN)) + '分钟'
}

/**
 * 一张活动卡 → 页面行：限时 = 设了报名截止且还没过（角标「限时 · 剩2天」，下面一行「截止 11月5日 18:00」）；
 * 价格：免费写「免费」，收费写「¥xx」，AA制写「AA制 / 约¥80 AA」（服务端 priceText，2026-11-03 费用三选一）；只有真免费的用免费的颜色；
 * 往期（past）一律「已结束」、灰显，照样能点进详情看
 */
export const activityRow = (a, now, past) => {
  // 只有「报名中」的才挂限时角标：暂停报名、手动截止、已开始（进行中）的，截止时间没到也不算限时，照常写状态
  const open = !(a && a.phase) || a.phase === 'open'
  const left = past || !open ? '' : leftText(a && a.deadlineAt, now)
  const fee = Number(a && a.feeFen) || 0
  return {
    activityId: Number(a && a.activityId) || 0,
    title: (a && a.title) || '活动',
    cover: (a && a.img) || '',
    price: (a && a.priceText) || (fee > 0 ? '¥' + fee / 100 : '免费'),
    free: fee === 0 && !(a && a.feeKind === 'aa'),
    when: [a && a.dateText, a && a.time].filter(Boolean).join(' '),
    limited: !!left,
    left,
    deadline: left && a.deadlineText ? '截止 ' + a.deadlineText : '',
    // 报名中的不另外写状态（有「限时」角标）；暂停、报名截止、进行中、往期写出来
    status: past ? '已结束' : (a && a.phase && a.phase !== 'open' ? (a.phaseLabel || '') : ''),
    past: !!past
  }
}

/** 接口数据 → { current, past }；接口没给或格式不对时都是空数组（整块不出现） */
export const storeActivities = (data, now) => ({
  current: (Array.isArray(data && data.current) ? data.current : []).map(a => activityRow(a, now, false)).filter(r => r.activityId),
  past: (Array.isArray(data && data.past) ? data.past : []).map(a => activityRow(a, now, true)).filter(r => r.activityId)
})
