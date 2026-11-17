import test from 'node:test'
import assert from 'node:assert/strict'
import { featureState, refreshFeatures } from '../common/features.js'
import { publicShare, timelineShare, showPublicShareMenu } from '../common/public-share.js'
test.afterEach(()=>{for(const key of ['communityEnabled','wishEnabled','groupChatEnabled','privateChatEnabled','stayBookingEnabled'])featureState[key]=false;delete globalThis.uni;delete globalThis.getCurrentPages})
test('independent server switches accept strict booleans only',async()=>{
 for(const data of [{communityEnabled:true,wishEnabled:false,groupChatEnabled:true,privateChatEnabled:true,stayBookingEnabled:true},{wishEnabled:true,groupChatEnabled:false},{wishEnabled:'true',groupChatEnabled:1,privateChatEnabled:"true",stayBookingEnabled:"true"},{}]){
  globalThis.uni={request:o=>o.success({statusCode:200,data:{code:200,data}})};await refreshFeatures(true)
  for(const key of ['communityEnabled','wishEnabled','groupChatEnabled','privateChatEnabled','stayBookingEnabled'])assert.equal(featureState[key],data[key]===true)
 }
})
test('all switches fail closed on network failure or invalid HTTP response',async()=>{
 for(const request of [o=>o.fail(),o=>o.success({statusCode:503,data:{code:200,data:{wishEnabled:true,groupChatEnabled:true,privateChatEnabled:true,stayBookingEnabled:true}}})]){
  featureState.privateChatEnabled=featureState.wishEnabled=featureState.groupChatEnabled=true;globalThis.uni={request};await refreshFeatures(true);assert.equal(featureState.wishEnabled,false);assert.equal(featureState.groupChatEnabled,false);assert.equal(featureState.privateChatEnabled,false)
 }
})
test('disabled wish links and both share menus cannot expose cached content',()=>{
 for(const path of ['/pages/wish/index','/pages/wish/detail?id=42','/pages/wish/publish']){
  const shared=publicShare(path,{},'旧心愿标题','https://example.test/cached.jpg');assert.equal(shared.path,'/pages/home/index');assert.equal(timelineShare(shared).query,'')
 }
 const calls=[];globalThis.getCurrentPages=()=>[{route:'pages/wish/detail'}];globalThis.uni={hideShareMenu:()=>calls.push('hide'),showShareMenu:()=>calls.push('show')}
 showPublicShareMenu();featureState.wishEnabled=true;showPublicShareMenu();assert.deepEqual(calls,['hide','show'])
 assert.equal(publicShare('/pages/wish/detail',{id:42}).path,'/pages/wish/detail?id=42')
})
