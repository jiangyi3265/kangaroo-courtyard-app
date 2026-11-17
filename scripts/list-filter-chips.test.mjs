// 列表页筛选胶囊 / 旅居房型卫浴筛选的静态回归（node --test，不需要构建、不发请求）。
// 守住 2026-10-11 内测反馈改的几件事（10-16 第二轮改版后）：
//   · 岗位列表「筛选▾」展开一个面板，按页签分组；选了的条件列成可去掉的胶囊，点「确定」才生效；
//   · 列表页技能选项和后端技能词典 KgSkills 同一套标签，食宿 / 排班 / 房型 / 薪资参数是后端认的值；
//   · 旅居搜索页能选单人间 / 双人间 / 男女多人间 + 独立卫浴 / 公共卫浴，参数值和 KgStayBrowseService.roomTypeClause 认的一致；
//   · 「热水」这类房源设施字典里没有的值不再出现在设施筛选里（勾了永远 0 家）。
import assert from 'node:assert/strict'
import test from 'node:test'
import { readFile } from 'node:fs/promises'

const read = async (p) => (await readFile(new URL(p, import.meta.url), 'utf8')).replace(/\r\n/g, '\n')
const list = await read('../pages/jobs/list.vue')
const filters = await read('../pages/jobs/job-filters.js')
const stays = await read('../pages/stays/list.vue')
const javaRoot = '../../RuoYi-Vue/ruoyi-kangaroo/src/main/java/com/ruoyi/kangaroo/'
const skillsJava = await read(javaRoot + 'ext/user/KgSkills.java')
const browseJava = await read(javaRoot + 'ext/stay/KgStayBrowseService.java')
const jobCtl = await read(javaRoot + 'controller/app/AppJobController.java')
const tabJava = await read(javaRoot + 'domain/JobTabFilters.java')

const literal = (src, name) => {
  const m = new RegExp(`const ${name} = (\\{[^\\n]*\\}|\\[[^\\n]*\\]|\\{\\n[\\s\\S]*?\\n\\})\\n`).exec(src)
  assert.ok(m, name + ' not found')
  return Function('return (' + m[1] + ')')()
}

test('岗位列表：「筛选▾」展开面板，选了的条件（城市也在内）列成可去掉的胶囊；面板里改草稿，点「确定」才重新拉列表', () => {
  assert.match(list, /class="fchip-main"[^\n]*@click="toggleFilter"[^\n]*<text class="fchip-main__text">筛选<\/text>/)
  assert.match(list, /<view v-for="chipItem in conditionChips" :key="chipItem\.key" class="fchip" hover-class="k-press-s" @click="removeChip\(chipItem\.key\)"><text class="fchip__text">\{\{ chipItem\.text \}\}<\/text><k-icon name="x"/)
  // 面板开着时胶囊行列的是草稿（点掉 / 选城市都改草稿，和面板一起点「确定」才生效）
  assert.match(list, /const chips = computed\(\(\) => filterChips\(curType\(\), filterOpen\.value \? draft : filterOf\(curType\(\)\), workKinds\.value\)\)/)
  // 不再有「全部筛选」跳筛选页，也不再有一个胶囊一个下拉
  assert.doesNotMatch(list, /chip--all|openFilter|toggleChip\(c\.key\)/)
  // 列表按条件拉：参数全由 job-filters.js 的 filterParams 生成
  assert.match(list, /const listParams = \(type, f\) => \(\{ type, keyword: keyword\.value\.trim\(\) \|\| undefined, \.\.\.filterParams\(type, f\) \}\)/)
  assert.match(list, /const params = listParams\(type, filterOf\(type\)\)/)
  assert.match(list, /await apiJobList\(\{ \.\.\.params, pageNum, pageSize: PAGE_SIZE \}\)/)
  // 面板里改的是草稿：实时数一下（只取 1 条看 total），点「确定」才写回并重新拉
  assert.match(list, /await apiJobList\(\{ \.\.\.listParams\(type, draft\), pageNum: 1, pageSize: 1 \}\)/)
  const confirm = list.slice(list.indexOf('function onConfirm()'), list.indexOf('\n}\n', list.indexOf('function onConfirm()')))
  assert.match(confirm, /Object\.assign\(sel\[type\], cloneFilter\(\{ \.\.\.draft, cities: \[\] \}\)\)\n  filterOpen\.value = false\n  fetchJobs\(s\.value - 1\)/)
  // 最新要求为半屏弹层，遮罩点按关闭；确认前不写回筛选。
  assert.match(list, /<view v-if="filterOpen" class="jobs-filter" role="dialog"/)
  assert.match(list, /class="jobs-filter-mask" @click="filterOpen = false"/ )
  assert.doesNotMatch(list, /:body-max=|:fixed-top=/)
  assert.match(list, /<k-tabbar v-if="!cityOpen"/)
})

