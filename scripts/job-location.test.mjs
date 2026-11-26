// 岗位工作地点（V42，10-15 主人拍板）的回归（node --test，不需要构建、不发请求）。跑的是页面真实的 script setup，接口一律换成假函数：
//   · 门店发布线下岗位：「工作地点」不选写「默认：门店地址 …」；小程序里「地图搜索选点」用 uni.chooseLocation（名字 + 地址拼成工作地点），
//     手填会清掉坐标，可以改回门店地址；网页版没有地图，只能手填；提交时 address / latitude / longitude 跟着表单一起发；
//   · 已发的线下岗位：有「岗位管理·编辑」权限的人在卡片菜单里「修改工作地点」，调 POST /app/staff/jobs/{id}/location（接口写在分包页面里，不进主包的 common/api.js）；
//     线上任务、已关闭的岗位、没有编辑权限的角色不出现这一项；
//   · 岗位详情：有坐标时「工作地点」整行可点、打开地图（所有人都能点；网页版没有地图 key，改成复制地址）；没坐标、坐标无效（0,0）、线上任务照旧只显示文字。
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'
import test from 'node:test'
import assert from 'node:assert/strict'
import * as genderPlan from '../common/job-gender.js'
import { placeMapUrl, openNativePlace } from '../common/place-navigation.js'

const APP = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const require = createRequire(path.join(APP, 'package.json'))
const compiler = require('@vue/compiler-sfc'), vue = require('vue')
const src = (rel) => fs.readFileSync(path.join(APP, rel), 'utf8').replace(/\r\n/g, '\n')
const flush = () => new Promise(resolve => setImmediate(resolve))

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

const STORE_ADDRESS = '福建省平潭县东湖山庄98号'

/** 员工端岗位页：记录弹过的菜单、提示、请求；sheetPick / promptValue / confirmValue / chooseResult 由各用例设定 */
function jobsHarness(platform = 'MP-WEIXIN', { storeLatitude = null, rows = [] } = {}) {
  const log = { sheets: [], toasts: [], posts: [], created: [], prompts: [], confirms: [], alerts: [], chooses: [], settings: 0, gone: [] }
  const ctl = { sheetPick: 0, promptValue: null, confirmValue: true, chooseResult: null, chooseError: null }
  let onLoad = null
  const h = runSetup('pages/staff/jobs.vue', {
    useScreen: (n, opts) => { onLoad = opts && opts.onLoad; return vue.ref(1) },
    onShareAppMessage() {},
    ensureSession: async () => {},
    hasStaffAccess: { value: true },
    currentStaffStoreId: () => 102,
    currentStaffStore: vue.ref({ storeId: 102, roleCode: 'manager', identityKey: 'manager:102' }),
    experience: { account: { id: 21 } }, merchantStaff: vue.ref(false),
    staffCan: () => true,
    absUrl: x => x,
    todayCn: () => '2026-10-15', shiftDate: () => '2026-10-22', isYmd: () => true,
    validateSalaryForm: () => '', salaryPayload: () => ({}),
    errText: (e, d) => (e && e.message) || d,
    toast: (m) => log.toasts.push(m),
    go: url => log.gone.push(url), back() {}, R: { staffOnline: '/pages/staff/online-jobs' },
    sheet: async (opts) => { log.sheets.push([...opts]); return typeof ctl.sheetPick === 'function' ? ctl.sheetPick(opts) : ctl.sheetPick },
    prompt: async (title, o) => { log.prompts.push([title, o && o.value]); return ctl.promptValue },
    confirm: async (title, msg) => { log.confirms.push([title, msg]); return ctl.confirmValue },
    alert: async (title, msg) => { log.alerts.push([title, msg]) },
    apiStaffJobs: async () => ({ data: { rows, canEdit: true, storeCert: false, storeAddress: STORE_ADDRESS, storeLatitude, storeLongitude: storeLatitude == null ? null : 119.791 } }),
    apiStaffShareStats: async () => ({ data: {} }),
    apiStaffCreateJob: async (storeId, payload) => { log.created.push(payload); return { msg: '已提交平台审核' } },
    post: async (url, data) => { log.posts.push([url, JSON.parse(JSON.stringify(data))]); return { msg: '工作地点已更新' } },
    uni: {
      chooseLocation: (o) => { log.chooses.push(o); if (ctl.chooseError) o.fail(ctl.chooseError); else o.success(ctl.chooseResult) },
      openSetting: () => { log.settings++ }
    }
  }, platform)
  return { ...h, log, ctl, load: async () => { onLoad && onLoad({}); await flush(); await flush() } }
}

