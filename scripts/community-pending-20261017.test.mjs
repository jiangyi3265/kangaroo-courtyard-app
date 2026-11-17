// 2026-10-17 主人反馈「建议发帖审核中时点赞和收藏还有评论都不能用，目前点赞和收藏是可以用的」的回归（node --test，不构建、不发请求）。
// 守住这几件事：
//   · community-feed.js 的 canInteract：只有 online（或老接口没有 status）能点赞 / 收藏 / 评论；pending / rejected / hidden 都不行；
//   · 帖子详情（s=3）：没发布时底部 赞 / 评论 / 收藏 灰掉（actbar__item--off，图标 light 色），分享、私信（分享到私信）也灰；
//     作者看自己审核中的帖子，正文下面一行「帖子审核中，通过后大家才能看到，也才能点赞、收藏和评论」；已发布的一切照旧；
//   · 评论屏（s=4）：没发布时不给输入框，换成一行「审核通过后才能点赞、收藏和评论」；
//   · 点了只提示「审核通过后才能点赞、收藏和评论」，不发请求；之前点过的赞 / 收藏照常能取消；?view=comments 进来的落到详情；
//   · 信息流卡片上自己审核中的帖子 赞 / 评论 灰掉；
//   · 后端：点赞 / 收藏 / 评论 / 评论点赞 都走 interactBlockedMessage（409），取消照常放行。
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'
import test from 'node:test'
import assert from 'node:assert/strict'
import * as feedJs from '../pages/community/community-feed.js'

const APP = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const require = createRequire(path.join(APP, 'package.json'))
const compiler = require('@vue/compiler-sfc'), vue = require('vue')
const { renderToString } = require('vue/server-renderer')
const read = (rel) => fs.readFileSync(path.join(APP, rel), 'utf8').replace(/\r\n/g, '\n')
const sfc = compiler.parse(read('pages/community/index.vue'), { filename: 'index.vue' }).descriptor
const js = sfc.scriptSetup.content
const cssText = sfc.styles.map(s => s.content).join('\n')
const postJava = read('../RuoYi-Vue/ruoyi-kangaroo/src/main/java/com/ruoyi/kangaroo/ext/community/KgPostService.java')
const TIP = '审核通过后才能点赞、收藏和评论'
const NOTICE = '社区动态待审核，仅自己可见。通过后可点赞、收藏和评论。'

test('canInteract：只有已发布的帖子能点赞 / 收藏 / 评论', () => {
  const { canInteract, INTERACT_TIP } = feedJs
  assert.equal(INTERACT_TIP, TIP)
  assert.equal(canInteract({ postId: 1, status: 'online' }), true)
  assert.equal(canInteract({ postId: 1 }), true, '老接口没有 status 照常能点')
  for (const st of ['pending', 'rejected', 'hidden']) assert.equal(canInteract({ postId: 1, status: st }), false, st)
  assert.equal(canInteract(null), false)
})

// ---------------------------------------------------------------- 模板渲染（服务端渲染成 HTML 再看）
// 小程序标签（view / text / image / k-icon …）都当普通元素原样输出，k-topbar 有具名插槽，给个空壳组件
const renderFn = (() => {
  const out = compiler.compileTemplate({ source: sfc.template.content, filename: 'index.vue', id: 'pend',
    compilerOptions: { isCustomElement: (t) => t !== 'k-topbar' } })
  assert.deepEqual(out.errors, [])
  const code = out.code
    .replace(/^import \{([^}]+)\} from "vue"\n/m, (m, names) => `const {${names.replace(/ as /g, ': ')}} = vue\n`)
    .replace('export function render', 'function render') + '\n;globalThis.__render = render'
  const box = { vue }
  vm.createContext(box)
  vm.runInContext(code, box, { filename: 'index.vue:render' })
  return box.__render
})()

function page(state) {
  const detail = vue.ref({ postId: 11, title: '大理三天', content: '正文', images: [], tags: [], related: [], author: { userId: 7, name: '小七', isMe: true }, likes: 0, comments: 0, ...state.detail })
  const ctx = {
    s: state.s, filterOpen: false, detail, imgIdx: 0, heroImgs: [], heroImg: '', heroBadge: '1/1', authorAvatar: '', detailLink: null,
    titleOf: feedJs.titleOf, canShare: feedJs.canShare, canInteract: feedJs.canInteract, absUrl: (x) => x, R: {},
    detailOpen: vue.computed(() => feedJs.canInteract(detail.value)), comments: [], cmLoaded: true, commentTitle: '全部评论（0）', ctab: '热评', draft: ''
  }
  const comp = { setup: () => ctx, render: renderFn, components: { 'k-topbar': { render() { return vue.h('header') } } } }
  const app = vue.createSSRApp(comp)
  app.config.warnHandler = () => {}
  return renderToString(app)
}
const actbarOf = (html) => html.slice(html.indexOf('class="actbar"'), html.indexOf('class="actbar__safe"'))
const items = (bar) => [...bar.matchAll(/<(?:view|button) class="([^"]*actbar__item[^"]*)"[^>]*>([\s\S]*?)<\/(?:view|button)>/g)].map(m => ({ cls: m[1], body: m[2], text: (m[2].match(/<text>([^<]*)<\/text>/) || [])[1] }))

