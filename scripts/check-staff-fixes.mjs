// 2026-10-03 员工端修复的浏览器回归：活动修改不丢介绍 / 安全说明 / 报名截止、岗位连点只建一个且分享页返回回列表、
// 已提交周报只读、业务中心「数据看板」与底栏、按角色显隐（面试时段 / Vlog 审核 / 人才档案）、调度日志入口、
// 结算最低金额提示、日报下载报错原因。全部接口用本地假数据，发往非本机地址的请求一律拦截，不会有真实提交。
// 权限表按服务端 StaffPerms.java 的矩阵原样模拟（/app/staff/team/roles 的 permissions）。
// 用法（在 袋鼠旅游2 目录下，先用静态服务把 dist/build/h5 挂到 5391 端口）：
//   node scripts/check-staff-fixes.mjs
import assert from 'node:assert/strict'
import { mkdir, writeFile } from 'node:fs/promises'
import { chromium } from 'playwright/test'

const base = 'http://127.0.0.1:5391/'
const out = process.env.CHECK_OUT || '../artifacts/staff-fixes-20261003/browser'
await mkdir(out, { recursive: true })
assert.ok((await fetch(base)).ok, base + ' unavailable')

// ---------------------------------------------------------------- 权限表（照抄 StaffPerms.java，顺序 = 查看 编辑 审核 支付 导出）
const ITEMS = [['rooms', '房源管理'], ['jobs', '岗位管理'], ['dispatch', '调度管理'], ['activities', '活动管理'],
  ['reviews', '评价管理'], ['insurance', '保险管理'], ['finance', '财务管理'], ['dashboard', '数据看板']]
const MATRIX = {
  manager: {
    rooms: ['yes', 'yes', 'yes', 'no', 'yes'], jobs: ['yes', 'yes', 'yes', 'no', 'yes'], dispatch: ['yes', 'yes', 'yes', 'no', 'yes'],
    activities: ['yes', 'yes', 'yes', 'no', 'yes'], reviews: ['yes', 'yes', 'yes', 'no', 'yes'], insurance: ['yes', 'yes', 'yes', 'yes', 'yes'],
    finance: ['yes', 'yes', 'yes', 'yes', 'yes'], dashboard: ['yes', 'no', 'no', 'no', 'yes']
  },
  keeper: {
    rooms: ['yes', 'yes', 'yes', 'no', 'no'], jobs: ['yes', 'yes', 'yes', 'no', 'no'], dispatch: ['yes', 'yes', 'yes', 'no', 'no'],
    activities: ['yes', 'yes', 'yes', 'no', 'no'], reviews: ['yes', 'yes', 'yes', 'no', 'no'], insurance: ['yes', 'yes', 'no', 'no', 'no'],
    finance: ['part', 'no', 'no', 'no', 'no'], dashboard: ['yes', 'no', 'no', 'no', 'no']
  },
  staff: {
    rooms: ['yes', 'part', 'no', 'no', 'no'], jobs: ['yes', 'no', 'no', 'no', 'no'], dispatch: ['yes', 'no', 'no', 'no', 'no'],
    activities: ['yes', 'part', 'no', 'no', 'no'], reviews: ['yes', 'part', 'no', 'no', 'no'], insurance: ['yes', 'no', 'no', 'no', 'no'],
    finance: ['no', 'no', 'no', 'no', 'no'], dashboard: ['part', 'no', 'no', 'no', 'no']
  }
}
const ROLE_NAMES = { manager: '主理人', keeper: '门店管家', staff: '员工' }
const matrix = (r) => ITEMS.map(([code, name]) => ({ code, name, values: MATRIX[r][code] }))

// ---------------------------------------------------------------- 假数据
let role = 'manager'
let walletLimits = true
const STORE = { storeId: 102, storeName: '平潭测试门店' }
const account = () => ({ id: 9001, nickname: '测试员工', staffGrants: [{ ...STORE, roleCode: role, roleName: ROLE_NAMES[role], active: true }] })

