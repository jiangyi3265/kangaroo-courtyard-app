// Exact production declarations, controlled promises, no HTTP/DB or browser.
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import test from 'node:test'
import assert from 'node:assert/strict'
import {createRequire} from 'node:module'
import {fileURLToPath} from 'node:url'
import { grantKey, groupStaffIdentities, findStaffIdentity } from '../common/staff-identities.js'
const here=path.dirname(fileURLToPath(import.meta.url)),root=path.resolve(here,'..')
const require=createRequire(path.join(root,'package.json'))
// compiler-sfc is an explicit existing devDependency and exposes its Babel parser.
const parser={parse:require('@vue/compiler-sfc').babelParse}
const source=fs.readFileSync(path.join(root,'common/experience.js'),'utf8')
const vue=require('vue')
const required=new Set(['experience','staffStores','staffIdentities','currentStaffStore','visibleMessages','unreadCount','switchMode','loadMessages','refreshUnread','markAllMessagesRead','deleteMessage','logout','acceptAuthenticatedAccount','markMessageRead','getMessageScopeKey','setStaffStore','staffGrantKey'])
const optional=new Set(['messageScopeRevision','messageListRequest','messageUnreadRequest','invalidateMessageScope','captureMessageScope','isCurrentMessageScope','sessionRevision','accountRevision'])
const found=[]
for(const n of parser.parse(source,{sourceType:'module'}).program.body){
 const d=n.type==='ExportNamedDeclaration'?n.declaration:n
 const name=d?.type==='VariableDeclaration'?d.declarations[0]?.id?.name:d?.id?.name
 if(required.has(name)||optional.has(name)){found.push(source.slice(d.start,d.end));required.delete(name)}
 if(d?.type==='ExpressionStatement'&&d.expression?.callee?.name==='setUnauthorizedHandler')found.push(source.slice(d.start,d.end))
}
assert.equal(required.size,0)
function fixture({realVue=false,markReadResult=()=>Promise.resolve()}={}){
 const pending=[];let token='first',unauthorized
 const api=(kind,mode,more)=>new Promise((resolve,reject)=>pending.push({kind,mode,more,resolve,reject}))
 const sandbox={reactive:realVue?vue.reactive:x=>x,computed:realVue?vue.computed:fn=>({get value(){return fn()}}),hasStaffAccess:{value:true},R:{identity:'identity',staff:'staff',home:'home'},
  apiMessages:(mode,category,more)=>api('list',mode,more),apiDeleteMessage:(id,mode)=>api('delete',mode,id),apiUnreadCount:mode=>api('unread',mode),apiMarkAllRead:mode=>api('readall',mode),apiMarkRead:markReadResult,getToken:()=>token,
  clearToken:()=>{token=null},loadPreferences:()=>{},accessUnchangedAt:0,accessNoticeOpen:false,setUnauthorizedHandler:fn=>{unauthorized=fn},
  grantKey,groupStaffIdentities,findStaffIdentity,read:(_,fallback)=>fallback}
 vm.createContext(sandbox);vm.runInContext(found.join('\n')+'\nthis.subject={experience,visibleMessages,unreadCount,switchMode,loadMessages,refreshUnread,markAllMessagesRead,deleteMessage,logout,acceptAuthenticatedAccount,markMessageRead,getMessageScopeKey,setStaffStore}',sandbox)
 sandbox.subject.experience.account={id:'own'};sandbox.subject.experience.mode='staff'
 return {...sandbox.subject,pending,token:v=>{token=v},unauthorized:()=>unauthorized()}
}
const own=(id,mode)=>({id,recipientId:'own',mode,read:false})
const ids=h=>[...h.visibleMessages.value].map(x=>x.id)

