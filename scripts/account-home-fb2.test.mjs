// 内测反馈 2.0「账号与首页」一批的回归（node --test，不需要构建、不发请求）。跑的是页面 / 模块真实的代码，接口换成假函数；
// 条件编译（// #ifdef MP-WEIXIN / H5）按平台先剥掉另一边再跑：
//   · 头像：微信资料页用原生 chooseAvatar，网页版按中心自动截正方形；
//   · 编辑资料屏：标题「编辑资料」、简历入口是一行浅色文字链接（profile-redesign-20261016.test.mjs 里也有）；
//   · 找机会：热门问法一点就填进输入框并匹配，带城市的按词里的城市；微信首次定位说明用途，成功后才保存城市；
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
import { submitSupportTicket } from '../common/support-ticket-request.js'
import {createVisitSubscriptions} from '../common/subscription-core.js'
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
function avatar(plat, stubs) {
  const calls = { uploads: [], saves: [], toasts: [] }
  const experience = vue.reactive({ account: { id: 7 } })
  const deps = {
    experience, useScreen: () => vue.ref(2),
    chooseImage: async () => 'tmp://picked.jpg',
    uploadTo: async (url, p) => { calls.uploads.push([url, p]); return { data: { url: '/profile/upload/a.jpg' } } },
    apiSaveMeProfile: async payload => { calls.saves.push(plain(payload)); return { data: { ...experience.account, ...payload } } },
    apiAccount: async () => ({ data: { ...experience.account, ...calls.saves.at(-1) } }),
    acceptAuthenticatedAccount: account => { experience.account = account },
    toast: (t) => calls.toasts.push(t),
    ...stubs
  }
  const helpers = runModule(platform(read('common/upload-avatar.js'), plat), deps, 'upload-avatar.js')
  const m = runSetup('pages/profile/index.vue', plat, { ...deps, ...helpers.run('({ pickAvatarImage, uploadAvatar, avatarPickerError })') })
  return { ...m, calls, stop: () => { m.stop(); helpers.stop() } }
}

test('头像（微信）：资料页点击微信头像按钮，上传并保存原生组件选中的图片', async t => {
  assert.match(readSfc('pages/profile/index.vue').template.content, /<button[^>]*open-type="chooseAvatar"[^>]*@chooseavatar="chooseWechatAvatar"/)
  const h = avatar('MP-WEIXIN')
  t.after(h.stop)
  await h.run("chooseWechatAvatar({ detail: { avatarUrl: 'tmp://wechat.jpg' } })")
  assert.deepEqual(h.calls.uploads, [['/app/upload/image', 'tmp://wechat.jpg']])
  assert.deepEqual(h.calls.saves, [{ avatar: '/profile/upload/a.jpg' }])
  assert.equal(h.run('me.value.avatar'), '/profile/upload/a.jpg')
  assert.equal(h.run('experience.account.avatar'), '/profile/upload/a.jpg')
  assert.deepEqual(h.calls.toasts, ['头像已更新'])
})

test('微信头像无文件时可从相册选；两处按钮都有独立的相册入口，取消不提示或写入', async t => {
  for (const rel of ['pages/auth/login.vue','pages/profile/index.vue']) {
    const template = readSfc(rel).template.content
    assert.match(template, /open-type="chooseAvatar"[^>]*@error="onAvatarError"/)
    assert.match(template, /<button[^>]*@click="(?:chooseLocalAvatar|changeAvatar)"[^>]*>从相册选头像<\/button>/)
  }
  const h = avatar('MP-WEIXIN', { chooseDoc: async source => source === 'album' ? 'wxfile://picked.jpg' : null })
  t.after(h.stop)
  await h.run("chooseWechatAvatar({detail:{errMsg:'chooseAvatar:fail cancel'}})")
  assert.deepEqual(h.calls.toasts, [])
  await h.run("chooseWechatAvatar({detail:{errMsg:'chooseAvatar:fail'}})")
  assert.match(h.calls.toasts[0], /相册/)
  await h.run('changeAvatar()')
  assert.deepEqual(h.calls.uploads,[['/app/upload/image','wxfile://picked.jpg']])
  assert.equal(h.calls.saves.length,1)
})

