// 2026-10-31 详情页修复（小程序 2026.10.31.1）的回归（node --test，不构建、不发请求；真实界面另在模拟器验）：
//   · 岗位详情：模板用的 images 有定义；「共 N 张」不压 +N、没真实照片不显示；没拿到详情时有加载提示、约 8 秒提示网络慢、两个按钮不可点；
//     网络失败留在本页重试，岗位没了才退回；退回前看本页还在不在最上层；回到本页、响应作废时详情还空着就重读（先等账号恢复）。
//   · 房源详情：加载完之前不下「暂无家人评价」这类结论；详情失败有重试。
//   · 员工端「更多操作」：视频与生活碎片在第一项，按名字分派不受顺序影响。
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import test from 'node:test'
import assert from 'node:assert/strict'
import * as SP from '../pages/jobs/store-page.js'
import * as VP from '../pages/jobs/volunteer-presentation.js'
import * as stayUi from '../pages/stays/stays-ui.js'
import * as stayMedia from '../pages/stays/stays-media.js'
import * as stayAi from '../pages/stays/stays-ai-summary.js'

const app = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const require = createRequire(path.join(app, 'package.json'))
const compiler = require('@vue/compiler-sfc'), vue = require('vue')
const read = rel => fs.readFileSync(path.join(app, rel), 'utf8').replace(/\r\n/g, '\n')
const sfc = rel => compiler.parse(read(rel), { filename: rel }).descriptor
const noComments = t => t.replace(/<!--[\s\S]*?-->/g, '')
const flush = async () => { for (let i = 0; i < 6; i++) await new Promise(resolve => setImmediate(resolve)) }
const plain = v => JSON.parse(JSON.stringify(v))
const COVER_EMPTY = '/static/media/cover-empty.png'
const photo = i => `/profile/upload/2026/10/31/p${i}.jpg`
const apiError = (message, code) => Object.assign(new Error(message), { code })
const NETWORK = () => apiError('网络连接失败，请检查网络后重试', -1)
const JOB = { jobId: 7, jobType: 'volunteer', title: '南舍庄园', status: 'published', images: [photo(1), photo(2)], store: { storeId: 102 } }

// 手动拨动的定时器：8 秒、0.9 秒都不用真等
function fakeTimers() {
  let now = 0, seq = 0
  const timers = new Map()
  return {
    setTimeout: (fn, ms) => { timers.set(++seq, { fn, at: now + ms }); return seq },
    clearTimeout: id => { timers.delete(id) },
    tick: ms => {
      now += ms
      for (const [id, t] of [...timers].sort((a, b) => a[1].at - b[1].at)) {
        if (t.at <= now && timers.delete(id)) t.fn()
      }
    },
    pending: () => timers.size
  }
}

function runScript(rel, stubs, libs = {}) {
  const source = sfc(rel).scriptSetup.content
  const ast = compiler.babelParse(source, { sourceType: 'module' })
  const sandbox = { console }
  for (const n of ast.program.body.filter(n => n.type === 'ImportDeclaration')) {
    for (const s of n.specifiers) sandbox[s.local.name] = libs[n.source.value]?.[s.imported?.name] ?? (() => {})
  }
  Object.assign(sandbox, vue, stubs)
  vm.createContext(sandbox)
  const scope = vue.effectScope()
  const body = ast.program.body.filter(n => n.type !== 'ImportDeclaration').map(n => source.slice(n.start, n.end)).join('\n')
  scope.run(() => vm.runInContext(body, sandbox, { filename: rel + ':script-setup' }))
  return { sandbox, run: code => vm.runInContext(code, sandbox), stop: () => scope.stop() }
}

