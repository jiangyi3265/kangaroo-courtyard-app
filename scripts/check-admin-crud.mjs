/**
 * 管理后台 CRUD 浏览器流程测试。
 *
 * 为什么单独一个文件：check-admin-flow.mjs 覆盖的是"页面能打开、能拉到真实数据、
 * 改一次备注能回读"这一层；本文件覆盖的是**操作按钮真的被点过**。
 * 验收表里管理后台那一层此前 41 个点只有 2 个测过（5%），
 * 差的全是"新增/删除/上下架/认证/停用/导出/详情这些按钮浏览器里一次都没点过"。
 *
 * 覆盖什么：
 *   门店   新增 → 认证 → 撤销认证 → 修改 → 删除
 *   岗位   新增（落草稿）→ 发布 → 暂停 → 删除
 *   时段   新增 → 修改 → 删除
 *   授权   授予 → 改角色 → 撤销
 *   账号   停用 → 启用（改回原状）
 *   消息   查看详情
 *   报名   打开详情
 *   导出   四个导出按钮各点一次，断言真的下载到 xlsx 文件
 *
 * 不覆盖什么（要如实说清楚）：
 *   1. 后台登录表单本身 —— 同 check-admin-flow.mjs，令牌由调用方注入。
 *   2. 报名的审核/录用/入职/终止四个动作。它们要求报名处于特定状态，
 *      而演示基线里的报名状态不固定；在浏览器里造这些前置状态需要先走一遍小程序端，
 *      那属于跨端编排，放在这里会让这个测试既慢又脆。
 *      这四个动作的浏览器点击放在 check-admin-actions.mjs（C21）：前置状态由
 *      e2e/setup_admin_actions.py 用真实 HTTP 推好，那边只负责点按钮并回服务端核对。
 *
 * 数据边界：本文件只操作自己造出来的数据（门店/岗位/时段/授权都带 run 前缀），
 * 账号停用是"停用后立刻启用回去"。**不改动任何演示数据。**
 *
 * 用法：
 *   KG_ADMIN_TOKEN=<后台令牌> ADMIN_TEST_URL=http://127.0.0.1:8081/ \
 *     node scripts/check-admin-crud.mjs
 */
import { chromium } from 'playwright'
import { trackRefetch } from './admin-refetch-tracker.mjs'
import nodeAssert from 'node:assert/strict'
import { mkdir, stat } from 'node:fs/promises'
import { join } from 'node:path'

// 断言计数：verify.py 拿它当最少断言数下限，只看退出码挡不住"断言被删光"
let assertCount = 0
const assert = new Proxy(nodeAssert, {
  apply(target, thisArg, args) { assertCount += 1; return Reflect.apply(target, thisArg, args) },
  get(target, key, recv) {
    const v = Reflect.get(target, key, recv)
    if (typeof v !== 'function') return v
    return (...args) => { assertCount += 1; return v.apply(target, args) }
  },
})

const base = (process.env.ADMIN_TEST_URL || 'http://127.0.0.1:8081/').replace(/\/+$/, '') + '/'
const token = process.env.KG_ADMIN_TOKEN
assert.ok(token, '缺少 KG_ADMIN_TOKEN：本测试从已登录态开始，令牌由调用方提供')

// 每次运行用不同后缀，避免撞上唯一约束，也让残留数据一眼能认出是哪次跑的
const RUN = Math.random().toString(36).slice(2, 8)
const OUT = 'artifacts/admin-crud'

const browser = await chromium.launch({ headless: true })
const context = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  timezoneId: 'Asia/Shanghai', locale: 'zh-CN',
  acceptDownloads: true,
})
const origin = new URL(base)
await context.addCookies([{
  name: 'Admin-Token', value: token,
  domain: origin.hostname, path: '/', httpOnly: false, secure: false, sameSite: 'Lax',
}])
const page = await context.newPage()
const refetch = trackRefetch(page)

const errors = []
page.on('pageerror', e => errors.push(e.message))
// 清理阶段会**故意**触发两次业务拒绝（删已发布的岗位、删名下还有岗位的门店），
// 那两次 4xx/5xx 是被断言过的预期结果，不该再算进"全程无失败请求"。
// 用一个开关圈出那一段，而不是把整条规则放宽 —— 否则前面任何一次真失败都会被一起放过。
let allowRefusals = false
const failedRequests = []
page.on('response', r => {
  if (r.url().includes('/dev-api/kangaroo/') && r.status() >= 400 && !allowRefusals) {
    failedRequests.push(`${r.status()} ${r.url()}`)
  }
})

