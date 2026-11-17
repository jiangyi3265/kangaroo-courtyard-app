// 前台新消息提示（内测反馈 2.0）：小程序 / 网页在前台时每 60 秒查一次未读数（轻量接口），
// 比上次多了就再取最新 1 条，在顶栏下面露一条 3 秒的提示（一行，k-topbar 里渲染），点了去看那条消息。
// 不做 WebSocket；切到后台（App onHide）就停，回到前台（onShow）再开。
// 消息页、私信聊天页自己就在刷新，不再弹提示。
import { reactive } from 'vue'
import { experience, refreshUnread } from './experience.js'
import { apiMessages, apiMarkRead } from './api.js'
import { go } from './screen.js'

export const newsTip = reactive({ text: '', id: null, route: '' })
let timer = null
let hideTimer = null
let busy = false

const QUIET = /^pages\/(messages\/index|community\/chat)$/

async function tick() {
  if (busy || !experience.account || experience.account.preview) return
  busy = true
  try {
    const before = experience.unread || 0
    const now = await refreshUnread()
    if (!(now > before)) return
    const page = (getCurrentPages().pop() || {}).route || ''
    if (QUIET.test(page)) return
    const m = ((await apiMessages(experience.mode, undefined, { page: 1, size: 1 })).rows || [])[0]
    if (!m || m.read) return
    newsTip.text = m.title || '你有一条新消息'
    newsTip.id = m.id
    newsTip.route = m.route || ''
    clearTimeout(hideTimer)
    hideTimer = setTimeout(() => { newsTip.text = '' }, 3000)
  } catch (e) {
    // 静默：提示条只是锦上添花，网络不好时不打扰
  } finally {
    busy = false
  }
}

export function startNewsPolling() {
  if (!timer) timer = setInterval(tick, 60000)
}

export function stopNewsPolling() {
  clearInterval(timer)
  timer = null
  newsTip.text = ''
}

// 点提示条：标成已读，去消息自己带的页面；没有页面（或就是消息页）的去消息中心
export function openNewsTip() {
  const { id, route } = newsTip
  newsTip.text = ''
  if (id) apiMarkRead(id).then(refreshUnread).catch(() => {})
  go(route && !/^\/?pages\/messages\/index/.test(route) ? route : '/pages/messages/index')
}
