// 2026-10-31 表单改版（包 20261031-forms，R7）的其余页面：创建活动、新增 / 编辑房源（含资质、Vlog）、发布线上任务（node --test，不需要构建、不发请求）。
// 主人原话：「这几个需要填写东西的页面，你做的很好都比较齐全，但是看起来很乱，就是也不好看。这里使用的有年龄大的，需要看起来更干净成熟一些」
// 守住这几件事：
//   · 字段一个不少，只整理；能点的 view 都有 hover-class；填写屏没有底栏，只有操作条，操作条不写流程字；
//   · 逻辑不变：payload、校验规则、草稿、回填都照旧，只是标题、地点、名称、地址没填时多了就地标红、滚到第一个错；
//   · 假的步骤圈去掉，步数按真实流程；设施改成多选弹层，字典外的老代码不动；
//   · 更多选填：新建收起，打开时里面已有内容就展开；
//   · 填写屏不出浮动客服钮（字段从屏幕边开始，钮会压字），客服方块在操作条最左边。
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { createRequire } from 'node:module'
import test from 'node:test'
import assert from 'node:assert/strict'
const FORM = await import(pathToFileURL(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'common/activity-form.js')).href)

const APP = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const require = createRequire(path.join(APP, 'package.json'))
const compiler = require('@vue/compiler-sfc'), vue = require('vue')
const src = (rel) => fs.readFileSync(path.join(APP, rel), 'utf8').replace(/\r\n/g, '\n')
const plain = (v) => JSON.parse(JSON.stringify(v))
const flush = () => new Promise(resolve => setImmediate(resolve))
const between = (s, a, b) => { const i = s.indexOf(a), j = s.indexOf(b, i + a.length); assert.ok(i >= 0 && j > i, `找不到 ${a} … ${b}`); return s.slice(i, j) }

/** 在沙箱里跑页面的 script setup：导入一律先给永远不返回的函数，再用 stubs 覆盖用得到的那几个 */
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

