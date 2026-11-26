import fs from 'node:fs'
import vm from 'node:vm'
import { createRequire } from 'node:module'
import test from 'node:test'
import assert from 'node:assert/strict'
import * as events from '../common/job-favorite-events.js'
import * as storePage from '../pages/jobs/store-page.js'
import * as presentation from '../pages/jobs/volunteer-presentation.js'
const require = createRequire(import.meta.url), vue = require('vue'), compiler = require('@vue/compiler-sfc')
const plain = v => JSON.parse(JSON.stringify(v))
const flush = () => new Promise(resolve => setImmediate(resolve))
const JOB = { jobId: 7, jobType: 'volunteer', title: '测试岗位', store: { storeId: 1 }, favorite: true }
function setup(rel, overrides = {}, accountId = 11) {
  const script = compiler.parse(fs.readFileSync(new URL('../' + rel, import.meta.url), 'utf8')).descriptor.scriptSetup.content
  const ast = compiler.babelParse(script, { sourceType: 'module' }), cleanups = [], toasts = [], ctx = { console }
  for (const node of ast.program.body.filter(n => n.type === 'ImportDeclaration')) for (const spec of node.specifiers) {
    const lib = node.source.value === './store-page.js' ? storePage : node.source.value === './volunteer-presentation.js' ? presentation : null
    ctx[spec.local.name] = lib ? lib[spec.imported.name] : () => {}
  }
  Object.assign(ctx, vue, events, {
    experience: vue.reactive({ account: { id: accountId } }),
    useScreen: () => vue.ref(1), onShow() {}, onLoad() {}, onPullDownRefresh() {}, onUnmounted: f => cleanups.push(f),
    ensureSession: async () => {}, toast: m => toasts.push(m), errText: e => e.message, absUrl: s => s,
    apiStoreReviews: async () => ({ data: {} }), apiJobDetail: async () => ({ data: plain(JOB) }),
    uni: {}, R: { jobDetail: '/pages/jobs/detail', login: '/pages/auth/login' }
  }, overrides)
  vm.createContext(ctx)
  const scope = vue.effectScope()
  scope.run(() => vm.runInContext(ast.program.body.filter(n => n.type !== 'ImportDeclaration').map(n => script.slice(n.start,n.end)).join('\n'), ctx))
  return { run: code => vm.runInContext(code,ctx), ctx, toasts, stop() { cleanups.forEach(f => f()); scope.stop() } }
}
function follows(overrides, accountId) {
  const h=setup('pages/profile/follows.vue',overrides,accountId)
  h.run("mode.value='fav'; favRows.value=[{kind:'job',id:7,title:'岗位一'},{kind:'job',id:8,title:'岗位二'}]")
  return h
}
test('游客切换收藏/关注不请求私人列表，登录返回后保留分类并读取', async t => {
  let enter, show; const calls=[]
  const h=setup('pages/profile/follows.vue',{
    onLoad:f=>{enter=f}, onShow:f=>{show=f},
    stayBookingEnabled:vue.ref(true),
    apiJobFavorites:async()=>{calls.push('job');return {data:[]}},
    apiStayFavorites:async()=>{calls.push('stay');return {data:[]}},
    apiMyFollows:async()=>{calls.push('store');return {data:[]}},
    apiFollowingUsers:async()=>{calls.push('user');return {data:[]}}
  },null);t.after(h.stop)
  await enter({mode:'fav',fav:'stay'})
  assert.equal(h.run('sessionReady.value'),true); assert.deepEqual(calls,[])
  await h.run('loadFav()'); await h.run('loadUsers()'); await h.run('loadList()')
  assert.deepEqual(calls,[])
  h.ctx.experience.account={id:11};show();await flush()
  assert.deepEqual(calls,['stay']);assert.equal(h.run('favTab.value'),'stay')
  h.ctx.experience.account=null;show();await flush()
  assert.deepEqual(calls,['stay']);assert.equal(h.run('favRows.value.length'),0)
})
test('游客仍能看公开门店，点击关注直接去登录且不发关注请求', async t => {
  let enter;const calls=[],routes=[]
  const h=setup('pages/profile/follows.vue',{
    onLoad:f=>{enter=f},go:url=>routes.push(url),
    apiStoreJobs:async id=>{calls.push(id);return {data:{store:{storeId:id,storeName:'小院'},jobs:[]}}},
    apiFollowStore:()=>{throw new Error('guest must not write')}
  },null);t.after(h.stop)
  await enter({storeId:'7'});assert.deepEqual(calls,[7]);assert.equal(h.run('store.value.storeName'),'小院')
  await h.run('toggleFollow()');assert.deepEqual(routes,['/pages/auth/login'])
})
test('登录恢复中页面卸载，不再发私人或公开门店读取', async t => {
  let enter,finish;const calls=[]
  const h=setup('pages/profile/follows.vue',{
    onLoad:f=>{enter=f},ensureSession:()=>new Promise(r=>{finish=r}),
    apiStoreJobs:async()=>{calls.push('store');return {data:{}}}
  });const pending=enter({storeId:'7'});h.stop();finish();await pending
  assert.deepEqual(calls,[]);assert.equal(h.run('sessionReady.value'),false)
})
test('列表直接取消：保存成功才移除，连续点击仅请求一次，其他岗位保留', async t => {
  const calls=[];let finish
  const h=follows({apiToggleFavorite:(...args)=>{calls.push(args);return new Promise(resolve=>{finish=resolve})}});t.after(h.stop)
  const pending=h.run('cancelFavJob(favRows.value[0])')
  await h.run('cancelFavJob(favRows.value[0])')
  assert.deepEqual(calls,[[7,false]]); assert.equal(h.run('favRows.value.length'),2);assert.equal(h.run('cancelingJobs.value[7]'),true)
  finish({data:{favorite:false}});await pending
  assert.deepEqual(plain(h.run('favRows.value.map(r=>r.id)')),[8]);assert.equal(h.run('cancelingJobs.value[7]'),undefined);assert.equal(h.toasts.at(-1),'已取消收藏')
})
test('失败和服务端仍为收藏时不移除，成功重试后再移除', async t => {
  const h=follows({apiToggleFavorite:async()=>{throw new Error('网络失败')}});t.after(h.stop)
  await h.run('cancelFavJob(favRows.value[0])');assert.equal(h.run('favRows.value.length'),2);assert.equal(h.run('cancelingJobs.value[7]'),undefined)
  h.ctx.apiToggleFavorite=async()=>({data:{favorite:true}})
  await h.run('cancelFavJob(favRows.value[0])');assert.equal(h.run('favRows.value.length'),2)
  h.ctx.apiToggleFavorite=async()=>({data:{favorite:false}})
  await h.run('cancelFavJob(favRows.value[0])');assert.equal(h.run('favRows.value.length'),1)
})
test('晚到的旧收藏列表不能恢复已取消岗位，切换类别不会误删同编号房源', async t => {
  let resolveList
  const h=follows({apiJobFavorites:()=>new Promise(resolve=>{resolveList=resolve}),apiToggleFavorite:async()=>({data:{favorite:false}})});t.after(h.stop)
  const load=h.run('loadFav()');await h.run('cancelFavJob(favRows.value[0])')
  resolveList({data:[JOB,{...JOB,jobId:8}]});await load
  assert.deepEqual(plain(h.run('favRows.value.map(r=>r.id)')),[8]);assert.equal(h.run('favLoading.value'),false)
  let finish;h.ctx.apiToggleFavorite=()=>new Promise(resolve=>{finish=resolve})
  const cancel=h.run('cancelFavJob(favRows.value[0])')
  h.run("favTab.value='stay';favRows.value=[{kind:'stay',id:8}]")
  finish({data:{favorite:false}});await cancel
  assert.equal(h.run('favRows.value[0].kind'),'stay')
})
test('列表取消即时同步已打开的详情，刷新旧响应不能覆盖；新请求优先', async t => {
  const detail=setup('pages/jobs/detail.vue');t.after(detail.stop)
  detail.run("jobId.value='7'");await detail.run('load()')
  let finishOld;detail.ctx.apiJobDetail=()=>new Promise(resolve=>{finishOld=resolve})
  const old=detail.run('load({background:true})')
  const list=follows({apiToggleFavorite:async()=>({data:{favorite:false}})});t.after(list.stop)
  await list.run('cancelFavJob(favRows.value[0])')
  assert.equal(detail.run('favorite.value'),false);assert.equal(detail.run('detail.value.favorite'),false)
  finishOld({data:plain(JOB)});await old
  assert.equal(detail.run('favorite.value'),false)
  const reads=[];detail.ctx.apiJobDetail=()=>new Promise(resolve=>reads.push(resolve))
  const read1=detail.run('load()'), read2=detail.run('load()')
  reads[1]({data:{...JOB,favorite:false}});await read2;reads[0]({data:plain(JOB)});await read1
  assert.equal(detail.run('favorite.value'),false);assert.equal(detail.run('detail.value.favorite'),false)
})
test('收藏广播按账号和岗位隔离；切换账号后的旧请求不改新账号界面', async t => {
  const other=setup('pages/jobs/detail.vue',{},22);t.after(other.stop)
  other.run("jobId.value='7'");await other.run('load()')
  events.publishJobFavoriteChange(11,7,false);assert.equal(other.run('favorite.value'),true)
  events.publishJobFavoriteChange(22,8,false);assert.equal(other.run('favorite.value'),true)
  let finish
  const h=follows({apiToggleFavorite:()=>new Promise(resolve=>{finish=resolve})});t.after(h.stop)
  const pending=h.run('cancelFavJob(favRows.value[0])');h.ctx.experience.account={id:22}
  finish({data:{favorite:false}});await pending
  assert.equal(h.run('favRows.value.length'),0);assert.equal(h.toasts.length,0);assert.equal(other.run('favorite.value'),true)
})
test('详情取消途中切换账号，新账号服务器星标优先，旧成功响应不覆盖或提示', async t => {
  let finish
  const h=setup('pages/jobs/detail.vue',{apiToggleFavorite:()=>new Promise(resolve=>{finish=resolve})});t.after(h.stop)
  h.run("jobId.value='7'");await h.run('load()')
  const pending=h.run('toggleFavorite()');await flush()
  assert.equal(h.run('favorite.value'),false)
  h.ctx.experience.account={id:22}
  assert.equal(h.run('favoriteBusy.value'),false)
  h.ctx.apiJobDetail=async()=>({data:plain(JOB)})
  await h.run('load({background:true})')
  assert.equal(h.run('favorite.value'),true)
  finish({data:{favorite:false}});await pending
  assert.equal(h.run('favorite.value'),true);assert.equal(h.run('detail.value.favorite'),true)
  assert.deepEqual(h.toasts,[])
})
test('详情读请求跨账号返回时，不覆盖新账号数据或展示旧错误', async t => {
  const reads=[]
  const h=setup('pages/jobs/detail.vue',{apiJobDetail:()=>new Promise((resolve,reject)=>reads.push({resolve,reject}))});t.after(h.stop)
  h.run("jobId.value='7'")
  const old=h.run('load()')
  h.ctx.experience.account={id:22}
  const fresh=h.run('load()')
  reads[1].resolve({data:{...JOB,favorite:false,title:'当前账号的岗位'}});await fresh
  reads[0].resolve({data:plain(JOB)});await old
  assert.equal(h.run('favorite.value'),false);assert.equal(h.run('detail.value.title'),'当前账号的岗位')
  const oldFailure=h.run('load({background:true})');h.ctx.experience.account={id:33}
  reads[2].reject(new Error('上一个账号加载失败'));await oldFailure
  assert.deepEqual(h.toasts,[])
})
test('旧账号收藏失败不能回滚新账号乐观值，也不能提前解除新请求的忙碌状态', async t => {
  const writes=[]
  const h=setup('pages/jobs/detail.vue',{apiToggleFavorite:()=>new Promise((resolve,reject)=>writes.push({resolve,reject}))});t.after(h.stop)
  h.run("jobId.value='7'");await h.run('load()')
  const old=h.run('toggleFavorite()');await flush()
  h.ctx.experience.account={id:22};await h.run('load()')
  const fresh=h.run('toggleFavorite()');await flush()
  assert.equal(writes.length,2);assert.equal(h.run('favorite.value'),false);assert.equal(h.run('favoriteBusy.value'),true)
  writes[0].reject(new Error('旧账号网络失败'));await old
  assert.equal(h.run('favorite.value'),false);assert.equal(h.run('favoriteBusy.value'),true);assert.deepEqual(h.toasts,[])
  writes[1].resolve({data:{favorite:false}});await fresh
  assert.equal(h.run('favoriteBusy.value'),false);assert.deepEqual(h.toasts,['已取消收藏'])
})
test('同账号退出后重新登录，也不接受上一会话的收藏响应', async t => {
  let revision=0,finish
  const h=setup('pages/jobs/detail.vue',{getSessionRevision:()=>revision,apiToggleFavorite:()=>new Promise(resolve=>{finish=resolve})});t.after(h.stop)
  h.run("jobId.value='7'");await h.run('load()')
  const old=h.run('toggleFavorite()');await flush()
  revision++;h.ctx.experience.account=null
  h.ctx.experience.account={id:11};await h.run('load()')
  finish({data:{favorite:false}});await old
  assert.equal(h.run('favorite.value'),true);assert.equal(h.run('favoriteBusy.value'),false);assert.deepEqual(h.toasts,[])
})
test('冷启动等待账号恢复后读取详情，不能因会话切换留下空白或游客星标', async t => {
  let onLoad,restore;const calls=[]
  const h=setup('pages/jobs/detail.vue',{
    experience:vue.reactive({account:null}),
    ensureSession:()=>new Promise(resolve=>{restore=resolve}),
    useScreen:(_,options)=>{onLoad=options.onLoad;return vue.ref(1)},
    apiJobDetail:async()=>{calls.push(1);return {data:plain(JOB)}}
  });t.after(h.stop)
  const opening=onLoad({jobId:'7'});await flush();assert.equal(calls.length,0)
  h.ctx.experience.account={id:11};restore();await opening
  assert.equal(calls.length,1);assert.equal(h.run('detail.value.jobId'),7);assert.equal(h.run('favorite.value'),true)
})

