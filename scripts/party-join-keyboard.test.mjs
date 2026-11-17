import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import { partyCode, partyPath } from '../common/party-code.js'

const helperSource=readFileSync(new URL('../pages/party/join-input.js',import.meta.url),'utf8').replace(/^import .*\r?\n/gm,'').replace(/export function /g,'function ')
const helpers=new Function('partyCode',helperSource+';return {readClipboardRoomCode,hideRoomKeyboard,openRoomPage}')(partyCode)
const pageSource=readFileSync(new URL('../pages/party/index.vue',import.meta.url),'utf8').split('<script setup>')[1].split('</script>')[0].replace(/^import .*\r?\n/gm,'')
const flush=async()=>{for(let n=0;n<5;n++)await Promise.resolve()}
function page(){
 const events=[],hooks={hide:[],unload:[]},calls={clipboard:0,keyboard:0,navigation:0},behavior={clipboard:async()=> '658127',keyboard:async()=>{},navigation:async()=>{}}
 const ref=value=>({value})
 const ctx=vm.createContext({ref,computed:fn=>({get value(){return fn()}}),watch:()=>{},onLoad:()=>{},onShow:()=>{},onHide:fn=>hooks.hide.push(fn),onUnload:fn=>hooks.unload.push(fn),onShareAppMessage:()=>{},
  useGameRoom:()=>({room:ref(null),error:ref(''),loading:ref(false),busy:ref(false),now:ref(0),act:()=>events.push('unexpected mutation'),refresh:()=>{},stop:()=>{}}),
  experience:{account:null},ensureSession:async()=>{},go:route=>events.push({go:route}),toast:message=>events.push({toast:message}),confirm:async()=>false,copy:()=>{},publicShare:()=>{},showPublicShareMenu:()=>{},partyCode,
  readClipboardRoomCode:()=>{calls.clipboard++;return behavior.clipboard()},hideRoomKeyboard:()=>{calls.keyboard++;return behavior.keyboard()},openRoomPage:route=>{calls.navigation++;events.push({go:route});return behavior.navigation()},api:{path:partyPath},uni:{redirectTo:()=>{}}
 })
 vm.runInContext(pageSource+';globalThis.state={joinCode,joinError,pasting,joining,pasteCode,join}',ctx)
 return {state:ctx.state,events,hooks,calls,behavior}
}

test('clipboard adapter only accepts a copied pure six-digit room code',async()=>{
 assert.equal(await helpers.readClipboardRoomCode({getClipboardData:({success})=>success({data:' 658127\n'})}),'658127')
 for(const value of ['', '012345', '6581279', '房间658127', 'https://bad.test/?code=658127','658127;ignore','６５８１２７']){
  await assert.rejects(helpers.readClipboardRoomCode({getClipboardData:({success})=>success({data:value})}),/剪贴板为空|请只复制6位房间号/)
 }
})

test('default adapters invoke the explicit uni APIs only when requested',async()=>{
 const calls=[]
 const platform={getClipboardData:({success})=>{calls.push('clipboard');success({data:'658127'})},hideKeyboard:({complete})=>{calls.push('keyboard');complete()}}
 const real=new Function('partyCode','uni',helperSource+';return {readClipboardRoomCode,hideRoomKeyboard}')(partyCode,platform)
 assert.deepEqual(calls,[])
 assert.equal(await real.readClipboardRoomCode(),'658127')
 await real.hideRoomKeyboard()
 assert.deepEqual(calls,['clipboard','keyboard'])
})

test('clipboard denial, unsupported API and thrown errors produce a usable manual fallback',async()=>{
 for(const platform of [{},{getClipboardData:({fail})=>fail({errMsg:'denied'})},{getClipboardData:()=>{throw Error('not supported')}}]){
  await assert.rejects(helpers.readClipboardRoomCode(platform),/长按输入框粘贴或手动输入房号/)
 }
})

test('opening the real page never reads clipboard; tapping paste fills without joining',async()=>{
 const f=page();assert.equal(f.calls.clipboard,0)
 await f.state.pasteCode()
 assert.equal(f.calls.clipboard,1);assert.equal(f.state.joinCode.value,'658127');assert.deepEqual(f.events,[])
 assert.equal(f.state.pasting.value,false)
})

