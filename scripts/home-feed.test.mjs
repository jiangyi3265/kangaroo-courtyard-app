// 10-15 首页改版的回归（node --test，不需要构建、不发请求）。跑的是首页真实的 script setup，接口换成假函数：
//   · 近期活动固定两格：两场是两张大图卡（日期、城市 · 集合地、免费绿 / 收费红、名额状态签）；一场时第二格是「全部活动」入口；
//     一场都没有时是「近期活动筹备中」提示条；加载中 / 出错时整块不显示；
//   · 「为你推荐」改名「旅居推荐」：两列图卡；11-06 按后台运营类型分自营 / 合作，每组先露两个、独立展开；
//   · 首页删掉「可能感兴趣的城市」卡片和「会员权益」条，整页不再是宋体，只有品牌名用 --k-brand；
//   · 搜索条写「向AI袋鼠提问，快速给出答案」，点了还是进找机会屏；找机会屏的问候语、小字、例句按主人原话，
//     「入住时间」改「旅行时间段」，底部「按你填写的条件规则匹配，结果仅供参考」保留；
//   · 筛选页（岗位「筛选条件」、订房「筛选排序」）的「重置」从顶栏右边挪到底栏主按钮左边。
// 10-16 第二轮改版（首页第一屏照主人原型）：
//   · 品牌行左边加袋鼠贴纸，品牌名黑体粗体；城市做成奶油色胶囊放在下一行，点了进「切换城市」（带定位、最近访问），选完回首页；
//   · 搜索条改「问 AI 袋鼠，找换工 / 旅居」：点输入区进找机会并弹键盘，点暖棕圆钮按当前城市直接匹配（全部城市传空串，后端全国匹配）；
//   · 5 个入口改白卡 + 暖棕线条图标，名字和岗位列表页签一致，选了城市就带 ?city= 进列表；
//   · 近期活动 / 旅居推荐换成 16px 圆角白卡，数据和几种状态不变；找机会屏的头像换成同一只袋鼠。
// 10-17 主人效果图 4：搜索条改细描边白胶囊 + 渐变圆钮；5 个入口改成圆形柔和色底图标 + 下面名字；城市胶囊右边一只贴纸点缀；
//   岗位入口不再带首页（定位）城市进列表，只有旅居订房带（另见 home-jobs-20261017.test.mjs）。
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'
import test from 'node:test'
import assert from 'node:assert/strict'

const APP = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const require = createRequire(path.join(APP, 'package.json'))
const compiler = require('@vue/compiler-sfc'), vue = require('vue')
const readSfc = (rel) => compiler.parse(fs.readFileSync(path.join(APP, rel), 'utf8').replace(/\r\n/g, '\n'), { filename: rel }).descriptor
const flush = () => new Promise(resolve => setImmediate(resolve))

const shiftDate = (ymd, n) => {
  const [y, m, d] = ymd.split('-').map(Number)
  const t = new Date(Date.UTC(y, m - 1, d) + n * 86400000)
  return `${t.getUTCFullYear()}-${String(t.getUTCMonth() + 1).padStart(2, '0')}-${String(t.getUTCDate()).padStart(2, '0')}`
}

/** 在沙箱里跑首页的 script setup：导入一律先给永远不返回的函数，再用 stubs 覆盖用得到的那几个 */
function home(feed, stubs = {}) {
  const rel = 'pages/home/index.vue'
  const d = readSfc(rel)
  const source = d.scriptSetup.content
  const ast = compiler.babelParse(source, { sourceType: 'module' })
  const body = ast.program.body.filter(n => n.type !== 'ImportDeclaration').map(n => source.slice(n.start, n.end)).join('\n')
  const sandbox = { console }
  for (const n of ast.program.body.filter(n => n.type === 'ImportDeclaration')) for (const s of n.specifiers) sandbox[s.local.name] = () => new Promise(() => {})
  const gone = [], scrolls = []
  Object.assign(sandbox, {
    ref: vue.ref, computed: vue.computed, watch: vue.watch, onShow() {},
    useScreen: () => vue.ref(1),
    experience: vue.reactive({ cities: [] }),
    apiHomeFeed: async () => (typeof feed === 'function' ? feed() : { data: feed }),
    absUrl: (u) => 'https://img.test' + u,
    errText: (e, fallback) => fallback,
    go: (url) => gone.push(url),
    todayCn: () => '2026-10-15', shiftDate,
    R: { activity: '/pages/community/activity', stayDetail: '/pages/stays/detail', city: '/pages/home/city', jobsList: '/pages/jobs/list', staysList: '/pages/stays/list', search: '/pages/search/index' }
  }, stubs)
  // 切屏回到顶部要用 uni.pageScrollTo：测试自己给的 uni 只补它没有的
  sandbox.uni = { pageScrollTo: (o) => scrolls.push(o), ...(stubs.uni || {}) }
  vm.createContext(sandbox)
  const scope = vue.effectScope()
  scope.run(() => vm.runInContext(body, sandbox, { filename: rel + ':script-setup' }))
  return { run: code => vm.runInContext(code, sandbox), gone, scrolls, stop: () => scope.stop(), template: d.template.content, styles: d.styles.map(s => s.content).join('\n') }
}

// KgActivityService.card() 的真实形状（只列首页用得到的字段）
const card = (id, extra = {}) => ({
  activityId: id, title: '苍山徒步与古城夜游' + id, img: '/upload/a' + id + '.jpg', city: '大理', place: '古城南门',
  dateText: '10月18日（周六）', time: '14:00–16:30', timeText: '10月18日（周六）14:00–16:30',
  feeFen: 0, priceText: '免费', few: false, full: false, ...extra
})
const stays = (n) => Array.from({ length: n }, (_, i) => ({ stayId: i + 1, stayName: '袋鼠小院' + (i + 1), opType: i % 2 ? 'franchise' : 'direct', city: i % 2 ? '丽江' : '平潭', intro: i === 2 ? '' : '海边独栋', cover: i === 1 ? '' : '/upload/s' + i + '.jpg', safe: i === 0 }))

test('两场活动：两张图文卡，日期 / 城市 · 集合地 / 价格 / 名额状态都从 card() 映射过来', async () => {
  const h = home({ activities: [card(1), card(2, { feeFen: 3900, priceText: '¥39', few: true }), card(3, { full: true, few: true })], stays: stays(2) })
  await h.run('loadFeed()'); await flush()
  const acts = JSON.parse(JSON.stringify(h.run('activities.value')))
  assert.equal(acts.length, 2, '首页只露两张，后端多给的第三场不显示')
  assert.deepEqual(acts[0], {
    activityId: 1, title: '苍山徒步与古城夜游1', date: '10月18日 周六 14:00', place: '大理 · 古城南门', price: '免费', free: true,
    badge: '报名中', few: false, full: false, image: 'https://img.test/upload/a1.jpg'
  })
  assert.equal(acts[1].price, '¥39'); assert.equal(acts[1].free, false)
  assert.equal(acts[1].badge, '名额紧张'); assert.equal(acts[1].few, true); assert.equal(acts[1].full, false)
  h.run('openActivity(activities.value[0])')
  assert.deepEqual(h.gone, ['/pages/community/activity?id=1&channel=home'])
  h.stop()
})

