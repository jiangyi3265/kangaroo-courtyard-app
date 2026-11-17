import assert from 'node:assert/strict'
import { mkdir, writeFile } from 'node:fs/promises'
import { chromium } from 'playwright'
const out = '../artifacts/online-discovery-20261002'
await mkdir(out, { recursive: true })
const browser = await chromium.launch({ headless: true })
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true })
const errors = [], searches = [], lists = [], subscriptions = [], checks = []
page.on('pageerror', e => errors.push(e.message))
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()) })
await page.addInitScript(() => {
  if (!location.protocol.startsWith('http')) return
  localStorage.setItem('kangaroo:app-token', JSON.stringify({ type: 'string', data: 'online-discovery-fixture' }))
  localStorage.setItem('kangaroo:9001:cities', JSON.stringify({ type: 'object', data: ['大理'] }))
})
const online = [10002, 10003].map((id, i) => ({ jobId: id, title: `XBL${i ? '18' : '12'}`, city: i ? '平潭' : '不限', address: '远程', publisherName: '平潭袋鼠小院', jobType: 'online', salaryText: '150 元/单', salaryUnit: '元/单', salaryMin: 150, salaryType: 'piece', remoteFlag: '0', tags: [], deliverDesc: '10月10日 18:00 前' }))
await page.route('**/app/**', async route => {
  const u = new URL(route.request().url()), path = u.pathname
  let data = {}, extra = {}
  if (path === '/app/auth/account') data = { id: 9001, nickname: '线上任务测试', staffGrants: [] }
  else if (path === '/app/message/unread') data = { unread: 0 }
  else if (path === '/app/message/list') data = []
  else if (path === '/app/home/feed') data = { activities: [], jobs: [] }
  else if (path === '/app/cities') data = { hot: ['大理', '平潭', '杭州'], all: [] }
  else if (path === '/app/job/list') {
    const q = Object.fromEntries(u.searchParams); lists.push(q)
    extra = { rows: q.type === 'online' ? online.filter(j => !q.keyword || j.title.includes(q.keyword)) : [{ ...online[0], title: '平潭兼职', jobType: 'parttime', city: '平潭', remoteFlag: '1' }], total: q.type === 'online' ? (q.keyword ? 1 : 2) : 1, hasMore: false }
  } else if (path === '/app/jobs/search') {
    const q = route.request().postDataJSON(); searches.push(q)
    data = { jobs: q.jobType === 'online' ? online.map(j => ({ ...j, place: j.publisherName, price: '150', unit: '元/单' })) : [], total: q.jobType === 'online' ? 2 : 0 }
  } else if (path === '/app/job-subscriptions') {
    if (route.request().method() === 'POST') { subscriptions.push(route.request().postDataJSON()); data = { message: '订阅已保存' } }
    else data = []
  } else if (/\/app\/job\/\d+$/.test(path)) data = { ...online[0], status: 'published', store: { storeName: '平潭袋鼠小院' } }
  await route.fulfill({ json: { code: 200, msg: '操作成功', data, ...extra } })
})
const goto = async path => { await page.goto('about:blank'); await page.goto('http://127.0.0.1:5395/#' + path) }
try {
  await goto('/pages/home/index')
  await page.locator('.entry').getByText('线上任务', { exact: true }).waitFor()
  assert.equal(await page.locator('.entry').count(), 5)
  await page.screenshot({ path: out + '/home-390.png' })
  await page.locator('.entry').getByText('线上任务', { exact: true }).click()
  await page.locator('.online-scope').waitFor()
  await page.locator('.card').filter({ hasText: 'XBL18' }).waitFor()
  assert.equal(lists.at(-1).type, 'online'); assert.equal(lists.at(-1).city, undefined)
  assert.equal(await page.locator('.chips').getByText('城市', { exact: true }).count(), 0)
  await page.screenshot({ path: out + '/online-390.png' })
  checks.push('home has an independent online-task entry; online list loads all cities including Pingtan despite saved Dali preference')
  await page.locator('.search input').fill('XBL18'); await page.locator('.search__btn').click()
  await page.waitForFunction(() => document.querySelectorAll('.card').length === 1)
  assert.equal(lists.at(-1).keyword, 'XBL18'); assert.equal(lists.at(-1).city, undefined)
  await page.locator('.card').click(); await page.waitForURL(/jobId=10003/)
  checks.push('keyword search remains national and task card opens its correct detail')
  await goto('/pages/jobs/list?type=parttime')
  await page.locator('.job-kind').getByText('线上任务', { exact: true }).click()
  await page.locator('.online-scope').waitFor()
  await page.locator('.card').filter({ hasText: 'XBL12' }).waitFor()
  await page.locator('.chips').getByText('任务类型', { exact: true }).click()
  await page.locator('.nationwide-note').waitFor()
  assert.equal(await page.locator('.filter-body').getByText('城市', { exact: true }).count(), 0)
  assert.equal(await page.locator('.filter-body').getByText('可到岗日期', { exact: true }).count(), 0)
  await page.locator('.option').getByText('内容写作', { exact: true }).click()
  await page.waitForTimeout(550)
  assert.deepEqual(searches.at(-1).cities, []); assert.deepEqual(searches.at(-1).types, ['内容写作']); assert.equal(searches.at(-1).jobType, 'online')
  await page.locator('uni-button').filter({ hasText: /^查看 2 个机会$/ }).click()
  await page.locator('.result-body').waitFor()
  assert.equal(await page.locator('.chosen').getByText(/大理/).count(), 0)
  await page.screenshot({ path: out + '/results-390.png' })
  checks.push('part-time list switches directly to online; filters and results omit cities and arrival dates, task categories are searchable')
  await goto('/pages/jobs/filter?type=online&s=2')
  await page.locator('.nationwide-note').filter({ hasText: '接收全国线上任务提醒' }).waitFor()
  assert.equal(await page.locator('.subscribe-body').getByText('所在城市', { exact: true }).count(), 0)
  await page.locator('uni-button').filter({ hasText: /^保存订阅$/ }).click()
  await page.waitForTimeout(300)
  assert.deepEqual(subscriptions.at(-1).cities, []); assert.deepEqual(subscriptions.at(-1).jobTypes, ['online'])
  checks.push('online subscription saves no city and shows a clear nationwide reminder label')
  await page.waitForTimeout(1000)
  await goto('/pages/jobs/filter?type=parttime')
  await page.locator('.filter-body').getByText('城市', { exact: true }).waitFor()
  await page.locator('.filter-body').getByText('可到岗日期', { exact: true }).waitFor()
  checks.push('on-site jobs retain city and arrival filters')
  await page.setViewportSize({ width: 320, height: 740 })
  await goto('/pages/home/index'); await page.locator('.entry').getByText('线上任务', { exact: true }).waitFor()
  for (const el of await page.locator('.entry').all()) { const b = await el.boundingBox(); assert.ok(b.x >= 0 && b.x + b.width <= 321) }
  await page.screenshot({ path: out + '/home-320.png' })
  await page.locator('.entry').getByText('线上任务', { exact: true }).click(); await page.locator('.card').filter({ hasText: 'XBL18' }).waitFor()
  await page.screenshot({ path: out + '/online-320.png' })
  for (const el of await page.locator('.job-kind').all()) { const b = await el.boundingBox(); assert.ok(b.x >= 0 && b.x + b.width <= 321) }
  assert.deepEqual(errors, []); checks.push('home entries and category tabs fit 320px and 390px viewports without browser errors')
  await writeFile(out + '/result.json', JSON.stringify({ checks, errors, lists, searches, subscriptions }, null, 2))
  console.log('PASS', checks.length, 'online discovery checks')
} catch (e) {
  await page.screenshot({ path: out + '/failure.png' });
  await writeFile(out + '/failure.json', JSON.stringify({ message: e.message, url: page.url(), text: await page.locator('body').innerText(), errors, lists, searches, subscriptions }, null, 2));
  throw e
} finally { await browser.close() }
