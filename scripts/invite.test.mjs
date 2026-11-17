import test from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'vite'

// 邀请码：打开带 ?inviter= 的分享页时记下，登录后交给服务端绑定一次；只 mock uni 的存储和网络边界
const server = await createServer({ configFile: false, server: { middlewareMode: true, hmr: false } })
const invite = await server.ssrLoadModule('/common/invite.js')
const request = await server.ssrLoadModule('/common/request.js')
await server.close()

function runtime() {
  const storage = new Map()
  const requests = []
  globalThis.uni = {
    getStorageSync: key => storage.get(key),
    setStorageSync: (key, value) => storage.set(key, value),
    removeStorageSync: key => storage.delete(key),
    request: options => requests.push(options)
  }
  request.setToken(null)
  return { storage, requests }
}
const flush = () => new Promise(resolve => setImmediate(resolve))
const reply = (req, body) => req.success({ data: body })

test('only well-formed invite codes from the landing query are remembered, normalized to upper case', () => {
  runtime()
  assert.equal(invite.captureInviter(undefined), false)
  assert.equal(invite.captureInviter({ query: {} }), false)
  assert.equal(invite.captureInviter({ query: { inviter: 'AB0O1Q' } }), false, '0 / O / 1 不在邀请码字符表里')
  assert.equal(invite.pendingInviter(), '')
  assert.equal(invite.captureInviter({ query: { inviter: ' k7m2pq ' } }), true)
  assert.equal(invite.pendingInviter(), 'K7M2PQ')
})

test('a guest keeps the code until login, then one bind request; the same link is not retried on every app show', async () => {
  const { requests } = runtime()
  invite.captureInviter({ query: { inviter: 'K7M2PQ' } })
  assert.equal(await invite.bindPendingInviter(), false, '没登录不发请求')
  assert.equal(requests.length, 0)
  request.setToken('token-1')
  const first = invite.bindPendingInviter()
  assert.equal(invite.bindPendingInviter(), first, '同时触发（启动 + 切前台）共用一次请求')
  await flush()
  assert.equal(requests.length, 1)
  assert.match(requests[0].url, /\/app\/me\/inviter$/)
  assert.equal(requests[0].method, 'POST')
  assert.equal(requests[0].data.code, 'K7M2PQ')
  reply(requests[0], { code: 200, data: { bound: false, message: '只有注册 24 小时内的新用户可以填写邀请码' } })
  assert.equal(await first, false)
  assert.equal(invite.pendingInviter(), '', '服务端答复过就不再问')
  assert.equal(invite.captureInviter({ query: { inviter: 'K7M2PQ' } }), false, '切回前台还带着同一条链接：不再记')
  assert.equal(await invite.bindPendingInviter(), false)
  assert.equal(requests.length, 1)
  assert.equal(invite.captureInviter({ query: { inviter: 'ABCDEF' } }), true, '换了一位朋友的链接，重新记下')
})

test('a successful binding reports true; a network failure keeps the code for a later retry', async () => {
  const { requests } = runtime()
  request.setToken('token-2')
  invite.captureInviter({ query: { inviter: 'ABCDEF' } })
  const failed = invite.bindPendingInviter()
  await flush()
  requests[0].fail({ errMsg: 'request:fail timeout' })
  assert.equal(await failed, false)
  assert.equal(invite.pendingInviter(), 'ABCDEF', '网络失败留着，下次再试')
  const ok = invite.bindPendingInviter()
  await flush()
  reply(requests[1], { code: 200, data: { bound: true } })
  assert.equal(await ok, true)
  assert.equal(invite.pendingInviter(), '')
})

// 一次绑定请求碰上某种答复后，这个码还算不算「等着再问」
async function answerOnce(body) {
  const { requests } = runtime()
  request.setToken('token-3')
  invite.captureInviter({ query: { inviter: 'K7M2PQ' } })
  const pending = invite.bindPendingInviter()
  await flush()
  if (body === 'network') requests[0].fail({ errMsg: 'request:fail' })
  else reply(requests[0], body)
  assert.equal(await pending, false)
  return invite.pendingInviter()
}

