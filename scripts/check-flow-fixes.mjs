// 2026-10-02 流程修复的浏览器回归：审核进度页按真实状态分流、线上任务交付入口、面试页撤回后分流、
// 员工切回用户身份、区县选成所属城市。全部接口用本地假数据，发往非本机地址的请求一律拦截，不会有真实提交。
// 用法（在 袋鼠旅游2 目录下，先用静态服务把 dist/build/h5 挂到 5391 端口）：
//   node scripts/check-flow-fixes.mjs
import assert from 'node:assert/strict'
import { mkdir, writeFile } from 'node:fs/promises'
import { chromium } from 'playwright/test'

const base = 'http://127.0.0.1:5391/'
const out = process.env.CHECK_OUT || '../artifacts/flow-fixes-20261002/browser'
await mkdir(out, { recursive: true })
assert.ok((await fetch(base)).ok, base + ' unavailable')

const pad = (n) => String(n).padStart(2, '0')
const fmt = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:00`
const later = fmt(new Date(Date.now() + 2 * 24 * 3600 * 1000))
const apps = {
  301: { status: 'review_passed', statusLabel: '审核通过', jobType: 'online' },
  302: { status: 'interview_booked', statusLabel: '已预约面试', jobType: 'parttime', interview: { interviewId: 302, startTime: later, endTime: later, status: 'booked', meetingInfo: '腾讯会议：302', rescheduleCount: 0, rescheduleLimit: 2 } },
  303: { status: 'withdrawn', statusLabel: '已撤回', jobType: 'parttime' },
  304: { status: 'withdrawn', statusLabel: '已撤回', jobType: 'parttime' }
}
const directory = {
  hot: [],
  groups: [],
  all: [
    { name: '厦门', fullName: '厦门市', province: '福建省', level: 'city', initial: 'X', pinyin: 'xiamen', cityName: '厦门' },
    { name: '思明区', fullName: '思明区', province: '福建省', parentName: '厦门市', level: 'district', initial: 'S', pinyin: 'simingqu', searchAliases: '思明区,smq', cityName: '厦门' },
    { name: '平潭', fullName: '平潭县', province: '福建省', parentName: '福州市', level: 'destination', initial: 'P', pinyin: 'pingtan', cityName: '平潭' }
  ]
}

const browser = await chromium.launch({ headless: true })
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, timezoneId: 'Asia/Shanghai' })
const page = await context.newPage()
const errors = [], checks = [], overviews = []
page.on('pageerror', (e) => errors.push(e.message))
await page.addInitScript(() => localStorage.setItem('kangaroo:app-token', JSON.stringify({ type: 'string', data: 'flow-fixture-user' })))
await page.route('**/*', async (route) => {
  const req = route.request(), u = new URL(req.url())
  if (u.host === '127.0.0.1:5391' && !u.pathname.startsWith('/app/')) return route.continue()
  if (!u.pathname.startsWith('/app/')) return route.abort()
  const r = { code: 200, data: {}, rows: [], total: 0 }
  const m = /^\/app\/application\/(\d+)$/.exec(u.pathname)
  if (u.pathname === '/app/auth/account') r.data = { id: 9001, nickname: '测试主理人', staffGrants: [{ storeId: 102, storeName: '平潭测试门店', roleCode: 'manager', roleName: '主理人', active: true }] }
  else if (m && apps[m[1]]) r.data = { appId: +m[1], jobId: 10, appliedAt: '2026-10-01 10:00:00', logs: [], ...apps[m[1]] }
  else if (u.pathname === '/app/job/10') r.data = { jobId: 10, title: '测试岗位', address: '平潭', salaryText: '¥150/天' }
  else if (u.pathname === '/app/cities') r.data = directory
  else if (u.pathname === '/app/cities/locate') r.data = { found: false, message: '暂时无法确认所在城市，请手动选择' }
  else if (u.pathname === '/app/cities/overview') { const city = u.searchParams.get('city'); overviews.push(city); r.data = { city, label: city, jobs: 0, activities: 0, stays: 0, siblings: [] } }
  return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(r) })
})
const go = async (path) => { await page.goto(`${base}?t=${Date.now()}#/pages/${path}`); await page.waitForLoadState('networkidle') }
const hashHas = async (part, timeout = 8000) => {
  const end = Date.now() + timeout
  while (Date.now() < end) { if ((await page.evaluate(() => location.hash)).includes(part)) return true; await page.waitForTimeout(150) }
  return false
}

