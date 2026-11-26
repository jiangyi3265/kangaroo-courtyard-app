// 2026-11-03 员工端「报名详情」状态条回归（node --test，不构建、不发请求）。
// 主人在截图上写：「确认换工完成当前入职成功」——六步全打勾、下面一大段积分规则，看不出这份报名现在是什么状态。
// 守住这几件事：
//   · 步骤上面有「当前：…」状态条，每个状态说法对（已入职 = 「已入职（入职成功）」+ 入职日期）；
//   · 进行中的那一步和已完成的画法分开（current / done），审核未通过停住的那一步是 stopped；
//   · 已入职可确认完成时，提示只有一句「下一步…」，积分规则收进「积分规则」展开，全文仍以服务端 volunteerFinishTip 为准；
//   · 简历卡每项「标签 + 内容」分开，没填的项不出；
//   · 服务端详情下发状态条要的几个时间。
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
const PAGE = 'pages/staff/applications.vue'
const stage = await import(pathToFileURL(path.join(APP, 'pages/staff/application-stage.js')).href)
const { stageBanner, stepState, shortTime, volunteerNextHint, volunteerRule, STEP_BY_STATUS, OFFLINE_STEPS } = stage
const plain = (x) => (x === undefined ? undefined : JSON.parse(JSON.stringify(x)))
const flush = async () => { for (let i = 0; i < 8; i++) await new Promise(resolve => setImmediate(resolve)) }

const TIP = '换工结束（或提前离开）后，点「确认换工完成」填实际天数，系统按每天 10 积分发给 TA；计划结束满 3 天、并且标记入职也满 3 天还没确认的，系统按报名天数自动确认并发积分。'

test('状态条：每个状态的说法和日期', () => {
  const d = { submitTime: '2026-11-01 23:13:05', auditTime: '2026-11-02 09:00:00', userConfirmTime: '2026-11-03 10:00:00', storeConfirmTime: '2026-11-04 11:00:00', onboardTime: '2026-11-05 14:30:00', withdrawTime: '2026-11-02 08:00:00' }
  const b = (st, extra = {}, more = {}) => plain(stageBanner(st, { detail: { ...d, ...extra }, ...more }))
  assert.deepEqual(b('onboarded'), { label: '已入职（入职成功）', date: '11-05 14:30 入职', tone: 'ok' })
  assert.deepEqual(b('onboarded', { volunteerDone: true }), { label: '已入职 · 换工已完成', date: '11-05 14:30 入职', tone: 'ok' })
  assert.deepEqual(b('submitted'), { label: '待审核', date: '11-01 23:13 提交', tone: 'wait' })
  assert.equal(b('submitted', { urgent: true }).label, '待审核（已加急）')
  assert.deepEqual(b('review_passed'), { label: '审核已通过，待安排面试', date: '11-02 09:00 通过', tone: 'wait' })
  assert.deepEqual(b('review_rejected'), { label: '审核未通过', date: '11-02 09:00 审核', tone: 'stop' })
  assert.deepEqual(b('interview_booked', {}, { interview: { dateText: '11月6日 15:00' } }), { label: '已预约面试', date: '11月6日 15:00 面试', tone: 'wait' })
  assert.equal(b('interview_booked').date, '', '没约到面试详情时不编日期')
  assert.equal(b('interview_done').label, '面试已结束，待候选人确认意向')
  assert.deepEqual(b('user_confirmed'), { label: '候选人已确认意向，待门店确认录用', date: '11-03 10:00 确认意向', tone: 'wait' })
  assert.deepEqual(b('store_confirmed'), { label: '已确认录用，待候选人签约', date: '11-04 11:00 录用', tone: 'wait' })
  assert.equal(b('contract_signed').label, '已签约，待到岗后标记入职')
  assert.deepEqual(b('withdrawn'), { label: '候选人已撤回报名', date: '11-02 08:00 撤回', tone: 'stop' })
  assert.deepEqual(b('terminated'), { label: '流程已终止', date: '', tone: 'stop' })
  assert.equal(stageBanner(''), null)
  // 老服务端没有这几个时间：状态照常、日期不出
  assert.deepEqual(plain(stageBanner('onboarded', { detail: {} })), { label: '已入职（入职成功）', date: '', tone: 'ok' })
  // 线上接单
  assert.equal(plain(stageBanner('submitted', { online: true, detail: {} })).label, '待审核')
  assert.deepEqual(plain(stageBanner('review_passed', { online: true, detail: { settleStatus: 'confirmed' } })), { label: '已结算完成', date: '', tone: 'ok' })
  assert.equal(stageBanner('review_passed', { online: true, detail: {} }).label, '已通过，接单进行中')
  assert.equal(shortTime('2026-11-01'), '11-01')
  assert.equal(shortTime('2026-11-01T23:13:00'), '11-01 23:13')
  assert.equal(shortTime(null), '')
})

