import test from 'node:test'
import assert from 'node:assert/strict'
import vm from 'node:vm'
import { readFileSync } from 'node:fs'

const page = readFileSync(new URL('../pages/wish/order.vue', import.meta.url), 'utf8')
const script = page.split('<script setup>')[1].split('</script>')[0].replace(/^import .*$/gm, '')
const owner = { wishId: 1, isOwner: true, helperId: 2, mode: 'free' }
const deferred = () => {
  let resolve
  const promise = new Promise(done => { resolve = done })
  return { promise, resolve }
}
function openPage(overrides = {}) {
  const hooks = {}, timers = new Set(), calls = []
  let token = 'first'
  const scope = {
    ref: value => ({ value }), computed: get => ({ get value() { return get() } }),
    onLoad: fn => { hooks.load = fn }, onShow: fn => { hooks.show = fn },
    onHide: fn => { hooks.hide = fn }, onUnload: fn => { hooks.unload = fn },
    getToken: () => token, toast() {}, wishDetail: async () => ({ data: owner }),
    wishAction: async (...args) => { calls.push(args); return { data: owner } },
    setInterval: () => { const key = {}; timers.add(key); return key },
    clearInterval: key => timers.delete(key), ...overrides
  }
  const state = vm.runInNewContext(script + '\n;({wish,error,messages,hasOlder,loadMessages,act,cancel,tab,busy})', scope)
  return { ...state, hooks, timers, calls, switchUser: () => { token = 'second' } }
}

test('invalid order links show a recovery action without requesting an order', async () => {
  let reads = 0
  for (const id of [undefined, '', '0', '-1', '1.5', '1x']) {
    const page = openPage({wishDetail: async () => { reads++; return {data: owner} }})
    page.hooks.load({ id })
    await page.hooks.show()
    assert.match(page.error.value, /编号|链接/)
    assert.equal(page.timers.size, 0)
  }
  assert.equal(reads, 0)
  assert.match(page, /我的心愿/)
})

test('a delayed action cannot replace the next user’s order or selection', async () => {
  const ack = deferred()
  const page = openPage({ wishAction: () => ack.promise })
  page.hooks.load({id: '1'})
  await page.hooks.show()
  const pending = page.act('complete')
  page.switchUser()
  await page.hooks.show()
  ack.resolve({ data: {...owner, title: '旧账号的订单'} })
  await pending
  assert.deepEqual(page.wish.value, owner)
  assert.equal(page.tab.value, 'progress')
  assert.equal(page.busy.value, false)
})

test('a confirmation opened by the previous user cannot cancel an order', async () => {
  const dialog = deferred()
  const page = openPage({confirm: () => dialog.promise})
  page.hooks.load({id: '1'})
  await page.hooks.show()
  const pending = page.cancel()
  page.switchUser()
  await page.hooks.show()
  dialog.resolve(true)
  await pending
  assert.equal(page.calls.length, 0)
})

test('rapid hide and show starts one poller and stops it on exit', async () => {
  const first = deferred()
  let reads = 0
  const page = openPage({wishDetail: () => ++reads === 1 ? first.promise : Promise.resolve({data: owner})})
  page.hooks.load({id: '1'})
  const slow = page.hooks.show()
  page.hooks.hide()
  await page.hooks.show()
  first.resolve({data: owner})
  await slow
  assert.equal(page.timers.size, 1)
  page.hooks.unload()
  assert.equal(page.timers.size, 0)
})

test('after a busy absence the user can page back across the gap in chat history', async () => {
  let newest = 10
  const page = openPage({wishMessages: async (_id, before) => {
    const last = before ? before - 1 : newest
    return {data: Array.from({length: Math.min(last, 50)}, (_, i) => ({messageId: last - i}))}
  }})
  page.hooks.load({id: '1'})
  await page.hooks.show()
  await page.loadMessages()
  newest = 120
  await page.loadMessages()
  assert.equal(page.hasOlder.value, true)
  while (page.hasOlder.value) await page.loadMessages(true)
  assert.deepEqual(Array.from(page.messages.value, row => row.messageId), Array.from({length: 120}, (_, i) => i + 1))
})
