// 和房源提交接口使用相同的必填项；服务端仍负责最终校验与权限检查。
export function staySubmissionMissing(stay = {}) {
  const missing = []
  if (!String(stay.address || '').trim()) missing.push('房源地址')
  if (!String(stay.cover || '').trim()) missing.push('房源封面')
  if (!(stay.roomTypes || []).some(room => String(room.status) === '0')) missing.push('至少一个可用房型')
  for (const doc of stay.quals || []) {
    if (doc.required && (!doc.uploaded || doc.expired)) missing.push(doc.title + (doc.expired ? '（已过期）' : ''))
  }
  return missing
}

export function roomTypePayload(form) {
  const typeName = String(form.typeName || '').trim()
  if (!typeName || typeName.length > 64) throw new Error('请填写房型名称，最多 64 个字')
  if (!['whole', 'private', 'shared'].includes(form.roomKind)) throw new Error('请选择房型类别')
  const capacity = Number(form.capacity)
  const stock = Number(form.stock)
  const unchangedStock = Boolean(form.roomTypeId) && stock === form.originalStock
  if (!Number.isInteger(capacity) || capacity < 1 || capacity > 20) throw new Error('可住人数请填写 1–20 的整数')
  if (!Number.isInteger(stock) || stock < (unchangedStock ? 0 : 1) || stock > 999) throw new Error('每晚库存请填写 1–999 的整数')
  const price = String(form.price || '').trim()
  if (!/^\d+(\.\d{1,2})?$/.test(price) || Number(price) < 1 || Number(price) > 100000) throw new Error('每晚价格请填写 1–100000 元，最多两位小数')
  const room = { typeName, roomKind: form.roomKind, capacity, basePriceFen: Math.round(Number(price) * 100), status: form.status === '1' ? '1' : '0' }
  if (!unchangedStock) room.stock = stock
  return room
}

// ---------------- 房型 7 天价（2026-11-03 主人：「必须7天，填写7天的价格页面优化一下不要弹窗」，V70） ----------------
// 旧版逐晚价格的兼容工具；新版房型编辑使用下方的7天总价，房态仍保留按日调整。
export const WEEK_DAYS = ['周一', '周二', '周三', '周四', '周五', '周六', '周日']
const yuanText = (fen) => { const n = Number(fen) / 100; return Number.isInteger(n) ? String(n) : n.toFixed(2).replace(/0$/, '') }

// 房型 → 7 个格子里的文字（元）。老房型没有 7 天价：7 天都填基础价，改一个就行
export function weekPricesOf(room = {}) {
  const parts = String(room.weekPriceFen || '').split(',').map(x => Number(x.trim()))
  if (parts.length === 7 && parts.every(n => Number.isInteger(n) && n >= 100)) return parts.map(yuanText)
  const base = Number(room.basePriceFen)
  return WEEK_DAYS.map(() => (Number.isFinite(base) && base > 0 ? yuanText(base) : ''))
}

// 「一键填满」：把第一个填了的价格抄到所有空格子；一个都没填就原样返回
export function fillWeek(prices) {
  const first = prices.map(p => String(p || '').trim()).find(Boolean)
  return first ? prices.map(p => (String(p || '').trim() ? String(p).trim() : first)) : prices.slice()
}

// 7 个格子 → 分；哪一天没填 / 填错就报那一天（页面在那一格下面标红）
export function weekPricePayload(prices) {
  if (!Array.isArray(prices) || prices.length !== 7) throw new Error('请把周一到周日 7 天的价格都填上')
  return prices.map((p, i) => {
    const t = String(p ?? '').trim()
    if (!t) { const e = new Error(WEEK_DAYS[i] + '的价格还没填'); e.day = i; throw e }
    if (!/^\d+(\.\d{1,2})?$/.test(t) || Number(t) < 1 || Number(t) > 100000) { const e = new Error(WEEK_DAYS[i] + '的价格请填 1–100000 元，最多两位小数'); e.day = i; throw e }
    return Math.round(Number(t) * 100)
  })
}

