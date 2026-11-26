// 岗位详情改版成「门店页」（2026-10-18，主人效果图 41）的回归（node --test，不需要构建、不发请求）：
//   · pages/jobs/store-page.js 的纯函数：角标选哪种（实地探访 + 保险 / 实地探访 / 线上采访 / 不挂）、采访视频卡、各块没数据时不出、
//     保险那一行只有含保险才写、门店资质只有传了营业执照才有、storePage 为 null / 缺字段时不报错；
//   · job-badge 加了 variant，原来的用法（卡片两行、头图一行、筛选小标签）一字不变；
//   · 详情页真实的 script setup（接口换成假函数，store-page.js 用真的）：线下岗位走新布局，线上任务照旧是原来那一套；
//     老服务端没有 storePage 时页面照样能算出各块。
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { createRequire } from 'node:module'
import test from 'node:test'
import assert from 'node:assert/strict'
import { displayWording } from '../common/display-wording.js'

const APP = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const require = createRequire(path.join(APP, 'package.json'))
const compiler = require('@vue/compiler-sfc'), vue = require('vue')
const src = (rel) => fs.readFileSync(path.join(APP, rel), 'utf8').replace(/\r\n/g, '\n')
const SP = await import(pathToFileURL(path.join(APP, 'pages/jobs/store-page.js')).href)
const VP = await import(pathToFileURL(path.join(APP, 'pages/jobs/volunteer-presentation.js')).href)
const PLACE = await import(pathToFileURL(path.join(APP, 'common/place-navigation.js')).href)
const plain = (v) => JSON.parse(JSON.stringify(v))
const flush = () => new Promise(resolve => setImmediate(resolve))

/** 按平台处理 // #ifdef / #ifndef / #endif（uni-app 条件编译） */
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

/** 在沙箱里跑详情页的 script setup：导入一律先给永远不返回的函数，store-page.js 换成真的，再用 stubs 覆盖用得到的接口 */
function runSetup(stubs, platform = 'MP-WEIXIN') {
  const rel = 'pages/jobs/detail.vue'
  const d = compiler.parse(src(rel), { filename: rel }).descriptor
  const source = preprocess(d.scriptSetup.content, platform)
  const ast = compiler.babelParse(source, { sourceType: 'module' })
  const body = ast.program.body.filter(n => n.type !== 'ImportDeclaration').map(n => source.slice(n.start, n.end)).join('\n')
  const sandbox = { console }
  for (const n of ast.program.body.filter(n => n.type === 'ImportDeclaration')) {
    for (const s of n.specifiers) {
      sandbox[s.local.name] = n.source.value === './store-page.js' ? SP[s.imported.name] : n.source.value === './volunteer-presentation.js' ? VP[s.imported.name] : () => new Promise(() => {})
    }
  }
  Object.assign(sandbox, {
    ref: vue.ref, computed: vue.computed, watch: vue.watch, reactive: vue.reactive, displayWording,
    onShow() {}, onHide() {}, onUnload() {}, onUnmounted() {}
  }, stubs)
  vm.createContext(sandbox)
  const scope = vue.effectScope()
  scope.run(() => vm.runInContext(body, sandbox, { filename: rel + ':script-setup' }))
  return { run: code => vm.runInContext(code, sandbox), stop: () => scope.stop(), sandbox, template: d.template.content }
}

const A = '/profile/upload/2026/10/18/a.jpg'
const B = '/profile/upload/2026/10/18/b.jpg'
const VIDEO = '/profile/upload/videos/2026/10/18/0123456789abcdef0123456789abcdef.mp4'

test('食宿描述已经包含房型时不重复展示；不同房型仍保留结构化说明', () => {
  const shared = SP.welfareCard({ jobType: 'volunteer', boardDesc: '吃和店里一起，双人间独卫。', roomTypeLabel: '双人间' }, { board: '吃和店里一起，双人间独卫。' })
  assert.ok(!shared.items.includes('住宿：双人间'))
  const separate = SP.welfareCard({ jobType: 'volunteer', boardDesc: '提供三餐', roomTypeLabel: '双人间' })
  assert.ok(separate.items.includes('住宿：双人间'))
})
const STORE_PAGE = {
  interviewMode: 'onsite',
  interview: { video: VIDEO, cover: '/profile/upload/2026/10/18/c.jpg', seconds: 287, note: '' },
  manager: { name: '阿南', avatar: '/profile/upload/2026/10/18/m.jpg', years: '3年', skills: '直播带岗、小院运营', quote: '工作认真，也给大家留足去海边的时间', rating: 4.8 },
  facilities: [{ code: 'gym', label: '健身房' }, { code: 'pool', label: '游泳池' }, { code: 'ebike', label: '电动车可用' }],
  travel: { rail: '平潭站出站，乘平潭1路公交', airport: '福州长乐机场乘机场大巴', cost: '约37元起' },
  licenseImage: '/profile/upload/2026/10/18/license.jpg',
  dailyImages: [A, B]
}
const VOLUNTEER = {
  jobId: 7, jobType: 'volunteer', title: '南舍庄园', status: 'published', cover: A, images: [A, B],
  address: '福建省平潭县东湖山庄98号', city: '平潭', latitude: 25.5, longitude: 119.8,
  workKindLabel: '直播换工', boardType: 'all', boardText: '包吃包住', boardDesc: '提供食宿', monthRedpacket: true, bonusDesc: '满勤奖 300',
  headcount: 3, hiredCount: 1, startDate: '2026-10-22T00:00:00.000+08:00', minDays: 30, dailyHours: '每日4小时', restModeLabel: '做二休一',
  genderPref: '', requirement: '有责任心\n· 遵守门店管理制度', content: '协助直播运营\n协助门店日常运营',
  insuranceFlag: '0', safeCert: '0', store: { storeId: 102, storeName: '平潭袋鼠小院', safeCert: '0', city: '平潭', rating: 4.7 },
  storePage: STORE_PAGE
}