test('详情：作者看自己审核中的帖子，赞 / 评论 / 收藏 / 分享 / 私信 都灰掉，正文下面有说明', async () => {
  const html = await page({ s: 3, detail: { status: 'pending' } })
  assert.ok(html.includes(NOTICE), '正文下面的说明')
  assert.match(html, /class="pending-line"/)
  const list = items(actbarOf(html))
  // 小程序和 H5 的分享按钮条件编译都留在模板里：赞 / 评论 / 收藏 / 分享（小程序 v-else）/ 分享（H5）/ 私信
  assert.deepEqual(list.map(i => i.text), ['赞', '评论', '收藏', '分享', '分享', '私信'])
  for (const i of list) {
    assert.match(i.cls, /actbar__item--off/, i.text + ' 要灰')
    assert.match(i.body, /color="light"/, i.text + ' 图标是灰的')
  }
  assert.ok(!/open-type="share"/.test(actbarOf(html)), '审核中不给微信转发按钮')
})

test('详情：已发布的帖子一切照旧，没有说明行、没有灰按钮', async () => {
  const html = await page({ s: 3, detail: { status: 'online', likes: 3, comments: 2, liked: true } })
  assert.ok(!html.includes(NOTICE))
  const bar = actbarOf(html)
  assert.ok(!bar.includes('actbar__item--off'))
  assert.ok(!bar.includes('color="light"'))
  assert.match(bar, /open-type="share"/)
  assert.deepEqual(items(bar).map(i => i.text), ['赞 3', '评论 2', '收藏', '分享', '分享', '私信'])
})

test('详情：别人的帖子不出说明行（审核中的别人本来就打不开）；之前点过的赞照常亮红色', async () => {
  const html = await page({ s: 3, detail: { status: 'pending', liked: true, favorited: true, author: { userId: 8, name: '小八', isMe: false } } })
  assert.ok(!html.includes(NOTICE))
  const [like, , fav] = items(actbarOf(html))
  assert.match(like.body, /color="red"/)
  assert.match(fav.body, /color="ochre"/)
})

test('评论屏：没发布时不给输入框，换成一行灰字；已发布照常有输入框和发送', async () => {
  const off = await page({ s: 4, detail: { status: 'pending' } })
  assert.match(off, /class="cbar__off"[\s\S]*?审核通过后才能点赞、收藏和评论/)
  assert.ok(!off.includes('cbar__input'))
  assert.ok(!off.includes('cbar__send'))
  const on = await page({ s: 4, detail: { status: 'online' } })
  assert.ok(!on.includes('cbar__off'))
  assert.match(on, /cbar__input/)
  assert.match(on, /class="cbar__send"/)
})

test('样式：灰按钮用禁用色，说明行和评论栏灰字都有样式', () => {
  assert.match(cssText, /\.actbar__item--off \{ color: var\(--k-light\); \}/)
  assert.match(cssText, /\.fc__act--off, \.fc-col__stat--off \{ color: var\(--k-light\); \}/)
  assert.match(cssText, /\.pending-line \{[^}]*background: var\(--k-ochre-soft\);/)
  assert.match(cssText, /\.cbar__off \{[^}]*color: var\(--k-muted\);/)
})

test('信息流卡片：自己审核中的帖子 赞 / 评论 灰掉，评论点了只提示', () => {
  const t = sfc.template.content
  assert.match(t, /<view class="fc__act" :class="\{ 'fc__act--off': !canInteract\(b\.post\) \}" hover-class="k-press" @click="likePost\(b\.post\)">/)
  assert.match(t, /<view class="fc__act" :class="\{ 'fc__act--off': !canInteract\(b\.post\) \}" hover-class="k-press" @click="openPostComments\(b\.post\)">/)
  assert.match(t, /<view class="fc-col__stat" :class="\{ 'fc-col__stat--off': !canInteract\(c\.post\) \}" hover-class="k-press" @click\.stop="likePost\(c\.post\)">/)
})

