// Browser regression with explicit API fixtures; never calls production or claims real WeChat authentication.
import assert from 'node:assert/strict'
import { mkdir, writeFile } from 'node:fs/promises'
import { chromium } from 'playwright'

const base = process.env.STAFF_ENTRY_URL || 'http://127.0.0.1:5373/'
const out = '../artifacts/staff-entry-fix-20261002/browser'
await mkdir(out, { recursive: true })
const browser = await chromium.launch({ headless: true })
const checks = [], errors = [], failures = []
const grant = { id: 3, storeId: 102, storeName: '平潭袋鼠小院', roleName: '主理人', roleCode: 'manager', active: true }
let account = { id: 'test-staff', nickname: '员工入口测试', staffGrants: [grant] }
let apiCalls = [], failAccount = false, expired = false

async function setup(withToken = false, width = 390) {
  apiCalls = []
  const page = await browser.newPage({ viewport: { width, height: 844 }, isMobile: true })
  page.on('pageerror', error => errors.push(error.message))
  page.on('requestfailed', request => { if (!request.url().includes('/app/auth/account')) failures.push(request.url()) })
  if (withToken) await page.addInitScript(() => localStorage.setItem('kangaroo:app-token', JSON.stringify({ type: 'string', data: 'fixture-token' })))
  await page.route('**/app/**', async route => {
    const path = new URL(route.request().url()).pathname
    apiCalls.push(path)
    let result = { code: 200, data: {}, rows: [], total: 0, unread: 0 }
    if (path === '/app/auth/ping') result.data = { wxMock: true }
    if (path === '/app/auth/account') {
      if (failAccount) return route.abort('failed')
      result = expired ? { code: 401, msg: '登录已失效' } : { code: 200, data: account }
    }
    if (path === '/app/auth/wx-login') { expired = false; result = { code: 200, token: 'fixture-token', account } }
    if (path === '/app/me/profile') result.data = { ...account, memberNo: account.id, hasPoints: false }
    if (path === '/app/message/unread') result.data = { unread: 0 }
    if (path === '/app/staff/workbench/home') result.data = { overview: [], counts: {}, priority: [] }
    if (path === '/app/staff/workbench/todos') result.data = { groups: [], counts: {}, overdue: 0 }
    await route.fulfill({ json: result })
  })
  return page
}
async function open(page, route) {
  await page.goto(base + '#' + route)
  await page.locator('uni-page-body .k-page').waitFor()
  await page.waitForLoadState('networkidle')
}
async function workbench(page) {
  await page.waitForURL('**#/pages/staff/index')
  await page.getByText('今日概览', { exact: true }).waitFor()
}
async function capture(page, name) {
  await page.screenshot({ path: `${out}/${name}.png`, fullPage: true })
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, name + ': horizontal overflow')
}
const clickButton = (page, label) => page.locator('.k-button').filter({ has: page.getByText(label, { exact: true }) }).click()
// 有授权的账号冷启动就是员工身份（「我的」卡片写「员工身份 · 切换身份」）：经选身份页切回用户身份，再回「我的」
async function toUserMode(page) {
  await page.locator('.staff').getByText('员工身份 · 切换身份', { exact: true }).waitFor()
  await page.locator('.staff').click()
  await page.waitForURL('**#/pages/auth/identity?choose=1')
  await clickButton(page, '进入用户首页')
  await page.waitForURL('**#/pages/home/index')
  await open(page, '/pages/profile/index')
  await page.locator('.staff').getByText('已授权 · 点击进入', { exact: true }).waitFor()
}
try {
  let page = await setup()
  // 2026-10-19 主人：没被授权的人看不到员工端入口 —— 欢迎页（启动页）默认不摆「员工入口」，只有员工页链接带 ?entry=staff 进来才有
  await open(page, '/pages/auth/login')
  assert.equal(await page.getByText('员工入口', { exact: true }).count(), 0, '欢迎页不应出现员工入口')
  checks.push('欢迎页默认不显示员工入口')
  await page.close()
  // 只改 # 后面的参数时 uni 不会重新进页（onLoad 不再跑），换一个新页面打开员工链接
  page = await setup()
  await open(page, '/pages/auth/login?entry=staff')
  await clickButton(page, '员工入口')
  await page.getByText('请先阅读并同意协议', { exact: true }).waitFor()
  assert.equal(apiCalls.includes('/app/auth/wx-login'), false)
  checks.push('员工入口未同意协议时不登录')
  await page.locator('.agree .k-check').click()
  await clickButton(page, '员工入口')
  await workbench(page)
  assert.equal(apiCalls.filter(x => x === '/app/auth/wx-login').length, 1)
  assert.equal(apiCalls.includes('/app/auth/phone-verify'), false)
  checks.push('未登录员工点击员工入口直接登录进入工作台，无需用户端或重复绑手机号')
  await capture(page, 'direct-login-workbench')
  await page.close()

  page = await setup(true, 320)
  await open(page, '/pages/profile/index')
  // 有授权的账号冷启动就是员工身份：卡片写「员工身份 · 切换身份」，点了去选身份，在那里切回用户身份
  await toUserMode(page)
  await capture(page, 'authorized-profile-320')
  const before = apiCalls.filter(x => x === '/app/auth/account').length
  await page.locator('.staff').click()
  await workbench(page)
  assert.ok(apiCalls.filter(x => x === '/app/auth/account').length > before)
  assert.equal(apiCalls.includes('/app/auth/wx-login'), false)
  checks.push('已登录员工卡片显示已授权，点击刷新权限并直接进入工作台')
  await page.close()

  account = { ...account, staffGrants: [] }
  page = await setup(true)
  await open(page, '/pages/profile/index')
  // 没有授权：「我的」里根本没有员工工作台卡片（2026-10-18 起）
  assert.equal(await page.locator('.staff').count(), 0, '无授权账号不应看到员工工作台')
  account = { ...account, staffGrants: [grant] }
  // 管理员授权后，用户在小程序里换个页面再回到「我的」（onShow 静默重读账号、不改当前身份），卡片出现，点了直接进工作台
  await open(page, '/pages/home/index')
  await open(page, '/pages/profile/index')
  await page.locator('.staff').getByText('已授权 · 点击进入', { exact: true }).waitFor()
  await page.locator('.staff').click()
  await workbench(page)
  checks.push('无授权时「我的」没有员工工作台；管理员新授予权限后回到「我的」即出现并可进入，无需重新登录')
  await page.close()

  page = await setup(true)
  await open(page, '/pages/profile/index')
  await toUserMode(page)
  account = { ...account, staffGrants: [] }
  await page.locator('.staff').click()
  await page.waitForURL('**#/pages/auth/identity')
  await page.getByText('刷新员工权限', { exact: true }).waitFor()
  await page.locator('.status').filter({ hasText: '当前账号暂无员工授权' }).waitFor()
  await capture(page, 'revoked-identity')
  account = { ...account, staffGrants: [grant] }
  await clickButton(page, '刷新员工权限')
  await workbench(page)
  checks.push('撤销权限阻止旧卡片进入，恢复权限后原页可刷新进入')
  await page.close()

  page = await setup(true)
  await open(page, '/pages/profile/index')
  await toUserMode(page)
  failAccount = true
  await page.locator('.staff').click()
  await page.getByText('网络连接失败，请检查网络后重试', { exact: true }).waitFor()
  assert.ok(page.url().includes('/pages/profile/index'))
  failAccount = false
  await page.locator('uni-toast').waitFor({ state: 'hidden' })
  await page.locator('.staff').click()
  await workbench(page)
  checks.push('权限请求失败保留原页，可重试，不误判无授权')
  await page.close()

  account = { ...account, staffGrants: [] }
  page = await setup()
  await open(page, '/pages/auth/login?entry=staff')
  await page.locator('.agree .k-check').click()
  await clickButton(page, '员工入口')
  await page.getByText('当前微信账号暂无员工授权，请联系管理员授权后点击员工入口重试。', { exact: true }).waitFor()
  account = { ...account, staffGrants: [grant] }
  await clickButton(page, '员工入口')
  await workbench(page)
  assert.equal(apiCalls.filter(x => x === '/app/auth/wx-login').length, 1)
  checks.push('欢迎页无授权正确提示，后台授权后直接重试，不重复登录')
  await page.close()

  page = await setup(true)
  await open(page, '/pages/auth/identity')
  await workbench(page)
  checks.push('旧员工入口深链接刷新后直达工作台')
  await page.close()
  assert.deepEqual(errors, [])
  assert.deepEqual(failures, [])
  console.log(JSON.stringify({ scope: 'H5 browser with explicit API fixtures', checks, errors, failures }, null, 2))
} finally {
  await writeFile(`${out}/result.json`, JSON.stringify({ checks, errors, failures }, null, 2))
  await browser.close()
}
