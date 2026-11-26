import test from 'node:test'
import assert from 'node:assert/strict'
import vm from 'node:vm'
import { readFileSync } from 'node:fs'

const src = readFileSync(new URL('../pages/wish/publish.vue', import.meta.url),'utf8')
const body = src.split('<script setup>')[1].split('</script>')[0].replace(/^import .*$/gm, '')
function checkout(stubs = {}) {
  const calls = {paid: [], opened: [], removed: [], prompts: [], notices: []}
  const model = {title:'海边明信片',description:'帮我寄一张手绘的海边明信片',mode:'paid',category:'craft',
    originCity:'平潭',targetCity:'大理',delivery:'express',deadline:'2026-12-06',images:[],cost:'10.00'}
  const saved = {...model,costFen:1000,amountFen:1010,wishId:7,payNo:'original',status:'pending_payment'}
  let key = 0
  const scope = vm.createContext({
    ref:value=>({value}), reactive:x=>x, computed:fn=>({get value(){return fn()}}),
    todayCn:()=>'', shiftDate:()=>'', watch(){}, onLoad(){}, onUnload(){},
    experience:{account:{id:3}}, requestKey:()=>String(++key), model, saved,
    wishPublish:async()=>({data:saved}), removeLocalDraft:(...args)=>calls.removed.push(args),
    payFlow:async no=>{calls.paid.push(no);return {status:'paid'}},
    replace:url=>calls.opened.push(url), go:url=>calls.opened.push(url),
    route:(name,id)=>name+'/'+id, toast:t=>calls.notices.push(t),
    modal:async(...args)=>{calls.prompts.push(args);return {confirm:true}},...stubs
  })
  vm.runInContext(body,scope)
  vm.runInContext("Object.assign(form,model,{agreed:true});rulesRead.value=true;activeDraftId='draft';quote.value={amountFen:1010};step.value=2",scope)
  return {calls,saved,scope,run:s=>vm.runInContext(s,scope)}
}
test('matching order proceeds to payment with the server payment number',async()=>{
  const h=checkout()
  await h.run('submit()')
  assert.deepEqual(h.calls.paid,['original'])
  assert.deepEqual(h.calls.opened,['order/7'])
})
test('recovered wish with a different title or quote never starts payment or deletes the edited draft',async()=>{
  for(const delta of [{title:'上次的标题'},{amountFen:5000}]){
    const h=checkout()
    Object.assign(h.saved,delta)
    await h.run('submit()')
    assert.deepEqual(h.calls.paid,[])
    assert.equal(h.calls.prompts.length,1)
    assert.deepEqual(h.calls.removed,[])
    assert.deepEqual(h.calls.opened,['order/7'])
  }
})
test('choosing to publish separately returns to editing without creating another order yet',async()=>{
  const h=checkout({modal:async()=>({cancel:true})})
  h.saved.originCity='厦门'
  const key=h.run('form.requestKey')
  await h.run('submit()')
  assert.notEqual(h.run('form.requestKey'),key)
  assert.equal(h.run('step.value'),1)
  assert.deepEqual(h.calls.paid,[])
  assert.deepEqual(h.calls.opened,[])
})
test('previous account’s delayed publish cannot pay, delete a draft or navigate',async()=>{
  let finish
  const h=checkout({wishPublish:()=>new Promise(resolve=>{finish=resolve})})
  const pending=h.run('submit()')
  h.scope.experience.account={id:8}
  finish({data:h.saved})
  await pending
  assert.deepEqual(h.calls.paid,[])
  assert.deepEqual(h.calls.opened,[])
  assert.deepEqual(h.calls.removed,[])
})
