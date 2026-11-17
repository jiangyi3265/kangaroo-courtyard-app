// 2026-11-03 主人「简化」C-activities 组（node --test，不需要构建、不发请求）：员工 / 商家端活动页 pages/staff/activities.vue
//   M9 列表：去掉「筛选」按钮（和三个下拉是同一件事）；商家只留 4 个页签、不出「来源」等下拉；员工留 来源 / 状态 / 排序 三个下拉
//   M5 提交前：底部操作条上面一行一直写着还差什么 / 可以提交（同 jobs.vue），点了标红并滚到第一项；提交不弹「确认提交？」
//   M8 详情：待审核 / 被驳回只给 状态 + 驳回原因 + 「修改活动」「联系客服」；6 格、异常天气、取消流程、暂停 / 结束只在审核通过后出现
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
const FORM = await import(pathToFileURL(path.join(APP, 'common/activity-form.js')).href)
const src = (rel) => fs.readFileSync(path.join(APP, rel), 'utf8').replace(/\r\n/g, '\n')
const plain = (v) => JSON.parse(JSON.stringify(v))
const flush = () => new Promise(resolve => setImmediate(resolve))
const between = (s, a, b) => { const i = s.indexOf(a), j = s.indexOf(b, i + a.length); assert.ok(i >= 0 && j > i, `找不到 ${a} … ${b}`); return s.slice(i, j) }

/** 在沙箱里跑页面的 script setup：导入一律先给永远不返回的函数，再用 stubs 覆盖用得到的那几个（同 other-forms-20261031.test.mjs） */
function runSetup(rel, stubs) {
  const d = compiler.parse(src(rel), { filename: rel }).descriptor
  const source = d.scriptSetup.content
  const ast = compiler.babelParse(source, { sourceType: 'module' })
  const body = ast.program.body.filter(n => n.type !== 'ImportDeclaration').map(n => source.slice(n.start, n.end)).join('\n')
  const sandbox = { console, setTimeout, clearTimeout, setInterval: () => 0, clearInterval() {} }
  for (const n of ast.program.body.filter(n => n.type === 'ImportDeclaration')) for (const s of n.specifiers) sandbox[s.local.name] = () => new Promise(() => {})
  Object.assign(sandbox, { ref: vue.ref, computed: vue.computed, watch: vue.watch, reactive: vue.reactive, onShow() {}, onHide() {}, onUnload() {}, onUnmounted() {} }, stubs)
  vm.createContext(sandbox)
  const scope = vue.effectScope()
  scope.run(() => vm.runInContext(body, sandbox, { filename: rel + ':script-setup' }))
  return { run: code => vm.runInContext(code, sandbox), stop: () => scope.stop(), template: d.template.content, script: source, styles: d.styles.map(x => x.content).join('\n') }
}

const PAGE = 'pages/staff/activities.vue'
function activities(stubs = {}) {
  const log = { created: [], edited: [], toasts: [], scrolls: [], confirms: [], gone: [] }
  const s = vue.ref(1)
  const merchant = vue.ref(false)
  const h = runSetup(PAGE, {
    useScreen: () => s, ensureSession: async () => {}, hasStaffAccess: { value: true }, currentStaffStoreId: () => 102,
    currentStaffStore: { value: { storeId: 102, storeName: '平潭袋鼠小院', roleCode: 'keeper' } }, merchantStaff: merchant,
    experience: { account: { id: 7 } }, fabSessionFrom: (id) => String(id) + '|support-fab', R: { support: '/pages/notice/support', staffReviews: '/pages/staff/reviews' },
    shiftDate: () => '2026-11-04', todayCn: () => '2026-11-01', staffCan: () => true, toast: m => log.toasts.push(m), back() {}, go: u => log.gone.push(u), errText: (e, d) => d, absUrl: x => x, pad2: x => String(x).padStart(2, '0'),
    confirm: async (t, m) => { log.confirms.push([t, m]); return true }, modal: async () => ({ confirm: true }),
    scrollToField: x => log.scrolls.push(x), lockPageScroll() {},
    apiStaffCreateActivity: async (storeId, p) => { log.created.push([storeId, plain(p)]); return { data: { activityId: 77, status: 'pending', message: '已提交' } } },
    apiStaffEditActivity: async (id, p) => { log.edited.push([id, plain(p)]); return { data: { activityId: id, message: '已保存' } } },
    apiStaffActivities: async () => ({ data: { rows: [], counts: {} } }),
    uni: { getSystemInfoSync: () => ({ windowWidth: 375 }), getStorageSync: () => '', setStorageSync() {}, removeStorageSync() {} },
    ...FORM, ...stubs
  })
  return { ...h, log, s, merchant }
}

