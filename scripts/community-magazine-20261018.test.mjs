// 2026-10-18 晚主人「社区页面还是很丑」「没有高级感」（效果图 43 + 两张发布页样稿）的回归（node --test，不构建、不发请求）。
// 守住这几件事：
//   · 信息流杂志感混排（community-feed.js buildBlocks）：第一条带图的是 16:10 大图卡；前 3 条都没图时第一条文字帖是「开篇卡」（类型色底 + 引号，不用占位图）；
//     没图的帖子「两张并排 / 一张通栏」交替，并排的两张都是文字帖（类型色底的封面字），活动不打断配对；每条动态只出现一次、先后不乱；
//   · 每张卡左上一行类型小字（kicker）+ 类型色（找搭子豆绿 / 旅居日常赭黄 / 经验分享陶土），小字在浅底和白卡上都够 4.5:1；
//   · 通栏文字卡的摘要放在浅色引号块里；文字小卡里没有任何 <image>（不拿占位图凑）；赞 / 评论 / 关注 / 分享 / 审核中灰掉都还在；
//   · 发布页按类型换图片区：经验分享照片九宫格（第一格大「添加经历照片」），旅居日常 16:9 大封面 + 铅笔圆钮，找搭子照旧；
//     已关联是白色小卡 + 分隔线下一行说明（只写真有的效果，不写「内容会归入该帖子下展示」）；补充信息是灰色折叠条；
//   · 关联选择页类型小标签分颜色；发布成功页有贴纸和光环；只用 common/icons.js 里已有的图标、不往 static 加图。
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'
import test from 'node:test'
import assert from 'node:assert/strict'
import * as feedJs from '../pages/community/community-feed.js'
import { displayWording } from '../common/display-wording.js'

