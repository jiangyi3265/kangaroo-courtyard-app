// 2026-11-03 招募表单预设模板、一键填写（node --test，不需要构建、不发请求）。
// 主人原话：「优化界面，现在操作太繁琐了看不懂，增加一个预设模板，一键填写，我只要改一部分就行」
// 守住这几件事：
//   · 每个模板填完，除了照片（和兼职、全职的薪资金额）不用再补任何项，提交出去的每一项都在表单和服务端的白名单 / 长度里；
//   · 模板只改文字和选项，岗位照片、工作地点、到岗日期、招募人数、住宿照片视频不动；换模板整组换；撤销只还原这次改的项；
//   · 后台停用的换工类型、不在选项里的年龄 / 性格不填；兼职、全职换了薪资类型就清掉金额；
//   · 「用上次的岗位」：这一类最近一个上架 / 暂停的岗位，照片和到岗日期不带，老详情的工时拼接（shiftDesc）不带；
//   · 完善商家岗位时不出模板；底部提交栏一直写着还差什么，点了标红并滚到第一项。
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
const tpls = await import(pathToFileURL(path.join(APP, 'pages/staff/job-templates.js')).href)
const plain = (v) => JSON.parse(JSON.stringify(v))
const flush = () => new Promise(resolve => setImmediate(resolve))

