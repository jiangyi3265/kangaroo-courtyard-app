// 内测反馈 2.0「账号与首页」一批的回归（node --test，不需要构建、不发请求）。跑的是页面 / 模块真实的代码，接口换成假函数；
// 条件编译（// #ifdef MP-WEIXIN / H5）按平台先剥掉另一边再跑：
//   · 头像：微信里选完图弹 wx.cropImage 方形裁切（没有这个接口照旧直接上传，点取消就不换）；网页版按中心自动截正方形；
//   · 编辑资料屏：标题「编辑资料」、简历入口是一行浅色文字链接（profile-redesign-20261016.test.mjs 里也有）；
//   · 找机会：热门问法一点就填进输入框并匹配，带城市的按词里的城市；首次打开自动定位一次（只问一次，被拒保持全部城市）；
//   · 提交报名：点击当下、任何 await 之前弹微信订阅授权，结果交给 apiSubscribeAccept，不挡报名；
//   · 前台每 60 秒查未读，变多了顶栏下面露 3 秒提示条，点了去看那条消息；
//   · 客服页改成聊天样式：快捷问题、回答气泡带卡片和最多 3 个按钮、猜你想问、退款试算、常驻「转人工」（小程序是微信客服会话）。
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'
import test from 'node:test'
import assert from 'node:assert/strict'
import * as applyFlow from '../pages/jobs/apply-flow.js'

const APP = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const require = createRequire(path.join(APP, 'package.json'))
const compiler = require('@vue/compiler-sfc'), vue = require('vue')
const read = (rel) => fs.readFileSync(path.join(APP, rel), 'utf8').replace(/\r\n/g, '\n')
const readSfc = (rel) => compiler.parse(read(rel), { filename: rel }).descriptor
const flush = () => new Promise(resolve => setImmediate(resolve))
const plain = (x) => JSON.parse(JSON.stringify(x))

/** 按平台处理脚本里的条件编译：留下 plat 这一边，剥掉另一边 */
function platform(src, plat) {
  const out = [], stack = []
  for (const line of src.split('\n')) {
    const m = /^\s*\/\/ #(ifdef|ifndef|endif)\s*(.*)$/.exec(line)
    if (m) {
      if (m[1] === 'endif') stack.pop()
      else {
        const hit = m[2].split('||').map(x => x.trim()).includes(plat)
        stack.push(m[1] === 'ifdef' ? hit : !hit)
      }
      continue
    }
    if (stack.every(Boolean)) out.push(line)
  }
  return out.join('\n')
}

/** 在沙箱里跑一段模块代码：import 全部先给永远不返回的函数，再用 stubs 覆盖；export 关键字去掉 */
function runModule(source, stubs, filename) {
  const ast = compiler.babelParse(source, { sourceType: 'module' })
  const sandbox = { console }
  for (const n of ast.program.body.filter(n => n.type === 'ImportDeclaration')) for (const s of n.specifiers) sandbox[s.local.name] = () => new Promise(() => {})
  const body = ast.program.body.filter(n => n.type !== 'ImportDeclaration').map(n => {
    const code = source.slice(n.start, n.end)
    return n.type === 'ExportNamedDeclaration' ? code.replace(/^export\s+/, '') : code
  }).join('\n')
  Object.assign(sandbox, { ref: vue.ref, computed: vue.computed, watch: vue.watch, reactive: vue.reactive, nextTick: vue.nextTick }, stubs)
  vm.createContext(sandbox)
  const scope = vue.effectScope()
  scope.run(() => vm.runInContext(body, sandbox, { filename }))
  return { run: code => vm.runInContext(code, sandbox), sandbox, stop: () => scope.stop() }
}
const runSetup = (rel, plat, stubs) => runModule(platform(readSfc(rel).scriptSetup.content, plat), stubs, rel + ':' + plat)

// ---------------------------------------------------------------- 头像裁切（pages/profile/index.vue）
const profileSrc = readSfc('pages/profile/index.vue').scriptSetup.content
const avatarPart = profileSrc.slice(profileSrc.indexOf('const AVATAR_MAX'), profileSrc.indexOf('const editField'))

function avatar(plat, stubs) {
  const calls = { uploads: [], saves: [], toasts: [] }
  const m = runModule(platform(avatarPart, plat), {
    busy: vue.ref(false),
    chooseImage: async () => 'tmp://picked.jpg',
    uploadTo: async (url, p) => { calls.uploads.push([url, p]); return { data: { url: '/profile/upload/a.jpg' } } },
    save: async (payload, text) => { calls.saves.push([payload, text]); return true },
    toast: (t) => calls.toasts.push(t),
    ...stubs
  }, 'avatar:' + plat)
  return { ...m, calls }
}

