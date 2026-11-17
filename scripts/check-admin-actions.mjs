/**
 * 管理后台「报名动作与边界规则」浏览器测试。
 *
 * check-admin-crud.mjs 覆盖的是基础的增删改查；这里覆盖的是验收表里
 * 管理后台那一层剩下的、**需要前置状态**才能点到的按钮与规则：
 *
 *   报名   通过 / 驳回（必填原因）/ 终止（必填原因）/ 确认录用 / 标记入职
 *          详情里的状态流转时间线条数与库里的日志条数一致
 *   时段   被**有效**占用的时段点修改/删除被拒，且拒绝理由点名是哪条报名
 *          被**失效**占用卡住的时段可以删掉（后台那两个按钮以前被无条件禁用）
 *   岗位   删除草稿岗位这条正向路径（C16 只点过"删已发布被拒"那一支）
 *          整表单编辑把可选字段清空之后，库里真的是 NULL
 *          编辑弹窗里没有统计字段；编辑期间有人报名，保存照样成功
 *          「重算名额」按钮（这一轮新补的）
 *   门店   同城同名新建被拒；在表单里停用 → 它的岗位对小程序不可见，改回正常后重新可见
 *   授权   撤销之后再授予同一个人，是重新激活而不是撞唯一键
 *   门控   面试结束、用户没表态时没有「确认录用」；确认录用后、签约前没有「标记入职」；
 *          名额已满时点「确认录用」被拒且不超扣；入职后面试记录保持 done，不被改写成已取消
 *
 * 前置状态由 e2e/setup_admin_actions.py 用真实 HTTP 推好（预约、面试、表态、签约
 * 都是小程序端用户本人的动作），通过 KG_SETUP 传进来。本文件只负责后台这一层。
 *
 * 用法：
 *   KG_ADMIN_TOKEN=... KG_SETUP='{...}' ADMIN_TEST_URL=http://127.0.0.1:8081/ \
 *     FLOW_API_BASE=http://localhost:8080 node scripts/check-admin-actions.mjs
 */
import { chromium } from 'playwright'
import { trackRefetch } from './admin-refetch-tracker.mjs'
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
const token = process.env.KG_ADMIN_TOKEN
assert.ok(token, '缺少 KG_ADMIN_TOKEN')
const S = JSON.parse(process.env.KG_SETUP || '{}')
assert.ok(S.pass && S.terminate && S.confirm && S.onboard && S.activeSlot && S.staleSlot && S.drift && S.early && S.full && S.store2,
  '缺少 KG_SETUP（由 e2e/setup_admin_actions.py 生成）')

const OUT = 'artifacts/admin-actions'
await mkdir(OUT, { recursive: true }).catch(() => {})

/** 直接调后端核对结果（后台令牌） */
const adminApi = async (path, init) => {
  const r = await fetch(API + path, {
    method: (init && init.method) || 'GET',
    headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
    body: init && init.body ? JSON.stringify(init.body) : undefined,
  })
  return r.json()
}
const appStatus = async appId => {
  const r = await adminApi('/kangaroo/application/' + appId)
  return ((r.data || {}).application || {}).status
}

const browser = await chromium.launch({ headless: true })
const context = await browser.newContext({
  viewport: { width: 1440, height: 900 }, timezoneId: 'Asia/Shanghai', locale: 'zh-CN',
})
const origin = new URL(base)
await context.addCookies([{
  name: 'Admin-Token', value: token, domain: origin.hostname, path: '/',
  httpOnly: false, secure: false, sameSite: 'Lax',
}])
const page = await context.newPage()
const refetch = trackRefetch(page)
const errors = []
page.on('pageerror', e => errors.push(e.message))

const steps = []
const step = async (name, fn) => { await fn(); steps.push(name); console.log(`  OK  ${name}`) }

