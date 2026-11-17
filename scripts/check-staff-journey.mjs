/**
 * 小程序「员工端 + 面试链路 + 跨端同步」浏览器测试。
 *
 * C18（check-user-journey.mjs）走的是应聘者进门到报名的主线；这里补的是它之后、
 * 以及员工那一侧、以及"后台一动小程序立刻跟着变"的那些点。此前它们在小程序这一层
 * 全是"页面代码调了接口，但浏览器里没人点过"：
 *
 *   员工端   D01 授权后能进工作台、看到自己的角色；D06 列表脱敏、详情给全名全号；
 *            C07 通过 / 不合适（空原因被拦、填了才生效）；C08 两个员工抢审同一条，后到的被拒
 *   应聘者   C09 进度页列出真实时段并预约；C12 预约开始后填写真实反馈、问卷随表态落库；
 *            C13「还想考虑」不推进状态、「愿意前往」推进；C06 撤回报名并释放时段
 *   跨端     C23 后台通过 → 进度页与消息同步；A09 后台停用 → 令牌立即失效、端上回游客态；
 *            D08 后台改角色 → 工作台立即显示新角色；D02 撤销授权 → 员工页进不去；
 *            D05 门店停用 → 该店授权不再下发；B04 门店停用 → 岗位对小程序不可见、恢复后重新可见；
 *            B03 草稿与已关闭岗位搜不到
 *
 * 数据由 e2e/setup_staff_journey.py 用真实 HTTP 造在一家本次新建的门店里（KG_SETUP 传入），
 * 登录态是把 setup 拿到的令牌写进本机存储后整页重载 —— 登录这件事本身由 C08/C18 在界面上验。
 * 后台那一侧的动作用后台令牌直接调接口：后台按钮的点击由 C16/C21 在后台浏览器里验过，
 * 这里要证明的是**小程序这一侧**跟着变了。
 *
 * 不覆盖（如实说明）：确认录用 / 签约 / 入职在小程序侧没有入口（受保护页面，需要新增界面）；
 * 真实微信登录；真实音视频通话；真机。外部会议无真实通话计时，durationSeconds 必须为 null。
 */
import { chromium } from 'playwright'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
const advanceInterview = id => execFileSync('python', ['-X', 'utf8', fileURLToPath(new URL('../../RuoYi-Vue/e2e/interview_clock_fixture.py', import.meta.url)), String(id)], { encoding: 'utf8' })
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

const base = (process.env.FLOW_TEST_URL || 'http://127.0.0.1:5273/').replace(/\/+$/, '') + '/'
const API = (process.env.FLOW_API_BASE || 'http://localhost:8080').replace(/\/+$/, '')
const adminToken = process.env.KG_ADMIN_TOKEN
assert.ok(adminToken, '缺少 KG_ADMIN_TOKEN')
const S = JSON.parse(process.env.KG_SETUP || '{}')
assert.ok(S.staff && S.users && S.storeId, '缺少 KG_SETUP（由 e2e/setup_staff_journey.py 生成）')
const U = S.users
const OUT = 'artifacts/staff-journey'
await mkdir(OUT, { recursive: true }).catch(() => {})

// ---------------------------------------------------------------- 服务端核对
const adminApi = async (path, init) => {
  const r = await fetch(API + path, {
    method: (init && init.method) || 'GET',
    headers: { Authorization: 'Bearer ' + adminToken, 'Content-Type': 'application/json' },
    body: init && init.body ? JSON.stringify(init.body) : undefined,
  })
  return r.json()
}
const appApi = async (token, path) => {
  const r = await fetch(API + path, { headers: { 'X-App-Token': token } })
  return r.json()
}
const appDetail = async appId => ((await adminApi('/kangaroo/application/' + appId)).data || {})
const statusOf = async appId => ((await appDetail(appId)).application || {}).status
/** 轮询服务端直到满足条件；用于"界面点了之后库里应该变成什么"这类正向断言 */
const until = async (fn, ms = 10000) => {
  const t0 = Date.now()
  let v
  while (Date.now() - t0 < ms) {
    v = await fn()
    if (v) return v
    await new Promise(r => setTimeout(r, 250))
  }
  return v
}

// ---------------------------------------------------------------- 浏览器
const browser = await chromium.launch({ headless: true, args: ['--no-proxy-server'] })
const errors = []
const newPage = async () => {
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 }, isMobile: true,
    timezoneId: 'Asia/Shanghai', locale: 'zh-CN',
  })
  const p = await ctx.newPage()
  p.on('pageerror', e => errors.push(e.message))
  return p
}

