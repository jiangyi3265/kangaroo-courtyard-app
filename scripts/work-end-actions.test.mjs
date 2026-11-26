import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import { createRequire } from 'node:module'
const vue = createRequire(import.meta.url)('vue')
import { flowStepOf, flowHint } from '../pages/jobs/apply-flow.js'

const template = readFileSync(new URL('../components/k-work-end/k-work-end.vue', import.meta.url), 'utf8')
const script = template.match(/<script setup>([\s\S]*?)<\/script>/)[1].replace(/^import .*$/gm, '')

function fixture(staff, confirm = true) {
  const commands = []
  const props = { appId: 7, staff }
  const vmContext = vm.createContext({
    defineProps: () => props, defineEmits: () => () => {},
    getMessageScopeKey: () => 'scope-7', getSessionRevision: () => 1, experience: {account:{id:7}},
    onHide() {}, onShow() {}, onScopeDispose() {},
    ref: value => ({ value }), computed: read => ({ get value() { return read() } }), watch: () => {},
    get: async () => ({ data: { revision: 1 } }),
    post: async (url, payload) => { commands.push({ url, ...payload }); return { data: { revision: 2, ended: true } } },
    modal: async () => ({ confirm }), toast: () => {}
  })
  vm.runInContext(script + '\nglobalThis.api = { act, load, state, reason }', vmContext)
  return { ...vmContext.api, commands }
}

function liveWorkEnd() {
  const account = vue.reactive({id:1, store:10}), props = vue.reactive({appId:7,staff:true})
  const events = [], commands = [], dialogs = [], submissions = [], hooks = {}
  const context = vm.createContext({
    ...vue, defineProps: () => props, defineEmits: () => event => events.push(event), experience: {account},
    getMessageScopeKey: () => JSON.stringify([account.id, account.store]), getSessionRevision: () => 1,
    onHide: cb => { hooks.hide=cb }, onShow: cb => { hooks.show=cb }, toast() {},
    get: async () => ({data:{revision:account.id, canRequest:true}}),
    modal: () => new Promise(resolve => dialogs.push(resolve)),
    post: (url,payload) => { commands.push({url,payload}); return new Promise((resolve,reject) => submissions.push({resolve,reject})) }
  })
  const scope = vue.effectScope()
  scope.run(() => vm.runInContext(script + '\nglobalThis.handlers={act,load,state,error,reason,busy}',context))
  return {...context.handlers, account, props, submissions, commands, dialogs, hooks, events, stop: () => scope.stop()}
}

test('离岗确认框等待期间切换账号、门店或销毁组件，都不提交旧申请', async () => {
  for (const change of [h => h.account.id++, h => h.account.store++, h => h.hooks.hide(), h => h.stop()]) {
    const h=liveWorkEnd()
    try {
      await h.load()
      h.reason.value='已交接'
      const action=h.act('request')
      change(h)
      h.dialogs[0]({confirm:true})
      await new Promise(resolve => setImmediate(resolve))
      assert.equal(h.commands.length,0)
      await action
    } finally { h.stop() }
  }
})

test('已提交的离岗请求在切换账户后返回，旧失败不会覆盖新账户的记录', async () => {
  const h=liveWorkEnd()
  try {
    await h.load()
    h.reason.value='已交接'
    const action=h.act('request')
    h.dialogs[0]({confirm:true})
    await new Promise(resolve => setImmediate(resolve))
    h.account.id=2
    await vue.nextTick()
    h.submissions[0].reject(new Error('旧申请失败'))
    await action
    assert.equal(h.error.value,'')
    assert.equal(h.state.value.revision,2)
    assert.deepEqual(h.events,[])
  } finally { h.stop() }
})

test('第八步区分在岗与工作结束，审批后完整点亮', () => {
  assert.equal(flowStepOf('onboarded'), 8)
  assert.equal(flowStepOf('onboarded', '2026-11-20'), 9)
  assert.equal(flowStepOf('completed'), 9)
})

