// 2026-11-03 主人：简化（D-staff-misc 组：主理人与服务人的几处小改）的回归（node --test，不构建、不发请求）。守住这几件事：
//   · M11 评价回复草稿：页面内文本框（500 字、带计数），没有「AI 优化」按钮，也不再弹系统输入框；
//   · K6 面试详情：没有「会议信息与操作」菜单，电话联系 / 标记结束 / 双向确认 / 改期各一个按钮；评分是页面内点星 + 评语框 + 保存；
//   · K9 面试日程：点日期直接出日历（默认选中正在看的那天），‹ › 箭头翻天（按周翻周），不再先弹「昨天 / 今天 / 明天…」菜单；
//   · K7 业务页：人员管理拆成「员工与权限」「人才库」，下周任务拆成「查看任务」「发布任务」，换工主理人专区拆成「看板 / 钱包 / 荣誉」三格，点格子不弹菜单；
//   · K8 工作台「订单管理」去旅居订单台；二消那页叫「二消订单」；
//   · S1 商家需求：待接手的线上任务底栏多「接手并上架」一键（先接手再上架，第二步失败提示再点一次上架），单独「接手」还在。
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
const sfc = (rel) => compiler.parse(src(rel), { filename: rel }).descriptor
const load = (rel) => import(pathToFileURL(path.join(APP, rel)).href)
const v = await load('pages/staff/request-view.js')
const { useRequestList } = await load('pages/staff/request-list.js')
const plain = (x) => (x === undefined ? undefined : JSON.parse(JSON.stringify(x)))
const flush = async () => { for (let i = 0; i < 8; i++) await new Promise(resolve => setImmediate(resolve)) }

