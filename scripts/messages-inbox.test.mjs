// 消息页（10-15 重写）：每条消息归哪一组、列表行的图标和小标签、顶部三个入口、老链接 ?s=4 / ?s=2 的跳转，
// 以及挪进 pages/notice 分包的子页、客服页、状态样例页和它们的图片。
// 直接从页面 <script setup> 里取出真实的声明在沙箱里跑，不连网、不开浏览器。
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const require = createRequire(path.join(root, 'package.json'))
const sfc = require('@vue/compiler-sfc')
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8')
const icons = (() => { const s = read('common/icons.js'); return JSON.parse(s.slice(s.indexOf('{'), s.lastIndexOf('}') + 1)) })()
// routes.js 是 ESM：去掉 export 在沙箱里跑一遍拿到 R
const R = (() => {
  const c = {}
  vm.createContext(c)
  vm.runInContext(read('common/routes.js').replace('export const R', 'this.R').replace('export default R', ''), c)
  return c.R
})()
const MAIN = 'pages/messages/index.vue'
const INBOX = 'pages/notice/inbox.vue'

// 按名字取出页面 <script setup> 顶层的 const / let 声明，放进沙箱执行；extra 是声明里用到的外部名字（页面 import 的函数、ref 等）
function pick(rel, names, extra = {}) {
  const { descriptor } = sfc.parse(read(rel))
  const code = descriptor.scriptSetup.content
  const found = {}
  for (const n of sfc.babelParse(code, { sourceType: 'module' }).program.body) {
    if (n.type === 'VariableDeclaration' && names.includes(n.declarations[0].id.name)) found[n.declarations[0].id.name] = code.slice(n.start, n.end)
  }
  assert.deepEqual(names.filter((x) => !found[x]), [], rel + ' 里找不到这些声明')
  const c = { R, absUrl: (x) => 'abs:' + x, messageScope: () => 'test', rows: { value: [] }, scheduleExpiry: () => {}, ...extra }
  vm.createContext(c)
  vm.runInContext(names.map((x) => found[x]).join('\n') + `\nthis.out = { ${names.join(', ')} }`, c)
  return c.out
}
const styleOf = (rel) => sfc.parse(read(rel)).descriptor.styles.map((s) => s.content).join('\n')

// 和服务端 KgMessageMapper.xml 的 bucketOf 同一口径（计划书 messages-api 第 2 条）
const CASES = [
  // [category, bizType, 用户身份的组, 员工身份的组]
  ['comment', 'comment', 'comment', 'comment'],
  ['like', 'post_like', 'like', 'like'],
  ['system', 'job_subscribe', 'system', 'system'],
  ['system', 'post', 'system', 'system'],
  ['system', 'job', 'system', 'system'],
  ['system', 'online_settlement', 'system', 'system'],
  ['system', null, 'system', 'system'],
  ['system', 'activity', 'main', 'apply'],
  ['system', 'activity_signup', 'main', 'apply'],
  ['apply', 'application', 'main', 'apply'],
  ['interview', 'application', 'main', 'apply'],
  ['contract', 'application', 'main', 'apply'],
  ['staff', 'application', 'main', 'apply'],
  ['order', 'activity', 'main', 'order'],
  ['order', 'stay_order', 'main', 'order'],
  ['chat', 'chat_conv', 'main', 'main'],
  ['group', 'chat_conv', 'main', 'main'],
  ['brand_new_kind', null, 'main', 'main']
]

test('消息页和子页的分组口径一致，且与服务端 bucketOf 相同', () => {
  const main = pick(MAIN, ['bucketOf']).bucketOf
  const inbox = pick(INBOX, ['bucketOf']).bucketOf
  for (const [category, bizType, user, staff] of CASES) {
    const m = { category, bizType }
    assert.equal(main(m, false), user, `用户身份 ${category}/${bizType}`)
    assert.equal(main(m, true), staff, `员工身份 ${category}/${bizType}`)
    assert.equal(inbox(m, false), user, `子页 用户身份 ${category}/${bizType}`)
    assert.equal(inbox(m, true), staff, `子页 员工身份 ${category}/${bizType}`)
  }
})

