import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import { fileURLToPath } from 'node:url'
import test from 'node:test'
import assert from 'node:assert/strict'
import { parse, babelParse } from '@vue/compiler-sfc'
import { ref } from 'vue'

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

function deferred() {
  let resolve, reject
  const promise = new Promise((done, fail) => {
    resolve = done
    reject = fail
  })
  return { promise, resolve, reject }
}

function page(relativePath, overrides) {
  const source = fs.readFileSync(path.resolve(appRoot, relativePath), 'utf8')
  const script = parse(source).descriptor.scriptSetup.content
  const statements = babelParse(script, { sourceType: 'module' }).program.body
  const body = statements.filter(node => node.type !== 'ImportDeclaration')
    .map(node => script.slice(node.start, node.end)).join('\n')
  const scope = vm.createContext({ ref, onMounted() {}, onShow() {}, onLoad() {}, ...overrides })
  vm.runInContext(body, scope)
  return expression => vm.runInContext(expression, scope)
}

test('商城返回页面时旧请求不能覆盖刚兑换后的余额和订单', async () => {
  const requests = Array.from({ length: 4 }, deferred)
  let index = 0
  const run = page('pages/profile/point-mall.vue', {
    get: () => requests[index++].promise
  })
  const before = run('load()')
  run("tab.value = 'orders'")
  const after = run('load()')
  requests[2].resolve({ data: { rows: [{ orderId: 8 }], total: 1 } })
  requests[3].resolve({ data: { balance: 40 } })
  await after
  requests[0].resolve({ data: { rows: [{ goodsId: 1 }], total: 1 } })
  requests[1].resolve({ data: { balance: 100 } })
  await before
  assert.equal(run('balance.value'), 40)
  assert.equal(run('rows.value[0].orderId'), 8)
})

test('商城较早请求的错误和结束事件不会干扰最新加载', async () => {
  const requests = Array.from({ length: 4 }, deferred)
  let index = 0
  const run = page('pages/profile/point-mall.vue', {
    get: () => requests[index++].promise
  })
  const before = run('load()')
  const after = run('load()')
  requests[0].reject(new Error('过期请求失败'))
  requests[1].resolve({ data: { balance: 100 } })
  await before
  assert.equal(run('loading.value'), true)
  assert.equal(run('error.value'), '')
  requests[2].resolve({ data: { rows: [], total: 0 } })
  requests[3].resolve({ data: { balance: 40 } })
  await after
  assert.equal(run('loading.value'), false)
})

test('后台切到兑换记录后旧商品响应不能覆盖兑换记录', async () => {
  const goods = deferred()
  const orders = deferred()
  const urls = []
  const run = page('../RuoYi-Vue3/src/views/kangaroo/point-mall/index.vue', {
    request: options => {
      urls.push(options.url)
      return options.url.endsWith('/goods') ? goods.promise : orders.promise
    }
  })
  const before = run('load()')
  run("tab.value = 'orders'")
  const after = run('load()')
  orders.resolve({ data: { rows: [{ orderId: 8 }], total: 1 } })
  await after
  goods.resolve({ data: { rows: [{ goodsId: 1 }], total: 20 } })
  await before
  assert.equal(run('rows.value[0].orderId'), 8)
  assert.equal(run('total.value'), 1)
  assert.deepEqual(urls, ['/kangaroo/point-mall/goods', '/kangaroo/point-mall/orders'])
})

test('后台旧请求结束时仍保留新请求的加载状态', async () => {
  const requests = [deferred(), deferred()]
  let index = 0
  const run = page('../RuoYi-Vue3/src/views/kangaroo/point-mall/index.vue', {
    request: () => requests[index++].promise
  })
  const before = run('load()')
  const after = run('load()')
  requests[0].resolve({ data: { rows: [], total: 0 } })
  await before
  assert.equal(run('loading.value'), true)
  requests[1].resolve({ data: { rows: [], total: 0 } })
  await after
  assert.equal(run('loading.value'), false)
})

for (const [label, relativePath] of [
  ['商家', 'pages/staff/publication-fees.vue'],
  ['后台', '../RuoYi-Vue3/src/views/kangaroo/publication-fees/index.vue']
]) {
  test(`${label}发布费用翻页时保留最新账单和收费配置`, async () => {
    const requests = [deferred(), deferred()]
    let index = 0
    const fetch = () => requests[index++].promise
    const run = page(relativePath, {
      request: fetch,
      get: fetch,
      ensureSession: async () => {},
      currentStaffStoreId: () => 10
    })
    const before = run('load()')
    await Promise.resolve()
    run('page.value = 2')
    const after = run('load()')
    await Promise.resolve()
    requests[1].resolve({ data: {
      rows: [{ feeId: 2 }], total: 25,
      config: { enabled: '1', version: 2, amountFen: 500 }
    } })
    await after
    requests[0].resolve({ data: {
      rows: [{ feeId: 1 }], total: 24,
      config: { enabled: '0', version: 1, amountFen: 0 }
    } })
    await before
    assert.equal(run('rows.value[0].feeId'), 2)
    assert.equal(run('config.value.version'), 2)
    assert.equal(run('total.value'), 25)
  })
}
