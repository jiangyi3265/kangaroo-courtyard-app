// 2026-11-03 主人看「AI袋鼠客服」页：「历史聊天记录，永久保存，不能删除」。回归（node --test，不需要构建、不发请求）：
//   · 登录了：打开先取最近一页聊天记录摆在开场白上面（带信息来源、卡片、按钮），下面一行「以上是之前的聊天记录」；「查看更早的聊天记录」往前翻；
//   · 游客：照旧能问，不取聊天记录，开场白下面提示「登录后聊天记录会保存」，点了去登录；
//   · 点「猜你想问」：登录了把这一问一答记进聊天记录（只传 faqId）；
//   · 没有删除 / 清空：接口、页面、弹层里都没有。
// 跑的是 common/support-chat.js 真实的代码，接口换成假函数；条件编译按平台剥掉另一边。
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
const read = (rel) => fs.readFileSync(path.join(APP, rel), 'utf8').replace(/\r\n/g, '\n')
const readSfc = (rel) => compiler.parse(read(rel), { filename: rel }).descriptor
const flush = () => new Promise(resolve => setImmediate(resolve))
const plain = (x) => JSON.parse(JSON.stringify(x))

function platform(src, plat) {
  const out = [], stack = []
  for (const line of src.split('\n')) {
    const m = /^\s*\/\/ #(ifdef|ifndef|endif)\s*(.*)$/.exec(line)
    if (m) {
      if (m[1] === 'endif') stack.pop()
      else {
        const hit = m[2].split('||').map(x => x.trim()).includes(plat)
        stack.push(m[1] === 'ifdef' ? hit : !hit)
      }
      continue
    }
    if (stack.every(Boolean)) out.push(line)
  }
  return out.join('\n')
}

function runModule(source, stubs, filename) {
  const ast = compiler.babelParse(source, { sourceType: 'module' })
  const sandbox = { console }
  for (const n of ast.program.body.filter(n => n.type === 'ImportDeclaration')) for (const s of n.specifiers) sandbox[s.local.name] = () => new Promise(() => {})
  const body = ast.program.body.filter(n => n.type !== 'ImportDeclaration').map(n => {
    const code = source.slice(n.start, n.end)
    return n.type === 'ExportNamedDeclaration' ? code.replace(/^export\s+/, '') : code
  }).join('\n')
  Object.assign(sandbox, { ref: vue.ref, computed: vue.computed, watch: vue.watch, reactive: vue.reactive, nextTick: vue.nextTick }, stubs)
  vm.createContext(sandbox)
  vue.effectScope().run(() => vm.runInContext(body, sandbox, { filename }))
  return { run: code => vm.runInContext(code, sandbox), sandbox }
}

const NAMES = 'msgs, start, ask, openFaq, openLink, older, loadingOlder, loadOlder, owner'
// 两页聊天记录：第一页（最近的）带卡片、退款试算、信息来源；第二页更早
const PAGE1 = { more: true, list: [
  { id: 41, from: 'me', text: '保险查询', source: '', cards: [], links: [] },
  { id: 42, from: 'bot', text: '你的保单已登记', source: '袋鼠小院保单登记', cards: [{ type: 'insurance', title: '咖啡馆', status: '已生效', meta: '保单号 P1', image: '/profile/i.jpg' }, { type: 'refund', refundFen: 5000, allowed: true, hoursLeftText: '3 天' }], links: [{ label: '我的报名', url: '/pages/jobs/progress' }] }
] }
const PAGE2 = { more: false, list: [{ id: 3, from: 'me', text: '报名进度', source: '', cards: [], links: [] }, { id: 4, from: 'bot', text: '你还没有报名记录', source: '袋鼠小院业务数据', cards: [], links: [] }] }

