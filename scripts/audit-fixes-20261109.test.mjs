// 2026-11-09 全方位复查修的几处小程序问题（node --test，不需要构建、不发请求）。
// 守住这几件事：
//   F1 「收藏与关注 → 活动」读收藏的活动（/app/activities/favorites），不是「我的活动」（后端 mine 没有 fav 页签，之前列出来的是报名的活动）；
//   F2 「管理员任务」：线上专员、商家服务人、城市负责人、小院主理人工作台上都有入口，路由守卫不能把他们踢回工作台；
//   F3  合作商家能进 Vlog 页（房源「更多 → 上传 Vlog」提交后跳过去，接口都对商家放行）；
//   F4  发起活动 / 找搭子同步活动：报名截止已经过了先提示，不提交（之前上线一分钟就被定时任务关成「报名截止」）；
//   F5  私信菜单「拉黑 / 取消拉黑」看是不是我拉黑了对方（blocked 是双向的，被对方拉黑时之前显示「取消拉黑」）。
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import { fileURLToPath } from 'node:url'
import test from 'node:test'
import assert from 'node:assert/strict'
import { pendingStaffRoute } from '../common/staff-scope.js'

const APP = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const src = (rel) => fs.readFileSync(path.join(APP, rel), 'utf8').replace(/\r\n/g, '\n')

test('F1 收藏的活动读 /app/activities/favorites，封面字段认 img', () => {
  assert.match(src('common/api.js'), /export const apiActivityFavorites = \(\) => get\('\/app\/activities\/favorites'\)/)
  const page = src('pages/profile/follows.vue')
  assert.match(page, /if \(kind === 'activity'\) d = \(await apiActivityFavorites\(\)\)\.data/)
  assert.doesNotMatch(page, /apiMyActivities\('fav'\)/)
  assert.match(page, /const firstImage = \(x\) => x\.cover \|\| x\.image \|\| x\.img \|\|/)
})

