import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import {ref,computed,watch} from 'vue'
import {parse,babelParse,compileScript,compileTemplate} from '@vue/compiler-sfc'
import {mediationRules,mediationTextCount,combinedClaims,mediationAmountRange,mediationFormErrors} from '../pages/governance/mediation-form.js'

const pageFile=new URL('../pages/governance/mediation.vue',import.meta.url)
const uploadFile=new URL('../pages/governance/components/evidence-upload.vue',import.meta.url)
const evidenceFile=new URL('../pages/governance/components/evidence-view.vue',import.meta.url)
const source=fs.readFileSync(pageFile,'utf8')
const body=file=>{const s=parse(fs.readFileSync(file,'utf8')).descriptor.scriptSetup.content;return babelParse(s,{sourceType:'module'}).program.body.filter(n=>n.type!=='ImportDeclaration').map(n=>s.slice(n.start,n.end)).join('\n')}
const pending=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b});return {promise,resolve,reject}}
function page(options={}){
  const calls=[],modals=[],hooks={},identity=ref('merchant:1')
  const grant=ref(options.grant || {roleCode:'city_lead',cityId:31,active:true})
  const ctx=vm.createContext({ref,computed,watch,getMessageScopeKey:()=>identity.value,experience:{mode:'staff'},currentStaffStore:grant,ensureSession:options.ensureSession || (async()=>{}),states:{},juryChoices:[],mediationRules,mediationTextCount,combinedClaims,mediationAmountRange,mediationFormErrors,
    onLoad:f=>hooks.load=f,onShow:f=>hooks.show=f,onHide:f=>hooks.hide=f,onUnload:f=>hooks.unload=f,
    get:async(path,data)=>{calls.push({method:'GET',path,data});if(options.get)return options.get(path,data);return {data:path==='context'?{canSupport:true}:path==='cases'?{rows:[],total:0}:{caseId:42,status:'pending',viewerRole:'merchant',canMerchantRespond:true}}},
    post:async(path,data)=>{calls.push({method:'POST',path,data});if(options.post)return options.post(path,data);return {data:42}},
    uni:{showModal:q=>modals.push(q),pageScrollTo(){},navigateTo(){},redirectTo(){}}
  })
  vm.runInContext(body(pageFile),ctx)
  const run=s=>vm.runInContext(s,ctx)
  run("caseId.value=42;detail.value={caseId:42,status:'pending',viewerRole:'merchant',canMerchantRespond:true}")
  return {run,calls,modals,hooks,identity,grant,posts:()=>calls.filter(c=>c.method==='POST')}
}

test('逾期提醒等待还原身份，仅按提醒城市和代岗角色查询，刷新仍使用原条件',async()=>{
  const ready=pending()
  const h=page({grant:{},ensureSession:()=>ready.promise,get:async path=>({data:path==='context'?{canCity:true}:{rows:[{caseId:40}],total:1}})})
  h.run('caseId.value=0')
  h.hooks.load({mode:'city',overdue:'1',cityId:'31',dutyRole:'manager'})
  const opening=h.run('load()')
  assert.equal(h.calls.length,0)
  h.grant.value={roleCode:'city_lead',cityId:31}
  ready.resolve();await opening
  assert.deepEqual({...h.calls.at(-1).data},{mode:'city',overdue:1,cityId:31,dutyRole:'manager',status:'',pageNum:1})
  await h.run("page.value=2;load()")
  assert.deepEqual({...h.calls.at(-1).data},{mode:'city',overdue:1,cityId:31,dutyRole:'manager',status:'',pageNum:1})
  assert.equal(h.run('list.value[0].caseId'),40)
})

