// Execute the real page scripts with Vue reactivity and controlled message responses.
import fs from 'node:fs'
import vm from 'node:vm'
import test from 'node:test'
import assert from 'node:assert/strict'
import { parse, babelParse } from '@vue/compiler-sfc'
import * as vue from 'vue'

const settle = () => new Promise(resolve => setImmediate(resolve))
const message = (id, mode = 'staff', bizType = 'stay_order') => ({ id, recipientId: 7, mode, category: 'order', bizType, title: id, content: id, read: false })
function page(file, overrides = {}) {
  const code = parse(fs.readFileSync(new URL('../' + file, import.meta.url), 'utf8')).descriptor.scriptSetup.content
  const nodes = babelParse(code, { sourceType: 'module' }).program.body
  const experience = vue.reactive({ account: { id: 7 }, mode: 'staff', staffStoreId: 17, role: 'keeper', revision: 0 })
  const hooks = {}, pending = [], writes = [], timers = new Map()
  let timer = 0
  const context = {}
  for (const node of nodes.filter(n => n.type === 'ImportDeclaration')) {
    for (const spec of node.specifiers) context[spec.local.name] = () => {}
  }
  Object.assign(context, vue, {
    experience, Date, Promise, Set, R: {}, uni: {stopPullDownRefresh() {}},
    getMessageScopeKey: () => [experience.account?.id, experience.mode, experience.staffStoreId, experience.role, experience.revision].join('|'),
    ensureSession: async () => {}, hasStaffAccess: vue.ref(true), currentStaffStore: vue.computed(() => ({ storeId: experience.staffStoreId, roleCode: experience.role })),
    useScreen: (max, options) => { hooks.screenLoad = options?.onLoad; return vue.ref(2) },
    onPullDownRefresh: fn => hooks.refresh = fn, errText: (e, fallback) => e?.message || fallback,
    messageWording: m => m, absUrl: x => x, readSeenNotices: () => ({}),
    setTimeout: (fn, delay) => { timers.set(++timer, { fn, delay }); return timer }, clearTimeout: id => timers.delete(id),
    apiMessages: (mode, category, options) => new Promise((resolve, reject) => pending.push({ mode, category, options, resolve, reject })),
    apiMarkRead: async id => { writes.push(id); return { data: { updated: 1 } } }, apiNotices: async () => ({ data: [] }),
    onLoad: fn => hooks.load = fn, onShow: fn => (hooks.show ||= []).push(fn), onHide: fn => hooks.hide = fn,
    onUnload: fn => hooks.unload = fn, onUnmounted: fn => hooks.unmount = fn, onReachBottom: fn => hooks.bottom = fn,
    ...overrides
  })
  vm.createContext(context)
  vm.runInContext(nodes.filter(n => n.type !== 'ImportDeclaration').map(n => code.slice(n.start, n.end)).join('\n'), context)
  return {
    experience, hooks, pending, writes,
    run: js => vm.runInContext(js, context),
    ids: name => [...vm.runInContext(name + '.value', context)].map(m => m.id),
    switchRole: role => { experience.role = role; experience.revision++ }
  }
}

function messageApi(get) {
  const code = fs.readFileSync(new URL('../common/api.js', import.meta.url), 'utf8')
    .replace(/^import .*$/gm, '').replace(/^export /gm, '')
  return vm.runInNewContext(code + '\n;({apiMessages, apiSubscriptionMessage})', { get })
}

const oldExpiry = {
  id: 897, title: '换工合约即将到期', mode: 'staff', category: 'system',
  route: '/pages/staff/volunteers?storeId=17', bizType: 'volunteer_expiry', bizId: 42
}