test('微信无后缀临时头像按真实图片类型上传，成功、失败和换号都清理自己的副本', async () => {
  for (const action of ['save','upload-fails','switch-account']) {
    const copies=[], deleted=[], uploaded=[]
    const fs = {
      copyFile: o => { copies.push(o.destPath); o.success({}) },
      unlink: o => deleted.push(o.filePath)
    }
    const wx = {env:{USER_DATA_PATH:'wxfile://usr'},getFileSystemManager:()=>fs,
      getImageInfo:o=>o.success({type:'png'})}
    const h = runModule(platform(read('common/upload-avatar.js'),'MP-WEIXIN'), {
      wx, current:()=>action!=='switch-account',
      uploadTo:async (_url,path)=>{ uploaded.push(path); if(action==='upload-fails')throw Error('上传失败'); return {data:{url:'/profile/upload/p.png'}} }
    },'upload-avatar.js')
    const pending=h.run("uploadAvatar('wxfile://tmp_no_suffix', current)")
    if(action==='save')assert.equal((await pending).data.url,'/profile/upload/p.png')
    else await assert.rejects(pending)
    assert.match(copies[0], /^wxfile:\/\/usr\/avatar-.*\.png$/)
    assert.deepEqual(deleted,copies)
    assert.deepEqual(uploaded, action==='switch-account'?[]:copies)
  }
})

test('登录完善页可从微信相册选一个压缩图片，预览后点保存才更新资料', async () => {
  const calls = { uploads: [], saved: [], entered: 0 }
  const helpers = runModule(platform(read('common/upload-avatar.js'),'MP-WEIXIN'), {
    wx: { chooseMedia: options => {
      assert.equal(options.count, 1)
      assert.deepEqual(plain(options.sourceType), ['album'])
      assert.deepEqual(plain(options.mediaType), ['image'])
      options.success({tempFiles:[{tempFilePath:'wxfile://album.jpg'}]})
    }},
    uploadTo: async (url,path) => { calls.uploads.push([url,path]); return {data:{url:'/profile/upload/new.jpg'}} }
  }, 'upload-avatar.js')
  const src = readSfc('pages/auth/login.vue').scriptSetup.content
  const h = runModule(src.slice(src.indexOf('const profileNickname='),src.indexOf('// Explicit user login')), {
    submitting: vue.ref(false), pageActive: true, experience: { account:{id:7} }, s:vue.ref(5),
    apiSaveMeProfile: async p => calls.saved.push(plain(p)), refreshAccount: async () => {},
    completeEntry: () => { calls.entered++ }, ...helpers.run('({pickAvatarImage,avatarPickerError,uploadAvatar})')
  }, 'login-profile')
  await h.run("chooseProfileAvatar({detail:{errMsg:'chooseAvatar:fail'}})")
  assert.match(h.run('profileError.value'), /相册/)
  await h.run('chooseLocalAvatar()')
  assert.deepEqual(calls.uploads,[['/app/upload/image','wxfile://album.jpg']])
  assert.equal(h.run('profileAvatar.value'),'/profile/upload/new.jpg')
  assert.deepEqual(calls.saved,[])
  await h.run("saveProfileAndEnter({detail:{value:{nickname:'小李'}}})")
  assert.deepEqual(calls.saved,[{avatar:'/profile/upload/new.jpg',nickname:'小李'}])
  assert.equal(calls.entered,1)
})

test('头像（微信）：未选头像不上传，上传过程中切换账号不把原头像保存给新账号', async t => {
  const h = avatar('MP-WEIXIN')
  t.after(h.stop)
  await h.run('chooseWechatAvatar({ detail: {} })')
  assert.deepEqual(h.calls.uploads, [])
  const pending = h.run("chooseWechatAvatar({ detail: { avatarUrl: 'tmp://old.jpg' } })")
  h.run("experience.account = { id: 8 }")
  await pending
  assert.deepEqual(h.calls.uploads, [['/app/upload/image', 'tmp://old.jpg']])
  assert.deepEqual(h.calls.saves, [])
})

test('头像（网页版）：按图片中心截一个正方形（最大 640px）再上传；读不了图就传原图', async t => {
  const draws = []
  class FakeImage {
    set src(v) { this._src = v; setImmediate(() => (v === 'bad' ? this.onerror() : this.onload())) }
    get naturalWidth() { return 1200 }
    get naturalHeight() { return 800 }
  }
  const document = { createElement: () => ({ getContext: () => ({ drawImage: (...a) => draws.push(a.slice(1)) }), toDataURL: (t, q) => `data:${t};q=${q}` }) }
  const h = avatar('H5', { Image: FakeImage, document })
  t.after(h.stop)
  await h.run('changeAvatar()')
  assert.deepEqual(draws, [[200, 0, 800, 800, 0, 0, 640, 640]], '1200×800 取中间 800×800，缩到 640')
  assert.deepEqual(h.calls.uploads, [['/app/upload/image', 'data:image/jpeg;q=0.9']])
  const bad = avatar('H5', { Image: FakeImage, document, chooseImage: async () => 'bad' })
  t.after(bad.stop)
  await bad.run('changeAvatar()')
  assert.deepEqual(bad.calls.uploads, [['/app/upload/image', 'bad']])
})

