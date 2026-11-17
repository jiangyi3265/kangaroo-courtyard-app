// 2026-10-31 小院评论（V65，小程序 2026.10.31.2）的回归（node --test，不构建、不发请求；真实界面另在微信模拟器验）。
// 主人原话：「小院住的小伙伴可以参与更新不 这个页面点发布没办法上传东西 他们写评论就行了 评论设置格式文字+图片或视频 然后评论要审核后才能展示 不直接展示」。
import fs from 'node:fs'
import vm from 'node:vm'
import { createRequire } from 'node:module'
import test from 'node:test'
import assert from 'node:assert/strict'
import * as sc from '../pages/stays/stay-comments.js'
import * as sm from '../pages/stays/stays-media.js'

const require = createRequire(import.meta.url), vue = require('vue'), compiler = require('@vue/compiler-sfc')
const read = (rel) => fs.readFileSync(new URL('../' + rel, import.meta.url), 'utf8')
const flush = async () => { for (let i = 0; i < 6; i++) await new Promise((resolve) => setImmediate(resolve)) }
const plain = (v) => JSON.parse(JSON.stringify(v))

// stay-comment-form.js 里的 pickImages 用全局 uni，测试里换掉
async function loadForm(uni) {
  globalThis.uni = uni
  return import('../pages/profile/stay-comment-form.js?t=' + Math.random())
}

function runSfc(rel, sandbox, expose) {
  const sfc = compiler.parse(read(rel)).descriptor
  const js = sfc.scriptSetup.content
  const ast = compiler.babelParse(js, { sourceType: 'module' })
  const body = ast.program.body.filter((n) => n.type !== 'ImportDeclaration').map((n) => js.slice(n.start, n.end)).join('\n')
  const ctx = { console, setTimeout, clearTimeout, ref: vue.ref, computed: vue.computed, ...sandbox }
  vm.createContext(ctx)
  const scope = vue.effectScope()
  scope.run(() => vm.runInContext(body + '\n;globalThis.__x = { ' + expose + ' }', ctx, { filename: rel }))
  return { x: ctx.__x, stop: () => scope.stop() }
}

// ---------------------------------------------------------------- 卡片和页签的小函数

test('页签：通知带 tab=comment 打开评论；岗位入口没有评论；没拿到条数时不写 (0)', () => {
  assert.equal(sc.tabFromQuery({ tab: 'comment' }, 7), 'comment')
  assert.equal(sc.tabFromQuery({}, 7), 'diary')
  assert.equal(sc.tabFromQuery({ tab: 'comment' }, 0), 'diary', '岗位「店里日常」入口')
  assert.equal(sc.commentTabLabel(null), '小伙伴评论')
  assert.equal(sc.commentTabLabel(0), '小伙伴评论 (0)')
  assert.equal(sc.commentTabLabel(12), '小伙伴评论 (12)')
  assert.equal(sc.stayCommentWriteUrl(7), '/pages/profile/stay-comment?stayId=7')
})

test('卡片：三种身份、待审只给本人看的话、驳回带理由、已下架带理由、已通过没有提示；少字段不报错', () => {
  assert.equal(sc.commentNotice({ status: 'pending' }), '审核中，只有你看得到')
  assert.match(sc.commentNotice({ status: 'rejected', auditReason: '内容含广告' }), /^未通过审核：内容含广告。.*删掉重写/)
  assert.match(sc.commentNotice({ status: 'offline', auditReason: '被举报' }), /^已下架：被举报/)
  assert.equal(sc.commentNotice({ status: 'online' }), '')
  const c = sc.commentCard({ commentId: 3, name: '小**', identity: 'guest', identityText: '已核实住客', content: '好', images: ['/a.jpg', '', '/b.jpg'], video: null, status: 'online', isMe: false })
  assert.equal(c.identityText, '已核实住客')
  assert.deepEqual(c.images, ['/a.jpg', '/b.jpg'])
  assert.equal(c.grid, 'two')
  assert.equal(c.video, null)
  assert.equal(c.notice, '')
  assert.equal(sc.commentCard({ identity: '乱写' }).identityText, '未核实', '认不出的身份一律未核实，绝不写成已核实')
  assert.equal(sc.commentCard(null).identity, 'unverified')
  assert.deepEqual(plain(sc.commentCard({ video: { url: '/v.mp4' } }).video), { url: '/v.mp4', cover: '' })
  assert.deepEqual([1, 2, 3, 4, 5, 9].map(sc.picGrid), ['one', 'two', 'three', 'two', 'three', 'three'])
  assert.deepEqual(sc.commentList([{ commentId: 9 }], [{ commentId: 8 }, { commentId: 9 }]).map((x) => x.commentId), [9, 8], '本人没公开的在最上面，同一条不出现两次')
})

