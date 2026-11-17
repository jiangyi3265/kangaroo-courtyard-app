// 2026-10-17 旅居改版 R3（主人效果图 7「3分钟看小院」、「近期生活碎片」页、评价视频）的回归（node --test，不构建、不发请求）。
// 守住这几件事：
//   · 详情页：员工端传了小院视频才出「3分钟看小院」卡；有显示中的生活碎片才出「近期生活碎片」入口（和「住过的家人评价」并排）；
//     房型有短视频时图上出播放按钮和「≤1分钟」角标（点按钮播放，点卡片别处照旧选房型）；「住过的家人评价」进新的小院评价页；
//   · 生活碎片页：顶部背景图 + 磨砂卡（标题 / 副标题 / 文案都来自接口），两列错落白卡（日期角标、视频小播放标记、一句话），点照片看大图、点视频全屏播放；
//   · 视频上传（员工端 stay-video.js、写评价 review-video.js 两份内容相同，各在自己的分包里）：选完先查格式 / 大小 / 时长，
//     按顺序分段传（8MB 一段，原始字节），失败告诉服务端放弃；缩略图传成封面，网页版没有缩略图时封面留空；
//   · 员工端「视频与生活碎片」屏（rooms.vue s=5）：小院视频、房型视频、生活碎片顶部和每一条；写评价页住宿评价能附 1 段视频；
//   · 员工端评价列表 / 详情能看到评价视频；全都放在分包里，不往主包加文件。
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'
import test from 'node:test'
import assert from 'node:assert/strict'
import * as m from '../pages/stays/stays-media.js'
import * as sv from '../pages/staff/stay-video.js'
import * as rv from '../pages/profile/review-video.js'
import { stayReviewsUrl } from '../pages/stays/stays-reviews.js'

const APP = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const require = createRequire(path.join(APP, 'package.json'))
const compiler = require('@vue/compiler-sfc'), vue = require('vue')
const read = (rel) => fs.readFileSync(path.join(APP, rel), 'utf8').replace(/\r\n/g, '\n')
const readSfc = (rel) => compiler.parse(read(rel), { filename: rel }).descriptor
const flush = () => new Promise(resolve => setImmediate(resolve))
const noComments = (t) => t.replace(/<!--[\s\S]*?-->/g, '')
const V = '/profile/upload/videos/2026/10/17/0123456789abcdef0123456789abcdef.mp4'
const IMG = '/profile/upload/2026/10/17/abc.jpg'

const detail = readSfc('pages/stays/detail.vue')
const detailT = noComments(detail.template.content)
const detailJs = detail.scriptSetup.content
const diary = readSfc('pages/stays/diary.vue')
const diaryT = noComments(diary.template.content)
const diaryJs = diary.scriptSetup.content
const player = readSfc('pages/stays/stay-video-player.vue')
const rooms = readSfc('pages/staff/rooms.vue')
const roomsT = noComments(rooms.template.content)
const roomsJs = rooms.scriptSetup.content
const review = readSfc('pages/profile/review.vue')
const reviewT = noComments(review.template.content)
const reviewJs = review.scriptSetup.content
const staffReviews = readSfc('pages/staff/reviews.vue')

const compiles = (sfc, name) => {
  const out = compiler.compileTemplate({ source: sfc.template.content, filename: name, id: name })
  assert.deepEqual(out.errors, [], name)
}
const longAliases = (t) => {
  // 小程序里 v-for 的别名和编译出的短属性名（a、b、m…）撞上会取错值：新写的别名都用长名字
  for (const x of t.matchAll(/v-for="\(?([^)"]+?)\)? in /g)) for (const alias of x[1].split(',').map(s => s.trim())) assert.ok(alias.length >= 3, 'v-for 别名太短：' + alias)
}

// ---------------------------------------------------------------- stays-media.js