test('同账号同门店授权刷新会使页面作用域失效，角色恢复也不能复用旧作用域',async()=>{
 const h=fixture({realVue:true}),account=role=>({id:'own',staffGrants:[{storeId:17,roleCode:role,active:true}]})
 h.acceptAuthenticatedAccount(account('keeper'));h.setStaffStore(17)
 const previous=h.getMessageScopeKey(),changes=[]
 const stop=vue.watch(h.getMessageScopeKey,(next,old)=>changes.push([next,old]))
 const oldList=h.loadMessages(),oldUnread=h.refreshUnread()
 h.acceptAuthenticatedAccount(account('manager'))
 await vue.nextTick()
 assert.notEqual(h.getMessageScopeKey(),previous);assert.equal(changes.length,1)
 h.pending[0].resolve({rows:[{...own('lodging','staff'),category:'order',bizType:'stay_order'}],unread:9});h.pending[1].resolve({data:{unread:9}})
 await Promise.all([oldList,oldUnread]);assert.deepEqual(ids(h),[]);assert.equal(h.unreadCount.value,0)
 h.acceptAuthenticatedAccount(account('keeper'));assert.notEqual(h.getMessageScopeKey(),previous);stop()
})
test('切换门店即清空旧订单和未读，个人身份仍能载入自己的旅居订单',async()=>{
 const h=fixture(),grants=[{storeId:17,roleCode:'keeper',active:true},{storeId:18,roleCode:'manager',active:true}]
 h.acceptAuthenticatedAccount({id:'own',staffGrants:grants});h.setStaffStore(17)
 h.experience.messages=[{...own('staff-stay','staff'),category:'order',bizType:'stay_order'}];h.experience.unread=5
 const old=h.loadMessages();h.setStaffStore(18)
 assert.equal(h.experience.messages.length,0);assert.equal(h.unreadCount.value,0)
 h.pending[0].resolve({rows:[own('old-store','staff')],unread:5});await old;assert.deepEqual(ids(h),[])
 const business=h.loadMessages();h.pending[1].resolve({rows:[{...own('activity','staff'),category:'order',bizType:'activity'}],unread:1});await business
 assert.deepEqual(ids(h),['activity'])
 h.switchMode('user');const mine=h.loadMessages()
 h.pending[2].resolve({rows:[{...own('my-stay','user'),category:'order',bizType:'stay_order'}],unread:1});await mine
 assert.deepEqual(ids(h),['my-stay']);assert.equal(h.unreadCount.value,1)
})

test('删除服务端确认后移除提醒并同步红点，旧列表不能复活它',async()=>{
 const h=fixture();h.experience.messages=[own('remove','staff')];h.experience.unread=3;
 const old=h.loadMessages(),del=h.deleteMessage('remove');
 assert.deepEqual(ids(h),['remove']);assert.equal(h.pending[1].mode,'staff');
 h.pending[1].resolve({data:{updated:1,unread:2}});assert.equal(await del,true);assert.deepEqual(ids(h),[]);assert.equal(h.unreadCount.value,2);
 h.pending[0].resolve({rows:[own('remove','staff')],unread:3});await old;assert.deepEqual(ids(h),[]);assert.equal(h.unreadCount.value,2);
});
test('删除失败保留消息，删除请求期间切换账号不修改新账号列表',async()=>{
 const h=fixture();h.experience.messages=[own('remove','staff')];
 const failed=h.deleteMessage('remove');h.pending[0].reject(new Error('offline'));await assert.rejects(failed,/offline/);assert.deepEqual(ids(h),['remove']);
 const late=h.deleteMessage('remove');h.acceptAuthenticatedAccount({id:'other'});h.experience.messages=[{id:'other-msg',recipientId:'other',mode:'staff',read:false}];
 h.pending[1].resolve({data:{updated:1,unread:0}});assert.equal(await late,false);assert.equal(h.experience.messages[0].id,'other-msg');
});
test('重复标读不改历史期限，新消息不再自动过期',()=>{
 const h=fixture();h.experience.messages=[{...own('read','staff'),read:true,expiresAt:1234},own('new','staff')];
 h.markMessageRead('read');assert.equal(h.experience.messages[0].expiresAt,1234);
 const start=Date.now();h.markMessageRead('new');assert.equal(h.experience.messages[1].expiresAt,undefined);assert.equal(h.experience.messages[1].read,true);
});

test('历史消息标读成功或失败都不虚构过期时间',async()=>{
 let resolve;const h=fixture({markReadResult:()=>new Promise(r=>{resolve=r})});h.experience.messages=[{...own('legacy','staff'),read:true}];
 const start=Date.now(),pending=h.markMessageRead('legacy');assert.equal(h.experience.messages[0].expiresAt,undefined);
 resolve({data:{updated:1}});await pending;const expiry=h.experience.messages[0].expiresAt;assert.equal(expiry,undefined);assert.equal(h.experience.messages[0].read,true);
 const again=h.markMessageRead('legacy');resolve({data:{updated:0}});await again;assert.equal(h.experience.messages[0].expiresAt,expiry);
 const failed=fixture({markReadResult:()=>Promise.reject(new Error('offline'))});failed.experience.messages=[{...own('legacy','staff'),read:true}];
 await failed.markMessageRead('legacy');assert.equal(failed.experience.messages[0].expiresAt,undefined);
});

