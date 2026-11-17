import test from 'node:test'
import assert from 'node:assert/strict'
import { linkPayload, linkRoute, linkView, restoreLink, LINK_TABS } from '../pages/community/post-link.js'
const link={type:'post',id:8,title:'自己的另一篇帖子',cover:'/profile/a.jpg'}
test('选择自己的帖子后可保存、恢复并跳转到详情',()=>{
  assert.ok(LINK_TABS.some(t=>t.key==='post'))
  assert.equal(linkRoute(link),'/pages/community/index?postId=8')
  assert.equal(restoreLink(link).id,8)
  assert.equal(linkView(link).label,'帖子')
  assert.equal(linkView({type:'post',id:0,title:'无效'}),null)
})
test('经验分享关联帖子不会覆盖经历校验字段',()=>{
  assert.deepEqual(linkPayload('diary',link),{linkType:'post',linkId:8})
  assert.deepEqual(linkPayload('buddy',link),{refType:'post',refId:8,linkType:'post',linkId:8})
  assert.deepEqual(linkPayload('daily',null),{})
})