/** 岗位详情的脚本：页面生命周期都能手动触发 */
function jobPage({ detail = () => ({ data: plain(JOB) }), session = async () => {}, account = { id: 11 } } = {}) {
  const hooks = {}, log = { reads: 0, toasts: [], backs: 0, gone: [], sessions: 0 }
  const timers = fakeTimers()
  let revision = 0
  const h = runScript('pages/jobs/detail.vue', {
    setTimeout: timers.setTimeout, clearTimeout: timers.clearTimeout,
    useScreen: (_, opts) => { hooks.load = opts.onLoad; return vue.ref(1) },
    onShow: fn => { hooks.show = fn }, onHide: fn => { hooks.hide = fn }, onUnmounted: fn => { hooks.unmounted = fn },
    onJobFavoriteChange: () => () => {},
    experience: vue.reactive({ account }), getSessionRevision: () => revision,
    ensureSession: () => { log.sessions++; return session() },
    apiJobDetail: id => { log.reads++; return detail(id, log.reads) },
    apiJobTrainingBanner: async () => ({ data: null }),
    get: async () => ({ data: {} }), absUrl: x => String(x || ''),
    toast: m => log.toasts.push(m), back: () => { log.backs++ }, go: u => log.gone.push(u),
    R: { jobTeam: '/pages/jobs/team', jobApply: '/pages/jobs/apply', login: '/pages/auth/login' }
  }, { './store-page.js': SP, './volunteer-presentation.js': VP })
  const page = {
    ...h, hooks, log, timers,
    state: () => h.run('loadState.value'), error: () => h.run('loadError.value'), slow: () => h.run('slowHint.value'),
    detail: () => h.run('detail.value'),
    // 进页面：onLoad 紧跟 onShow，和框架顺序一样
    enter: async (q = { jobId: '7' }) => { hooks.load(q); hooks.show(); await flush() },
    bumpRevision: () => { revision++ },
    close: () => { hooks.unmounted(); h.stop() }
  }
  return page
}
const deferred = () => { let resolve, reject; const promise = new Promise((a, b) => { resolve = a; reject = b }); return { promise, resolve, reject } }

// ---------------------------------------------------------------- images 与「共 N 张」

test('模板第 54 行的 images 有定义：只数真实照片，占位封面不算；用的是和 parttimeModel 一样的判断', async t => {
  const script = sfc('pages/jobs/detail.vue').scriptSetup.content
  assert.match(script, /const images = computed\(\(\) => gallery\.value\.filter\(src => !src\.endsWith\('\/static\/media\/cover-empty\.png'\)\)\)/)
  assert.match(script, /gallery: gallery\.value\.filter\(src => !src\.endsWith\('\/static\/media\/cover-empty\.png'\)\)/)
  const cases = [
    [{ images: Array.from({ length: 9 }, (_, i) => photo(i)) }, 9, 3],
    [{ images: [photo(1), photo(2), photo(3)] }, 3, 0],
    [{ images: [photo(1)] }, 1, 0],
    [{ images: [], cover: '' }, 0, 0],
    [{ images: null, cover: photo(9) }, 1, 0] // 没传照片但有封面：封面是真图，算 1 张（线上 6 个岗位目前没有这种情况）
  ]
  for (const [fields, count, more] of cases) {
    const page = jobPage({ detail: () => ({ data: { ...JOB, ...fields } }) })
    t.after(page.stop)
    await page.enter()
    assert.equal(page.run('images.value.length'), count)
    assert.equal(page.run('heroGrid.value.more'), more)
  }
  assert.equal(COVER_EMPTY, '/static/media/cover-empty.png')
})

test('「共 N 张」：有 +N 那格时不显示，避免压住；没有真实照片时不显示', () => {
  const t = noComments(sfc('pages/jobs/detail.vue').template.content)
  assert.match(t, /<view v-if="images\.length && !heroGrid\.more" class="sp-hero__count" @click="previewHero\(0\)">共 \{\{ images\.length \}\} 张 · 查看照片<\/view>/)
  const { errors } = compiler.compileTemplate({ source: sfc('pages/jobs/detail.vue').template.content, filename: 'detail.vue', id: 'detail' })
  assert.deepEqual(errors, [])
})

// ---------------------------------------------------------------- 加载中

test('没拿到详情时显示「正在加载岗位信息…」，约 8 秒后提示网络慢，拿到后提示消失', async t => {
  const read1 = deferred()
  const page = jobPage({ detail: () => read1.promise })
  t.after(page.stop)
  await page.enter()
  assert.equal(page.detail(), null)
  assert.equal(page.state(), 'loading')
  assert.equal(page.slow(), false)
  page.timers.tick(7900)
  assert.equal(page.slow(), false)
  page.timers.tick(200)
  assert.equal(page.slow(), true)
  read1.resolve({ data: plain(JOB) })
  await flush()
  assert.equal(page.detail().jobId, 7)
  assert.equal(page.slow(), false)
  assert.equal(page.timers.pending(), 0, '定时器都收掉了')

  const tpl = noComments(sfc('pages/jobs/detail.vue').template.content)
  assert.match(tpl, /<view v-else-if="detail" class="sp"[^>]*>[\s\S]*<view v-else class="detail-state" role="status">/, '排在 isOnline、pt、detail 三个分支之后')
  assert.match(tpl, /<text class="detail-state__title">正在加载岗位信息…<\/text>/)
  assert.match(tpl, /<text v-if="slowHint" class="detail-state__text">网络有点慢[^<]*<\/text>/)
})