test('头像（微信）：选完图先弹 wx.cropImage 1:1 裁切，上传裁好的那张', async () => {
  const crops = []
  const h = avatar('MP-WEIXIN', { wx: { cropImage: (o) => { crops.push({ src: o.src, cropScale: o.cropScale }); o.success({ tempFilePath: 'tmp://square.jpg' }) } } })
  await h.run('changeAvatar()')
  assert.deepEqual(crops, [{ src: 'tmp://picked.jpg', cropScale: '1:1' }])
  assert.deepEqual(h.calls.uploads, [['/app/upload/image', 'tmp://square.jpg']])
  assert.deepEqual(plain(h.calls.saves), [[{ avatar: '/profile/upload/a.jpg' }, '头像已更新']])
})

test('头像（微信）：在裁切框里点取消就不换头像；基础库没有 cropImage、或裁切出错时照旧直接上传原图', async () => {
  const cancel = avatar('MP-WEIXIN', { wx: { cropImage: (o) => o.fail({ errMsg: 'cropImage:fail cancel' }) } })
  await cancel.run('changeAvatar()')
  assert.deepEqual(cancel.calls.uploads, [])
  const old = avatar('MP-WEIXIN', { wx: {} })
  await old.run('changeAvatar()')
  assert.deepEqual(old.calls.uploads, [['/app/upload/image', 'tmp://picked.jpg']])
  const broken = avatar('MP-WEIXIN', { wx: { cropImage: (o) => o.fail({ errMsg: 'cropImage:fail internal error' }) } })
  await broken.run('changeAvatar()')
  assert.deepEqual(broken.calls.uploads, [['/app/upload/image', 'tmp://picked.jpg']])
})

test('头像（网页版）：按图片中心截一个正方形（最大 640px）再上传；读不了图就传原图', async () => {
  const draws = []
  class FakeImage {
    set src(v) { this._src = v; setImmediate(() => (v === 'bad' ? this.onerror() : this.onload())) }
    get naturalWidth() { return 1200 }
    get naturalHeight() { return 800 }
  }
  const document = { createElement: () => ({ getContext: () => ({ drawImage: (...a) => draws.push(a.slice(1)) }), toDataURL: (t, q) => `data:${t};q=${q}` }) }
  const h = avatar('H5', { Image: FakeImage, document })
  await h.run('changeAvatar()')
  assert.deepEqual(draws, [[200, 0, 800, 800, 0, 0, 640, 640]], '1200×800 取中间 800×800，缩到 640')
  assert.deepEqual(h.calls.uploads, [['/app/upload/image', 'data:image/jpeg;q=0.9']])
  const bad = avatar('H5', { Image: FakeImage, document, chooseImage: async () => 'bad' })
  await bad.run('changeAvatar()')
  assert.deepEqual(bad.calls.uploads, [['/app/upload/image', 'bad']])
})

// ---------------------------------------------------------------- 提交报名时的订阅授权（pages/jobs/apply.vue）
// 2026-10-18 报名页改成「用简历投递」：一屏（我的简历 + 到岗时间 + 预计时长），底部「确认投递」= submit()；没有上一步 / 下一步了。
// 订阅授权的口径不变：点「确认投递」的当下、任何 await 之前弹；简历不全（投不了）时不弹；没配模板 / 没开通 / 额度满不弹；弹框报错不挡报名
function apply(plat, { status, guest = false, resume } = {}) {
  const events = []
  let onLoadFn = null
  const h = runSetup('pages/jobs/apply.vue', plat, {
    ...applyFlow,
    onLoad: (f) => { onLoadFn = f }, onShow: () => {},
    decodeQuery: (q) => q || {},
    todayCn: () => '2026-10-18', absUrl: (u) => u || '',
    loadApplicationDraft: () => ({}),
    experience: vue.reactive({ account: guest ? null : { id: 7, phone: '13800000000' } }),
    ensureSession: async () => { events.push('session') },
    apiJobDetail: async () => ({ data: { jobId: 5, title: '洱海边咖啡馆', jobType: 'volunteer', acceptsApplication: true, startDate: '2026-10-25', minDays: 30 } }),
    apiResume: async () => ({ data: resume || { resume: { name: '小林', age: 24, phone: '13800000000', city: '大理' }, tags: [{ name: '咖啡' }] } }),
    apiSubscribeStatus: async () => { events.push('status'); return { data: status || { enabled: true, rows: [{ bizKey: 'apply_progress', templateId: 'TPL-1', quota: 0 }] } } },
    apiSubscribeAccept: async (r) => { events.push('accept:' + JSON.stringify(r)); return { data: {} } },
    apiSubmitApplication: async (body) => { events.push('submit:' + JSON.stringify(body)); return { data: { appId: 31 } } },
    bindShareAfterApply: () => {}, saveApplicationDraft: () => {}, toast: () => {}, confirm: async () => false,
    uni: {
      requestSubscribeMessage: (o) => { events.push('subscribe:' + o.tmplIds.join()); o.success({ 'TPL-1': 'accept' }) },
      pageScrollTo: () => {}
    }
  })
  return { ...h, events, load: async (q) => { onLoadFn(q); for (let i = 0; i < 6; i++) await flush() } }
}
const submitted = (h) => h.events.some(e => e.startsWith('submit:'))

