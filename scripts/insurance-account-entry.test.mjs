import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import * as vue from 'vue'
import { parse, babelParse } from '@vue/compiler-sfc'

const read = path => readFileSync(new URL(path, import.meta.url),'utf8')
const finance = await import('data:text/javascript;base64,' + Buffer.from(read('../pages/staff/insurance-finance.js')).toString('base64'))
const script = parse(read('../pages/staff/insurance-account.vue')).descriptor.scriptSetup.content
const pageCode = babelParse(script,{sourceType:'module'}).program.body.filter(n=>n.type!=='ImportDeclaration').map(n=>script.slice(n.start,n.end)).join('\n')

function page(query, failFirst = false, overrides = {}) {
  const scope = vue.ref('store-1')
  const hooks = {}, details = []
  const context = {
    ...finance,...vue,experience:{account:{id:1}},currentStaffStore:vue.ref(null),
    getToken:()=>'local',getMessageScopeKey:()=>scope.value,getSessionRevision:()=>0,
    ensureSession:async()=>{},todayCn:()=>'2026-11-21',confirm:async()=>true,payFlow:async()=>{},
    shiftDate:(v,n)=>v ? new Date(Date.parse(v+'T00:00:00Z')+n*86400000).toISOString().slice(0,10) : '',
    insuranceApi:{
      context:async()=>{if(failFirst){failFirst=false;throw Error('读取失败')}return {data:{canApply:true,plans:[{planId:5}]}}},
      rows:async()=>({data:{rows:[]}}),account:async()=>({data:{balanceFen:0,entries:[]}}),
      detail:async id=>{details.push(String(id));return {data:{applyId:Number(id)}}}
    },
    onLoad:fn=>hooks.load=fn,onHide:fn=>hooks.hide=fn,onShow:fn=>hooks.show=fn,onUnload:fn=>hooks.unload=fn,
    ...overrides
  }
  vm.createContext(context);vm.runInContext(pageCode,context);hooks.load(query)
  return {hooks,details,setScope:s=>{scope.value=s},run:js=>vm.runInContext(js,context)}
}
test('retry after the initial insurance read fails opens the policy linked in the notification', async()=>{
  const h=page({applyId:'80'},true)
  await h.hooks.show()
  assert.equal(h.run('state.error'),'读取失败')
  await h.run('reload()')
  assert.equal(h.run('selected.value?.applyId'),80)
})
test('retry preserves the applicant and plan selected on the preceding page',async()=>{
  const h=page({appId:'17',planId:'5',startDate:'2026-11-28'},true)
  await h.hooks.show(); await h.run('reload()')
  assert.equal(h.run('section.value'),'create')
  assert.deepEqual({...h.run('state.form')},{appId:'17',planId:'5',startDate:'2026-11-28',method:'wechat'})
})
test('foreground restores the currently opened policy once and respects returning to the list',async()=>{
  const h=page({applyId:'80'})
  await h.hooks.show(); await h.run('openEntry(81)')
  h.hooks.hide(); await h.hooks.show()
  assert.equal(h.run('selected.value?.applyId'),81)
  assert.deepEqual(h.details,['80','81','81'])
  h.run("controller.choose('')");h.hooks.hide();await h.hooks.show()
  assert.equal(h.run('state.selectedId'),'')
})
test('a different store never reopens the previous store’s linked policy',async()=>{
  const h=page({applyId:'80'})
  await h.hooks.show();h.hooks.hide();h.setScope('store-2');await h.hooks.show()
  assert.deepEqual(h.details,['80'])
  assert.equal(h.run('state.selectedId'),'')
})
test('renewal opens on the first eligible day and the allowed window includes day 90',async()=>{
  const h=page({})
  await h.hooks.show()
  h.run("state.context.candidates=[{appId:7,lastEnd:'2026-11-24'}]; pickCandidate({detail:{value:0}})")
  assert.equal(h.run('state.form.startDate'),'2026-11-25')
  h.run("calendar.value='start'")
  assert.equal(h.run('calendarMin()'),'2026-11-25')
  assert.equal(h.run('calendarMax()'),'2027-02-19')
  h.run("state.form.startDate='2027-02-20'")
  await h.run('submitCreate()')
  assert.match(h.run('state.error'),/起保日期/)
})
test('empty policy dates open in the current month and the end date opens at the chosen start',async()=>{
  const h=page({})
  await h.hooks.show();h.run("calendar.value='policyStart'")
  assert.equal(h.run('calendarValue.value'),'2026-11-21')
  assert.equal(h.run('state.policyForm.startDate'),'')
  h.run("setDate('2026-12-03');calendar.value='policyEnd'")
  assert.equal(h.run('calendarMin()'),'2026-12-03')
  assert.equal(h.run('calendarValue.value'),'2026-12-03')
  h.run("calendar.value='departure'")
  assert.equal(h.run('calendarValue.value'),'2026-11-21')
})

