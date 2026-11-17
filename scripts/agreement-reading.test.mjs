import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import { createRequire } from 'node:module'
import { advanceRead } from '../common/agreement-progress.js'
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
    experience:{account:null},R:{legal:'/legal'},advanceRead,errText:e=>e.message,toast:()=>{},...overrides})
  vm.createContext(sandbox);const scope=vue.effectScope()
  scope.run(()=>vm.runInContext(ast.program.body.filter(n=>n.type!=='ImportDeclaration').map(n=>source.slice(n.start,n.end)).join('\n'),sandbox))
  return {events,hooks,props:reactiveProps,run:code=>vm.runInContext(code,sandbox),stop(){hooks.unmounted?.();hooks.unload?.();scope.stop()}}
}
test('从正文顶部开始并读到底；无效几何、仅打开末尾不计为完成',()=>{
 let s={started:false};assert.equal(advanceRead(s,1200,400,1600).done,false)
 s=advanceRead(s,0,400,1600);assert.equal(s.done,false)
 s=advanceRead(s,600,400,1600);assert.equal(s.done,false)
 assert.equal(advanceRead(s,1200,400,1600).done,true)
 for(const args of [[0,0,10],[0,10,0],[-1,10,20],[NaN,10,20]])assert.equal(advanceRead(s,...args),s)
 assert.equal(advanceRead({started:false},0,400,300).done,true)
})
test('阅读器只计屏幕内正文；换版本重新锁定，销毁后异步测量不放行',async t=>{
 let rows=[{top:900,bottom:1300,height:400},{height:1600}], callback
 const query={in(){return this},select(){return this},boundingClientRect(){return this},exec(fn){callback=fn;fn(rows)}}
 const h=setup('components/k-agreement-reader/k-agreement-reader.vue',{uni:{createSelectorQuery:()=>query,getWindowInfo:()=>({windowHeight:844}),createIntersectionObserver:()=>{throw Error()}}},{contentKey:'v1',text:'full'});t.after(h.stop)
 h.run('measure()');assert.equal(h.run('complete.value'),false)
 rows=[{top:100,bottom:500,height:400},{height:1600}];h.run('measure();scrollTop=1200;measure()');assert.equal(h.run('complete.value'),true)
 h.props.contentKey='v2';assert.equal(h.run('complete.value'),false);assert.equal(h.events.at(-1)[1],false)
 await vue.nextTick();h.run('scrollTop=1200;measure()');assert.equal(h.run('complete.value'),false)
 h.stop();callback(rows);assert.equal(h.run('complete.value'),false)
})
for(const [file,id] of [['pages/staff/components/merchant-agreement.vue',{storeId:12,type:'stay'}],['pages/jobs/components/departure-notice.vue',{appId:12}]]) {
 test(file+'：直接调用确认也不能绕过阅读，读完且勾选后才提交',async t=>{
  let writes=0;const h=setup(file,{post:async()=>{writes++;return{data:{accepted:true}}}},id);t.after(h.stop)
  h.run("doc.value={html:'全文',version:'v1'};agreed.value=true");await h.run('accept()');assert.equal(writes,0)
  h.run('markRead(true);agreed.value=true');await h.run('accept()');assert.equal(writes,1)
  h.run('markRead(false)');assert.equal(h.run('agreed.value'),false)
 })
}
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
test('三方协议：预览未读不得签署；版本或报名改变后原预览失效',async t=>{
 let writes=0;const h=setup('pages/jobs/components/tripartite-sign.vue',{post:async()=>{writes++;return{data:{record:{status:'pending'}}}}},{appId:1,doc:{version:'v1',body:'全文'}});t.after(h.stop)
 h.run("preview.value={hash:'h',text:'全文'};agree.value=true");await h.run('submit()');assert.equal(writes,0)
 h.run('onPreviewRead(true);agree.value=true');h.props.appId=2;assert.equal(h.run('preview.value'),null);assert.equal(h.run('previewRead.value'),false);assert.equal(h.run('agree.value'),false)
 h.run("preview.value={hash:'h2',text:'全文'};onPreviewRead(true);agree.value=true");await h.run('submit()');assert.equal(writes,1)
})
test('店家：读完仍需本人勾选、签署姓名；未读也不能退回',async t=>{
 let writes=0;const h=setup('pages/staff/components/volunteer-contract.vue',{post:async()=>{writes++;return{data:{}}}},{appId:1});t.after(h.stop)
 h.run("doc.value={record:{contractId:1}};name.value='店长';reason.value='需补全'");await h.run("decide('confirm');decide('reject')");assert.equal(writes,0)
 h.run('markRead(true)');await h.run("decide('confirm')");assert.equal(writes,0)
 h.run('agree.value=true');await h.run("decide('confirm')");assert.equal(writes,1)
})
test('预订：直接调用支付不能绕过须知，新报价清除同意状态',async t=>{
 let writes=0;const h=setup('pages/stays/pay.vue',{apiStayCreateOrder:async()=>{writes++},todayCn:()=> '2026-11-15'});t.after(h.stop)
 h.run("q.value={bookable:true,agreement:{title:'预订须知'}};quoteLoading.value=false;quotedKey.value=JSON.stringify(quoteParams());agreed.value=true")
 assert.equal(h.run('quoteReady.value'),true);await h.run('toPay()');assert.equal(writes,0);assert.equal(h.run('submitting.value'),false)
 h.run('onNoticeRead(true);agreed.value=true;onNoticeRead(false)');assert.equal(h.run('agreed.value'),false)
})