const TOKEN_KEY = 'kangaroo:app-token'
/** 以某个账号的令牌登录：写进本机存储（uni 的存储格式），之后每次 open 都整页重载 */
const useToken = async (p, token) => {
  await p.goto(base + '#/pages/home/index')
  await p.evaluate(([k, v]) => localStorage.setItem(k, JSON.stringify({ type: 'string', data: v })),
    [TOKEN_KEY, token])
}
/**
 * 打开一页：一律整页重载。登录态只在冷启动时恢复一次（ensureSession 缓存了 Promise），
 * 换账号、或者后台刚改了授权，都必须冷启动才会重新向服务端拉 —— 这也正是用户的真实路径。
 */
const open = async (p, route) => {
  await p.goto(`${base}#${route}`)
  await p.reload()
  await p.locator('uni-page-body .k-page').first().waitFor({ timeout: 20000 })
  await p.waitForTimeout(600)
}
const routeOf = p => decodeURIComponent(new URL(p.url()).hash || '')
const toastText = async (p, ms = 6000) => {
  // 本项目的 toast() 固定 icon:'none'，uni 的 H5 对它渲染的是 .uni-simple-toast__text，
  // 带图标的才是 .uni-toast__content —— 两种都认
  const t = p.locator('uni-toast .uni-simple-toast__text, uni-toast .uni-toast__content').first()
  await t.waitFor({ state: 'visible', timeout: ms }).catch(() => {})
  return (await t.innerText().catch(() => '')).trim()
}
const waitToastGone = async p => {
  await p.locator('uni-toast').first().waitFor({ state: 'detached', timeout: 8000 }).catch(() => {})
}
const button = (p, text) => p.locator('.k-button').filter({ hasText: text }).first()
/** 按文字点：有 .k-button 包着就点按钮，否则点文字本身（同 C18 的做法） */
const clickText = async (p, text) => {
  const b = p.locator('.k-button').filter({ has: p.getByText(text, { exact: true }) })
  if (await b.count()) await b.first().click()
  else await p.getByText(text, { exact: true }).first().click()
}
/** 等某个 k-button 变成可点（它的可用状态取决于详情是否已拉回来） */
const enabled = async (p, text) => {
  await p.waitForFunction(t => {
    const el = [...document.querySelectorAll('.k-button')].find(x => x.innerText.includes(t))
    return !!el && !el.classList.contains('is-disabled')
  }, text, { timeout: 10000 })
}
const shortTail = appNo => String(appNo).slice(-6)
const cardOf = (p, appNo) => p.locator('.app-card').filter({ hasText: shortTail(appNo) }).first()

const steps = []
const step = async (name, fn) => { await fn(); steps.push(name); console.log(`  OK  ${name}`) }

console.log(`小程序员工端与面试链路  base=${base}  run=${S.run}  门店=${S.storeName}`)

const A = await newPage()      // 员工 A
const B = await newPage()      // 员工 B
const P = await newPage()      // 应聘者（按步骤切换账号）
await useToken(A, S.staff.staffA.token)
await useToken(B, S.staff.staffB.token)

// ================================================================ 员工端
await step('员工 A 被授权后能进工作台，看到的门店与角色就是服务端下发的那一条（D01 小程序侧）', async () => {
  await open(A, '/pages/staff/index')
  assert.ok(routeOf(A).includes('/pages/staff/index'), `有授权却被带去了 ${routeOf(A)}`)
  const acc = await appApi(S.staff.staffA.token, '/app/auth/account')
  const g = ((acc.data || {}).staffGrants || []).find(x => x.active === true)
  assert.ok(g && Number(g.storeId) === S.storeId, '服务端下发的授权里没有这家门店')
  const text = await A.locator('uni-page-body').innerText()
  assert.ok(text.includes('角色：' + g.roleName), `工作台没有显示服务端下发的角色「${g.roleName}」`)
  assert.ok(text.includes(S.storeName), `工作台没有显示授权门店「${S.storeName}」`)
  await A.screenshot({ path: `${OUT}/staff-home.png` })
})

