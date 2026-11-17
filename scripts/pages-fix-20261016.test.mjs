// 2026-10-16 二级页面复查修复的静态回归（node --test，不需要构建、不发请求）。
// 守住这几件事：
//   · 筛选页食宿只剩 不限 / 包食宿 / 包住宿；结果页的已选条件列出能待多久、食宿、安心商家、含保险、满月红包，都能点掉；
//     一打开就统计一次（按钮不再写「查看 0 个机会」）；
//   · 筛选页按带进来的城市 / 在店时长 / 食宿 / 线上任务类型预填（10-16 第二轮改版后列表页只从小铃铛带城市进订阅屏）；
//   · 320 宽：列表页页签 / 搜索占位 / 数量行，筛选页城市胶囊，合同页步骤条，详情页页签，员工首页今日概览，房源房型格子；
//   · 门店勾「做满一个月有红包」不再顺手打开奖金；
//   · 助手统一叫「AI袋鼠」，「线上任务须知」「线上任务」。
import assert from 'node:assert/strict'
import test from 'node:test'
import { readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const { parse } = require('@vue/compiler-sfc')
const read = async (p) => (await readFile(new URL(p, import.meta.url), 'utf8')).replace(/\r\n/g, '\n')
const list = await read('../pages/jobs/list.vue')
const filter = await read('../pages/jobs/filter.vue')
const css = (src) => parse(src).descriptor.styles.map(s => s.content).join('\n').replace(/\/\*[\s\S]*?\*\//g, '')

test('筛选页：食宿三档，已选条件全列出、能去掉，打开就统计', () => {
  assert.match(filter, /const BOARD = \['none', 'all', 'room'\]\n/)
  assert.match(filter, /const BOARD_LABEL = \['不限', '包食宿', '包住宿'\]/)
  assert.doesNotMatch(filter, /'包三餐'|'包部分'|boardIdx/)
  const chips = filter.slice(filter.indexOf('const chips = computed'), filter.indexOf('const dropChip'))
  for (const [label, drop] of [['STAY_LABEL[f.minStay]', 'f.minStay = 0'], ['BOARD_LABEL[BOARD.indexOf(f.board)]', "f.board = 'none'"], ["'安心商家 ×'", 'f.safe = false'], ["'含保险 ×'", 'f.insured = false'], ["'满月红包 ×'", 'f.monthBonus = false']]) {
    assert.ok(chips.includes(label), label)
    assert.ok(chips.includes(drop), drop)
  }
  assert.match(filter, /filtersReady = true\n[^\n]*\n    runSearch\(s\.value === 3 \|\| q\?\.source === 'sub'\)\n  \}/)
})

test('列表页小铃铛进订阅屏带上页签和选了的城市，筛选页按带进来的条件预填', () => {
  // 10-16 第二轮改版：列表页不再有「全部筛选」（条件都在列表页的筛选面板里选），只从小铃铛进订阅屏
  const open = list.slice(list.indexOf('const openNewSub'), list.indexOf('// 订阅的 jobTypes'))
  // 2026-10-17：type + 城市 + 这个页签的条件统一由 job-filters.filterQuery 生成（线上任务不带城市），见 jobs-filters-r4-20261017.test.mjs
  assert.match(open, /go\(R\.jobsFilter \+ '\?s=2&' \+ queryString\(filterQuery\(type, filterOf\(type\)\)\)\)/)
  assert.match(filter, /fromList\(q \|\| \{\}, jt\)/)
  const from = filter.slice(filter.indexOf('function fromList'), filter.indexOf('async function tapCity'))
  assert.match(from, /if \(q\.city !== undefined\) f\.cities = String\(q\.city\)\.trim\(\) \? \[String\(q\.city\)\.trim\(\)\.slice\(0, 16\)\] : \[\]/)
  assert.match(from, /if \(q\.cities !== undefined\) f\.cities = \[\.\.\.new Set\(String\(q\.cities\)\.split\(','\)[^\n]*\.slice\(0, 5\)/)
  assert.match(from, /if \(STAY\.indexOf\(ms\) > 0\) f\.minStay = ms/)
  assert.match(from, /if \(BOARD\.indexOf\(q\.board\) > 0\) f\.board = q\.board/)
  // 订阅屏预选的城市跟着带进来的条件走
  assert.match(filter, /sub\.jobType = f\.jobType\n    \/\/ [^\n]*\n    sub\.cities = \[\.\.\.f\.cities\]/)
})

test('320 宽：胶囊行、字母条、城市胶囊、步骤条、页签、今日概览、房型格子', async () => {
  // 列表页（10-16 第二轮改版）：页签字号收小一号；搜索占位折两行、12px；数量行的小铃铛只留图标
  // 10-19 一比一还原后页签字号整体大了一档（17 / 21），320 宽收到 15 / 18，四个页签仍放得下一行
  assert.match(css(list), /@media \(max-width: 359px\) \{ \.job-kind \{ font-size: 15px; \} \.job-kind\.active \{ font-size: 15px; \} \}/)
  assert.match(list, /<job-search/); assert.match(list, /import JobSearch/ )
  assert.match(css(list), /@media \(max-width: 359px\) \{ \.bell__text \{ display: none; \} \}/)
  assert.match(css(filter), /\.pill text \{ min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; \}/)
  const contract = css(await read('../pages/jobs/contract.vue'))
  assert.match(contract, /\.flow>view>text \{ white-space: nowrap; flex-shrink: 0; \}\.flow>view:last-child \{ flex: 0 0 auto; \}/)
  assert.match(contract, /@media \(max-width: 340px\) \{ \.flow \{ padding: 0 12px; \}/)
  const detail = css(await read('../pages/jobs/detail.vue'))
  // 内测反馈 2.0：岗位详情只剩「岗位信息 / 评价」两个普通页签；2026-10-18 主人：页签也去掉（评价放进页面里「用户反馈」），不再有步骤条 / 页签样式
  assert.doesNotMatch(detail, /detail-tab/)
  const staffIndex = await read('../pages/staff/index.vue')
  assert.match(staffIndex, /'stat__value--long': String\(it\.value\)\.length > 4/)
  assert.match(css(staffIndex), /\.stat__value, \.stat__row \{ max-width: 100%; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; \}/)
  const stays = await read('../pages/stays/list.vue')
  // 2026-10-17 改版：房型 8 个固定一行 4 个（之前 auto-fill，窄屏 3 列时第三行空一格；主人要「排列好看」），320 宽再收字号；
  // 订房入口和整页筛选两处都用这组格子（stays-20261017.test.mjs 里还有不留空洞的检查）
  // 2026-10-18：订房入口改用四列等宽的 grid4（一样是固定 4 列），这组格子只剩整页筛选一处
  assert.equal(stays.split(/<view class="opts opts--room opts--tight">\n\s*<view v-for="o in roomOpts"/).length, 2)
  assert.match(stays, /v-for="o in roomOpts"[^>]*on: draft\.room === o/)
  assert.match(css(stays), /\.opts--room \{ grid-template-columns: repeat\(6, minmax\(0, 1fr\)\); \}/)
  assert.match(css(stays), /\.opts--room \.opt:nth-child\(n\+4\) \{ grid-column: span 3;/)
  assert.match(css(stays), /\.opt \{[^}]*word-break: keep-all; \}/)
  assert.match(css(stays), /\.fac-check__label \{[^}]*word-break: keep-all; \}/)
})

test('满月红包只是标记：勾上不打开奖金；线上任务卡片不显示', async () => {
  const staff = await read('../pages/staff/jobs.vue')
  const toggle = staff.slice(staff.indexOf('const toggleRedpacket'), staff.indexOf('\n}\n', staff.indexOf('const toggleRedpacket')))
  assert.doesNotMatch(toggle, /bonusEnabled = true/)
  assert.match(list, /redpacket: type !== 'online' && j\.monthRedpacket === true/)
})

test('叫法统一：AI袋鼠、线上任务须知、线上任务', async () => {
  for (const p of ['../pages/home/assistant.vue', '../pages/profile/index.vue', '../pages/notice/support.vue', '../pages/stays/order.vue']) {
    const src = await read(p)
    const tpl = parse(src).descriptor.template.content
    assert.doesNotMatch(tpl, /袋鼠助手/, p)
    assert.doesNotMatch(src, /label: '小袋鼠助手'/, p)
  }
  // 反馈 2.0：三种情境的问答浮层下线，assistant.vue 只留人工工单页；问答统一叫「AI袋鼠客服」（pages/notice/support）
  assert.equal((await read('../pages/home/assistant.vue')).split('<text>AI袋鼠</text>').length, 1)
  assert.match(await read('../pages/notice/support.vue'), /<text class="sp-title">AI袋鼠客服<\/text>/)
  // 10-16 主人拍板：「AI袋鼠」在当前页底部弹出（k-ai-sheet），弹层顶上的标题也叫「AI袋鼠」
  assert.match(await read('../pages/profile/index.vue'), /label: 'AI袋鼠', action: openAi/)
  assert.match(await read('../components/k-ai-sheet/k-ai-sheet.vue'), /<text class="k-ai__title">AI袋鼠<\/text>/)
  for (const p of ['../pages/jobs/detail.vue', '../pages/jobs/deliver.vue']) {
    const src = await read(p)
    assert.match(src, /<text class="guide-link__title">线上任务须知<\/text>/, p)
    assert.doesNotMatch(src, /线上兼职须知/, p)
  }
  assert.match(await read('../pages/staff/applications.vue'), /online: '线上任务' \}/)
})

test('可点的 view 有按压反馈（hover-class）', async () => {
  const hc = (src, re) => assert.match(src, re)
  hc(list, /class="card"[^>]*hover-class="k-press-s"[^>]*@click="openJob\(job\)"/)
  hc(list, /class="bell" :class="\{ on: notify \}" hover-class="k-press" @click="openSubscribe"/)
  hc(filter, /class="job-card" hover-class="k-press-s" @click="openJob\(job\)"/)
  hc(await read('../pages/stays/list.vue'), /class="entry-search" hover-class="k-press" @click="search"/)
  hc(await read('../pages/staff/index.vue'), /class="stat" hover-class="k-press-s" @click="openOverview\(it\)"/)
  hc(await read('../pages/profile/benefits.vue'), /class="benefit-row" hover-class="k-press" @click="openBenefit\(benefitItem\)"/)
  hc(await read('../pages/notice/index.vue'), /class="notice-row" hover-class="k-press" @click="openItem\(item\)"/)
  // 小程序的 text 不支持 hover-class：可点的东西用 view
  for (const p of ['../pages/jobs/list.vue', '../pages/jobs/filter.vue', '../pages/jobs/components/job-filter-panel.vue', '../pages/jobs/components/job-city-panel.vue', '../pages/jobs/components/job-badge.vue']) assert.doesNotMatch(parse(await read(p)).descriptor.template.content, /<text [^>]*hover-class/, p)
})
