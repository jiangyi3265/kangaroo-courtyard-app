// 求职者候场页回归：面试开始后能进入"面试后反馈"并提交；开始前只能复制会议信息（认出腾讯会议号时在会议卡片上复制会议号）。
// 全部接口用本地假数据，所有发往非本机地址的请求一律拦截，不会有真实提交。
// 用法（在 袋鼠旅游2 目录下，先用静态服务把 dist/build/h5 挂到 5391 端口）：
//   node scripts/check-interview-feedback.mjs
import assert from 'node:assert/strict'
import { mkdir, writeFile } from 'node:fs/promises'
import { chromium } from 'playwright/test'

const base = 'http://127.0.0.1:5391/'
const out = '../artifacts/audit-fixes-20261002/browser'
await mkdir(out, { recursive: true })
assert.ok((await fetch(base)).ok, base + ' unavailable')

const pad = (n) => String(n).padStart(2, '0')
const fmt = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:00`
const past = fmt(new Date(Date.now() - 10 * 60 * 1000))
const future = fmt(new Date(Date.now() + 2 * 24 * 3600 * 1000))
// 认不出腾讯会议号的旧自由文字（只有链接，没有 9–12 位会议号）：候场页要照旧显示原文、按钮复制整段
const OLD_MEETING = '视频面试链接：https://example.com/room/abc，进不去请联系主理人'
const cases = {
  // 201/202 的会议信息认得出腾讯会议号（common/meeting.js）：候场页显示腾讯会议卡片，
  // 底部第一个按钮只在面试开始后出现，写「面试已结束，填写反馈」
  201: { start: past, meeting: '腾讯会议：123 456 789' },
  202: { start: future, meeting: '腾讯会议：987 654 321' },
  203: { start: past, meeting: null },
  204: { start: future, meeting: null },
  205: { start: past, meeting: OLD_MEETING },
  206: { start: future, meeting: OLD_MEETING }
}

const browser = await chromium.launch({ headless: true })
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, timezoneId: 'Asia/Shanghai', permissions: ['clipboard-read', 'clipboard-write'] })
const page = await context.newPage()
const errors = [], posts = [], checks = []
page.on('pageerror', (e) => errors.push(e.message))
await page.addInitScript(() => localStorage.setItem('kangaroo:app-token', JSON.stringify({ type: 'string', data: 'interview-fixture-user' })))
await page.route('**/*', async (route) => {
  const req = route.request(), u = new URL(req.url())
  if (u.host === '127.0.0.1:5391' && !u.pathname.startsWith('/app/')) return route.continue()
  if (!u.pathname.startsWith('/app/')) return route.abort()
  const r = { code: 200, data: {}, rows: [], total: 0 }
  const m = /^\/app\/application\/(\d+)(\/.*)?$/.exec(u.pathname)
  if (m && req.method() === 'POST') { posts.push({ appId: +m[1], path: m[2], body: req.postDataJSON() }); r.msg = 'ok' }
  else if (m && cases[m[1]]) {
    const c = cases[m[1]]
    r.data = { appId: +m[1], jobId: 10, status: 'interview_booked', statusLabel: '已预约面试', interview: { interviewId: +m[1], startTime: c.start, endTime: c.start, status: 'booked', meetingInfo: c.meeting, rescheduleCount: 0, rescheduleLimit: 2 }, logs: [] }
  } else if (u.pathname === '/app/job/10') r.data = { jobId: 10, title: '前台接待', address: '平潭', salaryText: '¥150/天' }
  return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(r) })
})
const open = async (appId) => { await page.goto(`${base}?t=${Date.now()}#/pages/jobs/interview?appId=${appId}`); await page.waitForLoadState('networkidle'); await page.locator('.lobby').waitFor() }
const button = () => page.locator('.lobby-actions uni-button').first()
const card = () => page.locator('.meeting-card')
const cardButton = (label) => card().locator('uni-button').filter({ hasText: label })
// 读剪贴板确认"真的复制了什么"；每次复制前先清空，免得读到上一个用例留下的内容
const clip = () => page.evaluate(() => navigator.clipboard.readText())
const clearClip = () => page.evaluate(() => navigator.clipboard.writeText(''))

