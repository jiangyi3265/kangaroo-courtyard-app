import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import * as vue from 'vue'
import { parse, babelParse } from '@vue/compiler-sfc'

function page(name, api = {}) {
  const source = readFileSync(new URL('../pages/community/' + name + '.vue', import.meta.url), 'utf8')
  const code = parse(source).descriptor.scriptSetup.content
  const nodes = babelParse(code, {sourceType:'module'}).program.body
  const env = {}, hooks = {}
  for (const node of nodes.filter(node=>node.type === 'ImportDeclaration'))
    for (const item of node.specifiers) env[item.local.name] = () => {}
  Object.assign(env, vue, {
    experience: vue.reactive({account:{id:7},cities:['大理']}),
    uni: { getStorageSync:()=>'' }, communityEnabled:vue.ref(true),
    useScreen:(_, options)=>{hooks.load=options.onLoad; return vue.ref(1)},
    onShow:fn=>{hooks.show=fn}, onHide:fn=>{hooks.hide=fn}, onUnload:fn=>{hooks.unload=fn},
    currentCity:()=>'大理', ...api
  })
  const context=vm.createContext(env)
  const run=js=>vm.runInContext(js,context)
  run(nodes.filter(n=>n.type!=='ImportDeclaration').map(n=>code.slice(n.start,n.end)).join('\n'))
  return {run,hooks,source}
}
const settle=()=>new Promise(done=>setImmediate(done))
function delayed(){
  let resolve, reject
  const promise=new Promise((yes,no)=>{resolve=yes;reject=no})
  return {resolve,reject,promise}
}
const result=title=>({data:{groups:[{date:'周末',items:[{activityId:1,title}]}],subscribed:false}})

test('活动列表快速换分类，迟到的旧列表不覆盖当前分类',async()=>{
  const old=delayed()
  const h=page('activity',{apiActivities:({source})=>source==='yard'?old.promise:Promise.resolve(result('商家露营'))})
  h.run("setTab('小院活动');setTab('商家活动')")
  await settle()
  old.resolve(result('小院读书')); await settle()
  assert.equal(h.run('activityGroups.value[0].items[0].title'),'商家露营')
})
test('切换城市时旧城市的订阅回执不会改动新城市的开关',async()=>{
  const save=delayed()
  const h=page('activity',{apiActivities:async()=>result('本地活动'),gated:fn=>fn(),apiActivitySubscribe:()=>save.promise})
  await h.run('loadList()')
  const first=h.run('toggleRemind()')
  await h.run("city.value='丽江'; loadList()")
  save.resolve({data:{subscribed:true}}); await first
  assert.equal(h.run('remind.value'),false)
})
test('我的活动切到收藏失败时不显示上一页签的报名，重试恢复收藏',async()=>{
  const slow=delayed(); let attempts=0
  const h=page('activity-mine',{apiMyActivities:async()=>({data:[{signupId:12,title:'已报读书会'}]}),
    get:()=>++attempts===1?slow.promise:Promise.resolve({data:[{activityId:2,title:'收藏的徒步'}]})})
  await h.run('loadMine()')
  h.run("setTab('收藏')"); await settle()
  assert.equal(h.run('rows.value.length'),0)
  slow.reject(Error('网络中断')); await settle()
  assert.equal(h.run('mineError.value'),'网络中断')
  await h.run('loadMine()')
  assert.equal(h.run('rows.value[0].title'),'收藏的徒步')
  assert.equal(h.run('mineError.value'),'')
})
test('去凭证页取消活动后返回我的活动，列表显示取消后的状态',async()=>{
  let status='已报名'
  const h=page('activity-mine',{apiMyActivities:async()=>({data:[{signupId:19,state:status}]})})
  const init=h.hooks.load({}); h.hooks.show(); await init; await settle()
  assert.equal(h.run('rows.value[0].state'),'已报名')
  h.hooks.hide?.(); status='已取消'; h.hooks.show(); await settle()
  assert.equal(h.run('rows.value[0].state'),'已取消')
})

test('待支付凭证可主动取消，重复点取消只发一次，保留去支付入口', async () => {
  let state='pending_payment', cancels=0, payments=0
  const modal=delayed()
  const h=page('activity',{
    groupChatEnabled:vue.ref(true),confirm:()=>modal.promise,prompt:async()=>'行程调整',
    apiSignup:async()=>({data:{signupId:19,activityId:1,title:'捡贝壳',status:state,canCancel:state==='pending_payment',payNo:'A19'}}),
    apiSignupCancel:async()=>{cancels++;state='cancelled';return {msg:'已取消报名'}},
    payFlow:async()=>{payments++}
  })
  await h.run('openTicket(19)')
  const titles=h.run('successActions.value.map(a=>a.title)')
  assert.ok(titles.includes('去支付'))
  assert.ok(titles.includes('取消报名'))
  assert.ok(!titles.includes('加入活动群'))
  const first=h.run("successActions.value.find(a=>a.title==='取消报名').click()")
  const duplicate=h.run("successActions.value.find(a=>a.title==='取消报名').click()")
  await h.run("successActions.value.find(a=>a.title==='去支付').click()")
  modal.resolve(true); await Promise.all([first,duplicate])
  assert.equal(cancels,1)
  assert.equal(payments,0)
  assert.equal(h.run('ticket.value.status'),'cancelled')
})

test('从其他页面返回报名凭证会显示已递补的结果，只有确认报名能进群', async () => {
  let state='waitlist',reads=0
  const h=page('activity',{
    groupChatEnabled:vue.ref(true),
    apiSignup:async()=>{reads++;return {data:{signupId:20,activityId:2,status:state,convId:state==='confirmed'?9:null}}}
  })
  await h.run('openTicket(20)')
  assert.ok(!h.run("successActions.value.some(a=>a.title==='加入活动群')"))
  h.hooks.hide?.();state='confirmed';await h.hooks.show();await settle()
  assert.equal(reads,2)
  assert.equal(h.run('ticketTitle.value'),'报名成功')
  assert.ok(h.run("successActions.value.some(a=>a.title==='加入活动群')"))
})

test('已有免费活动权益时，满员活动仍按普通候补报名，连点只问一次', async () => {
  let full=false, walletReads=0, asks=0
  const calls=[],modal=delayed()
  const h=page('activity',{
    apiActivity:async()=>({data:{activityId:33,title:'海边徒步',phase:'open',memberFree:true,full}}),
    apiMemberWallet:async()=>{walletReads++;return {data:{rows:[{status:'available',benefitCode:'activity',walletId:45}]}}},
    confirm:()=>{asks++;return modal.promise},gated:fn=>fn(),
    apiActivitySignup:async(...args)=>{calls.push(args);return {data:{signupId:34}}},
    apiSignup:async()=>({data:{signupId:34,status:'waitlist'}})
  })
  await h.run('openDetail(33)')
  assert.equal(h.run('memberActivityVouchers.value.length'),1)
  h.run('memberActivityId.value=45')
  full=true; await h.run('openDetail(33)')
  assert.equal(walletReads,1)
  assert.equal(h.run('memberActivityVouchers.value.length'),0)
  assert.equal(h.run('memberActivityId.value'),null)
  const one=h.run('signup()'),two=h.run('signup()');assert.equal(asks,1)
  modal.resolve(true); await Promise.all([one,two])
  assert.equal(calls.length,1);assert.equal(calls[0][2],null)
  assert.equal(h.run('ticket.value.status'),'waitlist')
})
