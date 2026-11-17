// UI integration uses actual city-service output from the isolated database test.
import assert from 'node:assert/strict'
import {readFile,mkdir,writeFile} from 'node:fs/promises'
import {chromium} from 'playwright'
const out='../artifacts/city-coverage-20261002'
const directory=JSON.parse(await readFile(out+'/service-directory.json','utf8'))
await mkdir(out+'/browser',{recursive:true})
const browser=await chromium.launch({headless:true})
const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,permissions:['geolocation'],geolocation:{latitude:25.498,longitude:119.790,accuracy:30}})
const page=await context.newPage(), errors=[],checks=[],locations=[]
let result={found:true,name:'平潭',label:'平潭县 · 福建省',adcode:'350128',source:'administrative_boundary'}
page.on('pageerror',e=>errors.push(e.message))
page.on('console',m=>{if(m.type()==='error')errors.push(m.text())})
await page.addInitScript(()=>localStorage.setItem('kangaroo:app-token',JSON.stringify({type:'string',data:'city-test'})))
await page.route('**/app/**',async route=>{
  const url=new URL(route.request().url()), r={code:200,data:{}}
  if(url.pathname==='/app/auth/account')r.data={id:'9001',nickname:'城市测试',staffGrants:[]}
  else if(url.pathname==='/app/cities')r.data=directory
  else if(url.pathname==='/app/cities/locate'){locations.push(Object.fromEntries(url.searchParams));r.data=result}
  else if(url.pathname==='/app/cities/overview')r.data={city:url.searchParams.get('city'),siblings:[],jobs:0,stays:0,activities:0}
  await route.fulfill({json:r})
})
const open=async()=>{await page.goto('http://127.0.0.1:5373/?city-test='+Date.now()+'#/pages/home/city?s=2');await page.waitForLoadState('networkidle')}
const search=()=>page.locator('.city-search input')
try{
  await open()
  await page.getByText('平潭县 · 福建省',{exact:true}).waitFor()
  assert.equal(locations.at(-1).coordinateType,'wgs84')
  assert.equal(locations.at(-1).accuracy,'30')
  assert.ok(await page.locator('.alpha-group__city').count()<=100)
  checks.push('Pingtan location shown; device coordinate type and accuracy sent; list initially bounded')
  for(const query of ['平潭','pingtan','PT','平潭岛']){
    await search().fill(query)
    await page.locator('.alpha-group__city').filter({hasText:'平潭'}).first().waitFor()
    assert.ok((await page.locator('.alpha-group__city').allTextContents()).some(t=>t.includes('平潭')&&t.includes('福建省')))
  }
  await page.screenshot({path:out+'/browser/pingtan-search-390.png'})
  checks.push('Chinese, island alias, full pinyin and initials search show Pingtan with region')
  await search().fill('福建')
  await page.locator('.alpha-group__city').filter({hasText:'泉州'}).first().waitFor()
  const fujian=await page.locator('.alpha-group__city').allTextContents()
  for(const city of ['平潭','福州','泉州','莆田','漳州','宁德','龙岩','三明','南平'])assert.ok(fujian.some(t=>t.includes(city)),city)
  assert.equal(fujian.some(t=>t.startsWith('厦门')),false)
  checks.push('province search lists Fujian cities/counties and respects admin disabled Xiamen')
  await search().fill('鼓楼区')
  await page.locator('.alpha-group__city').filter({hasText:'鼓楼区'}).first().waitFor()
  assert.ok(await page.locator('.alpha-group__city').count()>1)
  assert.ok((await page.locator('.alpha-group__city').allTextContents()).some(t=>t.includes('福州市')))
  await search().fill('不存在的城市xyz')
  await page.getByText('没有找到该城市或区县，试试全称或拼音',{exact:true}).waitFor()
  checks.push('same-name districts disambiguated and no-result message available')
  await search().fill('')
  await page.locator('.alphabet').getByText('P',{exact:true}).waitFor()
  await page.locator('.alphabet').getByText('P',{exact:true}).click()
  await page.waitForTimeout(350)
  assert.ok((await page.locator('#city-group-P').boundingBox()).y<160)
  await search().fill('平潭')
  await page.locator('.alpha-group__city').filter({hasText:'平潭'}).click()
  await page.locator('.city-name').getByText('平潭',{exact:true}).waitFor()
  checks.push('P index scrolls to matching cities and selecting Pingtan updates current city')
  result={found:true,name:'泉州',label:'泉州市 · 福建省',distanceKm:132}
  await open()
  await page.getByText('暂无法确认，请手动选择',{exact:true}).waitFor()
  assert.equal(await page.locator('.current-city').getByText('泉州市 · 福建省',{exact:true}).count(),0)
  result={found:true,name:'平潭',label:'平潭县 · 福建省',source:'administrative_boundary'}
  await page.getByText('重试定位',{exact:true}).click()
  await page.getByText('平潭县 · 福建省',{exact:true}).waitFor()
  checks.push('legacy nearest-city result rejected and retry succeeds')
  await context.clearPermissions()
  await context.grantPermissions([])
  await page.evaluate(()=>{navigator.geolocation.getCurrentPosition=(_ok,fail)=>fail({code:1,message:'denied'})})
  await page.locator('.current-city .k-icon').last().click()
  await page.getByText('暂无法确认，请手动选择',{exact:true}).waitFor()
  await search().fill('平潭')
  await page.setViewportSize({width:320,height:740})
  await page.screenshot({path:out+'/browser/manual-pingtan-320.png'})
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false)
  assert.equal(await page.locator('.current-city').getByText('平潭县 · 福建省',{exact:true}).count(),0)
  checks.push('permission failure clears previous location; manual search usable at 320px')
  assert.deepEqual(errors,[])
} finally {
  await writeFile(out+'/browser/result.json',JSON.stringify({checks,errors},null,2))
  await browser.close()
}
console.log(JSON.stringify({checks,errors},null,2))
