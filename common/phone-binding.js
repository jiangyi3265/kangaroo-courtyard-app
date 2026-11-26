import { apiPhoneVerify } from './api.js'
import { restoreSession, loginWithWeixin, experience, acceptAuthenticatedAccount, getSessionRevision } from './experience.js'

// errno follows WeChat's PublicErrno and getPhoneNumber component contracts.
// Only the numeric error identifier may be shown; the event can contain a phone credential.
function phoneAuthorizationError(detail) {
  const status = String(detail.errMsg || '').trim()
  const errno = /^-?\d{1,8}$/.test(String(detail.errno)) ? Number(detail.errno) : 0
  if (typeof detail.code === 'string' && detail.code.trim() && !errno && (!status || /:ok$/i.test(status))) return null

  const cancelled = errno === 103 || errno === 104 || /\buser\s+(?:authorize\s+)?(?:deny|denied|cancel(?:led|ed)?)\b|:fail\s+cancel$/i.test(status)
  if (cancelled) return Object.assign(new Error('已取消手机号授权，你仍可以先逛逛'), { cancelled: true })

  let message = '微信未返回手机号授权凭证，请再点一次授权'
  if (errno === 1400001) {
    message = '小程序的手机号验证次数已用完，请联系客服'
  } else if ([102, 112, 1025, 101100, 101101].includes(errno) || /has no permission|not declared in the privacy agreement|privacy interface is banned/i.test(status)) {
    message = '小程序暂时无法使用微信手机号验证，请联系客服'
  } else if (errno === 101102 || /privacy permission is not authorized/i.test(status)) {
    message = '请先在微信弹出的隐私保护指引中同意授权，再绑定手机号'
  } else if (errno === 100 || /not supported/i.test(status) || (!detail.code && detail.encryptedData && detail.iv)) {
    message = '当前微信暂不支持此手机号验证方式，请更新微信后重试'
  } else if (errno === 108 || /network|timed?\s*out/i.test(status)) {
    message = '微信手机号授权时网络连接失败，请检查网络后重试'
  } else if (errno === 1003) {
    message = '手机号授权过于频繁，请稍后重试'
  }
  return new Error(errno ? message + '（微信错误码 ' + errno + '）' : message)
}

// The phone authorization code and wx.login code are different, one-use credentials.
// Never collect a phone number from the client or retry a consumed code automatically.
export function createPhoneBinding({ restore, login, account, verify, accept, revision = () => 0 }) {
  let inFlight = null
  return function bind(event, { agreed = false, isCurrent = () => true, beforeVerify } = {}) {
    if (!agreed) return Promise.reject(new Error('请先阅读并同意协议'))
    const detail = event?.detail || {}
    const authError = phoneAuthorizationError(detail)
    if (authError) return Promise.reject(authError)
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
      if (beforeVerify) {
        await beforeVerify()
        assertCurrent()
        if (String(account()?.id) !== String(expectedId)) throw new Error('登录账号已变化，请重新授权')
      }
      const response = await verify(detail.code.trim())
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