const actDetail = {
  activityId: 55, title: '海边贝壳手作下午', category: '手作课程', img: '', place: '平潭测试门店一楼手作区', capacity: 20,
  count: 3, checkedIn: 0, waitlist: 0, reviews: 0, feeFen: 0,
  startTime: '2026-10-12 14:00:00', endTime: '2026-10-12 17:00:00', deadline: '2026-10-11 20:00:00',
  intro: '用贝壳和旧渔网做一件小摆件，材料由门店提供。', safetyNote: '海边风大，请穿防滑鞋；12 岁以下需家长陪同。',
  status: 'published', statusLabel: '报名中', phase: 'open', phaseLabel: '报名中', timeText: '10月12日 14:00–17:00',
  organizerName: '测试员工', confirmed: [], waiting: [], refunds: [], canAudit: true, phoneWindow: false
}
const jobRow = { jobId: 801, title: '前台接待', status: 'published', statusLabel: '招聘中', tone: 'green', city: '平潭', area: '北厝',
  type: '兼职', jobType: 'parttime', people: 2, apply: 3, match: 80, visits: 12, img: '/static/media/rooms-cover-1.jpg' }
const weeklyReport = {
  reportId: 7, ...STORE, weekStart: '2026-09-21', weekText: '2026-09-21 ~ 09-27', status: 'submitted', version: 3,
  submittedBy: '测试员工', submittedTime: '2026-09-28 10:00', updated: '09-28 10:00', returnReason: '',
  note: '本周接待正常，周末客流较多。', risk: '暂无', proofs: [],
  fees: [{ name: '物料采购', amountFen: 12000, remark: '清洁用品' }], coops: [{ text: '请工程检查二楼空调噪音', dept: '工程部', done: false }],
  snapshot: { range: '2026-09-21 ~ 2026-09-27', works: [{ label: '房源管理', value: '3 次', icon: 'house' }], bizCols: [{ label: '营收', value: '¥3,200', delta: '+5%', up: true }],
    orderCols: [{ label: '订单', value: '12', delta: '+2', up: true }], days: ['一', '二', '三', '四', '五', '六', '日'],
    thisWeek: [30000, 42000, 38000, 50000, 61000, 70000, 29000], lastWeek: [28000, 40000, 35000, 52000, 60000, 66000, 30000] }
}
const weeklyList = {
  cards: [{ reportId: 7, ...STORE, name: STORE.storeName, weekStart: '2026-09-21', weekText: '2026-09-21 ~ 09-27', time: '09-28 10:00',
    statusText: '已提交', tone: 'done', cols: [{ label: '营收', value: '¥3,200' }, { label: '订单', value: '12' }, { label: '入住率', value: '68%' }, { label: '好评率', value: '98%' }] }],
  anomalies: [], stores: [STORE], weeks: [{ label: '2026-09-21 ~ 09-27', start: '2026-09-21' }], weekLabel: '2026-09-21 ~ 09-27', weekStart: '2026-09-21'
}
const vlogDetail = { vlogId: 5, title: '海边小院的清晨', status: 'pending', statusLabel: '待审核', source: '抖音 @平潭小院', platform: 'douyin',
  platformLabel: '抖音', authorRole: 'staff', createTime: '2026-10-02 09:00:00', stayName: '平潭测试门店', authorized: true, authorizer: '住客 A', authorizedDate: '2026-10-01' }
const talentRow = { userId: 3001, name: '林*', city: '平潭', role: '换工 / 兼职', tags: ['咖啡', '摄影'], exp: 2, date: '10-10', matches: 2, avatar: '' }
const dispatchCard = (dim) => (dim === 'store'
  ? { name: STORE.storeName, storeId: STORE.storeId, urgent: 1, need: [3, 2, 1], arranged: [1, 1, 0], gap: [2, 1, 1] }
  : { name: '平潭', urgent: 1, need: [3, 2, 1], arranged: [1, 1, 0], gap: [2, 1, 1] })
const dailyData = { ...STORE, date: '2026-10-03', dateText: '2026-10-03 周六', synced: '09:30 已同步', items: [], rows: [],
  summaries: [{ label: '总营收', amount: '¥0', delta: '较昨日 0' }, { label: '总支出', amount: '¥0', delta: '较昨日 0' }, { label: '收支结余', amount: '¥0', delta: '较昨日 0', green: true }],
  managers: [{ nickname: '测试主理人', avatar: '' }], incomeCats: ['其他收入'], expenseCats: ['采购支出'], payMethods: [] }