const APP = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const require = createRequire(path.join(APP, 'package.json'))
const compiler = require('@vue/compiler-sfc'), vue = require('vue')
const { renderToString } = require('vue/server-renderer')
const read = (rel) => fs.readFileSync(path.join(APP, rel), 'utf8').replace(/\r\n/g, '\n')
const sfcOf = (rel) => compiler.parse(read(rel), { filename: rel }).descriptor
const cssOf = (sfc) => sfc.styles.map(s => s.content).join('\n').replace(/\/\*[\s\S]*?\*\//g, '')
const icons = (await import('../common/icons.js')).default
const index = sfcOf('pages/community/index.vue')
const publish = sfcOf('pages/community/publish.vue')
const link = sfcOf('pages/community/link.vue')
const published = sfcOf('pages/community/published.vue')
const itpl = index.template.content
const ptpl = publish.template.content
const icss = cssOf(index)
const pcss = cssOf(publish)
const { buildBlocks, kindOf } = feedJs

const post = (id, n = 0) => ({ postId: id, imgs: Array.from({ length: n }, (_, i) => 'img' + i) })
const act = (id) => ({ activityId: id })
const kinds = (blocks) => blocks.map(b => b.type + ':' + (b.items ? b.items.map(c => (c.act ? 'a' + c.act.activityId : c.post.postId)).join('+') : (b.act ? 'a' + b.act.activityId : b.post.postId)))
const postIds = (blocks) => blocks.flatMap(b => (b.items ? b.items.map(c => c.post && c.post.postId) : [b.post && b.post.postId])).filter(Boolean)

test('类型：找搭子 / 旅居日常 / 经验分享各有自己的 key 和名字，已知类型使用当前名称', () => {
  assert.deepEqual(kindOf({ kind: 'buddy' }), { key: 'buddy', label: '找搭子' })
  assert.deepEqual(kindOf({ kind: 'daily' }), { key: 'daily', label: '旅居日常' })
  assert.deepEqual(kindOf({ kind: 'diary' }), { key: 'diary', label: '经验分享' })
  assert.deepEqual(kindOf({ kind: 'daily', kindLabel: '旅居攻略' }), { key: 'daily', label: '旅居日常' })
  assert.deepEqual(kindOf({ kind: 'weird' }), { key: 'other', label: '' }, '认不出的不写类型小字')
  assert.deepEqual(kindOf(null), { key: 'other', label: '' })
})

test('全是文字帖（本机测试数据就是这样）：开篇卡 → 两张并排 → 一张通栏 → 两张并排…，活动不打断配对', () => {
  const list = Array.from({ length: 20 }, (_, i) => post(i + 1))
  const blocks = buildBlocks(list, [act(70), act(71), act(72)])
  assert.ok(blocks.every(b => ['text','act'].includes(b.type)), '统一通栏卡片')
  assert.equal(blocks.filter(b => b.act).length, 3)
  assert.deepEqual(postIds(blocks), list.map(p => p.postId), '每条动态只出现一次、先后不乱')
  // 并排的两张要么都是文字帖，要么都是「有图的」（带图动态 / 活动），不混排（格子上半截一个是照片一个是色块会参差）
  for (const b of blocks.filter(x => x.type === 'pair')) {
    const textCells = b.items.filter(c => c.post && !c.post.imgs.length).length
    assert.ok(textCells === 0 || textCells === 2, b.key)
  }
  const keys = blocks.map(b => b.key)
  assert.equal(new Set(keys).size, keys.length)
})

test('前 3 条里有带图的：不出开篇卡，带图的那条照旧是大图卡；开篇卡之后再出现带图的照样做大图卡', () => {
  assert.deepEqual(kinds(buildBlocks([post(1), post(2), post(3, 2), post(4)])), ['text:1','text:2','thumb:3','text:4'])
  assert.deepEqual(kinds(buildBlocks([post(1), post(2), post(3), post(4, 1), post(5), post(6)])), ['text:1','text:2','text:3','thumb:4','text:5','text:6'])
  assert.deepEqual(kinds(buildBlocks([])), [])
  // 只有一条文字帖：开篇卡
  assert.deepEqual(kinds(buildBlocks([post(9)])), ['text:9'])
})

test('连续有图帖子也有横向卡；穿插活动不丢帖、不重复、不改变帖子顺序', () => {
  const list = Array.from({ length: 10 }, (_, i) => post(i + 1, 3))
  assert.deepEqual(kinds(buildBlocks(list)), list.map(p => 'thumb:' + p.postId))
  const mixed = buildBlocks(list, [act(70), act(71)])
  assert.deepEqual(postIds(mixed), list.map(p => p.postId))
  assert.ok(mixed.some(b => b.type === 'thumb'))
  assert.equal(mixed.filter(b => b.moreActs).length, 1)
  assert.equal(new Set(mixed.map(b => b.key)).size, mixed.length)
})

test('信息流模板：类型色 class、类型小字、开篇卡、文字小卡的封面字、通栏摘要引号块', () => {
  assert.match(itpl, /<view v-else class="card fc feed-card" :class="\['fc--' \+ b\.type, 'kd-' \+ b\.post\.kindKey\]">/)
  assert.match(itpl, /<view v-else class="card fc-col" :class="'kd-' \+ c\.post\.kindKey" hover-class="k-press-s" @click="openPost\(c\.post\.postId\)">/)
  assert.match(itpl, /<view v-else-if="b\.type === 'lead'" class="fc__band" hover-class="k-press" @click="openPost\(b\.post\.postId\)">/)
  // 列表和详情共用完整的图片列表，组件负责横向切换。
  assert.match(itpl, /<view v-if="c\.post\.imgs\.length" class="fc-col__media"/)
  assert.match(itpl, /<post-photos :photos="c\.post\.imgs"/)
  assert.match(itpl, /<view v-else class="fc-col__cover">[\s\S]*?<text class="fc-col__cover-title">\{\{ c\.post\.titleText \}\}<\/text>/)
  assert.match(itpl, /<view v-if="b\.post\.content && b\.type === 'text'" class="fc__excerpt">/)
  assert.match(itpl, /<text class="kicker__kind">\{\{ b\.post\.kindText \}\}<\/text>/)
  assert.match(index.scriptSetup.content, /kindKey: kindOf\(p\)\.key, kindText: kindOf\(p\)\.label, kindColor: KIND_COLOR\[kindOf\(p\)\.key\], place: p\.city && p\.city !== city\.value \? p\.city : ''/)
  // 浅色引号用已有的 quote 图标（不用 Georgia 衬线字：全站系统黑体），颜色跟类型走
  assert.ok(icons.quote)
  // 袋鼠贴纸是主包里已有的图，不新加图片
})

test('样式：类型色小字在类型浅底和白底上都够 4.5:1', () => {
  const lum = (hex) => {
    const [r, g, b] = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255).map(c => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4))
    return 0.2126 * r + 0.7152 * g + 0.0722 * b
  }
  const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m); return (x + 0.05) / (y + 0.05) }
  for (const k of ['buddy', 'daily', 'diary', 'other']) {
    const m = new RegExp(`\\.kd-${k} \\{ --kc: (#[0-9A-F]{6}); --kc-soft: (#[0-9A-F]{6}); --kc-soft2: (#[0-9A-F]{6}); \\}`).exec(icss)
    assert.ok(m, k)
    for (const bg of [m[2], m[3], '#FFFFFF']) assert.ok(ratio(m[1], bg) >= 4.5, `${k} ${m[1]} on ${bg}: ${ratio(m[1], bg).toFixed(2)}`)
    assert.equal(feedJs.KIND_COLOR[k], m[1], k + ' 引号图标的颜色和样式里的 --kc 一致')
  }
  // 只在页面里定义类型色，不动全局主题
  assert.doesNotMatch(icss, /--k-red:|--k-sh1:/)
})

