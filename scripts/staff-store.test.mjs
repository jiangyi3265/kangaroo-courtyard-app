import test from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'vite'

const vite = await createServer({ configFile: false, server: { middlewareMode: true, hmr: false } })
const session = await vite.ssrLoadModule('/common/experience.js')
const request = await vite.ssrLoadModule('/common/request.js')
const { default: R } = await vite.ssrLoadModule('/common/routes.js')
await vite.close()
let storage
const account = (id = 'alice') => ({ id, staffGrants: [
  { storeId: 102, storeName: '平潭袋鼠小院', roleCode: 'manager', active: true },
  { storeId: 104, storeName: '丽江袋鼠小院', roleCode: 'keeper', active: true },
  { storeId: 105, storeName: '已撤销门店', roleCode: 'staff', active: false }
] })
test.beforeEach(() => {
  storage = new Map()
  globalThis.uni = { getStorageSync: k => storage.get(k), setStorageSync: (k,v) => storage.set(k,v), removeStorageSync: k => storage.delete(k) }
  session.logout()
  session.acceptAuthenticatedAccount(account())
})

test('switching accepts equivalent string/number IDs and updates store and role together', () => {
  session.setStaffStore('104')
  assert.equal(session.currentStaffStoreId(), 104)
  assert.equal(session.currentStaffStore.value.roleCode, 'keeper')
  assert.equal(storage.get('kangaroo:alice:staff-store'), 104)
})
test('legacy saved string ID survives login and account refresh', () => {
  storage.set('kangaroo:alice:staff-store', '104')
  session.acceptAuthenticatedAccount(account())
  assert.equal(session.currentStaffStoreId(), 104)
  session.acceptAuthenticatedAccount(account())
  assert.equal(session.currentStaffStoreId(), 104)
})
test('string IDs in grants stay precise and numeric selection is canonicalized', () => {
  const a=account(); a.staffGrants.forEach(g => {g.storeId=String(g.storeId)})
  a.staffGrants.push({storeId:'9007199254740993',active:true})
  session.acceptAuthenticatedAccount(a)
  session.setStaffStore(104)
  assert.equal(session.currentStaffStoreId(), '104')
  session.setStaffStore('9007199254740993')
  assert.equal(session.currentStaffStoreId(), '9007199254740993')
})
test('invalid or revoked selection cannot replace the current authorized store', () => {
  for(const id of [null, undefined, '', 105, 999]) assert.throws(() => session.setStaffStore(id), /授权/)
  assert.equal(session.currentStaffStoreId(), 102)
})
test('selection is isolated by account and falls back when the selected grant is revoked', () => {
  session.setStaffStore(104)
  session.acceptAuthenticatedAccount(account('bob'))
  assert.equal(session.currentStaffStoreId(), 102)
  session.acceptAuthenticatedAccount(account())
  assert.equal(session.currentStaffStoreId(), 104)
  const a=account(); a.staffGrants[1].active=false
  session.acceptAuthenticatedAccount(a)
  assert.equal(session.currentStaffStoreId(), 102)
})
test('storage failure cannot undo a switch during a same-account refresh', () => {
  globalThis.uni.setStorageSync = () => { throw new Error('storage full') }
  session.setStaffStore(104)
  session.acceptAuthenticatedAccount(account(), {preserveMode:true})
  assert.equal(session.currentStaffStoreId(), 104)
})

// 会话中新授予的门店：切换页的列表来自服务端实时授权，本机授权是旧快照
const serverAccount = (grants) => ({ code: 200, data: { id: 'alice', staffGrants: grants } })
const withServer = (response) => {
  const calls = []
  request.setToken('existing-token')
  globalThis.uni.request = options => { calls.push(new URL(options.url).pathname); options.success({ data: response() }) }
  return calls
}
test('a store granted during the session is accepted after one account refresh', async () => {
  const fresh = [...account().staffGrants, { storeId: 106, storeName: '新授权门店', roleCode: 'keeper', active: true }]
  const calls = withServer(() => serverAccount(fresh))
  await session.selectStaffStore('106')
  assert.deepEqual(calls, ['/app/auth/account'])
  assert.equal(session.currentStaffStoreId(), 106)
  assert.equal(session.currentStaffStore.value.roleCode, 'keeper')
  assert.equal(storage.get('kangaroo:alice:staff-store'), 106)
})
test('a store still missing after refresh is rejected without changing the current store', async () => {
  const calls = withServer(() => serverAccount(account().staffGrants))
  await assert.rejects(session.selectStaffStore(999), /授权/)
  assert.deepEqual(calls, ['/app/auth/account'])
  assert.equal(session.currentStaffStoreId(), 102)
})
test('a store already granted locally switches without a server round trip', async () => {
  const calls = withServer(() => serverAccount([]))
  await session.selectStaffStore(104)
  assert.deepEqual(calls, [])
  assert.equal(session.currentStaffStoreId(), 104)
})
test('manage page links carry the current store and keep existing query', () => {
  session.setStaffStore(104)
  assert.equal(session.staffStoreUrl(R.daily), R.daily + '?storeId=104')
  assert.equal(session.staffStoreUrl(R.tasks + '?s=2'), R.tasks + '?s=2&storeId=104')
  assert.equal(session.staffStoreUrl(R.dashboard, '9007199254740993'), R.dashboard + '?storeId=9007199254740993')
  session.logout()
  assert.equal(session.staffStoreUrl(R.weekly), R.weekly)
})
