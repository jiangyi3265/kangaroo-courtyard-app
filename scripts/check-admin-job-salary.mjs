import assert from 'node:assert/strict'
import { mkdir, writeFile } from 'node:fs/promises'
import { chromium } from 'playwright'
const out = process.env.COMPENSATION_OUT || '../artifacts/independent-compensation-20261002/browser'
await mkdir(out, { recursive: true })
const browser = await chromium.launch({ headless: true })
const page = await browser.newPage({ viewport: { width: 1100, height: 1000 } })
const checks = [], errors = [], saved = []
let job = { jobId: 999, storeId: 102, storeName: '平潭袋鼠小院', title: '计薪测试', city: '平潭', jobType: 'fulltime', headcount: 2, salaryType: 'hourly', salaryMin: 25.5, salaryMax: 25.5, salaryUnit: '元/小时', boardType: 'none', status: 'draft', source: 'staff' }
job.bonusDesc = '达标奖500元'; job.commissionDesc = '个人销售额5%'
const salaryTypes = [['时薪', 'hourly'], ['日薪', 'daily'], ['周薪', 'weekly'], ['月薪', 'monthly'], ['计件', 'piece'], ['无薪资', 'none']]
page.on('pageerror', e => errors.push(e.message))
await page.context().addCookies([{ name: 'Admin-Token', value: 'fixture-admin', url: 'http://127.0.0.1:5381' }])
await page.route('**/dev-api/**', async route => {
  const path = new URL(route.request().url()).pathname.replace('/dev-api', '')
  let body = { code: 200, data: [], rows: [], total: 0 }
  if (path === '/getInfo') body = { code: 200, user: { userId: 1, userName: 'admin', nickName: '测试管理员', avatar: '' }, roles: ['admin'], permissions: ['*:*:*'] }
  else if (path === '/getRouters') body.data = [{ path: '/kangaroo', component: 'Layout', name: 'Kangaroo', meta: { title: '袋鼠小院' }, children: [{ path: 'job', component: 'kangaroo/job/index', name: 'KgJob', meta: { title: '岗位管理' } }] }]
  else if (path.endsWith('/kg_salary_type')) body.data = salaryTypes.map(([dictLabel, dictValue]) => ({ dictLabel, dictValue }))
  else if (path.endsWith('/kg_job_type')) body.data = [{ dictLabel: '全职', dictValue: 'fulltime' }]
  else if (path.endsWith('/kg_board_type')) body.data = [{ dictLabel: '不包食宿', dictValue: 'none' }]
  else if (path.endsWith('/kg_job_status')) body.data = [{ dictLabel: '草稿', dictValue: 'draft' }]
  else if (path === '/kangaroo/store/list') body = { code: 200, rows: [{ storeId: 102, storeName: '平潭袋鼠小院' }], total: 1 }
  else if (path === '/kangaroo/job/list') body = { code: 200, rows: [job], total: 1 }
  else if (path === '/kangaroo/job/999') body.data = job
  else if (path === '/kangaroo/job' && route.request().method() === 'PUT') { job = route.request().postDataJSON(); saved.push(job); body.data = 1 }
  await route.fulfill({ json: body })
})
const dialog = page.getByRole('dialog', { name: '修改岗位' })
const field = label => dialog.locator('.el-form-item').filter({ has: page.locator('.el-form-item__label').getByText(label, { exact: true }) })
try {
  await page.goto('http://127.0.0.1:5381/kangaroo/job')
  await page.getByRole('row').filter({ hasText: '计薪测试' }).getByRole('button', { name: '修改', exact: true }).click()
  await dialog.waitFor()
  assert.equal(await field('薪资单位').locator('input').inputValue(), '元/小时')
  assert.equal(await field('薪资下限').locator('input').inputValue(), '25.50')
  assert.equal(await dialog.getByRole('checkbox', { name: '奖金', exact: true }).isChecked(), true)
  assert.equal(await dialog.getByRole('checkbox', { name: '提成', exact: true }).isChecked(), true)
  assert.equal(await field('奖金规则').locator('textarea').inputValue(), '达标奖500元')
  assert.equal(await field('提成规则').locator('textarea').inputValue(), '个人销售额5%')
  checks.push('existing hourly salary loads with cents and its original unit')
  for (const [label, unit] of [['月薪', '元/月'], ['日薪', '元/天'], ['时薪', '元/小时'], ['周薪', '元/周']]) {
    await field('计薪方式').locator('.el-select').click()
    await page.getByRole('option', { name: label, exact: true }).click()
    assert.equal(await field('薪资单位').locator('input').inputValue(), unit)
    assert.equal(await field('薪资单位').locator('input').getAttribute('readonly'), '')
  }
  await page.screenshot({ path: `${out}/admin-weekly-edit.png`, fullPage: true })
  await dialog.getByRole('button', { name: '确 定', exact: true }).click()
  await dialog.waitFor({ state: 'hidden' })
  assert.equal(saved.length, 1); assert.equal(saved[0].salaryType, 'weekly'); assert.equal(saved[0].salaryUnit, '元/周'); assert.equal(saved[0].salaryMin, 25.5)
  assert.equal(saved[0].bonusDesc, '达标奖500元'); assert.equal(saved[0].commissionDesc, '个人销售额5%')
  checks.push('all four periods automatically set unit; weekly edit submits selected unit and amount')
  await page.getByRole('row').filter({ hasText: '计薪测试' }).getByRole('button', { name: '修改', exact: true }).click()
  await dialog.locator('.el-checkbox').filter({ hasText: '奖金' }).click()
  await field('提成规则').locator('textarea').fill('个人销售额8%，月结')
  await dialog.getByRole('button', { name: '确 定', exact: true }).click()
  await dialog.waitFor({ state: 'hidden' })
  assert.equal(saved[1].bonusDesc, null); assert.equal(saved[1].commissionDesc, '个人销售额8%，月结')
  checks.push('reopened record preserves both checks; removing bonus clears it while changing commission independently')
  await page.getByRole('row').filter({ hasText: '计薪测试' }).getByRole('button', { name: '修改', exact: true }).click()
  await dialog.locator('.el-checkbox').filter({ hasText: '奖金' }).click()
  await dialog.getByRole('button', { name: '确 定', exact: true }).click()
  await dialog.getByText('请填写奖金规则', { exact: true }).waitFor()
  assert.equal(saved.length, 2)
  await field('奖金规则').locator('textarea').fill('满勤奖200元')
  await dialog.getByRole('button', { name: '确 定', exact: true }).click()
  await dialog.waitFor({ state: 'hidden' })
  assert.equal(saved[2].bonusDesc, '满勤奖200元')
  checks.push('empty selected bonus rule blocks submission and can be corrected')
  await page.getByRole('row').filter({ hasText: '计薪测试' }).getByRole('button', { name: '修改', exact: true }).click()
  await field('计薪方式').locator('.el-select').click()
  await page.getByRole('option', { name: '无底薪（可单独设奖金或提成）', exact: true }).click()
  assert.equal(await dialog.getByRole('checkbox', { name: '奖金', exact: true }).isChecked(), true)
  assert.equal(await dialog.getByRole('checkbox', { name: '提成', exact: true }).isChecked(), true)
  await dialog.locator('.el-checkbox').filter({ hasText: '提成' }).click()
  await field('奖金规则').locator('textarea').fill(' ')
  await dialog.getByRole('button', { name: '确 定', exact: true }).click()
  await dialog.getByText('请填写奖金规则', { exact: true }).waitFor()
  assert.equal(saved.length, 3)
  await field('奖金规则').locator('textarea').fill('服务满30天奖励500元')
  await page.screenshot({ path: `${out}/admin-bonus-only.png`, fullPage: true })
  await dialog.getByRole('button', { name: '确 定', exact: true }).click()
  await dialog.waitFor({ state: 'hidden' })
  assert.equal(saved[3].salaryType,'none'); assert.equal(saved[3].salaryMin,null); assert.equal(saved[3].salaryUnit,null)
  assert.equal(saved[3].bonusDesc,'服务满30天奖励500元'); assert.equal(saved[3].commissionDesc,null)
  await page.getByRole('row').filter({hasText:'计薪测试'}).getByText('奖金',{exact:true}).waitFor()
  checks.push('no base salary keeps rewards enabled; bonus-only validates, saves, and displays in list')
  await page.getByRole('row').filter({ hasText: '计薪测试' }).getByRole('button', { name: '修改', exact: true }).click()
  assert.equal(await dialog.getByRole('checkbox', { name: '奖金', exact: true }).isChecked(), true)
  assert.equal(await field('奖金规则').locator('textarea').inputValue(),'服务满30天奖励500元')
  await dialog.locator('.el-checkbox').filter({ hasText: '奖金' }).click()
  await dialog.getByRole('button', { name: '确 定', exact: true }).click()
  await dialog.waitFor({ state: 'hidden' })
  assert.equal(saved[4].bonusDesc,null); assert.equal(saved[4].commissionDesc,null)
  checks.push('bonus-only record reloads correctly; unchecking removes the persisted reward')
  assert.deepEqual(errors, [])
  console.log(JSON.stringify({ checks, errors }, null, 2))
} catch (e) {
  await page.screenshot({ path: `${out}/admin-failure.png`, fullPage: true }); throw e
} finally {
  await writeFile(`${out}/admin-result.json`, JSON.stringify({ scope: 'Admin browser, explicit local API fixtures', checks, errors, saved }, null, 2))
  await browser.close()
}
