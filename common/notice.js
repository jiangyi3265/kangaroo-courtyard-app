/**
 * 小程序公告弹窗（后台「用户服务 → 小程序公告」里选了「弹窗提醒一次」的公告，比如「线上兼职须知」）。
 *
 * 什么时候弹：每次打开小程序最多弹一次。首页、岗位列表页 onShow 时调 checkNoticePopup()，
 * 本次启动第一次调用才真正去取；其余页面（支付、订单、深链进来的详情页）不调用，所以不会在那里突然弹出来。
 * 看过哪条：点「我知道了」后把「编号 → 版本」记在本机（游客只能靠它），登录的人同时上报服务器（换手机也不重复弹）。
 * 运营改了标题或正文，版本号会 +1，看过旧版本的人会再看到一次新内容。
 */
import { reactive } from 'vue'
import { apiNoticePopup, apiNoticeSeen } from './api.js'
import { experience, ensureSession } from './experience.js'

/** 弹窗状态：组件 k-notice-popup 读它；首页和列表页各放一个组件，同一时间只有当前页看得见 */
export const noticePopup = reactive({ show: false, notice: null })

let checkedThisLaunch = false

// 按账号分开记：游客记在 guest 下，登录后换成账号自己的记录
const storeKey = () => `kangaroo:${experience.account?.id || 'guest'}:notice-seen`

/** 本机记下的 { 公告编号: 看过的版本 } */
export function readSeenNotices() {
  try {
    const v = uni.getStorageSync(storeKey())
    return v && typeof v === 'object' && !Array.isArray(v) ? v : {}
  } catch (e) {
    return {}
  }
}

/** 本机记一笔「看过」：版本只增不减，最多留 50 条（编号小的是更早的公告，先丢） */
export function rememberNoticeSeen(noticeId, version) {
  const id = String(noticeId || '')
  if (!/^\d+$/.test(id)) return
  const v = Math.max(1, Number(version) || 1)
  const seen = readSeenNotices()
  if ((Number(seen[id]) || 0) >= v) return
  seen[id] = v
  const ids = Object.keys(seen)
  if (ids.length > 50) ids.slice(0, ids.length - 50).forEach((k) => { delete seen[k] })
  try { uni.setStorageSync(storeKey(), seen) } catch (e) { /* 写不进本机只影响下次会不会再弹 */ }
}

// 消息页「系统通知」入口的角标（2026-10-17 主人反馈「角标消不掉」）：报名过线上任务后多出一条要弹窗的「线上兼职须知」，
// 之前进「系统通知」不算看过它（留给首页弹窗），弹窗又没出来时角标就一直是 1。现在进过「系统通知」或点了「全部已读」，
// 公告就不再算进角标；要弹窗的公告照样在首页弹一次（弹窗看上面的 notice-seen，不看这里）
const badgeKey = () => `kangaroo:${experience.account?.id || 'guest'}:notice-badge`

/** 本机记下的「角标已清」{ 公告编号: 版本 } */
export function readNoticeBadgeCleared() {
  try {
    const v = uni.getStorageSync(badgeKey())
    return v && typeof v === 'object' && !Array.isArray(v) ? v : {}
  } catch (e) {
    return {}
  }
}

/** 把这些公告的当前版本记成「角标已清」（最多留 50 条）；返回新的记录 */
export function clearNoticeBadge(list) {
  const cleared = readNoticeBadgeCleared()
  for (const n of list || []) {
    const id = String((n && n.noticeId) || '')
    if (!/^\d+$/.test(id)) continue
    cleared[id] = Math.max(Number(cleared[id]) || 0, Math.max(1, Number(n.version) || 1))
  }
  const ids = Object.keys(cleared)
  if (ids.length > 50) ids.slice(0, ids.length - 50).forEach((k) => { delete cleared[k] })
  try { uni.setStorageSync(badgeKey(), cleared) } catch (e) { /* 写不进本机只影响角标 */ }
  return cleared
}

/** 这条公告还要不要算进「系统通知」角标：没看过当前版本、也没清过当前版本的角标 */
export const noticeBadged = (n, seen, cleared) => {
  const v = Number(n && n.version) || 1, id = String(n && n.noticeId)
  return !(n && n.read) && (Number((seen || {})[id]) || 0) < v && (Number((cleared || {})[id]) || 0) < v
}

/** { 3: 2, 5: 1 } → "3:2,5:1"（取弹窗接口的 seen 参数） */
export const seenNoticesParam = (seen) => Object.keys(seen || {}).filter((id) => /^\d+$/.test(id)).map((id) => id + ':' + (Number(seen[id]) || 1)).join(',')

/** 进首页 / 岗位列表时调用：本次启动只取一次，有没看过的公告就弹出来；取不到不打扰用户 */
export async function checkNoticePopup() {
  if (checkedThisLaunch) return
  checkedThisLaunch = true
  try {
    // 等登录态恢复完再取：登录的人才拿得到「关注线上任务的人」那一类公告
    await ensureSession()
    const res = await apiNoticePopup(seenNoticesParam(readSeenNotices()) || undefined)
    const n = res && res.data
    if (n && n.noticeId) {
      noticePopup.notice = n
      noticePopup.show = true
    }
  } catch (e) {
    // 公告取不到就算了，本次启动不再弹
  }
}

/** 「我知道了」：先关弹窗，再记下看过（本机 + 登录的人上报服务器） */
export async function dismissNoticePopup() {
  const n = noticePopup.notice
  noticePopup.show = false
  noticePopup.notice = null
  if (!n) return
  await markNoticeSeen(n)
}

/** 记下看过某条公告的当前版本：弹窗点「我知道了」、打开公告详情都会调 */
export async function markNoticeSeen(n) {
  if (!n || !n.noticeId) return
  rememberNoticeSeen(n.noticeId, n.version)
  if (!experience.account) return
  try {
    await apiNoticeSeen(n.noticeId, n.version)
  } catch (e) {
    // 本机已经记下，下次启动不会再弹；服务器那份下次看详情时再补
  }
}
