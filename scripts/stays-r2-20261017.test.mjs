// 2026-10-17 旅居改版 R2 第一部分（主人效果图 6 小院列表、7 小院详情）的回归（node --test，不构建、不发请求）。
// 主人拍板：不接大模型，「出行参考」由员工在员工端 / 后台手填；其余照旧按数据显示。守住这几件事：
//   · 列表「位置」下拉：「全部位置」+ 这座城市有房源的区县（/app/stay/districts，带家数），房源填过商圈时再列一组商圈；
//     区县、商圈二选一，选了按 district / area 精确筛；列表卡位置一行带上区县；
//   · 「房型」面板配套设施 = 停车 / 空调 / 可做饭 / 学习室 / 健身房（学习室、健身房是 V51 补进字典的），整页筛选也能勾；每行铺满不留空洞；
//   · 详情「小院主理人」：称呼 / 年龄 / 籍贯 / 擅长只放填了的，小院评分 + 主理人评分（服务端算的服务分平均）；
//     「出行参考」卡：优点 / 缺点 / 机场 / 高铁只放填了的，都没填时整张卡不出现，卡上不写 AI；
//   · 员工端编辑表单：所在区县（从这座城市的区县里选，也能手填）、主理人年龄 / 籍贯 / 擅长、配套设施（读字典）、出行参考四段，保存时一起带上；
//   · 新接口都在分包里直接调（request.js 的 get），不往主包 common/api.js 里加。
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'
import test from 'node:test'
import assert from 'node:assert/strict'
import * as ui from '../pages/stays/stays-ui.js'
import icons from '../common/icons.js'

const APP = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const ROOT = path.join(APP, '..')
const require = createRequire(path.join(APP, 'package.json'))
const compiler = require('@vue/compiler-sfc'), vue = require('vue')
const read = (rel) => fs.readFileSync(path.join(APP, rel), 'utf8').replace(/\r\n/g, '\n')
const readSfc = (rel) => compiler.parse(read(rel), { filename: rel }).descriptor
const java = (rel) => fs.readFileSync(path.join(ROOT, 'RuoYi-Vue', 'ruoyi-kangaroo', 'src', 'main', 'java', 'com', 'ruoyi', 'kangaroo', rel), 'utf8').replace(/\r\n/g, '\n')
const flush = () => new Promise(resolve => setImmediate(resolve))
const noComments = (t) => t.replace(/<!--[\s\S]*?-->/g, '')
const list = readSfc('pages/stays/list.vue')
const detail = readSfc('pages/stays/detail.vue')
const rooms = readSfc('pages/staff/rooms.vue')
const listT = list.template.content
const detailT = detail.template.content
const roomsT = rooms.template.content
const C = (fn) => ({ get value() { return fn() } })

// 把 list.vue 的 <script setup> 放进沙箱跑：接口换成记录参数的假函数，stays-ui.js 用真的
function runList({ areas = [], districts = [], all = 0 } = {}) {
  const source = list.scriptSetup.content
  const ast = compiler.babelParse(source, { sourceType: 'module' })
  const body = ast.program.body.filter(n => n.type !== 'ImportDeclaration').map(n => source.slice(n.start, n.end)).join('\n')
  const sandbox = { console, setTimeout, clearTimeout, setInterval, clearInterval }
  for (const n of ast.program.body.filter(n => n.type === 'ImportDeclaration')) for (const s of n.specifiers) sandbox[s.local.name] = () => new Promise(() => {})
  const calls = [], gets = [], screen = {}
  Object.assign(sandbox, ui, {
    stayBookingEnabled: vue.ref(true), refreshFeatures: async () => ({ stayBookingEnabled: true }),
    ref: vue.ref, reactive: vue.reactive, computed: vue.computed, watch: vue.watch, onUnmounted() {}, onReachBottom() {},
    useScreen: (max, extra) => { screen.s = vue.ref(1); screen.extra = extra; return screen.s },
    stayState: vue.reactive({ city: '', checkIn: '2026-10-17', checkOut: '2026-10-18', guests: 1 }), normalizeDates() {}, saveStayState() {},
    dotText: () => '', apiStayCities: async () => ({ data: [{ city: '哈尔滨', count: 5 }] }), apiStayAreas: async () => ({ data: areas }),
    get: async (url, q) => { gets.push([url, q]); return url === '/app/stay/districts' ? { data: { city: '哈尔滨', all, districts } } : { data: {} } },
    apiStayList: async (p) => { calls.push(p); return { data: { rows: [], total: 0, hasMore: false, counts: { all: 0, direct: 0, managed: 0 } } } },
    yuan: (fen) => String(Number(fen) / 100), errText: (e, d) => d, toast() {},
    experience: vue.reactive({ cities: [] }), uni: { getStorageSync() {}, setStorageSync() {} }
  })
  vm.createContext(sandbox)
  const scope = vue.effectScope()
  scope.run(() => vm.runInContext(body + '\n;globalThis.__x = { dd, toggleDd, filter, filterBar, districtOpts, districtSpans, areaChoices, areaSpans, applyDistrict, applyArea, pickPlace, ' +
    'PANEL_FACS, draft, toggleDraftFac, applyDraft, facilities, facGridSpans, reset, areaFilterText }', sandbox, { filename: 'list.vue:script-setup' }))
  return { x: sandbox.__x, calls, gets, screen, stop: () => scope.stop() }
}
const lastList = (calls) => calls.filter(p => p.pageSize !== 1).slice(-1)[0]
const rowsFill = (spans) => { let row = 0; for (const sp of spans) { row += sp; if (row === 12) row = 0; assert.ok(row < 12) } return row === 0 }