test('提交报名（微信）：点击当下、任何 await 之前就弹订阅授权；授权结果交给 apiSubscribeAccept；报名照常提交', async () => {
  const h = apply('MP-WEIXIN')
  await h.load({ jobId: '5' })
  assert.ok(h.events.includes('status'), '进页面登录了就先取好模板 ID')
  // 默认值：到岗 = 岗位开始日，时长 = 最短期限（30 天 =「一个月」）
  assert.equal(h.run('arrival.value'), '2026-10-25')
  assert.equal(h.run('days.value'), 30)
  assert.equal(h.run('card.value.ready'), true)
  h.events.length = 0
  const done = h.run('submit()')
  // submit() 同步跑到第一个 await 为止：订阅框必须已经弹了，且排在 ensureSession（isGuest 里的第一个 await）前面
  assert.deepEqual(h.events.slice(0, 2), ['subscribe:TPL-1', 'accept:{"TPL-1":"accept"}'])
  assert.ok(h.events.indexOf('subscribe:TPL-1') < h.events.indexOf('session'))
  await done; await flush(); await flush()
  assert.ok(submitted(h), '授权不挡报名')
  // 简历投递：只传岗位、到岗日期、天数（姓名 / 年龄 / 手机由服务端从简历取）
  const body = JSON.parse(h.events.find(e => e.startsWith('submit:')).slice(7))
  assert.deepEqual(Object.keys(body).sort(), ['arrival', 'days', 'idemKey', 'jobId'])
  assert.equal(body.arrival, '2026-10-25'); assert.equal(body.days, 30)
  // 同一次打开只问一次：提交失败重试时不再弹
  h.run('saved.value = false')
  h.events.length = 0
  h.run('submit()')
  assert.ok(!h.events.some(e => e.startsWith('subscribe')))
})

test('提交报名（微信）：简历不全（投不了）、没配模板 / 没开通、额度攒满时都不弹；弹框报错也不挡报名', async () => {
  const missing = apply('MP-WEIXIN', { resume: { resume: { name: '小林', phone: '' } } })
  await missing.load({ jobId: '5' })
  assert.deepEqual(plain(missing.run('card.value.missing')), ['年龄'])
  missing.run('submit()'); await flush(); await flush()
  assert.ok(!missing.events.some(e => e.startsWith('subscribe')))
  assert.ok(!submitted(missing), '简历缺年龄：不提交，先去补全')
  const none = apply('MP-WEIXIN', { resume: { resume: { isNew: true, name: '小林' } } })
  await none.load({ jobId: '5' })
  assert.equal(none.run('card.value.exists'), false)
  none.run('submit()'); await flush(); await flush()
  assert.ok(!none.events.some(e => e.startsWith('subscribe')) && !submitted(none))
  for (const status of [{ enabled: false, rows: [{ bizKey: 'apply_progress', templateId: 'TPL-1', quota: 0 }] }, { enabled: true, rows: [] },
    { enabled: true, rows: [{ bizKey: 'apply_progress', templateId: 'TPL-1', quota: 5 }] }]) {
    const h = apply('MP-WEIXIN', { status })
    await h.load({ jobId: '5' })
    await h.run('submit()'); await flush()
    assert.ok(!h.events.some(e => e.startsWith('subscribe')), JSON.stringify(status))
    assert.ok(submitted(h))
  }
  const throws = apply('MP-WEIXIN')
  await throws.load({ jobId: '5' })
  throws.sandbox.uni.requestSubscribeMessage = () => { throw new Error('基础库太低') }
  await throws.run('submit()'); await flush()
  assert.ok(submitted(throws))
})

test('提交报名（网页版）：没有微信订阅，不取模板、不弹框', async () => {
  const h = apply('H5')
  await h.load({ jobId: '5' })
  await h.run('submit()'); await flush()
  assert.ok(!h.events.includes('status'))
  assert.ok(!h.events.some(e => e.startsWith('subscribe')))
  assert.ok(submitted(h))
})