test('步骤：已完成 / 进行中 / 停住 分开画，入职后六步全打勾', () => {
  const row = (st) => OFFLINE_STEPS.map((_, i) => stepState(i, STEP_BY_STATUS[st], st))
  assert.deepEqual(row('onboarded'), ['done', 'done', 'done', 'done', 'done', 'done'])
  assert.deepEqual(row('contract_signed'), ['done', 'done', 'done', 'done', 'done', 'current'])
  assert.deepEqual(row('submitted'), ['done', 'current', '', '', '', ''])
  assert.deepEqual(row('review_passed'), ['done', 'done', 'current', '', '', ''])
  assert.deepEqual(row('interview_booked'), ['done', 'done', 'current', '', '', ''])
  assert.deepEqual(row('interview_done'), ['done', 'done', 'done', 'current', '', ''])
  assert.deepEqual(row('store_confirmed'), ['done', 'done', 'done', 'done', 'current', ''])
  assert.deepEqual(row('review_rejected'), ['done', 'stopped', '', '', '', ''])
  assert.deepEqual(row('withdrawn'), ['', '', '', '', '', ''])
  assert.equal(OFFLINE_STEPS[5], '入职')
})

test('确认换工完成：一句下一步 + 积分规则全文听服务端', () => {
  assert.equal(volunteerNextHint({ volunteerPerDay: 10 }), '下一步：TA 已入职，换工结束（或提前离开）后点下方「确认换工完成」填实际天数。')
  assert.match(volunteerNextHint({ volunteerPerDay: 0 }), /这次确认不发积分，原因见积分规则。$/)
  // 会员规则开着时每天积分为 0，但照样按会员口径发分，不能说「不发积分」
  const memberHint = volunteerNextHint({ volunteerPerDay: 0, volunteerFinishTip: '确认完成后积分按会员规则发放。' })
  assert.match(memberHint, /积分按会员规则发/)
  assert.doesNotMatch(memberHint, /不发积分/)
  assert.equal(volunteerRule({ volunteerFinishTip: TIP, volunteerPerDay: 10 }), TIP)
  assert.match(volunteerRule({ volunteerPerDay: 10 }), /每天 10 积分/)
})

/** 在沙箱里跑页面的 script setup：导入先给永远不返回的函数，再用 stubs 覆盖（状态条那几个用真的） */
function runSetup(stubs) {
  const d = compiler.parse(src(PAGE), { filename: PAGE }).descriptor
  const source = d.scriptSetup.content
  const ast = compiler.babelParse(source, { sourceType: 'module' })
  const body = ast.program.body.filter(n => n.type !== 'ImportDeclaration').map(n => source.slice(n.start, n.end)).join('\n')
  const sandbox = { console, setTimeout, clearTimeout }
  for (const n of ast.program.body.filter(n => n.type === 'ImportDeclaration')) for (const s of n.specifiers) sandbox[s.local.name] = () => new Promise(() => {})
  Object.assign(sandbox, stage, { ref: vue.ref, computed: vue.computed, watch: vue.watch, reactive: vue.reactive, onShow() {}, onMounted() {}, onBeforeUnmount() {}, onReachBottom() {}, getCurrentPages: () => [{}] }, stubs)
  vm.createContext(sandbox)
  const scope = vue.effectScope()
  scope.run(() => vm.runInContext(body, sandbox, { filename: PAGE }))
  return { run: code => vm.runInContext(code, sandbox), json: code => plain(vm.runInContext(code, sandbox)), stop: () => scope.stop() }
}

