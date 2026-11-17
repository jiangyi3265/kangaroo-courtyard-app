import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import { fileURLToPath } from 'node:url'
import test from 'node:test'
import assert from 'node:assert/strict'
import { parse, babelParse, compileTemplate } from '@vue/compiler-sfc'
import { ref } from 'vue'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const cityPage = fs.readFileSync(path.join(root, 'pages/home/city.vue'), 'utf8')
const script = parse(cityPage).descriptor.scriptSetup.content
const loader = babelParse(script, { sourceType: 'module' }).program.body.find(node => node.type === 'FunctionDeclaration' && node.id.name === 'loadOverview')

function pending() {
  let resolve, reject
  const promise = new Promise((done, fail) => { resolve = done; reject = fail })
  return { promise, resolve, reject }
}

function context(requests) {
  const scope = vm.createContext({
    city: ref('厦门'),
    ov: ref({ builders: [{ userId: 1, name: '上一位共建人' }] }),
    apiCityOverview: () => requests.shift().promise
  })
  vm.runInContext('let overviewRequest = 0;\n' + script.slice(loader.start, loader.end), scope)
  return expression => vm.runInContext(expression, scope)
}

test('切城后较早的响应不能带回其他城市共建人', async () => {
  const first = pending(), second = pending()
  const run = context([first, second])
  const old = run('loadOverview()')
  assert.equal(run('ov.value.builders.length'), 0)
  run("city.value = '平潭'")
  const current = run('loadOverview()')
  second.resolve({ data: { builders: [{ userId: 2, name: '平潭共建人' }] } })
  await current
  first.resolve({ data: { builders: [{ userId: 3, name: '厦门共建人' }] } })
  await old
  assert.equal(run('ov.value.builders[0].name'), '平潭共建人')
})

test('返回城市页刷新时先清除旧署名，接口失败也不会保留已隐藏的旧荣誉', async () => {
  const request = pending()
  const run = context([request])
  const loading = run('loadOverview()')
  assert.equal(run('ov.value.builders.length'), 0)
  request.reject(new Error('网络异常'))
  await loading
  assert.equal(run('ov.value.builders.length'), 0)
  assert.match(script, /onShow\(\(\) => \{ if \(overviewRequest > 0 && s\.value === 1\) loadOverview\(\) \}\)/)
})

test('城市署名按真实用户跳转并沿用现有徽章图标，全部城市隐藏署名区', () => {
  const { descriptor } = parse(cityPage)
  assert.match(descriptor.template.content, /city !== ALL && ov\.builders\?\.length/)
  assert.match(descriptor.template.content, /R\.userProfile \+ '\?uid=' \+ builder\.userId/)
  assert.match(descriptor.template.content, /name="medal"/)
  assert.doesNotMatch(descriptor.template.content, /builder\.(?:phone|sourceNote|sourceKey|awardedBy)/)
  const compiled = compileTemplate({ source: descriptor.template.content, filename: 'city.vue', id: 'city-builder-test' })
  assert.deepEqual(compiled.errors, [])
})

test('后台历史奖章提供城市补录入口与调整依据', () => {
  const source = fs.readFileSync(path.resolve(root, '../RuoYi-Vue3/src/views/kangaroo/governance/Badges.vue'), 'utf8')
  const { descriptor } = parse(source)
  assert.match(source, /待补录城市/)
  assert.match(source, /badges\/'\+editingCity\.value\.awardId\+'\/city/)
  assert.match(source, /cityForm\.value\.note\.trim\(\)\.length<5/)
  assert.match(source, /cityForm\.value\.note\.trim\(\)\.length>360/)
  assert.match(source, /v-model="cityForm.note"[^>]*maxlength="360"/)
  const compiled = compileTemplate({ source: descriptor.template.content, filename: 'Badges.vue', id: 'badge-city-test' })
  assert.deepEqual(compiled.errors, [])
})