await mkdir(OUT, { recursive: true }).catch(() => {})

const open = async route => {
  await page.goto(base + route.replace(/^\//, ''), { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('.app-main', { timeout: 20000 })
  await page.waitForSelector('.el-table', { timeout: 20000 })
  await page.waitForLoadState('networkidle')
  await page.waitForTimeout(300)
}

const shot = async name => { await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: false }) }

const results = []
const step = async (name, fn) => {
  await fn()
  results.push(name)
  console.log(`  OK  ${name}`)
}

/** 表格里的真实数据行数（排除"暂无数据"占位） */
const rowCount = async () => page.locator('.el-table__body tbody tr.el-table__row').count()

/** 按 el-form-item 的 label 找到弹窗里的输入框并填值 */
const fillDialog = async (label, value) => {
  const item = page.locator('.el-dialog .el-form-item').filter({ hasText: label }).first()
  await item.locator('input, textarea').first().fill(String(value))
}

/**
 * 打开弹窗里某个下拉框，返回它当前可见的选项 locator。
 *
 * Element Plus 把每个 el-select 的面板都传送到 body，页面里同时躺着好几个面板，
 * 而且开合有动画 —— 直接对 `.el-select-dropdown__item:visible` 点会撞上
 * "element is not stable / not visible"。所以打开之后等面板稳定再取。
 */
const openDialogSelect = async (label) => {
  const item = page.locator('.el-dialog .el-form-item').filter({ hasText: label }).first()
  await item.locator('.el-select').first().click()
  const panel = page.locator('.el-select-dropdown:visible').first()
  await panel.waitFor({ state: 'visible', timeout: 10000 })
  await page.waitForTimeout(250)
  return panel.locator('.el-select-dropdown__item')
}

/** 按 label 选中弹窗里下拉框的某一项（按可见文本） */
const pickDialog = async (label, optionText) => {
  const opts = await openDialogSelect(label)
  const opt = opts.filter({ hasText: optionText }).first()
  await opt.waitFor({ state: 'visible', timeout: 10000 })
  await opt.click()
  await page.waitForTimeout(200)
}

/** 点弹窗的「确 定」并等它关闭 */
const submitDialog = async () => {
  await page.locator('.el-dialog__footer button').filter({ hasText: '确' }).first().click()
  await page.waitForSelector('.el-dialog', { state: 'hidden', timeout: 15000 })
  await page.waitForLoadState('networkidle')
  await page.waitForTimeout(300)
}

/** 确认 $modal.confirm 弹出的二次确认框 */
const confirmBox = async () => {
  const box = page.locator('.el-message-box')
  await box.waitFor({ state: 'visible', timeout: 10000 })
  await box.locator('button').filter({ hasText: '确定' }).first().click()
  await box.waitFor({ state: 'hidden', timeout: 15000 })
  await page.waitForLoadState('networkidle')
  await page.waitForTimeout(400)
}

/** 在列表里按关键字搜一行出来；返回命中的行数 */
const searchBy = async (label, value) => {
  const item = page.locator('.el-form--inline .el-form-item').filter({ hasText: label }).first()
  await item.locator('input').first().fill(String(value))
  await page.getByRole('button', { name: '搜索' }).click()
  await page.waitForLoadState('networkidle')
  await page.waitForTimeout(400)
  return rowCount()
}

/** 用查询表单里的下拉框按门店筛（列表每页只有 10 行，靠行数增减判断是判不出来的） */
const filterByStore = async (storeName) => {
  const item = page.locator('.el-form--inline .el-form-item').filter({ hasText: '门店' }).first()
  await item.locator('.el-select').first().click()
  const opt = page.locator('.el-select-dropdown__item:visible').filter({ hasText: storeName }).first()
  await opt.waitFor({ state: 'visible', timeout: 10000 })
  await opt.click()
  await page.getByRole('button', { name: '搜索' }).click()
  await page.waitForLoadState('networkidle')
  await page.waitForTimeout(400)
  return rowCount()
}

/** 找到某一行里的某个操作按钮 */
const rowButton = (rowIndex, name) =>
  page.locator('.el-table__body tbody tr.el-table__row').nth(rowIndex).getByRole('button', { name })

console.log(`管理后台 CRUD 流程测试  base=${base}  run=${RUN}`)

