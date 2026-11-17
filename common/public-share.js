import { closedSharePage } from './features.js'
const BRAND = '袋鼠全球青年'
const COVER = '/static/share/brand-cover.jpg'
// Only public content selectors belong in a shared link. Never copy page options wholesale.
const PUBLIC_KEYS = new Set(['id', 'jobId', 'stayId', 'postId', 'uid', 'type', 'city', 'code', 'channel', 'tab', 'all'])

export function publicShare(path, params = {}, title = BRAND, imageUrl = COVER) {
  const query = Object.entries(params)
    .filter(([key, value]) => PUBLIC_KEYS.has(key) && value !== undefined && value !== null && value !== '')
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`).join('&')
  return shareWithCover({ title, path: path + (query ? '?' + query : ''), imageUrl })
}

export function shareWithCover(message = {}) {
  if (closedSharePage(message.path)) return { title: BRAND, path: '/pages/home/index', imageUrl: COVER }
  return { ...message, title: String(message.title || BRAND).slice(0, 100), imageUrl: message.imageUrl || COVER }
}

export function timelineShare(message = {}) {
  const shared = shareWithCover(message)
  const query = String(shared.path || '').split('?')[1] || ''
  const safeQuery = query.split('&').filter(part => {
    try { return PUBLIC_KEYS.has(decodeURIComponent(part.split('=')[0])) } catch { return false }
  }).join('&')
  // WeChat timeline accepts query, not path: each caller shares its own public page.
  return { title: shared.title, query: safeQuery, imageUrl: shared.imageUrl }
}

export function showPublicShareMenu() {
  // #ifdef MP-WEIXIN
  const route = typeof getCurrentPages === 'function' ? getCurrentPages().pop()?.route : ''
  if (closedSharePage(route)) uni.hideShareMenu({ menus: ['shareAppMessage','shareTimeline'], fail() {} })
  else uni.showShareMenu({ withShareTicket: false, menus: ['shareAppMessage', 'shareTimeline'], fail() {} })
  // #endif
}