// 房型表单 → 接口参数（新增 / 修改共用）；基础价不再单独填
export function roomTypeWeekPayload(form) {
  const base = roomTypePayload({ ...form, price: '1' })
  delete base.basePriceFen
  return { ...base, weekPriceFen: weekPricePayload(form.prices) }
}

// ---------------- 房态（2026-11-03 主人：简化房态改价，不再连着弹 5 个系统框；房型页第三屏 room-types.vue s=3 用） ----------------
// 一个价格框里的文字 → 分；填错就报一句（和 7 天价同一条规则：1–100000 元，最多两位小数）
export function nightPriceFen(text) {
  const t = String(text ?? '').trim()
  if (!t) throw new Error('请填写每晚价格')
  if (!/^\d+(\.\d{1,2})?$/.test(t) || Number(t) < 1 || Number(t) > 100000) throw new Error('每晚价格请填 1–100000 元，最多两位小数')
  return Math.round(Number(t) * 100)
}

// 'yyyy-MM-dd' → 周几的序号（0 = 周一 … 6 = 周日）；格式不对给 -1
export function weekdayIndex(ymd) {
  const [y, m, d] = String(ymd || '').split('-').map(Number)
  if (!y || !m || !d) return -1
  return (new Date(y, m - 1, d).getDay() + 6) % 7
}

// 'yyyy-MM-dd' → '11-05 周三'（表格里一眼认出星期几）
export function calDayLabel(ymd) {
  const i = weekdayIndex(ymd)
  return i < 0 ? String(ymd || '') : String(ymd).slice(5) + ' ' + WEEK_DAYS[i]
}

// 接口给的一个月（或两个月拼起来）的 days → 表格要的 14 行：去掉已过去的，只留最近 14 天；每行带显示用的价格（元）、剩余间数、日期文字、是不是周末
export function calendarRows(days, count = 14) {
  return (days || []).filter(d => d && !d.past).slice(0, count).map(d => {
    const stock = Number(d.stock) || 0, occupied = Number(d.occupied) || 0
    return { date: d.date, label: calDayLabel(d.date), weekend: weekdayIndex(d.date) >= 5, priceFen: Number(d.priceFen) || 0, price: yuanText(d.priceFen),
      stock, occupied, left: Math.max(0, stock - occupied), closed: !!d.closed }
  })
}

// 'yyyy-MM' 的下一个月（房态表要跨月：这个月 + 下个月拼起来再取 14 天）
export function nextMonth(ym) {
  const [y, m] = String(ym).split('-').map(Number)
  return m >= 12 ? (y + 1) + '-01' : y + '-' + String(m + 1).padStart(2, '0')
}

// 「从…到…」两个日期之间有几晚（含头尾）；填错给 0
export function nightsBetween(from, to) {
  const a = Date.parse(from + 'T00:00:00'), b = Date.parse(to + 'T00:00:00')
  if (!Number.isFinite(a) || !Number.isFinite(b) || b < a) return 0
  return Math.round((b - a) / 86400000) + 1
}

// 7 天总价是门店定价；房态单日覆盖和订单优惠仍由报价接口计算。
export function roomWeekTotalFen(room = {}) {
  const explicit = Number(room.weekTotalFen)
  if (room.weekTotalFen != null && Number.isSafeInteger(explicit) && explicit >= 700 && explicit <= 70000000) return explicit
  const parts = String(room.weekPriceFen || '').split(',').map(x => Number(x.trim()))
  if (parts.length === 7 && parts.every(n => Number.isSafeInteger(n) && n >= 100 && n <= 10000000)) return parts.reduce((sum, n) => sum + n, 0)
  const base = Number(room.basePriceFen)
  return Number.isSafeInteger(base) && base >= 100 && base <= 10000000 ? base * 7 : null
}

export function weekTotalOf(room = {}) {
  const total = roomWeekTotalFen(room)
  return total == null ? '' : yuanText(total)
}

export function weekTotalFen(value) {
  const text = String(value ?? '').trim()
  if (!/^\d+(\.\d{1,2})?$/.test(text)) throw new Error('7天总价请填 7–700000 元，最多两位小数')
  const [whole, decimal = ''] = text.split('.')
  const fen = Number(whole) * 100 + Number(decimal.padEnd(2, '0'))
  if (!Number.isSafeInteger(fen) || fen < 700 || fen > 70000000) throw new Error('7天总价请填 7–700000 元，最多两位小数')
  return fen
}

