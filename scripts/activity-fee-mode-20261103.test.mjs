// 2026-11-03 主人：活动费用三选一（「价格，免费，aa制」）+ 用户发起活动也能选「免费 / AA制 / 收费」，以及时间一个滚轮同时选（node --test，不需要构建、不发请求）。
// 守住这几件事：
//   · 免费、AA制报名都不付钱；收费必须填大于 0 的金额；AA 的预估人均选填；
//   · 用户自发活动的「收费」只是标价，到场付给发起人，平台不代收（服务端 fee_mode=offline，不建支付单）；
//   · AA 活动不当成「免费活动」（小院页不标免费色，旅居下单不自动报名）；
//   · 详情页按钮写「报名（现场AA）」，价格写「约¥80 /人 · 现场AA」或「AA制」；
//   · 免责说明（主人拍板）：用户发起的到场收费活动、所有 AA 活动，在发起表单、详情价格下面、报名确认框里说清平台不经手；
//   · 两张表的按钮顺序一样：免费 / 收费 / AA制。
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
const plain = (v) => JSON.parse(JSON.stringify(v))
const flush = () => new Promise(resolve => setImmediate(resolve))
const FORM = await import(pathToFileURL(path.join(APP, 'common/activity-form.js')).href)
const { activityRow } = await import(pathToFileURL(path.join(APP, 'pages/stays/stays-activities.js')).href)

/** 在沙箱里跑页面的 script setup：导入先给永远不返回的函数，再用 stubs 覆盖（同 other-forms-20261031.test.mjs） */
function runSetup(rel, stubs) {
  const d = compiler.parse(src(rel), { filename: rel }).descriptor
  const source = d.scriptSetup.content
  const ast = compiler.babelParse(source, { sourceType: 'module' })
  const body = ast.program.body.filter(n => n.type !== 'ImportDeclaration').map(n => source.slice(n.start, n.end)).join('\n')
  const sandbox = { console, setTimeout: () => 0, clearTimeout() {}, setInterval: () => 0, clearInterval() {}, encodeURIComponent, Date }
  for (const n of ast.program.body.filter(n => n.type === 'ImportDeclaration')) for (const s of n.specifiers) sandbox[s.local.name] = () => new Promise(() => {})
  Object.assign(sandbox, { ref: vue.ref, computed: vue.computed, watch: vue.watch, reactive: vue.reactive, onShow() {}, onHide() {}, onUnload() {}, onShareAppMessage() {} }, stubs)
  vm.createContext(sandbox)
  const scope = vue.effectScope()
  scope.run(() => vm.runInContext(body, sandbox, { filename: rel + ':script-setup' }))
  return { run: code => vm.runInContext(code, sandbox), stop: () => scope.stop(), template: d.template.content, script: source }
}

// ---------------------------------------------------------------- common/activity-form.js

test('时间滚轮：日期 | 时 | 分三列，跨年写年份；选中行 ↔ 值来回换；结束 = 开始 + 3 小时能跨天跨年', () => {
  const { whenColumns, whenIndex, whenPicked, addHours, whenKey, dayText } = FORM
  const w = whenColumns('2026-12-30', 3)
  assert.deepEqual(w.dates, ['2026-12-30', '2026-12-31', '2027-01-01'])
  assert.deepEqual(w.cols[0], ['12月30日 周三', '12月31日 周四', '2027年1月1日 周五'])
  assert.equal(w.cols[1].length, 24)
  assert.deepEqual([w.cols[1][0], w.cols[1][23]], ['00时', '23时'])
  assert.deepEqual([w.cols[2].length, w.cols[2][1], w.cols[2][11]], [12, '05分', '55分'])
  assert.deepEqual(whenIndex({ date: '2026-12-31', time: '14:37' }, w.dates), [1, 14, 7], '分钟不是 5 的倍数往下取')
  assert.deepEqual(whenIndex({ date: '2025-01-01', time: '' }, w.dates), [0, 0, 0], '不在范围里停第一行')
  assert.deepEqual(whenPicked([2, 23, 11], w.dates), { date: '2027-01-01', time: '23:55' })
  assert.deepEqual(whenPicked(null, w.dates), { date: '2026-12-30', time: '00:00' })
  assert.deepEqual(addHours({ date: '2026-12-31', time: '22:30' }, 3), { date: '2027-01-01', time: '01:30' })
  assert.deepEqual(addHours({ date: '', time: '' }, 3), { date: '', time: '' })
  assert.ok(whenKey({ date: '2026-12-31', time: '09:00' }) < whenKey({ date: '2026-12-31', time: '10:00' }))
  assert.equal(dayText('2026-11-04', '2026'), '11月4日 周三')
})

