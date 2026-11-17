// 发活动的两张表（员工端「创建活动」、用户「创办活动」）共用的几行，2026-11-03 主人：
//   · 费用三选一（「价格，免费，aa制」）：免费 / 收费 / AA制（现场由参加的人平摊，平台不收钱，可填预估人均）；
//   · 「选择时间，同时选择」：一个滚轮同时选 日期 | 时 | 分（uni 的 picker mode="multiSelector"），不用再分两下点。
// 纯函数，不碰页面状态。小程序主包剩的地方不多，这里只放两页都要用的。
const p2 = (n) => (n < 10 ? '0' : '') + n
const WEEK = '日一二三四五六'
const msOf = (date, time) => {
  const d = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date || ''), t = /^(\d{2}):(\d{2})$/.exec(time || '00:00')
  return d && t ? Date.UTC(+d[1], +d[2] - 1, +d[3], +t[1], +t[2]) : NaN
}
const whenOf = (ms) => {
  const t = new Date(ms)
  return { date: `${t.getUTCFullYear()}-${p2(t.getUTCMonth() + 1)}-${p2(t.getUTCDate())}`, time: `${p2(t.getUTCHours())}:${p2(t.getUTCMinutes())}` }
}

// ---------------- 时间：日期 | 时 | 分 ----------------
const MINUTES = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55]
/** 「11月4日 周三」，不是今年的带上年份（2027年1月4日 周一） */
export const dayText = (date, thisYear) => {
  const ms = msOf(date)
  if (Number.isNaN(ms)) return String(date || '')
  const t = new Date(ms)
  return `${t.getUTCFullYear() === Number(thisYear) ? '' : t.getUTCFullYear() + '年'}${t.getUTCMonth() + 1}月${t.getUTCDate()}日 周${WEEK[t.getUTCDay()]}`
}
/** 滚轮三列：从 from 那天起 days 天、0–23 时、每 5 分钟；dates 是每一行对应的 yyyy-MM-dd */
export const whenColumns = (from, days) => {
  const start = msOf(from)
  const dates = []
  for (let i = 0; i < days && !Number.isNaN(start); i++) dates.push(whenOf(start + i * 86400000).date)
  const year = String(from).slice(0, 4)
  return { dates, cols: [dates.map(d => dayText(d, year)), Array.from({ length: 24 }, (_, h) => p2(h) + '时'), MINUTES.map(m => p2(m) + '分')] }
}
/** 当前值在滚轮上停在哪一行（不在范围里的停第一行；分钟不是 5 的倍数的往下取） */
export const whenIndex = (w, dates) => {
  const t = /^(\d{2}):(\d{2})$/.exec((w && w.time) || '') || [0, 0, 0]
  return [Math.max(0, dates.indexOf(w && w.date)), Math.min(23, +t[1]), Math.min(11, Math.floor(+t[2] / 5))]
}
/** 滚轮选中的三行 → { date, time } */
export const whenPicked = (idx, dates) => {
  const [d, h, m] = (Array.isArray(idx) ? idx : []).map(Number)
  const date = dates[d] || dates[0] || ''
  return { date, time: p2(Math.min(23, Math.max(0, h || 0))) + ':' + p2(MINUTES[m] || 0) }
}
/** 往后推几个小时（跨天自动进位），结束时间默认 = 开始 + 3 小时 */
export const addHours = (w, hours) => {
  const ms = msOf(w && w.date, w && w.time)
  return Number.isNaN(ms) ? { date: (w && w.date) || '', time: (w && w.time) || '' } : whenOf(ms + hours * 3600000)
}
export const whenKey = (w) => `${(w && w.date) || ''} ${(w && w.time) || ''}`

// ---------------- 费用：免费 / 收费 / AA制 ----------------
const MONEY = /^\d{1,6}(\.\d{1,2})?$/
/** 按选的费用方式检查金额：收费必须大于 0；AA 的预估人均可以不填，填了要是金额。没问题返回 '' */
export const feeError = (kind, fee, aa) => {
  if (kind === 'paid') {
    const v = String(fee == null ? '' : fee).trim()
    if (!v) return '请填写每人费用'
    if (!MONEY.test(v) || !(Number(v) > 0)) return '每人费用要大于 0（最多两位小数）'
  }
  if (kind === 'aa') {
    const v = String(aa == null ? '' : aa).trim()
    if (v && !MONEY.test(v)) return '预估人均请填金额（最多两位小数），不确定可以不填'
  }
  return ''
}
/** 提交给服务端的费用字段：feeKind + feeYuan（只有收费才是填的金额）+ AA 的预估人均和说明 */
export const feeBody = (kind, fee, aa, note) => {
  const body = { feeKind: kind, feeYuan: kind === 'paid' ? String(fee).trim() : '0' }
  if (kind === 'aa') Object.assign(body, { aaYuan: String(aa == null ? '' : aa).trim(), feeIncludes: String(note || '').trim().slice(0, 40) })
  return body
}
/** 已有活动 → 表单里选哪一项（服务端给的 feeKind；老接口没有时按金额算） */
export const feeKindOf = (a) => (a && ['free', 'paid', 'aa'].includes(a.feeKind) ? a.feeKind : (Number(a && a.feeFen) > 0 ? 'paid' : 'free'))
// 免责说明（2026-11-03 主人拍板「加免责说明」）：用户发起的收费活动是到场付给发起人，平台不经手；AA 一样不经手。
// 发起表单（收费金额下面）、活动详情（价格下面）、报名确认框都用这两句
export const OFFLINE_NOTE = '费用由发起人现场收取，平台不代收、不担保；如有纠纷请与发起人协商，也可联系客服协助'
export const AA_NOTE = 'AA 费用现场由参加的人平摊，平台不经手'
/** 详情页、报名确认框要不要带免责说明：AA 都带；收费的只有用户发起、到场付的带 */
export const feeNoteOf = (d) => (!d ? '' : d.feeKind === 'aa' ? AA_NOTE
  : (d.source === 'user' && Number(d.feeFen) > 0 && d.feeMode !== 'online' ? OFFLINE_NOTE : ''))
/** 分 → 表单里的元（空 / 0 → ''） */
export const yuanText = (fen) => (Number(fen) > 0 ? String(Number(fen) / 100) : '')