test('stays-ui：区县选项、位置一行、主理人几行、出行参考几行、评分写法', () => {
  assert.deepEqual(ui.districtChoices([{ name: '道外区', count: 3 }, { name: '南岗区', count: 1 }], 5),
    [{ value: '', label: '全部位置(5)' }, { value: '道外区', label: '道外区(3)' }, { value: '南岗区', label: '南岗区(1)' }])
  assert.deepEqual(ui.districtChoices(null, 0), [{ value: '', label: '全部位置' }])
  assert.deepEqual(ui.districtChoices([{ name: '' }, null, { name: '宾', count: 2 }], 2).map(o => o.label), ['全部位置(2)', '宾(2)'], '县名原样（V25 去掉了「县」字的也不改）')
  assert.equal(ui.whereLine('道外区', '中央大街步行 5 分钟'), '道外区 · 中央大街步行 5 分钟')
  assert.equal(ui.whereLine('古城区', '古城区七一街 3 号'), '古城区七一街 3 号', '位置描述里写了区县的不重复')
  assert.equal(ui.whereLine('', '近古城'), '近古城')
  assert.equal(ui.whereLine('道外区', ''), '道外区')
  assert.equal(ui.whereLine(null, null), '')
  assert.deepEqual(ui.hostFacts({ name: '阿东', age: '90后', hometown: ' ', skills: '做饭、徒步' }),
    [{ k: '称呼', v: '阿东' }, { k: '年龄', v: '90后' }, { k: '擅长', v: '做饭、徒步' }])
  assert.deepEqual(ui.hostFacts(null), [])
  assert.deepEqual(ui.travelRows({ pros: '近古城', cons: '', airport: '打车 40 分钟', rail: null }), [{ k: '优点', v: '近古城' }, { k: '机场', v: '打车 40 分钟' }])
  assert.deepEqual(ui.travelRows({}), [])
  assert.deepEqual(ui.travelRows(undefined), [])
  assert.equal(ui.scoreText(4), '4.0')
  assert.equal(ui.scoreText(4.67), '4.7')
  assert.equal(ui.scoreText(null), '')
  assert.equal(ui.scoreText(0), '')
})

