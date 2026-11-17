// 2026-10-31 招募表单（包 20261031-forms）：R1 工时、R2 餐补、R3 宠物、R4 住宿照片视频，R7 表单改版的折叠和底部弹层，已发岗位补资料「住宿与宠物」（node --test，不需要构建、不发请求）。
// 主人原话：
//   「工作时间:2小时，四小时，六小时，八小时（别出现十小时）」「点击不包住，底下要自动多一个餐补填写」
//   「换工界面还需要有一个宠物是否有无的地方，有的话上传几个图片这样的」「换工的住宿视频在哪里上传」「住宿应该是照片或视频上传」
//   「这几个需要填写东西的页面……看起来很乱……这里使用的有年龄大的，需要看起来更干净成熟一些」
// 守住这几件事：
//   · 工时只有 2、4、6、8 小时；老岗位存的别的值照实显示、原样提交，点了新值才变，点错了再点回到老值；
//   · 餐补只要不包吃就出现（只包住 / 包住 / 不包食宿），选填；宠物只给换工，都不选不挡提交，选「有」才带照片；住宿照片视频只在包住时带；不适用的键传空（传了服务端才清空）；
//   · 折叠不藏错：折叠区有错自动展开、等一下再滚；收起时头上写还差什么；打开时里面有内容就默认展开；
//   · 底部弹层：单选点一项就定、多选点确定才定、点遮罩不改；超上限提示；
//   · 已发岗位「住宿与宠物」：把关和换照片一样，只带看得到的键，没改不发请求；
//   · 填写屏不出浮动客服钮（字段从屏幕边开始，钮会压字），商家的客服方块在操作条最左边。
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { createRequire } from 'node:module'
import test from 'node:test'
import assert from 'node:assert/strict'
import * as genderPlan from '../common/job-gender.js'

const APP = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const require = createRequire(path.join(APP, 'package.json'))
const compiler = require('@vue/compiler-sfc'), vue = require('vue')
const src = (rel) => fs.readFileSync(path.join(APP, rel), 'utf8').replace(/\r\n/g, '\n')
const salary = await import(pathToFileURL(path.join(APP, 'common/job-salary.js')).href)
const view = await import(pathToFileURL(path.join(APP, 'pages/staff/request-view.js')).href)
const video = await import(pathToFileURL(path.join(APP, 'pages/staff/stay-video.js')).href)
const fab = await import(pathToFileURL(path.join(APP, 'common/support-fab.js')).href)
const plain = (v) => JSON.parse(JSON.stringify(v))
const flush = () => new Promise(resolve => setImmediate(resolve))
const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms))

/** 在沙箱里跑页面的 script setup：导入一律先给永远不返回的函数，再用 stubs 覆盖用得到的那几个 */
function runSetup(rel, stubs) {
  const d = compiler.parse(src(rel), { filename: rel }).descriptor
  const source = d.scriptSetup.content
  const ast = compiler.babelParse(source, { sourceType: 'module' })
  const body = ast.program.body.filter(n => n.type !== 'ImportDeclaration').map(n => source.slice(n.start, n.end)).join('\n')
  const sandbox = { console, setTimeout, clearTimeout }
  for (const n of ast.program.body.filter(n => n.type === 'ImportDeclaration')) for (const s of n.specifiers) sandbox[s.local.name] = () => new Promise(() => {})
  // Use synchronous production validation rather than the generic pending API stub.
  Object.assign(sandbox, genderPlan, { ensureSession: async () => {}, getSessionRevision: () => 0 })
  Object.assign(sandbox, { ref: vue.ref, computed: vue.computed, watch: vue.watch, reactive: vue.reactive, onShow() {}, onHide() {}, onUnload() {}, onUnmounted() {}, onMounted() {} }, stubs)
  vm.createContext(sandbox)
  const scope = vue.effectScope()
  scope.run(() => vm.runInContext(body, sandbox, { filename: rel + ':script-setup' }))
  return { run: code => vm.runInContext(code, sandbox), stop: () => scope.stop(), template: d.template.content, sandbox, styles: d.styles.map(x => x.content).join('\n') }
}

const R = { staffOnline: '/pages/staff/online-jobs', staffJobs: '/pages/staff/jobs', staff: '/pages/staff/index' }
const CAT = [['民宿', 'homestay'], ['酒店', 'hotel'], ['咖啡餐饮', 'food'], ['酒吧', 'bar'], ['其他', 'other']]
const PHOTO = '/profile/upload/2026/10/31/a.jpg'

function jobsHarness({ rows = [], detail, extras = {}, merchant = false, statusBarHeight, picks = [] } = {}) {
  const log = { created: [], puts: [], gets: [], toasts: [], scrolls: [], uploads: [], videoOpts: [], loading: 0, played: [], sheets: [] }
  const ctl = { videoResult: { url: '/profile/upload/videos/x.mp4', cover: '/profile/upload/c.jpg', duration: 60 }, videoError: null, confirm: true }
  let onLoad = null
  const s = vue.ref(1)
  const queue = picks.slice()
  const h = runSetup('pages/staff/jobs.vue', {
    useScreen: (n, opts) => { onLoad = opts && opts.onLoad; return s },
    onShareAppMessage() {}, ensureSession: async () => {}, hasStaffAccess: { value: true }, merchantStaff: { value: merchant },
    currentStaffStoreId: () => 102, selectStaffStore: async () => {}, staffCan: () => true, absUrl: x => 'https://api.test' + x,
    todayCn: () => '2026-10-31', shiftDate: () => '2026-11-07', isYmd: (v) => /^\d{4}-\d{2}-\d{2}$/.test(String(v || '')),
    validateSalaryForm: salary.validateSalaryForm, salaryPayload: salary.salaryPayload, jobBenefits: salary.jobBenefits,
    parseSalaryAmount: salary.parseSalaryAmount, SALARY_OPTIONS: salary.SALARY_OPTIONS, salaryOption: salary.salaryOption,
    MERCHANT_JOBS_API: view.MERCHANT_JOBS_API, draftJobForm: view.draftJobForm,
    toast: (m) => log.toasts.push(m), go() {}, back() {}, errText: (e, d) => (e && e.message) || d, R,
    confirm: async () => ctl.confirm, alert: async () => {}, prompt: async () => null,
    sheet: async (opts) => { log.sheets.push([...opts]); return queue.length ? opts.indexOf(queue.shift()) : -1 },
    apiStaffJobs: async () => ({ data: { rows, canEdit: true, storeCert: true, storeAddress: '平潭海边' } }),
    apiStaffShareStats: async () => ({ data: {} }),
    apiStaffJobKeywords: async () => ({ data: ['咖啡', '接待', '做饭', '拍摄', '摄影'] }),
    apiJobKinds: async () => ({ data: [{ value: 'daily', label: '日常换工', desc: '前台、接待' }, { value: 'edit', label: '剪辑换工', desc: '' }] }),
    apiStaffCreateJob: async (storeId, payload) => { log.created.push(plain(payload)); return { msg: '已提交平台审核', data: { jobId: 777 } } },
    chooseImages: async () => ['wxfile://1'], uploadTo: async () => ({ data: { url: '/profile/upload/u' + (log.uploads.push(1)) + '.jpg' } }),
    chooseAndUploadVideo: async (onProgress, deps, opts) => { log.videoOpts.push(opts); if (ctl.videoError) throw ctl.videoError; return ctl.videoResult }, uploadVideoParts: async () => ({}),
    playVideoFull: (url, poster) => log.played.push([url, poster]),
    get: async (url) => { log.gets.push(url); return { data: url.endsWith('/extras') ? extras : detail } },
    put: async (url, body) => { log.puts.push([url, plain(body)]); return { msg: '已保存', data: { jobId: 321, title: body.title } } },
    post: async () => ({ msg: 'ok' }),
    uni: {
      pageScrollTo: (o) => log.scrolls.push(o), showLoading() { log.loading++ }, hideLoading() { log.loading-- }, previewImage() {},
      ...(statusBarHeight ? { getSystemInfoSync: () => ({ statusBarHeight }) } : {})
    }
  })
  return { ...h, s, log, ctl, load: async (q = {}) => { onLoad && onLoad(q); await flush(); await flush() } }
}
const open = async (t, kind, opts) => {
  const h = jobsHarness(opts)
  t.after(h.stop)
  await h.load()
  h.run(`startPublish(); choosePublish('${kind}')`)
  await flush()
  return h
}
const fillRequired = (h) => {
  h.run(`form.value.images = ['${PHOTO}']; setGen('title', '标题'); setGen('work', '内容')`)
  if (h.run('form.value.jobType') !== 'volunteer') h.run("form.value.salary = '150'")
}