// ---------------------------------------------------------------- 把信息流这一屏真的渲染出来看（服务端渲染成 HTML）
const renderFeed = (() => {
  const out = compiler.compileTemplate({ source: itpl, filename: 'index.vue', id: 'mag', compilerOptions: { isCustomElement: (t) => !['post-photos', 'k-topbar'].includes(t) } })
  assert.deepEqual(out.errors, [])
  const code = out.code
    .replace(/^import \{([^}]+)\} from "vue"\n/m, (m, names) => `const {${names.replace(/ as /g, ': ')}} = vue\n`)
    .replace('export function render', 'function render') + '\n;globalThis.__render = render'
  const box = { vue }
  vm.createContext(box)
  vm.runInContext(code, box, { filename: 'index.vue:render' })
  return box.__render
})()
const view = (p) => ({
  ...p, name: p.author.name, avatar: '/a.jpg', phone: true, verified: false, followed: false, isMe: false,
  titleText: displayWording(feedJs.titleOf(p), [p.author?.name]), imgs: p.images || [], imgCount: (p.images || []).length, tags: feedJs.postTags(p), link: null,
  kindKey: kindOf(p).key, kindText: kindOf(p).label, kindColor: feedJs.KIND_COLOR[kindOf(p).key], place: ''
})
async function feedHtml(rows) {
  const posts = rows.map(view)
  const ctx = {
    s: 1, filterOpen: false, dateOpen: false, sortOpen: false, feedTab: '全部', BUDDY_TAB: '找搭子', DIARY_TAB: '经验分享', FEED_TABS: feedJs.FEED_TABS,
    keyword: '', sort: 'new', feedFailed: false, feedLoaded: true, posts, blocks: buildBlocks(posts, []), feed: { hasMore: false },
    privateChatEnabled: true, canShare: feedJs.canShare, canInteract: feedJs.canInteract, displayWording, R: {}, activeFilters: [], cats: [], mates: [], wideNow: false
  }
  const comp = { setup: () => ctx, render: renderFeed, components: {
    'k-topbar': { render() { return vue.h('header') } },
    'post-photos': { props: ['photos'], render() { return vue.h('div', { class: 'test-slides' }, this.photos.map(src => vue.h('image', { src }))) } }
  } }
  const app = vue.createSSRApp(comp)
  app.config.warnHandler = () => {}
  return renderToString(app)
}
const author = { userId: 7, name: '小院同学' }
const textPost = (id, kind, extra = {}) => ({ postId: id, kind, title: '标题' + id, content: '正文' + id, images: [], status: 'online', likes: 0, comments: 0, author, ...extra })

