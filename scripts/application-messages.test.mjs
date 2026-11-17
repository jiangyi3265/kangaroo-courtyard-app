import fs from 'node:fs'
import vm from 'node:vm'
import { createRequire } from 'node:module'
import test from 'node:test'
import assert from 'node:assert/strict'
import * as helpers from '../pages/jobs/application-messages.js'
const require = createRequire(import.meta.url), compiler = require('@vue/compiler-sfc'), vue = require('vue')
const tick = () => new Promise(resolve => setImmediate(resolve))
const message = (id, extra = {}) => ({ id, bizType: 'application', bizId: 81, read: false, title: '报名通知', content: '门店已确认录用', ...extra })
function harness(widget = false) {
  const src = compiler.parse(fs.readFileSync(new URL(widget ? '../pages/jobs/components/application-messages.vue' : '../pages/jobs/notices.vue', import.meta.url), 'utf8')).descriptor.scriptSetup.content
  const ast = compiler.babelParse(src, { sourceType: 'module' })
  const code = ast.program.body.filter(n => n.type !== 'ImportDeclaration').map(n => src.slice(n.start, n.end)).join('\n')
  const hooks = {}, log = { requests: [], read: [], routes: [], unread: 0 }, state = { data: { appId: 81, rows: [message(103), message(102)], store: { id: 90, bizId: 91, bizType: 'chat_conv', content: '欢迎你来', read: false }, unread: 2, hasMore: false, nextBefore: 102 }, fail: false, readFail: false, updated: 1, pending: null }
  const experience = vue.reactive({ account: { id: 7 } }), props = vue.reactive({ appId: 81, storeName: '平潭小院' })
  const context = vm.createContext({ ...helpers, ...vue, experience, console, Set, getToken: () => state.token || 'fixture', getSessionRevision: () => state.session || 1,
    defineProps: () => props, defineEmits: () => (_, url) => log.routes.push(url),
    onShow: fn => hooks.show = fn, onHide: fn => hooks.hide = fn, onUnload: fn => hooks.unload = fn, onUnmounted: fn => hooks.unload = fn,
    onPullDownRefresh: fn => hooks.pull = fn, onReachBottom: fn => hooks.bottom = fn,
    useScreen: (_, opts) => hooks.load = opts.onLoad, setInterval: fn => { hooks.poll = fn; return 1 }, clearInterval: () => {},
    ensureSession: async () => {}, errText: (e, d) => e?.message || d, refreshUnread: async () => { log.unread++ },
    apiApplicationMessages: async (id, params) => { log.requests.push({ id, params }); if (state.pending) return state.pending; if (state.fail) throw new Error('加载失败'); return { data: structuredClone(state.data) } },
    apiMarkRead: async id => { log.read.push(id); if (state.readFail) throw new Error('断网'); return { data: { updated: state.updated } } },
    R: { chat: '/chat', jobNotices: '/notices' }, go: url => log.routes.push(url), uni: { stopPullDownRefresh() {} }
  })
  const scope = vue.effectScope(); scope.run(() => vm.runInContext(code, context))
  return { log, state, experience, props, hooks, run: s => vm.runInContext(s, context), stop: () => { hooks.unload?.(); scope.stop() }, open: async (q = { appId: '81' }) => { hooks.load?.(q); hooks.show?.(); await tick() } }
}
test('报名通知拒绝错位响应，过滤其他业务与其他报名，保留真实内容', () => {
  assert.throws(() => helpers.applicationMessages({ appId: 82 }, 81))
  const data = helpers.applicationMessages({ appId: 81, rows: [message(1), message(2, { bizId: 82 }), message(3, { bizType: 'stay_order' }), message(0), null] }, 81)
  assert.deepEqual(data.rows.map(m => m.id), [1]); assert.equal(data.store, null)
  assert.equal(helpers.messageTime('bad date'), '')
})
test('预览只读，商家和系统分别导航到正确报名，返回刷新', async () => {
  const h = harness(true); await h.open()
  assert.equal(h.run('latest.value.id'), 103); assert.deepEqual(h.log.read, [])
  h.run('openStore(); openNotices()'); assert.deepEqual(h.log.routes, ['/chat?appId=81', '/notices?appId=81&messageId=103'])
  h.hooks.hide(); h.state.data.unread = 0; h.hooks.show(); await tick(); assert.equal(h.run('data.value.unread'), 0); h.stop()
})
test('可见时轮询；隐藏与账户切换丢弃迟到的私有消息', async () => {
  const h = harness(true); await h.open(); const count = h.log.requests.length
  h.hooks.poll(); await tick(); assert.equal(h.log.requests.length, count + 1)
  let resolve; h.state.pending = new Promise(r => resolve = r); h.hooks.poll(); h.hooks.hide();
  resolve({ data: { ...h.state.data, unread: 99 } }); await tick(); assert.notEqual(h.run('data.value.unread'), 99)
  h.state.pending = null; h.hooks.show(); await tick()
  h.state.fail = true; h.experience.account = { id: 8 }; await tick(); assert.equal(h.run('data.value'), null); h.stop()
})
test('无消息与请求失败分开；失败可重试且不写入已读', async () => {
  const h = harness(true); await h.open(); h.state.fail = true; await h.run('load()'); assert.match(h.run('error.value'), /加载失败/)
  h.state.fail = false; h.state.data.rows = []; h.state.data.store = null; await h.run('load()')
  assert.equal(h.run('error.value'), ''); assert.equal(h.run('latest.value'), undefined); assert.deepEqual(h.log.read, []); h.stop()
})
test('通知列表只在打开对应通知时标记已读；从摘要进入仅读指定一条', async () => {
  const h = harness(); await h.open({ appId: '81', messageId: '103' })
  assert.deepEqual(h.log.read, [103]); assert.equal(h.run('rows.value[0].read'), true); assert.equal(h.run('rows.value[1].read'), false)
  assert.equal(h.run('unread.value'), 1); assert.equal(h.log.unread, 1)
  h.run('openRow(rows.value[1])'); await tick(); assert.deepEqual(h.log.read, [103, 102]); assert.equal(h.run('unread.value'), 0); h.stop()
})
test('已读失败与零更新不误清红点，可重试，已读项不重复提交', async () => {
  const h = harness(); h.state.readFail = true; await h.open({ appId: '81', messageId: '103' })
  assert.equal(h.run('rows.value[0].read'), false); assert.equal(h.run('readErrors.value[103]'), true)
  h.state.readFail = false; h.state.updated = 0; await h.run('readRow(rows.value[0])'); assert.equal(h.run('rows.value[0].read'), false)
  h.state.updated = 1; await h.run('readRow(rows.value[0])'); assert.equal(h.run('rows.value[0].read'), true)
  await h.run('readRow(rows.value[0])'); assert.equal(h.log.read.length, 3); h.stop()
})
test('分页游标追加去重，失败保留已有内容和未读，不自动读取更早通知', async () => {
  const h = harness(); h.state.data.hasMore = true; await h.open(); assert.deepEqual(h.log.read, [])
  h.state.fail = true; await h.run('load(true)'); assert.equal(h.run('rows.value.length'), 2); assert.equal(h.run('moreError.value'), true)
  h.state.fail = false; h.state.data.rows = [message(102), message(101)]; h.state.data.hasMore = false; h.state.data.nextBefore = 101
  await h.run('load(true)'); assert.equal(h.log.requests.at(-1).params.before, 102)
  assert.deepEqual(Array.from(h.run('rows.value'), m => m.id), [103, 102, 101]); assert.deepEqual(h.log.read, []); h.stop()
})
test('其他设备已读导致零更新时，回查确认后同步；更换令牌的迟到响应被丢弃', async () => {
  const h = harness(); await h.open(); h.state.updated = 0; h.state.data.rows[0].read = true; h.state.data.unread = 1
  await h.run('readRow(rows.value[0])'); assert.equal(h.run('rows.value[0].read'), true); assert.equal(h.run('unread.value'), 1)
  assert.equal(h.log.requests.at(-1).params.before, 104); h.stop()
  const w = harness(true); await w.open(); let resolve; w.state.pending = new Promise(r => resolve = r); w.run('load()')
  w.state.token = 'changed'; resolve({ data: { ...w.state.data, unread: 99 } }); await tick()
  assert.equal(w.run('data.value.unread'), 2); w.stop()
})
test('缺少报名编号不请求；账户切换清空列表并拒绝迟到响应', async () => {
  const invalid = harness(); await invalid.open({}); assert.equal(invalid.log.requests.length, 0); invalid.stop()
  const h = harness(); await h.open(); let resolve; h.state.pending = new Promise(r => resolve = r)
  h.run('load()'); await tick(); h.experience.account = null; await tick(); resolve({ data: h.state.data }); await tick()
  assert.equal(h.run('rows.value.length'), 0); assert.match(h.run('error.value'), /登录/); h.stop()
})