test('名额已满写「已满可候补」，不再标黄；没有封面 / 集合地 / 结束时间时也不出多余的点和空格', async () => {
  const h = home({ activities: [card(4, { full: true, few: true, img: '', place: '', time: '09:00' })], stays: [] })
  await h.run('loadFeed()'); await flush()
  const [a] = JSON.parse(JSON.stringify(h.run('activities.value')))
  assert.equal(a.badge, '已满可候补'); assert.equal(a.few, false); assert.equal(a.full, true)
  assert.equal(a.place, '大理'); assert.equal(a.date, '10月18日 周六 09:00')
  assert.equal(a.image, '/static/media/cover-empty.png')
  h.stop()
})

test('旅居推荐分自营与合作，每组先露两个，展开互不影响；原卡片资料与详情链接保留', async () => {
  const h = home({ activities: [], stays: stays(6) })
  await h.run('loadFeed()'); await flush()
  assert.deepEqual(JSON.parse(h.run('JSON.stringify(stayGroups.value.map(g => [g.key, g.total, g.stays.map(s => s.stayId)]))')), [['direct', 3, [1, 3]], ['partner', 3, [2, 4]]])
  assert.equal(h.run('recStays.value[0].sub'), '平潭 · 海边独栋')
  assert.equal(h.run('recStays.value[2].sub'), '平潭')
  assert.equal(h.run('recStays.value[1].image'), '/static/media/cover-empty.png')
  h.run("openRecommendations('direct')")
  assert.equal(h.run('stayGroups.value[0].stays.length'), 3)
  assert.equal(h.run('stayGroups.value[1].stays.length'), 2)
  h.run("openRecommendations('direct')")
  assert.equal(h.run('stayGroups.value[0].stays.length'), 2)
  h.run('openStay(stayGroups.value[1].stays[0])')
  assert.equal(h.gone[0], '/pages/stays/detail?stayId=2')
  h.stop()
})

test('每组就地展开最多 12 个，收起回到一行；没有该类型时不展示空分组', async () => {
  const h = home({ activities: [], stays: stays(60) })
  await h.run('loadFeed()'); await flush()
  h.run("openRecommendations('partner')")
  assert.equal(h.run('stayGroups.value[1].stays.length'), 12)
  assert.deepEqual(JSON.parse(h.run('JSON.stringify(stayGroups.value[1].stays.map(x => x.stayId))')), [2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22, 24])
  h.run("openRecommendations('partner')")
  assert.equal(h.run('stayGroups.value[1].stays.length'), 2)
  h.run("feed.value.stays = feed.value.stays.filter(s => s.opType === 'direct')")
  assert.equal(h.run('stayGroups.value.length'), 1)
  assert.equal(h.run('stayGroups.value[0].key'), 'direct')
  h.run('feed.value.stays = []')
  assert.equal(h.run('stayGroups.value.length'), 0)
  h.stop()
})

test('分类只认后台运营类型，不按袋鼠店名或安心认证推断；再次加载采用后台最新分类', async () => {
  let rows = stays(5).map((s, i) => ({ ...s, opType: ['direct', 'managed', 'franchise', 'partner', null][i], safe: true }))
  const h = home(() => ({ data: { activities: [], stays: rows } }))
  await h.run('loadFeed()')
  assert.equal(h.run('stayGroups.value[0].total'), 1)
  assert.equal(h.run('stayGroups.value[1].total'), 4)
  rows = rows.map(s => ({ ...s, opType: 'partner' }))
  await h.run('loadFeed()')
  assert.equal(h.run('stayGroups.value.length'), 1)
  assert.equal(h.run('stayGroups.value[0].key'), 'partner')
  assert.equal(h.run('stayGroups.value[0].total'), 5)
  h.stop()
})

test('近期活动：选了城市、露出来的活动一场都不在这个城市时标题写「其他城市的近期活动」；全部城市、本城有活动时照旧「近期活动」', async () => {
  let acts = [card(1, { city: '大理' }), card(2, { city: '丽江' })]
  const h = home(() => ({ data: { city: '平潭', activities: acts, stays: [] } }))
  // 全部城市：照旧
  await h.run('loadFeed()'); await flush()
  assert.equal(h.run('otherCityActs.value'), false)
  // 选了平潭，后端补的是大理、丽江的
  h.run("experience.cities = ['平潭']")
  await h.run('loadFeed()'); await flush()
  assert.equal(h.run('otherCityActs.value'), true)
  // 有一场在平潭：照旧
  acts = [card(1, { city: '平潭' }), card(2, { city: '大理' })]
  await h.run('loadFeed()'); await flush()
  assert.equal(h.run('otherCityActs.value'), false)
  // 一场都没有：是「近期活动筹备中」条，标题不改
  acts = []
  await h.run('loadFeed()'); await flush()
  assert.equal(h.run('otherCityActs.value'), false)
  assert.ok(firstScreen(h.template).includes(`<text class="section-head__title k-display">{{ otherCityActs ? '其他城市的近期活动' : '近期活动' }}</text>`))
  h.stop()
})

test('首页选了「全部城市」（allCities 开关）：兴趣城市列表还在，首页仍显示全部城市、直接匹配传空串（全国）、入口不带 ?city=', async () => {
  const calls = []
  const h = home({ activities: [], stays: [] }, { apiHomeMatch: async (payload) => { calls.push(payload); return { data: { jobs: [{ jobId: 1 }], stays: [], activities: [], reasons: [] } } }, toast: () => {} })
  h.run("experience.cities = ['平潭', '大理']; experience.allCities = true")
  assert.equal(h.run('city.value'), '全部城市')
  await h.run('quickMatch()'); await flush()
  assert.equal(calls[0].city, '')
  h.run('openEntry(entries[0])')
  assert.equal(h.gone.at(-1), '/pages/jobs/list?type=volunteer')
  // 再选回某个城市（切换城市页会关掉开关）：首页显示这个城市
  h.run('experience.allCities = false')
  assert.equal(h.run('city.value'), '平潭')
  h.stop()
})

