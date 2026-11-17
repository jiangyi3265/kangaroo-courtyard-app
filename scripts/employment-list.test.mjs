import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'

const source = readFileSync(new URL('../pages/staff/components/k-employment-list.vue', import.meta.url), 'utf8')
const script = source.match(/<script setup>([\s\S]*?)<\/script>/)[1].replace(/^import .*$/gm, '')
const deferred = () => {
  let resolve
  const promise = new Promise(done => { resolve = done })
  return { promise, resolve }
}
function fixture(get) {
  const props = { storeId: 10 }
  let changed
  const context = vm.createContext({ defineProps: () => props, ref: value => ({ value }), watch: (_, callback) => { changed = callback }, get })
  vm.runInContext(script + '\nglobalThis.api = { load, rows, selected, hasMore, error, updateRecord }', context)
  return { props, changed: () => changed(), ...context.api }
}

test('switching the store cannot display the previous store slow response', async () => {
  const first = deferred(), second = deferred()
  const f = fixture((url, query) => query.storeId === 10 ? first.promise : second.promise)
  const old = f.load(false)
  f.props.storeId = 20
  f.changed()
  const current = f.load(false)
  second.resolve({ data: { rows: [{ appId: 2, name: '当前门店工作人员' }], hasMore: false } })
  await current
  first.resolve({ data: { rows: [{ appId: 1, name: '上一门店工作人员' }], hasMore: false } })
  await old
  assert.equal(f.rows.value.length, 1)
  assert.equal(f.rows.value[0].appId, 2)
})

test('pagination preserves existing rows and saved departure updates the selected record', async () => {
  const f = fixture(async (url, query) => ({ data: { rows: [{ appId: query.pageNum, state: 'active' }], hasMore: query.pageNum === 1 } }))
  await f.load(false)
  assert.equal(f.hasMore.value, true)
  f.selected.value = f.rows.value[0]
  await f.load(true)
  assert.equal(f.rows.value.length, 2)
  assert.equal(f.hasMore.value, false)
  f.updateRecord({ appId: 1, state: 'offboarded', offboardTime: '2026-11-08 08:00:00' })
  assert.equal(f.selected.value.state, 'offboarded')
  assert.equal(f.rows.value[0].offboardTime, '2026-11-08 08:00:00')
})