test('账号恢复慢时：提示从进页面就开始计时，详情请求等恢复完才发', async t => {
  const session = deferred()
  const page = jobPage({ session: () => session.promise })
  t.after(page.stop)
  await page.enter()
  assert.equal(page.log.reads, 0, '遵守「冷启动先恢复账号」')
  assert.equal(page.state(), 'loading')
  page.timers.tick(8000)
  assert.equal(page.slow(), true)
  session.resolve()
  await flush()
  assert.equal(page.log.reads, 1)
  assert.equal(page.detail().jobId, 7)
  assert.equal(page.slow(), false)
})

test('底部两个按钮没加载完时不可点；k-button 禁用时不发 click', async t => {
  const tpl = noComments(sfc('pages/jobs/detail.vue').template.content)
  assert.match(tpl, /<k-button block round type="outline" icon="user-round" :disabled="!detail" label="找人一起去" @click="openTeam" \/>/)
  assert.match(tpl, /<k-button block round :disabled="!detail \|\| !!applyBlockedText" :label="applyBlockedText \? blockedShort : isOnline \? '报名申请' : '立即报名'" @click="openApply" \/>/)
  assert.match(sfc('components/k-button/k-button.vue').scriptSetup.content, /const onClick = \(e\) => \{ if \(!props\.disabled\) emit\('click', e\) \}/)
})

// ---------------------------------------------------------------- 失败怎么走

test('网络失败留在本页：显示原因和重新加载，不提示不退回；点重新加载能恢复', async t => {
  const page = jobPage({ detail: (_, n) => { if (n === 1) throw NETWORK(); return { data: plain(JOB) } } })
  t.after(page.stop)
  await page.enter()
  assert.equal(page.state(), 'error')
  assert.equal(page.error(), '网络连接失败，请检查网络后重试')
  page.timers.tick(5000)
  assert.equal(page.log.backs, 0)
  assert.deepEqual(page.log.toasts, [])
  assert.equal(page.slow(), false)
  const retry = page.run('retryLoad()')
  assert.equal(page.state(), 'loading', '点了马上回到加载中')
  page.run('retryLoad()')
  await retry
  await flush()
  assert.equal(page.log.reads, 2, '连点只发一次')
  assert.equal(page.detail().jobId, 7)

  const tpl = noComments(sfc('pages/jobs/detail.vue').template.content)
  assert.match(tpl, /<template v-if="loadState === 'error'">[\s\S]*\{\{ loadError \}\}[\s\S]*@click="retryLoad"><text>重新加载<\/text>/)
})

test('不算岗位没了的失败都留在本页：网关错误页、服务端故障、请求超时', async t => {
  for (const e of [apiError('服务返回异常', -1), apiError('系统繁忙，请稍后再试', 500), apiError('request:fail timeout', -1), new Error('boom')]) {
    const page = jobPage({ detail: () => { throw e } })
    t.after(page.stop)
    await page.enter()
    page.timers.tick(2000)
    assert.equal(page.state(), 'error', e.message)
    assert.equal(page.error(), e.message)
    assert.equal(page.log.backs, 0, e.message)
  }
})

test('岗位不存在或已下架才沿用原来的提示后退回（约 0.9 秒）', async t => {
  const answers = [
    () => { throw apiError('岗位不存在或已下架', 500) }, // AppJobController：下架、门店停用
    () => { throw apiError('岗位不存在或已删除', 500) }, // KgJobServiceImpl.requireJob
    () => { throw apiError('请求参数类型不匹配', 400) }, // jobId 不是数字
    () => ({ data: null })
  ]
  for (const detail of answers) {
    const page = jobPage({ detail })
    t.after(page.stop)
    await page.enter()
    assert.equal(page.state(), 'gone')
    assert.deepEqual(page.log.toasts, ['岗位不存在或已下架'])
    assert.equal(page.log.backs, 0)
    page.timers.tick(899)
    assert.equal(page.log.backs, 0)
    page.timers.tick(2)
    assert.equal(page.log.backs, 1)
  }
  const missing = jobPage()
  t.after(missing.stop)
  await missing.enter({})
  assert.equal(missing.log.reads, 0)
  missing.timers.tick(1000)
  assert.equal(missing.log.backs, 1)
})