test('列表「位置」下拉：全部位置 + 有房源的区县（带家数）+ 商圈一组；区县、商圈二选一，选了直接按它查', async () => {
  const h = runList({ districts: [{ name: '道外区', count: 3 }, { name: '南岗区', count: 1 }], all: 5, areas: [{ area: '中央大街', count: 2 }] })
  h.screen.extra.onLoad({ city: '哈尔滨' }); await flush(); await flush()
  assert.ok(h.gets.some(([u, q]) => u === '/app/stay/districts' && q.city === '哈尔滨'), '按当前城市取区县')
  h.screen.s.value = 2; await flush()
  const { x } = h
  x.toggleDd('area')
  assert.deepEqual([...x.districtOpts.value.map(o => o.label)], ['全部位置(5)', '道外区(3)', '南岗区(1)'])
  assert.deepEqual([...x.districtSpans.value], [4, 4, 4])
  assert.deepEqual([...x.areaChoices.value.map(o => o.label)], ['中央大街(2)'])
  assert.deepEqual([...x.areaSpans.value], [12])
  x.applyDistrict('道外区'); await flush()
  assert.equal(x.dd.value, '')
  assert.equal(lastList(h.calls).district, '道外区')
  assert.equal(lastList(h.calls).area, undefined)
  assert.equal(x.filterBar.value[0].set, true, '选了区县，「位置」胶囊标成已选')
  assert.equal(x.filter.district, '道外区')
  x.applyArea('中央大街'); await flush()
  assert.equal(lastList(h.calls).area, '中央大街')
  assert.equal(lastList(h.calls).district, undefined, '选商圈清掉区县')
  x.applyDistrict(''); await flush()
  assert.equal(lastList(h.calls).area, undefined, '「全部位置」两个都清')
  assert.equal(lastList(h.calls).district, undefined)
  assert.equal(x.filterBar.value[0].set, false)
  x.pickPlace('南岗区', '中央大街')
  assert.deepEqual([x.filter.district, x.filter.area], ['南岗区', ''])
  assert.match(x.areaFilterText.value, /^按区县 \/ 商圈：南岗区$/)
  x.reset()
  assert.equal(x.filter.district, '')
  h.stop()
  // 模板：两组都用 12 栏 + evenSpans；「全部位置」在没选区县也没选商圈时高亮
  const panel = listT.slice(listT.indexOf(`<view v-if="dd === 'area'">`), listT.indexOf(`<view v-else-if="dd === 'price'">`))
  assert.match(panel, /v-for="\(o, i\) in districtOpts"[^>]*:class="\{ on: o\.value \? filter\.district === o\.value : \(!filter\.district && !filter\.area\) \}" :style="'grid-column: span ' \+ districtSpans\[i\]"[^>]*@click="applyDistrict\(o\.value\)"/)
  assert.match(panel, /<template v-if="areaRows\.length">\s*<text class="dd__sub dd__sub--gap">商圈<\/text>/)
  assert.match(panel, /@click="applyArea\(o\.value\)"/)
  // 整页筛选「位置」卡里区县和商圈在同一组点选
  assert.match(listT, /<view v-for="d in districtRows" :key="'d' \+ d\.name" class="opt" :class="\{ on: filter\.district === d\.name \}" hover-class="k-press-s" @click="pickPlace\(d\.name, ''\)">/)
})

test('列表：区县接口在分包里直接调（不进主包 api.js）；列表卡位置一行带区县', () => {
  const script = list.scriptSetup.content
  assert.match(script, /import \{ get \} from '@\/common\/request\.js'\nconst apiStayDistricts = \(city\) => get\('\/app\/stay\/districts', \{ city \}\)/)
  assert.ok(!read('common/api.js').includes('/app/stay/districts'), '主包 common/api.js 不加区县接口')
  assert.ok(!read('common/api.js').includes('form-options'), '员工端表单选项接口也不进主包')
  assert.match(script, /where: whereLine\(h\.district, h\.areaDesc\)/)
  assert.match(script, /district: f\.district \|\| undefined,/)
  // 换城市清掉上个城市的区县
  assert.match(script, /if \(value !== state\.city\) \{ filter\.area = ''; filter\.district = '' \}/)
})

