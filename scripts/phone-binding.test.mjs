import test from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'vite'

const server = await createServer({ configFile: false, server: { middlewareMode: true, hmr: false } })
const { createPhoneBinding, bindWechatPhone } = await server.ssrLoadModule('/pages/auth/phone-binding.js')
const session = await server.ssrLoadModule('/common/experience.js')
const request = await server.ssrLoadModule('/common/request.js')
await server.close()

const authorized = code => ({ detail: { code, errMsg: 'getPhoneNumber:ok' } })
const consent = { agreed: true }
function fixture(overrides = {}) {
  const calls = []
  const state = { account: null, accepted: null }
  const bound = { id: 'user-1', phoneBound: true, phone: '138****1234', staffGrants: [] }
  const bind = createPhoneBinding({
    restore: async () => calls.push('restore'),
    login: async () => { calls.push('login'); state.account = { id: 'user-1' } },
    account: () => state.account,
    verify: async code => { calls.push(['verify', code]); return { data: bound } },
    accept: account => { calls.push('accept'); state.accepted = account; state.account = account },
    ...overrides
  })
  return { bind, calls, state, bound }
}

test('one authorization restores or logs in, exchanges only its phone code, and accepts the saved account', async () => {
  const f = fixture()
  const account = await f.bind(authorized('phone-code'), consent)
  assert.deepEqual(f.calls, ['restore', 'login', ['verify', 'phone-code'], 'accept'])
  assert.equal(account, f.bound)
  assert.equal(f.state.accepted.phoneBound, true)
})

test('no consent, cancelled permission, and missing codes do not log in or bind', async () => {
  const f = fixture()
  await assert.rejects(f.bind(authorized('phone-code')), /同意协议/)
  await assert.rejects(f.bind({ detail: { errMsg: 'getPhoneNumber:fail user deny' } }, consent), /取消/)
  await assert.rejects(f.bind({ detail: {} }, consent), /未返回手机号授权凭证/)
  await assert.rejects(f.bind({ detail: { code: ' ', errMsg: 'getPhoneNumber:ok' } }, consent), /未返回手机号授权凭证/)
  await assert.rejects(f.bind({ detail: { code: 'unexpected', errMsg: 'getPhoneNumber:fail' } }, consent), /未返回手机号授权凭证/)
  assert.deepEqual(f.calls, [])
})

test('native failures explain the next step without logging in or revealing callback contents', async () => {
  const f = fixture()
  for (const [detail, expected] of [
    [{ errno: 1400001 }, /次数已用完.*1400001/],
    [{ errno: '102', code: 'sensitive', errMsg: 'getPhoneNumber:ok' }, /联系客服.*102/],
    [{ errno: 112 }, /联系客服.*112/],
    [{ errno: 101102 }, /微信弹出的隐私保护指引/],
    [{ errno: 108 }, /网络/],
    [{ errno: 1003 }, /频繁/],
    [{ errMsg: 'getPhoneNumber:fail privacy permission is not authorized' }, /隐私保护指引/],
    [{ encryptedData: 'sensitive', iv: 'sensitive', errMsg: 'getPhoneNumber:ok' }, /更新微信/],
    [{ errno: 9999, errMsg: 'getPhoneNumber:fail sensitive' }, /微信错误码 9999/]
  ]) {
    await assert.rejects(f.bind({ detail }, consent), error => {
      assert.match(error.message, expected)
      assert.doesNotMatch(error.message, /sensitive|取消/)
      return true
    })
  }
  for (const detail of [{ errno: 104 }, { errMsg: 'getPhoneNumber:fail jsapi user authorize denied' }]) {
    await assert.rejects(f.bind({ detail }, consent), error => error.cancelled === true)
  }
  assert.deepEqual(f.calls, [])
})

test('a fresh successful callback works after a native network error', async () => {
  const f = fixture()
  await assert.rejects(f.bind({ detail: { errno: 108 } }, consent), /网络/)
  assert.equal(await f.bind({ detail: { code: ' new ', errMsg: 'getPhoneNumber:ok ', errno: 0 } }, consent), f.bound)
  assert.deepEqual(f.calls, ['restore', 'login', ['verify', 'new'], 'accept'])
})

