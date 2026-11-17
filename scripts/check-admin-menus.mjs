/**
 * 管理后台「侧边栏、字典标签、受限角色界面」浏览器测试。
 *
 * 此前这三件事都只有后端那一层的证据：
 *   F01  sys_menu 补齐了系统管理/系统监控，/getRouters 下发了 —— 但浏览器里从没有
 *        从侧边栏点进过任何一页，C11/C16 都是直接 goto 业务路由；
 *   F02  8 类业务字典的取值与 V2 脚本逐个对上了 —— 但列表里的枚举列到底显示中文标签
 *        还是 published / submitted 这样的原始码，没人断言过；
 *   F12  受限角色对 19 个接口逐个 403 —— 但用它登录之后侧边栏长什么样、
 *        没权限的按钮是不是真的藏起来了，没人看过。
 *
 * 这里全部在真实浏览器里做：
 *   A  超管：侧边栏三棵目录都在；系统管理/系统监控下的每一个叶子菜单**从侧边栏点进去**
 *      都能打开、不是 404、没有失败的接口；袋鼠小院含原 7 页和 V29 新增的 3 页、每个都点得开；
 *      6 个枚举列里的每一个单元格都是对应字典的中文标签，一个原始码都没有。
 *   B  受限角色（只有 kangaroo:store:list / query）：侧边栏只有袋鼠小院 → 门店管理；
 *      门店页能看到数据，但新增/修改/删除/认证/导出按钮一个都不渲染；
 *      直接在地址栏敲岗位页、用户管理页的路由，落到 404，且没有任何一次列表请求成功。
 *
 * 受限角色与用户由 e2e/run_admin_menus.py 建、跑完删干净，这里只拿令牌。
 *
 * 用法（通常经由 run_admin_menus.py 调）：
 *   KG_ADMIN_TOKEN=... KG_RESTRICTED_TOKEN=... ADMIN_TEST_URL=http://127.0.0.1:8081/ \
 *     FLOW_API_BASE=http://localhost:8080 node scripts/check-admin-menus.mjs
 */
import { chromium } from 'playwright'
import nodeAssert from 'node:assert/strict'
import { mkdir } from 'node:fs/promises'

let assertCount = 0
const assert = new Proxy(nodeAssert, {
  apply(t, thisArg, args) { assertCount += 1; return Reflect.apply(t, thisArg, args) },
  get(t, k, r) {
    const v = Reflect.get(t, k, r)
    if (typeof v !== 'function') return v
    return (...a) => { assertCount += 1; return v.apply(t, a) }
  },
})

const base = (process.env.ADMIN_TEST_URL || 'http://127.0.0.1:8081/').replace(/\/+$/, '') + '/'
const API = (process.env.FLOW_API_BASE || 'http://localhost:8080').replace(/\/+$/, '')
const adminToken = process.env.KG_ADMIN_TOKEN
const limitedToken = process.env.KG_RESTRICTED_TOKEN
assert.ok(adminToken, '缺少 KG_ADMIN_TOKEN')
assert.ok(limitedToken, '缺少 KG_RESTRICTED_TOKEN（由 e2e/run_admin_menus.py 建受限账号并登录）')

const OUT = 'artifacts/admin-menus'
await mkdir(OUT, { recursive: true }).catch(() => {})

const BUSINESS_MENUS = ['小程序账号', '门店管理', '员工授权', '岗位管理', '报名管理', '面试时段', '站内消息', '首页内容管理', '会员等级设置', '会员店铺权益']
// V29 菜单与对应 ExtEntity 合同，不能只放宽菜单数量或接受任意新增入口。
const NEW_BUSINESS_MENUS = {
  '首页内容管理': { route: '/kangaroo/homepick', entity: 'homepick', allowAdd: true, allowDelete: true },
  '会员等级设置': { route: '/kangaroo/memberlevel', entity: 'memberlevel', allowAdd: false, allowDelete: false },
  '会员店铺权益': { route: '/kangaroo/memberbenefit', entity: 'memberbenefit', allowAdd: true, allowDelete: true },
}