async function openDetail(detail, extras = {}) {
  const s = vue.ref(1)
  let boot = null, mounted = null
  const grants = [{ storeId: 102, roleCode: 'manager', storeName: '海边小院', active: true }]
  const h = runSetup({
    useScreen: (n, o) => { boot = o.onLoad; return s }, onMounted: (fn) => { mounted = fn }, R: { staffApplications: '/pages/staff/applications' },
    experience: { account: { id: 1 } }, ensureSession: async () => {}, hasStaffAccess: { value: true }, currentStaffStore: { value: grants[0] }, currentStaffStoreId: () => 102, staffStores: { value: grants },
    staffStoreUrl: (u) => u, onlineStaff: { value: false }, toast() {}, go() {}, loadStaffPerms: async () => null, staffCan: () => true,
    apiJobList: async () => ({ rows: [] }), apiStaffApplications: async () => ({ rows: [], total: 0, hasMore: false }),
    apiStaffApplicationDetail: async (id) => ({ data: { appId: id, storeId: 102, jobType: 'volunteer', ...detail } }),
    apiResumeForwards: async () => ({ data: [] }), get: async () => ({ data: extras }), releaseArrivalImages() {}, loadArrivalImages: async () => []
  })
  boot({ appId: '901' })
  await mounted()
  await flush()
  return h
}

test('页面：已入职可确认完成时，状态条 + 一句下一步 + 积分规则默认收起', async (t) => {
  const h = await openDetail({ status: 'onboarded', canManage: true, canFinishVolunteer: true, volunteerPerDay: 10, volunteerMaxDays: 5, volunteerFinishTip: TIP, onboardTime: '2026-11-02 14:30:00' })
  t.after(h.stop)
  assert.equal(h.run('detailReady.value'), true)
  assert.deepEqual(h.json('stage.value'), { label: '已入职（入职成功）', date: '11-02 14:30 入职', tone: 'ok' })
  assert.equal(h.run('passLabel.value'), '确认换工完成')
  assert.equal(h.run('actionHint.value'), '下一步：TA 已入职，换工结束（或提前离开）后点下方「确认换工完成」填实际天数。')
  assert.equal(h.run('pointsRule.value'), TIP)
  assert.equal(h.run('ruleOpen.value'), false)
  assert.deepEqual([0, 5].map(i => h.run(`stepClass(${i})`)), ['done', 'done'])
})

test('页面：三方协议按双方进度显示店家动作，不能把待店家核对误写为待用户签约', async (t) => {
  const h = await openDetail({ status: 'store_confirmed', canManage: true, canReviewVolunteerContract: true, volunteerContractStatus: 'pending' })
  t.after(h.stop)
  assert.equal(h.run('canPass.value'), true)
  assert.equal(h.run('passLabel.value'), '核对三方协议')
  assert.equal(h.json('stage.value').label, '用户已确认协议，待店家核对')
  assert.match(h.run('actionHint.value'), /代表店家确认/)
  h.run("detail.value = { ...detail.value, volunteerContractStatus: 'rejected' }")
  assert.equal(h.run('canPass.value'), false)
  assert.equal(h.run('passLabel.value'), '待用户重新确认')
  h.run("detail.value = { ...detail.value, volunteerContractStatus: 'pending', canManage: false }")
  assert.equal(h.run('canPass.value'), false)
  assert.equal(h.run('passLabel.value'), '只读查看')
})