test('paste is single-flight and a late reply cannot overwrite newly typed room code',async()=>{
 const f=page();let finish;f.behavior.clipboard=()=>new Promise(resolve=>{finish=resolve})
 const a=f.state.pasteCode(),b=f.state.pasteCode();assert.equal(f.calls.clipboard,1)
 f.state.joinCode.value='123456';finish('658127');await Promise.all([a,b])
 assert.equal(f.state.joinCode.value,'123456');assert.deepEqual(f.events,[])
})

test('failed paste preserves manual input; leaving discards late clipboard results',async()=>{
 const f=page();f.state.joinCode.value='123456';f.behavior.clipboard=async()=>{throw Error('请先复制房号')}
 await f.state.pasteCode();assert.equal(f.state.joinCode.value,'123456');assert.equal(f.state.joinError.value,'请先复制房号')
 let finish;f.behavior.clipboard=()=>new Promise(resolve=>{finish=resolve});const task=f.state.pasteCode()
 f.hooks.hide.forEach(fn=>fn());finish('658127');await task
 assert.equal(f.state.joinCode.value,'123456');assert.equal(f.state.pasting.value,false)
})

test('invalid manual input stays in place and provides an error before any navigation',async()=>{
 const f=page()
 for(const value of ['','12345','012345','658127&x=1']){f.state.joinCode.value=value;await f.state.join();assert.equal(f.state.joinError.value,'请输入6位房间号')}
 assert.equal(f.calls.keyboard,0);assert.deepEqual(f.events,[])
})

test('real join waits for keyboard dismissal, then navigates once even on duplicate confirmation',async()=>{
 const f=page();f.state.joinCode.value='658127';let finish
 f.behavior.keyboard=()=>new Promise(resolve=>{finish=resolve})
 const a=f.state.join(),b=f.state.join();assert.equal(f.calls.keyboard,1);assert.deepEqual(f.events,[])
 finish();await Promise.all([a,b]);assert.deepEqual(f.events,[{go:'/pages/party/index?code=658127&join=1'}]);assert.equal(f.state.joining.value,true)
 await f.state.join();assert.equal(f.calls.navigation,1)
 f.hooks.hide.forEach(fn=>fn());assert.equal(f.state.joining.value,false)
})

test('joining remains locked while navigation is pending, then failures permit an explicit retry',async()=>{
 const f=page();f.state.joinCode.value='658127';let fail
 f.behavior.navigation=()=>new Promise((resolve,reject)=>{fail=reject})
 const task=f.state.join();await flush();assert.equal(f.calls.navigation,1)
 await f.state.join();assert.equal(f.calls.navigation,1)
 fail(new Error('failed'));await task
 assert.equal(f.state.joining.value,false);assert.equal(f.state.joinError.value,'页面未能打开，请重试')
 f.behavior.navigation=async()=>{};await f.state.join();assert.equal(f.calls.navigation,2);assert.equal(f.state.joining.value,true)
})

test('room navigation replaces the lobby only for a full page stack and exposes other failures',async()=>{
 const calls=[]
 await helpers.openRoomPage('/pages/party/index?code=658127',{
  navigateTo:options=>{calls.push(['navigate',options.url]);options.fail({errMsg:'navigateTo:fail exceed the limit'})},
  redirectTo:options=>{calls.push(['redirect',options.url]);options.success()}
 })
 assert.deepEqual(calls,[['navigate','/pages/party/index?code=658127'],['redirect','/pages/party/index?code=658127']])
 await assert.rejects(helpers.openRoomPage('/pages/party/index?code=658127',{
  navigateTo:options=>options.fail(new Error('network unavailable')),redirectTo:()=>assert.fail('must not replace page on unrelated failure')
 }),/network unavailable/)
})

test('leaving the page while dismissing keyboard cancels late navigation',async()=>{
 const f=page();f.state.joinCode.value='658127';let finish
 f.behavior.keyboard=()=>new Promise(resolve=>{finish=resolve})
 const task=f.state.join();f.hooks.unload.forEach(fn=>fn());finish();await task
 assert.deepEqual(f.events,[]);assert.equal(f.state.joining.value,false)
})

test('keyboard adapter waits for completion and safely finishes on unsupported hosts',async()=>{
 let complete,done=false
 const task=helpers.hideRoomKeyboard({hideKeyboard:opts=>{complete=opts.complete}}).then(()=>{done=true})
 await flush();assert.equal(done,false);complete();await task;assert.equal(done,true)
 await helpers.hideRoomKeyboard({})
 await helpers.hideRoomKeyboard({hideKeyboard:()=>{throw Error('not supported')}})
 await helpers.hideRoomKeyboard({hideKeyboard:()=>{}})
})
