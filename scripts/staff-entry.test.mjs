import test from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'vite'

const vite = await createServer({ configFile: false, server: { middlewareMode: true, hmr: false } })
const session = await vite.ssrLoadModule('/common/experience.js')
const request = await vite.ssrLoadModule('/common/request.js')
const { default: R } = await vite.ssrLoadModule('/common/routes.js')
await vite.close()

const staff = () => ({ id: 'employee', staffGrants: [{ id: 1, storeId: 102, active: true }] })
const ordinary = () => ({ id: 'employee', staffGrants: [] })
let calls, response, loginAccount
test.beforeEach(() => {
  const storage = new Map()
  calls = []
  response = { code: 200, data: staff() }
  loginAccount = staff()
  globalThis.uni = {
    getStorageSync: key => storage.get(key),
    setStorageSync: (key, value) => storage.set(key, value),
    removeStorageSync: key => storage.delete(key),
    login: options => { calls.push('wx.login'); options.success({ code: 'wx-once' }) },
    request: options => {
      const path = new URL(options.url).pathname
      calls.push(path)
      if (path === '/app/auth/wx-login') options.success({ data: { code: 200, token: 'new-token', account: loginAccount } })
      else options.success({ data: response })
    }
  }
  session.logout()
})

test('welcome staff entry authenticates and enters work directly without phone binding', async () => {
  assert.equal(await session.resolveStaffEntry({ authenticate: true }), R.staff)
  assert.deepEqual(calls, ['wx.login', '/app/auth/wx-login'])
  assert.equal(session.experience.mode, 'staff')
})

test('new server grant replaces stale no-access state without a second login', async () => {
  request.setToken('existing-token')
  session.acceptAuthenticatedAccount(ordinary())
  assert.equal(await session.resolveStaffEntry(), R.staff)
  assert.deepEqual(calls, ['/app/auth/account'])
})

test('revoked grants cannot reuse cached staff access', async () => {
  request.setToken('existing-token')
  session.acceptAuthenticatedAccount(staff())
  response.data = ordinary()
  assert.equal(await session.resolveStaffEntry(), R.identity)
  assert.equal(session.hasStaffAccess.value, false)
})

test('guest profile entry carries staff intent to login', async () => {
  assert.equal(await session.resolveStaffEntry(), R.login + '?entry=staff')
  assert.deepEqual(calls, [])
})

test('expired token can authenticate directly from welcome staff entry', async () => {
  request.setToken('expired-token')
  response = { code: 401, msg: '登录已失效' }
  assert.equal(await session.resolveStaffEntry({ authenticate: true }), R.staff)
  assert.deepEqual(calls, ['/app/auth/account', 'wx.login', '/app/auth/wx-login'])
})

test('ungranted login is rejected and later authorization can be refreshed', async () => {
  loginAccount = ordinary()
  assert.equal(await session.resolveStaffEntry({ authenticate: true }), R.identity)
  assert.equal(await session.resolveStaffEntry({ authenticate: true }), R.staff)
  assert.equal(calls.filter(x => x === 'wx.login').length, 1)
})

test('network failure preserves account and does not route or start another login', async () => {
  request.setToken('existing-token')
  session.acceptAuthenticatedAccount(staff())
  globalThis.uni.request = options => options.fail({ errMsg: 'request:fail' })
  await assert.rejects(session.resolveStaffEntry({ authenticate: true }), /网络连接失败/)
  assert.equal(request.getToken(), 'existing-token')
  assert.equal(session.experience.account.id, 'employee')
  assert.deepEqual(calls, [])
})

test('leaving a page or logging out during lookup prevents late navigation or login', async () => {
  for (const leave of ['page', 'logout']) {
    request.setToken('existing-token')
    session.acceptAuthenticatedAccount(ordinary())
    let finish, active = true
    globalThis.uni.request = options => { finish = () => options.success({ data: { code: 200, data: staff() } }) }
    const pending = session.resolveStaffEntry({ authenticate: true, isCurrent: () => active })
    if (leave === 'page') active = false
    else session.logout()
    finish()
    await assert.rejects(pending, /登录状态已变化/)
    assert.equal(session.hasStaffAccess.value, false)
  }
})

// ---- 员工切回用户身份 ----
test('account refresh keeps a dual-role account in the mode the user chose', async () => {
  request.setToken('existing-token')
  session.acceptAuthenticatedAccount(staff())
  session.switchMode('user')
  await session.refreshAccount()
  assert.equal(session.experience.mode, 'user')
  assert.equal(session.hasStaffAccess.value, true)
  // 个人中心改昵称 / 头像后的账号回写同样保留当前身份
  session.acceptAuthenticatedAccount(staff(), { preserveMode: true })
  assert.equal(session.experience.mode, 'user')
  assert.deepEqual(calls, ['/app/auth/account'])
})

