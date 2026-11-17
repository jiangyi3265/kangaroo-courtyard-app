// Imports all 61 existing insurance cases without deleting or replacing them.
import {fixture,ready,asJSON} from './insurance-scope-base.mjs'
import test from 'node:test'
import assert from 'node:assert/strict'
const sale=(name='current')=>({data:{rows:[{orderNo:name,bizType:'stay',user:'synthetic own',payFen:1234}],counts:{unused:1},storeName:'own A'}})
const refund=(name='current')=>({data:{rows:[{orderNo:name,bizType:'stay',title:'synthetic own',refundFen:1234,user:'own'}]}})
function setup(t,screen=3){const h=fixture('insurance',{screen});t.after(h.dispose);return h}
const mutations={logout:h=>h.logout(),account:h=>h.freshAccount(),token:h=>h.session.token='synthetic-other',mode:h=>h.experience.mode='user',role:h=>h.role(),revoke:h=>h.revoke(),screen:h=>h.s.value=1,store:h=>h.rq.value.storeId='202',hide:h=>h.lifecycle('hide'),unload:h=>h.lifecycle('unload')}
for(const [name,change]of Object.entries(mutations)){
 test('resale pending personal rows rejected after '+name,async t=>{const h=setup(t),p=h.loadResale();await change(h);h.respond('apiStaffResaleOrders',sale('stale'));await p;assert.deepEqual(asJSON(h.rs.value.rows),[])})
 test('refund pending personal rows rejected after '+name,async t=>{const h=setup(t,4),p=h.loadRefunds();await change(h);h.respond('apiStaffRefunds',refund('stale'));await p;assert.deepEqual(asJSON(h.refunds.value),[])})
}
test('control: newest resale and refund requests still accept exact current data',async t=>{for(const s of [3,4]){const h=setup(t,s),fn=s===3?'loadResale':'loadRefunds',api=s===3?'apiStaffResaleOrders':'apiStaffRefunds',make=s===3?sale:refund;const old=h[fn](),fresh=h[fn]();h.respond(api,make('new'),1);await fresh;h.respond(api,make('old'));await old;assert.equal((s===3?h.rs.value.rows:h.refunds.value)[0].orderNo,'new')}})
test('resale changed query without a new response cannot accept previous filter',async t=>{const h=setup(t),p=h.loadResale();h.rq.value.keyword='different-filter';h.respond('apiStaffResaleOrders',sale('wrong-filter'));await p;assert.deepEqual(asJSON(h.rs.value.rows),[])})
test('logout immediately clears all private list and verify card state',async t=>{const h=setup(t,4);h.rs.value=sale().data;h.refunds.value=refund().data.rows;h.picked.value={no:'private'};h.resolved.value={orderNo:'private',canVerify:true};h.code.value='1234567890';h.logout();await ready();assert.deepEqual([asJSON(h.rs.value.rows),asJSON(h.refunds.value),h.picked.value,h.resolved.value,h.code.value],[[],[],null,null,''])})
test('control: current order is intentionally transferred from resale screen into verification screen',async t=>{const h=setup(t);h.rs.value=sale('mine').data;h.onOrderBtn({no:'mine',orderNo:'mine',bizType:'stay',title:'same order'});assert.equal(h.s.value,4);assert.equal(h.picked.value.no,'mine')})
test('queued old order click cannot restore personal data after logout',async t=>{const h=setup(t);h.rs.value=sale('mine').data;h.logout();h.onOrderBtn({no:'mine',orderNo:'mine',bizType:'stay',title:'private old'});assert.equal(h.picked.value,null)})
test('resolve code latest value wins despite old response arriving last',async t=>{const h=setup(t,4);h.code.value='1111111111';const old=h.resolveCode();h.code.value='2222222222';const fresh=h.resolveCode();h.respond('apiStaffVerifyResolve',{data:{orderNo:'new',canVerify:true}},1);await fresh;h.respond('apiStaffVerifyResolve',{data:{orderNo:'old',canVerify:true}});await old;assert.equal(h.resolved.value.orderNo,'new')})
test('resolve code response cannot restore details after logout',async t=>{const h=setup(t,4);h.code.value='1111111111';const p=h.resolveCode();h.logout();h.respond('apiStaffVerifyResolve',{data:{orderNo:'old',canVerify:true}});await p;assert.equal(h.resolved.value,null)})
test('manual code prompt result from old session cannot issue resolve request',async t=>{const h=setup(t,4);const p=h.inputCode();h.logout();h.respond('prompt','1111111111');await p;assert.equal(h.calls.filter(c=>c.kind==='apiStaffVerifyResolve').length,0)})
for(const [name,change]of Object.entries({logout:h=>h.logout(),store:h=>h.rq.value.storeId='202',code:h=>h.code.value='2222222222',order:h=>h.resolved.value={orderNo:'other',canVerify:true}})){
 test('verify confirmation rejects changed '+name,async t=>{const h=setup(t,4);h.code.value='1111111111';h.resolved.value={orderNo:'mine',title:'own',userMasked:'synthetic',canVerify:true};const p=h.confirmVerify();change(h);h.respond('confirm',true);await ready();const calls=h.calls.filter(c=>c.kind==='apiStaffVerifyConfirm');for(const q of h.pending.filter(q=>q.kind==='apiStaffVerifyConfirm'&&!q.done)){q.done=true;q.reject(new Error('finish controlled POST'))}await p;assert.equal(calls.length,0)})
}
test('control: unchanged verify confirmation sends exact original store/code and renders its result',async t=>{const h=setup(t,4);h.code.value='1111111111';h.resolved.value={orderNo:'mine',title:'own',canVerify:true};const p=h.confirmVerify();h.respond('confirm',true);await ready();assert.deepEqual(h.calls.filter(c=>c.kind==='apiStaffVerifyConfirm').map(c=>c.args),[['101','1111111111']]);h.respond('apiStaffVerifyConfirm',{data:{orderNo:'mine',title:'own',userMasked:'synthetic',canVerify:false,statusLabel:'已入住'},msg:'accepted'});await p;assert.equal(h.code.value,'');assert.equal(h.resolved.value.orderNo,'mine');const done=h.calls.filter(c=>c.kind==='alert');assert.equal(done.length,1);assert.equal(done[0].args[0],'核销成功');assert.match(done[0].args[1],/已入住/)})
test('verify late POST success after logout cannot resurrect private card or success toast',async t=>{const h=setup(t,4);h.code.value='1111111111';h.resolved.value={orderNo:'mine',canVerify:true};const p=h.confirmVerify();h.respond('confirm',true);await ready();h.logout();h.respond('apiStaffVerifyConfirm',{data:{orderNo:'stale'},msg:'stale-success'});await p;assert.equal(h.resolved.value,null);assert.deepEqual(h.toasts,[]);assert.equal(h.calls.filter(c=>c.kind==='alert').length,0)})
async function refundModal(t,action){const h=setup(t,4);h.vTab.value='refund';await ready();h.refunds.value=refund('mine').data.rows;const p=h.tapCard({raw:h.refunds.value[0]});h.respond('sheet',action);await ready();return{h,p}}
for(const action of [0,1])for(const[name,change]of Object.entries({logout:h=>h.logout(),role:h=>h.role(),row:h=>h.refunds.value=refund('other').data.rows})){
 test((action===0?'approve':'reject')+' refund prompt rejects changed '+name,async t=>{const{h,p}=await refundModal(t,action);change(h);h.respond(action===0?'confirm':'prompt',action===0?true:'reason');await ready();const api=action===0?'apiStaffRefundApprove':'apiStaffRefundReject',calls=h.calls.filter(c=>c.kind===api);for(const q of h.pending.filter(q=>q.kind===api&&!q.done)){q.done=true;q.reject(new Error('finish controlled POST'))}await p;assert.equal(calls.length,0)})
}
for(const action of [0,1])test('control: current refund '+(action===0?'approval':'rejection')+' preserves exact payload and refreshes',async t=>{const{h,p}=await refundModal(t,action);h.respond(action===0?'confirm':'prompt',action===0?true:'reason');await ready();const api=action===0?'apiStaffRefundApprove':'apiStaffRefundReject';assert.deepEqual(h.calls.filter(c=>c.kind===api).map(c=>c.args),[action===0?['stay','mine']:['stay','mine','reason']]);h.respond(api,{msg:'accepted'});await ready();h.respond('apiStaffRefunds',{data:{rows:[]}});await p;assert.deepEqual(asJSON(h.refunds.value),[]);assert.deepEqual(h.toasts,['accepted'])})
test('resale deep-link search stops after identity changes',async t=>{const h=setup(t),p=h.focusResaleOrder('target');h.logout();h.respond('apiStaffResaleOrders',sale('target'));await ready();for(let i=0;i<8;i++){const q=h.pending.find(q=>q.kind==='apiStaffResaleOrders'&&!q.done);if(!q)break;q.done=true;q.resolve(sale('target'));await ready()}await p;assert.deepEqual(asJSON(h.rs.value.rows),[]);assert.equal(h.calls.filter(c=>c.kind==='apiStaffResaleOrders').length,1)})
test('refund deep-link search stops after identity changes',async t=>{const h=setup(t,4),p=h.focusRefund('target');h.logout();h.respond('apiStaffRefunds',refund('target'));await p;assert.deepEqual(asJSON(h.refunds.value),[])})
test('control: authorized refund deep-link can find exact order in another granted store',async t=>{const h=setup(t,4),p=h.focusRefund('target');h.respond('apiStaffRefunds',{data:{rows:[]}});await ready();h.respond('apiStaffRefunds',refund('target'));await p;assert.equal(h.rq.value.storeId,'202');assert.equal(h.refunds.value[0].orderNo,'target')})