// ---------------------------------------------------------------- 生活碎片页

function runDiary({ account = { id: 1 }, comments, diaryFail, commentFail, sheetAt = 0, confirmed = true, modalOk = true } = {}) {
  const calls = [], toasts = [], gone = [], previews = [], modals = [], posts = [], dels = []
  const hooks = {}
  const screen = {}
  let answer = comments || (() => ({ total: 0, hasMore: false, rows: [], mine: [] }))
  const sandbox = {
    ...sm, ...sc,
    onReachBottom: (fn) => { hooks.reach = fn }, onHide: () => {}, onShow: (fn) => { hooks.show = fn },
    useScreen: (max, extra) => { screen.extra = extra; return vue.ref(1) },
    go: (u) => gone.push(u), toast: (t) => toasts.push(t), errText: (e, d) => (e && e.message) || d,
    absUrl: (p) => (/^\/profile\//.test(p || '') ? 'https://api.test' + p : p),
    get: async (url, params) => {
      calls.push({ url, page: params && params.page })
      if (/\/comments$/.test(url)) { if (commentFail) throw new Error(commentFail); return { data: answer(params.page) } }
      if (diaryFail) throw new Error(diaryFail)
      return { data: { header: {}, rows: [{ diaryId: params.page, type: 'image', url: '/profile/upload/a.jpg' }], hasMore: params.page < 2 } }
    },
    post: async (url, body) => { posts.push({ url, body }); return { msg: '举报已提交，平台会在 24 小时内处理' } },
    del: async (url) => { dels.push(url); return { msg: '已删除' } },
    modal: async (title, content) => { modals.push({ title, content }); return { confirm: modalOk } },
    confirm: async () => confirmed, sheet: async () => sheetAt,
    ensureSession: async () => {}, experience: { account }, R: { login: '/pages/auth/login' },
    uni: { previewImage: (o) => previews.push(o) }
  }
  const h = runSfc('pages/stays/diary.vue', sandbox, 'tab, setTab, stayEntry, source, cards, comments, commentTotal, commentTabText, commentLoaded, commentError, commentHasMore, playing, writeComment, previewComment, playComment, removeComment, reportComment, open, loadComments')
  return { ...h, calls, toasts, gone, previews, modals, posts, dels, hooks, screen, setAnswer: (f) => { answer = f } }
}

const onlineCard = (id, extra = {}) => ({ commentId: id, name: '小**', identity: 'guest', identityText: '已核实住客', content: '不错', images: [], video: null, dateText: '2026.10.31', status: 'online', isMe: false, ...extra })

test('一进来同时取日记和评论第 1 页；上滑只加载当前页签；两个页签分开翻页', async () => {
  const p = runDiary({ comments: (page) => ({ total: 21, hasMore: page < 2, rows: [onlineCard(page)], mine: page === 1 ? [onlineCard(99, { status: 'pending', isMe: true })] : [] }) })
  p.screen.extra.onLoad({ stayId: '7' })
  await flush()
  assert.deepEqual(plain(p.calls), [{ url: '/app/stay/7/diary', page: 1 }, { url: '/app/stay/7/comments', page: 1 }])
  assert.equal(p.x.commentTabText.value, '小伙伴评论 (21)')
  assert.equal(p.x.tab.value, 'diary')
  p.calls.length = 0
  p.hooks.reach(); await flush()
  assert.deepEqual(plain(p.calls), [{ url: '/app/stay/7/diary', page: 2 }], '在日记页签上滑只翻日记')
  p.x.setTab('comment')
  p.calls.length = 0
  p.hooks.reach(); await flush()
  assert.deepEqual(plain(p.calls), [{ url: '/app/stay/7/comments', page: 2 }], '在评论页签上滑只翻评论')
  assert.deepEqual(p.x.comments.value.map((c) => c.commentId), [99, 1, 2], '本人待审的在最上面，翻页不把它冲掉')
  p.calls.length = 0
  p.hooks.reach(); await flush()
  assert.deepEqual(p.calls, [], '没有更多了不再请求')
  p.stop()
})

test('通知跳过来（tab=comment）直接在评论页签；评论失败有重新加载，不影响日记', async () => {
  const p = runDiary({ commentFail: '网络连接失败' })
  p.screen.extra.onLoad({ stayId: '7', tab: 'comment' })
  await flush()
  assert.equal(p.x.tab.value, 'comment')
  assert.equal(p.x.commentError.value, '网络连接失败')
  assert.equal(p.x.commentTabText.value, '小伙伴评论', '没拿到条数不写 (0)')
  assert.equal(p.x.cards.value.length, 1, '日记照常')
  p.stop()
})

test('岗位「店里日常」入口：没有页签、不取评论、不能写', async () => {
  const p = runDiary()
  p.screen.extra.onLoad({ jobId: '5', tab: 'comment' })
  await flush()
  assert.equal(p.x.stayEntry.value, false)
  assert.equal(p.x.tab.value, 'diary')
  assert.deepEqual(plain(p.calls), [{ url: '/app/job/5/diary', page: 1 }])
  p.stop()
  const t = compiler.parse(read('pages/stays/diary.vue')).descriptor.template.content
  assert.match(t, /<view v-if="stayEntry" class="dt">/)
  assert.match(t, /<view v-if="stayEntry" class="dw"/)
})

test('onShow：第一次不重复取；写完、登录完回来刷新；看大图回来不动；翻到后面几页切后台回来不缩回第 1 页', async () => {
  const p = runDiary({ comments: (page) => ({ total: 30, hasMore: page < 3, rows: [onlineCard(page)], mine: [] }) })
  p.screen.extra.onLoad({ stayId: '7' })
  await flush()
  p.calls.length = 0
  p.hooks.show(); await flush()
  assert.deepEqual(p.calls, [], '刚进来 onLoad 已经取过')
  p.hooks.show(); await flush()
  assert.deepEqual(plain(p.calls), [{ url: '/app/stay/7/comments', page: 1 }], '回到页面刷新第 1 页')
  p.calls.length = 0
  p.x.previewComment({ images: ['/profile/upload/a.jpg'] }, 0)
  p.hooks.show(); await flush()
  assert.deepEqual(p.calls, [], '看大图回来不重排')
  assert.deepEqual(plain(p.previews[0]), { urls: ['https://api.test/profile/upload/a.jpg'], current: 'https://api.test/profile/upload/a.jpg' })
  p.x.open(p.x.cards.value[0])
  p.hooks.show(); await flush()
  assert.deepEqual(p.calls, [], '看碎片大图回来也不重排')
  p.x.setTab('comment')
  p.hooks.reach(); await flush()
  p.calls.length = 0
  p.hooks.show(); await flush()
  assert.deepEqual(p.calls, [], '翻到第 2 页后切后台回来，列表不缩回去')
  p.x.setTab('diary')
  await p.x.writeComment()
  assert.equal(p.gone.at(-1), '/pages/profile/stay-comment?stayId=7')
  assert.equal(p.x.tab.value, 'comment', '写完回来落在评论页签，看得到自己那条')
  await p.x.writeComment()
  assert.equal(p.gone.filter((u) => /stay-comment/.test(u)).length, 1, '连点两下只开一个写评论页')
  p.hooks.show(); await flush()
  assert.deepEqual(plain(p.calls), [{ url: '/app/stay/7/comments', page: 1 }], '写完回来一定刷新')
  p.stop()
})

test('写评论：游客先问去不去登录，不跳写评论页；登录用户直接进', async () => {
  const guest = runDiary({ account: null })
  guest.screen.extra.onLoad({ stayId: '7' })
  await flush()
  await guest.x.writeComment()
  assert.match(guest.modals[0].content, /写评论要先登录/)
  assert.deepEqual(guest.gone, ['/pages/auth/login'])
  guest.stop()
  const no = runDiary({ account: null, modalOk: false })
  no.screen.extra.onLoad({ stayId: '7' })
  await flush()
  await no.x.writeComment()
  assert.deepEqual(no.gone, [], '点「再看看」留在本页')
  no.stop()
})

test('举报：游客走登录，登录用户选原因后带 reason 提交；删除要确认，删完刷新；取消什么都不发', async () => {
  const guest = runDiary({ account: null })
  guest.screen.extra.onLoad({ stayId: '7' })
  await flush()
  await guest.x.reportComment({ commentId: 3 })
  assert.match(guest.modals[0].content, /举报要先登录/)
  assert.deepEqual(guest.posts, [])
  guest.stop()
  const p = runDiary({ sheetAt: 1 })
  p.screen.extra.onLoad({ stayId: '7' })
  await flush()
  await p.x.reportComment({ commentId: 3 })
  assert.deepEqual(plain(p.posts), [{ url: '/app/stay/comments/3/report', body: { reason: sc.REPORT_REASONS[1] } }])
  assert.equal(p.toasts.at(-1), '举报已提交，平台会在 24 小时内处理')
  p.calls.length = 0
  await p.x.removeComment({ commentId: 3 })
  await flush()
  assert.deepEqual(plain(p.dels), ['/app/stay/comments/3'])
  assert.deepEqual(plain(p.calls), [{ url: '/app/stay/7/comments', page: 1 }])
  p.stop()
  const cancelled = runDiary({ sheetAt: -1, confirmed: false })
  cancelled.screen.extra.onLoad({ stayId: '7' })
  await flush()
  await cancelled.x.reportComment({ commentId: 3 })
  await cancelled.x.removeComment({ commentId: 3 })
  assert.deepEqual(cancelled.posts, [])
  assert.deepEqual(cancelled.dels, [])
  cancelled.stop()
})

test('模板：本人的卡片能删、别人的已公开能举报；身份标签和提示都画出来；视频走全屏播放层；底部导航和发布没动', () => {
  const t = compiler.parse(read('pages/stays/diary.vue')).descriptor.template.content
  assert.match(t, /v-if="cmt\.isMe"[^>]*@click="removeComment\(cmt\)"/)
  assert.match(t, /v-else-if="cmt\.status === 'online'"[^>]*@click="reportComment\(cmt\)"/)
  assert.match(t, /\{\{ cmt\.identityText \}\}/)
  assert.match(t, /\{\{ cmt\.notice \}\}/)
  assert.match(t, /@click="playComment\(cmt\)"/)
  assert.match(t, /<k-tabbar active="home" theme="journal" \/>/)
  assert.match(t, /<text>小院日记<\/text>/)
  for (const x of t.matchAll(/v-for="\(?([^)"]+?)\)? in /g)) for (const alias of x[1].split(',').map((s) => s.trim())) assert.ok(alias.length >= 3, 'v-for 别名太短：' + alias)
})