function chat({ account = { id: 7 }, history } = {}) {
  const calls = { history: [], faqRead: [], gone: [] }
  const h = runModule(platform(read('common/support-chat.js'), 'MP-WEIXIN') + `\nvar { ${NAMES} } = useSupportChat({ open: (u) => __calls.gone.push(u), scroll: () => {} })`, {
    __calls: calls,
    ensureSession: async () => {},
    experience: vue.reactive({ account, mode: 'user', cities: ['大理'], allCities: false }),
    apiSupportQuick: async () => ({ data: [] }),
    apiSupportFaqs: async () => ({ data: [{ faqId: 1, question: '责任书在哪里签署？', answer: '在审核进度页签署。' }] }),
    apiSupportContact: async () => ({ data: { available: false } }),
    apiSupportAsk: async () => ({ data: { text: 'ok', cards: [], links: [], source: 'x' } }),
    apiSupportHistory: history || (async (before) => { calls.history.push(before); return { data: before ? PAGE2 : PAGE1 } }),
    apiSupportFaqRead: async (faqId, context) => { calls.faqRead.push([faqId, context]); return { data: 'ok' } },
    confirm: async () => true, errText: (e, f) => (e && e.message) || f, yuan: (f) => String(f / 100), absUrl: (u) => 'https://img.test' + u,
    toast: () => {},
    uni: { pageScrollTo: () => {}, makePhoneCall: () => {} },
    R: { assistant: '/pages/home/assistant', stayOrder: '/pages/stays/order', login: '/pages/auth/login' }
  }, 'common/support-chat.js')
  return { ...h, calls, load: async (ctx = 'profile') => { h.sandbox.__c = ctx; await h.run('start(__c)'); await flush(); await flush() } }
}

test('登录了：打开先取最近一页聊天记录，摆在开场白上面，原样带信息来源、卡片和按钮；下面一行「以上是之前的聊天记录」', async () => {
  const h = chat()
  await h.load()
  assert.deepEqual(h.calls.history, [null])
  const msgs = plain(h.run('msgs.value'))
  assert.deepEqual(msgs.slice(0, 4).map(m => [m.from, m.text]), [['me', '保险查询'], ['bot', '你的保单已登记'], ['tip', '以上是之前的聊天记录'], ['bot', msgs[3].text]])
  assert.match(msgs[3].text, /你好，我是AI袋鼠/, '开场白在聊天记录下面，和之前一样')
  assert.equal(msgs[4].faqs[0].question, '责任书在哪里签署？', '猜你想问照旧在开场白后面')
  const bot = msgs[1]
  assert.equal(bot.source, '袋鼠小院保单登记')
  assert.equal(bot.cards.length, 1, '退款试算不当卡片画')
  assert.equal(bot.cards[0].image, 'https://img.test/profile/i.jpg')
  assert.deepEqual(bot.links, [{ label: '我的报名', url: '/pages/jobs/progress' }])
  assert.deepEqual(bot.refund, ['距入住：3 天', '按退订政策扣除部分费用', '预计退款金额：¥50'], '旧试算不拿当前订单算比例')
  assert.equal(msgs[0].key, 'h41')
  assert.equal(h.run('older.value'), true)
  assert.equal(h.run('owner.value'), '7')
})

test('「查看更早的聊天记录」：按最早一条的 id 往前翻，插到最上面，返回原来最上面那条（页面按它定位）；翻完了就不再出', async () => {
  const h = chat()
  await h.load()
  const anchor = await h.run('loadOlder()')
  assert.deepEqual(h.calls.history, [null, 41])
  assert.equal(anchor, 'h41')
  const msgs = plain(h.run('msgs.value'))
  assert.deepEqual(msgs.slice(0, 3).map(m => m.key), ['h3', 'h4', 'h41'])
  assert.equal(msgs.filter(m => m.from === 'tip').length, 1, '分隔线只有一条')
  assert.equal(h.run('older.value'), false)
  assert.equal(await h.run('loadOlder()'), '')
  assert.deepEqual(h.calls.history, [null, 41], '没有更早的就不再请求')
})

test('没有聊天记录：不出分隔线和「查看更早」，开场白、猜你想问照旧', async () => {
  const h = chat({ history: async () => ({ data: { list: [], more: false } }) })
  await h.load()
  const msgs = plain(h.run('msgs.value'))
  assert.match(msgs[0].text, /你好，我是AI袋鼠/)
  assert.ok(!msgs.some(m => m.from === 'tip'))
  assert.equal(h.run('older.value'), false)
})

