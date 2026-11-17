import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
const source=readFileSync(new URL('../pages/stays/stay-after-refund.js',import.meta.url),'utf8')
const {parseRefundAmount}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'))
test('refund amount converts exact yuan to cents',()=>{
  for(const [value,fen] of [['0.01',1],['7.35',735],['1.1',110],[' 1 ',100],['0.29',29]])assert.deepEqual(parseRefundAmount(value,735),{fen})
})
test('refund amount rejects invalid, zero, negative or excessive amounts',()=>{
  for(const value of ['',0,'0','0.00','-1','1e2','1.001','7.36','Infinity','9007199254740991'])assert.ok(parseRefundAmount(value,735).error,value)
})
