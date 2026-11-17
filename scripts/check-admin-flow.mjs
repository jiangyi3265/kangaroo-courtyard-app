/**
 * 管理后台真实浏览器流程测试。
 *
 * 为什么这个文件放在小程序仓库里：Playwright 装在 袋鼠旅游/node_modules 下
 * （pnpm 管理），ESM 的 import 只沿文件所在目录向上找 node_modules。
 * 放到 RuoYi-Vue3 需要在那边单独装一份 Playwright —— 为了一个测试而多一份
 * 上百 MB 的依赖不划算。测的对象是 RuoYi-Vue3，跑的位置在这里。
 *
 * 覆盖什么：7 个业务菜单页面在真实浏览器里能打开、能拉到真实数据、
 * 能提交一次真实编辑并看到结果刷新、权限按钮按 sys_menu 配置渲染。
 *
 * 不覆盖什么（要如实说清楚）：
 *   1. 后台登录表单本身。登录要过图形验证码，答案在 Redis 里，
 *      从浏览器侧拿不到。登录链路由 e2e/test_kangaroo_flow.py 的 admin_login()
 *      覆盖（它走的是取验证码 -> 读 Redis -> 提交的生产同款路径）。
 *      这里用 KG_ADMIN_TOKEN 直接注入已登录态，从"登录之后"开始测。
 *   2. 像素级外观。这里只断言功能与数据，不做视觉比对。
 *
 * 用法：
 *   KG_ADMIN_TOKEN=<后台令牌> ADMIN_TEST_URL=http://127.0.0.1:8081/ \
 *     node scripts/check-admin-flow.mjs
 */
import { chromium } from 'playwright'
import assert from 'node:assert/strict'
import { mkdir } from 'node:fs/promises'

const base = (process.env.ADMIN_TEST_URL || 'http://127.0.0.1:8081/').replace(/\/+$/, '') + '/'
const token = process.env.KG_ADMIN_TOKEN
assert.ok(token, '缺少 KG_ADMIN_TOKEN：本测试从已登录态开始，令牌由调用方提供')

const browser = await chromium.launch({ headless: true })
// 与后端同一时区，避免页面上的日期筛选和后端的「今天」对不上
const context = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  timezoneId: 'Asia/Shanghai', locale: 'zh-CN',
})
// RuoYi-Vue3 的令牌存在名为 Admin-Token 的 cookie 里（src/utils/auth.js）
const origin = new URL(base)
await context.addCookies([{
  name: 'Admin-Token', value: token,
  domain: origin.hostname, path: '/'
}])
const page = await context.newPage()

const errors = []
page.on('pageerror', e => errors.push(e.message))
const failedRequests = []
page.on('response', r => {
  // 只盯业务接口；dev server 的 HMR 与静态资源不在此列
  if (r.url().includes('/dev-api/kangaroo/') && r.status() >= 400) {
    failedRequests.push(`${r.status()} ${r.url()}`)
  }
})

await mkdir('artifacts/admin-flow', { recursive: true }).catch(() => {})

