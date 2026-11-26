import {fixture,ready} from './insurance-scope-base.mjs'
import './insurance-financial-cases.mjs'
import test from 'node:test'
import assert from 'node:assert/strict'
test('merchant policy page replaces a prior keeper-store filter with the selected merchant store',async t=>{
 const h=fixture('insurance',{screen:2,role:'merchant'});t.after(h.dispose)
 h.experience.account.staffGrants[1].roleCode='keeper'
 h.pq.value.storeId='202'
 const load=h.loadPolicies()
 assert.equal(h.calls.find(c=>c.kind==='apiStaffPolicies').args[0].storeId,'101')
 h.respond('apiStaffPolicies',{data:{rows:[]}});await load
 const pick=h.pickPolicyStore()
 assert.deepEqual(h.calls.find(c=>c.kind==='pick').args[0],['own A'])
 h.respond('pick',0);await pick
})
test('deep insurance first request hidden then shown resumes exact application and valid form',async t=>{
 const h=fixture('interviews');t.after(h.dispose);h.d.value={};h.setDeep()
 const old=h.loadSchedule();await ready();await h.lifecycle('hide')
 h.respond('apiStaffApplicationDetail',{data:{appId:'11',storeId:'101',jobType:'volunteer',name:'old hidden'}});await ready()
 assert.equal(h.d.value.appId,undefined,'hidden response must not open old private application');await old
 await h.lifecycle('show')
 assert.equal(h.calls.filter(c=>c.kind==='apiStaffApplicationDetail').length,2,'resume must request pending deep application again')
 h.respond('apiStaffApplicationDetail',{data:{appId:'11',storeId:'101',jobType:'volunteer',name:'current'}});await ready()
 h.respond('apiStaffInsuranceForApp',{data:{storeId:'101',candidate:{appId:'11',name:'current',insurable:true},plans:[{planId:'7',name:'plan',priceYuan:'12.34',days:7}],apply:null,defaultStart:'2026-10-06'}});await ready()
 h.respond('apiStaffInsurance',{data:{counts:{all:1,toBuy:1}}});h.respond('permissions',{insurance:['yes','yes','yes','no','no']});await ready()
 assert.equal(h.d.value.appId,'11');assert.equal(h.cand.value.name,'current');assert.equal(h.canBuy.value,true)
})
test('deep insurance resume cannot request when authorization was removed while hidden',async t=>{
 const h=fixture('interviews');t.after(h.dispose);h.d.value={};h.setDeep();await h.lifecycle('hide');h.logout();await h.lifecycle('show')
 assert.equal(h.calls.filter(c=>/^api/.test(c.kind)).length,0);assert.equal(h.canBuy.value,false)
})
test('deep insurance pending identity must not reopen from another current screen',async t=>{
 const h=fixture('interviews');t.after(h.dispose);h.d.value={};h.setDeep();await h.lifecycle('hide');h.s.value=1;await h.lifecycle('show')
 assert.equal(h.calls.filter(c=>c.kind==='apiStaffApplicationDetail').length,0)
})
test('agency insurance uses the server fulfillment store for permissions, totals and list navigation',async t=>{
 const h=fixture('interviews',{role:'merchant'});t.after(h.dispose)
 h.d.value={appId:'11',storeId:'101',fulfillmentStoreId:'202'}
 const pending=h.toInsurance()
 assert.equal(h.calls.filter(c=>c.kind==='apiStaffInsurance'||c.kind==='permissions').length,0)
 h.respond('apiStaffInsuranceForApp',{data:{storeId:'202',candidate:{appId:'11',name:'recruited here',insurable:true},plans:[{planId:'7',days:7,priceYuan:'12.34'}],defaultStart:'2026-10-06'}});await ready()
 assert.equal(h.calls.find(c=>c.kind==='apiStaffInsurance').args[0].storeId,'202')
 assert.equal(h.calls.find(c=>c.kind==='permissions').args[0].storeId,'202')
 h.respond('apiStaffInsurance',{data:{counts:{all:1,toBuy:1}}});h.respond('permissions',{insurance:['yes','yes','no','no','no']});await pending
 assert.equal(h.canBuy.value,true);assert.equal(h.insuranceStoreId.value,'202')
 h.openInsuranceList('all');assert.match(h.calls.find(c=>c.kind==='go').args[0],/storeId=202$/)
})
test('agency insurance never falls back to management-store permission without a fulfillment-store grant',async t=>{
 const h=fixture('interviews',{role:'merchant'});t.after(h.dispose)
 const pending=h.toInsurance()
 h.respond('apiStaffInsuranceForApp',{data:{storeId:'303',candidate:{appId:'11',insurable:true}}});await pending
 assert.equal(h.canBuy.value,false);assert.match(h.insuranceError.value,/实际招募门店暂无员工授权/)
 assert.equal(h.calls.filter(c=>c.kind==='apiStaffInsurance'||c.kind==='permissions').length,0)
})
test('fulfillment-store permission response cannot enable purchase after the grant is revoked',async t=>{
 const h=fixture('interviews',{role:'merchant'});t.after(h.dispose)
 const pending=h.toInsurance()
 h.respond('apiStaffInsuranceForApp',{data:{storeId:'202',candidate:{appId:'11',insurable:true},plans:[{planId:'7',days:7}],defaultStart:'2026-10-06'}});await ready()
 h.experience.account.staffGrants=h.experience.account.staffGrants.filter(g=>g.storeId!=='202')
 h.respond('apiStaffInsurance',{data:{counts:{all:1,toBuy:1}}});h.respond('permissions',{insurance:['yes','yes','no','no','no']});await pending
 assert.equal(h.canBuy.value,false);assert.equal(h.insuranceStoreId.value,null);assert.equal(h.cand.value.appId,undefined)
})