test('收藏列表同账号退出重登后，旧取消响应不删除新会话收藏', async t => {
  let revision=0,finish
  const h=follows({getSessionRevision:()=>revision,apiToggleFavorite:()=>new Promise(resolve=>{finish=resolve}),apiJobFavorites:async()=>({data:[JOB]})});t.after(h.stop)
  const pending=h.run('cancelFavJob(favRows.value[0])')
  revision++;h.ctx.experience.account=null;h.ctx.experience.account={id:11}
  await h.run('loadFav()');assert.equal(h.run('favRows.value.length'),1)
  finish({data:{favorite:false}});await pending
  assert.equal(h.run('favRows.value.length'),1);assert.deepEqual(h.toasts,[])
})

test('列表旧取消完成不能解除新账号同岗位的取消中状态', async t => {
  const writes=[]
  const h=follows({apiToggleFavorite:()=>new Promise(resolve=>writes.push(resolve)),apiJobFavorites:async()=>({data:[JOB]})});t.after(h.stop)
  const old=h.run('cancelFavJob(favRows.value[0])')
  h.ctx.experience.account={id:22};await h.run('loadFav()')
  const fresh=h.run('cancelFavJob(favRows.value[0])');assert.equal(writes.length,2)
  writes[0]({data:{favorite:false}});await old
  assert.equal(h.run('cancelingJobs.value[7]'),true);assert.equal(h.run('favRows.value.length'),1)
  writes[1]({data:{favorite:false}});await fresh
  assert.equal(h.run('cancelingJobs.value[7]'),undefined);assert.equal(h.run('favRows.value.length'),0)
})

