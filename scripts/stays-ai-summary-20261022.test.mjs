import test from 'node:test'
import assert from 'node:assert/strict'
import { stayAiSummary } from '../pages/stays/stays-ai-summary.js'

test('只有真实模型ready结果才能显示AI参考分', () => {
 const good = {status:'ready',source:'model',score:4.7,reviewCount:12,summary:'安静，设施稍旧',highlights:['安静'],cautions:['设施稍旧']}
 assert.deepEqual(stayAiSummary(good),{ready:true,score:'4.7',summary:'安静，设施稍旧',highlights:['安静'],cautions:['设施稍旧'],count:12,note:'AI参考分，不替代住客评分'})
 for(const override of [{status:'pending'},{status:'disabled'},{status:'unavailable'},{status:'not_in_sample'},{source:'average'},{reviewCount:0},{score:null},{score:0},{score:6},{score:NaN}]) {
  const ai=stayAiSummary({...good,...override})
  assert.equal(ai.ready,false)
  assert.equal(ai.score,'')
  assert.equal(ai.summary,'')
  assert.deepEqual(ai.highlights,[])
  assert.deepEqual(ai.cautions,[])
 }
})

test('AI不可用、生成中、无评价状态有清楚的后备说明',()=>{
 assert.ok(stayAiSummary({status:'pending'}).note.includes('生成中'))
 assert.ok(stayAiSummary({status:'no_reviews'}).note.includes('暂无入住评价'))
 for(const status of ['disabled','unavailable','not_in_sample',undefined])assert.ok(stayAiSummary({status}).note.includes('展示住客评分'))
})