const open = async route => {
  await page.goto(base + route.replace(/^\//, ''), { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('.app-main', { timeout: 20000 })
  await page.waitForSelector('.el-table', { timeout: 20000 })
  await page.waitForLoadState('networkidle')
  await page.waitForTimeout(300)
}
const shot = async n => { await page.screenshot({ path: `${OUT}/${n}.png` }) }
const rows = () => page.locator('.el-table__body tbody tr.el-table__row')
const rowCount = async () => rows().count()
const rowButton = (i, name) => rows().nth(i).getByRole('button', { name })

const searchBy = async (label, value) => {
  const item = page.locator('.el-form--inline .el-form-item').filter({ hasText: label }).first()
  await item.locator('input').first().fill(String(value))
  await page.getByRole('button', { name: '搜索' }).click()
  await page.waitForLoadState('networkidle')
  await page.waitForTimeout(400)
  return rowCount()
}

/** 确认框；prompt 型的先填原因 */
const confirmBox = async (reason) => {
  const box = page.locator('.el-message-box')
  await box.waitFor({ state: 'visible', timeout: 10000 })
  if (reason !== undefined) await box.locator('input, textarea').first().fill(reason)
  await box.locator('button').filter({ hasText: '确定' }).first().click()
  await box.waitFor({ state: 'hidden', timeout: 15000 }).catch(() => {})
  await page.waitForLoadState('networkidle')
  await page.waitForTimeout(500)
}

/** 最近一条 Element Plus 消息提示的文本（错误/成功都算） */
const lastMessage = async () => {
  const m = page.locator('.el-message').last()
  await m.waitFor({ state: 'visible', timeout: 8000 }).catch(() => {})
  return (await m.innerText().catch(() => '')).trim()
}

const fillDialog = async (label, value) => {
  const item = page.locator('.el-dialog .el-form-item').filter({ hasText: label }).first()
  await item.locator('input, textarea').first().fill(String(value))
}
const submitDialog = async () => {
  await page.locator('.el-dialog__footer button').filter({ hasText: '确' }).first().click()
  await page.waitForTimeout(800)
  await page.waitForLoadState('networkidle')
}

console.log(`管理后台报名动作与边界规则  base=${base}  run=${S.run}`)

// ================================================================ 报名动作（F05 / C23 后台半边）
await step('报名：点「通过」，状态从已提交变为审核通过（F05）', async () => {
  await open('/kangaroo/application')
  assert.equal(await searchBy('报名单号', S.pass.appNo), 1, '按报名单号搜不到那条待审核报名')
  await rowButton(0, '通过').click()
  await confirmBox()
  assert.equal(await appStatus(S.pass.appId), 'review_passed', '点了通过，服务端状态没变成 review_passed')
  await shot('app-pass')
})

await step('报名：「驳回」不填原因会被前端拦下，填了才生效（F05）', async () => {
  await open('/kangaroo/application')
  await searchBy('报名单号', S.reject.appNo)
  await rowButton(0, '驳回').click()
  // 空原因：要**正面看到**被拦下 —— 页面给出"驳回必须填写原因"，并且一次驳回请求都没发。
  // 只回库看"状态没变"不够：请求若还在路上，这条会在驳回生效之前就判过。
  // （这一页的做法是弹框照常关闭、随后报错并中止，不是在弹框里做校验 ——
  //   第一版按"弹框不关"写的断言就是这么红的，判据要跟着页面的真实行为走。）
  const auditCalls = []
  const spy = r => { if (r.url().includes('/kangaroo/application/audit')) auditCalls.push(r.method()) }
  page.on('request', spy)
  const box = page.locator('.el-message-box')
  await box.waitFor({ state: 'visible', timeout: 10000 })
  await box.locator('input, textarea').first().fill('')
  await box.locator('button').filter({ hasText: '确定' }).first().click()
  const err = page.locator('.el-message').filter({ hasText: '驳回必须填写原因' }).first()
  await err.waitFor({ state: 'visible', timeout: 8000 }).catch(() => {})
  assert.equal(await err.isVisible(), true, '空原因点确定之后没有给出"驳回必须填写原因"')
  await page.waitForTimeout(1500)
  page.off('request', spy)
  assert.deepEqual(auditCalls, [], '空原因居然发出了驳回请求')
  assert.equal(await appStatus(S.reject.appId), 'submitted', '空原因居然把报名驳回了')
  await open('/kangaroo/application')
  await searchBy('报名单号', S.reject.appNo)
  await rowButton(0, '驳回').click()
  await confirmBox('回归用例：到岗时间不匹配')
  assert.equal(await appStatus(S.reject.appId), 'review_rejected', '填了原因之后仍没驳回')
})

await step('报名：已预约面试的那条点「终止」并填原因，状态变为已终止、时段被释放（F05）', async () => {
  await open('/kangaroo/application')
  await searchBy('报名单号', S.terminate.appNo)
  await rowButton(0, '终止').click()
  await confirmBox('回归用例：候选人放弃')
  assert.equal(await appStatus(S.terminate.appId), 'terminated', '点了终止，服务端状态没变')
  const slot = await adminApi('/kangaroo/slot/' + S.terminate.slotId)
  assert.equal((slot.data || {}).status, 'open', '终止之后它占着的面试时段没有回到可约池')
})

await step('报名：用户已确认的那条点「确认录用」，状态与名额都跟着变（F05）', async () => {
  const before = await adminApi('/kangaroo/job/' + S.jobId)
  const hiredBefore = Number((before.data || {}).hiredCount || 0)
  await open('/kangaroo/application')
  await searchBy('报名单号', S.confirm.appNo)
  await rowButton(0, '确认录用').click()
  await confirmBox()
  assert.equal(await appStatus(S.confirm.appId), 'store_confirmed', '点了确认录用，状态没变')
  const after = await adminApi('/kangaroo/job/' + S.jobId)
  assert.equal(Number((after.data || {}).hiredCount || 0), hiredBefore + 1,
    '确认录用之后岗位的已录用人数没有加一')
})

await step('商家已确认录用、用户还没签约的那条，行上没有「标记入职」（C18 后台侧：未签约不能入职）', async () => {
  await open('/kangaroo/application')
  assert.equal(await searchBy('报名单号', S.confirm.appNo), 1, '搜不到刚确认录用的那条')
  // 先证明这一行的按钮确实渲染出来了，否则"没有标记入职"只是整行没按钮
  assert.equal(await rowButton(0, '终止').count(), 1, '这一行连「终止」都没有，判不出按钮门控')
  assert.equal(await rowButton(0, '标记入职').count(), 0, '还没签约，行上却出现了「标记入职」')
})

await step('报名：已签约的那条点「标记入职」，状态变为已入职且占用的时段被释放（F05）', async () => {
  await open('/kangaroo/application')
  await searchBy('报名单号', S.onboard.appNo)
  await rowButton(0, '标记入职').click()
  await confirmBox()
  assert.equal(await appStatus(S.onboard.appId), 'onboarded', '点了标记入职，状态没变')
  const slot = await adminApi('/kangaroo/slot/' + S.onboard.slotId)
  assert.equal((slot.data || {}).status, 'open', '入职之后它占着的面试时段没有回到可约池')
  // C26 的另一半：释放时段不能顺手把真实发生过的面试记录改写成"已取消"
  const iv = ((await adminApi('/kangaroo/application/' + S.onboard.appId)).data || {}).interview || {}
  assert.equal(iv.status, 'done', `入职之后面试记录的状态被改成了 ${iv.status}（应当保持 done）`)
})

await step('报名详情里的状态流转时间线，条数与服务端日志一致（C21）', async () => {
  const detail = await adminApi('/kangaroo/application/' + S.onboard.appId)
  const logs = (detail.data || {}).logs || []
  assert.ok(logs.length >= 6, `这条走完全流程的报名只有 ${logs.length} 条日志`)
  await open('/kangaroo/application')
  await searchBy('报名单号', S.onboard.appNo)
  await rowButton(0, '详情').click()
  const panel = page.locator('.el-dialog:visible, .el-drawer:visible').first()
  await panel.waitFor({ timeout: 10000 })
  await page.waitForTimeout(500)
  const items = await panel.locator('.el-timeline-item').count()
  assert.equal(items, logs.length, `详情时间线有 ${items} 条，服务端日志有 ${logs.length} 条`)
  await shot('app-timeline')
  await page.keyboard.press('Escape')
})

// ================================================================ 时段占用规则（C11 / F14）
const openSlotsOfStore = async () => {
  await open('/kangaroo/slot')
  const item = page.locator('.el-form--inline .el-form-item').filter({ hasText: '门店' }).first()
  await item.locator('.el-select').first().click()
  const opt = page.locator('.el-select-dropdown__item:visible').filter({ hasText: S.storeName }).first()
  await opt.waitFor({ timeout: 10000 })
  await opt.click()
  await page.getByRole('button', { name: '搜索' }).click()
  await page.waitForLoadState('networkidle')
  await page.waitForTimeout(500)
}
const rowOfApp = async appId => {
  const n = await rowCount()
  for (let i = 0; i < n; i += 1) {
    const t = await rows().nth(i).innerText()
    if (t.split(/\s+/).includes(String(appId))) return i
  }
  return -1
}

await step('被有效占用的时段点「修改」提交被拒，理由点名是哪条报名，且什么都没改（C11）', async () => {
  await openSlotsOfStore()
  const i = await rowOfApp(S.activeSlot.appId)
  assert.ok(i >= 0, '在时段列表里找不到被这条报名占着的那一行')
  await rowButton(i, '修改').click()
  await page.waitForSelector('.el-dialog', { state: 'visible', timeout: 10000 })
  await fillDialog('备注', '回归用例：改被占用的时段')
  await submitDialog()
  const msg = await lastMessage()
  assert.ok(msg.includes(S.activeSlot.appNo), `拒绝理由没有点名是哪条报名占着：${msg}`)
  const slot = (await adminApi('/kangaroo/slot/' + S.activeSlot.slotId)).data || {}
  assert.notEqual(slot.remark, '回归用例：改被占用的时段', '被有效占用的时段居然被改掉了')
  assert.equal(slot.status, 'booked', '被拒之后时段状态被改了')
  assert.equal(String(slot.bookedAppId), String(S.activeSlot.appId), '被拒之后占用者变了')
  await page.keyboard.press('Escape')
})

await step('被有效占用的时段点「删除」被拒，理由点名是哪条报名，且没被删掉（C11）', async () => {
  await openSlotsOfStore()
  const i = await rowOfApp(S.activeSlot.appId)
  assert.ok(i >= 0, '在时段列表里找不到被这条报名占着的那一行')
  await rowButton(i, '删除').click()
  await confirmBox()
  const msg = await lastMessage()
  // 只认报名单号：泛泛一句"已被占用"正是这条验收要消灭的写法，不能算过
  assert.ok(msg.includes(S.activeSlot.appNo), `拒绝理由没有点名是哪条报名占着：${msg}`)
  const slot = await adminApi('/kangaroo/slot/' + S.activeSlot.slotId)
  assert.equal(slot.code, 200, '被有效占用的时段居然被删掉了')
  assert.equal((slot.data || {}).status, 'booked', '被拒之后时段状态被改了')
})

await step('被**失效**占用卡住的时段可以删掉（F14，以前两个按钮被无条件禁用）', async () => {
  await openSlotsOfStore()
  const i = await rowOfApp(S.staleSlot.appId)
  assert.ok(i >= 0, '在时段列表里找不到那条失效占用的时段')
  const del = rowButton(i, '删除')
  assert.equal(await del.isDisabled(), false, '失效占用那一行的「删除」按钮仍然是禁用的')
  await del.click()
  await confirmBox()
  const slot = await adminApi('/kangaroo/slot/' + S.staleSlot.slotId)
  assert.notEqual(slot.code, 200, '点了删除，失效占用的时段还在')
})

// ================================================================ 岗位（B06 / B11 / B12 / F10-F11 重算）
await step('删除草稿岗位这条正向路径：勾选、点工具栏删除、列表里没了（B06）', async () => {
  const title = '回归-后台删草稿-' + S.run
  const r = await adminApi('/kangaroo/job', { method: 'POST', body: {
    storeId: S.storeId, title, jobType: 'parttime', city: '回归城', salaryType: 'none', headcount: 1 } })
  assert.equal(r.code, 200, '准备草稿岗位失败')
  await open('/kangaroo/job')
  assert.equal(await searchBy('岗位标题', title), 1, '搜不到刚建的草稿岗位')
  await rows().first().locator('.el-checkbox__inner').first().click()
  await page.waitForTimeout(200)
  await page.locator('.mb8 .el-button').filter({ hasText: '删除' }).first().click()
  await confirmBox()
  assert.equal(await searchBy('岗位标题', title), 0, '删除草稿之后列表里还在')
})

await step('编辑岗位把四个可选字段清空、计薪改成无薪资再保存，库里真的是空（B11）', async () => {
  const pre = (await adminApi('/kangaroo/job/' + S.jobId)).data || {}
  assert.ok(Number(pre.minDays) === 3 && pre.startDate && Number(pre.salaryMin) === 150
    && Number(pre.salaryMax) === 200 && pre.salaryType === 'daily',
  `准备数据没把四个可选字段都填上，这一步会验个寂寞：${JSON.stringify(pre).slice(0, 200)}`)
  await open('/kangaroo/job')
  await searchBy('岗位标题', S.jobTitle)
  await rowButton(0, '修改').click()
  const dlg = page.locator('.el-dialog:visible').first()
  await dlg.waitFor({ timeout: 10000 })
  const item = label => dlg.locator('.el-form-item').filter({ hasText: label }).first()

  // 最短停留：数字框，清空
  const days = item('最短停留').locator('input').first()
  assert.equal(await days.inputValue(), '3', '编辑弹窗没有回显库里的最短停留天数')
  await days.fill('')
  // 可开始日期：日期框，悬停出清除图标再点
  const dateItem = item('可开始日期')
  assert.ok((await dateItem.locator('input').first().inputValue()).length > 0, '编辑弹窗没有回显可开始日期')
  await dateItem.locator('.el-input__wrapper, .el-input').first().hover()
  await dateItem.locator('.el-input__clear, .clear-icon, .el-icon.el-input__icon.clear-icon').first().click()
  assert.equal(await dateItem.locator('input').first().inputValue(), '', '可开始日期没有被清空')
  // none 当前显示「无底薪」，仍允许额外奖金/提成；原固定薪资上下限必须清空。
  await item('计薪方式').locator('.el-select').first().click()
  await page.locator('.el-select-dropdown:visible .el-select-dropdown__item').filter({ hasText: '无底薪（可单独设奖金或提成）' }).first().click()
  await page.waitForTimeout(200)
  assert.equal(await item('薪资下限').locator('input').first().isDisabled(), true, '改成无薪资之后薪资下限没被禁用')

  await fillDialog('备注', '回归用例：清空可选字段')
  await submitDialog()
  const j = (await adminApi('/kangaroo/job/' + S.jobId)).data || {}
  assert.equal(j.remark, '回归用例：清空可选字段', '这次编辑根本没落库，下面几条会一起假绿')
  assert.ok(j.minDays == null, `清空之后最短停留天数仍是 ${j.minDays}`)
  assert.ok(j.startDate == null, `清空之后可开始日期仍是 ${j.startDate}`)
  assert.ok(j.salaryMin == null && j.salaryMax == null, `改成无薪资之后薪资仍是 ${j.salaryMin}~${j.salaryMax}`)
  assert.equal(j.salaryType, 'none', '计薪方式没有改成 none')
})

await step('编辑弹窗里没有统计字段；编辑期间有人报名，保存照样成功（B12）', async () => {
  await open('/kangaroo/job')
  await searchBy('岗位标题', S.jobTitle)
  await rowButton(0, '修改').click()
  const dlg = page.locator('.el-dialog:visible').first()
  await dlg.waitFor({ timeout: 10000 })
  const text = await dlg.innerText()
  assert.ok(!/已报名|已录用/.test(text), '编辑弹窗里出现了统计字段的输入项')

  // 弹窗开着的时候，有人报了这个岗位（统计字段 applied_count 被改了）
  const appliedBefore = Number(((await adminApi('/kangaroo/job/' + S.jobId)).data || {}).appliedCount || 0)
  const login = await fetch(API + '/app/auth/wx-login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code: 'act-concurrent-' + S.run }),
  }).then(r => r.json())
  const d = new Date(Date.now() + 9 * 86400000)
  const arrival = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  const sub = await fetch(API + '/app/application', {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'X-App-Token': login.token },
    body: JSON.stringify({ jobId: S.jobId, name: '并发报名', age: 24, phone: '13700137055',
                           arrival, days: 5, idemKey: 'act-conc-' + S.run }),
  }).then(r => r.json())
  assert.equal(sub.code, 200, '准备"编辑期间有人报名"失败')

  await fillDialog('备注', '回归用例：并发报名期间保存')
  await submitDialog()
  const msg = await lastMessage()
  assert.ok(!/失败|冲突|被修改/.test(msg), `编辑期间有人报名，保存被拒了：${msg}`)
  const j = await adminApi('/kangaroo/job/' + S.jobId)
  assert.equal((j.data || {}).remark, '回归用例：并发报名期间保存', '保存没有落库')
  // 真正的风险在这里：表单带着打开时的旧计数保存，会把并发那一笔报名"抹掉"
  assert.equal(Number((j.data || {}).appliedCount || 0), appliedBefore + 1,
    '保存编辑之后，编辑期间那一笔报名的计数被旧值覆盖了')
})