const wallet = () => ({ nickname: '测试员工', isManager: true, days: 120, availableFen: 50000, monthFen: 0, pendingFen: 0, monthRange: '10.01–10.03',
  payee: '招商银行（尾号 0000）', smsEnabled: false, sources: [], ...(walletLimits ? { withdrawMinFen: 1000, withdrawMaxFen: 5000000 } : {}) })

// ---------------------------------------------------------------- 浏览器与接口拦截
const browser = await chromium.launch({ headless: true })
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, timezoneId: 'Asia/Shanghai' })
const page = await context.newPage()
const errors = [], checks = [], calls = [], downloads = []
page.on('pageerror', (e) => errors.push(e.message))
page.on('download', (d) => downloads.push(d.suggestedFilename()))
await page.addInitScript(() => {
  localStorage.setItem('kangaroo:app-token', JSON.stringify({ type: 'string', data: 'staff-fixes-fixture' }))
  // 员工端当前门店（experience.js 按账号存 kangaroo:<账号>:staff-store）；身份由账号的 staffGrants 自动进入员工模式
  localStorage.setItem('kangaroo:9001:staff-store', JSON.stringify({ type: 'number', data: 102 }))
})
await page.route('**/*', async (route) => {
  const req = route.request(), u = new URL(req.url())
  if (u.host === '127.0.0.1:5391' && !u.pathname.startsWith('/app/')) return route.continue()
  if (!u.pathname.startsWith('/app/')) return route.abort()
  const p = u.pathname, method = req.method(), q = Object.fromEntries(u.searchParams)
  let body = null
  if (method !== 'GET') { try { body = req.postDataJSON() } catch { body = req.postData() } }
  calls.push({ method, path: p, query: q, body, token: req.headers()['x-app-token'] || '' })
  const r = { code: 200, msg: 'ok', data: {}, rows: [], total: 0 }
  let delay = 0
  if (p === '/app/auth/account') r.data = account()
  else if (p === '/app/message/unread') r.data = { unread: 0 }
  else if (p === '/app/staff/team/roles') r.data = { permissions: matrix(q.role || role), roles: [], selectedName: ROLE_NAMES[q.role || role], validity: '长期', canManage: role === 'manager' }
  else if (p === '/app/staff/team/hub') r.data = { ...STORE, role, roleName: ROLE_NAMES[role], name: '测试员工', isManager: role === 'manager', unread: 0 }
  // 1 活动
  else if (p === '/app/staff/activities/55' && method === 'GET') r.data = actDetail
  else if (p === '/app/staff/activities/55' && method === 'PUT') r.data = { ...actDetail, ...body, message: '已保存修改' }
  // 2 岗位
  else if (p === '/app/staff/jobs' && method === 'GET') r.data = { canEdit: true, storeCert: true, rows: [jobRow],
    metrics: [{ label: '全部岗位', value: 1, tone: '' }, { label: '招聘中', value: 1, tone: '' }, { label: '缺人中', value: 0, tone: 'amber-text' }, { label: '已暂停', value: 0, tone: '' }] }
  else if (p === '/app/staff/jobs/describe') r.data = { title: '小院换工伙伴', intro: '在海边小院做前台与客房协助。', work: '接待入住、整理客房', hope: '有耐心，能连续服务 2 周以上', basis: ['岗位类型：换工'], variant: 0 }
  else if (p === '/app/staff/jobs' && method === 'POST') { r.msg = '已提交平台审核'; r.data = { jobId: 901, status: 'draft' }; delay = 1500 }
  else if (p === '/app/staff/jobs/share-stats') r.data = { rows: [], total: { visit: 0, apply: 0, pass: 0, rate: '—' }, ranks: [], updatedAt: '10-03 09:00' }
  else if (/^\/app\/staff\/jobs\/\d+\/share$/.test(p)) r.data = { link: 'https://example.invalid/pages/jobs/detail?jobId=801&sc=fx01', shareCode: 'fx01', title: jobRow.title, summary: '平潭 · 兼职', cover: '' }
  // 3 周报
  else if (p === '/app/manage/weekly') r.data = weeklyList
  else if (p === '/app/manage/weekly/7') r.data = weeklyReport
  else if (p === '/app/manage/weekly/open') r.data = weeklyReport
  else if (p === '/app/manage/weekly/summary') r.data = { ...weeklyReport.snapshot, ...STORE, weekStart: '2026-09-21' }
  // 5 面试 / Vlog / 人才
  else if (p === '/app/staff/interviews') r.data = { title: '10月3日 周六', date: '2026-10-03', rows: [], summary: {} }
  else if (p === '/app/staff/interview-slots') r.data = []
  else if (p === '/app/staff/stay/vlogs/5') r.data = vlogDetail
  else if (p === '/app/staff/stay/vlogs') r.data = { rows: [], total: 0, lagging: [], stays: [] }
  else if (p === '/app/staff/talents/tags') r.data = { tags: [{ name: '咖啡', count: 1, icon: 'coffee', size: 2 }], cities: ['平潭'], total: 1 }
  else if (p === '/app/staff/talents/search') r.data = q.countOnly === 'true' ? { total: 1 } : { total: 1, rows: [talentRow] }
  // 6 调度
  else if (p === '/app/staff/dispatch/board') r.data = { dim: q.dim, city: '平潭', date: '2026-10-03', cities: ['平潭'], cards: [dispatchCard(q.dim)], heat: { title: '需求热力日历', month: '2026年10月', cells: [] }, topStores: [] }
  else if (p === '/app/staff/dispatch/logs') r.data = { stores: [STORE], from: '2026-09-27', to: '2026-10-03', canExport: true,
    rows: [{ logId: 1, user: '测试员工', time: '10-03 09:30', type: '数值调整', tone: 'green', job: '前台接待（兼职）', change: '名额 2 → 3', source: '手动调整', avatar: '' }] }
  // 7 钱包
  else if (p === '/app/wallet') r.data = wallet()
  // 8 日报
  else if (p === '/app/manage/daily') r.data = dailyData
  else if (p === '/app/manage/daily/report.xlsx') { r.code = 500; r.msg = '不能查看未来的日期'; delete r.data }
  if (delay) await new Promise((res) => setTimeout(res, delay))
  return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(r) })
})