// 这几屏的通用规矩：能点的 view 都有 hover-class，text 上不写，v-for 别名不用单字母 l，占位字用不带 data-v 的 fc-ph，不用旧写法
function formRules(block, name) {
  assert.deepEqual([...block.matchAll(/<view\b[^>]*@click[^>]*>/g)].map(m => m[0]).filter(x => !x.includes('hover-class')), [], name + '：能点的 view 要有 hover-class')
  assert.doesNotMatch(block, /<text[^>]*hover-class/, name)
  assert.doesNotMatch(block, /v-for="(\(?l\b|l in )/, name)
  assert.doesNotMatch(block, /k-tabbar/, name + '：填写屏不要底栏')
  assert.doesNotMatch(block, /placeholder-class="(?!fc-ph)/, name)
  assert.doesNotMatch(block, /提交 → |k-button|stp__|pub-|form__|frow/, name + '：不留旧写法、不写流程字')
}
const labels = (block) => [...block.matchAll(/<text class="(?:fc-label__t|fc-row__k|fc-group__title)">([^<]+)<\/text>/g)].map(m => m[1])

// ---------------------------------------------------------------- 创建活动

function activities(stubs = {}) {
  const log = { created: [], edited: [], toasts: [], scrolls: [], locks: [], drafts: {} }
  let onLoad = null
  const s = vue.ref(1)
  const h = runSetup('pages/staff/activities.vue', {
    useScreen: (n, o) => { onLoad = o.onLoad; return s }, ensureSession: async () => {}, hasStaffAccess: { value: true }, currentStaffStoreId: () => 102, currentStaffStore: { value: { storeId: 102, storeName: '平潭袋鼠小院', roleCode: 'keeper' } }, merchantStaff: { value: false },
    shiftDate: () => '2026-11-04', todayCn: () => '2026-11-01', staffCan: () => true, toast: m => log.toasts.push(m), back() {}, go() {}, errText: (e, d) => d, absUrl: x => x, pad2: x => String(x).padStart(2, '0'), confirm: async () => true,
    scrollToField: x => log.scrolls.push(x), lockPageScroll: x => log.locks.push(x), modal: async () => ({ confirm: true }),
    apiStaffCreateActivity: async (storeId, p) => { log.created.push([storeId, plain(p)]); return { data: { activityId: 77, message: '已提交' } } },
    apiStaffEditActivity: async (id, p) => { log.edited.push([id, plain(p)]); return { data: { activityId: id, message: '已保存' } } },
    apiStaffActivities: async () => ({ data: { rows: [], counts: {} } }),
    uni: { getSystemInfoSync: () => ({ windowWidth: 375 }), getStorageSync: k => log.drafts[k] || '', setStorageSync: (k, v) => { log.drafts[k] = plain(v) }, removeStorageSync: k => { delete log.drafts[k] } },
    ...FORM, // 2026-11-03：时间滚轮、费用三选一的纯函数用真的（common/activity-form.js）
    ...stubs
  })
  return { ...h, log, s, load: async (q) => { await onLoad(q); await flush() } }
}

test('创建活动：字段一个不少、版式换成 fc-*；顶栏不出浮动钮，操作条左边是客服方块；日历、弹层开着锁背景', () => {
  const h = activities()
  h.stop()
  const t = h.template
  const block = between(t, '<template v-else-if="s === 2">', '<!-- 3 报名数据 -->')
  formRules(block, '创建活动')
  // 2026-11-03 主人：介绍挪到标题上面；地点和地图位置合成一行；费用改成「免费 / 收费 / AA制」三选一
  assert.deepEqual(labels(block), ['粘贴活动文案', '基本信息', '发布内容', '活动类型', '活动封面', '活动介绍', '活动标题', '时间与地点', '开始时间', '结束时间', '活动地点', '人数与费用', '招募人数', '费用设置'])
  assert.match(block, /最多 50 人/)
  assert.match(block, /<view v-for="k in FEE_KINDS" :key="k\[0\]" class="fc-seg__item" :class="\{ on: feeKind === k\[0\] \}" hover-class="k-press" @click="feeKind = k\[0\]">/)
  assert.match(block, /横图、竖图都可以，整张显示不裁剪/)
  assert.doesNotMatch(block, /不收费就填 0|用横图，建议 750×422|k-date-picker/)
  assert.match(t, /<k-topbar :title="s === 2 && editId \? '修改活动' : titles\[s - 1\]" back custom-back :fab="s !== 2" @back="onBack" \/>/)
  assert.match(block, /<view class="fc-bar__btns"><fc-kefu \/><view class="fc-btn fc-btn--ghost" hover-class="k-press-s" @click="saveDraft"><text>保存草稿<\/text><\/view><view class="fc-btn" hover-class="k-press-s" @click="submit"><text>\{\{ editId \? '保存修改' : '提交发布' \}\}<\/text><\/view><\/view>/)
  assert.match(t, /^\s*<!-- #ifdef MP-WEIXIN -->\s*<page-meta :page-style="s === 2 && typeSheet \? 'overflow: hidden' : ''" \/>/, 'page-meta 必须是页面第一个节点')
  // 别的屏的底栏、操作条没动
  assert.match(t, /<view class="act-bar"><k-button block icon="plus" @click="newActivity" :label="createLabel" \/><\/view>\s*<k-tabbar mode="staff" active="work" \/>/)
  assert.match(h.styles, /@import '\.\/form-clean\.scss';/)
  assert.doesNotMatch(h.styles, /create-body|\.intro-box|\.form__row/, '旧版式的样式删掉了')
})

test('创建活动：日期只改显示，今年不写年、跨年写年，存的还是 yyyy-MM-dd；日期和时刻一个滚轮同时选，结束默认开始 + 3 小时', async (t) => {
  const h = activities()
  t.after(h.stop)
  assert.equal(h.run("dayLabel({ date: '2026-11-04' })"), '11月4日 周三')
  assert.equal(h.run("dayLabel({ date: '2027-01-04' })"), '2027年1月4日 周一')
  assert.equal(h.run("dayLabel({ date: '' })"), '')
  assert.equal(h.run("whenLabel({ date: '2026-11-04', time: '14:00' })"), '11月4日 周三 14:00')
  const block = between(h.template, '<template v-else-if="s === 2">', '<!-- 3 报名数据 -->')
  for (const which of ['start', 'end']) {
    assert.ok(block.includes(`<picker mode="multiSelector" :range="when.cols" :value="whenIndex(${which}, when.dates)" @change="setWhen('${which}', $event)">`), which)
  }
  assert.doesNotMatch(h.script, /dayPick|setTime|confirmDay/)
  await h.run('newActivity()')
  await flush()
  assert.deepEqual(plain(h.run('[start.value, end.value]')), [{ date: '2026-11-04', time: '14:00' }, { date: '2026-11-04', time: '17:00' }])
  const dates = plain(h.run('when.value.dates'))
  assert.equal(dates[0], '2026-11-01')
  // 选开始 11-30 22:30 → 结束自动跟到第二天 01:30
  h.run(`setWhen('start', { detail: { value: [${dates.indexOf('2026-11-30')}, 22, 6] } })`)
  assert.deepEqual(plain(h.run('[start.value, end.value]')), [{ date: '2026-11-30', time: '22:30' }, { date: '2026-12-01', time: '01:30' }])
  // 结束早于开始：不改，提示
  h.run(`setWhen('end', { detail: { value: [${dates.indexOf('2026-11-30')}, 20, 0] } })`)
  assert.equal(h.log.toasts.at(-1), '结束时间要晚于开始时间')
  assert.equal(h.run('end.value.time'), '01:30')
  // 自己改过结束时间，再改开始（还早于结束）就不动结束
  h.run(`setWhen('end', { detail: { value: [${dates.indexOf('2026-12-01')}, 9, 0] } })`)
  h.run(`setWhen('start', { detail: { value: [${dates.indexOf('2026-11-30')}, 20, 0] } })`)
  assert.deepEqual(plain(h.run('end.value')), { date: '2026-12-01', time: '09:00' })
  // 开始挪到结束之后，结束重新跟着推
  h.run(`setWhen('start', { detail: { value: [${dates.indexOf('2026-12-02')}, 10, 0] } })`)
  assert.deepEqual(plain(h.run('end.value')), { date: '2026-12-02', time: '13:00' })
})

test('创建活动：标题、地点没填就地标红并滚过去，提示和拦截照旧；没点提交不标红；修改、新建都清掉红字', async (t) => {
  const h = activities()
  t.after(h.stop)
  await h.run('newActivity()')
  await flush()
  assert.deepEqual(plain(h.run('aerr.value')), {}, '没点提交不标红')
  await h.run('submit()')
  assert.deepEqual(plain(h.run('aerr.value')), { title: '请填写活动标题' })
  assert.deepEqual(h.log.scrolls, ['#af-title'])
  assert.equal(h.log.toasts.at(-1), '请填写活动标题')
  h.run("title.value = '   '")
  await h.run('submit()')
  assert.equal(h.log.toasts.at(-1), '请填写活动标题', '只有空格也算没填，规则和原来一样')
  h.run("title.value = '海边'; place.value = ''")
  await h.run('submit()')
  assert.deepEqual(plain(h.run('aerr.value')), { place: '请填写活动地点' })
  assert.deepEqual(h.log.scrolls.at(-1), '#af-place')
  assert.equal(h.log.created.length, 0)
  await h.run('newActivity()')
  await flush()
  assert.deepEqual(plain(h.run('aerr.value')), {}, '再次打开不留红字')
})

test('创建活动：发出去的字段和原来一样（只有填写时选的值）；活动类型从弹层选，点遮罩不改，返回先关弹层', async (t) => {
  const h = activities()
  t.after(h.stop)
  await h.run('newActivity()')
  await flush()
  h.run('typeSheet.value = true')
  await flush()
  assert.equal(h.log.locks.at(-1), true)
  // 2026-11-03 主人：新活动只选这四类（老活动的「手作课程」「讲座沙龙」照常显示、不改就保留）；默认生活体验
  assert.deepEqual(plain(h.run('typeOptions')).map(o => o.value), ['生活体验', '小型聚会', '户外活动', '其他'])
  assert.equal(h.run('type.value'), '生活体验')
  h.run('onBack()')
  assert.equal(h.run('typeSheet.value'), false, '返回先关弹层')
  await flush()
  assert.equal(h.log.locks.at(-1), false)
  h.run("confirmType('户外活动')")
  h.run("title.value = ' 海边 '; people.value = '30'; feeKind.value = 'paid'; fee.value = ''; intro.value = ' 第一行\\n第二行 '")
  await h.run('submit()')
  assert.deepEqual(plain(h.run('aerr.value')), { fee: '请填写每人费用' }, '收费必须填金额')
  assert.equal(h.log.created.length, 0)
  h.run("fee.value = '0'")
  await h.run('submit()')
  assert.match(h.log.toasts.at(-1), /要大于 0/)
  h.run("fee.value = '88.5'")
  await h.run('submit()')
  await flush()
  assert.deepEqual(h.log.created, [[102, { productKind: 'activity', category: '户外活动', title: '海边', cover: '', place: '平潭袋鼠小院', capacity: 30, startTime: '2026-11-04 14:00', endTime: '2026-11-04 17:00', feeKind: 'paid', feeYuan: '88.5', intro: '第一行\n第二行' }]])
  assert.equal(h.s.value, 4)
})

test('创建活动：草稿照旧存本机一份，恢复时带回；介绍超长照旧拦下', async (t) => {
  const h = activities()
  t.after(h.stop)
  await h.run('newActivity()')
  await flush()
  h.run("title.value = '草稿'; intro.value = '介绍'; type.value = '其他'")
  await h.run('saveDraft()')
  const dr = h.log.drafts['kangaroo:staff-activity-draft']
  assert.deepEqual([dr.title, dr.intro, dr.type, dr.editId, dr.place], ['草稿', '介绍', '其他', null, '平潭袋鼠小院'])
  h.run("title.value = ''; intro.value = ''")
  await h.run('newActivity()')
  await flush()
  assert.equal(h.run('title.value'), '草稿')
  assert.equal(h.run('intro.value'), '介绍')
  h.run("intro.value = '字'.repeat(1001)")
  await h.run('submit()')
  assert.match(h.log.toasts.at(-1), /活动介绍最多 1000 字/)
  assert.equal(h.log.created.length, 0)
})

// ---------------------------------------------------------------- 新增 / 编辑房源

const FAC = [{ value: 'ac', label: '空调' }, { value: 'wifi', label: 'Wi-Fi' }, { value: 'hotwater', label: '热水' }, { value: 'washer', label: '洗衣机' }]
const STAY = { stayId: 66, stayName: '小院', address: '平潭', status: 'draft', operateModeLabel: '直营', hostStory: '简介', tags: '', hostName: '', latitude: null, longitude: null, district: '', hostAge: '', hostHometown: '', hostSkills: '', travelPros: '', travelCons: '', travelAirport: '', travelRail: '', facilities: 'ac,legacy', cookable: '1', quals: [] }
function rooms(stubs = {}) {
  const log = { created: [], edited: [], toasts: [], scrolls: [], locks: [], routes: [] }
  const s = vue.ref(1)
  const h = runSetup('pages/staff/rooms.vue', {
    useScreen: () => s, ensureSession: async () => {}, hasStaffAccess: { value: true }, currentStaffStoreId: () => 102, experience: { account: { phone: '13800001234' } }, toast: m => log.toasts.push(m), errText: (e, d) => d, absUrl: x => x, back() {}, go: url => log.routes.push(url), coordinates: () => null,
    scrollToField: x => log.scrolls.push(x), lockPageScroll: x => log.locks.push(x), todayCn: () => '2026-11-01', shiftDate: () => '2026-11-08', isYmd: () => true,
    apiStaffStays: async () => ({ data: { rows: [], stats: {}, tabs: {}, operateModeLabel: '直营' } }), apiStaffStay: async () => ({ data: { ...STAY } }), get: async () => ({ data: { districts: ['流水镇'], facilities: FAC } }),
    apiStaffCreateStay: async (id, p) => { log.created.push([id, plain(p)]); return { data: { stayId: 88, status: 'draft' }, msg: '已保存' } }, apiStaffEditStay: async (id, p) => { log.edited.push([id, plain(p)]); return { data: { stayId: id }, msg: '已保存' } },
    uni: { getStorageSync: () => '', setStorageSync() {}, removeStorageSync() {} },
    ...stubs
  })
  return { ...h, log, s }
}

test('新增房源：字段一个不少；五个假圈换成一句话，步数按真实流程；头像去掉；来源类型只读不画成能选；操作条有客服方块', (t) => {
  const h = rooms()
  t.after(h.stop)
  const tpl = h.template
  const block = between(tpl, '<template v-else-if="s === 2">', '<!-- 3 资质上传与审核')
  formRules(block, '新增房源')
  // 2026-11-03 简化「更多」：商圈、位置描述、房源封面并进表单（原来在「更多」里各弹各的系统框）
  assert.deepEqual(labels(block), ['房源信息', '房源名称', '房源地址', '{{ locationButtonLabel }}', '所在区县', '商圈', '位置描述', '来源类型', '房源封面', '主理人与介绍', '主理人', '房源简介', '配套设施', '标签', '主理人{{ f.label }}', '{{ f.label }}'])
  assert.deepEqual(plain(h.run('HOST_FIELDS')).map(f => f.label), ['年龄', '籍贯', '擅长'])
  assert.deepEqual(plain(h.run('TRAVEL_FIELDS')).map(f => f.label), ['优点', '缺点', '机场怎么到', '高铁怎么到'])
  for (const w of ['选好后住客可以导航到店', '更多选填', '标签、主理人年龄籍贯擅长、出行参考', '下面四段是出行参考，住客在房源详情页能看到，没填的不显示。', 'f.placeholder', '{{ editableTip }}', '添加标签', '{{ hostPhone }}']) assert.ok(block.includes(w), w)
  assert.match(block, /<text class="fc-steps__t">1 \/ 3 · 基本信息<\/text><text>下一步设置房型与价格<\/text>/)
  assert.doesNotMatch(h.script, /steps2|steps4|opChoices/, '假的步骤、假的选项删掉了')
  assert.doesNotMatch(block, /profile-avatar|rooms-host/, '写死的默认头像去掉（2026-11-03 起表单里的 <image> 是房源封面，不是头像）')
  assert.match(block, /<view class="fc-row" hover-class="k-press" @click="typeTip"><text class="fc-row__k">来源类型<\/text><text class="fc-row__v fc-row__v--plain">\{\{ form\.type \|\| '—' \}\}<\/text><\/view>/)
  assert.match(block, /<view class="fc-bar__btns"><fc-kefu \/><view class="fc-btn fc-btn--ghost" hover-class="k-press-s" @click="saveStay\(false\)"><text>保存草稿<\/text><\/view><view class="fc-btn" hover-class="k-press-s" @click="saveStay\(true\)"><text>下一步<\/text><\/view><\/view>/)
  assert.match(tpl, /<k-topbar :title="titles\[s - 1\]" back custom-back :fab="s === 1 \|\| s === 5" @back="onBack" \/>/, '第 2、3、4 屏字段从屏幕边开始，不出浮动钮')
  // 2026-11-03：设施改成直接摊开点选，没有设施弹层了，只剩日历开着时锁滚动
  assert.match(tpl, /^\s*<!-- #ifdef MP-WEIXIN -->\s*<page-meta :page-style="datePick \? 'overflow: hidden' : ''" \/>/)
  // 第 5 屏不动：还有底栏，不用填写屏的样式
  const media = between(tpl, '<view v-else-if="s === 5" class="k-body media-body">', '<!-- 4 Vlog 上传与审核')
  assert.match(media, /<k-tabbar mode="staff" active="work" \/>/)
  assert.doesNotMatch(media, /fc-/)
  for (const c of ['.notice {', '.sec-title {', '.trip-hint {', '.pick {', '.picks {', '.mcard {', '.fab-bar {']) assert.ok(h.styles.includes(c), c + ' 第 1、5 屏还在用')
})

test('新增房源：名称、地址没填就地标红并滚过去，提示和拦截照旧；发出去的字段不变', async (t) => {
  const h = rooms()
  t.after(h.stop)
  await h.run('newStay()')
  await flush()
  assert.deepEqual(plain(h.run('rerr.value')), {})
  await h.run('saveStay(true)')
  assert.deepEqual(plain(h.run('rerr.value')), { name: '请填写房源名称', addr: '请填写房源地址' })
  assert.deepEqual(h.log.scrolls, ['#rf-name'])
  assert.equal(h.log.toasts.at(-1), '请填写房源名称')
  h.run("form.name = ' 小院 '")
  await h.run('saveStay(true)')
  assert.deepEqual(h.log.scrolls.at(-1), '#rf-addr')
  assert.equal(h.log.toasts.at(-1), '请填写房源地址')
  assert.equal(h.log.created.length, 0)
  h.run("form.addr = ' 平潭 '; form.desc = '简介'; form.tags = ['海景']; form.hostName = '阿东'; form.district = '流水镇'; form.hostAge = '90后'; form.travelRail = '公交'; form.facilities = ['wifi']; form.cookable = true")
  await h.run('saveStay(true)')
  await flush()
  // 2026-11-03：多带 area / areaDesc / cover（商圈、位置描述、封面并进表单）
  assert.deepEqual(h.log.created, [[102, { stayName: '小院', address: '平潭', hostStory: '简介', tags: '海景', hostName: '阿东', latitude: null, longitude: null, district: '流水镇', hostAge: '90后', hostHometown: '', hostSkills: '', travelPros: '', travelCons: '', travelAirport: '', travelRail: '公交', facilities: 'wifi', cookable: '1', area: '', areaDesc: '', cover: '' }]])
  assert.deepEqual(h.log.routes, ['/pages/staff/room-types?stayId=88&flow=listing'], '草稿保存后进入房型和价格')
  assert.equal(h.s.value, 3, '完成房型页后返回资质屏')
  assert.deepEqual(plain(h.run('rerr.value')), {})
})

test('房源设施（2026-11-03 主人：「增加一个对勾，你点一下对勾就选中」）：选项直接摊开，点一下选中 / 再点取消；选中的有对勾；字典外的老代码不列、不动；可做饭在同一组', async (t) => {
  const h = rooms()
  t.after(h.stop)
  await h.run('openStay(66, 2)')
  await flush()
  assert.deepEqual(plain(h.run('facChoices.value')), [...FAC, { label: '可做饭', value: '__cookable' }])
  assert.deepEqual(FAC.concat([{ value: '__cookable' }]).filter(o => h.run(`facPicked('${o.value}')`)).map(o => o.value), ['ac', '__cookable'], '字典里没有的 legacy 不列出来')
  assert.deepEqual(plain(h.run('facNames.value')), ['空调', '可做饭'])
  // 点一下取消空调和可做饭，再点 Wi-Fi、热水
  h.run("tapFacility('ac'); tapFacility('__cookable'); tapFacility('wifi'); tapFacility('hotwater')")
  assert.deepEqual(plain(h.run('form.facilities')), ['legacy', 'wifi', 'hotwater'], '去掉的去掉，新选的排到后面，老代码留着')
  assert.equal(h.run('form.cookable'), false)
  assert.equal(h.run("facPicked('wifi')"), true)
  assert.equal(h.run("facPicked('ac')"), false)
  h.run("tapFacility('wifi'); tapFacility('hotwater')")
  assert.deepEqual(plain(h.run('form.facilities')), ['legacy'])
  assert.deepEqual(plain(h.run('facNames.value')), [])
  await h.run('saveStay(false)')
  assert.equal(h.log.edited[0][1].facilities, 'legacy')
  assert.equal(h.log.edited[0][1].cookable, '0')
  // 模板：不再有弹层；每个选项一个格子，选中加 fac-chip--on 和对勾，没选是空心圈
  const block = between(h.template, '<template v-else-if="s === 2">', '<!-- 3 资质上传与审核')
  assert.doesNotMatch(block, /<fc-sheet/)
  assert.match(block, /<view v-for="o in facChoices" :key="o\.value" class="fac-chip" :class="\{ 'fac-chip--on': facPicked\(o\.value\) \}" hover-class="k-press-s" @click="tapFacility\(o\.value\)">/)
  assert.match(block, /<view class="fac-chip__mark"><k-icon v-if="facPicked\(o\.value\)" name="check"/)
  assert.match(h.styles, /\.fac-chip \{[^}]*min-height: 48px;/)
  assert.match(h.styles, /\.fac-chip--on \{[^}]*background: var\(--k-red-deep\);/)
})

test('房源更多选填：新建收起；打开时里面有内容就展开并数得对；没有就收起', async (t) => {
  const h = rooms()
  t.after(h.stop)
  await h.run('newStay()')
  await flush()
  assert.equal(h.run('moreOpen.value'), false)
  assert.equal(h.run('moreFilled.value'), 0)
  await h.run('openStay(66, 2)')
  assert.equal(h.run('moreOpen.value'), false, '折叠区里都没填：收起')
  const filled = rooms({ apiStaffStay: async () => ({ data: { ...STAY, tags: '海景,石头厝', hostAge: '90后', travelRail: '公交' } }) })
  t.after(filled.stop)
  await filled.run('openStay(66, 2)')
  assert.equal(filled.run('moreOpen.value'), true, '里面有内容，不让人以为东西丢了')
  assert.equal(filled.run('moreFilled.value'), 3, '标签算一项')
})

test('资质屏：每份两行，已传显示文件和状态，过期标红；驳回用提醒色，别的状态不用；第 3 步统一提交', async (t) => {
  const quals = [
    { type: 'license', title: '营业执照', required: true, uploaded: true, expired: false, file: 'a.jpg', size: '1MB', expire: '2029-06-30', url: '/a.jpg', isPdf: false },
    { type: 'fire', title: '消防', required: true, uploaded: true, expired: true, file: 'b.pdf', size: '2MB', expire: '2025-01-01', url: '/b.pdf', isPdf: true },
    { type: 'special', title: '特种行业', required: false, uploaded: false }
  ]
  const h = rooms({ apiStaffStay: async () => ({ data: { ...STAY, quals } }) })
  t.after(h.stop)
  await h.run('openStay(66, 3)')
  const docs = plain(h.run('docs.value'))
  assert.deepEqual(docs.map(d => d.state), ['已上传', '已过期', '未上传'])
  assert.deepEqual(docs.map(d => d.expired), [false, true, false])
  assert.equal(docs[1].size, '2MB · 已过期', '过期这句没丢')
  assert.equal(docs[2].hint, '（如有）')
  assert.equal(docs[2].expire, '未填写')
  assert.equal(h.run('rejectBox.value.btn'), '提交审核')
  assert.notEqual(h.run('rejectBox.value.alert'), true)
  await h.run('openStay(66, 3)')
  const rejected = rooms({ apiStaffStay: async () => ({ data: { ...STAY, status: 'rejected', auditReason: '证件过期', auditTime: '2026-10-30 10:20:00' } }) })
  t.after(rejected.stop)
  await rejected.run('openStay(66, 3)')
  assert.equal(rejected.run('rejectBox.value.alert'), true)
  assert.equal(rejected.run('rejectBox.value.desc'), '驳回原因：证件过期')
  assert.equal(rejected.run('rejectBox.value.btn'), '重新提交')
  const block = between(h.template, '<template v-else-if="s === 3">', '<!-- 5 视频与生活碎片')
  formRules(block, '资质屏')
  assert.match(block, /<text class="fc-steps__t">3 \/ 3 · 资质与提交<\/text><text>补齐后统一提交审核<\/text>/)
  assert.match(block, /请上传清晰、完整的资质图片或PDF，支持 JPG\/PNG\/PDF 格式，图片不超过20MB、PDF不超过10MB。/)
  assert.match(block, /@click="tapDoc\(d\)"/)
  assert.match(block, /@click="editExpire\(d\)"/)
  assert.match(block, /:class="\{ 'fc-notice--alert': rejectBox\.alert \}"/)
  assert.match(block, /<view v-if="rejectBox\.btn \|\| merchantStaff" class="fc-bar"><view class="fc-bar__btns"><fc-kefu \/><view v-if="rejectBox\.btn" class="fc-btn" hover-class="k-press-s" @click="resubmit"><text>\{\{ rejectBox\.btn \}\}<\/text><\/view><\/view><\/view>/, '没有要提交的时候：别的角色不出操作条，商家留着客服方块')
  assert.match(h.script, /import \{[^}]*\bmerchantStaff\b[^}]*\} from '@\/common\/experience\.js'/)
  // 审核进度字不小于 13px（原来 9、11px）
  const sizes = [...between(h.styles, '/* 资质（s=3）', '/* Vlog（s=4）').matchAll(/font-size: (\d+)px/g)].map(m => Number(m[1]))
  assert.ok(sizes.length && Math.min(...sizes) >= 13, String(sizes))
  assert.doesNotMatch(h.styles, /\.k-pad-tab \.timeline/, '压小字的规则删掉了')
})

test('Vlog 屏：五个假圈去掉；字段一个不少；黄框改成灰字；草稿、提交的函数名没变', (t) => {
  const h = rooms()
  t.after(h.stop)
  const block = between(h.template, '<view v-else class="fc-form vlog-body">', '<!-- 房态日期')
  formRules(block, 'Vlog 屏')
  assert.deepEqual(labels(block), ['上传视频', '封面图', '来源平台', '视频链接', '内容标题'])
  for (const w of ['{{ vlogTip }}', '@click="previewVideo"', '@click="addMore"', '@click="pickCover"', '@click="copyLink"', '@click="saveVlogDraft"', '@click="submitVlog()"', '建议每周至少发布 2 条优质 Vlog，保持活跃度有助于提升曝光与转化。']) assert.ok(block.includes(w), w)
  assert.match(block, /<text class="fc-footnote">建议每周/)
  assert.doesNotMatch(h.template, /stp|class="freq/)
})

// ---------------------------------------------------------------- 发布线上任务

function online(stubs = {}) {
  const log = { created: [], puts: [], toasts: [], scrolls: [], locks: [], confirms: [] }
  let onLoad = null
  const s = vue.ref(1)
  const h = runSetup('pages/staff/online-jobs.vue', {
    useScreen: (n, o) => { onLoad = o.onLoad; return s }, ensureSession: async () => {}, currentStaffStoreId: () => 102, onlineStaff: { value: false }, merchantStaff: { value: false }, R: { staff: '/pages/staff/index' },
    todayCn: () => '2026-11-01', shiftDate: () => '2026-11-08', toast: m => log.toasts.push(m), confirm: async (a, m) => { log.confirms.push(m); return true }, alert: async () => {}, errText: (e, d) => d, go() {}, back() {},
    scrollToField: x => log.scrolls.push(x), lockPageScroll: x => log.locks.push(x),
    apiOnlineCreate: async (p, id) => { log.created.push([id, plain(p)]); return { data: { jobId: 88, message: '已提交平台审核' } } }, apiOnlineTask: async () => ({ data: { jobId: 88 } }),
    ...stubs
  })
  return { ...h, log, s, load: async (q) => { await onLoad(q); await flush() } }
}

test('发布线上任务：字段一个不少、四组 + 更多选填；提交按钮挪到固定操作条，这一屏去掉底栏；不写流程字', (t) => {
  const h = online()
  t.after(h.stop)
  const tpl = h.template
  const block = between(tpl, '<view v-if="s === 1" class="fc-form publish-page">', '<view v-else-if="s === 2"')
  formRules(block, '线上任务')
  assert.deepEqual(labels(block), ['发布费用', '任务信息', '任务标题', '任务类型', '交付与截止', '交付物', '预计完成时间', '报酬与名额', '接单人报酬', '每人交付条数上限', '单人佣金', '名额', '验收', '验收标准', '账号与参与要求', '预计耗时', '任务描述'])
  for (const w of ['至少晚于现在2小时', '验收通过后由门店线下结算给接单人', '元 / 人', '预计耗时、任务描述', '最多 3 条，每条 40 字以内', '/3 条', '按模板生成（非 AI）', '/300', '退回原因：{{ resubmit.reason }}']) assert.ok(block.includes(w), w)
  assert.match(block, /<text class="fc-footnote">拍摄要点、参考图、文件等素材，接单后在「交付记录」里发给接单人（文字、图片、文件都行），这里不用传。<\/text>/)
  assert.match(tpl, /<k-topbar :title="titles\[s - 1\]" back custom-back :fab="s !== 1" @back="onBack" \/>/)
  // 2026-11-03 简化：操作条按钮上面一行一直写着还差什么 / 可以提交（和招募表一样），提交不再弹确认框
  assert.match(tpl, /<view v-if="s === 1" class="fc-bar"><view class="fc-bar__todo"[^>]*@click="showTodo"><text>\{\{ todoText \}\}<\/text><\/view><view class="fc-bar__btns"><fc-kefu \/><view class="fc-btn" hover-class="k-press-s" @click="publish"><text>\{\{ merchantStaff \? '提交' : '提交审核' \}\}<\/text><\/view><\/view><\/view>/)
  assert.match(tpl, /<k-tabbar v-if="s !== 1" mode="staff" :active="onlineStaff \? 'work' : 'business'" \/>/)
  assert.match(tpl, /^\s*<!-- #ifdef MP-WEIXIN -->\s*<page-meta :page-style="publishOverlayOpen \? 'overflow: hidden' : ''" \/>/)
  for (const id of ['of-title', 'of-deliverables', 'of-commission', 'of-criteria']) assert.ok(block.includes('id="' + id + '"'), id)
  // 接待设置（换工主理人、小院主理人才看得到）：功能还在，发布屏排到表单最后，别的屏还在最上面
  assert.match(tpl, /<k-chat-reception v-if="s !== 1" :store-id="taskStore \|\| sid\(\)" \/>/)
  assert.match(block, /这里不用传。<\/text>\s*<k-chat-reception :store-id="taskStore \|\| sid\(\)" \/>\s*<\/view>\s*$/)
  // 第 2、3、4 屏的类名没被样式清理碰到
  assert.match(h.styles, /\.deadline\.is-over\{color:var\(--k-alert\)\}/)
})

test('线上任务：任务类型、预计耗时和截止日历；弹层打开时返回先关弹层', async (t) => {
  let backs = 0
  const h = online({ back: () => backs++ })
  t.after(h.stop)
  assert.equal(h.run('sheetConf.value'), null)
  h.run("openSheet('taskType')")
  assert.deepEqual(plain(h.run('sheetConf.value')).options.map(o => o.value), ['内容写作', '图片设计', '视频剪辑', '社群运营', '数据整理', '其他'])
  assert.equal(h.run('sheetConf.value.value'), '内容写作')
  h.run("confirmSheet('视频剪辑')")
  assert.equal(h.run('form.value.taskType'), '视频剪辑')
  assert.equal(h.run('sheetKey.value'), '')
  h.run('deadlineCalendar.value = true')
  await flush()
  assert.equal(h.log.locks.at(-1), true)
  h.run('onBack()')
  await flush()
  assert.equal(h.run('deadlineCalendar.value'), false)
  assert.equal(h.log.locks.at(-1), false)
  assert.equal(backs, 0)
  h.run('onBack()')
  assert.equal(backs, 1)
  h.run("openSheet('estHours')")
  const est = plain(h.run('sheetConf.value'))
  assert.deepEqual(est.options.map(o => o.value), ['1 小时内', '约 2 小时', '半天', '1 天', '2–3 天'])
  assert.deepEqual([est.emptyLabel, est.customLabel, est.customMax], ['不选', '＋ 自己写一个', 16])
  h.run("confirmSheet('半天')")
  assert.equal(h.run('form.value.estHours'), '半天')
  assert.equal(h.run('moreFilled.value'), 1)
  h.run("openSheet('estHours'); confirmSheet('')")
  assert.equal(h.run('form.value.estHours'), '')
  assert.equal(h.run('deadlineLabel.value'), '2026年11月8日 18:00')
  assert.equal(h.run('form.value.deadline'), '2026-11-08 18:00', '存的、提交的格式不变')
  h.run("form.value.deadline = '2027-01-04 09:30'")
  assert.equal(h.run('deadlineLabel.value'), '2027年1月4日 09:30')
  // 弹层开着时返回先关弹层、切屏也收起
  h.run("openSheet('taskType')")
  h.run('onBack()')
  assert.equal(h.run('sheetKey.value'), '')
})

test('线上任务：提交报错滚到从上往下第一个错，提示和拦截照旧；发出去的字段不变；提交后收起', async (t) => {
  const h = online()
  t.after(h.stop)
  await h.run('publish()')
  assert.deepEqual(h.log.scrolls, ['#of-title'])
  assert.equal(h.log.toasts.at(-1), '请填写任务标题')
  h.run("form.value.title = '探店'")
  await h.run('publish()')
  assert.deepEqual(h.log.scrolls.at(-1), '#of-deliverables')
  assert.equal(h.log.toasts.at(-1), '请填写交付物和验收标准')
  h.run("form.value.deliverables = '图文'")
  await h.run('publish()')
  assert.deepEqual(h.log.scrolls.at(-1), '#of-commission', '页面上佣金在验收标准上面')
  assert.equal(h.log.toasts.at(-1), '请填写交付物和验收标准', '提示的先后和原来一样')
  h.run("form.value.criteria = '原创'")
  await h.run('publish()')
  assert.equal(h.log.toasts.at(-1), '请填写佣金')
  assert.equal(h.log.created.length, 0)
  h.run("setCommission('12.5'); moreOpen.value = true; form.value.estHours = '半天'")
  for (const field of ['title', 'deliverables', 'criteria']) {
    const original = h.run(`form.value.${field}`)
    h.run(`form.value.${field} = '   '`)
    await h.run('publish()')
    assert.equal(h.log.scrolls.at(-1), '#of-' + field)
    assert.equal(h.log.created.length, 0)
    h.run(`form.value.${field} = ${JSON.stringify(original)}`)
  }
  await h.run('publish()')
  await flush()
  assert.deepEqual(h.log.created, [[102, { title: '探店', taskType: '内容写作', deliverables: '图文', deadline: '2026-11-08 18:00', commissionFen: 1250, itemsPerPerson: 1, quota: 3, criteria: '原创', description: '', estHours: '半天', requirements: [] }]])
  assert.equal(h.run('moreOpen.value'), false)
  assert.equal(h.s.value, 2)
})

test('线上任务：改被退回的任务，折叠区有内容就展开；都没有就收起', async (t) => {
  const task = { requestId: 5, canEdit: true, title: '推文', returnReason: '佣金不对', job: { taskType: '内容写作', deliverables: '推文', criteria: '原创', commissionFen: 500, headcount: 2, content: '推文', requirement: '有账号', estHours: '', deadlineTime: '2026-11-20 18:00:00' } }
  const empty = online({ get: async () => ({ data: task }) })
  t.after(empty.stop)
  await empty.load({ s: '1', requestId: '5', storeId: '102' })
  assert.equal(empty.run('moreOpen.value'), false, '任务描述和交付物一样、算没填')
  assert.deepEqual(plain(empty.run('form.value.requirements')), ['有账号'])
  const filled = online({ get: async () => ({ data: { ...task, job: { ...task.job, content: '描述', requirement: '有账号\n会排版', estHours: '半天' } } }) })
  t.after(filled.stop)
  await filled.load({ s: '1', requestId: '5', storeId: '102' })
  assert.equal(filled.run('moreOpen.value'), true)
  assert.equal(filled.run('moreFilled.value'), 2)
  assert.deepEqual(plain(filled.run('form.value.requirements')), ['有账号', '会排版'])
  assert.equal(filled.run('resubmit.value.reason'), '佣金不对')
})

// ---------------------------------------------------------------- 共用的小动作

test('fc-page.js：滚到字段（小程序按 selector，留出顶栏）；网页版锁背景能开能关、重复调用不乱；不进主包', async () => {
  const mod = await import(pathToFileURL(path.join(APP, 'pages/staff/fc-page.js')).href + '?t=' + Date.now())
  const calls = []
  const saved = { uni: globalThis.uni, document: globalThis.document, window: globalThis.window }
  globalThis.uni = { pageScrollTo: o => calls.push(o), getSystemInfoSync: () => ({ statusBarHeight: 44 }) }
  try {
    mod.scrollToField('#af-title')
    assert.deepEqual(calls, [{ selector: '#af-title', duration: 200, offsetTop: -100 }], '顶栏 = 状态栏 + 44，再留 12')
    // 条件编译的 H5 分支在这里也会跑：有 document 时按真实位置算，停在吸顶顶栏下面
    globalThis.window = { pageYOffset: 500 }
    globalThis.document = { querySelector: () => ({ getBoundingClientRect: () => ({ top: 80 }) }), body: { style: { overflow: 'auto' } } }
    calls.length = 0
    mod.scrollToField('#af-place')
    assert.deepEqual(calls, [{ scrollTop: 480, duration: 200 }])
    mod.lockPageScroll(true)
    mod.lockPageScroll(true)
    assert.equal(globalThis.document.body.style.overflow, 'hidden')
    mod.lockPageScroll(false)
    assert.equal(globalThis.document.body.style.overflow, 'auto', '解开后恢复原来的值')
    mod.lockPageScroll(false)
    assert.equal(globalThis.document.body.style.overflow, 'auto')
  } finally {
    globalThis.uni = saved.uni
    globalThis.document = saved.document
    globalThis.window = saved.window
  }
  assert.doesNotMatch(src('common/api.js') + src('common/routes.js'), /fc-page/)
})

test('三页都引 form-clean.scss 和两个组件；底部弹层比网页版的系统输入框、提示低一层，不然「自己写一个」点不到', () => {
  // 2026-11-03：rooms.vue 的设施改成直接点选，不再用底部弹层（也就不用 lockPageScroll），只核对样式和客服方块
  const roomsSrc = src('pages/staff/rooms.vue')
  assert.match(roomsSrc, /@import '\.\/form-clean\.scss';/)
  assert.match(roomsSrc, /import FcKefu from '\.\/components\/fc-kefu\.vue'/)
  assert.match(roomsSrc, /import \{ scrollToField \} from '\.\/fc-page\.js'/)
  assert.doesNotMatch(roomsSrc, /fc-sheet\.vue|lockPageScroll/)
  for (const rel of ['pages/staff/activities.vue', 'pages/staff/online-jobs.vue']) {
    const t = src(rel)
    assert.match(t, /@import '\.\/form-clean\.scss';/, rel)
    assert.match(t, /import FcSheet from '\.\/components\/fc-sheet\.vue'/, rel)
    assert.match(t, /import FcKefu from '\.\/components\/fc-kefu\.vue'/, rel)
    assert.match(t, /import \{ scrollToField, lockPageScroll \} from '\.\/fc-page\.js'/, rel)
    assert.match(t, /onHide\(\(\) => lockPageScroll\(false\)\)\s+onUnload\(\(\) => lockPageScroll\(false\)\)/, rel)
  }
  const z = /\.fc-sheet \{[^}]*z-index: (\d+);/.exec(src('pages/staff/components/fc-sheet.vue'))
  assert.ok(z && Number(z[1]) < 999 && Number(z[1]) > 50, '要盖住操作条、底栏，又不能盖住系统弹窗：' + (z && z[1]))
  const scss = src('pages/staff/form-clean.scss')
  assert.match(scss, /\.fc-pick__t \{ white-space: nowrap; \}/, '网页版 text 自带换行，字要单独写不换行')
  assert.match(scss, /\.fc-when \{[^}]*flex-wrap: wrap;/, '放不下时整个按钮折行，字不拆开')
})
