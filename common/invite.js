// 邀请新人送积分：打开带 ?inviter=邀请码 的分享页时把邀请码记在本机（7 天内有效），登录后交给服务端绑定一次。
// 服务端只认 24 小时内新注册、还没报过名下过单、也没绑定过的账号，其余情况返回 bound=false —— 这里一律静默，不打扰用户。
// 本模块不引用 experience.js（experience.js 登录成功后会调这里），加载时也不调用任何 uni 接口。
import { apiBindInviter } from './api.js'
import { getToken } from './request.js'

const KEY = 'kangaroo:inviter'
// 与服务端 KgInviteService 同一字符表：不含 0 O 1 I L
const CODE = /^[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{6,8}$/
const KEEP_MS = 7 * 86400000

const readSaved = () => {
  try { return uni.getStorageSync(KEY) || null } catch (e) { return null }
}
const save = (v) => { try { uni.setStorageSync(KEY, v); return true } catch (e) { return false } }

/**
 * 从 App.vue 的 onLaunch / onShow 参数里取邀请码并记到本机；有新的待绑定邀请码时返回 true。
 * 小程序从后台切回前台时 onShow 可能还带着当初那条分享链接的参数：同一个码已经得到服务端明确答复（done）就不再记，免得每次切回都请求一遍。
 */
export function captureInviter(options) {
  const q = (options && options.query) || {}
  let raw = String(q.inviter || '')
  // 小程序启动参数没解码；邀请码只有字母数字，解不开也不影响
  try { raw = decodeURIComponent(raw) } catch (e) { /* 保持原值 */ }
  const code = raw.replace(/\s+/g, '').toUpperCase()
  if (!CODE.test(code)) return false
  const saved = readSaved()
  if (saved && saved.code === code && saved.done) return false
  return save({ code, at: Date.now(), done: false })
}

/** 本机记着、还没得到服务端明确答复、也没过期的邀请码；没有返回空串 */
export function pendingInviter() {
  const v = readSaved()
  if (!v || v.done || !CODE.test(v.code || '') || Date.now() - (v.at || 0) > KEEP_MS) return ''
  return v.code
}

/**
 * 服务端的拒绝算不算明确答复：401、429 以外的 4xx 业务拒绝算（比如账号不可用）。
 * 401（登录失效）、429（太频繁）、5xx（服务器出错）、-1（没网 / 返回的不是正常数据）都不算，留着下次再试。
 */
const refused = (code) => typeof code === 'number' && code >= 400 && code < 500 && code !== 401 && code !== 429

let inflight = null
/**
 * 已登录、本机记着邀请码时交给服务端绑定一次。返回 Promise<是否绑上>，从不抛错。
 * 之前除了没网和登录失效，其余失败（服务器出错、太频繁）也记成「已问过」，这个码就再也不会重试；
 * 现在只有服务端给了明确答复才记：成功且带 bound（绑上了 / 不符合条件），或上面说的 4xx 拒绝。
 * 其余情况留着，下次登录、启动或切回前台再试。
 */
export function bindPendingInviter() {
  if (inflight) return inflight
  const code = pendingInviter()
  if (!code || !getToken()) return Promise.resolve(false)
  // 只给这次问的码记「已问过」：请求途中又打开了另一位朋友的链接（本机已换成新码）时，不能把新码也记掉
  const answered = () => { const v = readSaved(); if (v && v.code === code) save({ code, at: Date.now(), done: true }) }
  inflight = apiBindInviter(code)
    .then((res) => {
      const bound = res && res.data ? res.data.bound : undefined
      if (typeof bound !== 'boolean') return false
      answered()
      return bound
    })
    .catch((e) => { if (refused(e && e.code)) answered(); return false })
    .finally(() => { inflight = null })
  return inflight
}

/**
 * App.vue 的 onLaunch / onShow 调这里：先记下启动参数里的邀请码；本机有还没得到明确答复的邀请码
 * （刚记下的，或上次碰上服务器出错 / 太频繁 / 没网的），等登录态恢复（ready 返回的 Promise）后问服务端一次。
 * 同一时间最多一个请求：冷启动时 onLaunch、onShow 一起触发也只发一次。返回 Promise<是否绑上>，从不抛错。
 */
export function noteInviter(options, ready) {
  captureInviter(options)
  if (!pendingInviter()) return Promise.resolve(false)
  return Promise.resolve()
    .then(() => (typeof ready === 'function' ? ready() : null))
    .then(() => bindPendingInviter())
    .catch(() => false)
}