await step('普通员工报名列表与详情联系方式脱敏（D06）', async () => {
  await open(A, '/pages/staff/applications')
  await A.locator('.app-card').first().waitFor({ timeout: 15000 })
  const list = await appApi(S.staff.staffA.token, `/app/staff/applications?storeId=${S.storeId}&pageNum=1&pageSize=50`)
  assert.equal(list.code, 200, '员工端列表接口失败')
  assert.equal(await A.locator('.app-card').count(), (list.rows || []).length, '界面卡片数与服务端行数不一致')
  const row = (list.rows || []).find(r => r.appId === U.pass.appId)
  assert.ok(row, '服务端员工列表里没有 pass 这条报名')
  const card = cardOf(A, U.pass.appNo)
  const cardText = await card.innerText()
  assert.ok(cardText.includes(row.applicantName), `卡片上的姓名不是服务端的脱敏值「${row.applicantName}」`)
  assert.ok(!cardText.includes(U.pass.realName), `列表卡片泄露了全名「${U.pass.realName}」`)
  assert.ok(!cardText.includes(U.pass.phone), '列表卡片泄露了完整手机号')

  await card.click()
  await A.locator('.candidate-name').filter({ hasText: U.pass.realName }).first().waitFor({ timeout: 10000 })
  const detailText = await A.locator('.candidate').innerText()
  // 2026-09-24 起按默认口径：普通员工（staff）不给完整联系方式，主理人 / 管家才有（后端 AppStaffController 按门店角色下发）。
  // 员工 A 此刻是 staff 角色，所以详情里是脱敏号码；后面「改成门店管家」那一步再验证完整号码。
  const masked = U.pass.phone.slice(0, 3) + '****' + U.pass.phone.slice(-4)
  assert.ok(!detailText.includes(U.pass.phone), '普通员工的详情屏泄露了完整手机号')
  assert.ok(detailText.includes(masked), `详情屏没有显示脱敏手机号「${masked}」`)
  await A.screenshot({ path: `${OUT}/staff-detail.png` })
})

// 2026-10-04 用户明确：普通员工只查看招聘数据；主理人、店长/管家才审核。
// 先证明只读角色不能写，再授予合法角色继续原有业务与并发检查。
await step('普通员工只读，直接提交审核返回 403 且报名状态不变', async () => {
  const d = await appApi(S.staff.staffA.token, '/app/staff/applications/' + U.pass.appId)
  assert.equal(d.data.canManage, false, '普通员工获得招聘管理权限')
  assert.equal(d.data.canAudit, false, '普通员工获得审核权限')
  assert.equal(await A.locator('.detail-pass .k-button').evaluate(el => el.classList.contains('is-disabled')), true,
    '普通员工的审核按钮没有禁用')
  const before = await appDetail(U.pass.appId)
  const response = await fetch(API + `/app/staff/applications/${U.pass.appId}/audit`, {
    method: 'POST', headers: { 'X-App-Token': S.staff.staffA.token, 'Content-Type': 'application/json' },
    body: JSON.stringify({ pass: true }),
  })
  assert.equal((await response.json()).code, 403, '普通员工绕过界面仍可审核')
  const after = await appDetail(U.pass.appId)
  assert.equal(after.application.status, 'submitted', '被拒审核仍修改报名状态')
  assert.equal(after.application.auditBy, before.application.auditBy, '被拒审核仍修改审核人')
  assert.equal((after.logs || []).length, (before.logs || []).length, '被拒审核仍新增业务日志')
  for (const [name, roleCode] of [['staffA', 'manager'], ['staffB', 'keeper']]) {
    const changed = await adminApi('/kangaroo/grant', { method: 'PUT', body: { grantId: S.staff[name].grantId, roleCode } })
    assert.equal(changed.code, 200, `授权 ${roleCode} 失败`)
  }
  await open(A, `/pages/staff/applications?s=2&appId=${U.pass.appId}`)
  await enabled(A, '通过并约面试')
})

await step('主理人在详情里点「通过并约面试」，服务端状态变为审核通过（C07）', async () => {
  await button(A, '通过并约面试').click()
  const st = await until(async () => (await statusOf(U.pass.appId)) === 'review_passed')
  assert.ok(st, `点了通过，服务端状态仍是 ${await statusOf(U.pass.appId)}`)
  await waitToastGone(A)
})

await step('「不合适」不填原因被拦下、状态不变；填了原因才驳回，原因原样落库（C07）', async () => {
  await open(A, '/pages/staff/applications')
  await cardOf(A, U.reject.appNo).waitFor({ timeout: 15000 })
  await cardOf(A, U.reject.appNo).click()
  await A.locator('.candidate-name').filter({ hasText: U.reject.realName }).first().waitFor({ timeout: 10000 })

  await button(A, '不合适').click()
  const modal = A.locator('.uni-modal').first()
  await modal.waitFor({ state: 'visible', timeout: 8000 })
  await modal.locator('.uni-modal__btn_primary').click()
  const tip = await toastText(A)
  assert.ok(tip.includes('请填写驳回原因'), `空原因没有被拦下（提示是「${tip}」）`)
  await A.waitForTimeout(800)
  assert.equal(await statusOf(U.reject.appId), 'submitted', '空原因居然把报名驳回了')
  await waitToastGone(A)

  const reason = '回归：到岗日期与门店排班不匹配'
  await button(A, '不合适').click()
  await modal.waitFor({ state: 'visible', timeout: 8000 })
  await modal.locator('.uni-modal__textarea').fill(reason)
  await modal.locator('.uni-modal__btn_primary').click()
  const ok = await until(async () => (await statusOf(U.reject.appId)) === 'review_rejected')
  assert.ok(ok, '填了原因之后仍没驳回')
  assert.equal((await appDetail(U.reject.appId)).application.rejectReason, reason, '驳回原因没有原样落库')
  await waitToastGone(A)
})