// ---------------------------------------------------------------- 写评论页

test('校验：文字必填 1–500、图最多 9 张、图和视频二选一、带媒体要勾肖像、上传中不能交', async () => {
  const f = await loadForm({})
  assert.equal(f.TEXT_MAX, 500)
  assert.equal(f.PIC_MAX, 9)
  const ok = { text: '好', pics: [], video: null, portrait: false, uploading: false }
  assert.equal(f.commentProblem(ok), '')
  assert.match(f.commentProblem({ ...ok, text: '   ' }), /先写点/)
  assert.equal(f.commentProblem({ ...ok, text: '字'.repeat(500) }), '')
  assert.match(f.commentProblem({ ...ok, text: '字'.repeat(501) }), /500/)
  assert.match(f.commentProblem({ ...ok, pics: [{ url: 'a' }] }), /肖像/)
  assert.match(f.commentProblem({ ...ok, video: { url: 'v' } }), /肖像/)
  assert.equal(f.commentProblem({ ...ok, pics: [{ url: 'a' }], portrait: true }), '')
  assert.match(f.commentProblem({ ...ok, pics: new Array(10).fill({ url: 'a' }), portrait: true }), /9 张/)
  assert.match(f.commentProblem({ ...ok, pics: [{ url: 'a' }], video: { url: 'v' }, portrait: true }), /只能选一种/)
  assert.match(f.commentProblem({ ...ok, uploading: true }), /还在上传/)
  assert.deepEqual(f.commentPayload({ text: ' 好 ', pics: [], video: null }), { content: '好' }, '纯文字不带媒体字段')
  assert.deepEqual(f.commentPayload({ text: '好', pics: [{ url: '/a.jpg' }], video: null, portrait: true }), { content: '好', images: ['/a.jpg'], portraitConfirmed: true })
  assert.deepEqual(f.commentPayload({ text: '好', pics: [], video: { url: '/v.mp4', cover: '' }, portrait: true }), { content: '好', videos: [{ url: '/v.mp4', cover: '' }], portraitConfirmed: true })
})

