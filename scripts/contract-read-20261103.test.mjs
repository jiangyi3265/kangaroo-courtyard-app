// 2026-11-03 责任书阅读（主人：「不要弹窗确认的，往下滑到底就百分百了」），node --test 直接跑，不构建、不发请求：
//   · pages/jobs/contract-read.js 的进度算法：条款列表露出来多少就是多少，最底下进了屏幕就是 100%，只增不减；
//   · contract.vue：条款全文平铺；2026-11-15 起必须从顶部读到底，量不到不放行，不代替用户滚动；
//   · 后端签署照旧只核对条款摘要，不需要逐条阅读记录。
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'
import test from 'node:test'
import assert from 'node:assert/strict'
import { readPercent, nextRead, BOTTOM_SLACK } from '../pages/jobs/contract-read.js'
import { readingClock, AGREEMENT_READ_SECONDS } from '../common/agreement-progress.js'

const APP = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const require = createRequire(path.join(APP, 'package.json'))
const compiler = require('@vue/compiler-sfc'), vue = require('vue')
const read = (p) => fs.readFileSync(path.join(APP, p), 'utf8').replace(/\r\n/g, '\n')
const FILE = 'pages/jobs/contract.vue'

test('进度：列表还在屏幕下面是 0，露出一半是 50，最底下进了屏幕（差几像素也算）是 100', () => {
  assert.equal(readPercent({ top: 900, height: 600 }, 800), 0)
  assert.equal(readPercent({ top: 500, height: 600 }, 800), 50)
  assert.equal(readPercent({ top: 200, height: 600 }, 800), 100, '底边正好在屏幕底')
  assert.equal(readPercent({ top: 200 + BOTTOM_SLACK - 1, height: 600 }, 800), 100, '差几像素也算到底')
  assert.equal(readPercent({ top: -400, height: 600 }, 800), 100, '滑过头了')
  assert.equal(readPercent({ top: 120, height: 500 }, 800), 100, '条款短、一屏放得下：一进来就是 100')
  assert.ok(readPercent({ top: 201 + BOTTOM_SLACK, height: 600 }, 800) < 100, '没到底不会提前满')
  assert.equal(readPercent({ top: 50, height: 10000 }, 10000), 99, '没到底最多 99')
  assert.equal(readPercent(null, 800), -1)
  assert.equal(readPercent({ top: 10, height: 0 }, 800), -1)
  assert.equal(readPercent({ top: 10, height: 100 }, 0), -1)
  assert.equal(nextRead(60, 30), 60, '往回翻不退')
  assert.equal(nextRead(60, 80), 80)
})

function preprocess(code, platform) {
  const keep = []
  const out = []
  for (const line of code.split('\n')) {
    const m = /^\s*\/\/\s*#(ifdef|ifndef|endif)\b\s*([\w-]*)/.exec(line)
    if (m) {
      if (m[1] === 'endif') keep.pop()
      else keep.push(m[1] === 'ifdef' ? m[2] === platform : m[2] !== platform)
      continue
    }
    if (keep.every(Boolean)) out.push(line)
  }
  return out.join('\n')
}

function load(stubs = () => ({})) {
  const parsed = compiler.parse(read(FILE), { filename: 'contract.vue' })
  assert.equal(parsed.errors.length, 0)
  const source = preprocess(parsed.descriptor.scriptSetup.content, 'MP-WEIXIN')
  const ast = compiler.babelParse(source, { sourceType: 'module' })
  const body = ast.program.body.filter(n => n.type !== 'ImportDeclaration').map(n => source.slice(n.start, n.end)).join('\n')
  const sandbox = { console, Date, Math, Promise, JSON, setTimeout, clearTimeout, String, Number }
  for (const n of ast.program.body.filter(n => n.type === 'ImportDeclaration')) for (const s of n.specifiers) sandbox[s.local.name] = () => new Promise(() => {})
  const calls = { toast: [], scrolled: [], pageScroll: [] }
  Object.assign(sandbox, {
    ref: vue.ref, computed: vue.computed, watch: vue.watch, onBeforeUnmount() {}, useScreen: () => vue.ref(1), R: {},
    getCurrentInstance: () => null, onPageScroll: (fn) => { calls.pageScroll.push(fn) }, readPercent, nextRead, readingClock, AGREEMENT_READ_SECONDS,
    errText: (e, dft) => (e && e.message) || dft, todayCn: () => '2026-11-03', shiftDate: (d) => d, releaseArrivalImages() {},
    toast: (m) => { calls.toast.push(m) }, alert: () => Promise.resolve()
  }, stubs(calls))
  vm.createContext(sandbox)
  const scope = vue.effectScope()
  scope.run(() => vm.runInContext(body, sandbox, { filename: FILE + ':script-setup' }))
  return { calls, run: code => vm.runInContext(code, sandbox), stop: () => scope.stop() }
}

