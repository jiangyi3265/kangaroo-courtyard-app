// 2026-10-17 旅居改版 R2（B）：小院「住过的家人评价」页 pages/stays/reviews.vue + 写评价页住宿评价附照片 的回归（node --test，不构建、不发请求）。
// 守住这几件事：
//   · 页面注册在 pages/stays 分包里（不占主包），顶栏「住过的家人评价」；
//   · 汇总卡：综合评分 + 星、家人评价条数、推荐率（接口不足 5 条给 null 时不出这一格）、分项（接口给空数组时不出）、大家提到（点一下只看提到它的）；
//   · 页签 全部 / 有图·视频 / 差评 +「筛选」面板（房型、入住时间，点「确定」才生效）；空的参数不发；
//   · 评价卡：【卫生】这类小标题画成小字、照片能点开大图、门店回复；匿名由后端处理；
//   · 一条评价都没有时写「还没有家人评价」；
//   · 写评价页只有住宿评价出现「晒晒小院照片」，提交时带 images（平台路径），岗位 / 活动评价照旧不带。
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'
import test from 'node:test'
import assert from 'node:assert/strict'
import * as h from '../pages/stays/stays-reviews.js'
// 2026-10-17 R3：评价视频用的小函数在 stays-media.js（详情页、生活碎片页也用）
import * as media from '../pages/stays/stays-media.js'

const APP = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const require = createRequire(path.join(APP, 'package.json'))
const compiler = require('@vue/compiler-sfc'), vue = require('vue')
const read = (rel) => fs.readFileSync(path.join(APP, rel), 'utf8').replace(/\r\n/g, '\n')
const readSfc = (rel) => compiler.parse(read(rel), { filename: rel }).descriptor
const flush = () => new Promise(resolve => setImmediate(resolve))
const noComments = (t) => t.replace(/<!--[\s\S]*?-->/g, '')
const page = readSfc('pages/stays/reviews.vue')
const pageT = noComments(page.template.content)
const pageJs = page.scriptSetup.content
const pageCss = page.styles.map(s => s.content).join('\n')
const review = readSfc('pages/profile/review.vue')
const reviewT = noComments(review.template.content)
const reviewJs = review.scriptSetup.content

test('小函数：分数、星、页签、请求参数、筛选数字', () => {
  assert.equal(h.stayReviewsUrl(7), '/pages/stays/reviews?stayId=7')
  assert.equal(h.scoreText(4.8), '4.8')
  assert.equal(h.scoreText(5), '5.0')
  assert.equal(h.scoreText(null), '—')
  assert.equal(h.scoreText(0), '—')
  assert.deepEqual(h.starFills(4.8), [true, true, true, true, true])
  assert.deepEqual(h.starFills(4.4), [true, true, true, true, false])
  assert.deepEqual(h.starFills(null), [false, false, false, false, false])
  assert.deepEqual(h.reviewTabs({ all: 12, media: 3, bad: 1 }).map(t => [t.key, t.label, t.count]), [['all', '全部', 12], ['media', '有图·视频', 3], ['bad', '差评', 1]])
  assert.deepEqual(h.reviewTabs(null).map(t => t.count), [0, 0, 0])
  assert.deepEqual(h.reviewQuery({ tab: 'all', roomTypeId: 0, month: '', mention: '', pageNum: 1 }), { pageNum: 1, pageSize: 10 })
  assert.deepEqual(h.reviewQuery({ tab: 'bad', roomTypeId: 11, month: '2026-09', mention: '小院安静', pageNum: 2, pageSize: 10 }),
    { pageNum: 2, pageSize: 10, tab: 'bad', roomTypeId: 11, month: '2026-09', mention: '小院安静' })
  assert.equal(h.filterCount({ roomTypeId: 0, month: '' }), 0)
  assert.equal(h.filterCount({ roomTypeId: 11, month: '2026-09' }), 2)
  assert.equal(h.recommendText(96), '96%')
  assert.equal(h.recommendText(0), '0%')
  assert.equal(h.recommendText(null), '')
})

test('评价正文拆段：【小标题】画成小字，空的小标题段落不要', () => {
  assert.deepEqual(h.contentParts('【卫生】房间很干净\n【服务】\n【安静舒适】晚上很安静'), [{ label: '卫生', text: '房间很干净' }, { label: '安静舒适', text: '晚上很安静' }])
  assert.deepEqual(h.contentParts('住得很开心\r\n\r\n下次还来'), [{ label: '', text: '住得很开心' }, { label: '', text: '下次还来' }])
  assert.deepEqual(h.contentParts(''), [])
  assert.deepEqual(h.contentParts(null), [])
})

