const { chromium } = require('playwright')
const assert = require('node:assert/strict'), fs = require('node:fs/promises'), path = require('node:path')
const base = process.env.AUDIT_BASE || 'http://127.0.0.1:5193'
const out = process.env.AUDIT_OUT ? path.resolve(process.env.AUDIT_OUT) : path.resolve(__dirname, '../../artifacts/recovery-20261027/stays')
const day = n => new Date(Date.now()+8*3600000+n*86400000).toISOString().slice(0,10)
const valid = {stayId:7,roomTypeId:23,checkIn:day(1),checkOut:day(2),guests:2}
;(async()=>{
 await fs.mkdir(out,{recursive:true})
 const browser=await chromium.launch(), results=[], errors=[], writes=[]
 const page=async width=>{
  const p=await browser.newPage({viewport:{width,height:760},isMobile:true,hasTouch:true}), quotes=[]
  p.on('pageerror',e=>errors.push(e.message))
  await p.route('**/app/stay/orders**',async r=>{
   if(r.request().method()==='POST'&&r.request().url().endsWith('/quote')){
    const q=r.request().postDataJSON();quotes.push(q)
    return r.fulfill({json:{code:200,data:{stay:{stayName:'浏览器验收小院',capacity:6},checkIn:q.checkIn,checkOut:q.checkOut,nights:1,nightly:[{priceFen:12000}],roomFen:12000,payFen:12000,bookable:true}}})
   }
   if(r.request().method()!=='GET'){writes.push(r.request().url());return r.abort()}
   if(r.request().url().includes('/ENTRY_READONLY'))return r.fulfill({json:{code:200,data:{orderNo:'ENTRY_READONLY',status:'closed',stay:{stayName:'只读订单恢复样例'},payFen:12000,checkIn:day(1),checkOut:day(2),nights:1}}})
   return r.continue()
  })
  return {p,quotes}
 }
 const go=(p,q)=>p.goto(base+'/#/pages/stays/pay?'+new URLSearchParams(q),{waitUntil:'networkidle'})
 const shot=async(p,name)=>{await p.evaluate(()=>document.fonts.ready);assert(!await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1));await p.screenshot({path:path.join(out,name+'.png'),fullPage:true})}
 try{
  for(const width of [320,390]){
   for(const [name,query,destination] of [
    ['missing-room',{stayId:7},'/pages/stays/booking?stayId=7'],
    ['missing-stay',{roomTypeId:23,checkIn:day(1),checkOut:day(2)},'/pages/stays/list'],
    ['invalid-date',{...valid,checkIn:'2026-02-30'},'/pages/stays/booking?stayId=7&roomTypeId=23']
   ]){
    const {p,quotes}=await page(width)
    await go(p,query);await p.locator('.entry-empty').waitFor()
    assert.equal(quotes.length,0);assert.equal(await p.locator('.room,.stay-dates,.kv,.paybar,.k-bottom').count(),0)
    assert(!/共0晚|¥--|入住人数/.test(await p.locator('.entry-empty').innerText()))
    await shot(p,name+'-'+width)
    await p.locator('.entry-empty__action .k-button').click()
    await p.waitForURL(u=>u.hash==='#'+destination)
    assert(!p.url().includes('/pages/home/'))
    results.push({check:name,width,quoteCallsBeforeRecovery:0,destination});await p.close()
   }
  }
  const invalidCases=[
   ['empty',{}],['invalid-stay',{...valid,stayId:'abc'}],['invalid-room',{...valid,roomTypeId:'-1'}],
   ['missing-dates',{stayId:7,roomTypeId:23}],['reversed-dates',{...valid,checkIn:day(2),checkOut:day(1)}],
   ['same-day',{...valid,checkOut:day(1)}],['past-date',{...valid,checkIn:day(-1)}],
   ['too-many-nights',{...valid,checkOut:day(32)}],['too-far',{...valid,checkIn:day(181),checkOut:day(182)}],
   ['invalid-guests',{...valid,guests:'0'}],['direct-confirm-missing-room',{stayId:7,s:2}]
  ]
  for(const [name,query] of invalidCases){const {p,quotes}=await page(320);await go(p,query);await p.locator('.entry-empty').waitFor();assert.equal(quotes.length,0,name);assert.equal(await p.locator('.k-bottom,.paybar').count(),0);results.push({check:name,quoteCalls:0});await p.close()}
  const {p,quotes}=await page(320);await go(p,{...valid,s:2});await p.locator('.room').waitFor();await p.locator('.k-price').filter({hasText:'¥120'}).waitFor();assert((await p.locator('body').innerText()).includes('入住人信息'));assert.equal(await p.locator('.idcard').count(),0);assert.equal(quotes.length,1);await shot(p,'valid-direct-confirm-opens-form-320');results.push({check:'valid fresh link cannot skip guest information via s=2',quotes:quotes.length});await p.close()
  const existing=await page(390);await go(existing.p,{orderNo:'ENTRY_READONLY'});await existing.p.locator('.amount__name').filter({hasText:'只读订单恢复样例'}).waitFor();assert.equal(await existing.p.locator('.entry-empty').count(),0);assert.equal(existing.quotes.length,0);results.push({check:'existing order-only link still restores order without requiring room parameters'});await existing.p.close()
  assert.deepEqual(errors,[]);assert.deepEqual(writes,[])
  await fs.writeFile(path.join(out,'verification.json'),JSON.stringify({base,results,errors,writes},null,2));console.log(JSON.stringify({passed:results.length,errors,writes}))
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1})
