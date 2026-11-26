// 招聘区 10-13 第二轮复查的回归（node --test，不需要构建、不发请求）：
//   · 报名页、同行页自己问「去登录」时，要在任何 await 之前给错误标上 e.loginHandled，request.js 就不再叠一个通用登录框
//     （两个框接连弹，后一个顶掉前一个；同行页的 await modal 永远不回来，「这家店缺人了提醒我」会一直锁着点不动）；
//   · 岗位详情不能报名时，标题旁的灰色胶囊先按服务端给的原因说：线上任务过了截止时间又恰好暂停 / 满员时写「已过截止时间」，
//     和红色提示条说同一件事；服务端说名额已满时写「名额已满」；
//   · 报名详情读简历失败时，重试说明指向这一屏真有的按钮（「刷新到店信息」在经历记录下方，脱敏简历屏没有这个按钮）；
//   · 这几个后端文件原本是 CRLF 换行，不能整文件转成 LF（round 1 曾把 AppStaffExtController.java 整个转掉）。
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'
import test from 'node:test'
import assert from 'node:assert/strict'
import { remainingHeadcount } from '../pages/jobs/store-page.js'
import * as applyFlow from '../pages/jobs/apply-flow.js'
import * as multiApply from '../pages/jobs/multi-apply.js'

const APP = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const JAVA = path.resolve(APP, '../RuoYi-Vue/ruoyi-kangaroo/src/main/java/com/ruoyi/kangaroo')
const require = createRequire(path.join(APP, 'package.json'))
const compiler = require('@vue/compiler-sfc'), vue = require('vue')
const src = (rel) => fs.readFileSync(path.join(APP, rel), 'utf8').replace(/\r\n/g, '\n')

/** 在沙箱里跑页面的 script setup：导入一律先给永远不返回的函数，再用 stubs 覆盖用得到的那几个 */
function runSetup(rel, stubs) {
  const d = compiler.parse(src(rel), { filename: rel }).descriptor
  const source = d.scriptSetup.content
  const ast = compiler.babelParse(source, { sourceType: 'module' })
  const body = ast.program.body.filter(n => n.type !== 'ImportDeclaration').map(n => source.slice(n.start, n.end)).join('\n')
  const sandbox = { console }
  for (const n of ast.program.body.filter(n => n.type === 'ImportDeclaration')) for (const s of n.specifiers) sandbox[s.local.name] = () => new Promise(() => {})
  Object.assign(sandbox, {
    remainingHeadcount,
    ref: vue.ref, computed: vue.computed, watch: vue.watch, reactive: vue.reactive,
    onShow() {}, onHide() {}, onUnload() {}, onUnmounted() {}
  }, stubs)
  vm.createContext(sandbox)
  const scope = vue.effectScope()
  scope.run(() => vm.runInContext(body, sandbox, { filename: rel + ':script-setup' }))
  return { run: code => vm.runInContext(code, sandbox), stop: () => scope.stop() }
}

test('义工改期后，先前发起的会议刷新不能把旧会议号显示回来', async t => {
  const requests = []
  const h = runSetup('pages/jobs/interview.vue', {
    useScreen: () => vue.ref(1), experience: {account:{id:18}}, toast() {}, serverTs: () => 0,
    setInterval: () => 1, clearInterval() {},
    apiApplicationDetail: () => new Promise(resolve => requests.push(resolve)),
    apiRescheduleInterview: async () => ({code:200})
  })
  t.after(h.stop)
  const booked = meetingInfo => ({status:'interview_booked',interview:{meetingInfo}})
  h.run("appId.value=5; detail.value={status:'interview_booked',interview:{meetingInfo:'旧会'}}; slots.value=[{slotId:7}]; slotPick.value=7")
  const pendingRefresh = h.run('refreshMeetingInfo(true)')
  const changing = h.run('confirmReschedule()')
  await new Promise(resolve => setImmediate(resolve))
  assert.equal(requests.length,2)
  requests[1]({data:booked('新会')})
  await changing
  requests[0]({data:booked('旧会')})
  await pendingRefresh
  assert.equal(h.run('detail.value.interview.meetingInfo'),'新会')
  assert.equal(h.run('meetingRefreshing.value'),false)
})

