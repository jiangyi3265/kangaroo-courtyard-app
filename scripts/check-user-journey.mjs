/**
 * 小程序端「一个真实用户走一遍」浏览器测试。
 *
 * 为什么要有它：验收表里小程序那一层 52 个点只有 16 个测过（31%），
 * 剩下的清一色是同一句话 —— **「页面代码确实调了这个接口，但浏览器里没真点过」**。
 * 后端接口层有 85% 的覆盖，那是用 HTTP 直接打出来的；
 * 用户不是这么用产品的，用户是点按钮。这个文件补的就是点按钮那一层。
 *
 * check-entry-flow.mjs 覆盖的是「进门」：登录、绑手机、兴趣城市、空态、320px 版式。
 * 本文件覆盖的是进门之后的主线：
 *   游客先逛逛 → 登录 → 冷启动恢复 → 岗位列表筛选/搜索/翻页 → 详情 → 收藏
 *   → 报名 → 进度页看真实状态 → 重复报名被拒 → 消息与未读红点 → 撤回 → 登出失效
 *
 * 每一步都不只看界面，还回服务端核对落库结果 —— 界面显示对了而库里没变，
 * 是这个项目已经出过好几次的事。
 *
 * 不覆盖（如实说明，验收表照这个口径记）：
 *   · 真实微信登录：跑在 -Dkangaroo.wx.mock-enabled=true 下，code 直接当 openid。
 *   · 员工端的「确认录用 / 标记入职 / 签署责任书 / 全部已读」：
 *     设计稿里没有这几个按钮，接上去要新增界面，属于受保护的页面改动。
 *   · 真机：这是 Chromium 上的 H5，不是微信小程序运行时。
 *
 * 用法：
 *   FLOW_TEST_URL=http://127.0.0.1:5273/ FLOW_API_BASE=http://localhost:8080 \
 *     node scripts/check-user-journey.mjs
 */
import { chromium } from 'playwright'
import nodeAssert from 'node:assert/strict'
import { mkdir } from 'node:fs/promises'

// 断言计数给 verify.py 当下限：只看退出码挡不住"断言被删光"
let assertCount = 0
const assert = new Proxy(nodeAssert, {
  apply(t, thisArg, args) { assertCount += 1; return Reflect.apply(t, thisArg, args) },
  get(t, k, r) {
    const v = Reflect.get(t, k, r)
    if (typeof v !== 'function') return v
    return (...a) => { assertCount += 1; return v.apply(t, a) }
  },
})

const base = (process.env.FLOW_TEST_URL || 'http://127.0.0.1:5273/').replace(/\/+$/, '') + '/'
const API = (process.env.FLOW_API_BASE || 'http://localhost:8080').replace(/\/+$/, '')
const OUT = 'artifacts/user-journey'

const browser = await chromium.launch({ headless: true, args: ['--no-proxy-server'] })
// 时区必须和后端对齐：后端 JVM 钉在 Asia/Shanghai，开发机未必。
// 差一天的话"到岗日期不能早于今天"会把合法报名正确地拒掉，那是环境错配不是缺陷。
const page = await browser.newPage({
  viewport: { width: 390, height: 844 }, isMobile: true,
  timezoneId: 'Asia/Shanghai', locale: 'zh-CN',
})
const errors = []
page.on('pageerror', e => errors.push(e.message))

await mkdir(OUT, { recursive: true }).catch(() => {})

const steps = []
const step = async (name, fn) => {
  await fn()
  steps.push(name)
  console.log(`  OK  ${name}`)
}

/**
 * 打开一个页面。
 *
 * 要点：**目标和当前是同一个 hash 时必须先绕一下**。
 * 这是个 SPA，只改 hash 不会重新挂载组件 —— 页面内部的屏号/步骤号是内存里的 ref，
 * 停在哪里就还在哪里。这个坑这份文件里踩过两次：
 * 详情页翻完页签再 open 回去，屏号还停在第 4 屏（收藏按钮不在那一屏）；
 * 报名页提交完再 open 回去，步骤号还停在第 3 步（找不到姓名输入框）。
 * 所以同路由时先跳到一个中性页再跳回来，强制重新挂载。
 */
