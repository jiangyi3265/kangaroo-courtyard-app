// Real local HTTP and browser; only network failure below is explicitly injected.
import { chromium } from 'playwright'
import assert from 'node:assert/strict'
import { mkdir, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
const OUT=new URL('../../artifacts/full-flow-20261001/route-empty/',import.meta.url)
await mkdir(OUT,{recursive:true})
const BASE=process.env.FLOW_TEST_URL||'http://127.0.0.1:5273/'
const API=process.env.FLOW_API_BASE||'http://localhost:8080'
async function api(path,token,body){return (await fetch(API+path,{method:body?'POST':'GET',headers:{'Content-Type':'application/json',...(token?{'X-App-Token':token}:{})},body:body?JSON.stringify(body):undefined})).json()}
assert.equal((await api('/app/auth/ping')).data.wxMock,true)
const a=await api('/app/auth/wx-login',null,{code:'route-empty-a-'+Date.now()})
const b=await api('/app/auth/wx-login',null,{code:'route-empty-b-'+Date.now()})
assert.equal(a.code,200);assert.equal(b.code,200)
const jobs=await api('/app/job/list?pageSize=100')
const ids=[...new Set(jobs.rows.map(j=>j.storeId))];assert.ok(ids.length>=2)
const target=await api('/app/route?storeId='+ids[0],a.token);assert.equal(target.code,200)
const browser=await chromium.launch({headless:true,args:['--no-proxy-server']})
const page=await browser.newPage({viewport:{width:390,height:844},timezoneId:'Asia/Shanghai'})
page.setDefaultTimeout(15000)
const errors=[],steps=[];page.on('pageerror',e=>errors.push(e.message))
async function open(query='',token=a.token){
 await page.goto(BASE)
 await page.evaluate(t=>localStorage.setItem('kangaroo:app-token',JSON.stringify({type:'string',data:t})),token)
 await page.goto(BASE+'#/pages/profile/review?s=2'+query);await page.reload({waitUntil:'domcontentloaded'})
 await page.locator('.shop__title').waitFor();await page.waitForLoadState('networkidle')
}
async function step(name,fn){await fn();steps.push(name);console.log('PASS '+name)}
const shot=name=>page.screenshot({path:fileURLToPath(new URL(name+'.png',OUT)),fullPage:true})
try{
 await page.goto(BASE)
 await page.evaluate(()=>localStorage.setItem('kangaroo:saved-route',JSON.stringify({type:'object',data:{title:'另一个旧订单地址',address:'不应被展示'}})))
 await step('empty 404 has explicit state and never reuses unrelated saved address',async()=>{
  await open();assert.equal(await page.locator('.shop__title').innerText(),'暂时没有需要到店的订单或录用')
  assert.equal(await page.locator('.plan').count(),0);assert.equal((await page.locator('.route').innerText()).includes('另一个旧订单地址'),false)
  await page.locator('.k-button').filter({hasText:'离线保存'}).click();await page.getByText('暂无可用路线，请先选择订单或门店',{exact:true}).waitFor();await shot('empty')
 })
 await step('actual store route loads and can be saved then reloaded',async()=>{
  await open('&storeId='+ids[0]);assert.equal(await page.locator('.shop__title').innerText(),target.data.title)
  await page.locator('.k-button').filter({hasText:'离线保存'}).click();await page.getByText('已保存到本机，没网时这里也能看到地址',{exact:true}).waitFor()
  await open('&storeId='+ids[0]);assert.equal(await page.locator('.shop__title').innerText(),target.data.title)
 })
 await page.route('**/app/route*',route=>route.abort('failed'))
 await step('injected network failure uses only same account and requested store cache',async()=>{
  await open('&storeId='+ids[0]);assert.equal(await page.locator('.shop__title').innerText(),target.data.title)
  assert.ok((await page.locator('.shop').innerText()).includes('离线'))
  await shot('offline-own-route')
  await open('&storeId='+ids[1]);assert.equal(await page.locator('.shop__title').innerText(),'网络连接失败，请检查网络后重试')
  assert.equal(await page.locator('.plan').count(),0)
 })
 await step('another account cannot read first account offline route; recovery fetches current route',async()=>{
  await open('&storeId='+ids[0],b.token);assert.equal(await page.locator('.shop__title').innerText(),'网络连接失败，请检查网络后重试')
  await page.unroute('**/app/route*');await open('&storeId='+ids[0],b.token)
  assert.equal(await page.locator('.shop__title').innerText(),target.data.title);await shot('recovered')
 })
 assert.deepEqual(errors,[]);assert.equal(steps.length,4);console.log('路线状态回归 4/4 通过')
}catch(e){console.error(e);process.exitCode=1;await shot('failure')}
finally{await writeFile(new URL('result.json',OUT),JSON.stringify({time:new Date().toISOString(),steps,errors,exitCode:process.exitCode||0},null,2));await browser.close()}
