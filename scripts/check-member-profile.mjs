import assert from 'node:assert/strict'
import { mkdir, writeFile } from 'node:fs/promises'
import { chromium, expect } from 'playwright/test'

const out='../artifacts/member-profile-20261002/browser'
await mkdir(out,{recursive:true})
const browser=await chromium.launch({headless:true})
const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true})
const page=await context.newPage()
const errors=[],checks=[],calls=[]
const names=['幼崽鼠','小袋鼠','袋鼠','大袋鼠','巨袋鼠','袋鼠王'],thresholds=[0,100,300,800,2000,5000]
let failProfile=false, failPoints=false, staff=false, totalPoints=0, totalRecords=0, holdProfile=null, profileArrived=null
const records=Array.from({length:21},(_,i)=>({title:'门店任务验收 '+(i+1),time:'2026-10-02 10:00',pts:'+10'}))
function profile() {
  const level=thresholds.filter(n=>n<=totalPoints).length-1,top=level===5,next=thresholds[level+1]
  return {memberNo:1006,nickname:'黑子',phone:'192****7290',city:'平潭',points:totalPoints,hasPoints:totalRecords>0,level,levelName:names[level],pointsProgress:top?totalPoints+' 积分':totalPoints+'/'+next,pointsPercent:top?100:Math.round(totalPoints*100/next),upgradeTip:top?'已经是最高等级啦':`再获得 ${next-totalPoints} 积分升到「${names[level+1]}」`,records:records.slice(0,Math.min(totalRecords,20)),recordTotal:totalRecords,note:'积分目前由门店任务验收产生（1 小时 = 10 积分，生日当天双倍），暂时不能兑换。'}
}
await context.addInitScript(()=>localStorage.setItem('kangaroo:app-token',JSON.stringify({type:'string',data:'membership-fixture'})))
page.on('pageerror',e=>errors.push(e.message))
await page.route('**/app/**',async route=>{
  const url=new URL(route.request().url()),path=url.pathname;calls.push({path,page:url.searchParams.get('page')})
  let r={code:200,data:{},rows:[],total:0}
  if(path==='/app/auth/account') r.data={id:'1006',nickname:'黑子',phone:'192****7290',staffGrants:staff?[{storeId:102,storeName:'平潭袋鼠小院',roleName:'主理人',roleCode:'manager',active:true}]:[]}
  else if(path==='/app/me/profile') {
    if(holdProfile){profileArrived();await holdProfile;holdProfile=null}
    r=failProfile?{code:500,msg:'资料读取失败'}:{code:200,data:profile()}
  } else if(path==='/app/me/points') r=failPoints?{code:500,msg:'明细读取失败'}:{code:200,data:{records:records.slice(20),recordTotal:21}}
  else if(path==='/app/message/list') r={code:200,rows:[],unread:0}
  // 「我的」只拉未读数（10-15 起不再拉整份消息列表）
  else if(path==='/app/message/unread') r.data={unread:0}
  else if(path==='/app/member/benefits') r.data={rows:[],total:0,hasMore:false,member:profile(),cities:[]}
  await route.fulfill({json:r})
})
// 10-15 改版：会员卡里是徽章 + 等级名（.member-level）+ 可用积分（.member-points__num），点卡片进会员信息，右上角胶囊进会员权益
const card=()=>page.locator('.member-card')
const openDetail=()=>card().locator('.member-level').click()
const button=text=>page.locator('uni-button').filter({hasText:text})
const open=async()=>{await page.goto('http://127.0.0.1:5373/#/pages/profile/index');await page.waitForLoadState('networkidle')}
const shot=async name=>{
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,`${name}: no horizontal overflow`)
  await page.screenshot({path:`${out}/${name}.png`,fullPage:true})
}
try {
  let release,arrived
  holdProfile=new Promise(r=>release=r)
  const arriving=new Promise(r=>arrived=r);profileArrived=arrived
  await page.goto('http://127.0.0.1:5373/#/pages/profile/index');await arriving
  await expect(card()).toContainText('正在读取会员信息')
  await expect(card().locator('.member-points__num')).toHaveCount(0)
  release();await expect(card()).toContainText('幼崽鼠')
  await expect(card().locator('.member-points__num')).toHaveText('0')
  await expect(page.getByText('会员编号 1006',{exact:true})).toBeVisible()
  // 10-18：会员卡上的等级图标是 level-icon（品牌袋鼠贴纸 + 等级圆环），幼崽鼠是 .lv--0
  await expect(card().locator('.member-badge .lv--0')).toHaveCount(1)
  await shot('member-zero-390')
  await openDetail()
  await expect(page.locator('.k-navbar__title')).toHaveText('会员信息')
  await expect(page.locator('.levels__label.cur')).toHaveText('幼崽鼠')
  await expect(page.locator('.levels__ring .lv--off')).toHaveCount(5)
  await expect(page.getByText('还没有积分记录。完成换工换宿、门店任务或邀请朋友，得到的积分都会记在这里。',{exact:true})).toBeVisible()
  await expect(page.getByText('兑换优惠券',{exact:true})).toHaveCount(0)
  await expect(page.getByText('精选评价',{exact:true})).toHaveCount(0)
  // 2026-10-17 会员信息改版：顶部暖卡有「积分规则」胶囊，底部也有「积分规则」卡；按卡片标题找
  await expect(page.locator('.mi-rules__title')).toHaveText('积分规则')
  await page.setViewportSize({width:320,height:844});await shot('member-detail-zero-320')
  await page.locator('.k-navbar__back').click()
  await expect(card()).toContainText('幼崽鼠');await shot('member-zero-320')
  checks.push('loading has no fabricated values; zero-point member shows actual initial level, ID, zero points, progress, real rules and empty ledger; detail/back works at 320 and 390')
  totalPoints=350;totalRecords=21
  await page.reload();await expect(card()).toContainText('袋鼠');
  await card().locator('.member-cta').click();await page.waitForURL('**#/pages/profile/benefits')
  // 等权益页真的显示出来再返回（和人手操作一样）；当前等级前面有 20px 小徽章
  await expect(page.locator('.current-level__badge')).toHaveCount(1)
  await page.goBack();await expect(card()).toContainText('袋鼠')
  checks.push('member card benefits capsule opens member benefits without opening the member detail screen')
  await expect(card().locator('.member-points__num')).toHaveText('350')
  await openDetail();await expect(page.locator('.record')).toHaveCount(20)
  failPoints=true;await button('更多记录').click();await expect(page.locator('uni-toast')).toContainText('明细读取失败')
  await expect(page.locator('.record')).toHaveCount(20)
  failPoints=false;await button('更多记录').click();await expect(page.locator('.record')).toHaveCount(21)
  await expect(button('更多记录')).toHaveCount(0)
  assert.deepEqual(calls.filter(c=>c.path==='/app/me/points').map(c=>c.page),['2','2'])
  checks.push('existing points and level come from API; paginated records retry the failed page without skipping or duplicating entries')
  totalPoints=6000;staff=true
  await page.reload();await expect(card().locator('.member-points__num')).toHaveText('6000')
  await openDetail();await expect(page.locator('.points')).toHaveText('6000')
  await expect(page.locator('.levels__label.cur')).toHaveText('袋鼠王')
  await expect(page.locator('.levels__ring .lv--off')).toHaveCount(0)
  await expect(page.getByText('已经是最高等级啦',{exact:true})).toBeVisible()
  await shot('member-top-level-320')
  await page.locator('.k-navbar__back').click();await expect(card()).toContainText('袋鼠王')
  await page.setViewportSize({width:390,height:844});await shot('member-top-profile-390')
  checks.push('highest-level and staff accounts show correct membership without a nonexistent next level')
  failProfile=true;await page.reload()
  await expect(card()).toContainText('会员信息读取失败')
  await expect(card().locator('.member-points__num')).toHaveCount(0)
  await shot('member-retry-390')
  failProfile=false;await button('重新加载').click();await expect(card()).toContainText('袋鼠王')
  checks.push('profile failure does not show zero or stale member data; inline retry restores real information')
  const guest=await browser.newPage({viewport:{width:390,height:844}})
  await guest.route('**/app/**',route=>route.fulfill({json:{code:200,data:[],rows:[]}}))
  await guest.goto('http://127.0.0.1:5373/#/pages/profile/index')
  await expect(guest.getByText('欢迎登录',{exact:true})).toBeVisible()
  await expect(guest.locator('.member-card')).toHaveCount(0)
  await guest.close()
  checks.push('guest profile requires login and exposes no member data')
  assert.deepEqual(errors,[])
  console.log(JSON.stringify({checks,errors},null,2))
} catch(e){await page.screenshot({path:`${out}/failure.png`,fullPage:true});throw e}
finally {await writeFile(`${out}/result.json`,JSON.stringify({scope:'real local H5, explicit API fixtures, no production writes',checks,errors,calls},null,2));await browser.close()}
