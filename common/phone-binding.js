import { apiPhoneVerify } from './api.js'
import { restoreSession, loginWithWeixin, experience, acceptAuthenticatedAccount, getSessionRevision } from './experience.js'

// The phone authorization code and wx.login code are different, one-use credentials.
// Never collect a phone number from the client or retry a consumed code automatically.
export function createPhoneBinding({ restore, login, account, verify, accept, revision = () => 0 }) {
  let inFlight = null
  return function bind(event, { agreed = false, isCurrent = () => true } = {}) {
    if (!agreed) return Promise.reject(new Error('请先阅读并同意协议'))
    const detail = event?.detail || {}
    if (typeof detail.code !== 'string' || !detail.code.trim() || (detail.errMsg && !/:ok$/.test(detail.errMsg))) {
      const cancelled = /deny|cancel/i.test(detail.errMsg || '')
      return Promise.reject(Object.assign(new Error(cancelled
        ? '已取消手机号授权，你仍可以先逛逛'
        : '未取得手机号授权，请重新点击授权'), { cancelled }))
    }
    if (inFlight?.isCurrent()) return inFlight.promise
    const expectedRevision = revision()
    const current = () => isCurrent() && revision() === expectedRevision
    const assertCurrent = () => { if (!current()) throw new Error('登录状态已变化，请重新授权') }
    const operation = { isCurrent: current }
    inFlight = operation
    operation.promise = (async () => {
      await restore({ isCurrent: current, strictErrors: true })
      assertCurrent()
      if (!account()?.id) await login(undefined, { isCurrent: current })
      assertCurrent()
      const expectedId = account()?.id
      if (!expectedId) throw new Error('登录未完成，请重新授权')
      const response = await verify(detail.code)
      assertCurrent()
      const bound = response?.data
      if (!bound?.id || String(bound.id) !== String(expectedId) || String(account()?.id) !== String(expectedId) || bound.phoneBound !== true || !bound.phone) {
        throw new Error('服务端未确认手机号绑定成功，请重试')
      }
      accept(bound)
      return bound
    })().finally(() => { if (inFlight === operation) inFlight = null })
    return operation.promise
  }
}

export const bindWechatPhone = createPhoneBinding({
  restore: restoreSession,
  login: loginWithWeixin,
  account: () => experience.account,
  verify: apiPhoneVerify,
  accept: account => acceptAuthenticatedAccount(account, { preserveMode: true }),
  revision: getSessionRevision
})