test('stays-media：只认平台视频路径；详情的视频卡 / 生活碎片入口 / 入口张数 / 房型视频 / 评价视频', () => {
  assert.equal(m.isVideoUrl(V), true)
  for (const bad of ['', null, 'https://evil.example.com/a.mp4', IMG, V + '?x=1', V.replace('.mp4', '.avi')]) assert.equal(m.isVideoUrl(bad), false, String(bad))
  assert.equal(m.introCard(null, IMG), null)
  assert.equal(m.introCard({ url: '' }, IMG), null)
  assert.deepEqual(m.introCard({ url: V, cover: '' }, IMG), { url: V, cover: IMG }, '没封面用房源封面')
  assert.deepEqual(m.introCard({ url: V, cover: '/c.jpg' }, IMG), { url: V, cover: '/c.jpg' })
  assert.equal(m.diaryEntry({ count: 0, thumbs: [IMG] }), null, '一条都没有不出入口')
  assert.deepEqual(m.diaryEntry({ count: 5, thumbs: ['a', '', 'b', 'c', 'd'] }), { count: 5, thumbs: ['a', 'b', 'c'] })
  assert.equal(m.entryCount(false, 0), 1)
  assert.equal(m.entryCount(true, 0), 2)
  assert.equal(m.entryCount(true, 3), 3)
  assert.equal(m.roomVideo({ videoUrl: '' }), null)
  assert.deepEqual(m.roomVideo({ videoUrl: V, videoCover: '', cover: IMG }), { url: V, cover: IMG })
  assert.equal(m.reviewVideo({ videos: [] }), null)
  assert.deepEqual(m.reviewVideo({ videos: [{ url: 'x' }, { url: V, cover: IMG }] }), { url: V, cover: IMG })
  assert.equal(m.stayDiaryUrl(7), '/pages/stays/diary?stayId=7')
  assert.equal(stayReviewsUrl(7), '/pages/stays/reviews?stayId=7')
  assert.deepEqual(m.PHOTO_HEIGHT, { one: 220, two: 150, three: 104 })
  assert.equal(m.ROOM_VIDEO_BADGE, '≤1分钟')
})

test('stays-media：生活碎片卡片、两列错落（左右交替、不按加载后的高度重排）、顶部默认文字、看大图只翻照片', () => {
  const cards = [{ diaryId: 1, type: 'image', url: IMG, cover: IMG, date: '10.12', caption: '火烧云' }, { diaryId: 2, type: 'video', url: V, cover: '', date: '10.11', caption: '早餐' },
    { diaryId: 3, type: 'image', url: '/b.jpg', cover: '/b.jpg', date: '', caption: '' }].map(m.diaryCard)
  assert.deepEqual(cards[1], { diaryId: 2, type: 'video', url: V, thumb: '', date: '10.11', caption: '早餐' }, '视频没封面：缩略图空着（画占位底色）')
  assert.equal(cards[0].thumb, IMG)
  const [left, right] = m.twoColumns(cards)
  assert.deepEqual(left.map(c => c.diaryId), [1, 3])
  assert.deepEqual(right.map(c => c.diaryId), [2])
  assert.deepEqual(m.diaryHeader(null), { bg: '', title: '小院日记', subtitle: '把日子过成一段可以翻看的记忆', lines: [] })
  assert.deepEqual(m.diaryHeader({ bg: IMG, title: '袋鼠日记', subtitle: 'x', lines: ['花开有信', '', '晚风有约', '三', '四'] }).lines, ['花开有信', '晚风有约', '三'])
  assert.deepEqual(m.previewList(cards, cards[2]), { urls: [IMG, '/b.jpg'], current: '/b.jpg' })
  assert.deepEqual(m.previewList(cards, cards[1]).current, IMG)
})

// ---------------------------------------------------------------- 详情页

test('详情：3分钟看小院卡、近期生活碎片入口、房型视频按钮、全屏播放层；评价入口进新页', () => {
  assert.match(detailT, /<view v-if="introVideo" class="sec-card vcard">/)
  assert.match(detailT, /<view class="vcard__cover" hover-class="k-press-s" @click="playVideo\(introVideo, INTRO_TITLE\)">/)
  assert.match(detailT, /<text class="vcard__cap">\{\{ INTRO_CAPTION \}\}<\/text>/)
  assert.equal(m.INTRO_TITLE, '3分钟看小院')
  assert.equal(m.INTRO_CAPTION, '看院子全貌、房间和公共空间')
  assert.match(detailT, /<view class="entries">/)
  assert.match(detailT, /<view class="entry entry--diary" hover-class="k-press-s" @click="openDiary"><view class="entry__copy"><text class="entry__title">\{\{ DIARY_TITLE \}\}<\/text><text class="entry__sub">\{\{ DIARY_SUB \}\}<\/text>/)
  assert.equal(m.DIARY_TITLE + '·' + m.DIARY_SUB, '近期生活碎片·主理人更新小院日常')
  // 「住过的家人评价」在最前，生活碎片紧挨着它，Vlog 在后
  // 2026-10-18：「住过的家人评价」左边多了一个总结分（entry__score），标题照旧
  const i = detailT.indexOf('<view class="entry__copy"><text class="entry__title">住过的家人评价')
  assert.match(detailT.slice(0, i), /@click="openReviews">\s*<view class="entry__score"/)
  assert.ok(i > 0 && i < detailT.indexOf('@click="openDiary"') && detailT.indexOf('@click="openDiary"') < detailT.indexOf('<view v-if="vlogs.length" class="entry"'))
  // 房型卡：播放按钮 catch 住点击（不触发选房型），角标「≤1分钟」
  assert.match(detailT, /<view v-if="r\.video" class="rt__play" @click\.stop="playVideo\(r\.video, r\.name\)">/)
  assert.match(detailT, /<text class="rt__badge">\{\{ ROOM_VIDEO_BADGE \}\}<\/text>/)
  assert.match(detailT, /class="rt" :class="\{ on: selRoomId === r\.roomTypeId, off: !r\.bookable \}" hover-class="k-press-s" @click="pickRoom\(r\)"/, '点卡片照旧选房型')
  assert.match(detailT, /<stay-video-player :src="playing\.url" :poster="playing\.cover" :title="playing\.title" @close="closeVideo" \/>/)
  assert.match(detailJs, /import StayVideoPlayer from '\.\/stay-video-player\.vue'/)
  assert.match(detailJs, /video: roomVideo\(\{ \.\.\.r, cover: r\.cover \|\| d\.value\.cover \}\)/)
  // 评价入口：进 /pages/stays/reviews?stayId=，不再进门店的同行队伍页
  const block = detailJs.slice(detailJs.indexOf('const openReviews = () => {'), detailJs.indexOf('\n}\n', detailJs.indexOf('const openReviews = () => {')) + 2)
  assert.ok(!block.includes('jobTeam'))
  const gone = []
  new Function('stayId', 'toast', 'go', 'stayReviewsUrl', block + '\nopenReviews()')(42, () => {}, (u) => gone.push(u), stayReviewsUrl)
  assert.deepEqual(gone, ['/pages/stays/reviews?stayId=42'])
  compiles(detail, 'detail.vue')
})