// 1. 面试已开始 + 认得出腾讯会议号：上方是腾讯会议卡片，底部第一个按钮直接写「面试已结束，填写反馈」，
//    点了不再弹「复制会议信息 / 填写反馈」的选择（入会、复制都在卡片上），直接进入第 3 屏并能提交问卷
await open(201)
assert.equal((await card().locator('.tm-title').innerText()).trim(), '腾讯会议')
assert.equal((await card().locator('.tm-code').first().innerText()).trim(), '123 456 789')
assert.equal(await cardButton('进入腾讯会议').count(), 1)
assert.equal((await button().innerText()).trim(), '面试已结束，填写反馈')
await button().click()
await page.locator('.confirm-body').waitFor()
for (const g of [0, 1, 2]) await page.locator('.confirm-group').nth(g).locator('.choice-card > uni-view').first().click()
await page.screenshot({ path: `${out}/feedback-screen.png` })
await page.locator('.confirm-body uni-button').filter({ hasText: '愿意前往' }).click()
await page.waitForTimeout(800)
const finish = posts.find((p) => p.appId === 201 && p.path === '/finish-interview')
assert.ok(finish, 'finish-interview should be posted')
assert.equal(finish.body.durationSeconds, null)
assert.ok(finish.body.understandJob && finish.body.acceptBoard && finish.body.confirmArrival)
assert.ok(posts.some((p) => p.appId === 201 && p.path === '/confirm'))
checks.push('started + Tencent meeting code: meeting card shown, bottom button goes straight to feedback screen → finish-interview and confirm posted')

// 2. 面试未开始 + 认得出腾讯会议号：底部不再有「复制会议信息」（还没开始不能填反馈，第一个按钮只剩申请改期），
//    会议号在卡片上随时可复制；H5 拉不起腾讯会议小程序，「进入腾讯会议」退成复制会议号和密码。都不进入其它屏
await open(202)
assert.equal((await card().locator('.tm-code').first().innerText()).trim(), '987 654 321')
assert.equal(await page.locator('.lobby-actions uni-button').count(), 1)
assert.notEqual((await button().innerText()).trim(), '复制会议信息')
assert.match((await button().innerText()).trim(), /^申请改期/)
await clearClip()
await cardButton('复制会议号').click()
await page.waitForTimeout(500)
assert.equal(await clip(), '987654321')
await clearClip()
await cardButton('进入腾讯会议').click()
await page.waitForTimeout(500)
assert.equal(await clip(), '腾讯会议号：987 654 321')
assert.equal(await page.locator('.confirm-body').count(), 0)
assert.equal(await page.locator('.video-body').count(), 0)
checks.push('not started + Tencent meeting code: no bottom copy/feedback button, card copies meeting code (H5 join falls back to copy), stays in lobby')

// 3. 面试已开始 + 没填会议信息：按钮可用，直接进入反馈屏（以前这种情况按钮是灰的，反馈永远交不了）
await open(203)
assert.equal(await button().getAttribute('disabled'), null)
await button().click()
await page.locator('.confirm-body').waitFor()
checks.push('started + no meeting info: button enabled, goes straight to feedback')

// 4. 面试未开始 + 没填会议信息：按钮仍是灰的
await open(204)
assert.notEqual(await button().getAttribute('disabled'), null)
checks.push('not started + no meeting info: button disabled')

// 5. 面试已开始 + 认不出会议号的旧文字：照旧显示原文，没有腾讯会议卡片；按钮「会议信息 / 填写反馈」弹出选择，
//    选「复制会议信息」复制整段并留在候场页；重新进页选「面试已结束，填写反馈」进入第 3 屏
await open(205)
await page.getByText(OLD_MEETING, { exact: true }).waitFor()
assert.equal(await card().locator('.tm-code').count(), 0)
assert.equal((await button().innerText()).trim(), '会议信息 / 填写反馈')
await clearClip()
await button().click()
await page.getByText('复制会议信息', { exact: true }).click()
await page.waitForTimeout(500)
assert.equal(await clip(), OLD_MEETING)
assert.equal(await page.locator('.confirm-body').count(), 0)
await open(205)
await button().click()
await page.getByText('面试已结束，填写反馈', { exact: true }).click()
await page.locator('.confirm-body').waitFor()
checks.push('started + unparseable old meeting text: original text shown, action sheet copies whole text or opens feedback')

// 6. 面试未开始 + 认不出会议号的旧文字：按钮仍是「复制会议信息」，只复制整段，不进入其它屏
await open(206)
assert.equal((await button().innerText()).trim(), '复制会议信息')
await clearClip()
await button().click()
await page.waitForTimeout(500)
assert.equal(await clip(), OLD_MEETING)
assert.equal(await page.locator('.confirm-body').count(), 0)
assert.equal(await page.locator('.video-body').count(), 0)
checks.push('not started + unparseable old meeting text: copy whole text only, stays in lobby')

assert.deepEqual(errors, [])
await writeFile(`${out}/result.json`, JSON.stringify({ checks, pageErrors: errors.length }, null, 2))
console.log(JSON.stringify({ checks, pageErrors: errors.length }, null, 2))
await browser.close()
