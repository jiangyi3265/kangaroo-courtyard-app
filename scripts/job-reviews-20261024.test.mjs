import fs from 'node:fs'
import vm from 'node:vm'
import { createRequire } from 'node:module'
import test from 'node:test'
import assert from 'node:assert/strict'
const require = createRequire(import.meta.url), vue = require('vue'), compiler = require('@vue/compiler-sfc')
const read = rel => fs.readFileSync(new URL('../' + rel, import.meta.url), 'utf8')
const flush = () => new Promise(resolve => setImmediate(resolve))
const plain = v => JSON.parse(JSON.stringify(v))
function setup(rel, overrides = {}) {
  const sfc = compiler.parse(read(rel)).descriptor
  const ast = compiler.babelParse(sfc.scriptSetup.content, { sourceType: 'module' })
  const ctx = { console, ...vue, setTimeout() {}, uni: { stopPullDownRefresh() {} }, R: { review: '/pages/profile/review' } }
  for (const item of ast.program.body.filter(n => n.type === 'ImportDeclaration')) {
    for (const spec of item.specifiers) if (!(spec.local.name in ctx)) ctx[spec.local.name] = () => {}
  }
  Object.assign(ctx, { useScreen: () => vue.ref(1) }, overrides)
  vm.createContext(ctx)
  vm.runInContext(ast.program.body.filter(n => n.type !== 'ImportDeclaration').map(n => sfc.scriptSetup.content.slice(n.start,n.end)).join('\n'), ctx)
  return { run: code => vm.runInContext(code,ctx), template: sfc.template.content }
}
test('岗位评价提交四项、允许附图视频；住宿和活动仍为原五项', async () => {
  const submitted = [], toasts = []
  const h = setup('pages/profile/review.vue', { apiWriteReview: async b => { submitted.push(plain(b)); return {} }, toast: m => toasts.push(m) })
  h.run("target.value={bizType:'application',bizId:12}; resetQuestions('application')")
  assert.deepEqual(plain(h.run('questions.value.map(q=>q.short)')), ['位置','氛围','工作','吃住'])
  assert.equal(h.run('canPhoto.value'), true)
  await h.run('submitReview()'); assert.equal(submitted.length,0); assert.match(toasts[0],/第 1 项/)
  h.run("questions.value.forEach((q,i)=>{q.stars=i+2;q.text='实际体验'}); reviewPics.value=[{url:'/profile/upload/a.jpg'}]; reviewVideo.value={url:'/profile/upload/v.mp4',cover:''}")
  assert.equal(h.run('progress.value'),4)
  await h.run('submitReview()')
  assert.deepEqual(submitted[0].dims,[2,3,4,5]); assert.deepEqual(submitted[0].images,['/profile/upload/a.jpg']); assert.equal(submitted[0].videos.length,1)
  assert.match(h.template,/评价进度 \{\{ progress \}\}\/\{\{ questions.length \}\}/)
  h.run("target.value={bizType:'stay_order'}; resetQuestions('stay_order')"); assert.equal(h.run('questions.value.length'),5); assert.equal(h.run('canPhoto.value'),true)
  h.run("target.value={bizType:'activity_signup'}; resetQuestions('activity_signup')"); assert.equal(h.run('questions.value.length'),5); assert.equal(h.run('canPhoto.value'),false)
})
test('快速切换筛选只接受最后一次响应；翻页保留筛选和现有评价', async () => {
  let onLoad
  const waiting=[], calls=[]
  const h=setup('pages/jobs/reviews.vue', {
    useScreen: (n,opts)=>{onLoad=opts.onLoad;return vue.ref(1)},
    get:(url,args)=>{calls.push({url,args:plain(args)}); if(url.endsWith('/summary')) return Promise.resolve({data:{count:21,avg:4.5}}); return new Promise((resolve,reject)=>waiting.push({resolve,reject}))},
    errText:e=>e.message
  })
  onLoad({storeId:'102',filter:'换工'}); await flush()
  h.run("setTab('bad')"); assert.equal(waiting.length,2)
  waiting[1].resolve({data:{rows:[{reviewId:2,rating:1}],hasMore:true}}); await flush()
  waiting[0].resolve({data:{rows:[{reviewId:1,rating:5}],hasMore:false}}); await flush()
  assert.deepEqual(plain(h.run('rows.value.map(r=>r.reviewId)')),[2]); assert.equal(h.run('summary.value.count'),21)
  const promise=h.run('loadList(true)'); assert.equal(calls.at(-1).args.pageNum,2); assert.equal(calls.at(-1).args.tab,'bad'); assert.equal(calls.at(-1).args.filter,'换工')
  waiting[2].resolve({data:{rows:[{reviewId:3,rating:2}],hasMore:false}}); await promise
  assert.deepEqual(plain(h.run('rows.value.map(r=>r.reviewId)')),[2,3]); assert.equal(h.run('hasMore.value'),false)
})
test('筛选抽屉取消不修改条件，无效门店不发请求，无评分显示横线', async () => {
  let onLoad; const calls=[]
  const h=setup('pages/jobs/reviews.vue', {useScreen:(n,opts)=>{onLoad=opts.onLoad;return vue.ref(1)},get:async(...a)=>{calls.push(a);return {data:{}}}})
  onLoad({storeId:'0'}); await flush(); assert.equal(calls.length,0); assert.match(h.run('loadError.value'),/门店/)
  h.run("openFilter(); draftDays.value=30; draftSort.value='low'; panelOpen.value=false")
  assert.equal(h.run('days.value'),0); assert.equal(h.run('sort.value'),'latest'); assert.equal(h.run('score(null)'),'—')
  assert.deepEqual(plain(h.run('dimensions.value.map(d=>d.label)')),['位置','氛围','工作','吃住'])
})
