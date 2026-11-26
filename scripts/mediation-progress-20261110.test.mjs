import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import { parse, babelParse, compileScript, compileTemplate } from '@vue/compiler-sfc'
import { ref, computed, watch } from 'vue'
import { mediationWorkEntries } from '../pages/profile/mediation-entry.js'
import { mediationRules, mediationTextCount, combinedClaims, mediationAmountRange, mediationFormErrors } from '../pages/governance/mediation-form.js'

const pageFile = new URL('../pages/governance/mediation.vue', import.meta.url)
const cardFile = new URL('../components/k-order-mediation/k-order-mediation.vue', import.meta.url)
function script(file) {
  const text = parse(fs.readFileSync(file, 'utf8')).descriptor.scriptSetup.content
  return babelParse(text, { sourceType: 'module' }).program.body.filter(n => n.type !== 'ImportDeclaration').map(n => text.slice(n.start,n.end)).join('\n')
}
function page(data = {}) {
  const routes = [], calls = [], hooks = {}
  const context = vm.createContext({ ref, computed, states: {}, juryChoices: [], mediationRules, mediationTextCount, combinedClaims, mediationAmountRange, mediationFormErrors,
    onLoad(fn) { hooks.load = fn }, onShow() {}, onHide() {}, onUnload() {}, watch() {}, getMessageScopeKey:()=> 'fixture',
    uni: { navigateTo(q) { routes.push(q.url) }, redirectTo(q) { routes.push(q.url) }, showModal(q) { calls.push({modal:q}) }, pageScrollTo() {} },
    get: async (path,q) => { calls.push({path,q}); return {data:data[path]} }, post: async (path,body) => { calls.push({path,body}); return {data:42} }
  })
  vm.runInContext(script(pageFile), context)
  return { run: c => vm.runInContext(c,context), hooks, routes, calls }
}
function card(data) {
  const routes = []
  const context = vm.createContext({ref,watch,onShow(){},defineProps:()=>({orderType:'application',orderId:7,merchant:false}),get:async()=>({data}),go:url=>routes.push(url)})
  vm.runInContext(script(cardFile),context)
  return {run:c=>vm.runInContext(c,context),routes}
}
test('订单已有进行中或关闭工单时直接打开原进度，不重新发起', async () => {
  for (const status of ['pending','closed']) {
    const h=card({eligible:false,existingCaseId:42,existingCaseStatus:status,reason:'不能再次发起'})
    await new Promise(r=>setTimeout(r,0))
    h.run('open()')
    assert.deepEqual(h.routes,['/pages/governance/mediation?id=42'])
  }
})
test('没有工单的可申请订单继续关联原订单进入申请', async () => {
  const h=card({eligible:true});await new Promise(r=>setTimeout(r,0));h.run('open()')
  assert.equal(h.routes[0],'/pages/governance/mediation?orderType=application&orderId=7')
})
test('直接访问申请链接时发现已有工单会转进度，超期也能读取', async () => {
  const h=page({orders:{rows:[],total:0},order:{eligible:false,existingCaseId:42,existingCaseStatus:'closed'}})
  await h.run("targetOrder={type:'application',id:7};loadOrders()")
  assert.equal(h.run('creating.value'),false)
  assert.equal(h.run('caseId.value'),42)
  assert.equal(h.routes[0],'/pages/governance/mediation?id=42')
})
test('申请选单排除进行中调解，但保留后台允许重发的关闭工单',async()=>{
  const h=page({orders:{rows:[{orderId:1,eligible:true,existingCaseId:1,existingCaseStatus:'pending'},{orderId:2,eligible:true,existingCaseId:2,existingCaseStatus:'closed'},{orderId:3,eligible:true}],total:3}})
  await h.run('loadOrders()');assert.equal(h.run('orders.value.length'),2);assert.equal(h.run('orders.value[0].orderId'),2)
})
test('提交成功跳到真实工单并保留查看路径提示',async()=>{
  const h=page()
  await h.run("selectedOrder.value={orderType:'application',orderId:7,volunteerApplicant:true};context.value.categories=['食宿不符'];draft.value.category='食宿不符';draft.value.narrative='真实事件经过'.repeat(10);draft.value.claims='核实住宿';draft.value.phone='13800000000';files.value=[{fileId:8}];submit()")
  assert.equal(h.routes[0],'/pages/governance/mediation?id=42&submitted=1')
  const next=page();next.hooks.load({id:'42',submitted:'1'})
  assert.match(next.run('feedback.value'),/原报名或订单/)
  assert.equal(h.calls.filter(c=>c.path==='cases').length,1)
  assert.equal(h.calls.find(c=>c.path==='cases').body.requestJury,true)
})
test('换工主理人列表/返回保持support模式，普通用户默认我的调解',()=>{
  const h=page();h.hooks.load({mode:'support',id:'42'});h.run('backToCases()')
  assert.equal(h.routes[0],'/pages/governance/mediation?mode=support')
  const user=page();user.hooks.load({});assert.equal(user.run('mode.value'),'user')
})