test('全部已读只更新本身份消息，不自动删除历史',async()=>{
 const h=fixture(),first=Date.now(),oldExpiry=first+10000;
 h.experience.messages=[own('new','staff'),{...own('old','staff'),read:true,expiresAt:oldExpiry},own('user','user'),{...own('other','staff'),recipientId:'other'}];
 const mark=h.markAllMessagesRead();h.pending[0].resolve({data:{updated:1}});await mark;
 const deadline=h.experience.messages[0].expiresAt;
 assert.equal(deadline,undefined);assert.equal(h.experience.messages[0].read,true);assert.equal(h.experience.messages[1].expiresAt,oldExpiry);
 assert.equal(h.experience.messages[2].read,false);assert.equal(h.experience.messages[3].read,false);
 const again=h.markAllMessagesRead();h.pending[1].resolve({data:{updated:0}});await again;
 assert.equal(h.experience.messages[0].expiresAt,deadline);assert.equal(h.experience.messages[1].expiresAt,oldExpiry);
});
test('recipient and mode computed assertions retained',()=>{const h=fixture();h.experience.messages=[own('staff','staff'),own('user','user'),{...own('foreign','staff'),recipientId:'other'}];assert.deepEqual(ids(h),['staff']);h.experience.mode='user';assert.deepEqual(ids(h),['user'])})
test('explicit identity switch immediately clears both caches',()=>{const h=fixture();h.experience.messages=[own('staff','staff'),own('user','user')];h.experience.unread=9;h.switchMode('user');assert.deepEqual(ids(h),[]);assert.equal(h.experience.messages.length,0);assert.equal(h.unreadCount.value,0)})
test('late old identity list cannot replace new list',async()=>{const h=fixture(),old=h.loadMessages();h.switchMode('user');const current=h.loadMessages();h.pending[1].resolve({rows:[own('user','user')],unread:1});await current;h.pending[0].resolve({rows:[own('staff','staff')],unread:9});await old;assert.deepEqual(ids(h),['user']);assert.equal(h.unreadCount.value,1)})
test('late old identity unread cannot replace new unread',async()=>{const h=fixture(),old=h.refreshUnread();h.switchMode('user');const current=h.refreshUnread();h.pending[1].resolve({data:{unread:1}});await current;h.pending[0].resolve({data:{unread:9}});await old;assert.equal(h.unreadCount.value,1)})
test('identity ABA still rejects old pending list',async()=>{const h=fixture(),old=h.loadMessages();h.switchMode('user');h.switchMode('staff');h.pending[0].resolve({rows:[own('old','staff')],unread:9});await old;assert.deepEqual(ids(h),[]);assert.equal(h.unreadCount.value,0)})
test('account refresh invalidates old request even same identity',async()=>{const h=fixture(),old=h.loadMessages();h.acceptAuthenticatedAccount({id:'own'});h.pending[0].resolve({rows:[own('old','staff')],unread:9});await old;assert.deepEqual(ids(h),[]);assert.equal(h.unreadCount.value,0)})
test('different account cannot receive old badge or rows',async()=>{const h=fixture(),old=h.loadMessages();h.acceptAuthenticatedAccount({id:'other'});h.pending[0].resolve({rows:[own('old','staff')],unread:9});await old;assert.deepEqual(ids(h),[]);assert.equal(h.unreadCount.value,0)})
test('same ID and mode with changed token rejects old request',async()=>{const h=fixture(),old=h.loadMessages();h.token('replacement');h.pending[0].resolve({rows:[own('old','staff')],unread:9});await old;assert.deepEqual(ids(h),[]);assert.equal(h.unreadCount.value,0)})
test('latest list request wins within same identity',async()=>{const h=fixture(),old=h.loadMessages(),current=h.loadMessages();h.pending[1].resolve({rows:[own('new','staff')],unread:1});await current;h.pending[0].resolve({rows:[own('old','staff')],unread:9});await old;assert.deepEqual(ids(h),['new']);assert.equal(h.unreadCount.value,1)})
test('latest unread request wins within same identity',async()=>{const h=fixture(),old=h.refreshUnread(),current=h.refreshUnread();h.pending[1].resolve({data:{unread:1}});await current;h.pending[0].resolve({data:{unread:9}});await old;assert.equal(h.unreadCount.value,1)})
test('logout rejects pending response even before another login',async()=>{const h=fixture(),old=h.loadMessages();h.logout();h.pending[0].resolve({rows:[own('old','staff')],unread:9});await old;assert.equal(h.experience.messages.length,0);assert.equal(h.experience.unread,0)})
test('unauthorized callback rejects pending response',async()=>{const h=fixture(),old=h.loadMessages();h.unauthorized();h.pending[0].resolve({rows:[own('old','staff')],unread:9});await old;assert.equal(h.experience.messages.length,0);assert.equal(h.experience.unread,0)})
test('old mark all result cannot mutate new identity messages',async()=>{const h=fixture(),old=h.markAllMessagesRead();h.switchMode('user');h.experience.messages=[own('new','user')];h.experience.unread=1;h.pending[0].resolve({code:200});await old;assert.equal(h.experience.messages[0].read,false);assert.equal(h.unreadCount.value,1)})
test('current request and fallback count still work',async()=>{const h=fixture(),list=h.loadMessages();h.pending[0].resolve({rows:[own('new','staff')]});await list;assert.deepEqual(ids(h),['new']);assert.equal(h.unreadCount.value,1);const unread=h.refreshUnread();h.pending[1].resolve({data:{unread:3}});await unread;assert.equal(h.unreadCount.value,3)})