test('列表行：分类 → 图标 / 色调 / 小标签', () => {
  const { kindOf } = pick(MAIN, ['KIND', 'kindOf'])
  const css = styleOf(MAIN)
  const expect = {
    'chat/chat_conv': ['message-circle', 'indigo', undefined],
    'group/chat_conv': ['users', 'green', undefined],
    'order/stay_order': ['receipt-text', 'ochre', '订单'],
    'system/activity': ['ticket', 'ochre', '活动'],
    'system/activity_remind': ['ticket', 'ochre', '活动'],
    'apply/application': ['clipboard-check', 'red', '报名'],
    'interview/application': ['calendar-clock', 'red', '面试'],
    'contract/application': ['file-signature', 'red', '签约'],
    'staff/application': ['briefcase-business', 'green', undefined],
    'brand_new_kind/x': ['bell', 'indigo', undefined],
    'system/job_subscribe': ['bell', 'indigo', undefined]
  }
  for (const [key, [icon, tone, tag]] of Object.entries(expect)) {
    const [category, bizType] = key.split('/')
    const k = kindOf({ category, bizType })
    assert.deepEqual([k[0], k[1], k[2]], [icon, tone, tag], key)
    assert.ok(icons[k[0]], `图标 ${k[0]} 不在 common/icons.js 里`)
    // 11-18 第三轮返修（纯样式）：方块统一浅棕底 + 暖棕图标，不再按色调分 .t-* 底色
    assert.match(css, /\.tile,\.ava\{background:var\(--k-red-soft\)!important\}/, '方块统一浅棕底')
    if (k[2]) assert.match(css, new RegExp('\\.g-' + k[1] + '\\{'), `缺少小标签配色 .g-${k[1]}`)
  }
})

test('子页的行图标都在图标库里，系统通知按 bizType 细分', () => {
  const { kindOf, KIND } = pick(INBOX, ['KIND', 'kindOf'])
  for (const [icon] of Object.values(KIND)) assert.ok(icons[icon], `图标 ${icon} 不在 common/icons.js 里`)
  assert.equal(kindOf({ category: 'system', bizType: 'activity' })[0], 'ticket')
  assert.equal(kindOf({ category: 'system', bizType: 'job_subscribe' })[0], 'briefcase-business')
  assert.equal(kindOf({ category: 'system', bizType: 'support_ticket' })[0], 'headset')
  assert.equal(kindOf({ category: 'system', bizType: null })[0], 'bell')
  assert.equal(kindOf({ category: 'order', bizType: 'activity' })[0], 'receipt-text')
})

test('顶部入口：用户身份 平台通知 / 评论 / 赞，员工身份 平台通知 / 报名 / 订单，都能在子页打开', () => {
  const { ENTRIES } = pick(MAIN, ['ENTRIES'])
  const { TITLES, EMPTY } = pick(INBOX, ['TITLES', 'EMPTY'])
  // 沙箱里的数组和这里的不是同一个 Array，先 Array.from 再比
  assert.deepEqual(Array.from(ENTRIES.user, (e) => e[1]), ['平台通知', '评论', '赞'])
  assert.deepEqual(Array.from(ENTRIES.staff, (e) => e[1]), ['平台通知', '报名', '订单'])
  for (const [type, , icon] of [...ENTRIES.user, ...ENTRIES.staff]) {
    assert.ok(TITLES[type] && EMPTY[type], `子页不认识 type=${type}`)
    assert.ok(icons[icon] && icons[EMPTY[type][1]], `图标缺失：${icon}`)
  }
  assert.deepEqual(Object.keys(TITLES).sort(), ['apply', 'comment', 'like', 'order', 'system'])
})

