// 2026-11-03 主人对组织者「活动详情」页的三条要求（node --test，不需要构建、不发请求）：
//   1.「相册管理」「更多设置」合成「修改活动」（打开整张修改表，封面也在里面换）；
//   2.「活动群聊」「成员管理」合成「成员与群聊」：单独一页，最上面大按钮进活动群，下面成员名单；8 格变 6 格（3×2）、格子更大；
//   3.「出示二维码失效，生成失败」：签到码单独一页，微信小程序码按当前小程序版本生成；生成不出来给普通二维码 + 6 位活动签到码，
//      参与者在报名凭证页「现场签到」扫码或输码。不再出现「请稍后重试 可稍后再次点击重试」两句重复。
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { createRequire } from 'node:module'
import test from 'node:test'
import assert from 'node:assert/strict'

const APP = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const require = createRequire(path.join(APP, 'package.json'))
const compiler = require('@vue/compiler-sfc'), vue = require('vue')
const src = (rel) => fs.readFileSync(path.join(APP, rel), 'utf8').replace(/\r\n/g, '\n')
const flush = () => new Promise(resolve => setImmediate(resolve))
const { parseActivityScene } = await import(pathToFileURL(path.join(APP, 'common/activity-code.js')).href)

/** 在沙箱里跑页面的 script setup：导入先给永远不返回的函数，再用 stubs 覆盖（同 other-forms-20261031.test.mjs） */
function runSetup(rel, stubs) {
  const d = compiler.parse(src(rel), { filename: rel }).descriptor
  const source = d.scriptSetup.content
  const ast = compiler.babelParse(source, { sourceType: 'module' })
  const body = ast.program.body.filter(n => n.type !== 'ImportDeclaration').map(n => source.slice(n.start, n.end)).join('\n')
  const sandbox = { console, setTimeout, clearTimeout, setInterval: () => 0, clearInterval() {}, encodeURIComponent }
  for (const n of ast.program.body.filter(n => n.type === 'ImportDeclaration')) for (const s of n.specifiers) sandbox[s.local.name] = () => new Promise(() => {})
  Object.assign(sandbox, { ref: vue.ref, computed: vue.computed, watch: vue.watch, onShow() {}, onHide() {}, onUnload() {}, onShareAppMessage() {} }, stubs)
  vm.createContext(sandbox)
  const scope = vue.effectScope()
  scope.run(() => vm.runInContext(body, sandbox, { filename: rel + ':script-setup' }))
  return { run: code => vm.runInContext(code, sandbox), stop: () => scope.stop(), template: d.template.content, script: source, styles: d.styles.map(x => x.content).join('\n') }
}

