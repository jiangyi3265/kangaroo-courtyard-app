import { readFileSync } from 'node:fs'
import test from 'node:test'
import assert from 'node:assert/strict'
const source = readFileSync(new URL('../pages/staff/insurance-finance.js', import.meta.url), 'utf8')
const { createInsuranceFinance, initialFinanceState, parseFen, validPolicy, paymentLabel, refundLabel } = await import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'))
const deferred = () => { let resolve, reject; const promise=new Promise((a,b)=>{resolve=a;reject=b}); return {promise,resolve,reject} }
const tick = () => new Promise(r=>setImmediate(r))
function fixture() {
  const s=initialFinanceState(), calls=[]; let identity='merchant:1:101', allowed=true, serial=0
  const r={applyId:7,appId:8,amountFen:9000,paymentStatus:'paid',paymentMethod:'wechat',isPayer:true,refundableFen:9000,canRefund:true,canRegister:false,canCancel:false,canPay:false}
  const context={canApply:true,candidates:[{appId:8,name:'synthetic'}],plans:[{planId:9,name:'test plan',price:9000,days:30}]}
  const api={context:async()=>({data:context}),rows:async()=>({data:{rows:[{...r}]}}),account:async()=>({data:{balanceFen:10000,entries:[]}})}
  for(const action of ['create','pay','cancel','refund','policy']) api[action]=async(...args)=>{calls.push([action,...args]);return {data:{...r,...(action==='refund'?{refund:{refundId:100,status:'pending'}}:{})}}}
  const deps={state:s,api,scope:()=>identity,allowed:()=>allowed,confirm:async()=>true,payFlow:async(...args)=>{calls.push(['payFlow',...args]);return{status:'paid'}},key:()=>`request_${++serial}`}
  const ctl=createInsuranceFinance(deps)
  return {s,r,context,api,calls,ctl, deps, switch(){identity='other:2:202';this.ctl.invalidate()},revoke(){allowed=false;this.ctl.invalidate()},async ready(){await this.ctl.show();s.form={appId:8,planId:9,startDate:'2026-11-16',method:'wechat'};this.ctl.choose(7)}}
}
test('fen parsing preserves exact cents and rejects negative/precision/exponent/unsafe amounts',()=>{
  assert.equal(parseFen('17.85'),1785);assert.equal(parseFen('90'),9000);assert.equal(parseFen('0.01'),1)
  for(const x of ['0','-1','1e2','1.001','NaN','9999999999999','.1','01'])assert.equal(parseFen(x),null)
})
test('actual policy dates validate leap days and ordering',()=>{
  const p={policyNo:'real-test',startDate:'2026-11-16',endDate:'2026-12-15'};assert.equal(validPolicy(p),true)
  assert.equal(validPolicy({...p,startDate:'2026-02-30'}),false);assert.equal(validPolicy({...p,endDate:'2026-01-01'}),false)
  assert.equal(validPolicy({...p,endDate:'2036-11-16'}),true);assert.equal(validPolicy({...p,endDate:'2036-11-17'}),false)
  assert.equal(validPolicy({...p,startDate:'2028-02-29',endDate:'2038-02-28'}),true);assert.equal(validPolicy({...p,startDate:'2028-02-29',endDate:'2038-03-01'}),false)
})
test('legacy and refund status never claim successful receipt from queued/closed',()=>{
  assert.equal(paymentLabel({paymentStatus:'legacy'}),'历史人工办理')
  assert.match(refundLabel({status:'success',destination:'balance'}),/余额/)
  assert.match(refundLabel({status:'processing',destination:'balance'}),/处理中/)
  assert.match(refundLabel({status:'closed'}),/未完成/)
})
test('merchant creation uses server plan and stores no client-calculated amount',async()=>{
  const h=fixture();await h.ready();await h.ctl.create()
  const body=h.calls.find(c=>c[0]==='create')[1];assert.deepEqual(body,{appId:8,planId:9,startDate:'2026-11-16',method:'wechat',requestKey:'request_1'})
  assert.equal(h.s.selectedId,'7');assert.match(h.s.notice,/缴费已确认/)
})
test('insufficient balance prevents mutation and leaves payment choice recoverable',async()=>{
  const h=fixture();await h.ready();h.s.form.method='balance';h.s.account.balanceFen=8999;await h.ctl.create()
  assert.equal(h.calls.length,0);assert.match(h.s.error,/余额不足/);assert.equal(h.s.form.method,'balance')
})
test('manager cannot create by changing client candidate/plan selection',async()=>{
  const h=fixture();await h.ready();h.s.context.canApply=false;await h.ctl.create();assert.equal(h.calls.length,0)
})
test('request retry reuses creation key after response loss',async()=>{
  const h=fixture();await h.ready();h.api.create=async body=>{h.calls.push(['create',body]);throw Error('network')}
  await h.ctl.create();await h.ctl.create();assert.equal(h.calls[0][1].requestKey,h.calls[1][1].requestKey);assert.equal(h.s.busy,false)
})
test('same refund retry has stable idempotency key and exact destination/amount',async()=>{
  const h=fixture();await h.ready();h.s.refundForm={amount:'17.85',reason:'提前离店',destination:'balance'}
  h.api.refund=async(...args)=>{h.calls.push(['refund',...args]);throw Error('connection lost')}
  await h.ctl.refund();await h.ctl.refund();assert.deepEqual(h.calls[0],h.calls[1]);assert.equal(h.calls[0][2].amountFen,1785)
})