test('record consent after login and before exchanging a fresh phone code', async () => {
  const f = fixture()
  const conflict = Object.assign(new Error('需重新阅读协议'), { code: 409 })
  let currentTerms = false
  const opts = { agreed: true, beforeVerify: async () => {
    assert.equal(f.state.account.id, 'user-1')
    f.calls.push('consent')
    if (!currentTerms) throw conflict
  } }
  await assert.rejects(f.bind({ detail: {} }, opts), /未返回/)
  assert.deepEqual(f.calls, [])
  await assert.rejects(f.bind(authorized('old'), opts), error => error === conflict)
  assert.deepEqual(f.calls, ['restore', 'login', 'consent'])
  currentTerms = true
  await f.bind(authorized('fresh'), opts)
  assert.deepEqual(f.calls.slice(3), ['restore', 'consent', ['verify', 'fresh'], 'accept'])
})

test('leaving the page or switching accounts while consent is pending prevents phone exchange', async () => {
  for (const kind of ['unload', 'switch']) {
    const f = fixture()
    let visible = true
    const opts = { agreed: true, isCurrent: () => visible, beforeVerify: async () => {
      if (kind === 'unload') visible = false
      else f.state.account = { id: 'user-2' }
    } }
    await assert.rejects(f.bind(authorized('unused'), opts), /已变化/)
    assert.deepEqual(f.calls, ['restore', 'login'])
  }
})

test('an existing valid account binds without switching identity or logging in again', async () => {
  const f = fixture()
  f.state.account = { id: 'user-1', phoneBound: false }
  await f.bind(authorized('new-phone-code'), consent)
  assert.deepEqual(f.calls, ['restore', ['verify', 'new-phone-code'], 'accept'])
})

test('an expired stored session gets a fresh login before phone exchange', async () => {
  let current = { id: 'expired' }
  const f = fixture({ restore: async () => { current = null }, account: () => current,
    login: async () => { current = { id: 'user-1' } } })
  await f.bind(authorized('phone-code'), consent)
  assert.equal(f.state.accepted.id, 'user-1')
})

test('double callbacks share one in-flight exchange', async () => {
  let release
  let exchanges = 0
  const f = fixture({ verify: async () => { exchanges++; return new Promise(resolve => { release = resolve }) } })
  const first = f.bind(authorized('once'), consent)
  const second = f.bind(authorized('once'), consent)
  assert.equal(first, second)
  await new Promise(resolve => setImmediate(resolve))
  assert.equal(exchanges, 1)
  release({ data: f.bound })
  await first
  assert.equal(f.calls.filter(x => x === 'accept').length, 1)
})

test('failed/used phone code leaves old binding unchanged and permits a fresh authorization', async () => {
  let attempts = 0
  const f = fixture({ verify: async () => {
    if (++attempts === 1) throw new Error('授权凭证已过期')
    return { data: f.bound }
  } })
  f.state.account = { id: 'user-1', phoneBound: true, phone: '139****5678' }
  await assert.rejects(f.bind(authorized('expired'), consent), /过期/)
  assert.equal(f.state.accepted, null)
  assert.equal(f.state.account.phone, '139****5678')
  await f.bind(authorized('fresh'), consent)
  assert.equal(attempts, 2)
  assert.equal(f.state.account.phone, '138****1234')
})

test('wrong account, false success, and incomplete server responses cannot show binding success', async () => {
  for (const data of [null, {}, { id: 'user-1', phoneBound: false },
    { id: 'user-1', phoneBound: true }, { id: 'someone-else', phoneBound: true, phone: '138****1234' }]) {
    const f = fixture({ verify: async () => ({ data }) })
    await assert.rejects(f.bind(authorized('code'), consent), /未确认/)
    assert.equal(f.state.accepted, null)
  }
})