// ---------------------------------------------------------------- R1 工时

test('R1 工时：只有 2、4、6、8 小时，默认换工 4、兼职 6、全职 8；模板四格，没有 10 小时、弹性、自定义', async (t) => {
  const h = await open(t, 'volunteer')
  assert.deepEqual(plain(h.run('HOUR_OPTS')).map(o => o[0]), ['2 小时', '4 小时', '6 小时', '8 小时'])
  assert.deepEqual(plain(h.run('HOUR_OPTS')).map(o => o[1]), ['每天 2 小时', '每天 4 小时', '每天 6 小时', '每天 8 小时'])
  assert.deepEqual(['volunteer', 'parttime', 'fulltime'].map(k => h.run(`newForm('${k}').dailyHours`)), ['每天 4 小时', '每天 6 小时', '每天 8 小时'])
  assert.match(h.template, /<view class="fc-seg fc-seg--4"><view v-for="h in HOUR_OPTS" :key="h\[1\]" class="fc-seg__item" :class="\{ on: form\.dailyHours === h\[1\] \}" hover-class="k-press" @click="pickDailyHours\(h\[1\]\)">/)
  const page = src('pages/staff/jobs.vue')
  assert.doesNotMatch(page, /'每天 10 小时'|'弹性时间'|hoursCustom/)
})

test('R1 老值：完善商家岗位带回「弹性时间」，哪格都不亮、照实写一句、原样提交；点了才换；点错了再点回到老值', async (t) => {
  const detail = { canEdit: true, job: { jobType: 'volunteer', title: '老岗位', images: [PHOTO], content: '内容', dailyHours: '弹性时间', boardType: 'all', startDate: '2026-11-08', headcount: 2 } }
  const h = jobsHarness({ rows: [{ jobId: 321, title: '老岗位', jobType: 'volunteer', status: 'draft', canPublish: true }], detail, picks: ['完善岗位信息'] })
  t.after(h.stop)
  await h.load()
  await h.run('jobActions(jobList.value[0])')
  await flush()
  assert.equal(h.run('form.value.dailyHours'), '弹性时间')
  assert.equal(h.run('legacyHours.value'), '弹性时间')
  assert.match(h.template, /目前存的是「\{\{ legacyHours \}\}」，不选就保持不变/)
  await h.run('submitJob()')
  await flush()
  assert.equal(h.log.puts.at(-1)[1].dailyHours, '弹性时间', '不点就原样提交，不被悄悄改掉')
})

test('R1 老值：点新值才变，点错了再点一下回到老值，不是清空；新建表单再点才是清空', async (t) => {
  const detail = { canEdit: true, job: { jobType: 'parttime', title: '老', dailyHours: '每天 10 小时', boardType: 'all' } }
  const h = jobsHarness({ rows: [{ jobId: 321, title: '老', jobType: 'parttime', status: 'draft', canPublish: true }], detail, picks: ['完善岗位信息'] })
  t.after(h.stop)
  await h.load()
  await h.run('jobActions(jobList.value[0])')
  await flush()
  assert.equal(h.run('legacyHours.value'), '每天 10 小时')
  h.run("pickDailyHours('每天 8 小时')")
  assert.equal(h.run('form.value.dailyHours'), '每天 8 小时')
  assert.equal(h.run('legacyHours.value'), '')
  h.run("pickDailyHours('每天 8 小时')")
  assert.equal(h.run('form.value.dailyHours'), '每天 10 小时')
  h.run('backFromPublish()')
  await flush()
  h.run("startPublish(); choosePublish('volunteer')")
  h.run("pickDailyHours('每天 4 小时')")
  assert.equal(h.run('form.value.dailyHours'), '', '新建的没有老值')
})

// ---------------------------------------------------------------- R2 餐补

test('R2 餐补：只要不包吃就出现（只包住 / 包住 / 不包食宿），包吃包住、包吃没有；切到包吃清掉', async (t) => {
  const h = await open(t, 'parttime')
  const shown = (b) => { h.run(`setBoard('${b}')`); return h.run('mealShown.value') }
  assert.deepEqual(['all', 'room', 'meal', 'none'].map(shown), [false, true, false, true])
  h.run("setBoard('none'); form.value.mealAllowance = '30'; form.value.mealAllowanceUnit = 'month'")
  h.run("setBoard('meal')")
  assert.equal(h.run('form.value.mealAllowance'), '', '包吃了就没有餐补')
  h.run("form.value = newForm('volunteer')")
  assert.equal(h.run('mealShown.value'), false, '换工默认包吃包住')
  h.run("setBoard('room')")
  assert.equal(h.run('mealShown.value'), true, '换工只包住')
  assert.equal(h.run('form.value.mealAllowanceUnit'), 'day', '默认元/天')
  assert.deepEqual(plain(h.run('MEAL_UNITS')), [['元/天', 'day'], ['元/月', 'month']])
  assert.match(h.template, /<view v-if="mealShown" id="pf-meal" class="fc-field">/)
  assert.match(h.template, /<view class="fc-money-row"><view class="fc-money"[^>]*>[\s\S]{0,300}placeholder="例如 30"/)
})