test('活动详情：6 格（3×2），合并后的两格名字和去处对；旧四格的名字都不在了', () => {
  const gone = []
  const s = vue.ref(4)
  const h = runSetup('pages/staff/activities.vue', {
    useScreen: () => s, staffCan: () => true, go: u => gone.push(u), R: { staffReviews: '/pages/staff/reviews' }, uni: { getSystemInfoSync: () => ({ windowWidth: 375 }) },
    sheet: async () => 1, offerDraft: async () => {}
  })
  h.run("d.value = { activityId: 31, title: '海边 徒步&看日落', category: '徒步', startTime: '2026-11-08 09:00:00', endTime: '2026-11-08 12:00:00', capacity: 20, feeFen: 0 }")
  const tiles = JSON.parse(h.run('JSON.stringify(actions.value.map(a => [a.title, a.sub]))'))
  assert.deepEqual(tiles.map(t => t[0]), ['成员与群聊', '签到管理', '现场通知', '修改活动', '评价收集', '数据看板'])
  assert.equal(tiles[3][1], '封面、时间、介绍')
  for (const old of ['相册管理', '更多设置', '活动群聊', '成员管理']) assert.ok(!tiles.some(t => t[0] === old), old)
  h.run('actions.value[0].run()')
  assert.deepEqual(gone, ['/pages/staff/activity-members?id=31'])
  h.run('actions.value[3].run()')
  assert.equal(h.run('s.value'), 2, '「修改活动」打开修改表')
  assert.equal(h.run('editId.value'), 31)
  // 3×2 网格：分隔线按 3 列算，格子更高、字更大
  assert.match(h.template, /'grid__cell--r': i % 3 !== 2, 'grid__cell--b': i < actions\.length - 3/)
  assert.match(h.styles, /\.grid \{ display: grid; grid-template-columns: repeat\(3, 1fr\)/)
  assert.match(h.styles, /\.grid__cell \{ height: 112px;/)
  assert.match(h.styles, /\.grid__title \{[^}]*font-size: 17px/)
  // 封面在修改表里换：单独换封面的整条保存删掉了
  assert.doesNotMatch(h.script, /changeCover|editPayload/)
  assert.match(h.template, /fc-cover[\s\S]*@click="pickCover"/)
  assert.match(h.template, /请点下面的「修改活动」改好后再提交/)
  h.stop()
})

test('签到管理：「出示签到二维码」进单独一页，带活动编号和标题；不再弹两句重复的「重试」', async () => {
  const gone = []
  const h = runSetup('pages/staff/activities.vue', { useScreen: () => vue.ref(4), staffCan: () => true, go: u => gone.push(u), sheet: async () => 1, uni: {} })
  h.run("d.value = { activityId: 31, title: '海边 徒步&看日落' }")
  await h.run('checkinMenu()')
  assert.deepEqual(gone, ['/pages/community/activity-checkin?mode=staff&id=31&title=' + encodeURIComponent('海边 徒步&看日落')])
  for (const rel of ['pages/staff/activities.vue', 'pages/community/activity-mine.vue']) assert.doesNotMatch(src(rel), /可稍后再次点击重试/, rel)
  assert.match(src('pages/community/activity-mine.vue'), /const showQr = \(\) => go\('\/pages\/community\/activity-checkin\?mode=user&id=' \+ m\.value\.activityId/)
  assert.doesNotMatch(src('common/activity-code.js'), /暂不可用，请重试/)
  h.stop()
})

function checkinPage(q, reply, envVersion) {
  const calls = []
  let boot
  const api = (mode) => async (id, env) => { calls.push([mode, id, env]); if (reply instanceof Error) throw reply; return { data: reply } }
  const h = runSetup('pages/community/activity-checkin.vue', {
    useScreen: (n, o) => { boot = o.onLoad; return vue.ref(1) }, ensureSession: async () => {}, errText: (e, d) => (e && e.message) || d,
    apiStaffActivityCheckinCode: api('staff'), apiActivityCheckinCode: api('user'),
    uni: { getAccountInfoSync: () => { if (envVersion === 'throw') throw new Error('no'); return { miniProgram: { envVersion } } }, showToast() {} }
  })
  return { h, calls, load: async () => { await boot(q); await flush() } }
}

test('签到码页：按当前小程序版本要码；员工 / 发起人走各自接口', async () => {
  const ok = { code: { state: 'ready', image: 'data:image/png;base64,AAAA', envVersion: 'trial' }, pin: '042517', plainQr: 'data:image/png;base64,BBBB' }
  let p = checkinPage({ id: '31', mode: 'staff', title: '徒步' }, ok, 'trial')
  await p.load()
  assert.deepEqual(p.calls, [['staff', '31', 'trial']])
  assert.equal(p.h.run('wxReady.value'), true)
  assert.match(p.h.run('envTip.value'), /体验版/)
  assert.deepEqual(JSON.parse(p.h.run('JSON.stringify(pinDigits.value)')), ['0', '4', '2', '5', '1', '7'])
  p = checkinPage({ id: '31', mode: 'user' }, ok, 'throw')
  await p.load()
  assert.deepEqual(p.calls, [['user', '31', undefined]], '拿不到版本（网页版）就交给服务端按配置')
  p = checkinPage({ id: 'abc' }, ok, 'release')
  await p.load()
  assert.deepEqual(p.calls, [])
  assert.match(p.h.run('loadError.value'), /活动编号/)
})

test('签到码页：微信码没生成出来，显示原因 + 普通二维码 + 6 位码，不卡住；接口失败可重试', async () => {
  const p = checkinPage({ id: '31', mode: 'staff' }, { code: { state: 'error', image: '', message: '这个小程序版本里还没有活动页（多半是正式版还没发布）', errcode: 41030 }, pin: '123456', plainQr: 'data:image/png;base64,BBBB' }, 'release')
  await p.load()
  assert.equal(p.h.run('wxReady.value'), false)
  assert.match(p.h.run('wxFailText.value'), /正式版还没发布.*先用下面这张二维码签到/)
  assert.doesNotMatch(p.h.run('wxFailText.value'), /重试.*重试/)
  const t = p.h.template
  assert.match(t, /v-if="info\.plainQr" class="ck-qr" :src="info\.plainQr"/)
  assert.match(t, /v-if="info\.pin"/)
  assert.match(t, /label="再试一次微信小程序码" @click="load"/)
  const bad = checkinPage({ id: '31' }, new Error('网络不通'), 'release')
  await bad.load()
  assert.equal(bad.h.run('loadError.value'), '网络不通')
  assert.match(bad.h.template, /label="重新生成" @click="load"/)
})

test('成员与群聊页：最上面大按钮进活动群，下面名单；私信 / 电话 / 退款规则照旧', async () => {
  const gone = [], toasts = []
  let boot
  const h = runSetup('pages/staff/activity-members.vue', {
    useScreen: (n, o) => { boot = o.onLoad; return vue.ref(1) }, ensureSession: async () => {}, go: u => gone.push(u), toast: m => toasts.push(m), errText: (e, d) => d,
    R: { chat: '/pages/community/chat' }, staffCan: () => false, absUrl: x => x,
    apiStaffActivity: async () => ({ data: { activityId: 31, title: '徒步', checkedIn: 1, phoneWindow: false, canPay: false,
      confirmed: [{ signupId: 1, userId: 5, name: '老王', tag: '已签到', checkedIn: true, phone: '138****0000' }], waiting: [{ signupId: 2, userId: 6, name: '小李', tag: '候补1', phone: '未验证手机号' }], refunds: [{ signupId: 3 }] } }),
    apiChatOpen: async (p) => ({ data: { convId: p.type === 'activity' ? 900 : 901 } }), gated: (fn) => fn()
  })
  await boot({ id: '31' }); await flush()
  const t = h.template
  assert.ok(t.indexOf('进入活动群聊') < t.indexOf('v-for="sec in sections"'), '进群按钮在名单上面')
  assert.match(t, /<k-button class="mb-group" block size="lg" icon="message-circle" label="进入活动群聊" @click="openGroup" \/>/)
  assert.deepEqual(JSON.parse(h.run('JSON.stringify(sections.value.map(x => [x.name, x.list.length]))')), [['已确认', 1], ['候补', 1]])
  await h.run('openGroup()')
  await h.run('message(waiting.value[0])')
  assert.deepEqual(gone, ['/pages/community/chat?convId=900', '/pages/community/chat?convId=901'])
  await h.run('call(confirmed.value[0])')
  assert.match(toasts.pop(), /24 小时/)
  await h.run('refundFlow()')
  assert.match(toasts.pop(), /没有活动退款审批权限/)
  h.stop()
})

test('参与者报名凭证「现场签到」：微信小程序码、普通二维码都认，另一场活动的码不认；也能输 6 位码', async () => {
  const s = src('pages/community/activity.vue')
  const re = new RegExp(/const CHECKIN_SCENE = \/(.+)\/\n/.exec(s)[1])
  const tok = '0123456789abcdef'
  const wx = 'pages/community/activity?scene=c_v_' + tok
  const plain = '袋鼠旅游活动签到：请在袋鼠旅游小程序「报名凭证 → 现场签到」里扫码 c_v_' + tok
  for (const raw of [wx, plain]) assert.deepEqual({ ...parseActivityScene(re.exec(raw)[0]) }, { id: '31', checkin: tok, scene: 'c_v_' + tok, channel: 'official' })
  assert.equal(re.exec('c_v_0123456789ab').index, 0, '老活动 12 位 token 也认')
  assert.equal(re.exec('https://example.com/?x=a_v'), null)
  assert.match(s, /v-if="ticket\.status === 'confirmed' && !ticket\.checkedIn" class="reminder" hover-class="k-press" @click="selfCheckin"/)
  // 跑一遍两条路
  const calls = [], alerts = []
  let pick = 0
  const h = runSetup('pages/community/activity.vue', {
    useScreen: () => vue.ref(4), ensureSession: async () => {}, sheet: async () => pick, prompt: async () => ' 123456 ', alert: async (a, b) => alerts.push(b), fail: (e, d) => alerts.push('fail:' + (e.message || d)),
    parseActivityScene, apiActivity: async (id, q) => { calls.push(['scan', id, q]); return { data: { checkin: '签到成功' } } },
    apiActivityCheckinPin: async (id, code) => { calls.push(['pin', id, code]); return { msg: '你已签到' } },
    apiSignup: async () => ({ data: {} }), experience: { account: {} }, saveCommunityCity() {}, absUrl: x => x,
    uni: { scanCode: (o) => o.success({ result: plain }), getStorageSync: () => '', setStorageSync() {} }
  })
  h.run("ticket.value = { activityId: 31, signupId: 8, status: 'confirmed' }")
  await h.run('selfCheckin()')
  pick = 1
  await h.run('selfCheckin()')
  assert.deepEqual(JSON.parse(JSON.stringify(calls)), [['scan', '31', { channel: 'official', checkin: tok }], ['pin', 31, '123456']])
  assert.deepEqual(alerts.slice(0, 2), ['签到成功', '你已签到'])
  pick = 0
  h.run("ticket.value = { activityId: 32, signupId: 8, status: 'confirmed' }")
  await h.run('selfCheckin()')
  assert.match(alerts.pop(), /另一场活动/)
  h.stop()
})

test('接口和页面登记：三个新接口在 api.js 末尾，两个新页面在各自分包', () => {
  const api = src('common/api.js')
  assert.match(api, /export const apiStaffActivityCheckinCode = \(id, env\) => get\('\/app\/staff\/activities\/' \+ id \+ '\/checkin-code', \{ env \}\)/)
  assert.match(api, /export const apiActivityCheckinCode = \(id, env\) => get\('\/app\/activities\/' \+ id \+ '\/manage\/checkin-code', \{ env \}\)/)
  assert.match(api, /export const apiActivityCheckinPin = \(id, code\) => post\('\/app\/activities\/' \+ id \+ '\/checkin-pin', \{ code \}\)/)
  const pages = JSON.parse(src('pages.json'))
  const sub = (root) => pages.subPackages.find(p => p.root === root).pages.map(p => p.path)
  assert.ok(sub('pages/community').includes('activity-checkin'))
  assert.ok(sub('pages/staff').includes('activity-members'))
})
