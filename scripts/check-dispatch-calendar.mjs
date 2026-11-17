import assert from 'node:assert/strict'
import { mkdir, writeFile } from 'node:fs/promises'
import { chromium } from 'playwright'
const out = '../artifacts/dispatch-calendar-20261002'
await mkdir(out, { recursive: true })
const browser = await chromium.launch({ headless: true })
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true })
const errors = [], queries = [], checks = []
page.on('pageerror', e => errors.push(e.message))
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()) })
await page.clock.setFixedTime(new Date('2026-10-02T16:00:00Z'))
await page.addInitScript(() => localStorage.setItem('kangaroo:app-token', JSON.stringify({ type: 'string', data: 'dispatch-calendar-fixture' })))
let failedDate = '', delayedDate = ''
await page.route('**/app/**', async route => {
  const u = new URL(route.request().url()), p = u.pathname
  let data = {}, code = 200
  if (p === '/app/auth/account') data = { id: 9001, nickname: '看板测试', staffGrants: [{ active: true, role: 'owner', storeId: 102, storeName: '平潭测试门店' }] }
  else if (p === '/app/message/unread') data = { unread: 0 }
  else if (p === '/app/message/list') data = []
  else if (p === '/app/staff/dispatch/board') {
    const q = Object.fromEntries(u.searchParams); queries.push(q)
    const date = q.date || '2026-10-03', day = Number(date.slice(8))
    if (date === delayedDate) await new Promise(r => setTimeout(r, 1700))
    if (date === failedDate) code = 500
    data = { city: '平潭', date, cities: ['平潭'], cards: [{ name: q.dim === 'store' ? '平潭测试门店' : '平潭', urgent: 0, need: [day, 2, 0], arranged: [0, 0, 0], gap: [day, 2, 0] }], heat: { title: '需求热力日历（平潭）', month: `${date.slice(0, 4)}年${Number(date.slice(5, 7))}月`, cells: [{ d: day, c: 'high' }] }, topStores: [] }
  }
  await route.fulfill({ json: { code, msg: code === 200 ? '操作成功' : '看板加载失败', data } })
})
const opener = () => page.locator('.board-filters uni-button').nth(1)
const cal = () => page.locator('.calendar-panel')
const choose = date => cal().locator(`[aria-label="${date}"]`).click()
const confirm = () => cal().locator('uni-button').filter({ hasText: /^确定日期$/ }).click()
try {
  await page.goto('http://127.0.0.1:5394/#/pages/staff/dispatch')
  await opener().getByText('2026-10-03', { exact: true }).waitFor()
  await opener().click()
  assert.match(await cal().locator('[aria-label="2026-10-03"]').getAttribute('class'), /selected/)
  assert.equal(await cal().locator('input, textarea').count(), 0)
  assert.equal(await cal().getByText(/下一页|不限日期/).count(), 0)
  assert.equal(await cal().locator('[aria-label="2026-10-01"]').getAttribute('disabled'), null)
  await cal().locator('[aria-label="下个月"]').click(); await choose('2026-11-17')
  const initial = queries.length
  await cal().getByText('取消', { exact: true }).click()
  assert.equal(queries.length, initial)
  await opener().getByText('2026-10-03', { exact: true }).waitFor()
  checks.push('board date opens preselected calendar with no text input or next-page menu; cancel preserves data and date')
  await opener().click(); await cal().locator('[aria-label="上个月"]').click(); await choose('2026-09-20'); await confirm()
  await opener().getByText('2026-09-20', { exact: true }).waitFor()
  await page.locator('.month').getByText('2026年9月', { exact: true }).waitFor()
  assert.equal(queries.at(-1).date, '2026-09-20')
  await page.getByText('按门店', { exact: true }).click()
  await page.locator('.city-head').getByText('平潭测试门店', { exact: true }).waitFor()
  assert.equal(queries.at(-1).dim, 'store')
  assert.equal(queries.at(-1).date, '2026-09-20')
  checks.push('historical dates remain selectable; confirmation refreshes API/card/heat calendar and preserves date when changing dimension')
  await opener().click(); await cal().locator('[aria-label="下个月"]').click(); await choose('2026-10-15'); await confirm()
  await opener().getByText('2026-10-15', { exact: true }).waitFor()
  assert.equal(queries.at(-1).dim, 'store')
  failedDate = '2026-10-16'
  await opener().click(); await choose(failedDate); await confirm()
  await page.getByText('看板加载失败', { exact: true }).waitFor()
  await opener().getByText('2026-10-15', { exact: true }).waitFor()
  failedDate = ''
  await opener().click(); await choose('2026-10-16'); await confirm()
  await opener().getByText('2026-10-16', { exact: true }).waitFor()
  delayedDate = '2026-10-17'
  await opener().click(); await choose(delayedDate); await confirm()
  await opener().click(); await choose('2026-10-18'); await confirm()
  await opener().getByText('2026-10-18', { exact: true }).waitFor()
  await page.waitForTimeout(1900)
  await opener().getByText('2026-10-18', { exact: true }).waitFor()
  checks.push('failed request retains prior displayed date/data and can retry; late response never overwrites a newer selection')
  await opener().click(); await page.waitForTimeout(400)
  await page.screenshot({ path: out + '/calendar-390.png' })
  await page.setViewportSize({ width: 320, height: 740 }); await page.waitForTimeout(200)
  await page.screenshot({ path: out + '/calendar-320.png' })
  const panel = await cal().boundingBox()
  assert.ok(panel.x >= 0 && panel.x + panel.width <= 320 && panel.y >= 0 && panel.y + panel.height <= 740)
  assert.deepEqual(errors, [])
  checks.push('calendar fits 320px and 390px phone layouts; no browser errors')
} finally {
  await writeFile(out + '/result.json', JSON.stringify({ checks, errors, queries }, null, 2))
  await browser.close()
}
console.log(JSON.stringify({ checks, errors }, null, 2))
