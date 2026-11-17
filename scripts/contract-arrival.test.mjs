// 2026-10-15 签约到店页（pages/jobs/contract.vue）回归，node --test 直接跑，不构建、不发请求：
//   · 保险：「保障详情」没有投保记录时，不再劝人自行购买意外险，改为如实说明「目前还没有投保记录」；
//   · 签署时责任书已改过字（服务端 409「责任书内容已更新…」）：重新拉条款、阅读进度清零、退回第 1 屏，不再卡在签署屏
//     （2026-11-03 起阅读进度按往下滑算，不再逐条点开，见 contract-read-20261103.test.mjs）；
//   · 「接站需求」下线：到店信息里没有接站这一行和开关，保存时也不再提交 needPickup；
//   · 以及对应的后端口径（只做静态核对，行为由 ruoyi-kangaroo 的 KgContractTermsTest / KgArrivalNotificationIdempotencyTest 覆盖）。
// contract.vue 跑的是真实的 script setup，接口按用例换成桩。
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'
import test from 'node:test'
import assert from 'node:assert/strict'
import { flowStepOf } from '../pages/jobs/apply-flow.js'

const APP = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const require = createRequire(path.join(APP, 'package.json'))
const compiler = require('@vue/compiler-sfc'), vue = require('vue')
const read = (p) => fs.readFileSync(path.join(APP, p), 'utf8').replace(/\r\n/g, '\n')
const JAVA = '../RuoYi-Vue/ruoyi-kangaroo/src/main/java/com/ruoyi/kangaroo/'
const FILE = 'pages/jobs/contract.vue'

/** 按平台处理 // #ifdef / #ifndef / #endif（uni-app 条件编译），只认单个平台名 */
function preprocess(code, platform) {
  const keep = []
  const out = []
  for (const line of code.split('\n')) {
    const m = /^\s*\/\/\s*#(ifdef|ifndef|endif)\b\s*([\w-]*)/.exec(line)
    if (m) {
      if (m[1] === 'endif') keep.pop()
      else keep.push(m[1] === 'ifdef' ? m[2] === platform : m[2] !== platform)
      continue
    }
    if (keep.every(Boolean)) out.push(line)
  }
  return out.join('\n')
}

// 把 script setup 放进沙箱跑：import 进来的名字默认都是挂起不返回的桩，stubs(calls) 按用例覆盖；默认按小程序编译
function load(stubs = () => ({}), platform = 'MP-WEIXIN') {
  const parsed = compiler.parse(read(FILE), { filename: 'contract.vue' })
  assert.equal(parsed.errors.length, 0)
  const source = preprocess(parsed.descriptor.scriptSetup.content, platform)
  const ast = compiler.babelParse(source, { sourceType: 'module' })
  const body = ast.program.body.filter(n => n.type !== 'ImportDeclaration').map(n => source.slice(n.start, n.end)).join('\n')
  const sandbox = { console, Date, Math, Promise, JSON, setTimeout, clearTimeout, String, Number }
  for (const n of ast.program.body.filter(n => n.type === 'ImportDeclaration')) for (const s of n.specifiers) sandbox[s.local.name] = () => new Promise(() => {})
  const calls = { toast: [], alert: [], contract: 0, sign: [], save: [] }
  Object.assign(sandbox, {
    ref: vue.ref, computed: vue.computed, watch: vue.watch, onBeforeUnmount() {}, useScreen: () => vue.ref(1), R: {}, flowStepOf,
    errText: (e, dft) => (e && e.message) || dft, todayCn: () => '2026-10-15', shiftDate: (d) => d, releaseArrivalImages() {},
    toast: (m) => { calls.toast.push(m) },
    alert: (title, msg) => { calls.alert.push([title, msg]); return Promise.resolve() }
  }, stubs(calls))
  vm.createContext(sandbox)
  const scope = vue.effectScope()
  scope.run(() => vm.runInContext(body, sandbox, { filename: FILE + ':script-setup' }))
  return { calls, run: code => vm.runInContext(code, sandbox), stop: () => scope.stop() }
}
const plain = (v) => JSON.parse(JSON.stringify(v))
const apiError = (message, code) => Object.assign(new Error(message), { code })