test('费用三选一：收费必须大于 0；AA 预估人均选填；免费不管填了什么都按 0 发', () => {
  const { feeError, feeBody, feeKindOf, yuanText } = FORM
  assert.equal(feeError('paid', ''), '请填写每人费用')
  assert.match(feeError('paid', '0'), /要大于 0/)
  assert.match(feeError('paid', '1.234'), /最多两位小数/)
  assert.match(feeError('paid', '-5'), /要大于 0/)
  assert.equal(feeError('paid', ' 88.5 '), '')
  assert.equal(feeError('aa', '', ''), '')
  assert.equal(feeError('aa', '', '80'), '')
  assert.match(feeError('aa', '', 'abc'), /预估人均/)
  assert.equal(feeError('free', 'abc', 'abc'), '')
  assert.deepEqual(feeBody('paid', ' 88.5 ', '9', '说明'), { feeKind: 'paid', feeYuan: '88.5' })
  assert.deepEqual(feeBody('free', '50', '9', '说明'), { feeKind: 'free', feeYuan: '0' })
  assert.deepEqual(feeBody('aa', '50', ' 80 ', '字'.repeat(50)), { feeKind: 'aa', feeYuan: '0', aaYuan: '80', feeIncludes: '字'.repeat(40) })
  assert.deepEqual(feeBody('aa', '', '', ''), { feeKind: 'aa', feeYuan: '0', aaYuan: '', feeIncludes: '' })
  assert.equal(feeKindOf({ feeKind: 'aa', feeFen: 0 }), 'aa')
  assert.equal(feeKindOf({ feeFen: 8850 }), 'paid', '老接口没 feeKind：按金额算')
  assert.equal(feeKindOf({ feeFen: 0 }), 'free')
  assert.equal(feeKindOf(null), 'free')
  assert.deepEqual([yuanText(8850), yuanText(0), yuanText(null)], ['88.5', '', ''])
})

test('小院页活动行：AA 不当免费（不用免费色），价格照服务端写', () => {
  assert.deepEqual([activityRow({ feeFen: 0, feeKind: 'aa', priceText: '约¥80 AA' }).free, activityRow({ feeFen: 0, feeKind: 'aa', priceText: '约¥80 AA' }).price], [false, '约¥80 AA'])
  assert.deepEqual([activityRow({ feeFen: 0 }).free, activityRow({ feeFen: 0 }).price], [true, '免费'])
  assert.deepEqual([activityRow({ feeFen: 8800, priceText: '¥88' }).free, activityRow({ feeFen: 8800 }).price], [false, '¥88'])
})

// ---------------------------------------------------------------- 活动详情（报名按钮、价格、确认框）

