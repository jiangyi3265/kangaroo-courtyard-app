// Real H5 page interaction with explicit API fixtures; no production writes.
import assert from 'node:assert/strict'
import { mkdir, writeFile } from 'node:fs/promises'
import { chromium } from 'playwright'
const base = 'http://127.0.0.1:5373/', out = process.env.COMPENSATION_OUT || '../artifacts/independent-compensation-20261002/browser'
await mkdir(out, { recursive: true })
const browser = await chromium.launch({ headless: true })
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true })
const checks = [], errors = [], calls = [], saved = []
let displayed = null, visit = 0
const periods = [['hourly','时薪','元/小时','25.5'], ['daily','日薪','元/天','150'], ['weekly','周薪','元/周','1000'], ['monthly','月薪','元/月','5000']]
const units = Object.fromEntries(periods.map(o => [o[0], o[2]]))
const bonus = '每月绩效达标奖 500 元，随工资发放', commission = '按个人销售额的 5% 提成，每月结算'
page.on('pageerror', e => errors.push(e.message))
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()) })
await page.addInitScript(() => localStorage.setItem('kangaroo:app-token', JSON.stringify({ type: 'string', data: 'salary-test' })))
await page.route('**/app/**', async route => {
  const req=route.request(), path=new URL(req.url()).pathname, input=req.method()==='POST' ? req.postDataJSON() : null
  calls.push({ path, input })
  const r={code:200,data:{},rows:[],total:0}
  if(path==='/app/auth/account') r.data={ id:'9001', nickname:'测试员工', staffGrants:[{id:1,storeId:102,storeName:'平潭袋鼠小院',roleCode:'manager',roleName:'主理人',active:true}] }
  else if(path==='/app/staff/jobs' && !input) r.data={canEdit:true,storeCert:false,rows:[],metrics:[]}
  else if(path==='/app/staff/jobs/describe') r.data={ title:'小院伙伴', intro:`${input.pay==='salary' ? input.salary+' '+units[input.salaryType] : input.pay==='board'?'提供食宿':'无食宿及底薪'}${input.bonusDesc ? '；奖金：'+input.bonusDesc : ''}${input.commissionDesc ? '；提成：'+input.commissionDesc : ''}`,work:'门店接待',hope:'认真负责',basis:[],variant:0 }
  else if(path==='/app/staff/jobs' && input) {
    saved.push(input)
    const paid=input.pay==='salary'
    displayed={ jobId:999,storeId:102,title:input.title,jobType:input.jobType,city:'平潭',salaryType:input.salaryType,salaryMin:paid?input.salary:null,salaryMax:paid?input.salary:null,salaryUnit:paid?units[input.salaryType]:'',salaryText:paid?`${input.salary} ${units[input.salaryType]}`:'',boardType:input.pay==='board'?'all':'none',boardText:input.pay==='board'?'提供食宿':'不包食宿',bonusDesc:input.bonusDesc,commissionDesc:input.commissionDesc,tags:[],benefits:[],status:'published',store:{storeName:'平潭袋鼠小院'},startDate:'2026-10-09',shiftDesc:'弹性时间' }
    displayed.compensationText=[displayed.salaryText,input.bonusDesc?'奖金':'',input.commissionDesc?'提成':''].filter(Boolean).join(' + ')
    r.data={jobId:999,status:'draft'}
  } else if(path==='/app/job/list') { r.rows=[displayed];r.total=1;r.hasMore=false }
  else if(path==='/app/job/999') r.data=displayed
  await route.fulfill({json:r})
})
const button = label => page.locator('uni-button').filter({has:page.getByText(label,{exact:true})})
const open = async route => { await page.goto(base+'?compensation-test='+(++visit)+'#'+route);await page.waitForLoadState('networkidle') }
const extra = label => page.locator('.salary-extras .salary-choice').filter({hasText:label})
const baseAmount = () => page.locator('.salary-amount input')
const rule = key => page.locator('#job-'+key+'-rule textarea')
async function start(width=390) {
  await page.setViewportSize({width,height:844});await open('/pages/staff/jobs')
  await button('发布岗位').click();await page.locator('.seg.four').getByText('全职',{exact:true}).click()
  await page.locator('.seg.three').getByText('提供底薪',{exact:true}).click()
  await page.locator('.salary-editor').waitFor()
}
async function screenshot(name) {
  await page.waitForTimeout(300)
  await page.screenshot({path:`${out}/${name}.png`,fullPage:true})
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,name)
}
async function submit() {
  await button('下一步：生成描述').click();await page.locator('.ai-field.intro').waitFor()
  await button('下一步：人工确认').click();await page.locator('.uni-modal__btn_primary').click()
  await page.getByText('分享追踪',{exact:true}).waitFor()
}
try {
  for(const [i,[type,label,unit,amount]] of periods.entries()) {
    const wantBonus=i===1||i===3, wantCommission=i===2||i===3
    await start(i===3?320:390)
    await page.locator('.salary-periods .salary-choice').filter({hasText:label}).click()
    assert.equal(await page.locator('.salary-periods .selected').count(),1)
    await baseAmount().fill(amount)
    if(wantBonus) {await extra('奖金').click();await rule('bonus').fill(bonus)}
    if(wantCommission) {await extra('提成').click();await rule('commission').fill(commission)}
    const expected=`${amount} ${unit}`+(wantBonus?' + 奖金':'')+(wantCommission?' + 提成':'')
    assert.equal(await page.locator('.salary-preview').innerText(),expected)
    if(i===3) {await page.locator('.salary-editor').scrollIntoViewIfNeeded();await screenshot('salary-combination-320')}
    await submit()
    const input=saved.at(-1)
    assert.equal(input.salaryType,type);assert.equal(input.salary,Number(amount))
    assert.equal(input.bonusDesc,wantBonus?bonus:null);assert.equal(input.commissionDesc,wantCommission?commission:null)
    checks.push(`${label}: base ${wantBonus?'+ bonus ':''}${wantCommission?'+ commission':''} submitted correctly`)
    await open('/pages/jobs/list?type=fulltime')
    assert.equal(await page.locator('.price__num').first().innerText(),amount)
    assert.equal(await page.locator('.price__unit').first().innerText(),unit)
    assert.equal(await page.locator('.card .tags').getByText('奖金',{exact:true}).count(),wantBonus?1:0)
    assert.equal(await page.locator('.card .tags').getByText('提成',{exact:true}).count(),wantCommission?1:0)
    await page.locator('.card').first().click()
    await page.getByText(expected,{exact:true}).first().waitFor()
    if(wantBonus) await page.getByText(bonus,{exact:true}).waitFor()
    if(wantCommission) await page.getByText(commission,{exact:true}).waitFor()
    if(i===3) await screenshot('job-compensation-detail-320')
    await open('/pages/jobs/detail?jobId=999&s=2')
    await page.getByText('工作与时间安排',{exact:true}).waitFor()
    if(wantBonus) await page.getByText(bonus,{exact:true}).waitFor()
    if(wantCommission) await page.getByText(commission,{exact:true}).waitFor()
    checks.push(`${label}: list and both detail tabs display bonus/commission rules correctly`)
  }
  await start()
  await page.locator('.salary-periods .salary-choice').filter({hasText:'月薪'}).click();await baseAmount().fill('5000')
  await extra('奖金').click();await extra('提成').click()
  const describes=()=>calls.filter(c=>c.path==='/app/staff/jobs/describe').length
  const before=describes()
  await button('下一步：生成描述').click();await page.getByText('请填写奖金规则',{exact:true}).waitFor();assert.equal(describes(),before)
  await rule('bonus').fill(bonus);await button('下一步：生成描述').click();await page.getByText('请填写提成规则',{exact:true}).waitFor();assert.equal(describes(),before)
  await rule('commission').fill(commission);await page.locator('uni-toast').waitFor({state:'hidden'})
  await screenshot('salary-combination-390')
  await page.mouse.wheel(0, 410)
  await page.waitForTimeout(400)
  await page.screenshot({ path: `${out}/salary-editor-viewport.png`, fullPage: false })
  await extra('奖金').click();await submit()
  assert.equal(saved.at(-1).bonusDesc,null);assert.equal(saved.at(-1).commissionDesc,commission)
  checks.push('empty selected rules prevent generation; unchecking bonus removes it while preserving commission')
  await start();await baseAmount().fill('0');await button('下一步：生成描述').click()
  await page.getByText('底薪需大于 0、不超过 100000，最多两位小数',{exact:true}).waitFor()
  await baseAmount().fill('25.5');await extra('奖金').click();await rule('bonus').fill(bonus)
  await page.locator('.seg.three').getByText('提供食宿',{exact:true}).click();await submit()
  assert.equal(saved.at(-1).bonusDesc,bonus);assert.equal(saved.at(-1).commissionDesc,null);assert.equal(saved.at(-1).salaryType,'none')
  checks.push('invalid base blocked; switching to food removes base pay while preserving bonus')
  for(const [pay,label] of [['none','无食宿底薪'],['board','提供食宿']]) {
    for(const [wantBonus,wantCommission] of [[true,false],[false,true],[true,true]]) {
      await start(320)
      await page.locator('.seg.four').getByText('换工',{exact:true}).click()
      await page.locator('.seg.three').getByText(label,{exact:true}).click()
      assert.equal(await baseAmount().count(),0)
      if(wantBonus) {await extra('奖金').click();await rule('bonus').fill('服务满 30 天奖励 500 元，离店时结算')}
      if(wantCommission) {await extra('提成').click();await rule('commission').fill(commission)}
      const rewards=[wantBonus?'奖金':'',wantCommission?'提成':''].filter(Boolean).join(' + ')
      assert.equal(await page.locator('.salary-preview').innerText(),(pay==='board'?'提供食宿 + ':'')+rewards)
      if(wantBonus&&!wantCommission) {await page.locator('.salary-editor').scrollIntoViewIfNeeded();await screenshot(`volunteer-${pay}-bonus-320`)}
      await submit()
      assert.equal(saved.at(-1).salaryType,'none');assert.equal(saved.at(-1).salary,0)
      assert.equal(saved.at(-1).bonusDesc,wantBonus?'服务满 30 天奖励 500 元，离店时结算':null)
      assert.equal(saved.at(-1).commissionDesc,wantCommission?commission:null)
      await open('/pages/jobs/list?type=volunteer')
      assert.equal(await page.locator('.price__num').first().innerText(),rewards)
      await page.locator('.card').first().click()
      await page.getByText(rewards,{exact:true}).first().waitFor()
      if(wantBonus) await page.getByText('服务满 30 天奖励 500 元，离店时结算',{exact:true}).waitFor()
      if(wantCommission) await page.getByText(commission,{exact:true}).waitFor()
      checks.push(`volunteer ${pay}: ${rewards} without base salary publishes and displays correctly`)
    }
  }
  assert.deepEqual(errors,[])
  console.log(JSON.stringify({checks,errors},null,2))
} catch(e) {await page.screenshot({path:`${out}/failure.png`,fullPage:true});throw e}
finally {await writeFile(`${out}/result.json`,JSON.stringify({scope:'H5 real page with API fixtures',checks,errors,saved},null,2));await browser.close()}