test('平台通知点查看详情，老合约提醒在收件门店定位到实际报名；门店编号不会被拿来拼报名详情', async () => {
  const routes = [], modals = []
  const code = fs.readFileSync(new URL('../common/message-preview.js', import.meta.url), 'utf8')
    .replace(/^import .*$/gm, '').replace('export function', 'function')
  const showMessagePreview = vm.runInNewContext(code + '\n;showMessagePreview', {
    go: route => routes.push(route), uni: { showModal: modal => modals.push(modal) }
  })
  const api = messageApi(async () => ({ rows: [oldExpiry], hasMore: false }))
  const h = page('pages/notice/inbox.vue', { ...api, showMessagePreview })
  await h.run('type.value="system"; load(false)')
  h.run('open(rows.value[0])')
  assert.deepEqual(h.writes, [897])
  assert.deepEqual(routes, [])
  assert.equal(modals[0].confirmText, '查看详情')
  modals[0].success({ confirm: true })
  assert.deepEqual(routes, ['/pages/staff/volunteers?storeId=17&tab=leaving&focusAppId=42'])
  h.hooks.hide()
})

test('微信旧提醒没有报名号时只看一周内离开；新版及旧版已有确切报名链接时直接打开报名', async () => {
  const routes = []
  const detail = '/pages/staff/applications?appId=42&storeId=83'
  const cases = [
    [{ id: 897, title: oldExpiry.title, mode: 'staff', route: oldExpiry.route }, '/pages/staff/volunteers?storeId=17&tab=leaving'],
    [oldExpiry, '/pages/staff/volunteers?storeId=17&tab=leaving&focusAppId=42'],
    [{ ...oldExpiry, route: detail }, detail],
    [{ ...oldExpiry, route: detail, bizType: undefined, bizId: undefined }, detail]
  ]
  for (const [record, expected] of cases) {
    const api = messageApi(async (url, params) => {
      assert.equal(url, '/app/message/subscription/897')
      assert.equal(params.mode, 'staff')
      return { data: record }
    })
    const h = page('pages/profile/subscription-message.vue', { ...api, go: route => routes.push(route) })
    h.hooks.load({ id: '897', mode: 'staff' })
    await h.hooks.show[0]()
    await h.run('open()')
    assert.equal(routes.at(-1), expected)
    h.hooks.hide()
  }
  assert.equal(routes.length, cases.length)
})

test('用户身份、其他业务类型、近似标题及带有相同标题的其他落点保持原链接', async () => {
  const otherRows = [
    { ...oldExpiry, bizType: 'daily_report' },
    { ...oldExpiry, mode: 'user' },
    { ...oldExpiry, bizType: null, title: '有关换工合约即将到期的公告' },
    { ...oldExpiry, bizType: null, route: '/pages/staff/operations?storeId=17' }
  ]
  const api = messageApi(async () => ({ rows: otherRows, hasMore: true, unread: 4 }))
  const result = await api.apiMessages('staff')
  assert.deepEqual([...result.rows], otherRows)
  assert.equal(result.hasMore, true)
  assert.equal(result.unread, 4)
  const personal = await messageApi(async () => ({ rows: [oldExpiry] })).apiMessages('user')
  assert.equal(personal.rows[0].route, oldExpiry.route)
})

test('收到的评论一次点击直达帖子，保留已读和管理行为', async () => {
  const routes = [], previews = [], tips = []
  const h = page('pages/notice/inbox.vue', {
    go: route => routes.push(route), showMessagePreview: m => previews.push(m), toast: tip => tips.push(tip)
  })
  const route = '/pages/community/index?postId=17&view=comments'
  h.run("type.value = 'comment'")
  h.run(`open({ id: 7, route: '${route}' })`)
  await settle()
  assert.deepEqual(routes, [route])
  assert.deepEqual(h.writes, [7])
  h.run("open({id: 8, read: true, route: ''})")
  h.run("managing.value = true; open({id: 9, route: '/pages/community/index?postId=18'})")
  assert.equal(tips.length, 1)
  assert.deepEqual(routes, [route])
  assert.deepEqual(previews, [])
})