test('发布页：不选工作地点写「默认：门店地址 …」，提交时地址和坐标都空着（服务端照旧用门店地址）', async (t) => {
  const h = jobsHarness()
  t.after(h.stop)
  await h.load()
  assert.equal(h.run('placeText.value'), '默认：门店地址 ' + STORE_ADDRESS)
  assert.match(h.run('placeHint.value'), /不选就用门店地址；替别的商户招人时/)
  const f = JSON.parse(h.run('JSON.stringify(newForm())'))
  assert.equal(f.address, '')
  assert.equal(f.latitude, null)
  assert.equal(f.longitude, null)
  // 门店登记过坐标：提示会说一并带上门店的地图位置
  const withPoint = jobsHarness('MP-WEIXIN', { storeLatitude: 25.503 })
  t.after(withPoint.stop)
  await withPoint.load()
  assert.equal(withPoint.run('placeHint.value'), '不选就用门店地址和门店登记的地图位置。')
  // 发布表单（2026-10-18 商家端改版）只给线下岗位：选「发布线上任务」直接去线上任务发布页，没有工作地点这一行
  assert.match(h.template, /<view id="pf-address" class="fc-row"[^>]*hover-class="k-press" @click="pickPlace">[\s\S]{0,120}<text class="fc-row__k">工作地点<\/text>/)
  h.run("choosePublish('online')")
  assert.deepEqual(h.log.gone, ['/pages/staff/online-jobs?s=1'])
})

test('发布页（小程序）：地图搜索选点 → 名字 + 地址拼成工作地点、带上坐标；手填清掉坐标；可以改回门店地址', async (t) => {
  const h = jobsHarness()
  t.after(h.stop)
  await h.load()
  h.run("startPublish(); choosePublish('volunteer')")
  assert.equal(h.run('formOpen.value'), true)
  h.ctl.sheetPick = (opts) => opts.indexOf('地图搜索选点')
  h.ctl.chooseResult = { latitude: 25.6, longitude: 119.3, name: '南舍庄园', address: '福建省福州市闽侯县' }
  await h.run('pickPlace()')
  assert.deepEqual(h.log.sheets[0], ['地图搜索选点', '手动填写地址'])
  let f = JSON.parse(h.run('JSON.stringify(form.value)'))
  assert.equal(f.address, '福建省福州市闽侯县南舍庄园')
  assert.equal(f.latitude, 25.6)
  assert.equal(f.longitude, 119.3)
  assert.equal(h.run('placeText.value'), '福建省福州市闽侯县南舍庄园')
  assert.match(h.run('placeHint.value'), /已在地图上选点/)
  // 再次选点时地图以已选的点为中心
  await h.run('pickPlace()')
  assert.equal(h.log.chooses[1].latitude, 25.6)
  assert.deepEqual(h.log.sheets[1], ['地图搜索选点', '手动填写地址', '改回门店地址'])

  // 手填：先确认会清掉地图上的点，再填文字
  h.ctl.sheetPick = (opts) => opts.indexOf('手动填写地址')
  h.ctl.promptValue = '南舍庄园（闽侯县上街镇）'
  await h.run('pickPlace()')
  assert.equal(h.log.confirms.length, 1)
  assert.match(h.log.confirms[0][1], /原来在地图上选的点会清掉/)
  f = JSON.parse(h.run('JSON.stringify(form.value)'))
  assert.equal(f.address, '南舍庄园（闽侯县上街镇）')
  assert.equal(f.latitude, null)
  assert.equal(f.longitude, null)
  assert.match(h.run('placeHint.value'), /手填的地址没有地图位置/)

  // 提交：address / latitude / longitude 跟着表单发给服务端
  h.run("gen.value = { title: '南舍庄园直播换工', intro: 'a', work: 'b', hope: 'c' }")
  h.run("form.value.images = ['/profile/upload/test/store.jpg']")
  await h.run('submitJob()')
  assert.equal(h.log.created.length, 1)
  assert.equal(h.log.created[0].address, '南舍庄园（闽侯县上街镇）')
  assert.ok('latitude' in h.log.created[0] && h.log.created[0].latitude === null)

  // 改回门店地址
  h.ctl.sheetPick = (opts) => opts.indexOf('手动填写地址')
  h.ctl.promptValue = '李喵喵民宿'
  await h.run('pickPlace()')
  h.ctl.sheetPick = (opts) => opts.indexOf('改回门店地址')
  await h.run('pickPlace()')
  f = JSON.parse(h.run('JSON.stringify(form.value)'))
  assert.equal(f.address, '')
  assert.equal(h.run('placeText.value'), '默认：门店地址 ' + STORE_ADDRESS)
})