test('选图失败有提示，不是点了没反应；取消不提示', async () => {
  const f = await loadForm({ chooseImage: (o) => o.fail({ errMsg: 'chooseImage:fail cancel' }) })
  assert.deepEqual(await f.pickImages(9), [])
  const denied = await loadForm({ chooseImage: (o) => o.fail({ errMsg: 'chooseImage:fail auth deny' }) })
  await assert.rejects(denied.pickImages(9), /没有相册或相机权限/)
  const privacy = await loadForm({ chooseImage: (o) => o.fail({ errMsg: 'chooseImage:fail api scope is not declared in the privacy agreement' }) })
  await assert.rejects(privacy.pickImages(9), /隐私保护指引/)
  const other = await loadForm({ chooseImage: (o) => o.fail({ errMsg: 'chooseImage:fail' }) })
  await assert.rejects(other.pickImages(9), /没能打开相册/)
  let asked = 0
  const fine = await loadForm({ chooseImage: (o) => { asked = o.count; o.success({ tempFilePaths: ['/t.jpg'] }) } })
  assert.deepEqual(await fine.pickImages(30), ['/t.jpg'])
  assert.equal(asked, 9)
})

function runWrite({ account = { id: 1 }, me = { phoneVerified: true, consented: true, identity: 'guest', identityText: '已核实住客', pending: 0, pendingMax: 3 }, meFail, postFail, picks, videoPick } = {}) {
  const gets = [], posts = [], toasts = [], gone = [], backs = [], failed = []
  const hooks = {}, screen = {}
  let pickFails = null
  const form = {}
  const src = read('pages/profile/stay-comment-form.js').replace(/export /g, '')
  vm.runInNewContext(src + '\n;Object.assign(out, { TEXT_MAX, PIC_MAX, commentProblem, commentPayload, pickFailText })', { out: form, uni: {} })
  const gatedImpl = async (fn, opts) => {
    try { return await fn() } catch (e) {
      if (e && e.code === 428) { opts.onPhone(); throw Object.assign(new Error(''), { silent: true }) }
      throw e
    }
  }
  const sandbox = {
    ...form,
    pickImages: async () => { if (pickFails) throw new Error(pickFails); return picks || ['/tmp/1.jpg'] },
    onShow: (fn) => { hooks.show = fn },
    useScreen: (max, extra) => { screen.extra = extra; return vue.ref(1) },
    go: (u) => gone.push(u), back: () => backs.push(1), toast: (t) => toasts.push(t), errText: (e, d) => (e && e.message) || d,
    confirm: async () => true, absUrl: (p) => 'https://api.test' + p,
    uploadTo: async (url, p) => ({ data: { url: '/profile/upload/' + p.split('/').pop() } }),
    ensureSession: async () => {}, experience: { account }, R: { login: '/pages/auth/login' },
    gated: gatedImpl, fail: (e, d) => { if (!e || !e.silent) failed.push((e && e.message) || d) }, verifyPhone: async () => ({}),
    VIDEO_MAX_SECONDS: 60, VIDEO_MAX_MB: 50, uploadVideoParts: async () => ({}), previewVideo: () => {},
    chooseAndUploadVideo: videoPick || (async () => ({ url: '/profile/upload/videos/v.mp4', cover: '/profile/upload/c.jpg' })),
    get: async (url) => { gets.push(url); if (meFail) throw meFail; return { data: me } },
    post: async (url, body) => { posts.push({ url, body }); if (postFail) throw postFail; return { msg: '已提交，审核通过后展示' } },
    setTimeout: (fn) => { fn(); return 0 },
    uni: { showLoading() {}, hideLoading() {}, previewImage() {} }
  }
  const h = runSfc('pages/profile/stay-comment.vue', sandbox, 'stage, loadError, me, tooManyPending, text, editing, pics, video, portrait, submitting, addPics, removePic, addVideo, removeVideo, submit, loadMe, goLogin, onPhone, onBack')
  return { ...h, gets, posts, toasts, gone, backs, failed, hooks, screen, failPick: (m) => { pickFails = m }, setAccount: (a) => { sandbox.experience.account = a } }
}

