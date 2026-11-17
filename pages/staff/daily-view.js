// 员工端「每日概况」页（pages/staff/daily.vue，2026-10-17）的取数与显示规则。
// 主人：「我手机的员工端能不能实现每天更新每个城市和小院的报名情况入住情况」。
// 接口 GET /app/staff/daily?date=&city= 每次现查订单和报名（口径见后端 KgStaffDailyService），这里只管怎么摆。
// 纯函数，不碰 vue / uni，node 测试直接 import；放在 staff 分包里，不占主包。

export const DAILY_PAGE = '/pages/staff/volunteers'
export const DAILY_API = '/app/staff/daily'
/** 和后端一致：往前最多一年、往后最多 180 天 */
export const PAST_DAYS = 366
export const AHEAD_DAYS = 180

const WEEK = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
const parts = (ymd) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd || '')
  return m ? [+m[1], +m[2], +m[3]] : null
}
const pad = (n) => String(n).padStart(2, '0')

export function shiftDay(ymd, n) {
  const p = parts(ymd)
  if (!p) return ''
  const d = new Date(Date.UTC(p[0], p[1] - 1, p[2] + n))
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`
}

const between = (a, b) => {
  const x = parts(a), y = parts(b)
  return x && y ? Math.round((Date.UTC(y[0], y[1] - 1, y[2]) - Date.UTC(x[0], x[1] - 1, x[2])) / 86400000) : 0
}

/** '2026-10-17' → '10月17日 周六' */
export function dayLabel(ymd) {
  const p = parts(ymd)
  return p ? `${p[1]}月${p[2]}日 ${WEEK[new Date(Date.UTC(p[0], p[1] - 1, p[2])).getUTCDay()]}` : ''
}

/** 日期切换条：中间写「今天 / 昨天 / 明天」或日期，两边箭头到了范围边上就不能点 */
export function dayNav(date, today) {
  const n = between(today, date)
  const word = n === 0 ? '今天' : n === -1 ? '昨天' : n === 1 ? '明天' : ''
  return {
    word,
    label: dayLabel(date),
    title: word ? `${word} · ${dayLabel(date)}` : dayLabel(date),
    isToday: n === 0,
    canPrev: n > -PAST_DAYS,
    canNext: n < AHEAD_DAYS,
    min: shiftDay(today, -PAST_DAYS),
    max: shiftDay(today, AHEAD_DAYS)
  }
}

const num = (v) => Number(v) || 0
/** 入住率文字：后端算好的 occupancyText；没有库存时「—」 */
const occ = (x) => (x && x.occupancyText) || '—'

/**
 * 顶部合计卡：两行四格。第一行入住（在住 / 入住率 / 今日入住 / 今日离店），第二行订单与报名（新订单 / 待审退款 / 新报名 / 待处理报名）。
 * 看的不是今天时，「今日」改成「当天」；待审退款、待处理报名永远是此刻的数（后端口径），标「当前」。
 */
export function summaryTiles(total, isToday = true) {
  const t = total || {}
  const day = isToday ? '今日' : '当天'
  return [
    { key: 'inHouse', label: '在住', value: num(t.inHouse), sub: `${num(t.guests)}人` },
    { key: 'occ', label: '入住率', value: occ(t), sub: num(t.stock) ? `${num(t.units)}/${num(t.stock)}` : '没有库存' },
    { key: 'arrivals', label: day + '入住', value: num(t.arrivals), sub: `已到店 ${num(t.arrived)}` },
    { key: 'departures', label: day + '离店', value: num(t.departures), sub: `已退房 ${num(t.departed)}` },
    { key: 'newOrders', label: '新订单', value: num(t.newOrders), sub: day + '支付' },
    { key: 'refundPending', label: '待审退款', value: num(t.refundPending), sub: '当前', warn: num(t.refundPending) > 0 },
    { key: 'newApps', label: '新报名', value: num(t.newApps), sub: day + '提交' },
    { key: 'pending', label: '待处理报名', value: num(t.pending), sub: `待审核 ${num(t.toReview)}`, warn: num(t.pending) > 0 }
  ]
}

/** 小院卡下面的一行数：入住 / 在住 / 离店 / 入住率（带「间数/库存」） */
export function stayStats(s) {
  const x = s || {}
  return [
    { label: '入住', value: num(x.arrivals), sub: num(x.arrivals) ? `已到 ${num(x.arrived)}` : '' },
    { label: '在住', value: num(x.inHouse), sub: num(x.inHouse) ? `${num(x.guests)}人` : '' },
    { label: '离店', value: num(x.departures), sub: num(x.departures) ? `已退 ${num(x.departed)}` : '' },
    { label: '入住率', value: occ(x), sub: num(x.stock) ? `${num(x.units)}/${num(x.stock)}` : '' }
  ]
}

/** 小院卡右上角的小字：新订单、待审退款（有才写） */
export function stayFlags(s) {
  const out = []
  if (num(s && s.newOrders)) out.push({ text: `新订单 ${num(s.newOrders)}`, tone: 'green' })
  if (num(s && s.refundPending)) out.push({ text: `待审退款 ${num(s.refundPending)}`, tone: 'alert' })
  if (s && s.online === false) out.push({ text: '未上线', tone: 'muted' })
  return out
}

/** 门店报名一行：新报名 / 待处理（待审核）/ 录用 / 到岗（已入职） */
export function appStats(a) {
  const x = a || {}
  return [
    { label: '新报名', value: num(x.newApps), sub: '' },
    { label: '待处理', value: num(x.pending), sub: num(x.toReview) ? `待审核 ${num(x.toReview)}` : '', warn: num(x.pending) > 0 },
    { label: '录用', value: num(x.hired), sub: '' },
    { label: '到岗', value: num(x.arriving), sub: num(x.onboarded) ? `已入职 ${num(x.onboarded)}` : '' }
  ]
}

/** 城市标题右边那句：「在住 3 · 入住率 25% · 新报名 2」 */
export function citySumLine(sum) {
  const x = sum || {}
  return [`在住 ${num(x.inHouse)}`, `入住率 ${occ(x)}`, `新报名 ${num(x.newApps)}`].join(' · ')
}

/** 线上任务的报名单独一组（10-19 复查，和后端 KgStaffDailyService.ONLINE_GROUP 一致；之前这一组叫「不限」，像个城市名） */
export const ONLINE_GROUP = '线上任务'

/** 没有小院、只有报名的一组（线上任务、没上线小院的城市）：小计只写报名，不写「在住 0 · 入住率 —」 */
export function appSumLine(sum) {
  const x = sum || {}
  return [`新报名 ${num(x.newApps)}`, `待处理 ${num(x.pending)}`].join(' · ')
}

/** 组名右边的小字：「2 家小院」；线上任务「不分城市」；城市里没有小院「没有小院」 */
export const cityCountText = (city, stayCount) => (stayCount ? `${stayCount} 家小院` : (city === ONLINE_GROUP ? '不分城市' : '没有小院'))

/**
 * 点小院去哪：看今天时进订单台对应分组（有到店的先看今日到店，其次今日离店，否则在住）；
 * 看别的日子时订单台的分组都是按今天算的，改进房态图、从那天开始看。都带 stayId 和门店（routes 由页面传入）
 */
export function stayLink(s, date, isToday, routes) {
  const base = routes.staffStayOrders + '?stayId=' + encodeURIComponent(s.stayId)
  if (!isToday) return base + '&s=4&start=' + date
  const tab = num(s.arrivals) ? 'arrivals' : num(s.departures) ? 'departures' : 'inhouse'
  return base + '&tab=' + tab
}

/** 点门店报名去哪：当天有新报名看当天提交的；否则有待审核看待审核；都没有看全部 */
export function appLink(a, date, routes) {
  if (num(a.newApps)) return routes.staffApplications + '?submitDate=' + date
  if (num(a.toReview)) return routes.staffApplications + '?status=submitted'
  return routes.staffApplications
}

/** 接口数据 → 页面用的城市列表 */
export function cityBlocks(data, routes) {
  const d = data || {}
  return (d.cities || []).map(c => ({
    city: c.city,
    stayCount: (c.stays || []).length,
    countText: cityCountText(c.city, (c.stays || []).length),
    sumLine: (c.stays || []).length ? citySumLine(c.sum) : appSumLine(c.sum),
    stays: (c.stays || []).map(s => ({
      ...s, stats: stayStats(s), flags: stayFlags(s), link: stayLink(s, d.date, !!d.isToday, routes)
    })),
    apps: (c.apps || []).map(a => ({ ...a, stats: appStats(a), link: appLink(a, d.date, routes) }))
  }))
}

/** 城市筛选：只有一个城市时不显示；第一项「全部城市」 */
export function cityChips(options, current) {
  const list = (options || []).filter(Boolean)
  if (list.length < 2 && !current) return []
  return [{ value: '', label: '全部城市', on: !current }].concat(list.map(c => ({ value: c, label: c, on: c === current })))
}

/** 顶部合计卡标题：「全部 · 3 个城市 · 5 家小院」；选了城市时「平潭 · 2 家小院」 */
export function totalTitle(total, city) {
  const t = total || {}
  return city ? `${city} · ${num(t.stays)} 家小院` : `全部 · ${num(t.cities)} 个城市 · ${num(t.stays)} 家小院`
}