test('退回前本页已不在最上层：不弹掉报名页 / 同行页，回到本页时再读一次再决定', async t => {
  const page = jobPage({ detail: () => { throw apiError('岗位不存在或已下架', 500) } })
  t.after(page.stop)
  await page.enter()
  assert.deepEqual(page.log.toasts, ['岗位不存在或已下架'])
  // 提示已弹、还没退回时用户进了别的页
  page.hooks.hide()
  page.timers.tick(5000)
  assert.equal(page.log.backs, 0, '不能把别的页弹掉')
  // 回到本页：重读，确实没了才退回
  page.hooks.show()
  await flush()
  assert.equal(page.log.reads, 2)
  page.timers.tick(1000)
  assert.equal(page.log.backs, 1)
})

test('读取途中进了别的页，失败回来时不提示也不退回', async t => {
  const read1 = deferred()
  const page = jobPage({ detail: (_, n) => n === 1 ? read1.promise : { data: plain(JOB) } })
  t.after(page.stop)
  await page.enter()
  page.hooks.hide()
  read1.reject(apiError('岗位不存在或已下架', 500))
  await flush()
  page.timers.tick(5000)
  assert.deepEqual(page.log.toasts, [])
  assert.equal(page.log.backs, 0)
  page.hooks.show()
  await flush()
  assert.equal(page.detail().jobId, 7)
})

test('页面关掉以后：定时器收掉，不退回别的页，账号恢复后也不再发请求', async t => {
  const page = jobPage({ detail: () => { throw apiError('岗位不存在或已下架', 500) } })
  await page.enter()
  page.close()
  page.timers.tick(5000)
  assert.equal(page.log.backs, 0)
  assert.equal(page.timers.pending(), 0)

  const session = deferred()
  const waiting = jobPage({ session: () => session.promise })
  await waiting.enter()
  waiting.close()
  session.resolve()
  await flush()
  assert.equal(waiting.log.reads, 0)
  assert.equal(waiting.log.backs, 0)
})

test('已有内容时的后台刷新失败：只提示，内容留着，不进失败状态也不退回', async t => {
  const page = jobPage({ detail: (_, n) => { if (n === 2) throw NETWORK(); return { data: plain(JOB) } } })
  t.after(page.stop)
  await page.enter()
  page.hooks.hide()
  page.hooks.show()
  await flush()
  assert.equal(page.log.reads, 2)
  assert.equal(page.detail().jobId, 7)
  assert.deepEqual(page.log.toasts, ['网络连接失败，请检查网络后重试'])
  page.timers.tick(5000)
  assert.equal(page.log.backs, 0)
})

// ---------------------------------------------------------------- onShow 与作废响应

test('onShow：第一次不多发请求；之后详情还空着才重读，并且先等账号恢复', async t => {
  let release = null, sessions = 0
  const page = jobPage({
    detail: (_, n) => { if (n === 1) throw NETWORK(); return { data: plain(JOB) } },
    session: () => { sessions++; return sessions === 2 ? new Promise(resolve => { release = resolve }) : undefined }
  })
  t.after(page.stop)
  await page.enter()
  assert.equal(page.log.reads, 1, 'onLoad 紧跟的 onShow 不再发一次')
  assert.equal(page.state(), 'error')
  page.hooks.hide()
  page.hooks.show()
  assert.equal(page.state(), 'loading')
  await flush()
  assert.equal(page.log.reads, 1, '账号恢复完才发')
  release()
  await flush()
  assert.equal(page.log.reads, 2)
  assert.equal(page.detail().jobId, 7)
})

test('读取还在路上时回到本页：不再发一次，结果不被丢，慢网提示接着算', async t => {
  const reads = []
  const page = jobPage({ detail: () => { const d = deferred(); reads.push(d); return d.promise } })
  t.after(page.stop)
  await page.enter()
  assert.equal(reads.length, 1)
  page.timers.tick(8100)
  assert.equal(page.slow(), true)
  for (let i = 0; i < 3; i++) {
    page.hooks.hide()
    page.hooks.show()
    await flush()
  }
  assert.equal(reads.length, 1, '反复切换也只有第一次请求')
  assert.equal(page.log.sessions, 1, '也不用再等账号恢复')
  assert.equal(page.state(), 'loading')
  assert.equal(page.slow(), true, '已经显示的慢网提示不能被收掉')
  reads[0].resolve({ data: plain(JOB) })
  await flush()
  assert.equal(page.detail().jobId, 7, '第一次的结果直接用上')
  assert.equal(reads.length, 1)
  assert.equal(page.slow(), false)
  // 有内容以后回到本页照旧后台刷新
  page.hooks.hide()
  page.hooks.show()
  await flush()
  assert.equal(reads.length, 2)
})