test('消息首页切换账号后，旧账号的全部已读回执不能清新账号的分类或公告角标', async () => {
  let finishRead
  const cleared = [], tips = []
  const h = page('pages/messages/index.vue', {
    markAllMessagesRead: () => new Promise(resolve => { finishRead = resolve }),
    clearNoticeBadge: list => { cleared.push(...list); return {} },
    visibleMessages: vue.ref([]), loadMessages: async () => [],
    apiMessageSummary: async () => ({categories:[{category:'chat', unread:3, total:3}]}),
    toast: text => tips.push(text)
  })
  await h.hooks.show[0]()
  const pending = h.run('readAll()')
  h.experience.account = {id:8}
  await settle()
  h.run('notices.value=[{noticeId:28, version:1}]')
  finishRead()
  await pending
  assert.equal(h.run('categoryCounts.value[0].unread'), 3)
  assert.deepEqual(cleared, [])
  assert.deepEqual(tips, [])
})

test('消息首页换号后，旧账号较晚返回的公告不能覆盖新账号的公告未读状态', async () => {
  const requests = []
  const h = page('pages/messages/index.vue', {
    apiNotices: () => new Promise(resolve => requests.push(resolve)),
    visibleMessages: vue.ref([]), loadMessages: async () => [],
    apiMessageSummary: async () => ({categories:[]})
  })
  await h.hooks.show[0]()
  h.experience.account = {id:8}
  await settle()
  requests[1]({data:[{noticeId:2,read:false}]})
  await settle()
  requests[0]({data:[{noticeId:1,read:true}]})
  await settle()
  assert.equal(h.run('notices.value[0].noticeId'), 2)
  assert.equal(h.run('notices.value[0].read'), false)
})

test('订单子页切换为换工主理人即清空旧订单，旧分页响应不能回灌', async () => {
  const h = page('pages/notice/inbox.vue')
  const first = h.run('type.value="order"; load(false)')
  h.pending[0].resolve({ rows: [message('keeper-stay')], hasMore: true }); await first
  assert.deepEqual(h.ids('rows'), ['keeper-stay'])
  const oldPage = h.run('load(true)'); await settle()
  h.switchRole('manager'); await settle()
  assert.deepEqual(h.ids('rows'), []); assert.equal(h.run('ready.value'), false)
  assert.equal(h.pending[2].options.page, 1)
  h.pending[2].resolve({ rows: [message('activity-order', 'staff', 'activity')], hasMore: false }); await settle()
  h.pending[1].resolve({ rows: [message('late-stay')], hasMore: true }); await oldPage
  assert.deepEqual(h.ids('rows'), ['activity-order']); assert.equal(h.run('hasMore.value'), false)
  assert.deepEqual(h.writes, []); h.hooks.hide()
})

test('订单子页切回个人身份可正常显示本人旅居订单', async () => {
  const h = page('pages/notice/inbox.vue')
  h.switchRole('manager'); await settle()
  h.pending[0].resolve({ rows: [], hasMore: false }); await settle()
  h.run('type.value="order"'); h.experience.mode = 'user'; await settle()
  assert.equal(h.pending[1].mode, 'user')
  h.pending[1].resolve({ rows: [message('personal-stay', 'user')], hasMore: false }); await settle()
  assert.deepEqual(h.ids('rows'), ['personal-stay']); assert.equal(h.run('ready.value'), true)
  h.hooks.hide()
})

test('提醒中心授权变更后重取员工提醒，旧角色响应不会覆盖新角色数据', async () => {
  const h = page('pages/messages/reminders.vue')
  const old = h.run('fetchReminders()'); await settle()
  h.pending[0].resolve({ rows: [message('personal-stay', 'user')] }); await settle()
  assert.equal(h.pending[1].mode, 'staff')
  h.run('staffReminders.value=[{id:"cached-keeper-stay"}]')
  h.switchRole('manager'); await settle()
  assert.deepEqual(h.ids('staffReminders'), [])
  h.pending[2].resolve({ rows: [message('personal-stay', 'user')] }); await settle()
  h.pending[3].resolve({ rows: [message('activity-order', 'staff', 'activity')] }); await settle()
  h.pending[1].resolve({ rows: [message('late-keeper-stay')] }); await old
  assert.deepEqual(h.ids('userReminders'), ['personal-stay'])
  assert.deepEqual(h.ids('staffReminders'), ['activity-order'])
  assert.equal(h.run('staffPending.value'), 1); assert.deepEqual(h.writes, []); h.hooks.hide()
})