// Independent remaining same-scope examples; these do not run network or UI.
test('same-scope mark-all cannot be undone by an already pending list',async()=>{
 const h=fixture();h.experience.messages=[own('msg','staff')];h.experience.unread=1;
 const before=h.loadMessages(),mark=h.markAllMessagesRead();
 h.pending[1].resolve({code:200});await mark;assert.equal(h.unreadCount.value,0);
 h.pending[0].resolve({rows:[own('msg','staff')],unread:1});await before;
 assert.equal(h.unreadCount.value,0);assert.equal(h.experience.messages[0].read,true);
});
test('same-scope earlier unread response cannot overwrite later list count',async()=>{
 const h=fixture(),old=h.refreshUnread(),fresh=h.loadMessages();
 h.pending[1].resolve({rows:[],unread:0});await fresh;
 h.pending[0].resolve({data:{unread:9}});await old;assert.equal(h.unreadCount.value,0);
});

test('later unread-zero cannot be resurrected by older list rows',async()=>{const h=fixture(),old=h.loadMessages(),fresh=h.refreshUnread();h.pending[1].resolve({data:{unread:0}});await fresh;h.pending[0].resolve({rows:[own('old','staff')],unread:1});await old;assert.equal(h.experience.unread,0);assert.equal(h.unreadCount.value,0);});

test('a newer valid unread zero supersedes an already displayed stale list',async()=>{
 const h=fixture(),list=h.loadMessages();h.pending[0].resolve({rows:[own('old','staff')],unread:1});await list;assert.equal(h.unreadCount.value,1);
 const count=h.refreshUnread();h.pending[1].resolve({data:{unread:0}});await count;assert.equal(h.unreadCount.value,0);assert.deepEqual(ids(h),['old']);
});
test('a failed refresh does not invent a zero or discard the accepted count',async()=>{
 const h=fixture(),list=h.loadMessages();h.pending[0].resolve({rows:[own('old','staff')],unread:3});await list;
 const count=h.refreshUnread();h.pending[1].reject(new Error('controlled network failure'));await assert.rejects(count,/controlled network failure/);assert.equal(h.unreadCount.value,3);assert.deepEqual(ids(h),['old']);
});
test('authoritative zero also invalidates a cached real Vue computed value',async()=>{
 const h=fixture({realVue:true}),old=h.loadMessages(),fresh=h.refreshUnread();assert.equal(h.unreadCount.value,0);
 h.pending[1].resolve({data:{unread:0}});await fresh;assert.equal(h.unreadCount.value,0);
 h.pending[0].resolve({rows:[own('old','staff')],unread:1});await old;assert.deepEqual(ids(h),['old']);assert.equal(h.unreadCount.value,0);
});
test('scope reset restores local recipient-filtered fallback until a valid response',async()=>{
 const h=fixture(),count=h.refreshUnread();h.pending[0].resolve({data:{unread:0}});await count;
 h.switchMode('user');h.experience.messages=[own('own','user'),{...own('foreign','user'),recipientId:'other'},own('staff','staff')];assert.deepEqual(ids(h),['own']);assert.equal(h.unreadCount.value,1);
});

