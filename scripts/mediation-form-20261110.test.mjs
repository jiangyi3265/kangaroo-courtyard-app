import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import { parse, babelParse } from '@vue/compiler-sfc'
import { ref, computed } from 'vue'
import { mediationRules, mediationTextCount, combinedClaims, mediationAmountRange, mediationFormErrors } from '../pages/governance/mediation-form.js'

const now = Date.parse('2026-11-10T12:00:00+08:00')
function valid() {
  return { draft: { date:'2026-11-10', time:'11:00', category:'食宿不符', narrative:'经'.repeat(50), claims:'更换住宿', amount:'', phone:'13800000000' }, selectedOrder:{orderType:'application',orderId:7}, claims:[], files:[{fileId:8}], categories:['食宿不符'], rules:mediationRules(), now }
}
const fields = value => mediationFormErrors(value).map(e=>e.field)
test('符合服务端要求的完整表单通过；空白金额按零处理',()=>assert.deepEqual(fields(valid()),[]))
test('逐项检查漏填订单、类型、字数、诉求、证据和电话',()=>{
  const value=valid();value.selectedOrder=null;value.draft.category='';value.draft.narrative=' ';value.draft.claims='';value.files=[];value.draft.phone=''
  assert.deepEqual(fields(value),['order','category','narrative','claims','evidence','phone'])
})
test('文字临界、首尾空白、所选诉求与补充内容一起计数',()=>{
  const value=valid();value.draft.narrative=' '+ '经'.repeat(49)+' ';assert.deepEqual(fields(value),['narrative'])
  value.draft.narrative=' '+ '经'.repeat(50)+' ';assert.deepEqual(fields(value),[])
  value.rules=mediationRules({claimsMax:50});value.claims=['退款'];value.draft.claims='求'.repeat(47)
  assert.equal(mediationTextCount(combinedClaims(value.claims,value.draft.claims)),50);assert.deepEqual(fields(value),[])
  value.draft.claims+='求';assert.deepEqual(fields(value),['claims'])
})
test('上限金额通过，多一分、负数、三位小数、指数与非数字均拒绝',()=>{
  const value=valid();value.rules=mediationRules({amountMaxFen:1000000});value.draft.amount='10000.00'
  assert.deepEqual(fields(value),[])
  for(const amount of ['10000.01','-1','0.001','1e3','NaN','Infinity','9'.repeat(400)]){value.draft.amount=amount;assert.deepEqual(fields(value),['amount'],amount)}
  assert.match(mediationAmountRange(value.rules),/10,?000/)
})
test('无效时间、未来事件和正在上传的材料会明确指出',()=>{
  for(const time of ['', 'aa:bb','25:00']){const value=valid();value.draft.time=time;assert.deepEqual(fields(value),['incident'])}
  const value=valid();value.draft.date='2026-11-11';assert.deepEqual(fields(value),['incident'])
  value.draft.date='2026-11-10';value.uploading=true;assert.deepEqual(fields(value),['evidence'])
})
test('附件必须上传成功，电话只允许服务器接受的格式',()=>{
  const value=valid();value.files=[{name:'尚未上传'}];value.draft.phone='请私信';assert.deepEqual(fields(value),['evidence','phone'])
  value.files=[{fileId:8}];value.draft.phone='+86 13800000000';assert.deepEqual(fields(value),[])
})

