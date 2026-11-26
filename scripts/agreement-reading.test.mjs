import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import { createRequire } from 'node:module'
import { advanceRead, readingClock, AGREEMENT_READ_SECONDS } from '../common/agreement-progress.js'
import { readPercent, nextRead } from '../pages/jobs/contract-read.js'
const require=createRequire(import.meta.url), vue=require('vue'), compiler=require('@vue/compiler-sfc')
const root=new URL('../',import.meta.url)
function setup(file, overrides={}, props={}) {
  const {descriptor,errors}=compiler.parse(fs.readFileSync(new URL(file,root),'utf8'));assert.deepEqual(errors,[])
  const keep=[], lines=descriptor.scriptSetup.content.split('\n').filter(line=>{
    const m=/^\s*\/\/\s*#(ifdef|ifndef|endif)\b\s*([\w-]*)/.exec(line)
    if(m){if(m[1]==='endif')keep.pop();else keep.push(m[1]==='ifdef'?m[2]==='MP-WEIXIN':m[2]!=='MP-WEIXIN');return false}return keep.every(Boolean)
  }), source=lines.join('\n'), ast=compiler.babelParse(source,{sourceType:'module'})
  const events=[], hooks={}, reactiveProps=vue.reactive(props), sandbox={console,setTimeout,clearTimeout,URL,JSON,Date,Math,Promise,String,Number,Boolean}
  for(const n of ast.program.body.filter(n=>n.type==='ImportDeclaration')) for(const s of n.specifiers)sandbox[s.local.name]=()=>{}
  Object.assign(sandbox,{...vue,defineProps:()=>reactiveProps,defineEmits:()=>(...args)=>events.push(args),defineExpose:()=>{},
    getCurrentInstance:()=>({proxy:{}}),onMounted:fn=>hooks.mounted=fn,onBeforeUnmount:fn=>hooks.unmounted=fn,onUnmounted:fn=>hooks.unmounted=fn,
    onLoad:fn=>hooks.load=fn,onUnload:fn=>hooks.unload=fn,onShow:()=>{},useScreen:()=>vue.ref(1),getCurrentPages:()=>[],
    experience:{account:null},R:{legal:'/legal'},advanceRead,readingClock,AGREEMENT_READ_SECONDS,errText:e=>e.message,toast:()=>{},...overrides})
  vm.createContext(sandbox);const scope=vue.effectScope()
  scope.run(()=>vm.runInContext(ast.program.body.filter(n=>n.type!=='ImportDeclaration').map(n=>source.slice(n.start,n.end)).join('\n'),sandbox))
  return {events,hooks,props:reactiveProps,run:code=>vm.runInContext(code,sandbox),stop(){hooks.unmounted?.();hooks.unload?.();scope.stop()}}
}
test('倒计时最后一次刷新前切走，返回后仍能解锁', t => {
  t.mock.timers.enable({ apis: ['Date', 'setTimeout'], now: 0 })
  let seconds
  const clock = readingClock(n => { seconds = n })
  clock.start()
  t.mock.timers.tick(4200)
  assert.equal(seconds, 1)
  t.mock.timers.setTime(5100)
  clock.pause()
  t.mock.timers.tick(10000)
  clock.start()
  assert.equal(seconds, 0)
  clock.reset()
  assert.equal(seconds, AGREEMENT_READ_SECONDS)
})
test('互助规则页底部采用正文的实际倒计时，滚到底才可确认', t => {
  t.mock.timers.enable({ apis: ['Date', 'setTimeout'], now: 0 })
  const file = 'pages/wish/rules.vue'
  const markup = compiler.parse(fs.readFileSync(new URL(file,root),'utf8')).descriptor.template.content
  const page = setup(file)
  const handlers = Object.fromEntries([...markup.matchAll(/@(read|remaining)="([^"]+)"/g)].map(([,name,body]) => [name,body]))
  const rows = [{top:900,bottom:1200,height:300},{height:730}]
  const query = { in(){return this}, select(){return this}, boundingClientRect(){return this}, exec(fn){fn(rows)} }
  const reader = setup('components/k-agreement-reader/k-agreement-reader.vue', {
    // 模板会自动解包 ref，脚本沙箱中的同一赋值需要写入 .value。
    defineEmits: () => (event,value) => page.run(handlers[event].replace(' = $event', '.value = ' + JSON.stringify(value))),
    uni: { createSelectorQuery:()=>query, getWindowInfo:()=>({windowHeight:800}) }
  })
  t.after(() => { reader.stop(); page.stop() })
  reader.run('measure()')
  t.mock.timers.tick(6000)
  assert.equal(page.run('remaining.value'), 5)
  rows[0] = {top:0,bottom:300,height:300}
  reader.run('measure()')
  t.mock.timers.tick(2000)
  assert.equal(page.run('remaining.value'), 3)
  t.mock.timers.tick(3000)
  assert.equal(page.run('canConfirm.value'), false)
  reader.run('scrollTop = 430; measure()')
  assert.equal(page.run('canConfirm.value'), true)
})
test('从正文顶部开始并读到底；无效几何、仅打开末尾不计为完成',()=>{
 let s={started:false};assert.equal(advanceRead(s,1200,400,1600).done,false)
 s=advanceRead(s,0,400,1600);assert.equal(s.done,false)
 s=advanceRead(s,600,400,1600);assert.equal(s.done,false)
 assert.equal(advanceRead(s,1200,400,1600).done,true)
 for(const args of [[0,0,10],[0,10,0],[-1,10,20],[NaN,10,20]])assert.equal(advanceRead(s,...args),s)
 assert.equal(advanceRead({started:false},0,400,300).done,true)
})
test('阅读器只计屏幕内正文；换版本重新锁定，销毁后异步测量不放行',async t=>{
 t.mock.timers.enable({apis:['Date','setTimeout']});
 let rows=[{top:900,bottom:1300,height:400},{height:1600}], callback
 const query={in(){return this},select(){return this},boundingClientRect(){return this},exec(fn){callback=fn;fn(rows)}}
 const h=setup('components/k-agreement-reader/k-agreement-reader.vue',{uni:{createSelectorQuery:()=>query,getWindowInfo:()=>({windowHeight:844}),createIntersectionObserver:()=>{throw Error()}}},{contentKey:'v1',text:'full'});t.after(h.stop)
 h.run('measure()');assert.equal(h.run('complete.value'),false)
 rows=[{top:100,bottom:500,height:400},{height:1600}];h.run('measure();scrollTop=1200;measure()');assert.equal(h.run('complete.value'),false)
 t.mock.timers.tick(4999);assert.equal(h.run('complete.value'),false)
 t.mock.timers.tick(250);assert.equal(h.run('complete.value'),true)
 h.props.contentKey='v2';assert.equal(h.run('complete.value'),false);assert.equal(h.events.at(-1)[1],false)
 await vue.nextTick();h.run('scrollTop=1200;measure()');assert.equal(h.run('complete.value'),false)
 h.stop();callback(rows);assert.equal(h.run('complete.value'),false)
})
test('原生容器回报到底时，最后一次像素测量有偏差也能确认，隐藏和旧版本事件不算', async t => {
  t.mock.timers.enable({apis:['Date','setTimeout']})
  const rows = [{top:100,bottom:500,height:400},{height:1600}]
  const query = {in(){return this},select(){return this},boundingClientRect(){return this},exec(fn){fn(rows)}}
  const reader = setup('components/k-agreement-reader/k-agreement-reader.vue', {
    uni:{createSelectorQuery:()=>query,getWindowInfo:()=>({windowHeight:800})}
  }, {contentKey:'v1'})
  t.after(reader.stop)
  reader.run('measure(); scrollTop = 1170; measure()')
  t.mock.timers.tick(5200)
  assert.equal(reader.run('complete.value'),false)
  rows[0] = {top:500,bottom:900,height:400}
  reader.run('nativeBottom({currentTarget:{dataset:{version:generation.value}}})')
  rows[0] = {top:100,bottom:500,height:400}
  reader.run('measure()')
  assert.equal(reader.run('complete.value'),false)
  reader.run('nativeBottom({currentTarget:{dataset:{version:generation.value}}})')
  assert.equal(reader.run('complete.value'),true)
  const oldVersion = reader.run('generation.value')
  reader.props.contentKey = 'v2'
  await vue.nextTick()
  reader.run('measure(); scrollTop = 1170')
  t.mock.timers.tick(5200)
  reader.run('nativeBottom({currentTarget:{dataset:{version:' + oldVersion + '}}})')
  assert.equal(reader.run('complete.value'),false)
  reader.run('scroll({currentTarget:{dataset:{version:'+oldVersion+'}},detail:{scrollTop:1200}})')
  t.mock.timers.tick(100)
  assert.equal(reader.run('complete.value'),false)
  reader.run('scroll({currentTarget:{dataset:{version:generation.value}},detail:{scrollTop:1200}})')
  t.mock.timers.tick(100)
  assert.equal(reader.run('complete.value'),true)
})
test('正文末行进入视口后，迟到的滚动距离不会卡住已读确认', t => {
  t.mock.timers.enable({apis:['Date','setTimeout']})
  const rows=[{top:100,bottom:500,height:400},{top:100,bottom:1700,height:1600}]
  const query={in(){return this},select(){return this},boundingClientRect(){return this},exec(fn){fn(rows)}}
  const reader=setup('components/k-agreement-reader/k-agreement-reader.vue',{
    uni:{createSelectorQuery:()=>query,getWindowInfo:()=>({windowHeight:800})}
  })
  t.after(reader.stop)
  reader.run('measure()');t.mock.timers.tick(5200)
  rows[0]={top:550,bottom:950,height:400};rows[1]={top:-650,bottom:950,height:1600}
  reader.run('scrollTop=1160;nativeBottom({currentTarget:{dataset:{version:generation.value}}})')
  assert.equal(reader.run('complete.value'),false)
  rows[0]={top:100,bottom:500,height:400};rows[1]={top:-1100,bottom:500,height:1600}
  reader.run('measure()')
  assert.equal(reader.run('complete.value'),true)
})
test('订房短须知全部可见时不必滚动底部空白，末行被遮挡仍需继续阅读', t => {
  t.mock.timers.enable({apis:['Date','setTimeout']})
  const rects={'.ar-scroll':{top:512,bottom:560,height:48},'.ar-body':{top:512,bottom:570,height:58},
    '.ar-text':{top:528,bottom:554,height:26}}
  const query=()=>{const selectors=[];return {
    in(){return this},select(name){selectors.push(name);return this},boundingClientRect(){return this},
    exec(fn){fn(selectors.map(name=>rects[name]))}
  }}
  const reader=setup('components/k-agreement-reader/k-agreement-reader.vue',{
    uni:{createSelectorQuery:query,getWindowInfo:()=>({windowHeight:844})}
  },{text:'本人办理入住。'})
  t.after(reader.stop)
  reader.run('measure()');t.mock.timers.tick(4500)
  assert.equal(reader.run('complete.value'),false)
  t.mock.timers.tick(600)
  assert.equal(reader.run('complete.value'),true)
  rects['.ar-text']={top:528,bottom:640,height:112}
  rects['.ar-body']={top:512,bottom:656,height:144}
  reader.props.text='正文分多行，最后一行尚未进入视口。'
  reader.run('measure()');t.mock.timers.tick(5200)
  assert.equal(reader.run('complete.value'),false)
})
for(const [file,id] of [['pages/staff/components/merchant-agreement.vue',{storeId:12,type:'stay'}],['pages/jobs/components/departure-notice.vue',{appId:12}]]) {
 test(file+'：换门店或报名后，旧协议的加载不能把面板重新弹出来', async t => {
   let receive
   const experience=vue.reactive({account:{id:1},mode:'staff'})
   const h=setup(file,{experience,get:()=>new Promise(resolve=>{receive=resolve})},{...id})
   t.after(h.stop)
   const submitted=h.run('confirm()')
   if ('storeId' in id) h.props.storeId=13
   else h.props.appId=13
   await vue.nextTick()
   receive({data:{html:'旧协议',version:'1',accepted:true}})
   assert.equal(await submitted,false)
   assert.equal(h.run('visible.value'),false)
   assert.equal(h.run('doc.value'),null)
   const opening=h.run('open()')
   receive({data:{html:'当前协议',version:'2',accepted:false}})
   await opening
   experience.account={id:1,nickname:'资料已更新'}
   assert.equal(h.run('visible.value'),true)
   experience.account={id:2}
   assert.equal(h.run('visible.value'),false)
   assert.equal(h.run('doc.value'),null)
 })
 if ('storeId' in id) {
   test('商家合作协议正文加载后立即可勾选；必须主动同意当前生效的协议',async t=>{
     let writes=0
     const h=setup(file,{post:async()=>{writes++;return {data:{accepted:true}}}},id);t.after(h.stop)
     h.run("agreed.value=true");await h.run('accept()');assert.equal(writes,0)
     h.run("doc.value={html:'全文',version:'v1',draft:true}");await h.run('accept()');assert.equal(writes,0)
     h.run("doc.value.draft=false;agreed.value=false");await h.run('accept()');assert.equal(writes,0)
     h.run('agreed.value=true');await h.run('accept()');assert.equal(writes,1)
   })
 } else {
   test(file+'：直接调用确认也不能绕过阅读，读完且勾选后才提交',async t=>{
     let writes=0;const h=setup(file,{post:async()=>{writes++;return{data:{accepted:true}}}},id);t.after(h.stop)
     h.run("doc.value={html:'全文',version:'v1'};agreed.value=true");await h.run('accept()');assert.equal(writes,0)
     h.run('markRead(true);agreed.value=true');await h.run('accept()');assert.equal(writes,1)
     h.run('markRead(false)');assert.equal(h.run('agreed.value'),false)
   })
 }
}
test('登录协议仅在有效正文加载且用户点击后返回当前版本，无需计时、滚动或重复点击',async t=>{
 let resolve,back=0;const events=[]
 const h=setup('pages/auth/legal.vue',{apiLegal:()=>new Promise(r=>{resolve=r}),uni:{navigateBack(){back++}},
    getCurrentInstance:()=>({proxy:{getOpenerEventChannel:()=>({emit:(...args)=>events.push(args)})}})})
 t.after(h.stop)
 const first=h.run('load()')
 h.run('finishRead()');assert.equal(back,0)
 resolve({data:{configured:true,version:'v1',html:'  '}});await first
 h.run('finishRead()');assert.equal(back,0)
 const second=h.run('load()')
 resolve({data:{configured:true,version:'v2',html:'<p>协议全文</p>'}});await second
 assert.equal(events.length,0)
 h.run('finishRead();finishRead()');assert.equal(back,1)
 assert.deepEqual(JSON.parse(JSON.stringify(events)),[['read',{key:'privacy',version:'v2'}]])
})
test('登录：两份当前版本均读完才能勾选；旧版本和只读一份无效',async t=>{
 const nav=[],toasts=[],h=setup('pages/auth/login.vue',{uni:{navigateTo:o=>nav.push(o)},toast:m=>toasts.push(m)});t.after(h.stop)
 h.run("legalReady.value=true;legalVersions.value={termsVersion:'terms-v1',privacyVersion:'privacy-v1'};toggleAgreement()");assert.equal(h.run('agreed.value'),false)
 h.run("openLegal('terms')");nav.pop().events.read({key:'terms',version:'old'});assert.equal(h.run('legalRead.value'),false)
 h.run("openLegal('terms')");nav.pop().events.read({key:'terms',version:'terms-v1'});h.run('toggleAgreement()');assert.equal(h.run('agreed.value'),false)
 h.run("openLegal('privacy')");nav.pop().events.read({key:'privacy',version:'privacy-v1'});assert.equal(h.run('legalRead.value'),true)
 h.run('toggleAgreement()');assert.equal(h.run('agreed.value'),true)
 h.run("legalVersions.value.termsVersion='terms-v2'");assert.equal(h.run('requireLegal()'),false)
})
test('社区须知：返回或正文改版不会提交确认',async t=>{
 let writes=0,release;const h=setup('pages/community/consent.vue',{getToken:()=> 'test',apiCommunityRules:()=>new Promise(r=>release=r),apiCommunityConsent:async()=>{writes++},getCurrentInstance:()=>({proxy:{getOpenerEventChannel:()=>({emit(){}})}})});t.after(h.stop)
 h.run("session='test';doc.value={content:'旧正文'};agreed.value=true");await h.run('accept()');assert.equal(writes,0)
 h.run('markRead(true);agreed.value=true');let pending=h.run('accept()');release({data:{content:'新正文'}});await pending;assert.equal(writes,0);assert.equal(h.run('readComplete.value'),false)
 h.run('markRead(true);agreed.value=true');pending=h.run('accept()');h.hooks.unload();release({data:{content:'新正文'}});await pending;assert.equal(writes,0)
})
test('旧责任书读完后内容更新会清空阅读和勾选',async t=>{
 const h=setup('pages/jobs/contract.vue',{onPageScroll:()=>{},todayCn:()=> '2026-11-15'});t.after(h.stop)
 h.run("c.value={hash:'v1',terms:[{desc:'旧'}]};readMax.value=100;agreed.value=true;c.value={hash:'v2',terms:[{desc:'新'}]}")
 assert.equal(h.run('readPct.value'),0);assert.equal(h.run('agreed.value'),false)
})
test('责任书不可见时暂停计时，旧版本迟到的测量不会更新新条款', async t => {
  t.mock.timers.enable({ apis: ['Date', 'setTimeout'], now: 0 })
  const pending = []
  const query = { in() { return this }, select() { return this }, boundingClientRect(fn) { pending.push(fn); return this }, exec() {} }
  const h = setup('pages/jobs/contract.vue', { readPercent, nextRead, onPageScroll() {},
    uni: { createSelectorQuery: () => query, getWindowInfo: () => ({windowHeight: 800}) }
  })
  t.after(h.stop)
  const doc = version => h.run("c.value = { terms: [{desc:'条款'}], hash:'" + version + "' }")
  const measure = async rect => { const read = h.run('measureRead()'); pending.pop()(rect); return read }
  doc('v1')
  await measure({ top: 100, height: 1400 })
  await measure({ top: 900, height: 1400 })
  t.mock.timers.tick(6000)
  assert.equal(h.run('remaining.value'), AGREEMENT_READ_SECONDS)
  const late = h.run('measureRead()'), oldCallback = pending.pop()
  doc('v2')
  oldCallback({ top: 50, height: 100 })
  await late
  assert.equal(h.run('readPct.value'), 0)
  await measure({ top: 30, height: 600 })
  t.mock.timers.tick(5000)
  assert.equal(h.run('canSignRead.value'), true)
})
test('三方协议：预览未读不得签署；版本或报名改变后原预览失效',async t=>{
 let writes=0;const h=setup('pages/jobs/components/tripartite-sign.vue',{post:async()=>{writes++;return{data:{record:{status:'pending'}}}}},{appId:1,doc:{version:'v1',body:'全文'}});t.after(h.stop)
 h.run("preview.value={hash:'h',text:'全文'};agree.value=true");await h.run('submit()');assert.equal(writes,0)
 h.run('onPreviewRead(true);agree.value=true');h.props.appId=2;assert.equal(h.run('preview.value'),null);assert.equal(h.run('previewRead.value'),false);assert.equal(h.run('agree.value'),false)
 h.run("preview.value={hash:'h2',text:'全文'};onPreviewRead(true);agree.value=true");await h.run('submit()');assert.equal(writes,1)
})
test('三方协议：门店资料只读，补全后可预览，只提交甲方填写的内容', async t => {
  const file = 'pages/jobs/components/tripartite-sign.vue'
  const markup = compiler.parse(fs.readFileSync(new URL(file,root),'utf8')).descriptor.template.content
  const merchant = markup.slice(markup.indexOf('乙方：本次报名店家'),markup.indexOf('视频沟通内容核对'))
  assert.match(merchant,/storeInfo\[f\.key\]/)
  assert.doesNotMatch(merchant,/<input|<textarea|v-model/)
  let posted
  const h = setup(file,{post:async (url,body) => { posted=body;return {data:{hash:'test'}} }},{
    appId:1, doc:{status:'store_confirmed',defaults:{name:'甲方',phone:'13800000000',storeName:'小院',storeAddress:'一号路',storePhone:'13900000000'}}
  })
  t.after(h.stop)
  h.run("Object.assign(form,{idNo:'test',emergencyName:'联系人',emergencyPhone:'13700000000',health:'无',familyInformed:true,privacyAgreed:true,consistent:'yes'})")
  await h.run('makePreview()')
  assert.equal(posted,undefined)
  assert.match(h.run('error.value'),/店家/)
  h.props.doc.defaults.storeContact='店长'
  await h.run('makePreview()')
  assert.equal(h.run('storeInfo.value.storeContact'),'店长')
  assert.equal(posted.name,'甲方')
  assert.deepEqual(Object.keys(posted).filter(k=>k.startsWith('store')),[])
})
test('三方协议：门店改资料后不显示迟到的旧预览；离开签约页后不能继续提交', async t => {
  let resolvePreview, resolveNotice
  const writes=[]
  const h=setup('pages/jobs/components/tripartite-sign.vue',{
    post:(url,body)=>{writes.push(url);return new Promise(resolve=>{resolvePreview=resolve})}
  },{
    appId:33,beforeSign:()=>new Promise(resolve=>{resolveNotice=resolve}),
    doc:{version:'v1',body:'条款',status:'store_confirmed',defaults:{name:'甲',phone:'13800000000',storeName:'店',storeAddress:'地址',storeContact:'原联系人',storePhone:'13900000000'}}
  })
  t.after(h.stop)
  h.run("Object.assign(form,{idNo:'id',health:'无',emergencyPhone:'13500000000',emergencyName:'紧急联系人',familyInformed:true,privacyAgreed:true,consistent:'yes'})")
  const preview=h.run('makePreview()')
  h.props.doc.defaults.storeContact='新联系人'
  resolvePreview({data:{hash:'旧摘要',text:'旧联系人'}})
  await preview
  assert.equal(h.run('preview.value'),null)
  assert.equal(h.run('form.emergencyName'),'紧急联系人')
  h.run("preview.value={hash:'新摘要'};onPreviewRead(true);agree.value=true")
  const signing=h.run('submit()')
  h.hooks.unmounted?.()
  resolveNotice(true)
  await Promise.resolve()
  assert.equal(writes.length,1)
  await signing
})
test('三方协议：切换账号或签约页退到后台时，旧历史正文不会回填',async t=>{
  let hide, receive
  const experience=vue.reactive({account:{id:7}})
  const h=setup('pages/jobs/components/tripartite-sign.vue',{
    experience, onHide:callback=>{hide=callback}, get:()=>new Promise(resolve=>{receive=resolve})
  },{appId:1,doc:{defaults:{name:'原用户',phone:'13800000000'}}})
  t.after(h.stop)
  h.run("form.health='原用户健康告知';historyText.value='第一版'")
  const reading=h.run('readHistory(2)')
  assert.equal(h.run('historyText.value'),'')
  hide()
  receive({data:{contentMasked:'第二版'}})
  await reading
  assert.equal(h.run('historyText.value'),'')
  const next=h.run('readHistory(3)')
  experience.account={id:8}
  receive({data:{contentMasked:'第三版'}})
  await next
  assert.equal(h.run('historyText.value'),'')
  assert.equal(h.run('form.health'),'')
  assert.equal(h.run('form.name'),'')
})
test('店家核对：正文到齐后立即可操作，签署需姓名与勾选，退回需理由',async t=>{
 let writes=0;const h=setup('pages/staff/components/volunteer-contract.vue',{post:async()=>{writes++;return{data:{}}}},{appId:1});t.after(h.stop)
 h.run("doc.value={status:'store_confirmed',record:{contractId:1,status:'pending',contentHash:'v1'}};reason.value='需补全'")
 await h.run("decide('reject')");assert.equal(writes,0)
 h.run("doc.value.record.contentMasked='本次协议';reason.value=''")
 await h.run("decide('reject')");assert.equal(writes,0)
 h.run("name.value='店长'");await h.run("decide('confirm')");assert.equal(writes,0)
 h.run("agree.value=true;name.value=''");await h.run("decide('confirm')");assert.equal(writes,0)
 h.run("name.value='店长'");await h.run("decide('confirm')");assert.equal(writes,1)
})
test('店家核对新一版协议时清空旧签名和退回理由，同一版本刷新可保留草稿',async t=>{
  let record={contractId:11,contentHash:'v1',status:'pending'}
  const h=setup('pages/staff/components/volunteer-contract.vue',{get:async()=>({data:{record}})},{appId:1})
  t.after(h.stop)
  await h.run('open()')
  h.run("name.value='店长';reason.value='第一版的差异';agree.value=true")
  await h.run('load()')
  assert.equal(h.run('reason.value'),'第一版的差异')
  record={contractId:12,contentHash:'v2',status:'pending'}
  await h.run('load()')
  assert.equal(h.run('reason.value'),'')
  assert.equal(h.run('name.value'),'')
  assert.equal(h.run('agree.value'),false)
})
test('切换店家身份后旧协议不能回到页面',async t=>{
  const identity=vue.ref({storeId:1,roleCode:'keeper'})
  let receive
  const h=setup('pages/staff/components/volunteer-contract.vue',{
    currentStaffStore:identity,staffGrantKey:grant=>grant.storeId,get:()=>new Promise(resolve=>{receive=resolve})
  },{appId:1})
  t.after(h.stop)
  const pending=h.run('open()')
  identity.value={storeId:2,roleCode:'keeper'}
  receive({data:{record:{contractId:1,contentMasked:'原门店协议'}}})
  await pending
  assert.equal(h.run('doc.value'),null)
  assert.equal(h.run('opened.value'),false)
})
test('换账号后，原经办人签署的回执不会覆盖新账号的协议',async t=>{
  const experience=vue.reactive({account:{id:1},mode:'staff'})
  let receive
  const h=setup('pages/staff/components/volunteer-contract.vue',{
    experience,post:()=>new Promise(resolve=>{receive=resolve})
  },{appId:1})
  t.after(h.stop)
  h.run("doc.value={status:'store_confirmed',record:{contractId:1,contentHash:'v1',contentMasked:'本次协议',status:'pending'}};name.value='原经办人';agree.value=true")
  const saving=h.run("decide('confirm')")
  experience.account={id:2}
  receive({data:{record:{contractId:1,status:'confirmed'}}})
  await saving
  assert.equal(h.run('doc.value'),null)
  assert.equal(h.run('name.value'),'')
  assert.equal(h.events.length,0)
})
test('预订：直接调用支付不能绕过须知，新报价清除同意状态',async t=>{
 let writes=0;const h=setup('pages/stays/pay.vue',{apiStayCreateOrder:async()=>{writes++},todayCn:()=> '2026-11-15'});t.after(h.stop)
 h.run("q.value={bookable:true,agreement:{title:'预订须知'}};quoteLoading.value=false;quotedKey.value=JSON.stringify(quoteParams());agreed.value=true")
 assert.equal(h.run('quoteReady.value'),true);await h.run('toPay()');assert.equal(writes,0);assert.equal(h.run('submitting.value'),false)
 h.run('onNoticeRead(true);agreed.value=true;onNoticeRead(false)');assert.equal(h.run('agreed.value'),false)
})
