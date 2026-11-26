// 2026-10-31 消息页要表明来源（主人：消息页面需要表明信息来源，要不谁分得清）：每一行 头像、对方名字、名字下面一个浅棕小标签写来源、再下面最后一条消息、右边日期。
// 直接从页面 <script setup> 里取出真实的声明在沙箱里跑，不连网、不开浏览器；样子的截图在 forms-batch/try/shell/shots。
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { messageWording } from '../common/display-wording.js'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const require = createRequire(path.join(root, 'package.json'))
const sfc = require('@vue/compiler-sfc')
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8')
const MAIN = 'pages/messages/index.vue'
const page = sfc.parse(read(MAIN)).descriptor
const tpl = page.template.content
const scss = read('pages/messages/messages-home.scss')

// 按名字取出页面 <script setup> 顶层的 const 声明放进沙箱执行（和 messages-inbox.test.mjs 同一个做法）
function pick(names, extra = {}) {
  const code = page.scriptSetup.content
  const found = {}
  for (const n of sfc.babelParse(code, { sourceType: 'module' }).program.body) {
    if (n.type === 'VariableDeclaration' && names.includes(n.declarations[0].id.name)) found[n.declarations[0].id.name] = code.slice(n.start, n.end)
  }
  assert.deepEqual(names.filter((x) => !found[x]), [], '页面里找不到这些声明')
  const c = { privateChatEnabled: { value:true }, messageWording, absUrl: (x) => (/^\/profile\//.test(String(x || '')) ? 'https://h.test' + x : String(x || '')), computed: (fn) => ({ get value() { return fn() } }), ...extra }
  vm.createContext(c)
  vm.runInContext(names.map((x) => found[x]).join('\n') + `\nthis.out = { ${names.join(', ')} }`, c)
  return c.out
}
const NAMES = ['bucketOf', 'KIND', 'kindOf', 'TOPICS', 'parseTime', 'formatTime', 'oneLine', 'avatarStyle', 'rows']
const rowsOf = (messages, { more = true, staff = false } = {}) => pick(NAMES, { visibleMessages: { value: messages }, experience: { messagesMore: more }, staff: { value: staff } }).rows.value

test('会话行：名字、来源、头像取结构化字段，普通正文保持不变', () => {
  const [row] = rowsOf([{ id: 1, category: 'chat', bizType: 'chat_conv', title: '小院杨同学 · 平潭岛 · 平潭海岛体验官', content: '我：好的，明天到', peerName: '小院杨同学', peerAvatar: '/profile/upload/a.jpg', sourceLabel: '平潭岛 · 平潭海岛体验官', createTime: '2026-10-01 10:00:00' }])
  assert.equal(row.name, '小院杨同学')
  assert.equal(row.source, '平潭岛 · 平潭海岛体验官', '岗位名本身带分隔符也不会被拆坏')
  assert.equal(row.avatar, 'background-image:url("https://h.test/profile/upload/a.jpg")')
  assert.equal(row.title, '小院杨同学 · 平潭岛 · 平潭海岛体验官')
  assert.equal(row.desc, '我：好的，明天到')
  assert.equal(row.ini, '小', '头像底下还是首字：没头像或图裂了都有东西看')
})

test('历史称呼只在展示中更新，姓名、原始正文和跳转地址保留', () => {
  const raw = Object.freeze({ id: 9, category: 'chat', bizType: 'chat_conv', title: '义工小王', peerName: '义工小王', content: '义工小王一起做义工', sourceLabel: '直播义工', route: '/pages/community/chat?convId=9' })
  const [row] = rowsOf([raw])
  assert.equal(row.name, '义工小王')
  assert.equal(row.title, '义工小王')
  assert.equal(row.desc, '义工小王一起做换工')
  assert.equal(row.source, '直播换工')
  assert.equal(row.wordingUpdated, true)
  assert.ok(row.originalText.includes(raw.content))
  assert.equal(raw.content, '义工小王一起做义工')
  assert.equal(row.route, raw.route)
})

test('老接口（老后端、查询失败）不给新字段：退回 title，不出标签，不画头像，也不报错', () => {
  const [row] = rowsOf([{ id: 2, category: 'chat', bizType: 'chat_conv', title: '小院杨同学 · 平潭海岛体验官', content: '在吗', createTime: '2026-10-01 10:00:00' }])
  assert.deepEqual([row.name, row.source, row.avatar], ['', '', ''])
  assert.equal(row.title, '小院杨同学 · 平潭海岛体验官')
  assert.match(tpl, /<text class="row__title k-ellipsis">\{\{ m\.name \|\| m\.title \}\}<\/text>/, '没有 name 时显示 title')
  assert.match(tpl, /<text v-if="m\.source" class="row__source k-ellipsis">\{\{ m\.source \}\}<\/text>/, '没有来源不出空标签')
  assert.match(tpl, /<view v-if="m\.avatar" class="ava__img" :style="m\.avatar" \/>/, '没有头像不盖东西')
})

test('不是会话的行（订单、报名进度、活动）不受影响：照旧小标签 + 标题，没有来源标签', () => {
  const list = rowsOf([
    { id: 3, category: 'order', bizType: 'stay_order', title: '预订成功', content: '小院 · 房型', createTime: '2026-10-01 10:00:00' },
    { id: 4, category: 'apply', bizType: 'application', title: '报名已提交', content: '平潭海岛体验官', createTime: '2026-10-01 10:00:00' }
  ])
  assert.deepEqual(list.map(r => [r.k[2], r.name, r.source, r.avatar, r.ini]), [['订单', '', '', '', ''], ['报名', '', '', '', '']])
})

test('活动群：群名、「活动群」标签，图标不变（群没有头像）', () => {
  const [row] = rowsOf([{ id: 5, category: 'group', bizType: 'chat_conv', title: '海边音乐会 活动群', content: '小杨：几点集合', peerName: '海边音乐会', peerAvatar: '', sourceLabel: '活动群', createTime: '2026-10-01 10:00:00' }])
  assert.deepEqual([row.name, row.source, row.avatar, row.ini], ['海边音乐会', '活动群', '', ''])
  assert.equal(row.k[0], 'users')
})

test('名字和来源里的换行压成一行（小程序 <text> 会把换行真的显示出来）', () => {
  const [row] = rowsOf([{ id: 6, category: 'chat', title: 'x', content: 'y', peerName: '小\n杨', sourceLabel: '平潭\n海岛　体验官', createTime: '2026-10-01 10:00:00' }])
  assert.equal(row.name, '小 杨')
  assert.equal(row.source, '平潭 海岛 体验官')
})

test('头像网址：相对路径补成完整地址；空的不出；引号、括号、空白、反斜杠去掉；字母 s 不能被当成空白去掉', () => {
  const { avatarStyle } = pick(['avatarStyle'])
  assert.equal(avatarStyle(''), '')
  assert.equal(avatarStyle(null), '')
  assert.equal(avatarStyle('/profile/upload/sss.jpg'), 'background-image:url("https://h.test/profile/upload/sss.jpg")')
  assert.equal(avatarStyle('https://a.test/x"y(z) w\\v.png'), 'background-image:url("https://a.test/xyzwv.png")')
})

test('版面：名字一行、来源单独一行的小标签、消息一行；首字和图标都还在，模板里没有 <image>', () => {
  const main = /<view class="row__main">([\s\S]*?)<\/view>\s*<view class="row__side">/.exec(tpl)[1]
  const order = ['row__title', 'row__source', 'row__desc'].map(c => main.indexOf(c))
  assert.ok(order[0] > -1 && order[0] < order[1] && order[1] < order[2], '顺序：名字、来源、消息')
  assert.match(tpl, /<view class="ava" :class="m\.ini \? 'ava--ini' : 't-' \+ m\.k\[1\]" :style="\{ background: m\.color \}"><text v-if="m\.ini">\{\{ m\.ini \}\}<\/text><k-icon v-else /)
  assert.doesNotMatch(tpl, /<image/, '头像用背景图：服务器上的图不占包，主包也不用多打一个图片组件')
  assert.match(tpl, /<view class="row__side"><text>\{\{ m\.time \}\}<\/text>/, '日期还在右边')
})

test('浅棕小标签：底色和字色对比够（≥ 4.5:1），能撑开、不截断布局；头像铺满圆形', () => {
  const rule = /\.row__source \{([^}]*)\}/.exec(scss)[1]
  assert.match(rule, /display:inline-block;/)
  assert.match(rule, /max-width:100%;/)
  assert.match(rule, /background:#F1E2CE;/)
  assert.match(rule, /color:#7A5230;/)
  assert.match(rule, /font-size:11px;/)
  const lum = (hex) => {
    const ch = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255).map(v => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4))
    return 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2]
  }
  const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05) }
  assert.ok(ratio('#7A5230', '#F1E2CE') >= 4.5)
  assert.ok(ratio('#7A5230', '#FBF0DE') >= 4.5, '未读行的底色上也够')
  assert.match(scss, /\.ava \{ position:relative; overflow:hidden; \}/)
  assert.match(scss, /\.ava__img \{ position:absolute; left:0; top:0; width:100%; height:100%; border-radius:50%; background-size:cover; background-position:center; \}/)
  // 11-18 第三轮返修（纯样式数字）：消息行和提醒中心统一成 68
  assert.match(scss, /\.row \{ height:auto; min-height:68px;/, '紧凑消息行仍可随来源文字撑开')
})

test('接口：列表第一页仍带 bucket 分页才有新字段（后端约定），页面没有另外发请求', () => {
  assert.match(page.scriptSetup.content, /loadMessages\(activeCategory\.value, \{ bucket: 'main', page, size \}, more\)/)
  assert.doesNotMatch(read('common/api.js'), /peerName|sourceLabel/)
})