test('当地活动使用岗位地区，正确编码；没有地区时不跳到用户当前城市或全部活动', () => {
  const destinations = []
  const h = load(() => ({ R: { activity: '/pages/community/activity' }, go: url => destinations.push(url) }))
  h.run(`c.value = { activityCity: '平潭', city: '福建平潭岛' }; openLocalActivities()`)
  assert.equal(destinations.pop(), '/pages/community/activity?city=' + encodeURIComponent('平潭'))
  h.run(`c.value = { city: '大理' }; openLocalActivities()`)
  assert.equal(destinations.pop(), '/pages/community/activity?city=' + encodeURIComponent('大理'))
  h.run(`c.value = { city: '  ' }; openLocalActivities()`)
  assert.equal(destinations.length, 0)
  assert.match(h.calls.toast.pop(), /岗位地区暂未填写/)
  h.stop()
})

test('已签署用户点查看责任书先看条款，继续后才到订票；返回不落到重复签署屏', async () => {
  const h = load(calls => ({
    useScreen: (_, hooks) => { calls.enter = hooks.onLoad; return vue.ref(1) }, ensureSession: async () => {},
    apiApplicationDetail: async () => ({ data: { jobId: 7, jobType: 'volunteer' } }),
    apiContract: async () => ({ data: { sign: { signerName:'小林' }, terms:[], arrival:{}, status:'contract_signed' } })
  }))
  await h.calls.enter({ appId:'81', view:'terms' }); assert.equal(h.run('s.value'),1)
  await h.run('toSign()'); assert.equal(h.run('s.value'),3)
  h.run('onBack()'); assert.equal(h.run('s.value'),1); assert.equal(h.calls.sign.length,0); h.stop()
})

test('旧的已签署到店链接仍续填，未签署不能通过s=3/4/5跳过责任书', async () => {
  let signed = false
  const h = load(calls => ({
    useScreen: (_, hooks) => { calls.enter = hooks.onLoad; return vue.ref(1) }, ensureSession: async () => {},
    apiApplicationDetail: async () => ({ data: { jobType:'volunteer' } }),
    apiContract: async () => ({ data: { sign: signed ? { signerName:'小林' } : null, terms:[], arrival:{}, status:signed?'contract_signed':'store_confirmed' } })
  }))
  for (const n of [2,3,4,5]) { h.run('s.value='+n); await h.calls.enter({appId:'81'}); assert.equal(h.run('s.value'),1) }
  signed=true; await h.calls.enter({appId:'81'}); assert.equal(h.run('s.value'),3)
  for (const n of [4,5]) { h.run('s.value='+n); await h.calls.enter({appId:'81'}); assert.equal(h.run('s.value'),n) }; h.stop()
})

test('到店确认只读真实状态：等待门店确认，刷新后七步完成且显示门店确认时间', async () => {
  let freshStatus = 'contract_signed'
  const h = load(calls => ({ apiContract: async () => { calls.contract++; return {data:{status:freshStatus,sign:{signerName:'小林'},terms:[],arrival:{},onboardTime:freshStatus==='onboarded'?'2026-11-09 14:30:00':null}} } }))
  h.run("appId.value=81; c.value={status:'store_confirmed', sign:null}; openArrival()")
  assert.equal(h.run('s.value'),1); assert.match(h.calls.toast.pop(),/先完成责任书/)
  await h.run('load()'); h.run('openArrival()')
  assert.equal(h.run('s.value'),5); assert.equal(h.run('arrived.value'),false); assert.equal(h.run('flowCurrent.value'),5)
  assert.equal(h.run('c.value.status'),'contract_signed', '打开页面不能自行确认到店')
  freshStatus='onboarded'; await h.run('refreshArrival()')
  assert.equal(h.run('arrived.value'),true); assert.equal(h.run('flowCurrent.value'),8)
  assert.equal(h.run('confirmedArrivalTime.value'),'2026-11-09 14:30:00'); assert.equal(h.run('refreshingArrival.value'),false)
  h.run("c.value={status:'completed',sign:null}; openArrival()")
  assert.equal(h.run('canOpenArrival.value'),true); assert.equal(h.run('arrived.value'),true)
  h.stop()
})