// 1. 线上任务审核通过：不出现约面试，按钮进交付页
await go('jobs/progress?appId=301&s=2')
await page.locator('.hero__title').filter({ hasText: '接单申请已通过' }).first().waitFor()
assert.equal(await page.getByText('请选择视频面试时间').count(), 0)
await page.screenshot({ path: `${out}/online-task-passed.png` })
await page.locator('.k-bottom uni-button, .k-bottom .k-button').filter({ hasText: '提交成果' }).first().click()
assert.ok(await hashHas('pages/jobs/deliver'), 'online task action should open the deliver page')
checks.push('online task review_passed: no interview booking, action opens deliver page')

// 2. 已约面试的报名点旧消息（?s=2）：转到面试候场页，不再让人选时间
await go('jobs/progress?appId=302&s=2')
assert.ok(await hashHas('pages/jobs/interview'), 'interview_booked should be redirected to the interview page')
await page.locator('.lobby').waitFor()
assert.equal((await page.locator('.lobby-actions uni-button').nth(1).innerText()).trim(), '申请改期 / 撤回报名')
checks.push('interview_booked opened with stale ?s=2: redirected to interview lobby with 改期 / 撤回 entry')

// 3. 已撤回的报名点旧消息（?s=2）：停在进度页的终态，没有约面试入口
await go('jobs/progress?appId=303&s=2')
await page.waitForTimeout(800)
assert.ok((await page.evaluate(() => location.hash)).includes('pages/jobs/progress'))
assert.equal(await page.getByText('请选择视频面试时间').count(), 0)
assert.ok(await page.getByText('已撤回').count() > 0, 'withdrawn status should be shown')
await page.screenshot({ path: `${out}/withdrawn-progress.png` })
checks.push('withdrawn opened with stale ?s=2: terminal status, no booking')

// 4. 已撤回的报名打开面试页：转回进度页，不再倒计时、不给改期
await go('jobs/interview?appId=304')
assert.ok(await hashHas('pages/jobs/progress'), 'withdrawn interview page should redirect to progress')
checks.push('withdrawn on interview page: redirected to progress')

// 5. 员工专门来选身份（?choose=1）：不自动跳工作台，「进入用户首页」点得到
await go('auth/identity?choose=1')
await page.waitForTimeout(2000)
assert.ok((await page.evaluate(() => location.hash)).includes('pages/auth/identity'), 'choose mode must not auto-enter the workbench')
const userBtn = page.locator('.k-button').filter({ hasText: '进入用户首页' }).first()
await userBtn.waitFor()
await page.screenshot({ path: `${out}/identity-choose.png` })
await userBtn.click()
assert.ok(!(await hashHas('pages/staff', 3000)), 'entering user mode must not land on the staff workbench')
checks.push('identity ?choose=1: stays on identity page, 进入用户首页 works')
// 其他入口（不带 choose）仍按原设计：有授权就直接进工作台
await go('auth/identity')
assert.ok(await hashHas('pages/staff'), 'identity without choose should still enter the workbench when granted')
checks.push('identity without choose: still enters workbench automatically')

// 6. 城市页搜索并选中区县：按所属城市（厦门）查询
await go('home/city?s=2')
await page.locator('.city-search input').fill('思明')
await page.locator('.alpha-group__city').filter({ hasText: '思明区' }).first().click()
const end = Date.now() + 5000
while (Date.now() < end && !overviews.includes('厦门')) await page.waitForTimeout(150)
assert.ok(overviews.includes('厦门'), 'choosing 思明区 should query 厦门, got ' + JSON.stringify(overviews))
assert.ok(!overviews.includes('思明区'))
checks.push('city search pick 思明区: overview requested for 厦门')

assert.deepEqual(errors, [])
await writeFile(`${out}/result.json`, JSON.stringify({ checks, pageErrors: errors.length }, null, 2))
console.log(JSON.stringify({ checks, pageErrors: errors.length }, null, 2))
await browser.close()