test('找机会的结果 / 理由屏保持可读文字与 16px 圆角白卡', () => {
  const { styles } = home({ activities: [], stays: [] })
  assert.match(styles, /\.preference-head__hint, \.preference-head__clear \{ color: var\(--k-ink2\); font-size: 12px; \}/)
  assert.match(styles, /\.ai-note \{[^}]*color: var\(--k-ink2\);/)
  assert.match(styles, /\.result-sort \{[^}]*color: var\(--k-ink2\); font-size: 12px; \}/)
  assert.match(styles, /\.result-end \{[^}]*color: var\(--k-muted\);[^}]*font-size: 14px; \}/)
  assert.ok(!/var\(--k-light\)/.test(styles), '浅灰 --k-light 只给占位 / 禁用')
  for (const cls of ['match-card', 'score-card', 'reason-list', 'reason-pref']) {
    const rule = styles.match(new RegExp(`\\.${cls} \\{[^}]*\\}`))[0]
    assert.match(rule, /border-radius: var\(--k-radius\); background: var\(--k-paper\); box-shadow: var\(--k-sh1\);/, cls)
    assert.ok(!/border:/.test(rule), cls + ' 不描边')
  }
})

test('近期活动的三种版面都在模板里：图文列表 / 一场时「全部活动」入口 / 没有时「近期活动筹备中」条；加载中和出错时整块不显示', () => {
  const { template } = home({ activities: [], stays: [] })
  const block = template.slice(template.indexOf('<template v-if="!feedLoading && !feedError">'), template.indexOf('旅居推荐'))
  assert.ok(block.length > 0 && block.includes('近期活动'), '近期活动整块套在「不在加载、没出错」里')
  assert.match(block, /<view v-if="activities\.length" class="activity-list">/)
  assert.match(block, /v-if="activities\.length === 1"[^>]*@click="go\(R\.activity\)"[\s\S]*全部活动[\s\S]*看各城市活动/)
  assert.match(block, /<view v-else class="act-empty"[^>]*@click="go\(R\.activity\)"[\s\S]*近期活动筹备中[\s\S]*订阅城市活动，有新活动提醒你/)
  assert.match(block, /:class="item\.free \? 'k-green' : 'k-red'"/, '免费绿、收费用主色')
  assert.match(block, /class="feed-card__badge" :class="\{ 'is-few': item\.few, 'is-full': item\.full \}"/)
})

test('加载中 / 出错时不显示近期活动；出错后点「重新加载」能恢复', async () => {
  let fail = true
  const h = home(() => { if (fail) throw new Error('网络错误'); return { data: { activities: [card(1)], stays: stays(1) } } })
  await h.run('loadFeed()'); await flush()
  assert.equal(h.run('feedError.value'), '推荐加载失败，请重试')
  assert.equal(h.run('activities.value.length'), 0)
  fail = false
  await h.run('loadFeed()'); await flush()
  assert.equal(h.run('feedError.value'), '')
  assert.equal(h.run('feedLoading.value'), false)
  assert.equal(h.run('activities.value.length'), 1)
  h.stop()
})

const firstScreen = (template) => template.slice(template.indexOf('<template v-if="s === 1">'), template.indexOf('<template v-else-if="s === 2">')).replace(/<!--[\s\S]*?-->/g, '')

test('首页普通搜索保留关键词并编码传入搜索页，输入和圆钮均不打开 AI 对话', () => {
  const h = home({ activities: [], stays: [] })
  h.run("searchKeyword.value = '  海边 & 摄影%  '; searchHome()")
  assert.equal(h.gone[0], '/pages/search/index?keyword=' + encodeURIComponent('海边 & 摄影%'))
  h.run("searchKeyword.value = '  '; searchHome()")
  assert.equal(h.gone[1], '/pages/search/index?keyword=')
  const screen = firstScreen(h.template)
  assert.match(screen, /<input[^>]*v-model="searchKeyword"[^>]*@confirm="searchHome"/)
  assert.match(screen, /<button[^>]*search-box__go[^>]*@click="searchHome"/)
  assert.doesNotMatch(screen, /homeAiOpen|k-ai-sheet|问 AI/)
  h.stop()
})

// 首页外观及安全区用 acceptance/20261021-home-ui 的真实浏览器检查。

// 2026-10-17 主人：「选择地址的时候默认我在的位置也加到里面了」—— 首页城市（多半是自动定位来的）不再带进岗位列表，
// 四个岗位入口一律不带 ?city=（岗位列表默认全部城市），只有旅居订房照旧带着首页城市进订房列表
test('首页 5 个入口：名字和岗位列表页签一致；岗位入口不带首页城市，旅居订房选了城市才带 ?city=', () => {
  const h = home({ activities: [], stays: [] })
  const entries = JSON.parse(JSON.stringify(h.run('entries')))
  assert.deepEqual(entries.map(e => e.name), ['换宿旅行', '兼职旅行', '全职驻店', '线上任务', '旅居订房'])
  for (const e of entries) h.run(`openEntry(entries.find(x => x.name === ${JSON.stringify(e.name)}))`)
  assert.deepEqual(h.gone, ['/pages/jobs/list?type=volunteer', '/pages/jobs/list?type=parttime', '/pages/jobs/list?type=fulltime', '/pages/jobs/list?type=online', '/pages/stays/list'])
  h.gone.length = 0
  h.run("experience.cities = ['大理', '丽江']")
  h.run('entries.forEach(openEntry)')
  const c = encodeURIComponent('大理')
  assert.deepEqual(h.gone, ['/pages/jobs/list?type=volunteer', '/pages/jobs/list?type=parttime', '/pages/jobs/list?type=fulltime', '/pages/jobs/list?type=online', `/pages/stays/list?city=${c}`])
  h.stop()
})

test('城市胶囊进「切换城市」屏（带定位和最近访问），from=home 让它选完回首页', () => {
  const h = home({ activities: [], stays: [] })
  assert.equal(h.run('city.value'), '全部城市')
  h.run('openCity()')
  assert.deepEqual(h.gone, ['/pages/home/city?s=2&from=home'])
  h.run("experience.cities = ['伊犁哈萨克自治州']")
  assert.equal(h.run('city.value'), '伊犁哈萨克自治州')
  h.stop()
})

test('找机会可编辑描述；首页圆钮直接匹配，全部城市传空串（全国），结果页返回回首页', async () => {
  const calls = []
  let empty = false
  const h = home({ activities: [], stays: [] }, {
    apiHomeMatch: async (payload) => { calls.push(payload); return { data: { empty, jobs: empty ? [] : [{ jobId: 1, title: '前台' }], stays: [], activities: [], reasons: [], overall: 80 } } },
    toast: () => {}, uni: { setStorageSync() {} }
  })
  h.run('openFinder()')
  assert.equal(h.run('s.value'), 2)
  assert.equal(h.run('editingIdea.value'), true, '直接是带 focus 的 textarea，小程序里键盘跟着弹出来')
  assert.match(h.template, /<textarea v-if="editingIdea"[^>]*:focus="true" auto-focus/)
  h.run('s.value = 1; editingIdea.value = false')

  await h.run('quickMatch()'); await flush()
  assert.equal(calls.length, 1)
  assert.equal(calls[0].city, '', '全部城市传空串，后端按全国匹配')
  assert.equal(h.run('s.value'), 3, '不经过找机会，直接看结果')
  assert.equal(h.run('resultBack.value'), 1)
  assert.match(h.template, /<k-topbar title="综合结果" back custom-back @back="s = resultBack">/)
  assert.equal(h.run('matching.value'), false)

  // 选了城市就按这个城市匹配；从找机会点「开始匹配」的，返回还是回找机会
  h.run("experience.cities = ['大理']; s.value = 2")
  await h.run('runMatch()'); await flush()
  assert.equal(calls[1].city, '大理')
  assert.equal(h.run('resultBack.value'), 2)

  // 一条都没有：照旧去城市页的「放宽条件」屏
  empty = true
  h.run('s.value = 1')
  await h.run('quickMatch()'); await flush()
  assert.equal(h.gone.at(-1), '/pages/home/city?s=4&from=match')
  h.stop()
})

