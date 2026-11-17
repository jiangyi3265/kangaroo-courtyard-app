const { chromium } = require('playwright')
const assert = require('node:assert/strict')
const fs = require('node:fs/promises')
const path = require('node:path')
const out=path.resolve(__dirname,'../../artifacts/camp-20261117/browser')
const base='http://127.0.0.1:5391'
;(async()=>{
  await fs.mkdir(out,{recursive:true})
  const browser=await chromium.launch({headless:true})
  const checks=[], errors=[]
  try {
    for(const width of [320,390]) {
      const context=await browser.newContext({viewport:{width,height:844},isMobile:true,hasTouch:true,geolocation:{latitude:30.57,longitude:104.06,accuracy:10},permissions:['geolocation']})
      let groupReads=0,missingQr=false,groupFailure=false,managed=false
      const page=await context.newPage()
      page.on('pageerror', e=>errors.push(e.message))
      await page.route('**/*',async route=>{
        const url=new URL(route.request().url()), p=url.pathname
        if(url.origin===base) return route.continue()
        if(p.startsWith('/profile/')) return route.fulfill({contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" width="240" height="240"><rect width="240" height="240" fill="#fcf9f3"/><text x="28" y="115" font-size="16">QA image, not a group QR</text></svg>'})
        let data={}
        if(p==='/app/features') data={stayBookingEnabled:true,recruitmentEnabled:true,groupChatEnabled:true}
        else if(p==='/app/cities/locate') data={found:true,source:'administrative_boundary',name:'成都'}
        else if(p==='/app/cities') data={all:[{name:'成都',initial:'C'},{name:'杭州',initial:'H'},{name:'大理',initial:'D'}],groups:[],hot:['成都','杭州']}
        else if(p==='/app/camp/groups') {
          groupReads++
          if(groupFailure) return route.fulfill({json:{code:500,msg:'测试网络异常'}})
          const group=(city,dest)=>({city,name:city+(dest?'目的地群':'同城群'),state:missingQr?'unavailable':'ready',qrUrl:missingQr?'':'/profile/upload/'+(dest?'destination':'local')+groupReads+'.png'})
          data={current:group(url.searchParams.get('current')||'',false),destination:group(url.searchParams.get('destination')||'',true),destinationSource:'browse'}
        }
        else if(/^\/app\/stay\/\d+$/.test(p)) data={stayId:7,stayName:managed?'测试代运营小院':'测试自营小院',houseType:managed?'managed':'direct',operateMode:'direct',city:'杭州',storeId:3,roomTypes:[],images:[],facilities:[],tags:[],periodPrices:[],host:{},address:'测试地址',reviewCount:0}
        else if(p.includes('/room-types')) data=[{roomTypeId:23,typeName:'双人房',capacity:2,bookable:true,displayPriceFen:70000,displayPriceLabel:'7晚参考价',features:[],remainText:'可订',basePriceFen:10000}]
        else if(p.includes('/vlogs')||p.includes('/activities')||p.includes('/reviews')) data={rows:[],list:[],total:0}
        else if(p.includes('/calendar')) data={days:[]}
        else if(p==='/app/home/feed') data={stays:[],activities:[],jobs:[]}
        else if(p==='/app/notices/popup') data=null
        else if(p==='/app/support/quick'||p==='/app/support/faqs') data=[]
        else if(p.startsWith('/app/')) data={}
        else return route.fulfill({status:204,body:''})
        return route.fulfill({json:{code:200,data}})
      })
      const visit=route=>page.goto(base+'/#'+route,{waitUntil:'networkidle'})
      const shot=async name=>{
        await page.evaluate(()=>window.scrollTo(0,0))
        await page.waitForTimeout(200)
        assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false,'horizontal overflow '+name)
        await page.screenshot({path:path.join(out,`${name}-${width}.png`),fullPage:true})
      }
      await visit('/pages/home/index')
      await page.locator('.handbook-banner').click()
      await page.locator('.handbook-cover').waitFor()
      await shot('handbook')
      await page.locator('.contents-row').filter({hasText:'把安全放进行李里'}).click()
      await page.locator('#safety').waitFor()
      assert(await page.locator('#safety').innerText().then(s=>s.includes('保护资料与支付信息')))
      checks.push(`首页手册跳转、四章正文、目录交互 ${width}`)
      await visit('/pages/stays/detail?stayId=7')
      await page.locator('.booking-assistant').waitFor()
      assert.equal(await page.locator('.stay-booking-dock').count(),0)
      await shot('direct-stay')
      await page.locator('.booking-assistant').click()
      await page.waitForURL(/pages\/notice\/support/)
      checks.push(`自营详情客服入口，隐藏预订 ${width}`)
      await visit('/pages/stays/booking?stayId=7&roomTypeId=23')
      await page.waitForURL(/pages\/stays\/detail/)
      await page.locator('.booking-assistant').waitFor()
      checks.push(`自营旧预订链接返回详情 ${width}`)
      managed=true
      await visit('/pages/stays/detail?stayId=7')
      await page.locator('.book__main').filter({hasText:'立即预订'}).waitFor()
      assert.equal(await page.locator('.booking-assistant').count(),0)
      await page.locator('.book').click()
      await page.waitForURL(/pages\/stays\/booking/)
      checks.push(`代运营保留预订入口 ${width}`)
      await visit('/pages/camp/index')
      await page.locator('.group-name').filter({hasText:'杭州目的地群'}).waitFor()
      await page.locator('.group-name').filter({hasText:'成都同城群'}).waitFor()
      await shot('camp')
      const before=groupReads
      await page.locator('.group-card--current').click()
      await page.locator('.qr-instruction').waitFor()
      assert(groupReads>before,'re-fetch current QR')
      await shot('qr-dialog')
      await page.locator('.qr-close').click()
      missingQr=true
      await page.locator('.group-card--destination').click()
      await page.locator('.qr-state').filter({hasText:'暂未开放'}).waitFor()
      assert.equal(await page.locator('.qr-image').count(),0)
      await page.locator('.qr-close').click()
      groupFailure=true
      await page.locator('.group-card--current').click()
      await page.locator('.qr-state').filter({hasText:'测试网络异常'}).waitFor()
      assert.equal(await page.locator('.qr-image').count(),0)
      groupFailure=false; missingQr=false
      await page.locator('.qr-retry').click()
      await page.locator('.qr-instruction').waitFor()
      checks.push(`定位与最近浏览、活码刷新、空配置、失败重试 ${width}`)
      await page.locator('.qr-close').click()
      await context.clearPermissions()
      await page.locator('.city-line uni-button').click()
      await page.locator('.hint').filter({hasText:/定位|GPS/}).first().waitFor()
      await page.locator('.group-heading uni-button').first().click()
      await page.waitForURL(/city-picker/)
      checks.push(`定位拒绝后可手动选城 ${width}`)
      await context.close()
    }
    assert.deepEqual(errors,[])
    await fs.writeFile(path.join(out,'results.json'),JSON.stringify({checks,errors,mockApi:true},null,2))
    console.log(JSON.stringify({passed:checks.length,errors,mockApi:true}))
  } finally { await browser.close() }
})().catch(e=>{console.error(e);process.exitCode=1})
