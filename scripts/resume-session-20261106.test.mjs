import fs from 'node:fs'
import vm from 'node:vm'
import { createRequire } from 'node:module'
import test from 'node:test'
import assert from 'node:assert/strict'

const require = createRequire(import.meta.url)
const vue = require('vue'), compiler = require('@vue/compiler-sfc')
const deferred = () => { let resolve, reject; const promise = new Promise((a,b) => { resolve=a; reject=b }); return { promise, resolve, reject } }
const result = name => ({ data: { resume: { name, age: 25, phone: name === '甲' ? '13800000001' : '13800000002' }, exps: [], stats: [], links: [] } })
const flush = async () => { for (let i=0;i<4;i++) await new Promise(resolve => setImmediate(resolve)) }
function setup(overrides={}) {
  const descriptor = compiler.parse(fs.readFileSync(new URL('../pages/profile/resume.vue', import.meta.url),'utf8')).descriptor
  const source=descriptor.scriptSetup.content, ast=compiler.babelParse(source,{sourceType:'module'}), hooks={}, toasts=[]
  const ctx={console,setTimeout,clearTimeout}
  for(const n of ast.program.body.filter(n=>n.type==='ImportDeclaration')) for(const s of n.specifiers) ctx[s.local.name]=()=>{}
  let revision=0
  Object.assign(ctx,vue,{
    experience:vue.reactive({account:{id:1},mode:'user'}),session:{restored:true},currentStaffStore:vue.ref(null),
    getSessionRevision:()=>revision,useScreen:(_,options)=>{hooks.load=options.onLoad;return vue.ref(1)},onShow:f=>{hooks.show=f},onUnmounted:f=>{hooks.unmount=f},
    ensureSession:async()=>{},apiResume:async()=>result('乙'),apiOpportunities:async()=>({data:{jobs:[]}}),
    apiResumeBasic:async()=>result('甲'),apiResumeSkills:async()=>result('甲'),apiResumeReuse:async()=>result('甲'),
    toast:m=>toasts.push(m),errText:e=>e.message,todayCn:()=> '2026-11-06',isYmd:()=>true,
    confirm:async()=>true,selectCity:async()=>null,absUrl:s=>s,R:{opportunities:'/pages/jobs/opportunities'},uni:{},...overrides
  })
  vm.createContext(ctx);const scope=vue.effectScope()
  scope.run(()=>vm.runInContext(ast.program.body.filter(n=>n.type!=='ImportDeclaration').map(n=>source.slice(n.start,n.end)).join('\n'),ctx))
  vm.runInContext('apply({resume:{},exps:[],stats:[],links:[]})', ctx)
  return {ctx,hooks,toasts,run:s=>vm.runInContext(s,ctx),switch(id){revision++;ctx.experience.account=id?{id}:null},stop(){hooks.unmount?.();scope.stop()}}
}

