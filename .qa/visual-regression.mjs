/**
 * 页面版式回归：把接线后的页面与**基线提交**的同一页面并排跑起来比对。
 *
 * 为什么需要它：`.qa/template-guard.py` 比的是源码（标签序列、class、文案、指令），
 * 它证明不了"渲染出来长得一样"。而项目主人最在意的恰恰是"页面外观和交互没变"。
 * 这里的做法是把基线提交单独 checkout 成一个 worktree、单独跑一个 dev server，
 * 然后同一条路由在两个 server 上各渲染一次，比几何布局并留下并排截图。
 *
 * 判负条件（只挑那些"一定是问题"的，避免误报逼人关检查）：
 *   1. 页面抛 JS 异常；
 *   2. 当前版本出现了基线没有的横向溢出；
 *   3. 基线里存在的某个静态 class，在当前版本里**一个都不剩**（整块区域消失了），
 *      且没有登记在 .qa/approved-layout.json 里。
 *
 * 只做记录、不判负的（这些变化是接线的正当后果，硬判会淹没在误报里）：
 *   - 页面高度差（文案变了、真实数据比设计稿长或短，高度必然变）；
 *   - 某个 class 的元素个数变化（列表条数由真实数据决定）。
 *
 * 截图落在 artifacts/visual/，**最终是否可接受由人看截图决定**，
 * 这个脚本只负责把该看的东西摆到眼前，并挡住那几类一定是错的情况。
 *
 * 用法：
 *   BASE_CURRENT=http://127.0.0.1:5273/ BASE_BASELINE=http://127.0.0.1:5373/ \
 *     node .qa/visual-regression.mjs
 *   加 --approve 把当前的"整块消失"差异登记进 .qa/approved-layout.json
 */
import { chromium } from 'playwright'
import assert from 'node:assert/strict'
import { mkdir, writeFile, readFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const QA = dirname(fileURLToPath(import.meta.url))
const ROOT = join(QA, '..')
const OUT = process.env.VISUAL_OUT || join(ROOT, '..', 'artifacts', 'visual')
const APPROVED = join(QA, 'approved-layout.json')
const approveMode = process.argv.includes('--approve')

const CURRENT = (process.env.BASE_CURRENT || 'http://127.0.0.1:5273/').replace(/\/+$/, '') + '/'
const BASELINE = (process.env.BASE_BASELINE || 'http://127.0.0.1:5373/').replace(/\/+$/, '') + '/'

// 接线过程中改动过的页面。每页 4 屏（所有页面都是 useScreen(4)）。
const PAGES = [
  'pages/auth/login',
  'pages/jobs/list',
  'pages/jobs/detail',
  'pages/jobs/apply',
  'pages/jobs/progress',
  'pages/jobs/interview',
  'pages/jobs/contract',
  'pages/jobs/filter',
  'pages/messages/index',
  'pages/messages/reminders',
  'pages/profile/index',
  'pages/staff/applications',
  'pages/staff/index',
]
const SCREENS = [1, 2, 3, 4]

// 有些页面必须带参数才有内容可看。不带的话它们会提示并退回首页，
// 比对就退化成"拿首页和详情页比"，毫无意义（第一次跑就踩了这个坑）。
// progress / interview / contract 不在此列：它们对"带 ?s= 但没有 appId"
// 有明确的设计走查模式，两边都渲染设计稿内容，可以直接比。
const EXTRA_QUERY = {
  // The real job id is selected and validated below; seed ids are not stable.
  'pages/jobs/detail': '',
  'pages/jobs/apply': 'title=' + encodeURIComponent('古城咖啡馆驻店伙伴'),
}

const browser = await chromium.launch({ headless: true, args: ['--no-proxy-server'] })

/** 关掉动画与过渡，否则截图时机不同会造成假差异 */
const STOP_MOTION = `*,*::before,*::after{animation:none!important;transition:none!important;
  caret-color:transparent!important;scroll-behavior:auto!important}`

async function makeContext(token) {
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    // 与后端同一时区，理由同 scripts/check-entry-flow.mjs
    timezoneId: 'Asia/Shanghai',
    locale: 'zh-CN',
    deviceScaleFactor: 1,
    reducedMotion: 'reduce',
  })
  if (token) {
    // 当前版本的页面要有登录态才会拉真实数据；基线是纯静态原型，给不给都一样
    await ctx.addInitScript(([k, v]) => {
      try { window.localStorage.setItem(k, v) } catch (e) { /* 无痕模式下忽略 */ }
    }, ['kangaroo:app-token', token])
  }
  return ctx
}