test('隐藏的订单子页切换门店后清空缓存，不在后台发请求或接受旧响应', async () => {
  const h = page('pages/notice/inbox.vue')
  const pending = h.run('type.value="order"; load(false)')
  h.run('rows.value=[{id:"cached"}]'); h.hooks.hide()
  h.experience.staffStoreId = 18; await settle()
  assert.deepEqual(h.ids('rows'), []); assert.equal(h.pending.length, 1)
  h.pending[0].resolve({ rows: [message('late')], hasMore: false }); await pending
  assert.deepEqual(h.ids('rows'), [])
})

test('读完公告返回平台通知时红点消失，公告更新到新版后重新标记', async () => {
  let seen = {}, version = 1
  const h = page('pages/notice/inbox.vue',{
    readSeenNotices:()=>seen,
    apiNotices:async()=>({data:[{noticeId:81,version}]}),
    apiMessages:async()=>({rows:[]})
  })
  await h.hooks.load({type:'system'}); h.hooks.show[0](); await settle()
  assert.equal(h.run('notices.value[0].fresh'),true)
  h.hooks.hide(); seen={'81':1}; h.hooks.show[0](); await settle()
  assert.equal(h.run('notices.value[0].fresh'),false)
  h.hooks.hide(); version=2; h.hooks.show[0](); await settle()
  assert.equal(h.run('notices.value[0].fresh'),true)
})

test('切换账号后，旧公告请求不能覆盖新账号的已读状态', async () => {
  const replies = []
  const h=page('pages/notice/inbox.vue',{
    apiNotices:()=>new Promise(resolve=>replies.push(resolve)),
    apiMessages:async()=>({rows:[]})
  })
  await h.hooks.load({type:'system'}); h.hooks.show[0](); await settle()
  h.experience.account={id:8}; await settle()
  assert.ok(replies.length >= 2)
  replies.at(-1)({data:[{noticeId:81,read:true}]})
  for (const reply of replies.slice(0,-1)) reply({data:[{noticeId:81,read:false}]})
  await settle()
  assert.equal(h.run('notices.value[0].fresh'),false)
})

test('微信提醒连点只打开一次，离页期间完成的已读请求不再跳转', async () => {
  const marks=[],routes=[]
  const h=page('pages/profile/subscription-message.vue',{
    apiSubscriptionMessage:async()=>({data:{id:11,route:'/pages/jobs/progress?appId=81'}}),
    apiMarkRead:()=>new Promise(resolve=>marks.push(resolve)),go:route=>routes.push(route)
  })
  h.hooks.load({id:11,mode:'staff'}); await h.hooks.show[0]()
  const first=h.run('open()'), second=h.run('open()')
  assert.equal(marks.length,1)
  h.hooks.hide?.(); marks[0](); await Promise.all([first,second])
  assert.deepEqual(routes,[])
  await h.hooks.show[0]()
  const retry=h.run('open()'); marks[1](); await retry
  assert.deepEqual(routes,['/pages/jobs/progress?appId=81'])
})

test('微信提醒读取期间换店，旧门店的回复不会显示，重试能读取新门店', async () => {
  const replies=[]
  const h=page('pages/profile/subscription-message.vue',{
    apiSubscriptionMessage:()=>new Promise(resolve=>replies.push(resolve))
  })
  h.hooks.load({id:11,mode:'staff'}); const first=h.hooks.show[0](); await settle()
  h.experience.staffStoreId=18; await settle()
  replies[0]({data:{id:11,title:'原门店'}}); await first
  assert.equal(h.run('message.value'),null)
  const retry=h.run('load()'); await settle(); replies[1]({data:{id:11,title:'当前门店'}}); await retry
  assert.equal(h.run('message.value.title'),'当前门店')
})