test('写评论页：没带 stayId 写清楚；游客引导登录，登录回来进表单；没验证手机号先验证', async () => {
  const none = runWrite()
  none.screen.extra.onLoad({})
  await flush()
  assert.equal(none.x.stage.value, 'error')
  assert.equal(none.x.loadError.value, '没有找到这家小院')
  none.stop()

  const guest = runWrite({ account: null })
  guest.screen.extra.onLoad({ stayId: '7' })
  await flush()
  assert.equal(guest.x.stage.value, 'guest')
  assert.deepEqual(guest.gets, [], '游客不请求要登录的接口')
  guest.x.goLogin()
  assert.deepEqual(guest.gone, ['/pages/auth/login'])
  guest.setAccount({ id: 1 })
  guest.hooks.show()
  await flush()
  assert.equal(guest.x.stage.value, 'form')
  guest.stop()

  const unverified = runWrite({ me: { phoneVerified: false, consented: false, identity: 'unverified', identityText: '未核实', pending: 0, pendingMax: 3 } })
  unverified.screen.extra.onLoad({ stayId: '7' })
  await flush()
  assert.equal(unverified.x.stage.value, 'phone')
  unverified.stop()

  const down = runWrite({ meFail: new Error('房源不存在或已下架') })
  down.screen.extra.onLoad({ stayId: '7' })
  await flush()
  assert.equal(down.x.stage.value, 'error')
  assert.equal(down.x.loadError.value, '房源不存在或已下架')
  down.stop()
})