await step('主理人与管家同时打开同一条报名，A 先通过，B 后点被拒；只留下一次审核记录（C08）', async () => {
  await open(A, '/pages/staff/applications')
  await open(B, '/pages/staff/applications')
  for (const p of [A, B]) {
    await cardOf(p, U.race.appNo).waitFor({ timeout: 15000 })
    await cardOf(p, U.race.appNo).click()
    await p.locator('.candidate-name').filter({ hasText: U.race.realName }).first().waitFor({ timeout: 10000 })
  }
  await button(A, '通过并约面试').click()
  assert.ok(await until(async () => (await statusOf(U.race.appId)) === 'review_passed'), 'A 点了通过没生效')

  // B 手里那一屏还是"待审核"时拉回来的，按钮仍可点 —— 这正是要验的：服务端必须挡住
  const bBtn = B.locator('.detail-pass .k-button')
  assert.equal(await bBtn.evaluate(el => el.classList.contains('is-disabled')), false,
    'B 的按钮已经禁用了，复现不了"两人同时打开"的竞态')
  await bBtn.click()
  const tip = await toastText(B)
  assert.ok(tip.length > 0 && !/已通过审核|成功/.test(tip), `B 的重复审核没有被拒（提示是「${tip}」）`)
  await B.waitForTimeout(800)
  const d = await appDetail(U.race.appId)
  assert.equal(d.application.status, 'review_passed', 'B 的重复审核改动了状态')
  const passes = (d.logs || []).filter(l => l.toStatus === 'review_passed').length
  assert.equal(passes, 1, `审核通过被记了 ${passes} 次`)

  // B 刷新后不得重复审核；合法管家进入下一步「设置面试时段」。
  await waitToastGone(B)
  await open(B, '/pages/staff/applications')
  await cardOf(B, U.race.appNo).waitFor({ timeout: 15000 })
  await cardOf(B, U.race.appNo).click()
  await B.locator('.candidate-name').filter({ hasText: U.race.realName }).first().waitFor({ timeout: 10000 })
  await B.waitForTimeout(500)
  const refreshed = await appApi(S.staff.staffB.token, '/app/staff/applications/' + U.race.appId)
  assert.equal(refreshed.data.canAudit, false, '已审核报名仍下发重复审核权限')
  assert.equal(refreshed.data.canScheduleInterview, true, '本店管家无法安排已通过报名的面试')
  assert.equal((await B.locator('.detail-pass .k-button').innerText()).trim(), '设置面试时段',
    '审核后按钮未进入安排面试的下一步')
  let repeatedAudit = 0
  const recordAudit = request => { if (request.method() === 'POST' && new URL(request.url()).pathname === `/app/staff/applications/${U.race.appId}/audit`) repeatedAudit++ }
  B.on('request', recordAudit)
  await B.locator('.detail-pass .k-button').click()
  await B.waitForURL(u => decodeURIComponent(u.hash || '').includes('/pages/staff/interviews'), { timeout: 10000 })
  B.off('request', recordAudit)
  assert.equal(repeatedAudit, 0, '设置时段错误地再次提交了审核请求')
  assert.equal((await appDetail(U.race.appId)).logs.filter(l => l.toStatus === 'review_passed').length, 1,
    '进入安排面试后多出重复审核日志')
})