test('全屏播放层：小程序拿到视频宽高再请求系统全屏（横拍 direction 90 横屏占满），退出全屏就关掉；网页版横拍的整层转 90°；地址补接口域名', () => {
  const t = noComments(player.template.content)
  const js = player.scriptSetup.content
  assert.match(t, /<view v-if="src" class="svp" :class="\{ 'svp--land': rotate \}" :style="rotateStyle"/)
  assert.match(t, /<video :id="vid" class="svp__video" :src="fullSrc" :poster="fullPoster" autoplay controls show-fullscreen-btn/)
  assert.match(t, /@loadedmetadata="onMeta"/)
  // 10-19 复查（主人：「评价的视频要能占满整个手机横屏」）：之前一打开就 requestFullScreen({})，那时宽高还没加载出来，横拍的也常常竖着全屏
  assert.match(js, /ctx = uni\.createVideoContext\(vid, inst && inst\.proxy\)\n\s*ctx\.requestFullScreen\(direction == null \? \{\} : \{ direction \}\)/)
  assert.match(js, /goFull\(props\.landscape \? 90 : fullDirection\(size\.value\)\)/, '拿到宽高后按横竖指定方向')
  assert.match(js, /fallback = setTimeout\(\(\) => goFull\(props\.landscape \? 90 : null\), 2500\)/, '网慢拿不到宽高时 2.5 秒后照常全屏')
  assert.equal(m.fullDirection({ w: 1280, h: 720 }), 90, '横拍：横屏')
  assert.equal(m.fullDirection({ w: 720, h: 1280 }), 0, '竖拍：竖屏')
  assert.equal(m.fullDirection({ w: 0, h: 0 }), null, '还不知道宽高：不指定')
  assert.deepEqual(m.landscapeTurn({ w: 1280, h: 720 }, { w: 375, h: 812 }), { width: 812, height: 375, transform: 'translateX(375px) rotate(90deg)' }, '网页版竖着拿手机看横拍：整层转过来铺满')
  assert.equal(m.landscapeTurn({ w: 1280, h: 720 }, { w: 812, h: 375 }), null, '手机已经横过来了：不转')
  assert.equal(m.landscapeTurn({ w: 720, h: 1280 }, { w: 375, h: 812 }), null, '竖拍：不转')
  assert.match(js, /if \(wentFull\) close\(\)/)
  assert.match(js, /const fullSrc = computed\(\(\) => absUrl\(props\.src\)\)/)
  const css = player.styles.map(s => s.content).join('\n')
  assert.match(css, /\.svp \{ position: fixed; left: 0; right: 0; top: 0; bottom: 0; z-index: 900; background: #000;/)
  compiles(player, 'stay-video-player.vue')
})

// ---------------------------------------------------------------- 生活碎片页

function runDiary({ res, fail } = {}) {
  const ast = compiler.babelParse(diaryJs, { sourceType: 'module' })
  const body = ast.program.body.filter(n => n.type !== 'ImportDeclaration').map(n => diaryJs.slice(n.start, n.end)).join('\n')
  const calls = [], toasts = [], previews = [], screen = {}
  let reach = null
  const sandbox = {
    console, setTimeout, clearTimeout, ...m,
    ref: vue.ref, computed: vue.computed,
    onReachBottom: (fn) => { reach = fn }, onPageScroll: () => {}, onHide: () => {}, onShow: () => {},
    TAB_DIARY: 'diary', TAB_COMMENT: 'comment', tabFromQuery: () => 'diary', commentTabLabel: (n) => String(n), commentCard: (x) => x, commentList: (a, b) => [...a, ...b],
    useScreen: (max, extra) => { screen.extra = extra; return vue.ref(1) },
    toast: (t) => toasts.push(t), errText: (e, d) => (e && e.message) || d,
    absUrl: (p) => (/^\/profile\//.test(p || '') ? 'https://api.test' + p : p),
    get: async (url, params) => { calls.push({ url, params }); if (fail) throw new Error(fail); return { data: res(params) } },
    uni: { previewImage: (o) => previews.push(o) }
  }
  vm.createContext(sandbox)
  const scope = vue.effectScope()
  scope.run(() => vm.runInContext(body + '\n;globalThis.__x = { header, cards, columns, loaded, loadError, hasMore, open, playing, closeVideo, reload }', sandbox, { filename: 'diary.vue:script-setup' }))
  return { x: sandbox.__x, calls, toasts, previews, screen, reach: () => reach && reach(), stop: () => scope.stop() }
}

test('生活碎片页：顶部来自接口、两列卡片、点照片看大图（只翻照片）、点视频全屏播放、上滑加载下一页', async () => {
  const rows = [{ diaryId: 1, type: 'image', url: IMG, cover: IMG, caption: '火烧云', date: '10.12' }, { diaryId: 2, type: 'video', url: V, cover: '/profile/upload/c.jpg', caption: '星空', date: '10.11' },
    { diaryId: 3, type: 'image', url: '/profile/upload/d.jpg', cover: '/profile/upload/d.jpg', caption: '早餐', date: '10.10' }]
  const p = runDiary({ res: (q) => (q.page === 1 ? { header: { bg: IMG, title: '小院日记', subtitle: '把日子过成一段可以翻看的记忆', lines: ['花开有信，晚风有约'] }, rows, hasMore: true }
    : { header: { title: '小院日记' }, rows: [{ diaryId: 4, type: 'image', url: '/profile/upload/e.jpg', cover: '/profile/upload/e.jpg' }], hasMore: false }) })
  p.screen.extra.onLoad({ stayId: '7' })
  await flush(); await flush()
  const diaryCalls = () => p.calls.filter(c => c.url === '/app/stay/7/diary')
  assert.deepEqual(JSON.parse(JSON.stringify(diaryCalls()[0])), { url: '/app/stay/7/diary', params: { page: 1 } })
  assert.equal(p.x.header.value.title, '小院日记')
  assert.deepEqual(p.x.header.value.lines, ['花开有信，晚风有约'])
  assert.deepEqual(p.x.columns.value.map(col => col.map(c => c.diaryId)), [[1, 3], [2]])
  p.x.open(p.x.cards.value[2])
  assert.deepEqual(JSON.parse(JSON.stringify(p.previews[0])), { urls: ['https://api.test' + IMG, 'https://api.test/profile/upload/d.jpg'], current: 'https://api.test/profile/upload/d.jpg' })
  p.x.open(p.x.cards.value[1])
  assert.deepEqual(JSON.parse(JSON.stringify(p.x.playing.value)), { url: V, cover: '/profile/upload/c.jpg' })
  p.x.closeVideo()
  assert.deepEqual(JSON.parse(JSON.stringify(p.x.playing.value)), {})
  p.reach(); await flush()
  assert.deepEqual(JSON.parse(JSON.stringify(diaryCalls()[1].params)), { page: 2 })
  assert.equal(p.x.cards.value.length, 4)
  assert.equal(p.x.hasMore.value, false)
  p.stop()
  // 加载失败：写出原因、有「重新加载」
  const bad = runDiary({ fail: '房源不存在或已下架' })
  bad.screen.extra.onLoad({ stayId: '7' })
  await flush(); await flush()
  assert.equal(bad.x.loadError.value, '房源不存在或已下架')
  bad.stop()
})

test('生活碎片页：结构、注册在 pages/stays 分包、只引用分包里的和主包已有的模块', () => {
  assert.match(diaryT, /<k-topbar :title="source \? source.title : '近期生活碎片'" back \/>/)
  assert.match(diaryT, /<image v-if="header\.bg" class="dh__bg" :src="absUrl\(header\.bg\)" mode="aspectFill" \/>/)
  assert.match(diaryT, /<k-icon name="leaf"/)
  assert.match(diaryT, /<text class="dh__title">\{\{ header\.title \}\}<\/text>/)
  assert.match(diaryT, /<text class="dh__sub">\{\{ header\.subtitle \}\}<\/text>/)
  assert.match(diaryT, /<image v-if="card\.thumb" class="dc__img" :src="absUrl\(card\.thumb\)" mode="aspectFill" lazy-load \/>/, '封面按参考图固定横竖比例裁切，点击预览仍使用原始媒体')
  assert.match(diaryT, /<text v-if="card\.date" class="dc__date">\{\{ card\.date \}\}<\/text>/)
  assert.match(diaryT, /<view v-if="card\.type === 'video'" class="dc__play">/)
  assert.match(diaryT, /<text v-if="card\.caption" class="dc__cap">\{\{ card\.caption \}\}<\/text>/)
  assert.ok(diaryT.includes('主理人还没有更新生活碎片'))
  longAliases(diaryT)
  const pages = JSON.parse(read('pages.json'))
  const stays = pages.subPackages.find(x => x.root === 'pages/stays')
  assert.ok(stays.pages.some(x => x.path === 'diary' && x.style.navigationStyle === 'custom'))
  assert.ok(!pages.pages.some(x => /diary/.test(x.path)), '主包没有这个页面')
  for (const x of diaryJs.matchAll(/from '([^']+)'/g)) assert.ok(/^(vue|@dcloudio\/uni-app|@\/common\/(screen|request|ui|upload|experience|routes)\.js|\.\/stays-media\.js|\.\/stays-art\.js|\.\/stay-comments\.js|\.\/stay-video-player\.vue)$/.test(x[1]), x[1])
  const css = diary.styles.map(s => s.content).join('\n').replace(/\/\*[\s\S]*?\*\//g, '')
  assert.ok(!/[>+~]\s*:(?!:)[a-z-]/i.test(css), '微信 WXSS 不认 > :first-child')
  compiles(diary, 'diary.vue')
})

// ---------------------------------------------------------------- 视频上传 helper

test('视频上传 helper：员工端 / 写评价两份内容相同，各在自己的分包；常量和服务端一致', () => {
  const a = read('pages/staff/stay-video.js').split('\n').slice(3).join('\n')
  const b = read('pages/profile/review-video.js').split('\n').slice(3).join('\n')
  assert.equal(a, b, '除了开头说明，两份完全一样')
  assert.equal(sv.VIDEO_MAX_MB, 50)
  assert.equal(sv.VIDEO_MAX_SECONDS, 60)
  assert.equal(sv.PART_BYTES, 8 * 1024 * 1024)
  const java = fs.readFileSync(path.join(APP, '../RuoYi-Vue/ruoyi-kangaroo/src/main/java/com/ruoyi/kangaroo/ext/core/KgVideoUploads.java'), 'utf8')
  assert.match(java, /MAX_BYTES = 50L \* 1024 \* 1024;/)
  assert.match(java, /MAX_SECONDS = 60;/)
  assert.match(java, /PART_BYTES = 8 \* 1024 \* 1024;/)
  // 小程序直接用 wx.request 发原始字节；ArrayBuffer 用类型标签判断
  const src = read('pages/staff/stay-video.js')
  assert.match(src, /send = \(o\) => wx\.request\(o\)/)
  assert.match(src, /Object\.prototype\.toString\.call\(data\) === '\[object ArrayBuffer\]'/)
  assert.match(src, /maxDuration: VIDEO_MAX_SECONDS/)
  assert.equal(sv.isBinary(new ArrayBuffer(2)), true)
  assert.equal(sv.isBinary({ byteLength: 2 }), false)
  // 不往主包加文件：common/ 下没有视频上传
  assert.ok(!fs.existsSync(path.join(APP, 'common/stay-video.js')) && !fs.existsSync(path.join(APP, 'common/review-video.js')))
})

test('视频上传 helper：选完先查（格式 / 大小 / 时长），分段按顺序传，失败告诉服务端放弃', async () => {
  assert.equal(sv.videoProblem({ path: 'wxfile://tmp_a.mp4', size: 1000, duration: 59.9 }), '')
  assert.equal(sv.videoProblem({ path: 'http://tmp/IMG.MOV', size: 1000, duration: 60.4 }), '', '四舍五入的余量')
  assert.match(sv.videoProblem({ path: 'a.avi', size: 10, duration: 1 }), /mp4 \/ mov/)
  assert.match(sv.videoProblem({ path: 'a.mp4', size: 51 * 1024 * 1024, duration: 1 }), /50MB/)
  assert.match(sv.videoProblem({ path: 'a.mp4', size: 10, duration: 75 }), /60 秒/)
  assert.match(sv.videoProblem({ path: 'a.mp4', size: 0, duration: 1 }), /空的/)
  assert.match(sv.videoProblem(null), /没有选到/)
  // 小院介绍视频（3分钟看小院）：3 分钟、100MB 以内
  assert.equal(sv.videoProblem({ path: 'a.mp4', size: 99 * 1024 * 1024, duration: 175 }, true), '')
  assert.match(sv.videoProblem({ path: 'a.mp4', size: 10, duration: 185 }, true), /3 分钟/)
  assert.match(sv.videoProblem({ path: 'a.mp4', size: 101 * 1024 * 1024, duration: 10 }, true), /100MB/)
  assert.match(sv.videoProblem({ path: 'blob:x', name: 'clip.mp4', size: 10, duration: 1 }), /^$/, '网页版看 File 的名字')
  const size = sv.PART_BYTES + 5
  const calls = []
  const call = async (method, url, data) => {
    calls.push([method, url, data instanceof ArrayBuffer ? 'bytes:' + data.byteLength : data])
    if (url === '/app/upload/video/parts') return { uploadId: 'u1', partBytes: sv.PART_BYTES, parts: 2 }
    if (url.endsWith('/finish')) return { url: V, size }
    return { received: 1 }
  }
  const read = async (f, start, len) => new ArrayBuffer(len)
  const progress = []
  const saved = await sv.uploadVideoParts({ path: 'wxfile://tmp_a.mp4', size, duration: 12 }, (p) => progress.push(p), call, read)
  assert.deepEqual(saved, { url: V, size })
  assert.deepEqual(calls, [['POST', '/app/upload/video/parts', { name: 'wxfile://tmp_a.mp4', size, duration: 12 }],
    ['POST', '/app/upload/video/parts/u1/0', 'bytes:' + sv.PART_BYTES], ['POST', '/app/upload/video/parts/u1/1', 'bytes:5'], ['POST', '/app/upload/video/parts/u1/finish', {}]])
  assert.deepEqual(progress, [50, 99, 100])
  // 第二段业务上被拒（不是网络问题）：不重试，告诉服务端放弃
  const calls2 = []
  const failing = async (method, url, data) => {
    calls2.push(method + ' ' + url)
    if (url === '/app/upload/video/parts') return { uploadId: 'u2', partBytes: sv.PART_BYTES, parts: 2 }
    if (url.endsWith('/1')) { const e = new Error('这个文件不是能播放的 mp4 / mov 视频'); e.retry = false; throw e }
    return {}
  }
  await assert.rejects(sv.uploadVideoParts({ path: 'a.mp4', size, duration: 3 }, null, failing, read), /不是能播放的/)
  await flush()
  assert.deepEqual(calls2, ['POST /app/upload/video/parts', 'POST /app/upload/video/parts/u2/0', 'POST /app/upload/video/parts/u2/1', 'DELETE /app/upload/video/parts/u2'])
  // 网络抖动（retry）同一段最多再试 2 次
  let tries = 0
  const flaky = async (method, url) => {
    if (url === '/app/upload/video/parts') return { uploadId: 'u3', partBytes: sv.PART_BYTES, parts: 1 }
    if (url.endsWith('/0') && ++tries < 3) { const e = new Error('网络连接失败'); e.retry = true; throw e }
    if (url.endsWith('/finish')) return { url: V }
    return {}
  }
  assert.deepEqual(await sv.uploadVideoParts({ path: 'a.mp4', size: 10 }, null, flaky, read), { url: V })
  assert.equal(tries, 3)
})

test('视频上传 helper：选 + 查 + 传一条龙；取消不传；超时长不传；缩略图传成封面', async () => {
  let uploaded = 0
  const deps = (v) => ({ pick: async () => v, upload: async () => { uploaded++; return { url: V } }, thumb: async (t) => (t ? IMG : '') })
  assert.equal(await sv.chooseAndUploadVideo(null, deps(null)), null)
  await assert.rejects(sv.chooseAndUploadVideo(null, deps({ path: 'a.mp4', size: 10, duration: 90 })), /60 秒/)
  assert.equal(uploaded, 0, '超时长的根本不上传')
  assert.deepEqual(await sv.chooseAndUploadVideo(null, deps({ path: 'a.mp4', size: 10, duration: 20, thumb: 'wxfile://thumb.jpg' })), { url: V, cover: IMG, duration: 20 })
  assert.deepEqual(await rv.chooseAndUploadVideo(null, deps({ path: 'a.mp4', size: 10, duration: 20, thumb: '' })), { url: V, cover: '', duration: 20 }, '网页版没有缩略图：封面留空')
})

// ---------------------------------------------------------------- 员工端「视频与生活碎片」

test('员工端 rooms.vue：第 5 屏「视频与生活碎片」，从「更多」进；接口路径；上线中也能直接改的说明', () => {
  assert.match(roomsJs, /const s = useScreen\(5, \{/)
  assert.match(roomsJs, /const titles = \['房源管理', '新增 \/ 编辑房源', '资质上传与审核', 'Vlog 上传与审核', '视频与生活碎片'\]/)
  // 2026-11-03：「房型管理」挪到卡片上单独一个按钮（二级页 room-types.vue），「更多」里不再有
  // 2026-11-03 简化：「更多」只剩 4 项（提交审核 / 下架成了卡片按钮，商圈 / 封面进表单，地图选点表单里本来就有）
  assert.match(roomsJs, /const acts = \['视频与生活碎片', '住客群码', '资质上传与审核', '上传 Vlog'\]/)
  assert.match(roomsJs, /\} else if \(a === '视频与生活碎片'\) \{\n\s*return openMedia\(r\.stayId\)/)
  assert.match(roomsT, /<view v-else-if="s === 5" class="k-body media-body">/)
  assert.ok(roomsT.indexOf('v-else-if="s === 5"') < roomsT.indexOf('<view v-else class="fc-form vlog-body">'), '第 4 屏还是最后的 v-else')
  // 2026-11-03 简化生活碎片：「添加照片」「添加视频」两个钮，不再先弹「照片还是视频」
  for (const s of ['小院视频 · 3分钟看小院', '房型视频 · ≤1分钟', '近期生活碎片', '添加照片', '添加视频', '已被平台隐藏', '背景图', '标题', '文案']) assert.ok(roomsT.includes(s), s)
  for (const api of ["'/app/staff/stay/stays/' + id", "+ '/media'", "+ '/intro-video'", "'/app/staff/stay/room-types/' + rt.roomTypeId + '/video'", "+ '/diary-header'", "+ '/diary'",
    "'/app/staff/stay/diary/' + entry.diaryId", "+ '/diary-order'"]) assert.ok(roomsJs.includes(api), api)
  assert.match(roomsJs, /import \{ VIDEO_MAX_SECONDS, VIDEO_MAX_MB, INTRO_MAX_SECONDS, INTRO_MAX_MB, chooseAndUploadVideo, uploadVideoParts, previewVideo as playVideoFull \} from '\.\/stay-video\.js'/)
  assert.match(roomsJs, /所在区县、地图位置、主理人信息、出行参考、配套设施、视频与生活碎片可以直接改/)
  // 新写的第 5 屏里别名都用长名字（老屏的 t / o / d 不动）
  longAliases(roomsT.slice(roomsT.indexOf('v-else-if="s === 5"'), roomsT.indexOf('<view v-else class="fc-form vlog-body">')))
  compiles(rooms, 'rooms.vue')
})

test('员工端 rooms.vue：文案用「/」分几句、最多 3 句；排序是把这一条和相邻的一条换位置', async () => {
  const pick = (name) => {
    const i = roomsJs.indexOf('async function ' + name + '(')
    return roomsJs.slice(i, roomsJs.indexOf('\n}\n', i) + 2)
  }
  const puts = []
  const toasts = []
  const media = { value: { stayId: 9, diary: { intro: '花开有信\n晚风有约' }, entries: [{ diaryId: 1 }, { diaryId: 2 }, { diaryId: 3 }] } }
  let answer = ''
  const env = {
    media, prompt: async (title, o) => { env.shown = o.value; return answer }, toast: (t) => toasts.push(t),
    put: (url, body) => { puts.push([url, body]); return Promise.resolve({ data: null }) }, mediaRun: async (work) => work(),
    mediaApi: (id) => '/app/staff/stay/stays/' + id, sid: () => 9, sheet: async () => env.choice, confirm: async () => true, del: () => {},
    playVideoFull: () => {}, absUrl: (x) => x, mediaThumb: (x) => x, pickDate: async () => null, todayCn: () => '2026-10-17', uni: { previewImage() {} }
  }
  const names = Object.keys(env)
  const intro = new Function(...names, pick('editDiaryIntro') + '\nreturn editDiaryIntro')(...names.map(k => env[k]))
  answer = '花开有信，晚风有约 / 路过的人，都会留下一点故事／这里是小院的真实日常'
  await intro()
  assert.equal(env.shown, '花开有信 / 晚风有约', '已有文案按「/」连起来给员工改')
  assert.deepEqual(puts.pop(), ['/app/staff/stay/stays/9/diary-header', { intro: '花开有信，晚风有约\n路过的人，都会留下一点故事\n这里是小院的真实日常' }])
  answer = '一 / 二 / 三 / 四'
  await intro()
  assert.equal(toasts.pop(), '文案最多 3 句')
  assert.equal(puts.length, 0)
  // 2026-11-03 简化：点一条不再弹 6 项菜单（tapDiary 删掉了），上移 / 下移是卡上的小钮 moveDiary(entry, idx, -1 | 1)
  const i0 = roomsJs.indexOf('function moveDiary(')
  const move = new Function(...names, roomsJs.slice(i0, roomsJs.indexOf('\n}\n', i0) + 2) + '\nreturn moveDiary')(...names.map(k => env[k]))
  await move({ diaryId: 2 }, 1, -1)
  assert.deepEqual(puts.pop(), ['/app/staff/stay/stays/9/diary-order', { ids: [2, 1, 3] }])
  await move({ diaryId: 3 }, 2, 1)
  assert.equal(toasts.pop(), '已经在最后面了')
  assert.doesNotMatch(roomsJs, /async function tapDiary\(|'改一句话', '改拍摄日期'/)
})

// ---------------------------------------------------------------- 写评价 / 员工端评价

test('写评价页：住宿评价能附 1 段视频（60 秒内），提交时带 videos: [{url, cover}]；换订单时清空', () => {
  assert.match(reviewT, /<view v-if="canPhoto" class="pics vids">/)
  assert.ok(reviewT.includes('拍段小院视频'))
  assert.match(reviewT, /<view v-else class="pics__cell pics__add" hover-class="k-press-s" @click="addVideo">/)
  assert.match(reviewJs, /import \{ VIDEO_MAX_SECONDS, chooseAndUploadVideo, uploadVideoParts, previewVideo \} from '\.\/review-video\.js'/)
  assert.match(reviewJs, /if \(canPhoto\.value && reviewVideo\.value\) payload\.videos = \[\{ url: reviewVideo\.value\.url, cover: reviewVideo\.value\.cover \}\]/)
  assert.match(reviewJs, /if \(videoUploading\.value\) return toast\('视频还在上传，请稍等'\)/)
  assert.match(reviewJs, /reviewPics\.value = \[\]\n  reviewVideo\.value = null/)
  assert.ok(reviewJs.indexOf('const reviewVideo = ref(null)') < reviewJs.indexOf('resetQuestions(query.bizType)'))
  compiles(review, 'review.vue')
})

test('员工端评价：列表有视频缩略图（点了播放、不进详情），详情里满宽一格', () => {
  const t = noComments(staffReviews.template.content)
  const js = staffReviews.scriptSetup.content
  assert.match(t, /<view v-if="r\.images \|\| r\.videos" class="review-images"><view v-for="vid in \(r\.videos \|\| \[\]\)" :key="vid\.url" class="review-video" @click\.stop="playReviewVideo\(vid\)">/)
  assert.match(t, /<view v-if="detailVideos\.length" class="detail-videos">/)
  assert.match(js, /import \{ previewVideo \} from '\.\/stay-video\.js'/)
  assert.match(js, /videos: mediaVideos\(r\.videos\)/)
  compiles(staffReviews, 'staff-reviews.vue')
})

test('后台：生活碎片菜单组件存在、ExtCrud 认 media 字段（照片缩略图 / 视频播放）', () => {
  const root = path.join(APP, '..')
  const wrapper = fs.readFileSync(path.join(root, 'RuoYi-Vue3/src/views/kangaroo/ext/staydiary/index.vue'), 'utf8')
  assert.match(wrapper, /<ext-crud entity="staydiary" \/>/)
  assert.match(wrapper, /name="KgExtStayDiary"/)
  const crud = fs.readFileSync(path.join(root, 'RuoYi-Vue3/src/views/kangaroo/ext/ExtCrud.vue'), 'utf8').replace(/\r\n/g, '\n')
  assert.match(crud, /<template v-else-if="f\.type === 'media'">/)
  assert.match(crud, /<video v-if="isVideo\(u\)" :src="imageUrl\(u\)" controls preload="metadata" class="ext-media__video" \/>/)
  assert.match(crud, /function isVideo\(u\) \{\n  return \/\\\.\(mp4\|mov\)\(\\\?\|\$\)\/i\.test\(String\(u \|\| ''\)\)\n\}/)
  const mod = fs.readFileSync(path.join(root, 'RuoYi-Vue/ruoyi-kangaroo/src/main/java/com/ruoyi/kangaroo/ext/stay/KgStayModule.java'), 'utf8')
  assert.match(mod, /new ExtEntity\("staydiary", "生活碎片", "kg_stay_diary", "diary_id", "kangaroo:staydiary"\)/)
  assert.match(mod, /ExtField\.of\("introVideo", "小院视频（3分钟看小院）", "media"\)/)
  assert.match(mod, /ExtField\.of\("videoUrl", "房型视频（≤1分钟）", "media"\)/)
})

test('2026-10-18：上线中的房源在编辑页地图选点只记位置、不改地址文字（地址算核心内容，改了要先下架）', () => {
  assert.match(roomsJs, /const online = stayInfo\.value && stayInfo\.value\.status === 'online' && editingId\.value/)
  assert.match(roomsJs, /addr: online \? form\.addr : \(point\.address \|\| form\.addr\)/)
})