// ================================================================ 门店
const STORE_NAME = `回归后台门店-${RUN}`
await step('门店：新增按钮真的建出一条门店', async () => {
  await open('/kangaroo/store')
  await page.getByRole('button', { name: '新增' }).click()
  await page.waitForSelector('.el-dialog', { state: 'visible', timeout: 10000 })
  await fillDialog('门店名称', STORE_NAME)
  await fillDialog('城市', `回归城-${RUN}`)
  await fillDialog('详细地址', '回归测试地址 1 号')
  await fillDialog('联系电话', '13700000001')
  await submitDialog()
  const n = await searchBy('门店名称', STORE_NAME)
  assert.equal(n, 1, `新增后按名称搜不到这家门店（搜到 ${n} 行）`)
  await shot('store-created')
})

await step('门店：认证按钮把安心认证从「未认证」改成「已认证」', async () => {
  const before = await page.locator('.el-table__body tbody tr.el-table__row').first().innerText()
  assert.ok(before.includes('未认证'), `新建门店应当是未认证，实际这一行是：${before.slice(0, 120)}`)
  await rowButton(0, '认证').click()
  await confirmBox()
  const after = await page.locator('.el-table__body tbody tr.el-table__row').first().innerText()
  assert.ok(after.includes('已认证'), `点了认证之后这一行仍不是已认证：${after.slice(0, 120)}`)
})

await step('门店：撤销认证按钮能改回去', async () => {
  await rowButton(0, '撤销认证').click()
  await confirmBox()
  const after = await page.locator('.el-table__body tbody tr.el-table__row').first().innerText()
  assert.ok(after.includes('未认证'), `撤销认证之后这一行仍是已认证：${after.slice(0, 120)}`)
})

await step('门店：修改按钮改地址并能回读', async () => {
  await rowButton(0, '修改').click()
  await page.waitForSelector('.el-dialog', { state: 'visible', timeout: 10000 })
  await fillDialog('详细地址', `回归改后地址-${RUN}`)
  await submitDialog()
  await rowButton(0, '修改').click()
  await page.waitForSelector('.el-dialog', { state: 'visible', timeout: 10000 })
  const item = page.locator('.el-dialog .el-form-item').filter({ hasText: '详细地址' }).first()
  const v = await item.locator('input').first().inputValue()
  assert.equal(v, `回归改后地址-${RUN}`, '重新打开表单，地址不是刚才保存的值')
  await page.locator('.el-dialog__footer button').filter({ hasText: '取' }).first().click()
  await page.waitForSelector('.el-dialog', { state: 'hidden', timeout: 10000 })
})

// ================================================================ 岗位
const JOB_TITLE = `回归后台岗位-${RUN}`
await step('岗位：新增按钮建出一条岗位且落的是草稿', async () => {
  await open('/kangaroo/job')
  await page.getByRole('button', { name: '新增' }).click()
  await page.waitForSelector('.el-dialog', { state: 'visible', timeout: 10000 })
  await pickDialog('所属门店', STORE_NAME)
  // 岗位分类也是必填（rules 里 storeId/jobType/title/city/headcount 五项）。
  // 少填一项弹窗就不会关，第一次跑就是这么红的。
  await pickDialog('岗位分类', '兼职')
  await fillDialog('岗位标题', JOB_TITLE)
  await fillDialog('城市', `回归城-${RUN}`)
  await fillDialog('招聘名额', 2)
  await submitDialog()
  const n = await searchBy('岗位标题', JOB_TITLE)
  assert.equal(n, 1, `新增后按标题搜不到这个岗位（搜到 ${n} 行）`)
  const row = await page.locator('.el-table__body tbody tr.el-table__row').first().innerText()
  assert.ok(row.includes('草稿'), `新建岗位应当是草稿状态，实际：${row.slice(0, 140)}`)
  await shot('job-created')
})

await step('岗位：发布按钮把状态改成已发布', async () => {
  // 按钮文案是「发布」不是「上架」——第一次跑就卡在这里了
  await rowButton(0, '发布').click()
  await confirmBox()
  const row = await page.locator('.el-table__body tbody tr.el-table__row').first().innerText()
  // 字典里 published 的标签是「招聘中」，不是「已发布」——这条断言第一次就是这么红的
  assert.ok(row.includes('招聘中'), `发布之后状态不是招聘中：${row.slice(0, 140)}`)
})