test('R2 餐补：选填，空着不挡提交；金额不对就地标红（和服务端同一条规则）；提交带金额和单位，不出现时带空', async (t) => {
  const h = await open(t, 'volunteer')
  fillRequired(h)
  h.run("setBoard('room'); tried.value = true")
  assert.equal(h.run('errCount.value'), 0, '选填')
  for (const bad of ['abc', '1.234', '123456']) {
    h.run(`form.value.mealAllowance = '${bad}'`)
    assert.equal(plain(h.run('err.value')).meal, '餐补金额要是数字，最多两位小数', bad)
  }
  h.run("form.value.mealAllowance = '0'")
  assert.equal(plain(h.run('err.value')).meal, '餐补金额要大于 0')
  await h.run('submitJob()')
  assert.equal(h.log.created.length, 0)
  assert.equal(h.log.toasts.at(-1), '餐补金额要大于 0')
  assert.equal(h.log.scrolls.at(-1).selector, '#pf-meal')
  h.run("form.value.mealAllowance = ' 15.5 '; form.value.mealAllowanceUnit = 'month'")
  assert.equal(h.run('errCount.value'), 0)
  assert.deepEqual(plain(h.run('publishExtras(form.value)')).mealAllowance, '15.5')
  assert.deepEqual(plain(h.run('publishExtras(form.value)')).mealAllowanceUnit, 'month')
  h.run("form.value.mealAllowance = ''")
  assert.equal(plain(h.run('publishExtras(form.value)')).mealAllowanceUnit, '', '没金额不带单位')
  // 不出现时带空：改成包吃能清掉库里的老值
  h.run("form.value.mealAllowance = '30'; form.value.boardType = 'all'")
  assert.equal(plain(h.run('publishExtras(form.value)')).mealAllowance, '')
})

// ---------------------------------------------------------------- R3 宠物

test('R3 宠物：只给换工；都不选 = 没填，不挡提交；再点取消；选「有」才带照片，最多 6 张；兼职、全职传空', async (t) => {
  const h = await open(t, 'volunteer')
  fillRequired(h)
  assert.match(h.template, /<view v-if="form\.jobType==='volunteer'" class="fc-field">\s*<view class="fc-label"><text class="fc-label__t">店里有宠物吗<\/text>/)
  assert.deepEqual(plain(h.run('PET_OPTS')), [['没有', 'none'], ['有', 'yes']])
  assert.equal(h.run('PET_MAX'), 6)
  h.run('tried.value = true')
  assert.equal(h.run('form.value.petStatus'), '')
  assert.equal(h.run('errCount.value'), 0, '都不选不挡提交')
  h.run("setPet(form.value, 'yes')")
  assert.equal(h.run('form.value.petStatus'), 'yes')
  h.run("setPet(form.value, 'yes')")
  assert.equal(h.run('form.value.petStatus'), '', '再点取消')
  h.run("setPet(form.value, 'yes'); form.value.petImages = ['/profile/upload/p.jpg']")
  assert.deepEqual(plain(h.run('publishExtras(form.value)')).petImages, ['/profile/upload/p.jpg'])
  h.run("setPet(form.value, 'none')")
  const none = plain(h.run('publishExtras(form.value)'))
  assert.deepEqual([none.petStatus, none.petImages], ['none', []], '选了没有就不带照片')
  // 上限：第 6 张之后提示
  h.run("setPet(form.value, 'yes'); form.value.petImages = Array.from({ length: 6 }, (_, i) => '/profile/upload/p' + i + '.jpg')")
  await h.run('addPhotos(form.value.petImages, PET_MAX)')
  assert.equal(h.log.toasts.at(-1), '最多 6 张照片')
  assert.equal(h.run('form.value.petImages.length'), 6)
  // 兼职：不带宠物
  h.run("form.value = newForm('parttime'); form.value.petStatus = 'yes'; form.value.petImages = ['/profile/upload/p.jpg']")
  const p = plain(h.run('publishExtras(form.value)'))
  assert.deepEqual([p.petStatus, p.petImages], ['', []])
})

// ---------------------------------------------------------------- R4 住宿照片、视频

test('R4 住宿照片或视频：包住才带；最多 9 张 1 段；不包住时照片留着但不提交，切回来还在', async (t) => {
  const h = await open(t, 'parttime')
  assert.match(h.template, /<view v-if="housing" class="fc-field">\s*<view class="fc-label"><text class="fc-label__t">住宿照片或视频<\/text><text class="fc-count">照片 \{\{ form\.lodgingImages\.length \}\}\/\{\{ PHOTO_MAX \}\} · 视频 \{\{ form\.lodgingVideo \? 1 : 0 \}\}\/1<\/text>/)
  h.run("form.value.lodgingImages = ['/profile/upload/l1.jpg']; form.value.lodgingVideo = '/profile/upload/videos/x.mp4'; form.value.lodgingVideoCover = '/profile/upload/c.jpg'")
  const on = plain(h.run('publishExtras(form.value)'))
  assert.deepEqual([on.lodgingImages, on.lodgingVideo, on.lodgingVideoCover], [['/profile/upload/l1.jpg'], '/profile/upload/videos/x.mp4', '/profile/upload/c.jpg'])
  h.run("setBoard('meal')")
  const off = plain(h.run('publishExtras(form.value)'))
  assert.deepEqual([off.lodgingImages, off.lodgingVideo, off.lodgingVideoCover], [[], '', ''], '不包住传空，服务端才清')
  assert.equal(h.run('form.value.lodgingImages.length'), 1, '传一次不容易，切回来还在')
  h.run("setBoard('room')")
  assert.equal(plain(h.run('publishExtras(form.value)')).lodgingImages.length, 1)
  // 没视频时不带封面
  h.run("form.value.lodgingVideo = ''")
  assert.equal(plain(h.run('publishExtras(form.value)')).lodgingVideoCover, '')
  // 换工一律算包住
  h.run("form.value = newForm('volunteer'); form.value.lodgingImages = ['/profile/upload/l1.jpg']")
  assert.equal(plain(h.run('publishExtras(form.value)')).lodgingImages.length, 1)
})

test('R4 视频：沿用小院视频规则（kind=intro：3 分钟、100MB），提示写「住宿视频」；传完写回，能看能换能删；传失败说原因；传的时候不能提交', async (t) => {
  const h = await open(t, 'volunteer')
  fillRequired(h)
  await h.run('addLodgingVideo(form.value)')
  assert.deepEqual(plain(h.log.videoOpts.at(-1)), { intro: true, label: '住宿视频' })
  assert.equal(h.run('form.value.lodgingVideo'), '/profile/upload/videos/x.mp4')
  assert.equal(h.run('form.value.lodgingVideoCover'), '/profile/upload/c.jpg')
  assert.equal(h.run('videoUploading.value'), false)
  // 点格子：看、换、删
  h.sandbox.sheet = async (opts) => { h.log.sheets.push([...opts]); return 0 }
  await h.run('lodgingVideoActions(form.value)')
  assert.deepEqual(h.log.sheets.at(-1), ['看视频', '换一段', '删掉视频'])
  assert.deepEqual(h.log.played.at(-1), ['https://api.test/profile/upload/videos/x.mp4', 'https://api.test/profile/upload/c.jpg'])
  h.sandbox.sheet = async () => 2
  await h.run('lodgingVideoActions(form.value)')
  assert.deepEqual([h.run('form.value.lodgingVideo'), h.run('form.value.lodgingVideoCover')], ['', ''])
  // 取消选择：什么都不变
  h.ctl.videoResult = null
  await h.run('addLodgingVideo(form.value)')
  assert.equal(h.run('form.value.lodgingVideo'), '')
  // 失败：说原因
  h.ctl.videoError = new Error('住宿视频不能超过 3 分钟，请剪短后再传')
  await h.run('addLodgingVideo(form.value)')
  assert.equal(h.log.toasts.at(-1), '住宿视频不能超过 3 分钟，请剪短后再传')
  assert.equal(h.run('videoUploading.value'), false)
  // 传的时候不能提交（submitJob 第一道）
  h.run('videoUploading.value = true')
  await h.run('submitJob()')
  assert.equal(h.log.toasts.at(-1), '视频还在上传，请稍等')
  assert.equal(h.log.created.length, 0)
})