// ---------------------------------------------------------------- 点了会怎样：把几个函数放进沙箱跑，接口换成记录调用的假函数
function runScript(detailInit) {
  const ast = compiler.babelParse(js, { sourceType: 'module' })
  const want = new Set(['likePost', 'detailOpen', 'openComments', 'openPostComments', 'favoritePost', 'sending', 'sendComment', 'likeComment', 'openPost'])
  const named = (n) => (n.type === 'FunctionDeclaration' && want.has(n.id.name)) || (n.type === 'VariableDeclaration' && n.declarations.some(d => want.has(d.id.name)))
  const body = ast.program.body.filter(named).map(n => js.slice(n.start, n.end)).join('\n')
  const calls = [], toasts = []
  const rec = (name, data) => async (...args) => { calls.push([name, ...args]); return { data: typeof data === 'function' ? data(...args) : data } }
  const box = {
    console, ...feedJs, computed: vue.computed,
    s: vue.ref(3), feed: vue.ref({ rows: [] }), detail: vue.ref(detailInit), imgIdx: vue.ref(0), draft: vue.ref('去古城怎么走'),
    toast: (t) => toasts.push(t), fail: (e) => toasts.push('fail:' + e.message), gated: (fn) => fn(), prompt: async () => '回复内容',
    loadComments: () => calls.push(['loadComments']),
    apiPostLike: rec('like', { liked: true, likes: 1 }), apiPostFavorite: rec('favorite', { favorited: false }),
    apiPostComment: rec('comment', { status: 'visible', message: '评论已发布' }), apiCommentLike: rec('commentLike', {}),
    apiPost: rec('post', () => box.__next)
  }
  vm.createContext(box)
  vm.runInContext(body + '\n;globalThis.__x = { likePost, detailOpen, openComments, openPostComments, favoritePost, sendComment, likeComment, openPost }', box, { filename: 'index.vue:script-setup' })
  return { x: box.__x, box, calls, toasts }
}

test('点了只提示，不发请求：赞 / 收藏 / 评论 / 回复 / 评论点赞 / 进评论屏', async () => {
  const r = runScript({ postId: 11, status: 'pending', liked: false, favorited: false })
  assert.equal(r.x.detailOpen.value, false)
  await r.x.likePost(r.box.detail.value)
  await r.x.favoritePost()
  r.x.openComments()
  await r.x.sendComment()
  await r.x.sendComment({ commentId: 1, name: '小八' })
  await r.x.likeComment({ commentId: 1, liked: false })
  r.x.openPostComments({ postId: 12, status: 'pending' })
  assert.deepEqual(r.calls, [])
  assert.deepEqual(r.toasts, Array(7).fill(TIP))
  assert.equal(r.box.s.value, 3, '没进评论屏')
})

test('之前点过的赞 / 收藏照常能取消（服务端也放行）', async () => {
  const r = runScript({ postId: 11, status: 'pending', liked: true, favorited: true })
  await r.x.likePost(r.box.detail.value)
  await r.x.favoritePost()
  assert.deepEqual(r.calls.map(c => c[0]), ['like', 'favorite'])
})

test('已发布的帖子照常能点', async () => {
  const r = runScript({ postId: 11, status: 'online', liked: false, favorited: false })
  assert.equal(r.x.detailOpen.value, true)
  await r.x.likePost(r.box.detail.value)
  await r.x.favoritePost()
  await r.x.sendComment()
  r.x.openComments()
  assert.deepEqual(r.calls.map(c => c[0]), ['like', 'favorite', 'comment', 'loadComments', 'loadComments'])
  assert.equal(r.box.s.value, 4)
})

test('?view=comments / 卡片「评论」打开审核中的帖子：落到详情（s=3），不拉评论；已发布的照常进评论屏', async () => {
  const r = runScript({ postId: 0 })
  r.box.__next = { postId: 11, status: 'pending', author: {} }
  assert.equal(await r.x.openPost(11, 4), true)
  assert.equal(r.box.s.value, 3)
  assert.ok(!r.calls.some(c => c[0] === 'loadComments'))
  r.box.__next = { postId: 12, status: 'online', author: {} }
  await r.x.openPost(12, 4)
  assert.equal(r.box.s.value, 4)
  assert.ok(r.calls.some(c => c[0] === 'loadComments'))
})

test('后端：点赞 / 收藏 / 评论 / 评论点赞 都按帖子状态 409，取消照常放行', () => {
  assert.match(postJava, /static String interactBlockedMessage\(Object status\)/)
  assert.match(postJava, /return "帖子还在审核中，通过后才能点赞、收藏和评论";/)
  assert.match(postJava, /return "帖子未通过审核，不能点赞、收藏和评论";/)
  assert.match(postJava, /return "帖子已下架，不能点赞、收藏和评论";/)
  const body = (name) => { const i = postJava.indexOf('public Map<String, Object> ' + name + '('); return postJava.slice(i, postJava.indexOf('\n    }\n', i)) }
  for (const name of ['like', 'favorite', 'likeComment']) {
    const b = body(name)
    assert.match(b, /String blocked = interactBlockedMessage\((r|post)\.get\("status"\)\);/, name)
    assert.match(b, /if \(blocked == null && db\.update\("insert ignore into/, name + '：没发布不插')
    assert.match(b, /else if \(blocked != null\)\n\s+\{\n\s+throw new ServiceException\(blocked, 409\);/, name + '：没有可取消的才 409')
  }
  assert.match(body('comment'), /String blocked = interactBlockedMessage\(post\.get\("status"\)\);\n\s+if \(blocked != null\)\n\s+\{\n\s+throw new ServiceException\(blocked, 409\);/)
  assert.ok(!postJava.includes('ServiceException("动态还在审核中，暂不能评论"'), '旧提示语已统一')
})