test('missing or invalid list count falls back only to current recipient and mode',async()=>{
 for(const count of [undefined,-1,NaN,Infinity,'3']){
  const h=fixture(),list=h.loadMessages();h.pending[0].resolve({rows:[own('ok','staff'),{...own('foreign','staff'),recipientId:'other'},own('wrong-mode','user')],unread:count});await list;
  assert.deepEqual(ids(h),['ok']);assert.equal(h.unreadCount.value,1);
 }
});
test('invalid unread responses cannot turn a valid current zero into false authority',async()=>{
 for(const count of [undefined,-1,NaN,Infinity,'3',null,{}]){
  const h=fixture(),zero=h.refreshUnread();h.pending[0].resolve({data:{unread:0}});await zero;
  const bad=h.refreshUnread();h.pending[1].resolve({data:{unread:count}});await assert.rejects(bad,/消息未读数无效/);assert.equal(h.experience.unread,0);assert.equal(h.unreadCount.value,0);
 }
});
test('reading one own message still decrements an accepted server total',async()=>{
 const h=fixture(),list=h.loadMessages();h.pending[0].resolve({rows:[own('ok','staff')],unread:3});await list;h.markMessageRead('ok');assert.equal(h.experience.messages[0].read,true);assert.equal(h.unreadCount.value,2);
});

// 10-15 消息页分页：只取 bucket=main 的一页，滑到底 append 下一页（按 id 去重）；experience.messagesMore 记服务端还有没有下一页
const page=(...ids)=>ids.map(id=>own(id,'staff'))
test('paged list passes bucket/page/size through and records hasMore',async()=>{
 const h=fixture(),list=h.loadMessages(undefined,{bucket:'main',page:1,size:20});
 assert.deepEqual(h.pending[0].more,{bucket:'main',page:1,size:20});
 h.pending[0].resolve({rows:page('a','b'),unread:5,hasMore:true});await list;
 assert.deepEqual(ids(h),['a','b']);assert.equal(h.experience.messagesMore,true);assert.equal(h.unreadCount.value,5);
});
test('append keeps loaded rows, drops ids already shown and takes the new hasMore',async()=>{
 const h=fixture(),first=h.loadMessages(undefined,{bucket:'main',page:1,size:2});h.pending[0].resolve({rows:page('a','b'),unread:4,hasMore:true});await first;
 const next=h.loadMessages(undefined,{bucket:'main',page:2,size:2},true);
 // 新消息进来把 b 挤到了第二页开头：b 只能出现一次
 h.pending[1].resolve({rows:page('b','c'),unread:4,hasMore:false});await next;
 assert.deepEqual(ids(h),['a','b','c']);assert.equal(h.experience.messagesMore,false);
});
test('without append a page replaces the list (refresh from page one)',async()=>{
 const h=fixture();h.experience.messages=page('old1','old2');
 const list=h.loadMessages(undefined,{bucket:'main',page:1,size:20});h.pending[0].resolve({rows:page('new'),unread:1,hasMore:false});await list;
 assert.deepEqual(ids(h),['new']);
});
test('a server that ignores bucket leaves messagesMore null so the page filters locally',async()=>{
 const h=fixture(),list=h.loadMessages(undefined,{bucket:'main',page:1,size:20});h.pending[0].resolve({rows:page('a'),unread:1});await list;
 assert.equal(h.experience.messagesMore,null);
 const plain=h.loadMessages();assert.equal(h.pending[1].more,undefined);h.pending[1].resolve({rows:page('a'),unread:1,hasMore:'yes'});await plain;
 assert.equal(h.experience.messagesMore,null);
});
test('an older append cannot land on a newer refresh or another identity',async()=>{
 const h=fixture(),first=h.loadMessages(undefined,{bucket:'main',page:1,size:1});h.pending[0].resolve({rows:page('a'),unread:2,hasMore:true});await first;
 const late=h.loadMessages(undefined,{bucket:'main',page:2,size:1},true),fresh=h.loadMessages(undefined,{bucket:'main',page:1,size:20});
 h.pending[2].resolve({rows:page('n','a'),unread:2,hasMore:false});await fresh;
 h.pending[1].resolve({rows:page('b'),unread:9,hasMore:true});await late;
 assert.deepEqual(ids(h),['n','a']);assert.equal(h.experience.messagesMore,false);assert.equal(h.unreadCount.value,2);
 const other=h.loadMessages(undefined,{bucket:'main',page:2,size:20},true);h.switchMode('user');
 h.pending[3].resolve({rows:page('x'),unread:9,hasMore:true});await other;
 assert.equal(h.experience.messages.length,0);assert.equal(h.experience.messagesMore,null);assert.equal(h.unreadCount.value,0);
});