function interviewNotificationFixture() {
  let pageLoad, unload
  const currentStore = 11, requests = [], detailRequests = []
  const h = runSetup('pages/staff/interviews.vue', {
    useScreen: (_, options) => { pageLoad = options.onLoad; return vue.ref(1) },
    onUnload: callback => { unload = callback }, getSessionRevision: () => 1, getToken: () => 'demo',
    experience: {account: {id: 7}, mode: 'staff'}, ensureSession: async () => {},
    hasStaffAccess: vue.ref(true), currentStaffStoreId: () => currentStore,
    staffStores: vue.ref([{storeId: currentStore, roleCode:'staff'}, {storeId: 22, roleCode:'manager'}]),
    apiStaffInterviews: async query => { requests.push(query.storeId); throw new Error('日程暂不可用') },
    apiStaffInterviewDetail: id => new Promise(resolve => detailRequests.push({id, resolve})),
    uni: {getNetworkType: o => o.success({networkType:'none'}), getSetting: () => {}},
    navigator: {}, toast: () => {}
  })
  return {...h, open: pageLoad, leave: () => unload(), requests, detailRequests}
}

const flushPage = () => new Promise(resolve => setImmediate(resolve))

test('报名人从续期提醒打开自己的报名；在岗优先显示续期，结束后的旧提醒仍定位到原报名', async t => {
  let onEntry
  const requests = []
  const application = { appId: 41, jobType: 'volunteer', status: 'onboarded' }
  const page = runSetup('pages/jobs/interview.vue', {
    useScreen: (_, options) => { onEntry = options.onLoad; return vue.ref(1) },
    apiApplicationDetail: async id => { requests.push(id); return { data: { ...application } } },
    experience: { account: { id: 18 } }, serverTs: () => 0, toast: assert.fail
  })
  t.after(page.stop)
  const preview = vm.runInNewContext(src('common/message-preview.js')
    .replace(/^import .*$/gm, '').replace('export function', 'function') + '\nshowMessagePreview', {
    uni: { showModal: opts => opts.success({ confirm: true }) },
    go: route => {
      const url = new URL(route, 'https://example.invalid')
      assert.equal(url.pathname, '/pages/jobs/interview')
      onEntry(Object.fromEntries(url.searchParams))
    }
  })
  const inbox = runSetup('pages/notice/inbox.vue', {
    experience: { mode: 'user', account: { id: 18 } }, showMessagePreview: preview
  })
  t.after(inbox.stop)
  const openNotification = () => inbox.run("open({id:93,read:true,title:'请确认换工续期',route:'/pages/jobs/interview?appId=41&focus=renewal'})")
  openNotification()
  await flushPage()
  assert.deepEqual(requests, ['41'])
  assert.equal(page.run('s.value'), 4)
  assert.equal(page.run('renewalFirst.value && focusRenewal.value'), true)
  onEntry({ appId: '41' })
  await flushPage()
  assert.equal(page.run('renewalFirst.value && !focusRenewal.value'), true)
  application.status = 'completed'
  openNotification()
  await flushPage()
  assert.equal(page.run("renewalFirst.value && status.value === 'completed'"), true)
  application.jobType = 'parttime'
  openNotification()
  await flushPage()
  assert.equal(page.run('renewalFirst.value'), false)
})