// 真跑一遍 main.js 里的 onLoad 守卫（和其他守卫测试同一种做法），hasStaffTaskRole 按 common/staff-task-reminder.js 的定义放进沙箱
const reminder = src('common/staff-task-reminder.js')
const ROLES = JSON.parse(reminder.match(/export const STAFF_TASK_ROLES = (\[[^\]]*\])/)[1].replace(/'/g, '"'))
function runGuard({ route, current, grants }) {
  const code = src('main.js')
  const start = code.indexOf('async onLoad(q) {')
  const end = code.indexOf('\n\t\t}\n\t})', start)
  assert.ok(start > 0 && end > start, 'main.js 守卫没找到')
  const body = code.slice(start + 'async onLoad(q) {'.length, end)
  const redirects = []
  const sandbox = {
    pendingStaffRoute,
    hasStaffTaskRole: (gs) => (gs || []).some(g => g.active && ROLES.includes(g.roleCode)),
    getCurrentPages: () => [{ route }], ensureSession: async () => {},
    uni: { redirectTo: (o) => redirects.push(o.url), showToast: () => {} },
    experience: { account: { staffGrants: grants.map(g => ({ ...g, active: true })) } },
    currentStaffStore: { value: grants.find(g => g.storeId === current) }, staffStores: { value: grants }, hasStaffAccess: { value: true }, q: {}
  }
  vm.createContext(sandbox)
  return vm.runInContext('(async () => {' + body + '\n})()', sandbox).then(() => redirects)
}

test('F2 管理员任务页：有任一任务岗位就放行；合作商家照旧送回', async () => {
  assert.match(src('main.js'), /import \{ hasStaffTaskRole \} from '\.\/common\/staff-task-reminder\.js'/)
  assert.deepEqual(ROLES, ['manager', 'keeper', 'online_staff', 'merchant_service', 'city_lead'])
  for (const roleCode of ['online_staff', 'merchant_service', 'manager', 'keeper']) {
    assert.deepEqual(await runGuard({ route: 'pages/staff/platform-tasks', current: 3, grants: [{ storeId: 3, roleCode }] }), [], roleCode)
  }
  assert.deepEqual(await runGuard({ route: 'pages/staff/platform-tasks', current: 3, grants: [{ storeId: 3, roleCode: 'merchant' }] }), ['/pages/staff/index'])
  // 别的页照旧按原来的白名单
  assert.deepEqual(await runGuard({ route: 'pages/staff/dispatch', current: 3, grants: [{ storeId: 3, roleCode: 'online_staff' }] }), ['/pages/staff/index'])
})

// 本城还没有门店的城市授权（storeId 为空、只有 cityId）：能被派管理员任务（后端 @AppAuth cityGrant 放行），要能进任务页处理；
// 别的业务页照旧送回工作台、提示门店开通后才能用；合作商家不是员工，任务页也照旧送回
test('F2b 没有门店的城市授权：管理员任务能进，其他业务页照旧挡', async () => {
  for (const roleCode of ['city_lead', 'manager', 'keeper', 'online_staff', 'merchant_service']) {
    const grants = [{ storeId: null, cityId: 20, city: '大连', roleCode, fullAccess: roleCode === 'city_lead' }]
    assert.deepEqual(await runGuard({ route: 'pages/staff/platform-tasks', current: null, grants }), [], roleCode)
    assert.deepEqual(await runGuard({ route: 'pages/staff/jobs', current: null, grants }), ['/pages/staff/index'], roleCode)
    assert.deepEqual(await runGuard({ route: 'pages/staff/index', current: null, grants }), [], roleCode)
  }
  assert.deepEqual(await runGuard({ route: 'pages/staff/platform-tasks', current: null, grants: [{ storeId: null, cityId: 20, roleCode: 'merchant' }] }), ['/pages/staff/index'])
  // 任务提醒对只有城市授权的账号也开（之前要求有门店）
  assert.match(reminder, /g\.active && \(g\.storeId != null \|\| g\.cityId != null\) && STAFF_TASK_ROLES\.includes\(g\.roleCode\)/)
  // 工作台首页（筹备页）有「管理员任务」入口；onShow 先刷新待办数再按筹备页返回
  const pending = src('pages/staff/components/k-staff-pending.vue')
  assert.match(pending, /<k-task-entry v-if="hasTasks" \/>/)
  assert.match(pending, /import KTaskEntry from '\.\/k-task-entry\.vue'/)
  assert.match(pending, /const hasTasks = computed\(\(\) => hasStaffTaskRole\(experience\.account\?\.staffGrants\)\)/)
  const index = src('pages/staff/index.vue')
  const show = index.slice(index.indexOf('onShow(async () => {'))
  assert.ok(show.indexOf('checkStaffTaskReminder()') < show.indexOf('if (pendingScope.value) return'), '筹备页也刷新管理员任务待办数')
})

test('F2c 筹备页组件能编译', async () => {
  const { createRequire } = await import('node:module')
  const compiler = createRequire(path.join(APP, 'package.json'))('@vue/compiler-sfc')
  const rel = 'pages/staff/components/k-staff-pending.vue'
  const d = compiler.parse(src(rel), { filename: rel }).descriptor
  assert.deepEqual(compiler.compileTemplate({ source: d.template.content, filename: rel, id: 'x' }).errors, [])
  assert.ok(compiler.compileScript(d, { id: 'x' }).content.length > 0)
})

test('F3 合作商家能进 Vlog 页', async () => {
  assert.deepEqual(await runGuard({ route: 'pages/staff/vlog', current: 9, grants: [{ storeId: 9, roleCode: 'merchant' }] }), [])
})

test('F4 报名截止已过先提示，不提交', () => {
  const mine = src('pages/community/activity-mine.vue')
  const confirmFn = mine.slice(mine.indexOf('function toConfirm()'), mine.indexOf('\n}\n', mine.indexOf('function toConfirm()')))
  assert.match(confirmFn, /if \(deadlineAt\.value\.getTime\(\) <= Date\.now\(\)\) return toast\(/)
  assert.ok(confirmFn.indexOf('deadlineAt.value.getTime()') < confirmFn.indexOf('s.value = 3'), '先查截止再进确认页')
  const pub = src('pages/community/publish.vue')
  const buddy = pub.slice(pub.indexOf('function publishBuddy()'), pub.indexOf('\n}\n', pub.indexOf('function publishBuddy()')))
  assert.match(buddy, /if \(deadlineAt\.value\.getTime\(\) <= Date\.now\(\)\) return toast\(/)
  assert.ok(buddy.indexOf('deadlineAt.value.getTime()') < buddy.indexOf('submit({'), '先查截止再提交')
})

test('F5 私信拉黑菜单看 iBlocked（服务端没给时退回 blocked）', () => {
  const chat = src('pages/community/chat.vue')
  assert.match(chat, /const iBlocked = computed\(\(\) => \(conv\.value\.iBlocked != null \? !!conv\.value\.iBlocked : !!conv\.value\.blocked\)\)/)
  assert.match(chat, /opts\.push\(iBlocked\.value \? '取消拉黑' : '拉黑'\)/)
  assert.doesNotMatch(chat, /conv\.value\.blocked \? '取消拉黑'/)
})