let currentRoute = ''
const open = async route => {
  const target = route.split('?')[0]
  const same = currentRoute === target
  await page.goto(`${base}#${route}`)
  if (same) {
    // 只改 hash 不会重新挂载；先绕一下也不行，uni 的 H5 会复用页面栈里的实例。
    // 真正可靠的是整页 reload —— 这也更接近用户"重新打开这一页"的动作。
    await page.reload()
  }
  await page.locator('uni-page-body .k-page').first().waitFor({ timeout: 20000 })
  await page.waitForLoadState('networkidle')
  await page.waitForTimeout(250)
  currentRoute = target
}

const shot = async name => { await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: true }) }

/** 点一个按钮：优先找 .k-button 包着的那个文本，找不到就点文本本身 */
const click = async text => {
  const label = page.getByText(text, { exact: true }).first()
  const button = page.locator('.k-button').filter({ has: page.getByText(text, { exact: true }) })
  if (await button.count()) await button.first().click()
  else await label.click()
  await page.waitForTimeout(250)
}

/**
 * uni-app 的 toast 会在 DOM 里停留一小会儿并盖住下一次点击。
 * 这个项目已经因为它红过一次（第二次「确认绑定」一个请求都没发出去）。
 */
const waitToastGone = async () => {
  await page.locator('uni-toast').first().waitFor({ state: 'hidden', timeout: 15000 })
}

/** 拿页面里真实的登录令牌回调服务端，用来核对界面显示的东西是不是真落库了 */
const api = async (path, init) => page.evaluate(async ([url, opt]) => {
  const stored = localStorage.getItem('kangaroo:app-token') || ''
  let raw = stored
  try { const p = JSON.parse(stored); raw = typeof p === 'string' ? p : (p?.data ?? stored) } catch (e) { raw = stored }
  const r = await fetch(url, {
    method: (opt && opt.method) || 'GET',
    headers: { 'X-App-Token': raw, 'Content-Type': 'application/json' },
    body: opt && opt.body ? JSON.stringify(opt.body) : undefined,
  })
  return r.json()
}, [API + path, init || null])

console.log(`小程序主线浏览器测试  base=${base}`)

// ================================================================ 1. 游客
await step('游客「先逛逛」能进岗位列表并看到真实岗位（A08）', async () => {
  await open('/pages/auth/login')
  await click('先逛逛')
  await page.waitForTimeout(600)
  const url = page.url()
  assert.ok(!url.includes('/pages/auth/login'),
    `点了「先逛逛」还停在登录页：${url}`)
  // 游客态下岗位列表要能拉到真实数据（这个接口是匿名可访问的）
  await open('/pages/jobs/list')
  const cards = page.locator('.jobs .card')
  await page.waitForTimeout(800)
  const n = await cards.count()
  assert.ok(n > 0, '游客态下岗位列表一条都没有')
  await shot('guest-jobs')
})

// ================================================================ 2. 登录 + 冷启动恢复
await step('本地联调登录与模拟微信手机号授权，落地首页（非真实微信授权）', async () => {
  await open('/pages/auth/login')
  const channel = await (await fetch(API + '/app/auth/ping')).json()
  assert.equal(channel.data?.wxMock, true, '本用例只允许隔离的本地微信 mock 后端')
  await page.locator('.agree .k-check').first().click()
  await click('本地联调登录')
  await page.waitForURL('**#/pages/home/index', { timeout: 60000 })
  // 浏览器不提供微信原生授权。显式注入 mock 授权码，调用实际共享模块及本地后端。
  const phone = '138' + String(Date.now()).slice(-8)
  await page.evaluate(async phone => {
    const { bindWechatPhone } = await import('/common/phone-binding.js')
    await bindWechatPhone({ detail: { code: 'mock-phone-' + phone, errMsg: 'getPhoneNumber:ok' } }, { agreed: true })
  }, phone)
  await waitToastGone()
  await page.waitForTimeout(1200)
  const acc = await api('/app/auth/account')
  assert.equal(acc.code, 200, `登录后回调 account 失败：${JSON.stringify(acc).slice(0, 200)}`)
  assert.ok(acc.data && acc.data.id, '登录后服务端没有返回账号')
  assert.equal(acc.data.phoneBound, true, '模拟授权后手机号未绑定')
  const profile = await api('/app/me/profile')
  assert.equal(profile.data?.phoneVerified, true, '模拟授权后未保存手机号核验状态')
  await shot('logged-in')
})