function refundPage(roleCode, query = {tab:'refunds'}, extraGrants = []) {
  const other = {storeId:2,roleCode,active:true}, target = {storeId:9,roleCode,active:true}
  const currentStaffStore = vue.ref(other)
  const experience = vue.reactive({mode:'staff',account:{id:1,staffGrants:[other,target,...extraGrants]}})
  const calls = [], bodies = []
  let stage = 'verify'
  let verifiedDate = null
  const confirmations = []
  function record() {
    return {applyId:80,storeId:9,insuredName:'小院同学',isPayer:false,amountFen:9000,refundedFen:0,
      startDate:'2026-11-18',endDate:'2026-12-17',policyNo:'TEST',refund:{refundId:6,status:'pending',
        amountFen:verifiedDate==='2026-11-27'?6000:9000,departureDate:'2026-11-17',verifiedDepartureDate:verifiedDate},
      canVerifyDeparture:roleCode==='city_lead' || (stage==='verify' && roleCode==='manager' && currentStaffStore.value.storeId===9),
      canVerifyAndPayDeparture:roleCode==='city_lead',
      canPayDeparture:roleCode==='city_lead' && stage==='pay'}
  }
  const h = page(query,false,{
    experience,currentStaffStore,getMessageScopeKey:()=>currentStaffStore.value.storeId,
    confirm:async(title,text)=>{confirmations.push([title,text]);return true},
    setStaffStore:g=>{calls.push(['switch',g.storeId]);currentStaffStore.value=g},
    insuranceApi:{
      refundTasks:async()=>{calls.push(['queue',currentStaffStore.value.storeId]);return {data:{rows:stage==='done'||(roleCode==='manager' && stage==='pay')?[]:[record()]}}},
      detail:async()=>({data:record()}),
      departure:async(id,rid,step,body)=>{
        calls.push([step,id,rid,body.departureDate,...(step==='pay'||step==='verifyPay'?[body.amountFen]:[])])
        bodies.push(body)
        if(step==='verify') verifiedDate=body.departureDate
        stage=step==='verify'?'pay':'done'
      }
    }
  })
  return {...h,calls,bodies,confirmations}
}

test('manager workbench finds an earlier request across managed stores and verifies under its actual store',async()=>{
  const h=refundPage('manager')
  await h.hooks.show()
  assert.deepEqual(h.calls,[['queue',2]])
  await h.run('openRefundRow(state.rows[0])')
  assert.deepEqual(h.calls,[['queue',2],['switch',9],['queue',9]])
  assert.equal(h.run('selected.value.canVerifyDeparture'),true)
  assert.equal(h.run('state.refundForm.departureDate'),'2026-11-17')
  await h.run("controller.departure('verify')")
  assert.deepEqual(h.calls.at(-2),['verify',80,6,'2026-11-17'])
  assert.equal(h.run('state.rows.length'),0)
})

test('manager notification selects the granted store before loading, and a shared recruiting grant cannot select a refund scope',async()=>{
  const h=refundPage('manager',{tab:'refunds',applyId:'80',storeId:'9',refundRole:'manager'},[{storeId:7,roleCode:'manager',active:true,sharedRecruitment:true}])
  await h.hooks.show()
  assert.equal(h.run('selected.value.canVerifyDeparture'),true)
  assert.equal(h.run("selectTaskGrant(7,'manager')"),false)
  assert.deepEqual(h.calls,[['switch',9],['queue',9]])
})

test('city lead verifies the corrected date and confirms the server refund amount in a separate action',async()=>{
  const h=refundPage('city_lead')
  await h.hooks.show()
  await h.run('openRefundRow(state.rows[0])')
  assert.equal(h.run('selected.value.canVerifyDeparture'),true)
  assert.equal(h.run('selected.value.canPayDeparture'),false)
  await h.run("controller.departure('pay')")
  assert.deepEqual(h.calls,[['queue',2]])
  h.run("calendar.value='departure';setDate('2026-11-27')")
  assert.equal(h.run('quoteText.value'),'¥60.00')
  await h.run("controller.departure('verify')")
  assert.deepEqual(h.calls,[['queue',2],['verify',80,6,'2026-11-27'],['queue',2]])
  assert.equal(h.run('selected.value.canVerifyDeparture'),true)
  assert.equal(h.run('selected.value.canPayDeparture'),true)
  await h.run("controller.departure('pay')")
  assert.deepEqual(h.calls.at(-2),['pay',80,6,'2026-11-27',6000])
  assert.deepEqual(h.confirmations,[['确认核实结果','离店日期 2026-11-27，可退 ¥60.00。'],['确认办理退款','离店日期 2026-11-27，可退 ¥60.00。']])
  assert.equal(h.run('state.rows.length'),0)
})