test('首页搜索条连点圆钮只发一次匹配', async () => {
  let release
  const calls = []
  const h = home({ activities: [], stays: [] }, { apiHomeMatch: (payload) => { calls.push(payload); return new Promise(r => { release = r }) }, toast: () => {} })
  const first = h.run('quickMatch()')
  h.run('quickMatch()')
  assert.equal(calls.length, 1)
  assert.equal(h.run('matching.value'), true, '匹配中圆钮变淡（is-busy）')
  release({ data: { jobs: [], stays: [{ stayId: 1 }], activities: [], reasons: [] } })
  await first; await flush()
  assert.equal(h.run('matching.value'), false)
  assert.equal(h.run('rtab.value'), 1)
  h.stop()
})

test('找机会屏的头像换成首页同一只袋鼠（144px 贴纸），放在奶油色圆框里', () => {
  const { template, styles } = home({ activities: [], stays: [] })
  const s2 = template.slice(template.indexOf('<template v-else-if="s === 2">'), template.indexOf('<template v-else-if="s === 3">'))
  assert.ok(s2.includes('<view class="ai-avatar"><image class="ai-avatar__img" src="/static/media/brand-kangaroo-lg.png" mode="aspectFit" /></view>'))
  assert.ok(!template.includes('home-ai-avatar.jpg'), '49×50 的旧线稿放大发糊，不再用')
  assert.match(styles, /\.ai-avatar \{[^}]*width: 56px; height: 56px; border-radius: 50%; overflow: hidden;/)
  assert.match(styles, /\.ai-avatar__img \{[^}]*width: 49px; height: 53px; \}/)
})

