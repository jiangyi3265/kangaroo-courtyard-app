import test from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'vite'
const server = await createServer({ configFile: false, server: { middlewareMode: true } })
const api = await server.ssrLoadModule('/common/request.js')
await server.close()
let storage = new Map(), calls = 0, cleared = 0, responses = []
globalThis.uni = {
  getStorageSync: k => storage.get(k), setStorageSync: (k,v) => storage.set(k,v), removeStorageSync: k => storage.delete(k),
  request: opts => { calls++; const item = responses.shift(); if (typeof item === 'function') item(opts); else opts.success(item) }
}
function setup(items) { responses = [...items]; calls = 0; cleared = 0; api.setToken('original'); api.setUnauthorizedHandler(() => cleared++) }
const ok = { statusCode: 200, data: { code: 200, data: { title: '平潭小院' } } }
test('城市纠纷按当前所选身份查询，个人调解沿用个人入口', async () => {
  const heard = []
  const record = opts => { heard.push(opts.header['X-Message-Scope']); opts.success(ok) }
  setup([record, record, record])
  let identity = 'city:8:city_lead'
  api.setMessageScopeProvider(() => identity)
  try {
    await api.get('/app/governance/cases', { mode: 'city', overdue: 1, cityId: 8 })
    identity = 'store:41:city_lead'
    await api.get('/app/governance/cases', { mode: 'city', cityId: 8 })
    await api.get('/app/governance/cases', { mode: 'user' })
    assert.deepEqual(heard, ['city:8:city_lead', 'store:41:city_lead', undefined])
  } finally { api.setMessageScopeProvider(() => '') }
})
test('a temporary HTML 502 recovers without clearing the login', async () => {
  setup([{ statusCode: 502, data: '<html>Bad Gateway</html>' }, ok])
  assert.deepEqual((await api.get('/app/home/feed')).data, ok.data.data)
  assert.equal(calls, 2); assert.equal(api.getToken(), 'original'); assert.equal(cleared, 0)
})
test('read retries are bounded and show a useful failure', async () => {
  setup(Array(3).fill({ statusCode: 503, data: 'unavailable' }))
  await assert.rejects(api.get('/app/home/feed'), e => e.code === 503 && /稍后/.test(e.message))
  assert.equal(calls, 3); assert.equal(cleared, 0)
})
test('writes are never replayed for gateway or network failures', async () => {
  for (const method of ['POST', 'PUT', 'DELETE']) {
    setup([{ statusCode: 502, data: 'gateway' }]); await assert.rejects(api.request({ url: '/app/action', method })); assert.equal(calls, 1)
    setup([o => o.fail({ errMsg: 'request:fail timeout' })]); await assert.rejects(api.request({ url: '/app/action', method })); assert.equal(calls, 1)
  }
})
test('account changes while waiting prevent an old request retry', async () => {
  setup([o => { o.success({ statusCode: 504 }); api.setToken('new-account') }])
  await assert.rejects(api.get('/app/me/orders'), e => e.code === 409)
  assert.equal(calls, 1); assert.equal(api.getToken(), 'new-account'); assert.equal(cleared, 0)
})
test('business refusal and malformed successful HTTP responses are not retried', async () => {
  for (const res of [{ statusCode: 200, data: { code: 403, msg: '禁止操作' } }, { statusCode: 200, data: '<html>unexpected</html>' }, { statusCode: 500, data: { code: 200 } }]) {
    setup([res]); await assert.rejects(api.get('/app/me/orders')); assert.equal(calls, 1)
  }
})
test('real session expiry still clears its own token', async () => {
  setup([{ statusCode: 200, data: { code: 401, msg: '登录过期' } }]); await assert.rejects(api.get('/app/me'))
  assert.equal(calls, 1); assert.equal(cleared, 1); assert.equal(api.getToken(), null)
})
test('network failure recovers; cancelled requests and retry opt-out do not replay', async () => {
  setup([o => o.fail({ errMsg: 'request:fail network' }), ok]); await api.get('/app/home/feed'); assert.equal(calls, 2)
  setup([o => o.fail({ errMsg: 'request:fail abort' })]); await assert.rejects(api.get('/app/home/feed')); assert.equal(calls, 1)
  setup([{ statusCode: 502 }]); await assert.rejects(api.get('/app/home/feed', null, { retry: false })); assert.equal(calls, 1)
})
