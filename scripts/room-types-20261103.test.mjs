// 2026-11-03 房源管理一批（node --test，不需要构建、不发请求）。主人原话：
//   「设计太弱智了弄到一起，我需要退出来登进去来回点击是不是有点太弱智，这里需要修复下」
//   「新增在一个页，现在操作太繁琐了很多都是老人…这种设计不友好，增加个单独的二级页操作方便简单一些」
//   「布局，必须7天，填写7天的价格页面优化一下不要弹窗」
//   「来源类型，分成直营，加盟，代运营，合作」
//   「增加一个地暖，增加一个对勾，你点一下对勾就选中，能清楚的看到我选了那个」
//   「（消防安全检查合格证）改成可选不可选，加上食品安全许可证」
// 守住这几件事：
//   · 房源卡片下面一整行五个按钮：编辑房源 / 房型管理 / 房态 / 数据 / 更多；「房型管理」进二级页 room-types.vue，「更多」里不再有它；
//   · 房源管理从别的页回来（onShow）按当前这一屏重新拉数据，不用退出去再进来；
//   · 房型页一页填完，2026-11-15 改为单个7天总价，保存发 weekTotalFen（分）；上线中只看、给「先下架再修改」；
//   · 后端：7 天价存 kg_stay_room_type.week_price_fen（V70），某晚价 = 房态当晚价 → 星期几的价 → 基础价；来源类型加 partner 合作；设施字典加 floorheat 地暖；
//     消防改选填、加选填的食品安全许可证（food）。
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { createRequire } from 'node:module'
import test from 'node:test'
import assert from 'node:assert/strict'

const APP = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const ROOT = path.resolve(APP, '..')
const require = createRequire(path.join(APP, 'package.json'))
const compiler = require('@vue/compiler-sfc'), vue = require('vue')
const src = (rel) => fs.readFileSync(path.join(APP, rel), 'utf8').replace(/\r\n/g, '\n')
const java = (rel) => fs.readFileSync(path.join(ROOT, 'RuoYi-Vue', 'ruoyi-kangaroo', 'src', 'main', 'java', 'com', 'ruoyi', 'kangaroo', rel), 'utf8').replace(/\r\n/g, '\n')
const plain = (v) => JSON.parse(JSON.stringify(v))
const flush = () => new Promise(resolve => setImmediate(resolve))
const between = (s, a, b) => { const i = s.indexOf(a), j = s.indexOf(b, i + a.length); assert.ok(i >= 0 && j > i, `找不到 ${a} … ${b}`); return s.slice(i, j) }
const sub = await import(pathToFileURL(path.join(APP, 'pages/staff/stay-submission.js')).href)

/** 在沙箱里跑页面的 script setup：导入一律先给永远不返回的函数，再用 stubs 覆盖用得到的那几个（和 other-forms-20261031 同一个做法） */
function runSetup(rel, stubs) {
  const d = compiler.parse(src(rel), { filename: rel }).descriptor
  const source = d.scriptSetup.content
  const ast = compiler.babelParse(source, { sourceType: 'module' })
  const body = ast.program.body.filter(n => n.type !== 'ImportDeclaration').map(n => source.slice(n.start, n.end)).join('\n')
  const sandbox = { console, setTimeout, clearTimeout, setInterval: () => 0, clearInterval() {} }
  for (const n of ast.program.body.filter(n => n.type === 'ImportDeclaration')) for (const s of n.specifiers) sandbox[s.local.name] = () => new Promise(() => {})
  Object.assign(sandbox, { ref: vue.ref, computed: vue.computed, watch: vue.watch, reactive: vue.reactive, onShow() {}, onHide() {}, onUnload() {}, onUnmounted() {} }, stubs)
  vm.createContext(sandbox)
  const scope = vue.effectScope()
  scope.run(() => vm.runInContext(body, sandbox, { filename: rel + ':script-setup' }))
  return { run: code => vm.runInContext(code, sandbox), stop: () => scope.stop(), template: d.template.content, script: source, styles: d.styles.map(x => x.content).join('\n') }
}

// ---------------------------------------------------------------- 7 天价格的小工具

