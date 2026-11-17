// Local browser verification with explicit API fixtures. No real message, booking or publishing requests.
import assert from 'node:assert/strict'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { chromium, expect } from 'playwright/test'
const out='../artifacts/operations-completion-20261002/browser'
await mkdir(out,{recursive:true})
for(const url of ['http://127.0.0.1:5373/','http://127.0.0.1:5381/']) assert.ok((await fetch(url)).ok,url+' unavailable')
const meta={}
for(const e of ['faq','activity','stay']) meta[e]=JSON.parse(await readFile(`../artifacts/operations-completion-20261002/meta/${e}.json`,'utf8'))
meta.onlinetask={title:'线上任务',pk:'jobId',perm:'kangaroo:onlinetask',allowAdd:false,allowEdit:false,allowDelete:false,actions:[],fields:[{name:'deliverables',label:'交付物',type:'text',inList:true}]}
const browser=await chromium.launch({headless:true})
const context=await browser.newContext({viewport:{width:1280,height:1000},timezoneId:'Asia/Shanghai'})
const admin=await context.newPage(),mobile=await context.newPage()
await mobile.setViewportSize({width:390,height:844})
const errors=[],checks=[],sends=[],slotSaves=[],adminSaves=[]
let faqs=[{faqId:1,question:'没有面试时间怎么办？',answer:'请联系主理人设置时段。'}],faqError=false,shareError=false,slotError=false
let slotRows=[{slotId:1,startTime:'2030-10-09 14:00:00',endTime:'2030-10-09 14:30:00',status:'booked'},{slotId:2,startTime:'2030-10-09 15:00:00',endTime:'2030-10-09 15:30:00',status:'open'}]
const stores=[{storeId:102,storeName:'平潭测试门店',city:'平潭'},{storeId:103,storeName:'大理测试门店',city:'大理'}]
// 时段表单按「会议号 / 密码 / 备注」三栏填腾讯会议，保存成 formatTencentMeeting 的固定写法（common/meeting.js）；
// 候选人那边的假数据用同一段文字，确认员工存下的会议信息到候场页能认出会议号、一键进入
const MEETING='腾讯会议号：948 050 239\n密码：6666\n请提前 5 分钟入会'
for(const p of [admin,mobile]) p.on('pageerror',e=>errors.push(e.message))
await context.addCookies([{name:'Admin-Token',value:'ops-fixture-admin',url:'http://127.0.0.1:5381'}])
await mobile.addInitScript(()=>localStorage.setItem('kangaroo:app-token',JSON.stringify({type:'string',data:'ops-fixture-staff'})))
await admin.route('**/dev-api/**',async route=>{
 const req=route.request(),path=new URL(req.url()).pathname.replace('/dev-api','')
 const r={code:200,data:[],rows:[],total:0}
 if(path==='/getInfo')Object.assign(r,{user:{userId:1,userName:'admin',nickName:'测试管理员'},roles:['admin'],permissions:['*:*:*']})
 else if(path==='/getRouters')r.data=[{path:'/ops',component:'Layout',name:'Ops',meta:{title:'运营验证'},children:['faq','activity','stay','onlinetask'].map(e=>({path:e,component:'kangaroo/ext/'+e+'/index',name:'Ops'+e,meta:{title:meta[e].title}}))}]
 else if(path==='/kangaroo/store/list')Object.assign(r,{rows:stores,total:2})
 else if(path.endsWith('/meta'))r.data=meta[path.split('/').at(-2)]
 else if(path==='/kangaroo/ext/stay/list')Object.assign(r,{rows:[{stayId:55,stayName:'大理旧房源',storeId:110,status:'online',city:'大理'}],total:1})
 else if(path==='/kangaroo/stayops/stay/55/visibility')r.data={reviewContext:{title:'房源展示检查',text:'关联门店不存在或已停用，请在房源修改中选择实际所属门店。\n没有上架房型，请到房型管理新增或上架房型。'}}
 else if(path==='/kangaroo/ext/stay/55')r.data={stayId:55,stayName:'大理旧房源',storeId:110,status:'online',city:'大理'}
 else if(req.method()==='POST'||req.method()==='PUT'){
  const body=req.postDataJSON();adminSaves.push({path,body});r.data={message:'已创建线上任务草稿，请在岗位管理审核上架'}
  if(path==='/kangaroo/ext/faq')faqs.push({...body,faqId:2})
 }
 await route.fulfill({json:r})
})
await mobile.route('**/app/**',async route=>{
 const req=route.request(),u=new URL(req.url()),path=u.pathname,r={code:200,data:{},rows:[],total:0}
 if(path==='/app/auth/account')r.data={id:9001,nickname:'测试主理人',staffGrants:stores.map(s=>({...s,roleCode:'manager',active:true}))}
 else if(path==='/app/support/faqs')Object.assign(r,faqError?{code:500,msg:'暂时不可用'}:{data:faqs})
 else if(path==='/app/job/list')Object.assign(r,{rows:[{jobId:10,jobType:'volunteer'}],total:1})
 else if(path==='/app/staff/applications'||path==='/app/staff/applications/201'){
  const a={appId:201,jobId:10,storeId:102,jobTitle:'接待换工',realName:'测试候选人',age:25,status:'submitted'};r.data=a;r.rows=[a];r.total=1
 }
 else if(path==='/app/staff/workbench/forwards')r.data=[]
 else if(path==='/app/staff/workbench/forward-stores')r.data=stores.slice(1)
 else if(path==='/app/staff/workbench/forward'){sends.push(req.postDataJSON());r.data={message:'已转发给大理测试门店的 1 位同事',count:1,records:[]}}
 else if(path==='/app/staff/workbench/shared-resume/66')Object.assign(r,shareError?{code:403,msg:'没有该门店的操作权限'}:{data:{name:'测*',age:25,skills:['摄影'],jobTitle:'接待换工',arriveDate:'2030-10-09',from:'平潭测试主理人',suggestion:'请协助查看'}})
 else if(path==='/app/staff/interviews')r.data={date:'2030-10-09',rows:[],summary:{}}
 else if(path==='/app/staff/interview-slots'){
  if(req.method()==='POST'){slotSaves.push(req.postDataJSON());Object.assign(r,slotError?{code:409,msg:'与已有面试时段重叠，请换一个时间'}:{data:3})}
  else r.data=slotRows
 }
 else if(path==='/app/staff/interview-slots/2/close')slotRows=slotRows.map(r=>r.slotId===2?{...r,status:'closed'}:r)
 else if(path==='/app/application/201')r.data={appId:201,jobId:10,status:'interview_booked',interview:{startTime:'2030-10-09 14:00:00',meetingInfo:MEETING}}
 await route.fulfill({json:r})
})
const mb=label=>mobile.locator('uni-button').filter({has:mobile.getByText(label,{exact:true})})
// 时段表单里按左侧文字找单行输入框（会议号 / 密码 / 备注）；H5 的 <input> 渲染成 uni-input 包着原生 input
const slotInput=label=>mobile.locator('.slot-editor .slot-field').filter({has:mobile.getByText(label,{exact:true})}).locator('input')
const ad=()=>admin.locator('.el-dialog:visible')
const field=label=>ad().locator('.el-form-item').filter({has:admin.locator('.el-form-item__label').getByText(label,{exact:true})})
async function pick(label,option){await field(label).locator('.el-select').click();await admin.getByRole('option',{name:option,exact:true}).click()}
async function mgo(path){await mobile.goto('http://127.0.0.1:5373/?ops='+Date.now()+'#/pages/'+path);await mobile.waitForLoadState('networkidle')}
try{
 await admin.goto('http://127.0.0.1:5381/ops/faq')
 await admin.getByRole('button',{name:'新增',exact:true}).click()
 await field('问题').locator('input').fill('如何办理到店入住？')
 await field('解答').locator('textarea').fill('带好证件，到门店前台核对订单。')
 await ad().getByRole('button',{name:'确 定',exact:true}).click();await ad().waitFor({state:'hidden'})
 assert.equal(adminSaves.at(-1).body.status,'0')
 await mgo('notice/support')
 await mobile.locator('.faq-search input').fill('入住')
 await mobile.locator('.faq-question').filter({hasText:'如何办理到店入住？'}).click()
 await mobile.getByText('带好证件，到门店前台核对订单。',{exact:true}).waitFor()
 await mobile.screenshot({path:out+'/faq-mobile.png',fullPage:true})
 checks.push('FAQ admin create, default visible state, mobile keyword search and answer expansion')
 faqError=true;await mgo('notice/support');await mobile.getByText('常见问题加载失败，请重试。').waitFor();faqError=false;await mb('重试').click();await mobile.getByText('如何办理到店入住？',{exact:true}).waitFor()
 checks.push('FAQ load failure can retry and recover')

 await admin.goto('http://127.0.0.1:5381/ops/activity');await admin.getByRole('button',{name:'新增',exact:true}).click()
 await field('标题').locator('input').fill('平潭海边交流活动');await pick('门店ID','平潭测试门店（平潭）')
 await field('集合地点').locator('input').fill('门店前台')
 await field('开始时间').locator('input').fill('2030-10-09 14:00:00');await field('开始时间').locator('input').press('Tab')
 await field('结束时间').locator('input').fill('2030-10-09 16:00:00');await field('结束时间').locator('input').press('Tab')
 await admin.screenshot({path:out+'/activity-admin.png',fullPage:true})
 await ad().getByRole('button',{name:'确 定',exact:true}).click();await ad().waitFor({state:'hidden'})
 assert.equal(adminSaves.at(-1).body.source,'yard');assert.equal(adminSaves.at(-1).body.storeId,102);assert.equal(adminSaves.at(-1).body.feeMode,'free')
 checks.push('activity create form selects real store and submits schedule, capacity and free defaults')

 await admin.goto('http://127.0.0.1:5381/ops/stay');await admin.getByRole('button',{name:'展示检查',exact:true}).click();await ad().getByText(/关联门店不存在/).waitFor();await admin.screenshot({path:out+'/stay-diagnostics.png',fullPage:true});await ad().getByRole('button',{name:'关闭',exact:true}).click()
 await admin.getByRole('button',{name:'修改',exact:true}).click();await pick('门店ID','大理测试门店（大理）');await ad().getByRole('button',{name:'确 定',exact:true}).click();await ad().waitFor({state:'hidden'});assert.equal(adminSaves.at(-1).body.storeId,103)
 checks.push('stay visibility diagnosis and correction of invalid store through searchable selection')

 await admin.goto('http://127.0.0.1:5381/ops/onlinetask');await admin.getByRole('button',{name:'新增线上任务',exact:true}).click()
 await pick('所属门店','平潭测试门店 · 平潭');await field('任务标题').locator('input').fill('小院宣传图文');await field('交付物').locator('input').fill('三篇原创图文');await field('验收标准').locator('textarea').fill('内容真实、图片清晰')
 await field('截止时间').locator('input').fill('2030-10-09 18:00');await field('截止时间').locator('input').press('Tab')
 await ad().getByRole('button',{name:'保存草稿',exact:true}).click();await ad().waitFor({state:'hidden'});assert.equal(adminSaves.at(-1).body.commissionFen,10000)
 checks.push('online task creates complete draft payload with store, deliverables, criteria, deadline and cents amount')

 await mgo('staff/applications?appId=201');await mb('转发脱敏简历').click();await mb('转发').click()
 await mobile.locator('.target').filter({hasText:'其他门店'}).click();await mobile.locator('.forward-store-option').filter({hasText:'大理测试门店'}).click();await mobile.locator('.forward-title').scrollIntoViewIfNeeded();await mobile.screenshot({path:out+'/cross-store-options.png'});await mb('转发给其他门店').click()
 await mobile.locator('uni-toast').getByText('已转发给大理测试门店的 1 位同事').waitFor();assert.equal(sends.at(-1).targetStoreId,103);assert.equal(sends.at(-1).storeId,102)
 await mobile.screenshot({path:out+'/cross-store-send.png',fullPage:true})
 await mgo('staff/applications?s=5&shareId=66');await mobile.locator('.shared-resume').getByText(/测\*/).waitFor();assert.equal(await mb('转发给主理人').count(),0);assert.equal(await mb('审核通过').count(),0)
 await mobile.screenshot({path:out+'/shared-resume.png',fullPage:true})
 shareError=true;await mgo('staff/applications?s=5&shareId=66');await mobile.getByText('没有该门店的操作权限',{exact:true}).waitFor();shareError=false
 checks.push('cross-store target submits correctly; received resume has no original audit controls; permission denial is visible')

 await mgo('staff/applications');await mb('面试日程与时段').click();await mb('设置可预约时段').click();await mobile.locator('.slot-row').first().waitFor()
 assert.equal(await mobile.locator('.slot-row').filter({hasText:'已预约'}).locator('uni-button').count(),0)
 // 会议号故意带空格填（员工常照着腾讯会议的显示抄），保存时去掉空格、按固定写法重新分组
 await slotInput('会议号').fill('948 050 239');await slotInput('密码').fill('6666');await slotInput('备注').fill('请提前 5 分钟入会')
 await mb('新增可预约时段').click();await mobile.locator('uni-toast').getByText('时段已添加',{exact:true}).waitFor();assert.equal(slotSaves.at(-1).storeId,102);assert.equal(slotSaves.at(-1).meetingInfo,MEETING)
 await mobile.locator('.slot-row').filter({hasText:'可预约'}).locator('uni-button').click();await mobile.locator('.uni-modal__btn_primary').click();await mobile.locator('.slot-row').filter({hasText:'已关闭'}).waitFor()
 // 保存被拒（时段重叠）后三栏都要保留，员工改个时间就能再存；会议号框里可能已去掉空格，只比数字
 slotError=true;await mb('新增可预约时段').click();await mobile.locator('uni-toast').getByText('与已有面试时段重叠，请换一个时间').waitFor()
 assert.equal((await slotInput('会议号').inputValue()).replace(/\D/g,''),'948050239');assert.equal(await slotInput('密码').inputValue(),'6666');assert.equal(await slotInput('备注').inputValue(),'请提前 5 分钟入会');assert.equal(slotSaves.at(-1).meetingInfo,MEETING)
 await mobile.screenshot({path:out+'/interview-slots.png',fullPage:true})
 checks.push('staff slot settings accessible from applications even without interviews, save meeting info, close only available slots and retain form after conflict')
 // 候选人：认出会议号后显示腾讯会议卡片（会议号、密码、备注 + 进入 / 复制会议号）；面试还没开始，底部不再有「复制会议信息」
 await mgo('jobs/interview?appId=201&s=2');await mobile.locator('.meeting-card .tm-code').first().waitFor()
 assert.deepEqual((await mobile.locator('.meeting-card .tm-code').allInnerTexts()).map(t=>t.trim()),['948 050 239','6666']);await mobile.getByText('请提前 5 分钟入会',{exact:true}).waitFor()
 await mb('进入腾讯会议').waitFor();await mb('复制会议号').waitFor();assert.equal(await mb('复制会议信息').count(),0);assert.equal(await mobile.locator('.video-body').count(),0)
 checks.push('booked candidate sees saved Tencent meeting (code, password, note, join/copy code); real interview cannot open mock video screen')
 await mobile.setViewportSize({width:320,height:740});await mgo('staff/interviews?s=5');await mobile.locator('.slot-editor').waitFor();assert.equal(await mobile.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await mobile.screenshot({path:out+'/slots-320.png',fullPage:true})
 assert.deepEqual(errors,[])
 console.log('PASS '+checks.length+' browser operation groups')
}catch(e){await mobile.screenshot({path:out+'/mobile-failure.png',fullPage:true});await admin.screenshot({path:out+'/admin-failure.png',fullPage:true});throw e}
finally{await writeFile(out+'/result.json',JSON.stringify({checks,errors,adminSaves,sends,slotSaves},null,2));await browser.close()}