test('首页引用的本地图片都已存在（含 10-16 新加的袋鼠贴纸，都是 PNG，不用 WebP）', () => {
  const src = fs.readFileSync(path.join(APP, 'pages/home/index.vue'), 'utf8')
  const used = [...new Set([...src.matchAll(/'(\/static\/[^']+)'|"(\/static\/[^"]+)"/g)].map(m => m[1] || m[2]))]
  assert.ok(used.length > 0)
  for (const p of used) assert.ok(fs.existsSync(path.join(APP, p)), p)
  for (const p of ['/static/media/brand-kangaroo-lg.png']) assert.ok(used.includes(p), p)
  assert.ok(!used.some(p => p.endsWith('.webp')), '小程序本地图片不支持 WebP')
})

test('找机会屏：主人给的文案原样照抄，例句两处都换；「旅行时间段」去掉没用的转圈图标；底部说明保留', async () => {
  const sheets = []
  const h = home({ activities: [], stays: [] }, { sheet: async (items) => { sheets.push(items); return 1 } })
  const s2 = h.template.slice(h.template.indexOf('<template v-else-if="s === 2">'), h.template.indexOf('<template v-else-if="s === 3">'))
  assert.match(s2, /<k-topbar title="找机会"/)
  assert.match(s2, /<text class="ai-title">你好，我是AI袋鼠！<\/text>/)
  assert.ok(s2.includes('<text class="ai-intro">写出来您的诉求或者想法，\\n我会搜索全部信息尽可能帮您解决问题。</text>'), '保留换行，「信息」后不加逗号')
  const example = '例如：丽江换工单间一个月或青岛兼职全职工作或想在阳朔住一周，预算500，还能抽空做点兼职'
  assert.equal(s2.split(example).length - 1, 2, 'textarea 的 placeholder 和不打字时显示的文字两处都换')
  assert.ok(!s2.includes('预算1000'))
  assert.ok(s2.includes('按你填写的条件规则匹配，结果仅供参考'))
  assert.ok(!/item\.extra/.test(h.template))
  assert.match(h.template, /<k-date-picker v-if="dateOpen" title="选择出发日期"/)
  const [date] = JSON.parse(JSON.stringify(h.run('preferences.value')))
  assert.deepEqual(date, { key: 'date', label: '旅行时间段', value: '10.18–10.24', icon: 'calendar-days' })
  await h.run('confirmFrom("2026-10-20")'); await flush()
  assert.deepEqual([...sheets[0]], ['旅行 3 天', '旅行 7 天', '旅行 14 天', '旅行 30 天', '旅行 60 天'])
  assert.equal(h.run('preferences.value[0].value'), '10.20–10.26')
  // 3 行例句 + 右下角「0/200」不打架：框 128、输入区 80
  assert.match(h.styles, /\.idea-box \{[^}]*height: 128px;/)
  assert.match(h.styles, /\.idea-box__input \{[^}]*height: 80px;/)
  h.stop()
})

for (const [rel, title, main] of [['pages/jobs/filter.vue', '筛选条件', '{{ countLabel }}'], ['pages/stays/list.vue', '筛选排序', '查看 {{ previewTotal }} 家']]) {
  test(`${title}：「重置」在底栏主按钮左边，顶栏右边不再放东西（小程序窄屏上标题会压住它）`, () => {
    const d = readSfc(rel)
    const t = d.template.content
    const bar = t.slice(t.indexOf(`<k-topbar title="${title}"`))
    assert.match(bar, new RegExp(`^<k-topbar title="${title}" back custom-back @back="[^"]+" />`))
    assert.ok(!/class="reset"/.test(t), '顶栏里的「重置」删了')
    assert.ok(t.includes(`<view class="foot-reset" hover-class="k-press" @click="reset"><text>重置</text></view><view class="foot-main"><k-button block @click="`))
    assert.ok(t.indexOf('class="foot-reset"') < t.indexOf(main))
    const css = d.styles.map(s => s.content).join('\n')
    assert.match(css, /\.foot-reset \{ flex: 0 0 auto; height: 44px;[^}]*text-decoration: underline; \}/)
    // 下划线写在外层：外层不能是 flex，否则里面的文字成了独立的块，下划线画不出来（复核时 H5 截图里「重置」没有下划线）
    assert.ok(!/\.foot-reset \{[^}]*display: flex/.test(css), '「重置」外层用行高居中，不用 flex')
    assert.match(css, /\.foot-reset \{[^}]*line-height: 44px;/)
    assert.match(css, /\.foot-main \{ flex: 1; min-width: 0; \}/)
    assert.ok(!/^\.reset \{/m.test(css))
  })
}

test('订房列表顶部的品牌名「袋鼠小院」保留宋体（--k-serif 已改黑体，品牌名改用 --k-brand）', () => {
  const css = readSfc('pages/stays/list.vue').styles.map(s => s.content).join('\n')
  assert.match(css, /\.brand__name \{[^}]*font-family: var\(--k-brand\);/)
})

test('其余写着品牌名「袋鼠小院」的地方（行程页、经营日报的落款）也用 --k-brand，不跟着 --k-serif 变黑体（袋鼠助手的首页浮层反馈 2.0 已下线）', () => {
  const css = (rel) => readSfc(rel).styles.map(s => s.content).join('\n')
  assert.match(css('pages/community/trip.vue'), /\.brand__name \{ font-family: var\(--k-brand\);/)
  assert.match(css('pages/manage/daily.vue'), /\.paper__logo text \{ display: block; font-family: var\(--k-brand\);/)
})

test('找机会屏 / 结果页 / 推荐理由页上剩下几个能点的地方也有按压反馈（清空、岗位 / 房源 / 活动、排序、编辑）', () => {
  const t = readSfc('pages/home/index.vue').template.content
  assert.ok(t.includes('<view class="preference-head__clear" hover-class="k-press" @click="clearPrefs">清空</view>'))
  for (const i of [0, 1, 2]) assert.ok(t.includes(`<view class="result-tab" :class="{ active: rtab === ${i} }" hover-class="k-press" @click="rtab = ${i}">`))
  assert.ok(t.includes('<view class="k-row k-gap6" hover-class="k-press" @click="pickSort"><text>排序</text>'))
  assert.ok(t.includes('<view class="k-row" hover-class="k-press" @click="s = 2"><text class="preference-head__clear">编辑</text>'))
})

/** 在沙箱里跑城市页（pages/home/city.vue）的 script setup：useScreen 换成可控的，onLoad 由测试手动触发 */
function cityPage(stubs = {}) {
  const rel = 'pages/home/city.vue'
  const d = readSfc(rel)
  const source = d.scriptSetup.content
  const ast = compiler.babelParse(source, { sourceType: 'module' })
  const body = ast.program.body.filter(n => n.type !== 'ImportDeclaration').map(n => source.slice(n.start, n.end)).join('\n')
  const sandbox = { console, setTimeout }
  for (const n of ast.program.body.filter(n => n.type === 'ImportDeclaration')) for (const s of n.specifiers) sandbox[s.local.name] = () => new Promise(() => {})
  const saved = [], backs = [], storage = {}
  const screen = {}
  Object.assign(sandbox, {
    ref: vue.ref, reactive: vue.reactive, computed: vue.computed, watch: vue.watch, nextTick: vue.nextTick, onUnmounted() {}, onReachBottom() {},
    useScreen: (max, extra) => { screen.s = vue.ref(1); screen.extra = extra; return screen.s },
    experience: vue.reactive({ cities: ['丽江', '平潭'] }),
    savePreferences: (cities) => { saved.push([...cities]); sandbox.experience.cities = [...cities] },
    saveAllCities: (on) => { sandbox.experience.allCities = !!on },
    back: () => backs.push('back'),
    ensureSession: async () => {}, apiCityOverview: async () => ({ data: { siblings: [] } }), apiCities: async () => ({ data: { hot: ['大理'], groups: [] } }),
    cityEntries: () => [], businessCityName: (entries, name) => name, filterCities: () => [], groupCities: () => [], confirmedLocation: () => false,
    uni: { getStorageSync: (k) => storage[k], setStorageSync: (k, v) => { storage[k] = v }, removeStorageSync: (k) => { delete storage[k] }, getLocation() {} },
    R: { home: '/pages/home/index', community: '/pages/community/index', staysList: '/pages/stays/list', jobsList: '/pages/jobs/list', activity: '/pages/community/activity' }
  }, stubs)
  vm.createContext(sandbox)
  const scope = vue.effectScope()
  scope.run(() => vm.runInContext(body, sandbox, { filename: rel + ':script-setup' }))
  const load = async (q) => { screen.s.value = Number(q.s || 1); await screen.extra.onLoad(q); await flush() }
  return { run: code => vm.runInContext(code, sandbox), load, saved, backs, storage, stop: () => scope.stop(), template: d.template.content }
}

test('切换城市屏：从首页胶囊进来（?s=2&from=home）选完直接回首页，选的城市排到兴趣城市第一个、记进最近访问', async () => {
  const c = cityPage()
  await c.load({ s: '2', from: 'home' })
  assert.equal(c.run('fromHome.value'), true)
  c.run("choose('大理')")
  assert.deepEqual(c.saved, [['大理', '丽江', '平潭']])
  assert.deepEqual(c.backs, ['back'], '回首页，首页 onShow 重新读城市')
  assert.equal(c.run('s.value'), 2, '不再落到城市主页')
  assert.deepEqual(JSON.parse(JSON.stringify(c.storage['kangaroo:recent-cities'])), ['大理'])
  c.stop()
})

test('切换城市屏：从首页进来的多一行「全部城市」，选了只记首页的「全部城市」开关，兴趣城市列表不清空（社区、订房还要用）', async () => {
  const c = cityPage()
  await c.load({ s: '2', from: 'home' })
  const s2 = c.template.slice(c.template.indexOf('<template v-else-if="s === 2">'), c.template.indexOf('<template v-else>'))
  assert.ok(s2.includes('<view v-if="fromHome" class="current-city" hover-class="k-press" @click="chooseAll"><k-icon name="globe" :size="21" color="ink" /><text class="current-city__name">全部城市</text><k-icon v-if="city === ALL" name="check" :size="18" color="red" :stroke="2.2" /></view>'))
  c.run('chooseAll()')
  assert.deepEqual(c.saved, [], '不再 savePreferences([])')
  assert.deepEqual([...c.run('experience.cities')], ['丽江', '平潭'])
  assert.equal(c.run('experience.allCities'), true)
  assert.equal(c.run('city.value'), '全部城市')
  assert.deepEqual(c.backs, ['back'])
  // 之后再选一个城市：开关关掉，首页显示这个城市
  c.run("choose('大理')")
  assert.equal(c.run('experience.allCities'), false)
  assert.deepEqual(c.saved, [['大理', '丽江', '平潭']])
  c.stop()
})

test('切换城市屏标出当前城市：首页是全部城市时那一行打勾；选着某个城市时它的胶囊描边打勾，不在最近访问里也排到第一个', async () => {
  const c = cityPage({ experience: vue.reactive({ cities: ['丽江', '平潭'], allCities: true }) })
  await c.load({ s: '2', from: 'home' })
  assert.equal(c.run('city.value'), '全部城市')
  assert.deepEqual([...c.run('recentShown.value')], [])
  const d = cityPage()
  d.storage['kangaroo:recent-cities'] = ['大理']
  d.run("recentCities.value = ['大理']")
  await d.load({ s: '2', from: 'home' })
  assert.equal(d.run('city.value'), '丽江')
  assert.deepEqual([...d.run('recentShown.value')], ['丽江', '大理'], '只在兴趣城市里选过的当前城市也看得到')
  d.run("city.value = '大理'")
  assert.deepEqual([...d.run('recentShown.value')], ['大理'])
  const s2 = d.template.slice(d.template.indexOf('<template v-else-if="s === 2">'), d.template.indexOf('<template v-else>'))
  const mark = '<view v-if="name === city" class="city-chip__on"><k-icon name="check" :size="10" color="white" :stroke="3" /></view>'
  assert.ok(s2.includes(`<view v-for="name in recentShown" :key="name" class="city-chip" :class="{ on: name === city }" @click="choose(name)"><text>{{ name }}</text>${mark}</view>`))
  assert.ok(s2.includes(`<view v-for="name in hotCities" :key="name" class="city-chip" :class="{ on: name === city }" @click="choose(name)"><text>{{ name }}</text>${mark}</view>`))
  const css = readSfc('pages/home/city.vue').styles.map(s => s.content).join('\n')
  assert.match(css, /\.city-chip\.on \{[^}]*border-color: var\(--k-red\);/)
  // A–Z 索引固定在右边（宽 24px）：内容右边留 30px，搜索框在索引上方照旧铺满
  assert.match(css, /\.switch-body \{ position: relative; padding: 10px 30px [^;]+ 16px; \}/)
  assert.match(css, /\.city-search \{ margin-right: -14px;/)
  assert.match(css, /@media \(max-width: 340px\) \{ \.current-city__name \{ font-size: 15px; \} \}/, '320 宽「暂无法确认，请手动选择」仍是一行')
  assert.match(css, /\.alphabet \{ position: fixed; right: 0;[^}]*\}\s*\.alphabet > text \{[^}]*min-width: 24px;/)
  c.stop(); d.stop()
})

test('城市主页里点城市名切换的、或直接打开切换屏但不是从首页来的：选完照旧落到城市主页，不多「全部城市」', async () => {
  const c = cityPage()
  await c.load({})
  assert.equal(c.run('fromHome.value'), false)
  c.run('openSwitch()')
  c.run("choose('厦门')")
  assert.equal(c.run('s.value'), 1)
  assert.deepEqual(c.backs, [])
  const d = cityPage()
  await d.load({ s: '2', from: 'match' })
  assert.equal(d.run('fromHome.value'), false)
  c.stop(); d.stop()
})

test('放宽条件屏：全国匹配（接口回的 city 是空串）时不显示「扩大到同城市群」', async () => {
  const c = cityPage()
  assert.deepEqual(JSON.parse(c.run('JSON.stringify(visibleRelax.value.map(x => x.key))')), ['date', 'budget', 'city'])
  c.run("emptyRes.value = { conflicts: [], city: '' }")
  assert.deepEqual(JSON.parse(c.run('JSON.stringify(visibleRelax.value.map(x => x.key))')), ['date', 'budget'])
  c.run("emptyRes.value = { conflicts: [], city: '大理' }")
  assert.deepEqual(JSON.parse(c.run('JSON.stringify(visibleRelax.value.map(x => x.key))')), ['date', 'budget', 'city'])
  assert.match(c.template, /v-for="\(item,i\) in visibleRelax"/)
  c.stop()
})

test('订房列表：首页带来的 ?city= 没有可订小院、换成别的城市时提示一声（之前悄悄换成大理）；有小院或没点名城市时不提示', async () => {
  const rel = 'pages/stays/list.vue'
  const d = readSfc(rel)
  const source = d.scriptSetup.content
  const ast = compiler.babelParse(source, { sourceType: 'module' })
  const body = ast.program.body.filter(n => n.type !== 'ImportDeclaration').map(n => source.slice(n.start, n.end)).join('\n')
  const run = async (q, cities, liked = []) => {
    const sandbox = { console, setTimeout, clearTimeout, setInterval, clearInterval }
    for (const n of ast.program.body.filter(n => n.type === 'ImportDeclaration')) for (const s of n.specifiers) sandbox[s.local.name] = () => new Promise(() => {})
    const toasts = [], screen = {}
    Object.assign(sandbox, {
      ref: vue.ref, reactive: vue.reactive, computed: vue.computed, watch: vue.watch, onUnmounted() {}, onReachBottom() {},
      useScreen: (max, extra) => { screen.s = vue.ref(1); screen.extra = extra; return screen.s },
      stayState: vue.reactive({ city: '', checkIn: '2026-10-20', checkOut: '2026-10-21' }), normalizeDates() {}, saveStayState() {},
      apiStayCities: async () => ({ data: cities }), apiStayAreas: async () => ({ data: [] }),
      experience: vue.reactive({ cities: liked }), toast: (t) => toasts.push(t), uni: { getStorageSync() {} }
    })
    vm.createContext(sandbox)
    const scope = vue.effectScope()
    scope.run(() => vm.runInContext(body, sandbox, { filename: rel + ':script-setup' }))
    screen.extra.onLoad(q); await flush(); await flush()
    scope.stop()
    return { toasts: [...toasts], city: sandbox.stayState.city }
  }
  const list = [{ city: '大理', count: 5 }, { city: '丽江', count: 2 }]
  assert.deepEqual(await run({ city: '平潭' }, list), { toasts: [], city: '平潭' })
  assert.deepEqual(await run({ city: '平潭' }, list, ['丽江']), { toasts: [], city: '平潭' }, '明确选择的目的地不被兴趣城市覆盖')
  assert.deepEqual(await run({ city: '丽江' }, list), { toasts: [], city: '丽江' })
  assert.deepEqual(await run({}, list), { toasts: [], city: '' }, '没点名城市时显示全国房源，不强行切到另一座城市')
  assert.deepEqual(await run({ city: '平潭' }, []), { toasts: [], city: '平潭' })
})

test('AI袋鼠（反馈 2.0）：assistant.vue 只留人工工单页，旧的 ?ctx= 情境链接转到聊天式客服页，带上情境和订单号', () => {
  const d = readSfc('pages/home/assistant.vue')
  const t = d.template.content
  for (const gone of ['s===1', 's===2', 's===3', 'assistant-sheet', 'profile-base', 'order-base', 'k-tabbar']) assert.ok(!t.includes(gone), gone)
  assert.ok(t.includes('<k-topbar title="问题处理中" back custom-back @back="backFromTicket" />'))
  const script = d.scriptSetup.content
  assert.match(script, /if \(Number\(q\.ticket\)\) return openTicket\(Number\(q\.ticket\)\)/)
  assert.match(script, /uni\.redirectTo\(\{ url: R\.support \+ '\?ctx=' \+ ctx \+ \(q\.orderNo \? '&orderNo=' \+ encodeURIComponent\(q\.orderNo\) : ''\) \}\)/)
  for (const gone of ['apiSupportAsk', 'apiStayOrder', 'useScreen']) assert.ok(!script.includes(gone), gone)
})

// ---------------- 10-16 复验修复（第三轮）----------------

test('首页四屏切换都回到顶部：之前 320x640 上找机会往下滚了 157px，结果屏一打开就是滚过的，最好的那张卡压在顶栏下面', async () => {
  const h = home({ activities: [], stays: [] }, {
    apiHomeMatch: async () => ({ data: { jobs: [{ jobId: 1, title: '前台' }], stays: [], activities: [], reasons: [], overall: 80 } }),
    sheet: async () => 1, toast: () => {}
  })
  h.run('openFinder()'); await flush()
  assert.deepEqual(JSON.parse(JSON.stringify(h.scrolls)), [{ scrollTop: 0, duration: 0 }], '首页 → 找机会')
  await h.run('runMatch()'); await flush()
  assert.equal(h.run('s.value'), 3)
  assert.equal(h.scrolls.length, 2, '找机会 → 结果')
  await h.run('openResult(matchedJobs.value[0])'); await flush()
  assert.equal(h.run('s.value'), 4, '点「查看推荐理由」')
  assert.equal(h.scrolls.length, 3, '结果 → 推荐理由')
  h.run('s.value = 3'); await flush()
  assert.equal(h.scrolls.length, 4, '返回也回到顶部')
  // 同一屏重复赋值不算切屏
  h.run('s.value = 3'); await flush()
  assert.equal(h.scrolls.length, 4)
  assert.ok(h.scrolls.every(o => o.scrollTop === 0 && o.duration === 0), '不做动画，直接到顶')
  h.stop()
})

test('320 宽结果卡：标签行右边给匹配度数字让位（之前「咖啡制作」和「95%」叠在一起），放不下时折行，技能再长就省略号', () => {
  const { styles, template } = home({ activities: [], stays: [] })
  const tag = styles.match(/\.match-card__tag \{[^}]*\}/)[0]
  const right = Number(tag.match(/margin: 5px (\d+)px 0 0;/)[1])
  assert.ok(right >= 64, '「100%」30px 粗体约 64px 宽，标签行右边至少让出这么多')
  assert.match(tag, /flex-wrap: wrap;/)
  assert.match(tag, /min-width: 0;/)
  assert.match(styles, /\.match-card__skill \{ min-width: 0; max-width: 100%;[^}]*white-space: nowrap; overflow: hidden; text-overflow: ellipsis; \}/)
  // 匹配度仍在右上角（结构没变，只是不再和标签抢位置）
  assert.match(styles, /\.match-card__score \{ position: absolute; right: 10px; top: 31px;/)
  assert.ok(template.includes('<view class="match-card__tag"><view v-if="job.safe" class="safe-chip">'))
})

test('推荐理由屏：「生活偏好」不再折成两行；四格偏好的小标题从 9px 改 11px，窄屏改两排两格', () => {
  const { styles } = home({ activities: [], stays: [] })
  const label = styles.match(/\.reason-row__label \{[^}]*\}/)[0]
  const width = Number(label.match(/width: (\d+)px;/)[1])
  assert.ok(width >= 56, '4 个 14px 粗体字要 56px')
  assert.match(label, /font-size: 14px;/)
  assert.match(label, /white-space: nowrap;/)
  const prefLabel = styles.match(/\.reason-pref__label \{[^}]*\}/)[0]
  assert.ok(Number(prefLabel.match(/font-size: (\d+)px;/)[1]) >= 11, '小标题至少 11px')
  assert.ok(!/font-size: (9|10)px/.test(styles.slice(styles.indexOf('.reason-body'))), '推荐理由屏没有 11px 以下的字')
  // 375 宽一排 4 格：内容区 343 - 3 个 4px 间距，按 1.6 : .7 : 1.4 : 1.75 分，每格减去左右 6px 内边距后放得下 11px 的小标题
  const cols = [1.6, 0.7, 1.4, 1.75], total = cols.reduce((a, b) => a + b, 0)
  const labels = ['旅行时间段', '人数', '工作时长偏好', '技能标签（可选）']
  cols.forEach((c, i) => assert.ok((375 - 32 - 12) * c / total - 12 >= labels[i].length * 11, labels[i]))
  assert.match(styles, /\.reason-prefs \{ display: grid; grid-template-columns: 1\.6fr \.7fr 1\.4fr 1\.75fr;/)
  // 更窄（320、360）放不下 4 格：两排两格
  assert.match(styles, /@media \(max-width: 374px\) \{\s*\.reason-prefs \{ grid-template-columns: repeat\(2,minmax\(0,1fr\)\); gap: 8px; \}/)
})

test('切换城市的 A–Z 索引按屏幕高度缩放：22 个字母在 320x640 / 568 也都露出来（之前只露 A–S）', () => {
  const css = readSfc('pages/home/city.vue').styles.map(s => s.content).join('\n')
  const box = css.match(/\.alphabet \{[^}]*\}/)[0]
  const item = css.match(/\.alphabet > text \{[^}]*\}/)[0]
  const maxVh = Number(box.match(/max-height: (\d+)vh;/)[1])
  const itemVh = Number(item.match(/line-height: ([\d.]+)vh;/)[1])
  assert.match(item, new RegExp(`height: ${itemVh}vh;`))
  assert.match(item, /padding: 0 2px;/, '上下不再另加 3px，否则矮屏还是放不下')
  assert.ok(22 * itemVh <= maxVh, '没搜索时有 22 个字母（A–Z 去掉 I O U V），总高不超过索引的最大高度')
  const top = Number(box.match(/top: (\d+)%;/)[1])
  for (const h of [568, 640, 812]) {
    assert.ok(top / 100 * h + 22 * itemVh / 100 * h <= h - 58, `${h} 高：索引底边在定位失败提示条（58px）上面`)
    assert.ok(itemVh / 100 * h >= 11, `${h} 高：每个字母至少放得下 11px 的字`)
  }
})

/** 在沙箱里跑兴趣城市页（pages/auth/onboarding.vue）的 script setup */
function onboardingPage(experienceState) {
  const rel = 'pages/auth/onboarding.vue'
  const d = readSfc(rel)
  const source = d.scriptSetup.content
  const ast = compiler.babelParse(source, { sourceType: 'module' })
  const body = ast.program.body.filter(n => n.type !== 'ImportDeclaration').map(n => source.slice(n.start, n.end)).join('\n')
  const sandbox = { console }
  for (const n of ast.program.body.filter(n => n.type === 'ImportDeclaration')) for (const s of n.specifiers) sandbox[s.local.name] = () => new Promise(() => {})
  const calls = []
  Object.assign(sandbox, {
    ref: vue.ref, onLoad() {},
    experience: vue.reactive(experienceState),
    loadPreferences: () => {},
    savePreferences: (cities) => { calls.push(['cities', [...cities]]); sandbox.experience.cities = [...cities] },
    saveAllCities: (on) => { calls.push(['all', on]); sandbox.experience.allCities = !!on },
    relaunch: (url) => calls.push(['relaunch', url]), toast: (t) => calls.push(['toast', t]),
    R: { home: '/pages/home/index', identity: '/pages/auth/identity' }
  })
  vm.createContext(sandbox)
  vm.runInContext(body, sandbox, { filename: rel + ':script-setup' })
  return { run: code => vm.runInContext(code, sandbox), calls }
}

test('首页选过「全部城市」后去兴趣城市页「保存并返回首页」：首页换成第一个兴趣城市（之前还是全部城市，像没保存上）', () => {
  const p = onboardingPage({ cities: ['大理', '成都'], allCities: true })
  p.run("toggle('大理'); toggle('厦门')")
  p.run('save()')
  assert.deepEqual(p.calls, [['cities', ['成都', '厦门']], ['all', false], ['relaunch', '/pages/home/index']])
  // 首页的城市胶囊读的就是这两样
  const h = home({ activities: [], stays: [] }, { experience: vue.reactive({ cities: ['成都', '厦门'], allCities: false }) })
  assert.equal(h.run('city.value'), '成都')
  h.stop()
  // 「暂不设置，继续逛逛」不改开关
  const q = onboardingPage({ cities: ['大理'], allCities: true })
  q.run('leave()')
  assert.deepEqual(q.calls, [['relaunch', '/pages/home/index']])
})

// 10-16 跟进（小修）：结果卡技能行、切换城市字母索引
test('结果卡标签行：只写技能，不再用「/」隔开（安心商家小签和技能之间靠间距分开；之前 320 宽折行时第二行开头挂着一个「/」），没有技能就不出这一段', () => {
  const t = readSfc('pages/home/index.vue').template.content
  const m = /<text v-if="([^"]+)" class="match-card__skill">((?:\{\{[^}]+\}\})+)<\/text>/.exec(t)
  assert.ok(m, '技能行带 v-if，只由插值拼出来')
  assert.ok(t.includes('<view class="match-card__tag"><view v-if="job.safe" class="safe-chip">'), '安心商家小签照旧在前面')
  const show = Function('job', `return !!(${m[1]})`)
  const parts = [...m[2].matchAll(/\{\{([^}]+)\}\}/g)].map(x => Function('job', `return (${x[1]})`))
  const line = (job) => (show(job) ? parts.map(f => String(f(job) ?? '')).join('') : null)
  assert.equal(line({ safe: true, skill: '门店服务' }), '门店服务')
  assert.equal(line({ safe: false, skill: '门店服务' }), '门店服务')
  assert.equal(line({ safe: true, skill: '' }), null, '只有安心商家时后面不挂东西')
  assert.ok(!t.includes("'/ '"), '整个结果卡不再拼「/」')
  assert.equal(line({ safe: false, skill: '' }), null)
})

