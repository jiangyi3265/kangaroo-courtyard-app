// 会员「权益详情」的店铺介绍（10-13，V40）：node --test，不需要构建、不发请求。跑的是页面真实的 script setup，接口换成假函数：
//   · 没填介绍（null / 空串 / 只有空格换行）时整块不显示；
//   · 纯文本、保留换行（Windows 换行统一成 \n），去掉开头空行和末尾空白，第一行的缩进保留；
//   · 超过 5 行或 120 个字先显示前面一段加「…」，点「展开全部」看全文、点「收起」收回；表情不会被截成半个；
//   · 模板里「店铺介绍」在折扣 / 权益名下面、「适用会员」上面，用纯文本插值，不走 rich-text。
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'
import test from 'node:test'
import assert from 'node:assert/strict'

const APP = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const require = createRequire(path.join(APP, 'package.json'))
const compiler = require('@vue/compiler-sfc'), vue = require('vue')
const REL = 'pages/profile/benefits.vue'
const flush = () => new Promise(resolve => setImmediate(resolve))

/** 在沙箱里跑页面的 script setup：导入一律先给永远不返回的函数，再用 stubs 覆盖用得到的那几个 */
function runSetup(stubs) {
  const d = compiler.parse(fs.readFileSync(path.join(APP, REL), 'utf8').replace(/\r\n/g, '\n'), { filename: REL }).descriptor
  const source = d.scriptSetup.content
  const ast = compiler.babelParse(source, { sourceType: 'module' })
  const body = ast.program.body.filter(n => n.type !== 'ImportDeclaration').map(n => source.slice(n.start, n.end)).join('\n')
  const sandbox = { console }
  for (const n of ast.program.body.filter(n => n.type === 'ImportDeclaration')) for (const s of n.specifiers) sandbox[s.local.name] = () => new Promise(() => {})
  Object.assign(sandbox, { ref: vue.ref, computed: vue.computed }, stubs)
  vm.createContext(sandbox)
  const scope = vue.effectScope()
  scope.run(() => vm.runInContext(body, sandbox, { filename: REL + ':script-setup' }))
  return { run: code => vm.runInContext(code, sandbox), stop: () => scope.stop(), template: d.template.content }
}

function detailHarness(intro) {
  const hooks = {}
  const h = runSetup({
    experience: vue.reactive({ account: null }),
    R: { memberBenefits: '/pages/profile/benefits', profile: '/pages/profile/index' },
    onLoad: fn => { hooks.load = fn }, onShow: fn => { hooks.show = fn }, onHide: () => {}, onReachBottom: () => {}, onPullDownRefresh: () => {},
    apiMemberBenefit: async id => ({ data: { benefitId: Number(id), merchantName: '日初海景度假酒店', city: '平潭', category: 'stay', discountText: '携程价格85折', title: '袋鼠会员折扣福利', minLevel: 0, levelLabel: '所有成长会员', eligible: false, eligibilityText: '登录查看可用权益', rules: '需提前一天预约', intro } })
  })
  return { ...h, hooks }
}

test('introParts：没填、空串、只有空白时不显示这一块', (t) => {
  const h = runSetup({})
  t.after(h.stop)
  for (const value of ['null', 'undefined', "''", "'   \\n\\n  '", "'\\r\\n\\t'"]) {
    assert.deepEqual({ ...h.run(`introParts(${value})`) }, { text: '', short: '', long: false }, value)
  }
})

test('introParts：短介绍原样显示、保留换行；Windows 换行统一，开头空行和末尾空白去掉，第一行缩进保留', (t) => {
  const h = runSetup({})
  t.after(h.stop)
  const short = h.run("introParts('海景房，步行到沙滩 3 分钟。\\r\\n\\r\\n早餐 7:00–10:00。')")
  assert.equal(short.text, '海景房，步行到沙滩 3 分钟。\n\n早餐 7:00–10:00。')
  assert.equal(short.short, short.text)
  assert.equal(short.long, false)
  const indented = h.run("introParts('\\n\\n\\u3000\\u3000日初海景度假酒店坐落在平潭坛南湾。\\n  \\n')")
  assert.equal(indented.text, '　　日初海景度假酒店坐落在平潭坛南湾。')
  assert.equal(indented.long, false)
  const exact = h.run(`introParts('${'好'.repeat(120)}')`)
  assert.equal(exact.long, false, '刚好 120 个字不折叠')
  const fiveLines = h.run("introParts('一\\n二\\n三\\n四\\n五')")
  assert.equal(fiveLines.long, false, '刚好 5 行不折叠')
})

