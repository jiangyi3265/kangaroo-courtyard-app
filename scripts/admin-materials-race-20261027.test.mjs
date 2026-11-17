import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import { fileURLToPath } from 'node:url'
import { videoChanged, interviewVideoBody, videoHiddenByMode, VIDEO_UNSAVED_CONFIRM, VIDEO_HIDDEN_CONFIRM } from '../../RuoYi-Vue3/src/utils/interviewVideo.js'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const tick = () => new Promise(resolve => setImmediate(resolve))
const deferred = () => { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no }); return { promise, resolve, reject } }
const storeSource = fs.readFileSync(path.join(root, 'RuoYi-Vue3/src/views/kangaroo/store/index.vue'), 'utf8').replace(/\r\n/g, '\n')
const profileStart = storeSource.indexOf('const canCert =')
const profileEnd = storeSource.indexOf('\ngetList()\n', profileStart)
assert(profileStart >= 0 && profileEnd > profileStart, 'profile harness boundaries must match the script')
const storeScript = storeSource.slice(profileStart, profileEnd)

function storeHarness() {
  const reads = [], writes = [], confirmations = [], warnings = [], successes = []
  let canceled = 0
  const videoUi = { running: false }
  const ctx = {
    ref: value => ({ value }), computed: get => ({ get value() { return typeof get === 'function' ? get() : get.get() } }),
    proxy: { $auth: { hasPermi: () => true }, $modal: {
      msgWarning: m => warnings.push(m), msgError: m => warnings.push(m), msgSuccess: m => successes.push(m),
      confirm: () => { const d = deferred(); confirmations.push(d); return d.promise }
    } }, DEFAULT_NOTES: {},
    getStoreProfile: id => { const d = deferred(); reads.push({ id, ...d }); return d.promise },
    updateStoreProfile: (id, body) => { const d = deferred(); writes.push({ id, body, ...d }); return d.promise },
    useStoreInterviewVideo: () => ({ videoUi, cancelVideoUpload() { canceled++; videoUi.running = false } }),
    videoChanged, interviewVideoBody, videoHiddenByMode, VIDEO_UNSAVED_CONFIRM, VIDEO_HIDDEN_CONFIRM,
    getList() {}
  }
  vm.createContext(ctx); vm.runInContext(storeScript, ctx)
  const run = text => vm.runInContext(text, ctx)
  const open = async id => {
    ctx.handleProfile({ storeId: id, storeName: '门店' + id })
    reads.at(-1).resolve({ data: { managerName: '原店长', facilities: [] } }); await tick()
  }
  return { ctx, run, open, reads, writes, confirmations, warnings, successes, videoUi, get canceled() { return canceled } }
}

test('门店同ID重新打开，旧读取响应不能覆盖当前编辑', async () => {
  const h = storeHarness()
  h.ctx.handleProfile({ storeId: 101 }); h.ctx.closeProfile()
  await h.open(101)
  h.run("profile.value.managerName = '正在编辑'")
  h.reads[0].resolve({ data: { managerName: '迟到的旧数据' } }); await tick()
  assert.equal(h.run('profile.value.managerName'), '正在编辑')
  assert.equal(h.run('profileOpen.value'), true)
})

test('旧读取失败不关闭重开弹窗，也不提前解除新请求的加载状态', async () => {
  const h = storeHarness()
  h.ctx.handleProfile({ storeId: 101 }); h.ctx.closeProfile(); h.ctx.handleProfile({ storeId: 101 })
  h.reads[0].reject(new Error('old failure')); await tick()
  assert.equal(h.run('profileOpen.value'), true)
  assert.equal(h.run('profileLoading.value'), true)
  h.reads[1].resolve({ data: {} }); await tick()
  assert.equal(h.run('profileLoading.value'), false)
})

test('保存期间不能关闭/切门店，重复提交只有一个请求', async () => {
  const h = storeHarness(); await h.open(101)
  const saving = h.ctx.submitProfile(); await tick()
  h.ctx.closeProfile(); h.ctx.handleProfile({ storeId: 102 }); await h.ctx.submitProfile()
  assert.equal(h.run('profileOpen.value'), true)
  assert.equal(h.run('profile.value.storeId'), 101)
  assert.equal(h.writes.length, 1)
  h.writes[0].resolve({ code: 200 }); await saving
  assert.equal(h.run('profileOpen.value'), false)
  assert.equal(h.run('profileSaving.value'), false)
})

