// 2026-11-03 主人看换宿详情（包 V67）：「加一个性格，横向排列」「年龄选择年龄段，在后台管理配置」「工作内容和时间改成相同的样式，文字都加粗不要有冒号」。
// 守住：详情页所有要求两列横排、标签加粗不写冒号，兼容无冒号的性格文案；工作时间和工作内容同一个页签头、正文加粗；
// 发布表单的年龄、性格从 /app/job/requirement-options 取（后台可配，取不到用默认），写成要求的前两行；完善商家岗位时拆回来。
// 沙盒和 job-extras-20261031.test.mjs 同一个（node --test，不需要构建、不发请求）。
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { createRequire } from 'node:module'
import test from 'node:test'
import assert from 'node:assert/strict'

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

const SP = await import(pathToFileURL(path.join(APP, 'pages/jobs/store-page.js')).href)
const NL = '\n'

// ---------------------------------------------------------------- 详情页：要求卡、工作内容 + 工作时间

test('labelRow：冒号前 1–6 个字拆成加粗标签，不写冒号；时间、带标点的不拆；已有 k 原样', () => {
  assert.deepEqual(SP.labelRow('年龄：18周岁以上'), { k: '年龄', v: '18周岁以上' })
  assert.deepEqual(SP.labelRow({ k: '', v: '前台: 接待客人' }), { k: '前台', v: '接待客人' })
  assert.deepEqual(SP.labelRow({ k: '性别', v: '男女不限' }), { k: '性别', v: '男女不限' })
  for (const keep of ['9:00 到岗', '早上9:30开门', '注意，周末：要早起', '有责任心', '帮客人办理入住：退房也要管的那种大事情：'])
    assert.equal(SP.labelRow(keep).k, '', keep)
  assert.deepEqual(SP.labelRow('9:00 到岗'), { k: '', v: '9:00 到岗' })
  // 工作内容：模板写的序号去掉，「休息安排：」拆成标签；小数不当序号
  assert.deepEqual(SP.workRow('4. 休息安排：做五休二。'), { k: '休息安排', v: '做五休二。' })
  assert.deepEqual(SP.workRow('2、打扫公共区域'), { k: '', v: '打扫公共区域' })
  assert.deepEqual(SP.workRow('1.5 小时接送'), { k: '', v: '1.5 小时接送' })
})

test('requirementLayout：全部要求保留填写顺序与完整内容，无冒号性格也识别标签', () => {
  const rows = [{ k: '性别', v: '男女不限' }, { k: '', v: '技能：拍摄、剪辑' }, { k: '', v: '性格：活泼开朗' }, { k: '', v: '年龄：18-30岁' }, { k: '', v: '能待满一个月' }]
  assert.deepEqual(SP.requirementLayout(rows), [
    { k: '性别', v: '男女不限' }, { k: '技能', v: '拍摄、剪辑' }, { k: '性格', v: '活泼开朗' },
    { k: '年龄', v: '18-30岁' }, { k: '', v: '能待满一个月' }
  ])
  // 长内容和重复标签均保留，不按字数分组或丢失条目。
  const long = SP.requirementLayout([{ k: '', v: '性格：活泼开朗、善于沟通、有责任心' }, { k: '', v: '年龄：18岁以上' }, { k: '', v: '年龄：18周岁以上' }])
  assert.deepEqual(long.map(r => r.k), ['性格', '年龄', '年龄'])
  assert.equal(long[0].v, '活泼开朗、善于沟通、有责任心')
  assert.deepEqual(SP.requirementLayout(['性格活泼开朗，近期到。', '性格 外向', '能友好交流沟通，能说会道', '性格：']), [
    { k: '性格', v: '活泼开朗，近期到。' }, { k: '性格', v: '外向' },
    { k: '', v: '能友好交流沟通，能说会道' }, { k: '', v: '性格：' }
  ])
  assert.deepEqual(SP.requirementLayout(null), [])
  assert.deepEqual(SP.workRow('性格活泼开朗'), { k: '', v: '性格活泼开朗' }, '只在要求区兼容旧性格文案')
})

test('详情模板：所有要求两列横排；标签后面不写冒号；工作时间和工作内容的样式保持一致', () => {
  const page = src('pages/jobs/detail.vue')
  const tpl = compiler.parse(page, { filename: 'detail.vue' }).descriptor.template.content
  assert.match(tpl, /v-for="\(row, ri\) in reqLayout" :key="ri" class="sp-bullet sp-req-cell"/)
  assert.match(tpl, /<text v-if="row.k" class="sp-bullet__k sp-req-k">\{\{ row\.k \}\}<\/text>\{\{ row\.v \}\}/)
  assert.doesNotMatch(tpl, /reqRow\(row\)\.k \}\}：|reqHalf/, '要求卡不再写冒号')
  assert.match(tpl, /<view class="sp-tab"><text>工作内容<\/text><\/view><view v-for="\(row, li\) in workRows"/)
  assert.match(tpl, /<view class="sp-tab sp-work__tab"><text>工作时间<\/text><\/view>/)
  assert.doesNotMatch(tpl, /sp-work__label/)
  assert.match(page, /const reqLayout = computed\(\(\) => requirementLayout\(sections\.value\.requirements\?\.rows\)\)/)
  assert.match(page, /const workRows = computed\(\(\) => \(sections\.value\.content \|\| \[\]\)\.map\(workRow\)\)/)
  // 要求统一两列；工作内容和时间正文加粗（换宿版式在 detail-volunteer-reference.scss 里）。
  assert.match(page, /\.sp-reqs \{ display: grid; grid-template-columns: repeat\(2, minmax\(0, 1fr\)\);/)
  const ref = src('pages/jobs/detail-volunteer-reference.scss')
  for (const sel of ['.sp-work__list .sp-bullet {', '.sp-work__list .sp-bullet--lead {', '.sp-work__hours {', '.sp-work__rest {', '.sp-work__note {']) {
    const line = ref.split(NL).find(l => l.trim().startsWith(sel))
    assert.ok(line && /font-weight: 700/.test(line), sel)
  }
  assert.match(ref, /\.sp-work__tab \{ flex: 0 0 100%; \}/)
})

