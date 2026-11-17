// 内测反馈 2.0（10-16）岗位照片与岗位详情的回归（node --test，不需要构建、不发请求）。跑的是页面真实的 script setup，接口一律换成假函数：
//   · 岗位详情：顶部照片图集（门店传的最多 9 张，没有就用封面一张）；四个步骤条页签合成「岗位信息」「评价」两个普通页签，整页左右滑也能切
//     （横向超过 70px、且大于竖向的 1.8 倍才切，屏幕左边缘 40px 内起手、在照片上滑都不切）；岗位信息里同一项只出现一次；
//     在这家店做过、还没评过的人（详情接口给 myReviewableAppId）评价页签顶上有「我在这家店做过，写评价」；线上任务只有一页；
//   · 门店发布岗位：「岗位照片」最多 9 张，用现成的 /app/upload/image 传，提交时带 images；点照片可以设为封面、往前挪、删掉；
//   · 已发岗位：卡片菜单「换岗位照片」（和「补填筛选条件」挨着），弹层整组换，PUT /app/staff/jobs/{id}/images；
//   · 补填筛选条件的提示：只有休息排班、住宿条件没填会让岗位被筛漏，性别、在店选「不限」的按什么条件筛都看得到；
//   · 岗位列表卡片用第一张照片；后台岗位表单用图片上传组件（最多 9 张）。
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'
import test from 'node:test'
import assert from 'node:assert/strict'
import * as genderPlan from '../common/job-gender.js'

const APP = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const require = createRequire(path.join(APP, 'package.json'))
const compiler = require('@vue/compiler-sfc'), vue = require('vue')
const src = (rel) => fs.readFileSync(path.join(APP, rel), 'utf8').replace(/\r\n/g, '\n')
const flush = () => new Promise(resolve => setImmediate(resolve))
const plain = (v) => JSON.parse(JSON.stringify(v))

/** 按平台处理 // #ifdef / #ifndef / #endif（uni-app 条件编译），只认这里用到的单个平台名 */
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

/** 在沙箱里跑页面的 script setup：导入一律先给永远不返回的函数，再用 stubs 覆盖用得到的那几个 */
function runSetup(rel, stubs, platform = 'MP-WEIXIN') {
  const d = compiler.parse(src(rel), { filename: rel }).descriptor
  const source = preprocess(d.scriptSetup.content, platform)
  const ast = compiler.babelParse(source, { sourceType: 'module' })
  const body = ast.program.body.filter(n => n.type !== 'ImportDeclaration').map(n => source.slice(n.start, n.end)).join('\n')
  const sandbox = { console }
  for (const n of ast.program.body.filter(n => n.type === 'ImportDeclaration')) for (const s of n.specifiers) sandbox[s.local.name] = () => new Promise(() => {})
  // Use synchronous production validation rather than the generic pending API stub.
  Object.assign(sandbox, genderPlan, { ensureSession: async () => {}, getSessionRevision: () => 0 })
  Object.assign(sandbox, {
    ref: vue.ref, computed: vue.computed, watch: vue.watch, reactive: vue.reactive,
    onShow() {}, onHide() {}, onUnload() {}, onUnmounted() {}
  }, stubs)
  vm.createContext(sandbox)
  const scope = vue.effectScope()
  scope.run(() => vm.runInContext(body, sandbox, { filename: rel + ':script-setup' }))
  return { run: code => vm.runInContext(code, sandbox), stop: () => scope.stop(), sandbox, template: d.template.content }
}

// ---------------------------------------------------------------- 岗位详情

const A = '/profile/upload/2026/10/16/a1.jpg'
const B = '/profile/upload/2026/10/16/b2.jpg'