test('cancelled unpaid application can be recreated with identical fields using a fresh request key',async()=>{
  const h=fixture();await h.ready();let next=19
  h.api.create=async body=>{h.calls.push(['create',body]);Object.assign(h.r,{applyId:++next,paymentStatus:'pending',canPay:true,canCancel:true,payNo:'pending-payment-'+next});return{data:{...h.r}}}
  h.api.cancel=async id=>{h.calls.push(['cancel',id]);Object.assign(h.r,{paymentStatus:'closed',canPay:false,canCancel:false});return{data:{...h.r}}}
  h.deps.payFlow=async()=>({status:'cancel'});h.ctl=createInsuranceFinance(h.deps);await h.ready()
  await h.ctl.create();await h.ctl.cancel();assert.equal(h.s.rows[0].paymentStatus,'closed');await h.ctl.create();assert.equal(h.s.rows[0].applyId,21)
  const requests=h.calls.filter(c=>c[0]==='create');assert.equal(requests.length,2);assert.notEqual(requests[0][1].requestKey,requests[1][1].requestKey)
  assert.deepEqual({...requests[0][1],requestKey:undefined},{...requests[1][1],requestKey:undefined})
})

for(const terminal of ['closed','rejected']) test('refund '+terminal+' permits same-content new application without reusing acknowledged key',async()=>{
  const h=fixture();await h.ready();let next=100
  h.s.refundForm={amount:'30',reason:'申请提前退保',destination:'original'}
  h.api.refund=async(id,body)=>{h.calls.push(['refund',id,body]);h.r.refund={refundId:++next,status:'pending'};h.r.canRefund=false;return{data:{...h.r}}}
  await h.ctl.refund();h.r.refund.status=terminal;h.r.canRefund=true;await h.ctl.load();await h.ctl.refund()
  const requests=h.calls.filter(c=>c[0]==='refund');assert.equal(requests.length,2);assert.notEqual(requests[0][2].requestKey,requests[1][2].requestKey);assert.equal(h.r.refund.refundId,102);assert.match(h.s.notice,/等待平台审核/)
})

for(const action of ['create','refund']) test(action+' without an acknowledged server record retains key for a safe retry',async()=>{
  const h=fixture();await h.ready();h.s.refundForm={amount:'30',reason:'申请退保',destination:'original'}
  h.api[action]=async(...args)=>{h.calls.push([action,...args]);return{data:{}}}
  await h.ctl[action]();assert.match(h.s.error,/结果尚未确认/);await h.ctl[action]()
  const index=action==='create'?1:2;assert.equal(h.calls[0][index].requestKey,h.calls[1][index].requestKey)
})

test('idempotent response reporting a closed refund never claims it is pending review',async()=>{
  const h=fixture();await h.ready();h.s.refundForm={amount:'30',reason:'申请退保',destination:'original'}
  h.api.refund=async()=>({data:{...h.r,refund:{refundId:100,status:'closed'}}});await h.ctl.refund();assert.doesNotMatch(h.s.notice,/等待平台审核/);assert.match(h.s.notice,/核对下方/)
})
test('refund is not sent for insured nonpayer or legacy application',async()=>{
  for(const patch of [{isPayer:false},{paymentStatus:'legacy'}]){const h=fixture();await h.ready();Object.assign(h.s.rows[0],patch);h.s.refundForm={amount:'90',reason:'申请退保',destination:'original'};await h.ctl.refund();assert.equal(h.calls.length,0)}
})
test('refund amount and balance-only refund route are enforced before request',async()=>{
  const h=fixture();await h.ready();h.s.refundForm={amount:'90.01',reason:'申请退保',destination:'original'};await h.ctl.refund();assert.equal(h.calls.length,0)
  h.s.refundForm.amount='90';h.s.rows[0].paymentMethod='balance';await h.ctl.refund();assert.equal(h.calls.length,0);assert.match(h.s.error,/只能退回/)
})
test('refund success says submitted for review rather than money returned',async()=>{
  const h=fixture();await h.ready();h.s.refundForm={amount:'90',reason:'申请退保',destination:'original'};await h.ctl.refund()
  assert.match(h.s.notice,/等待平台审核/);assert.equal(h.calls[0][2].destination,'original')
})
test('registration submits actual policy dates, not plan-derived dates',async()=>{
  const h=fixture();await h.ready();h.s.rows[0].canRegister=true;h.s.policyForm={policyNo:' policy-real ',startDate:'2026-11-17',endDate:'2026-12-12'};await h.ctl.register()
  assert.deepEqual(h.calls[0],['policy',7,{policyNo:'policy-real',startDate:'2026-11-17',endDate:'2026-12-12'}])
})
test('invalid policy or missing permission does not reach API',async()=>{
  const h=fixture();await h.ready();h.s.policyForm={policyNo:'x',startDate:'2026-11-17',endDate:'2026-11-16'};h.s.rows[0].canRegister=true;await h.ctl.register();assert.equal(h.calls.length,0)
})