const browser = await chromium.launch({ headless: true })
const origin = new URL(base)

/** 以某个令牌开一个独立的浏览器上下文，并记录异常与失败请求 */
const session = async tok => {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 }, timezoneId: 'Asia/Shanghai', locale: 'zh-CN',
  })
  await context.addCookies([{
    name: 'Admin-Token', value: tok, domain: origin.hostname, path: '/',
    httpOnly: false, secure: false, sameSite: 'Lax',
  }])
  const page = await context.newPage()
  const s = { page, errors: [], failed: [], okLists: [], reqs: [], inflight: 0 }
  const api = q => q.url().includes('/dev-api/')
  page.on('pageerror', e => s.errors.push(e.message))
  page.on('request', q => { if (api(q)) { s.reqs.push(q.method() + ' ' + new URL(q.url()).pathname); s.inflight += 1 } })
  page.on('requestfinished', q => { if (api(q)) s.inflight -= 1 })
  page.on('requestfailed', q => { if (api(q)) s.inflight -= 1 })
  page.on('response', r => {
    const u = r.url()
    if (!u.includes('/dev-api/')) return
    if (r.status() >= 400) s.failed.push(`${r.status()} ${u}`)
    const path = new URL(u).pathname
    if (r.request().method() === 'GET' && path.endsWith('/list')) {
      r.json().then(b => { if (b && b.code === 200) s.okLists.push(path) }).catch(() => {})
    }
  })
  return s
}

const steps = []
const step = async (name, fn) => { await fn(); steps.push(name); console.log(`  OK  ${name}`) }

const topMenus = async page =>
  page.locator('.sidebar-container ul.el-menu--vertical > div > li.el-sub-menu > .el-sub-menu__title .menu-title')
    .allInnerTexts()

const subMenu = page => title =>
  page.locator('.sidebar-container ul.el-menu--vertical > div > li.el-sub-menu')
    .filter({ has: page.locator(':scope > .el-sub-menu__title .menu-title', { hasText: title }) }).first()

const expand = async (page, li) => {
  if ((await li.getAttribute('aria-expanded')) !== 'true') {
    await li.locator(':scope > .el-sub-menu__title').click()
    await page.waitForTimeout(350)
  }
}

/** 某棵目录下全部叶子菜单的 (标题, href)；嵌套的子目录一并展开 */
const leavesOf = async (page, li) => {
  await expand(page, li)
  for (const nested of await li.locator('li.el-sub-menu').all()) await expand(page, nested)
  const links = li.locator('a[href]')
  const out = []
  for (let i = 0; i < await links.count(); i += 1) {
    const a = links.nth(i)
    out.push({ title: (await a.innerText()).trim(), href: await a.getAttribute('href') })
  }
  return out
}

const is404 = async page => (await page.locator('.wscn-http404-container').count()) > 0

/**
 * 侧边栏点击之后等"这一页真的加载完"。
 *
 * 不能用 waitForLoadState('networkidle')：单页应用里路由切换不是一次导航，
 * 这个状态在首次加载时就已经达成了，之后调用会**立刻返回**；而开发构建下懒加载的页面
 * 要一秒左右才挂载。第一版就是这么写的 —— 系统管理/系统监控那十几页的"不是 404、
 * 没有失败的接口"是在页面还没加载出来时判的，等于什么都没验。
 *
 * 所以：先等到这一页发出了第一个接口请求（或者渲染出了 404 页），再等接口全部回来、
 * 安静 700ms，最后留 200ms 给响应处理函数跑完。
 */
const settle = async (s, reqBefore) => {
  const t0 = Date.now()
  while (Date.now() - t0 < 20000) {
    if (s.reqs.length > reqBefore || await is404(s.page)) break
    await s.page.waitForTimeout(100)
  }
  let quietSince = Date.now()
  while (Date.now() - t0 < 30000) {
    if (s.inflight > 0) quietSince = Date.now()
    else if (Date.now() - quietSince >= 700) break
    await s.page.waitForTimeout(100)
  }
  await s.page.waitForTimeout(200)
}

