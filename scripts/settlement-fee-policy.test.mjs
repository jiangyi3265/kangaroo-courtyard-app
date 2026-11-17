import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import { fileURLToPath } from 'node:url'
import test from 'node:test'
import assert from 'node:assert/strict'
import { parse, babelParse } from '@vue/compiler-sfc'
import { ref, computed } from 'vue'

const workspace = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const source = parse(fs.readFileSync(path.join(workspace, 'RuoYi-Vue3/src/views/kangaroo/settlement/index.vue'), 'utf8')).descriptor.scriptSetup.content
const body = babelParse(source, { sourceType: 'module' }).program.body
  .filter(node => node.type !== 'ImportDeclaration')
  .map(node => source.slice(node.start, node.end)).join('\n')

function setup(bill) {
  const posts = []
  const context = vm.createContext({
    ref, computed, checkPermi: () => true,
    request: async ({ url, method, data }) => {
      if (method === 'post') { posts.push({ url, data }); return { data: {} } }
      if (url.endsWith('/stores')) return { data: [{ storeId: 10, opType: 'partner' }] }
      if (url.endsWith('/42')) return { data: bill }
      return { data: { rows: [], total: 0 } }
    },
  })
  vm.runInContext(body, context)
  return { run: expression => vm.runInContext(expression, context), posts }
}

const baseline = { billId: 42, kind: 'stay', baseFen: 10000, netFen: 8000, targetFen: 10000, remainingFen: 8000, version: 3 }

test('自营免服务费账单以退款后的实收作为审批金额，不沿用已核对旧金额', async () => {
  const h = setup({ ...baseline, directFeeFree: true, merchantFeePolicy: false, suggestTargetFen: 8000, rateBp: 0 })
  await h.run('view(42)')
  assert.equal(h.run('form.value.targetYuan'), '80.00')
  assert.equal(h.run('discountText(detail.value)'), '优惠已计入实付房费，自营免平台服务费')
  await h.run("command('approve')")
  assert.equal(h.posts.length, 1)
  assert.equal(h.posts[0].data.targetFen, 8000)
})

test('自营全部退款后可确认零结算，不回退到原结算价', async () => {
  const h = setup({ ...baseline, directFeeFree: true, netFen: 0, suggestTargetFen: 0, remainingFen: 0 })
  await h.run('view(42)')
  assert.equal(h.run('form.value.targetYuan'), '0.00')
  await h.run("command('approve')")
  assert.equal(h.posts[0].data.targetFen, 0)
})

test('旧自营5%账单继续使用历史试算，当前门店类型不覆盖账单快照', async () => {
  const h = setup({ ...baseline, directFeeFree: false, merchantFeePolicy: true, suggestTargetFen: 7600, rateBp: 500 })
  await h.run('view(42)')
  assert.equal(h.run('form.value.targetYuan'), '76.00')
  assert.equal(h.run('discountText(detail.value)'), '本单按原规则在优惠后实付房费内扣5%服务费')
  await h.run("command('approve')")
  assert.equal(h.posts[0].data.targetFen, 7600)
})

test('合作账单保留人工核对金额和折扣分摊提示', async () => {
  const h = setup({ ...baseline, targetFen: 7500, suggestTargetFen: 7600, discountShared: true })
  await h.run('view(42)')
  assert.equal(h.run('form.value.targetYuan'), '75.00')
  assert.equal(h.run('discountText(detail.value)'), '已按比例分摊到商家结算价和平台服务费')
  h.run("form.value.targetYuan = '74.00'")
  await h.run("command('approve')")
  assert.equal(h.posts[0].data.targetFen, 7400)
})

test('招聘工资手续费试算保留10%，不受自营房费政策影响', () => {
  const h = setup(baseline)
  h.run("work.value.yuan = '100.05'")
  assert.equal(h.run('previewFee.value'), 1001)
  assert.equal(h.run('previewNet.value'), 9004)
})