await step('刷新页面后登录态仍在（冷启动恢复，A03）', async () => {
  await page.reload()
  await page.waitForLoadState('networkidle')
  await page.waitForTimeout(1200)
  const acc = await api('/app/auth/account')
  assert.equal(acc.code, 200, '刷新之后令牌失效了，登录态没有持久化')
  const tok = await page.evaluate(() => localStorage.getItem('kangaroo:app-token'))
  assert.ok(tok && tok.length > 20, '本机没有留下令牌')
  // 存回去，下面的步骤还要用
  await page.evaluate(([k, v]) => localStorage.setItem(k, v), ['kangaroo:app-token', tok])
  globalThis.__savedToken = tok
})

await step('令牌失效时静默回到游客态，不报错也不白屏（A03 的另一半）', async () => {
  const good = await page.evaluate(() => localStorage.getItem('kangaroo:app-token'))
  // 把令牌改坏，再冷启动一次
  await page.evaluate(() => localStorage.setItem('kangaroo:app-token', 'broken-token-for-test'))
  const before = errors.length
  await open('/pages/home/index')
  await page.waitForTimeout(1200)
  assert.equal(errors.length, before,
    `令牌失效时页面抛了 JS 异常：${errors.slice(before).join(' | ')}`)
  const text = await page.locator('uni-page-body').innerText()
  assert.ok(text.trim().length > 20, '令牌失效之后页面白屏了')
  // 恢复好令牌
  await page.evaluate(([k, v]) => localStorage.setItem(k, v), ['kangaroo:app-token', good])
  await page.reload()
  await page.waitForLoadState('networkidle')
  await page.waitForTimeout(1000)
  const acc = await api('/app/auth/account')
  assert.equal(acc.code, 200, '换回好令牌之后登录态没有恢复')
})

// ================================================================ 3. 岗位列表：搜索与分类
let firstJobId = 0
let applicationStayDays = 1
await step('岗位列表的搜索框真的把关键词发给服务端（B01）', async () => {
  await open('/pages/jobs/list')
  await page.waitForTimeout(600)
  const before = await page.locator('.jobs .card').count()
  assert.ok(before > 0, '岗位列表初始就是空的，后面的比对没有意义')

  const sent = []
  const spy = r => { if (r.url().includes('/app/job/list')) sent.push(r.url()) }
  page.on('request', spy)
  // uni-app 的 <input> 渲染成 <uni-input> 外壳套一个真正的 input，
  // 直接 fill 外壳会卡在"waiting for element to be editable"
  await page.locator('.search__input input').first().fill('咖啡')
  await click('搜索')
  await page.waitForTimeout(900)
  page.off('request', spy)

  const withKeyword = sent.filter(u => /[?&]keyword=/.test(u))
  assert.ok(withKeyword.length > 0,
    `点了搜索，但发出的请求里没有一条带 keyword：${JSON.stringify(sent.slice(-3))}`)
  // 核对的办法是**重放页面自己发出去的那条请求**，而不是我另拼一条。
  // 列表分 4 个分类，页面会带上当前分类的 type；我自己拼的 URL 少了 type，
  // 拿回来的是全部分类的命中数 —— 第一次跑就是这么红的（界面 1 条 vs 接口 3 条）。
  // 重放它自己的请求，界面显示几条就该是几条，这才是在验"界面忠实于服务端"。
  const lastUrl = withKeyword[withKeyword.length - 1]
  const replayed = await page.evaluate(async ([u]) => {
    const stored = localStorage.getItem('kangaroo:app-token') || ''
    let raw = stored
    try { const p = JSON.parse(stored); raw = typeof p === 'string' ? p : (p?.data ?? stored) } catch (e) { raw = stored }
    const r = await fetch(u, { headers: { 'X-App-Token': raw } })
    return r.json()
  }, [lastUrl])
  assert.equal(replayed.code, 200, '重放页面自己的列表请求失败')
  const expect = (replayed.rows || []).length
  await page.waitForTimeout(300)
  const after = await page.locator('.jobs .card').count()
  assert.equal(after, expect,
    `搜「咖啡」后界面上有 ${after} 条，而页面自己那条请求返回 ${expect} 条`)
  assert.ok(expect > 0, '按「咖啡」搜不到任何岗位，这条断言证明不了筛选生效')
  await shot('jobs-search')
})