/** 在沙箱里跑页面的 script setup：导入一律先给永远不返回的函数，再用 stubs 覆盖用得到的那几个（与 luna-staff 测试同一套） */
function runSetup(rel, stubs) {
  const d = sfc(rel)
  const source = d.scriptSetup.content
  const ast = compiler.babelParse(source, { sourceType: 'module' })
  const body = ast.program.body.filter(n => n.type !== 'ImportDeclaration').map(n => source.slice(n.start, n.end)).join('\n')
  const sandbox = { console, setTimeout, clearTimeout, setInterval, clearInterval, Date, JSON, Math, Number, String, Promise }
  for (const n of ast.program.body.filter(n => n.type === 'ImportDeclaration')) for (const s of n.specifiers) sandbox[s.local.name] = () => new Promise(() => {})
  Object.assign(sandbox, { ref: vue.ref, computed: vue.computed, watch: vue.watch, reactive: vue.reactive, onShow() {}, onHide() {}, onUnload() {}, onUnmounted() {}, onLoad() {}, onReachBottom() {}, onPullDownRefresh() {}, onMounted() {}, onBeforeUnmount() {}, getCurrentPages: () => [{}] }, stubs)
  vm.createContext(sandbox)
  const scope = vue.effectScope()
  scope.run(() => vm.runInContext(body, sandbox, { filename: rel + ':script-setup' }))
  return { run: code => vm.runInContext(code, sandbox), json: code => plain(vm.runInContext(code, sandbox)), stop: () => scope.stop(), template: d.template.content, script: source, sandbox }
}
const R = {
  weekly: '/pages/manage/weekly', tasks: '/pages/manage/tasks', daily: '/pages/manage/daily', dashboard: '/pages/manage/dashboard', wallet: '/pages/manage/wallet', honor: '/pages/manage/honor',
  staffApplications: '/pages/staff/applications', staff: '/pages/staff/index', messages: '/pages/messages/index', profile: '/pages/profile/index', staffTalents: '/pages/staff/talents',
  staffOnline: '/pages/staff/online-jobs', staffJobs: '/pages/staff/jobs', staffInsurance: '/pages/staff/insurance', staffRooms: '/pages/staff/rooms', staffDispatch: '/pages/staff/dispatch',
  staffActivities: '/pages/staff/activities', staffReviews: '/pages/staff/reviews', staffStayOrders: '/pages/staff/stay-orders'
}
const storeUrl = (u, id = 102) => u + (u.includes('?') ? '&' : '?') + 'storeId=' + id
/** 去掉注释（// 行和 <!-- -->），只看真正生效的代码和模板：改动说明里会提到旧名字 */
const code = (text) => text.replace(/<!--[\s\S]*?-->/g, '').split('\n').filter(line => !/^\s*\/\//.test(line)).join('\n')

test('五个页面的模板都能编译', () => {
  for (const rel of ['pages/staff/reviews.vue', 'pages/staff/interviews.vue', 'pages/staff/business.vue', 'pages/staff/index.vue', 'pages/staff/service.vue']) {
    const { errors, descriptor } = compiler.parse(src(rel), { filename: rel })
    assert.deepEqual(errors, [], rel)
    const out = compiler.compileTemplate({ source: descriptor.template.content, filename: rel, id: 'x' })
    assert.deepEqual(out.errors, [], rel)
  }
})

// ---------------------------------------------------------------- M11 评价回复草稿
test('M11 回复草稿：页面内文本框（500 字带计数），没有 AI 优化、不弹系统输入框', async (t) => {
  const text = code(src('pages/staff/reviews.vue'))
  assert.match(text, /<textarea v-model="draft" class="reply-area" :maxlength="500"/)
  assert.match(text, /<text class="reply-count">\{\{ draft\.length \}\}\/500<\/text>/)
  assert.doesNotMatch(text, /aiPolish|AI优化|editDraft|需要配置模型服务/)
  assert.match(text, /@click="pickPhrase"/, '插入快捷语还在')

  const log = { toasts: [], sheets: [] }
  const h = runSetup('pages/staff/reviews.vue', {
    useScreen: () => vue.ref(3), toast: m => log.toasts.push(m), errText: (e, d) => (e && e.message) || d,
    apiStaffReviewDraft: async (id, tone, seed) => ({ data: { text: `草稿-${tone}-${seed}`, basis: ['依据'] } }),
    sheet: async (list) => { log.sheets.push(plain(list)); return 0 }
  })
  t.after(h.stop)
  h.run('d.value = { reviewId: 9 }')
  const p = h.run('loadDraft()')
  assert.equal(h.run('drafting.value'), true, '生成中占位')
  await p
  assert.equal(h.run('drafting.value'), false)
  assert.equal(h.run('draft.value'), '草稿-温和-0')
  await h.run('pickPhrase()')
  assert.equal(h.run('draft.value'), '草稿-温和-0\n欢迎下次再来～')
  // 文本框直接改：超长在 maxlength 处截断，这里守住发布前的 trim 和空判断
  h.run("draft.value = '   '")
  await h.run('publishReply()')
  assert.deepEqual(log.toasts.at(-1), '回复内容不能为空')
})

// ---------------------------------------------------------------- K6 / K9 面试
function interviews({ detail } = {}) {
  const log = { toasts: [], sheets: [], lists: [], rated: [], finished: 0, calls: [], modals: [] }
  const s = vue.ref(1)
  const h = runSetup('pages/staff/interviews.vue', {
    useScreen: () => s, ensureSession: async () => {}, hasStaffAccess: { value: true }, staffCan: () => true,
    staffStores: vue.ref([{ storeId: '101', roleCode: 'manager', active: true, storeName: 'A 店' }]), currentStaffStoreId: () => '101',
    experience: vue.reactive({ account: { id: 'owner' }, mode: 'staff' }), getToken: () => 't', getSessionRevision: () => 0, todayCn: () => '2026-11-03',
    parseTencentMeeting: () => null, toast: m => log.toasts.push(m), sheet: async (list) => { log.sheets.push(plain(list)); return -1 }, go() {}, back() {},
    apiStaffInterviews: async (p) => { log.lists.push(plain(p)); return { data: { date: '2026-11-03', title: '11月3日 周二', rows: [], summary: {} } } },
    apiStaffInterviewDetail: async (id) => ({ data: { interviewId: id, slots: [], ...(detail || {}) } }),
    apiStaffRateInterview: async (id, rating, note) => { log.rated.push([id, rating, note]); return {} },
    apiStaffFinishInterview: async () => { log.finished++; return { msg: '已标记面试结束' } },
    uni: {
      showModal: (o) => { log.modals.push(o.title); o.success({ confirm: true }) },
      makePhoneCall: (o) => log.calls.push(o.phoneNumber)
    }
  })
  return { ...h, s, log }
}

test('K6 模板：没有「会议信息与操作」菜单，四个操作各一个按钮；评分是页面内点星 + 评语输入框 + 保存', () => {
  const text = code(src('pages/staff/interviews.vue'))
  const h = interviews()
  h.stop()
  assert.doesNotMatch(text, /会议信息与操作|joinVideo|pickRating|查看双向确认|电话联系候选人|标记面试已结束'/)
  for (const label of ['电话联系', '标记结束', '双向确认', '改期']) assert.match(h.template, new RegExp(`<button class="op-btn[^"]*"[^>]*>(?:(?!</button>).)*<text>${label}</text></button>`), label)
  assert.match(h.template, /<button class="op-btn primary" @click="s=3">/, '双向确认直接进第 3 屏')
  assert.match(h.template, /<button v-for="n in 5" :key="n" class="star-btn" :aria-label="n \+ ' 星'" :disabled="!d\.canRate" @click="pickStar\(n\)">/)
  assert.match(h.template, /<input v-model="rateNote" :disabled="rateSaving" maxlength="200"/)
  assert.match(h.template, /:label="rateSaving \? '正在保存…' : '保存评价'" @click="saveRating"/)
  // meeting.test 钉着：面试详情不用原生 textarea（会盖住底部导航）
  assert.doesNotMatch(text, /<textarea/)
  // 大按钮：操作 46px、星星 44px 触摸区
  assert.match(text, /\.op-btn\{height:46px/)
  assert.match(text, /\.star-btn\{width:44px;height:44px/)
})

test('K6 评分：打开详情带入已评的星和评语；点星改分、评语框改字、保存一次写入', async (t) => {
  const h = interviews({ detail: { rating: 3, staffNote: '还行', canRate: true } })
  t.after(h.stop)
  await h.run('loadDetail(5)')
  assert.equal(h.run('rateStars.value'), 3)
  assert.equal(h.run('rateNote.value'), '还行')
  h.run('pickStar(5)')
  h.run("rateNote.value = ' 沟通顺畅 '")
  await h.run('saveRating()')
  assert.deepEqual(h.log.rated, [[5, 5, '沟通顺畅']])
  assert.equal(h.run('d.value.rating'), 5)
  assert.equal(h.run('ratingHint.value'), '已评 5 星：沟通顺畅（改好后再点保存）')
  assert.deepEqual(h.log.toasts, ['评价已保存'])
  assert.deepEqual(h.log.sheets, [], '全程没弹菜单')
  assert.deepEqual(h.log.modals, [], '也没弹系统输入框')
})

test('K6 评分：没有权限时点星不动、保存不发请求；没打分先提示', async (t) => {
  const h = interviews({ detail: { canRate: false } })
  t.after(h.stop)
  await h.run('loadDetail(5)')
  h.run('pickStar(4)')
  assert.equal(h.run('rateStars.value'), 0)
  await h.run('saveRating()')
  assert.deepEqual(h.log.rated, [])
  assert.equal(h.log.toasts.at(-1), '当前无评价权限或面试状态不允许')
  h.run('d.value = { ...d.value, canRate: true }')
  await h.run('saveRating()')
  assert.equal(h.log.toasts.at(-1), '请先点星星打分')
  assert.deepEqual(h.log.rated, [])
})

test('K6 标记结束 / 电话联系：按钮直接动，脱敏号码不能拨', async (t) => {
  const h = interviews({ detail: { canFinish: true } })
  t.after(h.stop)
  await h.run('loadDetail(5)')
  await h.run('finishInterview()')
  await flush()
  assert.equal(h.log.finished, 1)
  assert.deepEqual(h.log.modals, ['结束面试'], '只剩一道确认')
  assert.equal(h.s.value, 3, '结束后进双向确认')
  assert.equal(h.log.toasts.at(-1), '已标记面试结束')

  h.run("d.value = { interviewId: 5, canFinish: false, phone: '13800000001', contactMasked: true }")
  await h.run('finishInterview()')
  assert.equal(h.log.finished, 1)
  assert.equal(h.log.toasts.at(-1), '面试进行完毕后才能标记结束')
  assert.equal(h.run('canCall.value'), false)
  h.run('callCandidate()')
  assert.deepEqual(h.log.calls, [])
  assert.match(h.run('opHint.value'), /号码已脱敏/)
  h.run('d.value = { ...d.value, contactMasked: false }')
  assert.equal(h.run('canCall.value'), true)
  h.run('callCandidate()')
  assert.deepEqual(h.log.calls, ['13800000001'])
})

test('K9 选日期：点日期直接出日历（默认今天），箭头翻天；按周看一次翻 7 天', async (t) => {
  const text = code(src('pages/staff/interviews.vue'))
  assert.doesNotMatch(text, /选择其他日期|'昨天', '今天', '明天', '后天'/)
  assert.match(text, /<button class="date-arrow" aria-label="前一天" @click="moveDay\(-1\)">/)
  assert.match(text, /<button class="date-arrow" aria-label="后一天" @click="moveDay\(1\)">/)
  assert.match(text, /<button class="date-pill" @click="pickDay">/)
  assert.match(text, /\.date-arrow\{width:44px;height:44px/)
  const h = interviews()
  t.after(h.stop)
  await h.run('loadSchedule()')
  assert.equal(h.run('serverToday.value'), '2026-11-03')
  h.run('pickDay()')
  assert.equal(h.run('dayCalendar.value'), true)
  assert.equal(h.run('dayCalendarValue.value'), '2026-11-03', '日历默认选中今天')
  assert.deepEqual(h.log.sheets, [], '没有先弹菜单')
  h.run('dayCalendar.value = false')
  // moveDay / toggleWeek / confirmDay 都不等取数（和原来 pickDay 一样），这里 flush 一下再看发出去的参数
  const step = async (c) => { h.run(c); await flush() }
  await step('moveDay(1)')
  assert.equal(h.run('dayPill.value'), '明天')
  assert.equal(h.log.lists.at(-1).date, '2026-11-04')
  await step('moveDay(-2)')
  assert.equal(h.run('dayPill.value'), '昨天')
  assert.equal(h.log.lists.at(-1).date, '2026-11-02')
  await step("confirmDay('2026-11-10')")
  assert.equal(h.run('dayOffset.value'), 7)
  assert.equal(h.run('dayPill.value'), '11月10日')
  h.run('pickDay()')
  assert.equal(h.run('dayCalendarValue.value'), '2026-11-10', '再点日历时选中正在看的那天')
  h.run('dayCalendar.value = false')
  await step('toggleWeek()')
  assert.equal(h.run('dayPill.value'), '下周')
  await step('moveDay(-1)')
  assert.equal(h.run('dayOffset.value'), 0)
  assert.equal(h.run('dayPill.value'), '本周')
  await step('moveDay(-1)')
  assert.equal(h.run('dayPill.value'), '上周')
  assert.deepEqual(h.log.lists.at(-1), { storeId: '101', range: 'week', date: '2026-10-27' })
})

// ---------------------------------------------------------------- K7 业务页
const ROLES = {
  keeper: { role: 'keeper', roleName: '小院主理人', perms: { online: ['view', 'edit', 'audit'], jobs: ['view', 'edit', 'audit'], activities: ['view', 'edit', 'audit'], dashboard: ['view'] } },
  service: { role: 'merchant_service', roleName: '商家服务人', perms: { online: ['view', 'edit', 'audit'], intake: ['view', 'edit'] } },
  manager: { role: 'manager', roleName: '换工主理人', perms: { intake: ['view', 'edit', 'audit'], jobs: ['view', 'edit', 'audit'], activities: ['view', 'edit', 'audit'], dashboard: ['view'] } },
  staff: { role: 'staff', roleName: '员工', perms: { jobs: ['view'], activities: ['view'] } }
}
function business(who, hub = {}) {
  const r = ROLES[who], log = { gone: [], sheets: [], toasts: [] }
  const s = vue.ref(1)
  const h = runSetup('pages/staff/business.vue', {
    ...v, R, useScreen: () => s, onlineStaff: { value: false }, merchantStaff: { value: false }, merchantService: { value: who === 'service' }, cityLead: { value: false }, cityLeadFull: { value: false },
    staffCan: (item, action) => (r.perms[item] || []).includes(action), currentStaffStore: { value: { roleCode: r.role, storeId: 102, roleName: r.roleName } }, currentStaffStoreId: () => 102, currentAlsoService: { value: false },
    staffStoreUrl: storeUrl, go: (u) => log.gone.push(u), relaunch: (u) => log.gone.push(u), getSessionRevision: () => 1, ensureSession: async () => {}, hasStaffAccess: { value: true }, absUrl: x => x,
    apiStaffHub: async () => ({ data: { storeId: 102, role: r.role, roleName: r.roleName, ...hub } }),
    sheet: async (list) => { log.sheets.push(plain(list)); return -1 }, errText: (e, d) => d, toast: m => log.toasts.push(m)
  })
  h.run(`hub.value = ${JSON.stringify({ storeId: 102, role: r.role, roleName: r.roleName, ...hub })}`)
  return { ...h, s, log }
}

test('K7 业务页：三个菜单都拆成格子，点了直接进，全程不弹菜单', async (t) => {
  const b = business('manager', { isManager: true })
  t.after(b.stop)
  assert.doesNotMatch(b.script, /label: '(人员管理|下周任务|二消管理)'/)
  assert.doesNotMatch(b.template, /人员管理|下周任务|二消管理|换工主理人中心/)
  assert.deepEqual(b.json('frequent.value.map(e => e.label)'), ['纠纷调解', '岗位管理', '调度管理', '活动管理', '评价管理', '保险管理', '员工与权限', '人才库'])
  assert.deepEqual(b.json('daily.value.map(e => e.label)'), ['招募周报', '查看任务', '发布任务', '日报管理', '数据看板'])
  assert.deepEqual(b.json('ownerEntries.map(e => e.label)'), ['看板', '钱包', '荣誉'])
  await b.run("openItem(frequent.value.find(e => e.label === '员工与权限'))")
  assert.equal(b.s.value, 3)
  await b.run("openItem(frequent.value.find(e => e.label === '人才库'))")
  await b.run("openItem(daily.value.find(e => e.label === '查看任务'))")
  await b.run("openItem(daily.value.find(e => e.label === '发布任务'))")
  b.run('ownerEntries.forEach(e => openOwner(e))')
  assert.deepEqual(b.log.gone, ['/pages/staff/talents', '/pages/manage/tasks?storeId=102', '/pages/manage/tasks?s=2&storeId=102', '/pages/manage/dashboard?storeId=102', '/pages/manage/wallet', '/pages/manage/honor'])
  await b.run("openItem(frequent.value.find(e => e.label === '纠纷调解'))")
  assert.equal(b.log.gone.at(-1), '/pages/governance/mediation?mode=support')
  assert.deepEqual(b.log.sheets, [])
  assert.match(b.template, /<view class="function-grid owner-grid"><view v-for="item in ownerEntries"/)
  assert.match(b.template, /<template v-if="!isKeeper"><text class="group-title owner-title">换工主理人专区<\/text>/)
})

test('K7 业务页：不是本店换工主理人点专区三格只提示；小院主理人没有人才库、二消那格叫「二消订单」；没经营权限的只有查看任务', async (t) => {
  const m = business('manager', { isManager: false })
  t.after(m.stop)
  m.run('openOwner(ownerEntries[0])')
  assert.deepEqual(m.log.gone, [])
  assert.deepEqual(m.log.toasts, ['换工主理人专区仅对本店换工主理人开放'])

  const k = business('keeper')
  t.after(k.stop)
  const labels = k.json('frequent.value.map(e => e.label)')
  assert.ok(labels.includes('二消订单') && labels.includes('员工与权限') && !labels.includes('人才库'), labels.join())
  assert.equal(k.json("frequent.value.find(e => e.label === '二消订单').to"), '/pages/staff/insurance?s=3')
  assert.deepEqual(k.json('daily.value.map(e => e.label)'), ['周报管理', '查看任务', '发布任务', '日报管理', '数据看板'])

  const st = business('staff')
  t.after(st.stop)
  assert.ok(!st.json('frequent.value.map(e => e.label)').includes('人才库'), '员工没有岗位编辑权，不出人才库')
  const sv = business('service')
  t.after(sv.stop)
  assert.deepEqual(sv.json('daily.value.map(e => e.label)'), ['查看任务'])
  await sv.run("openItem(daily.value.find(e => e.label === '查看任务'))")
  assert.deepEqual(sv.log.gone, ['/pages/manage/tasks?storeId=102'])
})

// ---------------------------------------------------------------- K8 工作台
test('K8 工作台「订单管理」去旅居订单台（带门店）；二消那页两处都叫「二消订单」', () => {
  const index = src('pages/staff/index.vue')
  assert.match(index, /label: '订单管理', stay: true, to: \(\) => go\(staffStoreUrl\(R\.staffStayOrders, storeId\.value\)\)/)
  assert.doesNotMatch(index, /R\.staffInsurance \+ '\?s=3'/)
  for (const rel of ['pages/staff/index.vue', 'pages/staff/business.vue']) assert.doesNotMatch(src(rel), /二消管理/, rel)
  assert.match(src('pages/staff/business.vue'), /label: '二消订单'/)
})

// ---------------------------------------------------------------- S1 商家需求：接手并上架
const REQ = { requestId: 7, requestType: 'online_task', title: '探店笔记', storeId: 201, jobId: 88, status: 'forwarded', mine: false, canReturn: true, job: { jobStatus: 'draft' } }
test('S1 acceptPublishable：只有待接手、岗位还是草稿的线上任务', () => {
  assert.equal(v.acceptPublishable(REQ), true)
  assert.equal(v.acceptPublishable({ ...REQ, status: 'accepted', mine: true }), false, '接手后就是单独的上架按钮')
  assert.equal(v.acceptPublishable({ ...REQ, job: { jobStatus: 'published' } }), false)
  assert.equal(v.acceptPublishable({ ...REQ, requestType: 'managed', jobId: null, job: null }), false, '代运营没有岗位可上架')
  assert.equal(v.acceptPublishable(null), false)
  assert.deepEqual(v.serviceActions(REQ), ['accept'], '原来的按钮规则不变')
})

function servicePage(initial, { confirmOk = true, publishFail = null, acceptFail = null } = {}) {
  const log = { posts: [], toasts: [], confirms: [] }
  let current = initial, boot
  const s = vue.ref(1)
  const h = runSetup('pages/staff/service.vue', {
    ...v, useRequestList, R, useScreen: (n, o) => { boot = o.onLoad; return s }, ensureSession: async () => {}, hasStaffAccess: { value: true }, currentStaffStoreId: () => 102, selectStaffStore: async () => {},
    get: async (url) => (/\/requests\/\d+$/.test(url) ? { data: current } : { data: { rows: [], total: 0, hasMore: false } }),
    post: async (url) => {
      log.posts.push(url)
      if (url.includes('/accept') && acceptFail) throw acceptFail
      if (url.includes('/publish') && publishFail) throw publishFail
      return { msg: url.includes('/publish') ? '已上架' : '已接手' }
    },
    toast: m => log.toasts.push(m), go() {}, back() {}, confirm: async (title) => { log.confirms.push(title); return confirmOk }, prompt: async () => null, errText: (e, d) => (e && e.message) || d, uni: { stopPullDownRefresh() {} }
  })
  return { ...h, s, log, set: d => { current = d }, boot: async (q = {}) => { boot(q); await flush() } }
}

test('S1 模板：待接手的线上任务底栏是「接手」+「接手并上架」两个按钮', (t) => {
  const h = servicePage(REQ)
  t.after(h.stop)
  assert.match(h.template, /<view v-if="canAcceptPublish" class="req-bar__btn"><k-button block size="md" type="secondary" :label="working \? '处理中…' : '接手'" @click="runMain" \/><\/view>/)
  assert.match(h.template, /<view v-if="canAcceptPublish" class="req-bar__btn req-bar__btn--wide"><k-button block size="md" :label="working \? '处理中…' : '接手并上架'" @click="runAcceptPublish" \/><\/view>/)
  assert.match(h.template, /<view v-else-if="mainAction !== 'manage'" class="req-bar__btn">/, '其他状态还是原来的一个主按钮')
  assert.equal(h.run('CONFIRM.acceptPublish[0]'), '接手并上架')
})

test('S1 接手并上架：一次确认，先接手再上架，两个接口按顺序调', async (t) => {
  const h = servicePage(REQ)
  t.after(h.stop)
  await h.boot()
  await h.run('openDetail(7)')
  assert.equal(h.run('canAcceptPublish.value'), true)
  await h.run('runAcceptPublish()')
  assert.deepEqual(h.log.confirms, ['接手并上架'])
  assert.deepEqual(h.log.posts, ['/app/staff/service/requests/7/accept?storeId=102', '/app/staff/service/requests/7/publish?storeId=102'])
  assert.deepEqual(h.log.toasts, ['已上架'])
  // 单独「接手」照旧只调接手
  h.log.posts.length = 0
  await h.run('runMain()')
  assert.deepEqual(h.log.posts, ['/app/staff/service/requests/7/accept?storeId=102'])
})

test('S1 接手并上架：第二步失败提示再点一次上架；第一步失败只提示接手失败；不确认不发请求；代运营没有这个按钮', async (t) => {
  const half = servicePage(REQ, { publishFail: new Error('截止时间已过') })
  t.after(half.stop)
  await half.boot()
  await half.run('openDetail(7)')
  half.set({ ...REQ, status: 'accepted', mine: true })
  await half.run('runAcceptPublish()')
  assert.equal(half.log.posts.length, 2)
  assert.deepEqual(half.log.toasts, ['已接手，上架没成功，请再点一次上架'])
  assert.equal(half.run('mainAction.value'), 'publish', '刷新详情后底栏就是审核通过并上架')
  assert.equal(half.run('canAcceptPublish.value'), false)

  const none = servicePage(REQ, { acceptFail: new Error('这条需求已经有人接手了') })
  t.after(none.stop)
  await none.boot()
  await none.run('openDetail(7)')
  await none.run('runAcceptPublish()')
  assert.deepEqual(none.log.posts, ['/app/staff/service/requests/7/accept?storeId=102'], '接手失败不再调上架')
  assert.deepEqual(none.log.toasts, ['这条需求已经有人接手了'])

  const quiet = servicePage(REQ, { confirmOk: false })
  t.after(quiet.stop)
  await quiet.boot()
  await quiet.run('openDetail(7)')
  await quiet.run('runAcceptPublish()')
  assert.deepEqual(quiet.log.posts, [])

  const managed = servicePage({ ...REQ, requestType: 'managed', jobId: null, job: null })
  t.after(managed.stop)
  await managed.boot()
  await managed.run('openDetail(7)')
  assert.equal(managed.run('mainAction.value'), 'accept')
  assert.equal(managed.run('canAcceptPublish.value'), false)
  await managed.run('runAcceptPublish()')
  assert.deepEqual(managed.log.posts, [])
})