// ---------------------------------------------------------------- M9 列表

test('M9 列表：「筛选」按钮没了；员工留 来源 / 状态 / 排序 三个下拉；商家只有 4 个页签、不画下拉那一行', () => {
  const h = activities()
  const list = between(h.template, '<!-- 1 活动列表 -->', '<!-- 2 创建活动')
  assert.doesNotMatch(list, /filter-btn|filterMenu|<text>筛选<\/text>/, '筛选按钮和三个下拉是同一件事，去掉')
  assert.doesNotMatch(h.script, /async function filterMenu|按来源', '按状态', '排序方式', '清除筛选/)
  assert.doesNotMatch(h.styles, /\.filter-btn/)
  assert.match(list, /<view v-if="pills\.length" class="pills">/, '商家没有下拉时整行不画')
  assert.match(list, /<view class="tabs">\s*<view v-for="t in listTabs"/, '4 个页签还在')
  assert.deepEqual(plain(h.run('TABS.map(t => t[0])')), ['全部', '报名中', '进行中', '已结束'])
  // 搜索框还在（搜索不是筛选的重复）
  assert.match(list, /<input v-model="kw" confirm-type="search"/)
  assert.deepEqual(plain(h.run('pills.value')), ['全部来源', '全部状态', '时间排序'], '员工：三个下拉')
  h.merchant.value = true
  assert.deepEqual(plain(h.run('pills.value')), [], '商家：没有「来源」可选、状态就是页签，所以一个下拉都不出')
  h.merchant.value = false
  h.run('tabIdx.value = 1; pf.value.sort = 2')
  assert.deepEqual(plain(h.run('pills.value')), ['全部来源', '报名中', '报名人数'], '状态下拉跟着页签走、排序照旧')
  h.stop()
})

// ---------------------------------------------------------------- M5 提交前「还差什么」

