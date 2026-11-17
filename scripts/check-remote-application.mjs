import assert from 'node:assert/strict'
import { mkdir, writeFile } from 'node:fs/promises'
import { chromium } from 'playwright'
const out = '../artifacts/remote-application-20261002'
await mkdir(out, { recursive: true })
const browser = await chromium.launch({ headless: true })
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true })
const errors = [], submissions = [], calls = [], checks = []
let jobFailure = false, progressStatus = 'review_passed'
page.on('pageerror', e => errors.push(e.message))
await page.addInitScript(() => {
  if (!location.protocol.startsWith('http')) return
  localStorage.setItem('kangaroo:app-token', JSON.stringify({ type: 'string', data: 'remote-fixture' }))
  for (const owner of ['guest', '9001']) localStorage.setItem(`kangaroo:${owner}:application-draft`, JSON.stringify({ type: 'object', data: { arrival: '2000-01-01', days: '1', note: '' } }))
})
const job = id => ({ jobId: id, title: id === 18 ? '全国远程写作任务' : '平潭线下兼职', jobType: id === 18 ? 'online' : 'parttime', city: '平潭', address: '平潭门店', boardType: 'all', startDate: '2030-01-01', minDays: 30, tags: [], salaryText: '100 元/单', deliverDesc: '10月10日 18:00 前', estHours: '约2小时', content: '撰写小院介绍文章', requirement: '提供原创作品', acceptsApplication: true })
await page.route('**/app/**', async route => {
  const p = new URL(route.request().url()).pathname
  calls.push(p)
  let data = {}
  if (p === '/app/auth/account') data = { id: 9001, nickname: '测试用户', staffGrants: [] }
  else if (/^\/app\/job\/\d+$/.test(p)) {
    if (jobFailure) return route.fulfill({ json: { code: 500, msg: '岗位信息暂时无法加载' } })
    data = job(Number(p.split('/').at(-1)))
  } else if (p === '/app/application' && route.request().method() === 'POST') {
    submissions.push(route.request().postDataJSON()); data = { appId: 91 }
  } else if (p === '/app/application/91') data = { appId: 91, jobId: 18, jobType: 'online', status: progressStatus, step: 6, submitTime: '2026-10-03 11:00:00' }
  else if (p === '/app/message/list') data = []
  await route.fulfill({ json: { code: 200, data, msg: '操作成功' } })
})
const goto = async path => { await page.goto('about:blank'); await page.goto('http://127.0.0.1:5395/#' + path) }
const clickButton = text => page.locator('uni-button').filter({ hasText: new RegExp('^' + text + '$') }).last().click()
const personal = async () => {
  await page.locator('.k-field').filter({ hasText: '请输入姓名' }).locator('input').fill('远程测试')
  await page.locator('.k-field').filter({ hasText: '请输入年龄' }).locator('input').fill('25')
  await page.locator('.k-field').filter({ hasText: '请输入手机号' }).locator('input').fill('13800138000')
}
try {
  await goto('/pages/jobs/detail?jobId=18')
  await page.getByText('全国远程 · 无需到店', { exact: true }).waitFor()
  let body = await page.locator('body').innerText()
  for (const old of ['工作地点', '最短时长', '食宿安排', '找人一起去', '可入职']) assert.ok(!body.includes(old), old)
  await page.screenshot({ path: out + '/detail-390.png' })
  await clickButton('申请接单')
  await page.getByText('全国可接 · 远程完成，无需到店。审核通过后按任务要求提交成果。', { exact: true }).waitFor()
  body = await page.locator('body').innerText(); assert.ok(!body.includes('到岗安排'))
  await personal(); await clickButton('下一步')
  await page.getByText('核对本次报名资料', { exact: true }).waitFor()
  body = await page.locator('body').innerText()
  for (const old of ['到岗日期', '停留天数', '2000-01-01', '面试与签约']) assert.ok(!body.includes(old), old)
  await page.screenshot({ path: out + '/confirmation-390.png' })
  await clickButton('提交接单申请')
  await page.locator('.saved').waitFor()
  assert.equal(submissions.length, 1); assert.equal(submissions[0].arrival, undefined); assert.equal(submissions[0].days, undefined)
  await clickButton('查看审核进度')
  await page.getByText('接单申请已通过', { exact: true }).waitFor()
  body = await page.locator('body').innerText()
  for (const old of ['视频面试', '能力评估', '录用沟通', '入职成功']) assert.ok(!body.includes(old), old)
  await page.screenshot({ path: out + '/progress-390.png' })
  await clickButton('提交成果 / 结算'); await page.waitForURL(/jobs\/deliver\?appId=91/)
  assert.equal(submissions.length, 1)
  checks.push('real detail-to-apply title link fetches authoritative type, skips onsite scheduling, ignores stale draft, submits once and routes approval straight to delivery')

  await goto('/pages/jobs/apply?jobId=19&title=线下岗位&jobType=online')
  await page.getByText('到岗安排', { exact: true }).waitFor()
  await personal(); await clickButton('下一步')
  await page.getByText('预计到岗日期 *', { exact: true }).waitFor()
  await clickButton('下一步'); await page.getByText('请选择今天或之后的到岗日期', { exact: true }).waitFor()
  assert.equal(submissions.length, 1)
  checks.push('onsite job ignores forged online query type, still requires arrival date and stay length')

  jobFailure = true
  await goto('/pages/jobs/apply?jobId=18&title=不可信标题')
  await page.getByText('重新加载岗位', { exact: true }).waitFor()
  assert.equal(await page.locator('uni-button').filter({ hasText: /^下一步$/ }).getAttribute('disabled'), 'true')
  jobFailure = false; await clickButton('重新加载岗位')
  await page.getByText('全国可接 · 远程完成，无需到店。审核通过后按任务要求提交成果。', { exact: true }).waitFor()
  checks.push('load failures prevent submission and retry restores remote flow')

  await page.setViewportSize({ width: 320, height: 740 })
  await page.screenshot({ path: out + '/apply-320.png' })
  const size = await page.evaluate(() => ({ content: document.documentElement.scrollWidth, viewport: innerWidth }))
  assert.ok(size.content <= size.viewport)
  progressStatus = 'withdrawn'
  await goto('/pages/jobs/progress?appId=91')
  await page.getByText('这次接单申请已结束，如有疑问可联系发布方。', { exact: true }).waitFor()
  assert.ok(!(await page.locator('body').innerText()).includes('视频面试'))
  assert.ok(!calls.some(p => p.includes('interview-slots')))
  assert.deepEqual(errors, [])
  checks.push('narrow viewport fits; withdrawn remote application does not show or request interview steps')
  await writeFile(out + '/result.json', JSON.stringify({ status: 'pass', checks, submissions, errors }, null, 2))
  console.log('PASS', checks.length, 'remote application scenarios')
} catch (e) {
  await page.screenshot({ path: out + '/failure.png' })
  await writeFile(out + '/failure.json', JSON.stringify({ message: e.message, url: page.url(), body: await page.locator('body').innerText(), errors, submissions }, null, 2))
  throw e
} finally { await browser.close() }
