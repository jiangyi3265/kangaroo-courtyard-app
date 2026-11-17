import test from 'node:test'
import assert from 'node:assert/strict'
import {featureState,refreshFeatures,stayBookingPage} from '../common/features.js'
import {publicShare,timelineShare,showPublicShareMenu} from '../common/public-share.js'
test.afterEach(()=>{featureState.stayBookingEnabled=false;delete globalThis.uni;delete globalThis.getCurrentPages})
test('lodging closes on invalid booleans, HTTP errors, business errors and network errors',async()=>{
 for(const data of [undefined,{}, {stayBookingEnabled:'true'}, {stayBookingEnabled:1}, {stayBookingEnabled:true}]){
  globalThis.uni={request:o=>o.success({statusCode:200,data:{code:200,data}})};await refreshFeatures(true);assert.equal(featureState.stayBookingEnabled,data?.stayBookingEnabled===true)
 }
 for(const request of [o=>o.fail(),o=>o.success({statusCode:500,data:{code:200,data:{stayBookingEnabled:true}}}),o=>o.success({statusCode:200,data:{code:500,data:{stayBookingEnabled:true}}})]){
  featureState.stayBookingEnabled=true;globalThis.uni={request};await refreshFeatures(true);assert.equal(featureState.stayBookingEnabled,false)
 }
})
test('cached lodging shares close; existing orders and jobs remain routable',()=>{
 for(const p of ['list','detail','booking','pay','reviews','diary','past-activities']){
  const path='/pages/stays/'+p+'?stayId=42';assert(stayBookingPage(path));assert.equal(publicShare(path,{},'旧房源').path,'/pages/home/index');assert.equal(timelineShare({path}).query,'')
 }
 for(const p of ['/pages/stays/order?orderNo=1','/pages/profile/orders','/pages/jobs/detail?jobId=1','/pages/staff/stay-orders'])assert.equal(stayBookingPage(p),false)
 featureState.stayBookingEnabled=true;assert.equal(publicShare('/pages/stays/detail',{stayId:42}).path,'/pages/stays/detail?stayId=42')
})
test('native share menus hide while closed and restore when opened',()=>{
 const calls=[];globalThis.getCurrentPages=()=>[{route:'pages/stays/detail'}];globalThis.uni={hideShareMenu:()=>calls.push('hide'),showShareMenu:()=>calls.push('show')}
 showPublicShareMenu();featureState.stayBookingEnabled=true;showPublicShareMenu();assert.deepEqual(calls,['hide','show'])
})
