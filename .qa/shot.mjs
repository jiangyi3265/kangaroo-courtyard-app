// 用法: node .qa/shot.mjs "/pages/auth/login?s=2" out.png [--full] [--wait 600] [--click "text=先逛逛"]
// 需要 dev 服务器运行（pnpm dev:h5）。默认 http://127.0.0.1:5173，可用环境变量 KQA_BASE 覆盖。视口 390×844。
import { chromium } from 'playwright'
import path from 'node:path'

const argv = process.argv.slice(2)
const route = argv[0]
const out = argv[1] || 'shot.png'
const full = argv.includes('--full')
const wait = argv.includes('--wait') ? Number(argv[argv.indexOf('--wait') + 1]) : 500
const clicks = []
argv.forEach((a, i) => { if (a === '--click') clicks.push(argv[i + 1]) })
// --login: 先在同一个浏览器上下文里跑一遍真实登录流程，再打开目标页面。
// 用于给需要登录态的页面截图。走的是页面上真实的按钮，不是往 storage 里塞令牌。
const doLogin = argv.includes('--login')
// --staff: 登录时从员工入口进入（要求该账号已被授予员工授权）
const asStaff = argv.includes('--staff')
// --as <code>: 用指定的本机调试凭证登录，从而复用一个已经被授予员工授权的演示账号。
// 不是绕过鉴权：这个 code 仍要由服务端校验，只有本地联调模式才会接受。
const asCode = argv.includes('--as') ? argv[argv.indexOf('--as') + 1] : ''

const browser = await chromium.launch({ headless: true })
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 1 })
const page = await context.newPage()
const errors = []
page.on('pageerror', e => errors.push(e.message))
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()) })
const BASE = process.env.KQA_BASE || 'http://127.0.0.1:5173'

if (doLogin) {
  if (asCode) {
    // 先落地一次页面才能访问同源 localStorage
    await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' })
    await page.evaluate((c) => localStorage.setItem('kangaroo:h5-login-code', c), asCode)
  }
  await page.goto(`${BASE}/#/pages/auth/login`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(600)
  if (asStaff) {
    await page.getByText('员工入口', { exact: true }).click({ force: true })
    await page.waitForTimeout(200)
  }
  // 勾选协议
  await page.locator('.agree').first().click({ force: true })
  await page.waitForTimeout(150)
  await page.getByText(asStaff ? '员工微信登录' : '微信一键登录', { exact: true }).click({ force: true })
  await page.waitForTimeout(800)
  if (!asStaff) {
    // s=2 微信授权确认 -> s=4 手机号绑定 -> 确认绑定
    await page.getByText('允许并继续', { exact: true }).click({ force: true })
    await page.waitForTimeout(300)
    await page.getByText('确认绑定', { exact: true }).click({ force: true })
  }
  await page.waitForTimeout(1500)
}

await page.goto(`${BASE}/#${route}`, { waitUntil: 'networkidle' })
await page.waitForTimeout(wait)
for (const c of clicks) { await page.click(c); await page.waitForTimeout(350) }
const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)
await page.screenshot({ path: path.resolve(out), fullPage: full })
await browser.close()
console.log(JSON.stringify({ route, out, overflowX: overflow, errors }))
