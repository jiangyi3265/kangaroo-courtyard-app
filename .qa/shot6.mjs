// 用法: node .qa/shot.mjs "/pages/auth/login?s=2" out.png [--full] [--wait 600] [--click "text=先逛逛"]
// 需要 dev 服务器运行在 http://127.0.0.1:5173（pnpm dev:h5）。视口 390×844。
import { chromium } from 'playwright'
import path from 'node:path'

const argv = process.argv.slice(2)
const route = argv[0]
const out = argv[1] || 'shot.png'
const full = argv.includes('--full')
const wait = argv.includes('--wait') ? Number(argv[argv.indexOf('--wait') + 1]) : 500
const clicks = []
argv.forEach((a, i) => { if (a === '--click') clicks.push(argv[i + 1]) })

const browser = await chromium.launch({ headless: true })
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 1 })
const page = await context.newPage()
const errors = []
page.on('pageerror', e => errors.push(e.message))
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()) })
await page.goto(`http://[::1]:5173/#${route}`, { waitUntil: 'networkidle' })
await page.waitForTimeout(wait)
for (const c of clicks) { await page.click(c); await page.waitForTimeout(350) }
const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)
await page.screenshot({ path: path.resolve(out), fullPage: full })
await browser.close()
console.log(JSON.stringify({ route, out, overflowX: overflow, errors }))
