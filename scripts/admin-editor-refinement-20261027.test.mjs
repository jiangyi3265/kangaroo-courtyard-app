import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'
import * as interviewVideo from '../../RuoYi-Vue3/src/utils/interviewVideo.js'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const require = createRequire(path.join(root, 'RuoYi-Vue3/package.json'))
const vue = require('vue')
const tick = () => new Promise(resolve => setImmediate(resolve))
const deferred = () => { let resolve, reject; const promise = new Promise((a, b) => { resolve = a; reject = b }); return { promise, resolve, reject } }
const plain = v => JSON.parse(JSON.stringify(v))
function source(file) {
  return fs.readFileSync(path.join(root, 'RuoYi-Vue3/src/views/kangaroo', file), 'utf8')
    .match(/<script setup[^>]*>([\s\S]*?)<\/script>/)[1].replace(/^import .*\r?\n/gm, '').replaceAll('import.meta.env.VITE_APP_BASE_API', "'/dev-api'")
}
function base() {
  const reads = [], writes = [], validations = [], warnings = [], unmounts = []
  const proxy = { useDict: () => ({}), resetForm() {}, addDateRange: v => v,
    $refs: { jobRef: { validate: cb => validations.push(cb) }, formRef: { validate: cb => validations.push(cb) } },
    $auth: { hasPermi: () => true }, $modal: { msgSuccess() {}, msgWarning: v => warnings.push(v), msgError: v => warnings.push(v) } }
  const ctx = { ref: vue.ref, reactive: vue.reactive, computed: vue.computed, toRefs: vue.toRefs,
    onBeforeUnmount: cb => unmounts.push(cb), onMounted() {}, watch() {},
    window: { innerWidth: 1280 }, getCurrentInstance: () => ({ proxy }),
    listJob: async () => ({ rows: [], total: 0 }), listExt: async () => ({ rows: [], total: 0 }),
    listStoreOptions: async () => ({ rows: [] }), listStore: async () => ({ rows: [], total: 0 }),
    getJob: id => { const d = deferred(); reads.push({ id, ...d }); return d.promise },
    getExt: (_, id) => { const d = deferred(); reads.push({ id, ...d }); return d.promise },
    updateJob: body => { const d = deferred(); writes.push({ body: plain(body), ...d }); return d.promise },
    addJob: body => { const d = deferred(); writes.push({ body: plain(body), ...d }); return d.promise },
    updateExt: (_, body) => { const d = deferred(); writes.push({ body: plain(body), ...d }); return d.promise },
    addExt: (_, body) => { const d = deferred(); writes.push({ body: plain(body), ...d }); return d.promise },
    useRoute: () => ({ query: {} }), useRouter: () => ({}), useUserStore: () => ({}), useAppStore: () => ({ device: 'desktop' }),
    // 10-30 商家需求：job/index.vue 从 utils/merchantRequest 引 parseJobFocus、ExtCrud 用 defineEmits / defineExpose，这里的 import 被去掉了，要补上
    parseJobFocus: () => null, defineEmits: () => () => {}, defineExpose() {},
    // 10-31 换视频入口：这两个文件新引了提示文字和小判断（用真的那份）、门店列表权限判断、表单校验失败时滚到错误处（这几条用不到校验失败，给个空的）
    ...interviewVideo, nextTick: vue.nextTick, checkPermi: () => true, revealFirstFormError() {} }
  vm.createContext(ctx)
  return { ctx, reads, writes, validations, warnings, unmounts, run: s => vm.runInContext(s, ctx), proxy }
}
function jobHarness() {
  const h = base(); h.run(source('job/index.vue').replace(/getStoreOptions\(\)\s*getList\(\)\s*$/, ''))
  h.ready = id => { h.ctx.handleAdd(); h.run(`Object.assign(form.value, { jobId: ${id}, storeId: 102, jobType: 'parttime', imageList: '/profile/upload/photo.jpg', title: '岗位${id}' })`) }
  return h
}
function extHarness() {
  const h = base(); h.ctx.defineProps = () => ({ entity: 'stay' })
  h.run(source('ext/ExtCrud.vue'))
  h.run("meta.value = { pk: 'stayId', title: '房源', fields: [{name:'title',editable:true}, {name:'cover',editable:true}], actions: [] }")
  h.ready = async id => { await h.ctx.handleAdd(); h.run(`form.value = { stayId: ${id}, title: '房源${id}', cover: '/profile/upload/photo.jpg' }`) }
  return h
}

