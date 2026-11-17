import { chromium } from 'playwright'
const browser = await chromium.launch({ headless: true })
const page = await browser.newPage({ viewport: { width: 390, height: 844 } })
const logs = []
page.on('console', m => logs.push(m.type() + ': ' + m.text().slice(0, 300)))
page.on('pageerror', e => logs.push('PAGEERROR: ' + e.message))
page.on('requestfailed', r => logs.push('REQFAIL: ' + r.url()))
await page.goto('http://127.0.0.1:5173/#/pages/staff/activities?s=1', { waitUntil: 'networkidle' })
await page.waitForTimeout(2500)
console.log(logs.join('\n'))
console.log('html len', (await page.content()).length, (await page.content()).slice(0, 1500))
await browser.close()