test('卡片小标签、照片宫格、空态文案、已选条件', () => {
  assert.deepEqual(h.cardChips({ tags: ['回头客'], mentions: ['小院安静', '回头客', '房间干净', '早餐好吃', '交通方便'] }), ['回头客', '小院安静', '房间干净', '早餐好吃'])
  assert.deepEqual(h.cardChips({}), [])
  assert.deepEqual([1, 2, 3, 4, 5, 9].map(h.photoGrid), ['one', 'two', 'three', 'two', 'three', 'three'])
  assert.equal(h.emptyCopy(0, false).title, '还没有家人评价')
  assert.equal(h.emptyCopy(5, true).title, '没有符合条件的评价')
  const sum = { roomTypes: [{ roomTypeId: 11, name: '庭院大床房', count: 2 }], months: [{ month: '2026-09', label: '2026年9月', count: 2 }] }
  assert.deepEqual(h.activeFilters({ roomTypeId: 11, month: '2026-09', mention: '小院安静' }, sum).map(x => x.text), ['庭院大床房', '2026年9月入住', '提到「小院安静」'])
  assert.deepEqual(h.activeFilters({ roomTypeId: 0, month: '', mention: '' }, sum), [])
})

test('页面注册在 pages/stays 分包里，不在主包', () => {
  const pages = JSON.parse(read('pages.json'))
  const stays = pages.subPackages.find(p => p.root === 'pages/stays')
  assert.ok(stays.pages.some(p => p.path === 'reviews' && p.style.navigationStyle === 'custom'))
  assert.ok(!pages.pages.some(p => /reviews/.test(p.path)), '主包没有这个页面')
  assert.ok(fs.existsSync(path.join(APP, 'pages/stays/reviews.vue')))
  // 只引用主包里已有的模块，不往主包加东西
  // 2026-10-17 R3：多了同一分包里的 stays-media.js 和全屏播放组件 stay-video-player.vue
  for (const m of pageJs.matchAll(/from '([^']+)'/g)) assert.ok(/^(vue|@dcloudio\/uni-app|@\/common\/(screen|request|ui|upload)\.js|\.\/stays-(reviews|media|ai-summary|art)\.js|\.\/stay-video-player\.vue)$/.test(m[1]), m[1])
})

