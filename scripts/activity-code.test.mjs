import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {activityId,parseActivityScene,activityLanding,activityLoginQuery,loginActivityReturn,codeMessage,previewActivityCode} from '../common/activity-code.js'

test('both existing checkin tokens and Long IDs roundtrip without Number loss',()=>{
 assert.deepEqual(parseActivityScene('a_1y2p0ij32e8e7'),{id:'9223372036854775807',checkin:'',scene:'a_1y2p0ij32e8e7',channel:'group'})
 for(const token of ['0123456789ab','0123456789abcdef'])assert.equal(parseActivityScene('c_1y2p0ij32e8e7_'+token).checkin,token)
 assert.equal(parseActivityScene('c%5Fa%5F0123456789ab').id,'10')
 assert.equal(activityLanding({id:'9007199254740993'}).id,'9007199254740993')
})
test('invalid ambiguous overlong and overflow scenes fail closed',()=>{
 for(const scene of ['',null,'a_0','a_01','a_-1','a_1_0123456789ab','c_1','c_1_123','a_1y2p0ij32e8e8','a_zzzzzzzzzzzzz','c_1_0123456789ABCDEf','a%255F1','a_%','https://evil/','c_1_0123456789ab_extra'])assert.throws(()=>parseActivityScene(scene))
 assert.throws(()=>activityLanding({scene:'a_1',id:'2'}));assert.throws(()=>activityLanding({scene:'a_1',signupId:'2'}))
 for(const id of ['-1','0','1e3','9007199254740993x','9223372036854775808'])assert.throws(()=>activityId(id))
})
test('login intent permits only strict activity path and preserves exact token',()=>{
 for(const landing of [parseActivityScene('c_1y2p0ij32e8e7_0123456789abcdef'),activityLanding({id:'9007199254740993',checkin:'0123456789ab'})]){
  const query=Object.fromEntries(new URLSearchParams(activityLoginQuery(landing).slice(1)));const path=loginActivityReturn(query)
  assert(path.startsWith('/pages/community/activity?'));const restored=activityLanding(Object.fromEntries(new URLSearchParams(path.split('?')[1])))
  assert.equal(restored.id,landing.id);assert.equal(restored.checkin,landing.checkin)
 }
 assert.equal(loginActivityReturn({returnUrl:'https://evil/'}),'');assert.throws(()=>loginActivityReturn({activityScene:'https://evil/'}))
 assert.throws(()=>loginActivityReturn({activityScene:'a_1',activityId:'2'}))
})
test('mock, missing and failure never preview an image',async()=>{
 let calls=0;globalThis.uni={previewImage(){calls++}};globalThis.wx={env:{USER_DATA_PATH:'/tmp'}}
 for(const code of [undefined,{state:'mock',image:'data:image/png;base64,aA=='},{state:'error',image:'data:image/png;base64,aA=='},{state:'ready',image:'/static/fake.jpg'}])await assert.rejects(previewActivityCode(code,'1'))
 assert.equal(calls,0);assert.match(codeMessage({state:'mock'}),/未调用微信/)
})
// Execute actual page load/resume/detail logic with explicit adapters. Real HTTP/H5 remains separate.
function pageHarness(account=null){
 const src=readFileSync(new URL('../pages/community/activity.vue',import.meta.url),'utf8');let hook;const calls=[],navigation=[]
 const ref=v=>({value:v}),experience={account},useScreen=(_,opts)=>{hook=opts.onLoad;return ref(1)}
 const load=src.slice(src.indexOf('const s = useScreen'),src.indexOf("const DEFAULT_IMG"))
 const detail=src.slice(src.indexOf('const detail = ref'),src.indexOf('const open ='))
 const factory=new Function('ref','useScreen','ensureSession','activityLanding','activityLoginQuery','experience','go','R','apiActivity','alert','fail','memberActivityId','memberActivityVouchers','apiMemberWallet',load+detail+';return {hook:()=>0,pendingCheckin,checkinMessage,landingError,resumeCheckin,detail};')
 const state=factory(ref,useScreen,async()=>{},activityLanding,activityLoginQuery,experience,x=>navigation.push(x),{login:'/pages/auth/login'},async(id,q)=>{calls.push({id,q});return{data:{activityId:id,host:{chips:[]},...(q.checkin?{checkin:'签到成功'}:{})}}},async()=>{},()=>{},ref(null),ref([]),async()=>({data:{rows:[]}}))
 return {state,load:q=>hook(q),calls,navigation,experience}
}
test('actual page guest scan retains intent and navigates to safe login then resumes same request',async()=>{
 const h=pageHarness();await h.load({scene:'c_1y2p0ij32e8e7_0123456789abcdef'})
 assert.equal(h.calls[0].id,'9223372036854775807');assert.equal(h.calls[0].q.checkin,undefined)
 assert.equal(h.state.pendingCheckin.value.checkin,'0123456789abcdef');await h.state.resumeCheckin()
 assert.match(h.navigation[0],/^\/pages\/auth\/login\?activityScene=/)
 h.experience.account={id:7};await h.state.resumeCheckin();assert.equal(h.calls[1].id,'9223372036854775807');assert.equal(h.calls[1].q.checkin,'0123456789abcdef');assert.equal(h.state.pendingCheckin.value,null);assert.equal(h.state.checkinMessage.value,'签到成功')
})
test('actual page rejects malformed scene before any activity API',async()=>{
 const h=pageHarness({id:7});await h.load({scene:'c_bad'});assert.equal(h.calls.length,0);assert.match(h.state.landingError.value,/无效/)
})
test('group scene is read-only activity landing and never checkin or automatic membership',async()=>{
 const h=pageHarness({id:7});await h.load({scene:'a_z'});assert.equal(h.calls[0].id,'35');assert.equal(h.calls[0].q.checkin,undefined);assert.equal(h.state.pendingCheckin.value,null)
})

