// 社区公共能力：规则同意 / 手机号核验的拦截与重试、城市（含记住上次选的社区城市）、时间格式、分享提示。
// 服务端约定：423 + "CONSENT:<doc>:…" = 需要先同意规则；428 = 需要先验证手机号；422 = 内容被拦截。
import { apiPhoneVerify } from './api.js'
import { modal, errText, prompt } from './ui.js'
import { toast, go } from './screen.js'
import { experience } from './experience.js'
import R from './routes.js'

/** 用户主动取消（不同意规则、不去验证手机）时抛出的错误，调用方不必再提示 */
export const silent = () => Object.assign(new Error(''), { silent: true })

export function readCommunityConsent(doc) {
  return new Promise(resolve => {
    uni.navigateTo({ url: '/pages/community/consent?doc=' + encodeURIComponent(doc), events: { done: value => resolve(value === true) }, fail: () => resolve(false) })
  })
}

export const fail = (e, dft) => {
  if (!e || !e.silent) toast(errText(e, dft))
}

/**
 * 包一层：遇到"需要同意规则"先弹出规则全文，同意后自动重试；遇到"需要验证手机号"引导去验证。
 */
export async function gated(fn, opts = {}) {
  try {
    return await fn()
  } catch (e) {
    if (e && e.code === 428 && opts.onPhone) {
      opts.onPhone()
      throw silent()
    }
    const msg = String((e && e.message) || '')
    if (e && e.code === 423 && msg.startsWith('CONSENT:')) {
      const doc = msg.split(':')[1]
      if (!await readCommunityConsent(doc)) throw silent()
      return gated(fn, opts)
    }
    if (e && e.code === 428) {
      const r = await modal('需要验证手机号', msg + '\n\n现在去验证？', { confirmText: '去验证' })
      if (r.confirm) go(R.login + '?s=4')
      throw silent()
    }
    throw e
  }
}

/** 手机号快速验证：小程序用 getPhoneNumber 的 code；H5 联调环境让开发者输入号码走模拟通道 */
export async function verifyPhone(event) {
  let code = event && event.detail && event.detail.code
  // #ifdef H5
  if (!code) {
    const v = await prompt('联调：输入要模拟的手机号', { placeholder: '11 位手机号（仅本地联调环境可用）' })
    if (!v) throw silent()
    code = 'mock-phone-' + v
  }
  // #endif
  if (!code) {
    toast('需要授权手机号才能继续')
    throw silent()
  }
  const res = await apiPhoneVerify(code)
  if (res.data) experience.account = { ...experience.account, ...res.data }
  return res.data
}

/** 当前城市：引导页选的兴趣城市 → 账号城市 → 大理（社区的默认城市） */
export const currentCity = () => (experience.cities && experience.cities[0]) || (experience.account && experience.account.city) || '大理'

// 社区上次选的城市，按账号分开存本机（键的写法与 experience.js 的 key() 一致：kangaroo:<账号|guest>:<名字>）
const communityCityKey = () => `kangaroo:${experience.account?.id || 'guest'}:community-city`

/**
 * 社区（信息流 / 找搭子 / 活动）起步的城市。之前每次打开都用 currentCity()，而首页把定位城市排在兴趣城市第一位，
 * 用户在社区选过的城市（包括「全部城市」）一进来就被定位城市冲掉；现在优先用上次在社区选的，没选过才用 currentCity()。
 */
export const communityCity = () => {
  try {
    const saved = uni.getStorageSync(communityCityKey())
    if (typeof saved === 'string' && saved.trim()) return saved
  } catch (e) { /* 读不到就用默认城市 */ }
  return currentCity()
}

/** 记住社区里选的城市（城市名或「全部城市」）；只改本机，不动首页的兴趣城市 */
export const saveCommunityCity = (city) => {
  try { uni.setStorageSync(communityCityKey(), String(city || '全部城市')) } catch (e) { /* 存不下只影响下次打开时的默认城市 */ }
}

export const shareTip = () => modal('分享', '请点击右上角「···」→ 转发给朋友', { showCancel: false, confirmText: '知道了' })

export const imgUrl = (p, fallback) => {
  const s = String(p || '')
  if (!s) return fallback || ''
  return s
}
