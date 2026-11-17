import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import { createRequire } from 'node:module'
import { displayWording } from '../common/display-wording.js'
const require = createRequire(import.meta.url)
const { parse, babelParse, compileScript, compileTemplate } = require('@vue/compiler-sfc')
const { ref } = require('vue')
const source = fs.readFileSync(new URL('../pages/search/index.vue', import.meta.url), 'utf8')
const descriptor = parse(source).descriptor
const script = descriptor.scriptSetup.content
const body = babelParse(script, { sourceType: 'module' }).program.body.filter(n => n.type !== 'ImportDeclaration').map(n => script.slice(n.start, n.end)).join('\n')
function harness() {
  const gone = []
  const sandbox = { ref, displayWording, onLoad() {}, onReachBottom() {}, onUnload() {}, absUrl: v => v, go: url => gone.push(url), R: { jobDetail: '/pages/jobs/detail', stayDetail: '/pages/stays/detail' } }
  vm.createContext(sandbox); vm.runInContext(body, sandbox)
  return { gone, show: (item, tab = 'jobs') => { sandbox.item = item; sandbox.kind = tab; return vm.runInContext('tab.value = kind; titleOf(item)', sandbox) }, open: item => { sandbox.item = item; vm.runInContext('openResult(item)', sandbox) } }
}
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