test('岗位列表：四个页签各自的条件组（换宿有性别，兼职 / 全职没有；线上只有任务类型）', () => {
  const groups = literal(filters, 'GROUPS')
  assert.deepEqual(groups, {
    volunteer: ['gender', 'skills', 'restModes', 'minStay', 'roomTypes', 'assured', 'workKind'],
    // 2026-10-17 主人反馈：兼职 = 食宿 + 日薪，全职 = 类型 + 食宿 + 月薪
    parttime: ['board', 'payDay'],
    fulltime: ['categories', 'board', 'payMonth'],
    online: ['task']
  })
})

test('岗位列表：技能选项都在后端技能词典里，食宿 / 排班 / 房型的值是后端认的，参数名和后端一致', () => {
  const dict = [...skillsJava.matchAll(/DICT\.put\("([^"]+)"/g)].map(m => m[1])
  assert.ok(dict.length >= 10)
  for (const [label, value] of literal(filters, 'SKILL_BASE').concat(literal(filters, 'SKILL_MORE'))) assert.ok(dict.includes(value), label + ' → ' + value + ' 不在 KgSkills 词典里')
  assert.deepEqual(literal(filters, 'SKILL_BASE').map(o => o[0]), ['会做饭', '拍摄', '开车', '玩游戏'])
  // 食宿的取值由后端 JobTabFilters.BOARDS 校验（列表接口 putChipFilters 和全部筛选页共用）
  const boards = literal(filters, 'BOARD_OPTS').map(o => o[1]).filter(Boolean)
  assert.deepEqual(boards, ['all', 'room', 'meal', 'self'])
  for (const b of boards) assert.match(tabJava, new RegExp(`b\\.put\\("${b}", `), b)
  assert.match(jobCtl, /String b = com\.ruoyi\.kangaroo\.domain\.JobTabFilters\.board\(board\);/)
  assert.deepEqual(literal(filters, 'REST_OPTS').map(o => o[1]), ['1-1', '4-3', '2-1', '5-2', '3-2', '3-1', '6-1'])
  assert.deepEqual(literal(filters, 'ROOM_OPTS').map(o => o[1]), ['single', 'double', 'triple', 'multi'])
  for (const p of ['salaryMin', 'salaryMax', 'board', 'skill', 'minStay', 'train', 'cities', 'gender', 'restModes', 'roomTypes', 'skills', 'assured', 'payDay', 'payMonthMin', 'payMonthMax', 'categories']) assert.match(jobCtl, new RegExp(`@RequestParam\\(required = false\\) \\w+ ${p}\\b`), p)
})

test('旅居：搜索页和筛选排序都能选房型 + 卫浴，参数值后端都认', () => {
  // 搜索页（第 1 屏）就有这两组，不只藏在筛选排序里
  const first = stays.slice(0, stays.indexOf('<!-- 2 全部房源列表 -->'))
  assert.match(first, /v-for="o in roomOpts"/)
  assert.match(first, /v-for="o in bathOpts"/)
  const rooms = literal(stays, 'roomOpts')
  assert.deepEqual(rooms, ['不限', '单人间', '双人间', '男生多人间', '女生多人间'])
  assert.deepEqual(literal(stays, 'bathOpts'), ['不限', '独立卫浴', '公共卫浴'])
  for (const v of Object.values(literal(stays, 'ROOM_SIZE'))) assert.match(browseJava, new RegExp(`"${v}"\\.equals\\(size\\)`), v)
  for (const v of Object.values(literal(stays, 'BATH'))) assert.match(browseJava, new RegExp(`"${v}"\\.equals\\(bath\\)`), v)
  // 每个房型选项都有对应的参数（不会选了等于没选）
  const kind = literal(stays, 'ROOM_KIND')
  const size = literal(stays, 'ROOM_SIZE')
  for (const o of rooms.filter(x => x !== '不限')) assert.ok(kind[o] || size[o], o + ' 没有对应参数')
  assert.match(stays, /roomSize: ROOM_SIZE\[f\.room\] \|\| undefined, bath: BATH\[f\.bath\] \|\| undefined/)
})

test('旅居：设施筛选只用房源设施字典里的值', () => {
  const codes = [.../FACILITY_CODES = Arrays\.asList\(([^)]*)\)/.exec(browseJava)[1].matchAll(/"([a-z]+)"/g)].map(m => m[1])
  const used = [...stays.slice(stays.indexOf('const facilities = ['), stays.indexOf('const filter = reactive')).matchAll(/code: '([a-z]+)'/g)].map(m => m[1])
  assert.ok(used.length >= 4)
  for (const c of used) assert.ok(codes.includes(c), c + ' 不在 kg_stay_facility 字典里')
})