test('从须知链接打开公告，首次断网后下拉仍重试同一固定标识', async () => {
  const targets = []
  const h = page('pages/notice/index.vue', { apiNoticeDetail: async target => {
    targets.push(target)
    if (targets.length === 1) throw Error('暂时断网')
    return { data: { noticeId: 12, title: '任务须知', version: 1 } }
  } })
  h.hooks.screenLoad({key:'online-guide'}); await settle()
  assert.equal(h.run('detailError.value'),'暂时断网')
  h.hooks.refresh(); await settle()
  assert.deepEqual(targets,['online-guide','online-guide'])
  assert.equal(h.run('detail.value.title'),'任务须知')
})

test('公告详情未到就返回列表，不给没看到的公告记已读', async () => {
  const marked = []
  let complete
  const h = page('pages/notice/index.vue', {
    apiNoticeDetail: () => new Promise(resolve=>{ complete=resolve }),
    markNoticeSeen: notice => marked.push(notice.noticeId)
  })
  h.hooks.screenLoad({}); await settle()
  h.run('openItem({noticeId:12})'); await settle()
  h.run('backFromDetail()')
  complete({data:{noticeId:12,version:1}}); await settle()
  assert.deepEqual(marked,[])
})

test('刷新同一条公告期间保留回复组件，慢请求也不会把它当成已下线', async () => {
  let complete, calls = 0
  const h = page('pages/notice/index.vue', { apiNoticeDetail: async () => {
    if (++calls === 1) return {data:{noticeId:12,version:1}}
    return new Promise(resolve=>{complete=resolve})
  } })
  h.hooks.screenLoad({key:'online-guide'}); await settle()
  const original = h.run('replyNoticeId.value')
  h.hooks.refresh()
  assert.equal(h.run('replyNoticeId.value'),original)
  await settle()
  assert.equal(h.run('replyNoticeId.value'),original)
  complete({data:{noticeId:12,version:2}}); await settle()
  assert.equal(h.run('replyNoticeId.value'),original)
})

test('公告已下线时仍可进入原对话，网络故障不能把公告判为下线', async () => {
  let code = 503
  const h=page('pages/notice/index.vue',{apiNoticeDetail:async()=>{throw Object.assign(Error('读取失败'),{code})}})
  h.hooks.screenLoad({id:12}); await settle()
  assert.equal(h.run('detailUnavailable.value'),false)
  code=404; h.hooks.refresh(); await settle()
  assert.equal(h.run('detailUnavailable.value'),true)
  assert.equal(h.run('replyNoticeId.value'),'12')
})

test('离开期间新增超过一页管理员回复，返回后仍可翻到所有中间记录', async () => {
  let count = 3
  const h = page('pages/notice/components/notice-replies.vue', {
    defineProps: () => vue.reactive({noticeId:12, active:true, noticeAvailable:true}),
    setInterval: () => 0, clearInterval: () => {}, apiNoticeRepliesRead: async () => {},
    apiNoticeReplies: async (id,before) => {
      const total = before ? Number(before) - 1 : count
      const lastPage = Array.from({length:Math.min(50,total)},(_,i)=>({replyId:total-Math.min(50,total)+1+i}))
      return {data:{rows:lastPage,hasMore:total>50}}
    }
  })
  await settle()
  assert.equal(h.run('messages.value.length'),3)
  h.run('props.active=false'); await settle()
  count=105
  h.run('props.active=true'); await settle()
  assert.equal(h.run('hasMore.value'),true)
  await h.run('load(true)'); await h.run('load(true)')
  assert.deepEqual([...h.run('messages.value.map(m=>m.replyId)')], Array.from({length:105},(_,i)=>i+1))
  assert.equal(h.run('hasMore.value'),false)
  await h.run('load(false)')
  assert.equal(h.run('messages.value.length'),105)
  assert.equal(h.run('hasMore.value'),false)
})