const dialogs=[['askResaleKeyword','prompt','new-keyword',3],['pickRsStatus','sheet',1,3],['pickRsStore','pick',1,3],['pickRsDays','sheet',1,3],['pickRsBiz','sheet',1,3],['askPolicyKeyword','prompt','new-keyword',2],['pickPolicyStatus','sheet',1,2],['pickPolicyStore','pick',1,2]]
for(const [fn,kind,value,screen]of dialogs){
 test('filter dialog '+fn+' cannot write a replacement identity filter',async t=>{const h=setup(t,screen),query=screen===3?h.rq:h.pq,before=asJSON(query.value),p=h[fn]();h.freshAccount();h.respond(kind,value);await p;assert.deepEqual(asJSON(query.value),before);assert.equal(h.calls.filter(c=>/^apiStaff(?:ResaleOrders|Policies)$/.test(c.kind)).length,0)})
 test('control: current filter dialog '+fn+' changes filter and requests original API',async t=>{const h=setup(t,screen),query=screen===3?h.rq:h.pq,before=asJSON(query.value),p=h[fn]();h.respond(kind,value);await p;assert.notDeepEqual(asJSON(query.value),before);assert.equal(h.calls.filter(c=>c.kind===(screen===3?'apiStaffResaleOrders':'apiStaffPolicies')).length,1)})
}
test('queued old voucher click after logout cannot show private text',async t=>{const h=setup(t,2),p={applyId:'7',no:'private',name:'own'};h.pol.value={rows:[p]};h.logout();h.showVoucher(p);assert.equal(h.calls.filter(c=>c.kind==='alert').length,0)})
test('control: current voucher still shows exact selected record',async t=>{const h=setup(t,2),p={applyId:'7',no:'current-no',name:'own'};h.pol.value={rows:[p]};h.showVoucher(p);assert.equal(h.calls.filter(c=>c.kind==='alert').length,1);assert.match(h.calls.find(c=>c.kind==='alert').args[1],/current-no/)})
test('old verification failure cannot show an error for a newly selected code',async t=>{const h=setup(t,4);h.code.value='1111111111';h.resolved.value={orderNo:'mine',canVerify:true};const p=h.confirmVerify();h.respond('confirm',true);await ready();h.code.value='2222222222';h.reject('apiStaffVerifyConfirm');await p;assert.deepEqual(h.toasts,[])})