// ================================================================ 应聘者：预约 → 面试 → 表态
await step('应聘者进度页列出服务端的真实时段，选一个预约，状态与时段占用都落库（C09）', async () => {
  await useToken(P, U.pass.token)
  await open(P, '/pages/jobs/progress?appId=' + U.pass.appId)
  await P.getByText('审核通过', { exact: true }).first().waitFor({ timeout: 10000 })
  await button(P, '请选择视频面试时间').click()
  const slotsResp = await appApi(U.pass.token, `/app/application/${U.pass.appId}/slots`)
  const n = (slotsResp.data || []).length
  assert.ok(n >= 2, `服务端只给了 ${n} 个可选时段`)
  await P.locator('.opt').first().waitFor({ timeout: 10000 })
  assert.equal(await P.locator('.opt').count(), n, '界面列出的时段数与服务端不一致')
  const firstSlot = slotsResp.data[0].slotId
  await P.locator('.opt').first().click()
  await button(P, '确认面试时间').click()
  assert.ok(await until(async () => (await statusOf(U.pass.appId)) === 'interview_booked'), '预约之后状态没变成已预约面试')
  const slot = (await adminApi('/kangaroo/slot/' + firstSlot)).data || {}
  assert.equal(slot.status, 'booked', '选中的时段没有被占用')
  assert.equal(String(slot.bookedAppId), String(U.pass.appId), '占用这个时段的不是这条报名')
  await P.waitForURL(u => decodeURIComponent(u.hash || '').includes('/pages/jobs/interview'), { timeout: 10000 })
  assert.ok(routeOf(P).includes('appId=' + U.pass.appId), '预约成功后没有带着 appId 进面试候场页')
})

// 真实报名的面试在约定会议工具内进行；本测试只验证反馈与业务状态。
const openRealFeedback = async (p, appId, token) => {
  const current = await appDetail(appId)
  assert.equal(current.application.status, 'interview_booked', '反馈前必须仍为已预约')
  assert.ok(current.interview, '缺少真实预约记录')
  assert.equal(current.interview.durationSeconds, null, '夹具不应预设或伪造通话时长')
  const mine = await appApi(token, '/app/application/' + appId)
  assert.equal(mine.code, 200, '读取本人面试信息失败')
  assert.equal(String(mine.data.appId), String(appId), '反馈入口必须对应同一报名')
  await enabled(p, '会议信息 / 填写反馈')
  await button(p, '会议信息 / 填写反馈').click()
  if (mine.data.interview?.meetingInfo) {
    await p.locator('.uni-actionsheet__cell').filter({ hasText: /^面试已结束，填写反馈$/ }).click()
  }
  await p.locator('.confirm-body').first().waitFor({ timeout: 8000 })
  assert.equal(await p.locator('.video-body').count(), 0, '真实报名不应进入设计稿视频示意屏')
  assert.equal(await statusOf(appId), 'interview_booked', '仅打开反馈不应提前结束面试')
}
const submitRealFeedback = async (p, appId, intentLabel) => {
  const [finished] = await Promise.all([
    p.waitForResponse(r => r.request().method() === 'POST'
      && new URL(r.url()).pathname.endsWith(`/app/application/${appId}/finish-interview`), { timeout: 10000 }),
    button(p, intentLabel).click(),
  ])
  assert.equal(finished.status(), 200, '真实反馈 HTTP 请求失败')
  assert.equal((await finished.json()).code, 200, '真实反馈业务请求失败')
  assert.equal(finished.request().postDataJSON().durationSeconds, null,
    '外部会议不可用停留页面的时间冒充通话时长')
}

const ANSWERS = ['理解清晰，符合预期', '满意，能够接受', '可以，按时到岗']
await step('实际反馈入口答完问卷点「还想考虑」：问卷落库、时长为空，状态停在面试结束（C12 / C13；不验证音视频）', async () => {
  advanceInterview(U.pass.appId)
  await open(P, '/pages/jobs/interview?appId=' + U.pass.appId)
  await P.locator('.lobby').first().waitFor({ timeout: 10000 })
  await openRealFeedback(P, U.pass.appId, U.pass.token)
  const groups = P.locator('.confirm-group')
  assert.equal(await groups.count(), 3, '问卷不是三组')
  for (let i = 0; i < 3; i += 1) {
    await groups.nth(i).getByText(ANSWERS[i], { exact: true }).click()
  }
  await submitRealFeedback(P, U.pass.appId, '还想考虑')
  assert.ok(await until(async () => {
    const d = await appDetail(U.pass.appId)
    return d.application && d.application.userIntent === 'pending'
  }), '点了「还想考虑」，服务端没有记下这个意向')
  const d = await appDetail(U.pass.appId)
  assert.equal(d.application.status, 'interview_done', '「还想考虑」不应推进状态，应停在面试结束')
  assert.equal(d.interview && d.interview.understandJob, ANSWERS[0], '问卷第 1 题没有落库')
  assert.equal(d.interview && d.interview.acceptBoard, ANSWERS[1], '问卷第 2 题没有落库')
  assert.equal(d.interview && d.interview.confirmArrival, ANSWERS[2], '问卷第 3 题没有落库')
  assert.equal(d.interview.durationSeconds, null, '无音视频计时来源时数据库不得保存伪时长')
  await waitToastGone(P)
})