test('R4 视频：选文件没回来不算上传中（网页版在选文件框里点取消没有任何回调，不能从此点不动、提交不了）；真传的时候才挡', async (t) => {
  const h = await open(t, 'volunteer')
  fillRequired(h)
  h.sandbox.chooseAndUploadVideo = () => new Promise(() => {})
  h.run('addLodgingVideo(form.value)')
  await flush()
  assert.equal(h.run('videoUploading.value'), false)
  await h.run('submitJob()')
  assert.equal(h.log.created.length, 1, '提交没被挡')
  // 选好了开始传：这时才算上传中，传完放开
  let during = null
  const b = await open(t, 'volunteer')
  b.sandbox.chooseAndUploadVideo = async (onProgress, deps) => { await deps.upload({}, onProgress); during = b.run('videoUploading.value'); return { url: '/profile/upload/videos/y.mp4', cover: '' } }
  await b.run('addLodgingVideo(form.value)')
  assert.equal(during, true)
  assert.equal(b.run('videoUploading.value'), false)
  assert.equal(b.run('form.value.lodgingVideo'), '/profile/upload/videos/y.mp4')
})

test('R4 视频工具：videoProblem 的提示能换名字，默认还是小院视频（rooms.vue 不受影响）；不进 common', () => {
  const long = { path: 'a.mp4', size: 10, duration: 200 }
  assert.equal(video.videoProblem(long, true), '小院视频不能超过 3 分钟，请剪短后再传')
  assert.equal(video.videoProblem(long, true, '住宿视频'), '住宿视频不能超过 3 分钟，请剪短后再传')
  assert.match(src('pages/staff/jobs.vue'), /from '\.\/stay-video\.js'/)
  assert.ok(!fs.existsSync(path.join(APP, 'common/stay-video.js')))
})

test('提交：七个键按约定的名字带上，老键一个不少', async (t) => {
  const h = await open(t, 'volunteer')
  fillRequired(h)
  h.run(`setBoard('room'); Object.assign(form.value, { mealAllowance: '30', mealAllowanceUnit: 'month', petStatus: 'yes', petImages: ['/profile/upload/p.jpg'], lodgingImages: ['/profile/upload/l.jpg'], lodgingVideo: '/profile/upload/videos/x.mp4', lodgingVideoCover: '/profile/upload/c.jpg', roomType: 'double' })`)
  await h.run('submitJob()')
  const p = h.log.created.at(-1)
  assert.deepEqual([p.mealAllowance, p.mealAllowanceUnit, p.petStatus, p.petImages, p.lodgingImages, p.lodgingVideo, p.lodgingVideoCover],
    ['30', 'month', 'yes', ['/profile/upload/p.jpg'], ['/profile/upload/l.jpg'], '/profile/upload/videos/x.mp4', '/profile/upload/c.jpg'])
  for (const k of ['title', 'work', 'hope', 'images', 'boardType', 'boardDesc', 'dailyHours', 'shiftTime', 'settleDesc', 'probation', 'trainDesc', 'category', 'genderPref', 'restMode', 'roomType', 'minDays', 'salaryType', 'salary', 'bonusEnabled', 'commissionEnabled', 'insuranceFlag', 'monthRedpacket', 'keywords']) assert.ok(k in p, k)
  // 线上任务不带这七个键
  assert.ok(!('mealAllowance' in plain(h.run("publishExtras({ jobType: 'online' })"))))
})

// ---------------------------------------------------------------- 回填

test('回填：draftJobForm 带回七个键；老服务端没这些字段时不报错；不收口（库里的原值）', () => {
  const base = { jobType: 'volunteer', headcount: 2, salaryType: 'daily', mealAllowance: '', mealAllowanceUnit: 'day', petStatus: '', petImages: [], lodgingImages: [], lodgingVideo: '', lodgingVideoCover: '' }
  const full = view.draftJobForm({ jobType: 'volunteer', boardType: 'all', mealAllowance: '15', mealAllowanceUnit: 'month', petStatus: 'yes', petImages: ['/p.jpg', ''], lodgingImages: ['/l.jpg'], lodgingVideo: '/v.mp4', lodgingVideoCover: '/c.jpg' }, base).form
  assert.deepEqual([full.mealAllowance, full.mealAllowanceUnit, full.petStatus, full.petImages, full.lodgingImages, full.lodgingVideo, full.lodgingVideoCover], ['15', 'month', 'yes', ['/p.jpg'], ['/l.jpg'], '/v.mp4', '/c.jpg'])
  const old = view.draftJobForm({ jobType: 'parttime', boardType: 'none' }, base).form
  assert.deepEqual([old.mealAllowance, old.mealAllowanceUnit, old.petStatus, old.petImages, old.lodgingImages, old.lodgingVideo, old.lodgingVideoCover], ['', 'day', '', [], [], '', ''])
  // 老工时原样带回
  assert.equal(view.draftJobForm({ jobType: 'volunteer', dailyHours: '弹性时间' }, base).form.dailyHours, '弹性时间')
})

// ---------------------------------------------------------------- R7 折叠

test('更多选填：新发布收起；项数按当前能见到的算（不包食宿少 1）；摘要按类型写；填了写已填几项', async (t) => {
  const h = await open(t, 'volunteer')
  assert.equal(h.run('moreOpen.value'), false)
  // 2026-11-03 加了「性格」：每类各多 1 项；同一天改版把住宿照片视频（包住才有）、宠物（只给换工）也收进折叠区
  assert.equal(h.run('moreCount.value'), 14, '招募性别已移到必填信息，不计入更多选填')
  assert.match(h.run('moreSummary.value'), /^住宿照片、宠物、年龄、性格、技能、红包、奖金、保险等$/)
  assert.equal(h.run('moreFilled.value'), 0)
  h.run("form.value.age = '18–30岁'; form.value.monthRedpacket = true; setGen('hope', '能待满')")
  assert.equal(h.run('moreFilled.value'), 3)
  h.run("form.value.lodgingVideo = '/profile/upload/videos/x.mp4'; form.value.petStatus = 'none'")
  assert.equal(h.run('moreFilled.value'), 5, '住宿视频、宠物也算')
  h.run("form.value = newForm('parttime'); gen.value = {}")
  assert.equal(h.run('moreCount.value'), 12)
  assert.match(h.run('moreSummary.value'), /提成/)
  h.run("setBoard('none')")
  assert.equal(h.run('moreCount.value'), 10, '不包食宿没有食宿说明、住宿照片')
  h.run("form.value = newForm('fulltime')")
  assert.equal(h.run('moreCount.value'), 14)
  assert.match(h.run('moreSummary.value'), /试用期、培训/)
  // 模板：折叠内容用 v-if；头上一直写项数；收起时才写摘要或要补什么
  assert.match(h.template, /<view v-if="moreOpen">/)
  assert.match(h.template, /更多设置<text class="fc-more__n">（选填，\{\{ moreCount \}\} 项\{\{ moreFilled \? '，已填 ' \+ moreFilled \+ ' 项' : '' \}\}）<\/text>/)
  assert.match(h.template, /<text v-if="!moreOpen && foldErrText" class="fc-more__sum fc-more__sum--err">\{\{ foldErrText \}\}<\/text><text v-else-if="!moreOpen" class="fc-more__sum">\{\{ moreSummary \}\}<\/text>/)
})