test('旧版逐日价格兼容工具仍可用；房型价格摘要改为7天合计', () => {
  assert.deepEqual(sub.WEEK_DAYS, ['周一', '周二', '周三', '周四', '周五', '周六', '周日'])
  assert.deepEqual(sub.weekPricesOf({ basePriceFen: 19800 }), Array(7).fill('198'))
  assert.deepEqual(sub.weekPricesOf({ basePriceFen: 19800, weekPriceFen: '19800,19800,19800,19800,19800,26850,26800' }), ['198', '198', '198', '198', '198', '268.5', '268'])
  assert.deepEqual(sub.weekPricesOf({ basePriceFen: 19800, weekPriceFen: '1,2' }), Array(7).fill('198'), '存的不是 7 个就按基础价')
  assert.deepEqual(sub.weekPricesOf({}), Array(7).fill(''))
  assert.deepEqual(sub.fillWeek(['', '198', '', '', '', '268', '']), ['198', '198', '198', '198', '198', '268', '198'], '已经填了的不覆盖')
  assert.deepEqual(sub.fillWeek(Array(7).fill('')), Array(7).fill(''))
  assert.deepEqual(sub.weekPricePayload(['198', '198', '198', '198', '198', '268.5', '268']), [19800, 19800, 19800, 19800, 19800, 26850, 26800])
  for (const [bad, day] of [[['198', '198', '', '198', '198', '198', '198'], 2], [['198', '198', '198', '198', '198', '198', '0'], 6], [['198', '1.005', '198', '198', '198', '198', '198'], 1], [['198', '198', '198', '198', '198', '198', '100001'], 6]]) {
    assert.throws(() => sub.weekPricePayload(bad), e => e.day === day && e.message.startsWith(sub.WEEK_DAYS[day]))
  }
  assert.throws(() => sub.weekPricePayload(['198']), /7 天/)
  const p = sub.roomTypeWeekPayload({ typeName: ' 大床房 ', roomKind: 'shared', capacity: '4', stock: '8', status: '0', prices: Array(7).fill('88') })
  assert.deepEqual(p, { typeName: '大床房', roomKind: 'shared', capacity: 4, stock: 8, status: '0', weekPriceFen: Array(7).fill(8800) })
  assert.ok(!('basePriceFen' in p), '基础价不再单独填，服务端按 7 天最低价存')
  assert.equal(sub.weekPriceText({ basePriceFen: 19800 }), '7天总价 ¥1386')
  assert.equal(sub.weekPriceText({ weekPriceFen: '19800,19800,19800,19800,19800,26800,26800' }), '7天总价 ¥1526')
  assert.equal(sub.weekPriceText({ weekPriceFen: '19800,19800,19800,19800,22800,26800,19800' }), '7天总价 ¥1486')
})

// ---------------------------------------------------------------- 房型和价格（二级页）

const STAY = (over = {}) => ({ stayId: 66, stayName: '古城拾光', status: 'draft', statusLabel: '草稿', roomTypes: [
  { roomTypeId: 7, typeName: '院子客房', roomKind: 'private', capacity: 2, stock: 1, unitLabel: '间', basePriceFen: 19800, weekPriceFen: null, status: '0' }
], ...over })

function roomTypes(stubs = {}) {
  const log = { created: [], edited: [], toasts: [], offline: [], confirms: [], back: 0 }
  let onLoad = null, show = null
  const s = vue.ref(1)
  const h = runSetup('pages/staff/room-types.vue', {
    useScreen: (n, o) => { onLoad = o.onLoad; return s }, onShow: (fn) => { show = fn },
    ensureSession: async () => {}, hasStaffAccess: { value: true }, toast: m => log.toasts.push(m), errText: (e, d) => (e && e.msg) || d, back: () => { log.back++ },
    confirm: async (t) => { log.confirms.push(t); return true }, prompt: async () => '调整价格',
    apiStaffStay: async () => ({ data: STAY() }),
    apiStaffCreateRoomType: async (id, p) => { log.created.push([id, plain(p)]); return { data: STAY({ roomTypes: [...STAY().roomTypes, { roomTypeId: 8, typeName: p.typeName, roomKind: p.roomKind, capacity: p.capacity, stock: p.stock, unitLabel: '间', weekTotalFen: p.weekTotalFen, status: '0' }] }) } },
    apiStaffEditRoomType: async (id, p) => { log.edited.push([id, plain(p)]); return { data: STAY() } },
    apiStaffOfflineStay: async (id, why) => { log.offline.push([id, why]); return { msg: '已下架' } },
    ...sub,
    ...stubs
  })
  return { ...h, log, s, load: async (q = { stayId: '66' }) => { onLoad(q); await flush(); await flush() }, show: () => show && show() }
}

