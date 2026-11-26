import fs from 'node:fs'
import vm from 'node:vm'
import test from 'node:test'
import assert from 'node:assert/strict'
import { parse, babelParse } from '@vue/compiler-sfc'
import { ref, computed } from 'vue'

function page(file, stubs = {}) {
  const source = parse(fs.readFileSync(new URL('../' + file, import.meta.url), 'utf8')).descriptor.scriptSetup.content
  const nodes = babelParse(source, { sourceType: 'module' }).program.body
  const timers = new Map(), hooks = {}, calls = []
  let next = 0
  const context = { console, Date, Promise, Set, ref, computed }
  for (const node of nodes.filter(n => n.type === 'ImportDeclaration')) for (const spec of node.specifiers) context[spec.local.name] = () => {}
  Object.assign(context, { ref, computed, R: {}, experience: { account: { id: 7 }, mode: 'user' },
    getMessageScopeKey: () => context.experience.account?.id, getSessionRevision: () => 1, messageWording: m => m, visibleMessages: ref([]),
    setTimeout: (fn, delay) => { const id = ++next; timers.set(id, { fn, delay }); return id }, clearTimeout: id => timers.delete(id),
    onLoad: fn => { hooks.load = fn }, onShow: fn => { hooks.show = fn }, onHide: fn => { hooks.hide = fn }, onUnload: fn => { hooks.unload = fn }, onReachBottom: fn => { hooks.bottom = fn },
    apiMarkAllRead: async () => ({ data: { unreadIds: [9] } }), refreshUnread: () => calls.push('unread'),
    apiMessages: async () => ({ rows: [], hasMore: false }), ensureSession: async () => {}, apiNotices: async () => ({ data: [] }),
    readSeenNotices: () => ({}), ...stubs })
  vm.createContext(context)
  vm.runInContext(nodes.filter(n => n.type !== 'ImportDeclaration').map(n => source.slice(n.start, n.end)).join('\n'), context)
  return { run: script => vm.runInContext(script, context), timers, hooks, calls, context }
}

test('分类页只标已点开的那条，数字消失，其他通知和历史消息保留', async () => {
  const marks = []
  const h = page('pages/notice/inbox.vue', {apiMarkRead: async id => { marks.push(id); return {data:{updated:1}} }})
  h.run('rows.value = [{id:9,read:false,fresh:true},{id:8,read:false,fresh:true}]')
  h.run('open(rows.value[0])')
  await new Promise(resolve => setImmediate(resolve))
  assert.deepEqual(marks,[9])
  assert.equal(h.run('rows.value[0].fresh'),false)
  assert.equal(h.run('rows.value[1].fresh'),true)
  assert.equal(h.run('rows.value[0].expiresAt'),undefined)
})

test('分类页到期重新查询，不自行删除未读或聊天内容；离页取消计时', async () => {
  const requests = []
  const h = page('pages/notice/inbox.vue', { apiMessages: async (...args) => { requests.push(args); return { rows: [{ id: 10, title: '新提醒', category: 'system', read: false }], hasMore: false } }, apiMarkAllRead: async () => { throw new Error('offline') } })
  h.hooks.show()
  h.run('rows.value = [{ id: 9, read: true, expiresAt: Date.now() + 100000 }, { id: 10, read: false, expiresAt: 1 }]; scheduleExpiry()')
  assert.ok([...h.timers.values()][0].delay > 99000, '未读消息即使携带过期字段也不参与清理')
  await [...h.timers.values()][0].fn()
  assert.equal(requests.length, 1)
  assert.equal(h.run('rows.value.length'), 1)
  assert.equal(h.run('rows.value[0].id'), 10)
  assert.equal(h.run('rows.value[0].read'), false)
  h.hooks.hide(); assert.equal(h.timers.size, 0)
  h.hooks.show(); await Promise.resolve(); assert.equal(requests.length, 2)
  h.hooks.unload(); assert.equal(h.timers.size, 0)
})

test('分类页已读响应回来前换账号不修改新账号消息', async () => {
  let resolve
  const h = page('pages/notice/inbox.vue', { apiMarkRead: () => new Promise(r => { resolve = r }) })
  h.run('rows.value = [{ id: 9, read: false }]')
  h.run('open(rows.value[0])')
  h.context.experience.account = { id: 8 }
  h.run('rows.value = [{ id: 9, read: false }]')
  resolve({ data: { updated: 1 } }); await new Promise(r => setImmediate(r))
  assert.equal(h.run('rows.value[0].read'), false)
  assert.equal(h.timers.size, 0)
})

test('主列表全部已读后回读服务端期限并安排到期刷新', async () => {
  const visible = ref([]), calls = [], experience = { account: { id: 7 }, mode: 'user', messages: [] }
  const expiry = Date.now() + 90000
  const h = page('pages/messages/index.vue', { visibleMessages: visible, experience,
    markAllMessagesRead: async () => { calls.push('mark') },
    loadMessages: async () => { calls.push('reload'); experience.messages = [{ id: 9, read: true, expiresAt: expiry }]; visible.value = experience.messages; return experience.messages },
    clearNoticeBadge: () => 0, toast: () => {} })
  await h.run('readAll()')
  assert.deepEqual(calls, ['mark', 'reload'])
  assert.equal(h.timers.size, 1)
  assert.ok([...h.timers.values()][0].delay >= 80000)
  assert.equal(visible.value[0].expiresAt, expiry)
})

test('重新打开旧已读消息不重复写已读，也不给历史记录增加期限', () => {
  const writes = []
  const h = page('pages/notice/inbox.vue', {apiMarkRead: id => writes.push(id)})
  h.run('rows.value = [{id:9,read:true},{id:8,read:true,expiresAt:1234}];open(rows.value[0]);open(rows.value[1])')
  assert.deepEqual(writes,[])
  assert.equal(h.run('rows.value[0].expiresAt'),undefined)
  assert.equal(h.run('rows.value[1].expiresAt'),1234)
})