// ---------------------------------------------------------------- 工具
const go = async (path) => { await page.goto(`${base}?t=${Date.now()}#/pages/${path}`); await page.waitForLoadState('networkidle') }
const hash = () => page.evaluate(() => decodeURIComponent(location.hash))
const hashHas = async (part, timeout = 8000) => {
  const end = Date.now() + timeout
  while (Date.now() < end) { if ((await hash()).includes(part)) return true; await page.waitForTimeout(150) }
  return false
}
const until = async (fn, timeout = 6000) => {
  const end = Date.now() + timeout
  while (Date.now() < end) { const v = await fn(); if (v) return v; await page.waitForTimeout(120) }
  return fn()
}
// 只在当前显示的页面里找（uni-h5 会把页面栈里的旧页面留在 DOM 里，隐藏显示）
const cur = () => page.locator('uni-page:visible').last()
const btn = (label) => cur().locator('uni-button').filter({ hasText: label })
const title = () => cur().locator('.k-navbar__title').first()
const sheetPick = async (label) => { const c = page.locator('.uni-actionsheet__cell').filter({ hasText: label }).first(); await c.waitFor(); await c.click() }
const sheetLabels = async () => {
  await page.locator('.uni-actionsheet__cell').first().waitFor()
  return (await page.locator('.uni-actionsheet__cell').allInnerTexts()).map((t) => t.trim())
}
const modal = () => page.locator('uni-modal:visible').last()
const toastText = async (ms = 6000) => {
  const t = page.locator('uni-toast .uni-simple-toast__text, uni-toast .uni-toast__content').first()
  await t.waitFor({ state: 'visible', timeout: ms }).catch(() => {})
  return (await t.innerText().catch(() => '')).trim()
}
const callsTo = (method, path) => calls.filter((c) => c.method === method && (typeof path === 'string' ? c.path === path : path.test(c.path)))
const shot = (name) => page.screenshot({ path: `${out}/${name}.png` })
const steps = []
const step = async (name, fn) => {
  const errBefore = errors.length
  try {
    await fn()
    assert.deepEqual(errors.slice(errBefore), [], 'page errors during step')
    steps.push({ name, ok: true }); checks.push(name)
    console.log('  OK    ' + name)
  } catch (e) {
    steps.push({ name, ok: false, error: e.message })
    console.log('  FAIL  ' + name + '\n        ' + e.message.split('\n').join('\n        '))
    await shot('fail-' + steps.length).catch(() => {})
  }
}