test('更多选填：完善商家岗位时里面有内容就默认展开，没内容就收起；新发布回到收起', async (t) => {
  const row = { jobId: 321, title: '岗位', jobType: 'volunteer', status: 'draft', canPublish: true }
  const filled = jobsHarness({ rows: [row], detail: { canEdit: true, job: { jobType: 'volunteer', title: '岗位', requirement: '年龄：18–30岁', boardType: 'all' } }, picks: ['完善岗位信息'] })
  t.after(filled.stop)
  await filled.load()
  await filled.run('jobActions(jobList.value[0])')
  await flush()
  assert.equal(filled.run('moreOpen.value'), true)
  filled.run("startPublish(); choosePublish('volunteer')")
  assert.equal(filled.run('moreOpen.value'), false)
  const empty = jobsHarness({ rows: [row], detail: { canEdit: true, job: { jobType: 'volunteer', title: '岗位', boardType: 'all', insuranceFlag: '1', monthRedpacket: '1' } }, picks: ['完善岗位信息'] })
  t.after(empty.stop)
  await empty.load()
  await empty.run('jobActions(jobList.value[0])')
  await flush()
  assert.equal(empty.run('moreOpen.value'), false)
})

test('报错不藏住：折叠区有错自动展开，等一下再滚到第一个错；不在折叠区的不用等；收起时头上写还差什么；操作条点了走同一段', async (t) => {
  const h = await open(t, 'volunteer')
  fillRequired(h)
  h.run("form.value.bonusEnabled = true")
  assert.equal(h.run('moreOpen.value'), false)
  await h.run('submitJob()')
  assert.equal(h.log.created.length, 0)
  assert.equal(h.run('moreOpen.value'), true, '自动展开')
  assert.equal(h.log.toasts.at(-1), '请写清奖金怎么算，或关掉「奖金」')
  assert.equal(h.log.scrolls.filter(o => o.selector).length, 0, '节点还没出来，先不滚')
  await wait(100)
  assert.equal(h.log.scrolls.at(-1).selector, '#pf-bonus')
  // 又手动收起：头上写红字
  h.run('moreOpen.value = false')
  assert.equal(h.run('foldErrText.value'), '有 1 项要补：奖金')
  h.run("form.value.commissionEnabled = true")
  assert.equal(h.run('foldErrText.value'), '有 2 项要补：奖金、提成')
  // 操作条上面一行（2026-11-03 起一直写着还差什么，点过提交才变红）点了走同一段：再次展开、滚过去
  assert.match(h.template, /<view class="fc-bar__todo" :class="\{ 'fc-bar__todo--err': errCount, 'fc-bar__todo--ok': !todoKeys\.length \}" hover-class="k-press" @click="showTodo"><text>\{\{ todoText \}\}<\/text><\/view>/)
  assert.equal(h.run('todoText.value'), '还差：奖金说明、提成说明（点这里去填）')
  h.run('showTodo()')
  assert.equal(h.run('moreOpen.value'), true)
  await wait(100)
  assert.equal(h.log.scrolls.at(-1).selector, '#pf-bonus')
  // 折叠区开着、错不在折叠区：立刻滚
  const a = await open(t, 'parttime')
  await a.run('submitJob()')
  assert.equal(a.log.scrolls.at(-1).selector, '#pf-title')
  assert.equal(a.run('moreOpen.value'), false, '折叠区没错不展开')
  // 补贴（换工）在折叠区，薪资（兼职）在外面
  assert.deepEqual(plain(a.run("foldKeys({ jobType: 'parttime' })")), ['hope', 'bonus', 'commission'])
  assert.deepEqual(plain(a.run("foldKeys({ jobType: 'volunteer' })")), ['hope', 'salary', 'bonus', 'commission'])
})

test('第一个错按页面从上到下：工作内容、薪资、餐补在前，其他要求（折叠）在后；换工的补贴在其他要求后面', async (t) => {
  const h = await open(t, 'parttime')
  // 2026-11-03 改版：到岗日期挪到「时间和待遇」，排在工作内容、薪资后面
  assert.deepEqual(plain(h.run('ERR_ORDER')), ['title', 'images', 'address', 'work', 'salary', 'startDate', 'meal', 'hope', 'bonus', 'commission'])
  assert.deepEqual(plain(h.run("errOrder({ jobType: 'volunteer' })")).slice(3), ['work', 'startDate', 'genderCounts', 'meal', 'hope', 'salary', 'bonus', 'commission'])
  h.run("setGen('title', 't'); form.value.images = ['" + PHOTO + "']; setGen('hope', '很长'.repeat(150))")
  await h.run('submitJob()')
  assert.equal(h.log.toasts.at(-1), '请写几句工作内容：用户最想知道每天做什么', '工作内容排在其他要求前面')
})

test('滚到字段：停在吸顶顶栏下面（状态栏 + 44 + 12）；读不到状态栏用 72', async (t) => {
  const h = await open(t, 'parttime', { statusBarHeight: 44 })
  h.run("scrollToField('title')")
  assert.deepEqual(plain(h.log.scrolls.at(-1)), { selector: '#pf-title', duration: 200, offsetTop: -100 })
  const d = await open(t, 'parttime')
  d.run("scrollToField('title')")
  assert.equal(d.log.scrolls.at(-1).offsetTop, -72)
})

// ---------------------------------------------------------------- R7 底部弹层（页面这边）

test('底部弹层：每一项的配置；confirm 写回 form；取消不改；系统返回先收弹层；切屏收起', async (t) => {
  const h = await open(t, 'volunteer')
  const conf = (k) => { h.run(`openSheet('${k}')`); return plain(h.run('sheetConf.value')) }
  const kind = conf('workKind')
  assert.equal(kind.title, '换工类型')
  assert.equal(kind.emptyLabel, '不选')
  assert.deepEqual(kind.options[0], { label: '日常换工', value: 'daily', desc: '前台、接待' })
  h.run("confirmSheet('daily')")
  assert.equal(h.run('form.value.workKind'), 'daily')
  assert.equal(h.run('sheetKey.value'), '')
  assert.equal(h.run('workKindLabel.value'), '日常换工')
  assert.equal(conf('minDays').title, '最短期限（至少待多久）')
  h.run('confirmSheet(15)')
  assert.equal(h.run('form.value.minDays'), 15)
  assert.equal(h.run('minDaysLabel.value'), '半个月')
  h.run('form.value.minDays = 10')
  assert.equal(h.run('minDaysLabel.value'), '10 天', '老岗位不在这几档的照实写')
  assert.equal(conf('restMode').options.length, 7)
  assert.equal(h.run('sheetConf.value.emptyLabel'), '不选')
  h.run("confirmSheet('5-2')")
  assert.equal(h.run('restLabel.value'), '做五休二')
  assert.equal(conf('age').options.length, 6)
  h.run("sheetKey.value = ''")
  const kw = conf('keywords')
  assert.deepEqual([kw.multiple, kw.max, kw.customLabel, kw.customMax], [true, 4, '＋ 自己写一个', 8])
  h.run("confirmSheet(['接待', '摄影'])")
  assert.deepEqual(plain(h.run('form.value.keywords')), ['接待', '摄影'])
  // 取消：模板里 sheetKey = ''，值不动
  assert.match(h.template, /@confirm="confirmSheet" @cancel="sheetKey = ''"/)
  // 系统返回先收弹层，不退出表单
  h.run("openSheet('age')")
  await h.run('backFromPublish()')
  assert.equal(h.run('sheetKey.value'), '')
  assert.equal(h.run('formOpen.value'), true)
  // 切屏收起
  h.run("openSheet('age'); s.value = 1")
  await flush()
  assert.equal(h.run('sheetKey.value'), '')
  // 全职的门店类型；日期显示
  const f = await open(t, 'fulltime')
  f.run("openSheet('category')")
  assert.deepEqual(plain(f.run('sheetConf.value')).options.map(o => o.label), ['民宿', '酒店', '咖啡餐饮', '酒吧', '其他'])
  f.run("form.value.startDate = '2026-11-08'")
  assert.equal(f.run('startDateText.value'), '2026年11月8日')
  assert.equal(f.run('form.value.startDate'), '2026-11-08', '存的还是 yyyy-MM-dd')
  assert.ok(CAT.length === 5)
})

