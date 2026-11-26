import test from 'node:test'
import assert from 'node:assert/strict'
import { loadLegalVersions } from '../common/legal-state.js'
const document = version => ({ data: { configured: true, html: '<p>真实已发布正文</p>', version } })
test('both documents must be published before authorization can proceed', async () => {
  const calls=[]
  const pair=await loadLegalVersions(async key=>{calls.push(key);return document(key==='terms'?'1111111111111111':'2222222222222222')})
  assert.deepEqual(calls,['terms','privacy']);assert.deepEqual(pair,{termsVersion:'1111111111111111',privacyVersion:'2222222222222222'})
})
test('missing, blank, malformed or unversioned documents cannot be accepted', async () => {
  for (const bad of [undefined,{data:{}},{data:{configured:false}}, {data:{configured:true,html:'  ',version:'1111111111111111'}},{data:{configured:true,html:'content',version:''}}]) {
    await assert.rejects(loadLegalVersions(async key=>key==='terms'?document('1111111111111111'):bad), /协议内容暂不可用/)
  }
})
test('a network failure cannot reuse a previous successful version', async () => {
  await loadLegalVersions(async()=>document('1111111111111111'))
  await assert.rejects(loadLegalVersions(async()=>{throw new Error('offline')}), /offline/)
})