test('读取在路上时回到本页，这次读取随后失败：显示失败和重试，再回到本页才重读', async t => {
  const reads = []
  const page = jobPage({ detail: () => { const d = deferred(); reads.push(d); return d.promise } })
  t.after(page.stop)
  await page.enter()
  page.hooks.hide()
  page.hooks.show()
  await flush()
  assert.equal(reads.length, 1)
  reads[0].reject(NETWORK())
  await flush()
  assert.equal(reads.length, 1)
  assert.equal(page.state(), 'error')
  assert.equal(page.error(), '网络连接失败，请检查网络后重试')
  page.hooks.hide()
  page.hooks.show()
  assert.equal(page.state(), 'loading')
  await flush()
  assert.equal(reads.length, 2, '路上已经没有请求了，要重读')
  reads[1].resolve({ data: plain(JOB) })
  await flush()
  assert.equal(page.detail().jobId, 7)
})

test('读取在路上时账号变了又回到本页：等旧响应回来判作废，只重读一次', async t => {
  const reads = []
  const page = jobPage({ detail: () => { const d = deferred(); reads.push(d); return d.promise } })
  t.after(page.stop)
  await page.enter()
  page.sandbox.experience.account = null
  page.hooks.hide()
  page.hooks.show()
  await flush()
  assert.equal(reads.length, 1)
  reads[0].resolve({ data: { ...JOB, title: '旧账号的响应' } })
  await flush()
  assert.equal(page.detail(), null)
  assert.equal(reads.length, 2)
  page.hooks.hide()
  page.hooks.show()
  await flush()
  assert.equal(reads.length, 2, '新的读取也在路上，不再发')
  reads[1].resolve({ data: { ...JOB, title: '当前账号的响应' } })
  await flush()
  assert.equal(page.detail().title, '当前账号的响应')
})

test('详情没到时「立即报名」的禁用样式不被棕底盖掉', () => {
  const premium = read('pages/jobs/detail-premium.scss')
  const brown = premium.indexOf('.detail-page .k-bottom :deep(.k-button.is-primary) {')
  const grey = premium.indexOf('.detail-page .k-bottom :deep(.k-button.is-primary.is-disabled) { background: #ECE5DC; color: #A39A92; box-shadow: none; }')
  assert.ok(brown >= 0 && grey > brown, '灰底规则要在棕底规则之后，选择器也更具体')
  // 版式自己的禁用色在 premium 之后，优先级也不低于它：换宿、兼职、全职的已满、已暂停不受影响
  assert.ok(premium.indexOf('.k-bottom :deep(.k-button.is-primary.is-disabled) { color: #A9A6A1;') > grey)
  const vue = read('pages/jobs/detail.vue')
  assert.ok(vue.indexOf('@import "detail-premium.scss"') < vue.indexOf('@import "detail-volunteer-reference.scss"'))
})

test('账号恢复还没好时切后台回来：恢复后只发一次请求', async t => {
  const session = deferred()
  const page = jobPage({ session: () => session.promise })
  t.after(page.stop)
  await page.enter()
  page.hooks.hide()
  page.hooks.show()
  await flush()
  assert.equal(page.log.reads, 0)
  session.resolve()
  await flush()
  assert.equal(page.log.reads, 1)
  assert.equal(page.detail().jobId, 7)
})

test('请求途中账号变了，响应作废：详情还空着就按新账号重读，不一直空白', async t => {
  const reads = []
  const page = jobPage({ detail: () => { const d = deferred(); reads.push(d); return d.promise } })
  t.after(page.stop)
  await page.enter()
  assert.equal(reads.length, 1)
  page.sandbox.experience.account = null // 同时发出的未读接口回 401，令牌被清
  reads[0].resolve({ data: { ...JOB, title: '旧账号的响应' } })
  await flush()
  assert.equal(page.detail(), null, '旧响应不能用')
  assert.equal(reads.length, 2, '自动重读')
  assert.equal(page.state(), 'loading')
  reads[1].resolve({ data: { ...JOB, title: '当前账号的响应' } })
  await flush()
  assert.equal(page.detail().title, '当前账号的响应')
})