test('弹层开着锁背景：小程序 page-meta 带上 sheetKey、extrasSheet；H5 走 listSheetOpen', () => {
  const page = src('pages/staff/jobs.vue')
  assert.match(page, /<page-meta :page-style="\(s === 2 && \(startCalendar \|\| sheetKey\)\) \|\| \(s === 1 && \(condSheet \|\| photoSheet \|\| extrasSheet\)\) \? 'overflow: hidden' : ''" \/>/)
  assert.match(page, /const listSheetOpen = \(\) => \(\(!!condSheet\.value \|\| !!photoSheet\.value \|\| !!extrasSheet\.value\) && s\.value === 1\) \|\| \(!!sheetKey\.value && s\.value === 2\)/)
})

// ---------------------------------------------------------------- fc-sheet 组件

function sheetHarness(props) {
  const out = { confirm: [], cancel: 0, toasts: [] }
  const full = { title: 't', options: [], value: '', multiple: false, max: 0, emptyLabel: '', customLabel: '', customTitle: '', customHint: '', customMax: 32, ...props }
  const h = runSetup('pages/staff/components/fc-sheet.vue', {
    defineOptions() {}, defineProps: () => full,
    defineEmits: () => (name, v) => { if (name === 'confirm') out.confirm.push(plain(v === undefined ? null : v)); else out.cancel++ },
    toast: (m) => out.toasts.push(m), prompt: async () => out.typed ?? null
  })
  return { ...h, out }
}

test('fc-sheet 单选：第一行「不选」，当前项打勾；点一项就 confirm；null、空串算同一个空；数字和字符串按文字比', (t) => {
  const h = sheetHarness({ emptyLabel: '不选', value: 'b', options: [{ label: 'A', value: 'a', desc: '说明' }, { label: 'B', value: 'b' }] })
  t.after(h.stop)
  const rows = plain(h.run('rows.value'))
  assert.deepEqual(rows.map(r => [r.label, r.on]), [['不选', false], ['A', false], ['B', true]])
  assert.equal(rows[1].desc, '说明')
  h.run('tap(rows.value[0])')
  assert.deepEqual(h.out.confirm.at(-1), '')
  h.run('tap(rows.value[1])')
  assert.deepEqual(h.out.confirm.at(-1), 'a')
  // 最短期限：不限 = null、一周 = 7
  const m = sheetHarness({ value: null, options: [{ label: '不限', value: null }, { label: '一周', value: 7 }] })
  t.after(m.stop)
  assert.deepEqual(plain(m.run('rows.value')).map(r => r.on), [true, false])
  const m7 = sheetHarness({ value: 7, options: [{ label: '不限', value: null }, { label: '一周', value: 7 }] })
  t.after(m7.stop)
  assert.deepEqual(plain(m7.run('rows.value')).map(r => r.on), [false, true])
  m7.run('tap(rows.value[0])')
  assert.equal(m7.out.confirm.at(-1), null)
})

test('fc-sheet 多选：对勾随点随变，点确定才 confirm 一个新数组；超上限提示；不在清单里的（自己写过的）也列出来；不改传进来的数组', (t) => {
  const value = ['接待', '手写的']
  const h = sheetHarness({ multiple: true, max: 3, value, options: [{ label: '咖啡', value: '咖啡' }, { label: '接待', value: '接待' }] })
  t.after(h.stop)
  assert.deepEqual(plain(h.run('rows.value')).map(r => [r.label, r.on]), [['咖啡', false], ['接待', true], ['手写的', true]])
  assert.equal(h.run('okLabel.value'), '确定（已选 2 个，最多 3 个）')
  h.run('tap(rows.value[0])')
  assert.equal(h.run('okLabel.value'), '确定（已选 3 个，最多 3 个）')
  assert.equal(h.out.confirm.length, 0, '点选项不触发 confirm')
  h.run('tap(rows.value[1]); tap(rows.value[1])')
  assert.equal(h.run('picks.value.length'), 3)
  h.run('tap({ value: "第四个" })')
  assert.equal(h.out.toasts.at(-1), '最多选 3 个')
  h.run('done()')
  assert.deepEqual(h.out.confirm.at(-1), ['手写的', '咖啡', '接待'])
  assert.deepEqual(value, ['接待', '手写的'], '取消时不影响表单')
})

test('fc-sheet 自己写：多选加进已选；单选直接 confirm；超长截断；取消、空白什么都不做；满了不问', async (t) => {
  const h = sheetHarness({ multiple: true, max: 2, value: [], customLabel: '＋ 自己写一个', customMax: 4 })
  t.after(h.stop)
  h.out.typed = '  调酒师傅很长  '
  await h.run('addCustom()')
  assert.deepEqual(plain(h.run('picks.value')), ['调酒师傅'])
  h.out.typed = null
  await h.run('addCustom()')
  h.out.typed = '   '
  await h.run('addCustom()')
  assert.equal(h.run('picks.value.length'), 1)
  h.out.typed = '咖啡'
  await h.run('addCustom()')
  assert.equal(h.run('picks.value.length'), 2)
  await h.run('addCustom()')
  assert.equal(h.out.toasts.at(-1), '最多选 2 个')
  const s = sheetHarness({ customLabel: '＋ 自己写一个', value: '约 3 小时', options: [{ label: '约 2 小时', value: '约 2 小时' }] })
  t.after(s.stop)
  assert.deepEqual(plain(s.run('rows.value')).map(r => [r.label, r.on]), [['约 2 小时', false], ['约 3 小时', true]], '自己写过的列出来、打勾')
  s.out.typed = '半天'
  await s.run('addCustom()')
  assert.equal(s.out.confirm.at(-1), '半天')
})