test('concurrent account refreshes share one request', async () => {
  request.setToken('existing-token')
  session.acceptAuthenticatedAccount(staff())
  await Promise.all([session.refreshAccount(), session.refreshAccount(), session.refreshAccount()])
  assert.deepEqual(calls, ['/app/auth/account'])
})

test('staff profile returns to the user home and explicit identity selection waits for a choice', async () => {
  const fs = await import('node:fs')
  const read = path => fs.readFileSync(new URL('../' + path, import.meta.url), 'utf8')
  const profile = read('pages/profile/index.vue')
  const identity = read('pages/auth/identity.vue')
  assert.match(profile, /if \(staffMode\.value\) return relaunch\(switchMode\('user'\)\)/)
  assert.match(profile, /acceptAuthenticatedAccount\(res\.data, \{ preserveMode: true \}\)/)
  assert.match(identity, /choosing = q\?\.choose === '1'/)
  assert.match(identity, /onShow\(\(\) => \(choosing \? refreshGrants\(\) : enterStaff\(\)\)\)/)
  // 选择模式下的刷新只读授权，不切身份、不跳转
  const refresh = identity.slice(identity.indexOf('const refreshGrants'), identity.indexOf('const enterUser'))
  assert.equal(/relaunch|switchMode|resolveStaffEntry/.test(refresh), false)
})

// ---- 2026-10-19 主人：「把员工端入口去掉，我给他权限之后，他的手机才会有员工端」 ----
test('no public staff entry: welcome page shows 员工入口 only for staff links, workbench card only with an active grant', async () => {
  const fs = await import('node:fs')
  const read = path => fs.readFileSync(new URL('../' + path, import.meta.url), 'utf8')
  const login = read('pages/auth/login.vue')
  const tpl = login.slice(0, login.indexOf('<script'))
  // 欢迎页是小程序启动页，人人都看得到：「员工入口」只在员工页链接带进来（?entry=staff）时出现
  const buttons = tpl.split('\n').filter(l => l.includes("'员工入口'"))
  assert.equal(buttons.length, 1)
  assert.match(buttons[0], /<k-button v-if="employeeEntry" /)
  assert.match(login, /employeeEntry\.value = q\.entry === 'staff'/)
  // 被授权的员工照常一键登录：有生效授权直接进工作台，没有授权去首页（或退回原页面）
  assert.match(login, /relaunch\(hasStaffAccess\.value \? switchMode\('staff'\) : R\.home\)/)
  // 「我的」里的员工工作台卡片只给有生效授权的账号（hasStaffAccess = staffGrants 里有 active）
  const profile = read('pages/profile/index.vue')
  assert.match(profile, /<view v-if="hasStaffAccess" class="card staff"/)
  assert.equal(session.hasStaffAccess.value, false)
  session.acceptAuthenticatedAccount({ id: 'u', staffGrants: [{ id: 9, storeId: 1, active: false }] })
  assert.equal(session.hasStaffAccess.value, false, '已撤销 / 未生效的授权不算')
  // 首页不链到员工页；底栏只有员工身份才换成工作台那一套
  const home = read('pages/home/index.vue')
  assert.equal(/R\.staff\w*|\/pages\/staff\/|员工入口|员工端/.test(home), false)
  const tabbar = read('components/k-tabbar/k-tabbar.vue')
  assert.match(tabbar, /props\.mode === 'staff' \? staffItems\.value : userItems\.value/)
})

// ---- 授权在会话中途失效 ----
const twoStores = () => ({ id: 'employee', staffGrants: [
  { id: 1, storeId: 102, storeName: '平潭袋鼠小院', roleCode: 'manager', active: true },
  { id: 2, storeId: 104, storeName: '丽江袋鼠小院', roleCode: 'keeper', active: true }
] })
const flush = () => new Promise(resolve => setTimeout(resolve, 5))
let modals, launches
function staffSession({ accountResponse, forbidden = '没有该门店的操作权限' }) {
  request.setToken('existing-token')
  session.acceptAuthenticatedAccount(twoStores())
  session.switchMode('staff')
  session.setStaffStore(102)
  calls.length = 0
  modals = []
  launches = []
  globalThis.getCurrentPages = () => [{ route: 'pages/staff/index' }]
  globalThis.uni.showModal = options => { modals.push(options); options.complete?.() }
  globalThis.uni.reLaunch = options => launches.push(options.url)
  globalThis.uni.request = options => {
    const path = new URL(options.url).pathname
    calls.push(path)
    if (path === '/app/auth/account') {
      if (accountResponse === 'offline') options.fail({ errMsg: 'request:fail' })
      else options.success({ data: { code: 200, data: accountResponse } })
    } else options.success({ data: { code: 403, msg: forbidden } })
  }
}
test.afterEach(() => { delete globalThis.getCurrentPages })