test('活动详情：AA 按钮写「报名（现场AA）」，价格写约¥ / AA制；确认框说清不用付钱；到场付的写「平台不代收」', async (t) => {
  const asks = []
  const h = runSetup('pages/community/activity.vue', {
    useScreen: () => vue.ref(1), ensureSession: async () => {}, experience: { account: {} }, saveCommunityCity() {}, absUrl: x => x,
    confirm: async (title, body) => { asks.push(body); return false }, toast() {},
    uni: { getStorageSync: () => '', setStorageSync() {} },
    ...FORM
  })
  t.after(h.stop)
  const set = (d) => h.run(`detail.value = ${JSON.stringify({ host: { chips: [] }, phase: 'open', title: '海边', timeText: '11月4日', place: '小院', ...d })}`)
  set({ feeKind: 'aa', feeFen: 0, aaFen: 8000, priceText: '约¥80 AA', feeModeLabel: '现场AA' })
  assert.deepEqual([h.run('signupLabel.value'), h.run('priceMain.value'), h.run('priceSub.value')], ['报名（现场AA）', '约¥80', '/人 · 现场AA'])
  assert.match(h.run('feeIncludes.value'), /平摊/)
  await h.run('signup()')
  assert.match(asks.at(-1), /AA制：费用现场由参加的人平摊，预估约 ¥80\/人，报名不用付钱。\nAA 费用现场由参加的人平摊，平台不经手$/)
  assert.equal(h.run('feeNote.value'), FORM.AA_NOTE)
  assert.match(h.template, /<\/view><text v-if="feeNote" class="fee-note">\{\{ feeNote \}\}<\/text><\/view>/, '价格下面一行免责说明')
  set({ feeKind: 'aa', feeFen: 0, aaFen: null, priceText: 'AA制' })
  assert.deepEqual([h.run('priceMain.value'), h.run('priceSub.value')], ['AA制', ' · 现场平摊，报名不用付钱'])
  set({ feeKind: 'aa', full: true })
  assert.equal(h.run('signupLabel.value'), '候补报名', '满了照旧候补')
  set({ feeKind: 'free', feeFen: 0, priceText: '免费' })
  assert.deepEqual([h.run('signupLabel.value'), h.run('priceMain.value'), h.run('priceSub.value')], ['立即报名', '免费', ''])
  set({ feeKind: 'paid', feeFen: 8800, priceText: '¥88', feeMode: 'online', feeModeLabel: '在线支付' })
  assert.equal(h.run('priceSub.value'), '/人 · 在线支付')
  await h.run('signup()')
  assert.equal(asks.at(-1).split('\n').at(-1), '报名费 ¥88/人（在线支付）。')
  assert.equal(h.run('feeNote.value'), '', '小院在线付不带免责说明')
  // 商家活动到场付给门店：照旧「平台不代收」，不带用户活动的免责说明
  set({ feeKind: 'paid', feeFen: 5000, priceText: '¥50', feeMode: 'offline', feeModeLabel: '到场支付', source: 'merchant' })
  await h.run('signup()')
  assert.equal(asks.at(-1).split('\n').at(-1), '报名费 ¥50/人（到场支付，平台不代收）。')
  assert.equal(h.run('feeNote.value'), '')
  // 用户发起的收费活动：价格下面、确认框最后一行都是免责说明
  set({ feeKind: 'paid', feeFen: 5000, priceText: '¥50', feeMode: 'offline', feeModeLabel: '到场付给发起人', source: 'user' })
  assert.equal(h.run('feeNote.value'), '费用由发起人现场收取，平台不代收、不担保；如有纠纷请与发起人协商，也可联系客服协助')
  await h.run('signup()')
  assert.deepEqual(asks.at(-1).split('\n').slice(-2), ['报名费 ¥50/人（到场付给发起人）。', FORM.OFFLINE_NOTE])
  assert.match(h.template, /<text class="signup-price">\{\{ detail\.priceText \}\}<\/text>/)
})

// ---------------------------------------------------------------- 用户发起活动

function mine() {
  const log = { created: [], toasts: [] }
  const h = runSetup('pages/community/activity-mine.vue', {
    useScreen: () => vue.ref(2), ensureSession: async () => {}, experience: { account: { phone: '13800001234' } },
    shiftDate: (d, n) => (n === 1 ? '2026-11-04' : '2026-11-06'), todayCn: () => '2026-11-03', currentCity: () => '大理', communityCity: () => '大理',
    toast: m => log.toasts.push(m), absUrl: x => x, gated: fn => fn(), fail: (e) => { throw e }, go() {},
    apiCommunityStatus: async () => ({ data: { phoneVerified: true } }), apiCommunityConsent: async () => ({}),
    apiCreateActivity: async (p) => { log.created.push(plain(p)); return { data: { activityId: 9, status: 'open' } } },
    apiManageActivity: async () => ({ data: {} }),
    apiActivitySyncCommunity: async () => ({ msg: '已同步到社区' }),
    uni: { getStorageSync: () => '', setStorageSync() {}, removeStorageSync() {} },
    ...FORM
  })
  return { ...h, log }
}