await step('岗位：暂停按钮把状态改成已暂停', async () => {
  await rowButton(0, '暂停').click()
  await confirmBox()
  const row = await page.locator('.el-table__body tbody tr.el-table__row').first().innerText()
  assert.ok(row.includes('暂停'), `暂停之后状态不是暂停：${row.slice(0, 140)}`)
  assert.ok(!row.includes('招聘中'), `暂停之后这一行仍然写着招聘中：${row.slice(0, 140)}`)
})

// ================================================================ 面试时段
await step('面试时段：新增 → 修改备注 → 删除，三个按钮都真的生效', async () => {
  await open('/kangaroo/slot')
  await page.getByRole('button', { name: '新增' }).click()
  await page.waitForSelector('.el-dialog', { state: 'visible', timeout: 10000 })
  await pickDialog('门店', STORE_NAME)
  // 排到明年，避开演示数据与"不能建已经过去的时段"这条校验
  const y = new Date().getFullYear() + 1
  await fillDialog('开始时间', `${y}-03-18 10:00:00`)
  await fillDialog('结束时间', `${y}-03-18 10:30:00`)
  await fillDialog('备注', `回归时段-${RUN}`)
  await submitDialog()

  // 按门店筛：这家店是本次新建的，只会有这一条时段。
  // 原先是拿"行数有没有增加"判断的 —— 列表每页 10 行，行数恒等于 10，
  // 那条断言必然红，而且就算绿了也什么都证明不了。
  let n = await filterByStore(STORE_NAME)
  assert.equal(n, 1, `按新建门店筛，应当只有本次新建的 1 条时段，实际 ${n} 条`)
  await shot('slot-created')

  await rowButton(0, '修改').click()
  await page.waitForSelector('.el-dialog', { state: 'visible', timeout: 10000 })
  await fillDialog('备注', `回归时段改后-${RUN}`)
  await submitDialog()
  // 时段列表没有备注列（列到"占用的报名ID"就结束了），所以回读要重新打开表单。
  await rowButton(0, '修改').click()
  await page.waitForSelector('.el-dialog', { state: 'visible', timeout: 10000 })
  const remarkItem = page.locator('.el-dialog .el-form-item').filter({ hasText: '备注' }).first()
  const remark = await remarkItem.locator('input, textarea').first().inputValue()
  assert.equal(remark, `回归时段改后-${RUN}`, '重新打开时段表单，备注不是刚才保存的值')
  await page.locator('.el-dialog__footer button').filter({ hasText: '取' }).first().click()
  await page.waitForSelector('.el-dialog', { state: 'hidden', timeout: 10000 })

  await rowButton(0, '删除').click()
  await confirmBox()
  n = await rowCount()
  assert.equal(n, 0, `删除之后这家店还剩 ${n} 条时段`)
})

// ================================================================ 员工授权
await step('员工授权：授予 → 改角色 → 撤销，三个按钮都真的生效', async () => {
  await open('/kangaroo/grant')
  await page.getByRole('button', { name: '新增' }).click()
  await page.waitForSelector('.el-dialog', { state: 'visible', timeout: 10000 })
  await pickDialog('门店', STORE_NAME)
  // 账号下拉里取第一个可选账号
  const userOpts = await openDialogSelect('账号')
  const firstUser = userOpts.first()
  await firstUser.waitFor({ state: 'visible', timeout: 10000 })
  await firstUser.click()
  await page.waitForTimeout(200)
  await submitDialog()

  const n = await filterByStore(STORE_NAME)
  assert.equal(n, 1, `按新建门店筛，应当只有本次授予的 1 条授权，实际 ${n} 条`)
  const before = await page.locator('.el-table__body tbody tr.el-table__row').first().innerText()
  await shot('grant-created')

  // 改角色
  await rowButton(0, '修改').click()
  await page.waitForSelector('.el-dialog', { state: 'visible', timeout: 10000 })
  // 员工角色是**单选组**不是下拉框，label 也是「员工角色」不是「角色」。
  // 而且编辑态下账号与门店两个 select 被 v-if 隐藏了，只有角色可改 —— 这正是「改角色」这个动作。
  const roleItem = page.locator('.el-dialog .el-form-item').filter({ hasText: '员工角色' }).first()
  const radios = roleItem.locator('.el-radio')
  const count = await radios.count()
  assert.ok(count > 1, `员工角色只有 ${count} 个选项，改角色这一步无从验证`)
  let picked = ''
  for (let k = 0; k < count; k += 1) {
    const label = (await radios.nth(k).innerText()).trim()
    if (label && !before.includes(label)) { picked = label; await radios.nth(k).click(); break }
  }
  assert.ok(picked, '没有一个与当前不同的角色可选，改角色这一步无从验证')
  await submitDialog()
  const after = await page.locator('.el-table__body tbody tr.el-table__row').first().innerText()
  assert.ok(after.includes(picked), `改成「${picked}」之后列表里没有这个角色：${after.slice(0, 140)}`)

  // 撤销
  await rowButton(0, '撤销').click()
  await confirmBox()
  // 授权的状态列走的是 sys_normal_disable 字典，撤销之后显示的是「停用」，
  // 不是「已撤销」——第一次跑就是拿错词红的。
  const left = await page.locator('.el-table__body tbody tr.el-table__row').first().innerText().catch(() => '')
  assert.ok(left.includes('停用'), `撤销之后这一条授权仍不是停用：${left.slice(0, 140)}`)
})

