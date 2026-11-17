import fs from 'node:fs'
import vm from 'node:vm'
import { createRequire } from 'node:module'
import test from 'node:test'
import assert from 'node:assert/strict'
import * as helpers from '../pages/jobs/companions-page.js'
const require = createRequire(import.meta.url), compiler = require('@vue/compiler-sfc'), vue = require('vue')
const source = compiler.parse(fs.readFileSync(new URL('../pages/jobs/companions.vue', import.meta.url), 'utf8')).descriptor.scriptSetup.content
const ast = compiler.babelParse(source, { sourceType: 'module' })
const code = ast.program.body.filter(n => n.type !== 'ImportDeclaration').map(n => source.slice(n.start, n.end)).join('\n')
const tick = () => new Promise(resolve => setImmediate(resolve))
function harness() {
  const log = { reads: [], joins: [], routes: [], chats: [], toasts: [] }
  const state = { team: { job: { jobId: 7, title: '海边换宿', status: 'published' }, remaining: 2, myAppId: null, joined: false, members: [] }, detail: { jobId: 7, acceptsApplication: true }, confirm: true, fail: false, detailFail: false, joinFail: false, chatFail: false }
  let onLoad, onShow, onUnload
  const experience = vue.reactive({ account: { id: 1 } })
  const sandbox = { ...helpers, ref: vue.ref, computed: vue.computed, console, experience,
    useScreen: (_, opts) => { onLoad = opts.onLoad; return vue.ref(1) }, onShow: fn => { onShow = fn }, onUnload: fn => { onUnload = fn }, onPullDownRefresh() {},
    ensureSession: async () => {}, go: p => log.routes.push(p), back: () => log.routes.push('back'), toast: m => log.toasts.push(m),
    fail: (e, fallback) => log.toasts.push(e?.message || fallback), errText: (e, fallback) => e?.message || fallback, absUrl: v => v,
    confirm: async () => state.confirm, gated: fn => fn(), getCurrentPages: () => [],
    R: { login: '/login', jobApply: '/apply', jobTeam: '/team', jobDetail: '/detail', userProfile: '/user', chat: '/chat' },
    apiJobTeam: async id => { log.reads.push(id); if (state.fail) throw new Error('加载失败'); return { data: structuredClone(state.team) } },
    apiJobDetail: async () => { if (state.detailFail) throw new Error('详情暂不可用'); return { data: state.detail } },
    apiJoinTeam: async (id, visible) => { log.joins.push([id, visible]); if (state.joinFail) throw new Error('网络断开'); state.team.joined = visible; return { data: structuredClone(state.team) } },
    apiChatOpen: async payload => { log.chats.push(payload); if (state.chatFail) throw new Error('对方不接受陌生人私信'); return { data: { convId: 91 } } }
  }
  vm.createContext(sandbox); vm.runInContext(code, sandbox)
  return { log, state, experience, run: s => vm.runInContext(s, sandbox), open: async (q = { jobId: '7' }) => { onLoad(q); onShow(); await tick() }, show: async () => { onShow(); await tick() }, close: () => onUnload() }
}
test('可见列表只取有效主动加入成员，去重、自身置顶，不从总报名数补假人', () => {
  const rows = helpers.companionMembers({ applied: 999, members: [null, { userId: 2, name: '小林', meta: '大连｜30天' }, { userId: 0 }, { userId: 2 }, { userId: 1, name: '阿青' }] }, 1)
  assert.equal(rows.length, 2); assert.equal(rows[0].isMe, true); assert.equal(rows[1].meta, '大连｜30天')
})
test('非法岗位或错位响应不显示伙伴、不发起无效请求', async () => {
  for (const id of [undefined, '0', '-1', 'abc', 'Infinity']) {
    const h = harness(); await h.open({ jobId: id }); assert.equal(h.log.reads.length, 0); assert.match(h.run('loadError.value'), /缺少岗位/)
  }
  const h = harness(); h.state.team.job.jobId = 8; await h.open(); assert.equal(h.run('team.value'), null)
})
test('首次加载失败可重试，返回页面会刷新同行名单及报名状态', async () => {
  const h = harness(); h.state.fail = true; await h.open(); assert.match(h.run('loadError.value'), /加载失败/)
  h.state.fail = false; await h.run('load()'); assert.equal(h.run('loadError.value'), '')
  h.state.team.myAppId = 15; await h.show(); assert.equal(h.run('actionLabel.value'), '加入同行')
})
test('游客去登录；未报名用户直接进入报名表，查看列表本身不创建报名或同行', async () => {
  const h = harness(); h.experience.account = null; await h.open(); await h.run('primaryAction()')
  assert.deepEqual(h.log.routes, ['/login']); assert.deepEqual(h.log.joins, [])
  h.experience.account = { id: 1 }; await h.run('primaryAction()')
  assert.match(h.log.routes.at(-1), /^\/apply\?jobId=7&title=/)
})
test('暂停、满员、截止不误导报名，详情失败只能重试；已报名仍能加入', async () => {
  for (const patch of [{ status: 'paused' }, { remaining: 0 }, { acceptsApplication: false, applyClosedReason: '报名截止' }]) {
    const h = harness(); Object.assign(h.state.team.job, patch); if ('remaining' in patch) h.state.team.remaining = patch.remaining; Object.assign(h.state.detail, patch)
    await h.open(); await h.run('primaryAction()'); assert.equal(h.log.routes.length, 0)
    h.state.team.myAppId = 15; await h.run('load()'); await h.run('primaryAction()'); assert.equal(h.log.joins.length, 1)
  }
  const h = harness(); h.state.detailFail = true; await h.open(); await h.run('primaryAction()'); assert.equal(h.log.routes.length, 0)
})
test('加入和退出均需确认，连点只写一次；失败保留原状态', async () => {
  const h = harness(); h.state.team.myAppId = 15; await h.open()
  h.state.confirm = false; await h.run('setJoined(true)'); assert.equal(h.log.joins.length, 0)
  h.state.confirm = true; await Promise.all([h.run('setJoined(true)'), h.run('setJoined(true)')]); assert.deepEqual(h.log.joins, [[7, true]])
  assert.equal(h.run('team.value.joined'), true); assert.equal(h.run('actionLabel.value'), '邀请朋友一起去')
  h.state.joinFail = true; await h.run('setJoined(false)'); assert.equal(h.run('team.value.joined'), true)
  h.state.joinFail = false; await h.run('setJoined(false)'); assert.equal(h.run('team.value.joined'), false)
  assert.equal(h.run('team.value.myAppId'), 15)
})
test('私信复用会话接口，自己不能发起；重复点击一次请求，拒绝时不跳转', async () => {
  const h = harness(); await h.open(); await h.run('greet({ userId: 1, isMe: true })'); assert.equal(h.log.chats.length, 0)
  await Promise.all([h.run('greet({ userId: 2 })'), h.run('greet({ userId: 2 })')]); assert.equal(h.log.chats.length, 1); assert.equal(h.log.routes.at(-1), '/chat?convId=91')
  h.state.chatFail = true; await h.run('greet({ userId: 3 })'); assert.equal(h.log.routes.length, 1); assert.match(h.log.toasts.at(-1), /不接受/)
})
test('离开页面后不再加载或导航，未知名额不当满员', async () => {
  const h = harness(); await h.open(); h.close(); await h.run('load()'); assert.equal(h.log.reads.length, 1)
  for (const remaining of [null, undefined, '', 2]) assert.equal(helpers.applicationBlockReason({ remaining }), '')
})
