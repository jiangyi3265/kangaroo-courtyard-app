import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import * as vue from 'vue'
import { parse, babelParse } from '@vue/compiler-sfc'

const page = parse(fs.readFileSync(new URL('../pages/stays/order.vue', import.meta.url), 'utf8')).descriptor
const source = page.scriptSetup.content
const code = babelParse(source, {sourceType:'module'}).program.body
  .filter(node => node.type !== 'ImportDeclaration').map(node => source.slice(node.start, node.end)).join('\n')
function harness(api = {}) {
  const context = vm.createContext({...vue, useScreen:() => vue.ref(2), groupChatEnabled:vue.ref(true),
    stayBookingEnabled:vue.ref(false), refreshFeatures:async()=>{}, onShow:()=>{}, onHide:()=>{}, onUnload:()=>{},
    toast:()=>{}, yuan:fen=>(fen/100).toFixed(2), errText:(err,msg)=>err?.message || msg,
    apiStayOrder:async()=>({data:{orderNo:'ST-1',status:'confirmed'}}),
    apiStayRefundPreview:async()=>({data:{allowed:true,refundFen:5000}}), ...api})
  vm.runInContext(code, context)
  const run = expression => vm.runInContext(expression, context)
  run("orderNo='ST-1'; od.value={orderNo,status:'confirmed'}")
  return run
}
function deferred() {
  let resolve
  const promise = new Promise(done=>{resolve=done})
  return {promise,resolve}
}

test('订单读取失败能重试原单；先发的旧查询不会覆盖重试后的状态',async()=>{
  let reads=0
  const slow=deferred()
  const run=harness({apiStayOrder:async()=>{
    reads++
    if(reads===1)throw Error('读取超时')
    return reads===2 ? slow.promise : {data:{orderNo:'ST-1',status:'closed'}}
  }})
  await run('load()')
  assert.match(run('orderLoadError.value'),/读取超时/)
  const pending=run('load()')
  await run('load()')
  slow.resolve({data:{orderNo:'ST-1',status:'confirmed'}})
  await pending
  assert.equal(run('od.value.status'),'closed')
  assert.equal(run('orderLoadError.value'),'')
  assert.match(page.template.content,/重新读取订单/)
})

test('打开退款页只取一次预估金额', async () => {
  let reads=0
  const run=harness({apiStayRefundPreview:async()=>{reads++;return {data:{allowed:true,refundFen:5000}}}})
  await run("view='refund'; load()")
  await vue.nextTick()
  assert.equal(reads,1)
})
test('较旧的试算结果不会覆盖最新金额，失败后可重新读取', async () => {
  let calls=0
  const old=deferred()
  const run=harness({apiStayRefundPreview:async()=>{
    calls++
    if(calls===1)return old.promise
    if(calls===3)throw Error('断网')
    return {data:{allowed:true,refundFen:3000}}
  }})
  run('s.value=3'); await vue.nextTick()
  await run('loadPreview()')
  old.resolve({data:{allowed:true,refundFen:5000}}); await new Promise(resolve=>setImmediate(resolve))
  assert.equal(run('pv.value.refundFen'),3000)
  await run('loadPreview()')
  assert.equal(run('canRefund.value'),false)
  assert.match(run('previewError.value'),/断网/)
  await run('loadPreview()')
  assert.equal(run('canRefund.value'),true)
  assert.match(page.template.content,/重新试算/)
})
test('退款确认期间重新试算后金额变化，不能提交用户没有确认的金额', async () => {
  const dialog=deferred(),sent=[]
  let amount=5000
  const run=harness({confirm:()=>dialog.promise,apiStayRefundPreview:async()=>({data:{allowed:true,refundFen:amount}}),
    apiStayRefund:async (...args)=>{sent.push(args);return {}}})
  run('s.value=3');await vue.nextTick();await new Promise(resolve=>setImmediate(resolve))
  const pending=run("reason.value='行程变动';applyRefund()")
  amount=3000;await run('loadPreview()')
  dialog.resolve(true);await pending
  assert.deepEqual(sent,[])
  await run('applyRefund()')
  assert.deepEqual(sent,[['ST-1','行程变动',3000]])
})
for(const kind of ['cancelFree','cancelPending']){
  test(kind+' 连点只弹一次确认和提交一次，放弃后仍可重新操作',async()=>{
    let dialog=deferred(),prompts=0,cancels=0
    const run=harness({confirm:()=>{prompts++;return dialog.promise},apiStayCancelOrder:async()=>{cancels++}})
    run(kind==='cancelFree' ? 'od.value.canCancelFree=true' : "od.value.status='pending_payment'")
    const action='openLink({'+kind+':true})'
    const one=run(action), two=run(action)
    dialog.resolve(false)
    await Promise.all([one,two])
    assert.equal(prompts,1);assert.equal(cancels,0)
    dialog=deferred()
    const again=run(action), repeat=run(action)
    dialog.resolve(true);await Promise.all([again,repeat])
    assert.equal(prompts,2);assert.equal(cancels,1)
  })
}
