// 到店名单导出（2026-11-03 主人：「投递简历多的当地主理人，可以一键选择时间，一键导出，所有投递简历面试的身份证号和姓名，还有手机号去哪家，开始时间，结束时间」）。
// 页面 pages/staff/applicant-export.vue 用；只在 staff 分包里，不进主包；不引用 @/ 下的模块，node --test 直接测（scripts/applicant-export-20261103.test.mjs）。
// 日期按「开始时间」筛（报名人填的到店日期，没填用报名时的可到岗日期），口径在服务端 KgApplicantExportService。

/** 一键选时间：本周、下周按周一到周日 */
export const RANGES = [
  { key: 'thisWeek', label: '本周' },
  { key: 'nextWeek', label: '下周' },
  { key: 'thisMonth', label: '本月' },
  { key: 'nextMonth', label: '下月' },
  { key: 'next30', label: '未来 30 天' },
  { key: 'custom', label: '自定义' }
]

/** 名单范围：进行中的全部报名（已提交到已入职）/ 只要门店已确认录用的 */
export const SCOPES = [
  { key: 'active', label: '全部报名' },
  { key: 'hired', label: '只要已录用' }
]

export const PAGE = '/pages/staff/applicant-export' // 放这里，不进 routes.js（主包不加东西）
export const EXPORT_URL = '/app/staff/applicants/export.xlsx'
export const PREVIEW_URL = '/app/staff/applicants/export/preview'

const pad2 = (n) => (n < 10 ? '0' : '') + n
const parse = (ymd) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(ymd || ''))
  return m ? new Date(Date.UTC(+m[1], +m[2] - 1, +m[3])) : null
}
const fmt = (d) => `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`
const addDays = (d, n) => new Date(d.getTime() + n * 86400000)

/** today 是北京时间的「YYYY-MM-DD」；返回 { from, to }，自定义 / 认不出的 key 返回 null */
export function rangeOf(key, today) {
  const t = parse(today)
  if (!t) return null
  const monday = addDays(t, -((t.getUTCDay() + 6) % 7))
  const monthStart = (offset) => new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth() + offset, 1))
  if (key === 'thisWeek') return { from: fmt(monday), to: fmt(addDays(monday, 6)) }
  if (key === 'nextWeek') return { from: fmt(addDays(monday, 7)), to: fmt(addDays(monday, 13)) }
  if (key === 'thisMonth') return { from: fmt(monthStart(0)), to: fmt(addDays(monthStart(1), -1)) }
  if (key === 'nextMonth') return { from: fmt(monthStart(1)), to: fmt(addDays(monthStart(2), -1)) }
  if (key === 'next30') return { from: fmt(t), to: fmt(addDays(t, 29)) }
  return null
}

/** 「11月3日 – 11月30日」；跨年时带年份 */
export function rangeText(from, to) {
  const a = parse(from), b = parse(to)
  if (!a || !b) return ''
  const md = (d, year) => (year ? d.getUTCFullYear() + '年' : '') + (d.getUTCMonth() + 1) + '月' + d.getUTCDate() + '日'
  const cross = a.getUTCFullYear() !== b.getUTCFullYear()
  return md(a, cross) + ' – ' + md(b, cross)
}

/** 自定义日期是否合法：都要选、结束不早于开始、最多一年（和服务端一致） */
export function rangeError(from, to) {
  const a = parse(from), b = parse(to)
  if (!a || !b) return '请选择开始和结束日期'
  if (b < a) return '结束日期不能早于开始日期'
  if ((b - a) / 86400000 + 1 > 366) return '一次最多导出一年的名单'
  return ''
}

/** 请求参数：只有日期、范围、门店编号，不带任何个人信息 */
export function exportQuery({ from, to, scope, storeId }) {
  const q = { from, to, scope: scope === 'hired' ? 'hired' : 'active' }
  if (storeId) q.storeId = Number(storeId)
  return q
}

export function exportPath(opts) {
  const q = exportQuery(opts)
  return EXPORT_URL + '?' + Object.keys(q).map((k) => k + '=' + encodeURIComponent(q[k])).join('&')
}

export const exportFileName = (from, to) => `到店名单-${from}至${to}.xlsx`
