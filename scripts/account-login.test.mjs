import test from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'vite'
const server = await createServer({configFile:false,server:{middlewareMode:true,hmr:false}})
const {createAccountLogin,loginAccount}=await server.ssrLoadModule('/common/account-login.js')
const session=await server.ssrLoadModule('/common/experience.js')
const request=await server.ssrLoadModule('/common/request.js')
await server.close()
const versions={termsVersion:'1111111111111111',privacyVersion:'2222222222222222'},options={agreed:true,versions}
function fixture(overrides={}) {
 const calls=[],state={account:null,rev:0}
 const enter=createAccountLogin({restore:async()=>calls.push('restore'),login:async()=>{calls.push('login');state.account={id:'u1',phoneBound:false,staffGrants:[]}},account:()=>state.account,consent:async v=>calls.push(['consent',v]),revision:()=>state.rev,...overrides})
 return {enter,calls,state}
}
test('unbound account logs in without requesting a phone or optional profile',async()=>{
 const f=fixture(),a=await f.enter(options);assert.equal(a.id,'u1');assert.equal(a.phoneBound,false);assert.deepEqual(f.calls,['restore','login',['consent',versions]])
})
test('no agreement or incomplete legal documents never calls identity or consent APIs',async()=>{
 const f=fixture();for(const args of [{},{versions},{agreed:true},{agreed:true,versions:{...versions,privacyVersion:''}}])await assert.rejects(f.enter(args));assert.deepEqual(f.calls,[])
})
test('valid existing account is reused without consuming another login code',async()=>{
 const f=fixture();f.state.account={id:'u2',phoneBound:false};await f.enter(options);assert.deepEqual(f.calls,['restore',['consent',versions]])
})
test('repeated taps share one login operation',async()=>{
 let release;const f=fixture({restore:()=>new Promise(r=>release=r)}),a=f.enter(options),b=f.enter(options);assert.equal(a,b);release();await a;assert.equal(f.calls.filter(x=>x==='login').length,1)
})
test('a failed restore is not treated as permission to create another login',async()=>{
 const f=fixture({restore:async()=>{throw new Error('网络中断')}});await assert.rejects(f.enter(options),/网络中断/);assert.deepEqual(f.calls,[])
})
test('login failure is not automatically retried; a new explicit tap may retry',async()=>{
 let count=0;const f=fixture({login:async()=>{count++;throw new Error('登录过于频繁')}});await assert.rejects(f.enter(options),/频繁/);assert.equal(count,1);await assert.rejects(f.enter(options));assert.equal(count,2)
})
test('consent failure never reports login completion; retry reuses verified account',async()=>{
 let consentCalls=0;const f=fixture({consent:async()=>{if(++consentCalls===1)throw new Error('协议已更新')}});await assert.rejects(f.enter(options),/协议已更新/);await f.enter(options);assert.equal(consentCalls,2);assert.equal(f.calls.filter(x=>x==='login').length,1)
})
test('leaving the page or signing out prevents a late restore from logging in',async()=>{
 for(const logout of [false,true]){
  let release,current=true;const f=fixture({restore:()=>new Promise(r=>release=r)});const pending=f.enter({...options,isCurrent:()=>current});if(logout)f.state.rev++;else current=false;release();await assert.rejects(pending,/状态已变化/);assert.deepEqual(f.calls,[])
 }
})
test('leaving during login prevents consent and completion',async()=>{
 let release,current=true;const calls=[];const f=fixture({login:()=>new Promise(r=>{release=r}),consent:async()=>calls.push('consent')});const p=f.enter({...options,isCurrent:()=>current});await Promise.resolve();current=false;release();await assert.rejects(p,/状态已变化/);assert.deepEqual(calls,[])
})
test('returned accounts must have server identity',async()=>{
 const f=fixture({login:async()=>{}});await assert.rejects(f.enter(options),/未完成/);assert.equal(f.calls.length,1)
})
test('legal versions are captured before pending network work',async()=>{
 let release;const f=fixture({restore:()=>new Promise(r=>release=r)}),v={...versions},p=f.enter({agreed:true,versions:v});v.privacyVersion='3333333333333333';release();await p;assert.deepEqual(f.calls.at(-1),['consent',versions])
})
test('real session integration uses uni.login, server verification and consent, with zero phone requests',async()=>{
 const storage=new Map(),calls=[];let loginCount=0
 globalThis.uni={getStorageSync:k=>storage.get(k),setStorageSync:(k,v)=>storage.set(k,v),removeStorageSync:k=>storage.delete(k),login:o=>{loginCount++;o.success({code:'fresh-native-login-code'})},request:o=>{calls.push(o);queueMicrotask(()=>o.success({statusCode:200,data:o.url.endsWith('/wx-login')?{code:200,token:'isolated-login-token',account:{id:'ordinary-user',phoneBound:false,phone:'',staffGrants:[]}}:{code:200,data:{}}}))}}
 globalThis.getCurrentPages=()=>[{route:'pages/auth/login'}]
 session.logout();const a=await loginAccount(options)
 assert.equal(loginCount,1);assert.equal(a.id,'ordinary-user');assert.equal(a.phoneBound,false);assert.equal(session.experience.mode,'user');assert.equal(request.getToken(),'isolated-login-token')
 assert.deepEqual(calls.map(c=>new URL(c.url).pathname),['/app/auth/wx-login','/app/me/consent/legal']);assert.equal(calls[0].data.code,'fresh-native-login-code');assert.deepEqual(calls[1].data,versions)
 session.logout();delete globalThis.uni;delete globalThis.getCurrentPages
})