test('历史已到店记录无旧签署详情仍可从第7步查看，线上任务不进入到店流程', async () => {
  const redirects=[]; let online=false
  const h=load(calls=>({useScreen:(_,hooks)=>{calls.enter=hooks.onLoad;return vue.ref(1)},ensureSession:async()=>{},
    apiApplicationDetail:async()=>({data:{jobType:online?'online':'volunteer'}}),
    apiContract:async()=>({data:{status:'onboarded',sign:null,terms:[],arrival:{}}}),R:{jobProgress:'/jobs/progress'},replace:url=>redirects.push(url)}))
  h.run('s.value=5'); await h.calls.enter({appId:'81'}); assert.equal(h.run('s.value'),5)
  online=true; h.run('s.value=5'); await h.calls.enter({appId:'81'}); assert.equal(redirects.pop(),'/jobs/progress?appId=81'); h.stop()
})

test('到店页有报名关联调解，双向确认与报名使用同一条七步进度', () => {
  const source=read(FILE), interview=read('pages/jobs/interview.vue')
  assert.match(source,/s === 5[\s\S]+arrival-dispute[\s\S]+k-order-mediation order-type="application" :order-id="appId"/)
  assert.ok(!source.includes('到店确认后可申请调解'), '待商家确认到店不能阻止已签约用户申请纠纷调解')
  assert.match(interview,/报名进度（共 \{\{ FLOW_STEPS.length \}\} 步）/)
  assert.ok(!interview.includes('const STEP_DONE'))
  assert.match(interview,/R\.jobContract \+ '\?appId=' \+ appId\.value \+ '&s=5'/)
})

test('未签署用户仍须阅读并签署，服务端签署成功后才进入订票', async () => {
  const h = load(calls => ({
    apiContractSign: async (id, payload) => { calls.sign.push({id,payload}); return {data:{status:'contract_signed',sign:{signerName:'小林'},arrival:{}}} }
  }))
  h.run("appId.value=81; s.value=2; c.value={hash:'original',terms:[{title:'条款',desc:'正文'}],sign:null}; name.value='小林'; agreed.value=true")
  await h.run('doSign()'); assert.equal(h.calls.sign.length,0);assert.equal(h.run('s.value'),1)
  h.run('readMax.value=100; s.value=2; agreed.value=false')
  await h.run('doSign()'); assert.equal(h.calls.sign.length,0);assert.equal(h.run('s.value'),2)
  h.run('agreed.value=true'); await h.run('doSign()'); assert.equal(h.calls.sign.length,1);assert.equal(h.run('s.value'),3); h.stop()
})