test('游客：不取聊天记录，开场白下面提示「登录后聊天记录会保存」，点了去登录；点常见问题也不记', async () => {
  const h = chat({ account: null })
  await h.load()
  assert.deepEqual(h.calls.history, [])
  const msgs = plain(h.run('msgs.value'))
  assert.match(msgs[0].text, /你好，我是AI袋鼠/)
  assert.equal(msgs[1].from, 'tip')
  assert.match(msgs[1].text, /登录后聊天记录会保存/)
  h.run('openLink(msgs.value[1])')
  assert.deepEqual(h.calls.gone, ['/pages/auth/login'])
  h.run("openFaq({ faqId: 1, question: '责任书在哪里签署？', answer: '在审核进度页签署。' })")
  assert.deepEqual(h.calls.faqRead, [])
  assert.equal(h.run('owner.value'), '')
})

test('登录了点「猜你想问」：答案照旧马上显示，同时把这一问一答记进聊天记录（只传 faqId 和入口）', async () => {
  const h = chat()
  await h.load('home')
  h.run("openFaq({ faqId: 1, question: '责任书在哪里签署？', answer: '在审核进度页签署。' })")
  assert.deepEqual(h.calls.faqRead, [[1, 'home']])
  assert.deepEqual(plain(h.run('msgs.value')).slice(-2).map(m => [m.from, m.text, m.source || '']), [['me', '责任书在哪里签署？', ''], ['bot', '在审核进度页签署。', '常见问题']])
})

test('重新开场时上一场还没回来的聊天记录不插进来（不会重复）', async () => {
  let release
  const slow = new Promise(r => { release = r })
  let n = 0
  const h = chat({ history: async () => { n++; if (n === 1) { await slow; return { data: PAGE1 } } return { data: PAGE2 } } })
  h.sandbox.__c = 'profile'
  h.run('start(__c)')
  await flush(); await flush()
  await h.load('home')
  release()
  await flush(); await flush()
  const keys = plain(h.run('msgs.value')).map(m => m.key)
  assert.ok(keys.includes('h3') && !keys.includes('h41'), keys.join(','))
})

test('页面和弹层：有「查看更早的聊天记录」、分隔线 / 登录提示；换了账号重新开场；没有任何删除、清空聊天记录的按钮和接口', () => {
  const page = readSfc('pages/notice/support.vue')
  assert.match(page.template.content, /v-if="older" class="sp-more"[^>]*@click="more"/)
  assert.match(page.template.content, /:key="m\.key"/)
  assert.match(page.template.content, /v-if="m\.from === 'tip'"/)
  assert.match(page.scriptSetup.content, /onShow\(/)
  assert.match(page.scriptSetup.content, /owner\.value !== String\(\(experience\.account && experience\.account\.id\) \|\| ''\)/)
  assert.match(page.scriptSetup.content, /pageScrollTo\(\{ selector: '#spm-' \+ anchor/)
  const sheet = readSfc('components/k-ai-sheet/k-ai-sheet.vue')
  assert.match(sheet.template.content, /v-if="older" class="k-ai__more"[^>]*@click="more"/)
  assert.match(sheet.template.content, /:scroll-into-view="intoView"/)
  assert.match(sheet.scriptSetup.content, /const key = props\.ctx \+ '\|' \+ props\.orderNo \+ '\|' \+ \(\(experience\.account && experience\.account\.id\) \|\| ''\)/)
  const api = read('common/api.js')
  assert.match(api, /export const apiSupportHistory = \(before\) => get\('\/app\/support\/history'/)
  assert.match(api, /export const apiSupportFaqRead = \(faqId, context\) => post\('\/app\/support\/faq-read', \{ faqId, context \}\)/)
  assert.doesNotMatch(api, /support\/history[^\n]*(DELETE|delete|clear)/i)
  // 注释里会写「没有删除 / 清空」，先去掉注释再查
  const code = (src) => src.replace(/<!--[\s\S]*?-->/g, '').replace(/\/\/[^\n]*/g, '')
  for (const src of [page.template.content, page.scriptSetup.content, sheet.template.content, sheet.scriptSetup.content, read('common/support-chat.js')]) {
    assert.doesNotMatch(code(src), /清空|删除|clearHistory|deleteHistory|removeHistory/)
  }
  // 整页客服在 pages/notice 分包里（主包只剩几十 KB）
  const pages = JSON.parse(read('pages.json').replace(/\/\/[^\n]*/g, ''))
  const sub = (pages.subPackages || []).find(p => p.root === 'pages/notice')
  assert.ok(sub && sub.pages.some(p => p.path === 'support'))
})
