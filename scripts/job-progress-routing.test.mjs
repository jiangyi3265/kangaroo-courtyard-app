// 报名进度分流表的静态回归（node --test，不需要构建、不发请求）。
// 守住 2026-10-02 修掉的几件事：
//   · 审核进度页 / 面试页对每一个后端报名状态都有确定的落点，不再沿用 URL 里的 ?s=；
//   · 两页互相 redirectTo 的状态集合不相交（不会来回转），转过去的状态在对方页一定有屏；
//   · 已撤回 / 已终止 / 未通过不会落到"选面试时间"，候场页（第 1 屏）只给已约面试的报名；
//   · 「我的订单」查看进度的分流（KgUserHubService）、线上任务进行中状态（KgOnlineTaskService.WORKING）与前端同一口径；
//   · 列表页筛选胶囊把岗位大类当 type 传，而不是塞进关键词 q。
import assert from 'node:assert/strict'
import test from 'node:test'
import { readFile } from 'node:fs/promises'
import vm from 'node:vm'
import * as vue from 'vue'
import { parse, babelParse } from '@vue/compiler-sfc'

const read = async (p) => (await readFile(new URL(p, import.meta.url), 'utf8')).replace(/\r\n/g, '\n')
const progress = await read('../pages/jobs/progress.vue')
function progressPage(api = {}) {
  const script = parse(progress).descriptor.scriptSetup.content
  const nodes = babelParse(script, {sourceType:'module'}).program.body
  const hooks = {}, routes = [], writes = [], toasts = []
  const ctx = { ...vue,
    useScreen:(_,options)=>{hooks.load=options.onLoad;return vue.ref(1)},
    onShow:f=>{hooks.show=f}, onHide:f=>{hooks.hide=f}, onUnload:f=>{hooks.unload=f}, onShareAppMessage(){},
    getMessageScopeKey:()=> 'test-user', R:{jobInterview:'/interview'}, replace:url=>routes.push(url), toast:t=>toasts.push(t),
    apiUrgentInfo:async()=>({data:null}), apiInterviewSlots:async()=>({data:[]}),
    apiBookInterview:async(id,slot)=>writes.push([id,slot]),
    ...api
  }
  vm.createContext(ctx)
  vm.runInContext(nodes.filter(n=>n.type!=='ImportDeclaration').map(n=>script.slice(n.start,n.end)).join('\n'),ctx)
  return {hooks,routes,writes,toasts,run:js=>vm.runInContext(js,ctx)}
}
const settlePage = () => new Promise(resolve=>setImmediate(resolve))
const app = status => ({data:{appId:7,jobType:'parttime',status}})

