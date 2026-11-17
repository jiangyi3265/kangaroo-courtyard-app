import test from 'node:test'
import assert from 'node:assert/strict'
import { featureState, refreshFeatures, communityPage } from '../common/features.js'
import { publicShare, timelineShare, showPublicShareMenu } from '../common/public-share.js'
test.afterEach(() => { featureState.communityEnabled=false;featureState.stayBookingEnabled=false;delete globalThis.uni;delete globalThis.getCurrentPages })
test('first launch is closed without persisted or inferred permission',()=>assert.equal(featureState.communityEnabled,false))
test('only an explicit successful boolean true response can enable the feature',async()=>{
  for(const body of [{code:200,data:{communityEnabled:true}},{code:200,data:{communityEnabled:'true'}},{code:500,data:{communityEnabled:true}},{code:200,data:{}}]){
    globalThis.uni={request: o=>o.success({statusCode:200,data:body})}
    await refreshFeatures(true)
    assert.equal(featureState.communityEnabled,body.code===200&&body.data.communityEnabled===true)
  }
})
test('failed refresh closes a previously enabled feature and does not reuse stale storage',async()=>{
  featureState.communityEnabled=true;globalThis.uni={request:o=>o.fail({errMsg:'offline'})};await refreshFeatures(true);assert.equal(featureState.communityEnabled,false)
})
test('closed community shares cannot include cached post titles, pictures or identifiers',()=>{
  const result=publicShare('/pages/community/index',{postId:77},'cached private title','https://example.test/old.jpg')
  assert.equal(result.path,'/pages/home/index');assert.equal(result.title,'袋鼠全球青年');assert.equal(result.imageUrl,'/static/media/brand-kangaroo.png');assert.equal(timelineShare(result).query,'')
  featureState.stayBookingEnabled=true
  assert.equal(publicShare('/pages/stays/detail',{stayId:3}).path,'/pages/stays/detail?stayId=3')
})
test('closed deep links hide both sharing menus; enabled pages restore them',()=>{
  const calls=[];globalThis.getCurrentPages=()=>[{route:'pages/community/index'}];globalThis.uni={hideShareMenu:o=>calls.push(['hide',o]),showShareMenu:o=>calls.push(['show',o])}
  showPublicShareMenu();featureState.communityEnabled=true;showPublicShareMenu();assert.deepEqual(calls.map(x=>x[0]),['hide','show']);assert.deepEqual(calls[0][1].menus,['shareAppMessage','shareTimeline'])
  assert(communityPage('/pages/community/user?uid=7'));assert(!communityPage('/pages/community/chat'))
})