test('发布页（小程序）：取消选点不改表单；没授权引导去设置；选到 0,0 提示重选', async (t) => {
  const h = jobsHarness()
  t.after(h.stop)
  await h.load()
  h.ctl.sheetPick = 0
  h.ctl.chooseError = { errMsg: 'chooseLocation:fail cancel' }
  await h.run('pickPlace()')
  assert.equal(h.run('form.value.address'), '')
  assert.equal(h.log.alerts.length + h.log.confirms.length, 0)
  h.ctl.chooseError = { errMsg: 'chooseLocation:fail auth deny' }
  await h.run('pickPlace()')
  assert.match(h.log.confirms[0][0], /需要位置授权/)
  assert.equal(h.log.settings, 1)
  h.ctl.chooseError = { errMsg: 'chooseLocation:fail api scope is not declared' }
  await h.run('pickPlace()')
  assert.match(h.log.alerts[0][0], /地图暂时无法打开/)
  h.ctl.chooseError = null
  h.ctl.chooseResult = { latitude: 0, longitude: 0, name: '', address: '' }
  await h.run('pickPlace()')
  assert.match(h.log.alerts[1][0], /没有选到有效位置/)
  assert.equal(h.run('form.value.latitude'), null)
})

test('发布页（网页版）：没有地图选点，只能手填地址', async (t) => {
  const h = jobsHarness('H5')
  t.after(h.stop)
  await h.load()
  h.ctl.sheetPick = 0
  h.ctl.promptValue = '平潭县君山片区李喵喵民宿'
  await h.run('pickPlace()')
  assert.deepEqual(h.log.sheets[0], ['手动填写地址'])
  assert.equal(h.log.chooses.length, 0)
  assert.equal(h.run('form.value.address'), '平潭县君山片区李喵喵民宿')
  assert.equal(h.run('form.value.latitude'), null)
  // 网页版里 chooseOnMap 编译出来直接返回 null，不碰 uni.chooseLocation
  assert.equal(await h.run('chooseOnMap({})'), null)
  // 手填空白：提示必填，不改表单
  h.ctl.promptValue = ''
  await h.run('pickPlace()')
  assert.ok(h.log.toasts.includes('请填写工作地点'))
})

