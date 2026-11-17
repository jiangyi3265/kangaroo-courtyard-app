// 旅居搜索条件（城市、入住 / 离店、人数）：存本机，只是下次打开时的便利默认值，不参与任何权限或价格判断。
import { reactive } from 'vue'
import { todayCn, shiftDate } from '@/common/ui.js'
import { MIN_NIGHTS } from './stays-range.js'

const KEY = 'kangaroo:stays-state'
const saved = (() => {
  try { return uni.getStorageSync(KEY) || {} } catch (e) { return {} }
})()

export const stayState = reactive({
  city: saved.city || '',
  checkIn: saved.checkIn || '',
  checkOut: saved.checkOut || '',
  guests: saved.guests || 1
})

/** 新预订至少 7 晚，过期日期及旧的短住选择自动调整为一周。 */
export function normalizeDates() {
  const t = todayCn()
  if (!stayState.checkIn || stayState.checkIn < t) {
    stayState.checkIn = t
    stayState.checkOut = shiftDate(t, MIN_NIGHTS)
  }
  if (!stayState.checkOut || nightsBetween(stayState.checkIn, stayState.checkOut) < MIN_NIGHTS) stayState.checkOut = shiftDate(stayState.checkIn, MIN_NIGHTS)
}

export function saveStayState() {
  try { uni.setStorageSync(KEY, { ...stayState }) } catch (e) { /* 存不下只影响下次默认值 */ }
}

const parts = (ymd) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd || '')
  return m ? [+m[1], +m[2], +m[3]] : null
}

export const nightsBetween = (a, b) => {
  const x = parts(a)
  const y = parts(b)
  if (!x || !y) return 0
  return Math.round((Date.UTC(y[0], y[1] - 1, y[2]) - Date.UTC(x[0], x[1] - 1, x[2])) / 86400000)
}

/** '2026-09-05' → '9月5日' */
export const dayText = (ymd) => {
  const p = parts(ymd)
  return p ? `${p[1]}月${p[2]}日` : ''
}

/** '2026-09-05' → '周六' */
export const weekText = (ymd) => {
  const p = parts(ymd)
  return p ? ['周日', '周一', '周二', '周三', '周四', '周五', '周六'][new Date(Date.UTC(p[0], p[1] - 1, p[2])).getUTCDay()] : ''
}

/** '2026-09-05' → '9.5' */
export const dotText = (ymd) => {
  const p = parts(ymd)
  return p ? `${p[1]}.${p[2]}` : ''
}