test('即使旧保存返回时会话已替换，也不能关闭新门店', async () => {
  const h = storeHarness(); await h.open(101)
  const saving = h.ctx.submitProfile(); await tick()
  h.run('profileSession.value++;profile.value={storeId:102};profileSaving.value=false')
  h.writes[0].resolve({ code: 200 }); await saving
  assert.equal(h.run('profileOpen.value'), true)
  assert.equal(h.successes.length, 0)
})

test('保存失败保留当前输入并允许重试', async () => {
  const h = storeHarness(); await h.open(101)
  h.run("profile.value.managerName='待保存的店长'")
  const saving = h.ctx.submitProfile(); h.writes[0].reject(new Error('network')); await saving
  assert.equal(h.run('profileOpen.value'), true)
  assert.equal(h.run('profileSaving.value'), false)
  assert.equal(h.run('profile.value.managerName'), '待保存的店长')
  const retry = h.ctx.submitProfile(); assert.equal(h.writes.length, 2)
  h.writes[1].resolve({ code: 200 }); await retry
})

test('认证确认期间锁定会话，取消确认后不发送保存', async () => {
  const h = storeHarness(); await h.open(101); h.run("profile.value.interviewMode='onsite'")
  const saving = h.ctx.submitProfile(); h.ctx.closeProfile(); h.ctx.handleProfile({ storeId: 102 })
  assert.equal(h.run('profile.value.storeId'), 101)
  assert.equal(h.run('profileOpen.value'), true)
  h.confirmations[0].reject(new Error('cancel')); await saving
  assert.equal(h.writes.length, 0)
  assert.equal(h.run('profileSaving.value'), false)
})

test('图片上传期间不能保存或关闭，上传失败结束后可继续编辑', async () => {
  const h = storeHarness(); await h.open(101)
  h.ctx.setProfileImageBusy('licenseImage', true)
  await h.ctx.submitProfile(); h.ctx.closeProfile(); h.ctx.handleProfile({ storeId: 102 })
  assert.equal(h.run('profileOpen.value'), true); assert.equal(h.writes.length, 0)
  assert.equal(h.run('profile.value.storeId'), 101)
  h.ctx.setProfileImageBusy('licenseImage', false); h.ctx.closeProfile()
  assert.equal(h.run('profileOpen.value'), false)
})

test('关闭视频上传先确认，取消确认保留任务，确认后仅取消当前任务', async () => {
  const h = storeHarness(); await h.open(101); h.videoUi.running = true
  const before = h.canceled
  h.ctx.closeProfile(); h.confirmations[0].reject(new Error('cancel')); await tick()
  assert.equal(h.videoUi.running, true); assert.equal(h.canceled, before)
  h.ctx.closeProfile(); h.confirmations[1].resolve(); await tick()
  assert.equal(h.videoUi.running, false); assert.equal(h.canceled, before + 1)
  assert.equal(h.run('profileOpen.value'), false)
})

function uploadHarness(kind) {
  const source = fs.readFileSync(path.join(root, 'RuoYi-Vue3/src/components/' + kind + 'Upload/index.vue'), 'utf8')
  const script = source.match(/<script setup>([\s\S]*?)<\/script>/)[1].replace(/^import .*\r?\n/gm, '').replaceAll('import.meta.env.VITE_APP_BASE_API', "'/api'")
  const events = [], errors = [], cleanup = []
  const props = { modelValue: '', action: '/common/upload', fileType: kind === 'Image' ? ['jpg'] : ['pdf'], fileSize: 5, limit: 9, isShowTip: true, disabled: false, drag: false }
  let aborted = 0, closed = 0
  const ctx = {
    defineProps: () => props, defineEmits: () => (...args) => events.push(args),
    ref: value => ({ value }), computed: fn => ({ get value() { return fn() } }),
    watch: (get, cb) => cb(get()), onMounted() {}, onBeforeUnmount: fn => cleanup.push(fn),
    getToken: () => 'test', isExternal: value => value.startsWith('http'), imageUrl: value => value, imagePath: value => value,
    getCurrentInstance: () => ({ proxy: { $modal: { loading() {}, closeLoading() { closed++ }, msgError: m => errors.push(m) },
      $refs: { [kind === 'Image' ? 'imageUpload' : 'fileUpload']: { handleRemove: file => ctx.handleUploadRemove(file), abort() { aborted++ } } } } })
  }
  vm.createContext(ctx); vm.runInContext(script, ctx)
  return { ctx, events, errors, cleanup, run: text => vm.runInContext(text, ctx),
    file: uid => ({ uid, name: `${uid}.${kind === 'Image' ? 'jpg' : 'pdf'}`, size: 100, type: kind === 'Image' ? 'image/jpeg' : 'application/pdf' }),
    values: () => events.filter(e => e[0] === 'update:modelValue').map(e => e[1]),
    get aborted() { return aborted }, get closed() { return closed } }
}

