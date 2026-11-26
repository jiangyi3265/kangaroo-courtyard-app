// 2026-10-19 社区「选的城市空着时先看全国的」回归（node --test，不构建、不发请求）。
// 客户 #65：默认展示全国。用户主动选城后，空列表才尝试显示全国内容。
// 守住这几件事：
//   · 没在搜索、不是「已关注」、选的不是「全部城市」、这个页签第一页一条都没有 → 再取一次全国的同一页签（找搭子同样，分类 / 筛选条件照带）；
//   · 列表上面一行暖色小字「X还没有…，先看看全国的」+「只看X」；点「只看X」回到只看这个城市（原来的空状态，下面多一个「看看全国的」）；
//   · 往下翻页接着翻全国的；全国也空着 / 全国那次没取到 → 照常是这个城市的空状态；
//   · 只有用户主动选城时保存选择，自动回退不会覆盖所选城市；「我的 → 全国攻略」（?tab=guide&all=1）本来就是全部城市，只取一次。
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'
import * as feedJs from '../pages/community/community-feed.js'
import * as linkJs from '../pages/community/post-link.js'

const APP = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const require = createRequire(path.join(APP, 'package.json'))
const compiler = require('@vue/compiler-sfc'), vue = require('vue')
const read = (rel) => fs.readFileSync(path.join(APP, rel), 'utf8').replace(/\r\n/g, '\n')
const INDEX = 'pages/community/index.vue'
const sfc = compiler.parse(read(INDEX), { filename: INDEX }).descriptor
const icons = (await import('../common/icons.js')).default
const { shouldWiden, widenNotice, ALL_CITIES } = feedJs

test('shouldWiden：只有「选了具体城市、没搜索、不是已关注、第一页是空的、没点过只看这个城市」才看全国', () => {
  const base = { city: '大连', keyword: '', sort: 'new', rows: [], cityOnly: '' }
  assert.equal(shouldWiden(base), true)
  assert.equal(shouldWiden({ ...base, rows: [{ postId: 1 }] }), false, '这个城市有内容就不动')
  assert.equal(shouldWiden({ ...base, city: ALL_CITIES }), false, '本来就是全部城市')
  assert.equal(shouldWiden({ ...base, city: '' }), false)
  assert.equal(shouldWiden({ ...base, keyword: '咖啡' }), false, '在搜索时不换成全国的')
  assert.equal(shouldWiden({ ...base, keyword: '  ' }), true, '只有空格不算搜索')
  assert.equal(shouldWiden({ ...base, sort: 'follow' }), false, '已关注本来就不分城市')
  assert.equal(shouldWiden({ ...base, cityOnly: '大连' }), false, '点过「只看大连」')
  assert.equal(shouldWiden({ ...base, cityOnly: '伊犁' }), true, '点的是别的城市不算')
  assert.equal(shouldWiden({ ...base, rows: undefined }), true)
  assert.equal(shouldWiden(), false)
})

test('widenNotice：按页签说，找搭子带了分类 / 筛选时说「符合条件的搭子」', () => {
  assert.equal(widenNotice('大连', '全部'), '大连还没有动态，先看看全国的')
  assert.equal(widenNotice('大连', '旅居日常'), '大连还没有旅居日常，先看看全国的')
  assert.equal(widenNotice('大连', '经验分享'), '大连还没有经验分享，先看看全国的')
  assert.equal(widenNotice('伊犁', '找搭子'), '伊犁还没有人找搭子，先看看全国的')
  assert.equal(widenNotice('伊犁', '找搭子', true), '伊犁还没有符合条件的搭子，先看看全国的')
})

