// 城市负责人全部权限（2026-11-01）小程序这一头：
//   · 服务端授权带 fullAccess 才进完整工作台；老后端没有这个字段，还是原来三格的城市工作台；
//   · 平时看城市工作台，?daily=1 才进这家店的日常；
//   · 业务中心的入口都认 city_lead，招募账单独入口；
//   · X-Report-As 只对 /app/manage/ 带，离开页面清掉。
import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const src = rel => fs.readFileSync(path.join(root, rel), 'utf8').replace(/\r\n/g, '\n')

test('底栏：城市负责人只有服务端给了 fullAccess 才不是三格（老后端、老版本照旧）', () => {
  const s = src('common/experience.js')
  assert.match(s, /export const cityLeadFull = computed\(\(\) => cityLead\.value && currentStaffStore\.value\?\.fullAccess === true\)/)
  assert.match(s, /threeTabStaff = computed\(\(\) => merchantStaff\.value \|\| \(cityLead\.value && !cityLeadFull\.value\)\)/)
})

test('工作台：平时是城市工作台，?daily=1 且 fullAccess 才进门店日常；业务中心 fullAccess 就是完整的', () => {
  const index = src('pages/staff/index.vue')
  assert.match(index, /<k-city-work v-else-if="cityLead && !cityLeadDaily" \/>/)
  assert.match(index, /const cityLeadDaily = computed\(\(\) => dailyLink\.value && cityLeadFull\.value\)/)
  assert.match(index, /dailyLink\.value = String\(q\.daily\) === '1'/)
  assert.match(index, /\(!cityLead\.value \|\| cityLeadDaily\.value\)/)
  const business = src('pages/staff/business.vue')
  assert.match(business, /<k-city-work v-else-if="cityLead && \(!cityLeadFull \|\| !currentStaffStore\?\.storeId\)" \/>/)
  assert.match(business, /\(cityLead\.value && !cityLeadFull\.value\)\) return/)
})

test('城市工作台：顶上入口只给 fullAccess；文案不再说只能查看', () => {
  const s = src('pages/staff/components/k-city-work.vue')
  assert.match(s, /<template v-if="cityLeadFull">/)
  assert.match(s, /go\(R\.staff \+ '\?daily=1'\)/)
  assert.match(s, /go\(R\.staffBusiness\)/)
  assert.match(s, /cityLeadFull \? '本城全部门店' : '只含你有授权的门店'/)
  assert.doesNotMatch(s, /\b(post|put|del)\(/, '工作台本身还是不发写请求')
})

test('业务中心、保险、报销、接待设置都认 city_lead；商家专用的不认', () => {
  const business = src('pages/staff/business.vue')
  assert.match(business, /canManage = computed\(\(\) => \['manager', 'keeper', 'staff', 'city_lead'\]/)
  assert.match(business, /canStay = computed\(\(\) => \['keeper', 'merchant', 'city_lead'\]/)
  assert.match(business, /R\.weekly \+ '\?as=recruit'/)
  assert.match(business, /R\.daily \+ '\?as=recruit'/)
  assert.match(business, /\(!item\.leadOnly \|\| isCityLead\.value\)/)
  assert.match(src('pages/staff/insurance.vue'), /\['manager', 'staff', 'city_lead'\]/)
  assert.match(src('pages/staff/reimburse.vue'), /\['keeper', 'city_lead'\]\.includes\(current\.roleCode\)/)
  assert.match(src('components/k-chat-reception/k-chat-reception.vue'), /\['manager','keeper','city_lead'\]/)
})

test('招募账请求头：只对经营接口带，日报周报页进来设、离开清', () => {
  const request = src('common/request.js')
  assert.match(request, /if \(reportAs && String\(opts\.url\)\.startsWith\('\/app\/manage\/'\)\) header\['X-Report-As'\] = reportAs/)
  assert.match(request, /reportAs = value === 'recruit' \? 'recruit' : ''/)
  for (const rel of ['pages/manage/daily.vue', 'pages/manage/weekly.vue']) {
    const s = src(rel)
    assert.match(s, /reportAs = q\?\.as === 'recruit' \? 'recruit' : ''/, rel)
    assert.match(s, /onPageShow\(\(\) => setReportAs\(reportAs\)\)/, rel)
    assert.match(s, /onPageUnload\(\(\) => setReportAs\(''\)\)/, rel)
  }
})

test('版本号往上走；切换门槛没动', () => {
  assert.match(src('common/config.js'), /export const APP_VERSION = '\d{4}\.\d{2}\.\d{2}\.\d+'/)
  const java = src('../RuoYi-Vue/ruoyi-kangaroo/src/main/java/com/ruoyi/kangaroo/ext/staff/KgRoleSwitchService.java')
  assert.equal(/MIN_CLIENT_VERSION\s*=\s*"([^"]+)"/.exec(java)[1], '2026.10.30.2')
})

test('页面路由守卫：全部权限的城市负责人不被送回工作台；老后端没有 fullAccess 还是原来的白名单；旅居和线上任务页不挡他', () => {
  const s = src('main.js')
  assert.match(s, /'pages\/manage\/wallet','pages\/manage\/honor'\]\.includes\(route\) && grant\?\.fullAccess !== true\)\)\) \{/)
  assert.match(s, /\['staff', 'manager'\]\.includes\(role\) && \['pages\/staff\/rooms','pages\/staff\/stay-orders'\]/, '不把城市负责人列进旅居拦截')
})

test('本城情况、活动财务的说明：全部权限不再说只能查看、只含授权门店；老版文字留给没有 fullAccess 的', () => {
  const city = src('pages/staff/city.vue')
  assert.match(city, /cityLeadFull \? '这里是总览；要处理请从「顶上日常」进入' : '只能查看；/)
  const finance = src('pages/staff/city-finance.vue')
  assert.match(finance, /cityLeadFull \? '本城全部门店。' : '只含你有授权的门店，/)
  for (const s of [city, finance]) assert.match(s, /import \{[^}]*cityLeadFull[^}]*\} from '@\/common\/experience\.js'/)
})
