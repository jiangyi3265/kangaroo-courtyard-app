import test from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'vite'
const server = await createServer({ configFile: false, server: { middlewareMode: true } })
const {
  experience, acceptAuthenticatedAccount, logout, hasStaffAccess,
  switchMode, savePreferences, saveAllCities, visibleMessages, unreadCount, markMessageRead, loginWithWeixin,
  loadApplicationDraft, saveApplicationDraft
} = await server.ssrLoadModule('/common/experience.js')
const { default: R } = await server.ssrLoadModule('/common/routes.js')
await server.close()

const storage = new Map()
globalThis.uni = { getStorageSync: key => storage.get(key), setStorageSync: (key, value) => storage.set(key, value) }

test('new users go straight home without preferences, resume, or staff grants', () => {
  logout()
  // 只能走服务端返回的账号这一条路进登录态。原先这里用的是 enterUserPreview()，
  // 那是个凭空造账号的本地预览入口，已经删掉 —— 留着就等于留了一条假登录后门。
  assert.equal(acceptAuthenticatedAccount({ id: 'fresh-user', staffGrants: [] }), R.home)
  assert.deepEqual(experience.cities, [])
  assert.equal(hasStaffAccess.value, false)
  assert.equal(switchMode('staff'), R.identity)
  assert.equal(unreadCount.value, 0)
})

