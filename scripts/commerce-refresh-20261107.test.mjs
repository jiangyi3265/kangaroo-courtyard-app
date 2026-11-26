import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import { fileURLToPath } from 'node:url'
import test from 'node:test'
import assert from 'node:assert/strict'
import { parse, babelParse } from '@vue/compiler-sfc'
import { ref, computed } from 'vue'

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
  const scope = vm.createContext({ ref, computed, getToken: () => 'test', onMounted() {}, onShow() {}, onLoad() {}, ...overrides })
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

test('从兑换记录返回商城遇到断网时清掉旧订单、余额和页数', async () => {
  let offline = false
  const run = page('pages/profile/point-mall.vue', {
    get: async url => {
      if (offline) throw Error('网络断开')
      return { data: url.endsWith('balance') ? { balance: 32 } : { rows: [{ orderId: 8 }], total: 26 } }
    }
  })
  run("tab.value = 'orders'")
  await run('load()')
  offline = true
  await run("switchTab('goods')")
  assert.equal(run('rows.value.length'), 0)
  assert.equal(run('total.value'), 0)
  assert.equal(run('balance.value'), null)
  assert.equal(run('error.value'), '网络断开')
})

test('连点确认收货只弹一次询问并只提交一次，取消后还可以操作', async () => {
  let confirmations = 0, commands = 0
  const prompt = deferred()
  const run = page('pages/profile/point-mall.vue', {
    modal: () => { confirmations++; return prompt.promise },
    post: async () => { commands++ },
    get: async () => ({ data: { rows: [], total: 0, balance: 5 } })
  })
  const a = run("command({orderId: 5}, 'receive')")
  const b = run("command({orderId: 5}, 'receive')")
  prompt.resolve({ confirm: false })
  await Promise.all([a, b])
  assert.equal(confirmations, 1)
  assert.equal(commands, 0)
  assert.equal(run('busy.value'), false)
  const yes = page('pages/profile/point-mall.vue', {
    modal: async () => ({ confirm: true }), post: async () => { commands++ },
    get: async () => ({ data: { rows: [], total: 0, balance: 5 } })
  })
  await Promise.all([yes("command({orderId: 5}, 'receive')"), yes("command({orderId: 5}, 'receive')")])
  assert.equal(commands, 1)
})

test('切换钱包筛选时旧账单不能显示、导出或改写新的日期', async () => {
  const requests = Array.from({ length: 3 }, deferred)
  let index = 0
  const copies = []
  const run = page('pages/manage/wallet.vue', {
    watch() {}, useScreen: () => ref(2), apiWalletEntries: () => requests[index++].promise,
    toast() {}, copy: text => copies.push(text), errText: e => e.message
  })
  const previous = run('loadEntries()')
  run("from.value = '2026-10-01'; to.value = '2026-10-31'")
  const latest = run('loadEntries()')
  requests[1].resolve({ data: { rows: [{ id: 'OCT' }], from: '2026-10-01', to: '2026-10-31' } })
  await latest
  requests[0].resolve({ data: { rows: [{ id: 'NOV' }], from: '2026-11-01', to: '2026-11-25' } })
  await previous
  assert.equal(run('rows.value[0].id'), 'OCT')
  assert.equal(run('from.value'), '2026-10-01')
  run('exportEntries()')
  assert.match(copies[0], /OCT/)
  run("keyword.value = '新订单'")
  const offline = run('loadEntries()')
  run('exportEntries()')
  requests[2].reject(Error('网络断开'))
  await offline
  run('exportEntries()')
  assert.equal(copies.length, 1)
  assert.equal(run('rows.value.length'), 0)
})

test('重新进入商城换了账号时清掉前一个账号的收货草稿', async () => {
  let token = 'first'
  const run = page('pages/profile/point-mall.vue', {
    getToken: () => token,
    get: async () => ({data: { rows: [], total: 0, balance: 20 }})
  })
  run("choose({goodsId: 9}); form.value = { recipient: '旧收货人', phone: '13800000000', address: '原收货地址' }")
  token = 'second'
  await run('load()')
  assert.equal(run('selected.value'), null)
  assert.equal(run('form.value.recipient'), '')
  assert.equal(run('form.value.phone'), '')
  assert.equal(run('form.value.address'), '')
})

test('连点提交结算只弹一次确认，取消后仍能正常提交', async () => {
  const prompt = deferred()
  let confirmations = 0
  const posted = []
  const run = page('pages/manage/wallet.vue', {
    watch() {}, useScreen: () => ref(3), fmtNum: value => String(value),
    confirm: () => ++confirmations === 1 ? prompt.promise : Promise.resolve(true),
    apiWalletWithdraw: async body => { posted.push(body); return { data: {} } },
    apiWallet: async () => ({ data: {} }), toast() {}
  })
  run("w.value = { payee: '测试收款人', availableFen: 5000 }; amountFen.value = 1000")
  const a = run('submitWithdraw()')
  const b = run('submitWithdraw()')
  prompt.resolve(false)
  await Promise.all([a, b])
  assert.equal(confirmations, 1)
  assert.equal(posted.length, 0)
  await run('submitWithdraw()')
  assert.equal(confirmations, 2)
  assert.equal(posted.length, 1)
  assert.equal(posted[0].amountFen, 1000)
})