test('用户发起活动：费用三选一（免费 / 收费 / AA制），收费只标价、到场付给发起人；发出去带 feeKind', { timeout: 5000 }, async (t) => {
  const h = mine()
  t.after(h.stop)
  assert.deepEqual(plain(h.run('FEE_KINDS')), [['free', '免费'], ['paid', '收费'], ['aa', 'AA制']], '和员工端一样的顺序')
  assert.deepEqual(plain(runSetup('pages/staff/activities.vue', { useScreen: () => vue.ref(1), shiftDate: () => '2026-11-04', todayCn: () => '2026-11-01', lockPageScroll() {}, currentStaffStore: { value: null }, merchantStaff: { value: false }, uni: { getStorageSync: () => '' }, ...FORM }).run('FEE_KINDS')), [['free', '免费'], ['paid', '收费'], ['aa', 'AA制']])
  assert.match(h.template, /placeholder="每人费用（必填），例如 50" placeholder-class="placeholder" \/><text>元\/人<\/text><\/view><text class="field-tip">\{\{ OFFLINE_NOTE \}\}<\/text><\/view>/, '收费金额下面一行免责说明')
  assert.equal(h.run('feeKind.value'), 'free', '默认免费')
  assert.equal(h.run('feeText.value'), '免费')
  assert.match(h.template, /<view class="fee-seg"><view v-for="k in FEE_KINDS"/)
  assert.doesNotMatch(h.template, /用户活动免费参与/)
  h.run("feeKind.value = 'paid'")
  assert.equal(h.run('feeTip.value'), '到场付给你，平台不代收')
  assert.equal(h.run("feeKind.value = 'aa'; feeTip.value"), '现场平摊，平台不经手')
  h.run("feeKind.value = 'paid'")
  h.run("activityTitle.value = '爬山'; cover.value = '/c.jpg'; place.value = '苍山'; people.value = 10; fee.value = ''")
  h.run('toConfirm()')
  assert.equal(h.log.toasts.at(-1), '请填写每人费用')
  h.run("fee.value = '50'")
  assert.equal(h.run('feeText.value'), '¥50/人（到场付给发起人）')
  h.run("feeKind.value = 'aa'; aaFee.value = '80'")
  assert.equal(h.run('feeText.value'), 'AA制，约 ¥80/人')
  h.run("aaFee.value = ''")
  assert.equal(h.run('feeText.value'), 'AA制（现场平摊）')
  // 发布：AA 带 feeKind、预估人均；收费带金额
  h.run("agreed.value = true; status.value = { phoneVerified: true }; aaFee.value = '80'")
  await h.run('publish()')
  await flush()
  assert.deepEqual(['feeKind', 'feeYuan', 'aaYuan', 'category'].map(k => h.log.created[0][k]), ['aa', '0', '80', '其他'])
  assert.equal('fee' in h.log.created[0], false, '不再写死 fee: 0')
  h.run("feeKind.value = 'paid'; fee.value = '50'")
  await h.run('publish()')
  await flush()
  assert.deepEqual(['feeKind', 'feeYuan', 'aaYuan'].map(k => h.log.created[1][k]), ['paid', '50', undefined])
})

test('用户发起活动：日期和时刻一个滚轮选（明天起 30 天），显示「11月4日 周三 14:00」；集合地点一行点了开地图', (t) => {
  const h = mine()
  t.after(h.stop)
  const dates = plain(h.run('when.value.dates'))
  assert.deepEqual([dates.length, dates[0]], [30, '2026-11-04'])
  h.run('setWhen({ detail: { value: [0, 14, 0] } })')
  assert.deepEqual([h.run('date.value'), h.run('time.value'), h.run('dateText.value')], ['2026-11-04', '14:00', '11月4日 周三'])
  assert.match(h.template, /<picker mode="multiSelector" :range="when\.cols" :value="whenIndex\(\{ date, time \}, when\.dates\)" @change="setWhen">/)
  assert.doesNotMatch(h.template, /k-date-picker|@click="pickDate"|@click="pickTime"|@click="pickMeetPoint"/)
  assert.match(h.template, /<view class="form-input" @click="pickPlace">/)
  assert.match(h.template, /横图、竖图都可以/)
  assert.doesNotMatch(h.template, /建议尺寸 16:9/)
})
