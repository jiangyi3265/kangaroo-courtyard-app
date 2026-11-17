// 后台「岗位管理」改所属门店的回归（admin-web 第二轮复查，node --test，不需要构建、不发请求）：
//   · 主人的做法是新建合作店 → 把岗位改到新门店 → 给负责人开主理人。改门店时，工作地点 / 城市如果还是原门店的
//     （建岗位时照抄的），要跟着换成新门店的，小程序「工作地点」才会落在招换工的这家民宿；运营自己改过的不动，
//     线上任务（城市「不限」、地点「远程」）也不受影响，但「发单方」还写着原门店名字时跟着换（线上任务卡片按它显示是哪家店）；
//   · 保存时后端把还没走完流程的报名（连同面试时段、投保申请）一起转到新门店，接口带回 movedApps，页面据此提示；
//     已结束的报名留在原门店，「已结束」的口径要和报名状态机的终态一致；
//   · 给新门店的通知点开要落在新门店的报名列表（带 storeId），两家店都有授权的员工不会停在原门店；
//   · 这些文件原本是 CRLF 换行，不能整文件转成 LF。
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'
import test from 'node:test'
import assert from 'node:assert/strict'

const APP = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const ROOT = path.resolve(APP, '..')
const JAVA = path.join(ROOT, 'RuoYi-Vue/ruoyi-kangaroo/src/main/java/com/ruoyi/kangaroo')
const ADMIN = path.join(ROOT, 'RuoYi-Vue3/src')
const require = createRequire(path.join(APP, 'package.json'))
const vue = require('vue')
const raw = (p) => fs.readFileSync(p, 'utf8')
const src = (p) => raw(p).replace(/\r\n/g, '\n')

const JOB_PAGE = path.join(ADMIN, 'views/kangaroo/job/index.vue')

/** 从岗位页取出 storeChanged 及它用到的 lastStoreId，放进沙箱里配上门店下拉和表单跑 */
function storeChangedSandbox(stores, form, startStoreId) {
  const page = src(JOB_PAGE)
  const fn = page.match(/\nfunction storeChanged\(storeId\) \{\n[\s\S]*?\n\}\n/)
  assert.ok(fn, '岗位页里要有 storeChanged')
  const sandbox = { ref: vue.ref }
  vm.createContext(sandbox)
  vm.runInContext('const storeOptions = ref(' + JSON.stringify(stores) + ')\n'
    + 'const form = ref(' + JSON.stringify(form) + ')\n'
    + 'const lastStoreId = ref(' + JSON.stringify(startStoreId) + ')\n'
    + fn[0] + '\nthis.__get = () => form.value', sandbox)
  return { change: id => vm.runInContext('storeChanged(' + JSON.stringify(id) + ')', sandbox), form: () => sandbox.__get() }
}

const STORES = [
  { storeId: 1, storeName: '袋鼠小院', city: '大理', address: '大理古城人民路 1 号' },
  { storeId: 2, storeName: '洱海边民宿', city: '大理', address: '双廊镇玉几岛 8 号' },
  { storeId: 3, storeName: '丽江合作店', city: '丽江', address: '束河古镇龙泉路 3 号' },
  { storeId: 4, storeName: '还没填地址的店', city: '', address: '' }
]

test('岗位改到新门店：照抄原门店的工作地点、城市跟着换成新门店的', () => {
  const s = storeChangedSandbox(STORES, { jobId: 9, storeId: 1, city: '大理', address: '大理古城人民路 1 号' }, 1)
  s.change(3)
  assert.equal(s.form().address, '束河古镇龙泉路 3 号')
  assert.equal(s.form().city, '丽江')
  // 选错了再换：上一步自动换上的地址也算「还是原门店的」，跟着换
  s.change(2)
  assert.equal(s.form().address, '双廊镇玉几岛 8 号')
  assert.equal(s.form().city, '大理')
})

test('运营自己填过的工作地点不动；空着的补上新门店地址；新门店没填地址时保持原样', () => {
  const typed = storeChangedSandbox(STORES, { jobId: 9, storeId: 1, city: '大理', address: '洱海西岸某客栈后院' }, 1)
  typed.change(2)
  assert.equal(typed.form().address, '洱海西岸某客栈后院')
  const empty = storeChangedSandbox(STORES, { jobId: 9, storeId: 1, city: '', address: '' }, 1)
  empty.change(2)
  assert.equal(empty.form().address, '双廊镇玉几岛 8 号')
  assert.equal(empty.form().city, '大理')
  const noAddr = storeChangedSandbox(STORES, { jobId: 9, storeId: 1, city: '大理', address: '大理古城人民路 1 号' }, 1)
  noAddr.change(4)
  assert.equal(noAddr.form().address, '大理古城人民路 1 号')
  assert.equal(noAddr.form().city, '大理')
})

test('新增岗位第一次选门店时带出地址；线上任务的「不限 / 远程」不被覆盖，发单方还是原门店名字时跟着换', () => {
  const add = storeChangedSandbox(STORES, { storeId: 2, city: undefined, address: undefined }, null)
  add.change(2)
  assert.equal(add.form().address, '双廊镇玉几岛 8 号')
  assert.equal(add.form().city, '大理')
  const online = storeChangedSandbox(STORES, { jobId: 9, jobType: 'online', storeId: 1, city: '不限', address: '远程', publisherName: '袋鼠小院' }, 1)
  online.change(3)
  assert.equal(online.form().address, '远程')
  assert.equal(online.form().city, '不限')
  // 发单方还写着原门店的名字：小程序线上任务卡片按它显示是哪家店，跟着换
  assert.equal(online.form().publisherName, '丽江合作店')
  const named = storeChangedSandbox(STORES, { jobId: 9, jobType: 'online', storeId: 1, city: '不限', address: '远程', publisherName: '某品牌市场部' }, 1)
  named.change(3)
  assert.equal(named.form().publisherName, '某品牌市场部')
  const blank = storeChangedSandbox(STORES, { jobId: 9, jobType: 'online', storeId: 1, city: '不限', address: '远程', publisherName: '' }, 1)
  blank.change(3)
  assert.equal(blank.form().publisherName, '', '留空时小程序本来就显示门店名，不补')
})

