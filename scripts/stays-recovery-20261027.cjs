// Local/browser-only recovery checks. Quotes are fixtures; order writes are blocked.
const { chromium } = require('playwright')
const assert = require('node:assert/strict'), fs = require('node:fs/promises'), path = require('node:path')
const base = process.env.AUDIT_BASE || 'http://127.0.0.1:5193'
const out = process.env.AUDIT_OUT ? path.resolve(process.env.AUDIT_OUT) : path.resolve(__dirname, '../../artifacts/refinement-20261027/stays')
const day = n => new Date(Date.now() + 8 * 3600000 + n * 86400000).toISOString().slice(0, 10)
;(async () => {
 await fs.mkdir(out, { recursive: true })
 const browser = await chromium.launch(), results = [], errors = [], blockedWrites = []
 const page = async width => {
  const p = await browser.newPage({viewport:{width,height:760},isMobile:true,hasTouch:true}); p.on('pageerror',e=>errors.push(e.message))
  await p.route('**/app/stay/orders',r=>{blockedWrites.push(r.request().url());return r.abort()})
  return p
 }
 const go = (p,route) => p.goto(base+'/#'+route,{waitUntil:'networkidle'})
 const snapshot = async(p,name) => {await p.locator('.uni-actionsheet_toggle').waitFor({state:'detached'});await p.waitForTimeout(350);await p.evaluate(async()=>{await document.fonts.ready;await Promise.all([...document.images].map(i=>i.decode().catch(()=>{})))}); assert(!await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),name+' overflow');await p.screenshot({path:path.join(out,name+'.png'),fullPage:true})}
 try {
  for(const width of [320,390]){
   const d=await page(width);await go(d,'/pages/stays/detail?stayId=7');await d.locator('.rt').first().waitFor()
   const rects=await d.locator('.rt').evaluateAll(es=>es.map(e=>{const price=e.querySelector('.rt__unit').getBoundingClientRect(),btn=e.querySelector('.rt__btn').getBoundingClientRect();return {priceRight:price.right,priceBottom:price.bottom,buttonLeft:btn.left,buttonTop:btn.top}}))
   assert(rects.every(r=>r.priceRight<=r.buttonLeft||r.priceBottom<=r.buttonTop),'room price and selection overlap')
   await d.locator('.room-section').scrollIntoViewIfNeeded();await snapshot(d,'fixed-room-prices-'+width);results.push({check:'room prices and selection buttons never overlap',width,rects});await d.close()
  }
  const p=await page(320), requests=[];let fail=true
  await p.route('**/app/stay/7/reviews/summary',r=>r.fulfill({json:{code:200,data:{count:20,avg:4.8,recommendRate:96,dims:[{label:'环境',avg:4.8},{label:'氛围',avg:4.9},{label:'卫生',avg:4.7},{label:'设施',avg:4.6}]}}}))
  await p.route('**/app/stay/7/reviews?**',r=>{const n=Number(new URL(r.request().url()).searchParams.get('pageNum'));requests.push(n);if(n===2&&fail)return r.fulfill({status:503,json:{code:503,msg:'评价加载失败，请重试'}});return r.fulfill({json:{code:200,data:{rows:Array.from({length:10},(_,i)=>({reviewId:(n-1)*10+i+1,name:i?'浏览器验收样例'+((n-1)*10+i+1):'这是一位昵称较长的家人用于检查窄屏排版',roomType:i?'庭院大床房':'庭院舒适阳光景观独立卫浴大床房',date:'2026.10',rating:5,content:'浏览器隔离样例，用于检查分页失败后能否继续加载，未写入服务器。'})),hasMore:n<2}}})})
  await go(p,'/pages/stays/reviews?stayId=7');await p.locator('.rv').nth(9).waitFor();await snapshot(p,'fixed-review-longtext-320');await p.locator('.sr-more').scrollIntoViewIfNeeded();await p.mouse.wheel(0,12000);await p.locator('.sr-empty--inline').filter({hasText:'评价加载失败'}).waitFor();assert.equal(await p.locator('.rv').count(),10);fail=false;await p.locator('.sr-empty__btn').filter({hasText:'重新加载评价'}).click();await p.locator('.rv').nth(19).waitFor();assert.deepEqual(requests,[1,2,2]);assert.equal(await p.locator('.rv').count(),20);await snapshot(p,'fixed-review-pagination-retry-320');results.push({check:'failed second page retry preserves first page and reloads page 2',requests,rows:20});await p.close()
  for(const width of [320,390]){
   const b=await page(width);let fail=true
   await b.route('**/app/stay/7',r=>fail?r.fulfill({status:503,json:{code:503,msg:'房源信息暂时无法加载，请稍后重试'}}):r.continue())
   await go(b,'/pages/stays/booking?stayId=7');await b.locator('.booking-retry').waitFor();assert.equal(await b.locator('.type-card').count(),0);assert.equal(await b.locator('.cta__btn').count(),0);await snapshot(b,'fixed-booking-init-error-'+width);fail=false;await b.locator('.booking-retry').click();await b.locator('.type-card').first().waitFor();await b.locator('.type-card').first().click();await b.locator('.cta__btn .k-button').click();await b.locator('.calendar-grid').waitFor();results.push({check:'initial stay error has persistent recovery; retry restores rooms and calendar',width});await b.close()
  }
  for(const width of [320,390]){
   const p=await page(width), requests=[];let releaseOld,sawOld,failFour=true
   const oldGate=new Promise(r=>releaseOld=r),oldSeen=new Promise(r=>sawOld=r)
   await p.route('**/app/stay/orders/quote',async r=>{
    const x=r.request().postDataJSON();requests.push(x.guests)
    if(x.guests===2){sawOld();await oldGate}
    if(x.guests===4&&failFour)return r.fulfill({status:503,json:{code:503,msg:'最新报价暂时无法查询，请重试'}})
    return r.fulfill({json:{code:200,data:{stay:{stayName:'浏览器报价验收样例',capacity:6,cover:'/static/media/stays-hero.jpg'},checkIn:day(1),checkOut:day(2),nights:1,nightly:[{priceFen:x.guests*10000}],bookable:true,roomFen:x.guests*10000,payFen:x.guests*10000,addonFen:0,serviceFeeFen:0,agreement:{},policy:{}}}})
   })
   await go(p,'/pages/stays/pay?stayId=7&roomTypeId=1&checkIn='+day(1)+'&checkOut='+day(2)+'&guests=1');await p.locator('.k-price').filter({hasText:'¥100'}).waitFor()
   async function choose(n){await p.locator('.kv').filter({hasText:'入住人数'}).click();await p.locator('.uni-actionsheet__cell').filter({hasText:new RegExp('^'+n+'人$')}).click()}
   await choose(2);await oldSeen;assert.equal(await p.locator('.k-price').innerText(),'¥--');assert(await p.locator('.k-bottom .k-button').evaluate(e=>e.classList.contains('is-disabled')||e.hasAttribute('disabled')));await choose(3);await p.locator('.k-price').filter({hasText:'¥300'}).waitFor();const oldResponse=p.waitForResponse(r=>r.url().includes('/orders/quote')&&r.request().postDataJSON().guests===2);releaseOld();await oldResponse;await p.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));assert.equal(await p.locator('.k-price').innerText(),'¥300');assert((await p.locator('.kv').filter({hasText:'入住人数'}).innerText()).includes('3人'));await snapshot(p,'fixed-pay-stale-guests-'+width)
   await choose(4);await p.locator('.quote-state__retry').waitFor();assert.equal(await p.locator('.k-price').innerText(),'¥--');assert(await p.locator('.k-bottom .k-button').evaluate(e=>e.classList.contains('is-disabled')||e.hasAttribute('disabled')));assert.equal(await p.locator('.k-bottom .k-button').evaluate(e=>getComputedStyle(e).backgroundImage),'none','Disabled action must not look active');const url=p.url();await p.locator('.k-bottom .k-button').click({force:true});assert.equal(p.url(),url);await snapshot(p,'fixed-pay-error-'+width);failFour=false;await p.locator('.quote-state__retry').click();await p.locator('.k-price').filter({hasText:'¥400'}).waitFor();await p.locator('.k-bottom .k-button:not(.is-disabled)').waitFor();assert.equal(await p.locator('.quote-state__retry').count(),0);await snapshot(p,'fixed-pay-retry-'+width);results.push({check:'latest guest quote wins; pending/error cannot continue; retry restores price',width,requests});await p.close()
  }
  assert.deepEqual(errors,[]);assert.deepEqual(blockedWrites,[])
  await fs.writeFile(path.join(out,'verification.json'),JSON.stringify({base,results,errors,blockedWrites},null,2));console.log(JSON.stringify({passed:results.length,errors,blockedWrites}))
 } catch(error) {
  const pages=[]
  for(const context of browser.contexts()) for(const active of context.pages()) {
   if(active.isClosed())continue
   const number=pages.length
   pages.push({url:active.url(),text:(await active.locator('body').innerText().catch(()=>'' )).slice(0,5000)})
   await active.screenshot({path:path.join(out,'failure-'+number+'.png'),fullPage:true}).catch(()=>{})
  }
  await fs.writeFile(path.join(out,'failure.json'),JSON.stringify({base,error:String(error),errors,blockedWrites,pages},null,2))
  throw error
 } finally {await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1})