test('experience.js exposes no way to fabricate an account without the server', async () => {
  const mod = await import('node:fs')
  const src = mod.readFileSync(new URL('../common/experience.js', import.meta.url), 'utf8')
  // 登录态只能由 acceptAuthenticatedAccount 接收服务端数据后建立。
  // 任何"自己造一个 account 对象再塞进去"的导出函数都是绕过服务端鉴权的后门，
  // 这条断言就是防止它被重新加回来。
  assert.equal(/enterUserPreview|local-preview/.test(src), false,
    'experience.js 里出现了本地预览账号的痕迹')
  const fabricators = src.match(/acceptAuthenticatedAccount\(\s*\{/g) || []
  assert.deepEqual(fabricators, [],
    'experience.js 里有代码直接用字面量对象调用 acceptAuthenticatedAccount')
})

test('authenticated active staff grants route directly to work; revoked grants do not', () => {
  assert.equal(acceptAuthenticatedAccount({ id: 'employee', staffGrants: [{ active: true }] }), R.staff)
  assert.equal(switchMode('user'), R.home)
  assert.equal(switchMode('staff'), R.staff)
  assert.equal(acceptAuthenticatedAccount({ id: 'employee', staffGrants: [{ active: false }] }), R.home)
  assert.equal(switchMode('staff'), R.identity)
})

test('preferences and application drafts are isolated by account and survive relogin', () => {
  acceptAuthenticatedAccount({ id: 'alice' })
  savePreferences(['大理'])
  saveApplicationDraft({ name: '测试用户', days: '7' })
  acceptAuthenticatedAccount({ id: 'bob' })
  assert.deepEqual(experience.cities, [])
  assert.deepEqual(loadApplicationDraft(), {})
  acceptAuthenticatedAccount({ id: 'alice' })
  assert.deepEqual(experience.cities, ['大理'])
  assert.equal(loadApplicationDraft().days, '7')
  savePreferences([])
  assert.deepEqual(experience.cities, [])
})

test('首页「全部城市」只是一个按账号记的开关：兴趣城市列表不动，换账号 / 重新登录后各是各的', () => {
  acceptAuthenticatedAccount({ id: 'carol' })
  savePreferences(['平潭', '大理'])
  assert.equal(experience.allCities, false)
  saveAllCities(true)
  assert.equal(experience.allCities, true)
  assert.deepEqual(experience.cities, ['平潭', '大理'], '社区、订房、选兴趣城市页用的列表还在')
  acceptAuthenticatedAccount({ id: 'dave' })
  assert.equal(experience.allCities, false)
  acceptAuthenticatedAccount({ id: 'carol' })
  assert.equal(experience.allCities, true)
  assert.deepEqual(experience.cities, ['平潭', '大理'])
  saveAllCities(false)
  acceptAuthenticatedAccount({ id: 'carol' })
  assert.equal(experience.allCities, false)
})

// 游客登录：兴趣城市和首页的「全部城市」开关一起搬到还没有偏好的新账号；账号自己有兴趣城市时都不动
async function loginAs(accountId) {
  const plain = globalThis.uni
  const requests = []
  globalThis.uni = {
    ...plain, removeStorageSync: key => storage.delete(key),
    login: options => options.success({ code: 'wx-login-code' }),
    request: options => requests.push(options)
  }
  try {
    const pending = loginWithWeixin()
    await new Promise(resolve => setImmediate(resolve))
    assert.equal(requests.length, 1)
    requests[0].success({ data: { code: 200, token: 'token-' + accountId, account: { id: accountId, staffGrants: [] } } })
    await pending
  } finally {
    globalThis.uni = plain
  }
}

test('游客选了「全部城市」再登录：新账号还没有偏好时，兴趣城市和「全部城市」开关一起搬过去（之前只搬城市，首页又变回平潭）', async () => {
  logout()
  savePreferences(['平潭'])
  saveAllCities(true)
  await loginAs('guest-all-1')
  assert.deepEqual(experience.cities, ['平潭'])
  assert.equal(experience.allCities, true, '首页仍是全部城市')
  assert.equal(storage.get('kangaroo:guest-all-1:all-cities'), true, '记在新账号名下，下次打开还在')
  // 游客选的是某个城市（开关是关的）：账号里残留的开关也跟着游客的选择关掉
  logout()
  storage.set('kangaroo:guest-all-2:all-cities', true)
  savePreferences(['大理'])
  saveAllCities(false)
  await loginAs('guest-all-2')
  assert.deepEqual(experience.cities, ['大理'])
  assert.equal(experience.allCities, false)
})

test('老账号自己有兴趣城市：登录时不拿游客的城市和「全部城市」开关覆盖', async () => {
  acceptAuthenticatedAccount({ id: 'returning' })
  savePreferences(['成都'])
  saveAllCities(false)
  logout()
  savePreferences(['平潭'])
  saveAllCities(true)
  await loginAs('returning')
  assert.deepEqual(experience.cities, ['成都'])
  assert.equal(experience.allCities, false)
  logout()
})

test('notifications and unread counts only include the active recipient and mode', () => {
  acceptAuthenticatedAccount({ id: 'alice', staffGrants: [{ active: true }] })
  switchMode('user')
  experience.messages = [
    { id: 'own', recipientId: 'alice', category: '系统', read: false },
    { id: 'other', recipientId: 'bob', category: '订单', read: false },
    { id: 'work', recipientId: 'alice', mode: 'staff', read: false }
  ]
  assert.deepEqual(visibleMessages.value.map(m => m.id), ['own'])
  assert.equal(unreadCount.value, 1)
  markMessageRead('other')
  assert.equal(experience.messages[1].read, false)
  markMessageRead('own')
  assert.equal(unreadCount.value, 0)
  // Preserve the computed-mode assertion independently of cache invalidation.
  experience.mode = 'staff'
  assert.equal(unreadCount.value, 1)
  switchMode('staff')
  assert.deepEqual(visibleMessages.value, [])
  assert.equal(unreadCount.value, 0)
  logout()
  assert.equal(unreadCount.value, 0)
  assert.deepEqual(visibleMessages.value, [])
})

test('a granted account can choose user mode and keep it across same-account refreshes', () => {
  const dual = (staffGrants = [{ active: true }]) => ({ id: 'dual', staffGrants })
  acceptAuthenticatedAccount(dual())
  assert.equal(experience.mode, 'staff')
  assert.equal(switchMode('user'), R.home)
  // 改昵称 / 头像、刷新授权后的账号回写：身份不能被顺带切回员工
  acceptAuthenticatedAccount(dual(), { preserveMode: true })
  assert.equal(experience.mode, 'user')
  assert.equal(switchMode('staff'), R.staff)
  acceptAuthenticatedAccount(dual(), { preserveMode: true })
  assert.equal(experience.mode, 'staff')
  // 授权被撤销时即使要求保留身份，也只能回到用户身份
  acceptAuthenticatedAccount(dual([]), { preserveMode: true })
  assert.equal(experience.mode, 'user')
  logout()
})