test('introParts：超过 5 行或 120 个字先显示前面一段加「…」，表情不截成半个', (t) => {
  const h = runSetup({})
  t.after(h.stop)
  const lines = h.run("introParts('一\\n二\\n三\\n四\\n五\\n六\\n七')")
  assert.equal(lines.long, true)
  assert.equal(lines.short, '一\n二\n三\n四\n五…')
  assert.equal(lines.text, '一\n二\n三\n四\n五\n六\n七', '展开后是全文')
  const chars = h.run(`introParts('${'海'.repeat(119)}🌊🌊尾巴')`)
  assert.equal(chars.long, true)
  assert.equal(chars.short, '海'.repeat(119) + '🌊…', '按字（码点）截，不会留下半个表情')
  const brokenAtLineEnd = h.run(`introParts('${'山'.repeat(119)}\\n${'水'.repeat(30)}')`)
  assert.equal(brokenAtLineEnd.short, '山'.repeat(119) + '…', '截断处是换行时不留空行再加省略号')
})

test('详情：读到介绍后显示前一段，「展开全部」/「收起」切换；回到页面重新读详情时保持展开状态', async (t) => {
  const long = Array.from({ length: 8 }, (_, i) => `第${i + 1}段介绍`).join('\n')
  const h = detailHarness(long)
  t.after(h.stop)
  h.hooks.load({ id: '7' })
  h.hooks.show()
  await flush()
  assert.equal(h.run('detail.value.merchantName'), '日初海景度假酒店')
  assert.equal(h.run('intro.value.long'), true)
  assert.equal(h.run('introOpen.value'), false)
  assert.equal(h.run('intro.value.short'), '第1段介绍\n第2段介绍\n第3段介绍\n第4段介绍\n第5段介绍…')
  h.run('introOpen.value=!introOpen.value')
  assert.equal(h.run('introOpen.value'), true)
  h.hooks.show()
  await flush()
  assert.equal(h.run('introOpen.value'), true, '同一条权益：打完电话回来不用再点一次展开')
  assert.equal(h.run('intro.value.text'), long)
})

test('详情：没有介绍的老权益不显示这一块', async (t) => {
  const h = detailHarness(null)
  t.after(h.stop)
  h.hooks.load({ id: '8' })
  h.hooks.show()
  await flush()
  assert.equal(h.run('detail.value.benefitId'), 8)
  assert.equal(h.run('intro.value.text'), '')
})

test('模板：「店铺介绍」在折扣和权益名下面、「适用会员」上面，纯文本插值保留换行', () => {
  const d = compiler.parse(fs.readFileSync(path.join(APP, REL), 'utf8').replace(/\r\n/g, '\n'), { filename: REL }).descriptor
  const tpl = d.template.content
  const head = name => tpl.indexOf('<text class="section-title">' + name + '</text>')
  const at = head('店铺介绍'), title = tpl.indexOf('{{ detail.title }}'), member = head('适用会员'), rules = head('使用规则')
  assert.ok(title > 0 && at > title && at < member && member < rules, '顺序：权益名 → 店铺介绍 → 适用会员 → 使用规则')
  const section = tpl.slice(tpl.lastIndexOf('<view', at), tpl.indexOf('</view>', at))
  assert.match(section, /v-if="intro\.text"/, '没填不显示')
  assert.match(section, /<text class="rules">\{\{ introOpen \? intro\.text : intro\.short \}\}<\/text>/, '纯文本插值')
  assert.match(section, /v-if="intro\.long"[^>]*>\{\{ introOpen \? '收起' : '展开全部' \}\}/)
  assert.doesNotMatch(tpl, /rich-text|v-html/, '介绍是运营填的纯文本，不当 HTML 渲染')
  const css = d.styles.map(s => s.content).join('\n')
  assert.match(css, /\.rules \{[^}]*white-space:pre-wrap/, '保留换行')
})