test('逾期提醒遇到无效城市、错误角色或城市不匹配时绝不查询全量待办',async()=>{
  for (const [q,grant] of [
    [{mode:'city',cityId:'0'},{roleCode:'city_lead',cityId:31}],
    [{mode:'support',cityId:'31'},{roleCode:'manager',cityId:31}],
    [{mode:'city',cityId:'31',dutyRole:'merchant'},{roleCode:'city_lead',cityId:31}],
    [{mode:'city',cityId:'31'},{roleCode:'manager',cityId:31}],
    [{mode:'city',cityId:'31'},{roleCode:'city_lead',cityId:99}],
  ]) {
    const h=page({grant})
    h.run('caseId.value=0');h.hooks.load({...q,overdue:'1'});await h.run('load()')
    assert.match(h.run('error.value'),/提醒/);assert.equal(h.calls.length,0)
    await h.run("switchMode('user')");assert.equal(h.calls.length,0)
  }
})

test('切到其他城市丢弃旧逾期列表，切回后仍查提醒城市；普通本城待办不受过滤影响',async()=>{
  const old=pending();let lists=0
  const h=page({get:async path=>path==='context'?{data:{canCity:true}}:++lists===1?old.promise:{data:{rows:[{caseId:30}],total:1}}})
  h.run('caseId.value=0');h.hooks.load({mode:'city',cityId:'31',overdue:'1'})
  const opening=h.run('load()');await new Promise(r=>setImmediate(r))
  h.grant.value={roleCode:'city_lead',cityId:99};h.identity.value='city:99'
  await new Promise(r=>setImmediate(r));old.resolve({data:{rows:[{caseId:90}],total:1}});await opening
  assert.equal(h.run('list.value.length'),0);assert.match(h.run('error.value'),/切换/)
  h.grant.value={roleCode:'city_lead',cityId:31};h.identity.value='city:31';await new Promise(r=>setImmediate(r))
  assert.equal(h.run('list.value[0].caseId'),30)
  assert.deepEqual({...h.calls.at(-1).data},{mode:'city',overdue:1,cityId:31,status:'',pageNum:1})
  const ordinary=page();ordinary.run('caseId.value=0');ordinary.hooks.load({mode:'city'});await ordinary.run('load()')
  assert.deepEqual({...ordinary.calls.at(-1).data},{mode:'city',status:'',pageNum:1})
})