test('切换城市点字母：分组字母停在吸顶顶栏下沿，不再被顶栏盖住（H5 和小程序同一套算法）', async () => {
  const scrolls = [], sels = []
  let rects = []
  const storage = {}
  const query = { in() { return query }, select(sel) { sels.push(sel); return query }, boundingClientRect() { return query }, exec(cb) { cb(rects) } }
  const c = cityPage({
    filterCities: () => [{ name: '中山', initial: 'Z' }, { name: '漳州', initial: 'Z' }],
    groupCities: (list) => (list.length ? [{ letter: 'Z', items: list }] : []),
    uni: {
      getStorageSync: (k) => storage[k], setStorageSync: (k, v) => { storage[k] = v }, removeStorageSync: (k) => { delete storage[k] }, getLocation() {},
      createSelectorQuery: () => query, pageScrollTo: (o) => scrolls.push(o)
    }
  })
  await c.load({ s: '2', from: 'home' })
  // 已经往下滑了 300：列表开头（紧贴顶栏下沿，顶栏高 88）现在在 -212，Z 组在屏幕 1500 处 → 文档里 1800，减去顶栏 88
  rects = [{ top: 88 - 300 }, { top: 1500 }]
  await c.run("jumpToLetter('Z')")
  assert.deepEqual(sels, ['.switch-body', '#city-group-Z'])
  const plain = (x) => JSON.parse(JSON.stringify(x))
  assert.deepEqual(plain(scrolls), [{ scrollTop: 1712, duration: 200 }])
  // 小程序：状态栏 47 + 44 的顶栏，没滑过；分组就在顶栏下面附近也不会滚成负数
  assert.equal(c.run('letterScrollTop(91, 1291)'), 1200)
  assert.equal(c.run('letterScrollTop(91, 60)'), 0)
  // 量不到（节点还没渲染出来）就退回按 selector 滚，至少能跳到附近
  rects = [null, null]
  await c.run("jumpToLetter('Z')")
  assert.deepEqual(plain(scrolls[1]), { selector: '#city-group-Z', duration: 200 })
  // 没有这个字母的城市：什么也不做
  await c.run("jumpToLetter('A')")
  assert.equal(scrolls.length, 2)
  c.stop()
})