test('老链接：?s=4 去客服页，?s=2 去系统通知子页，其余留在消息页', () => {
  const { legacyUrl } = pick(MAIN, ['legacyUrl'])
  assert.equal(legacyUrl({ s: '4' }), '/pages/notice/support')
  assert.equal(legacyUrl({ s: '2' }), '/pages/notice/inbox?type=system')
  assert.equal(legacyUrl({ s: '1' }), '')
  assert.equal(legacyUrl({ s: '3' }), '')
  assert.equal(legacyUrl({}), '')
  // 页面在 onLoad 里用 redirectTo 换掉自己，客服页返回时回到原来那一页（评价页的「联系客服」）
  assert.match(read(MAIN), /onLoad\(\(q\) => \{ leaving = legacyUrl\(q \|\| \{\}\); if \(leaving\) uni\.redirectTo\(\{ url: leaving,/)
  const staffPage = '/pages/profile/subscription-message?id=77&mode=staff&scope=store%3A8%3Amanager'
  assert.equal(legacyUrl({subscriptionId:'77',mode:'staff',scope:'store:8:manager'}),staffPage)
  assert.equal(legacyUrl({subscriptionId:'77',mode:'staff',scope:'store%3A8%3Amanager'}),staffPage)
  assert.equal(legacyUrl({subscriptionId:'42'}),'/pages/profile/subscription-message?id=42&mode=user&scope=')
  assert.equal(legacyUrl({subscriptionId:'oops'}),'')
})

test('评论 / 赞：服务端拼好的标题拆成昵称和动作，老通知不编名字', () => {
  const { social } = pick(INBOX, ['ACTION', 'OLD_ACTION', 'social'])
  const like = social({ category: 'like', bizType: 'post_like', title: '晨光 等 3 人赞了你的动态', actorName: '晨光', actorId: 7, cover: '/u/1.jpg' }, '14:09')
  assert.equal(like.name, '晨光 等 3 人')
  assert.equal(like.action, '赞了你的动态 · 14:09')
  assert.equal(like.initial, '晨')
  assert.equal(like.cover, 'abs:/u/1.jpg')
  assert.equal(like.body, '')
  const likedComment = social({ category: 'like', bizType: 'comment_like', title: '阿布 赞了你的评论', actorName: '阿布', actorId: 9, content: '风景真好', postTitle: '洱海边' }, '昨天')
  assert.deepEqual([likedComment.name, likedComment.quote, likedComment.postTitle, likedComment.cover], ['阿布', '风景真好', '洱海边', ''])
  const reply = social({ category: 'comment', title: '星辰 回复了你的评论', actorName: '星辰', actorId: 2, content: '可以的', quote: '请问还招换工吗' }, '10-12')
  assert.deepEqual([reply.name, reply.action, reply.body, reply.quote], ['星辰', '回复了你的评论 · 10-12', '可以的', '请问还招换工吗'])
  assert.equal(social({ category: 'comment', title: '小院同学 评论了你的动态', actorName: '小院同学', actorId: 4 }, '').action, '评论了你的动态 · ')
  const old = social({ category: 'comment', title: '你的动态有新评论', content: '想去' }, '09-30')
  assert.deepEqual([old.name, old.action, old.initial, old.body], ['你的动态有新评论', '09-30', '', '想去'])
  assert.equal(old.postTitle, '动态')
  // V43 给老评论通知补上了评论人（验收库 129 行全补上）：第一行写昵称，动作按老标题换成同样的说法，不能只剩一个时间
  const oldWithActor = social({ category: 'comment', bizType: 'post', title: '你的动态有新评论', actorName: '晨光', actorId: 7, content: '想去' }, '09-30')
  assert.deepEqual([oldWithActor.name, oldWithActor.action, oldWithActor.initial], ['晨光', '评论了你的动态 · 09-30', '晨'])
  const oldReply = social({ category: 'comment', bizType: 'post', title: '有人回复了你的评论', actorName: '阿布', actorId: 9 }, '10-01')
  assert.deepEqual([oldReply.name, oldReply.action], ['阿布', '回复了你的评论 · 10-01'])
  // 补不上评论人的老回复通知：「有人」不是昵称，不能画成「有」字头像
  const oldReplyNoActor = social({ category: 'comment', bizType: 'post', title: '有人回复了你的评论', content: '好的' }, '10-01')
  assert.deepEqual([oldReplyNoActor.name, oldReplyNoActor.action, oldReplyNoActor.initial], ['有人回复了你的评论', '10-01', ''])
})

// 假服务端：ids 从新到旧；按 page / size 切一页，和 experience.loadMessages 一样追加时按 id 去重
function fakeList(server) {
  const experience = { messages: [], messagesMore: null }
  const calls = []
  let stale = false
  const loadMessages = async (category, more, append) => {
    calls.push([more.page, more.size, !!append])
    if (stale) return []
    const rows = server.slice((more.page - 1) * more.size, more.page * more.size).map((id) => ({ id }))
    const seen = new Set(append ? experience.messages.map((m) => m.id) : [])
    experience.messages = append ? experience.messages.concat(rows.filter((m) => !seen.has(m.id))) : rows
    experience.messagesMore = server.length > more.page * more.size
    return experience.messages
  }
  const ref = (value) => ({ value })
  const out = pick(MAIN, ['PAGE', 'cursor', 'busy', 'seq', 'load'], {
    experience, loadMessages, scheduleExpiry: () => {}, messageScope: () => '7:user', activeCategory: ref('interview'), toast: () => {}, paging: ref(false), failed: ref(0), ready: ref(false)
  })
  return { ...out, experience, calls, setStale: (v) => { stale = v } }
}
const ids = (h) => h.experience.messages.map((m) => m.id)

test('滑到底翻页：页码按服务端翻过的条数算，新消息把行往下挤、下一页开头重复时也能接着往下翻', async () => {
  const server = Array.from({ length: 50 }, (_, i) => 'r' + i)
  const h = fakeList(server)
  await h.load()
  assert.deepEqual(ids(h), server.slice(0, 20))
  // 看第一页时来了一条新消息：r19 被挤到第二页开头
  server.unshift('n1')
  await h.load(true)
  assert.equal(ids(h).length, 39)
  // 之前按去重后的本地条数（39）算页码，这里会再取第 2 页，之后一直卡在第 2 页
  await h.load(true)
  assert.deepEqual(h.calls.map((c) => c[0]), [1, 2, 3])
  assert.deepEqual(ids(h).slice().sort(), server.slice(1).sort())
  assert.equal(h.experience.messagesMore, false)
  await h.load(true)
  assert.equal(h.calls.length, 3, '没有下一页了还在取')
  // 回到页面时从第一页重取，往下翻过的按翻过的条数一次取回（最多 50 条），之后从第 3 页接着翻、不漏行
  await h.load()
  assert.deepEqual(h.calls[3], [1, 50, false])
  await h.load(true)
  assert.deepEqual(h.calls[4], [3, 20, true])
  assert.deepEqual(ids(h).slice().sort(), server.slice().sort())
})

test('翻页结果被「全部已读」顶掉（没有落到列表上）时，翻页位置不动，下次还取这一页', async () => {
  const server = Array.from({ length: 30 }, (_, i) => 'r' + i)
  const h = fakeList(server)
  await h.load()
  h.setStale(true)
  await h.load(true)
  h.setStale(false)
  await h.load(true)
  assert.deepEqual(h.calls.map((c) => c[0]), [1, 2, 2])
  assert.deepEqual(ids(h), server)
})

test('入口角标：有 buckets 用服务端分组数；老接口（没有 buckets、列表没分页）时按同一口径在本地数', () => {
  const list = [
    { category: 'system', read: false }, { category: 'system', read: true }, { category: 'system', bizType: 'activity_remind', read: false },
    { category: 'comment', read: false }, { category: 'like', read: false }, { category: 'like', read: false },
    { category: 'apply', read: false }, { category: 'order', read: false }, { category: 'chat', read: false }
  ]
  const ctx = { buckets: { value: null }, experience: { messagesMore: null }, visibleMessages: { value: list }, staff: { value: false } }
  const { unreadOf } = pick(MAIN, ['bucketOf', 'unreadOf'], ctx)
  assert.deepEqual(['system', 'comment', 'like'].map(unreadOf), [1, 1, 2])
  ctx.staff.value = true
  assert.deepEqual(['system', 'apply', 'order'].map(unreadOf), [1, 2, 1])
  // 新接口分页时手上只有列表那一组，不能本地数：等 /summary
  ctx.experience.messagesMore = true
  assert.equal(unreadOf('system'), 0)
  ctx.buckets.value = { system: { total: 9, unread: 3 } }
  assert.deepEqual(['system', 'apply'].map(unreadOf), [3, 0])
  // 页面里 /summary 没有 buckets 时记成 null（不是空对象），全部已读后也清成 null
  const src = read(MAIN)
  assert.match(src, /buckets\.value = r\.buckets \|\| null/)
  assert.match(src, /badgeCleared\.value = clearNoticeBadge\(notices\.value\)\s*\n\s*buckets\.value = null/)
})

// 执行完整子页脚本，观察实际的读写请求和刷新后的行状态。
function inboxPage({ paged = true, mark = async () => {} } = {}) {
  const calls = { pages: [], reads: [], groups: [], previews: [] }
  const records = Array.from({length: 23}, (_, i) => ({
    id:i+1, read:i===2, category:'system', title:'通知 '+(i+1), content:'通知正文'
  }))
  const src = sfc.parse(read(INBOX)).descriptor.scriptSetup.content
  const nodes = sfc.babelParse(src, {sourceType:'module'}).program.body
  const sandbox = { ...require('vue'), R, experience:{account:{id:7},mode:'user'}, getMessageScopeKey:()=> 'user-7',
    ensureSession:async()=>{}, onLoad(){}, onShow(){}, onHide(){}, onUnload(){}, onReachBottom(){},
    toast(){}, refreshUnread(){}, showMessagePreview:m=>calls.previews.push(m), messageWording:m=>m, absUrl:x=>x,
    apiMessageSummary:async()=>({buckets:{system:{unread:records.filter(m=>!m.read).length}}}),
    apiMessages:async (_mode,_category,{page,size})=>{
      calls.pages.push(page)
      const list = paged ? records.slice((page-1)*size,page*size) : records
      return {rows:list.map(m=>({...m})), ...(paged ? {hasMore:page*size<records.length} : {})}
    },
    apiMarkAllRead:async (...args)=>{calls.groups.push(args);return {data:{updated:0}}},
    apiMarkRead:async id=>{calls.reads.push(id);await mark(id);records.find(m=>m.id===id).read=true;return {data:{updated:1}}}
  }
  const context=vm.createContext(sandbox)
  const script=nodes.filter(n=>n.type!=='ImportDeclaration').map(n=>src.slice(n.start,n.end)).join('\n')
  const subject=vm.runInContext(script+"\n;({load,open,rows})",context)
  return {...subject,calls,unread:()=>Array.from(subject.rows.value.filter(m=>m.fresh),m=>m.id)}
}
const settleInbox = ()=>new Promise(resolve=>setImmediate(resolve))

test('打开子页和翻页都保留未读状态，点开一条只标记这一条',async()=>{
  const h=inboxPage()
  await h.load(false);await h.load(true)
  assert.deepEqual(h.calls.pages,[1,2])
  assert.deepEqual(h.calls.groups,[])
  assert.deepEqual(h.calls.reads,[])
  const before=h.unread()
  assert.ok(before.includes(1) && before.includes(21))
  assert.ok(!before.includes(3))
  h.open(h.rows.value.find(m=>m.id===21))
  await settleInbox()
  assert.deepEqual(h.calls.reads,[21])
  assert.deepEqual(h.unread(),before.filter(id=>id!==21))
})

test('旧接口的未读标记也只由用户点开触发，重开已读行不重复提交',async()=>{
  const h=inboxPage({paged:false})
  await h.load(false)
  assert.deepEqual(h.calls.groups,[])
  assert.deepEqual(h.calls.reads,[])
  const row=h.rows.value[0]
  h.open(row);h.open(row);await settleInbox();h.open(row);await settleInbox()
  assert.deepEqual(h.calls.reads,[row.id])
  assert.equal(row.read,true)
  assert.equal(h.rows.value[1].fresh,true)
})

test('单条标记失败后仍未读，再次点开才重试该条',async()=>{
  let offline=true
  const h=inboxPage({mark:async()=>{if(offline)throw Error('网络中断')}})
  await h.load(false)
  const row=h.rows.value[1], before=h.unread()
  h.open(row);await settleInbox()
  assert.deepEqual(h.unread(),before)
  offline=false
  await h.load(true)
  assert.deepEqual(h.calls.reads,[row.id])
  h.open(row);await settleInbox()
  assert.deepEqual(h.calls.reads,[row.id,row.id])
  assert.deepEqual(h.calls.groups,[])
  assert.equal(row.read,true)
  assert.ok(h.unread().includes(1) && h.unread().includes(21))
})

test('pages.json：三个子页在 pages/notice 分包里，进消息页预下载这个分包，状态样例页移出主包', () => {
  const pages = JSON.parse(read('pages.json'))
  assert.ok(!pages.pages.some((p) => p.path === 'pages/system/states'), '状态样例页还在主包')
  const notice = pages.subPackages.find((p) => p.root === 'pages/notice')
  assert.deepEqual(notice.pages.map((p) => p.path), ['index', 'inbox', 'support', 'states'])
  assert.deepEqual(pages.preloadRule['pages/messages/index'], { network: 'all', packages: ['pages/notice'] })
  for (const key of ['inbox', 'support', 'states', 'notice']) {
    const route = R[key].replace(/^\//, '')
    assert.ok(route.startsWith('pages/notice/') && notice.pages.some((p) => 'pages/notice/' + p.path === route), `${key} 路由不在分包里`)
  }
})

test('挪进分包的图片：页面引用分包自己的 static，主包 /static 里不再有、也没人再引用', () => {
  const moved = ['cs-kangaroo.jpg', 'states-room.jpg', 'states-teacher.jpg', 'states-search-empty.jpg']
  for (const name of moved) {
    assert.ok(fs.existsSync(path.join(root, 'pages/notice/static', name)), `分包里缺 ${name}`)
    assert.ok(!fs.existsSync(path.join(root, 'static/media', name)), `主包 static/media 里还留着 ${name}`)
  }
  assert.match(read('pages/notice/support.vue'), /src="\/pages\/notice\/static\/cs-kangaroo\.jpg"/)
  const states = read('pages/notice/states.vue')
  for (const name of moved.slice(1)) assert.match(states, new RegExp('/pages/notice/static/' + name.replace('.', '\\.')))
  // states-empty-box.jpg 还有员工端在用（staff/online-jobs.vue），留在主包
  assert.match(states, /\/static\/media\/states-empty-box\.jpg/)
  const offenders = []
  const walk = (dir) => {
    for (const e of fs.readdirSync(path.join(root, dir), { withFileTypes: true })) {
      const rel = dir + '/' + e.name
      if (e.isDirectory()) walk(rel)
      else if (/\.(vue|js|scss)$/.test(e.name)) {
        const src = read(rel)
        if (moved.some((n) => src.includes('/static/media/' + n))) offenders.push(rel)
      }
    }
  }
  ;['pages', 'components', 'common', 'styles'].forEach(walk)
  assert.deepEqual(offenders, [])
})

test('首页公告的回看提示指向当前的「平台通知」入口', () => {
  const popup = read('components/k-notice-popup/k-notice-popup.vue')
  assert.ok(popup.includes('以后可以在「消息 → 平台通知」里再看'))
  assert.ok(!popup.includes('「消息 → 公告」'))
})