// 假的 uni：条款列表的位置按 rect() 给
const fakeUni = (calls, rect, vh = 800) => ({
  createSelectorQuery: () => {
    const q = { in: () => q, select: () => ({ boundingClientRect: (cb) => ({ exec: () => cb(rect()) }) }) }
    return q
  },
  getWindowInfo: () => ({ windowHeight: vh }),
  pageScrollTo: (o) => calls.scrolled.push(o.selector)
})
const terms = `[{ icon: 'house', title: '工作范围', desc: 'a' }, { icon: 'house', title: '食宿安排', desc: 'b' }]`

test('页面滑动时量进度；没滑到底点「去签署」只提示，不替用户滑到底、不进签署屏', async (t) => {
  t.mock.timers.enable({ apis: ['Date', 'setTimeout'] })
  let rect = { top: 600, height: 800 }
  const h = load(calls => ({ uni: fakeUni(calls, () => rect) }))
  t.after(h.stop)
  assert.equal(h.calls.pageScroll.length, 1, '注册了页面滚动')
  h.run(`c.value = { terms: ${terms}, canSign: true, sign: null, arrival: {} }`)
  await h.run('measureRead()')
  assert.equal(h.run('readPct.value'), 25)
  t.mock.timers.tick(5000)
  await h.run('toSign()')
  assert.equal(h.run('s.value'), 1)
  assert.deepEqual(h.calls.toast, ['请往下滑，读完全部条款后再签署'])
  assert.deepEqual(h.calls.scrolled, [])
  // 往下滑到底：100%，再点就进签署屏，中间没有任何确认弹窗
  rect = { top: 0, height: 800 }
  await h.run('measureRead()')
  assert.equal(h.run('readPct.value'), 100)
  rect = { top: 700, height: 800 }
  await h.run('measureRead()')
  assert.equal(h.run('readPct.value'), 100, '往回翻不退')
  await h.run('toSign()')
  assert.equal(h.run('s.value'), 2)
})

test('量不到正文时不能绕过阅读直接签署', async (t) => {
  t.mock.timers.enable({ apis: ['Date', 'setTimeout'] })
  let rect = { top: 0, height: 1600 }
  const h = load(calls => ({ uni: fakeUni(calls, () => rect) }))
  t.after(h.stop)
  h.run(`c.value = { terms: ${terms}, canSign: true, sign: null, arrival: {} }`)
  await h.run('measureRead()')
  t.mock.timers.tick(5000)
  rect = null
  await h.run('toSign()')
  assert.equal(h.run('readPct.value'), 50)
  assert.equal(h.run('s.value'), 1)
  assert.match(h.calls.toast[0], /阅读进度/)
})

test('滑到底但门店还没确认录用：照旧按真实状态说明，不进签署屏', async (t) => {
  t.mock.timers.enable({ apis: ['Date', 'setTimeout'] })
  const h = load(calls => ({ uni: fakeUni(calls, () => ({ top: 0, height: 300 })) }))
  t.after(h.stop)
  h.run(`c.value = { terms: ${terms}, canSign: false, status: 'interview_done', sign: null, arrival: {} }`)
  await h.run('measureRead()')
  t.mock.timers.tick(5000)
  await h.run('toSign()')
  assert.equal(h.run('s.value'), 1)
  assert.deepEqual(h.calls.toast, ['门店确认录用后才能签署'])
})

test('页面源码：条款不再点开弹窗、没有箭头；进度跟着滑动；模板可编译', () => {
  const src = read(FILE)
  assert.ok(!src.includes('openTerm'), '没有逐条点开')
  assert.ok(!src.includes('readSet'), '不再按点开的条数算')
  assert.ok(!src.includes('逐条点开阅读后方可进入签署流程'))
  const termsTpl = src.slice(src.indexOf('<view class="terms card">'), src.indexOf('<view class="read-done">'))
  assert.ok(!termsTpl.includes('@click'), '条款行不可点')
  assert.ok(!termsTpl.includes('chevron-right'), '条款行没有箭头')
  assert.ok(termsTpl.includes('{{ item.desc }}'), '条款全文直接显示')
  assert.match(src, /往下滑读完全部条款即可签署/)
  assert.match(src, /import \{[^}]*\bonPageScroll\b[^}]*\} from '@dcloudio\/uni-app'/)
  assert.match(src, /import \{ readPercent, nextRead \} from '\.\/contract-read\.js'/)
  const { descriptor, errors } = compiler.parse(src, { filename: 'contract.vue' })
  assert.equal(errors.length, 0)
  const script = compiler.compileScript(descriptor, { id: 'contract' })
  const tpl = compiler.compileTemplate({ source: descriptor.template.content, filename: 'contract.vue', id: 'contract', compilerOptions: { bindingMetadata: script.bindings } })
  assert.deepEqual(tpl.errors, [])
})

test('后端签署只核对条款摘要，没有逐条阅读记录要补', () => {
  const hub = read('../RuoYi-Vue/ruoyi-kangaroo/src/main/java/com/ruoyi/kangaroo/ext/user/KgUserHubService.java')
  const sign = hub.slice(hub.indexOf('public Map<String, Object> sign('), hub.indexOf('public Map<String, Object> saveArrival('))
  assert.match(sign, /if \(!hash\.equals\(str\(b\.get\("hash"\)\)\)\)/)
  assert.ok(!/readTerms|termsRead|read_terms/.test(sign))
})