// ---------------------------------------------------------------- 发布表单：年龄段、性格（V67 可配）

test('发布表单：年龄、性格写进要求的前两行；性格最多 3 个；「不限」不写', async (t) => {
  const h = await open(t, 'volunteer')
  h.run("form.value.age = '18-30岁'; form.value.personality = ['活泼开朗', '善于沟通']; form.value.keywords = ['拍摄']")
  assert.equal(h.run("requirementText(form.value, '能待满一个月')"), ['年龄：18-30岁', '性格：活泼开朗、善于沟通', '技能：拍摄', '能待满一个月'].join(NL))
  h.run("form.value.age = ''; form.value.personality = []")
  assert.equal(h.run("requirementText(form.value, '')"), '技能：拍摄')
  assert.deepEqual(plain(h.run("newForm('parttime').personality")), [])
  h.run("openSheet('personality')")
  const conf = plain(h.run('sheetConf.value'))
  assert.equal(conf.multiple, true)
  assert.equal(conf.max, 3)
  assert.deepEqual(conf.options.map(o => o.value), ['活泼开朗', '细心耐心', '善于沟通', '吃苦耐劳', '有责任心', '安静内向也欢迎'], '没取到服务端选项时用默认那组')
  assert.match(h.template, /@click="openSheet\('personality'\)"><text class="fc-row__k">性格<\/text>/)
})

test('年龄弹层：「不限」= 空；后台没配「不限」也给一行；老岗位手写的年龄列出来', async (t) => {
  const h = await open(t, 'volunteer')
  let conf = plain(h.run("ageSheet('')"))
  assert.equal(conf.emptyLabel, '', '选项里已有「不限」')
  assert.deepEqual(conf.options[0], { label: '不限', value: '' })
  h.run("reqOptions.value = { ages: ['18-25岁', '18-30岁'], personalities: ['爱干净'], personalityMax: 2 }")
  conf = plain(h.run("ageSheet('18周岁以上')"))
  assert.equal(conf.emptyLabel, '不限')
  assert.deepEqual(conf.options.map(o => o.value), ['18-25岁', '18-30岁', '18周岁以上'])
  assert.equal(conf.value, '18周岁以上')
  h.run("openSheet('personality')")
  assert.equal(h.run('sheetConf.value.max'), 2, '上限跟服务端')
})

test('选项从 /app/job/requirement-options 取一次；返回不对、接口不在都用默认那组', async (t) => {
  const h = await open(t, 'volunteer')
  // 这个沙盒的 get 对不认识的地址给岗位详情（没有 ages）：保持默认
  assert.ok(h.log.gets.includes('/app/job/requirement-options'))
  assert.deepEqual(plain(h.run('reqOptions.value.ages')), ['不限', '18-25岁', '18-30岁', '18-35岁', '18-40岁', '18岁以上'])
  h.sandbox.get = async (url) => { h.log.gets.push(url); return { data: { ages: [' 18-28岁 ', '', '不限'], personalities: ['爱干净'], personalityMax: 3 } } }
  await h.run('loadReqOptions()')
  assert.deepEqual(plain(h.run('reqOptions.value')), { ages: ['18-28岁', '不限'], personalities: ['爱干净'], personalityMax: 3 })
  const n = h.log.gets.length
  await h.run('loadReqOptions()')
  assert.equal(h.log.gets.length, n, '取到了就不再取')
})

test('完善商家岗位：性格行拆回表单（最多 3 个），「年龄：不限」按没写；提交时再合回去', () => {
  const base = { jobType: 'volunteer', headcount: 2, salaryType: 'daily', images: [], keywords: [], personality: [] }
  const { form, gen } = view.draftJobForm({ jobType: 'volunteer', tags: '', requirement: ['年龄：不限', '性格：活泼开朗、善于沟通，有责任心、细心耐心', '技能：拍摄', '能待满一个月'].join(NL) }, base)
  assert.equal(form.age, '')
  assert.deepEqual(form.personality, ['活泼开朗', '善于沟通', '有责任心'])
  assert.equal(gen.hope, '能待满一个月')
  assert.deepEqual(view.draftJobForm({ jobType: 'parttime', requirement: '会收银' }, base).form.personality, [])
})