test('从联系门店页返回，报名已约面试则直接显示当前进度',async()=>{
  let state='submitted'
  const page=progressPage({apiApplicationDetail:async()=>app(state)})
  page.hooks.load({appId:7}); page.hooks.show(); await settlePage()
  assert.equal(page.run('detail.value.status'),'submitted')
  page.hooks.hide?.()
  state='interview_booked';page.hooks.show();await settlePage()
  assert.deepEqual(page.routes,['/interview?appId=7'])
})
test('离开报名进度后，迟到的详情不会把用户带回面试页',async()=>{
  let finish
  const page=progressPage({apiApplicationDetail:()=>new Promise(resolve=>{finish=resolve})})
  page.hooks.load({appId:7});page.hooks.show();await settlePage()
  page.hooks.unload?.();finish(app('interview_booked'));await settlePage()
  assert.deepEqual(page.routes,[])
})
test('门店时段刷新期间不能确认已经选过的旧时段',async()=>{
  let finish,first=true
  const page=progressPage({apiApplicationDetail:async()=>app('review_passed'),
    apiInterviewSlots:()=>{if(first){first=false;return Promise.resolve({data:[{slotId:8}]})}
      return new Promise(resolve=>{finish=resolve})}})
  page.hooks.load({appId:7});page.hooks.show();await settlePage()
  page.run('openSlots()');await settlePage();page.run('picked.value=0')
  const pending=page.run('loadSlots()');await page.run('confirmTime()')
  assert.deepEqual(page.writes,[])
  finish({data:[{slotId:9}]});await pending
  assert.equal(page.run('picked.value'),-1)
})
test('返回选时段页仍可继续选号，再次读取失败后允许重试',async()=>{
  let fail=false,count=0
  const page=progressPage({apiApplicationDetail:async()=>{if(fail)throw Error('断网');return app('review_passed')},
    apiInterviewSlots:async()=>({data:[{slotId:++count}]})})
  page.hooks.load({appId:7});page.hooks.show();await settlePage()
  page.run('openSlots()');await settlePage()
  page.hooks.hide();page.hooks.show();await settlePage()
  assert.equal(page.run('s.value'),4)
  assert.equal(page.run('options.value[0].slotId'),2)
  page.run('onBack()')
  assert.equal(page.run('s.value'),2)
  fail=true;page.hooks.hide();page.hooks.show();await settlePage()
  assert.equal(page.run('loadState.value'),'failed')
  assert.equal(page.run('canWithdraw.value'),false)
  fail=false;await page.run('loadDetail()')
  assert.equal(page.run('s.value'),2)
})
test('离开页面后旧撤回弹窗失效；停在当前报名连续点只提交一次',async()=>{
  let confirmation, finish, writes=0
  const page=progressPage({apiApplicationDetail:async()=>app('submitted'),
    uni:{showModal:opts=>{confirmation=opts.success}},
    apiWithdrawApplication:()=>{writes++;return new Promise(resolve=>{finish=resolve})}})
  page.hooks.load({appId:7});page.hooks.show();await settlePage()
  page.run('withdraw()');page.hooks.hide();confirmation({confirm:true})
  assert.equal(writes,0)
  page.hooks.show();await settlePage()
  page.run('withdraw()');confirmation({confirm:true})
  page.run('withdraw()');confirmation({confirm:true})
  assert.equal(writes,1)
  finish({});await settlePage()
})
const interview = await read('../pages/jobs/interview.vue')
const list = await read('../pages/jobs/list.vue')
const filter = await read('../pages/jobs/filter.vue')
const javaRoot = '../../RuoYi-Vue/ruoyi-kangaroo/src/main/java/com/ruoyi/kangaroo/'
const statusJava = await read(javaRoot + 'enums/ApplicationStatus.java')
const hubJava = await read(javaRoot + 'ext/user/KgUserHubService.java')
const onlineJava = await read(javaRoot + 'ext/staff/KgOnlineTaskService.java')

/** 取出 `const NAME = <字面量>`（对象或数组，单层）并求值 */
const literal = (src, name) => {
  const m = new RegExp(`const ${name} = (\\{[\\s\\S]*?\\}|\\[[\\s\\S]*?\\])\\n`).exec(src)
  assert.ok(m, name + ' not found')
  return Function('return (' + m[1] + ')')()
}
const javaList = (src, name) => {
  const m = new RegExp(name + '\\s*=\\s*Arrays\\.asList\\(([\\s\\S]*?)\\);').exec(src)
  assert.ok(m, name + ' not found')
  return [...m[1].matchAll(/"([a-z_]+)"/g)].map(x => x[1])
}
const ALL = [...statusJava.matchAll(/public static final String [A-Z_]+ = "([a-z_]+)";/g)].map(x => x[1])

const P_SCREEN = literal(progress, 'SCREEN_BY_STATUS')
const P_INTERVIEW = literal(progress, 'INTERVIEW_PAGE')
const P_ONLINE = literal(progress, 'ONLINE_WORKING')
const I_SCREEN = literal(interview, 'SCREEN_BY_STATUS')
const I_PROGRESS = literal(interview, 'PROGRESS_PAGE')

test('后端状态枚举读到了全部 11 个状态', () => {
  assert.equal(ALL.length, 11)
})

test('审核进度页：每个状态要么有屏，要么转面试页，二者不重叠', () => {
  for (const st of ALL) {
    const own = st in P_SCREEN
    const away = P_INTERVIEW.includes(st)
    assert.ok(own !== away, st + (own ? ' 同时出现在两处' : ' 没有落点'))
  }
})