test('配套设施：房型面板 停车 / 空调 / 可做饭 / 学习室 / 健身房（三列加两列，排满），整页筛选也能勾学习室 / 健身房 / 热水（四列两行），代码都在设施字典里', async () => {
  const h = runList()
  const { x } = h
  assert.deepEqual([...x.PANEL_FACS.map(f => f.label)], ['停车', '空调', '可做饭', '学习室', '健身房'])
  // 10-19 复查：5 个排五列一行（之前 3 + 2，第二行两格拉成半行宽，和第一行不一样大）
  assert.equal(x.PANEL_FACS.length, 5)
  x.toggleDd('room')
  x.toggleDraftFac(x.PANEL_FACS[3])
  x.toggleDraftFac(x.PANEL_FACS[4])
  x.applyDraft(); await flush()
  assert.equal(lastList(h.calls).facilities, 'study,gym')
  assert.equal(x.filterBar.value[2].set, true)
  const codes = x.facilities.map(f => f.code)
  assert.ok(codes.includes('study') && codes.includes('gym'))
  assert.equal(x.facGridSpans.length, x.facilities.length)
  assert.ok(rowsFill(x.facGridSpans), '整页筛选的设施格子每行铺满')
  // 10-19：整页筛选补回字典里的「热水」，8 个四列两行，每格一样大
  assert.ok(codes.includes('hotwater'))
  assert.deepEqual([...x.facGridSpans], [3, 3, 3, 3, 3, 3, 3, 3])
  for (const f of x.facilities) assert.ok(icons[f.icon], f.icon + ' 不在 common/icons.js 里')
  h.stop()
  assert.match(listT, /<view class="gcols gcols--5">\s*<view v-for="\(f, i\) in PANEL_FACS" :key="f\.label" class="opt"/)
  assert.match(list.styles.map(s => s.content).join('\n'), /\.gcols--5 \{ grid-template-columns: repeat\(12, minmax\(0, 1fr\)\);/)
  assert.match(listT, /v-for="\(f, i\) in facilities" :key="f\.label" class="fac-chip" :style="'grid-column: span ' \+ facGridSpans\[i\]"/)
  assert.match(list.styles.map(s => s.content).join('\n'), /\.fac-grid \{ display: grid; grid-template-columns: repeat\(12, minmax\(0, 1fr\)\);/)
  const browse = java('ext/stay/KgStayBrowseService.java')
  const dict = [.../FACILITY_CODES = Arrays\.asList\(([^)]*)\)/.exec(browse)[1].matchAll(/"([a-z]+)"/g)].map(m => m[1])
  for (const c of x.PANEL_FACS.filter(f => f.code).map(f => f.code).concat(codes)) assert.ok(dict.includes(c), c)
  const v51 = fs.readFileSync(path.join(ROOT, 'RuoYi-Vue', 'sql', 'kangaroo', 'V51__stay_district_travel.sql'), 'utf8')
  assert.match(v51, /select 8, '学习室', 'study', 'kg_stay_facility'/)
  assert.match(v51, /select 9, '健身房', 'gym', 'kg_stay_facility'/)
})

test('详情：出行参考卡使用真实已填资料，无资料显示待补充；不冒充 AI', () => {
  const t = noComments(detailT)
  assert.match(t, /<view class="sec-card trip">\s*<view class="sec-head"><text class="sec-title">出行参考<\/text><\/view>\s*<view v-for="r in travel" :key="r\.k" class="trip__row">/)
  const travelBlock = t.slice(t.indexOf('class="sec-card trip"'), t.indexOf('class="sec-card vcard"'))
  assert.ok(!/AI/.test(travelBlock), '员工填写的交通参考不能冒充AI；评价区的模型总结单独标识')
  assert.ok(t.indexOf('class="sec-card trip"') < t.indexOf('class="sec-card host2"'), '出行参考在主理人卡上面（效果图 7 的顺序）')
  const s = detail.scriptSetup.content
  const make = (travel) => new Function('computed', 'travelRows', 'd', /(const TRIP_TONE = [^\n]*)\n/.exec(s)[1] + '\nreturn ' + /const travel = (computed\([^\n]*\))/.exec(s)[1])(C, ui.travelRows, { value: { travel } }).value
  assert.deepEqual(make({ pros: '近古城', cons: '巷子窄', airport: '', rail: '' }), [{ k: '优点', v: '近古城', tone: 'good' }, { k: '缺点', v: '巷子窄', tone: 'warn' }])
  assert.deepEqual(make({ rail: '高铁站坐 4 路' }), [{ k: '高铁', v: '高铁站坐 4 路', tone: 'plain' }])
  assert.deepEqual(make(undefined), [], '老接口没有 travel：卡片不出现')
})

test('详情：小院主理人卡 称呼 / 年龄 / 籍贯 / 擅长 填了才有，小院评分 + 主理人评分；只填了年龄也出主理人卡', () => {
  const t = noComments(detailT)
  assert.match(t, /<text class="host2__name">\{\{ host\.name \|\| '主理人' \}\}<\/text><view v-if="hostMeta\.length" class="host2__facts"><text v-for="f in hostMeta" :key="f\.k" class="host2__fact"[^>]*>\{\{ f\.k \}\} · \{\{ f\.v \}\}<\/text><\/view>/)
  assert.match(t, /<view v-if="ratingMain \|\| hostScore" class="host2__scores"><text v-if="ratingMain" class="host2__score">小院评分 \{\{ ratingMain \}\}<\/text><text v-if="hostScore" class="host2__score">主理人评分 \{\{ hostScore \}\}<\/text><\/view>/)
  const s = detail.scriptSetup.content
  const hasHost = (h) => new Function('computed', 'host', 'return ' + /const hasHost = (computed\([^\n]*\))/.exec(s)[1])(C, { value: h }).value
  assert.equal(hasHost({ storeId: 7 }), false)
  assert.equal(hasHost({ age: '90后' }), true)
  assert.equal(hasHost({ skills: '做饭' }), true)
  const meta = new Function('computed', 'hostFacts', 'host', 'return ' + /const hostMeta = (computed\([^\n]*\))/.exec(s)[1])(C, ui.hostFacts, { value: { name: '阿东', hometown: '成都' } }).value
  assert.deepEqual(meta, [{ k: '籍贯', v: '成都' }], '称呼已经是卡片上的大字，下面一行不重复')
  const score = (v) => new Function('computed', 'scoreText', 'host', 'return ' + /const hostScore = (computed\([^\n]*\))/.exec(s)[1])(C, ui.scoreText, { value: { score: v } }).value
  assert.equal(score(4.7), '4.7')
  assert.equal(score(null), '', '带分项的评价不足 3 条（服务端给 null）不显示主理人评分')
  // 设施图标：学习室 / 健身房，图标都在 common/icons.js 里（不往主包加图标）
  const FAC = new Function('return ' + /const FAC = (\{[^\n]*\})/.exec(s)[1])()
  assert.deepEqual(FAC.study, ['book-open', '学习室'])
  assert.deepEqual(FAC.gym, ['activity', '健身房'])
  for (const [icon] of Object.values(FAC)) assert.ok(icons[icon], icon)
})

test('后端：区县接口、列表按区县精确筛、详情带 travel / 主理人年龄籍贯擅长 / 主理人评分', () => {
  const ctl = java('controller/app/AppStayController.java')
  assert.match(ctl, /@AppAuth\(required = false\)\n    @GetMapping\("\/districts"\)\n    public AjaxResult districts\(@RequestParam\(required = false\) String city\)/)
  const b = java('ext/stay/KgStayBrowseService.java')
  // 2026-10-17 R3：接口给全称（宾县），R2 时存的是简称（宾）—— 同一个区县的几种写法都认（districtAliases）
  assert.match(b, /where\.append\(" and s\.district in \(:districts\)"\);/)
  assert.match(b, /select s\.stay_id, s\.stay_name, s\.cover, s\.tags, s\.district, s\.area_desc/)
  for (const k of ['pros', 'cons', 'airport', 'rail']) assert.ok(b.includes(`travel.put("${k}", `), k)
  for (const k of ['age', 'hometown', 'skills', 'score', 'scoreCount']) assert.ok(b.includes(`host.put("${k}", `), k)
  assert.match(b, /static final int SERVICE_DIM = 2;/)
  const staffCtl = java('controller/app/AppStaffStayController.java')
  assert.match(staffCtl, /@GetMapping\("\/form-options"\)/)
  const staff = java('ext/stay/KgStayStaffService.java')
  for (const c of ['district', 'host_age', 'host_hometown', 'host_skills', 'travel_pros', 'travel_cons', 'travel_airport', 'travel_rail']) assert.ok(staff.includes(`"${c}"`), c)
})

test('员工端编辑表单：所在区县（选或手填）、主理人年龄 / 籍贯 / 擅长、配套设施（读字典）、出行参考四段，保存一起带上', async () => {
  const t = noComments(roomsT)
  assert.match(t, /<view class="fc-row" hover-class="k-press" @click="pickDistrict"><text class="fc-row__k">所在区县<\/text>/)
  // 2026-11-03 主人：简化——主理人三项、出行参考四段不再点开弹系统输入框，就是页面里的输入框 / 文字块（editField 删掉了）
  assert.match(t, /<view v-for="f in HOST_FIELDS" :key="f\.key" class="fc-field">[\s\S]*?<input v-model="form\[f\.key\]" class="fc-input" :maxlength="f\.max" :placeholder="f\.placeholder"/)
  assert.doesNotMatch(rooms.scriptSetup.content, /function editField\(/)
  // 2026-11-03 主人：「增加一个对勾，你点一下对勾就选中」：设施不再点开弹层，直接摊开点选（读字典的 facChoices），点一下走 toggleFacility
  assert.match(t, /<view v-for="o in facChoices" :key="o\.value" class="fac-chip"[^>]*@click="tapFacility\(o\.value\)">/)
  assert.match(rooms.scriptSetup.content, /function toggleFacility\(code\) \{[\s\S]*?function tapFacility\(value\) \{[\s\S]*?toggleFacility\(value\)/)
  assert.match(t, /下面四段是出行参考/)
  assert.match(t, /<view v-for="f in TRAVEL_FIELDS" :key="f\.key" class="fc-field">[\s\S]*?<textarea v-if="editingField === f\.key" v-model="form\[f\.key\]" class="fc-area fc-area--short" :maxlength="f\.max"/)
  assert.ok(!/AI/.test(t))
  const s = rooms.scriptSetup.content
  // 2026-10-17 R3：同一行多引了 put / post / del、下一行引了员工分包的视频上传（视频与生活碎片屏用）
  assert.match(s, /import \{ get, put, post, del \} from '@\/common\/request\.js'\n(?:\/\/[^\n]*\n)?import [^\n]* from '\.\/stay-video\.js'\nconst apiStaffStayFormOptions = \(q\) => get\('\/app\/staff\/stay\/form-options', q\)/)
  // 保存时带上的字段名和后端 EDITABLE（驼峰）一一对应
  const payload = /const payload = \{([\s\S]*?)\}\n/.exec(s)[1]
  for (const k of ['district', 'hostAge', 'hostHometown', 'hostSkills', 'travelPros', 'travelCons', 'travelAirport', 'travelRail']) assert.match(payload, new RegExp(`${k}: form\\.${k}`), k)
  assert.match(payload, /facilities: form\.facilities\.join\(','\), cookable: form\.cookable \? '1' : '0'/)
  // 字数上限和后端 MAX_LEN 一致
  const fields = new Function('return [' + /const HOST_FIELDS = \[([\s\S]*?)\n\]/.exec(s)[1] + ',' + /const TRAVEL_FIELDS = \[([\s\S]*?)\n\]/.exec(s)[1] + ']')()
  const staff = java('ext/stay/KgStayStaffService.java')
  const max = { hostAge: 16, hostHometown: 32, hostSkills: 128, travelPros: 255, travelCons: 255, travelAirport: 255, travelRail: 255 }
  for (const f of fields) assert.equal(f.max, max[f.key], f.key)
  assert.match(staff, /MAX_LEN\.put\("host_age", 16\);/)
  assert.match(staff, /MAX_LEN\.put\("district", 32\);/)
  // pickDistrict：选列表里的 / 手动填写（超长拦下）/ 清空
  const block = s.slice(s.indexOf('async function pickDistrict()'), s.indexOf('\n}\n', s.indexOf('async function pickDistrict()')) + 2)
  const form = { district: '' }
  const answers = []
  const toasts = []
  const run = new Function('formOpts', 'form', 'pickPaged', 'prompt', 'toast', block + '\nreturn pickDistrict')
  const pick = run({ value: { districts: ['道里区', '道外区'] } }, form, async (items) => { answers.push(items); return answers.next.shift() }, async () => answers.typed.shift(), (m) => toasts.push(m))
  answers.next = [1]
  await pick()
  assert.equal(form.district, '道外区')
  assert.deepEqual(answers[0], ['道里区', '道外区', '手动填写', '不填（清空）'])
  answers.next = [2]; answers.typed = ['  古城   区 ']
  await pick()
  assert.equal(form.district, '古城 区')
  answers.next = [2]; answers.typed = ['区'.repeat(33)]
  await pick()
  assert.equal(form.district, '古城 区')
  assert.match(toasts[0], /最多 32 个字/)
  answers.next = [3]
  await pick()
  assert.equal(form.district, '')
})
