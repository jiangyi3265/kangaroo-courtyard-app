import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'

const source = fs.readFileSync(new URL('../components/k-tabbar/k-tabbar.vue', import.meta.url), 'utf8')
const script = source.split('<script setup>')[1].split('</script>')[0].replace(/^import .*$/gm, '')
function tabbar(three = false, online = false, storeId = 1, service = false) {
  const calls = []
  const ctx = { computed: fn => ({ get value() { return fn() } }), defineOptions() {}, defineProps: () => ({ mode: 'staff', active: 'business' }),
    unreadCount: { value: 2 }, onlineStaff: { value: online }, merchantService: { value: service }, threeTabStaff: { value: three }, currentStaffStore: { value: { storeId } },
    getCurrentPages: () => [{ route: 'pages/staff/business' }], uni: { navigateTo: x => calls.push(['navigate', x.url]), reLaunch: x => calls.push(['relaunch', x.url]), showToast: x => calls.push(['toast', x.title]) } }
  vm.createContext(ctx)
  vm.runInContext(script + '\nglobalThis.api = { items, open, on }', ctx)
  return { ...ctx.api, calls, ctx }
}

test('business center uses the same role-aware footer as the workbench', () => {
  const business = fs.readFileSync(new URL('../pages/staff/business.vue', import.meta.url), 'utf8')
  assert.match(business, /<k-tabbar active="business" mode="staff"\s*\/>/)
  assert.doesNotMatch(business, /class="business-tabs"|const tabs =|const tabGo =/)
})
test('manager navigation provides five entries and publishing opens the real staff form', () => {
  const bar = tabbar()
  assert.deepEqual(Array.from(bar.items.value, x => x.label), ['工作台', '业务', '发布', '消息', '我的'])
  bar.open(bar.items.value[2])
  assert.deepEqual(bar.calls, [['navigate', '/pages/staff/jobs?s=2&kind=volunteer']])
  bar.open(bar.items.value[1])
  assert.equal(bar.calls[1][0], 'relaunch')
})
test('online staff publish into online task flow and merchant permissions retain their existing navigation', () => {
  const online = tabbar(false, true)
  online.open(online.items.value[2])
  assert.equal(online.calls[0][1], '/pages/staff/online-jobs?s=1')
  const merchant = tabbar(true)
  assert.deepEqual(Array.from(merchant.items.value, x => x.key), ['work', 'messages', 'profile'])
  assert.equal(merchant.on.value, 'work')
})
test('unopened cities cannot send empty-store publishing requests', () => {
  const city = tabbar(false, false, null)
  city.open(city.items.value[2])
  assert.deepEqual(city.calls, [['toast', '城市筹备中，开通门店后可发布']])
})

test('merchant service gets a city business tab without gaining the volunteer publish action', () => {
  const service = tabbar(false, false, 801, true)
  assert.deepEqual(Array.from(service.items.value, x => x.key), ['work', 'business', 'messages', 'profile'])
  assert.equal(service.on.value, 'business')
  service.open(service.items.value.find(x => x.key === 'business'))
  assert.deepEqual(service.calls, [['relaunch', '/pages/staff/business']])
  // Selecting another identity recomputes the footer; no stale service-only menu remains.
  service.ctx.merchantService.value = false
  service.ctx.threeTabStaff.value = true
  assert.deepEqual(Array.from(service.items.value, x => x.key), ['work', 'messages', 'profile'])
})

test('business message navigation follows unread counts and returns to the main business screen', () => {
  const bar = tabbar()
  let message = bar.items.value.find(item => item.key === 'messages')
  assert.equal(message.badge, 2)
  bar.ctx.unreadCount.value = 7
  message = bar.items.value.find(item => item.key === 'messages')
  assert.equal(message.badge, 7)
  bar.open(message)
  bar.open(bar.items.value.find(item => item.key === 'business'))
  assert.deepEqual(bar.calls, [['relaunch', '/pages/messages/index'], ['relaunch', '/pages/staff/business']])
})

test('switching to merchant or an unopened city cannot preserve a stale publish action', () => {
  const bar = tabbar()
  const publish = bar.items.value.find(item => item.key === 'publish')
  bar.ctx.threeTabStaff.value = true
  assert.deepEqual(Array.from(bar.items.value, item => item.key), ['work', 'messages', 'profile'])
  assert.equal(bar.on.value, 'work')
  bar.ctx.threeTabStaff.value = false
  bar.ctx.currentStaffStore.value = { cityId: 35, roleCode: 'manager', storeId: null }
  bar.open(publish)
  assert.deepEqual(bar.calls, [['toast', '城市筹备中，开通门店后可发布']])
  bar.ctx.currentStaffStore.value = { storeId: 8, roleCode: 'online_staff' }
  bar.ctx.onlineStaff.value = true
  bar.open(bar.items.value.find(item => item.key === 'publish'))
  assert.equal(bar.calls[1][1], '/pages/staff/online-jobs?s=1')
})