const ready = async page => {
  await page.waitForSelector('.app-main', { timeout: 20000 })
  await page.waitForLoadState('networkidle')
  await page.waitForTimeout(400)
}

console.log(`管理后台侧边栏 / 字典标签 / 受限角色界面  base=${base}`)

// ================================================================ A 超管
const A = await session(adminToken)
await A.page.goto(base + 'index', { waitUntil: 'domcontentloaded' })
await ready(A.page)

await step('超管侧边栏有袋鼠小院、系统管理、系统监控三棵目录（F01 / F02）', async () => {
  const tops = await topMenus(A.page)
  for (const t of ['袋鼠小院', '系统管理', '系统监控']) {
    assert.ok(tops.includes(t), `侧边栏里没有「${t}」，实际是：${tops.join(' / ')}`)
  }
  await A.page.screenshot({ path: `${OUT}/admin-sidebar.png` })
})

let visited = 0
for (const dir of ['系统管理', '系统监控']) {
  await step(`「${dir}」下的每一个菜单都能从侧边栏点进去：不是 404、没有失败的接口（F01）`, async () => {
    const li = subMenu(A.page)(dir)
    const leaves = await leavesOf(A.page, li)
    assert.ok(leaves.length >= 3, `「${dir}」下只有 ${leaves.length} 个菜单`)
    for (const leaf of leaves) {
      const failedBefore = A.failed.length
      const errBefore = A.errors.length
      // 每次都从侧边栏里点，不 goto：F01 要验的就是"侧边栏能点进去"
      const link = subMenu(A.page)(dir).locator(`a[href="${leaf.href}"]`).first()
      if (!(await link.isVisible())) await leavesOf(A.page, subMenu(A.page)(dir))
      const reqBefore = A.reqs.length
      await link.click()
      await A.page.waitForURL(u => u.pathname === leaf.href, { timeout: 20000 })
      await settle(A, reqBefore)
      assert.equal(await is404(A.page), false, `「${dir} / ${leaf.title}」点进去是 404`)
      assert.ok(A.reqs.length > reqBefore, `「${dir} / ${leaf.title}」点进去之后一个接口都没调，页面没加载出来`)
      assert.deepEqual(A.failed.slice(failedBefore), [], `「${dir} / ${leaf.title}」有接口失败`)
      assert.deepEqual(A.errors.slice(errBefore), [], `「${dir} / ${leaf.title}」页面抛了 JS 异常`)
      visited += 1
    }
  })
}