const JAVA = path.join(APP, '../RuoYi-Vue/ruoyi-kangaroo/src/main/java/com/ruoyi/kangaroo/domain')
const SQL = path.join(APP, '../RuoYi-Vue/sql/kangaroo')
const java = (f) => fs.readFileSync(path.join(JAVA, f), 'utf8')
// 服务端白名单：排班、房型（JobFilterFields）、门店类型（JobTabFilters）、换工类型种子（V37）、年龄和性格种子（V67）
const REST_CODES = [...java('JobFilterFields.java').matchAll(/\br\.put\("([^"]+)"/g)].map(m => m[1])
const ROOM_CODES = [...java('JobFilterFields.java').matchAll(/\bt\.put\("([^"]+)"/g)].map(m => m[1])
const CATEGORY_CODES = [...java('JobTabFilters.java').matchAll(/\bc\.put\("([^"]+)"/g)].map(m => m[1])
const v37 = fs.readFileSync(path.join(SQL, 'V37__points_notice_follow.sql'), 'utf8')
const KIND_CODES = [...v37.matchAll(/select \d+, '[^']+', '([a-z]+)', 'kg_volunteer_kind'/g)].map(m => m[1])
const v67 = fs.readFileSync(path.join(SQL, 'V67__job_requirement_options.sql'), 'utf8')
const SEED_AGES = [...v67.matchAll(/select \d+, '[^']+', '([^']+)', 'kg_job_age'/g)].map(m => m[1])
const SEED_PERSONALITIES = [...v67.matchAll(/select \d+, '[^']+', '([^']+)', 'kg_job_personality'/g)].map(m => m[1])

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
const PHOTO = '/profile/upload/2026/11/03/a.jpg'
const ALL_KINDS = KIND_CODES.map(v => ({ value: v, label: v, desc: '' }))

function jobsHarness({ rows = [], details = {}, kinds = ALL_KINDS, reqOptions, picks = [] } = {}) {
  const log = { created: [], puts: [], gets: [], toasts: [], scrolls: [], listQueries: [] }
  let onLoad = null
  const s = vue.ref(1)
  const queue = picks.slice()
  const h = runSetup('pages/staff/jobs.vue', {
    useScreen: (n, opts) => { onLoad = opts && opts.onLoad; return s },
    onShareAppMessage() {}, ensureSession: async () => {}, hasStaffAccess: { value: true }, merchantStaff: { value: false },
    currentStaffStoreId: () => 102, selectStaffStore: async () => {}, staffCan: () => true, absUrl: x => 'https://api.test' + x,
    todayCn: () => '2026-11-03', shiftDate: () => '2026-11-10', isYmd: (v) => /^\d{4}-\d{2}-\d{2}$/.test(String(v || '')),
    validateSalaryForm: salary.validateSalaryForm, salaryPayload: salary.salaryPayload, jobBenefits: salary.jobBenefits,
    parseSalaryAmount: salary.parseSalaryAmount, SALARY_OPTIONS: salary.SALARY_OPTIONS, salaryOption: salary.salaryOption,
    MERCHANT_JOBS_API: view.MERCHANT_JOBS_API, draftJobForm: view.draftJobForm,
    templatesOf: tpls.templatesOf, applyTemplate: tpls.applyTemplate, mergeLastJob: tpls.mergeLastJob, undoPatch: tpls.undoPatch,
    toast: (m) => log.toasts.push(m), go() {}, back() {}, errText: (e, d) => (e && e.message) || d, R,
    confirm: async () => true, alert: async () => {}, prompt: async () => null,
    sheet: async (opts) => (queue.length ? opts.indexOf(queue.shift()) : -1),
    apiStaffJobs: async (q) => { log.listQueries.push(plain(q)); return { data: { rows, canEdit: true, storeCert: true, storeAddress: '平潭海边' } } },
    apiStaffShareStats: async () => ({ data: {} }),
    apiStaffJobKeywords: async () => ({ data: ['咖啡', '接待', '拍摄'] }),
    apiJobKinds: async () => ({ data: kinds }),
    apiStaffCreateJob: async (storeId, payload) => { log.created.push(plain(payload)); return { msg: '已提交平台审核', data: { jobId: 777 } } },
    get: async (url) => {
      log.gets.push(url)
      if (url === '/app/job/requirement-options') { if (reqOptions) return { data: reqOptions }; throw new Error('404') }
      if (details[url]) return { data: details[url] }
      throw new Error('岗位不存在或已下架')
    },
    put: async (url, body) => { log.puts.push([url, plain(body)]); return { msg: '已保存', data: {} } },
    post: async () => ({ msg: 'ok' }),
    uni: { pageScrollTo: (o) => log.scrolls.push(o), showLoading() {}, hideLoading() {}, previewImage() {} }
  })
  return { ...h, s, log, load: async (q = {}) => { onLoad && onLoad(q); await flush(); await flush() } }
}
const open = async (t, kind, opts) => {
  const h = jobsHarness(opts)
  t.after(h.stop)
  await h.load()
  h.run(`startPublish(); choosePublish('${kind}')`)
  await flush()
  await flush()
  return h
}
const tplOf = (kind, key) => tpls.JOB_TEMPLATES[kind].find(x => x.key === key)

// ---------------------------------------------------------------- 模板本身

test('模板清单：换工 7 个（主人点名的几类都有），兼职、全职各 3 个；key、名字不重复；名字两行放得下', () => {
  assert.deepEqual(tpls.JOB_TEMPLATES.volunteer.map(x => x.name), ['前台接待换工', '民宿管家 / 客房换工', '摄影拍摄换工', '直播 / 短视频换工', '活动策划换工', '咖啡 / 吧台换工', '农场 / 户外换工'])
  assert.equal(tpls.JOB_TEMPLATES.parttime.length, 3)
  assert.equal(tpls.JOB_TEMPLATES.fulltime.length, 3)
  const all = Object.values(tpls.JOB_TEMPLATES).flat()
  assert.equal(new Set(all.map(x => x.key)).size, all.length)
  assert.ok(!all.some(x => x.key === 'last'), '「上次的岗位」占用 last')
  for (const x of all) {
    assert.ok(x.name.length <= 12 && x.sub && x.sub.length <= 12, x.name)
    assert.ok(x.fill.title && x.fill.work, x.name)
  }
  assert.deepEqual(tpls.templatesOf('online'), [])
})

test('每个模板都在服务端白名单和长度里：换工类型、排班、房型、门店类型、食宿、工时、年龄、性格、技能、文字长度', () => {
  assert.ok(REST_CODES.length === 7 && ROOM_CODES.length === 4 && CATEGORY_CODES.length === 5 && KIND_CODES.length === 6, '白名单都读到了')
  assert.ok(SEED_AGES.length && SEED_PERSONALITIES.length, 'V67 种子读到了')
  for (const [kind, list] of Object.entries(tpls.JOB_TEMPLATES)) {
    for (const { name, fill: f } of list) {
      const at = kind + ' / ' + name
      assert.ok(f.title.length >= 1 && f.title.length <= 30, at + ' 标题 1–30 字')
      assert.ok(f.work.length <= 300, at + ' 工作内容 300 字以内')
      assert.ok(f.work.split('\n').every(l => l.trim()), at + ' 一行一件事，没有空行')
      if (kind === 'volunteer') assert.ok(KIND_CODES.includes(f.workKind), at + ' 换工类型')
      else assert.equal(f.workKind, undefined, at)
      assert.ok(REST_CODES.includes(f.restMode), at + ' 排班')
      assert.ok([7, 15, 20, 30].includes(f.minDays), at + ' 最短期限是表单里的一档')
      assert.ok(['每天 2 小时', '每天 4 小时', '每天 6 小时', '每天 8 小时'].includes(f.dailyHours), at + ' 工时')
      assert.ok((kind === 'volunteer' ? ['all', 'room'] : ['all', 'room', 'meal', 'none']).includes(f.boardType), at + ' 食宿')
      const housing = kind === 'volunteer' || ['all', 'room'].includes(f.boardType)
      if (housing) assert.ok(ROOM_CODES.includes(f.roomType), at + ' 包住要写房型（不写用户按房型筛时看不到）')
      else assert.equal(f.roomType, '', at)
      assert.ok(SEED_AGES.includes(f.age) && f.age !== '不限', at + ' 年龄')
      assert.ok(f.personality.length >= 1 && f.personality.length <= 3 && f.personality.every(p => SEED_PERSONALITIES.includes(p)), at + ' 性格')
      assert.ok(f.keywords.length >= 1 && f.keywords.length <= 4 && f.keywords.every(k => k.length <= 8), at + ' 技能')
      assert.ok(String(f.shiftTime || '').length <= 32, at + ' 上班时段')
      assert.ok(String(f.boardDesc || '').length <= 60, at + ' 食宿说明')
      if (kind === 'volunteer') assert.ok(!f.salaryType && !f.settleDesc, at)
      else {
        assert.equal(f.salaryType, kind === 'parttime' ? 'daily' : 'monthly', at)
        assert.ok(['日结', '周结', '月结', '离店结算'].includes(f.settleDesc), at + ' 结算')
        assert.equal(f.salary, undefined, at + ' 不替门店写金额')
      }
      if (kind === 'fulltime') {
        assert.ok(CATEGORY_CODES.includes(f.category), at + ' 门店类型')
        assert.ok(['无试用期', '1个月', '2个月', '3个月'].includes(f.probation), at + ' 试用期')
        assert.ok(f.trainDesc.length <= 64, at + ' 培训')
      } else assert.ok(!f.category && !f.probation && !f.trainDesc, at)
    }
  }
})

test('每个模板一键填完：换工只差照片，兼职全职只差照片和薪资金额；补上就能提交，提交的每一项都合规', async (t) => {
  for (const [kind, list] of Object.entries(tpls.JOB_TEMPLATES)) {
    for (const tpl of list) {
      const at = kind + ' / ' + tpl.name
      const h = await open(t, kind)
      h.run(`useTemplate(${JSON.stringify(tpl)})`)
      assert.equal(h.log.toasts.at(-1), '已填好，改一改就能提交', at)
      const missing = kind === 'volunteer' ? ['images'] : ['images', 'salary']
      assert.deepEqual(plain(h.run('todoKeys.value')), missing, at)
      assert.equal(h.run('todoText.value'), '还差：' + (kind === 'volunteer' ? '岗位照片' : '岗位照片、薪资金额') + '（点这里去填）', at)
      assert.equal(h.run('filterNote.value'), '', at + ' 排班、房型都选了，用户按条件筛得到')
      h.run(`form.value.images = ['${PHOTO}']`)
      if (kind !== 'volunteer') h.run("form.value.salary = '150'")
      assert.equal(h.run('todoText.value'), '必填的都填好了，可以提交', at)
      await h.run('submitJob()')
      assert.equal(h.log.created.length, 1, at + ' 提交出去了')
      const p = h.log.created[0]
      assert.equal(p.jobType, kind)
      assert.equal(p.title, tpl.fill.title, at)
      assert.equal(p.work, tpl.fill.work, at)
      assert.ok(p.hope.length <= 300, at + ' 要求连同年龄、性格、技能 300 字以内')
      assert.match(p.hope, new RegExp('^年龄：' + tpl.fill.age + '\\n性格：' + tpl.fill.personality.join('、') + '\\n技能：'), at)
      assert.deepEqual(p.images, [PHOTO], at)
      assert.equal(p.startDate, '2026-11-10', at + ' 到岗日期没动')
      assert.equal(p.address, '', at + ' 工作地点没动（用门店地址）')
      assert.equal(p.workKind, kind === 'volunteer' ? tpl.fill.workKind : '', at)
      assert.equal(p.restMode, tpl.fill.restMode, at)
      assert.equal(p.roomType, tpl.fill.roomType, at)
      assert.equal(p.minDays, tpl.fill.minDays, at)
      assert.equal(p.boardType, tpl.fill.boardType, at)
      assert.equal(p.dailyHours, tpl.fill.dailyHours, at)
      assert.equal(p.settleDesc, tpl.fill.settleDesc || '', at)
      assert.equal(p.category, tpl.fill.category || '', at)
      assert.equal(p.probation, tpl.fill.probation || '', at)
      assert.equal(p.trainDesc, tpl.fill.trainDesc || '', at)
      assert.equal(p.mealAllowance, '', at)
      if (kind !== 'volunteer') {
        assert.equal(p.salaryEnabled, true, at)
        assert.equal(p.salaryType, tpl.fill.salaryType, at)
      } else assert.equal(p.salaryEnabled, false, at + ' 换工不开补贴')
      // 福利开关都不替门店打开
      assert.ok(!p.bonusEnabled && !p.commissionEnabled && !p.monthRedpacket && p.insuranceFlag === '1', at)
    }
  }
})

// ---------------------------------------------------------------- 填、换、撤销

test('模板只改文字和选项：照片、地点、到岗日期、人数、住宿视频、补贴不动；换一个模板整组换', async (t) => {
  const h = await open(t, 'volunteer')
  h.run(`form.value.images = ['${PHOTO}']; form.value.address = '南舍庄园'; form.value.latitude = 26.1; form.value.longitude = 119.2; form.value.startDate = '2026-12-01'; form.value.headcount = 5`)
  h.run("form.value.lodgingVideo = '/profile/upload/videos/v.mp4'; form.value.salaryEnabled = true; form.value.salary = '300'; setGen('title', '我写的标题')")
  h.run(`useTemplate(${JSON.stringify(tplOf('volunteer', 'front'))})`)
  const f = plain(h.run('form.value'))
  assert.deepEqual([f.images, f.address, f.latitude, f.longitude, f.startDate, f.headcount, f.lodgingVideo, f.salaryEnabled, f.salary], [[PHOTO], '南舍庄园', 26.1, 119.2, '2026-12-01', 5, '/profile/upload/videos/v.mp4', true, '300'])
  assert.equal(f.pay, 'salary')
  assert.equal(h.run('gen.value.title'), '民宿前台接待换工', '文字整段换掉（能撤销）')
  assert.equal(f.shiftTime, '早班或晚班，到店后商量')
  assert.equal(h.run('tplApplied.value.label'), '已按「前台接待换工」填好')
  assert.equal(h.run('tplOpen.value'), false, '填完收成一行')
  // 换一个：上一个模板写的上班时段也换掉（新模板没写就是空）
  h.run('tplOpen.value = true')
  h.run(`useTemplate(${JSON.stringify(tplOf('volunteer', 'photo'))})`)
  assert.equal(h.run('form.value.shiftTime'), '')
  assert.equal(h.run('form.value.workKind'), 'photo')
  assert.deepEqual(plain(h.run('form.value.keywords')), ['摄影', '修图'])
  assert.equal(h.run('tplApplied.value.key'), 'photo')
})

test('撤销：只还原这次改了的项；填完之后加的照片、改的地点留着', async (t) => {
  const h = await open(t, 'volunteer')
  h.run("setGen('work', '我自己写的'); form.value.restMode = '6-1'")
  const before = plain(h.run('form.value'))
  h.run(`useTemplate(${JSON.stringify(tplOf('volunteer', 'farm'))})`)
  h.run(`form.value.images.push('${PHOTO}'); form.value.address = '后来选的地点'`)
  h.run('undoTemplate()')
  const f = plain(h.run('form.value'))
  assert.equal(h.run('gen.value.work'), '我自己写的')
  assert.equal(h.run('gen.value.title'), '')
  assert.equal(f.restMode, '6-1')
  for (const k of ['workKind', 'minDays', 'roomType', 'age', 'personality', 'keywords', 'shiftTime']) assert.deepEqual(f[k], before[k], k)
  assert.deepEqual(f.images, [PHOTO])
  assert.equal(f.address, '后来选的地点')
  assert.equal(h.run('tplApplied.value'), null)
  assert.equal(h.run('tplOpen.value'), true)
})

test('后台停用的换工类型、不在选项里的年龄和性格不填；兼职换了薪资类型清掉金额，同类型留着', async (t) => {
  const h = await open(t, 'volunteer', { kinds: [{ value: 'daily', label: '日常换工' }], reqOptions: { ages: ['不限', '18-30岁'], personalities: ['善于沟通', '有责任心'], personalityMax: 1 } })
  await flush()
  h.run("form.value.workKind = 'daily'")
  h.run(`useTemplate(${JSON.stringify(tplOf('volunteer', 'live'))})`)
  assert.equal(h.run('form.value.workKind'), 'daily', '直播换工停用了：留着门店自己选的')
  assert.equal(h.run('form.value.age'), '18-30岁')
  assert.deepEqual(plain(h.run('form.value.personality')), ['善于沟通'], '只留选项里有的，最多 personalityMax 个')
  h.run(`useTemplate(${JSON.stringify(tplOf('volunteer', 'front'))})`)
  assert.equal(h.run('form.value.age'), '', '18-35岁 不在选项里')

  const p = await open(t, 'fulltime')
  p.run("form.value.salary = '6000'")
  p.run(`useTemplate(${JSON.stringify(tplOf('fulltime', 'ft-manager'))})`)
  assert.equal(p.run('form.value.salary'), '6000', '都是月薪：金额留着')
  p.run("form.value.salaryType = 'daily'; form.value.salary = '200'")
  p.run(`useTemplate(${JSON.stringify(tplOf('fulltime', 'ft-butler'))})`)
  assert.equal(p.run('form.value.salaryType'), 'monthly')
  assert.equal(p.run('form.value.salary'), '', '日薪换成月薪：金额清掉重填')
  // 兼职选了包吃（不包住）：没有房型，餐补跟着收口
  const q = await open(t, 'parttime')
  q.run("setBoard('none'); form.value.mealAllowance = '30'")
  q.run(`useTemplate(${JSON.stringify(tplOf('parttime', 'pt-coffee'))})`)
  assert.equal(q.run('form.value.boardType'), 'meal')
  assert.equal(q.run('form.value.mealAllowance'), '', '包吃了就没有餐补')
  assert.equal(q.run('housing.value'), false)
  assert.equal(q.run('form.value.pay'), 'salary')
})

// ---------------------------------------------------------------- 用上次的岗位

const LAST_DETAIL = {
  jobId: 55, jobType: 'volunteer', title: '上次的前台换工', content: '接待客人\n打扫前台', requirement: '年龄：18-30岁\n性格：细心耐心\n技能：接待\n能待满一个月',
  tags: ['接待'], workKind: 'daily', images: ['/profile/upload/old.jpg'], address: '老地方', latitude: 25.5, longitude: 119.5, startDate: '2026-09-01',
  minDays: 20, headcount: 3, genderPref: 'F', restMode: '4-3', roomType: 'double', shiftDesc: '每天 4 小时（9:00-13:00）', dailyHours: '每天 4 小时', shiftTime: '9:00-13:00',
  boardType: 'room', boardDesc: '包住宿', salaryType: 'none', salaryMin: null, settleDesc: '', bonusDesc: '', commissionDesc: '', insuranceFlag: '0', monthRedpacket: true,
  mealAllowance: '20', mealAllowanceUnit: 'day', petStatus: 'yes', petImages: ['/profile/upload/cat.jpg'], lodgingImages: ['/profile/upload/room.jpg'], lodgingVideo: '', lodgingVideoCover: ''
}
const LAST_ROWS = [
  { jobId: 60, jobType: 'volunteer', status: 'draft', title: '待审核的' },
  { jobId: 50, jobType: 'volunteer', status: 'published', title: '更早的' },
  { jobId: 55, jobType: 'volunteer', status: 'paused', title: '上次的前台换工' },
  { jobId: 70, jobType: 'parttime', status: 'published', title: '兼职' },
  { jobId: 80, jobType: 'volunteer', status: 'closed', title: '关了的' }
]

test('用上次的岗位：这一类最近一个上架 / 暂停的（草稿、关了的读不到详情不算）；没有就不出这张卡', async (t) => {
  const h = await open(t, 'volunteer', { rows: LAST_ROWS, details: { '/app/job/55': LAST_DETAIL } })
  assert.deepEqual(h.log.listQueries.at(-1), { storeId: 102, type: 'volunteer' })
  assert.deepEqual(plain(h.run('lastJob.value')), { jobId: 55, title: '上次的前台换工' })
  const f = await open(t, 'fulltime', { rows: LAST_ROWS })
  assert.equal(f.run('lastJob.value'), null)
  assert.equal(f.run('tplShown.value'), true, '模板照样有')
})

test('用上次的岗位：照片、到岗日期不带；地点没选过就用上次的；工时拼接不带；提交出去和上次一样', async (t) => {
  const h = await open(t, 'volunteer', { rows: LAST_ROWS, details: { '/app/job/55': LAST_DETAIL } })
  await h.run('useLastJob()')
  assert.ok(h.log.gets.includes('/app/job/55'))
  const f = plain(h.run('form.value'))
  assert.deepEqual(f.images, [], '岗位照片不带')
  assert.equal(f.startDate, '2026-11-10', '到岗日期是新的')
  assert.equal(f.address, '老地方')
  assert.equal(f.hours, undefined, '老详情的 shiftDesc 不带，改了工时才生效')
  assert.deepEqual([f.minDays, f.headcount, f.genderPref, f.restMode, f.roomType, f.boardType, f.age], [20, 3, 'F', '4-3', 'double', 'room', '18-30岁'])
  assert.deepEqual(f.personality, ['细心耐心'])
  assert.deepEqual(f.keywords, ['接待'])
  assert.deepEqual([f.monthRedpacket, f.insuranceFlag, f.mealAllowance], [true, '0', '20'])
  assert.deepEqual([f.lodgingImages, f.petStatus, f.petImages], [['/profile/upload/room.jpg'], 'yes', ['/profile/upload/cat.jpg']], '住宿照片、宠物是门店的，沿用')
  assert.deepEqual(plain(h.run('gen.value')), { title: '上次的前台换工', work: '接待客人\n打扫前台', hope: '能待满一个月' })
  assert.equal(h.run('tplApplied.value.label'), '已照上次的岗位「上次的前台换工」填好')
  assert.deepEqual(plain(h.run('todoKeys.value')), ['images'])
  h.run(`form.value.images = ['${PHOTO}']`)
  await h.run('submitJob()')
  const p = h.log.created[0]
  assert.equal(p.hope, '年龄：18-30岁\n性格：细心耐心\n技能：接待\n能待满一个月')
  assert.equal(p.hours, undefined)
  assert.deepEqual([p.monthRedpacket, p.workKind, p.address, p.latitude], [true, 'daily', '老地方', 25.5])
  // 自己选过地点、传过住宿照片的留着；上次的换工类型停用了不带
  const k = await open(t, 'volunteer', { rows: LAST_ROWS, details: { '/app/job/55': LAST_DETAIL }, kinds: [{ value: 'photo', label: '摄影' }] })
  k.run("form.value.address = '新地点'; form.value.latitude = 1.5; form.value.longitude = 2.5; form.value.lodgingImages = ['/profile/upload/new.jpg']")
  await k.run('useLastJob()')
  assert.deepEqual(plain(k.run('[form.value.address, form.value.latitude, form.value.longitude, form.value.lodgingImages, form.value.workKind]')), ['新地点', 1.5, 2.5, ['/profile/upload/new.jpg'], ''])
  // 撤销：回到填之前
  k.run('undoTemplate()')
  assert.deepEqual(plain(k.run('[gen.value.title, form.value.minDays, form.value.petStatus, form.value.address]')), ['', null, '', '新地点'])
})

test('用上次的岗位：读不到（刚下架）提示一句，表不动', async (t) => {
  const h = await open(t, 'volunteer', { rows: LAST_ROWS, details: {} })
  await h.run('useLastJob()')
  assert.equal(h.log.toasts.at(-1), '岗位不存在或已下架')
  assert.equal(h.run('tplApplied.value'), null)
  assert.equal(h.run('gen.value.title'), undefined)
})

// ---------------------------------------------------------------- 页面

test('完善商家岗位时不出模板，组标题不写第几步；新发布写第几步；提交成功、返回再开都回到模板展开', async (t) => {
  const row = { jobId: 321, title: '岗位', jobType: 'volunteer', status: 'draft', canPublish: true }
  const h = jobsHarness({ rows: [row], details: {}, picks: ['完善岗位信息'] })
  t.after(h.stop)
  h.sandbox.get = async (url) => (url === '/app/job/requirement-options' ? { data: {} } : { data: { canEdit: true, job: { jobType: 'volunteer', title: '岗位', boardType: 'all' } } })
  await h.load()
  await h.run('jobActions(jobList.value[0])')
  await flush()
  assert.ok(h.run('draftJob.value'))
  assert.equal(h.run('tplShown.value'), false)
  assert.deepEqual(plain(h.run('stepTitles.value')), ['必填信息', '时间和待遇'])
  h.run('leaveDraft(); startPublish(); choosePublish("volunteer")')
  assert.equal(h.run('tplShown.value'), true)
  assert.deepEqual(plain(h.run('stepTitles.value')), ['第 2 步 · 必填信息', '第 3 步 · 时间和待遇'])
  h.run(`useTemplate(${JSON.stringify(tplOf('volunteer', 'coffee'))})`)
  h.run(`form.value.images = ['${PHOTO}']`)
  await h.run('submitJob()')
  assert.equal(h.run('tplApplied.value'), null)
  assert.equal(h.run('tplOpen.value'), true)
})

test('底部提交栏一直写还差什么；点了才标红、滚到第一项；都填好了说一声', async (t) => {
  const h = await open(t, 'volunteer')
  assert.equal(h.run('todoText.value'), '还差：岗位标题、岗位照片、工作内容（点这里去填）')
  assert.equal(h.run('errCount.value'), 0, '没点之前不标红')
  h.run('showTodo()')
  assert.equal(h.run('tried.value'), true)
  assert.equal(h.log.scrolls.at(-1).selector, '#pf-title')
  assert.equal(h.log.toasts.at(-1), '请填写岗位标题')
  const p = await open(t, 'parttime')
  assert.equal(p.run('todoText.value'), '还差：岗位标题、岗位照片、工作内容、薪资金额（点这里去填）')
  p.run("form.value.salaryEnabled = true; form.value.jobType = 'volunteer'")
  assert.match(p.run('todoText.value'), /补贴金额/, '换工的叫补贴')
  // 模板：两个操作条都换成这一行；能点的都有按压反馈
  const tpl = h.template
  assert.equal([...tpl.matchAll(/<view class="fc-bar__todo" :class="\{ 'fc-bar__todo--err': errCount, 'fc-bar__todo--ok': !todoKeys\.length \}" hover-class="k-press" @click="showTodo"><text>\{\{ todoText \}\}<\/text><\/view>/g)].length, 2)
  assert.doesNotMatch(tpl, /fc-bar__err/)
  assert.match(tpl, /<view v-if="tplShown" class="fc-block">\s*<text class="fc-group__title">第 1 步 · 选个模板<\/text>/)
  assert.match(tpl, /<view v-for="tpl in tplList" :key="tpl\.key" class="tpl-card" :class="\{ on: tplApplied && tplApplied\.key === tpl\.key \}" hover-class="k-press-s" @click="useTemplate\(tpl\)">/)
  assert.match(tpl, /<view v-if="lastJob" class="tpl-card tpl-card--last"[^>]*hover-class="k-press-s" @click="useLastJob">/)
  assert.match(tpl, /@click="undoTemplate"><text>撤销<\/text>/)
  assert.match(tpl, /@click="tplOpen = true"><text>换一个<\/text>/)
  assert.match(tpl, /'帮我起草'/)
  const form = tpl.slice(tpl.indexOf('class="fc-form"'), tpl.indexOf('<k-tabbar v-if="!formOpen || submitted"'))
  assert.deepEqual([...form.matchAll(/<view\b[^>]*@click[^>]*>/g)].map(m => m[0]).filter(x => !x.includes('hover-class')), [])
  // 必填一组：标题、照片、地点、工作内容、薪资在「时间和待遇」前面；住宿照片、宠物收进更多设置
  const order = ['id="pf-title"', 'id="pf-images"', 'id="pf-address"', 'id="pf-work"', 'id="pf-salary"', '{{ stepTitles[1] }}', 'id="pf-startDate"', 'class="fc-more"', '>住宿照片或视频<', '>店里有宠物吗<']
  const at = order.map(x => form.indexOf(x))
  assert.ok(at.every(i => i > 0), JSON.stringify(at))
  assert.deepEqual(at.slice().sort((a, b) => a - b), at)
  // 样式守 form-clean 的规矩：字号不小于 13，不用渐变、阴影
  const css = h.styles.slice(h.styles.indexOf('2026-11-03 预设模板'))
  assert.ok(Math.min(...[...css.matchAll(/font-size:(\d+)px/g)].map(m => Number(m[1]))) >= 13)
  assert.doesNotMatch(css, /linear-gradient|box-shadow/)
  // 模板在 staff 分包里，不进主包
  assert.doesNotMatch(src('common/api.js'), /job-templates/)
  assert.match(src('pages/staff/jobs.vue'), /from '\.\/job-templates\.js'/)
})