test('city lead confirms the edited date and zero quote before a direct decision',async()=>{
  const h=refundPage('city_lead')
  await h.hooks.show()
  await h.run('openRefundRow(state.rows[0])')
  h.run("calendar.value='departure';setDate('2026-12-17')")
  await h.run("controller.departure('verifyPay')")
  assert.deepEqual(h.calls.at(-2),['verifyPay',80,6,'2026-12-17',0])
  assert.deepEqual(h.confirmations,[['确认零元结案','离店日期 2026-12-17，可退 ¥0.00。确认后直接结案，不退款。']])
})

test('city lead saving a verification is marked save-only, and only one refund button stays when the date matches',async()=>{
  const h=refundPage('city_lead')
  await h.hooks.show()
  await h.run('openRefundRow(state.rows[0])')
  h.run("calendar.value='departure';setDate('2026-11-27')")
  await h.run("controller.departure('verify')")
  assert.equal(h.bodies.at(-1).saveOnly,true)
  assert.equal(h.run('selected.value.canPayDeparture'),true)
  h.run("calendar.value='departure';setDate('2026-11-27')")
  assert.equal(h.run('payingSaved.value'),true)
  h.run("calendar.value='departure';setDate('2026-12-17')")
  assert.equal(h.run('payingSaved.value'),false)
  assert.equal(h.run('quoteFen.value'),0)
})

function applicationPage(data, overrides = {}) {
  const calls = []
  const h = page({applicationId:'17',storeId:'9'}, false, {
    insuranceApi: {
      application: async id => { calls.push(id); return {data} },
      ...overrides
    }
  })
  return {...h,calls}
}

test('completed application opens its pending refund before older policies, independently of store plan and roster permissions',async()=>{
  const record = {appId:17,applyId:80,storeId:9,amountFen:9000,canVerifyDeparture:true,
    refund:{status:'pending',refundId:6,departureDate:'2026-11-17'}}
  const h = applicationPage({appId:17,storeId:9,rows:[record,{...record,applyId:79,refund:null}]})
  await h.hooks.show()
  assert.deepEqual(h.calls,['17'])
  assert.equal(h.run('state.error'),'')
  assert.equal(h.run('selected.value.applyId'),80)
  assert.equal(h.run('state.refundForm.departureDate'),'2026-11-17')
  assert.equal(h.run('selected.value.canVerifyDeparture'),true)
  h.hooks.hide(); await h.hooks.show()
  assert.equal(h.run('selected.value.applyId'),80)
})

test('application without a policy only enables enrollment for its eligible candidate',async()=>{
  const data = {appId:17,storeId:9,canApply:true,rows:[],plans:[{planId:5}],
    candidates:[{appId:17,name:'本报名',arrivalDate:'2026-11-24'}, {appId:99,name:'另一位'}]}
  const h=applicationPage(data)
  await h.hooks.show()
  assert.equal(h.run('section.value'),'create')
  assert.deepEqual({...h.run('state.form')},{appId:'17',planId:'5',startDate:'2026-11-24',method:'wechat'})
  assert.equal(h.run('candidates.value.length'),1)
  h.hooks.hide(); await h.hooks.show()
  assert.equal(h.run('state.form.appId'),'17')
  data.canApply=false
  await h.run('reload()')
  assert.equal(h.run('section.value'),'records')
  assert.equal(h.run('visibleTabs.value.length'),1)
  assert.equal(h.run('state.rows.length'),0)
})

test('application lookup refuses a mismatched policy and never substitutes the store-wide list',async()=>{
  const h=applicationPage({appId:17,storeId:9,rows:[{applyId:80,appId:18}]})
  await h.hooks.show()
  assert.match(h.run('state.error'),/重新读取/)
  assert.equal(h.run('state.selectedId'),'')
  assert.deepEqual(h.calls,['17'])
})

