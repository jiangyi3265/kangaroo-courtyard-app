import test from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'vite'
import { pendingStaffScope, pendingStaffRoute } from '../common/staff-scope.js'

const server = await createServer({ configFile: false, server: { middlewareMode: true, hmr: false } })
const session = await server.ssrLoadModule('/common/experience.js')
await server.close()
const storage = new Map()
globalThis.uni = { getStorageSync: key => storage.get(key), setStorageSync: (key, value) => storage.set(key, value), removeStorageSync: key => storage.delete(key) }
const grants = [
  { active: true, storeId: 7, storeName: '平潭小院', roleCode: 'keeper' },
  { active: true, storeId: null, cityId: 35, city: '玉林', roleCode: 'city_lead', fullAccess: true },
  { active: true, storeId: null, cityId: 36, city: '大连', roleCode: 'city_lead', fullAccess: true }
]
test('无门店城市授权可选择、持久化，仍不产生门店ID', async () => {
  session.acceptAuthenticatedAccount({ id: 333, staffGrants: grants })
  assert.equal(session.hasStaffAccess.value, true)
  assert.equal(session.staffStores.value.length, 3)
  await session.selectStaffStore(grants[1])
  assert.equal(session.currentStaffStore.value.city, '玉林')
  assert.equal(session.currentStaffStoreId(), null)
  assert.equal(session.staffStoreUrl('/pages/staff/index'), '/pages/staff/index')
  assert.equal(storage.get('kangaroo:333:staff-store'), 'city:35')
  session.experience.staffStoreId = null
  assert.equal(session.currentStaffStore.value.city, '玉林')
  await session.selectStaffStore('city:36')
  assert.equal(session.currentStaffStore.value.city, '大连')
  assert.equal(session.cityLeadFull.value, true)
  await session.selectStaffStore('7')
  assert.equal(session.currentStaffStoreId(), 7)
  assert.equal(session.cityLead.value, false)
})

test('城市授权被撤销时回到仍有效门店，任意本地对象不能授权', () => {
  session.acceptAuthenticatedAccount({ id: 333, staffGrants: grants })
  session.setStaffStore(grants[1])
  session.acceptAuthenticatedAccount({ id: 333, staffGrants: [grants[0], { ...grants[1], active: false }] })
  assert.equal(session.currentStaffStoreId(), 7)
  assert.throws(() => session.setStaffStore(grants[1]), /暂无员工授权/)
  assert.throws(() => session.setStaffStore({ cityId: 999, roleCode: 'city_lead' }), /暂无员工授权/)
  assert.throws(() => session.setStaffStore({ storeId: null }), /暂无员工授权/)
})

test('所有在用角色都能选择城市身份，但没有门店 ID 或发布业务权限', async () => {
  for (const roleCode of ['manager', 'keeper', 'online_staff', 'merchant_service', 'merchant', 'city_lead']) {
    const pending = { active: true, storeId: null, cityId: 65, city: '大连', roleCode }
    session.acceptAuthenticatedAccount({ id: 333, staffGrants: [pending] })
    await session.selectStaffStore(pending)
    assert.equal(session.currentStaffStore.value.roleCode, roleCode)
    assert.equal(session.currentStaffStoreId(), null)
    assert.equal(session.staffGrantKey(pending), 'city:65')
    assert.equal(pendingStaffScope(pending), true)
    for (const route of ['pages/staff/jobs', 'pages/staff/online-jobs', 'pages/staff/applications', 'pages/staff/rooms', 'pages/manage/wallet']) assert.equal(pendingStaffRoute(route, pending), true)
    for (const route of ['pages/staff/index', 'pages/staff/business', 'pages/profile/index', 'pages/messages/index']) assert.equal(pendingStaffRoute(route, pending), false)
    const opened = { ...pending, storeId: 8, storeName: '大连小院' }
    session.acceptAuthenticatedAccount({ id: 333, staffGrants: [pending, opened] })
    await session.selectStaffStore(opened)
    assert.equal(session.currentStaffStoreId(), 8)
    assert.equal(pendingStaffRoute('pages/staff/jobs', opened), false)
    session.acceptAuthenticatedAccount({ id: 333, staffGrants: [] })
    assert.equal(session.hasStaffAccess.value, false)
    assert.throws(() => session.setStaffStore(pending), /暂无员工授权/)
  }
})
