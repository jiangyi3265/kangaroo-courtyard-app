import { chromium } from 'playwright'
import assert from 'node:assert/strict'
import { mkdir,readFile,writeFile } from 'node:fs/promises'
import { execFileSync } from 'node:child_process'
import { resolve } from 'node:path'
const api='http://127.0.0.1:8087',base='http://127.0.0.1:5187/#/pages/wish/',output='../artifacts/wish-ui',asset=resolve('pages/wish/static/wish-hero.jpg')
const suffix=Date.now().toString(36)
await mkdir(output,{recursive:true})
async function call(path,body,token,admin=false){const r=await fetch(api+path,{method:body===undefined?'GET':'POST',headers:{'Content-Type':'application/json',...(token?{[admin?'Authorization':'X-App-Token']:admin?'Bearer '+token:token}:{})},body:body===undefined?undefined:JSON.stringify(body)});const d=await r.json();assert.equal(d.code,200,path+': '+d.msg);return d}
const owner=await call('/app/auth/wx-login',{code:'wish-flow-owner-'+suffix,nickname:'验收发布者'}),helper=await call('/app/auth/wx-login',{code:'wish-flow-helper-'+suffix,nickname:'验收服务者'})
assert.equal(owner.mockLogin,true,'This test only runs against the isolated mock backend')
const fixture=JSON.parse(execFileSync('python',['.dev/tools/wish_admin_fixture.py'],{cwd:resolve('..'),encoding:'utf8'}))
const admin=(await call('/login',fixture)).token
const browser=await chromium.launch({headless:true,args:['--no-proxy-server']})
const errors=[]
async function client(token){const c=await browser.newContext({viewport:{width:390,height:844},isMobile:true,timezoneId:'Asia/Shanghai',locale:'zh-CN'});await c.addInitScript(token=>localStorage.setItem('kangaroo:app-token',JSON.stringify({type:'string',data:token})),token);const p=await c.newPage();p.on('pageerror',e=>errors.push(e.message));return p}
const page=await client(owner.token),other=await client(helper.token)
async function snap(p,name){await p.evaluate(()=>window.scrollTo(0,0));await p.waitForTimeout(200);await p.screenshot({path:output+'/'+name+'.png',fullPage:true});assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false,name+' overflows')}
const input=(p,ph)=>p.locator('uni-input').filter({has:p.getByText(ph,{exact:true})}).locator('input')
try{
  await page.goto(base+'publish',{waitUntil:'networkidle'})
  await input(page,'说说你的小心愿').fill('帮我寄一张阳朔明信片')
  await page.locator('textarea').fill('请选一张阳朔风景明信片，写一句祝福寄往大连。邮资包含在成本内，寄出前请拍照确认。')
  const [choosing]=await Promise.all([page.waitForEvent('filechooser'),page.locator('.wp-add').click()]);await choosing.setFiles(asset)
  await page.locator('.wp-cell image,.wp-cell uni-image').first().waitFor()
  await input(page,'如辽宁大连').fill('辽宁大连');await input(page,'如广西阳朔').fill('广西阳朔')
  await page.getByText('期望完成日期',{exact:true}).click();await page.locator('.uni-picker-action-confirm:visible').click()
  await page.locator('.wp-cost__input input').fill('100');await page.locator('.wp-cost__input input').blur()
  await page.locator('.w-check__box').click();await page.getByText('下一步',{exact:true}).click()
  await page.getByText('再确认一下').waitFor();await snap(page,'06-confirm')
  const publication=page.waitForResponse(r=>r.url().endsWith('/app/wishes')&&r.request().method()==='POST')
  await page.getByText('支付并发布',{exact:true}).click();const published=await (await publication).json();assert.equal(published.code,200,published.msg);const id=published.data.wishId
  await page.getByText('模拟支付',{exact:true}).click();await page.getByText('审核中',{exact:true}).waitFor()
  assert.equal((await call('/app/wishes/'+id,undefined,owner.token)).data.status,'reviewing')
  await call('/kangaroo/wishes/'+id+'/approve',{note:'本地验收：已核实为允许的文创明信片心愿',contentChecked:true,complianceTypes:['ordinary']},admin,true)
  await other.goto(base+'detail?id='+id,{waitUntil:'networkidle'});await snap(other,'03-detail')
  await other.getByText('我来帮忙',{exact:true}).click();await other.locator('.w-check__box').click();await snap(other,'07-accept-confirm')
  await other.getByText('确认接单',{exact:true}).click();await other.getByText('进行中',{exact:true}).waitFor()
  await other.getByText('订单沟通',{exact:true}).click();await other.locator('.wo-compose input').fill('你好，明信片已挑好，寄出前发照片给你确认。');await other.getByText('发送',{exact:true}).click();await other.getByText('你好，明信片已挑好，寄出前发照片给你确认。',{exact:true}).waitFor();await snap(other,'08-order-chat')
  await other.getByText('订单进度',{exact:true}).click();await other.getByText('提交完成凭证',{exact:true}).click()
  const [proofFile]=await Promise.all([other.waitForEvent('filechooser'),other.locator('.wp-add').click()]);await proofFile.setFiles(asset);await other.locator('.wp-cell').waitFor()
  await other.locator('.w-sheet textarea').fill('明信片已经寄出，图片为本地测试交付凭证。');await other.getByText('确认提交',{exact:true}).click();await other.getByText('待确认完成',{exact:true}).waitFor()
  await page.goto(base+'order?id='+id,{waitUntil:'networkidle'});await page.getByText('确认完成',{exact:true}).click();await page.getByText('确定',{exact:true}).click();await page.getByText('心愿完成，善意抵达',{exact:true}).waitFor();await snap(page,'09-settlement')
  const done=(await call('/app/wishes/'+id,undefined,owner.token)).data;assert.equal(done.netFen,9595);assert.equal(done.feeFen,505);assert.equal(done.payoutStatus,'pending')
  const denied=await (await fetch(api+'/app/wishes/'+id+'/actions/complete',{method:'POST',headers:{'Content-Type':'application/json','X-App-Token':helper.token},body:'{}'})).json();assert.equal(denied.code,403)
  const upload=new FormData();upload.set('type','payout');upload.set('city','');upload.set('file',new Blob([await readFile(asset)],{type:'image/jpeg'}),'local-test-payout.jpg')
  const doc=await (await fetch(api+'/app/wishes/credentials',{method:'POST',headers:{'X-App-Token':helper.token},body:upload})).json();assert.equal(doc.code,200,doc.msg)
  const creds=(await call('/app/wishes/credentials',undefined,helper.token)).data;assert.equal(creds.length,1);assert(!('fileKey' in creds[0]));assert.match(creds[0].url,/\/kangaroo\/file\/private\?k=/)
  await call('/kangaroo/wishes/credentials/'+creds[0].credentialId+'/review',{approved:true,documentChecked:true,note:'本地验收资料，非真实银行账户'},admin,true)
  await call('/kangaroo/wishes/'+id+'/payout',{amountFen:9595,receipt:'LOCAL-TEST-NO-TRANSFER-'+suffix,note:'隔离本地测试，仅验证登记功能，未真实转账'},admin,true)
  assert.equal((await call('/app/wishes/'+id,undefined,helper.token)).data.payoutStatus,'paid')
  await call('/app/wishes/'+id+'/actions/review',{rating:5,note:'本地验收：完整互助流程通过。'},owner.token)
  const free=(await call('/app/wishes',{requestKey:'free-e2e-'+suffix,title:'帮我拍一张北海的落日',description:'免费拍一张当地海边的落日风景照片，在线发送即可。',category:'postcard',originCity:'辽宁大连',targetCity:'广西北海',delivery:'digital',deadline:new Date(Date.now()+86400000).toISOString().slice(0,10),images:[],mode:'free',cost:'100',agreed:true},owner.token)).data
  assert.equal(free.amountFen,0);assert.equal(free.payNo,null)
  await call('/kangaroo/wishes/'+free.wishId+'/approve',{note:'本地验收：免费风景互助',contentChecked:true,complianceTypes:['ordinary']},admin,true)
  await call('/app/wishes/'+free.wishId+'/accept',{},helper.token)
  await call('/app/wishes/'+free.wishId+'/actions/deliver',{note:'已完成拍照并提交本地测试照片',images:done.images},helper.token)
  const completedFree=(await call('/app/wishes/'+free.wishId+'/actions/complete',{},owner.token)).data
  assert.equal(completedFree.feeFen,0);assert.equal(completedFree.netFen,0);assert.equal(completedFree.payoutStatus,'none')
  await page.goto(base+'mine',{waitUntil:'networkidle'});await snap(page,'10-mine-orders')
  await writeFile(output+'/flow-report.json',JSON.stringify({passed:true,paidWish:id,freeWish:free.wishId,price:10100,fee:505,net:9595,errors},null,2))
  assert.deepEqual(errors,[]);console.log('PASS: real local APIs + paid publish UI + review + helper acceptance UI + chat + delivery upload + requester completion + private credential + audited payout + review + free lifecycle')
}catch(e){await page.screenshot({path:output+'/owner-failure.png',fullPage:true});await other.screenshot({path:output+'/helper-failure.png',fullPage:true});console.error('Page errors:',errors);throw e}finally{await browser.close()}
