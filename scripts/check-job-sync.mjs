import assert from 'node:assert/strict'
import { mkdir, writeFile } from 'node:fs/promises'
import { chromium } from 'playwright'
const out = '../artifacts/job-sync-20261002'
await mkdir(out, { recursive: true })
const browser = await chromium.launch({ headless: true })
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true })
const errors = [], checks = [], listCalls = []
let published = [18], failList = false
const statuses = {}
const job = id => ({ jobId: id, title: 'XBL' + id, status: statuses[id] || 'published', jobType: 'online', city: '平潭', address: '远程', remoteFlag: '0', tags: [], salaryText: '100 元/单', salaryUnit: '元/单', salaryType: 'piece', salaryMin: 100, deliverDesc: '10月10日 18:00 前', acceptsApplication: statuses[id] !== 'paused' })
page.on('pageerror', e => errors.push(e.message))
await page.addInitScript(() => {
  if (!location.protocol.startsWith('http')) return
  localStorage.setItem('kangaroo:app-token', JSON.stringify({ type: 'string', data: 'job-sync-fixture' }))
})
await page.route('**/app/**', async route => {
  const u = new URL(route.request().url()), p = u.pathname
  let data = {}, extra = {}
  if (p === '/app/auth/account') data = { id: 9001, nickname: '测试用户', staffGrants: [] }
  else if (p === '/app/message/list' || p === '/app/job-subs') data = []
  else if (p === '/app/job/list') {
    listCalls.push(Object.fromEntries(u.searchParams))
    if (failList) return route.fulfill({ json: { code: 500, msg: '测试网络暂不可用' } })
    extra = { rows: published.map(job), total: published.length, hasMore: false }
  } else if (/^\/app\/job\/\d+$/.test(p)) data = job(Number(p.split('/').at(-1)))
  else if (p === '/app/jobs/search') { const ids = published.filter(id => statuses[id] !== 'paused'); data = { jobs: ids.map(id => ({ ...job(id), price: 100, unit: '元/单' })), total: ids.length } }
  await route.fulfill({ json: { code: 200, msg: '操作成功', data, ...extra } })
})
const goto = async path => { await page.goto('about:blank'); await page.goto('http://127.0.0.1:5395/#' + path) }
const refresh = () => page.locator('uni-button').filter({ hasText: /^刷新$/ }).click()
try {
  await goto('/pages/jobs/list?type=online')
  await page.locator('.card').filter({ hasText: 'XBL18' }).waitFor()
  await page.locator('.card').click()
  await page.getByText('全国远程 · 无需到店', { exact: true }).waitFor()
  published = [18, 12]
  await page.goBack()
  await page.locator('.card').filter({ hasText: 'XBL12' }).waitFor()
  assert.equal(await page.locator('.card').count(), 2)
  checks.push('returning to an existing list after another device publishes a task automatically displays the new task')
  await page.screenshot({ path: out + '/published-390.png' })
  statuses[18] = 'paused'
  await refresh()
  await page.locator('.card').filter({ hasText: 'XBL18' }).getByText('已暂停招聘', { exact: true }).waitFor()
  checks.push('paused tasks remain readable under the existing product rule but clearly show their latest paused status')
  published = [12]
  await refresh()
  await page.waitForFunction(() => document.querySelectorAll('.card').length === 1)
  assert.ok((await page.locator('.card').innerText()).includes('XBL12'))
  checks.push('manual refresh removes a closed task and updates the visible count')
  failList = true
  await refresh()
  await page.getByText('岗位加载失败，请刷新重试', { exact: true }).waitFor()
  assert.equal(await page.locator('.card').count(), 0)
  failList = false; published = [18, 12]; statuses[18] = 'published'
  await refresh(); await page.locator('.card').filter({ hasText: 'XBL18' }).waitFor()
  checks.push('request failure is visible, clears stale cards, and refresh recovers the current published tasks')
  published = []
  await refresh(); await page.getByText('暂无已上架的线上任务，新任务发布后会在这里展示。', { exact: true }).waitFor()
  published = [18, 12]
  await refresh(); await page.locator('.card').filter({ hasText: 'XBL12' }).waitFor()
  checks.push('empty lists distinguish no published tasks and recover after publication')
  await goto('/pages/jobs/filter?type=online&s=3')
  await page.locator('.result-body').getByText('XBL18', { exact: true }).waitFor()
  await page.locator('.result-body').getByText('XBL18', { exact: true }).click()
  await page.getByText('全国远程 · 无需到店', { exact: true }).waitFor()
  published = [12]
  await page.goBack()
  await page.waitForFunction(() => document.querySelector('.result-body') && !document.querySelector('.result-body').textContent.includes('XBL18'))
  await page.locator('.result-body').getByText('XBL12', { exact: true }).waitFor()
  checks.push('returning to filtered results rechecks publication status instead of retaining paused tasks')
  await page.setViewportSize({ width: 320, height: 740 })
  await goto('/pages/jobs/list?type=online'); await page.locator('.card').waitFor()
  const b = await page.locator('.list-status').boundingBox()
  assert.ok(b.x >= 0 && b.x + b.width <= 321)
  await page.screenshot({ path: out + '/refresh-320.png' })
  assert.ok(listCalls.every(q => q.type === 'online' && q.city === undefined))
  assert.deepEqual(errors, [])
  checks.push('refresh fits narrow screens and all online list requests remain nationwide')
  await writeFile(out + '/result.json', JSON.stringify({ status: 'pass', checks, listCalls, errors }, null, 2))
  console.log('PASS', checks.length, 'publication sync scenarios')
} catch (e) { await page.screenshot({ path: out + '/failure.png' }); console.log(await page.locator('body').innerText()); throw e }
finally { await browser.close() }