test('保存后带回转过去的报名条数，页面按它提示；改门店时表单里先说清楚会发生什么', () => {
  const ctl = src(path.join(JAVA, 'controller/admin/KgJobController.java'))
  assert.match(ctl, /kgJob\.getParams\(\)\.remove\("movedApps"\)/, '请求里自带的 movedApps 不能被原样带回')
  assert.match(ctl, /result\.put\("movedApps", moved\)/)
  const svc = src(path.join(JAVA, 'service/impl/KgJobServiceImpl.java'))
  assert.match(svc, /job\.getParams\(\)\.put\("movedApps", moved\)/)
  const page = src(JOB_PAGE)
  assert.match(page, /res\.movedApps/)
  assert.match(page, /@change="storeChanged"/)
  assert.match(page, /v-if="storeMoved"/)
})

test('换店时「已结束、留在原门店」的报名和状态机的终态是同一组；面试时段、投保、报名一起转', () => {
  const machine = src(path.join(JAVA, 'enums/ApplicationStatus.java'))
  const value = name => (machine.match(new RegExp('String ' + name + ' = "(\\w+)"')) || [])[1]
  const finals = [...machine.matchAll(/t\.put\((\w+), Collections\.<String>emptySet\(\)\)/g)].map(m => value(m[1])).sort()
  assert.deepEqual(finals, ['onboarded', 'review_rejected', 'terminated', 'withdrawn'])
  const app = src(path.join(JAVA, 'service/impl/KgApplicationServiceImpl.java'))
  const declared = (app.match(/FINAL_STATUSES = "([^"]+)"/) || [])[1]
  assert.ok(declared, 'KgApplicationServiceImpl 里要有 FINAL_STATUSES')
  assert.deepEqual(declared.replace(/'/g, '').split(',').sort(), finals)
  const move = app.slice(app.indexOf('public int moveOpenApplications('), app.indexOf('public int endOpenApplicationsOfClosedJob('))
  for (const table of ['kg_interview_slot', 'kg_insurance_apply', 'kg_application']) {
    assert.match(move, new RegExp('update ' + table + ' set store_id = :t'), table + ' 要跟着报名转到新门店')
  }
})

test('转到本店、岗位关闭的通知点开落在对应门店的报名列表（带 storeId，报名页会读它）', () => {
  const svc = src(path.join(JAVA, 'service/impl/KgJobServiceImpl.java'))
  const links = [...svc.matchAll(/"\/pages\/staff\/applications[^"]*"(?: \+ job\.getStoreId\(\))?/g)].map(m => m[0])
  assert.ok(links.length >= 2, '换店、关闭各有一条去报名列表的通知')
  for (const l of links) assert.equal(l, '"/pages/staff/applications?storeId=" + job.getStoreId()')
  const list = src(path.join(APP, 'pages/staff/applications.vue'))
  assert.match(list, /listStoreId\.value = Number\(q\?\.storeId\) > 0/)
})

test('后台文件换行保持一致，不混用两种换行', () => {
  const crlf = [
    path.join(JAVA, 'service/IKgJobService.java'),
    path.join(JAVA, 'controller/admin/KgJobController.java'),
    path.join(JAVA, 'controller/admin/KgCoreAdminController.java'),
    path.join(JAVA, 'controller/admin/KgExtAdminController.java'),
    path.join(ROOT, 'RuoYi-Vue/ruoyi-kangaroo/src/main/resources/mapper/kangaroo/KgApplicationMapper.xml'),
    path.join(ADMIN, 'views/kangaroo/application/index.vue'),
    path.join(ADMIN, 'views/kangaroo/ext/ExtCrud.vue'),
    path.join(ADMIN, 'components/ImagePreview/index.vue'),
    path.join(ADMIN, 'components/ImageUpload/index.vue'),
    path.join(ADMIN, 'utils/request.js')
  ]
  const lf = [
    path.join(JAVA, 'service/impl/KgJobServiceImpl.java'),
    path.join(JAVA, 'service/impl/KgApplicationServiceImpl.java'),
    path.join(JAVA, 'service/impl/KgInterviewSlotServiceImpl.java'),
    path.join(JAVA, 'service/IKgApplicationService.java'),
    path.join(JAVA, 'domain/KgApplication.java'),
    path.join(ROOT, 'RuoYi-Vue/ruoyi-kangaroo/src/main/resources/mapper/kangaroo/KgAppUserMapper.xml'),
    JOB_PAGE,
    path.join(ADMIN, 'views/kangaroo/store/index.vue'),
    path.join(ADMIN, 'views/kangaroo/grant/index.vue'),
    path.join(ADMIN, 'api/kangaroo/job.js')
  ]
  const count = f => { const t = raw(f); return { n: (t.match(/\n/g) || []).length, rn: (t.match(/\r\n/g) || []).length } }
  // KgApplicationMapper.xml 原本就有一行是单独的 LF，所以 CRLF 文件允许差 1 行
  for (const f of [...crlf, ...lf]) { const c = count(f); assert.ok(c.n > 0 && (c.rn === 0 || c.n - c.rn <= 1), path.relative(ROOT, f) + ' 混用了两种换行') }
})