const source=fs.readFileSync(new URL('../pages/governance/mediation.vue',import.meta.url),'utf8')
const body=parse(source).descriptor.scriptSetup.content
const code=babelParse(body,{sourceType:'module'}).program.body.filter(n=>n.type!=='ImportDeclaration').map(n=>body.slice(n.start,n.end)).join('\n')
function harness(options={}) {
  const modals=[],scrolls=[],posts=[],routes=[]
  const ctx=vm.createContext({ref,computed,states:{},juryChoices:[],mediationRules,mediationTextCount,combinedClaims,mediationAmountRange,mediationFormErrors,onLoad(){},onShow(){},onHide(){},onUnload(){},watch(){},getMessageScopeKey:()=> 'fixture',
    uni:{showModal:q=>modals.push(q),pageScrollTo:q=>scrolls.push(q),redirectTo:q=>routes.push(q.url)},
    post:async(path,data)=>{posts.push({path,data});if(options.error)throw new Error(options.error);return {data:42}},
    get:async path=>({data:path==='context'?{categories:['食宿不符']}:{caseId:42,status:'pending',canAssist:true}})
  })
  vm.runInContext(code,ctx)
  const run=c=>vm.runInContext(c,ctx)
  return {run,modals,scrolls,posts,routes}
}
test('未选订单也能点提交，中央弹窗指出问题并定位，修正后错误自动消失',async()=>{
  const h=harness();await h.run('submit()');assert.equal(h.posts.length,0)
  assert.match(h.modals[0].content,/关联订单/);assert.equal(h.modals[0].showCancel,false)
  h.modals[0].success({confirm:true});assert.equal(h.scrolls[0].selector,'#field-order')
  assert.ok(h.run('fieldErrors.value.order'));h.run("selectedOrder.value={orderType:'application',orderId:7}");assert.equal(h.run('fieldErrors.value.order'),undefined)
  assert.doesNotMatch(source.match(/<button[^>]+@click="submit"/)[0],/!selectedOrder/)
})
test('服务器拒绝或网络失败：中央显示原原因，草稿与证据不丢失',async()=>{
  const h=harness({error:'该订单已有进行中的调解，请在原工单补充材料'})
  await h.run("context.value.categories=['食宿不符'];selectedOrder.value={orderType:'application',orderId:7};draft.value.category='食宿不符';draft.value.narrative='经'.repeat(50);draft.value.claims='退款';draft.value.phone='13800000000';files.value=[{fileId:8}];submit()")
  assert.equal(h.posts.length,1);assert.match(h.modals[0].content,/已有进行中的调解/)
  assert.equal(h.run('draft.value.narrative.length'),50);assert.equal(h.run('files.value[0].fileId'),8);assert.equal(h.run('busy.value'),false);assert.equal(h.routes.length,0)
})
test('主理人意见缺字或上传未完成时不发请求；成功才清空意见及附件',async()=>{
  const h=harness();await h.run("assistNote.value='太短';submitAssistance()")
  assert.equal(h.posts.length,0);assert.match(h.modals[0].content,/当前 2 字/)
  await h.run("assistNote.value='已联系双方核对住宿安排并记录建议';assistFiles.value=[{fileId:9}];uploading.value=true;submitAssistance()")
  assert.equal(h.posts.length,0);assert.match(h.modals[1].content,/正在上传/)
  await h.run('caseId.value=42;uploading.value=false;submitAssistance()')
  assert.equal(h.posts[0].path,'cases/42/assistance');assert.equal(h.posts[0].data.fileIds[0],9)
  assert.equal(h.run('assistNote.value'),'');assert.equal(h.run('assistFiles.value.length'),0)
})
test('主理人权限被撤销时服务端错误可见，意见与附件仍保留',async()=>{
  const h=harness({error:'无权访问此调解工单'})
  await h.run("caseId.value=42;assistNote.value='已联系双方核对住宿安排并记录建议';assistFiles.value=[{fileId:9}];submitAssistance()")
  assert.match(h.modals[0].content,/无权访问/);assert.ok(h.run('assistNote.value.length')>10);assert.equal(h.run('assistFiles.value.length'),1)
})
test('协助提交超时后原内容重试使用同一编号；修改意见后生成新编号',async()=>{
  const h=harness({error:'网络超时，请重试'})
  await h.run("caseId.value=42;assistNote.value='已联系双方核对住宿安排并记录建议';assistFiles.value=[{fileId:9}];submitAssistance()")
  await h.run('submitAssistance()')
  assert.equal(h.posts.length,2);assert.equal(h.posts[0].data.requestKey,h.posts[1].data.requestKey)
  assert.ok(h.posts[0].data.requestKey.length>=8)
  await h.run("assistNote.value+='，补充说明新的核实事实';submitAssistance()")
  assert.notEqual(h.posts[1].data.requestKey,h.posts[2].data.requestKey)
})