await step('袋鼠小院下完整 10 个业务页均能从侧边栏点开并拉到对应列表（F02）', async () => {
  const li = subMenu(A.page)('袋鼠小院')
  const leaves = await leavesOf(A.page, li)
  assert.deepEqual(leaves.map(l => l.title), BUSINESS_MENUS, '袋鼠小院菜单与原7页及V29新增3页的完整清单不一致')
  for (const leaf of leaves) {
    const expected = NEW_BUSINESS_MENUS[leaf.title]
    if (expected) assert.equal(leaf.href, expected.route, `「${leaf.title}」菜单跳错业务路由`)
    const link = subMenu(A.page)('袋鼠小院').locator(`a[href="${leaf.href}"]`).first()
    if (!(await link.isVisible())) await leavesOf(A.page, subMenu(A.page)('袋鼠小院'))
    const listsBefore = A.okLists.length
    const reqBefore = A.reqs.length
    await link.click()
    await A.page.waitForURL(u => u.pathname === leaf.href, { timeout: 20000 })
    await settle(A, reqBefore)
    await A.page.waitForSelector('.el-table', { timeout: 20000 })
    assert.equal(await is404(A.page), false, `「${leaf.title}」点进去是 404`)
    assert.ok(A.okLists.slice(listsBefore).some(p => p.startsWith('/dev-api/kangaroo/')),
      `「${leaf.title}」打开后没有成功拉到业务列表（本页成功的列表请求：${JSON.stringify(A.okLists.slice(listsBefore))}，`
      + `当前地址 ${A.page.url()}，此前共 ${listsBefore} 次；最近的请求：${JSON.stringify(A.reqs.slice(-6))}）`)
    if (expected) {
      assert.ok(A.okLists.slice(listsBefore).includes(`/dev-api/kangaroo/ext/${expected.entity}/list`),
        `「${leaf.title}」未读取自己的真实业务列表`)
      assert.equal(await A.page.getByRole('button', { name: '新增', exact: true }).count(), expected.allowAdd ? 1 : 0,
        `「${leaf.title}」新增按钮违反实体权限合同`)
      assert.equal(await A.page.locator('.mb8').getByRole('button', { name: '删除', exact: true }).count(), expected.allowDelete ? 1 : 0,
        `「${leaf.title}」删除按钮违反实体权限合同`)
      const rowCount = await A.page.locator('.el-table__body-wrapper tr.el-table__row').count()
      if (expected.entity === 'memberlevel') assert.equal(rowCount, 6, '既有六级成长体系应完整显示，修改权限检查不能在空表上通过')
      assert.equal(await A.page.locator('.el-table__body-wrapper').getByRole('button', { name: '修改', exact: true }).count(), rowCount,
        `「${leaf.title}」超管每条记录应有修改入口`)
    }
  }
})

// ---------------------------------------------------------------- 字典标签
const dictLabels = async type => {
  const r = await fetch(`${API}/system/dict/data/type/${type}`, {
    headers: { Authorization: 'Bearer ' + adminToken },
  }).then(x => x.json())
  const rows = r.data || []
  return { labels: new Set(rows.map(d => d.dictLabel)), values: new Set(rows.map(d => d.dictValue)) }
}

/** 列表里某一列（按表头文字定位）所有单元格的文本 */
const columnTexts = async (page, header) => {
  const ths = page.locator('.el-table__header-wrapper th')
  const n = await ths.count()
  let idx = -1
  for (let i = 0; i < n; i += 1) {
    if ((await ths.nth(i).innerText()).trim() === header) { idx = i; break }
  }
  assert.ok(idx >= 0, `列表里找不到「${header}」这一列`)
  return page.locator(`.el-table__body-wrapper tr.el-table__row td:nth-child(${idx + 1})`).allInnerTexts()
}

const DICT_COLUMNS = [
  { route: 'kangaroo/job', header: '分类', dict: 'kg_job_type' },
  { route: 'kangaroo/job', header: '状态', dict: 'kg_job_status' },
  { route: 'kangaroo/application', header: '状态', dict: 'kg_app_status' },
  { route: 'kangaroo/grant', header: '员工角色', dict: 'kg_staff_role' },
  { route: 'kangaroo/slot', header: '状态', dict: 'kg_slot_status' },
  { route: 'kangaroo/message', header: '分类', dict: 'kg_msg_category' },
]

await step('6 个枚举列的每个单元格都是字典里的中文标签，没有一个原始码（F02）', async () => {
  let cells = 0
  for (const c of DICT_COLUMNS) {
    const { labels, values } = await dictLabels(c.dict)
    assert.ok(labels.size >= 3, `字典 ${c.dict} 只取到 ${labels.size} 个标签`)
    await A.page.goto(base + c.route, { waitUntil: 'domcontentloaded' })
    await ready(A.page)
    await A.page.waitForSelector('.el-table__body-wrapper tr.el-table__row', { timeout: 20000 })
    const texts = (await columnTexts(A.page, c.header)).map(t => t.trim())
    assert.ok(texts.length > 0, `${c.route} 的「${c.header}」列一行都没有，判不出显示的是什么`)
    for (const t of texts) {
      assert.ok(labels.has(t), `${c.route} 的「${c.header}」列出现了「${t}」，它不是 ${c.dict} 的中文标签`
        + (values.has(t) ? '（这是原始码）' : ''))
    }
    cells += texts.length
  }
  assert.ok(cells >= 12, `一共只核对了 ${cells} 个单元格`)
})

