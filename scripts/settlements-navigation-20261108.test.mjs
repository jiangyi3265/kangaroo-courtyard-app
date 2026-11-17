import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import { fileURLToPath } from 'node:url'
import test from 'node:test'
import assert from 'node:assert/strict'
import { parse, babelParse } from '@vue/compiler-sfc'
import { ref, computed } from 'vue'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const source = parse(fs.readFileSync(path.join(root, 'pages/staff/settlements.vue'), 'utf8')).descriptor.scriptSetup.content
const body = babelParse(source, { sourceType: 'module' }).program.body
  .filter(node => node.type !== 'ImportDeclaration')
  .map(node => source.slice(node.start, node.end)).join('\n')

function pending() {
  let resolve, reject
  const promise = new Promise((done, fail) => { resolve = done; reject = fail })
  return { promise, resolve, reject }
}

function setup({ deferList = false } = {}) {
  const requests = []
  const posts = []
  const scope = vm.createContext({
    ref, computed, onShow() {}, watch() {},
    currentStaffStore: ref({ storeId: 10 }),
    ensureSession: async () => {},
    get(url) {
      if (url === '/app/staff/business-bills' && !deferList) return Promise.resolve({ data: { rows: [], hasMore: false } })
      const request = pending()
      requests.push({ url, ...request })
      return request.promise
    },
    post(url, data) {
      const request = pending()
      posts.push({ url, data, ...request })
      return request.promise
    },
    requireMerchantTransfer() {}, confirmMerchantTransfer() {},
  })
  vm.runInContext(body, scope)
  return { run: expression => vm.runInContext(expression, scope), requests, posts }
}

test('连续打开两笔账单，晚到的旧详情不能覆盖最新选择', async () => {
  const h = setup()
  const first = h.run('view(1)'), second = h.run('view(2)')
  h.requests[1].resolve({ data: { billId: 2 } })
  await second
  h.requests[0].resolve({ data: { billId: 1 } })
  await first
  assert.equal(h.run('detail.value.billId'), 2)
})

test('切换账单分类后，之前的详情请求不能重新打开详情', async () => {
  const h = setup()
  const detail = h.run('view(1)')
  h.run("filter('parttime')")
  h.requests[0].resolve({ data: { billId: 1 } })
  await detail
  assert.equal(h.run('detail.value'), null)
  assert.equal(h.run('kind.value'), 'parttime')
})

test('打开工资登记后，之前的账单请求不能遮住工资表单', async () => {
  const h = setup()
  const detail = h.run('view(1)'), work = h.run('openWork()')
  h.requests[1].resolve({ data: [{ appId: 3, realName: '测试人员', title: '兼职', jobType: 'parttime' }] })
  await work
  h.requests[0].resolve({ data: { billId: 1 } })
  await detail
  assert.equal(h.run('detail.value'), null)
  assert.equal(h.run('workOpen.value'), true)
})

test('打开账单后，之前的工资人员请求不能切回登记表单', async () => {
  const h = setup()
  const work = h.run('openWork()'), detail = h.run('view(2)')
  h.requests[1].resolve({ data: { billId: 2 } })
  await detail
  h.requests[0].resolve({ data: [{ appId: 3 }] })
  await work
  assert.equal(h.run('detail.value.billId'), 2)
  assert.equal(h.run('workOpen.value'), false)
})

test('旧请求失败不能把错误写到已经打开的新账单', async () => {
  const h = setup()
  const first = h.run('view(1)'), second = h.run('view(2)')
  h.requests[1].resolve({ data: { billId: 2 } })
  await second
  h.requests[0].reject(Error('旧账单请求失败'))
  await first
  assert.equal(h.run('error.value'), '')
})

test('切换门店后，旧门店人员请求失败不会污染当前页面', async () => {
  const h = setup()
  const work = h.run('openWork()')
  h.run('currentStaffStore.value = { storeId: 20 }')
  h.requests[0].reject(Error('旧门店无权访问'))
  await work
  assert.equal(h.run('error.value'), '')
  assert.equal(h.run('workOpen.value'), false)
})

test('工资保存完成时已切换分类，保留用户当前列表', async () => {
  const h = setup()
  h.run("work.value = { appId: 3, workDate: '2026-11-08', yuan: '200', basis: '确认当天工资' }")
  const saving = h.run('saveWork()')
  assert.equal(h.posts[0].data.baseFen, 20000)
  h.run("filter('stay')")
  h.posts[0].resolve({ data: 7 })
  await saving
  assert.equal(h.run('detail.value'), null)
  assert.equal(h.run('kind.value'), 'stay')
  assert.equal(h.requests.length, 0)
})

test('工资保存后刷新列表期间打开其他账单，不重新打开已保存账单', async () => {
  const h = setup({ deferList: true })
  h.run("work.value = { appId: 3, workDate: '2026-11-08', yuan: '200', basis: '确认当天工资' }")
  const saving = h.run('saveWork()')
  h.posts[0].resolve({ data: 7 })
  await new Promise(resolve => setImmediate(resolve))

  const selected = h.run('view(2)')
  h.requests.find(request => request.url.endsWith('/2')).resolve({ data: { billId: 2 } })
  await selected
  h.requests.find(request => request.url === '/app/staff/business-bills').resolve({ data: { rows: [], hasMore: false } })
  await new Promise(resolve => setImmediate(resolve))
  const staleDetail = h.requests.find(request => request.url.endsWith('/7'))
  staleDetail?.resolve({ data: { billId: 7 } })
  await saving

  assert.equal(h.run('detail.value.billId'), 2)
  assert.equal(staleDetail, undefined)
})

test('工资保存后刷新列表期间切换门店，不读取旧门店的已保存账单', async () => {
  const h = setup({ deferList: true })
  h.run("work.value = { appId: 3, workDate: '2026-11-08', yuan: '200', basis: '确认当天工资' }")
  const saving = h.run('saveWork()')
  h.posts[0].resolve({ data: 7 })
  await new Promise(resolve => setImmediate(resolve))

  h.run('currentStaffStore.value = { storeId: 20 }')
  h.requests.find(request => request.url === '/app/staff/business-bills').resolve({ data: { rows: [], hasMore: false } })
  await new Promise(resolve => setImmediate(resolve))
  const staleDetail = h.requests.find(request => request.url.endsWith('/7'))
  staleDetail?.resolve({ data: { billId: 7 } })
  await saving

  assert.equal(h.run('detail.value'), null)
  assert.equal(staleDetail, undefined)
})
