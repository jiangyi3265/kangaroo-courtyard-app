// Run the production page setup with controlled HTTP responses. No live requests.
import fs from 'node:fs'
import vm from 'node:vm'
import test from 'node:test'
import assert from 'node:assert/strict'
import { parse, babelParse } from '@vue/compiler-sfc'
import * as vue from 'vue'
import * as view from '../pages/staff/request-view.js'
import { useRequestList } from '../pages/staff/request-list.js'

function page(name, overrides = {}) {
  const source = parse(fs.readFileSync(new URL('../pages/staff/' + name, import.meta.url), 'utf8')).descriptor.scriptSetup.content
  const ast = babelParse(source, { sourceType: 'module' })
  let boot
  const s = vue.ref(1), selected = [], gone = [], messages = [], requests = []
  const grant = { storeId: 102, city: '平潭', roleCode: 'merchant_service', scopeKind: 'service-city' }
  const sandbox = { console, ...vue, ...view, useRequestList, useScreen: (_, opts) => { boot = opts.onLoad; return s },
    onShow() {}, onUnload() {}, onReachBottom() {}, onPullDownRefresh() {},
    ensureSession: async () => {}, hasStaffAccess: { value: true }, merchantService: { value: true }, currentAlsoService: { value: false },
    currentStaffStore: { value: grant }, currentStaffStoreId: () => 102,
    staffStores: vue.ref([grant, { storeId: 201, city: '平潭', roleCode: 'merchant_service' }, { storeId: 301, city: '丽江', roleCode: 'merchant_service' }]),
    refreshAccount: async () => {}, selectStaffStore: async value => selected.push(value),
    get: async (url, params) => { requests.push([url, params]); return { data: { rows: [], total: 0, hasMore: false, city: '平潭' } } },
    post: async (url, body) => { requests.push([url, body]); return { msg: '已处理' } },
    toast: message => messages.push(message), go: url => gone.push(url), back() {}, errText: (error, fallback) => error?.message || fallback,
    confirm: async () => true, prompt: async () => null, absUrl: value => value,
    R: { staffOnline: '/pages/staff/online-jobs', staffApplications: '/pages/staff/applications' },
    uni: { showToast: ({ title }) => messages.push(title), stopPullDownRefresh() {} }, ...overrides }
  const body = ast.program.body.filter(node => node.type !== 'ImportDeclaration').map(node => source.slice(node.start, node.end)).join('\n')
  vm.createContext(sandbox)
  const scope = vue.effectScope()
  scope.run(() => vm.runInContext(body, sandbox))
  return { sandbox, s, selected, gone, messages, requests, boot: query => boot(query), run: code => vm.runInContext(code, sandbox), stop: () => scope.stop() }
}

test('service message keeps city identity and uses its anchor for request actions', async t => {
  const requests = []
  const h = page('service.vue', { get: async (url, params) => {
    requests.push([url, params])
    return { data: { requestId: 7, requestType: 'online_task', storeId: 201, city: '平潭', status: 'forwarded', mine: true } }
  } })
  t.after(h.stop)
  await h.boot({ requestId: '7', storeId: '201' })
  assert.deepEqual(h.selected, [])
  assert.equal(requests[0][1].storeId, 102)
  assert.equal(h.run('detail.value.storeId'), 201)
  await h.run('runMain()')
  assert.equal(h.requests[0][0], '/app/staff/service/requests/7/accept?storeId=102')
})

test('opening tasks and applications carries merchant context without changing identity', async t => {
  const h = page('service.vue')
  t.after(h.stop)
  await h.run('openTask(201, 88)')
  await h.run('openApps(201)')
  assert.deepEqual(h.selected, [])
  assert.deepEqual(h.gone, ['/pages/staff/online-jobs?jobId=88&storeId=201', '/pages/staff/applications?jobType=online&storeId=201'])
  await h.run('openTask(301, 89)')
  assert.equal(h.gone.length, 2, 'another city cannot reuse the active city service identity')
  assert.match(h.messages.at(-1), /授权已失效/)
  h.sandbox.staffStores.value = [h.sandbox.currentStaffStore.value]
  await h.run('openApps(201)')
  assert.equal(h.gone.length, 2, 'revoked authorization cannot open a merchant application list')
  h.sandbox.refreshAccount = async () => { h.sandbox.currentStaffStore.value = { ...h.sandbox.currentStaffStore.value, city: '丽江' } }
  await h.run('openTask(201, 88)')
  assert.equal(h.gone.length, 2)
  assert.match(h.messages.at(-1), /身份已变化/, 'a refresh that changes the active service city cannot continue the old action')
})

test('activity notification locates a later page under the same city identity', async t => {
  const requests = []
  const h = page('service-activities.vue', { get: async (url, params) => {
    requests.push([url, params])
    return { data: { rows: [{ activityId: params.pageNum === 1 ? 1 : 88, storeId: 201, storeName: '商家乙' }], hasMore: params.pageNum === 1, total: 2, city: '平潭' } }
  } })
  t.after(h.stop)
  await h.boot({ id: '88', storeId: '201' })
  assert.deepEqual(h.selected, [])
  assert.deepEqual(requests.map(([, params]) => [params.storeId, params.pageNum]), [['201', 1], ['201', 2]])
  assert.equal(h.s.value, 2)
  assert.equal(h.run('current.value.activityId'), 88)
  await h.run('audit(true)')
  assert.equal(h.requests[0][0], '/app/staff/service/activities/88/audit?storeId=201')
})

test('a failed identity switch stops the activity request; retry reopens the original notice', async t => {
  let allowed = false
  const queries = []
  const h = page('service-activities.vue', {
    merchantService: { value: false },
    KEEPER_ACTIVITIES_API: '/app/staff/keeper/activities',
    selectStaffStore: async () => { if (!allowed) throw new Error('门店授权已失效') },
    get: async (_, q) => { queries.push(q); return { data: { rows: [{ activityId: 88 }] } } }
  })
  t.after(h.stop)
  h.s.value = 2
  await h.boot({ id: '88', storeId: '201', as: 'keeper' })
  assert.equal(h.s.value, 1)
  assert.equal(h.run('entryError.value'), '门店授权已失效')
  assert.equal(queries.length, 0)
  allowed = true
  await h.run('retryEntry()')
  assert.equal(queries[0].storeId, '201')
  assert.equal(h.s.value, 2)
  assert.equal(h.run('current.value.activityId'), 88)
})

test('failed activity pagination stops instead of retrying or reporting already handled', async t => {
  let calls = 0
  const h = page('service-activities.vue', { get: async (_url, params) => {
    calls++
    if (params.pageNum > 1) throw new Error('网络连接失败')
    return { data: { rows: [{ activityId: 1 }], hasMore: true, total: 2 } }
  } })
  const previousUni = globalThis.uni
  globalThis.uni = h.sandbox.uni
  t.after(() => { h.stop(); globalThis.uni = previousUni })
  await h.boot({ id: '88', storeId: '201' })
  assert.equal(calls, 2)
  assert.equal(h.s.value, 1)
  assert.deepEqual(h.messages, ['网络连接失败'])
})