// 跑 index.vue 的 <script setup>（同 profile-mine-20261018.test.mjs 的做法）：接口换成按城市返回的假数据，记下每次请求
function runIndex({ feedRows = {}, buddyRows = {}, savedCity = '大连', failAll = false } = {}) {
  const script = sfc.scriptSetup.content
  const ast = compiler.babelParse(script, { sourceType: 'module' })
  const body = ast.program.body.filter(n => n.type !== 'ImportDeclaration').map(n => script.slice(n.start, n.end)).join('\n')
  const calls = { feed: [], buddies: [], saved: [] }
  let loadOpts, selectedCity
  const page = (rows) => ({ data: { rows, hots: [], hasMore: rows.length >= 2 } })
  const sandbox = { console }
  for (const n of ast.program.body.filter(n => n.type === 'ImportDeclaration')) for (const s of n.specifiers) sandbox[s.local.name] = () => new Promise(() => {})
  Object.assign(sandbox, feedJs, linkJs, {
    ref: vue.ref, computed: vue.computed, watch: vue.watch, onShow() {}, onHide() {}, onUnload() {}, onReachBottom() {}, onPullDownRefresh() {}, onShareAppMessage() {},
    uni: { getSystemInfoSync: () => ({ windowWidth: 375 }), hideKeyboard() {}, stopPullDownRefresh() {} },
    useScreen: (n, opts) => { loadOpts = opts; return vue.ref(1) },
    ensureSession: async () => {}, experience: { account: { id: 7 } },
    selectCity: async () => selectedCity,
    communityCity: () => savedCity, saveCommunityCity: (c) => calls.saved.push(c),
    apiFeed: async (q) => {
      calls.feed.push({ ...q })
      if (failAll && q.city === ALL_CITIES) throw new Error('boom')
      return page((feedRows[q.city] || []).map(id => ({ postId: id, city: q.city, title: 't' + id, images: [], author: { userId: 1, name: 'a' } })))
    },
    apiBuddies: async (q) => {
      calls.buddies.push({ ...q })
      return { data: { rows: (buddyRows[q.city] || []).map(id => ({ postId: id, timeText: '10月19日 08:00', author: { userId: 1, name: 'a' } })) } }
    },
    absUrl: (u) => u, R: { activity: '/a', home: '/h', jobsList: '/j' }, go() {}, back() {}, toast() {}, fail() {}, gated: (fn) => fn()
  })
  vm.createContext(sandbox)
  const scope = vue.effectScope()
  scope.run(() => vm.runInContext(body, sandbox, { filename: INDEX }))
  const flush = () => new Promise(r => setTimeout(r, 0))
  return {
    calls, flush, stop: () => scope.stop(),
    load: async (q = {}) => { await loadOpts.onLoad(q); await flush() },
    selectFromNationwide: async city => {
      assert.deepEqual(calls.feed.map(q => q.city), [ALL_CITIES], '首次打开只请求全国，已有选城记录也一样')
      assert.deepEqual(calls.saved, [], '默认全国不会覆盖已保存的城市')
      calls.feed.length = 0
      selectedCity = city
      await vm.runInContext('pickCity()', sandbox)
      await flush()
    },
    run: (code) => vm.runInContext(code, sandbox),
    json: (code) => JSON.parse(vm.runInContext('JSON.stringify(' + code + ')', sandbox))
  }
}

test('大连一条动态都没有：自动再取全国的同一页签，列表是全国的，上面一行小字；记住的城市不改', async (t) => {
  const h = runIndex({ feedRows: { [ALL_CITIES]: [11, 12] } })
  t.after(h.stop)
  await h.load()
  await h.selectFromNationwide('大连')
  assert.deepEqual(h.calls.feed.map(q => q.city), ['大连', ALL_CITIES])
  assert.equal(h.calls.feed[1].page, 1)
  assert.equal(h.calls.feed[1].sort, 'new')
  assert.equal(h.run('feedWide.value'), true)
  assert.equal(h.run('wideNow.value'), true)
  assert.equal(h.run('wideText.value'), '大连还没有动态，先看看全国的')
  assert.deepEqual(h.json('posts.value.map(p => p.postId)'), [11, 12])
  assert.equal(h.run('city.value'), '大连', '顶栏还是大连')
  assert.deepEqual(h.calls.saved, ['大连'], '用户选择的大连只保存一次，全国回退不覆盖它')
  // 往下翻：接着翻全国的第 2 页
  await h.run('loadFeed(true)')
  assert.deepEqual(h.calls.feed.at(-1), { kind: undefined, city: ALL_CITIES, sort: 'new', keyword: undefined, page: 2 })
  assert.equal(h.run('feedWide.value'), true)
})

test('点「只看大连」：回到只看大连（空状态 + 「看看全国的」）；再点「看看全国的」又看全国的', async (t) => {
  const h = runIndex({ feedRows: { [ALL_CITIES]: [11] } })
  t.after(h.stop)
  await h.load()
  await h.selectFromNationwide('大连')
  h.calls.feed.length = 0
  h.run('onlyThisCity()'); await h.flush()
  assert.deepEqual(h.calls.feed.map(q => q.city), ['大连'], '只取大连，不再看全国')
  assert.equal(h.run('feedWide.value'), false)
  assert.equal(h.run('posts.value.length'), 0)
  assert.equal(h.run('canWiden.value'), true, '空状态下面给「看看全国的」')
  // 换个页签也还是只看大连
  h.run("onFeedTab('旅居日常')"); await h.flush()
  assert.deepEqual(h.calls.feed.map(q => q.city), ['大连', '大连'])
  h.calls.feed.length = 0
  h.run('seeNationwide()'); await h.flush()
  assert.deepEqual(h.calls.feed.map(q => q.city), ['大连', ALL_CITIES])
  assert.equal(h.run('feedWide.value'), true)
  assert.equal(h.run('wideText.value'), '大连还没有旅居日常，先看看全国的')
  assert.equal(h.calls.feed.at(-1).kind, 'daily', '全国的也是同一页签')
})