await step('再点「愿意前往」，状态推进到用户已确认（C13）', async () => {
  await button(P, '愿意前往').click()
  assert.ok(await until(async () => (await statusOf(U.pass.appId)) === 'user_confirmed'), '点了愿意前往，状态没推进')
  await P.locator('.progress-body').first().waitFor({ timeout: 10000 })
  await P.screenshot({ path: `${OUT}/user-confirmed.png` })
})

await step('面试后点「不合适」：报名进入已终止，占着的时段回到可约池（C13 的第三个选项）', async () => {
  await useToken(P, U.decline.token)
  advanceInterview(U.decline.appId)
  await open(P, '/pages/jobs/interview?appId=' + U.decline.appId)
  await P.locator('.lobby').first().waitFor({ timeout: 10000 })
  await openRealFeedback(P, U.decline.appId, U.decline.token)
  await submitRealFeedback(P, U.decline.appId, '不合适')
  assert.ok(await until(async () => (await statusOf(U.decline.appId)) === 'terminated'), '点了不合适，报名没有进入已终止')
  const d = await appDetail(U.decline.appId)
  assert.equal(d.application.userIntent, 'reject', '用户意向没有记为 reject')
  assert.equal(d.interview.durationSeconds, null, '拒绝流程也不得伪造通话时长')
  const slot = (await adminApi('/kangaroo/slot/' + U.decline.slotId)).data || {}
  assert.equal(slot.status, 'open', '表示不合适之后，它占着的时段没有释放')
})

await step('已预约面试的报名撤回：进度页转到候场页，在「申请改期 / 撤回报名」里撤回；状态变已撤回，占着的时段回到可约池（C06）', async () => {
  await useToken(P, U.withdraw.token)
  // interview_booked 的报名在审核进度页会被 redirectTo 到面试候场页，撤回入口在候场页第二个按钮里
  await open(P, '/pages/jobs/progress?appId=' + U.withdraw.appId)
  const btn = button(P, '申请改期 / 撤回报名')
  await btn.waitFor({ timeout: 10000 })
  assert.equal(await btn.evaluate(el => el.classList.contains('is-disabled')), false, '已预约面试的报名，改期 / 撤回按钮却是禁用的')
  await btn.click()
  await P.locator('.uni-actionsheet__cell').filter({ hasText: '撤回报名' }).first().click()
  const modal = P.locator('.uni-modal').first()
  await modal.waitFor({ state: 'visible', timeout: 8000 })
  await modal.locator('.uni-modal__btn_primary').click()
  assert.ok(await until(async () => (await statusOf(U.withdraw.appId)) === 'withdrawn'), '撤回之后状态不是已撤回')
  const slot = (await adminApi('/kangaroo/slot/' + U.withdraw.slotId)).data || {}
  assert.equal(slot.status, 'open', '撤回之后时段没有释放')
})

// ================================================================ 跨端
await step('后台通过一条报名，应聘者的进度页与消息列表随之更新（C23 小程序侧）', async () => {
  await useToken(P, U.notify.token)
  const before = await appApi(U.notify.token, '/app/message/unread?mode=user')
  const r = await adminApi('/kangaroo/application/audit', { method: 'PUT', body: { appId: U.notify.appId, pass: true } })
  assert.equal(r.code, 200, '后台审核接口失败')
  await open(P, '/pages/jobs/progress?appId=' + U.notify.appId)
  await P.getByText('审核通过', { exact: true }).first().waitFor({ timeout: 10000 })
  const after = await appApi(U.notify.token, '/app/message/unread?mode=user')
  assert.equal(Number(after.data.unread), Number(before.data.unread) + 1, '后台通过之后未读消息没有加一')
  // 报名进度在消息页下面的列表里（服务端 bucket=main），不在「系统通知」子页
  const msgs = await appApi(U.notify.token, '/app/message/list?mode=user&bucket=main&page=1&size=20')
  const newest = (msgs.rows || [])[0]
  assert.ok(newest && newest.title, '服务端消息列表（main 组）是空的')
  await open(P, '/pages/messages/index')
  await P.getByText(newest.title).first().waitFor({ timeout: 10000 })
  await P.screenshot({ path: `${OUT}/notify-message.png` })
})

