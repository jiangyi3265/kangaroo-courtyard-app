import {test} from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
const source=await readFile(new URL('../common/subscription-core.js',import.meta.url),'utf8')
const {groupSubscriptionRows,createSubscriptionController,createVisitSubscriptions}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'))
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

function visitFixture({accept} = {}) {
  const cursors = new Map(), calls = [], posts = []
  let owner = 'user', state, sequence = 0, fail = false
  const rows = ['a', 'a', 'b', 'c', 'd', 'e'].map((templateId,i) => ({ templateId, bizKey: 'scene' + i }))
  const controller = createVisitSubscriptions({
    scope: () => owner, surface: () => owner, readCursor: key => cursors.get(key),
    writeCursor: (key, value) => cursors.set(key,value),
    prepare: async () => ({enabled:true,rows,ticket:String(++sequence),expiresIn:600}),
    accept: async body => { posts.push(body); if (fail) throw Error('offline'); return accept ? accept(body) : {accepted:1} },
    request: options => calls.push(options), changed: value => {state=value}
  })
  return {controller, calls, posts, role: value => {owner=value}, fail: value => {fail=value}, state: () => state}
}

test('未保存的本组授权过期后，手动重试仍询问本组', async () => {
  let first = true
  const f = visitFixture({accept() {
    if (first) { first = false; throw Object.assign(Error('expired'), {code:422}) }
    return {accepted:1}
  }})
  await f.controller.warm()
  f.controller.ask()
  f.calls[0].success({a:'accept', b:'reject', c:'accept'})
  await tick()
  assert.equal(f.state().remaining,5)
  assert.match(f.state().error,/已过期/)
  f.controller.ask(true)
  assert.deepEqual(f.calls[1].tmplIds,['a','b','c'])
})

test('同一授权回执重试成功时显示已保存，不再弹微信授权', async () => {
  const f = visitFixture({accept: () => ({alreadyRecorded:true})})
  await f.controller.warm()
  f.controller.ask()
  f.fail(true)
  f.calls[0].success({a:'accept'})
  await tick()
  assert.equal(f.state().remaining,5)
  f.fail(false)
  await f.controller.retrySave()
  assert.match(f.state().notice,/已保存/)
  assert.deepEqual(f.posts[0], f.posts[1])
  assert.equal(f.calls.length,1)
})

test('授权已保存时，即使下一次读取失败也显示已确认的可发次数', async () => {
  let state, callback, reads = 0
  const row = {bizKey:'community',templateId:'tpl',quota:0}
  const controller = createSubscriptionController({
    prepare: async () => {
      if (reads++) throw Error('连接中断')
      return {enabled:true,rows:[row],ticket:'ticket',expiresIn:600}
    },
    accept: async () => ({accepted:1,rows:[{...row,quota:1}]}),
    request: o => {callback=o}, identity: () => 'user', changed: v => {state=v}
  })
  await controller.refresh()
  controller.ask(['tpl'])
  callback.success({tpl:'accept'})
  await tick()
  assert.equal(state.groups[0].quota,1)
  assert.equal(state.retry,false)
  assert.equal(state.error,'连接中断')
})

test('五个模板在一个端的一次使用只主动询问一组，手动继续时仅问剩余模板', async () => {
  const f=visitFixture()
  await f.controller.warm()
  assert.equal(f.controller.ask(),true)
  assert.deepEqual(f.calls[0].tmplIds,['a','b','c'])
  f.calls[0].success({a:'accept',b:'reject',c:'ban'})
  await tick()
  assert.equal(f.controller.ask(),false)
  assert.equal(f.state().remaining,2)
  assert.equal(f.controller.ask(true),true)
  assert.deepEqual(f.calls[1].tmplIds,['d','e'])
  f.calls[1].success({d:'accept',e:'accept'})
  await tick()
  assert.equal(f.state().remaining,0)
  assert.equal(f.posts.length,2)
})
test('再次使用优先询问上次没轮到的模板，切换身份分别询问一次', async () => {
  const f=visitFixture()
  await f.controller.warm(); f.controller.ask(); f.calls[0].success({a:'reject'}); await tick()
  f.role('merchant'); await f.controller.warm(); assert.equal(f.controller.ask(),true)
  f.calls[1].success({a:'accept'}); await tick()
  f.role('user'); await f.controller.warm(); assert.equal(f.controller.ask(),false)
  f.controller.endVisit(); await f.controller.warm(); assert.equal(f.controller.ask(),true)
  assert.deepEqual(f.calls[2].tmplIds,['d','e','a'])
})
test('授权弹窗中切换身份后只保存当前身份；网络错误重试同一回执', async () => {
  const f=visitFixture()
  await f.controller.warm(); f.controller.ask(); f.controller.endVisit()
  assert.equal(f.controller.ask(),false)
  f.role('keeper'); await f.controller.warm(); f.controller.ask()
  f.calls[0].success({a:'accept'}); assert.equal(f.posts.length,0)
  f.fail(true); f.calls[1].success({a:'accept'}); await tick()
  assert.equal(f.state().retry,true); f.controller.endVisit()
  f.fail(false); await f.controller.retrySave()
  assert.deepEqual(f.posts[0],f.posts[1]); assert.equal(f.calls.length,2)
})