export const ROOM_PERIOD_PRICES = [
  { key: 'halfMonthTotalFen', input: 'halfMonthTotal', nights: 15, label: '半个月总价（15晚）' },
  { key: 'monthTotalFen', input: 'monthTotal', nights: 30, label: '一个月总价（30晚）' }
]

export function periodTotalOf(value) {
  return value == null ? '' : yuanText(Number(value))
}

export function periodTotalFen(value, nights) {
  const text = String(value ?? '').trim()
  if (!text) return null
  const period = ROOM_PERIOD_PRICES.find(item => item.nights === nights)
  if (!period) throw new Error('不支持的房费周期')
  const invalid = () => Object.assign(new Error(`${period.label}请填 ${nights}–${nights * 100000} 元，最多两位小数；不设置请留空`), { field: period.input })
  if (!/^\d+(\.\d{1,2})?$/.test(text)) throw invalid()
  const [whole, decimal = ''] = text.split('.')
  const fen = Number(whole) * 100 + Number(decimal.padEnd(2, '0'))
  if (!Number.isSafeInteger(fen) || fen < nights * 100 || fen > nights * 10000000) throw invalid()
  return fen
}

export function roomTypeTotalPayload(form) {
  const base = roomTypePayload({ ...form, price: '1' })
  delete base.basePriceFen
  const total = weekTotalFen(form.weekTotal)
  // 改名称、人数等资料时不重写价格，也不摊平原来的周末差价。
  if (!form.roomTypeId || form.originalWeekTotalFen == null || Number(form.originalWeekTotalFen) !== total) base.weekTotalFen = total
  for (const period of ROOM_PERIOD_PRICES) {
    if (!Object.prototype.hasOwnProperty.call(form, period.input)) continue
    const value = periodTotalFen(form[period.input], period.nights)
    const original = form.originalPeriodPrices?.[period.key]
    if (!form.roomTypeId || value !== (original == null ? null : Number(original))) base[period.key] = value
  }
  return base
}

export function weekPriceText(room = {}) {
  const total = weekTotalOf(room)
  return total ? '7天总价 ¥' + total : '还没填价格'
}

// 用户七晚参考价：合作房源仍逐晚加价后取整，与服务端一致，不能直接给周总价加5%。
export function weekTotalPricePreview(value, opType, originalRoom = {}) {
  if (!['direct', 'partner', 'franchise', 'managed'].includes(opType)) return '读取门店运营类型后显示用户价'
  try {
    const total = weekTotalFen(value)
    const original = String(originalRoom.weekPriceFen || '').split(',').map(x => Number(x.trim()))
    const keepOriginal = roomWeekTotalFen(originalRoom) === total && original.length === 7 && original.every(n => Number.isSafeInteger(n) && n >= 100)
    const nights = keepOriginal ? original : Array.from({ length: 7 }, (_, i) => Math.floor(total / 7) + (i < total % 7 ? 1 : 0))
    const direct = opType === 'direct'
    const price = nights.reduce((sum, fen) => sum + fen + (direct ? 0 : Math.floor((fen + 10) / 20)), 0)
    return `用户7晚参考价 ¥${yuanText(price)} · ${direct ? '自营不加价 · 免平台服务费' : '已含逐晚5%加价'}`
  } catch { return '填写7天总价后显示用户价' }
}

// 每晚按分四舍五入，与服务端 KgSettlementMath.sale 一致。
export function settlementPricePreview(value, opType) {
  if (!['direct', 'partner', 'franchise', 'managed'].includes(opType)) return '读取门店运营类型后显示用户价'
  try {
    const base = nightPriceFen(value)
    const direct = opType === 'direct'
    const price = direct ? base : base + Math.floor((base + 10) / 20)
    return `用户价 ¥${yuanText(price)} · ${direct ? '自营不加价 · 免平台服务费' : '已含5%加价'}`
  } catch { return '填写每晚价格后显示用户价' }
}
