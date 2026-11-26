import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import { createRequire } from 'node:module'
import { displayWording } from '../common/display-wording.js'
const require = createRequire(import.meta.url)
const { parse, babelParse, compileScript, compileTemplate } = require('@vue/compiler-sfc')
const { ref, watch } = require('vue')
const source = fs.readFileSync(new URL('../pages/search/index.vue', import.meta.url), 'utf8')
const descriptor = parse(source).descriptor
const script = descriptor.scriptSetup.content
const body = babelParse(script, { sourceType: 'module' }).program.body.filter(n => n.type !== 'ImportDeclaration').map(n => script.slice(n.start, n.end)).join('\n')
function harness() {
  const gone = []
  const sandbox = { ref, watch, recruitmentEnabled: ref(true), stayBookingEnabled: ref(true), displayWording, onLoad() {}, onReachBottom() {}, onUnload() {}, absUrl: v => v, go: url => gone.push(url), R: { jobDetail: '/pages/jobs/detail', stayDetail: '/pages/stays/detail' } }
  vm.createContext(sandbox); vm.runInContext(body, sandbox)
  return { gone, show: (item, tab = 'jobs') => { sandbox.item = item; sandbox.kind = tab; return vm.runInContext('tab.value = kind; titleOf(item)', sandbox) }, open: item => { sandbox.item = item; vm.runInContext('openResult(item)', sandbox) } }
}
test('a slow feature refresh preserves the chosen category and unsent text', async () => {
  let open, finish
  const refresh = new Promise(resolve => { finish = resolve })
  const requests = []
  const sandbox = {
    ref, watch, recruitmentEnabled: ref(true), stayBookingEnabled: ref(true),
    onLoad: fn => { open = fn }, onReachBottom() {}, onUnload() {},
    decodeQuery: query => query, refreshFeatures: () => refresh,
    uni: {hideKeyboard() {}, pageScrollTo() {}},
    apiJobList: async params => { requests.push(['jobs', params.keyword]); return {rows: [], total: 0} },
    apiStayList: async params => { requests.push(['stays', params.keyword]); return {data: {rows: [], total: 0}} }
  }
  vm.createContext(sandbox)
  vm.runInContext(body, sandbox)
  const init = open({keyword: '平潭'})
  vm.runInContext("switchTab('stays'); keyword.value = '尚在输入'", sandbox)
  finish()
  await init
  await new Promise(resolve => setImmediate(resolve))
  assert.equal(vm.runInContext('tab.value', sandbox), 'stays')
  assert.equal(vm.runInContext('submitted.value', sandbox), '平潭')
  assert.equal(vm.runInContext('keyword.value', sandbox), '尚在输入')
  assert.deepEqual(requests.at(-1), ['stays', '平潭'])
  sandbox.recruitmentEnabled.value = false
  await new Promise(resolve => setImmediate(resolve))
  assert.equal(vm.runInContext('keyword.value', sandbox), '尚在输入')
  assert.equal(requests.length, 2)
})
test('a failed first search has a retry and shows the count only after a successful response', async () => {
  let open, fails = true
  const sandbox = {
    ref, watch, recruitmentEnabled: ref(true), stayBookingEnabled: ref(true),
    onLoad: fn => { open = fn }, onReachBottom() {}, onUnload() {},
    decodeQuery: query => query, refreshFeatures: async () => {},
    uni: {hideKeyboard() {}, pageScrollTo() {}},
    apiJobList: async () => { if (fails) throw Error('连接失败'); return {rows: [], total: 0} }
  }
  vm.createContext(sandbox)
  vm.runInContext(body, sandbox)
  open({keyword: '平潭'})
  await new Promise(resolve => setImmediate(resolve))
  const countCondition = descriptor.template.content.match(/<text v-if="([^"]+)" class="result-count"/)[1]
  const showsCount = () => vm.runInContext(countCondition.replace(/\b(loading|rows|pageNum|error)\b/g, '$1.value'), sandbox)
  assert.equal(vm.runInContext('error.value', sandbox), '连接失败')
  assert.ok(!showsCount())
  fails = false
  await vm.runInContext('load(false)', sandbox)
  assert.ok(showsCount())
  assert.equal(vm.runInContext('total.value', sandbox), 0)
})
test('search historical job title updates while raw data and detail route stay unchanged', () => {
  const h = harness(), item = Object.freeze({ jobId: 17, title: '海边直播义工', storeName: '海边民宿' })
  assert.equal(h.show(item), '海边直播换工')
  assert.equal(item.title, '海边直播义工')
  h.open(item); assert.deepEqual(h.gone, ['/pages/jobs/detail?jobId=17'])
})
test('search keeps store identities, stay names, quoted originals and URLs exact', () => {
  const h = harness()
  assert.equal(h.show({ title: '义工之家招募义工', storeName: '义工之家' }), '义工之家招募换工')
  assert.equal(h.show({ storeName: '义工之家' }), '义工之家')
  assert.equal(h.show({ stayName: '义工之家' }, 'stays'), '义工之家')
  assert.equal(h.show({ title: '义工 “义工原文” https://example.test/义工' }), '换工 “义工原文” https://example.test/义工')
})
test('search render uses titleOf for visible text and accessible labels and compiles', () => {
  assert.match(descriptor.template.content, /class="result-title[^>]*>\{\{ titleOf\(item\) \}\}/)
  assert.match(descriptor.template.content, /:aria-label="'查看' \+ titleOf\(item\)"/)
  assert.ok(compileScript(descriptor, { id: 'search-wording' }).content)
  assert.deepEqual(compileTemplate({ id: 'search-wording', filename: 'pages/search/index.vue', source: descriptor.template.content }).errors, [])
})