for (const leadScope of [{storeId:2},{storeId:null,cityId:7}]) test('shared recruitment switches to the authorized lead identity '+JSON.stringify(leadScope),async()=>{
  const shared={active:true,storeId:9,city:'平潭',roleCode:'manager',sharedRecruitment:true}
  const lead={active:true,...leadScope,city:'平潭',roleCode:'city_lead'}
  const currentStaffStore=vue.ref(shared)
  const experience=vue.reactive({mode:'staff',account:{id:1,staffGrants:[shared,lead]}})
  const seen=[]
  const h=page({applicationId:'17',storeId:'9'},false,{experience,currentStaffStore,
    getMessageScopeKey:()=>currentStaffStore.value.roleCode,setStaffStore:g=>{currentStaffStore.value=g},
    insuranceApi:{application:async id=>{
      seen.push([id,currentStaffStore.value.roleCode])
      if (currentStaffStore.value.roleCode!=='city_lead') throw Object.assign(Error('仅有协助招募权限'),{code:403})
      return {data:{appId:17,storeId:9,rows:[{applyId:80,appId:17,canVerifyDeparture:true}]}}
    }}
  })
  await h.hooks.show()
  assert.equal(h.run('selected.value'),undefined)
  assert.equal(h.run('alternativeGrant.value?.roleCode'),'city_lead')
  assert.equal(h.run('alternativeGrant.value.storeId'),leadScope.storeId)
  await h.run('switchApplicationGrant()')
  assert.equal(h.run('selected.value.canVerifyDeparture'),true)
  assert.deepEqual(seen,[['17','manager'],['17','city_lead']])
  experience.account.staffGrants=[shared,{...lead,city:'厦门'}];currentStaffStore.value=shared
  await h.run('reload()')
  assert.equal(h.run('selected.value'),undefined)
  assert.equal(h.run('alternativeGrant.value'),undefined)
})

for (const stillVisible of [true, false]) test('switching to the refund role retains only the chosen policy; still visible = '+stillVisible, async()=>{
  const manager={active:true,storeId:9,city:'平潭',roleCode:'manager'}
  const lead={active:true,storeId:null,cityId:7,city:'平潭',roleCode:'city_lead'}
  const currentStaffStore=vue.ref(manager)
  const experience=vue.reactive({mode:'staff',account:{id:1,staffGrants:[manager,lead]}})
  const h=page({applicationId:'17',storeId:'9'},false,{experience,currentStaffStore,
    getMessageScopeKey:()=>currentStaffStore.value.roleCode,setStaffStore:g=>{currentStaffStore.value=g},
    insuranceApi:{application:async()=>{
      const city=currentStaffStore.value.roleCode==='city_lead'
      const ids=city && !stillVisible ? [81] : [81,80]
      return {data:{appId:17,storeId:9,rows:ids.map(id=>({applyId:id,appId:17,storeId:9,canPayDeparture:city,
        refund:{refundId:id,status:'pending',departureDate:'2026-11-25',verifiedDepartureDate:'2026-11-25'}}))}}
    }}
  })
  await h.hooks.show()
  h.run("controller.choose(80)")
  assert.equal(h.run('alternativeGrant.value?.roleCode'),'city_lead')
  await h.run('switchApplicationGrant()')
  assert.equal(h.run('selected.value?.applyId'),stillVisible ? 80 : undefined)
  await h.run('reload()')
  assert.equal(h.run('selected.value?.applyId'),stillVisible ? 80 : undefined)
})

test('the insured person or payer is never offered another role to handle their own refund',async()=>{
  const manager={active:true,storeId:9,city:'平潭',roleCode:'manager'}
  const lead={active:true,storeId:null,cityId:7,city:'平潭',roleCode:'city_lead'}
  const currentStaffStore=vue.ref(manager)
  const experience=vue.reactive({mode:'staff',account:{id:1,staffGrants:[manager,lead]}})
  let recused=false
  const h=page({applicationId:'17',storeId:'9'},false,{experience,currentStaffStore,
    getMessageScopeKey:()=>currentStaffStore.value.roleCode,setStaffStore:g=>{currentStaffStore.value=g},
    insuranceApi:{application:async()=>({data:{appId:17,storeId:9,rows:[{applyId:80,appId:17,storeId:9,selfRecused:recused,
      refund:{refundId:6,status:'pending',departureDate:'2026-11-25'}}]}})}
  })
  await h.hooks.show()
  h.run("controller.choose(80)")
  assert.equal(h.run('alternativeGrant.value?.roleCode'),'city_lead')
  recused=true
  await h.run('reload()')
  h.run("controller.choose(80)")
  assert.equal(h.run('alternativeGrant.value'),null)
})

test('a lost refund payment response checks status without repeating the payment or showing a stale payment action',async()=>{
  let paid=false, writes=0
  const h=applicationPage({},{
    application:async()=>({data:{appId:17,storeId:9,rows:[{appId:17,applyId:80,storeId:9,canPayDeparture:!paid,
      refund:{refundId:6,status:paid?'processing':'pending',verifiedDepartureDate:'2026-11-25',amountFen:9000}}]}}),
    departure:async()=>{paid=true;writes++;throw Object.assign(Error('网络连接失败'),{code:-1})}
  })
  await h.hooks.show()
  await h.run("controller.departure('pay')")
  assert.equal(h.run('selected.value?.canPayDeparture'),false)
  assert.equal(h.run('selected.value.refund.status'),'processing')
  assert.equal(writes,1)
})