/** 取一页的几何与异常信息 */
async function capture(page, base, route, s, shotPath) {
  const errors = []
  page.on('pageerror', e => errors.push(e.message))
  // 诊断用：页面没渲染出来时，要能看出是脚本加载失败、控制台报错还是单纯慢。
  // 只记录、不参与判定。2026-09-17 有一轮基线的 contract?s=3 白屏了 20 秒，
  // 事后同一屏连载 20 次都在 0.2 秒内渲染出来 —— 当时没有这份记录，原因只能推测。
  const diag = []
  page.on('console', m => { if (m.type() === 'error' && diag.length < 6) diag.push('console: ' + m.text().slice(0, 160)) })
  page.on('requestfailed', r => { if (diag.length < 6) diag.push('请求失败: ' + r.url().slice(0, 120) + ' ' + ((r.failure() || {}).errorText || '')) })
  page.on('response', r => { if (r.status() >= 400 && diag.length < 6) diag.push('HTTP ' + r.status() + ': ' + r.url().slice(0, 120)) })
  const t0 = Date.now()
  const extra = EXTRA_QUERY[route] ? '&' + EXTRA_QUERY[route] : ''
  await page.goto(`${base}#/${route}?s=${s}${extra}`, { waitUntil: 'domcontentloaded' })
  await page.addStyleTag({ content: STOP_MOTION }).catch(() => {})
  // 这两个 catch 是有意的：某些屏本来就会重定向，等不到根节点不代表失败。
  // 但"等不到"这件事必须被记录下来 —— 否则白屏的基线会让三条判负一起失效。
  let mounted = true
  await page.locator('uni-page-body .k-page').first().waitFor({ timeout: 20000 })
    .catch(() => { mounted = false })
  await page.waitForLoadState('networkidle').catch(() => {})
  await page.waitForTimeout(350)

  const info = await page.evaluate(() => {
    const boxes = {}
    for (const el of document.querySelectorAll('[class]')) {
      const names = String(el.className || '').split(/\s+/).filter(Boolean)
      const r = el.getBoundingClientRect()
      for (const c of names) {
        if (!c || c.startsWith('data-v')) continue
        ;(boxes[c] = boxes[c] || []).push({ x: Math.round(r.x), w: Math.round(r.width) })
      }
    }
    return {
      height: document.documentElement.scrollHeight,
      overflowX: document.documentElement.scrollWidth > window.innerWidth,
      // 有没有 uni-app 的页面根节点：白屏时它是 0
      roots: document.querySelectorAll('uni-page-body').length,
      boxes,
    }
  })
  info.mounted = mounted
  info.diag = diag
  info.loadMs = Date.now() - t0
  const png = await page.screenshot({ path: shotPath, fullPage: true })
  // 指纹用来识别"这一屏其实和另一屏渲染成了同一个东西"：
  // 没带参数的详情页会重定向、没有员工授权的员工页会落到身份页，
  // 这些屏比的是同一张图，对"页面有没有被改坏"没有信息量，不该算进覆盖数。
  const fingerprint = createHash('sha256').update(png).digest('hex').slice(0, 16)
  return { ...info, errors, fingerprint }
}

await mkdir(OUT, { recursive: true })

let approved = { _说明: '已登记的"整块区域消失"差异，需人工复核', 条目: {} }
if (existsSync(APPROVED)) {
  approved = JSON.parse(await readFile(APPROVED, 'utf8'))
}
const approvedSet = new Set(
  Object.entries(approved.条目 || {}).flatMap(([k, arr]) => arr.map(c => `${k} ${c}`)))

