// 小院「住过的家人评价」页（pages/stays/reviews.vue，2026-10-17 改版 R2）用的小函数。
// 不碰 vue / uni，node 测试里能直接 import；放在 pages/stays 分包里，不占主包。
// 数据都来自 GET /app/stay/{stayId}/reviews/summary 和 /reviews（后端 KgStayReviewService，按真实评价统计，不接大模型）。
import { evenSpans } from './stays-ui.js'

/** 进这个页面的地址：详情页「住过的家人评价」入口用 */
export const stayReviewsUrl = (stayId, roomTypeId, roomName = '') => {
  const url = '/pages/stays/reviews?stayId=' + Number(stayId)
  const id = Number(roomTypeId)
  return Number.isSafeInteger(id) && id > 0
    ? url + '&roomTypeId=' + id + (roomName ? '&roomTypeName=' + encodeURIComponent(roomName) : '')
    : url
}

/** 综合分 / 分项分写一位小数；没有分时写「—」 */
export const scoreText = (v) => (v == null || v === '' || !(Number(v) > 0) ? '—' : Number(v).toFixed(1))

/** 五颗星哪几颗点亮：按四舍五入后的整数分（4.8 → 5 颗、4.4 → 4 颗） */
export const starFills = (v) => {
  const n = Math.round(Number(v) || 0)
  return [1, 2, 3, 4, 5].map((i) => i <= n)
}

/** 三个页签，条数取汇总接口的 tabs（不随房型 / 入住时间筛选变） */
export const reviewTabs = (tabs) => {
  const t = tabs || {}
  return [
    { key: 'all', label: '全部', count: Number(t.all) || 0 },
    { key: 'media', label: '有图·视频', count: Number(t.media) || 0 },
    { key: 'bad', label: '差评', count: Number(t.bad) || 0 }
  ]
}

/** 列表请求参数：空的不带（接口对不认识的参数回 422，空串也不发） */
export const reviewQuery = ({ tab, roomTypeId, month, mention, pageNum, pageSize }) => {
  const q = { pageNum: Number(pageNum) || 1, pageSize: Number(pageSize) || 10 }
  if (tab && tab !== 'all') q.tab = tab
  if (Number(roomTypeId) > 0) q.roomTypeId = Number(roomTypeId)
  if (month) q.month = month
  if (mention) q.mention = mention
  return q
}

/** 「筛选」按钮上的数字：房型、入住时间各算一个 */
export const filterCount = ({ roomTypeId, month }) => (Number(roomTypeId) > 0 ? 1 : 0) + (month ? 1 : 0)

/**
 * 评价正文拆段：写评价页提交的是「【卫生】房间很干净\n【服务】老板很热情」，
 * 拆成 [{ label: '卫生', text: '房间很干净' }, …]，页面把小标题画成小字，不显示方括号；没有小标题的一行 label 为空
 */
export function contentParts(content) {
  const out = []
  for (const line of String(content || '').split(/\r?\n/)) {
    const t = line.trim()
    if (!t) continue
    const m = /^【([^】]{1,12})】\s*(.*)$/.exec(t)
    if (m) {
      if (m[2]) out.push({ label: m[1], text: m[2] })
    } else out.push({ label: '', text: t })
  }
  return out
}

/** 评价卡底部的小标签：门店打的 tags 在前，再补正文里提到的（大家提到同一张词表），去重，最多 4 个 */
export const cardChips = (review) => {
  const out = []
  for (const t of [...((review && review.tags) || []), ...((review && review.mentions) || [])]) {
    const s = String(t || '').trim()
    if (s && !out.includes(s)) out.push(s)
  }
  return out.slice(0, 4)
}

/** 每行最多两项，长房型名和入住月份也能完整阅读。 */
export const optSpans = (n) => evenSpans(n, 2)

/** 参考稿：三张同排，单张和双张保留相同的缩略图尺寸，点击查看原图。 */
export const photoGrid = (n) => (n === 1 ? 'one' : n === 2 || n === 4 ? 'two' : 'three')

/** 汇总卡里要不要出推荐率（不足 5 条评价接口给 null） */
export const recommendText = (rate) => (rate == null || rate === '' ? '' : Math.round(Number(rate)) + '%')

/** 列表为空时说什么：整个小院没评价 / 筛完没有 */
export const emptyCopy = (total, filtered) => (Number(total) > 0 && filtered
  ? { title: '没有符合条件的评价', sub: '换个条件看看，或者清除筛选' }
  : { title: '还没有家人评价', sub: '住过的家人离店后会在这里留下真实感受，\n你也可以先看看房型和小院介绍～' })

/** 已选的筛选条件（显示在列表上方，点 × 去掉）：房型、入住时间、大家提到 */
export const activeFilters = ({ roomTypeId, roomName, month, mention }, summary) => {
  const s = summary || {}
  const out = []
  if (Number(roomTypeId) > 0) {
    const r = (s.roomTypes || []).find((x) => Number(x.roomTypeId) === Number(roomTypeId))
    out.push({ key: 'room', text: r ? r.name : (roomName || '所选房型') })
  }
  if (month) {
    const m = (s.months || []).find((x) => x.month === month)
    out.push({ key: 'month', text: (m ? m.label : month) + '入住' })
  }
  if (mention) out.push({ key: 'mention', text: '提到「' + mention + '」' })
  return out
}