test('页面结构：汇总卡、大家提到、页签、筛选面板、评价卡、空态', () => {
  assert.match(pageT, /<k-topbar title="住过的家人评价" back \/>/)
  for (const s of ['综合评分', '家人评价', '推荐率', '大家提到', '筛选评价', '房型', '入住时间', '小院回复', '清除筛选', '重新加载']) assert.ok(pageT.includes(s), s)
  assert.match(pageT, /recommend \? recommend\.slice\(0, -1\) : '—'/, '推荐率不足时显示破折号，不编造百分比')
  assert.match(pageT, /v-if="recommend" class="sum__percent">%/, '百分号与真实推荐率一同显示，缺少推荐率时不显示百分号')
  assert.match(pageT, /v-if="sum\.dims && sum\.dims\.length"/, '分项为空时不出')
  assert.match(pageT, /v-if="sum\.mentions && sum\.mentions\.length"/)
  assert.match(pageT, /@click="toggleMention\(chip\.label\)"/)
  assert.match(pageT, /@click="previewPics\(review, imgIdx\)"/)
  assert.match(pageJs, /noneCopy = emptyCopy\(0, false\)/)
  assert.equal(h.emptyCopy(0, false).sub.includes('住过的家人'), true)
  // 2026-10-17 R3：评价视频满宽 16:9 放在照片上面，点了全屏播放（review.videos 的第一段）
  assert.match(read('pages/stays/reviews.vue'), /review\.videos/)
  assert.match(pageT, /<view v-if="review\.video" class="rv__video" hover-class="k-press-s" @click="playVideo\(review\.video\)">/)
  assert.match(pageT, /<stay-video-player :src="playing\.url" :poster="playing\.cover"/)
  assert.match(pageCss, /\.rv__video \{ position: relative; margin-top: 12px; width: 100%; height: 0; padding-bottom: 56\.25%;/)
  // 大图布局和预览实际尺寸由本轮浏览器用例验证。
  assert.match(pageT, /@click="previewPics\(review, imgIdx\)"/)
  assert.match(pageT, /review.grid === 'lead' && imgIdx === 0/)
  // 筛选面板两组（房型、入住时间）按 12 栏排、一行最多两项
  assert.match(pageCss, /\.panel__opts \{ display: grid; grid-template-columns: repeat\(12, minmax\(0, 1fr\)\);/)
  assert.match(pageT, /:style="'grid-column: span ' \+ roomSpans\[roomIdx \+ 1\]"/)
  assert.match(pageT, /:style="'grid-column: span ' \+ monthSpans\[monIdx \+ 1\]"/)
  assert.deepEqual(h.optSpans(2), [6, 6], '「不限 + 一个房型」两格各占半行，不空一格')
  assert.deepEqual(h.optSpans(3), [6, 6, 12])
  assert.deepEqual(h.optSpans(4), [6, 6, 6, 6])
  // 小程序里 v-for 的别名和编译出的短属性名（a、b、m…）撞上会取错值：别名都用长名字
  for (const m of pageT.matchAll(/v-for="\(?([^)"]+?)\)? in /g)) for (const alias of m[1].split(',').map(s => s.trim())) assert.ok(alias.length >= 3, 'v-for 别名太短：' + alias)
  // 微信 WXSS 不认 `> :first-child` 这种写法
  assert.ok(!/[>+~]\s*:(?!:)[a-z-]/i.test(pageCss.replace(/\/\*[\s\S]*?\*\//g, '')))
  // 模板能编译
  const out = compiler.compileTemplate({ source: page.template.content, filename: 'reviews.vue', id: 'x' })
  assert.deepEqual(out.errors, [])
})

// 把 reviews.vue 的 <script setup> 放进沙箱跑：接口换成记录参数的假函数，stays-reviews.js 用真的
function runPage({ summary, rowsFor = () => ({ rows: [], total: 0, hasMore: false }), fail } = {}) {
  const ast = compiler.babelParse(pageJs, { sourceType: 'module' })
  const body = ast.program.body.filter(n => n.type !== 'ImportDeclaration').map(n => pageJs.slice(n.start, n.end)).join('\n')
  const calls = [], toasts = [], previews = [], screen = {}
  let reach = null
  const sandbox = {
    console, setTimeout, clearTimeout, ...h, ...media,
    ref: vue.ref, computed: vue.computed,
    onReachBottom: (fn) => { reach = fn },
    useScreen: (max, extra) => { screen.extra = extra; return vue.ref(1) },
    back() {}, toast: (t) => toasts.push(t), errText: (e, d) => (e && e.message) || d,
    absUrl: (p) => (/^\/profile\//.test(p || '') ? 'https://api.test' + p : p),
    get: async (url, params) => {
      calls.push({ url, params })
      if (fail) throw new Error(fail)
      if (url.endsWith('/summary')) return { data: summary }
      return { data: rowsFor(params) }
    },
    uni: { previewImage: (o) => previews.push(o) }
  }
  vm.createContext(sandbox)
  const scope = vue.effectScope()
  scope.run(() => vm.runInContext(body + '\n;globalThis.__x = { loaded, loadError, sum, total, avgText, recommend, tabs, tab, rows, hasMore, mention, roomTypeId, month, filterN, actives, panelOpen, draftRoom, draftMonth, togglePanel, applyPanel, resetDraft, setTab, toggleMention, clearFilter, clearAll, previewPics, loadList, playing, playVideo, closeVideo }', sandbox, { filename: 'reviews.vue:script-setup' }))
  return { x: sandbox.__x, calls, toasts, previews, screen, reach: () => reach && reach(), stop: () => scope.stop() }
}

const SUMMARY = {
  stayId: 7, stayName: '平潭袋鼠小院', count: 12, avg: 4.8, recommendRate: 92, recommendMin: 5,
  dims: [{ label: '卫生', avg: 4.8 }, { label: '设施', avg: 4.6 }, { label: '服务', avg: 4.9 }, { label: '安静', avg: 4.7 }, { label: '位置', avg: 4.5 }],
  mentions: [{ label: '小院安静', count: 5 }, { label: '房间干净', count: 4 }],
  tabs: { all: 12, media: 3, bad: 1 },
  roomTypes: [{ roomTypeId: 11, name: '庭院大床房', count: 8 }], months: [{ month: '2026-09', label: '2026年9月', count: 6 }]
}
const ROW = {
  reviewId: 1, name: '匿名住客', avatar: '', rating: 5, content: '【卫生】很干净\n【安静舒适】晚上很安静', images: ['/profile/upload/a.jpg', '/profile/upload/b.jpg'],
  videos: [], tags: [], mentions: ['小院安静', '房间干净'], roomType: '庭院大床房', stayMonth: '2026年9月入住', date: '2026.10', reply: '谢谢家人', replyDate: '2026.10.13'
}

test('打开页面：先取汇总再取第一页；卡片字段加工好', async () => {
  const p = runPage({ summary: SUMMARY, rowsFor: () => ({ rows: [ROW], total: 11, hasMore: true }) })
  p.screen.extra.onLoad({ stayId: '7' })
  await flush(); await flush()
  assert.equal(p.x.loaded.value, true)
  assert.equal(p.x.avgText.value, '4.8')
  assert.equal(p.x.recommend.value, '92%')
  assert.deepEqual(p.calls.map(c => c.url), ['/app/stay/7/reviews/summary', '/app/stay/7/reviews'])
  assert.deepEqual(p.calls[1].params, { pageNum: 1, pageSize: 10 })
  const card = p.x.rows.value[0]
  assert.equal(card.avatarSrc, '/static/media/profile-avatar.jpg')
  assert.deepEqual(card.parts, [{ label: '卫生', text: '很干净' }, { label: '安静舒适', text: '晚上很安静' }])
  assert.deepEqual(card.pics, ['https://api.test/profile/upload/a.jpg', 'https://api.test/profile/upload/b.jpg'])
  assert.equal(card.grid, 'two')
  assert.deepEqual(card.chips, ['小院安静', '房间干净'])
  assert.equal(card.video, null, '没有视频的评价不出视频格')
  p.x.previewPics(card, 1)
  assert.deepEqual(JSON.parse(JSON.stringify(p.previews[0])), { urls: ['https://api.test/profile/upload/a.jpg', 'https://api.test/profile/upload/b.jpg'], current: 'https://api.test/profile/upload/b.jpg' })
  // 上滑加载第二页
  p.reach(); await flush()
  assert.deepEqual(p.calls[2].params, { pageNum: 2, pageSize: 10 })
  assert.equal(p.x.rows.value.length, 2)
  p.stop()
})

test('页签、大家提到、筛选面板（确定才生效）、清除条件都带对参数', async () => {
  const p = runPage({ summary: SUMMARY, rowsFor: () => ({ rows: [ROW], total: 1, hasMore: false }) })
  p.screen.extra.onLoad({ stayId: '7' })
  await flush(); await flush()
  const last = () => p.calls[p.calls.length - 1].params
  p.x.setTab('bad'); await flush()
  assert.deepEqual(last(), { pageNum: 1, pageSize: 10, tab: 'bad' })
  p.x.toggleMention('小院安静'); await flush()
  assert.deepEqual(last(), { pageNum: 1, pageSize: 10, tab: 'bad', mention: '小院安静' })
  const n = p.calls.length
  p.x.togglePanel()
  p.x.draftRoom.value = 11
  p.x.draftMonth.value = '2026-09'
  assert.equal(p.calls.length, n, '面板里点选不发请求')
  assert.equal(p.x.filterN.value, 0)
  p.x.applyPanel(); await flush()
  assert.equal(p.x.panelOpen.value, false)
  assert.deepEqual(last(), { pageNum: 1, pageSize: 10, tab: 'bad', roomTypeId: 11, month: '2026-09', mention: '小院安静' })
  assert.equal(p.x.filterN.value, 2)
  assert.deepEqual(p.x.actives.value.map(a => a.text), ['庭院大床房', '2026年9月入住', '提到「小院安静」'])
  p.x.clearFilter('room'); await flush()
  assert.deepEqual(last(), { pageNum: 1, pageSize: 10, tab: 'bad', month: '2026-09', mention: '小院安静' })
  p.x.toggleMention('小院安静'); await flush()
  assert.equal(last().mention, undefined, '再点一次取消')
  p.x.clearAll(); await flush()
  assert.deepEqual(last(), { pageNum: 1, pageSize: 10 })
  p.stop()
})

test('没有评价：不取列表，显示「还没有家人评价」；接口失败：显示原因和重新加载', async () => {
  const none = runPage({ summary: { ...SUMMARY, count: 0, avg: null, recommendRate: null, dims: [], mentions: [], tabs: { all: 0, media: 0, bad: 0 }, roomTypes: [], months: [] } })
  none.screen.extra.onLoad({ stayId: '7' })
  await flush(); await flush()
  assert.equal(none.x.total.value, 0)
  assert.equal(none.x.recommend.value, '')
  assert.deepEqual(none.calls.map(c => c.url), ['/app/stay/7/reviews/summary'])
  assert.match(pageT, /<block v-else-if="loaded">[\s\S]*?class="sum"/)
  assert.match(pageT, /!rows.length && !listLoading[\s\S]*?filteredCopy\.title/)
  none.stop()
  const bad = runPage({ fail: '房源不存在或已下架' })
  bad.screen.extra.onLoad({ stayId: '7' })
  await flush(); await flush()
  assert.equal(bad.x.loadError.value, '房源不存在或已下架')
  bad.stop()
  const missing = runPage({ summary: SUMMARY })
  missing.screen.extra.onLoad({})
  await flush()
  assert.equal(missing.x.loadError.value, '没有找到这家小院')
  assert.equal(missing.calls.length, 0)
  missing.stop()
})

test('写评价页：住宿和岗位评价允许附图，提交平台路径；活动保持不变', () => {
  assert.match(reviewT, /<view v-if="canPhoto" class="pics">/)
  assert.ok(reviewT.includes('晒晒小院照片'))
  assert.match(reviewJs, /const canPhoto = computed\(\(\) => !!target\.value && \['application', 'stay_order'\]\.includes\(target\.value\.bizType\)\)/)
  assert.match(reviewJs, /const PIC_MAX = 9/)
  assert.match(reviewJs, /uploadTo\('\/app\/upload\/image', p\)/)
  assert.match(reviewJs, /if \(canPhoto\.value && reviewPics\.value\.length\) payload\.images = reviewPics\.value\.map\(x => x\.url\)/)
  assert.match(reviewJs, /if \(picUploading\.value\) return toast\('照片还在上传，请稍等'\)/)
  // 换一笔要评价的订单时照片清空
  assert.match(reviewJs, /function resetQuestions\(bizType\) \{\n  editingIdx\.value = -1\n  reviewPics\.value = \[\]/)
  // reviewPics 要在第一次 resetQuestions 之前定义（脚本顶层就调用了一次）
  assert.ok(reviewJs.indexOf('const reviewPics = ref([])') < reviewJs.indexOf('resetQuestions(query.bizType)'))
  for (const m of reviewT.matchAll(/v-for="\(?([^)"]+?)\)? in reviewPics/g)) for (const alias of m[1].split(',').map(s => s.trim())) assert.ok(alias.length >= 3, alias)
  const out = compiler.compileTemplate({ source: review.template.content, filename: 'review.vue', id: 'y' })
  assert.deepEqual(out.errors, [])
})

test('2026-10-17 R3：带视频的评价 —— 卡片带 video（封面补全地址），点了出全屏播放层，关掉清空', async () => {
  const V = '/profile/upload/videos/2026/10/17/0123456789abcdef0123456789abcdef.mp4'
  const row = { ...ROW, images: [], videos: [{ url: V, cover: '/profile/upload/c.jpg' }] }
  const p = runPage({ summary: SUMMARY, rowsFor: () => ({ rows: [row], total: 1, hasMore: false }) })
  p.screen.extra.onLoad({ stayId: '7' })
  await flush(); await flush()
  const card = p.x.rows.value[0]
  assert.deepEqual(JSON.parse(JSON.stringify(card.video)), { url: V, cover: 'https://api.test/profile/upload/c.jpg' })
  assert.deepEqual(card.pics, [])
  p.x.playVideo(card.video)
  assert.equal(p.x.playing.value.url, V, '播放层自己补接口域名（absUrl）')
  p.x.closeVideo()
  assert.deepEqual(JSON.parse(JSON.stringify(p.x.playing.value)), {})
  // 外链 / 没有 url 的视频不出
  assert.equal(media.reviewVideo({ videos: [{ url: 'https://evil.example.com/a.mp4' }] }), null)
  assert.deepEqual(media.reviewVideo({ videos: [{ url: V }] }), { url: V, cover: '' })
  p.stop()
})
