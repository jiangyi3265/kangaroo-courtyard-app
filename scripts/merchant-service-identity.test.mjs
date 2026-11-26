import test from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'vite'
import { groupStaffIdentities, findStaffIdentity, staffIdentityLabel, staffIdentityForMessageScope } from '../common/staff-identities.js'

const vite = await createServer({ configFile: false, server: { middlewareMode: true, hmr: false } })
const session = await vite.ssrLoadModule('/common/experience.js')
const request = await vite.ssrLoadModule('/common/request.js')
const api = await vite.ssrLoadModule('/common/api.js')
await vite.close()
const service = (storeId, city = '平潭', extra = {}) => ({ storeId, city, active: true, storeName: '门店' + storeId, roleCode: 'merchant_service', ...extra })
const grants = () => [service(11), service('9007199254740993'), service(21, '丽江'),
  service(31, '平潭', { roleCode: 'merchant', roleName: '合作商家' }), service(32, '平潭', { roleCode: 'merchant' }), service(99, '平潭', { active: false })]
const cityKey = city => 'service-city:' + encodeURIComponent(city)
let storage, calls
test.beforeEach(() => {
  storage = new Map(); calls = []
  globalThis.uni = { getStorageSync: key => storage.get(key), setStorageSync: (key, value) => storage.set(key, value), removeStorageSync: key => storage.delete(key),
    request: options => { calls.push(options); options.success({ data: { code: 200, data: { unread: 0 } } }) } }
  session.logout(); request.setToken('test-city-token')
})

test('几十家同城服务店合成一个身份，合作商家与异城、旧无城市授权保持分开', () => {
  const many = Array.from({ length: 40 }, (_, i) => service(100 + i))
  const source = [...grants(), ...many, service(71, ''), service(72, '')]
  const result = groupStaffIdentities(source)
  assert.equal(result.length, 6)
  assert.equal(result[0].storeIds.length, 42)
  assert.equal(result[0].storeIds[1], '9007199254740993')
  assert.equal(staffIdentityLabel(result[0]), '平潭 · 商家服务人')
  assert.deepEqual(result.filter(g => g.roleCode === 'merchant').map(g => g.storeId), [31, 32])
  assert.equal(source[0].identityKey, undefined, '实际授权不被UI聚合修改')
  assert.equal(findStaffIdentity(result, 99), null)
  assert.equal(findStaffIdentity(result, { ...result[0], identityKey: cityKey('未授权城') }), null)
})

test('旧门店缓存自动迁到城市身份；同城门店查看保留消息，不切换工作身份', async () => {
  storage.set('kangaroo:worker:staff-store', '9007199254740993')
  session.acceptAuthenticatedAccount({ id: 'worker', staffGrants: grants() })
  assert.equal(session.experience.staffStoreId, cityKey('平潭'))
  assert.equal(storage.get('kangaroo:worker:staff-store'), cityKey('平潭'))
  assert.equal(session.currentStaffStoreId(), 11)
  assert.equal(session.threeTabStaff.value, false, '服务人具备业务tab')
  session.experience.messages = [{ id: 'city-message', recipientId: 'worker', mode: 'staff' }]
  const scope = session.getMessageScopeKey()
  await session.selectStaffStore('9007199254740993')
  assert.equal(session.getMessageScopeKey(), scope)
  assert.equal(session.experience.messages.length, 1)
  assert.equal(calls.length, 0)
  await session.refreshUnread()
  assert.equal(calls[0].header['X-Message-Scope'], cityKey('平潭'))
})

test('切城与切到合作商家清空旧消息，消息请求使用各自scope', async () => {
  session.acceptAuthenticatedAccount({ id: 'worker', staffGrants: grants() })
  const old = session.getMessageScopeKey()
  session.experience.messages = [{ id: 'p' }]
  session.setStaffStore(session.staffIdentities.value.find(g => g.city === '丽江'))
  assert.equal(session.experience.messages.length, 0)
  assert.notEqual(session.getMessageScopeKey(), old)
  await session.refreshUnread()
  assert.equal(calls.at(-1).header['X-Message-Scope'], cityKey('丽江'))
  session.setStaffStore(31)
  assert.equal(session.currentStaffStore.value.roleCode, 'merchant')
  assert.equal(session.currentStaffStoreId(), 31)
  assert.equal(session.threeTabStaff.value, true)
  await session.refreshUnread()
  assert.equal(calls.at(-1).header['X-Message-Scope'], 'store:31:merchant')
})