await step('「重算名额」把故意写歪的计数按报名明细纠正回来（F11 这一轮新补的入口）', async () => {
  const pre = await adminApi('/kangaroo/job/' + S.drift.jobId)
  assert.equal(Number((pre.data || {}).appliedCount), 999, '准备数据没把计数写歪，这一步会验个寂寞')
  await open('/kangaroo/job')
  assert.equal(await searchBy('岗位标题', S.drift.title), 1, '搜不到计数漂移的那个岗位')
  await rows().first().locator('.el-checkbox__inner').first().click()
  await page.waitForTimeout(200)
  const btn = page.locator('.mb8 .el-button').filter({ hasText: '重算名额' }).first()
  await btn.waitFor({ timeout: 8000 })
  await btn.click()
  await confirmBox()
  const msg = await lastMessage()
  assert.ok(msg.includes('重算完成'), `点了重算名额，没有看到成功提示：${msg}`)
  const post = await adminApi('/kangaroo/job/' + S.drift.jobId)
  assert.equal(Number((post.data || {}).appliedCount), 0, '重算之后已报名人数没有按明细纠正（这个岗位一条报名都没有）')
  assert.equal(Number((post.data || {}).hiredCount), 0, '重算之后已录用人数没有按明细纠正')
})

// ================================================================ 门店（B09）
await step('新建一家同城同名的门店被拒，门店数没有变（B09）', async () => {
  const cityOf = await adminApi('/kangaroo/store/' + S.storeId)
  const city = (cityOf.data || {}).city
  const before = await adminApi('/kangaroo/store/list?pageNum=1&pageSize=1')
  await open('/kangaroo/store')
  await page.getByRole('button', { name: '新增' }).click()
  await page.waitForSelector('.el-dialog', { state: 'visible', timeout: 10000 })
  await fillDialog('门店名称', S.storeName)
  await fillDialog('城市', city)
  await fillDialog('详细地址', '回归同名')
  await submitDialog()
  const msg = await lastMessage()
  assert.ok(/已存在|重复|同名/.test(msg), `同城同名没有给出可理解的拒绝理由：${msg}`)
  const after = await adminApi('/kangaroo/store/list?pageNum=1&pageSize=1')
  assert.equal(after.total, before.total, '同城同名被拒之后门店数还是变了')
  await page.keyboard.press('Escape')
})

