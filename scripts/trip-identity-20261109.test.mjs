import fs from 'node:fs'
import vm from 'node:vm'
import test from 'node:test'
import assert from 'node:assert/strict'
import { parse, babelParse, compileTemplate } from '@vue/compiler-sfc'
import { ref, computed, reactive } from 'vue'
import { workIdentity } from '../pages/staff/work-identity.js'

const read = file => fs.readFileSync(new URL('../' + file, import.meta.url), 'utf8')
function setup(file, stubs = {}) {
  const descriptor = parse(read(file)).descriptor
  const source = descriptor.scriptSetup.content
  const nodes = babelParse(source, { sourceType: 'module' }).program.body
  const sandbox = { console, setTimeout, clearTimeout }
  for (const node of nodes.filter(n => n.type === 'ImportDeclaration')) for (const spec of node.specifiers) sandbox[spec.local.name] = () => {}
  Object.assign(sandbox, { ref, computed, reactive, workIdentity, useScreen: () => ref(1) }, stubs)
  vm.createContext(sandbox)
  vm.runInContext(nodes.filter(n => n.type !== 'ImportDeclaration').map(n => source.slice(n.start, n.end)).join('\n'), sandbox)
  return { run: source => vm.runInContext(source, sandbox), descriptor }
}

test('工作台显示本人姓名，门店和城市只显示为授权范围', () => {
  assert.deepEqual(workIdentity({ nickname: ' 商家小杨 ' }, { storeName: '平潭小院', roleCode: 'merchant' }), { name: '商家小杨', scope: '平潭小院', role: '合作商家' })
  assert.equal(workIdentity(null, { storeName: '平潭小院' }).name, '姓名待完善')
  assert.equal(workIdentity({ nickname: '小林' }, { city: '玉林', roleCode: 'city_lead' }).scope, '玉林')
})

test('商家切换账号后，首页姓名随真实账号更新', () => {
  const experience = reactive({ account: { nickname: '小杨' } })
  const currentStaffStore = ref({ storeId: 1, storeName: '平潭小院', roleCode: 'merchant' })
  const h = setup('pages/staff/components/k-merchant-work.vue', { experience, currentStaffStore, staffStores: ref([currentStaffStore.value]), R: {} })
  assert.equal(h.run('identity.value.name'), '小杨')
  experience.account = { nickname: '小林' }
  assert.equal(h.run('identity.value.name'), '小林')
  assert.equal(h.run('identity.value.scope'), '平潭小院')
})

test('空门店城市负责人不请求门店API，切换后清除旧门店数字', async () => {
  let requests = 0
  const h = setup('pages/staff/components/k-city-work.vue', {
    experience: { account: { nickname: '小林' } }, currentStaffStore: ref({ cityId: 1, city: '玉林', roleCode: 'city_lead' }),
    staffStores: ref([]), ensureSession: async () => {}, getSessionRevision: () => 1,
    get: async () => { requests++; return { data: {} } }, apiStaffHub: async () => { requests++; return { data: {} } }, R: {}
  })
  h.run('recent.value = [{ requestId: 1 }]; overview.value = { arriving: 5 }; switched.value = true; summary.value = { storeCount: 5 }')
  await h.run('load()')
  assert.equal(requests, 0)
  assert.equal(h.run('city.value'), '玉林')
  assert.equal(h.run('recent.value.length'), 0)
  assert.equal(h.run('overview.value'), null)
  assert.equal(h.run('switched.value'), false)
  assert.equal(h.run('summary.value'), null)
})

test('行程横排入口分别发布、加载同行候选、加载我的公开行程', async () => {
  const nav = [], sheets = [], calls = []
  const h = setup('pages/community/trip.vue', {
    R: { chat: '/pages/messages/chat' }, go: route => nav.push(route),
    apiMatches: async () => { calls.push('matches'); return { data: { people: [], needPlan: false } } },
    apiMyPlans: async () => { calls.push('mine'); return { data: [{ planId: 9, city: '平潭', startDate: '2026-11-09', endDate: '2026-11-19', status: 'online' }] } },
    sheet: async labels => { sheets.push(labels); return -1 }
  })
  h.run('publishPlan()')
  assert.equal(nav[0], '/pages/messages/chat?view=trip-publish')
  await h.run('openMatches()')
  assert.equal(h.run('s.value'), 3)
  await h.run('myPlans()')
  assert.deepEqual(calls, ['matches', 'mine'])
  assert.equal(sheets.length, 1)
  assert.match(sheets[0][0], /平潭/)
})

test('改动页面模板可编译', () => {
  for (const file of ['pages/community/trip.vue', 'pages/staff/business.vue', ...['merchant', 'city', 'service', 'online'].map(role => `pages/staff/components/k-${role}-work.vue`)]) {
    const parsed = parse(read(file))
    assert.deepEqual(parsed.errors, [], file)
    assert.deepEqual(compileTemplate({ source: parsed.descriptor.template.content, filename: file, id: 'trip-identity' }).errors, [], file)
  }
})

test('业务页切入无门店城市身份不把城市编号发送给门店API', async () => {
  const calls = [], cityGrant = { cityId: 35, city: '玉林', roleCode: 'city_lead', active: true, fullAccess: true }
  const h = setup('pages/staff/business.vue', {
    R: { staff: '/pages/staff/index' }, staffStores: ref([cityGrant]), currentStaffStore: ref({ storeId: 7, roleCode: 'keeper' }),
    staffGrantKey: g => g?.storeId ?? (g?.cityId != null ? 'city:' + g.cityId : g), currentStaffStoreId: () => 7,
    getSessionRevision: () => 1, refreshAccount: async () => calls.push('refresh'), selectStaffStore: async g => calls.push(g.city),
    apiStaffSwitchStore: async () => calls.push('BAD_API'), apiStaffStoreInfo: async () => calls.push('BAD_INFO'),
    relaunch: route => calls.push(route)
  })
  h.run('preview(storeList.value[0])')
  assert.equal(h.run('viewId.value'), 'city:35')
  await h.run('loadStores()')
  await h.run('switchStore()')
  assert.deepEqual(calls, ['refresh', '玉林', '/pages/staff/index'])
})
