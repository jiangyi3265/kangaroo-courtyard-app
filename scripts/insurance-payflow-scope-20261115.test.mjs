import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
const source=readFileSync(new URL('../common/pay-flow.js',import.meta.url),'utf8')
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b});return{promise,resolve,reject}}
function flow(overrides={},platform='MP-WEIXIN'){
 const calls={prepay:0,native:0,query:0,mock:0,config:0};let current=true
 const deps={apiPayConfig:async()=>{calls.config++;return{data:{mode:'mock'}}},apiPayPrepay:async()=>{calls.prepay++;return{data:{channel:'wechat'}}},apiPayStatus:async()=>{calls.query++;return{data:{status:'paid'}}},apiPayMockConfirm:async()=>{calls.mock++},modal:async()=>({confirm:true}),yuan:n=>(n/100).toFixed(2),sleep:async()=>{},uni:{requestPayment:o=>{calls.native++;o.success()}},...overrides}
 const code=source.replace(/\/\/ #ifndef MP-WEIXIN\r?\n([\s\S]*?)\/\/ #endif/g,(_,body)=>platform==='MP-WEIXIN'?'':body).replace(/^import .*\r?\n/gm,'').replace(/export /g,'')
 const {payFlow}=new Function(...Object.keys(deps),code+';return {payFlow}')(...Object.values(deps))
 return{calls,pay:()=>payFlow('fixture-payment',{isCurrent:()=>current}),invalidate:()=>{current=false}}
}
test('insurance payment already stale performs no payment request',async()=>{const f=flow();f.invalidate();assert.equal((await f.pay()).status,'unknown');assert.deepEqual(f.calls,{prepay:0,native:0,query:0,mock:0,config:0})})
test('identity switch during prepay cannot open native cashier',async()=>{const d=deferred(),f=flow({apiPayPrepay:()=>d.promise});const p=f.pay();f.invalidate();d.resolve({data:{channel:'wechat'}});assert.equal((await p).status,'unknown');assert.equal(f.calls.native,0);assert.equal(f.calls.query,0)})
test('identity switch during H5 config cannot continue prepay',async()=>{const d=deferred(),f=flow({apiPayConfig:()=>d.promise},'H5');const p=f.pay();f.invalidate();d.resolve({data:{mode:'mock'}});assert.equal((await p).status,'unknown');assert.equal(f.calls.prepay,0)})
test('identity switch in simulation confirmation cannot confirm any debit',async()=>{const d=deferred(),f=flow({apiPayPrepay:async()=>({data:{channel:'mock',amount:9000}}),modal:()=>d.promise});const p=f.pay();await Promise.resolve();f.invalidate();d.resolve({confirm:true});assert.equal((await p).status,'unknown');assert.equal(f.calls.mock,0);assert.equal(f.calls.query,0)})
test('native return after role switch stops status lookup',async()=>{let native;const f=flow({uni:{requestPayment:o=>{native=o}}});const p=f.pay();await Promise.resolve();f.invalidate();native.success();assert.equal((await p).status,'unknown');assert.equal(f.calls.query,0)})
test('late paid query is discarded after identity change',async()=>{const d=deferred();let sent=false;const f=flow({apiPayStatus:()=>{sent=true;return d.promise}});const p=f.pay();while(!sent)await Promise.resolve();f.invalidate();d.resolve({data:{status:'paid'}});assert.equal((await p).status,'unknown')})
test('unchanged identity still confirms server result and opens cashier once',async()=>{const f=flow();assert.equal((await f.pay()).status,'paid');assert.equal(f.calls.native,1);assert.equal(f.calls.query,1)})