await step('超管这一段全程没有页面异常', async () => {
  assert.deepEqual(A.errors, [], '页面抛出了 JS 异常')
})

// ================================================================ B 受限角色
const B = await session(limitedToken)
await B.page.goto(base + 'index', { waitUntil: 'domcontentloaded' })
await ready(B.page)

await step('受限角色的侧边栏只有「袋鼠小院 → 门店管理」，没有系统管理与其余业务页（F12）', async () => {
  const tops = await topMenus(B.page)
  assert.deepEqual(tops, ['袋鼠小院'], `受限角色看到了不该看到的目录：${tops.join(' / ')}`)
  const leaves = await leavesOf(B.page, subMenu(B.page)('袋鼠小院'))
  assert.deepEqual(leaves.map(l => l.title), ['门店管理'], '受限角色的业务菜单不止门店管理')
  await B.page.screenshot({ path: `${OUT}/restricted-sidebar.png` })
})

await step('受限角色能看门店数据，但新增/修改/删除/认证/导出按钮一个都不渲染（F12）', async () => {
  const link = subMenu(B.page)('袋鼠小院').locator('a[href="/kangaroo/store"]').first()
  const reqBefore = B.reqs.length
  await link.click()
  await B.page.waitForURL(u => u.pathname === '/kangaroo/store', { timeout: 20000 })
  await settle(B, reqBefore)
  await B.page.waitForSelector('.el-table__body-wrapper tr.el-table__row', { timeout: 20000 })
  assert.ok(await B.page.locator('.el-table__body-wrapper tr.el-table__row').count() > 0,
    '有查看权限却一行门店都看不到')
  for (const name of ['新增', '修改', '删除', '认证', '导出']) {
    const n = await B.page.getByRole('button', { name, exact: true }).count()
    assert.equal(n, 0, `没有对应权限，页面上却渲染了 ${n} 个「${name}」按钮`)
  }
  assert.deepEqual(B.failed, [], '受限角色正常浏览门店页时出现了失败的接口')
  await B.page.screenshot({ path: `${OUT}/restricted-store.png` })
})

for (const route of ['/kangaroo/job', '/system/user', ...Object.values(NEW_BUSINESS_MENUS).map(x => x.route)]) {
  await step(`受限角色在地址栏直接敲 ${route}：落到 404，且没有任何一次对应的列表请求成功（F12）`, async () => {
    const before = B.okLists.length
    // 真实导航（goto），networkidle 在这里是有效的；404 页挂在布局之外，没有 .app-main
    await B.page.goto(base + route.replace(/^\//, ''), { waitUntil: 'networkidle' })
    await B.page.locator('.wscn-http404-container, .app-main').first().waitFor({ timeout: 20000 })
    await B.page.waitForTimeout(500)
    assert.equal(await is404(B.page), true, `受限角色直接打开 ${route} 没有落到 404`)
    const leaked = B.okLists.slice(before).filter(p => !p.startsWith('/dev-api/kangaroo/store'))
    assert.deepEqual(leaked, [], `受限角色打开 ${route} 时有列表请求成功了`)
  })
}

await step('受限角色这一段全程没有页面异常', async () => {
  assert.deepEqual(B.errors, [], '页面抛出了 JS 异常')
})

await browser.close()
console.log(`\nPASS: 超管从侧边栏点开了系统管理/系统监控下 ${visited} 个页面与 ${BUSINESS_MENUS.length} 个业务页，`
  + `6 个枚举列全是中文标签；受限角色只看得到门店管理、没权限的按钮不渲染、越界路由落 404`)
console.log(`断言 ${assertCount} 条，全部通过`)
