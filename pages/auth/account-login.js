import { restoreSession, loginWithWeixin, experience, getSessionRevision } from '../../common/experience.js'
import { post } from '../../common/request.js'

// Account identity comes from the normal server-verified login. A phone number
// is a separate, optional permission, requested only by a phone-dependent action.
export function createAccountLogin({ restore, login, account, consent, revision = () => 0 }) {
  let pending = null
  return function enter({ agreed = false, versions, isCurrent = () => true } = {}) {
    if (!agreed) return Promise.reject(new Error('请先阅读并同意协议'))
    if (!/^[a-f0-9]{16}$/.test(versions?.termsVersion || '') || !/^[a-f0-9]{16}$/.test(versions?.privacyVersion || '')) {
      return Promise.reject(new Error('请先加载并阅读完整协议'))
    }
    if (pending?.current()) return pending.promise
    const expected = revision()
    const current = () => isCurrent() && revision() === expected
    const check = () => { if (!current()) throw new Error('登录状态已变化，请重新登录') }
    const operation = { current }
    const acceptedVersions = { termsVersion: versions.termsVersion, privacyVersion: versions.privacyVersion }
    pending = operation
    operation.promise = (async () => {
      await restore({ isCurrent: current, strictErrors: true })
      check()
      if (!account()?.id) await login(undefined, { isCurrent: current })
      check()
      const id = account()?.id
      if (!id) throw new Error('登录未完成，请重试')
      await consent(acceptedVersions)
      check()
      if (String(account()?.id) !== String(id)) throw new Error('登录账号已变化，请重新登录')
      return account()
    })().finally(() => { if (pending === operation) pending = null })
    return operation.promise
  }
}

export const loginAccount = createAccountLogin({
  restore: restoreSession,
  login: loginWithWeixin,
  account: () => experience.account,
  consent: versions => post('/app/me/consent/legal', versions),
  revision: getSessionRevision
})