test('房型页：进来就列出这个房源的房型（名称、人数间数、7 天价一行）；草稿能改，有「新增房型」大按钮', async (t) => {
  const h = roomTypes()
  t.after(h.stop)
  await h.load()
  assert.equal(h.run('rooms.value.length'), 1)
  assert.equal(h.run('editable.value'), true)
  assert.equal(h.run('lockTip.value'), '')
  const list = between(h.template, '<view v-if="s === 1" class="fc-form">', '<!-- 2 新增 / 修改一个房型')
  assert.match(list, /\{\{ weekPriceText\(room\) \}\}/)
  assert.match(list, /@click="openEditor\(room\)"><k-icon[^>]*\/><text>修改房型和价格<\/text>/)
  assert.match(list, /@click="toggleStatus\(room\)"><text>\{\{ room\.status === '1' \? '重新启用' : '停用' \}\}<\/text>/)
  assert.match(list, /@click="openEditor\(\)"><k-icon[^>]*\/><text class="rt-btn__t">新增房型<\/text>/)
  // 能点的都有 hover-class，按钮至少 48px 高
  assert.deepEqual([...h.template.matchAll(/<view\b[^>]*@click[^>]*>/g)].map(m => m[0]).filter(x => !x.includes('hover-class')), [])
  assert.match(h.styles, /\.rt-btn \{[^}]*height: 48px;/)
  assert.match(h.styles, /\.rt-fill \{[^}]*min-height: 48px;/)
  assert.doesNotMatch(h.template, /uni\.showActionSheet|pickPaged/)
})

test('房型页：新增填写单个7天总价；空价阻止保存，保存发weekTotalFen并返回刷新列表', async (t) => {
  const h = roomTypes()
  t.after(h.stop)
  await h.load()
  h.run('openEditor()')
  assert.equal(h.s.value, 2)
  assert.equal(h.run('editor.value.weekTotal'), '')
  h.run("editor.value.typeName = '庭院大床房'")
  await h.run('save()')
  assert.match(h.run('err.value.price'), /7天总价/)
  assert.equal(h.log.created.length, 0)
  h.run("editor.value.weekTotal = '100.01'")
  h.run("step('capacity', 1, 1, 20); step('stock', -1, 1, 999)")
  await h.run('save()')
  await flush()
  assert.deepEqual(h.log.created, [[66, { typeName: '庭院大床房', roomKind: 'private', capacity: 3, stock: 1, status: '0', weekTotalFen: 10001, halfMonthTotalFen: null, monthTotalFen: null }]])
  assert.equal(h.s.value, 1, '保存后回到列表')
  assert.equal(h.run('rooms.value.length'), 2, '用接口返回的最新数据刷新')
  assert.equal(h.log.toasts.at(-1), '房型已新增')
  const editor = h.template.slice(h.template.indexOf('<view v-else-if="editor" class="fc-form">'))
  assert.match(editor, /v-model="editor\.weekTotal" class="fc-money__input" type="digit"/)
  assert.match(editor, /7天总价（元）/)
  assert.doesNotMatch(editor, /一键填满|editor\.prices/)
})

test('后台设为零库存的房型改套餐价不补房；主动增加库存才写库存', async t => {
  const h = roomTypes({ apiStaffStay: async () => ({ data: STAY({ roomTypes: [{ ...STAY().roomTypes[0], stock: 0 }] }) }) })
  t.after(h.stop)
  await h.load()
  h.run('openEditor(rooms.value[0])')
  assert.equal(h.run('editor.value.stock'), 0)
  h.run("editor.value.halfMonthTotal = '300.15'")
  await h.run('save()')
  assert.equal(h.log.edited[0][1].halfMonthTotalFen, 30015)
  assert.ok(!('stock' in h.log.edited[0][1]))
  await h.load()
  h.run("openEditor(rooms.value[0]); step('stock', 1, 0, 999)")
  await h.run('save()')
  assert.equal(h.log.edited[1][1].stock, 1)
})

