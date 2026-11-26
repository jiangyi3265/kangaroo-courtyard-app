// 2026-11-03 主人：「简化」用户端这一组（G-user-side）的回归，node --test 直接跑，不构建、不发请求：
//   U1 旅居下单 booking.vue：房型 ≤5 个不出筛选条；换月只用左右箭头（月份菜单去掉）；房态日历移除低价日标识与推荐提示
//      pay.vue：入住人 / 手机号是页面输入框、到店时间按钮组、人数加减号；预订须知读完后由本人勾选，新须知要重新确认
//   U2 resume.vue：添加 / 修改经历在底部一块小表单里一次填完；删除是右侧「×」+ 一次确认；没有 4 连弹和「修改 / 删除」菜单
//   U3 contract.vue：签署姓名、证件后四位、交通方式、车次、备注全在页面里填 / 选
//   U4 profile/index.vue：昵称、自我介绍在「账号资料」区输入 + 保存；实名认证是页面内折叠区（两个输入框 + 一个按钮）；注销多重确认不动
//   U5 community/publish.vue：找搭子分类可手填或选择；同行性别、伙伴说使用按钮组
//   U6 jobs/interview.vue：改期时段是页面内胶囊 + 底部「确认改到 …」；没时段写明并给「联系商家」
//   U7 jobs/apply.vue：天数选「其他」在胶囊下出数字框
// 页面跑的是真实的 script setup，接口按用例换成桩（导入的名字默认都是挂起不返回的函数）
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'
import test from 'node:test'
import assert from 'node:assert/strict'
import * as F from '../pages/jobs/apply-flow.js'
import { readingClock, AGREEMENT_READ_SECONDS } from '../common/agreement-progress.js'

const APP = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const require = createRequire(path.join(APP, 'package.json'))
const compiler = require('@vue/compiler-sfc'), vue = require('vue')
const read = (rel) => fs.readFileSync(path.join(APP, rel), 'utf8').replace(/\r\n/g, '\n')
const sfc = (rel) => compiler.parse(read(rel), { filename: rel }).descriptor
const css = (d) => d.styles.map(s => s.content).join('\n')
const flush = () => new Promise(resolve => setImmediate(resolve))
// 沙箱里造的对象和这里的 Object 不是同一个原型，deepEqual 前先转成普通对象
const plain = (v) => JSON.parse(JSON.stringify(v))