test('只有会话版本变了（账号没变）的作废响应、以及作废的失败响应，同样重读', async t => {
  const reads = []
  const page = jobPage({ detail: () => { const d = deferred(); reads.push(d); return d.promise } })
  t.after(page.stop)
  await page.enter()
  page.bumpRevision()
  reads[0].reject(NETWORK())
  await flush()
  assert.equal(reads.length, 2)
  assert.equal(page.state(), 'loading', '旧请求的失败不能把新请求标成失败')
  assert.deepEqual(page.log.toasts, [])
  reads[1].resolve({ data: plain(JOB) })
  await flush()
  assert.equal(page.detail().jobId, 7)
})

test('作废的响应回来时已有更新的读取在路上：交给它，不再多发；页面关了也不再发', async t => {
  const reads = []
  const page = jobPage({ detail: () => { const d = deferred(); reads.push(d); return d.promise } })
  await page.enter()
  const newer = page.run('load()')
  assert.equal(reads.length, 2)
  reads[0].resolve({ data: { ...JOB, title: '旧' } })
  await flush()
  assert.equal(reads.length, 2)
  assert.equal(page.detail(), null)
  reads[1].resolve({ data: { ...JOB, title: '新' } })
  await newer
  assert.equal(page.detail().title, '新')
  page.stop()

  const reads2 = []
  const closing = jobPage({ detail: () => { const d = deferred(); reads2.push(d); return d.promise } })
  await closing.enter()
  closing.close()
  reads2[0].resolve({ data: plain(JOB) })
  await flush()
  assert.equal(reads2.length, 1)
})

// ---------------------------------------------------------------- 房源详情

function stayPage({ detail = async () => ({ data: { stayId: 6, stayName: '平潭袋鼠小院' } }) } = {}) {
  const hooks = { show: [] }, log = { toasts: [], reads: 0, normalized: 0 }
  const h = runScript('pages/stays/detail.vue', {
    useScreen: (_, opts) => { hooks.load = opts.onLoad; return vue.ref(1) },
    onShow: fn => hooks.show.push(fn), onHide() {}, onPageScroll() {}, onShareAppMessage() {}, onShareTimeline() {},
    uni: { getSystemInfoSync: () => ({ statusBarHeight: 20 }) },
    apiStayDetail: (...args) => { log.reads++; return detail(...args, log.reads) },
    apiStayVlogs: async () => ({ data: [] }), apiStayRoomTypes: async () => ({ data: [] }),
    toast: m => log.toasts.push(m), errText: (e, dft) => (e && e.message) || dft, yuan: x => String(x), absUrl: x => String(x || ''),
    stayState: vue.reactive({ checkIn: '2026-11-01', checkOut: '2026-11-02', guests: 1 }), normalizeDates() { log.normalized++ }, todayCn: () => '2026-10-31', shiftDate: x => x,
    dotText: x => x, nightsBetween: () => 1, STAY_ART: {}, R: { stayBooking: '/pages/stays/booking' }
  }, { './stays-ui.js': stayUi, './stays-media.js': stayMedia, './stays-ai-summary.js': { stayAiSummary: stayAi.stayAiSummary } })
  return {
    ...h, log, hooks, normalized: () => log.normalized,
    open: async (q = { stayId: '6' }) => { hooks.load(q); hooks.show.forEach(fn => fn()); await flush() },
    val: expr => plain(h.run(expr))
  }
}

test('房源详情：加载完之前不下结论，加载完才说「暂无家人评价」', async t => {
  const read1 = deferred()
  const page = stayPage({ detail: () => read1.promise })
  t.after(page.stop)
  await page.open()
  assert.equal(page.val('stayLoaded.value'), false)
  assert.equal(page.val('ratingSub.value'), '')
  assert.equal(page.val('reviewEntryText.value'), '正在加载评价…')
  assert.equal(page.val('goodRateText.value'), '')
  assert.equal(page.normalized(), 1, '详情还没读到时日期已补好，不写「0晚」')
  read1.resolve({ data: { stayId: 6, stayName: '平潭袋鼠小院' } })
  await flush()
  assert.equal(page.val('stayLoaded.value'), true)
  assert.equal(page.val('ratingSub.value'), '暂无家人评价')
  assert.equal(page.val('reviewEntryText.value'), '暂无家人评价')
  assert.equal(page.val('goodRateText.value'), '暂无足够评价')
})

