import assert from 'node:assert/strict'
import { mkdir, writeFile } from 'node:fs/promises'
import { chromium } from 'playwright'
const out = '../artifacts/publish-calendar-20261002'
await mkdir(out, { recursive: true })
const browser = await chromium.launch({ headless: true })
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true })
const page = await context.newPage(), checks = [], errors = [], published = [], pages = []
page.setDefaultTimeout(15000)
page.on('pageerror', e => errors.push(e.message))
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()) })
await page.clock.setFixedTime(new Date('2026-10-02T16:00:00Z'))
await page.addInitScript(() => localStorage.setItem('kangaroo:app-token', JSON.stringify({ type: 'string', data: 'publish-calendar-fixture' })))
let mineError = false, empty = false, publishFail = false
const pending = { postId: 901, kindLabel: '找搭子', title: '平潭一起看海', content: '周末约在海边散步，欢迎同行。', city: '平潭', status: 'pending', images: [], dateText: '10-03' }
const rows = [pending, { ...pending, postId: 900, title: '上次的旅居记录', status: 'online' }, { ...pending, postId: 899, title: '需要补充的活动', status: 'rejected', auditReason: '请补充集合地点' }, { ...pending, postId: 898, title: '已隐藏的记录', status: 'hidden' }, ...Array.from({ length: 49 }, (_, i) => ({ ...pending, postId: 897 - i, title: '历史发布 ' + (i + 1) }))]
await page.route('**/app/**', async route => {
  const request = route.request(), url = new URL(request.url()), p = url.pathname
  let data = {}, code = 200, msg = '操作成功'
  if (p === '/app/auth/account') data = { id: 9001, nickname: '发布测试', city: '平潭', staffGrants: [] }
  else if (p === '/app/community/status') data = { phoneVerified: true }
  else if (p === '/app/message/unread') data = { unread: 0 }
  else if (p === '/app/message/list') data = []
  else if (p === '/app/me/profile') data = { nickname: '发布测试', city: '平潭', records: [] }
  else if (p === '/app/community/posts/mine') {
    const num = Number(url.searchParams.get('page') || 1); pages.push(num)
    data = empty ? [] : rows.slice((num - 1) * 20, num * 20)
    if (mineError) { code = 500; msg = '发布记录加载失败，请重试' }
  } else if (p === '/app/community/posts' && request.method() === 'POST') {
    published.push(request.postDataJSON())
    await new Promise(r => setTimeout(r, 180))
    if (publishFail) { code = 500; msg = '测试提交失败，请重试' }
    else data = { postId: 901, status: 'pending', message: '已提交审核' }
  } else if (p === '/app/community/posts/900') data = { ...rows[1], tags: [], related: [], author: { name: '发布测试', isMe: true } }
  else if (p === '/app/community/feed') data = { rows: [], hots: [] }
  await route.fulfill({ json: { code, msg, data } })
})
const open = async path => { await page.goto('http://127.0.0.1:5393/#/' + path); await page.waitForLoadState('networkidle') }
const dateRow = () => page.locator('.publish-row').filter({ hasText: /^日期/ })
// 2026-10-17 发布页改版：城市 / 日期收进「补充信息」卡（默认收起），先展开
const openExtra = async () => { if (!(await page.locator('.fold.extra .fold__body').count())) await page.locator('.fold.extra .fold__head').click() }
const cal = () => page.locator('.calendar-panel')
const select = date => cal().locator(`[aria-label="${date}"]`).click()
const confirmDate = () => cal().locator('uni-button').filter({ hasText: /^确定日期$/ }).click()
const button = text => page.locator('uni-button').filter({ hasText: new RegExp('^' + text + '$') })
try {
  await open('pages/community/publish'); await openExtra()
  await page.locator('.text-field input').fill(pending.title)
  // 正文平时是一块预览（防止原生 textarea 盖住底部按钮），先点一下再输入
  await page.locator('.publish-area-idle').click()
  await page.locator('textarea').fill(pending.content)
  await dateRow().click()
  await cal().getByText('2026年10月', { exact: true }).waitFor()
  assert.equal(await cal().getByText(/下一页/).count(), 0)
  assert.ok(await cal().locator('[aria-label="2026-10-02"]').getAttribute('disabled') !== null)
  await cal().locator('[aria-label="下个月"]').click()
  await select('2026-11-07'); await confirmDate()
  await dateRow().getByText('11月7日（周六）').waitFor()
  await dateRow().click(); await cal().locator('[aria-label="下个月"]').click(); await select('2026-12-12')
  await cal().getByText('取消', { exact: true }).click()
  await dateRow().getByText('11月7日（周六）').waitFor()
  await page.locator('.pbar__draft').click() // 底部固定条「存草稿」
  await open('pages/community/publish'); await openExtra()
  assert.equal(await page.locator('.text-field input').inputValue(), pending.title)
  await dateRow().getByText('11月7日（周六）').waitFor()
  await dateRow().click(); await page.waitForTimeout(400); await page.screenshot({ path: out + '/calendar-390.png' })
  await writeFile(out + '/calendar-dom.json', JSON.stringify(await cal().locator('.calendar-arrow').evaluateAll(xs => xs.map(x => ({ html: x.outerHTML, width: x.clientWidth, children: [...x.children].map(c => ({ tag: c.tagName, display: getComputedStyle(c).display, rect: c.getBoundingClientRect().toJSON() })) }))), null, 2))
  await cal().getByText('不限日期', { exact: true }).click(); await confirmDate()
  await dateRow().getByText('不限日期').waitFor()
  checks.push('month calendar has no paged date menu; past disabled, month change, cancel, unlimited and draft restoration work')
  await dateRow().click(); await cal().locator('[aria-label="下个月"]').click(); await select('2026-11-07'); await confirmDate()
  await page.locator('.pbar__go').click() // 找搭子：底部「下一步」
  await page.locator('.sync-switch-row').waitFor()
  await page.locator('.activity-row').filter({ hasText: '集合时间' }).click()
  await cal().getByText('选择集合日期', { exact: true }).waitFor()
  await cal().locator('[aria-label="下个月"]').click(); await select('2026-11-08'); await confirmDate()
  await page.locator('.uni-modal textarea').fill('09:30')
  await page.locator('.uni-modal').getByText('确定', { exact: true }).click()
  await page.locator('.activity-row').filter({ hasText: '集合时间' }).getByText('11月8日（周日）09:30').waitFor()
  await page.locator('.activity-row').filter({ hasText: '集合时间' }).click()
  await cal().getByText('取消', { exact: true }).click()
  await page.locator('.sync-switch-row .switch').click()
  publishFail = true
  await button('发布').click()
  await page.getByText('测试提交失败，请重试', { exact: true }).waitFor()
  assert.ok(page.url().includes('/publish'))
  publishFail = false
  await button('发布').dblclick()
  await page.waitForURL(/community\/mine/)
  await page.getByText('内容已提交', { exact: true }).waitFor()
  const card = page.locator('.my-post-card').first()
  await card.getByText(pending.title, { exact: true }).waitFor()
  await card.getByText('待审核', { exact: true }).waitFor()
  await card.getByText(pending.content, { exact: true }).waitFor()
  assert.equal(published.length, 2)
  assert.equal(published[1].eventDate, '2026-11-07')
  assert.equal(await page.evaluate(() => localStorage.getItem('kangaroo:publish-draft')), null)
  await page.waitForTimeout(2100); await page.screenshot({ path: out + '/my-posts-390.png' })
  checks.push('failed publish retains input; success clears draft once and redirects to complete pending content with durable entry hint')
  await page.locator('.my-post-card').filter({ hasText: '需要补充的活动' }).getByText('未通过原因：请补充集合地点', { exact: true }).waitFor()
  await page.getByText('加载更多', { exact: true }).click()
  await page.getByText('加载更多', { exact: true }).click()
  await page.getByText('已显示全部发布内容', { exact: true }).waitFor()
  assert.equal(await page.locator('.my-post-card').count(), 53)
  assert.deepEqual(pages.slice(-3), [1, 2, 3])
  checks.push('all moderation states and rejection reason visible; history loads beyond 50 posts without duplicates')
  await page.locator('.my-post-card').filter({ hasText: '上次的旅居记录' }).getByText('查看社区详情', { exact: true }).click()
  await page.getByText('帖子详情', { exact: true }).waitFor()
  await page.waitForTimeout(400)
  await writeFile(out + '/back-before.json', JSON.stringify(await page.evaluate(() => ({ pages: getCurrentPages().map(p => ({ route: p.route, options: p.options })), topbar: document.querySelector('.k-navbar__back')?.outerHTML })), null, 2))
  await page.locator('.k-navbar__back').click()
  await page.waitForTimeout(500)
  await writeFile(out + '/back-after.json', JSON.stringify(await page.evaluate(() => ({ pages: getCurrentPages().map(p => ({ route: p.route, options: p.options })) })), null, 2))
  await page.waitForURL(/community\/mine/)
  await open('pages/profile/index')
  await page.getByText('我的发布', { exact: true }).click()
  await page.waitForURL(/community\/mine/)
  await page.locator('.my-post-card').first().waitFor()
  checks.push('profile entry and published-detail back navigation both return to My Posts')
  await page.setViewportSize({ width: 320, height: 740 })
  await page.screenshot({ path: out + '/my-posts-320.png' })
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false)
  await open('pages/community/publish'); await openExtra(); await dateRow().click()
  await page.waitForTimeout(400); await page.screenshot({ path: out + '/calendar-320.png' })
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false)
  await cal().getByText('取消', { exact: true }).click()
  mineError = true
  await page.getByText('我的发布', { exact: true }).click()
  await page.getByText('发布记录加载失败，请重试', { exact: true }).waitFor()
  mineError = false
  await button('重新加载').click()
  await page.locator('.my-post-card').first().waitFor()
  await page.locator('.k-navbar__back .k-icon').click()
  await page.waitForURL(/community\/publish/)
  empty = true
  await open('pages/community/mine'); await page.getByText('还没有发布内容', { exact: true }).waitFor()
  checks.push('320px layouts fit; loading failure can retry; empty state offers publish action')
  assert.deepEqual(errors, [])
} finally {
  await writeFile(out + '/last-page.json', JSON.stringify({ url: page.url(), text: await page.locator('body').innerText() }, null, 2))
  await writeFile(out + '/browser-result.json', JSON.stringify({ checks, errors, published, pages }, null, 2))
  await browser.close()
}
console.log(JSON.stringify({ checks, errors }, null, 2))