test('actual login completion returns to retained activity intent; bind-phone remains profile scoped',()=>{
 const src=readFileSync(new URL('../pages/auth/login.vue',import.meta.url),'utf8');const logic=src.slice(src.indexOf('const completeEntry ='),src.indexOf('const profileNickname='))
 const destinations=[],factory=new Function('bindOnly','activityReturn','employeeEntry','hasStaffAccess','loginError','R','switchMode','relaunch',logic+';return completeEntry;')
 const bindOnly={value:false},ret={value:loginActivityReturn({activityScene:'c_1_0123456789ab'})}
 const complete=factory(bindOnly,ret,{value:false},{value:false},{value:''},{profile:'/pages/profile/index',home:'/pages/home/index'},()=>'/staff',x=>destinations.push(x))
 complete();assert.equal(destinations[0],'/pages/community/activity?scene=c_1_0123456789ab');bindOnly.value=true;complete();assert.equal(destinations[1],'/pages/profile/index?s=4')
})
async function platformCode(native){
 let src=readFileSync(new URL('../common/activity-code.js',import.meta.url),'utf8')
 src=src.replace(/\/\/ #ifdef MP-WEIXIN\n([\s\S]*?)\/\/ #endif/g,(_,body)=>native?body:'').replace(/\/\/ #ifndef MP-WEIXIN\n([\s\S]*?)\/\/ #endif/g,(_,body)=>native?'':body)
 return import('data:text/javascript;base64,'+Buffer.from(src).toString('base64'))
}
test('actual H5 preview uses only validated returned image and exposes preview failure',async()=>{
 const code=await platformCode(false),info={state:'ready',image:'data:image/png;base64,aA=='};let calls=[]
 globalThis.uni={previewImage(o){calls.push(o.urls);o.success()}};await code.previewActivityCode(info,'1');assert.deepEqual(calls,[[info.image]])
 globalThis.uni={previewImage(o){o.fail()}};await assert.rejects(code.previewActivityCode(info,'1'),/打开失败/)
})
test('actual native adapter writes only validated filename and fails closed before preview on file error',async()=>{
 const code=await platformCode(true),info={state:'ready',image:'data:image/png;base64,aA=='};let files=[],previews=[]
 globalThis.wx={env:{USER_DATA_PATH:'/safe/user'}};globalThis.uni={getFileSystemManager:()=>({writeFile(o){files.push({file:o.filePath,data:o.data,encoding:o.encoding});o.success()}}),previewImage(o){previews.push(o.urls);o.success()}}
 await code.previewActivityCode(info,'9223372036854775807');assert.deepEqual(files,[{file:'/safe/user/activity-code-9223372036854775807.png',data:'aA==',encoding:'base64'}]);assert.deepEqual(previews,[[files[0].file]])
 await assert.rejects(code.previewActivityCode(info,'../escape'));assert.equal(files.length,1)
 globalThis.uni.getFileSystemManager=()=>({writeFile(o){o.fail()}});await assert.rejects(code.previewActivityCode(info,'1'),/保存失败/);assert.equal(previews.length,1)
})
