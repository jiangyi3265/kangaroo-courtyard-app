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
    getSessionRevision: () => 1, messageWording: m => m, visibleMessages: ref([]),
    setTimeout: (fn, delay) => { const id = ++next; timers.set(id, { fn, delay }); return id }, clearTimeout: id => timers.delete(id),
    onLoad: fn => { hooks.load = fn }, onShow: fn => { hooks.show = fn }, onHide: fn => { hooks.hide = fn }, onUnload: fn => { hooks.unload = fn }, onReachBottom: fn => { hooks.bottom = fn },
    apiMarkAllRead: async () => ({ data: { unreadIds: [9] } }), refreshUnread: () => calls.push('unread'),
    apiMessages: async () => ({ rows: [], hasMore: false }), ensureSession: async () => {}, apiNotices: async () => ({ data: [] }),
    readSeenNotices: () => ({}), ...stubs })
  vm.createContext(context)
  vm.runInContext(nodes.filter(n => n.type !== 'ImportDeclaration').map(n => source.slice(n.start, n.end)).join('\n'), context)
  return { run: script => vm.runInContext(script, context), timers, hooks, calls, context }
}

test('分类页批量首次已读安排到期查询，再次标读不延长期限', async () => {
  const h = page('pages/notice/inbox.vue')
  h.run('rows.value = [{ id: 9, read: false, fresh: true }, { id: 8, read: true, expiresAt: Date.now() + 100000 }]')
  const oldExpiry = h.run('rows.value[1].expiresAt')
  await h.run('markUpTo("user", rows.value)')
  assert.equal(h.run('rows.value[0].read'), true)
  assert.equal(h.run('rows.value[0].fresh'), true, '保留进入时的新消息分组')
  assert.equal(h.run('rows.value[1].expiresAt'), oldExpiry)
  assert.equal(h.timers.size, 1)
  assert.ok([...h.timers.values()][0].delay <= 101000, '按最早的服务端期限刷新')
  const expiry = h.run('rows.value[0].expiresAt')
  await h.run('markUpTo("user", rows.value)')
  assert.equal(h.run('rows.value[0].expiresAt'), expiry)
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
  const h = page('pages/notice/inbox.vue', { apiMarkAllRead: () => new Promise(r => { resolve = r }) })
  h.run('rows.value = [{ id: 9, read: false }]')
  const marking = h.run('markUpTo("user", rows.value)')
  h.context.experience.account = { id: 8 }
  h.run('rows.value = [{ id: 9, read: false }]')
  resolve({ data: { unreadIds: [9] } }); await marking
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

test('分类页旧已读消息点击成功才补期限，失败不补、已有期限不延期', async () => {
  let resolve, reject, calls = 0
  const h = page('pages/notice/inbox.vue', { apiMarkRead: () => { calls++; return new Promise((yes, no) => { resolve = yes; reject = no }) } })
  h.run('rows.value = [{ id: 9, read: true, fresh: false }, { id: 8, read: true, fresh: false, expiresAt: 1234 }]; open(rows.value[0])')
  assert.equal(h.run('rows.value[0].expiresAt'), undefined)
  reject(new Error('offline')); await Promise.resolve(); await Promise.resolve()
  assert.equal(h.run('rows.value[0].expiresAt'), undefined)
  h.run('open(rows.value[0])'); resolve({ data: { updated: 1 } }); await Promise.resolve()
  const expiry = h.run('rows.value[0].expiresAt')
  assert.ok(expiry > Date.now())
  h.run('open(rows.value[0]); open(rows.value[1])')
  assert.equal(calls, 2)
  assert.equal(h.run('rows.value[0].expiresAt'), expiry)
  assert.equal(h.run('rows.value[1].expiresAt'), 1234)
})