function detailHarness({ screen = 1, account = { id: 1, userId: 1 } } = {}) {
  const log = { nav: [], previews: [], scrolls: [], shows: [], loads: 0 }
  // 详情接口回什么（用例里改 h.data.detail）
  const data = { detail: { jobId: 7, jobType: 'volunteer', title: '海边青旅前台', status: 'published', cover: A, images: [A, B], store: { storeId: 102 } } }
  let onLoad = null
  const s = vue.ref(screen)
  const h = runSetup('pages/jobs/detail.vue', {
    useScreen: (n, opts) => { onLoad = opts && opts.onLoad; return s },
    experience: vue.reactive({ account }),
    absUrl: x => (/^\/profile\//.test(String(x || '')) ? 'https://api.test' + x : x),
    go: (u) => log.nav.push(u),
    onShow: (fn) => log.shows.push(fn),
    R: { review: '/pages/profile/review', jobApply: '/pages/jobs/apply', jobTeam: '/pages/jobs/team', myFollows: '/x', notice: '/n', login: '/l' },
    apiJobDetail: async () => { log.loads++; return { data: plain(data.detail) } },
    apiStoreReviews: async () => ({ data: { jobReviewCount: 3, jobDims: [], list: [] } }),
    uni: { previewImage: (o) => log.previews.push(o), pageScrollTo: (o) => log.scrolls.push(o) }
  })
  return { ...h, s, log, data, open: async (q) => { onLoad && onLoad(q || { jobId: '7' }); await flush(); await flush() } }
}

test('岗位详情：2026-10-18 起不再有「岗位信息 / 评价」页签（评价在页面里「用户反馈」那一块），也不再整页左右滑；旧链接 s=2 / 3 / 4 都打开这一页', async (t) => {
  const h = detailHarness()
  t.after(h.stop)
  await h.open()
  const tpl = h.template.replace(/<!--[\s\S]*?-->/g, '')
  assert.doesNotMatch(tpl, /k-tabs|detail-tab|switchTab|五维评分<|评价摘要|工作与权益|职位概览/)
  assert.match(tpl, /<k-topbar\b[^>]*:title="isOnline \? '线上任务详情' : '岗位详情'"[^>]*\bback custom-back @back="back" \/>/)
  assert.match(tpl, /<view class="overview k-pad-bottom">/)
  // 不再拦整页的左右滑（之前用来切页签）：最外层不绑 touch，照片区也不用再做标记
  assert.match(tpl, /<view class="k-page detail-page"[^>]*>/)
  assert.doesNotMatch(tpl, /onTouchStart|onTouchEnd|markHeroTouch/)
  assert.doesNotMatch(src('pages/jobs/detail.vue'), /swipeTarget|const tabs = /)
  // 旧链接（之前的评价页签 s=3 / 4、工作与权益 s=2）：都打开这一页
  for (const old of [1, 2, 3, 4]) {
    const o = detailHarness({ screen: old })
    t.after(o.stop)
    await o.open()
    assert.equal(o.s.value, 1, 's=' + old)
  }
  // 线上任务：一样一页
  const online = detailHarness({ screen: 2 })
  t.after(online.stop)
  online.data.detail = { jobId: 8, jobType: 'online', title: '剪辑任务', status: 'published', images: [], cover: '' }
  await online.open()
  assert.equal(online.s.value, 1)
})

test('顶部照片：门店传的几张都能左右滑、点开看大图，右下角写第几张；没传照片就是封面一张', async (t) => {
  const h = detailHarness()
  t.after(h.stop)
  await h.open()
  assert.deepEqual(plain(h.run('gallery.value')), ['https://api.test' + A, 'https://api.test' + B])
  assert.match(h.template, /<swiper-item v-for="\(img, i\) in gallery" :key="img \+ i"><image class="hero__img" :src="img" mode="aspectFill" @click="previewHero\(i\)" \/><\/swiper-item>/)
  // 只有一张（门店封面兜底）时不显示「1/1」
  assert.match(h.template, /<text v-if="gallery\.length > 1" class="hero__count">\{\{ heroIndex \+ 1 \}\}\/\{\{ gallery\.length \}\}<\/text>/)
  assert.match(h.template, /<view v-if="assured" class="hero__badge"><job-badge size="hero" \/><\/view>/)
  h.run('onHeroChange({ detail: { current: 1 } })')
  assert.equal(h.run('heroIndex.value'), 1)
  h.run('previewHero(1)')
  assert.deepEqual(plain(h.log.previews[0]), { urls: ['https://api.test' + A, 'https://api.test' + B], current: 'https://api.test' + B })
  // 没传照片：服务端的 cover（岗位封面 / 门店封面）一张；连封面都没有用占位图，点了不打开大图
  h.run(`detail.value = { jobType: 'volunteer', title: 't', images: [], cover: '${A}' }`)
  assert.deepEqual(plain(h.run('gallery.value')), ['https://api.test' + A])
  h.run(`detail.value = { jobType: 'volunteer', title: 't' }`)
  assert.deepEqual(plain(h.run('gallery.value')), ['/static/media/cover-empty.png'])
  h.run('previewHero(0)')
  assert.equal(h.log.previews.length, 1)
})

test('岗位信息：之前两页各写一遍的合成一张，同一项只出现一次；奖金 / 提成 / 结算放「奖金与结算」；食宿先用门店写的说明；没有「生活用品」', async (t) => {
  const h = detailHarness()
  t.after(h.stop)
  await h.open()
  h.run(`detail.value = ${JSON.stringify({ jobType: 'parttime', title: '咖啡馆兼职', address: '东湖山庄', city: '平潭', compensationText: '150 元/天 + 奖金', salaryText: '150 元/天',
    settleDesc: '月结 · 次月5日前发放', bonusDesc: '满勤奖 300', commissionDesc: '', startDate: '2026-11-01', minDays: 30, dailyHours: '每天 6 小时', restModeLabel: '做五休二',
    boardType: 'all', boardText: '包吃包住', boardDesc: '提供食宿（双人间宿舍）', roomTypeLabel: '双人间', tags: ['咖啡'] })}`)
  const rows = plain(h.run('overviewRows.value'))
  const labels = rows.map(r => r.label)
  assert.deepEqual(labels, ['工作地点', '工作类型', '薪资待遇', '开始日期', '最短时长', '工作时长', '排班方式', '食宿安排', '住宿条件'])
  assert.equal(new Set(labels).size, labels.length, '没有重复的行')
  assert.equal(rows.find(r => r.label === '食宿安排').value, '提供食宿（双人间宿舍）', '先用门店写的说明')
  assert.deepEqual(plain(h.run('payRows.value')).map(r => [r.label, r.value]), [['奖金规则', '满勤奖 300'], ['结算方式', '月结 · 次月5日前发放']])
  // 没写说明时用食宿类型
  h.run(`detail.value = { jobType: 'volunteer', title: 't', boardType: 'all', boardText: '包吃包住' }`)
  assert.equal(plain(h.run('overviewRows.value')).find(r => r.label === '食宿安排').value, '包吃包住')
  assert.deepEqual(plain(h.run('payRows.value')), [])
  // 模板：工作内容、希望你、奖金与结算、门店卡片都在岗位信息这一页；没有「生活用品」「其他说明」
  const tpl = h.template
  const page1 = tpl.slice(tpl.indexOf('<view class="overview k-pad-bottom">'), tpl.indexOf('<k-bottom>'))
  for (const x of ['具体工作内容', '我们希望你', '奖金与结算', 'store-card']) assert.ok(page1.includes(x), x)
  assert.doesNotMatch(src('pages/jobs/detail.vue'), /label: '生活用品'|label: '其他说明'|infoGroups/)
  // 线上任务：报酬、奖金都在关键信息里，不再单独一张
  h.run(`detail.value = { jobType: 'online', title: 't', bonusDesc: '好评加 20', compensationText: '80 元/单' }`)
  assert.deepEqual(plain(h.run('payRows.value')), [])
  assert.ok(plain(h.run('overviewRows.value')).some(r => r.label === '奖金规则'))
})

test('用户反馈：在这家店做过、还没评过的人有「我在这家店做过，写评价」，点了去写这条报名的评价；写完回来重新取详情', async (t) => {
  const h = detailHarness({ screen: 3 })
  t.after(h.stop)
  h.data.detail = { ...h.data.detail, myReviewableAppId: 5531 }
  await h.open()
  assert.equal(h.s.value, 1)
  assert.equal(h.run('reviewAppId.value'), 5531)
  // 2026-10-18：按钮在页面里「用户反馈」那一块（原来在评价页签顶上）；没有评价、但能写评价时这一块也出
  assert.match(h.template, /<view v-if="isVolunteer \|\| digest\.count \|\| reviewAppId" class="sp-card sp-fbk"[^>]*@click\.stop="openStoreReviews">/)
  assert.match(h.template, /<view v-if="reviewAppId" class="sp-fbk__write" hover-class="k-press-s" @click\.stop="writeReview"><k-icon name="square-pen" :size="16" color="red" \/><text>我在这家店做过，写评价<\/text>/)
  h.run('writeReview()')
  assert.deepEqual(h.log.nav, ['/pages/profile/review?bizType=application&bizId=5531'])
  // 写完回来：重新取详情（按钮收起、评价带上刚写的）
  const before = h.log.loads
  h.data.detail = { ...h.data.detail, myReviewableAppId: null }
  h.log.shows.forEach(fn => fn())
  await flush(); await flush()
  assert.equal(h.log.loads, before + 1)
  assert.equal(h.run('reviewAppId.value'), '')
  // 从收藏等页面返回也刷新详情，保证星标和剩余名额与服务端同步。
  h.log.shows.forEach(fn => fn())
  await flush()
  assert.equal(h.log.loads, before + 2)
  // 没做过 / 游客 / 线上任务：没有按钮
  h.run(`detail.value = { jobType: 'online', title: 't', myReviewableAppId: 9 }`)
  assert.equal(h.run('reviewAppId.value'), '')
  // 没有评价时如实写
  assert.match(h.template, /还没有做过这类岗位的伙伴写评价，你可以第一个来说说/)
})

// ---------------------------------------------------------------- 门店：发布带照片、换照片

const ROWS = [
  { jobId: 15057, jobType: 'volunteer', status: 'published', statusLabel: '招聘中', title: '古城咖啡馆帮手', boardType: 'all', housing: true,
    genderPref: '', restMode: '', roomType: '', minDays: null, conditionsMissing: true, images: [A, B], img: A },
  { jobId: 15058, jobType: 'parttime', status: 'draft', statusLabel: '待平台审核', title: '咖啡馆兼职', boardType: 'none', housing: false,
    genderPref: '', restMode: '5-2', roomType: '', minDays: null, conditionsMissing: false, images: [], img: '/static/media/rooms-cover-2.jpg' },
  { jobId: 15060, jobType: 'online', status: 'published', statusLabel: '招聘中', title: '剪辑任务', housing: false, images: [] },
  { jobId: 15061, jobType: 'fulltime', status: 'closed', statusLabel: '已关闭', title: '已关闭的全职', housing: false, images: [] }
]

function staffHarness(platform = 'MP-WEIXIN', { putFail = null, uploadFail = () => false, edit = true } = {}) {
  const log = { sheets: [], toasts: [], puts: [], created: [], uploads: [], loads: 0, confirms: [], previews: [], loading: 0 }
  const ctl = { sheetPick: -1, chosen: [], confirmValue: true }
  const document = { body: { style: { overflow: '' } } }
  let onLoad = null
  let n = 0
  const s = vue.ref(1)
  const h = runSetup('pages/staff/jobs.vue', {
    useScreen: (max, opts) => { onLoad = opts && opts.onLoad; return s },
    onShareAppMessage() {},
    ensureSession: async () => {}, hasStaffAccess: { value: true }, currentStaffStoreId: () => 107, staffCan: () => edit, absUrl: x => 'https://api.test' + x,
    todayCn: () => '2026-10-16', shiftDate: () => '2026-10-23', isYmd: () => true, validateSalaryForm: () => '', salaryPayload: () => ({}),
    jobBenefits: (f) => ({ boardEnabled: typeof f.boardEnabled === 'boolean' ? f.boardEnabled : f.pay === 'board', salaryEnabled: false }),
    errText: (e, d) => (e && e.message) || d,
    toast: (m) => log.toasts.push(m),
    go() {}, back() {},
    sheet: async (opts) => { log.sheets.push([...opts]); return typeof ctl.sheetPick === 'function' ? ctl.sheetPick(opts) : ctl.sheetPick },
    confirm: async (title, msg) => { log.confirms.push([title, msg]); return ctl.confirmValue },
    apiStaffJobs: async () => { log.loads++; return { data: { rows: plain(ROWS), canEdit: true, storeCert: false, storeAddress: '古城南路 1 号', conditionsMissingCount: 1, conditionsMissingJob: null } } },
    apiStaffShareStats: async () => ({ data: {} }),
    apiStaffCreateJob: async (storeId, payload) => { log.created.push(plain(payload)); return { msg: '已提交平台审核' } },
    chooseImages: async (count) => { log.chosenCount = count; return ctl.chosen.slice(0, count) },
    uploadTo: async (url, p) => {
      log.uploads.push([url, p])
      if (uploadFail(p)) throw new Error('图片不能超过 5MB')
      return { data: { url: '/profile/upload/2026/10/16/u' + (++n) + '.jpg' } }
    },
    put: async (url, data) => {
      log.puts.push([url, plain(data)])
      if (putFail) throw putFail
      return { msg: '照片已更新', data: { jobId: Number(url.split('/')[4]), images: data.images, cover: data.images[0] || '/profile/upload/store.jpg' } }
    },
    uni: { showLoading: () => { log.loading++ }, hideLoading: () => { log.loading-- }, previewImage: (o) => log.previews.push(o) },
    document
  }, platform)
  return { ...h, s, log, ctl, document, load: async () => { onLoad && onLoad({}); await flush(); await flush() } }
}
const jobRow = (h, id) => JSON.parse(h.run('JSON.stringify(jobList.value.find(r => r.jobId === ' + id + '))'))

test('发布页：「岗位照片」最多 9 张，用现成的上传接口逐张传，提交时带 images（第一张做封面）；线上任务不显示', async (t) => {
  const h = staffHarness()
  t.after(h.stop)
  await h.load()
  assert.deepEqual(plain(h.run('newForm().images')), [])
  h.ctl.chosen = ['wxfile://1', 'wxfile://2', 'wxfile://3']
  await h.run('addPhotos(form.value.images)')
  assert.deepEqual(plain(h.run('form.value.images')), ['/profile/upload/2026/10/16/u1.jpg', '/profile/upload/2026/10/16/u2.jpg', '/profile/upload/2026/10/16/u3.jpg'])
  assert.ok(h.log.uploads.every(u => u[0] === '/app/upload/image'))
  assert.equal(h.log.chosenCount, 9)
  assert.equal(h.log.loading, 0, '传完收起「上传中」')
  // 再选：只能补到 9 张
  h.ctl.chosen = Array.from({ length: 9 }, (_, i) => 'wxfile://x' + i)
  await h.run('addPhotos(form.value.images)')
  assert.equal(h.log.chosenCount, 6)
  assert.equal(h.run('form.value.images.length'), 9)
  await h.run('addPhotos(form.value.images)')
  assert.equal(h.log.toasts.at(-1), '最多 9 张照片')
  // 点照片：设为封面 / 往前挪一位 / 看大图 / 删掉这张（第一张没有前两项）
  h.ctl.sheetPick = (opts) => opts.indexOf('设为封面')
  await h.run('photoActions(form.value.images, 2)')
  assert.equal(h.run('form.value.images[0]'), '/profile/upload/2026/10/16/u3.jpg')
  h.ctl.sheetPick = (opts) => opts.indexOf('往前挪一位')
  await h.run('photoActions(form.value.images, 2)')
  assert.deepEqual(plain(h.run('form.value.images.slice(0, 3)')), ['/profile/upload/2026/10/16/u3.jpg', '/profile/upload/2026/10/16/u2.jpg', '/profile/upload/2026/10/16/u1.jpg'])
  h.ctl.sheetPick = -1
  await h.run('photoActions(form.value.images, 0)')
  assert.deepEqual(h.log.sheets.at(-1), ['看大图', '删掉这张'])
  h.run('removePhoto(form.value.images, 8)')
  assert.equal(h.run('form.value.images.length'), 8)
  // 提交：照片跟着表单一起发
  h.run("gen.value = { title: '海边青旅前台换工', intro: 'a', work: 'b', hope: 'c' }")
  await h.run('submitJob()')
  assert.equal(h.log.created.length, 1)
  assert.equal(h.log.created[0].images.length, 8)
  assert.equal(h.log.created[0].images[0], '/profile/upload/2026/10/16/u3.jpg')
  assert.deepEqual(plain(h.run('form.value.images')), [], '提交后清空')
  // 模板（2026-10-18 商家端改版）：发布表单只给线下岗位（线上任务去线上任务发布页）；格子里的 <text> 不带 hover-class
  assert.match(h.template, /<view class="fc-label"><text class="fc-label__t">岗位照片<\/text><text class="fc-req">必填<\/text><text class="fc-count">\{\{ form\.images\.length \}\}\/\{\{ PHOTO_MAX \}\}<\/text><\/view>\s*<view class="fc-photos"><view v-for="\(url, i\) in form\.images"/)
  assert.match(h.template, /@click="addPhotos\(form\.images\)"/)
})

test('发布页：有几张传失败时，传上的照样留着，提示一句；全部失败说服务端的原因', async (t) => {
  const h = staffHarness('MP-WEIXIN', { uploadFail: (p) => p.endsWith('bad') })
  t.after(h.stop)
  await h.load()
  h.ctl.chosen = ['wxfile://1', 'wxfile://bad', 'wxfile://3']
  await h.run('addPhotos(form.value.images)')
  assert.equal(h.run('form.value.images.length'), 2)
  assert.equal(h.log.toasts.at(-1), '有 1 张没传上，可以再加一次')
  h.ctl.chosen = ['wxfile://bad']
  await h.run('addPhotos(form.value.images)')
  assert.equal(h.log.toasts.at(-1), '图片不能超过 5MB')
  assert.equal(h.log.loading, 0)
  // 取消选图：什么都不做
  h.ctl.chosen = []
  await h.run('addPhotos(form.value.images)')
  assert.equal(h.run('form.value.images.length'), 2)
})

test('已发岗位：卡片菜单「换岗位照片」和「补填筛选条件」挨着；弹层带出当前照片，保存整组 PUT /app/staff/jobs/{id}/images，这一行马上换封面', async (t) => {
  const h = staffHarness()
  t.after(h.stop)
  await h.load()
  // 草稿菜单项少：直接列出来，挨着「补填筛选条件」
  await h.run('jobActions(' + JSON.stringify(jobRow(h, 15058)) + ')')
  assert.deepEqual(h.log.sheets.at(-1), ['修改工作地点', '补填筛选条件', '换岗位照片', '住宿与宠物'])
  // 招聘中的菜单放不下 6 项：收进「改地点 / 筛选条件 / 照片 / 住宿…」
  h.ctl.sheetPick = (opts) => opts.indexOf(opts.includes('换岗位照片') ? '换岗位照片' : '改地点 / 筛选条件 / 照片 / 住宿…')
  await h.run('jobActions(' + JSON.stringify(jobRow(h, 15057)) + ')')
  const main = h.log.sheets.at(-2)
  assert.ok(main.length <= 6, JSON.stringify(main))
  assert.deepEqual(main, ['分享与追踪', '暂停招聘', '改地点 / 筛选条件 / 照片 / 住宿…', '调整名额 / 紧急招募', '查看岗位详情'])
  assert.deepEqual(plain(h.run('photoSheet.value')), { jobId: 15057, title: '古城咖啡馆帮手', draft: [A, B], before: [A, B] })
  // 线上任务、已关闭的没有
  h.ctl.sheetPick = -1
  await h.run('jobActions(' + JSON.stringify(jobRow(h, 15060)) + ')')
  assert.ok(!h.log.sheets.at(-1).includes('换岗位照片') && !h.log.sheets.at(-1).includes('改地点 / 筛选条件 / 照片 / 住宿…'))
  h.run('closePhotos(); openPhotos(' + JSON.stringify(jobRow(h, 15061)) + ')')
  assert.equal(h.run('photoSheet.value'), null)
  assert.equal(h.log.toasts.at(-1), '岗位关闭后无法再换照片')

  // 没改直接保存：收起，不发请求
  h.run('openPhotos(' + JSON.stringify(jobRow(h, 15057)) + ')')
  await h.run('savePhotos()')
  assert.equal(h.log.puts.length, 0)
  assert.equal(h.run('photoSheet.value'), null)
  // 换顺序 + 加一张
  h.run('openPhotos(' + JSON.stringify(jobRow(h, 15057)) + ')')
  h.ctl.sheetPick = (opts) => opts.indexOf('设为封面')
  await h.run('photoActions(photoSheet.value.draft, 1)')
  h.ctl.chosen = ['wxfile://new']
  await h.run('addPhotos(photoSheet.value.draft)')
  const loads = h.log.loads
  await h.run('savePhotos()')
  assert.deepEqual(h.log.puts[0], ['/app/staff/jobs/15057/images', { images: [B, A, '/profile/upload/2026/10/16/u1.jpg'] }])
  assert.equal(jobRow(h, 15057).img, 'https://api.test' + B, '这一行先换上新封面')
  assert.ok(h.log.toasts.includes('照片已更新'))
  assert.equal(h.run('photoSheet.value'), null)
  await flush()
  assert.equal(h.log.loads, loads + 1, '重新拉列表')
})

test('换照片：删光不能保存；上传后的保存失败保留照片；连点不重复提交', async (t) => {
  const h = staffHarness('MP-WEIXIN', { putFail: new Error('岗位照片只能用本平台上传的图片，请重新上传') })
  t.after(h.stop)
  await h.load()
  h.run('openPhotos(' + JSON.stringify(jobRow(h, 15057)) + ')')
  h.run('removePhoto(photoSheet.value.draft, 0); removePhoto(photoSheet.value.draft, 0)')
  h.ctl.confirmValue = false
  await h.run('savePhotos()')
  assert.equal(h.log.toasts.at(-1), '请至少保留 1 张岗位照片')
  assert.equal(h.log.puts.length, 0, '删光不发请求')
  h.run(`photoSheet.value.draft = ['${A}']`)
  h.ctl.confirmValue = true
  const a = h.run('savePhotos()')
  const b = h.run('savePhotos()')
  await Promise.all([a, b])
  assert.equal(h.log.puts.length, 1)
  assert.deepEqual(h.log.puts[0], ['/app/staff/jobs/15057/images', { images: [A] }])
  assert.equal(h.log.toasts.at(-1), '岗位照片只能用本平台上传的图片，请重新上传')
  assert.equal(h.run('photoSheet.value.jobId'), 15057, '失败时弹层留着')
  assert.equal(h.run('photoSaving.value'), false)
})

test('换照片弹层开着锁住页面滚动（小程序 page-meta，H5 锁 body）；切到别的屏收起；接口写在分包页面里', async (t) => {
  const page = src('pages/staff/jobs.vue')
  assert.match(page, /<page-meta :page-style="\(s === 2 && \(startCalendar \|\| sheetKey\)\) \|\| \(s === 1 && \(condSheet \|\| photoSheet \|\| extrasSheet\)\) \? 'overflow: hidden' : ''" \/>/)
  assert.match(page, /<view v-if="photoSheet" class="chip-pop cond-sheet photo-sheet">\n        <view class="chip-pop__mask" @click="closePhotos" @touchmove\.stop\.prevent \/>/)
  assert.match(page, /const apiStaffJobImages = \(jobId, images\) => put\('\/app\/staff\/jobs\/' \+ jobId \+ '\/images', \{ images \}\)/)
  assert.match(page, /import \{ absUrl, chooseImages, uploadTo \} from '@\/common\/upload\.js'/)
  assert.doesNotMatch(src('common/api.js'), /staff\/jobs\/[^\n]*images/)
  assert.doesNotMatch(page, /<text[^>]*hover-class/)
  const h = staffHarness('H5')
  t.after(h.stop)
  await h.load()
  h.run('openPhotos(' + JSON.stringify(jobRow(h, 15057)) + ')')
  await flush()
  assert.equal(h.document.body.style.overflow, 'hidden')
  h.run('closePhotos()')
  await flush()
  assert.equal(h.document.body.style.overflow, '')
  h.run('openPhotos(' + JSON.stringify(jobRow(h, 15057)) + ')')
  await flush()
  h.s.value = 2
  await flush()
  assert.equal(h.run('photoSheet.value'), null)
  assert.equal(h.document.body.style.overflow, '')
})

test('补填筛选条件的提示：只有排班、住宿没填会被筛漏；性别、在店选「不限」的按什么条件筛都看得到', async (t) => {
  const h = staffHarness()
  t.after(h.stop)
  await h.load()
  h.run('openConditions(' + JSON.stringify(jobRow(h, 15057)) + ')')
  assert.equal(h.run('condHint.value'), '休息排班、住宿条件没填的，用户按这一项筛选时看不到这个岗位；性别和在店选「不限」的按什么条件筛都看得到。保存后马上生效，不用重新审核。')
  h.run('openConditions(' + JSON.stringify(jobRow(h, 15058)) + ')')
  assert.equal(h.run('condHint.value'), '休息排班没填的，用户按这一项筛选时看不到这个岗位；在店选「不限」的按什么条件筛都看得到。保存后马上生效，不用重新审核。')
  assert.doesNotMatch(src('pages/staff/jobs.vue'), /没填的项，用户按这一项筛选时看不到这个岗位/)
})

// ---------------------------------------------------------------- 列表卡片、后台

test('岗位列表卡片用第一张照片，没传照片用服务端的封面', () => {
  const list = src('pages/jobs/list.vue')
  assert.match(list, /img: absUrl\(\(Array\.isArray\(j\.images\) && j\.images\[0\]\) \|\| j\.cover\) \|\| '\/static\/media\/cover-empty\.png',/)
})

test('后台岗位表单：岗位照片用图片上传组件（最多 9 张），库里的 JSON 数组和组件的逗号分隔互相转；有照片时封面是第一张', () => {
  const admin = fs.readFileSync(path.join(APP, '..', 'RuoYi-Vue3', 'src', 'views', 'kangaroo', 'job', 'index.vue'), 'utf8').replace(/\r\n/g, '\n')
  assert.match(admin, /<image-upload v-model="form\.imageList"[^>]*:limit="9" :file-size="5"[^>]*\/>/)
  assert.match(admin, /form\.value\.imageList = imagesToText\(form\.value\.images\)/)
  assert.match(admin, /form\.value\.images = JSON\.stringify\(photos\)\n      if \(photos\.length\) form\.value\.cover = photos\[0\]/)
  const fns = /function imagesToText[\s\S]*?\n}\nfunction textToImages[\s\S]*?\n}\n/.exec(admin)[0]
  const { imagesToText, textToImages } = Function(fns + 'return { imagesToText, textToImages }')()
  assert.equal(imagesToText(JSON.stringify([A, B])), A + ',' + B)
  assert.equal(imagesToText(''), '')
  assert.equal(imagesToText('[broken'), '')
  assert.equal(imagesToText(A), A, '老数据逗号分隔也认')
  assert.deepEqual(textToImages(A + ', ' + B + ',' + A), [A, B])
  assert.deepEqual(textToImages(''), [])
})