test('城市页的 AI袋鼠（10-16）：悬浮袋鼠在本页底部弹出；旧链接 ?s=3 打开城市主页并弹出，收起回来源页，点了回答里的按钮跳走的不回', async () => {
  const c = cityPage()
  await c.load({})
  c.run('openChat()')
  assert.equal(c.run('aiOpen.value'), true)
  assert.equal(c.run('s.value'), 1, '还在城市主页，不切屏')
  c.run('closeAi()')
  assert.equal(c.run('aiOpen.value'), false)
  assert.deepEqual(c.backs, [])
  const old = cityPage()
  await old.load({ s: '3' })
  assert.equal(old.run('s.value'), 1)
  assert.equal(old.run('aiOpen.value'), true)
  old.run('closeAi()')
  assert.deepEqual(old.backs, ['back'])
  const nav = cityPage()
  await nav.load({ s: '3' })
  nav.run("closeAi('nav')")
  assert.deepEqual(nav.backs, [])
  // 再打开、收起：已经不是旧链接那一次了，不再返回
  nav.run('openChat()'); nav.run('closeAi()')
  assert.deepEqual(nav.backs, [])
  assert.match(c.template, /<k-ai-sheet :show="aiOpen" ctx="city" @close="closeAi" \/>/)
  assert.match(c.template, /<view class="bot-fab" @click="openChat">/)
  c.stop(); old.stop(); nav.stop()
})