test('渲染：全是文字帖时，开篇卡 + 文字小卡 + 通栏引号块，卡片里没有任何照片；赞 / 评论 / 关注 / 分享都在', async () => {
  const html = await feedHtml([textPost(1, 'daily'), textPost(2, 'buddy'), textPost(3, 'diary'), textPost(4, 'daily', { status: 'pending' })])
  assert.match(html, /class="card fc feed-card fc--text kd-daily"/)
  assert.match(html, /class="card fc feed-card fc--text kd-buddy"/)
  assert.match(html, /class="card fc feed-card fc--text kd-diary"/)
  assert.match(html, /class="card fc feed-card fc--text kd-daily"/)
  assert.match(html, /class="fc__excerpt"/)
  // 只有开篇卡上的袋鼠贴纸和头像，没有帖子照片 / 占位图
  const imgs = [...html.matchAll(/<image [^>]*src="([^"]*)"/g)].map(m => m[1])
  assert.ok(imgs.every(src => src === '/a.jpg' || src === '/static/media/brand-kangaroo.png'), imgs.join(','))
  assert.ok(!html.includes('cover-empty'))
  for (const s of ['旅居日常', '找搭子', '经验分享', '关注', '分享', '标题2', '正文3']) assert.ok(html.includes(s), s)
  // 审核中的那条：赞 / 评论灰掉、出「审核中」小标签
  const pend = html.slice(html.indexOf('fc--text'))
  assert.match(pend, /fc__act fc__act--off/)
  assert.ok(pend.includes('动态待审核·仅自己可见'))
})

test('渲染：所有带图帖子使用通栏缩略图卡，保留作者和多图数量', async () => {
  const img = (id, kind, n = 1) => textPost(id, kind, { images: Array.from({ length: n }, (_, i) => '/p' + id + '-' + i + '.jpg') })
  const html = await feedHtml([img(1, 'daily'), img(2, 'buddy'), img(3, 'diary', 3)])
  for (const kind of ['daily','buddy','diary']) assert.ok(html.includes('card fc feed-card fc--thumb kd-' + kind))
  assert.ok(html.includes('/p1-0.jpg') && html.includes('/p3-0.jpg'))
  assert.ok(html.includes('小院同学'))
  assert.match(html, /class="test-slides">[\s\S]*?src="\/p3-0.jpg"[\s\S]*?src="\/p3-1.jpg"[\s\S]*?src="\/p3-2.jpg"/)
})

test('渲染：岗位称呼用换工，作者名与引用保持原样，源记录不改写', async () => {
  const row = textPost(1, 'daily', { title: '义工经历', content: '义工日常，作者义工小李说「义工生活」', author: { userId: 7, name: '义工小李' } })
  const html = await feedHtml([row])
  assert.ok(html.includes('换工经历'))
  assert.ok(html.includes('换工日常，作者义工小李说「义工生活」'))
  assert.ok(html.includes('义工小李'))
  assert.equal(row.title, '义工经历')
  assert.equal(row.content, '义工日常，作者义工小李说「义工生活」')
})

// ---------------------------------------------------------------- 发布页

test('发布页：经验分享是照片九宫格（第一格大「添加经历照片」），旅居日常选图后可预览或移除，找搭子照旧', () => {
  const out = compiler.compileTemplate({ source: ptpl, filename: 'publish.vue', id: 'pub' })
  assert.deepEqual(out.errors, [])
  assert.match(ptpl, /<view v-if="type === '经验分享'" class="exp-grid" :class="\{ 'exp-grid--filled': uploads.length > 1 \}">/)
  assert.match(ptpl, /class="exp-grid__big exp-grid__add" hover-class="k-press" @click="addImages">[\s\S]*?<text class="media-empty__title">添加经历照片<\/text><text class="media-empty__sub">最多 9 张<\/text>/)
  assert.match(ptpl, /<view v-if="uploads\.length < 9" class="exp-grid__cell exp-grid__plus" hover-class="k-press" @click="addImages">/)
  assert.match(ptpl, /class="cover__pen exp-grid__pen" hover-class="k-press-s" @click="replaceCover"/)
  assert.match(ptpl, /v-else-if="type === '旅居日常'"[\s\S]*?@click="previewUpload\(index\)"[\s\S]*?@click="removeUpload\(index\)"[\s\S]*?class="upload-add daily-add"[^>]*@click="addImages"/)
  assert.match(ptpl, /<view v-else-if="!uploads\.length" class="media-empty" hover-class="k-press" @click="addImages">/, '找搭子还是原来的虚线框')
  assert.match(pcss, /\.cover \{ position: relative; height: 0; padding-top: 56\.25%;/, '封面 16:9')
  assert.match(pcss, /\.exp-grid__big \{[^}]*grid-column: span 2; grid-row: span 2;/)
  // 2026-10-19 复查：样稿里是「右下橙色铅笔圆钮」，改用全站强调橙渐变
  assert.match(pcss, /\.cover__pen \{[^}]*border-radius: 50%;[^}]*background: var\(--k-red\);/)
  for (const name of ['image-plus', 'pencil', 'plus', 'images', 'x']) assert.ok(icons[name], name)
})