test('员工读写续期均带选中的门店与角色；报名人确认不带员工身份', async () => {
  session.acceptAuthenticatedAccount({ id: 'worker', staffGrants: [service(52, '平潭', {roleCode:'manager'}), service(31, '平潭', {roleCode:'merchant'})] })
  session.setStaffStore(52)
  await api.apiApplicationDates(81, true)
  assert.equal(calls.at(-1).header['X-Message-Scope'], 'store:52:manager')
  session.setStaffStore(31)
  await api.apiProposeApplicationDates(81, {kind:'renewal', revision:3, endDate:'2027-01-01'})
  assert.equal(calls.at(-1).header['X-Message-Scope'], 'store:31:merchant')
  await api.apiConfirmApplicationDates(81, 4, 'renewal')
  assert.equal(calls.at(-1).header['X-Message-Scope'], undefined)
  assert.deepEqual(calls.at(-1).data, {revision:4,kind:'renewal'})
})

test('锚点撤权仍保留同城服务身份，撤掉全城授权后拒绝旧身份', async () => {
  session.acceptAuthenticatedAccount({ id: 'worker', staffGrants: [grants()[2], ...grants().filter(g => g.storeId !== 21)] })
  session.setStaffStore(11)
  globalThis.uni.request = options => options.success({ data: { code: 200, data: { id: 'worker', staffGrants: grants().filter(g => g.storeId !== 11) } } })
  const result = await session.recheckStaffAccess({ storeId: 11 })
  assert.equal(result.kind, 'lost')
  assert.equal(result.requestedLost, true)
  assert.equal(session.currentStaffStore.value.identityKey, cityKey('平潭'))
  assert.equal(session.currentStaffStoreId(), '9007199254740993')
  session.acceptAuthenticatedAccount({ id: 'worker', staffGrants: grants().filter(g => g.city !== '平潭') })
  assert.equal(session.currentStaffStore.value.city, '丽江')
  assert.throws(() => session.setStaffStore(cityKey('平潭')), /授权/)
})

test('城市筹备授权与已开通门店只显示一个服务身份，实际API使用真实门店', () => {
  const source = [service(null, '平潭', { cityId: 7 }), service(11)]
  session.acceptAuthenticatedAccount({ id: 'worker', staffGrants: source })
  assert.equal(session.staffIdentities.value.length, 1)
  assert.equal(session.staffStores.value.length, 2)
  assert.equal(session.currentStaffStoreId(), 11)
  assert.equal(session.staffStoreUrl('/pages/staff/service'), '/pages/staff/service?storeId=11')
  session.setStaffStore(source[0])
  assert.equal(session.currentStaffStoreId(), 11)
  session.acceptAuthenticatedAccount({ id: 'other', staffGrants: [service(21, '丽江')] })
  assert.equal(session.currentStaffStore.value.city, '丽江')
})

test('微信提醒新旧链接都落到同一城市服务身份，商家提醒仍按店且撤权不匹配', () => {
  for (const scope of [cityKey('平潭'), encodeURIComponent(cityKey('平潭')), 'service-city:平潭', 'store:11:merchant_service', 'store:9007199254740993:merchant_service']) {
    assert.equal(staffIdentityForMessageScope(grants(), scope).identityKey, cityKey('平潭'))
  }
  assert.equal(staffIdentityForMessageScope(grants(), 'store:31:merchant').storeId, 31)
  for (const scope of [cityKey('未授权'), 'store:99:merchant_service', 'store:31:merchant_service', 'service-city:%E5']) {
    assert.equal(staffIdentityForMessageScope(grants(), scope), null)
  }
})
