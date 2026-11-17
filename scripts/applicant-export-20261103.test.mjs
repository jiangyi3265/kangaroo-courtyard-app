// 2026-11-03 到店名单导出（主人：「投递简历多的当地主理人，可以一键选择时间，一键导出……身份证号和姓名，还有手机号去哪家，开始时间，结束时间」），node --test 直接跑：
//   · pages/staff/applicant-export.js：一键时间段（周一到周日、整月、未来 30 天）、链接里只有日期 / 范围 / 门店编号；
//   · 页面在 staff 分包、报名管理里只有「岗位管理·导出」的角色看得到入口；
//   · 服务端口径（静态核对，行为由 KgApplicantExportServiceTest 覆盖）。
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'
import test from 'node:test'
import assert from 'node:assert/strict'
import { RANGES, SCOPES, rangeOf, rangeText, rangeError, exportQuery, exportPath, exportFileName, PAGE } from '../pages/staff/applicant-export.js'

const APP = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const require = createRequire(path.join(APP, 'package.json'))
const compiler = require('@vue/compiler-sfc')
const read = (p) => fs.readFileSync(path.join(APP, p), 'utf8').replace(/\r\n/g, '\n')
const JAVA = '../RuoYi-Vue/ruoyi-kangaroo/src/main/java/com/ruoyi/kangaroo/'

test('一键时间段：2026-11-03（周二）', () => {
  assert.deepEqual(RANGES.map(r => r.label), ['本周', '下周', '本月', '下月', '未来 30 天', '自定义'])
  assert.deepEqual(rangeOf('thisWeek', '2026-11-03'), { from: '2026-11-02', to: '2026-11-08' })
  assert.deepEqual(rangeOf('nextWeek', '2026-11-03'), { from: '2026-11-09', to: '2026-11-15' })
  assert.deepEqual(rangeOf('thisMonth', '2026-11-03'), { from: '2026-11-01', to: '2026-11-30' })
  assert.deepEqual(rangeOf('nextMonth', '2026-11-03'), { from: '2026-12-01', to: '2026-12-31' })
  assert.deepEqual(rangeOf('next30', '2026-11-03'), { from: '2026-11-03', to: '2026-12-02' })
  assert.deepEqual(rangeOf('thisWeek', '2026-11-08'), { from: '2026-11-02', to: '2026-11-08' }, '周日还算这一周')
  assert.deepEqual(rangeOf('nextMonth', '2026-12-15'), { from: '2027-01-01', to: '2027-01-31' }, '跨年')
  assert.equal(rangeOf('custom', '2026-11-03'), null)
  assert.equal(rangeOf('thisWeek', 'bad'), null)
})

test('日期文字与自定义校验（和服务端一样最多一年）', () => {
  assert.equal(rangeText('2026-11-03', '2026-11-30'), '11月3日 – 11月30日')
  assert.equal(rangeText('2026-12-20', '2027-01-05'), '2026年12月20日 – 2027年1月5日')
  assert.equal(rangeError('', '2026-11-30'), '请选择开始和结束日期')
  assert.equal(rangeError('2026-11-30', '2026-11-01'), '结束日期不能早于开始日期')
  assert.equal(rangeError('2026-01-01', '2027-01-02'), '一次最多导出一年的名单')
  assert.equal(rangeError('2026-01-01', '2027-01-01'), '')
})

test('请求只带日期、范围、门店编号', () => {
  assert.deepEqual(SCOPES.map(s => s.key), ['active', 'hired'])
  assert.deepEqual(exportQuery({ from: '2026-11-01', to: '2026-11-30', scope: 'x', storeId: 0 }), { from: '2026-11-01', to: '2026-11-30', scope: 'active' })
  assert.equal(exportPath({ from: '2026-11-01', to: '2026-11-30', scope: 'hired', storeId: '12' }), '/app/staff/applicants/export.xlsx?from=2026-11-01&to=2026-11-30&scope=hired&storeId=12')
  assert.equal(exportFileName('2026-11-01', '2026-11-30'), '到店名单-2026-11-01至2026-11-30.xlsx')
})

test('页面在 staff 分包，模板可编译；导出走 downloadDoc（凭证在请求头），预览接口不出完整证件号', () => {
  assert.equal(PAGE, '/pages/staff/applicant-export')
  const pages = JSON.parse(read('pages.json').replace(/\/\/.*$/mg, ''))
  const staff = pages.subPackages.find(p => p.root === 'pages/staff')
  assert.ok(staff.pages.some(p => p.path === 'applicant-export'), '注册在 staff 分包')
  assert.ok(!pages.pages.some(p => /applicant-export/.test(p.path)), '不进主包')
  const src = read('pages/staff/applicant-export.vue')
  assert.match(src, /await downloadDoc\(exportPath\(/)
  assert.match(src, /只用于订票、买保险，请勿外传/)
  const { descriptor, errors } = compiler.parse(src, { filename: 'applicant-export.vue' })
  assert.equal(errors.length, 0)
  const script = compiler.compileScript(descriptor, { id: 'ae' })
  const tpl = compiler.compileTemplate({ source: descriptor.template.content, filename: 'applicant-export.vue', id: 'ae', compilerOptions: { bindingMetadata: script.bindings } })
  assert.deepEqual(tpl.errors, [])
})

test('报名管理里的入口：只有「岗位管理·导出」的角色看得到', () => {
  const src = read('pages/staff/applications.vue')
  assert.match(src, /const canExportList = computed\(\(\) => staffCan\('jobs', 'export', applicationGrant\.value\)\)/)
  assert.match(src, /<view v-if="canExportList" class="applications-tools__export"><k-button type="secondary" block icon="file-down" label="导出名单" @click="go\(APPLICANT_EXPORT_PAGE\)" \/><\/view>/)
})

test('服务端口径：按「岗位管理·导出」取门店、按开始时间筛、导出记日志、预览打码', () => {
  const svc = read(JAVA + 'ext/staff/KgApplicantExportService.java')
  assert.match(svc, /StaffPerms\.allows\(roleOf\(g\), "jobs", StaffPerms\.EXPORT\)/)
  assert.match(svc, /coalesce\(ar\.arrive_date, a\.arrival_date\) >= :f/)
  assert.match(svc, /support\.op\(support\.ctx\(sid\), "applicant_export", "导出到店名单", "export"/)
  assert.match(svc, /full \? id : KgTravelIdService\.maskId\(id, null\)/)
  const ctl = read(JAVA + 'controller/app/AppStaffApplicantExportController.java')
  assert.match(ctl, /@AppAuth\(staff = true, cityLead = true\)/)
  assert.match(ctl, /@GetMapping\("\/export\.xlsx"\)/)
  assert.match(ctl, /@GetMapping\("\/export\/preview"\)/)
})
