// Execute the real page scripts with Vue reactivity and controlled message responses.
import fs from 'node:fs'
import vm from 'node:vm'
import test from 'node:test'
import assert from 'node:assert/strict'
import { parse, babelParse } from '@vue/compiler-sfc'
import * as vue from 'vue'

const settle = () => new Promise(resolve => setImmediate(resolve))
const message = (id, mode = 'staff', bizType = 'stay_order') => ({ id, recipientId: 7, mode, category: 'order', bizType, title: id, content: id, read: false })
function page(file) {
  const code = parse(fs.readFileSync(new URL('../' + file, import.meta.url), 'utf8')).descriptor.scriptSetup.content
  const nodes = babelParse(code, { sourceType: 'module' }).program.body
  const experience = vue.reactive({ account: { id: 7 }, mode: 'staff', staffStoreId: 17, role: 'keeper', revision: 0 })
  const hooks = {}, pending = [], writes = [], timers = new Map()
  let timer = 0
  const context = {}
  for (const node of nodes.filter(n => n.type === 'ImportDeclaration')) {
    for (const spec of node.specifiers) context[spec.local.name] = () => {}
  }
  Object.assign(context, vue, {
    experience, Date, Promise, Set, R: {}, uni: {},
    getMessageScopeKey: () => [experience.account?.id, experience.mode, experience.staffStoreId, experience.role, experience.revision].join('|'),
    ensureSession: async () => {}, hasStaffAccess: vue.ref(true), currentStaffStore: vue.computed(() => ({ storeId: experience.staffStoreId, roleCode: experience.role })),
    useScreen: () => vue.ref(2), messageWording: m => m, absUrl: x => x, readSeenNotices: () => ({}),
    setTimeout: (fn, delay) => { timers.set(++timer, { fn, delay }); return timer }, clearTimeout: id => timers.delete(id),
    apiMessages: (mode, category, options) => new Promise((resolve, reject) => pending.push({ mode, category, options, resolve, reject })),
    apiMarkRead: async id => { writes.push(id); return { data: { updated: 1 } } }, apiNotices: async () => ({ data: [] }),
    onLoad: fn => hooks.load = fn, onShow: fn => (hooks.show ||= []).push(fn), onHide: fn => hooks.hide = fn,
    onUnload: fn => hooks.unload = fn, onUnmounted: fn => hooks.unmount = fn, onReachBottom: fn => hooks.bottom = fn
  })
  vm.createContext(context)
  vm.runInContext(nodes.filter(n => n.type !== 'ImportDeclaration').map(n => code.slice(n.start, n.end)).join('\n'), context)
  return {
    experience, hooks, pending, writes,
    run: js => vm.runInContext(js, context),
    ids: name => [...vm.runInContext(name + '.value', context)].map(m => m.id),
    switchRole: role => { experience.role = role; experience.revision++ }
  }
}

test('订单子页切换为换工主理人即清空旧订单，旧分页响应不能回灌', async () => {
  const h = page('pages/notice/inbox.vue')
  const first = h.run('type.value="order"; load(false)')
  h.pending[0].resolve({ rows: [message('keeper-stay')], hasMore: true }); await first
  assert.deepEqual(h.ids('rows'), ['keeper-stay'])
  const oldPage = h.run('load(true)'); await settle()
  h.switchRole('manager'); await settle()
  assert.deepEqual(h.ids('rows'), []); assert.equal(h.run('ready.value'), false)
  assert.equal(h.pending[2].options.page, 1)
  h.pending[2].resolve({ rows: [message('activity-order', 'staff', 'activity')], hasMore: false }); await settle()
  h.pending[1].resolve({ rows: [message('late-stay')], hasMore: true }); await oldPage
  assert.deepEqual(h.ids('rows'), ['activity-order']); assert.equal(h.run('hasMore.value'), false)
  assert.deepEqual(h.writes, []); h.hooks.hide()
})

test('订单子页切回个人身份可正常显示本人旅居订单', async () => {
  const h = page('pages/notice/inbox.vue')
  h.switchRole('manager'); await settle()
  h.pending[0].resolve({ rows: [], hasMore: false }); await settle()
  h.run('type.value="order"'); h.experience.mode = 'user'; await settle()
  assert.equal(h.pending[1].mode, 'user')
  h.pending[1].resolve({ rows: [message('personal-stay', 'user')], hasMore: false }); await settle()
  assert.deepEqual(h.ids('rows'), ['personal-stay']); assert.equal(h.run('ready.value'), true)
  h.hooks.hide()
})

test('提醒中心授权变更后重取员工提醒，旧角色响应不会覆盖新角色数据', async () => {
  const h = page('pages/messages/reminders.vue')
  const old = h.run('fetchReminders()'); await settle()
  h.pending[0].resolve({ rows: [message('personal-stay', 'user')] }); await settle()
  assert.equal(h.pending[1].mode, 'staff')
  h.run('staffReminders.value=[{id:"cached-keeper-stay"}]')
  h.switchRole('manager'); await settle()
  assert.deepEqual(h.ids('staffReminders'), [])
  h.pending[2].resolve({ rows: [message('personal-stay', 'user')] }); await settle()
  h.pending[3].resolve({ rows: [message('activity-order', 'staff', 'activity')] }); await settle()
  h.pending[1].resolve({ rows: [message('late-keeper-stay')] }); await old
  assert.deepEqual(h.ids('userReminders'), ['personal-stay'])
  assert.deepEqual(h.ids('staffReminders'), ['activity-order'])
  assert.equal(h.run('staffPending.value'), 1); assert.deepEqual(h.writes, []); h.hooks.hide()
})

test('隐藏的订单子页切换门店后清空缓存，不在后台发请求或接受旧响应', async () => {
  const h = page('pages/notice/inbox.vue')
  const pending = h.run('type.value="order"; load(false)')
  h.run('rows.value=[{id:"cached"}]'); h.hooks.hide()
  h.experience.staffStoreId = 18; await settle()
  assert.deepEqual(h.ids('rows'), []); assert.equal(h.pending.length, 1)
  h.pending[0].resolve({ rows: [message('late')], hasMore: false }); await pending
  assert.deepEqual(h.ids('rows'), [])
})