test('server errors, rate limiting, expired login, odd bodies and network failures are retried later', async () => {
  assert.equal(await answerOnce({ code: 500, msg: '服务器开小差了' }), 'K7M2PQ', '5xx：服务器出错，不算答复')
  assert.equal(await answerOnce({ code: 503, msg: '维护中' }), 'K7M2PQ')
  assert.equal(await answerOnce({ code: 429, msg: '操作太频繁，请稍后再试' }), 'K7M2PQ', '429：太频繁，不算答复')
  assert.equal(await answerOnce({ code: 401, msg: '请先登录' }), 'K7M2PQ', '401：登录失效，登录后再问')
  assert.equal(await answerOnce('<html>502 Bad Gateway</html>'), 'K7M2PQ', '返回的不是正常数据（网关报错页）')
  assert.equal(await answerOnce({ code: 200, data: {} }), 'K7M2PQ', '成功却没有 bound：不算答复')
  assert.equal(await answerOnce('network'), 'K7M2PQ', '没网')
})

test('an explicit answer is remembered: bound true / false, or a 4xx refusal other than 401 / 429', async () => {
  assert.equal(await answerOnce({ code: 403, msg: '账号不可用' }), '', '403：明确拒绝，不再问')
  assert.equal(await answerOnce({ code: 422, msg: '邀请码不对' }), '', '422：明确拒绝，不再问')
  assert.equal(await answerOnce({ code: 200, data: { bound: false, message: '你已经绑定过邀请人了，不能再改' } }), '')
})

test('a late answer for an old code does not swallow a newer friend link opened meanwhile', async () => {
  const { requests } = runtime()
  request.setToken('token-4')
  invite.captureInviter({ query: { inviter: 'K7M2PQ' } })
  const first = invite.bindPendingInviter()
  await flush()
  invite.captureInviter({ query: { inviter: 'ABCDEF' } })
  reply(requests[0], { code: 200, data: { bound: false } })
  assert.equal(await first, false)
  assert.equal(invite.pendingInviter(), 'ABCDEF', '新记下的码还在等着问')
})

test('launch and returning to foreground retry a remembered unanswered code once, with at most one request in flight', async () => {
  const { requests } = runtime()
  request.setToken('token-5')
  invite.captureInviter({ query: { inviter: 'K7M2PQ' } })
  const failed = invite.bindPendingInviter()
  await flush()
  reply(requests[0], { code: 500, msg: '服务器开小差了' })
  assert.equal(await failed, false)

  // 冷启动：onLaunch、onShow 一起触发（启动参数里已经没有邀请码），等登录态恢复后只发一次
  let restored
  const ready = new Promise(resolve => { restored = resolve })
  const launch = invite.noteInviter({ query: {} }, () => ready)
  const show = invite.noteInviter({ query: {} }, () => ready)
  await flush()
  assert.equal(requests.length, 1, '登录态恢复之前不发请求')
  restored()
  await flush()
  assert.equal(requests.length, 2, 'onLaunch + onShow 合成一次请求')
  assert.equal(requests[1].data.code, 'K7M2PQ')
  reply(requests[1], { code: 429, msg: '操作太频繁，请稍后再试' })
  assert.deepEqual(await Promise.all([launch, show]), [false, false])
  assert.equal(invite.pendingInviter(), 'K7M2PQ', '还是没得到明确答复，留着')

  // 切回前台：再试一次，这回绑上了
  const foreground = invite.noteInviter({ query: {} }, () => Promise.resolve())
  await flush()
  assert.equal(requests.length, 3)
  reply(requests[2], { code: 200, data: { bound: true } })
  assert.equal(await foreground, true)

  // 已经答复过：之后启动 / 切回前台都不再请求
  assert.equal(await invite.noteInviter({ query: { inviter: 'K7M2PQ' } }, () => Promise.resolve()), false)
  assert.equal(requests.length, 3)
})

test('a guest launching the app with a remembered code sends nothing until login', async () => {
  const { requests } = runtime()
  invite.captureInviter({ query: { inviter: 'K7M2PQ' } })
  assert.equal(await invite.noteInviter({ query: {} }, () => Promise.resolve()), false)
  assert.equal(requests.length, 0, '没登录不发请求')
  assert.equal(invite.pendingInviter(), 'K7M2PQ', '登录后再问')
})
