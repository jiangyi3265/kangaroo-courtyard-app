// Real navigation and inputs against explicit API fixtures. No live business writes.
import assert from 'node:assert/strict'
import { readFile, mkdir, writeFile } from 'node:fs/promises'
import { chromium } from 'playwright'
const out = '../artifacts/city-pickers-20261002'
const directory = JSON.parse(await readFile('../artifacts/city-coverage-20261002/service-directory.json', 'utf8'))
await mkdir(out + '/browser', { recursive: true })
const browser = await chromium.launch({ headless: true })
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true })
const page = await context.newPage(), errors = [], checks = [], requests = []
page.setDefaultTimeout(12000)
page.on('pageerror', e => errors.push(e.message))
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()) })
let cityFailure = false, stayCities = [{ city: '大理', count: 3 }, { city: '平潭', count: 2 }], profileCity = '大理'
await page.addInitScript(() => localStorage.setItem('kangaroo:app-token', JSON.stringify({ type: 'string', data: 'city-picker-test' })))
await page.route('**/app/**', async route => {
  const u = new URL(route.request().url()), p = u.pathname
  const body = route.request().postDataJSON()
  requests.push({ path: p, query: Object.fromEntries(u.searchParams), body })
  let data = {}, code = 200
  if (p === '/app/auth/account') data = { id: 9001, nickname: '城市测试', staffGrants: [{ active: true, role: 'owner', storeId: 102, storeName: '测试门店' }] }
  else if (p === '/app/cities') { data = directory; if (cityFailure) code = 500 }
  else if (p === '/app/community/feed') data = { rows: [], hots: [] }
  else if (p === '/app/community/buddies') data = { rows: [] }
  else if (p === '/app/activities') data = { groups: [] }
  else if (p === '/app/stay/cities') data = stayCities
  else if (['/app/stay/areas', '/app/stay/promos', '/app/job-subscriptions'].includes(p)) data = []
  else if (p === '/app/stay/list') data = { rows: [], total: 0 }
  else if (p === '/app/resume') data = { resume: { name: '测试', city: '大理' }, exps: [], stats: [], links: [] }
  else if (p === '/app/guide-apply') data = { cities: ['大理', '平潭'], latest: null }
  else if (p === '/app/trips') data = { groups: ['平潭', '大理'].map(city => ({ city, range: '10/02', total: 0, items: [] })) }
  else if (p === '/app/staff/dispatch/board') data = { cities: ['平潭', '大理'], city: u.searchParams.get('city') || '大理', cards: [], heat: {}, topStores: [] }
  else if (p === '/app/staff/talents/tags') data = { tags: [], cities: ['平潭', '大理', '福州'], total: 0 }
  else if (p === '/app/staff/talents/search') data = { rows: [], total: 0 }
  else if (p === '/app/manage/dashboard/trend') data = { city: u.searchParams.get('city') || '', cities: ['平潭', '大理'], orders: [], nights: [], apps: [], people: [], totals: [], insights: [], xLabels: [], stores: [] }
  else if (p === '/app/jobs/search') data = { rows: [], total: 0, jobs: [], conflicts: [], relax: [] }
  else if (p === '/app/me/profile') { if (body?.city) profileCity = body.city; data = { city: profileCity, nickname: '城市测试', records: [] } }
  else if (p === '/app/message/unread') data = { unread: 0 }
  else if (p === '/app/message/list') data = []
  await route.fulfill({ json: { code, msg: code === 200 ? '操作成功' : '测试城市加载失败', data } })
})
const open = async path => { await page.goto('http://127.0.0.1:5373/?picker-test=' + Date.now() + '#/' + path); await page.waitForLoadState('networkidle') }
const search = () => page.locator('.picker-search input')
const row = name => page.locator('.picker-row').filter({ has: page.getByText(name, { exact: true }) })
const searchFor = async (query, name = '平潭') => { await search().fill(query); await row(name).waitFor() }
const choose = async (query = '平潭', name = '平潭') => { await searchFor(query, name); await row(name).click() }
const returned = async () => { await page.waitForURL(url => !url.hash.includes('city-picker')); await page.waitForTimeout(100) }
const confirm = async () => { await page.locator('.picker-confirm').click(); await returned() }
try {
  await open('pages/community/index')
  await page.locator('.brand__city').click()
  await search().waitFor()
  await row('全部城市').waitFor()
  const initialRows = await page.locator('.picker-row').count()
  await page.locator('.picker-results').hover()
  await page.mouse.wheel(0, 10000)
  await page.waitForFunction(count => document.querySelectorAll('.picker-row').length > count, initialRows)
  checks.push('city list loads automatically while scrolling, without next-page action sheets')
  for (const q of ['平潭', '平潭县', '平潭岛', 'pingtan', 'PT']) await searchFor(q)
  await page.screenshot({ path: out + '/browser/search-390.png' })
  await row('平潭').click(); await returned()
  await page.locator('.brand__city').getByText('平潭', { exact: true }).waitFor()
  assert.ok(requests.some(r => r.path === '/app/community/feed' && r.query.city === '平潭'))
  checks.push('community search supports Chinese/full name/island alias/pinyin/initials and returns the selected city to feed API')
  await page.locator('.brand__city').click(); await searchFor('大理', '大理'); await page.locator('.picker-cancel').click(); await returned()
  await page.locator('.brand__city').getByText('平潭', { exact: true }).waitFor()
  await page.locator('.brand__city').click(); await row('全部城市').click(); await returned()
  await page.locator('.brand__city').getByText('全部城市', { exact: true }).waitFor()
  checks.push('single cancel preserves previous value; all-cities option remains usable')

  for (const [path, selector] of [
    ['pages/community/activity', '.city-select'],
    ['pages/community/publish', '.publish-row'],
    ['pages/community/chat?view=trip-publish', '.trip-preview-copy'],
    ['pages/profile/resume?s=2', '.form__input'],
    ['pages/profile/orders?s=4', '.form .k-input'],
    ['pages/community/trip', '.brand__city'],
    ['pages/staff/dispatch', '.board-filters uni-button'],
    ['pages/manage/dashboard?view=trend', '.select.k-flex1'],
  ]) {
    await open(path)
    // 2026-10-17 发布页改版：城市收进「补充信息」卡（默认收起），先展开
    if (path === 'pages/community/publish') await page.locator('.fold.extra .fold__head').click()
    const opener = path.includes('publish') && !path.includes('chat') ? page.locator(selector).filter({ hasText: '城市' })
      : path.includes('chat') ? page.locator(selector).getByText(/点此换城市/)
      : path.includes('resume') ? page.locator(selector).filter({ hasText: '大理' })
      : path.includes('dashboard') ? page.locator(selector).filter({ hasText: '全部城市' }) : page.locator(selector).first()
    await opener.click(); await choose('PT')
    if (path.includes('orders')) await confirm(); else await returned()
    const resultSelector = path.includes('resume') ? page.locator('.form__input').filter({ hasText: '平潭' })
      : path.includes('dashboard') ? page.locator('.select.k-flex1').filter({ hasText: '平潭' }) : opener
    await resultSelector.getByText(/平潭/).first().waitFor()
    checks.push(path + ': search and return preserved the original screen')
  }

  await open('pages/community/publish'); await page.locator('.fold.extra .fold__head').click()
  // Retain a draft field while visiting a separate picker page.
  const inputs = page.locator('input'); await inputs.first().fill('平潭草稿保留')
  await page.locator('.publish-row').filter({ hasText: '城市' }).click(); await choose(); await returned()
  assert.equal(await inputs.first().inputValue(), '平潭草稿保留')
  checks.push('published-content draft text is retained across city selection')

  await open('pages/jobs/filter')
  await page.locator('.filter-head__meta').first().click()
  await choose(); await searchFor('福州', '福州'); await row('福州').click()
  await page.locator('.picker-page .k-navbar__back').click(); await returned()
  await page.locator('.filter-head__meta').first().getByText('已选 1 个', { exact: true }).waitFor()
  await page.locator('.filter-head__meta').first().click(); await choose(); await confirm()
  await page.locator('.filter-head__meta').first().getByText('已选 2 个', { exact: true }).waitFor()
  checks.push('job multi-select cancellation discards draft; confirmation preserves previous cities and adds search result')
  await open('pages/jobs/filter?s=2')
  await page.getByText('添加城市', { exact: true }).click(); await choose(); await confirm()
  await page.locator('.selected-chip').getByText('平潭', { exact: true }).waitFor()
  checks.push('job-subscription cities use searchable multi-select')

  await open('pages/staff/talents?s=2')
  await page.getByText('＋ 选择城市', { exact: true }).click()
  await choose(); await choose('大理', '大理'); await choose('福州', '福州')
  await page.getByText('最多选择 2 个城市', { exact: true }).waitFor()
  assert.equal(await page.locator('.picker-tag').count(), 2)
  await confirm(); await page.getByText('平潭　×', { exact: true }).waitFor()
  checks.push('staff talent search respects business scope and two-city limit')

  await open('pages/stays/list'); await page.locator('.brand__city').click(); await searchFor('pingtan')
  await row('平潭').getByText(/2 家线上房源/).waitFor()
  await search().fill('泉州'); await page.getByText('没有找到匹配的城市', { exact: true }).waitFor()
  await choose(); await returned(); await page.locator('.brand__city').getByText('平潭', { exact: true }).waitFor()
  cityFailure = true
  await page.locator('.brand__city').click(); await searchFor('平潭'); await row('平潭').click(); await returned()
  cityFailure = false; stayCities = []
  await open('pages/stays/list'); await page.locator('.brand__city').click(); await page.getByText('暂无上线房源的城市', { exact: true }).waitFor()
  assert.equal(await page.locator('.picker-row').count(), 0)
  await page.locator('.picker-cancel').click(); await returned()
  checks.push('stay search retains room counts and available-city scope; empty scope never expands to national list; dictionary outage keeps supplied cities')

  await open('pages/profile/index?s=2')
  await page.locator('.frow').filter({ hasText: '常驻城市' }).click(); await choose(); await returned()
  assert.ok(requests.some(r => r.path === '/app/me/profile' && r.body?.city === '平潭'))
  checks.push('resident city selection reaches existing profile save API')

  await open('pages/auth/onboarding'); await page.locator('.city-search').click()
  await choose(); await choose('福州', '福州'); await page.setViewportSize({ width: 320, height: 740 })
  await searchFor('鼓楼区', '鼓楼区·福州')
  assert.ok(await page.locator('.picker-row').count() > 1)
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false)
  await page.screenshot({ path: out + '/browser/multi-320.png' })
  await confirm(); await page.locator('.selected-cities').getByText('平潭', { exact: true }).waitFor()
  await page.locator('.selected-cities').getByText('福州', { exact: true }).waitFor()
  checks.push('interest cities support nationwide multi-select; same-name districts show region; narrow-screen layout fits')

  cityFailure = true
  await page.locator('.city-search').click(); await page.getByText('城市加载失败，请重试', { exact: true }).waitFor()
  cityFailure = false; await page.getByText('重新加载', { exact: true }).click(); await searchFor('平潭')
  await search().fill('不存在xyz'); await page.getByText('没有找到匹配的城市', { exact: true }).waitFor()
  checks.push('nationwide loading failure offers retry and empty search offers recovery')
  assert.deepEqual(errors, [])
} finally {
  await writeFile(out + '/browser/result.json', JSON.stringify({ checks, errors, mockedBusinessWrites: requests.filter(r => r.body) }, null, 2))
  await browser.close()
}
console.log(JSON.stringify({ checks, errors }, null, 2))