// ================================================================ 授权（D07）
await step('撤销之后再授予同一个人，是重新激活而不是撞唯一键（D07）', async () => {
  const login = await fetch(API + '/app/auth/wx-login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code: 'act-regrant-' + S.run }),
  }).then(r => r.json())
  const uid = login.account.id
  const g1 = await adminApi('/kangaroo/grant', { method: 'POST',
    body: { appUserId: uid, storeId: S.storeId, roleCode: 'staff' } })
  assert.equal(g1.code, 200, '第一次授予失败')
  const list1 = await adminApi(`/kangaroo/grant/list?storeId=${S.storeId}&pageSize=200`)
  const row1 = (list1.rows || []).find(g => String(g.appUserId) === String(uid))
  const r = await adminApi('/kangaroo/grant/revoke/' + row1.grantId, { method: 'PUT' })
  assert.equal(r.code, 200, '撤销失败')

  // 在后台界面里再授予一次
  await open('/kangaroo/grant')
  await page.getByRole('button', { name: '新增' }).click()
  await page.waitForSelector('.el-dialog', { state: 'visible', timeout: 10000 })
  const storeItem = page.locator('.el-dialog .el-form-item').filter({ hasText: '门店' }).first()
  await storeItem.locator('.el-select').first().click()
  await page.locator('.el-select-dropdown:visible .el-select-dropdown__item')
    .filter({ hasText: S.storeName }).first().click()
  await page.waitForTimeout(200)
  const userItem = page.locator('.el-dialog .el-form-item').filter({ hasText: '账号' }).first()
  await userItem.locator('.el-select input').first().fill(String(login.account.nickname || ''))
  await page.waitForTimeout(800)
  const opt = page.locator('.el-select-dropdown:visible .el-select-dropdown__item').first()
  await opt.waitFor({ timeout: 10000 })
  await opt.click()
  await submitDialog()
  const msg = await lastMessage()
  assert.ok(!/Duplicate|唯一|重复/.test(msg), `再次授予撞上了唯一键：${msg}`)

  const list2 = await adminApi(`/kangaroo/grant/list?storeId=${S.storeId}&pageSize=200`)
  const mine = (list2.rows || []).filter(g => String(g.appUserId) === String(uid))
  assert.equal(mine.length, 1, `同一人同一门店出现了 ${mine.length} 条授权，而不是 1 条被重新激活`)
  assert.equal(mine[0].status, '0', '再次授予之后授权没有回到有效状态')
})

