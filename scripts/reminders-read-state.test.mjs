import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import { createRequire } from 'node:module'
import { messageWording } from '../common/display-wording.js'
const require = createRequire(import.meta.url)
const vue = require('vue'), compiler = require('@vue/compiler-sfc')
const source = fs.readFileSync(new URL('../pages/messages/reminders.vue', import.meta.url), 'utf8')
const code = compiler.parse(source).descriptor.scriptSetup.content
const body = compiler.babelParse(code, { sourceType: 'module' }).program.body.filter(n => n.type !== 'ImportDeclaration').map(n => code.slice(n.start, n.end)).join('\n')
const settle = () => new Promise(resolve => setImmediate(resolve))
function harness(options = {}) {
  const hooks = {}, writes = [], routes = [], errors = [], timers = new Map()
  let now = 1000000000000, refreshes = 0, timerId = 0
  const rows = options.rows || [{id:11,recipientId:7,mode:'user',category:'contract',title:'请签署责任书',read:false,route:'/pages/jobs/contract?appId=81'}]
  const experience = vue.reactive({ account:{id:7},mode:'user',messages:[] })
  class Clock extends Date { constructor(...args) { super(...(args.length ? args : [now])) } static now() { return now } }
  const ctx = { ...vue, experience, messageWording, Date:Clock, useScreen:()=>vue.ref(1), hasStaffAccess:vue.ref(false), currentStaffStore:vue.ref(null),
    setTimeout:(fn,delay)=>{timers.set(++timerId,{fn,delay});return timerId},clearTimeout:id=>timers.delete(id),
    onShow:fn=>{(hooks.show ||= []).push(fn)},onHide:fn=>hooks.hide=fn,onUnmounted:fn=>hooks.unmount=fn,
    getSessionRevision:()=>0,getToken:()=>String(experience.account?.id||''),ensureSession:async()=>{},
    apiMessages:async mode=>options.list ? options.list(mode,experience.account?.id) : ({rows:rows.filter(r=>(r.mode||'user')===mode).map(r=>({...r}))}),
    apiMarkRead:async id=>{writes.push(id);if(options.write)await options.write(id);const row=rows.find(r=>r.id===id);if(row&&(!row.read||!row.expiresAt)){row.read=true;row.expiresAt=now+3*86400000;return {data:{updated:1}}}return {data:{updated:0}}},
    refreshUnread:async()=>{refreshes++},toast:text=>errors.push(text),go:route=>routes.push(route),back(){},absUrl:x=>x,R:{},uni:{},askTime:async()=>null }
  vm.createContext(ctx);vm.runInContext(body,ctx)
  return {hooks,writes,routes,errors,rows,experience,timers,refreshes:()=>refreshes,setNow:value=>{now=value},run:js=>vm.runInContext(js,ctx),json:js=>JSON.parse(vm.runInContext(`JSON.stringify(${js})`,ctx))}
}

test('提醒状态只表示未读/已读，阅读不会声称业务已完成',()=>{
  const h=harness()
  assert.equal(h.run('mapReminder({read:false}).status'),'未读')
  assert.equal(h.run('mapReminder({read:true}).status'),'已读')
  assert.doesNotMatch(compiler.parse(source).descriptor.template.content,/已完成|待处理|监管待办/)
})
test('标记失败保持未读，显示失败并允许重试；成功后重取服务端期限才更新',async()=>{
  let failed=true
  const h=harness({write:async()=>{if(failed)throw Error('网络连接失败')}})
  await h.run('fetchReminders()');await h.run('openReminder(userReminders.value[0])')
  assert.equal(h.run('userReminders.value[0].read'),false)
  assert.equal(h.run('userReminders.value[0].expiresAt'),0)
  assert.deepEqual(h.routes,[]);assert.deepEqual(h.errors,['网络连接失败'])
  failed=false;await h.run('openReminder(userReminders.value[0])')
  assert.equal(h.run('userReminders.value[0].status'),'已读')
  assert.equal(h.run('userReminders.value[0].expiresAt'),h.rows[0].expiresAt)
  assert.deepEqual(h.routes,['/pages/jobs/contract?appId=81'])
  assert.equal(h.refreshes(),1);assert.equal(h.writes.length,2)
})
test('同条连点只写一次，已读重复打开不重置首次期限',async()=>{
  let release
  const h=harness({write:()=>new Promise(resolve=>release=resolve)})
  await h.run('fetchReminders()')
  const pending=h.run('openReminder(userReminders.value[0])')
  await h.run('openReminder(userReminders.value[0])');assert.equal(h.writes.length,1)
  release();await pending
  const expires=h.rows[0].expiresAt
  h.setNow(1000000001000);await h.run('openReminder(userReminders.value[0])')
  assert.equal(h.writes.length,1);assert.equal(h.run('userReminders.value[0].expiresAt'),expires)
})
test('停留到72小时隐藏到期已读，未读不删，返回刷新使用原期限',async()=>{
  const h=harness({rows:[{id:1,recipientId:7,read:true,expiresAt:1000000000100},{id:2,recipientId:7,read:false}]})
  await h.run('fetchReminders()');assert.equal(h.run('userReminders.value.length'),2)
  h.setNow(1000000000200);[...h.timers.values()][0].fn()
  assert.deepEqual(h.json('userReminders.value.map(x=>x.id)'),[2])
  h.hooks.hide();assert.equal(h.timers.size,0)
  h.run('reminderVisible=true');await h.run('fetchReminders()')
  assert.deepEqual(h.json('userReminders.value.map(x=>x.id)'),[2])
  assert.deepEqual(h.writes,[])
})
test('账号切换或离页后的旧读写响应不覆盖新身份、不跳转',async()=>{
  let release
  const h=harness({write:()=>new Promise(resolve=>release=resolve)})
  await h.run('fetchReminders()');const pending=h.run('openReminder(userReminders.value[0])')
  h.experience.account={id:8};await settle();release();await pending
  assert.deepEqual(h.json('userReminders.value'),[]);assert.deepEqual(h.routes,[])
  assert.equal(h.refreshes(),0)
})
test('列表迟到时不能把其他账号提醒写回',async()=>{
  let release
  const h=harness({list:(mode,id)=>id===7?new Promise(resolve=>release=()=>resolve({rows:[{id:11,recipientId:7}]})):Promise.resolve({rows:[]})})
  const pending=h.run('fetchReminders()');await settle()
  h.experience.account={id:8};await settle();release();await pending
  assert.deepEqual(h.json('userReminders.value'),[])
})
test('后端首次已读和72小时过滤契约保持，不修改业务状态',()=>{
  const mapper=fs.readFileSync(new URL('../../RuoYi-Vue/ruoyi-kangaroo/src/main/resources/mapper/kangaroo/KgMessageMapper.xml',import.meta.url),'utf8')
  const mark=mapper.match(/<update id="markRead">([\s\S]*?)<\/update>/)[1]
  assert.match(mark, /\(read_flag = '0' or read_time is null\)/)
  assert.match(mapper,/read_time &gt; date_sub\(now\(\), interval 3 day\)/)
  assert.doesNotMatch(mark,/kg_application|kg_governance|status\s*=/)
})