// ---------------------------------------------------------------- 提交报名时的订阅授权（pages/jobs/apply.vue）
// 2026-10-18 报名页改成「用简历投递」：一屏（我的简历 + 到岗时间 + 预计时长），底部「确认投递」= submit()；没有上一步 / 下一步了。
// 订阅授权的口径不变：点「确认投递」的当下、任何 await 之前弹；简历不全（投不了）时不弹；没配模板 / 没开通 / 额度满不弹；弹框报错不挡报名
function apply(plat, { status, guest = false, resume } = {}) {
  const events = []
  let onLoadFn, onShowFn
  const h = runSetup('pages/jobs/apply.vue', plat, {
    ...applyFlow,
    onLoad: (f) => { onLoadFn = f }, onShow: (f) => { onShowFn = f },
    decodeQuery: (q) => q || {},
    todayCn: () => '2026-10-18', absUrl: (u) => u || '',
    loadApplicationDraft: () => ({}),
    experience: vue.reactive({ account: guest ? null : { id: 7, phone: '13800000000' } }),
    ensureSession: async () => { events.push('session') },
    apiJobDetail: async () => ({ data: { jobId: 5, title: '洱海边咖啡馆', jobType: 'volunteer', acceptsApplication: true, startDate: '2026-10-25', minDays: 30 } }),
    apiResume: async () => ({ data: resume || { resume: { name: '小林', age: 24, phone: '13800000000', city: '大理' }, tags: [{ name: '咖啡' }] } }),
    apiSubscribePrepare: async () => { events.push('prepare'); return { data: { ticket: 'ticket-1', expiresIn: 300, enabled: true, rows: [{ bizKey: 'apply_progress', templateId: 'TPL-1', quota: 0 }], ...status } } },
    apiSubscribeAccept: async (r) => { events.push('accept:' + JSON.stringify(r)); return { data: {} } },
    apiSubmitApplication: async (body) => { events.push('submit:' + JSON.stringify(body)); return { data: { appId: 31 } } },
    bindShareAfterApply: () => {}, saveApplicationDraft: () => {}, toast: () => {}, confirm: async () => false, modal: async () => ({ confirm: false }),
    uni: {
      requestSubscribeMessage: (o) => { events.push('subscribe:' + o.tmplIds.join()); o.success({ 'TPL-1': 'accept' }) },
      pageScrollTo: () => {}
    }
  })
  const subscriptions = createVisitSubscriptions({
    scope: () => String(h.sandbox.experience.account?.id || ''), surface: () => 'user',
    prepare: async () => (await h.sandbox.apiSubscribePrepare()).data,
    accept: async body => (await h.sandbox.apiSubscribeAccept(body)).data,
    request: options => h.sandbox.uni.requestSubscribeMessage(options),
    readCursor: () => '', writeCursor() {}, changed() {}
  })
  h.sandbox.visitSubscriptions = subscriptions
  h.sandbox.askOnVisit = () => plat === 'MP-WEIXIN' && subscriptions.ask()
  return { ...h, events, show: onShowFn, load: async (q) => { onLoadFn(q); for (let i = 0; i < 6; i++) await flush() } }
}
const submitted = (h) => h.events.some(e => e.startsWith('submit:'))

test('岗位初读失败后重试线上任务，恢复名片与任务说明，全程不读简历', async () => {
  const h = apply('H5')
  let offline = true, resumeReads = 0
  h.sandbox.experience.account.nickname = '小林'
  h.sandbox.apiJobDetail = async () => {
    if (offline) throw Error('网络暂时不可用')
    return {data:{jobId:5,title:'设计线上海报',jobType:'online',acceptsApplication:true}}
  }
  h.sandbox.apiResume = async () => { resumeReads++; return {data:{}} }
  h.sandbox.loadApplicationDraft = () => ({jobId:5,note:'能画插画'})
  await h.load({jobId:'5'})
  assert.equal(h.run('jobTitleError.value'),'网络暂时不可用')
  offline = false
  const handler = read('pages/jobs/apply.vue').match(/label="重新加载岗位" @click="(\w+)"/)[1]
  await h.run(handler + '()')
  assert.deepEqual(plain(h.run('[contactName.value,contactPhone.value,note.value,canSubmit.value]')),['小林','13800000000','能画插画',true])
  assert.equal(resumeReads,0)
})