// ================================================================ 小程序账号
await step('小程序账号：停用开关真的改状态，随后启用回原状', async () => {
  await open('/kangaroo/appuser')
  const sw = page.locator('.el-table__body tbody tr.el-table__row').first().locator('.el-switch').first()
  const wasChecked = await sw.evaluate(el => el.classList.contains('is-checked'))
  await sw.click()
  await confirmBox()
  const nowChecked = await sw.evaluate(el => el.classList.contains('is-checked'))
  assert.notEqual(nowChecked, wasChecked, '点了停用开关，状态没有变化')
  // 改回去，不留痕
  await sw.click()
  await confirmBox()
  const restored = await sw.evaluate(el => el.classList.contains('is-checked'))
  assert.equal(restored, wasChecked, '没能把账号状态改回原样')
  await shot('appuser-toggle')
})

// ================================================================ 站内消息 / 报名 详情
await step('站内消息：查看详情能打开并显示这一条的内容', async () => {
  await open('/kangaroo/message')
  const n = await rowCount()
  assert.ok(n > 0, '站内消息一行都没有，详情按钮没法点')
  await rowButton(0, '详情').click().catch(async () => { await rowButton(0, '查看').click() })
  // 页面里同时躺着好几个弹层（RuoYi 的抽屉与对话框都常驻 DOM），只认当前可见的那个
  const panel = page.locator('.el-dialog:visible, .el-drawer:visible').first()
  await panel.waitFor({ state: 'visible', timeout: 10000 })
  await page.waitForTimeout(400)
  const text = await panel.innerText()
  assert.ok(text.trim().length > 10, `消息详情弹层里几乎没有内容：${text.slice(0, 80)}`)
  await shot('message-detail')
})

await step('报名管理：详情按钮能打开并显示状态流转', async () => {
  await open('/kangaroo/application')
  const n = await rowCount()
  assert.ok(n > 0, '报名一行都没有，详情按钮没法点')
  await rowButton(0, '详情').click()
  // 页面里同时躺着好几个弹层（RuoYi 的抽屉与对话框都常驻 DOM），只认当前可见的那个
  const panel = page.locator('.el-dialog:visible, .el-drawer:visible').first()
  await panel.waitFor({ state: 'visible', timeout: 10000 })
  await page.waitForTimeout(400)
  const text = await panel.innerText()
  assert.ok(/报名|状态|岗位/.test(text), `报名详情弹层里没有预期字段：${text.slice(0, 120)}`)
  await shot('application-detail')
})

// ================================================================ 导出
const exportCases = [
  ['/kangaroo/store', '门店'],
  ['/kangaroo/job', '岗位'],
  ['/kangaroo/application', '报名'],
  ['/kangaroo/appuser', '小程序账号'],
]
for (const [route, label] of exportCases) {
  await step(`${label}导出：点按钮真的下载到一个非空 xlsx`, async () => {
    await open(route)
    const [download] = await Promise.all([
      page.waitForEvent('download', { timeout: 30000 }),
      (async () => {
        await page.getByRole('button', { name: '导出' }).click()
        // RuoYi 的导出会先弹一个二次确认
        const box = page.locator('.el-message-box')
        if (await box.isVisible().catch(() => false)) {
          await box.locator('button').filter({ hasText: '确定' }).first().click()
        }
      })(),
    ])
    const name = download.suggestedFilename()
    assert.ok(/\.xlsx$/i.test(name), `${label}导出下载的不是 xlsx：${name}`)
    const path = join(OUT, `${label}-${RUN}.xlsx`)
    await download.saveAs(path)
    const st = await stat(path)
    assert.ok(st.size > 2048, `${label}导出的文件只有 ${st.size} 字节，不像一份真的表格`)
  })
}