test('旧账号慢简历响应不能覆盖新账号姓名电话',async t=>{
  const pending=deferred(),h=setup({apiResume:()=>pending.promise});t.after(h.stop)
  const old=h.run('load()');h.switch(2);h.ctx.apiResume=async()=>result('乙');await h.run('load()')
  pending.resolve(result('甲'));await old
  assert.equal(h.run('form.name'),'乙');assert.equal(h.run('form.phone'),'13800000002')
})
test('退出账号立即清空简历、机会、经历草稿和正在保存标记',async t=>{
  const h=setup();t.after(h.stop);h.run("apply({resume:{name:'甲',phone:'13800000001'},exps:[{expId:1}],links:[]});opp.value={jobs:[{title:'甲的机会'}]};expForm.open=true;saving.value=true")
  h.switch(null)
  assert.equal(h.run('form.name'),'');assert.equal(h.run('form.phone'),'');assert.equal(h.run('data.value.exps.length'),0)
  assert.equal(h.run('opp.value.jobs.length'),0);assert.equal(h.run('expForm.open'),false);assert.equal(h.run('saving.value'),false)
})
test('旧账号保存响应不修改新草稿、屏幕或提示',async t=>{
  const pending=deferred(),h=setup({apiResumeBasic:()=>pending.promise});t.after(h.stop)
  h.run("s.value=2;form.name='甲'");const old=h.run('save()');h.switch(2);h.run("s.value=2;form.name='乙的新草稿'")
  pending.resolve(result('甲'));await old
  assert.equal(h.run('form.name'),'乙的新草稿');assert.equal(h.run('s.value'),2);assert.deepEqual(h.toasts,[])
})
test('旧账号失败不弹错误或解除新账号正在保存状态',async t=>{
  const pending=deferred(),h=setup({apiResumeBasic:()=>pending.promise});t.after(h.stop)
  h.run('s.value=2');const old=h.run('save()');h.switch(2);h.run('saving.value=true')
  pending.reject(new Error('甲的保存失败'));await old
  assert.equal(h.run('saving.value'),true);assert.deepEqual(h.toasts,[])
})
test('同一账号新请求先完成时，旧读取不能覆盖',async t=>{
  const pending=deferred(),h=setup({apiResume:()=>pending.promise});t.after(h.stop)
  const old=h.run('load()');h.ctx.apiResume=async()=>result('乙');await h.run('load()');pending.resolve(result('甲'));await old
  assert.equal(h.run('form.name'),'乙')
})
test('选文件期间切账号，不得把文件上传到新账号',async t=>{
  const pending=deferred(),uploads=[],h=setup({chooseResumeDocument:()=>pending.promise,uploadTo:(...args)=>uploads.push(args)});t.after(h.stop)
  const old=h.run('importResume()');h.switch(2);pending.resolve('甲的简历.pdf');await old
  assert.deepEqual(uploads,[]);assert.deepEqual(h.toasts,[])
})
test('上传完成晚于账号切换时不把原账号私有图片写入新草稿',async t=>{
  const pending=deferred(),h=setup({chooseImage:async()=>'/test/image.jpg',uploadTo:()=>pending.promise});t.after(h.stop)
  const old=h.run("addResumeMedia('portrait')");await flush();h.switch(2)
  pending.resolve({data:{key:'old-account-private-photo',url:'/private/old'}});await old
  assert.equal(h.run('form.lifePhoto'),'');assert.deepEqual(h.toasts,[])
})
test('删除确认期间换账号不得向新账号发送旧经历删除请求',async t=>{
  const pending=deferred(),calls=[],h=setup({confirm:()=>pending.promise,apiResumeRemoveExp:id=>calls.push(id)});t.after(h.stop)
  const old=h.run("removeExp({expId:7,title:'甲的经历',source:'self'})");h.switch(2);pending.resolve(true);await old
  assert.deepEqual(calls,[])
})
test('页面卸载后忽略读取和失败回调',async()=>{
  const pending=deferred(),h=setup({apiResume:()=>pending.promise});const old=h.run('load()');h.stop();pending.resolve(result('甲'));await old
  assert.equal(h.run('form.name'),'');assert.deepEqual(h.toasts,[])
})
test('正常保存仍应用服务器返回并回概览',async t=>{
  const h=setup();t.after(h.stop);h.run("s.value=2;form.name='甲'");await h.run('save()')
  assert.equal(h.run('form.name'),'甲');assert.equal(h.run('s.value'),1);assert.equal(h.toasts.at(-1),'已保存');assert.equal(h.run('saving.value'),false)
})

test('基本信息保存过程中继续输入，保留后写的内容并允许重试保存',async t=>{
  const pending=deferred(),submitted=[]
  const h=setup({apiResumeBasic:body=>{submitted.push(body.name);return submitted.length===1?pending.promise:Promise.resolve(result(body.name))}})
  t.after(h.stop)
  h.run("s.value=2;form.name='先写的名字'")
  const first=h.run('save()')
  h.run("form.name='后来改的名字'")
  pending.resolve(result('先写的名字'));await first
  assert.equal(h.run('s.value'),2)
  assert.equal(h.run('form.name'),'后来改的名字')
  assert.equal(h.run('data.value.resume.name'),'先写的名字')
  await h.run('save()')
  assert.deepEqual(submitted,['先写的名字','后来改的名字'])
  assert.equal(h.run('s.value'),1)
})

test('保存技能后立即返回并打开基本信息，迟到的回包不抢走新编辑页',async t=>{
  const pending=deferred(),h=setup({apiResumeSkills:()=>pending.promise})
  t.after(h.stop)
  h.run("s.value=3;skill.value='摄影'")
  const first=h.run('save()')
  h.run("s.value=1;s.value=2;form.intro='正在写介绍'")
  pending.resolve(result('甲'));await first
  assert.equal(h.run('s.value'),2);assert.equal(h.run('form.intro'),'正在写介绍')
})

test('读取已有简历失败时拦住空表提交，重试后保留已有照片和介绍',async t=>{
  let writes=0
  const h=setup({apiResume:async()=>{throw Error('暂时断网')},apiResumeBasic:async body=>{writes++;return {data:{resume:body}}}})
  t.after(h.stop);await h.run('load()');h.run("s.value=2;form.name='甲'");await h.run('save()')
  assert.equal(writes,0)
  h.ctx.apiResume=async()=>({data:{resume:{name:'甲',intro:'已有介绍',lifePhoto:'portrait-a'}}})
  await h.run('load()');h.run("form.name='新名字'");await h.run('save()')
  assert.equal(writes,1);assert.equal(h.run('form.intro'),'已有介绍');assert.equal(h.run('form.lifePhoto'),'portrait-a')
})

