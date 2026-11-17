// 页面交互小工具：输入一律走系统弹窗 / 操作菜单，不往设计稿里加任何表单元素。
import { pickFromList, pickTime, pickYmd, pickMonthDay, PICKER_UNAVAILABLE } from './picker.js'

export const errText = (e, dft) => (e && e.message) || dft

export const modal = (title, content, extra = {}) => new Promise((resolve) => {
  uni.showModal({
    title,
    content: content || '',
    ...extra,
    success: (r) => resolve(r),
    fail: () => resolve({ confirm: false })
  })
})

/** 确认框：点"确定"返回 true */
export const confirm = async (title, content) => (await modal(title, content)).confirm === true

/** 提示框：只有一个"知道了" */
export const alert = (title, content) => modal(title, content, { showCancel: false, confirmText: '知道了' })

/** 单行输入：取消返回 null，确定返回去掉首尾空格的文本 */
export const prompt = async (title, { value = '', placeholder = '' } = {}) => {
  const r = await modal(title, value, { editable: true, placeholderText: placeholder })
  return r.confirm ? String(r.content || '').trim() : null
}

// itemColor 必须显式传：uni-h5 只在 itemColor 等于默认值 "#000" 时才去读主题配色，
// 而它拿到的主题值不一定是 light/dark，读不到就抛 TypeError（菜单还能用，但控制台每次都报错）。
// 传一个我们自己的墨色既避开这条分支，也让 H5 与小程序的菜单文字颜色一致。
const SHEET_COLOR = '#3A322B' // = --k-ink

const sheetOnce = (itemList) => new Promise((resolve) => {
  uni.showActionSheet({
    itemList,
    itemColor: SHEET_COLOR,
    success: (r) => resolve(r.tapIndex),
    fail: () => resolve(-1)
  })
})

/**
 * 操作菜单：返回下标，取消返回 -1。
 * 系统菜单最多 6 项：小程序传入更多会直接失败、H5 会静默截断（社区城市菜单选不到后几个城市）。
 * 超过 6 项改为分页（每页 5 项 + 「下一页…」），见 pickPaged。
 */
export const sheet = (itemList) => (itemList.length > 6 ? pickPaged(itemList) : sheetOnce(itemList))

export const copy = (data, tip = '已复制') => new Promise((resolve) => {
  uni.setClipboardData({
    data: String(data == null ? '' : data),
    success: () => { uni.showToast({ title: tip, icon: 'none' }); resolve(true) },
    fail: () => resolve(false)
  })
})

export const pad2 = (n) => (n < 10 ? '0' + n : '' + n)

export const isYmd = (v) => /^\d{4}-\d{2}-\d{2}$/.test(v || '')

/** 'yyyy-MM-dd' 加减天数：按日历日算，不受本机时区影响 */
export const shiftDate = (ymd, n) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd || '')
  if (!m) return ''
  const t = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]) + n * 86400000)
  return `${t.getUTCFullYear()}-${pad2(t.getUTCMonth() + 1)}-${pad2(t.getUTCDate())}`
}

/** 北京时间的今天 'yyyy-MM-dd'（业务日期一律按北京时间，和服务端一致） */
export const todayCn = () => {
  const t = new Date(Date.now() + 8 * 3600000)
  return `${t.getUTCFullYear()}-${pad2(t.getUTCMonth() + 1)}-${pad2(t.getUTCDate())}`
}

/** 服务端时间串 'yyyy-MM-dd HH:mm:ss'（北京时间，不带时区）→ 毫秒时间戳；不认识返回 0 */
export const serverTs = (v) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?/.exec(String(v || ''))
  return m ? Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4] - 8, +m[5], +(m[6] || 0)) : 0
}

/** 'yyyy-MM-dd HH:mm:ss' → 'MM-dd HH:mm' */
export const mdhm = (v) => {
  const m = /^\d{4}-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})/.exec(String(v || ''))
  return m ? `${m[1]}-${m[2]} ${m[3]}:${m[4]}` : ''
}

/**
 * 选项多于 6 个时打开一屏列表的选择页（可搜索，见 common/picker.js）；返回原列表下标，取消返回 -1。
 * 之前是「每页 5 项 + 下一页…」一页页翻；选择页打不开（页面栈满）时仍退回分页菜单
 */
export async function pickPaged(labels, title = '请选择') {
  if (labels.length <= 6) return sheetOnce(labels)
  const picked = await pickFromList(labels, { title })
  if (picked !== PICKER_UNAVAILABLE) return picked
  let offset = 0
  for (;;) {
    const items = labels.slice(offset, offset + 5).concat(['下一页…'])
    const i = await sheetOnce(items)
    if (i < 0) return -1
    if (i < items.length - 1) return offset + i
    offset = offset + 5 >= labels.length ? 0 : offset + 5
  }
}

/** 分 → 元的显示串：9800 → '98'，9850 → '98.5'（整数运算，不用浮点乘除） */
export const yuan = (fen) => {
  const n = Math.round(Number(fen) || 0)
  const sign = n < 0 ? '-' : ''
  const a = Math.abs(n)
  const y = Math.floor(a / 100)
  const f = a % 100
  if (!f) return sign + y
  return sign + y + '.' + (f % 10 ? (f < 10 ? '0' + f : '' + f) : '' + f / 10)
}

/** 千分位 + 固定 d 位小数：(1234.5, 2) → '1,234.50'。不用 toLocaleString：安卓微信的 JS 引擎可能没带完整 ICU，会丢逗号和小数位 */
export const fmtNum = (n, d = 0) => {
  const [i, f] = (Number(n) || 0).toFixed(d).split('.')
  return i.replace(/\B(?=(\d{3})+$)/g, ',') + (f ? '.' + f : '')
}

/** 选时刻（滚轮）：返回 'HH:mm'，取消返回 null；选择页打不开时退回手动输入 */
export async function askTime(title, value = '', step = 5) {
  const v = await pickTime({ title, value, step })
  if (v !== PICKER_UNAVAILABLE) return v
  const t = await prompt(title, { value, placeholder: 'HH:mm，例如 14:30' })
  return t && /^([01]\d|2[0-3]):[0-5]\d$/.test(t) ? t : null
}

/** 选日期（年月日滚轮，可快速跨年）：返回 'yyyy-MM-dd'，emptyText 有值时可返回 ''，取消返回 null */
export async function askYmd(title, { value = '', min = '', max = '', emptyText = '' } = {}) {
  const v = await pickYmd({ title, value, min, max, emptyText })
  if (v !== PICKER_UNAVAILABLE) return v
  const t = await prompt(title, { value, placeholder: 'yyyy-MM-dd' + (emptyText ? '，不填表示' + emptyText : '') })
  if (t === null) return null
  if (!t) return emptyText ? '' : null
  return isYmd(t) ? t : null
}

/** 选月日（生日）：返回 'MM-dd'，emptyText 有值时可返回 ''，取消返回 null */
export async function askMonthDay(title, { value = '', emptyText = '' } = {}) {
  const v = await pickMonthDay({ title, value, emptyText })
  if (v !== PICKER_UNAVAILABLE) return v
  const t = await prompt(title, { value, placeholder: 'MM-dd，例如 08-29' })
  if (t === null) return null
  if (!t) return emptyText ? '' : null
  return /^(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/.test(t) ? t : null
}

export const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
