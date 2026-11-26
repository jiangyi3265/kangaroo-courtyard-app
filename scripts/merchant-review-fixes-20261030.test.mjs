// 2026-10-30 复查修复的前端回归（node --test，不构建、不发请求）：
//   · main.js 全局守卫：消息带 ?storeId= 时按那家店的角色判，不把人送回工作台；
//   · 只填店名代提交的需求没有「退回」；上架后岗位暂停、关闭时颜色不再是绿的；
//   · 合作商家上架后没有「换岗位照片」；门店没地址时工作地点必填；
//   · 成为商家先验证手机号；「我的」有退出合作商家；首页有评价管理；
//   · 后台：有岗位的需求标题和说明只读，有关闭、标记完成的说明。
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import { fileURLToPath, pathToFileURL } from 'node:url'
import test from 'node:test'
import assert from 'node:assert/strict'
import { pendingStaffRoute } from '../common/staff-scope.js'

const APP = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const src = (rel) => fs.readFileSync(path.join(APP, rel), 'utf8').replace(/\r\n/g, '\n')
const load = (rel) => import(pathToFileURL(path.join(APP, rel)).href)
const v = await load('pages/staff/request-view.js')
const logic = await load('pages/staff/merchant-request-logic.js')

/** 真跑一遍 main.js 里的 onLoad 守卫：把 import 换成假的 experience，看页面有没有被送走 */
function runGuard({ route, query, current, grants }) {
  const code = src('main.js')
  const start = code.indexOf('async onLoad(q) {')
  const end = code.indexOf('\n\t\t}\n\t})', start)
  assert.ok(start > 0 && end > start, 'main.js 守卫没找到')
  const body = code.slice(start + 'async onLoad(q) {'.length, end)
  const redirects = []
  const sandbox = {
    pendingStaffRoute,
    getCurrentPages: () => [{ route }],
    ensureSession: async () => {},
    uni: { redirectTo: (o) => redirects.push(o.url), showToast() {} },
    experience: { account: { staffGrants: grants.map(g => ({ ...g, active: true })) } },
    currentStaffStore: { value: grants.find(g => g.storeId === current) },
    staffStores: { value: grants },
    hasStaffAccess: { value: true },
    q: query, redirects
  }
  vm.createContext(sandbox)
  return vm.runInContext('(async () => {' + body + '\n})()', sandbox).then(() => redirects)
}
const GRANTS = [{ storeId: 1, roleCode: 'merchant' }, { storeId: 2, roleCode: 'manager' }, { storeId: 3, roleCode: 'merchant_service' }]

test('换工主理人兼商家：当前门店是商家店，点待核实消息（带他的主理门店）不被送回工作台', async () => {
  assert.deepEqual(await runGuard({ route: 'pages/staff/intake', query: { storeId: '2', requestId: '7' }, current: 1, grants: GRANTS }), [])
})
test('当前门店是商家服务人，点带门店的岗位消息也不被送回', async () => {
  assert.deepEqual(await runGuard({ route: 'pages/staff/jobs', query: { storeId: '2' }, current: 3, grants: GRANTS }), [])
})
test('没带门店、或带的门店没有授权，还是按当前门店拦', async () => {
  assert.deepEqual(await runGuard({ route: 'pages/staff/intake', query: {}, current: 1, grants: GRANTS }), ['/pages/staff/index'])
  assert.deepEqual(await runGuard({ route: 'pages/staff/intake', query: { storeId: '99' }, current: 1, grants: GRANTS }), ['/pages/staff/index'])
})
test('带的门店角色也不允许的页面还是拦', async () => {
  assert.deepEqual(await runGuard({ route: 'pages/staff/intake', query: { storeId: '3' }, current: 2, grants: GRANTS }), ['/pages/staff/index'])
  assert.deepEqual(await runGuard({ route: 'pages/staff/online-jobs', query: { storeId: '2' }, current: 1, grants: GRANTS }), ['/pages/staff/index'])
})

test('只填店名代提交的需求不给退回', () => {
  assert.deepEqual(v.intakeActions({ status: 'pending_verify', canReturn: false }), ['forward'])
  assert.deepEqual(v.intakeActions({ status: 'pending_verify', canReturn: true }), ['forward', 'return'])
  assert.deepEqual(v.intakeActions({ status: 'pending_verify' }), ['forward', 'return'], '老接口没有这个字段时照旧')
  assert.deepEqual(v.intakeActions({ status: 'forwarded', canReturn: true }), [])
})

