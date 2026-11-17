import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import vm from 'node:vm'
import {createRequire} from 'node:module'
import * as files from '../pages/community/chat-files.js'

// Run the page's actual send/poll logic with explicit adapter doubles; browser tests cover its bindings.
const source=readFileSync(new URL('../pages/community/chat.vue',import.meta.url),'utf8')
const mediaSource=readFileSync(new URL('../common/chat-media.js',import.meta.url),'utf8')
const scopeSource=mediaSource.slice(mediaSource.indexOf('export function mediaScope'),mediaSource.indexOf('export async function privateImage')).replace('export ','')
const mediaScope=new Function(scopeSource+';return mediaScope')()
// 到发文件那段为止（选图 / 选文件 / 发送都在里面；分享、下载文件的逻辑在 chat-files.test.mjs 里管）
const logic='const getCurrentInstance=()=>null;const privateChatEnabled=ref(true),groupChatEnabled=ref(true);const refreshFeatures=async()=>({privateChatEnabled:true,groupChatEnabled:true});\n'+source.slice(source.indexOf('const DEFAULT_AVATAR'),source.indexOf('async function shareChatFile'))
function harness(adapters={}){
 const watchers=[]
 const notify=()=>watchers.forEach(w=>{const value=w.read();if(value!==w.previous){const old=w.previous;w.previous=value;w.fn(value,old)}})
 const ref=value=>({get value(){return value},set value(v){value=v;notify()}}),computed=f=>({get value(){return f()}}),hooks={}
 const watch=(target,fn)=>{const read=typeof target==='function'?target:()=>target.value;watchers.push({read,fn,previous:read()})}
 const conv={convId:1,type:adapters.screen===2?'group':'store',status:'active'},calls=[],keys=[]
 const selectorQueries=[]
 const uni={pageScrollTo(){},hideKeyboard(){},chooseImage:adapters.chooseImage,createSelectorQuery(){
  const requests=[];let selector=''
  const query={in(){return query},select(value){selector=value;return query},
   boundingClientRect(fn){requests.push({kind:'rect',selector,fn});return query},
   scrollOffset(fn){requests.push({kind:'offset',selector,fn});return query},
   fields(_options,fn){requests.push({kind:'fields',selector,fn});return query},
   exec(fn){
    const finish=metrics=>{
     const rows=Array.isArray(metrics)?metrics:requests.map(request=>request.kind==='offset'?{scrollTop:metrics.scrollTop,scrollLeft:0}:request.selector==='.group-body'?{height:metrics.scrollHeight}:metrics)
     requests.forEach((request,index)=>request.fn?.(rows[index]));fn?.(rows)
    }
    if(adapters.deferMeasurements)selectorQueries.push(finish);else finish({height:600,scrollTop:0,scrollHeight:600})
   }};return query
 }}
 const apiChatSend=async(id,text,key)=>{keys.push(key);return adapters.send?adapters.send(id,text,key):(calls.push({id,text}),{data:{msgId:1}})}
 const messageRequests=[]
 const apiChatMessages=async(id,after)=>{messageRequests.push({id,after});return adapters.messages?adapters.messages(id,after):{data:{rows:[],lastId:0}}}
 const factory=new Function('ref','computed','nextTick','apiChatSend','apiChatMessages','apiChat','absUrl','onShow','onHide','onUnload','uni','toast','fail','s','watch','mediaScope','experience','getToken','sendPrivateImage','pickChatFile','uploadChatFile','fileProblem','extOf','sizeLabel','alert','fileEnv',logic+';return {conv,draft,msgs,sending,sendError,messageError,canSend,keyboardHeight,inputHeight,scrollTarget,send,sendDraft,loadMessages,keyboardChanged,inputLinesChanged,syncDraft,chooseChatImage,sendImageDraft,imageDraft,imageSending,imageSendError,chooseChatFile,sendFileDraft,fileDraft,fileSending,fileSendError,fileRefused,messagesReady,scrollToLatest,groupScrolled,groupTouchStarted,groupTouchEnded,groupHasNew,get groupAtBottom(){return groupAtBottom},markOpened(){opened=true}};')
 const state=factory(ref,computed,adapters.nextTick||(()=>Promise.resolve()),apiChatSend,apiChatMessages,async()=>({data:conv}),x=>x,f=>hooks.show=f,f=>hooks.hide=f,f=>hooks.unload=f,uni,adapters.toast||(()=>{}),()=>{},ref(adapters.screen||1),watch,mediaScope,adapters.experience||{account:{id:7,staffGrants:[]}},()=> 'unit-token',
  adapters.sendPrivateImage,adapters.pickChatFile,adapters.uploadChatFile,files.fileProblem,files.extOf,files.sizeLabel,adapters.alert||(async()=>{}),()=>({mp:false}))
 state.conv.value=conv
 return Object.assign(state,{calls,hooks,keys,selectorQueries,messageRequests,observe:watch})
}
function deferred(){let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b});return {promise,resolve,reject}}
test('group initial history selects the group end anchor after messages render',async()=>{
 const h=harness({screen:2,messages:async()=>({data:{rows:[{msgId:1,content:'早期消息'},{msgId:30,content:'最新消息'}],lastId:30}})})
 await h.loadMessages(true);await Promise.resolve()
 assert.equal(h.scrollTarget.value,'group-end')
 assert.equal(h.msgs.value.at(-1).content,'最新消息')
})
// 2026-11-15: a reader scrolling history must own the viewport, even while async work finishes.
test('a touch before the render tick cancels a pending automatic jump to the latest message',async()=>{
 const tick=deferred(),h=harness({screen:2,nextTick:()=>tick.promise})
 const scrolling=h.scrollToLatest({force:true});h.groupTouchStarted();tick.resolve();await scrolling
 assert.notEqual(h.scrollTarget.value,'group-end','a queued callback must not undo the reader touch')
 assert.equal(h.groupAtBottom,false)
})
test('a pending scroll cannot apply after leaving or changing conversations',async()=>{
 for(const leave of [h=>h.hooks.hide(),h=>{h.conv.value={convId:2,type:'group',status:'active'}}]){
  const tick=deferred(),h=harness({screen:2,nextTick:()=>tick.promise})
  const scrolling=h.scrollToLatest({force:true});leave(h);tick.resolve();await scrolling
  assert.notEqual(h.scrollTarget.value,'group-end')
 }
})
test('reading group history survives a new message, a refresh and keyboard layout changes',async()=>{
 let round=0
 const h=harness({screen:2,messages:async()=>({data:++round===1?{rows:[{msgId:1,content:'原消息'}],lastId:1}:{rows:[{msgId:2,content:'新消息'}],lastId:2}})})
 await h.loadMessages(true);await Promise.resolve();h.groupTouchStarted()
 const jumps=[];h.observe(h.scrollTarget,value=>jumps.push(value))
 await h.loadMessages(false);await Promise.resolve()
 assert.equal(h.groupHasNew.value,true,'new messages should offer a return-to-bottom action')
 assert.deepEqual(h.msgs.value.map(x=>x.msgId),[1,2]);assert.deepEqual(jumps,[])
 h.keyboardChanged({detail:{height:260}});await Promise.resolve()
 h.keyboardChanged({detail:{height:0}});await Promise.resolve()
 assert.deepEqual(jumps,[],'opening/closing the keyboard must not steal the reading position')
 await h.loadMessages(true);await Promise.resolve()
 assert.deepEqual(jumps,[],'a refresh after the initial history is not a request to jump')
 assert.equal(h.groupAtBottom,false)
 await h.scrollToLatest({force:true})
 assert.equal(h.scrollTarget.value,'group-end');assert.equal(h.groupHasNew.value,false)
})
test('an older group measurement cannot overwrite a newer history-reading position',async()=>{
 const h=harness({screen:2,deferMeasurements:true})
 h.groupScrolled({detail:{scrollTop:1800,scrollHeight:2400}})
 h.groupScrolled({detail:{scrollTop:600,scrollHeight:2400}})
 assert.equal(h.selectorQueries.length,2)
 h.selectorQueries[1]([{height:600},{height:2400},{scrollTop:600}])
 assert.equal(h.groupAtBottom,false)
 h.selectorQueries[0]([{height:600},{height:2400},{scrollTop:1800}])
 assert.equal(h.groupAtBottom,false,'stale near-bottom metrics must not reenable automatic following')
 await h.scrollToLatest();assert.notEqual(h.scrollTarget.value,'group-end')
})
test('a measurement from the previous conversation cannot change the current group follow state',()=>{
 const h=harness({screen:2,deferMeasurements:true})
 h.groupScrolled({detail:{scrollTop:200,scrollHeight:2400}})
 assert.equal(h.selectorQueries.length,1)
 h.conv.value={convId:2,type:'group',status:'active'}
 assert.equal(h.groupAtBottom,true)
 h.selectorQueries[0]([{height:600},{height:2400},{scrollTop:200}])
 assert.equal(h.groupAtBottom,true)
})
test('a finger still dragging near the bottom cannot be pulled back by an incoming message',async()=>{
 let round=0
 const h=harness({screen:2,deferMeasurements:true,messages:async()=>({data:{rows:[{msgId:++round,content:'收到的消息'}],lastId:round}})})
 await h.loadMessages(true);await new Promise(resolve=>setImmediate(resolve))
 h.selectorQueries.at(-1)([{height:600},{height:2400},{scrollTop:1800}])
 assert.equal(h.groupAtBottom,true)
 h.groupTouchStarted()
 h.groupScrolled({detail:{scrollTop:1790,scrollHeight:2400}})
 assert.equal(h.groupAtBottom,false,'the first few pixels of a drag must not reenable following')
 await h.loadMessages(false);await new Promise(resolve=>setImmediate(resolve))
 assert.equal(h.groupHasNew.value,true);assert.notEqual(h.scrollTarget.value,'group-end')
 h.groupTouchEnded()
 h.selectorQueries.at(-1)([{height:600},{height:2400},{scrollTop:1800}])
 assert.equal(h.groupAtBottom,true,'following may resume after releasing the finger at the bottom')
})
test('a tap at the bottom restores following, while ending a history drag keeps it paused',()=>{
 const h=harness({screen:2,deferMeasurements:true})
 h.groupTouchStarted();assert.equal(h.groupAtBottom,false)
 h.groupTouchEnded();assert.equal(h.selectorQueries.length,1)
 h.selectorQueries[0]([{height:600},{height:2400},{scrollTop:1800}])
 assert.equal(h.groupAtBottom,true,'a tap without any scroll event must not permanently disable following')
 h.groupTouchStarted();h.groupTouchEnded();assert.equal(h.selectorQueries.length,2)
 h.selectorQueries[1]([{height:600},{height:2400},{scrollTop:600}])
 assert.equal(h.groupAtBottom,false)
})
test('duplicate keyboard height events do not retrigger a scroll',async()=>{
 const h=harness({screen:2})
 h.keyboardChanged({detail:{height:260}});await Promise.resolve()
 const jumps=[];h.observe(h.scrollTarget,value=>jumps.push(value))
 h.keyboardChanged({detail:{height:260}});await Promise.resolve()
 assert.deepEqual(jumps,[])
 assert.equal(h.keyboardHeight.value,260)
})
test('returning to a loaded group fetches incrementally and retains earlier loaded history',async()=>{
 const h=harness({screen:2,messages:async(_id,after)=>({data:after===0?{rows:[{msgId:1,content:'最早已读'},{msgId:30,content:'初始末条'}],lastId:30}:after===30?{rows:[{msgId:40,content:'后来消息'}],lastId:40}:{rows:[],lastId:after}})})
 try{
  await h.loadMessages(true);await h.loadMessages(false);h.markOpened();h.groupTouchStarted();h.hooks.hide()
  await h.hooks.show();await Promise.resolve()
  assert.equal(h.messageRequests.at(-1).after,40,'onShow must not reload only the newest 30 messages')
  assert.deepEqual(h.msgs.value.map(x=>x.msgId),[1,30,40])
  assert.notEqual(h.scrollTarget.value,'group-end','returning from the background must retain a history reader position')
 }finally{h.hooks.hide()}
})
test('blank, over-limit, closed and blocked messages never call the adapter',async()=>{
 const h=harness()
 // 2026-10-16 起每条最多 2000 字（之前 500）
 for(const text of ['','   ','字'.repeat(2001)]){h.draft.value=text;assert.equal(h.canSend.value,false);await h.sendDraft()}
 for(const patch of [{status:'closed'},{status:'active',blocked:true}]){Object.assign(h.conv.value,patch);h.draft.value='需要沟通';assert.equal(h.canSend.value,false);await h.sendDraft()}
 assert.deepEqual(h.calls,[])
})
test('2000-character message is allowed (raised from 500)',async()=>{
 const h=harness();h.draft.value='字'.repeat(2000);assert.equal(h.canSend.value,true);await h.sendDraft()
 assert.equal(h.calls.length,1);assert.equal(h.calls[0].text.length,2000)
})
test('slow successful send locks duplicate clicks and preserves newer draft',async()=>{
 const gate=deferred();let calls=0;const h=harness({send:()=>{calls++;return gate.promise}})
 h.draft.value='第一条';const first=h.sendDraft();assert.equal(h.sending.value,true);assert.equal(h.canSend.value,false)
 await h.sendDraft();h.draft.value='接着输入第二条';gate.resolve({data:{msgId:1}});await first
 assert.equal(calls,1);assert.equal(h.draft.value,'接着输入第二条');assert.equal(h.sending.value,false);assert.equal(h.canSend.value,true)
})
test('successful send clears submitted draft only after server acknowledgement',async()=>{
 const gate=deferred();const h=harness({send:()=>gate.promise});h.draft.value='中文🙂\n第二行';const request=h.sendDraft()
 assert.equal(h.draft.value,'中文🙂\n第二行');gate.resolve({data:{msgId:1}});await request;assert.equal(h.draft.value,'')
})
test('failed send retains draft, exposes error and unlocks retry without fake bubble',async()=>{
 const h=harness({send:async()=>{throw Error('网络失败')}});h.draft.value='不能丢';await h.sendDraft()
 assert.equal(h.draft.value,'不能丢');assert.equal(h.sendError.value,'网络失败');assert.equal(h.sending.value,false);assert.equal(h.canSend.value,true);assert.deepEqual(h.msgs.value,[])
})
test('quick phrase keeps existing draft in private and group conversations',async()=>{
 for(const type of ['private','group']){const h=harness({screen:type==='group'?2:1});h.conv.value.type=type;h.draft.value='正在写的内容';await h.send('快捷短语');assert.equal(h.draft.value,'正在写的内容');assert.deepEqual(h.calls,[{id:1,text:'快捷短语'}])}
})
test('overlapping poll responses merge actual message IDs without duplicate bubbles',async()=>{
 const a=deferred(),b=deferred();let n=0;const h=harness({messages:()=>n++===0?a.promise:b.promise})
 const first=h.loadMessages(false),second=h.loadMessages(false)
 b.resolve({data:{rows:[{msgId:11,content:'新消息'},{msgId:10,content:'旧消息'}],lastId:11}});await second
 a.resolve({data:{rows:[{msgId:10,content:'旧消息'}],lastId:10}});await first
 assert.deepEqual(h.msgs.value.map(x=>x.msgId),[10,11])
})
test('late initial response cannot erase a newer successful poll',async()=>{
 const a=deferred(),b=deferred();let n=0;const h=harness({messages:()=>n++===0?a.promise:b.promise})
 const first=h.loadMessages(true),second=h.loadMessages(false)
 b.resolve({data:{rows:[{msgId:20,content:'新消息'}],lastId:20}});await second
 a.resolve({data:{rows:[{msgId:18,content:'旧消息'}],lastId:18}});await first
 assert.deepEqual(h.msgs.value.map(x=>x.msgId),[18,20])
})
test('message loading failure is visible and recoverable without erasing existing records',async()=>{
 let n=0;const h=harness({messages:async()=>{if(n++===0)throw Error('暂时离线');return {data:{rows:[{msgId:2,content:'恢复消息'}],lastId:2}}}})
 h.msgs.value=[{msgId:1,content:'已显示消息'}];await h.loadMessages(false);assert.equal(h.messageError.value,'暂时离线');assert.equal(h.msgs.value.length,1)
 await h.loadMessages(false);assert.equal(h.messageError.value,'');assert.deepEqual(h.msgs.value.map(x=>x.msgId),[1,2])
})
test('keyboard event adjusts page space, hides safe gap and resets on leaving',async()=>{
 const h=harness();h.keyboardChanged({detail:{height:260}});await Promise.resolve();assert.equal(h.keyboardHeight.value,260);assert.equal(h.scrollTarget.value,'conversation-end')
 h.hooks.hide();assert.equal(h.keyboardHeight.value,0)
})
test('confirm event uses newest input even before model throttling catches up',async()=>{
 const h=harness();h.draft.value='旧文字';await h.sendDraft({detail:{value:'旧文字加最后几个字🙂'}})
 assert.deepEqual(h.calls,[{id:1,text:'旧文字加最后几个字🙂'}]);assert.equal(h.draft.value,'')
})
test('queued H5 model input cannot refill a successfully sent draft',async()=>{
 const h=harness();h.draft.value='快速粘贴';const request=h.sendDraft();setTimeout(()=>h.draft.value='快速粘贴',50)
 await request;assert.equal(h.draft.value,'')
})
test('long draft height is capped and shrinks back after send',async()=>{
 const h=harness();h.inputLinesChanged({detail:{height:600}});assert.equal(h.inputHeight.value,112)
 h.inputLinesChanged({detail:{height:0}});assert.equal(h.inputHeight.value,26)
 h.inputLinesChanged({detail:{height:80}});h.draft.value='三行';await h.sendDraft();assert.equal(h.inputHeight.value,26)
})
test('lost acknowledgement retry uses the same logical key; success starts a new message',async()=>{
 let n=0;const h=harness({send:async()=>{if(n++===0)throw Error('ACK lost');return {data:{msgId:9}}}})
 h.draft.value='已保存但响应丢失';await h.sendDraft();assert.equal(h.draft.value,'已保存但响应丢失');await h.sendDraft()
 assert.match(h.keys[0],/^[a-z0-9_-]{16,64}$/);assert.equal(h.keys[0],h.keys[1]);assert.equal(h.draft.value,'')
 h.draft.value='已保存但响应丢失';await h.sendDraft();assert.notEqual(h.keys[2],h.keys[1])
})
test('editing failed content and changing back creates a new logical ID',async()=>{
 const h=harness({send:async()=>{throw Error('offline')}});h.draft.value='原文';await h.sendDraft()
 h.draft.value='更正';h.draft.value='原文';await h.sendDraft();assert.notEqual(h.keys[0],h.keys[1])
})
test('same text in a different conversation cannot reuse its previous attempt',async()=>{
 const h=harness({send:async()=>{throw Error('offline')}});h.draft.value='原文';await h.sendDraft()
 h.conv.value={convId:2,type:'store',status:'active'};h.conv.value={convId:1,type:'store',status:'active'}
 await h.sendDraft();assert.notEqual(h.keys[0],h.keys[1])
})
test('failed group quick phrase also retries with a stable ID without erasing the draft',async()=>{
 const h=harness({screen:2,send:async()=>{throw Error('offline')}});h.conv.value.type='group';h.draft.value='继续写'
 await h.send('我到了');await h.send('我到了');assert.equal(h.keys[0],h.keys[1]);assert.equal(h.draft.value,'继续写')
})