/** 按平台处理 // #ifdef / #ifndef / #endif（uni-app 条件编译） */
function preprocess(code, platform) {
  const keep = [], out = []
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
/** 在沙箱里跑页面的 script setup：导入一律先给永远不返回的函数，再用 stubs 覆盖用得到的那几个 */
function runSetup(rel, stubs) {
  const d = sfc(rel)
  const source = preprocess(d.scriptSetup.content, 'MP-WEIXIN')
  const ast = compiler.babelParse(source, { sourceType: 'module' })
  const body = ast.program.body.filter(n => n.type !== 'ImportDeclaration').map(n => source.slice(n.start, n.end)).join('\n')
  const sandbox = { console, Date, Math, Promise, JSON, String, Number, Object, Array, RegExp, setTimeout, clearTimeout, setInterval: () => 1, clearInterval() {} }
  for (const n of ast.program.body.filter(n => n.type === 'ImportDeclaration')) for (const s of n.specifiers) sandbox[s.local.name] = () => new Promise(() => {})
  Object.assign(sandbox, {
    ref: vue.ref, computed: vue.computed, watch: vue.watch, reactive: vue.reactive, nextTick: vue.nextTick,
    onShow() {}, onHide() {}, onUnload() {}, onUnmounted() {}, onLoad() {}, onBeforeUnmount() {}, onShareAppMessage() {}, onPageScroll() {}, getCurrentInstance: () => null
  }, stubs)
  vm.createContext(sandbox)
  const scope = vue.effectScope()
  scope.run(() => vm.runInContext(body, sandbox, { filename: rel + ':script-setup' }))
  return { run: code => vm.runInContext(code, sandbox), json: code => JSON.parse(vm.runInContext('JSON.stringify(' + code + ')', sandbox)), stop: () => scope.stop(), d }
}
const compiles = (d, name) => {
  const script = compiler.compileScript(d, { id: name })
  const tpl = compiler.compileTemplate({ source: d.template.content, filename: name, id: name, compilerOptions: { bindingMetadata: script.bindings } })
  assert.deepEqual(tpl.errors, [], name)
}
const FILES = ['pages/stays/booking.vue', 'pages/stays/pay.vue', 'pages/profile/resume.vue', 'pages/jobs/contract.vue', 'pages/profile/index.vue', 'pages/community/publish.vue', 'pages/jobs/interview.vue', 'pages/jobs/apply.vue']

test('这一组 8 个页面都能编译；改动处都注明「2026-11-03 主人：简化」', () => {
  for (const rel of FILES) {
    const d = sfc(rel)
    compiles(d, path.basename(rel))
    assert.match(read(rel), /2026-11-03 主人：简化/, rel)
  }
})

// ---------------------------------------------------------------- U1 booking.vue
test('U1 房型：≤5 个房型不出筛选条；换月只有左右箭头，月份文字不再弹菜单', () => {
  const d = sfc('pages/stays/booking.vue')
  const t = d.template.content, js = d.scriptSetup.content
  assert.match(t, /<view v-if="allRoomTypes\.length > 5" class="filters">/)
  assert.match(t, /<view class="month-arrow" @click="shiftMonth\(-1\)">[\s\S]*?<text>\{\{ cal\.month \|\| '' \}\}<\/text><view class="month-arrow" @click="shiftMonth\(1\)">/)
  assert.ok(!/pickMonth/.test(t + js), '月份菜单去掉')
})

test('U1 日历取消低价标识与推荐请求，逐晚价格和早鸟状态保留', async (t) => {
  const calls = { quote: 0, recommend: 0 }
  const h = runSetup('pages/stays/booking.vue', {
    useScreen: () => vue.ref(2), stayState: { checkIn: '2026-11-20', checkOut: '2026-11-27', guests: 2 },
    normalizeDates() {}, saveStayState() {}, nightsBetween: () => 7, MIN_NIGHTS: 7,
    dayText: v => v, weekText: () => '', yuan: fen => String(fen / 100), errText: (e, d) => d,
    apiStayQuote: async () => { calls.quote++; return { data: { bookable: true, roomFen: 70000 } } },
    apiStayRecommend: async () => { calls.recommend++; return { data: {} } }
  })
  t.after(h.stop)
  h.run("selRoomId.value = 3; cal.value = { days: [{ date: '2026-11-28', day: 28, status: 'available', low: true, priceFen: 8800 }, { date: '2026-11-29', day: 29, status: 'available', promo: true, priceFen: 6000 }] }")
  const cells = h.json('calendar.value').filter(d => d.ymd)
  assert.equal(cells[0].note, ''); assert.equal(cells[0].price, '88')
  assert.equal(cells[1].note, '早鸟'); assert.equal(cells[1].price, '60')
  await h.run('requote()')
  assert.equal(calls.quote, 1); assert.equal(calls.recommend, 0)
  assert.equal(h.run('quoteLoading.value'), false)
  assert.doesNotMatch(sfc('pages/stays/booking.vue').template.content, /低价日|省钱提示|rec-tip/)
})

// ---------------------------------------------------------------- U1 pay.vue
test('U1 确认订单：入住人 / 手机号是页面输入框、到店时间按钮组、人数加减号；整屏没有系统输入框 / 菜单', async (t) => {
  const d = sfc('pages/stays/pay.vue')
  const tpl = d.template.content, js = d.scriptSetup.content
  const s1 = tpl.slice(tpl.indexOf('<!-- 1 入住人信息 -->'), tpl.indexOf('<!-- 2 确认订单 -->'))
  assert.match(s1, /<input v-model="form\.guestName" class="kv__field" maxlength="20"[^>]*@blur="rememberGuest"/)
  assert.match(s1, /<input v-model="form\.guestPhone" class="kv__field" type="number" maxlength="11"[^>]*@blur="rememberGuest"/)
  assert.match(s1, /v-for="opt in arriveOptions"[^>]*class="arrive-pill" :class="\{ on: form\.arriveTime === opt\.value \}"[^>]*@click="form\.arriveTime = opt\.value"/)
  assert.match(s1, /@click="changeGuests\(-1\)"[\s\S]*?<text class="stepper__num">\{\{ guests \}\}人<\/text>[\s\S]*?@click="changeGuests\(1\)"/)
  assert.ok(!/prompt|sheet\(|editRow|pickGuests|guestRows/.test(js), '不再引入 prompt / sheet，老的弹窗函数去掉')
  const calls = { quote: 0, toast: [] }
  const h = runSetup('pages/stays/pay.vue', {
    useScreen: () => vue.ref(1), absUrl: (v) => v, toast: (m) => calls.toast.push(m), errText: (e, d) => d, yuan: (fen) => String(fen / 100),
    pad2: (n) => (n < 10 ? '0' + n : '' + n), todayCn: () => '2026-11-03', experience: { account: { id: 1 } }, ensureSession: async () => {},
    stayPayEntry: () => ({ valid: true, guests: 2 }), apiStayQuote: async () => { calls.quote++; return { data: { stay: {}, bookable: true, payFen: 1 } } },
    uni: { getStorageSync: () => ({}), setStorageSync() {} }, R: {}
  })
  t.after(h.stop)
  h.run("q.value = { stay: { checkinTime: '14:00', capacity: 2 }, bookable: true, policy: {}, agreement: {}, addons: [] }")
  assert.deepEqual(h.json('arriveOptions.value.map(o => [o.value, o.label])'), [['', '14:00 前'], ['14:00后', '14:00 后'], ['16:00后', '16:00 后'], ['18:00后', '18:00 后'], ['20:00后', '20:00 后']])
  assert.equal(h.run('guestMax.value'), 2)
  h.run('guests.value = 2')
  h.run('changeGuests(1)')
  assert.equal(h.run('guests.value'), 2, '到上限不再加')
  h.run('changeGuests(-1)')
  assert.equal(h.run('guests.value'), 1)
  h.run('changeGuests(-1)')
  assert.equal(h.run('guests.value'), 1, '最少 1 人')
  assert.equal(calls.quote, 1, '人数变了重新报价')
  await flush()
  // 「确认并下一步」在页面里校验姓名、手机号（原来在弹窗里校验）
  h.run("form.value = { guestName: ' 张三 ', guestPhone: '123', arriveTime: '' }")
  assert.equal(h.run('quoteReady.value'), true)
  await h.run('next()')
  assert.deepEqual(calls.toast, ['请填写正确的手机号'])
  assert.equal(h.run('form.value.guestName'), '张三', '姓名去掉首尾空格')
})

test('U1 预订须知：读完才能勾选，勾选可取消，须知更新后重新确认', async t => {
  const d = sfc('pages/stays/pay.vue')
  assert.match(d.template.content, /<k-agreement-reader[^>]+@read="onNoticeRead"/)
  assert.match(d.template.content, /class="agree" @click="onAgreeTap"/)
  const messages = []
  const h = runSetup('pages/stays/pay.vue', {
    useScreen: () => vue.ref(2), toast: msg => messages.push(msg), todayCn: () => '2026-11-03'
  })
  t.after(h.stop)
  await h.run('onAgreeTap()')
  assert.equal(h.run('agreed.value'), false)
  assert.equal(messages.length, 1)
  h.run('onNoticeRead(true)')
  await h.run('onAgreeTap()')
  assert.equal(h.run('agreed.value'), true)
  await h.run('onAgreeTap()')
  assert.equal(h.run('agreed.value'), false)
  await h.run('onAgreeTap()')
  h.run('onNoticeRead(false)')
  assert.equal(h.run('agreed.value'), false)
})

// ---------------------------------------------------------------- U2 resume.vue
test('U2 经历：底部小表单一次填完（类型按钮组 / 名称 / 门店 · 城市 / 起止日期 / 考核等级）；修改同一块表单；删除「×」+ 一次确认', async (t) => {
  const d = sfc('pages/profile/resume.vue')
  const tpl = d.template.content, js = d.scriptSetup.content
  assert.ok(!/askExp|tapExp|sheet\(|askYmd|alert\(/.test(js), '4 连弹、类型菜单、「修改 / 删除」菜单都去掉')
  assert.match(tpl, /<view v-if="expForm\.open" class="card exp-form k-mt16">/)
  assert.match(tpl, /v-for="k in KIND"[^>]*class="exp-form__pill" :class="\{ on: expForm\.kind === k\[0\] \}"[^>]*@click="expForm\.kind = k\[0\]"/)
  assert.match(tpl, /<input v-model="expForm\.title" maxlength="60"/)
  assert.match(tpl, /<view v-if="expForm\.kind === 'training'" class="exp-form__row">[^\n]*<input v-model="expForm\.level"/)
  assert.equal((tpl.match(/class="exp__x" hover-class="k-press" @click\.stop="removeExp\(e\)"/g) || []).length, 3, '三个页签的卡片都有「×」')
  assert.match(tpl, /<k-button v-else block icon="plus" class="k-mt16" @click="addExp">新增经历<\/k-button>/)
  const calls = { add: [], edit: [], remove: [], confirm: [], toast: [] }
  const h = runSetup('pages/profile/resume.vue', {
    useScreen: () => vue.ref(4), toast: (m) => calls.toast.push(m), errText: (e, d) => d, todayCn: () => '2026-11-03', isYmd: (v) => /^\d{4}-\d{2}-\d{2}$/.test(v || ''),
    confirm: async (title, msg) => { calls.confirm.push([title, msg]); return true }, experience: { account: { id: 1 } }, getSessionRevision: () => 0,
    apiResumeAddExp: async (b) => { calls.add.push(b); return { data: { resume: {}, exps: [{ expId: 9, ...b, source: 'user' }] }, msg: '已添加' } },
    apiResumeEditExp: async (id, b) => { calls.edit.push([id, b]); return { data: { resume: {}, exps: [] } } },
    apiResumeRemoveExp: async (id) => { calls.remove.push(id); return { data: { resume: {}, exps: [] } } }, absUrl: (v) => v, R: {}
  })
  t.after(h.stop)
  h.run('tab.value = 1; addExp()')
  assert.deepEqual(h.json('[expForm.open, expForm.kind, expForm.expId]'), [true, 'parttime', 0], '按当前页签预选类型')
  await h.run('saveExp()')
  assert.deepEqual(calls.toast, ['请填写岗位 / 课程名称'])
  h.run("expForm.title = ' 咖啡店周末店员 '; expForm.place = '喜洲 · 大理'; expForm.startDate = '2026-05-01'; expForm.endDate = '2026-04-01'")
  await h.run('saveExp()')
  assert.equal(calls.toast[1], '结束日期不能早于开始日期')
  h.run("expForm.endDate = ''")
  await h.run('saveExp()')
  await flush()
  assert.deepEqual(plain(calls.add), [{ kind: 'parttime', title: '咖啡店周末店员', place: '喜洲 · 大理', startDate: '2026-05-01', endDate: '', level: '' }])
  assert.equal(h.run('expForm.open'), false, '保存后收起')
  // 修改：同一块表单带入旧值；平台记录的点了不动
  h.run("editExp({ expId: 9, kind: 'training', title: '咖啡课', place: '', startDate: '', endDate: '', level: 'A', source: 'user' })")
  assert.deepEqual(h.json('[expForm.open, expForm.expId, expForm.kind, expForm.level]'), [true, 9, 'training', 'A'])
  await h.run('saveExp()')
  await flush()
  assert.deepEqual(plain(calls.edit), [[9, { kind: 'training', title: '咖啡课', place: '', startDate: '', endDate: '', level: 'A' }]])
  h.run("editExp({ expId: 1, title: '平台', source: 'platform' })")
  assert.equal(h.run('expForm.open'), false)
  // 删除：一次确认
  await h.run("removeExp({ expId: 9, title: '咖啡课', source: 'user' })")
  await flush()
  assert.deepEqual(calls.confirm, [['删除经历', '确认删除「咖啡课」？']])
  assert.deepEqual(calls.remove, [9])
  await h.run("removeExp({ expId: 1, title: '平台', source: 'platform' })")
  assert.equal(calls.remove.length, 1, '平台记录不能删')
})

// ---------------------------------------------------------------- U3 contract.vue
test('U3 签署 / 到店：姓名、后四位、交通方式、车次、备注全在页面里填，一个弹窗都没有', async (t) => {
  const d = sfc('pages/jobs/contract.vue')
  const tpl = d.template.content, js = d.scriptSetup.content
  assert.ok(!/prompt|sheet\(|askTime|editName|editLast4|editNote/.test(js))
  assert.match(tpl, /<input v-if="!c\.sign" v-model="name" class="identity__input" maxlength="16"[^>]*@blur="trimName"/)
  assert.match(tpl, /<input v-if="!c\.sign" v-model="idLast4" class="identity__input" maxlength="4"[^>]*@blur="trimLast4"/)
  assert.match(tpl, /v-for="t in TRANSPORTS"[^>]*class="arrival-pill" :class="\{ on: arr\.transport === t \}"[^>]*@click="arr\.transport = t"/)
  assert.match(tpl, /<input v-model="arr\.transportNo" class="arrival-input" maxlength="32"/)
  assert.match(tpl, /<input v-model="arr\.note" class="note__input" maxlength="200"/)
  assert.match(tpl, /<picker mode="time" :value="arr\.arriveTime \|\| '14:00'"/, '到达时间还是时间滚轮')
  assert.match(css(d), /\.arrival>\.arrival-row:last-child \{ border-bottom: 0; \}/)
  const calls = { sign: [], save: [], toast: [] }
  const h = runSetup('pages/jobs/contract.vue', {
    readingClock, AGREEMENT_READ_SECONDS, experience: { account: { id: 7 } },
    useScreen: () => vue.ref(2), toast: (m) => calls.toast.push(m), errText: (e, d) => d, todayCn: () => '2026-11-03', shiftDate: (v) => v, releaseArrivalImages() {}, R: {},
    apiContractSign: async (id, b) => { calls.sign.push(b); return { data: { terms: [], arrival: {}, sign: { signerName: b.name, idLast4: b.idLast4 } } } },
    apiSaveArrival: async (id, b) => { calls.save.push(b); return { data: { terms: [], arrival: {} }, msg: '已保存' } }
  })
  t.after(h.stop)
  h.run("appId.value = 7; c.value = { terms: [{ text: '条款' }], arrival: {}, sign: null, canSign: true, hash: 'h' }; readMax.value = 100; remaining.value = 0")
  h.run("name.value = ''; agreed.value = true")
  await h.run('doSign()')
  assert.deepEqual(calls.toast, ['请先在上面填写签署姓名'], '没填名字：页面提示，不再弹输入框')
  h.run("name.value = ' 张三 '; idLast4.value = ' 12ab '")
  await h.run('doSign()')
  await flush()
  assert.deepEqual(plain(calls.sign), [{ name: '张三', idLast4: '12AB', agree: true, hash: 'h' }], '离开输入框 / 提交前整理：去空格、后四位大写')
  assert.equal(h.run('s.value'), 3)
  h.run("arr.value = { arriveDate: '2026-11-20', arriveTime: '15:30', transport: '火车', transportNo: ' g1234 ', tickets: [], note: '  行李多  ' }")
  await h.run('saveArrival()')
  assert.deepEqual(calls.save, [])
  assert.equal(calls.toast.at(-1), '请至少上传一张交通凭证图片')
  h.run("arr.value.tickets = ['proof']")
  await h.run('saveArrival()')
  await flush()
  assert.deepEqual(plain(calls.save), [{ arriveDate: '2026-11-20', arriveTime: '15:30', transport: '火车', transportNo: 'g1234', tickets: ['proof'], note: '行李多' }])
})

// ---------------------------------------------------------------- U4 profile/index.vue
test('昵称保存中再改回原名，仍保留可再次保存的输入', async t => {
  let finish
  const h=runSetup('pages/profile/index.vue',{
    useScreen:()=>vue.ref(2),experience:vue.reactive({account:{id:7,nickname:'原名'},mode:'user'}),
    apiSaveMeProfile:()=>new Promise(resolve=>{finish=resolve}),apiAccount:async()=>({data:null}),
    toast(){},absUrl:v=>v,profileIcon:k=>k,R:{}
  })
  t.after(h.stop)
  h.run("me.value={nickname:'原名',intro:''}");await flush()
  h.run("draft.nickname='改名'");const pending=h.run('saveDraft()')
  h.run("draft.nickname='原名'");finish({data:{nickname:'改名',intro:''}})
  await pending;await flush()
  assert.equal(h.run('draft.nickname'),'原名');assert.equal(h.run('draftChanged.value'),true)
})
test('资料页切换账号或已退出页面，保存与昵称刷新回包不会写入新页面', async (t) => {
  let saveReturn, accountReturn, unload
  const accepted=[],toasts=[]
  const experience=vue.reactive({account:{id:7,nickname:'甲'},mode:'user'})
  const h=runSetup('pages/profile/index.vue',{
    useScreen:()=>vue.ref(2), experience, getCurrentPages:()=>[{}], onUnload:fn=>{unload=fn},
    apiSaveMeProfile:()=>new Promise(resolve=>{saveReturn=resolve}),
    apiAccount:()=>new Promise(resolve=>{accountReturn=resolve}),
    acceptAuthenticatedAccount:account=>accepted.push(account.id),
    toast:m=>toasts.push(m), absUrl:v=>v, profileIcon:k=>k, R:{}
  })
  t.after(h.stop)
  const first=h.run("save({nickname:'甲的昵称'})")
  experience.account={id:8,nickname:'乙'}
  h.run("me.value={nickname:'乙'}")
  saveReturn({data:{nickname:'甲的昵称'}})
  await flush()
  accountReturn?.({data:{id:7}})
  await first
  assert.equal(h.run('me.value.nickname'),'乙')
  const second=h.run("save({nickname:'乙的新昵称'})")
  saveReturn({data:{nickname:'乙的新昵称'}})
  await flush();unload();accountReturn({data:{id:8}});await second
  assert.deepEqual(accepted,[]);assert.deepEqual(toasts,[])
})
test('U4 编辑资料：昵称 / 自我介绍在「账号资料」区输入 + 保存；实名认证是页面内折叠区；注销的多重确认不动', async (t) => {
  const d = sfc('pages/profile/index.vue')
  const tpl = d.template.content, js = d.scriptSetup.content
  const s2 = tpl.slice(tpl.indexOf('<!-- 2 个人资料 -->'), tpl.indexOf('<!-- 3 会员信息与成长积分 -->'))
  assert.match(s2, /<form class="acct" @submit="saveDraft">[\s\S]*?<input [^>]*type="nickname" name="nickname"[^>]*maxlength="16"/)
  assert.match(s2, /<button [^>]*form-type="submit"[^>]*:disabled="busy"/)
  assert.match(s2, /<view class="frow" hover-class="k-press" @click="toggleReal">/)
  assert.match(s2, /<view v-if="realOpen" class="real">[\s\S]*?<input v-model="realForm\.name" maxlength="20"[\s\S]*?<input v-model="realForm\.idNo" type="idcard" maxlength="18"[\s\S]*?@click="submitRealName"/)
  assert.ok(!/editIntro|prompt\('昵称'|prompt\('自我介绍'|prompt\('实名认证'/.test(js), '昵称 / 自我介绍 / 实名的系统输入框去掉')
  assert.match(js, /const reason = await prompt\('注销原因（选填）'/, '注销的多重确认保留')
  assert.match(js, /const word = await prompt\('最后确认'/)
  const calls = { save: [], real: [], toast: [] }
  const h = runSetup('pages/profile/index.vue', {
    useScreen: () => vue.ref(2), toast: (m) => calls.toast.push(m), errText: (e, d) => d, absUrl: (v) => v, profileIcon: (k) => k, R: {},
    experience: vue.reactive({ account: { id: 7, nickname: '小院同学' }, mode: 'user' }), getCurrentPages: () => [{}],
    apiSaveMeProfile: async (p) => { calls.save.push(p); return { data: { nickname: p.nickname || '小院同学', intro: p.intro || '', realNameEnabled: true, realNameVerified: false, realNameLabel: '未认证' } } },
    apiAccount: async () => ({ data: null }), acceptAuthenticatedAccount() {},
    apiMeRealName: async (name, idNo) => { calls.real.push([name, idNo]); return { data: { message: '认证已通过' } } },
    apiMeProfile: async () => ({ data: { nickname: '小院同学', intro: '', realNameEnabled: true, realNameVerified: true, realNameLabel: '已认证' } })
  })
  t.after(h.stop)
  h.run("me.value = { nickname: '小院同学', intro: '爱爬山', realNameEnabled: true, realNameVerified: false, realNameLabel: '未认证' }")
  await flush()
  assert.deepEqual(h.json('[draft.nickname, draft.intro, draftChanged.value]'), ['小院同学', '爱爬山', false], '资料读回来填进输入框；没改时不能点保存')
  h.run("draft.nickname = ''")
  await h.run('saveDraft()')
  assert.deepEqual(calls.toast, ['昵称为 1–16 个字'])
  await h.run("saveDraft({detail:{value:{nickname:' 星辰 '}}})")
  await flush()
  assert.deepEqual(plain(calls.save), [{ nickname: '星辰' }], '只传改了的项')
  // 实名认证：页面内两个输入框 + 一个按钮，先在页面校验
  assert.equal(h.run('realOpen.value'), false)
  h.run('toggleReal()')
  assert.equal(h.run('realOpen.value'), true)
  h.run("realForm.name = '张三'; realForm.idNo = '123'")
  await h.run('submitRealName()')
  assert.equal(calls.toast.at(-1), '请填写 18 位身份证号')
  h.run("realForm.idNo = '11010119900101123x'")
  await h.run('submitRealName()')
  await flush()
  assert.deepEqual(calls.real, [['张三', '11010119900101123X']])
  // 设置屏「账号与安全 · 实名认证」：转到编辑资料屏并展开折叠区
  h.run('s.value = 4; realOpen.value = false; realName()')
  assert.deepEqual(h.json('[s.value, realOpen.value]'), [2, true])
})

// ---------------------------------------------------------------- U5 community/publish.vue
test('U5 发布页：找搭子可选或自填分类，补充信息保留性别和伙伴说，移除同行天数', () => {
  const d = sfc('pages/community/publish.vue')
  const tpl = d.template.content, js = d.scriptSetup.content
  const extra = tpl.slice(tpl.indexOf('<view class="fold extra">'), tpl.indexOf('<view class="publish-history">'))
  assert.equal((extra.match(/class="publish-opt"/g) || []).length, 2)
  assert.doesNotMatch(tpl, /wish-publish-link|发布心愿互助|<text>分类<\/text>|<text>同行天数<\/text>/)
  assert.match(tpl, /v-if="type === '找搭子'" class="fold category-input">[\s\S]*?<input v-model="categoryText" maxlength="12"/)
  assert.match(tpl, /v-for="label in BUDDY_CATS\.slice\(1\)"[^>]*@click="categoryText = categoryText === label \? '' : label"/)
  assert.doesNotMatch(js, /buddyDays|BUDDY_DAY/)
  assert.ok(!/pickBuddyCat|pickBuddyDays|pickGenderLimit|pickTone/.test(js), '四个弹菜单的函数去掉')
  assert.match(js, /label: '结束时间', date: 'endDate', time: 'endTime'/)
  assert.match(css(d), /\.opt-pill \{[^}]*min-height: 44px;/)
})

// ---------------------------------------------------------------- U6 jobs/interview.vue
test('U6 改期：时段是页面内胶囊，点一个底部出「确认改到 …」；没时段写明并给「联系商家」（原来弹菜单 + 时段菜单 + 确认框）', async (t) => {
  const d = sfc('pages/jobs/interview.vue')
  const tpl = d.template.content, js = d.scriptSetup.content
  assert.match(tpl, /<view v-if="slotPanel" class="card slot-panel">/)
  assert.match(tpl, /v-for="x in slots" :key="x\.slotId" class="slot-pill" :class="\{ on: slotPick === x\.slotId \}"[^>]*@click="slotPick = x\.slotId"/)
  assert.match(tpl, /<view v-if="slotPick" class="slot-panel__confirm">[^\n]*:label="rescheduling \? '提交中…' : '确认改到 ' \+ fmtSlot\(pickedSlot\.startTime\)" @click="confirmReschedule"/)
  assert.match(tpl, /门店还没有放出其他面试时段[\s\S]*?<k-button block type="outline" label="联系商家" @click="contactStore" \/>/)
  assert.match(tpl, /<view v-if="canWithdraw" class="withdraw-link" hover-class="k-press" @click="withdraw">/)
  assert.ok(!/sheet\(\['申请改期', '撤回报名'\]\)|title: '暂无可选时段'|title: '申请改期'/.test(js), '改期这条线上的弹窗都去掉')
  assert.equal((js.match(/uni\.showModal\(/g) || []).length, 1, '只剩撤回报名那一次确认（危险操作）')
  assert.ok(!/editNote|placeholderText/.test(js), '备注不再弹系统输入框')
  assert.match(tpl, /<textarea v-if="editingNote" v-model="note" class="note-box__area" maxlength="200"/)
  const calls = { slots: 0, reschedule: [], toast: [], go: [] }
  const h = runSetup('pages/jobs/interview.vue', {
    useScreen: () => vue.ref(1), toast: (m) => calls.toast.push(m), go: (u) => calls.go.push(u), serverTs: () => 0, absUrl: (v) => v, R: { chat: '/chat' },
    experience: { account: {} }, parseTencentMeeting: () => null,
    apiInterviewSlots: async () => { calls.slots++; return { data: calls.slots === 1 ? [] : [{ slotId: 11, startTime: '2026-11-20 10:00:00' }, { slotId: 12, startTime: '2026-11-21 14:30:00' }] } },
    apiRescheduleInterview: async (id, slotId) => { calls.reschedule.push([id, slotId]) },
    apiApplicationDetail: async () => ({ data: null })
  })
  t.after(h.stop)
  h.run("appId.value = 5; detail.value = { status: 'interview_booked', interview: { rescheduleCount: 1, rescheduleLimit: 2 } }")
  assert.equal(h.run('rescheduleText.value'), '申请改期')
  await h.run('reschedule()')
  await flush()
  assert.deepEqual(h.json('[slotPanel.value, slots.value.length, slotsLoading.value]'), [true, 0, false], '没时段：面板里写明')
  h.run('contactStore()')
  assert.deepEqual(calls.go, ['/chat?appId=5'])
  assert.equal(h.run('rescheduleText.value'), '收起时段')
  h.run('reschedule()')
  assert.equal(h.run('slotPanel.value'), false, '再点一下收起')
  await h.run('reschedule()')
  await flush()
  assert.deepEqual(h.json('slots.value.map(x => fmtSlot(x.startTime))'), ['11月20日 10:00', '11月21日 14:30'])
  assert.equal(h.run('rescheduleLeft.value'), 1)
  await h.run('confirmReschedule()')
  assert.deepEqual(calls.reschedule, [], '没选时段不提交')
  h.run('slotPick.value = 12')
  await h.run('confirmReschedule()')
  await flush()
  assert.deepEqual(calls.reschedule, [[5, 12]])
  assert.deepEqual(calls.toast, ['面试已改期'])
  assert.equal(h.run('slotPanel.value'), false)
})

// ---------------------------------------------------------------- U7 jobs/apply.vue
test('U7 预计时长：点「其他天数」在胶囊下出数字框 + 确定（原来弹系统输入框）', async (t) => {
  const d = sfc('pages/jobs/apply.vue')
  const tpl = d.template.content, js = d.scriptSetup.content
  assert.match(tpl, /<view v-if="otherOpen" class="ap-other-box"><input v-model="otherDays" class="ap-other-box__input" type="number" maxlength="3"[^\n]*@confirm="applyOther" \/>[^\n]*@click="applyOther"><text>确定<\/text>/)
  assert.match(tpl, /class="ap-dur" :class="\{ on: days === opt\.days \}" hover-class="k-press-s" @click="pickDays\(opt\.days\)"/)
  assert.ok(!/prompt/.test(js))
  assert.match(css(d), /\.ap-other-box \{[^}]*height: 44px;/)
  const calls = { toast: [] }
  const h = runSetup('pages/jobs/apply.vue', {
    toast: (m) => calls.toast.push(m), todayCn: () => '2026-11-03', absUrl: (v) => v, R: {}, experience: { account: null },
    checkDuration: F.checkDuration, durationOptions: F.durationOptions, durationColumns: F.durationColumns, durationLabel: F.durationLabel, resumeCard: F.resumeCard
  })
  t.after(h.stop)
  h.run("job.value = { minDays: 30 }; days.value = 30")
  assert.equal(h.run('otherOpen.value'), false)
  h.run('askDays()')
  assert.deepEqual(h.json('[otherOpen.value, otherDays.value]'), [true, ''], '不是自定义天数时数字框空着')
  h.run("otherDays.value = '20'; applyOther()")
  assert.deepEqual(calls.toast, ['这个岗位最短要待 30 天'])
  assert.equal(h.run('otherOpen.value'), true, '填错不收起')
  h.run("otherDays.value = '45'; applyOther()")
  assert.deepEqual(h.json('[days.value, otherOpen.value, customDays.value]'), [45, false, true])
  h.run('askDays()')
  assert.equal(h.run('otherDays.value'), '45', '再点开带出已填的天数')
  h.run('pickDays(60)')
  assert.deepEqual(h.json('[days.value, otherOpen.value]'), [60, false], '点常用胶囊也收起数字框')
})

// 常规表单与改期入口采用 44px 热区，紧凑版选项的视觉尺寸另按页面检查。
test('复查：常规控件和原生资料保存按钮保留 44px 热区', () => {
  const heightOf = (d, sel) => {
    const all = '\n' + css(d)
    const at = all.indexOf('\n' + sel + ' {')
    assert.ok(at >= 0, sel + ' 要有样式')
    const body = all.slice(at, all.indexOf('}', at))
    const h = /(?:min-)?height: (\d+)px/.exec(body)
    assert.ok(h, sel + ' 要写高度')
    return Number(h[1])
  }
  const checks = [
    ['pages/stays/pay.vue', ['.stepper__btn', '.kv__field']],
    ['pages/stays/booking.vue', ['.month-arrow']],
    ['pages/profile/resume.vue', ['.exp-form__pill', '.exp-form__pick', '.exp__x']],
    ['pages/jobs/contract.vue', ['.identity__input', '.arrival-pill', '.arrival-input', '.note__input']],
    ['pages/jobs/interview.vue', ['.slot-pill', '.slot-panel__close', '.withdraw-link']],
    ['pages/jobs/apply.vue', ['.ap-other-box']]
  ]
  for (const [file, sels] of checks) {
    const d = sfc(file)
    for (const sel of sels) assert.ok(heightOf(d, sel) >= 44, file + ' ' + sel + ' 高度要 ≥44px')
  }
  // 两个紧凑选项按页面设计显示为 36px，操作绑定在整枚可见胶囊上。
  assert.match(css(sfc('pages/stays/pay.vue')), /\.pay \.arrive-pill \{[^}]*min-height: 36px;/)
  assert.match(css(sfc('pages/community/publish.vue')), /\.opt-pill \{[^}]*min-height: 36px;/)
  const profile = sfc('pages/profile/index.vue').template.content
  assert.match(profile, /<button class="profile-save" form-type="submit"/)
  const rules = [...read('pages/profile/profile-screens.scss').matchAll(/\.prof \.profile-save \{([^}]+)\}/g)]
  const save = rules.at(-1)[1]
  assert.match(save, /min-height: 44px/)
  assert.match(save, /border-width: 4px 0/)
  assert.match(save, /padding-box/)
  assert.match(save, /line-height: 36px/)
})
