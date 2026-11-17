// 旅居订房「入住 / 离店」区间日历的点选规则（2026-10-17，主人：「选择住几晚就不要跳了，直接可以选择开始日期和截止日期即可」）。
// 之前点「入住 / 离店」先弹日历选入住日，再弹一个「住几晚」菜单；现在一个日历点两下：先点入住、再点离店。
// 只是纯函数（不碰 vue / uni），node 测试里直接 import；放在 pages/stays 分包里，不占主包。

/** 最多连住几晚：和预订页房态日历（booking.vue「最多连住 30 晚」）、下单接口的上限一致 */
export const MIN_NIGHTS = 7
export const MAX_NIGHTS = 30

const parts = (ymd) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd || '')
  return m ? [+m[1], +m[2], +m[3]] : null
}
const pad = (n) => String(n).padStart(2, '0')
const ymdOf = (d) => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`
const utc = (ymd) => { const p = parts(ymd); return p ? new Date(Date.UTC(p[0], p[1] - 1, p[2])) : null }

/** 两个日期之间隔几晚（离店 - 入住）；不合法返回 0 */
export function nightsOf(start, end) {
  const a = utc(start), b = utc(end)
  return a && b ? Math.round((b - a) / 86400000) : 0
}

/** 'yyyy-MM-dd' 往后挪 n 天 */
export function addDays(ymd, n) {
  const d = utc(ymd)
  if (!d) return ''
  d.setUTCDate(d.getUTCDate() + n)
  return ymdOf(d)
}

/**
 * 点了某一天之后的新选择。sel = { start, end }（end 为空表示还在等离店日）。
 *   · 已经选好一整段（或什么都没选）时，点哪天都是重新开始：这天当入住，等着点离店；
 *   · 选了入住、还没选离店时：点入住当天或更早的日子 = 换个入住日重来；
 *     点更晚的日子当离店，超过 maxNights 晚不收、给一句提示（入住日保留，换个近一点的离店日即可）；
 *   · 比 min 早的日子点不了；入住日最晚到 maxStart（和下单接口「最多提前 180 天预订」一致），离店日最晚到入住 + maxNights。
 * 返回 { start, end, msg }，msg 是要提示给用户的一句话（没有就是空串）。
 */
export function tapRange(sel, ymd, { min = '', maxStart = '', minNights = MIN_NIGHTS, maxNights = MAX_NIGHTS } = {}) {
  const cur = { start: (sel && sel.start) || '', end: (sel && sel.end) || '' }
  if (!parts(ymd) || (min && ymd < min)) return { ...cur, msg: '' }
  if (!cur.start || cur.end || ymd <= cur.start) {
    if (maxStart && ymd > maxStart) return { ...cur, msg: '入住日期最晚可选 ' + mdText(maxStart) }
    return { start: ymd, end: '', msg: '' }
  }
  const n = nightsOf(cur.start, ymd)
  if (n < minNights) return { ...cur, msg: `一周起订，请至少选择 ${minNights} 晚` }
  if (n > maxNights) return { ...cur, msg: `最多连住 ${maxNights} 晚，请选 ${maxNights} 晚以内的离店日期` }
  return { start: cur.start, end: ymd, msg: '' }
}

/** 日历打开时带进来的已选区间：不合法 / 过期 / 超长的不带，免得一打开就是一段点不了的灰日子 */
export function initialRange(start, end, { min = '', maxStart = '', minNights = MIN_NIGHTS, maxNights = MAX_NIGHTS } = {}) {
  if (!parts(start) || (min && start < min) || (maxStart && start > maxStart)) return { start: '', end: '' }
  const n = nightsOf(start, end)
  if (!parts(end) || n < minNights || n > maxNights) return { start, end: '' }
  return { start, end }
}

/** 显式修改入住或离店日期；离店修改不能意外重置入住日。 */
export function editRange(sel, ymd, field, opts = {}) {
  if (field !== 'end') return tapRange({ start: '', end: '' }, ymd, opts)
  const cur = { start: sel?.start || '', end: sel?.end || '' }
  if (!cur.start) return { ...cur, msg: '请先选择入住日期' }
  if (!parts(ymd) || ymd <= cur.start) return { ...cur, msg: '离店日期需晚于入住日期' }
  const next = tapRange({ start: cur.start, end: '' }, ymd, opts)
  return next.msg ? { ...cur, msg: next.msg } : next
}

/** 'yyyy-MM-dd' → '10月17日' */
const mdText = (ymd) => { const p = parts(ymd); return p ? `${p[1]}月${p[2]}日` : '' }

/** 日历最后一天：最晚的入住日再住满 maxNights 晚的离店日 */
export const lastDay = (maxStart, maxNights = MAX_NIGHTS) => (maxStart ? addDays(maxStart, maxNights) : '')

/**
 * 某个月的格子：前面补空格（周一开头），只排到这个月最后一天，不补满 6 行。
 * 每格 { ymd, day, empty, disabled, start, end, inRange, today, tag }，tag 是格子下面的小字：入住 / 离店 / 今天
 */
export function rangeMonth(ym, sel, { min = '', maxStart = '', today = '', maxNights = MAX_NIGHTS } = {}) {
  const p = /^(\d{4})-(\d{2})/.exec(ym || '')
  if (!p) return []
  const first = new Date(Date.UTC(+p[1], +p[2] - 1, 1))
  const lead = (first.getUTCDay() + 6) % 7
  const days = new Date(Date.UTC(+p[1], +p[2], 0)).getUTCDate()
  const start = (sel && sel.start) || '', end = (sel && sel.end) || ''
  // 已选入住、还在等离店：离店最远只能点到入住 + maxNights（更早的日子仍可点，用来换入住日）；
  // 其它时候点的是入住日，最晚到 maxStart
  const waitingEnd = !!start && !end
  const endMax = waitingEnd ? addDays(start, maxNights) : ''
  const cells = []
  for (let i = 0; i < lead; i++) cells.push({ ymd: '', day: '', empty: true, key: `${ym}-e${i}` })
  for (let d = 1; d <= days; d++) {
    const ymd = `${p[1]}-${p[2]}-${pad(d)}`
    const disabled = (!!min && ymd < min) || (waitingEnd ? ymd > endMax : (!!maxStart && ymd > maxStart))
    const isStart = ymd === start
    const isEnd = !!end && ymd === end
    cells.push({
      ymd, day: d, empty: false, key: ymd, disabled, start: isStart, end: isEnd,
      inRange: !!end && ymd > start && ymd < end, today: ymd === today,
      tag: isStart ? '入住' : isEnd ? '离店' : (ymd === today ? '今天' : '')
    })
  }
  return cells
}

/** 从 min 所在月到 max 所在月，每个月一个 'yyyy-MM'（max 为空时排 6 个月） */
export function monthsBetween(min, max) {
  const a = parts(min)
  if (!a) return []
  const b = parts(max)
  const out = []
  let y = a[0], m = a[1]
  for (let i = 0; i < 13; i++) {
    out.push(`${y}-${pad(m)}`)
    if (b ? (y > b[0] || (y === b[0] && m >= b[1])) : i >= 5) break
    m += 1
    if (m > 12) { m = 1; y += 1 }
  }
  return out
}

/** 'yyyy-MM' → '2026年10月' */
export const monthTitle = (ym) => { const p = /^(\d{4})-(\d{2})/.exec(ym || ''); return p ? `${p[1]}年${+p[2]}月` : '' }

/** 日历标题栏右边那句：选好了是「共 N 晚」，只选了入住是「请选择离店日期」，都没选是「请选择入住日期」 */
export function rangeHint(sel) {
  if (sel && sel.start && sel.end) return `共 ${nightsOf(sel.start, sel.end)} 晚`
  return sel && sel.start ? '请选择离店日期' : '请选择入住日期'
}

/** 底部按钮：选好了「确定（共N晚）」，没选好「请选择离店日期」（按钮不可点） */
export function confirmLabel(sel) {
  if (sel && sel.start && sel.end) return `确定（共${nightsOf(sel.start, sel.end)}晚）`
  return sel && sel.start ? '请选择离店日期' : '请选择入住日期'
}