test('提交：纯文字、带图、带视频三种请求；成功提示等审核并退回；选图回来不动表单', async () => {
  const p = runWrite()
  p.screen.extra.onLoad({ stayId: '7' })
  await flush()
  await p.x.submit()
  assert.deepEqual(p.posts, [], '没写字不提交')
  assert.match(p.toasts.at(-1), /先写点/)
  p.x.text.value = '  院子里的猫很亲人  '
  await p.x.addPics()
  assert.deepEqual(plain(p.x.pics.value).map((x) => x.url), ['/profile/upload/1.jpg'])
  p.hooks.show()
  await flush()
  assert.equal(p.x.pics.value.length, 1, '选完照片回来 onShow 不重置')
  await p.x.submit()
  assert.deepEqual(p.posts, [], '带图没勾肖像不提交')
  assert.match(p.toasts.at(-1), /肖像/)
  p.x.portrait.value = true
  await p.x.submit()
  assert.deepEqual(plain(p.posts), [{ url: '/app/stay/7/comments', body: { content: '院子里的猫很亲人', images: ['/profile/upload/1.jpg'], portraitConfirmed: true } }])
  assert.equal(p.toasts.at(-1), '已提交，审核通过后展示')
  assert.equal(p.backs.length, 1)
  assert.equal(p.x.submitting.value, true, '退回去之前一直锁着')
  p.stop()

  const v = runWrite()
  v.screen.extra.onLoad({ stayId: '7' })
  await flush()
  v.x.text.value = '看视频'
  await v.x.addVideo()
  v.x.portrait.value = true
  await v.x.submit()
  assert.deepEqual(plain(v.posts[0].body), { content: '看视频', videos: [{ url: '/profile/upload/videos/v.mp4', cover: '/profile/upload/c.jpg' }], portraitConfirmed: true })
  v.stop()
})

