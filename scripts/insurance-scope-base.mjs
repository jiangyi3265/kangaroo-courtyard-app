// Actual whole SFC script bodies, real Vue refs/computed/watch; controlled API promises only.
// This is a source-level race regression, not HTTP, DB, H5 or native evidence.
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import {fileURLToPath} from 'node:url'
import {createRequire} from 'node:module'
import test from 'node:test'
import assert from 'node:assert/strict'

const HERE=path.dirname(fileURLToPath(import.meta.url))
const APP=path.resolve(HERE,'..')
const require=createRequire(path.join(APP,'package.json'))
const compiler=require('@vue/compiler-sfc'),vue=require('vue')
const sourceDir=path.join(APP,'pages/staff')
const PERMISSIONS={insurance:['yes','yes','yes','no','no']}
const READONLY={insurance:['yes','no','no','no','no']}
const asJSON=x=>JSON.parse(JSON.stringify(x))
const ready=()=>new Promise(resolve=>setImmediate(resolve))
// interviews.vue imports the Tencent Meeting text helpers (common/meeting.js): pure functions, so the real module is used, not an API stub.
const MEETING=await import('data:text/javascript;base64,'+Buffer.from(fs.readFileSync(path.join(APP,'common/meeting.js'),'utf8')).toString('base64'))