// 2026-10-16 内测反馈 2.0：拍照或选图后图片没发出去。手机上打开相册 / 相机 / 聊天记录，本页先 onHide（作用域作废），
// 选完回来时「选择结果」和 onShow 谁先到各机型不一样（安卓常常是结果先到）。之前结果先到就被悄悄丢掉；
// 现在只核对身份（登录、账号、会话、授权），不看页面是否可见；选完直接发，页面还在后台就等 onShow 再发。
const flush=()=>new Promise(r=>setImmediate(r))
function picker(extra={}){
 const pick={},uploads=[],toasts=[]
 const h=harness({chooseImage:o=>Object.assign(pick,o),toast:m=>toasts.push(m),
  sendPrivateImage:(convId,path,key)=>{uploads.push({convId,path,key});return extra.upload?extra.upload(uploads.length):Promise.resolve({code:200})},...extra})
 return {h,pick,uploads,toasts}
}
const PHOTO={tempFilePaths:['wxfile://tmp/photo.jpg'],tempFiles:[{size:2*1024*1024}]}
test('hide before success (Android order): the picked photo is kept and sent once when the page shows again',async()=>{
 const gate=deferred(),{h,pick,uploads,toasts}=picker({upload:()=>gate.promise})
 try{
  const chosen=h.chooseChatImage()
  // 默认压缩图，相册里可以勾「原图」
  assert.deepEqual(pick.sizeType,['original','compressed'])
  h.hooks.hide()                 // 打开相册：页面先隐藏
  pick.success(PHOTO)            // 选择结果比 onShow 先到
  await chosen
  assert.equal(h.imageDraft.value.path,'wxfile://tmp/photo.jpg','选完的图不能被丢掉')
  assert.equal(uploads.length,0,'页面还在后台，先不发')
  h.hooks.show()
  assert.equal(uploads.length,1,'回到前台直接发，不用再点「发送图片」')
  assert.equal(uploads[0].convId,1);assert.equal(h.imageSending.value,true)
  gate.resolve({code:200});await flush()
  assert.equal(h.imageDraft.value,null);assert.equal(h.imageSending.value,false);assert.deepEqual(toasts,[])
  h.hooks.show();await flush();assert.equal(uploads.length,1,'再切一次前后台不会重发')
 }finally{h.hooks.hide()}
})
test('show before success (iOS order): the photo is sent right after picking',async()=>{
 const {h,pick,uploads}=picker()
 try{
  const chosen=h.chooseChatImage();h.hooks.hide();h.hooks.show();pick.success(PHOTO);await chosen;await flush()
  assert.equal(uploads.length,1);assert.equal(h.imageDraft.value,null)
 }finally{h.hooks.hide()}
})
test('identity change while the picker is open shows a toast instead of silently dropping or sending',async()=>{
 // 账号换了：这里不触发页面的 watch，靠选完时直接核对身份
 const exp={account:{id:7,staffGrants:[]}}
 const a=picker({experience:exp})
 try{
  const chosen=a.h.chooseChatImage();a.h.hooks.hide();exp.account={id:8,staffGrants:[]};a.pick.success(PHOTO);await chosen;a.h.hooks.show();await flush()
  assert.equal(a.uploads.length,0);assert.equal(a.h.imageDraft.value,null);assert.deepEqual(a.toasts,['会话已变化，刚选的没有发出，请重新选择'])
 }finally{a.h.hooks.hide()}
 // 授权变了也一样
 const exp2={account:{id:7,staffGrants:[]}},b=picker({experience:exp2})
 try{
  const chosen=b.h.chooseChatImage();b.h.hooks.hide();exp2.account.staffGrants=[{storeId:1,role:'keeper'}];b.pick.success(PHOTO);await chosen;b.h.hooks.show();await flush()
  assert.equal(b.uploads.length,0);assert.equal(b.toasts.length,1)
 }finally{b.h.hooks.hide()}
 // 会话换了
 const c=picker()
 try{
  const chosen=c.h.chooseChatImage();c.h.hooks.hide();c.h.conv.value={convId:2,type:'store',status:'active'};c.pick.success(PHOTO);await chosen;c.h.hooks.show();await flush()
  assert.equal(c.uploads.length,0);assert.equal(c.h.imageDraft.value,null);assert.equal(c.toasts.length,1)
 }finally{c.h.hooks.hide()}
})
test('cancelled picker does nothing and shows no toast',async()=>{
 const {h,pick,uploads,toasts}=picker()
 try{const chosen=h.chooseChatImage();h.hooks.hide();pick.fail({errMsg:'chooseImage:fail cancel'});h.hooks.show();await chosen;await flush()
  assert.equal(uploads.length,0);assert.equal(h.imageDraft.value,null);assert.deepEqual(toasts,[])}
 finally{h.hooks.hide()}
})
test('failed auto-send keeps the retry bar; retry reuses the same message ID',async()=>{
 const {h,pick,uploads}=picker({upload:n=>n===1?Promise.reject(new Error('图片发送结果无法确认，可点击重试')):Promise.resolve({code:200})})
 try{
  const chosen=h.chooseChatImage();pick.success(PHOTO);await chosen;await flush()
  assert.equal(uploads.length,1);assert.ok(h.imageDraft.value);assert.equal(h.imageSendError.value,'图片发送结果无法确认，可点击重试');assert.equal(h.imageSending.value,false)
  await h.sendImageDraft()
  assert.equal(uploads.length,2);assert.equal(uploads[0].key,uploads[1].key);assert.equal(h.imageDraft.value,null)
 }finally{h.hooks.hide()}
})
test('leaving the app mid-upload keeps the image with a retry message',async()=>{
 const gate=deferred(),{h,pick,uploads}=picker({upload:()=>gate.promise})
 try{
  h.chooseChatImage();pick.success(PHOTO);await flush()
  assert.equal(h.imageSending.value,true);h.hooks.hide()
  assert.ok(h.imageDraft.value);assert.equal(h.imageSending.value,false);assert.match(h.imageSendError.value,/重试/)
  gate.reject(new Error('interrupted'));await flush();h.hooks.show();await flush()
  assert.ok(h.imageDraft.value,'回来还能点「重试」');assert.equal(uploads.length,1)
 }finally{h.hooks.hide()}
})
test('file picker: hide before success also survives, then sends once; refused files keep only 取消',async()=>{
 const pickGate=deferred(),sends=[],upGate=deferred()
 const h=harness({pickChatFile:()=>pickGate.promise,uploadChatFile:(convId,f,key)=>{sends.push({convId,name:f.name,key});return upGate.promise}})
 try{
  const chosen=h.chooseChatFile();h.hooks.hide()
  pickGate.resolve({path:'wxfile://tmp/a.pdf',name:'报名材料.pdf',size:1024});await chosen
  assert.equal(h.fileDraft.value.name,'报名材料.pdf');assert.equal(sends.length,0)
  h.hooks.show();assert.equal(sends.length,1);assert.equal(h.fileSending.value,true)
  upGate.reject(Object.assign(new Error('只能发 zip / rar / 7z 压缩包和 PDF、Word、Excel、PPT 文件'),{code:422}));await flush()
  assert.ok(h.fileDraft.value);assert.equal(h.fileRefused.value,true,'服务端明确拒收：不显示「重试」')
 }finally{h.hooks.hide()}
})
test('file picker: identity change toasts; local type check still alerts before anything is sent',async()=>{
 const exp={account:{id:7,staffGrants:[]}},toasts=[],alerts=[],sends=[]
 let next=null
 const h=harness({experience:exp,toast:m=>toasts.push(m),alert:(t,m)=>{alerts.push(m)},pickChatFile:()=>Promise.resolve(next),uploadChatFile:()=>{sends.push(1);return Promise.resolve({})}})
 try{
  next={path:'x',name:'安装包.exe',size:10};await h.chooseChatFile();assert.equal(alerts.length,1);assert.equal(h.fileDraft.value,null)
  next={path:'y',name:'合同.docx',size:10};const p=h.chooseChatFile();h.hooks.hide();exp.account={id:9,staffGrants:[]};await p
  assert.deepEqual(toasts,['会话已变化，刚选的没有发出，请重新选择']);assert.equal(h.fileDraft.value,null);assert.equal(sends.length,0)
 }finally{h.hooks.hide()}
})