test('房型页：旧房型回显七晚合计，改单个总价保存；空名称不发、停用与取消行为保留', async (t) => {
  const h = roomTypes()
  t.after(h.stop)
  await h.load()
  h.run('openEditor(rooms.value[0])')
  assert.equal(h.run('editor.value.weekTotal'), '1386')
  h.run("editor.value.typeName = ' '")
  await h.run('save()')
  assert.equal(h.run('err.value.typeName'), '请填写房型名称')
  h.run("editor.value.typeName = '院子客房'; editor.value.weekTotal = '1526'")
  await h.run('save()')
  await flush()
  assert.deepEqual(h.log.edited.at(-1), [7, { typeName: '院子客房', roomKind: 'private', capacity: 2, status: '0', weekTotalFen: 152600 }])
  await h.run('toggleStatus(rooms.value[0])')
  assert.deepEqual(h.log.edited.at(-1), [7, { status: '1' }])
  assert.equal(h.log.confirms.length, 0, '停用随时能改回来，不弹确认')
  // 没改就返回：不问；改了返回：问一句
  h.run('openEditor(rooms.value[0])')
  await h.run('onBack()')
  assert.equal(h.s.value, 1)
  assert.equal(h.log.confirms.length, 0)
  h.run('openEditor(rooms.value[0])')
  h.run("editor.value.weekTotal = '700'")
  await h.run('onBack()')
  assert.deepEqual(h.log.confirms, ['放弃这次填写？'])
  assert.equal(h.s.value, 1)
  await h.run('onBack()')
  assert.equal(h.log.back, 1, '列表屏返回离开本页')
})

test('房型页：上线中只看不改，说清楚要先下架、临时调价用房态；「先下架，再修改房型」写原因后下架并刷新；审核中只看', async (t) => {
  let status = 'online'
  const h = roomTypes({ apiStaffStay: async () => ({ data: STAY({ status, statusLabel: status === 'online' ? '已上线' : '已下架' }) }) })
  t.after(h.stop)
  await h.load()
  assert.equal(h.run('editable.value'), false)
  assert.match(h.run('lockTip.value'), /先下架.*房态/)
  h.run('openEditor(rooms.value[0])')
  assert.equal(h.s.value, 1, '上线中点不开编辑')
  status = 'offline'
  await h.run('offlineToEdit()')
  await flush()
  assert.deepEqual(h.log.offline, [[66, '调整价格']])
  assert.equal(h.run('editable.value'), true)
  status = 'pending'
  await h.show()
  await flush()
  assert.equal(h.run('editable.value'), false)
  assert.match(h.run('lockTip.value'), /审核中/)
})

test('房型页：没带 stayId / 没权限时说清楚，不空白', async (t) => {
  const h = roomTypes()
  t.after(h.stop)
  await h.load({})
  assert.match(h.run('loadError.value'), /没有指定房源/)
})

// ---------------------------------------------------------------- 房源管理列表

function rooms(stubs = {}) {
  const log = { go: [], lists: 0, stays: 0, media: 0 }
  let show = null
  const s = vue.ref(1)
  const h = runSetup('pages/staff/rooms.vue', {
    useScreen: () => s, onShow: (fn) => { show = fn }, ensureSession: async () => {}, hasStaffAccess: { value: true }, currentStaffStoreId: () => 102,
    experience: { account: {} }, toast() {}, errText: (e, d) => d, absUrl: x => x, go: (u) => log.go.push(u), back() {}, coordinates: () => null,
    apiStaffStays: async () => { log.lists++; return { data: { rows: [], stats: {}, tabs: {} } } },
    apiStaffStay: async (id) => { log.stays++; return { data: { stayId: id, status: 'draft', roomTypes: [{ roomTypeId: 1 }], quals: [] } } },
    get: async () => { log.media++; return { data: { stayId: 66 } } },
    uni: { getStorageSync: () => '', setStorageSync() {}, removeStorageSync() {} },
    ...stubs
  })
  return { ...h, log, s, show: () => show && show() }
}

