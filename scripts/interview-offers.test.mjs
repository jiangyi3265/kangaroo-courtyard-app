import { readFile } from 'node:fs/promises'
import test from 'node:test'
import assert from 'node:assert/strict'
import vm from 'node:vm'
import { ref, computed } from 'vue'
import { parse, compileTemplate, compileScript } from '@vue/compiler-sfc'

const component = await readFile(new URL('../components/k-interview-slots/k-interview-slots.vue',import.meta.url),'utf8')
const descriptor = parse(component).descriptor
const script = descriptor.scriptSetup.content.replace(/^import .*$/gm,'')
function page(role, overrides = {}) {
  const calls = [], counts = [], chosen = [], messages = []
  const props = {appId:17,storeId:null,offerRole:role,canEdit:true}
  const api = {
    apiInterviewOffers: async (...args) => { calls.push(['load',...args]); return {data:[{slotId:4}]} },
    apiAddInterviewOffer: async (...args) => calls.push(['add',...args]),
    apiChooseInterviewOffer: async (...args) => calls.push(['choose',...args]),
    apiRemoveInterviewOffer: async (...args) => calls.push(['remove',...args])
  }
  const context = {
    ref, computed, watch(){}, onBeforeUnmount(){}, todayCn:()=> '2099-06-01', shiftDate:()=> '2099-06-02',
    defineProps:()=>props, defineEmits:()=> (evt,arg) => evt==='count'?counts.push(arg):chosen.push(evt),
    normalizeClock:t=>t, readCodeInput:(code,pwd,link)=>({code,pwd,link}), tencentInputError:()=> '',
    formatTencentMeeting:(code,pwd,note,link)=>[code,pwd,note,link].join('|'), toast:t=>messages.push(t),
    uni:{showModal:({success})=>success({confirm:true})}, ...api, ...overrides
  }
  const handlers = vm.runInNewContext(script+'\n;({save,close,load,confirmOffer,capacity,code,link,start,end})', context)
  return {handlers,calls,counts,chosen}
}

test('candidate and manager submit their own time and Tencent invite through the correct endpoint',async()=>{
  for (const role of ['candidate','manager']) {
    const {handlers,calls,counts}=page(role)
    handlers.code.value='123456789'
    handlers.link.value='https://meeting.tencent.com/dm/example'
    await handlers.save()
    assert.deepEqual(calls[0].slice(0,3),['add',17,role==='manager'])
    assert.equal(calls[0][3].startTime,'2099-06-02 10:00:00')
    assert.equal(calls[0][3].meetingInfo,'123456789|||https://meeting.tencent.com/dm/example')
    assert.deepEqual(counts,[null,1])
    await handlers.close({slotId:4})
    assert.deepEqual(calls[2],['remove',17,role==='manager',4])
  }
})
test('merchant confirms chosen offer and refreshes application, without creating candidate availability',async()=>{
  const {handlers,calls,chosen}=page('merchant')
  await handlers.save()
  await handlers.confirmOffer({slotId:7,startTime:'2099-06-02 10:00',endTime:'10:30'})
  assert.deepEqual(calls,[['choose',17,7,1]])
  assert.deepEqual(chosen,['chosen'])
})
test('多人候选时段提交人数，商家只能在该上限内确认',async()=>{
  const candidate=page('candidate')
  candidate.handlers.capacity.value='3'
  await candidate.handlers.save()
  assert.equal(candidate.calls[0][3].capacity,3)
  const merchant=page('merchant')
  await merchant.handlers.confirmOffer({slotId:7,capacity:3,bookingCapacity:4})
  assert.deepEqual(merchant.calls,[])
  await merchant.handlers.confirmOffer({slotId:7,capacity:3,bookingCapacity:2})
  assert.deepEqual(merchant.calls,[['choose',17,7,2]])
})
test('participant who proposes cannot select the offer for the merchant',async()=>{
  const {handlers,calls}=page('candidate')
  await handlers.confirmOffer({slotId:4})
  assert.deepEqual(calls,[])
})
test('多人通用时段满员仍可关闭，已关闭和单人已约场次不显示关闭按钮',()=>{
  const condition=component.match(/v-else-if="([^"]+)" size="sm" type="outline" :disabled="busy" @click="close\(row\)">关闭/)[1]
  const visible=(row,canEdit=true,appId=null)=>vm.runInNewContext(condition,{row,canEdit,appId})
  assert.equal(visible({status:'booked',canClose:1}),true)
  assert.equal(visible({status:'booked',canClose:0}),false)
  assert.equal(visible({status:'closed',canClose:0}),false)
  assert.equal(visible({status:'booked',canClose:1},false),false)
})
test('切换门店或员工后打开新时段表单，前一家门店弹出的关闭确认失效',async()=>{
  const staffPage=await readFile(new URL('../pages/staff/interviews.vue',import.meta.url),'utf8')
  const keyExpression=/const slotEditorKey = computed\(\(\) => (.+)\)/.exec(staffPage)[1]
  const editorKey=(accountId,storeId)=>vm.runInNewContext(keyExpression,{
    getSessionRevision:()=>1,experience:{account:{id:accountId},mode:'staff'},scopedStoreId:ref(storeId),canEditSlots:ref(true)
  })
  assert.match(staffPage,/<k-interview-slots[^>]+:key="slotEditorKey"/)
  assert.notEqual(editorKey(12,3),editorKey(12,4))
  assert.notEqual(editorKey(12,3),editorKey(13,3))
  let leave,modal
  const closed=[]
  const previous=page('',{defineProps:()=>({appId:null,storeId:3,offerRole:'',canEdit:true}),
    onBeforeUnmount:cb=>{leave=cb},uni:{showModal:options=>{modal=options}},apiStaffCloseSlot:(...args)=>closed.push(args)})
  previous.handlers.code.value='123456789'
  const pending=previous.handlers.close({slotId:4})
  leave()
  const next=page('',{defineProps:()=>({appId:null,storeId:4,offerRole:'',canEdit:true})})
  assert.equal(next.handlers.code.value,'')
  modal.success({confirm:true})
  await pending
  assert.deepEqual(closed,[])
})
test('merchant already booked while candidate viewed offers: refresh opens the current application stage',async()=>{
  const f = page('candidate',{apiInterviewOffers:async()=>{throw Object.assign(Error('已不在待约面试阶段'),{code:409})}})
  await f.handlers.load()
  assert.deepEqual(f.chosen,['stage-changed'])
  const progress = await readFile(new URL('../pages/jobs/progress.vue',import.meta.url),'utf8')
  assert.match(progress,/@stage-changed="loadDetail\(\)"/)
})

test('changed templates compile including member waiting state, staff interview outline and operations',async()=>{
  for (const file of ['pages/jobs/progress.vue','pages/jobs/interview.vue','pages/staff/applications.vue','pages/staff/interviews.vue','components/k-interview-slots/k-interview-slots.vue']) {
    const source=await readFile(new URL('../'+file,import.meta.url),'utf8')
    const parsed=parse(source).descriptor
    const bindings=compileScript(parsed,{id:'interview'}).bindings
    assert.deepEqual(compileTemplate({source:parsed.template.content,filename:file,id:'interview',compilerOptions:{bindingMetadata:bindings}}).errors,[])
    if (file==='pages/jobs/progress.vue') assert.match(source,/等商家确认时间/)
    if (file==='pages/staff/interviews.vue') for (const label of ['面试提纲','面试操作','进入腾讯会议']) assert.ok(source.includes(label))
  }
})