test('页面：简历卡按「标签 + 内容」列出，没填的项不出', async (t) => {
  const h = await openDetail({ status: 'contract_signed', canManage: true, canViewRecruitmentDetails: true }, { resume: { hobbies: '22', personality: '  ', background: '222\n在民宿做过前台' } })
  t.after(h.stop)
  assert.deepEqual(h.json('profileFields.value'), [{ key: 'hobbies', label: '兴趣爱好', value: '22' }, { key: 'background', label: '相关经历', value: '222\n在民宿做过前台' }])
  assert.equal(h.run('stepClass(5)'), 'current')
  assert.equal(h.json('stage.value').label, '已签约，待到岗后标记入职')
  assert.equal(h.run('pointsRule.value'), '')
})

test('模板：状态条在步骤上面，步骤按三种画法上色，模板能编译', () => {
  const page = src(PAGE)
  const tpl = compiler.parse(page, { filename: PAGE }).descriptor.template.content
  assert.match(tpl, /class="stage-banner"[^]*?当前：\{\{ stage\.label \}\}[^]*?<view class="steps">/)
  assert.match(tpl, /class="step-circle" :class="stepClass\(i\)"/)
  assert.match(tpl, /class="points-rule"[^>]*@click="ruleOpen = !ruleOpen"/)
  assert.match(tpl, /v-for="field in profileFields"[^>]*class="profile-item"/)
  assert.doesNotMatch(tpl, /v-show="extras\.resume\[field\[0\]\]"/)
  assert.match(page, /\.step-circle\.current\{background:#fff;border:2px solid var\(--k-red\)/)
  assert.doesNotMatch(page, /\.step-circle\.done,\.step-circle\.current/)
  assert.match(page, /from '\.\/application-stage\.js'/)
  const r = compiler.compileTemplate({ source: tpl, filename: PAGE, id: 'x' })
  assert.deepEqual(r.errors, [])
})

test('页面：还没到约定到岗日前 1 天，提示先说明，点「标记入职」只弹说明、不发请求（2026-11-09）', async (t) => {
  const WAIT = '约定到岗日是 11-22，还没到；如果 TA 提前到了，请先在「到岗／入住日期」里提议实际日期，等 TA 确认后再标记入职'
  const h = await openDetail({ status: 'contract_signed', canManage: true, canOnboard: true, onboardWait: WAIT })
  t.after(h.stop)
  assert.equal(h.run('actionHint.value'), WAIT)
  h.run('globalThis.__modals=[];globalThis.__calls=0;globalThis.uni={showModal(o){__modals.push(o)}};globalThis.apiStaffOnboard=()=>{__calls++;return new Promise(()=>{})}')
  await h.run('current.value=current.value||{appId:901,status:"contract_signed"};onPass()')
  assert.deepEqual(h.json('__modals'), [{ title: '还不能标记入职', content: WAIT, showCancel: false }])
  assert.equal(h.run('__calls'), 0)
  // 没有 onboardWait（到岗日已到 / 没有约定到岗日）照旧
  const ok = await openDetail({ status: 'contract_signed', canManage: true, canOnboard: true })
  t.after(ok.stop)
  assert.equal(ok.run('actionHint.value'), '候选人已签约，确认实际到岗后可标记入职。')
})

test('服务端：员工报名详情下发状态条要的几个时间', () => {
  const java = fs.readFileSync(path.join(APP, '../RuoYi-Vue/ruoyi-kangaroo/src/main/java/com/ruoyi/kangaroo/controller/app/AppStaffController.java'), 'utf8')
  for (const k of ['auditTime', 'userConfirmTime', 'storeConfirmTime', 'onboardTime', 'withdrawTime']) {
    assert.match(java, new RegExp(`data\\.put\\("${k}", app\\.get${k[0].toUpperCase() + k.slice(1)}\\(\\)\\)`))
  }
  // 预计到店当天起才可确认：提示和写入共享同一政策，优先使用用户单独填报的 ETA。
  assert.match(java, /data\.put\("onboardWait", [^;]*ArrivalConfirmationPolicy\.waitReason\(db, appId, false\)/)
})