test('房源详情模板：结论性文字都要等 stayLoaded；入口结构没动', () => {
  const t = noComments(sfc('pages/stays/detail.vue').template.content)
  assert.match(t, /<view v-else-if="stayLoaded" class="sec-card vcard vcard--pending">[\s\S]*主理人尚未上传小院视频/)
  assert.match(t, /<view v-else-if="stayLoaded" class="sec-card host2 host2--pending">[\s\S]*主理人介绍待补充/)
  assert.match(t, /<text v-if="stayLoaded && !travel\.length" class="section-pending">出行资料待主理人补充/)
  assert.match(t, /\{\{ stayLoaded \? \(reviewAi\.ready \? 'AI综合评分' : \(ratingMain \? '住客评分' : '暂无家人评价'\)\) : \(loadError \? '未加载' : '正在加载'\) \}\}/)
  assert.match(t, /<text v-if="stayLoaded && !vlogs\.length" class="list-empty">暂无Vlog<\/text>/)
  assert.match(t, /\{\{ rv \? rv\.content : \(stayLoaded \? '暂无住客评价' : ''\) \}\}/)
  assert.match(t, /\{\{ d\.stayName \|\| loadError \|\| '正在加载小院信息…' \}\}/)
  assert.match(t, /<view class="entries">/)
  assert.match(t, /@click="openReviews">\s*<view class="entry__score"/)
  assert.match(t, /<view class="entry entry--diary" hover-class="k-press-s" @click="openDiary">/)
  // 没加载完底部预订栏本来就不出，保留
  assert.match(t, /<view v-if="s < 4 && d\.stayName && !loadError" class="stay-booking-dock">/)
})

test('房源详情失败：留在本页显示原因，点重新加载能恢复；断网之后回来也恢复', async t => {
  const page = stayPage({ detail: async (_, n) => { if (n === 1) throw NETWORK(); return { data: { stayId: 6, stayName: '平潭袋鼠小院' } } } })
  t.after(page.stop)
  await page.open()
  assert.equal(page.val('loadError.value'), '网络连接失败，请检查网络后重试')
  assert.equal(page.val('canRetryDetail.value'), true)
  assert.equal(page.val('stayLoaded.value'), false)
  assert.equal(page.val('ratingSub.value'), '', '读失败也不能说没有评价')
  assert.equal(page.val('reviewEntryText.value'), '评价暂未加载', '读失败也不能说还在加载')
  const t2 = noComments(sfc('pages/stays/detail.vue').template.content)
  assert.match(t2, /<view v-if="loadError && canRetryDetail" class="rooms-state rooms-state--error detail-retry" role="status">[\s\S]*?@click="retryDetail"/)
  page.run('retryDetail()')
  await flush()
  assert.equal(page.log.reads, 2)
  assert.equal(page.val('loadError.value'), '')
  assert.equal(page.val('canRetryDetail.value'), false)
  assert.equal(page.val('d.value.stayName'), '平潭袋鼠小院')
})

test('房源详情：房源真没了不给重试；已有内容时刷新失败也给重试；旧响应不覆盖新结果', async t => {
  const gone = stayPage({ detail: async () => { throw apiError('房源不存在或已下架', 500) } })
  t.after(gone.stop)
  await gone.open()
  assert.equal(gone.val('canRetryDetail.value'), false)
  assert.equal(gone.val('loadError.value'), '房源不存在或已下架')

  const empty = stayPage({ detail: async () => ({ data: null }) })
  t.after(empty.stop)
  await empty.open()
  assert.equal(empty.val('loadError.value'), '房源不存在或已下架')
  assert.equal(empty.val('stayLoaded.value'), false)

  const noId = stayPage()
  t.after(noId.stop)
  await noId.open({})
  assert.equal(noId.log.reads, 0)
  assert.equal(noId.val('canRetryDetail.value'), false)

  const reads = []
  const page = stayPage({ detail: () => { const d = deferred(); reads.push(d); return d.promise } })
  t.after(page.stop)
  await page.open()
  reads[0].resolve({ data: { stayId: 6, stayName: '第一次' } })
  await flush()
  page.hooks.show.forEach(fn => fn())
  page.hooks.show.forEach(fn => fn())
  reads[2].resolve({ data: { stayId: 6, stayName: '第三次' } })
  await flush()
  reads[1].reject(NETWORK())
  await flush()
  assert.equal(page.val('d.value.stayName'), '第三次')
  assert.equal(page.val('loadError.value'), '')
  page.hooks.show.forEach(fn => fn())
  reads[3].reject(NETWORK())
  await flush()
  assert.equal(page.val('d.value.stayName'), '第三次', '内容留着')
  assert.equal(page.val('canRetryDetail.value'), true)
})