test('列表旧会话的读取、错误和取消响应在卸载或重新登录后失效', async t => {
  let revision=0;const reads=[]
  const h=follows({getSessionRevision:()=>revision,apiJobFavorites:()=>new Promise((resolve,reject)=>reads.push({resolve,reject}))});t.after(h.stop)
  const old=h.run('loadFav()');revision++;h.ctx.experience.account=null;h.ctx.experience.account={id:11}
  const fresh=h.run('loadFav()');reads[0].reject(new Error('旧会话失败'));await old
  assert.equal(h.run('favError.value'),'');assert.equal(h.run('favLoading.value'),true)
  reads[1].resolve({data:[{...JOB,title:'当前收藏'}]});await fresh
  assert.equal(h.run('favRows.value[0].title'),'当前收藏')
  const afterClose=h.run('loadFav()');h.stop();reads[2].resolve({data:[]});await afterClose
  assert.equal(h.run('favRows.value[0].title'),'当前收藏')
})

test('取消关注确认跨账号时不发送请求，旧用户切换响应不发起二次写入', async t => {
  const writes=[];let confirmation,finish
  const h=follows({confirm:()=>new Promise(resolve=>{confirmation=resolve}),apiFollow:()=>{writes.push(1);return new Promise(resolve=>{finish=resolve})}});t.after(h.stop)
  const confirming=h.run("unfollowUser({userId:5,name:'测试用户'})")
  h.ctx.experience.account={id:22};confirmation(true);await confirming;assert.equal(writes.length,0)
  h.ctx.confirm=async()=>true
  const pending=h.run("unfollowUser({userId:5,name:'测试用户'})");await flush()
  h.ctx.experience.account={id:33};finish({data:{followed:true}});await pending
  assert.equal(writes.length,1);assert.deepEqual(h.toasts,[])
})

