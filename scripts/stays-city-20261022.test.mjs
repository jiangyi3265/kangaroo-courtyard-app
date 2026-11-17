import fs from 'node:fs'
import vm from 'node:vm'
import { createRequire } from 'node:module'
import test from 'node:test'
import assert from 'node:assert/strict'
import * as ui from '../pages/stays/stays-ui.js'
const require = createRequire(import.meta.url)
const vue = require('vue'), compiler = require('@vue/compiler-sfc')
const source = compiler.parse(fs.readFileSync(new URL('../pages/stays/list.vue', import.meta.url), 'utf8')).descriptor.scriptSetup.content
const ast = compiler.babelParse(source, { sourceType: 'module' })
const body = ast.program.body.filter(n => n.type !== 'ImportDeclaration').map(n => source.slice(n.start, n.end)).join('\n')
const flush = () => new Promise(resolve => setImmediate(resolve))
const deferred = () => { let resolve, reject; const promise = new Promise((a,b) => { resolve=a; reject=b }); return { promise, resolve, reject } }
const directory = [
  { name:'哈尔滨',fullName:'哈尔滨市',level:'city' },
  { name:'道外区',fullName:'道外区',parentName:'哈尔滨市',level:'district' },
  { name:'宾',fullName:'宾县',parentName:'哈尔滨市',level:'district' },
  { name:'丽江',fullName:'丽江市',level:'city' },
  { name:'古城区',fullName:'古城区',parentName:'丽江市',level:'district' }
]
function harness(overrides={}) {
  const timers = new Set(), unmounts = []
  const sandbox = { console,setTimeout:(fn,ms)=>{const t=setTimeout(fn,ms);timers.add(t);return t},clearTimeout,setInterval,clearInterval }
  for (const node of ast.program.body.filter(n=>n.type==='ImportDeclaration')) for (const s of node.specifiers) sandbox[s.local.name]=()=>{}
  const calls=[], screen={}
  Object.assign(sandbox,ui,{
    ref:vue.ref,reactive:vue.reactive,computed:vue.computed,watch:vue.watch,onUnmounted(fn){unmounts.push(fn)},onReachBottom(){},
    useScreen:(_,extra)=>{screen.extra=extra;screen.s=vue.ref(1);return screen.s},
    stayState:vue.reactive({city:'',checkIn:'2026-10-22',checkOut:'2026-10-23',guests:1}),
    normalizeDates(){},saveStayState(){},dotText:()=>'',experience:{cities:[]},toast(){},errText:(_,fallback)=>fallback,
    uni:{getStorageSync(){},setStorageSync(){}},
    apiStayCities:async()=>({data:[{city:'丽江',count:1}]}),
    locateCity:async()=>null,
    apiStayAreas:async()=>({data:[]}),
    get:async url=>({data:url==='/app/cities'?{all:directory}:{districts:[],all:0}}),
    apiStayList:async p=>{calls.push(p);return {data:{rows:[],total:0,hasMore:false}}},
    ...overrides
  })
  vm.createContext(sandbox)
  const scope=vue.effectScope()
  scope.run(()=>vm.runInContext(body+'\nglobalThis.x={init,state,listTitle,loadAreas,areaRows,districtRows,areasLoading,areasError,loadList,rows,listLoading,listError,filter,hasMore,pageNum,loadPreviews,previewRows,previewNationwide,previewNotice,previewError,previewLoading,pickCity,locating,search,showAllPreviews,kw,checks,src};',sandbox))
  return {x:sandbox.x,screen,calls,stop:()=>{scope.stop();unmounts.forEach(fn=>fn());timers.forEach(clearTimeout)}}
}
test('区县匹配父城市，县名用全称；线上自定义区域保留，不串城市',()=>{
  assert.deepEqual(ui.cityDistricts('哈尔滨',directory,[{name:'宾',count:2},{name:'宾县',count:1},{name:'老城',count:1}]),[
    {name:'宾县',count:3},{name:'老城',count:1},{name:'道外区',count:0}
  ])
  assert.deepEqual(ui.cityDistricts('丽江市',directory),[{name:'古城区',count:0}])
  assert.deepEqual(ui.cityDistricts('',directory),[])
  assert.deepEqual(ui.cityDistricts('未知城市',directory),[])
  assert.equal(ui.districtChoices([{name:'道外区',count:0}],0)[1].label,'道外区')
})
test('显式城市不定位覆盖；本城无房源时推荐全国，仍保留目的地和区域',async()=>{
  let located=0
  const h=harness({locateCity:async()=>{located++;return {name:'丽江'}}});h.screen.extra.onLoad({city:'哈尔滨'});await flush();await flush()
  assert.equal(h.x.listTitle.value,'哈尔滨房源')
  assert.equal(located,0)
  assert.ok(h.calls.some(p=>p.city==='哈尔滨') && h.calls.some(p=>!p.city))
  assert.equal(h.x.previewNationwide.value,true)
  assert.match(h.x.previewNotice.value,/哈尔滨暂无上线房源/)
  assert.deepEqual(Array.from(h.x.districtRows.value,r=>r.name),['道外区','宾县'])
  h.stop()
})

