import assert from 'node:assert/strict'
import { mkdir, writeFile } from 'node:fs/promises'
import { chromium, expect } from 'playwright/test'

const out='../artifacts/store-switch-20261002/browser'
await mkdir(out,{recursive:true})
const browser=await chromium.launch({headless:true})
const page=await browser.newPage({viewport:{width:390,height:844},isMobile:true})
const checks=[], errors=[], calls=[]
const stores=[
  {storeId:'102',storeName:'平潭袋鼠小院',roleName:'主理人',role:'manager',type:'直营',tone:'green'},
  {storeId:'104',storeName:'丽江袋鼠小院',roleName:'门店管家',role:'keeper',type:'直营',tone:'green'}
]
let failSwitch=false, failRefresh=false, mismatch=false, previewDelay=false, switchDelay=false, revision=1
let releasePreview, previewArrived, releaseSwitch, switchArrived
const deferred=()=>{let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve}}
const storeInfo=(id,view)=>{
  const selected=stores.find(s=>s.storeId===String(view||id))
  return {stores:stores.map(s=>({...s,current:s.storeId===String(id)})),current:selected,info:[['门店地址',selected.storeId==='102'?'平潭测试地址':'丽江测试地址'],['联系电话',selected.storeId==='102'?'平潭联系电话':'丽江联系电话']]}
}
page.on('pageerror',e=>errors.push(e.message))
await page.addInitScript(()=>localStorage.setItem('kangaroo:app-token',JSON.stringify({type:'string',data:'store-switch-fixture'})))
await page.route('**/app/**',async route=>{
  const req=route.request(), url=new URL(req.url()), path=url.pathname
  const input=req.method()==='POST'?req.postDataJSON():null, id=url.searchParams.get('storeId')||'102', view=url.searchParams.get('view')
  calls.push({path,id,view,input})
  let result={code:200,data:{},rows:[],total:0}
  if(path==='/app/auth/account') result.data={id:'9001',nickname:'测试员工',staffGrants:stores.map(s=>({storeId:Number(s.storeId),storeName:s.storeName,roleName:s.roleName,roleCode:s.role,active:true}))}
  else if(path==='/app/staff/team/stores') {
    result.data=storeInfo(mismatch&&!view?'102':id,view)
    if(view&&previewDelay){previewDelay=false;previewArrived.resolve();await releasePreview.promise}
    if(!view&&failRefresh) result={code:500,msg:'门店资料加载失败，请重试'}
  } else if(path==='/app/staff/team/hub') {
    const s=stores.find(s=>s.storeId===id);result.data={...s,name:'测试员工',isManager:s.role==='manager',unread:0}
  } else if(path==='/app/staff/team/switch') {
    if(switchDelay){switchDelay=false;switchArrived.resolve();await releaseSwitch.promise}
    result=failSwitch?{code:403,msg:'目标门店授权已撤销'}:{code:200,msg:'已切换到 '+stores.find(s=>s.storeId===String(input.storeId)).storeName}
  } else if(path==='/app/staff/workbench/home') result.data={overview:[{label:'测试营收',value:id==='102'?'1020':String(1040+revision),delta:''}],counts:{},total:0}
  else if(path==='/app/staff/workbench/todos') result.data={groups:[],counts:{},overdue:0}
  else if(path==='/app/staff/workbench/metrics') result.data={metrics:[{label:'测试数据',value:id==='102'?'1020':String(1040+revision)}]}
  else if(path==='/app/staff/jobs') result.data={canEdit:id==='102',rows:[{jobId:999,title:id==='104'?'丽江专属岗位':'平潭专属岗位',city:id==='104'?'丽江':'平潭',type:'全职',people:1}],metrics:[]}
  await route.fulfill({json:result})
})
const current=()=>page.locator('.active-store')
const choose=async name=>{await page.locator('.store-row').filter({hasText:name}).click()}
const switchButton=()=>page.locator('uni-button').filter({hasText:'切换到该门店'})
const open=async path=>{await page.goto('http://127.0.0.1:5373/#'+path);await page.waitForLoadState('networkidle')}
try {
  await open('/pages/staff/index')
  await expect(page.locator('.store__name')).toHaveText('平潭袋鼠小院')
  await expect(page.locator('.stat__value')).toHaveText('1020')
  await page.getByText('切换门店',{exact:true}).click()
  await expect(current()).toContainText('平潭袋鼠小院')
  previewDelay=true;releasePreview=deferred();previewArrived=deferred()
  await choose('丽江袋鼠小院');await previewArrived.promise
  switchDelay=true;releaseSwitch=deferred();switchArrived=deferred()
  const count=calls.filter(c=>c.path==='/app/staff/team/switch').length
  await switchButton().click();await switchArrived.promise
  await expect(page.getByText('正在切换…',{exact:true})).toBeVisible()
  await page.locator('uni-button').filter({hasText:'正在切换…'}).click({force:true})
  assert.equal(calls.filter(c=>c.path==='/app/staff/team/switch').length,count+1)
  releaseSwitch.resolve()
  await expect(current()).toContainText('丽江袋鼠小院')
  await expect(current()).toContainText('门店管家')
  await expect(page.locator('.store-info')).toContainText('丽江测试地址')
  await expect(page.locator('uni-toast')).toContainText('已切换到 丽江袋鼠小院')
  releasePreview.resolve();await page.waitForLoadState('networkidle')
  await expect(current()).toContainText('丽江袋鼠小院')
  await expect(page.locator('.store-info')).toContainText('丽江测试地址')
  checks.push('string store-list IDs match numeric grants; current store, role and address update together; delayed old preview cannot overwrite; double click sends once')
  await page.screenshot({path:`${out}/lijiang-selected.png`,fullPage:true})
  // 浏览器返回对应 navigateTo 打开的上一页，验证缓存工作台 onShow 刷新。
  await page.goBack()
  await expect(page.locator('.store__name')).toHaveText('丽江袋鼠小院')
  await expect(page.locator('.hello__role')).toHaveText('角色：门店管家')
  await expect(page.locator('.stat__value')).toHaveText('1041')
  checks.push('returning to cached workbench reloads new-store metrics and role')
  await page.getByText('切换门店',{exact:true}).click()
  await expect(current()).toContainText('丽江袋鼠小院')
  failSwitch=true;await choose('平潭袋鼠小院');await switchButton().click()
  await expect(page.locator('uni-toast')).toContainText('目标门店授权已撤销')
  await expect(current()).toContainText('丽江袋鼠小院')
  failSwitch=false
  checks.push('revoked authorization leaves current store unchanged and shows failure')
  failRefresh=true;await switchButton().click()
  await expect(page.locator('uni-toast')).toContainText('门店资料加载失败')
  await expect(current()).toContainText('丽江袋鼠小院')
  failRefresh=false
  await switchButton().click()
  await expect(current()).toContainText('平潭袋鼠小院')
  checks.push('refresh failure never announces success; retry completes normally')
  await choose('丽江袋鼠小院');mismatch=true;await switchButton().click()
  await expect(page.locator('uni-toast')).toContainText('门店数据未更新')
  await expect(current()).toContainText('平潭袋鼠小院')
  mismatch=false;await switchButton().click()
  await expect(current()).toContainText('丽江袋鼠小院')
  checks.push('wrong-store response is rejected instead of showing a false success')
  await page.reload();await page.waitForLoadState('networkidle')
  await expect(current()).toContainText('丽江袋鼠小院')
  checks.push('full page reload restores the selected store for the same account')
  await page.locator('.business-tabs').getByText('工作台',{exact:true}).click()
  await expect(page.locator('.current-store')).toContainText('丽江袋鼠小院')
  await expect(page.locator('.staff-head')).toContainText('门店管家')
  await page.getByText('岗位管理',{exact:true}).click()
  await expect(page.getByText('丽江专属岗位',{exact:true})).toBeVisible()
  assert.equal(calls.filter(c=>c.path==='/app/staff/jobs').at(-1).id,'104')
  checks.push('business hub and job requests use the newly selected store')
  assert.deepEqual(errors,[])
  console.log(JSON.stringify({checks,errors},null,2))
} catch(e){await page.screenshot({path:`${out}/failure.png`,fullPage:true});throw e}
finally {await writeFile(`${out}/result.json`,JSON.stringify({scope:'local real H5 pages, explicit fixture APIs',checks,errors,calls},null,2));await browser.close()}