function harness(platform = 'MP-WEIXIN') {
  const log = { previews: [], toasts: [], opened: [], copied: [], gone: [], mapUrls: [], selectors: [] }
  const data = { detail: plain(VOLUNTEER), reviewArgs: [], reviews: { count: 5, avg: 4.5, filteredTotal: 2, filteredAvg: 4.7, jobReviewCount: 2, jobDims: [{ label: '住宿条件', avg: 5 }, { label: '工作强度', avg: 3 }], list: [{ reviewId: 1, content: '真实小院，店长很照顾新人' }, { reviewId: 2, content: '' }, { reviewId: 3, content: '伙食稳定，同事友好' }, { reviewId: 4, content: '第三条不显示' }] } }
  let onLoad = null
  const showHooks = []
  const s = vue.ref(1)
  const h = runSetup({
    setTimeout, clearTimeout,
    onShow: fn => { showHooks.push(fn) },
    useScreen: (n, opts) => { onLoad = opts && opts.onLoad; return s },
    experience: vue.reactive({ account: { userId: 1 } }),
    getSessionRevision: () => 0, ensureSession: async () => {},
    absUrl: x => (/^\/profile\//.test(String(x || '')) ? 'https://api.test' + x : String(x || '')),
    toast: (m) => log.toasts.push(m),
    go: (u) => log.gone.push(u),
    R: { jobTeam: '/pages/jobs/team', jobReviews: '/pages/jobs/reviews' },
    apiJobDetail: async () => ({ data: plain(data.detail) }),
    get: async (...args) => {
      data.reviewArgs.push(args)
      const r = data.reviews
      return { data: args[0].endsWith('/summary')
        ? { count: r.filteredTotal ?? r.count, avg: r.filteredAvg ?? r.avg, recommendRate: 100 }
        : { rows: plain(r.list || []) } }
    },
    placeMapUrl: PLACE.placeMapUrl, openNativePlace: PLACE.openNativePlace,
    window: { location: { assign: url => log.mapUrls.push(url) } },
    uni: { previewImage: (o) => log.previews.push(o), openLocation: (o) => log.opened.push(o), chooseLocation: o => log.selectors.push(o), setClipboardData: (o) => log.copied.push(o), pageScrollTo() {} }
  }, platform)
  return { ...h, s, log, data,
    show: async () => { showHooks.forEach(fn => fn()); await flush(); await flush() },
    open: async () => { onLoad?.({ jobId: '7' }); showHooks.forEach(fn => fn()); await flush(); await flush() } }
}
const get = (h, expr) => plain(h.run(expr))

test('代招岗位反馈摘要与二级页指向招聘方，延迟返回不能覆盖切换后的门店', async t => {
  const h = harness('H5'); t.after(h.stop)
  h.data.detail.storeId = 9
  h.data.detail.recruitStoreId = 102
  await h.open()
  assert.equal(h.run('digest.value.count'), 2)
  assert.equal(h.run('digest.value.goodRate'), '100%')
  assert(h.data.reviewArgs.every(([url]) => url.startsWith('/app/stores/102/job-reviews')))
  h.run('openStoreReviews()')
  assert.match(h.log.gone.at(-1), /storeId=102&filter=/)

  const pending = []
  h.sandbox.get = (url) => new Promise(resolve => pending.push({ url, resolve }))
  const previous = h.run('loadReviews()')
  h.run('detail.value.store.storeId = 103')
  const current = h.run('loadReviews()')
  for (const item of pending.filter(x => x.url.includes('/103/'))) item.resolve({ data: item.url.endsWith('/summary') ? { count: 1, avg: 4, recommendRate: 100 } : { rows: [{ content: '新招聘方评价', rating: 4 }] } })
  await current
  for (const item of pending.filter(x => x.url.includes('/102/'))) item.resolve({ data: item.url.endsWith('/summary') ? { count: 99, avg: 1 } : { rows: [{ content: '旧门店迟到响应' }] } })
  await previous
  assert.equal(h.run('digest.value.count'), 1)
  assert.deepEqual(get(h, 'digest.value.items.map(x => x.text)'), ['新招聘方评价'])
})

for (const platform of ['H5', 'MP-WEIXIN']) for (const jobType of ['parttime', 'fulltime']) {
  test(`${platform} ${jobType} 参考详情：真实资料更新、名额和培训入口同步，不补造店长头像`, async t => {
    const h = harness(platform); t.after(h.stop)
    h.sandbox.apiJobTrainingBanner = async () => ({ data: { activityId: 123, title: '培训验收', img: A } })
    h.sandbox.R.activity = '/pages/community/activity'
    h.data.detail = { ...plain(VOLUNTEER), jobType, remainingCount: 2, boardDesc: '提供食宿', benefits: ['无押金', '无中介费'],
      storePage: { ...STORE_PAGE, manager: { name: '店长A', avatar: '', rating: null } } }
    await h.open()
    assert.equal(h.run('pt.value'), true)
    let model = get(h, 'parttimeModel.value')
    assert.equal(model.headcount, '2人')
    assert.equal(model.manager.name, '店长A')
    assert.equal(model.manager.avatar, '', '无真实头像时不冒用示例人像')
    assert.equal(model.board, '提供食宿')
    assert.ok(model.welfare.items.includes('无押金'))
    assert.ok(model.welfare.items.includes('无中介费'))
    assert.ok(model.subline.startsWith(jobType === 'parttime' ? '兼职岗位' : '全职岗位'))
    assert.equal(model.recruitmentTitle, jobType === 'parttime' ? '兼职招募要求' : '全职招募要求')
    h.run('openTeam()')
    assert.equal(h.log.gone.at(-1), '/pages/jobs/team?jobId=7')
    if (jobType === 'fulltime') {
      assert.equal(model.training.activityId, 123)
      h.run('openTraining()')
      assert.equal(h.log.gone.at(-1), '/pages/community/activity?id=123')
    } else assert.equal(model.training, null)
    h.data.detail = { ...h.data.detail, status: 'paused', remainingCount: 1, benefits: [],
      storePage: { ...STORE_PAGE, interviewMode: 'online', manager: { name: '店长B' }, facilities: [] } }
    await h.show()
    model = get(h, 'parttimeModel.value')
    assert.equal(model.headcount, '1人')
    assert.equal(model.manager.name, '店长B')
    assert.match(model.interview.title, /线上/)
    assert.deepEqual(model.facilities, [])
    assert.ok(!model.welfare.items.some(x => /押金|中介费/.test(x)), '后台清空福利后返回详情不能残留旧承诺')
    assert.equal(model.status, '已暂停招聘')
    assert.ok(model.blocked)
  })
}

test('收藏用真实接口结果同步星标；保存期间连续点击只发一次，返回详情重读', async t => {
  const h = harness(); t.after(h.stop)
  h.sandbox.ensureSession = async () => {}
  const writes = []; let finish
  h.sandbox.apiToggleFavorite = (id, favorite) => { writes.push([id, favorite]); return new Promise(resolve => { finish = resolve }) }
  await h.open()
  const first = h.run('toggleFavorite()')
  await h.run('toggleFavorite()'); await flush()
  assert.deepEqual(writes, [['7', true]])
  assert.equal(h.run('favoriteBusy.value'), true)
  assert.equal(h.run('favorite.value'), true)
  finish({ data: { favorite: true } }); await first
  assert.equal(h.run('detail.value.favorite'), true)
  assert.equal(h.run('favoriteBusy.value'), false)
  assert.match(h.log.toasts.at(-1), /已收藏/)
  const second = h.run('toggleFavorite()'); await flush()
  assert.deepEqual(writes.at(-1), ['7', false])
  finish({ data: { favorite: false } }); await second
  assert.equal(h.run('detail.value.favorite'), false)
  assert.equal(h.log.toasts.at(-1), '已取消收藏')
  h.data.detail.favorite = true; await h.show()
  assert.equal(h.run('favorite.value'), true, '其他页面改了收藏后，返回时以服务端状态为准')
})

test('保存失败回滚并允许重试，旧详情响应不会覆盖刚保存的收藏', async t => {
  const h = harness(); t.after(h.stop)
  h.sandbox.ensureSession = async () => {}
  await h.open()
  h.sandbox.apiToggleFavorite = async () => { throw new Error('模拟网络错误') }
  await h.run('toggleFavorite()')
  assert.equal(h.run('favorite.value'), false); assert.equal(h.run('favoriteBusy.value'), false)
  assert.equal(h.log.toasts.at(-1), '模拟网络错误')
  let finishLoad
  h.sandbox.apiJobDetail = () => new Promise(resolve => { finishLoad = resolve })
  const pendingLoad = h.run('load({ background: true })')
  h.sandbox.apiToggleFavorite = async () => ({ data: { favorite: true } })
  await h.run('toggleFavorite()')
  finishLoad({ data: { ...h.data.detail, favorite: false } }); await pendingLoad
  assert.equal(h.run('favorite.value'), true)
  assert.equal(h.run('detail.value.favorite'), true)
})

test('游客点星标先提示登录；取消登录不写收藏且不会卡住按钮', async t => {
  const h = harness(); t.after(h.stop)
  h.sandbox.experience.account = null
  h.sandbox.ensureSession = async () => {}
  let prompts = 0, writes = 0
  h.sandbox.modal = async () => { prompts++; return { confirm: false } }
  h.sandbox.apiToggleFavorite = async () => { writes++ }
  await h.open(); await h.run('toggleFavorite()')
  assert.equal(prompts, 1); assert.equal(writes, 0); assert.equal(h.run('favoriteBusy.value'), false)
  assert.equal(h.run('favorite.value'), false)
})

test('后台总名额与剩余名额分开：2→1→0；满员仍保留招募卡并禁用报名，返回时刷新', async t => {
  const h = harness(); t.after(h.stop)
  h.data.detail = { ...h.data.detail, headcount: 2, hiredCount: 0, reservedCount: 0, remainingCount: 2, acceptsApplication: true }
  await h.open()
  for (const remainingCount of [2, 1, 0, 1]) {
    Object.assign(h.data.detail, { remainingCount, reservedCount: 2 - remainingCount })
    await h.show()
    assert.equal(get(h, 'sections.value.stats')[0].v, remainingCount + '人')
    assert.equal(h.run('headcountText.value'), remainingCount ? '还招 ' + remainingCount + ' 人' : '名额已满')
    assert.equal(Boolean(h.run('applyBlockedText.value')), remainingCount === 0)
    assert.equal(h.run('detail.value.headcount'), 2, '后台总名额不被扣减')
  }
})

test('剩余人数兼容旧接口并且不会重复减去已录用人数', () => {
  assert.equal(SP.remainingHeadcount({ jobType: 'volunteer', headcount: 2, hiredCount: 1, reservedCount: 1 }), 1)
  assert.equal(SP.remainingHeadcount({ headcount: 2, hiredCount: 1 }), 1)
  assert.equal(SP.remainingHeadcount({ jobType: 'volunteer', headcount: 2, reservedCount: 4 }), 0)
  assert.equal(SP.remainingHeadcount({ jobType: 'online', headcount: 2, hiredCount: 1, reservedCount: 4 }), 1)
  assert.equal(SP.remainingHeadcount({ headcount: 2, hiredCount: 2, remainingCount: 1 }), 1)
  assert.equal(SP.remainingHeadcount({}), null)
})

test('换宿资料全缺：展示层保留所有卡片，业务资料和保险状态不被占位内容污染', async t => {
  const h = harness(); t.after(h.stop)
  h.data.detail = { jobId: 7, jobType: 'volunteer', title: '待补资料', images: [], insuranceFlag: '1', storePage: null }
  h.data.reviews = { count: 0, list: [] }
  await h.open()
  const ui = get(h, 'sections.value')
  assert.equal(ui.travel.rows.length, 2)
  assert.equal(ui.travel.cost, '待补充')
  assert.equal(ui.stats.length, 3)
  assert.ok(ui.requirements && ui.content.length && ui.work && ui.welfare)
  assert.equal(ui.benefits.length, 2)
  assert.equal(ui.facilities.length, 0)
  assert.ok(ui.facilities.every(x => x.pending))
  assert.equal(ui.manager.name, '')
  assert.equal(ui.manager.ratingText, '')
  assert.equal(h.run('managerAvatar.value'), '')
  assert.equal(ui.assurance.length, 3)
  assert.equal(ui.assurance[0].v, '本岗位不含平台意外险')
  assert.equal(ui.assurance[1].link, '查看营业执照')
  assert.ok(ui.assurance[1].pending)
  h.run("tapAssurance(sections.value.assurance[1])")
  assert.equal(h.log.toasts.at(-1), '门店暂未上传营业执照')
  assert.equal(h.log.previews.length, 0, '保留入口，但不预览空地址或占位图')
  assert.equal(h.run('interview.value'), null)
  assert.equal(h.run('manager.value'), null)
  assert.deepEqual(get(h, 'dailyShown.value'), [''])
  assert.ok(!get(h, 'heroGrid.value').main)
  assert.ok(get(h, 'heroGrid.value').grid.every(cell => !cell.src))
  assert.ok(!h.run('detail.value.storePage'))

  // 后台资料补齐，同一页计算值自动替换，不保留占位文案。
  h.run(`detail.value = ${JSON.stringify(VOLUNTEER)}`)
  const complete = get(h, 'sections.value')
  assert.equal(complete.manager.name, STORE_PAGE.manager.name)
  assert.equal(complete.manager.ratingText, '4.8')
  assert.equal(complete.travel.cost, STORE_PAGE.travel.cost)
  assert.equal(complete.assurance[1].link, '查看营业执照')
  assert.equal(h.run('interview.value.url'), VIDEO)
  h.run('playInterview()')
  assert.equal(h.run('playing.value.url'), VIDEO)
})

test('换宿拼图：随真实照片数量排版，多图余数和预览索引一致', () => {
  const one = VP.volunteerHero([A])
  assert.equal(one.main, A)
  assert.equal(one.grid.length, 0)
  assert.equal(one.more, 0)
  const pair = VP.volunteerHero([A, B])
  assert.deepEqual(pair.grid, [{ src: B, index: 1 }])
  const images = Array.from({ length: 9 }, (_, i) => A + '?' + i)
  const full = VP.volunteerHero(images)
  assert.equal(full.more, 3)
  assert.deepEqual(full.grid.map(cell => cell.index), [1, 2, 3, 4, 5])
  assert.equal(full.grid.at(-1).src, images[5])
  assert.equal(VP.volunteerHero(['/static/media/cover-empty.png']).main, '')
})

test('换宿占位仅用于换宿页面；未知保险不当成已投保，全职仍沿用原数据', async t => {
  const h = harness(); t.after(h.stop)
  h.data.detail = { jobId: 7, jobType: 'volunteer', title: '待补资料' }
  await h.open()
  assert.equal(h.run('sections.value.assurance[0].v'), '保险信息待补充')
  h.run("detail.value = { jobType: 'fulltime', title: '全职岗位' }")
  assert.equal(h.run('sections.value.manager'), null)
  assert.equal(h.run('sections.value.work'), null)
  assert.equal(h.run('sections.value.facilities.length'), 0)
  assert.equal(h.run('heroGrid.value.grid.length'), 0)
})

test('兼职原稿：独立呈现层保留同一批岗位数据、房源媒体与兼职评价', async (t) => {
  const h = harness(); t.after(h.stop)
  h.data.detail = { ...plain(VOLUNTEER), jobType: 'parttime', status: 'paused', acceptsApplication: false, applyClosedReason: '该岗位暂停招聘，暂不接受报名' }
  await h.open()
  assert.equal(h.run('isParttime.value'), true)
  const m = get(h, 'parttimeModel.value')
  assert.equal(m.title, h.data.detail.title)
  assert.equal(m.status, '已暂停招聘')
  assert.equal(m.blocked, h.data.detail.applyClosedReason)
  assert.equal(m.arrival, '2026年10月22日')
  assert.equal(m.minDays, '30天起')
  assert.deepEqual(m.gallery, get(h, 'gallery.value'))
  assert.equal(m.interview.url, VIDEO)
  assert.equal(m.manager.avatar, 'https://api.test' + STORE_PAGE.manager.avatar)
  assert.deepEqual(plain(h.data.reviewArgs), [
    ['/app/stores/102/job-reviews/summary', { filter: '兼职' }],
    ['/app/stores/102/job-reviews', { filter: '兼职', tab: 'all', sort: 'latest', pageNum: 1 }]
  ])
  h.run('openStoreReviews()')
  assert.ok(h.log.gone.at(-1).endsWith('filter=' + encodeURIComponent('兼职')))
  const previous = h.log.gone.length
  await h.run('openApply()')
  assert.equal(h.log.gone.length, previous, '暂停招聘不能继续报名')
  h.run('favorite.value = true; following.value = true')
  assert.equal(h.run('parttimeModel.value.favorite'), true)
  assert.equal(h.run('parttimeModel.value.following'), true)
})

test('兼职缺资料：不把占位图当真实照片，不补造视频、店长、工资或期限', async (t) => {
  const h = harness(); t.after(h.stop)
  h.data.detail = { jobId: 7, jobType: 'parttime', title: '待补资料的岗位', images: [], cover: '', storePage: null }
  await h.open()
  const m = get(h, 'parttimeModel.value')
  assert.deepEqual(m.gallery, [])
  assert.equal(m.title, '待补资料的岗位')
  assert.equal(m.interview, null)
  assert.equal(m.manager, null)
  assert.equal(m.welfare, null)
  assert.equal(m.minDays, '')
  assert.equal(m.map, false)
  assert.deepEqual(m.daily, [])
  assert.deepEqual(m.assurance.map(x => x.key), ['help'])
})

test('兼职缺坐标：H5 按真实地址搜索，微信复制地址后选点，不伪造定位', async (t) => {
  for (const platform of ['H5', 'MP-WEIXIN']) {
    const h = harness(platform); t.after(h.stop)
    h.data.detail = { ...plain(VOLUNTEER), jobType: 'parttime', latitude: null, longitude: null }
    await h.open()
    let modal
    h.sandbox.uni.showModal = value => { modal = value }
    h.run('openMap()')
    assert.equal(h.log.opened.length, 0)
    if (platform === 'H5') {
      const url = new URL(h.log.mapUrls.at(-1))
      assert.equal(url.hostname, 'uri.amap.com')
      assert.equal(url.pathname, '/search')
      assert.equal(url.searchParams.get('keyword'), '福建省平潭县东湖山庄98号')
    } else {
      assert.equal(modal.title, '门店定位待完善')
      modal.success({confirm:true})
      assert.equal(h.log.copied.at(-1).data, '福建省平潭县东湖山庄98号')
      h.log.copied.at(-1).success()
      assert.equal(h.log.selectors.length, 0)
      assert.equal(h.log.opened.length, 0, '没有真实坐标不能用用户当前位置导航')
    }
    h.run("detail.value = { jobType: 'parttime' }")
    h.run('openMap()')
    assert.equal(platform === 'H5' ? h.log.mapUrls.length : h.log.copied.length, 1)
    assert.equal(h.log.toasts.at(-1), '门店位置待补充')
  }
})

test('兼职独立视图不接管换工、全职、线上任务；交互继续连接已有处理函数', async (t) => {
  const h = harness(); t.after(h.stop)
  for (const type of ['volunteer', 'fulltime', 'online']) {
    h.data.detail = { ...plain(VOLUNTEER), jobType: type }
    await h.open()
    assert.equal(h.run('isParttime.value'), false)
  }
  const view = compiler.parse(src('pages/jobs/components/parttime-detail.vue')).descriptor
  const compiled = compiler.compileTemplate({ source: view.template.content, filename: 'parttime-detail.vue', id: 'parttime' })
  assert.deepEqual(compiled.errors, [])
  const branch = h.template.match(/<parttime-detail[\s\S]*?\/>/)[0]
  for (const handler of ['toggleFavorite', 'openMap', 'playInterview', 'previewHero', 'previewDaily', 'openStoreReviews', 'writeReview', 'tapAssurance', 'openStoreJobs', 'toggleFollow']) assert.ok(branch.includes(handler), handler)
})

// ---------------------------------------------------------------- store-page.js

test('后台配置的福利同步到待遇卡，清空后不残留，未配置不添加费用承诺', () => {
  for (const jobType of ['parttime', 'fulltime']) {
    const options = { board: '免费包吃住', insured: true }
    const base = { jobType, compensationText: '日薪120元/天' }
    const configured = SP.welfareCard({ ...base, benefits: ['免费包吃住', '无押金', '无中介费', '无押金', ' ', null, {}] }, options)
    assert.deepEqual(configured.items, ['平台统一购买意外险', '无押金', '无中介费'])
    const legacy = SP.welfareCard({ ...base, benefits: ' 无押金,无中介费，带薪年假\n 无押金 ' }, options)
    assert.deepEqual(legacy.items, ['平台统一购买意外险', '无押金', '无中介费', '带薪年假'])
    assert.deepEqual(SP.welfareCard({ ...base, benefits: [] }, options).items, ['平台统一购买意外险'])
    assert.deepEqual(SP.welfareCard(base, options).items, ['平台统一购买意外险'])
    assert.equal(SP.welfareCard({ jobType, benefits: [] }), null)
  }
})

test('换宿福利两栏保留真实待遇：结算和保险独立，未投保岗位不增加保险承诺', () => {
  const data = { jobType: 'volunteer', bonusDesc: '满勤奖300元', settleDesc: '服务结束当日核对' }
  const insured = SP.welfareCard(data, { board: '全程提供食宿', insured: true })
  const cols = SP.volunteerWelfareColumns(insured)
  assert.equal(cols.length, 2)
  assert.equal(cols[0].title, '全程提供食宿')
  assert.equal(SP.volunteerWelfareColumns(SP.welfareCard(data, { board: '吃和店里一起，双人间独卫。' }), 'all')[0].title, '包吃住')
  assert.equal(SP.volunteerWelfareColumns(SP.welfareCard(data, { board: '仅提供双人间' }), 'room')[0].title, '仅提供双人间')
  assert.deepEqual(cols[0].items, ['奖金：满勤奖300元'])
  assert.deepEqual(cols[1].items, ['结算：服务结束当日核对', '平台统一购买意外险'])
  assert.deepEqual(cols.flatMap(c => c.items).sort(), [...insured.items].sort())
  const uninsured = SP.volunteerWelfareColumns(SP.welfareCard(data, { board: '提供住宿' }))
  assert.equal(uninsured[1].title, '结算说明')
  assert.ok(!JSON.stringify(uninsured).includes('保险'))
  assert.deepEqual(SP.volunteerWelfareColumns(null), [])
  assert.equal(SP.volunteerWelfareColumns(SP.welfareCard({}, { board: '提供住宿' })).length, 1)
  const commission = SP.volunteerWelfareColumns(SP.welfareCard({ compensationText: '提成', commissionDesc: '直播销售提成' }, { board: '包吃包住', insured: true }))
  assert.ok(commission[0].items.includes('提成'))
  assert.equal(commission[1].title, '保险保障', '工资标题不能挂在保险说明上方')
  const detailedBonus = SP.welfareCard({ jobType: 'volunteer', bonusDesc: '服务满30天，发放满月红包＋业务提成' }, { redpacket: true })
  assert.deepEqual(SP.volunteerWelfareColumns(detailedBonus)[0].items, ['奖金：服务满30天，发放满月红包＋业务提成'], '保留奖励条件，不重复显示自动红包说明')
  const otherBonus = SP.welfareCard({ jobType: 'volunteer', bonusDesc: '额外销售奖励' }, { redpacket: true })
  assert.equal(SP.volunteerWelfareColumns(otherBonus)[0].items.length, 2, '不同奖励不得合并丢失')
})

test('角标：实地探访 + 含保险 → assured；只有实地探访 → onsite；线上采访 → online；未采访 / 线上任务 → 不挂', () => {
  const v = (isOnline, mode, insured) => SP.heroVariant({ isOnline, mode, insured })
  assert.equal(v(false, 'onsite', true), 'assured')
  assert.equal(v(false, 'onsite', false), 'onsite')
  assert.equal(v(false, 'online', true), 'online')
  assert.equal(v(false, 'online', false), 'online')
  assert.equal(v(false, '', true), '')
  assert.equal(v(true, 'onsite', true), '', '线上任务永远不挂')
  // 采访方式：以 storePage 为准；老服务端没有 storePage 时按安心商家认证推
  const m = (o) => SP.interviewMode(o)
  assert.equal(m({ isOnline: false, storePage: { interviewMode: 'online' }, safeCertified: true }), 'online')
  assert.equal(m({ isOnline: false, storePage: { interviewMode: '' }, safeCertified: true }), '', '有 storePage 时听它的')
  assert.equal(m({ isOnline: false, storePage: { interviewMode: 'weird' }, safeCertified: false }), '')
  assert.equal(m({ isOnline: false, storePage: null, safeCertified: true }), 'onsite')
  assert.equal(m({ isOnline: false, storePage: undefined, safeCertified: false }), '')
  assert.equal(m({ isOnline: true, storePage: { interviewMode: 'onsite' }, safeCertified: true }), '')
  assert.deepEqual(SP.BADGE_TEXT, { assured: '经袋鼠实地拍摄并含保险', onsite: '经袋鼠实地探访', online: '经袋鼠线上采访' })
})

test('storePage 为 null / 缺字段 / 类型不对：一律当「没有」，不报错', () => {
  for (const sp of [null, undefined, 'x', 3, {}, { interview: 'x', manager: [], facilities: 'gym', travel: null, dailyImages: {} }]) {
    const n = SP.normalizeStorePage(sp)
    assert.equal(n.interviewMode, '')
    assert.equal(n.interview, null)
    assert.equal(SP.interviewCard(sp, 'onsite'), null)
    assert.equal(SP.managerCard(sp), null)
    assert.deepEqual(SP.facilityGrid(sp), [])
    assert.deepEqual(SP.travelInfo(sp), { rows: [], cost: '' })
    assert.deepEqual(SP.dailyPhotos(sp, []), [])
    assert.deepEqual(SP.dailyPhotos(sp, [A, '', B]), [A, B], '没有店里日常时用岗位照片')
  }
  assert.equal(SP.normalizeStorePage(null).present, false)
  assert.equal(SP.normalizeStorePage({}).present, true)
})

test('采访视频卡：有视频才有；标题按时长写「N分钟实地采访 / 线上采访」，说明文字没填用默认，下面的小标签按采访方式', () => {
  const on = SP.interviewCard(STORE_PAGE, 'onsite')
  assert.deepEqual(on, { url: VIDEO, cover: STORE_PAGE.interview.cover, title: '5分钟实地采访', caption: '袋鼠工作人员线下实拍，店长讲清工作、食宿与真实氛围', chip: '已完成线下实地核验' })
  const online = SP.interviewCard({ ...STORE_PAGE, interviewMode: 'online', interview: { video: VIDEO, seconds: 75, note: '视频连线店长聊了 1 小时' } }, 'online')
  assert.equal(online.title, '1分钟线上采访')
  assert.equal(online.caption, '视频连线店长聊了 1 小时')
  assert.equal(online.chip, '已完成线上视频采访')
  assert.equal(SP.interviewCard({ ...STORE_PAGE, interview: { video: VIDEO, seconds: null } }, 'onsite').title, '实地采访视频', '没有时长不编分钟数')
  assert.equal(SP.interviewCard({ ...STORE_PAGE, interview: { video: '', seconds: 60 } }, 'onsite'), null, '没传视频不出卡')
  assert.equal(SP.interviewCard({ ...STORE_PAGE, interviewMode: '' }, ''), null, '未采访不出卡')
})

test('各块没有数据就不出：要求 / 三栏 / 工作时间 / 福利 / 店长 / 亮点 / 交通 / 用户反馈', () => {
  // 要求：换宿写性别（换工要求），兼职 / 全职不写性别（岗位要求），什么都没有返回 null
  assert.deepEqual(SP.requirementCard({ jobType: 'volunteer', requirement: '· 有责任心\n\n- 守时' }, '男女不限'), { title: '换工要求', rows: [{ k: '性别', v: '男女不限' }, { k: '', v: '有责任心' }, { k: '', v: '守时' }] })
  assert.deepEqual(SP.requirementCard({ jobType: 'parttime', requirement: '会收银' }, '女生'), { title: '岗位要求', rows: [{ k: '', v: '会收银' }] })
  assert.equal(SP.requirementCard({ jobType: 'fulltime', requirement: '' }, ''), null)
  // 三栏
  assert.deepEqual(SP.statStrip({ headcount: 2, startDate: '2026-10-22T00:00:00.000-08:00', minDays: 30 }), [{ k: '招募信息', v: '2人' }, { k: '到岗时间', v: '2026-10-22' }, { k: '最短期限', v: '30天起' }])
  assert.deepEqual(SP.statStrip({ headcount: null, minDaysText: '' }), [])
  assert.deepEqual(SP.statStrip(null), [])
  // 工作时间
  assert.deepEqual(SP.workTime({ dailyHours: '每日4小时', restModeLabel: '做二休一', shiftDesc: '早班' }), { hours: '每日4小时', rest: '做二休一 · 早班', mode: '做二休一', note: '早班' })
  // 2026-10-19：换宿那一窄栏只把档位写大字，门店写的排班说明 / 上班时段小字另起一行（之前整句大字折成四五行）
  assert.deepEqual(SP.workTime({ restModeLabel: '做五休二', shiftDesc: '每周 5 天，每天 6 小时', shiftTime: '9:00-15:00' }), { hours: '', rest: '做五休二 · 每周 5 天，每天 6 小时 · 9:00-15:00', mode: '做五休二', note: '每周 5 天，每天 6 小时 · 9:00-15:00' })
  assert.deepEqual(SP.workTime({ shiftTime: '9:00-15:00' }), { hours: '', rest: '9:00-15:00', mode: '', note: '9:00-15:00' })
  assert.equal(SP.workTime({}), null)
  const dv = fs.readFileSync(new URL('../pages/jobs/detail.vue', import.meta.url), 'utf8')
  assert.match(dv, /<view v-if="sections\.work\.mode" class="sp-work__rest">[\s\S]*?\{\{ sections\.work\.mode \}\}<\/text><\/view><text v-if="sections\.work\.note" class="sp-work__note">\{\{ sections\.work\.note \}\}<\/text>/)
  // 福利：只写门店填了的；一项都没有返回 null
  assert.equal(SP.welfareCard({ jobType: 'parttime' }, {}), null)
  assert.equal(SP.welfareCard({ jobType: 'volunteer' }, { redpacket: true }).title, '做满一个月福利')
  assert.equal(SP.welfareCard({ jobType: 'volunteer', compensationText: '包吃住' }, {}).title, '福利待遇')
  // 2026-10-18 主人：兼职、全职详情叫「工作待遇」（要求卡叫「岗位要求」）
  assert.equal(SP.welfareCard({ jobType: 'parttime', compensationText: '150 元/天' }, { redpacket: true }).title, '工作待遇')
  assert.equal(SP.welfareCard({ jobType: 'fulltime', compensationText: '5000 元/月' }, {}).title, '工作待遇')
  assert.equal(SP.requirementCard({ jobType: 'fulltime', requirement: '有经验' }, '').title, '岗位要求')
  // 店长：一样都没填返回 null；评分没有不写
  assert.equal(SP.managerCard({ manager: { name: '', avatar: '', years: '', skills: '', quote: '', rating: 4.9 } }), null)
  assert.equal(SP.managerCard({ manager: { name: '阿南', rating: null } }).ratingText, '')
  assert.equal(SP.managerCard({ manager: { name: '阿南', rating: 0 } }).ratingText, '', '0 分当没有评分')
  assert.equal(SP.managerCard(STORE_PAGE).ratingText, '4.8')
  // 亮点：图标都在 common/icons.js 里；不认识的代码丢掉，只给代码时用固定文字
  const icons = src('common/icons.js')
  for (const icon of Object.values(SP.FACILITY_ICON)) assert.ok(icons.includes('"' + icon + '":'), icon)
  assert.deepEqual(SP.facilityGrid({ facilities: [{ code: 'gym', label: '健身房' }, 'wifi', { code: 'zzz' }, { code: '' }] }), [{ code: 'gym', label: '健身房', icon: 'activity' }, { code: 'wifi', label: '无线网络', icon: 'wifi' }])
  // 交通：只出填了的行
  assert.deepEqual(SP.travelInfo({ travel: { rail: '', airport: '机场大巴', cost: '' } }), { rows: [{ k: '机场', v: '机场大巴' }], cost: '' })
  // 用户反馈：前两条有文字的
  assert.deepEqual(SP.feedbackLines([{ content: '' }, { content: ' 好 ' }, null, { content: '不错' }, { content: '第三条' }]), ['好', '不错'])
  assert.deepEqual(SP.feedbackLines(null), [])
  // 2026-10-18「用户反馈」那一块：综合分、条数、好评率、前 3 条评价（没写字的写「只打了分」）。
  // 2026-10-19：综合分 = 服务端 avg（全部评价总体评分的平均）、条数 = count（全部评价），和「查看全部」商家评价页同一个数；不再用分项（jobDims）平均
  const dg = SP.reviewDigest({ count: 7, avg: 4.0, jobReviewCount: 5, jobGoodRate: '92%', jobDims: [{ label: '环境', avg: 4.8 }, { label: '氛围', avg: 4.4 }, { label: '空', avg: null }],
    list: [{ reviewId: 1, name: '小林', avatar: '/a.jpg', stayDays: 30, date: '2026-10-01', rating: 5, content: '店长很照顾新人' }, { reviewId: 2, rating: 3.6, content: '' }, { reviewId: 3 }, { reviewId: 4, content: '第四条不显示' }] })
  assert.equal(dg.avgText, '4.0', '用 avg，不是分项平均 4.6')
  assert.equal(dg.avg, 4)
  assert.equal(dg.count, 7, '全部评价的条数（和「查看全部」页的累计评价一致），不是岗位评价条数')
  assert.equal(SP.reviewDigest({ avg: null, count: 0, jobDims: [{ avg: 5 }] }).avgText, '', '没有总体评分就不写分')
  // 带了筛选（同类岗位那一批）：用这一批的分和条数；这一批一条都没有时写 0 条、不写分，不退回全店的
  const fx = SP.reviewDigest({ count: 9, avg: 4.2, filteredTotal: 3, filteredAvg: 4.67, list: [{}, {}, {}] })
  assert.deepEqual([fx.avgText, fx.count], ['4.7', 3])
  const none = SP.reviewDigest({ count: 9, avg: 4.2, filteredTotal: 0, filteredAvg: null, list: [] })
  assert.deepEqual([none.avgText, none.count, none.items.length], ['', 0, 0])
  assert.deepEqual(SP.REVIEW_KIND, { volunteer: '换工', parttime: '兼职', fulltime: '全职' }, '和商家评价页的筛选胶囊同名')
  assert.match(src('pages/jobs/team.vue'), /const reviewFilters = \['全部', '换工', '兼职', '全职', '住宿', '有图'\]/)
  assert.deepEqual([SP.scoreText(4), SP.scoreText('4.67'), SP.scoreText(null), SP.scoreText(0), SP.scoreText('x')], ['4.0', '4.7', '', '', ''])
  assert.equal(dg.goodRate, '92%')
  assert.deepEqual(dg.items.map(x => [x.key, x.name, x.days, x.stars, x.text]), [[1, '小林', '驻店 30 天', 5, '店长很照顾新人'], [2, '伙伴', '', 4, '只打了分，没有写文字'], [3, '伙伴', '', 0, '只打了分，没有写文字']])
  assert.equal(dg.items[2].rating, null, '没打分的不画星')
  assert.deepEqual(SP.reviewDigest(null), { avg: null, avgText: '', count: 0, goodRate: '', items: [] })
  // 头图：一张整幅；多张左大右格，多出 5 张的写 +N
  assert.deepEqual(SP.heroLayout([A]), { main: A, grid: [], more: 0 })
  assert.deepEqual(SP.heroLayout([A, B]).grid, [{ src: B, index: 1 }])
  assert.equal(SP.heroLayout([1, 2, 3, 4, 5, 6, 7].map(String)).more, 2)
  // 标签行
  assert.deepEqual(SP.tagLine({ tags: ['前台'] }, { kindLabel: '直播换工', board: '包吃包住', bonus: true, status: '还招 2 人' }), ['直播换工', '包吃包住+奖金', '还招 2 人'])
  assert.deepEqual(SP.tagLine({ tags: ['前台', '收银'] }, { board: '', bonus: false, status: '' }), ['前台 / 收银'])
  assert.deepEqual(SP.tagLine(null, {}), [])
})

test('保险那一行只有含保险才写；门店资质只有传了营业执照才有；平台协助一直有；不写「无押金 / 无中介费」', () => {
  const keys = (o) => SP.assuranceRows(o).map(r => r.key)
  assert.deepEqual(keys({ insured: true, licenseImage: 'x' }), ['insurance', 'license', 'help'])
  assert.deepEqual(keys({ insured: false, licenseImage: 'x' }), ['license', 'help'])
  assert.deepEqual(keys({ insured: true, licenseImage: '' }), ['insurance', 'help'])
  assert.deepEqual(keys({ insured: false, licenseImage: '' }), ['help'])
  assert.ok(SP.welfareCard({ jobType: 'volunteer', boardText: '包吃包住' }, { insured: true }).items.includes('平台统一购买意外险'))
  assert.ok(!SP.welfareCard({ jobType: 'volunteer', boardText: '包吃包住' }, { insured: false, board: '包吃包住' }).items.some(x => /险/.test(x)))
  // 注释里说明了「不写」，只查代码和模板里真正显示的字
  const all = (src('pages/jobs/store-page.js') + src('pages/jobs/detail.vue')).replace(/<!--[\s\S]*?-->|\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, '')
  assert.doesNotMatch(all, /无押金|无中介费/)
  // 门店卡副标题
  assert.equal(SP.storeSubline('onsite'), '平台审核岗位 · 袋鼠实地探访')
  assert.equal(SP.storeSubline('online'), '平台审核岗位 · 袋鼠线上采访')
  assert.equal(SP.storeSubline(''), '平台审核岗位')
})

// ---------------------------------------------------------------- job-badge

test('job-badge：variant 选文字；不传 variant 时和原来一字不差（卡片两行、头图 / 小标签一行）', () => {
  const badge = src('pages/jobs/components/job-badge.vue')
  assert.match(badge, /variant: \{ type: String, default: 'assured' \}/)
  assert.match(badge, /<view v-if="size === 'card' && variant === 'assured'" class="jb__lines"><text class="jb__text">经袋鼠实地拍摄<\/text><text class="jb__text">并含保险<\/text><\/view>/)
  assert.match(badge, /const TEXT = \{ assured: '经袋鼠实地拍摄并含保险', onsite: '经袋鼠实地探访', online: '经袋鼠线上采访' \}/)
  assert.match(badge, /TEXT\[props\.variant\] \|\| TEXT\.assured/)
  // 列表已在 10-24 改为 45 度角标，仍沿用默认认证口径。
  assert.match(src('pages/jobs/list.vue'), /<job-badge size="ribbon" \/>/)
  assert.doesNotMatch(src('pages/jobs/list.vue') + src('pages/jobs/filter.vue'), /<job-badge[^>]*variant/)
  for (const m of badge.matchAll(/font-size: (\d+)px/g)) assert.ok(Number(m[1]) >= 10, m[0])
})

// ---------------------------------------------------------------- 详情页

test('详情页（线下）：新布局各块按数据出；角标、采访视频、店长、亮点、交通、执照、反馈、日常都接上', async (t) => {
  const h = harness()
  t.after(h.stop)
  await h.open()
  assert.equal(h.run('badgeVariant.value'), 'assured')
  assert.equal(h.run('mode.value'), 'onsite')
  assert.deepEqual(get(h, 'tagParts.value'), ['直播换工', '包吃包住+奖金', '还招 2 人'])
  assert.equal(h.run('placeText.value'), '福建省平潭县东湖山庄98号 · 平潭')
  assert.deepEqual(get(h, 'travel.value'), { rows: [{ k: '高铁', v: STORE_PAGE.travel.rail }, { k: '机场', v: STORE_PAGE.travel.airport }], cost: '约37元起' })
  assert.equal(get(h, 'interview.value').title, '5分钟实地采访')
  assert.equal(h.run('interviewCover.value'), 'https://api.test' + STORE_PAGE.interview.cover)
  assert.deepEqual(get(h, 'reqCard.value'), { title: '换工要求', rows: [{ k: '性别', v: '男女不限' }, { k: '', v: '有责任心' }, { k: '', v: '遵守门店管理制度' }] })
  assert.deepEqual(get(h, 'stats.value').map(x => x.v), ['2人', '2026-10-22', '30天起'])
  assert.deepEqual(get(h, 'contentLines.value'), ['协助直播运营', '协助门店日常运营'])
  assert.deepEqual(get(h, 'work.value'), { hours: '每日4小时', rest: '做二休一', mode: '做二休一', note: '' })
  const w = get(h, 'welfare.value')
  assert.equal(w.title, '做满一个月福利')
  assert.deepEqual(w.highlights, ['提供食宿'])
  assert.deepEqual(w.items, ['做满一个月发放满月红包', '奖金：满勤奖 300', '平台统一购买意外险'])
  assert.equal(get(h, 'manager.value').name, '阿南')
  assert.equal(h.run('managerAvatar.value'), 'https://api.test' + STORE_PAGE.manager.avatar)
  assert.deepEqual(get(h, 'facilities.value').map(f => f.icon), ['activity', 'waves-ladder', 'bike'])
  // 用户反馈（2026-10-18 评价页签搬进来）：条数、前 3 条
  // 2026-10-19：换宿岗位只拉这家店「换工」那一批评价（住宿客人的不放上来），分 / 条数用这一批的 filteredAvg / filteredTotal（4.7 / 2），
  // 不是全店的 avg / count（4.5 / 5），也不是分项平均（4.0）；门店卡片写同一个分；「查看全部」带同一个筛选进商家评价页
  assert.equal(get(h, 'digest.value').count, 2)
  assert.equal(get(h, 'digest.value').avgText, '4.7')
  assert.deepEqual(plain(h.data.reviewArgs), [
    ['/app/stores/102/job-reviews/summary', { filter: '换工' }],
    ['/app/stores/102/job-reviews', { filter: '换工', tab: 'all', sort: 'latest', pageNum: 1 }]
  ])
  assert.equal(h.run('storeMeta.value'), '平潭 · 4.7 分 · 关注后上新会通知你')
  h.run('openStoreReviews()')
  assert.deepEqual(h.log.gone, ['/pages/jobs/reviews?storeId=102&filter=' + encodeURIComponent('换工')])
  assert.deepEqual(get(h, 'digest.value').items.map(x => x.text), ['真实小院，店长很照顾新人', '只打了分，没有写文字', '伙食稳定，同事友好'])
  assert.deepEqual(get(h, 'daily.value'), ['https://api.test' + A, 'https://api.test' + B])
  assert.deepEqual(get(h, 'assurance.value').map(r => r.key), ['insurance', 'license', 'help'])
  assert.equal(h.run('storeSub.value'), '平台审核岗位 · 袋鼠实地探访')
  // 点门店资质看执照；点店里日常看大图
  h.run("tapAssurance({ key: 'help' })")
  assert.equal(h.log.previews.length, 0)
  h.run("tapAssurance(assurance.value.find(r => r.key === 'license'))")
  assert.deepEqual(plain(h.log.previews.at(-1).urls), ['https://api.test' + STORE_PAGE.licenseImage])
  h.log.previews.at(-1).fail()
  assert.equal(h.log.toasts.at(-1), '营业执照暂时无法打开，请稍后重试')
  h.run('previewDaily(1)')
  assert.equal(h.log.previews.at(-1).current, 'https://api.test' + B)
  // 小地图和原来的「工作地点」是同一个 openMap
  h.run('openMap()')
  assert.equal(h.log.opened.length, 1)
  // 采访视频：点了出播放层，关掉就没了（2026-10-18 起页面没有页签，也就不再有横划切页签）
  h.run('playInterview()')
  assert.deepEqual(get(h, 'playing.value'), { url: VIDEO, cover: STORE_PAGE.interview.cover, title: '5分钟实地采访' })
  h.run('closeVideo()')
  assert.deepEqual(get(h, 'playing.value'), {})
  // 收藏只保留标题右侧一个，移出照片以免遮住首图。
  assert.match(h.template, /<view class="sp-heading__favorite"[^>]*@click\.stop="toggleFavorite">/)
  assert.ok(!/class="sp-fav"|class="sp-ptfav"/.test(h.template), '页面里不再有第二个收藏按钮')
  assert.equal((h.template.match(/@click(\.stop)?="toggleFavorite"/g) || []).length, 2, '线下版式一个（标题右侧）+ 线上任务版式原来那一个')
})

test('详情页（线下）：只实地探访不含保险 → onsite 角标、不写保险；线上采访 → online；没执照不出门店资质', async (t) => {
  const h = harness()
  t.after(h.stop)
  h.data.detail = { ...plain(VOLUNTEER), insuranceFlag: '1', storePage: { ...STORE_PAGE, licenseImage: '' } }
  await h.open()
  assert.equal(h.run('badgeVariant.value'), 'onsite')
  assert.deepEqual(get(h, 'assurance.value').map(r => r.key), ['help'])
  h.run("tapAssurance(sections.value.assurance.find(r => r.key === 'license'))")
  assert.equal(h.log.toasts.at(-1), '门店暂未上传营业执照')
  assert.equal(h.log.previews.length, 0)
  assert.ok(!get(h, 'welfare.value').items.some(x => /险/.test(x)))
  h.run(`detail.value = ${JSON.stringify({ ...VOLUNTEER, safeCert: '1', store: { ...VOLUNTEER.store, safeCert: '1' }, storePage: { ...STORE_PAGE, interviewMode: 'online' } })}`)
  assert.equal(h.run('badgeVariant.value'), 'online')
  assert.equal(get(h, 'interview.value').chip, '已完成线上视频采访')
  assert.equal(h.run('storeSub.value'), '平台审核岗位 · 袋鼠线上采访')
  h.run(`detail.value = ${JSON.stringify({ ...VOLUNTEER, storePage: { ...STORE_PAGE, interviewMode: '' } })}`)
  assert.equal(h.run('badgeVariant.value'), '')
  assert.equal(h.run('interview.value'), null)
})

test('详情页（线下）：老服务端没有 storePage（null / 不给）也能看——角标按认证推，原始资料为空，展示层仍保留区块', async (t) => {
  for (const storePage of [null, undefined]) {
    const h = harness()
    t.after(h.stop)
    const d = { ...plain(VOLUNTEER), storePage }
    if (storePage === undefined) delete d.storePage
    h.data.detail = d
    h.data.reviews = { jobReviewCount: 0, jobDims: [], list: [] }
    await h.open()
    assert.equal(h.run('badgeVariant.value'), 'assured', '认证 + 含保险')
    assert.equal(h.run('interview.value'), null)
    assert.equal(h.run('manager.value'), null)
    assert.deepEqual(get(h, 'facilities.value'), [])
    assert.deepEqual(get(h, 'travel.value'), { rows: [], cost: '' })
    assert.equal(get(h, 'digest.value').count, 0)
    assert.deepEqual(get(h, 'daily.value'), ['https://api.test' + A, 'https://api.test' + B])
    assert.deepEqual(get(h, 'assurance.value').map(r => r.key), ['insurance', 'help'])
  }
  // 没认证、没保险、没照片、什么都没填的兼职：只剩标题、平台协助和门店卡
  const h = harness()
  t.after(h.stop)
  h.run(`detail.value = ${JSON.stringify({ jobId: 9, jobType: 'parttime', title: '咖啡店兼职', status: 'published', images: [], store: { storeId: 5, storeName: '店' } })}`)
  assert.equal(h.run('badgeVariant.value'), '')
  for (const k of ['interview', 'reqCard', 'work', 'welfare', 'manager']) assert.equal(h.run(k + '.value'), null, k)
  for (const k of ['stats', 'contentLines', 'facilities', 'daily', 'tagParts']) assert.deepEqual(get(h, k + '.value'), [], k)
  assert.deepEqual(get(h, 'assurance.value').map(r => r.key), ['help'])
  assert.equal(h.run('storeSub.value'), '平台审核岗位')
})

test('详情页（线上任务）：照旧是原来的布局，没有门店页的各块；storePage 即使给了也不用', async (t) => {
  const h = harness()
  t.after(h.stop)
  h.data.detail = { jobId: 8, jobType: 'online', title: '剪辑任务', status: 'published', images: [], cover: '', safeCert: '0', insuranceFlag: '0', storePage: STORE_PAGE, store: { storeId: 102 } }
  await h.open()
  assert.equal(h.run('isOnline.value'), true)
  assert.equal(h.run('storePage.value'), null)
  assert.equal(h.run('badgeVariant.value'), '')
  assert.equal(h.run('interview.value'), null)
  assert.ok(get(h, 'overviewRows.value').some(r => r.label === '参与方式'))
  // 模板：线上任务走原来那一套（关键信息 / 线上任务须知 / 工作内容 / 我们希望你），线下走门店页
  const tpl = h.template
  const page1 = tpl.slice(tpl.indexOf('<view class="overview k-pad-bottom">'), tpl.indexOf('<k-bottom'))
  const online = page1.slice(page1.indexOf('<template v-if="isOnline">'), page1.indexOf('</template>'))
  const offline = page1.slice(page1.indexOf('<view v-else-if="detail" class="sp"'))
  for (const x of ['class="info-card"', '线上任务须知', '具体工作内容', '我们希望你', 'class="store-card"', '<view class="hero">']) assert.ok(online.includes(x), x)
  assert.ok(!online.includes('sp-'), '线上任务没有门店页的块')
  for (const x of ['<job-badge v-else size="detail" :variant="badgeVariant" />', '平台岗检', '位置与交通', '@click="openMap"', 'TRAVEL_NOTE', '@click="interview && !playing.url && playInterview()"', 'sections.requirements.title',
    '工作内容', '工作时间', 'welfare.title', '店长介绍', '店长服务评分', '该店亮点', '用户反馈', '店里日常', '袋鼠安心保障', '<city-coordinator', '@click.stop="toggleFavorite"', 'applyBlockedText']) {
    assert.ok(offline.includes(x), x)
  }
  assert.ok(offline.indexOf('位置与交通') < offline.indexOf('playInterview') && offline.indexOf('playInterview') < offline.indexOf('sections.requirements.title')
    && offline.indexOf('店长介绍') < offline.indexOf('该店亮点') && offline.indexOf('袋鼠安心保障') < offline.indexOf('<city-coordinator'), '顺序和效果图一致')
  // 播放层、底部按钮在页面最外层
  assert.match(tpl, /<job-video-player v-if="playing\.url" inline :src="playing\.url"/)
  // 2026-10-25 兼职和全职也按新参考图使用「找人一起去」。
  assert.match(tpl, /label="找人一起去" @click="openTeam"/)
  // 播放层组件放在 jobs 分包里（不跨分包引用 stays 的，免得被挪进主包）
  assert.ok(fs.existsSync(path.join(APP, 'pages/jobs/components/job-video-player.vue')))
  assert.doesNotMatch(src('pages/jobs/detail.vue'), /from ['"][^'"]*pages\/stays|stay-video-player/)
})

test('门店页样式：字号不小于 11px，三栏 / 亮点格子不会把 375 宽撑出横向滚动', () => {
  const d = compiler.parse(src('pages/jobs/detail.vue')).descriptor
  const css = d.styles.map(s => s.content).join('\n')
  const sp = css.slice(css.indexOf('.sp-hero {'))
  for (const m of sp.matchAll(/font-size: (\d+)px/g)) assert.ok(Number(m[1]) >= 11, m[0])
  assert.match(sp, /\.sp-fac \{[^}]*grid-template-columns: repeat\(3, minmax\(0, 1fr\)\)/)
  assert.match(sp, /\.sp-stat \{ flex: 1; min-width: 0;/)
  assert.match(sp, /\.sp-daily \{[^}]*grid-template-columns: repeat\(4, minmax\(0, 1fr\)\)/)
  assert.match(sp, /\.sp-rv__main \{ flex: 1; min-width: 0; \}/)
  // 只用 common/icons.js 里已有的图标
  const icons = src('common/icons.js')
  for (const m of d.template.content.matchAll(/<k-icon name="([\w-]+)"/g)) assert.ok(icons.includes('"' + m[1] + '":'), m[1])
})

test('换宿参照页：两种采访文案跟随真实模式，未投保不能显示保险承诺，切换后视频标识同步', async (t) => {
  const h = harness()
  t.after(h.stop)
  await h.open()
  assert.equal(h.run('isVolunteer.value'), true)
  assert.equal(h.run('volunteerVisitLabel.value'), '袋鼠实地探访')
  assert.ok(get(h, 'assurance.value').some(x=>x.key==='insurance'), '保险承诺仍按真实字段显示在保障区')
  assert.equal(h.run('interview.value.chip'), '已完成线下实地核验')
  h.run(`detail.value = ${JSON.stringify({...VOLUNTEER, insuranceFlag:'1', storePage:{...STORE_PAGE,interviewMode:'online'}})}`)
  assert.equal(h.run('volunteerVisitLabel.value'), '袋鼠线上采访')
  assert.equal(h.run('interview.value.title'), '5分钟线上采访')
  assert.equal(h.run('interview.value.chip'), '已完成线上视频采访')
  assert.ok(!get(h, 'assurance.value').some(x=>x.key==='insurance'))
  h.run(`detail.value = ${JSON.stringify({...VOLUNTEER, insuranceFlag:'1'})}`)
  assert.equal(h.run('volunteerVisitLabel.value'), '袋鼠实地探访')
  assert.ok(!get(h, 'welfare.value').items.some(x=>/险/.test(x)))
  h.run(`detail.value = ${JSON.stringify({...VOLUNTEER,storePage:{...STORE_PAGE,interviewMode:''}})}`)
  assert.equal(h.run('volunteerVisitLabel.value'), '')
  assert.equal(h.run('interview.value'), null)
})

test('换宿参照页：常规交通完整展示，长说明可展开且原文保留', async (t) => {
  const h = harness()
  t.after(h.stop)
  await h.open()
  assert.equal(h.run('travelCanExpand.value'), false)
  const longRail = '公交线路及换乘说明。'.repeat(15)
  h.run(`detail.value = ${JSON.stringify({...VOLUNTEER,storePage:{...STORE_PAGE,travel:{rail:longRail}}})}`)
  assert.equal(h.run('travelCanExpand.value'), true)
  assert.equal(h.run('travelExpanded.value'), false)
  assert.equal(h.run('travel.value.rows[0].v'), longRail)
  h.run('travelExpanded.value = true')
  assert.equal(h.run('travelExpanded.value'), true)
  h.run('openStoreReviews()')
  assert.ok(h.log.gone.at(-1).includes('filter=' + encodeURIComponent('换工')))
})

test('换宿参照页：并排日常保留两张缩略图，点击进入当前岗位对应的门店日常页', async (t) => {
  const h = harness()
  t.after(h.stop)
  const images = [A, B, A+'?3', A+'?4', A+'?5']
  h.data.detail = {...plain(VOLUNTEER),storePage:{...STORE_PAGE,dailyImages:images}}
  await h.open()
  assert.equal(get(h,'dailyShown.value').length,2)
  assert.equal(h.run('dailyMore.value'),3)
  h.run('openDaily()')
  assert.equal(h.log.gone.at(-1), '/pages/stays/diary?jobId=7')
  assert.equal(h.log.previews.length, 0)
  h.run('rv.value = null')
  assert.equal(get(h,'dailyShown.value').length,2)
  assert.equal(h.run('dailyMore.value'),3)
})
