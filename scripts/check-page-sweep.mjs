// 全页面巡检：以真实令牌冷启动 H5，把 pages.json 里每个页面的每一屏（?s=1..4）都打开一遍，
// 收集三类问题：页面运行时异常（pageerror）、控制台 error、业务接口失败（/app/ 与 /kangaroo/ 请求 HTTP >= 500
// 或返回体 code >= 500）。4xx 单列为「需人工看」，因为缺参数的深链页面、身份不符的页面本来就会被拒。
//
// 为什么要它：C08 / C18 / C23 只走主线，V7 起接上的 30 多个页面从没有被逐屏打开过，
// 页面一打开就报错、或调了一个后端没有的接口，此前只能靠人点。
//
// 用法（dev server 与后端已起，后端为联调模式）：
//   KG_USER_TOKEN=<普通用户令牌> KG_STAFF_TOKEN=<主理人令牌> node scripts/check-page-sweep.mjs [输出目录]
// 员工端与经营端页面（pages/staff、pages/manage）用主理人令牌打开，其余用普通用户令牌。
// 退出码：有 pageerror / 5xx / 未登记的控制台错误就非 0。
import { chromium } from 'playwright'
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const BASE = process.env.FLOW_TEST_URL || 'http://127.0.0.1:5273/'
const OUT = process.argv[2] || join(ROOT, '..', 'artifacts', 'page-sweep')
const USER = process.env.KG_USER_TOKEN
const STAFF = process.env.KG_STAFF_TOKEN
if (!USER || !STAFF) {
  console.error('缺少 KG_USER_TOKEN / KG_STAFF_TOKEN')
  process.exit(2)
}
mkdirSync(OUT, { recursive: true })

// 已知、与业务无关的控制台噪声：uni-h5 的 showActionSheet 在主题值非 light/dark 时读 listItemColor 报错（common/ui.js 已规避，
// 但第三方组件内部仍可能触发）。只登记这一条，别的控制台错误一律算问题。
const KNOWN_NOISE = [/listItemColor/]

const cfg = JSON.parse(readFileSync(join(ROOT, 'pages.json'), 'utf8'))
const routes = cfg.pages.map(p => p.path)
for (const sp of cfg.subPackages || []) for (const p of sp.pages) routes.push(sp.root + '/' + p.path)

const browser = await chromium.launch({ headless: true, args: ['--no-proxy-server'] })
const results = []

async function sweep(token, list, who) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, timezoneId: 'Asia/Shanghai' })
  const page = await ctx.newPage()
  let cur = null
  page.on('pageerror', e => cur && cur.pageErrors.push(e.message.slice(0, 300)))
  page.on('console', m => {
    if (!cur || m.type() !== 'error') return
    const t = m.text().slice(0, 300)
    if (KNOWN_NOISE.some(r => r.test(t))) return
    // 浏览器自己打印的「Failed to load resource: 4xx」由下面的响应监听按接口归类，这里不重复记
    if (/Failed to load resource/.test(t)) return
    cur.console.push(t)
  })
  page.on('response', async (r) => {
    if (!cur) return
    const record = cur
    const url = r.url()
    if (!/\/(app|kangaroo)\//.test(url)) return
    let code = r.status()
    try {
      const ct = r.headers()['content-type'] || ''
      if (ct.includes('json')) {
        const b = await r.json()
        if (b && typeof b.code === 'number') code = b.code === 200 ? r.status() : b.code
        if (code >= 400) record.api.push(`${code} ${r.request().method()} ${url.replace(/^https?:\/\/[^/]+/, '')} ${String(b.msg || '').slice(0, 80)}`)
        return
      }
    } catch (e) { /* 非 JSON 响应按 HTTP 状态判 */ }
    if (code >= 400) record.api.push(`${code} ${r.request().method()} ${url.replace(/^https?:\/\/[^/]+/, '')}`)
  })
  await page.goto(BASE + '#/pages/home/index', { waitUntil: 'domcontentloaded' })
  await page.locator('uni-page-body').first().waitFor({ timeout: 30000 })
  await page.evaluate((t) => localStorage.setItem('kangaroo:app-token', JSON.stringify({type:'string',data:t})), token)
  await page.reload({ waitUntil: 'domcontentloaded' })
  await page.locator('uni-page-body').first().waitFor({ timeout: 30000 })
  await page.waitForTimeout(1500)
  for (const route of list) {
    for (let s = 1; s <= 4; s++) {
      cur = { who, route: `/${route}?s=${s}`, pageErrors: [], console: [], api: [] }
      try {
        await page.goto(BASE + '#' + cur.route)
        await page.reload({waitUntil:'domcontentloaded'})
        await page.locator('uni-page-body').first().waitFor({timeout:20000})
        await page.waitForTimeout(2200)
        cur.finalUrl=page.url()
        cur.visibleText=(await page.locator('uni-page-body').first().innerText()).trim().slice(0,150)
        if(!cur.visibleText)cur.pageErrors.push('页面没有可见业务文字')
      } catch (e) {
        cur.pageErrors.push('打开失败：' + String(e.message || e).slice(0, 200))
      }
      results.push(cur)
      cur = null
    }
  }
  await ctx.close()
}

const staffSide = routes.filter(r => /^pages\/(staff|manage)\//.test(r))
const userSide = routes.filter(r => !/^pages\/(staff|manage)\//.test(r))
await sweep(USER, userSide, 'user')
await sweep(STAFF, staffSide, 'manager')
await browser.close()

const hard = results.filter(r => r.pageErrors.length || r.console.length || r.api.some(a => /^5\d\d /.test(a)))
const soft = results.filter(r => !hard.includes(r) && r.api.length)
writeFileSync(join(OUT, 'sweep.json'), JSON.stringify({ routes: routes.length, screens: results.length, hard, soft,results }, null, 2))
console.log(`巡检 ${routes.length} 个页面 × 4 屏 = ${results.length} 屏；硬错误 ${hard.length} 屏，4xx 需人工看 ${soft.length} 屏`)
for (const r of hard) console.log('[硬错误]', r.who, r.route, JSON.stringify({ pageErrors: r.pageErrors, console: r.console, api: r.api }))
for (const r of soft) console.log('[4xx]', r.who, r.route, r.api.join(' | '))
process.exit(hard.length ? 1 : 0)