test('失败：选图打不开有提示；视频不合规有提示；手机号失效回到验证且内容不丢；429 显示原因并能重试', async () => {
  const p = runWrite()
  p.screen.extra.onLoad({ stayId: '7' })
  await flush()
  p.failPick('没有相册或相机权限，请点右上角「···」→「设置」打开后再试')
  await p.x.addPics()
  assert.match(p.toasts.at(-1), /没有相册或相机权限/)
  assert.equal(p.x.pics.value.length, 0)
  p.stop()

  const tooLong = runWrite({ videoPick: async () => { throw new Error('视频不能超过 60 秒，请剪短后再传') } })
  tooLong.screen.extra.onLoad({ stayId: '7' })
  await flush()
  await tooLong.x.addVideo()
  assert.match(tooLong.toasts.at(-1), /不能超过 60 秒/)
  tooLong.stop()

  const phone = runWrite({ postFail: Object.assign(new Error('请先验证手机号'), { code: 428 }) })
  phone.screen.extra.onLoad({ stayId: '7' })
  await flush()
  phone.x.text.value = '写了很多字'
  await phone.x.submit()
  assert.equal(phone.x.stage.value, 'phone')
  assert.equal(phone.x.text.value, '写了很多字')
  assert.deepEqual(phone.failed, [], '引导验证时不再多弹一句错')
  phone.stop()

  const limit = runWrite({ postFail: Object.assign(new Error('这家小院你已有 3 条评论在审核中'), { code: 429 }) })
  limit.screen.extra.onLoad({ stayId: '7' })
  await flush()
  limit.x.text.value = '再写一条'
  await limit.x.submit()
  assert.deepEqual(limit.failed, ['这家小院你已有 3 条评论在审核中'])
  assert.equal(limit.x.submitting.value, false, '失败后能再点')
  limit.stop()
})

test('写评论页：已有 3 条待审时按钮不能点并写明原因；身份提示来自接口', async () => {
  const p = runWrite({ me: { phoneVerified: true, consented: true, identity: 'unverified', identityText: '未核实', pending: 3, pendingMax: 3 } })
  p.screen.extra.onLoad({ stayId: '7' })
  await flush()
  assert.equal(p.x.tooManyPending.value, true)
  p.stop()
  const t = compiler.parse(read('pages/profile/stay-comment.vue')).descriptor.template.content
  assert.match(t, /:disabled="submitting \|\| tooManyPending"/)
  assert.match(t, /\{\{ me\.identityText \|\| '未核实' \}\}/)
  assert.match(t, /open-type="getPhoneNumber"/)
  // 二选一写在模板上：有视频就没有加照片，有照片就没有加视频
  assert.match(t, /<view v-if="!video && pics\.length < PIC_MAX" class="sc-cell sc-cell--add"/)
  assert.match(t, /<view v-if="!video && !pics\.length" class="sc-cell sc-cell--add"/)
  assert.match(t, /<view v-if="pics\.length \|\| video" class="sc-check"/)
})

// ---------------------------------------------------------------- 分包和版本

test('包的归属：写评论页在 pages/profile 分包、复用同目录 review-video.js；评论没有进 common；版本号 2026.10.31.3', () => {
  const pages = JSON.parse(read('pages.json'))
  const profile = pages.subPackages.find((x) => x.root === 'pages/profile')
  assert.deepEqual(profile.pages.find((x) => x.path === 'stay-comment'), { path: 'stay-comment', style: { navigationStyle: 'custom' } })
  assert.ok(!pages.pages.some((x) => /stay-comment/.test(x.path)), '主包没有这个页面')
  const writeJs = compiler.parse(read('pages/profile/stay-comment.vue')).descriptor.scriptSetup.content
  assert.match(writeJs, /from '\.\/review-video\.js'/)
  const diaryJs = compiler.parse(read('pages/stays/diary.vue')).descriptor.scriptSetup.content
  assert.ok(!/profile\/|review-video/.test(diaryJs.replace(/\/\/.*$/gm, '')), '两个分包不互相 import，否则模块会被挪进主包')
  for (const f of ['common/api.js', 'common/routes.js', 'common/upload.js', 'components/k-tabbar/k-tabbar.vue']) assert.ok(!/stay-comment|stay\/comments/.test(read(f)), f)
  assert.match(read('common/config.js'), /export const APP_VERSION = '\d{4}\.\d{2}\.\d{2}\.\d+'/)
  assert.equal(sm.DIARY_SUB, '主理人更新小院日常', '详情页入口文字保留')
})
