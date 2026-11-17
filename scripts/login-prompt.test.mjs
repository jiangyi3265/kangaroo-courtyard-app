import test from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'vite'

// 写请求被 401 拒绝时问一句「去登录」（common/request.js promptLogin）：
// 游客点了提交报名、收藏、关注这类要登录的事，之前只弹「未登录或登录已失效」，没有去登录的路。
const vite = await createServer({ configFile: false, server: { middlewareMode: true, hmr: false } })
const request = await vite.ssrLoadModule('/common/request.js')
const { default: R } = await vite.ssrLoadModule('/common/routes.js')
await vite.close()

let modals, navigations, hidden, response, route
const tick = () => new Promise(resolve => setTimeout(resolve, 0))
test.beforeEach(() => {
  const storage = new Map()
  modals = []
  navigations = []
  hidden = 0
  response = { code: 401, msg: '未登录或登录已失效' }
  route = 'pages/jobs/apply'
  globalThis.getCurrentPages = () => [{ route: 'pages/jobs/detail' }, { route }]
  globalThis.uni = {
    getStorageSync: key => storage.get(key),
    setStorageSync: (key, value) => storage.set(key, value),
    removeStorageSync: key => storage.delete(key),
    hideToast: () => { hidden++ },
    showModal: options => { modals.push(options); options.success({ confirm: true }); options.complete() },
    navigateTo: options => navigations.push(options.url),
    request: options => options.success({ data: response })
  }
  request.setToken(null)
})

test('guest write rejected with 401 offers login and returns to the same page stack', async () => {
  await assert.rejects(request.post('/app/application', { jobId: 1 }), /未登录/)
  await tick()
  assert.equal(modals.length, 1)
  assert.equal(modals[0].confirmText, '去登录')
  assert.equal(hidden, 1, '页面自己的出错提示先收掉，不叠在对话框上')
  assert.deepEqual(navigations, [R.login], '压栈打开登录页，登录后能退回原页')
})

test('expired token on a write clears the session and offers login', async () => {
  request.setToken('expired')
  await assert.rejects(request.post('/app/job/favorite/1'), /未登录/)
  await tick()
  assert.equal(request.getToken(), null)
  assert.equal(modals.length, 1)
})

test('reads, explicit anonymous calls and the login page itself never prompt', async () => {
  await assert.rejects(request.get('/app/me/profile'), /未登录/)
  await assert.rejects(request.post('/app/auth/wx-login', {}, { auth: false }), /未登录/)
  route = 'pages/auth/login'
  await assert.rejects(request.post('/app/auth/phone-verify', { code: 'x' }), /未登录/)
  await tick()
  assert.equal(modals.length, 0)
})

test('a late 401 for an older session does not prompt the new session', async () => {
  request.setToken('old-token')
  globalThis.uni.request = options => {
    request.setToken('new-token')
    options.success({ data: response })
  }
  await assert.rejects(request.post('/app/application', {}), /未登录/)
  await tick()
  assert.equal(request.getToken(), 'new-token')
  assert.equal(modals.length, 0)
})

test('a page that asks about login itself is not shown a second dialog', async () => {
  // 报名页、同行页在 catch 里自己弹「请先登录」：两个对话框接连弹，后一个会顶掉页面那个，页面按钮就一直卡着
  await request.post('/app/application', {}).catch(e => { e.loginHandled = true })
  await tick()
  assert.equal(modals.length, 0)
  assert.equal(hidden, 0, '页面自己的对话框不能被收掉')
  // 认领只管这一次，之后别的写请求照常问
  await assert.rejects(request.post('/app/job/favorite/1'), /未登录/)
  await tick()
  assert.equal(modals.length, 1)
})

test('a dialog pushed away by another popup does not block later prompts', async () => {
  const realNow = Date.now
  let now = realNow()
  Date.now = () => now
  try {
    globalThis.uni.showModal = options => { modals.push(options) } // 被别的弹窗顶掉：success / complete 都不回调
    await assert.rejects(request.post('/app/job/favorite/1'), /未登录/)
    await tick()
    await assert.rejects(request.post('/app/job/favorite/1'), /未登录/)
    await tick()
    assert.equal(modals.length, 1, '刚弹过，不重复弹')
    now += 11000
    await assert.rejects(request.post('/app/job/favorite/1'), /未登录/)
    await tick()
    assert.equal(modals.length, 2)
    modals[1].complete()
  } finally {
    Date.now = realNow
  }
})

test('confirming after the app is already on the login page does not stack another one', async () => {
  globalThis.uni.showModal = options => { modals.push(options); route = 'pages/auth/login'; options.success({ confirm: true }); options.complete() }
  await assert.rejects(request.post('/app/application', {}), /未登录/)
  await tick()
  assert.equal(modals.length, 1)
  assert.deepEqual(navigations, [])
})

test('only one prompt is open at a time', async () => {
  const pending = []
  globalThis.uni.showModal = options => { modals.push(options); pending.push(options) }
  await assert.rejects(request.post('/app/job/favorite/1'), /未登录/)
  await assert.rejects(request.post('/app/stores/1/follow'), /未登录/)
  await tick()
  assert.equal(modals.length, 1)
  pending[0].success({ confirm: false })
  pending[0].complete()
  assert.deepEqual(navigations, [])
  await assert.rejects(request.post('/app/job/favorite/1'), /未登录/)
  await tick()
  assert.equal(modals.length, 2)
})