test('换工报名成功后可申请调解，用户首页移除独立卡片，员工保留处理入口',()=>{
  const source=fs.readFileSync(new URL('../pages/profile/index.vue',import.meta.url),'utf8')
  const staffBranch=source.slice(source.indexOf('s === 1 && staffMode'),source.indexOf('<!-- 1 我的 -->'))
  assert.match(staffBranch,/<MediationEntry \/>/)
  const userBranch=source.slice(source.indexOf('<!-- 1 我的 -->'),source.indexOf('<!-- 2 个人资料 -->'))
  assert.doesNotMatch(userBranch,/<MediationEntry|\/pages\/profile\/drafts/)
  const apply=fs.readFileSync(new URL('../pages/jobs/apply.vue',import.meta.url),'utf8')
  assert.match(apply,/<k-order-mediation v-if="saved && jobType === 'volunteer' && appId"[^>]*volunteer-dispute/)
  const growth=source.slice(source.indexOf("title: '工作与成长'"),source.indexOf("title: '内容与关注'"))
  assert.match(growth,/进入袋鼠群聊'[^}]*\/pages\/camp\/index/)
  assert.match(growth,/大众评审'[^}]*\/pages\/governance\/jury/)
})

test('商家与主理人兼任时，在用户界面也可进入授权门店的换工调解',()=>{
  const result=mediationWorkEntries([
    {active:true,roleCode:'merchant',city:'平潭',storeName:'黑店'},
    {active:true,roleCode:'manager',city:'伊犁',storeName:'启程青旅'}
  ])
  assert.equal(result.length,1)
  assert.equal(result[0].url,'/pages/governance/mediation?mode=support')
  assert.equal(result[0].scope,'伊犁 · 启程青旅')
})

test('有效主理人与城市负责人授权分别显示，不凭本地身份扩大范围',()=>{
  const result=mediationWorkEntries([
    {active:true,roleCode:'city_lead',city:'平潭'},
    {active:true,roleCode:'manager',city:'丽江',storeName:'测试门店'},
    {active:false,roleCode:'manager',city:'大连',storeName:'已撤销门店'}
  ])
  assert.deepEqual(result.map(r=>r.mode),['support','city'])
  assert.equal(result[0].scope,'丽江 · 测试门店')
  assert.equal(result[1].scope,'平潭')
  for(const grants of [null,[],[{roleCode:'manager'}],[{active:false,roleCode:'manager'}],[{active:true,roleCode:'merchant'}]])assert.deepEqual(mediationWorkEntries(grants),[])
})

test('多门店主理人入口合并但明确列出范围，撤销后即时消失',()=>{
  const stores=ref([{active:true,roleCode:'manager',city:'平潭',storeName:'甲店'},{active:true,roleCode:'manager',city:'平潭',storeName:'乙店'}])
  const entries=computed(()=>mediationWorkEntries(stores.value))
  assert.equal(entries.value.length,1)
  assert.equal(entries.value[0].scope,'平潭 · 甲店；平潭 · 乙店')
  stores.value=[]
  assert.deepEqual(entries.value,[])
})

test('工作台独立调解入口位于今日概览前且仍只对当前manager展示',()=>{
  const source=fs.readFileSync(new URL('../pages/staff/index.vue',import.meta.url),'utf8')
  const position=source.indexOf('纠纷调解')
  assert.ok(position>0&&position<source.indexOf('今日概览'))
  assert.match(source.slice(Math.max(0,position-350),position),/currentStaffStore\?\.roleCode === 'manager'/)
})

test('工作授权缺失明确提示，不显示旧门店记录，仍可切回本人的调解',async()=>{
  for(const mode of ['support','city']){
    const h=page({context:{canSupport:false,canCity:false},cases:{rows:[{caseId:42}],total:1}})
    await h.run(`mode.value='${mode}';list.value=[{caseId:99}];total.value=1;load()`)
    assert.match(h.run('error.value'),/没有.*权限|没有.*授权/)
    assert.match(h.run('error.value'),/我的调解/)
    assert.equal(h.run('list.value.length'),0)
    assert.equal(h.run('total.value'),0)
    assert.equal(h.calls.filter(c=>c.path==='cases').length,0)
    await h.run("mode.value='user';loadList()")
    assert.equal(h.run('list.value[0].caseId'),42)
    assert.equal(h.run('error.value'),'')
  }
})

test('主理人空范围不冒充我的工单，主动切换后才请求自己的列表',async()=>{
  const h=page({context:{canSupport:true,canCity:false},cases:{rows:[],total:0}})
  await h.run("mode.value='support';load()")
  assert.equal(h.calls.find(c=>c.path==='cases').q.mode,'support')
  assert.equal(h.run('error.value'),'')
  const source=fs.readFileSync(pageFile,'utf8')
  assert.match(source,/主理人授权门店暂无调解工单。本人参与的申请可切换「我的调解」查看。/)
})
test('详情使用最新一条真实记录和当前状态摘要',()=>{
  const h=page();h.run("detail.value={status:'accepted',log:[{note:'提交材料'},{note:'负责人已接单'}]}")
  assert.equal(h.run('latestLog.value.note'),'负责人已接单')
  assert.match(h.run('progressHint.value'),/已接单/)
})
test('新增入口及只读详情模板可编译',()=>{
  for(const file of [pageFile,cardFile,new URL('../pages/profile/index.vue',import.meta.url),new URL('../pages/profile/components/mediation-entry.vue',import.meta.url)]){
    const p=parse(fs.readFileSync(file,'utf8'));assert.deepEqual(p.errors,[]);compileScript(p.descriptor,{id:'progress'})
    assert.deepEqual(compileTemplate({source:p.descriptor.template.content,id:'progress',filename:file.pathname}).errors,[])
  }
  const source=fs.readFileSync(pageFile,'utf8');assert.match(source,/detail\.canContribute!==false&&detail\.viewerRole!=='support'/)
})
