// Validate shared/deep booking links before any quote or order request.
import { MIN_NIGHTS, MAX_NIGHTS } from './stays-range.js'
const positiveId = value => {
  const text = String(value ?? '').trim()
  const n = /^\d+$/.test(text) ? Number(text) : 0
  return Number.isSafeInteger(n) && n > 0 ? n : 0
}
const realDate = value => {
  const text = String(value ?? '')
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return ''
  const date = new Date(text + 'T00:00:00Z')
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === text ? text : ''
}

export function stayPayEntry(query = {}, today) {
  const stayId = positiveId(query.stayId), roomTypeId = positiveId(query.roomTypeId)
  const checkIn = realDate(query.checkIn), checkOut = realDate(query.checkOut)
  const nights = checkIn && checkOut ? (Date.parse(checkOut) - Date.parse(checkIn)) / 86400000 : 0
  const daysAhead = checkIn ? (Date.parse(checkIn) - Date.parse(today)) / 86400000 : -1
  const datesValid = !!(checkIn && checkOut && daysAhead >= 0 && daysAhead <= 180 && nights >= MIN_NIGHTS && nights <= MAX_NIGHTS)
  const guests = query.guests == null || query.guests === '' ? 1 : positiveId(query.guests)
  const guestsValid = guests >= 1 && guests <= 6
  const result = { stayId, roomTypeId, checkIn, checkOut, guests, datesValid, guestsValid }
  if (!stayId) return { ...result, valid: false, title: '请先选择要入住的小院', message: '这个预订链接缺少房源信息，请重新选择小院后继续。' }
  if (!roomTypeId) return { ...result, valid: false, title: '还未选择房型', message: '请先选择这家小院的房型和入住日期，再填写入住人信息。' }
  if (!datesValid) return { ...result, valid: false, title: '请重新选择入住日期', message: '一周起订（至少7晚），请选择未来180天内入住，连住7–30晚。' }
  if (!guestsValid) return { ...result, valid: false, title: '请重新选择入住人数', message: '入住人数需要为1–6人，请确认人数后重新选择房型。' }
  return { ...result, valid: true }
}