// WeChat's scanner hides then re-shows this page; the scan result must survive that one transition only.
const verifyOrder={orderNo:'mine',title:'own',userMasked:'synthetic',canVerify:true}
const resolveCalls=h=>h.calls.filter(c=>c.kind==='apiStaffVerifyResolve').map(c=>c.args)
for(const order of ['result-before-show','show-before-result'])test('scan result survives the scanner hide/show ('+order+') and keeps the picked order',async t=>{
 const h=fixture('insurance',{screen:4,platform:'mp',role:'keeper'});t.after(h.dispose);h.picked.value={no:'mine'}
 h.scan();await h.lifecycle('hide')
 if(order==='show-before-result')await h.lifecycle('show')
 h.respond('scan',{result:'1234 5678 90'});await ready()
 if(order==='result-before-show')await h.lifecycle('show')
 assert.deepEqual(resolveCalls(h),[['101','1234567890']])
 h.respond('apiStaffVerifyResolve',{data:verifyOrder});await ready()
 assert.equal(h.resolved.value.orderNo,'mine');assert.equal(h.picked.value.no,'mine')
})
for(const [name,change]of Object.entries({logout:h=>h.logout(),account:h=>h.freshAccount(),revoke:h=>h.revoke(),store:h=>h.rq.value.storeId='202',screen:h=>h.s.value=3}))
 test('scan result is discarded when '+name+' changed while the scanner was open',async t=>{
  const h=fixture('insurance',{screen:4,platform:'mp',role:'keeper'});t.after(h.dispose)
  h.scan();await h.lifecycle('hide');change(h);h.respond('scan',{result:'1234567890'});await ready()
  assert.deepEqual(resolveCalls(h),[]);assert.equal(h.code.value,'')
 })