test('从面试通知打开报名门店，日程故障时仍能打开指定面试；退出后重进只显示新消息', async (t) => {
  const preview = vm.runInNewContext(src('common/message-preview.js')
    .replace(/^import .*$/gm, '').replace('export function', 'function') + '\nshowMessagePreview', {
    uni: {showModal: options => options.success({confirm: true})},
    go: route => openInterview(Object.fromEntries(new URL(route, 'https://example.invalid').searchParams))
  })
  const inbox = runSetup('pages/notice/inbox.vue', {
    experience: {mode:'staff', account:{id:7}}, showMessagePreview: preview
  })
  t.after(inbox.stop)
  const first = interviewNotificationFixture()
  let openInterview = first.open
  t.after(first.stop)
  inbox.run("open({id:1,read:true,title:'面试安排',route:'/pages/staff/interviews?id=93&storeId=22'})")
  await flushPage()
  assert.deepEqual(first.requests,[22])
  assert.deepEqual(first.detailRequests.map(r => r.id),[93])
  first.leave()
  const next = interviewNotificationFixture()
  t.after(next.stop)
  openInterview = next.open
  inbox.run("open({id:2,read:true,title:'面试安排',route:'/pages/staff/interviews?id=94&storeId=22'})")
  await flushPage()
  next.detailRequests[0].resolve({data:{interviewId:94,storeId:22}})
  first.detailRequests[0].resolve({data:{interviewId:93,storeId:22}})
  await flushPage()
  assert.equal(next.run('s.value'),2)
  assert.equal(next.run('d.value.interviewId'),94)
  assert.equal(first.run('d.value.interviewId'),undefined)
  const denied = interviewNotificationFixture()
  t.after(denied.stop)
  denied.open({id:'93',storeId:'33'})
  await flushPage()
  assert.deepEqual(denied.detailRequests,[])
})

test('日程连开两名候选人，只展示最后所选面试', async (t) => {
  const h = interviewNotificationFixture()
  t.after(h.stop)
  const first = h.run('openDetail({interviewId: 93})')
  const last = h.run('openDetail({interviewId: 94})')
  h.detailRequests[1].resolve({data:{interviewId:94,storeId:22}})
  await last
  h.detailRequests[0].resolve({data:{interviewId:93,storeId:22}})
  await first
  assert.equal(h.run('d.value.interviewId'),94)
})

test('切换账号后迟到的简历不会覆盖新账号；线上投递回包不会写入新账号草稿', async (t) => {
  const experience = vue.reactive({account: {id: 1, nickname: '甲', phone: '13900000001'}})
  const resumes = [], writes = [], submitted = []
  const h = runSetup('pages/jobs/apply.vue', {
    ...applyFlow, experience, ensureSession: async () => {}, todayCn: () => '2026-11-20',
    loadApplicationDraft: () => ({jobId: 11, note: '草稿' + experience.account.id}),
    apiResume: () => new Promise(resolve => resumes.push(resolve)),
    apiSubmitApplication: body => new Promise(resolve => submitted.push({body, resolve})),
    visitSubscriptions: {warm() {}}, saveApplicationDraft: d => writes.push(d),
    bindShareAfterApply() {}, toast() {}, uni: {pageScrollTo() {}}
  })
  t.after(h.stop)
  h.run("jobId.value=11; job.value={jobType:'volunteer'}; jobType.value='volunteer'; jobReady.value=true")
  const earlier = h.run('loadResume()')
  experience.account = {id: 2, nickname: '乙', phone: '13900000002'}
  resumes[1]({data: {name: '乙的简历'}})
  await Promise.resolve()
  resumes[0]({data: {name: '甲的简历'}})
  await earlier
  assert.equal(h.run('resume.value.name'), '乙的简历')
  h.run("jobType.value='online'; job.value={jobType:'online'}; loadResume(); note.value='乙的补充说明'")
  const completion = h.run('submit()')
  await new Promise(resolve => setImmediate(resolve))
  assert.equal(submitted[0].body.name, '乙')
  experience.account = {id: 3, nickname: '丙', phone: '13900000003'}
  assert.equal(h.run('contactName.value'), '丙')
  assert.equal(h.run('contactPhone.value'), '13900000003')
  assert.equal(h.run('note.value'), '草稿3')
  submitted[0].resolve({data: {appId: 333}})
  await completion
  assert.equal(h.run('saved.value'), false)
  assert.equal(h.run('appId.value'), null)
  assert.deepEqual(writes, [])
})

