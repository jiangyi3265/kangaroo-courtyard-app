// Read-only browser regression: injected API failures/delays never change server data.
const { chromium } = require('playwright')
const assert = require('node:assert/strict'), fs = require('node:fs/promises'), path = require('node:path')
const base = process.env.AUDIT_BASE || 'http://127.0.0.1:5193'
const out = process.env.AUDIT_OUT ? path.resolve(process.env.AUDIT_OUT) : path.resolve(__dirname, '../../artifacts/stays-deep-audit-20261027')
const today = new Date(Date.now() + 8 * 3600000).toISOString().slice(0, 10)
const day = offset => new Date(Date.parse(today + 'T00:00:00Z') + offset * 86400000).toISOString().slice(0, 10)
const dateA = day(1), dateAEnd = day(2), dateB = day(3), dateBEnd = day(4)
const dot = value => value.slice(5).split('-').map(Number).join('.')
const deferred = () => { let resolve; return { promise: new Promise(r => { resolve = r }), release: () => resolve() } }
;(async () => {
  await fs.mkdir(out, { recursive: true })
  const browser = await chromium.launch(), results = [], errors = []
  const page = async width => { const p = await browser.newPage({ viewport: { width, height: 844 }, isMobile: true, hasTouch: true }); p.on('pageerror', e => errors.push(e.message)); return p }
  const navigate = async (p, route) => { await p.goto(base + '/#' + route, { waitUntil: 'networkidle' }) }
  const snapshot = async (p, name) => { await p.evaluate(() => document.fonts.ready); await p.screenshot({ path: path.join(out, name + '.png'), fullPage: true }) }
  try {
    for (const width of [390, 320]) {
      const p = await page(width); let fail = true
      await p.route('**/app/stay/7/room-types?**', async route => fail ? route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ code: 503, msg: 'simulated availability outage' }) }) : route.continue())
      await navigate(p, '/pages/stays/detail?stayId=7'); await p.locator('.rooms-state--error').waitFor()
      assert.equal(await p.locator('.rt').count(), 0)
      assert.equal(await p.locator('.book').getAttribute('aria-disabled'), 'true')
      const url = p.url(); await p.locator('.book').click({ force: true }); assert.equal(p.url(), url)
      assert(!await p.locator('.stay-booking-dock').innerText().then(t => /¥/.test(t)))
      assert(!await p.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1))
      await snapshot(p, 'fixed-error-' + width)
      fail = false; await p.locator('.rooms-state__retry').click(); await p.locator('.rt').first().waitFor()
      assert.equal(await p.locator('.book').getAttribute('aria-disabled'), 'false')
      await p.locator('.rt:not(.off)').first().click(); assert.equal(await p.locator('.rt.on').count(), 1)
      await snapshot(p, 'fixed-retry-' + width)
      results.push({ check: 'availability failure blocks booking and retry restores real rooms', width, passed: true }); await p.close()
    }
    const p = await page(390), old = deferred(); let sawOld
    const oldStarted = new Promise(r => { sawOld = r })
    await p.route('**/app/stay/7/room-types?**', async route => {
      const date = new URL(route.request().url()).searchParams.get('checkIn'), response = await route.fetch(), body = await response.json()
      if (date === dateA) { sawOld(); await old.promise; body.data = body.data.map(r => ({ ...r, priceFromFen: 12300, bookable: false, reason: 'OLD DATE FULL' })) }
      if (date === dateB) body.data = body.data.map(r => ({ ...r, priceFromFen: 45600, bookable: true }))
      await route.fulfill({ response, json: body })
    })
    await navigate(p, '/pages/stays/detail?stayId=7'); await p.locator('.rt').first().waitFor()
    async function choose(start, end) { await p.locator('.rooms-head__note').click(); await p.locator(`.rp-cell[data-date="${start}"]`).click(); await p.locator(`.rp-cell[data-date="${end}"]`).click(); await p.locator('.rp-foot').click(); await p.locator('.rp-panel').waitFor({ state: 'detached' }) }
    await choose(dateA, dateAEnd); await oldStarted
    assert.equal(await p.locator('.rt').count(), 0); assert.equal(await p.locator('.book').getAttribute('aria-disabled'), 'true')
    await choose(dateB, dateBEnd); await p.locator('.rt__num').first().filter({ hasText: '456' }).waitFor()
    const oldResponse = p.waitForResponse(r => r.url().includes('/room-types?') && r.url().includes('checkIn=' + dateA))
    old.release(); await oldResponse; await p.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))))
    assert((await p.locator('.rooms-head__note').innerText()).includes(dot(dateB) + '-' + dot(dateBEnd)))
    assert((await p.locator('.rt__num').allTextContents()).every(t => t === '456'))
    await snapshot(p, 'fixed-stale-dates'); results.push({ check: 'old date response cannot overwrite latest prices or availability', passed: true }); await p.close()

    const q = await page(320), first = deferred(), second = deferred(); const requests = []; let firstStarted, secondStarted
    const firstReady = new Promise(r => { firstStarted = r }), secondReady = new Promise(r => { secondStarted = r })
    await q.route('**/app/stay/orders/quote', async route => {
      const params = route.request().postDataJSON(); requests.push(params)
      const index = requests.length
      if (index === 1) { firstStarted(); await first.promise } else { secondStarted(); await second.promise }
      await route.fulfill({ json: { code: 200, data: { bookable: true, roomFen: index === 1 ? 12300 : 45600, totalFen: index === 1 ? 12300 : 45600 } } })
    })
    await q.route('**/app/stay/room-types/*/recommend?**', route => route.fulfill({ json: { code: 200, data: null } }))
    await navigate(q, '/pages/stays/booking?stayId=7'); await q.locator('.type-card').nth(1).waitFor()
    await q.locator('.type-card').nth(0).click(); await firstReady
    await q.locator('.type-card').nth(1).click(); await secondReady
    await q.locator('.cta__btn .k-button').click(); await q.locator('.calendar-grid').waitFor()
    await q.locator('.booking-state').filter({ hasText: '正在加载房态' }).waitFor({ state: 'detached' })
    assert(await q.locator('.cta__btn .k-button').evaluate(e => e.hasAttribute('disabled') || e.classList.contains('is-disabled')))
    assert.equal(await q.locator('.cta__price').innerText(), '¥--')
    first.release(); await q.waitForResponse(r => r.url().includes('/orders/quote')); await q.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))))
    assert.equal(await q.locator('.cta__price').innerText(), '¥--')
    const currentResponse = q.waitForResponse(r => r.url().includes('/orders/quote')); second.release(); await currentResponse
    await q.locator('.cta__price').filter({ hasText: '¥456' }).waitFor()
    await q.locator('.cta__btn .k-button:not(.is-disabled)').waitFor()
    assert.notEqual(requests[0].roomTypeId, requests[1].roomTypeId)
    assert(!await q.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1))
    await snapshot(q, 'fixed-booking-quote-320')
    results.push({ check: 'booking clears prior quote, disables continuation and ignores old room quote', width: 320, passed: true }); await q.close()
    assert.deepEqual(errors, [])
    await fs.writeFile(path.join(out, 'verification.json'), JSON.stringify({ base, results, errors }, null, 2)); console.log(JSON.stringify({ passed: results.length, errors }))
  } finally { await browser.close() }
})().catch(e => { console.error(e); process.exitCode = 1 })