// 消息页（10-15 起）：顶部三个入口的角标 = /summary 的 buckets（「系统通知」再加没看过的公告条数），
// 下面的列表 = bucket=main 的第一页（每页 20 条），和 pages/messages/index.vue 同一口径
await step('消息页三个入口的角标、下面列表的第一页，与服务端分组汇总逐个对上（E08 小程序侧）', async () => {
  // 先把最早那条标成已读：全是未读的话，"只数未读"和"连已读也数"得出同一个数，
  // 这条比对就分辨不出角标数错了 —— 变异验证时它就是这么空转成绿的。
  const all = await appApi(U.notify.token, '/app/message/list?mode=user')
  const rows = all.rows || []
  assert.ok(rows.length >= 2, `这个账号只有 ${rows.length} 条消息，造不出"已读与未读并存"`)
  const oldest = rows[rows.length - 1]
  const mr = await fetch(`${API}/app/message/${oldest.id}/read`, { method: 'POST', headers: { 'X-App-Token': U.notify.token } }).then(r => r.json())
  assert.equal(mr.code, 200, '标记已读失败')
  const sum = await appApi(U.notify.token, '/app/message/summary?mode=user')
  assert.equal(sum.code, 200, '分组汇总接口失败')
  const buckets = sum.buckets || {}
  assert.ok(['main', 'system', 'comment', 'like'].every(k => buckets[k]), '汇总里没有 buckets：服务端还没上 10-15 的消息分组（messages-api）')
  assert.ok(Object.values(buckets).some(b => Number(b.total) > Number(b.unread)),
    '汇总里没有任何分组同时有已读与未读，角标比对分辨不出数错')
  // 浏览器上下文是新开的，本机没记过看过哪条公告：没看过 = 服务端也没记已读
  const unseenNotices = ((await appApi(U.notify.token, '/app/notices')).data || []).filter(n => !n.read).length
  const expect = {
    系统通知: Number(buckets.system.unread || 0) + unseenNotices,
    评论: Number(buckets.comment.unread || 0),
    赞: Number(buckets.like.unread || 0)
  }
  assert.ok(Number(sum.unread || 0) > 0, '这个账号一条未读都没有，角标比对没有意义')
  await open(P, '/pages/messages/index')
  await P.locator('.entry').first().waitFor({ timeout: 10000 })
  await P.waitForTimeout(600)
  const entries = P.locator('.entry')
  assert.equal(await entries.count(), 3, '消息页顶部不是 3 个入口')
  for (let i = 0; i < 3; i += 1) {
    const name = (await entries.nth(i).locator(':scope > uni-text').innerText()).trim()   // H5 里 <text> 渲染成 <uni-text>
    const badge = entries.nth(i).locator('.badge')
    const shown = (await badge.count()) ? (await badge.innerText()).trim() : '0'
    const want = expect[name] > 99 ? '99+' : String(expect[name])
    assert.equal(shown, want, `「${name}」入口角标是 ${shown}，服务端汇总是 ${want}`)
  }
  // 下面的列表：条数和第一条都和服务端 main 组第一页一致（系统通知、评论、赞不混进来）
  const page1 = (await appApi(U.notify.token, '/app/message/list?mode=user&bucket=main&page=1&size=20')).rows || []
  assert.equal(await P.locator('.row').count(), page1.length, '消息列表第一页的条数和服务端 main 组第一页不一样')
  if (page1.length) assert.equal((await P.locator('.row .row__title').first().innerText()).trim(), page1[0].peerName || page1[0].title)
})

await step('后台停用应聘者账号：端上令牌立即失效、本机登录态被清掉（A09 小程序侧）', async () => {
  await useToken(P, U.reject.token)
  await open(P, '/pages/profile/index')
  assert.equal((await appApi(U.reject.token, '/app/auth/account')).code, 200, '停用前令牌就已经不可用了')
  const r = await adminApi('/kangaroo/appuser/changeStatus', { method: 'PUT', body: { userId: U.reject.userId, status: '1' } })
  assert.equal(r.code, 200, '后台停用接口失败')
  try {
    await open(P, '/pages/profile/index')
    await P.waitForTimeout(800)
    assert.equal((await appApi(U.reject.token, '/app/auth/account')).code, 401, '停用之后旧令牌仍然有效')
    const left = await P.evaluate(k => localStorage.getItem(k), TOKEN_KEY)
    assert.ok(!left, '令牌失效之后端上没有清掉本机登录态')
  } finally {
    await adminApi('/kangaroo/appuser/changeStatus', { method: 'PUT', body: { userId: U.reject.userId, status: '0' } })
  }
})

await step('后台把员工 A 改成门店管家，工作台重新进入就显示新角色（D08 小程序侧）', async () => {
  const r = await adminApi('/kangaroo/grant', { method: 'PUT', body: { grantId: S.staff.staffA.grantId, roleCode: 'keeper' } })
  assert.equal(r.code, 200, '后台改角色接口失败')
  await open(A, '/pages/staff/index')
  const text = await A.locator('uni-page-body').innerText()
  assert.ok(text.includes('角色：门店管家'), '改了角色之后工作台仍显示旧角色')
  // 升为管家后，同一个账号再看报名详情就拿到完整手机号（员工需要联系应聘者）
  const d = await appApi(S.staff.staffA.token, '/app/staff/applications/' + U.pass.appId)
  assert.equal(d.code, 200, '管家看报名详情失败')
  assert.equal((d.data || {}).phone, U.pass.phone, '升为管家后详情里仍不是完整手机号')
})

