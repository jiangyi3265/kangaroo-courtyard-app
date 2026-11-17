import {fixture,ready} from './insurance-scope-base.mjs'
import test from 'node:test'
import assert from 'node:assert/strict'
const pending={applyId:'77',storeId:'101',status:'pending',statusLabel:'待登记保单',name:'测试人'}
test('manager status tap opens registration and preserves the server request identity',async t=>{
 const h=fixture('insurance',{screen:2});t.after(h.dispose);h.pol.value={rows:[pending]}
 const action=h.openPolicyStatus(h.policies.value[0]);assert.equal(h.calls.at(-1).kind,'confirm')
 h.respond('confirm',true);await ready();h.respond('prompt',' POLICY-LOCAL ');await ready()
 assert.deepEqual(h.calls.filter(c=>c.kind==='apiStaffRegisterPolicy').map(c=>c.args),[['77','101','POLICY-LOCAL']])
 h.respond('apiStaffRegisterPolicy',{code:200});await action
 h.respond('apiStaffPolicies',{data:{rows:[{...pending,status:'active',no:'POLICY-LOCAL'}]}});await ready()
 assert.equal(h.pol.value.rows[0].status,'active')
})
test('role without insurance audit explains next steps without permitting registration',async t=>{
 const h=fixture('insurance',{screen:2});t.after(h.dispose);h.role('keeper');await ready();h.pol.value={rows:[pending]}
 h.openPolicyStatus(h.policies.value[0]);assert.equal(h.calls.at(-1).kind,'alert')
 assert.match(h.calls.at(-1).args[1],/有保险审核权限的人员或平台管理员/)
 assert.equal(h.calls.filter(c=>c.kind==='confirm'||c.kind==='apiStaffRegisterPolicy').length,0)
})

test('employee can open policy registration for an authorized store',async t=>{
 const h=fixture('insurance',{screen:2,role:'staff'});t.after(h.dispose);h.pol.value={rows:[pending]}
 const action=h.openPolicyStatus(h.policies.value[0]);assert.equal(h.calls.at(-1).kind,'confirm')
 h.respond('confirm',false);await action
 assert.equal(h.calls.filter(c=>c.kind==='apiStaffRegisterPolicy').length,0)
})
test('authorization revoked while registration is open prevents submit',async t=>{
 const h=fixture('insurance',{screen:2});t.after(h.dispose);h.pol.value={rows:[pending]}
 const action=h.openPolicyStatus(h.policies.value[0]);h.revoke();await ready();h.respond('confirm',true);await action
 assert.equal(h.calls.filter(c=>c.kind==='prompt'||c.kind==='apiStaffRegisterPolicy').length,0)
})
test('issued status opens voucher and removed record cannot act',t=>{
 const h=fixture('insurance',{screen:2});t.after(h.dispose);h.pol.value={rows:[{...pending,status:'active',no:'LOCAL-ISSUED'}]}
 h.openPolicyStatus(h.policies.value[0]);assert.equal(h.calls.at(-1).args[0],'投保凭证')
 const calls=h.calls.length;h.pol.value={rows:[]};h.openPolicyStatus(pending);assert.equal(h.calls.length,calls)
})