test('岗位列表：线下岗位的卡片菜单有「修改工作地点」，调分包里的接口；线上任务、已关闭、没编辑权限的不出现', async (t) => {
  const job = { jobId: 10005, jobType: 'volunteer', status: 'published', statusLabel: '招聘中', title: '南舍庄园招直播换工', address: STORE_ADDRESS, latitude: null, longitude: null }
  const h = jobsHarness('MP-WEIXIN', { rows: [job] })
  t.after(h.stop)
  await h.load()
  const menu = async (j) => {
    h.ctl.sheetPick = -1
    await h.run('jobActions(' + JSON.stringify(j) + ')')
    return h.log.sheets[h.log.sheets.length - 1]
  }
  const row = { ...job, rawStatus: 'published' }
  // 内测反馈 2.0：多了「换岗位照片」，招聘中 / 暂停的菜单放不下（系统菜单一页最多 6 项），改地点 / 补条件 / 换照片 / 住宿与宠物（R4）收成一项，点了再选
  const EDIT_MORE = '改地点 / 筛选条件 / 照片 / 住宿…'
  assert.ok((await menu(row)).includes(EDIT_MORE))
  assert.ok((await menu({ ...row, rawStatus: 'paused' })).includes(EDIT_MORE))
  // 10-16 跟进：草稿也能「补填筛选条件」（job-conditions-fill.test.mjs）、换照片（job-photos-20261016.test.mjs）
  assert.deepEqual(await menu({ ...row, rawStatus: 'draft' }), ['修改工作地点', '补填筛选条件', '换岗位照片', '住宿与宠物'], '待审核的草稿也能改地点')
  assert.ok(!(await menu({ ...row, jobType: 'online' })).includes('修改工作地点'), '线上任务没有工作地点')
  assert.ok(!(await menu({ ...row, jobType: 'online' })).includes(EDIT_MORE), '线上任务没有工作地点')
  const before = h.log.sheets.length
  await h.run('jobActions(' + JSON.stringify({ ...row, rawStatus: 'closed' }) + ')')
  assert.equal(h.log.sheets.length, before, '已关闭的岗位没有菜单')
  h.run('canEdit.value = false')
  assert.ok(!(await menu(row)).includes('修改工作地点'), '没有岗位编辑权限的角色不出现')
  assert.ok(!(await menu(row)).includes(EDIT_MORE), '没有岗位编辑权限的角色不出现')
  h.run('canEdit.value = true')

  // 选「改地点 / 筛选条件 / 照片 / 住宿…」→「修改工作地点」→ 地图选点 → 调 POST /app/staff/jobs/{id}/location，成功后刷新列表
  h.ctl.sheetPick = (opts) => opts.indexOf(opts.includes(EDIT_MORE) ? EDIT_MORE : opts.includes('修改工作地点') ? '修改工作地点' : '地图搜索选点')
  h.ctl.chooseResult = { latitude: 25.6, longitude: 119.3, name: '南舍庄园', address: '福建省福州市闽侯县' }
  await h.run('jobActions(' + JSON.stringify(row) + ')')
  await flush()
  assert.deepEqual(h.log.posts[0], ['/app/staff/jobs/10005/location', { latitude: 25.6, longitude: 119.3, address: '福建省福州市闽侯县南舍庄园' }])
  assert.ok(h.log.toasts.includes('工作地点已更新'))

  // 手填（原来有坐标）：先确认，再发不带坐标的地址
  h.ctl.sheetPick = (opts) => opts.indexOf('手动填写地址')
  h.ctl.promptValue = '平潭县君山片区李喵喵民宿'
  await h.run('movePlace(' + JSON.stringify({ ...row, latitude: 25.6, longitude: 119.3 }) + ')')
  assert.match(h.log.confirms[h.log.confirms.length - 1][1], /原来在地图上选的点会清掉/)
  assert.deepEqual(h.log.posts[1], ['/app/staff/jobs/10005/location', { address: '平潭县君山片区李喵喵民宿', latitude: null, longitude: null }])
})

test('改地点的接口写在 staff 分包页面里：主包的 common/api.js 不加东西，也不引用主包里的 stay-location', () => {
  const page = src('pages/staff/jobs.vue')
  assert.match(page, /import \{ post(, put)? \} from '@\/common\/request\.js'/)
  assert.match(page, /const apiStaffJobLocation = \(jobId, payload\) => post\('\/app\/staff\/jobs\/' \+ jobId \+ '\/location', payload\)/)
  assert.doesNotMatch(page, /stay-location/)
  assert.doesNotMatch(src('common/api.js'), /staff\/jobs\/[^\n]*location/)
  // 地图选点只在微信小程序里编译进去
  const at = page.indexOf('uni.chooseLocation')
  assert.ok(page.lastIndexOf('// #ifdef MP-WEIXIN', at) > page.lastIndexOf('// #endif', at))
  const detail = src('pages/jobs/detail.vue')
  assert.doesNotMatch(detail, /stay-location/)
})

// ---------------------------------------------------------------- 岗位详情

function detailHarness(platform = 'MP-WEIXIN') {
  const opened = []
  const toasts = []
  const copied = [], selected = [], urls = [], modals = []
  const h = runSetup('pages/jobs/detail.vue', {
    useScreen: () => vue.ref(1), experience: vue.reactive({ account: null }), absUrl: x => x,
    toast: (m) => toasts.push(m), placeMapUrl, openNativePlace,
    window: { location: { assign: url => urls.push(url) } },
    uni: { showModal: o => modals.push(o), openLocation: (o) => opened.push(o), setClipboardData: (o) => copied.push(o), chooseLocation: o => selected.push(o) }
  }, platform)
  return { ...h, opened, toasts, copied, selected, urls, modals }
}
const placeRow = (h) => JSON.parse(h.run("JSON.stringify(overviewRows.value.find(r => r.label === '工作地点') || null)"))

