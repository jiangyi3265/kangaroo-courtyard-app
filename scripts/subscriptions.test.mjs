import {test} from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
const source=await readFile(new URL('../common/subscription-core.js',import.meta.url),'utf8')
const {groupSubscriptionRows,createSubscriptionController}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'))
const tick=()=>new Promise(r=>setImmediate(r))
function fixture(){let state,callback,calls=0,posts=0,failSave=false,uid='a',now=0,lastPost
 const rows=[{bizKey:'apply_progress',title:'报名',templateId:'tpl',quota:0},{bizKey:'finance',title:'结算',templateId:'tpl',quota:0}]
 const controller=createSubscriptionController({prepare:async()=>({enabled:true,rows,ticket:'receipt',expiresIn:600}),accept:async b=>{posts++;lastPost=b;assert.equal(b.ticket,'receipt');if(failSave)throw new Error('network');return{accepted:1}},request:o=>{calls++;callback=o},identity:()=>uid,clock:()=>now,changed:s=>state=s})
 return{controller,get state(){return state},get callback(){return callback},get calls(){return calls},get posts(){return posts},get lastPost(){return lastPost},fail:v=>failSave=v,account:v=>uid=v,time:v=>now=v}
}
test('same template shares one clear group and preserves all business labels',()=>{const r=groupSubscriptionRows([{templateId:'t',bizKey:'a',title:'日报'},{templateId:'t',bizKey:'b',title:'周报'}]);assert.equal(r.length,1);assert.deepEqual(r[0].labels,['日报','周报'])})
test('authorization invokes WeChat synchronously from tap and cannot double prompt',async()=>{const f=fixture();await f.controller.refresh();f.controller.ask(['tpl','tpl']);assert.equal(f.calls,1);f.controller.ask(['tpl']);assert.equal(f.calls,1);assert.deepEqual(f.callback.tmplIds,['tpl']);f.callback.success({tpl:'accept'});await tick();assert.equal(f.posts,1);assert.equal(f.state.busy,false)})
test('failed save retries the same receipt without asking WeChat twice',async()=>{const f=fixture();await f.controller.refresh();f.fail(true);f.controller.ask(['tpl']);f.callback.success({tpl:'accept'});await tick();assert.equal(f.state.retry,true);f.fail(false);await f.controller.retrySave();assert.equal(f.posts,2);assert.equal(f.calls,1);assert.equal(f.state.retry,false)})
test('switching accounts while WeChat is open never records another account grant',async()=>{const f=fixture();await f.controller.refresh();f.controller.ask(['tpl']);f.account('b');f.callback.success({tpl:'accept'});await tick();assert.equal(f.posts,0)})
test('expired receipt is refreshed without automatic popup',async()=>{const f=fixture();await f.controller.refresh();f.time(700000);assert.equal(f.controller.ask(['tpl']),false);assert.equal(f.calls,0);await tick();assert.equal(f.calls,0)})
test('rejection never becomes accept and unrequested response IDs are dropped',async()=>{const f=fixture();await f.controller.refresh();f.controller.ask(['tpl']);f.callback.success({tpl:'reject',other:'accept'});await tick();assert.equal(f.posts,1);assert.deepEqual(f.lastPost.results,{tpl:'reject'})})