// ---------------------------------------------------------------- 员工端「更多操作」

function moreActions(picked) {
  const source = sfc('pages/staff/rooms.vue').scriptSetup.content
  const start = source.indexOf('async function moreActions(r) {')
  const end = source.indexOf('\n}\n', start)
  const log = { labels: null, calls: [] }
  const spy = name => async (...args) => { log.calls.push([name, ...args]); return { msg: 'ok', data: { url: 'u' } } }
  const names = ['setStayLocation', 'apiStaffSubmitStay', 'manageRoomTypes', 'openMedia', 'apiStaffOfflineStay', 'chooseImage', 'uploadTo', 'apiStaffEditStay', 'apiStaffStayGroup', 'pickDate', 'openStay', 'prompt', 'load', 'loadList', 'loadRows', 'reloadList', 'refresh', 'errText']
  // 2026-11-03 简化：只剩 4 项，一个系统菜单（sheet）放得下，不再翻页（pickPaged）
  const fn = new Function(...names, 'toast', 'sheet', 'shiftDate', 'todayCn', 'return ' + source.slice(start, end + 2))(
    ...names.map(spy), () => {}, async labels => { log.labels = [...labels]; return picked(labels) }, x => x, () => '2026-10-31')
  return { fn, log }
}

test('更多操作：任何状态下第一项都是「视频与生活碎片」；2026-11-03 简化后只剩 4 项，和状态无关', async () => {
  // 「提交审核 / 下架」做成卡片上的第四个按钮（statusAction），「编辑商圈与位置」「更换封面」并进编辑表单，「设置地图位置」表单里本来就有（地图选点）
  const labels = ['视频与生活碎片', '住客群码', '资质上传与审核', '上传 Vlog']
  for (const rawStatus of ['online', 'draft', 'rejected', 'offline', 'pending']) {
    const { fn, log } = moreActions(() => -1)
    await fn({ stayId: 6, rawStatus })
    assert.deepEqual(log.labels, labels, rawStatus)
    assert.equal(log.calls.length, 0, '取消什么都不做')
  }
})

test('更多操作：每一项仍然走到自己的动作；提交审核 / 下架改走卡片按钮 statusAction', async () => {
  const pick = async (rawStatus, label) => {
    const { fn, log } = moreActions(labels => labels.indexOf(label))
    await fn({ stayId: 6, rawStatus })
    return log.calls
  }
  assert.deepEqual(await pick('online', '视频与生活碎片'), [['openMedia', 6]])
  assert.deepEqual(await pick('draft', '视频与生活碎片'), [['openMedia', 6]])
  assert.deepEqual(await pick('online', '资质上传与审核'), [['openStay', 6, 3]])
  assert.deepEqual(await pick('online', '上传 Vlog'), [['openStay', 6, 4]])
  const source = sfc('pages/staff/rooms.vue').scriptSetup.content
  assert.doesNotMatch(source, /'设置地图位置'|'更换封面'|'编辑商圈与位置'|acts\.splice\(/, '这些都不在「更多」里了')
  assert.match(source, /function statusAction\(r\) \{\n\s*if \(r\.rawStatus === 'online'\) \{ offlineBox\.value = \{ stayId: r\.stayId, reason: '' \}; return \}\n\s*return openStay\(r\.stayId, 3\)/)
})

// ---------------------------------------------------------------- 版本号

test('当前版本格式有效；服务端切换门槛没动，新版本过得了门槛', () => {
  const config = read('common/config.js')
  const version = /export const APP_VERSION = '(\d{4}\.\d{2}\.\d{2}\.\d+)'/.exec(config)?.[1]
  assert.ok(version, '当前发布版本必须使用日期与递增构建号')
  const java = read('../RuoYi-Vue/ruoyi-kangaroo/src/main/java/com/ruoyi/kangaroo/ext/staff/KgRoleSwitchService.java')
  const min = /MIN_CLIENT_VERSION\s*=\s*"([^"]+)"/.exec(java)[1]
  assert.equal(min, '2026.10.30.2')
  const parts = v => v.split('.').map(Number)
  const [a, b] = [parts(version), parts(min)], first = a.findIndex((x, i) => x !== b[i])
  assert.ok(first === -1 || a[first] > b[first], '按段比数字，当前版本达到服务端最低门槛')
})
