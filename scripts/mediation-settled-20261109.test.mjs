import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import { parse, babelParse, compileScript, compileTemplate } from '@vue/compiler-sfc'
import { ref, computed, watch } from 'vue'

// 2026-11-09 主人拍板：调解已结案的订单双方都不能再发起；发起页、订单页按服务端给的原因显示
const pageUrl = new URL('../pages/governance/mediation.vue', import.meta.url)
const compUrl = new URL('../components/k-order-mediation/k-order-mediation.vue', import.meta.url)
const SETTLED = '这笔订单的调解已结案，不能再次发起'

function scriptBody(url) {
  const source = parse(fs.readFileSync(url, 'utf8')).descriptor.scriptSetup.content
  return babelParse(source, { sourceType: 'module' }).program.body
    .filter(node => node.type !== 'ImportDeclaration')
    .map(node => source.slice(node.start, node.end)).join('\n')
}

function page(data) {
  const calls = []
  const context = vm.createContext({
    ref, computed, onLoad() {}, onShow() {}, onHide() {}, onUnload() {}, watch() {}, getMessageScopeKey:()=> 'fixture', uni: {}, states: {}, juryChoices: [],
    get: async (path, q) => { calls.push({ path, q }); return { data: data[path] } },
    post: async () => ({ data: null })
  })
  vm.runInContext(scriptBody(pageUrl), context)
  return { run: code => vm.runInContext(code, context), calls }
}

const rows = [
  { orderType: 'application', orderId: 1, orderNo: 'A1', storeName: '小院', eligible: true },
  { orderType: 'application', orderId: 2, orderNo: 'A2', storeName: '小院', eligible: false, reason: SETTLED },
  { orderType: 'stay', orderId: 3, orderNo: 'S3', storeName: '小院', eligible: false }
]

test('发起页只列可调解的订单，另说明有几笔已结案', async () => {
  const h = page({ orders: { rows, total: 3 } })
  await h.run('loadOrders()')
  assert.equal(h.run('orders.value.length'), 1)
  assert.equal(h.run('orders.value[0].orderNo'), 'A1')
  assert.equal(h.run('settledCount.value'), 1)
})

test('从订单页带着已结案的订单进来：不选中，显示服务端原因', async () => {
  const h = page({ orders: { rows, total: 3 }, order: { orderType: 'application', orderId: 2, orderNo: 'A2', storeName: '小院', eligible: false, reason: SETTLED } })
  await h.run("targetOrder={type:'application',id:'2'};loadOrders()")
  assert.equal(h.run('selectedOrder.value'), null)
  assert.equal(h.run('error.value'), SETTLED)
  assert.equal(h.calls.at(-1).path, 'order')
})

test('可调解的订单照旧选中', async () => {
  const h = page({ orders: { rows, total: 3 }, order: { orderType: 'application', orderId: 1, orderNo: 'A1', storeName: '小院', eligible: true } })
  await h.run("targetOrder={type:'application',id:'1'};loadOrders()")
  assert.equal(h.run('selectedOrder.value.display'), '小院 · A1')
  assert.equal(h.run('error.value'), '')
})

function card(data) {
  const props = { orderType: 'application', orderId: 2, merchant: false }
  const context = vm.createContext({
    ref, watch, onShow() {}, defineProps: () => props, go() {},
    get: async () => ({ data })
  })
  vm.runInContext(scriptBody(compUrl), context)
  return code => vm.runInContext(code, context)
}

test('订单页的调解入口：已结案不给按钮，写原因；可调解照旧给按钮', async () => {
  let run = card({ eligible: false, reason: SETTLED })
  await new Promise(r => setTimeout(r, 0))
  assert.equal(run('eligible.value'), false)
  assert.equal(run('reason.value'), SETTLED)
  run = card({ eligible: true })
  await new Promise(r => setTimeout(r, 0))
  assert.equal(run('eligible.value'), true)
  assert.equal(run('reason.value'), '')
  run = card({ eligible: false })
  await new Promise(r => setTimeout(r, 0))
  assert.equal(run('reason.value'), '', '没有原因的不可调解订单整块不显示')
})

test('两个界面模板和脚本可编译，模板按原因显示', () => {
  for (const file of [pageUrl, compUrl]) {
    const text = fs.readFileSync(file, 'utf8')
    const result = parse(text, { filename: file.pathname })
    assert.deepEqual(result.errors, [])
    compileScript(result.descriptor, { id: 'mediation-settled' })
    assert.deepEqual(compileTemplate({ source: result.descriptor.template.content, filename: file.pathname, id: 'mediation-settled' }).errors, [])
  }
  assert.match(fs.readFileSync(pageUrl, 'utf8'), /已结案，不能再次发起/)
  assert.match(fs.readFileSync(compUrl, 'utf8'), /v-if="existingCaseId \|\| eligible \|\| reason"/)
})
