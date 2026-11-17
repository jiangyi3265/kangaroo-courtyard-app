// Actual admin UI with isolated API fixtures. No production writes.
import assert from 'node:assert/strict'
import { chromium } from 'playwright'
import { mkdir, writeFile } from 'node:fs/promises'
const out = process.env.CHECK_OUT || '../artifacts/grant-store-fix-20261002'
await mkdir(out, { recursive: true })
const browser = await chromium.launch({ headless: true })
const page = await browser.newPage({ viewport: { width: 1100, height: 850 } })
const errors = [], checks = [], submitted = []
let stores = [{ storeId: 101, storeName: '旧门店', status: '0' }], storeReads = 0, failStores = false
page.on('pageerror', error => errors.push(error.message))
await page.context().addCookies([{ name: 'Admin-Token', value: 'fixture-admin', url: 'http://127.0.0.1:5381' }])
await page.route('**/dev-api/**', async route => {
  const url = new URL(route.request().url()), path = url.pathname.replace('/dev-api', '')
  let body = { code: 200, data: [], rows: [], total: 0 }
  if (path === '/getInfo') body = { code: 200, user: { userId: 1, userName: 'admin', nickName: '测试管理员', avatar: '' }, roles: ['admin'], permissions: ['*:*:*'] }
  else if (path === '/getRouters') body.data = [{ path: '/kangaroo', component: 'Layout', name: 'Kangaroo', meta: { title: '袋鼠小院' }, children: [{ path: 'grant', component: 'kangaroo/grant/index', name: 'KgGrant', meta: { title: '员工授权' } }] }]
  else if (path === '/kangaroo/grant/roles') body.data = { roles: [], actions: [], selectable: ['staff', 'manager'], labels: { staff: '员工', manager: '换工主理人' }, phase: 'legacy', hint: '' }
  else if (path.endsWith('/kg_staff_role')) body.data = [{ dictLabel: '员工', dictValue: 'staff' }, { dictLabel: '主理人', dictValue: 'manager' }]
  else if (path.endsWith('/sys_normal_disable')) body.data = [{ dictLabel: '正常', dictValue: '0' }, { dictLabel: '停用', dictValue: '1' }]
  else if (path === '/kangaroo/store/list') {
    storeReads++
    body = failStores ? { code: 500, msg: '测试门店读取失败' } : { code: 200, rows: stores, total: stores.length }
  } else if (path === '/kangaroo/appuser/list') body = { code: 200, rows: [{ userId: 9001, nickname: '测试员工', phone: '13900000001' }], total: 1 }
  else if (path === '/kangaroo/grant' && route.request().method() === 'POST') { submitted.push(route.request().postDataJSON()); body = { code: 200, data: 9 } }
  await route.fulfill({ json: body })
})
const dialog = page.getByRole('dialog', { name: '新增员工授权' })
async function choose(label, option) {
  await dialog.locator('.el-form-item').filter({ has: page.locator('.el-form-item__label').getByText(label, { exact: true }) }).locator('.el-select').click()
  // 小程序账号是远程搜索：要打字才有候选
  if (label === '小程序账号') await page.keyboard.type('测试')
  await page.getByRole('option', { name: option, exact: true }).click()
}
try {
  await page.goto('http://127.0.0.1:5381/kangaroo/grant')
  await page.getByRole('button', { name: '新增授权', exact: true }).waitFor()
  await page.waitForLoadState('networkidle')
  assert.equal(storeReads, 1)
  stores = [{ storeId: 102, storeName: '平潭袋鼠小院', status: '0' }]
  await page.getByRole('button', { name: '新增授权', exact: true }).click()
  await dialog.waitFor()
  await choose('小程序账号', '测试员工（ID 9001 / 13900000001）')
  await choose('门店', '平潭袋鼠小院')
  await dialog.locator('.el-radio').filter({ hasText: '员工' }).first().click() // 角色不再有默认值
  assert.equal(storeReads, 2)
  assert.equal(await dialog.getByText('旧门店', { exact: true }).count(), 0)
  checks.push('旧页面打开新增授权时刷新候选，可选择重建后的门店')

  // Delete/recreate again after the user has selected a store, before submit.
  stores = [{ storeId: 103, storeName: '重建门店', status: '0' }]
  await dialog.getByRole('button', { name: '确 定', exact: true }).click()
  await page.getByText('所选门店已删除或停用，请重新选择当前门店', { exact: true }).waitFor()
  assert.equal(submitted.length, 0)
  await page.screenshot({ path: `${out}/stale-store-rejected.png`, fullPage: true })
  checks.push('提交前门店被删除，清除旧选择并保留表单，不发送错误授权')
  await choose('门店', '重建门店')
  await dialog.getByRole('button', { name: '确 定', exact: true }).click()
  await dialog.waitFor({ state: 'hidden' })
  assert.deepEqual(submitted, [{ appUserId: 9001, storeId: 103, roleCode: 'staff', alsoService: '0' }])
  checks.push('重新选择当前门店后提交正确编号并授权成功')

  await page.getByRole('button', { name: '新增授权', exact: true }).click()
  await choose('小程序账号', '测试员工（ID 9001 / 13900000001）')
  await choose('门店', '重建门店')
  await dialog.locator('.el-radio').filter({ hasText: '员工' }).first().click() // 角色不再有默认值
  failStores = true
  await dialog.getByRole('button', { name: '确 定', exact: true }).click()
  await page.getByText('测试门店读取失败', { exact: true }).waitFor()
  assert.equal(submitted.length, 1)
  assert.equal(await dialog.isVisible(), true)
  checks.push('最新门店读取失败时保留表单，不提交缓存门店')
  assert.deepEqual(errors, [])
  console.log(JSON.stringify({ scope: 'Admin browser with explicit API fixtures', checks, errors, submitted }, null, 2))
} catch (error) {
  await page.screenshot({ path: `${out}/failure.png`, fullPage: true })
  throw error
} finally {
  await writeFile(`${out}/browser-result.json`, JSON.stringify({ checks, errors, submitted }, null, 2))
  await browser.close()
}