// ================================================================ 录用前置条件（C14 / C16）
await step('面试结束、用户还没表态的报名，行上没有「确认录用」；绕过界面直接调接口也被拒（C14 后台侧）', async () => {
  await open('/kangaroo/application')
  assert.equal(await searchBy('报名单号', S.early.appNo), 1, '搜不到面试已结束的那条')
  assert.equal(await rowButton(0, '终止').count(), 1, '这一行连「终止」都没有，判不出按钮门控')
  assert.equal(await rowButton(0, '确认录用').count(), 0, '用户还没表态，行上却出现了「确认录用」')
  const r = await adminApi('/kangaroo/application/confirm/' + S.early.appId, { method: 'PUT' })
  assert.notEqual(r.code, 200, '用户未确认前，后台接口居然允许确认录用')
  assert.equal(await appStatus(S.early.appId), 'interview_done', '被拒之后状态变了')
})

await step('名额已满的岗位点「确认录用」被拒，提示名额已满，已录用人数不被超扣（C16 后台侧）', async () => {
  const before = Number(((await adminApi('/kangaroo/job/' + S.full.jobId)).data || {}).hiredCount)
  assert.equal(before, 1, `准备数据没把名额占满（已录用 ${before}）`)
  await open('/kangaroo/application')
  assert.equal(await searchBy('报名单号', S.full.appNo), 1, '搜不到名额已满那条')
  await rowButton(0, '确认录用').click()
  await confirmBox()
  const msg = await lastMessage()
  assert.ok(msg.includes('名额已满'), `没有给出名额已满的拒绝理由：${msg}`)
  assert.equal(await appStatus(S.full.appId), 'user_confirmed', '名额已满却被确认录用了')
  const after = Number(((await adminApi('/kangaroo/job/' + S.full.jobId)).data || {}).hiredCount)
  assert.equal(after, 1, `名额被超扣了（已录用 ${after}）`)
})