test('搜索、「已关注」、本城有内容、全国也空着、全国那次没取到：都不换成全国的', async (t) => {
  const has = runIndex({ feedRows: { 大连: [1], [ALL_CITIES]: [11] } })
  t.after(has.stop)
  await has.load()
  await has.selectFromNationwide('大连')
  assert.deepEqual(has.calls.feed.map(q => q.city), ['大连'])
  assert.equal(has.run('feedWide.value'), false)

  const h = runIndex({ feedRows: { [ALL_CITIES]: [11] } })
  t.after(h.stop)
  await h.load()
  await h.selectFromNationwide('大连')
  h.calls.feed.length = 0
  h.run("kwDraft.value = '咖啡'; runSearch()"); await h.flush()
  assert.deepEqual(h.calls.feed.map(q => [q.city, q.keyword]), [['大连', '咖啡']], '搜索时不换成全国的')
  assert.equal(h.run('feedWide.value'), false)
  h.run('clearSearch()'); await h.flush()
  h.calls.feed.length = 0
  h.run("pickSort('follow')"); await h.flush()
  assert.deepEqual(h.calls.feed.map(q => [q.city, q.sort]), [['大连', 'follow']], '已关注本来就不分城市')
  assert.equal(h.run('feedWide.value'), false)

  const none = runIndex({ feedRows: {} })
  t.after(none.stop)
  await none.load()
  await none.selectFromNationwide('大连')
  assert.deepEqual(none.calls.feed.map(q => q.city), ['大连', ALL_CITIES])
  assert.equal(none.run('feedWide.value'), false, '全国也空着：照常是大连的空状态')
  assert.equal(none.run('feedLoaded.value'), true)

  const bad = runIndex({ feedRows: {}, failAll: true })
  t.after(bad.stop)
  await bad.load()
  await bad.selectFromNationwide('大连')
  assert.equal(bad.run('feedWide.value'), false)
  assert.equal(bad.run('feedFailed.value'), false, '全国那次没取到不算加载失败，照常显示大连的空状态')
  assert.equal(bad.run('feedLoaded.value'), true)
})

test('「我的 → 全国攻略」（?tab=guide&all=1）本来就是全部城市：只取一次，不出小字', async (t) => {
  const h = runIndex({ feedRows: { [ALL_CITIES]: [11] } })
  t.after(h.stop)
  await h.load({ tab: 'guide', all: '1' })
  assert.deepEqual(h.calls.feed.map(q => [q.city, q.kind]), [[ALL_CITIES, 'daily']])
  assert.equal(h.run('wideNow.value'), false)
})

test('找搭子页签：大连没人找搭子 → 同样的分类 / 筛选条件看全国的；「只看大连」回到大连', async (t) => {
  const h = runIndex({ buddyRows: { [ALL_CITIES]: [21, 22] } })
  t.after(h.stop)
  await h.load()
  await h.selectFromNationwide('大连')
  h.run("onFeedTab('找搭子')"); await h.flush()
  assert.deepEqual(h.calls.buddies.map(q => q.city), ['大连', ALL_CITIES])
  assert.equal(h.run('buddyWide.value'), true)
  assert.equal(h.run('wideText.value'), '大连还没有人找搭子，先看看全国的')
  assert.deepEqual(h.json('mates.value.map(m => m.postId)'), [21, 22])
  h.run("setCat('骑行')"); await h.flush()
  assert.deepEqual(h.calls.buddies.slice(-2).map(q => [q.city, q.category]), [['大连', 'ride'], [ALL_CITIES, 'ride']], '分类照带')
  assert.equal(h.run('wideText.value'), '大连还没有符合条件的搭子，先看看全国的')
  h.calls.buddies.length = 0
  h.run('onlyThisCity()'); await h.flush()
  assert.deepEqual(h.calls.buddies.map(q => q.city), ['大连'])
  assert.equal(h.run('buddyWide.value'), false)
  assert.equal(h.run('canWiden.value'), true)
  // 搜索时不换
  h.run('seeNationwide()'); await h.flush()
  h.calls.buddies.length = 0
  h.run("kwDraft.value = '徒步'; runSearch()"); await h.flush()
  assert.deepEqual(h.calls.buddies.map(q => q.city), ['大连'])
})

test('页面：两个页签分支里都有那行小字 +「只看X」，两个空状态里都有「看看全国的」；只用已有图标', () => {
  const tpl = sfc.template.content
  const notes = tpl.match(/<view v-if="wideNow" class="wide-note">[\s\S]*?只看\{\{ city \}\}[\s\S]*?<\/view><\/view>/g) || []
  assert.equal(notes.length, 2, '找搭子分支一条、信息流分支一条')
  assert.ok(notes.every(n => n.includes('@click="onlyThisCity"') && n.includes('{{ wideText }}')))
  assert.equal((tpl.match(/<view v-if="canWiden" class="feed-empty__retry" hover-class="k-press" @click="seeNationwide"><text>看看全国的<\/text><\/view>/g) || []).length, 2)
  assert.ok(icons.compass, 'compass 图标在 common/icons.js 里')
  assert.match(sfc.scriptSetup.content, /cityOnly\.value = ''\s*\n\s*reload\(\)/, '重新选城市时「只看X」不再算')
  assert.doesNotMatch(sfc.scriptSetup.content, /saveCommunityCity\(ALL_CITIES\)/)
  const css = sfc.styles.map(s => s.content).join('\n')
  assert.match(css, /\.wide-note \{[^}]*background: #FBF1E4/)
  assert.match(css, /\.wide-note__city \{[^}]*text-overflow: ellipsis/)
})
