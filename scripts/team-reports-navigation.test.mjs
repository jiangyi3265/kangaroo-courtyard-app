import test from 'node:test'
import assert from 'node:assert/strict'
import vm from 'node:vm'
import { readFileSync } from 'node:fs'
import { computed, reactive, ref, watch, effectScope } from 'vue'

const source = readFileSync(new URL('../pages/profile/team-reports.vue', import.meta.url), 'utf8')
const script = source.split('<script setup>')[1].split('</script>')[0].replace(/^import .*$/gm, '')
const flush = () => new Promise(resolve => setImmediate(resolve))
const access = { data: {allowed:true, cities:[], month:'2026-11'} }

function page(t, get, ensureSession = async () => {}) {
  const life = {}, scope = effectScope(), experience = reactive({account:{id:1}})
  const sandbox = {ref,computed,watch,get,ensureSession,experience,absUrl:v=>v,uni:{pageScrollTo(){}},
    onShow:fn=>{life.show=fn}, onHide:fn=>{life.hide=fn}, onUnload:fn=>{life.unload=fn}}
  scope.run(() => vm.runInNewContext(script+';this.state={allowed,ready,error,boot,open,back,rows,detail,keyword}',sandbox))
  t.after(() => {life.unload();scope.stop()})
  return {...sandbox.state,...life,experience}
}

test('离开页面时尚未恢复登录，不再拉取团队报表',async t=>{
  let restore, requests=0
  const p=page(t,async()=>{requests++;return access},()=>new Promise(resolve=>{restore=resolve}))
  const pending=p.show();p.hide();restore();await pending
  assert.equal(requests,0)
  assert.equal(p.ready.value,false)
})

test('切换账号时清理筛选条件，旧授权晚返回也不能显示原账号的报表',async t=>{
  const replies=[], routes=[]
  const p=page(t,path=>{routes.push(path);return new Promise(r=>replies.push(r))})
  const first=p.show();await flush()
  p.keyword.value='旧姓名';p.experience.account={id:2};await flush()
  replies[1]({data:{allowed:false,cities:[],month:'2026-11'}});await flush()
  replies[0](access);await first
  assert.deepEqual(routes,['/app/team-reports/access','/app/team-reports/access'])
  assert.equal(p.keyword.value,'');assert.equal(p.ready.value,true);assert.equal(p.allowed.value,false)
})

test('离开报表详情再回来，返回列表可以重新看到原记录',async t=>{
  let lists=0
  const p=page(t,async path=>{
    if(path.endsWith('/access'))return access
    if(path.endsWith('/daily/7'))return {data:{id:7,title:'测试日报'}}
    lists++;return {data:{total:1,rows:[{id:7}]}}
  })
  await p.show();await p.open(7);p.hide();await p.show()
  assert.equal(p.detail.value.id,7);await p.back()
  assert.equal(p.rows.value[0].id,7);assert.equal(lists,2)
})

test('登录恢复出错时可重试查看报表',async t=>{
  let fail=true
  const p=page(t,async path=>path.endsWith('/access')?access:{data:{total:0,rows:[]}},async()=>{if(fail)throw Error('登录中断')})
  await p.show();assert.equal(p.ready.value,true);assert.equal(p.error.value,'登录中断')
  fail=false;await p.boot();assert.equal(p.allowed.value,true);assert.equal(p.error.value,'')
})
