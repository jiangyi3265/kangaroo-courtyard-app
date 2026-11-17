import test from 'node:test'
import assert from 'node:assert/strict'
import {pathToFileURL} from 'node:url'
const candidate=await import(process.env.C35_CONTRACT_MODULE?pathToFileURL(process.env.C35_CONTRACT_MODULE).href:'./control-contracts.mjs')
const select=(...args)=>{assert.equal(typeof candidate.exactExtensionRowIndex,'function');return candidate.exactExtensionRowIndex(...args)}
const verify=x=>{assert.equal(typeof candidate.assertReportContextResponse,'function');candidate.assertReportContextResponse(x)}
const meta={pk:'reportId',allowDelete:false},headers=['编号','对象ID','举报人ID']
test('exact primary key selects report 55 even when another row mentions 55',()=>assert.equal(select(meta,55,headers,[['51','155','55'],['55','77','88'],['155','55','77']]),1))
test('optional selection shifts key column; other text is never identity',()=>assert.equal(select({...meta,allowDelete:true},55,['','编号','对象ID'],[['','155','55'],['','55','155']]),1))
test('missing matching primary key fails even when text contains 55',()=>assert.throws(()=>select(meta,55,headers,[['155','55','55']]),/exactly one/))
test('duplicate exact primary keys fail rather than clicking the first',()=>assert.throws(()=>select(meta,55,headers,[['55'],['55']]),/exactly one/))
test('metadata/header mismatch and missing cells fail',()=>{assert.throws(()=>select({...meta,allowDelete:true},55,headers,[['55']]),/column/);assert.throws(()=>select(meta,55,headers,[[]]),/cells/);assert.throws(()=>select({pk:'reportId'},55,headers,[['55']]),/metadata/)})
test('blank or object keys fail instead of matching arbitrary text',()=>{for(const pk of [null,undefined,'',{},0,NaN])assert.throws(()=>select(meta,pk,headers,[['55']]),/primary key/)})
const response=()=>({base:'http://127.0.0.1:8081',url:'http://127.0.0.1:8081/dev-api/kangaroo/core/report/55/context',method:'GET',httpStatus:200,payload:{code:200,data:{reviewContext:{title:'举报对象原文',text:'平台处置回归-55\n完整尾文'}}},reportId:55,reference:{reviewContext:{title:'举报对象原文',text:'平台处置回归-55\n完整尾文'}}})
test('actual same-ID complete context accepted',()=>verify(response()))
test('wrong request report ID rejected even with matching text',()=>{const x=response();x.url=x.url.replace('/55/','/155/');assert.throws(()=>verify(x),/exact clicked report/)})
test('other backend, wrong method and failed transport/business reject',()=>{for(const mutate of [x=>x.url=x.url.replace('8081','8080'),x=>x.method='POST',x=>x.httpStatus=500,x=>x.payload.code=500]){const x=response();mutate(x);assert.throws(()=>verify(x))}})
test('truncated or wrong original content and missing reference reject',()=>{for(const mutate of [x=>x.payload.data.reviewContext.text='平台处置回归-55',x=>x.payload.data.reviewContext.text='别的对象',x=>x.reference={}]){const x=response();mutate(x);assert.throws(()=>verify(x))}})