test('签署时责任书已改字（409）：重新拉条款、阅读进度清零、退回第 1 屏', async (t) => {
  const fresh = { terms: [{ icon: 'badge-check', title: '保险说明', desc: '新条款' }], hash: 'new-hash', version: '2026-10', canSign: true, sign: null, signerDefault: '张三', arrival: {} }
  const h = load(calls => ({
    apiContract: async () => { calls.contract++; return { data: fresh } },
    apiContractSign: async (id, b) => { calls.sign.push(b); throw apiError('责任书内容已更新，请重新阅读后签署', 409) }
  }))
  t.after(h.stop)
  h.run(`c.value = { terms: [{ title: '保险说明', desc: '旧条款' }], hash: 'old-hash', canSign: true, sign: null, arrival: {} }
    readMax.value = 100; s.value = 2; name.value = '张三丰'; agreed.value = true`)
  await h.run('doSign()')
  assert.equal(h.calls.sign.length, 1)
  assert.equal(h.calls.sign[0].hash, 'old-hash', '第一次签署带的是页面上的旧摘要')
  assert.equal(h.calls.contract, 1, '收到 409 后重新拉一遍条款')
  assert.equal(h.run('c.value.hash'), 'new-hash')
  assert.equal(h.run('s.value'), 1, '退回第 1 屏重新阅读')
  assert.equal(h.run('readMax.value'), 0, '阅读进度清零')
  assert.equal(h.run('readPct.value'), 0)
  assert.equal(h.run('agreed.value'), false, '重新勾选同意')
  assert.equal(h.run('name.value'), '张三丰', '已填的签署姓名保留，不被默认姓名覆盖')
  assert.equal(h.run('signing.value'), false, '按钮解锁')
  assert.deepEqual(h.calls.toast, ['责任书内容有更新，请重新往下读完后再签署'])
})

test('其他签署失败照旧只提示，不重新加载、不跳屏', async (t) => {
  for (const [msg, code] of [['门店确认录用后才能签署责任书', 409], ['签署姓名需与报名时填写的姓名一致', 422]]) {
    const h = load(calls => ({
      apiContract: async () => { calls.contract++; return { data: {} } },
      apiContractSign: async () => { throw apiError(msg, code) }
    }))
    t.after(h.stop)
    h.run(`c.value = { terms: [{title:'条款',desc:'正文'}], hash: 'h', canSign: true, sign: null, arrival: {} }; readMax.value = 100; s.value = 2; name.value = '张三'; agreed.value = true`)
    await h.run('doSign()')
    assert.equal(h.calls.contract, 0)
    assert.equal(h.run('s.value'), 2)
    assert.equal(h.run('readMax.value'), 100)
    assert.equal(h.run('agreed.value'), true)
    assert.deepEqual(h.calls.toast, [msg])
  }
})

test('到店信息没有接站这一行，保存时不提交 needPickup', async (t) => {
  const h = load(calls => ({
    // 老数据里存过 need_pickup='1'，服务端仍原样返回；页面不再读它
    // 2026-11-09：签署责任书后才能填到店信息，夹具补上已签署（已保存过的旧日期原样再存可以）
    apiContract: async () => ({ data: { terms: [], status: 'contract_signed', sign: { signedTime: '2026-10-19 10:00:00' }, arrival: { arriveDate: '2026-10-20', arriveTime: '15:30', transport: '火车', transportNo: 'D8888', needPickup: '1', tickets: '', note: '行李多' } } }),
    apiSaveArrival: async (id, b) => { calls.save.push(plain(b)); return { data: { terms: [], arrival: {} }, msg: '已保存' } }
  }))
  t.after(h.stop)
  await h.run('load()')
  assert.equal(h.run(`'needPickup' in arr.value`), false)
  assert.deepEqual(plain(h.run('arrival.value')).map(r => r.label), ['到达日期', '到达时间', '交通方式', '车次 / 航班'])
  await h.run(`editArrival({ key: 'pickup' })`)
  assert.equal(h.run(`'needPickup' in arr.value`), false, '没有切换开关的分支了')
  await h.run('saveArrival()')
  assert.deepEqual(h.calls.save, [{ arriveDate: '2026-10-20', arriveTime: '15:30', transport: '火车', transportNo: 'D8888', tickets: [], note: '行李多' }])
  assert.equal(h.run('s.value'), 4)
})