test('普通入口按当前位置加载，不沿用缓存或房源目录第一个城市；只有一家也优先本城',async()=>{
  const calls=[]
  const h=harness({locateCity:async()=>({name:'哈尔滨'}),apiStayList:async p=>{calls.push(p);return {data:{rows:[{stayId:p.city?2:1,city:p.city||'丽江'}]}}}})
  h.x.state.city='丽江';h.screen.extra.onLoad({});await flush();await flush()
  assert.equal(h.x.state.city,'哈尔滨')
  assert.equal(h.x.previewRows.value[0].stayId,2)
  assert.equal(h.x.previewNationwide.value,false)
  assert.ok(calls.some(p=>p.city==='哈尔滨'));h.stop()
})

test('定位城市无房源自动查全国，日期人数保持，查看全部清除旧筛选并支持全国分页',async()=>{
  const calls=[]
  const h=harness({locateCity:async()=>({name:'哈尔滨'}),apiStayList:async p=>{
    calls.push(p);return {data:{rows:p.city?[]:[{stayId:p.pageNum}],hasMore:!p.city&&p.pageNum===1}}
  }})
  h.x.state.guests=3;h.screen.extra.onLoad({});await flush();await flush()
  assert.equal(h.x.previewNationwide.value,true);assert.equal(h.x.previewRows.value.length,1)
  const nationwide=calls.filter(p=>!p.city)
  assert.ok(nationwide.every(p=>p.guests===3&&p.checkIn==='2026-10-22'&&p.checkOut==='2026-10-23'))
  Object.assign(h.x.filter,{price:'¥400以上',score:'4.8分以上',room:'双人间',district:'道外区',facilities:['gym'],kitchen:true})
  h.x.checks[2].on=true;h.x.kw.value='旧搜索';h.x.showAllPreviews();await flush();await flush()
  assert.equal(h.x.state.city,'');assert.equal(h.x.listTitle.value,'全部房源')
  assert.equal(h.x.filter.price,'不限');assert.equal(h.x.filter.score,'不限');assert.equal(h.x.filter.kitchen,false)
  assert.equal(h.x.kw.value,'');assert.equal(h.x.filter.facilities.length,0)
  await h.x.loadList(true)
  assert.equal(calls.at(-1).city,undefined);assert.equal(calls.at(-1).pageNum,2)
  assert.equal(h.x.rows.value.length,2);h.stop()
})

test('拒绝定位或定位失败仍展示全国房源，不默认切到丽江',async()=>{
  for(const locateCity of [async()=>null,async()=>{throw Error('denied')}]) {
    const h=harness({locateCity,apiStayList:async()=>({data:{rows:[{stayId:1}]}})})
    h.screen.extra.onLoad({});await flush();await flush()
    assert.equal(h.x.state.city,'');assert.equal(h.x.locating.value,false)
    assert.equal(h.x.previewNationwide.value,true);assert.equal(h.x.previewRows.value.length,1);h.stop()
  }
})

test('手动选择目的地后，迟到的定位结果不能覆盖用户选择',async()=>{
  const gps=deferred()
  const h=harness({locateCity:()=>gps.promise,selectCity:async()=> '丽江'})
  h.screen.extra.onLoad({});await flush();await h.x.pickCity()
  gps.resolve({name:'哈尔滨'});await flush();await flush()
  assert.equal(h.x.state.city,'丽江');assert.equal(h.x.locating.value,false);h.stop()
})

test('旧城市空房源响应不能触发全国兜底覆盖新城市',async()=>{
  const old=deferred();const calls=[]
  const h=harness({apiStayList:p=>{calls.push(p);return p.city==='哈尔滨'?old.promise:Promise.resolve({data:{rows:[{stayId:2}]}})}})
  h.x.state.city='哈尔滨';const first=h.x.loadPreviews()
  h.x.state.city='丽江';await h.x.loadPreviews();old.resolve({data:{rows:[]}});await first
  assert.equal(h.x.previewRows.value[0].stayId,2);assert.equal(h.x.previewNationwide.value,false)
  assert.equal(calls.length,2);h.stop()
})