test('义工、商家分别走自己的申请与审批入口，携带所见版本', async () => {
  for (const staff of [true, false]) {
    const f = fixture(staff)
    await f.load()
    f.reason.value = '已沟通'
    await f.act(staff ? 'request' : 'approve')
    assert.equal(f.commands[0].url, staff ? '/app/staff/applications/7/work-end' : '/app/application/7/work-end')
    assert.equal(f.commands[0].revision, 1)
    assert.equal(f.state.value.ended, true)
  }
})
test('消息直接进入对应报名，两端都等到工作结束内容就绪再定位', async () => {
  const nav = []
  const preview = readFileSync(new URL('../common/message-preview.js', import.meta.url),'utf8').replace(/^import .*$/gm,'').replace('export function','function')
  const ctx = vm.createContext({go: route => nav.push(route), uni: {showModal() { throw Error('重复确认') }}})
  vm.runInContext(preview, ctx)
  for (const [file,route] of [['jobs/interview','/pages/jobs/interview?appId=7&focus=workEnd'],['staff/applications','/pages/staff/applications?appId=7&storeId=10&focus=workEnd']]) {
    ctx.showMessagePreview({route})
    assert.equal(nav.at(-1),route)
    const page=readFileSync(new URL('../pages/'+file+'.vue',import.meta.url),'utf8')
    const focus=page.match(/function focusEndRecord\(id\) \{[\s\S]*?\n\}/)[0]
    assert.ok(page.includes('@focus="focusEndRecord"') && page.includes('id="work-end"'))
    const scroll=[], current=vm.createContext({s:{value:2}, detailReady:{value:true},workEndTarget:{value:7},
        focusWorkEnd:{value:true},appId:{value:'7'},showWorkEnd:()=>scroll.push('#work-end'),uni:{pageScrollTo: options=>scroll.push(options.selector)}})
    vm.runInContext(focus,current)
    current.focusEndRecord(8); current.focusEndRecord(7); current.focusEndRecord(7)
    assert.deepEqual(scroll,['#work-end'])
  }
})
test('已签约的行程按填报和到店日期显示订票、准备与到店确认', () => {
  for (const n of [5,6,7]) assert.equal(flowStepOf('contract_signed',null,n),n)
  assert.match(flowHint('contract_signed',6),/到店信息已提交/)
  assert.match(flowHint('contract_signed',7),/到店后联系门店/)
  assert.equal(flowStepOf('onboarded',null,7),8)
  assert.equal(flowStepOf('onboarded','2026-11-01',7),9)
})

test('取消确认或未填写原因不会提交结束申请', async () => {
  const f = fixture(false, false)
  await f.load()
  await f.act('request')
  f.reason.value = '已沟通'
  await f.act('request')
  assert.deepEqual(f.commands, [])
})

test('主理人或商家直接点改期会打开时段选择，没有空档可设置后返回同场面试', async () => {
  const page = readFileSync(new URL('../pages/staff/interviews.vue', import.meta.url), 'utf8')
  const functions = page.slice(page.indexOf('async function addRescheduleSlot'), page.indexOf('// 日程卡片上的'))
  const back = page.slice(page.indexOf('const backSlots ='), page.indexOf('// ---------------- 按角色显隐'))
  const current = { current: true, slotId: 21 }
  const d = { value: { interviewId: 7, storeId: 16, canReschedule: true, slots: [current] } }
  const booked = [], loaded = []
  const ctx = vm.createContext({
    d, selSlot: { value: 21 }, requestedStoreId: {}, s: { value: 2 },
    modal: async () => ({ confirm: true }), sheet: async () => 0, canAt: () => true,
    apiStaffReschedule: async (...args) => { booked.push(args); return { msg: '已改期' } },
    loadDetail: async id => loaded.push(id), loadSchedule: () => {}, once: fn => fn(), toast: () => {}
  })
  vm.runInContext('let rescheduleInterviewId=0, slotsFromLink=false;' + functions + back + '\nglobalThis.handlers = { doReschedule, backSlots }', ctx)
  await ctx.handlers.doReschedule()
  assert.equal(ctx.s.value, 5)
  assert.equal(ctx.requestedStoreId.value, 16)
  await ctx.handlers.backSlots()
  assert.equal(ctx.s.value, 2)
  assert.deepEqual(loaded, [7])
  d.value.slots.push({ slotId: 23, date: '明天', time: '10:00' })
  await ctx.handlers.doReschedule()
  assert.deepEqual(booked, [[7, 23]])
  assert.deepEqual(loaded, [7, 7])
})