test('fc-sheet 模板和样式：遮罩、取消都不改；scroll-view 自己滚，遮罩、标题、确定拦 touchmove；减少动态只编进网页版', () => {
  const page = src('pages/staff/components/fc-sheet.vue')
  const d = compiler.parse(page).descriptor
  const tpl = d.template.content
  assert.match(tpl, /<view class="fc-sheet__mask" @click="emit\('cancel'\)" @touchmove\.stop\.prevent \/>/)
  assert.match(tpl, /<view class="fc-sheet__cancel" hover-class="k-press" @click="emit\('cancel'\)">/)
  assert.match(tpl, /<scroll-view scroll-y class="fc-sheet__list"/)
  assert.match(tpl, /<view class="fc-sheet__ok" hover-class="k-press-s" @click="done">/)
  assert.match(tpl, /color="#8A5E36"/)
  assert.doesNotMatch(tpl, /v-for="[a-z] /, 'v-for 别名不用单字母')
  const css = d.styles.map(x => x.content).join('\n')
  assert.match(css, /\.fc-sheet__opt \{[^}]*min-height: 56px;/)
  assert.match(css, /\.fc-sheet__panel \{[^}]*max-height: 76vh;/)
  assert.match(css, /animation: fc-sheet-up \.2s/)
  const at = css.indexOf('prefers-reduced-motion')
  assert.ok(css.lastIndexOf('#ifdef H5', at) > css.lastIndexOf('#endif', at), '微信 wxss 认不认没法核实，只编进网页版')
  // 不进主包
  assert.ok(!/fc-sheet|fc-kefu/.test(src('common/api.js')))
  assert.ok(!/fc-sheet|fc-kefu/.test(src('App.vue')))
})

// ---------------------------------------------------------------- 客服方块

test('填写屏不出浮动小钮，客服方块在操作条最左边；商家出、员工不出；小程序开微信客服，网页版去客服中心', () => {
  const jobs = src('pages/staff/jobs.vue')
  assert.match(jobs, /<k-topbar :title="formOpen \? [^"]*" back custom-back :fab="!formOpen \|\| !!submitted" @back="backFromPublish" \/>/)
  assert.match(jobs, /<view class="fc-bar__btns"><fc-kefu \/><view class="fc-btn" hover-class="k-press-s" @click="submitJob"><text>\{\{ merchantStaff \? '提交' : '提交审核' \}\}<\/text><\/view><\/view>/)
  assert.match(jobs, /import FcKefu from '\.\/components\/fc-kefu\.vue'/)
  const kefu = src('pages/staff/components/fc-kefu.vue')
  const mp = kefu.slice(kefu.indexOf('<!-- #ifdef MP-WEIXIN -->'), kefu.indexOf('<!-- #endif -->'))
  assert.match(mp, /<button v-if="show" class="fc-kefu" open-type="contact" :session-from="from" hover-class="k-press-s"/)
  assert.match(kefu, /<!-- #ifndef MP-WEIXIN -->\n\s*<view v-if="show" class="fc-kefu" hover-class="k-press-s"[^>]*@click="openSupport">/)
  assert.match(kefu, /const openSupport = \(\) => go\('\/pages\/notice\/support'\)/)
  assert.match(kefu, /import \{ fabVisible, fabSessionFrom \} from '@\/common\/support-fab\.js'/)
  const css = compiler.parse(kefu).descriptor.styles.map(x => x.content).join('\n')
  assert.match(css, /\.fc-kefu \{[^}]*flex: 0 0 48px;[^}]*width: 48px; height: 48px;[^}]*background: var\(--k-paper2\)/)
  assert.match(css, /\.fc-kefu__t \{ font-size: 13px;/)
  // 同一条规则
  const base = { route: 'pages/staff/jobs', restored: true, dark: false }
  assert.equal(fab.fabVisible({ ...base, mode: 'staff', roleCode: 'merchant' }), true)
  assert.equal(fab.fabVisible({ ...base, mode: 'staff', roleCode: 'keeper' }), false)
  assert.equal(fab.fabVisible({ ...base, mode: 'staff', roleCode: 'manager' }), false)
  assert.equal(fab.fabSessionFrom(9), '9|support-fab')
})

// ---------------------------------------------------------------- 住宿与宠物（已发岗位）

const ROW = { jobId: 15057, title: '平潭海岛体验官', jobType: 'volunteer', status: 'published', statusLabel: '招聘中', boardType: 'room', images: [] }
const EXTRAS = { jobId: 15057, jobType: 'volunteer', boardType: 'room', housing: true, mealShown: true, petShown: true, mealAllowance: '15.5', mealAllowanceUnit: 'month', petStatus: 'yes', petImages: ['/profile/upload/p.jpg'], lodgingImages: ['/profile/upload/l.jpg'], lodgingVideo: '', lodgingVideoCover: '' }

test('住宿与宠物 菜单：线下岗位有，把关和换照片一样（合作商家上架后没有）；线上、已关闭没有；招聘中收在「改地点 / 筛选条件 / 照片 / 住宿…」里', async (t) => {
  const h = jobsHarness({ rows: [ROW] })
  t.after(h.stop)
  await h.load()
  const menu = async (j) => { await h.run('jobActions(' + JSON.stringify(j) + ')'); return h.log.sheets.at(-1) }
  const live = plain(h.run('jobList.value[0]'))
  assert.ok((await menu(live)).includes('改地点 / 筛选条件 / 照片 / 住宿…'))
  assert.ok((await menu({ ...live, rawStatus: 'draft' })).includes('住宿与宠物'))
  assert.ok(!(await menu({ ...live, jobType: 'online' })).join().includes('住宿'))
  // 2026-11-03 主人：简化商家端——合作商家点卡片不再弹菜单（分享 / 暂停 / 恢复直接摆在卡片上），住宿与宠物由袋鼠工作人员补；待上架的只写一句去向
  const m = jobsHarness({ rows: [ROW], merchant: true })
  t.after(m.stop)
  await m.load()
  const row = plain(m.run('jobList.value[0]'))
  await m.run('jobActions(' + JSON.stringify(row) + ')')
  await m.run('jobActions(' + JSON.stringify({ ...row, rawStatus: 'draft' }) + ')')
  assert.equal(m.log.sheets.length, 0, '合作商家不弹菜单')
  assert.equal(m.log.toasts.at(-1), '袋鼠工作人员正在完善，上架后通知你')
})

test('住宿与宠物 弹层：GET 回填；PUT 只带看得到的键；没改不发请求；金额不对不发；保存后收起', async (t) => {
  const h = jobsHarness({ rows: [ROW], extras: EXTRAS })
  t.after(h.stop)
  await h.load()
  await h.run('openExtras(jobList.value[0])')
  assert.deepEqual(h.log.gets, ['/app/staff/jobs/15057/extras'])
  const c = plain(h.run('extrasSheet.value'))
  assert.deepEqual([c.jobId, c.title, c.mealShown, c.housing, c.petShown], [15057, '平潭海岛体验官', true, true, true])
  assert.deepEqual(c.draft.petImages, ['/profile/upload/p.jpg'])
  // 没改：直接收起
  await h.run('saveExtras()')
  assert.equal(h.log.puts.length, 0)
  assert.equal(h.run('extrasSheet.value'), null)
  // 改了：七个键
  await h.run('openExtras(jobList.value[0])')
  h.run("extrasSheet.value.draft.mealAllowance = 'abc'")
  assert.equal(h.run('extrasErr.value'), '餐补金额要是数字，最多两位小数')
  await h.run('saveExtras()')
  assert.equal(h.log.puts.length, 0, '金额不对不发')
  h.run("extrasSheet.value.draft.mealAllowance = '20'; extrasSheet.value.draft.mealAllowanceUnit = 'day'")
  await h.run('addLodgingVideo(extrasSheet.value.draft)')
  await h.run('saveExtras()')
  assert.deepEqual(h.log.puts.at(-1), ['/app/staff/jobs/15057/extras', { mealAllowance: '20', mealAllowanceUnit: 'day', lodgingImages: ['/profile/upload/l.jpg'], lodgingVideo: '/profile/upload/videos/x.mp4', lodgingVideoCover: '/profile/upload/c.jpg', petStatus: 'yes', petImages: ['/profile/upload/p.jpg'] }])
  assert.equal(h.run('extrasSheet.value'), null)
  assert.equal(h.log.toasts.at(-1), '已保存')
})

test('住宿与宠物 弹层：只有看得到的块才带键（全职不带宠物，不包吃才带餐补）；什么都不用补就不开；接口报错留着弹层', async (t) => {
  const h = jobsHarness({ rows: [{ ...ROW, jobType: 'fulltime' }], extras: { ...EXTRAS, jobType: 'fulltime', mealShown: false, petShown: false, housing: true, petStatus: '', petImages: [], mealAllowance: '' } })
  t.after(h.stop)
  await h.load()
  await h.run('openExtras(jobList.value[0])')
  h.run("extrasSheet.value.draft.lodgingImages.push('/profile/upload/l2.jpg')")
  await h.run('saveExtras()')
  assert.deepEqual(Object.keys(h.log.puts.at(-1)[1]), ['lodgingImages', 'lodgingVideo', 'lodgingVideoCover'])
  const none = jobsHarness({ rows: [{ ...ROW, jobType: 'parttime' }], extras: { housing: false, mealShown: false, petShown: false } })
  t.after(none.stop)
  await none.load()
  await none.run('openExtras(jobList.value[0])')
  assert.equal(none.run('extrasSheet.value'), null)
  assert.equal(none.log.toasts.at(-1), '这个岗位不包住也不用填餐补，没有要补的资料')
  const bad = jobsHarness({ rows: [ROW], extras: EXTRAS })
  t.after(bad.stop)
  await bad.load()
  await bad.run('openExtras(jobList.value[0])')
  bad.sandbox.put = async () => { throw new Error('岗位上架后不能自己改，请联系本城换工主理人') }
  bad.run("extrasSheet.value.draft.petStatus = 'none'")
  await bad.run('saveExtras()')
  assert.equal(bad.log.toasts.at(-1), '岗位上架后不能自己改，请联系本城换工主理人')
  assert.ok(bad.run('extrasSheet.value'), '弹层留着，能重试')
  assert.equal(bad.run('extrasSaving.value'), false)
  // 接口写在分包页面里，不进主包的 common/api.js
  assert.doesNotMatch(src('common/api.js'), /extras/)
})

// ---------------------------------------------------------------- 模板

test('模板里新用到的名字都定义了（10.28.4 的空白页就是这个问题）；能点的 view 都有 hover-class；字段一个不少；不写流程字', async (t) => {
  const h = await open(t, 'volunteer')
  for (const name of ['sheetConf', 'sheetKey', 'openSheet', 'confirmSheet', 'moreOpen', 'moreCount', 'moreFilled', 'moreSummary', 'foldErrText', 'revealFirstErr', 'legacyHours', 'pickDailyHours', 'mealShown', 'MEAL_UNITS', 'PET_OPTS', 'PET_MAX', 'setPet', 'filterNote', 'placeTyped', 'placeHint', 'placeText', 'startDateText', 'minDaysLabel', 'categoryLabel', 'restLabel', 'workKindLabel', 'VIDEO_NOTE', 'VIDEO_BUSY_NOTE', 'videoUploading', 'addLodgingVideo', 'removeLodgingVideo', 'lodgingVideoActions', 'extrasSheet', 'extrasErr', 'closeExtras', 'saveExtras', 'extrasSaving', 'photoActions', 'removePhoto', 'addPhotos', 'PHOTO_MAX', 'toggleSalary', 'toggleRedpacket', 'toggleInsurance', 'goInsurance', 'showCertification']) {
    assert.notEqual(h.run('typeof ' + name), 'undefined', name)
  }
  const tpl = h.template
  const form = tpl.slice(tpl.indexOf('class="fc-form"'), tpl.indexOf('<k-tabbar v-if="!formOpen || submitted"'))
  const extras = tpl.slice(tpl.indexOf('class="chip-pop cond-sheet extras-sheet"'), tpl.indexOf('<template v-else-if="s===2">'))
  const noHover = [...(form + extras).matchAll(/<view\b[^>]*@click[^>]*>/g)].map(m => m[0]).filter(x => !x.includes('hover-class') && !x.includes('chip-pop__mask'))
  assert.deepEqual(noHover, [])
  assert.doesNotMatch(form, /<text[^>]*hover-class/)
  assert.doesNotMatch(form, /v-for="[a-z] in form|\bl\b in /, 'v-for 别名不用单字母 l')
  for (const w of ['岗位标题', '岗位照片', '换工类型', '门店类型', '工作地点', '到岗日期', '最短期限', '招募人数', '工作内容', '每日工时', '休息排班', '薪资', '结算方式', '食宿', '餐补', '住宿条件', '住宿照片或视频', '店里有宠物吗', '宠物照片', '招募性别', '年龄', '技能 / 关键词', '其他要求', '上班时段', '食宿说明', '另有补贴', '试用期', '培训', '做满一个月有红包', '奖金', '提成', '为录用人员安排保险', '安心商家认证']) assert.ok(form.includes('>' + w + '<'), w)
  for (const id of ['pf-title', 'pf-images', 'pf-address', 'pf-startDate', 'pf-work', 'pf-salary', 'pf-meal', 'pf-hope', 'pf-bonus', 'pf-commission']) assert.ok(form.includes('id="' + id + '"'), id)
  assert.doesNotMatch(form, /提交 → |pub-bar|pub-chip|pub-sec|k-tabbar mode/)
  assert.match(tpl, /<k-tabbar v-if="!formOpen \|\| submitted" mode="staff" active="work" \/>/)
})

test('form-clean.scss：字号不小于 13，只用一种强调色，不用渐变，描边只给输入框；页面引用；小程序占位字不带 data-v', () => {
  const scss = src('pages/staff/form-clean.scss')
  const sizes = [...scss.matchAll(/font-size: (\d+)px/g)].map(m => Number(m[1]))
  assert.ok(sizes.length && Math.min(...sizes) >= 13, String(Math.min(...sizes)))
  assert.doesNotMatch(scss, /linear-gradient|box-shadow|--k-red\)|--k-red-soft/)
  assert.match(scss, /:global\(\.fc-ph\) \{/)
  assert.match(src('pages/staff/jobs.vue'), /@import '\.\/form-clean\.scss';/)
  assert.doesNotMatch(src('pages/staff/jobs.vue').slice(0, src('pages/staff/jobs.vue').indexOf('<script setup>')), /placeholder-class="pub-ph"/)
})

test('DESIGN.md 写了填写页这一段', () => {
  const md = src('DESIGN.md')
  assert.match(md, /### 填写页/)
  assert.match(md, /form-clean\.scss/)
})
