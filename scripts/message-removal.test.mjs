import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
const source=fs.readFileSync(new URL('../common/message-actions.js',import.meta.url),'utf8').replace(/^import .*\n/gm,'').replace('export async function','async function')
function harness(){
 let modal,revision=0;const calls=[],notices=[];const experience={account:{id:7},mode:'user'}
 const c={experience,getMessageScopeKey:()=>[experience.account?.id,experience.mode,experience.staffStoreId,revision].join('|'),deleteMessage:async id=>{calls.push(id);return true},toast:t=>notices.push(t),uni:{showModal:opts=>{modal=opts}}}
 vm.createContext(c);vm.runInContext(source+'\nthis.remove=removeInboxMessage',c)
 return {remove:c.remove,calls,notices,confirm:value=>modal.success({confirm:value}),switchAccount:()=>{experience.account={id:8};revision++},switchStore:()=>{experience.staffStoreId=18;revision++}}
}
test('取消删除不发请求，确认后仅删除选中消息',async()=>{
 const h=harness();const cancel=h.remove(11);h.confirm(false);assert.equal(await cancel,false);assert.deepEqual(h.calls,[])
 const confirm=h.remove(12);h.confirm(true);assert.equal(await confirm,true);assert.deepEqual(h.calls,[12]);assert.deepEqual(h.notices,['消息已删除'])
})
test('弹窗期间切换账号不把旧消息ID提交到新账号，重复点击只弹一次',async()=>{
 const h=harness(),pending=h.remove(11);assert.equal(await h.remove(12),false);h.switchAccount();h.confirm(true)
 assert.equal(await pending,false);assert.deepEqual(h.calls,[])
})
test('删除确认期间切换员工授权范围，不提交上一门店的消息',async()=>{
 const h=harness(),pending=h.remove(11);h.switchStore();h.confirm(true)
 assert.equal(await pending,false);assert.deepEqual(h.calls,[]);assert.deepEqual(h.notices,[])
})