test('M5 创建活动：操作条上面一行一直写着还差什么；点了标红、滚到第一项；都填好了写可以提交，提交不弹「确认提交？」', async () => {
  const h = activities()
  const block = between(h.template, '<template v-else-if="s === 2">', '<!-- 3 报名数据 -->')
  // 这一行在按钮上面、能点、有 hover-class；原来的按钮块一字没动（other-forms 测试守着）
  assert.match(block, /<view class="fc-bar"><view class="fc-bar__todo" :class="\{ 'fc-bar__todo--err': tried && todoKeys\.length, 'fc-bar__todo--ok': !todoKeys\.length \}" hover-class="k-press" @click="showTodo"><text>\{\{ todoText \}\}<\/text><\/view><view class="fc-bar__btns"><fc-kefu \/>/)
  assert.match(h.styles, /\.fc-bar__todo \{[^}]*min-height: 44px/, '能点的不低于 44')
  assert.match(h.styles, /\.fc-form \{ padding-bottom: calc\(128px \+ var\(--k-safe-bottom\)\); \}/, '多了一行，表单底部多留一点')
  // 滚动目标都在模板里
  for (const id of ['af-title', 'af-place', 'af-intro', 'af-fee', 'af-when']) assert.match(block, new RegExp(`id="${id}"`), id)

  await h.run('newActivity()')
  await flush()
  assert.equal(h.run('place.value'), '平潭袋鼠小院', '地点默认带门店名')
  assert.equal(h.run('todoText.value'), '还差：活动标题（点这里去填）')
  assert.equal(h.run('tried.value'), false, '没点之前不标红')
  h.run('showTodo()')
  assert.equal(h.run('tried.value'), true)
  assert.deepEqual(h.log.scrolls, ['#af-title'], '点了「还差」滚到第一项')
  assert.equal(h.run('aerr.value.title'), '请填写活动标题', '标红')

  h.run("title.value = '海边徒步'; place.value = ''; feeKind.value = 'paid'; fee.value = ''; intro.value = 'x'.repeat(1001)")
  assert.equal(h.run('todoText.value'), '还差：活动地点、活动介绍（太长了）、费用（点这里去填）')
  h.run("place.value = '平潭海边'; fee.value = '88'; intro.value = '14:00 集合'; end.value = { date: start.value.date, time: start.value.time }")
  assert.equal(h.run('todoText.value'), '还差：结束时间（点这里去填）')
  h.run('showTodo()')
  assert.equal(h.log.scrolls.at(-1), '#af-when')
  h.run("end.value = { date: start.value.date, time: '17:00' }")
  assert.equal(h.run('todoText.value'), '必填的都填好了，可以提交')
  assert.deepEqual(plain(h.run('todoKeys.value')), [])

  // 提交：没有「确认提交？」弹窗，直接保存（confirm 只在修改时报名截止冲突才会问）
  await h.run('submit()')
  await flush()
  assert.deepEqual(h.log.confirms, [], '提交发布不多问一次')
  assert.equal(h.log.created.length, 1)
  assert.equal(h.log.created[0][1].title, '海边徒步')
  assert.equal(String(h.log.created[0][1].feeYuan), '88')
  assert.equal(h.s.value, 4, '保存后进详情')
  assert.doesNotMatch(h.script, /confirm\([^)]*(提交|发布)/, '代码里没有「确认提交？」这类弹窗（注释里提到不算）')
  h.stop()
})

test('M5 空表提交：还是就地标红 + 滚到第一项，不发请求', async () => {
  const h = activities()
  await h.run('newActivity()')
  await flush()
  await h.run('submit()')
  assert.deepEqual(h.log.created, [])
  assert.deepEqual(h.log.scrolls, ['#af-title'])
  assert.equal(h.run('tried.value'), true)
  h.stop()
})

// ---------------------------------------------------------------- M8 审核中的详情