// RuoYi-Vue3 用的是 history 模式（createWebHistory），路由是路径不是 hash。
// 传 #/kangaroo/store 会停在首页而不报错 —— 看起来"页面打开了"，其实什么都没测到。
const open = async route => {
  await page.goto(base + route.replace(/^\//, ''), { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('.app-main', { timeout: 20000 })
  await page.waitForLoadState('networkidle')
}

const shot = async name => {
  await page.screenshot({ path: `artifacts/admin-flow/${name}.png`, fullPage: false })
}

/** 表格里的真实数据行数（排除"暂无数据"占位） */
const rowCount = async () => page.locator('.el-table__body tbody tr.el-table__row').count()

const results = []
const step = async (name, fn) => {
  await fn()
  results.push(name)
  console.log(`  OK  ${name}`)
}

console.log(`管理后台浏览器流程测试  base=${base}`)

// ---------------------------------------------------------------- 1. 七个菜单页
const PAGES = [
  ['store', '门店管理'],
  ['job', '岗位管理'],
  ['application', '报名管理'],
  ['slot', '面试时段'],
  ['grant', '员工授权'],
  ['appuser', '小程序账号'],
  ['message', '站内消息']
]

const counts = {}
for (const [route, label] of PAGES) {
  await step(`${label}页能打开并拉到真实数据`, async () => {
    await open(`/kangaroo/${route}`)
    // 列表接口返回后表格才有行；等到出现表格容器再数行
    await page.waitForSelector('.el-table', { timeout: 20000 })
    await page.waitForTimeout(400)
    const n = await rowCount()
    counts[route] = n
    assert.ok(n > 0, `${label}：表格一行数据都没有，接口或字段映射有问题`)
    await shot(route)
  })
}

// ---------------------------------------------------------------- 2. 数据真的来自后端
await step('门店列表的数据与数据库一致', async () => {
  // 这是本文件里唯一一条"页面上的数字真的来自数据库"的断言。
  // 原先拿不到期望值就走 else 分支只打印一句说明，然后照样打印 OK ——
  // 一次 mysql 失败就能把它静默关掉。现在拿不到就直接判失败。
  const raw = process.env.KG_EXPECT_STORES
  assert.ok(raw && /^\d+$/.test(raw),
    `没有拿到数据库里的门店数（KG_EXPECT_STORES=${JSON.stringify(raw)}），`
    + '这条"数据真的来自数据库"的比对无法进行，不能算通过')
  const expected = Number(raw)

  // 门店数超过一页时不能拿行数比，但接口返回的 total 一定等于库里的条数 ——
  // 换成比 total，比"跳过比对"有信息量得多。
  await open('/kangaroo/store')
  await page.waitForSelector('.el-table', { timeout: 20000 })
  const total = await page.evaluate(async () => {
    const r = await fetch('/dev-api/kangaroo/store/list?pageNum=1&pageSize=1', {
      headers: { Authorization: 'Bearer ' + (document.cookie.match(/Admin-Token=([^;]+)/) || [])[1] },
    })
    const b = await r.json()
    return b && b.total
  })
  assert.equal(Number(total), expected,
    `门店列表接口报 total=${total}，数据库里是 ${expected} 条`)
  if (expected <= 10) {
    assert.equal(counts.store, expected,
      `门店页显示 ${counts.store} 行，数据库里是 ${expected} 行`)
  }
})

// ---------------------------------------------------------------- 3. 真实编辑闭环
await step('岗位页改一次备注并看到列表刷新后的新值', async () => {
  await open('/kangaroo/job')
  await page.waitForSelector('.el-table', { timeout: 20000 })
  // 打开第一行的修改弹窗
  const editButton = page.locator('.el-table__body tbody tr').first().getByRole('button', { name: '修改' })
  await editButton.click()
  await page.waitForSelector('.el-dialog', { state: 'visible', timeout: 10000 })

  // 备注是自由文本，改它不会破坏业务状态
  const stamp = 'ADMINFLOW-' + Date.now()
  const remark = page.locator('.el-dialog').locator('textarea, input').last()
  const before = await remark.inputValue()      // 记下原值，测完改回去
  await remark.fill(stamp)
  await page.locator('.el-dialog').getByRole('button', { name: '确 定' }).click()
  await page.waitForSelector('.el-dialog', { state: 'hidden', timeout: 15000 })
  await page.waitForLoadState('networkidle')
  await page.waitForTimeout(500)

  // 重新打开同一行，确认新值确实回来了（而不是只弹了个"修改成功"）
  await page.locator('.el-table__body tbody tr').first().getByRole('button', { name: '修改' }).click()
  await page.waitForSelector('.el-dialog', { state: 'visible', timeout: 10000 })
  const backField = page.locator('.el-dialog').locator('textarea, input').last()
  const back = await backField.inputValue()
  assert.equal(back, stamp, '提交后重新打开，值没有回来 —— 说明写入没有真的发生')
  await shot('job-edit-roundtrip')

  // 把备注改回去：测试不该在演示数据里留下痕迹
  await backField.fill(before)
  await page.locator('.el-dialog').getByRole('button', { name: '确 定' }).click()
  await page.waitForSelector('.el-dialog', { state: 'hidden', timeout: 15000 })
  await page.waitForLoadState('networkidle')
})

// ---------------------------------------------------------------- 4. 查询条件真的生效
await step('报名管理按状态筛选：请求真的带上了条件，返回的每一行也真的是那个状态', async () => {
  // 这里原先只断言 `filtered <= all`。筛选只可能让行数变少或不变，
  // 所以那个条件恒成立 —— 筛选参数没发出去、后端忽略了 status、
  // 点下拉没触发查询，三种真故障都会得到 filtered === all 而照样通过。
  await open('/kangaroo/application')
  await page.waitForSelector('.el-table', { timeout: 20000 })
  const all = await rowCount()
  assert.ok(all > 0, '报名管理未筛选时一行都没有，后面的筛选比对没有意义')

  // 盯住列表请求，看筛选条件有没有真的发出去
  const sent = []
  const spy = r => {
    const u = r.url()
    if (u.includes('/kangaroo/application/list')) sent.push(u)
  }
  page.on('request', spy)

  // 必须按标签定位到「状态」那个下拉框。
  // 写 .el-select 的 first() 会点到「门店」——查询表单里状态排在第 6 个 el-form-item，
  // 结果发出去的是 storeId=... 而不是 status=...，断言当场红给我看了。
  const statusItem = page.locator('.el-form--inline .el-form-item').filter({ hasText: '状态' }).first()
  const select = statusItem.locator('.el-select').first()
  await select.click()
  // Element Plus 把每个 el-select 的下拉面板都传送到 body 上，页面里同时躺着 7 个面板、
  // 46 个 option，绝大多数是隐藏的。用全局 .el-select-dropdown__item 会拿到隐藏面板里的第一项，
  // 于是 waitForSelector 永远等不到它可见。只认当前可见的那个面板。
  const option = page.locator('.el-select-dropdown__item:visible').first()
  await option.waitFor({ state: 'visible', timeout: 10000 })
  const chosenLabel = (await option.innerText()).trim()
  await option.click()
  // 等"带 status 的那次列表响应"回来再读行。单页应用里点搜索不是导航，
  // waitForLoadState('networkidle') 会立刻返回，读到的可能还是筛选前的那一页。
  const filteredResp = page.waitForResponse(
    r => /\/kangaroo\/application\/list\?.*status=/.test(r.url()), { timeout: 15000 })
  await page.getByRole('button', { name: '搜索' }).click()
  await filteredResp
  await page.waitForTimeout(400)
  page.off('request', spy)

  const withStatus = sent.filter(u => /[?&]status=[^&]+/.test(u))
  assert.ok(withStatus.length > 0,
    `点了「${chosenLabel}」再点搜索，但发出的列表请求里没有一条带 status 参数：`
    + JSON.stringify(sent.slice(-3)))

  const filtered = await rowCount()
  assert.ok(filtered <= all, `筛选后的行数 ${filtered} 反而多于未筛选的 ${all}`)

  // 真正有信息量的那一条：返回的每一行状态列都必须等于所选状态。
  // 后端忽略 status 时这里会立刻红。
  if (filtered > 0) {
    const labels = await page.locator('.el-table__body tbody tr.el-table__row')
      .evaluateAll(rows => rows.map(tr => tr.innerText))
    const bad = labels.filter(t => !t.includes(chosenLabel))
    assert.equal(bad.length, 0,
      `按「${chosenLabel}」筛选后仍有 ${bad.length} 行不是这个状态，说明 status 条件没有真的生效`)
  } else {
    console.log(`     （按「${chosenLabel}」筛选后 0 行；请求已确认带上 status=，条件生效）`)
  }
  await shot('application-filter')
})

// ---------------------------------------------------------------- 5. 权限按钮按配置渲染
await step('列表页渲染出了受权限控制的操作按钮', async () => {
  await open('/kangaroo/store')
  await page.waitForSelector('.el-table', { timeout: 20000 })
  for (const name of ['修改', '删除']) {
    const n = await page.getByRole('button', { name }).count()
    assert.ok(n > 0, `门店页没有渲染出「${name}」按钮，v-hasPermi 或菜单配置有问题`)
  }
})

// ---------------------------------------------------------------- 6. 全程无异常
await step('全程没有页面异常、没有失败的业务请求', async () => {
  assert.deepEqual(errors, [], '页面抛出了 JS 异常')
  assert.deepEqual(failedRequests, [], '有业务接口返回了 4xx/5xx')
})

await browser.close()

console.log(`\nPASS: 管理后台 ${PAGES.length} 个业务页面在真实浏览器里打开、拉到真实数据、`
  + `完成一次可回读的编辑、筛选生效、权限按钮渲染正常，全程无异常`)
console.log(`各页数据行数: ${JSON.stringify(counts)}`)
console.log(`断言 ${results.length} 条，全部通过`)