for (const kind of ['Image', 'File']) {
  test(`${kind}Upload: 网络失败后重试成功写回表单`, () => {
    const h = uploadHarness(kind), a = h.file(1), b = h.file(2)
    h.ctx.handleBeforeUpload(a); h.ctx.handleUploadError(new Error('network'), a)
    assert.equal(h.run('pendingUploads.size'), 0); assert.equal(h.values().length, 0)
    h.ctx.handleBeforeUpload(b); h.ctx.handleUploadSuccess({ code: 200, fileName: '/profile/upload/retry.jpg' }, b)
    assert.deepEqual(h.values(), ['/profile/upload/retry.jpg'])
    assert.equal(h.errors.length, 1)
  })
  for (const errorFirst of [true, false]) test(`${kind}Upload: 多文件部分失败，成功文件仍保存（失败${errorFirst ? '先' : '后'}返回）`, () => {
    const h = uploadHarness(kind), a = h.file(1), b = h.file(2)
    h.ctx.handleBeforeUpload(a); h.ctx.handleBeforeUpload(b)
    const good = () => h.ctx.handleUploadSuccess({ code: 200, fileName: '/profile/upload/good.jpg' }, a)
    const bad = () => h.ctx.handleUploadError(new Error('network'), b)
    if (errorFirst) { bad(); good() } else { good(); bad() }
    assert.deepEqual(h.values(), ['/profile/upload/good.jpg'])
    assert.equal(h.run('pendingUploads.size'), 0)
  })
  test(`${kind}Upload: 取消/重复回调不重复计数，也不写回已取消文件`, () => {
    const h = uploadHarness(kind), a = h.file(1), b = h.file(2)
    h.ctx.handleBeforeUpload(a); h.ctx.handleBeforeUpload(b)
    h.ctx.handleUploadRemove(a)
    h.ctx.handleUploadSuccess({ code: 200, fileName: '/profile/upload/canceled.jpg' }, a)
    h.ctx.handleUploadSuccess({ code: 200, fileName: '/profile/upload/good.jpg' }, b)
    h.ctx.handleUploadSuccess({ code: 200, fileName: '/profile/upload/good.jpg' }, b)
    h.ctx.handleUploadError(new Error('late'), b)
    assert.deepEqual(h.values(), ['/profile/upload/good.jpg'])
    assert.equal(h.run('pendingUploads.size'), 0); assert.equal(h.errors.length, 0)
  })
  test(`${kind}Upload: 业务失败及缺少上传路径不能写入表单，后续上传仍可成功`, () => {
    const h = uploadHarness(kind), a = h.file(1), b = h.file(2), c = h.file(3)
    h.ctx.handleBeforeUpload(a); h.ctx.handleUploadSuccess({ code: 500, msg: 'failed' }, a)
    h.ctx.handleBeforeUpload(b); h.ctx.handleUploadSuccess({ code: 200 }, b)
    assert.equal(h.values().length, 0)
    h.ctx.handleBeforeUpload(c); h.ctx.handleUploadSuccess({ code: 200, fileName: '/profile/upload/valid.jpg' }, c)
    assert.deepEqual(h.values(), ['/profile/upload/valid.jpg']); assert.equal(h.errors.length, 2)
  })
  test(`${kind}Upload: 卸载中止在途上传，迟到回调不污染下一份表单`, () => {
    const h = uploadHarness(kind), a = h.file(1)
    h.ctx.handleBeforeUpload(a); h.cleanup.forEach(fn => fn())
    h.ctx.handleUploadSuccess({ code: 200, fileName: '/profile/upload/stale.jpg' }, a)
    assert.equal(h.aborted, 1); assert.equal(h.values().length, 0)
    assert.equal(h.run('pendingUploads.size'), 0)
  })
}