test('房源卡片：下面一整行五个一样大的按钮（编辑房源 / 房型管理 / 房态 / 提交审核或下架 / 更多），「房型管理」进二级页；「更多」里不再有房型管理', (t) => {
  const h = rooms()
  t.after(h.stop)
  // 2026-11-03 简化：第四个按钮按状态变（提交审核 / 下架 / 审核中），「数据」在 Vlog 页的「数据」标签里；卡片下面可能展开下架原因框，切到它前面
  const card = between(h.template, '<view v-if="r.actions" class="room__actions">', '<!-- 下架原因')
  assert.deepEqual([...card.matchAll(/<text>([^<]+)<\/text>/g)].map(m => m[1]), ["{{ ['draft','rejected','offline'].includes(r.rawStatus) ? '继续上架' : '编辑房源' }}", '房型管理', '房态', '{{ r.actionLabel }}', '更多'])
  assert.match(card, /hover-class="k-press" @click="openRoomTypes\(r\)"/)
  assert.deepEqual([...card.matchAll(/<view\b[^>]*@click[^>]*>/g)].map(m => m[0]).filter(x => !x.includes('hover-class')), [])
  assert.match(h.styles, /\.room__act \{[^}]*min-height: 56px;[^}]*font-size: 14px;/)
  h.run('openRoomTypes({ stayId: 66 })')
  assert.deepEqual(h.log.go, ['/pages/staff/room-types?stayId=66'])
  assert.doesNotMatch(h.script, /manageRoomTypes|askInt\(|每晚基础价/, '弹框连环问的房型管理删掉了')
  const more = h.script.slice(h.script.indexOf('async function moreActions(r) {'))
  assert.doesNotMatch(more.slice(0, more.indexOf('\n}\n')), /'房型管理'/)
  // 资质屏：房型不再在页内填，进同一个二级页
  const sub3 = between(h.template, '<view id="submission-rooms" class="fc-block">', '<text class="fc-group__title">资质材料</text>')
  assert.match(sub3, /@click="openRoomTypes\(\{ stayId: editingId \}\)"/)
  assert.doesNotMatch(sub3, /roomEditor|每晚基础价/)
})

test('房源管理「退出来登进去」：从别的页回来按当前这一屏重新拉；第一次显示不重复拉；填写屏不动', async (t) => {
  const h = rooms()
  t.after(h.stop)
  h.show()
  await flush()
  assert.equal(h.log.lists, 0, '第一次显示是进页，onLoad 已经拉过')
  h.show()
  await flush()
  assert.equal(h.log.lists, 1, '列表屏回来重新拉列表')
  h.s.value = 3
  h.run('editingId.value = 66')
  await flush()
  const before = h.log.stays
  h.show()
  await flush()
  assert.equal(h.log.stays, before + 1, '资质屏回来重新拉这个房源（房型页新增的房型马上能看到）')
  assert.equal(h.run('stayInfo.value.stayId'), 66)
  h.s.value = 5
  h.run('media.value = { ...media.value, stayId: 66 }')
  h.show()
  await flush()
  assert.equal(h.log.media, 1, '视频与生活碎片屏回来重新拉')
  h.s.value = 2
  const counts = JSON.stringify(h.log)
  h.show()
  await flush()
  assert.equal(JSON.stringify(h.log), counts, '填写屏有没保存的内容，不动')
})

test('页面注册：room-types 在 staff 分包里，不进主包的 api.js / routes.js', () => {
  const cfg = JSON.parse(src('pages.json'))
  const staff = cfg.subPackages.find(p => p.root === 'pages/staff')
  assert.ok(staff.pages.some(p => p.path === 'room-types' && p.style.navigationStyle === 'custom'))
  assert.ok(!cfg.pages.some(p => /room-types/.test(p.path)))
  assert.doesNotMatch(src('common/api.js') + src('common/routes.js'), /pages\/staff\/room-types/)
})

// ---------------------------------------------------------------- 设施、多选弹层的对勾

test('设施地暖：字典代码 floorheat（V70），后端白名单有，详情页有图标；多选弹层没选是空心圈、选中是实心圆 + 对勾', () => {
  assert.match(java('ext/stay/KgStayBrowseService.java'), /FACILITY_CODES = Arrays\.asList\([^)]*"floorheat"\)/)
  const detail = src('pages/stays/detail.vue')
  const icon = /floorheat: \['([a-z-]+)', '地暖'\]/.exec(detail)
  assert.ok(icon, '详情页设施图标')
  assert.ok(src('common/icons.js').includes('"' + icon[1] + '":'), icon[1] + ' 在 common/icons.js 里')
  const v70 = fs.readFileSync(path.join(ROOT, 'RuoYi-Vue', 'sql', 'kangaroo', 'V70__stay_week_price_options.sql'), 'utf8')
  assert.match(v70, /select 10, '地暖', 'floorheat', 'kg_stay_facility'/)
  const sheet = src('pages/staff/components/fc-sheet.vue')
  assert.match(sheet, /<view v-if="multiple" class="fc-sheet__mark" :class="\{ on: rowItem\.on \}"><k-icon v-if="rowItem\.on" name="check"/)
  assert.match(sheet, /\.fc-sheet__mark\.on \{[^}]*background: var\(--k-red-deep\);/)
})