test('面试页：每个状态要么有屏，要么转回审核进度页，二者不重叠', () => {
  for (const st of ALL) {
    const own = st in I_SCREEN
    const away = I_PROGRESS.includes(st)
    assert.ok(own !== away, st + (own ? ' 同时出现在两处' : ' 没有落点'))
  }
})

test('两页互转的状态集合不相交，转过去的状态在对方页一定有屏（不会来回跳）', () => {
  for (const st of P_INTERVIEW) {
    assert.ok(!I_PROGRESS.includes(st), st)
    assert.ok(st in I_SCREEN, st)
  }
  for (const st of I_PROGRESS) {
    assert.ok(!P_INTERVIEW.includes(st), st)
    assert.ok(st in P_SCREEN, st)
  }
})

test('终态与未通过不会落到"审核通过 / 选面试时间"，选时段屏不由状态直达', () => {
  for (const st of ['withdrawn', 'terminated', 'review_rejected']) assert.ok([1, 3].includes(P_SCREEN[st]), st)
  assert.ok(!Object.values(P_SCREEN).includes(4))
  assert.equal(P_SCREEN.review_passed, 2)
})

test('面试页候场屏（改期 / 撤回）只给已约面试的报名', () => {
  assert.deepEqual(Object.keys(I_SCREEN).filter(k => I_SCREEN[k] === 1), ['interview_booked'])
  assert.ok(I_PROGRESS.includes('withdrawn'))
  // 新状态兜底落第 4 屏（只陈述状态），不能落回候场屏
  assert.match(interview, /s\.value = SCREEN_BY_STATUS\[status\.value\] \|\| 4/)
  assert.match(interview, /if \(status\.value !== 'interview_booked'\) \{/)
})

test('线上任务：进度页按 jobType 分流到交付入口，面试页一律转回进度页', () => {
  assert.deepEqual([...P_ONLINE].sort(), javaList(onlineJava, 'WORKING').sort())
  assert.match(progress, /d\.jobType === 'online' && ONLINE_WORKING\.indexOf\(d\.status\) >= 0\) return 2/)
  assert.match(progress, /detail\.value\.jobType !== 'online' && INTERVIEW_PAGE\.indexOf/)
  assert.match(progress, /R\.jobDeliver \+ '\?appId='/)
  assert.match(interview, /detail\.value\.jobType === 'online' \|\| PROGRESS_PAGE\.indexOf/)
  // 两页互转必须是 redirectTo，不能一层层压栈
  assert.match(progress, /replace\(`\$\{R\.jobInterview\}\?appId=/)
  assert.match(interview, /replace\(`\$\{R\.jobProgress\}\?appId=/)
})

test('「我的订单」查看进度与前端同一口径', () => {
  assert.deepEqual(javaList(hubJava, 'INTERVIEW_PAGE_STATUSES'), P_INTERVIEW)
})

test('列表页筛选 / 订阅把岗位大类当 type 传，筛选页按 jobType 发给后端', () => {
  // 大类用 type 传（2026-10-16 第二轮改版起列表页只从小铃铛进订阅屏 ?s=2，顺带选了的城市 cities=；线上任务不带城市）
  // 2026-10-17：地址参数统一由 job-filters.filterQuery 生成（type + 城市 + 这个页签的条件，线上任务不带城市）
  assert.match(list, /const openNewSub = \(\) => \{\n  const type = curType\(\)\n  go\(R\.jobsFilter \+ '\?s=2&' \+ queryString\(filterQuery\(type, filterOf\(type\)\)\)\)\n\}/)
  assert.doesNotMatch(list, /&q=' \+ encodeURIComponent\(TYPES/)
  assert.match(filter, /jobType: f\.jobType \|\| undefined/)
  const names = literal(filter, 'JOB_TYPE_NAMES')
  assert.deepEqual(Object.keys(names).sort(), javaList(hubJava, 'JOB_TYPE_CODES').sort())
})