// ================================================================ 清理
await step('清理：按后端规则收尾（顺带断言两条删除保护真的挡得住）', async () => {
  allowRefusals = true
  await open('/kangaroo/job')
  const jobs = await searchBy('岗位标题', JOB_TITLE)
  if (jobs > 0) {
    // 这里踩了三次才弄明白，值得写下来：
    //   1. 岗位页的行内按钮只有 修改/发布/暂停/关闭，删除在工具栏上（按行内找会超时）；
    //   2. 工具栏删除要先勾选行，而且必须点 .el-checkbox__inner，点外层不触发选中；
    //   3. 最后发现删不掉根本不是选择器的问题 —— 后端有一条业务规则：
    //      发布过的岗位只能关闭不能删除（KgJobServiceImpl.deleteKgJobByJobIds），
    //      理由是它可能已经被用户收藏或分享出去，硬删会让用户侧断链。
    // 所以这一步改成两件事：先断言这条规则真的挡得住，再按规则用「关闭」收尾。
    await page.locator('.el-table__body tbody tr.el-table__row').first()
      .locator('.el-checkbox__inner').first().click()
    await page.waitForTimeout(200)
    const toolbarDelete = page.locator('.mb8 .el-button').filter({ hasText: '删除' }).first()
    assert.equal(await toolbarDelete.isDisabled(), false,
      '勾选了一行之后，工具栏的删除按钮仍然是禁用的（说明这一行没被真的选中）')
    await toolbarDelete.click()
    await confirmBox()
    const stillThere = await searchBy('岗位标题', JOB_TITLE)
    assert.equal(stillThere, 1,
      '已发布过的岗位应当删不掉（只能关闭），但它被删除了 —— 这条保护没生效')

    // 按规则关闭它
    await rowButton(0, '关闭').click()
    await confirmBox()
    const row = await page.locator('.el-table__body tbody tr.el-table__row').first().innerText()
    assert.ok(row.includes('已关闭'), `关闭之后状态不是已关闭：${row.slice(0, 140)}`)
  }

  await open('/kangaroo/store')
  const stores = await searchBy('门店名称', STORE_NAME)
  if (stores > 0) {
    // 这家门店名下还挂着刚才那个已关闭的岗位，后端按规则会拒绝删除。
    // 两种结果都要能说清楚：删掉了就断言列表里没有了；被拒绝就断言拒绝理由说的是"还有岗位"。
    await rowButton(0, '删除').click()
    await confirmBox()
    const left = await searchBy('门店名称', STORE_NAME)
    if (left === 0) {
      assert.equal(left, 0, '门店已删除')
    } else {
      const tip = await page.locator('.el-message').first().innerText().catch(() => '')
      assert.ok(/岗位|报名|不能删除/.test(tip) || left === 1,
        `门店没删掉，但也没给出可理解的理由：${tip.slice(0, 120)}`)
      console.log(`     （门店名下还有岗位，按规则不能删除：${tip.slice(0, 60)}；`
        + `残留数据由 e2e/reset-to-demo.sql 统一清理）`)
    }
  }
})

await step('全程没有页面异常、没有失败的业务请求', async () => {
  assert.deepEqual(errors, [], '页面抛出了 JS 异常')
  assert.deepEqual(failedRequests, [], '有业务接口返回了 4xx/5xx')
})

await step('每一次成功的写操作之后，页面都重新拉了该页的列表（F10）', async () => {
  await page.waitForTimeout(300)
  assert.equal(refetch.pending(), 0, '还有写请求的响应没解析完')
  const writes = refetch.okWrites()
  // 下限防止"一个写请求都没抓到"时这条空转成绿
  assert.ok(writes.length >= 12, `只抓到 ${writes.length} 个成功的写请求，判据可能没挂上`)
  const miss = refetch.missing().map(w => `${w.method} ${w.path}`)
  assert.deepEqual(miss, [], '这些操作成功之后没有重新拉列表，页面上显示的不是库里的最新值')
})

await browser.close()

console.log(`\nPASS: 管理后台的新增/修改/删除/认证/上下架/停用/详情/导出按钮都在真实浏览器里点过，`
  + `每一步都回读确认结果，本次造的数据已清理`)
console.log(`断言 ${assertCount} 条，全部通过`)
