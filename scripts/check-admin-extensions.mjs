/** Chromium + actual local admin HTTP. Enumerates routed extension pages, reads list/detail, no business writes. */
import { chromium } from 'playwright'
import assert from 'node:assert/strict'
import { assertExtensionRoutes, assertExtensionSource, assertApplicationList, exactExtensionRowIndex, assertReportContextResponse } from './control-contracts.mjs'
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
const F=JSON.parse(await readFile(new URL('../../.dev/fullflow-fixture.json',import.meta.url),'utf8'))
const OUT=new URL('../../artifacts/full-flow-20261001/admin-extensions/',import.meta.url)
await mkdir(OUT,{recursive:true})
const manifest=JSON.parse(await readFile(new URL('./admin-extension-manifest.json',import.meta.url),'utf8')).entries
const API=process.env.FLOW_API_BASE || process.env.KG_BASE || 'http://localhost:8080',BASE='http://127.0.0.1:8081'
async function api(path) {const r=await fetch(API+path,{headers:{Authorization:'Bearer '+F.admin}});assert.equal(r.status,200,path+' transport');const b=await r.json();assert.equal(b.code,200,path);return b}
const routes=[]
function walk(rows,parent='') {for(const r of rows){const path=r.path.startsWith('/')?r.path:parent+'/'+r.path;if(r.component?.startsWith('kangaroo/ext/')) routes.push({...r,path});if(r.children)walk(r.children,path)}}
walk((await api('/getRouters')).data)
assertExtensionRoutes(routes,manifest)
const browser=await chromium.launch({headless:true,args:['--no-proxy-server']})
const ctx=await browser.newContext({viewport:{width:1440,height:1000},timezoneId:'Asia/Shanghai'})
await ctx.addCookies([{name:'Admin-Token',value:F.admin,domain:'127.0.0.1',path:'/'}])
const page=await ctx.newPage();page.setDefaultTimeout(15000)
const errors=[],network=[],results=[]
page.on('pageerror',e=>errors.push(e.message))
page.on('requestfailed',r=>{if(r.url().includes('/dev-api/')&&r.failure()?.errorText!=='net::ERR_ABORTED')network.push({path:new URL(r.url()).pathname,error:r.failure()?.errorText})})
async function exactExtensionRow(rows, meta, pk) {
 const headers=await page.locator('.app-container .el-table__header-wrapper th').allTextContents()
 const cells=await rows.evaluateAll(items=>items.map(row=>[...row.querySelectorAll('td')].map(cell=>cell.innerText)))
 return rows.nth(exactExtensionRowIndex(meta,pk,headers,cells))
}
try {
 for(const route of routes){
  const file=new URL('../../RuoYi-Vue3/src/views/'+route.component+'.vue',import.meta.url)
  const source=await readFile(file,'utf8'),entry=manifest.find(x=>x.component===route.component)
  assertExtensionSource(entry,source)
  const entity=entry.entity
  if (entry.kind === 'insurance-finance') {
    for (const [tab, label] of [['applies', '投保申请'], ['refunds', '保险退费']]) {
      const pending = page.waitForResponse(r => new URL(r.url()).pathname === '/dev-api/kangaroo/insurance-finance/' + tab && r.request().method() === 'GET')
      if (tab === 'applies') await page.goto(BASE + route.path, { waitUntil: 'domcontentloaded' })
      else await page.getByRole('tab', { name: label }).click()
      const response = await pending
      assert.equal(response.status(), 200)
      const payload = await response.json()
      assert.equal(payload.code, 200)
      assert.ok(Array.isArray(payload.data.rows))
      await page.waitForFunction(() => !document.querySelector('.insurance-admin .el-table .el-loading-mask') || getComputedStyle(document.querySelector('.insurance-admin .el-table .el-loading-mask')).display === 'none')
      const rows = page.locator('.insurance-admin .el-table__body-wrapper tr.el-table__row')
      assert.equal(await rows.count(), payload.data.rows.length)
      for (const [index, row] of payload.data.rows.entries()) assert.equal((await rows.nth(index).locator('td').first().innerText()).trim(), String(row.applyId))
    }
    results.push({ component: route.component, entity, title: route.meta?.title, path: route.path, detail: '投保及退费列表', status: '已实测通过' })
    continue
  }
  if(entry.kind==='application-list'){
    const pending=page.waitForResponse(r=>new URL(r.url()).pathname==='/dev-api/kangaroo/application/list'&&r.request().method()==='GET')
    await page.goto(BASE+route.path,{waitUntil:'domcontentloaded'})
    const response=await pending;assert.equal(response.status(),200)
    const list=await response.json();assertApplicationList(entry,response.url(),list)
    await page.locator('.app-container .el-table').waitFor()
    assert.equal(await page.locator('.wscn-http404-container').count(),0)
    await page.waitForFunction(()=>!document.querySelector('.app-container .el-loading-mask')||getComputedStyle(document.querySelector('.app-container .el-loading-mask')).display==='none')
    const rows=page.locator('.app-container .el-table__body-wrapper tr.el-table__row')
    assert.equal(await rows.count(),list.rows.length,entry.jobType+' rendered rows')
    for(let i=0;i<list.rows.length;i++) assert.ok((await rows.nth(i).innerText()).includes(list.rows[i].appNo), 'exact application row identity')
    const first=list.rows[0]
    const pendingDetail=page.waitForResponse(r=>new URL(r.url()).pathname==='/dev-api/kangaroo/application/'+first.appId&&r.request().method()==='GET')
    await rows.first().getByRole('button',{name:'详情',exact:true}).click()
    const detailResponse=await pendingDetail;assert.equal(detailResponse.status(),200)
    const detail=await detailResponse.json();assert.equal(detail.code,200)
    assert.equal(detail.data.application.appId,first.appId);assert.equal(detail.data.application.jobType,entry.jobType)
    const drawer=page.locator('.el-drawer:visible');await drawer.waitFor()
    assert.ok((await drawer.innerText()).includes(first.appNo),'same application detail displayed')
    assert.ok((await drawer.locator('.el-descriptions__content').count())>0)
    await drawer.getByRole('button',{name:'关 闭',exact:true}).click()
    results.push({component:route.component,entity,jobType:entry.jobType,title:route.meta?.title,path:route.path,rows:list.rows.length,listFilter:entry.jobType,detailAppId:first.appId,detail:'实际打开同类型报名详情，未执行审核',status:'已实测通过'})
    console.log('PASS '+route.component+' rows='+list.rows.length+' filtered='+entry.jobType+' detail='+first.appId)
    continue
  }
  const listResponse=page.waitForResponse(r=>new URL(r.url()).pathname==='/dev-api/kangaroo/ext/'+entity+'/list')
  await page.goto(BASE+route.path,{waitUntil:'domcontentloaded'})
  const rawList=await listResponse;assert.equal(rawList.status(),200,entity+' transport');const list=await rawList.json();assert.equal(list.code,200,entity+' list')
  await page.locator('.app-container .el-table').waitFor()
  assert.equal(await page.locator('.wscn-http404-container').count(),0)
  const meta=(await api('/kangaroo/ext/'+entity+'/meta')).data
  await page.waitForFunction(()=>!document.querySelector('.app-container .el-loading-mask')||getComputedStyle(document.querySelector('.app-container .el-loading-mask')).display==='none')
  const visibleRows=page.locator('.app-container .el-table__body-wrapper tr.el-table__row')
  assert.equal(await visibleRows.count(),list.rows.length,entity+' rendered rows')
  let detail='无数据，详情未测试'
  if(list.rows.length){
    const pk=list.rows[0][meta.pk]
    const row=await exactExtensionRow(visibleRows,meta,pk),button=row.getByRole('button',{name:meta.allowEdit?'修改':'详情',exact:true})
    assert.equal(await button.count(),1,'one same-ID detail action')
    const response=page.waitForResponse(r=>new URL(r.url()).origin===new URL(BASE).origin&&new URL(r.url()).pathname==='/dev-api/kangaroo/ext/'+entity+'/'+pk&&r.request().method()==='GET')
    await button.click();const actualDetail=await response;assert.equal(actualDetail.status(),200)
    const body=await actualDetail.json();assert.equal(body.code,200);assert.equal(String(body.data[meta.pk]),String(pk),'same primary key returned by detail endpoint')
    await page.locator('.el-dialog:visible').waitFor()
    assert.ok((await page.locator('.el-dialog:visible .el-form-item').count())>0)
    await page.locator('.el-dialog:visible .el-dialog__headerbtn').click();detail='实际打开详情/编辑表单，未提交修改'
  }
  if(entity==='report'){
    assert.equal(meta.pk,'reportId')
    assert.equal(list.rows.filter(row=>String(row[meta.pk])===String(F.moderationReport)).length,1,'fixture report occurs exactly once in actual list')
    const reportRow=await exactExtensionRow(visibleRows,meta,F.moderationReport)
    const button=reportRow.getByRole('button',{name:'查看原文',exact:true});assert.equal(await button.count(),1)
    const endpoint='/kangaroo/core/report/'+F.moderationReport+'/context',reference=(await api(endpoint)).data
    const pending=page.waitForResponse(r=>new URL(r.url()).origin===new URL(BASE).origin&&new URL(r.url()).pathname==='/dev-api'+endpoint&&r.request().method()==='GET')
    await button.click();const response=await pending,payload=await response.json()
    assertReportContextResponse({base:BASE,url:response.url(),method:response.request().method(),httpStatus:response.status(),payload,reportId:F.moderationReport,reference})
    const dialog=page.locator('.el-dialog:visible');await dialog.getByText(/平台处置回归-/).waitFor()
    assert.equal((await dialog.locator('div[style*="white-space: pre-wrap"]').innerText()).trim(),reference.reviewContext.text.trim(),'entire same-ID original text rendered')
    await writeFile(new URL('report-context.json',OUT),JSON.stringify({time:new Date().toISOString(),reportId:F.moderationReport,requestPath:new URL(response.url()).pathname,method:response.request().method(),httpStatus:response.status(),businessCode:payload.code,sameIdContextMatched:true,entireOriginalTextMatched:true},null,2))
    await page.waitForFunction(() => {
      const modal=[...document.querySelectorAll('.el-dialog')].find(el=>el.getBoundingClientRect().width>0&&el.getBoundingClientRect().height>0)
      if(!modal)return false
      for(let el=modal;el&&el!==document.body;el=el.parentElement){const style=getComputedStyle(el);if(style.visibility!=='visible'||Number(style.opacity)<0.99)return false}
      return modal.getAnimations({subtree:true}).every(animation=>animation.playState!=='running')
    })
    await page.screenshot({path:fileURLToPath(new URL('report-context.png',OUT)),fullPage:true})
    await dialog.locator('.el-dialog__headerbtn').click()
  }
  results.push({component:route.component,entity,title:route.meta?.title,path:route.path,rows:list.rows.length,detail,status:'已实测通过'});console.log('PASS '+entity+' rows='+list.rows.length+' '+detail)
 }
 assert.deepEqual(errors,[]);assert.deepEqual(network,[])
 assertExtensionRoutes(results,manifest)
 console.log('后台扩展页 '+results.length+'/'+manifest.length+' 列表与现有数据详情通过')
}catch(e){console.error(e);process.exitCode=1;await page.screenshot({path:fileURLToPath(new URL('failure.png',OUT)),fullPage:true})}
finally{await writeFile(new URL('result.json',OUT),JSON.stringify({time:new Date().toISOString(),results,errors,network,exitCode:process.exitCode||0},null,2));await browser.close()}