function fixture(page,{screen=page==='insurance'?1:4,platform='h5',role='manager'}={}){
 const file=fs.readFileSync(path.join(sourceDir,page+'.vue'),'utf8')
 // platform 'mp' drops H5-only conditional blocks so mini-program-only code paths (uni.scanCode) run.
 const raw=platform==='mp'?file.replace(/\/\/ #ifdef H5[\s\S]*?\/\/ #endif/g,''):file
 const parsed=compiler.parse(raw,{filename:page+'.vue'})
 assert.equal(parsed.errors.length,0)
 const source=parsed.descriptor.scriptSetup.content
 const ast=compiler.babelParse(source,{sourceType:'module'})
 const imports=ast.program.body.filter(n=>n.type==='ImportDeclaration')
 const body=ast.program.body.filter(n=>n.type!=='ImportDeclaration').map(n=>source.slice(n.start,n.end)).join('\n')
 const pending=[],calls=[],toasts=[],hooks={load:[],show:[],hide:[],unload:[],unmount:[]}
 const session={token:'synthetic-token-one',revision:0}
 const experience=vue.reactive({account:{id:'owner',staffGrants:[
  {storeId:'101',roleCode:role,active:true,storeName:'own A'},
  {storeId:'202',roleCode:role,active:true,storeName:'own B'}]},mode:'staff',staffStoreId:'101'})
 const staffStores=vue.computed(()=>(experience.account?.staffGrants||[]).filter(g=>g.active===true))
 const currentStaffStore=vue.computed(()=>staffStores.value.find(g=>String(g.storeId)===String(experience.staffStoreId))||staffStores.value[0]||null)
 const api=(kind,args)=>{
  calls.push({kind,args:asJSON(args)})
  return new Promise((resolve,reject)=>pending.push({kind,args:asJSON(args),resolve,reject,done:false}))
 }
 const sandbox={console,Date,Math,Promise,setTimeout,clearTimeout,setInterval,clearInterval,
  ref:vue.ref,computed:vue.computed,watch:vue.watch,reactive:vue.reactive,
  experience,staffStores,currentStaffStore,currentStaffStoreId:()=>currentStaffStore.value?.storeId||null,
  hasStaffAccess:vue.computed(()=>staffStores.value.length>0),ensureSession:async()=>{},
  getSessionRevision:()=>session.revision,getToken:()=>session.token,post:(...args)=>api('post',args),
  useScreen:(_n,options={})=>{if(options.onLoad)hooks.load.push(options.onLoad);return vue.ref(screen)},
  onShow:fn=>hooks.show.push(fn),onHide:fn=>hooks.hide.push(fn),onUnload:fn=>hooks.unload.push(fn),onUnmounted:fn=>hooks.unmount.push(fn),
  toast:message=>toasts.push(String(message)),errText:(e,fallback)=>e?.message||fallback,
  absUrl:x=>x,staffCan:()=>true,serverTs:()=>Date.now(),todayCn:()=> '2026-10-06',yuan:x=>String(x),
  loadStaffPerms:g=>api('permissions',[g]),pickPaged:items=>api('pick',[items]),
  confirm:(...args)=>api('confirm',args),alert:(...args)=>api('alert',args),prompt:(...args)=>api('prompt',args),
  uni:{showModal:options=>{api('modal',[options.title,options.content]).then(result=>options.success(result))},
   scanCode:options=>{api('scan',[options.scanType]).then(result=>{if(result)options.success?.(result);else options.fail?.({errMsg:'scanCode:fail cancel'});options.complete?.()})}},
  go:url=>calls.push({kind:'go',args:[url]}),back:()=>{},uiSheet:()=>Promise.resolve(-1),sheet:items=>api('sheet',[items]),...MEETING}
 for(const n of imports)for(const s of n.specifiers){const name=s.local.name;if(!(name in sandbox)){
  assert.match(name,/^api/,'unmodelled non-API import '+name)
  sandbox[name]=(...args)=>api(name,args)
 }}
 vm.createContext(sandbox)
 const exports=page==='insurance'?['s','tb','canBuy','selected','insuranceStoreId','pq','pol','loadToBuy','loadPolicies','buySelected','showNotices','rs','rq','refunds','vTab','code','picked','resolved','loadResale','loadRefunds','focusResaleOrder','focusRefund','onOrderBtn','inputCode','resolveCode','confirmVerify','scan','tapCard','askResaleKeyword','pickRsStatus','pickRsStore','pickRsDays','pickRsBiz','askPolicyKeyword','pickPolicyStatus','pickPolicyStore','showVoucher','openPolicyStatus','policies']:
  ['s','d','requestedStoreId','cand','plans','apply','selPlan','startDate','insuranceLoading','insuranceError','insuranceCanEdit','insuranceSubmitting','notices','noticeState','toInsurance','loadNotices','loadSchedule','buy','canBuy','insuranceStoreId','openInsuranceList']
 const scope=vue.effectScope()
 scope.run(()=>vm.runInContext(body+'\nthis.subject={'+exports.join(',')+'}',sandbox,{filename:page+'.vue:actual-script-setup'}))
 const h={...sandbox.subject,experience,pending,calls,toasts,session,
  dispose:()=>{scope.stop();for(const fn of hooks.unmount)fn()},
  lifecycle:async kind=>{for(const fn of hooks[kind])fn();await ready()},
  load:async query=>{for(const fn of hooks.load)fn(query);await ready()},
  setDeep:()=>vm.runInContext("deepInsuranceAppId = '11'; requestedStoreId.value = '101'",sandbox),
  respond(kind,value,index=0){const p=pending.filter(p=>p.kind===kind&&!p.done)[index];assert.ok(p,'pending '+kind);p.done=true;p.resolve(value)},
  reject(kind,index=0){const p=pending.filter(p=>p.kind===kind&&!p.done)[index];assert.ok(p,'pending '+kind);p.done=true;p.reject(new Error('controlled failure'))},
  logout(){session.token=null;session.revision++;experience.account=null;experience.mode='user'},
  freshAccount(){session.revision++;experience.account={...asJSON(experience.account),id:'replacement'}},
  revoke(){experience.account.staffGrants=experience.account.staffGrants.filter(g=>g.storeId!=='101')},
  role(code='staff'){experience.account.staffGrants[0].roleCode=code},
  grantABA(){const before=asJSON(experience.account.staffGrants);experience.account.staffGrants=[];experience.account.staffGrants=before}}
 if(page==='interviews')h.d.value={appId:'11',storeId:'101',storeName:'own A'}
 return h
}
function tbData(label='current'){return {data:{counts:{all:1,within7:1,overdue:0},rows:[{appId:'11',name:label}]}}}
function singleData(label='current'){return {data:{storeId:'101',candidate:{appId:'11',name:label,insurable:true},plans:[{planId:'7',name:'plan',priceYuan:'12.34',days:7}],apply:null,defaultStart:'2026-10-06'}}}
function resolveToBuy(h,label='current',permissions=PERMISSIONS,index=0){h.respond('apiStaffInsuranceToBuy',tbData(label),index);h.respond('permissions',permissions,index)}
async function resolveSingle(h,label='current',permissions=PERMISSIONS,index=0){h.respond('apiStaffInsuranceForApp',singleData(label),index);await ready();if(h.pending.some(p=>p.kind==='apiStaffInsurance'&&!p.done))h.respond('apiStaffInsurance',{data:{counts:{all:1,toBuy:1}}});if(h.pending.some(p=>p.kind==='permissions'&&!p.done))h.respond('permissions',permissions)}
async function loadedSingle(t){const h=fixture('interviews');t.after(h.dispose);const p=h.toInsurance();await resolveSingle(h);await p;assert.equal(h.canBuy.value,true);return h}
async function loadedBatch(t){const h=fixture('insurance');t.after(h.dispose);const p=h.loadToBuy();resolveToBuy(h);await p;h.selected.value=['11'];assert.equal(h.canBuy.value,true);return h}
const rowNames=h=>asJSON(h.tb.value.rows).map(r=>r.name)

test('control: current batch data and server edit permission are accepted',async t=>{const h=await loadedBatch(t);assert.deepEqual(rowNames(h),['current'])})
test('control: read-only current batch permissions never enable purchase',async t=>{const h=fixture('insurance');t.after(h.dispose);const p=h.loadToBuy();resolveToBuy(h,'readonly',READONLY);await p;assert.equal(h.canBuy.value,false)})
test('control: single current failure can be retried successfully',async t=>{const h=fixture('interviews');t.after(h.dispose);const first=h.toInsurance();h.reject('apiStaffInsuranceForApp');await first;assert.equal(h.calls.filter(c=>c.kind==='apiStaffInsurance'||c.kind==='permissions').length,0);assert.match(h.insuranceError.value,/controlled failure/);const next=h.toInsurance();await resolveSingle(h);await next;assert.equal(h.canBuy.value,true);assert.equal(h.insuranceError.value,'')})
test('control: single existing request sequence keeps newer application data',async t=>{const h=fixture('interviews');t.after(h.dispose);const old=h.toInsurance(),next=h.toInsurance();await resolveSingle(h,'new',PERMISSIONS,1);await next;await resolveSingle(h,'old');await old;assert.equal(h.cand.value.name,'new')})
test('control: single existing app ID check rejects changed candidate',async t=>{const h=fixture('interviews');t.after(h.dispose);const old=h.toInsurance();h.d.value={appId:'22',storeId:'101'};await resolveSingle(h,'old');await old;assert.equal(h.cand.value.appId,undefined);assert.equal(h.insuranceCanEdit.value,false)})

test('batch latest successful request wins over older successful data',async t=>{const h=fixture('insurance');t.after(h.dispose);const old=h.loadToBuy(),next=h.loadToBuy();resolveToBuy(h,'new',PERMISSIONS,1);await next;resolveToBuy(h,'old');await old;assert.deepEqual(rowNames(h),['new'])})
test('batch old failure cannot clear newer successful data',async t=>{const h=fixture('insurance');t.after(h.dispose);const old=h.loadToBuy(),next=h.loadToBuy();resolveToBuy(h,'new',PERMISSIONS,1);await next;h.reject('apiStaffInsuranceToBuy');h.respond('permissions',PERMISSIONS);await old;assert.deepEqual(rowNames(h),['new']);assert.equal(h.toasts.length,0)})
test('batch old manager response cannot re-enable newer read-only grant',async t=>{const h=fixture('insurance');t.after(h.dispose);const old=h.loadToBuy();h.role();const next=h.loadToBuy();resolveToBuy(h,'readonly',READONLY,1);await next;resolveToBuy(h,'old-manager');await old;assert.equal(h.canBuy.value,false);assert.deepEqual(rowNames(h),['readonly'])})
test('batch reload clears old rows and selected candidates immediately',async t=>{const h=await loadedBatch(t);h.loadToBuy();assert.deepEqual(rowNames(h),[]);assert.deepEqual(asJSON(h.selected.value),[])})
for(const [name,change]of Object.entries({logout:h=>h.logout(),account:h=>h.freshAccount(),token:h=>h.session.token='synthetic-replaced',revision:h=>h.session.revision++,mode:h=>h.experience.mode='user',revoke:h=>h.revoke(),role:h=>h.role(),grantABA:h=>h.grantABA(),store:h=>h.experience.staffStoreId='202',screen:h=>h.s.value=3,hide:h=>h.lifecycle('hide'),unload:h=>h.lifecycle('unload')})){
 test('batch pending response rejected after '+name,async t=>{const h=fixture('insurance');t.after(h.dispose);const p=h.loadToBuy();await change(h);resolveToBuy(h,'stale');await p;assert.deepEqual(rowNames(h),[]);assert.equal(h.canBuy.value,false)})
 if(name!=='store')test('single pending response rejected after '+name,async t=>{const h=fixture('interviews');t.after(h.dispose);const p=h.toInsurance();await change(h);await resolveSingle(h,'stale');await p;assert.equal(h.cand.value.appId,undefined);assert.equal(h.insuranceCanEdit.value,false)})
}
test('control: explicit application store remains valid after unrelated default-store switch',async t=>{const h=fixture('interviews');t.after(h.dispose);const p=h.toInsurance();h.experience.staffStoreId='202';await resolveSingle(h,'same explicit A');await p;assert.equal(h.cand.value.name,'same explicit A');assert.equal(h.insuranceCanEdit.value,true)})
for(const [name,change]of Object.entries({logout:h=>h.logout(),revoke:h=>h.revoke(),role:h=>h.role()})){
 test('batch loaded personal data and edit capability clear immediately on '+name,async t=>{const h=await loadedBatch(t);change(h);await vue.nextTick();assert.deepEqual(rowNames(h),[]);assert.deepEqual(asJSON(h.selected.value),[]);assert.equal(h.canBuy.value,false)})
 test('single loaded personal data and edit capability clear immediately on '+name,async t=>{const h=await loadedSingle(t);change(h);await vue.nextTick();assert.equal(h.cand.value.appId,undefined);assert.equal(h.canBuy.value,false)})
}

test('policies latest filter response wins',async t=>{const h=fixture('insurance',{screen:2});t.after(h.dispose);h.pq.value.status='pending';const old=h.loadPolicies();h.pq.value.status='active';const next=h.loadPolicies();h.respond('apiStaffPolicies',{data:{rows:[{applyId:'new'}]}},1);await next;h.respond('apiStaffPolicies',{data:{rows:[{applyId:'old'}]}});await old;assert.deepEqual(asJSON(h.pol.value.rows),[{applyId:'new'}])})
test('policies old failure cannot clear newer response',async t=>{const h=fixture('insurance',{screen:2});t.after(h.dispose);const old=h.loadPolicies(),next=h.loadPolicies();h.respond('apiStaffPolicies',{data:{rows:[{applyId:'new'}]}},1);await next;h.reject('apiStaffPolicies');await old;assert.deepEqual(asJSON(h.pol.value.rows),[{applyId:'new'}]);assert.equal(h.toasts.length,0)})
test('policies all-store response rejected after one grant is removed',async t=>{const h=fixture('insurance',{screen:2});t.after(h.dispose);const old=h.loadPolicies();h.revoke();h.respond('apiStaffPolicies',{data:{rows:[{applyId:'old',storeId:'101'}]}});await old;assert.deepEqual(asJSON(h.pol.value.rows),[])})
test('single notice response cannot repopulate after logout',async t=>{const h=fixture('interviews');t.after(h.dispose);const p=h.loadNotices('77');h.logout();h.respond('apiStaffPolicyNotices',{data:[{to:'候选人',title:'private old'}]});await p;assert.deepEqual(asJSON(h.notices.value),[])})
test('single same app but changed explicit store rejects old response',async t=>{const h=fixture('interviews');t.after(h.dispose);const p=h.toInsurance();h.d.value={appId:'11',storeId:'202'};await resolveSingle(h,'stale');await p;assert.equal(h.cand.value.appId,undefined)})

test('single confirmation resumed after logout must not send POST',async t=>{const h=await loadedSingle(t);const pending=h.buy();h.logout();h.respond('modal',{confirm:true});await ready();const posts=h.calls.filter(c=>c.kind==='apiStaffInsuranceApply');for(const p of h.pending.filter(p=>p.kind==='apiStaffInsuranceApply'&&!p.done)){p.done=true;p.resolve({code:200})}await pending;assert.equal(posts.length,0)})
test('single confirmation cannot mix old plan with changed candidate or date',async t=>{const h=await loadedSingle(t);const pending=h.buy();h.cand.value={appId:'22',name:'changed',insurable:true};h.startDate.value='2027-01-01';h.respond('modal',{confirm:true});await ready();const posts=h.calls.filter(c=>c.kind==='apiStaffInsuranceApply');for(const p of h.pending.filter(p=>p.kind==='apiStaffInsuranceApply'&&!p.done)){p.done=true;p.reject(new Error('end controlled POST'))}await pending;assert.equal(posts.length,0)})
test('batch confirmation cannot submit old selected ID to changed store',async t=>{const h=await loadedBatch(t);const pending=h.buySelected();h.respond('apiStaffInsurancePlans',{data:[{planId:'7',name:'plan',priceYuan:'12.34',days:7}]});await ready();h.respond('pick',0);await ready();h.experience.staffStoreId='202';h.respond('confirm',true);await ready();const posts=h.calls.filter(c=>c.kind==='apiStaffInsuranceApplyBatch');for(const p of h.pending.filter(p=>p.kind==='apiStaffInsuranceApplyBatch'&&!p.done)){p.done=true;p.reject(new Error('end controlled POST'))}await pending;assert.equal(posts.length,0)})
test('batch confirmation after role revocation must not send POST',async t=>{const h=await loadedBatch(t);const pending=h.buySelected();h.respond('apiStaffInsurancePlans',{data:[{planId:'7',name:'plan',priceYuan:'12.34',days:7}]});await ready();h.respond('pick',0);await ready();h.revoke();h.respond('confirm',true);await ready();const posts=h.calls.filter(c=>c.kind==='apiStaffInsuranceApplyBatch');for(const p of h.pending.filter(p=>p.kind==='apiStaffInsuranceApplyBatch'&&!p.done)){p.done=true;p.reject(new Error('end controlled POST'))}await pending;assert.equal(posts.length,0)})
test('batch repeated click while modal pending creates only one confirmation flow',async t=>{const h=await loadedBatch(t);h.buySelected();h.buySelected();assert.equal(h.calls.filter(c=>c.kind==='apiStaffInsurancePlans').length,1)})

test('control: current single confirmed POST preserves exact payload and reloads',async t=>{const h=await loadedSingle(t);const pending=h.buy();h.respond('modal',{confirm:true});await ready();assert.deepEqual(h.calls.filter(c=>c.kind==='apiStaffInsuranceApply').map(c=>c.args),[[{appId:'11',planId:'7',startDate:'2026-10-06'}]]);h.respond('apiStaffInsuranceApply',{code:200,msg:'accepted'});await ready();await resolveSingle(h,'refreshed');await pending;assert.equal(h.cand.value.name,'refreshed');assert.equal(h.insuranceSubmitting.value,false);assert.deepEqual(h.toasts,['accepted'])})
test('control: current batch confirmed POST preserves exact selected IDs and store',async t=>{const h=await loadedBatch(t);const pending=h.buySelected();h.respond('apiStaffInsurancePlans',{data:[{planId:'7',name:'plan',priceYuan:'12.34',days:7}]});await ready();h.respond('pick',0);await ready();h.respond('confirm',true);await ready();assert.deepEqual(h.calls.filter(c=>c.kind==='apiStaffInsuranceApplyBatch').map(c=>c.args),[['101',['11'],'7']]);h.respond('apiStaffInsuranceApplyBatch',{code:200,msg:'accepted',data:{}});await ready();resolveToBuy(h,'refreshed');await pending;await ready();assert.equal(h.s.value,2);assert.equal(h.pq.value.storeId,'101');h.respond('apiStaffPolicies',{data:{rows:[{applyId:'accepted'}]}});await ready();assert.deepEqual(asJSON(h.pol.value.rows),[{applyId:'accepted'}]);assert.deepEqual(h.toasts,['accepted'])})
test('single POST late success after logout does not reopen or show old success',async t=>{const h=await loadedSingle(t);const pending=h.buy();h.respond('modal',{confirm:true});await ready();h.logout();h.respond('apiStaffInsuranceApply',{code:200,msg:'stale-success'});await pending;assert.deepEqual(h.toasts,[]);assert.equal(h.cand.value.appId,undefined);assert.equal(h.insuranceCanEdit.value,false)})
test('batch POST late success after logout does not reopen or show old success',async t=>{const h=await loadedBatch(t);const pending=h.buySelected();h.respond('apiStaffInsurancePlans',{data:[{planId:'7',name:'plan',priceYuan:'12.34',days:7}]});await ready();h.respond('pick',0);await ready();h.respond('confirm',true);await ready();h.logout();h.respond('apiStaffInsuranceApplyBatch',{code:200,msg:'stale-success',data:{}});await pending;assert.deepEqual(h.toasts,[]);assert.equal(h.s.value,1)})
test('single old notice cannot repopulate while same-app insurance is reloading',async t=>{const h=fixture('interviews');t.after(h.dispose);const notice=h.loadNotices('77');h.toInsurance();h.respond('apiStaffPolicyNotices',{data:[{to:'候选人',title:'previous-apply-notice'}]});await notice;assert.deepEqual(asJSON(h.notices.value),[])})
test('deep application response after logout cannot assign details or open another insurance request',async t=>{const h=fixture('interviews');t.after(h.dispose);h.d.value={};h.setDeep();const pending=h.loadSchedule();await ready();h.logout();h.respond('apiStaffApplicationDetail',{data:{appId:'11',storeId:'101',jobType:'volunteer',name:'old-deep-private'}});await pending;assert.equal(h.d.value.appId,undefined);assert.equal(h.calls.filter(c=>c.kind==='apiStaffInsuranceForApp').length,0)})
test('deep application failure after logout cannot show stale error',async t=>{const h=fixture('interviews');t.after(h.dispose);h.d.value={};h.setDeep();const pending=h.loadSchedule();await ready();h.logout();h.reject('apiStaffApplicationDetail');await pending;assert.equal(h.insuranceError.value,'')})
test('control: authorized deep application reads exact app and opens working insurance form',async t=>{const h=fixture('interviews');t.after(h.dispose);h.d.value={};h.setDeep();const pending=h.loadSchedule();await ready();h.respond('apiStaffApplicationDetail',{data:{appId:'11',storeId:'101',jobType:'volunteer',name:'real-deep'}});await ready();await resolveSingle(h,'deep loaded');await pending;assert.equal(h.d.value.appId,'11');assert.equal(h.cand.value.name,'deep loaded');assert.equal(h.canBuy.value,true)})
test('policy notice late response after logout must not open a personal-data modal',async t=>{const h=fixture('insurance',{screen:2});t.after(h.dispose);h.pol.value={rows:[{applyId:'77'}]};const pending=h.showNotices({applyId:'77'});h.logout();h.respond('apiStaffPolicyNotices',{data:[{time:'2026-10-06',to:'candidate',title:'private old',read:false}]});await pending;assert.equal(h.calls.filter(c=>c.kind==='alert').length,0)})
test('policy notice from pre-refresh record must not open after a newer list response',async t=>{const h=fixture('insurance',{screen:2});t.after(h.dispose);h.pol.value={rows:[{applyId:'77'}]};const pending=h.showNotices({applyId:'77'});const refresh=h.loadPolicies();h.respond('apiStaffPolicies',{data:{rows:[{applyId:'88'}]}});await refresh;h.respond('apiStaffPolicyNotices',{data:[{time:'2026-10-06',to:'candidate',title:'private previous',read:false}]});await pending;assert.equal(h.calls.filter(c=>c.kind==='alert').length,0)})
test('batch cached account without a token cannot begin another confirmation',async t=>{const h=await loadedBatch(t);h.session.token=null;h.buySelected();assert.equal(h.calls.filter(c=>c.kind==='apiStaffInsurancePlans').length,0)})
test('single cached account without a token cannot begin another confirmation',async t=>{const h=await loadedSingle(t);h.session.token=null;h.buy();assert.equal(h.calls.filter(c=>c.kind==='modal').length,0)})
export {fixture,ready,asJSON}