test('a response completing after account switch cannot replace the new account', async () => {
  const f = fixture({ verify: async () => {
    f.state.account = { id: 'user-2' }
    return { data: f.bound }
  } })
  await assert.rejects(f.bind(authorized('code'), consent), /未确认/)
  assert.equal(f.state.account.id, 'user-2')
})

test('network/auth failure is not retried with the same one-use code', async () => {
  let attempts = 0
  const f = fixture({ verify: async () => { attempts++; throw Object.assign(new Error('登录已过期'), { code: 401 }) } })
  await assert.rejects(f.bind(authorized('one-use'), consent), /登录已过期/)
  assert.equal(attempts, 1)
  assert.equal(f.state.accepted, null)
})

// These tests use the actual session/request modules. Only the uni network/runtime
// boundary is mocked, so restore/login side effects cannot be hidden by a stub.
function runtime() {
  const storage = new Map()
  const requests = []
  globalThis.uni = {
    getStorageSync: key => storage.get(key),
    setStorageSync: (key, value) => storage.set(key, value),
    removeStorageSync: key => storage.delete(key),
    login: options => options.success({ code: 'wx-login-code' }),
    request: options => requests.push(options)
  }
  session.logout()
  return requests
}
const flush = () => new Promise(resolve => setImmediate(resolve))
const reply = (req, body) => req.success({ data: body })
const staffAccount = { id: 'staff', phoneBound: false, staffGrants: [{ active: true }] }

test('logout while wx.login is pending prevents even the login request', async () => {
  const requests = runtime()
  let wxReply
  uni.login = options => { wxReply = options }
  const pending = bindWechatPhone(authorized('phone-code'), consent)
  await flush()
  session.logout()
  wxReply.success({ code: 'late-login-code' })
  await assert.rejects(pending, /登录状态已变化/)
  assert.equal(requests.length, 0)
  assert.equal(request.getToken(), null)
  assert.equal(session.experience.account, null)
})

test('logout or page unload during login cannot revive the account or bind a phone', async () => {
  for (const reason of ['logout', 'unload']) {
    const requests = runtime()
    let alive = true
    const pending = bindWechatPhone(authorized('phone-code'), { agreed: true, isCurrent: () => alive })
    await flush()
    assert.equal(requests.length, 1)
    assert.ok(requests[0].url.endsWith('/app/auth/wx-login'))
    if (reason === 'logout') session.logout()
    else alive = false
    reply(requests[0], { code: 200, token: 'late-token', account: staffAccount })
    await assert.rejects(pending, /登录状态已变化/)
    assert.equal(request.getToken(), null)
    assert.equal(session.experience.account, null)
    assert.equal(requests.length, 1, 'no phone request after leaving login')
  }
})

test('binding success and failure preserve a dual-role account in user mode', async () => {
  for (const succeeds of [true, false]) {
    const requests = runtime()
    request.setToken('staff-token')
    session.acceptAuthenticatedAccount(staffAccount)
    session.switchMode('user')
    const pending = bindWechatPhone(authorized('phone-code'), consent)
    reply(requests[0], { code: 200, data: staffAccount })
    await flush()
    assert.equal(session.experience.mode, 'user', 'restore keeps chosen mode')
    assert.ok(requests[1].url.endsWith('/app/auth/phone-verify'))
    reply(requests[1], succeeds
      ? { code: 200, data: { ...staffAccount, phoneBound: true, phone: '138****1234' } }
      : { code: 500, msg: '授权已过期' })
    if (succeeds) await pending
    else await assert.rejects(pending, /过期/)
    assert.equal(session.experience.mode, 'user')
    assert.equal(session.experience.account.id, 'staff')
  }
})

test('logout during restore prevents the late response from restoring or binding', async () => {
  const requests = runtime()
  request.setToken('old-token')
  session.acceptAuthenticatedAccount(staffAccount)
  const pending = bindWechatPhone(authorized('phone-code'), consent)
  session.logout()
  reply(requests[0], { code: 200, data: staffAccount })
  await assert.rejects(pending, /登录状态已变化/)
  assert.equal(requests.length, 1)
  assert.equal(request.getToken(), null)
  assert.equal(session.experience.account, null)
})

