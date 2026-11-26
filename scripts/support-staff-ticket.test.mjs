// 客服工单 / 员工消息的静态回归（node --test，不需要构建、不发请求，只读源码）。
// 守住 2026-10-14 回归（R3）修的几件事：
//   · 线上任务专员账号在员工身份收得到客服回复和授权变更通知（消息中心可见范围放行 support_ticket / grant）；
//   · 业务页未读数和员工身份消息中心同一口径，不再出现清不掉的红点；主理人授予角色的通知 biz_id 是授权ID；
//   · 员工身份工单的来源仍记页面，身份记在摘要标记里；
//   · 追问超长提前说清能写多少字；追问后的新工单页能看到自己写的追问；
//   · 「附近有什么兼职？」只答兼职；房源匹配理由末尾不再多一个逗号；
//   · 人员管理的成员名字后面带会员编号。
import assert from 'node:assert/strict'
import test from 'node:test'
import { readFile } from 'node:fs/promises'
import vm from 'node:vm'
import { parse, babelParse } from '@vue/compiler-sfc'
import { ref, computed, reactive, watch, effectScope } from 'vue'
import { submitSupportTicket } from '../common/support-ticket-request.js'

const read = async (p) => (await readFile(new URL(p, import.meta.url), 'utf8')).replace(/\r\n/g, '\n')
const javaRoot = '../../RuoYi-Vue/ruoyi-kangaroo/src/main/java/com/ruoyi/kangaroo/'
const mapper = await read('../../RuoYi-Vue/ruoyi-kangaroo/src/main/resources/mapper/kangaroo/KgMessageMapper.xml')
const support = await read(javaRoot + 'ext/user/KgSupportService.java')
const home = await read(javaRoot + 'ext/user/KgHomeService.java')
const team = await read(javaRoot + 'ext/staff/KgStaffTeamService.java')
const assistant = await read('../pages/home/assistant.vue')
const business = await read('../pages/staff/business.vue')

test('线上任务专员：员工身份的客服回复与授权通知在消息中心可见', () => {
  const start = mapper.indexOf('<sql id="currentChatReception">')
  const acl = mapper.slice(start, mapper.indexOf('</sql>', start))
  const restricted = acl.slice(acl.indexOf("restricted.role_code='online_staff'"), acl.indexOf("biz_type in ('application','online_submission')"))
  const allowed = restricted.match(/or biz_type in \(([^)]*'support_ticket'[^)]*)\)/)?.[1] || ''
  for (const type of ['grant', 'support_ticket']) assert.ok(allowed.split(',').includes("'" + type + "'"))
})

test('业务页未读数走消息中心同一口径', () => {
  const hub = team.slice(team.indexOf('public Map<String, Object> hub('), team.indexOf('public Map<String, Object> stores('))
  assert.match(hub, /messages\.countUnread\(c\.uid\(\), "staff"\)/)
  assert.doesNotMatch(hub, /from kg_message/)
})