test('到店信息：没签责任书不能存；到达日期早于今天不能存（已保存过的旧日期原样再存可以）', async (t) => {
  const h = load(calls => ({ apiSaveArrival: async (id, b) => { calls.save.push(plain(b)); return { data: { terms: [], arrival: {} }, msg: '已保存' } } }))
  t.after(h.stop)
  h.run(`c.value = { terms: [], status: 'store_confirmed', sign: null, arrival: {} }; arr.value.arriveDate = '2026-10-20'`)
  await h.run('saveArrival()')
  assert.deepEqual(h.calls.save, [])
  assert.deepEqual(h.calls.toast, ['请先签署责任书，再填写到店信息'])
  // 今天按桩是 2026-10-15
  h.run(`c.value = { terms: [], status: 'contract_signed', sign: { signedTime: '2026-10-11 10:00:00' }, arrival: { arriveDate: '2026-10-12' } }; arr.value.arriveDate = '2026-10-13'`)
  await h.run('saveArrival()')
  assert.deepEqual(h.calls.save, [])
  assert.equal(h.calls.toast[1], '到达日期不能早于今天，请重新选择')
  h.run(`arr.value.arriveDate = '2026-10-12'`)
  await h.run('saveArrival()')
  assert.equal(h.calls.save.length, 1, '已保存过的旧日期原样再存可以')
})

test('没有投保记录时，保障详情如实说明，不再劝人自行购买', async (t) => {
  const h = load()
  t.after(h.stop)
  h.run(`c.value = { terms: [], arrival: {}, sign: null, insurance: null }`)
  h.run('showPolicy()')
  assert.deepEqual(h.calls.alert, [['保障详情', '门店确认录用后可为你申请投保，目前还没有投保记录；是否已投保以本页「保单信息」为准。']])
  // 有记录时照旧按保单说
  h.run(`c.value = { terms: [], arrival: {}, sign: null, insurance: { planName: '用工意外险', policyNo: 'POL-1', policyIssued: true } }`)
  h.run('showPolicy()')
  assert.match(h.calls.alert[1][1], /^方案：用工意外险\n保单号：POL-1\n以保险公司出具的保单为准。$/)
})

test('服务端不给坐标（岗位地址不是门店地址、岗位没选点）：只写「工作地点」，点了提示地址，不打开地图', async (t) => {
  const opened = []
  const h = load(() => ({ uni: { openLocation: (o) => opened.push(o) } }))
  t.after(h.stop)
  h.run(`c.value = { terms: [], arrival: {}, sign: null, storeName: '平潭袋鼠小院', address: '福建省平潭县南舍庄园', latitude: null, longitude: null }`)
  await h.run('openMap()')
  assert.deepEqual(h.calls.toast, ['地址：福建省平潭县南舍庄园'])
  assert.equal(opened.length, 0)
  h.run(`c.value = { terms: [], arrival: {}, sign: null, storeName: '平潭袋鼠小院', address: '福建省平潭县南舍庄园', latitude: 25.512345, longitude: 119.801234 }`)
  await h.run('openMap()')
  assert.deepEqual(plain(opened), [{ latitude: 25.512345, longitude: 119.801234, name: '平潭袋鼠小院', address: '福建省平潭县南舍庄园' }])
  // 卡片文字跟着有没有坐标走：没坐标时不再写「点此打开地图」
  assert.ok(read(FILE).includes(`(c.latitude ? mapTip : '工作地点：') + c.address`))
  assert.equal(h.run('mapTip'), '点此打开地图：')
})