test('多店投递中切换账号，已发的一笔结束后停止后续投递，旧报名也不会绑定到新账号', async (t) => {
  const experience = vue.reactive({account: {id: 1}}), sent = [], shares = []
  let finish
  const h = runSetup('pages/jobs/components/multi-apply.vue', {
    ...multiApply, experience, defineOptions() {}, defineProps: () => ({job:{}, jobId:4, submitTick:0}), defineEmits: () => () => {},
    apiSubmitApplication: body => { sent.push(body.jobId); return new Promise(resolve => { finish = resolve }) },
    bindShareAfterApply: (...args) => shares.push(args)
  })
  t.after(h.stop)
  const batch = h.run("runRows([makeRow({jobId:11}, {arrival:'2026-11-25',days:30}), makeRow({jobId:12}, {arrival:'2026-11-25',days:30})])")
  assert.deepEqual(sent, [11])
  experience.account = {id: 2}
  finish({data:{appId:401}})
  await batch
  assert.deepEqual(sent, [11])
  assert.deepEqual(shares, [])
})

test('报名页、同行页的 401 分支在弹自己的「去登录」之前同步标上 loginHandled', () => {
  for (const [rel, call] of [['pages/jobs/apply.vue', 'askLogin('], ['pages/jobs/team.vue', 'await modal(']]) {
    const s = src(rel)
    const at = s.indexOf('code === 401')
    assert.ok(at > 0, rel + ' 没有 401 分支')
    assert.equal(s.indexOf('code === 401', at + 1), -1, rel + ' 有多个 401 分支，请逐个检查')
    const end = s.indexOf(call, at)
    assert.ok(end > at, rel + ' 的 401 分支里没有 ' + call)
    const seg = s.slice(at, end).replace(/\/\/.*$/gm, '')   // 只看代码，不看注释
    assert.match(seg, /e\.loginHandled = true/, rel + '：401 时要标上 loginHandled')
    assert.doesNotMatch(seg, /\bawait\b/, rel + '：标记要在任何 await 之前（request.js 在下一轮宏任务里看这个标记）')
  }
})

test('岗位详情：胶囊短说法先跟服务端原因走，和红色提示条一致', (t) => {
  const h = runSetup('pages/jobs/detail.vue', { useScreen: () => vue.ref(1), experience: vue.reactive({ account: null }), absUrl: x => x })
  t.after(h.stop)
  const chip = (d) => {
    h.run('detail.value = ' + JSON.stringify(d))
    return JSON.parse(h.run('JSON.stringify([blockedShort.value, applyBlockedText.value])'))
  }
  const DEADLINE = '这个任务已过截止时间，不再接单'
  // 过了截止时间又满员：服务端原因是截止时间，胶囊不能写「名额已满」
  assert.deepEqual(chip({ jobType: 'online', status: 'published', acceptsApplication: false, applyClosedReason: DEADLINE, headcount: 3, hiredCount: 3 }), ['已过截止时间', DEADLINE])
  // 暂停中又过了截止时间：服务端原因同样是截止时间
  assert.deepEqual(chip({ jobType: 'online', status: 'paused', acceptsApplication: false, applyClosedReason: DEADLINE, headcount: 3, hiredCount: 1 }), ['已过截止时间', DEADLINE])
  // 服务端说名额已满（线上任务按进行中的接单人数算），胶囊也写名额已满
  assert.equal(chip({ jobType: 'online', status: 'published', acceptsApplication: false, applyClosedReason: '这个任务的名额已满，暂不接受报名', headcount: 3, hiredCount: 2 })[0], '名额已满')
  // 原来的几种照旧
  assert.equal(chip({ jobType: 'volunteer', status: 'paused', acceptsApplication: false, applyClosedReason: '该岗位暂停招聘中，暂不接受报名', headcount: 5, hiredCount: 2 })[0], '已暂停招聘')
  assert.equal(chip({ jobType: 'volunteer', status: 'published', acceptsApplication: true, headcount: 4, hiredCount: 4 })[0], '名额已满')
  assert.equal(chip({ jobType: 'volunteer', status: 'published', acceptsApplication: true, headcount: 5, hiredCount: 2 })[0], '')
})

