// 报名结束页的「分享给亲友」（2026-10-31 主人：「分享过去就是这个人在哪天哪月去哪个地方」）：分享卡片的文字和亲友打开的行程页 pages/jobs/itinerary。
// 只在 jobs 分包里用，不进主包；不引用 @/ 下的模块，node --test 直接测。
//
// 链接只带四样：jobId、date、days、name，绝不带手机号。地点不放链接里：打开时按 jobId 查，别人改不了地点。
// 行程页不查报名（不然就要登录），所以用户撤回报名后老链接还能打开，这是有意的。
import { durationLabel } from './apply-flow.js'
import { jobShareWebUrl } from './job-share-url.js'
import { displayWording } from '../../common/display-wording.js'

export const ITINERARY_PAGE = '/pages/jobs/itinerary' // 放这里，不进 routes.js（主包不加东西）
const WORK = { volunteer: '做换工', parttime: '做兼职', fulltime: '工作' }
export const FALLBACK_NAME = '我的朋友'
const NAME_MAX = 8

/** '2026-11-07' →「11月7日」；不是日期返回 '' */
export const monthDay = (ymd) => {
  const m = /^\d{4}-(\d{2})-(\d{2})/.exec(String(ymd || ''))
  return m ? Number(m[1]) + '月' + Number(m[2]) + '日' : ''
}

const stripSpace = (raw) => String(raw == null ? '' : raw).replace(/\s+/g, '')
const chars = (text) => Array.from(text)
// 称呼里不能夹手机号、网址、标签：数字加起来 5 位以上（138-0000-0000 这种也算）、http / www / .com 这类、尖括号花括号
const unsafeName = (text) => (text.match(/[0-9０-９]/g) || []).length >= 5 || /https?|www\.|\.[a-z]{2,}|[<>{}]/i.test(text)
/** 分享用的称呼：去空白、最多 8 个字（按字数，表情算一个）；夹了手机号、网址、标签的返回 ''，页面退回「我的朋友」 */
export const cleanName = (raw) => {
  const text = stripSpace(raw)
  if (!text || unsafeName(text)) return ''
  return chars(text).slice(0, NAME_MAX).join('')
}

/** 「小杨 11月7日 到 平潭袋鼠小院 做换工」 */
export const tripTitle = ({ name, arrival, place, jobType }) => {
  const where = String(place || '').trim()
  return [cleanName(name) || FALLBACK_NAME, monthDay(arrival), where ? '到 ' + where : '', WORK[jobType] || '工作'].filter(Boolean).join(' ')
}

/** 亲友打开的页面路径：只带 jobId、date、days、name */
export const tripPath = ({ jobId, arrival, days, name }) => ITINERARY_PAGE + '?jobId=' + Number(jobId) + '&date=' + String(arrival || '') + '&days=' + (Number(days) || '') + '&name=' + encodeURIComponent(cleanName(name))

const isRealDate = (text) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(text || ''))
  if (!m) return false
  const y = Number(m[1]), mo = Number(m[2]), d = Number(m[3])
  const t = new Date(Date.UTC(y, mo - 1, d))
  return t.getUTCFullYear() === y && t.getUTCMonth() === mo - 1 && t.getUTCDate() === d
}
/**
 * 打开行程页时校验链接（参数已经过 decodeQuery）：jobId 不是正整数、date 不是真实日期 → { invalid: true }；
 * days 不在 1–365 就不显示时长；name 夹了手机号、网址或超过 8 个字（正常分享不会超，超了就是被改过）→「我的朋友」
 */
export function parseTripQuery(q) {
  const x = q || {}
  const jobId = /^[1-9]\d{0,17}$/.test(String(x.jobId == null ? '' : x.jobId)) ? Number(x.jobId) : 0
  const date = String(x.date == null ? '' : x.date)
  if (!jobId || !isRealDate(date)) return { invalid: true }
  const dayText = String(x.days == null ? '' : x.days)
  const days = /^\d{1,3}$/.test(dayText) && Number(dayText) >= 1 && Number(dayText) <= 365 ? Number(dayText) : 0
  const stripped = stripSpace(x.name)
  const name = chars(stripped).length > NAME_MAX ? '' : cleanName(stripped)
  return { invalid: false, jobId, date, days, name: name || FALLBACK_NAME }
}

/** 复制给亲友的一段话（网页版没有微信转发）：标题 + 预计时长 + 链接；网页版用当前站点的地址，别的情况用公开地址 */
export function tripCopyText(trip, href = '') {
  const stay = durationLabel(trip.days)
  const head = tripTitle(trip) + (stay ? '，预计待' + stay : '')
  return head + '。行程：' + jobShareWebUrl(tripPath(trip), href)
}

/** 分享封面：要是完整地址才传；本地占位图（/static/）或没有封面时不传，微信用页面截图 */
export const tripImageUrl = (cover) => {
  const url = String(cover || '')
  return !url || url.indexOf('/static/') === 0 ? '' : url
}

/** onShareAppMessage 的返回：有行程发行程卡片，没有（还没报名成功、读不到）用 fallback */
export const tripShareMessage = (trip, fallback) => (trip && trip.arrival
  ? { title: tripTitle(trip), path: tripPath(trip), ...(trip.imageUrl ? { imageUrl: trip.imageUrl } : {}) }
  : fallback)

/** 没有行程时转发什么：岗位详情；连岗位都不知道就首页（右上角「···转发」任何时候都能点） */
export const jobShareFallback = (jobId, title) => ({
  title: displayWording(String(title || '').trim()) || '袋鼠全球青年',
  path: Number(jobId) > 0 ? '/pages/jobs/detail?jobId=' + Number(jobId) : '/pages/home/index'
})
