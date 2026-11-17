import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import { createRequire } from 'node:module'
import { messageWording } from '../common/display-wording.js'
const require = createRequire(import.meta.url)
const vue = require('vue'), compiler = require('@vue/compiler-sfc')
const source = fs.readFileSync(new URL('../pages/messages/index.vue', import.meta.url), 'utf8')
const code = compiler.parse(source).descriptor.scriptSetup.content
const body = compiler.babelParse(code, { sourceType: 'module' }).program.body.filter(n => n.type !== 'ImportDeclaration').map(n => code.slice(n.start, n.end)).join('\n')
const settle = () => new Promise(resolve => setImmediate(resolve))
function harness({ mode = 'user', summary = {}, delay } = {}) {
  const hooks = {}, calls = [], writes = []
  const experience = vue.reactive({ account: { id: 7 }, mode, messages: [], messagesMore: null })
  let request = 0, revision = 0
  const ctx = {
    ...vue, messageWording, setTimeout: () => 1, clearTimeout() {}, experience, session: { restored: true }, visibleMessages: vue.computed(() => experience.messages), unreadCount: vue.ref(0), groupChatEnabled:vue.ref(true), privateChatEnabled:vue.ref(true),
    onLoad() {}, onShow: fn => hooks.show = fn, onHide: fn => hooks.hide = fn, onReachBottom: fn => hooks.bottom = fn,
    ensureSession: async () => {}, getMessageScopeKey: () => [experience.account?.id,experience.mode,experience.staffStoreId,experience.account?.role,revision].join('|'), apiMessageSummary: async () => typeof summary === 'function' ? summary() : summary,
    apiNotices: async () => ({ data: [] }), readSeenNotices: () => ({}), readNoticeBadgeCleared: () => ({}), clearNoticeBadge: () => ({}), noticeBadged: () => false,
    absUrl: x => x || '', go() {}, relaunch() {}, toast() {}, R: {}, uni: {},
    markMessageRead: id => { writes.push(id); experience.messages.find(m => m.id === id).read = true }, markAllMessagesRead: async () => {},
    loadMessages: async (category, options, append) => {
      calls.push({ category, ...options, append: !!append })
      const req = ++request, scope = revision
      const result = delay ? await delay(category, options) : { rows: [{ id: category, category, title: category }], more: false }
      if (req !== request || scope !== revision) return []
      experience.messages = append ? [...experience.messages, ...result.rows] : result.rows
      experience.messagesMore = result.more
      return experience.messages
    }
  }
  vm.createContext(ctx)
  vm.runInContext(body, ctx)
  return { hooks, calls, writes, experience, run: js => vm.runInContext(js, ctx), json: js => JSON.parse(vm.runInContext(`JSON.stringify(${js})`, ctx)), changeScope: () => { revision++; experience.account = { id: 8 }; experience.messages = [] }, changeRole: role => { revision++; experience.account={...experience.account,role};experience.messages=[] } }
}

test('同账号同门店切换授权角色后，旧订单统计不能恢复新身份的红点',async()=>{
 const pending=[],h=harness({mode:'staff',summary:()=>new Promise(resolve=>pending.push(resolve))})
 const old=h.hooks.show();await settle()
 h.run('buckets.value={order:{total:9,unread:9}};categoryCounts.value=[{category:"order",total:9,unread:9}]')
 h.changeRole('manager');await settle()
 assert.equal(h.run('buckets.value'),null);assert.deepEqual(h.json('categoryCounts.value'),[])
 assert.equal(pending.length,2)
 pending[1]({buckets:{order:{total:0,unread:0}},categories:[]});await settle()
 pending[0]({buckets:{order:{total:9,unread:9}},categories:[{category:'order',total:9,unread:9}]});await old;await settle()
 assert.deepEqual(h.json('buckets.value.order'),{total:0,unread:0});assert.deepEqual(h.json('categoryCounts.value'),[])
 h.hooks.hide()
})

test('首次只打开有未读的一个分类，系统公告不计入活动，员工只有会话分类', async () => {
  const h = harness({ summary: { categories: [{ category: 'system', total: 12, unread: 11 }, { category: 'contract', total: 3, unread: 1 }], buckets: { system: { total: 10, unread: 10 } } } })
  await h.hooks.show(); await settle()
  assert.equal(h.run('activeCategory.value'), 'contract')
  assert.deepEqual(h.calls.map(c => [c.category, c.bucket]), [['contract', 'main']])
  assert.deepEqual(h.json('categories.value.find(c => c.key === "system")').unread, 1)
  assert.equal(h.json('categories.value').some(c => c.label === '全部'), false)
  const staff = harness({ mode: 'staff' }); await staff.hooks.show(); await settle()
  assert.deepEqual(staff.json('categories.value.map(c => c.key)'), ['chat', 'group'])
})

test('切换分类重新请求第一页，翻页保留类别，迟到的前一个分类不会覆盖新分类', async () => {
  let release
  const h = harness({ delay: async (category, options) => {
    if (category === 'contract') await new Promise(resolve => release = resolve)
    return { rows: [{ id: category + options.page, category, title: category }], more: options.page === 1 }
  } })
  await h.hooks.show(); await settle()
  await h.hooks.bottom()
  assert.equal(h.calls[1].page, 2); assert.equal(h.calls[1].category, 'interview')
  h.run('selectCategory("contract")')
  assert.equal(h.run('ready.value'), false)
  h.run('selectCategory("chat")'); await settle()
  release(); await settle()
  assert.equal(h.run('activeCategory.value'), 'chat')
  assert.deepEqual(h.json('categoryRows.value.map(m => m.category)'), ['chat'])
  assert.deepEqual(h.calls.slice(-2).map(c => [c.category, c.page, c.append]), [['contract', 1, false], ['chat', 1, false]])
  assert.deepEqual(h.writes, [], '切换和翻页不能标记消息已读')
})

test('活动分类只显示活动，分类加载失败可重试，空分类不混入其他消息', async () => {
  let fail = true
  const h = harness({ delay: async category => {
    if (category === 'order' && fail) { fail = false; throw new Error('offline') }
    return { rows: category === 'system' ? [
      { id: 1, category: 'system', bizType: 'activity_signup' }, { id: 2, category: 'system', bizType: 'job_subscribe' }, { id: 3, category: 'chat' }
    ] : [], more: false }
  } })
  await h.hooks.show(); await settle()
  h.run('selectCategory("system")'); await settle()
  assert.deepEqual(h.json('categoryRows.value.map(m => m.id)'), [1])
  assert.equal(h.calls.at(-1).category, 'system')
  h.run('selectCategory("order")'); await settle()
  assert.equal(h.run('failed.value'), 1)
  assert.equal(h.run('ready.value'), false)
  await h.run('load()')
  assert.equal(h.run('failed.value'), 0)
  assert.equal(h.run('empty.value[0]'), '暂无订单消息')
  assert.equal(h.run('categoryRows.value.length'), 0)
})

test('账号变化后丢弃迟到的分类请求，再次进入重置选择；未知新类别单独可达', async () => {
  let release
  const h = harness({ summary: { categories: [{ category: 'new_kind', total: 1, unread: 1 }] }, delay: async category => {
    if (category === 'new_kind') await new Promise(resolve => release = resolve)
    return { rows: [{ id: 1, category }], more: false }
  } })
  await h.hooks.show(); await settle()
  assert.equal(h.run('activeCategory.value'), 'new_kind')
  h.changeScope(); h.hooks.hide(); release(); await settle()
  assert.equal(h.experience.messages.length, 0)
  assert.equal(h.run('ready.value'), false)
})