// ---------------------------------------------------------------- 来源类型、资质（后端）

test('来源类型：直营 / 加盟 / 代运营 / 合作（partner）；后台保存、员工端标签、团队页标签都认合作', () => {
  assert.match(java('service/impl/KgStoreServiceImpl.java'), /!"partner"\.equals\(op\)\)[\s\S]*?运营类型只能是 直营 \/ 加盟 \/ 代运营 \/ 合作/)
  assert.match(java('ext/stay/KgStayBrowseService.java'), /if \("partner"\.equals\(opType\)\)\s*\{\s*return "合作";/)
  assert.match(java('ext/staff/KgStaffTeamService.java'), /if \("franchise"\.equals\(t\) \|\| "partner"\.equals\(t\)\)\s*\{\s*return "合作";/)
  assert.match(java('domain/KgStore.java'), /readConverterExp = "direct=直营,franchise=加盟,managed=代运营,partner=合作"/)
  const v70 = fs.readFileSync(path.join(ROOT, 'RuoYi-Vue', 'sql', 'kangaroo', 'V70__stay_week_price_options.sql'), 'utf8')
  const order = ['direct', 'franchise', 'managed', 'partner'].map(v => new RegExp(`set dict_sort = (\\d) where dict_type = 'kg_store_op_type' and dict_value = '${v}'`).exec(v70)[1])
  assert.deepEqual(order, ['1', '2', '3', '4'], '主人要的顺序')
  // 员工端只读显示服务端给的标签，不写死选项
  assert.match(src('pages/staff/rooms.vue'), /<text class="fc-row__k">来源类型<\/text><text class="fc-row__v fc-row__v--plain">\{\{ form\.type \|\| '—' \}\}<\/text>/)
})

test('资质：消防安全检查合格证改选填，加选填的食品安全许可证（food），提交审核只卡必填；后台资质列表认 food', () => {
  const staff = java('ext/stay/KgStayStaffService.java')
  assert.match(staff, /\{ "license", "营业执照", "1" \}, \{ "fire", "消防安全检查合格证", "0" \},\s*\{ "food", "食品安全许可证", "0" \}, \{ "special", "特种行业许可证", "0" \}, \{ "idcard", "负责人身份证", "1" \}/)
  assert.match(java('ext/stay/KgStayModule.java'), /fire:消防安全检查合格证,food:食品安全许可证,special:特种行业许可证/)
  // 员工端按服务端 required 判断还缺什么：选填的不算缺
  assert.deepEqual(sub.staySubmissionMissing({ address: 'a', cover: 'c', roomTypes: [{ status: '0' }], quals: [
    { title: '营业执照', required: true, uploaded: true }, { title: '消防安全检查合格证', required: false, uploaded: false },
    { title: '食品安全许可证', required: false, uploaded: false }, { title: '负责人身份证', required: true, uploaded: true }] }), [])
})

test('房价：订房支持周期总价和每日改价，日历和员工房态优先使用当晚改价', () => {
  const browse = java('ext/stay/KgStayBrowseService.java')
  assert.match(browse, /defaultPrice = periodTotal == null \? KgRoomWeekPrice\.nightly\(rt, d\)\s*: KgRoomPeriodPrice\.nightly\(periodTotal, stayNights, nightly\.size\(\)\)/)
  assert.match(browse, /c\.get\("priceFen"\) == null \? defaultPrice : fen\(c\.get\("priceFen"\)\)/)
  assert.match(browse, /c\.get\("priceFen"\) == null \? KgRoomWeekPrice\.nightly\(rt, d\) : fen\(c\.get\("priceFen"\)\)/)
  assert.match(java('ext/stay/KgStayStaffService.java'), /r\.get\("priceFen"\) == null \? KgRoomWeekPrice\.nightly\(rt, d\) : fen\(r\.get\("priceFen"\)\)/)
  assert.match(java('ext/stay/KgStayStaffService.java'), /base_price_fen, week_price_fen, half_month_total_fen, month_total_fen, status/)
})