test('城市接口报错不当作无房源，也不掩盖成全国成功',async()=>{
  let count=0
  const h=harness({apiStayList:async()=>{count++;throw Error('503')}})
  h.x.state.city='哈尔滨';await h.x.loadPreviews()
  assert.equal(count,1);assert.ok(h.x.previewError.value);assert.equal(h.x.previewNationwide.value,false);h.stop()
})

test('全国推荐下默认搜索进入全国，有明确关键词或区域则保留目的地',async()=>{
  for(const explicitFilter of ['', 'keyword', 'district']) {
    const h=harness();h.screen.extra.onLoad({city:'哈尔滨'});await flush();await flush()
    if(explicitFilter==='keyword')h.x.kw.value='客栈'
    if(explicitFilter==='district')h.x.filter.district='道外区'
    h.x.search();await flush()
    assert.equal(h.x.state.city,explicitFilter?'哈尔滨':'');h.stop()
  }
})
test('城市列表接口失败不阻止指定城市加载',async()=>{
  const h=harness({apiStayCities:async()=>{throw Error('offline')}})
  h.screen.extra.onLoad({city:'丽江'});await flush();await flush()
  assert.equal(h.x.state.city,'丽江');assert.ok(h.calls.some(p=>p.city==='丽江'))
  h.stop()
})
test('换城立即清空旧区域，迟到的旧城市响应不能覆盖新区县和商圈',async()=>{
  const old=deferred()
  const h=harness({apiStayAreas:city=>city==='丽江'?old.promise:Promise.resolve({data:[{area:'中央大街',count:1}]})})
  h.x.state.city='丽江';const first=h.x.loadAreas()
  h.x.state.city='哈尔滨';const second=h.x.loadAreas()
  assert.equal(h.x.areaRows.value.length,0)
  await second;old.resolve({data:[{area:'束河古镇',count:1}]});await first
  assert.deepEqual(Array.from(h.x.areaRows.value,r=>r.area),['中央大街'])
  assert.deepEqual(Array.from(h.x.districtRows.value,r=>r.name),['道外区','宾县'])
  assert.equal(h.x.areasLoading.value,false);h.stop()
})
test('区县目录失败仍展示房源提供的位置，重新加载能恢复目录',async()=>{
  let fail=true
  const h=harness({get:async url=>{
    if(url==='/app/cities'){if(fail)throw Error('offline');return {data:{all:directory}}}
    return {data:{all:1,districts:[{name:'道外区',count:1}]}}
  }})
  h.x.state.city='哈尔滨';await h.x.loadAreas()
  assert.equal(h.x.districtRows.value[0].name,'道外区');assert.ok(h.x.areasError.value)
  fail=false;await h.x.loadAreas();assert.equal(h.x.districtRows.value.length,2);assert.equal(h.x.areasError.value,'');h.stop()
})
test('先发出的房源请求迟到时不能覆盖新城市的结果',async()=>{
  const old=deferred()
  const h=harness({apiStayList:p=>p.city==='丽江'?old.promise:Promise.resolve({data:{rows:[{stayId:2}],hasMore:false}})})
  h.x.state.city='丽江';const first=h.x.loadList()
  h.x.state.city='哈尔滨';await h.x.loadList()
  old.resolve({data:{rows:[{stayId:1}]}});await first
  assert.deepEqual(Array.from(h.x.rows.value,r=>r.stayId),[2]);assert.equal(h.x.listLoading.value,false);h.stop()
})
test('分页请求去重；列表加载失败有重试状态，刷新后恢复',async()=>{
  const page=deferred();let n=0
  const h=harness({apiStayList:async p=>{n++;if(p.pageNum===2)return page.promise;if(n===1)throw Error('offline');return {data:{rows:[{stayId:1}],hasMore:true}}}})
  h.x.state.city='丽江';await h.x.loadList();assert.ok(h.x.listError.value)
  await h.x.loadList();assert.equal(h.x.listError.value,'')
  const first=h.x.loadList(true);await h.x.loadList(true);assert.equal(n,3)
  page.resolve({data:{rows:[{stayId:2}],hasMore:false}});await first
  assert.deepEqual(Array.from(h.x.rows.value,r=>r.stayId),[1,2]);assert.equal(h.x.pageNum.value,2);h.stop()
})