test('其他天数填完直接投递，使用输入的天数；低于下限不能按原时长代投', async () => {
  const h = apply('MP-WEIXIN')
  await h.load({jobId:'5'})
  h.run("askDays(); otherDays.value='5'")
  h.events.length=0
  await h.run('submit()')
  assert.equal(submitted(h),false)
  assert.equal(h.events.some(e => e.startsWith('subscribe:')),false)
  h.run("otherDays.value='45'")
  await h.run('submit()')
  assert.equal(JSON.parse(h.events.find(e=>e.startsWith('submit:')).slice(7)).days,45)
})

test('跨过北京时间午夜后，过期的到岗日期不可投递', async () => {
  const h = apply('H5')
  let currentDay = '2026-10-25'
  h.sandbox.todayCn = () => currentDay
  await h.load({jobId:'5'})
  assert.equal(h.run('arrival.value'),'2026-10-25')
  currentDay = '2026-10-26'
  await h.run('submit()')
  assert.equal(submitted(h),false)
  assert.equal(h.run('minArrival.value'),'2026-10-26')
  h.run("onArrival('2026-10-27')")
  await h.run('submit()')
  assert.equal(JSON.parse(h.events.find(e=>e.startsWith('submit:')).slice(7)).arrival,'2026-10-27')
})

test('提交报名（微信）：点击当下、任何 await 之前就弹订阅授权；授权结果交给 apiSubscribeAccept；报名照常提交', async () => {
  const h = apply('MP-WEIXIN')
  await h.load({ jobId: '5' })
  assert.ok(h.events.includes('prepare'), '进页面登录了就先取好模板 ID 和票据')
  // 默认值：到岗 = 岗位开始日，时长 = 最短期限（30 天 =「一个月」）
  assert.equal(h.run('arrival.value'), '2026-10-25')
  assert.equal(h.run('days.value'), 30)
  assert.equal(h.run('card.value.ready'), true)
  h.events.length = 0
  const done = h.run('submit()')
  // submit() 同步跑到第一个 await 为止：订阅框必须已经弹了，且排在 ensureSession（isGuest 里的第一个 await）前面
  assert.deepEqual(h.events.slice(0, 2), ['subscribe:TPL-1', 'accept:{"ticket":"ticket-1","results":{"TPL-1":"accept"}}'])
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
    { enabled: true, rows: [{ bizKey: 'apply_progress', templateId: 'TPL-1', quota: 5 }] }, { ticket: '' }, { expiresIn: 0 }]) {
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
  assert.ok(!h.events.includes('prepare'))
  assert.ok(!h.events.some(e => e.startsWith('subscribe')))
  assert.ok(submitted(h))
})

