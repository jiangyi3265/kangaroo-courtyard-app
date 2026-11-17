// Local H5 interactions with explicit API fixtures. Never sends business messages.
import assert from 'node:assert/strict'
import { mkdir, writeFile } from 'node:fs/promises'
import { chromium } from 'playwright'

const out = '../artifacts/resume-forward-20261002/browser'
await mkdir(out, { recursive: true })
const browser = await chromium.launch({ headless: true })
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true })
const errors = [], checks = [], sends = [], history = []
let responseError = '', pendingSend = null, holdSend = false, visit = 0
const grant = (storeId, storeName) => ({ storeId, storeName, roleCode: 'manager', active: true })
const app = id => ({ appId: id, jobId: 10, storeId: id === 202 ? 103 : 102, appNo: 'QA' + id, applicantName: '测*', realName: '测试候选人', jobTitle: '小院接待换工', status: 'submitted', statusLabel: '待审核', skills: '接待', submitTime: '2026-10-02 10:00:00' })
page.on('pageerror', e => errors.push(e.message))
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()) })
await page.addInitScript(() => localStorage.setItem('kangaroo:app-token', JSON.stringify({ type: 'string', data: 'resume-forward-fixture' })))
await page.route('**/app/**', async route => {
  const request = route.request(), url = new URL(request.url()), path = url.pathname
  const r = { code: 200, msg: '操作成功', data: {}, rows: [], total: 0 }
  if (path === '/app/auth/account') r.data = { id: 9001, nickname: '测试主理人', staffGrants: [grant(102, '平潭袋鼠小院'), grant(103, '大理测试门店')] }
  else if (path === '/app/job/list') { r.rows = [{ jobId: 10, jobType: 'volunteer' }]; r.total = 1 }
  else if (path === '/app/staff/applications') { r.rows = [app(201)]; r.total = 1 }
  else if (/^\/app\/staff\/applications\/\d+$/.test(path)) r.data = app(Number(path.split('/').at(-1)))
  else if (path === '/app/staff/workbench/forwards') { history.push(Object.fromEntries(url.searchParams)); r.data = [] }
  else if (path === '/app/staff/workbench/forward') {
    const body = request.postDataJSON(); sends.push(body)
    if (holdSend) await new Promise(resolve => { pendingSend = resolve })
    if (responseError) { r.code = 409; r.msg = responseError }
    else r.data = { count: body.target === 'store' ? 3 : 1, message: body.target === 'store' ? '已转发给 3 位同事' : '已转发给 1 位主理人', records: [{ from: '测试主理人', target: body.target === 'store' ? '门店群' : '主理人', time: '10-02 17:32', readText: body.track === '1' ? '已读 0/3' : '未开启已读统计' }] }
  }
  await route.fulfill({ json: r })
})
const button = label => page.locator('uni-button').filter({ has: page.getByText(label, { exact: true }) })
const option = label => page.locator('.target').filter({ has: page.getByText(label, { exact: true }) })
const toast = text => page.locator('uni-toast').getByText(text, { exact: true }).waitFor()
async function openForward(id = 201) {
  await page.goto(`http://127.0.0.1:5373/?forward-test=${++visit}#/pages/staff/applications?appId=${id}`)
  await page.waitForLoadState('networkidle')
  await button('转发脱敏简历').click()
  await button('转发').click()
  await button('转发给主理人').waitFor()
}
try {
  await openForward()
  await option('门店同事').click()
  await option('门店同事').getByText('✓', { exact: true }).waitFor()
  assert.equal(await option('主理人').locator('.target-check').count(), 0)
  await button('转发给门店同事').waitFor()
  await page.locator('.forward-scope').getByText('平潭袋鼠小院：发送给其他在职主理人、管家和员工的消息中心。', { exact: true }).waitFor()
  await page.locator('.suggest textarea').fill('请管家和当班员工协助看看')
  await page.screenshot({ path: out + '/store-390.png', fullPage: true })
  checks.push('store option, tick, destination explanation and button label agree')

  holdSend = true
  await button('转发给门店同事').click()
  await button('正在转发…').waitFor()
  await option('主理人').click()
  assert.equal(await option('门店同事').locator('.target-check').count(), 1)
  assert.equal(sends.length, 1)
  assert.deepEqual(sends[0], { appId: 201, storeId: 102, target: 'store', suggestion: '请管家和当班员工协助看看', track: '1' })
  holdSend = false; pendingSend(); pendingSend = null
  await toast('已转发给 3 位同事')
  await page.locator('.send-note').getByText(/转给门店同事.*已读 0\/3/).waitFor()
  await page.waitForFunction(() => document.querySelector('.suggest textarea')?.value === '')
  checks.push('store submission uses store target; in-flight recipient is locked; actual success and read record are shown')

  await option('主理人').click()
  await page.locator('.switch').click()
  await button('转发给主理人').click()
  await toast('已转发给 1 位主理人')
  assert.equal(sends.at(-1).target, 'manager')
  assert.equal(sends.at(-1).track, '0')
  await page.locator('.send-note').getByText(/转给主理人.*未开启已读统计/).waitFor()
  checks.push('switching back sends to managers and honors tracking disabled')

  await option('门店同事').click()
  responseError = '本店暂时没有其他在职员工'
  await page.locator('.suggest textarea').fill('失败后保留建议')
  await button('转发给门店同事').click()
  await toast(responseError)
  assert.equal(await page.locator('.suggest textarea').inputValue(), '失败后保留建议')
  await button('转发给门店同事').waitFor()
  checks.push('no-recipient failure stays visible, keeps draft, and permits retry')
  responseError = ''

  await openForward(202)
  await option('门店同事').click()
  await page.locator('.forward-scope').getByText(/大理测试门店/).waitFor()
  await button('转发给门店同事').click()
  await toast('已转发给 3 位同事')
  assert.equal(sends.at(-1).storeId, 103)
  assert.equal(sends.at(-1).appId, 202)
  assert.ok(history.some(h => h.appId === '202' && h.storeId === '103'))
  checks.push('cross-store notification deep link uses application store for history and send despite active store 102')

  await page.setViewportSize({ width: 320, height: 740 })
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false)
  await page.locator('uni-toast').waitFor({ state: 'hidden' })
  await page.mouse.move(160, 480)
  await page.mouse.wheel(0, 500)
  await button('转发给门店同事').click()
  await toast('已转发给 3 位同事')
  await page.locator('uni-toast').waitFor({ state: 'hidden' })
  await page.screenshot({ path: out + '/store-320.png' })
  checks.push('320px viewport has no horizontal overflow; scrolling exposes a clickable send button above the fixed tabbar')
  assert.deepEqual(errors, [])
  console.log(JSON.stringify({ checks, errors, sends }, null, 2))
} finally {
  if (pendingSend) pendingSend()
  await writeFile(out + '/result.json', JSON.stringify({ checks, errors, sends, history }, null, 2))
  await browser.close()
}
