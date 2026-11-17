// 2026-10-17 主人反馈这一批的回归：node --test，不构建、不发请求。
//   1. 会员信息屏按主人样稿重做（profile 分包 pages/profile/index.vue 的 s=3）：顶部暖卡 → 升级进度 → 会员等级 → 我的权益 → 赚取积分 → 积分明细 → 积分规则；
//      等级名 / 门槛、每级权益、每项积分全部来自服务端（kg_member_level、kg_member_benefit、参数设置），页面不写死样稿里的「小兔鼠」「会员价预订」「消费 1 元 1 积分」；
//   2. 「我的」首屏会员卡收窄（约 66px 高），资料卡 / 宫格一起收一点，375×667 的 H5 预览里「内容与关注」整张露在「发布」圆钮上面；
//   3. 消息页（主包）：奶白底 + 白卡，未读行加粗带暖色、红点带浅红圈；只改样式，行为不变；
//   4. 社区页右边「最新 ▾」改成「筛选」按钮 + 小下拉（最新 / 热门），选中的打勾。
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'

const APP = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const require = createRequire(path.join(APP, 'package.json'))
const compiler = require('@vue/compiler-sfc'), vue = require('vue')
const read = (rel) => fs.readFileSync(path.join(APP, rel), 'utf8').replace(/\r\n/g, '\n')
const readSfc = (rel) => compiler.parse(read(rel), { filename: rel }).descriptor
const cssOf = (sfc) => sfc.styles.map(s => s.content).join('\n').replace(/\/\*[\s\S]*?\*\//g, '')
const rulesIn = (css) => (selector) => [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].filter(m => m[1].split(',').map(x => x.trim()).includes(selector)).map(m => m[2])

const PROFILE = 'pages/profile/index.vue'
const profile = readSfc(PROFILE)
const tpl = profile.template.content
const script = profile.scriptSetup.content
const pcss = cssOf(profile)
const prules = rulesIn(pcss)
const s3 = tpl.slice(tpl.indexOf('<!-- 3 会员信息与成长积分 -->'), tpl.indexOf('<!-- 4 账号与隐私设置 -->'))

// ---------------------------------------------------------------- 1 会员信息屏：版面

test('会员信息屏：七块按样稿顺序排，「积分规则」「查看等级」滚到对应卡片', () => {
  const order = ['class="card mi-hero"', '<text class="mi-title">升级进度</text>', 'id="mi-levels"', '<text class="mi-title">等级权益</text>', '<text class="mi-title">赚取积分</text>', '<text class="k-title">积分明细</text>', 'id="mi-rules"']
  const at = order.map(x => s3.indexOf(x))
  assert.ok(at.every(i => i > 0), JSON.stringify(at))
  assert.ok(at.every((i, k) => !k || i > at[k - 1]), '顺序：顶部暖卡、升级进度、会员等级、我的权益、赚取积分、积分明细、积分规则')
  assert.match(s3, /<view class="mi-hero__rules" hover-class="k-press" @click="jumpTo\('#mi-rules'\)"><view class="mi-hero__rules-pill"><text>积分规则<\/text><\/view><\/view>/)
  assert.match(s3, /<view class="mi-link" hover-class="k-press" @click="jumpTo\('#mi-levels'\)"><text>查看等级<\/text>/)
  assert.match(s3, /<text class="mi-hero__level level__name">\{\{ levelName \}\}<\/text>/)
  assert.match(s3, /<text class="mi-hero__tag">袋鼠会员<\/text>/)
  assert.match(s3, /<view class="mi-hero__pts"><text>当前积分<\/text><text class="mi-hero__num">\{\{ points \}\}<\/text><\/view>/)
  assert.match(s3, /<text class="mi-rules__title">积分规则<\/text>/)
  // 滚动停在吸顶顶栏下面：量卡片和本屏开头的距离（和城市页跳字母同一个办法），不用 H5 不认的 offsetTop
  assert.match(script, /select\('\.mi'\)\.boundingClientRect\(\)\.select\(selector\)\.boundingClientRect\(\)/)
  assert.doesNotMatch(script, /offsetTop/)
  assert.match(tpl, /<view v-else-if="s === 3" class="k-body k-pad-tab mi">/)
  // 积分明细的分页、读取失败的「重新加载」都还在
  assert.match(s3, /@click="moreRecords"/)
  assert.match(s3, /<view v-if="!membershipReady" class="card member-state">[\s\S]*?重新加载<\/button><\/view>/)
})

test('会员信息屏：不写死样稿里的等级名、权益和积分规则（都以服务端为准）', () => {
  for (const word of ['小兔鼠', '袋鼠宝宝', '小院主人', '会员价预订', '入住欢迎茶', '活动优先报名', '生日月礼遇', '免费延时退房', '攻略加精推荐', '每消费1元', '发布攻略', '15积分']) {
    assert.ok(!tpl.includes(word) && !script.includes(word), `页面里不该写死「${word}」`)
  }
  // 「赚取积分」「积分规则」「我的权益」分别读服务端的 tasks / ruleRows / levelPerks
  assert.match(script, /Array\.isArray\(me\.value\?\.tasks\)/)
  assert.match(script, /Array\.isArray\(me\.value\?\.ruleRows\)/)
  assert.match(script, /Array\.isArray\(me\.value\?\.levelPerks\)/)
  // 每级门槛来自后台「会员等级」的 minPoints
  assert.match(script, /me\.value\?\.levels\?\.map\(level => Number\(level\.minPoints\) \|\| 0\)/)
  // 六级横向滑动查看，窄屏也保留完整积分单位。
  assert.match(s3, /<text class="levels__pts">\{\{ levelItem\.min \}\}<text class="levels__ji">积<\/text>分<\/text>/)
  assert.match(s3, /<scroll-view class="mi-level-scroll" scroll-x/)
})

test('会员信息屏：未解锁等级有对应状态；新版样式仅应用于会员屏', () => {
  // 实际点按尺寸由 acceptance/20261022-membership/browser.mjs 检查。
  assert.match(s3, /<level-icon :level="levelItem\.level" :size="48" :off="levelItem\.off" \/>/)
  assert.match(s3, /selectedPerk\.off \? '达到 ' \+ selectedPerk\.minPoints \+ ' 积分解锁'/)
  assert.match(tpl, /'profile--membership': s === 3/)
  assert.match(pcss, /@import '\.\/membership\.scss'/)
  // 小程序里不能用组件标签当选择器
  assert.doesNotMatch(pcss, /(^|[\s,])k-icon\b/m)
  assert.doesNotMatch(pcss, /Georgia/)
})

// ---------------------------------------------------------------- 1 会员信息屏：脚本（跑页面真实的 script setup）

function runSetup(stubs) {
  const ast = compiler.babelParse(script, { sourceType: 'module' })
  const body = ast.program.body.filter(n => n.type !== 'ImportDeclaration').map(n => script.slice(n.start, n.end)).join('\n')
  const sandbox = { console }
  for (const n of ast.program.body.filter(n => n.type === 'ImportDeclaration')) for (const s of n.specifiers) sandbox[s.local.name] = () => new Promise(() => {})
  Object.assign(sandbox, { ref: vue.ref, computed: vue.computed, watch: vue.watch, reactive: vue.reactive, onShow() {}, onHide() {}, onUnload() {}, onUnmounted() {} }, stubs)
  vm.createContext(sandbox)
  const scope = vue.effectScope()
  scope.run(() => vm.runInContext(body, sandbox, { filename: PROFILE + ':script-setup' }))
  return { run: code => vm.runInContext(code, sandbox), stop: () => scope.stop() }
}
const harness = (screen = 3) => {
  const went = [], backs = []
  const h = runSetup({
    useScreen: () => vue.ref(screen),
    experience: vue.reactive({ account: { id: 7, nickname: '小院同学' }, mode: 'user' }),
    hasStaffAccess: vue.computed(() => false), onlineStaff: vue.computed(() => false),
    R: { orders: '/o', invite: '/iv', jobsList: '/jobs', memberBenefits: '/mb', trip: '/t', activityMine: '/a', resume: '/r', opportunities: '/op', tasks: '/tk', myIncome: '/i', myFollows: '/f', reminders: '/rm', myPosts: '/mp', publish: '/pub' },
    go: (url) => went.push(url), getCurrentPages: () => [{}, {}], uni: { navigateBack: () => backs.push('back') },
    profileIcon: (name) => 'icon:' + name, levelMascot: (level) => 'mascot:' + level, levelBadge: (level) => 'badge:' + level, absUrl: (u) => u || ''
  })
  return { ...h, went, backs, json: (code) => JSON.parse(h.run('JSON.stringify(' + code + ')')) }
}
const NAMES = ['幼崽鼠', '小袋鼠', '袋鼠', '大袋鼠', '巨袋鼠', '袋鼠王'], MINS = [0, 100, 300, 800, 2000, 5000]
const meOf = (level, extra = {}) => JSON.stringify({
  levelName: NAMES[level], level, points: 50, earned: 160, spent: 0, avatar: '', upgradeTip: '再获得 140 积分升到「袋鼠」', pointsProgress: '160/300', pointsPercent: 53,
  levels: NAMES.map((levelName, i) => ({ level: i, levelName, minPoints: MINS[i] })),
  levelPerks: NAMES.map((levelName, i) => ({ level: i, levelName, minPoints: MINS[i], items: i === 2 ? ['会员价', '欢迎茶'] : [], shopCount: i })),
  ...extra
})

test('等级权益：全部等级可选择，完整显示后台权益及解锁门槛；老接口不编权益', (t) => {
  const h = harness()
  t.after(h.stop)
  h.run(`me.value = ${meOf(0)}`)
  let cards = h.json('allPerks.value')
  assert.deepEqual(cards.map(c => c.levelName), NAMES)
  assert.deepEqual(cards.map(c => [c.cur, c.off]), [[true, false], ...Array(5).fill([false, true])])
  assert.deepEqual(cards[2].lines, ['会员价', '欢迎茶'])
  assert.deepEqual(cards.map(c => c.shops), [0, 1, 2, 3, 4, 5])
  h.run('selectPerk(2)')
  assert.equal(h.run('selectedPerk.value.level'), 2)
  assert.equal(h.run('selectedPerk.value.minPoints'), 300)
  assert.equal(h.run('selectedPerk.value.off'), true)
  h.run(`me.value = ${meOf(4)}`)
  assert.equal(h.json('allPerks.value').length, 6, '达到高级别仍可查看所有级别权益')
  h.run('selectPerk(4)')
  assert.equal(h.run('selectedPerk.value.cur'), true)
  h.run(`me.value = ${meOf(1, { levelPerks: undefined })}`)
  cards = h.json('allPerks.value')
  assert.deepEqual(cards.map(c => c.levelName), NAMES)
  assert.ok(cards.every(c => !c.lines.length && !c.shops))
  assert.match(s3, /v-if="!selectedPerk.lines.length"[^>]*>该等级权益说明待补充/)
  assert.match(s3, /v-if="selectedPerk.shops"[^>]*@click="go\(R.memberBenefits\)"/)
  assert.match(s3, /me.executionEnabled[^>]*@click="go\('\/pages\/profile\/member-wallet'\)"/)
})

test('会员等级 / 升级进度 / 头像：门槛跟后台走；没用过积分时不写「累计获得…」；没上传头像时用吉祥物', (t) => {
  const h = harness()
  t.after(h.stop)
  h.run(`me.value = ${meOf(1)}`)
  const nodes = h.json('levelNodes.value')
  assert.deepEqual(nodes.map(n => n.min), MINS)
  assert.deepEqual(nodes.map(n => n.cur), [false, true, false, false, false, false])
  assert.equal(h.run('progressCount.value'), '160/300')
  assert.equal(h.run('upgradeLine.value'), '再获得 140 积分升级到袋鼠')
  assert.equal(h.run('pointsLedgerText.value'), '', '没用过积分：累计获得 = 当前积分，不重复写')
  assert.equal(h.run('heroAvatar.value'), '', '没上传头像：模板直接放当前等级的 level-icon')
  h.run(`me.value = ${meOf(1, { spent: 50, avatar: '/profile/a.jpg' })}`)
  assert.match(h.run('pointsLedgerText.value'), /^累计获得 160 分 · 已用掉 50 分/)
  assert.equal(h.run('heroAvatar.value'), '/profile/a.jpg')
})

test('赚取积分：两项一张卡；「去完成」分别去编辑资料（返回回到会员信息）、我的评价、邀请有礼、换工岗位', (t) => {
  const h = harness()
  t.after(h.stop)
  const tasks = [
    { key: 'profile', title: '完善个人资料', points: '20积分', done: false, action: 'profile' },
    { key: 'stay_review', title: '首次入住评价', points: '10积分', done: true, action: 'review' },
    { key: 'invite', title: '邀请好友', points: '100积分/人', done: false, action: 'invite' },
    { key: 'volunteer', title: '换工换宿', points: '10积分/天', done: false, action: 'volunteer' },
    { key: 'other', title: '以后新加的', points: '5积分', done: false, action: 'x' }
  ]
  h.run(`me.value = ${meOf(0, { tasks })}`)
  const groups = h.json('taskGroups.value')
  assert.deepEqual(groups.map(g => g.map(x => x.key)), [['profile', 'stay_review'], ['invite', 'volunteer'], ['other']])
  assert.deepEqual(groups.flat().map(x => x.icon), ['user-round-check', 'star', 'user-plus', 'heart-handshake', 'sparkles'])
  h.run('doTask(taskGroups.value[0][1])')
  h.run('doTask(taskGroups.value[1][0])')
  h.run('doTask(taskGroups.value[1][1])')
  assert.deepEqual(h.went, ['/o?s=2', '/iv', '/jobs?type=volunteer'])
  // 完善个人资料：本页切到编辑资料屏，左上角返回回到会员信息（不是「我的」首屏、也不离开本页）
  h.run('doTask(taskGroups.value[0][0])')
  assert.equal(h.run('s.value'), 2)
  h.run('onBack()')
  assert.equal(h.run('s.value'), 3)
  assert.deepEqual(h.backs, [])
  // 已完成的显示「已完成」、不能点
  assert.match(s3, /<view v-if="taskItem\.done" class="mi-task__go"><view class="mi-task__btn done"><text>已完成<\/text><\/view><\/view>/)
  assert.match(s3, /<view v-else class="mi-task__go" hover-class="k-press" @click="doTask\(taskItem\)"><view class="mi-task__btn"><text>去完成<\/text><\/view><\/view>/)
  // 服务端一项都没下发：整块不显示
  h.run(`me.value = ${meOf(0, { tasks: [] })}`)
  assert.equal(h.json('taskGroups.value').length, 0)
  assert.match(s3, /<view v-if="taskGroups\.length" class="mi-sec"><text class="mi-title">赚取积分<\/text><\/view>/)
})

// 2026-10-17 积分规则补齐：服务端多下发「发布攻略」任务（action=guide），「去完成」进发布页并预选旅居攻略（kind=daily）；
// 「消费获得」「攻略获得」两条规则和分数都由服务端 ruleRows 给，页面不写死（上面「不写死」那条测试照样管着）
test('赚取积分：旅居攻略任务「去完成」进发布页预选旅居攻略；发布页认 ?kind=daily', async (t) => {
  const h = harness()
  t.after(h.stop)
  h.run(`me.value = ${meOf(0, { tasks: [{ key: 'guide', title: '服务端给的标题', points: '20积分', done: false, action: 'guide' }] })}`)
  const [[guide]] = h.json('taskGroups.value')
  assert.equal(guide.icon, 'house')
  h.run('doTask(taskGroups.value[0][0])')
  assert.deepEqual(h.went, ['/pub?kind=daily'])
  const { typeOfKind, PUBLISH_KIND } = await import('../pages/community/community-feed.js')
  assert.equal(typeOfKind('daily'), '旅居日常')
  assert.equal(PUBLISH_KIND[typeOfKind('buddy')], 'buddy')
  assert.equal(typeOfKind('nope'), '')
  assert.equal(typeOfKind(undefined), '')
  const publish = readSfc('pages/community/publish.vue').scriptSetup.content
  // 预选放在手机验证分支和恢复草稿之前：之后恢复的草稿照旧用草稿里的类型
  assert.match(publish, /await ensureSession\(\)\n[^\n]*\n\s+if \(typeOfKind\(q\?\.kind\)\) pickType\(typeOfKind\(q\.kind\)\)\n\s+if \(q\?\.need === 'phone'\)/)
})

test('积分规则：编 01、02…；老接口只有 note 时按行拆', (t) => {
  const h = harness()
  t.after(h.stop)
  const rows = Array.from({ length: 10 }, (_, i) => ({ title: '规则' + i, text: '说明' + i }))
  h.run(`me.value = ${meOf(0, { ruleRows: rows })}`)
  assert.deepEqual(h.json('ruleRows.value').map(r => r.no), ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10'])
  h.run(`me.value = ${meOf(0, { note: '怎么得：A\n怎么用：B' })}`.replace('\n', '\\n'))
  assert.deepEqual(h.json('ruleRows.value'), [{ title: '', text: '怎么得：A', no: '01' }, { title: '', text: '怎么用：B', no: '02' }])
  assert.match(s3, /<text v-if="ruleItem\.title" class="mi-rule__name">\{\{ ruleItem\.title \}\}：<\/text><text class="mi-rule__text">\{\{ ruleItem\.text \}\}<\/text>/)
})

// ---------------------------------------------------------------- 2 「我的」首屏收窄

test('「我的」首屏：紧凑会员条，内容入口有小屏样式，会员详细页独立', () => {
  assert.match(tpl, /v-else-if="s === 1"/)
  const compact = fs.readFileSync(path.join(APP, 'pages/profile/profile-home.scss'), 'utf8')
  assert.match(compact, /\.member-card \{[^}]*flex-wrap: nowrap/)
  assert.match(compact, /\.member-mascot \{[^}]*width: 44px; height: 44px/)
  assert.match(compact, /@media \(max-height: 700px\)/)
  assert.match(compact, /\.cell \{ min-height: 44px/)
  assert.match(compact, /\.grid--2 \{ grid-template-columns: repeat\(2,/)
  assert.match(tpl, /class="card member-card[^>]*@click="openMember"/)
})

// ---------------------------------------------------------------- 3 消息页（主包）

const MSG = 'pages/messages/index.vue'
const msg = readSfc(MSG)
const mtpl = msg.template.content
const mcss = cssOf(msg)
const mrules = rulesIn(mcss)

test('消息页：未读暖色卡片与已读区分，保留未读标识、全部已读和翻页', () => {
  assert.match(mtpl, /'row--unread': !m\.read/)
  assert.match(mtpl, /unread-label/)
  const theme = fs.readFileSync(path.join(APP, 'pages/messages/messages-home.scss'), 'utf8')
  assert.match(theme, /\.row--unread \{ background:\s*#FBF0DE;/)
  assert.match(theme, /\.row \{[^}]*background:\s*#F2F2F1;/)
  assert.match(theme, /\.row__desc \{[^}]*font-size:\s*13px;/)
  assert.match(mtpl, /@click="readAll">全部已读/)
  assert.match(mtpl, /@click="openMessage\(m\)"/)
  assert.match(mtpl, /@click="openEntry\(e\)"/)
  assert.match(mtpl, /@click="aiOpen = true"/)
  assert.doesNotMatch(mtpl, /<image/)
})

// ---------------------------------------------------------------- 4 社区「筛选」

const COMMUNITY = 'pages/community/index.vue'
const community = readSfc(COMMUNITY)
const ctpl = community.template.content
const cscript = community.scriptSetup.content
const crules = rulesIn(cssOf(community))

test('社区：右边「筛选」按钮（图标 + 字）点开小下拉 最新 / 热门，选中的打勾；点空白处、切页签、离开页面都收起', () => {
  assert.match(ctpl, /class="fsort"[^>]*aria-label="筛选动态排序"[^>]*@click="toggleSort"/)
  assert.doesNotMatch(ctpl.replace(/<!--[\s\S]*?-->/g, ''), /sortLabel|最新 ▾/)
  assert.match(ctpl, /v-if="sortOpen" class="fmask" @click="sortOpen = false"/)
  assert.match(ctpl, /v-for="o in SORTS"[^>]*@click="pickSort\(o.key\)"/)
  // 「已关注」是已有功能（服务端 sort=follow），保留为第三项
  assert.match(cscript, /const SORTS = \[\{ key: 'new', label: '最新' \}, \{ key: 'hot', label: '热门' \}, \{ key: 'recommend', label: '推荐' \}\]/)
  assert.match(cscript, /function toggleSort\(\) \{ sortOpen\.value = !sortOpen\.value \}/)
  assert.doesNotMatch(cscript, /await sheet\(SORTS/, '不再用底部系统菜单')
  assert.match(cscript, /const onFeedTab = \(t\) => \{\n\s+sortOpen\.value = false/)
  assert.match(cscript, /onHide\(\(\) => \{ pageShown = false; sortOpen\.value = false;/)
  assert.ok(crules('.fmenu').some(r => /position: absolute/.test(r) && /right: 0/.test(r) && /box-shadow: var\(--k-sh3\)/.test(r)))
  assert.ok(crules('.fmenu__item').some(r => /height: 48px/.test(r)), '每项 44px 高，好点')
  assert.ok(crules('.fmask').some(r => /position: fixed/.test(r)))
  assert.ok(crules('.ftabs').some(r => /position: relative/.test(r)), '下拉以页签行定位')
  // 「筛选」按钮本身 32px，外层补到 44px
  assert.ok(crules('.fsort').some(r => /height: 32px/.test(r) && /padding: 6px 6px 6px 8px/.test(r) && /margin: -6px -6px -6px 0/.test(r) && /box-sizing: content-box/.test(r)))

  // 跑 pickSort：选了别的才重拉第一页；选当前那项只收起
  const body = cscript.slice(cscript.indexOf('const SORTS ='), cscript.indexOf('// 搜索：keyword'))
  const calls = []
  const sandbox = { ref: vue.ref, computed: vue.computed, experience: {}, resetFeed: () => calls.push('reset'), loadFeed: () => calls.push('load') }
  vm.createContext(sandbox)
  vm.runInContext(body + '\n;globalThis.api = { sort, sortOpen, toggleSort, pickSort }', sandbox)
  const { sort, sortOpen, toggleSort, pickSort } = sandbox.api
  toggleSort()
  assert.equal(sortOpen.value, true)
  pickSort('new')
  assert.equal(sortOpen.value, false)
  assert.deepEqual(calls, [])
  toggleSort(); pickSort('hot')
  assert.equal(sort.value, 'hot')
  assert.equal(sortOpen.value, false)
  assert.deepEqual(calls, ['reset', 'load'])
})