test('保存一段经历时转去编辑另一段，原回包保留新打开的编辑表',async t=>{
  const pending=deferred(),h=setup({apiResumeEditExp:()=>pending.promise})
  t.after(h.stop);h.run("s.value=4;openExpForm({expId:1,title:'第一段'})")
  const first=h.run('saveExp()');h.run("openExpForm({expId:2,title:'第二段'})")
  pending.resolve(result('甲'));await first
  assert.equal(h.run('expForm.open'),true);assert.equal(h.run('expForm.title'),'第二段')
})

test('导入识别期间手动输入的城市不会被识别结果覆盖，其余字段正常填入',async t=>{
  const pending=deferred(),h=setup({chooseResumeDocument:async()=>'fixture.txt',uploadTo:()=>pending.promise})
  t.after(h.stop)
  const importing=h.run('importResume()');await flush();h.run("form.city='大理'")
  pending.resolve({data:{fields:{city:'厦门',intro:'擅长摄影'}}});await importing
  assert.equal(h.run('form.city'),'大理');assert.equal(h.run('form.intro'),'擅长摄影')
})

test('选简历作品时连续点添加只打开一次选择器，取消后可以重新选择',async t=>{
  const pick=deferred();let opens=0
  const h=setup({chooseImage:()=>{opens++;return pick.promise}})
  t.after(h.stop)
  const first=h.run("addResumeMedia('photo')"),second=h.run("addResumeMedia('photo')")
  pick.resolve(null);await Promise.all([first,second]);assert.equal(opens,1)
  assert.equal(h.run('uploading.value'),false);await h.run("addResumeMedia('photo')");assert.equal(opens,2)
})

test('简历保存断网保留当前输入，重新提交成功并返回概览',async t=>{
  const h=setup({apiResumeBasic:async()=>{throw Error('网络未连接')}})
  t.after(h.stop)
  h.run("s.value=2;form.name='我的新草稿'");await h.run('save()')
  assert.equal(h.run('s.value'),2);assert.equal(h.run('form.name'),'我的新草稿')
  h.ctx.apiResumeBasic=async body=>result(body.name);await h.run('save()')
  assert.equal(h.run('data.value.resume.name'),'我的新草稿');assert.equal(h.run('s.value'),1)
})

test('提交后再次聚焦输入框，输入法尚未提交时仍停在编辑页',async t=>{
  const pending=deferred(),h=setup({apiResumeBasic:()=>pending.promise})
  t.after(h.stop);h.run("s.value=2;form.name='第一稿'");const first=h.run('save()')
  h.run('onDraftFocus()');pending.resolve(result('第一稿'));await first
  assert.equal(h.run('s.value'),2)
  h.run("form.name='新输入'");assert.equal(h.run('form.name'),'新输入')
})
test('冷启动恢复账号后读取一次，后续切账号重新加载本人简历',async t=>{
  const restoring=deferred(),calls=[],h=setup({ensureSession:()=>restoring.promise,apiResume:async()=>{calls.push(h.ctx.experience.account.id);return result(h.ctx.experience.account.id===1?'甲':'乙')}});t.after(h.stop)
  h.switch(null);const loading=h.hooks.load();h.switch(1);restoring.resolve();await loading
  assert.deepEqual(calls,[1]);assert.equal(h.run('form.name'),'甲')
  h.switch(2);await flush();assert.deepEqual(calls,[1,2]);assert.equal(h.run('form.name'),'乙')
})
test('同账号重新登录的会话版本变化也丢弃旧响应',async t=>{
  const pending=deferred(),h=setup({apiResume:()=>pending.promise});t.after(h.stop)
  const old=h.run('load()');h.switch(1);h.run("form.name='新会话草稿'");pending.resolve(result('甲'));await old
  assert.equal(h.run('form.name'),'新会话草稿')
})
test('旧机会响应不会把原账号匹配列表带入新账号',async t=>{
  const pending=deferred(),h=setup({apiOpportunities:()=>pending.promise});t.after(h.stop)
  const old=h.run('loadOpp()');h.switch(2);pending.resolve({data:{skills:['摄影'],jobs:[{jobId:7,title:'旧机会'}]}});await old
  assert.equal(h.run('opp.value.jobs.length'),0);assert.equal(h.run('oppLoaded.value'),false)
})