// ---------------------------------------------------------------- 前台未读轮询 + 顶部提示条（common/news-toast.js）
function news({ unread = [3], latest, page = 'pages/home/index' } = {}) {
  const timers = { interval: null, timeouts: [] }
  const calls = { gone: [], read: [], lists: 0 }
  const experience = vue.reactive({ account: { id: 7 }, mode: 'user', unread: 2 })
  let i = 0
  const m = runModule(read('common/news-toast.js'), {
    experience,
    refreshUnread: async () => { experience.unread = unread[Math.min(i++, unread.length - 1)]; return experience.unread },
    apiMessages: async (mode, cat, more) => { calls.lists++; calls.listArgs = [mode, cat, plain(more)]; return { rows: latest ? [latest] : [] } },
    apiMarkRead: async (id) => { calls.read.push(id) },
    go: (u) => calls.gone.push(u),
    getCurrentPages: () => [{ route: page }],
    setInterval: (f, ms) => { timers.interval = { f, ms }; return 1 },
    clearInterval: () => { timers.interval = null },
    setTimeout: (f, ms) => { timers.timeouts.push({ f, ms }); return 2 },
    clearTimeout: () => {}
  }, 'common/news-toast.js')
  return { ...m, timers, calls, experience }
}

test('前台轮询：App 显示时每 60 秒查一次未读，切到后台就停；未读变多了取最新 1 条，在顶栏下面露 3 秒', async () => {
  const h = news({ unread: [3], latest: { id: 88, title: '你的报名已通过审核，去选面试时间', route: '/pages/jobs/progress?appId=5', read: false } })
  h.run('startNewsPolling()')
  assert.equal(h.timers.interval.ms, 60000)
  await h.timers.interval.f(); await flush()
  assert.deepEqual(h.calls.listArgs, ['user', undefined, { page: 1, size: 1 }])
  assert.equal(h.run('newsTip.text'), '你的报名已通过审核，去选面试时间')
  assert.equal(h.timers.timeouts[0].ms, 3000)
  h.timers.timeouts[0].f()
  assert.equal(h.run('newsTip.text'), '', '3 秒后自己收起')
  h.run('stopNewsPolling()')
  assert.equal(h.timers.interval, null)
})

test('前台轮询：没变多不取消息；消息页 / 私信聊天页自己在刷新，不弹；没登录不查', async () => {
  const same = news({ unread: [2], latest: { id: 1, title: 'x' } })
  same.run('startNewsPolling()')
  await same.timers.interval.f(); await flush()
  assert.equal(same.calls.lists, 0)
  for (const page of ['pages/messages/index', 'pages/community/chat']) {
    const q = news({ unread: [5], latest: { id: 1, title: 'x' }, page })
    q.run('startNewsPolling()')
    await q.timers.interval.f(); await flush()
    assert.equal(q.calls.lists, 0, page)
    assert.equal(q.run('newsTip.text'), '')
  }
  const guest = news({ unread: [5] })
  guest.experience.account = null
  guest.run('startNewsPolling()')
  await guest.timers.interval.f(); await flush()
  assert.equal(guest.calls.lists, 0)
})

test('点提示条：标成已读并去消息自己带的页面；没带页面（或就是消息页）的去消息中心', async () => {
  const h = news({ unread: [3], latest: { id: 88, title: '新评论', route: '/pages/community/detail?id=3', read: false } })
  h.run('startNewsPolling()')
  await h.timers.interval.f(); await flush()
  h.run('openNewsTip()'); await flush()
  assert.deepEqual(h.calls.gone, ['/pages/community/detail?id=3'])
  assert.deepEqual(h.calls.read, [88])
  assert.equal(h.run('newsTip.text'), '')
  const noRoute = news({ unread: [3], latest: { id: 9, title: '系统通知', route: '/pages/messages/index?s=2', read: false } })
  noRoute.run('startNewsPolling()')
  await noRoute.timers.interval.f(); await flush()
  noRoute.run('openNewsTip()')
  assert.deepEqual(noRoute.calls.gone, ['/pages/messages/index'])
})