test('revoked merchant may review owned records and refund but cannot start another payment',async()=>{
  const h=fixture();h.context.canApply=false;h.r.canPay=false;await h.ready()
  h.s.refundForm={amount:'30',reason:'提前离店申请退保',destination:'balance'}
  await h.ctl.refund();assert.equal(h.calls[0][0],'refund')
  h.calls.length=0;await h.ctl.pay();assert.equal(h.calls.length,0)
  await h.ctl.create();assert.equal(h.calls.length,0);assert.match(h.s.error,/当前门店/)
})

test('older linked ledger record is loaded by authorized detail and stale detail is discarded',async()=>{
  const h=fixture();await h.ready();h.api.detail=async id=>({data:{...h.r,applyId:id}})
  await h.ctl.openRecord(900);assert.equal(h.ctl.row().applyId,900)
  const d=deferred();h.api.detail=()=>d.promise;const pending=h.ctl.openRecord(901);h.switch();d.resolve({data:{...h.r,applyId:901}});await pending
  assert.deepEqual(h.s.rows,[]);assert.equal(h.s.selectedId,'')
})

test('policy number over server limit is rejected before mutation',async()=>{
  const h=fixture();await h.ready();h.s.rows[0].canRegister=true;h.s.policyForm={policyNo:'A'.repeat(65),startDate:'2026-11-17',endDate:'2026-12-15'}
  await h.ctl.register();assert.equal(h.calls.length,0)
})
for(const action of ['create','refund','register','pay','cancel']) test(action+' confirmation discarded on identity change',async()=>{
  const h=fixture(),d=deferred();h.deps.confirm=()=>d.promise
  // Create a new controller with a deferred confirmation before becoming visible.
  h.ctl=createInsuranceFinance(h.deps);await h.ready();Object.assign(h.s.rows[0],{canRegister:true,canPay:true,canCancel:true})
  h.s.refundForm={amount:'90',reason:'退保申请',destination:'balance'};h.s.policyForm={policyNo:'real',startDate:'2026-11-16',endDate:'2026-12-15'}
  const pending=h.ctl[action]();h.switch();d.resolve(true);await pending;assert.equal(h.calls.length,0)
})
test('old detail/account response cannot repopulate after identity switch',async()=>{
  const h=fixture(),d=deferred();h.api.context=()=>d.promise;const pending=h.ctl.show();h.switch();d.resolve({data:h.context});await pending
  assert.deepEqual(h.s.rows,[]);assert.equal(h.s.account.balanceFen,0);assert.deepEqual(h.s.context,{})
})
test('newer reload wins over delayed prior request',async()=>{
  const h=fixture();await h.ready();const d=deferred();h.api.rows=()=>d.promise;const old=h.ctl.load();h.api.rows=async()=>({data:{rows:[{applyId:99}]}});await h.ctl.load();d.resolve({data:{rows:[{applyId:88}]}});await old;assert.equal(h.s.rows[0].applyId,99)
})
test('request is single-flight while confirmation waits',async()=>{
  const h=fixture(),d=deferred();let count=0;h.deps.confirm=()=>{count++;return d.promise};h.ctl=createInsuranceFinance(h.deps);await h.ready()
  const a=h.ctl.create(),b=h.ctl.create();d.resolve(true);await Promise.all([a,b]);assert.equal(count,1);assert.equal(h.calls.filter(c=>c[0]==='create').length,1)
})
test('delayed create cannot launch payment after hide',async()=>{
  const h=fixture(),d=deferred();await h.ready();h.api.create=()=>d.promise;const p=h.ctl.create();await tick();h.ctl.hide();d.resolve({data:{applyId:7,paymentStatus:'pending',payNo:'test-payment'}});await p
  assert.equal(h.calls.filter(c=>c[0]==='payFlow').length,0);assert.deepEqual(h.s.rows,[])
})
test('pending response launches shared payFlow with live identity guard',async()=>{
  const h=fixture();await h.ready();h.api.create=async()=>({data:{applyId:7,paymentStatus:'pending',payNo:'test-payment'}});await h.ctl.create()
  const c=h.calls.find(c=>c[0]==='payFlow');assert.equal(c[1],'test-payment');assert.equal(c[2].isCurrent(),true);h.switch();assert.equal(c[2].isCurrent(),false)
})
for(const outcome of ['cancel','unknown']) test('payment '+outcome+' is recoverable and not reported paid',async()=>{
  const h=fixture();h.deps.payFlow=async()=>({status:outcome});h.ctl=createInsuranceFinance(h.deps);await h.ready();h.api.create=async()=>({data:{applyId:7,paymentStatus:'pending',payNo:'test-payment'}});await h.ctl.create()
  assert.match(h.s.notice,outcome==='cancel'?/取消付款/:/确认中/);assert.equal(h.s.busy,false)
})