// ================================================================ 1. 活动修改不丢介绍 / 安全说明 / 报名截止
await step('1 活动「修改活动 → 保存修改」带上详情里的 intro / safetyNote / deadline', async () => {
  role = 'manager'
  await go('staff/activities?id=55')
  await cur().locator('.d-title').filter({ hasText: actDetail.title }).waitFor()
  await cur().locator('.grid__cell').filter({ hasText: '修改活动' }).click()
  const save = cur().locator('.fc-btn').filter({ hasText: '保存修改' })
  await save.waitFor()
  await shot('activity-edit')
  await save.click()
  const put = await until(() => callsTo('PUT', '/app/staff/activities/55')[0])
  assert.ok(put, 'PUT /app/staff/activities/55 should be sent')
  assert.equal(put.body.intro, actDetail.intro)
  assert.equal(put.body.safetyNote, actDetail.safetyNote)
  // 表单只到分钟：yyyy-MM-dd HH:mm（与 startTime / endTime 同一格式）
  assert.equal(put.body.deadline, actDetail.deadline.slice(0, 16))
  assert.equal(put.body.title, actDetail.title)
  assert.equal(put.body.place, actDetail.place)
  assert.equal(put.body.capacity, actDetail.capacity)
  assert.equal(put.body.startTime, actDetail.startTime.slice(0, 16))
  // 保存后回到详情
  await cur().locator('.d-title').filter({ hasText: actDetail.title }).waitFor()
  assert.equal(callsTo('POST', '/app/staff/activities').length, 0, 'editing must not create a new activity')
})

// ================================================================ 2. 岗位发布连点只建一个；分享追踪返回回列表
await step('2 岗位发布：「下一步：人工确认」连点 / 确认后再点只建 1 个岗位；分享追踪返回落在岗位列表', async () => {
  role = 'manager'
  await go('staff/jobs')
  await cur().locator('.job-card').first().waitFor()
  await btn('发布岗位').click()
  await btn('下一步：生成描述').click()
  await cur().locator('.ai-field.intro').filter({ hasText: '前台与客房协助' }).waitFor()
  const next = btn('下一步：人工确认')
  // 快速双击：只弹一个确认框
  await next.dblclick()
  await page.locator('.uni-modal__btn_primary:visible').first().waitFor()
  assert.equal(await page.locator('uni-modal:visible').count(), 1, 'double click should open exactly one confirm dialog')
  // 确认框还开着时又点到按钮（直接派发点击，绕开遮罩）
  await next.evaluate((el) => { el.click(); el.click() })
  await page.waitForTimeout(200)
  assert.equal(await page.locator('uni-modal:visible').count(), 1)
  await page.locator('.uni-modal__btn_primary:visible').first().click()
  // 创建请求在途（假接口延迟 1500ms）：等确认框收起后再连点两下，不应再弹确认框
  await page.locator('uni-modal:visible').waitFor({ state: 'hidden', timeout: 3000 }).catch(() => {})
  assert.equal(await page.locator('uni-modal:visible').count(), 0)
  assert.ok(await btn('下一步：人工确认').count(), 'still on the description screen while the request is in flight')
  await next.evaluate((el) => { el.click(); el.click() })
  await page.waitForTimeout(400)
  assert.equal(await page.locator('uni-modal:visible').count(), 0, 'no second confirm dialog while the create request is in flight')
  await title().filter({ hasText: '分享追踪' }).waitFor()
  await page.waitForTimeout(800)
  const creates = callsTo('POST', '/app/staff/jobs')
  assert.equal(creates.length, 1, 'exactly one create request, got ' + creates.length)
  assert.equal(creates[0].body.title, '小院换工伙伴')
  assert.equal(creates[0].query.storeId, '102')
  await shot('jobs-share-after-submit')
  // 分享追踪 → 返回：回岗位列表，不是还带着「下一步：人工确认」的描述页
  await cur().locator('.k-navbar__back').click()
  await title().filter({ hasText: '岗位列表' }).waitFor()
  assert.ok((await hash()).includes('pages/staff/jobs'))
  assert.equal(await btn('下一步：人工确认').count(), 0)
  assert.equal(await cur().getByText('模板生成描述').count(), 0)
  await cur().locator('.job-card').first().waitFor()
  // 从列表卡片进「分享与追踪」再返回，同样回列表
  await cur().locator('.job-card').first().click()
  await sheetPick('分享与追踪')
  await title().filter({ hasText: '分享追踪' }).waitFor()
  await cur().locator('.k-navbar__back').click()
  await title().filter({ hasText: '岗位列表' }).waitFor()
  assert.equal(await btn('下一步：人工确认').count(), 0)
  await page.waitForTimeout(300)
  assert.equal(callsTo('POST', '/app/staff/jobs').length, 1, 'still exactly one create request after going back')
  await shot('jobs-list-after-back')
  // 对照：同样用派发点击点「发布岗位」能打开表单（证明上面派发的点击确实送到了按钮上），且是一张新表
  await btn('发布岗位').evaluate((el) => el.click())
  await title().filter({ hasText: '发布岗位' }).waitFor()
  assert.equal(await btn('下一步：生成描述').count(), 1)
})