test('前台轮询接在 App 的 onShow / onHide 上；提示条画在每页都有的顶栏里（一行、可点）', () => {
  const app = read('App.vue')
  assert.match(app, /import \{ startNewsPolling, stopNewsPolling \} from '\.\/common\/news-toast\.js'/)
  assert.match(app, /onShow: function\(options\) \{[\s\S]*startNewsPolling\(\)[\s\S]*onHide: function\(\) \{[\s\S]*stopNewsPolling\(\)/)
  const bar = readSfc('components/k-topbar/k-topbar.vue')
  assert.match(bar.template.content, /<view v-if="newsTip\.text" class="k-news" hover-class="k-press" @click="openNewsTip">/)
  assert.match(bar.styles[0].content, /\.k-news__text \{[^}]*white-space: nowrap; overflow: hidden; text-overflow: ellipsis;/)
})

// ---------------------------------------------------------------- 找机会热门问法 + 首次自动定位（pages/home/index.vue）
const shiftDate = (ymd, n) => {
  const [y, m, d] = ymd.split('-').map(Number)
  const t = new Date(Date.UTC(y, m - 1, d) + n * 86400000)
  return `${t.getUTCFullYear()}-${String(t.getUTCMonth() + 1).padStart(2, '0')}-${String(t.getUTCDate()).padStart(2, '0')}`
}
function home(stubs = {}) {
  const storage = {}, toasts = [], matches = [], saved = []
  const experience = vue.reactive({ cities: [], allCities: false, ...(stubs.experience || {}) })
  const h = runSetup('pages/home/index.vue', 'MP-WEIXIN', {
    onShow() {}, useScreen: () => vue.ref(2), experience,
    apiHomeFeed: async () => ({ data: { activities: [], stays: [] } }),
    apiHomeMatch: async (p) => { matches.push(plain(p)); return { data: { jobs: [{ jobId: 1 }], stays: [], activities: [], reasons: [], overall: 80 } } },
    savePreferences: (c) => { saved.push([...c]); experience.cities = [...c] },
    saveAllCities: (on) => { experience.allCities = !!on },
    toast: (t) => toasts.push(t), go: () => {}, errText: (e, f) => f, absUrl: (u) => u, checkNoticePopup: () => {},
    todayCn: () => '2026-10-16', shiftDate,
    uni: { getStorageSync: (k) => storage[k], setStorageSync: (k, v) => { storage[k] = v }, pageScrollTo: () => {} },
    R: { city: '/pages/home/city' },
    ...stubs, experience
  })
  return { ...h, storage, toasts, matches, saved, experience }
}

test('热门问法：选了城市时「X 换宿」排第一；全部城市时不放；只用匹配规则认得的字眼', (t) => {
  const all = home()
  t.after(all.stop)
  assert.deepEqual(plain(all.run('hotWords.value')).map(w => w.text), ['大理 换宿 一个月', '丽江 换工 包住', '会拍照 想找民宿换工', '住一周 预算500'])
  const qd = home({ experience: { cities: ['青岛'] } })
  t.after(qd.stop)
  assert.equal(plain(qd.run('hotWords.value'))[0].text, '青岛 换宿')
  const tpl = readSfc('pages/home/index.vue').template.content
  const s2 = tpl.slice(tpl.indexOf('<template v-else-if="s === 2">'), tpl.indexOf('<template v-else-if="s === 3">'))
  assert.match(s2, /<view class="hot-words"><view v-for="w in hotWords" :key="w\.text" class="hot-word" hover-class="k-press" @click="useHotWord\(w\)"><text>\{\{ w\.text \}\}<\/text><\/view><\/view>/)
})

test('热门问法：点一下填进输入框直接匹配；带城市的按词里的城市（首页选的是青岛也按大理），写了天数的把旅行天数改成一致', async () => {
  const h = home({ experience: { cities: ['青岛'] } })
  await h.run("useHotWord(hotWords.value[1])"); await flush()
  assert.equal(h.run('idea.value'), '大理 换宿 一个月')
  assert.equal(h.matches[0].city, '大理')
  assert.equal(h.matches[0].text, '大理 换宿 一个月')
  assert.equal(h.matches[0].to, shiftDate(h.matches[0].from, 29))
  assert.equal(h.run('s.value'), 3)
  // 不带城市的按首页城市；用户改了文字后就不再沿用热门词的城市
  await h.run("useHotWord(hotWords.value[4])"); await flush()
  assert.equal(h.matches[1].city, '青岛')
  assert.equal(h.matches[1].to, shiftDate(h.matches[1].from, 6))
  h.run("useHotWord(hotWords.value[1]); idea.value = '大理 换宿 两周'")
  await flush()
  await h.run('runMatch()'); await flush()
  assert.equal(h.matches.at(-1).city, '青岛')
})

test('首次打开自动定位：没选过城市、没选过全部城市、没定位过才问一次；成功切到所在城市并提示', async () => {
  const h = home({ locateCity: async () => ({ found: true, name: '厦门', label: '思明区 · 厦门' }) })
  h.run('autoLocateOnce()'); await flush()
  assert.equal(h.storage['kangaroo:located-once'], 1, '问之前先记上，不会再问')
  assert.deepEqual(h.saved, [['厦门']])
  assert.equal(h.experience.allCities, false)
  assert.deepEqual(h.toasts, ['已为你定位到厦门，可点城市切换'])
  // 再打开：不再问
  let asked = 0
  const again = home({ locateCity: async () => { asked++; return null } })
  again.storage['kangaroo:located-once'] = 1
  again.run('autoLocateOnce()'); await flush()
  assert.equal(asked, 0)
})

test('首次打开自动定位：选过城市 / 选过全部城市的不问；拒绝或失败保持全部城市，以后也不再问', async () => {
  for (const experience of [{ cities: ['大理'] }, { allCities: true }]) {
    let asked = 0
    const h = home({ experience, locateCity: async () => { asked++; return null } })
    h.run('autoLocateOnce()'); await flush()
    assert.equal(asked, 0, JSON.stringify(experience))
    assert.equal(h.storage['kangaroo:located-once'], undefined)
  }
  const refused = home({ locateCity: async () => null })
  refused.run('autoLocateOnce()'); await flush()
  assert.deepEqual(refused.saved, [])
  assert.deepEqual(refused.toasts, [])
  assert.equal(refused.storage['kangaroo:located-once'], 1)
  // 定位回来之前用户自己选了城市：不覆盖
  let finish
  const race = home({ locateCity: () => new Promise((r) => { finish = r }) })
  race.run('autoLocateOnce()')
  race.experience.cities = ['丽江']
  finish({ found: true, name: '厦门' }); await flush()
  assert.deepEqual(race.saved, [])
})

test('切换城市屏的定位和首页共用 common/locate.js；首页 onShow 里接上自动定位', () => {
  const city = readSfc('pages/home/city.vue').scriptSetup.content
  assert.match(city, /import \{ locateCity \} from '@\/common\/locate\.js'/)
  assert.match(city, /locateCity\(\)\.then\(\(result\) => \{/)
  assert.doesNotMatch(city, /uni\.getLocation/)
  const locate = read('common/locate.js')
  assert.match(locate, /uni\.getLocation\(\{\n\s+type,/)
  assert.match(locate, /coordinateType|type = 'gcj02'/)
  assert.match(readSfc('pages/home/index.vue').scriptSetup.content, /onShow\(async \(\) => \{ await ensureSession\(\); loadPreferences\(\); loadFeed\(\); checkNoticePopup\(\); autoLocateOnce\(\) \}\)/)
})

// ---------------------------------------------------------------- 聊天式客服（问答逻辑在 common/support-chat.js，整页 pages/notice/support.vue 和底部弹层 components/k-ai-sheet 共用）
const CHAT_NAMES = 'ctx, orderNo, chips, msgs, input, asking, order, contactFrom, orderTitle, orderDates, start, ask, send, openFaq, openLink, toHuman'
function support(plat, stubs = {}) {
  const asks = [], tickets = [], gone = []
  const src = platform(read('common/support-chat.js'), plat) + `\nvar { ${CHAT_NAMES} } = useSupportChat({ open: (u) => __gone.push(u), scroll: () => {} })`
  const h = runModule(src, {
    __gone: gone,
    ensureSession: async () => {},
    experience: vue.reactive({ account: { id: 7 }, mode: 'user', cities: ['大理'], allCities: false }),
    apiSupportQuick: async (c) => ({ data: c === 'order' ? ['取消要扣多少？'] : ['报名进度', '查看客服回复', '退款规则'] }),
    apiSupportFaqs: async () => ({ data: [{ faqId: 1, question: '责任书在哪里签署？', answer: '在审核进度页签署。' }] }),
    apiSupportContact: async () => ({ data: { available: false } }),
    apiSupportAsk: async (p) => { asks.push(plain(p)); return { data: stubs.answer || { text: '你有 1 个进行中的报名', cards: [{ type: 'application', title: '咖啡馆 · 大理', status: '报名审核中', url: '/pages/jobs/progress?appId=1', image: '/profile/a.jpg' }], links: [{ label: 'a', url: '/a' }, { label: 'b', url: '/b' }, { label: 'c', url: '/c' }, { label: 'd', url: '/d' }], source: '袋鼠小院报名系统' } } },
    apiSupportTicket: async (p) => { tickets.push(plain(p)); return { data: { ticketId: 12, message: '已提交人工客服' } } },
    apiStayOrder: async () => ({ data: { payFen: 20000, checkIn: '2026-10-20', nights: 2, statusLabel: '待入住', stay: { stayName: '平潭小院', typeName: '海景房' } } }),
    confirm: async () => true, errText: (e, f) => (e && e.message) || f, yuan: (f) => String(f / 100), absUrl: (u) => 'https://img.test' + u,
    toast: () => {},
    uni: { pageScrollTo: () => {}, makePhoneCall: () => {} },
    R: { assistant: '/pages/home/assistant', stayOrder: '/pages/stays/order' },
    ...stubs
  }, 'common/support-chat.js:' + plat)
  h.sandbox.__q = null
  return { ...h, asks, tickets, gone, load: async (q) => { h.sandbox.__q = q; await h.run('start(__q.ctx, __q.orderNo)'); await flush(); await flush() } }
}

test('整页客服和底部弹层都用 common/support-chat.js：整页 onLoad 按 ctx / orderNo 开场，弹层打开时开场、换了情境才重开', () => {
  const page = readSfc('pages/notice/support.vue').scriptSetup.content
  assert.match(page, /useSupportChat\(\{ open: go, scroll: scrollDown \}\)/)
  assert.match(page, /onLoad\(\(q0\) => \{\n\s+const q = decodeQuery\(q0\) \|\| \{\}\n\s+start\(q\.ctx, q\.orderNo\)/)
  const sheet = readSfc('components/k-ai-sheet/k-ai-sheet.vue').scriptSetup.content
  assert.match(sheet, /useSupportChat\(\{ open, scroll: scrollDown \}\)/)
  assert.match(sheet, /const open = \(url\) => \{ emit\('close', 'nav'\); go\(url\) \}/, '点回答里的按钮先收起弹层再跳')
  assert.match(sheet, /if \(key !== startedKey\) \{ startedKey = key; start\(props\.ctx, props\.orderNo\) \}/)
  for (const s of [page, sheet, read('common/support-chat.js')]) assert.doesNotMatch(s, /showModal/)
})

test('客服页：快捷问题来自服务端（预测的在前）；开场气泡 + 猜你想问；点常见问题直接给答案', async () => {
  const h = support('MP-WEIXIN')
  await h.load({ ctx: 'profile' })
  assert.deepEqual(plain(h.run('chips.value')), ['报名进度', '查看客服回复', '退款规则'])
  const msgs = plain(h.run('msgs.value'))
  assert.match(msgs[0].text, /你好，我是AI袋鼠/)
  assert.equal(msgs[1].faqs[0].question, '责任书在哪里签署？')
  h.run('openFaq(msgs.value[1].faqs[0])')
  const last = plain(h.run('msgs.value')).slice(-2)
  assert.deepEqual(last.map(m => [m.from, m.text]), [['me', '责任书在哪里签署？'], ['bot', '在审核进度页签署。']])
})

test('客服页：回答是气泡，带卡片（图片补全地址、能点进去）和最多 3 个按钮，不弹窗', async () => {
  const h = support('MP-WEIXIN')
  await h.load({ ctx: 'profile' })
  await h.run("ask('报名进度')"); await flush()
  assert.deepEqual(h.asks[0], { question: '报名进度', context: 'profile', city: '大理' })
  const bot = plain(h.run('msgs.value')).at(-1)
  assert.equal(bot.from, 'bot')
  assert.equal(bot.text, '你有 1 个进行中的报名')
  assert.equal(bot.cards[0].image, 'https://img.test/profile/a.jpg')
  assert.deepEqual(bot.links.map(l => l.label), ['a', 'b', 'c'])
  assert.equal(bot.source, '袋鼠小院报名系统')
  const script = readSfc('pages/notice/support.vue').scriptSetup.content
  assert.doesNotMatch(script, /showModal/)
})

test('客服页（订单情境）：订单摆在上面，退款试算画成一块（距入住 / 扣多少 / 预计退多少），去订单页申请的按钮保留', async () => {
  const h = support('MP-WEIXIN', { answer: { text: '按这张订单的退订政策现在取消…', cards: [{ type: 'refund', refundFen: 15000, allowed: true, hoursLeftText: '3 天' }], links: [{ label: '去订单页申请', url: '/pages/stays/order?orderNo=SO1&view=refund' }], source: '该房源的退订政策（下单时快照）' } })
  await h.load({ ctx: 'order', orderNo: 'SO1' })
  assert.deepEqual(plain(h.run('chips.value')), ['取消要扣多少？'])
  assert.equal(h.run('orderTitle.value'), '平潭小院 · 海景房')
  await h.run("ask('取消要扣多少？')"); await flush()
  assert.equal(h.asks[0].orderNo, 'SO1')
  const bot = plain(h.run('msgs.value')).at(-1)
  assert.deepEqual(bot.refund, ['距入住：3 天', '按退订政策扣除约 25%', '预计退款金额：¥150'])
  assert.deepEqual(bot.cards, [], '退款卡不再重复画成普通卡片')
  assert.equal(bot.links[0].label, '去订单页申请')
})

test('客服页「转人工」：小程序是微信客服会话按钮（带用户编号和来源页），常驻右上角；网页版把刚才的问题提交成工单', async () => {
  const tpl = readSfc('pages/notice/support.vue').template.content
  assert.match(tpl, /<!-- #ifdef MP-WEIXIN -->\s*<button class="sp-human" open-type="contact" :session-from="contactFrom">/)
  assert.match(tpl, /<!-- #ifndef MP-WEIXIN -->\s*<view class="sp-human" hover-class="k-press" @click="toHuman">/)
  const mp = support('MP-WEIXIN')
  await mp.load({ ctx: 'profile' })
  assert.equal(mp.run('contactFrom.value'), '7|support-profile')
  await mp.run("ask('转人工')"); await flush()
  assert.match(plain(mp.run('msgs.value')).at(-1).text, /点右上角「转人工」/)
  assert.equal(mp.asks.length, 0)
  assert.equal(mp.tickets.length, 0)
  const h5 = support('H5')
  await h5.load({ ctx: 'profile' })
  await h5.run('toHuman()'); await flush()
  assert.match(plain(h5.run('msgs.value')).at(-1).text, /先在下面写下你要咨询的问题/)
  await h5.run("ask('押金什么时候退')"); await flush()
  await h5.run('toHuman()'); await flush()
  assert.equal(h5.tickets[0].question, '押金什么时候退')
  assert.equal(h5.tickets[0].context, 'profile')
  const bot = plain(h5.run('msgs.value')).at(-1)
  assert.deepEqual(bot.links, [{ label: '查看工单', url: '/pages/home/assistant?ticket=12' }])
})

test('底部弹层的「转人工」：小程序是微信客服会话按钮（来源记 support-情境，城市页是 support-city），网页版提交工单', async () => {
  const tpl = readSfc('components/k-ai-sheet/k-ai-sheet.vue').template.content
  assert.match(tpl, /<!-- #ifdef MP-WEIXIN -->\s*<button class="k-ai__human" open-type="contact" :session-from="contactFrom">/)
  assert.match(tpl, /<!-- #ifndef MP-WEIXIN -->\s*<view class="k-ai__human" hover-class="k-press" @click="toHuman">/)
  const mp = support('MP-WEIXIN')
  await mp.load({ ctx: 'city' })
  assert.equal(mp.run('contactFrom.value'), '7|support-city')
  assert.deepEqual(plain(mp.run('chips.value')), ['报名进度', '查看客服回复', '退款规则'])
  await mp.load({ ctx: 'nope' })
  assert.equal(mp.run('ctx.value'), 'profile', '不认识的情境按「我的」')
})

test('「我的 → AI袋鼠」在本页底部弹出；城市页的旧客服屏下线；订单页的旧入口 assistant.vue 照旧转到整页客服（带 ctx 和订单号）', () => {
  assert.match(read('pages/profile/index.vue'), /\{ art: 'assistant', label: 'AI袋鼠', action: openAi \}/)
  assert.match(read('pages/profile/index.vue'), /<k-ai-sheet :show="aiOpen" ctx="profile" @close="aiOpen = false" \/>/)
  const city = readSfc('pages/home/city.vue')
  assert.doesNotMatch(city.template.content, /s === 3|转人工客服|chat-input/)
  assert.doesNotMatch(city.scriptSetup.content, /apiSupportAsk|apiSupportTicket/)
  assert.match(readSfc('pages/home/assistant.vue').scriptSetup.content, /uni\.redirectTo\(\{ url: R\.support \+ '\?ctx=' \+ ctx/)
})

// 2026-10-18 主人：「我的收藏」「我的关注」合成「收藏与关注」（follows 页顶部下拉切换），收藏不再弹系统菜单；
// 收藏的活动是第 5 个页签，读收藏的活动（apiActivityFavorites → /app/activities/favorites；后端 mine 没有 fav 页签），点一行进活动详情
test('收藏与关注：「我的」进 follows ?mode=fav；收藏分 岗位 / 房源 / 服务 / 帖子 / 活动 五个页签，活动点进活动详情', async () => {
  const profile = readSfc('pages/profile/index.vue').scriptSetup.content
  assert.match(profile, /\{ art: 'favorites', label: '收藏与关注', url: R\.myFollows \+ '\?mode=fav' \}/)
  assert.doesNotMatch(profile, /openFavorites|pickPaged/)
  const src = readSfc('pages/profile/follows.vue').scriptSetup.content
  assert.match(src, /const FAV_TABS = \[\{ key: 'job', label: '岗位'[\s\S]*?\{ key: 'activity', label: '活动', icon: 'ticket' \}\]/)
  assert.match(src, /if \(kind === 'activity'\) d = \(await apiActivityFavorites\(\)\)\.data/)
  assert.match(read('common/api.js'), /export const apiActivityFavorites = \(\) => get\('\/app\/activities\/favorites'\)/)
  const part = src.slice(src.indexOf('function openFav('), src.indexOf('\n}\n', src.indexOf('function openFav(')) + 3)
  const gone = []
  const m = runModule(part, { go: (u) => gone.push(u), R: { activity: '/a', jobDetail: '/j', stayDetail: '/s', community: '/c', stayShop: '/shop' }, toast: () => {} }, 'openFav')
  await m.run("openFav({ kind: 'activity', id: 9 })")
  await m.run("openFav({ kind: 'job', id: 3 })")
  await m.run("openFav({ kind: 'service', id: 5, off: true })")
  assert.deepEqual(gone, ['/a?id=9', '/j?jobId=3'], '下架的服务不跳')
})