test('M8 详情模板：待审核 / 被驳回只留 状态 + 驳回原因 + 修改活动 + 联系客服；6 格、异常天气、取消流程、暂停 / 结束包在审核通过那一支里', () => {
  const h = activities()
  const detail = h.template.slice(h.template.indexOf('<!-- 4 活动详情 -->'))
  const review = between(detail, '<template v-if="underReview">', '<template v-else>')
  const passed = detail.slice(detail.indexOf('<template v-else>'))
  // 头部（封面、状态标签、标题、时间、地点、发起人）在分支外面，两种情况都有；驳回原因块也在外面、条件没动
  const head = detail.slice(0, detail.indexOf('<template v-if="underReview">'))
  assert.match(head, /\{\{ d\.phaseLabel \|\| d\.statusLabel \}\}/)
  assert.match(head, /v-if="d\.status === 'rejected' && d\.auditReason"/)
  assert.match(head, /\{\{ d\.auditReason \}\}/)
  assert.match(head, /请点下面的「修改活动」改好后再提交/)
  // 审核中：两个大按钮，修改活动打开修改表，联系客服小程序用 open-type="contact"、网页版进客服中心
  assert.match(review, /<view class="rv-btn" hover-class="k-press-s" @click="editActivity">[\s\S]*<text>修改活动<\/text>/)
  assert.match(review, /<!-- #ifdef MP-WEIXIN -->\s*<button class="rv-btn rv-btn--ghost" open-type="contact" :session-from="kefuFrom" hover-class="k-press-s" aria-label="联系人工客服">[\s\S]*<text>联系客服<\/text><\/button>\s*<!-- #endif -->/)
  assert.match(review, /<!-- #ifndef MP-WEIXIN -->\s*<view class="rv-btn rv-btn--ghost" hover-class="k-press-s" @click="contactSupport">[\s\S]*<text>联系客服<\/text><\/view>\s*<!-- #endif -->/)
  assert.match(review, /\{\{ reviewTip \}\}/)
  for (const no of ['dStats', 'actions', 'weatherFlow', '异常天气处理', '取消活动流程', 'togglePause', 'endActivity', 'k-bottom']) assert.ok(!review.includes(no), '审核中不出现：' + no)
  // 审核通过那一支：原来的东西一样不少
  for (const yes of ['v-for="(st, i) in dStats"', 'v-for="(g, i) in actions"', '@click="weatherFlow"', '异常天气处理', '取消活动流程', '@click="togglePause"', '@click="endActivity"', '<k-bottom flat>']) assert.ok(passed.includes(yes), '审核通过后还有：' + yes)
  assert.match(h.styles, /\.rv-btn \{[^}]*height: 52px/, '大按钮')
  assert.match(h.styles, /\.rv-btn::after \{ border: 0; \}/, '小程序 button 自带的边去掉')
  h.stop()
})

test('M8 详情逻辑：pending / rejected 算审核中，open / paused / ended 不算；提示文案分商家、员工；联系客服网页版去客服中心', () => {
  const h = activities()
  for (const [st, expect] of [['pending', true], ['rejected', true], ['open', false], ['paused', false], ['closed', false], ['ended', false], ['cancelled', false], [undefined, false]]) {
    h.run(`d.value = { activityId: 31, status: ${JSON.stringify(st)} }`)
    assert.equal(h.run('underReview.value'), expect, String(st))
  }
  h.run("d.value = { activityId: 31, status: 'pending' }")
  assert.equal(h.run('reviewTip.value'), '活动正在等平台审核，通过后这里会出现成员、签到、通知等管理功能。')
  h.merchant.value = true
  assert.equal(h.run('reviewTip.value'), '活动正在审核中，通过后这里会出现成员、签到、通知等管理功能。', '商家的活动不一定是平台审，不写「平台」')
  h.run("d.value = { activityId: 31, status: 'rejected', auditReason: '标题太长' }")
  assert.equal(h.run('reviewTip.value'), '改好后重新提交，会再次进入审核。', '驳回原因上面已经有，不重复')
  h.run("d.value = { activityId: 31, status: 'rejected' }")
  assert.match(h.run('reviewTip.value'), /被驳回了，请点「修改活动」/)
  assert.equal(h.run('kefuFrom.value'), '7|support-fab', '微信客服会话的 session-from 和客服方块同一格式')
  h.run('contactSupport()')
  assert.deepEqual(h.log.gone, ['/pages/notice/support'])
  // 被驳回时「修改活动」还是原来那张修改表
  h.run("d.value = { activityId: 31, status: 'rejected', title: '海边徒步', startTime: '2026-11-08 09:00:00', endTime: '2026-11-08 12:00:00', capacity: 20, feeFen: 0 }")
  h.run('editActivity()')
  assert.equal(h.run('editId.value'), 31)
  assert.equal(h.s.value, 2)
  h.stop()
})

// ---------------------------------------------------------------- 文件本身

test('换行、BOM 没动：activities.vue 还是 CRLF 无 BOM；service-activities.vue 还是 LF 无 BOM', () => {
  const a = fs.readFileSync(path.join(APP, PAGE))
  assert.ok(!a.subarray(0, 3).equals(Buffer.from([0xef, 0xbb, 0xbf])), 'BOM')
  const crlf = a.toString('latin1').split('\r\n').length - 1, lf = a.toString('latin1').split('\n').length - 1
  assert.equal(lf, crlf, 'activities.vue 全部 CRLF')
  assert.ok(!a.includes('\r\r'))
  const b = fs.readFileSync(path.join(APP, 'pages/staff/service-activities.vue'))
  assert.ok(!b.includes('\r'), 'service-activities.vue 全部 LF')
})