// ================================================================ 3. 已提交周报只读
await step('3 已提交周报：预览页写明不可修改、没有任何编辑 / 提交控件；返回直接回列表且不发保存', async () => {
  role = 'manager'
  await go('manage/weekly?storeId=102')
  await cur().locator('.report').first().waitFor()
  await cur().locator('.report').first().click()
  await title().filter({ hasText: '预览周报' }).waitFor()
  const lock = (await cur().locator('.lock').innerText()).trim()
  assert.ok(lock.includes('不可修改'), 'lock text should say it cannot be modified: ' + lock)
  assert.ok(lock.includes(weeklyReport.submittedTime) && lock.includes(weeklyReport.submittedBy), lock)
  assert.equal(await cur().getByText(/已保存/).count(), 0, 'submitted report must not say 已保存')
  for (const label of ['确认提交', '保存草稿', '下一步：预览提交']) assert.equal(await btn(label).count(), 0, label + ' should not be shown')
  for (const text of ['添加费用', '添加待协同事项', '我已确认周报内容真实准确']) assert.equal(await cur().getByText(text).count(), 0, text + ' should not be shown')
  assert.equal(await cur().locator('textarea, uni-textarea').count(), 0, 'no editable text area on a submitted report')
  await shot('weekly-submitted-preview')
  // 返回：直接回列表（不经过编辑页）
  const seen = []
  const watcher = setInterval(() => title().innerText({ timeout: 200 }).then((t) => seen.push(t)).catch(() => {}), 40)
  await cur().locator('.k-navbar__back').click()
  await title().filter({ hasText: '代运营周报' }).waitFor()
  clearInterval(watcher)
  assert.ok(!seen.includes('编辑周报'), 'back from preview must not pass through the edit screen: ' + JSON.stringify([...new Set(seen)]))
  await cur().locator('.report').first().waitFor()
  await page.waitForTimeout(1800) // 超过 1.5 秒自动保存的等待
  assert.equal(callsTo('PUT', /^\/app\/manage\/weekly\/\d+\/draft$/).length, 0, 'no draft save for a submitted report')
  assert.equal(callsTo('POST', /^\/app\/manage\/weekly\/\d+\/submit$/).length, 0)
  // 直接用 ?s=3 深链打开这份已提交周报，也落在预览而不是编辑页
  await go('manage/weekly?s=3&reportId=7')
  await title().filter({ hasText: '预览周报' }).waitFor()
  assert.equal(await cur().locator('textarea, uni-textarea').count(), 0)
  // 「新建周报」入口（?s=3，打开本周周报）拿到的是已提交的那份：同样只进预览
  await go('manage/weekly?s=3&storeId=102')
  await title().filter({ hasText: '预览周报' }).waitFor()
  assert.ok(callsTo('POST', '/app/manage/weekly/open').length > 0)
  assert.ok((await cur().locator('.lock').innerText()).includes('不可修改'))
  assert.equal(await cur().locator('textarea, uni-textarea').count(), 0)
  assert.equal(callsTo('PUT', /^\/app\/manage\/weekly\/\d+\/draft$/).length, 0)
})

