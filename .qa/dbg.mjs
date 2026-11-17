import { chromium } from 'playwright'
const route = process.argv[2]
const browser = await chromium.launch({ headless: true })
const page = await browser.newPage({ viewport: { width: 390, height: 844 } })
page.on('console', m => console.log('[console:' + m.type() + ']', m.text().slice(0, 600)))
page.on('pageerror', e => console.log('[pageerror]', e.message))
await page.goto(`http://127.0.0.1:5173/#${route}`, { waitUntil: 'networkidle' })
await page.waitForTimeout(1200)
const html = await page.evaluate(() => document.body.innerHTML.slice(0, 1500))
console.log(html)
await browser.close()