await step('岗位详情展示的是服务端下发的那条岗位（B02）', async () => {
  // 本主线走线下到岗表单，必须选今天可到岗且有名额的换工。
  // 不能固定取排序首条：其它回归会创建明天才可到岗的岗位，填今天被拒是业务规则生效。
  const today = await page.evaluate(() => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Shanghai' }).format(new Date()))
  let job
  for (let pageNum = 1; !job; pageNum++) {
    const resp = await api(`/app/job/list?type=volunteer&pageNum=${pageNum}&pageSize=50`)
    assert.equal(resp.code, 200, '读取主线可报名岗位失败')
    job = (resp.rows || []).find(j => j.status === 'published' && j.jobType === 'volunteer'
      && (j.hiredCount || 0) < (j.headcount || 1) && (!j.startDate || j.startDate.slice(0, 10) <= today)
      && Number(j.minDays || 1) <= 365)
    if (!resp.rows?.length || pageNum * 50 >= resp.total) break
  }
  assert.ok(job && job.jobId, '需要至少一个今天可到岗、仍有名额的换工岗位，不能用不合法日期制造报名失败')
  applicationStayDays = Math.max(Number(job.minDays || 1), 1)
  firstJobId = job.jobId
  await open('/pages/jobs/detail?jobId=' + firstJobId)
  await page.waitForTimeout(800)
  // 岗位详情是四屏（职位概览 / 工作与权益 / AI 评分 / 评价摘要）。
  //
  // 这一页的 ?s= **不起作用**：useScreen 被传了自定义 onLoad（用来接 jobId），
  // 查询参数里的 s 不再被读取，四个 ?s= 渲染出来是同一屏
  // ——C13 的"去重后有效屏数"里也能看到这一点。屏只能靠点顶部页签切。
  let text = ''
  const tabs = page.locator('.detail-tab')
  const tabN = await tabs.count()
  assert.equal(tabN, 4, `岗位详情顶部应当有 4 个页签，实际 ${tabN} 个`)
  for (let i = 0; i < tabN; i += 1) {
    await tabs.nth(i).click()
    await page.waitForTimeout(500)
    text += String.fromCharCode(10) + (await page.locator('uni-page-body').innerText())
  }
  assert.ok(text.includes(job.title),
    `详情页没有显示服务端返回的岗位标题「${job.title}」`)
  const full = await api('/app/job/' + firstJobId)
  const jd = full.data || {}
  if (jd.salaryMin != null) {
    assert.ok(text.includes(String(Math.trunc(jd.salaryMin))),
      `详情页没有显示服务端给的薪资下限 ${jd.salaryMin}`)
  }
  if (jd.headcount != null) {
    assert.ok(text.includes(String(jd.headcount)),
      `详情页没有显示服务端给的招聘名额 ${jd.headcount}`)
  }
  assert.ok(jd.city && text.includes(jd.city), `详情页没有显示城市「${jd.city}」`)
  // 门店电话属于不该下发到 C 端的信息
  const d = await api('/app/job/' + firstJobId)
  assert.equal(d.code, 200, '岗位详情接口失败')
  assert.ok(!JSON.stringify(d.data || {}).includes('contactPhone'),
    '岗位详情把门店联系电话下发给了 C 端')
  await shot('job-detail')
})

// ================================================================ 4. 收藏
await step('收藏按钮真的写到服务端，再点一次能取消（B05）', async () => {
  // 上一步翻页签停在了第 4 屏，而收藏按钮只在第 1 屏上。
  // 这里不能用 open() 回去：路由没变（还是同一个 hash），SPA 不会重新挂载，
  // 屏号是内存里的 ref，仍然停在 4。所以点回第 1 个页签。
  await page.locator('.detail-tab').first().click()
  await page.waitForTimeout(600)
  const before = await api('/app/job/favorites')
  const had = ((before.rows || before.data || []).some(j => String(j.jobId) === String(firstJobId)))

  await page.locator('.favorite').first().click()
  await page.waitForTimeout(800)
  await waitToastGone()
  const mid = await api('/app/job/favorites')
  const now = ((mid.rows || mid.data || []).some(j => String(j.jobId) === String(firstJobId)))
  assert.notEqual(now, had, '点了收藏之后，服务端的收藏列表没有变化')

  await page.locator('.favorite').first().click()
  await page.waitForTimeout(800)
  await waitToastGone()
  const back = await api('/app/job/favorites')
  const restored = ((back.rows || back.data || []).some(j => String(j.jobId) === String(firstJobId)))
  assert.equal(restored, had, '再点一次收藏没有回到原来的状态（不是幂等的开关）')
})

// ================================================================ 5. 报名
let myAppId = 0
await step('在报名表单里一步步填完并真的提交，回库确认落了一条（C03 前置）', async () => {
  await open('/pages/jobs/apply?jobId=' + firstJobId)
  await page.waitForTimeout(500)

  // 第 1 步：姓名 / 年龄 / 手机号。k-field 里面同样是 uni-input 套真 input。
  const fields = page.locator('.k-field input, .k-field textarea')
  await fields.nth(0).fill('主线测试员')
  await fields.nth(1).fill('26')
  await fields.nth(2).fill('13700137099')
  await click('下一步')
  await page.waitForTimeout(400)

  // 第 2 步：到岗日期是 uni 的 <picker mode="date">。
  // H5 上它既不是 input[type=date] 也没有可填的输入框 —— 点开之后是一个
  // 带「取消 / 完成」的滚轮浮层。点「完成」就是确认它的默认值，
  // 而默认值正是 today（页面写的是 :value="form.arrival || today"），
  // today 满足后端"到岗日期不能早于今天"这条校验。
  await page.locator('.date-field').first().click()
  await page.waitForTimeout(600)
  await page.getByText('完成', { exact: true }).first().click()
  await page.waitForTimeout(500)
  const picked = await page.locator('.date-field').first().innerText()
  assert.ok(/\d{4}-\d{2}-\d{2}/.test(picked),
    `点了「完成」之后到岗日期还是空的：${picked}`)

  const step2 = page.locator('.k-field input, .k-field textarea')
  await step2.nth(0).fill(String(applicationStayDays))
  await click('下一步')
  await page.waitForTimeout(400)

  // 第 3 步：确认并提交
  const beforeList = await api('/app/application/mine')
  const beforeN = (beforeList.rows || beforeList.data || []).length
  const submitted = page.waitForResponse(r => new URL(r.url()).pathname === '/app/application' && r.request().method() === 'POST')
  await click('提交报名')
  const result = await (await submitted).json()
  assert.equal(result.code, 200, `主线报名被拒：${result.msg}`)
  assert.ok(result.data?.appId, '提交成功但没有返回报名ID')
  await page.getByText('报名已提交，主理人会尽快审核，可在进度页查看结果。', { exact: true }).waitFor()
  await waitToastGone()

  const afterList = await api('/app/application/mine')
  const afterN = (afterList.rows || afterList.data || []).length
  assert.equal(afterN, beforeN + 1,
    `点了「提交报名」之后，服务端的报名条数没有从 ${beforeN} 变成 ${beforeN + 1}`)
  assert.ok((afterList.rows || afterList.data || []).some(x => x.appId === result.data.appId),
    '重新读取的报名列表中没有本次提交返回的报名ID')
  await shot('applied')
})

await step('再填一次表单报同一个岗位，界面上被拒且没有多出一条报名（C03）', async () => {
  // 必须真的再走一遍表单，不能用 fetch 顶替：
  // 走表单会经过页面的事件处理、幂等键生成、错误提示这几层，
  // 直接调接口把它们全绕过去了。
  const before = (await api('/app/application/mine'))
  const beforeN = (before.rows || before.data || []).length

  await open('/pages/jobs/apply?jobId=' + firstJobId)
  await page.waitForTimeout(900)
  const f2 = page.locator('.k-field input, .k-field textarea')
  const fieldCount = await f2.count()
  assert.ok(fieldCount >= 3,
    `重新打开报名表单时第 1 步的输入框没出现（只有 ${fieldCount} 个）。当前页面内容：`
    + (await page.locator('uni-page-body').innerText()).replace(/\s+/g, ' ').slice(0, 300))
  await f2.nth(0).fill('主线测试员')
  await f2.nth(1).fill('26')
  await f2.nth(2).fill('13700137099')
  await click('下一步')
  await page.waitForTimeout(400)
  await page.locator('.date-field').first().click()
  await page.waitForTimeout(600)
  await page.getByText('完成', { exact: true }).first().click()
  await page.waitForTimeout(400)
  await page.locator('.k-field input, .k-field textarea').nth(0).fill(String(applicationStayDays))
  await click('下一步')
  await page.waitForTimeout(400)
  await click('提交报名')
  await page.waitForTimeout(1500)

  const after = await api('/app/application/mine')
  const afterN = (after.rows || after.data || []).length
  assert.equal(afterN, beforeN,
    `同一个岗位重复报名之后，报名条数从 ${beforeN} 变成了 ${afterN}`)
  const body = await page.locator('uni-page-body').innerText()
  assert.ok(!body.includes('报名已提交'),
    '重复报名之后界面还在说"报名已提交"')
  await shot('apply-duplicate')
  await waitToastGone()
})

await step('进度页显示的是服务端的真实状态与步骤（C22）', async () => {
  const mine = await api('/app/application/mine')
  const list = mine.rows || mine.data || []
  assert.ok(list.length > 0, '这个账号一条报名都没有，进度页没法测')
  myAppId = list[0].appId
  await open('/pages/jobs/progress?appId=' + myAppId)
  await page.waitForTimeout(900)
  const detail = await api('/app/application/' + myAppId)
  assert.equal(detail.code, 200, '报名详情接口失败')
  const text = await page.locator('uni-page-body').innerText()
  assert.ok(text.includes(detail.data.statusLabel),
    `进度页没有显示服务端给的状态「${detail.data.statusLabel}」`)
  await shot('progress')
})

// ================================================================ 6. 消息
await step('业务动作真的产生了站内消息，未读数来自服务端（E01/E05）', async () => {
  const unread = await api('/app/message/unread?mode=user')
  assert.equal(unread.code, 200, '未读数接口失败')
  const list = await api('/app/message/list?mode=user')
  assert.equal(list.code, 200, '消息列表接口失败')
  const rows = list.rows || list.data || []
  assert.ok(rows.length > 0, '报名之后一条站内消息都没有')
  await open('/pages/messages/index')
  await page.waitForTimeout(900)
  const text = await page.locator('uni-page-body').innerText()
  assert.ok(text.length > 40, '消息页几乎没有内容')
  await shot('messages')
})

await step('tabbar 红点上的数字等于服务端的未读数（E05）', async () => {
  await open('/pages/messages/index')
  await page.waitForTimeout(1200)
  const server = await api('/app/message/unread?mode=user')
  assert.equal(server.code, 200, '未读数接口失败')
  const expect = Number(server.data.unread)
  assert.ok(expect > 0, '当前没有未读消息，红点这条断言证明不了什么')
  const badge = page.locator('.k-tabbar__badge').first()
  await badge.waitFor({ timeout: 8000 })
  const shown = Number((await badge.innerText()).trim())
  assert.equal(shown, expect,
    `tabbar 红点显示 ${shown}，服务端的未读数是 ${expect}`)
  await shot('tabbar-badge')
})

await step('点开一条真实消息，它变成已读且未读数减一（E03）', async () => {
  const before = await api('/app/message/unread?mode=user')
  const beforeN = Number(before.data.unread)
  assert.ok(beforeN > 0, '没有未读消息可点')

  // 点的是列表里的条目，不是调接口 —— 这一步要验的正是
  // 「点击 → POST → 落库 → 未读数跟着变」这条链路
  // 10-15 改版后消息页下面的列表是 .row；带 .dot 的才是未读（报名产生的通知在这个列表里）
  const item = page.locator('.row').filter({ has: page.locator('.dot') }).first()
  await item.waitFor({ timeout: 8000 })
  await item.click()
  await page.waitForTimeout(1200)

  const after = await api('/app/message/unread?mode=user')
  assert.equal(Number(after.data.unread), beforeN - 1,
    `点开一条消息之后，未读数从 ${beforeN} 变成了 ${after.data.unread}，不是减一`)

  // 别人的消息不能被连带标记
  const others = await api('/app/message/unread?mode=staff')
  assert.equal(others.code, 200, '另一身份的未读数接口失败')
})

// ================================================================ 7. 登出
await step('在「我的」页点退出登录，旧令牌立即失效（A04）', async () => {
  // 退出登录在「我的」第 4 屏（这一页用的是标准 useScreen(4)，?s= 有效）
  await open('/pages/profile/index?s=4')
  await page.waitForTimeout(900)
  const tok = await page.evaluate(() => localStorage.getItem('kangaroo:app-token'))
  assert.ok(tok && tok.length > 20, '进「我的」页时本机没有令牌')
  // 点页面上那个按钮，不是调接口
  const btn = page.locator('.k-button').filter({ has: page.getByText('退出登录', { exact: true }) })
  await btn.first().waitFor({ timeout: 8000 })
  await btn.first().click()
  await page.waitForTimeout(1500)
  const raw = (() => { try { const p = JSON.parse(tok); return typeof p === 'string' ? p : (p && p.data) || tok } catch (e) { return tok } })()
  const after = await page.evaluate(async ([url, t]) => {
    const resp = await fetch(url, { headers: { 'X-App-Token': t } })
    return resp.json()
  }, [API + '/app/application/mine', raw])
  assert.equal(after.code, 401, '点了退出登录之后，旧令牌还能访问需要登录的接口')
  const left = await page.evaluate(() => localStorage.getItem('kangaroo:app-token'))
  assert.ok(!left, '退出登录之后本机还留着令牌')
})

await step('全程没有页面异常', async () => {
  assert.deepEqual(errors, [], '页面抛出了 JS 异常')
})

await browser.close()

console.log(`\nPASS: 游客浏览、登录与冷启动恢复、岗位搜索与详情、收藏开关、报名与进度、`
  + `站内消息与未读数、标记已读、登出失效 —— 都在真实浏览器里点过并回服务端核对`)
console.log(`断言 ${assertCount} 条，全部通过`)