await step('后台撤销员工 B 的授权，B 再进员工页被带去身份页（D02 小程序侧）', async () => {
  const r = await adminApi('/kangaroo/grant/revoke/' + S.staff.staffB.grantId, { method: 'PUT' })
  assert.equal(r.code, 200, '后台撤销接口失败')
  await open(B, '/pages/staff/applications')
  await B.waitForURL(u => decodeURIComponent(u.hash || '').includes('/pages/auth/identity'), { timeout: 10000 })
  const acc = await appApi(S.staff.staffB.token, '/app/auth/account')
  assert.ok(!((acc.data || {}).staffGrants || []).some(g => g.active === true), '撤销之后服务端仍下发有效授权')
})

// ---------------------------------------------------------------- 门店停用（B04 / D05）
// 岗位列表按分类分四屏，搜索会带上当前分类的 type；本次造的岗位都是兼职，
// 所以用页面自己支持的 ?type=parttime 直达兼职那一屏再搜（默认落在换工屏，搜不到是对的）
const searchJobs = async keyword => {
  await open(P, '/pages/jobs/list?type=parttime')
  await P.locator('.search__input input').first().fill(keyword)
  const resp = P.waitForResponse(r => r.url().includes('/app/job/list') && r.url().includes('keyword='), { timeout: 10000 })
  await clickText(P, '搜索')
  await resp
  await P.waitForTimeout(600)
  return P.locator('.jobs .card').filter({ hasText: keyword }).count()
}

await step('草稿岗位与已关闭岗位在小程序里搜不到，已发布的搜得到（B03 小程序侧）', async () => {
  await useToken(P, U.notify.token)
  assert.equal(await searchJobs(S.jobTitle), 1, '已发布的岗位在小程序里搜不到，下面两条的"搜不到"没有意义')
  assert.equal(await searchJobs(S.draftTitle), 0, '草稿岗位在小程序里能搜到')
  assert.equal(await searchJobs(S.closedTitle), 0, '已关闭岗位在小程序里能搜到')
})

await step('后台停用门店：该店岗位在小程序消失、员工授权不再下发；恢复后岗位重新可见（B04 / D05 小程序侧）', async () => {
  const store = (await adminApi('/kangaroo/store/' + S.storeId)).data
  assert.ok(store && store.storeId, '取不到门店')
  let r = await adminApi('/kangaroo/store', { method: 'PUT', body: { ...store, status: '1' } })
  assert.equal(r.code, 200, `后台停用门店失败：${r.msg}`)
  try {
    assert.equal(await searchJobs(S.jobTitle), 0, '门店停用后它的岗位在小程序里仍然搜得到')
    await open(A, '/pages/staff/applications')
    await A.waitForURL(u => decodeURIComponent(u.hash || '').includes('/pages/auth/identity'), { timeout: 10000 })
  } finally {
    r = await adminApi('/kangaroo/store', { method: 'PUT', body: { ...store, status: '0' } })
    assert.equal(r.code, 200, '恢复门店失败')
  }
  assert.equal(await searchJobs(S.jobTitle), 1, '门店恢复后岗位没有重新出现')
  // D05 的后一半：门店恢复后授权重新下发，员工 A 不换令牌就能重新进工作台
  await open(A, '/pages/staff/index')
  assert.ok(routeOf(A).includes('/pages/staff/index'), `门店恢复后员工仍进不了工作台（被带去 ${routeOf(A)}）`)
  const acc = await appApi(S.staff.staffA.token, '/app/auth/account')
  assert.ok(((acc.data || {}).staffGrants || []).some(g => g.active === true && Number(g.storeId) === S.storeId),
    '门店恢复后服务端没有重新下发这条授权')
})

await step('全程没有页面异常', async () => {
  assert.deepEqual(errors, [], '页面抛出了 JS 异常')
})

await browser.close()
console.log(`\nPASS: 员工端（授权/脱敏/审核/抢审）、应聘者（预约/外部面试反馈/问卷/表态/撤回，无真实音视频）、`
  + `跨端（通过同步/停用/改角色/撤销/门店停用/岗位可见性）都在小程序 H5 里点过并回服务端核对`)
console.log(`断言 ${assertCount} 条，全部通过`)