test('revoked current store falls back to a still-valid store once and returns to its workbench', async () => {
  staffSession({ accountResponse: { id: 'employee', staffGrants: [twoStores().staffGrants[1]] } })
  const results = await Promise.allSettled([
    request.get('/app/staff/workbench/home', { storeId: 102 }),
    request.get('/app/staff/workbench/todos', { storeId: 102 }),
    request.get('/app/staff/team/hub', { storeId: 102 })
  ])
  assert.ok(results.every(r => r.status === 'rejected' && r.reason.code === 403), '页面仍拿到服务端的拒绝原因')
  await flush()
  assert.equal(calls.filter(x => x === '/app/auth/account').length, 1, '并发 403 只刷新一次账号')
  assert.equal(session.currentStaffStoreId(), 104)
  assert.equal(session.experience.mode, 'staff')
  assert.equal(modals.length, 1)
  assert.match(modals[0].content, /平潭袋鼠小院.*丽江袋鼠小院/)
  assert.deepEqual(launches, [R.staff])
})

test('losing every store returns the account to user mode and the identity page', async () => {
  staffSession({ accountResponse: { id: 'employee', staffGrants: [] } })
  await assert.rejects(request.post('/app/manage/daily/entries', { storeId: 102, amountFen: 100 }), e => e.code === 403)
  await flush()
  assert.equal(session.hasStaffAccess.value, false)
  assert.equal(session.experience.mode, 'user')
  assert.match(modals[0].content, /用户身份/)
  assert.deepEqual(launches, [R.identity])
})

test('a role or business 403 with unchanged grants neither navigates nor loops', async () => {
  staffSession({ accountResponse: twoStores(), forbidden: '仅门店主理人或管家可以查看经营数据' })
  await assert.rejects(request.get('/app/manage/daily', { storeId: 102 }), e => e.code === 403)
  await flush()
  await assert.rejects(request.get('/app/manage/daily', { storeId: 102 }), e => e.code === 403)
  await flush()
  assert.equal(calls.filter(x => x === '/app/auth/account').length, 1, '短时间内重复的业务 403 不再刷新账号')
  assert.equal(session.currentStaffStoreId(), 102)
  assert.deepEqual(modals, [])
  assert.deepEqual(launches, [])
})

test('a link to a store the account no longer has returns to the valid workbench', async () => {
  staffSession({ accountResponse: twoStores() })
  await assert.rejects(request.get('/app/manage/daily', { storeId: 105 }), e => e.code === 403)
  await flush()
  assert.equal(session.currentStaffStoreId(), 102)
  assert.equal(modals.length, 1)
  assert.deepEqual(launches, [R.staff])
})

test('non-staff APIs, user mode and failed refreshes leave the session untouched', async () => {
  staffSession({ accountResponse: { id: 'employee', staffGrants: [] } })
  await assert.rejects(request.get('/app/activities/7/manage'), e => e.code === 403)
  session.switchMode('user')
  await assert.rejects(request.get('/app/manage/tasks/9'), e => e.code === 403)
  await flush()
  assert.equal(calls.includes('/app/auth/account'), false)
  session.switchMode('staff')
  staffSession({ accountResponse: 'offline' })
  await assert.rejects(request.get('/app/staff/workbench/home', { storeId: 102 }), e => e.code === 403)
  await flush()
  assert.equal(session.experience.account.id, 'employee')
  assert.equal(session.currentStaffStoreId(), 102)
  assert.deepEqual(launches, [])
})

test('a late 403 from a previous token cannot trigger a recheck for the new session', async () => {
  staffSession({ accountResponse: { id: 'employee', staffGrants: [] } })
  let finish
  globalThis.uni.request = options => {
    calls.push(new URL(options.url).pathname)
    finish = () => options.success({ data: { code: 403, msg: '没有该门店的操作权限' } })
  }
  const pending = request.get('/app/staff/workbench/home', { storeId: 102 })
  request.setToken('another-token')
  finish()
  await assert.rejects(pending, e => e.code === 403)
  await flush()
  assert.deepEqual(calls, ['/app/staff/workbench/home'])
  assert.equal(session.currentStaffStoreId(), 102)
})
