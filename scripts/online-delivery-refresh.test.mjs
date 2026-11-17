import fs from 'node:fs'
import vm from 'node:vm'
import test from 'node:test'
import assert from 'node:assert/strict'
import { ref } from 'vue'

const source=fs.readFileSync(new URL('../pages/jobs/deliver.vue',import.meta.url),'utf8')
const logic=source.slice(source.indexOf('const appId = ref(0)'),source.indexOf('const abs = absUrl'))
function fixture(){
  const requests=[],toasts=[],unload=[]
  const scope={ref,onLoad(){},onShow(){},onUnload:fn=>unload.push(fn),toast:v=>toasts.push(v),errText:(e,f)=>e.message||f,
    apiMyOnline:()=>new Promise((resolve,reject)=>requests.push({resolve,reject}))}
  vm.runInNewContext(logic+';this.page={a,load,applyAssignment,saveRecipient}',scope)
  return {...scope.page,requests,toasts,unload:()=>unload.forEach(fn=>fn())}
}
test('a slow older refresh cannot replace the latest task status',async()=>{
  const t=fixture(),first=t.load(),second=t.load()
  t.requests[1].resolve({data:{stateLabel:'已确认收款'}});await second
  t.requests[0].resolve({data:{stateLabel:'待付款'}});await first
  assert.equal(t.a.value.stateLabel,'已确认收款')
})
test('successful recipient save survives a refresh started before saving',async()=>{
  const t=fixture(),loading=t.load();t.saveRecipient({account:'new@example.com'})
  t.requests[0].resolve({data:{recipient:{account:'old@example.com'}}});await loading
  assert.equal(t.a.value.recipient.account,'new@example.com')
})
test('stale refresh failure does not contradict successful submission',async()=>{
  const t=fixture(),loading=t.load();t.applyAssignment({stateLabel:'待验收'})
  t.requests[0].reject(new Error('旧刷新失败'));await loading
  assert.equal(t.a.value.stateLabel,'待验收');assert.deepEqual(t.toasts,[])
})
test('a new refresh after saving still updates payment state and locks recipient',async()=>{
  const t=fixture();t.saveRecipient({account:'new@example.com',canEdit:true});const loading=t.load()
  t.requests[0].resolve({data:{recipient:{account:'new@example.com',canEdit:false},stateLabel:'已登记付款'}});await loading
  assert.equal(t.a.value.recipient.canEdit,false);assert.equal(t.a.value.stateLabel,'已登记付款')
})
test('leaving the page ignores late data and errors',async()=>{
  for(const fail of [false,true]){
    const t=fixture(),loading=t.load();t.unload()
    if(fail)t.requests[0].reject(new Error('已离开的页面请求失败'))
    else t.requests[0].resolve({data:{stateLabel:'旧状态'}})
    await loading;assert.equal(t.a.value.stateLabel,undefined);assert.deepEqual(t.toasts,[])
  }
})
