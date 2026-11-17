import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'

const source = readFileSync(new URL('../pages/staff/components/k-employment-status.vue', import.meta.url), 'utf8')
const script = source.match(/<script setup>([\s\S]*?)<\/script>/)[1].replace(/^import .*$/gm, '')
const state = id => ({ appId: id, state: 'active', onboardTime: '2026-10-01 08:00:00', offboardTime: null, canManage: true })
const deferred = () => {
  let resolve, reject
  const promise = new Promise((yes, no) => { resolve = yes; reject = no })
  return { promise, resolve, reject }
}

function fixture(get, post) {
  const props = { appId: 1 }
  const context = vm.createContext({
    defineProps: () => props,
    defineEmits: () => () => {},
    ref: value => ({ value }),
    computed: read => ({ get value() { return read() } }),
    watch: () => {},
    get, post,
    todayCn: () => '2026-11-08',
    Date, Math
  })
  vm.runInContext(script + '\nglobalThis.api = { load, edit, save, record, saving, error, note, editing }', context)
  return { props, ...context.api }
}

test('a previous application response cannot replace the new employment record', async () => {
  const first = deferred(), second = deferred()
  const f = fixture(url => url.includes('/1/') ? first.promise : second.promise, async () => ({}))
  const old = f.load()
  f.props.appId = 2
  const current = f.load()
  second.resolve({ data: state(2) })
  await current
  first.resolve({ data: state(1) })
  await old
  assert.equal(f.record.value.appId, 2)
})

test('retrying an uncertain save keeps the same idempotency key and actual expected version', async () => {
  const calls = []
  const f = fixture(async () => ({ data: state(1) }), async (url, body) => {
    calls.push(body)
    if (calls.length === 1) throw new Error('网络中断')
    return { data: { ...state(1), state: 'offboarded', offboardTime: body.offboardTime } }
  })
  await f.load()
  f.edit(false)
  f.note.value = '已当面核实工作人员的实际离岗情况'
  await f.save()
  assert.equal(f.error.value, '网络中断')
  assert.equal(f.record.value.state, 'active')
  await f.save()
  assert.equal(calls.length, 2)
  assert.equal(calls[0].requestKey, calls[1].requestKey)
  assert.equal(calls[0].expectedOffboardTime, null)
  assert.equal(f.record.value.state, 'offboarded')
  assert.equal(f.editing.value, false)
})

test('a completed save for another application cannot alter the current detail', async () => {
  const pending = deferred()
  const f = fixture(async url => ({ data: state(url.includes('/1/') ? 1 : 2) }), () => pending.promise)
  await f.load()
  f.edit(false)
  f.note.value = '已当面核实工作人员的实际离岗情况'
  const saving = f.save()
  f.props.appId = 2
  await f.load()
  pending.resolve({ data: { ...state(1), state: 'offboarded', offboardTime: '2026-11-08 08:00:00' } })
  await saving
  assert.equal(f.record.value.appId, 2)
  assert.equal(f.record.value.state, 'active')
  assert.equal(f.saving.value, false)
})

test('read-only records and short verification notes cannot submit changes', async () => {
  let writes = 0
  const f = fixture(async () => ({ data: { ...state(1), canManage: false } }), async () => { writes++; return {} })
  await f.load()
  f.note.value = '已核验的完整操作依据'
  await f.save()
  assert.equal(writes, 0)
  f.record.value.canManage = true
  f.note.value = '太短'
  await f.save()
  assert.equal(writes, 0)
  assert.match(f.error.value, /至少5字/)
})