// ================================================================ 4. 业务中心
await step('4 业务中心：主理人「数据看板」进 pages/manage/dashboard（带门店）；底栏「工作台」进工作台；普通员工不显示数据看板', async () => {
  role = 'manager'
  await go('staff/business')
  await cur().getByText('角色：主理人').first().waitFor()
  const dash = cur().locator('.daily-grid > uni-view').filter({ hasText: '数据看板' })
  await dash.waitFor()
  await shot('business-manager')
  await dash.click()
  assert.ok(await hashHas('pages/manage/dashboard'), 'should open the dashboard page, got ' + await hash())
  assert.ok((await hash()).includes('storeId=102'), 'dashboard url should carry the current store: ' + await hash())
  await go('staff/business')
  await cur().getByText('角色：主理人').first().waitFor()
  await cur().locator('.business-tabs > uni-view').filter({ hasText: '工作台' }).click()
  assert.ok(await hashHas('pages/staff/index'), 'bottom bar 工作台 should open the workbench, got ' + await hash())
  role = 'staff'
  await go('staff/business')
  await cur().getByText('角色：员工').first().waitFor()
  await cur().locator('.daily-grid').waitFor()
  await page.waitForTimeout(500)
  assert.equal(await cur().locator('.daily-grid').getByText('数据看板').count(), 0, 'staff role must not see 数据看板')
  assert.equal(await cur().locator('.daily-grid').getByText('周报管理').count(), 0)
  assert.equal(await cur().locator('.daily-grid').getByText('下周任务').count(), 1, 'the daily grid itself is rendered')
  await shot('business-staff')
})

// ================================================================ 5. 按角色显隐
for (const r of ['staff', 'manager']) {
  const staff = r === 'staff'
  await step(`5 角色 ${r}：面试时段「${staff ? '查看' : '设置'}可预约时段」、Vlog 审核按钮${staff ? '置灰写「无审核权限」' : '可用'}、人才卡片「${staff ? '无档案权限' : '查看档案'}」`, async () => {
    role = r
    // 每次整页重载后权限表重新取：等本次的 /app/staff/team/roles 回来再判断，避免"表还没到时默认显示"造成假通过
    const rolesLoaded = async (mark) => { assert.ok(await until(() => calls.slice(mark).some((c) => c.path === '/app/staff/team/roles' && c.query.role === r)), 'roles table requested'); await page.waitForTimeout(300) }
    let mark = calls.length
    await go('staff/interviews')
    await rolesLoaded(mark)
    const want = staff ? '查看可预约时段' : '设置可预约时段', other = staff ? '设置可预约时段' : '查看可预约时段'
    await btn(want).waitFor()
    await page.waitForTimeout(500)
    assert.equal(await btn(other).count(), 0, other + ' should not be shown for ' + r)
    if (staff) await shot('interviews-staff')

    mark = calls.length
    await go('staff/vlog?vlogId=5')
    await rolesLoaded(mark)
    const actions = cur().locator('.review-actions uni-button')
    await actions.first().waitFor()
    await until(async () => staff === ((await actions.nth(1).innerText()).trim() === '无审核权限'))
    const labels = (await actions.allInnerTexts()).map((t) => t.trim())
    const disabled = await actions.evaluateAll((els) => els.map((e) => e.classList.contains('is-disabled') || e.hasAttribute('disabled')))
    if (staff) {
      assert.deepEqual(labels, ['驳回', '无审核权限', '通过'])
      assert.deepEqual(disabled, [true, true, true], 'all review buttons disabled for staff')
      await shot('vlog-staff')
    } else {
      assert.deepEqual(labels, ['驳回', '驳回并说明', '通过'])
      assert.deepEqual(disabled, [false, false, false])
    }

    mark = calls.length
    await go('staff/talents?s=3')
    await rolesLoaded(mark)
    const card = cur().locator('.person-card').first()
    await card.waitFor()
    const wantBtn = staff ? '无档案权限' : '查看档案'
    await until(async () => (await card.locator('.person-side uni-button').innerText()).trim() === wantBtn)
    assert.equal((await card.locator('.person-side uni-button').innerText()).trim(), wantBtn)
    if (staff) {
      await shot('talents-staff')
      await card.click()
      assert.ok((await toastText()).includes('人才档案仅对本店换工主理人或小院主理人开放'))
      assert.equal(callsTo('GET', '/app/staff/talents/3001').length, 0, 'staff must not request the profile')
    }
  })
}

