/** Local real HTTP + Chromium regression. Login/phone/payment channels remain mock. */
import { chromium } from 'playwright'
import assert from 'node:assert/strict'
import { readFile, mkdir, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
const F = JSON.parse(await readFile(new URL('../../.dev/fullflow-fixture.json', import.meta.url), 'utf8'))
const OUT = new URL('../../artifacts/full-flow-20261001/browser/', import.meta.url)
await mkdir(OUT, { recursive: true })
const API = process.env.FLOW_API_BASE || process.env.KG_BASE || 'http://localhost:8080', BASE = 'http://127.0.0.1:5273/'
async function api(path, { method = 'GET', body, token = F.u.mgr[0], admin = false } = {}) {
  const r = await fetch(API + path, { method, headers: { 'Content-Type': 'application/json', ...(admin ? { Authorization: `Bearer ${F.admin}` } : { 'X-App-Token': token }) }, body: body ? JSON.stringify(body) : undefined })
  return r.json()
}
assert.equal((await api('/app/auth/ping')).data.wxMock, true)
// Only localhost is used in this regression; desktop proxy settings must not intercept its module requests.
const browser = await chromium.launch({ headless: true, args: ['--no-proxy-server'] })
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, timezoneId: 'Asia/Shanghai', locale: 'zh-CN' })
page.setDefaultTimeout(15000)
page.setDefaultNavigationTimeout(30000)
const errors = [], failedRequests = [], steps = []
const pending = new Set()
page.on('request', r => pending.add(r.url().split('?')[0]))
page.on('requestfinished', r => pending.delete(r.url().split('?')[0]))
page.on('requestfailed', r => pending.delete(r.url().split('?')[0]))
page.on('pageerror', e => errors.push(e.message))
page.on('requestfailed', r => { if (r.url().includes('/app/') && r.failure()?.errorText !== 'net::ERR_ABORTED') failedRequests.push({ url: r.url().split('?')[0], failure: r.failure() }) })
const open = async (route, token = F.u.mgr[0]) => {
  await page.goto(BASE)
  await page.evaluate(token => localStorage.setItem('kangaroo:app-token', JSON.stringify({ type: 'string', data: token })), token)
  await page.goto(BASE + '#' + route)
  await page.reload()
  await page.locator('uni-page-body .k-page').first().waitFor({ timeout: 20000 })
  await page.waitForLoadState('networkidle')
}
const text = value => page.getByText(value, { exact: true }).first()
const sheetChoice = async value => { const x = page.locator('.uni-actionsheet__cell').filter({ hasText: value }).first(); await x.waitFor(); await x.click() }
const shot = name => page.screenshot({ path: fileURLToPath(new URL(name + '.png', OUT)), fullPage: true })
async function step(name, fn) { await fn(); steps.push(name); console.log('PASS ' + name) }
try {
  await step('B01 draft edit-save-reload preserves year, employee, hours and priority', async () => {
    await open('/pages/manage/tasks?taskId=' + F.draft)
    await sheetChoice('编辑并发布')
    await text('2 小时').waitFor()
    assert.match(await page.locator('.assign-card').innerText(), /回归员工/)
    await shot('draft-before-save')
    const [saved] = await Promise.all([
      page.waitForResponse(r => r.url().endsWith('/app/manage/tasks') && r.request().method() === 'POST'),
      page.locator('.k-button').filter({ hasText: '存草稿' }).click()
    ])
    assert.equal((await saved.json()).code, 200)
    const d = (await api('/app/manage/tasks/' + F.draft)).data
    assert.deepEqual([String(d.taskDate).slice(0, 10), d.estHours, d.priority, d.assignees.map(a => a.userId)], [F.draftBody.taskDate, 2, 'high', [F.u.staff[1]]])
    await open('/pages/manage/tasks?taskId=' + F.draft)
    await sheetChoice('编辑并发布')
    await text('2 小时').waitFor()
  })
  await step('B02 review date filter calls API, changes results, and shows actual score stars', async () => {
    await open('/pages/jobs/team?s=4&storeId=' + F.A + '&stayId=' + F.stay + '&filter=' + encodeURIComponent('住宿'))
    await page.locator('.shop-review').first().waitFor()
    const d = (await api('/app/stores/' + F.A + '/reviews')).data
    const stars = '★'.repeat(Math.round(d.avg)) + '☆'.repeat(5 - Math.round(d.avg))
    assert.equal((await page.locator('.score').innerText()).includes(stars), true)
    await text('全部时间').click()
    const response = page.waitForResponse(r => r.url().includes('/reviews?') && r.url().includes('days=30'))
    await sheetChoice('近30天')
    assert.equal((await (await response).json()).data.filteredTotal, 51)
    await text('近30天').waitFor()
    await shot('reviews-filter')
  })
  await step('B03 stay review link opens actual stay-scoped reviews', async () => {
    await open('/pages/stays/detail?stayId=' + F.stay + '&s=3')
    await page.locator('.review-head').getByText('查看全部', { exact: true }).click()
    await page.waitForURL('**/pages/jobs/team?**')
    assert.ok(page.url().includes('stayId=' + F.stay))
    await page.locator('.shop-review').first().waitFor()
  })
  await step('B04 room selection filters and price sorting operate', async () => {
    const roomName = '浏览器筛选房型-' + F.A + '-' + Date.now()
    const created = await api('/kangaroo/ext/roomtype', { method: 'POST', admin: true, body: { stayId: F.stay, typeName: roomName, roomKind: 'private', unitLabel: '间', capacity: 1, stock: 3, basePriceFen: 19900, bedDesc: '单人床', status: '0' } })
    assert.equal(created.code, 200)
    await open('/pages/stays/booking?stayId=' + F.stay)
    await page.locator('.type-card').first().waitFor()
    assert.ok(await page.locator('.type-card').count() >= 2)
    await text('全部房型').click(); await sheetChoice(roomName)
    assert.equal(await page.locator('.type-card').count(), 1)
    assert.match(await page.locator('.type-card').innerText(), new RegExp(roomName))
    await page.locator('.filters>uni-view').first().click(); await sheetChoice('全部房型')
    await text('排序').click(); await sheetChoice('价格从高到低')
    const prices = await page.locator('.type-price').allTextContents()
    const nums = prices.map(x => Number(x.match(/[\d.]+/)[0]))
    assert.ok(nums.every((n, i) => i === 0 || nums[i - 1] >= n))
    await text('床型').click(); await sheetChoice('单人床')
    assert.ok((await page.locator('.type-main').allTextContents()).every(x => x.includes('单人床')))
    await shot('room-filters')
  })
  await step('B05 job filter chip opens filter form', async () => {
    await open('/pages/jobs/list')
    await page.locator('.chips .chip').first().click()
    await page.waitForURL('**/pages/jobs/filter?**')
  })
  await step('B06 stay order re-entry resumes persisted activity selection', async () => {
    const route='/pages/stays/order?orderNo='+F.selectionOrder+'&view=trip'
    await open(route,F.u.payee2[0])
    const card=page.locator('.selected-activities__row').filter({hasText:'尚未完成报名'})
    await card.waitFor(); await shot('activity-selection-pending')
    const [response]=await Promise.all([
      page.waitForResponse(r=>r.url().includes('/activities/'+F.selectionActivity) && r.request().method()==='POST'),
      card.locator('.k-button').click()
    ])
    assert.equal((await response.json()).code,200)
    await open(route,F.u.payee2[0])
    assert.equal(await page.locator('.selected-activities__row').filter({hasText:'尚未完成报名'}).count(),0)
    await page.locator('.selected-activities__row').filter({hasText:'已报名'}).waitFor()
    await shot('activity-selection-reloaded')
  })
  assert.deepEqual(errors, [], 'browser runtime errors')
  assert.deepEqual(failedRequests, [], 'failed backend network requests')
  console.log(`浏览器业务步骤 ${steps.length}/${steps.length} 通过（H5 + 本地 Mock 微信）`)
} catch (e) {
  await shot('failure')
  console.error(e)
  console.error('Pending requests:', [...pending])
  process.exitCode = 1
} finally {
  await writeFile(new URL('result.json', OUT), JSON.stringify({ time: new Date().toISOString(), steps, errors, failedRequests, exitCode: process.exitCode || 0 }, null, 2))
  await browser.close()
}