test('网页版没有地图 key：有坐标时点了复制地址、提示「地址已复制」，不打开地图；卡片写「点此复制地址」', async (t) => {
  const opened = [], copied = []
  const h = load(() => ({ uni: { openLocation: (o) => opened.push(o), setClipboardData: (o) => { copied.push(o); o.success() } } }), 'H5')
  t.after(h.stop)
  assert.equal(h.run('mapTip'), '点此复制地址：')
  h.run(`c.value = { terms: [], arrival: {}, sign: null, storeName: '平潭袋鼠小院', address: '福建省平潭县南舍庄园', latitude: 25.512345, longitude: 119.801234 }`)
  await h.run('openMap()')
  assert.equal(opened.length, 0)
  assert.deepEqual(copied.map(o => [o.data, o.showToast]), [['福建省平潭县南舍庄园', false]])
  assert.deepEqual(h.calls.toast, ['地址已复制'])
  // 复制失败时把地址直接提示出来
  copied.length = 0
  h.run(`uni.setClipboardData = (o) => { o.fail({}) }`)
  await h.run('openMap()')
  assert.deepEqual(h.calls.toast, ['地址已复制', '地址：福建省平潭县南舍庄园'])
  // 没坐标仍和小程序一样只提示地址
  h.run(`c.value = { terms: [], arrival: {}, sign: null, storeName: '平潭袋鼠小院', address: '福建省平潭县南舍庄园', latitude: null, longitude: null }`)
  await h.run('openMap()')
  assert.equal(h.calls.toast[2], '地址：福建省平潭县南舍庄园')
  assert.equal(opened.length, 0)
})

test('页面源码：接站、自行购买都已去掉，模板可编译', () => {
  const src = read(FILE)
  for (const word of ['needPickup', '接站', '自行购买', 'k-switch', 'class="pickup"', '.pickup', 'item.arrow']) assert.ok(!src.includes(word), '还留着：' + word)
  const { descriptor, errors } = compiler.parse(src, { filename: 'contract.vue' })
  assert.equal(errors.length, 0)
  const script = compiler.compileScript(descriptor, { id: 'contract' })
  const tpl = compiler.compileTemplate({ source: descriptor.template.content, filename: 'contract.vue', id: 'contract', compilerOptions: { bindingMetadata: script.bindings } })
  assert.deepEqual(tpl.errors, [])
  // 到店信息卡片去掉提示后，最后一行不再留下边框
  assert.match(descriptor.styles[0].content, /\.arrival>\.arrival-row:last-child \{ border-bottom: 0; \}/)
})

test('后端口径：品牌改名后的责任书 2026-11、保险说明不劝买；到店信息不再读写接站', () => {
  const hub = read(JAVA + 'ext/user/KgUserHubService.java')
  assert.match(hub, /static final String CONTRACT_VERSION = "2026-11";/)
  const terms = hub.slice(hub.indexOf('static final String[][] TERMS = {'), hub.indexOf('} };', hub.indexOf('static final String[][] TERMS = {')))
  assert.ok(!terms.includes('自行购买'))
  assert.match(terms, /"保险说明", "门店确认录用后可为你申请投保，是否已投保以本页「保单信息」为准；未显示保单号前，不代表已有保障。"/)
  // 页面按这句话认出「责任书改过字」并重新加载，两边要对得上
  assert.match(hub, /throw new ServiceException\("责任书内容已更新，请重新阅读后签署", 409\);/)
  assert.match(read(FILE), /e\.code === 409 && \/内容已更新\/\.test\(e\.message \|\| ''\)/)
  // 旧版文字留在注释里备查（已签记录的摘要靠它重算）
  assert.match(hub, /\/\/ {3}2026-09 保险说明：门店确认录用后可为你申请投保，是否已投保以本页「保单信息」为准；未显示保单号前，建议自行购买意外险。/)
  const save = hub.slice(hub.indexOf('public Map<String, Object> saveArrival('), hub.indexOf('static boolean sameArrival('))
  assert.ok(!save.includes('get("needPickup")'), '不再读 needPickup')
  assert.ok(!/need_pickup[ ,=]|:pk/.test(save.replace(/\/\/.*$/gm, '')), '不再写 need_pickup')
  assert.ok(!save.includes('（需要接站）'))
  const module = read(JAVA + 'ext/user/KgUserModule.java')
  assert.ok(!module.includes('ExtField.of("needPickup"'), '后台「到店信息」不再有「需要接站」一列')
})