test('上架后岗位暂停、关闭：文字由服务端给，颜色不再是已上架的绿色', () => {
  assert.equal(v.statusTone('published'), 'green')
  assert.equal(v.statusTone('published', 'published'), 'green')
  assert.equal(v.statusTone('published', 'paused'), 'neutral')
  assert.equal(v.statusTone('published', 'closed'), 'neutral')
  assert.equal(v.statusTone('dispatched', 'closed'), 'ochre')
  assert.equal(logic.requestTone('published'), 'good')
  assert.equal(logic.requestTone('published', 'closed'), 'mute')
  assert.equal(logic.requestTone('published', 'paused'), 'mute')
  assert.equal(logic.requestTone('done', 'closed'), 'good')
  assert.match(src('pages/staff/components/k-request-row.vue'), /statusTone\(item\.status, item\.jobStatus\)/)
  assert.match(src('pages/staff/components/k-request-detail.vue'), /statusTone\(detail\.status, detail\.jobStatus\)/)
  assert.match(src('pages/staff/components/k-merchant-work.vue'), /toneOf\(r\.status, r\.jobStatus\)/)
})

test('合作商家上架后没有「换岗位照片」，草稿和换工主理人还有', () => {
  const jobs = src('pages/staff/jobs.vue')
  assert.match(jobs, /if \(canToggle && condEditable\(j\)\) acts\.push\(COND_ACTION\)\n/)
  assert.match(jobs, /if \(canToggle && condEditable\(j\) && !\(merchantStaff\.value && j\.rawStatus !== 'draft'\)\) acts\.push\(PHOTO_ACTION\)/)
})

test('门店没有地址时工作地点必填，提示里不再写「默认：门店地址」后面空着', () => {
  const jobs = src('pages/staff/jobs.vue')
  assert.match(jobs, /!storeAddress\.value && !String\(f\.address \|\| ''\)\.trim\(\)\) e\.address =/)
  assert.ok(/const ERR_ORDER = \[[^\]]*'address'/.test(jobs), '定位到第一个错误时也包含工作地点')
  assert.match(jobs, /<view id="pf-address"/)
  assert.match(jobs, /<text v-if="err\.address" class="fc-err">/)
  assert.match(jobs, /storeAddress\.value \? '默认：门店地址 ' \+ storeAddress\.value : '请选择或填写工作地点'/)
})

test('成为商家：申请页直接调用微信手机号授权，不再跳到绑定页或要求再输入号码', () => {
  const page = src('pages/profile/merchant.vue')
  assert.match(page, /@getphonenumber="verifyMerchantPhone"/)
  assert.match(page, /getPhoneNumber/)
  assert.doesNotMatch(page, /mode=bind-phone|v-model="form\.phone"/)
})

test('我的：合作商家能自己退出，服务端说还差什么就照实显示', () => {
  const page = src('pages/profile/index.vue')
  const home = page.slice(page.indexOf('class="mine-links staff-account__links"'), page.indexOf('<view v-else-if="s === 1"'))
  assert.doesNotMatch(home, /exitMerchant/)
  assert.match(home, /设置[\s\S]*返回用户首页<\/text><k-icon[^>]+\/><\/view><\/view>/)
  const settings = page.slice(page.indexOf('class="k-body k-pad-tab settings"'), page.indexOf('<script setup>'))
  assert.match(settings, /v-if="staffMode && merchantStaff"[^>]*>\s*<view[^>]*@click="exitMerchant"/)
  assert.match(page, /post\('\/app\/merchant\/exit'\)/)
  assert.match(page, /await apiMerchantExit\(\)/)
  assert.match(page, /confirm\('暂时不能退出', errText\(e/)
  assert.ok(!src('common/api.js').includes('merchant/exit'), '主包 api.js 不加东西')
})

test('商家首页有评价管理（页面和权限早就有，只是没入口）', () => {
  assert.match(src('pages/staff/components/k-merchant-work.vue'), /label: '评价管理'[^\n]*R\.staffReviews/)
  assert.match(src('main.js'), /'pages\/staff\/reviews'/)
})

test('后台：有岗位的需求标题和说明只读', () => {
  const page = fs.readFileSync(path.join(APP, '../RuoYi-Vue3/src/views/kangaroo/ext/merchantrequest/index.vue'), 'utf8')
  assert.match(page, /:field-locked="jobTextLocked"/)
  assert.match(page, /!!row\.jobId && \['title', 'content'\]\.includes\(f\.name\)/)
  const crud = fs.readFileSync(path.join(APP, '../RuoYi-Vue3/src/views/kangaroo/ext/ExtCrud.vue'), 'utf8')
  assert.match(crud, /fieldLocked: \{ type: Function, default: null \}/)
  assert.match(crud, /props\.fieldLocked && props\.fieldLocked\(form, f\)/)
})
