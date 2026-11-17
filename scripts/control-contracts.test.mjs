import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile, readdir, access} from 'node:fs/promises'
import {fileURLToPath} from 'node:url'
import path from 'node:path'
import {assertExtensionRoutes, assertExtensionSource, assertApplicationList, assertFaqPayload, assertQuickPayload, assertServiceAnswer} from './control-contracts.mjs'

const manifest=JSON.parse(await readFile(new URL('./admin-extension-manifest.json',import.meta.url),'utf8')).entries
const routes=manifest.map(x=>({component:x.component,path:'/fixture/'+x.component.split('/').at(-2)}))
let root=path.dirname(fileURLToPath(import.meta.url))
while(true){try{await access(path.join(root,'RuoYi-Vue3/src/views/kangaroo/ext'));break}catch{const up=path.dirname(root);assert.notEqual(up,root,'repository not found');root=up}}
test('reviewed manifest exactly covers current wrappers and their distinct kinds',async()=>{
 const wrappers=(await readdir(path.join(root,'RuoYi-Vue3/src/views/kangaroo/ext'),{withFileTypes:true})).filter(x=>x.isDirectory()).map(x=>'kangaroo/ext/'+x.name+'/index').sort()
 assert.deepEqual(wrappers,manifest.map(x=>x.component).sort())
 // 59 = 原 57 个 + 2026-10-10 新增的「小程序公告」（appnotice，小程序公告 / 线上兼职须知弹窗）+ 2026-10-17 R3 新增的「生活碎片」（staydiary，V53）
 // 60 = 再加 2026-10-18 的「商家入驻申请」（merchantapply，V56：小程序「成为商家」交上来的申请）
 // 61 = 再加 2026-10-30 的「商家需求」（merchantrequest，V63：本城没人接时等老板处理）
 // 62 = 再加 2026-10-31 的「小院评论审核」（staycomment，V65）
 // 63 = 再加 2026-11-03 的「AI客服聊天记录」（supportchat，V72，只读）
 // V67 岗位要求选项（jobopt）同样由通用 CRUD 承载。
 assert.equal(manifest.filter(x=>x.kind==='ext-crud').length,64)
 assert.equal(manifest.filter(x=>x.kind==='application-list').length,2)
 for(const entry of manifest) assertExtensionSource(entry,await readFile(path.join(root,'RuoYi-Vue3/src/views',entry.component+'.vue'),'utf8'))
})
test('prior 53 components are retained and six explicit additions are reviewed',async()=>{
 const doc=JSON.parse(await readFile(new URL('./admin-extension-manifest.json',import.meta.url),'utf8'))
 assert.equal(doc.prior53Retained.length,53)
 const actual=new Set(manifest.map(x=>x.component.split('/').at(-2)))
 for(const key of doc.prior53Retained) assert.ok(actual.has(key))
 assert.deepEqual(doc.addedSincePrior53,['faq','homepick','memberbenefit','memberlevel','onlinereview','volunteerreview','appnotice','staydiary','merchantapply','merchantrequest','staycomment','supportchat','jobopt'])
 assert.deepEqual([...actual].sort(),[...doc.prior53Retained,...doc.addedSincePrior53].sort())
})
test('full reviewed extension component set accepted in any order',()=>assertExtensionRoutes([...routes].reverse(),manifest))
test('old 53 subset is not sufficient',()=>assert.throws(()=>assertExtensionRoutes(routes.slice(0,53),manifest)))
test('same count with one unexpected replacement fails',()=>assert.throws(()=>assertExtensionRoutes([...routes.slice(0,-1),{component:'kangaroo/ext/unreviewed/index',path:'/new'}],manifest)))
test('duplicate component cannot hide a missing component',()=>assert.throws(()=>assertExtensionRoutes([...routes.slice(0,-1),routes[0]],manifest)))
test('duplicate route path fails even with right components',()=>assert.throws(()=>assertExtensionRoutes(routes.map((x,i)=>({...x,path:i===1?routes[0].path:x.path})),manifest)))
test('same component with wrong ExtCrud entity fails',()=>assert.throws(()=>assertExtensionSource({kind:'ext-crud',entity:'faq'},'<ext-crud entity="ticket" />')))
test('review wrappers use ApplicationList rather than fake ExtCrud',()=>assertExtensionSource({kind:'application-list',jobType:'online'},'<application-list fixed-job-type="online" />\nimport ApplicationList from "@/views/kangaroo/application/index.vue"'))
test('swapped online and volunteer wrapper fails',()=>assert.throws(()=>assertExtensionSource({kind:'application-list',jobType:'online'},'<application-list fixed-job-type="volunteer" />\nimport ApplicationList from "@/views/kangaroo/application/index.vue"')))
const entry={kind:'application-list',jobType:'online'}
const list={code:200,rows:[{appId:12,jobType:'online'}]}
test('application review exact category accepted',()=>assertApplicationList(entry,'http://localhost/dev-api/kangaroo/application/list?jobType=online',list))
test('review cannot omit request filter or return other category',()=>{
 assert.throws(()=>assertApplicationList(entry,'http://localhost/dev-api/kangaroo/application/list',list))
 assert.throws(()=>assertApplicationList(entry,'http://localhost/dev-api/kangaroo/application/list?jobType=online',{code:200,rows:[{appId:12,jobType:'volunteer'}]}))
})
test('empty review fixture is not a false detail pass',()=>assert.throws(()=>assertApplicationList(entry,'http://localhost/dev-api/kangaroo/application/list?jobType=online',{code:200,rows:[]})))
test('FAQ valid saved answer accepted; blank or duplicate IDs rejected',()=>{
 const faq={faqId:1,question:'如何退款？',answer:'查看订单的实际退改规则'}
 assertFaqPayload({code:200,data:[faq]})
 assert.throws(()=>assertFaqPayload({code:200,data:[{...faq,answer:''}]}))
 assert.throws(()=>assertFaqPayload({code:200,data:[faq,faq]}))
})
test('quick request must provide real current refund entry, not fallback',()=>{
 assertQuickPayload({code:200,data:['报名进度','退款规则','保险查询']})
 assert.throws(()=>assertQuickPayload({code:200,data:['旧问题','面试','保险']}))
})
const answer=()=>({httpStatus:200,request:{context:'profile',question:'退款规则'},payload:{code:200,data:{text:'真实完整回答，后半部分也必须显示。',cards:[{title:'订单',status:'待处理'}],source:'实际订单规则'}},title:'退款规则',content:'真实完整回答，后半部分也必须显示。\n· 订单（待处理）\n信息来源：实际订单规则',question:'退款规则'})
test('complete API answer, cards and attribution accepted',()=>assertServiceAnswer(answer()))
test('old prefix-only modal falsely matching first 15 chars rejected',()=>{const x=answer();x.content=x.payload.data.text.slice(0,15);assert.throws(()=>assertServiceAnswer(x))})
test('wrong question/context rejected even if response text matches',()=>{for(const key of ['question','context']){const x=answer();x.request[key]='wrong';assert.throws(()=>assertServiceAnswer(x))}})
test('HTTP failure, business failure and missing answer are not success',()=>{
 const cases=[x=>{x.httpStatus=500},x=>{x.payload.code=500},x=>{delete x.payload.data.text}]
 for(const change of cases){const x=answer();change(x);assert.throws(()=>assertServiceAnswer(x))}
})