test('员工从通知冷启动进入指定报名，切换身份后丢弃原报名和迟到的详情', async t => {
  const experience = vue.reactive({ account: null, mode: 'user' })
  // 这次打开前恢复过会话但网络失败，因此全局 restored 可以已经为 true。
  const loginState = vue.reactive({ restoring: true, restored: true })
  const grant = vue.ref(null)
  const pending = []
  let onLoad, onMounted, finishLogin
  const session = new Promise(resolve => { finishLogin = resolve })
  const h = runSetup('pages/staff/applications.vue', {
    experience, session: loginState, currentStaffStore: grant, staffStores: vue.computed(() => grant.value ? [grant.value] : []),
    hasStaffAccess: vue.computed(() => !!grant.value), staffCan: () => true,
    useScreen(_, hooks) { onLoad = hooks.onLoad; return vue.ref(1) },
    onMounted(fn) { onMounted = fn }, ensureSession: () => session, loadStaffPerms: async () => {},
    apiJobList: async () => ({ rows: [] }), apiStaffApplications: async () => ({ rows: [], total: 0 }),
    apiStaffApplicationDetail: appId => new Promise(resolve => pending.push({ appId, resolve })),
    releaseArrivalImages() {}
  })
  t.after(h.stop)
  onLoad({ storeId: '101', appId: '741' })
  const mounted = onMounted()
  experience.account = { id: 17 }
  grant.value = { storeId: 101, roleCode: 'manager' }
  experience.mode = 'staff'
  loginState.restoring = false
  loginState.restored = true
  finishLogin()
  await mounted
  assert.equal(pending.length, 1)
  assert.equal(pending[0].appId, 741)
  assert.equal(h.run('s.value'), 2)
  pending.shift().resolve({ data: { appId: 741, jobType: 'volunteer', status: 'onboarded' } })
  await new Promise(resolve => setImmediate(resolve))
  assert.equal(h.run('detail.value?.appId'), 741)

  for (const switchIdentity of [
    () => { grant.value = { storeId: 102, roleCode: 'manager' } },
    () => { experience.account = { id: 18 } },
    () => { experience.mode = 'user' },
    () => { experience.account = { id: 19 } },
    () => { experience.mode = 'staff' }
  ]) {
    const previous = h.run('openDetail({ appId: 741 })')
    assert.equal(pending.length, 1)
    switchIdentity()
    assert.equal(h.run('s.value'), 1)
    assert.equal(h.run('detail.value'), null)
    pending.shift().resolve({ data: { appId: 741, status: 'onboarded' } })
    await previous
    assert.equal(h.run('detail.value'), null)
  }
})

test('报名详情读简历失败时，重试说明指向这一屏真有的按钮', () => {
  const s = src('pages/staff/applications.vue')
  assert.doesNotMatch(s, /可点上方「刷新到店信息」/)
  assert.match(s, /s\.value === 2 \? '简历读取失败，可点下方「刷新到店信息」重新读取' : '简历读取失败，请回到报名详情点「刷新到店信息」重新读取'/)
  // 第 2 屏里「刷新到店信息」确实在经历记录下方
  const screen2 = /<template v-else-if="s === 2">[\s\S]*?<\/template>\n\n/.exec(s)[0]
  assert.ok(screen2.indexOf('经历记录') < screen2.indexOf('label="刷新到店信息"'))
})

test('招聘区原本是 CRLF 的后端文件仍是 CRLF', () => {
  for (const rel of ['controller/app/AppStaffExtController.java', 'ext/staff/KgTalentService.java', 'ext/staff/KgResumeShareService.java', 'ext/user/KgResumeService.java']) {
    const b = fs.readFileSync(path.join(JAVA, rel))
    let lf = 0, crlf = 0
    for (let i = 0; i < b.length; i++) if (b[i] === 10) { lf++; if (i > 0 && b[i - 1] === 13) crlf++ }
    assert.ok(lf > 0 && crlf === lf, `${rel}: ${crlf}/${lf} 行是 CRLF`)
  }
})