// Permanent deferred private image regressions use this project's actual SFC.
{
const {parse,babelParse}=createRequire(new URL('../package.json',import.meta.url))('@vue/compiler-sfc');
const script=parse(source).descriptor.scriptSetup.content;
const ast=babelParse(script,{sourceType:'module'});
function declaration(name){const node=ast.program.body.find(n=>n.type==='FunctionDeclaration'&&n.id.name===name);assert.ok(node,name);return script.slice(node.start,node.end);}
function harness(){
 let finish,released=0;const binary=new Promise(r=>finish=r);
 const c={Map,Set,Promise,Number,String,Array,JSON,Error,
  privateImage:()=>binary,
  apiChatMessages:async()=>({data:{rows:[{msgId:7,type:'text',content:'消息已撤回'}],lastId:7}}),
  toast:()=>{},uni:{pageScrollTo:()=>{}},scrollToLatest:()=>{},resetChatScroll:()=>{},
  chatScope:{capture:()=>({convId:2}),current:()=>true,invalidate:()=>{}},
  loadImage:null
 };vm.createContext(c);
 vm.runInContext(`let choosing=0,lastId=7,pendingSend=null;
 const mediaUrls={value:{}},mediaErrors={value:{}},mediaLoading=new Map(),mediaResources=new Map(),mediaVersions=new Map();let previewSequence=0;
 const imagePreview={value:null},imageSaveError={value:''},imageSaving={value:true};
 const imageDraft={value:null},imageSending={value:false},imageSendError={value:''};
 const msgs={value:[{msgId:7,type:'image'}]},draft={value:''},sending={value:false},messagesReady={value:true},messageError={value:''},conv={value:{convId:2}},s={value:1};
 ${declaration('closeImagePreview')}
 ${declaration('releaseImages')}
 ${declaration('clearPrivateState')}
 ${declaration('imageLease')}
 ${declaration('imageCurrent')}
 ${declaration('invalidateImage')}
 ${declaration('loadImage')}
 ${declaration('previewImageMessage')}
 ${declaration('loadMessages')}
 this.api={loadImage,previewImageMessage,loadMessages,clearPrivateState,closeImagePreview,mediaUrls,mediaResources,imagePreview,imageSaving,msgs};`,c);
 return {api:c.api,finish:()=>finish({url:'blob:already-authorized-before-recall',release:()=>released++}),released:()=>released};
}
test('late thumbnail cannot restore a message invalidated by a newer real list response',async()=>{
 const h=harness(),pending=h.api.loadImage({msgId:7});
 await h.api.loadMessages(false);assert.equal(h.api.msgs.value[0].type,'text');
 h.finish();await pending;
 assert.equal(h.api.mediaUrls.value['7'],undefined);
 assert.equal(h.released(),1);
});
test('late preview cannot reopen a message invalidated by a newer real list response',async()=>{
 const h=harness(),pending=h.api.previewImageMessage({msgId:7});
 await h.api.loadMessages(false);assert.equal(h.api.msgs.value[0].type,'text');
 h.finish();await pending;
 assert.equal(h.api.imagePreview.value,null);
 assert.equal(h.released(),1);
});
test('identity/private-state reset releases an in-flight save busy flag',()=>{
 const h=harness();assert.equal(h.api.imageSaving.value,true);h.api.clearPrivateState();assert.equal(h.api.imageSaving.value,false);
});
test('current image thumbnail still renders after its authorized response',async()=>{const h=harness(),pending=h.api.loadImage({msgId:7});h.finish();await pending;assert.equal(h.api.mediaUrls.value['7'],'blob:already-authorized-before-recall');assert.equal(h.released(),0)});
test('current image preview opens but explicitly closed pending preview cannot reopen',async()=>{const a=harness(),ok=a.api.previewImageMessage({msgId:7});a.finish();await ok;assert.equal(a.api.imagePreview.value.msgId,7);const b=harness(),stale=b.api.previewImageMessage({msgId:7});b.api.closeImagePreview();b.finish();await stale;assert.equal(b.api.imagePreview.value,null);assert.equal(b.released(),1)});

// 2026-10-15 主人反馈（门店员工以为是接单人都在的群聊）：员工这一侧对方的消息也带「接单人 / 报名人 · 昵称」，和同事的「接待 · 昵称」分开；报名人那一侧不变
function labels(){
 const c={};vm.createContext(c);
 vm.runInContext(`const conv={value:{}};${declaration('senderLabel')};this.api={conv,senderLabel};`,c);
 return c.api;
}
test('store seats see the taker or applicant labelled, colleagues stay labelled as reception',()=>{
 const {conv,senderLabel}=labels();
 conv.value={type:'store',myRole:'store',sourceLabel:'线上任务'};
 assert.equal(senderLabel({role:'user',name:'雪兔子',mine:false}),'接单人 · 雪兔子');
 assert.equal(senderLabel({role:'store',name:'黑子',mine:false}),'接待 · 黑子');
 assert.equal(senderLabel({role:'store',name:'我自己',mine:true}),'');
 assert.equal(senderLabel({role:'system',name:'系统',mine:false}),'');
 conv.value={type:'store',myRole:'store',sourceLabel:'报名进度'};
 assert.equal(senderLabel({role:'user',name:'小林',mine:false}),'报名人 · 小林');
});
test('applicant side and private chats get no taker label; reception label is unchanged',()=>{
 const {conv,senderLabel}=labels();
 conv.value={type:'store',myRole:'member',sourceLabel:'线上任务'};
 assert.equal(senderLabel({role:'user',name:'雪兔子',mine:true}),'');
 assert.equal(senderLabel({role:'store',name:'黑子',mine:false}),'接待 · 黑子');
 conv.value={type:'private',myRole:'member',sourceLabel:'同行匹配'};
 assert.equal(senderLabel({role:'user',name:'小周',mine:false}),'');
});
// 2026-10-16：发布这个线上任务的专员发的，服务端给 seatLabel = 专员，两边都写「专员 · 昵称」；没有 seatLabel 照旧「接待」
test('specialist seat label replaces reception label only when the server marks it',()=>{
 const {conv,senderLabel}=labels();
 conv.value={type:'store',myRole:'member',sourceLabel:'线上任务'};
 // 2026-11-03 统一叫法：报名人 / 接单人这一侧内部岗位名写「袋鼠工作人员」，门店员工那一侧照旧
 assert.equal(senderLabel({role:'store',name:'阿青',seatLabel:'专员',mine:false}),'袋鼠工作人员 · 阿青');
 assert.equal(senderLabel({role:'store',name:'阿东',seatLabel:'换工主理人',mine:false}),'当地主理人 · 阿东');
 assert.equal(senderLabel({role:'store',name:'黑子',mine:false}),'接待 · 黑子');
 conv.value={type:'store',myRole:'store',sourceLabel:'线上任务'};
 assert.equal(senderLabel({role:'store',name:'阿青',seatLabel:'专员',mine:false}),'专员 · 阿青');
 assert.equal(senderLabel({role:'store',name:'阿青',seatLabel:'专员',mine:true}),'');
});
test('file messages render as a card; only store conversations offer files; inputs allow 2000 characters',()=>{
 const template=parse(source).descriptor.template.content;
 assert.ok(template.includes(`<view v-else-if="x.type === 'file' && x.file" class="file-card"`));
 assert.ok(template.includes('@click="openFileMessage(x)"'));
 assert.ok(template.includes('name="plus"'));
 assert.ok(template.includes('@click="chooseAttachment"'));
 assert.equal((template.match(/:maxlength="CHAT_TEXT_MAX"/g)||[]).length,2);
 assert.ok(!template.includes(':maxlength="500"'));
 assert.ok(template.includes('JPG / PNG，不超过20MB'));
 const script=parse(source).descriptor.scriptSetup.content;
 assert.match(script,/const CHAT_TEXT_MAX = 2000/);
 assert.match(script,/file\?\.size>20\*1024\*1024\)return toast\('请选择不超过20MB的图片'\)/);
 assert.match(script,/import \{[^}]*pickChatFile[^}]*\} from '\.\/chat-files\.js'/);
 // 私信、活动群的「图片」按钮不弹选项，直接选图
 assert.match(declaration('chooseAttachment'),/if \(conv\.value\.type !== 'store'\) return chooseChatImage\(\)/);
});
// 2026-10-16 内测反馈 2.0：「···」（举报 / 安全提醒 / 拉黑）从输入栏挪到顶栏右侧；输入栏只剩附件、输入框、发送
test('conversation menu lives in the top bar right slot; the composer row has attachment, input, emoji and send',()=>{
 const template=parse(source).descriptor.template.content
 assert.match(template,/<k-topbar :title="topTitle" back><template #right><view v-if="conv\.convId" class="chat-more" hover-class="k-press"[^>]*@click="conversationActions"><k-icon name="ellipsis"/)
 assert.equal((template.match(/conversationActions/g)||[]).length,1)
 const start=template.indexOf('<view class="composer-row">'),row=template.slice(start,template.indexOf('</template>',start))
 assert.deepEqual([...row.matchAll(/class="(composer-[a-z]+)"/g)].map(m=>m[1]),['composer-row','composer-photo','composer-field','composer-input','composer-tool','composer-send'])
 assert.doesNotMatch(template,/conversation-more/)
 // 选完直接发：待发条平时不再有「发送图片 / 发送文件」这一步
 assert.doesNotMatch(template,/'发送图片'|'发送文件'/)
 const css=parse(source).descriptor.styles.map(s=>s.content).join('\n').replace(/\r\n/g,'\n')
 assert.match(css,/\/\* #ifdef MP-WEIXIN \*\/\n\.is-conversation :deep\(\.k-navbar__title\)\{left:48px;right:calc\(var\(--chat-cap, 97px\) \+ 50px\)/)
})
test('message rows render the computed label and the notice shows even without a subtitle',()=>{
 const template=parse(source).descriptor.template.content;
 assert.ok(template.includes('<text v-if="senderLabel(x)" class="message-sender">{{ senderLabel(x) }}</text>'));
 assert.ok(!template.includes('接待 · {{ x.name }}'));
 assert.ok(template.includes(`<view v-if="conv.type === 'store' && (conv.otherMeta || conv.receptionNotice)" class="conversation-meta"><text v-if="conv.otherMeta">{{ conv.otherMeta }}</text>`));
});

}