// 拿一个真实登录态给"当前"用
let token = ''
const api = process.env.FLOW_API_BASE || 'http://localhost:8080'
try {
  const r = await fetch(`${api}/app/auth/wx-login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    // 用演示种子里那个"有数据"的账号登录，而不是新建一个空账号。
    // 新账号没有任何消息与员工授权，提醒中心三屏会全是空的，
    // 比对出来满屏"整块消失"，既淹没真问题也逼着人去登记一堆无意义的差异。
    // h5-seed-app-01 有用户消息、员工消息和一个门店授权，三屏都有内容可比。
    // 联调模式下 openid 就是 'mock_' + code，所以这里传的 code 决定了用哪个账号。
    // 账号选择有讲究：基线那一版是接线之前的静态原型，跑起来永远是**未登录**态。
    // 如果当前版本用一个带员工授权的账号登录，experience.mode 会变成 staff，
    // 底部 tabbar 整个换成员工版（没有中间那颗"发布"按钮），
    // 于是满屏报"发布按钮消失了"——那是登录状态不同，不是代码改动，属于假差异。
    // 所以这里用一个**有消息、但没有员工授权**的演示账号，让两边的 tabbar 口径一致。
    // 代价是提醒中心的员工端两屏（s=2/s=3）对这个账号为空，已在 approved-layout.json 里注明。
    body: JSON.stringify({ code: 'h5-seed-app-04' }),
  }).then(x => x.json())
  token = r?.token || ''
} catch (e) {
  console.log('[提示] 拿不到登录态，当前版本将以游客身份渲染：' + e.message)
}

// Rendering a stale-id error page is not a successful layout check. Select a
// published offline job using the real public API and verify its actual detail.
const listResponse = await fetch(`${api}/app/job/list?type=volunteer&pageNum=1&pageSize=50`).then(r => r.json())
assert.equal(listResponse.code, 200, 'Public job list must succeed before visual comparison')
const detailJob = (listResponse.rows || listResponse.data || []).find(j => j.jobType === 'volunteer')
assert.ok(detailJob?.jobId, 'No published offline job: visual job-detail fixture is unavailable')
const jobResponse = await fetch(`${api}/app/job/${detailJob.jobId}`).then(r => r.json())
assert.equal(jobResponse.code, 200, 'Selected job detail must be publicly available')
assert.equal(jobResponse.data?.jobId, detailJob.jobId)
assert.equal(jobResponse.data?.jobType, 'volunteer')
EXTRA_QUERY['pages/jobs/detail'] = `jobId=${detailJob.jobId}`
console.log(`Validated visual fixture: offline job ${detailJob.jobId}`)

const rows = []
const failures = []
const newlyMissing = {}

for (const route of PAGES) {
  for (const s of SCREENS) {
    const tag = `${route.replace(/\//g, '-')}-s${s}`
    const ctxB = await makeContext('')
    const ctxC = await makeContext(token)
    const pB = await ctxB.newPage()
    const pC = await ctxC.newPage()
    const base = await capture(pB, BASELINE, route, s, join(OUT, `${tag}-baseline.png`))
    const cur = await capture(pC, CURRENT, route, s, join(OUT, `${tag}-current.png`))
    if (route === 'pages/jobs/detail') {
      assert.ok(cur.boxes['detail-tab']?.length === 4, 'All four offline job detail tabs must really render')
    }
    await ctxB.close()
    await ctxC.close()

    // 判负 0：两侧都必须真的渲染出来了。
    //
    // 这一条是后补的，因为其余三条判负全都依赖"基线确实渲染了"这个前提：
    // 基线白屏时 base.boxes 是 {}，判负 3（基线里有、当前没有的区块）恒为空，
    // 判负 2 也只剩半个条件 —— 52 屏会全部判过，而这次比对什么都没比。
    // 没有这一条，"页面版式回归通过"可以只是因为基线 dev server 没挂载。
    const MIN_BOXES = 5
    for (const [who, snap] of [['基线', base], ['当前版本', cur]]) {
      if (!snap.roots || Object.keys(snap.boxes).length < MIN_BOXES) {
        failures.push(`${route}?s=${s} ${who}没有渲染出来`
          + `（页面根节点 ${snap.roots} 个、静态区块 ${Object.keys(snap.boxes).length} 个`
          + `${snap.mounted ? '' : '、根节点始终没出现'}，耗时 ${snap.loadMs}ms）。`
          + '本屏的比对无效，不能算通过 —— 多半是对应的 dev server 没起来或构建失败。'
          + (snap.diag && snap.diag.length ? ' 诊断：' + snap.diag.join(' | ') : ' 诊断：没有控制台报错、没有失败的请求'))
      }
    }

    // 判负 1：当前版本抛异常
    if (cur.errors.length) {
      failures.push(`${route}?s=${s} 当前版本抛出 JS 异常：${cur.errors.join(' | ')}`)
    }
    // 判负 2：基线不溢出、当前溢出
    if (cur.overflowX && !base.overflowX) {
      failures.push(`${route}?s=${s} 当前版本出现横向溢出，基线没有`)
    }
    // 判负 3：基线里有的静态 class 在当前版本一个都不剩
    const gone = Object.keys(base.boxes).filter(c => !cur.boxes[c])
    const unapproved = gone.filter(c => !approvedSet.has(`${route}?s=${s} ${c}`))
    if (unapproved.length) {
      if (approveMode) {
        newlyMissing[`${route}?s=${s}`] = gone
      } else {
        failures.push(`${route}?s=${s} 这些区域整块消失且未登记：${unapproved.join(', ')}`)
      }
    } else if (approveMode && gone.length) {
      newlyMissing[`${route}?s=${s}`] = gone
    }

    rows.push({
      route, s,
      当前指纹: cur.fingerprint,
      基线高度: base.height, 当前高度: cur.height,
      高度差: cur.height - base.height,
      基线区块数: Object.keys(base.boxes).length,
      当前区块数: Object.keys(cur.boxes).length,
      整块消失: gone,
    })
    process.stdout.write(`  ${tag}  高度 ${base.height} -> ${cur.height}`
      + (gone.length ? `  消失区块 ${gone.length} 个` : '') + '\n')
  }
}

await browser.close()

if (approveMode) {
  approved.条目 = newlyMissing
  approved.生成时间 = new Date().toISOString().slice(0, 19).replace('T', ' ')
  await writeFile(APPROVED, JSON.stringify(approved, null, 1), 'utf8')
  console.log(`\n已登记 ${Object.keys(newlyMissing).length} 屏的"整块消失"差异到 .qa/approved-layout.json`)
  console.log('请逐条复核：这些区域是因为真实数据为空而隐藏，还是被误删了。')
  process.exit(0)
}

await writeFile(join(OUT, 'report.json'), JSON.stringify(rows, null, 1), 'utf8')

// 按当前版本的渲染指纹归组，算出真正不同的屏有多少
const byPrint = new Map()
for (const r of rows) {
  const k = r.当前指纹 || ('x' + Math.random())
  if (!byPrint.has(k)) byPrint.set(k, [])
  byPrint.get(k).push(`${r.route}?s=${r.s}`)
}
const dupGroups = [...byPrint.values()].filter(g => g.length > 1)
const distinct = byPrint.size
const dupScreens = rows.length - distinct

console.log(`\n对比了 ${rows.length} 屏，其中渲染结果互不相同的有 ${distinct} 屏`
  + `（${dupScreens} 屏与别的屏渲染成了同一个东西，不计入有效覆盖）；`
  + `截图与明细在 ${OUT}`)
if (dupGroups.length) {
  console.log(`\n渲染结果重复的 ${dupGroups.length} 组（多为缺参数重定向或无权限落到身份页，不判负）：`)
  for (const g of dupGroups) console.log('  ' + g.join('  ≡  '))
}
const bigShift = rows.filter(r => Math.abs(r.高度差) > 40)
if (bigShift.length) {
  console.log(`\n高度变化超过 40px 的 ${bigShift.length} 屏（只做记录，需人工看截图确认）：`)
  for (const r of bigShift) {
    console.log(`  ${r.route}?s=${r.s}  ${r.基线高度} -> ${r.当前高度}  (${r.高度差 > 0 ? '+' : ''}${r.高度差})`)
  }
}

if (failures.length) {
  console.log(`\n判负 ${failures.length} 条：`)
  for (const f of failures) console.log('  - ' + f)
  assert.fail(`页面版式回归有 ${failures.length} 条未通过`)
}
console.log('\nPASS: 没有 JS 异常、没有新增横向溢出、没有未登记的整块区域消失')