// ================================================================ 门店停用（B04 / D05 后台侧）
const appJobCount = async title => {
  const r = await fetch(`${API}/app/job/list?pageNum=1&pageSize=20&keyword=${encodeURIComponent(title)}`).then(x => x.json())
  return (r.rows || []).filter(j => j.title === title).length
}
const setStoreStatus = async (name, label) => {
  await open('/kangaroo/store')
  assert.equal(await searchBy('门店名称', name), 1, `搜不到门店 ${name}`)
  await rowButton(0, '修改').click()
  const dlg = page.locator('.el-dialog:visible').first()
  await dlg.waitFor({ timeout: 10000 })
  await dlg.locator('.el-form-item').filter({ hasText: '状态' }).locator('.el-radio').filter({ hasText: label }).first().click()
  await submitDialog()
}
await step('在门店表单里点「停用」：门店状态落库、它的岗位对小程序不可见；改回「正常」后重新可见（B04 / D05 后台侧）', async () => {
  assert.equal(await appJobCount(S.store2.jobTitle), 1, '停用前小程序就搜不到这个岗位，后面的"消失"没有意义')
  await setStoreStatus(S.store2.storeName, '停用')
  assert.equal(((await adminApi('/kangaroo/store/' + S.store2.storeId)).data || {}).status, '1', '点了停用，门店状态没落库')
  assert.equal(await appJobCount(S.store2.jobTitle), 0, '门店停用后它的岗位在小程序接口里仍然可见')
  await setStoreStatus(S.store2.storeName, '正常')
  assert.equal(((await adminApi('/kangaroo/store/' + S.store2.storeId)).data || {}).status, '0', '改回正常没有落库')
  assert.equal(await appJobCount(S.store2.jobTitle), 1, '门店恢复后岗位没有重新可见')
})

await step('全程没有页面异常', async () => {
  assert.deepEqual(errors, [], '页面抛出了 JS 异常')
})

await step('每一次成功的写操作之后，页面都重新拉了该页的列表（F10）', async () => {
  await page.waitForTimeout(300)
  assert.equal(refetch.pending(), 0, '还有写请求的响应没解析完')
  const writes = refetch.okWrites()
  assert.ok(writes.length >= 9, `只抓到 ${writes.length} 个成功的写请求，判据可能没挂上`)
  const miss = refetch.missing().map(w => `${w.method} ${w.path}`)
  assert.deepEqual(miss, [], '这些操作成功之后没有重新拉列表，页面上显示的不是库里的最新值')
})

await browser.close()
console.log(`\nPASS: 报名的通过/驳回/终止/确认录用/标记入职、详情时间线、时段的有效与失效占用、`
  + `删除草稿、清空可选字段、编辑期间并发报名、重算名额、同城同名门店、重新授予 —— 都在后台浏览器里点过并回服务端核对`)
console.log(`断言 ${assertCount} 条，全部通过`)