test('门店关注保存途中切换门店，不覆盖另一个门店的关注状态', async t => {
  let finish
  const h=follows({apiFollowStore:()=>new Promise(resolve=>{finish=resolve})});t.after(h.stop)
  h.run('storeId.value=7;following.value=false')
  const pending=h.run('toggleFollow()')
  h.run('storeId.value=8;following.value=false')
  finish({data:{following:true}});await pending
  assert.equal(h.run('following.value'),false);assert.deepEqual(h.toasts,[])
})

test('取消关注成功后的迟到旧读取不恢复门店或用户列表', async t => {
  let storeRead,userRead
  const h=follows({confirm:async()=>true,apiMyFollows:()=>new Promise(r=>{storeRead=r}),apiFollowingUsers:()=>new Promise(r=>{userRead=r}),apiFollowStore:async()=>({data:{following:false}}),apiFollow:async()=>({data:{followed:false}})});t.after(h.stop)
  h.run("rows.value=[{storeId:7}];users.value=[{userId:8}]")
  const oldStore=h.run('loadList()'),oldUser=h.run('loadUsers()')
  await h.run("unfollow({storeId:7,storeName:'测试门店'})");await h.run("unfollowUser({userId:8,name:'测试用户'})")
  storeRead({data:{rows:[{storeId:7}]}});userRead({data:[{userId:8}]});await Promise.all([oldStore,oldUser])
  assert.equal(h.run('rows.value.length'),0);assert.equal(h.run('users.value.length'),0)
  assert.equal(h.run('loading.value'),false);assert.equal(h.run('userLoading.value'),false)
})