test('游客打开报名页，登录返回后读取简历并可授权提醒、投递', async () => {
  const h = apply('MP-WEIXIN', { guest: true })
  await h.load({ jobId: '5' })
  assert.equal(h.run('resumeState.value'), 'guest')
  assert.ok(!h.events.includes('prepare'))
  h.run("experience.account = { id: 7, phone: '13800000000' }")
  h.show()
  await flush()
  assert.equal(h.run('canSubmit.value'), true)
  assert.ok(h.events.includes('prepare'))
  await h.run('submit()')
  assert.ok(h.events.includes('subscribe:TPL-1'))
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
function home(stubs = {}, plat = 'MP-WEIXIN') {
  const storage = {}, toasts = [], matches = [], saved = [], prompts = []
  const showHooks = []
  const experience = vue.reactive({ cities: [], allCities: false, ...(stubs.experience || {}) })
  const h = runSetup('pages/home/index.vue', plat, {
    onShow(f) { showHooks.push(f) }, showPublicShareMenu() {}, useScreen: () => vue.ref(2), experience,
    ensureSession: async () => {}, loadPreferences() {},
    confirm: async (title) => { prompts.push(title); return stubs.consent !== false },
    apiHomeFeed: async () => ({ data: { activities: [], stays: [] } }),
    apiHomeMatch: async (p) => { matches.push(plain(p)); return { data: { jobs: [{ jobId: 1 }], stays: [], activities: [], reasons: [], overall: 80 } } },
    savePreferences: (c) => { saved.push([...c]); experience.cities = [...c] },
    saveAllCities: (on) => { experience.allCities = !!on },
    toast: (t) => toasts.push(t), go: () => {}, errText: (e, f) => f, absUrl: (u) => u, checkNoticePopup: () => {},
    todayCn: () => '2026-10-16', shiftDate,
    uni: { getSetting: ({ success }) => success({ authSetting: { 'scope.userLocation': stubs.permission } }),
      getStorageSync: (k) => storage[k], setStorageSync: (k, v) => { storage[k] = v }, pageScrollTo: () => {} },
    R: { city: '/pages/home/city' },
    ...stubs, experience
  })
  return { ...h, show: () => Promise.all(showHooks.map(f => f())), storage, toasts, matches, saved, prompts, experience }
}

test('热门问法：选了城市时「X 换工」排第一；全部城市时不放；只用匹配规则认得的字眼', (t) => {
  const all = home()
  t.after(all.stop)
  assert.deepEqual(plain(all.run('hotWords.value')).map(w => w.text), ['大理 换工 一个月', '丽江 换工 包住', '会拍照 想找民宿换工', '住一周 预算500'])
  const qd = home({ experience: { cities: ['青岛'] } })
  t.after(qd.stop)
  assert.equal(plain(qd.run('hotWords.value'))[0].text, '青岛 换工')
  const tpl = readSfc('pages/home/index.vue').template.content
  const s2 = tpl.slice(tpl.indexOf('<template v-else-if="s === 2">'), tpl.indexOf('<template v-else-if="s === 3">'))
  assert.match(s2, /<view class="hot-words"><view v-for="w in hotWords" :key="w\.text" class="hot-word" hover-class="k-press" @click="useHotWord\(w\)"><text>\{\{ w\.text \}\}<\/text><\/view><\/view>/)
})

test('热门问法：点一下填进输入框直接匹配；带城市的按词里的城市（首页选的是青岛也按大理），写了天数的把旅行天数改成一致', async () => {
  const h = home({ experience: { cities: ['青岛'] } })
  await h.run("useHotWord(hotWords.value[1])"); await flush()
  assert.equal(h.run('idea.value'), '大理 换工 一个月')
  assert.equal(h.matches[0].city, '大理')
  assert.equal(h.matches[0].text, '大理 换工 一个月')
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

test('微信首页打开时先说明定位用途，成功后才记住城市；旧版留下的失败标记不妨碍已授权用户重试', async () => {
  let finish
  const h = home({ locateCity: () => new Promise(r => { finish = r }) })
  await h.show(); await flush()
  assert.equal(h.prompts.length, 1)
  assert.equal(h.storage['kangaroo:located-once'], undefined)
  finish({ found: true, name: '厦门', label: '思明区 · 厦门' }); await flush()
  assert.equal(h.storage['kangaroo:located-once'], 1)
  assert.deepEqual(h.saved, [['厦门']])
  assert.equal(h.experience.allCities, false)
  assert.deepEqual(h.toasts, ['已为你定位到厦门，可点城市切换'])
  const retry = home({ permission: true, locateCity: async () => ({ found: true, name: '青岛' }) })
  retry.storage['kangaroo:located-once'] = 1
  await retry.show(); await flush()
  assert.deepEqual(retry.prompts, [])
  assert.deepEqual(retry.saved, [['青岛']])
})

test('已有城市、选全部、拒绝授权或网页版首页均不请求 GPS；定位失败可手选，返回的定位不会覆盖手选城市', async () => {
  for (const [opts, plat] of [[{ experience: { cities: ['大理'] } }], [{ experience: { allCities: true } }], [{ permission: false }], [{ consent: false }], [{}, 'H5']]) {
    let asked = 0
    const h = home({ ...opts, locateCity: async () => { asked++; return null } }, plat)
    await h.show(); await flush()
    assert.equal(asked, 0)
    assert.equal(h.prompts.length, opts.consent === false ? 1 : 0)
    assert.equal(h.storage['kangaroo:located-once'], undefined)
  }
  const failed = home({ locateCity: async ({ onFailure }) => { onFailure('请手动选择城市'); return null } })
  await failed.show(); await flush()
  assert.deepEqual(failed.saved, [])
  assert.deepEqual(failed.toasts, ['请手动选择城市'])
  assert.equal(failed.storage['kangaroo:located-once'], undefined)
  let finish
  const race = home({ locateCity: () => new Promise((r) => { finish = r }) })
  await race.show(); await flush()
  race.experience.cities = ['丽江']
  finish({ found: true, name: '厦门' }); await flush()
  assert.deepEqual(race.saved, [])
})

test('切换城市屏与首页共用定位服务，微信使用 gcj02 坐标，网页使用 wgs84 坐标', async () => {
  const city = readSfc('pages/home/city.vue').scriptSetup.content
  assert.match(city, /import \{ locateCity \} from '@\/common\/locate\.js'/)
  for (const [plat, expected] of [['MP-WEIXIN', 'gcj02'], ['H5', 'wgs84']]) {
    let coords, request
    const located = { found: true, name: '厦门' }
    const module = runModule(platform(read('common/locate.js'), plat), {
      setTimeout, clearTimeout, confirmedLocation: r => r === located,
      uni: { getLocation: opts => { request = opts; opts.success({ latitude: 24.5, longitude: 118.1, accuracy: 12 }) } },
      apiLocateCity: async (...args) => { coords = args; return { data: located } }
    }, 'locate:' + plat)
    assert.equal(await module.run('locateCity()'), located)
    assert.equal(request.type, expected)
    assert.deepEqual(coords, [24.5, 118.1, 12, expected])
  }
})

// ---------------------------------------------------------------- 聊天式客服（问答逻辑在 common/support-chat.js，整页 pages/notice/support.vue 和底部弹层 components/k-ai-sheet 共用）
const CHAT_NAMES = 'ctx, orderNo, chips, msgs, input, asking, order, contactFrom, orderTitle, orderDates, start, ask, send, openFaq, openLink, toHuman'
function support(plat, stubs = {}) {
  const asks = [], tickets = [], gone = []
  const src = platform(read('common/support-chat.js'), plat) + `\nvar { ${CHAT_NAMES} } = useSupportChat({ open: (u) => __gone.push(u), scroll: () => {} })`
  const h = runModule(src, {
    __gone: gone,
    submitSupportTicket,
    ensureSession: async () => {},
    experience: vue.reactive({ account: { id: 7 }, mode: 'user', cities: ['大理'], allCities: false }),
    apiSupportQuick: async (c) => ({ data: c === 'order' ? ['取消要扣多少？'] : ['报名进度', '查看客服回复', '退款规则'] }),
    apiSupportFaqs: async () => ({ data: [{ faqId: 1, question: '责任书在哪里签署？', answer: '在审核进度页签署。' }] }),
    apiSupportContact: async () => ({ data: { available: false } }),
    apiSupportAsk: async (p) => { asks.push(plain(p)); return { data: stubs.answer || { text: '你有 1 个进行中的报名', cards: [{ type: 'application', title: '咖啡馆 · 大理', status: '报名审核中', url: '/pages/jobs/progress?appId=1', image: '/profile/a.jpg' }], links: [{ label: 'a', url: '/a' }, { label: 'b', url: '/b' }, { label: 'c', url: '/c' }, { label: 'd', url: '/d' }], source: '袋鼠小院报名系统' } } },
    apiSupportTicket: async (p) => { tickets.push(plain(p)); return { data: { ticketId: 12, message: '已提交人工客服' } } },
    apiStayOrder: async () => ({ data: { payFen: 20000, checkIn: '2026-10-20', nights: 2, statusLabel: '待入住', stay: { stayName: '平潭小院', typeName: '海景房' } } }),
    confirm: async () => true, prompt: async () => '请人工查看报名', errText: (e, f) => (e && e.message) || f, yuan: (f) => String(f / 100), absUrl: (u) => 'https://img.test' + u,
    toast: () => {},
    uni: { pageScrollTo: () => {}, makePhoneCall: () => {} },
    R: { assistant: '/pages/home/assistant', stayOrder: '/pages/stays/order' },
    ...stubs
  }, 'common/support-chat.js:' + plat)
  h.sandbox.__q = null
  return { ...h, asks, tickets, gone, load: async (q) => { h.sandbox.__q = q; await h.run('start(__q.ctx, __q.orderNo)'); await flush(); await flush() } }
}

test('客服弹层首次打开、切换账号或订单时重新开场，同一情境再次打开保留对话', async t => {
  const page = readSfc('pages/notice/support.vue').scriptSetup.content
  assert.match(page, /useSupportChat\(\{ open: go, scroll: scrollDown \}\)/)
  assert.match(page, /onLoad\(\(q0\) => \{\n\s+const q = decodeQuery\(q0\) \|\| \{\}\n\s+start\(q\.ctx, q\.orderNo\)/)
  const sheet = readSfc('components/k-ai-sheet/k-ai-sheet.vue').scriptSetup.content
  assert.match(sheet, /useSupportChat\(\{ open, scroll: scrollDown \}\)/)
  assert.match(sheet, /const open = \(url\) => \{ emit\('close', 'nav'\); go\(url\) \}/, '点回答里的按钮先收起弹层再跳')
  const props = vue.reactive({ show: false, ctx: 'order', orderNo: 'SO1' })
  const experience = vue.reactive({ account: { id: 7 }, mode: 'user' })
  const entries = []
  const ui = runSetup('components/k-ai-sheet/k-ai-sheet.vue', 'MP-WEIXIN', {
    defineOptions() {}, defineProps: () => props, defineEmits: () => () => {},
    useSupportChat: () => ({ start: (ctx, orderNo) => entries.push([ctx, orderNo, experience.account.id]) }),
    experience, useUserIcons: () => vue.ref(true), setTimeout: () => 1, clearTimeout() {}, onUnmounted() {}
  })
  t.after(ui.stop)
  props.show = true
  await vue.nextTick()
  props.show = false
  await vue.nextTick()
  props.show = true
  await vue.nextTick()
  props.orderNo = 'SO2'
  await vue.nextTick()
  experience.account = { id: 8 }
  await vue.nextTick()
  assert.deepEqual(entries, [['order', 'SO1', 7], ['order', 'SO2', 7], ['order', 'SO2', 8]])
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

test('转人工回执丢失可点原消息重试，保留新输入并打开同一张工单', async () => {
  const requests = []
  const h = support('MP-WEIXIN', {
    apiSupportTicket: async body => {
      requests.push(plain(body))
      if (requests.length === 1) throw new Error('网络中断')
      return { data: { ticketId: '81', message: '已收到' } }
    }
  })
  await h.load({ ctx: 'order', orderNo: 'ST123' })
  await h.run('toHuman()')
  const retry = h.run('msgs.value.at(-1).links[0]')
  assert.equal(retry.label, '重新提交工单')
  h.sandbox.retry = retry
  h.run("input.value = '编辑中的新问题'")
  await h.run('openLink(retry)')
  assert.match(requests[0].requestId, /^[a-z0-9_-]{16,64}$/)
  assert.equal(requests[1].requestId, requests[0].requestId)
  assert.equal(requests[1].question, requests[0].question)
  assert.equal(h.run('input.value'), '编辑中的新问题')
  assert.equal(h.run('msgs.value.at(-1).links[0].url'), '/pages/home/assistant?ticket=81')
  assert.equal(h.run("msgs.value.flatMap(m => m.links).filter(l => l.retryQuestion).length"), 0)
  h.run("experience.account = { id: 99 }")
  await h.run('openLink(retry)')
  assert.equal(requests.length, 2)
})

test('客服页「转人工」可在两端提交工单，微信客服会话另有入口', async () => {
  const tpl = readSfc('pages/notice/support.vue').template.content
  assert.match(tpl, /<button v-if="[^"]+\.humanContact" class="sp-human" open-type="contact" :session-from="contactFrom">/)
  assert.match(tpl, /<view class="sp-human" aria-role="button" hover-class="k-press" @click="toHuman">/)
  const mp = support('MP-WEIXIN')
  await mp.load({ ctx: 'profile' })
  assert.equal(mp.run('contactFrom.value'), '7|support-profile')
  await mp.run("ask('转人工')"); await flush()
  assert.equal(mp.tickets[0].question, '请人工查看报名')
  assert.equal(mp.asks.length, 0)
  assert.equal(mp.tickets.length, 1)
  const h5 = support('H5')
  await h5.load({ ctx: 'profile' })
  await h5.run('toHuman()'); await flush()
  assert.equal(h5.tickets[0].question, '请人工查看报名')
  await h5.run("ask('押金什么时候退')"); await flush()
  await h5.run('toHuman()'); await flush()
  assert.equal(h5.tickets[1].question, '押金什么时候退')
  assert.equal(h5.tickets[0].context, 'profile')
  const bot = plain(h5.run('msgs.value')).at(-1)
  assert.deepEqual(bot.links, [{ label: '查看工单', url: '/pages/home/assistant?ticket=12' }])
})

test('点击转人工时锁定当前账号、身份及问题；登录态检查期间更换账号不会把旧草稿提交给新账号', async () => {
  const confirmations = []
  const h = support('H5', { confirm: async (title, message) => { confirmations.push(message); return true } })
  await h.load({ ctx: 'order', orderNo: 'SO1' })
  let resume
  let gate = new Promise(resolve => { resume = resolve })
  h.sandbox.ensureSession = () => gate
  h.run("input.value = '账号 A 的订单资料'")
  const stale = h.run('toHuman()')
  h.run("experience.account = { id: 8 }")
  resume()
  await stale
  await flush()
  assert.deepEqual(h.tickets, [])
  assert.deepEqual(confirmations, [])
  assert.equal(h.run('input.value'), '')
  assert.equal(h.run('orderNo.value'), '')
  h.run("input.value = '检查之前的问题'")
  gate = new Promise(resolve => { resume = resolve })
  const first = h.run('toHuman()'), second = h.run('toHuman()')
  h.run("input.value = '刚写的新问题'")
  resume()
  await Promise.all([first, second])
  assert.equal(h.tickets.length, 1)
  assert.equal(h.tickets[0].question, '检查之前的问题')
  assert.equal(h.run('input.value'), '刚写的新问题')
  gate = new Promise(resolve => { resume = resolve })
  const wrongMode = h.run('toHuman()')
  h.run("experience.mode = 'staff'")
  resume()
  await wrongMode
  assert.equal(h.tickets.length, 1)
})

test('首次描述问题后取消提交，原文留在输入框里可修改，重提只发修改后的问题', async () => {
  let accepted = false
  const h = support('MP-WEIXIN', { prompt: async () => '想调整订单时间', confirm: async () => accepted })
  await h.load({ ctx: 'order', orderNo: 'SO1' })
  await h.run('toHuman()')
  assert.equal(h.tickets.length, 0)
  assert.equal(h.run('input.value'), '想调整订单时间')
  h.run("input.value = '想把订单改到周六'")
  accepted = true
  await h.run('toHuman()')
  assert.equal(h.tickets[0].question, '想把订单改到周六')
  assert.equal(h.run('input.value'), '')
})

test('转人工确认期间切换订单或账号不会提交上一段对话', async () => {
  let approve
  const h = support('MP-WEIXIN', { confirm: () => new Promise(resolve => { approve = resolve }) })
  await h.load({ ctx: 'order', orderNo: 'SO1' })
  h.run("input.value = '咨询这笔订单'")
  const first = h.run('toHuman()')
  await flush()
  await h.load({ ctx: 'order', orderNo: 'SO2' })
  approve(true)
  await first
  assert.equal(h.tickets.length, 0)
  h.run("input.value = '另一笔咨询'")
  const second = h.run('toHuman()')
  await flush()
  h.run('experience.account = { id: 8 }')
  approve(true)
  await second
  assert.equal(h.tickets.length, 0)
})
test('底部弹层的「转人工」：小程序是微信客服会话按钮（来源记 support-情境，城市页是 support-city），网页版提交工单', async () => {
  const tpl = readSfc('components/k-ai-sheet/k-ai-sheet.vue').template.content
  assert.match(tpl, /<button v-if="[^"]+\.humanContact" class="k-ai__human" open-type="contact" :session-from="contactFrom">/)
  assert.match(tpl, /<view class="k-ai__human" aria-role="button" hover-class="k-press" @click="toHuman">/)
  const mp = support('MP-WEIXIN')
  await mp.load({ ctx: 'city' })
  assert.equal(mp.run('contactFrom.value'), '7|support-city')
  assert.deepEqual(plain(mp.run('chips.value')), ['报名进度', '查看客服回复', '退款规则'])
  await mp.load({ ctx: 'nope' })
  assert.equal(mp.run('ctx.value'), 'profile', '不认识的情境按「我的」')
})

test('「我的 → AI袋鼠」在本页底部弹出；城市页的旧客服屏下线；订单页的旧入口 assistant.vue 照旧转到整页客服（带 ctx 和订单号）', () => {
  assert.match(read('pages/profile/index.vue'), /label: 'AI袋鼠', action: openAi \}/)
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
  assert.match(profile, /label: '收藏与关注', url: R\.myFollows \+ '\?mode=fav'/)
  assert.match(read('common/api.js'), /export const apiActivityFavorites = \(\) => get\('\/app\/activities\/favorites'\)/)
  const gone = [], communityEnabled = vue.ref(true), stayBookingEnabled = vue.ref(true)
  let load
  const m = runSetup('pages/profile/follows.vue', 'MP-WEIXIN', {
    onLoad: f => { load = f }, onShow() {}, onPullDownRefresh() {}, onUnmounted() {},
    experience: vue.reactive({ account: { id: 7 } }), ensureSession: async () => {}, getSessionRevision: () => 0,
    communityEnabled, stayBookingEnabled, privateChatEnabled: vue.ref(true),
    apiActivityFavorites: async () => ({ data: [{ activityId: 9, title: '摄影徒步' }] }),
    go: u => gone.push(u), R: { activity: '/a', jobDetail: '/j', stayShop: '/shop' }, toast() {}
  })
  await load({ mode: 'fav', fav: 'activity' })
  assert.equal(m.run('mode.value'), 'fav')
  assert.deepEqual(plain(m.run('FAV_TABS.value.map(t => t.label)')), ['岗位', '房源', '服务', '帖子', '活动'])
  assert.equal(m.run('favRows.value[0].title'), '摄影徒步')
  await m.run('openFav(favRows.value[0])')
  await m.run("openFav({ kind: 'job', id: 3 })")
  await m.run("openFav({ kind: 'service', id: 5, off: true })")
  assert.deepEqual(gone, ['/a?id=9', '/j?jobId=3'], '下架的服务不跳')
  communityEnabled.value = false
  stayBookingEnabled.value = false
  assert.deepEqual(plain(m.run('FAV_TABS.value.map(t => t.label)')), ['岗位', '服务', '活动'])
  m.stop()
})