test('an old unauthorized response cannot clear the newly authenticated account', async () => {
  const requests = runtime()
  request.setToken('old-token')
  session.acceptAuthenticatedAccount(staffAccount)
  const pending = bindWechatPhone(authorized('phone-code'), consent)
  session.logout()
  request.setToken('new-token')
  session.acceptAuthenticatedAccount({ id: 'new-user', staffGrants: [] })
  reply(requests[0], { code: 401, msg: '旧令牌过期' })
  await assert.rejects(pending, /登录状态已变化/)
  assert.equal(request.getToken(), 'new-token')
  assert.equal(session.experience.account.id, 'new-user')
})

test('a restore network failure exhausts read retries, preserves the account and never starts another login', { timeout: 5000 }, async () => {
  const requests = runtime()
  request.setToken('staff-token')
  session.acceptAuthenticatedAccount(staffAccount)
  session.switchMode('user')
  const pending = bindWechatPhone(authorized('phone-code'), consent)
  // The request layer retries failed GETs twice. Complete those mocked requests
  // too, otherwise this test waits forever for a response it never supplies.
  uni.request = options => {
    requests.push(options)
    queueMicrotask(() => options.fail({ errMsg: 'request:fail timeout' }))
  }
  requests[0].fail({ errMsg: 'request:fail timeout' })
  await assert.rejects(pending, /网络连接失败/)
  assert.equal(requests.length, 3)
  assert.ok(requests.every(req => req.method === 'GET' && req.url.endsWith('/app/auth/account')))
  assert.equal(request.getToken(), 'staff-token')
  assert.equal(session.experience.account.id, 'staff')
  assert.equal(session.experience.mode, 'user')
})

test('only the latest concurrent login is allowed to commit its session', async () => {
  const requests = runtime()
  const first = session.loginWithWeixin()
  await flush()
  const second = session.loginWithWeixin()
  await flush()
  reply(requests[1], { code: 200, token: 'newest-token', account: { id: 'newest' } })
  await second
  reply(requests[0], { code: 200, token: 'older-token', account: { id: 'older' } })
  await assert.rejects(first, /登录状态已变化/)
  assert.equal(request.getToken(), 'newest-token')
  assert.equal(session.experience.account.id, 'newest')
})

test('a new page can authorize while the cancelled old page is still waiting', async () => {
  const requests = runtime()
  let oldPageActive = true
  const first = bindWechatPhone(authorized('old-phone-code'), { agreed: true, isCurrent: () => oldPageActive })
  await flush()
  oldPageActive = false
  const second = bindWechatPhone(authorized('new-phone-code'), consent)
  assert.notEqual(first, second)
  await flush()
  assert.equal(requests.length, 2)
  reply(requests[0], { code: 200, token: 'discarded', account: { id: 'user' } })
  await assert.rejects(first, /登录状态已变化/)
  assert.equal(bindWechatPhone(authorized('new-phone-code'), consent), second, 'old finally must not clear new operation')
  reply(requests[1], { code: 200, token: 'current', account: { id: 'user' } })
  await flush()
  assert.equal(requests[2].data.code, 'new-phone-code')
  reply(requests[2], { code: 200, data: { id: 'user', phoneBound: true, phone: '138****1234' } })
  await second
  assert.equal(request.getToken(), 'current')
})

test('a stale startup restore cannot overwrite a completed phone binding', async () => {
  const requests = runtime()
  request.setToken('staff-token')
  session.acceptAuthenticatedAccount(staffAccount)
  const startup = session.restoreSession()
  const pending = bindWechatPhone(authorized('phone-code'), consent)
  reply(requests[1], { code: 200, data: staffAccount })
  await flush()
  reply(requests[2], { code: 200, data: { ...staffAccount, phoneBound: true, phone: '138****1234' } })
  await pending
  reply(requests[0], { code: 200, data: staffAccount })
  await startup
  assert.equal(session.experience.account.phoneBound, true)
  assert.equal(session.experience.account.phone, '138****1234')
})