// ================================================================ 6. 调度：门店卡片 → 调度日志
await step('6 调度看板：点门店卡片有「调度日志」，进入日志屏并按这家门店取数', async () => {
  role = 'manager'
  await go('staff/dispatch')
  await title().filter({ hasText: '需求看板' }).waitFor()
  await cur().locator('.board-tabs').getByText('按门店').click()
  const card = cur().locator('.city-card').filter({ hasText: STORE.storeName }).first()
  await card.waitFor()
  await card.click()
  const opts = await sheetLabels()
  assert.ok(opts.includes('调度日志'), 'card actions should offer 调度日志: ' + JSON.stringify(opts))
  await sheetPick('调度日志')
  await title().filter({ hasText: '调度日志' }).waitFor()
  await cur().locator('.log-card').first().waitFor()
  const logReq = await until(() => callsTo('GET', '/app/staff/dispatch/logs').at(-1))
  assert.equal(logReq.query.storeId, '102', 'logs should be scoped to the tapped store')
  assert.ok((await cur().locator('.log-filters').innerText()).includes(STORE.storeName))
  await shot('dispatch-logs')
  await cur().locator('.k-navbar__back').click()
  await title().filter({ hasText: '需求看板' }).waitFor()
})

// ================================================================ 7. 结算最低金额
for (const limits of [true, false]) {
  await step(`7 钱包结算：输入 5 元提示按 ¥10 起结（${limits ? '接口下发 withdrawMinFen=1000' : '接口未下发，用默认值'}），不发结算请求`, async () => {
    role = 'manager'
    walletLimits = limits
    await go('manage/wallet?s=3')
    await cur().locator('.withdraw-balance__num').filter({ hasText: '500.00' }).waitFor()
    await cur().getByText('点击输入金额').click()
    const input = modal().locator('textarea, input').first()
    await input.waitFor()
    await input.fill('5')
    await modal().locator('.uni-modal__btn_primary').click()
    await cur().locator('.withdraw-amount__num').filter({ hasText: '5.00' }).waitFor()
    await btn('提交结算申请').click()
    const msg = await toastText()
    assert.equal(msg, '单次结算金额需在 ¥10–¥50000 之间')
    if (limits) await shot('wallet-min')
    assert.equal(callsTo('POST', '/app/wallet/withdraw').length, 0, 'no withdraw request below the minimum')
    await page.locator('uni-toast').first().waitFor({ state: 'detached', timeout: 8000 }).catch(() => {})
  })
}
walletLimits = true

// ================================================================ 8. 日报下载报错
await step('8 日报导出：下载接口回 {code:500,msg:\'不能查看未来的日期\'} 时原样提示，不下载文件', async () => {
  role = 'manager'
  await go('manage/daily?s=4')
  await cur().locator('.paper__meta').filter({ hasText: STORE.storeName }).waitFor()
  await btn('下载 Excel').click()
  const msg = await toastText()
  assert.equal(msg, '不能查看未来的日期')
  await shot('daily-download-error')
  const req = callsTo('GET', '/app/manage/daily/report.xlsx').at(-1)
  assert.ok(req, 'xlsx endpoint should be requested')
  assert.equal(req.query.storeId, '102')
  assert.equal(req.query.date, '2026-10-03')
  assert.equal(req.token, 'staff-fixes-fixture', 'download carries the app token')
  await page.waitForTimeout(500)
  assert.deepEqual(downloads, [], 'error JSON must not be saved as a file')
})

// ---------------------------------------------------------------- 汇总
const failed = steps.filter((s) => !s.ok)
const result = { checks, failed, pageErrors: errors }
await writeFile(`${out}/result.json`, JSON.stringify(result, null, 2))
console.log(JSON.stringify({ checks, failed: failed.length, pageErrors: errors.length }, null, 2))
await browser.close()
assert.deepEqual(failed, [])
assert.deepEqual(errors, [])
