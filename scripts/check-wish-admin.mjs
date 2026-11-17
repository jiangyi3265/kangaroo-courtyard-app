import { chromium } from 'playwright'
import { execFileSync } from 'node:child_process'
import { resolve } from 'node:path'
import assert from 'node:assert/strict'
const fixture=JSON.parse(execFileSync('python',['.dev/tools/wish_admin_fixture.py'],{cwd:resolve('..'),encoding:'utf8'}))
const login=await(await fetch('http://127.0.0.1:8087/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(fixture)})).json()
assert.equal(login.code,200,login.msg)
const suffix=Date.now().toString(36),title='后台界面验收 '+suffix
const appUser=await(await fetch('http://127.0.0.1:8087/app/auth/wx-login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({code:'wish-admin-ui-'+suffix,nickname:'后台验收发布者'})})).json()
assert.equal(appUser.mockLogin,true,'This test only runs against the isolated mock backend')
const created=await(await fetch('http://127.0.0.1:8087/app/wishes',{method:'POST',headers:{'Content-Type':'application/json','X-App-Token':appUser.token},body:JSON.stringify({title,description:'本地后台界面验收专用，帮忙拍一张当地风景照。',requestKey:'admin-ui-'+suffix,mode:'free',category:'postcard',originCity:'大连',targetCity:'广西阳朔',delivery:'digital',deadline:new Date(Date.now()+86400000).toISOString().slice(0,10),images:[],agreed:true})})).json()
assert.equal(created.code,200,created.msg)
const browser=await chromium.launch({headless:true,args:['--no-proxy-server']})
const context=await browser.newContext({viewport:{width:1440,height:1000},locale:'zh-CN'})
await context.addCookies([{name:'Admin-Token',value:login.token,domain:'127.0.0.1',path:'/'}])
const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message))
try{
 await page.goto('http://127.0.0.1:5188/kangaroo/wishes',{waitUntil:'networkidle'})
 await page.getByRole('heading',{name:'心愿互助',exact:true}).waitFor()
 await page.screenshot({path:'../artifacts/wish-ui/admin-wishes.png',fullPage:true})
 await page.locator('.el-table__row').filter({hasText:title}).getByRole('button',{name:'查看处理'}).click()
 await page.getByRole('button',{name:'审核通过并展示'}).waitFor()
 await page.screenshot({path:'../artifacts/wish-ui/admin-detail.png',fullPage:true})
 await page.getByRole('button',{name:'审核通过并展示'}).click()
 const approval=page.getByRole('dialog',{name:'审核通过',exact:true})
 await approval.getByText('已人工核对正文、原始图片及实际商品，确认无禁止品类',{exact:true}).click()
 await approval.locator('textarea').fill('浏览器验收：核实心愿属于允许品类，描述与价格完整。')
 const response=page.waitForResponse(r=>/\/kangaroo\/wishes\/\d+\/approve$/.test(r.url())&&r.request().method()==='POST')
 await approval.getByRole('button',{name:'确认核实结果',exact:true}).click()
 assert.equal((await(await response).json()).code,200)
 await page.locator('.el-drawer__close-btn').click()
 await page.getByRole('tab',{name:'资质 / 收款资料'}).click()
 await page.getByRole('link',{name:'查看私有文件'}).first().waitFor()
 await page.screenshot({path:'../artifacts/wish-ui/admin-credentials.png',fullPage:true})
 assert.deepEqual(errors,[]);console.log('PASS: admin route permissions, wish table, detail drawer, actual approval, private credential table')
}catch(e){await page.screenshot({path:'../artifacts/wish-ui/admin-failure.png',fullPage:true});console.error(errors);throw e}finally{await browser.close()}