test('pending店家可用10字说明提交材料并通知，成功后清空草稿',async()=>{
  const h=page();await h.run("merchantNote.value='已核实住宿安排并补充店家说明';submitMerchantResponse()")
  assert.equal(h.posts().length,1);assert.equal(h.posts()[0].path,'cases/42/merchantResponse')
  assert.match(h.posts()[0].data.requestKey,/^merchant_/);assert.equal(h.posts()[0].data.fileIds.length,0)
  assert.equal(h.run('merchantNote.value'),'');assert.equal(h.run('feedback.value'),'材料已提交，等待处理人员跟进')
})
test('仅附件也可补料，空白、未上传完成或缺失fileId不请求',async()=>{
  const h=page();await h.run('submitMerchantResponse()');assert.equal(h.posts().length,0)
  await h.run("merchantFiles.value=[{fileId:9}];uploading.value=true;submitMerchantResponse()");assert.equal(h.posts().length,0)
  await h.run("uploading.value=false;merchantFiles.value=[{}];submitMerchantResponse()");assert.equal(h.posts().length,0)
  await h.run("merchantFiles.value=[{fileId:9}];submitMerchantResponse()");assert.equal(h.posts().length,1);assert.equal(h.posts()[0].data.fileIds[0],9)
})
test('补料网络失败保留文本附件，同一内容重试保持幂等key',async()=>{
  const h=page({post:async()=>{throw Error('网络中断')}})
  await h.run("merchantNote.value='已核实住宿安排并补充店家说明';merchantFiles.value=[{fileId:9}];submitMerchantResponse()")
  await h.run('submitMerchantResponse()');assert.equal(h.posts()[0].data.requestKey,h.posts()[1].data.requestKey)
  assert.equal(h.run('merchantFiles.value.length'),1);assert.match(h.modals[0].content,/网络中断/)
  await h.run("merchantNote.value+='，补充新的核实说明';submitMerchantResponse()")
  assert.notEqual(h.posts()[1].data.requestKey,h.posts()[2].data.requestKey)
})
test('当事人无商家回应权限、已结案时不发补料请求',async()=>{
  for(const d of [{status:'pending',canMerchantRespond:false},{status:'closed',canMerchantRespond:true}]){
    const h=page();await h.run(`detail.value=${JSON.stringify(d)};merchantNote.value='已核实住宿安排并补充店家说明';submitMerchantResponse()`);assert.equal(h.posts().length,0)
  }
})
test('只依据服务端可接单状态领取，不会借city核实/裁决权限',async()=>{
  const h=page();await h.run("detail.value={status:'pending',viewerRole:'support',canSupportAccept:false};acceptSupport()");assert.equal(h.posts().length,0)
  await h.run("detail.value.canSupportAccept=true;acceptSupport()");assert.equal(h.posts().length,1);assert.equal(h.posts()[0].path,'cases/42/supportAccept')
  h.run("detail.value={status:'accepted',viewerRole:'support',canHandle:true,supportMine:true}");assert.equal(h.run('isHandler.value'),false)
  await h.run("detail.value={status:'closed',canSupportAccept:true};acceptSupport()");assert.equal(h.posts().length,1)
})
test('主理人领取后各方显示已接单跟进，同时说明城市负责人仍待独立处理',()=>{
  const h=page();h.run("states.pending='待接单';states.accepted='已受理';states.closed='已结案'")
  for(const viewerRole of ['support','merchant','user','city']){
    h.run(`detail.value={status:'pending',viewerRole:'${viewerRole}',supportClaimed:true,supportMine:${viewerRole==='support'}}`)
    assert.equal(h.run('detailState.value'),'已接单跟进')
    assert.match(h.run('progressHint.value'),viewerRole==='support'?/你已接单跟进/:/换工主理人已接单跟进/)
    assert.match(h.run('progressHint.value'),/城市负责人待接单.*独立裁决/)
    assert.equal(h.run('detail.value.status'),'pending')
  }
  h.run('detail.value.supportClaimed=false');assert.equal(h.run('detailState.value'),'待接单')
  for(const status of ['accepted','closed']){
    h.run(`detail.value={status:'${status}',supportClaimed:true}`)
    assert.equal(h.run('detailState.value'),h.run(`states.${status}`))
  }
})
test('领取失败显示冲突并可刷新，不伪装接单成功',async()=>{
  const h=page({post:async()=>{throw Error('已有其他主理人接单')}})
  await h.run("detail.value={status:'pending',viewerRole:'support',canSupportAccept:true};acceptSupport()")
  assert.match(h.modals[0].content,/其他主理人/);assert.equal(h.run('feedback.value'),'');assert.equal(h.run('busy.value'),false)
})
test('切换身份丢弃旧详情响应并清理草稿附件',async()=>{
  const old=pending();let reads=0
  const h=page({get:async path=>path==='context'?{data:{canSupport:true}}:++reads===1?old.promise:{data:{caseId:42,viewerRole:'support',canSupportAccept:false,status:'pending'}}})
  const loading=h.run('load()');await new Promise(r=>setImmediate(r))
  h.run("merchantNote.value='旧商家材料';merchantFiles.value=[{fileId:9}];statement.value='旧私密陈述'")
  h.identity.value='manager:2';await new Promise(r=>setImmediate(r))
  old.resolve({data:{caseId:42,viewerRole:'merchant',narrative:'旧身份响应',canMerchantRespond:true}});await loading
  assert.equal(h.run('detail.value.viewerRole'),'support');assert.equal(h.run('merchantNote.value'),'');assert.equal(h.run('merchantFiles.value.length'),0);assert.equal(h.run('statement.value'),'')
})
test('列表模式改变后，旧分页响应不会覆盖新模式',async()=>{
  const old=pending();const h=page({get:async(path,q)=>q.mode==='support'?old.promise:{data:{rows:[{caseId:8}],total:1}}})
  const loading=h.run("caseId.value=0;mode.value='support';loadList()")
  await h.run("mode.value='user';loadList()")
  old.resolve({data:{rows:[{caseId:99}],total:99}});await loading
  assert.equal(h.run('list.value[0].caseId'),8);assert.equal(h.run('total.value'),1)
})
test('身份切换后的补料迟响应不能清空新身份表单或显示成功',async()=>{
  const sent=pending();const h=page({post:async()=>sent.promise})
  const saving=h.run("merchantNote.value='已核实住宿安排并补充店家说明';submitMerchantResponse()")
  h.identity.value='merchant:3';await new Promise(r=>setImmediate(r));h.run("merchantNote.value='新身份未提交内容'")
  sent.resolve({data:42});await saving
  assert.equal(h.run('merchantNote.value'),'新身份未提交内容');assert.equal(h.run('feedback.value'),'')
})
test('隐藏页清空请求权，迟到的详情不能回灌',async()=>{
  const old=pending(),h=page({get:async()=>old.promise});const loading=h.run('load()');h.hooks.hide()
  old.resolve({data:{canSupport:true}});await loading
  assert.equal(h.run('detail.value'),null);assert.equal(h.calls.length,1)
})
test('身份切换重建上传组件，旧上传结束不再发出附件或busy事件',async()=>{
  const deferred=pending(),events=[],hooks={},props={modelValue:[],redacted:false}
  const ctx=vm.createContext({ref,defineProps:()=>props,defineEmits:()=>((...v)=>events.push(v)),onBeforeUnmount:f=>hooks.unmount=f,uploadEvidence:()=>deferred.promise})
  vm.runInContext(body(uploadFile),ctx);const saving=vm.runInContext("save([{path:'fixture.jpg',size:100}])",ctx)
  hooks.unmount();deferred.resolve({fileId:4});await saving
  assert.deepEqual(events,[['busy',true]])
  assert.match(source,/:key="'merchant-'\+uploadKey"/)
})
test('详情卸载后，旧私有附件链接返回不能再预览或播放',async()=>{
  for(const mime of ['image/jpeg','video/mp4','audio/mp3','application/pdf']){
    const deferred=pending(),events=[],hooks={}
    const ctx=vm.createContext({ref,defineProps(){},onUnmounted:f=>hooks.unmount=f,evidenceLink:()=>deferred.promise,
      uni:{previewImage:q=>events.push(q),downloadFile:q=>events.push(q),createInnerAudioContext:()=>{events.push('audio');return {play(){},onError(){}}}},window:{open:q=>events.push(q)}})
    vm.runInContext(body(evidenceFile),ctx);const opening=vm.runInContext('open({fileId:4})',ctx)
    hooks.unmount();deferred.resolve({mime,url:'https://fixture.invalid/private'});await opening
    assert.deepEqual(events,[]);assert.equal(vm.runInContext('media.value',ctx),null)
  }
})
test('新附件先返回时，旧附件迟响应不会覆盖当前预览',async()=>{
  const old=pending(),events=[]
  const ctx=vm.createContext({ref,defineProps(){},onUnmounted(){},evidenceLink:id=>id===1?old.promise:Promise.resolve({mime:'image/jpeg',url:'new-file'}),uni:{previewImage:q=>events.push(q.urls[0])}})
  vm.runInContext(body(evidenceFile),ctx);const opening=vm.runInContext('open({fileId:1})',ctx)
  await vm.runInContext('open({fileId:2})',ctx);old.resolve({mime:'image/jpeg',url:'old-file'});await opening
  assert.deepEqual(events,['new-file'])
})
test('商家/主理人动作与所有模板可编译，city裁决条件保留',()=>{
  for(const file of [pageFile,uploadFile,evidenceFile]){
    const d=parse(fs.readFileSync(file,'utf8'));assert.deepEqual(d.errors,[]);compileScript(d.descriptor,{id:'handoff'});assert.deepEqual(compileTemplate({source:d.descriptor.template.content,id:'handoff',filename:file.pathname}).errors,[])
  }
  assert.match(source,/v-if="isCity&&detail.status==='pending'"/);assert.match(source,/v-if="isHandler"/)
  assert.match(source,/材料将提供给接单的换工主理人及有权限的调解处理人员/)
})