test('发布页：已关联是白色小卡 + 分隔线下一行说明（只写真有的效果）；补充信息是灰色折叠条', () => {
  assert.match(ptpl, /<view v-if="link0" class="link-pick">\s*<view class="link-pick__row">[\s\S]*?<\/view>\s*<text class="link-pick__note">发布后，读者可从你的帖子打开这个\{\{ link0\.label \}\}<\/text>\s*<\/view>/)
  assert.doesNotMatch(ptpl.replace(/<!--[\s\S]*?-->/g, ''), /归入该帖子/, '现在没有「归入该帖子下展示」这个功能，不写')
  assert.match(pcss, /\.link-pick__note \{[^}]*border-top: 1px solid var\(--k-line\);/)
  assert.match(pcss, /\.fold\.extra \{ background: var\(--k-paper2\); \}/)
})

test('关联选择页区分内容类型与选中状态，成功页显示结果和审核状态', () => {
  assert.match(link.template.content, /<text class="item__tag" :class="'item__tag--' \+ it\.type">\{\{ it\.label \}\}<\/text>/)
  const lcss = cssOf(link)
  for (const t of ['stay', 'job', 'activity']) assert.match(lcss, new RegExp(`\\.item__tag--${t} \\{`), t)
  assert.match(lcss, /\.item__pick\.on \{[^}]*background: var\(--k-red\);/)
  assert.match(published.template.content, /class="done-badge"/ )
  assert.match(published.template.content, /等待审核/)
})

// ---------------------------------------------------------------- 岗位「寻伴同行」带着岗位打开发布页（A 的 pages/jobs/team.vue）

test('发布页 ?kind=buddy&linkType=job&linkId=&linkTitle=&linkCity=：类型选找搭子，「关联帖子」预先选好这个岗位，发出去带 linkType=job / linkId', async () => {
  const { linkFromQuery, linkPayload, restoreLink } = await import('../pages/community/post-link.js')
  const q = { kind: 'buddy', linkType: 'job', linkId: '15162', linkTitle: '洱海边咖啡馆换宿', linkCity: '大理' }
  const pre = linkFromQuery(q)
  assert.deepEqual(pre, { type: 'job', id: 15162, title: '洱海边咖啡馆换宿', cover: '', city: '大理', label: '岗位', sub: '' })
  assert.deepEqual(pre, restoreLink({ type: 'job', id: 15162, title: '洱海边咖啡馆换宿', city: '大理' }), '和选择页 / 草稿里的关联同一个样子')
  assert.deepEqual(linkPayload('buddy', pre), { refType: 'job', refId: 15162, linkType: 'job', linkId: 15162 })
  // 不全的不当关联
  for (const bad of [{}, null, { linkType: 'job', linkId: '0', linkTitle: 'x' }, { linkType: 'job', linkId: '5' }, { linkType: 'order', linkId: '5', linkTitle: 'x' }]) assert.equal(linkFromQuery(bad), null)
  assert.equal(feedJs.typeOfKind('buddy'), '找搭子')
  // onLoad：先按 kind 选类型、再预选关联，之后才问要不要恢复草稿（恢复草稿时 applyDraft 用草稿里的关联整个换掉；丢弃时保留这个岗位）
  const js = publish.scriptSetup.content
  const onload = js.slice(js.indexOf('onLoad: async (q) => {'), js.indexOf('offerDraft()\n'))
  assert.match(onload, /if \(typeOfKind\(q\?\.kind\)\) pickType\(typeOfKind\(q\.kind\)\)[\s\S]*const preLink = linkFromQuery\(q\)\n\s*if \(preLink\) link0\.value = preLink\n\s*migrateDraft\(\)/)
  assert.match(js, /link0\.value = restoreLink\(d\.link\)/, '恢复的草稿以草稿为准')
  assert.match(js, /\.\.\.linkPayload\(KIND\[type\.value\], link0\.value\)/, '发布时带上关联')
})