test('岗位旧读取晚到不能覆盖后打开的岗位', async () => {
  const h = jobHarness(); h.ctx.handleUpdate({ jobId: 1 }); h.ctx.handleUpdate({ jobId: 2 })
  h.reads[1].resolve({ data: { jobId: 2, title: '第二家', images: '[]' } }); await tick()
  h.reads[0].resolve({ data: { jobId: 1, title: '第一家', images: '[]' } }); await tick()
  assert.equal(h.run('form.value.jobId'), 2)
})
test('岗位旧读取不能覆盖刚打开的新建表单', async () => {
  const h = jobHarness(); h.ctx.handleUpdate({ jobId: 1 }); h.ctx.handleAdd(); h.run("form.value.title='正在新建'")
  h.reads[0].resolve({ data: { jobId: 1, title: '迟到的详情' } }); await tick()
  assert.equal(h.run('form.value.title'), '正在新建'); assert.equal(h.run('form.value.jobId'), undefined)
})
test('岗位异步校验完成前取消，再打开另一表单，不能替新表单提交', async () => {
  const h = jobHarness(); h.ready(1); h.ctx.submitForm(); h.ctx.cancel(); h.ready(2)
  const pending = h.validations[0](true); await tick(); const count = h.writes.length
  h.writes.forEach(w => w.resolve({})); await pending; assert.equal(count, 0)
})
test('岗位连续点击保存，两次校验同时通过只发一次写入', async () => {
  const h = jobHarness(); h.ready(1); h.ctx.submitForm(); h.ctx.submitForm()
  const pending = h.validations.map(cb => cb(true)); await tick(); assert.equal(h.writes.length, 1)
  h.writes.forEach(w => w.resolve({})); await Promise.all(pending)
})
test('岗位图片上传时阻止提交和关闭，结束后能保存', async () => {
  const h = jobHarness(); h.ready(1); h.run('jobImagesUploading.value = true')
  h.ctx.submitForm(); h.ctx.cancel(); assert.equal(h.validations.length, 0); assert.equal(h.run('open.value'), true)
  h.run('jobImagesUploading.value = false'); h.ctx.submitForm(); const pending = h.validations[0](true); await tick()
  assert.equal(h.writes.length, 1); h.writes[0].resolve({}); await pending
})
test('岗位保存期间不能取消/新开岗位，也不会受旧读取影响', async () => {
  const h = jobHarness(); h.ready(1); h.ctx.submitForm(); const pending = h.validations[0](true); await tick()
  h.ctx.cancel(); h.ctx.handleUpdate({jobId: 2}); h.ctx.handleAdd()
  assert.equal(h.run('open.value'), true); assert.equal(h.run('form.value.jobId'), 1); assert.equal(h.reads.length, 0)
  h.writes[0].resolve({}); await pending
})

async function sharedHarness() {
  const h = base(), confirmations = [], props = vue.reactive({ storeId: 102, busy: false }), videoUi = vue.reactive({ running: false })
  h.ctx.defineProps = () => props; h.ctx.defineEmits = () => () => {}; h.ctx.defineExpose = api => { h.api = api }
  h.ctx.watch = (get, cb, options) => { if (options?.immediate) cb() }
  h.ctx.useStoreInterviewVideo = () => ({ videoUi, cancelVideoUpload() { videoUi.running = false } })
  h.ctx.getStoreProfile = async id => ({ data: { storeId: id, interviewMode: 'online', interviewNote: '旧说明', facilities: [], inheritFacilities: false } })
  h.ctx.updateStoreProfile = (id, body) => { const d = deferred(); h.writes.push({ id, body: plain(body), ...d }); return d.promise }
  h.proxy.$modal.confirm = () => { const d = deferred(); confirmations.push(d); return d.promise }
  h.run(source('job/StoreDisplaySettings.vue')); await tick()
  return { ...h, confirmations, props, videoUi }
}
test('共用门店封面上传未完成，不能把旧封面当新配置保存', async () => {
  const h = await sharedHarness(); h.run("coverUploading.value = true; profile.value.interviewNote = '新说明'")
  await assert.rejects(h.api.saveIfDirty(), /封面|图片/); assert.equal(h.writes.length, 0)
  h.run('coverUploading.value = false'); const pending = h.api.saveIfDirty(); assert.equal(h.writes.length, 1)
  h.writes[0].resolve({}); assert.equal(await pending, true)
})
test('共用资料认证确认后若门店已改变，不能把旧店资料写给新店', async () => {
  const h = await sharedHarness(); h.run("profile.value.interviewMode = 'onsite'")
  const pending = h.api.saveIfDirty(); const rejection = assert.rejects(pending)
  h.props.storeId = 103; await h.ctx.load(); h.confirmations[0].resolve()
  await tick(); h.writes.forEach(w => w.resolve({})); await rejection; assert.equal(h.writes.length, 0)
})
test('共用资料确认框等待时卸载，不继续写入', async () => {
  const h = await sharedHarness(); h.run("profile.value.interviewMode = 'onsite'")
  const pending = h.api.saveIfDirty(); const rejection = assert.rejects(pending)
  h.unmounts.forEach(fn => fn()); h.confirmations[0].resolve()
  await tick(); h.writes.forEach(w => w.resolve({})); await rejection; assert.equal(h.writes.length, 0)
})

test('房源/横幅共用表单图片上传期间禁止保存和关闭', async () => {
  const h = extHarness(); await h.ready(1); h.run('imageBusy.cover = true')
  h.ctx.submitForm(); h.ctx.closeEditor(); assert.equal(h.validations.length, 0); assert.equal(h.run('open.value'), true)
  h.run('imageBusy.cover = false'); h.ctx.submitForm(); h.validations[0](true); await tick(); assert.equal(h.writes.length, 1)
  h.writes[0].resolve({}); await tick()
})
test('房源共用表单保存期间不能关闭或替换编辑对象', async () => {
  const h = extHarness(); await h.ready(1); h.ctx.submitForm(); h.validations[0](true)
  h.ctx.closeEditor(); await h.ctx.handleAdd(); await h.ctx.handleUpdate({ stayId: 2 })
  assert.equal(h.run('open.value'), true); assert.equal(h.run('form.value.stayId'), 1); assert.equal(h.reads.length, 0)
  h.writes[0].resolve({}); await tick()
})
test('房源共用表单旧详情响应不能覆盖新详情', async () => {
  const h = extHarness(); await h.ctx.handleUpdate({stayId: 1}); await h.ctx.handleUpdate({stayId: 2})
  h.reads[1].resolve({ data: { stayId: 2 } }); await tick(); h.reads[0].resolve({ data: {stayId: 1} }); await tick()
  assert.equal(h.run('form.value.stayId'), 2)
})