test('cancelled scan does not keep later real hides from clearing verify state',async t=>{
 const h=fixture('insurance',{screen:4,platform:'mp',role:'keeper'});t.after(h.dispose)
 h.scan();h.respond('scan',null);await ready()
 h.code.value='1111111111';h.resolved.value=verifyOrder;await h.lifecycle('hide')
 assert.deepEqual([h.code.value,h.resolved.value],['',null])
})
test('second scan tap while the scanner is open opens only one scanner',async t=>{
 const h=fixture('insurance',{screen:4,platform:'mp',role:'keeper'});t.after(h.dispose)
 h.scan();h.scan();assert.equal(h.calls.filter(c=>c.kind==='scan').length,1)
})
test('switching verify/refund tabs keeps the scanned order and refund list',async t=>{
 const h=fixture('insurance',{screen:4});t.after(h.dispose)
 h.code.value='1111111111';h.resolved.value=verifyOrder;h.refunds.value=refund('mine').data.rows
 h.vTab.value='refund';await ready();h.vTab.value='verify';await ready()
 assert.equal(h.code.value,'1111111111');assert.equal(h.resolved.value.orderNo,'mine');assert.equal(h.refunds.value.length,1)
})
test('business-center scan deep link ?s=4&code= resolves that exact code on open',async t=>{
 const h=fixture('insurance',{screen:4,role:'keeper'});t.after(h.dispose)
 await h.load({s:'4',code:'1234567890'});await ready()
 assert.equal(h.vTab.value,'verify');assert.deepEqual(resolveCalls(h),[['101','1234567890']])
})
test('deep link with a malformed code does not issue a resolve request',async t=>{
 const h=fixture('insurance',{screen:4});t.after(h.dispose)
 await h.load({s:'4',code:'12345'});await ready()
 assert.deepEqual(resolveCalls(h),[])
})
test('after a successful verification the bottom button scans the next order',async t=>{
 const h=fixture('insurance',{screen:4,platform:'mp',role:'keeper'});t.after(h.dispose);h.code.value='1111111111';h.resolved.value={orderNo:'mine',title:'own',canVerify:true}
 const p=h.confirmVerify();h.respond('confirm',true);await ready();h.respond('apiStaffVerifyConfirm',{data:{orderNo:'mine',canVerify:false,statusLabel:'已入住'}});await p
 h.confirmVerify();assert.equal(h.resolved.value,null);assert.equal(h.calls.filter(c=>c.kind==='scan').length,1)
})
