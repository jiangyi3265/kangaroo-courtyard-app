/** Actual H5 controls and local HTTP; mock login/content moderation, no real outbound messages. */
import { chromium } from 'playwright'
import assert from 'node:assert/strict'
import { assertFaqPayload, assertQuickPayload, assertServiceAnswer } from './control-contracts.mjs'
import { readFile,writeFile,mkdir } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
const F=JSON.parse(await readFile(new URL('../../.dev/fullflow-fixture.json',import.meta.url),'utf8'))
const OUT=new URL('../../artifacts/full-flow-20261001/controls/',import.meta.url);await mkdir(OUT,{recursive:true})
const API=process.env.FLOW_API_BASE || process.env.KG_BASE || 'http://localhost:8080'
async function api(path,{method='GET',body,token=F.u.mgr[0],admin=false}={}) {
 const r=await fetch(API+path,{method,headers:{'Content-Type':'application/json',...(admin?{Authorization:'Bearer '+F.admin}:{'X-App-Token':token})},body:body?JSON.stringify(body):undefined});const b=await r.json();assert.equal(b.code,200,path+': '+b.msg);return b.data
}
assert.equal((await api('/app/auth/ping')).wxMock,true)
const browser=await chromium.launch({headless:true,args:['--no-proxy-server']})
const page=await browser.newPage({viewport:{width:390,height:844},isMobile:true,timezoneId:'Asia/Shanghai',locale:'zh-CN'});page.setDefaultTimeout(15000)
const errors=[],failed=[],steps=[];page.on('pageerror',e=>errors.push(e.message));page.on('requestfailed',r=>{if(r.url().includes('/app/')&&r.failure()?.errorText!=='net::ERR_ABORTED')failed.push(new URL(r.url()).pathname)})
async function open(route,token=F.u.mgr[0]) {await page.goto('http://127.0.0.1:5273/');await page.evaluate(t=>localStorage.setItem('kangaroo:app-token',JSON.stringify({type:'string',data:t})),token);await page.goto('http://127.0.0.1:5273/#'+route);await page.reload();await page.locator('.k-page').first().waitFor();await page.waitForLoadState('networkidle')}
async function choice(label) {await page.locator('.uni-actionsheet__cell').filter({hasText:label}).first().click()}
async function step(name,fn){await fn();steps.push(name);console.log('PASS '+name)}
async function shot(name,fullPage=true){
 if(await page.locator('.uni-modal').isVisible())await page.waitForFunction(()=>{const el=document.querySelector('.uni-modal');if(!el)return false;for(let item=el;item;item=item.parentElement){if(Number(getComputedStyle(item).opacity)!==1)return false}return el.getAnimations({subtree:true}).every(animation=>animation.playState!=='running')})
 return page.screenshot({path:fileURLToPath(new URL(name+'.png',OUT)),fullPage})
}
try{
 await step('B07 dashboard and wallet reflect actual unread staff messages',async()=>{
  assert.ok((await api('/app/message/unread?mode=staff')).unread>0)
  for(const route of ['/pages/manage/dashboard','/pages/manage/wallet']){await open(route);await page.locator('.msg-dot').waitFor({state:'visible'});await shot(route.split('/').at(-1)+'-unread')}
 })
 await step('B08 saved FAQ answers and real assistant refund response render completely',async()=>{
  await open('/pages/notice/support')
  const [faqResponse,quickResponse]=await Promise.all([
    page.waitForResponse(r=>new URL(r.url()).pathname==='/app/support/faqs'&&r.request().method()==='GET'),
    page.waitForResponse(r=>new URL(r.url()).pathname==='/app/support/quick'&&new URL(r.url()).searchParams.get('context')==='profile'),
    page.reload({waitUntil:'networkidle'})
  ])
  assert.equal(faqResponse.status(),200);assert.equal(quickResponse.status(),200)
  const faqs=assertFaqPayload(await faqResponse.json()),quick=assertQuickPayload(await quickResponse.json())
  const card=page.locator('.faq-card'),questions=card.locator('.faq-question')
  await questions.first().waitFor()
  assert.deepEqual((await questions.allTextContents()).map(x=>x.trim()),faqs.slice(0,6).map(x=>x.question))
  const expand=card.getByText('查看全部问题',{exact:true})
  if(faqs.length>6){
    await expand.click();assert.deepEqual((await questions.allTextContents()).map(x=>x.trim()),faqs.map(x=>x.question))
    await card.getByText('收起列表',{exact:true}).click();assert.equal(await questions.count(),6)
  }else assert.equal(await expand.count(),0,'six or fewer FAQs need no expand button')
  const refund=faqs.find(x=>x.category==='refund');assert.ok(refund,'seeded refund FAQ')
  const faqSearch=card.locator('.faq-search input')
  assert.equal(await faqSearch.count(),1,'Exactly one native FAQ search input')
  await faqSearch.waitFor({state:'visible'})
  await faqSearch.fill(refund.question)
  const item=card.locator('.faq-item').filter({hasText:refund.question}),button=item.locator('.faq-question')
  assert.equal(await item.count(),1)
  await button.click();assert.equal(await button.getAttribute('aria-expanded'),'true')
  assert.equal((await item.locator('.faq-answer').innerText()).trim(),refund.answer.trim(),'complete saved FAQ answer')
  await button.click();assert.equal(await button.getAttribute('aria-expanded'),'false');assert.equal(await item.locator('.faq-answer').count(),0)
  await faqSearch.fill('')
  const question='退款规则';assert.ok(quick.slice(0,3).includes(question))
  const pending=page.waitForResponse(r=>new URL(r.url()).pathname==='/app/support/ask'&&r.request().method()==='POST')
  await page.locator('.assistant-questions').getByText(question,{exact:true}).click()
  const response=await pending,payload=await response.json()
  const modal=page.locator('.uni-modal');await modal.waitFor()
  assertServiceAnswer({httpStatus:response.status(),request:response.request().postDataJSON(),payload,
    title:await modal.locator('.uni-modal__title').innerText(),content:await modal.locator('.uni-modal__bd').innerText(),question})
  assert.ok(page.url().includes('/pages/notice/support'));await shot('faq-response')
  await writeFile(new URL('faq-response.json',OUT),JSON.stringify({time:new Date().toISOString(),faqIds:faqs.map(x=>x.faqId),refundFaqId:refund.faqId,faqAnswerMatched:true,quickQuestion:question,requestContext:'profile',httpStatus:response.status(),businessCode:payload.code,entireAnswerMatched:true,source:payload.data.source},null,2))
 })
 await step('B09 hidden talent can be restored from the actual menu',async()=>{
  const path='/app/staff/talents/'+F.u.worker[1]+'/mark?storeId='+F.A
  await api(path,{method:'POST',body:{what:'hidden',on:true}})
  await open('/pages/staff/talents?s=3&storeId='+F.A)
  await page.getByText('默认排序⌄',{exact:true}).click();await choice('管理已隐藏人才')
  const hidden=await api('/app/staff/talents/search?storeId='+F.A,{method:'POST',body:{hidden:true}})
  const candidate=hidden.rows.find(x=>x.userId===F.u.worker[1]);assert.ok(candidate)
  await choice(candidate.name||candidate.nickname||'用户'+candidate.userId)
  const saved=page.waitForResponse(r=>r.url().includes('/talents/'+candidate.userId+'/mark'))
  await page.locator('.uni-modal__btn').filter({hasText:'确定'}).click();assert.equal((await (await saved).json()).code,200)
  assert.equal((await api('/app/staff/talents/search?storeId='+F.A,{method:'POST',body:{hidden:true}})).rows.some(x=>x.userId===candidate.userId),false)
  await open('/pages/staff/talents?s=3&storeId='+F.A);assert.ok((await page.locator('.person-card').allTextContents()).some(t=>t.includes(candidate.name)));await shot('talent-restored')
 })
 await step('B10 stay Vlog more shows actual available entries',async()=>{
  await open('/pages/stays/detail?s=3&stayId='+F.stay)
  const names=await page.locator('.vlog__title').allTextContents();assert.ok(names.length)
  await page.locator('.section-head').filter({hasText:'近期Vlog'}).getByText('更多',{exact:true}).click()
  await page.locator('.uni-actionsheet__cell').filter({hasText:names[0]}).waitFor();await shot('vlog-more')
 })
 await step('B11 trip city menu filters real trips and can restore all cities',async()=>{
  const token=F.u.payee2[0],start=new Date(Date.now()+15*86400000).toISOString().slice(0,10)+' 15:00'
  const activity=await api('/app/activities',{method:'POST',token:F.u.outsider[0],body:{title:'切城回归'+Date.now(),startTime:start,hours:2,place:'古城大厅',capacity:10,city:'丽江',category:'其他',intro:'行程城市筛选回归'}})
  const id=activity.activityId||activity.id;assert.ok(id)
  await api('/kangaroo/community/activity/'+id+'/approve',{method:'PUT',admin:true})
  await api('/app/activities/'+id+'/signup',{method:'POST',token,body:{channel:'home'}})
  const trips=await api('/app/trips',{token});assert.ok(new Set(trips.groups.map(g=>g.city)).size>=2)
  await open('/pages/community/trip',token);const total=await page.locator('.group__title').count()
  const labels=groups=>groups.map(g=>`${g.city} · ${g.range}`)
  const allLabels=labels(trips.groups),cityLabels=labels(trips.groups.filter(g=>g.city==='丽江'))
  const shown=async()=> (await page.locator('.group__title').allTextContents()).map(x=>x.trim())
  const waitGroups=expected=>page.waitForFunction(expected=>JSON.stringify([...document.querySelectorAll('.group__title')].map(x=>x.textContent.trim()))===JSON.stringify(expected),expected)
  assert.equal(total,allLabels.length);assert.ok(cityLabels.length>0)
  assert.deepEqual(await shown(),allLabels,'Initial groups match the actual trips API')
  async function pickTripCity(label){
    await page.locator('.brand__city').click()
    await page.waitForURL(url=>url.hash.split('?')[0]==='#/pages/home/city-picker')
    const row=page.locator('.picker-row').filter({has:page.getByText(label,{exact:true})})
    await row.waitFor({state:'visible'});assert.equal(await row.count(),1,'One exact available city')
    await row.click()
    await page.waitForURL(url=>url.hash.split('?')[0]==='#/pages/community/trip')
    await page.waitForFunction(label=>document.querySelector('.brand__city')?.textContent.trim()===label,label)
    assert.equal((await page.locator('.brand__city').innerText()).trim(),label)
  }
  await pickTripCity('丽江');await waitGroups(cityLabels)
  const titles=await page.locator('.group__title').allTextContents();assert.ok(titles.length&&titles.every(t=>t.startsWith('丽江')))
  assert.deepEqual(await shown(),cityLabels,'Only exact API groups for the selected city')
  await pickTripCity('全部城市');await waitGroups(allLabels)
  assert.equal(await page.locator('.group__title').count(),total);assert.deepEqual(await shown(),allLabels)
  // The trip filter is a page-local ref, not a saved preference. Reload resets
  // it to all cities; verify that displayed groups still equal the real API.
  await pickTripCity('丽江');await waitGroups(cityLabels)
  const loaded=page.waitForResponse(r=>new URL(r.url()).origin===new URL(API).origin&&new URL(r.url()).pathname==='/app/trips'&&r.request().method()==='GET')
  await page.reload({waitUntil:'networkidle'})
  const response=await loaded;assert.equal(response.status(),200)
  const body=await response.json();assert.equal(body.code,200)
  assert.deepEqual(labels(body.data.groups),allLabels,'Reload still reads all the same persisted trip groups')
  assert.equal(new URL(response.url()).searchParams.has('city'),false,'Page-local filter does not invent a server city parameter')
  await waitGroups(allLabels);assert.equal((await page.locator('.brand__city').innerText()).trim(),'全部城市')
  assert.equal(await page.locator('.group__title').count(),total);await shot('trip-cities')
 })
 await step('B12 overdue unpaid settlement can file dispute and persists after reload',async()=>{
  await open('/pages/jobs/deliver?appId='+F.overdueAssignment,F.u.worker2[0])
  assert.equal(await page.getByText('确认收款',{exact:true}).count(),0)
  await page.locator('.k-button').filter({hasText:'没有收到款'}).click()
  await page.locator('.uni-modal textarea').fill('验收后超过七天没有收到款')
  const response=page.waitForResponse(r=>r.url().includes('/online/assignments/'+F.overdueAssignment+'/confirm'))
  await page.locator('.uni-modal__btn').filter({hasText:'确定'}).click();assert.equal((await (await response).json()).code,200)
  await open('/pages/jobs/deliver?appId='+F.overdueAssignment,F.u.worker2[0])
  const d=await api('/app/online/assignments/'+F.overdueAssignment,{token:F.u.worker2[0]});assert.equal(d.settlement.status,'disputed');assert.equal(d.settlement.canDispute,false)
  assert.equal(await page.getByText('没有收到款',{exact:true}).count(),0);await shot('overdue-dispute')
 })
 await step('B13 points explanation does not overlap adjacent text at 320px or 390px',async()=>{
  for(const width of [320,390]){
   await page.setViewportSize({width,height:844});await open('/pages/profile/index?s=3',F.u.guest[0])
   // 2026-10-17 会员信息改版：「积分怎么得、怎么用」四格（.way）换成底部「积分规则」卡，一条一行（.mi-rule：编号 + 标题 + 说明），
   // 每条的分数都是服务端按参数设置拼的（ruleRows）。这里查每条都在卡片里、不压到右边
   const rules=(await page.locator('.mi-rule__name').allTextContents()).map(x=>x.trim())
   assert.ok(rules.length>=4&&rules[0]==='换工换宿：'&&rules.includes('门店任务：')&&rules.at(-1)==='积分使用：',rules.join(' '))
   const bounds=await page.locator('.mi-rule').evaluateAll(els=>els.map(el=>{const p=el.getBoundingClientRect();return [...el.querySelectorAll('.mi-rule__no,.mi-rule__body')].every(t=>{const r=t.getBoundingClientRect();return r.left>=p.left-1&&r.right<=p.right+1})}))
   assert.equal(bounds.length,rules.length);assert.ok(bounds.every(Boolean))
   await page.locator('.mi-rules').evaluate(el=>el.scrollIntoView({block:'start'}))
   await page.waitForFunction(()=>{const el=document.querySelector('.mi-rules');return !!el&&el.getBoundingClientRect().top>=0})
   await shot('points-'+width,false)
  }
 })
 assert.equal(steps.length,7,'all B07–B13 controls must complete');assert.deepEqual(errors,[]);assert.deepEqual(failed,[]);console.log('页面控件业务回归 '+steps.length+'/7 通过')
}catch(e){console.error(e);process.exitCode=1;await shot('failure')}
finally{await writeFile(new URL('result.json',OUT),JSON.stringify({time:new Date().toISOString(),steps,errors,failed,exitCode:process.exitCode||0},null,2));await browser.close()}