test('主理人授予角色的通知 biz_id 是授权ID', () => {
  const grant = team.slice(team.indexOf('public String grant('), team.indexOf('public String revoke('))
  assert.match(grant, /grantId = db\.insert\("kg_staff_grant", row\)/)
  assert.match(grant, /切换到员工身份即可使用工作台。", grantId\);/)
})

test('员工身份工单：来源记页面，身份记摘要标记，回复按标记发回员工身份', () => {
  assert.match(support, /static final String STAFF_MARK = "【员工身份】";/)
  assert.doesNotMatch(support, /staff \? "staff" :/)
  assert.match(support, /\("staff"\.equals\(str\(r\.get\("context"\)\)\) \|\| str\(r\.get\("summary"\)\)\.startsWith\(STAFF_MARK\)\)/)
  // 用户自己的工单页不显示标记
  assert.match(support, /m\.put\("summary", r\.get\("summary"\) == null \? null : str\(r\.get\("summary"\)\)\.replace\(STAFF_MARK, ""\)\)/)
})

test('助手按问的岗位类型作答', () => {
  assert.match(support, /js = home\.jobsOfTypes\(city, types, 3\)/)
  assert.match(home, /public List<Map<String, Object>> jobsOfTypes\(String city, List<String> types, int limit\)/)
  assert.match(home, /j\.job_type in \(:t\)/)
})

test('房源 / 活动匹配理由：空字符串不再拼出多余的逗号', () => {
  assert.doesNotMatch(home, /s\.get\("area"\) == null/)
  assert.match(home, /\(area\.isEmpty\(\) \? "" : "，" \+ area\)/)
  assert.match(home, /\(place\.isEmpty\(\) \? "" : "，集合：" \+ place\)/)
})

const setup = parse(assistant).descriptor.scriptSetup.content
const pageCode = babelParse(setup, { sourceType: 'module' }).program.body
  .filter(node => node.type !== 'ImportDeclaration').map(node => setup.slice(node.start, node.end)).join('\n')
const later = () => { let resolve; const promise = new Promise(r => { resolve = r }); return { resolve, promise } }
const settle = () => new Promise(r => setImmediate(r))
const longId = '9007199254740993123'
const ticketRow = id => ({ ticketId: id, question: '订单取消', summary: '咨询', context: 'order', related: '订单：ST123　客房', reply: '已核实' })
function ticketPage(t) {
  const log = { posted: [], prompts: [], toasts: [], loads: [] }
  const experience = reactive({ account: { id: 'A' }, mode: 'user' })
  let enter, unload
  const ctx = vm.createContext({
    ref, computed, watch, experience, submitSupportTicket, onLoad: fn => { enter = fn }, onUnload: fn => { unload = fn },
    ensureSession: async () => {}, decodeQuery: x => x, errText: e => e.message, toast: s => log.toasts.push(s),
    prompt: (title, opts) => { const d = later(); log.prompts.push({ opts, ...d }); return d.promise },
    apiSupportTicketDetail: async id => { log.loads.push(id); return { data: ticketRow(id) } },
    apiSupportTicket: async body => { log.posted.push({ ...body }); return { data: { ticketId: '42', message: '已提交' } } }
  })
  const scope = effectScope()
  scope.run(() => vm.runInContext(pageCode, ctx))
  t.after(() => { unload?.(); scope.stop() })
  return { log, experience, ctx, open: id => enter({ ticket: id }), run: expr => vm.runInContext(expr, ctx), unload: () => unload() }
}

test('消息深链追问只开一个输入框，沿用本人原订单，按实际工单号限制 500 字', async t => {
  const p = ticketPage(t)
  await p.open(longId)
  assert.equal(p.run('relatedOrder.value'), '订单：ST123　客房')
  const max = 500 - ('追问（工单 ' + longId + '）：').length
  const first = p.run('submitTicket()')
  const second = p.run('submitTicket()')
  assert.equal(p.log.prompts.length, 1)
  assert.match(p.log.prompts[0].opts.placeholder, new RegExp(String(max)))
  p.log.prompts[0].resolve('问'.repeat(max + 1))
  await Promise.all([first, second])
  assert.equal(p.log.posted.length, 0)
  assert.match(p.log.toasts.at(-1), new RegExp(String(max)))
  const edit = p.run('addSupplement()')
  p.log.prompts.at(-1).resolve('问'.repeat(max))
  await edit
  await Promise.all([p.run('submitTicket()'), p.run('submitTicket()')])
  assert.equal(p.log.posted.length, 1)
  const body = p.log.posted[0]
  assert.equal(body.question.length, 500)
  assert.equal(body.followUpTicketId, longId)
  assert.equal(body.context, 'order')
  assert.equal(body.related, '订单：ST123　客房')
  assert.deepEqual(p.log.loads, [longId, '42'])
})

test('追问输入中切换工单、账号或退出页面，都不会发送或带回旧草稿', async t => {
  for (const action of ['ticket', 'account', 'mode', 'unload']) {
    const p = ticketPage(t)
    await p.open('17')
    const pending = p.run('submitTicket()')
    if (action === 'ticket') await p.open('18')
    if (action === 'account') p.experience.account = { id: 'B' }
    if (action === 'mode') p.experience.mode = 'staff'
    if (action === 'unload') p.unload()
    p.log.prompts[0].resolve('旧账号的订单内容')
    await pending
    assert.equal(p.log.posted.length, 0, action)
    assert.equal(p.run('supplement.value'), '', action)
  }
})

test('追问已落库但响应丢失，重新打开后复用工单请求，收到回执才清除待重试记录', async t => {
  const storage = new Map(), savedUni = globalThis.uni
  globalThis.uni = {
    getStorageSync: k => storage.get(k), setStorageSync: (k,v) => storage.set(k,v), removeStorageSync: k => storage.delete(k)
  }
  t.after(() => { globalThis.uni = savedUni })
  const requests = [], first = ticketPage(t)
  await first.open('310')
  first.ctx.apiSupportTicket = async body => { requests.push(body); throw new Error('响应丢失') }
  first.run("supplement.value = '额外的退款问题'")
  await first.run('submitTicket()')
  assert.equal(first.run('supplement.value'), '额外的退款问题')
  assert.equal(storage.size, 1)
  assert.ok(!JSON.stringify([...storage]).includes('退款问题'))
  first.unload()
  const second = ticketPage(t)
  second.ctx.submitSupportTicket = (await import('../common/support-ticket-request.js?restart')).submitSupportTicket
  second.ctx.apiSupportTicket = async body => { requests.push(body); return { data: { ticketId: '311', message: '已提交' } } }
  await second.open('310')
  second.run("supplement.value = '额外的退款问题'")
  await second.run('submitTicket()')
  assert.match(requests[0].requestId, /^[a-z0-9_-]{16,64}$/)
  assert.equal(requests[1].requestId, requests[0].requestId)
  assert.equal(second.run('ticket.value.ticketId'), '311')
  assert.equal(storage.size, 0)
  await second.open('310')
  second.run("supplement.value = '额外的退款问题'")
  await second.run('submitTicket()')
  assert.notEqual(requests[2].requestId, requests[0].requestId, '成功后的新追问独立提交')
})

test('旧详情、追问和评价的迟到响应不会覆盖正在查看的工单', async t => {
  const p = ticketPage(t)
  const slow = later(), posted = later(), rated = later()
  p.ctx.apiSupportTicketDetail = id => id === '17' ? slow.promise : Promise.resolve({ data: ticketRow(id) })
  const old = p.open('17')
  await settle()
  await p.open('20')
  slow.resolve({ data: ticketRow('17') })
  await old
  assert.equal(p.run('ticket.value.ticketId'), '20')
  p.ctx.apiSupportTicket = () => posted.promise
  p.ctx.apiSupportRate = () => rated.promise
  p.run("supplement.value = '补充'")
  const sent = p.run('submitTicket()'), rating = p.run('rate(faces[0])')
  await p.open('21')
  posted.resolve({ data: { ticketId: '22', message: '旧提交' } })
  rated.resolve({ msg: '旧评价' })
  await Promise.all([sent, rating])
  assert.equal(p.run('ticket.value.ticketId'), '21')
  assert.deepEqual(p.log.toasts, [])
})

test('人员管理：成员名字后面带会员编号', () => {
  const open = business.slice(business.indexOf('async function openRole('), business.indexOf('async function newRole('))
  assert.match(open, /（会员编号 \$\{m\.userId\}）/)
  assert.match(open, /撤销 \$\{who\(m\)\} 的/)
})