test('岗位详情：有坐标时「工作地点」整行可点，打开地图；所有人都能点（游客也行）', (t) => {
  const h = detailHarness()
  t.after(h.stop)
  h.run("detail.value = " + JSON.stringify({ jobType: 'volunteer', status: 'published', title: '南舍庄园招直播换工', address: '福州市闽侯县南舍庄园', city: '福州', latitude: 25.6, longitude: 119.3 }))
  const row = placeRow(h)
  assert.equal(row.value, '福州市闽侯县南舍庄园 · 福州')
  assert.equal(row.tap, true)
  h.run("tapRow(overviewRows.value.find(r => r.label === '工作地点'))")
  assert.equal(h.opened.length, 1)
  assert.deepEqual({ ...h.opened[0], fail: undefined }, { latitude: 25.6, longitude: 119.3, name: '南舍庄园招直播换工', address: '福州市闽侯县南舍庄园', scale: 16, fail: undefined })
  // 地图打不开（不是用户取消）给一句提示
  h.opened[0].fail({ errMsg: 'openLocation:fail' })
  h.opened[0].fail({ errMsg: 'openLocation:fail cancel' })
  assert.deepEqual(h.toasts, ['地图暂时无法打开，请稍后重试'])
  // 其他行点了没反应
  h.run("tapRow(overviewRows.value.find(r => r.label === '薪资待遇') || { label: 'x' })")
  assert.equal(h.opened.length, 1)
  // 模板：整行可点、带「地图」字样和箭头
  assert.match(h.template, /class="info-row" :class="\{ 'info-row--tap': item\.tap \}" @click="tapRow\(item\)"/)
  assert.match(h.template, /<text v-if="item\.tap" class="info-row__map">\{\{ mapTag \}\}<\/text>/)
  assert.equal(h.run('mapTag'), '地图')
  assert.equal(h.copied.length, 0, '小程序不复制地址')
})

test('岗位详情网页版：真实坐标打开标点，无坐标按完整地址搜索', (t) => {
  const h = detailHarness('H5'); t.after(h.stop)
  assert.equal(h.run('mapTag'), '地图')
  h.run('detail.value = ' + JSON.stringify({ jobType:'parttime', address:'东湖山庄98号', city:'平潭', latitude:25.6, longitude:119.3 }))
  h.run('openMap()'); assert.match(h.urls[0], /marker\?position=119.3,25.6/)
  h.run('detail.value = ' + JSON.stringify({ jobType:'parttime', address:'东湖山庄98号', city:'平潭' }))
  assert.equal(placeRow(h).tap, true); h.run('openMap()')
  assert.equal(new URL(h.urls[1]).searchParams.get('keyword'), '平潭 东湖山庄98号')
  assert.equal(h.opened.length,0); assert.equal(h.copied.length,0)
})

test('岗位详情原生：无坐标明确说明并可复制完整地址，不用用户当前位置冒充门店；线上任务无地图', (t) => {
  const h = detailHarness(); t.after(h.stop)
  for (const point of [{}, { latitude: 0, longitude: 0 }, { latitude: 95, longitude: 119.3 }, { latitude: 25.6, longitude: null }]) {
    h.run('detail.value = ' + JSON.stringify({ jobType: 'volunteer', address: '东湖山庄98号', city: '平潭', ...point }))
    assert.equal(placeRow(h).tap, true)
    h.run('openMap()')
    const modal = h.modals.at(-1)
    assert.equal(modal.title, '门店定位待完善')
    assert.ok(modal.content.includes('平潭 东湖山庄98号'))
    modal.success({ confirm: false })
    assert.equal(h.copied.length, 0, '未确认不改剪贴板')
  }
  assert.equal(h.opened.length, 0)
  assert.equal(h.selected.length, 0, '不会打开落在当前位置的编辑地图')
  h.modals.at(-1).success({ confirm: true })
  assert.equal(h.copied[0].data, '平潭 东湖山庄98号')
  h.copied[0].success()
  assert.equal(h.toasts.at(-1), '地址已复制，可在地图中搜索')
  h.copied[0].fail()
  assert.equal(h.toasts.at(-1), '复制失败，请长按页面地址复制')
  h.run('detail.value = ' + JSON.stringify({ jobType: 'online', address: '远程', city: '不限', latitude: 25.6, longitude: 119.3 }))
  assert.equal(placeRow(h), null)
  h.run('openMap()')
  assert.equal(h.opened.length, 0)
  assert.equal(h.modals.length, 4)
})
